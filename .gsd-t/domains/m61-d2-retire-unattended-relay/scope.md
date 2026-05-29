# Domain: m61-d2-retire-unattended-relay

## Responsibility
Delete the cross-session unattended supervisor / handoff / heartbeat relay now replaced by native background Workflows + `/loop`. Largest demolition (~8,800 LOC). Wave 3 (parallel with D1∥D3∥D4).

## Owned Files (delete)
- `bin/gsd-t-unattended.cjs` + `bin/gsd-t-unattended.js`
- `bin/gsd-t-unattended-safety.cjs` + `bin/gsd-t-unattended-safety.js`
- `bin/gsd-t-unattended-platform.cjs` + `bin/gsd-t-unattended-platform.js`
- `bin/gsd-t-unattended-heartbeat.cjs`
- `bin/supervisor-pid-fingerprint.cjs`
- `bin/handoff-lock.cjs` + `bin/handoff-lock.js`
- `bin/headless-auto-spawn.cjs` + `bin/headless-auto-spawn.js`
- `bin/check-headless-sessions.js`
- `bin/unattended-watch-format.cjs`
- `bin/gsd-t-worker-dispatch.cjs`
- `bin/gsd-t-orchestrator-recover.cjs`
- `bin/headless-exit-codes.cjs`
- `commands/gsd-t-unattended.md`
- `commands/gsd-t-unattended-watch.md`
- `commands/gsd-t-unattended-stop.md`
- `.gsd-t/contracts/headless-contract.md`
- `.gsd-t/contracts/headless-default-contract.md`
- `.gsd-t/contracts/unattended-supervisor-contract.md` (if separate)
- `.gsd-t/contracts/unattended-event-stream-contract.md` (if separate)
- `scripts/hooks/gsd-t-compact-detector.js` (if compaction-relay-specific; keep if used by Workflow)
- `.gsd-t/.unattended/` runtime dir cleanup

## Owned Files (edit)
- `bin/gsd-t.js` — remove `unattended` / `unattended-watch` / `unattended-stop` subcommands
- `commands/gsd-t-resume.md` — strip Step 0 (Unattended Supervisor Auto-Reattach), Step 0.2 (Handoff Lock Wait), Step 0.3 (Orchestrator Run Recovery)
- `bin/gsd-t-parallel.cjs` — remove `autoSpawnHeadless` calls (workflow replacement landed in D6)

## NOT Owned (do not modify)
- Native Workflow tool invocations (these replace what we delete)
- D6 Workflow scripts
- D7-kept validation gates (`gsd-t-verify-gate`, `gsd-t-context-brief`, etc.)

## Estimated LOC removed
~8,800 LOC + 3 commands + 3-4 contracts + 1 runtime dir

## Pre-deletion gate
1. Verify D6 migration of orchestration to Workflow scripts is committed and tagged at integrate
2. `grep -r "require.*gsd-t-unattended\|require.*headless-auto-spawn\|require.*handoff-lock\|require.*supervisor-pid-fingerprint\|require.*worker-dispatch\|require.*orchestrator-recover" --include='*.js' --include='*.cjs' .` returns zero live references
3. No active supervisor PID file in any registered project (cross-project scan)
