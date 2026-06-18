# Tasks: m89-d3-wiring-upper-phase-and-gate

> **Wave 2 — GATED on D1's A1 (M89-D1-T3) GREEN.** Concurrent with D4 (disjoint workflow files).
> EXCLUSIVE owner of `gsd-t-phase.workflow.js` + `gsd-t-verify.workflow.js` — D4 never touches these.
> Contract: `.gsd-t/contracts/auto-research-contract.md` §1/§2/§3/§4/§5.
> **MODEL FORM:** the research `agent()` stage uses a BARE literal `model: "fable"` (NOT `overrides["research"] ?? …`
> — that `??`-form FAILS the M85 lint; `research` is not an injectable designated stage; see D2-T1 correction).

## Files Owned
- `templates/workflows/gsd-t-phase.workflow.js`
- `templates/workflows/gsd-t-verify.workflow.js`
- `test/m89-phase-research-wiring.test.js`

## Tasks

### M89-D3-T1 — Wire the classify→research trigger into gsd-t-phase.workflow.js
**Files**: `templates/workflows/gsd-t-phase.workflow.js`
**Dependencies**: D1 A1 GREEN (gate); CONSUMES `bin/gsd-t-research-gate.cjs` (D1), `templates/prompts/research-subagent.md` (D2-T2), contract §1/§2/§3/§4
**Contract**: `auto-research-contract.md` §1 (envelope), §2 (stage interface), §3 (cite block), §4 (idempotency)
**Description**: At each research-eligible upper stage (plan, pre-mortem, partition, discuss, milestone, impact — all run through phase): call the classifier via the inline `runCli` helper (project-local `bin/gsd-t-research-gate.cjs` first, else global `gsd-t research-gate classify`). On `class:external`: run the research `agent()` stage — **`model: "fable"` (bare literal)**, prompt Read from `templates/prompts/research-subagent.md` — and write the cited `## Verified Facts (auto-research)` block into the phase artifact BEFORE the phase gate re-runs. **Idempotent (A2): scan the artifact for an existing cited entry covering the gap first; skip research if already cited.** On `class:internal`: route to grep/Read, NO web. **M71 runtime-native: NO `require`/`fs`/`path`/`child_process`/`process`; `args` is a JSON STRING; delegate the classifier call to an `agent()`'s Bash via `runCli`.**
**Acceptance**: each of the 6 eligible stages carries the classify→(external: research+cite / internal: grep) wiring; the research stage's `model:` is the bare `"fable"` literal; the cite block is written before the gate re-runs; re-running an already-cited phase performs ZERO additional research.
**Test**: `test/m89-phase-research-wiring.test.js` (T3) — functional assertions that the wiring is present at each stage and behaves (idempotency, write-before-gate). `test/m71-workflow-runtime-native-lint.test.js` + `test/m85-workflow-tier-policy-lint.test.js` stay GREEN (sandbox-clean + bare-`fable` literal in the valid tier set).

### M89-D3-T2 — Wire A4 no-silent-guess into gsd-t-verify.workflow.js
**Files**: `templates/workflows/gsd-t-verify.workflow.js`
**Dependencies**: D1 A1 GREEN; contract §5 (A4); shares the cite-block detect string with D2-T2/T3
**Contract**: `auto-research-contract.md` §5 (A4 — external gap skipped → verify FAILS)
**Description**: A phase artifact that recorded an external gap (classifier returned `class:external`) but contains NO matching `## Verified Facts (auto-research)` cited block FAILS the `gsd-t-verify` gate (no silent guess). Detect via the machine-detectable heading string + a source-cited fact for the gap. M71 runtime-native (delegate any classify/scan to `runCli` / an `agent()` Bash; no `fs`).
**Acceptance**: verify FAILs an artifact recording an external gap with no matching cited block; PASSES one with a matching cited block; an internal-only-gap artifact is unaffected.
**Test**: `test/m89-phase-research-wiring.test.js` (T3) asserts the A4 FAIL path with a constructed external-gap-skipped artifact and the PASS path with a cited artifact.

### M89-D3-T3 — Wiring tests
**Files**: `test/m89-phase-research-wiring.test.js` (NET-NEW — implementation path for A4 + phase idempotency)
**Dependencies**: M89-D3-T1, M89-D3-T2
**Contract**: `auto-research-contract.md` §4 (A2) + §5 (A4)
**Description**: Functional, not existence:
- Assert the phase workflow inserts the classify→research wiring at EACH of the 6 eligible stages (parse the workflow source for the wiring structure per stage — not a bare substring).
- Assert verify FAILs an external-gap-skipped artifact (A4) and PASSES a cited one.
- Assert idempotency: a second pass over an already-cited artifact triggers ZERO additional research (the skip predicate fires).
- Assert the research stage's `model:` literal is `"fable"` (bare form) so M85 stays green.
**Acceptance**: every assertion proves behavior/state, not mere presence; the A4 FAIL case and the idempotency skip case both fire.
**Test**: this file IS the test. Runner: `npm test`.

### M89-D3-T4 — Verify (RUN, don't node --check)
**Files**: verification only
**Dependencies**: M89-D3-T1..T3
**Description**: RUN `gsd-t-phase.workflow.js` + `gsd-t-verify.workflow.js` to COMPLETION in the real sandbox (per [[feedback_workflow_must_run_in_real_sandbox]] — `node --check` is insufficient: the sandbox bans require/fs and passes `args` as a STRING). Run `npm test` (zero new regressions). Confirm `test/m71-workflow-runtime-native-lint.test.js` + `test/m85-workflow-tier-policy-lint.test.js` GREEN.
**Acceptance**: both workflows run to completion in-sandbox; full suite green (no new failures); M71 + M85 lints green.
**Test**: real-sandbox workflow run + `npm test`.
