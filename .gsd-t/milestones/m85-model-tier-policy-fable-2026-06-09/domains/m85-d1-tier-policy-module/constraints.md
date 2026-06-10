# Constraints: m85-d1-tier-policy-module

## Patterns to follow
- **Zero external runtime deps** — installer-package invariant. Pure Node built-ins only.
- **Single-encoding of breaking changes** — `requiresThinkingOmitted(model)` must encode the Fable thinking-disabled-400 breaking change in exactly ONE place. No other file may re-implement this predicate.
- **Concrete ids are constants, not magic strings** — `claude-opus-4-8`, `claude-fable-5`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001` are exported named constants. Consumers import them; they do not re-hardcode.
- **M69 invoke-time resolution** — expose a resolver (function + CLI command) that invokers call at invoke time to inject the model id via args. Workflows stay runtime-native (no `require`/`fs`); they receive resolved ids through `args`, never by requiring this module.
- **CJS** (`.cjs`) so it loads outside ESM contexts the same way `bin/cli-preflight.cjs` etc. do.

## Boundaries to respect
- This domain writes NO workflow files, NO test edits to existing tests, NO doc prose. It owns the module + the contract only.
- The contract (`model-tier-policy-contract.md`) is the published seam. Land the id constants in the contract first — D2/D3/D4 code against the contract's published constants, not against the implementation file's internals.
- Do NOT change `model-selector.js` tier logic here — that is D2's reconciliation work.
- The `requiresThinkingOmitted` predicate is the canonical home of the Fable HTTP-400 knowledge; do not duplicate the rationale anywhere else.

## Tier-policy facts (authoritative)
- `opus` → `claude-opus-4-8` (NOT `claude-opus-4-7` — that is the live bug D2 fixes in the alias map)
- `fable` → `claude-fable-5` (tier ABOVE opus; $10/$50 per MTok; 1M ctx / 128K out; same API surface as Opus 4.8)
- `sonnet` → `claude-sonnet-4-6`
- `haiku` → `claude-haiku-4-5-20251001`
- Fable breaking change: explicit thinking-disabled returns HTTP 400 → the param must be OMITTED for `claude-fable-5`.
