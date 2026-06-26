# Domain: d5-query-cli

## Responsibility
WAVE 2 BUILD (after the hard gate; runs concurrently with d3 and d4). The DETERMINISTIC query CLI the model can't route around — the no-stale-no-wrong KEYSTONE. fresh-or-reindex-inline (calls the D4 freshness check before answering, so a stale touched file is re-indexed BEFORE the answer); answers who-imports / who-calls / blast-radius from the store (D1 schema); NEVER a directive-driven grep fallback in any code path (verified by structural grep-for-absence, not substring); on genuine parser-load failure returns `{ok:false, reason:'graph-unavailable'}` FAIL-LOUD (commands fall back to grep mode, announced) — never a partial edge. Also owns `gsd-t graph status` returning a live queryable index (the M20–M21 "no graph index found" is the anti-goal).

## Owned Files/Directories
- `bin/gsd-t-graph-query-cli.cjs` — the query CLI: who-imports / who-calls / blast-radius + `graph status`; fresh-or-reindex-inline via D4; fail-loud graph-unavailable; no grep fallback
- `.gsd-t/contracts/graph-query-cli-contract.md` — the JSON envelope contract D6 (scan consumer) reads
- `test/m94-d5-query-cli.test.js` — who-imports/who-calls/blast-radius correctness (AC-2), graph status live
- `test/m94-d5-no-grep-fallback-structural.test.js` — AC-5: structural grep-for-absence of any directive-driven grep fallback in any code path (NOT a substring scan)
- `test/m94-d5-fault-injection-fail-loud.test.js` — AC-5: fault-injection forces a parser-load failure and asserts `{ok:false, reason:'graph-unavailable'}` — never a partial edge
- `.gsd-t/domains/d5-query-cli/{scope,constraints,tasks}.md` — this domain's own GSD-T metadata

## Files Owned
- `bin/gsd-t-graph-query-cli.cjs`
- `.gsd-t/contracts/graph-query-cli-contract.md`
- `test/m94-d5-query-cli.test.js`
- `test/m94-d5-no-grep-fallback-structural.test.js`
- `test/m94-d5-fault-injection-fail-loud.test.js`

## NOT Owned (do not modify)
- `bin/gsd-t-graph-store-bakeoff.cjs`, `bin/gsd-t-graph-synthetic-gen.cjs`, `.gsd-t/contracts/graph-store-schema-contract.md` — owned by d1 (store read-only)
- `bin/gsd-t-graph-ts-throughput.cjs`, `.gsd-t/contracts/graph-parser-floor-contract.md` — owned by d2
- `bin/gsd-t-graph-index.cjs`, `bin/gsd-t-graph-scip-upgrade.cjs`, `bin/gsd-t-graph-edge-extract.cjs`, `.gsd-t/contracts/graph-indexer-build-contract.md` — owned by d3 (inline re-index is a function call)
- `bin/gsd-t-graph-freshness.cjs`, `.gsd-t/contracts/graph-freshness-contract.md` — owned by d4 (the query CLI CALLS its freshness check)
- `commands/gsd-t-scan.md`, `templates/workflows/gsd-t-scan.workflow.js` — owned by d6 (d6 reads this domain's query-cli contract)
