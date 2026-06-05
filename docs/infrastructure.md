# Infrastructure - GSD-T Framework (@tekyzinc/gsd-t)

## Last Updated: 2026-06-04 (deep-scan M80)

---

## Quick Reference

| Task | Command |
|------|---------|
| Install GSD-T | `npx @tekyzinc/gsd-t install` |
| Update GSD-T | `npx @tekyzinc/gsd-t update` |
| Update GSD-T + all projects | `npx @tekyzinc/gsd-t update-all` |
| Check installation status | `npx @tekyzinc/gsd-t status` |
| Diagnose issues | `npx @tekyzinc/gsd-t doctor` |
| Scaffold a project | `npx @tekyzinc/gsd-t init [project-name]` |
| Register current dir | `npx @tekyzinc/gsd-t register` |
| View changelog | `npx @tekyzinc/gsd-t changelog` |
| Uninstall | `npx @tekyzinc/gsd-t uninstall` |
| Run unit tests | `npm test` (Node built-in runner; prepublishOnly hook) |
| Run E2E tests | `npm run e2e` (Playwright - chromium) |
| Install Playwright | `npm run e2e:install` |
| Publish to npm | `npm publish` (runs `npm test` first via prepublishOnly) |
| Headless exec | `gsd-t headless <command> [--json] [--timeout=N] [--log]` |
| Headless query (no LLM) | `gsd-t headless query <type>` (<100ms, pure file parse) |
| Code graph index | `gsd-t graph index` |
| Code graph status | `gsd-t graph status` |
| Code graph query | `gsd-t graph query <entity>` |
| Preflight check | `gsd-t preflight [--json]` |
| Context brief | `gsd-t brief --kind <kind> [--domain <d>]` |
| Verify gate | `gsd-t verify-gate [--json]` |
| CI-parity check | `gsd-t ci-parity [--json]` |
| Build coverage check | `gsd-t build-coverage [--json]` |
| Test data ledger | `gsd-t test-data --list | --purge --run <id>` |
| Parallel tasks | `gsd-t parallel [--dry-run] [--domain <d>]` |
| Workflow path resolver | `gsd-t workflow-path <name>` |
| Journey coverage | `gsd-t check-coverage [--report] [--strict]` |
| Doctor (full) | `gsd-t doctor [--prune] [--install-playwright] [--install-hooks] [--install-journey-hook]` |
| Archive progress log | `node bin/archive-progress.cjs [--project DIR] [--dry-run] [--keep N]` |

---

## Local Development

### Setup

```bash
# Clone the repo
git clone https://github.com/Tekyz-Inc/get-stuff-done-teams.git
cd get-stuff-done-teams

# No npm install needed for runtime - zero runtime dependencies
# Install dev dependency (Playwright) if running E2E tests:
npm install

# Test the CLI directly (no build step needed):
node bin/gsd-t.js status
node bin/gsd-t.js install
node bin/gsd-t.js doctor
```

### Testing

```bash
# Run all unit tests (Node built-in test runner, 78 test files)
npm test

# Run E2E tests (Playwright - requires chromium)
npm run e2e:install   # one-time: install chromium
npm run e2e           # run E2E suite

# Test specific CLI subcommands manually
node bin/gsd-t.js status
node bin/gsd-t.js doctor
node bin/gsd-t.js init test-project

# Validate command file counts
ls commands/*.md | wc -l   # 51 command files
ls templates/stacks/*.md    # stack rule templates

# Test scan HTML export
node bin/gsd-t.js scan --export=html
# Output: scan-report.html (self-contained)

# Test stream feed server (loopback only, port 7842)
node scripts/gsd-t-stream-feed-server.js --port 7842

# Test design review server (default port 3456)
node scripts/gsd-t-design-review-server.js --port 3456 --target http://localhost:5173

# Validate a workflow script path
node bin/gsd-t.js workflow-path execute
node bin/gsd-t.js workflow-path verify
```

### Scripts Reference

