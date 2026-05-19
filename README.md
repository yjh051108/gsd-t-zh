# GSD-T: Contract-Driven Development for Claude Code

A methodology for reliable, parallelizable development using Claude Code with optional Agent Teams support.

**Eliminates context rot** — task-level fresh dispatch (one subagent per task, ~10-20% context each) means compaction never triggers.
**Compaction-proof debug loops** — `gsd-t headless --debug-loop` runs test-fix-retest cycles as separate `claude -p` sessions. A JSONL debug ledger persists all hypothesis/fix/learning history across fresh sessions. Anti-repetition preamble injection prevents retrying failed hypotheses. Escalation tiers (sonnet → opus → human) and a hard iteration ceiling enforced externally.
**Safe parallel execution** — worktree isolation gives each domain agent its own filesystem; sequential atomic merges prevent conflicts.
**Maintains test coverage** — automatically keeps tests aligned with code changes.
**Catches downstream effects** — analyzes impact before changes break things.
**Protects existing work** — destructive action guard prevents schema drops, architecture replacements, and data loss without explicit approval.
**Visualizes execution in real time** — live browser dashboard renders agent hierarchy, tool activity, and phase progression from the event stream.
**Generates visual scan reports** — every `/gsd-t-scan` produces a self-contained HTML report with 6 live architectural diagrams, a tech debt register, and domain health scores; optional DOCX/PDF export via `--export docx|pdf`.
**Self-learning rule engine** — declarative rules in rules.jsonl detect failure patterns from task metrics. Candidate patches progress through a 5-stage lifecycle (candidate, applied, measured, promoted, graduated) with >55% improvement gates before becoming permanent methodology artifacts.
**Cross-project learning** — proven rules propagate to `~/.claude/metrics/` and sync across all registered projects via `update-all`. Rules validated in 3+ projects become universal; 5+ projects qualify for npm distribution. Cross-project signal comparison and global ELO rankings available via `gsd-t-metrics --cross-project` and `gsd-t-status`.
**Stack Rules Engine** — auto-detects project tech stack (React, TypeScript, Node API, Python, Go, Rust) from manifest files and injects mandatory best-practice rules into subagent prompts at execute-time. Universal security rules always apply; stack-specific rules layer on top. Includes **design-to-code** rules for pixel-perfect frontend implementation from Figma, screenshots, or design images — with Figma MCP integration, design token extraction, stack capability evaluation, and mandatory visual verification: every screen is rendered in a real browser, screenshotted at mobile/tablet/desktop, and compared pixel-by-pixel against the Figma design. Auto-bootstraps during partition when design references are detected. Extensible: drop a `.md` file in `templates/stacks/` to add a new stack.
**External Task Orchestrator + Streaming Watcher UI (M40, v3.14.10)** — JS orchestrator drives `claude -p` one task per spawn: short-lived, fresh context, architecturally compaction-free. Benchmarks 0.72× wall-clock vs in-session on 20-task/3-wave workloads. Paired with a zero-Claude-cost local streaming UI at `127.0.0.1:7842` that renders all workers' stream-json output as a continuous claude.ai-style feed — task/wave banners, duration + usage chips, token corner bar, localStorage filters, replay via `WS /feed?from=N`. Recovery: `--resume` reconciles interrupted runs using commit + progress.md evidence; ambiguous tasks (commit without progress entry) are flagged for operator triage, never silently claimed done. CLI: `gsd-t orchestrate`, `gsd-t benchmark-orchestrator`, `gsd-t stream-feed`. Contracts: `stream-json-sink-contract.md` v1.1.0, `wave-join-contract.md`, `completion-signal-contract.md`, `metrics-schema-contract.md`.
**Always-Headless Spawn (M43 D4, v3.16.x+) — Channel Separation** — every GSD-T command spawns detached, unconditionally. No `--watch`, no `--in-session`, no `--headless` opt-in, no context-meter threshold that reroutes. The dialog channel is reserved for human↔Claude conversation; every workflow turn is a detached headless child. Interactive session shows a launch banner + live-transcript URL + event-stream path, then exits — results surface via the read-back banner on the user's next message. Detached workers emit JSONL events to `.gsd-t/events/YYYY-MM-DD.jsonl` at every phase boundary — shared by dashboard and (historically) the watch command. The only in-session surface is the `/gsd` router (for dialog-only exploratory turns). See `.gsd-t/contracts/headless-default-contract.md` v2.0.0 and `unattended-event-stream-contract.md` v1.0.0.
**Live Transcript as Primary Surface (M43 D6, v3.16.13 — extended in M47, v3.21.10)** — every detached spawn prints a one-line banner (`▶ Live transcript: http://127.0.0.1:{port}/transcript/{id}`) pointing at a browser viewer that SSE-streams the child's stdout and renders a collapsible "Tool Cost" sidebar panel showing per-tool attributed tokens and cost (sourced from `/transcript/:id/tool-cost`, which proxies to the M43 D2 tool-attribution library). The dashboard server auto-starts (`scripts/gsd-t-dashboard-autostart.cjs`) idempotently on each spawn — a port probe backs off when a server is already running, otherwise a fork-detach writes `.gsd-t/.dashboard.pid`. Port is project-scoped via `projectScopedDefaultPort(projectDir)` so multi-project workflows don't clobber each other.
**Rigorous User-Journey Coverage + Anti-Drift Test Quality (M52, v3.23.10)** — closes the M48→M51 drift pattern where each test round only caught previously-named bug shapes. Two-part fix: (a) `bin/journey-coverage.cjs` regex listener detector + `gsd-t check-coverage` CLI + `scripts/hooks/pre-commit-journey-coverage` commit gate (auto-installed on `gsd-t init`) — blocks viewer-source commits when uncovered listeners exist; (b) 12 inaugural journey specs in `e2e/journeys/` covering all 20 detected viewer listeners with functional assertions (zero `toBeVisible`-only tests). Red Team GRUDGING PASS: 5/5 broken viewer patches caught; hook block-then-unblock exercised. Suite: 2195/2195 unit + 35/35 E2E pass.
**Universal Playwright Bootstrap + Deterministic UI Enforcement (M50, v3.22.10)** — converts the prose-only "Playwright Readiness Guard" into three executable enforcement layers so agents cannot skip UI tests. Layer 1: `bin/playwright-bootstrap.cjs` + `bin/ui-detection.cjs` wired into `init`/`update-all`/`doctor`/new `gsd-t setup-playwright [path]` subcommand — idempotent installer detects package manager, installs `@playwright/test` + chromium, writes config from a contract-locked template, scaffolds `e2e/`. Layer 2: `bin/headless-auto-spawn.cjs::autoSpawnHeadless()` auto-installs before any of 9 whitelisted testing/UI commands when `hasUI && !hasPlaywright`; install failure → `mode: 'blocked-needs-human'` exit-4. Layer 3: `scripts/hooks/pre-commit-playwright-gate` (opt-in via `gsd-t doctor --install-hooks`) reads `.gsd-t/.last-playwright-pass` and blocks viewer-source commits when staged files are newer than the last playwright test pass. Also ships the M47/M48/M49 E2E viewer specs (`e2e/viewer/title`, `timestamps`, `chat-bubbles`, `dual-pane`, `lazy-dashboard`). 62 new unit tests; E2E 8/9 pass.
**Focused Visualizer Redesign (M47, v3.21.10)** — `/transcripts` opens directly to a dual-pane focused view: the **top pane** auto-streams the orchestrator's main in-session conversation (zero clicks — fetched via new `GET /api/main-session`), and the **bottom pane** streams whichever spawn the user clicks. A keyboard- and mouse-resizable splitter sits between them, with position persisted in `sessionStorage` (along with selection, completed-section toggle, and right-rail collapsed state). The left rail splits into three sections — `★ Main Session`, `Live Spawns`, and `Completed` (last 100 spawns, newest first, status-badged, collapsible). When a spawn transitions running → completed it moves rail sections live without a full reload, and stays selected if focused. The right rail (Spawn Plan / Parallelism / Tool Cost) is preserved under a new collapsible toggle. Bookmarks to `/transcript/:spawnId` continue to land that spawn pre-selected in the bottom pane. Contract: `dashboard-server-contract.md` v1.3.0 (additive — `status: 'active' \| 'completed'` field on in-session entries, derived from a 30s mtime window; `/api/main-session` endpoint with path-traversal guard + `Cache-Control: no-store`).
- **Surgical model selection** — `bin/model-selector.js` assigns haiku/sonnet/opus per phase via a declarative rules table; `/advisor` escalation path with convention-based fallback.
- **Per-spawn token telemetry** — `.gsd-t/token-metrics.jsonl` records one 18-field row per Task subagent spawn.
**Context Meter (M34/M38/M43 D4) — Observational Only** — PostToolUse hook writes `.gsd-t/.context-meter-state.json` via local token estimation. Under M43 D4 (channel-separation inversion, `headless-default-contract.md` v2.0.0) the meter is OBSERVATIONAL ONLY: the pct is recorded into the token-log `Ctx%` column on the next spawn, but no threshold gates any routing decision — every command spawns detached regardless. The `context-meter-contract.md` single-band model is preserved for the value itself; it no longer drives in-flight pauses or spawn-time rerouting.
**Quality North Star** — projects define a `## Quality North Star` section in CLAUDE.md (1–3 sentences, e.g., "This is a published npm library. Every public API must be intuitive and backward-compatible."). `gsd-t-init` auto-detects preset (library/web-app/cli) from package.json signals; `gsd-t-setup` configures it for existing projects. Subagents read it as a quality lens; absent = silent skip (backward compatible).
**Design Brief Artifact** — during partition, UI/frontend projects (React, Vue, Svelte, Flutter, Tailwind) automatically get `.gsd-t/contracts/design-brief.md` with color palette, typography, spacing system, component patterns, and tone/voice. Non-UI projects skip silently. User-customized briefs are preserved. Referenced in plan phase for visual consistency.
**Design Verification Agent** — after QA passes on design-to-code projects, a dedicated verification agent opens a browser with both the built frontend AND the original design (Figma page, design image, or MCP screenshot) side-by-side for direct visual comparison. Produces a structured element-by-element comparison table (30+ rows) with specific design values vs. implementation values and MATCH/DEVIATION verdicts. An artifact gate enforces that the comparison table exists — missing it blocks completion. Separation of concerns: coding agents code, verification agents verify. Wired into execute (Step 5.25) and quick (Step 5.25). Only fires when `.gsd-t/contracts/design-contract.md` exists — non-design projects are unaffected.
**Exploratory Testing** — after scripted tests pass, if Playwright MCP is registered in Claude Code settings, QA agents get 3 minutes and Red Team gets 5 minutes of interactive browser exploration. All findings tagged `[EXPLORATORY]` and tracked separately in QA calibration. Silent skip when Playwright MCP absent. Wired into execute, quick, integrate, and debug.

