# Integration Points

## Current State: M89 — Auto-Research: deterministic external-info-gap resolution at every workflow phase (PLANNED — risk-first, 4 file-disjoint domains, 2 waves; Wave 1 = D1 prove-or-kill A1 classifier + D2 contract/stage concurrent; Wave 2 = D3 upper-phase+verify + D4 worker-workflows, gated on A1 GREEN). M87 PAUSED for M89 (user-prioritized 2026-06-18). M89 active.

### M89 Seam contract
`.gsd-t/contracts/auto-research-contract.md` v1.1.0 STABLE — the SINGLE seam between the classifier (D1) and the wiring domains (D3/D4): §1 classifier JSON envelope (§1.1 FEATURE-CLASS heuristic — finding #1), §2 research `agent()` stage interface, §3 Verified-Facts cite-block format, §4 idempotency rule (§4.1 exact normalized-gap-key "covers" — finding #2), §5 no-silent-guess gate semantics (§5 A3 routing-decision wording + sole-web-stage enforcement — finding #5; §5.1 ambiguous→internal-first→grep→escalate owned by D3/D4 — finding #3), §6 the 13-item labeled-corpus oracle + HELD-OUT generalization corpus (A1). **v1.1.0 (2026-06-18) — plan-phase pre-mortem fixes findings #1/#2/#3/#5 (Changelog in the contract).** D1 PRODUCES the classifier matching §1; D3/D4 CONSUME the envelope SHAPE + stage interface inline, never D1's internals. D2 OWNS every shared doc-ripple surface (CLAUDE-global.md, bin/gsd-t.js, commands/gsd-t-help.md, package.json) — integrate-conflict-free by construction.

**Plan-hardening correction (M89 plan):** §2's model form was `overrides["research"] ?? "<literal>"` — this FAILS the live M85 lint (`test/m85-workflow-tier-policy-lint.test.js`): the `??`-form bracket key must be one of the 6 injectable designated stages, and `research` is not one (no `research` key in `bin/gsd-t-model-tier-policy.cjs`). **Corrected to a BARE literal `model: "fable"`** (passes the lint's tier-set membership check; mirrors how non-designated stages already declare models, e.g. `gsd-t-execute.workflow.js:172`). D2-T1 records the §2 correction; D3-T1/D4-T1/D4-T2 wire the bare-`fable` literal.

### M89 Wave Plan (risk-first — prove-or-kill before wiring)

```
WAVE 1 — D1 (prove-or-kill, LOAD-BEARING) + D2 (contract/stage/doc-ripple), CONCURRENT + file-disjoint:
  D1 research-classifier-core          D2 research-stage-and-contract
    bin/gsd-t-research-gate.cjs           auto-research-contract.md (the seam) v1.1.0
    + 13-item labeled corpus              + templates/prompts/research-subagent.md
    + HELD-OUT corpus (finding #1)        + cite-format + idempotency test
                                          (incl. negative: distinct gap-key
    + A1 killing test (M89-D1-T3:          ≠ skip — finding #2)
      seen+held-out+bad-input)
                                          + SHARED doc-ripple (CLAUDE-global, gsd-t.js, help, package.json)
        │
        ▼  KILL GATE: A1 (M89-D1-T3) MUST pass — every one of the 13 SEEN +
        │  ≥6 HELD-OUT hand-labels matched deterministically by FEATURE CLASS
        │  (finding #1: a keyword-memorized classifier fails the held-out set) +
        │  bad-input boundary (finding #6). A mislabel FAILS → HALT M89 + re-scope.
        │  Wave 1 touches ONLY net-new files + D2's single-owned shared surfaces —
        │  if A1 fails, NO workflow file is contaminated (none edited yet).
        │
WAVE 2 — D3 + D4, file-disjoint (one-domain-per-workflow-file), START ONLY AFTER A1 GREEN:
      ├──────────────────────────────────┬────────────────────────────────────┐
      ▼                                   ▼
  D3 wiring-upper-phase-and-gate      D4 wiring-worker-workflows
    gsd-t-phase.workflow.js             gsd-t-{execute,quick,debug}.workflow.js
    (6 eligible stages +                (research stage; wave = composer-only, NO model:)
     ambiguous-escalate §5.1)           + A3 routing-decision test (internal gap) +
    gsd-t-verify.workflow.js             sole-web-stage enforcement (finding #5)
    (A4 no-silent-guess)                + ambiguous-escalate §5.1 (finding #3)
    + phase-research-wiring test        + runtime state-change proof (D4-T4, finding #7)
    + E2E dogfood test (D3-T4,
      finding #4 — classify→research-
      stub→cite→A4-PASS, offline)
    + runtime state-change (D3-T5,
      finding #7)

  D3/D4 are write-disjoint (6 workflow files split 2/4, zero overlap) + depend on A1 only,
  not each other. Both CONSUME the D1 classifier + D2 contract inline.

                GATE: A1 passed + both wave-2 domains complete
                              │
                              ▼
       INTEGRATE (D2 single-owned shared surfaces already merged) → VERIFY → COMPLETE-MILESTONE
       patch bump (D2-T5) → tag
```

