# Contract: Unproven-Assumption Doctrine (M90)

## Version: 1.0.0
## Status: STABLE
## Owner: m90-d-contract-doctrine-integrate (sole writer of all shared seams)
## Absorbs: auto-research-contract.md v1.3.3 (see §ABSORBED pointer below)
## Producers: m90-d-arch-trigger-response (§2), m90-d-loop-ledger-halt (§3), m90-d-factual-redesign (§1)
## Consumers: m90-d-contract-doctrine-integrate (workflow + verify wiring)
## Created: 2026-06-22 (M90 integrate)

## Purpose

M90 makes "never act on an unproven assumption — FACTUAL or ARCHITECTURAL" a governed,
enforced doctrine replacing the advisory `Research Policy` prose in `templates/CLAUDE-global.md`.
The three mechanism modules (classifier, trigger, ledger) are wired into the workflow seams by
this contract's §4 fail-closed gate, §5 self-obedience binding, and §6 guard map. The doctrine
applies to GSD-T's own workflows (§5 self-obedience).

---

## §ABSORBED — auto-research-contract.md v1.3.3

`auto-research-contract.md` v1.3.3 is absorbed and superseded by this contract. The §1 classifier
envelope shape, §2 research stage interface, §3 Verified-Facts cited-block format, §4 idempotency,
§5 no-silent-guess gate, §6.5 Stated-Claims DETECT seam, and §7 ENFORCE marker from
`auto-research-contract.md` are all PRESERVED verbatim as §1 of this contract (the factual
classifier / R-FACT mechanism). The auto-research-contract.md file carries a pointer to this
document as the canonical home. Consumer references should point here.

---

## §1 — Factual Classifier (D3: m90-d-factual-redesign)

The factual classifier is the M89 / M90 R4 slice. Full specification is inherited verbatim from
`auto-research-contract.md` v1.3.3 §§1–7. Key envelope shapes pinned here for the integrate seam:

### §1.1 Classifier envelope (FROZEN — D3 produces, D4 wires)

```json
{
  "ok": true,
  "gap": "<the guessed claim text>",
  "class": "internal" | "external" | "ambiguous",
  "route": "grep" | "web" | "judge",
  "reason": "<one-line deterministic rationale>"
}
```

On bad input: `{ "ok": false, "error": "<reason>" }` + non-zero CLI exit.

- **`internal` (route `grep`)** — ONLY on a STRING-FACT this-repo signal (concrete repo path /
  file shape / real `gsd-t-*` tool name, or an explicit this-repo anchor phrase). These are
  string facts, not beliefs.
- **`external` (route `web`)** — ONLY on an UNAMBIGUOUS vendor proper-noun (multi-char,
  non-homograph) co-occurring with an API/protocol term.
- **`ambiguous` (route `judge`)** — EVERYTHING ELSE. No string fact → LLM judge (model:"fable")
  → internal/external/uncertain. Uncertain → research (never guess-internal).

**FINAL decision rule (v1.3.3):** `internal` is returned ONLY when there is ZERO strong-external
signal. `hasStrongExternal` = unambiguous vendor proper-noun AND an API/protocol term.
- `hasStrongExternal` → result is NEVER `internal`. Co-occurring path/anchor → `ambiguous`;
  else → `external`.
- No strong external: concrete repo path OR this-repo anchor → `internal`; else → `ambiguous`.

**M90 invariants (R-FACT-1..4):**
- **R-FACT-1 (NO-FINITE-LIST):** The INTERNAL decision enumerates NO open category — `internal`
  is asserted ONLY on a concrete own-repo path/anchor (a closed, knowable set), NEVER on the
  absence of a vendor. A known-answer test feeds ≥10 unseen vendors; each routes judge/research,
  NONE silently-internal.
- **R-FACT-2 (VENDOR-LIST-KEPT):** The vendor list is KEPT as an `external→web` upgrade heuristic
  (deleting it is a pure regression — proven empirically: 10/10 unseen vendors → `ambiguous→judge`
  without it, so the delete was falsified as a "silent-miss fix"). Changed/tightened ONLY if a
  concrete misroute defect is proven by the T0 baseline.
