# Constraints: m61-d2-retire-unattended-relay

## Must Follow
- Destructive Action Guard: largest demolition in M61. Plan-review approves the exhaustive delete list before execute begins.
- Test files for retired modules deleted in the same commit as the module.
- Update CLAUDE.md (D8) to remove the entire "Always-Headless Spawn" section AFTER this domain commits.
- Edits to `bin/gsd-t.js` CLI dispatch happen in a separate commit from file deletions for clean revert.

## Must Not
- Delete any Workflow scripts (those are D6 KEEP)
- Delete `gsd-t-context-brief.cjs` (D7 KEEP — explicitly more valuable post-M61)
- Delete `gsd-t-verify-gate.cjs` / `gsd-t-verify-gate-judge.cjs` (D7 KEEP)
- Touch hooks unrelated to unattended relay
- Run this in parallel with D6 (sequential — D6 must land in Wave 1, D2 deletes happen in Wave 3)

## Must Read Before Deleting
- `~/.claude/settings.json` — identify which hooks belong to unattended relay vs. which belong to other GSD-T features (date-guard, capture, etc.). Only remove relay-specific hooks.
- D6's final Workflow scripts — confirm the orchestration paths once handled by `gsd-t-unattended` now have a Workflow analogue before deleting

## Dependencies
- Depends on: D6 (orchestration migrated to Workflows), D7 (validation no longer routed through unattended-safety)
- Depended on by: D8 (CLAUDE.md "Always-Headless Spawn" + all unattended sections removed only after this lands)
- Parallel-with: D1, D3, D4 (file-disjoint in Wave 3)
