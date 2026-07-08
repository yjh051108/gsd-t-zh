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
  - **No-collapse killing sub-cases (M100 pre-mortem FINDING 1, CRITICAL)**: (g1) a VALID trace record with `decision:null` and NO `before`/`after` keys PASSES no-collapse; (g2) a VALID audit record whose `context` object legitimately contains a key named `decision` AND a key named `before` PASSES no-collapse (proves the detector keys on the TOP-LEVEL marker set / record shape, NOT a substring/key-name scan of `context`); (g3) a genuinely collapsed record — trace-shaped (`category`+`decision` present) that ALSO carries TOP-LEVEL `before`/`after` — FAILS.
  - **Null-vs-absent killing sub-cases (M100 pre-mortem FINDING 2, CRITICAL)**: (h1) audit record with `before:null, after:{...}` (create) PASSES; (h2) audit record with `before:{...}, after:null` (delete) PASSES; (h3) audit record with the `before` KEY OMITTED entirely FAILS; (h4) trace record with `decision:null` (key present, value null) PASSES; (h5) trace record with the `decision` KEY OMITTED entirely FAILS. The predicate must test key-presence (`hasOwnProperty`/`in`) SEPARATELY from value-nullability — never via truthiness (`if (record.decision)` is banned; `null` and `undefined`/absent are different states).
  - **Nested-PII recursion killing sub-cases (M100 pre-mortem FINDING 6, MEDIUM)**: (a) a NESTED email at `data.a.b.email` is REJECTED (proves the PII scanner recurses into nested `data`/`context` objects, not just top-level fields); (b) no-false-positive cases PASS: a legit 10+ digit numeric key/request-id value, and an internal id string that contains `'@'` but is not a real email both PASS; (c) a phone-shaped value and a postal-address-shaped value nested at depth >= 2 are both REJECTED.
- **ImplPath**: `checkEnvelope(record, {stream})` validates required-key presence + JS type per contract table, scans field values against a PII shape matcher, and rejects a record carrying BOTH a trace-marker (`decision`) and audit-markers (`before`/`after`) — the no-collapse boundary. Zero hardcoded category/action literals. The no-collapse detector keys on the TOP-LEVEL marker set (record shape) per `logging-verify-gate-contract.md` — it MUST NOT be a key-name scan of nested `context`/`data` objects, since a legitimate audit `context` payload may itself contain keys literally named `decision` or `before`. Key-presence checks (for null-vs-absent) use `Object.prototype.hasOwnProperty.call(record, key)` / the `in` operator, never a truthiness/falsy check on the value.
- **Acceptance criteria**:
  - Valid trace + audit envelopes PASS; missing-field / wrong-type FAIL (M100 #3–4).
  - PII-in-trace FAILS (#5); novel category/action PASSES (structural, never hardcoded).
  - Collapsed single-stream FAILS — no-collapse (#6); no-collapse keys on TOP-LEVEL marker set, never a nested-context key-name scan (g1–g3).
  - Null-vs-absent: null values on `decision`/`before`/`after` PASS when the key is present; FAIL when the key is omitted (h1–h5).

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
  - Opt-out record shape per `audit-logging-contract.md` §opt-out-record — reader side of the seam; see M100-D5-T2c for the shared-fixture integration proof against d4's real writer.
  - See M100-D5-T2d for the integration proof that this durability gate PASSES d4's REAL shipped `templates/logging/audit-module.template.ts` (and FAILS a mutated copy), not just synthetic fixtures.

### M100-D3-T3: Register into the verify gate (FAIL-CLOSED, one line)
- **Touches**: `bin/gsd-t-verify-gate.cjs`, `commands/gsd-t-verify.md`
- **Files**: `bin/gsd-t-verify-gate.cjs` (exactly ONE registration line), `commands/gsd-t-verify.md` (document the check)
- **Contract refs**: `logging-verify-gate-contract.md`
- **Dependencies**: Requires M100-D3-T2
- **Test**: `test/m100-d3-envelope-gate.test.js` — asserts the predicate is invoked by the verify gate and that a failing envelope produces a non-zero / blocking result (FAIL-CLOSED, never warn-and-proceed); asserts exactly ONE registration line references `gsd-t-logging-envelope-check.cjs` in `bin/gsd-t-verify-gate.cjs`.
  - **Exported-surface killing sub-case (M100 pre-mortem FINDING 3, HIGH)**: asserts `require('bin/gsd-t-logging-envelope-check.cjs').checkEnvelope` is a `function` (`typeof === "function"`) with the documented arity — 2 declared parameters, `(record, {stream})` — so d2/d4 consumers fail loudly at import time rather than at first call if the export shape ever drifts.
- **ImplPath**: one `require(...)` + registration entry wiring `checkEnvelope` into the gate's check list; the gate halts on failure per the envelope contracts' Enforcement sections.
- **Acceptance criteria**:
  - Exactly ONE registration line added to `bin/gsd-t-verify-gate.cjs`; the check runs FAIL-CLOSED.
  - `commands/gsd-t-verify.md` documents the new logging envelope check.
  - `checkEnvelope` export is a documented-arity `function` — (record, {stream}) — proven by test, not assumed by consumers.

## Execution Estimate
- Total tasks: 3
- Independent tasks: 1 (M100-D3-T1)
- Blocked tasks: 0 (intra-domain sequence only)
- Estimated checkpoints: 1 (Wave-1 spike gate)
