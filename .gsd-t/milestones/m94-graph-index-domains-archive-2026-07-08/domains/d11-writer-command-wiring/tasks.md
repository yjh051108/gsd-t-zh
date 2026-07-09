# Tasks: d11-writer-command-wiring (WAVE C — wire the WRITER commands: query + re-index)

## Summary
When all tasks complete: every code-CHANGING command (debug, quick, execute, wave, test-sync, design-build) does the WRITER pattern — queries the graph for its structural question (fail loud on graph-unavailable) AND re-indexes the touched files after edits so downstream consumers see fresh edges — via the shared d8 contract; the SAFETY-CRITICAL execute/wave disjointness check consults the graph for dependency-overlap and FAILS LOUD + HALTS on graph-unavailable (never a grep-reconstructed disjointness guess that risks a concurrent-edit conflict); each writer has a d8 manifest row (writer role) and a manifest-driven test asserting query-not-grep + re-index-after-edit + fail-loud. Wave C — gated on Wave A (d8/d9) and runs after Wave B (d10) so the shared seam + manifest pattern are settled. `/scan` (d6) is excluded.

## Wave C

### M94-D11-T0 — Writer-wiring test scaffold (manifest-driven, shared)
- **Status**: [x] complete
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
- **Status**: [x] complete
- **Headline**: true
- **Files**: `templates/workflows/gsd-t-execute.workflow.js`, `templates/workflows/gsd-t-wave.workflow.js`, `commands/gsd-t-execute.md`, `commands/gsd-t-wave.md`, `bin/gsd-t-file-disjointness.cjs`, `test/m94-d11-writer-wiring.test.js`, `test/m94-d11-execute-disjointness-consumption-proof.test.js`
- **Touches**: `templates/workflows/gsd-t-execute.workflow.js`, `templates/workflows/gsd-t-wave.workflow.js`, `commands/gsd-t-execute.md`, `commands/gsd-t-wave.md`, `bin/gsd-t-file-disjointness.cjs`, `test/m94-d11-execute-disjointness-consumption-proof.test.js`
- **ImplPath**: `bin/gsd-t-file-disjointness.cjs` — EXTEND the disjointness check to consult the graph: two domains whose touched files share a dependency (one imports the other, or one's edit blast-radius reaches the other) are NOT disjoint even if their declared Touches lists don't literally overlap; on `graph-unavailable` the check FAILS LOUD + HALTS (never a grep-reconstructed disjointness guess). `templates/workflows/gsd-t-execute.workflow.js` + `gsd-t-wave.workflow.js` — query the disjointness path (graph-aware) before fan-out + re-index touched files after each domain's edits (WRITER half); runtime-native. The two command `.md`s carry the behavior note + the fail-loud-halts statement.
- **Test**: `test/m94-d11-writer-wiring.test.js` (T0) — execute/wave rows + a DEDICATED safety case: on graph-unavailable the disjointness check HALTS (asserts the workflow does NOT proceed to fan-out, asserts NO grep-reconstructed disjointness path is taken); the re-index-after-edit fires for the touched set. PLUS **`test/m94-d11-execute-disjointness-consumption-proof.test.js`** (RE-PLAN-EXPANDED Fix-4 — CONSUMPTION PROOF, mirrors d6-T2 byte-traceability): builds a REAL fixture repo via D3 `build_index` with two domains A and B that share a transitive dependency module M (A's files import M, B's files import M) but have NO literal `Touches` overlap; runs the graph-aware `bin/gsd-t-file-disjointness.cjs` check and asserts the verdict is **NON-disjoint BECAUSE of the graph edge** — AND asserts the PRE-graph Touches-only check on the SAME two domains returns disjoint (so the test proves the graph CHANGED the verdict, not that it merely matched a literal overlap). A test where the graph-aware verdict equals the Touches-only verdict FAILS the consumption proof.
- **Contract refs**: graph-consumer-wiring-contract.md (d8 WRITER + FAIL-LOUD), graph-query-cli-contract.md (blast-radius/who-imports), graph-freshness-contract.md (d4 re-index)
- **Dependencies**: M94-D11-T0; M94-D8-T1; M94-D3-T2 (build_index for the consumption-proof fixture), M94-D5-T1 (blast-radius/who-imports CLI the disjointness check consults); gated on Wave A
- **Acceptance criteria**:
  - **(Headline for d11 — the SAFETY-CRITICAL writer the user flagged as where fail-loud matters most.)** execute/wave disjointness consults the graph for dependency-overlap (transitive, not just literal Touches overlap) — `[RULE] execute-disjointness-graph-aware-dependency-overlap`.
  - **[RE-PLAN-EXPANDED Fix-4 — CONSUMPTION PROOF, not just directive presence]** the disjointness OUTPUT verdict flips to NON-disjoint for two domains sharing a transitive dependency (no literal Touches overlap) BECAUSE of the graph edge — `[RULE] execute-disjointness-output-flips-on-graph-edge` — and the SAME domains return disjoint under the pre-graph Touches-only check (proving the graph changed the answer). A verdict unchanged from the Touches-only check FAILS the proof.
  - **[RE-PLAN-EXPANDED Fix-5 — disjointness-query scale budget]** the per-fan-out graph disjointness check has a MEASURED scale budget at the reconciled Atos scale (the per-fan-out check wall-clock recorded against a STATED ceiling; over the ceiling → recorded re-scope, e.g. cap the transitive depth or batch the query) — `[RULE] disjointness-query-under-budget-at-atos-scale`. Measured in the result doc the same way AC-3 is measured (D11-T1 records it), never assumed.
  - On graph-unavailable the disjointness check FAILS LOUD + HALTS — does NOT fan out on a grep-reconstructed guess (the concurrent-edit-corruption risk). `[RULE] execute-disjointness-fail-loud-halts-never-grep-guess`. The test asserts the HALT (no fan-out, no grep path). **The bootstrap escape hatch is D11-T5** (a fresh-repo graph-genuinely-unavailable case must NOT permanently brick parallel execution — see T5).
  - WRITER half: touched files re-indexed after each domain's edits (the d4 freshness trigger).
  - `bin/gsd-t-file-disjointness.cjs`'s EXISTING Touches-overlap check is preserved (additive — Destructive Action Guard); workflows runtime-native (M81). Sole owner of the disjointness file in M94.
  - execute + wave manifest rows present; anti-grep lint passes for all touched files.

### M94-D11-T2 — Wire `/debug` (BOTH reader + writer patterns)
- **Status**: [x] complete
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
- **Status**: [x] complete
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
- **Status**: [x] complete
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

### M94-D11-T5 — RE-PLAN-EXPANDED Fix-5: disjointness bootstrap escape hatch (graph-genuinely-unavailable must not permanently brick parallel execution)
- **Status**: [x] complete
- **Headline**: false
- **Files**: `bin/gsd-t-file-disjointness.cjs`, `commands/gsd-t-execute.md`, `test/m94-d11-disjointness-bootstrap-escape.test.js`
- **Touches**: `test/m94-d11-disjointness-bootstrap-escape.test.js`
- **ImplPath**: `bin/gsd-t-file-disjointness.cjs` (D11-T1 sole owner — the escape-hatch impl folds into T1's owned file + `commands/gsd-t-execute.md`'s behavior note, also T1-owned) — D11-T1's fail-loud-HALT on graph-unavailable is correct for a PARSER REGRESSION (a graph that SHOULD exist but broke), but a FRESH repo with NO graph yet (genuine bootstrap) must not be permanently bricked. The escape hatch: on graph-unavailable, the HALT message distinguishes `graph-says-non-disjoint` (a real block — never escapable) from `graph-unavailable` (a bootstrap/regression state), and offers an EXPLICIT operator escape — EITHER a documented `--disjointness-fallback=touches-only` flag (operator-acknowledged degrade to the literal-Touches-overlap check, announced + recorded, NOT silent) OR an announced auto-fallback to literal-Touches-overlap with a loud WARNING — so a parser regression doesn't permanently brick ALL parallel execution. The escape NEVER applies to `graph-says-non-disjoint` (that block stays absolute).
- **Test**: `test/m94-d11-disjointness-bootstrap-escape.test.js` — three cases: (1) **graph genuinely unavailable (fresh repo, no index)** → execute/wave HALT with a CLEAR remediation message AND the operator has the tested escape (the `--disjointness-fallback=touches-only` flag OR the announced fallback) that lets execution proceed under the literal-Touches check with a loud warning; (2) **graph-says-non-disjoint** → HALTS absolutely, the escape hatch is REFUSED (a correct block must not be escapable — asserts the flag does NOT override a real non-disjoint verdict); (3) the message distinguishes the two states (asserts `graph-unavailable` ≠ `graph-says-non-disjoint` in the surfaced reason). `[RULE] disjointness-bootstrap-escape-not-a-no-recourse-brick`.
- **Contract refs**: graph-consumer-wiring-contract.md (d8 FAIL-LOUD invariant + the bootstrap carve-out), graph-query-cli-contract.md (the `graph-unavailable` vs non-disjoint envelope distinction)
- **Dependencies**: M94-D11-T1 (the graph-aware disjointness check + its fail-loud-halt the escape hatch refines) — intra-domain (T1 → T5)
- **Acceptance criteria**:
  - **(RE-PLAN-EXPANDED Fix-5 — a parser regression / fresh-repo bootstrap does not permanently brick all parallel execution.)** On graph-unavailable, the operator has an EXPLICIT tested escape (documented flag OR announced fallback to literal-Touches-overlap) — `[RULE] disjointness-bootstrap-escape-not-a-no-recourse-brick`.
  - The escape NEVER applies to `graph-says-non-disjoint` — a correct non-disjoint block stays absolute and un-escapable (the test asserts the flag does NOT override a real non-disjoint verdict).
  - The HALT message DISTINGUISHES `graph-unavailable` (bootstrap/regression, escapable) from `graph-says-non-disjoint` (real block, not escapable).
  - The escape is ANNOUNCED + recorded (loud warning), NEVER a silent degrade (No-Silent-Degradation invariant).
  - Impl folds into D11-T1's sole-owned `bin/gsd-t-file-disjointness.cjs` + `commands/gsd-t-execute.md`; T5 owns only its own test file (zero collision).

## Execution Estimate
- Total tasks: 6 (T0 scaffold + T1–T4 writer wiring + T5 bootstrap escape hatch — RE-PLAN-EXPANDED Fix-5)
- Independent tasks (after T0 + Wave A/B): T1–T4 file-disjoint, run in PARALLEL (T1 owns execute/wave/disjointness; T2 debug; T3 quick; T4 test-sync/design-build command files). Shared test file is manifest-driven + owned by T0 (T1–T4 own only their command/workflow/bin files). T5's impl folds into T1's `bin/gsd-t-file-disjointness.cjs` (T1 → T5 intra-domain serial); T5 owns only its own test file.
- New sole-owned test files (RE-PLAN-EXPANDED, zero collision): `test/m94-d11-execute-disjointness-consumption-proof.test.js` (T1), `test/m94-d11-disjointness-bootstrap-escape.test.js` (T5).
- Intra-domain serial chain: T0 first (scaffold); T1–T4 parallel after; T5 after T1 (refines T1's disjointness check).
- Estimated checkpoints: 1 (Wave-C writer wiring — the last wave before integrate/verify).
