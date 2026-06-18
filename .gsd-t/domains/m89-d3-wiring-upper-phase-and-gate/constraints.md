# Constraints: m89-d3-wiring-upper-phase-and-gate

## Hard Rules
- **M71 runtime-native invariant.** NO `require`/`fs`/`path`/`child_process`/`process` in the edited workflows.
  Delegate the classifier call to an `agent()`'s Bash via the inline `runCli` helper (project-local
  `bin/gsd-t-research-gate.cjs` first, else global `gsd-t`). `args` is a JSON STRING. The M71 lint must stay green.
- **M85 tier policy.** The research `agent()` stage declares its model via `overrides["research"] ?? "<literal>"`
  (M86 form). The M85 drift lint must stay green — a drifted literal FAILS.
- **Idempotent.** Scan the phase artifact for an existing Verified-Facts entry before researching; skip if
  already cited (A2). No re-research on a re-run.
- **Gate ordering.** The cited Verified-Facts block must be written into the phase artifact BEFORE the phase
  gate re-runs.
- **A4 in verify.** A phase artifact recording an external gap with no matching Verified-Facts block FAILS the
  `gsd-t-verify` gate.
- **RUN, don't node --check.** Per the workflow-sandbox feedback: validate by running the workflow to completion
  in the real sandbox, not just `node --check`.

## Gated Start
Do NOT begin until D1's A1 corpus test is GREEN (prove-or-kill). A red A1 means HALT for re-scope.

## Test Standard
Own `test/m89-phase-research-wiring.test.js`: assert the phase workflow inserts the classify→research wiring at
each eligible stage and that the verify workflow FAILs an external-gap-skipped-research artifact (A4). Functional
assertions (behavior/state), not existence checks.
