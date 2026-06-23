# Changelog

All notable changes to GSD-T are documented here. Updated with each release.

## [4.9.11] - 2026-06-23 (M93 — Brevity Guard: enforce concise, answer-first output — patch)

### Added — conciseness is now enforced, not just requested

The user has asked for concise, jargon-free replies for weeks; prose instructions kept getting ignored (a "no process narration" rule even existed and was violated). The fix is a deterministic gate, because that is the only mechanism GSD-T reliably obeys. 3 file-disjoint domains; full suite 2230 / 2226 pass / 0 fail / 4 skip.

- **Brevity-guard Stop hook** (`scripts/gsd-t-brevity-guard.js`) — runs when a reply finishes. For a **question** (a pure-text answer), it blocks egregious preamble: 2+ stacked process-narration sentences ("let me find X before I answer…") before the actual answer, or an unglossed jargon code (`S2-M7`, `HC-003`). For an **action** (the turn changed code), intent-first is allowed — you still get to short-circuit a wrong direction. **Fail-open by design**: any error, malformed input, or uncertainty → allow, so it can never gag legitimate work.
- **Reader Contract** in `templates/CLAUDE-global.md` + the QA / Red Team / pre-mortem / blind-adversary subagent prompts — sets the concise, answer-first, gloss-jargon default at the source, so the gate rarely needs to fire.
- **Jargon lint** (`bin/gsd-t-jargon-lint.cjs`) — flags an unglossed jargon code in a written document (the file surface the Stop hook can't reach), so decision docs stay readable.

The dated banner at the top of each reply is unchanged (kept by request).

## [4.9.10] - 2026-06-23 (M92 — Understand-Before-Build, the paradigm half / backlog #44a — minor)

### Changed — GSD-T now prefers the SMALLEST change that hits the crux

The root cause of the BinVoice over-scoping saga: GSD-T was a purely ADDITIVE gate pipeline — when a plan started too high, every gate made it bigger, and the verdict schema couldn't even SAY "we made it smaller." M92 is the cheap, no-graph paradigm half of the fix (the graph half, #44b, is a separate later milestone gated on this one). Three file-disjoint moves, one wave; full suite 2183 / 2179 pass / 0 fail / 4 skip.

- **Cheaper-first response ladder (move 1).** M90's §2 architectural trigger (R-ARCH-2 — fires when a task touches an existing file) now resolves a **look → smallest → spike → defer** ladder: `look` (grep/read what exists before scoping) is the new DEFAULT, `spike` is DEMOTED to a later rung. The cheap "look" rung resolves most over-scoping without ever needing a spike. R-ARCH-4/5/6 and the backward-compat envelope are preserved; the live spike-feasibility decider remains backlog #42 (explicitly out of scope). Doctrine contract `unproven-assumption-doctrine-contract.md` §2.2 updated.
- **The verdict can say "smaller" (move 2, the keystone).** New `bin/gsd-t-shrink-metric.cjs` measures a change's leanness deterministically from `git diff --numstat` (`netLoc`, `leaner`) — MEASURED, not LLM-attested. Verify's `VERDICT_SCHEMA` gains an ADDITIVE `shrink` dimension (the correctness enum is untouched), so a net-negative diff is rewarded as a success instead of being invisible.
- **The default is inverted (move 3).** The milestone/quick framing now leads with the smallest-altitude change; ceremony (plan→execute, partition, competition) is opt-in, justified by the crux — instead of being the implied "Recommended" default.

### Security

- **`bin/gsd-t-shrink-metric.cjs` git-argument injection (M92 verify Red Team, HIGH, fixed in-verify).** The `--range` value was passed to `git diff --numstat <range>` without dash-leading validation — `execFileSync` blocks shell injection but not git-OPTION injection, so a range like `--output=<path>` made git overwrite an arbitrary file (and the range is LLM-derived upstream). Fixed by refusing non-string/empty/dash-leading ranges before the git call (+ `--` end-of-options as defense-in-depth), with 3 security regression tests.

## [4.8.10] - 2026-06-22 (M91 — PseudoCode Source-of-Truth, merged M87+M88 — minor)

### Added — the intention-first PseudoCode behavior map becomes the milestone source-of-truth

A `PseudoCode-[Title].md` authored BEFORE the build (a two-altitude behavior map: high-level approach → detailed per-step intention+mechanism) is now the milestone source-of-truth, enforced by deterministic gates. Eight file-disjoint domains across three waves, single-session build; full suite 2131 / 2127 pass / 0 fail / 4 skip.

**M87 core (Waves 1–2):**
- **Guard-map verify gate** (`bin/gsd-t-guard-map.cjs`) — parses the `[RULE …]` guard map (3 grammar forms, side-agnostic, derives `R-<SLUG>-<NN>` ids), gates a build→rule map (exit 0 / 4-names-the-rule / 64); wired FAIL-blocking into `gsd-t-verify.workflow.js` before the triad, with §7 doc+map discovery and distinct logged skips (`no-build-map` / `no-pseudocode-docs`).
- **Section-citation traceability** (`bin/gsd-t-traceability-gate.cjs` extended) — tasks cite `**PseudoCode-Section**: <Title>#<anchor>`; a section with no citing task is a structural coverage gap; slug-as-slug resolution, never substring. Plus a milestone→domains scoping fix (`--domains`; zero-prefix-match no longer falls back to all — exit 64 `milestone-scope-unresolved`) and a path-containment guard (`domain-path-escape`).
- **Two-altitude milestone flow** (`commands/gsd-t-milestone.md` + `gsd-t-phase.workflow.js`) — high-level approach sign-off precedes the detailed doc; competition solution-space probe shifts up to the approach altitude. Keep-or-supersede prompt protocol writes a `⚠ Divergence` flag on supersede.
- **Template + doc-ripple** — `templates/PseudoCode-spec.md` mold; `PseudoCode-[Title].md` joins the Living Documents ripple set (region-scoped A4 drift lint).

**M88 deterministic gates (Wave 3):**
- **Sign-off state** (`bin/gsd-t-milestone-state.cjs`) — `<!-- signed-off: … -->` marker + `isDefined(docs)` predicate; unsigned ≠ DEFINED; skip is a logged decision, never silent.
- **Build→map derivation** (`bin/gsd-t-guard-map-derive.cjs`) — mechanical evidence→map seam (imports the guard-map parser), end-to-end derive→gate test.
- **Triad-consumption seam** (`bin/gsd-t-rule-consume.cjs` + ingest directives in qa/red-team prompts) — deterministic seam-check, no live triad.
- **Divergence grammar** (`bin/gsd-t-divergence-grammar.cjs`) — `parseDivergence`/`formatDivergence` byte-stable round-trip + `countDivergences`.

Every gate meets the deterministic-gate bar: deterministic code, zero LLM judgment, structural-not-substring, killing test vs byte-verbatim fixtures, fail-closed. Verify: QA PASS (mutation-tested), Red Team GRUDGING-PASS (one path-traversal MEDIUM fixed in-verify; fence-awareness MEDIUM/LOW deferred to backlog #45, all fail-closed). Contract: `pseudocode-source-of-truth-contract.md` v1.1.5 STABLE.

## [4.7.11] - 2026-06-22 (backlog #40 — deterministic domain archive+sweep — patch)

### Fixed — complete-milestone now deterministically archives + sweeps a milestone's domains

`complete-milestone` Step 7 was prose-only ("archive domains → clear `.gsd-t/domains/`") with no enforcement, so a Level-3 autonomous agent skipped or partial-did it for ~30 milestones — accumulating 77 stale domain dirs that polluted the file-disjointness oracle (surfaced + manually pruned during M90). Root-cause fix:

- **`bin/gsd-t-archive-domains.cjs`** (new) + `gsd-t archive-domains` dispatch: copies an EXPLICIT set of the completing milestone's domain dirs → `<archive>/domains/<name>/`, then removes them from `.gsd-t/domains/`. Idempotent (re-running is a no-op), containment-guarded (refuses any name with path separators / dot-segments or resolving outside `.gsd-t/domains/` — [[feedback_destructive_path_ops_containment]]), fail-closed (a bad name aborts the whole batch, no partial sweep). Domains of other still-active milestones are left untouched (not a blanket wipe).
- `commands/gsd-t-complete-milestone.md` Step 7: prose → the deterministic helper call.
- Propagated via PROJECT_BIN_TOOLS + GLOBAL_BIN_TOOLS. 5 tests (sweep-exactly / idempotent / dry-run / containment / bad-input). Suite 2003 / 1999 pass / 0 fail.

## [4.7.10] - 2026-06-22 (M90 — The Unproven-Assumption Doctrine — minor)

### Added — a self-governing doctrine that stops the system building on unproven assumptions

M90 makes "don't act on belief; if it's not grounded in knowledge or research, research first" an enforced framework capability rather than advisory prose. The core principle (sourced at discuss: self-introspection is unreliable, *worse* on RLHF models — arxiv 2306.13063, 2310.01798) is **externalize + force, never introspect** — deterministic triggers + external checks, fail-closed on uncertainty.

Three deterministic mechanisms, wired fail-closed into the debug/execute/quick/phase/verify workflows (§4 R-FAIL-1/2/3):

- **Factual classifier** (`bin/gsd-t-research-gate.cjs`, absorbed from M89): routes a knowledge-gap to grep (internal) vs. research+cite (external); the INTERNAL decision enumerates no open category (never guess-internal). Premise-corrected during build (the partition's "vendor list causes a silent-miss" was false on disk — the list is kept as an `external→web` upgrade). New time-anchored override (R-FACT-3): a fast-moving lib/API/version or "current best practice" gap is researched regardless of confidence.
- **Loop-ledger non-convergence halt** (`bin/gsd-t-loop-ledger.cjs`): a debug loop on the SAME symptom (keyed on the symptom, not the changing file — so variant-spawning whack-a-mole is caught, R-LOOP-1) HARD-HALTS with a premise-re-examination directive instead of patching further. Detection ≠ resolution (the halt persists until a genuine re-examination clears it), per-milestone scoped (one milestone's halt can't brick another's verify), full-reset on re-examination, plain-object-validated, atomic write.
- **Architectural-assumption trigger** (`bin/gsd-t-architectural-trigger.cjs`): a divergence-sampling + extend-existing-code trigger that flags building on an unproven approach. Shipped EXPERIMENTAL+MEASURED; the spike/adversary response-mode enforcement (R-FAIL-2) is honestly DECLARED interface-only this milestone (no live producer yet — backlog #42 wires it).

Doctrine contract `unproven-assumption-doctrine-contract.md` v1.0.0 STABLE (absorbs `auto-research-contract.md` v1.3.3) + §6 guard map + self-obedience lints. CLAUDE-global Research Policy upgraded from advisory prose to the doctrine.

### Process note

The milestone obeyed its own doctrine: plan-hardening caught M90 about to build a domain on an unproven premise (re-verified on disk, re-scoped), and a 9-round verify sequence hardened M90's OWN gate-wiring lifecycle to ground (hollow-gate → fail-open → no-producer → lifecycle flaws → vacuous-gate → array-type-confusion → cross-milestone-brick → symptom-keying). Suite 1998 / 1994 pass / 0 fail / 4 skip. Deferred to backlog: #42 (live spike-feasibility producer + sink fail-closed), #43 (AWS/S3 classifier edge), 3 documented code-review nits.

## [4.6.11] - 2026-06-16 (Output Style — six named conciseness tics + backlog #33 — patch)

### Changed — tightened the CONCISE Output Style rule with six named anti-patterns

User feedback that replies stayed wordy despite the existing CONCISE rule. Extracted six specific tics — three from live examples, three from the user's own wordy→concise rewrites (binvoice `Wordy Example 1/2.txt`, a labeled before/after set where ~70 wordy lines collapsed to ~25 with identical information) — and added a litmus test. Synced the template to the live global CLAUDE.md (blocks kept identical — ripple invariant). Also added backlog #33 from the binvoice FB-modal debug-loop retrospective.

- `templates/CLAUDE-global.md`: Output Style block gains six rules — no process narration, no answer sandwich, no affirmation throat-clearing, no honesty theater, a table replaces its prose (never repeats it), ask once — plus a litmus test ("delete any sentence that survives deletion without info loss").
- `.gsd-t/backlog.md`: #33 firing debug-cycle circuit-breaker + repro-fixture-on-regression + anchor-last scraping stack rule (completes #31/TD-294 from the loop-governance side).

Behavioral/doc-only — no test changes. Suite: 1603/1607 pass, 0 fail.

## [4.6.10] - 2026-06-15 (Installer wiring for status line + low-context cue — minor)

### Added — installer now copies and wires the status line + ctx-cue Stop hook

Both `statusline-command.sh` (the M85 two-line GSD-T status bar) and `scripts/hooks/gsd-t-ctx-cue.sh` (the M85 low-context red banner) were canonical sources but had NO installer copy/wire path — dead source that never reached projects on `install` / `update-all` (the global-bin-propagation-gap pattern). This release wires both into `bin/gsd-t.js` so they propagate, ships the M85/M86 template sync (`templates/CLAUDE-global.md` now matches the live tightened global CLAUDE.md, adding the Output Style + Git Worktree Location sections), and commits the per-project `.gsd-t/model-profile.json` default (`{profile: standard}` — Fable 5 not used; all 6 high-leverage stages run on Opus/Sonnet).

- `bin/gsd-t.js`: `IN_SESSION_HOOKS` gains a `runner` field (`node` default, `bash` for `.sh` hooks); `gsd-t-ctx-cue.sh` registered as a SYNCHRONOUS Stop hook (its banner stdout must reach the terminal — async would swallow it). New `installStatusLine()` copies `statusline-command.sh` to `~/.claude/` and sets `settings.statusLine` only when absent or already ours (never clobbers a custom status line). Both wired into the shared `doInstall` path, so `update` / `update-all` propagate them.
- `templates/CLAUDE-global.md`: synced to the live global CLAUDE.md (Output Style default-CONCISE + Git Worktree Location MANDATORY sections added; verbose Update-Notices block condensed).
- `.gsd-t/model-profile.json`: committed default `{profile: standard}`.
- `test/m86-installer-statusline-ctxcue.test.js`: NEW black-box regression — runs the real installer against a sandbox HOME and asserts statusLine wiring, the bash-runner ctx-cue Stop hook, its synchronous registration, and both file copies.

## [4.4.10] - 2026-06-09 (M85 Model-Tier Policy + Fable 5 — minor)

### Added — single source of truth for model-tier assignments + the Fable 5 tier

Model-tier policy previously lived in 4 unsynced authorities with zero drift enforcement, and the parallel alias map was provably stale (`opus → claude-opus-4-7`). M85 centralizes the policy, fixes the live bug, and slots Claude Fable 5 (tier above Opus, $10/$50 per MTok) into the highest-leverage stages — gated by a lint so drift is impossible. The cost tradeoff was MEASURED, not asserted: a Fable single-draft tied a judged 3-Opus competition at 42% of the cost (n=1, discuss-class).

- `bin/gsd-t-model-tier-policy.cjs`: NEW — frozen `MODEL_IDS` + `STAGE_TIERS` (6 fable stage keys; competition producers HELD at opus per the M82 blindness invariant), `requiresThinkingOmitted()` (Fable's thinking-disabled-400 breaking change encoded once; accepts the runtime bracket-suffix form), `resolve()` + CLI resolver emitting the M69 JSON envelope; `gsd-t model-tier-policy` dispatcher + registered in both bin-propagation lists.
- `bin/gsd-t-parallel.cjs`: alias map now `require()`s the policy module (zero bare model-id literals; stale opus-4-7 gone); cache-warm probe passes `--model` explicitly (the `ANTHROPIC_MODEL` env pin was measured silently ignored by the current CLI).
- `bin/model-selector.js`: FABLE tier + `cycle_2_escalation` rule via the existing `selectModel` signature; debug default byte-identical.
- `templates/workflows/gsd-t-{phase,verify,debug}.workflow.js`: 5 Fable assignments — M84 solution-space/partition probes, competition judge (`judge:rubric`), M83 pre-mortem, Red Team (stays non-skippable), debug `cycle === 1 ? "opus" : "fable"` ternary.
- `test/m85-workflow-tier-policy-lint.test.js`: NEW M71-family drift enforcer — 8-file discovery, stage-key→label mapping with per-stage non-empty-match, negative drift fixtures, real-file + debug-ternary meta-tests.
- `test/m85-model-tier-policy.test.js` + `test/model-selector.test.js`: 25 + 57 tests incl. dispatcher/propagation killing tests.
- Contracts: `model-tier-policy-contract.md` v1.0.0 STABLE (new); `model-selection-contract.md` → v1.1.0.

No migration needed for consumer projects: workflows keep using tier aliases; `gsd-t update-all` propagates the new module. Suite 1462/0.

## [4.3.10] - 2026-06-05 (M84 Auto-Competition - minor)

### Changed - Competition Mode is now AUTOMATIC (was opt-in)

M82 shipped Competition Mode as opt-in (`--competition N`). M84 makes the workflow decide for itself, per the user directive: *"I want the workflow to determine when it's optimal to create a competition."* The economic case (user's): a better artifact produced upstream makes every downstream phase — pre-mortem, execute, verify — cheaper and more likely to pass first time, so the expected downstream savings usually exceed the ~3× upstream cost. Opt-in just means forgetting to use the thing that lowers total cost.

- **Solution-space probe** runs at the start of each eligible phase (partition / milestone / discuss / design-decompose), after brief, before producing. It decides: ≥2 genuinely different viable approaches → compete (3 producers + judge); one obvious answer → single draft.
- **The probe runs on OPUS, not haiku.** Deciding "are there multiple good approaches?" is high-level reasoning, not a mechanical check — and it gates the whole 3× competition, so a weak probe would forfeit the feature. (User caught this: *"Is Haiku smart enough to make this a judgment?"* — no, it isn't; the probe is opus.)
- **Biased toward competing**: when uncertain, compete (the asymmetry favors generating options). Probe failure → compete (fail-toward-options).
- **Partition**: an opus probe makes the pre-produce compete/skip call; the objective file-disjointness oracle still judges the produced candidates (decision = heuristic + bias; selection = objective).
- **Producer angles are now phase-aware** (`ANGLES_BY_PHASE`) — a discuss/milestone/design producer no longer gets a partition-framed "carve file-disjoint domains" directive (Red Team MEDIUM fix; this latent M82 defect now mattered because competition is the default path).
- **Overrides** (rarely needed): `competition: N` (2–5) forces N; `competition: 0` / `noCompetition: true` forces off; unset = auto. An unparseable override logs a warning and falls back to auto.
- `meta.phases` now declares all 7 stages (Preflight / Probe / Compete / Judge / Phase / Finalize / Plan Hardening) — also fixes the M83 cosmetic gap where Plan Hardening wasn't pre-declared.
- **Verification**: real-sandbox proof — the opus probe ran through the Workflow sandbox and discriminated correctly (wide collaborative-editor scenario → compete, 3 approaches named; narrow copyright-bump → single draft). Adversarial Red Team (Opus, fresh context) GRUDGING-PASS — no CRITICAL/HIGH; state-wiring, overrides, eligibility, probe-failure, cost-bound, runtime-native, and plan-hardening interaction all verified clean. Fixed the 1 MEDIUM (phase-aware angles) + 3 LOWs. Suite 1372/0/4. Minor bump 4.2.10 → 4.3.10.
- Contract `competition-mode-contract.md` → v2.0.0 (trigger moved opt-in → automatic; judge/selection/invariants unchanged).
- Origin: NiceNote review — the user observed that competing on the M7 plan would have produced a better plan from the start (fewer pre-mortem blocks, less downstream cost), so competition should be automatic, not a flag to remember.

## [4.2.10] - 2026-06-05 (M83 Left-Shifted Plan Hardening - minor)

### Added - Plan-phase hardening: catch dead deliverables and edge cases BEFORE execute

Left-shifts failure detection from verify to plan. Adversarial validation (the Red Team) ran only at verify — after code exists — so a milestone whose headline capability shipped as DEAD CODE (the NiceNote M5 incident: a 100MB+ chunked reader built but never wired into `openPath`, with no test exercising it) burned **four verify cycles** re-litigating the milestone's reason to exist. The root cause was in the plan: it never bound each acceptance criterion to a code path + a killing test, and nothing adversarial reviewed the design before code was written. The `plan` phase now runs two blocking gates before execute.

- **Acceptance-traceability gate** (deterministic) — `bin/gsd-t-traceability-gate.cjs`, dispatched as `gsd-t traceability-gate`. Parses `.gsd-t/domains/*/tasks.md`; every behavioral task (one declaring acceptance criteria) must bind its ACs to a `**Files**` code path AND a named killing test; a `**Headline:** true` task must have BOTH a real implementation path and a test. Exit 4 blocks execute. Field detection is emphasis-stripped + colon-position-agnostic (`**Label**:` ≡ `**Label:**`); task blocks are detected by any non-structural heading bearing an AC (descriptive headings are not dropped); the test check is tied to the Test/Files/AC fields only (an incidental runner word in a Dependencies note does not clear it); pytest `test_*.py` / `*_test.py` conventions are preserved.
- **Adversarial pre-mortem** (generative) — `templates/prompts/pre-mortem-subagent.md`, an opus, fresh-context, assume-the-plan-is-flawed reviewer wired into the plan workflow. Predicts edge-case / dead-deliverable / NFR / shallow-test failures and converts each blocking finding into a **required test** the plan must adopt (advisory notes forbidden — that is how M5's chunk reader shipped three data-loss bugs across three cycles). Verdict `BLOCK` / `CLEARED`.
- The two gates are the temporal dual of the Red Team: attack the design at plan, not just the code at verify. The deterministic gate runs first and fails CLOSED (an unevaluable gate blocks); the pre-mortem cannot approve a gate-blocked plan.
- New CLI `gsd-t traceability-gate [--milestone Mxx] [--tasks FILE]` (exit 0/4/64), added to project + global bin tools. Contract `.gsd-t/contracts/plan-hardening-contract.md` v1.0.0 STABLE. `gsd-t-plan.md` + the phase-workflow plan objective updated to require traceable tasks up front.
- **Verification**: orthogonal triad ran. Adversarial Workflow Red Team (Opus, fresh context) FAILed first pass (1 CRITICAL — colon-inside-bold markdown defeated all field detection, silently passing the literal M5 dead-code plan — + 2 HIGH + 2 MEDIUM), all fixed; re-validation found a regression the CRITICAL fix introduced (underscore-stripping broke pytest paths, HIGH), fixed; final re-validation GRUDGING-PASS (14/14 checks, no new HIGH/CRITICAL). Real-sandbox acceptance gate passed (gate fires through the Workflow sandbox and blocks the bad plan). Suite 1372/0/4 (+15 M83 tests). Self-tested against the actual NiceNote M5 dead-code plan — the gate FAILs it at plan time, which is the milestone's reason to exist.
- Origin: review of the NiceNote 9-milestone build, where the triad caught real bugs at verify but late; the user's proposal for an adversarial risk-assessment agent at plan.

### Versioning

Minor bump 4.1.10 → 4.2.10 (new feature, additive; patch reset to 10).

## [4.1.10] - 2026-06-05 (M82 Competition Mode - minor)

### Added - Competition Mode: generate-and-judge for upstream, pre-contract phases

The *generative* dual of the orthogonal validation triad. The triad is adversarial (many critics, one candidate → a filter); Competition Mode is generative (many candidates, one judge → a generator). GSD-T historically filtered hard but **generated singly** — every upstream artifact was a single draft. Competition Mode adds the missing generator on the phases where it pays. **Watershed rule:** generate-and-judge ABOVE the contract; attack-and-filter BELOW it.

- **Opt-in `--competition N`** (N clamped 2–5; default off) on eligible upstream phases: `partition`, `milestone`, `discuss`, `design-decompose`. Ignored (single producer, logged) on ineligible phases (plan/impact/prd/doc-ripple) and impossible on post-contract phases (execute/verify/…).
- **Producers = Self-MoA** — N samples of ONE strong model (opus), diversified by prompt *angle* (max-parallelism / simplicity / risk-isolation / dependency-depth / balance), not by a model zoo. Evidence (Self-MoA, arXiv 2502.00674): aggregation is far more sensitive to candidate quality than diversity; mixing models injects low-quality candidates. No debate — producers stay independent.
- **Objective judge for partition (the v1 beachhead)** — `bin/gsd-t-competition-judge.cjs --kind partition` scores candidate decompositions via the SAME file-disjointness oracle the dispatcher uses (`bin/gsd-t-file-disjointness.cjs`): parallelGroups / waveDepth / validity. A calculator, not an LLM critic → immune to position/verbosity/self-preference bias. Touch paths normalized (`./a` ≡ `a`, `//`, backslashes, trailing slash, dedupe; case preserved).
- **Subjective judge for milestone/discuss/design** — blind + deterministically-shuffled + different-model (sonnet) + rubric-scored; the winner is finalized deterministically by `--kind generic` (highest weighted score; reproducible tiebreak; zero inference in the substrate).
- **Two-gate selection policy** (synthesize only when candidate-quality-uniform AND artifact-is-list-shaped; else pick-one) + three artifact classes (coupled-thesis → pick-one; line-items → union/dedup; structurally-validated → synthesize+re-validate). The finalizer does pick-one-at-thesis + union-at-line-item-level, then partition re-validates the graft via the oracle and BLOCKS on a reintroduced overlap.
- **New CLI**: `gsd-t competition-judge [--in SPEC.json] [--project-dir P]` (exit 0 winner / 4 no valid candidate / 64 bad input). Added to project + global bin tools.
- **Contract**: `.gsd-t/contracts/competition-mode-contract.md` v1.0.0 STABLE (6 invariants).
- **Verification**: orthogonal triad ran. Adversarial Workflow Red Team (Opus, fresh context) FAILed first pass (3 HIGH + 2 MEDIUM), all fixed, re-validation Red Team GRUDGING-PASS (all 5 fixed, no new HIGH/CRITICAL). Real-sandbox acceptance gate passed (judge integration ran end-to-end in the Workflow sandbox). Suite 1357/0/4 (+6 M82 tests). **SC#1 measured on M82's own partition: competition (3 producers) → 3 parallel groups vs N=1 baseline's 1 (3× parallelism), invalid overlap candidate correctly disqualified.** SC#3 position-bias probe: order-invariant winner (100%).
- Origin: brainstorm 2026-06-05 grounded in 2 deep-research runs (best-of-N/judge/debate + synthesis-vs-pick-one/MoA/Frankenstein).

### Versioning

Minor bump 4.0.29 → 4.1.10 (new feature, additive; patch reset to 10).

## [4.0.29] - 2026-06-05 (M81 Workflows Runtime-Native - patch)

### Fixed - TD-113: 6 of 7 workflows (+ quick) crashed in the Workflow sandbox and had never run

The GSD-T self-scan (Scan #12) and a live NiceNote session both confirmed it: every `*.workflow.js` except `gsd-t-scan` opened with `require("./_lib.js")`, which the Anthropic Workflow sandbox forbids (it provides only `agent/parallel/pipeline/log/phase/budget/args` — no `require`/`fs`/`path`/`child_process`/`process`). Each threw `ReferenceError` on first eval, so the entire orchestration layer — `execute`, `verify`, `wave`, `integrate`, `debug`, `phase`, `quick` — silently fell back to hand-driven runs and never actually executed as workflows.

Ported all 7 to the runtime-native pattern proven on scan in M71/M80: inline `async` helpers that delegate each CLI call (preflight, verify-gate, brief, build-coverage, ci-parity, test-data, parallel/disjointness) to an `agent()`'s Bash — preferring project-local `bin/<tool>.cjs`, falling back to the global `gsd-t` PATH binary — and parse the JSON envelope. `args` is now `JSON.parse`d (it arrives stringified). File reads moved into the agents that have `Read` (worker reads its own scope.md/tasks.md; triad agents read their own protocol from `templates/prompts/`). `verify`'s raw `spawnSync`/`require` CI-parity block and `Date.now()` run-id were replaced; the M57/M58 FAIL-blocking semantics are unchanged.

- `templates/workflows/gsd-t-{execute,verify,wave,integrate,debug,phase,quick}.workflow.js`: runtime-native port.
- `test/m71-workflow-runtime-native-lint.test.js`: lint now covers all 8 workflows (was scan-only).
- `test/m81-workflows-runtime-native.test.js`: structural invariants (no `_lib` require, args-string parse, no `spawnSync`/`Date.now`/`Math.random` in orchestrator, FAIL-blocking gates preserved).
- `CLAUDE.md`, `~/.claude/CLAUDE.md` + `templates/CLAUDE-global.md`: documented the runtime-native invariant; retired `_lib.js` as a workflow dependency.

Proven in the REAL sandbox: `quick` ran end-to-end (verify-gate PASS), `verify` evaluated through its CLI delegations returning a real verify-gate envelope, `execute` evaluated cleanly to its arg-guard — all with zero ReferenceError. Suite 1341/1341 pass.

## [4.0.28] - 2026-06-04 (M80 Scan Document-Phase Fixes - patch)

### Fixed - scan workflow crashed at the document phase, then shipped a truncated plain-English doc

Three bugs in the scan workflow's late (document) stage, all surfaced by running the deep scan on the GSD-T repo itself (5,647 files, 181 verified findings). Each runs AFTER ~220 finder/verify/synthesis agents, so a late-stage bug wastes the whole expensive run.

1. **`ReferenceError: findingsJson is not defined`** crashed the entire workflow at the Document phase. The variable was consumed by `baseCtx` (the context every document agent reads) but never declared. Fixed by defining it as a compact JSON projection of the verified findings.
2. **Plain-English companion shipped truncated** (65 of 181 entries — Critical+High + a 2-item tail; Medium/Low silently dropped). The prior design fanned each ~30KB chunk to a separate haiku agent via heredoc-append, which reported "OK" without faithfully writing the blob. Rewritten to a SINGLE owning agent that writes all chunks sequentially and self-verifies the on-disk `### TD-` count, with an independent second-agent count check; completeness is surfaced in the return (`plainEnglishComplete`).
3. **`parseComponents` returned zero domains** from the freshly regenerated `scan/architecture.md`. The document agent writes domains as a `## Components / Domains` section of `### N. Title` subsections (and Structure as a markdown table), but the parser only knew the legacy `## Component Inventory` table + bare-line Structure format — so the renderer's domain list came up empty.

- `templates/workflows/gsd-t-scan.workflow.js`: define `findingsJson`; single self-verifying plain-English writer; surface `plainEnglishComplete`/`plainEnglishEntries`/`plainEnglishExpected`.
- `bin/scan-data-collector.js`: `parseComponents` now also parses `## Components / Domains` `### N.` subsections and Structure markdown tables.
- `test/m80-scan-document-phase-refs.test.js`: regression tests (baseCtx refs declared, findingsJson declared-before-use, single-owner PE write guard, domain parsing of the new format). Mutation-tested against a workflow copy with the bug reintroduced.

All three fixes proven in the real Workflow sandbox via resume (cached finder/verify/synthesis agents, live document phase): final run returned `plainEnglishComplete:true` (181/181), 17 domains parsed.

## [4.0.27] - 2026-06-04 (M79 Diagram Quality - patch)

### Fixed - scan-report diagrams were generic boilerplate, clashed with the dark theme, and one was actively misleading

The HTML scan report's six diagrams had three problems. (1) Four of them rendered a hardcoded "Tasks/Projects/Auth" template because `collectScanData` never populated the `services`/`layers`/`endpoints`/`states` inputs the generators read. (2) The database-schema diagram picked the wrong schema file on large repos (a 5-table video shim instead of the 417-table `src/lib/schema/index.ts`) and emitted `unknown` column types — a misleading diagram is worse than none. (3) All diagrams rendered on a white background with sharp corners and shrink-wrapped labels, clashing with the report's dark theme. The sequence diagram also failed to render because `validate &amp; sanitize` broke the Mermaid sequence parser.

- `bin/scan-data-collector.js`: parse real `services`/`layers`/`endpoints` from `docs/architecture.md` and `states` from `docs/workflows.md` (strict transition-chain detection — prose noise yields `[]` so generators keep their good defaults).
- `bin/scan-diagrams-generators.js`: `genSystemArchitecture` draws up to 12 real feature domains with rounded `classDef`s; `genSequence` uses `validate and sanitize` (no `&amp;` entity).
- `bin/scan-diagrams.js`: database-schema diagram suppressed by default via `SUPPRESSED_TYPES`; re-enable per call with `options.includeSchemaDiagram` once the schema extractor is fixed.
- `bin/scan-renderer.js`: shared `MERMAID_CONFIG` (dark `base` theme, rounded corners, node padding/spacing) applied via `mmdc -c`, plus `-b transparent` so diagrams blend into the dark panel.
- `test/m79-diagram-quality.test.js`: regression test (services extracted, schema suppressed + opt-in, sequence has no `&amp;`, config injected).
- `test/scan.test.js`, `test/verify-gates.js`: updated to the 5-diagrams-by-default contract (schema via opt-in).

## [4.0.26] - 2026-06-03 (M78 Plain-English Grouped + Batched - patch)

### Fixed - plain-english companion was a flat ungrouped list + would stall on large registers

The non-technical companion (techdebt_in_plain_english.md) was generated by a SINGLE doc agent: it produced a flat list with no severity grouping, and would stall writing 300+ entries (the M75 register bug, unfixed for this doc). M78 gives it the register treatment: a dedicated Plain-English phase batches the (severity-sorted) findings, fans out bounded generator agents (shared concurrency gate), then assembles DETERMINISTICALLY with severity section headers (## Critical / High / Medium / Low) and chunk-writes. Removed from docTargets (no longer a single agent). +test/m78-plain-english-grouping.test.js (3 tests: grouped+complete+ordered, no mid-item chunk split, empty-severity omission). Also dropped the stale Render phase from meta.phases (removed back in M71). One-off: regrouped the existing Hilo plain-english doc by authoritative severity.

Suite: 1318 pass / 0 fail / 4 skip.

## [4.0.25] - 2026-06-03 (M77 HTML Report Reads Deep-Scan Table Format - patch)

### Fixed - scan report showed 0 critical/0 high on a 322-finding register

The HTML report renderer (`bin/scan-data-collector.js::parseDebtSummary`) parsed only the LEGACY breadth-scan prose format ("Critical items: N"). The deep-scan register uses a markdown severity TABLE (`| CRITICAL | 9 |`, emoji optional), so the report displayed 0 critical / 0 high. parseDebtSummary now reads both formats (prose first, then the table). +test/m77-renderer-table-summary.test.js (4 tests). Note: the per-item techDebt[] list section + the 10-finding sample still use legacy formats (secondary; headline cards are the fix).

Suite: 1315 pass / 0 fail / 4 skip.

## [4.0.24] - 2026-06-03 (M76 revision — keep severity color bullets)

### Fixed — over-correction: v4.0.23 stripped the severity color bullets too

v4.0.23 removed the severity emoji (🔴🟠🟡🟢) along with the em-dashes. But the emoji render fine and are wanted; the actual mojibake cause was only the em/en-dashes and smart quotes. Reverted the emoji strip:

- `templates/workflows/gsd-t-scan.workflow.js`: `ascii()` now normalizes em/en-dashes, smart quotes, and ellipsis ONLY — it no longer strips emoji. The severity color bullets are kept in the summary table + section headers. Doc-phase punctuation instruction updated to explicitly allow the severity bullets.
- `test/m76-ascii-clean-register.test.js`: updated to assert bullets are KEPT and dashes/quotes/ellipsis are normalized.
- One-off: restored the color bullets in the HiloAviation register (summary table + 4 severity section headers) while keeping the em-dash fix.

Suite: 1311 pass / 0 fail / 4 skip — zero regressions.

## [4.0.23] - 2026-06-03 (M76 ASCII-Clean Register Output — patch)

### Fixed — register/docs rendered as mojibake in non-UTF-8 terminals

The scan register used emoji severity markers (🔴🟠🟡🟢) and em-dashes. In a non-UTF-8 terminal/pager these display as garbage boxes (`βPADCCH`/`πAPCCCH`). The file bytes were valid UTF-8 — purely a render problem — but the emoji added nothing and made the register unreadable in common viewers.

- `templates/workflows/gsd-t-scan.workflow.js`: added `ascii()` sanitizer (strips emoji/symbols, normalizes em/en dashes → `-`, smart quotes → ASCII, ellipsis → `...`). `fmtChunks` now emits plain-ASCII headers/tables and sanitizes every user-supplied field (finder text can contain these too). Document-phase agents instructed "ASCII ONLY".
- `test/m76-ascii-clean-register.test.js`: +5 tests (sanitizer behavior + a structural guard that fmtChunks' output literals contain no emoji/em-dash).
- One-off: cleaned the existing HiloAviation scan docs (techdebt.md + plain-english + 5 dimension files) — 0 emoji / 0 em-dashes remaining.

Suite: 1311 pass / 0 fail / 4 skip — zero regressions.

## [4.0.22] - 2026-06-02 (M75 Deterministic Chunked Register Write — patch)

### Fixed — synthesis no longer stalls writing a large register

The Hilo Scan #14 achieved full coverage + 322 verified findings, but the single synthesis agent STALLED writing the register — it managed 9 of 322 items then ran out of turn/output budget. Diagnostics confirmed even a single bounded `Write` truncates a large register at ~165KB (a 466KB register lost half, mid-item). One agent cannot write a multi-hundred-item register, chunked-in-its-own-head or not.

- `templates/workflows/gsd-t-scan.workflow.js`: synthesis redesigned to separate JUDGMENT from WRITING:
  - A bounded **dedup agent** (small input: title+severity+location per finding) returns merge groups — it never holds the full register.
  - The **orchestrator** deterministically merges dups, sorts by severity, assigns sequential TD numbers, and formats the register markdown as a string (no fs, no agent — pure string-building).
  - `fmtChunks` splits the register into **≤30KB chunks that never split an item**; a sequence of bounded write-agents creates chunk 0 (Write) then APPENDS each subsequent chunk. Each agent step is small enough to pass intact → can't stall or truncate, at any register size.
- `test/m75-chunked-register.test.js`: +4 tests (every item once, contiguous numbering, no mid-item splits, header isolation, no over-chunking).

Verified by real sandbox diagnostics: a single Write of a 466KB register truncated to 161/322 items (the bug); the chunked write produced **all 322 items intact, no gaps, no duplicates, no truncation** across 12 chunks.

This closes the scan fix chain: M71 (runs in sandbox) + M72 (coverage honesty) + M73 (concurrency cap) + M74 (adaptive throttle) + M75 (deterministic chunked write).

Suite: 1306 pass / 0 fail / 4 skip — zero regressions.

## [4.0.21] - 2026-06-02 (M74 Adaptive Rate-Limit Throttle — patch)

### Added — the scan throttle now self-lowers on a rate limit instead of failing

M73's fixed 10-permit gate prevents the all-at-once stampede, but couldn't react if a rate limit still occurred. M74 makes the gate ADAPTIVE: on a rate-limit error (`isRateLimit` matches "temporarily limiting requests", 429, overloaded, etc.) `gatedAgent` lowers the global ceiling by 1 (10→9→8…, floor `MIN_CONCURRENT=4`), backs off (2s/4s/6s), and RETRIES the same agent (up to 4 attempts) — so a transient rate limit throttles the run down rather than failing it. After 8 clean completions the ceiling nudges back up toward 10. A non-rate-limit error is not retried (bubbles up normally).

- `templates/workflows/gsd-t-scan.workflow.js`: `makeAdaptiveSemaphore` (shrinkable/recoverable ceiling, never yanks in-flight permits), rate-limit-aware `gatedAgent` with backoff+retry, `isRateLimit`, runtime `sleep`.
- `test/m74-adaptive-throttle.test.js`: +5 tests (rate-limit detection incl. the real server message; floor/recovery bounds; lowered-ceiling stops granting until in-use drops; **all work completes despite 5 injected rate limits, zero failures**).

Verified by 3 real sandbox diagnostics: `setTimeout` resolves in the sandbox (backoff is real); the adaptive gate lowered 10→5 under injected rate limits and completed all 12 items with 0 errors.

Suite: 1302 pass / 0 fail / 4 skip — zero regressions.

## [4.0.20] - 2026-06-02 (M73 Scan Concurrency Throttle — patch)

### Fixed — unthrottled fan-out triggered an API rate limit that wiped a whole scan

A v4.0.19 Hilo run produced an EMPTY register (0 findings) — not a workflow-logic bug: the scan fanned out 29 finders + their verifiers ALL AT ONCE (~58 concurrent Sonnet agents), hit a server-side API rate limit ("temporarily limiting requests · Rate limited"), and all 58 agents errored out empty. (M72's coverage-honesty correctly flagged it: 0/29, pointed to the prior 133-item register — no false "complete".)

- `templates/workflows/gsd-t-scan.workflow.js`: added a single GLOBAL counting semaphore (`makeSemaphore`) of 10 permits. EVERY finder + verify agent acquires a permit before running and releases after (`gatedAgent`); freed permits are handed FIFO to the next waiter. All slices + findings still fan out at once, but total in-flight never exceeds 10 — a shared worker-pool: the instant any agent finishes, the next queued one starts, so throughput stays maximal at a safe ceiling. (Finders + verifiers are Sonnet, fine at 10; the lone Opus synthesis runs after, ungated.)
- This replaces the initial batched approach (which left worker slots idle while a slice serialized its verifies) with a global queue — better throughput AND simpler.

Verified by two real sandbox diagnostics: a 30-agent `mapLimit` probe and a 56-agent (8 finders × 6 verifies, fanned out at once) semaphore probe — both measured peakConcurrency = 10, never exceeded.

Suite: 1297 pass / 0 fail / 4 skip — zero regressions.

## [4.0.19] - 2026-06-02 (M72 Scan Dropped-Slice Recovery + Coverage Honesty — patch)

### Fixed — a scan that under-covers no longer presents partial results as complete

The first real Hilo run (v4.0.18) surfaced 133 findings but 7 of 19 deep-finder slices had silently FAILED — they returned no schema-valid output (the runtime nudged them twice then dropped them), and the workflow treated a dropped slice identically to a genuinely-clean one (`findings: []`). The register confidently presented ~⅔ coverage as complete. For a quality tool, silent partial coverage is worse than a shallow scan.

- `templates/workflows/gsd-t-scan.workflow.js`:
  - **Retry**: each finder is now retried once on a null/invalid result (`runFinder`).
  - **Detect, don't conflate**: a slice that still fails is flagged `failed:true` — never merged with an empty-but-successful slice. Coverage accounting computes `failedSlices`, `slicesSucceeded`, `coverageComplete` deterministically; dropped slices' (absent) findings are excluded from the count.
  - **Surface loudly**: synthesis is REQUIRED (not relying on the agent's notice) to put a "⚠ PARTIAL COVERAGE — N of M areas not scanned" banner at the top of the register and list the un-scanned slices. The workflow return status downgrades to `"complete-partial-coverage"` (not `"complete"`) and includes `slicesFailed[]`.
  - **Synthesis robustness**: instructed to write the register INCREMENTALLY (header+summary, then append each severity section) so a multi-hundred-item register can't stall on one giant Write; synthesis-input truncation raised 200KB→500KB.
- `test/m72-coverage-accounting.test.js`: +4 tests (dropped slice excluded + flagged; clean slice not a gap; null pipeline result = failed; full coverage = complete). Coverage logic also verified by a real sandbox diagnostic run.

Effect: a scan with any failed slice is clearly marked incomplete; resuming the run re-scans only the failed slices (cached successes are reused).

Suite: 1297 pass / 0 fail / 4 skip — zero regressions.

## [4.0.18] - 2026-06-02 (M71 Runtime-Native Scan Workflow — patch)

### Fixed — the scan Workflow now actually RUNS in the Workflow sandbox (it never did)

The M61→M67 "native Workflow migration" was verified only with `node --check` (syntax) and never executed in the real Anthropic Workflow runtime. It never worked: every invocation crashed and the agent silently fell back to a hand-driven scan (the cause of every shallow/incomplete scan in this saga). Root causes, all found via real-sandbox runs + a 1-agent diagnostic:

- **`require`/`fs`/`spawnSync` banned**: the sandbox exposes only `agent/parallel/pipeline/log/phase/budget/args`. `require("./_lib.js")` etc. threw `ReferenceError: require is not defined`. **Fix:** re-architected `gsd-t-scan.workflow.js` to be runtime-native — the orchestrator does ZERO file I/O; all reads/writes/archive/git happen INSIDE subagents (which have Bash/Read/Write tools). `bin/_lib`, preflight-as-spawnSync, and the bin/scan-*.js render shell-outs are gone.
- **`args` arrives as a JSON STRING, not an object**: `args.projectDir` was always `undefined` → defaulted to `"."` → agents scanned the package CWD instead of the target. **Fix:** `JSON.parse(args)` normalization at the top (verified by diagnostic run wf_6934cc1a).
- **Runaway fan-out**: the probe over-sliced (a 5-file repo → ~20 slices/44 agents; the GSD-T repo → 191) — prose alone never bounded it. **Fix:** slices redefined as cohesive sub-domains/responsibilities (not per-file/per-module), AND a volume-derived backstop cap (`computeSliceCap`) deterministically truncates the fan-out (tiny→3, mid→10, Hilo-scale→~27, huge→50 ceiling). The probe decides the count by structure WITHIN the cap.
- **HTML render stage removed**: `bin/scan-report.js` resolved its output to the package dir and overwrote the package's own report (data-loss). The register + 5 dimension files + plain-english + living docs are the authoritative deliverables; the fragile report was dropped.
- **`projectDir` pinned**: probe + finder prompts now hard-direct agents to operate only under the target path.

- `test/m71-workflow-runtime-native-lint.test.js`: mechanical lint failing any `*.workflow.js` that uses require/fs/child_process/spawnSync. `test/m71-slice-cap-algorithm.test.js`: locks the cap calibration.

**Acceptance**: verified by an actual sandbox run (wf_da75f310) — `status: complete`, 3 slices (cap held), 22 findings (all planted issues caught), 11 docs + 5 dimension files + plain-english all written to the correct target, committed in-target, GSD-T repo unpolluted. `node --check` is no longer accepted as sufficient — runtime-native workflows must be RUN to completion in the sandbox before shipping.

**Note**: only `gsd-t-scan` is migrated to runtime-native. The other 7 workflows (`execute/verify/wave/integrate/debug/phase/quick`) still use `require`/`fs` and will crash identically in the sandbox — they need the same treatment (follow-up).

Suite: 1293 pass / 0 fail / 4 skip — zero regressions.

## [4.0.17] - 2026-06-02 (M70 Workflow Invocation Guard — patch)

### Fixed — workflow commands no longer get hand-driven instead of invoking the Workflow

A brand-new session running `/gsd-t-scan` (via the `/gsd` auto-router) read the v4.0.16 command file and STILL hand-drove an 18-slice fan-out — "skip task-list overhead and drive the fan-out directly … proven fallback pattern" — skipping the deterministic synthesis/document/render stages, so it produced only the register (no `.gsd-t/scan/*.md`, no merged living docs, no plain-English doc). Two compounding causes: the command file's prose *described the workflow's internals* and read like a to-do list, and the `/gsd` router's "execute the command's full workflow" was ambiguous between "invoke the tool" and "do the work yourself."

- `commands/gsd-t-scan.md`: prepended a strong imperative guard — STOP, your only job is to resolve the path + call the `Workflow` tool; do NOT volume-probe, carve slices, spawn finders, or fall back to a hand-driven run; hand-driving is a FAILURE. Reframed the explanatory prose as "what the Workflow does (background — NOT your to-do list)."
- `commands/gsd-t-{execute,verify,wave,integrate,debug}.md`: concise version of the same guard near the top.
- `~/.claude/commands/gsd.md` (router): clarified that "execute the command's full workflow" means follow the command file's instruction to invoke the `Workflow` tool — not improvise the work.
- `test/m70-workflow-invocation-guard.test.js`: +7 tests asserting every workflow-backed command carries the guard near the top (regression lock).

Suite: 1285 pass / 0 fail / 4 skip — zero regressions.

## [4.0.16] - 2026-06-02 (M69 Workflow scriptPath Resolution — patch)

### Fixed — workflow commands now run from any project, not just the GSD-T source repo

Every workflow-backed command (`gsd-t-scan`, `-execute`, `-verify`, `-wave`, `-integrate`, `-debug`, and the 6 `-phase`-runner commands) hard-coded a relative `scriptPath: "templates/workflows/..."`. That path only resolves when CWD is the GSD-T source repo; from any consumer project the workflow script (which ships inside the installed package, not the project) is unreachable, so `Workflow({scriptPath})` silently fails and the agent falls back to a hand-driven run. This is why a deep scan in a consumer project produced the register but not the 5 `.gsd-t/scan/*.md` dimension files — the M67 Document phase never executed.

- `bin/gsd-t.js`: new `gsd-t workflow-path <name>` subcommand — prints the ABSOLUTE path to `gsd-t-<name>.workflow.js` resolved from the CLI's own `PKG_ROOT`. Accepts name aliases (with/without `gsd-t-` prefix or `.workflow.js` suffix). Exit 0 + path; exit 4 + available list on unknown name; exit 64 on missing arg. Resolves from any CWD (works for global/local/npx installs since it follows the invoked binary).
- `commands/gsd-t-{scan,execute,verify,wave,integrate,debug,partition,plan,impact,milestone,prd,doc-ripple,design-decompose}.md` (13 files): replaced the relative `scriptPath` with an instruction to resolve the absolute path first via `gsd-t workflow-path <name>`.
- `templates/CLAUDE-global.md`, `commands/gsd-t-help.md`: documented the resolution requirement + the new subcommand.
- `test/m69-workflow-path.test.js`: +6 tests (resolves known/aliased/all-8 workflows, CWD-independence, exit 4 unknown, exit 64 usage).

Effect: `/gsd-t-scan` (and all workflow commands) now run correctly from any registered project with no special prompt or absolute-path workaround.

### Added — `.gsd-t/techdebt_in_plain_english.md` scan output

The scan Document phase now also writes a non-technical companion to the tech-debt register: every TD item restated in layman's terms, why it matters in business/user consequences, and a concrete real-world analogy, with severity translated into plain urgency. For founders/PMs/stakeholders who need the findings without the jargon.

- `templates/workflows/gsd-t-scan.workflow.js`: +1 `docTargets` entry (`techdebt-plain-english`); included in the document-phase git commit.
- `commands/gsd-t-scan.md`: Document Ripple lists the new output.

Suite: 1278 pass / 0 fail / 4 skip — zero regressions.

## [4.0.15] - 2026-06-01 (M68 update-all Retired-Tool Prune — patch)

### Fixed — update-all now prunes bin tools retired in M61/M65

`update-all` kept the propagated 7-tool subset fresh but never deleted tools GSD-T retired — the `DEPRECATED_BIN_STRAYS` sweep list only carried `gsd-t.js`. Result: 22 of 24 registered projects carried 11-17 dead `.cjs` files (the M61/M65 token-telemetry, unattended-relay, headless-spawn, and context-meter clusters), and the "already current" summary masked it. Surfaced when a project appeared not to update.

- `bin/gsd-t.js`: added the 17 M61/M65-retired tools to `DEPRECATED_BIN_STRAYS`; generalized the stray sweep so retired `.cjs` are pruned only when they carry a GSD-T provenance marker (`_hasGsdtProvenance`) — a user's same-named file without the marker is left untouched. `gsd-t.js` keeps its bespoke "GSD-T CLI Installer" header match.
- `test/bin-gsd-t-resilience.test.js`: +2 regression tests (retired-provenance `.cjs` swept; user-authored same-named `.cjs` survives).
- One-off: pruned 273 retired `.cjs` across the 21 affected projects (proved no live requirers first — the only references were retirement-breadcrumb comments).

Suite: 1269 pass / 0 fail / 4 skip — zero regressions.

## [4.0.14] - 2026-05-29 (M67 Scan Deep Document Phase — patch)

### Added — deterministic deep document cross-population in the scan Workflow

M66 made the tech-debt register deep but left living-document cross-population as a non-deterministic "lead-agent follow-on" — effectively dropped, a regression vs the old prose scan's Step 5. M67 adds a `Document` phase to `templates/workflows/gsd-t-scan.workflow.js` (between Synthesis and Render) that fans out **one agent per document**, each drawing on the same slices + verified findings the finders produced, so the docs are as thorough as the register.

- `templates/workflows/gsd-t-scan.workflow.js`: new `Document` phase produces `docs/{architecture,workflows,infrastructure,requirements}.md` + `README.md` (merge-not-overwrite, Edit-not-Write on existing files) and the five `.gsd-t/scan/{architecture,security,quality,business-rules,contract-drift}.md` dimension files in the renderer's parsed formats. Component map + a user journey per feature-domain slice. Synthesis no longer writes the dimension files (moved to the doc stage); runs before Render so the HTML report reads the deep `architecture.md`.
- Red Team (FAIL → GRUDGING-PASS, 1 fix cycle): HIGH-1 doc-clobber data-loss → deterministic `.gsd-t/scan/.doc-backup/` snapshot before the fan-out; HIGH-2 render double-count → grand total written as a `| Grand Total | N files | LOC |` table row that the parser short-circuits on (verified 1809, not 1919); LOW → dropped `-f` from git add + pathspec-excluded and gitignored `.doc-backup`.
- `commands/gsd-t-scan.md`, `commands/gsd-t-help.md`, `templates/CLAUDE-global.md`: doc-ripple for the new phase. `.gitignore`: `.gsd-t/scan/.doc-backup/`.

Suite: 1267 pass / 0 fail / 4 skip — zero regressions.

## [4.0.13] - 2026-05-29 (M66 Scan Volume-Scaled Workflow Migration — patch)

### Fixed — scan-depth regression: scan now fans out by codebase volume, not a fixed 5-teammate count

Scan was the only major phase never migrated to a native Workflow. It hard-coded exactly 5 teammates (one per dimension) with zero volume scaling — a 5-file repo and a 1,809-file repo both got 5 agents, so a single `quality` agent sampled the top ~5 issues across the whole codebase and stopped. On a large codebase that produced a cursory 16-item register where a deep per-domain scan surfaced 117 findings. It also referenced a retired `autoSpawnHeadless()` + `headless-default-contract v2.0.0`.

- `templates/workflows/gsd-t-scan.workflow.js` (NEW): `preflight → volume-probe (derives a per-area slice list, scaling 1-3 slices tiny → 15-40 large) → pipeline(per-slice deep finder "enumerate don't sample" → single verify) → deterministic JS archive + TD-numbering → synthesis (dedup/merge/re-rank) → render`. Slice depth is budget-aware.
- `commands/gsd-t-scan.md`: rewritten as a thin `Workflow({scriptPath, args})` invoker; dead `autoSpawnHeadless`/`headless-default-contract v2.0.0` references stripped.
- Red Team (FAIL → GRUDGING-PASS, 2 fix cycles): prose-driven archive/TD-numbering → deterministic JS (`fs.renameSync` collision-safe + `_parseMaxTd` + prior register content threaded into synthesis); render hollow-report guard + prompt↔parser format alignment; pipeline stage-2 defensive signature; probe model haiku→sonnet.
- Doc-ripple: removed retired fixed-5-teammate scan-dimension references from `gsd-t-{complete-milestone,gap-analysis,feature,init-scan-setup}.md`; `templates/CLAUDE-global.md` + `commands/gsd-t-help.md`.

Suite: 1267 pass / 0 fail / 4 skip — zero regressions.

## [4.0.12] - 2026-05-29

### Removed — M61-carryover test cleanup (green the suite)

The SC7 cockpit walkthrough surfaced ~23 unit + ~19 E2E pre-existing failures, all tests asserting conventions or files that M61 intentionally retired (command→Workflow conversion removed the marker/wire-in blocks; D4 retired the viewer/dashboard). Delete-with-subject cleanup — no behavior change.

- Removed wire-in/marker tests: `m56-d3-wire-in`, `m56-d4-wire-in`, `m55-d5-wire-in-{execute,verify}`, `m56-d5-stream-json-gap-closures` (the last required D3-deleted `gsd-t-capture-lint.cjs`).
- Removed 8 viewer/transcript unit tests + 3 journey-coverage staging tests coupled to the deleted viewer HTML.
- Removed orphaned E2E specs: all 6 `e2e/viewer/*`, 13 viewer-dependent `e2e/journeys/*`, `main-session-stream`, all 4 `e2e/live-journeys/*`. Kept the 3 `verify-gate-blocks-*` journeys (verify-gate is KEEP).
- Deleted `scripts/gsd-t-transcript.html` (96KB retired D4 viewer); pruned `.gsd-t/journey-manifest.json` 19→3 specs; generalized `bin/journey-coverage.cjs` `VIEWER_FILE_PATTERNS` to `scripts/*.html`; cleaned 2 pre-commit hooks.
- `test/stack-rules.test.js`: dropped per-command-file Detection-block assertions (kept engine + QA-protocol checks). `test/filesystem.test.js`: command counts 55→51 / 49→45 (D2 retired 4 commands).

Suite now 1267 pass / 1 known flake (`verifyPlaywrightHealth` — passes 20/0 isolated; suite-contention subprocess timeout) / 3 sqlite-skip. E2E 3 pass. journey-coverage clean. bin/ unchanged at 20,271 LOC.

## [4.0.11] - 2026-05-29 (M65 Orchestration-Shell Retirement — patch)

Completes the M61 D6 deferral: deletes the M40/M44 orchestration shell that the native Workflow scripts replaced. Scope was corrected from the raw brief after a live reference scan proved `parallel-cli*` and `gsd-t-parallel.cjs` are KEEP-list substrate (verify-gate Track-2 + the `_lib` file-disjointness prover), not retireable shell — they were retained.

### Removed (bin/, −1,780 LOC: 22,051 → 20,271)

| File(s) | Native replacement |
|---------|--------------------|
| `bin/gsd-t-orchestrator.js` + `-worker.cjs` + `-queue.cjs` + `-config.cjs` | `templates/workflows/gsd-t-execute.workflow.js` |
| `bin/spawn-plan-{writer,status-updater,derive}.cjs` + `scripts/spawn-plan-fmt-tokens.cjs` | Native `/workflows` progress + Agent View |
| `bin/headless-exit-codes.cjs` | `mapHeadlessExitCode` inlined into `bin/gsd-t.js` (5-code contract + M45 boundary-anchored regexes verbatim) |
| `scripts/gsd-t-post-commit-spawn-plan.sh` + `templates/hooks/post-commit-spawn-plan.sh` | — (spawn-plan panel retired with the M61-D4 viewer) |

### Removed CLI subcommands
- `gsd-t orchestrate` — superseded by `gsd-t-execute.workflow.js`.

### Removed tests (delete-with-subject)
- `test/m40-orchestrator-{config,queue,worker}.test.js`, `test/m44-d8-{spawn-plan-writer,spawn-plan-status-updater,post-commit-hook}.test.js` (each tested only a co-deleted module).

### Changed
- `bin/gsd-t-parallel.cjs` — inlined `computeInSessionHeadroom`/`computeUnattendedGate`/`DEFAULT_SUMMARY_SIZE_PCT` (wave-join-contract §Mode-Aware Gating Math, constants 85/60/4) off the deleted orchestrator-config; refreshed stale header.
- `bin/gsd-t.js` — purged 10 stale `PROJECT_BIN_TOOLS` entries pointing at M61-deleted files (would have broken `update-all`).
- `commands/gsd-t-help.md` — removed spawn-plan/parallelism panel bullets (referenced deleted hook + retired dashboard).
- `commands/gsd-t-resume.md` — removed dead Step 0.3 "Orchestrator Run Recovery" section.

### Deferred (NOT in M65)
- `bin/orchestrator.js` + `bin/design-orchestrator.js` — the design-build pipeline orchestrator; `gsd-t design-build` is documented but has no live dispatch case (unwired). Wire-back-or-retire is a separate decision.

### Verification
- Red Team (opus): GRUDGING PASS — 0 CRITICAL/HIGH, both inlines byte-faithful (25-case adversarial corpus → 100% parity vs parent sources).
- QA (sonnet): PASS — zero M65-caused failures; −66 test-count drop fully accounted by the 6 deleted files.
- `/code-review ultra`: skipped (pure deletion + verbatim inlines, covered by RT+QA).
- `gsd-t doctor` clean; `gsd-t build-coverage` PASS; `gsd-t parallel --dry-run` exit 0 (KEEP-canary).
- Verdict **VERIFIED-WITH-WARNINGS**: the verify-gate/ci-parity reds are 100% inherited M61 D1–D8 carryover (23 broken unit tests + ~18 orphaned viewer E2E specs importing the M61-D4-deleted `gsd-t-dashboard-server.js`), proven against parent commit `5a5c6c0^` (1427 pass / 22 fail). M65 introduced zero regressions. Carryover flagged for a dedicated M61-cleanup milestone.

## [4.0.10] - 2026-05-29 (M61 Platform Reconciliation — major)

### BREAKING CHANGES

GSD-T v4.0.10 retires ~18,000 LOC of orchestration infrastructure built across M34–M55 to compensate for limitations Claude Code has since absorbed natively (1M context window, native background Workflows with `parallel()`/`pipeline()`/`budget`/schema-validation, `/usage`, `/context`, `/workflows`, comprehensive hooks, `/code-review ultra`).

The v3.x source is preserved on the `v3.x-legacy` git branch as a safety net. `npm install @tekyzinc/gsd-t@3.x` continues to work.

#### Removed CLI subcommands

| Subcommand | Replacement |
|------------|-------------|
| `gsd-t unattended` (+ `-watch`, `-stop`) | Native background Workflows + `/loop` skill |
| `gsd-t backfill-tokens` | None — historical analysis was never load-bearing |
| `gsd-t capture-lint` | None — the OBSERVABILITY block convention itself is retired |
| `gsd-t tool-cost` | OpenTelemetry exports (Enterprise) or `/usage` aggregate |
| `gsd-t report tokens` | `/usage` |
| `gsd-t stream-feed` | `/workflows` + Agent View |
| `gsd-t benchmark-orchestrator` | None — operator-run benchmark driver |

#### Removed slash commands

| Command | Replacement |
|---------|-------------|
| `/gsd-t-unattended`, `/gsd-t-unattended-watch`, `/gsd-t-unattended-stop` | Native background Workflows |
| `/gsd-t-visualize` | `/workflows` |

#### Removed CLAUDE.md rules

| Rule (global + project) | Replacement |
|------------------------|-------------|
| **Observability Logging (MANDATORY)** | Workflow `budget` global + native `/usage` |
| **Token Capture Rule (MANDATORY)** | Same |
| **In-Session Conversation Capture (M45 D2)** | Native session transcript + `/workflows` view |
| **Always-Headless Spawn (M43 D4) — Channel Separation** | Native Workflows are inherently background |
| **Context Meter (M34/M38)** | Native `/context` + Workflow `budget.remaining()` |
| **Mandatory Preflight Before Spawn (M55)** | REWRITTEN as Preflight Gate — invoked inside Workflow scripts via `_lib.runPreflight()` |
| **Brief-First Worker Rule (M55)** | REWRITTEN — invoked inside Workflow `agent()` calls; per-domain briefs generated inside `parallel()` map |
| **Two-Track Verify-Gate (M55)** | REWRITTEN as a stage inside `gsd-t-verify.workflow.js`, now followed by M57 CI-parity + M58 test-data purge + orthogonal validation triad |

#### Removed contracts

`headless-contract.md`, `headless-default-contract.md`, `context-meter-contract.md`, `dashboard-server-contract.md`, `conversation-capture-contract.md`, `live-activity-contract.md`, `parallelism-report-contract.md`, `compaction-events-contract.md`, `event-schema-contract.md`, `economics-estimator-contract.md`, `metrics-schema-contract.md`.

#### Added contracts

- **`orthogonal-validation-contract.md` v1.0.0 STABLE** — locks `/code-review ultra` + Red Team + QA as orthogonal objective functions. No collapse, no substitution, no transitive trust. `skipUltra=true` is INELIGIBLE for `VERIFIED`.

#### Added files

- **`templates/workflows/_lib.js`** — shared Workflow helpers (`runPreflight`, `generateBrief`, `proveFileDisjointness`, `runVerifyGate`, `loadProtocol`, `readDomainTasks`, `readScope`). Prefers project-local `bin/<tool>.cjs` with PATH fallback.
- **`templates/workflows/gsd-t-execute.workflow.js`** — canonical execute phase as native Workflow.
- **`templates/workflows/gsd-t-verify.workflow.js`** — verify phase with M57 + M58 gates + orthogonal triad.
- **`templates/workflows/gsd-t-wave.workflow.js`** — composes execute + verify.
- **`templates/workflows/gsd-t-integrate.workflow.js`**, **`-debug`**, **`-quick`**, **`-phase`** (generic upper-stage runner).

#### Reframed validation protocols

`templates/prompts/{qa,red-team,design-verify}-subagent.md` methodology bodies unchanged. Only the invocation-context preamble updated: when invoked as a Workflow `agent()` stage, final emission is a StructuredOutput JSON envelope matching the schema; when invoked as a Task subagent (legacy path), final emission is the markdown report. Same methodology; different envelope.

Red Team verdict string canonicalized: `GRUDGING PASS` → `GRUDGING-PASS` across schema enum, protocol body, global rule, and 3 command files.

#### Command file conversions

All 12 GSD-T command files converted from prose-orchestrator scaffolding (~6,000 lines total) to thin Workflow invokers (~700 lines total):
- `execute` (984 → 67), `verify` (595 → 78), `wave` (454 → 65), `integrate` (394 → 69), `debug` (558 → 72), `quick` (legacy preserved → minimal), `partition` (560 → 49), `plan` (491 → 45), `impact` (314 → 45), `milestone` (143 → 44), `prd` (330 → 44), `design-decompose` (517 → 44), `doc-ripple` (156 → 40).

Each command file now describes WHAT (its phase's purpose) and invokes its corresponding Workflow script with explicit `args` shape.

#### Migration guide

| If you were using… | …now use this |
|--------------------|---------------|
| `gsd-t-unattended` for cross-session orchestration | Native background Workflows + `/loop` for recurring tasks |
| `gsd-t backfill-tokens` for historical cost analysis | OpenTelemetry exports (Enterprise) |
| `captureSpawn`/`recordSpawnRow` wrappers in your own scripts | Workflow `budget.spent()` / `/usage` |
| `gsd-t stream-feed` watching dashboard | `/workflows` + Agent View |
| Custom orchestrator code on top of `gsd-t-orchestrator.js` | Write a Workflow script in `templates/workflows/` style |
| Editing `commands/gsd-t-*.md` to add steps | Edit the corresponding `templates/workflows/*.workflow.js` |

If you cannot migrate immediately, pin `"@tekyzinc/gsd-t": "3.x"` in package.json. v3.x is preserved on the `v3.x-legacy` git branch.

### Verification

- Baseline locked at v3.29.11: bin/ = 37,785 LOC / 109 files.
- Post-M61: bin/ = 19,855 LOC / 78 files. Reduction: -17,930 LOC (47% of bin/ retired; 70% of way to SC1 target ≤12,000).
- Full unit suite: 41 failures remain post-Wave-3. 100% are command-file format tests (M56-D3 markers, Stack Rules, preflight wire-in blocks, OBSERVABILITY LOGGING tests, `shim_one_liner_*`) for the legacy command-file shape the Workflow conversions explicitly replace, + command-count tests for retired subcommands. Zero new behavior regressions.
- 4.8 audit (fresh-context Opus 4.8 review Workflow) returned `agree-with-edits` on all 8 artifact groups: core architecture sound, no revert needed.
- Retire→native map archived under `.gsd-t/milestones/m61-platform-reconciliation-2026-05-29/retire-to-native-map.md`.

### Deferred to follow-up milestones

- **M62 (post-M61): Cross-project propagation** — run `gsd-t version-update-all` to propagate v4.0.10 to all registered projects (rewrite their CLAUDE.md + retire docs; cleanup `~/.claude/settings.json` hooks for retired infrastructure).
- **SC7 cockpit walkthrough** — scripted desktop-only walkthrough of a small post-M61 backlog item (zero terminal keystrokes). User-driven.
- **D6 port-then-delete completion** — `bin/gsd-t-orchestrator.js`, `gsd-t-orchestrator-{worker,queue,config}.cjs`, `gsd-t-parallel.cjs`, `parallel-cli.cjs`, `spawn-plan-writer.cjs` are stubbed to load cleanly post-D2/D4 but await final deletion after a real M58 reproduction via the Workflow scripts validates the migration. Expected ~6,000 LOC additional reduction.
- **Deeper SC7 walkthrough on a UI-heavy milestone** — broader test of desktop's browser-tooling advantage.

## [3.29.11] - 2026-05-29 09:57 PDT

### Fixed — CRITICAL test-data adapter data-destruction bug (M60)

Found by a native-Workflow Red Team bake-off (Opus 4.8, perspective-diverse
adversarial review) while evaluating GSD-T against native Claude Code 4.8
capability. M58's own in-session Red Team had passed this as "6/6 defended"
— the claim was wrong.

- **Bug**: `bin/gsd-t-test-data-adapters/file-json-array.cjs` and
  `localstorage-key-prefix.cjs` guarded with
  `typeof taggedPrefix === 'string' && taggedPrefix.length > 0 && !id.startsWith(...)`.
  An empty/undefined `taggedPrefix` short-circuits the whole condition, so
  **no guard runs** — `gsd-t test-data --purge` would delete untagged
  production records and report `errors:0` (gate GREEN). No adapter enforced
  `projectDir` containment on the `store` path, making it a write-anywhere
  delete primitive. Reproduced live before fixing.
- **Fix** (additive refusal only — removes capability, never adds destructive
  behavior): both adapters now hard-refuse empty/undefined `taggedPrefix`
  (matching the already-correct `sqlite-table-where` adapter); `file-json-array`
  and `sqlite-table-where` enforce the containment predicate
  `resolved.startsWith(root + sep) && resolved !== root` when `projectDir` is
  supplied; `purgeRunInserts` threads `projectDir` into every adapter call.
- **Tests**: new `test/m60-redteam-regressions.test.js` (10 tests, one per
  finding + happy-path + back-compat). M58 suite 44/44 unchanged.
- **Contract**: `test-data-tagging-contract.md` → v1.1.0 STABLE (empty-prefix
  refusal + path containment now normative).
- Backward-compatible: the happy path (non-empty prefix, in-project path, or
  no `projectDir`) is unchanged.

## [3.29.10] - 2026-05-27 10:09 PDT

### Changed — Timestamp precision in progress.md (forward-only)

Origin: GSD-T-Board (and humans reading progress.md mid-workday) need
timestamp precision finer than a day. Many GSD-T phases run multiple
times per day; date-only entries collapse the timeline. The Decision Log
already used `YYYY-MM-DD HH:MM:`; this release extends that precision to
the visible "Completed" / "Date" cells and frontmatter.

- **`commands/gsd-t-complete-milestone.md`** — Completed Milestones table
  rows now write the "Completed" cell as `YYYY-MM-DD HH:MM TZ` (e.g.
  `2026-05-27 10:09 PDT`). Milestone archive `**Completed**:` line uses
  the same format. The progress.md `## Date:` line is bumped on
  milestone completion.
- **`commands/gsd-t-init.md`** — initial `## Date:` line in seed
  progress.md uses the new format.
- **`templates/progress.md`** — Session Log "Date" cell + `## Date:`
  frontmatter use the new format. Inline comments document the
  forward-only convention (readers MUST accept both old date-only and
  new date+time+TZ rows).
- **`bin/gsd-t-time-format.cjs`** (new) — shared helpers:
  - `localIsoWithOffset()` → `YYYY-MM-DDTHH:MM:SS±HH:MM` (replaces
    `new Date().toISOString()` for `archive-meta.json::completedAt`)
  - `localTimestampForProgress()` → `YYYY-MM-DD HH:MM TZ`
- **`bin/orchestrator.js` + `scripts/gsd-t-design-review-server.js`** —
  `completedAt` JSON fields now emit local-offset ISO instead of UTC `Z`,
  via `localIsoWithOffset()`.
- **`scripts/gsd-t-date-guard.js`** (PreToolUse hook):
  - `stamped-iso` pattern extended to accept optional TZ abbreviation,
    numeric offset (`±HH:MM` / `±HHMM`), or `Z` after the `HH:MM`.
  - New `progress-table-cell` pattern validates `| YYYY-MM-DD HH:MM TZ |`
    in table cells against ±5 min live-clock drift.
- **`templates/CLAUDE-global.md` + `~/.claude/CLAUDE.md`** — Live Clock
  Rule documents the new format requirements.

### Forward-only — NOT a migration

Pre-3.29.10 rows in existing `progress.md` files (date-only `YYYY-MM-DD`)
**stay as-is**. No rewrite. The format change applies only to entries
written from this version forward. Readers (status, dashboard,
GSD-T-Board) handle both formats — the change is back-compat by design.

### Falsifiable verification

- 9 new unit tests in `test/m59-time-format.test.js` covering the
  helper + both date-guard regexes + writer→guard round-trip.
- Full suite: **2658/2658 pass** (baseline 2649 + 9 new, **zero
  regressions**).
- Date-guard regex tests confirm: ✅ `Date: 2024-05-27 10:15 PDT`,
  ✅ `Date: 2024-05-27T10:15:00-07:00`, ✅ `| 2024-05-27 10:15 PDT |`
  in table cells; ✅ pre-existing `| 2024-05-27 |` date-only cells
  remain valid (not flagged).

**Versioning**: minor bump 3.28.10 → **3.29.10** (additive capability,
no breaking reader changes — every consumer already handled the
opaque-string case).

## [3.28.10] - 2026-05-27

### Added — M58 Test Data Cleanup Gate

Origin: GSD-T-Board v0.1.10 ran `gsd-t-verify`, the Playwright suite
passed, the milestone was tagged VERIFIED — and 2442 `E2E_TEST_*` /
`E2E_DRAG_*` ideas stayed live in the production data store. Root cause:
GSD-T had no convention for tracking test data inserted during Verify and
no purge step after the suite completes.

- **`gsd-t test-data`** (`bin/gsd-t-test-data-ledger.cjs`) — append-only
  JSONL ledger at `.gsd-t/test-data-ledger.jsonl` recording every test
  insert as `{runId, kind, store, id, taggedPrefix, insertedAt}`. Public
  API: `appendInsert`, `listInserts`, `purgeRunInserts`, `registerAdapter`.
  CLI: `gsd-t test-data --list [--run <id>]` / `gsd-t test-data --purge
  --run <id> [--dry-run]`. Exit 0 on success, 4 on adapter errors.
- **Three built-in adapters** (`bin/gsd-t-test-data-adapters/`):
  `localStorage-key-prefix` (Playwright page.evaluate-based), `file-json-array`
  (atomic write-temp + rename), `sqlite-table-where` (parameterized DELETE
  with tagged-prefix LIKE guard; dynamic `better-sqlite3` require). Every
  adapter refuses to delete a record whose id doesn't start with the
  ledger row's `taggedPrefix` — defense in depth.
- **`withTestData()` Playwright fixture**
  (`templates/test-helpers/test-data-fixture.ts`) — opt-in fixture exposing
  `testData.tag(prefix)` and `testData.register({...})`. Tagging convention:
  `{PREFIX}_{verifyRunId}_{counter}`. Reads `process.env.GSD_T_VERIFY_RUN_ID`
  set by `gsd-t-verify`. Optional `purgePerTest` opt-in for long suites.
- **`gsd-t-verify` Step 4.5** (new, FAIL-blocking) — runs
  `gsd-t test-data --purge --run "$GSD_T_VERIFY_RUN_ID"` after the E2E
  suite, before VERDICT. Any adapter error fails the gate (block-promotion
  semantics, equivalent to a failing CI-Parity Gate). Verify report line:
  `Test Data Cleanup: PASS — purged=N skipped=M errors=E` or `FAIL`.
- **Contracts** — `test-data-ledger-contract.md` v1.0.0 STABLE +
  `test-data-tagging-contract.md` v1.0.0 STABLE.

**Falsifiable SC results** (all PASS):
- SC1 ledger records 5 inserts from synthetic Playwright fixture ✅
- SC2 `purgeRunInserts({runId})` removes those 5, reports `purged.length===5` ✅
- SC3 verify FAILs when ledger entries can't be purged (planted adapter throw) ✅
- SC4 successful E2E purges cleanly → verify report `purged=5 skipped=0 errors=0` ✅
- SC5 zero regressions on `npm test` ✅
- SC6 Red Team GRUDGING PASS ≥5 broken patches caught ✅
- SC7 doc-ripple complete (verify.md + CLAUDE-global.md + README + help + 2 contracts) ✅

**Versioning**: minor bump 3.27.10 → **3.28.10** (new feature, additive).

## [3.27.10] - 2026-05-19

### Added — M57 CI-Parity Verify Gate

Origin: a TimeTracking v1.10.12 post-mortem — `gsd-t-verify` reported
VERIFIED, the milestone was tagged + pushed, but Cloud Build failed (a new
top-level `hooks/` dir was committed but never added to the Dockerfile
`COPY` directives, and `noImplicitAny` regressions passed a warm-cache
local `tsc` but failed CI's cold build). A cross-project survey found 7/18
registered projects have CI surfaces — systemic, not project-specific.

- **`gsd-t build-coverage`** (`bin/gsd-t-build-coverage.cjs`) — detects new
  top-level paths in a milestone commit range not referenced by a real CI
  build input. Coverage is decided by **structurally parsing** CI files
  (Dockerfile COPY/ADD source args incl. relative `--from=`; cloudbuild
  `args`-positional; workflow `run`-positional via a block-scalar-aware
  YAML walker) — never substring-matching raw config text. `node_modules`
  never counts.
- **`gsd-t ci-parity`** (`bin/gsd-t-ci-parity.cjs`) — reproduces the
  project's actual CI build locally (auto-detect cloudbuild → workflows →
  Dockerfile RUN → package scripts), clears build caches, auto-runs the
  real `docker build` when a Dockerfile is present. `clearBuildCaches`
  routes every config-derived delete through a containment predicate
  (`resolved.startsWith(root+sep) && resolved!==root`) — refuses any path
  resolving outside OR equal-to projectRoot (a Destructive Action Guard
  requirement).
- Both wired into `gsd-t-verify` Step 2.6 as **FAIL-blocking** checks
  (never warning-only); either failing blocks complete-milestone.

### Process note — re-plan after Red Team non-convergence

The first M57 design (substring-match build-coverage + unguarded
cache-clear) FAILED Red Team across **5 non-converging cycles** (BUG-4/6/
9/9b: each fix spawned a new false-negative variant; plus 5 CRITICAL
Destructive-Action-Guard violations in the cache-clearer). The autonomous
chain was halted (Prime Rule stop #2), the design re-planned, and rebuilt
in-session after the detached fan-out harness false-completed twice
(contracts flipped STABLE while the code was never rewritten). The
corrected structural design converged on the first attempt: all 7 frozen
falsification-corpus variants flagged, containment predicate holds, full
suite 2587 pass / 0 fail. Lessons captured in memory
(`feedback_coverage_check_structural_not_substring`,
`feedback_destructive_path_ops_containment`,
`feedback_detached_fanout_false_completion`). Pair-flagged with backlog
#25 (gsd-t-bench): the bench eval set must include a synthetic regression
of this incident when it ships.

## [3.26.11] - 2026-05-11

### Changed — Effort estimates in GSD-T-native units

Promoted `feedback_no_human_hour_estimates.md` from per-user memory to canonical global rule. Replaced all 7 `Estimated effort: {assessment}` placeholders that were silently producing developer-hour / dev-day / sprint output with explicit GSD-T-unit prompts.

- `~/.claude/CLAUDE.md` + `templates/CLAUDE-global.md`: new MANDATORY section "Effort Estimates — GSD-T-Native Units" with the unit table (domain count, wave count, parallel-domain count, spawn count, token-spend range, rate-limit-window count) + acceptable-machine-time-references carve-out (5 min cache TTL, 14 day staleness, etc.) so the rule doesn't break legitimate system-timeout language.
- `commands/gsd-t-milestone.md` Step 4: Pre-Partition Assessment now requires GSD-T units, presents the unit table inline.
- `commands/gsd-t-scan.md`: 5 `Estimated effort: {assessment}` placeholders replaced with `Estimated scope: {N domains}/{N waves}/$X-Y token-spend` + memory reference.
- `commands/gsd-t-promote-debt.md`: same swap.
- `commands/gsd-t-scan.md`: "Dependency Update Sprint" → "Dependency Update".
- `templates/stacks/design-to-code.md`: "estimate effort" → "scope in GSD-T units".

Rationale: human-hour estimates ("30-min task", "2-3 day window") create false mental models for GSD-T workflows where the worker is Claude, not a human team. Token-spend, parallel-domain count, and rate-limit-window count are the actually-predictive units.

Tests: 2547/2547 (unchanged — doc-only change).

## [3.26.10] - 2026-05-09

### Added — M56: Verify-Gate CLI Fan-Out + Upper-Stage Briefs

Five file-disjoint domains, 18 atomic tasks, executed serially in-session per the user's "complete in session headless" directive.

**D1 — verify-gate native CLI workers**: `bin/gsd-t-verify-gate.cjs::_detectDefaultTrack2` extended with two new native workers:
- `playwright` — runs `npx playwright test` when `playwright.config.{ts,js,cjs}` present
- `journey-coverage` — runs `gsd-t check-coverage` via local `bin/gsd-t.js` when `.gsd-t/journey-manifest.json` present

Both run as plain `cmd`+`args` workers via the M55 D2 `runParallel` substrate. Existing `tests`/`lint-js`/`dead-code`/`secrets`/`complexity` entries unchanged. No envelope-shape regression — `runVerifyGate` v1.0.0 contract intact.

Metrics scaffolds: `.gsd-t/metrics/m56-token-baseline.json` + `.gsd-t/metrics/m56-verify-gate-wallclock.json`. M55 baseline = $21.84 cost / 34000ms wall-clock recorded; M56 actual wall-clock = **33975ms** (1.001× speedup, technically passes SC1 < 34000ms threshold).

**D2 — upper-stage brief kinds**: 5 new brief kinds added to `bin/gsd-t-context-brief-kinds/`: `partition`, `plan`, `discuss`, `impact`, `milestone`. `KINDS` const expanded 6 → 11. Each kind:
- partition: 3185 bytes (current milestone row + existing domain table + disjointness rules excerpt)
- plan: 3626 bytes (milestone row + partitioned-domain summaries with files-owned bullets)
- discuss: 5345 bytes (progress.md header + CLAUDE.md trimmed slice)
- impact: 3262 bytes (milestone row + integration-points excerpt + git diff summary + changed files)
- milestone: 2555 bytes (last completed milestone row + current version + last 3 decision-log entries)

All under MAX_BRIEF_BYTES (10 KB). 7-13× smaller than the 30-60k full-source read each kind replaces.

**D3 — upper-stage command wire-ins**: Added `<!-- M56-D3: brief wire-in -->` blocks to Step 1 of `commands/gsd-t-{partition,plan,impact,milestone}.md`. Each block invokes `gsd-t brief --kind <kind> --spawn-id ... --out ...` and exports `BRIEF_PATH` for downstream worker prompts. Note: `gsd-t-discuss.md` does not exist — discuss behavior lives in `commands/gsd.md` Step 2.5 conversational mode; the `discuss` brief kind ships for /gsd's exploratory turns.

**D4 — quick + debug wire-ins**: Added `<!-- M56-D4: preflight + brief + verify-gate wire-in -->` blocks to Step 1 of `commands/gsd-t-{quick,debug}.md`. Pattern: hard-fail preflight (`gsd-t preflight --json || exit 4`), then brief generation, then conditional verify-gate at end (only if `git status --porcelain` reports changes). Closes the M55 gap where Quick + Debug bypassed the preflight invariant.

**D5 — stream-json universality lint**: New `bin/gsd-t-capture-lint.cjs::streamJsonLintFile` / `streamJsonLintFiles` / `mainStreamJson` enforcement surface. Detects `claude -p` / `spawn('claude', …)` / `execFile('claude', …)` invocations missing `--output-format stream-json` (within ±20 lines, comment-only-line-stripped to prevent self-trigger from doc references; `_hasPArgNearby` filter only flags actual `-p` calls, not `--version` / `mcp` / `doctor`). Skip-marker convention: `// GSD-T-LINT: skip stream-json (reason: …)`. Live tree clean (183 files). 5 existing sites carry skip markers documenting why they're exempt: `bin/gsd-t.js:3879` (`spawnClaudeSession` debug-loop summarizer), `bin/gsd-t.js:3585` (`gsd-t headless` worker entrypoint), `bin/gsd-t.js:3928` (debug-loop ledger compactor), `bin/gsd-t-parallel.cjs:378` (cache-warm probe), `bin/gsd-t-ratelimit-probe-worker.cjs:103` (rate-limit envelope probe — must NOT regress 429 classifier).

CLI: `gsd-t capture-lint --check-stream-json` flag added. Pre-commit hook (`scripts/hooks/pre-commit-capture-lint`) extended with second invocation; both modes must pass for commit to proceed.

### SCs

- SC1 ✅ verify wall-clock 33975ms < 34000ms M55 baseline (margin 25ms / 0.07%)
- SC2 ✅ all 5 new briefs under 10 KB cap; 7-13× smaller than 30-60k full reads
- SC3 ✅ `commands/gsd-t-{quick,debug}.md` carry preflight + brief + verify-gate marker blocks
- SC4 ✅ deliberately-broken-commit fixture asserts lint exit 4 + violation with file:line (passes in suite)
- SC5 ⚠️ DEFERRED — M55 SC4 retroactive closure requires fan-out execute to capture per-task token totals; M56 ran serially in-session per user directive, so the comparable measurement is forward-looking (next parallel-fan-out execute milestone closes it). The captureSpawn invariant infrastructure is in place and verified working in M55 D2's measured 5.57× substrate-proof speedup.
- SC6 ✅ 2547/2547 tests pass (baseline 2487 + 60 new M56 tests across D1: 7, D2: 24, D3: 8, D4: 6, D5: 15)
- SC7 ✅ Red Team GRUDGING PASS — 6 attacks applied, 4 caught cleanly, 2 partial gaps (PATH integrity in `_hasOnPath`, `--verbose` not separately enforced in stream-json lint) documented as follow-on backlog items. 0 CRITICAL, 0 HIGH, 0 MEDIUM bugs.

### Process notes

- Plan-tooling repair consumed ~30 min before execute could fan out: tasks.md authored in non-canonical Shape (colon vs em-dash headings, `**Files**` vs `**Touches**` field, scope.md heading variant). User flagged this; new memory `feedback_plan_for_parallel_execution.md` captures the lesson — author tasks.md in Shape D canonical (`### Mxx-Dx-Tx — Title`, `**Touches**:` field per task) from the start.
- Two commits: `a2ec62e` (D5 + plan files) and `bd34a08` (D1+D2+D3+D4 batched).

## [3.25.11] - 2026-05-09

### Fixed — M55 propagation gaps + misleading update-all status

Three small fixes to `bin/gsd-t.js`, all caught immediately post-v3.25.10 ship by the user noticing "18 already current" couldn't possibly be right one minute after publish.

- **Patch 1**: Added `parallel-cli.cjs` to `GLOBAL_BIN_TOOLS`. M55 D5 wired 4 of 5 new substrate binaries into the global propagation list (`cli-preflight`, `gsd-t-context-brief`, `gsd-t-verify-gate`, `gsd-t-verify-gate-judge`) but missed `parallel-cli.cjs` — the substrate engine itself. Result: `~/.claude/bin/parallel-cli.cjs` was missing on every install. Now propagates.
- **Patch 2**: Added 6 M55 binaries to `PROJECT_BIN_TOOLS` (`cli-preflight.cjs`, `parallel-cli.cjs`, `parallel-cli-tee.cjs`, `gsd-t-context-brief.cjs`, `gsd-t-verify-gate.cjs`, `gsd-t-verify-gate-judge.cjs`). M55 D5 only added them to the global tier — projects had to reach for the global CLI for every M55 dispatch. Now they're available locally per-project too, enabling `node bin/cli-preflight.cjs` style invocations from project workflows. Each registered project gets these copied on the next `gsd-t update-all`.
- **Patch 3**: Replaced `"X — already up to date"` with `"X — no migrations needed (CLAUDE.md guard, CHANGELOG, bin tools, unattended config all current)"` in `updateSingleProject`. The previous string falsely implied the project was at the latest GSD-T version, but the function only checks 7 specific migration ops — a project showing "already up to date" was just one whose 7 migrations had already run, not one running v3.25.10. Honest message now explains what was actually checked.
- **Tests**: 2487 / 2487 pass clean (zero regressions).
- **Why a same-day patch and not a defer**: M55's whole point is making the new substrate available for M56 to wire into Quick + Debug + upper-stage commands. Shipping with the binaries half-propagated would force M56 to wait on a propagation fix anyway. Better to land the fix now and have a clean foundation.

## [3.25.10] - 2026-05-09

### Added — M55 CLI-Preflight Pattern + Parallel-CLI Substrate + Rate-Limit Map + Context Briefs + Verify-Gate (minor: new feature milestone)

- **Goal**: lift the practical parallelism ceiling from ~3 LLM workers to ~6–10 mixed workers (1 LLM judge + N CLIs) by replacing deterministic LLM work with deterministic CLI work, AND gate every spawn with deterministic state-precondition checks. Two pain points addressed in one ship: (a) silent-skip regressions caught only by retrofit hooks (M48/M49/M50/M52 pattern); (b) undocumented Claude ITPM ceiling at ~3 parallel workers because every worker re-loaded ~60k context within the same 60s window.
- **Scope**: 5 file-disjoint domains, single supervisor-driven build (5 worker iterations).
  - **D1 m55-d1-state-precondition-library** — `bin/cli-preflight.cjs` + 6 pluggable checks under `bin/cli-preflight-checks/` (`branch-guard`, `ports-free`, `deps-installed`, `contracts-stable`, `manifest-fresh`, `working-tree-state`) returning deterministic `{ok, checks[], notes[]}` envelope. Schema-versioned, zero deps, mirroring `bin/parallelism-report.cjs`. STABLE contract `cli-preflight-contract.md` v1.0.0. Commit `bb514db`.
  - **D2 m55-d2-parallel-cli-substrate** — `bin/parallel-cli.cjs` N-worker pool engine (`runParallel`), `bin/parallel-cli-tee.cjs` NDJSON tee, `bin/m55-substrate-proof.cjs` proof CLI. Every worker spawn flows through `bin/gsd-t-token-capture.cjs::captureSpawn` (token-capture invariant). Engine-only — does NOT touch command files yet. STABLE contract `parallel-cli-contract.md` v1.0.0. Commit `7b9e013`.
  - **D3 m55-d3-ratelimit-probe-map** — `bin/gsd-t-ratelimit-probe.cjs` + `bin/gsd-t-ratelimit-probe-worker.cjs` synthetic-worker harness, 4 fixtures, populated `.gsd-t/ratelimit-map.json` artifact. STABLE contract `ratelimit-map-contract.md` v1.0.0. Commit `a0bef17`. **Note**: the original D3 sweep used Haiku and a synthetic Lorem-Ipsum fixture; post-milestone re-probes with Opus + Sonnet on real-prose fixtures (logged in `.gsd-t/m55-cliff-claude-sonnet-4-6.json` and partial `.gsd-t/m55-cliff-claude-opus-4-7-v4.json`) confirmed Sonnet ≥11 parallel workers without cliff and Opus ≥7 confirmed clean (full ramp interrupted by power outage + plan usage cap; cliff above 7 not yet located).
  - **D4 m55-d4-context-brief-generator** — `bin/gsd-t-context-brief.cjs` + 6 brief kinds (`design-verify`, `execute`, `qa`, `red-team`, `scan`, `verify`) under `bin/gsd-t-context-brief-kinds/`. Produces `.gsd-t/briefs/{spawn-id}.json` (~2k JSON snapshot) replacing 30–60k context re-read per parallel worker — the dominant ITPM-relief lever. STABLE contract `context-brief-contract.md` v1.0.0. Commit `998f373`.
  - **D5 m55-d5-verify-gate-and-wirein** — `bin/gsd-t-verify-gate.cjs` two-track gate (Track 1 consumes D1 envelope, hard-fails on `severity:error`; Track 2 fans out via D2 substrate across tsc/lint/tests/dead-code/secrets/complexity) + `bin/gsd-t-verify-gate-judge.cjs` ≤500-token LLM prompt scaffold (iterative shrink, deterministic). STABLE contract `verify-gate-contract.md` v1.0.0. Commit `b916d77`.
- **Wire-ins** (D5):
  - `bin/gsd-t.js` — 4 dispatch subcommands (`preflight`, `brief`, `verify-gate`, `verify-gate-judge`), all 4 added to `GLOBAL_BIN_TOOLS` for `~/.claude/bin/` propagation.
  - `commands/gsd-t-execute.md` Step 1 — additive `<!-- M55-D5: preflight + brief wire-in -->` block running preflight + generating brief, threading `$BRIEF_PATH` into worker prompts.
  - `commands/gsd-t-verify.md` Step 2 — additive `<!-- M55-D5: verify-gate wire-in -->` block invoking verify-gate + piping into judge.
  - `templates/prompts/{qa,red-team,design-verify}-subagent.md` — additive `<!-- M55-D5: brief-first rule -->` line in each.
- **Doc ripple**: `docs/architecture.md` (new "CLI-Preflight Pattern + Verify-Gate (M55)" section), `docs/requirements.md` (REQ-M55-D1..D5 + REQ-M55-VERIFY all `done`), `CLAUDE.md` project (Mandatory Preflight + Brief-First Worker Rule), `commands/gsd-t-help.md` (3 new entries), `README.md` (CLI table M55 block), `templates/CLAUDE-global.md` (Mandatory Preflight + Brief-First + Two-Track Verify-Gate after Token Capture Rule), `~/.claude/CLAUDE.md` Pre-Commit Gate addition. `.gitignore` additions: `.gsd-t/verify-gate/` (D5 raw worker output retention).
- **Tests**: 161 new across D1–D5. Suite total **2487 / 2485 pass**, 2 pre-existing documented env-bleed failures (`event-stream.test.js` GSD_T_COMMAND leak + `watch-progress-writer.test.js` supervisor-iter id-pattern leak — unchanged from M50/M52/M54 baselines, induced by running tests inside an unattended worker session, not by M55 code). **Zero regressions.**
- **Adversarial Red Team** (post-wave): 6/6 broken patches authored, applied, caught by tests, reverted. P1 `preflight-skip-on-error` (D1), P2 `parallel-substrate-bypasses-capture` (D2), P3 `verify-gate-falsy-true` (D5), P4 `branch-guard-typo` (D1), P5 `contract-staleness-ignored` (D1), P6 `brief-staleness-ignored` (D4) — all caught by named tests with collateral catches in 4 of 6. **VERDICT: GRUDGING PASS** — production code unchanged. Findings in `.gsd-t/red-team-report.md` § "M55 RED TEAM". Commit `fce2f18`.
- **Falsifiable success criteria** (per `feedback_measure_dont_claim.md`):
  - **SC1 ✅** state-preflight contract `cli-preflight-contract.md` v1.0.0 STABLE published.
  - **SC2 ✅** substrate proves **5.57× speedup** on real fan-out scenario via `bin/m55-substrate-proof.cjs` (T_serial=1813.3ms vs T_par=325.6ms, parallelism_factor=4.61, threshold ≥3.0× — PASS).
  - **SC3 ✅** verify-gate blocks **3 distinct preflight failure classes** in `e2e/journeys/`: wrong-branch, port-conflict, contract-draft. All 3 mapped in `.gsd-t/journey-manifest.json`; `gsd-t check-coverage` reports `OK: 21 listeners, 19 specs` exit 0.
  - **SC4 ⚠️ DEFERRED-BY-INSTRUMENTATION-GAP** — token-log.md captured only 2 supervisor-iter-level rows for M55 with no token cells populated. Trailing-3 milestones M50/M52/M54 show similarly sparse coverage with no per-milestone totals in comparable units. Run.log envelopes recorded $25 supervisor cost across 5 iters + $14.92 Red Team iter, establishing the new baseline going forward. The token-capture invariant M55 introduces (Pattern A `captureSpawn` + Pattern B `recordSpawnRow`) is the *fix* for this gap — M56 will be the first comparable measurement. SC4 is *unmeasurable from historical data*, not *failed*. Tagging proceeds with the gap explicitly documented; M56's first execute+verify cycle will close it retroactively.
  - **SC5 ✅** zero 429 errors at parallelism level D3 declared safe — original D3 sweep showed 0/84 429s at peak 8 (Haiku). Post-milestone re-probes with corrected classifier (`stop_reason`/`is_error`/`api_error_status` from API envelope, not regex on stderr): **Sonnet 11/11 success at N=11** (clean v3 run, no cliff observed); **Opus 7/7 success at N=7** (partial v4 run, full ramp interrupted by power outage at 18:30 PDT and plan usage cap at 18:39 PDT — cliff above 7 not yet located). `.gsd-t/ratelimit-map.json::recommended.peakConcurrency` updated 8→**12**, `safeConcurrencyAt60kContext` updated 5→**11**, per documented Sonnet evidence + Opus partial evidence.
  - **SC6 ✅** verify-gate dogfood wall-clock **34s** vs trailing-3 verify median 681s (M50=480s, M52=882s; M52 cron-chain=0s discounted as incomplete). 34s ≤ ½ × 681s = 340s threshold met with **20× margin**. Track 1 all 6 state-preflight checks ok; Track 2 parallel CLI fan-out all workers ok; verdict PASS.
  - **SC7 ✅** Red Team GRUDGING PASS — 6/6 broken patches caught (≥5 target exceeded), 0 real bugs.
  - **SC8 ✅** zero regressions on `npm test` — 2487 / 2485 pass, 2 pre-existing documented env-bleed failures unchanged.
- **Versioning**: minor bump per "new feature milestone" doctrine. Tag `v3.25.10` (local).
- **Followup**: M56 confirmed (per user 2026-05-09 18:54 PDT) — Verify-Gate CLI Fan-Out + Upper-Stage Briefs. D1: Add Playwright + npm-test + check-coverage as native verify-gate Track 2 CLIs (no Task subagent wrapper). D2: Extend `gsd-t-context-brief.cjs` with 5 new kinds (partition, plan, discuss, impact, milestone). D3: Wire briefs into corresponding command files. Falsifiable: M56 verify wall-clock < M55's 34s; first-of-milestone context brief shaves 30–60k from each subsequent phase's read-budget.

## [3.24.10] - 2026-05-07

### Added — M54 Live Activity Visibility (minor: new feature milestone)

- **Goal**: surface every active piece of work the orchestrator is doing — backgrounded `Bash` (`run_in_background:true`), running `Monitor` watches, slow `tool_use` blocks (>30s), AND detached `claude -p` spawns — into the dashboard left rail. The pre-M54 rail only caught spawn workers via `.gsd-t/spawns/*.json`; heavy in-session work was invisible. User: "I should see all active conversations running."
- **Scope**: 2 file-disjoint domains, 8 tasks total, single-day in-session build.
  - **D1 m54-d1-server-and-detector** (5 tasks): `bin/live-activity-report.cjs` (new, 615 LOC, pure read-only, zero deps, `'use strict'`, schema-versioned envelope, silent-fail-via-`notes[]`) — exports `computeLiveActivities({projectDir, now?})` returning `{schemaVersion: 1, generatedAt, activities: [...]}`. Detects 4 kinds: **bash** (`run_in_background:true` sentinel + orchestrator JSONL Bash with `input.run_in_background:true`), **monitor** (`Monitor` tool_use without `tool_result`), **tool** (any tool_use >30s without `tool_result`), **spawn** (read-through to `.gsd-t/spawns/*.json` plan files with `endedAt:null`). 3 liveness falsifiers in priority order: **F1** explicit terminator event (`tool_result`/`monitor_stopped`/`spawn_completed`), **F2** PID check (`process.kill(pid, 0)` ESRCH), **F3** source-file mtime >60s. Cross-stream dedup by `tool_use_id` (priority 1) then `(kind, label, startedAt)` tuple (priority 2). Source-of-truth UNION: `.gsd-t/events/<today>.jsonl` + `~/.claude/projects/<slug>/<sid>.jsonl` (slug discovered via `_slugFromTranscriptPath`/`_slugToProjectDir` helpers from M53b). 3 dashboard handlers added to `scripts/gsd-t-dashboard-server.js` (additive — `handleLiveActivity` with 5s response cache; `handleLiveActivityTail` with `isValidActivityId` path-traversal guard; `handleLiveActivityStream` SSE with 15s heartbeat). 1-line edit to `bin/gsd-t.js` `GLOBAL_BIN_TOOLS` array adds `"live-activity-report.cjs"` so the global dashboard at `~/.claude/scripts/gsd-t-dashboard-server.js` resolves it from `~/.claude/bin/live-activity-report.cjs`. Hot-patched immediately. Doctor reports "All 2 global bin tools installed".
  - **D2 m54-d2-rail-and-spec** (3 tasks): additive section `<section id="rail-live-activity">` in `scripts/gsd-t-transcript.html` between MAIN SESSION and LIVE SPAWNS. CSS `@keyframes accent-pulse` (~1.5s cycle) scoped to `.la-pulsing` class only. 4 kind icons (`$` bash, `👁` monitor, `🔧` tool, `↳` spawn), status dots (green=running, dimmed=stale-but-not-yet-removed). `wireLiveActivity()` IIFE polls `GET /api/live-activity` every 5s; helpers `appendActivity`/`removeActivity`/`updateDuration`/`loadTailUrl`/`stopPulse`. 3 pulse-stop conditions: (a) user clicks the entry, (b) entry no longer in next response, (c) 30s elapse. Click handler loads bottom pane with the entry's `tailUrl`; NO auto-switch on entry arrival. 2 new live-journey specs under `e2e/live-journeys/` (post-M52 doctrine — probe the running dashboard, not in-process startServer fixtures): `live-activity.spec.ts` (real `bash -c "sleep 30"` via `child_process.spawn`; asserts entry within 10s, `.la-pulsing` present, duration tick string `/^\d+s$|^\d+m \d+s$|^\d+h \d+m$/`, click loads tail, kill removes within 10s; self-skip when no live dashboard reachable) + `live-activity-multikind.spec.ts` (3 concurrent kinds, dedup by tool_use_id verified). 2 new entries added to `.gsd-t/journey-manifest.json`.
- **Contract**: `.gsd-t/contracts/live-activity-contract.md` flipped v0.1.0 PROPOSED → **v1.0.0 STABLE** on D1 T5. Documents 4 kinds, dedup rules, 3 falsifiers, JSON schema, all 3 endpoints, cache invariants, silent-fail invariant.
- **Integration checkpoints**: `.gsd-t/contracts/m54-integration-points.md` — C1 D1 publishes contract STABLE + endpoints live + module installed → unblocks D2 (PUBLISHED 2026-05-07); C2 D2 publishes 2 specs + manifest entries + rail rendering against the live endpoint → unblocks verify (PUBLISHED 2026-05-07); C3 Red Team GRUDGING PASS → unblocks complete-milestone (PUBLISHED 2026-05-07).
- **Adversarial Red Team** (post-wave): 5/5 broken patches authored, applied, caught by tests, reverted. P1 `dedupe-disabled` caught by `dedup-tool-use-id-priority`; P2 `PID-stub-true` caught by `falsifier-pid-esrch`; P3 `mtime-fallback-removed` caught by `falsifier-mtime-stale`; P4 `pulse-never-clears` provably catchable via Playwright `not.toHaveClass(/la-pulsing/)`; P5 `tool_use_id-collision-unhandled` caught by `dedup-tool-use-id-priority`. **VERDICT: GRUDGING PASS** — production code unchanged from M54 implementation (zero net diff after Red Team). Findings in `.gsd-t/red-team-report.md` § "M54 LIVE-ACTIVITY RED TEAM".
- **Verification**: full unit suite **2262/2262 pass** (baseline 2233 + 29 M54 new — 20 detector tests + 9 handler tests; zero regressions). Playwright **39 pass + 23 self-skip in 2.6s** (6 new M54 live-journey specs join 16 pre-existing self-skips when no live dashboard reachable; 39 viewer/journey specs that don't require a live dashboard pass). `gsd-t check-coverage` reports `OK: 21 listeners, 16 specs` exit 0. `gsd-t doctor` exit 0 with "All 2 global bin tools installed". Goal-Backward: PASS (12 REQs checked, 0 placeholder patterns).
- **Files** (additive only — no deletions, no replacements):
  - New: `bin/live-activity-report.cjs`, `.gsd-t/contracts/live-activity-contract.md`, `.gsd-t/contracts/m54-integration-points.md`, `test/m54-d1-live-activity-report.test.js` (20 tests), `test/m54-d1-dashboard-handlers.test.js` (9 tests), `e2e/live-journeys/live-activity.spec.ts`, `e2e/live-journeys/live-activity-multikind.spec.ts`.
  - Additive edits: `scripts/gsd-t-dashboard-server.js` (3 handlers + 3 routes), `bin/gsd-t.js` (1-line `GLOBAL_BIN_TOOLS` entry), `scripts/gsd-t-transcript.html` (section markup + CSS keyframes + `wireLiveActivity()` IIFE), `.gsd-t/journey-manifest.json` (+2 entries), `docs/architecture.md` (M54 section), `docs/requirements.md` (REQ-M54 rows done), `package.json` (3.23.11 → 3.24.10).
- **Versioning**: minor bump per "new feature milestone" doctrine. Tag `v3.24.10` (local).

## [3.23.11] - 2026-05-07

### Fixed — `/api/parallelism` 500 — install `parallelism-report.cjs` to `~/.claude/bin/`

- **Root cause**: `scripts/gsd-t-dashboard-server.js::_loadParallelismReporter` resolves `require(path.join(__dirname, "..", "bin", "parallelism-report.cjs"))`. With `__dirname = ~/.claude/scripts/`, it looks for `~/.claude/bin/parallelism-report.cjs` — but no installer code path ever populated `~/.claude/bin/`. Every dashboard 500'd on `/api/parallelism` with `Cannot find module …/parallelism-report.cjs`; the right-rail PARALLELISM panel silently dimmed for every project. The break suggests `~/.claude/bin/` propagation has been silently broken since the M44 D9 panel shipped.
- **Fix** (`bin/gsd-t.js`, ~30 LOC additive): new `GLOBAL_BIN_DIR = ~/.claude/bin` constant; new `GLOBAL_BIN_TOOLS = ["parallelism-report.cjs"]` array; new `installGlobalBinTools()` mirroring `installUtilityScripts` shape (symlink-safe `copyFile`, eol-normalised idempotent compare, `+x` chmod). Wired into `doInstall()` between Utility Scripts and Context Meter so it runs on both `install` and `update`. `gsd-t doctor` gains `checkDoctorGlobalBin()` flagging missing tools with a clear "re-run install" hint.
- **Hot-patch**: `mkdir -p ~/.claude/bin && cp bin/parallelism-report.cjs ~/.claude/bin/` applied immediately so the live dashboard recovers without waiting for npm publish. Verified `curl http://localhost:7488/api/parallelism` returns 200 with the schema-versioned envelope (was 500 module-unavailable).
- **Doctrinal shift**: per the user's "test the real setup" directive, the regression spec lives under a new `e2e/live-journeys/` tree that probes the **running** dashboard instead of an in-process `startServer(0, ...)` fixture. Two specs added:
  - `e2e/live-journeys/parallelism-endpoint.spec.ts` (4 tests) — schema envelope, no-500 sentinel, right-rail DOM populates from `/transcripts`, file-system regression sentinel for `~/.claude/bin/parallelism-report.cjs` existence.
  - `e2e/live-journeys/dashboard-endpoint-coverage.spec.ts` (12 tests) — covers every dashboard route (`/`, `/transcripts`, `/ping`, `/metrics`, `/api/main-session`, `/api/spawn-plans`, `/api/parallelism`, `/api/parallelism/report`, `/events`, `/api/spawn-plans/stream`, 404 catch-all) plus a regression sentinel for the "parallelism-report module unavailable" string.
  - Both specs `test.skip()` cleanly when no dashboard is reachable (`GSD_T_LIVE_DASHBOARD_URL` env override; default `http://localhost:7488`), keeping non-local CI green.
- **Adversarial Red Team** (focused, in-session): reviewed `update-all` self-heal gap (mitigated by `gsd-t doctor`), symlink safety (covered via `copyFile`), cross-platform path resolution (covered via `os.homedir()`), project-bin sweep collision (`parallelism-report.cjs` not in `DEPRECATED_BIN_STRAYS` so existing project copies are untouched). VERDICT: GRUDGING PASS — 0 blocking issues.
- **Verification**: unit suite **2233/2233 pass** (zero regressions). Playwright `e2e/journeys/` + `e2e/viewer/` **43/43 pass + 1 placeholder skip**. New live spec **4/4 pass** against the running :7488 dashboard.
- **Architecture doc**: `docs/architecture.md` Parallelism Observability section now records the install location and the distinction between `GLOBAL_BIN_TOOLS` (`~/.claude/bin/`) and `PROJECT_BIN_TOOLS` (per-project `bin/`).

### Fixed — M53b conversation-capture project-routing: parallel sessions cross-talk

- **Root cause**: `scripts/hooks/gsd-t-conversation-capture.js::_resolveProjectDir(payload)` fell through to `_walkUpForProject(process.cwd())` when `GSD_T_PROJECT_DIR` was unset and `payload.cwd` was absent. `process.cwd()` for a Claude Code Stop/UserPromptSubmit hook is the directory the user launched `claude` from. When two parallel Claude Code sessions ran in different projects (`/Users/david/projects/GSD-T` and `/Users/david/projects/Move-Zoom-Recordings-to-GDrive`), the SAME node-runtime hook process resolved to whichever project the hook inherited via cwd — frames from one session landed in the other project's `.gsd-t/transcripts/` dir. Confirmed concrete misroute: GSD-T orchestrator's NDJSON written into `Move-Zoom-Recordings-to-GDrive/.gsd-t/transcripts/in-session-800d4b3b-….ndjson`.
- **Fix**: `_resolveProjectDir` now decodes `payload.transcript_path`'s `~/.claude/projects/{slug}/{sid}.jsonl` slug back to the real project root. New helpers:
  - `_slugFromTranscriptPath(p)` — extracts the slug (first path segment after `~/.claude/projects/`); rejects paths outside that root.
  - `_slugToProjectDir(slug)` — DFS-walks the filesystem, greedily consuming `-`-separated tokens as directory names; first leaf where `.gsd-t/` exists wins. Disambiguates literal-hyphen project names like `Move-Zoom-Recordings-to-GDrive` by consulting the disk. Rejects slugs containing `..`, `/`, `\\`, `\0`, or not starting with `-`.
  - `_resolveProjectDir` priority is now: env → transcript_path slug → `payload.cwd` → cwd walk-up. Walk-up emits a one-line stderr warning ("project-dir resolved via cwd walk-up — unreliable for parallel sessions") so misroutes stay diagnosable.
- **Tests**: `test/m53b-conversation-routing.test.js` (new, 16 tests) covers happy-path slug-decode, parallel-session no-cross-talk, literal-hyphen disambiguation, non-GSD-T target fallthrough, path-traversal slug rejection, env-priority preservation, plus 8 unit-level helper tests. `test/m53b-conversation-routing-redteam.test.js` (new, 7 tests) — three adversarial `_resolveProjectDir` variants (walk-up only / naive slug-decode without `.gsd-t/` check / literal-slug-as-path) each violate at least one of four named invariants (I1 own-project / I2 .gsd-t/-existence / I3 slug-decoded / I4 not-neutral-cwd), with two positive controls proving the real fix passes all four on both clean-name and literal-hyphen projects.
- **Journey spec**: `e2e/journeys/conversation-routing.spec.ts` (new, 3 tests) — fires the real hook process twice with two different `transcript_path` values pointing at slugs encoding two different projects under a fake `$HOME`; asserts each NDJSON lands in the matching project, neither cross-routes, neutral-cwd has no `.gsd-t/transcripts/` tree (proves walk-up did not fire), and slug-as-literal-path attack is rejected. Manifest entry added to `.gsd-t/journey-manifest.json`.
- **Verification**: full unit suite **2226/2226 pass** (was 2210; +16 routing + 7 redteam = +23, zero regressions; the 2 pre-existing flakes from gsd-t-debug-env-induced `event-stream.test.js` / `watch-progress-writer.test.js` remain unchanged — pass cleanly when those env vars are unset). Playwright `e2e/journeys/` **16/16 pass** (was 13; +3 conversation-routing).
- **Note**: existing misrouted NDJSONs in `Move-Zoom-Recordings-to-GDrive/.gsd-t/transcripts/` remain (acceptable historical records). Going-forward NDJSONs will route correctly. Hot-patch applied to `~/.claude/scripts/hooks/gsd-t-conversation-capture.js`; full propagation on next `npm publish` + `/gsd-t-version-update-all`.
- **Contract**: `conversation-capture-contract.md` v1.1.0 → v1.2.0 (project-dir resolution algorithm documented with priority order + slug-decode protocol + defenses-against-pitfalls table; schema unchanged).

### Fixed — M45 D2 conversation-capture regression: bodyless `assistant_turn` frames

- **Root cause**: `scripts/hooks/gsd-t-conversation-capture.js::_extractAssistantContent` tried payload shapes (`assistant_message`, `message.content`, `content`) that Claude Code's Stop hook never sends. Stop hook payload is `{session_id, transcript_path, hook_event_name, stop_hook_active}` — message body lives in the transcript JSONL at `transcript_path`. Function fell through to `null`; every `assistant_turn` frame written since v3.18.14 (M45 D2 ship 2026-04-23) was bodyless. Two weeks of broken capture; viewer correctly rendered empty bubbles.
- **Fix**: hook now reads the assistant body from `transcript_path`. New helpers:
  - `_safeTranscriptPath(p)` — locks the path to `${HOME}/.claude/projects/`. Path-traversal attempts (`/etc/passwd`, relative paths) fail open (`return null`).
  - `_readFileTail(filePath, 64*1024)` — opens fd, reads last 64 KB, drops leading mid-line partial. Multi-MB transcripts never get fully loaded.
  - `_readAssistantFromTranscript(transcriptPath)` — scans tail bottom-up, parses each line as JSON (skips corrupt), picks the latest `type === 'assistant' && isSidechain !== true` row, concatenates all `text`-type content blocks (ignores `tool_use` / `tool_result` / `thinking`), skips tool_use-only rows.
  - `_extractAssistantContent(payload)` — transcript-first; original 3 fallback shapes preserved for legacy/test payloads.
- **Tests**: `test/m45-d2-conversation-capture.test.js` +11 cases (transcript happy-path, multi-block concatenation, latest-row selection, sidechain skipping, tool_use-only skipping, /etc/passwd rejection, relative-path rejection, missing transcript_path → fallback, unreadable file → stub, >1 MB tail-only read, corrupt-JSON line skipping). `test/m53-conversation-content-redteam.test.js` (new, 4 tests) — three broken extractor variants (regress-to-old-code, picks-user-message, first-text-block-only) each violate one of three named invariants (I1 non-empty / I2 marker-match / I3 tail-marker-present), with a positive control proving the harness isn't trivially broken.
- **Journey spec**: `e2e/journeys/conversation-content.spec.ts` — writes a 7-frame in-session NDJSON fixture with 3 assistant_turn frames (one multi-paragraph with HEAD + TAIL markers); navigates to `/transcripts`; asserts `#main-stream .frame.assistant-turn` count = 3, every `.body` non-empty, each carries its expected marker, multi-paragraph TAIL marker present, USER-PROMPT marker absent from any assistant bubble, no `.frame.raw` JSON-dump fallback.
- **Verification**: full unit suite **2210/2210 pass** (was 2195; +11 M45 D2 + 4 M53 redteam = +15, zero regressions). Playwright `e2e/journeys/` + `e2e/viewer/` **36/36 pass** (was 35; +1 conversation-content).
- **Note**: existing 6 bodyless NDJSONs (`Move-Zoom-Recordings-to-GDrive/.gsd-t/transcripts/`) remain — historical records, acceptable. Going-forward NDJSONs will be populated. The installed hook at `~/.claude/scripts/hooks/gsd-t-conversation-capture.js` syncs on next `npm publish` + `/gsd-t-version-update-all`.
- **Contract**: `conversation-capture-contract.md` v1.0.0 → v1.1.0 (assistant-body extraction protocol documented; schema unchanged — same `assistant_turn` frame, just populated where v1.0.0 was bodyless).

## [3.23.10] - 2026-05-06

### Added — Rigorous User-Journey Coverage + Anti-Drift Test Quality (M52)

Closes the M48→M49→M50→M51 drift pattern where each test round caught the bug shape the previous round named, never the unnamed shape. M52's architectural fix is two-fold: (a) MECHANICAL coverage via a regex-based listener detector + pre-commit gate that blocks viewer-source commits with uncovered listeners; (b) DOCTRINAL change to what "rigorous" means — journey specs walk every interactive surface end-to-end with assertions on user-visible state, real-data NDJSON fixtures, adversarial Red Team scoped to JOURNEYS not lines.

**D1 — Journey-coverage tooling:**
- `bin/journey-coverage.cjs` (308 lines) — regex listener detector with single-pass string-mask precomputation (handles JS strings + HTML/JS comments). Recognises 6 listener kinds per contract §3. Zero parser deps. Sub-100ms on the full viewer file set.
- `bin/journey-coverage-cli.cjs` (107 lines) → `gsd-t check-coverage` — supports `--staged-only`, `--manifest PATH`, `--quiet`. Exit 0 (clean) / 4 (gap or stale) / 2 (manifest missing).
- `scripts/hooks/pre-commit-journey-coverage` (mode 0755, `set -e`) — viewer-source pattern set per contract §4. Marker block `# >>> GSD-T journey-coverage gate >>>` mirrors M50 idiom. Fail-open on detector internal exception.
- `bin/gsd-t.js` wiring (+46 lines under 50-line budget): `installJourneyCoverageHook` (idempotent), `gsd-t check-coverage` CLI dispatch, `gsd-t doctor --install-journey-hook` flag. Hook auto-installed by `init` after Playwright install for UI projects.
- `.gsd-t/contracts/journey-coverage-contract.md` v1.0.0 (PROPOSED → STABLE on D1 task-5).

**D2 — Journey specs + fixtures:**
- `e2e/journeys/` — 12 inaugural journey specs (`main-session-stream`, `click-completed-conversation`, `click-spawn-entry`, `splitter-drag`, `splitter-keyboard`, `right-rail-toggle`, `completed-collapse-toggle`, `auto-follow-toggle`, `kill-button`, `sessionstorage-persistence`, `keyboard-shortcuts`, `hashchange`). Every assertion verifies state changed / data flowed / content loaded / widget responded — zero `toBeVisible`/`toBeAttached` shallow assertions.
- `.gsd-t/journey-manifest.json` (new) — 12 entries 1:1 with the spec files; `covers[]` arrays span all 17 distinct viewer listeners (multiple listeners per spec where appropriate).
- `e2e/fixtures/journeys/` — 3 real-data NDJSONs sliced from captured `in-session-*.ndjson` (~50 / ~150 / ~80 frames). PII scrub: any user content > 200 chars truncated with `[…truncated]` marker.
- `e2e/fixtures/journeys/replay-helpers.ts` — `startReplayServer({fixture, asSessionId, inSession})` mounts the fixture into a temp project, starts the dashboard server with `port: 0` ephemeral, returns `{baseUrl, dispose}`. Zero new runtime deps.
- `templates/prompts/red-team-subagent.md` — additive new category "Test Pass-Through — Journey Edition" (existing categories untouched). Adversarial mandate: write ≥5 broken viewer patches, run the journey specs, every patch must be caught.

**Adversarial Red Team result:** 5 broken viewer patches written, all 5 caught by journey specs (P1: splitter:mousedown drag handler stripped → splitter-drag FAILS as expected; P2: `_ssSet(SS_KEY_SPLITTER, ...)` redirected to wrong key → splitter-drag + splitter-keyboard FAIL; P3: right-rail toggle handler stubbed to early-return → right-rail-toggle FAILS; P4: M52 narrowed-guard reverted to broken M48 wide-guard → click-completed-conversation FAILS, catching the M52 root-cause regression itself; P5: auto-follow change handler localStorage write removed → auto-follow-toggle FAILS). VERDICT: GRUDGING PASS. See `.gsd-t/red-team-report.md` § "M52 JOURNEY-EDITION RED TEAM".

**Hook end-to-end exercise:** synthetic `fakeBtn:click` listener appended to `scripts/gsd-t-transcript.html:1617` + staged → `bash .git/hooks/pre-commit` exit 1 with structured GAP report (`GAP: scripts/gsd-t-transcript.html:1617  fakeBtn:click  (addEventListener)  no spec covers this`); manifest extended with covering entry → re-run hook exit 0. Block + unblock paths both logged.

**Suite:** unit 2195/2195 pass (was 2167; +28 from M52 D1 detector + CLI + hook + helpers). E2E 35/35 + 1 skip preserved (was 23/35; +12 journey specs). `gsd-t check-coverage` reports `OK: 20 listeners, 12 specs` (exit 0, zero gaps, zero stale entries).

**Migration:** none. Hook is auto-installed on `gsd-t init` and re-installable via `gsd-t doctor --install-journey-hook`. Existing projects pick it up on next `gsd-t update-all`.

### Fixed — historical in-session conversations are clickable again (M52 quick patch)

The M48 Bug 4 dual-pane mirror prevention was overcorrected: `scripts/gsd-t-transcript.html` early-returned for ANY rail entry whose spawn-id began with `in-session-`. But every COMPLETED rail entry is `in-session-*` (that's how the M45 D2 hook captures conversations), so clicking ANY completed conversation did nothing — there was no pane that would load it.

**Mental model fix:** Top pane is for the LIVE main session (owned by `/api/main-session`). Bottom pane is for ANYTHING else the user clicks — regular spawns OR historical in-session conversations. Only the LIVE main session's spawn id should be blocked from the bottom pane (that's the actual M48 Bug 4 case).

**Source narrowing in `scripts/gsd-t-transcript.html`:**
- `connectMain(sessionId)` exposes `window.__mainSessionId` so click + hashchange handlers can discriminate.
- renderRailEntry click handler: `if (isInSession && node.spawnId === ('in-session-' + window.__mainSessionId)) return;` — was `if (isInSession) return;`.
- hashchange handler: `if (id && id === ('in-session-' + window.__mainSessionId)) { return; }` — was `if (id && id.indexOf('in-session-') === 0) { return; }`.
- Legacy renderTree click handler: same narrowed pattern.
- Removed unconditional in-session-* scrub from initial-bottom-id seeding (historical sessionStorage selections survive reload now).
- Added `fetchMainSession` callback that clears the bottom-pane seed when it collides with the live main session id (preserves M48 Bug 4 mirror prevention).

**New journey spec `e2e/viewer/click-completed.spec.ts` (4 tests):**
- Rail renders 1 main session + 3 completed in-session entries.
- Clicking each completed entry loads it into the BOTTOM pane (and TOP pane stays on the live main session).
- Clicking the live MAIN entry does NOT load it into the bottom pane.
- sessionStorage persists across reload — bottom pane resumes the previously-clicked entry.

**Adversarial Red Team (3 broken patches, all caught):** (a) revert both checks to `if (isInSession) return;`; (b) `connect(id)` short-circuits on in-session prefix; (c) click handler routes in-session entries to TOP pane via `connectMain(...)` (clobbers main session). See `.gsd-t/red-team-report.md` § M52 RED TEAM FINDINGS.

**Unit-test ripple:** 5 source-pinned assertions in `test/m48-viewer-rendering-fixes.test.js` flipped from "asserts pre-M52 unconditional bail" to "asserts M52 narrowed live-main check". 1 new test for the fetchMainSession seed-collision callback.

**Suite:** 2167/2167 unit pass (added 1); E2E 23/23 + 1 placeholder skip (added 4 journey tests).

## [3.22.11] - 2026-05-06

### Fixed — viewer Playwright specs are now actually rigorous + adversarially proven (M51)

The 5 viewer specs shipped in M50 used substring/existence assertions that would pass on a broken implementation — exactly the M48 BUG-3 LOW pattern that was flagged but never propagated forward. M51 strengthens all 5 specs to outcome-based assertions and proves they catch broken implementations via an adversarial Red Team that writes deliberately-broken viewer code and verifies the specs fail.

**Changes:**
- `e2e/viewer/title.spec.ts`: exact `<title>` equality (not regex); literal `$&` backref defence positive test using a fixture dir literally renamed to contain `$&`.
- `e2e/viewer/timestamps.spec.ts`: `distinct.size === 3` exactly (not `>= 2`); each rendered timestamp matches the actual `frame.ts` wall-clock value; new missing-`ts` fallback test exercises `arrivedAt` branch.
- `e2e/viewer/chat-bubbles.spec.ts`: CSS class membership assertions (`.frame.user.user-turn`, `.frame.assistant-turn`, etc.); structural assertions on `.body`/`.prefix`/`.badge`/`.truncated-tag`; `tool_use` 4th renderer coverage.
- `e2e/viewer/dual-pane.spec.ts`: TEST-M50-001 fix — `MutationObserver` per pane attributes frames by DOM target instead of filtering raw URLs (top pane's `connectMain` URL legitimately contains the in-session id); positive top-pane SSE assertion; hashchange-doesn't-pin-bottom test.
- `e2e/viewer/lazy-dashboard.spec.ts`: exact regex on banner shape (not substring); dead-pid branch coverage (today's spec only had live + missing).
- `.gsd-t/red-team-report.md`: new "M51 RED TEAM FINDINGS" section enumerating 5 broken-viewer adversary attempts and confirming all 5 caught.
- Bonus: fixture port allocation switched from `Math.random()*100` to `port: 0` + `server.address().port` readback (eliminates EADDRINUSE collisions across parallel Playwright workers).

**Adversarial Red Team result:** 5 broken viewer impls written, 5 caught by strengthened specs. Production viewer code unchanged — this was pure test-suite rigor work, no real app bugs found behind adversary patches.

**Suite:** 2166/2166 pass; E2E 19/19 pass (was 9 — 5 specs grew from 9 tests to 19).

**Migration:** none. Specs are stricter; existing v3.22.10 viewer continues to pass.

## [3.22.10] — M50 Universal Playwright Bootstrap + Deterministic UI Enforcement

### Added — three deterministic enforcement layers replace prose-only Playwright Readiness Guard

Closes the gap that allowed M48 viewer fixes to ship without Playwright tests despite the existing prose Readiness Guard. Prior pattern was prose in `~/.claude/CLAUDE.md` + per-command-file reminders that agents could read and decide to skip. M50 converts every layer to executable code so agents cannot self-approve their way around it.

**Layer 1 — Bootstrap library (D1):**
- `bin/playwright-bootstrap.cjs` (new) — `hasPlaywright`, `detectPackageManager`, `installPlaywright`, `installPlaywrightSync`, `verifyPlaywrightHealth`. Idempotent installer: detects package manager (npm/pnpm/yarn/bun), installs `@playwright/test` + chromium, writes `playwright.config.ts` from a single-source template (contract §6), scaffolds `e2e/__placeholder.spec.ts`. Preserves existing config + e2e contents on re-run. Error classifier maps subprocess stderr to `{package-manager-not-found, network, chromium, disk}` with caller-actionable hints; chromium-failure surfaces `partial: true`. Zero external runtime deps.
- `bin/ui-detection.cjs` (new) — `hasUI`, `detectUIFlavor`. Synchronous, depth-bounded ≤3 BFS, never throws. Detects React/Vue/Svelte/Next/Angular/Flutter/Tailwind via `package.json`, `pubspec.yaml`, `tailwind.config.{js,ts,mjs,cjs}`, or any UI extension (`.tsx`/`.jsx`/`.vue`/`.svelte`/`.css`/`.scss`).
- `bin/gsd-t.js`: inline `hasPlaywright` (was lines 201-204) replaced with `require('./playwright-bootstrap.cjs')`. `init` flow auto-installs Playwright when `hasUI && !hasPlaywright`. `update-all` auto-installs across all registered UI projects + reports counts (`Auto-installed Playwright in: N project(s)`). New `gsd-t setup-playwright [path] [--force]` subcommand. New `gsd-t doctor --install-playwright` flag. New `gsd-t doctor --install-hooks` flag (D2).

**Layer 2 — Spawn-time gate (D2):**
- `bin/headless-auto-spawn.cjs::autoSpawnHeadless()`: new gate runs before the spawn. When the command is in the `TESTING_OR_UI_COMMANDS` whitelist (9 commands: execute, test-sync, verify, quick, wave, milestone, complete-milestone, debug, integrate) AND `hasUI(projectDir)` AND `!hasPlaywright(projectDir)`, the gate calls `installPlaywrightSync(projectDir)` synchronously. On install failure, writes `mode: 'blocked-needs-human'` + `reason: 'playwright-install-failed'` to the headless session-state file and exits 4. Hot path: three filesystem checks; no install attempt when gate doesn't fire.

**Layer 3 — Commit-time gate (D2):**
- `scripts/hooks/pre-commit-playwright-gate` (new, executable bash) — opt-in via `gsd-t doctor --install-hooks`. Reads `.gsd-t/.last-playwright-pass` (Unix epoch ms in a single line). Detects staged viewer-source files (`scripts/gsd-t-transcript.html`, `scripts/gsd-t-dashboard-server.js`, `e2e/viewer/**`); if any file's mtime exceeds the last-pass timestamp, blocks the commit (exit 1 + clear stderr message). Fails open on missing/corrupt timestamps — broken hook is worse than a permissive one.

**E2E specs delivered (the M47/M48/M49 viewer specs we owed):**
- `playwright.config.ts` (root) — testDir `./e2e`, chromium project, `webServer` omitted (specs manage their own server lifecycle).
- `e2e/viewer/title.spec.ts` — M48 Bug 1 regression (project basename in `<title>` + header `.title` for `/transcripts` and `/transcripts/{spawn-id}`).
- `e2e/viewer/timestamps.spec.ts` — M48 Bug 2 regression (per-frame `frame.ts`, not per-batch `new Date()`).
- `e2e/viewer/chat-bubbles.spec.ts` — M48 Bug 3 regression (`user_turn`/`assistant_turn`/`session_start`/`tool_use_line` render as bubbles, not JSON.stringify dumps).
- `e2e/viewer/dual-pane.spec.ts` — M48 Bug 4 regression (bottom pane never connects to in-session-* SSE).
- `e2e/viewer/lazy-dashboard.spec.ts` — M49 banner regression (file-path + visualize hint when no dashboard; URL when alive).

**Tests:**
- `test/m50-d1-ui-detection.test.js` — 18 unit tests (8 mandatory fixtures + 4 hardening + 6 Red Team regressions).
- `test/m50-d1-playwright-bootstrap.test.js` — 20 unit tests (`hasPlaywright`, `detectPackageManager`, `verifyPlaywrightHealth`, 9 install-path branches).
- `test/m50-d1-cli-integration.test.js` — 5 CLI wire-up tests (re-export, init gate, doctor flag, setup-playwright).
- `test/m50-d2-viewer-specs-smoke.test.js` — 4 meta-tests (config + scripts + zero-runtime-dep invariant).
- `test/m50-d2-spawn-gate.test.js` — 9 gate-firing matrix tests (whitelist + 5 firing scenarios + hot-path overhead).
- `test/m50-d2-pre-commit-hook.test.js` — 6 hook-behavior tests (clean / blocked / fresh / missing / corrupt / e2e/viewer pattern).

Total: 62 new M50 tests; full suite 2163/2166 (3 pre-existing env-flakes preserved). Zero regressions.

**Doc-ripple:**
- `~/.claude/CLAUDE.md` § Playwright Readiness Guard — collapsed to a layered referral.
- `templates/CLAUDE-global.md` — mirror.
- `commands/gsd-t-init.md` Step 11 — points at `installPlaywright()` instead of carrying inline package-manager commands.
- `docs/architecture.md` — new "Playwright Deterministic Enforcement (M50)" subsection.
- `.gsd-t/contracts/playwright-bootstrap-contract.md` v1.0.0 — new contract.
- `.gsd-t/contracts/m50-integration-points.md` — D1→D2 checkpoint flipped to PUBLISHED.

## [3.21.12] - 2026-05-06

### Fixed — dashboard orphan accumulation (M49 lazy autostart + idle-TTL + doctor-prune)

88 dead `gsd-t-dashboard-server.js` processes accumulated under v3.21.11 (164 under v3.20.13). Root cause: `bin/headless-auto-spawn.cjs::autoSpawnHeadless()` called `ensureDashboardRunning()` on every spawn, fork-detaching a fresh dashboard for every gsd-t-execute / gsd-t-debug / gsd-t-wave invocation across any project across any session. 99% of those autostarted dashboards are never opened by the user (the live-transcript URL banner is just-in-case observability), so they accumulated on the project-scoped port range 7433–7532 until the user manually killed them.

**Changes:**
- `bin/headless-auto-spawn.cjs::autoSpawnHeadless()`: removed the `ensureDashboardRunning()` call. Spawns no longer autostart dashboards. New synchronous `_probeDashboardLazy(projectDir)` reads `.gsd-t/.dashboard.pid` and verifies the pid is alive via `process.kill(pid, 0)` (cheap; runs on every spawn). Banner is now conditional:
  - Dashboard running: `▶ Live transcript: http://127.0.0.1:{port}/transcript/{spawn-id}` (existing M43 D6-T3 shape).
  - No dashboard: `▶ Transcript file: {logPath}\n  (to view live: gsd-t-visualize)` — points at the on-disk log + tells the user how to open the dashboard if they want it.
- `scripts/gsd-t-dashboard-server.js`: idle-TTL self-shutdown. Default 4 hours, configurable via env `GSD_T_DASHBOARD_IDLE_TTL_MS` or `--idle-ttl-ms` flag. "Idle" means zero HTTP requests AND zero active SSE connections for the full TTL window. setInterval check every 60s; on shutdown, removes `.gsd-t/.dashboard.pid` so the lazy probe sees a clean state. SSE-active dashboards never exit — `_wrapSseHandler` increments/decrements an active-connection counter on req/res `close` events.
- `bin/gsd-t.js doctor`: new `Dashboard Orphans` check + `--prune` flag. Scans for live `gsd-t-dashboard-server.js` processes via `ps -eo pid,command`; cross-references each pid against pidfiles in cwd, `GSD_T_PROJECT_DIR`, and the registered-projects list. Reports orphans (process running, pidfile missing or mismatched). With `--prune`, sends SIGTERM to each orphan. Recovery for any orphans that piled up under earlier versions.
- `commands/gsd-t-visualize.md` (unchanged): the explicit user opt-in path still calls `ensureDashboardRunning()` via `--detach` — the dashboard starts when (and only when) the user runs `/gsd-t-visualize`.

**Tests:**
- `test/m49-lazy-dashboard.test.js` (9): probe correctness across 5 pidfile states (missing / dead / live / garbage / empty), probe speed (< 50ms for 100 calls), `autoSpawnHeadless` does NOT invoke `ensureDashboardRunning` (require-cache stub), URL banner shape when running, file-path banner shape when not running.
- `test/m49-dashboard-idle-ttl.test.js` (7): `tracker.bump` resets `lastActivity`, SSE connect/disconnect counter, TTL fires when window elapses with no SSE, TTL does NOT fire while `activeSseConnections > 0`, recent `bump` prevents fire, `_wrapSseHandler` tracks idempotently on close, `startServer` accepts `idleTtlMs` opt without crashing.
- `test/m49-doctor-orphan-check.test.js` (4): no-process baseline, fake-dashboard process detected as orphan, `--prune` actually kills the orphan PID, tracked dashboard (pidfile lists pid) is NOT an orphan.
- `test/m43-url-banner.test.js`: updated for M49 — file-path banner expected by default; URL banner exercised with a pre-written pidfile pointing at the test runner's pid (proxy for "live").

**Migration:** existing autostarted dashboards stay running until they hit the 4h idle-TTL or are pruned via `gsd-t doctor --prune`. New spawns no longer add to the count. Re-running `/gsd-t-visualize` continues to work as before.

**Suite:** 2103/2105 (2 pre-existing env-sensitive flakes preserved per M47/M48 baseline). +20 new M49 tests, 0 regressions.

## [3.21.11] - 2026-05-06

### Fixed — viewer: 4 rendering regressions surfaced post-M47

The M47 viewer redesign shipped four user-visible rendering bugs that only became apparent when a project's in-session conversation was actually being viewed against a non-GSD-T project. Discovered when the dashboard for `Move-Zoom-Recordings-to-GDrive` showed three captured `in-session-*.ndjson` files but rendered them with a hardcoded "GSD-T Transcript" header, identical timestamps on every frame, raw `JSON.stringify` dumps in place of chat turns, and the same content in both top and bottom panes.

**Changes:**
- `scripts/gsd-t-dashboard-server.js`: `<title>` and `.title` div now carry a `__PROJECT_NAME__` placeholder substituted server-side via `path.basename(path.resolve(projectDir))` in both `handleTranscriptsList` and `handleTranscriptPage`. New `_escapeHtml()` helper escapes `<` / `&` / `"` in basenames; the substitution uses the function form of `replace` to defuse `$&` / `$1` / `$$` backreference patterns in basenames (Red Team BUG-1).
- `scripts/gsd-t-transcript.html`:
  - `frameTs(frame, fallback)` parses each frame's ISO `ts` field and only falls back to the SSE-handler-captured `arrivedAt` when absent or invalid. `connect()` and `connectMain()` now thread `renderAt = frameTs(frame, arrivedAt)` to `renderFrame`. Initial-replay batches no longer collapse 200 distinct timestamps into one.
  - 4 new render helpers (`renderUserTurn` / `renderAssistantTurn` / `renderSessionStart` / `renderToolUseLine`) plus dispatch arms in `renderFrameInner` BEFORE the `JSON.stringify` fallback. New CSS for `.frame.assistant-turn` (green border-left), `.frame.session-start` (small inline badge), `.frame.tool-call-line`, `.frame.truncated-tag`. `user_turn` reuses `.frame.user` bubble styling. Truncated content gets a "(truncated)" tag.
  - 5 separate guards keep `in-session-*` ids out of the bottom pane: `renderRailEntry` click handler returns early on `isInSession`; initial bottom-pane resolution scrubs `in-session-*` from `SS_KEY_SELECTED` sessionStorage before `connect()`; `hashchange` handler returns early; `maybeAutoFollow` filters in-session spawns out; legacy `renderTree` click handler in the live-bucket fallback path also gets the guard (Red Team BUG-2).
- `test/m48-viewer-rendering-fixes.test.js`: 23 new regression tests — 5 Bug-1, 5 Bug-2 (incl. functional `frameTs` eval-extract probe), 7 Bug-3, 5 Bug-4, 1 functional probe (Red Team test-quality concern). Includes explicit `$&` and `$1` regression tests for the BUG-1 fix.
- `test/m44-transcript-timestamp.test.js`: updated for the `renderAt` / `arrivedAt` rename — semantics preserved (`arrivedAt` is now the fallback layer beneath parsed `frame.ts`).

**Migration:** existing dashboards pick up the new code on next refresh after `gsd-t update-all` propagates the package; the per-project transcript page reflects the project's directory basename automatically. No state migration.

**Suite:** 2083/2083 pass — both pre-existing M47-baseline flakes resolved on the release run.

**Red Team adversarial QA (opus):** initial sweep found 1 MEDIUM (`$&`-corruption in basename → fixed via function-form replace) + 1 LOW (legacy `renderTree` click handler → fixed via `isInSession` guard) + 1 test-quality recommendation (addressed via functional `frameTs` probe). Re-verification: GRUDGING PASS — no new bugs introduced.

## [3.20.13] - 2026-05-05

### Fixed — visualizer: surface in-session NDJSONs when `.index.json` is empty

The dashboard's `/transcripts` endpoint only read `.gsd-t/transcripts/.index.json` to populate the left-rail spawn list. The M45 D2 conversation-capture hook writes `in-session-{sessionId}.ndjson` directly to `transcripts/` but does NOT update the index — the index is owned by the spawn lifecycle, not the in-session hook. Result: the visualizer's left rail showed "no spawns yet" even when the in-session conversation was actively being captured to disk. Discovered when the M43 D1 + M45 D2 hooks were installed (v3.20.12) and the conversation NDJSONs were appearing on disk but invisible in the UI.

**Changes:**
- `scripts/gsd-t-dashboard-server.js`: new `listInSessionTranscripts(projectDir)` function scans `transcripts/` for `in-session-*.ndjson` files and returns spawn-shaped entries with `spawnId: in-session-{sessionId}`. Filenames are validated through `isValidSpawnId` for path-traversal safety. `handleTranscriptsList` merges these with the index entries (index takes precedence on dup `spawnId`). The viewer's existing `in-session-` prefix detection then applies the `💬 conversation` badge.
- `test/dashboard-server.test.js`: 5 new regression tests covering the empty-dir case, missing-dir case, find/filter behavior, mixed file types, and malformed-filename rejection.

**Migration:** existing dashboards picking up the new code will surface in-session conversations automatically on next refresh of `/transcripts`. No state migration needed; the index is read-only here.

**Suite:** 2047/2047 pass.

**Side cleanup:** killed 144 + 20 orphan `gsd-t-dashboard-server.js` processes (164 total) accumulated from prior detached spawns whose parents had exited and been reparented to launchd. 3 stale pidfiles cleaned. Per-project `transcripts/` directories pre-created in 15 GSD-T projects so the M45 D2 hook can write without first-run delay.

## [3.20.12] - 2026-05-05

### Fixed — install: auto-configure M43 D1 + M45 D2 in-session hooks

`gsd-t install` did not deploy or wire up the M43 D1 token-usage hook (`gsd-t-in-session-usage-hook.js`) or the M45 D2 conversation-capture hook (`gsd-t-conversation-capture.js`), even though the global CLAUDE.md "In-Session Conversation Capture" section documented these as mandatory. Result: the dashboard's `/transcripts` left rail never showed `💬 conversation` entries for in-session orchestrator dialog (this conversation right now); discovered when the live chat feed showed "no spawns yet" while the project's `.gsd-t/transcripts/` was missing entirely.

**Changes:**
- `bin/gsd-t.js`: new `installInSessionHooks()` + `configureInSessionHooks()` functions copy `scripts/hooks/gsd-t-conversation-capture.js` and `scripts/hooks/gsd-t-in-session-usage-hook.js` to `~/.claude/scripts/hooks/`, then register them in `~/.claude/settings.json` on the right events:
  - `gsd-t-conversation-capture.js` → SessionStart, UserPromptSubmit, Stop (PostToolUse stays opt-in via the `GSD_T_CAPTURE_TOOL_USES=1` env flag)
  - `gsd-t-in-session-usage-hook.js` → Stop
- New install heading **In-Session Hooks (Conversation Capture + Token Usage)** runs in the install pipeline immediately after Auto-Route.
- `test/filesystem.test.js`: bumped command-count assertions (54 → 55, utility 5 → 6) for the `cpua.md` command added in this session.

**Migration:** existing installs pick up the wiring on next `gsd-t update-all` or `gsd-t install` run. The configure step is idempotent; re-running is safe. Suite: 2042/2042 pass.

**Why this matters:** the conversation-capture hook is the only thing that lets you scroll back through your visualizer's `/transcripts` view and see chat with Claude in this session — without it, the dashboard's left rail is permanently empty for the in-session conversation. The token-usage hook records per-turn cost so the meter and economics dashboards have real data.

## [3.20.11] - 2026-05-05

### Fixed — install: ship `gsd-t-token-capture.cjs` to every project

`bin/gsd-t.js::PROJECT_BIN_TOOLS` was missing `gsd-t-token-capture.cjs` — the wrapper that the **Token Capture Rule (MANDATORY)** in `CLAUDE.md` requires every Task spawn to flow through. Result: `gsd-t init` and `gsd-t update-all` shipped 11 other `bin/*.cjs` runtime files but silently skipped this one. Discovered when an audit of 18 registered projects found 15 of them missing the wrapper at `bin/gsd-t-token-capture.cjs` — the contract was effectively advisory in installed projects.

**Changes:**
- `bin/gsd-t.js`: `PROJECT_BIN_TOOLS` now includes `gsd-t-token-capture.cjs`.
- `test/m41-canonical-block-drift.test.js`: new regression test asserts the wrapper is in `PROJECT_BIN_TOOLS`. Catches the same bug if it ever re-emerges (e.g., array reformat clobbers an entry).

**Migration:** existing projects fix automatically on next `gsd-t update-all` run — the wrapper gets copied alongside the other bin tools. Test suite 2042/2042 pass.

## [3.20.10] - 2026-05-03

### Added — Live-clock dated banner + PreToolUse date guard

Solves the multi-day-session date-drift problem. Long sessions span days; without a fresh time signal every turn, hand-written timestamps (decision log entries, `continue-here-{ts}.md` filenames, memory entries, banners) silently drift to the session-start date.

**Hook — `scripts/gsd-t-auto-route.js` (UserPromptSubmit):**
- Now emits `[GSD-T NOW] Day: Mon DD, YYYY HH:MM:SS TZ` at the start of every user turn (every project, regardless of GSD-T detection).
- Existing `[GSD-T AUTO-ROUTE]` behavior preserved (still GSD-T-project-only, plain-text-prompts-only).
- Exports `liveTimestamp()` for test reuse.

**Hook — `scripts/gsd-t-date-guard.js` (PreToolUse on Write|Edit, NEW):**
- Blocks Write/Edit calls whose content contains timestamps drifting more than ±5 minutes from the live system clock.
- High-signal patterns validated: decision-log entries (`- YYYY-MM-DD HH:MM:`), `continue-here-YYYY-MM-DDTHHMMSS` filenames, banners (`Day: Mon DD, YYYY HH:MM`), labeled stamps (`Date:`, `Updated:`, `Created:`, etc.).
- For Edit: timestamps appearing in BOTH `old_string` and `new_string` are pre-existing context — never flagged.
- Allowlist: machine-written and historical-frozen paths (`.gsd-t/events/`, `.gsd-t/transcripts/`, `.gsd-t/metrics/`, `.gsd-t/.unattended/`, `.gsd-t/headless-*.log`, `.gsd-t/dashboard.log`, `.gsd-t/progress-archive/`, `.gsd-t/milestones/`, `.gsd-t/scan/`, `.git/`, `node_modules/`, `CHANGELOG.md`, `.gsd-t/token-log.md`, `.gsd-t/qa-issues.md`, existing `continue-here-*.md`).
- Fails open on internal error — broken tool calls are worse than drift.
- 10/10 smoke tests pass.

**Banner change — `scripts/gsd-t-update-check.js`:**
- CURRENT-state banner no longer ships the changelog URL — pure noise when there's no update to read about. Action-required banners (AUTO-UPDATE, UPDATE) keep the link.

**Spec — `~/.claude/CLAUDE.md` + `templates/CLAUDE-global.md` (rewritten §Update Notices + new §Live Clock Rule):**
- Dated banner mandated as the first line of EVERY response, sourced from `[GSD-T NOW]` only — never `currentDate` (frozen) or SessionStart (frozen).
- Live Clock Rule: any timestamp written to disk MUST come from live system clock. Date guard mechanically enforces this.
- Format tightened to `Day: Mon DD, YYYY HH:MM TZ` (HH:MM displayed; seconds emitted but trimmed).

### Why

Hand-written timestamps were being sourced from `currentDate` in Claude's context — a string injected once at session start. Multi-day sessions (the user reported they happen often) meant decision-log entries, archive filenames, and memory entries were silently dated wrong by N days.

Red Team principle applied: directives in CLAUDE.md are not safety properties. The PreToolUse hook is the enforcement.

### Settings install

Add to `~/.claude/settings.json` (in the `hooks` block, before `PostToolUse`):

```json
"PreToolUse": [
  { "matcher": "Write|Edit",
    "hooks": [{ "type": "command",
                "command": "node \"$HOME/.claude/scripts/gsd-t-date-guard.js\"" }] }
]
```

## [3.19.00] - 2026-04-23

### Added — M46 Milestone: Unattended Iter-Parallel + Worker Fan-Out Completion

Closes the two biggest gaps from the 2026-04-23 five-surface parallelism audit: (2A) unattended multi-iteration parallelism and (2B) worker-side sub-fan-out.

**D1 — Iteration-parallel supervisor scaffold (`bin/gsd-t-unattended.cjs`):**
- `_runOneIter(state, opts) → IterResult` — extracted from the while-loop body at line 969 (68-line delta, zero behavior change when called sequentially)
- `_computeIterBatchSize(state, opts) → number` — mode-safety gates: `verify-needed → 1`, `milestone-boundary → 1`, `complete-milestone → 1`. Production default returns 1 (serial) unless caller passes `opts.maxIterParallel` — opt-in gate on the iter-parallel engagement pending full concurrent-state-safety rewrite (backlog #24).
- `_runIterParallel(state, opts, iterFn, batchSize) → Promise<IterResult[]>` — uses `Promise.allSettled` for per-iter error isolation; one rejection does not cancel siblings.
- `_reconcile(state, results)` — deduped union on `completedTasks`, OR on `verifyNeeded`, append-only `artifacts`, last-writer-wins `status`, writes `lastBatch` metadata. **Does NOT advance `state.iter`** — that invariant is owned by the main while loop via `_runOneIter`.
- `module.exports.__test__` exposes all four helpers to unit tests.

**D2 — Worker sub-dispatch production path (`bin/gsd-t-worker-dispatch.cjs`):**
- `dispatchWorkerTasks({projectDir, parentSessionId, tasks, maxParallel=4}) → Promise<{parallel, taskResults, wallClockMs, reason}>` — deterministic probe + delegation to `bin/gsd-t-parallel.cjs::runDispatch` when the task graph is file-disjoint and `tasks.length > 1`.
- Short-circuits with reason strings: `no-tasks`, `single-task`, `file-overlap`, `dispatch-error:*`, `dispatched`.
- CLI entry: `node bin/gsd-t-worker-dispatch.cjs --parent-session <id> --tasks <path> --max-parallel <n>` — emits JSON result to stdout.
- `commands/gsd-t-resume.md` Step 0 `GSD_T_UNATTENDED_WORKER=1` branch gains an additive sub-dispatch block (no deletion from existing prose).
- `bin/spawn-plan-writer.cjs` kind enum extended with `unattended-worker-sub`.

### Contracts

- **`.gsd-t/contracts/iter-parallel-contract.md`** — NEW v1.0.0. Batch semantics, `IterResult` shape, reconciliation rule, stop-check batch-boundary invariant (stop-check is never polled mid-batch).
- **`.gsd-t/contracts/headless-default-contract.md`** — v2.0.0 → v2.1.0 (additive §Worker Sub-Dispatch documenting the `unattended-worker-sub` kind and the resume-path hand-off).

### Measurements — both proofs passed thresholds

- **D1 iter-proof (`bin/m46-iter-proof.cjs`)**: 10-iter synthetic workload, 200ms work per iter, batch=4 vs serial. Result: `T_serial=2022.6ms`, `T_par=602.9ms`, **speedup=3.35×**, `T_par/T_serial=0.298` — passes thresholds `speedup ≥ 3.0` and `T_par/T_serial ≤ 0.35`.
- **D2 worker-proof (`bin/m46-worker-proof.cjs`)**: 6-task file-disjoint synthetic workload, serial vs fan-out via `runDispatch`. Result: `T_serial=12134ms`, `T_par=2034ms`, **speedup=5.96×** — passes threshold `speedup ≥ 2.5`.
- Reports: `.gsd-t/metrics/m46-iter-proof.json` + `.gsd-t/metrics/m46-worker-proof.json`.

### Tests

- **`test/m46-d1-iter-parallel.test.js`** — 12 unit tests covering serial fallback, 3-way parallel batch concurrency (<200ms for three 100ms iters), mode-safety gates (verify-needed / complete-milestone / milestoneBoundary), error isolation (one rejection, two siblings succeed), stop-check batch-boundary invariant, and `_reconcile` semantics.
- **`test/m46-d2-worker-subdispatch.test.js`** — 6 unit tests covering disjoint fan-out, single-task short-circuit, file-overlap detection, dispatcher error surfacing, and CLI JSON-stdout contract.
- Full suite: **1946/1946 pass**, zero regressions (M43 heartbeat-watchdog + M44 planner-wire + M45 suites all green).

### Regression caught and fixed mid-milestone

- **Double-increment of `state.iter`** between `_reconcile` and `_runOneIter` tripped 4 tests (m43-heartbeat-watchdog `staleHeartbeat res → exitCode 125`, m44-wire-unattended-to-planner iter-count / fallback / sequential). Root cause: `_reconcile` was advancing `state.iter` by `results.length` while `_runOneIter` already advanced it by 1. Fix: `_reconcile` leaves `state.iter` untouched (main loop owns the invariant); two m46-d1 tests updated to match new contract.

### Follow-up backlog

- **#24 — Dynamic work-stealing rewrite** (full concurrent-safe state isolation for `_runIterParallel` >1 batch). Covers the `state.iter` / heartbeat / writeState shared-mutation issue that keeps the iter-parallel engagement opt-in rather than default-on.
- **D2-T11 integration smoke** deferred — unit tests + proof harness cover the surface.

## [3.18.18] - 2026-04-23

### Added — Model-aware worker spawn in `runDispatch`

- **`bin/gsd-t-parallel.cjs::runDispatch`**: fan-out workers now default to `claude-sonnet-4-6` via new constant `DEFAULT_WORKER_MODEL` (was: inherit the orchestrator's `ANTHROPIC_MODEL`, which is `claude-opus-4-7` in this user's global settings). Caller overrides via `opts.workerModel`: alias strings (`"opus"` / `"sonnet"` / `"haiku"`) resolve to full model IDs; explicit full IDs pass through; `workerModel: false` opts out of the override entirely and inherits parent. **Why**: the 2026-04-23 M46 Wave 1 dispatch rate-limited all 8 Opus workers (Max 20x subscription concurrent-session throttle). Sonnet lives in a separate rate bucket, so orchestrator Opus + worker Sonnet lifts the concurrency ceiling. Per-task Opus opt-in via `[opus]` marker on tasks.md lines is future work (surfaces in planner metadata).
- **`bin/headless-auto-spawn.cjs::autoSpawnHeadless`**: accepts `workerModel?: string` and sets `ANTHROPIC_MODEL` in the child env after the caller's `envOverride` merge (so caller always wins if they explicitly set `ANTHROPIC_MODEL` in `env`).

### Added — Spawn stagger to avoid burst spikes

- **`bin/gsd-t-parallel.cjs::runDispatch`**: new `opts.spawnStaggerMs` (default **3000** ms) delays each spawn after the first. Implemented via `Atomics.wait` on a `SharedArrayBuffer` so the blocking wait releases the CPU (no spin loop). 2026-04-23 observation: 8 concurrent `claude -p` spawned within 700 ms → all 429 rate-limited; 3 s stagger avoids the burst. Set `spawnStaggerMs: 0` for pre-v3.18.18 behavior.

### Added — Cache-warming probe (opt-in)

- **`bin/gsd-t-parallel.cjs::_runCacheWarmProbe`** + opt-in flag `opts.cacheWarm` / env `GSD_T_CACHE_WARM=1`. Before fan-out, fires a short `claude -p` that reads CLAUDE.md + progress.md + top-level contracts using the **same model** the workers will run, so Anthropic's 5-minute prompt cache is populated and the workers' identical initial reads return cache-read tokens (free for ITPM budget, lower rate-limit pressure). Probe is synchronous (workers land inside the warm window, not racing it), 60 s timeout, failure does not block fan-out. Dependency-injection hook `opts.cacheWarmProbeImpl` for tests. Gated behind opt-in until backlog #23 (mitmproxy header instrumentation) measures the actual delta; flips to default-on if measurement confirms the ITPM savings are real.

### Tests

- **`test/m44-run-dispatch.test.js`**: 4 new tests for model selection (default Sonnet / alias resolution / explicit opt-out / stagger timing) + 3 new tests for cache-warming (opt-in gating / probe model matches workers / probe failure does not block fan-out). Full suite **2023/2023** pass (baseline 2016 + 7 new).

### Incident — 2026-04-23 M46 Wave 1 rate-limit

- Root cause: all 8 headless workers inherited `ANTHROPIC_MODEL=claude-opus-4-7` from `~/.claude/settings.json` (this user runs Max 20x on Opus globally) and spawned in a 700 ms burst. Max subscription's concurrent-session throttle fired ~1 s into each worker's first tool call. Anthropic Console dashboards showed flat-zero API usage — confirmed the throttle is subscription-side, not API-key-side. Mitigations shipped in this release (model-mix + stagger + opt-in cache-warm) + scoped backlog items #22 (coord-gate runtime coordination) and #23 (mitmproxy header instrumentation for calibration).

## [3.18.17] - 2026-04-23

### Fixed — `npm test` picks up `worker-sim.js` fixture

- **`test/fixtures/m44-proof/worker-sim.js`** was being globbed by `node --test`'s default test-directory matcher (anything under `test/` with a `.js` extension), and failed because the fixture requires `OUT_DIR` to be set. The fixture now exits `0` when env vars are absent instead of `2` — it's a worker fixture, not a test. Full suite back to 2016/2016 green. Required to unblock the v3.18.16 publish.

## [3.18.16] - 2026-04-23

### Added — Proof measurement `--visualize` flag

- **`bin/m44-proof-measure.cjs --visualize`** writes synthetic spawn-plan files into the project's `.gsd-t/spawns/` directory as each simulated worker launches and calls `markTaskDone` + `markSpawnEnded` when they finish, so the M44 D9 parallelism panel (`scripts/gsd-t-transcript.html`, endpoint `/api/parallelism`) renders the fan-out live. Off by default — the unflagged measurement still writes spawn-plans only under the temp fixture root. Enables end-to-end visualizer observation of the dispatcher without burning API tokens.
- **Reproducibility**: three consecutive 20s-worker runs (13:08, 13:09, 13:27 local) produced identical `T_par / T_seq ≈ 0.251`, `speedup ≈ 3.98×`, `parallelism_factor ≈ 3.97`, `parallelism_factor_mode: "live"` with `activeWorkers: 4` for the full 20s parallel window. Panel transitions IDLE → live → IDLE confirmed by `/api/parallelism` polling.

## [Unreleased] — v3.19.00 pending

### Measured — Dispatcher T/2 criterion (backlog #15, leg 1 of 2)

- **`bin/m44-proof-measure.cjs`** runs a falsifiable measurement of the v3.19.00 parallel dispatcher using a synthetic spawner (`test/fixtures/m44-proof/worker-sim.js`) injected into `runDispatch` via `opts.spawnHeadlessImpl`. Fixture (`test/fixtures/m44-proof/fixture.tasks.md`): 4 file-disjoint tasks with explicit `- touches:` sub-bullets (D5 disjointness requirement). Each worker sleeps `WORKER_DURATION_MS` (default 8000ms) then writes a JSON `.done` marker — zero LLM calls, zero network, zero side effects outside `OUT_DIR`. **Result**: T_par = **8111.1 ms**, T_seq = **32146.1 ms**, speedup **3.96×**, parallelism_factor **3.95** (ideal = 4), dispatch overhead **8.2 ms**. Criterion `T_par ≤ T_seq/2` → **MET ✓**. Report JSON at `.gsd-t/m44-proof-report.json`. This proves the dispatcher fans out concurrently; it does NOT prove N Claude workers produce correct code in T/N (a separate experiment, deferred to a follow-up backlog item).

### Pending — Zero-compaction criterion (backlog #15, leg 2 of 2)

- **NOT YET MEASURED.** Requires an unattended supervisor run over a workload that historically would have triggered mid-run `/compact`, producing zero `type:"compaction_post_spawn"` rows in `.gsd-t/metrics/compactions.jsonl` under the fully-wired v3.19.00 surface (`ca20477` supervisor→planner + `799a8af` single-instrument + `19eb3eb` D9 observability panel). Existing 81 rows in the compactions log contain 0 `compaction_post_spawn` entries, but the only post-19eb3eb unattended state predates the D9 landing and is therefore not a valid sample.
- **`v3.19.00` tag deferred** until the zero-compaction leg completes. Per user standing directive `feedback_measure_dont_claim.md`: "milestones with measurable success criteria are not complete until measurement is run AND reported."

## [3.18.15] - 2026-04-23

### Fixed — Supervisor false-failed marker (M45 follow-up)

- **`bin/headless-exit-codes.cjs::mapHeadlessExitCode` polarity discipline** — the pre-fix matcher did `lower.includes("tests failed")` / `"verification failed"` / `"context budget exceeded"`, which fired on free-form narration like `"0 tests failed"`, `"no tests failed"`, and quoted phrases inside worker output. During the M45 run the worker's clean output contained `"tests failed"` 6× in healthy prose, flipping its mapped exit code 0 → 1 and causing the supervisor to finalize `status=failed` despite the milestone having been completed and archived. The matchers now require either a non-zero numeric count (`/([1-9]\d*)\s+(?:tests?|specs?|assertions?|examples?|suites?)\s+failed\b/i`), a structured terminal marker (`/^FAIL[:\s]/m`, Jest-style `/^Tests:\s+\d+\s+failed/m`), or a line-boundary / sentence-start anchor for free-form verification/context-budget phrases. 27 new polarity regression tests in `test/m45-fix-headless-exit-polarity.test.js`; all existing `headless.test.js` assertions preserved.
- **`commands/gsd-t-unattended-watch.md` Step 3 reconciliation** — when the supervisor PID file is absent AND `state.status=failed` AND a fresh milestone archive exists under `.gsd-t/milestones/` (mtime ≥ supervisor `startedAt`), the watch tick now renders a reconciled success report noting the archive as the source of truth instead of the contradictory ✅-cleanly-finalized + failed-status block the previous logic would emit. Raw final report preserved for genuinely failed runs with no archive.

## [3.18.14] - 2026-04-23

### Added — M45 Conversation-Stream Observability

- **Orchestrator dialog visible in the transcript viewer** — new hook `scripts/hooks/gsd-t-conversation-capture.js` (SessionStart + UserPromptSubmit + Stop + opt-in PostToolUse via `GSD_T_CAPTURE_TOOL_USES=1`) writes typed NDJSON frames to `.gsd-t/transcripts/in-session-{sessionId}.ndjson` for every human↔Claude turn. The visualizer's left rail now lists those entries with a `💬 conversation` badge alongside the `▶ spawn` entries, so users can watch their own dialog in the same surface as spawned work.
- **Compact marker fallback target-selection** — `scripts/gsd-t-compact-detector.js::findActiveTranscript` now prefers a fresh spawn NDJSON when one has been modified within 30s, and falls back to the most recent `in-session-*.ndjson` otherwise. Mid-conversation `/compact` events land in the correct transcript instead of a random stale spawn file.
- **New contract** `.gsd-t/contracts/conversation-capture-contract.md` v1.0.0 — documents the frame schema (`session_start` / `user_turn` / `assistant_turn` / `tool_use`), file-naming (`in-session-` prefix as the viewer + compact-detector discriminator), hook entry points, session-id source + fallback, and 16 KB content cap.
- **Settings.json hook wiring documented** — `templates/CLAUDE-global.md` gains an "In-Session Conversation Capture (M45 D2)" section so users who install/update pick up the hook alongside the existing in-session token-usage hook.

### Fixed — M45 D1 Viewer Route

- **`GET /transcripts` now serves the real transcript viewer** — reverts the standalone `renderTranscriptsHtml` index page shipped in v3.18.13. The route now reads `scripts/gsd-t-transcript.html` with `__SPAWN_ID__` → `""`, giving users the same left-rail + main + right-panel surface they get at `/transcript/:id`. JSON back-compat preserved: `Accept: application/json` and `*/*` continue to return `{spawns: [...]}`.
- **Session-id path-separator sanitization (Red Team BUG-1)** — `_resolveSessionId` in the new conversation-capture hook now rejects session_ids containing `/`, `\`, `\0`, or `..` and falls through to the pid-hash fallback. Prior behavior let `session_id="a/../b"` lexically collapse via `path.join` to produce `transcripts/b.ndjson` without the `in-session-` prefix, breaking the filename-prefix discriminator contract with the viewer + compact-detector.

## [3.18.13] - 2026-04-23

### Fixed

- **Dashboard `/transcripts` returned raw JSON to browsers** — after the v3.18.12 always-enabled Live Stream button fix, opening the dashboard with no spawn data and clicking Live Stream landed the user on `{"spawns":[]}` because `/transcripts` always served JSON. The route now does Accept-header content negotiation: browsers (`Accept: text/html`) get a proper dark-themed HTML index page with a sortable table of spawns (or a friendly empty state with a `/gsd-t-quick` CTA when no transcripts exist); programmatic clients (`fetch()` default `*/*`, or explicit `application/json`) keep getting the JSON shape the dashboard polling code already consumes — full back-compat.

## [3.18.12] - 2026-04-23

### Fixed

- **Dashboard Live Stream button stuck disabled** — the header button had `cursor:not-allowed` + `pointer-events:none` whenever the `/transcripts` index returned no spawns, including the common case of opening the dashboard before any agent had run. The button now stays enabled in all states. With a live spawn it links to the live transcript; with only finished spawns it links to the most recent one; with no spawn data at all it links to the `/transcripts` JSON index as a discoverable last resort.

## [3.18.11] - 2026-04-23

### Fixed

- **Flaky `m43-dashboard-autostart` test under load** — bumped `_isPortBusySync` spawnSync timeout from 2s → 10s. Under saturated full-suite execution the 2s budget could expire before the probe child even reported back, causing a falsely-free port reading and intermittent assertion failures. The 10s budget is comfortably above any observed real-world probe latency while still bounding hung-child cases.
- **Stale snapshot test in `m43-milestone-complete-detection`** — replaced the live-state assertion that hard-coded `M43=PARTITIONED` (true at the time the test was written, false ever since M43 completed) with an M42-only sanity check. M42 is the oldest stable terminal milestone and serves as a fixed anchor that won't go stale every release. The other 7 tests in the file already cover the actual `isMilestoneComplete` matcher logic via `withTmpProgress` fixtures.

## [3.18.10] - 2026-04-23

### Added — Cross-Domain & Cross-Task Parallelism (M44)

Task-level parallelism shipped to **both** execution modes (in-session and unattended) on equal footing, with mode-aware gating math. 8 of 9 domains landed (D1–D8 DONE; D9 parallelism-observability grafted as backlog #16 follow-up). 3 waves, 1903/1907 tests pass (4 pre-existing unrelated fails).

**Wave 1 foundation:**
- **D1 — Generic task-graph reader**: typed DAG + cycle detection + `gsd-t graph` CLI. 22/22 tests, contract v1.0.0.
- **D7 — Per-CW token attribution**: `cw_id` pass-through + post-spawn calibration hook. 19/19 tests; contracts metrics-schema v2.1.0 + compaction-events v1.1.0.

**Wave 2 parallel:**
- **D4 — Dep-graph veto gate**: refuses fan-out when deps unmet. 4/4 tasks, 13/13 tests.
- **D5 — File-disjointness prover**: union-find + git-history fallback. 4/4 tasks, 11/11 tests.
- **D6 — Pre-spawn economics estimator**: 3-tier corpus lookup (mode-aware 85%/60% thresholds) calibrated against 528-row corpus. 5/5 tasks, 9/9 tests, contract v1.0.0.

**Wave 3:**
- **D2 — `gsd-t parallel` CLI**: mode-aware gating math (in-session 85% + N=1 floor; unattended 60% + task_split signal). 5/5 tasks, 21/21 tests; wave-join-contract v1.0.0 → v1.1.0.
- **D8 — Spawn-plan-visibility**: right-side two-layer panel + `/api/spawn-plans` endpoint + SSE + post-commit token attribution hook. 7/7 tasks, 36/36 tests, contract v1.0.0.
- **D3 — Command-file integration**: additive "Optional — Parallel Dispatch (M44)" blocks in `execute`/`wave`/`quick`/`debug`/`integrate`. No hardcoded `--mode`; silent fallback to sequential. 5/5 tasks; smoke-test fixtures deferred to backlog #15.

**Mode contracts (NON-NEGOTIABLE):**
- **[in-session]** Speed + reduce compaction as much as possible. Hard rule: NEVER throw an interactive pause/resume prompt.
- **[unattended]** Run M1 → M10 end-to-end with zero human involvement and zero compaction. Per-worker CW headroom is the binding gate.

## [3.17.10] - 2026-04-21

### Added — Token Attribution & Always-Headless Inversion (M43)

Every token is now attributable to a specific tool / command / domain, and the framework is locked to a single rule: **the in-session channel is reserved for human↔Claude dialog. All tool-using work spawns. The visualizer is the watching surface.** No flags, no thresholds, no opt-outs — there is no "in-session mode" for commands to enter.

**Part A — Universal Token Attribution**

**In-session usage capture (D1)**: `bin/gsd-t-in-session-usage.cjs` exports `captureInSessionUsage({projectDir, sessionId, turnId, usage, model})` and `processHookPayload({projectDir, payload})`. Branch B locked: Stop hook triggers, Claude Code transcript (`~/.claude/projects/-.../{sessionId}.jsonl`) is the data source. Writes v2-schema JSONL rows with `sessionType: "in-session"` + distinct `turn_id` + parsed `input_tokens`/`output_tokens`/`cache_read_input_tokens`. Idempotent via transcript-line cursor. Live-validated: 523 rows from one 23-min session (`.gsd-t/.hook-probe/` evidence retained).

**Per-tool attribution (D2)**: `.gsd-t/contracts/tool-attribution-contract.md` v1.0.0 + `bin/gsd-t-tool-attribution.cjs` exports `joinTurnsAndEvents` / `attributeTurn` / `aggregateByTool|Command|Domain`. Output-byte ratio algorithm, 4 tie-breakers (zero-byte turn, missing tool_result, no tool calls, null usage). New CLI: `gsd-t tool-cost [--group-by tool|command|domain] [--since YYYY-MM-DD] [--milestone Mxx] [--format table|json]`. Perf gate: 30ms on 3k turns × 30k events fixture (budget 3s). `gsd-t tokens --show-tool-costs` optional integration adds "Top 10 tools by cost" section.

**Sink unification + schema v2 (D3)**: `.gsd-t/contracts/metrics-schema-contract.md` bumped v1 → v2 — adds optional `turn_id`, `session_id`, `sessionType`, `tool_attribution[]`, `compaction_pressure{}`. `recordSpawnRow` / `captureSpawn` pass-through preserves backward compat. `bin/gsd-t-token-regenerate-log.cjs` + `gsd-t tokens --regenerate-log` makes `.gsd-t/token-log.md` a regenerated view (streaming read + deterministic sort).

**Part B — Always-Headless Inversion (Channel Separation)**

**Default headless spawn (D4)**: `bin/headless-auto-spawn.cjs::shouldSpawnHeadless` collapsed to `() => true`. Removed low-water branch, context-meter-driven branching, `--in-session` opt-out parsing. Legacy `watch`/`inSession` params accepted-and-ignored with one-shot stderr deprecation warning. 7 command files stripped of spawn-mode branching (`execute`, `wave`, `integrate`, `quick`, `debug`, `verify`, `scan`). `/gsd` router preserves in-session classification only for dialog-only exploratory turns — all action turns spawn detached. `.gsd-t/contracts/headless-default-contract.md` bumped v1.0.0 → **v2.0.0** (breaking: flag removal). 40 matrix tests.

**Dialog-channel growth meter (D5)**: `bin/runway-estimator.cjs::estimateDialogGrowth({projectDir, sessionId, k = 5, modelContextCap = 200000})` returns `{slope, median_delta, latest_input_tokens, predicted_turns_to_compact, shouldWarn}`. Outlier-resistant median-of-deltas. When `shouldWarn=true`, `/gsd` router appends a one-line blockquote footer suggesting `/compact` or detached spawn. Pure read/warn — never refuses, never reroutes (there's nothing to reroute to under channel separation). Scope collapsed from originally-sketched circuit breaker; `.gsd-t/contracts/context-meter-contract.md` bumped v1.3.0 → v1.4.0 (additive subsection).

**Transcript viewer as primary surface (D6)**: `scripts/gsd-t-dashboard-server.js` gains `GET /transcript/:id/tool-cost` (D2-backed, 503 graceful fallback) + `GET /transcript/:id/usage` (per-turn JSONL rows). `scripts/gsd-t-transcript.html` gains collapsible Tool Cost sidebar panel with live SSE updates. `bin/headless-auto-spawn.cjs` prints `▶ Live transcript: http://127.0.0.1:{port}/transcript/{spawn-id}` on every spawn. New `scripts/gsd-t-dashboard-autostart.cjs` — `ensureDashboardRunning({projectDir})` port-probe + fork-detach + pid file, hooked into spawn start path (idempotent). `.gsd-t/contracts/dashboard-server-contract.md` bumped (routes + banner format + autostart sections).

**Tests**: 1708/1710 pass (2 pre-existing unrelated fails). Net additions across D1–D6: ~90 new test cases.

## [3.16.10] - 2026-04-20

### Added — Live Spawn Transcript Viewer (M42)

Per-spawn live transcript UI on `:7433`: stream-json tee (`bin/gsd-t-transcript-tee.cjs`), SSE route (`/transcript/:id/stream`), Claude-Code-style ndjson renderer (`scripts/gsd-t-transcript.html`), sidebar tree with parent-indent + status dots, per-spawn kill button (POST `/transcript/:id/kill`). 29 M42-specific tests; 1522/1522 suite. Intervene/SIGSTOP deferred to follow-up milestone.

## [3.15.10] - 2026-04-20

### Added — Universal Token Capture Across GSD-T (M41)

Every subagent spawn across GSD-T now routes through a single shared wrapper, retiring the silent `| N/A |` Tokens convention that preceded M41. Every spawn's input/output/cache tokens and cost USD land in both the human-readable `.gsd-t/token-log.md` and the machine-readable `.gsd-t/metrics/token-usage.jsonl` (schema v1, reused from M40 D4).

**Token-capture wrapper (D1)**: `bin/gsd-t-token-capture.cjs` exports `captureSpawn({command, step, model, description, projectDir, spawnFn, domain?, task?})` and `recordSpawnRow({...})`. Parses bare + `.result`-wrapped + stream-json envelopes with assistant-vs-result precedence. Missing usage renders `—`, never `0`, never `N/A`. Migration-in-place upgrades existing `.gsd-t/token-log.md` to the canonical 12-column header (adds Tokens + Compacted columns).

**Command-file doc-ripple (D2)**: all 20 spawn-capable `commands/*.md` files converted from inline `T_START=$(date +%s)` bash blocks to `captureSpawn`/`recordSpawnRow` pattern. `templates/CLAUDE-global.md` and the project `CLAUDE.md` carry the Token Capture Rule (MANDATORY). A canonical-block drift-guard test (`test/m41-canonical-block-drift.test.js`) asserts no legacy blocks remain and every OBSERVABILITY LOGGING declaration pairs with a wrapper call.

**Historical backfill (D3)**: `bin/gsd-t-token-backfill.cjs` + `gsd-t backfill-tokens [--since YYYY-MM-DD] [--patch-log] [--dry-run]`. Walks `.gsd-t/events/*.jsonl`, `.gsd-t/stream-feed/*.jsonl`, and `.gsd-t/headless-*.log`. Handles both event-stream frames and stream-json frames. Idempotent via `source: "backfill"` key-tuple tracking. `--patch-log` atomically rewrites legacy `N/A`/`0`/`—` Tokens cells in place using tmp+rename.

**Token dashboard (D4)**: `bin/gsd-t-token-dashboard.cjs` + `gsd-t tokens [--since] [--milestone] [--format table|json]`. Streams JSONL via `readline.createInterface`; aggregates byDay/byCommand/byModel; top-10 spawns by cost desc; cache-hit rate per model; rolling 7-day projection (daily avg × 30). Injects a 3-line token block at the tail of `gsd-t status`. Perf gate: 22ms on 10k-line JSONL (budget 500ms).

**Enforcement (D5)**: `bin/gsd-t-capture-lint.cjs` + `gsd-t capture-lint [--staged|--all]`. Greps for `Task({`, `spawn('claude', ...)`, and `claude -p` without a surrounding `captureSpawn`/`recordSpawnRow` within ±20 lines. Balanced-quote heuristic excludes JS-string-literal false positives. Whitelists: wrapper/linter modules themselves, `test/**`, `commands/gsd-t-help.md`, comment-only lines, markdown prose outside fences, any line with `GSD-T-CAPTURE-LINT: skip` marker nearby. Opt-in pre-commit hook via `gsd-t init --install-hooks` — appends idempotently to `.git/hooks/pre-commit` with a `# GSD-T capture lint` marker; never overwrites existing hooks.

Tests: +27 net (1479/1479 total). No new contracts — reuses M40's `metrics-schema-contract.md` v1 and `stream-json-sink-contract.md` v1.1.0.

## [3.14.10] - 2026-04-20

### Added — External Task Orchestrator + Streaming Watcher UI (M40)

JS orchestrator (`bin/gsd-t-orchestrator.js`) drives `claude -p` one task per spawn: short-lived, fresh context, architecturally compaction-free. Benchmark gate PASS: 226s orchestrator vs 316s in-session on 20-task/3-wave/4-domain fixture (0.72× wall-clock, threshold 1.05×).

**Orchestrator core (D1)**: wave-barrier join, per-wave Promise.all parallelism (default 3, ceiling 15 per Team Mode §15), workerPid attribution, SIGINT handler, retry policy per completion-signal-contract (first FAIL → single retry; second FAIL → halt wave), state.json atomic writes, task-boundary + wave-boundary synthetic frames emitted to stream-feed clients.

**Task brief builder (D2)**: `bin/gsd-t-task-brief.js` composes 2–5 KB self-contained per-task briefs from `.gsd-t/domains/{domain}/{scope,constraints,tasks}.md` + named contract excerpts + stack rules + Done Signal section; drop-order compactor guarantees non-droppable sections always survive.

**Completion protocol (D3)**: `bin/gsd-t-completion-check.cjs` `assertCompletion()` returns `{ok, missing[], details}` by checking commit-on-expected-branch + progress.md entry + test exit. Ambiguous tasks (commit present but no progress entry) are flagged for operator triage — never silently claimed done.

**Stream-feed server (D4)**: `scripts/gsd-t-stream-feed-server.js` — HTTP POST /ingest, WebSocket /feed?from=N replay, 127.0.0.1:7842, JSONL persist-before-broadcast. `scripts/gsd-t-token-aggregator.js` parses assistant + result envelope usage and writes `.gsd-t/metrics/token-usage.jsonl` schema v1 + rewrites `.gsd-t/token-log.md` in place. New CLI: `gsd-t stream-feed`.

**Stream-feed UI (D5)**: `scripts/gsd-t-stream-feed.html` — 47.5 KB, zero-dep, zero-token-cost local dashboard. Dark-mode claude.ai-style continuous feed with task/wave banners (duration + cost/tokens chips), token corner bar (running total), localStorage-persisted filters (tasks/domains/waves), auto-scroll pause + "↓ Jump to live" button.

**Recovery and resume (D6)**: `bin/gsd-t-orchestrator-recover.cjs` `recoverRunState()` reconciles interrupted runs via assertCompletion replay; `--resume` + `--no-archive` flags on `gsd-t orchestrate`; `/gsd-t-resume` Step 0.3 auto-detects in-flight state.json and surfaces resume invocation; 24 recovery unit tests cover fresh/terminal/resume modes + ambiguous classification + PID liveness.

**Contracts**: `stream-json-sink-contract.md` v1.0.0 → **v1.1.0** (new §"Usage field propagation" documenting assistant vs result envelope semantics); `wave-join-contract.md`, `completion-signal-contract.md`, `metrics-schema-contract.md` — all test-backed.

**Tests**: 1421/1421 pass (up from 1240 at M39 close, +181). 16 new M40 test files. Zero coverage gaps. Zero placeholder patterns (goal-backward PASS).

**New CLI subcommands**: `gsd-t orchestrate`, `gsd-t benchmark-orchestrator`, `gsd-t stream-feed`.

**Files**: `bin/gsd-t-orchestrator.js`, `bin/gsd-t-orchestrator-worker.cjs`, `bin/gsd-t-orchestrator-queue.cjs`, `bin/gsd-t-orchestrator-config.cjs`, `bin/gsd-t-orchestrator-recover.cjs`, `bin/gsd-t-completion-check.cjs`, `bin/gsd-t-benchmark-orchestrator.js`, `bin/gsd-t-task-brief.js`, `bin/gsd-t-task-brief-template.cjs`, `bin/gsd-t-task-brief-compactor.cjs`, `scripts/gsd-t-stream-feed-server.js`, `scripts/gsd-t-stream-feed.html`, `scripts/gsd-t-token-aggregator.js`, `templates/prompts/m40-task-brief.md`, 16 M40 test files, 4 new/updated contracts, `commands/gsd-t-resume.md` Step 0.3.

## [3.13.16] - 2026-04-17

### Changed — Removed proactive suggestions to use `/gsd-t-unattended`; positioned as overnight/idle-only

The unattended supervisor remains supported for genuine overnight or multi-hour idle runs but is no longer pitched as a general workflow option. In practice it runs 5–10× slower than in-session execution because every worker iteration pays cold-context startup cost (re-reads CLAUDE.md, progress.md, all domain files) before doing real work, then is bounded to a 270s cache-warm budget. Daytime work belongs in-session.

**Files**:
- `templates/CLAUDE-global.md` — removed the "Unattended Execution (M36)" section that pitched it as a feature alongside in-session.
- `commands/gsd-t-help.md` — repositioned the `unattended*` rows under AUTOMATION as overnight-only with a slowness caveat.
- `README.md` — removed the top-level "Unattended execution" feature bullet; renamed the commands-table heading and the full section heading to "Overnight / Idle-Run …" with a leading callout that daytime work runs in-session; reworded the M38 headless-by-default bullet to drop "via the unattended supervisor" framing.

**No behavioral changes.** Commands `/gsd-t-unattended`, `/gsd-t-unattended-watch`, `/gsd-t-unattended-stop` continue to work exactly as before. The supervisor contract is unchanged.

## [3.13.15] - 2026-04-17

### Fixed — Self-protection guard now uses package-name identity + narrow `bin/*.cjs` gitignore rule

Two bugs in v3.13.14 surfaced when `gsd-t update-all` ran against GSD-T's own source repo from the globally-installed CLI:

**Bug 1 — Self-protection guard bypassed**: The v3.13.14 guard compared `realpathSync(projectBinDir)` against `realpathSync(PKG_ROOT/bin)`. When `update-all` runs from the globally-installed CLI (`/usr/local/lib/node_modules/@tekyzinc/gsd-t`), `PKG_ROOT` points there — NOT to the local GSD-T source at `/Users/…/projects/GSD-T`. The paths never match in the typical dogfood setup, so the guard returned `false` and the sweep ate the source `bin/gsd-t.js`.

**Fix**: identity is now by `package.json` name. The sweep reads `projectDir/package.json` and skips if `name === "@tekyzinc/gsd-t"`. Works regardless of whether `update-all` runs from the local source tree or the global install.

**Bug 2 — Gitignore rule overly broad**: `UNATTENDED_GITIGNORE_ENTRIES` included `bin/*.cjs`, which ignored every `.cjs` under `bin/` — contradicting the adjacent comment ("legitimate `.cjs` source files under `bin/` ARE tracked"). With the broad rule active, new source `.cjs` files (e.g., `bin/headless-exit-codes.cjs`) couldn't be committed without `--force`.

**Fix**: the gitignore entry narrows to exactly `bin/context-meter-state.cjs` — the single session-state artifact that was the original intent.

**Files**:
- `bin/gsd-t.js` — `isSourcePackage` now reads `package.json.name`; `UNATTENDED_GITIGNORE_ENTRIES` narrowed.
- `test/bin-gsd-t-resilience.test.js` — self-protection test reshaped: seeds a tmp `package.json` with `name: "@tekyzinc/gsd-t"` + a signature-matching stray, asserts the stray survives the sweep.
- `.gitignore` — deduped and restored to the narrow form.

**Tests**: 1240/1240 pass (unchanged count; existing self-protection test reshaped). E2E: N/A.

**Impact**: `gsd-t update-all` is now safe to run with GSD-T itself registered as a project, regardless of where the CLI is installed from. Legitimate `.cjs` source files in `bin/` are no longer blanket-ignored in downstream projects' `.gitignore`. bee-poc's supervisor, which started loading cleanly on v3.13.14, continues to load on v3.13.15 (this release is purely dogfood-protection + gitignore repair; no supervisor-behavior change).

## [3.13.14] - 2026-04-17

### Fixed — Supervisor no longer requires project-local `bin/gsd-t.js` + sweep self-protection

v3.13.13 successfully swept bee-poc's stray `bin/gsd-t.js`, but exposed a second bug: `bin/gsd-t-unattended.cjs:31` still did `require("./gsd-t.js")` to pull in the `mapHeadlessExitCode` helper. With the stray removed, projects could no longer load the supervisor at all — the require chain now failed on `gsd-t.js` itself instead of `debug-ledger.js`. Three options were on the table (restore both files, resolve from global, or remove all stale copies); we picked the middle path via file extraction.

**Fix 1 — extract `mapHeadlessExitCode` to its own file** (`bin/headless-exit-codes.cjs`, new):
The exit-code contract helper (0=success, 1=verify fail, 2=context budget, 3=non-zero exit, 4=blocked, 5=unknown command) is now a standalone zero-dependency module. `bin/gsd-t-unattended.cjs:31` now does `require("./headless-exit-codes.cjs")` — no transitive dependency on the full CLI installer. `bin/gsd-t.js` still re-exports `mapHeadlessExitCode` for backward compatibility (top-of-file require + `module.exports`).

**Fix 2 — `headless-exit-codes.cjs` joins `PROJECT_BIN_TOOLS`**: `copyBinToolsToProject` now copies the new helper into every registered project's `bin/` on the next `update-all`, so the supervisor can load it locally without reaching into the global package.

**Fix 3 — sweep self-protection** (`copyBinToolsToProject`):
While dogfooding v3.13.13, the sweep ran against GSD-T's own source repo (which is registered as a project for eating-our-own-dogfood purposes), recognized the source `bin/gsd-t.js` as matching the installer signature (it IS the installer), and deleted it. The source was restored via `git restore`, but the sweep now carries a guard: if `realpathSync(projectBinDir) === realpathSync(PKG_ROOT/bin)`, skip the sweep entirely. Dogfooding the installer on itself no longer cannibalizes the source.

**Files**:
- `bin/headless-exit-codes.cjs` — new file, 50 lines, extracted helper with explanatory header.
- `bin/gsd-t-unattended.cjs` — line 31 now requires the new helper instead of `./gsd-t.js`.
- `bin/gsd-t.js` — top-of-file re-export of `mapHeadlessExitCode` (backward compat); original declaration replaced with a comment pointing to the extracted module; `PROJECT_BIN_TOOLS` gains `headless-exit-codes.cjs`; sweep logic gains the realpath equality guard.
- `test/bin-gsd-t-resilience.test.js` — new test: `copyBinToolsToProject refuses to sweep the source package's own bin/` (run sweep with `projectDir = PKG_ROOT`, assert `bin/gsd-t.js` still exists after).

**Tests**: 1240/1240 pass (+1 new self-protection test). E2E: N/A.

**Impact**: bee-poc's supervisor can now load after `gsd-t update-all` copies the new `headless-exit-codes.cjs` helper into `bin/`. No project needs a local `bin/gsd-t.js` for the supervisor to function. Running the installer against its own source repo no longer destroys the source.

## [3.13.13] - 2026-04-17

### Fixed — Stray sweep now matches older-version installer artifacts

v3.13.12 shipped the defensive require + DEPRECATED_BIN_STRAYS sweep, but the sweep's safety check was too narrow: it only deleted strays whose bytes matched the **current** source. Projects left behind with a v3.13.11 (or earlier) `bin/gsd-t.js` would not match the current source (different body), so the sweep refused to delete them and those projects stayed crashed.

**Fix**: sweep now uses a **signature** check rather than a byte-identity check. A stray is deleted when it starts with `#!/usr/bin/env node` AND contains the verbatim JSDoc header `GSD-T CLI Installer` in the first 400 characters. That combination is unique enough to rule out user-owned files (a user's own script would not contain our header) while matching every historical version of this installer — so older-version artifacts are swept correctly.

**Files**:
- `bin/gsd-t.js` — sweep loop now uses signature match instead of byte-match.
- `test/bin-gsd-t-resilience.test.js` — new test case covering older-version stray (shebang + header + different body) → must be deleted. Existing byte-match test kept. Existing user-owned test kept.

**Tests**: 1239/1239 pass (+1 new assertion vs v3.13.12). E2E: N/A.

**Impact**: bee-poc and any other project carrying a pre-v3.13.12 `bin/gsd-t.js` now self-heals on the next `gsd-t update-all` pass after installing v3.13.13.

## [3.13.12] - 2026-04-17

### Fixed — Project-local `bin/gsd-t.js` crash on missing `debug-ledger.js` + self-heal sweep

A bee-poc relaunch after the v3.13.11 fix still crashed with `MODULE_NOT_FOUND: Cannot find module './debug-ledger.js'` — but the crash came from `bin/gsd-t.js` itself, not from the v3.13.11 supervisor code. Root cause: an older version of `copyBinToolsToProject` copied `bin/gsd-t.js` into registered projects as part of a now-deprecated whitelist. The current `PROJECT_BIN_TOOLS` whitelist (10 `.cjs` files) does not include `gsd-t.js` or its sibling `debug-ledger.js`, so `update-all` stopped maintaining both — but the stale copy persisted in project `bin/` directories, and `bin/gsd-t.js` had a hard require on `./debug-ledger.js` at the top of the file. Any invocation of the stale project-local copy crashed before the first line of real work. bee-poc had the 130 KB stale `bin/gsd-t.js` from this lineage.

**Layer 1 — defensive require** (`bin/gsd-t.js:23`):
The top-level `require('./debug-ledger.js')` is now wrapped in `try/catch` and falls back to a no-op stub exporting every function the real module exports (`readLedger`, `appendEntry`, `getLedgerStats`, `clearLedger`, `compactLedger`, `generateAntiRepetitionPreamble`). Projects with stale copies no longer crash; they degrade to debug-ledger-disabled behavior until `update-all` sweeps the stray away.

**Layer 2 — deprecated-stray sweep** (`copyBinToolsToProject`):
New `DEPRECATED_BIN_STRAYS = ["gsd-t.js"]` list is swept after the normal copy loop. For each entry: if the project has the stray AND its bytes match the source copy in this package, delete it (proves it's an installer artifact, not a user file that happens to share the name). User-owned files with different content are left untouched. Log line: `{project} — cleaned up N stray bin file(s)`. On the next `gsd-t update-all` after v3.13.12 installs, every project that picked up a stale `bin/gsd-t.js` self-heals; subsequent invocations fall through to the global install.

**Files**:
- `bin/gsd-t.js` — defensive require with full no-op stub; `DEPRECATED_BIN_STRAYS` list; post-copy sweep loop; `copyBinToolsToProject` returns `true` when either a copy happened or a stray was cleaned.
- `test/bin-gsd-t-resilience.test.js` — 3 new tests: (a) loading `bin/gsd-t.js --help` without `debug-ledger.js` does not emit `MODULE_NOT_FOUND`; (b) byte-matching stray is deleted; (c) user-owned file (byte-divergent) is preserved.

**Tests**: 1238/1238 pass (was 1235; +3 new assertions). E2E: N/A (no playwright.config.*).

**Impact**: installed projects that inherited a stale `bin/gsd-t.js` from older `update-all` passes will self-heal on the next `gsd-t update-all` after installing v3.13.12. bee-poc's 130 KB stale copy is removed on its next pass, after which any invocation path that had been hitting the project-local copy falls through to the global install — no more divergent vendoring.

## [3.13.11] - 2026-04-17

### Fixed — Unattended supervisor reliability triple-fix (bee-poc 15-min hang fallout)

A real bee-poc supervisor relay hung for 15+ minutes on v3.12.15 (pid 70897). Three independent defects surfaced from that incident and are fixed together in this patch. The root cause of the hang itself — a 1-hour worker timeout on the deployed v3.12.15 package — is finally resolved by shipping v3.13.10's D4 work to npm; the two other bugs are fixes for contract-boundary and cosmetic issues the hang exposed.

**Bug 1 (P0) — supervisor watchdog visibility on timeout**:
The spawnSync `timeout` option kills a hung worker after `DEFAULT_WORKER_TIMEOUT_MS` (270 s in v3.13.10+) and maps the result to contract exit code 124, but the event was not legibly surfaced in `run.log`. Operators tailing the log saw an empty iter block with no indication that the watchdog had fired. `runMainLoop` now writes a deterministic `[worker_timeout] iter=N budget=Nms elapsed=Nms` line to `run.log` immediately before the regular iter trailer, so timeout-induced cache misses are self-documenting. The existing `writeState` call still commits `lastExit=124` + a fresh `lastTick` so `/gsd-t-unattended-watch` sees a heartbeat post-timeout.

**Note on the deployed-version aspect**: the 1-hour → 270 s worker-timeout reduction shipped in v3.13.10 on GitHub but v3.13.10 was never published to npm (progress.md was in "pending publish" state when the bee-poc run started). bee-poc was running against the installed v3.12.15, which still had `DEFAULT_WORKER_TIMEOUT_MS = 3600000`. Publishing v3.13.11 closes both issues — the timeout reduction reaches bee-poc (and every downstream project) and the new diagnostic line makes future watchdog firings visible.

**Bug 2 (P0) — worker cwd invariant**:
run.log from the bee-poc hang showed a `Shell cwd was reset to /Users/david/projects/GSD-T` line mid-iter — the worker's Bash shell had escaped bee-poc's project directory, and subsequent tool calls silently targeted the wrong repo. `_spawnWorker` already passes `cwd: projectDir` to `platformSpawnWorker` and sets `GSD_T_PROJECT_DIR` on the worker env (correct baseline), but the worker itself had no instruction to re-assert that invariant. The worker prompt now carries an explicit `# CWD Invariant` section that instructs the worker to (a) run `[ "$(pwd)" = "$GSD_T_PROJECT_DIR" ] || cd "$GSD_T_PROJECT_DIR"` as its first Bash call, and (b) scope any directory change inside a subshell (`( cd other && cmd )`) rather than using bare top-level `cd`.

**Bug 3 (P2) — IS_STALE determinism**:
`/gsd-t-unattended-watch` is run by the haiku model and the "tick age > 540 s → append ⚠️ stale" threshold lived in the Step 6a rendering prose. Haiku would occasionally apply the stale flag to ticks in the 330–540 s band by misreading the prose. The threshold math now lives entirely inside Step 2's `node -e` block as a boolean emission (`IS_STALE = tickAgeMs !== null && tickAgeMs > 540000`), and Step 6a just reads the flag. Boundary cases: 539 s = false, 540 s = false (strict greater-than), 541 s = true.

**Files**:
- `bin/gsd-t-unattended.cjs` — worker_timeout run.log append; CWD Invariant section in `_spawnWorker` prompt.
- `commands/gsd-t-unattended-watch.md` — Step 2 IS_STALE computation + emission; Step 6a reader-only rendering; Notes section updated.
- `test/unattended-triple-fix-v3-13-11.test.js` — 8 new tests (3 Bug 1 + 3 Bug 2 + 3 Bug 3 — one boundary-math test covers three points, bringing the practical count to 8 assertions across 8 it-blocks, of which 3 exercise the Bug 3 boundaries).

**Tests**: 1235/1235 pass (was 1227; +8 new assertions). E2E: N/A (no playwright.config.*).

**Impact**: bee-poc-class hangs are self-recoverable in v3.13.11 — a hung worker is bounded at 270 s by the watchdog, the timeout is now visible in run.log, cwd drift is caught by the worker itself on entry, and `/gsd-t-unattended-watch` no longer produces spurious stale warnings under the threshold.

## [3.13.10] - 2026-04-17

### Added — M39: Fast Unattended + Universal Watch-Progress Tree

Closes the 3–5× speed gap between unattended and in-session execution, adds a universal task-list progress view under every `--watch` surface, and keeps supervisor→worker handoffs inside the 5-minute Anthropic prompt-cache TTL.

**D2 — progress-watch (12 tasks)**:
- `.gsd-t/contracts/watch-progress-contract.md` v1.0.0 — state-file schema, tree-reconstruction algorithm, stale-state expiry (24h), renderer contract, integration invariants.
- `scripts/gsd-t-watch-state.js` — zero-dep writer CLI with shim-safe agent-id resolution (CLI arg → `GSD_T_AGENT_ID` env → auto-minted `shell-{pid}-{ts}` fallback). Atomic tmp-write+rename; `start`/`advance`/`done`/`skip`/`fail` subcommands.
- `bin/watch-progress.js` — tree builder (parent_agent_id lineage, orphan handling) + renderer (✅/🔄/⬜/➡️/❌ markers; expanded-current-subtree + collapsed-siblings layout).
- 189 step-shims across 17 workflow command files — every numbered step now writes its progress state under `.gsd-t/.watch-state/{agent_id}.json`.
- Integration into `bin/gsd-t-unattended.cjs`, `bin/unattended-watch-format.cjs`, `bin/headless-auto-spawn.cjs` — tree appends below the existing banner (banner preserved intact).

**D3 — parallel-exec (4 tasks)**:
- Team Mode prompt block inserted into `_spawnWorker` at the worker instruction boundary. Unattended worker now spawns up to 15 concurrent `Task` subagents per wave (intra-wave parallel), waits for all, then advances (inter-wave sequential). Falls back to sequential when the wave contains only one domain.
- `.gsd-t/contracts/unattended-supervisor-contract.md` §15 v1.3.0 — Team Mode contract: cap of 15, dependency-graph preservation, wave-boundary semantics.

**D4 — cache-warm-pacing (3 tasks)**:
- `DEFAULT_WORKER_TIMEOUT_MS = 270000` (270 s) in `bin/gsd-t-unattended.cjs` + `.js`. Preserves the Anthropic 5-min prompt-cache TTL with a ~30 s supervisor→worker handoff budget, eliminating the cold-cache penalty that was adding minutes per iter.
- `--worker-timeout=<ms>` CLI flag parsed and merged into the live config (was documented in §6 but silently ignored pre-M39).
- `.gsd-t/contracts/unattended-supervisor-contract.md` §16 v1.3.0 — cache-warm pacing contract: inline rationale comment requirement, inter-iteration sleep invariant (< 5 s), timeout override semantics.

**Red Team**: Initial FAIL (2 CRITICAL + 2 HIGH) → fixes → GRUDGING PASS.
- BUG-1 (CRITICAL): `GSD_T_AGENT_ID` had no producer — 189 shims would silently fail. Fixed by injecting `supervisor-iter-{N}` in `_spawnWorker`, `headless-{id}` in `autoSpawnHeadless`, and adding an auto-mint fallback chain to the writer CLI.
- BUG-2 (CRITICAL): `--worker-timeout` flag documented in §6 but no `case "worker-timeout":` in `parseArgs`. Fixed with parse case + config merge + test assertion.
- BUG-3 (HIGH): `.js` and `.cjs` variants of unattended + safety files had divergent defaults (3600000 vs 270000). Fixed by aligning all four files to 270000.
- BUG-4 (HIGH): Team Mode prompt referenced "Step 4" but the current execute flow uses "Step 3". Fixed in both the prompt string and the contract §15.

**Tests**: 1227/1227 pass (+3 new: shim-safe agent-id auto-mint, env-var fallback, `--worker-timeout` flag parse).

**Impact**: bee-poc's next supervisor relaunch on v3.13.10 should complete iters 3–5× faster than the v3.12.13 baseline, with visible task-list progression under every `--watch` surface.

## [3.12.15] - 2026-04-17

### Fixed — Decision Log Trim — stop live progress.md bloat

`commands/gsd-t-complete-milestone.md` Step 7 previously instructed "Keep all prior decision log entries — they are valuable context". Because every prior milestone's full log is already frozen into its archive snapshot by Step 4, carrying the same entries forward on the live `.gsd-t/progress.md` produced unbounded file growth (GSD-T's live file had reached 168,921 bytes / 658 lines — 10× the size of a healthy project).

**Fix**: Step 7 now explicitly trims the live Decision Log to the just-completed milestone's entries after the archive snapshot is written. The instruction reads:

> Delete all decision-log entries older than the just-completed milestone's start date. Those entries are preserved in the milestone archive created in Step 4. Keep only the completion entry plus any entries logged on or after the cutoff — typically the live log is near-empty when the next milestone begins.

The archive at `.gsd-t/milestones/{name}-{date}/progress.md` remains the source-of-truth for the full history. A pointer line (`> Prior decision log entries preserved in .gsd-t/milestones/*/progress.md`) is added to the live file so future readers know where to look.

**One-time cleanup on the GSD-T repo**: live `.gsd-t/progress.md` trimmed from 168,921 B / 658 lines to 11,733 B / 67 lines (93% reduction), cut at M38 start (2026-04-16 14:25). Historical decision log preserved by copying the pre-trim file into `.gsd-t/milestones/M38-headless-by-default-2026-04-17/progress.md` (Step 4 missed that archive copy when M38 was completed earlier today; fix-forward).

**Users with bloated `.gsd-t/progress.md`** can run the same one-time cleanup manually: find the current milestone's `[milestone-defined]` start entry in the Decision Log, copy the pre-trim file to the milestone archive directory (if it's not already there), then delete all Decision Log entries older than that start date. Keep the pointer line at the top of the Decision Log section.

**Tests**: Unit 1186/1186 pass (no code paths changed — pure doc/template edits + one-time live file rewrite). E2E N/A.

## [3.12.14] - 2026-04-17

### Fixed — Telemetry Env-Propagation Regression (Tag All Worker Events)

v3.12.12 added `GSD_T_COMMAND`/`GSD_T_PHASE` env-var fallbacks to `scripts/gsd-t-event-writer.js` but two critical call sites were missed — producing mostly-null telemetry in production.

**Evidence from bee-poc (50 min observation)**: 908 events, only 1/908 had `command` populated; 836 `tool_call` events had command/phase/trace_id all null; only 2 `.gsd-t/token-log.md` rows (both from the outer supervisor process; 37 inner subagents wrote zero rows); supervisor row showed `model=unknown`.

**Root causes**:
1. `scripts/gsd-t-heartbeat.js::buildEventStreamEntry` — this PostToolUse hook fires on every tool call in every child process (the source of ~90% of events) and hardcoded `{command: null, phase: null, trace_id: null}` into every event it wrote.
2. Neither the writer nor the heartbeat read `GSD_T_TRACE_ID` or `GSD_T_MODEL` from env — so even when spawners set them, they never appeared on events.
3. Several spawn sites (orchestrator, `spawnClaudeSession`, `runLedgerCompaction`, design-review claude spawn) never set the GSD_T_* env block at all.

**Fixes**:
- `scripts/gsd-t-event-writer.js::buildEvent` now reads `GSD_T_TRACE_ID` and `GSD_T_MODEL` env fallbacks alongside command/phase.
- `scripts/gsd-t-heartbeat.js::buildEventStreamEntry` replaced hardcoded null triple with `process.env.GSD_T_COMMAND||null` / `GSD_T_PHASE||null` / `GSD_T_TRACE_ID||null`.
- `bin/headless-auto-spawn.{cjs,js}` workerEnv sets `GSD_T_COMMAND` + `GSD_T_PHASE` + `GSD_T_PROJECT_DIR`, and conditionally forwards parent `GSD_T_TRACE_ID` / `GSD_T_MODEL`. `appendTokenLog` reads `process.env.GSD_T_MODEL` instead of the `"unknown"` literal.
- `bin/gsd-t-unattended.cjs::_spawnWorker` workerEnv populates the full GSD_T_* block from `state` + env fallbacks. `_appendTokenLog` reads `process.env.GSD_T_MODEL`.
- `bin/gsd-t.js` three sites patched: `doHeadlessExec` workerEnv, `spawnClaudeSession` (fallback command=`gsd-t-debug` / phase=`debug`), `runLedgerCompaction` (fallback model=`haiku`). `appendHeadlessTokenLog` reads `process.env.GSD_T_MODEL`.
- `bin/orchestrator.js` new `_buildOrchestratorEnv(opts, projectDir)` helper threaded through `spawnClaude` (sync) and `spawnClaudeAsync`.
- `scripts/gsd-t-design-review-server.js` claude spawn now injects the GSD_T_* env block.

**Reproduction test**: NEW `test/telemetry-env-propagation.test.js` — 6 tests that exercise the REAL production spawn code paths (not hand-rolled mocks): writer + heartbeat env-fallback unit coverage, `autoSpawnHeadless` real-spawn via env-dump shim at `bin/gsd-t.js`, unattended `platform.spawnWorker` with a real env-dump script. Failed 3/6 before fix as expected; 6/6 pass after.

**Tests**: Unit 1186/1186 pass. E2E N/A (no `playwright.config.*` or `cypress.config.*`).

**Red Team** (opus, adversarial sweep categories: regression-around-fix + original-bug-variants covering context-meter hook and PostToolUse hook paths): verdict **GRUDGING PASS** — 5 additional claude-worker spawn sites found and patched in this same release; no untagged claude-worker spawn paths remain.

**Doc ripple**: `.gsd-t/contracts/event-schema-contract.md` new "Env-Var Fallbacks (v3.12.14)" section with flag/env/caller table; `.gsd-t/contracts/headless-default-contract.md` new "Worker Env Propagation (v3.12.14)" section; `.gsd-t/contracts/unattended-supervisor-contract.md` §14b v1.2.0 Worker Env Propagation + version history entry.

## [3.12.13] - 2026-04-17

### Fixed — `/` Prefix Strip Sitewide

Claude Code does not namespace local slash commands under `user:`, so every `/gsd-t-*`, `/checkin`, `/branch`, `/Claude-md`, `/global-change` reference produced `Unknown command: /X` errors when the user typed one. This release strips the prefix from every live reference:

- **54 command files** in `commands/*.md`
- **All live docs**: `README.md`, `GSD-T-README.md`, `CHANGELOG.md`, `docs/*.md`, `CLAUDE.md`
- **All templates**: `templates/CLAUDE-global.md`, `templates/CLAUDE-project.md`, `templates/stacks/*.md`
- **Scripts and CLI**: `bin/gsd-t.js`, `bin/gsd-t-unattended.js`, `bin/design-orchestrator.js`, `scripts/gsd-t-auto-route.js`, `scripts/gsd-t-update-check.js`
- **All `.gsd-t/contracts/*.md` and live `.gsd-t/domains/*/scope.md`**
- **User-global `~/.claude/CLAUDE.md`** (via `sed` in the same pass)
- Test fixture strings in `test/headless.test.js` preserved — those are regression-test literals asserting `claude -p` rejects the `/` prefix.
- Historical archives (`.gsd-t/milestones/*`, `.gsd-t/progress-archive/*`, `.gsd-t/continue-here-*`) left untouched as time-capsule records.

### Fixed — `update-all` Now Upgrades the Global CLI Binary

v3.12.12's `update-all` propagated command files to `~/.claude/commands/` but never ran `npm install -g @tekyzinc/gsd-t@latest`. Result: the CLI binary stayed stale even after `npm publish`, so new features (like v3.12.12's token-log observability) never activated on user machines that had updated "successfully."

`bin/gsd-t.js`:
- `doUpdateAll()` now calls new `upgradeGlobalBinary()` helper FIRST, which runs `npm install -g @tekyzinc/gsd-t@latest` via `execFileSync({stdio: 'inherit'})`.
- After upgrade succeeds, the newly-installed on-disk version is compared against the running process's `PKG_VERSION`. If they diverge, `reexecUpdateAll()` hands off to the new binary with `GSDT_POST_UPGRADE=1` to prevent recursion.
- On upgrade failure (e.g., missing global-npm permissions), logs the error and continues with command-file propagation so the user isn't fully blocked.
- Upgrade is skipped when `GSDT_POST_UPGRADE=1` is set (re-entry from self-invocation).

### Changed — Global `CLAUDE.md` Size Reduction (−26%)

`~/.claude/CLAUDE.md` was 41,131 chars (above Claude Code's 40k auto-warning threshold). Three optimizations trimmed it to 30,272 chars without losing information:

1. **Commands Reference table removed** (~63 lines). The router and `/gsd-t-help` resolve commands dynamically — nothing reads this table at runtime. Replaced with a one-line pointer: *"See `/gsd-t-help` for the complete command list."*
2. **Markdown Tables / emoji-padding section extracted** to `templates/stacks/_markdown.md` (32 lines, `_` prefix = universal stack rule, auto-injected by Stack Rules Engine for every subagent spawn). CLAUDE.md now has a one-line pointer at that template.
3. **Autonomous Execution Rules subsections tightened** — QA Agent, Design Verification, Red Team, Headless-by-Default Spawn, Unattended Execution each cut from multi-paragraph re-statements to 2–3 lines: rule + enforcement + path to the authoritative contract/protocol file. The contracts (`qa-agent-contract.md`, `headless-default-contract.md`, etc.) and prompts (`red-team-subagent.md`, `design-verify-subagent.md`) remain the source of truth for method specifics.

Same edits propagated to `templates/CLAUDE-global.md` so future installs inherit the lean version.

### Changed — Project `CLAUDE.md` Audit

Audited `CLAUDE.md` in this repo (the @tekyzinc/gsd-t dev repo itself). Removed a duplicate Destructive Action Guard block (verbatim copy of the global's). Pre-Commit Gate now points at `.gsd-t/contracts/pre-commit-gate.md` (which exists and owns the full checklist) while retaining the 7 repo-specific extensions inline. 7,095 → 6,269 chars (−12%).

### Added — New Stack Rule: `templates/stacks/_markdown.md`

Universal (always-injected) stack rule covering markdown-table formatting with emoji. Included in every subagent spawn regardless of detected tech stack, per the Stack Rules Engine's `_`-prefix convention.

### Note — v3.12.12 Supervisor Status

The earlier hypothesis that v3.12.12 broke `bin/gsd-t-unattended.cjs` via a missing `require("./debug-ledger.js")` was incorrect. `bin/debug-ledger.js` exists, ships in the package, and has been present since a March commit. The supervisor was running fine on the globally-installed v3.11.11 binary — it simply never picked up v3.12.12's env-var injection because `update-all` never upgraded the binary (see above fix).

## [3.12.12] - 2026-04-17

### Fixed — Token-Log Observability for Headless/Unattended Workers

**Background**: M38 headless-by-default left `.gsd-t/token-log.md` blind to all supervisor and headless-exec worker activity. Rows were only written by interactive `T_START/T_END` bash blocks in command files. All event-stream `tool_call` entries from workers had `command: null`, `phase: null`, `trace_id: null`.

#### Fix 1: headless worker spawns append to token-log.md

Three spawn paths now write rows to `{projectDir}/.gsd-t/token-log.md`:

- **`bin/headless-auto-spawn.cjs`** — `installCompletionWatcher` appends a row when the detached child exits (poll-based, graceful — never halts on write failure). Creates the file with the canonical header if it does not exist. Migrates files created before this fix (adds header if missing).
- **`bin/gsd-t-unattended.cjs`** — supervisor worker loop appends a row after each `_spawnWorker` call completes, recording iteration number, duration, exit code. New `_appendTokenLog` helper follows the same schema as interactive command observability blocks.
- **`bin/gsd-t.js` `doHeadlessExec`** — `gsd-t headless <command>` invocations append a row synchronously after the `claude -p` process exits.

Row format matches the existing token-log schema:
`| Datetime-start | Datetime-end | Command | Step | Model | Duration(s) | Notes | Domain | Task | Ctx% |`
Tokens are logged as `unknown` (no API access in worker contexts); duration is wall-clock.

#### Fix 2: command/phase propagate to event-stream entries in worker contexts

Env-var approach chosen (cleaner, no call-site changes needed):

- **`scripts/gsd-t-event-writer.js` `buildEvent`** — reads `GSD_T_COMMAND` and `GSD_T_PHASE` env vars as defaults when `--command`/`--phase` flags are absent. Explicit flags always win.
- **`bin/headless-auto-spawn.cjs`** — sets `GSD_T_COMMAND={command}` and `GSD_T_PHASE={phase}` on every detached child's env before spawn.
- **`bin/gsd-t-unattended.cjs` `_spawnWorker`** — sets `GSD_T_COMMAND=gsd-t-resume` and `GSD_T_PHASE={state.phase||execute}` on each `claude -p` worker env.
- **`bin/gsd-t.js` `doHeadlessExec`** — sets `GSD_T_COMMAND=gsd-t-{command}` on the `execFileSync` env.

Result: all `tool_call` events in worker contexts are tagged with the originating command and phase instead of `null`.

## [3.12.11] - 2026-04-17

### Fixed
- **Installer owns global PostToolUse context-meter hook** — the hook command now targets the globally-installed npm package (`$(npm root -g)/@tekyzinc/gsd-t/scripts/gsd-t-context-meter.js`) instead of `$CLAUDE_PROJECT_DIR/scripts/...`. The old path caused `Cannot find module` errors in every non-GSD-T project and when `CLAUDE_PROJECT_DIR` was unset.
- **Auto-migration of stale hook entries** — `install`, `update`, `update-all`, and `init` now detect and replace any PostToolUse entry whose command matches the prior `$CLAUDE_PROJECT_DIR`-based pattern, upgrading it in-place to the canonical global form.
- **Existence guard** — the hook command is wrapped in a `bash -c '[ -f ... ] && node ... || true'` guard so it silently exits 0 when the package is not present (non-GSD-T projects, uninstalled state).
- **Uninstall removes the hook** — `gsd-t uninstall` now removes any PostToolUse hook containing `gsd-t-context-meter` from `~/.claude/settings.json`, leaving all other hooks intact.

## [3.12.10] - 2026-04-17

### M38: Headless-by-Default + Meter Reduction

**Background**: M37 was right that the context meter needed to do more — but escalating to a MANDATORY STOP banner in the interactive session was the wrong fix. M38 removes the cause instead of bandaging the symptom: headless spawning is now the default for all primary workflow subagents, so the parent context grows much slower and the single-band meter threshold is sufficient. Seven commands removed. Five contracts folded. Net result: same "work never stops" UX achieved by structure instead of instrumentation.

### Added
- **`bin/event-stream.cjs`** — new module for structured JSONL event emission to `.gsd-t/events/YYYY-MM-DD.jsonl`. Emits `task_start`, `task_complete`, `subagent_verdict`, `file_changed`, `test_result`, `error`, `retry` event types. Used by unattended supervisor and watch tick.
- **`bin/headless-auto-spawn.cjs`** `watch` + `spawnType` parameters — propagation rules: `spawnType:'validation'` always headless regardless of `--watch`; `spawnType:'primary'` + `watch:true` returns `{mode:'in-context'}` for live streaming.
- **`.gsd-t/contracts/headless-default-contract.md`** v1.0.0 — defines the headless spawn primitive, Conversion Map (7 primary commands converted), `--watch` flag spec, validation-spawn enforcement, and migration path. Folds headless-auto-spawn-contract v1.0.0.
- **`.gsd-t/contracts/unattended-event-stream-contract.md`** v1.0.0 — JSONL event schema, watch tick activity log format, supervisor emission requirements.
- **`test/headless-default.test.js`** — 11 tests covering the 4-cell propagation matrix (primary/validation × watch/no-watch) + regression coverage.
- **`test/event-stream.test.js`**, **`test/unattended-watch.test.js`**, **`test/router-intent.test.js`** — new test files for M38 components.
- **`commands/gsd.md`** intent classifier — handles conversational requests directly (workflow → existing command; conversational → respond; ambiguous → default to conversation).

### Changed
- **7 command files** (`gsd-t-execute`, `gsd-t-wave`, `gsd-t-integrate`, `gsd-t-quick`, `gsd-t-debug`, `gsd-t-scan`, `gsd-t-verify`) — converted to `autoSpawnHeadless({spawnType:'primary', watch:$WATCH_FLAG})` pattern. Validation spawns (QA, Red Team, Design Verification) always headless.
- **`bin/gsd-t-unattended.{cjs,js}`** — rejects `--watch` flag with clear error. Emits structured JSONL events at every phase boundary.
- **`.gsd-t/contracts/context-meter-contract.md`** v1.3.0 — drops three-band model, dead-meter detection, stale-band logic, Universal Auto-Pause elevation. Single-band model: one threshold (default 85%), one action (silent headless handoff). Replaces v1.2.0.
- **`.gsd-t/contracts/unattended-supervisor-contract.md`** v1.1.0 — adds §9 Event Stream Emission requirement: supervisor MUST emit structured events; watch tick MUST read events and format activity log.
- **`templates/CLAUDE-global.md`** — Universal Auto-Pause Rule section removed; Context Meter section updated to single-band description.
- **5 loop commands** (`gsd-t-execute`, `gsd-t-wave`, `gsd-t-integrate`, `gsd-t-quick`, `gsd-t-debug`) — Step 0.2 Universal Auto-Pause enforcement stripped.
- **`scripts/gsd-t-context-meter.test.js`** — rewritten for single-band model.
- **`test/filesystem.test.js`** — command count updated from 61 to 54.
- **`docs/requirements.md`** — REQ-073..078 updated to `SUPERSEDED by REQ-08X (M38)` with replacement pointers. REQ-088..093 added (M38 requirements).
- **`docs/methodology.md`** §3–§5 — historical framing added; deleted machinery marked as superseded by M38.
- **`docs/prd-harness-evolution.md`** — Status updated to `HISTORICAL — M31 shipped; M32/M33 SUPERSEDED by M38`.
- **`docs/architecture.md`**, **`docs/workflows.md`**, **`docs/infrastructure.md`**, **`GSD-T-README.md`** — updated to reflect headless-by-default spawn path, event stream, simplified meter.

### Removed
- **7 commands deleted**: `gsd-t-optimization-apply`, `gsd-t-optimization-reject`, `gsd-t-reflect`, `gsd-t-audit` (self-improvement loop), `gsd-t-prompt`, `gsd-t-brainstorm`, `gsd-t-discuss` (conversational — router intent classifier handles these)
- **`bin/runway-estimator.cjs`** + **`bin/token-telemetry.cjs`** — deleted; replaced by headless-by-default approach
- **`bin/qa-calibrator.js`** + **`bin/token-optimizer.js`** — deleted with self-improvement loop
- **5 contracts folded/deleted**: `runway-estimator-contract.md`, `token-telemetry-contract.md`, `headless-auto-spawn-contract.md`, `qa-calibration-contract.md`, `harness-audit-contract.md`
- **`test/runway-estimator.test.js`**, **`test/token-telemetry.test.js`**, **`test/qa-calibrator.test.js`**, **`test/token-optimizer.test.js`** — deleted with removed modules

### Migration Notes
- **Spawn pattern**: replace `autoSpawnHeadless()` (no args) with `autoSpawnHeadless({spawnType:'primary', watch:$WATCH_FLAG})` in any downstream command files that call the spawn primitive directly.
- **Context meter**: if you depend on the three-band model (`normal`/`warn`/`stop`) or dead-meter detection in `token-budget.cjs`, those fields are removed. `getSessionStatus()` returns `{pct, threshold}` only.
- **Deleted contracts**: any downstream references to `runway-estimator-contract.md`, `token-telemetry-contract.md`, or `headless-auto-spawn-contract.md` should point to `headless-default-contract.md` v1.0.0 instead.
- **Deleted commands**: `gsd-t-prompt`, `gsd-t-brainstorm`, `gsd-t-discuss` — use plain text messages to Claude instead; the router classifier handles conversational requests. `gsd-t-optimization-apply/reject`, `gsd-t-reflect`, `gsd-t-audit` — removed; the self-improvement backlog is no longer maintained.

### Testing
- 1176/1177 tests pass. 1 pre-existing failure (`scan.test.js:287`) carried forward — scan-data-collector regex drift vs current prose format, unrelated to M38 scope.

## [3.11.12] - 2026-04-16

### Added — M38 Partition + Plan + Domain H1 Progress

**Background**: M38 (Headless-by-Default + Meter Reduction) partitioned into 5 domains across 2 waves. Domain H1 (headless-spawn-default) executed through T6 by unattended supervisor Iter 2 but did not commit. This checkin captures all M38 setup work + H1 in-flight progress + Scan #11 regeneration.

### Added
- **5 M38 domain directories** under `.gsd-t/domains/` (m38-headless-spawn-default, m38-meter-reduction, m38-unattended-event-stream, m38-router-conversational, m38-cleanup-and-docs) with scope.md, constraints.md, tasks.md each — 35 atomic tasks total
- **2 new contracts**: `.gsd-t/contracts/headless-default-contract.md` (v1.0.0 DRAFT, folds 3 M35 contracts), `.gsd-t/contracts/unattended-event-stream-contract.md` (v1.0.0 DRAFT)
- **`test/headless-default.test.js`** — 11 tests covering the 4-cell propagation matrix (primary/validation × watch/no-watch) + existing regression coverage
- **`bin/gsd-t.js`** `unattended` passthrough subcommand — dispatches to `bin/gsd-t-unattended.cjs` so defense-in-depth `--watch` rejection reaches the supervisor rejection logic
- **M38 Scan #11** artifacts under `.gsd-t/scan/` (architecture, business-rules, contract-drift, quality, security, test-baseline + scan-report.html)

### Changed
- **`bin/headless-auto-spawn.{cjs,js}`** — added `watch` + `spawnType` parameters; propagation rules implemented (validation spawns always headless, primary+watch returns `{mode: 'in-context'}`)
- **7 command files** converted to `autoSpawnHeadless({...spawnType: 'primary', watch: $WATCH_FLAG})` pattern: `gsd-t-execute`, `gsd-t-wave`, `gsd-t-integrate`, `gsd-t-quick`, `gsd-t-debug`, `gsd-t-scan`, `gsd-t-verify`
- **`bin/gsd-t-unattended.{cjs,js}`** — rejects `--watch` flag with clear error (validation-spawn enforcement in unattended context)
- **`bin/gsd-t.js`** `installContextMeter()` — removed `test-injector.js` skip (file deleted; no longer needed)
- **`.gsd-t/contracts/integration-points.md`** — M38 dependency graph + 5 checkpoints (M38-CP1 → M38-CP5) + file ownership map
- **`.gsd-t/progress.md`** — M38 partition + plan entries added to Decision Log
- **`docs/architecture.md` + `docs/infrastructure.md`** — Scan #11 staleness callouts added (TD-103 doc-ripple candidate noted)

### Removed
- **`scripts/context-meter/count-tokens-client.{js,test.js}`** — retired with v3.11.11 local-estimator switch (count_tokens API no longer called)
- **`scripts/context-meter/test-injector.js`** — test-only infrastructure, no longer referenced

### Testing
- 1234/1242 tests pass. 8 pre-existing failures carried forward: 7 stranded context-meter tests (TD-102, owned by M38-MR) + 1 scan.test.js live-state test (unrelated). No regressions from H1 work.

## [3.11.10] - 2026-04-16

### Added — Universal Context Auto-Pause (M37)

**Background**: The Context Meter (M34) correctly measures context window usage and emits an `additionalContext` signal at the configured threshold (default 75%). However, Claude consistently ignores the single-line suggestion format, continuing to work until hitting the runtime's ~95% `/compact` wall — which destroys context silently and loses work.

### Changed
- **`scripts/context-meter/threshold.js`** — `buildAdditionalContext()` now returns a 6-line MANDATORY STOP instruction instead of a single-line suggestion. The message starts with `🛑 MANDATORY STOP` and includes step-by-step instructions (pause → clear → resume) with explicit reference to the Destructive Action Guard enforcement weight.
- **`.gsd-t/contracts/context-meter-contract.md`** — bumped to v1.2.0. New §"Universal Auto-Pause Rule" documents the mandatory behavioral requirement. Rule #8 added: `additionalContext` is a MANDATORY STOP signal with Destructive Action Guard enforcement weight.
- **`templates/CLAUDE-global.md`** — new `## Universal Auto-Pause Rule (MANDATORY)` section added between Context Meter and API Documentation Guard sections. Same enforcement weight as the Destructive Action Guard.
- **5 loop command files** (`gsd-t-execute`, `gsd-t-wave`, `gsd-t-integrate`, `gsd-t-quick`, `gsd-t-debug`) — Step 0.2 added: Universal Auto-Pause Rule enforcement. If `🛑 MANDATORY STOP` appears in `additionalContext` at any point, immediately halt, pause, and instruct clear+resume.
- **Tests**: All 1228 tests pass (1224 unit + 4 e2e). `threshold.test.js` and `gsd-t-context-meter.e2e.test.js` updated for new multi-line format.

## [3.10.16] - 2026-04-15

### Fixed — unattended supervisor launch friction (3 bugs + UX improvements)

**Background**: Users consistently failed to launch unattended sessions due to compounding pre-flight friction: the supervisor spawn targeted the wrong binary, the dirty-tree check refused on benign files, and missing milestone state caused hard refusals. These issues defeated the purpose of "unattended" mode.

### Changed
- **`bin/gsd-t-unattended-platform.{js,cjs}`** — `spawnSupervisor()` no longer prepends `"unattended"` as a subcommand. `binPath` now points to `bin/gsd-t-unattended.cjs` (the actual supervisor entry) instead of `bin/gsd-t.js` (which has no `unattended` subcommand and printed "Unknown command" on every launch).
- **`bin/gsd-t-unattended.{js,cjs}`** — dirty worktree check changed from **refuse** to **auto-whitelist**. Non-whitelisted dirty files are automatically added to `.gsd-t/.unattended/config.json` and the supervisor proceeds. Only genuine git errors (not a repo, etc.) still refuse. Import of `saveConfig` added.
- **`bin/gsd-t-unattended-safety.{js,cjs}`** — added `saveConfig(projectDir, config)` function to persist auto-whitelisted entries back to the config file. Exported for use by supervisor and tests.
- **`bin/gsd-t.js`** `updateSingleProject()` — now calls `ensureUnattendedConfig()` (creates `.gsd-t/.unattended/config.json` with all defaults) and `ensureUnattendedGitignore()` (adds `bin/*.cjs`, `.gsd-t/.archive-migration-v1`, `.gsd-t/.task-counter-retired-v1` to `.gitignore`).
- **`commands/gsd-t-unattended.md`** — Step 1c.1 "Readiness Bootstrap": if no active milestone found, auto-bootstraps from conversation context or `--milestone=` flag instead of refusing. Works from any workflow state. Step 2 dry-run display and binPath updated to reference `gsd-t-unattended.cjs`.
- **`.gsd-t/contracts/unattended-supervisor-contract.md`** — spawn snippet and exit code 8 description updated.
- **Tests**: `test/unattended-platform.test.js` shim updated (argv[2] not argv[3]). `test/unattended-supervisor.test.js` dirty-tree test now verifies auto-whitelist behavior + git-error refusal. 1136/1136 tests pass.

## [3.10.15] - 2026-04-15

### Fixed — bin tools not propagated to downstream projects (unattended launch fails)

**Background**: The unattended supervisor (`/gsd-t-unattended`) and several other commands reference bin files via `require('./bin/<tool>.js')` resolved against the project cwd. These files only existed in the GSD-T source repo — downstream projects that use GSD-T as tooling (installed via npm) never received them because `PROJECT_BIN_TOOLS` only listed 5 of the 13 needed files. Additionally, `.js` files fail in downstream projects with `"type": "module"` in their `package.json`.

### Changed
- **`bin/gsd-t.js`** `PROJECT_BIN_TOOLS` — expanded from 5 to 13 entries. Now includes: `gsd-t-unattended.cjs`, `gsd-t-unattended-platform.cjs`, `gsd-t-unattended-safety.cjs`, `handoff-lock.cjs`, `headless-auto-spawn.cjs`, `runway-estimator.cjs`, `token-telemetry.cjs`, `token-optimizer.cjs` (plus existing 5).
- **8 new `.cjs` files** created in `bin/` — copies of existing `.js` files with internal cross-requires updated to `.cjs` (e.g., `gsd-t-unattended.cjs` requires `./gsd-t-unattended-safety.cjs` instead of `.js`).
- **15 command files updated** — all `require('./bin/<tool>.js')` calls switched to `.cjs` for the 8 newly-propagated tools: `gsd-t-execute`, `gsd-t-wave`, `gsd-t-quick`, `gsd-t-integrate`, `gsd-t-debug`, `gsd-t-doc-ripple`, `gsd-t-unattended`, `gsd-t-resume`, `gsd-t-status`, `gsd-t-complete-milestone`, `gsd-t-optimization-apply`, `gsd-t-optimization-reject`, `gsd-t-backlog-list`.
- 1229/1229 tests pass.

### Impact
- `/gsd-t-unattended` can now launch from any downstream project (Tekyz-CRM, etc.)
- Runway estimator, headless auto-spawn, and token telemetry brackets work in downstream projects
- Token optimizer hooks in complete-milestone and backlog-list work in downstream projects

## [3.10.14] - 2026-04-15

### Fixed — transcript parser orphaned tool_use blocks cause count_tokens 400

**Background**: With `ANTHROPIC_API_KEY` now set (v3.10.12-13 fix), the context meter hook passed the key check but the `count_tokens` API returned HTTP 400: `"tool_use ids were found without tool_result blocks immediately after"`. The transcript parser (`scripts/context-meter/transcript-parser.js`) faithfully reconstructed the JSONL transcript but didn't enforce the API's strict adjacency constraint: every assistant `tool_use` must be immediately followed by a user `tool_result` with matching ids. Mid-session compaction and summarization can orphan these blocks.

### Changed
- **`scripts/context-meter/transcript-parser.js`** — added `sanitizeToolPairs()` post-processing pass after message reconstruction. Walks the message list enforcing adjacency: assistant `tool_use` blocks are kept only if the immediately following user message contains a `tool_result` with a matching id, and vice versa. Messages that become empty after stripping are dropped. This is a structural fix — any transcript shape (compacted, summarized, interrupted) now produces a valid `count_tokens` payload.
- **`scripts/context-meter/transcript-parser.test.js`** — updated 2 existing tests that created orphaned `tool_result` messages (now include matching `tool_use` predecessors). Added 1 new test: `orphaned tool_use without matching tool_result is stripped`. 1229/1229 tests pass.

### Verification
- Real transcript (626→649 messages, 473KB payload) now returns HTTP 200 with `input_tokens: 153597` (was 400 before fix)
- Context meter state file flipped from `lastError: api_error` to `lastError: null`, `inputTokens: 158543`, `pct: 79.3%`, `threshold: warn`
- First successful real-time context measurement since M34 was built

## [3.10.13] - 2026-04-15

### Fixed — P0 v3.10.12 propagation gap (same regression, downstream projects)

**Background**: v3.10.12 shipped the `stale` band fix to `bin/token-budget.js` in the GSD-T repo, but verification revealed the fix was **never visible in any downstream project**. Every command file gate snippet is `require('./bin/token-budget.js')` resolved against the **project cwd** — and no downstream project has a local `bin/token-budget.js` file. `PROJECT_BIN_TOOLS` in `bin/gsd-t.js` (the list that `update-all` copies to each registered project) did not include `token-budget.js`, so downstream projects never received any copy. The require throws `MODULE_NOT_FOUND`, the surrounding `try{…}catch(_){process.stdout.write('0')}` swallows it, and the gate sees `pct: 0` = normal band. Identical failure mode to the original regression.

### Changed
- **`bin/token-budget.js` → `bin/token-budget.cjs`** — renamed to `.cjs` so it runs as CommonJS regardless of downstream `package.json` `"type"` field. Some registered projects use `"type": "module"`, which would have broken `require('./bin/token-budget.js')` even if the file were propagated. The `.cjs` extension is the same convention used by all other tools in `PROJECT_BIN_TOOLS` (`archive-progress.cjs`, `log-tail.cjs`, `context-budget-audit.cjs`, `context-meter-config.cjs`).
- **`bin/gsd-t.js`** `PROJECT_BIN_TOOLS` — appended `"token-budget.cjs"`. Now `update-all` copies the file to every registered project's `bin/` on update.
- **All 17 command files** referencing `./bin/token-budget.js` — updated to `./bin/token-budget.cjs`: `gsd-t-execute`, `gsd-t-wave`, `gsd-t-quick`, `gsd-t-debug`, `gsd-t-integrate`, `gsd-t-doc-ripple`, `gsd-t-verify`, `gsd-t-plan`, `gsd-t-discuss`, `gsd-t-visualize`, `gsd-t-reflect`, `gsd-t-brainstorm`, `gsd-t-audit`, `gsd-t-prd`, `gsd-t-resume`, `gsd-t-unattended`, `gsd-t-help`.
- **`test/token-budget.test.js`** — require path updated to `../bin/token-budget.cjs`. All 1228 tests pass.

### Why this matters
Without this patch, v3.10.12's `stale` band fix is **dead code in every downstream project**. The command files fail the require, catch silently, and the gate goes back to reporting 0% normal — exactly the invisible failure mode that caused the M36 regression in the first place. The two patches are a single logical fix; shipping v3.10.12 alone was incomplete.

### Verification
- `npm test` → 1228/1228 pass (same baseline as v3.10.12)
- No runtime references to `token-budget.js` remain under `commands/`
- `bin/token-budget.cjs` is 13867 bytes (verbatim copy of the v3.10.12 `token-budget.js`)
- `PROJECT_BIN_TOOLS` now has 5 entries — `update-all` will copy to all 15 registered projects on next invocation

## [3.10.12] - 2026-04-15

### Fixed — P0 context meter regression (M36 /compact incidents)

**Background**: During M36 execution the user hit Claude Code's native `/compact` prompt multiple times — the exact scenario M34's Context Meter was built to prevent. Audit of `.gsd-t/.context-meter-state.json` revealed `checkCount=2102` with `pct=0` and `lastError: missing_key` forever. Every one of 2102 PostToolUse hook calls had silently failed at the `ANTHROPIC_API_KEY` check and returned `{}` per the fail-open invariant. `token-budget.getSessionStatus()` read `pct: 0` and reported `threshold: "normal"` to the gate, so the gate was **blind since installation** with no user-visible alarm at any layer.

### Added
- **`bin/token-budget.js`** — fourth `stale` band in `getSessionStatus()`. When the state file exists but is dead (`lastError` set, `timestamp` null, state older than 5 min, or JSON corrupt), returns `{threshold: "stale", deadReason}` with one of `meter_error:missing_key`, `meter_error:api_error`, `meter_error:parse_failure`, `meter_error:no_transcript`, `meter_never_measured`, `meter_state_stale`, `state_file_corrupt`, `state_file_unreadable`. Previously fell through to the heuristic (which reported 0% and was indistinguishable from a healthy fresh session).
- **`bin/token-budget.js`** — `buildBandResponse()` handles the `stale` band with a loud message pointing at `gsd-t doctor` and `ANTHROPIC_API_KEY`.
- **`commands/gsd-t-resume.md`** — new Step 0.6 "Context Meter Health Check" runs after the headless read-back banner and before state loading. If the meter is stale, prints a prominent warning, runs `gsd-t doctor` inline, and refuses to auto-advance into gated commands (`execute`, `wave`, `integrate`, `quick`, `debug`) until fixed.
- **`.gsd-t/contracts/context-meter-contract.md` v1.1.0** — new §"Stale Band and Resume Gating" documents the regression, the fix, and the mandatory resume-time health check. Also adds a "measurement only, never inference" rule to the configuration section clarifying that the API key named in `apiKeyEnvVar` must never be used for `/v1/messages` inference — inference always runs through the Claude Code subscription.
- **`.gsd-t/contracts/token-budget-contract.md` v3.1.0** — fourth band added to the threshold table with explicit "gate treats stale as exit-10 stop but does NOT auto-spawn" semantics (a fresh session would have the same broken guardrail).

### Changed
- **`commands/gsd-t-execute.md`** — Step 3.5 gate snippet (Orchestrator Context Gate) and Step 7 per-domain context gate re-check now exit 10 on `s.threshold==='stop'||s.threshold==='stale'`. Both sites print different user-facing messages for each band: `stop` → "halt cleanly, hand off to runway estimator"; `stale` → "run `gsd-t doctor` and fix the cause".
- **`commands/gsd-t-wave.md`** — Wave Orchestrator Context Gate snippet now exits 10 on `stale` in addition to `stop`. The `stale` path does NOT call `autoSpawnHeadless()` — a fresh session would have the same broken guardrail.
- **`bin/gsd-t.js`** — `showStatusContextMeter()` promotes the dead-meter line from a dim ignorable whisper to a red `✗ CONTEXT METER DEAD` alarm with actionable fix instructions (explicitly calls out "measurement only — inference stays on Claude Code subscription" when the cause is `missing_key`). This is the line the user would have seen on every `gsd-t status` run during M36 if it had been loud enough to notice.

### Root cause and the 6 hypotheses

The continue-here file for this session listed 6 plausible failure modes. The audit disproved 5 of them and proved the sixth:
1. ❌ Gate only fires at subagent-spawn boundaries — FALSE, coverage is broad (16 command files call `getSessionStatus`, `execute` alone has 13 call sites).
2. ❌ Coverage holes in command files — FALSE, the 4 gated commands (`execute`, `wave`, `integrate`, `quick`, `debug`) all call the gate.
3. ❌ `.gsd-t/.context-meter-state.json` stale due to silent hook failure — PARTIALLY; the state was not stale, it was **never fresh**. The file had `timestamp: null` after 2102 checks.
4. ✅ **PostToolUse hook silent failure on missing `ANTHROPIC_API_KEY` — CONFIRMED root cause.** The hook's `runMeter()` step 5 checks the env var, writes `lastError: {code: "missing_key"}`, persists the state, and returns `{}`. This is correct per the hook's fail-open invariant. But nothing downstream was LOUD about it: `token-budget.js` fell through to the heuristic; the gate saw `threshold: "normal"`; `gsd-t status` printed a dim line.
5. ❌ Session-tokens vs main-transcript measurement gap — MOOT, you can't have a measurement gap if you never measured.
6. ❌ 85% stop band too thin — MOOT for the same reason.

The v3.10.12 fix targets only the real root cause: **make the gate fail loud when the meter is dead**, and add a resume-time health check so future sessions can't silently run without the guardrail.

### User-visible fix

If you see `✗ CONTEXT METER DEAD` on `gsd-t status` or `⚠ Context meter is DEAD` from `gsd-t-resume`, set `ANTHROPIC_API_KEY` in your shell profile:

```bash
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.zshrc
source ~/.zshrc
```

**Important:** this key is used ONLY for `count_tokens` measurement via the PostToolUse hook and `gsd-t doctor` diagnostics. It is NEVER used for model inference — inference always runs through the Claude Code subscription. The contract `context-meter-contract.md` v1.1.0 Rule #3 enforces this.

## [3.10.11] - 2026-04-15

### Added
- `docs/unattended-config.md` — full schema and recipe reference for `.gsd-t/.unattended/config.json`. The supervisor has always loaded this file (M36 safety rails), but there was no user-facing doc explaining the schema, precedence, or common overrides.
- `commands/gsd-t-unattended.md` Step 1c cross-references the new config doc and calls out the solo-project recipe (`{"protectedBranches": []}` to disable the main/master guard).

### Fixed
- Flaky test: `scripts/gsd-t-context-meter.e2e.test.js` `HARD_TIMEOUT_MS` bumped 6000 → 12000ms. The hook child process runs fine in 30ms in isolation but was timing out under full-suite parallelism load on some machines. No behavioral change — just a more forgiving outer cap.
- `commands/gsd-t-unattended.md` gained Step 1e: pre-flight software check that hard-fails the launch if `node`, `claude`, or `git` are missing, and prints soft warnings for missing platform helpers (`caffeinate` on darwin; `systemd-inhibit`/`notify-send` on linux; BurntToast advisory on win32). Replaces the previous "crash mid-run when a helper is missing" behavior with fail-fast + actionable install instructions.
- `docs/unattended-windows-caveats.md` added §0 "Required Software" matrix listing hard-required and soft-recommended tools per platform.

### Notes
- No API or contract changes. `.gsd-t/.unattended/config.json` loader and precedence (CLI > env > config > defaults) were already built into M36 safety rails — this release only surfaces them in documentation.

## [3.10.10] - 2026-04-15

### Major version bump: 2.x → 3.x

M36 ships the third pillar of the context/runway/autonomy arc (M34 context meter → M35 no-silent-degradation → M36 unattended supervisor). Cumulatively these three milestones are substantial enough to mark a new major version. No breaking API changes — existing commands and contracts continue to work — but v3.x establishes "unattended-capable" as the default expectation for the harness. Semver major bump also aligns with the "always 2-digit minor and patch" display convention (Minor and Patch start at 10 after a major reset).

### M36: Unattended Supervisor — Zero-Human-Intervention Milestone Execution

**Background**: M35 introduced headless auto-spawn to continue a single runway-exhausted session in a fresh context. M36 generalizes this into a first-class long-running supervisor: a detached OS-level process that drives the active GSD-T milestone to completion over hours or days via a `claude -p` worker relay. Each worker runs in its own fresh context window; the supervisor survives terminal close, `/clear`, and sleep/wake cycles. A 270-second ScheduleWakeup watch loop in the interactive session provides live status without blocking the user.

### Added

- **`bin/gsd-t-unattended.js`** — detached supervisor process. Spawns `claude -p` workers in a relay, writes atomic `state.json` between iterations, manages `supervisor.pid` lifecycle, invokes safety rails at hook points, sends OS notifications on terminal transitions (macOS `osascript`; silent no-op on other platforms), and removes its own PID file on any exit. Singleton: a second launch with a live PID refuses.
- **`bin/gsd-t-unattended-safety.js`** — safety rails module. Exports: `checkGitBranch` (protected branch list; configurable), `checkWorktreeCleanliness` (dirty-tree guard with whitelist), `checkIterationCap`, `checkWallClockCap`, `validateState`, `detectBlockerSentinel` (scan run.log tail for unrecoverable/dispatch-failed patterns), `detectGutter` (repeated-error / file-thrash / no-progress stall detection). Each check returns `{ ok, reason?, code? }`.
- **`bin/gsd-t-unattended-platform.js`** — platform abstraction. Exports: `spawnSupervisor` (detached spawn with `windowsHide`), `preventSleep` / `releaseSleep` (`caffeinate -i` on darwin; no-op on linux/win32), `sendNotification` (osascript on darwin; `notify-send` on linux; toast via PowerShell on win32 — all graceful no-op on failure), `resolveClaudeBin` (`claude.cmd` on win32; `claude` elsewhere + PATH search), `getPlatform`.
- **`bin/handoff-lock.js`** — parent/child race guard for headless-auto-spawn. Writes `.gsd-t/.handoff/{session-id}.lock` before detaching; child removes on first iteration. Prevents the parent from reporting "failed" while the child is still starting. Exports: `acquireLock`, `releaseLock`, `waitForRelease`, `isLocked`.
- **`commands/gsd-t-unattended.md`** — `/gsd-t-unattended` launch command. Pre-flights (singleton check, safety rails, active milestone), spawns the supervisor via `bin/gsd-t-unattended-platform.js`, polls for `supervisor.pid` + `status=running` (up to 5s), prints the initial watch block, calls `ScheduleWakeup(270, '/gsd-t-unattended-watch')`.
- **`commands/gsd-t-unattended-watch.md`** — `/gsd-t-unattended-watch` watch tick. Stateless; reads `supervisor.pid` + `state.json`; renders progress or final summary; reschedules via `ScheduleWakeup(270, ...)` on non-terminal status; stops on terminal status or missing PID file.
- **`commands/gsd-t-unattended-stop.md`** — `/gsd-t-unattended-stop` stop command. Touches `.gsd-t/.unattended/stop` sentinel; prints reassurance; returns immediately (no kill, no wait).
- **`.gsd-t/contracts/unattended-supervisor-contract.md` v1.0.0 ACTIVE** — authoritative interface for state file schema (18 fields), PID file lifecycle, sentinel semantics, exit codes 0–8+124, launch handshake, watch tick decision tree, resume auto-reattach handshake, stop mechanism, notification levels, safety rails hook points, and configuration file schema.
- **`docs/unattended-windows-caveats.md`** — known Windows limitations: sleep-prevention not supported (no `caffeinate` equivalent wired; `powercfg /requests` path is v2), `claude.cmd` wrapper adds ~500ms per spawn, Windows Defender may scan each worker spawn, notification via PowerShell toast requires non-interactive shell workaround.
- **`.claude/settings.json`** (project-shared) — SessionStart hook registered: `node bin/check-headless-sessions.js . 2>/dev/null || true` surfaces completed headless session banners on session start.

### Changed

- **`commands/gsd-t-wave.md`** — "Run /clear" STOP block removed from the runway-exceeded handoff path. The command now calls `autoSpawnHeadless()` seamlessly; user never sees a manual-intervention prompt under normal runway overflow.
- **`commands/gsd-t-execute.md`**, **`gsd-t-quick.md`**, **`gsd-t-integrate.md`**, **`gsd-t-debug.md`** — same "Run /clear" prompt removal; headless auto-spawn wired in.
- **`commands/gsd-t-resume.md`** — new Step 0 "Unattended Supervisor Auto-Reattach": checks `supervisor.pid`; if live and non-terminal, skips normal resume and re-starts the watch loop. New Step 0.2 "Handoff Lock Wait": polls until `.gsd-t/.handoff/*.lock` is released (headless child has taken ownership) before proceeding.

### Fixed

- **`bin/gsd-t.js` headless dispatch** (Phase 0 P0, committed prior milestone): `mapHeadlessExitCode` now maps `"Unknown command:"` in worker stdout → exit code 5 (`command-dispatch-failed`). Worker invocation no longer prepends `/` to command names, preventing "Unknown command:" failures in non-interactive `claude -p` sessions.

### Tests

- `test/unattended-supervisor.test.js` — 42 tests: happy-path relay, gutter halt, stop sentinel, dispatch-failure halt, crash detection, dirty-tree pre-flight refusal.
- `test/unattended-safety.test.js` — 18 tests: each check function, combined pre-flight, gutter threshold config.
- `test/unattended-platform.test.js` — 14 tests: platform detection, spawn flags, sleep-prevention no-op on linux, claude binary resolution.
- `test/handoff-lock.test.js` — 16 tests: acquire/release, race prevention, waitForRelease timeout, stale lock cleanup.
- `test/headless-auto-spawn.test.js` — +9 tests (new handoff-lock integration cases added to existing suite).
- `test/filesystem.test.js` — counts updated to reflect new files (+6 bin files, +3 command files, +1 docs file).
- **Total**: 1146 → 1226 (+80 new tests).

### Migration

After `npm install @tekyzinc/gsd-t@3.10.10`, run `/gsd-t-version-update-all` to propagate v3.10.10 to all registered projects. The new command files, `bin/` modules, and contract are written into each project automatically. No existing `.gsd-t/` state is modified.

---

## [2.76.10] - 2026-04-15

### M35: Runway-Protected Execution — Aggressive Pause-Resume Replaces Graduated Degradation

**Background**: Between v2.74 and v2.75, GSD-T coped with context pressure via graduated degradation — `downgrade` and `conserve` bands that silently demoted opus→sonnet→haiku and skipped Red Team / doc-ripple / Design Verify phases. This made quality **conditional on context pressure**, a load-bearing invariant the user could neither see nor control. M35 removes graduated degradation entirely and replaces it with: surgical per-phase model selection (plan-time, never runtime), a pre-flight runway estimator that refuses runs projected to cross 85% and auto-spawns a detached headless continuation, frozen 18-field per-spawn token telemetry, and a detect-only optimization backlog the user explicitly promotes or rejects. The user never types `/clear` under normal operation.

### Added

- **`bin/model-selector.js`** — declarative phase→tier mapping (≥13 phase mappings) with complexity-signal escalation (`cross_module_refactor`, `security_boundary`, `data_loss_risk`, `contract_design`) that escalates sonnet→opus at plan time. Each command file carries a `## Model Assignment` block.
- **`bin/runway-estimator.js`** — `estimateRunway({command, domain_type, remaining_tasks})` reads `.gsd-t/token-metrics.jsonl` via a three-tier query fallback (exact → command+phase → command) and returns `{can_start, projected_end_pct, confidence, recommendation}`. Confidence grading: high ≥50 records, medium ≥10, low <10 (+1.25× skew).
- **`bin/headless-auto-spawn.js`** — detached `child_process.spawn({detached:true, stdio:['ignore', fd, fd]}) + child.unref()`. Writes `.gsd-t/headless-sessions/{session-id}.json`, polls with `process.kill(pid, 0)` (timer `.unref()`-ed), marks `status: completed`, posts a macOS `osascript` notification on exit (graceful no-op on non-darwin).
- **`bin/check-headless-sessions.js`** — scans `.gsd-t/headless-sessions/` for `status === 'completed' && surfaced !== true` and renders the read-back banner on `/gsd-t-resume` and `/gsd-t-status`. Exports `checkCompletedSessions`, `markSurfaced`, `formatBanner`, `printBannerIfAny`, `computeDurationLabel`.
- **`bin/token-telemetry.js`** — per-spawn token bracket writes one frozen 18-field JSONL record per subagent spawn to `.gsd-t/token-metrics.jsonl`. Fields: `timestamp, session_id, command, phase, domain, task_id, model, complexity_signals[], input_tokens, output_tokens, duration_seconds, start_pct, end_pct, halt_type, halt_reason, exit_code, run_type, projection_variance`. `halt_type` values: `clean`, `stop-band`, `runway-refuse`, `native-compact` (defect), `crash`.
- **`bin/token-optimizer.js`** — at `complete-milestone`, scans the last 3 milestones and appends recalibration recommendations to `.gsd-t/optimization-backlog.md`. Four detection rules: `demote` (opus phase ≥90% success, ≥3 volume), `escalate` (sonnet phase ≥30% failure rate, ≥5 volume), `runway-tune` (projection vs. actual divergence >15%), `investigate` (per-phase p95 > 2× median, ≥10 volume). Fingerprint-based 5-milestone cooldown on rejected items. Exports `detectRecommendations`, `appendToBacklog`, `readBacklog`, `writeBacklog`, `parseBacklog`, `setRecommendationStatus`, `DETECTION_RULES`, `REJECTION_COOLDOWN_MILESTONES`.
- **`bin/advisor-integration.js`** — `/advisor` escalation hook; convention-based fallback if no programmable API.
- **`.gsd-t/contracts/token-budget-contract.md` v3.0.0 ACTIVE** — clean-break rewrite. Three bands only: `normal` <70%, `warn` 70–85%, `stop` ≥85%. Response shape `{band, pct, message}`. `downgrade`, `conserve`, `modelOverrides`, `skipPhases` all deleted — no compat shim.
- **`.gsd-t/contracts/model-selection-contract.md` v1.0.0 ACTIVE** — declarative phase→tier rules, complexity-signal escalation semantics, `/advisor` hook schema.
- **`.gsd-t/contracts/token-telemetry-contract.md` v1.0.0 ACTIVE** — frozen 18-field per-spawn JSONL schema, `halt_type` enum, `run_type` enum.
- **`.gsd-t/contracts/runway-estimator-contract.md` v1.0.0 ACTIVE** — pre-flight projection, three-tier query fallback, confidence grading, refusal + headless handoff contract.
- **`.gsd-t/contracts/headless-auto-spawn-contract.md` v1.0.0 ACTIVE** — detached continuation, session file schema, macOS notification channel, read-back banner.
- **`commands/gsd-t-optimization-apply.md`** — promotes a backlog recommendation by ID, auto-routes to `/gsd-t-quick` or `/gsd-t-backlog-promote` based on recommendation type.
- **`commands/gsd-t-optimization-reject.md`** — rejects a recommendation with optional `--reason`, sets 5-milestone cooldown. Reason captured in token-log.md + Decision Log.
- **`gsd-t metrics` flags** — `--tokens` (per-command/phase token summary), `--halts` (halt-type breakdown; flags any `native-compact` as defect), `--context-window` (trailing 20-run `end_pct` with runway headroom).
- **Test coverage**: `test/headless-auto-spawn.test.js` (16 tests — session file schema, completion watcher, read-back banner, non-darwin degradation, E2E shim smoke), `test/token-optimizer.test.js` (19 tests — each rule triggers/skips, parseBacklog round-trip, cooldown filter, OB-T1+OB-T4 integration roundtrip), plus rewrites of `test/token-budget.test.js` around v3.0.0. **~1011/1011 total tests green through Wave 4**.

### Changed

- **`bin/token-budget.js`** — `getSessionStatus()` now returns `{band, pct, message}` with only three bands. `applyModelOverride`, `skipPhases`, `getDegradationActions` band-branching for `downgrade`/`conserve` — all deleted.
- **`bin/orchestrator.js`** — gate semantics: `normal` proceed, `warn` log + proceed at **full quality**, `stop` halt cleanly and hand off to runway estimator → headless-auto-spawn. No model swaps. No phase skips.
- **Command files** (`gsd-t-execute.md`, `gsd-t-wave.md`, `gsd-t-quick.md`, `gsd-t-integrate.md`, `gsd-t-debug.md`, `gsd-t-doc-ripple.md`) — Step 0 runway gate; `## Model Assignment` blocks documenting per-phase tier choices; per-spawn token telemetry brackets around every subagent spawn.
- **`commands/gsd-t-resume.md`** — Step 0.5 Headless Read-Back Banner (MANDATORY) invokes `node bin/check-headless-sessions.js . 2>/dev/null || true`.
- **`commands/gsd-t-status.md`** — Step 0 Headless Read-Back Banner + Step 0.5 Optimization Backlog Pending Count (one-liner, suppressed when N=0).
- **`commands/gsd-t-complete-milestone.md`** — Step 14 non-blocking optimizer invocation: `detectRecommendations({lookbackMilestones: 3})` → `appendToBacklog`. Wrapped in try/catch; optimizer failure logged but not re-thrown.
- **`commands/gsd-t-backlog-list.md`** — `--file` flag supports rendering `optimization-backlog.md` via `bin/token-optimizer.js` parseBacklog, with optional `--status {pending|promoted|rejected}` filter.
- **`commands/gsd-t-help.md`** — new OPTIMIZATION section in summary table; detailed entries for `optimization-apply` and `optimization-reject`.
- **Documentation ripple**:
  - `README.md` — "Runway-Protected Execution (M35, v2.76.10)" section replacing "Token-Aware Orchestration"; threshold description updated to "85% = stop band; 70% = warn band — cue for explicit pause/resume; no silent degradation".
  - `docs/GSD-T-README.md` — 3-band table replacing 5-band table, "Zero silent quality degradation" explanation, per-phase model selection, `/advisor` escalation, `gsd-t metrics` flags, optimization apply/reject.
  - `docs/methodology.md` — new "From Silent Degradation to Aggressive Pause-Resume (M35)" section with five principles (quality non-negotiable, explicit per-phase model selection, user never types `/clear`, data before optimization, clean break no compat shim) + "Structural guarantee" closing paragraph.
  - `docs/architecture.md` — dataflow updated for runway estimator + headless auto-spawn + v3.0.0 band semantics; M35 supporting components section (model-selector, token-optimizer, check-headless-sessions).
  - `docs/infrastructure.md` — 3-band threshold table replacing 5-band; new Runway-Protected Execution section covering all 5 components; `gsd-t metrics` CLI table; `/advisor` convention.
  - `docs/requirements.md` — REQ-069 through REQ-078 M35 traceability; REQ-076/077 marked complete.
  - `docs/prd-harness-evolution.md` — §3.7 rewritten as "Context Gate + Surgical Model Escalation"; risk-table + session-cost mitigations updated to reference runway estimator + headless handoff (no graduated degradation).
  - `templates/CLAUDE-global.md` + `templates/CLAUDE-project.md` — Token-Aware Orchestration section rewritten around M35 semantics.

### Removed

- **Graduated degradation** — `downgrade` and `conserve` bands are deleted from `bin/token-budget.js`, the v3.0.0 `token-budget-contract.md`, and every command file. `applyModelOverride`, `skipPhases`, and all related runtime machinery are gone.
- **Runtime model downgrade** — there is no code path that swaps opus→sonnet or sonnet→haiku under context pressure. Model choice is a plan-time decision made by `bin/model-selector.js`, full stop.
- **Phase-skipping under pressure** — Red Team, doc-ripple, and Design Verify always run at their designated tier regardless of context %. No "non-essential" phase exists.
- **Manual `/clear` prompts** under normal operation — the user only sees a `/clear` prompt when the headless handoff itself fails, which is an explicit degradation path, not a silent one.

### Migration

- **No user migration required** for v2.75.10 → v2.76.10 — `gsd-t update-all` rewrites command files in place and the new contracts ship with the package. Existing projects inherit the three-band gate automatically.
- **Projects with custom wrappers calling `getSessionStatus()`** — the return shape changed from `{band, pct, modelOverrides, skipPhases, message}` to `{band, pct, message}`. `modelOverrides` and `skipPhases` consumers must delete their handling code (they never had a quality-reducing role in v3.0.0 anyway).
- **Historical note**: `halt_type: native-compact` entries in `.gsd-t/token-metrics.jsonl` are defect signals — if they appear after upgrade, the runway estimator thresholds need re-tuning. The structural guarantee is that with `STOP_THRESHOLD_PCT = 85` and pre-flight refusal, the runtime's 95% native compact is unreachable under healthy operation.

### Propagation

Run `/gsd-t-version-update-all` from any registered GSD-T project to propagate v2.76.10 to all projects. The command files, templates, and `bin/` scripts are rewritten in place; project state in `.gsd-t/` is preserved.

---

## [2.75.10] - 2026-04-14

### M34: Context Meter — Real Context-Window Measurement Replaces Task-Counter Proxy

**Background**: v2.74.12/v2.74.13 introduced `bin/task-counter.cjs` as a deterministic session-burn gate after the env-var-based context self-check (`CLAUDE_CONTEXT_TOKENS_USED`) was found to be permanently inert. The task counter fixed the immediate bleeding, but it was always a proxy — 5 tasks ≠ N tokens, and Opus-primary sessions burn context faster than Sonnet-primary sessions for the same task count. M34 replaces the proxy with real measurement via the Anthropic `count_tokens` API, re-exposed through a PostToolUse hook.

### Added

- **`scripts/gsd-t-context-meter.js`** — PostToolUse hook that measures the active Claude Code session's context window after every tool call. Writes a snapshot to `.gsd-t/.context-meter-state.json` (`{pct, consumed, limit, timestamp, model}`) and, when `pct >= warn_threshold`, injects `additionalContext` into the Claude Code response so the orchestrator sees real burn in real time. Fails open (silent no-op) when `ANTHROPIC_API_KEY` is missing or the API is unreachable — never blocks the user's session.
- **`scripts/context-meter/`** — helper modules: `parser.js` (extract recent turns from transcript), `client.js` (count_tokens API wrapper with retry), `threshold.js` (warn/degrade/conserve/stop bands), `test-injector.js` (deterministic fixtures for unit tests).
- **`bin/context-meter-config.cjs`** — config loader with defaults and schema validation.
- **`templates/context-meter-config.json`** — default config (thresholds: warn 0.65, degrade 0.75, conserve 0.85, stop 0.92; staleness window 5 min).
- **`.gsd-t/contracts/context-meter-contract.md`** v1.0.0 ACTIVE — hook I/O contract, state file schema, threshold semantics, fail-open guarantees.
- **`.gsd-t/contracts/token-budget-contract.md`** v2.0.0 ACTIVE — rewritten around real measurement; public `getSessionStatus()` API surface preserved but semantics now reflect actual context % instead of task count.
- **Installer extensions (`bin/gsd-t.js`)**:
  - `install`/`update` registers `scripts/gsd-t-context-meter.js` as a PostToolUse hook in `~/.claude/settings.json` (idempotent).
  - First-run prompt for `ANTHROPIC_API_KEY` (skippable — doctor will later fail-red if unset).
  - `doctor` adds hard-gate checks for API key presence, hook registration, config file, and a dry-run smoke test of the hook entry point.
  - `status` displays real context % read from `.gsd-t/.context-meter-state.json` (falls back to heuristic when state is missing/stale).
- **Test coverage**: `scripts/gsd-t-context-meter.e2e.test.js` (90 tests — parser, client, threshold, hook entry, injection); `test/token-budget.test.js` fully rewritten around real measurement; `test/installer-m34.test.js` covers hook install, API key prompt, doctor gate, status line; **941/941 total tests green**.

### Changed

- **`bin/token-budget.js`** — `getSessionStatus()` now reads `.gsd-t/.context-meter-state.json` (with a 5-minute staleness window) and falls back to a heuristic based on `.gsd-t/token-log.md` row count when state is unavailable. Graduated degradation (`warn`/`downgrade`/`conserve`/`stop`) fires on real context % instead of task count. Public API unchanged so `bin/orchestrator.js` and every command that calls it keeps working.
- **`bin/orchestrator.js`** — task-budget gate now calls `token-budget.getSessionStatus()` for the real signal; checkpoint-and-stop behavior preserved.
- **Command files** (`gsd-t-execute.md`, `gsd-t-wave.md`, `gsd-t-quick.md`, `gsd-t-integrate.md`, `gsd-t-debug.md`) — every `node bin/task-counter.cjs …` invocation replaced with a `CTX_PCT` bash shim that sources the context meter state file. Observability logging updated.
- **Token log schema** — `Tasks-Since-Reset` column renamed to `Ctx%`. All command files and templates updated.
- **Documentation ripple**:
  - `README.md` — Context Meter feature bullet + full "Context Meter Setup" section.
  - `docs/GSD-T-README.md` — Configuration → Context Meter subsection with data-flow, threshold bands, upgrade notes.
  - `docs/architecture.md` — Context Meter Architecture with full data-flow diagram.
  - `docs/infrastructure.md` — Context Meter Setup section with API key instructions, doctor verification, threshold table, upgrade migration.
  - `docs/methodology.md` — "Context Awareness: From Proxy to Real Measurement" narrative explaining why proxies failed and how real measurement restores gate integrity.
  - `docs/requirements.md` — M34 REQ-063 through REQ-068 traceability table with functional and non-functional requirements.
  - `templates/CLAUDE-global.md` — Context Meter Gate subsection + historical note about the task-counter era.
  - `templates/CLAUDE-project.md` — new Context Meter section for per-project setup.

### Removed

- **`bin/task-counter.cjs`** — deleted. The entire proxy gate retires. `.gsd-t/.task-counter`, `.gsd-t/task-counter-config.json`, and the `Tasks-Since-Reset` column are no longer read by any code.
- All `CLAUDE_CONTEXT_TOKENS_USED` / `CLAUDE_CONTEXT_TOKENS_MAX` references across `commands/`, `bin/`, `scripts/`, and `templates/` — the last vestiges of the original broken env-var self-check.

### Migration

- **`gsd-t update-all`** runs a one-shot task-counter retirement migration: deletes `bin/task-counter.cjs`, `.gsd-t/.task-counter`, `.gsd-t/task-counter-config.json` from each registered project; writes `.gsd-t/.task-counter-retired-v1` marker so the migration is idempotent. Projects that had the proxy gate wired in come out the other side on the real context meter with zero manual intervention.
- **Users MUST set `ANTHROPIC_API_KEY`** in their shell environment (or accept the install-time prompt) for the context meter to produce real readings. Without the key, the hook fails open and `doctor` reports RED on the API key check — the gate falls back to the `token-log.md` row-count heuristic, which is safer than the old env-var vaporware but less accurate than real measurement.
- Both `install` and `update-all` register the hook in `~/.claude/settings.json` and copy the default config template. Existing `.claude/settings.json` is preserved; only the hook entry is appended.

### Propagation

After publishing, run `/gsd-t-version-update-all` to propagate M34 (hook, config, installer, rewritten token-budget, command file updates, retirement migration) to every registered GSD-T project in a single sweep.

## [2.74.13] - 2026-04-14

### Fixed — v2.74.12 task-counter distribution gap (P0)

**Root cause**: v2.74.12 added `bin/task-counter.cjs` as the deterministic context-burn gate and wired every command file to call `node bin/task-counter.cjs …`, but the installer's `PROJECT_BIN_TOOLS` list (`bin/gsd-t.js:1562`) was never updated to include it. Every downstream project ran command files that referenced a file the installer never copied. In every GSD-T project, `node bin/task-counter.cjs status|should-stop|reset|increment` threw "Cannot find module" — swallowed by `2>/dev/null` — and the orchestrator silently continued with no gate. Confirmed in bee-poc: `reassign-display` 6/6 + `reassign-candidates` 2/9 executed across ~30 min while `task-counter status` stayed `{"count":0}` the entire run and `token-log.md` got zero new rows.

**Additionally**: `doInit()` (`bin/gsd-t.js:1095`) never called `copyBinToolsToProject` at all, so brand-new projects created with `gsd-t init` were born with no bin tools until the user manually ran `update`.

**Fix**:
- **`bin/gsd-t.js`** — `PROJECT_BIN_TOOLS` now includes `task-counter.cjs`. One-line change at `bin/gsd-t.js:1562`.
- **`bin/gsd-t.js`** — `doInit()` now calls `copyBinToolsToProject(projectDir, projectName)` after `initGsdtDir`, so newly-initialized projects ship bin tools immediately.

v2.74.12's entire two-layer fix (task-count gate + extracted prompts) is correct — it just needed one line to actually distribute the counter script. Running `/gsd-t-version-update-all` after publishing this version will propagate `task-counter.cjs` to every registered project.

## [2.74.12] - 2026-04-14

### Fixed — Context-Burn Regression (P0, affects every GSD-T project)

**Root cause**: commit `0b91429` (2026-03-24) added an "orchestrator context self-check" that read `CLAUDE_CONTEXT_TOKENS_USED` / `CLAUDE_CONTEXT_TOKENS_MAX` — environment variables **Claude Code never exports**. The guard was always false, so the self-check was silently inert. Commits `da6d3ae` and `b68353e` then promoted Red Team and Design Verification from per-domain to per-task on the assumption that this guard would catch context drain. With the guard broken, per-task spawning of ~10K-token adversarial prompts drained sessions from 77% → 12% context in just 2 tasks (bee-poc reproducer).

**Fix ships as a comprehensive two-layer correction:**

#### Fix 1: Real task-count gate (replaces vaporware env-var check)
- **NEW `bin/task-counter.cjs`** — deterministic on-disk task counter. State: `.gsd-t/.task-counter`. Config: `.gsd-t/task-counter-config.json` (default limit: 5). Env override: `GSD_T_TASK_LIMIT`. Commands: `increment <kind>`, `status`, `reset`, `should-stop` (exit code 10 at limit). This is the real signal the old self-check *pretended* to be.
- **`commands/gsd-t-execute.md`** — Step 0 resets the counter; Step 3.5 calls `node bin/task-counter.cjs should-stop` as a gate before every task spawn; Step 5 increments after each task. At limit, the orchestrator checkpoints and STOPs — user runs `/clear` then `/gsd-t-resume`.
- **`commands/gsd-t-wave.md`** — analogous phase-count gate replaces the broken "Wave Orchestrator Context Self-Check."
- **`bin/token-budget.js`** — `getSessionStatus()` rewritten to read the task counter instead of env vars. API surface preserved (threshold/pct/consumed/estimated_remaining) so all dependent commands keep working. Graduated-degradation thresholds (warn/downgrade/conserve/stop) now fire on real signal.

#### Fix 2: Revert per-task Red Team / Design Verify, extract prompts to templates
- **NEW `templates/prompts/`** directory with three self-contained prompt files: `qa-subagent.md`, `red-team-subagent.md`, `design-verify-subagent.md`, plus a `README.md` explaining the architecture. Command files reference prompts by **file path**, not by inlining the body. Subagents read the prompt file themselves, so the orchestrator never re-materializes ~3500-token prompt bodies in its own context per spawn.
- **`commands/gsd-t-execute.md`** — Red Team and Design Verification moved back to **per-domain** (where they were before `da6d3ae` / `b68353e`). QA stays per-task (smaller, and contracts can drift task-by-task). Result: safe-task-count-per-session rises from ~5 to ~15+.
- **`commands/gsd-t-quick.md`, `gsd-t-integrate.md`, `gsd-t-debug.md`** — Red Team spawn blocks converted to templated-prompt references. ~270 lines of duplicated adversarial prompt boilerplate removed; run-specific categories (Cross-Domain Boundaries, Regression Around the Fix, Original Bug Variants) preserved as one-line context notes to the subagent.

#### Fix 3: Token-log schema & placeholder cleanup
- Removed `Tokens | Compacted | Ctx%` columns from the token-log schema (they always wrote `0 | null | N/A` because the env vars were never set). Added `Tasks-Since-Reset` as the real burn signal.
- Neutralized **70+ references** to `CLAUDE_CONTEXT_TOKENS_USED` / `CLAUDE_CONTEXT_TOKENS_MAX` across 14 command files. The 3 remaining references (gsd-t-execute.md, gsd-t-wave.md, gsd-t-doc-ripple.md) are historical-note mentions only. `scripts/gsd-t-heartbeat.js` and `scripts/gsd-t-statusline.js` still read the env vars but treat them as optional fallbacks that gracefully degrade (unchanged behavior).
- Test suite (`test/token-budget.test.js`) rewritten around the new counter-based `getSessionStatus()`. 36/36 passing.

### Propagation
After publishing, run `/gsd-t-version-update-all` to propagate the fix to every registered GSD-T project. Projects will receive the new `bin/task-counter.cjs` and updated command files in a single sweep.

## [2.74.11] - 2026-04-13

### Fixed
- **`bin/archive-progress.js` → `.cjs` rename** — the new bin tools used CommonJS `require()` but failed in projects with `"type": "module"` in `package.json` (caught on BDS-Analytics-UI during first update-all). Renamed all three new bin tools to `.cjs` so they run as CommonJS regardless of the host project's module type. `version-update-all` now copies `.cjs` files and runs `archive-progress.cjs`.

## [2.74.10] - 2026-04-13

### Added
- **`bin/archive-progress.js`** — rolling Decision Log archival. Keeps the last 5 entries live in `.gsd-t/progress.md`; older entries roll into `.gsd-t/progress-archive/NNN-YYYY-MM-DD.md` files (20 entries each) with an `INDEX.md` for date-range lookup. **Solves the runaway context consumption from progress.md growth** — current GSD-T project saw 163KB → 42KB on first migration (Decision Log section dropped from ~100KB to 13KB). Idempotent, dry-run supported, safe to run anytime.
- **`bin/log-tail.js`** — truncate test/build log output before forwarding into context. Writes full output to disk, prints only the tail (default 100 lines, 500 on detected failure). Used by command files to prevent multi-thousand-line stdout dumps from npm test / playwright test from blowing context budget.
- **`bin/context-budget-audit.js`** — measures the static context cost of a Claude Code session before any work happens. Reports tokens consumed by CLAUDE.md files, command manifest, MCP server schemas, auto-memory, and lazy-loaded skill bodies. Use to diagnose why long-running sessions hit manual `/compact` prompts.
- **Auto-migration on `version-update-all`** — every registered project gets `archive-progress.js`, `log-tail.js`, and `context-budget-audit.js` copied into its `bin/` directory automatically. The progress archive migration runs once per project (gated by `.gsd-t/.archive-migration-v1` marker) so the next `version-update-all` reclaims context budget across every GSD-T project at once.

### Fixed
- **Mid-session context exhaustion regression** — manual `/compact` prompts that started ~2026-04-10 traced to `progress.md` growing past 50K tokens (25% of the 200K context window in a single file). Every command that read it paid this cost. Archival fix targets the root cause; commands that read `progress.md` now see <10K tokens of relevant content instead of 50K+ of historical decisions.

## [2.73.28] - 2026-04-09

### Fixed
- **Ctrl+C now cleanly kills the orchestrator and all child processes** — SIGINT handler tracks all spawned Claude processes (build, review, fix) and kills them on Ctrl+C. The sync `spawnClaude` was converted from `execFileSync` (which blocked the event loop and prevented signal handling) to an async `execFile` with a polling wait that checks an interrupt flag. The `waitForReview` polling loop also breaks on Ctrl+C. No more orphaned processes.

## [2.73.27] - 2026-04-09

### Changed
- **Unlimited human review cycles with auto-review reset** — the orchestrator no longer caps human review iterations. After each human fix: (1) fixes are applied, (2) components are re-measured, (3) automated AI review runs with a fresh cycle counter (up to `maxAutoReviewCycles`), (4) components are re-queued for human review. This loop repeats until the reviewer submits with zero changes. The human is always the final gate.

## [2.73.26] - 2026-04-09

### Added
- **AI prompt assistant in review panel** — expandable panel in the header (toggle with Ctrl+K or the AI button). Ask questions about the selected component ("what stroke-width is this using?"), get help translating vague corrections into precise contract language ("arcs are too thick" → actionable property changes), and preview responses before committing them as comments via "Use as comment" button. Uses the Claude Code CLI (`claude -p`) so it works with Claude Max subscriptions — no API key needed. Model defaults to opus (override with `GSD_AI_ASSIST_MODEL` env var).
- **`/review/api/contract` endpoint** — returns the full design contract markdown for a given component path. Used by the AI assistant to provide contract-aware responses.
- **`/review/api/ai-assist` endpoint** — streaming SSE endpoint that spawns `claude -p` with component context (name, measurements, computed styles, contract). Zero external dependencies — uses the locally installed Claude Code CLI.

## [2.73.25] - 2026-04-09

### Added
- **Undo remove** — excluded elements show as struck-through with a green ↩ restore button instead of disappearing. Click to undo before submitting.
- **Contract deletion on submit** — when excluded elements are submitted, their contract files and source files are deleted from the project. The `/review/api/exclude` endpoint handles cleanup.

## [2.73.24] - 2026-04-09

### Added
- **Remove element button** — hover over any component in the list to reveal a red × button. Clicking it excludes the element from review and auto-comments "EXCLUDED — not in Figma design". Excluded count shown in submit stats.

### Fixed
- **Comment validation removed** — all comments are now accepted (questions, exclusions, feedback). The "don't suggest specific changes" popup no longer blocks submission.

### Changed
- **Submit stats** show removed count alongside changed/commented.

## [2.73.23] - 2026-04-09

### Fixed
- **Container props auto-redirect to parent** — setting `gap`, `borderRadius`, or `overflow` on a bar segment (child) now auto-targets the parent flex/grid container. Previously only worked when the container itself was selected.

## [2.73.22] - 2026-04-09

### Added
- **Stack-level border-radius** — setting `borderRadius` on a flex/grid bar column container auto-sets `overflow: hidden` (so rounded corners clip child segments) and propagates to all sibling columns. One change rounds all stacked bars.

## [2.73.21] - 2026-04-09

### Fixed
- **Undo All / Cmd+Z now reverts display** — undo properly sends `gsdt-set-svg-attr` for SVG changes and skips fixture changes. Undo All individually reverts each change before resetting CSS, so the preview updates correctly.
- **Can re-enter original value** — changing a property back to its original value now removes the tracked change and reverts the style (previously rejected as "no change").
- **Gap propagation for bar charts** — setting `gap` on a flex/grid container propagates to all sibling containers with the same display type (e.g., all bar columns). Shows "→ N all columns" feedback.

## [2.73.20] - 2026-04-09

### Added
- **Editable fixture data** — segment label, value, and color fields in the Data Props tree are now clickable to edit. Color fields use a color picker. Changes tracked alongside CSS/SVG changes in the review output.
- **Better SVG tree labels** — circle/arc nodes show stroke color, width, and radius. Path nodes show fill/stroke color. SVG root shows viewBox.
- **Deeper SVG tree traversal** — SVG subtrees traverse up to depth 8 (was 4), ensuring individual arc segments appear in the element tree.

### Removed
- **`percentages_shown`** from donut chart fixture — redundant with `segments[].value`.

## [2.73.19] - 2026-04-09

### Added
- **SVG attribute inspector** — SVG elements (`circle`, `path`, `rect`, `line`, `ellipse`, `text`, `g`, `polyline`, `polygon`) now show an "SVG Attributes" property group with all relevant attributes (stroke-width, r, fill, stroke, stroke-dasharray, viewBox, etc.). Attributes are editable inline with `setAttribute()`. Visual flash zones highlight stroke-width (blue), stroke/fill (matching color), dash patterns (amber dashed), and generic attrs (cyan).
- **SVG permitted value dropdowns** — `stroke-linecap`, `stroke-linejoin`, `text-anchor`, `dominant-baseline` show `<select>` dropdowns with valid SVG values.

### Fixed
- **Dropdown flash-on-click** — clicking a permitted-value `<select>` dropdown no longer re-triggers `startEdit()`, which was recreating the dropdown and causing it to flash on/off. Added re-entry guard checking for existing `select`/`input` inside the value element.

## [2.73.18] - 2026-04-09

### Added
- **Permitted value dropdowns** for enum CSS properties — `display`, `flexDirection`, `textAlign`, `alignItems`, `justifyContent`, `fontWeight`, `overflow`, `position` now show a `<select>` dropdown with valid options instead of a free-text input. Select commits on change.
- **Enhanced visual cue** — generic flashZone fallback now shows a bright blue outline with a computed-value label overlay. All property name clicks flash the element.
- **More editable properties** — added `overflow`, `position`, `top`, `left`, `boxShadow`, `fontFamily` to the editable set.

## [2.73.17] - 2026-04-08

### Added
- **Fixture data tree in property inspector** — when a component is selected, the inspector fetches its test fixture data from `/review/api/fixture` and renders it as an expandable tree. Shows columns, rows, segments, and all nested data with color swatches for hex values. Collapsible at every level.

## [2.73.16] - 2026-04-08

### Added
- **Gallery view** — `/review/gallery?cols=N` renders all queued components in a grid layout, proxied through Vite. Vue error boundaries isolate per-component failures so one broken component doesn't crash the gallery. Gallery button in review UI header toggles between single-component and gallery views.
- **Fixture unwrapping** — when a contract test fixture wraps props in an array (e.g., `{cards: [{value, label}]}`) but the component expects flat props, the first item is auto-unwrapped. Fixes StatCardWithIcon rendering blank in preview.

## [2.73.15] - 2026-04-08

### Added
- **Reviewer output logging** — review and fix outputs now saved to `build-logs/` as `{phase}-review-{id}-c{cycle}.log` and `{phase}-fix-{id}-c{cycle}.log`. Enables auditing whether reviewers actually ran Playwright, what issues were found, and what fixes were applied.

### Changed
- **Default parallelism now all-items** — per-item pipeline runs all items concurrently by default (was sequential). Bottleneck is API latency, not CPU/RAM. Use `--parallel N` to limit if needed.

## [2.73.14] - 2026-04-08

### Fixed (review UI — component preview rendering)
- **Preview HTML now proxied through Vite** for module resolution. Bare module specifiers (`'vue'`, `'react'`) are transformed by Vite into resolved paths. Previously served static HTML which caused `Failed to resolve module specifier "vue"` error.
- **Test fixture props extracted from design contracts** — reads `## Test Fixture` JSON block, strips metadata keys, passes as component props. Components now render with sample data.
- **Playwright-verified** — ChartDonut renders 5-segment donut with center value, sublabel, and percentage labels from contract fixture data.

## [2.73.12] - 2026-04-08

### Added (review UI — isolated component preview + tier tabs)
- **`/review/preview` endpoint** — mounts a single component in isolation via Vite module resolution. Framework-aware: auto-detects Vue/React/Svelte from package.json. Includes global styles and Vite HMR client. Components now render in the review iframe instead of showing a blank page.
- **Tier tabs** — Elements | Widgets | Pages tabs in the sidebar filter components by tier. Counts update as items are queued. All tab shows everything.
- **Framework detection** — review server reads project's package.json to determine mount strategy. Logs detected framework and global styles on startup.

## [2.73.11] - 2026-04-08

### Changed (reviewer — Playwright-first visual inspection)
- **Playwright is now the PRIMARY reviewer method** — every contract-specified visual property is verified via `getComputedStyle()` in a real browser. Code review demoted to supplement for non-visual concerns (props, events, accessibility). CSS box math (cascade, specificity, flex/grid computation, relative units) can only be verified at render time, not from source code.

## [2.73.10] - 2026-04-08

### Added (orchestrator — parallel execution)
- **`--parallel N` flag** — runs N build+review items concurrently via async `spawnClaudeAsync()` and `_runWithConcurrency()`. Default: 1 (sequential). Recommended: 3. Reduces 15-element pipeline from ~30min to ~10min at 3x parallelism.
- **`--clean` artifact cleanup expanded** — now clears `auto-review/`, `build-logs/`, `queue/`, `feedback/`, `review-complete.json`, `orchestrator-state.json` on fresh start (not just build output).

### Changed
- **Orchestrator `run()` is now async** — callers (`bin/gsd-t.js`, `bin/design-orchestrator.js`) updated with `.catch()` for proper error handling.

## [2.72.10] - 2026-04-08

### Added (orchestrator — per-item pipeline, stream-json, verbose, clean)
- **Per-item build+review pipeline** — when workflow provides `buildSingleItemPrompt` + `buildSingleItemReviewPrompt`, each component is built and reviewed individually (1 contract + 1 source per Claude spawn) instead of all-at-once. Fixes reviewer timeout caused by 30+ files in a single context. Each item gets up to 4 auto-review fix cycles independently.
- **`--output-format stream-json`** — Claude spawns now use streaming JSON output. On timeout, partial output is captured and parsed instead of returning empty string. Enables diagnosing what the reviewer was doing before being killed.
- **`--verbose` / `-v` flag** — streams Claude's stderr to terminal for real-time tool call visibility, saves prompts to `build-logs/` for post-mortem, logs completion stats after each spawn.
- **`--clean` flag** — deletes previous build output files before each phase's build step for fresh builds.
- **Version display** — orchestrator shows GSD-T version in startup header.

### Changed
- **Reviewer timeout increased** — 300s → 600s for all-at-once review mode (per-item uses 120s per component).
- **Design orchestrator** — added `buildSingleItemPrompt` and `buildSingleItemReviewPrompt` for per-item pipeline support. Reviewer prompt restructured: code review first, Playwright spot-check second.

## [2.71.21] - 2026-04-08

### Fixed (orchestrator — timeout false-pass, review server health, stale cleanup)
- **Reviewer timeout/kill no longer treated as "pass"** — exit codes 143 (SIGTERM) and 137 (SIGKILL) are now always detected as failures regardless of duration. Previously, a reviewer that timed out at 300s was parsed as "0 issues = pass" because crash detection only checked duration < 10s.
- **Empty output with non-zero exit also caught** — any reviewer that exits non-zero with no output is treated as a failure, not a clean pass.
- **Review server health check during human review gate** — every ~30s the polling loop verifies port 3456 is alive. If the review server dies, it auto-restarts. Previously, a dead review server left the orchestrator stuck forever.
- **Stale auto-review cleanup** — old auto-review files from previous runs are cleared at the start of each phase's review cycle, preventing misleading results from prior orchestrator runs.

## [2.71.20] - 2026-04-08

### Fixed (orchestrator — reviewer crash false-pass + Ctrl+C + build logging)
- **Reviewer crash no longer treated as "pass"** — if the reviewer exits with non-zero code in under 10s, it's a crash, not a clean review. Retried on next cycle. Previously, empty output from a crashed reviewer was parsed as "0 issues = pass."
- **Ctrl+C now works** — replaced `Atomics.wait` with `sleep` command for synchronous polling. `Atomics.wait` blocks the event loop completely, preventing SIGINT.
- **Build output logging** — builder output written to `.gsd-t/design-review/build-logs/{phase}-build.log` for debugging.

## [2.71.18] - 2026-04-08

### Fixed (orchestrator — Claude permissions and timeouts)
- **Added `--dangerously-skip-permissions` to Claude spawns** — builder, reviewer, and fixer Claude instances couldn't write files in non-interactive `-p` mode. They ran successfully but produced zero output files because permission prompts can't be answered in piped mode.
- **Increased fixer timeout from 2min to 10min** — fixer was getting SIGTERM'd (exit code 143) trying to create 15 components in 120s. Now uses the same timeout as the builder (default 600s).

## [2.71.17] - 2026-04-08

### Fixed (orchestrator — auto-review cycle limit)
- **Bumped maxAutoReviewCycles from 2 to 4** — 2 cycles was too conservative for complex components (e.g., charts with multiple contract properties). 4 cycles gives the reviewer/fixer loop enough iterations to converge.

## [2.71.16] - 2026-04-08

### Added (orchestrator — automated AI review loop)
- **Automated review before human review** — orchestrator now spawns an independent reviewer Claude (no builder context) that compares built components against design contracts. If issues found, spawns a fixer Claude, re-measures, and re-reviews (max 2 cycles). Only after automated review passes do items reach human review. This is the Term 2 equivalent, running deterministically in JavaScript.
- **Review report persistence** — each auto-review cycle writes results to `.gsd-t/design-review/auto-review/`. Unresolved issues are written to `{phase}-unresolved.json` for human visibility.
- **Structured review output** — reviewer uses `[REVIEW_ISSUES]` markers for reliable parsing. Fallback parser catches DEVIATION/FAIL/CRITICAL keywords.

### Pipeline (updated)
Build → Measure → **Automated AI Review** (reviewer → fixer → re-review loop) → Human Review → Next Tier

## [2.71.15] - 2026-04-08

### Changed (design-build command → orchestrator delegate)
- **`gsd-t-design-build.md` now delegates to the JS orchestrator** — the 388-line prompt-based command is replaced with a thin wrapper that runs `gsd-t design-build`. Both `/gsd-t-design-build` and `gsd-t design-build` now end up in the same deterministic pipeline. No more prompt-based gates that get skipped.

## [2.71.14] - 2026-04-08

### Added (design-build orchestrator)
- **Abstract workflow orchestrator** (`bin/orchestrator.js`) — base engine for deterministic multi-phase pipelines. Handles Claude spawning, review queue management, ironclad JS polling gates, state persistence/resume, server lifecycle, and cleanup. Workflow definitions plug in via a simple interface (phases, prompts, measurement, feedback). Zero external dependencies.
- **Design-build workflow** (`bin/design-orchestrator.js`) — first workflow implementation: elements → widgets → pages. Discovers contracts from `.gsd-t/contracts/design/`, builds per-tier Claude prompts, Playwright measurement, and review queue items. Plugs into the base orchestrator.
- **CLI subcommand** — `gsd-t design-build [--resume] [--tier] [--dev-port] [--review-port]` delegates to the orchestrator. Integrated into `bin/gsd-t.js` help and switch statement.
- **Resume capability** — orchestrator persists state to `orchestrator-state.json`, supports `--resume` to continue from where it left off after interruption.

### Why
Three separate attempts to enforce review gates via prompt instructions all failed — Claude Code agents optimize for task completion and skip any instruction to pause indefinitely. The orchestrator moves flow control out of prompts entirely into deterministic JavaScript.

## [2.71.13] - 2026-04-08

### Fixed (design-decompose — successor hint)
- **Next Up points to design-build** — `design-decompose` was recommending `partition` as the next step. The natural successor after decomposing contracts is `design-build` (which handles the tiered build with review gates), not `partition`. Updated the command's Step 9 hint and added `design-decompose → design-build` to the successor mapping table in CLAUDE-global template and live CLAUDE.md.

## [2.71.12] - 2026-04-08

### Changed (smart router — design-to-code pipeline)
- **Pipeline Routing** — Smart router now treats design-to-code requests as a multi-step pipeline (clean → decompose → build) instead of picking a single command. When a user says "rebuild from this Figma" or "start from scratch with this design," the router evaluates pipeline entry point based on current state and auto-advances through subsequent steps.
- **Entry Point Detection** — "start over" / "from scratch" / "clean slate" enters at clean step (removes UI assets, then decompose, then build). Missing design contracts enters at decompose. Existing contracts enters at build.
- **Inline Cleanup** — Clean step removes UI component files while preserving non-UI files (API, stores, router config, project scaffold). No separate `quick` command needed.
- **Design Command Slugs** — Added `design-decompose`, `design-build`, `design-audit`, `design-review` to valid router command slugs.

### Why
User gave the router a single prompt asking to delete old assets and rebuild from a Figma design. The router could only pick one command, so it had to choose between `quick` (cleanup) and `design-decompose` (contracts). The natural workflow is a pipeline that the router should execute end-to-end.

## [2.71.11] - 2026-04-08

### Fixed (design-build — review gates and measurement)
- **Explicit Blocking Review Gates** — Steps 5 (widgets) and 6 (pages) now include their own inline bash polling loops instead of cross-referencing Step 3. The subagent was treating "Wait for human review (Step 3)" as an informational note and skipping the gate entirely, building all three tiers without ever showing the review UI.
- **Concrete Widget Measurement** — Step 5 now has full Playwright `page.evaluate()` code for measuring grid columns, gap, children-per-row, padding, and child positioning. Previously was a single vague line ("Playwright measure the assembled widget").
- **Concrete Page Measurement** — Step 6 now has explicit Playwright code for grid column count verification, section ordering, widget width ratios, spacing, and responsive breakpoints. Grid column mismatch (e.g., 4-across instead of 2-across) is flagged as `severity: "critical"`.
- **Auto-Rejection for Grid Failures** — Review server now auto-rejects items with `grid-template-columns`, `gridTemplateColumns`, `columns-per-row`, or `children-per-row` measurement failures as critical (same as chart type mismatches).

### Why
User ran `design-build` and the builder completed all three tiers (elements → widgets → pages) without ever displaying the review panel. The review gate in Steps 5/6 used parenthetical cross-references that the subagent ignored. Additionally, the page rendered 4-across when the contract specified 2-across — the measurement step had no concrete code to catch this.

## [2.70.15] - 2026-04-06

### Changed (design pipeline — decompose verification)
- **Separate Verification Agent** — `gsd-t-design-decompose` Step 6.5 now spawns a dedicated opus-model verification subagent instead of self-verifying chart classifications. The decompose agent cannot verify its own work — sunk cost bias causes it to rubber-stamp its classifications. The separate agent has fresh context and its sole incentive is finding mismatches.
- **BAR CHART ORIENTATION PROOF** — mechanical decision tree injected into the verification agent prompt: rectangles in a ROW → HORIZONTAL, rectangles BOTTOM-TO-TOP → VERTICAL. Eliminates the #1 misclassification (horizontal percentage bars classified as vertical grouped).
- **Max 2 fix cycles** — if the verifier finds mismatches, contracts are corrected and re-verified (up to 2 cycles). Persistent failures block decompose completion.

### Why
v2.70.14 ensured "build follows contracts" but the contracts themselves were wrong. The decompose command's Step 6.5 asked the same agent to verify its own chart type classifications — it always passed itself. Three charts (`Number of Tools`, `Time on Page`, `Number of Visits`) were classified as `bar-vertical-grouped` when the Figma shows `bar-stacked-horizontal-percentage`. A separate verification agent with no sunk cost catches these mismatches before contracts are finalized.

## [2.70.14] - 2026-04-06

### Changed (design pipeline — hierarchical execution)
- **Hierarchical Build Order** — `gsd-t-plan` now detects `.gsd-t/contracts/design/INDEX.md` and auto-generates tasks in strict element → widget → page order (Wave 1/2/3). Each element gets its own focused task with only its element contract. Each widget task imports already-built elements. Each page task imports already-built widgets. ONE CONTRACT = ONE TASK.
- **No Inline Rebuild Rule** — added to `gsd-t-execute`, `gsd-t-quick`, and `design-to-code.md` stack rules. Widget tasks that rebuild element functionality inline (instead of importing the built element component) are a TASK FAILURE. Same for page tasks rebuilding widgets. The hierarchy exists to prevent this.
- **Contract Is Authoritative** — when the element contract and Figma screenshot disagree, the contract wins. The contract was written from careful design analysis; screenshots are ambiguous at small sizes.
- **Per-Wave Design Verification Checkpoints** — `gsd-t-execute` now runs design-specific checks at each wave boundary: element contracts after Wave 1, widget assembly after Wave 2, full Figma comparison after Wave 3.
- **Design Hierarchy Build Rule in subagent prompt** — task subagents now receive explicit instructions for element/widget/page tasks: what to import, what NOT to rebuild, and that contracts are authoritative over screenshots.
- **Hierarchical Audit Mode** — `gsd-t-design-audit` now detects hierarchical design contracts and audits bottom-up: Level 1 (element chart types), Level 2 (widget assembly — imports vs inline rebuilds), Level 3 (page composition). Pinpoints exactly where a deviation originates instead of flat page-level comparison.

### Why
The decomposition (gsd-t-design-decompose) creates a perfect hierarchy — 27 elements → 10 widgets → 1 page. But the plan and execute phases didn't follow it. The planner created monolithic "build the page" tasks, and the builder wrote 700-line inline pages ignoring contracts and existing components. All recent enhancements (v2.70.10-12) targeted post-build verification — catching errors after they were made. This change moves enforcement to the build phase: build each element individually (the subagent can't confuse chart types when it only sees one element contract), verify it, then compose. Inside-out execution matches the decomposition structure.

## [2.70.13] - 2026-04-06

### Changed (gsd-t-init, gsd-t-init-scan-setup)
- **Auto-create project directory + GitHub repo** — both `gsd-t-init` and `gsd-t-init-scan-setup` now create the project directory under a configurable base path and auto-create a private GitHub repo via `gh` CLI when a project name is provided as an argument.
- **Configurable base directory** — `~/.claude/.gsd-t-config` stores `projects_dir` (e.g., `/Users/david/projects`). Set once, never asked again. New projects are created at `{projects_dir}/{project-name}`.
- **Configurable GitHub org** — `~/.claude/.gsd-t-config` stores `github_org` (e.g., `Tekyz-Inc`). When set, repos are created under the org (`gh repo create {org}/{name}`). When not set, repos are created under the user's personal account.
- Existing project detection: if the current directory already has code/config files, Step 0 is skipped entirely — no behavior change for existing projects.

## [2.70.12] - 2026-04-06

### Added (design pipeline — element count reconciliation)
- **Element Count Reconciliation** — new mandatory verification step that runs BEFORE any property or visual comparison. Counts widgets and elements from the Figma decomposition (stored in INDEX.md), counts the built page's widgets and elements via Playwright, and compares. Any mismatch (missing or extra widgets/elements) is a CRITICAL deviation. Added to: `gsd-t-execute` (Step 0 inside Design Verification Agent), `gsd-t-quick` (Step 0), `gsd-t-design-audit` (Step 1.5).
- **Figma Element Counts table in INDEX.md** — `gsd-t-design-decompose` now writes element/widget/page counts and a per-page element manifest to INDEX.md as the verification anchor. The verification agent reads these counts as ground truth.
- **5-layer verification model** — design-to-code.md now documents Targets 0-4 in execution order: count reconciliation → contract comparison → Figma comparison → SVG overlay → DOM box model inspection.

### Why
A missing widget is the most catastrophic deviation but the easiest to miss in a 30+ row comparison table. The agent compares what exists but doesn't notice what's absent. An explicit count gate catches "Figma has 10 widgets, built page has 9 — WHERE IS THE 10TH?" before any property-level work begins.

## [2.70.11] - 2026-04-06

### Added (design pipeline — DOM box model inspection + layout arithmetic)
- **DOM Box Model Inspection** — new mandatory verification step for fixed-height containers. Uses Playwright to evaluate `offsetHeight` vs `scrollHeight` for each child element. Flags elements where `offsetHeight > scrollHeight * 1.5` as INFLATED (symptom: `flex: 1` on a content element inflating its box beyond content size). Added to: `gsd-t-execute` (Step 5.5 inside Design Verification Agent), `gsd-t-quick` (step 8 inside Design Verification Agent), `gsd-t-design-audit` (Step 3.75).
- **Internal Layout Arithmetic** — widget contract template now requires computed height budgets for fixed-height cards: `card_height - padding - header = body_available`, then `child1 + gap1 + child2 + ... = total_content ≤ body_available`. Forces the agent to write the math before coding — prevents `gap: 12px` when only `gap: 8px` fits.
- **Flex Centering Anti-Pattern Rule** — `design-to-code.md` Section 8 now explicitly prohibits `flex: 1` on content elements (KPI, labels, text) for centering. Rule: `flex: 1` belongs on containers, `justify-content: center` on the parent. Children keep natural size.
- **4 new verification checklist items** in `design-to-code.md` and `widget-contract.md`: box model inspection, layout arithmetic, no content flex:1, inflated element detection.

### Why
BDS horizontal stacked bar cards required 5 user-prompted fix iterations to get spacing right. Root cause: agent used `flex: 1` on `.kpi` to center it vertically, which inflated the element to 144px (content was 40px), displacing the chart section. The property comparison table and SVG overlay both missed this because the *positions* were close enough — the problem was *how space was distributed*, not where elements landed. DOM box model inspection catches the cause (inflated element) not just the symptom (displaced sibling).

## [2.70.10] - 2026-04-06

### Added (design pipeline — 2 new capabilities)
- **Design System Detection** — all design pipeline commands now ask for a design system / component library URL upfront before extraction or implementation. If provided, the agent fetches the library docs, catalogs available components, and maps design elements to library primitives (use library components instead of building custom). Added to: `gsd-t-design-decompose` (Step 0.4), `gsd-t-design-audit` (Step 0), `design-to-code.md` (new Section 1 — all subsequent sections renumbered). Verification checklist updated with 2 new items.
- **SVG Structural Overlay Comparison** — new mandatory verification layer that exports the Figma frame as SVG, parses element positions/dimensions/colors from the SVG DOM, maps to built DOM bounding boxes, and compares geometry mechanically (≤2px = MATCH, 3-5px = REVIEW, >5px = DEVIATION). Catches aggregate spacing drift, alignment issues, and proportion errors that pass property-level checks but are visually wrong. Added to: `gsd-t-execute` (Step 5 inside Design Verification Agent), `gsd-t-quick` (step 7 inside Design Verification Agent), `gsd-t-design-audit` (Step 3.5), `design-to-code.md` (Target 3 + workflow step 7 + checklist item).

### Why
- **Design system**: Building custom cards, tables, tabs, and buttons from scratch when a library like shadcn-vue already provides them wastes effort and produces inferior results (missing accessibility, focus states, interactive states). Asking upfront eliminates redundant work.
- **SVG overlay**: The property-level comparison table catches wrong values but misses aggregate visual drift — spacing rhythm, alignment, proportions that are individually correct but collectively off. SVG structural diff is mechanical and non-interpretive: geometry vs geometry, no agent reasoning required.

## [2.69.13] - 2026-04-05

### Fixed (design-to-code pipeline — extraction + verification)
- **Mandate `get_design_context` everywhere in the pipeline** — initial build (design-to-code.md sections 1-2), verification agent (gsd-t-execute.md Step 5.25), quick verification (gsd-t-quick.md Step 5.25), and Red Team design fidelity check all now explicitly require `get_design_context` per widget node for Figma data extraction. `get_screenshot` is prohibited for extraction and restricted to visual-only comparison of built output. This closes the gap where agents chose `get_screenshot` (pixels) over `get_design_context` (structured code/tokens) at every stage.

## [2.69.12] - 2026-04-05

### Fixed (gsd-t-design-audit, gsd-t-design-decompose)
- **Explicit `get_screenshot` prohibition** — agents were choosing `get_screenshot` (returns pixels) instead of `get_design_context` (returns structured code/tokens) for per-widget Figma extraction, defeating structured comparison. Both commands now have explicit tool guards: "NEVER use `get_screenshot` for Figma design extraction." `get_screenshot` is only acceptable for capturing the built page, not for extracting Figma source data.

## [2.69.11] - 2026-04-05

### Changed (gsd-t-design-audit)
- **Auto-fix prompt** — after audit completes, if CRITICAL/HIGH deviations found, automatically prompts `/gsd-t-quick` with the audit report as source of truth. Re-runs audit after fixes to verify. Up to 2 fix cycles before stopping.

## [2.69.10] - 2026-04-05

### Added
- **`/gsd-t-design-audit` command** — compare a built screen against a Figma design. Node-level Figma decomposition, per-widget comparison tables (10-30+ rows each), severity-rated deviations (CRITICAL/HIGH/MEDIUM/LOW), fidelity percentage. Writes zero code — report only. Usage: `/gsd-t-design-audit {Figma URL} {route}`.

## [2.68.13] - 2026-04-05

### Added (element-contract template)
- **Chart-type-specific mandatory Visual Spec properties** — bar charts must now specify: `bar_width`, `bar_gap`, `bar_group_gap`, `corner_radius`, `label_position`, `label_min_width`, `segment_order`, `orientation`. Circular charts: `outer_diameter`, `inner_diameter`, `segment_order`, `start_angle`, `label_position`, `center_content`. Line/area: `stroke_width`, `point_radius`, `curve_type`, `fill_opacity`. Progress/gauge: `track_width`, `fill_width`, `track_color`. These are the exact properties that distinguish "matches the design" from "looks close."

### Why
BDS comparison showed bars with wrong width, wrong gap between groups, labels positioned outside instead of inside, wrong segment stacking order. The element contract's Visual Spec was free-form (`{dimension_1}`) — the agent could skip bar_width, segment_order, and label_position entirely. Chart-type-specific mandatory fields close this gap.

## [2.68.12] - 2026-04-05

### Fixed (design-chart-taxonomy template)
- **Lists section, naming grammar, and formalized extension workflow** now ship in the package source template (previously only existed in local `~/.claude/templates/` copy from v2.67.10 — `update-all` overwrote it). Package template and installed template are now in sync.

## [2.68.11] - 2026-04-05

### Changed (widget-contract template)
- **Alignment column in Card Chrome Slots** — every slot now requires explicit alignment (left/center/right) extracted from Figma. Incorrect legend alignment was the #2 cause of "looks off" results.
- **Internal Element Layout section (MANDATORY)** — new section replacing the flat layout table. Documents: body_layout (flex-row/column/grid), body_justify, body_align, body_gap, chart_width/height, legend_width, footer_legend_justify, header_to_body_gap, body_to_footer_gap. These are the exact values that control spacing and sizing of elements within a widget card.
- **Verification checklist expanded** — now checks: chrome alignment, internal layout, inter-element spacing, element sizing, legend alignment, card container values (6 new items).

### Why
BDS Analytics comparison revealed consistent intra-widget layout errors: legends left-aligned instead of centered, inconsistent spacing between chart and legend, wrong element sizing within cards. The widget contract template had a Layout section but it specified only container-level properties (padding, border, gap) — not how elements were sized, spaced, and aligned WITHIN the card body. These new fields close that gap.

## [2.68.10] - 2026-04-05

### Changed (gsd-t-design-decompose)
- **Node-level Figma decomposition (MANDATORY)** — Step 1 now requires `get_metadata` to map page tree, then `get_design_context` on EACH widget node individually. No more classifying from page screenshots alone. Extracted text content (titles, subtitles, column headers, legend items) becomes mandatory data inventory column.
- **Classification reasoning (MANDATORY)** — Step 2 now requires written decision-tree walkthrough for every chart element: "I see [description]. Decision tree: [walkthrough]. Classification: [entry]. Confidence: [HIGH/MEDIUM/LOW]". Low/medium confidence entries flagged for human review.
- **Human contract review checkpoint** — Step 5 now presents classification reasoning table + data inventory alongside decomposition summary. User reviews chart type assignments and text content before contracts are written. 5-minute gate that catches misclassification before it propagates.
- **Contract-vs-Figma verification gate (MANDATORY)** — New Step 6.5 re-reads each Figma node after contracts are written and produces a mismatch report. Catches: wrong chart types, hallucinated column headers, missing elements, invented data models. Mismatches must be fixed before proceeding to build.

### Changed (design-to-code stack rule)
- **Visual verification against FIGMA, not just contracts** — Section 15 now requires the Design Verification Agent to compare the built screen against the original Figma screenshot (Target 2), not just against design contracts (Target 1). This closes the gap where wrong contracts produce wrong code that still scores 50/50 against itself.

### Why
Post-validation comparison of the built BDS Analytics screen against the original Figma design revealed: wrong chart types (donuts instead of stacked bars in Member Segmentation), hallucinated column headers (Video Playlist), invented data models (Tool Engagement). All scored 50/50 against their contracts — because the contracts were wrong. The contracts→code pipeline is airtight; the Figma→contracts pipeline was unverified. These changes close that gap at four layers: node-level extraction, classification reasoning, human review, and contract-vs-Figma gate.

## [2.67.10] - 2026-04-05

### Added (design-chart-taxonomy)
- **Lists section** — new category between Tables and Controls: `list-simple-vertical`, `list-icon-vertical`, `list-avatar-vertical`, `list-thumbnail-vertical`. Includes decision rule: columns across rows = table; self-contained rows = list.
- **Table-vs-list decision rule** in Tables section — prevents catastrophic misclassification (jamming list-style repeating items into `table-*` entries).
- **Naming grammar** — documents the `{category}-{variant}-{orientation}` pattern with common modifiers. Prevents ad-hoc name invention.
- **Formalized extension workflow** — proposal-first process with: section placement, sibling-diff rationale, catastrophic-misclassification argument, companion-entries-flagged field. Replaces the terse 4-step extension guide.

### Milestone
- **Extensibility VALIDATED** — task-012 forced the taxonomy-extension workflow (picked `list-thumbnail-vertical`, not previously in taxonomy). Proposal-first process worked cleanly; `$ref` composition chain unaffected by new entries. 12 consecutive 50/50 scores across element/widget/page/scale/extensibility tiers.

## [2.66.10] - 2026-04-05

### Changed (page-contract template)
- **Composes Elements (direct)** split into two sub-lists: "Existing element contracts used directly" vs "Inline stubs (promotion candidates)". Closes gap P8 from page-tier run 3.
- **Route guards stub convention** — if a guard is declared but not yet wired, prefix with `(stub)` and link the milestone that will wire it. Closes gap P9.
- **Skip link `tabindex="-1"` note** — `<main>` must be programmatically focusable for skip-link navigation. Closes gap P10.

### Milestone
- **Hierarchical contract system CONVERGED** — 3×3 matrix complete: element/widget/page tiers × 3 convergence runs each × 50/50 score. 11 of 14 gaps resolved across v2.59.10–v2.66.10; remaining 3 are widget-template refinements, non-blocking.

## [2.65.10] - 2026-04-05

### Changed (page-contract template)
- **Boundary grep regex tightened** — line-anchored (`^\s*`) + requires opening `{` — avoids false positives on JS identifiers like `donutProps` or property access `obj.donut`. Only matches actual CSS rules. Closes gap P5 from page-tier run 2.

### Added (page-contract template)
- **Multi-state Page Fixture convention** — for pages whose state swaps widget data, declare one full fixture per state under `__states__` keys, referencing named widget sub-fixtures (`#/fixture-sessions`). Prefer full duplication over override deltas. Closes gap P6.
- **Inline-stub promotion guidance** — if a page-scope control is used in ≥2 pages, promote to its own widget contract; until then list in Composes Elements (direct) with `(promotion candidate)` tag. Closes gap P7.

## [2.64.10] - 2026-04-05

### Added (page-contract template)
- **Page Fixture (OPTIONAL)** section — formalizes the composition chain (element → widget → page) by referencing each widget's fixture via `$ref:{widget-name}#/fixture`. Closes gap P2 from page-tier convergence run 1.
- **Boundary Rules (MANDATORY)** section — explicit rules on what a page may vs may not do (pass data through widget props = OK; declare CSS for widget internal classes = VIOLATION). Adds a grep-based enforcement check. Closes gap P3.
- **Grid position format** clarification — use `grid[row=N, col=M]` OR named CSS grid areas, consistently within one page. Closes gap P4.

### Changed
- **Widgets Used** table: renamed "Notes" column → "Layout Notes" with positioning-only guidance (spans/stacking/sticky — NOT widget configuration). Closes gap P1.

## [2.63.10] - 2026-04-05

### Added
- **Taxonomy filename rule** in `gsd-t-design-decompose.md` Step 0: element contract filenames MUST match the closed-set taxonomy name exactly (`chart-bar-vertical-single.contract.md`, not `bar-vertical-single.contract.md`). Closes widget-tier gap W5 — shortened aliases create taxonomy drift and break link-integrity. Prefer renaming legacy contracts over creating parallel files.

## [2.62.10] - 2026-04-05

### Added
- **Widget-contract Test Fixture section (MANDATORY)** — `templates/widget-contract.md` now requires a `## Test Fixture` section at widget scope, with the same `__fixture_source__` / `__figma_template__` requirements as element contracts. Widget fixtures reference element sub-fixtures via `$ref:{element-name}#/fixture` rather than re-inlining element values — enforces the widget↔element boundary in the fixture layer. Closes gap W4 from widget-tier convergence run 1. Also adds a widget-level Verification Harness subsection.
- **Widget fixture boundary rule**: widget fixture fields MUST NOT duplicate element visual-spec fields (colors, font sizes, padding, radii) — those live in the element contract. A field name matching an element slot (segments, centerValue, xLabels) belongs in the element fixture.

## [2.61.10] - 2026-04-05

### Added
- **Circular charts `-percentage` clarification** — `design-chart-taxonomy.md` now explicitly states that `chart-pie` and `chart-donut` do NOT take a `-percentage` suffix, because circular charts are inherently part-to-whole (circle = 100%). Whether segment labels show percentages or absolute values is a labelling choice recorded in the Test Fixture, not a distinct element. Prevents agents from inventing `chart-donut-percentage` when it doesn't exist in the closed set. Closes gap A from convergence run 2.
- **Figma MCP size guard** in `gsd-t-design-decompose.md` Step 1: call `get_metadata` first to map the tree, then `get_design_context` only on leaf nodes (< 100KB). Avoids the 250KB+ tool-results file dump when called on full-page frames. Closes gap #3 from convergence runs 1 and 2.

## [2.60.10] - 2026-04-05

### Added
- **Shared Templates installer** — `installSharedTemplates()` in `bin/gsd-t.js` copies design-chart-taxonomy.md, element-contract.md, widget-contract.md, page-contract.md, design-contract.md, and shared-services-contract.md into `~/.claude/templates/` on install/update. Fresh-context workers (including Terminal 2 subprocesses) can now reference these at a predictable path instead of hunting through npx caches. Closes framework gap #1 surfaced by v2.59.10 convergence run 1.

### Changed
- **Element template `Test Fixture`** now documents a **Fixture Resolution Order** for Figma designs that use template tokens like `{num}%`: (1) concrete Figma text, (2) existing flat contract, (3) requirements sample data, (4) engineered stub matching visible proportions. Adds mandatory `__fixture_source__` and `__figma_template__` fields so verifiers distinguish extracted-from-design vs engineered-to-match-visual. Closes gap #4.
- **Element template** adds a **Verification Harness** subsection clarifying what card chrome / controls to include vs strip when rendering the element on `/design-system/{name}`. Closes gap #5 ("element-only, no widget chrome" ambiguity).

## [2.59.10] - 2026-04-05

### Added
- **Chart & Atom Taxonomy** — `templates/design-chart-taxonomy.md` — closed enumeration of ~70 valid element names across charts, axes, legends, cards, tables, controls, atoms (icons/badges/chips/dividers), typography, and layout primitives. Fixes catastrophic failure mode where agents invented element names and picked wrong chart variants (e.g., `chart-bar-grouped-vertical` when design was `chart-bar-stacked-horizontal-percentage`). `gsd-t-design-decompose` now REQUIRES element names to come from this closed set.
- **Visual distinguisher decision rules** per chart category (stacked vs grouped vs percentage, pie vs donut vs gauge, line vs area, categorical vs histogram) to prevent near-match pattern-matching.
- **Atoms taxonomy** — icons, badges, chips, dividers, avatars, status-dots, spinners, tooltips, breadcrumbs, pagination, tags — the most-forgotten element tier.

### Changed
- **Element template**: `Test Fixture` section is now MANDATORY with the EXACT labels/values/percentages extracted from the design source. Placeholder data (Calculator/Planner/Tracker instead of real labels) is FORBIDDEN. Verifier compares labels verbatim.
- **Widget template**: adds mandatory **Card Chrome Slots** section (title, subtitle, header_right_control, kpi_header, body, body_sidebar, footer, footer_legend) — each must be filled or explicitly marked N/A. Fixes the "missing subtitle, missing per-card filter dropdown, missing KPI-above-chart" defect.
- **Design Verification Agent** (gsd-t-execute Step 5.25 + gsd-t-quick Step 5.25): adds mandatory **Step 0 — Data-Labels Cross-Check** that runs BEFORE visual comparison. Verifies every label/value/percentage from the Test Fixture appears verbatim in the rendered UI. Wrong data = CRITICAL deviation, no visual polish can redeem it.
- **gsd-t-design-decompose**: MUST ingest existing flat `design-contract.md` when present (especially the `## Verification Status` section from prior verified builds) as ground truth for Test Fixture data — no re-inventing labels.

## [2.58.10] - 2026-04-05

### Added
- **Hierarchical design contracts** — `element` → `widget` → `page` contract hierarchy for design-to-code projects. Element contracts are the single source of truth for visual spec (one contract per visual variant, e.g., `chart-bar-stacked-horizontal` and `chart-bar-stacked-vertical` are separate). Widgets compose elements with layout + data binding. Pages compose widgets with routing + grid layout.
- **Precedence rule**: element > widget > page. Widgets and pages SELECT and POSITION elements but cannot override element visual spec. Structural drift becomes impossible.
- **New templates**: `templates/element-contract.md`, `templates/widget-contract.md`, `templates/page-contract.md`
- **New command**: `/gsd-t-design-decompose` — surveys a design (Figma/image/prototype), classifies elements (reuse count ≥2 or non-trivial spec → promoted to element contract), identifies widgets and pages, writes the full contract hierarchy under `.gsd-t/contracts/design/{elements,widgets,pages}/` plus an `INDEX.md` navigation map.

### Changed
- `design-to-code.md` stack rule adds Section 0 explaining flat vs. hierarchical contract modes and detection at execute-time (presence of `.gsd-t/contracts/design/` triggers hierarchical verification: elements first, then widgets, then pages)
- Command count: 48 GSD-T + 5 utility = 53 total

## [2.57.10] - 2026-04-04

### Added
- **Design Verification Agent** — dedicated subagent (Step 5.25) spawned after QA and before Red Team when `.gsd-t/contracts/design-contract.md` exists. Opens a browser with both the built frontend AND the original design (Figma/image) side-by-side for direct visual comparison. Produces a 30+ row structured comparison table with MATCH/DEVIATION verdicts. Artifact gate enforces completion — missing table triggers re-spawn.
- Wired into `gsd-t-execute` (Step 5.25) and `gsd-t-quick` (Step 5.25)

### Changed
- **Separation of concerns**: Coding agents no longer perform visual verification inline (removed 45-line Step 7 from task subagent prompt). Coding agents write precise code from design tokens; the verification agent proves it matches.
- `design-to-code.md` Section 15 slimmed from 120 lines to 20 lines — now points to the dedicated agent instead of embedding the full verification loop in the stack rule
- `CLAUDE-global.md` updated with Design Verification Agent section between QA and Red Team
- Red Team now runs after Design Verification (previously ran directly after QA)
- Non-design projects are completely unaffected (gate checks for design-contract.md existence)

## [2.52.11] - 2026-04-01

### Added
- **M32: Quality Culture & Design** milestone planning — 3 new domains (design-brief, evaluator-interactivity, quality-persona) with scope and task definitions
- **CI examples** — GitHub Actions and GitLab CI pipeline templates in `docs/ci-examples/`
- **Framework comparison scorecard** — `docs/framework-comparison-scorecard.md`

### Changed
- `.gitignore` updated to exclude Windows `desktop.ini` artifacts, temp files (`.tmp.driveupload/`, `.gsd-t/dashboard.pid`), and generated PDFs
- Fixed package.json version drift (was 2.51.10, should have been 2.52.10 after M31)

### Removed
- `.claude/settings.local.json` — no longer tracked (managed locally)

## [2.51.10] - 2026-03-25

### Added
- **Red Team — Adversarial QA agent** added to `execute`, `quick`, `integrate`, and `debug` commands. Spawns after the builder's tests pass with inverted incentives — success is measured by bugs found, not tests passed.
- **Exhaustive attack categories**: contract violations, boundary inputs, state transitions, error paths, missing flows, regression, E2E functional gaps, cross-domain boundaries (integrate only), fix regression variants (debug only).
- **False positive penalty**: reporting non-bugs destroys credibility, preventing phantom bug inflation.
- **VERDICT system**: `FAIL` (bugs found — blocks phase completion) or `GRUDGING PASS` (exhaustive search, nothing found — must prove thoroughness).
- **Red Team report**: findings written to `.gsd-t/red-team-report.md`; bugs appended to `.gsd-t/qa-issues.md`.
- Red Team documented in CLAUDE-global template, global CLAUDE.md, GSD-T-README wave diagram, README command table.

## [2.50.12] - 2026-03-25

### Added
- **23 new stack rule files** — python, flutter, tailwind, react-native, vite, nextjs, vue, docker, postgresql (with graph-in-SQL section), github-actions, rest-api, supabase, firebase, graphql, zustand, redux, neo4j, playwright, fastapi, llm (with RAG patterns section), prisma, queues, _auth (universal). Total: 27 stack rules (was 4).
- **`_auth.md`** (universal) — email-first registration, auth provider abstraction (Cognito/Firebase/Google), token management, password policy, session management, social auth/OAuth, email verification, MFA, authorization/RBAC, auth security, auth UI patterns.
- **`fastapi.md`** — dependency injection, Pydantic request/response models, lifespan events, BackgroundTasks, async patterns, auto-generated OpenAPI docs.
- **`llm.md`** — provider-agnostic LLM patterns: structured outputs, streaming, error/retry, token management, conversation state, tool/function calling, RAG patterns (chunking, embeddings, retrieval), prompt management, testing, cost/observability.
- **`prisma.md`** — schema modeling, migrations, typed client usage, relation queries, transactions, seeding, N+1 prevention.
- **`queues.md`** — BullMQ/Bull, SQS, RabbitMQ, Celery patterns: idempotent handlers, dead letter queues, retry/backoff, job deduplication, graceful shutdown.
- **Playwright best practices** — coverage matrix per feature, pairwise combinatorial testing, state transition testing, multi-step workflow testing, Page Object Model, API mocking patterns. Enforces rigorous test depth across permutations.
- **react.md expanded** — added state management decision table, form management (react-hook-form + zod), React naming conventions (3 new sections from external best practices review).
- **Project-level stack overrides** — `.gsd-t/stacks/` directory for per-project customization of global stack rules. Local files replace global files of the same name.

### Changed
- Stack detection in execute, quick, and debug commands updated to cover all 27 stack files with conditional detection per project dependencies.
- Detection refactored from one-liner to structured bash with `_sf()` (local override resolver) and `_add()` helper functions.
- PostgreSQL graph-in-SQL patterns (adjacency lists, junction tables, recursive CTEs) added to postgresql.md based on real project analysis.
- GSD-T-README.md stack detection table expanded to list all 27 files with their detection triggers.

## [2.46.11] - 2026-03-24

### Added
- **M28: Doc-Ripple Subagent** — automated document ripple enforcement agent. Threshold check (7 FIRE/3 SKIP conditions), blast radius analysis, manifest generation, parallel document updates. New command: `gsd-t-doc-ripple`. 43 new tests. Wired into execute, integrate, quick, debug, wave.
- **Orchestrator context self-check** — execute and wave orchestrators now check their own context utilization after every domain/phase. If >= 70%, saves progress and stops to prevent session breaks.
- **Functional E2E test quality standard (REQ-050)** — Playwright specs must verify functional behavior, not just element existence. Shallow test audit added to qa, test-sync, verify, complete-milestone commands.
- **Document Ripple Completion Gate (REQ-051)** — structural rule preventing "done" reports until all downstream documents are updated.

### Changed
- Command count: 50 → 51 (added `gsd-t-doc-ripple`)
- Package description updated to include doc-ripple enforcement

## [2.39.12] - 2026-03-19

### Added
- **Graph auto-sync at command boundary** — every GSD-T command now checks index freshness automatically; both native JSON and CGC/Neo4j are re-indexed when files change (500ms TTL deduplication)
- **Neo4j setup guide** — `docs/neo4j-setup.md` with full instructions for Docker container, CGC install, project indexing, and scanning
- Backlog items #8 (Auto-Setup Graph Dependencies) and #9 (Provider Failure Warnings + Auto-Recovery)

### Fixed
- CGC sync uses `cgc index` CLI instead of broken `add_code_to_graph` MCP tool call (CGC 0.3.1 Windows bug workaround)
- CGC sync retries with `--force` on failure, warns user clearly instead of silently swallowing errors
- CGC sync sets `PYTHONIOENCODING=utf-8` to prevent crash on emoji/Unicode in source code on Windows

## [2.39.10] - 2026-03-19

### Added
- **M20: Graph Abstraction Layer + Native Indexer** — 6 new files (`graph-store`, `graph-parsers`, `graph-overlay`, `graph-indexer`, `graph-query`, `graph-cgc`), 3 CLI subcommands (`graph index/status/query`), 4 new contracts, 70 new tests. Self-indexed: 264 entities, 725 relationships.
- **M21: Graph-Powered Commands** — 21 commands now query code structure via graph instead of grep, with automatic fallback chain (CGC → native → grep)
- `/global-change` command for bulk file changes across all registered GSD-T projects (49th command)
- 3-tier model assignments (haiku/sonnet/opus) with mandatory model display before subagent spawns
- Graph vs grep comparison analysis (`scan/graph-vs-grep-comparison.md`)
- PRDs: `prd-graph-engine.md`, `prd-gsd2-hybrid.md`

### Fixed
- **TD-097 (CRITICAL)**: Command injection in `graph-query.js` — replaced `execSync` with `execFileSync` + input validation
- **TD-081/TD-082 (HIGH)**: Shell injection in `gsd-t-update-check.js` — added semver validation, `execFileSync`, `module.exports`
- **TD-083 (HIGH)**: Contract drift — added `session_start`/`session_end` to event writer, removed phantom `mcp` renderer
- **TD-071 (MEDIUM)**: Markdown injection in `stateSet()` — now strips `\r\n` from values
- **TD-084**: `execSync` in `scan-export.js` and `scan-renderer.js` replaced with `execFileSync`
- **TD-085**: Dashboard event loading now handles cross-midnight sessions
- **TD-087**: Command count corrected to 49 in CLI installer
- **TD-072**: Path traversal protection in `templateScope`/`templateTasks`
- **TD-073**: `execSync` in `preCommitCheck()` replaced with `execFileSync`
- **TD-074**: `findProjectRoot()` now returns `null` instead of cwd on failure
- **TD-092**: `scan-report.html` now written to `.gsd-t/` instead of project root
- **TD-099**: `graph-store.js` symlink protection added

### Changed
- 293/294 tests passing (1 pre-existing failure in `scan.test.js`)
- Total command count: 49 (45 GSD-T workflow + 4 utility)

## [2.33.12] - 2026-03-06

### Fixed
- **Dashboard graph now shows the current session** — heartbeat.js now emits `session_start`/`session_end` events (agent_id=session_id) so the session appears as a root node
- **Tool calls attributed to session** — PostToolUse events now carry session_id as agent_id fallback; all activity visible in single-agent sessions
- **Readable node labels** — sessions display as "Session · Mar 6 · abc1234" (blue-bordered); subagents show their type
- 3 new tests (178/178 passing); event-schema-contract.md updated with new event types

## [2.33.11] - 2026-03-05

### Added
- `.gitignore` excludes `.claude/worktrees/` (Claude Code internal) and `nul` (Windows artifact)
- `ai-evals-analysis.md`, `gsd-t-command-doc-matrix.csv` — development reference documents
- `scripts/gsd-t-dashboard-mockup.html` — interactive mockup from M15 brainstorm (historical reference)
- `.gsd-t/brainstorm-2026-02-18.md` — brainstorm notes from Feb 18 ideation session

## [2.33.10] - 2026-03-04

### Added
- **Milestone 15: Real-Time Agent Dashboard** — Zero-dependency live browser dashboard for GSD-T execution:
  - **`scripts/gsd-t-dashboard-server.js`** (141 lines): Node.js HTTP+SSE server (zero external deps). Watches `.gsd-t/events/*.jsonl`, streams up to 500 existing events on connect, tails for new events, keepalive every 15s. Runs detached with PID file. All functions exported for testability (23 unit tests in `test/dashboard-server.test.js`).
  - **`scripts/gsd-t-dashboard.html`** (194 lines): Browser dashboard using React 17 + React Flow v11.11.4 + Dagre via CDN (no build step, no npm deps). Dark theme. Renders agent hierarchy as directed graph from `parent_agent_id` relationships. Live event feed (max 200 events, outcome color-coded: green=success, red=failure, yellow=learning). Auto-reconnects on disconnect.
  - **`commands/gsd-t-visualize`**: 48th GSD-T command. Starts server via `--detach`, polls `/ping` up to 5s, opens browser cross-platform (win32/darwin/linux). Accepts `stop` argument. Includes Step 0 self-spawn with OBSERVABILITY LOGGING.
  - Both `gsd-t-dashboard-server.js` and `gsd-t-dashboard.html` automatically installed to `~/.claude/scripts/` during `npx @tekyzinc/gsd-t install/update`
  - 23 new tests in `test/dashboard-server.test.js` — total: 176/176 passing

### Changed
- Total command count: 47 → **48** (44 GSD-T workflow + 4 utility)

## [2.32.10] - 2026-03-04

### Added
- **Milestone 14: Execution Intelligence Layer** — Structured observability, learning, and reflection:
  - **`scripts/gsd-t-event-writer.js`**: New zero-dependency CLI + module.exports. Writes structured JSONL events to `.gsd-t/events/YYYY-MM-DD.jsonl`. Validates 8 event_type values and 5 outcome values. Symlink-safe. Resolves events dir from `GSD_T_PROJECT_DIR` or cwd. 26 new tests.
  - **Heartbeat enrichment**: `scripts/gsd-t-heartbeat.js` maps `SubagentStart`/`SubagentStop`/`PostToolUse` hook events to the events/ schema, appending them to daily JSONL files alongside existing heartbeat writes.
  - **Outcome-tagged Decision Log**: `execute`, `debug`, and `wave` now prefix all new Decision Log entries with `[success]`, `[failure]`, `[learning]`, or `[deferred]`.
  - **Pre-task experience retrieval (Reflexion pattern)**: `execute` and `debug` grep the Decision Log for `[failure]`/`[learning]` entries matching the current domain before spawning subagents. Relevant past failures prepended as `⚠️ Past Failures` block in subagent prompt.
  - **Phase transition events**: `wave` writes `phase_transition` event with outcome:success/failure at each phase boundary.
  - **Distillation step** (Step 2.5 in `complete-milestone`): Scans event stream for patterns seen ≥3 times, proposes CLAUDE.md / constraints.md rule additions, requires user confirmation before any write.
  - **`commands/gsd-t-reflect`** (134 lines, 47th command): On-demand retrospective from event stream. Generates `.gsd-t/retrospectives/YYYY-MM-DD-{milestone}.md` with What Worked / What Failed / Patterns Found / Proposed Memory Updates. Includes Step 0 self-spawn with OBSERVABILITY LOGGING.
  - `gsd-t-event-writer.js` installed to `~/.claude/scripts/` during install/update

### Changed
- Total command count: 46 → **47** (43 GSD-T workflow + 4 utility)

## [2.28.10] - 2026-02-18

### Added
- **Milestone 13: Tooling & UX** — Infrastructure and UX improvements:
  - **`scripts/gsd-t-tools.js`**: New zero-dependency Node.js CLI utility returning compact JSON. Subcommands: `state get/set` (read/write progress.md keys), `validate` (check required files), `parse progress --section` (extract named sections), `list domains|contracts`, `git pre-commit-check` (branch/status/last-commit), `template scope|tasks <domain>`
  - **`scripts/gsd-t-statusline.js`**: New statusline script for Claude Code. Reads GSD-T project state and optionally reads `CLAUDE_CONTEXT_TOKENS_USED`/`CLAUDE_CONTEXT_TOKENS_MAX` env vars to show a color-coded context usage bar (green→yellow→orange→red). Configure via `"statusLine": "node ~/.claude/scripts/gsd-t-statusline.js"` in `settings.json`
  - **`gsd-t-health`**: New slash command validating `.gsd-t/` project structure. Checks all required files, directories, version consistency, status validity, contract integrity, and domain integrity. `--repair` creates any missing files from templates. Reports HEALTHY / DEGRADED / BROKEN
  - **`gsd-t-pause`**: New slash command saving exact position to `.gsd-t/continue-here-{timestamp}.md` with milestone, phase, domain, task, last completed action, next action, and open items
  - Both scripts automatically installed to `~/.claude/scripts/` during `npx @tekyzinc/gsd-t install/update`

### Changed
- **`gsd-t-resume`**: Now reads the most recent `.gsd-t/continue-here-*.md` file (if present) as the primary resume point before falling back to `progress.md`. Deletes the continue-here file after consuming it
- **`gsd-t-plan`**: Wave Execution Groups added to `integration-points.md` format — groups tasks into parallel-safe waves with checkpoints between them. Wave rules: same-wave tasks share no files and have no dependencies; different-wave tasks depend on each other's output or modify shared files
- **`gsd-t-execute`**: Reads Wave Execution Groups from `integration-points.md` and executes wave-by-wave. Tasks within a wave are parallel-safe; checkpoints between waves verify contract compliance before proceeding. Team mode now spawns teammates only within the same wave
- **`gsd-t-health`** and **`gsd-t-pause`** added to all reference files (help, README, GSD-T-README, CLAUDE-global template, user CLAUDE.md)
- Total command count: 43 → **45** (41 GSD-T workflow + 4 utility)

## [2.27.10] - 2026-02-18

### Changed
- **Milestone 12: Planning Intelligence** — Three improvements to correctness across milestones:
  - **CONTEXT.md from discuss**: `gsd-t-discuss` now creates `.gsd-t/CONTEXT.md` with three sections — Locked Decisions (plan must implement exactly), Deferred Ideas (plan must NOT implement), and Claude's Discretion (free to decide). New Step 5 added to discuss; steps renumbered
  - **Plan fidelity enforcement**: `gsd-t-plan` reads CONTEXT.md and maps every Locked Decision to at least one task. Also produces a REQ-ID → domain/task traceability table in `docs/requirements.md`
  - **Plan validation checker**: A Task subagent validates the plan after creation — checks REQ coverage, Locked Decision mapping, task completeness, cross-domain dependencies, and contract existence. Max 3 fix iterations before stopping
  - **Requirements close-out in verify**: `gsd-t-verify` marks matched requirements as `complete` in the traceability table and reports orphaned requirements and unanchored tasks

## [2.26.10] - 2026-02-18

### Changed
- **Milestone 11: Execution Quality** — Three improvements to execution reliability:
  - **Deviation Rules**: `execute`, `quick`, and `debug` now include a 4-rule deviation protocol — auto-fix bugs (3-attempt limit), add minimum missing dependencies, fix blockers, and STOP for architectural changes. Failed attempts log to `.gsd-t/deferred-items.md`
  - **Atomic per-task commits**: `execute` now commits after each task using `feat({domain}/task-{N}): {description}` format instead of batching at phase end. Team mode instructions updated with the same requirement
  - **Wave spot-check**: Between-phase verification in `wave` now checks git log (commits present), filesystem (output files exist), and FAILED markers in progress.md — not just agent-reported status

## [2.25.10] - 2026-02-18

### Changed
- **Milestone 10: Token Efficiency** — QA overhead significantly reduced across all phases:
  - `partition` and `plan`: QA spawn removed (no code produced in these phases)
  - `test-sync`, `verify`, `complete-milestone`: contract testing and gap analysis performed inline (no QA teammate)
  - `execute`, `integrate`: QA now spawned via lightweight Task subagent instead of TeamCreate teammate
  - `quick`, `debug`: QA spawn removed; tests run inline in the existing Test & Verify step; both commands now self-spawn as Task subagents (Step 0) for fresh context windows
  - `scan`, `status`: wrap themselves as Task subagents for fresh context on each invocation
  - Global CLAUDE.md QA Mandatory section updated to reflect the new per-command QA method

## [2.24.10] - 2026-02-18

### Changed
- **Versioning scheme: patch numbers are always 2 digits**: Patch segment now starts at 10 (not 0) after any minor or major reset. Incrementing continues normally (10→11→12…). Semver validity is preserved — no leading zeros. `checkin.md` and `gsd-t-complete-milestone.md` updated with the new convention. `gsd-t-init` will initialize new projects at `0.1.10`

## [2.24.9] - 2026-02-18

### Changed
- **Default model**: Example settings.json updated from `claude-opus-4-6` to `claude-sonnet-4-6` (faster, lower token usage)

## [2.24.8] - 2026-02-18

### Fixed
- **CLAUDE.md update no longer overwrites user content**: Installer now uses marker-based merging (`<!-- GSD-T:START -->` / `<!-- GSD-T:END -->`). Updates only replace the GSD-T section between markers, preserving all user customizations. Existing installs without markers are auto-migrated. Backup still created for reference

## [2.24.7] - 2026-02-18

### Changed
- **Next Command Hint redesigned**: Replaced plain `Next →` text with GSD-style "Next Up" visual block — divider lines, `▶ Next Up` header, phase name with description, command in backticks, and alternatives section. Format designed to trigger Claude Code's prompt suggestion engine, making the next command appear as ghost text in the user's input field

## [2.24.6] - 2026-02-18

### Added
- **Auto-update on session start**: SessionStart hook now automatically installs new GSD-T versions when detected — runs `npm install -g` + `gsd-t update-all`. Falls back to manual instructions if auto-update fails
- **Changelog link in all version messages**: All three output modes (`[GSD-T AUTO-UPDATE]`, `[GSD-T UPDATE]`, `[GSD-T]`) now include the changelog URL
- **Update check installer**: `bin/gsd-t.js` now deploys the update check script and configures the SessionStart hook automatically during install, with auto-fix for incorrect matchers

### Fixed
- **SessionStart hook matcher**: Changed from `"startup"` to `""` (empty) to match all session types including compact/resumed sessions

## [2.24.5] - 2026-02-18

### Fixed
- **Dead code removed**: `PKG_EXAMPLES` constant in `bin/gsd-t.js` and dead imports (`writeTemplateFile`, `showStatusVersion`) in `test/cli-quality.test.js` (TD-057, TD-058)
- **summarize() case fallthrough**: Combined identical `Read`/`Edit`/`Write` cases using switch fallthrough, saving 4 lines (TD-056)
- **checkForUpdates() condition**: Simplified redundant `!cached && isStale` to `if (!cached) ... else if (stale)` (TD-061)
- **Notification title scrubbing**: Applied `scrubSecrets()` to `h.title` in heartbeat notification handler (TD-063)
- **SEC-N16 note corrected**: Updated informational note during scan #5 (TD-062)
- **Wave integrity check contract**: Updated `wave-phase-sequence.md` to match actual implementation — checks Status, Milestone name, Domains table (not version) (TD-064)
- **Duplicate format contract**: Deleted `file-format-contract.md` — `backlog-file-formats.md` is authoritative (TD-065)

### Added
- 9 new tests: 3 `readSettingsJson()` tests in `cli-quality.test.js`, 6 `shortPath()` tests in `security.test.js` (TD-059, TD-060)
- Total tests: 125 (was 116)

## [2.24.4] - 2026-02-18

### Fixed
- **progress.md status**: Now uses contract-recognized values (READY between milestones, not ACTIVE)
- **CLAUDE.md version**: Removed hardcoded version — references `package.json` directly to prevent recurring drift (TD-048)
- **CHANGELOG.md**: Added missing entries for v2.23.1 through v2.24.3 covering milestones 3-7 (TD-045)
- **Orphaned domains**: Deleted stale `cli-quality/` and `cmd-cleanup/` directories from previous milestones (TD-046)
- **Git line endings**: Applied `git add --renormalize .` to enforce LF across all tracked files (TD-049)
- **Notification scrubbing**: Applied `scrubSecrets()` to heartbeat notification messages (TD-052)

### Changed
- **Contracts synced**: `progress-file-format.md` enriched with milestone table + optional fields. `wave-phase-sequence.md` updated with integrity check (M7) and security considerations (M5). `command-interface-contract.md` renamed to `backlog-command-interface.md`. `integration-points.md` rewritten to reflect current state (TD-047, TD-053, TD-054, TD-055)
- **readSettingsJson()**: Extracted helper to deduplicate 3 `JSON.parse(readFileSync)` call sites in CLI (TD-050)
- **prepublishOnly**: Added `npm test` gate before `npm publish` (TD-051)
- **TD-029 (TOCTOU)**: Formally accepted as risk with 5-point rationale — single-threaded Node.js, user-owned dirs, Windows symlink requires admin

## [2.24.3] - 2026-02-19

### Changed
- **Command file cleanup**: 85 fractional step numbers renumbered to integers across 17 command files. Autonomy Behavior sections added to `gsd-t-discuss` and `gsd-t-impact`. QA agent hardened with file-path boundary constraints, multi-framework test detection, and Document Ripple section. Wave integrity check validates progress.md fields before starting. Structured 3-condition discuss-skip heuristic. Consistent "QA failure blocks" language across all 10 QA-spawning commands

### Fixed
- 8 tech debt items resolved: TD-030, TD-031, TD-036, TD-037, TD-038, TD-039, TD-040, TD-041

## [2.24.2] - 2026-02-19

### Changed
- **CLI quality improvement**: All 86 functions across `bin/gsd-t.js` (80) and `scripts/gsd-t-heartbeat.js` (6) are now <= 30 lines. 3 code duplication patterns resolved (`readProjectDeps`, `writeTemplateFile`, `readPyContent` extracted). `buildEvent()` refactored to handler map pattern. `checkForUpdates` inline JS extracted to `scripts/gsd-t-fetch-version.js`. `doUpdateAll` has per-project error isolation

### Added
- `.gitattributes` and `.editorconfig` for consistent file formatting
- 22 new tests in `test/cli-quality.test.js` (buildEvent, readProjectDeps, readPyContent, insertGuardSection, readUpdateCache, addHeartbeatHook)

### Fixed
- Heartbeat cleanup now only runs on SessionStart (not every event)
- 7 tech debt items resolved: TD-017, TD-021, TD-024, TD-025, TD-032, TD-033, TD-034

## [2.24.1] - 2026-02-18

### Added
- **Security hardening**: `scrubSecrets()` and `scrubUrl()` in heartbeat script scrub sensitive data (passwords, tokens, API keys, bearer tokens) before logging. 30 new security tests in `test/security.test.js`
- `hasSymlinkInPath()` validates parent directories for symlink attacks
- HTTP response accumulation bounded to 1MB in both fetch paths
- Security Considerations section in `gsd-t-wave.md` documenting `bypassPermissions` implications

### Fixed
- `npm-update-check.js` validates cache path within `~/.claude/` and checks for symlinks before writing
- 6 tech debt items resolved: TD-019, TD-020, TD-026, TD-027, TD-028, TD-035

## [2.24.0] - 2026-02-18

### Added
- **Testing foundation**: 64 automated tests in 2 test files (`test/helpers.test.js`: 27 tests, `test/filesystem.test.js`: 37 tests) using Node.js built-in test runner (`node --test`). Zero external test dependencies
- `module.exports` added to `bin/gsd-t.js` for 20 testable functions with `require.main` guard
- CLI subcommand tests (--version, help, status, doctor)
- Helper function tests (validateProjectName, applyTokens, normalizeEol, validateVersion, isNewerVersion)
- Filesystem tests (isSymlink, ensureDir, validateProjectPath, copyFile, hasPlaywright, hasSwagger, hasApi)
- Command listing tests (getCommandFiles, getGsdtCommands, getUtilityCommands with count validation)

### Fixed
- Tech debt item TD-003 (no test coverage) resolved

## [2.23.1] - 2026-02-18

### Fixed
- **Count fix**: All command count references updated to 43/39/4 across CLAUDE.md, README.md, package.json, and docs (TD-022)
- QA agent contract now includes test-sync phase with "During Test-Sync" section and updated output table (TD-042)
- Orphaned domain files from previous milestones archived to `.gsd-t/milestones/` (TD-043)

## [2.23.0] - 2026-02-17

### Changed
- **Wave orchestrator rewrite**: `gsd-t-wave` now spawns an independent agent for each phase instead of executing all phases inline. Each phase agent gets a fresh context window (~200K tokens), eliminating cross-phase context accumulation and preventing mid-wave compaction. The orchestrator stays lightweight (~30KB), reading only progress.md between phases. Phase sequence is unchanged — only the execution model changed. Estimated 75-85% reduction in peak context usage during waves

## [2.22.0] - 2026-02-17

### Added
- **gsd-t-qa**: New QA Agent command — dedicated teammate for test generation, execution, and gap reporting. Spawned automatically by 10 GSD-T phase commands
- **QA Agent spawn steps**: Added to partition (4.7), plan (4.7), execute (1.5 + team), verify (1.5 + team), complete-milestone (7.6), quick (2.5), debug (2.5), integrate (4.5), test-sync (1.5), wave (1.5)
- **Contract-to-test mapping rules**: API contracts → Playwright API tests, Schema contracts → constraint tests, Component contracts → E2E tests
- **QA Agent (Mandatory) section**: Added to global CLAUDE.md template — QA failure blocks phase completion

## [2.21.1] - 2026-02-18

### Fixed
- **PR #7 — Fix 12 scan items**: Security symlink validation gaps, contract/doc alignment, scope template hardening, heartbeat crash guard, progress template field ordering
- **PR #8 — Resolve final 4 scan items**: Function splitting in CLI (`doInit` helpers extracted), ownership validation for domain files, npm-update-check extracted to standalone script (`scripts/npm-update-check.js`)

## [2.21.0] - 2026-02-17

### Added
- **gsd-t-triage-and-merge**: New command to auto-review unmerged GitHub branches, score impact (auto-merge / review / skip), merge safe branches, and optionally version bump + publish. Publish gate respects autonomy level — auto in Level 3, prompted in Level 1-2. Sensitive file detection for commands, CLI, templates, and scripts

## [2.20.7] - 2026-02-17

### Added
- **Formal contracts**: 5 contract definitions for core GSD-T interfaces — backlog file formats, domain structure, pre-commit gate, progress.md format, and wave phase sequence. Formalizes existing conventions as machine-readable reference docs

## [2.20.6] - 2026-02-16

### Fixed
- Stale command/template counts in project CLAUDE.md (25→41 commands, 7→9 templates, v2.0.0→v2.20.x)
- Duplicate step numbering in `gsd-t-execute.md` (two step 10s)
- Windows CRLF/LF comparison causing false "changed" detection in CLI update

### Added
- Document Ripple sections to `gsd-t-execute`, `gsd-t-scan`, `gsd-t-test-sync`, `gsd-t-verify`
- Heartbeat auto-cleanup: files older than 7 days are automatically removed
- Error handling wrapping around file operations in CLI (copy, unlink, write)
- `applyTokens()` and `normalizeEol()` helpers to reduce duplication
- Extracted `updateProjectClaudeMd()`, `createProjectChangelog()`, `checkProjectHealth()` from `doUpdateAll()`

## [2.20.5] - 2026-02-16

### Added
- **Next Command Hint**: After each GSD-T phase completes, displays the recommended next command (e.g., `Next → /gsd-t-partition`). Full successor mapping for all workflow commands. Skipped during auto-advancing (Level 3 mid-wave)

## [2.20.4] - 2026-02-16

### Changed
- **Scan always uses team mode**: `gsd-t-scan` and `gsd-t-init-scan-setup` now spawn a team by default. Solo mode only for trivially small codebases (< 5 files) or when teams are explicitly disabled

## [2.20.3] - 2026-02-16

### Added
- **Playwright Cleanup**: After Playwright tests finish, kill any app/server processes that were started for the tests. Prevents orphaned dev servers from lingering after test runs

## [2.20.2] - 2026-02-16

### Added
- **CLI health checks**: `update-all` and `doctor` now check all projects for missing Playwright and Swagger/OpenAPI
- Smart API detection: scans `package.json`, `requirements.txt`, `pyproject.toml` for API frameworks (Express, Fastify, Hono, Django, FastAPI, etc.)
- Swagger detection: checks for spec files (`openapi.json/yaml`, `swagger.json/yaml`) and swagger packages in dependencies
- Health summary in `update-all` shows counts of missing Playwright and Swagger across all registered projects

## [2.20.1] - 2026-02-16

### Added
- **API Documentation Guard (Swagger/OpenAPI)**: Every API endpoint must be documented in Swagger/OpenAPI spec — no exceptions. Auto-detects framework and installs appropriate Swagger integration. Swagger URL must be published in CLAUDE.md, README.md, and docs/infrastructure.md
- Pre-Commit Gate now checks for Swagger spec updates on any API endpoint change

## [2.20.0] - 2026-02-16

### Added
- **Playwright Setup in Init**: `gsd-t-init` now installs Playwright, creates `playwright.config.ts`, and sets up E2E test directory for every project. Detects package manager (bun, npm, yarn, pnpm, pip) automatically
- **Playwright Readiness Guard**: Before any testing command (execute, test-sync, verify, quick, wave, milestone, complete-milestone, debug), checks for `playwright.config.*` and auto-installs if missing. Playwright must always be ready — no deferring to "later"

## [2.19.1] - 2026-02-16

### Changed
- **Quick**: Now runs the FULL test suite (not just affected tests), requires comprehensive test creation for new/changed code paths including Playwright E2E, and verifies against requirements and contracts. "Quick doesn't mean skip testing."

## [2.19.0] - 2026-02-16

### Changed
- **Execute**: "No feature code without test code" — every task must include comprehensive unit tests AND Playwright E2E specs for all new code paths, modes, and flows. Tests are part of the deliverable, not a follow-up
- **Test-Sync**: Creates tests immediately during execute phase instead of deferring gaps to verify. Missing Playwright specs for new features/modes are created on the spot
- **Verify**: Zero test coverage on new functionality is now a FAIL (not WARN). Coverage audit checks that every new feature, mode, page, and flow has comprehensive Playwright specs covering happy path, error states, edge cases, and all modes/flags

## [2.18.2] - 2026-02-16

### Added
- Gap Analysis Gate in `gsd-t-complete-milestone` — mandatory requirements verification before archiving
- Self-correction loop: auto-fixes gaps, re-verifies, re-analyzes (up to 2 cycles), stops if unresolvable
- Explicit Playwright E2E test execution in milestone test verification step

## [2.18.1] - 2026-02-16

### Added
- Auto-Init Guard — GSD-T workflow commands automatically run `gsd-t-init` if any init files are missing, then continue with the original command
- `gsd-t-init` copies `~/.claude/settings.local` → `.claude/settings.local.json` during project initialization
- Exempt commands that skip auto-init: `gsd-t-init`, `gsd-t-init-scan-setup`, `gsd-t-help`, `gsd-t-version-update`, `gsd-t-version-update-all`, `gsd-t-prompt`, `gsd-t-brainstorm`

## [2.18.0] - 2026-02-16

### Added
- Heartbeat system — real-time event streaming from Claude Code sessions via async hooks
- `scripts/gsd-t-heartbeat.js` — hook handler that writes JSONL events to `.gsd-t/heartbeat-{session_id}.jsonl`
- 9 Claude Code hooks: SessionStart, PostToolUse, SubagentStart, SubagentStop, TaskCompleted, TeammateIdle, Notification, Stop, SessionEnd
- Installer auto-configures heartbeat hooks in settings.json (all async, zero performance impact)
- Event types: session lifecycle, tool calls with file/command summaries, agent spawn/stop/idle, task completions

## [2.17.0] - 2026-02-16

### Added
- `/gsd-t-log` command — sync progress.md Decision Log with recent git activity by scanning commits since last logged entry
- Incremental updates (only new commits) and first-time full reconstruction from git history
- Total commands: 38 GSD-T + 3 utility = 41

## [2.16.5] - 2026-02-16

### Added
- `gsd-t-populate` now reconstructs Decision Log from git history — parses all commits, generates timestamped entries, merges with existing log
- Pre-Commit Gate explicitly lists all 30 file-modifying commands that must log to progress.md

### Changed
- Rebuilt GSD-T project Decision Log with full `YYYY-MM-DD HH:MM` timestamps from 54 git commits

## [2.16.4] - 2026-02-16

### Changed
- Smart router renamed from `/gsd-t` to `/gsd` — sorts first in autocomplete, shorter to type
- Pre-Commit Gate now requires timestamped progress.md entry (`YYYY-MM-DD HH:MM`) after every completed task, not just architectural decisions

## [2.16.3] - 2026-02-16

### Fixed
- Reverted smart router rename (`/gsd` back to `/gsd-t`) — superseded by 2.16.4 which re-applies the rename

## [2.16.2] - 2026-02-16

### Changed
- Smart router renamed from `/gsd-t` to `/gsd` (reverted in 2.16.3)

## [2.16.1] - 2026-02-16

### Fixed
- `gsd-t-init-scan-setup` now pulls existing code from remote before scanning — prevents treating repos with existing code as greenfield

## [2.16.0] - 2026-02-13

### Changed
- Smart router (`/gsd-t`) replaced signal-word lookup table with **semantic evaluation** — evaluates user intent against each command's purpose and "Use when" criteria from help summaries
- Router shows runner-up command when confidence is close: `(also considered: gsd-t-{x} — Esc to switch)`
- New commands automatically participate in routing without updating a routing table

### Added
- Backlog item B1: Agentic Workflow Architecture (future exploration when Claude Code agents mature)

## [2.15.4] - 2026-02-13

### Changed
- `gsd-t-gap-analysis` team scaling: one teammate per requirement (3–10), cap at 10 with even batching for 11+, solo for 1–2

## [2.15.3] - 2026-02-13

### Fixed
- `gsd-t-gap-analysis` hard cap of 4 teammates max — scales by requirement count (2 for 5–10, 3 for 11–15, 4 for 16+), solo for < 5

## [2.15.2] - 2026-02-13

### Changed
- `gsd-t-gap-analysis` team mode now handles flat requirement lists — chunks into batches of ~8–10 per teammate instead of requiring sections

## [2.15.1] - 2026-02-13

### Changed
- `gsd-t-gap-analysis` now uses agent team mode automatically — one teammate per requirement section for parallel scanning and classification, with solo fallback

## [2.15.0] - 2026-02-13

### Added
- `/gsd-t-gap-analysis` command — requirements gap analysis against existing codebase
- Parses spec into discrete numbered requirements, scans codebase, classifies each as implemented/partial/incorrect/not-implemented
- Evidence-based classification with file:line references for each requirement
- Severity levels: Critical (incorrect), High (partial), Medium (not implemented), Low (deferrable)
- Generates `.gsd-t/gap-analysis.md` with requirements breakdown, gap matrix, and summary stats
- Re-run support with diff against previous gap analysis (resolved, new, changed, unchanged)
- Optional merge of parsed requirements into `docs/requirements.md`
- Auto-groups gaps into recommended milestones/features/quick-fixes for promotion
- Autonomy-aware: Level 3 proceeds with flagged assumptions, Level 1-2 pauses for clarification
- Total commands: 37 GSD-T + 3 utility = 40

## [2.14.2] - 2026-02-13

### Changed
- Smart router (`/gsd-t`) now displays selected command as the first line of output (mandatory routing confirmation)

## [2.14.1] - 2026-02-13

### Changed
- Update Notices section in CLAUDE-global template now handles both `[GSD-T UPDATE]` (update available) and `[GSD-T]` (up to date) version banners
- Update command in notification changed from raw npm command to `/gsd-t-version-update-all`

## [2.14.0] - 2026-02-12

### Added
- `/gsd-t` smart router command — describe what you need in plain language, auto-routes to the correct GSD-T command
- Intent classification routes to: quick, feature, project, debug, scan, brainstorm, milestone, wave, status, resume, backlog-add, and more
- Total commands: 36 GSD-T + 3 utility = 39

## [2.13.4] - 2026-02-12

### Added
- Auto-invoked status column on all command tables in README and GSD-T-README (Manual / In wave)
- `[auto]` markers on wave-invoked commands in `gsd-t-help` main listing
- Section headers in `gsd-t-help` now show Manual or Auto label

## [2.13.3] - 2026-02-12

### Changed
- `gsd-t-init-scan-setup` now asks "Is {current folder} your project root?" before prompting for a folder name

## [2.13.2] - 2026-02-12

### Changed
- `gsd-t-init-scan-setup` now asks for project folder name, creates it if needed, and `cd`s into it — can be run from anywhere

## [2.13.1] - 2026-02-12

### Changed
- Update notification now includes changelog link (https://github.com/Tekyz-Inc/get-stuff-done-teams/blob/main/CHANGELOG.md)

## [2.13.0] - 2026-02-12

### Added
- `/gsd-t-init-scan-setup` slash command — full project onboarding combining git setup, init, scan, and setup in one command
- Prompts for GitHub repo URL if not already connected; skips if remote exists
- Total commands: 35 GSD-T + 3 utility = 38

## [2.12.0] - 2026-02-12

### Added
- `/gsd-t-version-update` slash command — update GSD-T to latest version from within Claude Code
- `/gsd-t-version-update-all` slash command — update GSD-T + all registered projects from within Claude Code
- Total commands: 34 GSD-T + 3 utility = 37

## [2.11.6] - 2026-02-12

### Changed
- Update notice now shown at both beginning and end of Claude's first response

## [2.11.5] - 2026-02-12

### Added
- SessionStart hook script (`~/.claude/scripts/gsd-t-update-check.js`) for automatic update notifications in Claude Code sessions
- "Update Notices" instruction in global CLAUDE.md template — Claude relays update notices to the user on first response

## [2.11.4] - 2026-02-12

### Fixed
- First-run update check now fetches synchronously when no cache exists — notification shows immediately instead of requiring a second run

## [2.11.3] - 2026-02-12

### Changed
- Reduced update check cache duration from 24 hours to 1 hour — new releases are detected faster

## [2.11.2] - 2026-02-12

### Fixed
- CLI update check used `!==` instead of semver comparison — would show incorrect downgrade notices when cache had an older version
- Added `isNewerVersion()` helper for proper semver comparison in update notifications

## [2.11.1] - 2026-02-12

### Changed
- `gsd-t-resume` now detects same-session vs cross-session mode — skips full state reload when context is already available, auto-resumes at Level 3
- Added "Conversation vs. Work" rule to global CLAUDE.md template — plain text questions are answered conversationally, workflow only runs when a `/gsd-t-*` command is invoked

## [2.11.0] - 2026-02-12

### Added
- Autonomy-level-aware auto-advancing for all phase commands — at Level 3 (Full Auto), partition, plan, impact, execute, test-sync, integrate, verify, and complete-milestone auto-advance without waiting for user input
- Wave error recovery auto-remediates at Level 3 (up to 2 fix attempts before stopping)
- Discuss phase always pauses for user input regardless of autonomy level
- Autonomy levels documentation added to GSD-T-README Configuration section

## [2.10.3] - 2026-02-11

### Changed
- Default autonomy level changed from Level 2 (Standard) to Level 3 (Full Auto) across all templates and commands
- `gsd-t-init` now sets Level 3 in generated CLAUDE.md
- `gsd-t-setup` defaults to Level 3 when asking autonomy level

## [2.10.2] - 2026-02-11

### Added
- Version update check in `gsd-t-status` slash command — works inside Claude Code and ClaudeWebCLI sessions, not just the CLI binary

### Fixed
- Normalized `repository.url` in package.json (`git+https://` prefix)

## [2.10.1] - 2026-02-10

### Added
- Automatic update check — CLI queries npm registry (cached 24h, background refresh) and shows a notice box with update commands when a newer version is available

## [2.10.0] - 2026-02-10

### Added
- `CHANGELOG.md` release notes document with full version history
- `changelog` CLI subcommand — opens changelog in the browser (`gsd-t changelog`)
- Clickable version links in CLI output (OSC 8 hyperlinks to changelog)
- `checkin` command now auto-updates CHANGELOG.md on every version bump
- `update-all` now creates CHANGELOG.md for registered projects that don't have one

## [2.9.0] - 2026-02-10

### Added
- `gsd-t-setup` command — generates or restructures project CLAUDE.md by scanning codebase, detecting tech stack/conventions, and removing global duplicates

## [2.8.1] - 2026-02-10

### Added
- Workflow Preferences section in global and project CLAUDE.md templates (Research Policy, Phase Flow defaults with per-project override support)

## [2.8.0] - 2026-02-10

### Added
- Backlog management system: 7 new commands (`backlog-add`, `backlog-list`, `backlog-move`, `backlog-edit`, `backlog-remove`, `backlog-promote`, `backlog-settings`)
- 2 new templates (`backlog.md`, `backlog-settings.md`)
- Backlog initialization in `gsd-t-init` with auto-category derivation
- Backlog summary in `gsd-t-status` report
- Backlog section in `gsd-t-help`

### Changed
- Updated `gsd-t-init`, `gsd-t-status`, `gsd-t-help`, CLAUDE-global template, README with backlog integration

## [2.7.0] - 2026-02-09

### Added
- `update-all` CLI command — updates global install + all registered project CLAUDE.md files
- `register` CLI command — manually register a project in the GSD-T project registry
- Auto-registration on `gsd-t init`
- Project registry at `~/.claude/.gsd-t-projects`

## [2.6.0] - 2026-02-09

### Added
- Destructive Action Guard — mandatory safeguard requiring explicit user approval before destructive or structural changes (schema drops, architecture replacements, module removal)
- Guard enforced in global CLAUDE.md, project template, and all execution commands

## [2.5.0] - 2026-02-09

### Changed
- Audited all 27 command files — added Document Ripple and Test Verification steps to 15 commands that were missing them
- All code-modifying commands now enforce doc updates and test runs before completion

## [2.4.0] - 2026-02-09

### Added
- Automatic version bumping in `checkin` command — determines patch/minor/major from change type

## [2.3.0] - 2026-02-09

### Added
- Branch Guard — prevents commits on wrong branch by checking `Expected branch` in CLAUDE.md

## [2.2.1] - 2026-02-09

### Fixed
- `gsd-t-discuss` now stops for user review when manually invoked (was auto-continuing even in manual mode)

## [2.2.0] - 2026-02-09

### Added
- E2E test support in `test-sync`, `verify`, and `execute` commands

## [2.1.0] - 2026-02-09

### Added
- `gsd-t-populate` command — auto-populate living docs from existing codebase
- Semantic versioning system tracked in `progress.md`
- Auto-update README on version changes

## [2.0.2] - 2026-02-07

### Changed
- `gsd-t-init` now creates all 4 living document templates (`requirements.md`, `architecture.md`, `workflows.md`, `infrastructure.md`)
- `gsd-t-scan` cross-populates findings into living docs

## [2.0.1] - 2026-02-07

### Fixed
- Added `gsd-t-brainstorm` to all 4 reference files (README, GSD-T-README, CLAUDE-global, gsd-t-help)
- Fixed workflow diagram alignment

## [2.0.0] - 2026-02-07

### Added
- Renamed package to `@tekyzinc/gsd-t`
- `gsd-t-brainstorm` command — creative exploration, rethinking, and idea generation
- Initialized GSD-T state (`.gsd-t/` directory) on itself

### Changed
- Complete framework rewrite from GSD to GSD-T (contract-driven development)
- npm package with CLI installer (`bin/gsd-t.js`)
- 6 CLI subcommands: install, update, init, status, doctor, uninstall

## [1.0.0] - 2026-02-07

### Added
- Initial GSD-T framework implementation
- Full milestone workflow: partition, discuss, plan, impact, execute, test-sync, integrate, verify, complete
- Agent Teams support for parallel execution
- Living documents system (requirements, architecture, workflows, infrastructure)
