# Scope: d7-integrate-rewire (INTEGRATE-stage domain — the two CRITICAL wiring/owner gaps + the machine-checkable Wave-1 gate)

## Mission
The integrate-stage owner for the three RE-PLAN tasks that have NO Wave-1/2/3 domain home and that MUST be sole-owned to preserve file-disjointness:
1. **Fix-1 (CRITICAL, USER-APPROVED destructive)** — rewire `bin/gsd-t.js` `case "graph"` to delegate to the NEW D5 query CLI (`bin/gsd-t-graph-query-cli.cjs`) AND delete the 6 dead M20–M21 `bin/graph-*.js` engine files + their 3 dead test files. This is the SOLE owner of the `bin/gsd-t.js` graph-dispatch edit anywhere in the milestone.
2. **Fix-2 (CRITICAL)** — own + write the Wave-2 live-store seam test (`test/m94-integrate-live-store-seam.test.js`) that the prior round NAMED but left ownerless, AND publish the M94 integration-points doc at the path the integrate workflow actually reads (`.gsd-t/contracts/m94-integration-points.md`).
3. **Fix-4 (HIGH)** — own the machine-checkable Wave-1 prove-or-kill HARD GATE test (`test/m94-wave1-hard-gate.test.js`) that reads the `k1Verdict`/`k2Verdict` fields D1-T3/D2-T3 write.

## Why a separate domain (file-disjointness)
- `bin/gsd-t.js` is a SHARED entry-point file. NO Wave-1/2/3 domain touches it. d7 is its SOLE writer for the graph-dispatch edit — keeps file-disjointness PROVABLE (the M20–M21 dead engine lived under the bare `graph-` prefix; the new code is `gsd-t-graph-*`, so the rewire only edits the dispatch, never the new CLI).
- The 6 dead `bin/graph-*.js` + 3 dead `test/graph-*.test.js` are deleted ONLY by d7 — no other domain references them (requirer-verified this session: the only live requirers are `bin/gsd-t.js` lines 3513/3531/3548 [the dispatch being rewired] + the 3 dead tests).
- The 3 new test files + the new integration-points doc are net-new write targets uniquely owned by d7.

## Files Owned
- `bin/gsd-t.js` (graph-dispatch region only — `doGraphIndex`/`doGraphStatus`/`doGraphQuery`/`doGraph` + the `case "graph"` dispatch; the rewire + dead-require removal). NOT the headless `queryGraph`/`doHeadlessQuery graph` path (reads `.gsd-t/graph-index/meta.json` directly, requires NO dead file — left intact this milestone).
- `test/m94-d5-graph-dispatch.test.js` (NEW — Fix-1 integration test)
- `test/m94-integrate-live-store-seam.test.js` (NEW — Fix-2 seam test, the #8 seam given a real owner)
- `test/m94-wave1-hard-gate.test.js` (NEW — Fix-4 machine-checkable gate)
- `.gsd-t/contracts/m94-integration-points.md` (NEW — the integrate-read-path copy)
- DELETE: `bin/graph-store.js`, `bin/graph-cgc.js`, `bin/graph-indexer.js`, `bin/graph-overlay.js`, `bin/graph-parsers.js`, `bin/graph-query.js`, `test/graph-indexer.test.js`, `test/graph-store.test.js`, `test/graph-query.test.js` (USER-APPROVED destructive; requirer-verified safe)

## NOT Owned
- The new D5 query CLI `bin/gsd-t-graph-query-cli.cjs` (D5 owns; d7 only delegates the dispatch TO it)
- Any other domain's bin/test/contract files
- `bin/gsd-t.js` headless `queryGraph` (4028) — out of scope this milestone

## Wave
INTEGRATE stage — runs AFTER the Wave-2 build trio (d3+d4+d5) integrates and BEFORE/AT the Wave-3 verify. The Fix-1 rewire requires the D5 CLI to exist; the seam test requires the real D3→D1→D5 pipeline; the hard-gate test requires the K1/K2 result envelopes.
