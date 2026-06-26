# Tasks: d11-writer-command-wiring (WAVE C — wire the WRITER commands: query + re-index)

## Summary
When all tasks complete: every code-CHANGING command (debug, quick, execute, wave, test-sync, design-build) does the WRITER pattern — queries the graph for its structural question (fail loud on graph-unavailable) AND re-indexes the touched files after edits so downstream consumers see fresh edges — via the shared d8 contract; the SAFETY-CRITICAL execute/wave disjointness check consults the graph for dependency-overlap and FAILS LOUD + HALTS on graph-unavailable (never a grep-reconstructed disjointness guess that risks a concurrent-edit conflict); each writer has a d8 manifest row (writer role) and a manifest-driven test asserting query-not-grep + re-index-after-edit + fail-loud. Wave C — gated on Wave A (d8/d9) and runs after Wave B (d10) so the shared seam + manifest pattern are settled. `/scan` (d6) is excluded.

## Wave C

### M94-D11-T0 — Writer-wiring test scaffold (manifest-driven, shared)
- **Status**: [ ] pending
- **Headline**: false
- **Files**: `test/m94-d11-writer-wiring.test.js`
- **Touches**: `test/m94-d11-writer-wiring.test.js`
- **ImplPath**: `test/m94-d11-writer-wiring.test.js` — reads the writer-role rows from the d8 consumer-manifest, and for each asserts: (1) the command directs its mapped structural graph query (not grep/raw-read) for the structural question; (2) the command fires a re-index of touched files after edits (the WRITER half); (3) it fails loud on graph-unavailable; (4) it passes the d8 anti-grep lint. Manifest-driven so adding a writer row auto-extends coverage (same pattern as d8 lint + d10 reader test).
- **Test**: `test/m94-d11-writer-wiring.test.js` (self — the scaffold IS the test)
- **Contract refs**: graph-consumer-wiring-contract.md (d8 manifest + WRITER pattern), graph-freshness-contract.md (d4 re-index trigger)
- **Dependencies**: M94-D8-T1 (contract+manifest), M94-D8-T2 (lint engine) — gated on Wave A
- **Acceptance criteria**:
  - Manifest-driven: iterates the d8 writer-role rows; no hardcoded writer list. `[RULE] writer-wiring-test-manifest-driven`
  - Asserts the four properties per writer row (query-not-grep, re-index-after-edit, fail-loud, lint-clean).
  - Sole owner of `test/m94-d11-writer-wiring.test.js`.

