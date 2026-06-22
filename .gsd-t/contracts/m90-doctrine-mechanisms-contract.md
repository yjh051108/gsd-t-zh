# Contract: M90 Unproven-Assumption Doctrine — Cross-Domain Mechanism Interfaces

## Version: 1.0.0
## Status: PROPOSED (firms to STABLE when Wave-1 prove-or-kill clears)
## Owner: m90-d-contract-doctrine-integrate (sole writer of all shared seams)
## Producers: m90-d-arch-trigger-response, m90-d-loop-ledger-halt, m90-d-factual-redesign
## Consumers: m90-d-contract-doctrine-integrate (workflow + verify wiring)
## Created: 2026-06-22 (M90 partition)

## Purpose
Pins the STABLE signatures the three mechanism domains expose so the integrate domain
(D-CONTRACT) can wire them into the workflow seams WITHOUT any Wave-1/2 domain touching a
shared file. This is the file-disjointness keystone: producers ship modules + tests only;
the consumer wires at integrate time. The full doctrine spine (§4/§5/§6) lands in
`unproven-assumption-doctrine-contract.md` (written by D-CONTRACT at integrate).

## House style (all three mechanisms)
- JSON envelope: `{ ok: true, ... }` on success, `{ ok: false, error }` on bad input.
- Deterministic: identical input → byte-identical envelope.
- Bad input (empty / whitespace / non-string / malformed) → `{ ok:false }` + non-zero CLI exit. Never silent.
- Node built-ins only; zero new runtime deps; sync APIs.
- Runtime-native: each is a `bin/*.cjs` brain invoked by workflows via an `agent()`-Bash inline runCli helper. NONE is `require()`d inside a `*.workflow.js`.

---

