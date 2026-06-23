# binvoice — Capture → Classify → Egress → Persist Pipeline

**Pseudocode + intention for how a scanned comment is processed, end to end.**
Covers WHERE and WHEN the system uses a deterministic RULE vs an AI call.

_Last updated: 2026-06-15 (dist 0.3.10.92). This is a behavior map, not source — see
`src/content/`, `src/classify/`, `src/egress/`, and `server/src/` for the implementation._

---

## The two AIs, in one breath

| AI call | Lives in | Decides | Runs only when… |
|---------|----------|---------|-----------------|
| **Classification AI** (Anthropic Haiku) | **Extension** (service worker) | order / vague / NA + line items | the NA pre-filter AND the rules-table both declined |
| **Pricing AI** (Anthropic Haiku) | **Server** (Cloud Run) | the post's unit **price** only | the extension didn't already parse a price by rule, the post is fully visible, and it wasn't parsed before |

> They never both run on the same thing. **Classification lives in the extension; the
> server trusts that verdict and only ever computes price.**

---

## 1. The Scanner (content-script realm)

> **Intention.** ONE finder that continuously discovers every comment on screen. It runs
> on a 1-second timer AND on every DOM change, so scrolling or expanding a post auto-feeds
> it — the seller does nothing but scroll. BOTH views (the raw **Debug** view and the
> processed **Capture** view) read from this single scanner, so they can never disagree
> about what comments exist.

```text
EVERY 1 SECOND, and on every DOM mutation:
  rescanAll():
    blocks = enumerateCommentBlocks(document)

    # ── PASS 1 — figure out WHOSE post each comment is in ───────────────────
    # Intention: the seller is the POST author, not the comment author. Resolve a
    # post's author ONCE and cache it, because a reply buried in a popup often
    # cannot see the post header from its own position in the DOM.
    for each <div dir="auto"> text leaf inside a [role="article"]:
        resolve host post (id + author)
        if author found AND not yet cached for this post:  cache (post → author)

    # ── PASS 2 — decide which comments are in scope ─────────────────────────
    # Intention: EVERY comment inside Marla's post is in scope. Only discard a
    # comment whose post is provably SOMEONE ELSE'S (a different seller in the feed).
    # A comment whose own author-walk failed inherits its post's cached author.
    for each candidate comment:
        author = its own resolved author, OR the post-level cached author (inherited)
        if author is KNOWN and is NOT the tracked seller:  DROP   # someone else's post
        else: emit block{ article, text, host }                  # keep (Marla's or unknown)

    for each emitted block:
      handleCommentBlock(block)
```

---

## 2. Capture gates (content-script realm)

```text
handleCommentBlock(block):

    # ── GATE 1 — strip Facebook's own UI text (a RULE: pure regex, NO AI) ───
    # Intention: "Like", "Reply", "4w", "Top contributor", "Marla replied" are page
    # chrome, never a buyer order. Exact-match anchored, so a real order that merely
    # CONTAINS such a word ("admin please add me, 2") is NOT eaten.
    if classifyAffordance(text) != null:  DISCARD

    # ── GATE 2 — dedup by CONTENT, not by Facebook's comment-id ─────────────
    # Intention: the scanner re-runs every second; we must not re-emit the same
    # comment. Key on (post | author | text) — STABLE — instead of the FB comment-id,
    # which flickers empty→real across scans and used to strand rows on 'pending'.
    # This set PERSISTS: a comment stays captured even after it scrolls off-screen or
    # the popup closes. Only the Clear button empties it.
    if already captured (post | author | text):  RETURN
    mark captured

    handleComment(block) → publishComment(comment)


handleComment(comment):  # (before publish — fills the post fields)

    # ── IN-SCOPE SELLER STAMP (2026-06-16, supersedes the conditional backfill) ──
    # Intention: the per-comment DOM walk loses the seller fbId when the post header
    # isn't in that comment's subtree → postAuthorFbId blank. But the seller id is a
    # KNOWN CONSTANT, and reaching here means the comment SURVIVED the upstream scope gate
    # (enumerateCommentBlocks PASS 2 drops a KNOWN different seller's post) — so the post IS
    # Marla's regardless of whether THIS comment resolved the author chip. So stamp the known
    # id+name UNCONDITIONALLY (no isTrackedSellerPost re-check — that guard returns false on a
    # blank author and could never fill the very rows that are blank, which is why the prior
    # backfill silently failed → rows stayed blank → egress identity gate quarantined them →
    # never uploaded; the web-app upload gap). Safe because it runs only post-scope-gate.
    stampInScopeSeller(DEFAULT_SELLER, postAuthorFbId, postAuthor):
        fbId ||= seller.fbId ; name ||= seller.displayName   # unconditional

publishComment(comment):

    # ── GATE 3 — final seller scope at the publish boundary ─────────────────
    # Intention: the IDENTICAL rule as the scanner (keep Marla + unknown; drop a known
    # different seller). Must match the scanner exactly so capture never drops a comment
    # the scanner kept.
    if post author is KNOWN and NOT the tracked seller:  DROP

    # Intention: announce the captured comment to the rest of the extension. THREE
    # independent listeners hear it. The PANEL shows it immediately as 'pending' —
    # it has no verdict yet.
    publish 'comment.captured'
        ├──► PANEL view-store       → renders a row, status = 'pending'
        ├──► CAPTURE-PERSISTER (SW) → mirrors to IndexedDB (so a closed panel still has it)
        └──► CLASSIFIER (SW)        → decides the verdict  (section 3)
```