| Script | Purpose |
|--------|---------|
| `scripts/gsd-t-heartbeat.js` | Claude Code hook event logger - JSONL output, secret scrubbing |
| `scripts/gsd-t-auto-route.js` | UserPromptSubmit hook - auto-routes plain text via /gsd in GSD-T projects |
| `scripts/gsd-t-update-check.js` | SessionStart hook - fetches latest npm version, emits update banners |
| `scripts/gsd-t-fetch-version.js` | Synchronous npm registry fetch (5s timeout, 1MB limit) |
| `scripts/gsd-t-tools.js` | State utility CLI - get/set/validate/list/git-check/template-read |
| `scripts/gsd-t-statusline.js` | Context usage bar + project state for Claude Code statusLine |
| `scripts/gsd-t-event-writer.js` | Structured JSONL event appender CLI - writes to `.gsd-t/events/` |
| `scripts/gsd-t-stream-feed-server.js` | WebSocket + SSE server for real-time agent stream (port 7842) |
| `scripts/gsd-t-dashboard-autostart.cjs` | Dashboard process management - start/stop/check |
| `scripts/gsd-t-date-guard.js` | PreToolUse hook - blocks Write/Edit with stale timestamps (+-5 min) |
| `scripts/gsd-t-calibration-hook.js` | Detects compaction events from transcript - updates calibration data |
| `scripts/gsd-t-compact-detector.js` | Appends compaction JSONL rows to `.gsd-t/metrics/compactions.jsonl` |
| `scripts/gsd-t-compaction-scanner.js` | Backfills compaction log by scanning transcript history |
| `scripts/gsd-t-token-aggregator.js` | Aggregates stream-feed JSONL into per-task token-usage.jsonl |
| `scripts/gsd-t-watch-state.js` | Writes/reads agent watch-state JSON files (atomic write) |
| `scripts/gsd-t-design-review-server.js` | Design review proxy server with inject overlay (port 3456) |
| `scripts/npm-update-check.js` | Background npm registry version checker (path-validated) |

### Bin Modules Reference

| Module | Purpose |
|--------|---------|
| `bin/gsd-t.js` | Main CLI entry point - install, update, init, status, doctor, graph, headless, etc. |
| `bin/orchestrator.js` | Design-phase orchestrator - element inventory + build pipeline |
| `bin/design-orchestrator.js` | Design-to-code build pipeline - elements, widgets, pages |
| `bin/cli-preflight.cjs` | Preflight gate - branch guard, dirty tree, ports, contract stability |
| `bin/gsd-t-context-brief.cjs` | Per-spawn context brief generator (11 kinds: execute, verify, qa, etc.) |
| `bin/gsd-t-verify-gate.cjs` | Track 1+2 verify gate - preflight + parallel CLI substrate |
| `bin/gsd-t-verify-gate-judge.cjs` | Synthesis judge - merges triad results into VERIFIED / VERIFY-FAILED |
| `bin/gsd-t-build-coverage.cjs` | CI-parity gate: checks all top-level dirs appear in Dockerfile COPY |
| `bin/gsd-t-ci-parity.cjs` | CI-parity gate: compares local build config with CI config |
| `bin/gsd-t-parallel.cjs` | Task parallelism orchestrator - mode-aware gating, fan-out decisions |
| `bin/parallel-cli.cjs` | Worker pool executor - failFast, SIGTERM/SIGKILL escalation, tee |
| `bin/parallel-cli-tee.cjs` | Tee streaming helper for parallel-cli output |
| `bin/gsd-t-task-graph.cjs` | Task dependency graph builder |
| `bin/gsd-t-file-disjointness.cjs` | File-disjointness safety gate for parallel worker safety |
| `bin/gsd-t-depgraph-validate.cjs` | Dependency graph validation for task ordering |
| `bin/gsd-t-test-data-ledger.cjs` | Test data registration/purge ledger for E2E cleanup |
| `bin/archive-progress.cjs` | Rolls old Decision Log entries out of progress.md into archives |
| `bin/global-sync-manager.js` | Global cross-project metrics sync to `~/.claude/metrics/` |
| `bin/patch-lifecycle.js` | Candidate/applied/measured/promoted/graduated patch state machine |
| `bin/metrics-collector.js` | Task-metrics JSONL writer for `.gsd-t/metrics/task-metrics.jsonl` |
| `bin/rule-engine.js` | Loads rules from `.gsd-t/metrics/rules.jsonl`, evaluates, creates candidates |
| `bin/model-selector.js` | Declarative phase-to-model mapping (haiku/sonnet/opus) |
| `bin/playwright-bootstrap.cjs` | Playwright install + health check library |
| `bin/ui-detection.cjs` | Detects whether project has a UI layer |
| `bin/journey-coverage.cjs` | Journey coverage manifest builder |
| `bin/journey-coverage-cli.cjs` | CLI wrapper for journey-coverage |
| `bin/graph-cgc.js` | CodeGraphContext (CGC) Neo4j adapter |
| `bin/graph-indexer.js` | Project file indexer for code graph |
| `bin/graph-store.js` | Graph index read/write (8 JSON files per project) |
| `bin/graph-query.js` | Query callers/imports/surfaces via grep fallback |
| `bin/graph-overlay.js` | Overlays domain/contract metadata onto graph |
| `bin/graph-parsers.js` | AST parsers for JS/TS/Python call extraction |
| `bin/advisor-integration.js` | Advisor hook integration |
| `bin/component-registry.js` | Component registry with atomic JSONL write |
| `bin/debug-ledger.js` | Debug cycle ledger for headless debug-loop |
| `bin/scan-*.js` | Scan engine modules (data-collector, schema, schema-parsers, report, report-sections, renderer, export, diagrams, diagrams-generators) |
| `bin/gsd-t-time-format.cjs` | `localIsoWithOffset()` for POSIX-correct local timestamps |
| `bin/gsd-t-completion-check.cjs` | Completion status check for milestone gate |

