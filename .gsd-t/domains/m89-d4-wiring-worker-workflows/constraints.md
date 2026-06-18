# Constraints: m89-d4-wiring-worker-workflows

## Hard Rules
- **M71 runtime-native invariant.** NO `require`/`fs`/`path`/`child_process`/`process` in the edited workflows.
  Classifier call via the inline `runCli` helper (project-local `bin/gsd-t-research-gate.cjs` first, else global
  `gsd-t`). `args` is a JSON STRING. The M71 lint must stay green.
- **M85 tier policy.** The research `agent()` stage declares its model via `overrides["research"] ?? "<literal>"`
  (M86 form). The M85 drift lint must stay green.
- **A3 — internal gap → ZERO WebSearch.** An internal-classified gap routes to grep/Read only; invoking
  WebSearch on an internal gap is a FAILURE. Own the A3 assertion test.
- **Idempotent.** Skip research when the artifact already has a cited Verified-Facts entry for the gap (A2).
- **RUN, don't node --check.** Validate by running each of the four workflows to completion in the real sandbox.

## Gated Start
Do NOT begin until D1's A1 corpus test is GREEN (prove-or-kill).

## Test Standard
- `test/m89-worker-research-wiring.test.js`: assert each of the 4 worker workflows inserts the
  classify→(external: research+cite / internal: grep) trigger at its research-eligible step.
- `test/m89-internal-gap-no-websearch.test.js`: assert ZERO WebSearch invocation on the labeled internal gaps (A3).
- Functional assertions, not existence checks.
