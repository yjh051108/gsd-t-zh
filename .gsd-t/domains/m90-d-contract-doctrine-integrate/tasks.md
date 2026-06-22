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
**RESOLVE THE CYCLE-BOUND CONTRADICTION (pre-mortem CRITICAL, dead-deliverable / M5 class):**
`gsd-t-debug.workflow.js` TODAY runs `for (let cycle = 1; cycle <= 2; cycle++)` and exits
`needs-human` after cycle 2 — it NEVER reaches a 3rd cycle, so a naive ledger-halt-on-3rd-cycle
branch is DEAD CODE. The wiring MUST reconcile the doctrine's "3rd same-signature cycle hard-halts"
with the existing 2-cycle cap, in ONE of two ways (the worker picks and records which in the
contract): **(a)** raise the debug loop bound so a 3rd same-signature cycle is reachable and the
ledger halt fires inside the loop; OR **(b)** re-anchor the halt to the cycle-2→needs-human
boundary — when the ledger shows the SAME computed signature across both cycles, exit with the
ledger's premise-re-examination directive (not the generic needs-human). Either way the halt must
be REACHABLE through the real wired workflow, not only via isolated module calls.
- **Files**: `templates/workflows/gsd-t-debug.workflow.js`
- **Touches**: `templates/workflows/gsd-t-debug.workflow.js`
- **Test**: `test/m71-workflow-runtime-native-lint.test.js` (stays green) + a real-sandbox debug-workflow INTEGRATION run driven with a synthetic input that produces the SAME computed symptom-signature across cycles, asserting the workflow HALTS from the ledger fact (emitting the premise-re-examination directive) — NOT merely that the runCli seam is present, and NOT only the module-isolation killing test (that lives in D2-T6). The halt must fire end-to-end through the real (post-reconciliation) loop.
- **Acceptance criteria**: (SC-LOOP-HOOK-FIRES end-to-end)
  - `gsd-t-debug.workflow.js` calls the loop-ledger via the inline runCli agent-Bash helper.
  - The cycle-bound contradiction is RESOLVED (raise the bound OR re-anchor to the cycle-2 boundary) and the chosen reconciliation is recorded in the doctrine contract — the 3rd/Nth same-signature halt is REACHABLE through the real wired workflow.
  - The real-sandbox integration test drives a same-signature non-converging loop and asserts the workflow HALTS the patch path from the ledger fact + emits the premise-re-examination directive (R-LOOP-2 end-to-end, not module-isolation).
  - M71 lint green (no require/fs/process; args parsed as a STRING); the workflow runs to completion in the sandbox.
- **Dependencies**: M90-D4-T2.

