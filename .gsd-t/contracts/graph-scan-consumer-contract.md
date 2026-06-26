# Contract: Graph Scan Consumer Wiring

**Status:** DRAFT — authored by D6 during Wave-3 wiring (after the Wave-2 build trio integrates).
**Owner:** d6-scan-wiring
**Consumers:** none (terminal consumer — the falsifiable payoff)
**Version:** 0.2.0 (DRAFT — AC-4 rescoped to INSIGHT-delta-only per user decision 2026-06-25; SPEED / cost-critical-path axis dropped from M94)

## Purpose
How `/scan` (the FIRST narrow consumer) consumes the deterministic query CLI's pre-computed structural slice ADDITIVELY — the current `/scan` architecture is kept FULLY INTACT (it works, it's praised; Destructive Action Guard). The graph makes scan's structural findings ACCURATE (graph-derived, not LLM-reconstructed), it does NOT replace scan's enumerate-and-deep-read pipeline.

## AC-4 — what the graph actually does for scan (INSIGHT DELTA ONLY — user rescope 2026-06-25)

**SCOPE DECISION (user, 2026-06-25):** AC-4 = **INSIGHT delta only**. M94 keeps the CURRENT `/scan` architecture fully intact; the graph is wired ADDITIVELY. AC-4 is NOT a speed claim and NOT a files-read claim — both were UNBINDABLE without redesigning scan's enumerate-EVERY-file logic-bug mandate (finding in-file logic defects genuinely requires reading the file; a relationship graph holds no logic, so it cannot displace that read). That redesign is a SEPARATE future milestone ("re-think `/scan` from the graph up"), recorded out-of-scope below.

What the graph DOES for scan, additively:
1. **SKIP RELATIONSHIP-RECONSTRUCTION (accuracy).** Call chains, imports, dependents, dead-code, cycles, coupling are **PRE-COMPUTED** in the graph. Today the deep-finder agents reconstruct these by reading files (error-prone); the graph hands them over already-resolved and ACCURATE, INJECTED into the `scanSlice` agent context.
2. **DETERMINISM.** The structural findings come from a deterministic index, not from an LLM's per-run reconstruction — so they are repeatable, not stochastic.

So **AC-4 = a graph-wired `/scan` surfaces ≥ the no-graph run's structural findings PLUS ≥1 the no-graph run MISSED or got WRONG** (a real dead-code symbol / cycle / dependent the raw-read reconstruction failed to catch). Falsifiable, measured on a pinned Atos SHA, neither asserted.

### The specific scan findings the graph feeds (additive injection — NOT a path/speed binding)
The structural / dependency / dead-code / cycle / coupling findings that today come from the deep-finder agents **reconstructing relationships by reading** are now pre-computed by the graph and **INJECTED into the `scanSlice` agent context** so those findings are ACCURATE. This is ADDITIVE: scan still enumerates and deep-reads every file for in-file logic defects (the part the graph cannot replace). The graph supplies the relationship layer; scan keeps its content layer.

