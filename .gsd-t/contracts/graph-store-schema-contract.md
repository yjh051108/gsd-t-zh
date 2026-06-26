# Contract: Graph Store Schema (K1)

**Status:** DRAFT — resolved by the D1 Wave-1 K1 store-bakeoff spike. Marked STABLE only once a store is picked on evidence (or re-scoped if K1 kills).
**Owner:** d1-store-bakeoff-spike
**Consumers:** d3-indexer-core (writes records), d4-freshness (reads stored hash, mutates on re-index), d5-query-cli (reads to answer)
**Version:** 0.1.0 (DRAFT)

## Purpose
The on-disk record shape every Wave-2 domain builds against, plus the picked embedded store engine. The specific store is DEFERRED to the K1 spike — an OPEN decision, NOT asserted here.

## The decision K1 resolves
Pick a store iff it clears ALL FOUR sub-criteria below — across KuzuDB-embedded / SQLite-recursive-CTE / JSONL / graphology. Else KILL_OR_RESCOPE (e.g. import-graph-only, cap repo size). `[RULE] K1: store-picked-on-evidence-or-rescope`

| # | Sub-criterion | PASS condition |
|---|---------------|----------------|
| 1 | Embedded-eligibility | embedded / on-disk / no-server / no-paid-license |
| 2 | Query latency (PRE-REGISTERED numeric target — `[RULE] k1-query-latency-target`) | `who-imports(X)` AND `who-calls(f)` each return in **< 50 ms** at the synthetic ~1.5M-node scale. This is the falsifiable ceiling; "fast" is NOT a number. An engineered-to-fail candidate that exceeds 50 ms on either query is NOT picked. |
| 3 | Incremental update | single-file incremental put + one-hop direct-importer edge re-validation in **< 1 s** |
| 4 | Concurrent-update atomicity (`[RULE] k1-atomic-single-file-update`) | while a single-file re-index WRITE for file F is in flight, a concurrent `who-imports(F)` read returns **fully-old OR fully-new edges, NEVER a torn/partial set** — proven by the store's stated atomicity guarantee (single-writer lock / atomic write+rename / transaction) under a concurrent read+write test. |

The 50 ms query-latency target and the atomicity guarantee MUST be declared HERE before D1 executes — the bake-off measures against pre-registered numbers, never asserts a winner after the fact.

## Record shape (columns — finalized by the spike)
| Field | Meaning |
|-------|---------|
| `file` | source file path (repo-relative) |
| `content_hash` | content hash of the file (freshness key — D4 reads this) |
| `entities` | functions / classes / exports extracted from the file |
| `edges` | import-graph (file→file) + call-graph (function→function) edges |
| `tier` | `compiler-accurate` (SCIP present) or `tree-sitter-floor` (approximate) |

## Query surface the store must support (measured in the bake-off)
- `who_imports(X)` — file→file reverse import edges (latency measured vs the < 50 ms target)
- `who_calls(f)` — function→function reverse call edges (latency measured vs the < 50 ms target)
- single-file incremental put + one-hop direct-importer edge re-validation (< 1 s)
- atomic single-file update under a concurrent read (sub-criterion 4 — torn-read forbidden)

## Atomicity guarantee (declared per picked store)
Whichever store is picked MUST document the mechanism by which a concurrent `who-imports(F)` cannot observe a torn/partial edge set during F's re-index write — one of: single-writer file lock, atomic write-to-temp + rename, or a store-native transaction. D4's freshness re-index relies on this guarantee; D5's inline query depends on it returning a coherent set.

## Open until K1 resolves
- The picked store engine (recorded in `.gsd-t/spikes/k1-store-bakeoff-results.md` + progress.md)
- Exact column types / on-disk encoding (store-specific)
- The concrete atomicity mechanism (which of the three the picked store provides)
