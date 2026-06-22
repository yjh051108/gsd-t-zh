# Domain Tasks: m90-d-loop-ledger-halt (M90-D2)

> Shape D — `### Mxx-Dx-Tx`, each task carries `**Files**`, `**Touches**`, `**Test**`,
> `**Acceptance criteria**`, `**Dependencies**`, `**Contract**`. Validate at end of plan with
> `gsd-t parallel --dry-run` + `gsd-t traceability-gate --milestone M90`.
> **Domain code = D2** (parser-canonical `M90-D2-Tn`; partition's `DL` letter form renamed to
> satisfy the task-graph regex).

## Files Owned
- `bin/gsd-t-loop-ledger.cjs`
- `test/m90-loop-ledger-halt.test.js`

## Contract
`.gsd-t/contracts/m90-doctrine-mechanisms-contract.md` §3 — produces the loop-ledger
append-cycle + halt envelope D4 wires into the debug workflow seam at integrate. FREEZE the
exported signature when Wave 1 closes. House style §0 applies. Sourced from SWE-Search
low-reward abandonment (https://arxiv.org/abs/2410.20285); GSD-T's ">2 cycles = halt" is ahead
of published SOTA — kept here as a deterministic ESCALATION trigger (low false-positive cost),
NOT a confident "the architecture is wrong" classifier.

## Wave 1 — prove-or-kill (parallel with m90-d-arch-trigger-response = M90-D1; zero shared files)

### M90-D2-T1 — Computed symptom-signature
Build `bin/gsd-t-loop-ledger.cjs`: compute a DETERMINISTIC signature key from the failing
assertion / surface / file-class — NOT the agent's prose label (the locked finding: the agent
cannot reliably self-report that it is looping). Identical failure surface → identical key.
- **Files**: `bin/gsd-t-loop-ledger.cjs`
- **Touches**: `bin/gsd-t-loop-ledger.cjs`
- **Test**: `test/m90-loop-ledger-halt.test.js` — two inputs describing the same failing assertion/surface → identical signature key; a different surface → a different key; key is independent of any prose-label field.
- **Acceptance criteria**:
  - Signature is computed from failing-assertion / surface / file-class inputs only.
  - Identical failure surface → byte-identical signature key (deterministic).
  - The agent's free-text/prose label does NOT influence the key.
- **Dependencies**: none (first task of the module).

### M90-D2-T2 — Append-cycle ledger (R-LOOP-1)
Append a cycle each call keyed by computed signature. A fix that closes signature A but OPENS
signature B still increments — variant-spawning IS the pathology, not progress (the binvoice
whack-a-mole signature).
- **Files**: `bin/gsd-t-loop-ledger.cjs`
- **Touches**: `bin/gsd-t-loop-ledger.cjs`
- **Test**: `test/m90-loop-ledger-halt.test.js` — appending a signature-B-opening cycle after a signature-A cycle still increments the ledger count (asserts variant-spawn counts as a loop cycle, not as resolution).
- **Acceptance criteria**:
  - Each append-cycle call records a cycle keyed by computed signature.
  - A fix closing signature A but opening signature B STILL increments the loop count (R-LOOP-1).
  - The returned ledger fact reflects the updated count deterministically.
- **Dependencies**: M90-D2-T1.

### M90-D2-T3 — Hard-halt exit-state (R-LOOP-2) [Headline]
**Headline:** true
On the 3rd cycle of the SAME computed signature, the ledger exit-state HARD-HALTS the patch
path. The halt is a RETURNED LEDGER FACT — the agent cannot dispatch another variant, and the
halt is NEVER narration (the documented binvoice/M87/M89 failure: "I'll stop after this one" =
no halt). This is the SC-LOOP-HOOK-FIRES capability and is verified by ledger/exit-state, not
by agent prose.
- **Files**: `bin/gsd-t-loop-ledger.cjs`, `test/m90-loop-ledger-halt.test.js`
- **Touches**: `bin/gsd-t-loop-ledger.cjs`
- **Test**: `test/m90-loop-ledger-halt.test.js` (node --test) — drive 3 same-signature cycles → assert the returned exit-state is HARD-HALT (`halted:true` / non-zero halt code) and the 3rd-variant dispatch is blocked from the ledger fact, deterministically. Run: `node --test test/m90-loop-ledger-halt.test.js`.
- **Acceptance criteria**: (SC-LOOP-HOOK-FIRES)
  - The 3rd cycle on the SAME computed signature returns a HARD-HALT exit-state.
  - The halt is a returned ledger fact (deterministic), NOT dependent on any agent prose.
  - A run that would dispatch a 3rd same-signature variant is blocked by the exit-state.
  - 1st and 2nd cycles do NOT halt (no premature firing).
