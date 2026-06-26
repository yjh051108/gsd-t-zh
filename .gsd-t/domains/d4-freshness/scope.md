# Domain: d4-freshness

## Responsibility
WAVE 2 BUILD (after the hard gate; runs concurrently with d3 and d5). Per-file CONTENT-HASH dirty-detection (NOT git-SHA — must catch an uncommitted working-tree edit where the git-SHA is unchanged). On a freshness check: hash each touched file vs the stored hash; stale → re-index that file (a function-level call into D3's per-file parse) + re-validate edges from its DIRECT importers ONE-HOP only (never the transitive closure), sub-~1s. AC-3 killing test: an uncommitted edit IS caught.

## Owned Files/Directories
- `bin/gsd-t-graph-freshness.cjs` — the freshness module: content-hash dirty-detection + stale-file re-index (via D3's parse function) + one-hop direct-importer edge re-validation
- `.gsd-t/contracts/graph-freshness-contract.md` — the freshness interface D5's query CLI calls (`freshness_check_on_query(touched_files)`) before answering
- `test/m94-d4-freshness.test.js` — content-hash dirty-detection, one-hop (not transitive) re-validation, sub-~1s budget
- `test/m94-d4-uncommitted-edit-caught.test.js` — AC-3 killing test: an uncommitted working-tree edit (git-SHA unchanged) IS detected and re-indexed
- `.gsd-t/domains/d4-freshness/{scope,constraints,tasks}.md` — this domain's own GSD-T metadata

## Files Owned
- `bin/gsd-t-graph-freshness.cjs`
- `.gsd-t/contracts/graph-freshness-contract.md`
- `test/m94-d4-freshness.test.js`
- `test/m94-d4-uncommitted-edit-caught.test.js`
- `.gsd-t/spikes/ac3-freshness-scale-budget-results.md`

## NOT Owned (do not modify)
- `bin/gsd-t-graph-store-bakeoff.cjs`, `bin/gsd-t-graph-synthetic-gen.cjs`, `.gsd-t/contracts/graph-store-schema-contract.md` — owned by d1 (store-schema consumed read-only)
- `bin/gsd-t-graph-ts-throughput.cjs`, `.gsd-t/contracts/graph-parser-floor-contract.md` — owned by d2
- `bin/gsd-t-graph-index.cjs`, `bin/gsd-t-graph-scip-upgrade.cjs`, `bin/gsd-t-graph-edge-extract.cjs`, `.gsd-t/contracts/graph-indexer-build-contract.md` — owned by d3 (re-index is a FUNCTION CALL into d3's module, not a file edit)
- `bin/gsd-t-graph-query-cli.cjs` — owned by d5 (d5 CALLS this domain's freshness check)
- `commands/gsd-t-scan.md`, `templates/workflows/gsd-t-scan.workflow.js` — owned by d6
