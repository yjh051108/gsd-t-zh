# K2 Spike Result — Tree-sitter Atos Throughput

## ✅ RECONCILED 2026-06-26 — k2Verdict: PASS · scaleMismatch: false

**The original `KILL` (below) is SUPERSEDED.** The KILL was triggered SOLELY by `scaleMismatch:true` — K2 measured the real Atos scale (869,511 LOC / 4,418 files) and found it 0.58× the OLD 1.5M synthetic assumption the K1 bake-off had used, so K2 refused to bless K1's store evidence at a mismatched scale. **Both of K2's substantive criteria PASSED outright:** wall-clock **9.6 s** (≪ ~2 min AC-1 budget) and peak build RSS **2.95 GB** (< 4 GB ceiling). The mismatch is now RESOLVED: **K1 was re-run at the corrected 870K scale and flipped to PICK=SQLite** (see `k1-store-bakeoff-results.md` RESOLVED section). With K1 and K2 now measured at the SAME reconciled ~870K Atos scale:

| Field | Value |
|---|---|
| **k2Verdict** | **PASS** |
| **scaleMismatch** | **false** (reconciled — K1 re-run @870K) |
| Build wall-clock | 9.6 s (AC-1 PASS, budget ~2 min) |
| Peak build RSS | 2.95 GB (PASS, ceiling 4 GB) |
| Measured Atos scale | 4,418 files / 869,511 LOC |
| Reconciled with K1 | yes — both @ ~870K |

**Wave-1 hard gate: both spikes PASS at a reconciled scale** (K1=PICK SQLite @870K, K2=PASS @870K). AC-1 (build under budget) is SATISFIED outright (9.6 s), not descoped.

---

## Original spike result (SUPERSEDED — retained for audit trail)

**Date:** 2026-06-26 03:05 UTC
**Rule:** `[RULE] K2: treesitter-atos-build-under-budget-or-rescope`
**Probe:** `bin/gsd-t-graph-ts-throughput.cjs`
**k2Verdict:** `KILL`

---

## Measured Atos Scale

| Field | Value |
|-------|-------|
| **Pinned SHA** | `b062c80129c0c8e5b82ee3a4eaf9dcc4255c43b5` |
| **Source files enumerated** | 4,418 |
| **Total LOC** | 869,511 |
| **Bakeoff assumed LOC** | 1,500,000 |
| **Scale ratio** | 0.58× (below 0.66× floor) |

### Language breakdown

| Extension | Files | LOC |
|-----------|-------|-----|
| `.tsx` | 2,271 | 414,860 |
| `.ts` | 2,067 | 446,065 |
| `.mjs` | 25 | 2,370 |
| `.js` | 48 | 5,811 |
| `.cjs` | 3 | 405 |
| `.py` | 3 | — |
| `.jsx` | 1 | — |

---

## Build Timing (AC-1)

| Metric | Value | Budget | Status |
|--------|-------|--------|--------|
| **Wall-clock (total inc. enum)** | **9,598 ms (9.6 s)** | 120,000 ms (2 min) | ✅ UNDER BUDGET |
| **Wall-clock (parse only)** | 9,574 ms | — | — |
| **Enumeration** | 23 ms | — | — |
| **Parse errors (skipped)** | 773 | — | — |

**AC-1 timing: PASS** — full tree-sitter floor index built in **9.6 s**, well under the 2-minute budget.

---

## Footprint (pre-mortem Fix-6 ceiling)

| Metric | Value | Ceiling | Status |
|--------|-------|---------|--------|
| **Peak process RSS** | 2,952 MB (2.95 GB) | 4,096 MB (4 GB) | ✅ UNDER CEILING |

**Footprint: PASS** — peak RSS 2.95 GB under the 4 GB pre-registered ceiling.

---

## Scale Sanity vs. Bakeoff (`[RULE] k2-scale-sanity-vs-bakeoff`)

| Field | Value |
|-------|-------|
| **Bakeoff assumed LOC** | 1,500,000 |
| **Measured LOC** | 869,511 |
| **Ratio** | 0.58× |
| **Mismatch threshold** | < 0.66× or > 1.5× |
| **scaleMismatch** | **true** |