### M89 Wave Groupings

| Wave | Domains | Parallel? | Gate to next |
|------|---------|-----------|--------------|
| **W1** | D1 research-classifier-core (T1–T4, + held-out fixture) · D2 research-stage-and-contract (T1–T5) | concurrent, file-disjoint (D1 = net-new bin+test+2 fixtures incl. held-out; D2 = contract v1.1.0+prompt+test+shared doc-ripple) | **A1 (M89-D1-T3) GREEN** — all 13 SEEN + ≥6 HELD-OUT hand-labels matched deterministically (feature-class generalization, finding #1) + bad-input boundary (finding #6). A1 fails → HALT + re-scope. |
| **W2** | D3 wiring-upper-phase-and-gate (T1–T5, incl. E2E dogfood T4 + runtime state-change T5) · D4 wiring-worker-workflows (T1–T4, incl. runtime state-change T4) | concurrent, write-disjoint (D3 = phase+verify+e2e; D4 = execute/debug/quick/wave) — both depend on A1 only | both wave-2 domains complete + the E2E dogfood test green + M71 + M85 lints green (incl. wave-zero-`model:` + debug-cycle-ternary). |

### M89 Integrate-Time Seams (D2 single-owned — NOT cross-domain co-authored)

| Seam | File | Owner | Why no conflict |
|------|------|-------|-----------------|
| Research Policy replacement | `templates/CLAUDE-global.md` | D2 (M89-D2-T4) | D2 is the SOLE writer; D3/D4 must not touch it. |
| CLI dispatch + `PROJECT_BIN_TOOLS` | `bin/gsd-t.js` | D2 (M89-D2-T4) | single-owner; routes to D1's `gsd-t-research-gate.cjs` (which must exist first — dep on M89-D1-T2). |
| help line | `commands/gsd-t-help.md` | D2 (M89-D2-T4) | single-owner. |
| version bump | `package.json` | D2 (M89-D2-T5) | single-owner of the manifest for M89. |

### M89 Cross-Domain Dependencies

| Consumer | Depends on | Via |
|----------|-----------|-----|
| D2-T4 dispatch | D1-T2 `bin/gsd-t-research-gate.cjs` exists | dispatch routes to the module |
| D3 (all) | D1 A1 GREEN (gate) + D1 classifier + D2 §1.1/§2/§3/§4.1/§5.1 + D2 `research-subagent.md` | inline `runCli` + Read-at-spawn prompt; D3 owns the ambiguous→grep→escalate step (§5.1) + the E2E dogfood test |
| D4 (all) | D1 A1 GREEN (gate) + D1 classifier + D2 §1.1/§2/§3/§4.1/§5/§5.1 + D2 `research-subagent.md` | inline `runCli` + Read-at-spawn prompt; D4 owns the ambiguous→grep→escalate step (§5.1) + the sole-web-stage A3 enforcement |

---

## Prior State: M87 — Intention-First PseudoCode as Milestone Source-of-Truth (PLANNED + RE-SCOPED — risk-first, 4 file-disjoint domains, 2 waves; Wave 1 = prove-or-kill A1; Wave 2 gated on A1; M83 traceability-gate PASSES all 4 domains, 0 violations). **Cycle-4 split (2026-06-17):** the deterministic core stays in M87 (A1 guard-bridge gate, A2 section-coverage + the folded gate-scoping fix, A4 ripple drift lint, A6 regression bar + A7 derived-id stability); the soft-AC halves that resist deterministic gating moved to **M88** (backlog #35): A3 deterministic sign-off STATE/gate, the A1 map-GENERATION path, the A5 triad-consumption seam (M87-INT-T1 — descoped), and the SC4 divergence-grammar round-trip. D3 still ships the two-altitude FLOW + keep-or-supersede PROMPT here.

### Seam contract
`.gsd-t/contracts/pseudocode-source-of-truth-contract.md` v1.1.5 STABLE — the SINGLE source of all grammars (guard-map §2, section-citation §3, divergence §4, ripple-points §5, **discovery convention §7**). Authored at partition (D4-T0); §2 reconciled to the real binvoice corpus across the plan-phase pre-mortem fix (v1.1.0 dual grammar) and the re-plan re-validation (v1.1.1: hard count = 13, non-anchored inline marker); §3 reconciled (v1.1.2: citable-section source = `##` headings outside Appendix fences, PayPal=10/Extension=10 floor, deterministic GitHub-style slug §3.2, D2 non-vacuity floor + citation-resolution §3.3; §6/A5 wired to task M87-INT-T1). v1.1.4 records the M87/M88 split: §4 (divergence parse/format round-trip) and §6 (A5 triad-consumption seam) are annotated **M88** (their deterministic obligation moved); the GRAMMAR DEFINITIONS stay — they remain the spec. **v1.1.5 — post-split reachability/non-vacuity fixes (2 HIGH + 1 MED):** NEW **§7 discovery convention** (docs at `.gsd-t/pseudocode/PseudoCode-[Title].md` + co-located `.map.json`; verify globs `PseudoCode-*.md` multi-doc, FIREs on a doc+map pair, logs a skip-WITH-REASON otherwise — never silent) closes the dead-code class; **§2 clarification** — the gate keys on the DOC's derived id set (an absent map entry = unbacked → exit 4), no map-side vacuous pass. D1/D2/D3 consume it; no domain re-derives a grammar. A grammar change is a contract version bump + coordinated cross-domain edit.

### M87 Wave Plan (risk-first — prove-or-kill before scaffolding)

```
WAVE 1 — guard-bridge-spike ALONE (LOAD-BEARING, PROVE-OR-KILL):
  D1 guard-bridge-spike
      │  Proves A1: a prose [RULE] guard map → a deterministic verify gate where
      │  divergence is a non-vacuous FAILURE, ZERO LLM judgment in pass/fail.
      │  Builds NEW bin/gsd-t-guard-map.cjs (zero-dep, never-throws, pure;
      │  exits 0 backed / 4 divergence-RULE-ID-named / 64 bad-input),
      │  the A1 falsifiable harness (faithful exemplar → exit 0; doctored
      │  one-rule variant → exit non-zero, RULE-ID named — both deterministic),
      │  binvoice fixtures (PayPal faithful + doctored, Extension faithful),
      │  and wires the gate into gsd-t-verify.workflow.js (M71 sandbox-clean,
      │  M85 tier `haiku`, FAIL-blocking, BEFORE the triad) with §7 discovery
      │  (glob .gsd-t/pseudocode/PseudoCode-*.md + co-located .map.json).
      │  M87-D1-T5 is the FIRING/reachability test (gate fires + halts on a
      │  doctored map + logs a DISTINCT skip when absent) — closes the dead-code
      │  class; M87-D1-T3 adds map-side non-vacuity (absent map id = exit 4).
      │
      ▼  KILL GATE: M87-D1-T3 (A1) MUST pass. If A1 cannot be made
      │  deterministic → HALT the milestone + escalate for re-scope.
      │  Wave 1 touches ONLY new files + the one workflow it owns — if A1
      │  fails, NO existing brain is contaminated.
      │
WAVE 2 — three domains, file-disjoint, START ONLY AFTER A1 PASSES:
      ├──────────────────────┬──────────────────────────┐
      ▼                      ▼                          ▼
  D2 traceability-       D3 milestone-two-          D4 template-docripple-
     section-coverage       altitude-flow              contract
  EXTENDS M83            commands/gsd-t-milestone   templates/PseudoCode-spec.md
  bin/gsd-t-             .md + gsd-t-phase.work-    + doc-ripple ripple-set edit
  traceability-gate.cjs  flow.js milestone branch   (ripple point 3 of 4)
  (section-citation      ship the two-altitude      + A4 drift lint verifying
  coverage, struct/      FLOW + keep-or-supersede   ALL FOUR ripple points.
  path-as-path) + A2     PROMPT (PROSE/PROTOCOL).   Contract (D4-T0) already
  planted-gap test       Deterministic sign-off     on disk from partition.
  + FOLDED gate-scoping  GATE (A3) → M88.
  fix (--milestone M87   Wires D2's documented
  → exactly 4 domains)   altitude shift into the
  + scoping test.        solution-space probe.
  Owns the competition-
  altitude design note.

  D2/D3/D4 are write-disjoint (10 distinct owned files across the three; 18
  across all four domains incl. D1, zero overlap) and run concurrently once A1
  is green. None depends on the others' code:
    - D2 CONSUMES D1's gsd-t-guard-map.cjs JSON contract (never edits it).
    - D3 wires the altitude shift D2 only DOCUMENTS (in scope.md).
    - D4's contract is the seam all three already build against.

                GATE: A1 passed + all wave-2 domains complete
                              │
                              ▼
       INTEGRATE (serial seams) → VERIFY → COMPLETE-MILESTONE
       minor bump 4.6.11 → 4.7.10 → tag v4.7.10
```

### M87 Wave Groupings

| Wave | Domains | Parallel? | Gate to next |
|------|---------|-----------|--------------|
| **W1** | D1 guard-bridge-spike (T1–T5, incl. §7-discovery wiring + the firing/reachability test) | runs ALONE (no wave-2 domain starts) | **A1 (M87-D1-T3) PASSES** — faithful exit 0 / doctored exit non-zero, RULE-ID named, deterministic. A1 fails → HALT + re-scope. |
| **W2** | D2 (T2–T5, incl. gate-scoping fix) · D3 (T1–T4, FLOW/protocol only) · D4 (T1–T3) | all 3 concurrent (write-disjoint, all depend on A1 only, not each other) | all wave-2 tasks complete + the partition-time wave-1 contributions (D2-T1 design note, D4-T0 contract) on disk |

### M87 Integrate-Time Seams (NOT parallel-written — serial at integrate, no domain owns)

| Seam | File | Why serial | Owning AC |
|------|------|------------|-----------|
| Living Documents table | `templates/CLAUDE-global.md` (~line 60) | shared file (file-disjointness invariant) | A4 ripple point 1 |
| Pre-Commit Gate | `templates/CLAUDE-global.md` | shared file | A4 ripple point 2 |
| project Living Documents ref | `CLAUDE.md` | shared file, co-owned at merge with D4's lint | A4 ripple point 4 |
| ~~verify-triad consumption (**M87-INT-T1**)~~ **→ MOVED TO M88** (backlog #35) | `templates/prompts/qa-subagent.md`, `templates/prompts/red-team-subagent.md` | A5 (the [RULE]-set → QA/Red-Team frames seam) is DESCOPED from M87 to M88, where it is redesigned as a DETERMINISTIC seam-check (prompt-presence of the structured ingest directive + a unit test feeding guard-map JSON), not a live triad run. NOT wired in M87 integrate. | ~~A5~~ → M88 |
| CLI dispatch + **dual bin-propagation** (**M87-INT-T2** — no domain owns) | `bin/gsd-t.js` | (a) shared dispatch table — adds `guard-map` subcommand routing to D1's module; (b) **adds `gsd-t-guard-map.cjs` to BOTH `GLOBAL_BIN_TOOLS` (→ `~/.claude/bin/`) AND `PROJECT_BIN_TOOLS` (→ each registered project's `bin/`)** — like every peer verify gate. Without this the gate's `runCli` global fallback resolves to a binary never propagated, so it silently no-ops in downstream projects (the exact use case). **Killing test:** `test/m87-guard-map-propagation.test.js` — run `node bin/gsd-t.js install` with **HOME redirected to a sandbox tmp dir** (the non-destructive `test/m86-installer-statusline-ctxcue.test.js` pattern: `mkdtempSync(realpathSync(os.tmpdir()))` + `env:{...process.env,HOME:sandbox}`, never the real `~`), then assert `<sandbox>/.claude/bin/gsd-t-guard-map.cjs` exists+readable AND membership in BOTH arrays; removal from either FAILS (mirrors M54). Per `project_global_bin_propagation_gap`. | A1 wiring / reachability |
| verify command invoker | `commands/gsd-t-verify.md` | shared command file; reflects the new guard-map gate step | A1 (A5 triad-consumption descoped to M88) |

The A4 drift lint (D4-T3) VERIFIES ripple points 1/2/4 POST-integration; D4 WRITES only point 3 (doc-ripple command).

### M87 Cross-Domain Interfaces

| Producer | Consumer | Interface |
|----------|----------|-----------|
| D4 `pseudocode-source-of-truth-contract.md` v1.1.5 STABLE | D1/D2/D3 | The partition-time seam — guard-map §2, section-citation §3, divergence §4 (round-trip → M88), ripple §5, discovery §7; all code against the contract, never re-derive |
| D1 `bin/gsd-t-guard-map.cjs` (`--doc --map --json`, exit 0/4/64, build→rule map) | D2 (rule-aware paths); the A5 triad-consumption seam moved to M88 | JSON contract: `{ rules: { "<RULE-ID>": { backedBy:[...], contradicted:bool } } }`; consumers read the JSON, never edit D1 source. **Gate keys on the DOC's derived id set (§2): an absent map entry = unbacked → exit 4 (no map-side vacuous pass).** Verify discovery per §7 (`.gsd-t/pseudocode/PseudoCode-*.md` + co-located `.map.json`). M87 proves the gate's DISCRIMINATION + reachability through verify (M87-D1-T5); the map-GENERATION path is M88. |
| D2 extended `bin/gsd-t-traceability-gate.cjs` (`**PseudoCode-Section**: <Title>#<anchor>` parse, path-as-path; `--domains` explicit milestone-scoping) | plan phase | section-coverage gap report (zero-citing-task section = structural gap), additive over M83 AC→(path+test); `--milestone M87 --domains <4>` scopes to exactly the 4 subject-named domains, no fall-back-to-all |
| D2 scope.md competition-altitude design note | D3 `gsd-t-phase.workflow.js` (integrate-time) | the documented decision D3 wires: solution-space probe shifts UP to high-level-approach altitude when behavior is spec'd; gate stays altitude-agnostic |
| D3 `keep-or-supersede-subagent.md` | milestone flow | per inherited shipped-code model, ASK keep/supersede (prose PROTOCOL); each supersede WRITES a `⚠ Divergence` flag (§4 shape) into the doc. The deterministic `parseDivergence()`/`formatDivergence()` round-trip is M88. |
| D4 `templates/PseudoCode-spec.md` | every future milestone | the shipped blank mold (both altitudes + all five section elements, anchored to binvoice exemplars per SC6) |

### M87 File-Disjointness (validated via `gsd-t parallel --dry-run` — 20 distinct owned files, zero cross-domain overlap)

| Domain | Files Owned |
|--------|-------------|
| D1 guard-bridge-spike | `bin/gsd-t-guard-map.cjs`, `test/m87-guard-map-bridge.test.js`, `test/m87-verify-guardmap-wiring.test.js`, `test/fixtures/m87/PseudoCode-PayPal.md`, `test/fixtures/m87/PseudoCode-Extension.md`, `test/fixtures/m87/PseudoCode-PayPal-doctored.md`, `test/fixtures/m87/PseudoCode-PayPal.map.json`, `test/fixtures/m87/PseudoCode-PayPal-doctored.map.json`, `templates/workflows/gsd-t-verify.workflow.js` |
| D2 traceability-section-coverage | `bin/gsd-t-traceability-gate.cjs`, `test/m87-traceability-section-coverage.test.js`, `test/m87-gate-milestone-scoping.test.js` |
| D3 milestone-two-altitude-flow | `commands/gsd-t-milestone.md`, `templates/workflows/gsd-t-phase.workflow.js`, `templates/prompts/keep-or-supersede-subagent.md`, `test/m87-milestone-flow.test.js` |
| D4 template-docripple-contract | `templates/PseudoCode-spec.md`, `commands/gsd-t-doc-ripple.md`, `.gsd-t/contracts/pseudocode-source-of-truth-contract.md`, `test/m87-docripple-presence-lint.test.js` |

D1 owns `gsd-t-verify.workflow.js`; D3 owns `gsd-t-phase.workflow.js` — DIFFERENT workflow files, no shared workflow. No file appears in two Files-Owned blocks.

### M87 Acceptance-Criteria → Domain Map

| AC | Owner | Killing test |
|----|-------|--------------|
| **A1** (kill-criterion — gate DISCRIMINATION; map-GENERATION → M88) | D1 | M87-D1-T3 — faithful map exit 0 / doctored map exit non-zero, RULE-ID named, deterministic; **+ map-side non-vacuity: a map MISSING a doc-derived id (key absent) → exit 4 (doc-keyed iteration)** |
| **Verify-pipeline reachability** (gate FIRES + halts-on-divergence + distinct skip; closes the dead-code class) | D1 | M87-D1-T5 (`test/m87-verify-guardmap-wiring.test.js`) — **CONSTRUCTS its own multi-doc fixture tree** (≥2 fire-able doc+map pairs + doc-no-map + zero-docs, in a redirected temp dir; D1-T1 supplies only ONE fire pair so the multi-doc assertion can't be proven against it) → enumerates §7 doc+map set and FIREs on **ALL** pairs (count ≥2, non-vacuous), resolves `--doc`/`--map`, HALTS before triad on a doctored map, proceeds on faithful, logs a DISTINCT skip-with-reason (`no-build-map` / `no-pseudocode-docs`) when absent |
| A2 (section-coverage gap) | D2 | M87-D2-T3 — planted gap detected structurally; substring mention insufficient |
| A2 (gate-scoping — folded cycle-4 MEDIUM) | D2 | M87-D2-T5 (`test/m87-gate-milestone-scoping.test.js`) — `--milestone M87 --domains <4>` scopes to exactly the 4 M87 domains, zero historical; missing `--domains` + zero prefix-match → exit 64 |
| A4 (ripple-presence drift lint, 4 points) | D4 | M87-D4-T3 — passes when all four present, FAILS when any one removed |
| A6 (regression: suite green + M71 + M85 lints) | D1+D3 (workflow edits) | `test/m71-workflow-runtime-native-lint.test.js`, `test/m85-workflow-tier-policy-lint.test.js` stay green |
| A7 (derived-id stability — folded cycle-4 LOW) | D1 | M87-D1-T3 — faithful-map keyset GENERATED programmatically from the parser's derived ids == the keyset asserted; a re-copied fixture reflows doc ids + map keyset together |
| ~~A3~~ → **M88** (deterministic sign-off STATE/predicate) | — | descoped: no milestone-state artifact exists yet; M88 designs the marker + `isDefined(milestone)`. M87's D3 ships only the prose FLOW + PROMPT. |
| ~~A5~~ → **M88** (verify-triad consumption as a deterministic seam-check) | — | descoped: M88 reframes it as prompt-presence + a unit test feeding guard-map JSON (not a live triad run). |
| (SC4 deterministic half) → **M88** (`parseDivergence()`/`formatDivergence()` round-trip) | — | descoped: M88 builds the grammar round-trip; M87's D3 keeps the keep-or-supersede ASK + flag-writing as prose protocol. |

### M87 Load-Bearing Serial Constraints

1. **A1 before all of wave 2.** D1 runs ALONE; no wave-2 domain begins until M87-D1-T3 passes. A1 fails → HALT + escalate (no papering over — `feedback_coverage_check_structural_not_substring`).
2. **Coverage-check Red-Team convergence guard (D2).** If the Red Team on the section-coverage check does NOT converge in ≤2 cycles (each fix spawning a variant), that is a DESIGN DEFECT → STOP + escalate, do not keep patching (the known non-converging trap).
3. **Integrate seams serial, after wave 2.** `templates/CLAUDE-global.md` ×2, project `CLAUDE.md`, `bin/gsd-t.js` dispatch + dual bin-propagation (M87-INT-T2), `commands/gsd-t-verify.md` are wired serially at integrate — never parallel-written. The A4 lint then verifies all four ripple points post-merge. (The verify-triad-prompt seam M87-INT-T1/A5 moved to M88 — not wired in M87.)
4. **Workflow edits stay sandbox-clean (D1, D3).** No `require`/`fs`/`process`; `args` is a JSON STRING; CLI calls via the `runCli` inline-agent helper. M85 tier literals policy-conformant. M71 + M85 lints stay green (A6).

### M87 Abbreviation Key

| Abbrev | Domain | Wave |
|--------|--------|------|
| D1 | guard-bridge-spike | 1 (alone, prove-or-kill) |
| D2 | traceability-section-coverage | 2 |
| D3 | milestone-two-altitude-flow | 2 |
| D4 | template-docripple-contract | 2 |

---

## Prior State: M86 — Model Profiles (standard/pro/premium tier-spend switch) (EXECUTED + INTEGRATED — 4/4 domains complete, 1 wave; checkpoints CP1–CP4 verified at integrate; full suite 1572/0; verify next).

### M86 Wave Plan

```
Wave 1 (single wave — all 4 domains file-disjoint, 23 distinct owned files, zero overlap):

  D1 m86-d1-policy-profiles-config-cli   ── SEAM PRODUCER (medium-risk core behind a stable
      │                                      resolver envelope). Owns bin/gsd-t-model-tier-policy.cjs
      │                                      (PROFILE_STAGE_TIERS + resolveProfile), NEW
      │                                      bin/gsd-t-model-profile.cjs (config + CLI),
      │                                      bin/gsd-t.js (dispatch + dual bin-propagation),
      │                                      model-tier-policy-contract.md (→v1.1.0 additive),
      │                                      test/m86-policy-profiles.test.js. Promotes the DRAFT
      │                                      seam model-profile-config-contract.md → STABLE.
      │   publishes: `gsd-t model-profile resolve --profile <p> [stage] --json`
      │              → { ok, profile, overrides:{stage:modelId}, requiresThinkingOmitted? }
      │
      ├──────────────┬───────────────────┬──────────────────────┐
      ▼              ▼                   ▼                      ▼
  D2 invoker+     D3 drift-lint        D4 surfacing+docs    (consume D1's published seam —
  workflow `??`   unwrap-guard         (banner/statusline    code against the contract, not
  forms           (SAFETY NET)         /status/README/CLAUDE  D1's internals)
  (TD-113         (test/ only,         /package.json bump)
  QUARANTINE)     write-disjoint
                  from D2)
```

D2/D3/D4 all CONSUME D1's published resolver surface; none depends on the others. Although the
four are file-disjoint (1 wave for parallel execution), there is a CONTENT seam: D1 must land its
resolver + the published `overrides` shape before D2's invokers can inject and D3's lint can
validate against the v1.1.0 policy. Execute treats D1 as the contract-first seam (mirroring M85);
the file-disjointness oracle clears all 4 to run concurrently with D1's contract published first.

### M86 Cross-Domain Interfaces

| Producer | Consumer | Interface |
|----------|----------|-----------|
| D1 `gsd-t model-profile resolve --json` | D2 invokers | `overrides` map (stage → concrete model id) injected into the workflow via `args` (M69 invoke-time injection) |
| D1 `PROFILE_STAGE_TIERS` + `MODEL_IDS` | D3 lint | The tier set + designated-stage policy the lint validates each `??`-form fallback literal against |
| D2 workflow `??` forms (`model: overrides["x"] ?? "<premium-literal>"`) | D3 lint | The exact shape D3's extractor UNWRAPS read-only (D3 never writes D2's files — independent verification) |
| D1 config-read / resolver | D4 banner/statusline/status | The named active profile (global-default named when config absent — SC(f)) |
| `model-profile-config-contract.md` (DRAFT→STABLE) | D2/D3/D4 | The partition-time seam; D1 owns it, all consumers code against the envelope, not internals |
| `model-tier-policy-contract.md` v1.1.0 | all 4 | Additive over M85 v1.0.0 STABLE constants (unchanged); folds in the profile dimension + `??`-form lint obligation |

### M86 Checkpoints

- **M86-CP1** (D1 seam): `gsd-t model-profile resolve --profile premium --json` emits a well-formed
  `overrides` map; `test/m86-policy-profiles.test.js` green (headline census per profile);
  contract is v1.1.0 + DRAFT seam promoted STABLE; `gsd-t-model-profile.cjs` in BOTH bin-tool arrays.
- **M86-CP2** (D2 wired): the 3 designated-stage workflows carry the exact `??` forms; the wave
  workflow FORWARDS `overrides` to its verify/execute sub-calls; ALL 10 workflow-invoking commands
  (partition/plan/milestone/impact/prd/design-decompose/doc-ripple/verify/debug/wave) inject
  `overrides` via args (`test/m86-invoker-injection.test.js` green — pre-mortem r1 #1); a
  real-sandbox run per profile shows the correct fable-stage census on EVERY entry point incl.
  plan, milestone, and wave-composed verify (SC(a)).
- **M86-CP3** (D3 guard): the unwrap lint passes on D2's real workflows, validating bracket KEY
  (vs policy stageKeys) + fallback, flat AND combined-debug forms; all 7 negatives (+fail-closed,
  +combined-form positive) behave as designed (SC(c)) — pre-mortem r1 #2/#6.
- **M86-CP4** (D4 surfaced + docs): banner/statusline/status NAME the active profile (SC(f),
  `test/m86-surfacing.test.js` green); full doc-ripple complete; package.json 4.4.10 → 4.5.10.

### M86 Acceptance-Criteria → Domain Map

| AC | Owner(s) | Killing test |
|----|----------|--------------|
| (a) profile→spend real-sandbox | D1 (mapping) + D2 (`??`+injection) | D2-T7 live model census |
| (b) override beats profile live | D1 (precedence) + D2 (injection) | D1-T5 precedence case + D2-T7 live override |
| (c) lint bites both forms | D3 | D3-T3 negatives (drifted-bare, drifted-fallback, out-of-tier) |
| (d) per-project divergence | D1 (config-read) | D1-T5 absent/per-project (live 2-project = verify) |
| (e) resolver consumed at invoke time | D2 (args injection) | D2-T7 `overrides`-visible-in-args |
| (f) no silent degradation | D1 (named default) + D4 (surfacing) | D1-T5 named-default + D4 `test/m86-surfacing.test.js` |
| (g) M85 partition-probe fable | ALREADY SATISFIED (banked 2026-06-10 18:27, ledger 6/6) | — (re-confirmed incidentally by D2-T7 premium partition) |

Invariants held in the plan: competition producers stay bare `model: "opus"` in ALL profiles
(M82 blindness); the premium literal stays the lint-guarded `??` fallback; NO tracked-file mutation
on profile switch (invoke-time injection via args, M69); workflows stay runtime-native (no
require/fs — TD-113).

---

## Prior State: M85 — Model-Tier Policy (single source of truth) + Fable 5 Integration (4 domains, 2 waves). See `.gsd-t/contracts/m85-integration-points.md`.

## Prior State: Milestone 41 — Universal Token Capture Across GSD-T (PARTITIONED — 5 domains)

## M41 Dependency Graph

```
Wave 1 (foundation — no external blockers):
  D1 token-capture-wrapper
      │   (exports captureSpawn + recordSpawnRow from bin/gsd-t-token-capture.cjs)
      │   (reuses schema v1 from M40 D4 aggregator)
      │
      ▼
Wave 2 (unlocked by D1 landed + tested):
  D2 command-file-doc-ripple ─── rewrites all 20 command files + canonical block
                                 in templates/CLAUDE-global.md and CLAUDE.md

  D3 historical-backfill       ─── bin/gsd-t-token-backfill.cjs +
                                 `gsd-t backfill-tokens` CLI subcommand
                                 reads .gsd-t/events/*.jsonl + .gsd-t/headless-*.log

  D2 and D3 ship in parallel — both depend on D1 only, not on each other.

      │
      ▼
Wave 3 (unlocked by D2 + D3 landed):
  D4 token-dashboard           ─── bin/gsd-t-token-dashboard.cjs +
                                 `gsd-t tokens` CLI + status-tail injection

  D5 enforcement               ─── bin/gsd-t-capture-lint.cjs + opt-in pre-commit
                                 hook + CLAUDE MUST rule

  D4 and D5 ship in parallel — D4 renders, D5 protects. Neither depends on the other.

                GATE: all waves complete
                              │
                              ▼
       VERIFY → COMPLETE-MILESTONE → tag v3.15.10
```

### Abbreviation Key

| Abbrev | Domain |
|--------|--------|
| D1 | d1-token-capture-wrapper |
| D2 | d2-command-file-doc-ripple |
| D3 | d3-historical-backfill |
| D4 | d4-token-dashboard |
| D5 | d5-enforcement |

### Checkpoints

- **M41-CP1** (Wave 1 complete): `bin/gsd-t-token-capture.cjs` loads; `captureSpawn` + `recordSpawnRow` exported; 12+ unit tests green; full suite at baseline+N.
- **M41-CP2** (Wave 2 complete): every command file spawn site goes through the wrapper; no `| N/A |` rows left in canonical templates; `gsd-t backfill-tokens --dry-run` reports real parsed-envelope count > 0 on this project.
- **M41-CP3** (Wave 3 complete): `gsd-t tokens` prints live + backfilled totals; `gsd-t status` shows the two-line token block; `gsd-t capture-lint --all` exits 0 on main; CLAUDE files carry the new MUST rule.

### Cross-Domain Interfaces

| Producer | Consumer | Interface |
|----------|----------|-----------|
| D1 `recordSpawnRow` | D2 command files | Function call in a `node -e "..."` block inside each command's observability section |
| D1 JSONL schema v1 | D3 backfill | Same record shape, with added optional `source: "backfill" \| "live"` field |
| D1 JSONL schema v1 | D4 dashboard | Streaming line-by-line read, in-memory aggregation |
| D2 converted command files | D5 linter | Wrapped spawn sites are the "clean" state the linter checks for |
| M40 D4 aggregator | D1 + D3 | `scripts/gsd-t-token-aggregator.js` envelope-parse helpers — both reuse |
| M40 D5 stream-feed UI | D4 dashboard | Shared `humanizeTokens` + `formatCost` formatters for consistent rendering |

### Contracts Referenced (no new contracts in M41 — reuses M40 shapes)

| Contract | Source | M41 consumers |
|----------|--------|---------------|
| `metrics-schema-contract.md` | M40 D4 | D1 (write), D3 (write + backfill extension), D4 (read) |
| `stream-json-sink-contract.md` v1.1.0 | M40 D1 | D1 (envelope parsing), D3 (log archive parsing) |
| `completion-signal-contract.md` | M40 D3 | not directly consumed — M41 observes spawns that already terminated |

No new contract files are added by M41. The existing schema v1 remains the source of truth; M41 just fills in the data.

---

## Must-Read List (Assumption Audit Category 3 — Black Box)

Every M41 domain MUST read these before treating them as correct:

| File | Why |
|------|-----|
| `scripts/gsd-t-token-aggregator.js` (M40 D4) | Assistant-frame-vs-result-frame usage precedence; D1 + D3 reuse these helpers |
| `.gsd-t/contracts/metrics-schema-contract.md` | Schema v1 record shape |
| `.gsd-t/contracts/stream-json-sink-contract.md` v1.1.0 | Which frames carry authoritative usage |
| `bin/gsd-t-token-capture.cjs` (D1 output) | The wrapper is the source of truth for row formatting — D2, D3, D4 all depend on it |
| `scripts/gsd-t-stream-feed.html` (M40 D5) | `humanizeTokens` + `formatCost` — D4 must match |

## External Reference Dispositions (Assumption Audit Category 1)

| Reference from M41 definition | Disposition | Notes |
|-------------------------------|-------------|-------|
| `scripts/gsd-t-token-aggregator.js` | **USE** | Import envelope-parse helpers; do not modify |
| `scripts/gsd-t-stream-feed.html` | **INSPECT** | Read `humanizeTokens` + `formatCost` for parity; do not import from HTML |
| `bin/gsd-t-orchestrator.js` worker spawn path | **INSPECT** | Already captures usage via stream-json sink (M40). Understand how, don't rewire. |
| `commands/gsd-t-execute.md` | **USE** (as reference target for D2) | Convert in isolation first as the worked example |
| Historical `.gsd-t/headless-*.log` | **USE** (read-only) | D3 parses these; never deletes or rotates |
| Historical `.gsd-t/events/*.jsonl` | **USE** (read-only) | D3 parses these; never deletes or rotates |

## User Intent Locked-In Interpretations (Assumption Audit Category 4)

| Ambiguous phrase from M41 definition | Interpretations | Locked |
|--------------------------------------|-----------------|--------|
| "universal token capture" | (a) every spawn surface, (b) only new spawns going forward | **(a)** — D3 backfills the historical record; D1+D2 cover forward |
| "missing usage" handling | (a) write `0`, (b) write `—`, (c) write `N/A` | **(b)** — `—` means "gap acknowledged", never `0` (a zero is a measurement) and never `N/A` (the old convention being retired) |
| "enforcement" (D5) | (a) hard fail on any bare spawn, (b) warn in CI, (c) opt-in pre-commit hook + MUST rule in CLAUDE | **(c)** — opt-in hook for ship; methodology rule blocks from day 1; automatic hook installation deferred to post-shakedown |
| "dashboard" (D4) | (a) web UI, (b) CLI table | **(b)** — M40 D5 is the live web UI; M41 D4 is the historical CLI view. No second web server. |
| "backfill" (D3) | (a) retroactively rewrite old `N/A` rows, (b) append backfill-only JSONL | **both** — `--patch-log` rewrites rows in place; default writes JSONL-only with `source: "backfill"` marker |

---

## Prior Milestone Archives

Previous integration-points content (M40 and earlier) is preserved in milestone archives under `.gsd-t/milestones/`. Most recent: `M40-external-task-orchestrator-2026-04-20/`.
