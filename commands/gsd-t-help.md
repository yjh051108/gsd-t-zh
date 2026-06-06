# GSD-T: Help — Command Reference

You are the GSD-T help system. List all commands with descriptions, and provide detailed help for any selected command.

## Default Behavior (no arguments)

Display the full command reference:

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                           GSD-T Command Reference                            ║
╚══════════════════════════════════════════════════════════════════════════════╝

SMART ROUTER                                                           Manual
───────────────────────────────────────────────────────────────────────────────
  gsd                 Describe what you need → auto-routes to the right command

GETTING STARTED                                                        Manual
───────────────────────────────────────────────────────────────────────────────
  prd                 Generate a GSD-T-optimized Product Requirements Document
  setup               Generate or restructure project CLAUDE.md
  init                Initialize GSD-T structure in current project
  init-scan-setup     Full onboarding: git + init + scan + setup in one
  project             New project → requirements → milestone roadmap
  feature             Major feature → impact analysis → milestones
  scan                Deep codebase analysis → techdebt.md
  gap-analysis        Requirements gap analysis — spec vs. existing code

MILESTONE WORKFLOW                                          [auto] = in wave
───────────────────────────────────────────────────────────────────────────────
  milestone           Define a new milestone
  partition    [auto] Decompose milestone into domains + contracts
  plan         [auto] Create atomic task lists per domain
  impact       [auto] Analyze downstream effects before execution
  execute      [auto] Run tasks (solo or team mode)
  test-sync    [auto] Sync tests with code changes
  qa           [auto] QA agent — test generation, execution, gap reporting
  doc-ripple   [auto] Automated document ripple — update docs after code changes
  integrate    [auto] Wire domains together at boundaries
  verify       [auto] Run quality gates → auto-invokes complete-milestone
  complete-milestone [auto] Archive milestone + git tag (auto-invoked by verify)

AUTOMATION                                                                Auto
───────────────────────────────────────────────────────────────────────────────
  wave                Full cycle: partition → ... → complete (auto-advances)
  unattended          Detached supervisor for overnight/multi-hour idle runs only — slower than in-session
  unattended-watch    Show live supervisor status; reschedules every 270s via ScheduleWakeup
  unattended-stop     Request graceful supervisor stop (sentinel file — safe mid-worker)

UTILITIES                                                              Manual
───────────────────────────────────────────────────────────────────────────────
  status              Cross-domain progress view
  resume              Restore context after break
  quick               Fast task with GSD-T guarantees
  visualize           Launch browser dashboard (SSE server + React Flow)
  debug               Systematic debugging with state
  health              Validate .gsd-t/ structure, optionally repair missing files
  pause               Save exact position for reliable resume later
  promote-debt        Convert techdebt items to milestones
  populate            Auto-populate docs from existing codebase
  design-decompose    Decompose design into element/widget/page contracts
  design-build        Build from design contracts with two-terminal review
  design-review       Independent review agent (Term 2) for design build
  log                 Sync progress Decision Log with recent git activity
  version-update      Update GSD-T package to latest version
  version-update-all  Update GSD-T package + all registered projects
  triage-and-merge    Auto-review, merge, and publish GitHub branches
  global-change       Apply file changes across all registered GSD-T projects

HEADLESS (CI/CD)                                                       CLI
───────────────────────────────────────────────────────────────────────────────
  headless exec       Run any GSD-T command non-interactively via claude -p
  headless query      Read project state without LLM (<100ms)
  headless --debug-loop  Compaction-proof test-fix-retest loop (fresh sessions)
  parallel            Task-level parallel dispatch with mode-aware gating (M44)

BACKLOG                                                                Manual
───────────────────────────────────────────────────────────────────────────────
  backlog-add         Capture item, auto-categorize, append to backlog
  backlog-list        Filtered, ordered view of backlog items
  backlog-move        Reorder items by position (priority)
  backlog-edit        Modify entry fields (title, type, app, category)
  backlog-remove      Drop item with optional reason
  backlog-promote     Refine, classify, and launch GSD-T workflow
  backlog-settings    Manage types, apps, categories, and defaults

