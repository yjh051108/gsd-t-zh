# Domain: m85-d2-bin-consumers-alias-selector

## Responsibility
The two `bin/` CONSUMER files that resolve/document tiers, plus the model-selector test. Fixes the live STALE alias map in `bin/gsd-t-parallel.cjs` (the `opus → claude-opus-4-7` correctness bug), adds the FABLE tier + escalation ladder to `bin/model-selector.js`, and reconciles the matching test — all sourced from the policy contract's published constants, write-disjoint from the policy module and from all workflows.

## Owned Files/Directories
- `bin/gsd-t-parallel.cjs` — fix the stale alias map (line ~585): `opus: "claude-opus-4-7"` → `claude-opus-4-8`; add `fable: "claude-fable-5"`. Source the id strings from the policy contract's published constants (do not re-hardcode the rationale).
- `bin/model-selector.js` — add the `FABLE` tier to the `TIERS` enum + the updated escalation ladder (cycle-1 `opus` → cycle-2 `fable` → needs-human). `haiku`/`sonnet` bottom-of-ladder UNCHANGED. Reconcile concrete ids to the policy module.
- `test/model-selector.test.js` — update for the new tier + ladder (assert FABLE tier exists, assert escalation ladder cycle-2 is fable, assert haiku/sonnet bottom unchanged).

## NOT Owned (do not modify)
- `bin/gsd-t-model-tier-policy.cjs` — owned by m85-d1-tier-policy-module (read/import its constants only)
- `.gsd-t/contracts/model-tier-policy-contract.md` — owned by m85-d1-tier-policy-module (consume the published constants)
- `templates/workflows/*.workflow.js` — owned by m85-d3-workflow-fable-assignments
- `test/m85-workflow-tier-policy-lint.test.js` — owned by m85-d4-lint-shadow-docs
- All docs, `model-selection-contract.md`, `.gsd-t/progress.md` — owned by m85-d4-lint-shadow-docs

## Files Owned
- `bin/gsd-t-parallel.cjs`
- `bin/model-selector.js`
- `test/model-selector.test.js`
