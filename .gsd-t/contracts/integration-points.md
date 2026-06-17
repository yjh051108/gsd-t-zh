# Integration Points

## Current State: M87 — Intention-First PseudoCode as Milestone Source-of-Truth (PLANNED — risk-first, 4 file-disjoint domains, 2 waves; Wave 1 = prove-or-kill A1; Wave 2 gated on A1; M83 traceability-gate PASSES all 4 domains, 0 violations).

### Seam contract
`.gsd-t/contracts/pseudocode-source-of-truth-contract.md` v1.1.2 STABLE — the SINGLE source of all grammars (guard-map §2, section-citation §3, divergence §4, ripple-points §5). Authored at partition (D4-T0); §2 reconciled to the real binvoice corpus across the plan-phase pre-mortem fix (v1.1.0 dual grammar) and the re-plan re-validation (v1.1.1: hard count = 13, non-anchored inline marker); §3 reconciled (v1.1.2: citable-section source = `##` headings outside Appendix fences, PayPal=10/Extension=10 floor, deterministic GitHub-style slug §3.2, D2 non-vacuity floor + citation-resolution §3.3; §6/A5 wired to task M87-INT-T1). D1/D2/D3 consume it; no domain re-derives a grammar. A grammar change is a contract version bump + coordinated cross-domain edit.

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
      │  M85 tier `haiku`, FAIL-blocking, BEFORE the triad).
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
  (section-citation      + sign-off state + keep-   + A4 drift lint verifying
  coverage, struct/      or-supersede prompt +      ALL FOUR ripple points.
  path-as-path) + A2     A3 sign-off tests.         Contract (D4-T0) already
  planted-gap test.      Wires D2's documented      on disk from partition.
  Owns the competition-  altitude shift into the
  altitude design note.  solution-space probe.

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
| **W1** | D1 guard-bridge-spike (T1–T4) | runs ALONE (no wave-2 domain starts) | **A1 (M87-D1-T3) PASSES** — faithful exit 0 / doctored exit non-zero, RULE-ID named, deterministic. A1 fails → HALT + re-scope. |
| **W2** | D2 (T2–T3) · D3 (T1–T4) · D4 (T1–T3) | all 3 concurrent (write-disjoint, all depend on A1 only, not each other) | all wave-2 tasks complete + the partition-time wave-1 contributions (D2-T1 design note, D4-T0 contract) on disk |

### M87 Integrate-Time Seams (NOT parallel-written — serial at integrate, no domain owns)

| Seam | File | Why serial | Owning AC |
|------|------|------------|-----------|
| Living Documents table | `templates/CLAUDE-global.md` (~line 60) | shared file (file-disjointness invariant) | A4 ripple point 1 |
| Pre-Commit Gate | `templates/CLAUDE-global.md` | shared file | A4 ripple point 2 |
| project Living Documents ref | `CLAUDE.md` | shared file, co-owned at merge with D4's lint | A4 ripple point 4 |
| verify-triad consumption (**M87-INT-T1** — no domain owns) | `templates/prompts/qa-subagent.md`, `templates/prompts/red-team-subagent.md` | wired AFTER D1's module passes A1; QA gets [RULE]s as contract-compliance assertions, Red Team as a pre-enumerated attack surface — consumed via D1's CLI/JSON contract, never by editing D1 source. **Killing test:** `test/m87-verify-triad-rule-consumption.test.js` — a verify run on a spec'd milestone surfaces the derived RULE-IDs in BOTH the QA contract-compliance frame AND the Red Team attack-surface frame; a frame missing the rule set FAILS. | A5 |
| CLI dispatch | `bin/gsd-t.js` | shared dispatch table; adds `guard-map` subcommand routing to D1's module | A1 wiring |
| verify command invoker | `commands/gsd-t-verify.md` | shared command file; reflects the new gate step | A1/A5 |

The A4 drift lint (D4-T3) VERIFIES ripple points 1/2/4 POST-integration; D4 WRITES only point 3 (doc-ripple command).

### M87 Cross-Domain Interfaces

