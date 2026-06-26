# Tasks: d1-store-bakeoff-spike

## Summary
When all tasks complete: a measured store choice (or KILL/re-scope verdict) recorded in progress.md, and a STABLE `graph-store-schema-contract.md` (node/edge/tier/content-hash columns) that unblocks the Wave-2 build trio. WAVE-1 PROVE-OR-KILL spike (K1) — throwaway feasibility code, no production indexer/freshness/query/scan logic. The kill criterion is the whole point: a store is PICKED only on measured evidence across all three sub-criteria, else a KILL_OR_RESCOPE verdict.

## Wave 1

### M94-D1-T1 — Synthetic ~1.5M-node graph generator
- **Status**: [ ] pending
- **Files**: `bin/gsd-t-graph-synthetic-gen.cjs`
- **Touches**: `bin/gsd-t-graph-synthetic-gen.cjs`
- **ImplPath**: `bin/gsd-t-graph-synthetic-gen.cjs` — seeded generator emitting a node/edge set at configurable scale (default ~1.5M, Atos scale)
- **Test**: `test/m94-k1-store-bakeoff.test.js` (shared with T2) — asserts deterministic output for a fixed seed at a small scale and that each node/edge carries the candidate schema fields
- **Contract refs**: NONE (produces the fixtures the bake-off consumes; the schema fields it emits feed the T3 store-schema contract)
- **Dependencies**: none
- **Acceptance criteria**:
  - Generates a synthetic graph of configurable node count (default ~1.5M) with realistic file→file import edges + function→function call edges
  - Each node/edge carries the candidate schema fields (id, kind, tier, content-hash placeholder) — the columns T3's contract declares
  - Deterministic with a seed so the bake-off is reproducible
  - Emits a JSON envelope `{ ok, nodes, edges, seed }` (bin/<tool>.cjs convention)

### M94-D1-T2 — Store bake-off harness (K1 kill-criterion measurement)
- **Status**: [ ] pending
- **Headline**: true
- **Files**: `bin/gsd-t-graph-store-bakeoff.cjs`, `test/m94-k1-store-bakeoff.test.js`
- **Touches**: `bin/gsd-t-graph-store-bakeoff.cjs`, `test/m94-k1-store-bakeoff.test.js`
- **ImplPath**: `bin/gsd-t-graph-store-bakeoff.cjs` — loads the T1 synthetic graph into each embedded-eligible candidate (KuzuDB-embedded / SQLite-recursive-CTE / JSONL / graphology), measures the three K1 sub-metrics, emits a PICK or KILL_OR_RESCOPE verdict
- **Test**: `test/m94-k1-store-bakeoff.test.js` — a synthetic candidate engineered to FAIL exactly one sub-criterion is asserted NOT picked (kill-criterion enforced, not papered over); envelope shape asserted; deterministic re-run on a fixed seed
- **Contract refs**: graph-store-schema-contract (this task PRODUCES the store-schema decision T3 records)
- **Dependencies**: M94-D1-T1
- **Acceptance criteria**:
  - (K1 = `[RULE] K1: store-picked-on-evidence-or-rescope`)
  - Loads the synthetic graph into each candidate passing the embedded/on-disk/no-server/no-paid-license gate
  - Measures (a) embedded-eligibility, (b) `who-imports X` + `who-calls f` query latency, (c) single-file incremental update + one-hop direct-importer edge re-validation wall-clock
  - PICKs the store **iff ALL three sub-criteria clear** (embedded + query-latency target + sub-~1s incremental); else emits a `KILL_OR_RESCOPE` verdict (e.g. import-graph-only, cap repo size) — NEVER asserts a winner
  - **Killing test**: a candidate that fails one sub-criterion is NOT picked (the test fails if the harness short-circuits to a winner) — proves the kill-criterion is live, not dead code
  - Store-driver candidates installed dev/spike-only — NEVER added to the shipped installer `dependencies` (zero-dep invariant)

### M94-D1-T3 — Store-schema contract + K1 result doc
- **Status**: [ ] pending
- **Files**: `.gsd-t/contracts/graph-store-schema-contract.md`, `.gsd-t/spikes/k1-store-bakeoff-results.md`
- **Touches**: `.gsd-t/contracts/graph-store-schema-contract.md`, `.gsd-t/spikes/k1-store-bakeoff-results.md`
- **ImplPath**: `.gsd-t/contracts/graph-store-schema-contract.md` — the node/edge/tier/content-hash record shape + picked store engine the Wave-2 trio builds against
- **Test**: `test/m94-k1-store-bakeoff.test.js` — the harness envelope it records is schema-asserted by T2's test (the contract's record shape is exercised by the bake-off that produces it)
- **Contract refs**: graph-store-schema-contract (authored here, marked STABLE)
- **Dependencies**: M94-D1-T2
- **Acceptance criteria**:
  - Contract declares node/edge/tier/content-hash columns — the exact shape D3 writes, D4 mutates, D5 reads
  - Result doc records the picked store + all three sub-metrics with a LIVE-CLOCK timestamp
  - progress.md updated with the picked store + sub-metrics (or the KILL/re-scope verdict)
  - Contract marked **STABLE** only after a store is picked (or marked **re-scoped** if K1 kills — the gate verdict, never papered over)

## Execution Estimate
- Total tasks: 3
- Independent tasks (no cross-domain blockers): all 3 (Wave 1 — d1 has no upstream dependency; it GATES the Wave-2 trio jointly with d2)
- Intra-domain serial chain: T1 → T2 → T3
- Estimated checkpoints: 1 (Wave-1 HARD GATE, jointly with d2 — Wave 2 does not begin until K1 PICK + K2 PASS)
