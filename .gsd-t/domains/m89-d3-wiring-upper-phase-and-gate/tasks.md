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
- `test/m89-e2e-research-cite.test.js` — the end-to-end dogfood test (finding #4): classify → research-stage (STUBBED WebFetch) → cite-write → A4 gate PASS

## Tasks

### M89-D3-T1 — Wire the classify→research trigger into gsd-t-phase.workflow.js
**Files**: `templates/workflows/gsd-t-phase.workflow.js`
**Dependencies**: D1 A1 GREEN (gate); CONSUMES `bin/gsd-t-research-gate.cjs` (D1), `templates/prompts/research-subagent.md` (D2-T2), contract §1/§2/§3/§4
**Contract**: `auto-research-contract.md` §1 (envelope), §2 (stage interface), §3 (cite block), §4 (idempotency)
**Description**: At each research-eligible upper stage (plan, pre-mortem, partition, discuss, milestone, impact — all run through phase): call the classifier via the inline `runCli` helper (project-local `bin/gsd-t-research-gate.cjs` first, else global `gsd-t research-gate classify`). On `class:external`: run the research `agent()` stage — **`model: "fable"` (bare literal)**, prompt Read from `templates/prompts/research-subagent.md` — and write the cited `## Verified Facts (auto-research)` block into the phase artifact BEFORE the phase gate re-runs. **Idempotent (A2 — contract §4.1): scan the artifact for an existing cited entry whose recorded gap-key EXACTLY matches the new gap's normalized gap-key; skip research only on an exact key hit (NOT substring/keyword/fuzzy — a cited PayPal-OAuth fact must NOT skip a distinct PayPal-invoice-TOTAL gap).** On `class:internal`: route to grep/Read, NO web.
- **Ambiguous → internal-first → grep → escalate (finding #3 — contract §5.1):** when the classifier returns `class:internal` for an ambiguous gap, run grep/Read first; if grep RESOLVES it, done (internal, no web); if grep returns NOTHING, RE-ROUTE the gap to external → run the research `agent()` stage → write the cited block. This escalation lives HERE (the phase workflow), not in the classifier. Ship the full capability — do NOT defer.
- **M71 runtime-native: NO `require`/`fs`/`path`/`child_process`/`process`; `args` is a JSON STRING; delegate the classifier call to an `agent()`'s Bash via `runCli`.**
**Acceptance**: each of the 6 eligible stages carries the classify→(external: research+cite / internal: grep, with the grep-empty→external escalation) wiring; the research stage's `model:` is the bare `"fable"` literal; the cite block is written before the gate re-runs; re-running an already-cited phase performs ZERO additional research (exact gap-key match); an ambiguous gap grep cannot resolve escalates to research + a cited block.
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
- Assert the phase workflow inserts the classify→research wiring at EACH of the 6 eligible stages (parse the workflow source for the wiring structure per stage — not a bare substring). **(Source-structure parse is a CHEAP PRE-CHECK only — the BINDING wiring proof is the runtime state change in D3-T5/e2e, finding #7.)**
- Assert verify FAILs an external-gap-skipped artifact (A4) and PASSES a cited one.
- Assert idempotency POSITIVE: a second pass over an already-cited artifact triggers ZERO additional research (the skip predicate fires on an exact gap-key match).
- **Assert idempotency NEGATIVE (finding #2 — contract §4.1): an artifact citing gap A (PayPal OAuth) MUST still route gap B (PayPal invoice-TOTAL) to research — the distinct-gap-key case does NOT skip.** A fuzzy "covers" that skipped gap B would FAIL this assertion.
- **Assert the ambiguous-escalation path (finding #3 — contract §5.1): an ambiguous gap that grep CANNOT resolve DOES enter the research stage and produces a cited block; an ambiguous gap grep CAN resolve does NOT.**
- Assert the research stage's `model:` literal is `"fable"` (bare form) so M85 stays green.
**Acceptance**: every assertion proves behavior/state, not mere presence; the A4 FAIL case, the idempotency-skip case, the idempotency-NEGATIVE (distinct-gap routes) case, and the ambiguous-escalation case all fire.
**Test**: this file IS the test. Runner: `npm test`.

### M89-D3-T4 — End-to-end dogfood test (HEADLINE binding — finding #4 + #7, deterministic-offline)
**Files**: `test/m89-e2e-research-cite.test.js` (NET-NEW — the milestone's reason-to-exist, exercised end-to-end)
**Dependencies**: M89-D3-T1, M89-D3-T2, D1 classifier, D2 cite-format
**Contract**: `auto-research-contract.md` §1 (classify) + §2 (stage) + §3 (cite) + §5 (A4)
**Description**: The dogfood-killing test that exercises the FULL chain offline + deterministic (no live web). Drives a fixture phase artifact containing a PLANTED EXTERNAL gap (the S2-M5 case, e.g. "what is PayPal v2's invoice TOTAL limit?") through:
1. **classify** — the D1 classifier returns `class:external`.
2. **research-stage** — a **STUBBED / RECORDED WebFetch** returns a CANNED fact + source URL (so the test is deterministic + offline — no network). The stub stands in for the live research `agent()` web call.
3. **cite-write** — the canned fact is written as a `## Verified Facts (auto-research)` block (§3) into the artifact.
4. **A4 verify gate** — run the gate (D3-T2 logic) against the RESULTING artifact: assert it now PASSES (the gap is cited).
- **State-change binding (finding #7):** assert the Verified-Facts block was ACTUALLY written into the OUTPUT artifact (a state change — the artifact differs before/after), not merely that the wiring text is present in source.
- **Contrast assertion:** the SAME artifact BEFORE research (external gap recorded, no cited block) FAILS the A4 gate. So the test proves: un-researched → FAIL, researched+cited → PASS.
- **Planted-internal contrast:** a planted INTERNAL gap does NOT enter the research stage (the stub is never invoked) — proves internal never triggers web (pairs with D4's A3 routing test).
**Acceptance**: the full classify→research(stub)→cite→verify chain runs deterministically offline; un-researched artifact FAILS A4, researched+cited artifact PASSES A4; the cited block is a real state change in the output artifact; a planted internal gap never reaches the (stubbed) research stage. This is the headline dogfood-killing test (SC2/SC3/A2/A4 end-to-end — closes the "no end-to-end test" finding).
**Test**: this file IS the test (deterministic-OFFLINE — the WebFetch is stubbed/recorded). Runner: `npm test`. The REAL-SANDBOX evidence (workflow actually run to completion) is M89-D3-T5.

### M89-D3-T5 — Verify (RUN, don't node --check) + runtime state-change evidence (finding #7)
**Files**: verification only
**Dependencies**: M89-D3-T1..T4
**Description**: RUN `gsd-t-phase.workflow.js` + `gsd-t-verify.workflow.js` to COMPLETION in the real sandbox (per [[feedback_workflow_must_run_in_real_sandbox]] — `node --check` is insufficient: the sandbox bans require/fs and passes `args` as a STRING). **Runtime wiring proof (finding #7 — the BINDING evidence, beyond the source-parse pre-check in T3):** run at least one eligible phase stage with a PLANTED EXTERNAL gap and assert a `## Verified Facts (auto-research)` block was ACTUALLY written to the output artifact (an observed STATE CHANGE, not a source-pattern match); run one with a PLANTED INTERNAL gap and assert the research stage was NOT entered (no Verified-Facts block written). A source parse passes even if the wiring never fires — this real-sandbox run proves it fires. (The DETERMINISTIC-OFFLINE half of this proof is the D3-T4 e2e test driving classify + a stubbed research stage at the module level; this T5 run is the REAL-SANDBOX evidence, mirroring M82/83/84 real-sandbox proofs.) Run `npm test` (zero new regressions). Confirm `test/m71-workflow-runtime-native-lint.test.js` + `test/m85-workflow-tier-policy-lint.test.js` GREEN.
**Acceptance**: both workflows run to completion in-sandbox; a planted-external phase run WRITES a cited Verified-Facts block to the artifact (state change observed); a planted-internal run writes NONE; full suite green (no new failures); M71 + M85 lints green.
**Test**: real-sandbox workflow run (state-change observed) + `npm test`.
