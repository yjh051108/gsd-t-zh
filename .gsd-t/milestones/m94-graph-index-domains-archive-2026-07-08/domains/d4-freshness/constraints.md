# Constraints: d4-freshness

## Must Follow
- **Zero external runtime deps for the installer** — content-hashing uses Node's built-in `crypto`; no new dependency.
- `bin/<tool>.cjs` CLI convention: JSON envelope, ANSI colors, sync file APIs.
- Read D1's `graph-store-schema-contract.md` (the stored content-hash column) read-only.
- Re-index a stale file by CALLING D3's per-file parse function (per `graph-indexer-build-contract.md`) — a function-level call, NOT an edit to D3's files. Keeps this domain file-disjoint from D3.
- **[RULE] freshness-content-hash-not-git-sha** — dirty-detection hashes file CONTENT (catches an uncommitted working-tree edit; a file whose git-SHA is unchanged MUST still be caught). This is the AC-3 killing test.
- **[RULE] one-hop-revalidation-not-transitive** — a stale file re-indexes itself + re-checks edges from its DIRECT importers ONLY — never the transitive closure.
- Sub-~1s per edit (the AC-3 budget).

## Must Not
- Modify files outside owned scope (D3's indexer files especially — re-index is a function call, not an edit).
- Use git-SHA for dirty-detection (it misses uncommitted edits — the explicit anti-goal).
- Walk the transitive closure on re-validation (one-hop only).
- Implement query or scan logic — those are D5/D6.

## Dependencies
- Depends on: d1 (graph-store-schema-contract — stored content-hash), d3 (graph-indexer-build-contract — the per-file parse function it calls). BLOCKED until the K1+K2 hard gate passes; integrates with d3 in Wave 2.
- Depended on by: d5-query-cli (calls `freshness_check_on_query` inline before answering) via the **graph-freshness-contract**.
