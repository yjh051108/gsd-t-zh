# Tasks: m61-d2-retire-unattended-relay

## Summary
Delete unattended supervisor / handoff / heartbeat / headless-auto-spawn relay (~8,800 LOC — largest demolition). Wave 3, parallel with D1/D3/D4. Wave 2 prep edits `bin/gsd-t.js`.

## Tasks

### Task M61-D2-T1 (Wave 2 prep) — Remove unattended subcommands from `bin/gsd-t.js`
- **Touches**: `bin/gsd-t.js` (remove `unattended` / `unattended-watch` / `unattended-stop` subcommand entries)
- **Contract refs**: `unattended-supervisor-contract.md` (about to be deleted)
- **Dependencies**: NONE (Wave 2 — file-disjoint from D7's command-file edits)
- **Acceptance**: `node bin/gsd-t.js --help` no longer lists unattended commands. Other subcommands unaffected.

### Task M61-D2-T2 — Zero-reference gate
- **Touches**: writes `.gsd-t/scan/m61-d2-zero-ref-verify.txt`
- **Contract refs**: NONE
- **Dependencies**: BLOCKED by T1, D6-T7, D7-T2
- **Acceptance**: `grep -rn "require.*gsd-t-unattended\|require.*headless-auto-spawn\|require.*handoff-lock\|require.*supervisor-pid-fingerprint\|require.*worker-dispatch\|require.*orchestrator-recover" --include='*.js' --include='*.cjs' .` returns zero live references (excluding the about-to-be-deleted files themselves).

### Task M61-D2-T3 — Delete relay files + 3 command files + contracts
- **Touches** (delete): `bin/gsd-t-unattended.cjs` + `.js`, `bin/gsd-t-unattended-safety.cjs` + `.js`, `bin/gsd-t-unattended-platform.cjs` + `.js`, `bin/gsd-t-unattended-heartbeat.cjs`, `bin/supervisor-pid-fingerprint.cjs`, `bin/handoff-lock.cjs` + `.js`, `bin/headless-auto-spawn.cjs` + `.js`, `bin/check-headless-sessions.js`, `bin/unattended-watch-format.cjs`, `bin/gsd-t-worker-dispatch.cjs`, `bin/gsd-t-orchestrator-recover.cjs`, `bin/headless-exit-codes.cjs`, `commands/gsd-t-unattended.md`, `commands/gsd-t-unattended-watch.md`, `commands/gsd-t-unattended-stop.md`, `.gsd-t/contracts/headless-contract.md`, `headless-default-contract.md`, `.gsd-t/.unattended/` (runtime dir)
- **Touches** (edit): `commands/gsd-t-resume.md` (strip Step 0, 0.2, 0.3); `bin/gsd-t-parallel.cjs` (remove `autoSpawnHeadless` calls)
- **Contract refs**: all of the above (about to be deleted)
- **Dependencies**: BLOCKED by T2
- **Acceptance**: Suite green. `gsd-t resume` runs cleanly on a fresh session (Step 0 / 0.2 / 0.3 are no-ops or removed). No dangling `require()` for any deleted file. `node bin/gsd-t.js doctor` reports clean.

## Execution Estimate
- Total tasks: 3
- Independent: 1 (T1 in Wave 2)
- Blocked: 2 (T2 and T3 in Wave 3)

## Files Owned
- All 14+ deletion targets exclusively
- `bin/gsd-t.js` unattended-subcommand section (shared file — sequenced at integrate)
- `commands/gsd-t-resume.md` (Step 0/0.2/0.3 only; rest unchanged)
- `bin/gsd-t-parallel.cjs` `autoSpawnHeadless` removal only (D6 may rewrite the rest of this file or delete it; sequenced at integrate)
