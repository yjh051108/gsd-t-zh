# binvoice — Grouped Orders → PayPal Invoice (Created, not sent) → Locked

**Pseudocode + intention for how a buyer's grouped orders become a real PayPal invoice and
lock the underlying orders — with no stored draft; the invoice record is born only when PayPal
confirms the invoice was CREATED.**
Covers WHERE the system calls PayPal, WHEN it refuses to (idempotency + lock), and how the lock
reaches the extension. **Create-only: no status reconciliation (§3).**

> **⚠ THE APP DOES NOT SEND THE INVOICE TO THE BUYER (David, 2026-06-17).** It CREATES the
> invoice on PayPal and stops. The seller reviews it and sends it to the buyer from PayPal. "Send"
> here always means **"to PayPal"** (create it in the seller's PayPal account) — NEVER "email
> the buyer." That is why the button is **Create Invoice**, not "Send".

_Forward-looking behavior map for **S2-M5** (PayPal Invoicing v2 — CREATE-ONLY +
invoiced-lock; NO status reconciliation). Not yet built — grounds itself in the EXISTING contracts it must respect:
`aggregation-drafts-contract.md` (the draft model it SUPERSEDES — see §0), `reconcile-contract.md`
(the `locked` state it must produce), and the frozen `Invoice` schema (`provider` / `invoiced` /
`externalId` / `InvoiceStatus`). Companion to `PseudoCode-Extension.md`. See
`.gsd-t/roadmap.md` § S2-M5 for the milestone scope._

---

## The one money call, in one breath

| Call | Lives in | Decides | Runs only when… |
|------|----------|---------|-----------------|
| **PayPal Create** (Invoicing v2) | **Server** (Cloud Run) | turn a buyer's grouped orders into a real PayPal invoice (CREATED, unsent) | the seller clicks **Create Invoice** on a buyer group (orders still ORDER-status; never double-created) |
| **PayPal Get** (one read, on demand) | **Server** | does this invoice STILL exist on PayPal? | the seller clicks 🔒 → **Check First** / **Recreate** (§4b) — seller-initiated, NOT background |

> **SCOPE (David, 2026-06-17): create-only. binvoice is NOT an accounting system.** The ONLY
> thing this milestone captures is that the invoice was **created successfully in PayPal**. There
> is NO webhook, NO polling, NO PAID / OVERDUE / status-flows-back machinery — once created, the
> app does not track what happens to the invoice afterward (the seller manages it in PayPal). The
> sole PayPal READ is the on-demand existence check behind the manual unlock/recreate button (§4b).
>
> PayPal is touched on the SERVER only — never the extension, never the browser. The web app
> asks the server to create; the server holds the OAuth credentials and owns every PayPal call.
> **The server CREATES only — it never calls PayPal's `/send`.** The seller sends it to the buyer from PayPal.
> **Each seller connects their OWN PayPal account at setup** (auth workflow TBD — out of scope
> here); the server invoices through THAT seller's account, never a shared app account.
> **Sandbox first, live behind a config flag.** No real money until the flag flips.

---

## 0. Where this picks up — NO DRAFT; grouping is a live view

> **⚠ ENUM vs LABEL (corrected 2026-06-18 — verified against schema.prisma).** "ORDER" is a
> DISPLAY LABEL only — the pill shown for an eligible order. The real `OrderStatus` enum has NO
> `ORDER` value: it is `{CAPTURED, VAGUE, UPDATED, CANCELED, NA, INVOICED, OUT_OF_STOCK}`. So
> wherever this doc says "ORDER-status" / "status == ORDER" as LOGIC, read it as:
> **create-eligible = `status ∈ {CAPTURED, UPDATED}`** (the buyer-grouping precedent), and the
> **unlock target (orders return to) = `CAPTURED`**. The word "Order" survives only as the
> pill text (`CAPTURED → "Order"`, StatusPicker). Never compare `status === 'ORDER'` in code.

> **Intention (David, 2026-06-17 — supersedes the S2-M4 stored-draft model).** There is NO
> saved draft of anything. The web app simply GROUPS the seller's current ORDER-status items
> by buyer — a computed view, nothing persisted. When grouped that way, each buyer's group
> header shows a **Create Invoice** button. An `Invoice` RECORD is born ONLY when a PayPal
> invoice is confirmed created (§2). Before that there is no invoice object; after, there is a
> permanent CREATED-invoice record (id + url + status + linked orders).
>
> **One seller, one PayPal account, one view.** A seller only ever sees + works their OWN
> orders in the web app, and invoices through their OWN connected PayPal account. There is no
> cross-seller path in the UI — so the ownership check in §2 is a server-side BACKSTOP against
> a forged/malformed request, not a business rule the seller can trip.

```text
PRECONDITION:
  No stored invoice. Just the seller's current ORDER-status line items, grouped by BUYER NAME
  (a live view). Each buyer group → a "Create Invoice" button in its header.
```

> **Buyer identity = NAME (not email, this version).** The web app does NOT yet hold the
> buyer's email — it sends the buyer's NAME. In most cases the seller already has that buyer in
> their PayPal account; if not, they add them in PayPal. Buyer contact info in the web app is a
> FUTURE addition.
>
> **Totals are ALWAYS computed, never stored.** The web app sums the current line items on
> every read — no stored `subtotal`/`total`. (S2-M4 added those columns; this flow ignores
> them.) A locked invoice still DISPLAYS a freshly computed total — locking freezes the DATA,
> not the ability to add it up.
>
> **No shipping (this version).** binvoice does NOT handle shipping. The seller adds shipping
> themselves in PayPal after the invoice is created. Line items carry name/qty/price only.
>
> ⚠ **Divergence from shipped S2-M4 (plan-time reconcile):** S2-M4 persists an
> `Invoice{status:DRAFT}` row per buyer via `/drafts/assemble` (+ the `invoices_draft_buyer_uq`
> index + DraftsPanel-era plumbing). THIS model never creates a DRAFT row — the Invoice row is
> born at create as `CREATED`. The S2-M4 draft-persistence becomes dead code to retire/repurpose;
> the `Invoice` table itself is reused (just only ever written at create). Flag for the S2-M5 plan.

---

## 1. Create — the seller creates a PayPal invoice for a buyer group (web app → server)

> **Intention.** The seller groups orders by buyer, reviews the group, and clicks **Create
> Invoice** in the group header. The web app NEVER talks to PayPal — it POSTs the buyer's NAME
> + that group's order ids to OUR server, which owns the money call. No draft id (there is no
> draft); the server creates an invoice for exactly the orders the seller is looking at. The
> invoice is created on PayPal but NOT sent to the buyer — we open it in a new tab for the
> seller to review and send to the buyer from PayPal.

