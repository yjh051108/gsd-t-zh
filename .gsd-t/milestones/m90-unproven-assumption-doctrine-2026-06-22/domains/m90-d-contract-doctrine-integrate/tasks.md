# Domain Tasks: m90-d-contract-doctrine-integrate (M90-D4)

> Shape D — `### Mxx-Dx-Tx`, each task carries `**Files**`, `**Touches**`, `**Test**`,
> `**Acceptance criteria**`, `**Dependencies**`, `**Contract**`. Wave 3, single-owner of ALL
> shared surfaces — this is the file-disjointness keystone (Waves 1–2 stay disjoint BECAUSE
> this domain owns every shared file).
> **Domain code = D4** (parser-canonical `M90-D4-Tn`; partition's `DC` letter form renamed to
> satisfy the task-graph regex). Cross-domain deps reference the renamed Wave-1/2 IDs:
> D1 = arch-trigger (M90-D1-T*), D2 = loop-ledger (M90-D2-T*), D3 = factual (M90-D3-T*).

## Files Owned
- `.gsd-t/contracts/unproven-assumption-doctrine-contract.md`
- `.gsd-t/contracts/auto-research-contract.md`
- `templates/workflows/gsd-t-debug.workflow.js`
- `templates/workflows/gsd-t-execute.workflow.js`
- `templates/workflows/gsd-t-phase.workflow.js`
- `templates/workflows/gsd-t-quick.workflow.js`
- `templates/workflows/gsd-t-verify.workflow.js`
- `bin/gsd-t.js`
- `bin/gsd-t-model-tier-policy.cjs`
- `templates/prompts/red-team-subagent.md`
- `templates/prompts/qa-subagent.md`
- `templates/prompts/pre-mortem-subagent.md`
- `templates/CLAUDE-global.md`
- `docs/requirements.md`
- `commands/gsd-t-help.md`
- `README.md`
- `GSD-T-README.md`
- `package.json`
- `test/m90-guardmap-rule-traceability.test.js`
- `test/m90-tier-policy-lint.test.js`

## Contract
`.gsd-t/contracts/m90-doctrine-mechanisms-contract.md` §4 (fail-closed integration points) +
the Wiring-seam-ownership table (D4 is sole writer of all shared surfaces). Wires against the
FROZEN §1/§2/§3 signatures Waves 1–2 expose — never edits their source. Authors the doctrine
spine in the NEW `unproven-assumption-doctrine-contract.md`. M71 sandbox invariant (no
require/fs/process; args = JSON STRING; CLI via inline runCli agent-Bash helper) + M85 tier
policy apply to every workflow edit.

## Wave 3 — integrate (after Waves 1+2 prove-or-kill GREEN; serial single-owner)

### M90-D4-T1 — Doctrine contract (§4/§5/§6 + envelope pins) [Headline]
**Headline:** true
Author `unproven-assumption-doctrine-contract.md` v1.0.0 STABLE absorbing
`auto-research-contract.md` v1.3.3; pin the JSON envelope shapes of ALL three mechanisms
(classifier §1, trigger §2, ledger §3); specify §4 fail-closed (R-FAIL-1/2/3), §5
self-obedience (R-SELF-1), §6 guard map ([RULE]→enforcement matrix). Leave an absorbed pointer
in the old contract + update its consumer refs. This is the doctrine spine — the milestone's
HEADLINE deliverable that makes the three mechanisms one governed doctrine.
- **Files**: `.gsd-t/contracts/unproven-assumption-doctrine-contract.md`, `.gsd-t/contracts/auto-research-contract.md`, `test/m90-guardmap-rule-traceability.test.js`
- **Touches**: `.gsd-t/contracts/unproven-assumption-doctrine-contract.md`, `.gsd-t/contracts/auto-research-contract.md`
- **Test**: `test/m90-guardmap-rule-traceability.test.js` — every §6 [RULE] in the new contract is traced to an enforcement point; an unenforced [RULE] FAILS the test (the dead-code class for the doctrine itself).
- **Acceptance criteria**: (SC-SELF-OBEDIENCE foundation)
  - The new contract pins the §1/§2/§3 envelope shapes verbatim (matching the frozen producer signatures).
  - §4 fail-closed (R-FAIL-1/2/3), §5 self-obedience (R-SELF-1), §6 guard map are specified.
  - The old `auto-research-contract.md` carries an absorbed/superseded pointer + updated consumer refs.
  - Every §6 [RULE] maps to a real enforcement point (no orphan rule).
