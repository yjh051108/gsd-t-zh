# Domain Tasks: m90-d-arch-trigger-response (M90-D1)

> Shape D — `### Mxx-Dx-Tx`, each task carries `**Files**`, `**Touches**`, `**Test**`,
> `**Acceptance criteria**`, `**Dependencies**`, `**Contract**`. Validate at end of plan
> with `gsd-t parallel --dry-run` + `gsd-t traceability-gate --milestone M90`.
> **Domain code = D1** (parser-canonical `M90-D1-Tn`; the partition's `DA` letter form was
> renamed to satisfy the task-graph regex `^###\s+[A-Z]\d+-D\d+-T\d+`, which a letter-after-D
> form silently failed to match — 0 tasks read).

## Files Owned
- `bin/gsd-t-architectural-trigger.cjs`
- `templates/prompts/blind-adversary-subagent.md`
- `test/m90-architectural-trigger.test.js`
- `test/fixtures/m90-arch-divergence-corpus.json`
- `test/fixtures/m90-arch-heldout-divergence.json` — held-out divergence split (independently-labeled from saga records; D1-T6 path (a))

## Contract
`.gsd-t/contracts/m90-doctrine-mechanisms-contract.md` §2 — produces the architectural
trigger + response envelope D-CONTRACT (D4) wires at integrate. FREEZE the exported
signature when Wave 1 closes. House style §0: `{ ok:true, ... }` / `{ ok:false, error }`,
deterministic, bad input → non-zero exit, Node built-ins only, runtime-native bin brain.

## Wave 1 — prove-or-kill (parallel with m90-d-loop-ledger-halt = M90-D2; zero shared files)

