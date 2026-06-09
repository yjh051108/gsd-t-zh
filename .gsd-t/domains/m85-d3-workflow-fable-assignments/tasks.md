# Tasks: m85-d3-workflow-fable-assignments

## Summary
The five Fable stage assignments — edits to the `model:` literals across exactly the 3 affected workflow files, write-disjoint from all `bin/` and all `test`/docs. Owns the HARD INVARIANT that competition producers STAY `opus` while the judge MOVES to `fable` (M82 different-model blindness), decided inside `gsd-t-phase.workflow.js` so it lives in exactly one place. Verified by a REAL sandbox run (`⚙ [fable]` visible), not `node --check`.

## Tasks

### M85-D3-T1 — Fable the 4 gsd-t-phase stages; hold the producer-opus invariant
- **Touches**: `templates/workflows/gsd-t-phase.workflow.js` (lines ~172, ~198, ~432, ~476, ~656)
- **Files**: `templates/workflows/gsd-t-phase.workflow.js`
- **Test**: `test/m85-workflow-tier-policy-lint.test.js` (D4-owned, READS this file; asserts the 4 stages resolve to fable AND producers stay opus) + `test/m71-workflow-runtime-native-lint.test.js` (no `require`/`fs` reintroduced)
- **Contract refs**: `.gsd-t/contracts/model-tier-policy-contract.md` v1.0.0 § "Stage Policy", `.gsd-t/contracts/competition-mode-contract.md` v2.0.0 (blindness invariant)
- **Deps**: BLOCKED by M85-D1-T4 (contract STABLE) and M85-D4-T1 (lint exists to prove conformance)
- **Acceptance criteria**:
  - Solution-space probe (~172): `model: "opus"` → `model: "fable"`. *(Falsifier: still emits opus. Test: `test/m85-workflow-tier-policy-lint.test.js` asserts `solution-space-probe → fable`.)*
  - Partition probe (~198): `model: "opus"` → `model: "fable"`. *(Falsifier: still opus. Test: `test/m85-workflow-tier-policy-lint.test.js` asserts `partition-probe → fable`.)*
  - Competition judge (~476): `model: "sonnet"` → `model: "fable"`. *(Falsifier: still sonnet/opus. Test: `test/m85-workflow-tier-policy-lint.test.js` asserts `competition-judge → fable`.)*
  - Pre-mortem (~656): `model: "opus"` → `model: "fable"`. *(Falsifier: still opus. Test: `test/m85-workflow-tier-policy-lint.test.js` asserts `pre-mortem → fable`.)*
  - Competition PRODUCERS (~432): STAY `model: "opus"` — unchanged; the judge-≠-producer blindness invariant lives here. *(Falsifier: producers move to fable, collapsing blindness to judge==producer. Test: `test/m85-workflow-tier-policy-lint.test.js` asserts `competition-producers → opus` AND judge tier ≠ producer tier.)*
  - No `require`/`fs`/`path`/`child_process`/`process` reintroduced; `model:` is the only changed surface. *(Falsifier: sandbox-banned global appears. Test: `test/m71-workflow-runtime-native-lint.test.js`.)*

### M85-D3-T2 — Fable the Red Team stage in verify
- **Touches**: `templates/workflows/gsd-t-verify.workflow.js` (line ~307)
- **Files**: `templates/workflows/gsd-t-verify.workflow.js`
- **Test**: `test/m85-workflow-tier-policy-lint.test.js` (asserts `red-team → fable`) + `test/m71-workflow-runtime-native-lint.test.js`
- **Contract refs**: `.gsd-t/contracts/model-tier-policy-contract.md` v1.0.0, `.gsd-t/contracts/orthogonal-validation-contract.md` v1.0.0
- **Deps**: BLOCKED by M85-D1-T4, M85-D4-T1
- **Acceptance criteria**:
  - Red Team (~307): `model: "opus"` → `model: "fable"`. *(Falsifier: still opus. Test: `test/m85-workflow-tier-policy-lint.test.js` asserts `red-team → fable`.)*
  - Red Team stays NON-SKIPPABLE — only the tier changed; no skip flag added, no schema/stage removed (AC f). *(Falsifier: Red Team becomes skippable or its stage is gated behind a flag. Test: `test/m85-workflow-tier-policy-lint.test.js` / grep asserts the Red Team `agent()` stage is unconditional, no `skip` arg.)*

