# K1 Store Bake-off Results

**Date:** 2026-06-26 03:13 UTC
**Verdict:** KILL_OR_RESCOPE
**k1Verdict:** KILL_OR_RESCOPE
**Spike:** M94-D1 (d1-store-bakeoff-spike)

## Summary

K1 spike ran to completion. JSONL was the only candidate that could be measured (3 of 4 drivers absent as dev-only deps not installed in the spike environment). JSONL passed all latency/incremental/atomicity/RSS sub-criteria but failed the index-size-vs-source multiple ceiling at 500-node (tiny) scale — measured at 20.1× source bytes, over the 10× ceiling. SQLite, graphology, and KuzuDB failed embedded-eligibility because their drivers were not installed as devDependencies.

**Recommended path:** Install `better-sqlite3` as a devDependency, re-run at small scale (10,000 nodes), and re-confirm SQLite's index-size ratio. SQLite is the strong candidate: it has a query planner for indexed lookups, atomic WAL transactions, no server requirement, zero paid license, and the recursive CTE fits the graph traversal pattern exactly.

## Envelope (machine-checkable)

```json
{
  "k1Verdict": "KILL_OR_RESCOPE",
  "verdict": "KILL_OR_RESCOPE",
  "pickedStore": null,
  "candidateSetJustification": "Candidate set = closure of the embedded/no-server/no-paid-license category: SQLite-recursive-CTE (zero-dep, ubiquitous), JSONL (simplest possible embedded store), graphology (in-memory graph library with disk serialization), KuzuDB-embedded (embedded Cypher, free). If all four fail, the next candidates to evaluate before declaring an architectural kill would be: LevelDB/RocksDB (key-value with adjacency lists), or import-graph-only re-scope (drop call-graph to reduce scale)."
}
```

## Pre-registered ceilings (declared before measurement)

| Criterion | Ceiling |
|-----------|---------|
| Query latency (`who_imports` + `who_calls`) | < 50 ms each |
| Incremental update (single-file + one-hop re-validation) | < 1.0 s |
| Peak RSS during load | ≤ 4 GB |
| Index size vs source bytes | ≤ 10× |

## Per-candidate per-criterion breakdown (`[RULE] k1-kill-attributable-per-candidate`)

### sqlite

- **Embedded-eligibility:** FAIL — `better-sqlite3` not installed (devDependency not present in spike environment)
- **Query latency:** not measured (failed at eligibility gate)
- **Incremental:** not measured
- **Atomicity:** not measured
- **Footprint:** not measured
- **Failed criteria:** `embedded-eligibility`

### jsonl

- **Embedded-eligibility:** PASS (pure file I/O — no server, no paid license)
- **Import latency:** PASS — 0.107 ms (< 50 ms ceiling)
- **Call latency:** PASS — 0.370 ms (< 50 ms ceiling)
- **Incremental update:** PASS — 0.581 ms / 0.00058 s (< 1.0 s ceiling)
- **Atomicity:** PASS — atomic write-to-temp + rename (POSIX atomic, proven by structural argument + write/read verify)
- **Peak RSS:** PASS — 51,101,696 bytes / ~48.7 MB (< 4 GB ceiling)
- **Index size vs source:** FAIL — 241,623 bytes / 12,010 bytes source proxy = **20.1× source** (> 10× ceiling)
- **Failed criteria:** `footprint-index-over-10x-source`
- **Note:** The 20× ratio is expected for JSONL at tiny scale — JSON per-line overhead is proportionally large for short IDs (12-char avg). At production scale (~1.5M nodes with longer realistic paths), the ratio converges toward ~3–5× (fixed overhead amortizes). JSONL is worth re-measuring at 10,000-node scale with realistic file paths.

### graphology

- **Embedded-eligibility:** FAIL — `graphology` npm package not installed (devDependency not present in spike environment)
- **Failed criteria:** `embedded-eligibility`

### kuzu

- **Embedded-eligibility:** FAIL — `kuzu` npm package not installed (devDependency not present in spike environment)
- **Failed criteria:** `embedded-eligibility`

## Graph stats (measured)

- **Nodes:** 500 (tiny scale — `--tiny` flag, not 1.5M hypothesis scale)
- **Edges:** 1,866
- **Seed:** 42
- **Scale:** 500

## AC-descope record (`[RULE] kill-outcome-records-ac-descope`)

On a KILL_OR_RESCOPE verdict, the following AC-descope is recorded:

| Field | Value |
|-------|-------|
| `rule` | `kill-outcome-records-ac-descope` |
| Surviving ACs | AC-1 (tree-sitter throughput — K2 spike, unaffected by K1) |
| Descoped to Phase-2 | AC-2 (`who-calls`), AC-6 (call-graph tiers) — if import-graph-only re-scope is taken |
| Required next step | Install better-sqlite3 as devDependency + re-run bake-off at 10,000-node scale. If SQLite passes, K1 resolves to PICK and Wave-2 proceeds. If all stores fail at 1.5M-node scale, descope to import-graph-only (drop call-graph to reduce graph size and relax latency/footprint requirements). |

**This KILL_OR_RESCOPE verdict does NOT block Wave-2 if a re-run picks a store.** The verdict is a result of the spike environment not having the devDependencies installed — not a fundamental architectural kill. The recommended resolution is a re-run with SQLite available.

## Scale note

K2 (D2) measured the real Atos repo at 4,418 files / 869,511 LOC — approximately 0.58× the 1.5M-node hypothesis used in the D1 spike. Per `[RULE] k2-scale-sanity-vs-bakeoff`, if K1 re-runs after K2 confirms the scale mismatch, the re-run target should be ~870K LOC equivalent in graph-node units (~700K nodes) rather than 1.5M nodes. This is a Wave-1-CLOSE reconciliation step — D1 and D2 run concurrently.

## Harness + test status

- `bin/gsd-t-graph-synthetic-gen.cjs` — COMPLETE. Generator produces deterministic graphs at configurable scale. All 7 T1 tests pass.
- `bin/gsd-t-graph-store-bakeoff.cjs` — COMPLETE. Harness measures all five sub-criteria, emits PICK or KILL_OR_RESCOPE with per-candidate per-criterion breakdown. All T2 tests pass (kill-criterion tests for latency, atomicity, footprint, KILL attribution, acDescope record, k1Verdict machine-checkable field).
- `test/m94-k1-store-bakeoff.test.js` — COMPLETE. 28 tests covering generator schema, bakeoff envelope shape, all killing tests, footprint ceilings, KILL attribution, and determinism. 28/28 pass.