### M94-D11-T1 — Wire `/execute` + `/wave` (SAFETY-CRITICAL disjointness — fail-loud paramount)
- **Status**: [ ] pending
- **Headline**: true
- **Files**: `templates/workflows/gsd-t-execute.workflow.js`, `templates/workflows/gsd-t-wave.workflow.js`, `commands/gsd-t-execute.md`, `commands/gsd-t-wave.md`, `bin/gsd-t-file-disjointness.cjs`, `test/m94-d11-writer-wiring.test.js`
- **Touches**: `templates/workflows/gsd-t-execute.workflow.js`, `templates/workflows/gsd-t-wave.workflow.js`, `commands/gsd-t-execute.md`, `commands/gsd-t-wave.md`, `bin/gsd-t-file-disjointness.cjs`
- **ImplPath**: `bin/gsd-t-file-disjointness.cjs` — EXTEND the disjointness check to consult the graph: two domains whose touched files share a dependency (one imports the other, or one's edit blast-radius reaches the other) are NOT disjoint even if their declared Touches lists don't literally overlap; on `graph-unavailable` the check FAILS LOUD + HALTS (never a grep-reconstructed disjointness guess). `templates/workflows/gsd-t-execute.workflow.js` + `gsd-t-wave.workflow.js` — query the disjointness path (graph-aware) before fan-out + re-index touched files after each domain's edits (WRITER half); runtime-native. The two command `.md`s carry the behavior note + the fail-loud-halts statement.
- **Test**: `test/m94-d11-writer-wiring.test.js` (T0) — execute/wave rows + a DEDICATED safety case: on graph-unavailable the disjointness check HALTS (asserts the workflow does NOT proceed to fan-out, asserts NO grep-reconstructed disjointness path is taken); a fixture where two domains share a dependency (transitive) → flagged NON-disjoint by the graph-aware check even though Touches don't literally overlap; the re-index-after-edit fires for the touched set
- **Contract refs**: graph-consumer-wiring-contract.md (d8 WRITER + FAIL-LOUD), graph-query-cli-contract.md (blast-radius/who-imports), graph-freshness-contract.md (d4 re-index)
- **Dependencies**: M94-D11-T0; M94-D8-T1; gated on Wave A
- **Acceptance criteria**:
  - **(Headline for d11 — the SAFETY-CRITICAL writer the user flagged as where fail-loud matters most.)** execute/wave disjointness consults the graph for dependency-overlap (transitive, not just literal Touches overlap) — `[RULE] execute-disjointness-graph-aware-dependency-overlap`.
  - On graph-unavailable the disjointness check FAILS LOUD + HALTS — does NOT fan out on a grep-reconstructed guess (the concurrent-edit-corruption risk). `[RULE] execute-disjointness-fail-loud-halts-never-grep-guess`. The test asserts the HALT (no fan-out, no grep path).
  - WRITER half: touched files re-indexed after each domain's edits (the d4 freshness trigger).
  - `bin/gsd-t-file-disjointness.cjs`'s EXISTING Touches-overlap check is preserved (additive — Destructive Action Guard); workflows runtime-native (M81). Sole owner of the disjointness file in M94.
  - execute + wave manifest rows present; anti-grep lint passes for all touched files.

### M94-D11-T2 — Wire `/debug` (BOTH reader + writer patterns)
- **Status**: [ ] pending
- **Headline**: false
- **Files**: `templates/workflows/gsd-t-debug.workflow.js`, `commands/gsd-t-debug.md`, `test/m94-d11-writer-wiring.test.js`
- **Touches**: `templates/workflows/gsd-t-debug.workflow.js`, `commands/gsd-t-debug.md`
- **ImplPath**: `templates/workflows/gsd-t-debug.workflow.js` — READER half: query `blast-radius`+`who-calls` to localize the bug's call chain (where does this symptom reach) instead of grep/raw-read; WRITER half: re-index the fixed files after the fix lands; runtime-native inline graph query injecting the slice into the debug worker context. `commands/gsd-t-debug.md` — behavior note + fail-loud
- **Test**: `test/m94-d11-writer-wiring.test.js` (T0) — debug row: asserts BOTH halves (reader query for localization + re-index after fix) + fail-loud on graph-unavailable
- **Contract refs**: graph-consumer-wiring-contract.md (d8), graph-query-cli-contract.md (blast-radius/who-calls), graph-freshness-contract.md (re-index)
- **Dependencies**: M94-D11-T0; M94-D8-T1; gated on Wave A
- **Acceptance criteria**:
  - `/debug` does BOTH: queries `blast-radius`+`who-calls` to localize (not grep/raw-read) AND re-indexes the fixed files after the fix. `[RULE] debug-reader-and-writer-both`
  - Fails LOUD on graph-unavailable; runtime-native (M81); existing debug-loop logic (cycle ledger, halt-on-cycle-2) NOT disrupted (additive). Manifest row present; anti-grep lint passes.

### M94-D11-T3 — Wire `/quick` (writer)
- **Status**: [ ] pending
- **Headline**: false
- **Files**: `templates/workflows/gsd-t-quick.workflow.js`, `commands/gsd-t-quick.md`, `test/m94-d11-writer-wiring.test.js`
- **Touches**: `templates/workflows/gsd-t-quick.workflow.js`, `commands/gsd-t-quick.md`
- **ImplPath**: `templates/workflows/gsd-t-quick.workflow.js` — READER half: query `blast-radius`/`who-imports` for the task's structural impact before editing; WRITER half: re-index touched files after edits; runtime-native. `commands/gsd-t-quick.md` — behavior note + fail-loud
- **Test**: `test/m94-d11-writer-wiring.test.js` (T0) — quick row: query-not-grep + re-index-after-edit + fail-loud
- **Contract refs**: graph-consumer-wiring-contract.md (d8), graph-query-cli-contract.md (blast-radius/who-imports), graph-freshness-contract.md
- **Dependencies**: M94-D11-T0; M94-D8-T1; gated on Wave A
- **Acceptance criteria**:
  - `/quick` queries the graph for structural impact before editing (not grep/raw-read) AND re-indexes touched files after. `[RULE] quick-writer-pattern`
  - Fails LOUD on graph-unavailable; runtime-native (M81); additive. Manifest row present; anti-grep lint passes.

### M94-D11-T4 — Wire `/test-sync` (test-impl verb) + `/design-build` (generic-runner writers)
- **Status**: [ ] pending
- **Headline**: false
- **Files**: `commands/gsd-t-test-sync.md`, `commands/gsd-t-design-build.md`, `test/m94-d11-writer-wiring.test.js`
- **Touches**: `commands/gsd-t-test-sync.md`, `commands/gsd-t-design-build.md`
- **ImplPath**: `commands/gsd-t-test-sync.md` — READER half: query `test-impl` (which impl funcs a test exercises) + `untested-impl` (impl funcs with no test) to align tests with impl; WRITER half: re-index after writing/updating tests. `commands/gsd-t-design-build.md` — READER half: query `who-imports`/`cluster` for structure before generating code; WRITER half: re-index generated files. Both are generic-phase-runner writers, so they inherit d10-T0's phase-workflow READER injection — the command `.md` adds the specific verb directive + the WRITER (re-index) half + fail-loud.
- **Test**: `test/m94-d11-writer-wiring.test.js` (T0) — test-sync row (uses `test-impl`) + design-build row: each query-not-grep + re-index-after-edit + fail-loud
- **Contract refs**: graph-consumer-wiring-contract.md (d8), graph-query-cli-contract.md (test-impl — d9-T3; who-imports/cluster), graph-freshness-contract.md
- **Dependencies**: M94-D11-T0; M94-D9-T3 (test-impl verb for test-sync), M94-D9-T1 (cluster for design-build); M94-D10-T0 (phase-workflow reader injection these inherit); gated on Wave A + B
- **Acceptance criteria**:
  - `/test-sync` uses the `test-impl`+`untested-impl` verbs to align tests with impl (not grep/raw-read) AND re-indexes after test edits. `[RULE] test-sync-uses-test-impl-verb`
  - `/design-build` queries `who-imports`/`cluster` for structure before generating (not grep/raw-read) AND re-indexes generated files. `[RULE] design-build-writer-pattern`
  - Each fails LOUD on graph-unavailable; manifest rows present; anti-grep lint passes.

## Execution Estimate
- Total tasks: 5 (T0 scaffold + T1–T4 writer wiring)
- Independent tasks (after T0 + Wave A/B): T1–T4 file-disjoint, run in PARALLEL (T1 owns execute/wave/disjointness; T2 debug; T3 quick; T4 test-sync/design-build command files). Shared test file is manifest-driven + owned by T0 (T1–T4 own only their command/workflow/bin files).
- Intra-domain serial chain: T0 first (scaffold); T1–T4 parallel after.
- Estimated checkpoints: 1 (Wave-C writer wiring — the last wave before integrate/verify).
