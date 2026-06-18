# Tasks: m89-d3-wiring-upper-phase-and-gate

## Files Owned
- `templates/workflows/gsd-t-phase.workflow.js`
- `templates/workflows/gsd-t-verify.workflow.js`
- `test/m89-phase-research-wiring.test.js`

## Tasks

### M89-D3-T1 — Wire the classify→research trigger into gsd-t-phase.workflow.js
**Touches**: `templates/workflows/gsd-t-phase.workflow.js`
At each research-eligible upper stage (plan, pre-mortem, partition, discuss, milestone, impact): call the
classifier via the inline `runCli` helper; on `external`, run the research `agent()` stage (model via
`overrides["research"] ?? "<literal>"`, prompt Read from `templates/prompts/research-subagent.md`) and write the
cited Verified-Facts block into the phase artifact BEFORE the gate re-runs. Idempotent (skip if already cited).
M71 runtime-native (no require/fs).

### M89-D3-T2 — Wire A4 no-silent-guess into gsd-t-verify.workflow.js
**Touches**: `templates/workflows/gsd-t-verify.workflow.js`
A phase artifact that recorded an external gap but has NO matching Verified-Facts cited block FAILS the verify
gate. M71 runtime-native.

### M89-D3-T3 — Wiring tests
**Touches**: `test/m89-phase-research-wiring.test.js`
Assert phase-stage wiring present at each eligible stage; assert verify FAILs an external-gap-skipped artifact
(A4); idempotency (no re-research when already cited). Functional, not existence.

### M89-D3-T4 — Verify
**Touches**: (verification only)
RUN the phase + verify workflows to completion in the real sandbox; `npm test` (zero new regressions); M71 +
M85 lints green.