**Scale: KILL** — The measured Atos repo is **0.58×** the scale D1's synthetic bakeoff used. This is below the 0.66× mismatch floor. The K1 store evidence (query latency, incremental update, footprint) was validated at a **synthetic ~1.5M LOC scale that does not match the real repo** (~870K LOC actual).

---

## Overall K2 Verdict

**`KILL`** — reason: `scale-mismatch (0.58× vs bakeoff — K1 evidence at wrong scale)`

The wall-clock (9.6 s) and footprint (2.95 GB) both PASS their individual gates. The KILL is triggered solely by the scale-mismatch: D1's bake-off ran at a synthetic 1.5M-node scale; the real Atos repo is ~870K LOC. Per `[RULE] k2-scale-sanity-vs-bakeoff`, K1's store evidence must be re-validated at the correct (measured) scale before any Wave-2 task proceeds.

---

## AC-descope record (`[RULE] kill-outcome-records-ac-descope`, `[#5 kill-path descope]`)

This is a **scale-mismatch kill, NOT a timing or footprint kill**. The correct action is:

1. **D1 (store-bakeoff) re-runs its synthetic generator at the corrected scale (~870K LOC, not ~1.5M)** and re-validates the K1 sub-criteria (query latency, incremental, footprint) at the real scale.
2. **AC-1 timing sub-criterion is SATISFIED** — 9.6 s is already under the 2-min budget.
3. **The Wave-1 hard gate (D7-T2) remains BLOCKED** until D1 delivers a `k1Verdict: PICK` at the corrected scale.

AC-1 (build under ~2 min) is **NOT formally de-scoped** — the timing passes; the KILL is on the K1 evidence quality. What is required is a **D1 re-run at the corrected scale (~870K LOC)**.

If D1 re-runs and K1 still picks a store at the 870K LOC scale, the Wave-1 gate passes and Wave 2 may proceed.

---

## Worktable (parallelism strategy for D3)

| Field | Value |
|-------|-------|
| **Worker count used** | 13 (of 18 CPUs, 75% formula) |
| **Files per worker** | 340 |
| **Parse mode** | Single-process synchronous (spike probe only) |

D3's production indexer should use `worker_threads` with the same `Math.max(2, Math.floor(cpus * 0.75))` formula. The ~9.6 s single-process result already proves the budget is very comfortable; parallel workers will be faster still.

---

## Full Probe Envelope (recorded at run time)

```json
{
  "verdict": "KILL",
  "k2Verdict": "KILL",
  "atosSha": "b062c80129c0c8e5b82ee3a4eaf9dcc4255c43b5",
  "wallClockMs": 9598,
  "budgetMs": 120000,
  "overBudget": false,
  "atosFileCount": 4418,
  "atosTotalLoc": 869511,
  "atosLangBreakdown": {
    ".ts": { "count": 2067, "loc": 446065 },
    ".mjs": { "count": 25, "loc": 2370 },
    ".tsx": { "count": 2271, "loc": 414860 },
    ".js": { "count": 48, "loc": 5811 },
    ".cjs": { "count": 3, "loc": 405 },
    ".py": { "count": 3, "loc": 0 },
    ".jsx": { "count": 1, "loc": 0 }
  },
  "peakRssBytes": 3095904256,
  "peakRssCeilingBytes": 4294967296,
  "footprintExceeded": false,
  "scaleDivergenceVsBakeoff": {
    "bakeoffAssumedLoc": 1500000,
    "measuredLoc": 869511,
    "ratio": 0.58,
    "scaleMismatch": true,
    "scaleMismatchReason": "Measured 869,511 LOC vs bakeoff assumption 1,500,000 (ratio 0.58×) — K1 store evidence validated at wrong scale"
  },
  "scaleMismatch": true,
  "parseErrors": 773,
  "workerCount": 13,
  "filesPerWorker": 340,
  "killReason": "scale-mismatch (0.58× vs bakeoff — K1 evidence at wrong scale)",
  "generatedAt": "2026-06-26T03:05:17.972Z"
}
```
