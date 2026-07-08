# Tasks: d9-query-cli-extensions (WAVE A — new verbs, BEFORE consumer wiring)

## Summary
When all tasks complete: `bin/gsd-t-graph-query-cli.cjs` exposes three NEW verb families — `cluster` (tightly-coupled file groups, for partition/project), `dead-code`/`orphan` + `dangling` (absence queries, for qa/verify), and `test-impl` (test→impl coverage, for test-sync) — all ADDITIVE to the existing who-imports/who-calls/blast-radius/status, all through the same freshness-inline + fail-loud envelope, all declared in `graph-query-cli-contract.md`. Wave A — lands with d8 before the reader/writer wiring (d10/d11) consumes these verbs.

> **REAL EDGE-SHAPE CORRECTION (RE-PLAN-EXPANDED Fix-3 — VERIFIED against `bin/gsd-t-graph-edge-extract.cjs` on disk):** the extractor keys function nodes/call edges as **`file#function@LINE`** (`gsd-t-graph-edge-extract.cjs:223` — `${relPath}#${name}@${node.startPosition.row + 1}`), NOT bare `file#function`, and emits unresolved call targets as **`UNRESOLVED#<name>`** (line 268) at the tree-sitter floor. The prior plan-pass note ("call-site edges already funcId-keyed `file#function`") was WRONG about the key shape and ignored the UNRESOLVED case. CONSEQUENCES the verbs MUST handle: (a) `test-impl` must NOT present `UNRESOLVED#<name>` call targets as RESOLVED impl coverage — an unresolved guess is not coverage; (b) `dead-code`/`orphan` over real floor-tier data can FLOOD with false positives (a missed/unresolved call makes a live function look orphan) → every floor-tier result MUST be labeled CANDIDATE; (c) `funcId` comparisons must use the `@LINE` form (R4-3's `file#function` disambiguation widens to `file#function@LINE` where the extractor emits a line suffix). This correction is bound to the real-Atos spotcheck test D9-T4 below — the verbs are proven against REAL extractor output, not the mis-assumed bare-key shape.

## Wave A

### M94-D9-T1 — CLUSTER / subgraph verb (tightly-coupled file groups)
- **Status**: [ ] pending
- **Headline**: false
- **Files**: `bin/gsd-t-graph-query-cli.cjs`, `.gsd-t/contracts/graph-query-cli-contract.md`, `test/m94-d9-cluster-verb.test.js`
- **Touches**: `bin/gsd-t-graph-query-cli.cjs`, `.gsd-t/contracts/graph-query-cli-contract.md`, `test/m94-d9-cluster-verb.test.js`
- **ImplPath**: `bin/gsd-t-graph-query-cli.cjs` — add `cluster` to the verb whitelist (~L482) + a `queryCluster(index)` that computes connected-component / dense-coupling file groups over the import graph by a DETERMINISTIC metric (declared in the contract), emitting `{ok:true, verb:"cluster", results:[{files:[…], couplingScore}], tier}`
- **Test**: `test/m94-d9-cluster-verb.test.js` — fixture graph with TWO dense clusters joined by ONE thin edge; asserts `cluster` returns the two groups split at the thin cut (deterministic, not LLM-judged); asserts an isolated file is its own singleton cluster; asserts the metric is reproducible (same input → same grouping)
- **Contract refs**: graph-query-cli-contract.md (extended here), graph-store-schema-contract.md (edges table)
- **Dependencies**: none (Wave-2 build trio complete; CLI exists)
- **Acceptance criteria**:
  - `cluster` verb returns tightly-coupled file groups by a DETERMINISTIC coupling metric declared in the contract (mutual-import / shared-dependent density + threshold) — `[RULE] cluster-verb-deterministic-coupling`. NOT an LLM judgment.
  - Same envelope shape + same freshness-inline + fail-loud path as the existing verbs (graph-unavailable → `{ok:false, reason:"graph-unavailable"}`).
  - Existing verb tests stay green (additive-only regression check).
  - Consumers declared: `/partition` (domain-boundary suggestion) + `/project` (milestone decomposition) — recorded in the contract.

### M94-D9-T2 — ORPHAN (dead-code) + DANGLING (absence) verbs
- **Status**: [ ] pending
- **Headline**: false
- **Files**: `bin/gsd-t-graph-query-cli.cjs`, `.gsd-t/contracts/graph-query-cli-contract.md`, `test/m94-d9-orphan-dangling-verb.test.js`
- **Touches**: `bin/gsd-t-graph-query-cli.cjs`, `.gsd-t/contracts/graph-query-cli-contract.md`, `test/m94-d9-orphan-dangling-verb.test.js`
- **ImplPath**: `bin/gsd-t-graph-query-cli.cjs` — add `dead-code` (alias `orphan`) = nodes with zero inbound import/call edges (minus declared exclusions: entry points, exported public API, test files) + `dangling` = edges whose `dst` is a missing node (UNRESOLVED# / dst not in nodes); both emit `{ok:true, verb, results:[…], tier}` with per-result tier labels
- **Test**: `test/m94-d9-orphan-dangling-verb.test.js` — fixture: a function nobody imports/calls → appears in `dead-code`; an exported public-API symbol with no internal caller → EXCLUDED (not flagged); an edge to a deleted/missing target → appears in `dangling`; a tree-sitter-floor-tier orphan → labeled tier=tree-sitter-floor (CANDIDATE, not certainty); a compiler-accurate orphan → labeled accordingly
- **Contract refs**: graph-query-cli-contract.md (extended), graph-store-schema-contract.md
- **Dependencies**: none
- **Acceptance criteria**:
  - `dead-code`/`orphan` returns nodes with no inbound edges, MINUS declared exclusions (entry points / exported public API / test files) — `[RULE] dead-code-verb-excludes-entrypoints-and-exports`. Exclusions declared in the contract so it is not a false-positive flood.
  - `dangling` returns edges whose dst is a missing node (the delete/rename residue freshness flags) — `[RULE] dangling-verb-surfaces-missing-dst`.
  - **Tier honesty** (`[RULE] orphan-tier-labeled-candidate-not-certainty`): tree-sitter-floor-tier orphans are labeled CANDIDATE (a missed call could make a live node look orphan); compiler-accurate orphans labeled accordingly — never an approximate orphan presented as definite.
  - Same envelope + freshness-inline + fail-loud path. Existing verb tests stay green.
  - Consumers declared: `/qa` + `/verify` (dead-code / dangling-ref detection).

### M94-D9-T3 — TEST→IMPL coverage verb (call-site filter, no new edge type)
- **Status**: [ ] pending
- **Headline**: true
- **Files**: `bin/gsd-t-graph-query-cli.cjs`, `.gsd-t/contracts/graph-query-cli-contract.md`, `test/m94-d9-test-impl-verb.test.js`
- **Touches**: `bin/gsd-t-graph-query-cli.cjs`, `.gsd-t/contracts/graph-query-cli-contract.md`, `test/m94-d9-test-impl-verb.test.js`
- **ImplPath**: `bin/gsd-t-graph-query-cli.cjs` — add `test-impl` verb = filter call-site edges where `src` file matches the test-path patterns (`*.test.*` / `*.spec.*` / `e2e/**`, declared+configurable), dst = the impl funcId; forward form (which impl funcs a test calls) + inverse `untested-impl` (impl funcs with NO test-file caller). Emits `{ok:true, verb:"test-impl", results:[{testFunc, implFuncs:[…]}] | {untested:[…]}, tier}`. NO change to `bin/gsd-t-graph-edge-extract.cjs` (call-site edges already funcId-keyed at both ends — confirmed)
- **Test**: `test/m94-d9-test-impl-verb.test.js` — fixture repo: `foo.test.ts` whose test fn calls `impl.ts#doThing` → `test-impl` returns that test→impl edge; `impl.ts#untestedFn` called by NO test file → appears in `untested-impl`; an impl fn called by BOTH a test and prod code → still listed as tested; **[no-new-edge-type proof]** asserts the verb works WITHOUT any edge-type added to the indexer (operates purely on existing `call-site` edges filtered by src test-path) — the confirm-not-add decision is encoded as a test
- **Contract refs**: graph-query-cli-contract.md (extended), graph-store-schema-contract.md (call-site edges)
- **Dependencies**: none
- **Acceptance criteria**:
  - **(Headline for d9 — the test-sync enabler the user flagged as needing a confirm-or-add decision; CONFIRMED no add needed.)** `test-impl` returns, per test function, the impl funcIds it calls — derived by filtering existing `call-site` edges by test-path source; `untested-impl` returns impl funcs with no test caller. `[RULE] test-impl-verb-from-call-site-edges-no-new-type`.
  - **No d3 edge-type change** (`[RULE] test-impl-no-new-edge-type-needed`): the verb operates on existing call-site edges; the test asserts it works against the unmodified indexer output — the user's "confirm first, add only if absent" is resolved as confirmed-present, recorded as a test invariant so verify does not expect a d3 change.
  - funcId-keyed (R4-3): groups by `file#function`, never bare name; ambiguous bare-name input → `ambiguous-function` envelope.
  - Test-path patterns declared + configurable in the contract (sane defaults). Same envelope + freshness-inline + fail-loud path. Existing verb tests stay green.
  - Consumer declared: `/test-sync` (align tests with impl via the coverage edges).

### M94-D9-T4 — RE-PLAN-EXPANDED Fix-3: real-Atos spotcheck for the new verbs (UNRESOLVED-as-impl / flood / non-determinism FAIL LOUD)
- **Status**: [ ] pending
- **Headline**: false
- **Files**: `test/m94-d9-real-atos-verb-spotcheck.test.js`
- **Touches**: `test/m94-d9-real-atos-verb-spotcheck.test.js`
- **ImplPath**: `bin/gsd-t-graph-query-cli.cjs` (T1/T2/T3 — the cluster/dead-code/test-impl verbs) + `bin/gsd-t-graph-index.cjs` (D3-T2 `build_index`) + `bin/gsd-t-graph-edge-extract.cjs` (D3-T1) — this test runs the REAL `build_index` over the REAL Atos repo at the pinned SHA and exercises the new verbs against REAL extractor output (the `file#function@LINE` + `UNRESOLVED#` shapes), binding their correctness to real data rather than the mis-assumed bare-key fixture shape
- **Test**: `test/m94-d9-real-atos-verb-spotcheck.test.js` — **gated on the Atos repo at `/Users/david/projects/HiloAviation/hilo-figma-atos`; FAIL-LOUD-SKIP with `atos-repo-not-found` if absent** (mirrors D3-T4 / K2 `repo-not-found`, never a silent green). When present, three sub-checks:
  - **(a) test-impl over a real Atos test file** returns ≥N RESOLVED impl funcIds (`file#function@LINE` shape), NOT `UNRESOLVED#<name>` placeholders. If `scip-typescript` is ABSENT (tree-sitter floor only), the verb LABELS its results `tier=tree-sitter-floor` / `partial` and does NOT present any `UNRESOLVED#` target as coverage — the test asserts NO `UNRESOLVED#`-prefixed target appears in the `implFuncs` coverage set; an unresolved target surfaced as coverage FAILS LOUD.
  - **(b) dead-code over real Atos** returns a count BELOW a sane ceiling (a stated max, e.g. < some fraction of total functions — NOT a floor-tier false-positive flood), AND every floor-tier result is labeled `CANDIDATE`. A flood (count over the ceiling) or an unlabeled floor-tier orphan FAILS LOUD.
  - **(c) cluster over real Atos is REPRODUCIBLE** — two runs at the SAME pinned SHA produce IDENTICAL grouping (deterministic coupling metric, R-FAIL on any non-determinism). Asserts run1 grouping deep-equals run2 grouping.
- **Contract refs**: graph-query-cli-contract.md (the three verbs), graph-store-schema-contract.md (the `file#function@LINE` funcId + `UNRESOLVED#` taxonomy), graph-parser-floor-contract.md (tier labels)
- **Dependencies**: M94-D9-T1 (cluster), M94-D9-T2 (dead-code), M94-D9-T3 (test-impl), M94-D3-T1/T2 (real extractor + build_index) — Wave-A foundation gated on Wave-2 build
- **Acceptance criteria**:
  - **(RE-PLAN-EXPANDED Fix-3 — the new verbs are proven on REAL Atos extractor output, not the mis-assumed bare-key shape.)** `[RULE] d9-verbs-proven-on-real-atos-extractor-output`.
  - test-impl: ≥N RESOLVED `file#function@LINE` impl funcIds; ZERO `UNRESOLVED#` targets presented as coverage; floor-tier results LABELED `tree-sitter-floor`/`partial` when SCIP absent — `[RULE] test-impl-never-presents-unresolved-as-coverage`.
  - dead-code: count below the stated sane ceiling (no flood); every floor-tier result labeled `CANDIDATE` — `[RULE] dead-code-no-floor-tier-flood-all-candidate-labeled`.
  - cluster: identical grouping across two runs at the same SHA — `[RULE] cluster-reproducible-same-sha`.
  - FAIL-LOUD-SKIP (`atos-repo-not-found`) when the repo is absent — never a silent green.

### M94-D9-T5 — RE-PLAN-EXPANDED Fix-7 (query-layer half): incompleteness coverage flag on who-imports/who-calls/blast-radius
- **Status**: [ ] pending
- **Headline**: false
- **Files**: `bin/gsd-t-graph-query-cli.cjs`, `.gsd-t/contracts/graph-query-cli-contract.md`, `test/m94-d9-incompleteness-flag.test.js`
- **Touches**: `bin/gsd-t-graph-query-cli.cjs`, `.gsd-t/contracts/graph-query-cli-contract.md`, `test/m94-d9-incompleteness-flag.test.js`
- **ImplPath**: `bin/gsd-t-graph-query-cli.cjs` — who-imports/who-calls/blast-radius read the indexer's recorded skipped-file set (D3-T6 records it in the store/manifest) and, when a query's reverse-reachable set COULD include skipped (unparsed) files, attach a `coverage` field to the envelope: `{ok:true, ..., coverage:{complete:false, unparsedContributors:N, note:"result may be incomplete — N contributing files unparsed"}}` instead of presenting a bare/empty result as authoritative. A complete query carries `coverage:{complete:true}`. This is the QUERY-LAYER half of Fix-7 (the D3-T6 INDEX-layer half records the skipped set + parse-success-rate).
- **Test**: `test/m94-d9-incompleteness-flag.test.js` — KILLING TEST: a fixture repo where file `B.ts` imports target `X.ts` but `B.ts` is DELIBERATELY UNPARSEABLE (registered in the skipped set) → `who-imports(X.ts)` MUST surface `coverage.complete:false` + `unparsedContributors >= 1` + the incompleteness note, and MUST NOT return a clean empty `{results:[]}` that reads as "no importers". A second fixture where all contributors parse → `coverage.complete:true`. `[RULE] query-surfaces-incompleteness-never-silent-empty`.
- **Contract refs**: graph-query-cli-contract.md (the `coverage` envelope field), graph-indexer-build-contract.md (D3-T6 — the skipped-file set the query reads), graph-store-schema-contract.md
- **Dependencies**: M94-D3-T6 (records the skipped-file set + parse-success-rate the query reads), M94-D9-T1/T2/T3 (CLI exists) — Wave A
- **Acceptance criteria**:
  - **(RE-PLAN-EXPANDED Fix-7 query-layer half — no silently-incomplete answer presented as authoritative.)** who-imports/who-calls/blast-radius attach a `coverage` field; when a target's only contributors live in skipped/unparsed files, the result carries `coverage.complete:false` + `unparsedContributors:N` + the note — `[RULE] query-surfaces-incompleteness-never-silent-empty`.
  - The killing test: one importer in a deliberately-unparseable file → the incompleteness flag surfaces, NEVER a bare empty result that reads as "no importers".
  - A fully-parsed query carries `coverage.complete:true` (the flag is honest both ways).
  - Same envelope + freshness-inline + fail-loud path; existing verb tests stay green (additive `coverage` field).

## Execution Estimate
- Total tasks: 5 (T1 cluster, T2 orphan/dangling, T3 test-impl, T4 real-Atos spotcheck [Fix-3], T5 incompleteness flag [Fix-7 query half])
- Independent tasks (no cross-domain blockers): T1/T2/T3 (additive verbs); T4 gated on Atos repo + D3 build; T5 gated on D3-T6 (skipped-file set)
- Intra-domain serial chain: T1/T2/T3/T5 all edit the same CLI + contract files → run SERIALLY within the domain (single owner, sequential edits) to avoid intra-file churn; T4 owns only its own test file (parallel-safe). Logically T1–T3 independent; T5 depends on T3's verbs existing + D3-T6's skipped set; T4 depends on T1–T3.
- Estimated checkpoints: 0 (Wave-A foundation; lands with d8 before reader/writer wiring)