| Producer | Consumer | Interface |
|----------|----------|-----------|
| D4 `pseudocode-source-of-truth-contract.md` v1.1.2 STABLE | D1/D2/D3 | The partition-time seam — guard-map §2, section-citation §3, divergence §4, ripple §5; all code against the contract, never re-derive |
| D1 `bin/gsd-t-guard-map.cjs` (`--doc --map --json`, exit 0/4/64, build→rule map) | verify-triad (A5 integrate seam), D2 (rule-aware paths) | JSON contract: `{ rules: { "<RULE-ID>": { backedBy:[...], contradicted:bool } } }`; consumers read the JSON, never edit D1 source |
| D2 extended `bin/gsd-t-traceability-gate.cjs` (`**PseudoCode-Section**: <Title>#<anchor>` parse, path-as-path) | plan phase | section-coverage gap report (zero-citing-task section = structural gap), additive over M83 AC→(path+test) |
| D2 scope.md competition-altitude design note | D3 `gsd-t-phase.workflow.js` (integrate-time) | the documented decision D3 wires: solution-space probe shifts UP to high-level-approach altitude when behavior is spec'd; gate stays altitude-agnostic |
| D3 `keep-or-supersede-subagent.md` | milestone flow | per inherited shipped-code model, ASK keep/supersede; each supersede emits `⚠ Divergence` (§4) into the doc |
| D4 `templates/PseudoCode-spec.md` | every future milestone | the shipped blank mold (both altitudes + all five section elements, anchored to binvoice exemplars per SC6) |

### M87 File-Disjointness (validated via `gsd-t parallel --dry-run` — 18 distinct owned files, zero cross-domain overlap)

| Domain | Files Owned |
|--------|-------------|
| D1 guard-bridge-spike | `bin/gsd-t-guard-map.cjs`, `test/m87-guard-map-bridge.test.js`, `test/fixtures/m87/PseudoCode-PayPal.md`, `test/fixtures/m87/PseudoCode-Extension.md`, `test/fixtures/m87/PseudoCode-PayPal-doctored.md`, `test/fixtures/m87/PseudoCode-PayPal.map.json`, `test/fixtures/m87/PseudoCode-PayPal-doctored.map.json`, `templates/workflows/gsd-t-verify.workflow.js` |
| D2 traceability-section-coverage | `bin/gsd-t-traceability-gate.cjs`, `test/m87-traceability-section-coverage.test.js` |
| D3 milestone-two-altitude-flow | `commands/gsd-t-milestone.md`, `templates/workflows/gsd-t-phase.workflow.js`, `templates/prompts/keep-or-supersede-subagent.md`, `test/m87-milestone-signoff-flow.test.js` |
| D4 template-docripple-contract | `templates/PseudoCode-spec.md`, `commands/gsd-t-doc-ripple.md`, `.gsd-t/contracts/pseudocode-source-of-truth-contract.md`, `test/m87-docripple-presence-lint.test.js` |

D1 owns `gsd-t-verify.workflow.js`; D3 owns `gsd-t-phase.workflow.js` — DIFFERENT workflow files, no shared workflow. No file appears in two Files-Owned blocks.

### M87 Acceptance-Criteria → Domain Map

| AC | Owner | Killing test |
|----|-------|--------------|
| **A1** (kill-criterion) | D1 | M87-D1-T3 — faithful exit 0 / doctored exit non-zero, RULE-ID named, deterministic |
| A2 (section-coverage gap) | D2 | M87-D2-T3 — planted gap detected structurally; substring mention insufficient |
| A3 (sign-off unsigned ≠ DEFINED + logged skip) | D3 | M87-D3-T4 — unsigned ≠ DEFINED; sign flips; skip logged in progress.md |
| A4 (ripple-presence drift lint, 4 points) | D4 | M87-D4-T3 — passes when all four present, FAILS when any one removed |
| A5 (verify-triad consumes [RULE] set) | integrate seam **M87-INT-T1** (qa/red-team prompts; no parallel domain) | `test/m87-verify-triad-rule-consumption.test.js` — verify run surfaces the derived RULE-IDs in BOTH the QA contract-compliance frame AND the Red Team attack-surface frame |
| A6 (regression: suite green + M71 + M85 lints) | D1+D3 (workflow edits) | `test/m71-workflow-runtime-native-lint.test.js`, `test/m85-workflow-tier-policy-lint.test.js` stay green |

### M87 Load-Bearing Serial Constraints

1. **A1 before all of wave 2.** D1 runs ALONE; no wave-2 domain begins until M87-D1-T3 passes. A1 fails → HALT + escalate (no papering over — `feedback_coverage_check_structural_not_substring`).
2. **Coverage-check Red-Team convergence guard (D2).** If the Red Team on the section-coverage check does NOT converge in ≤2 cycles (each fix spawning a variant), that is a DESIGN DEFECT → STOP + escalate, do not keep patching (the known non-converging trap).
3. **Integrate seams serial, after wave 2.** `templates/CLAUDE-global.md` ×2, project `CLAUDE.md`, the verify-triad prompts, `bin/gsd-t.js` dispatch, `commands/gsd-t-verify.md` are wired serially at integrate — never parallel-written. The A4 lint then verifies all four ripple points post-merge.
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
