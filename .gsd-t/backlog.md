# Backlog

## 1. M62 (post-M61): Cross-Project Propagation of v4.0.10
- **Type:** ripple | **App:** gsd-t | **Category:** propagation
- **Added:** 2026-05-29 | **Origin:** m61-deferred
- Run `gsd-t version-update-all` to propagate v4.0.10 to all 23 registered projects: rewrite their CLAUDE.md to drop retired-infra rules, update package.json, archive their token-log.md, and clean up `~/.claude/settings.json` hooks for retired infrastructure (conversation-capture, context-meter, in-session-usage).


## 2. M63 (post-M61): SC7 Cockpit Walkthrough on UI-Heavy Milestone
- **Type:** validation | **App:** gsd-t | **Category:** verification
- **Added:** 2026-05-29 | **Origin:** m61-deferred
- Deeper SC7 test of desktop-as-cockpit: drive a UI-heavy milestone (browser tooling exercised) entirely from the desktop app with zero terminal keystrokes. Validates the browser/Playwright leg of the cockpit promise that the small-backlog SC7 doesn't exercise.


## 3. M64 (post-M61): M52 Bake-Off
- **Type:** validation | **App:** gsd-t | **Category:** verification
- **Added:** 2026-05-29 | **Origin:** m61-deferred
- Run M52 (journey coverage) as a native Workflow to widen safety evidence beyond M58. Belt-and-suspenders; the build-hold + v3.x-legacy snapshot are the actual safety nets.


## 4. Agentic Workflow Architecture
- **Type:** feature | **App:** gsd-t | **Category:** architecture
- **Added:** 2026-02-13
- Evolve GSD-T commands from markdown instruction files into independent, spawnable agents. Each command becomes an agent that can: receive work requests and bid on them, work in parallel with other agents, communicate through contracts as shared interfaces, and self-organize into teams. Blocked by: Claude Code agent teams graduating from experimental status, agent spawn cost/latency improvements. See brainstorm session 2026-02-13 for full pros/cons analysis.


## 5. Living docs staleness detection
- **Type:** improvement | **App:** gsd-t | **Category:** commands
- **Added:** 2026-02-19
- gsd-t-health should flag docs with only placeholder content as STALE, not OK — existence check is insufficient if the file is full of `{description}` tokens. gsd-t-scan Step 5 should self-check after writing living docs and warn if infrastructure.md still contains only placeholder text (no commands, URLs, or real content found in codebase). Commands that depend on infrastructure knowledge should verify the doc has real content before proceeding, not silently consume placeholder text and fall back to guessing.


## 6. Auto-cleanup test data after test runs
- **Type:** improvement | **App:** gsd-t | **Category:** cli
- **Added:** 2026-02-19
- All temporary files, directories, or state created during the test suite must be automatically removed when the test run completes (pass or fail). Tests that currently leave artifacts behind can cause false positives/negatives in subsequent runs and pollute the working directory.


## 7. DB integration testing capability in QA agent
- **Type:** feature | **App:** gsd-t | **Category:** commands
- **Added:** 2026-02-19
- GSD-T currently has no built-in DB testing — it only runs whatever test suite already exists in the project. Add a DB testing step to the QA agent (or a new gsd-t-db-test command) that reads docs/infrastructure.md for the test DB connection, runs migrations against it, seeds test data, executes the project's DB test suite, and tears down the test DB on completion. Should be DB-agnostic (Postgres, SQLite, Supabase, etc.) and driven by commands documented in infrastructure.md.


## 8. GSD-T Workflow Visualizer
- **Type:** feature | **App:** gsd-t | **Category:** ux
- **Added:** 2026-02-25
- Add a `gsd-t-visualize` command (or `gsd-t-status --visual` flag) that renders the current project's workflow state as a visual diagram. Should show: milestone → domain → phase progression with status indicators (✅ complete, 🔄 in-progress, ⏳ pending, 🔴 blocked); contract connections between domains; task-level detail on demand; and the full GSD-T phase pipeline (partition → discuss → plan → impact → execute → test-sync → integrate → verify → complete) with the current position highlighted. Output options: ASCII/Unicode tree for terminal display, an HTML report for sharing, or a Mermaid diagram that renders in GitHub/VS Code. Reads from `.gsd-t/progress.md`, `.gsd-t/domains/*/tasks.md`, and `.gsd-t/contracts/` — no extra state needed. Goal: give the user an at-a-glance picture of where a milestone stands without having to parse markdown files manually.


