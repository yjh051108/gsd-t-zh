# Constraints: d1-store-bakeoff-spike

## Must Follow
- **Zero external runtime deps for the installer** (CLAUDE.md zero-dep invariant). Any candidate store driver used in the SPIKE must be installed as a DEV/spike-only dependency, never added to the shipped `package.json` `dependencies`. The spike is throwaway; it proves feasibility, it does not ship a store driver into the installer.
- `bin/<tool>.cjs` CLI convention: returns a JSON envelope on stdout, ANSI colors via escape codes, sync file APIs, exit code reflects pass/fail.
- **[RULE] K1: store-picked-on-evidence-or-rescope** — pick a store ONLY if it clears ALL three sub-criteria (embedded/on-disk/no-server/no-paid-license AND query-latency target AND sub-~1s single-file incremental + one-hop re-validation). If none clears all three, emit a KILL_OR_RESCOPE verdict (e.g. narrow Phase-1 to import-graph-only, or cap repo size) — never assert a winner.
- Record the picked store + all three sub-metrics in `.gsd-t/spikes/k1-store-bakeoff-results.md` AND `progress.md`.
- Live-clock rule: every timestamp written to the result doc / progress.md comes from the live clock.
- The store-schema contract MUST declare node/edge/tier/content-hash columns — the exact shape D3/D4/D5 build against. Mark it STABLE only once K1 picks a store.

## Must Not
- Modify files outside owned scope.
- Add a store driver to the shipped installer `dependencies` (zero-dep invariant).
- Write ANY production indexer / freshness / query / scan code — this is a throwaway spike.
- Assert a store choice without measured evidence (the kill criterion is the whole point).
- Lift/edit `bin/graph-store.js` (dead M20–M21) — read for lessons only.

## Dependencies
- Depends on: nothing (Wave 1, runs concurrently with d2).
- Depended on by: d3-indexer-core, d4-freshness, d5-query-cli for the **graph-store-schema-contract** (node/edge/tier/content-hash columns) and the picked-store decision. The Wave-2 trio is BLOCKED until the K1+K2 hard gate passes.