```text
WEB APP  on "Create Invoice" click (buyer group header):
    disable the button (in-flight)
    POST /invoices/create  { buyerName, orderIds: [ the group's current ORDER-status ids ] }
    on 200:  open a NEW TAB → the returned invoiceUrl (the invoice on PayPal, ready to send there)
             refetch → the group's pills flip ORDER → INVOICED ; header now shows
             the Invoice-ID HYPERLINK + 🔒 lock (see §4)
    on 409:  show the reason (e.g. an order already invoiced) — not a crash
    on 401:  signed-out alert (SignedOutError)
```

---

## 2. Server — `POST /invoices/create`  (★ THE MONEY CALL — the record is born here)

> **Intention.** Create a real PayPal invoice for a buyer's grouped orders, and ONLY on
> confirmed creation persist the CREATED-invoice record + lock the orders. No invoice object
> exists before this call; one exists after. **No `/send` call — the seller sends it to the buyer from PayPal.**
> Every guard makes a double-click / retry HARMLESS.

```text
createInvoice({ buyerName, orderIds }):

    # ── GATE 1 — gather + validate the orders (RULE) ───────────────────────
    # Intention: invoice exactly the orders the seller is looking at, re-validated server-side.
    # OWNERSHIP IS A BACKSTOP: the seller only sees their own orders, so a foreign id can only
    # come from a forged request — drop the whole create (404, leaks nothing).
    orders = load Orders(orderIds) FOR UPDATE        # row-lock: serialize concurrent creates
    if any order not found OR not owned by session.seller:   → 404
    if any order.status NOT IN {CAPTURED, UPDATED} (e.g. already INVOICED):  → 409  "already invoiced / not eligible"
    if orderIds is empty:                                    → 409  "nothing to invoice"

    # ── GATE 2 — sanity-check the line items (RULE, backstop) ──────────────
    # Intention: PayPal totals the items; we only guard an IMPOSSIBLE line. Near-impossible
    # already: (1) the extension never pushes without price+qty; (2) the web app forbids
    # typing 0/blank. Last-line backstop — a warning, not a workflow.
    items = current line items of orders             # already up to date — edits apply immediately
    if any item has unitPrice <= 0 OR quantity <= 0:    → 409  "unpriced/zero line — fix first"

    # ── STEP 3 — PayPal OAuth for THIS SELLER'S account (server-held) ──────
    # Intention: invoice through the SELLER'S OWN connected PayPal account — never a shared one.
    # Sandbox or live base URL by config — NEVER hardcoded.
    if seller has NO connected PayPal account:   → 409  "connect PayPal first"
    token = paypalTokenFor(session.seller)   # seller's own creds; cache; base = SANDBOX unless LIVE flag

    # ── STEP 4 — CREATE the PayPal invoice ─────────────────────────  ★ THE ONLY PAYPAL WRITE
    # Intention: send line items ONLY — name/qty/unit_amount. PayPal totals them. No total, no
    # shipping. Recipient identified by NAME (no email yet) — seller matches/adds them in PayPal.
    # We DO NOT call /send — the invoice stays an unsent PayPal DRAFT for the seller to send.
    resp = POST {base}/v2/invoicing/invoices            # → 201; body is just a {rel:self,href} link
        { detail:{ currency_code: seller.currency },
          primary_recipients:[{ billing_info:{ name: buyerName }}],   # name only, this version
          items: orders.flatMap(lineItems → { name, quantity, unit_amount }) }
    # ★ R1-CONFIRMED SHAPE (live sandbox 2026-06-18): the id is NOT a body field — it is the
    # Location header's last path segment; the openable URL needs a GET after create.
    externalId = lastPathSegment(resp.Location)         # e.g. INV2-J5PS-Z6HD-H8EE-JHZ9
    inv        = GET {base}/v2/invoicing/invoices/{externalId}        # one read to get the URL
    invoiceUrl = inv.detail.metadata.invoicer_view_url  # MERCHANT review/send page (NOT recipient_view_url — HC-003)

    # ── STEP 5 — PERSIST the CREATED record + LOCK (RULE, one tx) ──────────
    # Intention: the record is BORN here — only after PayPal confirms creation. id + url + status
    # + the linked orders land together; the orders flip + lock atomically. DEC-006 now holds (§5).
    # The lock means "this is now on PayPal — capture, hands off" (NOT "the buyer was billed").
    # buyerEmail is required-NOT-NULL on the schema but we have no real email (HC-003) — write a
    # SYNTHETIC placeholder (the same fb-<id>@buyers.binvoice.local pattern order-mapper uses).
    in ONE tx:
        create Invoice { provider:'paypal', status:CREATED, invoiced:true,  # born CREATED, never DRAFT
                         externalId, invoiceUrl, buyerName, buyerEmail:synthEmail(buyer), orders }
        each order.status = INVOICED                    # ORDER → INVOICED pills + lock
    return 200 { status:'created', externalId, invoiceUrl }   # the call returns; client refetches (no broadcast — no reconciliation)

    # ── FAILURE — never half-create (RULE) ─────────────────────────────────
    # Intention: a failed create persists NOTHING — no minimal record, no orphan-adoption (there
    # is no poll/reconcile to adopt it, §3). The orders keep their status; the seller simply retries.
    on PayPal failure (any point):  nothing persisted ; orders untouched ; → 502  (safe retry)
```