---

## Quick Start

### Install with npm

```bash
npx @tekyzinc/gsd-t install
```

This installs 49 GSD-T commands + 5 utility commands (54 total) to `~/.claude/commands/` and the global CLAUDE.md to `~/.claude/CLAUDE.md`. Works on Windows, Mac, and Linux.

### Start Using It

```bash
# 1. Start Claude Code in your project
cd my-project
claude

# 2. Full onboarding (git + init + scan + setup in one)
/gsd-t-init-scan-setup

# Or step by step:
/gsd-t-init my-project

# 4. Define what you're building
/gsd-t-milestone "User Authentication System"

# 5. Let it rip (auto-advances through all phases)
/gsd-t-wave

# Or go phase by phase for more control:
/gsd-t-partition
/gsd-t-discuss
/gsd-t-plan
/gsd-t-impact
/gsd-t-execute
/gsd-t-test-sync
/gsd-t-integrate
/gsd-t-verify
/gsd-t-complete-milestone
```

### Resuming After a Break

```bash
claude
/gsd-t-resume
```

GSD-T reads all state files and tells you exactly where you left off.

---

## CLI Commands

```bash
npx @tekyzinc/gsd-t install        # Install commands + global CLAUDE.md
npx @tekyzinc/gsd-t update         # Update global commands + CLAUDE.md
npx @tekyzinc/gsd-t update-all     # Update globally + all registered project CLAUDE.md files
npx @tekyzinc/gsd-t init [name]    # Scaffold GSD-T project (auto-registers)
npx @tekyzinc/gsd-t register       # Register current directory as a GSD-T project
npx @tekyzinc/gsd-t status         # Check installation + version
npx @tekyzinc/gsd-t doctor         # Diagnose common issues
npx @tekyzinc/gsd-t changelog      # Open changelog in the browser
npx @tekyzinc/gsd-t uninstall      # Remove commands (keeps project files)

# Headless mode (CI/CD)
gsd-t headless verify --json --timeout=1200  # Run verify non-interactively
gsd-t headless query status                  # Get project state (no LLM, <100ms)
gsd-t headless query domains                 # List domains (no LLM)

# Headless debug-loop (compaction-proof automated test-fix-retest)
gsd-t headless --debug-loop                             # Auto-detect test cmd, up to 20 iterations
gsd-t headless --debug-loop --max-iterations=10         # Cap at 10 iterations
gsd-t headless --debug-loop --test-cmd="npm test"       # Override test command
gsd-t headless --debug-loop --fix-scope="src/auth/**"   # Limit fix scope
gsd-t headless --debug-loop --json --log                # Structured output + per-iteration logs

# Parallel CLI (M44 D2 — task-level parallelism, mode-aware gating)
gsd-t parallel --help                                   # Usage, flags, gates, contract ref
gsd-t parallel --dry-run                                # Print worker plan table + exit (no spawn)
gsd-t parallel --mode in-session --dry-run              # 85% orchestrator-CW ceiling; N=1 floor
gsd-t parallel --mode unattended --dry-run              # 60% per-worker ceiling; > 60% → task_split
gsd-t parallel --milestone M44 --domain m44-d2-parallel-cli --dry-run

# CLI-Preflight + Brief + Verify-Gate (M55 — deterministic state checks + parallel substrate)
gsd-t preflight --json                                  # 6 built-in state checks; exit 0/4
gsd-t brief --kind execute --domain X --spawn-id Y      # ≤2,500-token JSON snapshot for worker spawn
gsd-t verify-gate --json                                # Two-track gate: D1 preflight + D2 parallel CLIs
gsd-t verify-gate --skip-track1 --json                  # Diagnostic: Track 2 only
gsd-t verify-gate --max-concurrency 4 --json            # Override D3-map default
gsd-t build-coverage --json                             # M57: new top-level paths must be a real CI build input (structural parse)
gsd-t ci-parity --json                                  # M57: reproduce the project's actual CI build locally (auto docker build)
```

