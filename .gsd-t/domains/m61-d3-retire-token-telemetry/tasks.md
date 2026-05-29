# Tasks: m61-d3-retire-token-telemetry

## Summary
Delete token-capture / dashboard / attribution / capture-lint stack. Wave 3, parallel with D1/D2/D4.

## Tasks

### Task M61-D3-T1 — Zero-reference gate
- **Touches**: writes `.gsd-t/scan/m61-d3-zero-ref-verify.txt`
- **Contract refs**: NONE
- **Dependencies**: BLOCKED by D7-T2 (OBSERVABILITY blocks must be gone first)
- **Acceptance**: `grep -rn "require.*gsd-t-token-capture\|captureSpawn\|recordSpawnRow\|gsd-t-tool-attribution\|gsd-t-tool-cost\|gsd-t-economics\|gsd-t-capture-lint\|metrics-collector\|metrics-rollup" --include='*.js' --include='*.cjs' --include='*.md' .` returns only D3-owned files about to be deleted (or zero hits if any have already been removed in earlier tasks).

### Task M61-D3-T2 — Archive `.gsd-t/token-log.md` and `.gsd-t/metrics/`
- **Touches**: move `.gsd-t/token-log.md` → `.gsd-t/milestones/m61-platform-reconciliation-{date}/token-log-archive.md`; same for `.gsd-t/metrics/` directory
- **Contract refs**: NONE
- **Dependencies**: BLOCKED by T1
- **Acceptance**: Historical telemetry preserved under the milestone archive. Live paths no longer present.

### Task M61-D3-T3 — Delete token-telemetry files + hook + capture-lint
- **Touches** (delete): `bin/gsd-t-token-capture.cjs`, `bin/gsd-t-token-dashboard.cjs`, `bin/gsd-t-token-backfill.cjs`, `bin/gsd-t-regenerate-log.cjs`, `bin/gsd-t-report-tokens.cjs`, `bin/gsd-t-tool-attribution.cjs`, `bin/gsd-t-tool-cost.cjs`, `bin/gsd-t-in-session-usage.cjs`, `bin/gsd-t-economics.cjs`, `bin/metrics-collector.cjs`, `bin/metrics-rollup.cjs`, `bin/gsd-t-capture-lint.cjs`, `scripts/hooks/gsd-t-in-session-usage-hook.js`, `.gsd-t/contracts/economics-estimator-contract.md`, `.gsd-t/contracts/metrics-schema-contract.md` (if scope is token-telemetry-only)
- **Touches** (edit): `~/.claude/settings.json` (remove in-session-usage hook entry only); `bin/gsd-t.js` (remove `token-dashboard` / `backfill` / `regenerate-log` / `report-tokens` / `tool-attribution` / `tool-cost` / `economics` / `capture-lint` subcommands); `scripts/hooks/pre-commit-capture-lint` if it exists (remove)
- **Contract refs**: all of the above (about to be deleted)
- **Dependencies**: BLOCKED by T2
- **Acceptance**: Suite green. `node bin/gsd-t.js --help` shows no retired subcommands. settings.json valid JSON.

## Execution Estimate
- Total tasks: 3
- Independent: 0
- Blocked: 3

## Files Owned
- All deletion targets exclusively
- `~/.claude/settings.json` in-session-usage hook entry (shared with D1/D4; sequenced at integrate)
- `bin/gsd-t.js` token-telemetry subcommands (shared file; sequenced)
- `.gsd-t/token-log.md` archive move
