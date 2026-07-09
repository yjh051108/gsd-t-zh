# Domain: d4-audit-machinery

## Responsibility
TIER 2 audit stream DESIGNED FRESH (Wave 2 — runs CONCURRENTLY with d2-trace; file-disjoint). Builds the audit MODULE template scaffolded by d1: append-only IMMUTABLE write helper (no update/delete path in normal operation), configurable-extendable retention (not hardcoded), and the admin QUERY surface filterable by actor/target/time — proven against a real embedded SQLite store (the queryable no-server default the scaffolder flags). Ships the audit half of the per-project action distillation helper + the opt-out record convention. NEVER shares a file, module, template, or test with trace — mechanizing no-collapse.

## Files Owned
- `templates/logging/audit-module.template.ts`
- `bin/gsd-t-audit-distill.cjs`
- `test/m100-d4-audit-machinery.test.js`

## Owned Files/Directories
- `templates/logging/audit-module.template.ts` — the fresh-designed audit module template.
- `bin/gsd-t-audit-distill.cjs` — the audit-half per-project ACTION distiller + opt-out convention.
- `test/m100-d4-audit-machinery.test.js` — append-only immutability (real SQLite), query surface filters, retention configurable.
- `.gsd-t/domains/d4-audit-machinery/{scope,constraints,tasks}.md`

## NOT Owned (do not modify)
- `templates/logging/trace-module.template.ts`, `bin/gsd-t-trace-distill.cjs` — owned by d2 (NEVER share a file/module/template/test with trace).
- `bin/gsd-t-logging-scaffolder.cjs`, `bin/gsd-t.js` — owned by d1 (consume the seam, do not edit).
- `bin/gsd-t-logging-envelope-check.cjs`, `bin/gsd-t-verify-gate.cjs` — owned by d3.
- `.gsd-t/contracts/logging-schema-distillation-contract.md` — owned by d5 (consume, do not edit).
