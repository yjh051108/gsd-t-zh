# Workflows — GSD-T Framework (@tekyzinc/gsd-t)

## Last Updated: 2026-06-04 (Scan #10, Post-M61/M66/M71/M75)

## User Workflows

### Install GSD-T
1. Run `npx @tekyzinc/gsd-t install`
2. CLI copies 45 commands to `~/.claude/commands/`
3. CLI sets up global CLAUDE.md if missing (appends with separator if exists)
4. CLI installs heartbeat script to `~/.claude/scripts/`
5. CLI configures 9 hooks in `~/.claude/settings.json`
6. CLI saves version to `~/.claude/.gsd-t-version`
7. User starts Claude Code in their project

**Entry point**: `npx @tekyzinc/gsd-t install`
5b. CLI installs gsd-t-tools.js and gsd-t-statusline.js to `~/.claude/scripts/` (M13)
**Success**: 45 commands available in Claude Code
**Failure**: CLI reports missing Node.js or permission errors

### Initialize a Project
1. User runs `/gsd-t-init [name]` in Claude Code (or `gsd-t init [name]` CLI)
2. Init creates `.gsd-t/` directory with progress.md, backlog.md, backlog-settings.md, contracts/, domains/
3. Init creates or updates CLAUDE.md (project-level) using template with token replacement
4. Init creates `docs/` living documents (requirements, architecture, workflows, infrastructure) if missing
5. Init auto-registers project in `~/.claude/.gsd-t-projects`
6. All file creation uses `{ flag: "wx" }` — never overwrites existing files

**Entry point**: `/gsd-t-init` slash command or `gsd-t init` CLI
**Success**: Project ready for milestone definition
**Failure**: Reports what couldn't be created (existing files preserved)

### Full Wave Cycle
1. User defines milestone via `/gsd-t-milestone`
2. **Partition**: Decompose into domains + contracts (file ownership, interfaces)
3. **Discuss**: Explore design decisions (always pauses, even Level 3) - SKIPPABLE via structured 3-condition check: single domain, no open questions in Decision Log, all cross-domain contracts exist (M7)
4. **Plan**: Create atomic task lists per domain with dependencies
5. **Impact**: Analyze downstream effects (PROCEED / CAUTION / BLOCK verdicts)
6. **Execute**: Implement tasks via Workflow parallel domain workers + integrate barrier
7. **Test-Sync**: Align tests with code changes, verify coverage
8. **Integrate**: Wire domains at boundaries, verify contracts honored
9. **Verify**: Orthogonal triad (code-review ultra + Red Team + QA) + CI-parity + test-data purge
10. **Complete**: Archive to `.gsd-t/milestones/`, bump version, git tag

Note: `/gsd-t-wave` runs ONLY execute + verify as sub-workflows. Partition, plan, discuss, and impact must be invoked separately before running wave.

Additional wave behaviors (M10-M12):
- **M10**: QA removed from partition/plan; execute/integrate spawn QA as Task subagent; test-sync/verify/complete run QA inline
- **M11**: Per-task commits (`feat({domain}/task-{N})`) enforced; between-phase spot-check (status + git + filesystem); Deviation Rules in execute (4-rule protocol, 3-attempt limit)
- **M12**: discuss creates CONTEXT.md (Locked Decisions); plan reads CONTEXT.md + runs plan validation subagent (max 3 iterations); REQ traceability table in requirements.md; verify marks requirements complete

**Entry point**: `/gsd-t-wave` (auto-advances) or manual phase-by-phase
**Success**: Milestone completed, version bumped, git tagged
**Failure**: Wave pauses at failing phase; spot-check re-spawns phase agent once before stopping

### Autonomy Levels
| Level | Behavior |
|-------|----------|
| Level 1 (Supervised) | Pause at each phase for confirmation |
| Level 2 (Standard) | Pause only at milestones |
| Level 3 (Full Auto) | Auto-advance; only stop for Destructive Guard, Impact BLOCK, errors after 2 attempts, Discuss |

### Error Recovery (2-Attempt Rule)
| Failure | Recovery | After 2 Failures |
|---------|----------|-------------------|
| Impact BLOCK | Add remediation tasks, re-run | STOP and report |
| Test failures | Fix and re-run | STOP and report |
| Verify failure | Remediate and re-verify | STOP and report |
| Gap analysis gaps | Auto-fix and re-analyze | STOP and report |

## Technical Workflows

### CLI Update Check
1. CLI reads cached version from `~/.claude/.gsd-t-update-check` (JSON: `{ latest, timestamp }`)
2. If cache is fresh (<1 hour): show notice if cached latest > installed
3. If no cache: synchronous fetch to npm registry (8s timeout), cache result
4. If cache stale (>1 hour): spawn detached background `scripts/npm-update-check.js`
5. Compare versions using `isNewerVersion()` semver comparison

**Trigger**: Every CLI invocation (except install/update/update-all)
**Also**: `/gsd-t-status` slash command checks independently