- **Dependencies**: M90-D1-T6, M90-D2-T6, M90-D3-T5 (consumes the frozen signatures).

### M90-D4-T2 — Dispatch + PROJECT_BIN_TOOLS + tier entry
Register `gsd-t-architectural-trigger.cjs` + `gsd-t-loop-ledger.cjs` dispatch cases +
PROJECT_BIN_TOOLS (and GLOBAL_BIN_TOOLS, mirroring every peer gate so the modules propagate to
`~/.claude/bin/` and each registered project) in `bin/gsd-t.js`; add the blind-adversary
`fable` tier entry to `bin/gsd-t-model-tier-policy.cjs` IF a new stage label is introduced
(single source of truth; M85).
- **Files**: `bin/gsd-t.js`, `bin/gsd-t-model-tier-policy.cjs`, `test/m90-tier-policy-lint.test.js`
- **Touches**: `bin/gsd-t.js`, `bin/gsd-t-model-tier-policy.cjs`
- **Test**: `test/m90-tier-policy-lint.test.js` — the blind-adversary stage `model:` literal matches the policy; a drifted literal FAILS (mandatory negative test). Plus a dispatch/propagation smoke check that both new modules are in the bin-tool arrays.
- **Acceptance criteria**:
  - `gsd-t architectural-trigger` + `gsd-t loop-ledger` dispatch cases route to the two new modules.
  - Both modules are members of PROJECT_BIN_TOOLS (and GLOBAL_BIN_TOOLS) — no silent no-op in downstream projects.
  - Any new stage label has a policy entry in `bin/gsd-t-model-tier-policy.cjs` (blind adversary = `fable`); the lint passes and a drifted literal fails.
- **Dependencies**: M90-D4-T1.

### M90-D4-T3 — Wire D-LOOP halt into debug workflow (runtime-native)
Add the loop-ledger halt seam to `gsd-t-debug.workflow.js` via the inline `runCli` helper. RUN
the workflow to completion in the real sandbox (NOT `node --check`) — the M71 invariant: no
require/fs/process, args = JSON STRING.
**CYCLE-BOUND CONTRADICTION — DECISION LOCKED AT PLAN: OPTION (b) (pre-mortem CRITICAL ×2,
dead-deliverable / M5 class).** `gsd-t-debug.workflow.js` TODAY runs `for (let cycle = 1; cycle <= 2;
cycle++)` and exits `needs-human` after cycle 2 — a naive ledger-halt-on-3rd-cycle branch is DEAD
CODE. **Resolution (locked, recorded in the doctrine contract — NOT deferred to execute): option
(b) re-anchor the halt to the cycle-2 boundary.** When the ledger shows the SAME computed signature
across both cycles, the workflow exits at the cycle-2 boundary with the ledger's
**premise-re-examination directive** (not the generic `needs-human`). Option (a) (raise the loop
bound) is REJECTED: it risks unbounded per-cycle M89-research-loop multiplication and changes the
debug cost envelope. Option (b) keeps the existing 2-cycle cap and only changes the EXIT REASON
when the ledger proves non-convergence — the doctrine's "stop patching, re-examine the premise"
fires exactly where the 3rd patch would have been dispatched. The halt must be REACHABLE end-to-end
through the real wired workflow, not only via isolated module calls.
- **Files**: `templates/workflows/gsd-t-debug.workflow.js`
- **Touches**: `templates/workflows/gsd-t-debug.workflow.js`
- **Test**: `test/m71-workflow-runtime-native-lint.test.js` (stays green) + a real-sandbox debug-workflow INTEGRATION run driven with a synthetic input that produces the SAME computed symptom-signature across cycles, asserting the workflow HALTS from the ledger fact (emitting the premise-re-examination directive) — NOT merely that the runCli seam is present, and NOT only the module-isolation killing test (that lives in D2-T6). The halt must fire end-to-end through the real (post-reconciliation) loop.
- **Acceptance criteria**: (SC-LOOP-HOOK-FIRES end-to-end)
  - `gsd-t-debug.workflow.js` calls the loop-ledger via the inline runCli agent-Bash helper.
  - The cycle-bound contradiction is RESOLVED via **option (b)** (re-anchor the halt to the cycle-2 boundary; the existing 2-cycle cap is unchanged) and this decision is RECORDED in the doctrine contract. When the ledger shows the same computed signature across both cycles, the workflow exits with the premise-re-examination directive, NOT generic needs-human.
  - The real-sandbox integration test drives a same-signature non-converging loop (3 distinct runCli-style invocations, NOT one in-process loop — see D2-T6 cross-process persistence) and asserts the workflow HALTS the patch path from the ledger fact + emits the premise-re-examination directive (R-LOOP-2 end-to-end, not module-isolation).
  - M71 lint green (no require/fs/process; args parsed as a STRING); the workflow runs to completion in the sandbox.
