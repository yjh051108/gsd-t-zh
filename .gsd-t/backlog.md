# Backlog

## M62 (post-M61): Cross-Project Propagation of v4.0.10
- **Type:** ripple | **App:** gsd-t | **Category:** propagation
- **Added:** 2026-05-29 | **Origin:** m61-deferred
- Run `gsd-t version-update-all` to propagate v4.0.10 to all 23 registered projects: rewrite their CLAUDE.md to drop retired-infra rules, update package.json, archive their token-log.md, and clean up `~/.claude/settings.json` hooks for retired infrastructure (conversation-capture, context-meter, in-session-usage).

## M63 (post-M61): SC7 Cockpit Walkthrough on UI-Heavy Milestone
- **Type:** validation | **App:** gsd-t | **Category:** verification
- **Added:** 2026-05-29 | **Origin:** m61-deferred
- Deeper SC7 test of desktop-as-cockpit: drive a UI-heavy milestone (browser tooling exercised) entirely from the desktop app with zero terminal keystrokes. Validates the browser/Playwright leg of the cockpit promise that the small-backlog SC7 doesn't exercise.

## M64 (post-M61): M52 Bake-Off
- **Type:** validation | **App:** gsd-t | **Category:** verification
- **Added:** 2026-05-29 | **Origin:** m61-deferred
- Run M52 (journey coverage) as a native Workflow to widen safety evidence beyond M58. Belt-and-suspenders; the build-hold + v3.x-legacy snapshot are the actual safety nets.

## M65 (post-M61): D6 Port-Then-Delete Completion — **PROMOTED → DEFINED as M65 (2026-05-29)**
- **Type:** retire | **App:** gsd-t | **Category:** cleanup
- **Added:** 2026-05-29 | **Origin:** m61-deferred | **Status:** DEFINED — see `.gsd-t/progress.md` § Current Milestone M65
- **Scope CORRECTED at define-time** (live ref-scan + user decision 2026-05-29): `parallel-cli.cjs`, `parallel-cli-tee.cjs`, `gsd-t-parallel.cjs` are NOT deletable — they are M61 KEEP-list substrate (verify-gate Track-2 requires `parallel-cli.cjs::runParallel`; `_lib.js` shells to `gsd-t-parallel.cjs` for file-disjointness proving). M65 deletes only the true shell: `gsd-t-orchestrator.js` + `-worker/-queue/-config.cjs` + `spawn-plan-{writer,status-updater,derive}.cjs` + `headless-exit-codes.cjs` (inline-then-delete) = 8 files / 1,838 bin/ LOC. Plus `orchestrate` dispatch removal, dependent-test deletion, post-commit-spawn-plan hook removal, and the dangling `gsd-t-resume.md` ref cleanup.
- **Deferred to separate backlog (not M65)**: `bin/orchestrator.js` + `bin/design-orchestrator.js` retirement-or-rewire — the design-build pipeline is currently unwired (`gsd-t design-build` documented but no dispatch case in gsd-t.js); decide wire-back vs. retire independently of the orchestration-shell cleanup. (~1,387 LOC + design-orchestrator.)

## 1. Agentic Workflow Architecture
- **Type:** feature | **App:** gsd-t | **Category:** architecture
- **Added:** 2026-02-13
- Evolve GSD-T commands from markdown instruction files into independent, spawnable agents. Each command becomes an agent that can: receive work requests and bid on them, work in parallel with other agents, communicate through contracts as shared interfaces, and self-organize into teams. Blocked by: Claude Code agent teams graduating from experimental status, agent spawn cost/latency improvements. See brainstorm session 2026-02-13 for full pros/cons analysis.

## 2. Living docs staleness detection
- **Type:** improvement | **App:** gsd-t | **Category:** commands
- **Added:** 2026-02-19
- gsd-t-health should flag docs with only placeholder content as STALE, not OK — existence check is insufficient if the file is full of `{description}` tokens. gsd-t-scan Step 5 should self-check after writing living docs and warn if infrastructure.md still contains only placeholder text (no commands, URLs, or real content found in codebase). Commands that depend on infrastructure knowledge should verify the doc has real content before proceeding, not silently consume placeholder text and fall back to guessing.

## 3. Auto-cleanup test data after test runs
- **Type:** improvement | **App:** gsd-t | **Category:** cli
- **Added:** 2026-02-19
- All temporary files, directories, or state created during the test suite must be automatically removed when the test run completes (pass or fail). Tests that currently leave artifacts behind can cause false positives/negatives in subsequent runs and pollute the working directory.

## 4. DB integration testing capability in QA agent
- **Type:** feature | **App:** gsd-t | **Category:** commands
- **Added:** 2026-02-19
- GSD-T currently has no built-in DB testing — it only runs whatever test suite already exists in the project. Add a DB testing step to the QA agent (or a new gsd-t-db-test command) that reads docs/infrastructure.md for the test DB connection, runs migrations against it, seeds test data, executes the project's DB test suite, and tears down the test DB on completion. Should be DB-agnostic (Postgres, SQLite, Supabase, etc.) and driven by commands documented in infrastructure.md.

## 5. GSD-T Workflow Visualizer
- **Type:** feature | **App:** gsd-t | **Category:** ux
- **Added:** 2026-02-25
- Add a `gsd-t-visualize` command (or `gsd-t-status --visual` flag) that renders the current project's workflow state as a visual diagram. Should show: milestone → domain → phase progression with status indicators (✅ complete, 🔄 in-progress, ⏳ pending, 🔴 blocked); contract connections between domains; task-level detail on demand; and the full GSD-T phase pipeline (partition → discuss → plan → impact → execute → test-sync → integrate → verify → complete) with the current position highlighted. Output options: ASCII/Unicode tree for terminal display, an HTML report for sharing, or a Mermaid diagram that renders in GitHub/VS Code. Reads from `.gsd-t/progress.md`, `.gsd-t/domains/*/tasks.md`, and `.gsd-t/contracts/` — no extra state needed. Goal: give the user an at-a-glance picture of where a milestone stands without having to parse markdown files manually.