### Heartbeat Event Logging
1. Claude Code hook fires (9 events: SessionStart, PostToolUse, SubagentStart, SubagentStop, TaskCompleted, TeammateIdle, Notification, Stop, SessionEnd)
2. `settings.json` hook calls `node ~/.claude/scripts/gsd-t-heartbeat.js`
3. Script reads JSON from stdin (capped at 1MB)
4. Validates session_id (alphanumeric regex), validates path is absolute and within `.gsd-t/`
5. Builds structured event with timestamp, type-specific data (tool summaries, file paths)
6. Appends JSONL to `.gsd-t/heartbeat-{session_id}.jsonl`
7. Runs cleanup: removes heartbeat files older than 7 days

**Trigger**: Claude Code hooks (9 event types)
**Frequency**: On every hooked event during a session

### Version Bump Rules
| Context | Change Type | Bump |
|---------|-------------|------|
| Complete-milestone | Breaking changes, major rework | Major |
| Complete-milestone | New features, feature milestones | Minor |
| Complete-milestone | Bug fixes, cleanup | Patch |
| Checkin | New features, new commands | Minor |
| Checkin | Bug fixes, docs, refactors | Patch (default) |
| Checkin | Breaking changes | Major |

Updated in: package.json, .gsd-t/progress.md, CHANGELOG.md, git tag

### Pre-Commit Gate
Every commit must pass applicable checks:
1. Branch guard (correct branch?)
2. Contract updates (API, schema, component)
3. Scope updates (new files → domain scope.md)
4. Documentation updates (requirements, architecture)
5. Decision Log entry (timestamped in progress.md)
6. Tech debt tracking (discovered/fixed?)
7. Test execution (affected tests pass?)

### Pause and Resume (M13)