`gsd-t parallel` consumes the M44 task-graph (D1) and applies three pre-spawn gates (D4 depgraph validation → D5 file-disjointness → D6 economics) followed by mode-aware headroom/split math. Extends — does not replace — the M40 orchestrator. Contract: `.gsd-t/contracts/wave-join-contract.md` v1.1.0.

Each iteration runs as a fresh `claude -p` session. A cumulative debug ledger (`.gsd-t/debug-state.jsonl`) preserves hypothesis/fix/learning history across sessions. An anti-repetition preamble prevents retrying failed approaches.

**Escalation tiers**: sonnet (iterations 1–5) → opus (6–15) → STOP with diagnostic summary (16–20)

**Exit codes**: `0` all tests pass · `1` max iterations reached · `2` compaction error · `3` process error · `4` needs human decision

### Updating

When a new version is published:
```bash
npx @tekyzinc/gsd-t@latest update
```

This will replace changed command files, back up your CLAUDE.md if customized, and track the installed version.

---

## Commands Reference

### Smart Router

| Command | Purpose | Auto |
|---------|---------|------|
| `/gsd {request}` | Describe what you need → auto-routes to the right command | Manual |
| _(any plain text)_ | Auto-routed via UserPromptSubmit hook — no leading `/` needed | Auto |

