# Contract: Graph Freshness Check

**Status:** DRAFT — authored by D4 during Wave-2 build (after the K1+K2 hard gate).
**Owner:** d4-freshness
**Consumers:** d5-query-cli (calls `freshness_check_on_query` inline before answering)
**Version:** 0.1.0 (DRAFT)

## Purpose
The freshness surface the query CLI calls inline so a stale touched file is re-indexed BEFORE the answer — never serving a stale or wrong edge.

## Surface
- `compute_touched_files()` — the DECLARED dirty-set source: scan the working tree for content-hash drift across **ALL indexed files**, returning the dirty set (edits + adds + deletes). It is NOT "the query target." A file edited since index that is not itself queried MUST still appear in this set, or it would be served stale.
- `freshness_check_on_query(touched_files)` — `touched_files` is the output of `compute_touched_files()` (a whole-tree dirty-set), NOT the query target alone. For each file: hash its CONTENT vs the stored hash; if stale → re-index it (via D3's `parse_and_put`) + re-validate edges from its DIRECT importers one-hop only.

## touched_files derivation (`[RULE] touched-set-is-whole-tree-dirty-not-query-target`)
**WHO computes it:** the freshness module, via `compute_touched_files()` — NOT the caller, NOT the query target.
**HOW it is computed:** enumerate every indexed path (the store's file list) AND the live working-tree file list, then diff by content:
- **Edit** — an indexed file whose live CONTENT hash ≠ the stored hash (mtime-prefilter then content-hash is permitted as an optimization; a full-tree content-hash is the correctness floor — mtime is only a prefilter, never the sole signal).
- **Add** — a live working-tree source file with NO stored record → enumerated as a touched ADD (its new edges must enter the graph).
- **Delete** — a stored file no longer present in the working tree → enumerated as a touched DELETE (its dangling edges must be removed/flagged, never returned live).
- **Rename** = delete (old path) + add (new path); handled by the add ∪ delete enumeration, no special case.
The dirty-set source therefore NEVER limits itself to re-hashing the query target or only existing files — it is the whole-tree edit ∪ add ∪ delete set. Serving a query without consulting this set risks a stale non-target answer (the Fix-1 failure) or a dangling/missing edge (the Fix-2 failure).

## Invariants
- `[RULE] freshness-content-hash-not-git-sha` — dirty-detection hashes file CONTENT; an uncommitted working-tree edit (git-SHA unchanged) MUST be caught (the AC-3 killing test)
- `[RULE] touched-set-is-whole-tree-dirty-not-query-target` — `touched_files` derives from `compute_touched_files()` over ALL indexed files (edits) ∪ working-tree adds ∪ store-vs-tree deletes; NEVER just the query target. A non-target file edited since index is detected and re-indexed before its edges are served.
- `[RULE] freshness-detects-add-delete-rename` — the dirty-set enumerates ADDS (new file → new edges) and DELETES (removed file → dangling edges removed/flagged), not only re-hashing existing files; a rename = delete + add. A query for who-imports of a file whose importer was deleted MUST NOT return the dangling live edge; a query for who-imports of a file with a newly-added importer MUST surface it.
- `[RULE] one-hop-revalidation-not-transitive` — a stale file re-indexes itself + re-checks DIRECT importers only — never the transitive closure
- sub-~1s per edit (AC-3 scale-budget — measured separately at 1.5M-node scale, NOT asserted inline on a toy fixture; see the AC-3 timing split below)
- `[RULE] freshness-write-atomic-no-torn-read` — the re-index WRITE of file F relies on the store's atomicity guarantee (graph-store-schema-contract.md sub-criterion 4): a concurrent `who-imports(F)` during the re-index returns fully-old OR fully-new edges, NEVER a torn set. D4 does not implement its own locking — it uses the store's declared mechanism (single-writer lock / atomic write+rename / txn).

## AC-3 timing split (correctness gates the build; timing is a separate scale measurement)
- **Correctness test (gates the build):** content-hash mismatch IS detected; re-validation is one-hop NOT transitive; the uncommitted-edit case IS caught. **NO timing assertion** — deterministic, runs on a toy fixture, cannot flake.
- **Scale-budget measurement (separate, recorded not gated-inline):** the sub-~1s-per-edit number is measured at ~1.5M-node scale and recorded in the result doc against the pre-committed < 1 s ceiling. Never a flaky inline wall-clock assert on a toy fixture.
- **Whole-tree dirty-scan budget (`[RULE] touched-set-dirty-scan-under-budget`):** because `compute_touched_files()` scans ALL indexed files per query, its per-query cost (mtime-prefilter → content-hash) is ALSO measured at ~1.5M-node scale against the same < 1 s ceiling. The mtime-prefilter is the load-bearing optimization — measured, never assumed. Over budget → kill/re-scope (e.g. a git-status-bounded candidate set), recorded as an AC-descope.

## Consumed (frozen)
- `graph-store-schema-contract.md` (D1) — the stored content-hash column
- `graph-indexer-build-contract.md` (D3) — `parse_and_put(file)` re-index function (called, not edited)
