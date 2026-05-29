# Discuss CONTEXT — M61 Platform Reconciliation
Generated: 2026-05-29 11:28 PDT

## Locked Decisions

The plan phase MUST implement each of these exactly. The partition phase MUST shape domains consistent with them.

1. **Demolition order = Hybrid (Option C) + Wave 0 snapshot.** *(Pivoted from Option A after reference scan — see below.)*
   - **Wave 0** (before any deletion): cut `v3.x-legacy` git branch at tag `v3.29.11`. Push to origin. ✅ DONE 2026-05-29 11:31 PDT — commit `0b791c8`. Preserves pre-reconciliation source as the 4.0.0 safety net + D6 migration reference.
   - **Wave 1**: D6 migrate orchestration core to native Workflow scripts (read source from `v3.x-legacy` branch where helpful) + D5 retire proof-scratch (genuinely zero live references — safe parallel companion).
   - **Wave 2**: D7 reframe validation (Red Team / QA / Design-Verify as Workflow stages) + update command files to drop calls to `gsd-t-token-capture` wrapper and `headless-auto-spawn`. After this wave, the retire targets have zero live command-file references.
   - **Wave 3**: 4-way parallel retire — D1 (context-meter/runway) ∥ D2 (unattended relay) ∥ D3 (token telemetry) ∥ D4 (viewer/dashboard). Safe because Waves 1-2 already removed the live dependencies.
   - **Wave 4**: D8 doc-ripple + SC7 cockpit-equivalence walkthrough.
   - User directive: **no other work runs in this repo during M61** (build-hold). This addresses external-dependency risk.
   - **Why pivoted from A → C** (2026-05-29 11:31 PDT): pre-partition reference scan found `gsd-t-token-capture.cjs` called by 13 live command files, `headless-auto-spawn.cjs` by 8, `gsd-t-unattended.cjs` by 4. Retiring them in Wave 1 (Option A) would crash command files until migration landed. User chose hybrid order; build-hold still in force.

2. **Validation parity = port to Workflow stages, declare orthogonal objectives.**
   - Red Team, QA, Design-Verify each become **Workflow stages** (`parallel()` of perspective-diverse `agent()` calls with schema-validated output, model=opus for Red Team).
   - Protocol bodies in `templates/prompts/{red-team,qa,design-verify}-subagent.md` **stay unchanged** — they're methodology, not infra. The Workflow imports them into `agent()` prompts via `readFileSync`.
   - `gsd-t-token-capture` wrapper around spawns is **retired** with D3 — native Workflow `budget`/`agent_count` replace it.
   - **`/code-review ultra` is added to verify as a cooperative correctness/cleanup pass** running in parallel with the Workflow Red Team.
   - The three are declared **orthogonal objective functions** in milestone constraints so future Claude doesn't collapse them: `/code-review ultra` = correctness + cleanup (cooperative); Red Team = adversarial / security / boundaries (bugs-found-not-tests-passed); QA = test execution + shallow-test detection + contract compliance.
   - Each stage retains the "Brief first" rule — `gsd-t-context-brief` is on the KEEP list.

3. **SC7 cockpit-equivalence proof = scripted walkthrough of a small post-M61 backlog item from the desktop.**
   - After M61 ships and is tagged, pick a small ready backlog item (single-domain bug fix or doc update) that exercises ≥1 of each: file read, file edit, test run, git commit, Workflow spawn.
   - Drive the full lifecycle (milestone → partition → plan → execute → verify → deliver) **from the desktop app only**.
   - SC7 PASSES iff: (a) zero terminal keystrokes during the run, (b) every approval prompt that fires is either a real decision (destructive guard, ambiguity) or an allowlist gap (counts as SC7 violation), (c) the final artifact (commits, test results, verify-gate output, doc ripple) is identical to what the CLI path would produce.
   - Record archived under `.gsd-t/milestones/m61-*/sc7-cockpit-walkthrough.md`.

4. **Versioning = v4.0.10 (major bump).**
   - M61 ships as `v4.0.10` (patch starts at 10 per the 2-digit convention).
   - CHANGELOG entry lists every breaking change explicitly with a one-line migration note per surface (removed commands, removed CLAUDE.md conventions, removed CLI subcommands).
   - The `v3.x-legacy` branch cut in Wave 0 doubles as the 4.0.0 safety net for consumers who cannot migrate immediately. npm `latest` moves to `4.0.10`; `3.x` remains available.
   - Banner format unchanged: `[GSD-T] v4.0.10 — CURRENT`. The version *signals* the substrate shift (v3 = supervisor-era, v4 = native-Workflow-era).

## Risks (added 2026-05-29 12:00 PDT after Desktop inventory cross-check)

1. **Workflow tool = research preview** — D6's whole substrate. Mitigation: v3.x-legacy branch already cut (Wave 0); D6 isolates Workflow API surface behind thin wrappers so a future API shift = local edit, not a re-architecture. Plan must enforce this isolation.
2. **Agent Teams = experimental** with known session-resumption + task-coordination gaps. D2 retire-unattended-relay assumes Workflow `parallel()`/`pipeline()` (in-session, robust) covers fan-out, and native `/loop` + scheduled tasks cover cross-session resume. Agent Teams are NOT relied on. If they were, D2 would need to be partial.
3. **`/usage` is per-session only** — no historical cross-session view. D3 retire-token-telemetry accepts this loss explicitly (M38 already admitted the telemetry "never produced action"). Trailing-window cost baseline is archived under `.gsd-t/milestones/m61-*/` not deleted.
4. **Context window for Opus 4.7 in Claude Code = 1,000,000 confirmed** (2026-05-29 12:10 PDT). Verified empirically from `.gsd-t/context-meter.log` showing `window=1000000 model=claude-opus-4-7` on live measurements this session. Max subscription includes 1M context for Opus 4.7. D1 retire-context-runway STAYS IN SCOPE. Side-finding: `.gsd-t/.context-meter-state.json` writes a stale `modelWindowSize: 200000` field while computing pct against 1M (visible pct value is correct; field value is cosmetic). Not worth fixing — D1 deletes the meter wholesale in Wave 3.

## Deferred Ideas

Good ideas surfaced but NOT in scope for M61. Plan must NOT implement these.

- **Deeper SC7 walkthrough on a UI-heavy milestone** — the cleaner test of desktop's browser-tooling advantage. Deferred: SC7 ships on a small post-M61 backlog item (faster, lower risk). The UI-heavy walkthrough can run as a post-M61 audit if useful.
- **Second bake-off on M52 (journey coverage)** — would widen safety evidence. Deferred: the M58 bake-off already proved native orchestration reproduces gates AND caught a live CRITICAL. Adding M52 would be belt-and-suspenders; the build-hold + v3.x-legacy snapshot are the actual safety nets.
- **Cross-project propagation of v4.0.10 to all 23 registered projects in the same milestone.** Deferred to a post-M61 task (`gsd-t version-update-all` after M61 ships).

## Claude's Discretion

Implementation details Claude can choose freely during execute.

- Exact Workflow script structure (one script per command vs. one shared library + thin wrappers).
- Whether to ship the Workflow scripts under `workflows/`, `bin/workflows/`, or `templates/workflows/`.
- How to wire `/code-review ultra` into verify (pre-Red-Team, post-Red-Team, or parallel-with-Red-Team) — pick whichever produces the clearest verify report.
- The Wave 1 retire deletions may go in one commit per domain or one combined commit — whichever the user prefers at execute time.
- The exact set of breaking-changes bullets in CHANGELOG — must cover every retired surface, format is Claude's choice.