**Pause workflow** (`/gsd-t-pause`):
1. Command reads progress.md + domains/*/tasks.md to identify exact position
2. Creates `.gsd-t/continue-here-{YYYYMMDDTHHMMSS}.md` with: milestone, phase, version, last completed action, next action, open items, user note
3. File persists until consumed by resume
4. Multiple pauses create multiple files; resume reads most recent by timestamp

**Resume workflow** (`/gsd-t-resume`):
1. Same-session: skip file reads, use conversation context
2. Cross-session: glob `.gsd-t/continue-here-*.md`, read most recent
3. Resume from "Next Action" field in continue-here file (more precise than progress.md alone)
4. Delete continue-here file after reading

### CONTEXT.md Workflow (M12)

1. `discuss` phase completes design decisions
2. Writes `.gsd-t/CONTEXT.md`:
   - **Locked Decisions**: specific decisions the plan MUST implement
   - **Deferred Ideas**: good ideas NOT in scope (plan must NOT implement)
   - **Claude's Discretion**: implementation details left open
3. `plan` reads CONTEXT.md; every Locked Decision must map to at least one task
4. Plan validation subagent (Task tool) verifies mapping before finalizing plan
5. CONTEXT.md persists after plan phase; deleted manually if desired
6. If discuss is skipped (structured skip), CONTEXT.md is not created; plan handles gracefully

### Project Health Check (M13)

1. User invokes `/gsd-t-health [--repair]`
2. Health spawns as Task subagent (fresh context)
3. Checks 12 items: 5 root files, 3 directories, 4 docs, active milestone domains, version consistency, status validity, Decision Log, contract integrity
4. Reports status as HEALTHY (0 issues), DEGRADED (1-3), or BROKEN (4+ or critical missing)
5. With `--repair`: creates missing files from templates (MISSING items only; INVALID items flagged for user)

## Integration Workflows

### npm Publish
- **Trigger**: Manual `npm publish` after milestone completion
- **Pre-publish gate**: `prepublishOnly: "npm test"` runs 125 tests before publish (M8)
- **Flow**: Version bumped → CHANGELOG updated → git tagged → `npm publish` → tests run automatically → published
- **Verification**: `npx @tekyzinc/gsd-t status` on fresh install

### Update All Projects
- **Trigger**: `gsd-t update-all` CLI command
- **Flow**: Global update → iterate registered projects → inject Destructive Action Guard → create CHANGELOG → health check (Playwright, Swagger)
- **Registry**: `~/.claude/.gsd-t-projects` (newline-separated absolute paths)

### Real-Time Agent Dashboard (M14)

**Launch workflow** (`/gsd-t-visualize`):
1. Check if server is running: `GET http://localhost:7433/ping`
2. If not running: spawn `gsd-t-dashboard-server.js --detach` as background process; write PID to `.gsd-t/dashboard.pid`
3. Open browser to `http://localhost:7433`
4. Dashboard connects to `GET /events` (Server-Sent Events stream)

**Event stream flow**:
1. Claude Code hook fires (any hook event)
2. `gsd-t-event-writer.js` validates event fields and appends JSON line to `.gsd-t/events/YYYY-MM-DD.jsonl`
3. Dashboard server (`gsd-t-dashboard-server.js`) detects file change via `fs.watchFile()`
4. New event lines are broadcast as SSE: `data: {event-json}\n\n`
5. Dashboard HTML (React app via CDN) renders event feed with agent hierarchy

**Stop workflow**:
1. User runs `/gsd-t-visualize stop` or `GET /stop`
2. Server reads PID file, sends SIGTERM, deletes PID file

**Note:** Server watches only the newest JSONL file at startup. Date rollover (midnight UTC) requires server restart to pick up new file (TD-085).

### Auto-Update Workflow (M15)

1. Claude Code SessionStart hook fires
2. `gsd-t-update-check.js` reads `~/.claude/.gsd-t-version` (installed version)
3. Reads cached version from `~/.claude/.gsd-t-update-check` (JSON: `{latest, timestamp}`)
4. If cached version newer than installed: auto-runs `npm install -g @tekyzinc/gsd-t@{latest}` + `gsd-t update-all`
5. Outputs `[GSD-T AUTO-UPDATE]`, `[GSD-T UPDATE]`, or `[GSD-T] v{ver}` to stdout
6. Claude agent reads hook output from context and shows update status in first response

**Cache TTL**: 1 hour. After TTL, background `npm-update-check.js` refreshes async.

### Auto-Route Workflow (M16)

1. User types plain text in Claude Code in a GSD-T project directory
2. `gsd-t-auto-route.js` UserPromptSubmit hook fires
3. Script checks if `.gsd-t/progress.md` exists in cwd
4. If yes: injects `[GSD-T AUTO-ROUTE]` signal into prompt context
5. Claude agent sees signal and routes the plain text message through `/gsd {message}`
6. Smart router interprets intent and launches appropriate GSD-T command

**Note:** Only fires in GSD-T projects (`.gsd-t/progress.md` must exist). Silently passes through in all other directories.

### Scan Visual Output Workflow (M17)

1. User runs `/gsd-t-scan` — scan subagent analyzes codebase (Steps 1-2)
2. **Schema extraction** (Step 2.5): `bin/scan-schema.js` detects ORM/schema files
   - Tries Prisma → TypeORM → Drizzle → Mongoose → Sequelize → SQLAlchemy → raw SQL
   - Returns `SchemaData { detected, ormType, entities[], parseWarnings[] }`
3. **Diagram generation** (Step 3.5): `bin/scan-diagrams.js` generates 6 Mermaid diagrams
   - Types: system-architecture, app-architecture, workflow, data-flow, sequence, database-schema
   - Renderer chain: mmdc (CLI) → d2 (CLI) → placeholder HTML
4. **HTML report generation** (Step 8): `bin/scan-report.js` produces self-contained HTML
   - Sidebar navigation with scrollspy, metric cards, domain health bars
   - 6 diagram sections with expand-to-modal button
   - Tech debt table, key findings
   - Written to project root as `scan-report.html`
5. **Export** (optional `--export` flag): `bin/scan-export.js` handles docx/pdf (stubs in v2.34.10)

**No external dependencies**: HTML report is fully self-contained (no CDN). All CSS/JS inlined.

### npm Pre-Publish Gate (Updated)
- **Trigger**: `npm publish` (via `prepublishOnly`)
- **Gate**: `npm test` runs 205 tests (8 files including verify-gates.js)
- **Verify-gates checks**: file size compliance (all bin/*.js ≤ 200 lines), no CDN references in scan-report.html, has DOCTYPE, has 6 diagram sections, export format validation

---

## M61+ Native Workflow Journeys

### Execute Workflow (gsd-t-execute.workflow.js)

The execute phase is the primary code-change delivery mechanism. Entry is via `/gsd-t-execute` or as a sub-workflow of `/gsd-t-wave`.

**Args**: `{ milestone, domains: [...], projectDir? }`

**Phases and flow**:
1. **Preflight** - `lib.runPreflight({ projectDir })` runs `gsd-t preflight --json`. Hard-fail on any severity:"error" check (wrong branch, occupied required port). Non-error checks record but do not block.
2. **Disjointness** - `lib.proveFileDisjointness({ projectDir, domains })` calls `gsd-t parallel --dry-run --domain D1 --domain D2...` scoped to the requested domain set. If any two domains claim the same file, returns `ok=false` and the workflow halts before spawning any workers.
3. **Domains (parallel)** - For each domain in `args.domains`, an `agent("sonnet")` worker is spawned concurrently. Each worker:
   - Generates a per-domain brief via `lib.generateBrief({ kind:"execute", milestone, domain })`
   - Reads its `scope.md` (owned files) and `tasks.md` (work to do) via `lib.readScope()` / `lib.readDomainTasks()`
   - Executes every task listed under `## Tasks`, touching only files in its owned scope
   - Makes git commits per completed task or task group
   - Updates affected docs (progress.md Decision Log, architecture.md, contracts/, requirements.md) in the same commits
   - Returns a schema-validated `DOMAIN_RESULT_SCHEMA` object: `{ domain, status, filesTouched, tasksDone, tasksBlocked, notes }`
   - If any domain returns `status:"failed"`, the workflow halts before integrate
4. **Integrate** - A single `agent("sonnet")` receives all domain results and performs cross-domain wire-up: resolves shared-file edits sequenced at integrate, updates cross-domain contracts, runs interleaved-touch resolution. Returns `{ status:"green"|"warnings"|"failed", crossDomainEdits, notes }`.
5. **Verify-Gate** - `lib.runVerifyGate({ projectDir })` runs `gsd-t verify-gate --json`. Runs Track 1 (preflight envelope) + Track 2 (parallel-CLI: tsc, biome/ruff, npm test, knip, gitleaks, scc/lizard) deterministically.

**Exit**: Returns `{ status:"complete"|"verify-failed"|"failed", milestone, domainResults, integrate, verifyGate }`.

**Failure paths**:
- Missing `milestone` arg: returns `{ status:"failed", reason:"missing-milestone" }`
- Empty `domains` arg: returns `{ status:"failed", reason:"no-domains" }`
- Preflight error: returns `{ status:"failed", reason:"preflight-failed", preflight: envelope }`
- Non-disjoint domains: returns `{ status:"failed", reason:"non-disjoint" }`
- Any domain worker throws/fails: integrate is skipped, returns `{ status:"failed", reason:"domain-failed" }`
- Integrate agent fails: verify-gate is skipped, returns `{ status:"failed", reason:"integrate-failed" }`

---

### Verify Workflow (gsd-t-verify.workflow.js)

The verify phase enforces quality gates before milestone promotion. Entry is via `/gsd-t-verify` or as a sub-workflow of `/gsd-t-wave`.

**Args**: `{ milestone, projectDir?, skipUltra?: false, skipUltraReason?: string }`

Note: `skipUltra=true` requires `skipUltraReason` (per orthogonal-validation-contract.md Rule #2) and makes the workflow INELIGIBLE for a `VERIFIED` verdict (best case is `VERIFIED-WITH-WARNINGS`).

**Phases and flow**:
1. **Preflight** - `lib.runPreflight()` + `lib.generateBrief({ kind:"verify", milestone })`. Hard-fails on preflight errors.
2. **Verify-Gate** - `lib.runVerifyGate({ projectDir })` runs Track 1 + Track 2. If not ok, halts immediately with `{ status:"verify-gate-failed", overallVerdict:"VERIFY-FAILED" }`. Track 2 currently runs via `_runJsonCli` (a `spawnSync` helper that invokes the project-local or global `gsd-t` CLI). Known migration debt: this uses `require()` / `child_process` which are sandbox-banned in native Workflows (see findings).
3. **CI-Parity (M57 - FAIL-blocking)** - Runs `gsd-t build-coverage --json` then `gsd-t ci-parity --json`. Both must exit 0 or the workflow halts with `{ status:"ci-parity-failed", overallVerdict:"VERIFY-FAILED" }`. Origin: TimeTracking v1.10.12 shipped VERIFIED with a new dir absent from the Dockerfile COPY.
4. **Test-Data Purge (M58 - FAIL-blocking)** - Runs `gsd-t test-data --purge --run {verifyRunId} --json`. Purges all ledger rows for this run via registered adapters. If any adapter throws, halts with `{ status:"test-data-purge-failed", overallVerdict:"VERIFY-FAILED" }`. Origin: GSD-T-Board v0.1.10 shipped with 2442 E2E_TEST_* orphans in production data.
5. **Orthogonal Triad (parallel)** - Three independent validators run concurrently (or two if `skipUltra=true`):
   - **code-review ultra** (opus): cooperative correctness + cleanup pass. Severity: `important`, `nit`, `pre-existing`. Skippable via `skipUltra=true` + `skipUltraReason`.
   - **Red Team** (opus): adversarial / security / boundaries. Non-skippable. Verdict: `FAIL` (any CRITICAL or HIGH bug) or `GRUDGING-PASS` (nothing found after exhaustive search). Uses `templates/prompts/red-team-subagent.md` protocol.
   - **QA** (sonnet): test execution + shallow-test detection + contract compliance. Non-skippable. Uses `templates/prompts/qa-subagent.md` protocol.
6. **Synthesis** (opus): Merges triad results WITHOUT collapsing categories. Computes `overallVerdict`:
   - `VERIFIED`: Red Team GRUDGING-PASS + QA suite all-pass + no shallow tests + contracts compliant + code-review ultra ran with no "important" findings
   - `VERIFIED-WITH-WARNINGS`: Red Team GRUDGING-PASS, QA green, contracts compliant, but code-review ultra has "important" findings OR skipUltra=true OR 1 non-core shallow test
   - `VERIFY-FAILED`: Red Team FAIL, QA fail > 0, contract violations, or >= 2 shallow tests in core paths
   - Note: there is no programmatic invariant enforcing Red Team FAIL -> VERIFY-FAILED; the synthesis agent is the sole arbiter (see findings).

**Exit**: Returns `{ status:"complete"|"failed", overallVerdict, verifyGate, buildCoverage, ciParity, testDataPurge, triad, verdict }`.

---

### Wave Workflow (gsd-t-wave.workflow.js)

Wave composes execute and verify as two sequential sub-workflows. It does NOT run partition, plan, discuss, or impact - those must be run before invoking wave.

**Args**: `{ milestone, domains: [...], projectDir?, autoIntegrate? }`

**Flow**:
1. **Execute phase** - Calls `workflow("gsd-t-execute", { milestone, domains, projectDir })`. If execute does not return `status:"complete"`, wave halts and returns `{ status: execResult.status, stage:"execute", execResult }`.
2. **Verify phase** - Calls `workflow("gsd-t-verify", { milestone, projectDir })`. Returns the combined result.

**Exit**: Returns `{ status:"complete"|"verify-failed", milestone, execResult, verifyResult }`.

---

### Quick Workflow (gsd-t-quick.workflow.js)

Fast single-task execution with contract awareness. Entry via `/gsd-t-quick`.

**Args**: `{ task, projectDir?, model? }`

**Flow**:
1. **Preflight** - `lib.runPreflight()` + `lib.generateBrief({ kind:"execute" })`.
2. **Execute** - Single `agent()` (default sonnet) receives the task description, brief path, and CLAUDE.md constraints. Returns `{ status, filesEdited, summary }`.
3. **Verify** - `lib.runVerifyGate()` runs Track 1 + Track 2.

If the task agent returns `status:"failed"` or `status:"blocked"`, verify is skipped.

Known issue: commit prefix is hardcoded as `"m61(quick)"` regardless of the active milestone (see findings).

---

### Debug Workflow (gsd-t-debug.workflow.js)

Diagnose and fix a failing test or runtime error. Up to 2 fix cycles per CLAUDE.md Prime Rule. Entry via `/gsd-t-debug`.

**Args**: `{ symptom, projectDir? }`

**Flow**:
1. **Preflight** - `lib.runPreflight()` + `lib.generateBrief({ kind:"execute" })`.
2. **Cycle 1** (opus) - Agent reads relevant code, forms a hypothesis, applies a fix, runs affected tests, reports. Returns `{ resolved, rootCause, filesEdited, testRunResult, nextStepsIfNotResolved }`.
   - If `resolved=true`, exits immediately with `{ status:"complete", cyclesUsed:1 }`.
3. **Cycle 2** (opus) - If cycle 1 did not resolve, cycle 2 agent receives the prior cycle's root cause hypothesis (to avoid repeating the same wrong fix). Returns same schema.
   - If `resolved=true`, exits with `{ status:"complete", cyclesUsed:2 }`.
4. If both cycles fail: returns `{ status:"needs-human", cyclesUsed:2, nextSteps }`. This signals the caller to escalate.

Known issue: commit prefix is hardcoded as `"m61(debug-cycle${cycle})"` regardless of the active milestone.

---

### Integrate Workflow (gsd-t-integrate.workflow.js)

Cross-domain integration after parallel workers complete. Can be invoked standalone between execute and verify when execute's built-in integrate barrier is insufficient. Entry via `/gsd-t-integrate`.

**Args**: `{ milestone, domains: [...], projectDir? }`

**Flow**:
1. **Preflight** - `lib.runPreflight()` + `lib.generateBrief({ kind:"execute", milestone })`.
2. **Integrate** (sonnet) - Agent reads `.gsd-t/contracts/{milestone}-integration-points.md` (if present), resolves cross-domain shared-file edits per the "Cross-Domain File Contention Matrix", updates cross-domain contracts, makes commits. Returns `{ status:"green"|"warnings"|"failed", crossDomainEdits, notes }`.
3. **Verify-Gate** - `lib.runVerifyGate()` runs quick sanity check.

Known issue: commit prefix is hardcoded as `"m61(integrate)"` regardless of the active milestone.

---

### Phase Workflow (gsd-t-phase.workflow.js)

Generic upper-stage phase runner covering partition, plan, discuss, impact, milestone, prd, design-decompose, doc-ripple. Entry via the corresponding slash command.

**Args**: `{ phase, milestone?, projectDir?, userInput? }`

Valid phases: `partition | plan | discuss | impact | milestone | prd | design-decompose | doc-ripple`

**Flow**:
1. **Preflight** - `lib.runPreflight()` + `lib.generateBrief({ kind: phaseName, milestone })`.
2. **Phase** (opus) - Single agent receives a phase-specific objective prompt:
   - `partition`: Decompose milestone into 2-5 independent domains; write `.gsd-t/domains/{domain}/{scope,constraints,tasks}.md`; cross-domain contracts in `.gsd-t/contracts/`.
   - `plan`: Write atomic `tasks.md` entries per domain with files, contract refs, dependencies, acceptance criteria; update `.gsd-t/contracts/integration-points.md`.
   - `discuss`: Multi-perspective design exploration; settle locked decisions into `.gsd-t/CONTEXT.md`; do NOT implement.
   - `impact`: Analyze downstream effects; identify breaking changes, affected consumers, migration paths.
   - `milestone`: Define a new milestone - origin, goal, success criteria, falsifiable acceptance; append to `.gsd-t/progress.md`.
   - `prd`: Generate `docs/prd.md` with functional + non-functional requirements traceable to acceptance criteria.
   - `design-decompose`: Decompose a design reference (Figma URL / images) into hierarchical contracts: elements -> widgets -> pages at `.gsd-t/contracts/design/`.
   - `doc-ripple`: Identify and update all docs affected by recent code changes per the Document Ripple Completion Gate. No code edits.

Known issue: commit prefix is hardcoded as `"m61({phaseName})"` regardless of the active milestone.

---

### Deep Scan Workflow (gsd-t-scan.workflow.js)

Volume-driven codebase analysis that fans out per-slice finder + verifier agents, then synthesizes findings into a tech-debt register + living documents. This is the ONLY workflow fully migrated to the M71 runtime-native sandbox (no `require()`). Entry via `/gsd-t-scan`.

**Args**: `{ projectDir?, scanNumber?, verify?: "single"|"none", maxSlicesHint? }`

Note: `args` is a JSON STRING in the native Workflow sandbox - the workflow parses it via `JSON.parse(args)` before use.

**Phases and flow**:

1. **Preflight** (haiku) - Bash agent checks current git branch, whether `.gsd-t/techdebt.md` exists (`priorRegisterExists`), and if so, the highest `TD-NNN` number in it (`priorMaxTd`). TD numbering for this scan starts at `priorMaxTd + 1`. Returns `{ ok, branch, priorRegisterExists, priorMaxTd }`.

2. **Probe** (sonnet) - Volume probe agent measures the codebase (file counts, LOC, routes, tables, components, feature domains via Bash/Grep/Read), then decomposes it into COHESIVE SLICES. A slice is one logical sub-domain - smaller than a domain, larger than a single file. The probe should produce as many slices as the codebase has cohesive agent-sized responsibilities.
   - After the probe returns, a volume-derived backstop cap is computed: `computeSliceCap(totals)` = `f(sqrt(files), domains, routes, tables, components, sqrt(loc))`, capped at 3..50.
   - If the probe over-slices (returns more slices than the cap), excess slices are dropped and a warning is logged.

3. **Deep Scan** (pipeline per slice) - All slices run concurrently via a shared 10-permit adaptive semaphore (`MAX_CONCURRENT=10`, floor `MIN_CONCURRENT=4`):
   - Per slice, a **finder** (sonnet) reads every file under the slice's owned paths and reports CRITICAL/HIGH/MEDIUM/LOW findings. Up to 2 retry attempts per slice; a null result after both attempts flags `failed:true`.
   - For each finding returned, a **verifier** (sonnet) opens the referenced files and confirms whether the defect genuinely exists. False positives are discarded; corrected severities are applied.
   - A slice that fails both finder attempts is flagged as a coverage gap (PARTIAL coverage) and included in `failedSlices[]`.
   - Rate limits: if an agent call throws a rate-limit error, the semaphore ceiling lowers by 1 (floor MIN_CONCURRENT) and the call is retried up to 4 times with 2-4-6s backoff. After 8 consecutive clean completions, the ceiling rises by 1.

4. **Synthesis**:
   - **Dedup** (opus, bounded): A compact title+location list of all findings (not the full objects) is sent to a dedup agent which returns merge groups (arrays of indices that represent the same underlying issue). On agent failure, synthesis proceeds with no dedup.
   - **Deterministic merge + sort**: The orchestrator body (no agent) merges duplicate groups, sorts findings by severity (CRITICAL first), and assigns sequential TD-NNN numbers starting at `tdStart`.
   - **Archive** (haiku): If a prior register exists, it is renamed from `techdebt.md` to `techdebt_{today}.md` via `git mv` (or `mv` if not a git repo).
   - **Write register** (haiku): The formatted register markdown is split into chunks of <= 30KB each. Chunk 0 creates the file (Write tool); subsequent chunks append via bash heredoc. The chunked write approach prevents the M75 stall that occurred when a single agent was asked to type a 466KB file.

5. **Document** (parallel, sonnet) - Fan-out to 10 document agents, each writing one file:
   - `.gsd-t/scan/architecture.md` - stack, structure, components, data flow
   - `.gsd-t/scan/security.md` - security findings as `### SEC-H<n>:` / `### SEC-M<n>:` sections
   - `.gsd-t/scan/quality.md` - quality/dead-code/test-gap findings as `### DC-<n>:` / `### TCG-<n>:` sections
   - `.gsd-t/scan/business-rules.md` - embedded business logic (validation, auth, state machines, pricing)
   - `.gsd-t/scan/contract-drift.md` - compare `.gsd-t/contracts/` to implementation
   - `docs/architecture.md` - MERGE (Edit tool): system overview, components, data flow, design decisions
   - `docs/workflows.md` - MERGE (Edit tool): user journeys per slice, technical/integration workflows
   - `docs/infrastructure.md` - MERGE (Edit tool): commands, dev setup, DB commands, deployment
   - `docs/requirements.md` - MERGE (Edit tool): functional + technical + non-functional requirements
   - `README.md` - MERGE (Edit tool): project overview, stack, getting started
   - If a file has real content, agents MUST use Edit (targeted section edits), not Write (which destroys unrecreated content).

6. **Plain-English** (batched sonnet + haiku writes) - Generates a non-technical companion file `.gsd-t/techdebt_in_plain_english.md` with one entry per TD item. To avoid the M75 stall, findings are batched into groups of 36 and sent to parallel generator agents (each returns `{ entries: [{td, markdown}] }`). Entries are then assembled deterministically by severity group and chunk-written (haiku, <= 30KB per chunk).

7. **Commit** (haiku) - After document phase, a single git agent stages `.gsd-t/scan`, `.gsd-t/techdebt_in_plain_english.md`, `docs`, and `README.md` and commits them.

Note: The HTML render stage was removed in M71. The renderer resolved paths relative to the package dir (not projectDir), causing it to overwrite the package's own `scan-report.html`. The authoritative deliverables are the register, dimension files, plain-english file, and living docs.

**Exit**: Returns `{ status:"complete"|"complete-partial-coverage", coverageComplete, slicesTotal, slicesSucceeded, slicesFailed, findings, counts, tdRange, docsWritten }`.

---

### Verify-Gate Technical Workflow

The verify-gate runs as a deterministic subroutine inside every workflow that calls `lib.runVerifyGate()`. It uses `bin/gsd-t-verify-gate.cjs`.

**Two-track structure**:
- **Track 1** (D1 preflight envelope): runs `bin/cli-preflight.cjs::runPreflight()`. Hard-fails on any `severity:"error"` check.
- **Track 2** (D2 parallel-CLI substrate): fans out CLI checks via `bin/parallel-cli.cjs::runParallel()`. Default workers: `tsc`, `biome`/`ruff` (lint), `npm test` (unit suite), `knip` (dead code), `gitleaks` (secrets), `scc`/`lizard` (complexity). Concurrency capped by `.gsd-t/ratelimit-map.json` (default fallback: 2).

**Result envelope**: `{ ok, schemaVersion, runId, track1, track2, summary }`. Summary is capped at 500 tokens (2000 chars) and is the input consumed by `bin/gsd-t-verify-gate-judge.cjs`.

**Known correctness issue**: When `runParallel` throws an exception, the catch block constructs `{ ok:false, results:[] }`. Inside `_shapeTrack2`, `[].every(...)` is vacuously true in JavaScript, so `track2Ok` becomes `true` even though the entire track failed. This causes a false PASS verdict when all CLI tools failed to run.

**Known test gap**: `playwright.config.mjs` is not detected by `_detectDefaultTrack2()`, so ESM playwright configs silently skip E2E in Track 2.

---

### Test-Data Ledger Workflow (M58)

When E2E tests insert data into project stores, they must register those inserts via the test-data ledger so Verify can purge them.

**Test-side flow (withTestData Playwright fixture)**:
1. Test extends base `@playwright/test` with `withTestData()` fixture
2. `testData.tag('E2E_DRAG')` generates a unique id: `"E2E_DRAG_{runId}_{counter}"`
3. `testData.register({ kind, store, id, taggedPrefix })` calls `appendInsert()` in `bin/gsd-t-test-data-ledger.cjs`, appending one JSONL row to `.gsd-t/test-data-ledger.jsonl`
4. The adapter's `id` must start with `taggedPrefix` - a mismatch throws (defense in depth)

**Purge flow (gsd-t-verify Step M58 gate)**:
1. `gsd-t test-data --purge --run {verifyRunId} --json` is called
2. Ledger reads all rows matching `runId`, groups by adapter `kind`
3. Three built-in adapters: `localStorage-key-prefix` (browser localStorage), `file-json-array` (JSON array files), `sqlite-table-where` (SQLite table rows)
4. Each adapter re-validates that `id` starts with `taggedPrefix` before deleting (defense in depth - never trust upstream alone)
5. If any adapter throws or refuses, verify gate FAILs (block-promotion semantics)

---

### Parallel Task Planning Workflow

The `gsd-t parallel` CLI and `bin/gsd-t-parallel.cjs` are used by `lib.proveFileDisjointness()` inside execute to validate file ownership before spawning domain workers.

**Gates applied in order**:
1. **D4 depgraph** - `validateDepGraph()` vets each ready task's dependency IDs against the task graph. Tasks with unmet dependencies are vetoed and appended as `dep_gate_veto` events.
2. **D5 disjointness** - `proveDisjointness()` checks that no two ready tasks claim the same output file. Overlap -> sequential fallback, appended as `disjointness_fallback` events.
3. **D6 economics** - `estimateTaskFootprint()` estimates per-task CW% (currently a M61 stub returning zeros; unattended split gate is permanently non-functional).

**Mode-aware gating**:
- `in-session`: `ctxPct + workerCount * summarySize <= 85%`. If exceeded, reduces N by 1 until it fits; floor is N=1 (never refuses).
- `unattended`: `estimatedCwPct > 60%` emits a `task_split` signal. Currently non-functional because the M61 stub always returns `estimatedCwPct=undefined`.

**Known critical issue**: `parseArgv` has only one `domain` slot - multiple `--domain` flags overwrite each other. The disjointness check therefore only evaluates the last domain's tasks, silently passing when earlier domains share files. This means the primary safety invariant (no two concurrent workers write the same file) is bypassed for multi-domain executions.

---

### Heartbeat Event Logging (Updated)

The heartbeat system now also writes to the event stream for dashboard consumption.

**Flow**:
1. Claude Code hook fires (9 events: SessionStart, PostToolUse, SubagentStart, SubagentStop, TaskCompleted, TeammateIdle, Notification, Stop, SessionEnd)
2. `settings.json` hook calls `node ~/.claude/scripts/gsd-t-heartbeat.js`
3. Script reads JSON from stdin (capped at 1MB)
4. Validates `session_id` (alphanumeric regex `SAFE_SID=/^[a-zA-Z0-9_-]+$/`) - blocks path traversal
5. Validates `cwd` is absolute and `.gsd-t/` directory exists
6. Verifies resolved heartbeat file path is still within `.gsd-t/` (symlink-safe containment check)
7. Appends structured event to `.gsd-t/heartbeat-{session_id}.jsonl`
8. Also calls `buildEventStreamEntry(hook)` and appends to `.gsd-t/events/YYYY-MM-DD.jsonl` (enriched event stream for dashboard + stream-feed-server)
9. On SessionStart: runs `cleanupOldHeartbeats()` removing files older than 7 days

---

### Stream Feed Server Workflow

The stream-feed server (`scripts/gsd-t-stream-feed-server.js`) is a loopback-only HTTP + WebSocket server that ingests stream-json frames from worker processes and broadcasts to connected dashboard clients.

**Ingest flow (POST /ingest)**:
1. Worker (claude -p subprocess) sends a chunked POST to `http://127.0.0.1:{port}/ingest`
2. Server accumulates body in `buf` string, splitting on newlines as frames arrive
3. Each newline-delimited frame is validated as JSON, then `persistFrame()` appends it to `.gsd-t/stream-feed/YYYY-MM-DD.jsonl`
4. At UTC midnight, `rotateIfNeeded()` opens a new daily file and resets the frame count
5. Known issue: no size limit on `buf` - a slow sender that never emits newline can grow the buffer to OOM

**Broadcast flow (GET /feed WebSocket)**:
1. Client sends a WebSocket upgrade request to `/feed?from=N` (replay from frame N)
2. Server performs RFC 6455 handshake (Sec-WebSocket-Accept header) and upgrades the connection
3. On upgrade, server replays frames from `recentFrames` buffer (in-memory mirror of today's JSONL, up to 10,000 frames) from index N
4. Each new ingested frame is broadcast as a WebSocket text frame to all connected clients
5. Clients that exceed the `BACKPRESSURE_LIMIT` (1000 buffered frames) are kicked via a close frame
6. Known issue: `encodeWsCloseFrame` writes `body.length` directly into the header byte, violating RFC 6455 (control frames max 125 bytes). Strict clients may reject malformed close frames.

**Port**: Default `7842` (overridden via `GSD_T_STREAM_FEED_PORT` env var).

---

### Auto-Update Workflow (Updated)

**Trigger**: Claude Code `SessionStart` hook via `scripts/gsd-t-update-check.js`.

**Flow**:
1. Reads installed version from `~/.claude/.gsd-t-version`
2. Reads cached npm latest from `~/.claude/.gsd-t-update-check` (JSON: `{ latest, timestamp }`)
3. If cache is fresh (< 1 hour): compares cached `latest` vs `installed`
4. If cache is stale (> 1 hour): calls `fetchLatestVersion()` which runs a Node inline script that GETs `https://registry.npmjs.org/@tekyzinc/gsd-t/latest` (5s timeout, 8s execFileSync timeout)
5. Known bug: the inline script has a syntax error at `r.on('data',(c)=>d+=c;` (missing `)`) - `fetchLatestVersion()` always returns `null`; auto-update from SessionStart is completely broken
6. If an update is available and fetchLatestVersion worked: runs `npm install -g @tekyzinc/gsd-t@{latest}` + `gsd-t update-all`; outputs `[GSD-T AUTO-UPDATE] v{old} -> v{new}` to stdout
7. Claude agent reads the hook output from context and shows the update status in the first response banner

**Output signals** (read from Claude Code hook context):
- `[GSD-T AUTO-UPDATE]`: auto-update ran successfully
- `[GSD-T UPDATE]`: update available but auto-update failed
- `[GSD-T] v{ver}`: current, no update needed

**Cache TTL**: 1 hour.

---

### Context Brief Generation Workflow

Context briefs are generated per Workflow spawn to give worker agents a compact snapshot of the project state without requiring them to re-walk the entire repo.

**Entry**: `lib.generateBrief({ kind, milestone, domain, projectDir })` in `_lib.js`, which calls `bin/gsd-t-context-brief.cjs::generateBrief()`.

**Flow**:
1. Loads the kind-specific collector from `bin/gsd-t-context-brief-kinds/{kind}.cjs`
2. Known kinds (11): `design-verify`, `discuss`, `execute`, `impact`, `milestone`, `partition`, `plan`, `qa`, `red-team`, `scan`, `verify`
3. Collector runs synchronously (no LLM spawn) using read-only filesystem + git commands
4. Output is a JSON brief envelope (max 10240 bytes), written to `.gsd-t/briefs/{kind}-{spawnId}.json` (gitignored - ephemera, not committed)
5. `FAIL_CLOSED_KINDS = ['qa', 'red-team', 'design-verify']` - errors in these collectors throw rather than returning partial data
6. Other kinds fail-open: if the collector throws, the brief is empty and the worker falls back to re-walking the repo

**Workers use briefs by**: reading `$BRIEF_PATH` before grepping/reading the codebase. Per Brief-First Worker Rule: "if you're about to grep, check the brief first."

---

### Decision Log Archive Workflow

To keep `.gsd-t/progress.md` lean, old Decision Log entries are rolled into archive files via `bin/archive-progress.cjs`.

**Entry**: `node bin/archive-progress.cjs [--project DIR] [--keep N] [--per-archive N] [--dry-run]`

**Flow**:
1. Reads `progress.md` and finds the Decision Log section (heading containing "Decision Log" at any ATX level)
2. Parses entries by start pattern `/^- (\d{4}-\d{2}-\d{2})(?:[ T]\d{2}:\d{2})?/`
3. Keeps the most recent `keepLive` entries (default 5) in the live `progress.md`
4. Remaining older entries are appended to numbered archive files at `.gsd-t/progress-archive/NNN-YYYY-MM-DD.md` (up to `perArchive` entries per file, default 20)
5. Idempotent: running with no new entries is a no-op; running repeatedly does not re-archive already-archived entries
