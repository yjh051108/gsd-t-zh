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
  - **Step 0 — availability precondition (pre-mortem r1 finding #3, alias-form mandated by r2 finding #1):** before any literal edit is verified live, prove the bare TIER ALIAS resolves in this environment: one minimal `Agent`/`agent()` call invoked with the verbatim string `model: "fable"` — the EXACT form D3 writes into the workflows, NOT the concrete id `claude-fable-5` — must complete without a model-not-found/4xx error. *Empirical baseline already banked AND alias-form-confirmed: 2026-06-09 ~15:02 PDT, the probe was invoked via the Agent tool with the bare alias `model: "fable"`; the runtime resolved it and agent `af7b79bba8a086058` completed, self-reporting `claude-fable-5` (`FABLE-PROBE-OK`, zero tools, 8s). The alias→id translation is therefore proven wired in the sandbox registry, not just the model id existing.* Re-probe at execute time with the same alias form (cheap, one call). The live-run clause below must additionally show the alias-form display `⚙ [fable]` (not `⚙ [claude-fable-5]`), proving the alias drives the stages. **Documented fallback if the alias-form probe fails:** HOLD the D3 workflow literal edits (do not merge fable assignments), record the availability blocker LOUDLY in `progress.md`, and complete the milestone with the policy module/contract mapping the stages while workflows keep their current tiers — a documented degradation, never a silent one. (Writing the concrete id into workflows instead is NOT the fallback — it breaks the file's alias convention and the lint's membership set.) *(Falsifier: D3 merges fable literals on the strength of a concrete-id probe while the alias is unwired — green probe masking a dead headline. Test: the alias-form probe call's non-error completion, cited in the run evidence.)*
  - **Per-stage FORCING recipes — every conditional stage must POSITIVELY fire (pre-mortem r4 finding #3; a stage that did not fire is a FAIL of this AC, not an N/A — absence of a `⚙ [fable]` line is ambiguous between "ran on wrong tier" and "never ran"):** (1 — RECONCILED post-evidence: a FORCED competition bypasses the probe [workflow lines 286-302], and the two probes are mutually exclusive per run) (1a) run a NON-partition eligible phase with competition UNSET so the AUTO solution-space probe fires on fable — CAPTURED: Run B `wf_5d8bc13a-293`; (1b) in the same AUTO run that competes, assert judge `⚙ [fable]` AND producers `⚙ [opus]` — CAPTURED: same run (2× fable probe+judge, 4× opus producers+finalize from usage frames); (1c) partition-probe fires ONLY in a partition-phase AUTO run — DOCUMENTED EVIDENCE GAP, lint-covered on the identical resolve path, to be captured at the next natural partition run (M86) and recorded in its Decision Log; (2) run a plan phase to fire pre-mortem `⚙ [fable]`; (3) run a verify to fire Red Team `⚙ [fable]`; (4) run debug against an INDUCED cycle-1 failure (a fixture symptom whose cycle-1 fix cannot resolve) so cycle-2 is reached — assert cycle-1 showed `⚙ [opus]` and cycle-2 `⚙ [fable]`. All five Fable lines captured positively across these runs. *(Falsifier: any designated stage still emits `opus`/`sonnet` live, OR a conditional stage silently never fires and is waved through. Test: real-sandbox runs with the forcing setup above, captured `/workflows` model lines.)*
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
