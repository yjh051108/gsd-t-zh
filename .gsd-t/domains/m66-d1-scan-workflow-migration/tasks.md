# Tasks: m66-d1-scan-workflow-migration

## Tasks

### M66-D1-T1 — Build gsd-t-scan.workflow.js
**Touches**: `templates/workflows/gsd-t-scan.workflow.js`
Volume-probe (haiku) → derive per-area slice list from file/route/table/component counts → `pipeline(slices: deep-finder → single verify)` → archive prior register → synthesis (opus). Mirror execute/verify conventions. budget-aware depth. Depth target = Hilo reference (per-feature-domain slicing, ~100+ findings on a large repo, not 16).

### M66-D1-T2 — Rewrite commands/gsd-t-scan.md as thin invoker
**Touches**: `commands/gsd-t-scan.md`
Thin `Workflow({scriptPath, args})` invoker matching the other 7. Strip dead `autoSpawnHeadless`/`headless-default-contract v2.0.0`. Keep Document Ripple section. Args shape matches workflow meta.phases.

### M66-D1-T3 — Doc-ripple + version bump
**Touches**: `GSD-T-README.md`, `README.md`, `templates/CLAUDE-global.md`, `commands/gsd-t-help.md`, `package.json`, `.gsd-t/progress.md`
Scan now lists as the 8th workflow. Patch bump 4.0.12 → 4.0.13.

### M66-D1-T4 — Verify
**Touches**: (verification only)
`node --check` workflow, `npm test` (baseline 1267 pass / 0 fail / 4 skip — zero new regressions), verify-gate, orthogonal triad. Validate depth design vs Hilo reference.