- **R-FACT-3 (TIME-ANCHORED):** A claim about a fast-moving lib/API/version or containing
  "current/latest best practice" → research REGARDLESS of confidence (stale-but-confident facts
  are the temporal-collapse class; CoVe arXiv:2309.11495, Self-RAG arXiv:2310.11511).
- **R-FACT-4 (§7 ENFORCE gate — FAIL-CLOSED):** An artifact carrying ANY
  `<!-- auto-research-claim: class=external key=<key> status=uncited -->` marker → verify FAILS.
  An absent-but-reported marker path → deterministic fallback artifact ensures the gate always has
  something to fail on (never silent).

### §1.2 ENFORCE marker format (§7, FROZEN)

```html
<!-- auto-research-claim: class=external key=<normalized-claim-key> status=uncited -->
```

Lifecycle: written `status=uncited` at classify time; flipped to `status=cited` when the matching
`## Verified Facts (auto-research)` block (§3) lands. The verify gate FAILs on any `status=uncited`.

### §1.3 Verified-Facts cited-block format (§3, FROZEN)

```markdown
## Verified Facts (auto-research)

- **<fact statement>** — source: <https://exact.url/path> (fetched YYYY-MM-DD) key: <claim-key>
```

Every fact line MUST carry a `source:` URL AND a `(fetched YYYY-MM-DD)` date. An uncited fact
FAILS. Every fact line SHOULD carry the `key: <claim-key>` trailer (per-key match over count
fallback).

---

## §2 — Architectural Trigger + Response (D1: m90-d-arch-trigger-response)

**Module:** `bin/gsd-t-architectural-trigger.cjs`

### §2.1 Trigger envelope (FROZEN — D1 produces, D4 wires)

```json
{
  "ok": true,
  "fired": true | false,
  "basis": "<the architectural assumption being challenged>",
  "reason": "<one-line rationale — divergence-sampling:high-variance | protocol-class:extend-existing>"
}
```

On bad input: `{ "ok": false, "error": "<reason>" }` + non-zero CLI exit.

**TWO fire paths (R-ARCH-1 and R-ARCH-2):**

- **R-ARCH-1 (divergence sampling — EXPERIMENTAL+MEASURED, competition-arm-only):** Given N≥2
  fresh-context answers to the same approach question, computes normalized type-token ratio variance
  across answer n-gram fingerprints. When divergence exceeds DIVERGENCE_THRESHOLD (0.80), fires
  with reason `"divergence-sampling:high-variance"`. Sourced from ClarifyGPT consistency-sampling
  (arXiv:2310.10996). **EXPERIMENTAL:** Self-MoA (one model, temperature-varied) may not diverge
  like fresh-context saga cases the threshold was tuned on. Fire-rate is instrumented; the path
  never claims it works — it emits data only.
- **R-ARCH-2 (protocol class — unconditional, everywhere feed):** Extending existing code is itself
  an approach decision — the trigger fires unconditionally on an extend signal. Signal format:
  `{ type: "extend-existing-code", context, basis }`. Signal is COMPUTED at runtime from task/scope
  inputs that already exist (a task whose `**Touches**` lists an EXISTING file → extend-class).
  Reason literal: `"protocol-class:extend-existing"`.

**Signal producers (NAMED — reachability is contract, not test-seeded):**
- R-ARCH-2 extend-vs-greenfield signal: computed from the task/scope brief at invoke time by D4-T4
  in `gsd-t-execute.workflow.js` / `gsd-t-quick.workflow.js` / `gsd-t-phase.workflow.js`. A task
  whose `**Touches**` lists an EXISTING file (verifiable via `ls` at runtime) is extend-class.
  D4-T4 computes this and proves it fires in a real run with NO seeded injection.
- R-ARCH-1 divergence signal: the phase competition arm's actual N producer outputs
  (`competition:N>1`). Wired competition-arm-ONLY; dormant by default.

