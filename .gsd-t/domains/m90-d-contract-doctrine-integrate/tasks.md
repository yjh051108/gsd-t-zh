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
- **Files**: `templates/workflows/gsd-t-debug.workflow.js`
- **Touches**: `templates/workflows/gsd-t-debug.workflow.js`
- **Test**: `test/m71-workflow-runtime-native-lint.test.js` (stays green) + a real-sandbox run of `gsd-t-debug.workflow.js` to completion proving the halt seam fires via runCli, not a require.
- **Acceptance criteria**:
  - `gsd-t-debug.workflow.js` calls the loop-ledger via the inline runCli agent-Bash helper.
  - On a 3rd same-signature cycle the workflow HALTS the patch path from the ledger fact (R-LOOP-2 end-to-end).
  - M71 lint green (no require/fs/process; args parsed as a STRING); the workflow runs to completion in the sandbox.
- **Dependencies**: M90-D4-T2.

### M90-D4-T4 — Wire D-ARCH trigger + D-FACTUAL classify into phase + worker workflows
Thread the architectural trigger + factual classifier into `gsd-t-phase`, `gsd-t-execute`,
`gsd-t-quick` via inline runCli helpers — the trigger ONLY IF Wave-1 cleared prove-or-kill
(M90-D1-T6 GREEN); else factual-only per the R1 re-scope DOWN. M71 + M85 lints stay green.
- **Files**: `templates/workflows/gsd-t-phase.workflow.js`, `templates/workflows/gsd-t-execute.workflow.js`, `templates/workflows/gsd-t-quick.workflow.js`
- **Touches**: `templates/workflows/gsd-t-phase.workflow.js`, `templates/workflows/gsd-t-execute.workflow.js`, `templates/workflows/gsd-t-quick.workflow.js`
- **Test**: `test/m71-workflow-runtime-native-lint.test.js` + `test/m85-workflow-tier-policy-lint.test.js` (stay green) + a real-sandbox run of each edited workflow proving the trigger + classify seams invoke via runCli.
- **Acceptance criteria**: (SC-ARCH-TRIGGER wired)
  - `gsd-t-phase`/`gsd-t-execute`/`gsd-t-quick` invoke the factual classifier via runCli.
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
- **Test**: `test/m90-guardmap-rule-traceability.test.js` + `test/m71-workflow-runtime-native-lint.test.js` + a real-sandbox verify run that FAILS on each seeded flagged state (uncited-external, proven-by-adversary-only, halted-but-no-re-examination) and PASSES when all are clear. Run: `node --test test/m90-guardmap-rule-traceability.test.js`.
- **Acceptance criteria**: (SC-FAIL-CLOSED)
  - Verify FAILS on an uncited external claim (R-FAIL-1).
  - Verify FAILS on an unresolved proven-by-adversary-only premise (R-FAIL-2).
  - Verify FAILS on a halted-but-no-re-examination ledger state (R-FAIL-3).
  - Verify PASSES only when all three states are clear — no silent proceed on any.
  - M71 lint green; verify runs to completion in the sandbox.
- **Dependencies**: M90-D4-T4.

### M90-D4-T6 — Doc ripple (full blast radius, one pass)
Replace the CLAUDE-global Research Policy advisory PROSE with the DOCTRINE; add the M90
requirement to `docs/requirements.md`; update `commands/gsd-t-help.md`; ripple README +
GSD-T-README capability surface (project Pre-Commit Gate: command/capability changed); bump
`package.json` 4.6.11 → 4.7.10 (minor — new framework capability). Match the live
`~/.claude/CLAUDE.md` to the template (Document Ripple Completion Gate).
- **Files**: `templates/CLAUDE-global.md`, `docs/requirements.md`, `commands/gsd-t-help.md`, `README.md`, `GSD-T-README.md`, `package.json`
- **Touches**: `templates/CLAUDE-global.md`, `docs/requirements.md`, `commands/gsd-t-help.md`, `README.md`, `GSD-T-README.md`, `package.json`
- **Test**: `test/m90-guardmap-rule-traceability.test.js` asserts the doctrine [RULE]s in CLAUDE-global map to enforcement; `npm test` full-suite green at ≥ baseline confirms no doc-driven test break. (Doc ripple is verified by the Document Ripple Completion Gate + the guard-map traceability test, not a new runner.)
- **Acceptance criteria**:
  - CLAUDE-global Research Policy prose is REPLACED by the doctrine (advisory → enforced).
  - `docs/requirements.md` carries the M90 requirement; help + README + GSD-T-README reflect the new capability.
  - `package.json` bumped 4.6.11 → 4.7.10 (minor).
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
- **Test**: `test/m90-guardmap-rule-traceability.test.js` + `test/m90-tier-policy-lint.test.js` (node --test) — each [RULE]→enforcement traced (orphan rule FAILS); each new stage literal matches policy (drift FAILS). Run: `node --test test/m90-guardmap-rule-traceability.test.js test/m90-tier-policy-lint.test.js`.
- **Acceptance criteria**: (SC-SELF-OBEDIENCE)
  - Every §6 [RULE] is traced to a real enforcement point; an orphan rule FAILS the test.
  - Each new stage's `model:` literal matches the tier policy; a drifted literal FAILS (mandatory negative test).
  - Both lints green on the integrated tree.
- **Dependencies**: M90-D4-T6.

## Dependency / gating
- **Gated on Waves 1 + 2** all GREEN. Wave 1 prove-or-kill (M90-D1-T6) governs whether the architectural trigger is wired (M90-D4-T4) or skipped per the R1 re-scope DOWN.
- Serial within the domain (shared-surface single-owner): T1→T2→T3→T4→T5→T6→T7.
- No parallel domain writes any file here — this domain owning ALL shared surfaces is what keeps Waves 1–2 file-disjoint.
