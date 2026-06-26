# Contract: Graph Scan Consumer Wiring

**Status:** DRAFT — authored by D6 during Wave-3 wiring (after the Wave-2 build trio integrates).
**Owner:** d6-scan-wiring
**Consumers:** none (terminal consumer — the falsifiable payoff)
**Version:** 0.1.0 (DRAFT)

## Purpose
How `/scan` (the FIRST narrow consumer) uses the deterministic query CLI instead of re-reading the whole Atos repo (~1.5M LOC, ~2hr today).

## AC-4 — what the graph actually does for scan (the BINDING reframe, per the user decision)

AC-4 is NOT "scan queries the index when warm." That is the *mechanism invoked*, not the *payoff*. The graph speeds scan up via **THREE distinct mechanisms**, AND improves insight quality. AC-4 binds to ALL of them — the speedup goal is NOT dropped:

1. **FEWER TOKENS.** The compact graph (relationships/edges) is far smaller than raw source, so the deep-finder agents' context fills slower and the LLM re-reads less.
2. **SKIP RELATIONSHIP-TRACING.** Call chains, imports, dependents, dead-code, cycles are **PRE-COMPUTED** in the graph. Today the deep-finder agents reconstruct these by reading files (slow + error-prone); the graph hands them over already-resolved.
3. **PRE-ORGANIZED FOR REASONING (the biggest one).** The graph presents code structure already assembled and meaningfully organized, so the LLM skips the expensive COMPREHENSION/reconstruction step and goes straight to judgment. Less reasoning load = faster AND better decisions about what matters.

**The ONLY thing the graph does NOT replace:** reading the LOGIC INSIDE a function for logic-bugs (a SQL-injection, a race). That slice of content read remains — but the LLM arrives at it already oriented, so even that is faster.

So **AC-4 = scan run-2 is FASTER (all three mechanisms) AND surfaces MORE / MORE-ACCURATE structural findings** (dead code, cycles, coupling, dependents) than the raw-code run.

### The specific scan sub-steps the graph feeds/replaces (cost-critical-path binding)
The structural / dependency / dead-code findings that today come from the deep-finder agents **reconstructing relationships by reading** are now pre-computed by the graph and **INJECTED into the `scanSlice` agent context**, so those agents do LESS reading/reasoning. Concretely, run-2 must demonstrate the index is ON the cost-critical path — not merely invoked:
- run-2 deep-finder agents **read materially fewer files** than **run-0 (the no-graph baseline)** — the structural findings are pre-supplied, not reconstructed, AND/OR
- run-2 **spawns fewer-or-cheaper deep-finder readers** than run-0 because the structural slice is pre-resolved.
- `[RULE] scan-run2-on-cost-critical-path` — a wall-clock delta ALONE is insufficient: the test must prove fewer-files-read / fewer-or-cheaper-readers vs the NO-GRAPH baseline (run-0), i.e. the graph displaces real reading/reasoning work, not just sits beside it. (Run-1 is graph-wired-but-cold, so it understates the delta — the cost-critical-path comparison is run-2 vs run-0.)