---

## 3. No reconciliation — the app does not track status after create (David, 2026-06-17)

> **Intention.** Deliberately OUT of scope. binvoice is not an accounting system. Once we have
> CREATED the invoice on PayPal, the app records nothing further about its lifecycle. There is
> **no webhook, no polling, no PAID/SENT/OVERDUE status-flow-back, and no `invoice.updated`
> broadcast.** The seller manages the invoice (send, get paid, mark paid, cancel) entirely inside
> PayPal — binvoice neither observes nor mirrors that.
>
> **The ONE status the app holds is `CREATED`** (= the invoice exists on PayPal). The only way an
> invoice leaves that state in binvoice is the **seller-initiated** Check First / Recreate flow
> (§4b), which makes a single on-demand PayPal GET to confirm the invoice was deleted, then
> unlocks. That is a manual button, not background reconciliation.

---

## 4. Web app — invoice header row: ID-link + lock (reads cloud)

> **Intention.** Once a buyer group is invoiced, its header stops showing "Create Invoice" and
> shows the proof: a hyperlinked Invoice ID and a lock. Everything reads our DTO — the web app
> never knows PayPal exists. Money shown is always COMPUTED from current line items.

```text
ORDERS GRID  after a create succeeds (the create call refetches; no live broadcast):
    re-read GET /orders (+ /orders/stats)
    an invoiced buyer group's HEADER now renders:
        • Invoice ID  →  HYPERLINK to invoiceUrl (opens the PayPal invoice, new tab)
        • 🔒 lock icon  →  the "already created" affordance (opens the dialog in §4b)
    pills:   ORDER → INVOICED   (the only transition this milestone; no PAID/CANCELED flow-back)
    stat tiles:  invoiced count ↑ on CREATE
    # No invoice.updated subscription — there is no status reconciliation (§3). The grid
    # refetches because the create/recreate call returns; nothing pushes status later.
```

