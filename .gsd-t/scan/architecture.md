# GSD-T Architecture

## Stack

- **Language**: JavaScript (Node.js >= 16), zero external runtime deps for all core modules
- **Package**: `@tekyzinc/gsd-t` (npm)
- **Execution environments**:
  - Node.js CJS (`require`) for all `bin/` and `scripts/` modules
  - Anthropic native Workflow sandbox (ESM `export const meta`, no `require`/`fs`/`process`) for `templates/workflows/*.workflow.js`
- **Distribution**: npm publish; installed to `~/.claude/` (commands, scripts, bin, templates)
- **Testing**: Node built-in test runner (`node --test`); 4 E2E spec files (Playwright)
- **No build step** - source is distribution

---

## Structure

| Directory | Purpose | ~Files | ~LOC |
|-----------|---------|--------|------|
| `bin/` | CLI entry point + all library modules | 52 modules | ~18,281 |
| `scripts/` | Hooks, dashboard, context-meter, event-writer | ~24 files | ~7,000 |
| `templates/workflows/` | Native Workflow scripts (Anthropic sandbox) | 9 files | ~1,901 |
| `templates/stacks/` | Stack Rules Engine injection templates | 30 files | ~2,400 |
| `templates/prompts/` | Validation subagent protocol bodies | 3 files | ~600 |
| `templates/` (root) | Living-doc templates, CLAUDE-global/project | ~20 files | ~1,500 |
| `commands/` | Slash command bodies (thin Workflow invokers) | 51 files | ~12,000 |
| `e2e/` | Playwright E2E specs and fixtures | 4 spec files | ~2,000 |
| `test/` | Unit/integration tests | 74 test files | ~14,258 |
| `.gsd-t/` | Project state (progress, contracts, domains, metrics) | ~70+ files | ~128,640 |
| `docs/` | Methodology, requirements, architecture, workflows | 5 files | ~2,000 |

| Grand Total | 5647 files | 173922 |
|-------------|-----------|--------|

---

## Patterns

### Zero-Dep Library Pattern
Every module in `bin/` declares "Zero external runtime deps. Only Node built-ins." This is enforced by convention and verified during `gsd-t doctor`. Sibling modules are loaded via `require()` from relative paths, never from `node_modules/`. This makes the installer `npx`-safe and eliminates version conflicts in consumer projects.

### Pluggable Check Registry Pattern
Both `bin/cli-preflight.cjs` (preflight checks) and `bin/gsd-t-context-brief.cjs` (brief kinds) use a directory-scan registry: they `fs.readdirSync` their respective subdirectories (`bin/cli-preflight-checks/`, `bin/gsd-t-context-brief-kinds/`), dynamically `require()` each `.cjs` file, and compose results. Adding a new check or brief kind requires only a file drop with no registry update.

### Tool-Resolution Pattern (`_lib.js _resolveTool`)
Workflow helper functions prefer project-local `bin/<tool>.cjs` when present, falling back to the global `gsd-t` PATH binary. This allows a consumer project to pin a specific version of a GSD-T tool by placing it in their own `bin/` directory.

### Schema-Validated Agent Output Pattern
Every `agent()` call in Workflow scripts declares a JSON Schema in the `schema:` option. The Workflow runtime validates the agent's structured output before continuing. This prevents hallucinated or malformed agent responses from silently corrupting downstream stages.

### Preflight-First Pattern
Every Workflow script begins by running `lib.runPreflight({projectDir})`, which shells out to `bin/cli-preflight.cjs`. Hard-fails on `severity:"error"` checks (wrong branch, occupied required port). Non-error checks record but do not block. The same envelope feeds verify-gate Track 1.

### Fail-Open / Fail-Closed Brief Kinds
Kinds `qa`, `red-team`, `design-verify` are declared `FAIL_CLOSED_KINDS` in `bin/gsd-t-context-brief.cjs` - a collection error on these kinds throws and blocks the spawn. All other kinds fail open (an error produces a structured `{ _missing: true, error }` envelope that the agent can still consume).

### M61 Workflow Sandbox Rule
The Anthropic native Workflow sandbox exposes only `agent()`, `parallel()`, `pipeline()`, `log()`, `phase()`, `budget`, `args`. It does NOT provide `require`, `module`, `fs`, `path`, `child_process`, or `process`. All file I/O must live inside `agent()` subagents (which have Bash/Read/Write/Grep tools). The orchestrator body does zero I/O - it only sequences phases and threads data as strings.

