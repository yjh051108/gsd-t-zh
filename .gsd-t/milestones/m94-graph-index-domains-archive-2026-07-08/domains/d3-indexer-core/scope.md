# Domain: d3-indexer-core

## Responsibility
WAVE 2 BUILD (starts only after the K1+K2 HARD GATE passes; runs concurrently with d4 and d5). Fresh `build_index` on the tree-sitter floor + optional per-language SCIP upgrade (scip-typescript / scip-python / rust-analyzer scip). Extracts entities + import-graph (file→file) + call-graph (function→function) edges per the parser-floor contract (D2) and writes them to the store per the store-schema contract (D1). Labels every edge with its accuracy tier (compiler-accurate / tree-sitter-floor) and FLAGS Rust cross-crate edges partial — never silently wrong.

## Owned Files/Directories
- `bin/gsd-t-graph-index.cjs` — `build_index(repo)`: per-file tree-sitter floor parse → entities + edges → store.put with tier; the build surface D6 (run-1) and D5 (re-index) call
- `bin/gsd-t-graph-scip-upgrade.cjs` — optional per-language SCIP upgrade (scip-typescript/scip-python/rust-analyzer scip); compiler-accurate re-derivation where present, tier-labeled
- `bin/gsd-t-graph-edge-extract.cjs` — edge extraction: import-graph file→file, call-graph function→function, entities; per the parser-floor taxonomy
- `.gsd-t/contracts/graph-indexer-build-contract.md` — the build/put surface contract D4 (per-file re-parse call) and D5 (re-index inline) consume
- `test/m94-d3-indexer-core.test.js` — indexer + edge-extraction tests (entities/edges per taxonomy, store-write shape)
- `test/m94-d3-accuracy-tiers.test.js` — AC-6 honesty: compiler-accurate vs tree-sitter-floor labeled, Rust cross-crate flagged partial, never an unlabeled mix
- `.gsd-t/domains/d3-indexer-core/{scope,constraints,tasks}.md` — this domain's own GSD-T metadata

## Files Owned
- `bin/gsd-t-graph-edge-extract.cjs`
- `bin/gsd-t-graph-index.cjs`
- `bin/gsd-t-graph-scip-upgrade.cjs`
- `.gsd-t/contracts/graph-indexer-build-contract.md`
- `test/m94-d3-indexer-core.test.js`
- `test/m94-d3-accuracy-tiers.test.js`

## NOT Owned (do not modify)
- `bin/gsd-t-graph-store-bakeoff.cjs`, `bin/gsd-t-graph-synthetic-gen.cjs`, `.gsd-t/contracts/graph-store-schema-contract.md` — owned by d1 (consumed as frozen)
- `bin/gsd-t-graph-ts-throughput.cjs`, `.gsd-t/contracts/graph-parser-floor-contract.md` — owned by d2 (taxonomy LIFTED from the contract, files not edited)
- `bin/gsd-t-graph-freshness.cjs` — owned by d4 (d4 calls THIS domain's per-file parse function — a function-level call, not a file edit)
- `bin/gsd-t-graph-query-cli.cjs` — owned by d5
- `commands/gsd-t-scan.md`, `templates/workflows/gsd-t-scan.workflow.js` — owned by d6
- `bin/graph-parsers.js`, `bin/graph-indexer.js` (dead M20–M21) — read for lessons only, never edited
