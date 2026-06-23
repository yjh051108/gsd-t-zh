# Domain Scope: m90-d-loop-ledger-halt

## Milestone
M90 — The Unproven-Assumption Doctrine

## Wave
**Wave 1** (parallel with m90-d-arch-trigger-response — zero shared files). **HIGH RISK —
must FIRE, not narrate.**

## Mission
Build the §3 **non-convergence hook** — a NET-NEW standalone **ledger module** keyed by a
COMPUTED symptom-signature, that HARD-HALTS the patch path from a ledger fact (never from
the agent saying it noticed). The entire "must FIRE not narrate" uncertainty is contained
in this one bin module + its test, so a failure to fire deterministically is isolated here.

This domain ships ONLY the module + its killing test. It does **NOT** edit
`gsd-t-debug.workflow.js` or any other workflow — that wiring is the D-CONTRACT integrate
seam. It exposes a stable signature D-CONTRACT consumes.

Pairs with backlog #33 (debug circuit-breaker — the loop-halt teeth R3 borrows).

## Files Owned (this domain WRITES these — no other domain may)
- `bin/gsd-t-loop-ledger.cjs` — NET-NEW ledger module (distinct from any existing debug ledger; computes signature + halt as a separate concern)
- `test/m90-loop-ledger-halt.test.js` — the killing test
- `.gsd-t/domains/m90-d-loop-ledger-halt/{scope,constraints,tasks}.md`

## NOT Owned (other domains / integrate seam)
- `bin/gsd-t-architectural-trigger.cjs` — m90-d-arch-trigger-response
- `bin/gsd-t-research-gate.cjs` — m90-d-factual-redesign
- `templates/workflows/gsd-t-debug.workflow.js` + ALL other workflows — m90-d-contract-doctrine-integrate (integrate seam)
- `bin/gsd-t.js` dispatch + PROJECT_BIN_TOOLS — m90-d-contract-doctrine-integrate

## Deliverables
1. A ledger keyed by a **COMPUTED symptom-signature** (failing assertion / surface /
   file-class — computed, NOT the agent's prose label), appended each cycle.
2. **R-LOOP-1** — a fix that closes signature A but opens signature B still counts as a loop
   cycle (variant-spawning IS the pathology; the signature-B-opening fix still increments).
3. **R-LOOP-2** — the 3rd cycle on the SAME computed signature HARD-HALTS the patch path
   from the ledger/exit-state. The agent MAY NOT dispatch another variant — the halt is a
   ledger fact, never narration.
4. **R-LOOP-3** — on halt, emit a premise-re-examination directive routing to the
   architectural hook (D-ARCH).
5. **R-FAIL-3 (partial)** — expose a `halted-but-no-re-examination` state for the
   fail-closed gate (D-CONTRACT) to read.

## Stable interface exposed to D-CONTRACT
- A CLI subcommand + `module.exports` for: append-cycle (returns updated ledger fact +
  halt decision), read exit-state. D-CONTRACT wires the halt into the debug workflow seam
  at integrate. Freeze the signature after Wave 1.