---

## Components / Domains

### 1. CLI Installer and Updater
**Files**: `bin/gsd-t.js` (~4,500+ LOC)

Monolithic CLI entry point. Subcommands: install, update, update-all, init, register, status, uninstall, doctor, graph, headless, design-build. Copies commands/scripts/bin/templates to `~/.claude/`. Manages `~/.claude/.gsd-t-projects` registry and `~/.claude/settings.json` hooks. Contains the debug-loop runner (`doHeadlessExec`, `spawnClaudeSession`), project-query API (`queryBacklog`), and update-check logic.

Key issues: five sequential read-modify-write cycles on settings.json (race condition under concurrent Claude Code writes); dead context-meter hooks still installed on every fresh install; debug-loop missing `--dangerously-skip-permissions` in `spawnClaudeSession` causing every iteration to exit on first tool use; `queryBacklog` parses table-row format but actual backlog.md uses heading format (always returns empty); `scan` subcommand is a do-nothing stub (exits 0 with no output).

### 2. Workflow Orchestration Engine
**Files**: `templates/workflows/` (9 scripts), `templates/workflows/_lib.js`

Nine Anthropic native Workflow scripts sequence the GSD-T phase lifecycle. The shared helper `_lib.js` (CJS, uses `require`/`fs`/`spawnSync`) bridges Workflow scripts to the `bin/` brains via subprocess invocations of `bin/cli-preflight.cjs`, `bin/gsd-t-context-brief.cjs`, `bin/gsd-t-parallel.cjs`, `bin/gsd-t-verify-gate.cjs`.

Only `gsd-t-scan.workflow.js` is correctly migrated to the sandbox: its orchestrator body does zero I/O, all reads/writes happen inside `agent()` subagents. The other six (`execute`, `verify`, `wave`, `integrate`, `debug`, `quick`, `phase`) call `require('./_lib.js')` at the top level, which crashes the sandbox with `ReferenceError: require is not defined` before any `agent()` runs (M71 finding). The M71 lint test (`test/m71-workflow-runtime-native-lint.test.js`) guards only `gsd-t-scan.workflow.js`; the other six are unguarded. Four Workflow scripts also hardcode `m61` as a commit prefix regardless of the actual milestone being executed.

### 3. Parallel Execution and Task Graph
**Files**: `bin/gsd-t-parallel.cjs`, `bin/parallel-cli.cjs`, `bin/parallel-cli-tee.cjs`, `bin/gsd-t-task-graph.cjs`, `bin/gsd-t-file-disjointness.cjs`, `bin/gsd-t-depgraph-validate.cjs`

Two-layer parallelism: `gsd-t-parallel.cjs` is the planner (builds task DAG, runs dep validation and file-disjointness, computes gate decisions, emits decision to `runDispatch`); `parallel-cli.cjs` is the executor (N-worker subprocess pool with failFast, per-worker timeout, SIGTERM/SIGKILL escalation, tee logging). The planner is consumed by `_lib.proveFileDisjointness()` and feeds verify-gate Track 2 workers.

Supporting modules: `gsd-t-task-graph.cjs` (DAG parser with cycle detection, reads `.gsd-t/domains/*/tasks.md`), `gsd-t-file-disjointness.cjs` (pairwise write-target overlap prover, uses git history as heuristic), `gsd-t-depgraph-validate.cjs` (dependency veto gate).

Key issues: `parseArgv` last-wins bug on `--domain` flag means multi-domain disjointness checks only validate the last domain named (safety invariant bypassed for all multi-domain parallel runs); `runDispatch` requires retired `headless-auto-spawn.cjs` - MODULE_NOT_FOUND silently demotes every fan-out decision to sequential; SIGKILL escalation timer never canceled when child exits cleanly after SIGTERM; `estimateTaskFootprint` M61 stub missing `estimatedCwPct` field (unattended CW gate permanently broken); double event emission for dep-vetoed and disjointness-fallback tasks; `parallel-cli.cjs` has zero unit tests in the main suite.

### 4. Slash Command Library
**Files**: `commands/` (51 `.md` files)

Slash command bodies consumed by Claude Code. Post-M61, command files are thin Workflow invokers: `Workflow({scriptPath, args})`. Pre-M61 legacy commands still contain inline step prose. The `gsd-t-help.md` command describes wave as running "partition - plan - impact - execute - test-sync - integrate - verify+complete" when wave only runs execute+verify. `gsd-t-partition.md` references the retired `/gsd-t-discuss` command.

