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
  - **[RE-PLAN Fix-3 — function-identity]** call-graph edges are keyed by a **`funcId` = `file#function` identity** (file-qualified, NOT a bare name) at BOTH endpoints, and each function entity carries its `funcId` — so same-named functions across files (`handle`/`init`/`run`) are DISTINCT, and `who-calls` can resolve one without merging callers across files. `[RULE] who-calls-function-identity-disambiguated` (the store-schema + query-cli contracts define the key; this extractor emits it)
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

### M94-D3-T5 — RE-PLAN Fix-2: parse_and_put tier-preservation (no silent accuracy downgrade on re-index)
- **Status**: [ ] pending
- **Files**: `test/m94-d3-tier-preserved-on-reindex.test.js`
- **Touches**: `test/m94-d3-tier-preserved-on-reindex.test.js`
- **ImplPath**: `bin/gsd-t-graph-index.cjs` (T2 — `parse_and_put`) + `bin/gsd-t-graph-scip-upgrade.cjs` (T3 — the tier labeller) — this test exercises the FROZEN tier-preservation invariant: a per-file re-index of a previously-compiler-accurate file MUST re-upgrade OR honestly flag `tree-sitter-floor-STALE-SCIP`, NEVER silently downgrade. The contract invariant (`graph-indexer-build-contract.md` `[RULE] reindex-tier-never-silently-downgraded`) is authored in T2/T3; this task is the killing test that binds it.
- **Test**: `test/m94-d3-tier-preserved-on-reindex.test.js` — `build_index` a fixture repo with a SCIP indexer PRESENT so a target file's edges are written `tier=compiler-accurate`; EDIT that file; call `parse_and_put(file)`; assert the re-indexed edges are EITHER (1) re-upgraded to `tier=compiler-accurate`, OR (2) explicitly labeled `tier=tree-sitter-floor-STALE-SCIP` (downgraded-WITH-flag) — and FAIL if they are silently relabeled plain `compiler-accurate` over tree-sitter-only edges (claims accuracy lost), silently relabeled plain `tree-sitter-floor` (loses the was-accurate signal), OR dropped to an unlabeled approximate edge the consumer reads as authoritative. **FAIL-LOUD-SKIP with `scip-indexer-not-present`** if no SCIP indexer is installed (mirrors D3-T4's fail-loud-skip — the test cannot silent-green where it could never observe a compiler-accurate tier to downgrade). `[RULE] reindex-tier-never-silently-downgraded`.
- **Contract refs**: graph-indexer-build-contract (T2 — `parse_and_put` + the tier-preservation invariant), graph-store-schema-contract (D1 — the `tier` enum incl. `tree-sitter-floor-STALE-SCIP`)
- **Dependencies**: M94-D3-T2 (`parse_and_put`), M94-D3-T3 (the SCIP tier labeller)
- **Acceptance criteria**:
  - (RE-PLAN Fix-2 — silent accuracy DOWNGRADE on incremental re-index closed; the determinism/accuracy premise on the AC-3 path held)
  - `parse_and_put(file)` on a previously-`compiler-accurate` file EITHER re-upgrades to `compiler-accurate` OR labels `tree-sitter-floor-STALE-SCIP` — `[RULE] reindex-tier-never-silently-downgraded`
  - FAILS if the re-index silently relabels plain `compiler-accurate` over tree-sitter-only edges (smart-reach silently degrading to dumb-reach while still claiming accuracy — the exact bug), silently relabels plain `tree-sitter-floor` (loses the was-accurate signal), or drops to an unlabeled approximate edge
  - FAIL-LOUD-SKIP with `scip-indexer-not-present` when no SCIP indexer is installed — never a silent green
  - The invariant is FROZEN in `graph-indexer-build-contract.md` BEFORE D3/D4 execute (T2/T3 author it; this test binds it)

