# Tasks: m61-d1-retire-context-runway

## Summary
Delete context-meter / runway machinery. Wave 3, parallel with D2/D3/D4.

## Tasks

### Task M61-D1-T1 — Zero-reference gate
- **Touches**: writes `.gsd-t/scan/m61-d1-zero-ref-verify.txt`
- **Contract refs**: NONE
- **Dependencies**: BLOCKED by D6-T7 (command files no longer call into the meter) and D7-T2 (OBSERVABILITY blocks gone)
- **Acceptance**: `grep -rn "require.*token-budget\|require.*context-meter\|require.*runway-estimator\|require.*model-windows" --include='*.js' --include='*.cjs' --include='*.md' . | grep -v "^bin/token-budget\|^bin/context-meter\|^bin/runway-estimator\|^bin/model-windows\|^scripts/gsd-t-context-meter"` returns zero hits.

### Task M61-D1-T2 — Delete context-meter files + remove hook entry
- **Touches** (delete): `bin/token-budget.cjs`, `bin/context-meter-config.cjs`, `bin/context-meter-config.test.cjs`, `bin/context-budget-audit.cjs`, `bin/runway-estimator.cjs`, `bin/model-windows.cjs`, `bin/model-windows.test.cjs`, `scripts/gsd-t-context-meter.js`, `scripts/gsd-t-context-meter.e2e.test.js`, `.gsd-t/.context-meter-state.json`, `.gsd-t/contracts/context-meter-contract.md`
- **Touches** (edit): `~/.claude/settings.json` (remove PostToolUse context-meter hook entry only), `bin/gsd-t.js` (drop `doctor` meter health check), `commands/gsd.md` (remove ctx% routing logic)
- **Contract refs**: `context-meter-contract.md` v1.3.0 (about to be deleted — note that the meter's job is now done by Claude Code native `/context` + 1M window)
- **Dependencies**: BLOCKED by T1
- **Acceptance**: Suite green. `node bin/gsd-t.js doctor` runs without meter-related output. `~/.claude/settings.json` valid JSON; only the context-meter hook entry removed.

### Task M61-D1-T3 — Update statusline to drop ctx% field (or wire to /context)
- **Touches**: `~/.claude/statusline-command.sh`
- **Contract refs**: NONE
- **Dependencies**: BLOCKED by T2
- **Acceptance**: Statusline no longer reads `.gsd-t/.context-meter-state.json`. Either drops the ctx% field gracefully OR (if Claude Code exposes input-tokens via the stdin JSON payload's session info) reads it from there. Test with the sample input from the earlier setup.

## Execution Estimate
- Total tasks: 3
- Independent: 0 (all blocked on Wave 1-2)
- Blocked: 3

## Files Owned
- All deletion targets exclusively
- `~/.claude/settings.json` (hook entry — file shared with D4; sequenced at integrate)
- `~/.claude/statusline-command.sh` exclusively
- `bin/gsd-t.js` doctor section + ctx routing