───────────────────────────────────────────────────────────────────────────────
Type /gsd-t-help {command} for detailed help on any command.
Example: /gsd-t-help impact
╚══════════════════════════════════════════════════════════════════════════════╝
```

## With Argument (specific command)

When user provides a command name, show detailed help:

```
/gsd-t-help {command}
```

### Command Details Format:

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  gsd-t-{command}                                                             ║
╚══════════════════════════════════════════════════════════════════════════════╝

SUMMARY
  {One-line description}

USAGE
  /gsd-t-{command} [arguments]

WHEN TO USE
  • {Use case 1}
  • {Use case 2}

WHAT IT DOES
  1. {Step 1}
  2. {Step 2}
  3. {Step 3}

AUTO-INVOKED
  {Yes — during {phase} | No — manual only}

FILES READ
  • {file 1}
  • {file 2}

FILES CREATED/UPDATED
  • {file 1}
  • {file 2}

EXAMPLES
  /gsd-t-{command}
  /gsd-t-{command} "with argument"

RELATED COMMANDS
  • {related 1} — {why related}
  • {related 2} — {why related}

───────────────────────────────────────────────────────────────────────────────
```

## Command Summaries

Use these when user asks for help on a specific command:

### gsd (smart router)
- **Summary**: Describe what you need in plain language — auto-routes to the right GSD-T command using semantic evaluation
- **Auto-invoked**: Yes — via UserPromptSubmit hook when prompt does not start with `/`
- **Files**: Reads `CLAUDE.md`, `.gsd-t/progress.md`, command summaries from `gsd-t-help`
- **How it works**: First checks if this is a continuation of an ongoing command (mid-task follow-up, status report, or acknowledgment) — if so, outputs `→ /gsd ──▶ continue /gsd-t-{last-command}` and resumes. For new requests, evaluates against every command's purpose and "Use when" criteria. Commands that match get shortlisted, best fit is selected. Shows runner-up when close.
- **Auto-route**: After `gsd-t install`, any plain text message (no leading `/`) is automatically routed through `/gsd`. Slash commands pass through unchanged. Binary detection — no heuristics.
- **Use when**: You don't want to remember which command to use — just describe what you want
- **Examples**: `/gsd Fix the login bug`, `/gsd Add dark mode`, `/gsd Scan for tech debt`
- **Auto-route examples**: `Fix the login bug` (no slash needed), `Add dark mode`, `Scan for tech debt`

### prd
- **Summary**: Generate a GSD-T-optimized Product Requirements Document
- **Auto-invoked**: No
- **Reads**: `CLAUDE.md`, `.gsd-t/progress.md`, `docs/requirements.md`, `docs/architecture.md`, `.gsd-t/backlog.md`, `.gsd-t/contracts/`
- **Creates/Updates**: `docs/prd.md`, `.gsd-t/progress.md` (Decision Log)
- **Use when**: Starting a new project or feature and you need a structured PRD with REQ-IDs, data model, milestones, and exclusions — all optimized for downstream GSD-T commands
- **Features**: GSD-T context-aware (reads existing docs), adaptive intake (skips questions answered by CLAUDE.md), produces REQ-IDs, field-level data model, file-path-level component list, suggested milestone sequence

### setup
- **Summary**: Generate or restructure the project-level CLAUDE.md
- **Auto-invoked**: No
- **Creates/Updates**: `CLAUDE.md`
- **Use when**: Starting a new project, migrating from GSD, or restructuring an existing CLAUDE.md to complement the global one

### init
- **Summary**: Initialize GSD-T directory structure in current project
- **Auto-invoked**: No
- **Creates**: `.gsd-t/` directory structure, initial progress.md
- **Use when**: Starting GSD-T in a new or existing project

### init-scan-setup
- **Summary**: Full project onboarding — git + init + scan + setup in one command
- **Auto-invoked**: No
- **Creates**: `.gsd-t/` structure, `docs/`, `.gsd-t/scan/`, `.gsd-t/techdebt.md`, optimized `CLAUDE.md`
- **Use when**: Onboarding any project into GSD-T for the first time (new or existing codebase)
- **Combines**: gsd-t-init → gsd-t-scan → gsd-t-setup, plus git remote setup if needed

### project
- **Summary**: Define a complete new project with requirements and milestone roadmap
- **Auto-invoked**: No
- **Creates**: `.gsd-t/roadmap.md`, `.gsd-t/progress.md`, `docs/requirements.md`
- **Use when**: Starting a brand new application from scratch

