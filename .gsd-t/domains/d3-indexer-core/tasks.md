# Tasks: d3-indexer-core

## Summary
When all tasks complete: a fresh `build_index` that parses every source file via the tree-sitter floor (optionally SCIP-upgraded), extracts import + call + entity edges per the D2 taxonomy, writes them to the D1 store with an honest accuracy tier, and exposes a per-file `parse_and_put` surface D4/D5 call (a function-level surface, NOT a shared file edit). WAVE-2 BUILD — starts only after the K1+K2 HARD GATE passes; runs concurrently with d4 and d5. Consumes D1's store-schema + D2's parser-floor taxonomy as FROZEN. This domain WRITES store records only — no freshness, no query logic.

## Wave 2

### M94-D3-T1 — Fresh edge extraction (D2 taxonomy → entities + edges)
- **Status**: [ ] pending
- **Files**: `bin/gsd-t-graph-edge-extract.cjs`, `test/m94-d3-indexer-core.test.js`
- **Touches**: `bin/gsd-t-graph-edge-extract.cjs`, `test/m94-d3-indexer-core.test.js`
- **ImplPath**: `bin/gsd-t-graph-edge-extract.cjs` — per-file extraction of entities + import-graph (file→file) + call-graph (function→function) edges, built FRESH on tree-sitter per the D2 taxonomy
- **Test**: `test/m94-d3-indexer-core.test.js` — a hand-checked fixture yields the expected who-imports / who-calls edges (the AC-2 correctness seed); output shape asserted against the D1 store-schema columns
- **Contract refs**: graph-parser-floor-contract (D2), graph-store-schema-contract (D1)
- **Dependencies**: M94-D2-T1 (parser-floor contract), M94-D1-T3 (store-schema contract) — both via the Wave-1 HARD GATE
- **Acceptance criteria**:
  - Extracts entities + import-graph (file→file) + call-graph (function→function) edges per the D2 taxonomy
  - Built FRESH on tree-sitter — NOT lifted from `bin/graph-parsers.js` (read for the taxonomy WHAT only; the regex HOW is superseded per PseudoCode §Divergence)
  - Output shape matches the D1 store-schema columns
  - Test: hand-checked fixture yields the expected who-imports / who-calls edges (AC-2 seed) — fails if extraction is dead/empty

### M94-D3-T2 — build_index + store write + build/put contract
- **Status**: [ ] pending
- **Headline**: true
- **Files**: `bin/gsd-t-graph-index.cjs`, `.gsd-t/contracts/graph-indexer-build-contract.md`
- **Touches**: `bin/gsd-t-graph-index.cjs`, `.gsd-t/contracts/graph-indexer-build-contract.md`
- **ImplPath**: `bin/gsd-t-graph-index.cjs` — `build_index(repo)` (full-repo build) + `parse_and_put(file)` (per-file re-index surface D4/D5 call); writes `store.put(file, content_hash, entities, edges, tier)` per the D1 schema
- **Test**: `test/m94-d3-indexer-core.test.js` — builds a fixture repo end-to-end and asserts store records are written with the right entities/edges/columns; asserts `parse_and_put(file)` re-parses a single file and returns its new entities/edges (the surface D4/D5 depend on is exercised, not dead)
- **Contract refs**: graph-store-schema-contract (D1), graph-indexer-build-contract (authored here)
- **Dependencies**: M94-D3-T1
- **Acceptance criteria**:
  - `build_index(repo)`: per-file tree-sitter floor parse → edge-extract → `store.put(file, content_hash, entities, edges, tier)`
  - Exposes a callable per-file `parse_and_put(file)` surface (the build/put contract) D4 + D5 invoke — a function-level surface, NOT a shared file edit
  - Authors `graph-indexer-build-contract.md` declaring `build_index` + `parse_and_put` and the honesty invariants

