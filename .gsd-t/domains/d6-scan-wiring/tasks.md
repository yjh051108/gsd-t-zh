# Tasks: d6-scan-wiring

## Summary
When all tasks complete: `/scan` builds the index on run-1, and on run-2 (warm) INJECTS the graph's pre-computed structural slice (dependents / dead-code / cycles / coupling) into the `scanSlice` deep-finder agent context via the D5 query CLI — so those agents read materially fewer files and reason less (the SMART-REACH proof, per the Central Tenet). AC-4 is proven on BOTH axes against PRE-REGISTERED numeric thresholds across THREE runs (run-0 NO-GRAPH baseline / run-1 cold-build graph-wired / run-2 warm), all on the SAME pinned Atos SHA: SPEED (run-2 < 0.5× run-1) AND COST-CRITICAL-PATH (run-2 reads fewer files / spawns fewer-or-cheaper readers than run-0) AND INSIGHT (run-2 ≥ run-0 findings + ≥1 run-0 missed). The insight + cost-critical-path baseline is run-0 (no-graph), NOT run-1 (graph-wired-cold) — comparing graph-vs-graph would show ~zero delta. Falls back to grep mode ANNOUNCED on graph-unavailable. WAVE-3 CONSUMER WIRING — after the Wave-2 build trio integrates; the falsifiable payoff. EXTEND-CLASS edits to two EXISTING files (`commands/gsd-t-scan.md`, `templates/workflows/gsd-t-scan.workflow.js`) — read first, adapt to structure, NEVER replace working scan functionality (Destructive Action Guard). The workflow stays M81 runtime-native (no require/fs; delegate CLI calls to an inline `agent()` Bash helper). D6 edits NO graph bin file — it CONSUMES the D5 query-cli contract.

## Wave 3

### M94-D6-T1 — Scan-consumer contract
- **Status**: [ ] pending
- **Files**: `.gsd-t/contracts/graph-scan-consumer-contract.md`
- **Touches**: `.gsd-t/contracts/graph-scan-consumer-contract.md`
- **ImplPath**: `.gsd-t/contracts/graph-scan-consumer-contract.md` — declares the run-1-build / run-2-inject-structural-slice wiring, the announced grep-mode fallback rule, the pre-registered AC-4 numeric thresholds (speed ceiling + cost-critical-path + insight gate), and the Atos-SHA-pin measurement protocol
- **Test**: `test/m94-d6-scan-consumer.test.js` (shared with T2/T3/T4) — the wiring behaviors this contract declares (query-when-warm, structural-slice-injected, announced-fallback) are exercised by the scan-consumer test
- **Contract refs**: graph-query-cli-contract (D5), graph-scan-consumer-contract (authored here)
- **Dependencies**: M94-D5-T1 (the query-cli envelope contract)
- **Acceptance criteria**:
  - Names the SPECIFIC scan sub-steps the graph feeds: the structural / dependency / dead-code / cycle findings that today come from deep-finder agents reconstructing relationships by reading, now PRE-COMPUTED by the graph + INJECTED into the `scanSlice` agent context
  - Declares the THREE distinct runs (run-0 NO-GRAPH baseline / run-1 cold-build graph-wired / run-2 warm) — the speed baseline (run-1) and the insight + cost-critical-path baseline (run-0) are DIFFERENT runs; comparing run-2 vs run-1 for insight would show ~zero delta (both graph-wired)
  - Declares the PRE-REGISTERED numeric thresholds: SPEED `[RULE] scan-run2-speed-ceiling` (run-2 < 0.5× run-1), COST-CRITICAL-PATH `[RULE] scan-run2-on-cost-critical-path` (run-2 reads fewer files / spawns fewer-or-cheaper readers than **run-0**), INSIGHT `[RULE] scan-run2-insight-gate` (run-2 ≥ **run-0** findings + ≥1 run-0 missed)
  - Declares the Atos commit-SHA pin protocol `[RULE] ac4-atos-sha-pinned` (run-0 SHA == run-1 SHA == run-2 SHA; fail-loud on repo-not-found / commit-mismatch)

