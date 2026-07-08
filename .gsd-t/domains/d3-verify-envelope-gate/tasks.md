# Tasks: d3-verify-envelope-gate

## Summary
Delivers the standalone structural envelope predicate + its single verify-gate registration, proven on synthetic envelopes in Wave 1 before any project wiring.

## Tasks

### Task 1: Wave-1 spike — structural predicate on synthetic envelopes
- **Files**: `bin/gsd-t-logging-envelope-check.cjs`, `test/m100-d3-envelope-gate.test.js`
- **Contract refs**: `logging-verify-gate-contract.md`, `trace-logging-contract.md`, `audit-logging-contract.md`
- **Dependencies**: NONE
- **Acceptance criteria**:
  - Valid trace + audit envelopes PASS; missing-field / wrong-type FAIL (M100 acceptance #3–4).
  - PII-in-trace FAILS (#5); novel category/action PASSES (structural, never hardcoded).
  - Collapsed single-stream (trace `decision` crossing into audit `before/after`) FAILS — no-collapse (#6).

### Task 2: Durability + default rules
- **Files**: `bin/gsd-t-logging-envelope-check.cjs`, `test/m100-d3-envelope-gate.test.js`
- **Contract refs**: `logging-verify-gate-contract.md`, `audit-logging-contract.md`
- **Dependencies**: Requires Task 1
- **Acceptance criteria**:
  - Append-only/immutability declaration checked (#7); retention-configurable checked (#9).
  - Audit-default-except-opt-out: no audit + no opt-out → FAIL; valid opt-out → PASS (#13).

### Task 3: Register into the verify gate
- **Files**: `bin/gsd-t-verify-gate.cjs`, `commands/gsd-t-verify.md`
- **Contract refs**: `logging-verify-gate-contract.md`
- **Dependencies**: Requires Task 2
- **Acceptance criteria**:
  - Exactly ONE registration line added to `bin/gsd-t-verify-gate.cjs`; the check runs FAIL-CLOSED.
  - `commands/gsd-t-verify.md` documents the new logging envelope check.

## Execution Estimate
- Total tasks: 3
- Independent tasks: 1 (Task 1)
- Blocked tasks: 0 (intra-domain sequence only)
- Estimated checkpoints: 1 (Wave-1 spike gate)
