# Domain: m85-d1-tier-policy-module

## Responsibility
The dependency-graph ROOT. The single zero-dep canonical tier-policy module and its cross-domain contract that publishes the concrete model-id constants, the `{phase/stage → tier → model id}` map, and the `requiresThinkingOmitted(model)` predicate. Deliberately tiny so the serial gate is just the contract's id constants landing — every other domain codes against those constants, not against the implementation.

## Owned Files/Directories
- `bin/gsd-t-model-tier-policy.cjs` — NEW. Zero-dep CJS module. SOLE source of truth for tier policy. Exports: the concrete model-id constants (`claude-opus-4-8`, `claude-fable-5`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`); the `{phase/stage → tier → model id}` map; `requiresThinkingOmitted(model)` predicate (returns `true` for `claude-fable-5`, encoding the thinking-disabled-400 breaking change exactly ONCE); a `resolve(stageKey)`/CLI resolver command invokers call at invoke time to inject the model id via args (M69 pattern).
- `.gsd-t/contracts/model-tier-policy-contract.md` — NEW. Cross-domain contract. Publishes the id constants, the stage→tier→id map, the `requiresThinkingOmitted` predicate contract, and the resolver command surface. STABLE on landing. This is the seam every other M85 domain codes against.

## NOT Owned (do not modify)
- `bin/gsd-t-parallel.cjs` — owned by m85-d2-bin-consumers-alias-selector
- `bin/model-selector.js` — owned by m85-d2-bin-consumers-alias-selector
- `test/model-selector.test.js` — owned by m85-d2-bin-consumers-alias-selector
- `templates/workflows/*.workflow.js` — owned by m85-d3-workflow-fable-assignments
- `test/m85-workflow-tier-policy-lint.test.js` — owned by m85-d4-lint-shadow-docs
- All docs (`CLAUDE.md`, `README.md`, `commands/gsd-t-help.md`, `templates/CLAUDE-global.md`, `~/.claude/CLAUDE.md`), `model-selection-contract.md`, `.gsd-t/progress.md` — owned by m85-d4-lint-shadow-docs

## Files Owned
- `bin/gsd-t-model-tier-policy.cjs`
- `test/m85-model-tier-policy.test.js`
- `.gsd-t/contracts/model-tier-policy-contract.md`
