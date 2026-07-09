# Constraints: d2-trace-machinery

## Must Follow
- Envelope per `trace-logging-contract.md`: `ts/category/decision/detail` (+ optional `key/status/data`).
- Emitter is fire-and-forget and NEVER throws into the calling app (a debug channel must never break the app).
- Dual toggle: `setTraceEnabled()`/`isTraceEnabled()` runtime seam AND `TRACE=1` env override (KEEP-plus-extend).
- PII bar: no buyer/end-user PII in any field incl. `data`.
- Transport: dormant OR local-file (SUPERSEDES BinVoice client-batched-POST — ⚠ Divergence flag in `PseudoCode-TraceLogging.md`); consumes d1's storage seam.
- Distill categories FROM the project plan — never confabulate (`feedback_no_confabulated_examples`).
- NEVER share a file, module, template, or test with audit (d4) — mechanizes no-collapse by construction.

## Must Not
- Modify files outside owned scope.
- Reuse a trace envelope as an audit record, or route trace into the audit stream.
- Hardcode a category list into the module or the gate.

## Dependencies
- Depends on: d1 (storage seam) + d3 (envelope gate must be green for trace) — both Wave-1-proven first.
- Depended on by: d5 (UMI pilot uses the trace module + trace distiller).