---

## Distribution

### npm Package

- **Registry**: https://www.npmjs.com/package/@tekyzinc/gsd-t
- **Current version**: see `package.json` ("version" field) - track at `~/.claude/.gsd-t-version`
- **Publish**: `npm publish` (requires npm login with Tekyz account; `prepublishOnly` runs `npm test`)
- **Zero runtime dependencies** - installer uses only Node.js built-ins
- **Dev dependency**: `@playwright/test` ^1.55.0 (E2E tests only)
- **Files shipped**: `bin/`, `commands/`, `scripts/`, `templates/`, `examples/`, `docs/`, `CHANGELOG.md`

### Installed Locations

| What | Where |
|------|-------|
| Slash commands (51 files) | `~/.claude/commands/` |
| Global CLAUDE.md | `~/.claude/CLAUDE.md` |
| Heartbeat script | `~/.claude/scripts/gsd-t-heartbeat.js` |
| Update-check script | `~/.claude/scripts/gsd-t-update-check.js` |
| Auto-route script | `~/.claude/scripts/gsd-t-auto-route.js` |
| State utility CLI | `~/.claude/scripts/gsd-t-tools.js` |
| Statusline script | `~/.claude/scripts/gsd-t-statusline.js` |
| Shared templates | `~/.claude/templates/` |
| Hook configuration | `~/.claude/settings.json` (hooks section) |
| Version file | `~/.claude/.gsd-t-version` |
| Update cache | `~/.claude/.gsd-t-update-check` |
| Project registry | `~/.claude/.gsd-t-projects` |
| Global bin tools | `~/.claude/bin/` (see list below) |

**Global bin tools** (copied to `~/.claude/bin/` on install):

| Tool | Purpose |
|------|---------|
| `cli-preflight.cjs` | Preflight gate dispatch target |
| `gsd-t-context-brief.cjs` | Brief generator dispatch target |
| `gsd-t-verify-gate.cjs` | Verify gate dispatch target |
| `gsd-t-verify-gate-judge.cjs` | Judge dispatch target |
| `parallel-cli.cjs` | Parallel worker pool executor |
| `gsd-t-build-coverage.cjs` | Build coverage check |
| `gsd-t-ci-parity.cjs` | CI parity check |
| `parallelism-report.cjs` | Parallelism report generator |
| `live-activity-report.cjs` | Live activity report generator |

### Installed Hooks (settings.json)

GSD-T registers these hooks in `~/.claude/settings.json`:

