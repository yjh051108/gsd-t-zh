# Contract: Graph Indexer Build/Put Surface

**Status:** STABLE — D3 build complete (M94-D3-T2).
**Owner:** d3-indexer-core
**Consumers:** d4-freshness (calls the per-file parse function to re-index a stale file), d5-query-cli (calls re-index inline before answering)
**Version:** 1.0.0 (STABLE — RE-PLAN Fix-2 frozen and implemented: tier-preservation invariant enforced in `gsd-t-graph-index.cjs` + `gsd-t-graph-scip-upgrade.cjs`; tested by `test/m94-d3-tier-preserved-on-reindex.test.js`)
**Updated:** 2026-06-26

## Purpose
The function-level build/put surface D3 exposes so D4 and D5 re-index a file WITHOUT editing D3's source (keeps them file-disjoint). D4/D5 call this surface; they never edit `bin/gsd-t-graph-index.cjs`.

## Import path

```js
const { build_index, parse_and_put, openStore, closeStore, putRecord, getRecord } =
  require('./gsd-t-graph-index.cjs');
const { tryScipUpgrade, detectScip } =
  require('./gsd-t-graph-scip-upgrade.cjs');
```

## Surface

### `build_index(repoRoot, options)` — full-repo index

```js
// options:
{
  dbPath?: string,       // default: repoRoot/.gsd-t/graph.db
  scip?: object,         // the gsd-t-graph-scip-upgrade.cjs module (or null = floor only)
  onProgress?: Function, // ({ file, tier, fileCount, total })
}
// returns:
{
  fileCount: number,
  entityCount: number,
  edgeCount: number,
  tier: { floor: number, upgraded: number },
  errors: number,
  durationMs: number,
  dbPath: string,
}
```

Full-repo tree-sitter floor index. Streams per-file (never loads whole graph into RAM — K1 OOM invariant from `.gsd-t/spikes/k1-store-bakeoff-results.md`). Calls the SCIP upgrader if provided.

### `parse_and_put(absPath, relPath, options)` — per-file re-index (the D4/D5 surface)

This is a **function-level surface**, NOT a shared file edit. D4 and D5 import `gsd-t-graph-index.cjs` and call this function; they do NOT edit the indexer file.

```js
// options:
{
  db: Database,            // better-sqlite3 Database instance (must be open)
  scip?: object,           // the SCIP upgrader module (or null)
  existingTier?: string,   // tier currently stored for this file (for STALE-SCIP detection)
}
// returns:
{
  entities: FuncEntity[],
  edges: Edge[],
  tier: TierEnum,
  contentHash: string,
  loc: number,
}
```

### Store open/close lifecycle

D4 and D5 are responsible for opening the store before calling `parse_and_put` and closing it after. `parse_and_put` does NOT open or close the database — it accepts an open `db` instance.

```js
const db = openStore(dbPath);
const result = parse_and_put(absPath, relPath, { db, scip, existingTier });
closeStore(db);
```

### Tier enum (`[RULE] accuracy-tier-labeled-never-silently-wrong`)

```
TierEnum = "compiler-accurate" | "tree-sitter-floor" | "tree-sitter-floor-STALE-SCIP"
```

- `compiler-accurate` — SCIP indexer present + ran OK; call edges are SCIP-RESOLVED (M95): `build_index` runs scip-typescript once over the repo, reads `index.scip`, and rewrites each file's `UNRESOLVED#<name>` call targets to real cross-file funcIds. A file is labeled `compiler-accurate` ONLY when SCIP actually resolved ≥1 of its call edges (or it has no call edges to resolve); a file whose calls all stay unresolvable is `tree-sitter-floor`, never relabeled. (M95 superseded the Phase-1 "tier labelling only" stub that relabeled tree-sitter edges without reading SCIP output. Reader: `bin/gsd-t-scip-reader.cjs`; resolver: `buildScipResolver` in `bin/gsd-t-graph-scip-upgrade.cjs`.)
- `tree-sitter-floor` — no SCIP indexer for this language; edges are tree-sitter best-effort
- `tree-sitter-floor-STALE-SCIP` — SCIP was present at last full index but is now absent or fails on re-index; the "was-accurate" signal is preserved; consumer treats these as floor edges

