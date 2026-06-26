# Tasks: d4-freshness

## Summary
When all tasks complete: a content-hash freshness checker that catches uncommitted working-tree edits (git-SHA unchanged), re-indexes a stale file via D3's `parse_and_put` FUNCTION (not a file edit), and re-validates its DIRECT-importer edges one-hop only (never transitive), sub-~1s — exposed as the `freshness_check_on_query` surface D5 calls inline. WAVE-2 BUILD — after the K1+K2 HARD GATE; runs concurrently with d3 and d5. Reads D1's store-schema read-only; calls D3's parse function (function-level, keeps this domain file-disjoint from D3). No query or scan logic.

## Wave 2

### M94-D4-T1 — Content-hash freshness checker + freshness contract
- **Status**: [ ] pending
- **Headline**: true
- **Files**: `bin/gsd-t-graph-freshness.cjs`, `.gsd-t/contracts/graph-freshness-contract.md`, `test/m94-d4-freshness.test.js`
- **Touches**: `bin/gsd-t-graph-freshness.cjs`, `.gsd-t/contracts/graph-freshness-contract.md`, `test/m94-d4-freshness.test.js`
- **ImplPath**: `bin/gsd-t-graph-freshness.cjs` — `freshness_check_on_query(touched_files)`: per file, hash CONTENT (Node `crypto`, not git-SHA) vs the stored hash; stale → call D3's `parse_and_put(file)` + re-validate edges from its DIRECT importers one-hop only
- **Test**: `test/m94-d4-freshness.test.js` — asserts content-hash dirty-detection flags a changed file; asserts one-hop (NOT transitive) re-validation (a 2-hop importer is NOT re-checked); asserts the sub-~1s budget on the freshness path (the AC-3 capability exercised end-to-end on the real module)
- **Contract refs**: graph-store-schema-contract (D1, read-only — the stored content-hash column), graph-indexer-build-contract (D3 — `parse_and_put` called, not edited), graph-freshness-contract (authored here)
- **Dependencies**: M94-D3-T2 (the `parse_and_put` surface) — and the Wave-1 HARD GATE; reads M94-D1-T3 store-schema
- **Acceptance criteria**:
  - Hashes each touched file's CONTENT vs the stored hash — `[RULE] freshness-content-hash-not-git-sha`
  - Stale → re-index via D3's `parse_and_put` + re-validate edges from DIRECT importers one-hop only — `[RULE] one-hop-revalidation-not-transitive`
  - Authors `graph-freshness-contract.md` declaring `freshness_check_on_query(touched_files)` — the surface D5 calls inline
  - Sub-~1s per edit (the AC-3 budget)
  - Re-index is a FUNCTION CALL into D3's module — NEVER an edit to D3's files (keeps file-disjointness)

### M94-D4-T2 — AC-3 killing test: uncommitted edit caught
- **Status**: [ ] pending
- **Files**: `test/m94-d4-uncommitted-edit-caught.test.js`
- **Touches**: `test/m94-d4-uncommitted-edit-caught.test.js`
- **ImplPath**: `bin/gsd-t-graph-freshness.cjs` (T1) — this test exercises the content-hash path end-to-end
- **Test**: `test/m94-d4-uncommitted-edit-caught.test.js` — the AC-3 KILLING test: edits a working-tree file WITHOUT committing (git-SHA unchanged) and asserts the content-hash detects the change and re-indexes it. Fails LOUD if the implementation used git-SHA (which would miss the uncommitted edit) — this is the structural proof the freshness key is content, not commit.
- **Contract refs**: graph-freshness-contract (T1)
- **Dependencies**: M94-D4-T1
- **Acceptance criteria**:
  - (AC-3 — incremental freshness, uncommitted-edit killing test)
  - Edits a working-tree file WITHOUT committing; the content-hash mismatch IS detected and the file re-indexed — the test fails if a git-SHA-based implementation lets the unchanged SHA pass
  - One-hop (not transitive) re-validation asserted: a 2-hop importer is NOT re-checked
  - Sub-~1s budget asserted on the freshness path

## Execution Estimate
- Total tasks: 2
- Independent tasks (no cross-domain blockers): 0 (gated on the Wave-1 HARD GATE + D3's `parse_and_put` surface)
- Blocked tasks (waiting on other domains): T1 (on d3's build/put contract; on d1's store-schema)
- Intra-domain serial chain: T1 → T2
- Estimated checkpoints: 1 (Wave-2 integration with d3 + d5 over the shared on-disk store)