### Help & Onboarding

| Command | Purpose | Auto |
|---------|---------|------|
| `/gsd-t-help` | List all commands with descriptions | Manual |
| `/gsd-t-help {cmd}` | Detailed help for specific command | Manual |
| `/gsd-t-prompt` | Help formulate your idea before committing | Manual |
| `/gsd-t-brainstorm` | Creative exploration and idea generation | Manual |
| `/gsd-t-prd` | Generate a GSD-T-optimized Product Requirements Document | Manual |

### Project Initialization

| Command | Purpose | Auto |
|---------|---------|------|
| `/gsd-t-setup` | Generate or restructure project CLAUDE.md | Manual |
| `/gsd-t-init` | Initialize GSD-T structure in project | Manual |
| `/gsd-t-init-scan-setup` | Full onboarding: git + init + scan + setup in one | Manual |
| `/gsd-t-project` | Full project → milestone roadmap | Manual |
| `/gsd-t-feature` | Major feature → impact analysis + milestones | Manual |
| `/gsd-t-scan` | Deep codebase analysis → techdebt.md | Manual |
| `/gsd-t-gap-analysis` | Requirements gap analysis — spec vs. existing code | Manual |
| `/gsd-t-promote-debt` | Convert techdebt items to milestones | Manual |
| `/gsd-t-populate` | Auto-populate docs from existing codebase | Manual |
| `/gsd-t-design-decompose` | Decompose design into element/widget/page contracts | Manual |

