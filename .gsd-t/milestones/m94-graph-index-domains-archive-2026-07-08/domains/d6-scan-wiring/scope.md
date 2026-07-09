# Domain: d6-scan-wiring

## Responsibility
WAVE 3 CONSUMER WIRING (after the Wave-2 build trio integrates; the falsifiable payoff). Wire `/scan` FIRST as the narrow consumer set, ADDITIVELY — the current `/scan` architecture is kept FULLY INTACT (it works, it's praised; Destructive Action Guard). Build the index (if `store.exists()` is false); then query the D5 CLI for the pre-computed structural slice (dependents/dead-code/cycles/coupling) and INJECT it into the `scanSlice` deep-finder agent context so those findings are ACCURATE (graph-derived, not LLM-reconstructed). **AC-4 RESCOPED (user, 2026-06-25): INSIGHT DELTA ONLY** — compare a NO-GRAPH baseline run vs a GRAPH-WIRED run on the SAME pinned Atos SHA; PASS iff the graph-wired run surfaces ≥ the no-graph findings PLUS ≥1 the no-graph run missed/got wrong. The SPEED / file-count / cost-critical-path axis is DROPPED from M94 (deferred to a separate scan-redesign milestone) — no wall-clock measured. Falls back to grep mode LOUDLY only on graph-unavailable.

## Owned Files/Directories
- `commands/gsd-t-scan.md` — the scan command file: edited to call the deterministic query CLI when the index is live (additive), announce grep-mode fallback on graph-unavailable (extend-class — existing file)
- `templates/workflows/gsd-t-scan.workflow.js` — the scan workflow: build-if-absent / query-then-inject-structural-slice wiring, additive (extend-class — existing file)
- `.gsd-t/contracts/graph-scan-consumer-contract.md` — the scan-consumer contract: how /scan invokes the query CLI, the fallback rule, the AC-4 INSIGHT-delta measurement protocol
- `.gsd-t/spikes/ac4-scan-insight-delta-results.md` — both runs' structural-findings sets (no-graph baseline / graph-wired) + the named missed/wrong finding for AC-4, recorded for progress.md + CHANGELOG
- `test/m94-d6-scan-consumer.test.js` — scan wiring: queries the index when warm + injects the structural slice, falls back to grep mode (announced) on graph-unavailable, AC-4 insight gate
- `.gsd-t/domains/d6-scan-wiring/{scope,constraints,tasks}.md` — this domain's own GSD-T metadata

## Files Owned
- `.gsd-t/contracts/graph-scan-consumer-contract.md`
- `commands/gsd-t-scan.md`
- `templates/workflows/gsd-t-scan.workflow.js`
- `.gsd-t/spikes/ac4-scan-insight-delta-results.md`
- `test/m94-d6-scan-consumer.test.js`

## NOT Owned (do not modify)
- All `bin/gsd-t-graph-*.cjs` — owned by the Wave-1 spikes (d1, d2) and the Wave-2 build trio (d3, d4, d5). D6 CONSUMES the D5 query-cli contract; it edits no graph bin file.
- `.gsd-t/contracts/graph-store-schema-contract.md`, `graph-parser-floor-contract.md`, `graph-indexer-build-contract.md`, `graph-freshness-contract.md`, `graph-query-cli-contract.md` — owned by d1–d5 (consumed read-only)