### feature
- **Summary**: Add a major feature to existing codebase with impact analysis
- **Auto-invoked**: No
- **Creates**: Milestones in roadmap, impact analysis
- **Use when**: Adding significant new functionality to existing project

### scan
- **Summary**: Deep codebase analysis producing techdebt.md — volume-scaled native Workflow (`templates/workflows/gsd-t-scan.workflow.js`): a probe carves the codebase into per-area slices, one deep finder per slice (enumerate-don't-sample), a single verify pass drops false positives, synthesis dedups/re-ranks into the register. Finder count scales with codebase volume (1-3 slices tiny → 15-40 large), not a fixed 5.
- **Auto-invoked**: No
- **Creates**: `.gsd-t/techdebt.md` (prior archived to `.gsd-t/techdebt_YYYY-MM-DD.md`), the `.gsd-t/scan/*.md` dimension files, the full living-doc set (`docs/architecture.md`, `docs/workflows.md`, `docs/infrastructure.md`, `docs/requirements.md`, `README.md` — merged not overwritten, via the M67 document phase), and the HTML scan report
- **Use when**: Understanding an existing codebase or auditing technical debt

### gap-analysis
- **Summary**: Gap analysis — paste a spec, identify what's done, partial, incorrect, or missing
- **Auto-invoked**: No
- **Creates**: `.gsd-t/gap-analysis.md`
- **Reads**: Codebase, `docs/requirements.md`, `docs/architecture.md`, `.gsd-t/contracts/`
- **Use when**: You have a spec or requirements doc and need to know what's already built vs. what's missing
- **Features**: Re-run diffing, severity classification, evidence-backed classifications, optional requirements merge, promotable gap groupings

### milestone
- **Summary**: Define a specific deliverable milestone within a project
- **Auto-invoked**: No
- **Updates**: `.gsd-t/progress.md`, `.gsd-t/roadmap.md`
- **Use when**: Starting work on a defined chunk of functionality

### partition
- **Summary**: Decompose milestone into domains with explicit contracts
- **Auto-invoked**: Yes (in wave, after milestone)
- **Creates**: `.gsd-t/domains/*/`, `.gsd-t/contracts/`
- **Use when**: Breaking down a milestone for parallel work
- **Note (M33)**: Auto-creates `.gsd-t/contracts/design-contract.md` when Figma URLs or design references are detected in requirements — bootstraps the design-to-code stack rule for execute.

### plan
- **Summary**: Create atomic task lists for each domain (each task must fit in one context window)
- **Auto-invoked**: Yes (in wave, after partition)
- **Creates**: `.gsd-t/domains/*/tasks.md`
- **Use when**: Ready to define specific implementation tasks
- **Note (M22)**: Tasks auto-split if estimated scope exceeds 70% context window — guarantees fresh dispatch works
- **Note (M26)**: Pre-mortem step now also reads rules.jsonl for historical failure patterns via getPreMortemRules
- **Note (M38)**: Conversational use cases (formerly `/gsd-t-prompt`, `/gsd-t-brainstorm`, `/gsd-t-discuss`) are now handled by the Smart Router's conversational mode — just describe what you want via `/gsd` or plain text.

### impact
- **Summary**: Analyze downstream effects of planned changes
- **Auto-invoked**: Yes (in wave, between plan and execute)
- **Creates**: `.gsd-t/impact-report.md`
- **Use when**: Before making changes, to understand what might break

### execute
- **Summary**: Run tasks from plan, solo or with agent teams
- **Auto-invoked**: Yes (in wave, after impact)
- **Updates**: Domain tasks, progress.md, source code
- **Use when**: Ready to implement
- **Note (M22)**: Task-level fresh dispatch (one subagent per task, ~10-20% context each). Team mode uses worktree isolation (`isolation: "worktree"`) — zero file conflicts. Adaptive replanning between domain completions.
- **Note (M26)**: Active rule injection — evaluates declarative rules from rules.jsonl before dispatching each domain's tasks. Fires matching rules as warnings in subagent prompts.
- **Note (M29)**: Stack Rules Engine — auto-detects project tech stack from manifest files and injects mandatory best-practice rules into each task subagent prompt. Universal rules (`_security.md`, `_auth.md`) always apply; stack-specific rules layer on top. Violations are task failures (same weight as contract violations).
- **Note (M33)**: Design-to-code — activated when design contract, design tokens, Figma config, or Figma MCP in settings.json is detected. Injects pixel-perfect implementation rules: design token extraction, stack capability evaluation, component decomposition. Step 5.25 spawns a **dedicated Design Verification Agent** (model: opus) after QA passes — opens a browser with both the built frontend AND the original design side-by-side, produces a 30+ row structured comparison table, and enforces an artifact gate (missing table = re-spawn). Coding agents code; the verification agent verifies. Visual deviations block completion. Only fires when `.gsd-t/contracts/design-contract.md` exists.

### test-sync
- **Summary**: Keep tests aligned with code changes
- **Auto-invoked**: Yes (during execute and verify)
- **Creates**: `.gsd-t/test-coverage.md`, test tasks
- **Use when**: After code changes, to maintain test health

### qa
- **Summary**: QA agent — test generation, execution, and gap reporting
- **Auto-invoked**: Yes (spawned as teammate by partition, plan, execute, verify, quick, debug, integrate, complete-milestone)
- **Creates**: Contract test skeletons, acceptance tests, edge case tests, test audit reports
- **Use when**: Automatically spawned — never needs manual invocation. Standalone use for ad-hoc test audits.

### doc-ripple
- **Summary**: Automated document ripple — identifies and updates all downstream docs after code changes
- **Auto-invoked**: Yes (after primary work in execute, integrate, quick, debug, wave)
- **Creates**: `.gsd-t/doc-ripple-manifest.md`
- **Use when**: Automatically spawned — never needs manual invocation. Standalone use for ad-hoc doc sync audits.

### integrate
- **Summary**: Wire domains together at their boundaries
- **Auto-invoked**: Yes (in wave, after execute)
- **Updates**: Contracts, integration code
- **Use when**: Domains are complete and need to work together

### verify
- **Summary**: Run quality gates across all dimensions, including goal-backward behavior verification
- **Auto-invoked**: Yes (in wave, after integrate)
- **Creates**: `.gsd-t/verify-report.md`
- **Use when**: Checking that milestone meets requirements
- **Note (M22)**: Goal-backward verification step added — checks for placeholder implementations (console.log/TODO/hardcoded returns) after structural gates pass

### complete-milestone
- **Summary**: Archive milestone documentation and create git tag
- **Auto-invoked**: Yes — by verify (Step 8, all autonomy levels) and in wave
- **Creates**: `.gsd-t/milestones/{name}/`, git tag
- **Use when**: Auto-runs after verify passes. Can also be invoked standalone to manually close a milestone.
- **Note (M22)**: Goal-backward gate runs as final check before archiving — blocks completion if placeholders remain
- **Note (M26)**: Distillation extended with rule engine evaluation, patch candidate generation, promotion gate checks, graduation, consolidation, and quality budget governance

### wave
- **Summary**: Run complete cycle automatically: partition through verify+complete
- **Auto-invoked**: No (user triggers)
- **Runs**: partition → plan → impact → execute → test-sync → integrate → verify+complete
- **Use when**: Ready to execute a full milestone hands-off

### status
- **Summary**: Show current progress across all domains, including token breakdown by domain/task/phase, global ELO and cross-project rankings
- **Auto-invoked**: No
- **Note (M22)**: Displays context observability data — token usage by domain, avg tokens/task, peak Ctx% per domain
- **Note (M27)**: Displays global ELO and cross-project rankings when global metrics exist
- **Reads**: All `.gsd-t/` files, `~/.claude/metrics/` (global metrics)
- **Use when**: Need to see where things stand

### resume
- **Summary**: Restore context and continue from where you left off
- **Auto-invoked**: No
- **Reads**: `.gsd-t/progress.md`, domain states
- **Use when**: Starting a new session on existing work

### quick
- **Summary**: Fast task execution with GSD-T guarantees (contracts, commits)
- **Auto-invoked**: No
- **Creates**: Quick task record
- **Use when**: Small tasks that don't need full planning

### visualize
- **Summary**: Launch the real-time agent dashboard — starts the SSE server (if not running) and opens the React Flow visualization in a browser
- **Auto-invoked**: No
- **Reads**: `.gsd-t/dashboard.pid`, `.gsd-t/events/*.jsonl` (via server)
- **Creates**: `.gsd-t/dashboard.pid` (when starting server)
- **Use when**: Monitoring live agent activity during execute/wave phases; run `gsd-t-visualize stop` to stop the server

### metrics
- **Summary**: View task telemetry, process ELO, signal distribution, domain health, and cross-project comparison (with `--cross-project` flag)
- **Auto-invoked**: No
- **Reads**: `.gsd-t/metrics/task-metrics.jsonl`, `.gsd-t/metrics/rollup.jsonl`, `~/.claude/metrics/` (when `--cross-project`)
- **Use when**: Reviewing process health, first-pass rates, ELO trends, anomaly flags, or comparing signal distributions across projects

### debug
- **Summary**: Systematic debugging with persistent state; delegates to `gsd-t headless --debug-loop` after 2 failed in-context fix attempts
- **Auto-invoked**: No
- **Creates**: Debug session state, `.gsd-t/debug-state.jsonl` (when delegating to headless loop)
- **Use when**: Tracking down a bug methodically

### headless --debug-loop
- **Summary**: Compaction-proof automated test-fix-retest loop — each iteration is a fresh `claude -p` session; a cumulative ledger (`.gsd-t/debug-state.jsonl`) preserves all hypothesis/fix/learning history; anti-repetition preamble prevents retrying failed approaches
- **Auto-invoked**: Yes — by `execute`, `test-sync`, `verify`, `debug`, and `wave` after 2 failed in-context fix attempts
- **Flags**: `--max-iterations=N` (default 20), `--test-cmd=CMD`, `--fix-scope=PATTERN`, `--json`, `--log`
- **Escalation**: sonnet (iterations 1–5) → opus (6–15) → STOP with diagnostic summary (16–20)
- **Exit codes**: `0` pass · `1` max iterations · `2` compaction error · `3` process error · `4` needs human
- **Creates**: `.gsd-t/debug-state.jsonl`, optional `.gsd-t/headless-{ts}.log`
- **Use when**: Running automated fix loops in CI, or delegated from in-context commands that exhausted fix attempts

### parallel
- **Summary**: Task-level parallel dispatch with mode-aware gating math (M44 D2) — wraps the M40 orchestrator with D4 depgraph + D5 file-disjointness + D6 economics gates and in-session headroom / unattended task-split decisions
- **Auto-invoked**: Conditionally — from `execute`, `wave`, `integrate`, `quick`, and `debug` integration blocks when >1 pending task passes all three gates. Single-task or veto paths fall back to sequential silently.
- **Flags**: `--mode in-session|unattended` (auto-detects from `GSD_T_UNATTENDED=1` when omitted), `--milestone Mxx`, `--domain <name>`, `--dry-run`, `--help/-h`
- **Reads**: `.gsd-t/domains/*/tasks.md` (via D1 task-graph), `.gsd-t/token-log.md` / `.gsd-t/metrics/token-usage.jsonl` (D6 corpus), `.gsd-t/.context-meter-state.json` (in-session ctxPct)
- **Writes**: `.gsd-t/events/YYYY-MM-DD.jsonl` — `gate_veto`, `parallelism_reduced`, `task_split` events (best-effort). Never writes to tasks.md.
- **Use when**: Usually auto-invoked by the integration blocks. Standalone use: preview a plan with `gsd-t parallel --dry-run`, or force a specific milestone/domain filter.
- **Contract**: `.gsd-t/contracts/wave-join-contract.md` v1.1.0 (§Mode-Aware Gating Math)

### promote-debt
- **Summary**: Convert techdebt.md items into milestones
- **Auto-invoked**: No
- **Updates**: `.gsd-t/roadmap.md`, `.gsd-t/techdebt.md`
- **Use when**: Ready to address technical debt items

### populate
- **Summary**: Auto-populate all living docs from existing codebase analysis
- **Auto-invoked**: No
- **Updates**: `docs/requirements.md`, `docs/architecture.md`, `docs/workflows.md`, `docs/infrastructure.md`, `.gsd-t/progress.md`
- **Use when**: You have an existing codebase and want to fill docs with real findings instead of placeholders

### design-decompose
- **Summary**: Decompose a design (Figma/image/prototype) into a hierarchy of element → widget → page contracts
- **Auto-invoked**: No
- **Creates**: `.gsd-t/contracts/design/elements/*.contract.md`, `.gsd-t/contracts/design/widgets/*.contract.md`, `.gsd-t/contracts/design/pages/*.contract.md`, `.gsd-t/contracts/design/INDEX.md`
- **Use when**: Starting a design-to-code project with multiple pages/reusable components, or retrofitting a flat design-contract.md
- **Precedence rule**: element > widget > page. Widgets and pages cannot override element visual spec.

### log
- **Summary**: Sync progress.md Decision Log with recent git activity
- **Auto-invoked**: No
- **Files**: `.gsd-t/progress.md`, git history
- **Use when**: Progress.md Decision Log is behind — catches up by scanning git commits since the last logged entry
- **Features**: Incremental updates, first-time full reconstruction from git history, groups same-day changes

### triage-and-merge
- **Summary**: Auto-review unmerged GitHub branches, merge safe ones, and optionally publish
- **Auto-invoked**: No
- **Files**: Reads `CLAUDE.md`, `.gsd-t/progress.md`, `package.json`; updates `package.json`, `.gsd-t/progress.md`, `CHANGELOG.md`
- **Use when**: Collaborators have pushed branches and you want to batch-review, merge, and publish without manual per-branch ceremony
- **Features**: 3-tier impact scoring (auto-merge / review / skip), publish gate (auto in Level 3, prompted otherwise), conflict detection, sensitive file detection

### global-change
- **Summary**: Apply file changes (copy/insert/update/delete) across all registered GSD-T projects
- **Auto-invoked**: No
- **Files**: Reads `~/.claude/.gsd-t-projects`; modifies target file in each registered project
- **Use when**: You need to make the same change to CLAUDE.md, contracts, templates, or config across multiple projects at once
- **Operations**: `copy` (file from GSD-T package), `insert` (append content), `update` (find/replace with `%%REPLACE_WITH%%` delimiter), `delete` (remove file)
- **Features**: Dry run preview, per-project match validation, parallel execution, skip-on-no-match safety

### backlog-add
- **Summary**: Capture a new backlog item with auto-categorization
- **Auto-invoked**: No
- **Files**: `.gsd-t/backlog.md`, `.gsd-t/backlog-settings.md`
- **Use when**: You have an idea, bug, or improvement to capture for later

### backlog-list
- **Summary**: Display backlog with optional filtering by type, app, or category
- **Auto-invoked**: No
- **Files**: `.gsd-t/backlog.md` (read-only)
- **Use when**: Reviewing the backlog to see what's queued up

### backlog-move
- **Summary**: Reorder a backlog item to change its priority
- **Auto-invoked**: No
- **Files**: `.gsd-t/backlog.md`
- **Use when**: Reprioritizing items in the backlog

### backlog-edit
- **Summary**: Modify fields of an existing backlog entry
- **Auto-invoked**: No
- **Files**: `.gsd-t/backlog.md`, `.gsd-t/backlog-settings.md`
- **Use when**: Updating details of a captured backlog item

### backlog-remove
- **Summary**: Remove a backlog item with optional reason
- **Auto-invoked**: No
- **Files**: `.gsd-t/backlog.md`
- **Use when**: Dropping an item that's no longer relevant

### backlog-promote
- **Summary**: Refine a backlog item and launch the appropriate GSD-T workflow
- **Auto-invoked**: No
- **Files**: `.gsd-t/backlog.md`, `.gsd-t/progress.md`
- **Use when**: Ready to act on a backlog item — promotes to milestone, quick, debug, or feature

### backlog-settings
- **Summary**: Manage allowed types, apps, categories, and default settings
- **Auto-invoked**: No
- **Files**: `.gsd-t/backlog-settings.md`
- **Use when**: Customizing the classification dimensions for your project

### workflow-path (M69)
- **Summary**: Prints the ABSOLUTE path to a GSD-T workflow script (`gsd-t-<name>.workflow.js`) resolved from the CLI's own install root. Command files shell out to this instead of hard-coding a relative `templates/workflows/...` scriptPath — which only resolves from the GSD-T source repo, so from any consumer project `Workflow({scriptPath})` would silently fail and fall back to a hand-driven scan (the HiloAviation incident).
- **Auto-invoked**: Yes — by every workflow-backed command (`gsd-t-scan`, `-execute`, `-verify`, `-wave`, `-integrate`, `-debug`, and the `-phase` runner) at Workflow-invocation time.
- **CLI**: `gsd-t workflow-path <name>` (name with or without the `gsd-t-` prefix / `.workflow.js` suffix). Exit 0 + absolute path on stdout; exit 4 + available list on unknown name; exit 64 on missing arg.

### preflight (M55)
- **Summary**: Deterministic state-precondition check (`bin/cli-preflight.cjs`); 6 built-in checks (branch-guard, contracts-stable, deps-installed, manifest-fresh, ports-free, working-tree-state). Exit 0/4. Pluggable, zero-dep, captureSpawn-exempt.
- **Auto-invoked**: Yes — by `gsd-t-execute` Step 1 and `gsd-t verify-gate` Track 1
- **Files**: `bin/cli-preflight.cjs`, `bin/cli-preflight-checks/`
- **Use when**: Before any worker spawn or verify run — catches drift (wrong branch, port collision, DRAFT contracts) early.
- **CLI**: `gsd-t preflight [--project DIR] [--json | --text] [--skip id1,id2]`

### brief (M55)
- **Summary**: Generate a ≤10 KB / ≤2,500-token context brief for a worker spawn (`bin/gsd-t-context-brief.cjs`); 6 kinds (`execute`, `verify`, `qa`, `red-team`, `design-verify`, `scan`). Replaces 30–60k context re-read with structured JSON snapshot.
- **Auto-invoked**: Yes — by `gsd-t-execute` Step 1 (one brief per domain spawn)
- **Files**: `bin/gsd-t-context-brief.cjs`, `bin/gsd-t-context-brief-kinds/`, `.gsd-t/briefs/` (gitignored)
- **Use when**: Replacing repo re-reads with a structured snapshot for parallel workers.
- **CLI**: `gsd-t brief --kind X --domain Y --spawn-id Z [--out PATH] [--strict]`

### verify-gate (M55)
- **Summary**: Two-track verify-gate (`bin/gsd-t-verify-gate.cjs`); Track 1 runs preflight (hard-fail on severity:error), Track 2 fans out tsc/lint/tests/dead-code/secrets/complexity via `bin/parallel-cli.cjs::runParallel`. Returns ≤500-token JSON summary an LLM judges. Defensive on missing `.gsd-t/ratelimit-map.json`.
- **Auto-invoked**: Yes — by `gsd-t-verify` Step 2
- **Files**: `bin/gsd-t-verify-gate.cjs`, `bin/gsd-t-verify-gate-judge.cjs`
- **Use when**: Final pre-merge gate. Both tracks always run; both report. `ok` is purely deterministic — LLM verdict is advisory.
- **CLI**: `gsd-t verify-gate [--skip-track1] [--skip-track2] [--max-concurrency N] [--fail-fast] [--json]`. Exit 0/4/2/3.

### build-coverage (M57)
- **Summary**: Detects new top-level paths in a milestone commit range not referenced by a real CI build input. Coverage is decided by STRUCTURALLY parsing CI files (Dockerfile COPY/ADD source args incl. relative `--from=`; cloudbuild `args`-positional; workflow `run`-positional via a block-scalar-aware YAML walker) — never substring-matching. `node_modules` never counts. No documented false-negative residual.
- **Auto-invoked**: Yes — by `gsd-t-verify` Step 2.6 (FAIL-blocking, never warning-only)
- **Files**: `bin/gsd-t-build-coverage.cjs`
- **Use when**: Final pre-merge gate. Catches the TimeTracking v1.10.12 class (new `hooks/` dir committed, absent from Dockerfile COPY, shipped broken while verify passed).
- **CLI**: `gsd-t build-coverage [--json] [--base REF] [--head REF] [--project-dir PATH]`. Exit 0/4/2.

### ci-parity (M57)
- **Summary**: Reproduces the project's actual CI build locally instead of assuming warm-cache local tsc/test parity. Auto-detects CI config (cloudbuild → workflows → Dockerfile RUN → package.json scripts), clears build caches (containment-safe — refuses any config-derived delete resolving outside OR equal-to projectRoot), and auto-runs the real `docker build` when a Dockerfile is present (presence is the trigger, no opt-in flag).
- **Auto-invoked**: Yes — by `gsd-t-verify` Step 2.6 (FAIL-blocking, never warning-only)
- **Files**: `bin/gsd-t-ci-parity.cjs`
- **Use when**: Final pre-merge gate. Catches the TimeTracking v1.10.12 class (noImplicitAny regressions passed a warm-cache local tsc but failed CI's cold build).
- **CLI**: `gsd-t ci-parity [--project-dir PATH] [--timeout-ms MS] [--json]`. Exit 0/4/2.

### test-data (M58)
- **Summary**: Append-only test-data ledger + purge engine. Tests register inserts via the `withTestData()` Playwright fixture; `gsd-t-verify` Step 4.5 purges them by adapter before VERDICT. Three built-in adapters: `localStorage-key-prefix`, `file-json-array`, `sqlite-table-where`. Each adapter refuses to delete records whose id does not start with the ledger row's `taggedPrefix` (defense in depth).
- **Auto-invoked**: Yes — by `gsd-t-verify` Step 4.5 (FAIL-blocking, never warning-only)
- **Files**: `bin/gsd-t-test-data-ledger.cjs`, `bin/gsd-t-test-data-adapters/*.cjs`, `templates/test-helpers/test-data-fixture.ts`
- **Use when**: Test data hygiene. Catches the GSD-T-Board class (2442 orphaned `E2E_TEST_*` / `E2E_DRAG_*` ideas left in the production data store after a passing Verify run).
- **CLI**: `gsd-t test-data --list [--run <id>] [--json]` / `gsd-t test-data --purge --run <id> [--dry-run] [--json] [--project <dir>]`. Exit 0 on success, 4 on adapter errors, 64 on usage error.

### competition-judge (M82)
- **Summary**: The selection oracle for Competition Mode (generate-and-judge — the *generative* dual of the orthogonal validation triad). Two modes: `--kind partition` scores candidate domain decompositions via the file-disjointness oracle (parallelGroups / waveDepth / validity — a calculator, not an LLM critic, so it's immune to judge bias); `--kind generic` is a deterministic rubric selector that finalizes a winner from rubric scores an upstream blind/different-model judge supplied.
- **Auto-invoked**: Yes — by `gsd-t-phase.workflow.js` when an eligible phase (partition / milestone / design-decompose) is run with `competition: N` (N 2–5). Opt-in per phase via `/gsd-t-partition --competition N` etc. Default off.
- **Files**: `bin/gsd-t-competition-judge.cjs` (reuses `bin/gsd-t-file-disjointness.cjs`).
- **Use when**: Upstream, pre-contract, wide-solution-space decisions where the cost of a single draft is high (partition, milestone decomposition, ambiguous design decomposition). Never on post-contract phases (execute/verify/etc.) — those are owned by the adversarial triad.
- **CLI**: `gsd-t competition-judge [--in <spec.json>] [--project-dir <dir>]` (spec via stdin or `--in`). Exit 0 winner · 4 no valid candidate · 64 bad input.
- **Contract**: `.gsd-t/contracts/competition-mode-contract.md` v1.0.0 STABLE.

### traceability-gate (M83)
- **Summary**: Plan-phase acceptance-traceability gate — the deterministic half of Left-Shifted Plan Hardening. Parses `.gsd-t/domains/*/tasks.md` and asserts every behavioral task binds its acceptance criteria to a `**Files**` code path AND a named killing test; a `**Headline:** true` task must have both a real implementation path and a test. Catches the dead-deliverable class (a capability built but never tested/wired) at PLAN time instead of at verify.
- **Auto-invoked**: Yes — by `gsd-t-phase.workflow.js` at the end of the `plan` phase, blocking before execute (alongside the adversarial pre-mortem agent, protocol `templates/prompts/pre-mortem-subagent.md`).
- **Files**: `bin/gsd-t-traceability-gate.cjs`.
- **Use when**: Every plan phase (automatic). Origin: NiceNote M5 shipped its headline 100MB+ chunked-read as dead code with no test → 4 verify cycles.
- **CLI**: `gsd-t traceability-gate [--milestone <Mxx>] [--project-dir <dir>] [--tasks <file>]`. Exit 0 all traceable · 4 ≥1 untraceable AC (blocks execute) · 64 no tasks files.
- **Contract**: `.gsd-t/contracts/plan-hardening-contract.md` v1.0.0 STABLE.

## Unknown Command

If user asks for help on unrecognized command:

```
❓ Unknown command: {command}

Did you mean one of these?
  • {closest match 1}
  • {closest match 2}

Run /gsd-t-help for full command list.
```

$ARGUMENTS

## Auto-Clear

All work is committed to project files. Execute `/clear` to free the context window for the next command.
