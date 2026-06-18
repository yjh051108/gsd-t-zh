# Tasks: m89-d4-wiring-worker-workflows

> **Wave 2 — GATED on D1's A1 (M89-D1-T3) GREEN.** Concurrent with D3 (disjoint workflow files).
> EXCLUSIVE owner of execute/debug/quick/wave workflow files — D3 never touches these.
> Contract: `.gsd-t/contracts/auto-research-contract.md` §1/§2/§3/§4/§5.
> **MODEL FORM:** research `agent()` stage uses a BARE literal `model: "fable"` (NOT `overrides["research"] ?? …`
> — that `??`-form FAILS the M85 lint; `research` is not an injectable designated stage; see D2-T1 correction).
> **WAVE EXCEPTION (plan-hardening):** `gsd-t-wave.workflow.js` is a pure composer of execute+verify and the M85
> lint asserts it has ZERO `model:` occurrences (`test/m85-...lint.test.js` "wave.workflow.js has 0 model:
> occurrences"). DO NOT add a research `agent()`/`model:` to wave — its research-eligible step is inherited
> transitively through the execute (D4) + verify (D3) sub-workflows it composes. Only forward `overrides` (already wired).

## Files Owned
- `templates/workflows/gsd-t-execute.workflow.js`
- `templates/workflows/gsd-t-debug.workflow.js`
- `templates/workflows/gsd-t-quick.workflow.js`
- `templates/workflows/gsd-t-wave.workflow.js`
- `test/m89-worker-research-wiring.test.js`
- `test/m89-internal-gap-no-websearch.test.js`

## Tasks

### M89-D4-T1 — Wire execute + quick (research stage); wave stays composer-only
**Files**: `templates/workflows/gsd-t-execute.workflow.js`, `templates/workflows/gsd-t-quick.workflow.js` (research stage added); `templates/workflows/gsd-t-wave.workflow.js` (NO research agent — composer invariant; see header)
**Dependencies**: D1 A1 GREEN (gate); CONSUMES `bin/gsd-t-research-gate.cjs` (D1), `templates/prompts/research-subagent.md` (D2-T2), contract §1/§2/§3/§4
**Contract**: `auto-research-contract.md` §1 (envelope), §2 (stage interface), §3 (cite), §4 (idempotency)
**Description**: In `execute` and `quick`, at the research-eligible step (a worker hits an unfamiliar external API/library mid-build): call the classifier via the inline `runCli` helper. On `class:external`: run the research `agent()` stage — **`model: "fable"` (bare literal)**, prompt Read from `templates/prompts/research-subagent.md` — writing a cited `## Verified Facts (auto-research)` block into the artifact; idempotent (skip ONLY on an exact gap-key match per contract §4.1 — not substring/keyword). On `class:internal`: grep/Read, **NO research stage entered** (A3 — routing decision, contract §5). **Ambiguous → internal-first → grep → escalate (finding #3 — contract §5.1):** an ambiguous gap classified internal runs grep first; grep-empty → re-route external → research + cite. Ship the full escalation here, do NOT defer. M71 runtime-native (no require/fs; `args` is a JSON STRING; classifier via `runCli`). **`gsd-t-wave.workflow.js`: NO research agent** — keep it a pure execute+verify composer (M85 zero-`model:` invariant); the research behavior reaches a wave run via its execute + verify sub-workflows.
**Acceptance**: execute + quick each carry the classify→(external: research+cite `model:"fable"` / internal: grep, with grep-empty→external escalation) wiring; wave still has ZERO `model:` occurrences; idempotency skip fires only on an exact gap-key match; an ambiguous gap grep cannot resolve escalates to research + a cited block.
**Test**: `test/m89-worker-research-wiring.test.js` (T3) asserts execute + quick carry the trigger (functional). `test/m85-workflow-tier-policy-lint.test.js` stays GREEN — INCLUDING its "wave has 0 model: occurrences" assertion (proves wave was not contaminated). `test/m71-workflow-runtime-native-lint.test.js` GREEN.

### M89-D4-T2 — Wire debug (research-not-patch-guess)
**Files**: `templates/workflows/gsd-t-debug.workflow.js`
**Dependencies**: D1 A1 GREEN; contract §1/§2/§3/§4; CONSUMES D1 classifier + D2 protocol
**Contract**: `auto-research-contract.md` §1/§2/§3/§4 + backlog #33 (circuit-breaker pairing)
**Description**: When the failure root is external behavior (classifier → `class:external`), route to the research `agent()` stage (`model: "fable"` bare literal, prompt from `research-subagent.md`) instead of a patch-guess — pairs with the #33 circuit-breaker. Same classify→(external: research+cite / internal: grep) trigger; idempotent (exact gap-key match per §4.1). **Ambiguous → internal-first → grep → escalate (finding #3 — §5.1):** ambiguous failure-root classified internal runs grep first; grep-empty → escalate external → research. **Preserve the existing debug-cycle ternary** `model: cycle === 1 ? "opus" : (overrides["debug-cycle-2"] ?? "fable")` — the research stage is a SEPARATE agent() with its own bare `"fable"` literal; do NOT fold it into the cycle ternary (the M85 lint validates the debug-cycle ternary distinctly). M71 runtime-native.
**Acceptance**: debug routes external failure-roots to research (not patch-guess); the existing debug-cycle ternary is intact; the research stage is a distinct `model:"fable"` agent.
**Test**: `test/m89-worker-research-wiring.test.js` (T3) asserts debug carries the trigger. `test/m85-...lint.test.js` GREEN — including the debug-cycle ternary assertion (cycle-1→opus, cycle-2→fable, distinct).

### M89-D4-T3 — Wiring tests + A3 zero-WebSearch
**Files**: `test/m89-worker-research-wiring.test.js` (NET-NEW), `test/m89-internal-gap-no-websearch.test.js` (NET-NEW — implementation path for A3)
**Dependencies**: M89-D4-T1, M89-D4-T2
**Contract**: `auto-research-contract.md` §5 (A3 — internal gap → ZERO WebSearch)
**Description**: Functional, not existence:
- `m89-worker-research-wiring.test.js`: assert `execute`, `quick`, `debug` each insert the classify→(external: research+cite / internal: grep, with grep-empty→external escalation) trigger at their research-eligible step (parse the wiring structure, not a bare substring — this source parse is a CHEAP PRE-CHECK; the binding runtime proof is D4-T4, finding #7). Assert `wave` carries NO direct research agent (composer-only — and that the M85 zero-`model:` invariant holds).
- `m89-internal-gap-no-websearch.test.js` (A3 — reconciled wording per contract §5/finding #5): drive each labeled INTERNAL gap from the D1 corpus through the classifier and assert the workflow takes the **grep/Read branch and NEVER enters the research `agent()` stage**. **A3 is asserted on the ROUTING DECISION, not on an actual WebSearch call count** — the Workflow `agent()` sandbox exposes NO declarative per-stage `tools:` allowlist (tool access is harness/prompt-governed), so "zero WebSearch" is provable only as "the internal class routes to grep and the research-stage branch is not taken." The test asserts: every labeled internal gap → classifier returns `class:internal` → the workflow's external-research branch condition is FALSE → no research agent() is reached.
- **Sole-web-stage structural enforcement (finding #5 — contract §5):** grep the worker workflows + the prompt set and assert the **ONLY** `agent()` stage whose PROMPT grants WebSearch/WebFetch is the research stage (`templates/prompts/research-subagent.md`) — exactly ONE web-tool-granting stage exists. Because the only path to a web tool is the research stage and the internal class never enters it, "internal never searches" is structurally guaranteed, not merely asserted per-gap.
**Acceptance**: all three worker workflows carry the trigger; wave does not; every labeled internal gap routes to grep and never reaches the research stage (A3 via routing decision); the research stage is the SOLE web-tool-granting `agent()` (exactly one); assertions prove behavior/state, no `isVisible`/existence checks.
**Test**: these two files ARE the tests. Runner: `npm test`.

### M89-D4-T4 — Verify (RUN, don't node --check) + runtime state-change evidence (finding #7)
**Files**: verification only
**Dependencies**: M89-D4-T1..T3
**Description**: RUN `execute`, `debug`, `quick`, `wave` workflows to COMPLETION in the real sandbox (per [[feedback_workflow_must_run_in_real_sandbox]]). **Runtime wiring proof (finding #7 — the BINDING evidence beyond the source-parse pre-check in T3):** run at least one eligible worker stage (execute or quick) with a PLANTED EXTERNAL gap and assert a `## Verified Facts (auto-research)` block was ACTUALLY written to the output artifact (an observed STATE CHANGE, not a source-pattern match); run one with a PLANTED INTERNAL gap and assert the research stage was NOT entered (no Verified-Facts block). A source parse passes even if the wiring never fires — this real-sandbox run proves it fires. (The DETERMINISTIC-OFFLINE half of the chain proof is D3-T4's e2e test; this T4 run is the worker-side REAL-SANDBOX evidence, mirroring M82/83/84 real-sandbox proofs.) Run `npm test` (zero new regressions). Confirm `test/m71-workflow-runtime-native-lint.test.js` + `test/m85-workflow-tier-policy-lint.test.js` GREEN (incl. wave-zero-`model:` + debug-cycle-ternary assertions).
**Acceptance**: all four workflows run to completion in-sandbox; a planted-external worker run WRITES a cited Verified-Facts block to the artifact (state change observed); a planted-internal run writes NONE; full suite green; M71 + M85 lints green.
**Test**: real-sandbox workflow runs (state-change observed) + `npm test`.