Six bin files referenced by commands do not exist (silently no-op via `|| true` / `2>/dev/null`): `gsd-t-token-capture.cjs`, `runway-estimator.cjs`, `token-budget.cjs`, `check-headless-sessions.js`, `supervisor-pid-fingerprint.cjs`, `handoff-lock.cjs`. `gsd-t-unattended.md` and `gsd-t-unattended-watch.md` reference five deleted M61 modules - both commands are completely non-functional. `global-change.md` uses wrong package name `@tekyz/gsd-t` instead of `@tekyzinc/gsd-t`.

### 5. Verify Gate and CI Parity
**Files**: `bin/gsd-t-verify-gate.cjs`, `bin/gsd-t-verify-gate-judge.cjs`, `bin/gsd-t-build-coverage.cjs`, `bin/gsd-t-ci-parity.cjs`, `bin/cli-preflight.cjs`, `bin/cli-preflight-checks/` (6 checks), `templates/workflows/gsd-t-verify.workflow.js`

Two-track deterministic gate. Track 1: `bin/cli-preflight.cjs` envelope (branch-guard, working-tree-state, ports-free, contracts-stable, deps-installed, manifest-fresh). Track 2: `bin/parallel-cli.cjs` fans out `tsc`, `biome`/`ruff`, `npm test`, `knip`, `gitleaks`, `scc`/`lizard` as concurrent subprocesses. `gsd-t-verify-gate-judge.cjs` builds a <=500-token summary. Run results stored under `.gsd-t/verify-gate/{runId}/`.

M57 CI-Parity gate and M58 Test-Data Purge run as FAIL-blocking pre-triad stages in `gsd-t-verify.workflow.js`. The orthogonal triad (code-review/Red Team/QA) runs as `parallel()` `agent()` stages after.

Key issues: `_shapeTrack2` vacuous-true bug when `results` is empty (`[].every()` returns true) - crashing parallel-cli reports as PASS; synthesis verdict has no programmatic check enforcing Red Team FAIL -> VERIFY-FAILED; `playwright.config.mjs` not detected (ESM configs miss E2E in Track 2); `contracts-stable.cjs` regex `^\s*Status\s*:` never matches `## Status: ACTIVE` ATX heading format; `execSync` calls in branch-guard/working-tree-state/ports-free have no timeout; `_buildSummary` mutates caller's `track2.notes` array via `.push()`.

### 6. Codebase Scan Engine
**Files**: `templates/workflows/gsd-t-scan.workflow.js`, `bin/scan-data-collector.js`, `bin/scan-schema.js`, `bin/scan-schema-parsers.js`, `bin/scan-report.js`, `bin/scan-report-sections.js`, `bin/scan-renderer.js`, `bin/scan-export.js`, `bin/scan-diagrams.js`, `bin/scan-diagrams-generators.js`

Multi-stage scan Workflow: preflight - volume-probe - pipeline(deep-finder per slice) - synthesis(archive + write register + git) - document(parallel per-doc agents: living docs + 5 dimension files) - render(HTML). The Workflow orchestrator does zero file I/O; all reads/writes happen inside `agent()` subagents. Volume-based fan-out (not a fixed domain count).

Key issues: `parseTechDebtItems` and `parseSeverityMap` parse legacy prose format - always return empty for deep-scan output (HTML Tech Debt section always blank); `tryD2` writes hardcoded stub `'app -> db: query'` instead of actual diagram content; `parseDrizzle` column regex runs on entire file rather than each table block (all columns attributed to every table); `tryKroki` is async but `renderDiagram` is synchronous (Kroki fallback permanently dead); `merged.includes(f)` identity check in deduplication is dead code.

### 7. Code Graph Engine
**Files**: `bin/graph-cgc.js`, `bin/graph-parsers.js`, `bin/graph-indexer.js`, `bin/graph-store.js`, `bin/graph-query.js`, `bin/graph-overlay.js`, `bin/advisor-integration.js`, `bin/component-registry.js`

Static code analysis graph with two providers: native (file-based JSON store at `.gsd-t/graph/`) and CGC (Neo4j via `cgc mcp start` subprocess). `bin/graph-indexer.js` walks source files; `bin/graph-store.js` persists 8 JSON files (index, calls, imports, contracts, requirements, tests, surfaces, meta); `bin/graph-query.js` answers entity/caller/importer queries via native index or grep fallback; `bin/graph-overlay.js` enriches with contract/requirement links; `bin/graph-cgc.js` bridges to Neo4j.

