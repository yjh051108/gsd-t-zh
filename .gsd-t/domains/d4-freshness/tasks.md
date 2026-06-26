# Tasks: d4-freshness

## Summary
When all tasks complete: a content-hash freshness checker that catches uncommitted working-tree edits (git-SHA unchanged), re-indexes a stale file via D3's `parse_and_put` FUNCTION (not a file edit), and re-validates its DIRECT-importer edges one-hop only (never transitive) — exposed as the `freshness_check_on_query` surface D5 calls inline, relying on the store's atomicity guarantee for torn-read-free writes. The AC-3 timing is SPLIT: T1/T2 are deterministic correctness gates (NO inline timing), T3 measures the sub-~1s budget at 1.5M-node scale. WAVE-2 BUILD — after the K1+K2 HARD GATE; runs concurrently with d3 and d5. Reads D1's store-schema read-only; calls D3's parse function (function-level, keeps this domain file-disjoint from D3). No query or scan logic.

## Wave 2

### M94-D4-T1 — Content-hash freshness checker + freshness contract
- **Status**: [ ] pending
- **Headline**: true
- **Files**: `bin/gsd-t-graph-freshness.cjs`, `.gsd-t/contracts/graph-freshness-contract.md`, `test/m94-d4-freshness.test.js`
- **Touches**: `bin/gsd-t-graph-freshness.cjs`, `.gsd-t/contracts/graph-freshness-contract.md`, `test/m94-d4-freshness.test.js`
- **ImplPath**: `bin/gsd-t-graph-freshness.cjs` — `compute_touched_files()`: scan ALL indexed files + the working tree, return the whole-tree dirty set (content-hash edits ∪ adds ∪ deletes), NOT just the query target; `freshness_check_on_query(touched_files)`: per file, hash CONTENT (Node `crypto`, not git-SHA) vs the stored hash; stale → call D3's `parse_and_put(file)` + re-validate edges from its DIRECT importers one-hop only; adds enter the graph, deletes remove/flag dangling edges
- **Test**: `test/m94-d4-freshness.test.js` — **DETERMINISTIC CORRECTNESS ONLY, NO timing assertion** (`[#6 timing split]`): asserts content-hash dirty-detection flags a changed file; asserts one-hop (NOT transitive) re-validation (a 2-hop importer is NOT re-checked); asserts re-index goes through D3's `parse_and_put`. The sub-~1s number is NOT asserted here — it is measured separately at scale in T3. (A timing assert on a toy fixture flakes.)
- **Contract refs**: graph-store-schema-contract (D1, read-only — the stored content-hash column + the atomicity guarantee D4 relies on), graph-indexer-build-contract (D3 — `parse_and_put` called, not edited), graph-freshness-contract (authored here)
- **Dependencies**: M94-D3-T2 (the `parse_and_put` surface) — and the Wave-1 HARD GATE; reads M94-D1-T3 store-schema
- **Acceptance criteria**:
  - Hashes each touched file's CONTENT vs the stored hash — `[RULE] freshness-content-hash-not-git-sha`
  - Stale → re-index via D3's `parse_and_put` + re-validate edges from DIRECT importers one-hop only — `[RULE] one-hop-revalidation-not-transitive`
  - **[#4 atomicity]** The re-index WRITE relies on the store's declared atomicity mechanism (graph-store-schema-contract.md sub-criterion 4) — `[RULE] freshness-write-atomic-no-torn-read`: a concurrent `who-imports(F)` during re-index returns fully-old OR fully-new, never torn. D4 does NOT roll its own locking — it uses the store's single-writer-lock / atomic-write+rename / txn guarantee.
  - Authors `graph-freshness-contract.md` declaring `compute_touched_files()` + `freshness_check_on_query(touched_files)` + the touched-set-derivation rule (whole-tree dirty, not query target) + the add/delete/rename rule + the AC-3 timing split + the atomicity-reliance invariant — the surface D5 calls inline
  - **[Fix-1 touched-set derivation]** `compute_touched_files()` scans ALL indexed files for content-hash drift (whole-tree dirty set), NEVER just the query target — `[RULE] touched-set-is-whole-tree-dirty-not-query-target`
  - **[Fix-2 add/delete/rename]** the dirty-set enumerates ADDS + DELETES (rename = delete + add), not only re-hashing existing files — `[RULE] freshness-detects-add-delete-rename`
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
- **ImplPath**: `bin/gsd-t-graph-freshness.cjs` (T1 — `compute_touched_files()` + `freshness_check_on_query`) — this task MEASURES BOTH freshness costs at ~1.5M-node scale (reusing the D1 synthetic graph) and records the wall-clock; no new impl: (a) the per-edit re-index + one-hop re-validation, AND (b) **[Fix-1 follow-on]** the whole-tree `compute_touched_files()` dirty-scan cost per query (the mtime-prefilter → content-hash path Fix-1 introduced — scanning ALL indexed files on every query is a new per-query cost that did NOT exist before Fix-1)
- **Test**: `test/m94-d4-freshness.test.js` (T1 — shared) — the measurement harness's envelope (per-edit ms + the < 1 s ceiling field) is shape-asserted; the real scale-measurement number is recorded in the result doc, NOT a unit assertion
- **Contract refs**: graph-freshness-contract (T1)
- **Dependencies**: M94-D4-T1
- **Acceptance criteria**:
  - (AC-3 — the SCALE-BUDGET half of the timing split — `[#6 timing split]`)
  - Measures single-file re-index + one-hop re-validation per-edit wall-clock at ~1.5M-node scale (the D1 synthetic graph), against the pre-committed **< 1 s** ceiling
  - **[Fix-1 follow-on — whole-tree dirty-scan budget]** ALSO measures the `compute_touched_files()` whole-tree dirty-scan cost per query at ~1.5M-node scale (the mtime-prefilter → content-hash path Fix-1 introduced), against the same **< 1 s** per-query ceiling — `[RULE] touched-set-dirty-scan-under-budget`. Scanning ALL indexed files on every query is a NEW per-query cost; the mtime-prefilter is the load-bearing optimization and MUST be measured at scale, never assumed. FAILS the AC-3 budget if the whole-tree dirty-scan exceeds the ceiling (a kill/re-scope signal: e.g. fall back to a git-status-bounded candidate set, recorded as an AC-descope)
  - Records both numbers + the ceiling + a LIVE-CLOCK timestamp in the result doc; FAILS the AC-3 budget if either the per-edit time OR the whole-tree dirty-scan time exceeds the ceiling
  - This is the ONLY place the sub-~1s timing is asserted — never inline on a toy fixture (T1/T2 stay deterministic-correctness)

### M94-D4-T4 — Pre-mortem Fix-1: touched-set derivation killing test (edited non-target served fresh)
- **Status**: [ ] pending
- **Files**: `test/m94-d4-touched-set-derivation.test.js`
- **Touches**: `test/m94-d4-touched-set-derivation.test.js`
- **ImplPath**: `bin/gsd-t-graph-freshness.cjs` (T1 — `compute_touched_files()` + `freshness_check_on_query`) — this test proves the dirty-set source is the whole tree, NOT the query target, so an edited NON-target file is never served stale
- **Test**: `test/m94-d4-touched-set-derivation.test.js` — index a 3-file fixture (A imports B, B imports C). Edit B's CONTENT WITHOUT querying B. Then query `who-imports(C)`. Assert the answer reflects B's NEW state (B's edit changed its import of C). The test FAILS if an edited non-target file (B) is served stale because the derivation only re-hashed the query target — proving `compute_touched_files()` scans the whole indexed tree, not just the target. Deterministic, no timing assertion (per the #6 timing split).
- **Contract refs**: graph-freshness-contract (T1 — `[RULE] touched-set-is-whole-tree-dirty-not-query-target`)
- **Dependencies**: M94-D4-T1
- **Acceptance criteria**:
  - (Pre-mortem Fix-1 — touched_files derivation defined + proven; CORRECTNESS gate, no timing)
  - 3-file fixture (A→B→C); B's CONTENT edited but B is NOT the query target; `who-imports(C)` reflects B's NEW state — `[RULE] touched-set-is-whole-tree-dirty-not-query-target`
  - FAILS LOUD if the implementation derives `touched_files` from only the query target (B's edit would then be invisible and C's importer set served stale)

### M94-D4-T5 — Pre-mortem Fix-2: add/delete/rename freshness test
- **Status**: [ ] pending
- **Files**: `test/m94-d4-add-delete-rename-freshness.test.js`
- **Touches**: `test/m94-d4-add-delete-rename-freshness.test.js`
- **ImplPath**: `bin/gsd-t-graph-freshness.cjs` (T1 — the add/delete enumeration in `compute_touched_files()`) — this test proves freshness handles structural change beyond the EDIT case
- **Test**: `test/m94-d4-add-delete-rename-freshness.test.js` — three cases on a fixture index:
  - **(1) delete** — delete an indexed file F that another file G imported; query `who-imports` of the file F imported; assert F's dangling edge is REMOVED/flagged (not returned live).
  - **(2) add** — add a new file H importing an existing file E; query `who-imports(E)`; assert H appears as a new importer.
  - **(3) rename** — rename a file (old → new path); assert the old path is GONE from the graph and the new path is PRESENT (rename = delete + add).
  Deterministic, no timing assertion (#6 timing split).
- **Contract refs**: graph-freshness-contract (T1 — `[RULE] freshness-detects-add-delete-rename`)
- **Dependencies**: M94-D4-T1
- **Acceptance criteria**:
  - (Pre-mortem Fix-2 — add/delete/rename freshness; CORRECTNESS gate, no timing)
  - delete → dangling edge removed/flagged (not served live); add → new importer surfaces; rename → old path gone + new path present — `[RULE] freshness-detects-add-delete-rename`
  - FAILS LOUD if freshness only re-hashes existing files and ignores adds/deletes (the EDIT-only blind spot the pre-mortem flagged)

## Execution Estimate
- Total tasks: 5
- Independent tasks (no cross-domain blockers): 0 (gated on the Wave-1 HARD GATE + D3's `parse_and_put` surface)
- Blocked tasks (waiting on other domains): T1 (on d3's build/put contract; on d1's store-schema)
- Intra-domain serial chain: T1 → T2, T1 → T3, T1 → T4, T1 → T5
- Estimated checkpoints: 1 (Wave-2 integration with d3 + d5 over the shared on-disk store)
