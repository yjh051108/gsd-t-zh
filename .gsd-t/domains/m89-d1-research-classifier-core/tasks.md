# Tasks: m89-d1-research-classifier-core

> **Wave 1 — PROVE-OR-KILL (load-bearing).** Concurrent with D2, fully file-disjoint.
> A1 (M89-D1-T3) is the milestone kill-gate: a single mislabel HALTS M89 for re-scope.
> Contract: `.gsd-t/contracts/auto-research-contract.md` v1.0.0 STABLE §1 (envelope), §6 (corpus).

## Files Owned
- `bin/gsd-t-research-gate.cjs`
- `test/m89-research-classifier-corpus.test.js`
- `test/fixtures/m89-labeled-corpus.json`

## Tasks

### M89-D1-T1 — Author the labeled corpus fixture
**Files**: `test/fixtures/m89-labeled-corpus.json` (NET-NEW)
**Dependencies**: none (Wave-1 entry task)
**Contract**: `auto-research-contract.md` §6 (the A1 killing oracle table)
**Description**: 13 items. Each item: `{ id, source, gap, expectedClass, expectedRoute }` where
`expectedClass ∈ {internal, external}` and `expectedRoute ∈ {grep, web}` (internal⇒grep, external⇒web).
- Items 1–7: the 7 M87 findings (own code / contracts / sandbox / test-architecture) → all `internal`/`grep`, ZERO external.
- Items 8–13: the 6 binvoice S2-M5 findings → exactly 2–3 `external`/`web`, MUST include:
  - PayPal OAuth `/v1/oauth2/token` mint/seed contract → `external`
  - PayPal v2 invoice **TOTAL** amount limit (each line fine, sum overflows) → `external`
  - remaining binvoice items: **each pinned to a single deterministic hand-label** (own-schema/own-route ⇒ internal; popup-blocker browser behavior ⇒ pin it explicitly to `external` — browser/runtime behavior is an external signal per §1 — do NOT leave it floating). The "2–3 external" is the aggregate the per-item labels must SUM to, NOT a license to leave any single item's label ambiguous. Every one of the 13 items has exactly ONE hand-label.
**Acceptance**: valid JSON, exactly 13 items, every item has all 5 keys and a single unambiguous `expectedClass`/`expectedRoute`; aggregate = 7 internal (items 1–7) + 2–3 external (items 8–13); the two named PayPal findings present and labeled `external`; NO item left with a "borderline/either" label.
**Test**: consumed by `test/m89-research-classifier-corpus.test.js` (T3), which asserts the fixture shape (count=13, key-completeness, aggregate bounds) — a malformed fixture FAILS T3.

### M89-D1-T2 — Build the classifier module + CLI
**Files**: `bin/gsd-t-research-gate.cjs` (NET-NEW — the implementation path for A1/SC1)
**Dependencies**: M89-D1-T1 (corpus defines the labels the router must satisfy)
**Contract**: `auto-research-contract.md` §1 (envelope shape) + constraints.md (deterministic, no LLM, zero-dep)
**Description**: Pure deterministic keyword/pattern router (a calculator, mirroring `gsd-t-competition-judge.cjs` — NO LLM call, NO network, sync APIs, zero new runtime deps). Emits the house-style envelope
`{ ok:true, gap, class:"internal"|"external", route:"grep"|"web", reason }` on success; `{ ok:false, error }` on bad input. The `gap` field is ALWAYS echoed (auditable, never silent).
- **External signals** (→ `external`/`web`): third-party API contract / endpoint / rate-limit / error-shape / auth flow; library / framework / version behavior; platform / browser / runtime behavior; published standard / spec; current-best-practice / latest-version facts.
- **Internal signals** (→ `internal`/`grep`, NEVER `web`): this repo's own code / contracts / schema / file-ownership / sandbox rules / test architecture.
- **Ambiguous → internal-first**: default `class:internal, route:grep`. (Escalation to external on empty grep is the WIRING domains' job, NOT this module's.)
- `internal`+`web` is structurally impossible (route derived from class).
- CLI: `gsd-t-research-gate classify "<gap>" --json` prints the envelope; bad/empty input → `{ok:false,error}` + non-zero exit.
**Acceptance**: identical gap text → byte-identical envelope (deterministic); never throws on string input; emits exactly the §1 envelope keys.
**Test**: `node --check bin/gsd-t-research-gate.cjs` (syntax) + the A1 corpus test T3 exercises every branch via the 13 labeled gaps (a mis-routed branch fails a label → no dead branches).

### M89-D1-T3 — A1 killing test (HEADLINE)
**Headline:** true
**Files**: `bin/gsd-t-research-gate.cjs` (the headline implementation path — deterministic internal-vs-external classifier) + `test/m89-research-classifier-corpus.test.js` (NET-NEW — the test exercising that capability end-to-end against the real 13-item labeled corpus).
**Implements**: `bin/gsd-t-research-gate.cjs` (T2) — the milestone's headline capability; this test is its end-to-end oracle.
**Dependencies**: M89-D1-T1 (fixture), M89-D1-T2 (classifier)
**Contract**: `auto-research-contract.md` §6 + SC1/A1 (progress.md)
**Description**: Load `test/fixtures/m89-labeled-corpus.json`, run each gap through the classifier, assert EVERY item's `class` AND `route` match its hand-label — item-by-item, not just the aggregate. Then assert the aggregate invariants: items 1–7 all `internal` (0 external); items 8–13 exactly 2–3 `external` including the two named PayPal findings. Run a sample gap twice; assert byte-identical envelopes (determinism).
**Acceptance**: ALL 13 labels match deterministically; a single mislabel FAILS. NO shallow `length>0` / existence assertions — each assertion compares against a specific hand-label.
**Test**: this file IS the A1 test. Runner: `npm test` (node built-in test runner). It is the milestone's headline-capability oracle.

### M89-D1-T4 — Prove-or-kill checkpoint (KILL GATE)
**Files**: verification only (no new file)
**Dependencies**: M89-D1-T3
**Description**: `node --check bin/gsd-t-research-gate.cjs`; run T3 in isolation. **GREEN → signal D3/D4 (Wave 2) unblocked.** **RED and not fixable deterministically → HALT M89 + escalate for re-scope. Do NOT soften the corpus or the classifier to force a pass** (constraints.md prove-or-kill gate + [[feedback_coverage_check_structural_not_substring]]).
**Acceptance**: A1 (T3) GREEN, OR the milestone explicitly HALTED with a re-scope escalation recorded in progress.md.
**Test**: re-run of T3 (the gate decision IS the test result).
