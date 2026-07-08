# Tasks: d3-verify-envelope-gate

## Summary
Delivers the standalone STRUCTURAL envelope predicate (both trace + audit, PII bar, no-collapse, immutability, retention, opt-out) + its single verify-gate registration, proven on synthetic envelopes in Wave 1 (RISK-FIRST spike) before any project wiring. Sole M100 editor of `bin/gsd-t-verify-gate.cjs`.

## Wave
W1 — RISK-FIRST spike, runs CONCURRENTLY with d1. Highest-risk novel piece (the structural no-collapse / PII / immutability predicate over per-project-varying schemas). Must be green before W2 machinery (d2/d4) can be gated.

## Tasks

### M100-D3-T1: Wave-1 spike — structural predicate on synthetic envelopes
- **Touches**: `bin/gsd-t-logging-envelope-check.cjs`, `test/m100-d3-envelope-gate.test.js`
- **Files**: `bin/gsd-t-logging-envelope-check.cjs` (standalone structural predicate module — parses shape as shape, never `text.includes(value)`)
- **Contract refs**: `logging-verify-gate-contract.md`, `trace-logging-contract.md`, `audit-logging-contract.md`
- **Dependencies**: NONE (standalone Wave-1 spike)
- **Test**: `test/m100-d3-envelope-gate.test.js` — **KILLING TEST (highest-risk piece)**: a battery of synthetic envelopes — (a) valid trace `ts/category/decision/detail` PASSES, (b) valid audit `ts/actor/action/target/before/after/context` PASSES, (c) missing-field FAILS, (d) wrong-type FAILS, (e) PII-shaped value in any trace field (incl. `data`) FAILS, (f) a NOVEL category/action value PASSES (proves structural, never hardcoded), (g) a COLLAPSED single-stream record (trace `decision` marker co-present with audit `before/after` markers) FAILS. If (f) fails or (g) passes, the gate is broken.
- **ImplPath**: `checkEnvelope(record, {stream})` validates required-key presence + JS type per contract table, scans field values against a PII shape matcher, and rejects a record carrying BOTH a trace-marker (`decision`) and audit-markers (`before`/`after`) — the no-collapse boundary. Zero hardcoded category/action literals.
- **Acceptance criteria**:
  - Valid trace + audit envelopes PASS; missing-field / wrong-type FAIL (M100 #3–4).
  - PII-in-trace FAILS (#5); novel category/action PASSES (structural, never hardcoded).
  - Collapsed single-stream FAILS — no-collapse (#6).

### M100-D3-T2: Durability + default rules (immutability / retention / opt-out)
- **Touches**: `bin/gsd-t-logging-envelope-check.cjs`, `test/m100-d3-envelope-gate.test.js`
- **Files**: `bin/gsd-t-logging-envelope-check.cjs` (append-only + retention-configurable + audit-default-except-opt-out checks)
- **Contract refs**: `logging-verify-gate-contract.md`, `audit-logging-contract.md`
- **Dependencies**: Requires M100-D3-T1
- **Test**: `test/m100-d3-envelope-gate.test.js` — asserts: an audit module DECLARING append-only/immutability PASSES that check while one exposing an update/delete path FAILS (`audit-append-only-immutable`); a hardcoded retention window FAILS while a configurable one PASSES (`audit-retention-configurable`); a project with no audit AND no opt-out record FAILS, a project with a valid opt-out record PASSES (`audit-default-except-optout`).
- **ImplPath**: predicate reads the audit module's declared surface + project config; asserts absence of update/delete API in normal operation, presence of a configurable retention setting, and the audit-default-except-opt-out rule.
- **Acceptance criteria**:
  - Append-only/immutability declaration checked (#7); retention-configurable checked (#9).
  - Audit-default-except-opt-out: no audit + no opt-out → FAIL; valid opt-out → PASS (#13).

### M100-D3-T3: Register into the verify gate (FAIL-CLOSED, one line)
- **Touches**: `bin/gsd-t-verify-gate.cjs`, `commands/gsd-t-verify.md`
- **Files**: `bin/gsd-t-verify-gate.cjs` (exactly ONE registration line), `commands/gsd-t-verify.md` (document the check)
- **Contract refs**: `logging-verify-gate-contract.md`
- **Dependencies**: Requires M100-D3-T2
- **Test**: `test/m100-d3-envelope-gate.test.js` — asserts the predicate is invoked by the verify gate and that a failing envelope produces a non-zero / blocking result (FAIL-CLOSED, never warn-and-proceed); asserts exactly ONE registration line references `gsd-t-logging-envelope-check.cjs` in `bin/gsd-t-verify-gate.cjs`.
- **ImplPath**: one `require(...)` + registration entry wiring `checkEnvelope` into the gate's check list; the gate halts on failure per the envelope contracts' Enforcement sections.
- **Acceptance criteria**:
  - Exactly ONE registration line added to `bin/gsd-t-verify-gate.cjs`; the check runs FAIL-CLOSED.
  - `commands/gsd-t-verify.md` documents the new logging envelope check.

## Execution Estimate
- Total tasks: 3
- Independent tasks: 1 (M100-D3-T1)
- Blocked tasks: 0 (intra-domain sequence only)
- Estimated checkpoints: 1 (Wave-1 spike gate)