### M85-D3-T3 — Fable the debug cycle-2 escalation (per-cycle conditional)
- **Touches**: `templates/workflows/gsd-t-debug.workflow.js` (line ~97 — the SINGLE `model:` literal inside the `for (cycle 1..2)` loop)
- **Files**: `templates/workflows/gsd-t-debug.workflow.js`
- **Test**: `test/m85-workflow-tier-policy-lint.test.js` (asserts `debug-cycle-2 → fable` AND cycle-1 → opus) + `test/m71-workflow-runtime-native-lint.test.js`
- **Contract refs**: `.gsd-t/contracts/model-tier-policy-contract.md` v1.0.0, `.gsd-t/contracts/debug-loop-contract.md` v1.0.0
- **Deps**: BLOCKED by M85-D1-T4, M85-D4-T1
- **Acceptance criteria**:
  - **WIRING (pre-mortem finding #1):** the debug loop today has ONE shared `model: "opus"` literal serving BOTH cycles (a single `agent()` call inside `for (let cycle=1; cycle<=2; cycle++)`). The edit MUST be a per-cycle CONDITIONAL — `model: cycle === 1 ? "opus" : "fable"` (or equivalent) — NOT a flat literal swap. A flat swap would make cycle-1 fable too, violating "cycle-1 stays opus." *(Falsifier: cycle-1 runs on fable, or both cycles run the same tier. Test: `test/m85-workflow-tier-policy-lint.test.js` parses the conditional and asserts cycle-1→opus, cycle-2→fable — see the lint's cycle-conditional handling in D4-T1.)*
  - Cycle-2 escalation: → `fable`; cycle-1 stays `opus`; after cycle-2 fails → needs-human (loop bound unchanged). *(Falsifier: cycle-2 stays opus, the loop bound changes, or needs-human path is altered. Test: `test/m85-workflow-tier-policy-lint.test.js` + `node --check`.)*
  - No `require`/`fs`/`process` reintroduced. *(Test: `test/m71-workflow-runtime-native-lint.test.js`.)*

### M85-D3-T4 — Real-sandbox verification of all 5 Fable stages (AC c/d)
- **Touches**: (no source file — a verification run; evidence captured in the verify phase / progress.md by D4)
- **Files**: `templates/workflows/gsd-t-phase.workflow.js`, `templates/workflows/gsd-t-verify.workflow.js`, `templates/workflows/gsd-t-debug.workflow.js` (the artifacts under test)
- **Test**: real-sandbox Workflow run — observe `⚙ [fable]` in `/workflows` output for all 5 stages (per `feedback_workflow_must_run_in_real_sandbox`; `node --check` is INSUFFICIENT)
- **Contract refs**: `.gsd-t/contracts/model-tier-policy-contract.md` v1.0.0 (AC c/d)
- **Deps**: Requires T1, T2, T3 (within domain)
- **Acceptance criteria**:
  - **Step 0 — availability precondition (pre-mortem finding #3):** before any literal edit is verified live, prove `claude-fable-5` is callable in THIS environment: one minimal `Agent`/`agent()` call with `model: "fable"` must complete without a model-not-found/4xx error. *Empirical baseline already banked: 2026-06-09 ~15:02 PDT, agent `af7b79bba8a086058` completed on `claude-fable-5` replying `FABLE-PROBE-OK` (zero tools, 8s).* Re-probe at execute time (cheap, one call). **Documented fallback if the probe fails:** HOLD the D3 workflow literal edits (do not merge fable assignments), record the availability blocker LOUDLY in `progress.md`, and complete the milestone with the policy module/contract mapping the stages while workflows keep their current tiers — a documented degradation, never a silent one. *(Falsifier: D3 merges fable literals without a passing probe, then every designated stage errors live. Test: the probe call's non-error completion, cited in the run evidence.)*
  - A real Workflow run emits `⚙ [fable] {label}` for all five designated stages (solution-space probe, partition probe, competition judge, pre-mortem, Red Team, debug cycle-2 — five distinct Fable assignments across the runs). *(Falsifier: any designated stage still emits `opus`/`sonnet` in the live sandbox. Test: real-sandbox run, captured `/workflows` model lines.)*
  - The competition path shows judge on `fable` while producers show `opus` in the SAME run (blindness preserved live, not just by lint). *(Falsifier: judge==producer tier in the live run. Test: real-sandbox competition run, model lines compared.)*
  - **No Fable stage 400s in the live run (this IS AC d's runtime evidence — pre-mortem finding #1):** the run completes through every Fable stage without an HTTP 400, proving the Anthropic sandbox runtime handles Fable's thinking-omission correctly. GSD-T-side, the predicate's live surface is D1's resolver envelope (CLI `--json` emits `requiresThinkingOmitted`, test-asserted reachable); no GSD-T code sets thinking params (D2 grep-asserts this stays true). There is NO workflow-side or spawn-side consultation claim — the prior plan's binding to `gsd-t-parallel.cjs`'s spawn block was factually wrong (that site is the cache-warm probe; the worker spawner is M61-retired/absent, TD-114). *(Falsifier: a Fable workflow stage 400s in the live run. Test: real-sandbox run completes through all 5 Fable stages, captured non-400 completions.)*

## Execution Estimate
- Total tasks: 4
- Independent tasks (once D1+D4-lint land): 3 (T1, T2, T3 — different files, file-disjoint)
- Blocked tasks (within-domain): 1 (T4 needs T1+T2+T3)
- Estimated checkpoints: 1 (after T4 — real-sandbox proof is the AC-c/d gate)

## REQ Coverage
- AC (c) 5 Fable stages run on Fable in real sandbox → T1, T2, T3, T4
- AC (d) Fable breaking-change handled (thinking-disabled omitted) → T4
- AC (f) Red Team non-skippable on new tier → T2
- M82 blindness invariant (judge ≠ producer) → T1, T4
