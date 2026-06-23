# Constraints: m86-d3-drift-lint-unwrap-guard

## Hard Invariants

- **Highest consequence — fail-closed.** A bug here silently disables fleet-wide tier-drift
  protection. The lint MUST fail-closed: an unrecognized `model:` form is a FAILURE, never a
  silent skip. If the extractor can't parse a line carrying `model:`, that line FAILS the lint.
- **Both forms guarded.** After M86, a designated stage may be EITHER a bare literal (none should
  remain after D2, but the guard must still bite them) OR the `??` form. The lint validates:
  - bare literal → must be in the tier set + match the stage policy.
  - `??` form → the FALLBACK literal must be in the tier set + equal the premium-active tier.
- **Mandatory negative tests.** Three negatives are non-negotiable (drifted bare, drifted
  fallback, out-of-tier fallback). A green suite with no negative coverage is a FAILED domain.
- **Non-empty match.** The lint MUST assert it actually matched ≥1 `model:` line per designated
  stage — a regex that silently matches zero lines (so "passes" vacuously) is the failure mode
  this guard exists to prevent. Keep/extend the M85 non-empty-match meta-assertion.
- **Read-only on workflows.** This domain READS `templates/workflows/*.workflow.js` exactly as
  the M85 lint already does. It NEVER writes them.

## File-Disjointness (re-validated by partition oracle)

- This domain WRITES ONLY: `test/m85-workflow-tier-policy-lint.test.js`,
  `test/m86-lint-unwrap-fallback.test.js`.
- Write-disjoint from D2 (which owns the workflow source). This is the deliberate quarantine:
  the guard and the guarded never share a file, so neither can mask the other.
- Does NOT touch D1's unit tests (`test/m86-policy-profiles.test.js`).

## Pre-Commit Gate (domain-specific)

- Test changed → run `node --test test/m85-workflow-tier-policy-lint.test.js
  test/m86-lint-unwrap-fallback.test.js` and confirm: real workflows pass, all three negatives
  FAIL as designed (asserted via expected-throw / fixture harness), non-empty-match holds.
- Lint must pass against D2's actual edited workflows (cross-domain integration check at verify).
