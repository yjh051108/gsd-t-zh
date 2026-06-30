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

## 30. Model profiles — standard/pro/premium tier-spend switch with per-stage overrides — **PROMOTED → DEFINED as M86 (2026-06-10)**
- **Type:** feature | **App:** gsd-t | **Category:** cli
- **Added:** 2026-06-10 | **Status:** DEFINED — see `.gsd-t/progress.md` § Current Milestone M86 (branch `m86-model-profiles`)
- **HARD DEADLINE: must ship before 2026-06-22** (Fable promo end, backlog #29) — it converts the June-22 checklist into one command per project. Origin: user cadence is 10–20+ milestones/week; even the pro posture ($8–10/milestone in usage credits post-promo) is $300–800+/month, so Fable spend needs a selectable control surface, not a code edit.

### Design (settled in discussion 2026-06-10)
- **Three profiles** as a second dimension on the M85 policy module's `STAGE_TIERS`: `standard` (zero fable — pre-M85 tiers: probes opus, judge sonnet, pre-mortem/red-team opus, debug both-cycles opus), `pro` (red-team + pre-mortem + debug-cycle-2 on fable ≈ $8–10/milestone), `premium` (all 6 fable stages ≈ $15–25/milestone).
- **Per-project config** (`.gsd-t/model-profile.json` or field in existing config) with global default; per-stage overrides: `{ "profile": "pro", "stageOverrides": { "competition-judge": "fable" } }`. Projects diverge: a consumer project can run `standard` while the GSD-T repo runs `pro`; a single important milestone can be bumped per-run.
- **Mechanism = invoke-time injection (M69 path, NOT file rewriting):** command invokers call the existing resolver (`gsd-t model-tier-policy resolve --profile ...`), get per-stage concrete models, inject via workflow `args`; designated workflow stages become `model: overrides["<stage>"] ?? "<premium-literal>"` — literals stay the premium fallback, the M85 lint keeps guarding them (update lint to unwrap the `??` form), no tracked files mutate on switch. This finally makes the resolver envelope LIVE (closes the M85 pre-mortem dead-export concern for real) — including `requiresThinkingOmitted` consumption at invoke time.
- **CLI:** `gsd-t model-profile [standard|pro|premium]`, `gsd-t model-profile set-stage <stage> <tier>`, `gsd-t model-profile --json` (status); active profile surfaced in `gsd-t status` + the session banner.
- **Scope guard:** profiles govern GSD-T workflow stages ONLY — the session default model (`/model`) is explicitly out of scope (documented).
- **Bonus capture:** the first partition run of this milestone banks the outstanding M85 AC(c) partition-probe live `⚙ [fable]` line (documented evidence gap).
- Scope: ~2 domains (policy-module profiles + config/CLI; invoker wiring + workflow `??` forms + lint update + docs), 1 wave. Contract: model-tier-policy-contract.md → v1.1.0.

## 31. Platform-invariants injection + micro-pre-mortem for debug fixes (left-shift the platform knowledge)
- **Type:** improvement | **App:** gsd-t | **Category:** templates
- **Added:** 2026-06-10
- Upstream the binvoice S2-M2 retrospective fixes into GSD-T proper. **Two-project evidence base, same week (clears the retro-agent silence bar: same root cause ≥2 sessions):** binvoice S2-M2 — 13 verify findings over 4 debug cycles, ~half plan-knowable platform facts, cycle-3 fix created cycle-4's cross-realm bug (session `2ecf0179`, retro 2026-06-10 13:55, artifact `binvoice/.gsd-t/contracts/platform-invariants.md` v1.0.0 STANDING); GSD-T M85 — 4 pre-mortem cycles 6→3→1→3 non-quiescing (TD-294) with two cycles spent attacking mechanism-pinned bindings.

### Three coherent pieces
1. **Platform-invariants template** (`templates/platform-invariants.md`): per-project standing checklist of platform facts + failure-mode questions, seeded from binvoice's generalizable items — invariants-not-mechanisms (state "no payload reaches persist unvalidated on ANY transport", not "the Fastify schema validates X"), every async subsystem names its production trigger + a test firing the REAL trigger, stateless-deploy rules (fail-closed config: dead deploy > open deploy; no in-process state on restartable targets), field-class validation (one date field validated ⇒ all are), exact-match origin checks, sanitized errors on every channel, test-weakening-is-a-defect. Project-specific sections (MV3 realms, Cloud Run) stay per-project; the template ships the question framework + the universal items. Bootstrap during init/partition when absent.
2. **Pre-mortem consumes it** (`templates/prompts/pre-mortem-subagent.md` + plan phase wiring): the protocol gains a MANDATORY input — read the project's `platform-invariants.md` if present and check the plan against EVERY item (checklist pass, cheap and deterministic-ish) BEFORE the adversarial pass; plans must answer the failure-mode questions per subsystem (restart? missing config in prod? second transport? cross-context state? who triggers it in production?). Rationale: pre-mortems are adversarial generalists reasoning from plan text — platform facts are checklistable knowledge that should be INJECTED, not rediscovered at ~300k tokens per cycle.
3. **Micro-pre-mortem for debug-cycle fixes** (`gsd-t-debug.workflow.js` + debug-loop contract): milestone work gets 3 pre-mortem cycles; debug hotfixes currently get ZERO adversarial review before commit — "cycle-3 fix creates cycle-4 finding" is the predictable result (measured in binvoice). Add a bounded micro-stage after each cycle's proposed fix, before commit: one fresh-context agent (sonnet-tier, small: the diff + the invariants file + the symptom), verdict proceed/revise, capped at 1 round (no recursion — the quiescence lesson from TD-294 applies here too).

### Relation to existing items
- Complements TD-294 (gate quiescence) — #31 reduces what adversarial cycles must FIND; TD-294 fixes when they STOP.
- Feeds the retro agent (#27): this item is itself the manual prototype of the retro pipeline (cross-session pattern → evidence-cited proposal → governor review) and `platform-invariants.md` is the natural home for future retro-adopted platform rules.
- Origin artifacts: binvoice commit of platform-invariants.md (2026-06-10), GSD-T Decision Log M85 plan-hardening entries (archived in m85 milestone snapshot).
- Scope: ~2 domains (template + pre-mortem/plan wiring; debug workflow micro-stage + contract + lint), 1 wave.

## 32. Proportional gating — deterministic diff-scoped verification lanes (trivial changes stop paying the full toll)

**Added**: 2026-06-12
**Type**: framework feature
**Origin**: user, watching binvoice 2026-06-11/12 — "mostly UI changes taking a very long time… they should be completed very quickly," then proposing a scoping/risk session that skips preflight + full gating when changes are trivial. Evidence: 11 quick runs in ~27h each paying the full battery (server 426 + web 288 + root 567 + tsc ×3 + builds + 39 Playwright + live smoke + doc ripple) — truly-UI-only quicks landed in ~12 min, so the fixed floor dominated; meanwhile 3 of 5 "trivial UI" requests were actually pipe bugs (silent extension egress CRITICAL, missing /orders/stats endpoint, orphaned PairingTokenPanel), proving INTENT-based triage misclassifies.

### Design (settled in discussion 2026-06-12)
- **Triage is computed from the DIFF, not judged from intent.** Post-edit, pre-commit, a deterministic classifier (a calculator in the disjointness-oracle/competition-judge house style — NOT an LLM confidence claim; the agent wanting to skip the gate must not grade its own exam, per feedback_deterministic_orchestration) assigns a lane from changed files/surfaces:
  - **Lane 0** docs/comments/md → commit gates only.
  - **Lane 1** style-only (tokens/CSS/classNames, zero logic delta) → tsc + affected package units + Playwright specs mapped to affected screens (M52 journey-coverage tooling already maps components→specs).
  - **Lane 2** single-package logic, no contract/schema/API/IPC/money surface → package battery + targeted E2E.
  - **Lane 3** contracts/schema/IPC/cross-package/payment paths → full battery (today's behavior).
  - Ambiguity, allowlist miss, or mixed batch → FAIL TOWARD Lane 3.
- **Skip = deferral, never exemption** (preserves feedback_no_silent_degradation): lane-skipped changes accumulate in a ledger; the FULL battery sweeps the accumulated delta at next milestone verify or every N skipped commits. Lane decision surfaced loudly per run (`lane: style-only · full battery deferred (4 commits pending)` — model-profile-style surfacing).
- **Tripwire learning loop**: a sweep-attributed regression from a lane-skipped commit promotes that file-class out of its cheap lane.
- **Up-front scoping session** = planning/estimation aid only ("looks like Lane 1, ~10 min"), never the enforcement point — intent-time enforcement is exactly how "just UI" becomes an unverified server endpoint.

### Lane-scoped EXECUTION path + per-lane SLOs (added 2026-06-12 from the unit-price-column discussion)
The full battery is only ~half the 15–20 min cost of a trivial change; the other half is workflow CEREMONY (preflight agent + brief generation + worker spawns ≈ 3–5 min) and milestone-grade doc ripple (~2–3 min) that buy nothing for a one-component edit. So lanes scope the EXECUTION PATH, not just the tests:
- **Lane ≤2 → LEAD-DIRECT**: the lead agent makes the change in-session — no preflight agent, no brief, no worker spawn (codifies the existing "localized bugs: hands-on fix, not spawns" memory as a classifier-triggered rule, not a judgment call). Lane 3 → full quick/execute workflow as today.
- **Right-sized doc ripple**: Lane 0/1 = one-line decision-log entry + commit; milestone-grade paragraphs reserved for Lane 3.
- **Falsifiable per-lane SLOs (measured, not claimed — per feedback_measure_dont_claim)**: Lane 1 exemplar — "add a unit-price column to a grid where the data is already captured": command-start → commit **≤5 min wall-clock**, demonstrated on a real change in a real project (edit ~2 min + targeted gates ~1.5 min [tsc + affected package units + mapped Playwright spec] + one-line ripple + commit ~1 min). Current measured baseline: 15–20 min (binvoice 2026-06-12, user-reported + commit-cadence-confirmed).

### Relation to existing items
- Same proportionality theme as #31 (pre-mortem severity floors/cycle budgets) — the framework lacks effort calibration in BOTH directions: gates that can't shrink (this item) and adversarial loops that can't stop (#31/TD-294).
- Tension acknowledged: Lane 1/2 deliberately relax the E2E-always enforcement rule (born from real burns) — the deferral ledger + sweep is what makes that relaxation safe and repayable, not silent.
- Scope: ~2-3 domains (diff classifier cjs + ledger; quick/execute workflow lane wiring + surfacing; contract + lint + docs), 1-2 waves.

## 33. Firing debug-cycle circuit-breaker + repro-fixture-on-regression (stop the whack-a-mole)

**Added**: 2026-06-15
**Type**: framework feature
**Origin**: user, after the binvoice FB-modal-comment-capture saga of 2026-06-15 — a "working perfectly yesterday afternoon" feature that took **~50–100 conversational turns across two sessions** to (partially) fix. Forensic retro of sessions `4d91f5df` (fix saga) + `74d40b58` (still-open continuation). Two genuinely EXTERNAL root causes (FB moved the "Open post" modal into a child iframe → content script ran top-frame only; FB dropped `data-comment-id` off comment articles) were first misdiagnosed as binvoice's own reconcile/PAST work, then GSD-T spent an afternoon patching DOM-position heuristics one variant at a time — **7 commits, all `m61(debug-cycle1)`, each a fix-for-the-prior-fix** — culminating in a commit literally titled "end the 5-cycle whack-a-mole." The convergent architectures (TEXT-FIRST; then one-scanner/two-views) were **designed and FORCED by the user**, not arrived at by GSD-T. As of the last session the bug is still open (no commit; user demanding pseudocode before allowing more edits).

### The two diagnosed failure modes (both have a documented rule that did NOT fire)
1. **The debug loop has no circuit-breaker that actually fires.** The rule exists ([[feedback_coverage_check_structural_not_substring]]: ">2 cycles, each fix spawns a variant = design defect → halt + escalate"). GSD-T COULD see it was looping — it explicitly counted "third distinct cause", "four cycles deep… may be a 5th variant", "wrong twice in a row… that oscillation is a signal" — and **immediately dispatched another point fix each time**, routing to `/gsd-t-debug` 18 times. Self-aware NARRATION was substituted for the required ACTION. It deferred the rethink to "after this next patch lands" (a contingent future halt = no halt).
2. **No reproduction-first discipline on a "worked yesterday" regression.** Diagnosis depended entirely on the user hand-running console probes and pasting DOM blobs; there was no fixture-driven repro until the user's two HTML blobs became "killing fixtures" — at the very END. Failures were silent (comments vanished, no signal) → an hour of console spelunking to localize ONE drop. Each fix was eyeballed by the user, not measured.

### Design (three pieces; deterministic, in the disjointness-oracle / competition-judge house style — the agent in the loop must not grade its own exit)
1. **Hard same-symptom cycle counter that BLOCKS, not warns** (`gsd-t-debug.workflow.js` + debug-loop contract + a `bin/gsd-t-debug-cycle-ledger.cjs`): a deterministic ledger keys cycles by symptom-signature (failing assertion / surface / file-class — computed, not the agent's prose label). On the **3rd** dispatch against the same signature the workflow HARD-STOPS the patch path and forces a mode switch: stop dispatching point fixes → write the INVARIANT being violated → re-derive the model → escalate to the user with the cycle history. No "I'll stop after this one." This is the firing teeth #31's micro-pre-mortem and TD-294's quiescence both assume but neither enforces at the loop level. (Counts variant-spawning: a fix that closes signature A but opens signature B still increments the loop, because "each fix spawns a new variant" is the exact pathology.)
2. **Repro-fixture-on-regression, captured BEFORE the first fix** (debug workflow preflight, when symptom = "worked before / regression"): the failing input is captured as a deterministic fixture (DOM blob, payload, state snapshot) and a RED test asserting the symptom is written first; every subsequent cycle must move that test red→green and keep it green. Converts "eyeballed by the user each round" into "measured each round" (per [[feedback_measure_dont_claim]]), and turns silent drops into loud failures. The user's own DOM blobs becoming "killing fixtures" at the END is the proof this belongs at the START.
3. **Anchor-last default for DOM/scraping work** (stack rule `templates/stacks/_scraping.md` or `web-extension.md`): when extracting from a third-party DOM you don't control, default to **text/content-first, structural-anchors-last** — locate the stable content (e.g. `dir="auto"` comment bodies — "the single most stable thing in FB's DOM"), then walk up to synthesize structure; never gate capture on a structural attribute (`data-comment-id`) that the platform can drift overnight. The user derived TEXT-FIRST from first principles in one turn; GSD-T should ship it as a default so the next scraper doesn't relearn it over 50 turns. Pairs with #31's platform-invariants ("invariants not mechanisms" — anchor on content, not on the vendor's current attribute names).

### Relation to existing items
- **Completes the #31/TD-294 pair from the OTHER side.** #31 adds a micro-pre-mortem to REDUCE what each debug cycle introduces; TD-294 fixes when adversarial gates STOP; this item makes the debug loop ITSELF stop and escalate when it's not converging. #31 reviews the fix; #33 governs the loop dispatching fixes.
- **Same root evidence base as #31** (binvoice, "cycle-N fix creates cycle-N+1 finding") — now reproduced a second time in the same week on the FB-modal saga, which is exactly the ≥2-session same-root-cause bar the retro agent (#27) is supposed to clear. This item is another manual prototype of that pipeline.
- Tension: piece 2 (repro-first) overlaps #32's proportional gating — a Lane-≤2 hands-on fix should NOT pay full milestone repro ceremony. Resolution: the regression-fixture is cheap (one RED test + the captured input), is itself the Lane gate for the fix, and only escalates to full battery if the cycle counter fires.

## 34. Intention-first pseudocode as the milestone source-of-truth (two-altitude behavior map BEFORE the build)

**Added**: 2026-06-17
**Status**: PROMOTED → M87 (risk-first framing, DEFINED 2026-06-17; partition/plan deferred)
**Type**: framework feature (HIGH leverage — changes the front of every milestone)
**Origin**: user, from the binvoice `PseudoCode-PayPal.md` + `PseudoCode-Extension.md` exchange (session `35b4cbd7`, 2026-06-17). Reframed by the user: this is NOT a corrective tool (catching what the agent got wrong) — it is a GENERATIVE one. "It allowed me to work out all of the details in an expressive way that made it clear what's going to happen and why and when." The PayPal exchange did expose one unintended web-app assumption (agent over-trusted the shipped S2-M4 stored-draft model; user killed it: "We shouldn't be saving any draft of anything"), but that was a side effect. **The thesis: do the pseudocode FIRST so you never get it wrong** — and it applies MOST to greenfield, where there is no shipped code to ground in, so the pseudocode IS the spec. The user wrote the original Extension doc by hand precisely because GSD-T "wasn't understanding me"; this bakes that hand-rolled rescue into the methodology so it's never needed as a rescue again.

### The format that works (observed, from the two binvoice docs)
Each section pairs an `> **Intention ({Author}, {date}).**` prose block (the WHY / the directive — dated + attributed for durable provenance) ABOVE a `text` pseudocode block (the verified HOW), plus: a "one call in one breath" summary table, a guard-enumeration map rendering every invariant as a one-line `[RULE]`, explicit `⚠ Divergence` flags wherever a new intention supersedes shipped code, and a raw-pseudocode appendix with the intention prose stripped (the build's quick-reference). Grounds in EXISTING contracts/schema rather than inventing field names; defers concrete identifiers to plan-time-against-real-schema ("the concept is what matters here").

### Design (settled with user 2026-06-17)
- **Lives INSIDE milestone definition** (`/gsd-t-milestone` + its workflow), at TWO ALTITUDES:
  1. **High-level pseudocode first** — the general approach: what happens, why, when, the actors and the one-breath summary. User signs off that the APPROACH is right before any detail.
  2. **Detailed pseudocode** — decomposed to `PseudoCode-[Title].md` at the granularity of the binvoice PayPal doc (per-step intention+mechanism, guard map, divergence flags, appendix). **The milestone is not "DEFINED" until the detailed doc is signed off.** Naming: `[Title]` = the doc's SUBJECT (e.g. `PseudoCode-PayPal.md`), not a milestone id — many per project, possibly several per milestone (one per subsystem). `templates/PseudoCode-spec.md` is the shipped mold, not an instance.
- **Source of truth, mechanically downstream (the load-bearing decision):** partition/plan TRACE tasks to pseudocode sections (each task cites the section it implements; a section with no task = coverage gap, like journey-coverage); verify CHECKS the build against the doc's intentions + guard map — **the `[RULE]` map becomes test assertions**, and a divergence is a FAILURE, same severity as a contract breach. This is what makes the user's payoff real: "if the pseudocode is done well before the milestone starts, partition→plan→execute→verify runs autonomously and delivers exactly what's expected" — no 50-turn course-corrections, because the course was set in confirmed language.
- **Default ON for ALL milestones** (greenfield included — it benefits most), explicitly skippable per-milestone for trivial work (skip is a logged decision, not silent — per [[feedback_no_silent_degradation]]).
- **The one guardrail from the observed failure:** before encoding ANY model inherited from shipped code, the agent MUST ask **"keep this or supersede it?"** per inherited model (the stored-draft over-trust is the exact failure this prevents) — and every supersede gets a `⚠ Divergence` flag. Combines keep-or-supersede (prevents the wrong draft) + divergence-flag (documents it durably).
- **Document ripple (user-required):** `PseudoCode-[Title].md` joins the living-documents ripple set — when code/contract/schema changes during the milestone, the pseudocode doc updates in the same pass (Pre-Commit Gate + `commands/gsd-t-doc-ripple.md` + the Living Documents table in `templates/CLAUDE-global.md`). The doc stays the truth, not a stale start-of-milestone snapshot.
- **Template:** ship `templates/PseudoCode-spec.md` (the intention/mechanism/guard-map/divergence/appendix skeleton + the two-altitude structure), anchored to the binvoice exemplars rather than a blank page.
- **Conciseness:** the observed exchange had wordy explanation detours (the rejected "snapshot" tangent). The doc's prose is INTENTION (yours), not the agent's reasoning — agent reasoning stays out of the doc; the Output Style rules apply to the chat around it.

### Relation to existing items
- **Reframes #33 from the front.** #33 (debug circuit-breaker) and #31 (micro-pre-mortem) reduce/stop damage DURING the build; #34 prevents the wrong build from starting — "do it right first" vs "stop doing it wrong." The strongest pairing in the backlog: #34 sets the contract, #31 hardens the plan against it, #33 halts if execution drifts.
- **Supersedes part of the partition/plan competition framing for spec'd milestones** — when the behavior map is signed off, there is less solution-space to compete over; competition (M82) shifts UP to the high-level-approach altitude (which general approach), not down at mechanism.
- **Feeds verify's orthogonal triad** — the guard `[RULE]` map gives QA concrete contract-compliance assertions and the Red Team a pre-enumerated attack surface (every guard is a thing to try to break).
- Scope: ~2–3 domains (milestone command + workflow two-altitude flow + sign-off gate; pseudocode template + traceability wiring into plan/verify [extend the #83 traceability-gate to cite pseudocode sections]; doc-ripple integration + Living Documents table + contract). 1–2 waves. Candidate for early promotion — it's the highest-leverage process change in the queue and directly attacks the "50–100 turns to get it right" pain measured twice this month.
- Scope: ~2–3 domains (debug-cycle ledger cjs + workflow block + contract; repro-fixture preflight + workflow wiring; scraping stack rule + docs), 1–2 waves. The cycle-ledger + the firing block are the load-bearing half.

## 35. M88 — Deterministic gates for PseudoCode soft-ACs (sign-off state, map-generation path, triad-consumption seam, divergence grammar)

**Added**: 2026-06-17
**Type**: framework feature
**Origin**: M87 plan-phase pre-mortem cycle-4 split (2026-06-17). M87 ("Intention-First PseudoCode as Milestone Source-of-Truth") was split after 4 pre-mortem cycles (8→5→2→6 findings): the deterministic core (the `[RULE]` guard-bridge gate A1, section-coverage A2, ripple drift lint A4, regression bar A6) stays in M87 and ships now; FOUR acceptance criteria that set the same deterministic-gate bar but cannot meet it as-scoped without their own design move here. **Depends on M87** — the guard-bridge gate (`bin/gsd-t-guard-map.cjs`) and the two-altitude milestone FLOW must exist before these gates can attach to them.

### The four moved pieces (each: WHAT moved + WHY it needs its own design)

1. **A3 — machine-checkable sign-off STATE + `isDefined(milestone)` predicate.**
   - **WHY**: there is NO milestone-state artifact in the codebase today — "DEFINED" is prose an LLM writes into `.gsd-t/progress.md`, not a code-readable marker. A deterministic gate ("milestone is not DEFINED until the detailed `PseudoCode-[Title].md` is signed off; signing flips the state; skip is a logged decision, never silent default-off") requires first DESIGNING a concrete sign-off marker (a structured field / sidecar / front-matter stamp the gate can read) and a `isDefined(milestone)` predicate over it. M87 ships only the two-altitude FLOW + keep-or-supersede PROMPT as prose/protocol; M88 designs the STATE the gate reads and the gate itself.
   - Killing test (M88): unsigned detailed doc → predicate returns NOT-DEFINED; signing flips it; skip emits an assertable logged decision.

2. **A1 map-GENERATION path + its end-to-end test.**
   - **WHY**: M87's A1 proves the gate DISCRIMINATES a build→rule map (faithful map → exit 0, doctored map → exit non-zero, RULE-ID named). But the A1 doctored fixture differs only in the LLM-PRODUCED `--map` JSON (the doc stays byte-identical) — so the path that DERIVES the map from the build (which test assertions back which `[RULE]`) is untested. M88 designs the mechanical map-generation seam (build evidence → `{rules:{<id>:{backedBy:[...],contradicted:bool}}}`) and an end-to-end test that runs derivation → gate on a real build, closing the gap M87's map-only doctoring leaves open.
   - Killing test (M88): a real build's derived map, fed to M87's gate, exits 0 on a faithful build and non-zero when a backing assertion is removed — derivation included, not hand-authored.

3. **A5 — verify-triad consumption as a DETERMINISTIC seam-check.**
   - **WHY**: A5 ("the `[RULE]` set is consumed by verify's QA + Red Team frames") was framed as observable on a live triad run, which is non-deterministic (an LLM frame's contents). Reframe it as a deterministic SEAM-CHECK: assert the `qa-subagent.md` / `red-team-subagent.md` prompts contain the structured directive to ingest the rule set, plus a unit test that feeds guard-map JSON through the consuming code path and asserts the rule IDs surface — NOT a live triad run. M88 gives it that deterministic design (M87 leaves A5 out of the gated core entirely — the integrate-time seam M87-INT-T1 is descoped).
   - Killing test (M88): prompt-presence assertion (structured directive present) + a unit test feeding guard-map JSON to the consumer, asserting each derived RULE-ID surfaces in both the QA contract-compliance frame and the Red Team attack-surface frame; a missing directive or dropped rule FAILS.

4. **SC4 — divergence-grammar `parseDivergence()`/`formatDivergence()` round-trip.**
   - **WHY**: SC4 has two halves. The "agent ASKS keep-or-supersede per inherited model" half is an inherent prose PROTOCOL (its reliability is bounded by how forcing the prompt is — not a deterministic gate) and ships in M87's D3 keep-or-supersede prompt. The OTHER half — a deterministic `parseDivergence()`/`formatDivergence()` grammar round-trip over the `⚠ Divergence: …` flag (per contract §4) so the divergence count is a checkable artifact that can feed the rule map — IS deterministically gateable but needs its own grammar-implementation design. M88 builds the parse/format round-trip; the §4 grammar definition already exists in `pseudocode-source-of-truth-contract.md` (annotated "M88", not deleted).
   - Killing test (M88): a `⚠ Divergence` line round-trips format→parse→format byte-stable; a malformed flag FAILS; the divergence count is emitted as a checkable artifact.

### The deterministic-gate bar (set by M87, the entry criterion for M88)
M87 establishes the bar these four must meet: a gate's pass/fail is DETERMINISTIC CODE with ZERO LLM judgment, structural/path-as-path never substring (`feedback_coverage_check_structural_not_substring`), proven by a killing test against byte-verbatim fixtures, with no silent degradation (`feedback_no_silent_degradation`). Each moved piece fails this bar AS-SCOPED in M87 (no state artifact / untested derivation path / non-deterministic live-run framing / unimplemented grammar) — M88 designs each up to the bar.

### Relation to existing items
- **Strictly downstream of M87** — cannot start until M87 ships the guard-bridge gate + the two-altitude flow these gates attach to.
- Pairs with #31 (micro-pre-mortem) + #33 (debug circuit-breaker): #34/M87 sets the contract front-of-milestone, M88 closes the deterministic gates around it, #31 hardens the plan, #33 halts on drift.
- Scope: ~3–4 domains (sign-off state + `isDefined` predicate; map-generation seam + e2e test; triad seam-check; divergence grammar round-trip), 1–2 waves. Each piece is independently gateable once its design lands.

## 36. M89 — Auto-Research: deterministic external-info-gap resolution at every workflow phase — **PROMOTED → M89 (2026-06-18), IN PROGRESS**

**Added**: 2026-06-18
**Type**: framework capability (HIGH leverage — affects every phase)
**Origin**: user, 2026-06-18, watching binvoice S2-M5 (PayPal Invoicing v2) plan block on a pre-mortem where 2–3 of 6 findings were EXTERNAL-API facts not in the repo (PayPal OAuth `/v1/oauth2/token` mint/seed contract; PayPal v2 invoice TOTAL amount limit; browser popup-blocker behavior). These recur every PayPal cycle because the agent GUESSES the third-party contract instead of looking it up. Contrast M87 (0 of 7 findings web-resolvable — pure introspection): the discriminator is **internal vs external fact**. User directive: "implement this now, pause M87; include it at any phase where web research can resolve issues or improve the result."

### Design (full definition in progress.md § Current Milestone M89)
Deterministic trigger (not advisory prose — the existing CLAUDE-global Research Policy is LLM-discretion that doesn't fire, per `feedback_deterministic_orchestration`): DETECT gap → CLASSIFY internal/external (`bin/gsd-t-research-gate.cjs`) → external runs a web-research `agent()` stage that returns facts WITH SOURCE URLs → CITE into the phase artifact as a Verified-Facts block before proceeding. Internal gaps route to grep/Read, never the web (no latency/noise tax — the M87 lesson). Hooks into plan/pre-mortem/partition/discuss/milestone/execute/debug/impact/quick/wave — every phase where external info pays. Labeled-corpus A1 test = the 13 real findings (7 M87 → 0 external, 6 S2-M5 → 2–3 external). Risk-first: W1 proves the classifier on the corpus before wiring. Immediate dogfood: S2-M5's blocked plan re-runs with auto-research → #1/#3 resolved by cited PayPal facts.

### Relation
- **Why first, ahead of M87:** its evidence came partly FROM M87's plan loop (external-fact findings recurring) + binvoice S2-M5 live; M87 is paused at plan-cleared/pre-execute and resumes after M89.
- Complements #33 (debug circuit-breaker): a debug cycle whose root is an external unknown should RESEARCH, not patch-guess — M89's debug hook + #33's halt are the two halves.
- Supersedes the advisory "Research Policy" prose in CLAUDE-global.md with a deterministic trigger (doc-ripple).

## 37. Flaky CLI-subprocess test: `gsd-t status` hangs ~123s under cold parallel load → false CI-parity FAIL

**Added**: 2026-06-18
**Type**: tech debt (test-infra) | **App**: gsd-t | **Category**: test
**Origin**: surfaced during M89 verify (2026-06-18). `test/filesystem.test.js` → "CLI subcommands" → "status subcommand runs without error" `execFileSync(node, [CLI, "status"], {timeout: 15000})` ran **~123s** and false-failed the cache-cleared CI-parity gate, blocking M89's verify BEFORE the triad. In isolation the same test passes 40/40 in **372ms**. Last touched M61 (`e6afbab`) — NOT M89; M89's own suite is 1804/0 warm. So it's a pre-existing flake exposed by cold + parallel suite load.
- **Symptom:** the `gsd-t status` child exceeds its own 15s `timeout` (execFileSync SIGTERM doesn't reliably kill a child that spawns its own subprocesses / stalls on git or file reads under contention), runs to ~123s, fails the run.
- **Two candidate root causes (investigate):** (a) the TEST is fragile — needs a real child-tree kill + a generous-but-enforced timeout, or stub the subprocess; (b) `gsd-t status` itself has a latent slow/hanging path under cold cache or parallel git access (the more concerning one — a command that hangs 123s in CI is a real UX/CI bug, not just a test issue). Determine which before fixing — if (b), fix the command, not the test.
- **Decision (user, 2026-06-18):** backlog it, do NOT fix inline; re-verify M89 as-is and accept it may re-flake. If it re-blocks M89 repeatedly, escalate to fix-now.
- Scope: ~1 domain (diagnose status-under-load, then either harden the test [child-tree kill + timeout] or fix the command's slow path), <1 wave.

## 38. Unproven-assumption guard: stop → research-how-others-solved-it → re-examine premise → then proceed (supersedes M89's narrow scope) — **PROMOTED → M90 (2026-06-21, DEFINED — RESEARCH-GATED; partition/plan deferred; full definition in progress.md § Current Milestone M90)**

**Added**: 2026-06-21
**Type**: framework capability (HIGHEST leverage — addresses the root pattern behind a week of thrash) | **App**: gsd-t
**Origin**: user, 2026-06-21, correcting M89's scope mid-flight. M89 framed "guessing" as only "do I know what the code/API currently SAYS?" (factual). The user named the dangerous omission: the system also assumes **an APPROACH/architecture is correct without proof** — "I'll fix it this way", "the existing code was written the right way so I'll build on it" — and **plows forward on the unproven approach**, repeatedly. Evidence (user: "review the last week across several projects"): binvoice FB-modal whack-a-mole + PayPal premise; GSD-T M87 7-cycle plan loop; GSD-T M89 8-cycle verify loop — same pattern every time: guess an approach → plow forward → fail → guess another → repeat, instead of ONE step-back + research + re-architect. M89 PAUSED to redesign around this.

### The doctrine (the real feature)
Any time the system relies on an UNPROVEN ASSUMPTION — factual (internal/external) OR judgmental (is this approach/architecture correct?) — it must **STOP, research how the problem has been solved successfully by others, RE-EXAMINE the premise, then proceed.** Plowing forward on an unverified approach is the deadly recurring pattern. "Don't act on belief; if not grounded in definitive knowledge or research, research first" — applied to APPROACH, not just facts. See memory `feedback_unproven_assumption_stop_and_research`.

### Design directions (to settle at milestone definition)
- **Two assumption classes, each with a trigger:** (a) FACTUAL → grep (internal) / web-research (external) — M89's mechanism, kept; (b) ARCHITECTURAL/APPROACH → research how others solved this class of problem + re-examine the premise BEFORE building. The second is new and load-bearing.
- **Non-convergence = an unproven premise, not a tuning gap.** Hook into the debug-cycle circuit-breaker (#33) and the plan/verify loops: when a loop produces variant-after-variant (binvoice/M87/M89 signature), the system must HALT and re-examine the PREMISE/approach — research-then-rearchitect — not patch the next variant. This is what should have fired ~5 cycles earlier in all three sagas.
- **No hardcoded finite list for an open category (the M89 vendor-list lesson):** the mechanical/regex layer can only recognize CLOSED knowable sets (this repo's own files); it must NOT enumerate open-ended real-world sets (vendors, API terms, library names). Anything not confidently-internal → LLM judges → uncertain → research. M89's redesign folds into this.
- **M89's external-fact auto-research becomes the FACTUAL slice of this larger capability** — finish it under this umbrella (delete the vendor list, regex-knows-only-own-paths, LLM-judges-rest), and add the architectural-assumption slice.

### Relation
- Supersedes/absorbs M89 (#36) — M89's "auto-research external facts" is one slice. Complements #33 (debug circuit-breaker — the loop-halt mechanism this needs) and #31 (micro-pre-mortem). The strongest single GSD-T improvement in the queue: it attacks the root cause of every multi-cycle thrash measured this month.
- Scope: re-scope at milestone definition; likely ~3–4 domains (factual auto-research [M89 redesigned] + architectural-assumption detection/research + non-convergence→re-examine-premise loop-hook + contract/docs). Multiple waves.

## 39. Red Team Realism gate — separate adversarial-collaboration agent bounds edge-case scope

**Added**: 2026-06-21
**Type**: framework improvement (verify quality) | **App**: gsd-t | **Category**: prompts/verify
**Origin**: user, 2026-06-21. The Red Team has NO instruction to weigh likelihood/scope — it escalates contrived/unlikely edge cases to CRITICAL with equal weight to real money/security bugs (rewarded only for FINDING breakage). Inflated the M89 verify loop (cycles spent on baroque homograph/vendor/phrasing combos raised as blocking). The user WANTS hard edge-case hunting — but also wants the question asked: "given the system's purpose + realistic likelihood, is this worth defending NOW?"

### Design (user's instinct + 2 refinements)
A SEPARATE **Realism agent** the Red Team argues scope with (adversarial-collaboration, mirroring GSD-T's bounded-loop pattern):
- Red Team finds an edge case, argues it's in-scope → Realism ACCEPTS (blocking finding stands) or REJECTS with an out-of-scope reason.
- Red Team may push back with updated reasoning — **max 2 attempts.** **2 rejections → DOCUMENTED as "identified, currently out of scope," NOT blocking.**
- **Refinement 1 (anti-silencer):** the Red Team already proved the bug is REAL; the Realism agent rules ONLY on scope/likelihood-given-purpose, NEVER on validity. **HARD FLOOR: money / security / data-loss / silent-wrong-output is ALWAYS in-scope** — Realism cannot defer it regardless of likelihood. (Would correctly keep M89's out-of-list-vendor finding in-scope — silent-wrong-output.)
- **Refinement 2 (deferral ≠ dismissal):** out-of-scope cases go to a VISIBLE LEDGER (re-surfaced next milestone, promotable as the product matures) — never silently dropped. Matches the "skip = deferral not exemption" principle (#32).
- User asked "better suggestion?" — kept the shape, added the two refinements above; user to confirm at milestone definition.

### Relation
- Lives in `templates/prompts/red-team-subagent.md` + a NEW realism-subagent protocol + the verify workflow triad-synthesis stage. The verify-time dual of the pre-mortem/debug-cycle caps. See memory `feedback_red_team_realism_gate`.
- Scope: ~1–2 domains (realism-subagent protocol + red-team protocol update + verify-workflow wiring + deferred-ledger + contract/docs), 1 wave.

## 40. complete-milestone must DETERMINISTICALLY archive+sweep the completed milestone's domain dirs (stale-domain accumulation) — **DONE 2026-06-22 (v4.7.11, bin/gsd-t-archive-domains.cjs)**

**Added**: 2026-06-22
**Type**: tech debt (workflow-enforcement) | **App**: gsd-t | **Category**: cli/command
**Scheduled**: implement AFTER M90 is complete AND shipped (CPUA) — user directive 2026-06-22.
**Origin**: 2026-06-22, M90 plan-phase `gsd-t parallel --dry-run` surfaced 77 stale domain dirs in `.gsd-t/domains/` from ~30 already-completed/archived milestones (m43–m67 prefixed + unprefixed legacy), polluting the file-disjointness oracle. Manually pruned them (commit `5b48384`, kept the 12 in-flight: m90-*/M87/m89-*). That manual sweep is a SYMPTOM — the root cause is permanent.
- **Root cause (verified on disk):** `commands/gsd-t-complete-milestone.md` Step 7 (lines 404-405) is **prose-only** — "1. Archive current domains → `.gsd-t/milestones/{name}/domains/`  2. Clear `.gsd-t/domains/` (empty, ready for next partition)" — with NO deterministic enforcement. A Level-3 autonomous agent skipped/partially-did the clear every milestone for ~30 milestones. Classic prompt-based-blocking-doesn't-work ([[feedback_deterministic_orchestration]]).
- **Fix:** a deterministic helper (`bin/gsd-t-archive-domains.cjs` or fold into an existing complete-milestone gate) that, at complete-milestone time, (a) copies the just-completed milestone's domain dirs → `.gsd-t/milestones/{name}-{date}/domains/`, then (b) `git rm`s them from `.gsd-t/domains/`, leaving ONLY domains belonging to still-active (defined-but-incomplete) milestones. Must be IDEMPOTENT and identify "this milestone's domains" precisely (the partition's domain set for the completing milestone — NOT a blanket wipe, since a later milestone may legitimately have live domains, e.g. M90 completing while M87/M88 are still queued). Verify with a test: seed N stale + M live domains, run the sweep, assert exactly the completed set is archived+removed and the live set untouched.
- **Containment guard:** apply the destructive-path rule ([[feedback_destructive_path_ops_containment]]) — the recursive remove must refuse any path resolving outside `.gsd-t/domains/` or equal to it.
- **Doc-ripple:** Step 7 prose → "runs `bin/gsd-t-archive-domains.cjs` (deterministic)"; complete-milestone command + GSD-T-README + CHANGELOG.
- Scope: ~1 domain (the helper + its test + complete-milestone wiring + doc-ripple), 1 wave. Small, localized — hands-on fix, not a headless spawn ([[feedback_dont_keep_spawning_milestones]]).

## 41. `buildTaskBrief` / `extractTask` (bin/gsd-t-task-brief.js) can't parse Shape-D tasks.md headings — dead against real domains

**Added**: 2026-06-22
**Type**: tech debt (stale-tool) | **App**: gsd-t | **Category**: cli
**Origin**: 2026-06-22, while fixing the m40 self-test that my domain-prune broke. `extractTask` (bin/gsd-t-task-brief.js:33) builds `headerRe = /^###\s+Task\s+<num>\b/` — the OLD `### Task N: title` heading format. Current domains use Shape-D `### Mxx-Dx-Tx — title` (since the M61 Shape-D migration, per [[feedback_plan_for_parallel_execution]]). So `buildTaskBrief` returns "task not found" for EVERY real domain on disk — the tool is effectively dead against live milestones; only the synthetic `### Task N` fixture in m40-task-brief.test.js exercises it.
- **Question to resolve first (don't assume):** is `bin/gsd-t-task-brief.js` still USED anywhere? The M61 platform reconciliation moved briefs to `bin/gsd-t-context-brief.cjs` (the workflow brief collector). If `gsd-t-task-brief.js` is superseded/orphaned, the fix is RETIRE it (grep requirers, inline-then-delete per [[feedback_retire_scan_against_keep_list]]), NOT update its parser. If still live, update `extractTask` to parse Shape-D headings (`### Mxx-Dx-Tx` + the `**Files**`/`**Test**`/`**Acceptance criteria**` fields).
- **Interim (done 2026-06-22):** the m40 self-test was repointed from "live repo self-test" to a `mkFixtureProject()` end-to-end test (still exercises the tool, decoupled from live domains) so M90 verify isn't blocked. The deeper parser/retirement decision is this item.
- Scope: ~1 domain (decide retire-vs-fix, then either delete + requirer-inline or update parser + add a Shape-D fixture test), <1 wave.

## 42. Wire a LIVE spike-feasibility producer for the architectural-trigger response modes (R-FAIL-2 enforcement — M90 option B, deferred)

**Added**: 2026-06-22
**Type**: feature (doctrine-enforcement) | **App**: gsd-t | **Category**: workflow
**Origin**: M90 verify, 2026-06-22. User chose option A (declare interface-only) to ship M90; this is the deferred option B.
- **Plain version:** M90 has a safety check meant to STOP the build when the AI commits to an approach it only *argued* was fine but never actually *tested* (ran code to prove it). Today that check is a smoke detector with no sensor wired — installed, looks real, can never beep. M90 shipped it DECLARED interface-only (honest "not wired yet") rather than hidden-hollow. This item wires the sensor.
- **What's missing:** a DECIDER that, given an approach an agent is about to build on, judges "can I write a quick throwaway script to actually test this premise? (spikeFeasible yes/no)" and feeds that into `bin/gsd-t-architectural-trigger.cjs::resolveResponseMode({spikeFeasible, spikePassed})`. Only then does `provenByAdversaryOnly:true` ever get raised, and only then can R-FAIL-2 genuinely fire. The natural home is the blind-adversary stage (`templates/prompts/blind-adversary-subagent.md`) wired into execute/quick/phase.
- **EXPERIMENTAL — no published precedent** for reliably auto-deciding spike feasibility; expect this to need its own prove-or-kill. Likely re-opens the same convergence risk M90's verify hit, so gate it hard.
- **Companion rule (user, 2026-06-22):** an UNSTATED requirement is a QUESTION FOR THE USER, never an assumption to spike or adversarially argue. The decider must route "is this even a requirement?" to the human, not auto-resolve it. ([[feedback_no_confabulated_examples]])
- **Flip-on-land:** doctrine contract §2.2/§4 currently say "interface-only this milestone"; when this lands, R-FAIL-2 flips from declared-interface-only-PASS to genuinely-fireable, and the verify gate's grep-for-live-producer detects it automatically.
- **Fold in (Red Team LOW, M90 verify fc9):** the arch-trigger instrumentation sink swallows write errors (best-effort append) — when a live producer exists, an unwritable sink → R-FAIL-2 count stays 0 → fail-OPEN. The live-producer wiring must make the sink write fail-closed (or verify must detect an unwritable/absent sink as a hard error, not a 0-count pass).
- Scope: ~1–2 domains (the spike-feasibility decider + blind-adversary wiring + the human-ask routing for unstated requirements + R-FAIL-2 live-fire test), multi-wave, EXPERIMENTAL.

## 43. Classifier mis-routes an external SDK fact to internal/grep when a repo path co-occurs (M90 D3 MEDIUM edge)

**Added**: 2026-06-22
**Type**: tech debt (classifier-edge) | **App**: gsd-t | **Category**: cli
**Origin**: M90 verify Red Team MEDIUM, 2026-06-22. Confirmed on disk.
- **Plain version:** Ask "what does AWS's `putObject` return — check our `upload.js`." The right move is look up AWS's docs (external). But because you named one of your own files in the same breath, the classifier says "this is about your code, just grep locally" and never checks AWS — it'd answer confidently from your repo alone and could be wrong about AWS.
- **Repro:** `node bin/gsd-t-research-gate.cjs classify "what does the AWS S3 putObject return — see our src/upload.js"` → `{class:internal, route:grep}`. AWS/S3/putObject is an unlisted external SDK fact; the no-strong-external branch lets a repo path-anchor win, violating §1's "never guess-internal for an external fact."
- **Root:** the premise-corrected vendor list (kept as an external→web *upgrade*) doesn't cover AWS/S3/putObject, so `hasStrongExternal` is false; then the path-anchor makes it internal. A co-occurring external-SDK signal should at least downgrade to `ambiguous→judge`, not assert internal.
- **Fix direction:** when an external-API-shaped token co-occurs with a repo path and there's no strong-external vendor match, route `ambiguous→judge` (let the LLM decide), never `internal`. Add to the corpus + held-out fixture.
- Scope: ~1 domain (classifier branch + corpus rows), <1 wave. Deferred from M90 to avoid a classifier change right before shipping (kept verify stable).

## 44. The Understand-Before-Build reflex + the pipeline's missing Subtract half

**Added**: 2026-06-22
**Type**: framework paradigm (HIGHEST leverage — inverts the additive-only pipeline)
**Status**: DESIGN BRIEF written → `.gsd-t/design-briefs/understand-before-build-subtract-half.md` (+ §0.5 REVIEW ADDENDUM 2026-06-23). Pre-promotion. M91 (the M87+M88 PseudoCode milestone this was sequenced after) is now SHIPPED (v4.8.10) — front-of-flow overlap is clear. **#44a SHIPPED → M92 COMPLETE (v4.9.10, 2026-06-23). #44b (graph half) REMAINS — gated on M92 moving the needle; carries the prior-graph autopsy below.** Review recommended a SPLIT (M87→M88-style): **#44a paradigm half (= M92)** (verdict-vocabulary keystone w/ a deterministic shrink-metric + invert-the-default + the scope-assumption reflex built by giving **M90's stubbed §2 architectural trigger (R-ARCH-2, backlog #42) the same classify→grep→ground response its shipped §1 factual sibling `bin/gsd-t-research-gate.cjs` already has** — ~10 files, no graph, low overlap, would have prevented every BinVoice failure) **then #44b graph half** (understand-before-plan + per-phase shrink beat + N≥3 consolidation lens, build-on-demand, GATED on #44a moving the needle). ⚠ NOTE: M89 was RETIRED into M90 — there is no standalone "M89 machinery"; the reflex reuses M90's §1 pipeline. ⚠⚠ PRIOR-ART AUTOPSY (critical for #44b): **GSD-T already built a code graph (M20–M21, v2.38–2.39) and it DIED** — engine still in tree (`bin/graph-*.js`) but ORPHANED (`gsd-t graph status` = no index, ~3mo dormant); cause of death = external-dep maintenance burden (CGC/Neo4j/Docker/Python — Windows/encoding/sync firefighting) ÷ marginal measured value (GSD-T's own `graph-vs-grep-comparison.md`: 5 net findings over grep). #44b inverts every cause: build-on-demand (no index to rot) · zero-dep in-process (no Neo4j/Docker) · one narrow job (not 21 commands) · gated on #44a (prove-then-build). SALVAGE: reuse the tested `graph-parsers.js` extraction, delete the storage/provider/sync layer that killed it. See brief §0.5 for the full autopsy + the grep-then-graph sequencing rationale (same reflex, sensor swap — not throwaway), the three restored insights, and the closed decisions.
**Origin**: user, BinVoice pricing-migration session 2026-06-22. Four converging failures (assume-don't-look / discovered-wart-cleanup / chase-consumers-not-source / add-new-never-subtract-old), one root cause: GSD-T is a purely ADDITIVE gate pipeline — when a plan starts too high, every gate makes it bigger; the harder it works the more complex the result. The exact inversion the user wants killed.

**Thesis**: understand what exists (graph blast-radius) BEFORE planning · default to the smallest change that hits the crux (ceremony opt-in, not Recommended) · add the SUBTRACT stage the pipeline has never had · make "we made it smaller / removed code / starved a redundant source / collapsed N producers" a FIRST-CLASS verdict success (today `VERIFIED` is a pure AND of additive gates — `verify.workflow.js:610` — the schema can't even SAY "smaller"). Goal is one event seen three ways: simpler · faster · smarter.

**Proven this session** (code audit, file:line): pipeline is BENDABLE-IN-PLACE not baked-in (7 swappable `phase()` blocks, thin commands, shallow contract coupling) → INSERTION not rewrite. M90's R-ARCH-2 trigger already FIRES on the BinVoice moment but its response is interface-only (backlog #42) — give it a cheaper-first ladder (look→smallest→spike→defer), not spike-first. Research (spring 2026, cited in brief §6): code-graph blast-radius PROVEN faster (22%/58% fewer tool calls) + 70% fewer regressions (TDAD); doc-ripple-style freshness PROVEN (CodeGraph). INVENTED/deferred: docs+memory in one graph (no precedent — code-structure-first), the collapse-worth-it decision (Metz guardrail — count multiplicity, defer the abstraction).

**Five moves** (each ~5 files, insertion): (1) front Understand-before-plan stage; (2) new Shrink/Defer stage; (3) invert the default toward smallest; (4) M90 trigger response (cheaper-first ladder); (5) verdict vocabulary keystone — "smaller" is success. Unifier: one graph query "produced-where/consumed-where" serves prevention (starve the source) AND consolidation (N≥3 = counted rule-of-three, surfaced+deferred via the defer-don't-inline valve).

**Relation**: builds ON M87/M88 (#34/#35 — pseudocode is the visible-logic substrate; that's the DEFINE-altitude prevention, this is the PLAN/EXECUTE-altitude prevention). Gives M90's dormant arch-trigger (#42) its real response. Supersedes part of the competition framing (less to compete over when the smallest change is the default). See [[feedback_unproven_assumption_stop_and_research]], [[feedback_intention_first_pseudocode]], [[feedback_coverage_check_structural_not_substring]].

## 45. Fence-awareness for the M91 PseudoCode marker parsers (defer-out — fail-closed today)

**Added**: 2026-06-22
**Type**: hardening / tech debt
**Origin**: M91 verify Red Team (GRUDGING-PASS) — three MEDIUM/LOW findings, all in the SAFE (fail-closed) direction, deferred out of M91 rather than expanding verify scope.

The M91 marker parsers match their markers ANYWHERE on a line, with no awareness of code fences / the doc's own Appendix. Three sites:
- `bin/gsd-t-guard-map.cjs` — a `[RULE …]` marker inside a ``` fence or the appendix is parsed as a live rule. **Direction is SAFE**: an extra fenced rule becomes an extra unbacked map-key requirement → spurious FAIL, never a vacuous pass (Red Team verified a fenced duplicate of an unbacked rule still FAILs exit 4 — a fence can never HIDE a divergence). The cost is a false-FAIL when a doc author quotes the grammar in an example.
- `bin/gsd-t-divergence-grammar.cjs` `countDivergences` — a valid-format `⚠ Divergence` line inside a fence/appendix is counted. Inflates the divergence count (no live consumer wires it as a gate today).
- `bin/gsd-t-milestone-state.cjs` — a doc showing its own `<!-- signed-off: … -->` marker as an example self-signs. (A doc cannot realistically quote its own sign-off marker, so lowest severity.)

**Why deferred, not fixed in M91**: every case errs fail-closed and none defeats a gate's purpose; fixing mid-verify would expand scope. The section enumerator (`enumerateSections`, §3.1) ALREADY does fence-exclusion correctly — the fix is to reuse that fence-tracking in the three marker parsers (one shared helper). Small (~1 domain, the three bin files + their tests + a "quoted-marker-in-fence ignored" case each).

**NOT in scope for fix**: changing fail-closed→fail-open. The fix only stops false-FAILs / count-inflation from a doc quoting its own grammar; it must NOT let a fenced real divergence pass. See [[feedback_coverage_check_structural_not_substring]] (structural, fence-aware), [[feedback_no_silent_degradation]].

## 46. Full Test & Build Telemetry Suite (flaky-test + reliability observability)

- **Type:** feature / infrastructure | **App:** gsd-t | **Category:** testing / observability
- **Added:** 2026-06-26 | **Origin:** M94 verify — the verify gate kept tripping (a timing artifact, then a gate-only `npm test` exitCode 1 not reproducible standalone) and could only be traced BY HAND. User: "We definitely need a full telemetry suite."

**The gap:** GSD-T has almost NO telemetry to trace flaky / order-dependent / environment-sensitive test behavior. Flaky tests are debugged by re-run-and-eyeball today. This bites every build with a gate, not one milestone. There is `.gsd-t/events/*.jsonl` (workflow events) and `.gsd-t/metrics/` (workflow metrics) but nothing at the TEST level.

**Proposed telemetry (turns "re-run and guess" into a query):**
1. **Test-history ledger** — append every test's `{name, file, pass/fail, durationMs, runId, order, seed, env}` to `.gsd-t/metrics/test-history.jsonl`. "Flaky" = any test with MIXED results across recent runs (a query, not a manual re-run). Surfaced in `gsd-t metrics`.
2. **Auto-isolation on failure** — when a test fails in-suite, automatically re-run it ALONE. pass-alone + fail-in-suite = a shared-state leak; locates the bug CLASS instantly.
3. **Artifact-leak detector** — snapshot temp dir / working tree before+after each test file; flag a test that leaves files behind (e.g. an un-cleaned `.db` or temp dir that poisons the next test). The MOST COMMON real cause of order-dependent flakes.
4. **Quarantine + retry-once** — flaky tests marked, retried once, reported SEPARATELY so flakiness never silently fails a gate AND is never hidden.
5. **Environment-delta capture** — per-run cwd / env vars / parallel-worker-count, because the verify-gate's `npm test` can differ subtly from a manual run (the exact M94-verify symptom: green standalone, exitCode 1 in the gate).
6. **(stretch) Build telemetry** — per-gate-worker wall-clock + timeout-margin history (tie-in to [[feedback_slow_tests_starve_workflow_watchdog]]: a worker creeping toward its timeout flakes silently until it crosses).

**Synergy with M94 code graph:** once the graph stores test→impl + shared-store edges, "these two tests touch the same store path" becomes a QUERY — flaky-from-shared-state is detectable structurally, not by guessing.

**Scope:** a dedicated milestone (pays off on every future build). Likely a test-runner wrapper/reporter that writes the ledger + the isolation/leak/quarantine logic + a `gsd-t metrics --flaky` surface. Memory: [[project_flaky_test_telemetry_gap]]. Related: [[feedback_measure_dont_claim]], [[feedback_slow_tests_starve_workflow_watchdog]].

## Sequencing note (2026-06-26, user directive)
After M94 ships: (1) DEFINE the telemetry suite milestone (#46) but DO NOT build it yet. (2) BEFORE building telemetry, EXPLORE the documentation-graph milestone discussed 2026-06-25 (scan findings + docs as enrichment layers ON the code graph — see memory [[project_scan_findings_enrich_graph.md]] + the M94 Phase-2 docs-in-graph scope: doc↔doc + item↔item + doc-item↔code edges via DECLARED IDs only). Order: finish M94 → define telemetry (#46, no build) → explore doc-graph milestone → then decide build order.

---

## #47 — Scan output filenames carry the repo name (`[file]-[repo].md`) + CPUA one-time mass-rename

**Type:** Enhancement (scan) · **Status:** QUEUED (gated on M99 landing) · **Added:** 2026-06-30 (user directive; refined same day) · **Scope:** suffix scan reports in place + EXPORT-COPY living docs to a /share folder

**Problem (user):** David shares scan outputs (`techdebt.md`, `.gsd-t/scan/architecture.md`) AND living docs (`architecture.md`, etc.) with his team across multiple projects; identical filenames → team confusion about which file is which project.

**Decision (locked + REFINED with user 2026-06-30):**
- **Suffix SCAN REPORTS in place** with `-[repoName]`: `techdebt-[repo].md`, `techdebt_in_plain_english-[repo].md`, and `.gsd-t/scan/[dimension]-[repo].md` (architecture/security/quality/business-rules/contract-drift). These are scan's own outputs with few internal readers.
- **LIVING DOCS: do NOT rename in place — EXPORT-COPY instead (user refinement).** Originals (`docs/architecture.md`, `requirements.md`, `workflows.md`, `infrastructure.md`) keep their fixed names (GSD-T reads them by hardcoded path under the No-Re-Research rule — renaming breaks every command + the global CLAUDE.md Living Documents table). NEW: scan's VERY LAST step COPIES all shareable docs into a `[projectDir]/share/` folder with `-[repo]` suffixes (`share/architecture-[repo].md`, `share/requirements-[repo].md`, …). This gives the team a clearly-labeled shareable set AND prevents "which version is for which project" confusion — without touching the originals. The `/share/` copy is regenerated each scan (overwrite, always fresh). This supersedes the earlier "scan reports only, living docs untouched" call — living docs are now shared via copy, not left out.

**Build (when un-gated):**
1. **`templates/workflows/gsd-t-scan.workflow.js`** — thread a `repoName` (derive from `path.basename(projectDir)` resolved in an agent's Bash; the M81 sandbox has no `path`) into the scan-report output filenames. Hardcoded refs to update: `.gsd-t/techdebt.md` (lines ~315 priorRegister check, ~799 archive-rename, ~812 regPath, ~905 register-read), `.gsd-t/techdebt_in_plain_english.md` (~930 peTarget, ~973 header), `.gsd-t/scan/*.md` (~874-882 the 5 dimension writers). The archive-rename (`techdebt_[today].md`) and the `priorRegisterExists` detection must both use the NEW suffixed name.
2. **NEW — living-docs export-copy (scan's LAST step):** after the doc-population step finishes, copy each living doc into `[projectDir]/share/` with a `-[repo]` suffix: `docs/architecture.md`→`share/architecture-[repo].md`, `docs/requirements.md`→`share/requirements-[repo].md`, `docs/workflows.md`→`share/workflows-[repo].md`, `docs/infrastructure.md`→`share/infrastructure-[repo].md`, plus optionally `README.md`→`share/README-[repo].md`. Overwrite each scan (always fresh). Originals untouched. Add `share/` is NOT gitignored by default (user shares from it) — but confirm with user at build time. Runs in an agent's Bash (sandbox has no fs).
3. **NEW — archive OLD scan docs with datetime before overwriting (for diffing) → `.gsd-t/scan/archive/` (user 2026-06-30):** when a new scan runs, BEFORE writing the new dimension files / register, move the existing ones into `[projectDir]/.gsd-t/scan/archive/` with a datetime suffix (`architecture-[repo]-YYYYMMDD-HHMM.md`, `techdebt-[repo]-YYYYMMDD-HHMM.md`, etc.) so David can diff new-vs-prior. This REPLACES/UNIFIES the existing ad-hoc `techdebt_[today].md` archive-rename (line ~799) — that current archive should also land in `.gsd-t/scan/archive/` with the datetime+repo convention, not loose in `.gsd-t/`. The archive dir accumulates history (don't purge); datetime from the live clock via an agent's Bash. Applies to BOTH the register (techdebt) and the 5 dimension files. The `share/` export-copy (step 2) is the CURRENT shareable set; the `scan/archive/` is the HISTORICAL diff set — distinct purposes.
4. **Document Ripple:** `commands/gsd-t-scan.md` (output-file list + the new `share/` step + the `scan/archive/` step), any scan-output reader (`/gsd-t-promote-debt` reads `techdebt.md` — must read the suffixed name).
5. **CPUA one-time mass-rename routine:** a `gsd-t` migration that runs ONCE during the next `update-all` propagation, in EACH registered project: rename existing scan reports `techdebt.md`→`techdebt-[repo].md`, `techdebt_in_plain_english.md`→suffixed, `.gsd-t/scan/[dim].md`→suffixed; AND generate the initial `share/` export-copy of the living docs; AND create the `.gsd-t/scan/archive/` dir. Idempotent (skip if already suffixed / share/ current), `git mv` if a git repo else `mv` for the renames + plain copy for `share/`, NEVER rename the living-doc originals, real-project-root only. One-shot (a marker file or version-gate so it doesn't re-run).

**Full scan-output layout after #47:**
- `.gsd-t/techdebt-[repo].md` + `.gsd-t/techdebt_in_plain_english-[repo].md` — current register (suffixed in place)
- `.gsd-t/scan/[dim]-[repo].md` — current dimension files (suffixed in place)
- `.gsd-t/scan/archive/[file]-[repo]-YYYYMMDD-HHMM.md` — historical snapshots for diffing (prior scans, datetime-stamped)
- `share/[livingdoc]-[repo].md` — shareable copies of the living docs (regenerated each scan, originals untouched at `docs/`)

**Why gated:** `gsd-t-scan.workflow.js` is M99-D2-owned + was under active M99 verify when requested — editing mid-verify risks corrupting the verification. Do AFTER M99 completes + cpua, as its own quick-task.

**Coordination note (2026-06-30):** David is running a scan on **hilo-figma-atos** concurrently. When this #47 work ships + CPUA propagates: the mass-rename routine is idempotent and only touches EXISTING COMPLETED scan outputs, so it won't corrupt an in-flight scan. Still — verify hilo-figma-atos's scan has finished (or skip that project's rename this pass) before running the CPUA propagation, to avoid renaming a half-written register.

**Related:** the CPUA-mass-rename pattern mirrors M99's graphDB migration shim (one-shot, idempotent, runs during update-all, git-mv-aware, real-root-only) — reuse that shape.

---

## #48 — m44-run-dispatch live-repo tests: find the real async-handle leak + move to temp fixtures

**Type:** Tech debt (test infra) · **Status:** QUEUED · **Added:** 2026-06-30 · **Priority:** low

**Context:** 9 tests in `test/m44-run-dispatch.test.js` drove `runDispatch` against the LIVE GSD-T repo (`projectDir: repoRoot`). Under full-suite concurrency the planner left an async handle pending → the file ran ~27 min then false-failed with "Promise resolution is still pending but the event loop has already resolved", breaking the M99 verify CI-parity gate (2026-06-30).

**Stopgap shipped (commit 8b422c7):** gated the 9 live-repo tests behind `GSDT_SLOW_TESTS` (skip-loud) + pointed the stagger test at `mkTmpProject`. Default suite now fast/green; the live-repo tests run only with `GSDT_SLOW_TESTS=1`.

**Proper fix (this item):**
1. **Find the leaked handle.** `proveDisjointness` on the live repo returns in <1s (ruled out as the hang). The leak is elsewhere in `runDispatch`'s live-repo path — likely a `spawnSync` cache-warm probe or token-budget require that opens something not closed, surfacing only when the planner walks a large real `.gsd-t/domains/`. Run `node --test --test-only` with `--test-reporter` + `process._getActiveHandles()` to identify the dangling handle.
2. **Move all 9 live-repo tests to `mkTmpProject` fixtures** (deterministic task counts) so they don't depend on the repo's current domain state at all — a unit test walking the live repo is the root design flaw. Once on fixtures, remove the `GSDT_SLOW_TESTS` gate (they'll be fast).
3. Confirm the full suite runs these without the slow flag in <5s.

**Why low priority:** M99 verified green without them; the stopgap is loud (not silent-green). But a hidden handle leak in `runDispatch` could bite real fan-out dispatch, so the find-the-leak step has value beyond the test.

**Related memory:** [[feedback_slow_tests_starve_workflow_watchdog]] (the exact failure class), [[feedback_real_setup_playwright]] (test against real setup — but a unit test shouldn't depend on the live repo's mutable state).

---

## #49 — Scan checkpoint/resume — survive rate-limit kills without re-running the whole scan

**Type:** Enhancement (scan resilience) · **Status:** QUEUED · **Priority:** HIGH (real 30M-token waste observed) · **Added:** 2026-06-30 (user — hilo-figma-atos)

**Problem (user, real incident):** a 30-MILLION-token scan on hilo-figma-atos died in the last few steps (synthesis / start of document phase) due to **rate limits**. Resuming re-runs almost the ENTIRE scan — a huge waste of time AND tokens. A scan that stops on a rate limit must be relaunchable and **pick up where it left off**.

**Root cause:** the scan workflow (`templates/workflows/gsd-t-scan.workflow.js`) holds all progress — per-slice deep-finder results, the synthesized register — in WORKFLOW MEMORY until the final synthesis/document phase writes to disk. A kill (rate limit, crash) before that final write discards everything in memory → resume re-runs every deep-finder from scratch. There is NO incremental checkpoint. The phases (preflight → probe → graph-wiring → Deep Scan fan-out [N slices] → synthesis [archive+register] → document → plain-english) only persist at the very end.

**Design (the fix):**
1. **Per-slice checkpointing.** Each deep-finder writes its slice result to `.gsd-t/scan/.checkpoint/slice-<id>.json` (or .md) THE MOMENT it completes — not held in memory. Include a manifest `.gsd-t/scan/.checkpoint/manifest.json` recording: scan id/number, the full slice list from the probe, which slices are DONE (with a content hash of the slice's input files so a changed file re-runs only that slice), graph-wiring mode, the probe's volume numbers.
2. **Resume detection.** On scan launch, if `.gsd-t/scan/.checkpoint/manifest.json` exists for an unfinished scan (no final register written), READ the done-slice results off disk and only re-run the MISSING slices, then proceed to synthesis. A scan that died at synthesis resumes by loading all N done slices + jumping straight to synthesis — minutes, not hours.
3. **Phase-level checkpoints too.** After synthesis writes the register, mark it done in the manifest so a kill in the document/plain-english phase resumes from THERE (don't re-synthesize). The document + plain-english phases are independently resumable (each marks done in the manifest).
4. **Checkpoint cleanup.** On successful full completion, delete `.gsd-t/scan/.checkpoint/` (or move under `scan/archive/` per #47). Gitignore the checkpoint dir.
5. **Rate-limit-aware.** When a finder agent fails specifically on a rate limit (vs a real error), the workflow should record the slice as PENDING (not failed) so resume retries it, and ideally surface "halted on rate limit — relaunch to resume" rather than a generic failure.

**Why HIGH priority:** the waste is enormous and concrete (30M tokens, hours). Scan is the most token-heavy workflow and the most likely to hit rate limits on big repos (Atos-scale). Every other long workflow (wave, execute) has the same latent exposure but scan is where it bit.

**M81 sandbox note:** the checkpoint writes happen in the finder AGENTS' Bash (they have fs), not the orchestrator — same pattern as the existing scan dimension-file writes. The orchestrator only reads back the manifest via an agent() Bash on resume.

**Related:** #47 (scan output layout — checkpoint dir should fit the new `.gsd-t/scan/` structure), [[feedback_detached_fanout_false_completion]] (verify work on disk), [[feedback_measure_dont_claim]]. Mirrors the Workflow runtime's OWN resume (journal of completed agent() calls) — the scan workflow should checkpoint at the same granularity its host runtime does.
