# Domain: d6-scan-wiring

## Responsibility
WAVE 3 CONSUMER WIRING (after the Wave-2 build trio integrates; the falsifiable payoff). Wire `/scan` FIRST as the narrow consumer set: run-1 builds the index (if `store.exists()` is false); run-2 (warm) reads-once-queries-after via the D5 query CLI instead of re-reading the whole Atos repo (~1.5M LOC, ~2hr today). AC-4: measure both run wall-clocks, report both in progress.md + CHANGELOG. Falls back to grep mode LOUDLY only on graph-unavailable.

## Owned Files/Directories
- `commands/gsd-t-scan.md` — the scan command file: edited to call the deterministic query CLI when the index is live, announce grep-mode fallback on graph-unavailable (extend-class — existing file)
- `templates/workflows/gsd-t-scan.workflow.js` — the scan workflow: run-1 build / run-2 query-after wiring (extend-class — existing file)
- `.gsd-t/contracts/graph-scan-consumer-contract.md` — the scan-consumer contract: how /scan invokes the query CLI, the fallback rule, the AC-4 measurement protocol
- `.gsd-t/spikes/ac4-scan-run2-speedup-results.md` — both run wall-clocks (run-1 build, run-2 warm) for AC-4, recorded for progress.md + CHANGELOG
- `test/m94-d6-scan-consumer.test.js` — scan wiring: queries the index when warm, falls back to grep mode (announced) on graph-unavailable
- `.gsd-t/domains/d6-scan-wiring/{scope,constraints,tasks}.md` — this domain's own GSD-T metadata

## Files Owned
- `.gsd-t/contracts/graph-scan-consumer-contract.md`
- `commands/gsd-t-scan.md`
- `templates/workflows/gsd-t-scan.workflow.js`
- `.gsd-t/spikes/ac4-scan-run2-speedup-results.md`
- `test/m94-d6-scan-consumer.test.js`
- `test/m94-d6-cost-critical-path.test.js`

## NOT Owned (do not modify)
- All `bin/gsd-t-graph-*.cjs` — owned by the Wave-1 spikes (d1, d2) and the Wave-2 build trio (d3, d4, d5). D6 CONSUMES the D5 query-cli contract; it edits no graph bin file.
- `.gsd-t/contracts/graph-store-schema-contract.md`, `graph-parser-floor-contract.md`, `graph-indexer-build-contract.md`, `graph-freshness-contract.md`, `graph-query-cli-contract.md` — owned by d1–d5 (consumed read-only)