| Hook type | Script | Purpose |
|-----------|--------|---------|
| `UserPromptSubmit` | `gsd-t-auto-route.js` | Emits `[GSD-T NOW]` clock signal; routes plain text via /gsd in GSD-T project dirs |
| `SessionStart` | `gsd-t-update-check.js` | Fetches latest npm version; emits `[GSD-T AUTO-UPDATE]` / `[GSD-T UPDATE]` / `[GSD-T]` |
| `UserPromptSubmit` | `gsd-t-heartbeat.js` | Logs conversation events to `.gsd-t/events/YYYY-MM-DD.jsonl` |
| `PostToolUse` (dead) | context-meter hook | Installed but non-functional - context meter was retired in M61; hook silently exits 0 |
| `PreToolUse` | `gsd-t-date-guard.js` | Blocks Write/Edit calls with timestamps drifting >5 min from live clock |

Note: The context-meter PostToolUse hook is still written to settings.json on install (known defect - finding in scan) but silently no-ops since `scripts/gsd-t-context-meter.js` does not exist.

### Figma MCP

Auto-configured during install via `claude mcp add`:

```bash
# Configured automatically by gsd-t install. To add manually:
claude mcp add --transport http -s user figma https://mcp.figma.com/mcp
```

Check current status:
```bash
gsd-t doctor
```

---

## Project Directory Structure (.gsd-t/)

Each GSD-T project has a `.gsd-t/` state directory created by `gsd-t init`. Key subdirectories:

| Path | Purpose | Committed? |
|------|---------|-----------|
| `.gsd-t/progress.md` | Milestone/phase state + decision log | Yes |
| `.gsd-t/backlog.md` | Backlog items | Yes |
| `.gsd-t/backlog-settings.md` | Backlog defaults (apps, types) | Yes |
| `.gsd-t/contracts/` | Domain interface contracts (STABLE/DRAFT) | Yes |
| `.gsd-t/domains/` | Per-domain scope/tasks/constraints | Yes |
| `.gsd-t/milestones/` | Completed milestone archives + archive-meta.json | Yes |
| `.gsd-t/progress-archive/` | Rolled-out decision log entries (NNN-YYYY-MM-DD.md) | Yes |
| `.gsd-t/techdebt.md` | Tech debt register | Yes |
| `.gsd-t/scan/` | Deep-scan output (architecture.md, security.md, quality.md, etc.) | Yes |
| `.gsd-t/events/` | JSONL event stream (YYYY-MM-DD.jsonl, heartbeat writes) | No (gitignored) |
| `.gsd-t/metrics/` | Task metrics, compaction log, token-usage, rollup | No (gitignored) |
| `.gsd-t/stream-feed/` | WebSocket frame JSONL (YYYY-MM-DD.jsonl) | No (gitignored) |
| `.gsd-t/briefs/` | Per-spawn context briefs (ephemera) | No (gitignored) |
| `.gsd-t/.unattended/` | Supervisor state, PID, run log, stop sentinel | No (gitignored) |
| `.gsd-t/token-log.md` | Headless exec token log rows | No (gitignored) |
| `.gsd-t/token-metrics.jsonl` | Legacy M35-era per-spawn token records | No (gitignored) |
| `.gsd-t/.context-meter-state.json` | Context meter state (retired, kept for compat) | No (gitignored) |
| `.gsd-t/.last-playwright-pass` | Timestamp of last Playwright pass (pre-commit gate) | No |

---

## Ports and Services

| Service | Default Port | Env Override | Notes |
|---------|-------------|--------------|-------|
| Stream Feed Server | 7842 | `GSD_T_STREAM_FEED_PORT` | Loopback only (127.0.0.1) - WebSocket + SSE |
| Design Review Server | 3456 | `--port` arg | Proxies dev server with inject overlay |
| Neo4j (graph engine) | 7687 (Bolt) / 7474 (HTTP) | Docker container | Container name: `gsd-t-neo4j` |

---

## Graph Engine (CGC + Neo4j)

The code graph engine is an optional feature for deep code analysis. It requires Docker.

### Setup

