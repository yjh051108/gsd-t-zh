# Domain: d2-trace-machinery

## Responsibility
TIER 2/4 trace stream (Wave 2 — runs CONCURRENTLY with d4-audit; file-disjoint). Builds the trace MODULE template scaffolded by d1: the fire-and-forget/never-throw emitter, the dual toggle (`setTraceEnabled()`/`isTraceEnabled()` runtime seam + `TRACE=1` env override), the PII-barred envelope emitter, and the dormant-OR-local-file transport (superseding BinVoice's client-batched-POST per the ⚠ Divergence flag). Ships the trace half of the per-project category distillation helper. NEVER shares a file, module, template, or test with audit — mechanizing no-collapse.

## Owned Files/Directories
- `templates/logging/trace-module.template.ts` — the framework-default trace module template.
- `bin/gsd-t-trace-distill.cjs` — the trace-half per-project CATEGORY distiller.
- `test/m100-d2-trace-machinery.test.js` — emitter never-throws, dual toggle, PII bar, dormant-or-local transport.
- `.gsd-t/domains/d2-trace-machinery/{scope,constraints,tasks}.md`

## NOT Owned (do not modify)
- `templates/logging/audit-module.template.ts`, `bin/gsd-t-audit-distill.cjs` — owned by d4 (NEVER share a file/module/template/test with audit).
- `bin/gsd-t-logging-scaffolder.cjs`, `bin/gsd-t.js` — owned by d1 (consume the seam, do not edit).
- `bin/gsd-t-logging-envelope-check.cjs`, `bin/gsd-t-verify-gate.cjs` — owned by d3.
- `.gsd-t/contracts/logging-schema-distillation-contract.md` — owned by d5 (consume, do not edit).
