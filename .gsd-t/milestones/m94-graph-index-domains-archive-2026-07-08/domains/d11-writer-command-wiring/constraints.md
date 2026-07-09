# Constraints: d11-writer-command-wiring

## The WRITER pattern (d8 contract — two halves)
1. **READER half**: query the graph for the structural question before changing code (debug → blast-radius/who-calls to localize; quick → blast-radius; execute/wave → dependency-overlap for disjointness; test-sync → test-impl; design-build → who-imports/cluster). Fail loud on graph-unavailable.
2. **WRITER half (re-index after edits)**: after the command's edits land, fire a re-index of the touched files so the next consumer sees fresh edges. Concretely = the d4 freshness path: trigger a `gsd-t graph` query/freshness pass over the touched set (content-hash dirty-detection re-indexes touched files), so the persistent index reflects the new code. The WRITER pattern is "ensure the touched set is re-indexed before reporting done", per the d8 contract's §WRITER pattern (use exactly the trigger the d4 graph-freshness-contract exposes — do NOT invent a new re-index API).

## SAFETY-CRITICAL: execute/wave disjointness fail-loud (user-emphasized — paramount)
- execute/wave use the graph for FILE-DISJOINTNESS (do two parallel domains touch the same file / overlapping dependency). A WRONG/STALE edge → a REAL concurrent-edit conflict (corruption). So on graph-unavailable, the disjointness check FAILS LOUD and HALTS — it MUST NOT proceed on a grep-reconstructed disjointness guess. `[RULE] execute-disjointness-fail-loud-halts-never-grep-guess`.
- `bin/gsd-t-file-disjointness.cjs` is EXTENDED to consult the graph for the dependency-overlap question (a file A and file B that import a shared module, or where A's edit blast-radius reaches B, are NOT disjoint even if their declared Touches lists don't literally overlap). Adapt the existing disjointness logic ADDITIVELY — never remove its existing Touches-overlap check; the graph adds dependency-aware overlap on top.

## Extend-class — adapt, never replace (Destructive Action Guard)
- Every edit is to an EXISTING workflow/command with working functionality. READ FIRST. The graph query REPLACES structural-grep/raw-read in the assessment step; the re-index is ADDED after edits. Nothing working is removed.
- Workflows stay M81 runtime-native (no require/fs/child_process/process; inline `agent()` Bash runCli helper).

## The grep distinction (per d8 — same as readers)
- Remove grep ONLY from the structural path. TEXT-search grep stays. Fail loud on graph-unavailable for structural questions (execute/wave: HALT; debug/quick/test-sync/design-build: loud stop with remediation).

## debug = BOTH patterns (user-noted special case)
- `/debug` reads structure to localize the bug (READER: blast-radius/who-calls — where does this symptom's call chain reach) AND writes the fix (WRITER: re-index the fixed files). Its test asserts both halves.

## test-sync uses the test-impl verb
- `/test-sync` queries `test-impl` (which impl funcs a test exercises) + `untested-impl` (impl funcs with no test) to align tests with impl, then re-indexes after writing/updating tests. The test→impl verb is d9-T3 (confirmed: no new edge type needed).

## One owner per file (file-disjointness)
- Each writer's command `.md` + dedicated workflow are edited by exactly ONE d11 task. `bin/gsd-t-file-disjointness.cjs` is edited by ONLY the execute/wave task. No two d11 tasks share a write target. (execute + wave share the disjointness file: ONE task owns both execute+wave wiring incl. the shared disjointness extension, since wave inherits execute's disjointness — keeps the safety-critical seam single-owned.)
