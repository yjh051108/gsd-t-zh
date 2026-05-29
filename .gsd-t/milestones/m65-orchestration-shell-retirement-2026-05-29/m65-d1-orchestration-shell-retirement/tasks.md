# Tasks: m65-d1-orchestration-shell-retirement

## Summary
Retire the obsolete M40/M44 orchestration shell (8 bin/ files, ~1,838 LOC) the M61 native Workflow scripts replaced, plus dependent tests + hooks + reference cleanup. Two surgical inlines (`mapHeadlessExitCode`, the 3 orchestrator-config gating exports) precede their source-file deletions so the KEEP-list substrate never loses a dependency. Single domain, single wave; tasks are internally ordered by the inline-before-delete safety invariant.

## Execution mode
**Solo sequential** — 7 tasks, file-disjoint from all KEEP files, but internally ordered (inlines + suite-green gates must precede deletions). All land in one execute pass. No cross-domain dependencies, no checkpoints (single domain).

## Tasks

### M65-D1-T1 — Inline `mapHeadlessExitCode` into gsd-t.js, then delete headless-exit-codes.cjs
- **Touches**: `bin/gsd-t.js`, `bin/headless-exit-codes.cjs` (delete)
- **Files**: edit `bin/gsd-t.js` (lines ~40–41 require, ~3512 re-export note, ~4243 export); delete `bin/headless-exit-codes.cjs`
- **Contract refs**: none (CLI-internal). 5-code headless exit contract (0/1/2/3/4/5) is the behavioral spec.
- **Dependencies**: NONE
- **Acceptance criteria**:
  - `mapHeadlessExitCode` defined inline in `gsd-t.js` (copy the boundary-anchored regexes — `NONZERO_FAILURE_COUNT_RE`, `STRUCTURED_FAIL_RE`, `JEST_SUMMARY_FAIL_RE`, `VERIFICATION_FAILED_RE`, `CONTEXT_BUDGET_RE`, `BLOCKED_HUMAN_RE` — VERBATIM; M45 false-positive history depends on them)
  - The `require('headless-exit-codes.cjs')` at :41 removed; call site at ~:3607 still resolves the inline fn
  - `headless-exit-codes.cjs` removed from `PROJECT_BIN_TOOLS` (~:2482)
  - Golden contract preserved (verified in plan): `m(0,'all good')=0`, `m(0,'context budget exceeded')=2`, `m(0,'blocked — needs human')=4`, `m(0,'FAIL: x')=1`, `m(2,'')=3`, `m(0,'unknown command: foo')=5`
  - `bin/headless-exit-codes.cjs` deleted; zero-live-reference scan clean before `rm`
  - `node bin/gsd-t.js --help` runs without require error

### M65-D1-T2 — Inline the 3 gating exports into gsd-t-parallel.cjs (edit only — config file deleted in T3)
- **Touches**: `bin/gsd-t-parallel.cjs`
- **Files**: edit `bin/gsd-t-parallel.cjs` (remove require at ~47–49 + ~165, add inline block, refresh the stale header comment ~13–18)
- **Contract refs**: M44-D2 `wave-join-contract.md` §Mode-Aware Gating Math (preserve the comment pointer in the inlined block)
- **Dependencies**: NONE (independent of T1). **Note**: the config file is NOT deleted here — `gsd-t-orchestrator.js:7` still requires it (`loadConfig`); the file deletion happens in T3 once its other requirer is gone, keeping each safety scan honest.
- **Acceptance criteria**:
  - `computeInSessionHeadroom` + `computeUnattendedGate` + constants `IN_SESSION_CW_CEILING_PCT` (85) + `UNATTENDED_PER_WORKER_CW_PCT` (60) + `DEFAULT_SUMMARY_SIZE_PCT` (4) inlined into `gsd-t-parallel.cjs` VERBATIM (self-contained — no other orchestrator-config deps)
  - Both `require('gsd-t-orchestrator-config.cjs')` sites (the destructure at ~47–49 and the inline `.DEFAULT_SUMMARY_SIZE_PCT` at ~165) removed; call sites at ~236 + ~260 use the inlined fns
  - The stale header doc-comment block (~lines 13–18, referencing retired `gsd-t-economics.cjs`/`token-budget.cjs`/`gsd-t-orchestrator-config.cjs` + "Does NOT replace bin/gsd-t-orchestrator.js") refreshed to drop pointers to retired modules
  - Golden behavior preserved (verified in plan): `computeInSessionHeadroom({ctxPct:50,workerCount:8,summarySize:4})={ok:true,reducedCount:8}`; `computeUnattendedGate({estimatedCwPct:70,threshold:60})={ok:false,split:true}`; `DEFAULT_SUMMARY_SIZE_PCT===4`
  - `require('./bin/gsd-t-parallel.cjs').runCli` still a function; `gsd-t-orchestrator-config.cjs` still on disk (T3 deletes it); no NEW test fails