```bash
# Install CGC (CodeGraphContext) - requires Python
pip install codegraphcontext

# Install/start Neo4j container (done automatically by gsd-t install / gsd-t doctor)
docker run -d --name gsd-t-neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/gsdt-graph-2026 \
  --restart unless-stopped \
  neo4j:5-community

# Configure CGC to point at the container
cgc config set DEFAULT_DATABASE neo4j
cgc config set NEO4J_URI bolt://localhost:7687
cgc config set NEO4J_PASSWORD gsdt-graph-2026
```

**Security note**: The password `gsdt-graph-2026` is hardcoded in the installer (known defect - see techdebt.md). This is a local-only Neo4j instance but the password is publicly known. For sensitive codebases, change the password after setup:

```bash
# Change Neo4j password post-install (Neo4j browser at http://localhost:7474)
# Then update CGC config:
cgc config set NEO4J_PASSWORD <new-password>
```

### Container Management

```bash
# Check container status
gsd-t doctor

# Start stopped container
docker start gsd-t-neo4j

# Stop container
docker stop gsd-t-neo4j

# Check if running
docker inspect gsd-t-neo4j --format '{{.State.Running}}'
```

### Graph CLI Usage

```bash
# Index the current project
gsd-t graph index

# Check index status
gsd-t graph status

# Query an entity
gsd-t graph query MyClass

# Show task domain assignments
gsd-t graph tasks [table|json]
```

---

## Secrets and Credentials

**Names only - never store values in docs.**

| Name | Purpose | Where set |
|------|---------|-----------|
| `ANTHROPIC_API_KEY` | Token counting / diagnostics only (NOT inference - inference uses Claude Max subscription) | Shell profile or CI secret |
| `GSD_T_STREAM_FEED_PORT` | Override stream feed server port | Environment |
| `GSD_T_AGENT_ID` | Agent identity for watch-state files (CLI arg `--agent-id` preferred) | Environment or CLI |
| Neo4j password | CGC graph engine auth - see security note above | `~/.codegraphcontext/.env` |

**ANTHROPIC_API_KEY** is used only for `count_tokens` diagnostics. All LLM inference uses the Claude Max subscription (local install) - never billed to the API key for build work.

```bash
# Set in shell profile (optional - only needed for token diagnostics)
export ANTHROPIC_API_KEY="sk-ant-..."

# Verify
gsd-t doctor
```

---

## Headless Execution

Headless mode runs GSD-T commands non-interactively via `claude -p` with `--dangerously-skip-permissions`.

### headless exec

```bash
gsd-t headless verify --json --timeout=1200 --log
gsd-t headless execute --timeout=3600
gsd-t headless wave --json
gsd-t headless quick "add error handling to auth module"
```

**Flags:**

| Flag | Default | Description |
|------|---------|-------------|
| `--json` | off | Output structured JSON envelope |
| `--timeout=N` | 300s | Kill process after N seconds |
| `--log` | off | Write output to `.gsd-t/headless-{timestamp}.log` |

**Exit codes:**

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Verify-fail (tests or quality gates failed) |
| 2 | Context-budget-exceeded (split the milestone) |
| 3 | Error (claude CLI error or process failure) |
| 4 | Blocked-needs-human (requires manual intervention) |

**JSON envelope shape:**

```json
{
  "success": true,
  "exitCode": 0,
  "gsdtExitCode": 0,
  "command": "verify",
  "args": [],
  "output": "...",
  "timestamp": "2026-06-04T10:00:00.000Z",
  "duration": 42150,
  "logFile": ".gsd-t/headless-1749034800000.log"
}
```

### headless query

Pure Node.js file parsing - no LLM calls, <100ms.

```bash
gsd-t headless query status      # Version, milestone, phase
gsd-t headless query domains     # Domain list with flags
gsd-t headless query contracts   # Contract file list
gsd-t headless query debt        # Tech debt items
gsd-t headless query context     # Token log summary
gsd-t headless query backlog     # Backlog items (note: parse bug - always empty, see techdebt)
gsd-t headless query graph       # Graph index metadata
```

All queries return JSON to stdout.

### debug-loop

