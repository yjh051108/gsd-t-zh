# Tasks: m89-d4-wiring-worker-workflows

## Files Owned
- `templates/workflows/gsd-t-execute.workflow.js`
- `templates/workflows/gsd-t-debug.workflow.js`
- `templates/workflows/gsd-t-quick.workflow.js`
- `templates/workflows/gsd-t-wave.workflow.js`
- `test/m89-worker-research-wiring.test.js`
- `test/m89-internal-gap-no-websearch.test.js`

## Tasks

### M89-D4-T1 — Wire execute + quick + wave
**Touches**: `templates/workflows/gsd-t-execute.workflow.js`, `templates/workflows/gsd-t-quick.workflow.js`, `templates/workflows/gsd-t-wave.workflow.js`
At each research-eligible step: classifier via inline `runCli`; `external` → research `agent()` stage (model via
`overrides["research"] ?? "<literal>"`, prompt Read from `templates/prompts/research-subagent.md`) writing a cited
Verified-Facts block; `internal` → grep/Read, no web. M71 runtime-native. Idempotent.

### M89-D4-T2 — Wire debug (research-not-patch-guess)
**Touches**: `templates/workflows/gsd-t-debug.workflow.js`
When the failure root is external behavior, route to research instead of a patch-guess (pairs with #33
circuit-breaker). Same classify→research/grep trigger. M71 runtime-native.

### M89-D4-T3 — Wiring tests + A3 zero-WebSearch
**Touches**: `test/m89-worker-research-wiring.test.js`, `test/m89-internal-gap-no-websearch.test.js`
Assert all 4 worker workflows carry the trigger; assert ZERO WebSearch on labeled internal gaps (A3). Functional.

### M89-D4-T4 — Verify
**Touches**: (verification only)
RUN all 4 worker workflows to completion in the real sandbox; `npm test` (zero new regressions); M71 + M85 lints green.