### M94-D3-T3 — SCIP upgrade + accuracy tiers (AC-6 honesty)
- **Status**: [ ] pending
- **Files**: `bin/gsd-t-graph-scip-upgrade.cjs`, `test/m94-d3-accuracy-tiers.test.js`
- **Touches**: `bin/gsd-t-graph-scip-upgrade.cjs`, `test/m94-d3-accuracy-tiers.test.js`
- **ImplPath**: `bin/gsd-t-graph-scip-upgrade.cjs` — detects scip-typescript / scip-python / rust-analyzer scip if present (child-process, never an installer dep); re-derives that language's edges compiler-accurate and labels `tier`; SCIP absent → `tier=tree-sitter-floor`
- **Test**: `test/m94-d3-accuracy-tiers.test.js` — asserts both tiers are LABELED (never an unlabeled mix); asserts a Rust cross-crate edge carries the `partial` flag while a within-crate edge does not; asserts SCIP-absent degrades to tree-sitter-floor (degrades, never breaks)
- **Contract refs**: graph-indexer-build-contract (T2)
- **Dependencies**: M94-D3-T2
- **Acceptance criteria**:
  - (AC-6 — accuracy tiers honest)
  - Detects scip-typescript / scip-python / rust-analyzer scip if present; re-derives that language's edges compiler-accurate; labels `tier=compiler-accurate`
  - SCIP absent → `tier=tree-sitter-floor` — the graph NEVER depends on SCIP to FUNCTION, only to get BETTER (degrades, never breaks)
  - `[RULE] accuracy-tier-labeled-never-silently-wrong`: never an unlabeled mix (test asserts both tiers labeled)
  - `[RULE] rust-cross-crate-flagged-partial`: Rust cross-crate edges flagged `partial` (rust-analyzer SCIP is officially "limited"); within-crate resolves (test asserts the flag)
  - SCIP indexers + tree-sitter grammars are local one-shot child-process tools — NEVER added to shipped installer `dependencies`

### M94-D3-T4 — Pre-mortem Fix-4: real-Atos edge spotcheck (binds AC-2 correctness to real data)
- **Status**: [ ] pending
- **Files**: `test/m94-d3-real-atos-edge-spotcheck.test.js`
- **Touches**: `test/m94-d3-real-atos-edge-spotcheck.test.js`
- **ImplPath**: `bin/gsd-t-graph-index.cjs` (T2 — `build_index`) + `bin/gsd-t-graph-edge-extract.cjs` (T1) — this test runs the real `build_index` over the REAL Atos repo at the pinned SHA and spot-checks that hand-picked known real edges appear, so AC-2 correctness is not confined to toy fixtures (which could pass on near-zero/garbage real-world extraction)
- **Test**: `test/m94-d3-real-atos-edge-spotcheck.test.js` — **gated on the Atos repo being present at `/Users/david/projects/HiloAviation/hilo-figma-atos`**; if absent, FAIL-LOUD-SKIP (mark skipped with an explicit `atos-repo-not-found` reason — mirrors K2's `repo-not-found` pattern, never a silent green). When present: `build_index` over real Atos at the pinned SHA, then assert (a) ≥3 HAND-PICKED known real imports/calls (named in the test) appear correctly in `who-imports`/`who-calls`, AND (b) total edge count exceeds a floor (e.g. > 10k edges) — proving the extractor is not emitting ~0/garbage edges on real TS/Python at scale (tsconfig path-aliases, monorepo resolution). Records/asserts the pinned Atos SHA (`git -C <atos> rev-parse HEAD`) so the spotcheck is bound to a known tree.
- **Contract refs**: graph-indexer-build-contract (T2), graph-parser-floor-contract (D2)
- **Dependencies**: M94-D3-T2 (build_index), M94-D3-T1 (edge-extract)
- **Acceptance criteria**:
  - (Pre-mortem Fix-4 — AC-2 correctness bound to REAL Atos data, not only hand-checked fixtures)
  - Gated on Atos present; FAIL-LOUD-SKIP with `atos-repo-not-found` when absent (mirrors K2's fail-loud-skip — never a silent pass) — `[RULE] real-atos-edge-spotcheck-or-loud-skip`
  - With Atos present: ≥3 hand-picked known real imports/calls appear correctly in who-imports/who-calls AND total edge count > the pre-registered floor (e.g. > 10k) — FAILS if real extraction is near-zero/garbage
  - Binds to the pinned Atos SHA (same pin family as K2 #7 / AC-4 #7); the spotcheck is rejected if recorded against an unpinned tree

## Execution Estimate
- Total tasks: 4
- Independent tasks (no cross-domain blockers): 0 (all gated on the Wave-1 HARD GATE contracts)
- Blocked tasks (waiting on other domains): T1 (on d1 store-schema + d2 parser-floor contracts, via the gate)
- Intra-domain serial chain: T1 → T2 → T3, T1 → T2 → T4
- Estimated checkpoints: 1 (Wave-2 integration with d4 + d5 over the shared on-disk store)
