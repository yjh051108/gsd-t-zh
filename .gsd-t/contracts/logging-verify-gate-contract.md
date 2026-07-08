# Logging Verify-Gate Contract

**Version:** 1.0.0 DRAFT (M100 partition)
**Owner:** d3-verify-envelope-gate
**Consumers:** `bin/gsd-t-verify-gate.cjs` (registration), d5-defaults-migration-pilot (the pilot must pass this gate).
**Milestone:** M100 — Universal Trace + Audit Logging (framework defaults).

---

## Purpose

Fixes the **predicate module** that `gsd-t-verify` runs to enforce BOTH logging envelopes over PER-PROJECT-VARYING schemas. The predicate lives in a standalone module (`bin/gsd-t-logging-envelope-check.cjs`) so the ONLY touch to `bin/gsd-t-verify-gate.cjs` is one registration edit owned solely by d3.

## The predicate: what d3 produces

`bin/gsd-t-logging-envelope-check.cjs` exposes:

```
checkLoggingEnvelopes({ projectDir }) -> {
  ok: boolean,
  failures: Array<{ rule, stream, detail }>   // [] when ok
}
```

## Enforced checks (STRUCTURAL — never hardcode a category/action)

| Check | Stream | Rule |
|-------|--------|------|
| Required trace fields present + typed (`ts`/`category`/`decision`/`detail`; optional typed `key`/`status`/`data`) | trace | `trace-envelope-structural` |
| Required audit fields present + typed (`ts`/`actor`/`action`/`target`/`before`/`after`/`context`) | audit | `audit-envelope-structural` |
| PII bar — reject email/phone/postal-address-shaped field anywhere incl. `data` | trace | `trace-pii-barred` |
| Append-only / immutability DECLARED (no update/delete path in normal operation) | audit | `audit-append-only-immutable` |
| Retention configurable / not hardcoded | audit | `audit-retention-configurable` |
| Audit-default-except-opt-out (no audit + no opt-out record → FAIL; valid opt-out → PASS) | audit | `audit-default-except-optout` |
| No-collapse — a trace-marker `decision` and an audit-marker `before/after` MUST NOT cross streams | both | `no-collapse` |

- **Never hardcode a category/action value** — a novel `category`/`action` PASSES (`feedback_coverage_check_structural_not_substring`). The gate checks presence + type + stream boundary, structurally, parsing shape as shape, never `text.includes(value)`.

## Registration boundary

- d3 is the SOLE editor of `bin/gsd-t-verify-gate.cjs` for M100 — exactly one line registering `checkLoggingEnvelopes` into the gate's check list.
- The gate runs FAIL-CLOSED on any failure per the envelope contracts' Enforcement sections.

## Consumed contracts

- [`trace-logging-contract.md`](trace-logging-contract.md) §Required trace-entry envelope + §PII bar + §Enforcement.
- [`audit-logging-contract.md`](audit-logging-contract.md) §Required audit-entry envelope + §Append-only + §Retention + §Default+opt-out + §Enforcement.
