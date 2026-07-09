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
  - **Import-time export assertion (M100 pre-mortem FINDING 3, HIGH)**: at import/require time, asserts the consumed `checkEnvelope` export from `gsd-t-logging-envelope-check.cjs` EXISTS and is a `function` before any call site uses it — fails loudly at load time rather than surfacing as a cryptic `TypeError` mid-emit if d3's export shape drifts.
  - **Nested-PII recursion killing sub-cases (M100 pre-mortem FINDING 6, MEDIUM)**: (a) a NESTED email at `data.a.b.email` is REJECTED (proves the PII scanner recurses into nested `data` objects, not just top-level fields); (b) no-false-positive cases PASS: a legit 10+ digit numeric key/request-id value, and an internal id string that contains `'@'` but is not a real email (e.g. `user@internal-id-7f3a`-shaped non-email token) both PASS; (c) a phone-shaped value and a postal-address-shaped value nested at depth >= 2 (e.g. `data.a.phone`, `data.a.address`) are both REJECTED.
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
  - **Empty-distill lower-bound killing sub-cases (M100 pre-mortem FINDING 4, MEDIUM)**: (a) NON-EMPTY real-plan lower bound — running `distillTraceCategories(planPath)` against UMI-Automation's REAL `docs/plan.md` returns `categories.length > 0` and the set INCLUDES at least the Grain, Airtable, Anthropic, and Apify integration-point categories, each grep-traceable to a source line in that plan; a run returning zero categories against this real plan FAILS the test. (b) Empty-input pole — given a plan fixture with NO trace-worthy operations, `distillTraceCategories` returns `{ categories: [] }` (empty array, not an error, not a confabulated placeholder); a downstream consumer asserting `categories.length > 0` on THIS empty-plan fixture must FAIL LOUDLY (an explicit assertion failure), never silently pass or silently skip — proving the empty case is distinguishable from a broken distiller.
- **ImplPath**: `distillTraceCategories(planPath)` parses the project plan for concrete trace-worthy operations and returns `{ categories: [...] }` grounded in plan text.
- **Acceptance criteria**:
  - Distills concrete trace CATEGORIES from the project plan; never confabulates (#14).
  - Emits categories as data — never baked into the envelope gate.
  - Shares NO file with the audit distiller (no-collapse).
  - Non-empty lower bound proven against UMI's real plan (Grain/Airtable/Anthropic/Apify present); empty-input pole returns `[]` and a downstream zero-categories assertion fails loudly, not silently.

## Execution Estimate
- Total tasks: 2
- Independent tasks: 0 (both blocked on Wave-1 seams)
- Blocked tasks: 1 (M100-D2-T1 on d1 T3 + d3 T3)
- Estimated checkpoints: 1 (Wave-2 concurrent with d4)
