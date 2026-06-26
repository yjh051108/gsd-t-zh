# Tasks: d9-query-cli-extensions (WAVE A — new verbs, BEFORE consumer wiring)

## Summary
When all tasks complete: `bin/gsd-t-graph-query-cli.cjs` exposes three NEW verb families — `cluster` (tightly-coupled file groups, for partition/project), `dead-code`/`orphan` + `dangling` (absence queries, for qa/verify), and `test-impl` (test→impl coverage, for test-sync) — all ADDITIVE to the existing who-imports/who-calls/blast-radius/status, all through the same freshness-inline + fail-loud envelope, all declared in `graph-query-cli-contract.md`. CONFIRMED this plan pass: test→impl needs NO new d3 edge type (call-site edges are already funcId-keyed file#function at both ends — the verb filters them by test-path source). Wave A — lands with d8 before the reader/writer wiring (d10/d11) consumes these verbs.

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

## Execution Estimate
- Total tasks: 3
- Independent tasks (no cross-domain blockers): all 3 (the Wave-2 CLI exists; each verb is additive + independent)
- Intra-domain serial chain: T1/T2/T3 all edit the same CLI + contract files → run SERIALLY within the domain (single owner, sequential edits) to avoid intra-file churn; logically independent
- Estimated checkpoints: 0 (Wave-A foundation; lands with d8 before reader/writer wiring)