```bash
gsd-t headless --debug-loop <command>
```

Runs up to 20 fix/verify cycles on a failing command. Exits code 0 (fixed), 1 (max iterations), or 4 (escalation needed).

**Known defect**: `spawnClaudeSession` (used by debug-loop) is missing `--dangerously-skip-permissions`, causing all tool use to fail. See techdebt.md.

---

## CI/CD Integration

### GitHub Actions

```yaml
- name: GSD-T Verify
  run: gsd-t headless verify --json --timeout=1200
```

Note: `ANTHROPIC_API_KEY` is optional (token diagnostics only). Inference runs via Claude Max and does not require the API key in CI.

### GitLab CI

```yaml
gsd-t-verify:
  script:
    - gsd-t headless verify --json --timeout=1200
```

### Pre-commit Hooks (opt-in)

Install via `gsd-t init --install-hooks` or `gsd-t doctor --install-hooks`:

| Hook | Script | Status |
|------|--------|--------|
| Playwright gate | `scripts/hooks/pre-commit-playwright-gate` | Active |
| Journey coverage | `scripts/hooks/pre-commit-journey-coverage` | Active |
| Capture lint | `scripts/hooks/pre-commit-capture-lint` | BROKEN - references retired `gsd-t capture-lint` subcommand (see techdebt) |

**Do not install `pre-commit-capture-lint`** - it will block all commits unconditionally. The `gsd-t capture-lint` subcommand was removed in M61.

---

## Workflow Scripts

Native Workflow scripts live in `templates/workflows/`. Use `gsd-t workflow-path <name>` to resolve the absolute path (required for `Workflow({scriptPath})` calls from consumer projects).

```bash
# Get absolute path to a workflow script
gsd-t workflow-path execute
gsd-t workflow-path verify
gsd-t workflow-path wave
```

Available workflow scripts:

| Script | Purpose |
|--------|---------|
| `gsd-t-execute.workflow.js` | Preflight + brief + disjointness + parallel domain workers + integrate + verify-gate |
| `gsd-t-verify.workflow.js` | Orthogonal triad (code-review + Red Team + QA) + CI-parity + test-data purge |
| `gsd-t-wave.workflow.js` | Composes execute + verify as sub-workflows |
| `gsd-t-integrate.workflow.js` | Cross-domain wire-up + light verify-gate |
| `gsd-t-debug.workflow.js` | 2-cycle diagnose/fix/verify debug loop |
| `gsd-t-quick.workflow.js` | Preflight + brief + single-task + verify-gate |
| `gsd-t-phase.workflow.js` | Generic upper-stage runner (partition/plan/discuss/impact/milestone/prd) |
| `gsd-t-scan.workflow.js` | Volume-scaled deep codebase analysis + dimension files + HTML report |

**Known defect (M71 - CRITICAL)**: All workflow scripts except `gsd-t-scan.workflow.js` use `require('./_lib.js')` at the top level. The native Workflow sandbox does not provide `require` - these crash immediately with `ReferenceError: require is not defined`. Migration to sandbox-native patterns is pending. See techdebt.md.

---

## Context Meter / Calibration

The context meter was retired in M61. The calibration hook (`scripts/gsd-t-calibration-hook.js`) and compaction detector (`scripts/gsd-t-compact-detector.js`) remain active and write to `.gsd-t/metrics/compactions.jsonl`.

**Context window**: Opus 4.7/4.8 and Sonnet 4.5+ have 1M token context windows. The `templates/context-meter-config.json` template ships with a stale 200K `modelWindowSize` - update per-project configs to 1000000. The calibration hook uses `SAFE_DEFAULT_WINDOW = 1_000_000` correctly.

```json
{
  "enabled": true,
  "modelWindowSize": 1000000,
  "thresholdPct": 75,
  "checkFrequency": 1
}
```

---

## Model Selection

`bin/model-selector.js` maps phases to inference tiers:

| Phase | Model | Notes |
|-------|-------|-------|
| `execute` | sonnet | Domain workers |
| `verify` / `qa` | sonnet | QA subagent |
| `red-team` | opus | Adversarial analysis |
| `design-verify` | opus | Visual comparison |
| `plan` | sonnet | Note: contract says opus - known divergence (see techdebt) |
| `integrate` | sonnet | Cross-domain wire-up |
| `scan` | sonnet | Volume-scaled slices |
| `debug` | sonnet | Fix cycles |

Use `gsd-t doctor` to verify model-selector is loaded correctly.

---

## Unattended Supervisor

The unattended supervisor runs a GSD-T milestone to completion in a detached process. Underlying commands were rearchitected in M61 - `/gsd-t-unattended` and `/gsd-t-unattended-watch` commands reference deleted bin modules and are currently non-functional (see techdebt.md CRITICAL finding). Use the `/loop` skill with native Workflows instead.

### State Files

| File | Purpose |
|------|---------|
| `.gsd-t/.unattended/supervisor.pid` | Integer PID - exists only while supervisor is alive |
| `.gsd-t/.unattended/state.json` | Live state snapshot - status, iter, milestone, lastTick |
| `.gsd-t/.unattended/run.log` | Append-only worker stdout+stderr |
| `.gsd-t/.unattended/stop` | Sentinel - touching this requests graceful stop |
| `.gsd-t/.unattended/config.json` | Optional per-project config overrides |

Contract: `.gsd-t/contracts/unattended-supervisor-contract.md` v1.0.0

---

## Progress Log Archival

Old Decision Log entries are rolled out of `progress.md` into numbered archives to keep it lean.

```bash
# Run archival (idempotent)
node bin/archive-progress.cjs

# Preview without changes
node bin/archive-progress.cjs --dry-run

# Override defaults (keep 5 live, 20 per archive)
node bin/archive-progress.cjs --keep 10 --per-archive 30

# Target a specific project
node bin/archive-progress.cjs --project /path/to/project
```

Archives land in `.gsd-t/progress-archive/NNN-YYYY-MM-DD.md`. An `index.md` is rebuilt on each run.

---

## Security Notes

- Zero npm runtime dependencies - no supply chain risk
- All file writes check for symlinks first
- Input validation on project names, versions, session IDs, paths
- Heartbeat stdin capped at 1MB
- HTTP requests use HTTPS with timeouts (5s for version check)
- Init operations use exclusive file creation (`{ flag: "wx" }`)
- Watch-state files: `gsd-t-watch-state.js` uses `--agent-id` to construct file paths - ensure agent IDs contain only alphanumeric/hyphen/underscore characters (path traversal vulnerability in current version, see techdebt)
- Stream feed POST `/ingest` has no body size limit (denial-of-service risk, see techdebt)
- Neo4j password is hardcoded in installer (see techdebt) - change after install for sensitive codebases
- Design review server: `item.id` values from queue files are used unsanitized in file paths (path traversal, see techdebt)

---

## Troubleshooting

**`gsd-t: command not found`**

```bash
# Install globally
npm install -g @tekyzinc/gsd-t
# or use npx
npx @tekyzinc/gsd-t status
```

**Hooks not firing**

```bash
gsd-t doctor
# Check "Hooks" section output
# Re-run install if missing:
npx @tekyzinc/gsd-t install
```

**Workflow fails with `ReferenceError: require is not defined`**

This is a known CRITICAL defect (M71 migration incomplete). All workflow scripts except `gsd-t-scan.workflow.js` crash in the native Workflow sandbox. See techdebt.md. Workaround: use `/gsd-t-execute` etc. in hand-driven mode via Claude Code slash commands, not via the native `Workflow()` tool directly.

**Neo4j container stopped**

```bash
docker start gsd-t-neo4j
# Or check status:
gsd-t doctor
```

**Dashboard orphan processes**

```bash
gsd-t doctor --prune
```

**Journey coverage pre-commit hook blocks commits**

```bash
# Check which files are missing coverage
gsd-t check-coverage --report
# Or remove the hook from .git/hooks/pre-commit if not needed
```

**All commits blocked by pre-commit-capture-lint hook**

Remove the hook section from `.git/hooks/pre-commit` - the `gsd-t capture-lint` subcommand was retired in M61 and no longer exists. The hook unconditionally exits 1.
