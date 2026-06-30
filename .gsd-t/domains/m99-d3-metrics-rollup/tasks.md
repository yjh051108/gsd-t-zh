# Tasks: m99-d3-metrics-rollup

> **Wave 2** — starts ONLY after D1's resolver lands. Runs in parallel with D2; fully file-disjoint.
> Pure READER + sole CONTRACT owner. Writes NOTHING the writers (D1/D2) own; zero data-touching, zero
> path mutation. IMPORTS `resolveLogsDir` from D1. Contract:
> [`graph-metrics-contract.md`](../../contracts/graph-metrics-contract.md) (D3 finalizes it).

## Files Owned
- bin/gsd-t.js
- bin/gsd-t-graph-metrics-rollup.cjs
- .gsd-t/contracts/graph-metrics-contract.md
- test/m99-graph-metrics-rollup.test.js

---

### M99-D3-T1 — read-only rollup helper
**Headline:** true
**What:** Create `bin/gsd-t-graph-metrics-rollup.cjs` — READ-ONLY. Reads all
`graphDB/logs/graph-events-*.jsonl` via D1's imported `resolveLogsDir` (handles the rotated `-001`/`-002`
set); tolerates a missing / empty / rotated ledger and an absent `graphDB/logs/` dir (returns a zeroed
report, NEVER crashes, NEVER writes). Reports: graph-hit-vs-grep-passthrough ratio, fallback-rate,
p50/p95 latency, tier mix, stale-query frequency, reindex frequency, per-consumer + per-verb breakdown —
mirroring the existing `gsd-t metrics` (`doMetrics`, `bin/gsd-t.js:4697`) shape/flags.
**NORTH-STAR CONTRADICTION COUNT (pre-mortem #8):** the rollup ALSO computes + reports a
`fallbackAnnouncedDespiteHit` count — the number of windows where a Layer-2c `graphWiringMode:'fallback-announced'`
wiring line co-occurs with a same-window Layer-1 `outcome:'hit'`. A non-zero count is the machine-visible
NiceNote contradiction; this count is the single number that proves the milestone's reason to exist works.
**Files:** `bin/gsd-t-graph-metrics-rollup.cjs` (NEW) — `rollup()` reading via `resolveLogsDir`,
percentile + group-by aggregation, the `fallbackAnnouncedDespiteHit` co-occurrence scan, zeroed-on-empty guard.
**Touches:** bin/gsd-t-graph-metrics-rollup.cjs
**Contract:** graph-metrics-contract.md § Rollup output shape (all 8 dimensions + `fallbackAnnouncedDespiteHit`); graph-store-resolver-contract.md (import `resolveLogsDir`).
**Depends on:** D1 complete (imports `resolveLogsDir`).
**Test:** `test/m99-graph-metrics-rollup.test.js` — over a fixture ledger (Layer-1 `query` + Layer-2a
`grep` + 2b `read` + 2c `wiring` lines spanning `-001` AND `-002`): asserts each of the 8 dimensions
computes correctly (hit-vs-passthrough ratio, fallback-rate, p50/p95, tier mix, stale/reindex frequency,
per-consumer + per-verb); **asserts `fallbackAnnouncedDespiteHit` (pre-mortem #8):** a fixture with a
`fallback-announced` wiring line + a same-window `outcome:'hit'` ⇒ count ≥ 1; a clean fixture ⇒ count 0;
an EMPTY/MISSING `graphDB/logs/` ⇒ zeroed report, no crash; a `--purge`/write of any kind ⇒ ABSENT (assert
the helper opens no file for writing — the never-writes proof).
**AC:** Criterion 14 (rollup exists, all dimensions, no crash on empty/rotated), Criterion 13 (`fallbackAnnouncedDespiteHit` north-star count). `[RULE] read-only-rollup`, `[RULE] tolerate-empty-rotated`, `[RULE] import-resolveLogsDir`, `[RULE] mirror-doMetrics-shape`, `[RULE] fallback-despite-hit-counted`. **This is the milestone's headline READ capability — the rollup (incl. the contradiction count) is the whole point of the ledger.**

### M99-D3-T2 — wire `gsd-t graph metrics` dispatch
**What:** Add `case "metrics"` to the `doGraph` switch in `bin/gsd-t.js` (the switch ends at `:3884`
with `case "tasks"`; insert an APPEND-ONLY arm after it) dispatching to the rollup helper; add the
`metrics` line to the `graph` usage string. Touch NO other dispatch arm (D1/D2 edit this file in ZERO
places — D3 stays the sole editor of `bin/gsd-t.js` for M99).
**Files:** `bin/gsd-t.js` — `doGraph` switch (after `:3884` `case "tasks"`) + the `graph` usage string.
**Touches:** bin/gsd-t.js
**Contract:** graph-metrics-contract.md § Rollup output shape (dispatch surface).
**Depends on:** M99-D3-T1.
**Test:** `test/m99-graph-metrics-rollup.test.js` — invoking `gsd-t graph metrics` (or the in-process
`doGraph(['metrics'])`) returns the rollup envelope and exits 0 on an empty ledger.
**AC:** Criterion 14 (`gsd-t graph metrics` exists, mirrors `gsd-t metrics` shape). `[RULE] append-only-switch-arm`.

### M99-D3-T3 — finalize the contract (reconcile with emitted keys)
**What:** Finalize `.gsd-t/contracts/graph-metrics-contract.md` (v1.0.0 DEFINED → STABLE). Reconcile the
documented event + rollup schema with the keys D1/D2 ACTUALLY emit (`consumer`/`via`/`outcome`/`tier`/
`graphWiringMode`/`fallbackAnnouncedDespiteHit` + the Layer-2 decision-line fields). **Fix the known drift
(pre-mortem #7):** the contract's § Rollup output shape (`:94`) cites `doMetrics` at `bin/gsd-t.js:5135` —
that line is the `case "metrics"` DISPATCH; the `doMetrics` FUNCTION DEFINITION is at `:4697`. Correct the
reference to point at the `function doMetrics` def line. A documented key the writers don't emit (or
vice-versa) is a contract drift = fail.
**Files:** `.gsd-t/contracts/graph-metrics-contract.md` — § Ledger event schema + § Rollup output shape + the `doMetrics` line ref (`:94`).
**Touches:** .gsd-t/contracts/graph-metrics-contract.md
**Contract:** (self) graph-metrics-contract.md.
**Depends on:** M99-D3-T1, T2 (and D1/D2's actual emitted keys — reconcile against them at integrate).
**Test:** `test/m99-graph-metrics-rollup.test.js` — (1) a key-set assertion: every field the rollup reads is
documented in the contract, and every documented Layer-1/2 field is one the rollup recognizes (no drift);
(2) **LINE-REF correctness (pre-mortem #7):** grep `bin/gsd-t.js` for the `function doMetrics` definition
line number and assert the contract's `doMetrics` citation points at THAT line (not the `case "metrics"`
dispatch) — a stale line-ref FAILS.
**AC:** Criterion 15 (contract documents the ledger schema + rollup shape, in sync with emitted keys + accurate `doMetrics` line-ref). `[RULE] contract-matches-emitted-keys`, `[RULE] contract-line-ref-accurate`.

### M99-D3-T4 — author the rollup test
**What:** Author `test/m99-graph-metrics-rollup.test.js` — rollup over a multi-file fixture ledger;
empty/rotated/missing tolerance; per-consumer + per-verb breakdown correctness; the never-writes assertion.
**Files:** `test/m99-graph-metrics-rollup.test.js` (NEW).
**Touches:** test/m99-graph-metrics-rollup.test.js
**Contract:** graph-metrics-contract.md § Invariants.
**Depends on:** M99-D3-T1..T3.
**Test:** the file itself, via `npm test` (+ `--test-concurrency=1 GSDT_SLOW_TESTS=1` if it builds a graph).
Includes the pre-mortem #8 `fallbackAnnouncedDespiteHit` assertion and the pre-mortem #7 `doMetrics`
line-ref correctness assertion.
**AC:** Criteria 13, 14, 15, 16 (suite green incl. this test).