---

## 4b. Unlock / recreate — confirm-deletion-on-PayPal first (web app + server)

> **Intention (David, 2026-06-17).** A created invoice is locked. If it was DELETED on PayPal
> and must be remade, the seller can't just override the lock — we VERIFY against PayPal first
> (PayPal is the truth). Only a confirmed-deleted invoice can be unlocked or recreated.

```text
WEB APP  click 🔒 on an invoiced group header → dialog:
    title/body: "This invoice was already created on PayPal."
    buttons:    [ Recreate Invoice ]   [ Check First ]   [ Cancel ]
    Help (?) icon → popup:
        "Clicking Recreate Invoice will first check that the invoice has already been deleted
         on PayPal, and will recreate it if true. Clicking Check First will check if the
         invoice has been deleted from PayPal; it will unlock this invoice and reset the
         labels to ordered."

    Cancel            → close, no change.
    Check First       → POST /invoices/:externalId/check
    Recreate Invoice  → POST /invoices/:externalId/recreate
                        on 200: open a NEW TAB → the returned invoiceUrl (the fresh invoice on PayPal)


SERVER  POST /invoices/:externalId/check        (verify deletion → unlock)
    inv = load our Invoice by externalId (owned by session.seller, else 404)
    pp  = GET {base}/v2/invoicing/invoices/{externalId}    # ★ PAYPAL — does it still exist?
    if pp EXISTS:    → 409  "Still on PayPal — not unlocking."     # lock stays
    if pp DELETED (404):                                           # confirmed gone
        in ONE tx:
            each member Order.status = CAPTURED    # reset to eligible (no longer invoiced); "Order" pill
            DELETE our Invoice record              # it's no longer an invoice
        → 200 { unlocked: true }   # the call returns; client refetches → group header shows "Create Invoice" again (no broadcast)


SERVER  POST /invoices/:externalId/recreate       (verify deletion → recreate)
    # SAME verification first — never recreate over an invoice still on PayPal.
    if pp EXISTS:    → 409  "Still on PayPal — delete it there first."
    if pp DELETED (404):
        unlock as above (orders → CAPTURED, drop the old record)
        then run createInvoice({ buyerName, orderIds: those orders })   # §2 — fresh PayPal invoice
        the new record (new externalId + url) replaces the old; orders → INVOICED + lock
        → 200 { status:'created', externalId, invoiceUrl }
```

