# Tasks: d4-freshness

## Summary
When all tasks complete: a content-hash freshness checker that catches uncommitted working-tree edits (git-SHA unchanged), re-indexes a stale file via D3's `parse_and_put` FUNCTION (not a file edit), and re-validates its DIRECT-importer edges one-hop only (never transitive) — exposed as the `freshness_check_on_query` surface D5 calls inline, relying on the store's atomicity guarantee for torn-read-free writes. The AC-3 timing is SPLIT: T1/T2 are deterministic correctness gates (NO inline timing), T3 measures the sub-~1s budget at 1.5M-node scale. WAVE-2 BUILD — after the K1+K2 HARD GATE; runs concurrently with d3 and d5. Reads D1's store-schema read-only; calls D3's parse function (function-level, keeps this domain file-disjoint from D3). No query or scan logic.

## Wave 2

### M94-D4-T1 — Content-hash freshness checker + freshness contract
- **Status**: [ ] pending
- **Headline**: true
- **Files**: `bin/gsd-t-graph-freshness.cjs`, `.gsd-t/contracts/graph-freshness-contract.md`, `test/m94-d4-freshness.test.js`
- **Touches**: `bin/gsd-t-graph-freshness.cjs`, `.gsd-t/contracts/graph-freshness-contract.md`, `test/m94-d4-freshness.test.js`
- **ImplPath**: `bin/gsd-t-graph-freshness.cjs` — `freshness_check_on_query(touched_files)`: per file, hash CONTENT (Node `crypto`, not git-SHA) vs the stored hash; stale → call D3's `parse_and_put(file)` + re-validate edges from its DIRECT importers one-hop only
- **Test**: `test/m94-d4-freshness.test.js` — **DETERMINISTIC CORRECTNESS ONLY, NO timing assertion** (`[#6 timing split]`): asserts content-hash dirty-detection flags a changed file; asserts one-hop (NOT transitive) re-validation (a 2-hop importer is NOT re-checked); asserts re-index goes through D3's `parse_and_put`. The sub-~1s number is NOT asserted here — it is measured separately at scale in T3. (A timing assert on a toy fixture flakes.)
- **Contract refs**: graph-store-schema-contract (D1, read-only — the stored content-hash column + the atomicity guarantee D4 relies on), graph-indexer-build-contract (D3 — `parse_and_put` called, not edited), graph-freshness-contract (authored here)
- **Dependencies**: M94-D3-T2 (the `parse_and_put` surface) — and the Wave-1 HARD GATE; reads M94-D1-T3 store-schema
- **Acceptance criteria**:
  - Hashes each touched file's CONTENT vs the stored hash — `[RULE] freshness-content-hash-not-git-sha`
  - Stale → re-index via D3's `parse_and_put` + re-validate edges from DIRECT importers one-hop only — `[RULE] one-hop-revalidation-not-transitive`
  - **[#4 atomicity]** The re-index WRITE relies on the store's declared atomicity mechanism (graph-store-schema-contract.md sub-criterion 4) — `[RULE] freshness-write-atomic-no-torn-read`: a concurrent `who-imports(F)` during re-index returns fully-old OR fully-new, never torn. D4 does NOT roll its own locking — it uses the store's single-writer-lock / atomic-write+rename / txn guarantee.
  - Authors `graph-freshness-contract.md` declaring `freshness_check_on_query(touched_files)` + the AC-3 timing split + the atomicity-reliance invariant — the surface D5 calls inline
  - Re-index is a FUNCTION CALL into D3's module — NEVER an edit to D3's files (keeps file-disjointness)

### M94-D4-T2 — AC-3 killing test: uncommitted edit caught
- **Status**: [ ] pending
- **Files**: `test/m94-d4-uncommitted-edit-caught.test.js`
- **Touches**: `test/m94-d4-uncommitted-edit-caught.test.js`
- **ImplPath**: `bin/gsd-t-graph-freshness.cjs` (T1) — this test exercises the content-hash path end-to-end
- **Test**: `test/m94-d4-uncommitted-edit-caught.test.js` — the AC-3 KILLING test, **DETERMINISTIC, NO timing assertion** (`[#6 timing split]`): edits a working-tree file WITHOUT committing (git-SHA unchanged) and asserts the content-hash detects the change and re-indexes it. Fails LOUD if the implementation used git-SHA (which would miss the uncommitted edit) — this is the structural proof the freshness key is content, not commit.
- **Contract refs**: graph-freshness-contract (T1)
- **Dependencies**: M94-D4-T1
- **Acceptance criteria**:
  - (AC-3 — incremental freshness, uncommitted-edit killing test — CORRECTNESS gate, no timing)
  - Edits a working-tree file WITHOUT committing; the content-hash mismatch IS detected and the file re-indexed — the test fails if a git-SHA-based implementation lets the unchanged SHA pass
  - One-hop (not transitive) re-validation asserted: a 2-hop importer is NOT re-checked
  - **NO inline wall-clock assertion** — the sub-~1s budget is measured at scale in T3, not asserted on this toy fixture (flake-proof)

### M94-D4-T3 — AC-3 scale-budget measurement (sub-~1s at 1.5M-node scale)
- **Status**: [ ] pending
- **Files**: `.gsd-t/spikes/ac3-freshness-scale-budget-results.md`
- **Touches**: `.gsd-t/spikes/ac3-freshness-scale-budget-results.md`
- **ImplPath**: `bin/gsd-t-graph-freshness.cjs` (T1) — this task MEASURES the freshness path at ~1.5M-node scale (reusing the D1 synthetic graph) and records the per-edit wall-clock; no new impl
- **Test**: `test/m94-d4-freshness.test.js` (T1 — shared) — the measurement harness's envelope (per-edit ms + the < 1 s ceiling field) is shape-asserted; the real scale-measurement number is recorded in the result doc, NOT a unit assertion
- **Contract refs**: graph-freshness-contract (T1)
- **Dependencies**: M94-D4-T1
- **Acceptance criteria**:
  - (AC-3 — the SCALE-BUDGET half of the timing split — `[#6 timing split]`)
  - Measures single-file re-index + one-hop re-validation per-edit wall-clock at ~1.5M-node scale (the D1 synthetic graph), against the pre-committed **< 1 s** ceiling
  - Records the number + the ceiling + a LIVE-CLOCK timestamp in the result doc; FAILS the AC-3 budget if the measured per-edit time exceeds the ceiling
  - This is the ONLY place the sub-~1s timing is asserted — never inline on a toy fixture (T1/T2 stay deterministic-correctness)

## Execution Estimate
- Total tasks: 3
- Independent tasks (no cross-domain blockers): 0 (gated on the Wave-1 HARD GATE + D3's `parse_and_put` surface)
- Blocked tasks (waiting on other domains): T1 (on d3's build/put contract; on d1's store-schema)
- Intra-domain serial chain: T1 → T2, T1 → T3
- Estimated checkpoints: 1 (Wave-2 integration with d3 + d5 over the shared on-disk store)