### Milestone Workflow

| Command | Purpose | Auto |
|---------|---------|------|
| `/gsd-t-milestone` | Define new milestone | Manual |
| `/gsd-t-partition` | Decompose into domains + contracts | In wave |
| `/gsd-t-discuss` | Multi-perspective design exploration | In wave |
| `/gsd-t-plan` | Create atomic task lists per domain (tasks auto-split to fit one context window) | In wave |
| `/gsd-t-impact` | Analyze downstream effects | In wave |
| `/gsd-t-execute` | Run tasks — task-level fresh dispatch, worktree isolation, adaptive replanning | In wave |
| `/gsd-t-test-sync` | Sync tests with code changes | In wave |
| `/gsd-t-qa` | QA agent — test generation, execution, gap reporting | Auto-spawned |
| *Red Team* | Adversarial QA — finds bugs the builder missed (inverted incentives) | Auto-spawned |
| `/gsd-t-doc-ripple` | Automated document ripple — update downstream docs after code changes | Auto-spawned |
| `/gsd-t-integrate` | Wire domains together | In wave |
| `/gsd-t-verify` | Run quality gates + goal-backward behavior verification | In wave |
| `/gsd-t-complete-milestone` | Archive + git tag (goal-backward gate required) | In wave |

### Overnight / Idle-Run Commands (slower than in-session — use only for unattended overnight or multi-hour idle runs)

| Command | Purpose | Auto |
|---------|---------|------|
| `/gsd-t-unattended` | Launch detached supervisor for overnight/idle runs only | Manual |
| `/gsd-t-unattended-watch` | Watch tick — fires every 270s via ScheduleWakeup, reports supervisor status | Auto |
| `/gsd-t-unattended-stop` | Touch stop sentinel — supervisor halts after current worker finishes | Manual |

### Automation & Utilities

| Command | Purpose | Auto |
|---------|---------|------|
| `/gsd-t-wave` | Full cycle, auto-advances all phases | Manual |
| `/gsd-t-status` | Cross-domain progress view with token breakdown by domain/task/phase | Manual |
| `/gsd-t-resume` | Restore context, continue | Manual |
| `/gsd-t-quick` | Fast task with GSD-T guarantees | Manual |
| `/gsd-t-visualize` | Launch browser dashboard — SSE server + React Flow agent visualization | Manual |
| `/gsd-t-debug` | Systematic debugging with state | Manual |
| `/gsd-t-metrics` | View task telemetry, process ELO, signal distribution, domain health, and cross-project comparison (`--cross-project`) | Manual |
| `/gsd-t-health` | Validate .gsd-t/ structure, optionally repair | Manual |
| `/gsd-t-pause` | Save exact position for reliable resume | Manual |
| `/gsd-t-log` | Sync progress Decision Log with recent git activity | Manual |
| `/gsd-t-version-update` | Update GSD-T to latest version | Manual |
| `/gsd-t-version-update-all` | Update GSD-T + all registered projects | Manual |
| `/gsd-t-triage-and-merge` | Auto-review, merge, and publish GitHub branches | Manual |
| `/gsd-t-design-audit` | Compare built screen against Figma design — structured deviation report | Manual |
| `/gsd-t-design-build` | Build from design contracts with two-terminal review (Term 1 builder) | Manual |
| `/gsd-t-design-review` | Independent review agent for design build (Term 2 reviewer) | Auto |

