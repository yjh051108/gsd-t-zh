# Contract: Auto-Research Gate + Web-Research Stage (M89)

## Version: 1.3.3
## Status: STABLE
## Owner: m89-d2-research-stage-and-contract
## Consumers: m89-d1-research-classifier-core, m89-d3-wiring-upper-phase-and-gate, m89-d4-wiring-worker-workflows
## Created: 2026-06-18 (M89 partition)

## Changelog
- **v1.3.3 (2026-06-20 — M89 FINAL classifier rule: remove ALL "wins outright → internal" overrides, PATCH):**
  the silent-miss class is STRUCTURAL — over 7 verify cycles, every "X is decisively internal" override
  re-opened it, because a single claim can carry BOTH a real repo path AND a real external-API subject at
  once ("wire the Stripe OAuth refresh into `gsd-t-execute.workflow.js`"). The v1.3.2 "concrete path beats
  strong-external" rule did it again (cycle 6): such a claim routed internal/grep and the external subject
  was never researched. **There is NO string-fact that is exclusively internal — not even a path.** So ALL
  override rules are removed.
  - **§1.1 final decision rule (replaces the 4-step priority):** `internal` is returned ONLY when there is
    ZERO strong-external signal. **If `hasStrongExternal` (an unambiguous vendor proper-noun + API/protocol
    term), the result is NEVER `internal`** — a co-occurring path/anchor → `ambiguous` (→ judge →
    uncertain→research); nothing else → `external`. Else (no strong external): a concrete path or this-repo
    anchor → `internal`; else → `ambiguous`. The mechanical classifier never overrides an external signal
    with anything — that removes the entire silent-miss class by construction (no override rule exists to
    exploit). The cost is more ambiguous→judge calls — the safe direction.
  - **Corpus:** added held-out rows pairing a repo PATH with a strong external vendor → ambiguous (HO-E10
    "wire the Stripe OAuth refresh into gsd-t-execute.workflow.js"; HO-E11 "update bin/handler.js to call
    the Stripe API webhook endpoint"); re-labeled HO-I8 (path + Stripe) internal→ambiguous. The Red Team
    noted NO prior fixture paired a path with an external vendor — why cycle 6 shipped uncaught.
  - **Anchor lists COLLAPSED** to one flat `INTERNAL_ANCHORS` (the DECISIVE/BROAD split is behaviorally
    dead — neither overrides a strong external signal). Stale `DECISIVE_INTERNAL_ANCHORS` docstring removed.
  - **LOW (homograph/URL false-external):** `hasStrongExternal` requires a genuine vendor proper-noun
    (multi-char, homograph-free list) AND an API term — a bare homograph or a bare URL-looking token can
    NEVER make a claim strong-external on its own. (Already structurally true: the vendor noun is the gate;
    documented + asserted, no list change needed.)
  - **nits:** phase §5.1 grep-empty escalation now CALLS `doExternal()` (dedup, matching
    execute/quick/debug — keeps the `key:` trailer + fallback artifact in sync); phase classify invocation
    passes `--json` for parity with the worker workflows.
- **v1.3.2 (2026-06-20 — M89 re-verify: the silent-miss class re-emerged via DECISIVE anchors, PATCH):**
  the v1.3.1 fail-closed fix worked, but the silent-miss class re-emerged through a path the v1.3.1
  conflict rule didn't cover — DECISIVE anchors. `classify()` tested `DECISIVE_INTERNAL_ANCHORS` FIRST and
  returned `internal` BEFORE testing the strong-external signal, so a generic English phrase that happens
  to be a "decisive" anchor ("exit code" / "who owns" / "this file") won outright even when the sentence's
  real subject was an external vendor: *"What exit code does the Stripe API return on rate limit?"* →
  `internal` (WRONG — never researched). The §5.1 grep backstop is unreliable (the haiku grep-resolver can
  return found=true on shared repo vocabulary like "exit code" / "rate limit" / "webhook").
  - **CLASS-CLOSING FIX — §1.1 decision priority rewritten to a strict 4-step rule** (see §1.1): the ONLY
    truly-internal STRING-FACT is a CONCRETE REPO PATH (a path is unambiguous — it cannot also be an
    external claim). An ANCHOR PHRASE (decisive OR broad) may NEVER override a strong external signal:
    strong-external + ANY anchor → `ambiguous` (→ judge → uncertain→research); only a concrete path beats
    a strong external signal. A generic English phrase can NEVER again route an external-vendor claim
    internal — fixed at the rule level, not per instance.
  - **Corpus:** added held-out rows pairing a DECISIVE anchor with an external vendor (HO-E8 "exit code" +
    Stripe API → ambiguous; HO-E9 "who owns" + Auth0 OAuth → ambiguous; HO-I8 concrete path + Stripe →
    internal), and re-labeled seen S2M5-F6 (this-repo DB fields VS the PayPal API return — a genuine
    two-subject conflict) internal→ambiguous. The Red Team noted EVERY prior "exit code"/"who owns" fixture
    used an internal subject, which is why this shipped uncaught.
  - Also: §4.1 idempotency now reads the path actually WRITTEN (`externalArtifact` = real OR fallback) so a
    re-run does not re-research a claim already cited in the fallback artifact (MEDIUM — wasted Fable, not
    a correctness break). The §5.1 grep-empty escalation now CALLS `doExternal()` instead of duplicating
    the marker/research/cite path (keeps the `key:` trailer in sync). Doc-drift: `commands/gsd-t-help.md`
    + `templates/CLAUDE-global.md` updated to the 3-class / 3-route / LLM-judge / uncertain→research model.
- **v1.3.1 (2026-06-20 — M89 re-verify after the 3-result refactor: 1 Red Team HIGH + 1 MEDIUM, PATCH):**
- **v1.3.1 (2026-06-20 — M89 re-verify after the 3-result refactor: 1 Red Team HIGH + 1 MEDIUM, PATCH):**
  the regex-as-semantic-judge class is gone (the refactor worked — no classifier-misjudge finding). The
  re-verify Red Team found NEW, distinct issues:
  - **HIGH — A4/SC4 was FAIL-SILENT, now FAIL-CLOSED.** Every marker/research write was guarded by
    `if (artifactPath)` / `if (!artifactPath) return`, and `artifactPath` is agent-SELF-REPORTED +
    OPTIONAL. A stage emitting a load-bearing GUESSED EXTERNAL (or ambiguous→escalated-external) claim
    but reporting NO artifact path → no uncited marker written anywhere → the §7 ENFORCE gate found zero
    markers → `pass=true` → the external guess shipped uncited+unresearched (the exact invariant M89
    enforces, silently bypassed). FIX (all 4 workflows): the external/escalation path now writes its §7
    marker + research/cite to a **DETERMINISTIC FALLBACK ARTIFACT** — `.gsd-t/research/<phase-or-domain>-
    <claim-slug>.md` (claim-keyed, `mkdir -p` first) — whenever no real artifact was reported, so the
    marker is ALWAYS written and the §7 gate ALWAYS has something to fail on. The silent
    `if (artifactPath)` early-outs are removed from the external/ambiguous-external path (internal/grep
    still no-ops safely). A test asserts an external claim with NO artifactPath still produces an uncited
    marker in the fallback artifact and the §7 gate FAILs on it pre-research.
  - **MEDIUM — classifier internal-anchor vs vendor+API conflict.** A bare/broad anchor ("our" / "the
    repo" / "the existing") used to win `internal` BEFORE the vendor+API external signal was tested, so
    *"Our users authenticate via the Auth0 OAuth endpoint…"* mis-classified internal. FIX: the anchor set
    is split into **DECISIVE** ("this repo" / "this repo's" / "our internal" / "exit code" / "which X
    owns" / "in this project" / …) which still win outright, and **BROAD** ("our" / "the repo" / "the
    existing" / "our module/file/existing") which yield to a STRONG external signal: a broad anchor +
    (vendor proper-noun + API term) is a CONFLICT → `ambiguous` (→ LLM judge → uncertain→research), never
    silently internal. A broad anchor with NO strong external signal still classifies internal.
  - Also fixed: the execute §5.1 escalation research prompt now emits the `key: ${claimKey}` trailer
    (parity with the primary path) — closes the code-review-important hollow-cited risk in mixed
    keyed/un-keyed artifacts; quick + debug emit it in BOTH paths too. Deleted the dead/stale
    `CLASSIFY_RESULT_SCHEMA` in `gsd-t-phase.workflow.js` (its enum omitted ambiguous/judge).
- **v1.3.0 (2026-06-20 — M89 PREMISE CORRECTION #3, MINOR — the classify interface is now 3-result):**
  the 4-verify-cycle Red Team thrash on the classifier had ONE root cause: the classifier was built as
  ~745 LOC of hand-fit regexes that tried to SEMANTICALLY decide "is this an external claim?" A regex
- **v1.3.0 (2026-06-20 — M89 PREMISE CORRECTION #3, MINOR — the classify interface is now 3-result):**
  the 4-verify-cycle Red Team thrash on the classifier had ONE root cause: the classifier was built as
  ~745 LOC of hand-fit regexes that tried to SEMANTICALLY decide "is this an external claim?" A regex
  that asserts "I BELIEVE this paraphrase means external" is **itself a GUESS** — the exact sin M89
  exists to prevent — so each cycle a new paraphrase of the same semantic class slipped past the
  patterns and the Red Team re-broke it (external-assertion patterns → homograph lists → camelCase-shape
  overrides → …, never converging). The fix applies **the milestone's own doctrine to its own
  classifier**: never act on belief; if a claim is not grounded in a definitive STRING FACT or research
  evidence, do not guess — defer to the LLM, and if the LLM is not sure, RESEARCH.
  - **§1 / §1.1 rewritten to a 3-RESULT MECHANICAL STRING-FACT FILTER + LLM judge + uncertain→research.**
    `bin/gsd-t-research-gate.cjs` now returns `class: "internal" | "external" | "ambiguous"` (route
    `grep | web | judge`). The regex does ONLY minimal mechanical string-fact filtering — it is a
    MECHANICAL FILTER, **NOT a semantic oracle**. `internal` fires ONLY on a STRING-FACT this-repo signal
    (concrete repo path/file/tool shape OR an explicit this-repo anchor phrase); `external` fires ONLY on
    an UNAMBIGUOUS vendor proper-noun (long, multi-char, non-homograph) co-occurring with an API/protocol
    term; **everything else is `ambiguous`** — semantic placement that requires JUDGMENT is the LLM's
    call, not regex's.
  - **The `ambiguous` residue routes to an LLM JUDGE (the wiring, model:"fable") → uncertain → research.**
    The 4 consuming workflows (`gsd-t-{phase,execute,quick,debug}`) route an `ambiguous` classification to
    a small `classify-judge` `agent()` stage applying the internal/external test in natural language.
    internal → grep; external → research+cite; **NOT confident → treat as external → research+cite**
    (uncertain = verify, NEVER guess-internal — a silent miss is the one unacceptable outcome). The
    classifier never guesses a default; it DEFERS, and the LLM decides, and on doubt the claim is
    researched.
  - **The "proper-noun-LESS external assertion pattern" regex obligation is REMOVED** (it was the
    archetypal regex-as-semantic-judge: a hand-fit pattern that BELIEVED a vendor-name-less paraphrase
    asserted an external system). Such a claim now correctly returns `ambiguous` and reaches the LLM judge
    — which judges it external (or, on doubt, researches it). The silent-miss this once guarded against is
    instead prevented STRUCTURALLY: `ambiguous` NEVER routes silently-internal.
  - **§1.3 / §5 / §6.5 / §7 unchanged in substance.** DETECT (§6.5) still LLM-prompts the Stated-Claims
    tags; the three guess-types (§1.3) are unchanged; ENFORCE (§5/§7) still gates on the `auto-research-
    claim` marker. CLASSIFY is still DETERMINISTIC for the two STRING-FACT classes; the new `ambiguous`
    class is deterministic in the classifier (a string-fact calculator) and resolved by the LLM judge in
    the wiring (the judgment was never regex's to make).
  - **Two Red Team MEDIUMs closed in the same pass.** (1) the internal grep-resolver prompt
    (`grepForClaim`, haiku) is hardened: `found=true` ONLY if the repo content CONFIRMS the specific claim
    (not mere shared vocabulary); a claim about an EXTERNAL system's behavior → grep cannot confirm →
    `found=false` → escalate to research. (2) §3 fact lines gain an OPTIONAL `key: <normalized-claim-key>`
    trailer and the §7 verify gate now matches cited markers to backing facts BY CLAIM-KEY when keys are
    present (count check is the fallback when no per-entry keys exist) — so one fact can no longer cover a
    DISTINCT claim by mere line count.
  - **Held-out + seen corpora re-labeled** for the 3-result design (items the deleted guessing-regexes
    used to force external/internal — HO-E4 proper-noun-less, react/useState, stripe/createCharge, CSS
    :has, square/edge homographs, bare camelCase symbols — now correctly `ambiguous`). A wiring test
    asserts an ambiguous item is RESEARCHED (via the judge), never silently internal.
- **v1.2.2 (2026-06-19 — M89 verify cycle-3, 1 Red Team HIGH + 2 code-review important + 1 nit):**
  hardens §1.1 with an explicit **CONFLICT-RESOLUTION RULE** for the classifier. A text
  classifier cannot tell external `createCharge` (Stripe) from internal `resolveProfile`
  (this repo) by SHAPE alone, so when signals CONFLICT the SAFE default is
  **FAIL-TOWARD-EXTERNAL** (research), never internal (a silent miss defeats the milestone;
  over-research is bounded cost). Three classifier fixes, no envelope-shape change:
  - **finding #1 (Red Team HIGH):** interrogative phrasings ("how does"/"what does"/"what
    is"/"which"/"when"/"where" + "which module/handler/function/contract/test/workflow") were
    REMOVED from the internal-anchor set. Question words are NEUTRAL — the natural way to phrase
    an EXTERNAL research question — and must NOT pull internal. "How does Stripe construct the
    webhook signature?" → external; genuine anchors ("our"/"this repo"/"exit code"/"which X
    owns") still → internal.
  - **finding #2 (code-review important):** a bare camelCase/kebab LOCAL-SYMBOL shape may NOT
    override a co-occurring external proper noun (shape-identical). Only a PATH-shaped internal
    signal (a repo path / `*.workflow.js` / `bin/*` / `gsd-t-*`) or an explicit anchor overrides
    a proper noun. A bare symbol pulls internal ONLY when NO external proper-noun/browser term
    co-occurs. "react useState …" / "the stripe createCharge … returns chargeId" → external;
    bare "resolveProfile …" (no external) → internal by shape (HO-I4 unchanged).
  - **finding #3 (code-review important) + nit:** single-word English HOMOGRAPHS
    ("square"/"go"/"rust"/"swift"/"java"/"edge"/"ie"/"amazon") moved to WEAK proper nouns —
    external only when another strong external signal co-occurs (or in possessive company form,
    "Square's …"). "we square the input value" / "bails at the edge case" → internal. Bare
    "bearer" demoted to weak (requires "bearer token").
  - Held-out corpus grown to **14 items (7 external / 7 internal)** adding the previously-
    uncovered classes (interrogative external, react/stripe camelCase external, square/edge
    homograph internal). Determinism + CLASSIFY/ENFORCE invariants unchanged.
- **v1.2.1 (2026-06-18 — M89 verify cycle-2 HONESTY CORRECTION, MEDIUM):** the v1.2.0
  §6.5 final bullet + §1.3 type-3 claimed a DETERMINISTIC code path that forces an
  external/time-varying claim to GUESSED:stale "by the wiring" ("the one place code, not
  the prompt, can force a guess"). No such code exists in any of the 4 workflows —
  staleness is detected ONLY by the LLM-prompted Stated-Claims tag `[GUESSED:stale]` (the
  snippet), same as the rest of DETECT. Reworded §6.5 + §1.3 so staleness is HONESTLY
  prompt-driven best-effort, consistent with DETECT being LLM-prompted; removed the
  "code, not the prompt, can force a guess" overclaim. (Same overclaim CLASS as the
  premise overclaim that got M89 re-scoped — caught here by the verify Red Team.) No
  code change; CLASSIFY (§1) + ENFORCE (§5/§7) determinism is unchanged.
- **v1.2.0 (2026-06-18 — M89 PREMISE CORRECTION after plan pre-mortem cycle-2 / 2 CRITICALs):** the
  original framing ("a deterministic trigger that DETECTS a gap and REPLACES the LLM should-I-research
  discretion") overclaimed — **detecting that you need info is itself an LLM judgment**. Re-scoped: M89
  is **deterministic CLASSIFY + cite-or-fail ENFORCE wrapped around an LLM-PROMPTED DETECT step**.
  Determinism lives in CLASSIFY (§1) + ENFORCE (§5/§7), NOT in DETECT (§6.5).
  - **§1 (input is a GUESSED CLAIM, not "a gap"):** the classifier's input is a claim the agent tagged
    GUESSED. **Added: a proper-noun-LESS claim that ASSERTS an external system's behavior / return-shape /
    limit WITHOUT a cited source routes EXTERNAL** (it's an unverified external assertion) — dissolves
    cycle-2 finding #3 (the silent-miss where a vendor-name-less external guess defaulted internal).
  - **NEW §1.3 — the three guess-types (unknown / assumed / stale):** ANY of the three triggers
    research/verification; staleness DEFAULTS to fail-toward-verify for an external/time-varying fact
    lacking a fresh cited source (do NOT trust the agent's self-staleness-assessment).
  - **NEW §6.5 — the DETECT seam (Stated Claims, LLM-prompted):** each eligible stage prompt REQUIRES a
    structured **Stated Claims** list tagging load-bearing claims KNOWN | GUESSED(type); the wiring
    iterates it through the classifier. Honest best-effort — an untagged claim is an acknowledged miss,
    NOT a silent pass for a tagged one.
  - **NEW §7 — the ENFORCE marker:** at classify time an external guessed claim writes a machine-readable
    marker into the artifact (`<!-- auto-research-claim: class=external key=<claim-key> status=uncited -->`)
    so the verify gate FAILs on an uncited external claim even if nothing else was written; flips to
    `status=cited` when the Verified-Facts block lands. Defines the marker format + normalized-claim-key
    (reused as the §4.1 idempotency exact-match key).
  - **§3:** Verified-Facts fact lines now carry a fetch **DATE** (already in the block grammar) —
    promoted to load-bearing for staleness (§1.3).
- **v1.1.0 (2026-06-18 — M89 plan-phase pre-mortem fixes):** closes 4 plan findings.
  - **§1.1 (finding #1, CRITICAL):** classification is by **FEATURE CLASS** (external-signal vs.
    internal-signal sets), NOT by corpus-keyword matching. Defines the deterministic signal-class
    heuristic precisely; A1 now also feeds a HELD-OUT corpus (≥6 novel gaps) so a classifier that
    memorized the seen 13 FAILS — kills the self-fulfilling-oracle trap.
  - **§4.1 (finding #2, HIGH):** "covers" is defined as **exact normalized-gap-key match** (NOT
    substring/keyword/fuzzy), with the PayPal-OAuth-vs-invoice-TOTAL negative example — a cited gap A
    must NOT skip a distinct gap B that merely shares keywords.
  - **§5.1 (finding #3, HIGH):** the **ambiguous → internal-first → grep → escalate-to-external**
    capability is owned + functionally tested by the WIRING domains (D3/D4), not deferred and not
    orphaned. An ambiguous gap grep cannot resolve DOES trigger research + a cited block.
  - **§5/A3 (finding #5, MEDIUM):** A3 reconciled to the **routing-decision** wording (the sandbox has
    no per-stage `tools:` allowlist) and structurally enforced — the research stage is the SOLE
    web-tool-granting `agent()`, so internal class never searches.
- **v1.0.0 (2026-06-18 — M89 partition):** initial seam (§1 envelope, §2 stage interface incl. the
  bare-`fable` model correction, §3 cite format, §4 idempotency, §5 no-silent-guess, §6 corpus oracle).

---

## Purpose

M89 makes "verify the GUESS instead of asserting it" a **deterministic-where-it-can-be, auditable**
discipline replacing the advisory `Research Policy` prose in `CLAUDE-global.md`. The unit of work is
**a load-bearing CLAIM**, not "a gap": for each claim the agent tags KNOWN vs GUESSED (§6.5, the
LLM-prompted DETECT step); a GUESSED claim is CLASSIFIED internal-vs-external (§1, deterministic);
external → a web-research stage writes a **cited Verified-Facts block** (§3) into the artifact and a
classify-time **marker** (§7) records the claim; the verify gate FAILs if a load-bearing external
claim stays uncited (§5/§7 — ENFORCE). No silent guessing.

**Honest scope (the cycle-2 premise correction):** detecting that you need info is itself a judgment,
so DETECT (§6.5) is an LLM-prompted obligation (best-effort, like keep-or-supersede), NOT a deterministic
trigger. **Determinism lives in CLASSIFY (§1) and ENFORCE (§5/§7)** — the two steps that can be code.
A guess is a claim ON THE PAGE, so it is inspectable; an absent (un-stated) gap is an acknowledged
best-effort miss, not a silent pass.

This contract is the **partition-time seam**: it pins (1) the classifier JSON-envelope shape, (2) the
research agent() stage interface, (3) the Verified-Facts cited-block format, (4) the idempotency rule,
(5) the no-silent-guess gate semantics, (6.5) the DETECT Stated-Claims prompt seam, and (7) the
ENFORCE marker. D1 PRODUCES the classifier matching the envelope below; D3/D4 CONSUME the envelope
SHAPE + stage interface + marker format, never D1's internals.

---

## 1. Classifier JSON Envelope (the seam D1 produces, D3/D4 consume)

`bin/gsd-t-research-gate.cjs` emits the house-style JSON envelope. **Input is a GUESSED CLAIM** (free
text — a claim the agent tagged GUESSED in its Stated-Claims list, §6.5), NOT "a gap." It returns:

```json
{
  "ok": true,
  "gap": "<the guessed claim text, NAMED — auditable, never silent>",
  "class": "internal" | "external" | "ambiguous",
  "route": "grep" | "web" | "judge",
  "reason": "<one-line deterministic rationale>"
}
```

The `gap` field name is retained for envelope-shape stability (D1/D3/D4 already build against it); it
carries the GUESSED-CLAIM text. (A rename would be a breaking shape change for no behavioral gain.)

### 1.1 The classifier is a MECHANICAL STRING-FACT FILTER (3-result), NOT a semantic oracle (v1.3.0)

The regex classifier may do ONLY minimal **mechanical / string-fact filtering**. The **semantic judgment
goes to the LLM**, and **if the LLM isn't sure, the claim is RESEARCHED** (never a guessed default). This
is the milestone's own doctrine applied to its own classifier: never act on belief; a claim not grounded
in a definitive string fact or research evidence is not regex's to place.

**Why (the 4-cycle Red Team root cause).** The prior classifier was ~745 LOC of hand-fit regexes that
tried to SEMANTICALLY decide "is this external?" (external-assertion patterns, homograph gating,
camelCase-shape overrides). A regex that asserts *"I believe this paraphrase means external"* is **itself
a guess** — the exact sin M89 exists to prevent — so every verify cycle a new paraphrase of the same
semantic class slipped past, and the Red Team re-broke it without converging. The cure is to stop the
regex from guessing.

The classifier returns one of **THREE** results:

- **`internal` (route `grep`)** — ONLY on a STRING-FACT internal signal: the claim references a concrete
  repo path / file shape (e.g. `bin/`, `templates/`, `*.workflow.js`, `*.cjs`, a real `gsd-t-*` tool
  name) OR an explicit repo **anchor phrase** ("this repo" / "this repo's" / "our repo" / "our
  codebase" / "our module" / bare "our" / "our internal" / "exit code" / "which X owns"). These are
  string facts about THIS repo, not beliefs.
- **`external` (route `web`)** — ONLY on an UNAMBIGUOUS string-fact external signal: a recognized
  vendor / product **proper noun** (the LONG, multi-char, non-homograph names — paypal, stripe, mongodb,
  cloudflare, chrome, react, …) **co-occurring with an API / HTTP / protocol term** (api, endpoint,
  webhook, oauth, rest api, rate limit, `/v1/`, …). The vendor list is kept SHORT and unambiguous: when
  in doubt, a token is left OUT (it falls through to `ambiguous`, which is safe). A proper noun ALONE,
  or an API term alone, is NOT enough.
- **`ambiguous` (route `judge`)** — EVERYTHING ELSE. If placing a claim requires *judgment* rather than
  a string fact, it is **not regex's call**. This includes: a proper-noun-LESS external assertion
  (*"the payments endpoint accepts a max batch size of 100"*); a vendor proper noun WITHOUT an
  API-term co-signal (*"react useState returns a stateful value"*); a bare camelCase/kebab symbol
  (shape-identical to an external symbol, so not a string fact); single-word homographs that are also
  vendor names ("square"/"go"/"edge"); a generic "contract file"/"browser popup blocker" phrasing.

**FINAL decision rule (v1.3.3 — the structural resolution of the 7-cycle silent-miss class).** There is
**NO string-fact that is exclusively internal — not even a path.** A single claim can carry BOTH a real
repo path AND a real external-API subject at once (*"wire the Stripe OAuth refresh into
`gsd-t-execute.workflow.js`"*), so every "X wins outright → internal" override re-opens the silent miss.
The rule therefore removes ALL overrides: **`internal` is returned ONLY when there is ZERO strong-external
signal.** Define `hasStrongExternal` = an unambiguous vendor proper-noun (multi-char, homograph-free) AND
an API/protocol term. Then:

- **`hasStrongExternal` → the result is NEVER `internal`.** A co-occurring path/anchor → `ambiguous`
  (→ judge → uncertain→research); nothing else → `external`.
  - `hasStrongExternal` + (any path OR anchor) → `ambiguous`
  - `hasStrongExternal` + nothing else → `external`
- **else (NO strong external signal at all):**
  - a concrete repo path OR a this-repo anchor → `internal`
  - else → `ambiguous`

Net effect: **the mechanical classifier NEVER overrides an external signal — not with a path, not with
"this repo", not with anything.** `internal` requires ZERO strong-external signal. This removes the entire
silent-miss class by construction (there is no override rule left to exploit). The cost is more
ambiguous→judge calls — the safe direction (the judge researches when unsure; it never silently guesses
internal). `hasStrongExternal` requires a genuine vendor proper-noun AND an API term, so a bare homograph
or a bare URL-looking token can never make a benign internal claim strong-external (LOW closed).

**The `ambiguous` residue → LLM judge → uncertain → research (owned by the WIRING — §5.1 / D3+D4).**
The classifier is a pure calculator; it does NOT make the semantic call. The 4 consuming workflows route
an `ambiguous` classification to a small LLM `classify-judge` `agent()` stage (`model: "fable"` — the
research tier) that applies the internal/external test in natural language and returns one of
`internal` / `external` / `uncertain`:

- judge `internal` → grep/Read (and §5.1 escalate to research if grep finds nothing);
- judge `external` → research + cite;
- judge **`uncertain` → treat as external → research + cite** (uncertain = verify, **NEVER**
  guess-internal — a silent miss is the one unacceptable outcome).

This is the doctrine made structural: the regex never guesses a default; when it isn't a string fact the
LLM decides; when the LLM isn't sure, the claim is researched. The proper-noun-LESS external-assertion
"silent miss" the old regex guarded against is now prevented by construction — `ambiguous` NEVER routes
silently-internal.

**Anti-self-fulfilling-oracle (unchanged intent).** The A1 oracle still proves the classifier does not
memorize corpus keywords: the held-out corpus (`test/fixtures/m89-heldout-corpus.json`) carries NOVEL
claims, and items the deleted guessing-regexes used to force external/internal (HO-E4 proper-noun-less,
react/useState, stripe/createCharge, CSS `:has`, square/edge homographs, bare camelCase symbols) now
correctly return `ambiguous`. A wiring test asserts an ambiguous item is RESEARCHED via the judge, never
silently internal.

### 1.2 Class → route mapping

- `class: external` + `route: web` — an UNAMBIGUOUS vendor proper-noun + API/protocol STRING FACT
  (third-party API contract / endpoint / rate-limit / auth flow). The research stage cites it.
- `class: internal` + `route: grep` (NEVER web) — a STRING-FACT this-repo signal (repo path / file /
  tool shape, or an explicit this-repo anchor). Concerns this repo's own code/contracts/schema/tests.
- `class: ambiguous` + `route: judge` — no decisive string fact. The wiring runs the LLM judge; the
  judge's `internal`/`external`/`uncertain` verdict drives grep vs. research (uncertain → research).
- The envelope ALWAYS names the gap text (`gap` field) — classification is auditable, never silent.
- On bad input → `{ "ok": false, "error": "<reason>" }` (house-style error envelope). **Bad input
  includes empty string, whitespace-only, and non-string** — these return `{ok:false,error}` (NOT a
  silent class) and a non-zero CLI exit.

The classifier is **deterministic**: identical claim text → identical envelope. No LLM call inside the
classifier itself (it is a string-fact calculator, not a critic — mirrors the competition-judge
convention). The LLM judgment lives in the WIRING (the `ambiguous` path), not in the classifier.

### 1.3 The three GUESS-TYPES (premise correction — any of the three triggers verification)

A claim is GUESSED (not KNOWN) when it falls into ANY of three types. The DETECT step (§6.5) tags the
type; CLASSIFY (§1) + ENFORCE (§7) then handle an EXTERNAL guess. All three are equally load-bearing —
"plausible" and "was true" are NOT "known":

1. **Unknown** — the agent lacks the fact outright.
2. **Assumed** — the agent ASSERTS a shape / value / behavior it never verified (e.g. *"the create call
   returns a `url`"* because it would make sense). **Plausible ≠ confirmed.** This is the binvoice
   S2-M5 failure mode (confident guesses stated as known).
3. **Stale** — the agent KNEW it, but it is an external/time-varying fact with age (an API last seen
   months ago, a price, a model ID, a library signature). **Was-true ≠ is-true.** The agent is
   instructed (via the Stated-Claims snippet, §6.5) to TAG such a fact `[GUESSED:stale]` — treat
   external/time-varying load-bearing facts without a FRESH cited source (§3 carries a fetch DATE) as
   stale → research, rather than trusting its own confidence. **This is a prompt-driven best-effort
   obligation, NOT a deterministic code check** (v1.2.1 honesty correction): the wiring does not run a
   freshness scanner, so an UN-tagged stale fact is an acknowledged DETECT miss — the same best-effort
   limit as the other two guess-types.

The classifier does not distinguish the three types in its envelope (it classifies internal-vs-external
on the claim text); the type is the DETECT-step tag that decided the claim was GUESSED at all. Staleness,
like unknown/assumed, is detected by the LLM-prompted Stated-Claims tag — there is no separate
deterministic staleness code path. Determinism lives in CLASSIFY (§1) + ENFORCE (§5/§7), which apply to
every TAGGED guessed claim regardless of type.

---

## 2. Research agent() Stage Interface (D2 spec; D3/D4 embed inline)

The orchestrator sandbox has NO `fs`/`require` (M81), so the research stage is embedded **inline** in
each consuming workflow as an `agent()` call. D2 defines the canonical shape so all six workflows wire
it identically; the prompt body lives at `templates/prompts/research-subagent.md` (Read at spawn time,
mirroring the triad-protocol convention).

- **Input:** one external gap (the classifier envelope's `gap` text).
- **Tool access:** `WebSearch` + `WebFetch` (the ONLY stages granted web tools).
- **Output:** a Verified-Facts block (§3) with source URLs. Schema-validated.
- **Model:** the research stage uses a **BARE literal `model: "fable"`** (Fable tier — the single
  highest-leverage web call per phase; mirrors the M85 rationale for the 5 highest-leverage stages).
  **It does NOT use the `overrides["research"] ?? "<literal>"` form.** Plan-hardening correction (M89
  plan phase): the `??`-override form's bracket key MUST be one of the 6 INJECTABLE designated stages
  (`solution-space-probe`, `partition-probe`, `competition-judge`, `pre-mortem`, `red-team`,
  `debug-cycle-2`) — `research` is not one, `bin/gsd-t-model-tier-policy.cjs` has no `research` key
  (an unknown stage resolves to a defensive `sonnet` WITH a configError, never fable), and the live
  M85 lint (`test/m85-workflow-tier-policy-lint.test.js`) FAILS any `overrides["research"] ?? …` line.
  Non-designated workflow stages already declare models with bare literals (e.g.
  `gsd-t-execute.workflow.js:172` `model: "sonnet"`). The bare `"fable"` literal passes the lint's
  tier-set membership check. _(This is a clarification of the intended form, not an envelope-shape
  change — landed in v1.0.0; §2 itself is unchanged at the v1.1.0 bump.)_

---

## 3. Verified-Facts Cited-Block Format (uncited fact FAILS — SC2)

Written into the phase artifact (the markdown the phase produces). Canonical block:

```markdown
## Verified Facts (auto-research)

- **<fact statement>** — source: <https://exact.url/path> (fetched YYYY-MM-DD) key: <normalized-claim-key>
- **<fact statement>** — source: <https://exact.url/path> (fetched YYYY-MM-DD) key: <normalized-claim-key>
```

- Every fact line MUST carry a `source: <url>` **AND a `(fetched YYYY-MM-DD)` date**. An **uncited fact
  FAILS** the gate (SC2/SC3); a fact with no fetch date FAILS too — the date is load-bearing for the
  staleness guess-type (§1.3): a fact's freshness can only be judged if its fetch date is recorded.
- Every fact line SHOULD ALSO carry an OPTIONAL **`key: <normalized-claim-key>`** trailer (v1.3.0 — Red
  Team MEDIUM #2): the §4.1/§7 normalized claim-key the fact answers (the SAME key as the `key=` value
  in the `auto-research-claim` marker). When present, the §7 verify gate matches a cited marker to its
  backing fact **by claim-key** (not merely by line count), so one fact can no longer cover a DISTINCT
  claim. When NO fact line carries a `key:`, the gate falls back to the per-file count check (cited
  markers ≤ sourced fact lines) — an acceptable interim that the per-key trailer strengthens.
- The block heading is exactly `## Verified Facts (auto-research)` (machine-detectable by the gate).
- The research subagent prompt (`templates/prompts/research-subagent.md`) MUST instruct the stage to
  emit the source URL + the fetch date on every fact line, and SHOULD emit the `key:` trailer.

---

## 4. Idempotency Rule (already-cited fact ⇒ no re-research — A2)

Before triggering research for an external gap, the wiring domain scans the phase artifact for an
existing Verified-Facts entry **covering** that gap. If a cited fact already covers it, the research
stage is SKIPPED (no re-research). Re-running a phase whose artifact already has the cited block
performs ZERO additional WebSearch calls.

### 4.1 "covers" is exact normalized-gap-key match — NOT fuzzy / substring / keyword overlap (finding #2)

"Covers" is defined precisely to avoid a fuzzy match wrongly skipping a DISTINCT gap. A Verified-Facts
entry **covers** a gap iff its recorded **gap-key equals** the gap-key of the new gap, where:

- **gap-key** (= the **normalized-claim-key** of §7 — one key, two uses) = a deterministic normalization
  of the claim statement: lowercase, collapse internal whitespace, strip surrounding punctuation/quotes.
  (NOT a substring test, NOT a token-overlap / keyword score, NOT a fuzzy/edit-distance match.) Identical
  normalized statements ⇒ same key ⇒ covered. The §7 marker `key=` and a Verified-Facts entry's recorded
  key are the SAME normalization, so the idempotency scan is an exact key lookup across both.
- Two gaps that merely share keywords are **DISTINCT** and BOTH route to research. Worked example
  (the load-bearing negative): a cited fact for **"PayPal OAuth `/v1/oauth2/token` mint"** (gap A) does
  NOT cover **"PayPal v2 invoice TOTAL amount limit"** (gap B) — different normalized statements ⇒
  different gap-keys ⇒ gap B still routes to research even though both contain "PayPal". A fuzzy
  "covers" that skipped gap B because gap A mentioned PayPal would be a defect.
- The Verified-Facts block records, per entry, the gap-key it answers (so the idempotency scan is an
  exact key lookup, not prose matching). The skip predicate returns `skip` ONLY on an exact gap-key
  hit; otherwise `research`.

---

## 5. No-Silent-Guess Gate Semantics (A3 + A4)

- **A3 — internal gap → research stage NOT entered.** An internal-classified gap routes to grep/Read
  only; the research `agent()` stage is NOT reached. **A3 is asserted on the ROUTING DECISION, not on a
  literal WebSearch-call count** (finding #5): the Workflow `agent()` sandbox exposes NO declarative
  per-stage `tools:` allowlist — tool access is harness/prompt-governed, so "zero WebSearch" is provable
  only as "the internal class routes to grep and the external-research branch condition is FALSE, so no
  research agent() is reached." The wiring tests assert this routing decision over the labeled internal
  corpus. **Structural enforcement:** the ONLY `agent()` stage whose PROMPT grants WebSearch/WebFetch is
  the research stage (§2) — there is no other web-capable stage — so "internal never searches" holds
  because the only path to a web tool is the research stage, and the internal class never enters it.
  D4's `m89-internal-gap-no-websearch.test.js` asserts BOTH the routing decision AND that the research
  stage is the sole web-tool-granting `agent()` (grep the workflow + prompt set: exactly one stage
  references WebSearch/WebFetch).
- **A4 — external guess proceeds uncited → verify FAILS.** A phase artifact carrying an
  `auto-research-claim: ... status=uncited` marker (§7) — an external guessed claim that proceeded
  without a matching Verified-Facts cited block — FAILS the `gsd-t-verify` gate. An artifact where every
  external-claim marker is `status=cited` (with a matching cited fact, same claim-key) PASSES. Wired by
  D3 into `gsd-t-verify.workflow.js`. **The marker (§7) is what makes A4 enforceable on a claim that was
  never written as a Verified-Facts entry** — without it, an unstated/uncited guess would slip (the
  cycle-2 finding: "A4 can't catch a never-stated gap").

### 5.1 Ambiguous → LLM judge → (internal:grep / external:research / uncertain:research) — owned + tested by D3/D4

When the classifier returns **`class:ambiguous`** (no decisive string fact — §1.1), the WIRING resolves
it. This is a FULL behavior, not a deferral; it is owned by D3 (upper phases) and D4 (worker phases) and
exercised by a functional test. The flow (v1.3.0):

1. Classifier returns `class:ambiguous` / `route:judge` (no string fact dominates — §1.1).
2. The wiring runs the LLM `classify-judge` `agent()` stage (`model: "fable"`), which returns one of
   `internal` / `external` / `uncertain` in natural language.
3. **judge `internal`** → grep/Read for the gap. If grep/Read CONFIRMS the specific claim → done, no web.
   If grep/Read returns nothing → RE-ROUTE to external → research `agent()` → cited `## Verified Facts
   (auto-research)` block (§3) (the §5.1 escalation, preserved).
4. **judge `external`** → research `agent()` → cited block.
5. **judge `uncertain`** → treat as external → research `agent()` → cited block. UNCERTAIN = VERIFY,
   never guess-internal — a silent miss is the one unacceptable outcome.

For a directly STRING-FACT-classified gap, `class:internal` still goes straight to grep (with the same
grep-empty → research escalation) and `class:external` straight to research — no judge needed. The judge
runs ONLY for the `ambiguous` residue.

Neither the judge nor the escalation is in the classifier (D1 stays a pure string-fact calculator). They
live in D3 (`gsd-t-phase`) and D4 (`gsd-t-execute`/`gsd-t-quick`/`gsd-t-debug`) and are asserted by a
functional test: an ambiguous gap the LLM cannot confidently place internal DOES trigger the research
stage and DOES produce a cited block (never silently internal).

---

## 6. Labeled Corpus (the A1 killing oracle — D1 owns)

The classifier's A1 test feeds a 13-item hand-labeled corpus and asserts every label matches
deterministically; a single mislabel FAILS, and the milestone HALTS for re-scope before any wiring.

| # | Source | Gap (abbrev) | Expected |
|---|--------|--------------|----------|
| 1-7 | M87 findings | repo-internal (own code/contracts/sandbox/tests) | all **internal** (0 external) |
| 8-13 | binvoice S2-M5 findings | mixed | **2-3 external** incl. PayPal OAuth `/v1/oauth2/token` mint + v2 invoice-TOTAL limit |

Corpus lives at `test/fixtures/m89-labeled-corpus.json` (D1-owned).

**Held-out generalization corpus (finding #1).** A1 ALSO feeds a SECOND fixture
`test/fixtures/m89-heldout-corpus.json` (D1-owned) — ≥6 NOVEL gaps NOT used to author the classifier
(3 external: Stripe webhook signature header; Chrome `storage.local` quota limit; CSS `:has()`
browser-support — 3 internal: `isOrderLocked` return; owner of `gsd-t-verify.workflow.js`;
`cli-preflight` exit code). The classifier must label the held-out set correctly by feature class.
**Passing the seen 13 but failing any held-out item is an EXPLICIT A1 FAILURE** (proves keyword
memorization, not generalization). None of the held-out proper nouns/symbols appears in the seen corpus.
The held-out set now has **8 items (4 external, 4 internal)** and MUST include the proper-noun-LESS
external claim (HO-E4) and the symbol-only internal claim (HO-I4) — the premise-correction generalization
guards.

---

## 6.5 The DETECT seam — Stated Claims (LLM-prompted, the honest best-effort step — SC2/A2)

DETECT is NOT deterministic (detecting you need info is a judgment). It is an LLM-prompted obligation,
mirroring the keep-or-supersede protocol: **each eligible stage's prompt REQUIRES the agent to emit a
structured `## Stated Claims` list** tagging every load-bearing claim it is relying on:

```markdown
## Stated Claims

- [KNOWN] <claim the agent has verified / is repo-internal-evident>
- [GUESSED:assumed] <claim asserting an unverified external shape/value>
- [GUESSED:unknown] <claim the agent lacks the fact for>
- [GUESSED:stale] <external/time-varying fact known-but-aged, no fresh source>
```

- The wiring (D3/D4) iterates the `[GUESSED:*]` entries through the classifier (§1); each external
  guess → research+cite (§3) + a marker (§7); each internal guess → grep/Read.
- **Honest best-effort, not magic:** a claim the agent FAILED to tag is an acknowledged miss (a limit
  of an LLM-prompted detector), NOT a silent pass for a claim it DID tag. The deterministic guarantees
  (CLASSIFY + ENFORCE) apply to every TAGGED guessed claim; DETECT coverage is the prompt's job.
- The reusable Stated-Claims prompt snippet is a D2 deliverable (D2-T2-adjacent), embedded by each
  eligible stage (Read at spawn time alongside the research-subagent protocol). D3 wires it into the
  upper phases (plan / pre-mortem / partition / discuss / milestone); D4 into the worker phases
  (execute / debug / quick).
- **Staleness (§1.3 type 3) is prompt-driven best-effort, like the other guess-types** (v1.2.1 honesty
  correction): the agent is instructed to TAG an external/time-varying fact lacking a fresh source as
  `[GUESSED:stale]`. There is NO deterministic staleness code path in the wiring (no freshness scanner) —
  an un-tagged stale fact is an acknowledged DETECT miss, not a silently-forced guess. Determinism is
  confined to CLASSIFY (§1) + ENFORCE (§5/§7), which run on every TAGGED guessed claim.

---

## 7. The ENFORCE marker — machine-readable external-claim record (SC4/A5)

So the verify gate has something to check even if the agent wrote nothing else, the wiring writes a
machine-readable marker into the artifact AT CLASSIFY TIME for each external guessed claim:

```html
<!-- auto-research-claim: class=external key=<normalized-claim-key> status=uncited -->
```

- **`<normalized-claim-key>`** = the deterministic normalization of the claim statement (lowercase,
  collapse internal whitespace, strip surrounding punctuation/quotes) — the SAME key used by §4.1
  idempotency exact-match. So a marker and a later Verified-Facts entry for the same claim share one key.
- **Lifecycle:** the marker is written `status=uncited` when an external guess is classified. When the
  research stage writes the matching `## Verified Facts (auto-research)` entry (same claim-key), the
  wiring FLIPS the marker to `status=cited`.
- **The ENFORCE gate (§5 A4, D3 in `gsd-t-verify.workflow.js`):** an artifact containing ANY
  `auto-research-claim: ... status=uncited` marker FAILs the verify gate (an external guess proceeded
  uncited — no silent guess). All external-claim markers `status=cited` (with a matching cited fact)
  PASSES. This is what makes A4/A5 enforceable: a guess that proceeds uncited is caught by the marker
  even if the agent wrote nothing further into the artifact.
- The marker is HTML-comment (invisible in rendered markdown, machine-grep-able by the gate).
- **FAIL-CLOSED fallback artifact (v1.3.1, Red Team HIGH).** The marker target (`artifactPath`) is
  agent-self-reported and OPTIONAL. The wiring MUST NOT silently skip the marker write when no path is
  reported — that would let an external guess ship uncited+unresearched (the gate would scan, find no
  markers, and pass). So when a stage has an external (or ambiguous→escalated-external) guessed claim but
  NO reported artifact path, the wiring writes the uncited marker + research/cite to a DETERMINISTIC
  FALLBACK ARTIFACT: `.gsd-t/research/<phase-or-domain>-<claim-slug>.md` (claim-keyed; `mkdir -p` first).
  The marker is therefore ALWAYS written somewhere the §7 gate scans, so the gate ALWAYS has something to
  fail on. (Internal/grep claims still no-op safely with no marker.)
- Idempotency (§4.1): re-running a phase whose marker is already `status=cited` (matching claim-key)
  performs ZERO additional research.

---

## File Ownership (disjoint)

| Surface | Owner |
|---------|-------|
| `bin/gsd-t-research-gate.cjs`, classifier test, `test/fixtures/m89-labeled-corpus.json`, `test/fixtures/m89-heldout-corpus.json` (8 items, incl. HO-E4 proper-noun-less external + HO-I4 symbol-only internal) | D1 |
| this contract, `templates/prompts/research-subagent.md` (facts carry URL + DATE), the reusable **Stated-Claims** prompt snippet (§6.5), cite-format test | D2 |
| doc-ripple (`templates/CLAUDE-global.md` Research Policy replacement + the SC6 conversation directive, `bin/gsd-t.js` dispatch case, `commands/gsd-t-help.md`, `docs/requirements.md` M89 entry) | D2 |
| `templates/workflows/gsd-t-phase.workflow.js` (Stated-Claims→classify wiring), `gsd-t-verify.workflow.js` (the §7 ENFORCE marker gate) + the **classify-time marker WRITE/flip** + the dogfood e2e test + wiring tests | D3 |
| `templates/workflows/gsd-t-{execute,debug,quick}.workflow.js` (Stated-Claims→classify wiring + marker write); `gsd-t-wave.workflow.js` gets NOTHING (composer, zero `model:`) + wiring tests | D4 |

D3 and D4 NEVER touch each other's workflow files (one-domain-per-workflow-file). D2 is the SINGLE
owner of every shared doc-ripple surface (CLAUDE-global.md, bin/gsd-t.js, commands/gsd-t-help.md) —
no co-author conflict possible.