- **Dependencies**: M90-D2-T2.

### M90-D2-T4 — Premise-re-examination directive (R-LOOP-3) + fail-closed state (R-FAIL-3)
On halt, emit a premise-re-examination directive routing to the architectural hook (§2 / D1).
Expose a `halted-but-no-re-examination` state for D4's §4 fail-closed gate to read (the partial
R-FAIL-3 surface this domain owns).
- **Files**: `bin/gsd-t-loop-ledger.cjs`
- **Touches**: `bin/gsd-t-loop-ledger.cjs`
- **Test**: `test/m90-loop-ledger-halt.test.js` — on halt the envelope carries a premise-re-examination directive routing to the architectural hook; `halted-but-no-re-examination` state is exposed and readable via read-exit-state until resolved.
- **Acceptance criteria**:
  - On halt, the envelope emits a premise-re-examination directive routing to §2 (D1 architectural hook).
  - A `halted-but-no-re-examination` state is exposed for the §4 fail-closed gate (R-FAIL-3 partial).
  - The state clears only when re-examination is recorded — never silently.
- **Dependencies**: M90-D2-T3.

### M90-D2-T5 — CLI subcommand + stable export
CLI subcommand + `module.exports`: append-cycle (returns updated ledger fact + halt decision),
read-exit-state. Bad input → `{ ok:false, error }` + non-zero exit. FREEZE the signature after
Wave 1 for D4 to wire into the debug workflow seam.
- **Files**: `bin/gsd-t-loop-ledger.cjs`
- **Touches**: `bin/gsd-t-loop-ledger.cjs`
- **Test**: `test/m90-loop-ledger-halt.test.js` — `module.exports` shape (append-cycle + read-exit-state) asserted; CLI bad-input → `{ok:false}` + non-zero exit.
- **Acceptance criteria**:
  - `module.exports` exposes append-cycle (→ ledger fact + halt decision) and read-exit-state.
  - CLI subcommand parses args and prints the JSON envelope.
  - Bad input → `{ ok:false, error }` + non-zero exit.
  - The exported signature matches §3 of the mechanisms contract verbatim.
- **Dependencies**: M90-D2-T4.

### M90-D2-T6 — The killing test (must FIRE not narrate) [Headline]
**Headline:** true
`test/m90-loop-ledger-halt.test.js`: drive 3 same-signature cycles → assert HARD-HALT
exit-state fires DETERMINISTICALLY; assert a signature-B-opening fix still increments
(R-LOOP-1); assert the premise-re-examination directive is emitted on halt (R-LOOP-3); assert
`halted-but-no-re-examination` is exposed (R-FAIL-3); bad input → `{ ok:false }`. RED = a
non-converging halt that doesn't fire = a DESIGN DEFECT → STOP + escalate (do NOT keep
patching — the known non-converging-Red-Team trap).
- **Files**: `test/m90-loop-ledger-halt.test.js`, `bin/gsd-t-loop-ledger.cjs`
- **Touches**: `test/m90-loop-ledger-halt.test.js`
- **Test**: `test/m90-loop-ledger-halt.test.js` (node --test) — the killing test IS this file; exercises the ledger end-to-end (3-cycle halt + variant-B increment + directive + fail-closed state + bad input). Run: `node --test test/m90-loop-ledger-halt.test.js`.
- **Acceptance criteria**: (SC-LOOP-HOOK-FIRES, end-to-end)
  - 3 same-signature cycles → HARD-HALT exit-state fires deterministically (verified by exit-state, NOT prose).
  - A signature-B-opening fix still increments (R-LOOP-1).
  - The premise-re-examination directive is emitted on halt (R-LOOP-3).
  - `halted-but-no-re-examination` is exposed for the fail-closed gate (R-FAIL-3 partial).
  - Bad input → `{ ok:false }` + non-zero exit.
- **Dependencies**: M90-D2-T5.

## Dependency / gating
- T1→T6 build the SAME module — write in order; no intra-domain parallel split.
- **Gates the milestone:** M90-D2-T6 is prove-or-kill. RED → escalate (non-converging halt that won't fire = design defect; do not keep patching).
- File-disjoint from m90-d-arch-trigger-response (M90-D1) — zero shared files → fully concurrent in Wave 1.
- D4 (m90-d-contract-doctrine-integrate) consumes the FROZEN M90-D2-T5 signature at integrate.
