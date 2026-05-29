# Constraints: m61-d8-doc-ripple-and-cockpit

## Must Follow
- Runs LAST. All retire waves must commit before D8 starts — every cut/rewrite section must reference only post-M61 state.
- Both global and project CLAUDE.md edits in the same commit (they're consistency-paired).
- Live `~/.claude/CLAUDE.md` and the package template `templates/CLAUDE-global.md` must match after D8 commits.
- CHANGELOG breaking-changes section is exhaustive (per-removed-command, per-removed-rule, per-removed-contract — one-line migration note each).
- SC7 walkthrough is the FINAL acceptance gate. M61 cannot be marked COMPLETE until SC7 passes.

## Must Not
- Refer to retired infra anywhere in the rewritten docs (even commented-out)
- Delete `templates/prompts/*-subagent.md` — these stay; D7 protects them
- Modify `templates/test-helpers/*` (M58 D2 — D7 KEEP)
- Modify scan / contract / methodology templates (D7 KEEP)
- Touch bin/ source (those are D1-D7's domain)

## Must Read Before Editing
- The final post-M61 state of:
  - `commands/` directory (D6 + D7 final state)
  - `bin/` directory (after D1-D5 retire commits)
  - The bake-off Workflow script (canonical example for the new architecture)
- D7's `orthogonal-validation-contract.md` (to reference correctly)
- M61 archive directory structure (for SC7 + retire→native map placement)

## SC7 Constraints
- The "small backlog item" picked for SC7 must exist in `.gsd-t/backlog.md` and exercise the full lifecycle. If no eligible item, plan-review adds one before SC7 runs.
- Every prompt that fires during the walkthrough is classified (Real decision / Allowlist gap / Mistake). Only real decisions and allowlist gaps are allowed; allowlist gaps count as SC7 violations to fix.
- A second person (the user) signs off on the walkthrough record before M61 ships.

## Dependencies
- Depends on: D1, D2, D3, D4, D5, D6, D7 ALL committed and verify-gate green
- Depended on by: nothing (D8 is the final domain)
- Parallel-with: none (D8 runs alone in Wave 4)
