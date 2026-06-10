# Domain: m85-d3-workflow-fable-assignments

## Responsibility
The five Fable stage assignments — edits to the `model:` literals across exactly the 3 affected workflow files, write-disjoint from all `bin/` and all `test`/docs. Owns the HARD INVARIANT that competition producers STAY opus while the judge MOVES to fable (M82 different-model blindness) — decided inside `gsd-t-phase.workflow.js` so it lives in exactly one place.

## Owned Files/Directories
- `templates/workflows/gsd-t-phase.workflow.js` — 4 edits: M84 solution-space probe (`model: "opus"` ~line 172) → fable; M84 partition probe (~line 198) → fable; subjective competition judge (~line 476, currently `"sonnet"` on disk) → fable; M83 pre-mortem (~line 656) → fable. Competition PRODUCERS (~line 432) STAY opus — the blindness invariant lives here.
- `templates/workflows/gsd-t-verify.workflow.js` — 1 edit: Red Team (~line 307) `model: "opus"` → fable; stays NON-SKIPPABLE on its new tier.
- `templates/workflows/gsd-t-debug.workflow.js` — 1 edit: cycle-2 escalation (~line 97) → fable (cycle-1 stays opus, then needs-human).

## NOT Owned (do not modify)
- `bin/gsd-t-model-tier-policy.cjs` — owned by m85-d1-tier-policy-module
- `.gsd-t/contracts/model-tier-policy-contract.md` — owned by m85-d1-tier-policy-module
- `bin/gsd-t-parallel.cjs`, `bin/model-selector.js`, `test/model-selector.test.js` — owned by m85-d2-bin-consumers-alias-selector
- `test/m85-workflow-tier-policy-lint.test.js` — owned by m85-d4-lint-shadow-docs (it READS these workflows read-only; it does not write them)
- All docs, `model-selection-contract.md`, `.gsd-t/progress.md` — owned by m85-d4-lint-shadow-docs
- The other 5 workflow files (`gsd-t-execute/wave/integrate/quick/scan`) — not in M85 scope; untouched.

## Files Owned
- `templates/workflows/gsd-t-phase.workflow.js`
- `templates/workflows/gsd-t-verify.workflow.js`
- `templates/workflows/gsd-t-debug.workflow.js`
