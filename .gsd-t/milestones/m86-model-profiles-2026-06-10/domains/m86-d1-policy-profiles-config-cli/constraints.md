# Constraints: m86-d1-policy-profiles-config-cli

## Hard Invariants

- **Additive only.** The M85 v1.0.0 STABLE constants (`MODEL_IDS`, `STAGE_TIERS`,
  `requiresThinkingOmitted`, `resolve`) MUST stay byte-functionally unchanged. The profile
  dimension is a SECOND axis layered on top — never a mutation of the M85 surface. Existing
  M85 tests must still pass.
- **Zero external runtime deps.** Both `gsd-t-model-tier-policy.cjs` and the new
  `gsd-t-model-profile.cjs` use pure Node built-ins only (installer-package invariant).
- **No top-level side effects** in either module (require-safe).
- **Producers HELD opus** in every profile (M82 judge-blindness invariant). No profile may
  ever map `competition-producers` to fable.
- **No silent degradation (SC(f)).** When `.gsd-t/model-profile.json` is absent, the global
  default applies and is NAMED in the resolve envelope. Never an implicit unsurfaced fallback.
- **Bottom of the ladder untouched.** `haiku` / `sonnet` mechanical/default tiers unchanged
  except where a profile explicitly remaps a designated stage (e.g. standard judge→sonnet).

## File-Disjointness (re-validated by partition oracle)

- This domain WRITES ONLY: `bin/gsd-t-model-tier-policy.cjs`, `bin/gsd-t-model-profile.cjs`,
  `bin/gsd-t.js`, `.gsd-t/contracts/model-tier-policy-contract.md`,
  `.gsd-t/contracts/model-profile-config-contract.md` (the seam contract — added at
  plan-hardening c2 #3; T4 amends it before the DRAFT→STABLE flip),
  `test/m86-policy-profiles.test.js`.
- It is the ONLY domain that touches `bin/`, the config schema, and the two contracts.
- It does NOT touch `templates/workflows/`, the drift lint, `scripts/`, or any doc/README.

## Risk Containment

- The highest-risk internal logic (override-beats-profile precedence) lives HERE behind the
  envelope. Consumers never depend on it directly — they consume the resolved `overrides` map.
- `bin/gsd-t.js` is a shared high-traffic file: keep the `model-profile` case THIN — mirror the
  existing `model-tier-policy` dispatch case; delegate all logic to `gsd-t-model-profile.cjs`.

## Pre-Commit Gate (domain-specific)

- New CLI command → update help/README is D4's job; D1 ONLY adds the dispatch + propagation
  entries. Do NOT edit README/help here (that is D4's blast radius).
- Contract changed → this IS the contract bump (v1.1.0 additive). Update consumer list to add
  the profile-aware resolve surface.
- New bin file → MUST appear in BOTH `GLOBAL_BIN_TOOLS` and `PROJECT_BIN_TOOLS`.
