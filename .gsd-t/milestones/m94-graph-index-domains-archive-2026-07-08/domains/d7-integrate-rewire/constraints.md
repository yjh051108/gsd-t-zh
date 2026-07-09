# Constraints: d7-integrate-rewire

## Destructive Action Guard — USER-APPROVED (this session)
- The deletion of the 6 dead `bin/graph-*.js` + 3 dead `test/graph-*.test.js` is EXPLICITLY USER-APPROVED for this re-plan (the destructive part of Fix-1). It supersedes the M20–M21 dead engine per the keep-or-supersede ledger already in the milestone definition.
- The deletion is REQUIRER-VERIFIED safe (this session): the ONLY live requirers of the 6 dead files are `bin/gsd-t.js` lines 3513/3531/3548 (the dispatch being rewired) + the 3 dead test files. No other live caller. `graph-parsers.js` was the "read for lessons" reference — lessons already extracted into the tree-sitter floor design (D2 taxonomy), so it deletes too.
- BEFORE deleting, re-run the requirer grep to confirm no NEW requirer appeared since plan time: `grep -rn "require(['\"]\\./graph-\\(store\\|cgc\\|indexer\\|overlay\\|parsers\\|query\\)" --include="*.js" --include="*.cjs" . | grep -v node_modules`. If any requirer OTHER than `bin/gsd-t.js` graph-dispatch + the 3 dead tests appears, STOP and escalate (the deletion is no longer safe).

## File-disjointness
- d7 is the SOLE writer of `bin/gsd-t.js` anywhere in M94. The edit is confined to the graph-dispatch region (do NOT touch the headless `queryGraph`/`doHeadlessQuery` path — it reads `.gsd-t/graph-index/meta.json` directly and requires no dead file).
- The rewire DELEGATES to `bin/gsd-t-graph-query-cli.cjs` (D5-owned) — d7 reads/invokes it, NEVER edits it.

## Zero-dep invariant
- The rewire MUST NOT add any external runtime dependency to the installer. The D5 CLI is a project-local `bin/` tool; delegate to it via the existing dispatch mechanism (require the .cjs or shell out per the established pattern), no new npm dep.

## Pre-Commit Gate (project-specific)
- Command-surface change (`gsd-t graph status` now hits the new CLI) → if the `gsd-t graph` interface text changes, update `GSD-T-README.md` + `README.md` + `gsd-t-help.md` (handled at integrate/verify).
- Dead-file deletion → record in `.gsd-t/techdebt.md` (M20–M21 dead engine retired) + progress.md Decision Log.
- `bin/gsd-t.js` modified → CLI smoke test (`gsd-t graph status`, `gsd-t status`, `gsd-t doctor`) before commit.

## Sequencing
- d7 runs at the INTEGRATE stage, gated on the Wave-2 build trio (d3+d4+d5) being integrated (the D5 CLI must exist + the real index→store→query pipeline must work for the seam test) AND on the Wave-1 K1/K2 result envelopes existing (for the hard-gate test).
