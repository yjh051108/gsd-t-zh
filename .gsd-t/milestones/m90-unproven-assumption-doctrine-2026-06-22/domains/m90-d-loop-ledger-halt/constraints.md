# Domain Constraints: m90-d-loop-ledger-halt

## The "must FIRE, not narrate" invariant (NON-NEGOTIABLE)
The halt is a **ledger FACT** read from the exit-state — NEVER the agent saying "I notice
I'm looping." Prompt-based blocking does not work ([[feedback_deterministic_orchestration]];
[[feedback_coverage_check_structural_not_substring]]). The killing test drives 3
same-signature cycles and asserts a HARD-HALT exit-state fires DETERMINISTICALLY (and that
a signature-B-opening fix still increments). If the halt cannot fire deterministically from
the ledger, this is a design defect — HALT and escalate (a non-converging halt mechanism is
the exact pathology the milestone fixes).

## Signature is COMPUTED, not labeled
The symptom-signature is derived from the failing assertion / surface / file-class — a
computed key, NOT the agent's prose description of the bug. Two cycles "feel different" to
the agent but share a computed signature → same signature → counts toward the 3-cycle halt.
This is the M89/M87/binvoice lesson: the agent's self-assessment of "is this the same bug?"
is itself a guess.

## Traced requirements
- **R-LOOP-1** — signature-A-closed/signature-B-opened fix still counts as a cycle (variant-spawning IS the pathology).
- **R-LOOP-2** — 3rd same-signature cycle HARD-HALTS the patch path from the ledger/exit-state.
- **R-LOOP-3** — on halt, emit premise-re-examination directive routing to the architectural hook (D-ARCH).
- **R-FAIL-3 (partial)** — expose `halted-but-no-re-examination` state for the fail-closed gate (D-CONTRACT completes the BLOCK).

## Hard rules (inherit repo invariants)
- **Zero new runtime deps** — Node built-ins only; sync file APIs.
- **House-style JSON envelope** — `{ ok:true, ... }` / `{ ok:false, error }`; non-zero CLI exit on error; never throw on input.
- **Deterministic** — identical cycle history → byte-identical exit-state + halt decision.
- **Runtime-native (M81/TD-113)** — `bin/*.cjs` brain invoked by the debug workflow via an `agent()`-Bash inline helper. MUST NOT be `require()`d inside any `*.workflow.js`. Do NOT touch `gsd-t-debug.workflow.js` (D-CONTRACT integrate seam).
- **Distinct from any existing debug ledger** — this is a NET-NEW module computing the signature + halt as a separate concern; it does not edit a pre-existing ledger file.

## Self-obedience (R-SELF-1)
M90's own >2-cycle thrash is the falsifier: if THIS module's development needs >2 fix cycles
on the same computed signature, that is the doctrine firing on the milestone itself — stop
and re-examine the premise, do not spawn a third variant.

## File discipline
Touch ONLY the files in scope.md § Files Owned. Any workflow / `bin/gsd-t.js` / contract
edit is a DISJOINTNESS VIOLATION (D-CONTRACT's).
