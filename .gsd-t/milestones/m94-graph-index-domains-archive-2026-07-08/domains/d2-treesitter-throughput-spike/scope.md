# Domain: d2-treesitter-throughput-spike

## Responsibility
WAVE 1 PROVE-OR-KILL spike K2 (= AC-1) — the tree-sitter throughput probe. Run the bundled tree-sitter floor over the REAL Atos repo (`/Users/david/projects/HiloAviation/hilo-figma-atos`, ~1.5M LOC mostly TS + some Python). PASS iff a full index builds under ~2 min; else KILL/re-scope budget/parallelism BEFORE building on a false premise. Establishes the parse harness + parallelism strategy and the parser-floor contract (entity/edge taxonomy) D3 lifts the WHAT from.

## Owned Files/Directories
- `bin/gsd-t-graph-ts-throughput.cjs` — the throughput probe: full tree-sitter floor parse of the Atos repo, wall-clock measured, parallelism strategy, PASS/KILL verdict
- `.gsd-t/contracts/graph-parser-floor-contract.md` — the parser-floor contract: entity/edge taxonomy (imports/exports/functions/classes/requires/call-sites) salvaged-as-lessons from the dead `bin/graph-parsers.js`, plus the parse-harness + parallelism interface D3 consumes
- `.gsd-t/spikes/k2-treesitter-atos-throughput-results.md` — the result doc: build wall-clock + verdict, recorded for progress.md
- `test/m94-k2-treesitter-throughput.test.js` — tests for the probe (verdict logic, budget threshold, envelope shape) — runnable without the Atos repo present (uses a small fixture for harness correctness)
- `.gsd-t/domains/d2-treesitter-throughput-spike/{scope,constraints,tasks}.md` — this domain's own GSD-T metadata

## Files Owned
- `.gsd-t/contracts/graph-parser-floor-contract.md`
- `bin/gsd-t-graph-ts-throughput.cjs`
- `.gsd-t/spikes/k2-treesitter-atos-throughput-results.md`
- `test/m94-k2-treesitter-throughput.test.js`

## NOT Owned (do not modify)
- `bin/gsd-t-graph-store-bakeoff.cjs`, `bin/gsd-t-graph-synthetic-gen.cjs`, `.gsd-t/contracts/graph-store-schema-contract.md` — owned by d1-store-bakeoff-spike
- `bin/gsd-t-graph-index.cjs`, `bin/gsd-t-graph-scip-upgrade.cjs`, `bin/gsd-t-graph-edge-extract.cjs` — owned by d3-indexer-core (D3 LIFTS the taxonomy from this domain's contract; it does not edit this domain's files)
- `bin/gsd-t-graph-freshness.cjs` — owned by d4-freshness
- `bin/gsd-t-graph-query-cli.cjs` — owned by d5-query-cli
- `commands/gsd-t-scan.md`, `templates/workflows/gsd-t-scan.workflow.js` — owned by d6-scan-wiring
- `bin/graph-parsers.js` (dead M20–M21) — read for the edge TAXONOMY only, never edited
