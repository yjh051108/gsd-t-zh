# Constraints: d5-query-cli

## Must Follow
- **Zero external runtime deps for the installer** — the query CLI reads the embedded store (whatever K1 picked) via the store-schema contract; no new installer dependency beyond the store the spike already approved.
- `bin/<tool>.cjs` CLI convention: JSON envelope, ANSI colors, sync file APIs, `gsd-t graph <verb>` dispatch.
- Call D4's `freshness_check_on_query` INLINE before answering (fresh-or-reindex-inline) — a stale touched file is re-indexed BEFORE the answer.
- Read D1's store-schema; consume D4's freshness contract — both as frozen.
- **[RULE] query-cli-never-greps** — no directive-driven grep fallback exists in ANY code path; verified by a STRUCTURAL grep-for-absence (parse the code paths), not a substring scan.
- **[RULE] parser-fail-disables-loud-never-silent** — a genuine parser-load failure returns `{ok:false, reason:'graph-unavailable'}` (commands fall back to grep mode, ANNOUNCED) — never a silent half-accurate index; verified by fault-injection.
- **[RULE] stale-file-reindexed-before-answer** — a query re-indexes any stale touched file inline BEFORE returning.
- **[RULE] graph-status-live** — `gsd-t graph status` returns a live queryable index (the M20–M21 "no graph index found" is the anti-goal).

## Must Not
- Modify files outside owned scope (D4's freshness module, D3's indexer, D1/D2 spike files).
- Add ANY grep fallback in any code path (the VERIFIED M20–M21 cause of death).
- Return a partial/stale edge — fail loud instead.
- Mutate the store (this domain READS; D3 writes, D4 mutates on re-index). The query CLI triggers re-index via D4's function, it does not write store records itself.

## Dependencies
- Depends on: d1 (store-schema, read-only), d4 (graph-freshness-contract — the inline check). BLOCKED until the K1+K2 hard gate passes; integrates with d3 + d4 in Wave 2.
- Depended on by: d6-scan-wiring (reads the **graph-query-cli-contract** JSON envelope to query the index instead of re-reading the repo).
