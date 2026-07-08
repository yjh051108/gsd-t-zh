# Scope: d11-writer-command-wiring (Wave C — wire the WRITER commands: query + re-index)

## Mission
Wire every command that CHANGES code to the WRITER pattern (d8 contract): do the READER pattern (query the graph for the structural question, fail loud on graph-unavailable) PLUS, after edits land, fire a re-index of the touched files so downstream consumers see fresh edges. Each writer gets the per-command directive, a d8 manifest row (writer role), and a test asserting query-not-grep + re-index-after-edit + fail-loud.

## WRITER command set (6 — verified against `ls commands/`)
- `debug` (BOTH reader+writer — reads structure to localize, writes the fix; has its OWN workflow).
- `quick` (writer — fast task execution; has its OWN workflow).
- `execute` (writer — **SAFETY-CRITICAL**: file-disjointness uses the graph; a WRONG edge = a real parallel-edit conflict, so FAIL-LOUD matters MOST here; has its OWN workflow).
- `wave` (writer — inherits execute's disjointness; has its OWN workflow).
- `test-sync` (writer — uses the `test-impl` verb to align tests with impl; generic-phase runner, directive in the command `.md`).
- `design-build` (writer — deterministic design-to-code; generic-phase runner, directive in the command `.md`).

## The SAFETY-CRITICAL execute case (user-emphasized)
`/execute` (and `/wave` which inherits it) uses the graph for FILE-DISJOINTNESS — proving two parallel domains don't edit the same file/touch the same dependency. A wrong/stale edge here produces a REAL parallel-edit conflict (two agents editing overlapping code). So for execute/wave the FAIL-LOUD invariant is PARAMOUNT: on graph-unavailable the disjointness check must FAIL LOUD and HALT (never proceed on a grep-reconstructed disjointness guess) — a graph-unavailable disjointness check is a hard stop, because proceeding risks a concurrent-edit corruption. Note: execute's disjointness today uses `bin/gsd-t-file-disjointness.cjs` — d11 wires that path to consult the graph for the dependency-overlap question, fail-loud on graph-unavailable.

## Files Owned
- `templates/workflows/gsd-t-debug.workflow.js`, `templates/workflows/gsd-t-quick.workflow.js`, `templates/workflows/gsd-t-execute.workflow.js`, `templates/workflows/gsd-t-wave.workflow.js` (the 4 writers WITH dedicated workflows)
- `commands/gsd-t-debug.md`, `commands/gsd-t-quick.md`, `commands/gsd-t-execute.md`, `commands/gsd-t-wave.md`, `commands/gsd-t-test-sync.md`, `commands/gsd-t-design-build.md` (per-command notes)
- `bin/gsd-t-file-disjointness.cjs` (EXTEND — execute/wave consult the graph for dependency-overlap; the safety-critical seam)
- `test/m94-d11-writer-wiring.test.js` (NEW — query-not-grep + re-index-after-edit + fail-loud, manifest-driven)

## Not Owned
- The query-CLI verbs (d9) + shared contract/lint (d8) + the d10 reader seam (`gsd-t-phase.workflow.js`) — d11 CONSUMES d8/d9; d11's generic-runner writers (test-sync/design-build) inherit d10-T0's phase-workflow injection for the READER half and add the WRITER (re-index) half in the command `.md`.
- READER commands (d10) + scan (d6) + `bin/gsd-t.js` (d7).

## Contract refs
- graph-consumer-wiring-contract.md (d8 — WRITER pattern: reader + re-index-after-edit + FAIL-LOUD)
- graph-query-cli-contract.md (d5 + d9 verbs: blast-radius/who-imports/who-calls/test-impl)
- graph-freshness-contract.md (d4 — the re-index/freshness path the WRITER pattern fires)