### §2.2 Response interface (R-ARCH-3..6)

- **mode `spike` (PREFERRED):** attempt an executable spike to prove feasibility of the approach.
- **mode `adversary-only` (FALLBACK):** when spike is infeasible or fails.
- **R-ARCH-4:** spike fails → STOP directive in envelope; agent cannot proceed without re-examination.
- **R-ARCH-5:** spike infeasible → logged skip + adversary MANDATORY.
- **R-ARCH-6:** premise proven-by-adversary-only → `proven-by-adversary-only` flag in the envelope,
  surfaced to the verify gate (R-FAIL-2).

**Protocol prompt:** `templates/prompts/blind-adversary-subagent.md` — separate context/model
(`fable`; M85 policy).

**Prove-or-kill gate (R1-EXIT):** if the trigger cannot fire deterministically (divergent→fire,
convergent→silent), the milestone halts for R1 re-scope DOWN to factual-only. The trigger is wired
into workflows ONLY after its killing test (D1-T6) is GREEN. When R1 re-scopes DOWN:
- D4-T4 wires ONLY the factual classifier (NOT the architectural trigger).
- The `proven-by-adversary-only` flag is never produced → R-FAIL-2 read is a documented
  no-op-PASS (de-scoped note: "mechanism absent by design").
- The documented R-FAIL-2 no-op-PASS is DISTINGUISHABLE from a wired-but-broken vacuous pass
  (the de-scoped note appears in this contract; verify checks for the note, not just passes).

**Instrumentation:** every fire emits a JSONL record to
`.gsd-t/metrics/arch-trigger-events.jsonl`. NEVER self-asserts efficacy — emits data only.

---

## §3 — Loop Ledger + Halt (D2: m90-d-loop-ledger-halt)

**Module:** `bin/gsd-t-loop-ledger.cjs`

### §3.1 Ledger envelope (FROZEN — D2 produces, D4 wires)

**append-cycle input:** `{ assertion:string, surface:string, fileClass:string }`
**append-cycle output:**
```json
{
  "ok": true,
  "signature": "<sha256-hex>",
  "cycles": "<count-for-this-signature>",
  "halted": true,
  "reExaminationPending": true,
  "directive": {
    "action": "PREMISE_RE_EXAMINATION",
    "route": "architectural-hook",
    "module": "bin/gsd-t-architectural-trigger.cjs",
    "contract": ".gsd-t/contracts/m90-doctrine-mechanisms-contract.md §2",
    "reason": "<human-readable halt reason>"
  }
}
```

When `halted` is false: `directive` is `null`. When `halted` is true: `directive` is the object above.

On bad input: `{ "ok": false, "error": "<reason>" }` + non-zero CLI exit.

**read-exit-state output:**
```json
{
  "ok": true,
  "haltedSignatures": ["<sha256-hex>", "..."],
  "reExaminationPending": true,
  "haltedButNoReExamination": true
}
```

The `haltedButNoReExamination` field is the §4 fail-closed predicate read by the verify workflow.

**Invariants (R-LOOP-1..3):**
- **R-LOOP-1:** a fix that closes signature A but opens signature B still increments (variant-spawning
  IS the pathology — the ledger tracks computed signatures, not agent-prose labels).
- **R-LOOP-2:** 3rd cycle on the SAME computed signature HARD-HALTS the patch path (halt is a
  returned ledger fact, never narration).
- **R-LOOP-3:** on halt, emit a premise-re-examination directive routing to §2 (the architectural
  hook). The `reExaminationPending` flag is set `true`.
- **R-FAIL-3:** exposes `haltedButNoReExamination` for the §4 fail-closed gate.

### §3.2 Cycle-bound contradiction resolution (LOCKED — option b, recorded here)