Key issues: non-atomic multi-file writes leave index silently corrupted on mid-write process death (meta.json is the last write but not a commit marker with atomic rename); `isStale()` misses deleted files (stale index never invalidated after file deletion); `sendToolCallSync` blocks for full 10-second timeout per CGC query (MCP server never exits - known architectural mismatch); Cypher injection via `params.query` passthrough in `cgcProvider` 'cypher' case; `SAFE_ENTITY_RE` allows `../` path traversal in grep fallback; Neo4j password `gsdt-graph-2026` hardcoded in three places.

### 8. Design-to-Code Pipeline
**Files**: `bin/design-orchestrator.js`, `bin/orchestrator.js`, `scripts/gsd-t-design-review-server.js`, `scripts/gsd-t-design-review-inject.js`, `scripts/gsd-t-design-review.html`, `templates/design-contract.md`, `templates/element-contract.md`, `templates/widget-contract.md`, `templates/page-contract.md`

Three-tier sequential build: elements - widgets - pages. `bin/design-orchestrator.js` extends `bin/orchestrator.js` (deterministic Orchestrator base class with state-machine gate/resume logic). Reads element/widget/page contracts from `.gsd-t/contracts/design/`. `scripts/gsd-t-design-review-server.js` is a local HTTP server that proxies the dev server, injects a review overlay script, manages a work queue (JSON files), and writes feedback/contract files.

Key issues: builder prompts hardcode "Vue 3 + TypeScript" regardless of detected project framework (React/Svelte/Angular projects receive Vue SFC syntax); `reviewQueue` used-before-declaration in `/review/api/exclude` handler (ReferenceError crashes the handler); proxy buffers gzip-compressed HTML then attempts string parsing without decompressing (injection always fails when Vite sends gzip/brotli); `item.id` used unsanitized in `path.join()` calls (path traversal); `orchestrator.js` element auto-correction silently mutates design contract files without user confirmation (Destructive Action Guard violation).

### 9. Real-Time Agent Dashboard
**Files**: `scripts/gsd-t-dashboard.html`, `scripts/gsd-t-stream-feed-server.js`, `scripts/gsd-t-stream-feed.html`, `scripts/gsd-t-dashboard-autostart.cjs`, `scripts/gsd-t-event-writer.js`, `scripts/gsd-t-statusline.js`, `scripts/gsd-t-watch-state.js`

WebSocket-based real-time dashboard. `gsd-t-stream-feed-server.js` ingests NDJSON frames from workers via HTTP POST `/ingest` (persist-before-broadcast), persists to daily JSONL under `.gsd-t/stream-feed/`, broadcasts to WebSocket clients at `/feed` with `?from=N` replay support, enforces 127.0.0.1-only, kicks backpressured clients after 1000-frame buffer. `gsd-t-watch-state.js` manages per-agent state files under `.gsd-t/.watch-state/`. `gsd-t-dashboard-autostart.cjs` starts the server on demand.

Key issues: `gsd-t-dashboard-server.js` missing entirely (MODULE_NOT_FOUND thrown in `ensureDashboardRunning`); unbounded POST `/ingest` body accumulation (no MAX_BODY_BYTES limit); WebSocket close frame encodes payload > 125 bytes without extended-length headers (RFC 6455 violation); `agentId` path traversal in `gsd-t-watch-state.js` (`path.join(stateDir, agentId + '.json')` with no containment check).

### 10. Context and Token Monitoring
**Files**: `bin/gsd-t-context-brief.cjs`, `bin/gsd-t-context-brief-kinds/` (11 kinds: design-verify, discuss, execute, impact, milestone, partition, plan, qa, red-team, scan, verify), `scripts/gsd-t-token-aggregator.js`, `scripts/gsd-t-heartbeat.js`, `scripts/gsd-t-compact-detector.js`, `scripts/gsd-t-compaction-scanner.js`, `scripts/context-meter/`, `templates/context-meter-config.json`

`gsd-t-context-brief.cjs` generates <=10 KB JSON brief snapshots synchronously. Each kind collector in `bin/gsd-t-context-brief-kinds/` reads domain-specific state and returns a structured section. `scripts/gsd-t-token-aggregator.js` reads JSONL token logs in tail mode, aggregates by task group, writes `token-usage.jsonl`. `scripts/gsd-t-calibration-hook.js` feeds context percentage to calibration state.

