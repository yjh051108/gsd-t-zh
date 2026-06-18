# Domain: m89-d3-wiring-upper-phase-and-gate

## Wave
WAVE 2 — gated on D1's A1 test passing. Concurrent with D4 (disjoint workflow files). EXCLUSIVE owner of the
phase + verify workflow files — D4 never touches these.

## Mission
Hook the auto-research trigger into `templates/workflows/gsd-t-phase.workflow.js` at every upper
research-eligible stage (plan, pre-mortem, partition, discuss, milestone, impact — all run through phase).
Each insert calls the classifier (D1 envelope); on `external` it runs the research `agent()` stage that writes
a cited Verified-Facts block into the phase artifact BEFORE the gate re-runs (idempotent — no re-research when
already cited). Also touch `gsd-t-verify.workflow.js` so a phase that hit an external gap and skipped research
FAILS the verify gate (A4 — no silent guess).

## Files Owned
- `templates/workflows/gsd-t-phase.workflow.js`
- `templates/workflows/gsd-t-verify.workflow.js`
- `test/m89-phase-research-wiring.test.js`
- `.gsd-t/domains/m89-d3-wiring-upper-phase-and-gate/{scope,constraints,tasks}.md`

## Interface
CONSUMES the D1 classifier envelope (via the runCli inline helper) + the D2 contract's research stage interface
+ Verified-Facts cite format + A4 gate semantics. Wires them inline; does NOT redefine them.

## NOT Owned
- `templates/workflows/gsd-t-{execute,debug,quick,wave}.workflow.js` — D4 (one-domain-per-workflow-file).
- `bin/gsd-t-research-gate.cjs`, the contract, `CLAUDE-global.md`, `bin/gsd-t.js` — D1/D2.
