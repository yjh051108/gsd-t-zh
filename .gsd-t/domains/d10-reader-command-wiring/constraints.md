# Constraints: d10-reader-command-wiring

## Extend-class — adapt, never replace (Destructive Action Guard)
- Every edit is to an EXISTING command `.md` or workflow `.js` with working functionality. READ FIRST, adapt to its structure, NEVER rip out working assessment logic. The graph query is ADDITIVE to the command's flow — it REPLACES the structural-grep/raw-read in the ASSESSMENT step, leaving everything else intact.
- Workflows stay M81 runtime-native: NO require/fs/child_process/process; delegate the graph CLI call to an inline `agent()` Bash helper (the established runCli pattern). `gsd-t-phase.workflow.js` already follows this — extend it the same way.

## The grep distinction (per d8 contract — do not over-remove)
- Remove grep ONLY from the STRUCTURAL-question path (who-imports/who-calls/blast-radius/dependents/dead-code/cycles/cluster). Leave TEXT-search grep (string literal / TODO / config value) intact — the graph has no text content. A reader that greps for a string constant is FINE; a reader that greps to answer "who imports X" is the violation.

## FAIL-LOUD on graph-unavailable (the M20–M21 lesson)
- On `{ok:false, reason:"graph-unavailable"}` for a structural question, the reader FAILS LOUD ("graph unavailable — fix it") and does NOT silently grep. EXCEPTION: `/scan` (d6) announces and continues in grep-read mode — but scan is OUT of d10's scope.
- For non-scan readers, graph-unavailable is a hard stop with a clear remediation message — it must not degrade silently to grep (that is the exact cause of death being inverted).

## Verb-per-command map (which structural verb each reader uses — declare in its manifest row)
- `impact` → `blast-radius` (the user's CORE use case — downstream effect = union of import+call reverse-reachable).
- `plan` → `who-imports` + `blast-radius` (touched-file dependents for task sequencing).
- `partition` → `cluster` (domain-boundary suggestion along low-coupling cuts).
- `project` → `cluster` (milestone decomposition).
- `feature` → `blast-radius` + `who-imports` (impact of the new feature on existing code).
- `gap-analysis` → `who-imports` + `dead-code` (requirements-vs-code: unreferenced / missing wiring).
- `populate` → `who-imports` + `cluster` (derive structure for docs from real edges).
- `promote-debt` → `blast-radius` (scope a debt item's reach before milestone-izing).
- `prd` → `cluster` (structure-aware PRD decomposition; reader-only).
- `qa` → `dead-code` + `dangling` (shallow-test / dead-code / dangling-ref detection).
- `integrate` → `who-imports` + `blast-radius` (cross-domain wiring verification).
- `verify` → `dead-code` + `dangling` (the milestone's own dead-code/dangling gate).

## One owner per file (file-disjointness)
- Each command `.md` is edited by exactly ONE d10 task. `gsd-t-phase.workflow.js` is edited by ONLY T0. The two dedicated workflows (integrate/verify) each by exactly one task. No two d10 tasks share a write target. d6 owns scan files (excluded here).