## 9. Observability: Measurement, Logging, and Telemetry (SigNoz)
- **Type:** feature | **App:** gsd-t | **Category:** commands
- **Added:** 2026-02-25
- Integrate SigNoz (https://github.com/SigNoz/signoz) as the recommended observability stack for GSD-T-managed projects. SigNoz is an open-source, self-hosted alternative to Datadog/New Relic that provides distributed tracing, metrics, and logs in a single pane. GSD-T should support: gsd-t-setup detecting or prompting for observability choice, infrastructure.md documenting the SigNoz connection and dashboard URL, gsd-t-execute optionally wiring OpenTelemetry SDK into new services, and a health check for whether the project has observability configured. Enables teams to measure performance, debug production issues, and track error rates without vendor lock-in.


## 10. AI Evals Framework Integration
- **Type:** feature | **App:** gsd-t | **Category:** commands
- **Added:** 2026-02-25
- Add AI evaluation capabilities to GSD-T for projects that use LLMs. Reference: https://github.com/aishwaryanr/awesome-generative-ai-guide/blob/main/free_courses/ai_evals_for_everyone/README.md. GSD-T should support: a `gsd-t-evals` command (or integration into gsd-t-qa) that runs LLM output evaluation suites, defines eval criteria in contracts (expected output shape, quality thresholds, hallucination checks), integrates with eval frameworks (RAGAS, LangSmith, PromptFoo, or custom), and reports pass/fail against defined quality gates. The QA agent should be aware of eval steps when the project contains AI components. Living docs (requirements.md, architecture.md) should document eval criteria alongside functional requirements.


## 11. Cross-Project Shared Learning via Git
- **Type:** feature | **App:** gsd-t | **Category:** commands
- **Added:** 2026-03-31
- Enable GSD-T learning (ELO scores, metrics, QA patterns, event history) to be shared across users and machines via a centralized git repository. Currently, `.gsd-t/metrics/`, `.gsd-t/events/`, and `.gsd-t/qa-issues.md` are per-project and travel with each project's git repo — but cross-project ELO comparisons and aggregated pattern learning are local-only. Proposed approach: a `gsd-t-learning` command that syncs anonymized metrics to a shared "learning hub" repo (e.g., `gsd-t-learning-hub` on GitHub). Hub stores: aggregated ELO benchmarks by stack/project-type, common QA failure patterns and fixes, task duration baselines by complexity, stack rule effectiveness scores. Privacy: only aggregate metrics are shared — no source code, file paths, or proprietary content. Users opt-in per project. Benefits: new GSD-T users start with community-learned baselines instead of cold-start, teams share institutional knowledge across projects, stack rules evolve based on real-world effectiveness data.


## 12. Docker Support (Enterprise)
- **Type:** feature | **App:** gsd-t | **Category:** infrastructure
- **Added:** 2026-03-22
- Containerized GSD-T execution for enterprise security compliance. Dockerfile + docker-compose with Node.js + Claude Code + GSD-T pre-installed. Vault-injected secrets (no API keys on developer machines). Ephemeral containers — no credential persistence after run. Volume-mounted project directory. Egress-only network config. Primary interface is `gsd-t headless` (M23). PRD: docs/prd-gsd2-hybrid.md section 4.8, milestone M24. Exit criteria: `docker-compose up` runs a headless milestone, secrets via env vars (Vault-compatible), container is ephemeral, documentation complete. Depends on M23 (Headless Mode) being complete.


## 13. Integration smoke test for infrastructure config changes
- **Type:** improvement | **App:** gsd-t | **Category:** cli
- **Added:** 2026-04-04
- After writing infrastructure config, verify it took effect by running the corresponding check command. Currently the Red Team can't catch "wrote to the wrong file" bugs because tests validate code correctness, not environment integration. Add a post-config verification step to the install/update flow that confirms each config is discoverable by the target system. Origin: Figma MCP was written to settings.json but Claude Code reads MCP servers from ~/.claude.json — only caught by manual testing in a live session. Verification matrix: MCP servers → `claude mcp list` (confirm server appears); Heartbeat hooks → read settings.json hooks array (confirm entry exists); Update check hook → read settings.json SessionStart hook (confirm entry exists); Auto-route hook → read settings.json UserPromptSubmit hook (confirm entry exists); Global CLAUDE.md → read `~/.claude/CLAUDE.md` (confirm GSD-T section present); Slash commands → `ls ~/.claude/commands/` (confirm expected files exist); CGC/graph engine → `cgc --version` or equivalent health check; Utility scripts → `ls ~/.claude/scripts/` (confirm expected files exist).


## 14. Agent Topology Dashboard Redesign
- **Type:** ux | **App:** gsd-t | **Category:** commands
- **Added:** 2026-04-15
- Redesign `scripts/gsd-t-agent-dashboard.html` to match the reference design (dark card-based layout with colored borders, icons, status indicators). Key changes: (1) Agent names should reflect GSD-T roles (Research, Audit, Impact, Coding, Doc Update, QA, Red Team) — map from events data instead of showing generic types (General, Explore). (2) Each node card shows: agent role name, status indicator (Active/Thinking/Idle/Tool Call), current activity description, model name, elapsed time, tool call count, iteration count, token count. (3) Layout should be a proper directed graph with parent-child edges and clear connection lines — not the current flat row of tiny crammed nodes. (4) Clicking a node opens a right-side detail panel showing: full list of tool calls made by that agent, tokens consumed per tool call, timeline of actions, total duration and token summary. (5) Server (`scripts/gsd-t-agent-dashboard-server.js`) may need enriched SSE events to supply tool-call-level detail per agent. Reference image provided by user 2026-04-15.


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


## 26. Session Retrospective Agent (self-improving loop)
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


## 27. Vestigial component elimination + headless reconciliation
- **Type:** improvement | **App:** gsd-t | **Category:** cli
- **Added:** 2026-06-09
- Remove confirmed-dead components and fix-or-remove the broken headless arm (deep-dive audit 2026-06-09). Targets: `bin/orchestrator.js` + `bin/design-orchestrator.js` (zero callers since M61/M65), `bin/gsd-t-task-brief*.{js,cjs}` (abandoned M40 infra, test-only refs), `bin/gsd-t-context-brief-kinds/` (M56, never wired), compaction-pressure machinery (compactions.jsonl stale) + context-meter remnants (config loader at gsd-t.js:3023 loads for nothing). Headless arm: TD-114 (gsd-t-parallel.cjs runDispatch requires deleted headless-auto-spawn.cjs → SILENT fan-out demotion to sequential — violates no-silent-degradation) and TD-116 (gsd-t-unattended* commands MODULE_NOT_FOUND) — rewrite on native Workflows + /loop, or delete and de-register. RULE: every deletion target gets a requirer-grep before removal (M65 KEEP-list rule — deletion lists are hypotheses). Doc ripple: README headless section, command tables, CHANGELOG. Largely promotable from techdebt (TD-114, TD-116, TD-123 overlap). Scope: 1–2 domains, 1 wave.


## 28. Platform-invariants injection + micro-pre-mortem for debug fixes (left-shift the platform knowledge)
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


## 29. Proportional gating — deterministic diff-scoped verification lanes (trivial changes stop paying the full toll)

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


## 30. Firing debug-cycle circuit-breaker + repro-fixture-on-regression (stop the whack-a-mole)

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


## 31. Flaky CLI-subprocess test: `gsd-t status` hangs ~123s under cold parallel load → false CI-parity FAIL

**Added**: 2026-06-18
**Type**: tech debt (test-infra) | **App**: gsd-t | **Category**: test
**Origin**: surfaced during M89 verify (2026-06-18). `test/filesystem.test.js` → "CLI subcommands" → "status subcommand runs without error" `execFileSync(node, [CLI, "status"], {timeout: 15000})` ran **~123s** and false-failed the cache-cleared CI-parity gate, blocking M89's verify BEFORE the triad. In isolation the same test passes 40/40 in **372ms**. Last touched M61 (`e6afbab`) — NOT M89; M89's own suite is 1804/0 warm. So it's a pre-existing flake exposed by cold + parallel suite load.
- **Symptom:** the `gsd-t status` child exceeds its own 15s `timeout` (execFileSync SIGTERM doesn't reliably kill a child that spawns its own subprocesses / stalls on git or file reads under contention), runs to ~123s, fails the run.
- **Two candidate root causes (investigate):** (a) the TEST is fragile — needs a real child-tree kill + a generous-but-enforced timeout, or stub the subprocess; (b) `gsd-t status` itself has a latent slow/hanging path under cold cache or parallel git access (the more concerning one — a command that hangs 123s in CI is a real UX/CI bug, not just a test issue). Determine which before fixing — if (b), fix the command, not the test.
- **Decision (user, 2026-06-18):** backlog it, do NOT fix inline; re-verify M89 as-is and accept it may re-flake. If it re-blocks M89 repeatedly, escalate to fix-now.
- Scope: ~1 domain (diagnose status-under-load, then either harden the test [child-tree kill + timeout] or fix the command's slow path), <1 wave.


## 32. Red Team Realism gate — separate adversarial-collaboration agent bounds edge-case scope

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


## 33. `buildTaskBrief` / `extractTask` (bin/gsd-t-task-brief.js) can't parse Shape-D tasks.md headings — dead against real domains

**Added**: 2026-06-22
**Type**: tech debt (stale-tool) | **App**: gsd-t | **Category**: cli
**Origin**: 2026-06-22, while fixing the m40 self-test that my domain-prune broke. `extractTask` (bin/gsd-t-task-brief.js:33) builds `headerRe = /^###\s+Task\s+<num>\b/` — the OLD `### Task N: title` heading format. Current domains use Shape-D `### Mxx-Dx-Tx — title` (since the M61 Shape-D migration, per [[feedback_plan_for_parallel_execution]]). So `buildTaskBrief` returns "task not found" for EVERY real domain on disk — the tool is effectively dead against live milestones; only the synthetic `### Task N` fixture in m40-task-brief.test.js exercises it.
- **Question to resolve first (don't assume):** is `bin/gsd-t-task-brief.js` still USED anywhere? The M61 platform reconciliation moved briefs to `bin/gsd-t-context-brief.cjs` (the workflow brief collector). If `gsd-t-task-brief.js` is superseded/orphaned, the fix is RETIRE it (grep requirers, inline-then-delete per [[feedback_retire_scan_against_keep_list]]), NOT update its parser. If still live, update `extractTask` to parse Shape-D headings (`### Mxx-Dx-Tx` + the `**Files**`/`**Test**`/`**Acceptance criteria**` fields).
- **Interim (done 2026-06-22):** the m40 self-test was repointed from "live repo self-test" to a `mkFixtureProject()` end-to-end test (still exercises the tool, decoupled from live domains) so M90 verify isn't blocked. The deeper parser/retirement decision is this item.
- Scope: ~1 domain (decide retire-vs-fix, then either delete + requirer-inline or update parser + add a Shape-D fixture test), <1 wave.


## 34. Wire a LIVE spike-feasibility producer for the architectural-trigger response modes (R-FAIL-2 enforcement — M90 option B, deferred)

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


## 35. Classifier mis-routes an external SDK fact to internal/grep when a repo path co-occurs (M90 D3 MEDIUM edge)

**Added**: 2026-06-22
**Type**: tech debt (classifier-edge) | **App**: gsd-t | **Category**: cli
**Origin**: M90 verify Red Team MEDIUM, 2026-06-22. Confirmed on disk.
- **Plain version:** Ask "what does AWS's `putObject` return — check our `upload.js`." The right move is look up AWS's docs (external). But because you named one of your own files in the same breath, the classifier says "this is about your code, just grep locally" and never checks AWS — it'd answer confidently from your repo alone and could be wrong about AWS.
- **Repro:** `node bin/gsd-t-research-gate.cjs classify "what does the AWS S3 putObject return — see our src/upload.js"` → `{class:internal, route:grep}`. AWS/S3/putObject is an unlisted external SDK fact; the no-strong-external branch lets a repo path-anchor win, violating §1's "never guess-internal for an external fact."
- **Root:** the premise-corrected vendor list (kept as an external→web *upgrade*) doesn't cover AWS/S3/putObject, so `hasStrongExternal` is false; then the path-anchor makes it internal. A co-occurring external-SDK signal should at least downgrade to `ambiguous→judge`, not assert internal.
- **Fix direction:** when an external-API-shaped token co-occurs with a repo path and there's no strong-external vendor match, route `ambiguous→judge` (let the LLM decide), never `internal`. Add to the corpus + held-out fixture.
- Scope: ~1 domain (classifier branch + corpus rows), <1 wave. Deferred from M90 to avoid a classifier change right before shipping (kept verify stable).


## 36. Fence-awareness for the M91 PseudoCode marker parsers (defer-out — fail-closed today)

**Added**: 2026-06-22
**Type**: hardening / tech debt
**Origin**: M91 verify Red Team (GRUDGING-PASS) — three MEDIUM/LOW findings, all in the SAFE (fail-closed) direction, deferred out of M91 rather than expanding verify scope.

The M91 marker parsers match their markers ANYWHERE on a line, with no awareness of code fences / the doc's own Appendix. Three sites:
- `bin/gsd-t-guard-map.cjs` — a `[RULE …]` marker inside a ``` fence or the appendix is parsed as a live rule. **Direction is SAFE**: an extra fenced rule becomes an extra unbacked map-key requirement → spurious FAIL, never a vacuous pass (Red Team verified a fenced duplicate of an unbacked rule still FAILs exit 4 — a fence can never HIDE a divergence). The cost is a false-FAIL when a doc author quotes the grammar in an example.
- `bin/gsd-t-divergence-grammar.cjs` `countDivergences` — a valid-format `⚠ Divergence` line inside a fence/appendix is counted. Inflates the divergence count (no live consumer wires it as a gate today).
- `bin/gsd-t-milestone-state.cjs` — a doc showing its own `<!-- signed-off: … -->` marker as an example self-signs. (A doc cannot realistically quote its own sign-off marker, so lowest severity.)

**Why deferred, not fixed in M91**: every case errs fail-closed and none defeats a gate's purpose; fixing mid-verify would expand scope. The section enumerator (`enumerateSections`, §3.1) ALREADY does fence-exclusion correctly — the fix is to reuse that fence-tracking in the three marker parsers (one shared helper). Small (~1 domain, the three bin files + their tests + a "quoted-marker-in-fence ignored" case each).

**NOT in scope for fix**: changing fail-closed→fail-open. The fix only stops false-FAILs / count-inflation from a doc quoting its own grammar; it must NOT let a fenced real divergence pass. See [[feedback_coverage_check_structural_not_substring]] (structural, fence-aware), [[feedback_no_silent_degradation]].


## 37. Full Test & Build Telemetry Suite (flaky-test + reliability observability)

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


## 38. m44-run-dispatch live-repo tests: find the real async-handle leak + move to temp fixtures

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


## 39. Scan checkpoint/resume — survive rate-limit kills without re-running the whole scan

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

---


## 40. Scan dimension-file silent write-failure (reported success but file not regenerated)

**Type:** Bug (scan) · **Status:** QUEUED · **Priority:** MEDIUM · **Added:** 2026-06-30 (hilo-figma-atos)

**Problem:** On the hilo-figma-atos scan (2026-06-30), 4 of 5 dimension files regenerated but `business-rules.md` was NOT — it stayed the prior version (Jun 23) — **despite the workflow reporting `docsFailed: []`** (i.e. it claimed success). A dimension finder silently failed to write its file but the workflow counted it as done. Same false-success class as the M99 scan probe (`feedback_detached_fanout_false_completion` — trust disk, not narration).

**Investigate (in `templates/workflows/gsd-t-scan.workflow.js`):**
- The 5 dimension writers (~lines 874-882) each `Write` their `.gsd-t/scan/<dim>.md`. One returned/was-counted as ok without the file's mtime advancing.
- The `docsFailed` accounting must VERIFY each dimension file's mtime advanced (or content changed) post-write, not trust the agent's self-report. A finder that says "wrote it" but didn't must be counted as FAILED + retried, not silently passed.
- Likely cause: the business-rules finder agent hit an error/empty-response and returned without writing, but the result-collection treated a missing/empty result as "no findings → skip" rather than "failed → retry".

**Fix shape:** after the dimension-writer fan-out, stat each expected `.gsd-t/scan/<dim>.md`; any whose mtime is older than the scan start → mark failed, retry once, and if still stale → surface in `docsFailed` (never silent). Mirrors the M99 "verify on disk" discipline.

**Related:** [[feedback_detached_fanout_false_completion]], [[feedback_measure_dont_claim]]. Pairs with #49 (scan checkpoint/resume — both about scan write-integrity) and #47 (scan output layout).

---


## 41. Adopt Claude Sonnet 5 + refresh the model-tier policy (new model landed 2026-06-30)

**Type:** Enhancement (model policy) · **Status:** QUEUED · **Priority:** MEDIUM-HIGH (cost + quality win) · **Added:** 2026-06-30

**Trigger:** Anthropic released **Claude Sonnet 5** on 2026-06-30 (model id `claude-sonnet-5`). Confirmed live: the hilo-figma-atos scan's deep-finders ran on **Sonnet 5** (the `model: "sonnet"` ALIAS resolved to the new latest Sonnet at the harness level), even though GSD-T's tier policy still pins `claude-sonnet-4-6`. This is `feedback_nothing_in_gsdt_is_concrete` firing — a new model landed, re-evaluate.

**Benchmarks (Sonnet 5 vs 4.6 vs Opus 4.8, verified via web 2026-06-30):**
- SWE-bench: 58.1% → **63.2%** (Opus 4.8 = 69.2%)
- Terminal-Bench 2.1: 67.0% → **80.4%**
- Humanity's Last Exam (tools): 46.8% → **57.4%** (Opus 4.8 = 57.9% — Sonnet 5 NEARLY MATCHES Opus on reasoning)
- Lower hallucination + sycophancy than 4.6
- Pricing: **$2/$10 intro** (through Aug 31 2026), then $3/$15 — vs Sonnet 4.6 $3/$15, Opus 4.8 $5/$25
- 1M context

**Work:**
1. **Update `bin/gsd-t-model-tier-policy.cjs`** `MODEL_IDS.sonnet`: `claude-sonnet-4-6` → `claude-sonnet-5` (single-source — the alias path means literals everywhere update). Ripple: `model-tier-policy-contract.md`, the M85 lint fixtures, README/GSD-T-README tier descriptions.
2. **RE-EVALUATE the tier assignments** given Sonnet 5 ≈ Opus 4.8 on reasoning at ~40% the cost. Candidates to consider dropping Opus→Sonnet-5 (measure, don't assume): synthesis, some judge/verify stages. The 5 Fable stages (probes/judge/pre-mortem/red-team) stay highest-tier per M85, but the Opus-default stages are now a cost-vs-quality re-decision. KEEP the M82 blindness invariant (judge ≠ producers).
3. **Alias-vs-literal — CONFIRMED (not open):** the `/workflows` panel labeled all 13 hilo deep-finders "Sonnet 5" (image 2026-06-30 16:41). So `agent({model: "sonnet"})` resolves to the **harness-latest Sonnet (5)**, BYPASSING GSD-T's pinned `claude-sonnet-4-6`. Implication for the M85 "pin exact IDs" design: the pinned literals are NOT what runs for the alias tiers (sonnet/opus/haiku) — the harness rides-the-latest. This is a FREE quality upgrade but means GSD-T's tier policy can't actually pin a version for reproducibility on the alias path. DECIDE: keep ride-the-latest (free upgrades, less control) vs. pin concrete ids in the agent() calls (reproducible, manual upgrades). The M85 lint asserts the literals match the policy — but if the literals don't drive the run, that lint guards a no-op. Re-examine whether M85's pinning is load-bearing or cosmetic on the alias path.
4. Also check: are `claude-opus-4-8` / `claude-haiku-4-5` still current, or did they also get superseded?

**Related:** [[feedback_nothing_in_gsdt_is_concrete]] (re-evaluate on new model), [[feedback_no_silent_degradation]] (a silent model swap cuts both ways — surface it), [[feedback_measure_dont_claim]] (measure the tier re-assignment, don't assume).

---
- **Merged-in (#29, stale-by-date):** the June-22 Fable-5-promo-ends tier re-decision is subsumed here — refresh the tier policy + session default as part of adopting Sonnet 5.

## 42. Scan Document phase can silently produce ZERO output (agents complete outcome:null, no files written)

**Type:** Bug (scan) · **Status:** QUEUED · **Priority:** HIGH · **Added:** 2026-06-30 (hilo-figma-atos re-scan)

**Observed (hilo-figma-atos v4.15.10, 2026-06-30):** the Deep Scan + register succeeded perfectly (254 findings, WIRED, Sonnet 5, no rate-limit). But the **Document phase ran for 24+ min producing ZERO files** — no dimension files, no docs, no plain-english, no share/. Agents kept spawning/completing (1040/1054, no pile-up) but every `subagent_complete` had `outcome:null` (not "success"), heavy Bash+Read, only 1 Write in a whole window that produced nothing on disk. The user had to MANUALLY re-run document creation, which then worked (all files landed 22:14). So the Document phase is intermittently a no-op that reports alive-but-does-nothing.

**Compounding exposure (the dangerous part):** #47's archive step moves the prior dimension files to `.gsd-t/scan/archive/*-STAMP.md` BEFORE regeneration. When regeneration produces nothing (this bug), the project is left with NO current dimension files — recoverable from archive/ but a real gap. **Fix ordering:** either regenerate-then-archive, OR archive to a temp and only commit the archive after regeneration is verified on disk.

**Two bugs to fix:**
1. **Document phase produces nothing / outcome:null.** Investigate why the per-doc agents in `templates/workflows/gsd-t-scan.workflow.js` (docTargets fan-out ~line 930) complete without writing. Likely: agent gets the prompt, does Bash/Read, but the Write never fires or targets the wrong path; OR the merge-not-overwrite logic sees the archived-away file as "absent" and takes a branch that no-ops. The `outcome:null` (vs "success") is the tell — the result-collection isn't verifying each doc's file landed.
2. **Verify-on-disk gate (pairs with #50).** After the document fan-out, stat each expected output (5 dimension files + docs + plain-english + share/); any whose mtime didn't advance past scan-start → mark FAILED, retry once, surface loudly. Never report the scan "complete" with a silently-empty document phase. This is the same "trust disk not narration" discipline as [[feedback_detached_fanout_false_completion]].

**Related:** #50 (business-rules single-file silent write-fail — same class, this is the WHOLE-PHASE version), #47 (the archive-before-regenerate ordering that turns this into a gap), #49 (scan checkpoint/resume). All four are scan write-integrity. Strong candidate to bundle #50+#52 (+ the #47 ordering fix) into one "scan document-phase write-integrity" milestone.


## 43. Universal Build-Number Rule (hard default, all projects)
- **Type:** architecture | **App:** gsd-t | **Category:** templates
- **Added:** 2026-07-01 | **Priority:** HIGH (promote-later) | **Origin:** BinVoice repeated-directive struggle
- **Problem:** David gave the "increment the build number every build" directive many times over weeks in BinVoice before it finally stuck. Without it, testing is blind — same build number means no way to tell whether you're running new or old code. Must become a framework default so no project ever ships un-versioned builds again.
- **Proven scheme (mirror BinVoice — the one that finally worked):** build label = `MAJOR.MINOR.PATCH.<git-commit-count>` + short git SHA as a cross-component match key. Real example: `0.03.10.404 · 38b6ee2`. Build number = `git rev-list --count HEAD`, computed FRESH at build time (never persisted in a committed file), baked only into `dist/`.
- **The enforcement insight (the key):** the number only advances on commit, so building with uncommitted functional source would silently reuse the last number and LIE about the bundle. Therefore the build MUST hard-fail (`process.exit(1)`) when functional source is uncommitted — a dirty-tree gate (`assertCleanTreeOrDie()`). Emergency escape: `ALLOW_DIRTY_BUILD=1`. Surface the label at startup (console banner + UI/hover); cross-component builds show each other's SHA to eyeball-match "same code."
- **Bake-in (4 parts):** (1) `gsd-t-init` scaffolds `gitVersion()` + `assertCleanTreeOrDie()` build-stamp into new projects, stack-appropriate; (2) a CLAUDE.md hard rule at Pre-Commit/Build-gate weight (same as the destructive-action guard); (3) a `gsd-t-verify` check that the build number advanced; (4) a one-shot migration command for existing projects.
- **Opt-out:** ONLY if explicitly declared in a project's own CLAUDE.md. Otherwise non-negotiable default.
- **Pairs with #48** (trace logging) + **#49** (audit logging) — all "framework-default infrastructure baked into every project"; could ship as one milestone or several.


## 44. Universal Trace Logging (contract + rule + scaffolding)
- **Type:** architecture | **App:** gsd-t | **Category:** contracts
- **Added:** 2026-07-01 | **Updated:** 2026-07-02 (split from combined trace+audit) | **Priority:** HIGH (promote-later) | **Origin:** BinVoice + WindowsVoiceTranscription debugging struggles
- **Problem:** Repeatedly hard/impossible for GSD-T to debug issues that would be trivial WITH full tracing data. Multi-day debugging sessions (BinVoice, WindowsVoiceTranscription) could have been minutes if trace data were visible. Rule David stated: **"there's never enough detail"** — data packets, events, transmissions, results, every LLM call, every error/catch, every decision (candidate-vs-chosen). If a result happens in the running app, it must be traceable when there's a bug.
- **Default:** EVERY project, few exceptions (WindowsVoiceTranscription would have BENEFITED from trace — so even the "trace-optional" example still wants it). Opt-out only if explicitly declared in the project's own CLAUDE.md.
- **Proven template — BinVoice `src/trace/` (grounded, not invented):** emitter (`trace.ts`) + transport (`trace-transport.ts`) + category labels (`categories.ts`) + shared DTO `TraceRecord` (`shared/src/dto/trace-record.ts`): `{ ts, category, decision: boolean|null, detail, key?, status?, data?: Record<string,unknown> }`. Server-side emitter mirrors it with a `srv:` category prefix. Governed by `trace-logging-contract.md`. Declared in the DTO itself as "a DEBUGGING SIGNAL STREAM, not an audit log, not PII storage" — **bars PII** (HC-003: no buyer emails/phones/addresses).
- **Toggle (David chose: runtime flag + env override):** the one-line in-module `setTraceEnabled()` seam (BinVoice pattern) PLUS an env var (e.g. `TRACE=1`) so it can flip without code. On when debugging / hunting unknown issues; off in normal runs (it's a lot of data). BinVoice also soft-dormants the channel when no endpoint is configured.
- **Storage (David chose: STACK-ADAPTIVE, but PAUSE for human approval with alternates):** scaffolding proposes per detected stack — has-a-DB → a `trace_logs`-style table (BinVoice pattern; client batches POST → server bulk-insert → admin newest-first viewer); no-server/desktop → a local rotating JSONL file. **The scaffolder must STOP and get human approval of the storage choice, presenting the alternative options**, not silently pick. The contract fixes the ENVELOPE; storage is whatever fits.
- **Treatment: CONTRACT + RULE + SCAFFOLDING.** (1) `trace-logging-contract.md` defines the required trace-entry envelope fields, which `gsd-t-verify` enforces; (2) a CLAUDE.md hard rule making trace a default ("Trace Everything" — BinVoice made it a pre-commit-gate rule: every LLM call + every error/catch/non-OK path + every decision emits a record); (3) `gsd-t-init` scaffolds the trace module + toggle + storage seam (stack-adaptive, approval-gated).
- **KEY REFINEMENT (schema varies per project):** infrastructure baked uniformly, but the **trace CATEGORIES vary** (a browser-extension's `Post`/`Image`/`Classify`/`Egress` ≠ a transcription app's `AudioChunk`/`VAD`/`Transcript`/`DeviceSwitch`). Contract fixes the SHAPE; a per-project distillation step teases out the concrete category list "at the right stage of building the app" (milestone/partition, or a `populate`-style pass). Brownfield: the distillation reconciles existing ad-hoc logging against the universal envelope rather than bolting a second parallel system beside it.
- **Pairs with #47** (build-number) + **#49** (audit) — all framework-default infrastructure baked into every project. Could ship together or sequentially. See [[feedback_no_confabulated_examples]] — keep the per-project category examples grounded/labelled-hypothetical.


## 45. Universal Audit Logging (contract + rule + scaffolding) — DESIGNED FRESH
- **Type:** architecture | **App:** gsd-t | **Category:** contracts
- **Added:** 2026-07-02 (split from #48) | **Priority:** HIGH (promote-later) | **Origin:** need for admin-facing history + high-compliance projects
- **Problem:** David needs **admin-facing audit history** so an administrator can look back at (e.g.) a client's history when there's an issue — **WITHOUT getting GSD-T involved** — and to satisfy high-compliance requirements. This is DISTINCT from trace: trace = a debugging signal stream (transient, PII-barred, toggleable); audit = a durable, admin-readable record of who-did-what for accountability/compliance.
- **Default:** every project EXCEPT explicit opt-out. Opt-out example: WindowsVoiceTranscription needs trace but NOT audit. (So: audit is opt-OUT-able; trace is effectively always-on.)
- **DESIGNED FRESH — BinVoice is NOT a template for this.** BinVoice has NO audit log: sensitive admin actions (user creation, "Login As" impersonation, activation clicks) hit only ephemeral Pino **stdout** — no persisted table, no admin history UI, no compliance/lookback query surface. So audit must be built new.
- **Audit entry schema (the fresh design — the who/what/when/before→after record):** at minimum `{ ts, actor (who — user/admin/system id), action (what — a project-specific verb), target (the entity acted on), before, after, context (ip/session/request-id) }`. Unlike trace's `decision:boolean`, audit is a state-change record. Admin-facing = there must be a **query/view surface** (history viewer, filterable by actor/target/time) — that's the whole point ("look back without GSD-T").
- **Storage (David chose: STACK-ADAPTIVE, PAUSE for human approval with alternates):** same rule as #48 — has-a-DB → a dedicated `audit_log` table; no-server → a local append-only store. Scaffolder STOPS for human approval, presents alternatives. Since audit is admin-QUERYABLE, a no-server project still needs something queryable (embedded SQLite likely, not a flat file) — flag this at approval time.
- **Retention/immutability (David chose: APPEND-ONLY + configurable retention window):** entries are IMMUTABLE (append-only, never edited/deleted in normal operation) with a **default retention period a project can EXTEND** (high-compliance → extend to years/indefinite). Contract requires the append-only shape; the window is configurable. (Contrast trace, which may rotate/purge freely.)
- **Treatment: CONTRACT + RULE + SCAFFOLDING.** (1) `audit-logging-contract.md` defines the required audit-entry envelope + the append-only + query-surface requirements, `gsd-t-verify` enforces; (2) a CLAUDE.md rule making audit a default (opt-out-able); (3) `gsd-t-init` scaffolds the audit store + write helper + admin query surface (stack-adaptive, approval-gated).
- **KEY REFINEMENT (schema varies per project):** the audited ACTIONS vary per app (an e-commerce app audits refunds/role-changes/impersonation; a CRM audits record edits/exports). Contract fixes the envelope; per-project distillation teases out the concrete action list at the right build stage; brownfield reconciles existing ad-hoc admin logging (e.g. BinVoice's scattered `req.log.info` admin calls) into the real audit store.
- **Pairs with #47 + #48.** Distinct-from-trace boundary is load-bearing — do NOT let a build collapse them into one stream (BinVoice's admin "Trace" view is explicitly NOT an audit log; repeating that conflation is the anti-pattern to avoid).


## 46. Wire /gsd-t-stories into the GSD-T build pipeline (stories as the front-of-pipeline spec)
- **Type:** architecture | **App:** gsd-t | **Category:** commands
- **Added:** 2026-07-07 | **Priority:** MEDIUM (promote-later; prove standalone first) | **Origin:** "how could gsd-t-stories improve the d-t workflow" (2026-07-07)
- **Problem/opportunity:** `/gsd-t-stories` (v4.19.10) currently produces an ISOLATED client/dev-handoff deliverable. But a user story with acceptance criteria + mapped test cases is already a near-perfect milestone spec — it's the missing BRIDGE between "what to build" (requirements) and "how to build it" (partition/plan/verify). Wiring it in turns it from a deliverable into the FRONT of the build pipeline.
- **Integration surfaces (each a candidate domain):**
  - **Stories → milestone/partition:** each Epic → a milestone; each story → a domain/task. The story's **Acceptance Criteria BECOME the falsifiable success criteria** GSD-T already demands (no re-derivation). New successor mapping `stories → milestone`.
  - **Mapped Test Cases → test-sync/QA:** each story ships Positive/Negative/Edge test cases = executable test stubs; feed to test-sync/QA so tests TRACE to a story, closing the requirement→test traceability loop the verify triad values (and currently re-derives).
  - **Stories → PseudoCode:** per-story Workflow + Acceptance Criteria map ~1:1 onto the intention-first PseudoCode behavior-map (milestone source-of-truth); stories could SEED it.
  - **Scan consolidation (CG-N) ↔ stories:** the M-consolidation groups (v4.18.10) and stories are duals — a consolidation group IS "fix this as one story"; stories could consume CG-N groups directly.
  - **Reverse-engineered stories → gap-analysis:** run stories on an inherited codebase (Newman/Hilo) → the ACTUAL stories the code implements → diff against intended requirements = a real gap map.
- **THE single biggest win:** acceptance-criteria + test-cases are the two things the verify triad needs and re-derives today. If a story flows into partition, its criteria ARE the success criteria and its test cases ARE the QA baseline — one spec carries all the way through verify.
- **Scope/shape:** milestone-sized (touches partition/plan/verify/test-sync + a story↔milestone contract); competition-worthy (how do stories map to domains — 1 epic=1 milestone vs 1 story=1 domain vs criteria=SCs). NOT a quick edit.
- **Sequencing gate:** PROVE `/gsd-t-stories` standalone on a real project FIRST (Newman/Hilo end-to-end incl the Mermaid→PNG→embed→docx pipeline) before wiring it into the pipeline — don't build integration on an unproven generator. See [[feedback_measure_dont_claim]] + [[feedback_unproven_assumption_stop_and_research]].


## 47. Enforce jargonless output as co-equal with brevity (incl. mid-work narration)
- **Type:** improvement | **App:** gsd-t | **Category:** output-quality
- **Added:** 2026-07-08 | **Origin:** conversation 2026-07-08
- **Problem:** The brevity work optimized for *short*, but short and *clear* are different axes — and jargon is short, so the current rules reward it. David's original directive weighted **jargonless** as first-class (stated many times, strongly), co-equal with short/concise/bulleted — NOT a trade-off. In practice it's under-enforced: brevity got a blocking Stop hook + Reader Contract examples + a lint; jargonless got one soft "gloss jargon" bullet, no examples for code-terms, and nothing at all governing mid-work narration.
- **Two leak points — only one is covered today:**
  1. **Formal stops** (options to pick from, plans, summaries) — partly covered by the soft "gloss jargon" line, but it loses to "be short" under pressure.
  2. **Thinking-out-loud narration** ("Let me fix the function — remove the idorvanity path") — NOT governed at all. These are the model talking to itself in the code's own vocabulary while David reads over its shoulder to catch wrong directions. This is the primary pain.
- **David's key insight (the crux):** individual shorthand terms are sometimes decodable, but **when several are mashed together in one sentence, it becomes unintelligible** — even if he'd recognize each term alone. Example he flagged: an options prompt reading `Keep the serializeUser admin-users change (correct latent fix, but NOT your 500 cause)?` — so opaque he had to add an "I don't understand" escape-hatch option. That escape hatch existing AT ALL is the system failing. >50% of acronyms/jargon/shorthand are meaningless to him.
- **The rule to add (co-equal, every-line, cost-a-few-words-if-needed):** Any term pulled from the code — function/file/variable name, ID, acronym, shorthand — MUST be stated as *what it means in plain words* the first time it appears, even at the cost of a few extra words. Clarity is NOT traded for brevity; they are co-equal. A short line the reader can't decode has FAILED the directive, not passed it. **Litmus test:** if the term would make David stop and ask "what's that?", it already failed — rewrite before sending. Applies to EVERY line, including mid-work narration, not just formal answers. Special guard against **stacked shorthand**: never chain 2+ undecoded terms in one sentence.
- **Chosen approach — INSTRUCTION, not a per-line hook (decided in conversation):** A line-by-line blocking hook was rejected — it would burn context (every intercept re-feeds text; blocking forces re-generation) and degrade quality (a pattern-matcher flags false positives and interrupts mid-flow) — same reason the old pattern-matching brevity hook was retired. The instruction path has near-zero context cost (it changes word choice, not process) and improves quality. Its one honest limitation: reliability depends on the model holding the standard every turn (the exact thing that's been slipping) — so if it still slips after this, the NEXT escalation is a hook, accepting those costs. Try instruction first; it's free and reversible.
- **Concrete edits (2 files, ~4 lines, no new script/hook logic):**
  1. `scripts/gsd-t-auto-route.js` — the `READER_CONTRACT` array (~lines 32–42) is the per-turn reminder block injected every turn via the UserPromptSubmit hook. This is what actually keeps the model honest turn-to-turn (it's why brevity sticks). (a) Sharpen the "gloss jargon" bullet (line 36) into the hard co-equal every-line version above, incl. the stacked-shorthand guard and the litmus test. (b) Add two before→after examples to the EXAMPLES list: `"Remove the idorvanity path." → "Remove the code path that accepts either an ID or a name."` and the serializeUser options-rewrite (`"Keep the serializeUser admin-users change?" → "Keep the extra safety fix on the admin users screen — dates now forced into one standard format?"`, with a note: never make the user add an "I don't understand" option).
  2. `~/.claude/CLAUDE.md` — the Reader Contract prose already has a soft "gloss jargon" line; mirror the sharpened wording there so the permanent copy and the per-turn injected copy agree.
- **Worked rewrite (proof it's same-length, zero-decode):** the serializeUser options prompt rewritten — "**Keep the extra safety fix I found, or drop it?** While hunting your server crash, I found a *separate* bug on the admin users screen: dates weren't being forced into one standard format before sending, which can break things later. I fixed it and added a test. But it was NOT what caused your crash (that was a mislabeled post ID in the search feed, already fixed). 1. Keep both. 2. Keep only the crash fix." — same length, no term he'd stop on, no "I don't understand" option needed.
- **Cost check:** Context — adds ~4 sentences to a block already injected every turn; negligible; no re-generation. Quality — goes UP (changes word choice, not process). Does NOT add a hook, line-by-line inspection, or blocking.
- **Timing note:** deferred because a big milestone was building in another session; editing the hook script takes effect on that session's next turn. Spin up when that session completes.
- See memory: [[feedback_concise_answer_first]], [[feedback_decisions_need_real_examples]], [[project_m93_brevity_guard]].

## 48. Audit log tamper-EVIDENCE (hash-chain) — beyond trigger-based defense-in-depth
- **Type:** architecture | **App:** gsd-t | **Category:** contracts
- **Added:** 2026-07-08 | **Priority:** MEDIUM | **Origin:** M100 verify Red Team (immutability defeated 2 fix-cycles → scoped as defense-in-depth)
- **Problem:** M100's audit immutability is trigger-based (SQLite gate+sentinel, self-healing) = real defense-in-depth against accidental/in-app/casual mutation, but NOT tamper-proof against a hostile process with direct .db-file write access — a fundamental limit of in-file triggers (the guard needs its own guard, recursively; the Red Team defeated each layer across 2 verify fix-cycles). M100 documented this as a KNOWN LIMITATION (audit-logging-contract §Append-only immutability) and scoped hostile-direct-DB-write OUT.
- **This item:** add tamper-EVIDENCE (detectable-not-preventable): a **hash-chained append-only log** — each audit entry stores a hash of (its own content + the prior entry's hash), so ANY edit/delete/reorder breaks the chain and is provably detectable on a verify pass. Optionally pair with off-box log-shipping / an OS append-only file (chattr +a) for prevention. Adds a `verifyAuditChain()` admin operation.
- **Why separate:** genuine tamper-evidence is a distinct security primitive (crypto hash-chain + a verify surface), heavier than a default logging module should carry; belongs in its own milestone for high-compliance projects that need it, not the universal default.
- **Pairs with:** the M100 logging arch (trace #48 / audit #49 shipped as M100). See audit-logging-contract §KNOWN LIMITATION.