### M90-D1-T1 — Divergence-sampling trigger core (R-ARCH-1)
Build `bin/gsd-t-architectural-trigger.cjs`: given N fresh-context answers to the SAME
approach question, compute a deterministic divergence measure and return the house-style
envelope naming the basis being challenged. Sourced from ClarifyGPT consistency-sampling
(https://arxiv.org/pdf/2310.10996) — divergence across samples ⇒ a load-bearing unproven
assumption exists. NO self-introspection / confidence signal (the locked finding: self-grading
is unreliable).
- **Files**: `bin/gsd-t-architectural-trigger.cjs`
- **Touches**: `bin/gsd-t-architectural-trigger.cjs`
- **Test**: `test/m90-architectural-trigger.test.js` — divergent corpus rows → `fired:true`; convergent rows → `fired:false`; same input → byte-identical envelope.
- **Acceptance criteria**:
  - Given N≥2 divergent fresh-context answers, returns `{ ok:true, fired:true, basis, reason }` naming the challenged basis.
  - Given N convergent answers, returns `{ ok:true, fired:false, ... }` — SILENT (no false-positive).
  - Identical input → byte-identical envelope (deterministic; no clock/random/order dependence).
  - Decision uses computed divergence ONLY — never a self-reported confidence field.
- **Dependencies**: none (first task of the module).

### M90-D1-T2 — Protocol-class trigger on extend-existing-code (R-ARCH-2)
Add the protocol-class fire path: extending existing code is ITSELF an approach decision →
trigger fires unconditionally (protocol, not confidence-gated — the target failure is
*confident* wrongness, so a confidence gate can't catch it). Distinct envelope `reason` from
the divergence path so D4's wiring + verify can tell the two firings apart.
- **Files**: `bin/gsd-t-architectural-trigger.cjs`
- **Touches**: `bin/gsd-t-architectural-trigger.cjs`
- **Test**: `test/m90-architectural-trigger.test.js` — extend-existing-code signal → `fired:true` with a `reason` DISTINCT from the divergence path's reason.
- **Acceptance criteria**:
  - An extend-existing-code input → `{ ok:true, fired:true, reason:"protocol-class:extend-existing", basis }`.
  - The protocol-class reason string is distinguishable from the R-ARCH-1 divergence reason.
  - Fires unconditionally for this class (no confidence/threshold gate on the protocol path).
- **Dependencies**: M90-D1-T1.

### M90-D1-T3 — Response interface: blind-adversary + spike fallback (R-ARCH-3..6)
Define (INTERFACE ONLY — no `agent()` wiring; that is D4's integrate seam) the response modes
the resolver returns: `spike` PREFERRED with forced fallback to `adversary-only`; spike-fails
→ STOP (R-ARCH-4); spike-infeasible → logged skip + adversary MANDATORY (R-ARCH-5);
proven-by-adversary-only → a flag surfaced for verify (R-ARCH-6). Author
`templates/prompts/blind-adversary-subagent.md` (separate context/model = `fable`; framed
"find the fatal flaw in someone ELSE's design" to escape self-preference bias —
https://arxiv.org/abs/2310.08118 + https://arxiv.org/abs/2404.13076; extends M83 pre-mortem +
Red-Team-on-fable).
- **Files**: `bin/gsd-t-architectural-trigger.cjs`, `templates/prompts/blind-adversary-subagent.md`
- **Touches**: `bin/gsd-t-architectural-trigger.cjs`, `templates/prompts/blind-adversary-subagent.md`
- **Test**: `test/m90-architectural-trigger.test.js` — resolver returns `mode:"spike"` by default; `spikeFeasible:false` → `mode:"adversary-only"` + `adversaryMandatory:true`; spike-fail path returns a STOP directive; `provenByAdversaryOnly:true` exposes the verify flag.
- **Acceptance criteria**:
  - Resolver returns `mode:"spike"` as the PREFERRED response.
  - Spike-infeasible input → `mode:"adversary-only"` with `adversaryMandatory:true` + a logged skip reason (never silent).
  - Spike-fail input → a STOP directive in the envelope (R-ARCH-4); the agent cannot proceed.
  - `provenByAdversaryOnly:true` surfaces a flag the §4 fail-closed gate reads at verify (R-ARCH-6).
  - `blind-adversary-subagent.md` declares the `fable` model + separate-context framing.
- **Dependencies**: M90-D1-T2.

### M90-D1-T4 — Measurement-sink instrumentation (no-claim invariant)
Emit fire-rate + catch-quality to a measurement sink (a JSONL/structured emit, not a claim).
The module NEVER asserts it works — it emits data only (the architectural-detection trigger is
the one EXPERIMENTAL piece with no published validation; measured, not claimed — per the
sourced-approach Honest Limits).
- **Files**: `bin/gsd-t-architectural-trigger.cjs`
- **Touches**: `bin/gsd-t-architectural-trigger.cjs`
- **Test**: `test/m90-architectural-trigger.test.js` — a fire emits an instrumentation record (fired/basis/mode); asserts NO field in the envelope claims efficacy (no `works:true`/`reliable` key).
- **Acceptance criteria**:
  - Every fire emits a structured instrumentation record (fire-rate + catch-quality fields).
  - The envelope carries NO self-efficacy claim — instrumentation is data-only.
  - Emission is deterministic given identical input (no wall-clock in the asserted shape).
- **Dependencies**: M90-D1-T3.

### M90-D1-T5 — CLI subcommand + stable resolver export
Expose a CLI subcommand signature + `module.exports` resolver D4 will wire at integrate. Bad
input (empty / whitespace / non-string / malformed) → `{ ok:false, error }` + non-zero CLI
exit. This is the FROZEN signature §2 pins — do not change after Wave 1 closes.
- **Files**: `bin/gsd-t-architectural-trigger.cjs`
- **Touches**: `bin/gsd-t-architectural-trigger.cjs`
- **Test**: `test/m90-architectural-trigger.test.js` — `module.exports` shape asserted; CLI bad-input → `{ok:false}` + non-zero exit code.
- **Acceptance criteria**:
  - `module.exports` exposes the resolver returning the trigger envelope + response-mode flags.
  - CLI subcommand parses args and prints the JSON envelope.
  - Bad input → `{ ok:false, error }` + non-zero exit (never silent, per §0 house style).
  - The exported signature matches §2 of the mechanisms contract verbatim.
- **Dependencies**: M90-D1-T4.

### M90-D1-T6 — The killing test (R1 prove-or-kill) [Headline]
**Headline:** true
`test/m90-architectural-trigger.test.js` drives the fixture corpus
(`test/fixtures/m90-arch-divergence-corpus.json`) and is the milestone's HIGHEST-RISK gate:
it asserts the trigger FIRES deterministically on divergent fresh-context answers, stays
SILENT on convergent ones, the extend-existing-code path fires, and bad input →
`{ ok:false }`. If the trigger CANNOT fire deterministically (divergent→fire, convergent→
silent, repeatably), this test FAILS and the milestone HALTS for R1 re-scope DOWN to
factual-only (D3 then carries M90). The trigger is wired into workflows (D4-T4) ONLY after
this test is GREEN.
**HELD-OUT REAL-CASE SPLIT — with a NAMED ground-truth source (pre-mortem HIGH ×2: tautology trap +
no-divergence-dataset-on-disk).** The fixture is authored by THIS domain, so a test asserting
"every self-labeled divergent row fires" is a tautology. The corpus MUST include a HELD-OUT split
NOT used to tune the threshold. **But the DIVERGENCE class has no ready ground-truth fixture on
disk** — the binvoice retro fixture (`templates/test-fixtures/retro/binvoice-692fe9fc-kat.json`) is
a symptom-CLUSTERING case for the loop-ledger (D2), NOT a fresh-context-answer-DIVERGENCE case for
this trigger; the M87/M89 loop sagas are recorded as prose, not as N-fresh-context-answer sets.
So D1-T6 MUST do ONE of:
  **(a)** AUTHOR a real held-out divergence fixture `test/fixtures/m90-arch-heldout-divergence.json`
  (owned by THIS domain) — ≥3 divergent + ≥3 convergent rows, each row = N recorded fresh-context
  approach-answers to ONE approach question, with an INDEPENDENT divergence label derived from the
  saga record (e.g. binvoice's 7 conflicting fix-approaches = divergent; a case where all N agree =
  convergent). The label's derivation rule is documented in the fixture `_comment`, not back-fit to
  the threshold; OR
  **(b)** if a falsifiable held-out divergence set genuinely CANNOT be constructed from the saga
  records, the prove-or-kill exit DEFAULTS to **R1 re-scope DOWN to factual-only** — the milestone
  does NOT ship a tautological green for the architectural slice. This default is the doctrine's
  fail-toward-honesty: an unprovable detector is treated as unproven.
Mirror the M89 corpus's generalization guard ("passes the tuned set, FAILS the held-out set" = FAILURE).
- **Files**: `test/m90-architectural-trigger.test.js`, `test/fixtures/m90-arch-divergence-corpus.json`, `test/fixtures/m90-arch-heldout-divergence.json`, `bin/gsd-t-architectural-trigger.cjs`
- **Touches**: `test/m90-architectural-trigger.test.js`, `test/fixtures/m90-arch-divergence-corpus.json`, `test/fixtures/m90-arch-heldout-divergence.json`
- **Test**: `test/m90-architectural-trigger.test.js` (node --test) — the killing test IS this file; ≥6 tuned fixture cases (≥3 divergent → fire, ≥3 convergent → silent) PLUS the NAMED held-out divergence split from `m90-arch-heldout-divergence.json` (independently-labeled, derivation documented in the fixture, NOT threshold-tuned) PLUS the extend path + bad input. A held-out miss = test FAILURE. If path (b) is taken (no falsifiable held-out set), the test instead asserts the R1-re-scope-DOWN exit-state deterministically. Run: `node --test test/m90-architectural-trigger.test.js`.
- **Acceptance criteria**: (SC-ARCH-TRIGGER)
  - Every tuned divergent corpus row fires; every tuned convergent row stays silent — deterministically across repeated runs.
  - The held-out divergence split has a NAMED, on-disk, independently-labeled source (`test/fixtures/m90-arch-heldout-divergence.json`, derivation documented in `_comment`); the trigger classifies it correctly WITHOUT the rows being used to tune the threshold; a held-out miss FAILS the test. **OR** path (b): the fixture cannot be falsifiably constructed → the test asserts the deterministic R1-re-scope-DOWN exit-state (factual-only), and the architectural slice does NOT ship.
  - The divergence MEASURE is a fixed, documented formula and the threshold is a declared constant (not back-fit per-fixture).
  - The extend-existing-code path fires (R-ARCH-2 demonstrated on a seeded case from the three-saga retros).
  - Bad input → `{ ok:false }` + non-zero exit.
  - RED here (incl. a held-out generalization failure or an unconstructable held-out set) = HALT for R1 re-scope DOWN (the prove-or-kill exit; architectural DETECTION has no published precedent).
- **Dependencies**: M90-D1-T5.

## Dependency / gating
- T1→T6 build the SAME module — write in order; no parallel intra-domain split.
- **Gates the milestone:** M90-D1-T6 is prove-or-kill. RED → HALT (do NOT fund Wave 3 wiring of this trigger; re-scope per R1).
- File-disjoint from m90-d-loop-ledger-halt (M90-D2) — zero shared files → fully concurrent in Wave 1.
- D4 (m90-d-contract-doctrine-integrate) consumes the FROZEN M90-D1-T5 signature at integrate; this domain must not change it after Wave 1.