Every file record in the store carries a `tier` field from this enum. No unlabeled record is written.

## Honesty invariants
- `[RULE] accuracy-tier-labeled-never-silently-wrong` — every edge carries `tier` (compiler-accurate where SCIP present, tree-sitter-floor where absent); never an unlabeled mix
- `[RULE] rust-cross-crate-flagged-partial` — Rust cross-crate edges FLAGGED partial (rust-analyzer SCIP is "limited"); within-crate resolves, cross-crate partial
- The graph NEVER depends on SCIP to FUNCTION — only to get BETTER. SCIP absent → tree-sitter floor, degrades not breaks.

## `parse_and_put` tier-preservation invariant (RE-PLAN Fix-2 — `[RULE] reindex-tier-never-silently-downgraded`)
**The bug this freezes out (a REAL design bug):** `build_index` does a tree-sitter-floor parse → OPTIONAL SCIP upgrade → `store.put(tier)`. SCIP indexers (`scip-typescript`, `scip-python`, `rust-analyzer scip`) are **WHOLE-PROJECT BATCH tools** — they emit ONE `index.scip` per repo/crate and **cannot re-derive a single file in isolation**. But `parse_and_put(file)` (the per-file re-index D4 calls on EVERY stale file, and D5 calls inline) re-parses ONE file via tree-sitter ONLY. So a file that was `tier=compiler-accurate` after `build_index` would, on the very next incremental edit, get silently re-written `tier=tree-sitter-floor` — **smart-reach silently degrading to dumb-reach on the EXACT path AC-3 exercises** (the uncommitted-edit re-index), violating the determinism/accuracy premise.

**The frozen invariant — `parse_and_put(file)` MUST do ONE of (never a silent downgrade):**
1. **Re-upgrade** — if a per-file or incremental SCIP re-derivation is feasible for that language (e.g. re-run the language's SCIP indexer scoped to the file's project/crate if cheap enough, or consult a still-valid prior `index.scip` for the unchanged symbols), re-label the re-indexed edges `tier=compiler-accurate`. — OR —
2. **Honestly downgrade-with-flag** — if SCIP cannot be re-derived per-file, write the new edges as `tier=tree-sitter-floor-STALE-SCIP` (a DISTINCT, explicit label meaning "this file WAS compiler-accurate at build, is now tree-sitter-floor pending a full re-index"). The consumer reads this as a HONEST tree-sitter-floor edge, NEVER as authoritative compiler-accurate.

**Forbidden:** silently relabeling a previously-`compiler-accurate` file as plain `tree-sitter-floor` (loses the "was-accurate" signal), silently KEEPING the stale `compiler-accurate` label on tree-sitter-only edges (claims accuracy it no longer has), or silently dropping to an UNLABELED approximate edge the consumer reads as authoritative. Any of these is a silent accuracy downgrade — the `[RULE] reindex-tier-never-silently-downgraded` violation.

**Test (D3-T5, `test/m94-d3-tier-preserved-on-reindex.test.js`):** `build_index` a fixture with a SCIP indexer present so a target file's edges are `tier=compiler-accurate`; edit that file; call `parse_and_put(file)`; assert the re-indexed edges are EITHER re-upgraded to `compiler-accurate` OR explicitly labeled `tree-sitter-floor-STALE-SCIP` (downgraded-with-flag) — NEVER silently relabeled plain `compiler-accurate` over tree-sitter-only edges, NEVER silently dropped to an unlabeled approximate edge. FAIL-LOUD-SKIP with `scip-indexer-not-present` if no SCIP indexer is installed (so the test cannot silent-green on an environment where it could never observe a compiler-accurate tier).

## Consumed (frozen)
- `graph-store-schema-contract.md` (D1) — record columns
- `graph-parser-floor-contract.md` (D2) — taxonomy + parse harness
