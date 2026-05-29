# Domain: m61-d3-retire-token-telemetry

## Responsibility
Delete the capture/attribution/dashboard loop M38 retrospectively admitted "never produced action," now covered by native `/usage`. Wave 3 (parallel with D1∥D2∥D4).

## Owned Files (delete)
- `bin/gsd-t-token-capture.cjs`
- `bin/gsd-t-token-dashboard.cjs`
- `bin/gsd-t-token-backfill.cjs`
- `bin/gsd-t-regenerate-log.cjs`
- `bin/gsd-t-report-tokens.cjs`
- `bin/gsd-t-tool-attribution.cjs`
- `bin/gsd-t-tool-cost.cjs`
- `bin/gsd-t-in-session-usage.cjs`
- `bin/gsd-t-economics.cjs`
- `bin/metrics-collector.cjs`
- `bin/metrics-rollup.cjs`
- `bin/gsd-t-capture-lint.cjs`
- `scripts/hooks/gsd-t-in-session-usage-hook.js`
- `.gsd-t/contracts/economics-estimator-contract.md`
- `.gsd-t/contracts/metrics-schema-contract.md` (if scope-limited to token capture)
- `.gsd-t/metrics/` runtime data cleanup (gitignored; user decides whether to archive)
- `.gsd-t/token-log.md` — STOP writing to it (file stays as historical record; can be archived under `.gsd-t/milestones/m61-*/`)

## Owned Files (edit)
- `bin/gsd-t.js` — remove `token-dashboard` / `backfill` / `regenerate-log` / `report-tokens` / `tool-attribution` / `tool-cost` / `economics` / `capture-lint` subcommands
- `scripts/hooks/pre-commit-capture-lint` (if exists) — remove
- All command files that contain the OBSERVABILITY LOGGING block (`gsd-t-execute.md`, `gsd-t-verify.md`, `gsd-t-integrate.md`, `gsd-t-debug.md`, `gsd-t-wave.md`, `gsd-t-quick.md`, `gsd-t-plan.md`, `gsd-t-prd.md`, `gsd-t-design-decompose.md`, `gsd-t-doc-ripple.md`, `gsd-t-help.md`, `gsd-t-visualize.md`, `gsd-t-unattended.md`) — remove the OBSERVABILITY LOGGING block + `captureSpawn`/`recordSpawnRow` references. Native Workflow `budget` replaces it.

## NOT Owned (do not modify)
- Native `/usage` invocations (these replace what we delete)
- Workflow scripts (D6 — they thread `budget` natively)
- D7 KEEP list (test-data-ledger, journey-coverage, etc.)

## Estimated LOC removed
~4,100 LOC + 1 hook + 1-2 contracts + 13 command-file OBSERVABILITY blocks

## Pre-deletion gate
- Wave 2 (D7 + de-wire commit) has removed all `captureSpawn` / `recordSpawnRow` calls from command files and bin/ scripts (except in D3-owned files about to be deleted)
- `grep -rn "require.*gsd-t-token-capture\|require.*captureSpawn\|require.*recordSpawnRow" --include='*.js' --include='*.cjs' --include='*.md' .` returns only D3-owned files