Key issues: `updateTokenLog` column-index mismatch (reads column 11 for task cell but actual schema has 11 columns with task at index 10 - always no-ops, never updates token-log.md); `writeTokenUsageJsonl` unbounded append growth in tail mode (file grows at triangular rate O(n^2) across group changes); `verify.cjs` kind uses `\Z` in JS regex as a regex escape (treated as literal 'Z', not end-of-string anchor - EOF section extraction fails for files where success-criteria is the last section); `context-meter-config.json` template ships `"modelWindowSize": 200000` (wrong for 1M-window Claude 4.x models, triggers threshold at 15% actual usage).

### 11. Unattended Supervisor and Headless Mode
**Files**: `commands/gsd-t-unattended.md`, `commands/gsd-t-unattended-watch.md`, `commands/gsd-t-unattended-stop.md`, `scripts/gsd-t-auto-route.js`, `scripts/gsd-t-calibration-hook.js`, `scripts/gsd-t-tools.js`, `scripts/hooks/gsd-t-in-session-probe.js`, `scripts/hooks/pre-commit-capture-lint`, `scripts/hooks/pre-commit-journey-coverage`, `scripts/hooks/pre-commit-playwright-gate`

`scripts/gsd-t-auto-route.js` is a UserPromptSubmit hook that injects `[GSD-T AUTO-ROUTE]` + `[GSD-T NOW]` signals when a GSD-T project is detected. Pre-commit hooks: `pre-commit-playwright-gate` (blocks commits when E2E tests have not passed since most recent UI change), `pre-commit-journey-coverage` (journey coverage enforcement).

Key issues: `gsd-t-unattended.md` and `gsd-t-unattended-watch.md` reference five deleted M61 modules (`gsd-t-unattended-platform.cjs`, `gsd-t-token-capture.cjs`, `supervisor-pid-fingerprint.cjs`, `event-stream.cjs`, `unattended-watch-format.cjs`) - both commands crash at Step 2 with MODULE_NOT_FOUND; `pre-commit-capture-lint` hook invokes retired `gsd-t capture-lint` CLI subcommand (exits 1 unconditionally, blocks all commits on any project that installed it).

### 12. Testing Infrastructure
**Files**: `bin/playwright-bootstrap.cjs`, `bin/ui-detection.cjs`, `bin/journey-coverage.cjs`, `bin/journey-coverage-cli.cjs`, `bin/gsd-t-test-data-ledger.cjs`, `bin/gsd-t-test-data-adapters/`, `templates/test-helpers/test-data-fixture.ts`, `e2e/`, `test/`

`bin/playwright-bootstrap.cjs` provides `hasPlaywright`, `detectPackageManager`, `installPlaywright`, `verifyPlaywrightHealth`. `bin/ui-detection.cjs` detects UI presence and framework. `bin/gsd-t-test-data-ledger.cjs` manages a per-run test-data ledger with three built-in adapters (`localStorage-key-prefix`, `file-json-array`, `sqlite-table-where`). `bin/journey-coverage.cjs` detects EventListener/MutationObserver/fetch instrumentation coverage.

Key issues: `MutationObserver` counter consumed before eslint-exempt check (counter slot consumed for exempt observers, shifting counter values for subsequent non-exempt observers - manifests as false coverage gaps when exempt observers are added/removed); `startReplayServer()` in `e2e/fixtures/journeys/replay-helpers.ts` requires deleted M61 files (`gsd-t-dashboard-server.js`, `gsd-t-transcript.html`); `parallel-cli.cjs` (the worker pool executor) has zero unit tests in the main suite.

### 13. Stack Rules Engine
**Files**: `bin/rule-engine.js`, `bin/model-selector.js`, `templates/stacks/` (30 files)

`bin/rule-engine.js` loads JSONL rules from `.gsd-t/metrics/rules.jsonl`, evaluates triggers against task-metrics data, manages activation tracking and patch lifecycle. `bin/model-selector.js` provides declarative per-phase model tier assignment (haiku/sonnet/opus) via a rules table - first matching rule wins, falls back to `DEFAULT_TIER` (sonnet). `templates/stacks/` holds 30 injection templates: 3 universal (`_security.md`, `_auth.md`, `_markdown.md`) plus 27 stack-specific.