---

## 3. The Verdict — RULE → RULE → AI (service-worker realm)

> **Intention.** Decide order / vague / NA as CHEAPLY as possible. Two deterministic
> rule gates run first; the AI is the last resort, reached only when both decline. The
> comment is classified **at most once** (one Anthropic call max per comment).

```text
CLASSIFIER  on 'comment.captured':

    # Intention: never classify the same comment twice (the bus delivers it twice, and
    # the scanner re-emits). One classify → one Anthropic call, not two.
    if commentId already being classified:  SKIP

    # ── STEP 1 — NA pre-filter  (DETERMINISTIC RULE, NO AI) ─────────────────
    # Intention: cheaply short-circuit the obvious non-orders BEFORE paying for AI.
    naResult = naPrefilter(comment):
        # seller talking on her OWN post → NA, EXCEPT a proxy order she places on a
        # buyer's behalf ("2 lots for Gwen") — that IS a real order.
        if commenterFbId == postAuthorFbId AND text is NOT "N for/to <Name>":  → NA
        if text is pure emoji / pure @-tag / a membership badge:               → NA
    if naResult != null:
        publish verdict.ready(NA)        # → PANEL flips the pill, → EGRESS can push
        return                           # DONE — NO AI spent

    # ── STEP 1b — RULES TABLE  (DETERMINISTIC, NO AI) ───────────────────────
    # Intention: a learned shortcut. Phase 1 the table is EMPTY (always null → falls
    # through). Phase 2 (after ~1000 verified comments): exact-text matches return a
    # verdict here with no AI. Dormant today.
    ruleResult = lookupRule(comment)
    if ruleResult != null:
        publish verdict.ready(ruleResult)
        return                           # DONE — NO AI spent

    # ── STEP 2 — AI (Anthropic Haiku) ─────────────────────────────  ★ THE AI CALL
    # Intention: the ONLY place free-text judgment happens — order vs vague vs NA, and
    # the line items. Reached ONLY when both rule gates above declined.
    aiResult = classifyComment(comment.text)
        if no API key:  verdict = NEEDS_KEY     # non-terminal: release dedup so a re-emit
                                                # after the key is set retries
        else:           verdict = buildVerdict(aiResult)   # Order / Vague / NA + line items

    # Intention: a transient failure (timeout / 429 / network) must NOT lose the comment —
    # degrade to Vague (surfaces for human review) and release the dedup so a later
    # re-emit can re-classify cleanly.
    on throw:  verdict = Vague; release dedup

    # Intention: tell everyone the result. PANEL pill flips pending → Order/Vague/NA;
    # EGRESS can now correlate and push.
    publish verdict.ready(verdict)
```

---

## 4. Egress — push to the server, only AFTER a verdict

> **Intention.** Only ever push a COMPLETE record (the comment + its verdict + the post's
> price). This is exactly WHY a comment stuck on 'pending' never reaches the database —
> with no verdict there is nothing complete to push.

```text
EGRESS  waits to correlate 'comment.captured' + 'verdict.ready' by commentId:

    # Intention: don't push half a record.
    if no verdict yet for this commentId:  WAIT       # ← this is the 'pending' that never pushes

    when comment AND verdict are both present:
        build IngestPayload(comment + verdict + postMeta incl. EXTENSION-parsed price)

        # Intention: fail safe — never lose data.
        if egress unconfigured (no endpoint / token):  DROP silently   # local-only mode
        if a prior 401 latched, or offline:            QUEUE in IndexedDB, retry later
        else:                                          POST /ingest
```

---

## 5. Server — `POST /ingest` (classification trusted; AI for PRICE only)

> **Intention.** The server does NOT re-judge order/vague/NA — it trusts the extension's
> verdict. It stores the record idempotently and the ONLY judgment it may make is the
> unit price, and even then only as a fallback when the extension didn't already parse
> one by rule.

