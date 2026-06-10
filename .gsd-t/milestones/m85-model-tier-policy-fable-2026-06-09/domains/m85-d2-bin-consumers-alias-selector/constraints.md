# Constraints: m85-d2-bin-consumers-alias-selector

## Patterns to follow
- **Source ids from the policy contract's published constants** — do NOT re-hardcode `claude-opus-4-8` / `claude-fable-5` as bare literals where the policy module already exports them. Where a CJS file can `require` the policy module, import the constants; where it cannot, reference them with a comment pointing at `model-tier-policy-contract.md`.
- **Zero external runtime deps** — installer invariant.
- **`bin/model-selector.js` is ESM-ish/declarative** — preserve its existing `TIERS`/`RULES` structure; ADD the FABLE tier and the escalation ladder, do not restructure.
- **Escalation ladder shape**: cycle-1 `opus` → cycle-2 `fable` → needs-human. The bottom of the ladder (`haiku`, `sonnet`) is UNCHANGED — AC(f). No bottom-ladder drift.

## Boundaries to respect
- Gated on D1's policy module + contract existing (serial gate). The constants you reference must come from the contract D1 publishes.
- This domain writes NO workflow files. The Fable `model:` literal edits live entirely in D3.
- Do NOT touch `model-selection-contract.md` (D4 bumps it) or any doc (D4 owns doc ripple).
- Do NOT create the lint test (D4 owns `test/m85-workflow-tier-policy-lint.test.js`). This domain only updates the pre-existing `test/model-selector.test.js`.

## Live-bug fact
- `bin/gsd-t-parallel.cjs:585` currently reads `opus: "claude-opus-4-7"` (verified on disk 2026-06-09). Opus is now 4.8 — this is a live correctness bug. Fixing it kills the bug the instant the alias map merges.
