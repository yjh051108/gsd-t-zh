# Tasks: m89-d1-research-classifier-core

## Files Owned
- `bin/gsd-t-research-gate.cjs`
- `test/m89-research-classifier-corpus.test.js`
- `test/fixtures/m89-labeled-corpus.json`

## Tasks

### M89-D1-T1 — Author the labeled corpus fixture
**Touches**: `test/fixtures/m89-labeled-corpus.json`
13 items: 7 M87 findings (expected internal) + 6 binvoice S2-M5 findings (expected external for 2-3, incl.
PayPal OAuth `/v1/oauth2/token` mint + v2 invoice-TOTAL limit). Each item: `{id, source, gap, expectedClass, expectedRoute}`.

### M89-D1-T2 — Build the classifier module + CLI
**Touches**: `bin/gsd-t-research-gate.cjs`
Deterministic keyword/pattern router emitting the `auto-research-contract.md` §1 envelope. External signals:
third-party API contract/endpoint/limit/error-shape/auth, library/framework/version, platform/browser/runtime,
standard/spec, current-best-practice/latest-version. Internal signals: own code/contracts/schema/file-ownership/
sandbox/test-architecture. Ambiguous → internal-first. CLI: `gsd-t-research-gate classify "<gap>" --json`.

### M89-D1-T3 — A1 killing test
**Touches**: `test/m89-research-classifier-corpus.test.js`
Load the fixture, classify each gap, assert EVERY label matches its hand-label deterministically; assert the
aggregate (7 internal → 0 external; 6 binvoice → 2-3 external incl. the two named findings). A mislabel FAILS.

### M89-D1-T4 — Prove-or-kill checkpoint
**Touches**: (verification only)
`node --check bin/gsd-t-research-gate.cjs`; run T3. GREEN → signal D3/D4 unblocked. If RED and not fixable
deterministically → HALT + escalate for re-scope (do NOT soften the corpus).