### M94-D6-T2 — Wire scan command + workflow (extend-class)
- **Status**: [ ] pending
- **Files**: `commands/gsd-t-scan.md`, `templates/workflows/gsd-t-scan.workflow.js`
- **Touches**: `commands/gsd-t-scan.md`, `templates/workflows/gsd-t-scan.workflow.js`
- **ImplPath**: `templates/workflows/gsd-t-scan.workflow.js` — run-1 build-if-absent / run-2 query the D5 CLI for the structural slice (dependents/dead-code/cycles/coupling) and INJECT it into the `scanSlice` deep-finder agent context so those agents read fewer files; `commands/gsd-t-scan.md` — the command-file behavior note + announced fallback
- **Test**: `test/m94-d6-scan-consumer.test.js` — asserts scan queries the index when warm AND that the pre-computed structural slice is injected into the `scanSlice` agent context (run-2 deep-finders consume the graph's findings, NOT re-read the whole repo) and falls back to ANNOUNCED grep mode on `graph-unavailable`
- **Contract refs**: graph-scan-consumer-contract (T1), graph-query-cli-contract (D5)
- **Dependencies**: M94-D6-T1; BLOCKED by the Wave-2 build trio (d3+d4+d5) integrating
- **Acceptance criteria**:
  - run-1 builds the index if `store.exists()` is false; run-2 queries the index for the structural slice and INJECTS it into the `scanSlice` deep-finder context — `[RULE] scan-run2-reads-index-not-source`
  - The injected slice is on the deep-finders' cost-critical path: it supplies dependents/dead-code/cycles/coupling so the agents do NOT reconstruct them by reading (the SMART-REACH mechanism, not a side-channel)
  - Workflow stays runtime-native (M81 — delegates the query-CLI call to an inline `agent()` Bash helper; NO require/fs/child_process/process)
  - Falls back to grep mode ANNOUNCED only on `graph-unavailable` (extends, does NOT replace, existing scan functionality)
  - Pre-Commit Gate: scan-interface change → update `GSD-T-README.md` + `README.md` + `templates/CLAUDE-global.md` + `commands/gsd-t-help.md` if the interface changes (handled at execute/integrate)

### M94-D6-T3 — AC-4 measurement + report (headline win)
- **Status**: [ ] pending
- **Headline**: true
- **Files**: `.gsd-t/spikes/ac4-scan-run2-speedup-results.md`, `test/m94-d6-scan-consumer.test.js`
- **Touches**: `.gsd-t/spikes/ac4-scan-run2-speedup-results.md`, `test/m94-d6-scan-consumer.test.js`
- **ImplPath**: `templates/workflows/gsd-t-scan.workflow.js` (T2) — this task MEASURES all THREE runs (run-0 no-graph baseline / run-1 cold-build / run-2 warm) on the real Atos repo against the pinned SHA; `.gsd-t/spikes/ac4-scan-run2-speedup-results.md` records the three wall-clocks + files-read delta vs run-0 + insight delta vs run-0 + the pinned SHA
- **Test**: `test/m94-d6-scan-consumer.test.js` — **[#2 threshold]** the result-doc check: parses the recorded run-1/run-2 wall-clocks and FAILS if run-2 ≥ 0.5× run-1 (`[RULE] scan-run2-speed-ceiling` — the pre-registered ceiling, not "dramatically"); **[#7 SHA pin]** asserts run-0 SHA == run-1 SHA == run-2 SHA and that a repo-not-found / commit-mismatch fails LOUD (`[RULE] ac4-atos-sha-pinned`) — a number against an unpinned/absent repo is rejected; INSIGHT gate asserted against **run-0** (run-2 findings ≥ run-0 + ≥1 run-0 missed, `[RULE] scan-run2-insight-gate` — NOT vs run-1). (The real-repo wall-clocks are recorded in the result doc; the THRESHOLD/PIN/INSIGHT logic is unit-asserted on the recorded envelope.)
- **Contract refs**: graph-scan-consumer-contract (T1)
- **Dependencies**: M94-D6-T2
- **Acceptance criteria**:
  - (AC-4 — the milestone's headline payoff, BOTH axes, neither asserted)
  - Runs all THREE runs (run-0 no-graph baseline / run-1 cold-build / run-2 warm); PINS the Atos commit SHA; asserts run-0 == run-1 == run-2 SHA; fails LOUD on repo-not-found / commit-mismatch — `[RULE] ac4-atos-sha-pinned` (#7)
  - Records all three wall-clocks + the pinned SHA with a LIVE-CLOCK timestamp
  - **[#2 threshold]** Result-doc check FAILS if run-2 wall-clock ≥ 0.5× run-1 (the PRE-REGISTERED ceiling in `graph-scan-consumer-contract.md`) — `[RULE] scan-run2-speed-ceiling`. NOT "dramatically" — a defensible number.
  - INSIGHT: run-2 surfaces ≥ **run-0 (the no-graph baseline)**'s structural findings PLUS ≥1 run-0 missed/got wrong — `[RULE] scan-run2-insight-gate`. Measured vs run-0 (no-graph), NOT vs run-1 (graph-wired-cold). A speed win that LOSES findings vs run-0 FAILS AC-4.
  - progress.md + CHANGELOG.md updated with the three wall-clocks + the pinned SHA + the files-read delta (vs run-0) + the insight delta (vs run-0)

### M94-D6-T4 — AC-4 cost-critical-path proof (#1 CRITICAL — index displaces real reading, not merely invoked)
- **Status**: [ ] pending
- **Files**: `test/m94-d6-cost-critical-path.test.js`
- **Touches**: `test/m94-d6-cost-critical-path.test.js`
- **ImplPath**: `templates/workflows/gsd-t-scan.workflow.js` (T2) — this test instruments the wired run-1/run-2 and proves the structural-slice injection is on the deep-finders' cost-critical path
- **Test**: `test/m94-d6-cost-critical-path.test.js` — identifies the specific graph-replaced scan sub-step (the structural/dependency/dead-code slice) and asserts run-2 deep-finder agents **read materially fewer files** AND/OR **spawn fewer-or-cheaper readers** than **run-0 (the no-graph baseline)** — proving the index is ON the cost-critical path, not merely invoked beside the same reading work. Compared vs run-0 (no-graph), NOT run-1 (graph-wired-cold, which understates the delta). A wall-clock delta ALONE does not satisfy this test; the files-read / readers-spawned count MUST drop vs run-0.
- **Contract refs**: graph-scan-consumer-contract (T1 — `[RULE] scan-run2-on-cost-critical-path`)
- **Dependencies**: M94-D6-T2
- **Acceptance criteria**:
  - (#1 — the CRITICAL AC-4 binding: index on the cost-critical path)
  - Names the specific graph-replaced scan sub-step (the structural slice the deep-finders no longer reconstruct by reading)
  - Asserts run-2 deep-finders read materially fewer files than **run-0 (no-graph baseline)**, AND/OR spawn fewer-or-cheaper readers — `[RULE] scan-run2-on-cost-critical-path`
  - The test FAILS if run-2 reads the same files as run-0 (a wall-clock delta with unchanged reading proves the index is NOT on the cost-critical path — the prior pre-mortem's exact objection, now structurally guarded)

## Execution Estimate
- Total tasks: 4
- Independent tasks (no cross-domain blockers): 0 (gated on Wave-2 integration)
- Blocked tasks (waiting on other domains): T1 (on d5's query-cli contract); T2 (on the full Wave-2 trio integrating)
- Intra-domain serial chain: T1 → T2 → T3, T2 → T4
- Estimated checkpoints: 1 (Wave-3 — the falsifiable payoff, AC-4 on both axes)
