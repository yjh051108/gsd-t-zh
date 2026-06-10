# Constraints: m85-d3-workflow-fable-assignments

## Patterns to follow
- **Literals set to the policy contract's published Fable id** — the `model:` value is the tier alias `"fable"` consumed by the runtime model-display layer; the lint (D4) proves agreement with the policy tier set. Do NOT introduce a raw `claude-fable-5` id where the rest of the file uses tier aliases (`"opus"`/`"sonnet"`/`"haiku"`) — match the existing convention in each workflow.
- **Runtime-native invariant (TD-113)** — NEVER reintroduce `require`/`fs`/`path`/`child_process`/`process` into a `*.workflow.js`. These are pure `model:` literal swaps; nothing else changes.
- **One-file home for the blindness coupling** — competition producers (`gsd-t-phase.workflow.js` ~432) STAY `opus`; judge (~476) MOVES to `fable`. Both edits live in `gsd-t-phase.workflow.js` so the M82 different-model-than-producers blindness property cannot leak across domain boundaries.

## Boundaries to respect
- Gated on D1 (policy module + contract) and D4's lint existing — every literal written here must be a policy-conformant tier member so the lint passes.
- This domain writes NO `bin/` files, NO test files, NO docs.
- Red Team (`gsd-t-verify.workflow.js` ~307) stays NON-SKIPPABLE — only its tier changes, not its skippability. AC(f).
- Do NOT change the haiku/sonnet stages in any workflow — only the 5 designated Fable assignments move.

## Verification requirement (AC c/d)
- Verified in a REAL sandbox run — `⚙ [fable]` must appear in `/workflows` for all 5 designated stages. `node --check` is INSUFFICIENT (see memory: workflow-must-run-in-real-sandbox). RUN to completion before reporting done.

## Designated stages (authoritative, line numbers verified on disk 2026-06-09)
| Stage | File | ~Line | From | To |
|---|---|---|---|---|
| M84 solution-space probe | gsd-t-phase.workflow.js | 172 | opus | fable |
| M84 partition probe | gsd-t-phase.workflow.js | 198 | opus | fable |
| Competition judge (subjective) | gsd-t-phase.workflow.js | 476 | sonnet | fable |
| M83 pre-mortem | gsd-t-phase.workflow.js | 656 | opus | fable |
| Red Team | gsd-t-verify.workflow.js | 307 | opus | fable |
| Debug cycle-2 escalation | gsd-t-debug.workflow.js | 97 | opus | fable |
| Competition PRODUCERS (INVARIANT — do NOT change) | gsd-t-phase.workflow.js | 432 | opus | opus |
