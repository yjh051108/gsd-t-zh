# Contract: Graph Freshness Check

**Status:** DRAFT — authored by D4 during Wave-2 build (after the K1+K2 hard gate).
**Owner:** d4-freshness
**Consumers:** d5-query-cli (calls `freshness_check_on_query` inline before answering)
**Version:** 0.1.0 (DRAFT)

## Purpose
The freshness surface the query CLI calls inline so a stale touched file is re-indexed BEFORE the answer — never serving a stale or wrong edge.

## Surface
- `freshness_check_on_query(touched_files)` — for each file: hash its CONTENT vs the stored hash; if stale → re-index it (via D3's `parse_and_put`) + re-validate edges from its DIRECT importers one-hop only

## Invariants
- `[RULE] freshness-content-hash-not-git-sha` — dirty-detection hashes file CONTENT; an uncommitted working-tree edit (git-SHA unchanged) MUST be caught (the AC-3 killing test)
- `[RULE] one-hop-revalidation-not-transitive` — a stale file re-indexes itself + re-checks DIRECT importers only — never the transitive closure
- sub-~1s per edit (AC-3 scale-budget — measured separately at 1.5M-node scale, NOT asserted inline on a toy fixture; see the AC-3 timing split below)
- `[RULE] freshness-write-atomic-no-torn-read` — the re-index WRITE of file F relies on the store's atomicity guarantee (graph-store-schema-contract.md sub-criterion 4): a concurrent `who-imports(F)` during the re-index returns fully-old OR fully-new edges, NEVER a torn set. D4 does not implement its own locking — it uses the store's declared mechanism (single-writer lock / atomic write+rename / txn).

## AC-3 timing split (correctness gates the build; timing is a separate scale measurement)
- **Correctness test (gates the build):** content-hash mismatch IS detected; re-validation is one-hop NOT transitive; the uncommitted-edit case IS caught. **NO timing assertion** — deterministic, runs on a toy fixture, cannot flake.
- **Scale-budget measurement (separate, recorded not gated-inline):** the sub-~1s-per-edit number is measured at ~1.5M-node scale and recorded in the result doc against the pre-committed < 1 s ceiling. Never a flaky inline wall-clock assert on a toy fixture.

## Consumed (frozen)
- `graph-store-schema-contract.md` (D1) — the stored content-hash column
- `graph-indexer-build-contract.md` (D3) — `parse_and_put(file)` re-index function (called, not edited)