### The THREE distinct runs (the speed baseline and the insight baseline are NOT the same run)
A single "run-1" cannot serve both axes — the speed baseline is the cold-BUILD run (graph-wired, index absent), while the insight baseline must be the NO-GRAPH run (today's scan reading raw source) to prove the graph surfaces findings raw-reading missed. The plan defines THREE runs, all on the SAME pinned Atos SHA:
- **run-0 (NO-GRAPH baseline):** today's `/scan` with graph wiring DISABLED (the grep-mode path) — the structural-findings BASELINE for the INSIGHT axis. This is what run-2's insight is measured against, NOT run-1.
- **run-1 (cold, graph-wired):** `store.exists()` false → `build_index(repo)` then query — the wall-clock SPEED baseline (index build cost included).
- **run-2 (warm, graph-wired):** index present → query-after, structural slice injected — the SMART-REACH run measured on BOTH axes.

### Pre-registered numeric PASS thresholds (falsifiable — "dramatically" is NOT)
Measured on the SAME pinned Atos commit SHA for all three runs:
- **SPEED gate (`[RULE] scan-run2-speed-ceiling`):** run-2 wall-clock **< 0.5 × run-1 wall-clock** (warm vs cold-build) on the same pinned Atos SHA. The D6 result-doc check FAILS if run-2 exceeds this ceiling.
- **INSIGHT gate (`[RULE] scan-run2-insight-gate`):** run-2 surfaces **≥ run-0's (the NO-GRAPH baseline) structural findings PLUS ≥1 structural finding run-0 missed or got wrong** (dead code, cycle, coupling, or dependent). The insight comparison is run-2-vs-run-0 (graph vs no-graph) — NOT run-2-vs-run-1 (both graph-wired, which would show ~zero delta and silently mis-pass). A speed win that LOSES findings vs run-0 FAILS AC-4.
- **COST-CRITICAL-PATH gate (`[RULE] scan-run2-on-cost-critical-path`):** run-2 deep-finders read materially fewer files / spawn fewer-or-cheaper readers than **run-0** (the no-graph baseline) — proving the graph displaces the raw-reading work the no-graph run does. (Comparing run-2 vs run-1 understates the delta because run-1 is already graph-wired.)

### Atos commit-SHA pin (no number against an unpinned/absent repo)
- `[RULE] ac4-atos-sha-pinned` — run-1 and run-2 MUST be measured against the SAME pinned Atos commit SHA (asserted equal). The measurement **fails LOUD on repo-not-found OR commit-mismatch** — a number is NEVER recorded against an unpinned or absent repo.

## Wiring
- **run-1 (cold):** if `store.exists()` is false → `build_index(repo)` first
- **run-2 (warm):** read-once-query-after via the D5 query CLI (`who-imports` / `who-calls` / `blast-radius`) — NOT a whole-repo re-read; the pre-computed structural slice is INJECTED into the `scanSlice` deep-finder agent context
- `[RULE] scan-run2-reads-index-not-source` — run-2 answers structural questions from the index; both run wall-clocks reported (AC-4)

## Fallback
- query CLI returns `{ok:false, reason:"graph-unavailable"}` → scan falls back to today's grep mode, ANNOUNCED (never silent). No grep when the index is live.

## Sandbox (M81)
- `templates/workflows/gsd-t-scan.workflow.js` stays runtime-native — the query-CLI call is delegated to an inline `agent()` Bash helper; no `require`/`fs`/`child_process`.

## AC-4 measurement protocol
- PIN the Atos commit SHA; assert run-0 SHA == run-1 SHA == run-2 SHA (all three runs on the same pin); fail LOUD on repo-not-found / commit-mismatch (`[RULE] ac4-atos-sha-pinned`).
- Run all three on the SAME pinned SHA, then measure each axis against its CORRECT baseline:
  - **Speed:** run-1 (cold build) + run-2 (warm) wall-clocks. PASS iff run-2 < 0.5 × run-1 (`[RULE] scan-run2-speed-ceiling`).
  - **Cost-critical-path:** count files read / readers spawned by the run-2 deep-finder agents vs **run-0 (no-graph baseline)**; PASS iff materially fewer (`[RULE] scan-run2-on-cost-critical-path`).
  - **Insight:** structural-findings count + accuracy of run-2 vs **run-0 (no-graph baseline)**; PASS iff run-2 ≥ run-0 findings PLUS ≥1 run-0 missed/got-wrong (`[RULE] scan-run2-insight-gate`).
- Record all four (run-0/run-1/run-2 wall-clocks, files-read-delta vs run-0, insight delta vs run-0) + the pinned SHA in `.gsd-t/spikes/ac4-scan-run2-speedup-results.md`, progress.md, and CHANGELOG.md, with a LIVE-CLOCK timestamp.

## Consumed (frozen)
- `graph-query-cli-contract.md` (D5) — the JSON envelope