Key issues: `model-selector.js` assigns `plan` to sonnet instead of opus (contract mandates opus); `impact`, `complete-milestone`, `scan`, `backlog-promote` fall through to default sonnet (contract mandates opus for first two); stack rules are never injected into M61 Workflow `agent()` spawns - the injection path in `bin/gsd-t-task-brief.js` is only called from test files, not production Workflows (all post-M61 execute/quick/debug/wave/integrate runs receive zero stack rules).

### 14. Backlog Management
**Files**: `commands/gsd-t-backlog-add.md`, `commands/gsd-t-backlog-edit.md`, `commands/gsd-t-backlog-list.md`, `commands/gsd-t-backlog-move.md`, `commands/gsd-t-backlog-promote.md`, `commands/gsd-t-backlog-remove.md`, `commands/gsd-t-backlog-settings.md`, `templates/backlog.md`, `templates/backlog-settings.md`

Seven command files managing `.gsd-t/backlog.md` (heading format: `## N. title`) and `.gsd-t/backlog-settings.md`. Covers add/edit/move/remove/promote/list/settings operations.

Key issues: CLI `queryBacklog` in `bin/gsd-t.js` parses pipe-delimited table rows but actual backlog.md uses heading format (always returns empty, silently broken for all consumers); `remove-app` does not check if removed app is the current Default App (leaves settings in invalid state); Decision Log format inconsistent across all six commands (one uses table rows, one uses em-dash separators, none use contract-mandated `- YYYY-MM-DD HH:MM:` format); `backlog-remove` Step 5 writes progress.md unconditionally (will create malformed file if it does not exist).

### 15. Project Init and Lifecycle
**Files**: `commands/gsd-t-init.md`, `commands/gsd-t-init-scan-setup.md`, `commands/gsd-t-setup.md`, `commands/gsd-t-complete-milestone.md`, `commands/gsd-t-version-update.md`, `commands/gsd-t-version-update-all.md`, `bin/archive-progress.cjs`, `bin/global-sync-manager.js`, `bin/patch-lifecycle.js`, `templates/progress.md`

`gsd-t-init.md` scaffolds `.gsd-t/`, `docs/`, `CLAUDE.md`, `README.md`. `bin/archive-progress.cjs` archives completed milestones to `.gsd-t/milestones/`. `bin/patch-lifecycle.js` implements a five-stage patch lifecycle (candidate - applied - measured - promoted - graduated) for methodology auto-improvement via JSONL rules. `bin/global-sync-manager.js` aggregates metrics across all registered projects to `~/.claude/metrics/`.

Key issues: `applyPatch` and `recordMeasurement` are never called anywhere in commands/bin/scripts (entire promotion loop is dead code - patches are created as candidates but never applied); graduation permanently unreachable because `recordMeasurement` does not process promoted patches and `measured_milestones` stops growing at promotion; improvement direction inverted for "lower is better" metrics (`fix_cycles` reduction produces negative `improvement_pct`, fails promotion gate); `gsd-t-init.md` Step 11 still references retired `headless-auto-spawn.cjs`.

### 16. Metrics, Telemetry and Events
**Files**: `bin/metrics-collector.js`, `bin/debug-ledger.js`, `bin/gsd-t-completion-check.cjs`, `bin/gsd-t-time-format.cjs`, `scripts/gsd-t-date-guard.js`, `scripts/gsd-t-update-check.js`, `scripts/gsd-t-fetch-version.js`, `commands/gsd-t-metrics.md`, `commands/gsd-t-log.md`, `commands/gsd-t-health.md`

`bin/metrics-collector.js` writes per-task metrics to `.gsd-t/metrics/task-metrics.jsonl`. `scripts/gsd-t-event-writer.js` appends structured events to `.gsd-t/events/YYYY-MM-DD.jsonl`. `scripts/gsd-t-date-guard.js` is a PreToolUse hook that blocks Write/Edit calls with timestamps drifting > 5 minutes from live clock (validates decision-log entries, filenames, banners, labeled stamps, progress.md table cells). `scripts/gsd-t-update-check.js` checks for new npm versions at session start.

Key issues: `fetchLatestVersion` always returns null due to syntax error in inline `node -e` script (`r.on('data',(c)=>d+=c;` missing closing `)`) - auto-update from SessionStart permanently broken; date-guard produces false positives when writing progress.md containing historical decision-log entries (blocks `/gsd-t-log` full-reconstruction and `/gsd-t-populate`); `rollup.jsonl` is never written anywhere (ELO display in `/gsd-t-metrics` is dead code); `gsd-t-health.md` valid status list missing INITIALIZED, ROADMAPPED, ACTIVE, EXECUTING.