### The TWO distinct runs (no-graph baseline vs graph-wired — same pinned SHA)
The insight baseline MUST be the NO-GRAPH run (today's scan reading raw source) to prove the graph surfaces findings raw-reading missed. Comparing graph-vs-graph would show ~zero delta. The plan defines TWO runs, both on the SAME pinned Atos SHA:
- **no-graph baseline:** today's `/scan` with graph wiring DISABLED (the grep-mode path) — the structural-findings BASELINE for the INSIGHT axis.
- **graph-wired:** index built (if absent) → query → structural slice injected into the `scanSlice` deep-finders — the SMART-REACH run.

### Pre-registered PASS threshold (falsifiable — the INSIGHT gate is the SOLE AC-4 binding)
Measured on the SAME pinned Atos commit SHA for both runs:
- **INSIGHT gate (`[RULE] scan-insight-gate`):** the graph-wired run surfaces **≥ the no-graph baseline's structural findings PLUS ≥1 structural finding the no-graph run missed or got wrong** (a concrete, named dead-code symbol / cycle / coupling / dependent). The comparison is graph-wired-vs-no-graph — NOT graph-vs-graph (which would show ~zero delta and silently mis-pass). The ≥1 missed/wrong finding MUST be a concrete named structural fact, not a generic claim.
- **Graph-attribution clause (`[RULE] scan-insight-delta-graph-attributed`):** because `/scan`'s deep-finders are stochastic LLM agents, a single no-graph-vs-graph diff could reflect mere run-to-run LLM variance with NO graph contribution. So the ≥1 missed/wrong delta finding MUST be **traceable to the graph's deterministic query result** — it appears in the injected structural slice (a D5 query output recorded in the result doc), and the test FAILS if the claimed delta is not backed by a graph query result. This is what makes the INSIGHT gate falsifiable rather than a variance artifact.
- **Consumed-not-just-passed clause (`[RULE] scan-slice-consumed`):** "injected" is not enough — the dead-injection trap is passing the slice into context the deep-finders never use. The graph-wired run's output MUST contain ≥1 structural finding **byte-traceable to the injected D5 query result** (the same symbol/cycle/dependent the CLI returned), proving the slice reached a finding.

**OUT OF SCOPE for AC-4 (dropped from M94 by the user rescope):** any SPEED ceiling (run-2 < 0.5× run-1), any COST-CRITICAL-PATH / files-read assertion, and the three-run speed split. AC-4 measures NO wall-clock. The "reads fewer files / faster" redesign is a SEPARATE future milestone.

### Atos commit-SHA pin (no finding-set against an unpinned/absent repo)
- `[RULE] ac4-atos-sha-pinned` — the no-graph and graph-wired runs MUST be measured against the SAME pinned Atos commit SHA (asserted equal). The measurement **fails LOUD on repo-not-found OR commit-mismatch** — a finding-set is NEVER recorded against an unpinned or absent repo.

## Wiring (additive — current scan kept intact)
- **build:** if `store.exists()` is false → `build_index(repo)` first
- **query + inject:** query the D5 CLI (`who-imports` / `who-calls` / `blast-radius`) for the structural slice and INJECT it into the `scanSlice` deep-finder agent context — ADDITIVELY, so the deep-finders reason over accurate pre-computed structure. Scan's enumerate-and-deep-read pipeline is NOT removed
- `[RULE] scan-injects-structural-slice` — scan answers structural questions from the index (accurate, deterministic), additively to its existing content read

## Fallback
- query CLI returns `{ok:false, reason:"graph-unavailable"}` → scan falls back to today's grep mode, ANNOUNCED (never silent). No grep when the index is live.

## Sandbox (M81)
- `templates/workflows/gsd-t-scan.workflow.js` stays runtime-native — the query-CLI call is delegated to an inline `agent()` Bash helper; no `require`/`fs`/`child_process`.

## AC-4 measurement protocol (INSIGHT delta only)
- PIN the Atos commit SHA; assert no-graph SHA == graph-wired SHA (both runs on the same pin); fail LOUD on repo-not-found / commit-mismatch (`[RULE] ac4-atos-sha-pinned`).
- Run BOTH on the SAME pinned SHA, then measure the INSIGHT axis:
  - **Insight:** the structural-findings set + accuracy of the graph-wired run vs the **no-graph baseline**; PASS iff graph-wired ⊇ no-graph findings PLUS ≥1 concrete named finding the no-graph run missed/got-wrong (`[RULE] scan-insight-gate`).
- Record both structural-findings sets + the named missed/wrong finding + the pinned SHA in `.gsd-t/spikes/ac4-scan-insight-delta-results.md`, progress.md, and CHANGELOG.md, with a LIVE-CLOCK timestamp.
- NO wall-clock / speed / files-read number is recorded for AC-4 (that axis is out of M94).

## Consumed (frozen)
- `graph-query-cli-contract.md` (D5) — the JSON envelope
