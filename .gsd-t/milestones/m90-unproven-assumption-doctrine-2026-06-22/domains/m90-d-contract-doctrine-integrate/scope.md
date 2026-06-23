# Domain Scope: m90-d-contract-doctrine-integrate

## Milestone
M90 — The Unproven-Assumption Doctrine

## Wave
**Wave 3** (LAST). The single-owner integrate seam — nothing here is parallel-written.
This domain owning ALL shared surfaces is exactly what keeps Waves 1–2 file-disjoint.

## Mission
Wire the three proven bin modules (D-FACTUAL classifier, D-ARCH trigger, D-LOOP ledger)
into the workflow seams, author the doctrine contract that ABSORBS
`auto-research-contract.md` v1.3.3 and pins the envelope shapes for all three mechanisms,
implement §4 fail-closed + §5 self-obedience + §6 guard map, and ripple every downstream
doc. Sole writer of every shared / integrate-time surface.

## Files Owned (this domain WRITES these — no other domain may)
**Contracts**
- `.gsd-t/contracts/unproven-assumption-doctrine-contract.md` — NEW, absorbs auto-research v1.3.3, pins all 3 envelope shapes
- `.gsd-t/contracts/auto-research-contract.md` — absorbed/superseded note + envelope pin

**Workflow seams (agent()-Bash inline helper wiring)**
- `templates/workflows/gsd-t-debug.workflow.js` — wire D-LOOP halt
- `templates/workflows/gsd-t-execute.workflow.js`
- `templates/workflows/gsd-t-phase.workflow.js` — wire D-ARCH trigger + D-FACTUAL classify
- `templates/workflows/gsd-t-quick.workflow.js`
- `templates/workflows/gsd-t-verify.workflow.js` — read the flagged states (proven-by-adversary-only, uncited-external, halted-but-no-re-examination)

**Dispatch + tier policy**
- `bin/gsd-t.js` — dispatch cases + PROJECT_BIN_TOOLS entries for the 2 new modules
- `bin/gsd-t-model-tier-policy.cjs` — tier entry for the blind-adversary stage (`fable`) if a new stage label is introduced (single source of truth; M85)

**Triad prompts (integrate-time touchpoints reading new flagged states)**
- `templates/prompts/red-team-subagent.md`
- `templates/prompts/qa-subagent.md`
- `templates/prompts/pre-mortem-subagent.md`

**Doc ripple**
- `templates/CLAUDE-global.md` — replace Research Policy prose with the doctrine
- `docs/requirements.md` — M90 requirement entry
- `commands/gsd-t-help.md` — command/capability surface
- `README.md` — commands table / capability (project Pre-Commit Gate: command interface changed)
- `GSD-T-README.md` — same ripple (project Pre-Commit Gate)
- `package.json` — version bump from the CURRENT on-disk version (4.6.12, NOT the stale 4.6.11 literal) → 4.7.10 (read live at execute)

**Verify-checklist + lints (salvaged, non-overlapping)**
- `test/m90-guardmap-rule-traceability.test.js` — traces each §6 [RULE] to its enforcement (the Red Team menu)
- `test/m90-tier-policy-lint.test.js` — proves new stages' `model:` literals match `bin/gsd-t-model-tier-policy.cjs`

- `.gsd-t/domains/m90-d-contract-doctrine-integrate/{scope,constraints,tasks}.md`

## NOT Owned (Wave-1/2 modules — read their stable signatures, never edit)
- `bin/gsd-t-architectural-trigger.cjs`, `templates/prompts/blind-adversary-subagent.md`, `test/m90-architectural-trigger.test.js`, `test/fixtures/m90-arch-divergence-corpus.json` — m90-d-arch-trigger-response
- `bin/gsd-t-loop-ledger.cjs`, `test/m90-loop-ledger-halt.test.js` — m90-d-loop-ledger-halt
- `bin/gsd-t-research-gate.cjs`, `test/m89-research-classifier-corpus.test.js`, `test/fixtures/m89-labeled-corpus.json` — m90-d-factual-redesign

## Deliverables (the doctrine spine)
- **§4 fail-closed (R-FAIL-1/2/3)** — verify FAILS on: uncited external claim (R-FACT-4), proven-by-adversary-only un-resolved (R-ARCH-6), halted-but-no-re-examination (R-LOOP-3 / D-LOOP's exposed state).
- **§5 self-obedience (R-SELF-1)** — the doctrine binds GSD-T's own workflows; M90's own thrash falsifier documented.
- **§6 guard map** — the [RULE]→enforcement matrix the Red Team attacks; traced by the verify checklist test.
- The doctrine contract pinning the JSON envelope shapes of all three mechanisms.
- Tier-policy entries (in `bin/gsd-t-model-tier-policy.cjs` via the policy edit) for any new stage; the blind adversary runs on `fable`.

## Dependency
Depends on the STABLE signatures Waves 1–2 expose. Wires last, in one pass, so no parallel
domain writes a shared surface.
