# Tasks: d6-scan-wiring

## Summary
When all tasks complete: `/scan` builds the index on run-1 and reads-once-queries-after via the D5 query CLI on run-2 (warm), falls back to grep mode ANNOUNCED on graph-unavailable, and reports both run wall-clocks (AC-4) in progress.md + CHANGELOG. WAVE-3 CONSUMER WIRING — after the Wave-2 build trio integrates; the falsifiable payoff. EXTEND-CLASS edits to two EXISTING files (`commands/gsd-t-scan.md`, `templates/workflows/gsd-t-scan.workflow.js`) — read first, adapt to structure, NEVER replace working scan functionality (Destructive Action Guard). The workflow stays M81 runtime-native (no require/fs; delegate CLI calls to an inline `agent()` Bash helper). D6 edits NO graph bin file — it CONSUMES the D5 query-cli contract.

## Wave 3

### M94-D6-T1 — Scan-consumer contract
- **Status**: [ ] pending
- **Files**: `.gsd-t/contracts/graph-scan-consumer-contract.md`
- **Touches**: `.gsd-t/contracts/graph-scan-consumer-contract.md`
- **ImplPath**: `.gsd-t/contracts/graph-scan-consumer-contract.md` — declares the run-1-build / run-2-query-after wiring, the announced grep-mode fallback rule, and the AC-4 dual-wall-clock measurement protocol
- **Test**: `test/m94-d6-scan-consumer.test.js` (shared with T3) — the wiring behaviors this contract declares (query-when-warm, announced-fallback) are exercised by the scan-consumer test
- **Contract refs**: graph-query-cli-contract (D5), graph-scan-consumer-contract (authored here)
- **Dependencies**: M94-D5-T1 (the query-cli envelope contract)
- **Acceptance criteria**:
  - Declares how /scan invokes the query CLI (run-1 build-if-absent, run-2 query-after), the announced grep-mode fallback rule on `graph-unavailable`, and the AC-4 dual-wall-clock measurement protocol

### M94-D6-T2 — Wire scan command + workflow (extend-class)
- **Status**: [ ] pending
- **Files**: `commands/gsd-t-scan.md`, `templates/workflows/gsd-t-scan.workflow.js`
- **Touches**: `commands/gsd-t-scan.md`, `templates/workflows/gsd-t-scan.workflow.js`
- **ImplPath**: `templates/workflows/gsd-t-scan.workflow.js` — run-1 build-if-absent / run-2 read-once-query-after via the D5 query CLI; `commands/gsd-t-scan.md` — the command-file behavior note + announced fallback
- **Test**: `test/m94-d6-scan-consumer.test.js` — asserts scan queries the index when warm (run-2 reads the index, NOT the whole repo) and falls back to ANNOUNCED grep mode on `graph-unavailable`
- **Contract refs**: graph-scan-consumer-contract (T1), graph-query-cli-contract (D5)
- **Dependencies**: M94-D6-T1; BLOCKED by the Wave-2 build trio (d3+d4+d5) integrating
- **Acceptance criteria**:
  - run-1 builds the index if `store.exists()` is false; run-2 reads-once-queries-after via the query CLI — `[RULE] scan-run2-reads-index-not-source`
  - Workflow stays runtime-native (M81 — delegates the query-CLI call to an inline `agent()` Bash helper; NO require/fs/child_process/process)
  - Falls back to grep mode ANNOUNCED only on `graph-unavailable` (extends, does NOT replace, existing scan functionality)
  - Pre-Commit Gate: scan-interface change → update `GSD-T-README.md` + `README.md` + `templates/CLAUDE-global.md` + `commands/gsd-t-help.md` if the interface changes (handled at execute/integrate)

### M94-D6-T3 — AC-4 measurement + report (headline win)
- **Status**: [ ] pending
- **Headline**: true
- **Files**: `.gsd-t/spikes/ac4-scan-run2-speedup-results.md`, `test/m94-d6-scan-consumer.test.js`
- **Touches**: `.gsd-t/spikes/ac4-scan-run2-speedup-results.md`, `test/m94-d6-scan-consumer.test.js`
- **ImplPath**: `templates/workflows/gsd-t-scan.workflow.js` (T2) — this task MEASURES the wired run-1/run-2 on the real Atos repo; `.gsd-t/spikes/ac4-scan-run2-speedup-results.md` records both
- **Test**: `test/m94-d6-scan-consumer.test.js` — scan queries the index when warm; falls back to announced grep mode on `graph-unavailable`. (The real-repo wall-clocks are a runtime measurement recorded in the result doc, not a unit assertion.)
- **Contract refs**: graph-scan-consumer-contract (T1)
- **Dependencies**: M94-D6-T2
- **Acceptance criteria**:
  - (AC-4 — the milestone's headline payoff)
  - Measures both run wall-clocks (run-1 build, run-2 warm) on the REAL Atos repo; records both with a LIVE-CLOCK timestamp
  - progress.md + CHANGELOG.md updated with both wall-clocks (run-2 dramatically under run-1 / today's ~2hr)
  - Test: scan queries the index when warm; falls back to announced grep mode on `graph-unavailable`

## Execution Estimate
- Total tasks: 3
- Independent tasks (no cross-domain blockers): 0 (gated on Wave-2 integration)
- Blocked tasks (waiting on other domains): T1 (on d5's query-cli contract); T2 (on the full Wave-2 trio integrating)
- Intra-domain serial chain: T1 → T2 → T3
- Estimated checkpoints: 1 (Wave-3 — the falsifiable payoff, AC-4)
