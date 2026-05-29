# Domain: m65-d1-orchestration-shell-retirement

## Responsibility

Retire the obsolete M40/M44 orchestration shell that the M61 native Workflow scripts (`templates/workflows/*.workflow.js`) replaced, with zero dangling references and no new test failures beyond the M61-carryover baseline. Single domain, single wave, file-disjoint (the KEEP-list substrate is untouched except for one surgical inline).

## Owned Files/Directories

### DELETE (8 files, ~1,838 bin/ LOC)
- `bin/gsd-t-orchestrator.js` (543) — M40 external orchestrator entry → superseded by `gsd-t-execute.workflow.js`
- `bin/gsd-t-orchestrator-worker.cjs` (228) — only required by `gsd-t-orchestrator.js`
- `bin/gsd-t-orchestrator-queue.cjs` (180) — only required by `gsd-t-orchestrator.js`
- `bin/gsd-t-orchestrator-config.cjs` (161) — **inline 3 used exports into `gsd-t-parallel.cjs` FIRST** (see Untangle below), then delete
- `bin/spawn-plan-writer.cjs` (204) — spawn-plan cluster; progress → native `/workflows` + Agent View
- `bin/spawn-plan-status-updater.cjs` (292) — spawn-plan cluster
- `bin/spawn-plan-derive.cjs` (163) — spawn-plan cluster
- `bin/headless-exit-codes.cjs` (67) — **inline `mapHeadlessExitCode` into `gsd-t.js` FIRST**, then delete

### DELETE (dependent tests — drop with their subjects)
- `test/m40-orchestrator-config.test.js` — tests `loadConfig`/`computeAdaptiveMaxParallel` (the orchestrator-only parts being dropped; the 2 inlined gating fns have no test coverage today)
- `test/m40-orchestrator-queue.test.js`
- `test/m40-orchestrator-worker.test.js`
- `test/m44-d8-spawn-plan-writer.test.js`
- `test/m44-d8-spawn-plan-status-updater.test.js`
- `test/m44-d8-post-commit-hook.test.js`

### DELETE (hook artifacts)
- `scripts/gsd-t-post-commit-spawn-plan.sh`
- `templates/hooks/post-commit-spawn-plan.sh`

### EDIT (reference cleanup)
- `bin/gsd-t.js` — remove `case "orchestrate"` dispatch (~4379) + help line (~4170); remove `gsd-t-orchestrator.js`/`spawn-plan*`/`headless-exit-codes.cjs` from `PROJECT_BIN_TOOLS` (~2482); inline `mapHeadlessExitCode` (replacing the require at :41, the re-export note at :3512, and the export at :4243); remove any post-commit-spawn-plan hook installer wiring
- `bin/gsd-t-parallel.cjs` — **inline** `computeInSessionHeadroom` + `computeUnattendedGate` + `IN_SESSION_CW_CEILING_PCT` + `UNATTENDED_PER_WORKER_CW_PCT` + `DEFAULT_SUMMARY_SIZE_PCT` (~50 LOC) directly in-file, removing both `require('gsd-t-orchestrator-config.cjs')` sites (lines 47–49 and 165)
- `commands/gsd-t-resume.md` — remove the dangling line ~150 referencing already-deleted `bin/gsd-t-orchestrator-recover.cjs`

## NOT Owned (do not modify — M61 KEEP-list substrate)
- `bin/parallel-cli.cjs` — verify-gate Track-2 engine (`runParallel`); untouched
- `bin/parallel-cli-tee.cjs` — required by `parallel-cli.cjs`; untouched
- `bin/gsd-t-parallel.cjs` — the `_lib.js` file-disjointness prover. **One surgical inline only** (the orchestrator-config untangle above); its disjointness/planning behavior must be byte-equivalent for the 3 inlined fns
- `bin/orchestrator.js` + `bin/design-orchestrator.js` — design-build pipeline (currently unwired); OUT of M65, flagged as separate backlog decision
- `bin/gsd-t-verify-gate.cjs`, `templates/workflows/_lib.js`, all other KEEP-list brains — untouched

## Untangle: orchestrator-config.cjs → gsd-t-parallel.cjs (do BEFORE deleting the config file)

`gsd-t-parallel.cjs` (KEEP) imports 3 things from the to-be-deleted `gsd-t-orchestrator-config.cjs`:
- `computeUnattendedGate` — called at line 236 (`{estimatedCwPct, threshold: 60}`)
- `computeInSessionHeadroom` — called at line 260 (`{ctxPct, workerCount, summarySize}`)
- `DEFAULT_SUMMARY_SIZE_PCT` — used at line 165 (the `summarySize` default = 4)

Both functions are self-contained (only need the 3 named constants + standard `Math`/`Number`; no cross-deps on `loadConfig`/`computeAdaptiveMaxParallel`/RAM-budget logic, which are orchestrator-only and get dropped). Inline the ~50 LOC verbatim into `gsd-t-parallel.cjs`, preserving the M44-D2 contract comment pointer (`wave-join-contract.md` §Mode-Aware Gating Math), then delete `orchestrator-config.cjs`. Decision: user-approved 2026-05-29 ("Inline the 3 used exports, then delete").
