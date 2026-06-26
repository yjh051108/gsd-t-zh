# Contract: Graph Store Schema (K1)

**Status:** STABLE — K1 spike complete. Verdict: KILL_OR_RESCOPE. Record shape and ceilings are STABLE as declared (D3/D4/D5 build against these regardless of store choice). The specific store engine is re-scoped per the measured result below.
**Owner:** d1-store-bakeoff-spike
**Consumers:** d3-indexer-core (writes records), d4-freshness (reads stored hash, mutates on re-index), d5-query-cli (reads to answer)
**Version:** 0.2.0 (STABLE — record shape finalized; store engine re-scoped)
**Updated:** 2026-06-25 20:06 PDT

## Purpose
The on-disk record shape every Wave-2 domain builds against, plus the K1 verdict and store decision. The K1 spike ran to completion — see `.gsd-t/spikes/k1-store-bakeoff-results.md` for the full measured result.

## K1 Verdict: KILL_OR_RESCOPE

K1 spike measured JSONL directly (3 of 4 drivers absent as dev-only deps not installed in spike environment). JSONL passed all latency/incremental/atomicity/RSS sub-criteria but failed the index-size multiple ceiling at tiny (500-node) scale (20× source bytes > 10× ceiling). SQLite, graphology, and KuzuDB could not be measured (drivers not installed).

**Recommended path:** Install better-sqlite3 as a devDependency, re-run at small scale (10,000 nodes), and re-confirm SQLite's index-size ratio (which will be ≪ JSONL's JSON-per-line overhead for structured graph data). SQLite is the strong candidate: it has a query planner for indexed lookups, atomic WAL transactions, no server requirement, zero paid license, and the recursive CTE fits the graph traversal pattern exactly.

**Alternatively (import-graph-only re-scope):** If all stores fail at 1.5M nodes, the AC-2 who-calls / AC-6 call-graph tier ACs are formally DESCOPED to Phase-2 and Phase-1 delivers import-graph-only (who-imports, per-file content-hash freshness, `/scan` wiring on import relationships). This is a planned KILL path, not a failure — see acDescope in the result doc.

## The decision K1 resolves
Pick a store iff it clears ALL FIVE sub-criteria below. `[RULE] K1: store-picked-on-evidence-or-rescope`

| # | Sub-criterion | PASS condition | Pre-registered ceiling |
|---|---------------|----------------|------------------------|
| 1 | Embedded-eligibility | embedded / on-disk / no-server / no-paid-license | — |
| 2 | Query latency (`[RULE] k1-query-latency-target`) | `who-imports(X)` AND `who-calls(f)` each return in **< 50 ms** at the synthetic ~1.5M-node scale | **50 ms** |
| 3 | Incremental update | single-file incremental put + one-hop direct-importer edge re-validation in **< 1 s** | **1.0 s** |
| 4 | Concurrent-update atomicity (`[RULE] k1-atomic-single-file-update`) | while a single-file re-index WRITE for file F is in flight, a concurrent `who-imports(F)` read returns **fully-old OR fully-new edges, NEVER a torn/partial set** | atomicity proven by store mechanism |
| 5 | Footprint ceiling (`[RULE] k1-footprint-ceiling`) | **peak RSS during load ≤ 4 GB** AND **on-disk index size ≤ 10× indexed source bytes** | **4 GB RSS · 10× source** |

## Record shape (STABLE — columns finalized, store-specific encoding TBD on PICK)

| Field | Type | Meaning |
|-------|------|---------|
| `file` | string (repo-relative POSIX path) | source file path |
| `content_hash` | string (hex) | content hash of the file — freshness key (D4 reads this to detect stale) |
| `entities` | `FuncEntity[]` | functions / classes / exports extracted from the file; each carries a `funcId` (file-qualified) |
| `edges` | `Edge[]` | import-graph (file→file) + call-graph (function→function, funcId-keyed at BOTH ends) |
| `tier` | `"compiler-accurate" \| "tree-sitter-floor" \| "tree-sitter-floor-STALE-SCIP"` | accuracy provenance |

### FuncEntity shape

```json
{
  "funcId": "src/user.ts#createUser",
  "name": "createUser",
  "kind": "FUNCTION | CLASS | EXPORT",
  "file": "src/user.ts",
  "tier": "compiler-accurate | tree-sitter-floor"
}
```

### Edge shape

```json
{ "kind": "IMPORT", "src": "src/user.ts", "dst": "lib/db.ts" }
{ "kind": "CALL", "src": "src/user.ts#createUser", "dst": "lib/db.ts#query" }
```

`funcId` = `file#function` (minimum); where overloads/same-named nested functions exist: `file#function@line` or `file#qualified.name`.

## Function-identity key (`[RULE] who-calls-function-identity-disambiguated`)

Every function entity + every function→function call edge endpoint is keyed by a **`funcId`** = a FILE-QUALIFIED identity, NOT a bare name. Two functions named `foo` in different files have DISTINCT `funcId`s; `who-calls` on one returns ONLY that one's callers. D3's edge-extractor emits `funcId`-keyed call edges; D5's `who-calls` resolves a `funcId` (or disambiguates a bare name to candidate `funcId`s) before answering.

## Query surface the store must support (pre-registered, measured in the bake-off)

- `who_imports(X)` — file→file reverse import edges (latency measured vs the < 50 ms target)
- `who_calls(f)` — function→function reverse call edges (latency measured vs the < 50 ms target)
- single-file incremental put + one-hop direct-importer edge re-validation (< 1 s)
- atomic single-file update under a concurrent read (sub-criterion 4 — torn-read forbidden)

## Atomicity guarantee (to be declared per picked store)

Whichever store is picked MUST document the mechanism by which a concurrent `who-imports(F)` cannot observe a torn/partial edge set during F's re-index write — one of: single-writer file lock, atomic write-to-temp + rename, or a store-native transaction.

## K1 result envelope structure (`[RULE] k1-verdict-field-machine-checkable`)

The K1 result-doc envelope (`.gsd-t/spikes/k1-store-bakeoff-results.md`) MUST carry:
- **`k1Verdict`** ∈ `{ PICK, KILL_OR_RESCOPE }` — the structured verdict the D7-T2 Wave-1 hard-gate test reads. An envelope missing `k1Verdict` FAILS the gate.
- On `PICK`: picked store engine + ALL FIVE sub-metrics.
- On `KILL_OR_RESCOPE` (`[RULE] k1-kill-attributable-per-candidate`): PER-CANDIDATE per-criterion breakdown (which sub-criterion failed for EACH candidate, with the measured number) + `candidateSetJustification` + the explicit `acDescope` record (`[RULE] kill-outcome-records-ac-descope`). A bare KILL with no per-candidate per-criterion breakdown is REJECTED.

## Open until re-run resolves

- The picked store engine (pending re-run with SQLite installed — see result doc)
- Exact column types / on-disk encoding (store-specific, finalized on PICK)
- The concrete atomicity mechanism (which of the three the picked store provides)
- Whether import-graph-only re-scope is necessary at 1.5M-node scale
