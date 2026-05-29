# Constraints: m61-d1-retire-context-runway

## Must Follow
- Destructive Action Guard: every file delete is approved at plan-review checkpoint, not at execute. List of deletions is exhaustive in scope.md.
- Zero-live-reference safety scan PASSES before any `git rm` runs. Test files that target the retired modules are deleted in the same commit as the module (no orphan tests).
- One commit per logical removal group (meter, runway, hook, contracts) for revert-friendliness.
- Update `bin/gsd-t.js` `doctor` command to drop the context-meter health check in the same commit that deletes `token-budget.cjs`.

## Must Not
- Delete anything outside the listed file set
- Delete the native `/context` plumbing (we depend on it)
- Touch files owned by D2 / D3 / D4 (we run parallel with them in Wave 3 — file-disjoint by construction)
- Modify Workflow scripts written in D6

## Must Read Before Deleting
- `bin/token-budget.cjs` — confirm no public function signature is consumed by a file outside the deletion set (D7 KEEP list double-checked at plan time)
- `~/.claude/settings.json` — confirm hook entry exactly matches before removing (don't remove unrelated hooks)

## Dependencies
- Depends on: D6 (orchestration ported off `getSessionStatus`), D7 (validation reframed without ctx% gating)
- Depended on by: D8 (doc-ripple removes context-meter rules from CLAUDE.md files after this lands)
