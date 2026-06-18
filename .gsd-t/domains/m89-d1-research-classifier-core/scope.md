# Domain: m89-d1-research-classifier-core

## Wave
WAVE 1 — PROVE-OR-KILL, load-bearing. Fully file-disjoint from D2 (separate .cjs + separate test file).

## Mission
Build the deterministic internal-vs-external gap classifier as a standalone `bin/gsd-t-research-gate.cjs`.
Given a stated gap it returns the house-style JSON envelope `{class:internal|external, route:grep|web, reason}`,
NAMING the gap + classification (auditable, never silent). Ambiguous → internal-first; escalate to external
only if grep/Read returns nothing (the escalation step itself lives in the wiring domains).

The A1 killing test feeds the 13-item LABELED CORPUS (7 M87 findings → 0 external; 6 binvoice S2-M5 findings →
2-3 external incl. PayPal OAuth `/v1/oauth2/token` mint + invoice-TOTAL limit) and asserts each label matches
the hand-label deterministically. A single mislabel FAILS. **If the classifier cannot hit the labels
deterministically, HALT the milestone for re-scope before any wiring.**

## Files Owned
- `bin/gsd-t-research-gate.cjs` — the classifier module + CLI (NET-NEW)
- `test/m89-research-classifier-corpus.test.js` — the A1 killing test (NET-NEW)
- `test/fixtures/m89-labeled-corpus.json` — the 13-item hand-labeled corpus (NET-NEW, salvaged from alt proposals)
- `.gsd-t/domains/m89-d1-research-classifier-core/{scope,constraints,tasks}.md`

## Interface
PRODUCES the classifier matching the envelope SHAPE pinned in `.gsd-t/contracts/auto-research-contract.md` §1.
D3/D4 consume ONLY the envelope shape, not this module's internals. NO writes to `bin/gsd-t.js` dispatch
(that is the D2-owned integrate seam) and NO writes to any workflow file.

## NOT Owned
- The contract itself (`auto-research-contract.md`) — D2 owns it.
- `bin/gsd-t.js` dispatch case — D2.
- Any `templates/workflows/*.workflow.js` — D3/D4.