### Backlog Management

| Command | Purpose | Auto |
|---------|---------|------|
| `/gsd-t-backlog-add` | Capture item, auto-categorize, append to backlog | Manual |
| `/gsd-t-backlog-list` | Filtered, ordered view of backlog items | Manual |
| `/gsd-t-backlog-move` | Reorder items by position (priority) | Manual |
| `/gsd-t-backlog-edit` | Modify backlog entry fields | Manual |
| `/gsd-t-backlog-remove` | Drop item with optional reason | Manual |
| `/gsd-t-backlog-promote` | Refine, classify, launch GSD-T workflow | Manual |
| `/gsd-t-backlog-settings` | Manage types, apps, categories, defaults | Manual |

### Git Helpers

| Command | Purpose | Auto |
|---------|---------|------|
| `/branch` | Create and switch to a new git branch | Manual |
| `/checkin` | Auto-bump version, stage, commit, and push | Manual |
| `/Claude-md` | Reload CLAUDE.md directives mid-session | Manual |
| `/global-change` | Apply file changes across all registered GSD-T projects | Manual |

---

## Workflow Phases

| Phase | Purpose | Solo/Team |
|-------|---------|-----------|
| **Prompt** | Formulate idea (pre-workflow) | Solo |
| **Project/Feature/Scan** | Initialize work | Solo (team for large scans) |
| **Milestone** | Define deliverable | Solo |
| **Partition** | Decompose into domains + contracts | Solo |
| **Discuss** | Explore design decisions | Both |
| **Plan** | Create atomic task lists | Solo (always) |
| **Impact** | Downstream effect analysis | Solo |
| **Execute** | Build it — task-level parallelism via `gsd-t parallel --help` (M44 D2/D3); conditional on >1 gate-passing task, falls back to sequential silently | Both |
| **Test-Sync** | Maintain test coverage | Solo |
| **Integrate** | Wire domains together | Solo (always) |
| **Verify** | Quality gates | Both |
| **Complete** | Archive + tag | Solo |

---

## Entry Points

- **"I have an idea"** → `gsd-t-project` → milestone roadmap → partition → execute
- **"I have a codebase and need to add something"** → `gsd-t-feature` → impact analysis → milestones
- **"I have a codebase and need to understand/fix it"** → `gsd-t-scan` → techdebt.md → promote to milestones

---

## Project Structure (What GSD-T Creates)

```
your-project/
├── CLAUDE.md
├── docs/
│   ├── requirements.md                # Functional + technical requirements
│   ├── architecture.md                # System design, components, data flow
│   ├── workflows.md                   # User journeys, technical processes
│   └── infrastructure.md             # Dev setup, DB, cloud, deployment
├── .gsd-t/
│   ├── progress.md                    # Master state file
│   ├── backlog.md                    # Captured backlog items (priority ordered)
│   ├── backlog-settings.md           # Types, apps, categories, defaults
│   ├── roadmap.md                     # Milestone roadmap
│   ├── techdebt.md                    # Technical debt register
│   ├── verify-report.md               # Latest verification results
│   ├── impact-report.md               # Downstream effect analysis
│   ├── test-coverage.md               # Test sync report
│   ├── contracts/
│   │   ├── api-contract.md
│   │   ├── schema-contract.md
│   │   ├── component-contract.md
│   │   └── integration-points.md
│   ├── domains/
│   │   └── {domain-name}/
│   │       ├── scope.md
│   │       ├── tasks.md
│   │       └── constraints.md
│   ├── events/                        # Execution event stream (JSONL, daily-rotated)
│   ├── retrospectives/                # Retrospective reports from gsd-t-reflect
│   ├── milestones/                    # Archived completed milestones
│   │   └── {milestone-name}-{date}/
│   └── scan/                          # Codebase analysis outputs
└── src/
```

---

## Key Principles

