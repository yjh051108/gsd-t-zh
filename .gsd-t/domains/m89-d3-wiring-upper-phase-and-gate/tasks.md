# Tasks: m89-d3-wiring-upper-phase-and-gate

> **Wave 2 — GATED on D1's A1 (M89-D1-T3) GREEN.** Concurrent with D4 (disjoint workflow files).
> EXCLUSIVE owner of `gsd-t-phase.workflow.js` + `gsd-t-verify.workflow.js` — D4 never touches these.
> Contract: `.gsd-t/contracts/auto-research-contract.md` v1.2.0 §1/§2/§3/§4/§5/§6.5/§7.
> **MODEL FORM:** the research `agent()` stage uses a BARE literal `model: "fable"` (NOT `overrides["research"] ?? …`
> — that `??`-form FAILS the M85 lint; `research` is not an injectable designated stage; see D2-T1 correction).
> **PREMISE CORRECTION:** the trigger is Stated-Claims (§6.5, LLM-prompted) → classify each GUESSED claim,
> NOT "detect a gap." D3 OWNS the §7 ENFORCE marker (classify-time WRITE + cite-time flip) + the verify gate on it.

## Files Owned
- `templates/workflows/gsd-t-phase.workflow.js`
- `templates/workflows/gsd-t-verify.workflow.js`
- `test/m89-phase-research-wiring.test.js`
- `test/m89-e2e-research-cite.test.js` — the end-to-end dogfood test (A5): Stated-Claims → classify → research-stage (STUBBED WebFetch) → cite-write + marker flip uncited→cited → verify gate FAILS-then-PASSES

## Tasks

### M89-D3-T1 — Wire Stated-Claims→classify→research + the §7 marker into gsd-t-phase.workflow.js
**Files**: `templates/workflows/gsd-t-phase.workflow.js`
**Dependencies**: D1 A1 GREEN (gate); CONSUMES `bin/gsd-t-research-gate.cjs` (D1), `templates/prompts/research-subagent.md` + `templates/prompts/stated-claims-snippet.md` (D2-T2/T2b), contract §1/§2/§3/§4/§6.5/§7
**Contract**: `auto-research-contract.md` §6.5 (DETECT Stated-Claims), §1 (classify), §2 (stage), §3 (cite), §4 (idempotency), §7 (ENFORCE marker)
**Description**: At each research-eligible upper stage (plan, pre-mortem, partition, discuss, milestone, impact — all run through phase):
- **DETECT (§6.5):** the stage prompt embeds the Stated-Claims snippet (D2-T2b) so the agent emits a `## Stated Claims` list tagging load-bearing claims KNOWN | GUESSED(type). The wiring parses the `[GUESSED:*]` entries and iterates EACH through the classifier via the inline `runCli` helper (project-local `bin/gsd-t-research-gate.cjs` first, else global `gsd-t research-gate classify`). (DETECT is LLM-prompted, not deterministic — an untagged claim is an acknowledged miss, not a silent pass.)
- **On `class:external`:** **WRITE the §7 marker** `<!-- auto-research-claim: class=external key=<normalized-claim-key> status=uncited -->` into the artifact at classify time; then run the research `agent()` stage — **`model: "fable"` (bare literal)**, prompt Read from `research-subagent.md` — write the cited `## Verified Facts (auto-research)` block (URL + date) into the artifact BEFORE the phase gate re-runs, and **FLIP the marker to `status=cited`** (same claim-key). **Idempotent (A2/A3 — §4.1): if a marker for the claim-key is already `status=cited` with a matching cited fact, skip research (exact normalized-claim-key match, NOT substring/keyword — a cited PayPal-OAuth fact must NOT skip a distinct PayPal-invoice-TOTAL claim).**
- **On `class:internal`:** route to grep/Read, NO web, NO marker.
- **Ambiguous → internal-first → grep → escalate (§5.1):** `class:internal` for an ambiguous claim → grep/Read first; grep RESOLVES → done; grep EMPTY → re-route external → write the §7 marker → research → cite → flip. Ship the full capability — do NOT defer.
- **M71 runtime-native: NO `require`/`fs`/`path`/`child_process`/`process`; `args` is a JSON STRING; delegate the classifier call + artifact read/write to an `agent()`'s Bash via `runCli`.**
**Acceptance**: each of the 6 eligible stages embeds the Stated-Claims snippet + carries the classify→(external: marker-write→research+cite→marker-flip / internal: grep, with grep-empty→external escalation) wiring; the research stage's `model:` is the bare `"fable"` literal; the marker is written `status=uncited` at classify time and flipped to `status=cited` when the cited block lands; re-running an already-`cited` phase performs ZERO additional research (exact claim-key match); an ambiguous claim grep cannot resolve escalates to research + a cited block.
**Test**: `test/m89-phase-research-wiring.test.js` (T3) — functional assertions: Stated-Claims parse, classify-per-claim, marker write+flip, idempotency, escalation, write-before-gate. `test/m71-workflow-runtime-native-lint.test.js` + `test/m85-workflow-tier-policy-lint.test.js` stay GREEN (sandbox-clean + bare-`fable` literal in the valid tier set).

