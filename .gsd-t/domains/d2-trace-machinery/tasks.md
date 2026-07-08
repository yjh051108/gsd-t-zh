# Tasks: d2-trace-machinery

## Summary
Delivers the framework-default trace module template + the trace-half category distiller, file-disjoint from audit, consuming d1's seam and passing d3's gate.

## Tasks

### Task 1: Trace module template — emitter + dual toggle + PII bar
- **Files**: `templates/logging/trace-module.template.ts`, `test/m100-d2-trace-machinery.test.js`
- **Contract refs**: `trace-logging-contract.md`, `logging-scaffold-seam-contract.md`
- **Dependencies**: BLOCKED by d1 Task 3 (seam) + d3 Task 3 (gate)
- **Acceptance criteria**:
  - Fire-and-forget emitter never throws into the caller (M100 acceptance re trace-fire-and-forget).
  - `setTraceEnabled()`/`isTraceEnabled()` + `TRACE=1` both work (#2, #15).
  - PII-shaped field rejected (#5); dormant-OR-local-file transport via d1's seam.

### Task 2: Trace-half category distiller
- **Files**: `bin/gsd-t-trace-distill.cjs`, `test/m100-d2-trace-machinery.test.js`
- **Contract refs**: `logging-schema-distillation-contract.md`, `trace-logging-contract.md`
- **Dependencies**: Requires Task 1
- **Acceptance criteria**:
  - Distills concrete trace CATEGORIES from the project plan; never confabulates (#14).
  - Emits categories as data — never baked into the envelope gate.
  - Shares NO file with the audit distiller (no-collapse).

## Execution Estimate
- Total tasks: 2
- Independent tasks: 0 (both blocked on Wave-1 seams)
- Blocked tasks: 1 (Task 1 on d1+d3)
- Estimated checkpoints: 1 (Wave-2 concurrent with d4)
