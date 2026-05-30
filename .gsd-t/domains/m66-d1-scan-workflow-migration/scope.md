# Domain: m66-d1-scan-workflow-migration

## Mission
Migrate `/gsd-t-scan` from improvised 29KB prose (hard-capped at 5 teammates, zero volume scaling, dead `autoSpawnHeadless`/`headless-default-contract v2.0.0` refs) to a native volume-scaled Workflow so scan depth auto-scales with codebase volume on every invocation.

## Files Owned
- `templates/workflows/gsd-t-scan.workflow.js` (NEW — the brain)
- `commands/gsd-t-scan.md` (REWRITE → thin invoker)
- `GSD-T-README.md` (scan-as-workflow doc-ripple)
- `README.md` (scan-as-workflow doc-ripple)
- `templates/CLAUDE-global.md` (workflow list doc-ripple)
- `commands/gsd-t-help.md` (scan listing)
- `package.json` (patch bump 4.0.12 → 4.0.13)
- `.gsd-t/progress.md` (decision log + milestone state)
- `.gsd-t/m66-hilo-deep-scan-reference.md` (reference artifact, already copied)

## NOT Owned (do not touch)
- `bin/scan-*.js` — deterministic stages (schema/diagrams/HTML report) — INVOKED by the new workflow, unchanged.
- The other 7 `*.workflow.js` — referenced as pattern, not edited.
- `_lib.js` — used as-is.

## Single sequential domain
Tightly coupled (workflow + its invoker + doc-ripple are interdependent). No parallel fan-out. Build → rewrite invoker → doc-ripple → verify.