### M89-D3-T2 — Wire the §7 ENFORCE-marker gate into gsd-t-verify.workflow.js
**Files**: `templates/workflows/gsd-t-verify.workflow.js`
**Dependencies**: D1 A1 GREEN; contract §5 (A4) + §7 (marker); shares the marker + cite-block detect strings with D2-T3
**Contract**: `auto-research-contract.md` §7 (ENFORCE marker) + §5 (A4 — uncited external guess → verify FAILS)
**Description**: The verify gate FAILs an artifact carrying ANY `<!-- auto-research-claim: ... status=uncited -->` marker (§7) — an external guessed claim that proceeded without a matching cited fact (no silent guess). It PASSES when every external-claim marker is `status=cited` AND a matching `## Verified Facts (auto-research)` entry (same claim-key, URL + date) is present. **The marker is what makes A4 enforceable even on a claim never written as a Verified-Facts entry** (dissolves the cycle-2 "A4 can't catch a never-stated gap" CRITICAL). Detect via grep for the HTML-comment marker + heading string. M71 runtime-native (delegate any scan to `runCli` / an `agent()` Bash; no `fs`).
**Acceptance**: verify FAILs an artifact with a `status=uncited` external-claim marker; PASSES one where all markers are `status=cited` with matching cited facts; an internal-only-gap artifact (no markers) is unaffected.
**Test**: `test/m89-phase-research-wiring.test.js` (T3) asserts the FAIL path (uncited marker present) and the PASS path (all markers cited + matching facts).

