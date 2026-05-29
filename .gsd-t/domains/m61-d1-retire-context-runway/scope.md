# Domain: m61-d1-retire-context-runway

## Responsibility
Delete the context-meter / runway machinery now obsoleted by native 1M context + `/context` + native compaction. Wave 3 (parallel with D2∥D3∥D4) — depends on Wave 1 (D6) + Wave 2 (D7) removing live consumers first.

## Owned Files (delete)
- `bin/token-budget.cjs`
- `bin/context-meter-config.cjs`
- `bin/context-meter-config.test.cjs`
- `bin/context-budget-audit.cjs`
- `bin/runway-estimator.cjs`
- `bin/model-windows.cjs`
- `bin/model-windows.test.cjs`
- `scripts/gsd-t-context-meter.js` (PostToolUse hook)
- `scripts/gsd-t-context-meter.e2e.test.js`
- `.gsd-t/.context-meter-state.json` plumbing (delete file + remove any writers)
- `.gsd-t/contracts/context-meter-contract.md`
- `.gsd-t/contracts/context-observability-contract.md` (if context-meter is its only consumer)

## Owned Files (edit — remove context-meter references only)
- `bin/gsd-t.js` — remove `doctor` checks that read meter state
- `commands/gsd.md` — remove ctx% routing logic
- `~/.claude/settings.json` — remove the PostToolUse context-meter hook entry

## NOT Owned (do not modify)
- Anything outside the context-meter/runway/window machinery
- Native Claude Code `/context` invocations (these stay; they replace what we delete)

## Estimated LOC removed
~1,580 LOC + 1 hook + 2 contracts

## Pre-deletion gate
Run `grep -r "require.*token-budget\|require.*context-meter\|require.*runway-estimator\|require.*model-windows" --include='*.js' --include='*.cjs' --include='*.md' .` — must return zero live references (test files excluded) before any delete commits. Waves 1-2 ensure this is true.