## 6. Observability: Measurement, Logging, and Telemetry (SigNoz)
- **Type:** feature | **App:** gsd-t | **Category:** commands
- **Added:** 2026-02-25
- Integrate SigNoz (https://github.com/SigNoz/signoz) as the recommended observability stack for GSD-T-managed projects. SigNoz is an open-source, self-hosted alternative to Datadog/New Relic that provides distributed tracing, metrics, and logs in a single pane. GSD-T should support: gsd-t-setup detecting or prompting for observability choice, infrastructure.md documenting the SigNoz connection and dashboard URL, gsd-t-execute optionally wiring OpenTelemetry SDK into new services, and a health check for whether the project has observability configured. Enables teams to measure performance, debug production issues, and track error rates without vendor lock-in.

## 7. AI Evals Framework Integration
- **Type:** feature | **App:** gsd-t | **Category:** commands
- **Added:** 2026-02-25
- Add AI evaluation capabilities to GSD-T for projects that use LLMs. Reference: https://github.com/aishwaryanr/awesome-generative-ai-guide/blob/main/free_courses/ai_evals_for_everyone/README.md. GSD-T should support: a `gsd-t-evals` command (or integration into gsd-t-qa) that runs LLM output evaluation suites, defines eval criteria in contracts (expected output shape, quality thresholds, hallucination checks), integrates with eval frameworks (RAGAS, LangSmith, PromptFoo, or custom), and reports pass/fail against defined quality gates. The QA agent should be aware of eval steps when the project contains AI components. Living docs (requirements.md, architecture.md) should document eval criteria alongside functional requirements.

## 8. Auto-Setup Graph Dependencies
- **Type:** feature | **App:** gsd-t | **Category:** cli
- **Added:** 2026-03-19
- Graph Readiness Check that runs during `gsd-t-version-update` and `gsd-t-version-update-all`. Hybrid approach: auto-fix what's safe, report and prompt for heavyweight installs. Checks: (1) Docker installed — if missing, show install instructions with copy-paste commands; (2) Neo4j container running — if missing, offer to pull and start `docker run -d --name gsd-t-neo4j ...`; (3) CGC (CodeGraphContext) installed — if missing, offer `pip install codegraphcontext`; (4) Project graph indexed — if missing, run `indexProject()` automatically. Diagnostic mode outputs a checklist with status indicators (pass/fail) and exact commands needed. Should not silently install heavyweight dependencies (Docker) without user confirmation — report what's needed and let the user decide.

## 9. Provider Failure Warnings + Auto-Recovery
- **Type:** feature | **App:** gsd-t | **Category:** commands
- **Added:** 2026-03-19
- When the graph provider chain falls back (CGC → native → grep), warn the user clearly instead of silently degrading. Each fallback should display: what failed, why it failed, what the user loses, and how to fix it. Examples: "⚠ CGC unavailable (Neo4j container stopped) — falling back to native. Deep call chain analysis disabled. Fix: `docker start gsd-t-neo4j`" or "⚠ Native index missing — falling back to grep. Entity lookup, dead code detection, and contract mapping unavailable. Fix: run `gsd-t graph index`". Auto-recovery should attempt corrective actions before falling back: check if Docker container exists but is stopped (start it), check if index files exist but are corrupt (rebuild). Only fall back after recovery attempts fail. Priority: high — silent fallback means silent quality degradation.

## 10. Cross-Project Shared Learning via Git
- **Type:** feature | **App:** gsd-t | **Category:** commands
- **Added:** 2026-03-31
- Enable GSD-T learning (ELO scores, metrics, QA patterns, event history) to be shared across users and machines via a centralized git repository. Currently, `.gsd-t/metrics/`, `.gsd-t/events/`, and `.gsd-t/qa-issues.md` are per-project and travel with each project's git repo — but cross-project ELO comparisons and aggregated pattern learning are local-only. Proposed approach: a `gsd-t-learning` command that syncs anonymized metrics to a shared "learning hub" repo (e.g., `gsd-t-learning-hub` on GitHub). Hub stores: aggregated ELO benchmarks by stack/project-type, common QA failure patterns and fixes, task duration baselines by complexity, stack rule effectiveness scores. Privacy: only aggregate metrics are shared — no source code, file paths, or proprietary content. Users opt-in per project. Benefits: new GSD-T users start with community-learned baselines instead of cold-start, teams share institutional knowledge across projects, stack rules evolve based on real-world effectiveness data.

## 11. Docker Support (Enterprise)
- **Type:** feature | **App:** gsd-t | **Category:** infrastructure
- **Added:** 2026-03-22
- Containerized GSD-T execution for enterprise security compliance. Dockerfile + docker-compose with Node.js + Claude Code + GSD-T pre-installed. Vault-injected secrets (no API keys on developer machines). Ephemeral containers — no credential persistence after run. Volume-mounted project directory. Egress-only network config. Primary interface is `gsd-t headless` (M23). PRD: docs/prd-gsd2-hybrid.md section 4.8, milestone M24. Exit criteria: `docker-compose up` runs a headless milestone, secrets via env vars (Vault-compatible), container is ephemeral, documentation complete. Depends on M23 (Headless Mode) being complete.

## 12. Integration smoke test for infrastructure config changes
- **Type:** improvement | **App:** gsd-t | **Category:** cli
- **Added:** 2026-04-04
- After writing infrastructure config, verify it took effect by running the corresponding check command. Currently the Red Team can't catch "wrote to the wrong file" bugs because tests validate code correctness, not environment integration. Add a post-config verification step to the install/update flow that confirms each config is discoverable by the target system. Origin: Figma MCP was written to settings.json but Claude Code reads MCP servers from ~/.claude.json — only caught by manual testing in a live session. Verification matrix: MCP servers → `claude mcp list` (confirm server appears); Heartbeat hooks → read settings.json hooks array (confirm entry exists); Update check hook → read settings.json SessionStart hook (confirm entry exists); Auto-route hook → read settings.json UserPromptSubmit hook (confirm entry exists); Global CLAUDE.md → read `~/.claude/CLAUDE.md` (confirm GSD-T section present); Slash commands → `ls ~/.claude/commands/` (confirm expected files exist); CGC/graph engine → `cgc --version` or equivalent health check; Utility scripts → `ls ~/.claude/scripts/` (confirm expected files exist).

## 13. Agent Topology Dashboard Redesign
- **Type:** ux | **App:** gsd-t | **Category:** commands
- **Added:** 2026-04-15
- Redesign `scripts/gsd-t-agent-dashboard.html` to match the reference design (dark card-based layout with colored borders, icons, status indicators). Key changes: (1) Agent names should reflect GSD-T roles (Research, Audit, Impact, Coding, Doc Update, QA, Red Team) — map from events data instead of showing generic types (General, Explore). (2) Each node card shows: agent role name, status indicator (Active/Thinking/Idle/Tool Call), current activity description, model name, elapsed time, tool call count, iteration count, token count. (3) Layout should be a proper directed graph with parent-child edges and clear connection lines — not the current flat row of tiny crammed nodes. (4) Clicking a node opens a right-side detail panel showing: full list of tool calls made by that agent, tokens consumed per tool call, timeline of actions, total duration and token summary. (5) Server (`scripts/gsd-t-agent-dashboard-server.js`) may need enriched SSE events to supply tool-call-level detail per agent. Reference image provided by user 2026-04-15.

## 14. M44 — Cross-Domain & Cross-Task Parallelism (in-session AND unattended)
- **Type:** milestone | **App:** gsd-t | **Category:** orchestration
- **Added:** 2026-04-22
- **Pre-req status:** Q1 (token-log regen `7eefd2c`), Q2a (compaction detector + scanner `940e5a8`/`f7de324`), Q3 (turn→tool join `8f4588b`), optimization report (`b5edff2`), adaptive maxParallel (`969462a`) — all landed. Measurement infrastructure complete; 525 turn rows + 72 compaction events + per-CW report available as calibration corpus.

### Goal
Deliver task-level parallelism to **both** execution modes on equal footing, with mode-aware gating math. Unattended mode adds the harder contract: **zero compaction across an autonomous M1 → M10 run**.

### Mode contracts (NON-NEGOTIABLE)

**[in-session]** Two objectives:
1. Speed (wall-clock reduction)
2. Reduce compaction as much as possible (minimize, can't eliminate)

Hard rule: NEVER throw an interactive pause/resume prompt. Silent compaction is acceptable; demanding user attention is not. The user runs in-session because they want to interrupt or because requirements are partial — the framework must never demand attention back.

**[unattended]** One objective:
1. Run M1 → M10 (or any multi-milestone chain) end-to-end with zero human involvement and **zero compaction**.

The supervisor process (Node, no CW) orchestrates `claude -p` workers, each with its own clean CW. Per-worker CW headroom is the binding gate. Speed is a side-benefit, not the primary objective.

### Three pre-existing invariants (apply to BOTH modes identically)
1. **File-disjointness proof BEFORE spawn** — orchestrator proves no shared files between parallel tasks. If unprovable, falls back to sequential.
2. **100% automatic merges** — zero human intervention. If a parallel run ever requires merge resolution, that's a framework bug.
3. **Pre-spawn economics check** — orchestrator auto-decides parallel-vs-sequential based on shared-context cost and inter-task dependency needs. Logged to events.jsonl, never prompted.

### Mode-specific gating math
- **[in-session]** Orchestrator-CW headroom check before fan-out. Worker summaries land in the orchestrator's (= user-facing) CW. Bound BOTH worker count AND result-envelope size by `getSessionStatus().pct + (N × expected_summary_size) ≤ threshold`. If math fails, pump fewer-at-a-time instead of refusing.
- **[unattended]** Per-worker-CW headroom check. Pre-spawn cost estimator consumes `.gsd-t/metrics/token-usage.jsonl` (525-row calibration corpus, growing) to predict each task's CW footprint. If a single task slice would exceed ~60% of one CW, split into multiple iters (= multiple `claude -p` spawns) instead of one fat iter. Compaction events from `.gsd-t/metrics/compactions.jsonl` are the empirical "we failed" signal that drives estimator calibration.

### Two delivery layers (independent of mode)
- **Layer 1 — Parallel `claude -p` worker spawns**: K workers in flight, each with its own clean CW. Primary lever for both modes. For [unattended], this is *the* mechanism for compaction-elimination — slicing work into smaller per-worker pieces that never approach the ceiling.
- **Layer 2 — Parallel tasks within one worker**: M tasks interleaved in one CW. Weaker lever (still bounded by one CW), only used when L1 isn't economic (small tasks, shared context). Same disjointness/economics gates apply at sub-iter granularity.

### Token-cost honesty (so this isn't sold on a false premise)
Parallel is approximately **token-neutral in steady state** for both modes:
- Total input/output: same (same work, same answers)
- Cache-read: same or slightly higher (K caches vs N, same count)
- Cache-creation: same (one prefix per spawn either way)
- **Compaction-induced re-input drops to zero** when slicing stays under ceiling — this is where parallel actually saves tokens
- Wall-clock: `max(worker_durations)` instead of `sum(worker_durations)` — primary win

Rate-limit pressure from running parallel is NOT a con. Hitting the 5-hour ceiling because you got 20× more done is the goal.

### Proposed domains (7)
- **D1 — Generic task-graph reader**: parses `.gsd-t/domains/*/tasks.md` + cross-domain dependency graph from contracts; emits a DAG of independently-executable task slices. Mode-agnostic.
- **D2 — `gsd-t parallel` CLI**: new subcommand wrapping the M40 orchestrator with task-level (not just domain-level) parallelism. Honors `--mode in-session|unattended` flag (or auto-detects from caller). Both modes.
- **D3 — Command-file integration**: `gsd-t-execute`, `gsd-t-wave`, `gsd-t-quick`, `gsd-t-debug`, `gsd-t-integrate` learn to consume the task-graph and dispatch via D2. Both modes.
- **D4 — Dep-graph validation**: pre-spawn validator that confirms task dependencies are honored; refuses to fan out tasks whose dependencies haven't completed. Both modes.
- **D5 — File-disjointness prover**: walks each task's expected-touch list against every other concurrent task's list. Sources: domain `scope.md`, prior commit history for similar tasks, optional explicit `touches:` field on tasks. Falls back to sequential when unprovable. Both modes.
- **D6 — Pre-spawn economics + cost estimator**: queries `.gsd-t/metrics/token-usage.jsonl` for prior-similar-task token cost (matches by command + step + domain), estimates worker CW footprint, decides parallel-vs-sequential. Mode-aware: feeds [in-session] orchestrator-CW gate vs [unattended] per-worker-CW gate.
- **D7 — Per-CW token attribution + compaction-event integration**: ensures every spawn (parallel or sequential) tags its rows with `cw_id` so the optimization report's per-CW rollup keeps working post-M44. Wires the live compaction detector hook into the supervisor's "we failed to prevent compaction" signal for [unattended] estimator calibration.

### Success criteria
- **[in-session]** A `gsd-t-execute` run that previously took T minutes serially completes in ≤ T/2 minutes with N workers, with no pause/resume prompts at any point.
- **[unattended]** A multi-milestone chain (M1 → M5 minimum, ideally M1 → M10) runs end-to-end with **zero compaction events** logged to `.gsd-t/metrics/compactions.jsonl` during the autonomous run. Empirical baseline: 72 compactions over 18 days of mixed-mode work; success = 0 during a measured autonomous chain.

### Explicit non-goals
- In-session pause/resume prompts under any condition (those are the failure mode, not a feature)
- Cross-worker context-sharing (each worker stays clean — that's the whole point)
- Replacing M40 orchestrator (M44 builds on M40, doesn't replace it)
- Visualizer/dashboard work (separate backlog #13)

### Standing memory references
- `feedback_parallelism_two_modes.md` — full mode-aware design framing
- `feedback_unattended_overnight_only.md` (superseded 2026-04-22) — mode-selection criteria
- `feedback_token_measurement_hierarchy.md` — Run → Iter → CW → Turn → Tool, CW as primary unit

## 15. m44-wave3-smoke-tests
- **Type:** improvement | **App:** gsd-t | **Category:** tests
- **Added:** 2026-04-23
- Build the in-session + unattended smoke-test fixtures deferred from M44-D3-T5: a small multi-domain fixture proving `gsd-t parallel` completes in ≤ T/2 of the sequential baseline with zero pause/resume prompts, plus an unattended `gsd-t unattended --max-iterations 5` fixture producing zero new entries in `.gsd-t/metrics/compactions.jsonl` during the run. Blocked on: actual fixtures not yet authored in the repo. Follow-up quick task.

## 16. Main + worker chat display — wire conversation-capture hook
- **Type:** improvement | **App:** gsd-t | **Category:** observability
- **Added:** 2026-04-23
- Five-surface parallelism audit gap #3. `scripts/hooks/gsd-t-conversation-capture.js` writes `in-session-{sessionId}.ndjson` for the main chat and the viewer discriminates with the 💬 badge at `scripts/gsd-t-transcript.html:531`, but `~/.claude/settings.json` today only registers the token-probe hook, so the conversation-capture hook never fires and `.gsd-t/transcripts/` contains only `s-*.ndjson` (spawn-tee). Net: main-chat dialog is not visible in the viewer until the hook block from `CLAUDE.md § In-Session Conversation Capture (M45 D2)` is appended to `~/.claude/settings.json`. Fix is configuration-only (a small `update-config` skill invocation); no framework code changes. Out of scope: capturing worker-child dialog — workers emit `s-*.ndjson` via spawn-tee, which is correct and already visible.

## 17. Visualizer counts by kind — expose spawn-kind breakdown
- **Type:** improvement | **App:** gsd-t | **Category:** ux
- **Added:** 2026-04-23
- Five-surface parallelism audit gap #4. Spawn plans already tag a `kind` field with three values (`unattended-worker` | `headless-detached` | `in-session-subagent`) at `bin/spawn-plan-writer.cjs:44`, but `computeParallelismMetrics` in `bin/parallelism-report.cjs` returns a flat shape that the D9 panel renders as a single `activeWorkers` count. Add per-kind counters (`activeWorkers.byKind = {unattendedWorker: N, headlessDetached: M, inSessionSubagent: K}`) to the report, surface them in the D9 panel header, and update contract `parallelism-report-contract.md` (currently v1.0.0) to v1.1.0 additive. Non-breaking: existing `activeWorkers` number stays; new field is additive.

## 18. Multi-parent segmentation — group parallelism-report by parent/session
- **Type:** feature | **App:** gsd-t | **Category:** ux
- **Added:** 2026-04-23
- Five-surface parallelism audit gap #5. `bin/parallelism-report.cjs:43` unions all active spawn plans (filtered only by `endedAt === null`) with zero references to `parent_id`, `session_id`, or `sessionId`. If an in-session chat dispatches N workers and an unattended supervisor runs M workers concurrently, the D9 panel displays a single N+M aggregate with no grouping. Introduce grouping by `session_id` (or `parent_id` when present in the spawn-plan record) so the viewer's right panel can render one row per concurrently-running orchestrator. Requires: (a) spawn-plan-writer emits `parent_id` + `session_id` on every plan, (b) parallelism-report returns `groups: [{id, kind, workers, ...}]`, (c) viewer right panel renders groups. Precursor for item #17 (per-kind counts become per-group-per-kind).

## 19. Auto-prevent context-heavy file growth (progress.md + siblings)
- **Type:** feature | **App:** gsd-t | **Category:** context-hygiene
- **Added:** 2026-04-23
- **Observation (2026-04-23)**: `.gsd-t/progress.md` reached **229.4 KB / 95 Decision Log entries** before the manual archiver was run — a single `Read` of that file burned ~60k input tokens (~10% of a 200k CW). `bin/archive-progress.cjs` exists and solved it in one shot (229.4 KB → 43.9 KB), but it is a **manual tool**, not auto-invoked. `gsd-t-complete-milestone` Step 7 has a milestone-start-date trim clause, but in practice it leaves 90+ entries in place when the milestone ran long or multiple milestones shipped in one day. **Cost is huge and recurring** — every `resume`/`milestone`/`partition`/`plan` pays it. **Scope**:
  1. **Auto-archive trigger**: wire `bin/archive-progress.cjs` into a PreCompact + Stop hook (or a SessionStart guard) so the live file is trimmed whenever it exceeds a threshold (suggest: 40 KB OR > 10 Decision Log entries, whichever hits first). Hook MUST be fail-open and silent when below threshold.
  2. **Size-band warning**: extend `bin/token-budget.cjs` or the context-meter to emit a one-line warning when any file in the **governed list** crosses its band. Governed list with **measured sizes (2026-04-23)** and **band**:
     - `CHANGELOG.md` — **207 KB** (critical — biggest un-archived state doc; release-time reads load the whole thing). Band: archive chunks older than last minor release into `.gsd-t/changelog-archive/` when > 80 KB.
     - `docs/requirements.md` — **86 KB** (ripple-read by most commands via "No Re-Research" rule). Band: warn at 60 KB, archive completed-milestone sections into `docs/requirements-archive/NNN-<milestone>.md`.
     - `docs/architecture.md` — **80 KB** (ripple-read; ADR-style sections accumulate). Band: warn at 60 KB, archive superseded ADRs to `docs/architecture-archive/`.
     - `.gsd-t/backlog.md` — **28 KB** (trending up; new items only append). Band: warn at 40 KB, archive resolved/promoted items to `.gsd-t/backlog-archive/`.
     - `.gsd-t/progress.md` — **44 KB post-archive** (was 229 KB). Band: already covered by `archive-progress.cjs`; just wire the threshold trigger.
     - `.gsd-t/techdebt.md` — **15 KB** (safe). Band: warn at 40 KB, archive resolved items.
     - `docs/infrastructure.md` — **19 KB** (safe). Band: warn at 40 KB.
     - `docs/workflows.md` — **12 KB** (safe). Band: warn at 40 KB.
     - `CLAUDE.md` — **9 KB** (safe; kept tight by design). Band: warn at 20 KB.
     Warning lands in the same footer channel as the M43 D5 dialog-growth meter — read-only, never refuses.
  3. **Write-time guardrail in `gsd-t-complete-milestone`**: before Step 7 trim, capture pre-trim size; after Step 7 trim, assert live file is < 50 KB; if not, invoke `archive-progress.cjs` programmatically as a second pass.
  4. **Apply the same pattern to sibling files** that grow. Archiver implementations needed for each governed file type (progress.md archiver exists as reference):
     - `bin/archive-changelog.cjs` — splits CHANGELOG.md at minor-version boundaries, writes `.gsd-t/changelog-archive/vM.N.x.md`.
     - `bin/archive-requirements.cjs` — splits docs/requirements.md by completed-milestone sections (uses progress.md milestone status).
     - `bin/archive-architecture.cjs` — splits docs/architecture.md by superseded ADR marker (look for `**Status**: superseded` headers).
     - `bin/archive-backlog.cjs` — moves items marked `[promoted]` or `[resolved]` to `.gsd-t/backlog-archive/`.
     - `bin/archive-techdebt.cjs` — moves `[resolved]` items to `.gsd-t/techdebt-archive/`.
     All archivers share the `archive-progress.cjs` idempotent-replay pattern: `--dry-run` flag, summary output, preserves git blame by archiving to new files rather than rewriting in place.
  5. **Contract**: new `.gsd-t/contracts/context-hygiene-contract.md` documenting the size thresholds, which files are governed, archive locations, and the fail-open invariant.
- **Success criteria**: after a 50-entry Decision Log burst, the live `progress.md` MUST settle back to ≤ 40 KB within 1 session-start tick. A `Read` of any governed file MUST never exceed 15k tokens in steady state.
- **Why this matters**: context cost on large files is O(tokens_read × turns_where_read_happens). Progress.md is read in 7+ commands per milestone; a 60k-token read × 7 commands = 420k tokens per milestone just from staleness. The archiver already exists — this is pure wiring + thresholds.
- **Related**: `docs/context-budget-recovery-plan.md` CUT #1 (where the 40k-token figure was measured); `bin/archive-progress.cjs` (existing tool); `gsd-t-complete-milestone.md` Step 7 (existing but insufficient trim); M43 D5 `estimateDialogGrowth` (warning-channel precedent).

## 20. Slim the `/gsd` router skill body (14 KB → ~5 KB)
- **Type:** improvement | **App:** gsd-t | **Category:** context-hygiene
- **Added:** 2026-04-23
- **Observation (2026-04-23)**: `commands/gsd.md` is 263 lines / 13,934 bytes and gets re-injected **on every plain-text turn** via the `[GSD-T AUTO-ROUTE]` UserPromptSubmit hook. Over a 20-message session that's ~70k tokens of router prose repeatedly re-paid in context. The skill does five things but only routes — most of the bulk is inlined reasoning/examples that the router consults once per request but pays for on every turn.
- **Four cuts, paired with item #19 (context hygiene)**:
  1. **Move Step 2.5 conversational-trigger reasoning to a reference doc**. New `docs/router-conversation-patterns.md` owns the conversational-trigger list, examples, and framing language (currently ~80 lines inlined in `gsd.md`). Router replaces that block with: "For conversational triggers, consult `docs/router-conversation-patterns.md`." Router prompt shrinks by ~80 lines.
  2. **Extract the RIGHT/WRONG examples into `test/router-routing.test.js`**. The `WRONG ❌` / `RIGHT ✅` comparison blocks in Step 3 are assertions about valid command slugs — they belong as runtime unit tests, not as prompt prose. Tests fire on build; prompt stays slim. Saves ~30 lines.
  3. **Collapse the design-to-code pipeline block to a one-liner** that delegates to a new helper: `commands/gsd.md` says "If the request involves a design contract/Figma URL/mockup, route via `bin/gsd-t-design-route.cjs`." The pipeline entry table + clean-step inline notes + fallback routing (currently ~40 lines) move into that CJS helper which the router calls when design-keywords are detected. Router stays stack-agnostic; design logic lives in one place.
  4. **Replace the Step 5 node -e block with `bin/runway-warn.cjs`**. The embedded 15-line node script that reads `.gsd-t/metrics/token-usage.jsonl` and prints the dialog-pressure warning becomes a single subprocess call: `node bin/runway-warn.cjs` (exits 0 with optional stdout warning, matching today's contract). Saves ~20 lines + removes the need for the model to re-read the same node code on every turn.
- **Scope (this is the new `bin/gsd-t-design-route.cjs` + `bin/runway-warn.cjs` + refactored `gsd.md`)**: ~5 new files (2 CJS helpers, 1 reference doc, 1 test file, refactored gsd.md). All additive; the router's contract (routing header format, continuation format, conversational fallback) is unchanged. No behavior change for end users.
- **Success criteria**: `wc -c commands/gsd.md` ≤ 6000 bytes after refactor (down from 13934). Router-body re-injection cost per turn ≤ 1500 tokens. All existing `/gsd` routing paths still route to the same command slugs. New `test/router-routing.test.js` replaces the inline WRONG/RIGHT examples with 8+ assertions covering the same cases.
- **Why this matters**: the router is the hottest skill in the framework — it runs on every plain-text message in a GSD-T project. A 64% size reduction compounds across every conversational turn. Pairs with item #19: #19 trims state files, #20 trims the runtime-injected skill prose.
- **Related**: `commands/gsd.md` (current 263-line router), `commands/gsd-t-help.md` (29 KB — also a re-injection candidate if users invoke `/gsd-t-help` repeatedly), `bin/runway-estimator.cjs::estimateDialogGrowth` (already exists; `runway-warn.cjs` is a 20-line CLI over it), M43 D5 (where the growth-meter footer was added).

## 21. Spawn-by-default enforcement (mechanical hooks, not prose directives)
- **Type:** feature | **App:** gsd-t | **Category:** context-hygiene · enforcement
- **Added:** 2026-04-23
- **Root problem**: `feedback_parallel_headless_by_default.md` + `headless-default-contract.md` v2.0.0 say "every command spawns detached, parallel where safe," but enforcement is LLM prose. The orchestrator (Claude) repeatedly drifts into inline Read/Edit/Write/Bash work on governed files because each individual edit looks cheap. Cumulative cost is invisible until compaction hits. Evidence: this session (2026-04-23 post-resume) compacted after ~8 turns because orchestrator-side M46 definition + backlog edits + archive-progress ran inline instead of in a detached spawn. Measured: progress.md reads alone consumed ~60k tokens of orchestrator context.
- **Directive (as corrected in dialog)**: **Default = detached headless spawn, parallel where safe.** Dialog channel is reserved for: (a) Claude reporting state, (b) Claude asking for a decision, (c) user asking for details (Claude elaborates). Everything else — reads, edits, writes, bash bookkeeping, "thinking-through-the-problem" work — goes to a headless child. User watches the work in the visualizer if desired. No byte budget, no file-size threshold. Classification-based, not size-based.
- **Two mechanical hooks** (PreToolUse + PostToolUse in `~/.claude/settings.json`, same surface as context-meter and token-probe):
  1. **`orchestrator-work-guard.js` (PreToolUse on Read/Edit/Write/Bash)** — deny the tool call unless it matches a narrow allow-list:
     - Reads: only if current turn started with a user question AND file is <10 KB (safety rail for giant-file reads, not a work budget)
     - Edits/Writes: only if user's last message contains an explicit inline directive (e.g., "edit this inline", "change X to Y here", "add this to backlog")
     - Bash: only status probes from a fixed list (`git status`, `git diff --stat`, `ls`, `wc`, `pwd`, `cat` on <5KB files for reference lookups)
     - Everything else → deny with structured error: `{"deny": true, "reason": "This action requires a headless spawn. Dialog-channel work forbidden by orchestrator-work-guard. Spawn via /gsd-t-<command> instead."}` The LLM cannot argue with a hook-denied tool call.
  2. **`workflow-must-spawn.js` (PostToolUse after router classification)** — if `/gsd` router Step 2.5 classified the turn as `workflow`, the next non-reply tool call MUST be a spawn (Task tool with detached subagent, or Bash invoking `claude -p`, or `spawn-headless` helper). Any other tool call after a `workflow` classification = hook-denied error: `"Classification was workflow. Must spawn. Got <ToolName> instead."`
- **Failure-handling protocol (from dialog)**:
  1. Spawn fails with recoverable error (wrong filename, typo, bash error) → the child self-corrects in its own context, same as today's in-session loops
  2. Spawn fails unrecoverably → orchestrator reads last 20 lines of child stderr + the session's JSONL transcript, determines root cause, re-spawns with corrected context injected
  3. Spawn needs a mid-flight decision → child writes `.decision-request.json`, exits code 7, orchestrator surfaces the question in dialog, user answers, orchestrator re-spawns with answer injected. **Alternative (preferred if M45-era chat-injector lands)**: visualizer chat-injector feeds the answer directly to the running detached session without restart.
  4. User wants to course-correct mid-work → user says "abort and redo with X" in dialog, orchestrator writes `.abort-requested` flag in spawn workspace, spawn checks flag at natural checkpoints (between tasks, between domains), exits cleanly, orchestrator re-spawns with new instructions.
- **Coherence-vs-disjointness refinement**: `bin/gsd-t-parallel.cjs::runParallel` already checks file-disjointness (a safety property). Add a coherence check for refactors that span 5+ files where each change informs the next — when coherence fails, recommend a **single** headless spawn (not parallel) for the whole task. Still headless-by-default; just not parallel. Prevents locally-correct, globally-inconsistent output from N disjoint workers.
- **Visualizer health guard**: visualizer process becomes load-bearing under this directive (dialog no longer shows 90%+ of work). Session-start check: if `:7433` not responding, launcher starts it automatically. Already mostly implemented — needs to become mandatory.
- **Scope** (new files):
  - `scripts/hooks/orchestrator-work-guard.js` (PreToolUse hook)
  - `scripts/hooks/workflow-must-spawn.js` (PostToolUse hook)
  - `.gsd-t/contracts/spawn-by-default-contract.md` v1.0.0 (allow-list definition, deny-error format, failure-handling protocol, coherence check criteria)
  - Extension to `bin/gsd-t-parallel.cjs` — add `checkCoherence()` alongside existing `checkDisjointness()`
  - Extension to `scripts/gsd-t-transcript.html` / backend — chat-injector for detached sessions (feeds user decisions into running child without restart; supersedes `.decision-request.json` round-trip for simple cases)
  - Install block in `templates/CLAUDE-global.md` wiring the two new hooks into `~/.claude/settings.json` alongside existing hooks
- **Success criteria**:
  1. A GSD-T session of 50 user turns produces **≤5 non-reply orchestrator-side tool calls** (reads-to-answer-questions count against the 5; orchestrator-side Edit/Write count as violations, not allowances)
  2. Zero context-exhaustion compactions on sessions where the user's work is ≤20 KB of content and all workflow work is spawned
  3. `workflow`-classified turns that fail to spawn on the next tool call = 0 across a 100-turn test suite (hook denies them mechanically)
  4. Failure-handling protocol items 1-4 each have a dedicated test fixture in `test/spawn-enforcement/*`
  5. Red Team probes: (a) LLM tries to justify an inline edit → hook denies; (b) LLM tries to chain 10 small reads → guard flags; (c) spawn crashes and orchestrator correctly diagnoses from JSONL; (d) mid-flight decision request round-trips cleanly
- **Why not a byte budget** (previous iteration's mistake): a byte budget re-introduces "some inline is fine" through the side door. User corrected this explicitly: "The number isn't 10 KB. The number is zero, with narrow, named exceptions." Classification (what kind of work) beats measurement (how big).
- **Pairs with**: #19 (context hygiene — trims governed files), #20 (router slimming — trims skill re-injection). #21 is the enforcement layer — #19/#20 are the surface-area reductions.
- **Non-goals**: changing `bin/gsd-t-parallel.cjs::runDispatch` itself (that's the production-verified in-session dispatcher); changing the transcript viewer UI shape; retrofitting old command files (the hooks govern at the tool-call layer, so command files don't need per-command changes).
- **Related memory**: `feedback_parallel_headless_by_default.md` (the directive this item mechanizes), `feedback_unattended_overnight_only.md` (superseded — both modes first-class), `feedback_no_silent_degradation.md` (same enforcement philosophy applied to model-selection), `project_compaction_regression.md` (the failure mode this prevents).

## 22. Coord-Gate — cooperative rate-limit shaping across concurrent sessions

- **Problem**: Even with model-mixing (v3.18.18) + 3s stagger, N concurrent workers all firing heavy tool calls in the same 5-second window trip the Max subscription concurrent-session throttle. Current mitigations are statistical (stagger, model split); they don't coordinate when workers actually compete. A deterministic hold on the worker side would let 10–15 sessions coexist where today 5–6 is the ceiling.
- **Idea** (from user 2026-04-23): PreToolUse hook on every worker process. Before any tool call the hook classifies the tool as heavy (Task spawn, large Read, Bash running an LLM, WebFetch, long Grep) or light. On heavy, the hook takes a short lease on a shared coord file (`.gsd-t/.coord-gate/lease.json`). If the lease count is already ≥ `MAX_CONCURRENT_HEAVY` (default 3), the hook blocks (bounded spinwait with `Atomics.wait`) until a slot opens, then proceeds. Light tool calls bypass the gate entirely.
- **Why it works**: it turns the implicit contention into an explicit queue. Sessions don't step on each other at the subscription layer because only K of N are ever doing the expensive thing at once. The other N-K are holding cheap reads or idle. Max subscription's concurrent-session throttle fires on actual API pressure, not on process count — if pressure is capped, process count can grow.
- **Scope**:
  - `scripts/hooks/gsd-t-coord-gate.js` — PreToolUse hook. Reads tool name from the hook payload, classifies heavy/light via a table (heavy set: `Task`, `WebFetch`, `Bash` when command matches `/claude|npm test|playwright/`, `Read` when path size > 50 KB, `Grep` when pattern is multiline). Acquires/releases lease via file lock + `Atomics.wait` backoff (max 30s before giving up and proceeding fail-open).
  - `bin/gsd-t-coord-gate.cjs` — helper module (lease I/O, classifier table, clean-up of abandoned leases > 60s old).
  - Install block in `~/.claude/settings.json`: `PreToolUse` + `PostToolUse` for the hook.
  - Opt-in via env: `GSD_T_COORD_GATE=1` or `.gsd-t/coord-gate.enabled` file.
- **Success criteria**:
  1. With `MAX_CONCURRENT_HEAVY=3`, 10 concurrent workers firing mixed tool calls → 0 rate-limit 429s across a 10-minute test run, vs ≥3 429s without the gate (measured via the mitmproxy instrumentation in #23).
  2. P50 tool-call latency increase ≤ 30% for heavy tools (the gate waits, but only when saturated).
  3. P50 light-tool latency overhead ≤ 5ms (classifier + early-return).
  4. Deadlock test: two workers each holding a lease call a second heavy tool that needs a lease → no deadlock (lease is per-worker, not per-tool; nested heavy calls reuse the holder's slot).
  5. Cache-TTL test: gate hold time never exceeds the 5-min prompt cache window for the waiting worker (if it would, worker proceeds fail-open and logs a `coord-gate-cache-ttl-pressure` event).
  6. Stall upper bound: worker cannot be blocked > 30 seconds total across a single tool call — escape valve returns "proceed" with a telemetry event so no worker hangs indefinitely.
- **Non-goals**: replacing the stagger (it still prevents the initial burst before any worker has measured anything); replacing the model-split (different rate buckets = different pressure); applying to non-GSD-T projects (the hook early-returns when `.gsd-t/` is absent).
- **Pairs with**: #21 (spawn-enforcement — this is the runtime complement to the spawn-classifier), v3.18.18 model-mixing (same problem, different layer), #23 (provides the measured rate-limit headers that calibrate `MAX_CONCURRENT_HEAVY`).
- **Open question**: whether to classify purely by tool name or also peek at tool args (Bash command inspection). Arg inspection is more accurate but couples the hook to tool-arg shape changes. Start name-only; revisit after #23 data is in.
- **Related memory**: `feedback_parallelism_two_modes.md` (both modes need this), `feedback_token_measurement_hierarchy.md` (CW is the binding constraint — the gate enforces CW-aware pacing at the tool-call layer).

## 23. Rate-limit header instrumentation via mitmproxy (one afternoon)

- **Problem**: Every concurrency decision we make today — stagger ms, `MAX_CONCURRENT_HEAVY`, model-split ratio, backoff on 429 — is calibrated against *estimated* Max subscription rate-limit numbers (synthesized from public blog posts, Reddit, Anthropic docs). We do not measure the actual `anthropic-ratelimit-requests-remaining`, `anthropic-ratelimit-tokens-remaining`, or retry-after headers that the subscription returns in real time. The 2026-04-23 rate-limit incident showed we don't know our real ceiling — we only know when we cross it.
- **Idea** (from user 2026-04-23): Run mitmproxy as a local man-in-the-middle for one afternoon. Point the Claude Code binary at `HTTPS_PROXY=http://127.0.0.1:8080`. Capture every request/response header for Anthropic API calls during a heavy multi-session GSD-T run. Export the `anthropic-ratelimit-*` headers to `.gsd-t/metrics/rate-limit-headers.jsonl`. Replace estimates in every tunable with measured numbers.
- **Scope**:
  - `bin/gsd-t-ratelimit-instrument.cjs` — one-shot harness: configures mitmproxy with a capture script, spawns a known workload (e.g., 10-worker M46-style dispatch), collects headers for the run duration, writes `.gsd-t/metrics/rate-limit-headers.jsonl` (one row per API response).
  - `scripts/mitm-capture.py` — mitmproxy addon that parses headers and POSTs to a local sink (no LLM inference leaves the machine; headers only).
  - `bin/gsd-t-ratelimit-report.cjs` — reads the JSONL, emits `docs/ratelimit-measured.md` with: actual RPM ceiling observed, actual ITPM/OTPM ceilings, cache-read offsets, concurrent-session throttle behavior (when multiple sessions get throttled vs individually).
  - One-time setup doc: `docs/instrumentation-setup.md` (install mitmproxy, trust CA, set `HTTPS_PROXY`, tear-down).
- **Success criteria**:
  1. `.gsd-t/metrics/rate-limit-headers.jsonl` contains at least 500 rows covering ≥3 workload profiles (light reads, heavy Task spawns, mixed).
  2. `docs/ratelimit-measured.md` replaces every "estimated" number in `docs/architecture.md` and `docs/infrastructure.md` with a measured range.
  3. `MAX_CONCURRENT_HEAVY` (#22) is calibrated from measured data, not guessed.
  4. v3.18.18 stagger-ms default is re-evaluated: is 3s optimal? Under-tight? Over-loose?
  5. Teardown is clean: mitmproxy process killed, `HTTPS_PROXY` unset, CA cert removed from trust store — no lingering MITM after the session.
- **Non-goals**: long-running production instrumentation (this is a one-afternoon measurement, not a standing telemetry pipeline); logging request bodies (headers only — no prompt content leaves the machine, explicitly); replacing the Anthropic Console as the source of truth for billing.
- **Pairs with**: #22 (this provides the calibration data), v3.18.18 (this validates the stagger+model-mixing decisions), `feedback_anthropic_key_measurement_only.md` (same spirit: measure, don't estimate).
- **Open questions**:
  1. Does the Max subscription expose the same `anthropic-ratelimit-*` headers as API-key access? If not, we need a different signal (e.g., observe 429 timing patterns vs header values).
  2. Is the concurrent-session throttle visible in a header, or only inferable from response timing? (If only timing, we measure inter-response gaps under load.)
- **Related memory**: `feedback_measure_dont_claim.md` (the philosophy this item operationalizes), `feedback_anthropic_key_measurement_only.md` (measurement infra is separate from inference infra).

## 24. Dynamic work-stealing in `runDispatch` (2-concurrent + min-interval sliding window)

- **Problem**: Today's `runDispatch` partitions tasks across N workers up front, then launches them all with a simple between-spawn sleep (v3.18.19 defaults: `maxWorkers=2`, `staggerMs=10000`). When `N > 2`, the current code only launches the first 2 and sleeps 10s between them — there is no queue-pull-on-completion semantics. If worker 0 finishes in 20s but worker 1 is still running at 3 minutes, no third worker starts even though a slot is free AND the 10s interval has elapsed. This wastes concurrency capacity the moment partitioning is uneven.
- **User directive (2026-04-23)**: "when launching two workers stagger them by 10 seconds. If one completes first and there's more work to do, launch the next one immediately. If the last worker was launched less than 10 seconds ago, wait 10 seconds before you launch it." — i.e., a sliding-window dispatcher where the rules are:
  1. `max_concurrent = 2` (hard cap on in-flight workers).
  2. `min_spawn_interval = 10000ms` between any two consecutive launches.
  3. When a slot frees and a queued subset exists: if `now - lastLaunchAt >= 10000` → spawn immediately; else wait `10000 - (now - lastLaunchAt)` ms, then spawn.
  4. Workload is a queue of task-subsets, not a pre-partitioned fixed array.
- **Current shortcut (landed 2026-04-23)**: Defaults changed to `maxWorkers=2` + `staggerMs=10000`. This satisfies the common N≤2 case (where the two workers are partitioned once, launched 10s apart, and that's that). It does NOT implement dynamic refill for N>2 subsets. Explicitly deferred per option C in the discussion.
- **Scope**:
  - Refactor `runDispatch` in `bin/gsd-t-parallel.cjs` so `subsets` is a queue, not a fixed array consumed in a for-loop.
  - Introduce a small scheduler: `activeWorkers` set, `lastLaunchAt` timestamp, `while (queue.length > 0 || activeWorkers.size > 0)` loop that spawns-when-eligible.
  - Preserve `spawnStaggerMs` semantics (0 = no delay bypasses the wait).
  - Preserve `maxWorkers` semantics as the concurrency cap (not the total count).
  - Event stream: emit `worker_slot_free` and `worker_launch_deferred` events so observability tracks real timing.
  - Full suite must stay green. New test cases:
    1. 4 subsets, `maxWorkers=2` → launches go 0s, 10s, (waits for completion), 10s after next slot free.
    2. Worker completes before 10s elapses → next spawn waits `10000 - elapsed` ms.
    3. Worker completes after 10s elapses → next spawn fires immediately.
    4. All workers complete → scheduler exits cleanly.
    5. One spawn throwing does not block the queue.
- **Success criteria**:
  1. For N=4 subsets with `maxWorkers=2`, measured wall-clock is within 5% of the ideal `max(launch_0, launch_1) + sum(sequential_pulls)`.
  2. Zero rate-limit errors across a 20-task synthetic workload at the new defaults.
  3. `parallelism-report.cjs` shows active-worker-count saturating at 2 for the duration of the run (not falling to 0 then 1 then 2 as subsets complete).
- **Non-goals**: cross-mode queue sharing (in-session + unattended remain separate dispatchers); priority queuing (FIFO only); task-level retry on failure (that's `gsd-t-debug`'s job).
- **Pairs with**: #22 (coord-gate is the account-wide rate limiter; this is the per-dispatch scheduler), #23 (measured rate-limit data will tell us whether 10s is the right interval or should be adaptive).
- **Related memory**: `feedback_measure_dont_claim.md` (the landed shortcut was measured; the full rewrite needs its own measurement before we claim 5× saturation).

## 25. gsd-t-bench — A/B eval harness for methodology changes

- **Type:** feature | **App:** gsd-t | **Category:** commands
- **Added:** 2026-05-13
- **Problem**: GSD-T is a methodology product, but methodology changes ship on vibes. Today the only measurements are operational (token-log, ELO rollup) and defect-based (qa-issues). There is no controlled A/B harness to answer "did this edit to gsd-t-execute.md / templates/stacks/playwright.md / model assignment make GSD-T better or worse?" The gap shows up most when stack rules are added (do they earn their context cost?) and when commands are tuned (is the new prompt actually winning?).
- **Pattern source**: `anthropics/skills` repo `skill-creator` eval harness (reviewed 2026-05-13). Adapt — do not import. Key primitives worth adopting: paired with/without runs spawned in same turn, `evals/evals.json` schema with `prompt + expected_output + files + assertions[]`, `assertions[]` graded with `text/passed/evidence` fields, `benchmark.json` aggregating pass_rate + duration + tokens with mean ± stddev, analyst pass surfacing non-discriminating assertions and high-variance evals, generate_review-style side-by-side viewer.
- **Four use cases (in scope for this milestone)**:
  1. **Command-file edit A/B** — paired runs (new command file vs previous git revision) against a fixed eval set; benchmark.json compares pass rate, tokens, duration; analyst flags regressions.
  2. **Model routing eval** — per-command sweep across haiku/sonnet/opus on the same eval set; output drives the haiku/sonnet/opus assignments in CLAUDE.md (e.g. "this command can drop from sonnet to haiku without regression").
  3. **Stack-rule effectiveness** — per-rule with/without comparison for each `templates/stacks/*.md`; identifies rules that earn their context cost vs. dead weight.
  4. **Pre-publish regression gate** — bench runs as a release gate inside `/cpua` / `gsd-t-version-update-all`; canonical eval set must not regress before publish.
- **Trigger**: pre-commit gate auto-runs when files under `commands/**` or `templates/**` change. Blocks commit on regression (configurable threshold). Manual `gsd-t-bench` command also available for ad-hoc runs.
- **Scope (sized 2-3 domains)**:
  - **D1 — Harness core**: `bin/gsd-t-bench.cjs` with paired-spawn runner, evals.json schema, assertion grader, benchmark.json aggregator. Library-first (consumable by other commands).
  - **D2 — Pre-commit gate + canonical eval set**: git hook installed by `gsd-t install`; seed eval set covering top-5 commands; threshold config in `.gsd-t/bench-settings.md`.
  - **D3 — Viewer + analyst pass**: side-by-side output viewer (adapt skill-creator's generate_review pattern); analyst surfaces non-discriminating assertions and flaky evals; integrate with `/cpua` release gate.
- **Success criteria** (measured, per `feedback_measure_dont_claim`):
  1. A deliberate regression to a command file (e.g. removing a required step) is caught by the harness with pass_rate delta ≤ -0.10 and the gate blocks the commit.
  2. A model-routing sweep across 3 commands produces actionable verdicts (haiku/sonnet/opus per command) with stddev tight enough to be load-bearing.
  3. At least one `templates/stacks/*.md` rule is empirically validated or retired based on bench data within the milestone's verify phase.
  4. `/cpua` integration: a synthetic regression in a pre-publish run halts the publish step.
- **Non-goals**: skill creation (this is for GSD-T commands, not Agent Skills); UI eval (covered by existing design-verify); production user telemetry (out of scope — bench runs on canonical synthetic evals).
- **Pairs with**: `feedback_measure_dont_claim` (the philosophy this operationalizes for methodology changes); existing `qa-issues.md` (bench measures *intended* outcomes; qa catches *unintended* defects — complementary).
- **Defer until**: M44 cross-domain parallelism is integrated. Bench wants the parallel substrate to spawn paired runs concurrently; doing this before M44 lands means rebuilding the spawn layer.

## 26. Competition Mode — generate-and-judge for upstream wide-solution-space phases
- **Type:** feature | **App:** gsd-t | **Category:** orchestration · quality
- **Added:** 2026-06-05 | **Origin:** brainstorm 2026-06-05 (2× deep-research grounded)
- **Status:** ✅ COMPLETED as M82 at v4.1.10 (2026-06-05) — see `.gsd-t/progress.md`. v1 shipped: objective partition judge + workflow competition arm + contract + `--competition N` flags. SC#1 measured (3× parallelism on M82's own partition). Below is the original spec, retained for history.

### One-line
An opt-in `competition: N` capability that fans out N parallel candidate-producers on **upstream, wide-solution-space, pre-contract phases** (milestone decomposition, partition, discuss, design-build), then a **judge stage** selects-or-synthesizes a winner. This is the *generative* dual of the existing orthogonal validation triad (which is *adversarial* competition). The contract is the watershed: **generate-and-judge above the contract; attack-and-filter below it.**

### Why (the core insight)
GSD-T today filters hard (Red Team / QA / code-review attack one artifact) but **generates singly** — every upstream artifact is a single draft that then gets filtered. There is no "vs.", only "pass/fail". Competition mode adds the missing generator: many candidates → one judge. Leverage of a decision = (width of solution space) × (downstream blast radius); competition should be spent only where that product is high — which is precisely the pre-contract phases.

### Evidence base (2× deep-research, 2026-06-05 — citable findings)
- **Generation scales, selection is the bottleneck.** Best-of-N *coverage* (fraction solved by ≥1 of N samples) scales log-linearly with N across 4 orders of magnitude — SWE-bench Lite 15.9%@N=1 → 56%@N=250 (Brown et al., "Large Language Monkeys," arXiv 2407.21787, 2024; **3-vote verified**). BUT coverage is an *oracle-selection upper bound* — the realized benefit is **bounded by judge quality, not N**. ⇒ **The judge IS the feature.** A weak judge tripling spend to pick among 3 = waste.
- **Synthesis beats pick-one on loosely-coupled free-form tasks.** MoA generative aggregator 61.3% vs LLM-ranker-picks-one 47.8% LC win on AlpacaEval 2.0 (arXiv 2406.04692; **3-0 verified**). "Collaborativeness": a model improves when shown others' outputs even when they're lower quality (**2-0**). Caveat: this is GPT-4-judged *preference*, strongest for list-like/free-form artifacts, NOT coupled correctness-critical ones.
- **Synthesis-beats-best is NOT unconditional** — the "no regressions" claim was **3-0 REFUTED**. Frankenstein is real.
- **The Frankenstein mechanism is quality variance, not (only) coupling.** Aggregation quality is **far more sensitive to candidate quality than to diversity** (regression coeffs: MATH 4.72 quality vs 2.84 diversity; CRUX ~3.2×; **3-0 verified**). "Pursuing cross-model diversity may inadvertently include low-quality models → quality-diversity trade-off" that degrades the merge (arXiv 2502.00674, Self-MoA, ICLR 2025; **3-0 verified**).
- **Self-MoA > Mixed-MoA.** Synthesizing N samples from *one strong model* beats mixing diverse models by **6.6% AlpacaEval, 3.8% avg** (**3-0 verified**). ⇒ **Default generators = N samples of one strong model, NOT a zoo of models.** Cheaper AND better. (Aggregating samples of one model is still synthesis — "synthesis beats pick-one" survives this.)
- **Don't build debate.** Three independent sources leaned *against* multi-agent debate beating independent-sampling + judge at lower cost (unconfirmed but directionally consistent). Keep fan-out **independent**; skip debate.
- **N small.** Evidence leaned toward optimal N < 10; SWE-bench's elbow is early (≈N=5). ⇒ **Default N=3, cap N=5.**

### Selection policy — the two-gate rule (this is the spec)
Per-phase, the judge decides pick-one vs synthesize via **two independent gates; synthesize only when BOTH pass**:

| Gate | Synthesize | Pick-one |
|------|-----------|----------|
| **Candidate quality uniform?** | Yes → safe to merge | No → pick-one (or quality-gate the pool first) |
| **Artifact shape** | List / loosely-coupled (requirements, risks, tests) | Coupled thesis (milestone strategy, architecture) |

Three artifact classes follow from this:
1. **Coupled thesis** (milestone strategy, architecture decision) → **pick-one** (graft = Frankenstein; parts mutually justify each other).
2. **Independent line-items** (risk registers, requirements, acceptance criteria, test cases) → **union/dedup**, not holistic regraft — strictly safe, strictly additive.
3. **Structurally-validated** (partition) → **synthesize + re-validate** — the oracle re-checks coherence, so even coupled output can be grafted safely.

**Operational refinement:** for milestone/discuss, do **pick-one at the thesis level, union at the embedded-list level** (take the winning strategy whole, then enrich it with non-overlapping good line-items the losing candidates surfaced). That's "winner + salvage the orphaned good ideas" — the graft-the-best instinct made safe by applying it only to the separable layer.

### Phase applicability (where it gets a `competition:` flag — and where it must NOT)
| Phase | Solution space | Blast radius | Verdict |
|-------|---------------|--------------|---------|
| Milestone decomposition | very wide | whole project | **eligible** — highest altitude; pick-one (coupled thesis) + list-union |
| Discuss (architecture) | wide | whole milestone | **eligible** — its literal purpose; pick-one + list-union |
| **Partition** | wide + **objective oracle** | plan→execute→integrate | **v1 BEACHHEAD** — synthesize+re-validate |
| Design-build | medium (ambiguous designs) | the screen | eligible (conditional); visual-judge pick-one |
| Plan / execute / verify / integrate / test-sync | narrow / one right answer | local | **INELIGIBLE** — execute already has the adversarial triad; competition here = pure waste |

### v1 beachhead: PARTITION (ship here first)
Partition is the **only** competing phase with a built-in *objective* fitness function — `gsd-t parallel --dry-run` / `bin/gsd-t-file-disjointness.cjs`. Its judge is a **calculator, not a critic** — it sidesteps the entire LLM-judge-bias problem. Candidate partitions score on measurable axes: max parallelism (disjoint domain count), wave depth (fewer serial gates = better), file-boundary cleanliness (zero overlap = valid). This is the one phase where the research's caveat ("competition only pays if you can select") is *provably* satisfied. Lowest risk, measurable payoff, proves the machinery. Synthesis here is safe because the oracle re-validates any graft; on failure, fall back to best valid pick-one.

### Judge rigor (mandatory for subjective phases — milestone/discuss/design)
Because "the judge IS the feature," subjective-phase judges MUST ship with bias mitigations from v1:
- **Blind + shuffled** — strip author identity (candidates labeled A/B/C), randomize order per judge call → kills position bias. (cheap, mandatory)
- **Different-model judge** — judge runs on a different model than the generators (cross-family) → attacks self-preference bias. (cheap, mandatory)
- **Rubric-scored** — score each candidate on explicit weighted axes (coherence, completeness, risk-coverage, parallelism, simplicity), not holistic "which is better" → reduces verbosity/halo bias. (mandatory)
- **Panel + majority** (optional, costs 3× judge calls) — 3 independent judges vote, ties → highest rubric score. Reserve for the highest-altitude calls (milestone decomposition).

### Composition with the orthogonal validation triad
Orthogonal triad = **adversarial competition** (one candidate, many critics → catches what's *wrong*). Competition mode = **generative competition** (many candidates, one judge → finds what's *best*). They are duals and **stack**: competition produces the best upstream artifact; the triad still validates the downstream code. Competition mode does NOT touch verify — verify is already covered by the adversarial dual.

### Cost posture
- **Default OFF** (opt-in per phase: `/gsd-t-partition --competition 3`). Conservative is now *evidence-backed* (synthesis-beats-best not unconditional; subjective-phase judge unproven). N=3 captures the curve's elbow.
- Consider **budget-scaled N** later: `N = budget.total ? clamp(floor(total/150k), 2, 5) : 0` — matches the existing Workflow `budget` global. Defer until v1 (partition) proves value.
- Token-honesty: competition ~N× the spend of the wrapped phase. Justified ONLY pre-contract where blast radius is large. Max-funded build work has zero marginal $ cost, but context-window + wall-clock are real — hence N small, opt-in, upstream-only.

### Proposed shape (finalize at partition)
- Extend `templates/workflows/gsd-t-phase.workflow.js` (the generic upper-stage runner already covers partition/discuss/milestone/design-decompose) with a `competition` arg: when `args.competition > 1`, replace the single producer `agent()` with a `parallel()` of N producers (Self-MoA: same strong model, varied by index/seed in the prompt) → a **judge stage** implementing the two-gate policy → emit the winner/synthesis as the phase artifact.
- Partition's judge calls the **existing oracle** (`gsd-t parallel --dry-run` via the inline runCli helper) to score + re-validate — no new judge model needed for v1.
- New contract `.gsd-t/contracts/competition-mode-contract.md` v1.0.0: the two-gate selection policy, the three artifact classes, the Self-MoA generator default, the judge-rigor mandatories, and the phase-eligibility table. (Sibling to `orthogonal-validation-contract.md` — generative dual of the adversarial one.)
- Thin invoker flags on eligible command files (`gsd-t-partition.md`, `gsd-t-milestone.md`, `gsd-t-discuss.md`, `gsd-t-design-build.md`): `--competition N`.

### Success criteria (measured, per `feedback_measure_dont_claim`)
1. **Partition (oracle-judged):** on a multi-domain milestone, `--competition 3` produces a partition with **strictly higher measured parallelism (disjoint-domain count) or shallower wave depth** than the N=1 baseline, on ≥2 of 3 test milestones — with zero file-boundary overlaps (oracle-validated). If competition never beats baseline, the feature is rejected for partition.
2. **No Frankenstein:** every synthesized artifact passes its phase's coherence check — partition re-validates via the oracle (0 invalid grafts shipped); list-union artifacts contain zero contradictory items.
3. **Judge bias controls demonstrated:** a position-bias probe (same candidates, reversed order) yields the same winner ≥90% of the time on the subjective-phase judge.
4. **Cost bounded:** competition-on phases cost ≤ N× the N=1 baseline tokens (no runaway judge loops).

### Non-goals
- Multi-agent **debate** (evidence leans against it; keep fan-out independent).
- Competition on **execute/plan/verify/integrate** (post-contract, narrow space — the adversarial triad already owns the downstream).
- A **model zoo** of diverse generators (Self-MoA beats Mixed-MoA — same strong model, N samples).
- Replacing the orthogonal validation triad (this is its generative *complement*, not a substitute).

### Defer until
M44 cross-domain parallelism is integrated (competition leans on the `parallel()` substrate + `budget` global). The native Workflow runtime (M81, v4.0.29) provides the `parallel/agent/budget` primitives this needs — so it's buildable on the current runtime once a partition-suitable milestone is available to test against.

### Related
- `.gsd-t/contracts/orthogonal-validation-contract.md` (the adversarial dual)
- `bin/gsd-t-file-disjointness.cjs` + `gsd-t parallel --dry-run` (the partition oracle = v1 judge)
- `templates/workflows/gsd-t-phase.workflow.js` (the generic upper-stage runner to extend)
- memory: `feedback_native_workflow_redteam_catches_more.md` (perspective-diverse Workflow stages catch more), `feedback_measure_dont_claim.md` (success = measured), `feedback_deterministic_orchestration.md` (gates in JS, not prose — the oracle judge embodies this)
- Deep-research transcripts (2026-06-05): tasks `wkcnmqw8u` (best-of-N / judge / debate) + `wt4z2eqcp` (synthesis vs pick-one / MoA / Frankenstein)

## 27. Session Retrospective Agent (self-improving loop)
- **Type:** feature | **App:** gsd-t | **Category:** templates
- **Added:** 2026-06-09
- Scheduled + event-triggered review of session transcripts across projects (`~/.claude/projects/*`), detecting recurring problems and architectural thrash, proposing methodology improvements through a governed pipeline. The third loop in GSD-T's dual structure: within-run (validation triad + competition), **across-run (this)**, across-model (manual reassessment). **DESIGN SETTLED 2026-06-09**: see `.gsd-t/CONTEXT.md` (m85(discuss) commit 271e5a9) for the locked L1–L5 architecture — 4 LLM agents + 3 deterministic CLI gates; append-only `.gsd-t/retro/ledger.jsonl` with closed 4-verb edge set (OBSERVES/PROPOSES/REJECTS/ADOPTS), supersede/prediction as fields; two-layer silence bar (deterministic recurrence gate R=3 era-fenced + Fable coherence judge biased SILENT, CRITICAL escape R=1); 3 lens-paired red-team adversaries (Regression/Goodhart/Evidence); weekly cron + sentinel event triggers (debug needs-human ×2, VERIFY-FAILED ×2, red-team non-convergence ×1), out-of-band ONLY.

### Governor rules (unchanged from original spec)
- Propose, never apply — blast radius is a markdown/JSONL file
- Evidence-ladder proposal schema: cited session/message refs (required) → quantified cost → shadow-test result when feasible → falsifiable post-adoption prediction, checked later
- Structural changes shadow-tested via `gsd-t-audit` before adoption
- Model-release re-baseline: pre-release sessions fenced out of recurrence thresholds; pre-release ledger rejections marked eligible-for-reexamination

### Acceptance criterion (known-answer test)
Run against binvoice session `692fe9fc-2e09-490c-bb1d-3ae54f865c41`: must cluster the three symptom descriptions (count-shows-zero, purple-banner-replacing, Gnomie-leak) to ONE virtualized-DOM root cause and flag architecture-rethink by ~message 12. Plus the negative fixture: unrelated symptoms must stay SILENT. Both as executable CI fixtures (`templates/test-fixtures/retro/`). Prototype the symptom-clusterer FIRST.

### Scope / dependencies
3–4 domains. M85 (tier policy + Fable) SHIPPED — `model_era` stamps from `bin/gsd-t-model-tier-policy.cjs`.

## 28. Vestigial component elimination + headless reconciliation
- **Type:** improvement | **App:** gsd-t | **Category:** cli
- **Added:** 2026-06-09
- Remove confirmed-dead components and fix-or-remove the broken headless arm (deep-dive audit 2026-06-09). Targets: `bin/orchestrator.js` + `bin/design-orchestrator.js` (zero callers since M61/M65), `bin/gsd-t-task-brief*.{js,cjs}` (abandoned M40 infra, test-only refs), `bin/gsd-t-context-brief-kinds/` (M56, never wired), compaction-pressure machinery (compactions.jsonl stale) + context-meter remnants (config loader at gsd-t.js:3023 loads for nothing). Headless arm: TD-114 (gsd-t-parallel.cjs runDispatch requires deleted headless-auto-spawn.cjs → SILENT fan-out demotion to sequential — violates no-silent-degradation) and TD-116 (gsd-t-unattended* commands MODULE_NOT_FOUND) — rewrite on native Workflows + /loop, or delete and de-register. RULE: every deletion target gets a requirer-grep before removal (M65 KEEP-list rule — deletion lists are hypotheses). Doc ripple: README headless section, command tables, CHANGELOG. Largely promotable from techdebt (TD-114, TD-116, TD-123 overlap). Scope: 1–2 domains, 1 wave.

## 29. June 22 decision point: Fable 5 promo ends — re-decide tier policy + session default
- **Type:** improvement | **App:** gsd-t | **Category:** cli
- **Added:** 2026-06-09
- Fable 5 promotional access ends **2026-06-22 23:59 PT** (support article 15424964). After that, Fable is NOT in plan limits — every Fable token bills usage credits (~API rates $10/$50 per MTok). Decisions due by then: (1) flip the SESSION default back to opus (`/model`) — the dominant cost (~$20-60/heavy day if left on fable); (2) re-decide the 5 GSD-T Fable stages — measured estimate ~$15-25/typical milestone at credit rates; suggested posture: keep Red Team + pre-mortem on fable (~$8-10/milestone), revert probes + judge to opus unless M86-era measurements show a quality delta. Thanks to M85 this is a ONE-FILE edit (`bin/gsd-t-model-tier-policy.cjs` + lint ripple). Counter-consideration: the measured A/B showed a fable single-draft TIED 3-opus competition at 42% cost — on some phases fable may REDUCE cost; re-measure with real billing. (3) M86 retro-agent silence-judge tier — same decision, same file.