### M90-D4-T4 — Wire D-ARCH trigger + D-FACTUAL classify into phase + worker workflows
Thread the architectural trigger + factual classifier into `gsd-t-phase`, `gsd-t-execute`,
`gsd-t-quick` via inline runCli helpers — the trigger ONLY IF Wave-1 cleared prove-or-kill
(M90-D1-T6 GREEN); else factual-only per the R1 re-scope DOWN. M71 + M85 lints stay green.
**NAME THE TRIGGER'S INPUT SOURCE PER WORKFLOW (pre-mortem HIGH, dead-deliverable / unspecified
input):** the arch-trigger's divergence-sampling path (R-ARCH-1) needs "N fresh-context answers
to the SAME approach question" as input. Only the M82/M84 competition arm of `gsd-t-phase` produces
N samples; `gsd-t-execute` and `gsd-t-quick` produce ZERO today. For EACH wired workflow, the task
must NAME the concrete feed: the divergence path is wired ONLY where N samples exist (the phase
competition arm); in `execute`/`quick` (and non-competition phase) the trigger runs via the
**protocol-class path (R-ARCH-2, extend-existing-code)** which fires unconditionally on an
extend-existing signal and needs no N-sample input. Document the divergence path as
phase/competition-only in the contract; do NOT wire a divergence trigger where its input is
unproducible (that would be dead code).
- **Files**: `templates/workflows/gsd-t-phase.workflow.js`, `templates/workflows/gsd-t-execute.workflow.js`, `templates/workflows/gsd-t-quick.workflow.js`
- **Touches**: `templates/workflows/gsd-t-phase.workflow.js`, `templates/workflows/gsd-t-execute.workflow.js`, `templates/workflows/gsd-t-quick.workflow.js`
- **Test**: `test/m71-workflow-runtime-native-lint.test.js` + `test/m85-workflow-tier-policy-lint.test.js` (stay green) + a real-sandbox run of each edited workflow asserting the trigger ACTUALLY FIRES (`fired:true`) on a seeded input matched to its wired path: a seeded divergent N-sample set in phase's competition arm; a seeded extend-existing signal in execute/quick (protocol-class). Not merely that the runCli seam is present.
- **Acceptance criteria**: (SC-ARCH-TRIGGER wired, with producible input)
  - `gsd-t-phase`/`gsd-t-execute`/`gsd-t-quick` invoke the factual classifier via runCli.
  - The divergence-sampling trigger is wired ONLY where N fresh-context samples are produced (phase competition arm); `execute`/`quick` use the protocol-class (extend-existing) path, which needs no N-sample input. The divergence path is documented phase/competition-only in the contract.
  - A real-sandbox test asserts the trigger FIRES (`fired:true`) on a seeded input appropriate to each wired path (divergent samples in phase; extend-existing signal in execute/quick) — no wired-but-dead trigger.
  - The architectural trigger (whichever path) is wired IFF M90-D1-T6 is GREEN; otherwise factual-only (R1 re-scope honored, recorded in the contract).
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
Replace the CLAUDE-global Research Policy advisory PROSE with the DOCTRINE; add the M90
requirement to `docs/requirements.md`; update `commands/gsd-t-help.md`; ripple README +
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
- **Files**: `test/m90-guardmap-rule-traceability.test.js`, `test/m90-tier-policy-lint.test.js`
- **Touches**: `test/m90-guardmap-rule-traceability.test.js`, `test/m90-tier-policy-lint.test.js`
- **Test**: `test/m90-guardmap-rule-traceability.test.js` + `test/m90-tier-policy-lint.test.js` (node --test) — each [RULE]→enforcement traced (orphan rule FAILS); each new stage literal matches policy (drift FAILS); PLUS a doc-consistency assertion that grep finds NO letter-form task IDs (`M90-D[A-Z]-T`) anywhere under `.gsd-t/domains/m90-*` (all references must be canonical digit form `M90-D[1-4]-T[0-9]` — the post-partition-defect-fix rename). Run: `node --test test/m90-guardmap-rule-traceability.test.js test/m90-tier-policy-lint.test.js`.
- **Acceptance criteria**: (SC-SELF-OBEDIENCE)
  - Every §6 [RULE] is traced to a real enforcement point; an orphan rule FAILS the test.
  - Each new stage's `model:` literal matches the tier policy; a drifted literal FAILS (mandatory negative test).
  - NO letter-form task ID (`M90-D[A-Z]-T`) remains under `.gsd-t/domains/m90-*` — all canonical digit form (consistency assertion folded into the guard-map test).
  - Both lints green on the integrated tree.
- **Dependencies**: M90-D4-T6.

## Dependency / gating
- **Gated on Waves 1 + 2** all GREEN. Wave 1 prove-or-kill (M90-D1-T6) governs whether the architectural trigger is wired (M90-D4-T4) or skipped per the R1 re-scope DOWN.
- Serial within the domain (shared-surface single-owner): T1→T2→T3→T4→T5→T6→T7.
- No parallel domain writes any file here — this domain owning ALL shared surfaces is what keeps Waves 1–2 file-disjoint.
