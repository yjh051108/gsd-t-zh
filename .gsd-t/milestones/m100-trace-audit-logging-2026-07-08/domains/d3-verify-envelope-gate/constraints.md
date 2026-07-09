# Constraints: d3-verify-envelope-gate

## Must Follow
- STRUCTURAL checks only — parse shape as shape; NEVER `text.includes(category/action)` (`feedback_coverage_check_structural_not_substring`). A novel category/action PASSES.
- Enforce BOTH envelopes (trace `ts/category/decision/detail` + audit `ts/actor/action/target/before/after/context`) + PII bar + append-only declaration + retention-configurable + audit-default-except-opt-out + no-collapse.
- No-collapse: a trace-marker `decision` and an audit-marker `before/after` MUST NOT cross streams — a collapsed single-stream impl FAILS.
- FAIL-CLOSED: any failure blocks; never warn-and-proceed (`feedback_no_silent_degradation`).
- Predicate in a standalone module; exactly ONE registration line in `bin/gsd-t-verify-gate.cjs`.
- Wave-1 spike: prove on synthetic envelopes (valid / missing-field / wrong-type / PII-in-trace / collapsed) BEFORE wiring into real projects.

## Must Not
- Modify files outside owned scope.
- Hardcode any category or action value in the gate.
- Add more than one line to `bin/gsd-t-verify-gate.cjs`.

## Dependencies
- Depends on: the two authored envelope contracts (`trace-logging-contract.md`, `audit-logging-contract.md`) — READ, not owned.
- Depended on by: d5 (the UMI pilot must pass this gate for both streams, no-collapse).
