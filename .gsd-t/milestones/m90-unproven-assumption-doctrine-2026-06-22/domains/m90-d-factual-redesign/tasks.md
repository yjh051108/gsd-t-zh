# Domain Tasks: m90-d-factual-redesign (M90-D3)

> Shape D — `### Mxx-Dx-Tx`, each task carries `**Files**`, `**Touches**`, `**Test**`,
> `**Acceptance criteria**`, `**Dependencies**`, `**Contract**`. Validate at end of plan with
> `gsd-t parallel --dry-run` + `gsd-t traceability-gate --milestone M90`.
> **Domain code = D3** (parser-canonical `M90-D3-Tn`; partition's `DF` letter form renamed to
> satisfy the task-graph regex). Edit-in-place island — the EXISTING M89 module is on disk
> (`bin/gsd-t-research-gate.cjs:146` `EXTERNAL_VENDOR_NOUNS`, `:166` `EXTERNAL_API_TERMS`,
> `:209` `hasStrongExternal`, `:188` `classify`, `:304` `module.exports = { classify }`).

## Files Owned
- `bin/gsd-t-research-gate.cjs`
- `test/m89-research-classifier-corpus.test.js`
- `test/fixtures/m89-labeled-corpus.json`

## Contract
`.gsd-t/contracts/m90-doctrine-mechanisms-contract.md` §1 — the `classify(gap)` envelope is
the FROZEN seam D4 wires; the §7 fail-closed cite gate is PRESERVED. Absorbs
`auto-research-contract.md` v1.3.3 (D4 writes the absorbed pointer). Redesign sourced from:
SKR intrinsic self-knowledge gate (https://arxiv.org/abs/2310.05002), Self-RAG
(https://arxiv.org/abs/2310.11511), temporal-collapse → always-verify on fast-moving facts
(https://arxiv.org/html/2510.19172v1, CoVe https://arxiv.org/abs/2309.11495).

## Wave 2 — edit-in-place (GATED on Wave 1 prove-or-kill clearing; LOWEST RISK)

### M90-D3-T0 — Baseline known-answer test against CURRENT code (R-FACT-0, the doctrine in action) [Headline]
**Headline:** true
**The premise-grounding gate** (pre-mortem CRITICAL #1). BEFORE touching the classifier, write a
baseline known-answer test that runs the CURRENT `bin/gsd-t-research-gate.cjs` against ≥10
out-of-any-prior-list / never-seen external references (GitHub/Slack/OpenAI/Plaid/Twilio/a
freshly-invented vendor name) and CAPTURES the actual `class`/`route` for each. This grounds D3's
premise on disk: the partition claimed unseen vendors "silently route internal" — verified FALSE
(all route `ambiguous→judge`; the vendor list only upgrades to `external→web`, its absence never
routes internal; M89 already removed all wins-outright→internal overrides per auto-research-contract
v1.3.3). This task asserts that ground truth as a regression baseline, and DECIDES R-FACT-1: if NO
unseen vendor routes silently-internal today (expected), R-FACT-1 is a documented no-op/tightening,
NOT a deletion — D3 does not commit M90's forbidden act of building on a falsified premise.
- **Files**: `test/m89-research-classifier-corpus.test.js`, `bin/gsd-t-research-gate.cjs`
- **Touches**: `test/m89-research-classifier-corpus.test.js`
- **Test**: `test/m89-research-classifier-corpus.test.js` (node --test) — feeds ≥10 never-seen external refs to the CURRENT classifier and asserts NONE returns `class:"internal"` (each routes to `judge`/`web`); records the baseline. If any DOES route internal, that concrete input is captured as the real defect R-FACT-1 must fix. Run: `node --test test/m89-research-classifier-corpus.test.js`.
- **Acceptance criteria**: (SC-NO-FINITE-LIST baseline, premise-corrected)
  - A baseline test runs the CURRENT code against ≥10 unseen vendors (incl. a freshly-invented name) and asserts NONE routes silently-internal — establishing the on-disk ground truth.
  - The captured baseline routing is recorded as a regression anchor for T1/T5.
  - If a concrete unseen vendor IS found to misroute internal, it is captured as the falsifiable defect that justifies R-FACT-1's change; otherwise R-FACT-1 is recorded as a no-op/tightening.
- **Dependencies**: M90-D1-T6, M90-D2-T6 (Wave 1 GREEN gate). First task of this domain.

### M90-D3-T1 — Resolve the vendor list's ACTUAL role (R-FACT-1, premise-corrected)
Per the R-FACT-0 baseline (NOT the falsified silent-miss premise): the vendor list does not cause
a silent-miss — its absence never routes internal. Its real effect is *upgrading* a vendor+API
match to high-confidence `external→web`, skipping the judge. Resolve its role with the baseline as
the gate: (a) confirm `internal` is asserted ONLY on a concrete own-repo path/anchor (a CLOSED,
knowable set) — already true, assert it; (b) delete or TIGHTEN the vendor-upgrade machinery ONLY if
T0's baseline proved a concrete defect (a real unseen vendor that misroutes); if no defect, keep the
upgrade path and record the corrected rationale (deleting it would DOWNGRADE known vendors from
`web` to `ambiguous→judge` — a regression, not a fix). Grep ALL requirers first; never leave a
dangling ref.
- **Files**: `bin/gsd-t-research-gate.cjs`
- **Touches**: `bin/gsd-t-research-gate.cjs`
- **Test**: `test/m89-research-classifier-corpus.test.js` — assert the layer enumerates NO open category for the INTERNAL decision (`internal` requires a positive own-repo path/anchor — never the mere absence of a vendor); the T0 baseline routing is preserved or improved (no unseen vendor regresses to internal); any vendor-machinery change leaves no dangling ref.
- **Acceptance criteria**: (SC-NO-FINITE-LIST, premise-corrected)
  - The recognition layer enumerates NO open category for the `internal` decision — `internal` is asserted ONLY on a concrete own-repo path/anchor (asserted by test, against current + post-change code).
  - The vendor-upgrade machinery is changed ONLY if T0 proved a concrete defect; otherwise kept with the corrected rationale recorded (no deletion-on-false-premise). No dangling refs after any change.
  - The T0 baseline holds or improves — no unseen vendor regresses to silently-internal.
- **Dependencies**: M90-D3-T0.

### M90-D3-T2 — Closed-internal + judge routing (R-FACT-2)
Internal ONLY on the closed own-repo path/file set; everything not-confidently-internal →
`ambiguous` → judge → external/uncertain → research+cite. The mechanical layer recognizes only
the closed internal set; the open external world is the judge's call (the locked architecture:
mechanical-knows-closed-sets, LLM-judges-open-world). Keep the house-style envelope + bad-input
guard.
- **Files**: `bin/gsd-t-research-gate.cjs`
- **Touches**: `bin/gsd-t-research-gate.cjs`
- **Test**: `test/m89-research-classifier-corpus.test.js` — a concrete own-repo path → `class:"internal", route:"grep"`; a non-path external assertion → `class:"external"|"ambiguous", route:"web"|"judge"`; bad input → `{ok:false}`.
- **Acceptance criteria**:
  - A concrete own-repo path/file → `{ ok:true, class:"internal", route:"grep" }`.
  - Not-confidently-internal → `ambiguous` → judge → external/uncertain → research+cite (`route:"web"|"judge"`).
  - House-style envelope + bad-input guard preserved (`{ ok:false }` + non-zero exit on bad input).
- **Dependencies**: M90-D3-T1.

### M90-D3-T3 — Time-anchored protocol override (R-FACT-3)
Add the always-verify override: a fast-moving lib/API/version OR "current/latest best practice"
→ research regardless of confidence (CoVe-style; intrinsic self-knowledge signals collapse to
chance on the temporal axis, so a confidence gate can't catch a stale-but-confident fact).
Deterministic.
- **Files**: `bin/gsd-t-research-gate.cjs`
- **Touches**: `bin/gsd-t-research-gate.cjs`
- **Test**: `test/m89-research-classifier-corpus.test.js` — a "current/latest best practice" gap + a version/library-freshness gap → route to research REGARDLESS of any internal/confidence signal; deterministic across runs.
- **Acceptance criteria**: (covers GUESSED:stale)
  - A fast-moving lib/API/version gap → research (`route:"web"`) regardless of confidence.
  - A "current/latest best practice" gap → research regardless of confidence.
  - The override is deterministic and does not depend on a self-reported confidence field.
- **Dependencies**: M90-D3-T2.

### M90-D3-T4 — KEEP §7 fail-closed cite gate (R-FACT-4)
Verify the §7 fail-closed cite gate is PRESERVED unchanged: an external claim left uncited →
verify FAILS (the classify-time `status=uncited` marker, cite-time flip). This is a
no-regression check on the existing M89 behavior — D4 owns the verify-side read; this domain
must not break the marker the classifier writes.
- **Files**: `bin/gsd-t-research-gate.cjs`
- **Touches**: `bin/gsd-t-research-gate.cjs`
- **Test**: `test/m89-research-classifier-corpus.test.js` — an external claim emits the `status=uncited` marker; the marker contract (write-at-classify, flip-at-cite) is unchanged vs. the ed03a8d baseline.
- **Acceptance criteria**: (SC-FAIL-CLOSED)
  - An external claim emits the uncited-external marker (`status=uncited`) at classify time.
  - The marker shape is unchanged vs. the M89 baseline (D4's verify gate reads it unmodified).
  - When research is required but inconclusive, the path fails CLOSED (no silent proceed).
- **Dependencies**: M90-D3-T3.

### M90-D3-T5 — Corpus + classifier test redesign [Headline]
**Headline:** true
Update `test/m89-research-classifier-corpus.test.js` + both fixtures (`m89-labeled-corpus.json`,
`m89-heldout-corpus.json`): assert the INTERNAL decision enumerates no open category (≥10
out-of-any-prior-list external references, including a freshly-invented vendor name, each route to
judge/research, NONE silently internal — the *internal*-side guard, NOT a vendor-list deletion);
assert the closed INTERNAL set + time-anchored override classify the labeled corpus
DETERMINISTICALLY. **Per the premise correction, the vendor list is KEPT** — so the held-out
vendor-dependent rows HO-E1/E2/E5 (Stripe/Chrome → `external→web`) MUST STILL classify
`external→web` after the change (a REGRESSION assertion); do NOT re-label them to judge. Re-label a
row ONLY if D3-T0's baseline proves its current routing is a concrete defect. Keep the held-out
generalization guard ("passes seen, fails held-out" = FAILURE). Test count ≥ the ed03a8d baseline
(1824/0) — SC-FACTUAL-PRESERVED.
- **Files**: `test/m89-research-classifier-corpus.test.js`, `test/fixtures/m89-labeled-corpus.json`, `test/fixtures/m89-heldout-corpus.json`, `bin/gsd-t-research-gate.cjs`
- **Touches**: `test/m89-research-classifier-corpus.test.js`, `test/fixtures/m89-labeled-corpus.json`, `test/fixtures/m89-heldout-corpus.json`
- **Test**: `test/m89-research-classifier-corpus.test.js` (node --test) — the redesigned corpus test IS this file; ≥10 never-seen external refs → judge/research (none internal); held-out rows HO-E1/E2/E5 still → `external→web` (regression guard for the KEPT vendor list); closed-internal set + time-anchored override classify deterministically; held-out generalization guard retained. Run: `node --test test/m89-research-classifier-corpus.test.js`.
- **Acceptance criteria**: (SC-NO-FINITE-LIST + SC-FACTUAL-PRESERVED)
  - A known-answer test feeds ≥10 out-of-any-prior-list external references (incl. a freshly-invented vendor name); each routes to judge-or-research, NONE silently classified internal (the internal-side no-open-category guard).
  - The held-out vendor-dependent rows (HO-E1/E2/E5) still classify `external→web` after the change — a regression assertion proving the KEPT vendor list is intact (NOT re-labeled to judge unless T0 proved a defect).
  - The closed INTERNAL set + time-anchored override classify the labeled corpus deterministically.
  - Held-out generalization guard retained (no keyword-memorization); suite green at test count ≥ the ed03a8d baseline.
  - Suite green at test count ≥ the ed03a8d baseline (1824/0) — no factual-slice regression.
- **Dependencies**: M90-D3-T4.

## Dependency / gating
- **Gated on Wave 1** clearing prove-or-kill (risk-first build order). If Wave 1 R1-exits to factual-only, THIS domain CARRIES the milestone.
- T1→T5 build the same module + its test — write in order.
- File-disjoint from all other domains; its only shared dependency is the §1 envelope shape (pinned by the mechanisms contract) which D3 CONSUMES but does not write.
