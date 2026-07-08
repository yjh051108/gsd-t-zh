# Tasks: d4-audit-machinery

## Summary
Delivers the fresh-designed audit module template (append-only IMMUTABLE, queryable, configurable retention) + the audit-half action distiller + opt-out convention, file-disjoint from trace, proven against real embedded SQLite. NEVER shares a file/module/template/test with trace (d2) — mechanizes no-collapse. DESIGNED FRESH — no inherited BinVoice model (BinVoice has no audit log).

## Wave
W2 — runs CONCURRENTLY with d2-trace (file-disjoint). Starts after the W1 seams (d1 T3 + d3 T3) are green.

## Tasks

### M100-D4-T1: Audit module template — append-only immutable + query surface (real SQLite)
- **Touches**: `templates/logging/audit-module.template.ts`, `test/m100-d4-audit-machinery.test.js`
- **Files**: `templates/logging/audit-module.template.ts` (append-only immutable write helper, admin query surface, configurable retention)
- **Contract refs**: `audit-logging-contract.md`, `logging-scaffold-seam-contract.md`
- **Dependencies**: BLOCKED by M100-D1-T3 (seam) + M100-D3-T3 (gate)
- **Test**: `test/m100-d4-audit-machinery.test.js` — **KILLING TEST (immutability, against REAL embedded SQLite)**: writes an audit entry to a real SQLite store, then proves the store REJECTS an UPDATE and a DELETE of that existing entry (immutability enforced at the store, not just by omitting the API); asserts the write helper exposes NO update/delete method; asserts the admin query surface filters by actor, by target, and by time window and returns the inserted row; asserts an emitted record passes d3's `checkEnvelope(record,{stream:"audit"})`.
- **ImplPath**: `appendAudit(entry)` inserts into an INSERT-only SQLite table (triggers/permissions reject UPDATE/DELETE); `queryAudit({actor,target,since,until})` reads the queryable surface; retention read from config, never a literal.
- **Acceptance criteria**:
  - Write helper exposes NO update/delete; store rejects UPDATE/DELETE of an existing entry against real embedded SQLite (M100 #7).
  - Admin query surface filters by actor/target/time (#8).
  - Retention configurable + extendable, not hardcoded (#9).

### M100-D4-T2: Audit-half action distiller + opt-out convention
- **Touches**: `bin/gsd-t-audit-distill.cjs`, `test/m100-d4-audit-machinery.test.js`
- **Files**: `bin/gsd-t-audit-distill.cjs` (per-project ACTION distiller + opt-out record convention)
- **Contract refs**: `logging-schema-distillation-contract.md`, `audit-logging-contract.md`
- **Dependencies**: Requires M100-D4-T1
- **Test**: `test/m100-d4-audit-machinery.test.js` — given a fixture plan, asserts the distiller emits the plan's ACTUAL audit actions and invents none (no-confabulation falsifier); asserts a valid opt-out record is produced/recognized by the convention; asserts the source file path differs from the trace distiller (`gsd-t-trace-distill.cjs`) — no-collapse by construction.
- **ImplPath**: `distillAuditActions(planPath)` extracts accountability-worthy actions grounded in the plan; `writeOptOut(projectDir)` emits the opt-out record the gate recognizes.
- **Acceptance criteria**:
  - Distills concrete audit ACTIONS from the project plan; never confabulates (#14).
  - Ships the opt-out record convention (#13).
  - Shares NO file with the trace distiller (no-collapse).

## Execution Estimate
- Total tasks: 2
- Independent tasks: 0 (both blocked on Wave-1 seams)
- Blocked tasks: 1 (M100-D4-T1 on d1 T3 + d3 T3)
- Estimated checkpoints: 1 (Wave-2 concurrent with d2)
