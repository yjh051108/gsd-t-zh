# Contract: Graph Query CLI Envelope

**Status:** DRAFT — authored by D5 during Wave-2 build (after the K1+K2 hard gate).
**Owner:** d5-query-cli
**Consumers:** d6-scan-wiring (reads this JSON envelope to query the index instead of re-reading the repo)
**Version:** 0.1.0 (DRAFT)

## Purpose
The deterministic query interface the model cannot route around — the no-stale-no-wrong keystone. The ONLY way commands read the graph.

## CLI surface (`gsd-t graph <verb>`)
- `who-imports <file>` — file→file reverse import edges
- `who-calls <function>` — function→function reverse call edges
- `blast-radius <target>` — combined downstream impact set (see Blast-radius semantics below)
- `status` — live queryable index state (`[RULE] graph-status-live` — the M20–M21 "no graph index found" is the anti-goal)

## Blast-radius semantics (`[RULE] blast-radius-unions-both-graphs`)
`blast-radius(target)` returns the downstream impact set computed as the **UNION of the import-graph reverse-reachable set AND the call-graph reverse-reachable set** from `target`:
- **Graphs unioned:** both the file→file import graph and the function→function call graph. A node reachable via EITHER graph is in the blast radius; a node reachable via NEITHER is excluded.
- **Hop-depth:** **transitive** (full reverse-reachable closure), NOT one-hop. (Contrast with D4 freshness re-validation, which is deliberately one-hop — blast-radius is the user-facing "everything downstream" query, freshness is the cheap incremental check.)
- **Falsifiable:** the fixture test MUST include a node reachable ONLY via the call graph (NOT the import graph) — it MUST appear in the result (proves both graphs are unioned, not import-only) — AND an unrelated node reachable via neither — it MUST be excluded (proves the set is not over-broad). Over-broad OR under-broad fails the test.

Each verb calls D4's `freshness_check_on_query` INLINE before answering.

## JSON envelope
```json
{ "ok": true,  "verb": "who-imports", "target": "...", "results": [ ... ], "tier": "compiler-accurate|tree-sitter-floor" }
{ "ok": false, "reason": "graph-unavailable" }
```

## Invariants
- `[RULE] query-cli-never-greps` — NO directive-driven grep fallback in ANY code path; verified by STRUCTURAL grep-for-absence (parse the paths), not a substring scan
- `[RULE] parser-fail-disables-loud-never-silent` — genuine parser-load failure → `{ok:false, reason:"graph-unavailable"}` (commands fall back to grep mode, ANNOUNCED) — never a partial edge; verified by fault-injection
- `[RULE] stale-file-reindexed-before-answer` — re-index any stale touched file inline BEFORE returning

## Consumed (frozen)
- `graph-store-schema-contract.md` (D1) — the store it reads
- `graph-freshness-contract.md` (D4) — the inline `freshness_check_on_query`
