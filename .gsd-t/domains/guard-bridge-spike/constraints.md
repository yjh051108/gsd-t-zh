# Constraints: guard-bridge-spike

## Hard engineering bar (mirror M83 traceability-gate)
- **Zero deps.** Node built-ins only (`node:fs`, `node:path`).
- **Never throws.** All paths return a JSON envelope `{ ok, exitCode, ... }`;
  bad input → exitCode 64, never an uncaught throw.
- **Pure / read-only.** The module reads the pseudocode doc + the build→rule
  map; it writes nothing.
- **Deterministic pass/fail.** ZERO LLM judgment in the gate decision. An LLM
  may produce the build→rule map upstream; the module's pass/fail is pure code
  over that map. This is the A1 invariant — if any branch needs LLM judgment to
  decide pass/fail, the design is wrong.

## Grammar source
- `[RULE]` grammar is defined in `pseudocode-source-of-truth-contract.md` §2.
  Parse RULE-IDs **path-as-RULE-ID, never substring** (per
  `feedback_coverage_check_structural_not_substring`). A non-converging Red
  Team (>2 cycles each spawning a variant) on the coverage check = design
  defect → HALT + escalate, do not keep patching.

## Exit codes
- `0` — every rule backed, none contradicted (faithful build).
- `4` — ≥1 rule unbacked OR contradicted (contract-breach divergence; blocks).
- `64` — bad input.
  Mirror the traceability-gate's code set.

## Workflow edit (verify.workflow.js)
- **M71 runtime-native:** NO `require`/`fs`/`path`/`child_process`/`process`.
  `args` is a JSON STRING — `JSON.parse` it. Delegate the guard-map CLI call to
  an `agent()`'s Bash via the existing `runCli` inline helper (prefer
  project-local `bin/gsd-t-guard-map.cjs`, fall back to global `gsd-t`).
- **M85 tier-policy:** any `model:` literal added MUST match
  `bin/gsd-t-model-tier-policy.cjs`. A deterministic CLI delegation runs on the
  same tier as the other gate calls (`haiku`). The M85 lint
  (`test/m85-workflow-tier-policy-lint.test.js`) MUST stay green.
- Wire the guard-map check as a deterministic gate step alongside
  verify-gate / CI-parity / test-data — BEFORE the orthogonal triad, FAIL-blocking.

## Wave discipline
- This domain runs ALONE in wave 1. No wave-2 domain starts until A1 passes.
- If A1 fails: STOP. Escalate. Do not begin D2/D3/D4.