### M94-D3-T6 — RE-PLAN-EXPANDED Fix-7 (index-layer half): AC-2 completeness guard — skipped-file set + parse-success-rate floor
- **Status**: [ ] pending
- **Headline**: false
- **Files**: `bin/gsd-t-graph-index.cjs`, `.gsd-t/contracts/graph-indexer-build-contract.md`, `test/m94-d3-parse-completeness.test.js`
- **Touches**: `test/m94-d3-parse-completeness.test.js`
- **ImplPath**: `bin/gsd-t-graph-index.cjs` (D3-T2 — `build_index`, sole owner; the impl edit folds into T2's owned file) — `build_index` RECORDS the set of files SKIPPED for parse errors (the K2 spike measured **773 skipped of 4,418 enumerated** on real Atos — a skipped file contributes ZERO edges, so its imports/callers silently vanish from who-imports/who-calls/blast-radius; THIS VIOLATES the no-wrong-answer invariant — a silent empty result reads as "no importers"). `build_index` writes (a) the skipped-file set + (b) a `parseSuccessRate` against a STATED floor into the store/build-manifest. The contract (`graph-indexer-build-contract.md`, D3-T2 sole owner) declares the floor (e.g. **≥95%** of enumerated source files parse, OR the build records the gap as a known limitation with the exact skipped count). The query-layer half (D9-T5) READS this skipped set to attach the incompleteness `coverage` flag. NOTE: 773/4,418 ≈ 82.5% on current Atos is BELOW a 95% floor → the build records this as a KNOWN LIMITATION (the contract permits floor-miss IFF it's recorded as a limitation, never silently); the secondary investigation (WHY 773 fail — large-file/grammar/encoding beyond the 32KB-buffer + python-ABI fixes already applied) is tracked separately but the completeness guard is the correctness invariant regardless of the raw parse rate.
- **Test**: `test/m94-d3-parse-completeness.test.js` — KILLING TEST: (1) `build_index` over a fixture where K files are deliberately unparseable → assert the build records EXACTLY those K files in the skipped set AND a `parseSuccessRate` field = (enumerated − K)/enumerated; (2) assert that when `parseSuccessRate` is below the stated floor, the build records a `knownLimitation` flag (never a silent omission — a below-floor build with NO limitation record FAILS); (3) the real-Atos path (gated, FAIL-LOUD-SKIP `atos-repo-not-found` when absent) asserts the recorded skipped count is present and non-silent (the 773 are ENUMERATED, not dropped on the floor). `[RULE] build-records-skipped-set-and-parse-success-rate`.
- **Contract refs**: graph-indexer-build-contract.md (D3-T2 — the parse-success-rate floor + skipped-set recording invariant), graph-store-schema-contract.md (D1 — the skipped-set/manifest columns), graph-query-cli-contract.md (D9-T5 reads this set)
- **Dependencies**: M94-D3-T2 (`build_index` — the impl edit folds into T2's sole-owned file + contract) — Wave-2 build
- **Acceptance criteria**:
  - **(RE-PLAN-EXPANDED Fix-7 index-layer half — the silent-MISSING-edge wrong-answer-as-fact gap closed at the source.)** `build_index` records the skipped-file set + a `parseSuccessRate` against a stated floor — `[RULE] build-records-skipped-set-and-parse-success-rate`.
  - A below-floor parse rate is recorded as a `knownLimitation` (with the exact skipped count) — NEVER a silent omission; a below-floor build with no limitation record FAILS.
  - The skipped set is the data D9-T5's query-layer `coverage` flag reads — the two halves (index records, query surfaces) together guarantee a silently-incomplete answer is never presented as authoritative.
  - Real-Atos path FAIL-LOUD-SKIP (`atos-repo-not-found`) when absent; with Atos present, the ~773 skipped files are ENUMERATED in the recorded set, not silently dropped.
  - Secondary (non-blocking): investigate WHY 773 Atos files fail to parse (large-file/grammar/encoding beyond the 32KB-buffer + python-ABI fixes already applied) — raising the parse rate is SECONDARY to the completeness guard; the guard is correct regardless of how many get fixed.

## Execution Estimate
- Total tasks: 6 (T6 added — RE-PLAN-EXPANDED Fix-7 index-layer completeness guard)
- Independent tasks (no cross-domain blockers): 0 (all gated on the Wave-1 HARD GATE contracts)
- Blocked tasks (waiting on other domains): T1 (on d1 store-schema + d2 parser-floor contracts, via the gate)
- Intra-domain serial chain: T1 → T2 → T3, T1 → T2 → T4, T2 → T3 → T5, T2 → T6 (T6's impl folds into T2's `build_index` + contract; T6 owns only its own test file)
- Estimated checkpoints: 1 (Wave-2 integration with d4 + d5 over the shared on-disk store)