### M89-D3-T3 — Wiring tests
**Files**: `test/m89-phase-research-wiring.test.js` (NET-NEW — implementation path for A4 + phase idempotency)
**Dependencies**: M89-D3-T1, M89-D3-T2
**Contract**: `auto-research-contract.md` §4 (A2) + §5 (A4)
**Description**: Functional, not existence:
- Assert the phase workflow embeds the Stated-Claims snippet (§6.5) and inserts the classify→research wiring at EACH of the 6 eligible stages (parse the workflow source for the wiring structure per stage — not a bare substring). **(Source-structure parse is a CHEAP PRE-CHECK only — the BINDING wiring proof is the runtime state change in D3-T5/e2e, finding #7.)**
- **Assert the §7 marker lifecycle: a classified external claim writes a `status=uncited` marker; the cite-write flips it to `status=cited` (same claim-key).**
- Assert verify FAILs an artifact carrying a `status=uncited` external-claim marker (A4) and PASSES one where all markers are `status=cited` with matching cited facts.
- Assert idempotency POSITIVE: a second pass over an already-`cited`-marker artifact triggers ZERO additional research (the skip predicate fires on an exact claim-key match).
- **Assert idempotency NEGATIVE (finding #2 — §4.1): an artifact citing claim A (PayPal OAuth) MUST still route claim B (PayPal invoice-TOTAL) to research — the distinct-claim-key case does NOT skip.** A fuzzy "covers" that skipped claim B would FAIL.
- **Assert the ambiguous-escalation path (finding #3 — §5.1): an ambiguous claim that grep CANNOT resolve DOES enter the research stage + writes a marker + cited block; one grep CAN resolve does NOT.**
- Assert the research stage's `model:` literal is `"fable"` (bare form) so M85 stays green.
**Acceptance**: every assertion proves behavior/state, not mere presence; the marker write+flip, the A4 FAIL (uncited marker) case, the idempotency-skip case, the idempotency-NEGATIVE (distinct-claim routes) case, and the ambiguous-escalation case all fire.
**Test**: this file IS the test. Runner: `npm test`.

### M89-D3-T4 — End-to-end dogfood test (HEADLINE binding — A5, deterministic-offline)
**Files**: `test/m89-e2e-research-cite.test.js` (NET-NEW — the milestone's reason-to-exist, exercised end-to-end)
**Dependencies**: M89-D3-T1, M89-D3-T2, D1 classifier, D2 cite-format + Stated-Claims snippet
**Contract**: `auto-research-contract.md` §6.5 (Stated-Claims) + §1 (classify) + §2 (stage) + §3 (cite) + §7 (marker) + §5 (A4)
**Description**: The dogfood-killing test that exercises the FULL chain offline + deterministic (no live web). Drives a fixture phase artifact whose Stated-Claims list contains a PLANTED EXTERNAL GUESS (the S2-M5 case, e.g. an ASSUMED claim "PayPal v2 caps the invoice TOTAL at $X" tagged `[GUESSED:assumed]`) through:
1. **DETECT** — parse the `## Stated Claims` list; pick the `[GUESSED:*]` external claim.
2. **classify** — the D1 classifier returns `class:external`.
3. **marker write (§7)** — assert a `<!-- auto-research-claim: class=external key=<k> status=uncited -->` marker is written into the artifact.
4. **A4 gate, PRE-research** — run the gate against the artifact NOW (uncited marker present): assert it **FAILS**.
5. **research-stage** — a **STUBBED / RECORDED WebFetch** returns a CANNED fact + source URL + date (deterministic + offline — no network). The stub stands in for the live research `agent()`.
6. **cite-write + marker flip** — the canned fact is written as a `## Verified Facts (auto-research)` block (§3, URL + date) AND the §7 marker is flipped `uncited→cited` (same claim-key).
7. **A4 gate, POST-research** — run the gate against the RESULTING artifact: assert it now **PASSES**.
- **State-change binding (finding #7):** assert BOTH the Verified-Facts block AND the marker flip (`uncited`→`cited`) are ACTUAL writes into the OUTPUT artifact (the artifact differs before/after) — not merely that the wiring text is present in source.
- **Gate FAILS-then-PASSES:** the SAME claim FAILS the gate pre-research (uncited marker) and PASSES post-research (cited marker + matching fact). This is the headline assertion.
- **Planted-internal contrast:** a `[GUESSED:*]` INTERNAL claim does NOT enter the research stage (the stub is never invoked) and writes NO marker — proves internal never triggers web (pairs with D4's A3 routing test).
**Acceptance**: the full Stated-Claims→classify→marker-write→(gate FAIL)→research(stub)→cite+flip→(gate PASS) chain runs deterministically offline; the marker flips uncited→cited as a real state change; the gate FAILS pre-research and PASSES post-research; a planted internal claim never reaches the (stubbed) research stage and writes no marker. This is the headline dogfood-killing test (A5 end-to-end — closes the "no end-to-end test" finding).
**Test**: this file IS the test (deterministic-OFFLINE — the WebFetch is stubbed/recorded). Runner: `npm test`. The REAL-SANDBOX evidence (workflow actually run to completion) is M89-D3-T5.

### M89-D3-T5 — Verify (RUN, don't node --check) + runtime state-change evidence (finding #7)
**Files**: verification only
**Dependencies**: M89-D3-T1..T4
**Description**: RUN `gsd-t-phase.workflow.js` + `gsd-t-verify.workflow.js` to COMPLETION in the real sandbox (per [[feedback_workflow_must_run_in_real_sandbox]] — `node --check` is insufficient: the sandbox bans require/fs and passes `args` as a STRING). **Runtime wiring proof (finding #7 — the BINDING evidence, beyond the source-parse pre-check in T3):** run at least one eligible phase stage with a planted EXTERNAL guessed claim and assert BOTH a `## Verified Facts (auto-research)` block AND the `status=cited` §7 marker were ACTUALLY written to the output artifact (an observed STATE CHANGE, not a source-pattern match); run one with a planted INTERNAL claim and assert the research stage was NOT entered (no Verified-Facts block, no marker). A source parse passes even if the wiring never fires — this real-sandbox run proves it fires. (The DETERMINISTIC-OFFLINE half is the D3-T4 e2e test; this T5 run is the REAL-SANDBOX evidence, mirroring M82/83/84 real-sandbox proofs.) Run `npm test` (zero new regressions). Confirm `test/m71-workflow-runtime-native-lint.test.js` + `test/m85-workflow-tier-policy-lint.test.js` GREEN.
**Acceptance**: both workflows run to completion in-sandbox; a planted-external phase run WRITES a cited Verified-Facts block + a `status=cited` marker to the artifact (state change observed); a planted-internal run writes NONE; full suite green (no new failures); M71 + M85 lints green.
**Test**: real-sandbox workflow run (state-change observed) + `npm test`.