`gsd-t-debug.workflow.js` runs `for (let cycle = 1; cycle <= 2; cycle++)` — a naive 3rd-cycle halt
would be DEAD CODE. **RESOLVED (option b — locked at plan, recorded per pre-mortem CRITICAL x2):**
Re-anchor the halt to the CYCLE-2 BOUNDARY. When the ledger shows the SAME computed
symptom-signature across both cycles (i.e., the same signature appears >=2 times in the ledger by
the end of cycle 2), the workflow exits at the cycle-2 boundary with the ledger's
**premise-re-examination directive** (not the generic `needs-human`). This keeps the existing
2-cycle cap unchanged and only changes the EXIT REASON when the ledger proves non-convergence.

**Option (a) REJECTED:** raising the loop bound risks unbounded per-cycle M89-research-loop
multiplication and changes the debug cost envelope. Never retry; re-examine.

---

## §4 — Fail-Closed Integration Points (D4: m90-d-contract-doctrine-integrate)

`gsd-t-verify.workflow.js` FAILS (never warns-and-proceeds) when ANY of the following is true:

- **R-FAIL-1 (uncited external claim):** An artifact contains
  `<!-- auto-research-claim: ... status=uncited -->` (§1 marker, R-FACT-4).
- **R-FAIL-2 (unresolved proven-by-adversary-only premise):** The architectural trigger emitted a
  `proven-by-adversary-only` flag that has not been resolved (§2 envelope, R-ARCH-6).
  **R1-de-scoped-DOWN exception:** when the arch trigger is NOT wired (R1 exits, factual-only mode),
  R-FAIL-2 is a DOCUMENTED no-op-PASS — the check passes with a recorded "mechanism absent by
  design" note. This is DISTINGUISHABLE from a wired-but-broken vacuous pass.
- **R-FAIL-3 (halted-but-no-re-examination):** The loop ledger's `haltedButNoReExamination` field
  is `true` (§3 state, R-LOOP-3).
  **R1-de-scoped-DOWN exception (if loop-ledger halt de-scoped):** same pattern — documented
  no-op-PASS with a "mechanism absent by design" note.

**The check FAILS** only when the mechanism IS wired AND emits an unresolved flag. It **PASSES**
(with a de-scoped note) when the mechanism is absent by design. It NEVER vacuously passes on a
wired-but-broken check.

---

## §5 — Self-Obedience (R-SELF-1)

The doctrine binds GSD-T's own workflows. M90's own build MUST show:

1. **DISCUSS produced a sourced approach** — `.gsd-t/discuss/M90-approach-sourced.md` exists with
   at least 1 external citation per detection mechanism.
2. **Pseudocode behavior-map was signed off** — `.gsd-t/pseudocode/M90-pseudocode-signedoff.md`
   exists and is marked signed off before any code was written.
3. **Premises re-verified on disk** — M90 D3-T0 re-verified on disk that the vendor-list
   silent-miss premise was FALSE (the vendor list does NOT cause silent-internal on unseen vendors);
   recorded in the contract and D3 tasks.
4. **No >2-cycle same-signature thrash without premise re-examination** — M90's own plan-hardening
   ran 3 rounds (round-1/2/3 pre-mortem entries in progress.md Decision Log, each tagged
   `[PLAN-HARDENING][pre-mortem ... -> fixed]`). Each round re-examined the premise rather than
   patching a variant. The Decision Log artifacts serve as the self-obedience build record.
5. **The doctrine was applied to itself (meta)** — M90's own plan-hardening loops are the
   self-obedience proof, documented in progress.md Decision Log.

The self-obedience gate (test/m90-guardmap-rule-traceability.test.js) asserts the Decision Log
artifacts exist and are structured — a STRUCTURAL gate, not prose.

---

## §6 — Guard Map ([RULE] to Enforcement)

Each [RULE] below maps to a real enforcement point. An orphan rule (no enforcement point) FAILS
`test/m90-guardmap-rule-traceability.test.js`.

