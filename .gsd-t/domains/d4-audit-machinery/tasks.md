# Tasks: d4-audit-machinery

## Summary
Delivers the fresh-designed audit module template (append-only immutable, queryable, configurable retention) + the audit-half action distiller + opt-out convention, file-disjoint from trace, proven against real SQLite.

## Tasks

### Task 1: Audit module template — append-only immutable + query surface
- **Files**: `templates/logging/audit-module.template.ts`, `test/m100-d4-audit-machinery.test.js`
- **Contract refs**: `audit-logging-contract.md`, `logging-scaffold-seam-contract.md`
- **Dependencies**: BLOCKED by d1 Task 3 (seam) + d3 Task 3 (gate)
- **Acceptance criteria**:
  - Write helper exposes NO update/delete; store rejects UPDATE/DELETE of an existing entry against real embedded SQLite (M100 acceptance #7).
  - Admin query surface filters by actor/target/time (#8).
  - Retention configurable + extendable, not hardcoded (#9).

### Task 2: Audit-half action distiller + opt-out convention
- **Files**: `bin/gsd-t-audit-distill.cjs`, `test/m100-d4-audit-machinery.test.js`
- **Contract refs**: `logging-schema-distillation-contract.md`, `audit-logging-contract.md`
- **Dependencies**: Requires Task 1
- **Acceptance criteria**:
  - Distills concrete audit ACTIONS from the project plan; never confabulates (#14).
  - Ships the opt-out record convention (#13).
  - Shares NO file with the trace distiller (no-collapse).

## Execution Estimate
- Total tasks: 2
- Independent tasks: 0 (both blocked on Wave-1 seams)
- Blocked tasks: 1 (Task 1 on d1+d3)
- Estimated checkpoints: 1 (Wave-2 concurrent with d2)
