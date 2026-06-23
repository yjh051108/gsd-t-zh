# Domain: m86-d3-drift-lint-unwrap-guard

**Milestone:** M86 — Model Profiles (standard/pro/premium tier-spend switch)
**Role:** QUARANTINED SAFETY NET — the single highest-consequence surface.

## Thesis

A regression here silently disables fleet-wide tier-drift protection. This domain extends the
M85 drift lint to UNWRAP the new `??` form and validate the fallback literal, plus mandatory
negative fixtures. It READS `templates/workflows/` (read-only, as the lint already does) but
WRITES ONLY under `test/` — write-disjoint from D2's workflow edits — so it independently
verifies D2 without sharing files. A defect in D2 cannot mask a defect in this guard, and
vice-versa.

## Owned Files (this domain WRITES these — no other domain may)

| File | Why |
|------|-----|
| `test/m85-workflow-tier-policy-lint.test.js` | Extend the model-literal extractor to UNWRAP the `??` form + validate the fallback. |
| `test/m86-lint-unwrap-fallback.test.js` | NEW — mandatory negative fixtures proving the lint bites both forms. |

## Deliverables

1. **Unwrap the `??` form** — extend the lint's model-literal extractor so it recognizes
   `model: overrides["<stage>"] ?? "<premium-literal>"` and validates the FALLBACK literal against
   the tier set + the designated-stage policy (premium = the fallback for every designated stage).
2. **Designated-stage assertions** — update discovery/assertion logic so the new `??` lines still
   match each stage's `labelPattern` (the lint maps each designated stage to its expected fallback).
3. **Mandatory negative fixtures** (in `test/m86-lint-unwrap-fallback.test.js`):
   - (i) a drifted BARE literal still FAILS (existing M85 invariant preserved).
   - (ii) a `??` form whose FALLBACK literal is drifted FAILS.
   - (iii) a `??` form with a fallback OUTSIDE the tier set FAILS.
4. **Preserve M85 invariants** — all existing M85 lint assertions still pass (the bare-literal
   producers line stays `opus`; bottom-ladder unchanged).

## NOT Owned (other domains)

- The workflow `??` forms themselves → D2 (this domain READS them read-only, never writes them).
- The policy module / config / contract → D1.
- Status/help/README/CLAUDE docs → D4.

## Dependencies

- **Inbound:** D2's `??` form shape (must match what this lint unwraps:
  `model: overrides["<stage>"] ?? "<premium-literal>"`) and D1's published tier set + designated-
  stage policy (the lint validates against the contract/policy module).
- This domain is the independent verifier of D2: if D2 ships a drifted fallback, this lint FAILS.
