# Tasks: d1-store-bakeoff-spike

## Summary
When all tasks complete: a measured store choice (or KILL/re-scope verdict) recorded in progress.md, and a STABLE `graph-store-schema-contract.md` (node/edge/tier/content-hash columns + the pre-registered < 50 ms query-latency target + the atomicity guarantee) that unblocks the Wave-2 build trio. WAVE-1 PROVE-OR-KILL spike (K1) — throwaway feasibility code, no production indexer/freshness/query/scan logic. The kill criterion is the whole point: a store is PICKED only on measured evidence across ALL FOUR sub-criteria (embedded · < 50 ms query latency · < 1 s incremental · concurrent-update atomicity), else a KILL_OR_RESCOPE verdict.

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
- **ImplPath**: `bin/gsd-t-graph-store-bakeoff.cjs` — loads the T1 synthetic graph into each embedded-eligible candidate (KuzuDB-embedded / SQLite-recursive-CTE / JSONL / graphology), measures the FOUR K1 sub-metrics, emits a PICK or KILL_OR_RESCOPE verdict
- **Test**: `test/m94-k1-store-bakeoff.test.js` — (a) a synthetic candidate engineered to FAIL exactly one sub-criterion is asserted NOT picked (kill-criterion enforced, not papered over); (b) **[#3 latency]** a candidate engineered to exceed the pre-registered **< 50 ms** query-latency target fails on latency-over-target (NOT picked); (c) **[#4 atomicity]** a concurrent-read-during-write test asserts `who-imports(F)` returns a fully-old OR fully-new edge set, never torn/partial (a store with no atomicity guarantee is NOT picked); envelope shape asserted; deterministic re-run on a fixed seed; **[Pre-mortem Fix-6 — footprint]** the envelope MUST carry `peakRssBytes` (peak RSS during the 1.5M-node load) + `indexSizeBytes` (final on-disk index size) and a candidate exceeding the pre-registered peak-RSS ceiling OR the index-size-vs-source-bytes multiple is asserted NOT picked (footprint is a kill sub-criterion peer to latency/atomicity)
- **Contract refs**: graph-store-schema-contract (this task PRODUCES the store-schema decision T3 records; the < 50 ms latency target + the atomicity guarantee are PRE-REGISTERED in that contract BEFORE this task runs)
- **Dependencies**: M94-D1-T1
- **Acceptance criteria**:
  - (K1 = `[RULE] K1: store-picked-on-evidence-or-rescope`)
  - Loads the synthetic graph into each candidate passing the embedded/on-disk/no-server/no-paid-license gate
  - Measures ALL FOUR sub-criteria: (a) embedded-eligibility, (b) `who-imports X` + `who-calls f` query latency **against the pre-registered < 50 ms target** (`[RULE] k1-query-latency-target`), (c) single-file incremental update + one-hop direct-importer edge re-validation wall-clock (< 1 s), (d) **concurrent-update atomicity** (`[RULE] k1-atomic-single-file-update`) — a concurrent `who-imports(F)` during F's re-index write returns fully-old OR fully-new, never torn
  - PICKs the store **iff ALL FOUR sub-criteria clear**; else emits a `KILL_OR_RESCOPE` verdict (e.g. import-graph-only, cap repo size) — NEVER asserts a winner
  - **Killing test (#1 kill-criterion):** a candidate that fails one sub-criterion is NOT picked (the test fails if the harness short-circuits to a winner) — proves the kill-criterion is live, not dead code
  - **Killing test (#3 latency):** an engineered-to-fail candidate exceeding the < 50 ms target on either query fails on latency-over-target
  - **Killing test (#4 atomicity):** a concurrent read during a single-file write must observe a coherent (un-torn) edge set; a store that can return a torn set is NOT picked
  - **[Pre-mortem Fix-6 — footprint ceiling]** RECORDS peak RSS during the 1.5M-node load (`peakRssBytes`) + final on-disk index size (`indexSizeBytes`) against pre-registered ceilings: a defensible peak-RSS bound + an index-size-vs-source-bytes multiple (e.g. index ≤ Nx the indexed source bytes). A candidate exceeding either is NOT picked — same prove-or-kill treatment as latency/throughput; footprint is a peer existential unknown for an embedded laptop-local store — `[RULE] k1-footprint-ceiling`
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
  - Contract declares node/edge/tier/content-hash columns + the pre-registered < 50 ms query-latency target + the atomicity guarantee + **[Fix-6]** the pre-registered peak-RSS ceiling + the index-size-vs-source-bytes multiple — the exact shape D3 writes, D4 mutates, D5 reads, and the footprint ceilings the bake-off measures against
  - Result doc records the picked store + ALL FOUR sub-metrics (embedded · query-latency ms · incremental s · atomicity mechanism) + **[Fix-6]** the measured peak RSS + on-disk index size against their ceilings, with a LIVE-CLOCK timestamp
  - progress.md updated with the picked store + sub-metrics (or the KILL/re-scope verdict)
  - Contract marked **STABLE** only after a store is picked (or marked **re-scoped** if K1 kills — the gate verdict, never papered over)
  - **[#5 kill-path descope]** If the K1 verdict is KILL/re-scope, record the explicit AC-descope per the Wave-1 kill-path rule in `integration-points.md` (`[RULE] kill-outcome-records-ac-descope`): e.g. K1 kill → import-graph-only re-scope → AC-2 who-calls + AC-6 call-graph tiers formally DESCOPED to Phase-2, recorded in progress.md, their tests removed from THIS milestone's acceptance (never silently failed). A recorded KILL with no AC-descope record blocks any Wave-2 task.

## Execution Estimate
- Total tasks: 3
- Independent tasks (no cross-domain blockers): all 3 (Wave 1 — d1 has no upstream dependency; it GATES the Wave-2 trio jointly with d2)
- Intra-domain serial chain: T1 → T2 → T3
- Estimated checkpoints: 1 (Wave-1 HARD GATE, jointly with d2 — Wave 2 does not begin until K1 PICK + K2 PASS)