```text
persistPayload(IngestPayload):

    # Intention: idempotent store keyed by FB comment-id — re-pushing the same comment
    # never duplicates it.
    upsert Comment row   (key = commentId)

    upsert Order row     (key = commentId):
        status = map(verdict.status)        # Order / Vague / NA / Updated / Canceled
        # Intention: NA STILL gets a row (counts + audit stay complete) — just marked NA.
        # Intention: protect finished work — if this order is already invoiced (LOCKED)
        # or the buyer's comment is byte-for-byte UNCHANGED, do nothing (no status
        # regression, no line-item churn, no spurious broadcast).
        if locked OR comment unchanged:  no-op
        else: rebuild LineItems from the verdict

    # ── PRICE — separate from classification ────────────────────────────────
    if payload carries an EXTENSION price (deterministic per-seller rule):
        # Intention: trust the extension's regex price; never bill AI for it.
        applyExtensionPrice()                         # NO AI
        ripple that price to other non-overridden orders on the same post
    else:
        # ── SERVER AI (Anthropic Haiku) — PRICE ONLY ───────────────  ★ SERVER AI CALL
        scheduleAutoParse(postId):
            # Intention: parse the unit price from the post body, once, cheaply, only when worth it.
            if no server API key (dormant):        SKIP
            if post already priced (parsedAt set): SKIP   # parse once, never re-bill
            if post body is TRUNCATED:             SKIP   # wait until the full text is visible
            else:  call Haiku → parse unit price → apply + broadcast order.updated
```

---

## 6. Rules vs AI — the decision map

```text
SCANNER          → finds comments (structure-tolerant)                  [no judgment]
classifyAffordance → strips FB chrome (Like/4w/badges/replied)          [RULE — regex]
seller scope      → keep Marla + unknown; drop a known other seller     [RULE — per-post author]
stampInScopeSeller → stamp Marla's KNOWN id on EVERY captured row       [RULE — known constant; post-scope-gate]
naPrefilter       → self-comment / emoji / @-tag → NA (+ proxy carve)   [RULE — deterministic]
rules-table       → proven exact-text match (EMPTY in Phase 1)          [RULE — dormant]
classifyComment   → order / vague / NA + line items                     [★ EXTENSION AI]
price-parse (ext) → "<n> each" / "<n> per <unit>" by seller rule        [RULE — regex]
egress identity   → DROP-to-quarantine if commentId/commenterFbId/      [RULE — egress gate]
                    postId/postAuthorFbId is EMPTY (server FK requires)
auto-parse (svr)  → unit price from post body when no rule price        [★ SERVER AI]
persistPayload    → store by commentId; trust the verdict; lock-guard   [RULE — server]
```

**Classification = extension AI (last resort after 4 rule gates). Pricing = extension
rule first, server AI as fallback. The server never re-classifies.**

---

## Debug viewer — ONE STORE, TWO VIEWS (0.3.10.94+)

Contract: `.gsd-t/contracts/one-store-contract.md`. There is ONE scanner and ONE store
(the capture `ViewStore`, mirrored to IndexedDB, persistent until Clear). Both views read it:

```text
SCANNER → ViewStore (persistent)
              ├──► USER VIEW  → order grid, hides input=no, seller-filtered (smart)
              └──► DEBUG VIEW → renders store.listCaptureRows() VERBATIM (dumb; no scan)
```

- Debug performs NO DOM scan and NO filtering — it cannot drift from the User View
  (a lie-detector test asserts Debug rows === store rows).