### M65-D1-T3 — Delete the orchestrator core (orchestrator.js + worker + queue + config) + remove `orchestrate` dispatch
- **Touches**: `bin/gsd-t-orchestrator.js` (delete), `bin/gsd-t-orchestrator-worker.cjs` (delete), `bin/gsd-t-orchestrator-queue.cjs` (delete), `bin/gsd-t-orchestrator-config.cjs` (delete), `bin/gsd-t.js`
- **Files**: delete the 4 orchestrator files; edit `bin/gsd-t.js` (remove `case "orchestrate"` ~:4377, help line ~:4168, `gsd-t-orchestrator.js` + `gsd-t-orchestrator-config.cjs` from `PROJECT_BIN_TOOLS`)
- **Contract refs**: none. Retire→native: `orchestrate` → `gsd-t-execute.workflow.js`
- **Dependencies**: Requires T2 (the KEEP file `gsd-t-parallel.cjs` must be off `orchestrator-config` BEFORE the config file is deleted; orchestrator.js — the config's other requirer — is deleted in this same task, so after T2+T3 nothing requires the config)
- **Acceptance criteria**:
  - All 4 files deleted; zero-live-reference scan clean before each `rm`. Delete order within task: orchestrator.js (requires worker/queue/config) → worker → queue → config last. After T2, the only requirers of orchestrator-config were orchestrator.js (deleted here) + gsd-t-parallel.cjs (inlined in T2) → config scan clean.
  - The doc-comment at `gsd-t-parallel.cjs:17` ("Does NOT replace bin/gsd-t-orchestrator.js") is handled by T2's comment refresh — confirm no live `require` of any deleted orchestrator file remains anywhere
  - `case "orchestrate"` + its help line removed from `gsd-t.js`; running `gsd-t orchestrate` exits with normal unknown-command handling (not a crash)
  - `node bin/gsd-t.js --help` shows no `orchestrate` line
  - Command-count logic in `gsd-t.js` updated if it enumerated `orchestrate`

### M65-D1-T4 — Delete the spawn-plan cluster + post-commit-spawn-plan hooks
- **Touches**: `bin/spawn-plan-writer.cjs` (delete), `bin/spawn-plan-status-updater.cjs` (delete), `bin/spawn-plan-derive.cjs` (delete), `scripts/gsd-t-post-commit-spawn-plan.sh` (delete), `templates/hooks/post-commit-spawn-plan.sh` (delete), `bin/gsd-t.js` (if hook installer wiring exists)
- **Files**: delete the 3 spawn-plan bin files + 2 hook scripts; edit `bin/gsd-t.js` to remove `spawn-plan*` from `PROJECT_BIN_TOOLS` (~:2482) + any post-commit-spawn-plan installer wiring
- **Contract refs**: none. Retire→native: spawn-plan progress files → native `/workflows` + Agent View
- **Dependencies**: NONE (cluster only required by each other + the 2 hooks; independent of T1–T3)
- **Acceptance criteria**:
  - 5 files deleted; zero-live-reference scan clean before each `rm` (writer↔derive↔status-updater form a closed cluster; status-updater required only by the 2 hooks being deleted in the same task)
  - No `spawn-plan` reference survives in `bin/gsd-t.js` (`PROJECT_BIN_TOOLS` + any `--install-*-hook` wiring)
  - Grep for `post-commit-spawn-plan` across `bin scripts templates commands` returns nothing live

### M65-D1-T5 — Delete dependent test files with their subjects
- **Touches**: `test/m40-orchestrator-config.test.js`, `test/m40-orchestrator-queue.test.js`, `test/m40-orchestrator-worker.test.js`, `test/m44-d8-spawn-plan-writer.test.js`, `test/m44-d8-spawn-plan-status-updater.test.js`, `test/m44-d8-post-commit-hook.test.js` (all delete)
- **Files**: delete the 6 test files
- **Contract refs**: none
- **Dependencies**: Requires T1–T4 (subjects deleted first; these tests `require` the now-deleted modules and would MODULE_NOT_FOUND otherwise)
- **Acceptance criteria**:
  - All 6 test files deleted (their subjects are gone; the 2 inlined gating fns had no coverage in these files, so no coverage is orphaned)
  - `npm test` shows no MODULE_NOT_FOUND from the deleted-module requires
  - Suite: no NEW failures beyond the 22 M61-carryover baseline; the 6 files drop from the denominator (expected total < 1452)

### M65-D1-T6 — Clean dangling reference in gsd-t-resume.md
- **Touches**: `commands/gsd-t-resume.md`
- **Files**: edit `commands/gsd-t-resume.md` (~line 150)
- **Contract refs**: none
- **Dependencies**: NONE
- **Acceptance criteria**:
  - The line referencing the already-deleted `bin/gsd-t-orchestrator-recover.cjs` (deleted in M61 D2) is removed or rewritten to drop the dead pointer
  - `grep -rn "gsd-t-orchestrator-recover" commands` returns nothing

### M65-D1-T7 — Doctor + LOC delta + retire→native map (acceptance gate)
- **Touches**: `.gsd-t/milestones/m61-platform-reconciliation-2026-05-29/retire-to-native-map.md` (append), `.gsd-t/progress.md` (delta record)
- **Files**: run `gsd-t doctor`; measure bin/ LOC; append M65 rows to the M61 retire→native map
- **Contract refs**: none. Mirrors SC1/SC4/SC6.
- **Dependencies**: Requires T1–T6 (all deletions + cleanups done)
- **Acceptance criteria**:
  - **SC4**: `gsd-t doctor` passes with no dangling references to deleted modules; no command file or hook references a deleted `bin/` script
  - **SC1**: bin/ LOC measured + delta reported (baseline 22,051 → expect ~20,213, −~1,838); recorded in progress.md
  - **SC6**: retire→native map gains rows: `orchestrate`→`gsd-t-execute.workflow.js`, spawn-plan progress→native `/workflows`+Agent View, `headless-exit-codes`→inlined into gsd-t.js, `orchestrator-config` gating math→inlined into gsd-t-parallel.cjs
  - **SC2**: final scan confirms KEEP files (`parallel-cli.cjs`, `parallel-cli-tee.cjs`, `gsd-t-parallel.cjs`) resolve + still required by `verify-gate.cjs:31` + `_lib.js:107`

## Execution Estimate
- Total tasks: 7
- Independent tasks (no blockers): 4 (T1, T2, T4, T6)
- Blocked tasks (intra-domain ordering): 3 (T3 after T2 — inline-before-config-delete; T5 after T1–T4 — subjects before tests; T7 after T1–T6 — final gate)
- Estimated checkpoints: 0 (single domain, no cross-domain gates)
- Test baseline at plan: 1426–1427 pass / 22–23 fail / 3 skip / 1452 total (the ±1 is a known flaky — likely m43-dashboard-autostart; all "fails" are M61 D1–D8 carryover). SC3 = no NEW fails beyond this band.

## Files Owned
See `scope.md` § Owned Files/Directories.
