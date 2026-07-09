# Constraints: d4-audit-machinery

## Must Follow
- DESIGNED FRESH — no inherited BinVoice model, NO ⚠ Divergence flag (BinVoice has no audit log).
- Envelope per `audit-logging-contract.md`: `ts/actor/action/target/before/after/context` (all required; before/after may be `null`).
- Append-only IMMUTABLE: the write helper exposes NO update-existing / delete-existing path in normal operation; prove the store REJECTS an UPDATE/DELETE against a real embedded SQLite store.
- Admin query surface filterable by actor/target/time (the "look back without GSD-T" surface) — a store with no queryable surface FAILS.
- Retention configurable + extendable; NEVER hardcoded.
- Audit is a default for every project EXCEPT explicit opt-out — ship the opt-out record convention.
- Distill actions FROM the project plan — never confabulate (`feedback_no_confabulated_examples`).
- NEVER share a file, module, template, or test with trace (d2) — mechanizes no-collapse by construction.

## Must Not
- Modify files outside owned scope.
- Expose any edit/delete path on audit entries in normal operation (Destructive Action Guard spirit).
- Reuse an audit record as a trace entry, or route audit into the trace stream.
- Hardcode an action list or a retention window.

## Dependencies
- Depends on: d1 (storage seam — flags SQLite over flat file for queryability) + d3 (envelope gate must be green for audit).
- Depended on by: d5 (UMI pilot uses the audit module + audit distiller).
