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
  - **Import-time export assertion (M100 pre-mortem FINDING 3, HIGH)**: at import/require time, asserts the consumed `checkEnvelope` export from `gsd-t-logging-envelope-check.cjs` EXISTS and is a `function` before any call site uses it — fails loudly at load time rather than a cryptic `TypeError` mid-write if d3's export shape drifts.
  - **Immutability-bypass killing sub-cases (M100 pre-mortem FINDING 4, HIGH)**: (i) attempt an UPDATE and a DELETE through the EXACT write-helper/connection object the audit module itself exposes (not a raw side-channel db handle) — BOTH rejected; (ii) attempt to DROP or replace the immutability trigger/constraint and then UPDATE the row — either the DROP/replace attempt is itself blocked, OR retention-prune (`prune_expired()`) is the ONLY sanctioned deletion path and it refuses to touch non-expired rows; (iii) prove `prune_expired()` deletes ONLY window-expired rows — insert one expired-window row and one live row, run `prune_expired()`, assert the expired row is gone and the live row survives — AND that it cannot be coerced via a config value (e.g. a negative/zero/malicious retention-window override) into deleting the live row.
  - **Standalone admin query surface killing sub-case (M100 pre-mortem FINDING, MEDIUM — capability built but the caller acting on it is never tested)**: assert the audit query surface is reachable as a standalone admin entry independent of the GSD-T CLI: instantiate ONLY the scaffolded audit module (as a project would after GSD-T is uninstalled), invoke its documented admin query entry point (exported function / generated CLI / route handler per `audit-logging-contract.md` §Admin query surface), and assert it returns the actor/target/time-filtered rows. If no such GSD-T-independent entry point exists, the test — and criterion #8 — FAIL.
- **ImplPath**: `appendAudit(entry)` inserts into an INSERT-only SQLite table (triggers/permissions reject UPDATE/DELETE); `queryAudit({actor,target,since,until})` reads the queryable surface; retention read from config, never a literal. Immutability is enforced at the store (trigger/permission), not merely by omitting an API method, and the trigger/constraint itself resists being dropped or bypassed via the exposed connection; `prune_expired()` is config-driven but bounds-checked so no config value can prune a non-expired row. The audit module template EXPORTS a GSD-T-independent admin query entry point (exported function / generated CLI / route handler) wrapping `queryAudit`, reachable and usable by the project's own admin tooling with no GSD-T toolchain present.
- **Acceptance criteria**:
  - Write helper exposes NO update/delete; store rejects UPDATE/DELETE of an existing entry against real embedded SQLite (M100 #7).
  - Admin query surface filters by actor/target/time (#8).
  - Admin query surface is reachable as a standalone, GSD-T-independent admin entry point — proven by the standalone admin query surface killing sub-case above.
  - Retention configurable + extendable, not hardcoded (#9).
  - `checkEnvelope` import-time existence asserted before use.
  - Immutability trigger resists drop/replace-then-UPDATE; `prune_expired()` deletes ONLY expired rows and cannot be coerced (via config) into deleting a live row.
  - See M100-D5-T2d for the integration proof that d3's real durability gate PASSES this ACTUAL shipped template (and FAILS a mutated copy exposing update/delete or hardcoded retention).

### M100-D4-T2: Audit-half action distiller + opt-out convention
- **Touches**: `bin/gsd-t-audit-distill.cjs`, `test/m100-d4-audit-machinery.test.js`
- **Files**: `bin/gsd-t-audit-distill.cjs` (per-project ACTION distiller + opt-out record convention)
- **Contract refs**: `logging-schema-distillation-contract.md`, `audit-logging-contract.md`
- **Dependencies**: Requires M100-D4-T1
- **Test**: `test/m100-d4-audit-machinery.test.js` — given a fixture plan, asserts the distiller emits the plan's ACTUAL audit actions and invents none (no-confabulation falsifier); asserts a valid opt-out record is produced/recognized by the convention; asserts the source file path differs from the trace distiller (`gsd-t-trace-distill.cjs`) — no-collapse by construction.
  - **Empty-distill lower-bound killing sub-cases (M100 pre-mortem FINDING 4, MEDIUM)**: (a) NON-EMPTY real-plan lower bound — running `distillAuditActions(planPath)` against UMI-Automation's REAL `docs/plan.md` returns `actions.length > 0` and the set INCLUDES the PodCoach draft-approval action (grep-traceable to the plan's review→edit→approve clause); a run returning zero actions against this real plan FAILS the test. (b) Empty-input pole — given a plan fixture with NO accountability-worthy actions, `distillAuditActions` returns `{ actions: [] }` (empty array, not an error, not a confabulated placeholder); a downstream consumer asserting `actions.length > 0` on THIS empty-plan fixture must FAIL LOUDLY (an explicit assertion failure), never silently pass or silently skip.
- **ImplPath**: `distillAuditActions(planPath)` extracts accountability-worthy actions grounded in the plan; `writeOptOut(projectDir)` emits the opt-out record the gate recognizes.
- **Acceptance criteria**:
  - Distills concrete audit ACTIONS from the project plan; never confabulates (#14).
  - Ships the opt-out record convention (#13).
  - Shares NO file with the trace distiller (no-collapse).
  - Opt-out record shape per `audit-logging-contract.md` §opt-out-record — writer side of the seam; see M100-D5-T2c for the shared-fixture integration proof against d3's real reader.
  - Non-empty lower bound proven against UMI's real plan (PodCoach draft-approval present); empty-input pole returns `[]` and a downstream zero-actions assertion fails loudly, not silently.

## Execution Estimate
- Total tasks: 2
- Independent tasks: 0 (both blocked on Wave-1 seams)
- Blocked tasks: 1 (M100-D4-T1 on d1 T3 + d3 T3)
- Estimated checkpoints: 1 (Wave-2 concurrent with d2)