- **Dependencies**: M90-D4-T2.

### M90-D4-T4 — Wire D-ARCH trigger + D-FACTUAL classify into phase + worker workflows
Thread the architectural trigger + factual classifier into `gsd-t-phase`, `gsd-t-execute`,
`gsd-t-quick` via inline runCli helpers — the trigger ONLY IF Wave-1 cleared prove-or-kill
(M90-D1-T6 GREEN); else factual-only per the R1 re-scope DOWN. M71 + M85 lints stay green.
**NAME THE SIGNAL PRODUCER + PROVE REACHABILITY FROM A REAL RUN — NO SEEDED SHORTCUTS
(pre-mortem CRITICAL #1 + HIGH #2/#3, dead-deliverable M5 class — the recurring headline gap).**
A trigger that only fires when a TEST hands it a signal is dead code. Both input paths must be
fed by a NAMED producer that computes the signal from inputs that actually exist at runtime, and
the reachability test must use NO manually-injected signal:

  **Protocol-class path (R-ARCH-2, the execute/quick + everywhere feed) — PRODUCER NAMED:** the
  extend-vs-greenfield signal is COMPUTED from the runtime task/scope inputs that already exist —
  a task whose `**Touches**` lists an EXISTING file (vs. a net-new path) extends existing code; a
  domain whose scope edits an existing module is extend-class. The wiring computes this signal in
  each workflow from the brief/task inputs (no new upstream phase needed) and feeds it to the
  trigger. The end-to-end test drives a REAL execute/quick run on an edit-in-place task with an
  existing-file Touches entry, injects NOTHING, and asserts (a) the workflow COMPUTES the
  extend-existing signal from real inputs and (b) the trigger fires from THAT computed signal —
  the test FAILS if the producer is absent (no seeded-shortcut pass).

  **Divergence path (R-ARCH-1) — HONESTLY SCOPED competition-arm-only + real-feed test:** wired
  ONLY into the phase competition arm (`competition:N>1`), fed the competition producers' ACTUAL N
  outputs (not a seeded fixture). A real-sandbox test runs `gsd-t-phase` with `competition:N>1` on
  an eligible phase and asserts the trigger receives the real N outputs and fires/stays-silent
  correctly. **Honesty clause (the doctrine on itself):** competition produces Self-MoA samples of
  ONE model (temperature/seed-varied), which may NOT diverge like the fresh-context saga cases the
  threshold was tuned on. If the real competition feed cannot meaningfully exercise the divergence
  formula, the plan RECORDS that mismatch and documents the divergence path as
  competition-arm-only-and-EXPERIMENTAL (measured fire-rate, never a silent "it works") — it does
  NOT ship a seeded stand-in as proof. In default operation (competition off) the divergence path
  is intentionally dormant; only the protocol-class path is the everywhere feed.
- **Files**: `templates/workflows/gsd-t-phase.workflow.js`, `templates/workflows/gsd-t-execute.workflow.js`, `templates/workflows/gsd-t-quick.workflow.js`
- **Touches**: `templates/workflows/gsd-t-phase.workflow.js`, `templates/workflows/gsd-t-execute.workflow.js`, `templates/workflows/gsd-t-quick.workflow.js`
- **Test**: `test/m71-workflow-runtime-native-lint.test.js` + `test/m85-workflow-tier-policy-lint.test.js` (stay green) + (1) a real-sandbox END-TO-END execute/quick run on an edit-in-place task that injects NO signal and asserts the extend-existing signal is COMPUTED from real task/scope inputs AND the trigger fires (`fired:true`) — fails if the producer is absent; (2) a real-sandbox `gsd-t-phase competition:N>1` run asserting the divergence path receives the producers' real N outputs and fires/stays-silent correctly, OR (honesty branch) a recorded test that the divergence formula cannot be meaningfully exercised by Self-MoA samples → divergence path documented competition-arm-only-EXPERIMENTAL.
- **Acceptance criteria**: (SC-ARCH-TRIGGER wired + REACHABLE from a real run)
  - `gsd-t-phase`/`gsd-t-execute`/`gsd-t-quick` invoke the factual classifier via runCli.
  - The protocol-class (extend-existing) signal producer is NAMED and computes the signal from real runtime task/scope inputs (existing-file Touches ⇒ extend); a real-run end-to-end test fires the trigger from the COMPUTED signal with NO seeded injection and FAILS if the producer is absent.
  - The divergence path is wired competition-arm-only and tested with the competition arm's REAL N outputs; if Self-MoA samples cannot exercise the divergence formula, that mismatch is RECORDED and the path is documented competition-arm-only-EXPERIMENTAL (measured, never silently claimed) — never proven by a seeded stand-in.
  - The architectural trigger is wired IFF M90-D1-T6 is GREEN; otherwise factual-only (R1 re-scope honored, recorded in the contract).
  - M71 + M85 lints green; each edited workflow runs to completion in the sandbox.
- **Dependencies**: M90-D4-T3, and conditionally M90-D1-T6 (governs trigger-wire vs. skip).

### M90-D4-T5 — Verify reads the flagged states (§4 fail-closed) [Headline]
**Headline:** true
`gsd-t-verify.workflow.js` FAILS (never warns-and-proceeds) on ANY of: an uncited external
claim (R-FACT-4 / §1 marker), an unresolved proven-by-adversary-only premise (R-ARCH-6 / §2
flag), a halted-but-no-re-examination ledger state (R-LOOP-3 / §3 state). The triad prompt
touchpoints (red-team/qa/pre-mortem) read these states. This is the SC-FAIL-CLOSED capability
end-to-end — the doctrine's enforcement teeth.
- **Files**: `templates/workflows/gsd-t-verify.workflow.js`, `templates/prompts/red-team-subagent.md`, `templates/prompts/qa-subagent.md`, `templates/prompts/pre-mortem-subagent.md`
- **Touches**: `templates/workflows/gsd-t-verify.workflow.js`, `templates/prompts/red-team-subagent.md`, `templates/prompts/qa-subagent.md`, `templates/prompts/pre-mortem-subagent.md`
**COVER THE R1-RE-SCOPED-DOWN CONFIG (pre-mortem MEDIUM, error/failure path):** the R-FAIL-2
flag is produced by the arch-trigger and R-FAIL-3 by the loop-ledger. If Wave-1 prove-or-kill
R1-EXITS (re-scope DOWN to factual-only), the arch-trigger is NOT wired (D4-T4 conditional) and
the proven-by-adversary-only flag is never produced. Verify's R-FAIL-2/R-FAIL-3 reads must be a
DOCUMENTED no-op-PASS when the producing mechanism is de-scoped (recorded "mechanism absent by
design" in the doctrine contract) — NOT a vacuous always-pass that would also pass if the
mechanism were wired-but-broken. The check FAILS only when the mechanism IS wired AND emits an
unresolved flag; it cleanly PASSES (with a recorded de-scoped note) when the mechanism is absent.
- **Test**: `test/m90-guardmap-rule-traceability.test.js` + `test/m71-workflow-runtime-native-lint.test.js` + a real-sandbox verify run that FAILS on each seeded flagged state (uncited-external, proven-by-adversary-only, halted-but-no-re-examination) and PASSES when all are clear. PLUS an R1-re-scoped-DOWN case: with the arch-trigger NOT wired, assert verify's R-FAIL-2 read is a recorded no-op-PASS (de-scoped note present), and assert the same check FAILS when the trigger IS wired and emits an unresolved flag (distinguishing de-scoped-PASS from broken-but-vacuous-PASS). Same conditional coverage for R-FAIL-3 if the loop-ledger halt is de-scoped. Run: `node --test test/m90-guardmap-rule-traceability.test.js`.
- **Acceptance criteria**: (SC-FAIL-CLOSED)
  - Verify FAILS on an uncited external claim (R-FAIL-1).
  - Verify FAILS on an unresolved proven-by-adversary-only premise (R-FAIL-2) — WHEN the arch-trigger is wired.
  - Verify FAILS on a halted-but-no-re-examination ledger state (R-FAIL-3) — WHEN the loop-ledger is wired.
  - When a flag-producing mechanism is R1-de-scoped (not wired), the corresponding check is a DOCUMENTED no-op-PASS (de-scoped note in the contract), distinguishable from a wired-but-broken vacuous pass.
  - Verify PASSES only when all three states are clear (or cleanly de-scoped) — no silent proceed on any wired-and-flagged state.
  - M71 lint green; verify runs to completion in the sandbox.
- **Dependencies**: M90-D4-T4.

### M90-D4-T6 — Doc ripple (full blast radius, one pass)
Replace the CLAUDE-global Research Policy advisory PROSE with the DOCTRINE; the M90 REQ-M90-01..07
block is ALREADY in `docs/requirements.md` (authored at plan time per pre-mortem #5) — D4-T6 only
flips its `Status` cells to `complete` and ripples the surrounding prose/test-coverage/total rows,
NOT first authoring; update `commands/gsd-t-help.md`; ripple README +
GSD-T-README capability surface (project Pre-Commit Gate: command/capability changed); bump
`package.json` to the next MINOR (new framework capability) — **READ the CURRENT version from
`package.json` at execute time and bump from it** (it is 4.6.12 on disk as of 2026-06-22, NOT
4.6.11 — the partition's "4.6.11→4.7.10" literal is stale; the correct bump is 4.6.12 → 4.7.10).
Match the live `~/.claude/CLAUDE.md` to the template (Document Ripple Completion Gate).
- **Files**: `templates/CLAUDE-global.md`, `docs/requirements.md`, `commands/gsd-t-help.md`, `README.md`, `GSD-T-README.md`, `package.json`
- **Touches**: `templates/CLAUDE-global.md`, `docs/requirements.md`, `commands/gsd-t-help.md`, `README.md`, `GSD-T-README.md`, `package.json`
- **Test**: `test/m90-guardmap-rule-traceability.test.js` asserts the doctrine [RULE]s in CLAUDE-global map to enforcement; `npm test` full-suite green at ≥ baseline confirms no doc-driven test break. PLUS a version-consistency assertion (folds into the guard-map test): the bumped `package.json` version read from disk is strictly greater than the pre-bump version, and the SAME final literal appears in `package.json`, `README.md`, `GSD-T-README.md`, and `progress.md`. (Doc ripple verified by the Document Ripple Completion Gate + the guard-map traceability test, not a new runner.)
- **Acceptance criteria**:
  - CLAUDE-global Research Policy prose is REPLACED by the doctrine (advisory → enforced).
  - `docs/requirements.md` carries the M90 requirement; help + README + GSD-T-README reflect the new capability.
  - `package.json` bumped from the CURRENT on-disk version (4.6.12) to the next minor 4.7.10; the bump step READS the live version (never the stale 4.6.11 literal) and asserts the result is strictly greater than the pre-bump version.
  - `package.json`, `README.md`, `GSD-T-README.md`, and `progress.md` carry the SAME final version literal (consistency assertion in the guard-map test).
  - Live `~/.claude/CLAUDE.md` matched to the template.
  - Full blast radius updated in ONE pass (no partial doc-ripple).
- **Dependencies**: M90-D4-T5.

### M90-D4-T7 — Guard-map traceability + tier-policy lint
> Self-obedience lint (behavioral, NOT the milestone headline — its Files are test-only by
> design; the headline impl paths live in T1 doctrine contract + T5 verify fail-closed).
`test/m90-guardmap-rule-traceability.test.js` traces each §6 [RULE] to its enforcement (the Red
Team menu) — an UNENFORCED rule FAILS. `test/m90-tier-policy-lint.test.js` proves new stages'
`model:` literals match `bin/gsd-t-model-tier-policy.cjs`; a drifted literal FAILS (the
mandatory negative test, M71-family). These lints are the doctrine's self-obedience proof
(SC-SELF-OBEDIENCE) — M90 enforced on M90's own artifacts.
**SELF-OBEDIENCE made a GATE, not prose (pre-mortem round-3 #4):** SC-SELF-OBEDIENCE's
">2-cycle same-signature non-convergence triggered a recorded premise re-examination" must be
STRUCTURALLY asserted, not left as §5 prose. Add an assertion that reads M90's own build record:
EITHER no >2-cycle same-computed-signature thrash occurred, OR a recorded premise-re-examination
artifact exists for any such run. M90's own plan-hardening loop IS such a record — the
progress.md Decision Log carries the round-1/2/3 pre-mortem premise-re-examination entries (the
doctrine applied to itself: each round re-examined the premise rather than patching a variant).
The test asserts that artifact exists and is structured (the Decision Log entries tagged
`[PLAN-HARDENING][pre-mortem ... → fixed]`), substituting for a live ledger where M90's own
development predates the ledger being built.
**R1-EXIT CONSISTENCY (pre-mortem round-3 #5):** add a test for the FULL R1-re-scoped-DOWN
configuration (arch-trigger NOT wired): assert (a) NO dangling reference to §2 trigger envelope
fields (`fired`, `basis`, `proven-by-adversary-only`) remains in any workflow/contract/verify
path, (b) the guard-map traceability passes with the §2 [RULE]s marked DE-SCOPED (not orphaned),
(c) verify's R-FAIL-2 read is the documented no-op-PASS. This proves the R1 exit leaves a
consistent tree, not a half-wired one.
- **Files**: `test/m90-guardmap-rule-traceability.test.js`, `test/m90-tier-policy-lint.test.js`
- **Touches**: `test/m90-guardmap-rule-traceability.test.js`, `test/m90-tier-policy-lint.test.js`
- **Test**: `test/m90-guardmap-rule-traceability.test.js` + `test/m90-tier-policy-lint.test.js` (node --test) — each [RULE]→enforcement traced (orphan rule FAILS); each new stage literal matches policy (drift FAILS); a doc-consistency assertion that grep finds NO letter-form task IDs (`M90-D[A-Z]-T`) under `.gsd-t/domains/m90-*`; a SELF-OBEDIENCE assertion that M90's own build record shows no >2-cycle same-signature thrash OR a recorded premise-re-examination artifact (the Decision Log plan-hardening entries); an R1-EXIT consistency assertion (no dangling §2 envelope refs, §2 [RULE]s de-scoped-not-orphaned, R-FAIL-2 no-op-PASS). Run: `node --test test/m90-guardmap-rule-traceability.test.js test/m90-tier-policy-lint.test.js`.
- **Acceptance criteria**: (SC-SELF-OBEDIENCE)
  - Every §6 [RULE] is traced to a real enforcement point; an orphan rule FAILS the test.
  - Each new stage's `model:` literal matches the tier policy; a drifted literal FAILS (mandatory negative test).
  - NO letter-form task ID (`M90-D[A-Z]-T`) remains under `.gsd-t/domains/m90-*` — all canonical digit form.
  - SC-SELF-OBEDIENCE is a STRUCTURAL gate: M90's own build record shows no >2-cycle same-signature thrash OR a recorded premise-re-examination artifact (read structurally, not prose).
  - The full R1-re-scoped-DOWN config is consistent: no dangling §2 envelope refs, §2 [RULE]s de-scoped-not-orphaned, R-FAIL-2 no-op-PASS.
  - Both lints green on the integrated tree.
- **Dependencies**: M90-D4-T6.

## Dependency / gating
- **Gated on Waves 1 + 2** all GREEN. Wave 1 prove-or-kill (M90-D1-T6) governs whether the architectural trigger is wired (M90-D4-T4) or skipped per the R1 re-scope DOWN.
- Serial within the domain (shared-surface single-owner): T1→T2→T3→T4→T5→T6→T7.
- No parallel domain writes any file here — this domain owning ALL shared surfaces is what keeps Waves 1–2 file-disjoint.
