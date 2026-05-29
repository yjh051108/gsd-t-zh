# Tasks: m61-d5-retire-proof-scratch

## Summary
Delete 8 proof/benchmark/probe scripts that have zero live references. Wave 1, parallel with D6.

## Tasks

### Task M61-D5-T1 — Zero-reference verification gate
- **Touches**: no edits; writes `.gsd-t/scan/m61-d5-zero-ref-verify.txt`
- **Contract refs**: NONE
- **Dependencies**: NONE
- **Acceptance**: Bash grep gate (from scope.md) returns empty for all 8 files. Output captured for the archive.

### Task M61-D5-T2 — Delete proof/benchmark/probe scripts
- **Touches** (delete): `bin/m44-proof-measure.cjs`, `bin/m46-iter-proof.cjs`, `bin/m46-worker-proof.cjs`, `bin/m55-substrate-proof.cjs`, `bin/gsd-t-benchmark-orchestrator.cjs`, `bin/gsd-t-parallel-probe.cjs`, `bin/gsd-t-ratelimit-probe.cjs`, `bin/gsd-t-ratelimit-probe-worker.cjs`
- **Touches** (edit): `bin/gsd-t.js` — remove `benchmark` / `parallel-probe` / `ratelimit-probe` subcommands if present
- **Contract refs**: NONE
- **Dependencies**: BLOCKED by T1
- **Acceptance**: Single commit removing all 8 files + bin/gsd-t.js subcommand entries. Suite green. `node bin/gsd-t.js --help` runs without referencing retired commands.

### Task M61-D5-T3 — Archive `.gsd-t/ratelimit-map.json`
- **Touches**: move `.gsd-t/ratelimit-map.json` → `.gsd-t/milestones/m61-platform-reconciliation-{date}/ratelimit-map-archive.json`
- **Contract refs**: NONE
- **Dependencies**: BLOCKED by T2
- **Acceptance**: Map preserved as historical artifact; live path no longer present. (Note: if verify-gate Track 2 still reads it, this task waits for D6-T3.)

## Execution Estimate
- Total tasks: 3
- Independent: 1 (T1)
- Blocked: 2

## Files Owned
- The 8 deletion targets, exclusively
- `bin/gsd-t.js` subcommand entries for retired surfaces only (file is shared with D1/D2/D3/D4 — sequenced at integrate)