> **Record lifecycle:** the invoice record is CREATED on confirmed PayPal creation (§2), DELETED
> on a confirmed Check-First unlock, and REPLACED (new id/url) on a confirmed Recreate. It only
> ever exists while a real PayPal invoice exists.

---

## 5. The lock closes the loop — capture can never touch an invoiced order

> **Intention.** This is the WHOLE point of DEC-006 and where S2-M5 meets the extension. Once
> `Invoice.invoiced=true`, the SAME server `/ingest` path the extension already pushes to
> refuses to mutate the locked orders. The extension reads the lock BACK and stops trying.
> (Lock = "this is on PayPal now," set at CREATE — it does not require the buyer to have paid.)

```text
ALREADY ENFORCED by reconcile-contract (the server half, shipped S2-M6):
  persistPayload(IngestPayload):
      if the order's Invoice.invoiced=true (or non-DRAFT):  reconcileState = 'locked'
      → NO status write, NO line-item churn, NO price ripple, NO broadcast, updatedAt untouched
      → /ingest 200 returns reconcileState:'locked' + the persisted orderStatus

EXTENSION reads it back (the producer half):
  on /ingest 200 with reconcileState='locked':
      the row's pill shows the REAL cloud status (orderStatus) — Invoiced / Paid / Canceled
      capture makes NO further attempt to edit/cancel that comment
      # "Invoiced = locked" (CLAUDE.md inviolable): edits spawn a NEW order; an absent
      # invoiced order is FLAGGED for review, never auto-Canceled.
```

> S2-M5's job is only to SET `invoiced=true` at create (§2 STEP 5). The refusal machinery
> already exists — this pseudocode names it so the two milestones line up.

---

## 6. Money-safety map — every guard against a double-create

```text
GATE: order.status NOT IN {CAPTURED,UPDATED} → 409  [RULE] only eligible orders invoice (no ORDER enum; that's a label)
GATE: row lock (FOR UPDATE)      → serialize     [RULE] concurrent double-click → one create
GATE: empty / zero / unpriced line → 409        [RULE] backstop only — should be impossible (ext + UI block it)
GATE: not this seller's order    → 404          [RULE] ownership backstop (404 leaks nothing)
GATE: no connected PayPal        → 409          [RULE] invoice only through the seller's OWN account
NEVER call PayPal /send                          [RULE] app creates only; the seller sends on PayPal
record born at confirmed create                  [RULE] no invoice object exists before PayPal confirms
unlock/recreate verify deletion first            [RULE] never unlock/recreate over a LIVE PayPal invoice
on create failure: persist NOTHING, → 502        [RULE] failed create leaves orders untouched; safe retry
sandbox base unless LIVE flag                     [RULE] no real money until config flips
invoiced=true at create                          [RULE] DEC-006 lock → capture frozen out
```

**No stored draft; the record is born at confirmed create. The app CREATES on PayPal but never
sends to the buyer, and does NOT track status afterward (no reconciliation). One lock per create;
unlock/recreate only via the seller's manual Check First (verify-deleted-on-PayPal first). The
extension never calls PayPal; the server never double-creates; capture never touches a locked order.**

---

## Appendix — Raw pseudocode (no intention comments)