### 17. Living Documents, Contracts and State
**Files**: `.gsd-t/contracts/` (40+ contracts), `.gsd-t/progress.md`, `.gsd-t/backlog.md`, `.gsd-t/backlog-settings.md`, `.gsd-t/domains/` (~70+ domain directories), `docs/architecture.md`, `docs/requirements.md`, `docs/workflows.md`, `docs/infrastructure.md`, `docs/methodology.md`

40+ contract files under `.gsd-t/contracts/` defining domain interfaces, API shapes, schema formats, and methodology rules. `progress.md` is the authoritative project state (current milestone, phase, status, decision log, completed milestones table). Domain-specific state lives under `.gsd-t/domains/{name}/` (scope.md, tasks.md, constraints.md). `commands/gsd-t-doc-ripple.md`, `commands/gsd-t-gap-analysis.md`, `commands/gsd-t-impact.md` orchestrate living-doc updates.

Key issues: `context-brief-contract.md` KINDS list is stale (lists 6 kinds from M55-era, 11 exist post-M56); `progress-file-format.md` missing ACTIVE status value, Summary column in Completed Milestones table, M59 `HH:MM TZ` timestamp format requirement; `contracts-stable.cjs` preflight check regex `^\s*Status\s*:` never matches `## Status: ACTIVE` ATX heading format (check is permanently a no-op); `gsd-t-gap-analysis.md` step sequence jumps from Step 4 to Step 6 (Step 5 missing).

---

## Data Flow

### Execute Phase (happy path)
```
/gsd-t-execute (command) -> gsd-t-execute.workflow.js (Workflow tool)
  |
  +-- preflight: bin/cli-preflight.cjs [sub-checks: branch-guard, working-tree-state,
  |              ports-free, contracts-stable, deps-installed, manifest-fresh]
  |
  +-- brief per domain: bin/gsd-t-context-brief.cjs --kind execute --domain <d>
  |     reads: .gsd-t/domains/<d>/tasks.md, scope.md, contracts/, progress.md
  |     writes: .gsd-t/briefs/<spawnId>.json (ephemeral, gitignored)
  |
  +-- disjointness: bin/gsd-t-parallel.cjs --dry-run
  |     reads: .gsd-t/domains/*/tasks.md + scope.md
  |     computes pairwise write-target overlap via bin/gsd-t-file-disjointness.cjs
  |     validates dependency ordering via bin/gsd-t-depgraph-validate.cjs
  |
  +-- parallel domain workers [agent() per domain, model: sonnet]
  |     reads brief JSON, tasks.md, scope.md
  |     makes code changes, runs tests, commits
  |
  +-- integrate barrier [agent(), model: sonnet - missing model: field, known bug]
  |     cross-domain wire-up, resolves import/API conflicts
  |
  +-- verify-gate: bin/gsd-t-verify-gate.cjs --json
        Track 1: preflight envelope (re-runs checks)
        Track 2: bin/parallel-cli.cjs -> tsc, lint, npm test, knip, gitleaks, complexity
        Judge: bin/gsd-t-verify-gate-judge.cjs -> <=500 token summary envelope
        writes: .gsd-t/verify-gate/{runId}/
```

### Verify Phase (orthogonal triad)
```
gsd-t-verify.workflow.js
  |
  +-- verify-gate (Track 1 + Track 2, as above)
  |
  +-- M57 CI-Parity [FAIL-blocking]:
  |     bin/gsd-t-build-coverage.cjs  (checks CI config covers all source dirs)
  |     bin/gsd-t-ci-parity.cjs       (checks CI commands match local commands)
  |
  +-- M58 Test-Data Purge [FAIL-blocking]:
  |     bin/gsd-t-test-data-ledger.cjs --purge --run <runId>
  |
  +-- parallel orthogonal triad [agent() stages]:
  |     /code-review ultra [model: sonnet, skippable with reason]
  |     Red Team [model: opus, non-skippable, verdict: FAIL | GRUDGING-PASS]
  |     QA [model: sonnet, non-skippable]
  |     + Design Verification [if .gsd-t/contracts/design-contract.md exists]
  |
  +-- synthesis [model: sonnet]
        merges triad results without category collapse
        Verdict: VERIFIED | VERIFIED-WITH-WARNINGS | VERIFY-FAILED
        (Note: no programmatic guard enforcing Red Team FAIL -> VERIFY-FAILED)
```

