# Domain Constraints: m90-d-contract-doctrine-integrate

## Single-owner-of-shared-surfaces (the disjointness keystone)
This domain is the ONLY writer of every shared / integrate-time surface. That is precisely
what lets Waves 1–2 run file-disjoint. NEVER let a Wave-1/2 domain write a workflow, a
contract, `bin/gsd-t.js`, or a triad prompt — and NEVER write a Wave-1/2 module here. Read
their STABLE exposed signatures; do not edit them.

## Wave 3, after the proofs land (NON-NEGOTIABLE order)
Wire ONLY signatures that already cleared their killing test:
- D-ARCH trigger — only if M90-D1-T6 (prove-or-kill) is GREEN. If R1 re-scoped DOWN to
  factual-only, wire only D-FACTUAL + D-LOOP (or D-FACTUAL alone) — do NOT wire a noisy trigger.
- D-LOOP halt — only if M90-D2-T6 (must-FIRE) is GREEN.
- D-FACTUAL classifier — Wave 2 must be GREEN.

## Runtime-native invariant (M81 / TD-113 — HARD)
Every `*.workflow.js` edit MUST stay runtime-native: NO `require`/`fs`/`path`/
`child_process`/`process`; `args` is a JSON STRING the workflow `JSON.parse`s. All three new
CLI calls go through an inline `async` runCli helper running them via an `agent()`'s Bash
(project-local `bin/<tool>.cjs` first, else global `gsd-t`). The M71-family lint must stay
green for all 8 workflows. RUN the workflows to completion (not `node --check`) before
shipping ([[feedback_workflow_must_run_in_real_sandbox]]).

## Triad prompts stay protocol-bodied
NEVER inline a validation-subagent protocol body into a workflow script. The triad agents
Read their own `templates/prompts/*-subagent.md` at spawn time. Edits here add the touchpoints
that READ the new flagged states (proven-by-adversary-only, uncited-external,
halted-but-no-re-examination) — they do not move protocol bodies into the orchestrator.

## Model-tier policy (M85) is single-source
Any new stage's `model:` literal MUST match `bin/gsd-t-model-tier-policy.cjs`. The blind
adversary runs on `fable` (Red-Team-on-fable precedent). The tier-policy lint
(`test/m90-tier-policy-lint.test.js`) must FAIL on a drifted literal (mandatory negative test).

## §6 guard map → verify checklist (traceability)
Every [RULE] in the §6 guard map traces to a concrete enforcement point and a verify-checklist
assertion (`test/m90-guardmap-rule-traceability.test.js`). The guard map is the menu the Red
Team attacks — an unenforced [RULE] is a FAIL.

## Fail-closed, not advisory ([[feedback_no_silent_degradation]])
§4 fail-closed = the gate FAILS (never warns-and-proceeds) on uncited external claim,
unresolved proven-by-adversary-only, or halted-but-no-re-examination. The CLAUDE-global
Research Policy goes from advisory prose ("if in doubt, skip") to the binding doctrine.

## Document Ripple Completion Gate (MANDATORY — full blast radius in ONE pass)
Command-file/capability change ripples to ALL of: `templates/CLAUDE-global.md` + live
`~/.claude/CLAUDE.md` must match; `commands/gsd-t-help.md`; `README.md`; `GSD-T-README.md`;
`docs/requirements.md`; `package.json` version. Do not report done with a partial subset.

## Destructive Action Guard
Absorbing `auto-research-contract.md` into the new doctrine contract: leave a
superseded/absorbed pointer in the old contract (do not silently delete a STABLE contract
other modules cite); update its consumers' references in the same pass.

## File discipline
Touch ONLY scope.md § Files Owned. Editing any Wave-1/2-owned module is a DISJOINTNESS
VIOLATION.
