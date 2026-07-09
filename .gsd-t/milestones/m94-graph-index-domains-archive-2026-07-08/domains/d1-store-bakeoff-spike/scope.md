# Domain: d1-store-bakeoff-spike

## Responsibility
WAVE 1 PROVE-OR-KILL spike K1 — the store bake-off. Generate a synthetic ~1.5M-node graph (Atos scale), load it into each candidate embedded store (KuzuDB embedded-Cypher / SQLite recursive-CTE / JSONL / graphology), measure embedded-eligibility + query latency + sub-~1s single-file incremental update with one-hop edge re-validation, then PICK the store on evidence or KILL/re-scope. Delivers the store-schema contract that unblocks the entire Wave-2 build trio.

## Owned Files/Directories
- `bin/gsd-t-graph-store-bakeoff.cjs` — the bake-off harness: loads the synthetic graph into each candidate, runs the three sub-metrics, emits a JSON envelope with the picked store (or KILL/re-scope verdict)
- `bin/gsd-t-graph-synthetic-gen.cjs` — synthetic ~1.5M-node graph generator (node/edge/tier/content-hash shape matching Atos scale)
- `.gsd-t/contracts/graph-store-schema-contract.md` — the store-schema contract (node/edge/tier/content-hash columns) the Wave-2 trio (D3/D4/D5) consumes
- `.gsd-t/spikes/k1-store-bakeoff-results.md` — the result doc: picked store + all three sub-metrics, recorded for progress.md
- `test/m94-k1-store-bakeoff.test.js` — tests for the generator + bake-off harness (kill-criteria honored, envelope shape)
- `.gsd-t/domains/d1-store-bakeoff-spike/{scope,constraints,tasks}.md` — this domain's own GSD-T metadata

## Files Owned
- `bin/gsd-t-graph-synthetic-gen.cjs`
- `bin/gsd-t-graph-store-bakeoff.cjs`
- `.gsd-t/contracts/graph-store-schema-contract.md`
- `.gsd-t/spikes/k1-store-bakeoff-results.md`
- `test/m94-k1-store-bakeoff.test.js`

## NOT Owned (do not modify)
- `bin/gsd-t-graph-ts-throughput.cjs` and `.gsd-t/contracts/graph-parser-floor-contract.md` — owned by d2-treesitter-throughput-spike
- `bin/gsd-t-graph-index.cjs`, `bin/gsd-t-graph-scip-upgrade.cjs`, `bin/gsd-t-graph-edge-extract.cjs` — owned by d3-indexer-core
- `bin/gsd-t-graph-freshness.cjs` — owned by d4-freshness
- `bin/gsd-t-graph-query-cli.cjs` — owned by d5-query-cli
- `commands/gsd-t-scan.md`, `templates/workflows/gsd-t-scan.workflow.js` — owned by d6-scan-wiring
- `bin/graph-*.js` (the dead M20–M21 files) — read for LESSONS only, never edited