### Scan Phase Flow
```
gsd-t-scan.workflow.js (correctly M71-migrated, orchestrator does zero I/O)
  |
  +-- preflight [agent via Bash]
  +-- volume-probe [agent, model: sonnet] -> slice list (volume-based fan-out)
  +-- pipeline: per-slice deep-finder [agent] -> single verify [agent]
  +-- synthesis [agent, model: opus] -> archive prior register + write fresh + git commit
  +-- document [parallel agent() per doc] -> living docs + 5 dimension files
  +-- render [agent] -> HTML report from scan-report.js/scan-renderer.js
```

### Token / Event Sink Flow
```
domain worker (claude -p --output-format stream-json)
  |
  +-- NDJSON frames -> HTTP POST :7842/ingest -> gsd-t-stream-feed-server.js
  |     persists: .gsd-t/stream-feed/YYYY-MM-DD.jsonl (daily rotation)
  |     broadcasts: WebSocket :7842/feed -> dashboard clients (with ?from=N replay)
  |
  +-- task completion -> bin/metrics-collector.js
  |     persists: .gsd-t/metrics/task-metrics.jsonl
  |
  +-- gate events -> scripts/gsd-t-event-writer.js
  |     persists: .gsd-t/events/YYYY-MM-DD.jsonl
  |
  +-- per-agent state -> scripts/gsd-t-watch-state.js
        persists: .gsd-t/.watch-state/{agentId}.json (atomic write via tmp+rename)
```

### Design-Build Pipeline Flow
```
/gsd-t-design-build -> bin/design-orchestrator.js (extends bin/orchestrator.js)
  |
  +-- discoverWork: reads .gsd-t/contracts/design/INDEX.md
  |                 parses element/widget/page contract files
  |
  +-- foreach phase [elements -> widgets -> pages] (sequential, gate between tiers):
  |     build prompt (hardcoded "Vue 3+TypeScript" - known bug for React/Svelte/Angular)
  |     spawn claude -p with contract details + build instructions
  |     auto-accept or enqueue for human review
  |
  +-- review loop: scripts/gsd-t-design-review-server.js (HTTP on configurable port)
        proxies dev server (with gzip decompression bug - injection fails)
        serves review overlay (scripts/gsd-t-design-review-inject.js)
        manages work queue as JSON files in .gsd-t/design-review/
        writes feedback JSON + updates contract files on accept
```

---

## Key Architectural Decisions

**M61 Workflow Migration** - Moved phase orchestration from `bin/orchestrator.js` (Node.js CJS) to native Anthropic Workflow scripts. Migration is incomplete: only `gsd-t-scan.workflow.js` is correctly sandbox-compliant; the other six crash on startup (M71).

**Brief-First Worker Rule** - Every `agent()` spawn receives a `$BRIEF_PATH` pointing to a <=10 KB JSON snapshot. Workers grep the brief before walking the repo. 11 kind-specific collectors; briefs are gitignored ephemera.

**File-Disjointness Gate** - Parallel domain execution requires a preflight proof that no two concurrent workers claim the same write target. `bin/gsd-t-file-disjointness.cjs` performs pairwise overlap checking using tasks.md touch lists plus git-history heuristics. Gate has a multi-domain CLI bug (`parseArgv` last-wins) that silently bypasses the safety check for all multi-domain runs.

**Contract-Driven Verification** - Every domain publishes a `scope.md` (file ownership) and `tasks.md` (task DAG). The verify-gate is purely deterministic (Track 1 preflight + Track 2 parallel CLI tools); the orthogonal validation triad (code-review/Red Team/QA) is LLM-driven but schema-validated and runs as Workflow stages.

**Pluggable Check Registry** - Both preflight checks and brief kinds use directory-scan auto-registration. Dropping a `.cjs` file into the respective subdirectory is sufficient to add a new check or kind.

**Zero External Runtime Deps** - All `bin/` modules use only Node built-ins. Hard invariant enforced by convention and `gsd-t doctor`. Makes the installer `npx`-safe without npm install.

**Fail-Open Pre-Commit Hooks** - Hooks that fail exit 0 rather than blocking the commit, to avoid developer friction on tool issues. The exception is `pre-commit-playwright-gate` which enforces E2E must-pass semantics.