1. **Contracts are the source of truth.** Code implements contracts, not the other way around.
2. **Domains own files exclusively.** No two domains should modify the same file.
3. **Impact before execution.** Always analyze downstream effects before making changes.
4. **Tests stay synced.** Every code change triggers test analysis.
5. **State survives sessions.** Everything is in `.gsd-t/`.
6. **Plan is single-brain, execute is multi-brain.** Planning and integration always solo; execution and verification can parallelize.
7. **Every decision is logged.** The Decision Log captures why, not just what.
8. **Agents learn from experience.** Every command invocation, phase transition, and subagent spawn is captured as a structured event. Past failures surface before each task (Reflexion pattern). Distillation converts repeated patterns into lasting CLAUDE.md rules.

---

## Security

- **Wave mode** spawns phase agents with `bypassPermissions` — agents execute without per-action user approval. Use Level 1 or Level 2 autonomy for sensitive projects to review each phase.
- **Heartbeat logs** scrub sensitive patterns (passwords, tokens, API keys) from bash commands and mask URL query parameters before writing to `.gsd-t/heartbeat-*.jsonl`.
- **File write paths** are validated (within `~/.claude/`) and checked for symlinks before writing.
- **HTTP responses** are bounded at 1MB to prevent memory exhaustion from oversized registry responses.
- **Directory creation** validates parent path components for symlinks to prevent path traversal.
- Run `gsd-t doctor` to verify installation integrity. Keep GSD-T updated with `gsd-t update`.

---

## Overnight / Idle-Run Supervisor (M36 — v3.10.10+)

> **Daytime work runs in-session.** This supervisor is provided for unattended overnight or multi-hour idle runs only — it is dramatically slower than in-session execution because every worker iteration pays cold-context startup cost (re-reads CLAUDE.md, progress.md, all domain files) before doing real work, then is bounded to a 270s cache-warm budget. Reach for it only when you genuinely cannot supervise the run.

```bash
# Launch from the CLI (detached OS process)
gsd-t unattended --hours=24

# Or from within Claude Code
/gsd-t-unattended

# Stop (graceful — supervisor halts after the current worker finishes)
/gsd-t-unattended-stop
```

**How it works:**

- `gsd-t unattended` spawns `bin/gsd-t-unattended.js` as a fully detached OS process. The supervisor runs `claude -p` workers in a relay — one worker per iteration — each in a fresh context window. State is written atomically to `.gsd-t/.unattended/state.json` between iterations.
- `/gsd-t-unattended` does the same from inside Claude Code, then calls `ScheduleWakeup(270, '/gsd-t-unattended-watch')` to start an in-session watch loop that ticks every 270 seconds and prints progress.
- If you run `/clear` + `/gsd-t-resume` during a live run, the resume command auto-detects the running supervisor and re-attaches the watch loop — no re-launch needed.
- The supervisor halts automatically when: the milestone reaches COMPLETED status, the `--hours` wall-clock cap expires, `--max-iterations` is reached, safety rails detect a stall or unrecoverable error, or the stop sentinel is touched.

**Platform support:** macOS and Linux fully supported (including sleep-prevention via `caffeinate` on macOS). Windows is supported except sleep-prevention. See `docs/unattended-windows-caveats.md` for known Windows limitations.

**Key flags:**

| Flag | Default | Description |
|------|---------|-------------|
| `--hours=N` | 24  |  Wall-clock cap |
| `--max-iterations=N` | 200 | Iteration cap |
| `--milestone=NAME` | (current) | Override active milestone |
| `--dry-run` | false | Preflight only — no spawn |

**State files** live under `.gsd-t/.unattended/`: `supervisor.pid`, `state.json`, `run.log`, `stop` (sentinel). Authoritative field definitions: `.gsd-t/contracts/unattended-supervisor-contract.md` v1.0.0.

---

## Context Meter Setup (M34 — v2.75.10+)

The Context Meter replaces the v2.74.12 task-counter proxy with real context-window measurement via the Anthropic `count_tokens` API. This is the authoritative signal for session-stop gates in `gsd-t-execute`, `gsd-t-wave`, `gsd-t-quick`, `gsd-t-integrate`, and `gsd-t-debug`.

### 1. Set your API key

