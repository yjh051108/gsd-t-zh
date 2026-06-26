# Tasks: d6-scan-wiring

## Summary
When all tasks complete: `/scan` builds the index on run-1, and on the graph-wired run INJECTS the graph's pre-computed structural slice (dependents / dead-code / cycles / coupling) into the `scanSlice` deep-finder agent context via the D5 query CLI — so those agents reason over PRE-COMPUTED structure instead of LLM-reconstructing relationships by reading (the SMART-REACH proof, per the Central Tenet). **AC-4 RESCOPED (user, 2026-06-25): INSIGHT DELTA ONLY — the CURRENT `/scan` architecture is kept FULLY INTACT (it works, it's praised — do NOT disrupt); the graph is wired ADDITIVELY.** AC-4 is proven on ONE axis — INSIGHT — by comparing TWO runs on the SAME pinned Atos SHA: a NO-GRAPH baseline run (graph wiring disabled, today's scan) vs a GRAPH-WIRED run. PASS iff the graph-wired run surfaces ≥ the no-graph run's structural findings PLUS ≥1 the no-graph run MISSED or got WRONG (a real dead-code / cycle / dependent the raw-read reconstruction failed to catch). **The SPEED / file-count / cost-critical-path axis is DROPPED from M94** — it cannot bind without redesigning scan's enumerate-EVERY-file logic-bug mandate (a relationship graph holds no logic, so it cannot displace the per-file read). That redesign is a SEPARATE future milestone ("re-think `/scan` from the graph up"), recorded out-of-scope. AC-4 no longer measures wall-clock at all. Falls back to grep mode ANNOUNCED on graph-unavailable. WAVE-3 CONSUMER WIRING — after the Wave-2 build trio integrates; the falsifiable payoff. EXTEND-CLASS edits to two EXISTING files (`commands/gsd-t-scan.md`, `templates/workflows/gsd-t-scan.workflow.js`) — read first, adapt to structure, NEVER replace working scan functionality (Destructive Action Guard). The workflow stays M81 runtime-native (no require/fs; delegate CLI calls to an inline `agent()` Bash helper). D6 edits NO graph bin file — it CONSUMES the D5 query-cli contract.

## Wave 3

### M94-D6-T1 — Scan-consumer contract (insight-only)
- **Status**: [ ] pending
- **Files**: `.gsd-t/contracts/graph-scan-consumer-contract.md`
- **Touches**: `.gsd-t/contracts/graph-scan-consumer-contract.md`
- **ImplPath**: `.gsd-t/contracts/graph-scan-consumer-contract.md` — declares the additive structural-slice injection wiring (scan kept intact), the announced grep-mode fallback rule, the INSIGHT-DELTA AC-4 gate (no-graph baseline vs graph-wired run), and the Atos-SHA-pin measurement protocol
- **Test**: `test/m94-d6-scan-consumer.test.js` (shared with T2/T3) — the wiring behaviors this contract declares (query-when-warm, structural-slice-injected, announced-fallback) are exercised by the scan-consumer test
- **Contract refs**: graph-query-cli-contract (D5), graph-scan-consumer-contract (authored here)
- **Dependencies**: M94-D5-T1 (the query-cli envelope contract)
- **Acceptance criteria**:
  - Names the SPECIFIC scan findings the graph feeds: the structural / dependency / dead-code / cycle findings that today come from deep-finder agents reconstructing relationships by reading, now PRE-COMPUTED by the graph + INJECTED into the `scanSlice` agent context so those findings are ACCURATE, not LLM-reconstructed. The current `/scan` architecture is KEPT INTACT; the graph is ADDITIVE
  - Declares the TWO distinct runs (NO-GRAPH baseline — graph wiring disabled, today's scan — vs GRAPH-WIRED run), both on the SAME pinned Atos SHA. The insight comparison is graph-wired-vs-no-graph; comparing graph-vs-graph would show ~zero delta
  - Declares the INSIGHT gate `[RULE] scan-insight-gate` (graph-wired run surfaces ≥ no-graph findings PLUS ≥1 the no-graph run missed/got wrong) as the SOLE AC-4 binding. The SPEED / file-count / cost-critical-path axis is EXPLICITLY OUT OF SCOPE (deferred to the separate scan-redesign milestone) — no wall-clock or files-read threshold is declared
  - Declares the Atos commit-SHA pin protocol `[RULE] ac4-atos-sha-pinned` (no-graph SHA == graph-wired SHA; fail-loud on repo-not-found / commit-mismatch)

### M94-D6-T2 — Wire scan command + workflow (extend-class, additive)
- **Status**: [ ] pending
- **Files**: `commands/gsd-t-scan.md`, `templates/workflows/gsd-t-scan.workflow.js`
- **Touches**: `commands/gsd-t-scan.md`, `templates/workflows/gsd-t-scan.workflow.js`
- **ImplPath**: `templates/workflows/gsd-t-scan.workflow.js` — build-if-absent then query the D5 CLI for the structural slice (dependents/dead-code/cycles/coupling) and INJECT it ADDITIVELY into the `scanSlice` deep-finder agent context so those findings are accurate (pre-computed, not reconstructed); `commands/gsd-t-scan.md` — the command-file behavior note + announced fallback. EXTEND-class: existing scan functionality is preserved untouched
- **Test**: `test/m94-d6-scan-consumer.test.js` — asserts scan queries the index when warm AND that the pre-computed structural slice is injected into the `scanSlice` agent context (deep-finders consume the graph's findings ADDITIVELY) and falls back to ANNOUNCED grep mode on `graph-unavailable`; asserts the existing scan deep-finder pipeline is NOT removed or replaced (additive-only). **[Finding B — slice must be CONSUMED, not just passed]** asserts the graph-wired run's output contains ≥1 structural finding byte-traceable to the injected D5 query result (the same dead-code symbol / cycle / dependent the CLI returned) — proving the slice reached a finding, not merely sat in context (the dead-injection trap). **[Finding C — failure path]** a fault-injection case forces the D5 CLI to return `{ok:false, reason:"graph-unavailable"}` and asserts scan announces the fallback AND still completes via the intact grep-mode pipeline
- **Contract refs**: graph-scan-consumer-contract (T1), graph-query-cli-contract (D5)
- **Dependencies**: M94-D6-T1; BLOCKED by the Wave-2 build trio (d3+d4+d5) integrating
- **Acceptance criteria**:
  - Builds the index if `store.exists()` is false; queries the index for the structural slice and INJECTS it ADDITIVELY into the `scanSlice` deep-finder context — `[RULE] scan-injects-structural-slice`. The current scan architecture (enumerate + per-file deep-finders) is KEPT INTACT
  - The injected slice makes the structural findings (dependents/dead-code/cycles/coupling) ACCURATE and graph-derived rather than LLM-reconstructed — the SMART-REACH insight mechanism, wired additively (NOT replacing the per-file read scan needs for in-file logic defects)
  - Workflow stays runtime-native (M81 — delegates the query-CLI call to an inline `agent()` Bash helper; NO require/fs/child_process/process)
  - Falls back to grep mode ANNOUNCED only on `graph-unavailable` (extends, does NOT replace, existing scan functionality)
  - Pre-Commit Gate: scan-interface change → update `GSD-T-README.md` + `README.md` + `templates/CLAUDE-global.md` + `commands/gsd-t-help.md` if the interface changes (handled at execute/integrate)

### M94-D6-T3 — AC-4 INSIGHT-delta measurement + report (headline win)
- **Status**: [ ] pending
- **Headline**: true
- **Files**: `.gsd-t/spikes/ac4-scan-insight-delta-results.md`, `test/m94-d6-scan-consumer.test.js`
- **ImplPath**: `templates/workflows/gsd-t-scan.workflow.js` (T2) — this task RUNS the two runs (NO-GRAPH baseline / GRAPH-WIRED) on the real Atos repo against the pinned SHA; `.gsd-t/spikes/ac4-scan-insight-delta-results.md` records the structural-findings set from each run, the named ≥1 finding the no-graph run missed/got wrong, + the pinned SHA
- **Test**: `test/m94-d6-scan-consumer.test.js` — **[INSIGHT gate]** the result-doc check: parses the recorded structural-findings sets from the no-graph and graph-wired runs and FAILS unless the graph-wired set ⊇ the no-graph set AND names ≥1 concrete structural finding (a real dead-code / cycle / dependent) the no-graph run MISSED or got WRONG (`[RULE] scan-insight-gate`); **[Finding A — graph-attributed, not LLM-variance]** the ≥1 missed/wrong finding MUST be traceable to the graph's deterministic query result (present in the injected structural slice) — the result doc records the D5 query output that produced it, and the test FAILS if the claimed delta finding is not backed by a graph query result (so a delta that is mere LLM run-to-run variance, with no graph contribution, does NOT pass); **[SHA pin]** asserts no-graph SHA == graph-wired SHA and that a repo-not-found / commit-mismatch fails LOUD (`[RULE] ac4-atos-sha-pinned`) — a finding-set recorded against an unpinned/absent repo is rejected. (The real-repo runs are recorded in the result doc; the INSIGHT/PIN logic is unit-asserted on the recorded envelope.)
- **Contract refs**: graph-scan-consumer-contract (T1)
- **Dependencies**: M94-D6-T2
- **Acceptance criteria**:
  - (AC-4 — the milestone's headline payoff: INSIGHT delta only, scan kept intact, neither asserted)
  - Runs TWO runs (NO-GRAPH baseline / GRAPH-WIRED) on the real Atos repo; PINS the Atos commit SHA; asserts no-graph SHA == graph-wired SHA; fails LOUD on repo-not-found / commit-mismatch — `[RULE] ac4-atos-sha-pinned`
  - Records both structural-findings sets + the named ≥1 missed/wrong finding + the pinned SHA with a LIVE-CLOCK timestamp
  - **[INSIGHT gate]** Result-doc check FAILS unless the graph-wired run surfaces ≥ the no-graph run's structural findings PLUS ≥1 the no-graph run missed/got wrong — `[RULE] scan-insight-gate`. The ≥1 missed/wrong finding MUST be a concrete, named structural fact (a real dead-code symbol / cycle / dependent), not a generic claim
  - **[Finding A — graph-attributed]** the ≥1 missed/wrong finding MUST be backed by the graph's deterministic query result (recorded in the result doc); a delta that is mere LLM run-to-run variance with no graph contribution does NOT satisfy the gate — `[RULE] scan-insight-delta-graph-attributed`
  - NO speed / wall-clock / files-read assertion exists in this task (the speed axis is OUT of M94, deferred to the separate scan-redesign milestone)
  - progress.md + CHANGELOG.md updated with both structural-findings sets + the named missed/wrong finding + the pinned SHA

## Execution Estimate
- Total tasks: 3
- Independent tasks (no cross-domain blockers): 0 (gated on Wave-2 integration)
- Blocked tasks (waiting on other domains): T1 (on d5's query-cli contract); T2 (on the full Wave-2 trio integrating)
- Intra-domain serial chain: T1 → T2 → T3
- Estimated checkpoints: 1 (Wave-3 — the falsifiable payoff, AC-4 INSIGHT delta)