| [RULE] | Enforcement | Notes |
|--------|-------------|-------|
| [RULE-FACT-1] No-finite-list: internal ONLY on closed knowable set | `bin/gsd-t-research-gate.cjs` classifier logic | Asserted by D3-T0/T1/T5 corpus tests |
| [RULE-FACT-4] §7 fail-closed: uncited external → verify FAILS | `gsd-t-verify.workflow.js` Auto-Research Gate phase | R-FAIL-1 path |
| [RULE-ARCH-2] Extend-existing-code signal COMPUTED from task/scope at runtime | `gsd-t-execute.workflow.js`, `gsd-t-quick.workflow.js`, `gsd-t-phase.workflow.js` extend-signal compute | D4-T4 prove-reachability test |
| [RULE-ARCH-6] proven-by-adversary-only flag → surfaced to verify | `gsd-t-verify.workflow.js` M90 R-FAIL-2 gate | R-FAIL-2 path (or de-scoped no-op) |
| [RULE-LOOP-2] 3rd same-signature → HARD-HALT patch path | `bin/gsd-t-loop-ledger.cjs` appendCycle HALT_THRESHOLD | D2-T3/T6 test (killing test) |
| [RULE-LOOP-3] On halt, emit premise-re-examination directive | `bin/gsd-t-loop-ledger.cjs` appendCycle directive field | D2-T6 test |
| [RULE-LOOP-DEBUG-OPT-B] Halt re-anchored to cycle-2 boundary in debug workflow | `gsd-t-debug.workflow.js` cycle-2 ledger check (D4-T3) | Option (b) decision locked |
| [RULE-FAIL-1] Verify FAILS on uncited external claim | `gsd-t-verify.workflow.js` Auto-Research Gate | M89 §7 ENFORCE gate |
| [RULE-FAIL-2] Verify FAILS on unresolved proven-by-adversary-only (when wired) | `gsd-t-verify.workflow.js` M90 R-FAIL-2 gate | De-scoped to no-op-PASS when not wired |
| [RULE-FAIL-3] Verify FAILS on halted-but-no-re-examination (when wired) | `gsd-t-verify.workflow.js` M90 R-FAIL-3 gate | De-scoped to no-op-PASS when not wired |
| [RULE-SELF-1] Doctrine binds GSD-T's own workflows | Decision Log plan-hardening entries (progress.md) + test/m90-guardmap-rule-traceability.test.js self-obedience assertion | Structural gate, not prose |
| [RULE-ARCH-TIER] Blind adversary runs on fable (M85 policy) | `bin/gsd-t-model-tier-policy.cjs` + `templates/prompts/blind-adversary-subagent.md` model annotation | Drift-enforced by m90-tier-policy-lint.test.js |

---

## Wiring Seam Ownership (Disjointness Keystone)

| Surface | Sole Writer |
|---------|-------------|
| `bin/gsd-t-research-gate.cjs` + classifier tests + corpus fixtures | m90-d-factual-redesign |
| `bin/gsd-t-architectural-trigger.cjs` + blind-adversary prompt + trigger tests + divergence corpus | m90-d-arch-trigger-response |
| `bin/gsd-t-loop-ledger.cjs` + ledger tests | m90-d-loop-ledger-halt |
| ALL `templates/workflows/*.workflow.js`, `bin/gsd-t.js`, triad prompts, contracts, docs, `package.json` | m90-d-contract-doctrine-integrate |

Producers FREEZE their exported signatures when Wave 1/2 closes. D-CONTRACT wires against the
frozen signatures. A producer changing its signature after freeze is a contract violation.

---

## House Style (all three mechanisms)

- JSON envelope: `{ ok: true, ... }` on success, `{ ok: false, error }` on bad input.
- Deterministic: identical input → byte-identical envelope.
- Bad input (empty / whitespace / non-string / malformed) → `{ ok:false }` + non-zero CLI exit. Never silent.
- Node built-ins only; zero new runtime deps; sync APIs.
- Runtime-native: each is a `bin/*.cjs` brain invoked by workflows via an `agent()`-Bash inline
  runCli helper. NONE is `require()`d inside a `*.workflow.js`.