## §1 — Factual classifier (m90-d-factual-redesign)
**Module:** `bin/gsd-t-research-gate.cjs` — `module.exports = { classify }`
**Signature:** `classify(gap: string) -> { ok:true, gap, class:"internal"|"external"|"ambiguous", route:"grep"|"web"|"judge", reason } | { ok:false, error }`
**Redesign invariants (M90 — premise-corrected 2026-06-22, pre-mortem CRITICAL #1, verified on disk):**
- The **INTERNAL decision** enumerates NO open category: `internal` is asserted ONLY on a concrete
  own-repo path/anchor (a closed, knowable set) — NEVER on the mere absence of a vendor. (Already
  true on disk at `bin/gsd-t-research-gate.cjs:211-262`; M90 asserts + tests it, does not introduce it.)
- The vendor list is **KEPT** as an external→web *upgrade* heuristic (a vendor proper-noun + API
  term → high-confidence `external`, skipping the judge). It does NOT cause a silent-miss: a bare
  out-of-list vendor with no internal signal already routes `ambiguous→judge` ("never guess-internal"),
  verified empirically (10/10 unseen vendors → judge). DELETING it would DOWNGRADE known vendors
  `external→web` ⇒ `ambiguous→judge` — a pure regression that also turns held-out rows HO-E1/E2/E5
  RED. Change/tighten it ONLY if D3-T0's baseline proves a concrete misroute defect.
- not-confidently-internal → `ambiguous` → judge → external/uncertain → research+cite.
- Time-anchored override: fast-moving lib/API/version OR "current/latest best practice" → research regardless of confidence.
- §7 fail-closed cite gate PRESERVED: an external claim left uncited → verify FAILS (R-FACT-4).
**Verify reads:** the uncited-external-claim marker (R-FAIL → §4 fail-closed).

## §2 — Architectural trigger + response (m90-d-arch-trigger-response)
**Module:** `bin/gsd-t-architectural-trigger.cjs`
**Trigger signature:** given N fresh-context answers (R-ARCH-1 divergence sampling) OR an
extend-existing-code signal (R-ARCH-2), returns `{ ok:true, fired:boolean, basis, reason }`
naming the basis being challenged. Deterministic.
**Signal PRODUCERS (named — reachability is contract, not test-seeded; pre-mortem round-3 CRITICAL):**
- R-ARCH-2 extend-vs-greenfield signal = COMPUTED at runtime from the task/scope inputs that
  already exist: a task whose `**Touches**` lists an EXISTING file (vs. a net-new path), or a
  domain editing an existing module, is extend-class. This is the **everywhere** feed (execute/quick/
  non-competition phase); D4-T4 computes it from the brief/task inputs and proves it fires from the
  COMPUTED signal in a real run with NO seeded injection.
- R-ARCH-1 divergence signal = the phase **competition arm's** actual N producer outputs
  (`competition:N>1`). Wired competition-arm-ONLY; dormant by default. **EXPERIMENTAL + MEASURED:**
  competition is Self-MoA (one model, temperature-varied) and may not diverge like the fresh-context
  saga cases the threshold was tuned on — if the real feed can't exercise the divergence formula,
  that mismatch is RECORDED and the path stays experimental (instrumented fire-rate, never a silent
  claim it works), never proven by a seeded stand-in.
**Response interface (contract-only here; agent() wiring is D-CONTRACT):**
- mode `spike` PREFERRED → forced fallback to `adversary-only`.
- R-ARCH-4: spike fails → STOP.
- R-ARCH-5: spike infeasible → logged skip + adversary MANDATORY.
- R-ARCH-6: premise proven-by-adversary-only → a flag surfaced for verify.
**Protocol prompt:** `templates/prompts/blind-adversary-subagent.md` — separate context/model
(`fable`); extends M83 pre-mortem + Red-Team-on-fable.
**Instrumentation:** fire-rate + catch-quality to a measurement sink; NEVER claims it works.
**Verify reads:** the `proven-by-adversary-only` flag (R-FAIL → §4 fail-closed).
**Prove-or-kill:** if the trigger cannot fire deterministically (divergent→fire,
convergent→silent), the milestone HALTS for R1 re-scope DOWN to factual-only. The trigger is
wired into workflows ONLY after its killing test is GREEN.

## §3 — Loop ledger + halt (m90-d-loop-ledger-halt)
**Module:** `bin/gsd-t-loop-ledger.cjs`
**Signature (frozen exports):** `{ computeSignature, appendCycle, readExitState, recordReExamination, markReExaminationRequired }`.
- `appendCycle({assertion, surface, fileClass, projectDir, milestone})` keyed by a COMPUTED symptom-signature (computed, NOT the agent's prose label); tags the signature with `milestone`; returns the updated ledger fact + halt decision.
- `readExitState(projectDir, { milestone })` returns `{ ok, haltedSignatures:string[], pendingSignatures:string[], reExaminationPending:boolean, haltedButNoReExamination:boolean }`. **Milestone-scoped (M90 verify decision A):** when `milestone` is given, only halts tagged with THAT milestone (or untagged — fail-safe) are in scope, so one milestone's stale halt CANNOT brick another milestone's verify. Omitting `milestone` reads all (legacy).
- `recordReExamination(signature, projectDir)` — a GENUINE re-examination; FULLY resets that signature (cycles+halted+pending+milestone-tag). Per-signature only; blanket clear refused.
- `markReExaminationRequired({signature, projectDir, milestone})` — PERSISTS an unresolved halt (sets halted+pending, tagged with `milestone`) when the debug workflow detects RUN-LOCAL non-convergence. Detection sets; only `recordReExamination` clears.
**Invariants:**
- R-LOOP-1: variant-spawning IS the pathology — the loop signature is keyed on the STABLE SYMPTOM (`assertion`) + a coarse `fileClass` bucket, NOT the file being edited (`surface`). A fix that chases the SAME symptom while editing a DIFFERENT file each cycle (the binvoice whack-a-mole) shares one signature and ACCUMULATES toward the halt. (Keying on `surface` gave each variant a distinct cycles=1 signature so the halt never fired — Red Team HIGH, M90 verify; corrected.)
- R-LOOP-2: the SAME computed signature recurring HARD-HALTS the patch path from the ledger fact (never narration) — via the global 3rd-cycle threshold OR the debug workflow's run-local cycle-2-boundary detection (`markReExaminationRequired`).
- R-LOOP-3: on halt, emit a premise-re-examination directive routing to §2 (the architectural hook).
- R-FAIL-3: exposes a `halted-but-no-re-examination` state for the §4 fail-closed gate. **DETECTION ≠ RESOLUTION (M90 verify decision, 2026-06-22):** the debug workflow MARKS the halt and LEAVES IT SET — it does NOT auto-clear on detection (that made the gate vacuous). The state clears ONLY via a genuine `recordReExamination`. Permanent-brick risk is bounded on THREE axes: run-local counting (cross-RUN), gitignored transient state (cross-PROJECT), and per-milestone halt tagging + milestone-scoped verify reads (cross-MILESTONE — M90 verify decision A, 2026-06-22). The verify FAIL message names the exact signature(s) + the one-line `record-re-examination` clear command, so an unresolved halt is always RECOVERABLE, never a cryptic count.
**Verify reads:** the `halted-but-no-re-examination` state (R-FAIL → §4 fail-closed).

---

## §4 — Fail-closed integration points (D-CONTRACT owns at integrate)
`gsd-t-verify.workflow.js` FAILS (never warns-and-proceeds) when ANY of:
- an external claim is uncited (§1 marker, R-FACT-4 / R-FAIL-1),
- a premise is proven-by-adversary-only and unresolved (§2 flag, R-ARCH-6 / R-FAIL-2),
- the loop ledger is halted-but-no-re-examination (§3 state, R-LOOP-3 / R-FAIL-3).

## Wiring seam ownership (disjointness keystone)
| Surface | Sole writer |
|---|---|
| `bin/gsd-t-research-gate.cjs`, `test/m89-research-classifier-corpus.test.js`, `test/fixtures/m89-labeled-corpus.json`, `test/fixtures/m89-heldout-corpus.json` | m90-d-factual-redesign |
| `bin/gsd-t-architectural-trigger.cjs` + blind-adversary prompt + `test/m90-architectural-trigger.test.js` + `test/fixtures/m90-arch-divergence-corpus.json` + `test/fixtures/m90-arch-heldout-divergence.json` | m90-d-arch-trigger-response |
| `bin/gsd-t-loop-ledger.cjs` | m90-d-loop-ledger-halt |
| ALL `templates/workflows/*.workflow.js`, `bin/gsd-t.js`, triad prompts, contracts, docs, package.json | m90-d-contract-doctrine-integrate |

## Stability rule
Producers FREEZE their exported signatures when Wave 1/2 closes. D-CONTRACT wires against
the frozen signatures. A producer changing its signature after freeze breaks the integrate
seam and is a contract violation.
