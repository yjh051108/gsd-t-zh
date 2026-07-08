# Tasks: d2-trace-machinery

## Summary
Delivers the framework-default trace module template + the trace-half category distiller, file-disjoint from audit, consuming d1's seam and passing d3's gate. NEVER shares a file/module/template/test with audit (d4) — mechanizes no-collapse.

## Wave
W2 — runs CONCURRENTLY with d4-audit (file-disjoint). Starts after the W1 seams (d1 T3 + d3 T3) are green.

## Tasks

### M100-D2-T1: Trace module template — emitter + dual toggle + PII bar
- **Touches**: `templates/logging/trace-module.template.ts`, `test/m100-d2-trace-machinery.test.js`
- **Files**: `templates/logging/trace-module.template.ts` (fire-and-forget emitter, `setTraceEnabled()`/`isTraceEnabled()` + `TRACE=1`, PII-barred envelope, dormant-OR-local-file transport via d1's seam)
- **Contract refs**: `trace-logging-contract.md`, `logging-scaffold-seam-contract.md`
- **Dependencies**: BLOCKED by M100-D1-T3 (seam) + M100-D3-T3 (gate)
- **Test**: `test/m100-d2-trace-machinery.test.js` — asserts: the emitter given a throwing sink still returns normally (fire-and-forget never throws into the caller); with trace disabled (`setTraceEnabled(false)` and no `TRACE=1`) nothing is written, with either toggle on it writes; a PII-shaped value in any field (incl. `data`) is rejected; the emitted record passes d3's `checkEnvelope(record,{stream:"trace"})`; transport routes to d1's `traceSink` (dormant or local file), never a client-batched POST.
- **ImplPath**: `emitTrace(entry)` wraps the sink write in a try/catch that swallows errors; toggle gate short-circuits when disabled; envelope builder enforces `ts/category/decision/detail` + optional `key/status/data` and rejects PII shapes; sink resolved from the d1 seam envelope.
- **Acceptance criteria**:
  - Fire-and-forget emitter never throws into the caller (M100 trace-fire-and-forget).
  - `setTraceEnabled()`/`isTraceEnabled()` + `TRACE=1` both work (#2, #15).
  - PII-shaped field rejected (#5); dormant-OR-local-file transport via d1's seam.

### M100-D2-T2: Trace-half category distiller
- **Touches**: `bin/gsd-t-trace-distill.cjs`, `test/m100-d2-trace-machinery.test.js`
- **Files**: `bin/gsd-t-trace-distill.cjs` (per-project CATEGORY distiller — emits categories as DATA, never baked into the gate)
- **Contract refs**: `logging-schema-distillation-contract.md`, `trace-logging-contract.md`
- **Dependencies**: Requires M100-D2-T1
- **Test**: `test/m100-d2-trace-machinery.test.js` — given a fixture project plan, asserts the distiller emits the plan's ACTUAL trace categories and does NOT invent categories absent from the plan (no-confabulation falsifier: a category with no plan source FAILS); asserts output is a data structure (not a literal baked into the envelope gate); asserts the source file path differs from the audit distiller (`gsd-t-audit-distill.cjs`) — no-collapse by construction.
- **ImplPath**: `distillTraceCategories(planPath)` parses the project plan for concrete trace-worthy operations and returns `{ categories: [...] }` grounded in plan text.
- **Acceptance criteria**:
  - Distills concrete trace CATEGORIES from the project plan; never confabulates (#14).
  - Emits categories as data — never baked into the envelope gate.
  - Shares NO file with the audit distiller (no-collapse).

## Execution Estimate
- Total tasks: 2
- Independent tasks: 0 (both blocked on Wave-1 seams)
- Blocked tasks: 1 (M100-D2-T1 on d1 T3 + d3 T3)
- Estimated checkpoints: 1 (Wave-2 concurrent with d4)