- Debug PERSISTS across FB navigation + panel close (it reads the durable store).
- Debug shows per row: message · buyer · buyerId · commentId · postId · sellerId · status.
- A FOREIGN row (a different seller / non-group post that leaked in from the home feed via
  the "Open" popup-over-feed) renders RED + a "⚠ N non-seller" counter in the header.
  It is NOT dropped — only flagged (David: highlight, don't restrict the scan).

## Known gaps / status (as of 0.3.10.99)

- **In-scope seller stamp SHIPPED (0.3.10.99) — supersedes the 0.3.10.97 backfill.** Every
  captured comment now carries Marla's KNOWN id, because being captured already PROVES it's
  her post (it survived the scope gate). `stampInScopeSeller` fills the id+name UNCONDITIONALLY
  — fixing the case the prior `backfillSellerIdentity` couldn't: when id AND name were both
  blank, its `isTrackedSellerPost` guard returned false → no stamp → the row stayed blank →
  egress quarantined it. The "author chip didn't render" case no longer matters.
- **48-vs-22 / 8-vs-26 web-app gap = the egress identity gate.** Egress QUARANTINES (never
  pushes) any record with an empty `commentId` / `commenterFbId` / `postId` / `postAuthorFbId`
  (the server requires them as FKs). The in-scope stamp closes the postAuthorFbId share for
  ALL captured rows; a blank `commenterFbId` (buyer) can still quarantine a row — surfaced via
  the Debug Buyer-ID column (∅ marker). NEXT: confirm the web-app count after this build.
- **Extension count ≠ DB count by design.** The extension panel counts *this session's
  captured comments* (incl. pending + locally-NA); the web app counts *persisted Order rows
  across all sessions*. They match on a clean first scroll; afterward the DB is the superset.

---

## Appendix — Raw pseudocode (no intention comments)

```text
# ════════════════════════════════════════════════════════════════════════════
# EXTENSION — content-script realm
# ════════════════════════════════════════════════════════════════════════════

EVERY 1 SECOND, and on every DOM mutation:
  rescanAll():
    blocks = enumerateCommentBlocks(document)

    # PASS 1 — resolve + cache each post's author
    for each <div dir="auto"> text leaf inside a [role="article"]:
        resolve host post (id + author)
        if author found AND not yet cached for this post:  cache (post → author)

    # PASS 2 — scope each comment
    for each candidate comment:
        author = its own resolved author OR the post-level cached author
        if author is KNOWN and is NOT the tracked seller:  DROP
        else: emit block{ article, text, host }

    for each emitted block:
      handleCommentBlock(block)


handleCommentBlock(block):
    if classifyAffordance(text) != null:  DISCARD
    if already captured (post | author | text):  RETURN
    mark captured
    handleComment(block) → publishComment(comment)


handleComment(comment):
    resolve post fields (postId, postAuthorFbId from the per-post cache / host)
    backfillSellerIdentity(DEFAULT_SELLER, postAuthorFbId, postAuthor)  # stamp Marla's known id
    publishComment(comment)

publishComment(comment):
    if post author is KNOWN and NOT the tracked seller:  DROP
    publish 'comment.captured'
        ├──► PANEL view-store       → row, status = 'pending'
        ├──► CAPTURE-PERSISTER (SW) → mirror to IndexedDB
        └──► CLASSIFIER (SW)        → verdict


# ════════════════════════════════════════════════════════════════════════════
# EXTENSION — service-worker realm  (RULE → RULE → AI)
# ════════════════════════════════════════════════════════════════════════════

CLASSIFIER  on 'comment.captured':
    if commentId already being classified:  SKIP

    # STEP 1 — NA pre-filter (RULE, no AI)
    naResult = naPrefilter(comment):
        if commenterFbId == postAuthorFbId AND text is NOT "N for/to <Name>":  → NA
        if text is pure emoji / pure @-tag / a membership badge:               → NA
    if naResult != null:
        publish verdict.ready(NA)
        return

    # STEP 1b — rules table (RULE, no AI; EMPTY in Phase 1)
    ruleResult = lookupRule(comment)
    if ruleResult != null:
        publish verdict.ready(ruleResult)
        return

    # STEP 2 — AI (Anthropic Haiku)            ★ AI CALL
    aiResult = classifyComment(comment.text)
        if no API key:  verdict = NEEDS_KEY  ; release dedup
        else:           verdict = buildVerdict(aiResult)   # Order / Vague / NA + line items
    on throw:  verdict = Vague ; release dedup

    publish verdict.ready(verdict)


# ════════════════════════════════════════════════════════════════════════════
# EXTENSION — egress  (push only after a verdict)
# ════════════════════════════════════════════════════════════════════════════

EGRESS  correlate 'comment.captured' + 'verdict.ready' by commentId:
    if no verdict yet for this commentId:  WAIT
    when comment AND verdict both present:
        build IngestPayload(comment + verdict + postMeta incl. EXTENSION price)
        if egress unconfigured (no endpoint / token):  DROP silently
        if a prior 401 latched, or offline:            QUEUE in IndexedDB, retry later
        else:                                          POST /ingest


# ════════════════════════════════════════════════════════════════════════════
# SERVER — POST /ingest  (verdict trusted; AI for price only)
# ════════════════════════════════════════════════════════════════════════════

persistPayload(IngestPayload):
    upsert Comment row   (key = commentId)
    upsert Order row     (key = commentId):
        status = map(verdict.status)
        if locked OR comment unchanged:  no-op
        else: rebuild LineItems from the verdict

    if payload carries an EXTENSION price (deterministic rule):
        applyExtensionPrice()                         # no AI
        ripple price to other non-overridden orders on the post
    else:
        scheduleAutoParse(postId):                    # ★ SERVER AI CALL (price only)
            if no server API key (dormant):        SKIP
            if post already priced (parsedAt set): SKIP
            if post body is TRUNCATED:             SKIP
            else:  call Haiku → parse unit price → apply + broadcast order.updated
```