```text
# ════════════════════════════════════════════════════════════════════════════
# WEB APP — Create trigger (buyer group header) + lock dialog
# ════════════════════════════════════════════════════════════════════════════
on "Create Invoice" click (buyer group):
    disable button
    POST /invoices/create { buyerName, orderIds }
    200 → open new tab → invoiceUrl ; refetch (group pills → INVOICED ; header → ID-hyperlink + 🔒) ; 401 → signed-out

on 🔒 click (invoiced group):  dialog [Recreate Invoice] [Check First] [Cancel] + Help(?) popup
    Check First       → POST /invoices/:externalId/check
    Recreate Invoice  → POST /invoices/:externalId/recreate ; 200 → open new tab → invoiceUrl
    Cancel            → close

# ════════════════════════════════════════════════════════════════════════════
# SERVER — POST /invoices/create   (★ money call; create only, never /send; record born here)
# ════════════════════════════════════════════════════════════════════════════
createInvoice({buyerName, orderIds}):
    orders = load Orders(orderIds) FOR UPDATE
    if any not found / not this seller's:  → 404   # ownership backstop
    if any order.status NOT IN {CAPTURED,UPDATED}:  → 409   # already invoiced / not eligible
    items = current line items of orders
    if empty / any unitPrice<=0 / any qty<=0:  → 409       # backstop — should be impossible
    if seller has no connected PayPal: → 409
    token = paypalTokenFor(session.seller)                 # seller's own account; sandbox unless LIVE flag
    resp = POST /v2/invoicing/invoices {recipient.name=buyerName, items:{name,qty,unit_amount}}  # ★ CREATE only → 201 (no /send, no total/shipping/email)
    externalId = lastPathSegment(resp.Location)           # R1: id from Location header, not body
    invoiceUrl = GET /v2/invoicing/invoices/{externalId} → detail.metadata.invoicer_view_url  # merchant view URL; GET-after-create
    buyerEmail = buyer.email ?? synthEmail(buyer.fbId)     # real buyer.email if present, else synthetic; col NOT NULL; no email to PayPal (HC-003)
    tx: create Invoice{status:CREATED, invoiced:true, externalId, invoiceUrl, buyerName, buyerEmail, orders}
        member Order.status = INVOICED
    return 200 {status:'created', externalId, invoiceUrl}  # the call returns; client refetches (no broadcast)
    on fail (any point): persist NOTHING ; orders untouched ; → 502   # safe retry (no orphan-adoption machinery — no poll exists)

# ════════════════════════════════════════════════════════════════════════════
# SERVER — unlock / recreate (verify deletion on PayPal FIRST)
# ════════════════════════════════════════════════════════════════════════════
POST /invoices/:externalId/check:                       # seller-initiated; the ONLY PayPal read
    inv = load by externalId (this seller's, else 404)
    pp = GET /v2/invoicing/invoices/{externalId}        # ★ still exist?
    if pp EXISTS:   → 409 "still on PayPal — not unlocking"
    if pp DELETED:  tx: member Order.status=CAPTURED ; DELETE record ; → 200 {unlocked:true}

POST /invoices/:externalId/recreate:
    same delete-check first ; if EXISTS → 409
    if DELETED: unlock (orders→CAPTURED, drop record) ; createInvoice({buyerName, orderIds}) ; → 200 {created}

# (NO reconciliation — no webhook, no poll, no applyPaypalStatus. The app does not track
#  invoice status after create; the seller manages send/paid/cancel inside PayPal. §3.)

# ════════════════════════════════════════════════════════════════════════════
# EXTENSION ↔ SERVER — lock readback (DEC-006; server half shipped S2-M6)
# ════════════════════════════════════════════════════════════════════════════
persistPayload(IngestPayload):
    if order's Invoice.invoiced=true / non-DRAFT:  reconcileState='locked' ; NO mutation
    return 200 {reconcileState:'locked', orderStatus}
extension on reconcileState='locked':
    pill shows real cloud status ; no further edit/cancel attempt
```
