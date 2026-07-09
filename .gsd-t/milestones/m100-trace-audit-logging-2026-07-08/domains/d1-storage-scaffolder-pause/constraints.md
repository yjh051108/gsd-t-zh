# Constraints: d1-storage-scaffolder-pause

## Must Follow
- The ONE sanctioned pause: the scaffolder STOPS for human approval — this is the sanctioned exception to the Level-3 full-auto default (`feedback_no_silent_degradation`).
- Present REAL alternatives (has-DB → table; no-server/desktop → local store; SQLite-over-flat-file flagged for audit queryability) — never silently pick.
- Record the chosen backend in the project's CLAUDE.md / infrastructure doc.
- Resume deterministically on re-run — if a choice is recorded, do NOT re-prompt.
- Zero external npm runtime deps in the installer path (guiding principle).
- Wave-1 spike: prove standalone with a fake/echo scaffold BEFORE any dependent domain builds on it.
- Publish the seam as `logging-scaffold-seam-contract.md`; d2/d4/d5 consume it (they do NOT co-edit the scaffolder or `bin/gsd-t.js`).

## Must Not
- Modify files outside owned scope.
- Silently pick a backend (that is the exact anti-pattern this domain exists to kill — `feedback_no_silent_degradation`).
- Let any other domain edit `bin/gsd-t.js` — d5's migration dispatch case is wired HERE, via the seam.

## Dependencies
- Depends on: nothing (Wave-1 spike, standalone).
- Depended on by: d2-trace-machinery, d4-audit-machinery (module transport selection), d5-defaults-migration-pilot (migration dispatch case + storage recording) — all via the seam contract.