Create a key at [console.anthropic.com](https://console.anthropic.com) (free tier is sufficient — `count_tokens` calls are inexpensive) and export it in your shell profile:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

The env var name is configurable in `.gsd-t/context-meter-config.json` (default: `ANTHROPIC_API_KEY`).

### 2. Verify with `gsd-t doctor`

```bash
npx @tekyzinc/gsd-t doctor
```

Doctor checks:
- `ANTHROPIC_API_KEY` is set (RED if missing)
- PostToolUse hook is registered in `~/.claude/settings.json`
- `scripts/gsd-t-context-meter.js` exists in the project
- `.gsd-t/context-meter-config.json` parses cleanly
- A live `count_tokens` dry-run succeeds (RED on 401/403/network failure)

### 3. Adjust thresholds (optional)

Edit `.gsd-t/context-meter-config.json`:

```json
{
  "enabled": true,
  "apiKeyEnvVar": "ANTHROPIC_API_KEY",
  "modelWindowSize": 200000,
  "thresholdPct": 85,
  "checkFrequency": 1
}
```

- `modelWindowSize` — total context window (200K for Opus/Sonnet)
- `thresholdPct` — percentage at which the orchestrator halts (85% = stop band; 70% = warn band — cue for explicit pause/resume; no silent degradation)
- `checkFrequency` — run `count_tokens` every N tool calls (1 = every call; higher = cheaper + slightly delayed signal)

### 4. Live status

```bash
npx @tekyzinc/gsd-t status
```

Displays a Context line with `{pct}% of {window} tokens ({band}) — last check {time ago}`. Missing state file shows `N/A (meter hook not run this session)`.

### Upgrading from pre-M34

Running `gsd-t update-all` handles the migration automatically:
- Copies the new hook script, runtime files, config template, and `context-meter-config.cjs` loader into every registered project
- Runs a one-time task-counter retirement — deletes `bin/task-counter.cjs`, `.gsd-t/task-counter-config.json`, `.gsd-t/.task-counter-state.json`, and the `.gsd-t/.task-counter` state file
- Writes `.gsd-t/.task-counter-retired-v1` marker (subsequent runs are no-op)

After upgrading, **you must set `ANTHROPIC_API_KEY`** — `gsd-t doctor` will fail otherwise.

---

## Enabling Agent Teams

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

Teams are optional — all commands work in solo mode.

---

## Manual Installation (without npm)

```bash
# Windows
copy commands\*.md %USERPROFILE%\.claude\commands\

# Mac/Linux
cp commands/*.md ~/.claude/commands/
```

Verify with: `/gsd-t-help`

---

## Repo Contents

```
get-stuff-done-teams/
├── README.md
├── package.json
├── LICENSE
├── bin/
│   └── gsd-t.js                       # CLI installer
├── commands/                          # 56 slash commands
│   ├── gsd-t-*.md                     # 50 GSD-T workflow commands
│   ├── gsd.md                         # GSD-T smart router
│   ├── branch.md                      # Git branch helper
│   ├── checkin.md                     # Auto-version + commit/push helper
│   └── Claude-md.md                   # Reload CLAUDE.md directives
├── templates/                         # Document templates (10 base + stacks/)
│   ├── CLAUDE-global.md
│   ├── CLAUDE-project.md
│   ├── requirements.md
│   ├── architecture.md
│   ├── workflows.md
│   ├── infrastructure.md
│   ├── progress.md
│   ├── backlog.md
│   ├── backlog-settings.md
│   ├── design-contract.md             # Design-to-code token extraction template
│   └── stacks/                        # Stack Rules Engine templates
│       ├── _security.md               # Universal — always injected
│       ├── react.md
│       ├── typescript.md
│       ├── design-to-code.md          # Pixel-perfect design implementation
│       └── node-api.md
├── scripts/                           # Runtime utility scripts (installed to ~/.claude/scripts/)
│   ├── gsd-t-tools.js                 # State CLI (get/set/validate/list)
│   ├── gsd-t-statusline.js            # Context usage bar
│   ├── gsd-t-event-writer.js          # Structured JSONL event writer
│   ├── gsd-t-dashboard-server.js      # Zero-dep SSE server for dashboard
│   └── gsd-t-dashboard.html           # React Flow + Dagre real-time dashboard
├── examples/
│   ├── settings.json
│   └── .gsd-t/
├── docs/
│   ├── GSD-T-README.md                # Detailed methodology + usage guide
│   └── methodology.md
```

---

## License

MIT
