# Business Rules -- GSD-T Framework

Scan date: 2026-06-04
Slices covered: all 17 feature/architecture/data-layer slices

---

## 1. Validation Rules

### 1.1 Task Status Validation
**Where:** `bin/gsd-t-depgraph-validate.cjs:119-125`
A task is "ready to spawn" only when ALL of its declared deps have `status === 'done'`. Deps with status `pending`, `skipped`, `failed`, or referencing an unknown id are all treated as unmet. There is no partial-completion bypass. A task with zero deps is always ready.

Assessment: correct and well-enforced by tests (test/m44-depgraph-validate.test.js).

### 1.2 Task Status Marker Map
**Where:** `bin/gsd-t-task-graph.cjs:38-44`
The markdown checkbox character directly encodes status:
- ` ` (space) = pending
- `x` or `X` = done
- `-` = skipped
- `!` = failed

Any other character in the checkbox bracket is treated as pending. No other status values are accepted from markdown source.

Assessment: sound. The STATUS_MAP is exhaustive for the four valid task states.

### 1.3 Metrics Record Validation
**Where:** `bin/metrics-collector.js:83-101`
Every task-metrics record must supply all 12 required fields: milestone, domain, task, command, duration_s, tokens_used, context_pct, pass, fix_cycles, signal_type, plus derived ts and signal_weight. Validation rules:
- `signal_type` must be one of: pass-through, fix-cycle, debug-invoked, user-correction, phase-skip (enforced against VALID_SIGNAL_TYPES set)
- `duration_s`: non-negative number
- `context_pct`: 0-100 inclusive
- `fix_cycles`: >= 0

Missing or null required fields cause a thrown Error with the field name. Invalid signal_type causes an explicit error message.

Assessment: correct. Callers that skip validation get a thrown error, so no silent corruption is possible.

### 1.4 Pre-flight Severity Gate
**Where:** `bin/cli-preflight.cjs:60`
The overall `ok` flag is false if and only if at least one check has `ok === false` AND `severity === 'error'`. Checks with `severity === 'warn'` or `severity === 'info'` that fail do NOT set `ok = false`. Hard-fail checks: `branch-guard` (wrong git branch), `ports-free` (required port occupied). Warn checks: `contracts-stable` (DRAFT contracts past PARTITIONED). Info checks: `manifest-fresh` (journey manifest stale).

Assessment: correct. The severity taxonomy matches the contract.

### 1.5 Test Data Tag Prefix Enforcement
**Where:** `bin/gsd-t-test-data-ledger.cjs:61-63`, `bin/gsd-t-test-data-adapters/localstorage-key-prefix.cjs:30-32`, `bin/gsd-t-test-data-adapters/sqlite-table-where.cjs:59-61`
At insertion time: `id` must start with `taggedPrefix` (enforced by ledger appendInsert with a thrown Error on mismatch). At purge time: each adapter independently re-checks that `id.startsWith(taggedPrefix)` before any destructive operation. An empty or omitted `taggedPrefix` is explicitly rejected with a thrown Error (the guard cannot be disabled). This is defense-in-depth: two independent checks, one in the ledger (input gate) and one in each adapter (execution gate).

Assessment: correct. Red Team verified this pattern caught injection attempts (M60).

### 1.6 SQLite Identifier Allowlist
**Where:** `bin/gsd-t-test-data-adapters/sqlite-table-where.cjs:16,43-46`
Table and column names extracted from the store string are validated against `/^[A-Za-z_][A-Za-z0-9_]*$/` before being interpolated into the SQL DELETE statement. A name that fails this check causes a thrown Error. Values (the `id` field) are bound as SQL parameters, not interpolated. The `dbPath` is also checked for containment within `projectDir` before any file access.

Assessment: correct. SQL identifier validation + parameterized values = no SQL injection surface.

### 1.7 Verify-Gate Track 2 OK Rule
**Where:** `bin/gsd-t-verify-gate.cjs:164`
`ok = (skipTrack1 || track1.ok) && (skipTrack2 || track2.ok)`. Both tracks must pass unless their respective skip flags are explicitly set. The skip flags are diagnostic-only; their use makes the run ineligible for VERIFIED status (enforced by the Workflow synthesis stage).

Assessment: correct in isolation. 🔴 Critical defect: when `runParallel` throws and returns `results:[]`, `_shapeTrack2` returns `track2.ok = true` via vacuous `[].every()` even though `envelope.ok = false`. This means a crashing parallel substrate produces a false PASS. The core formula is sound but the track2 shaping has a gap.

### 1.8 Port Validation in ports-free Check
**Where:** `bin/cli-preflight-checks/ports-free.cjs:40-43`
Ports from config are coerced to numbers and filtered: `Number.isInteger(p) && p > 0 && p < 65536`. Non-integer values, zero, and out-of-range ports are silently dropped. If the config is absent or unreadable, the check is a noop pass.

Assessment: correct. Fail-closed: if lsof fails for any reason other than "no listener found" (exit 1), the check reports FAIL rather than passing.

### 1.9 Path Containment Guards
**Where:** `bin/gsd-t-test-data-adapters/sqlite-table-where.cjs:17-28`
The predicate is: `resolved.startsWith(root + path.sep) && resolved !== root`. This correctly rejects paths equal to projectDir itself and paths outside it. The same pattern is documented as the canonical form in `memory:feedback_destructive_path_ops_containment.md`.

Assessment: correct. Note that `localstorage-key-prefix.cjs` has no path containment check (it operates on browser localStorage, not the filesystem), which is appropriate.

---

## 2. Authorization and Access Control Rules

### 2.1 Headless Spawn Requires --dangerously-skip-permissions
**Where:** `bin/gsd-t.js:3653` (doHeadlessExec, correct), `bin/gsd-t.js:3948` (spawnClaudeSession, MISSING)
All headless `claude -p` spawns must include `--dangerously-skip-permissions`. doHeadlessExec does this correctly. spawnClaudeSession (used by debug-loop and runLedgerCompaction) does NOT include this flag, causing the child to exit on first tool use.

Assessment: 🔴 defect (HIGH finding). The missing flag makes debug-loop completely non-functional.

### 2.2 Neo4j Credential Policy
**Where:** `bin/gsd-t.js:1312,1350,2930`
The Neo4j password is hardcoded as `gsdt-graph-2026` in three places. Docker container is created with `--restart unless-stopped` (persists across reboots). No credential rotation or per-install randomization.

Assessment: 🔴 defect (HIGH finding). Shared known credential on a network-accessible port. Should be per-install random.

### 2.3 agentId Path Containment
**Where:** `scripts/gsd-t-watch-state.js:153`
`agentId` from CLI arg or env var is concatenated into a file path with no containment check. `path.join` normalizes `..` segments, enabling path traversal writes.

Assessment: 🔴 defect (HIGH finding). Attacker-controlled writes outside the .gsd-t/.watch-state/ directory.

### 2.4 Cypher Query Authorization
**Where:** `bin/graph-cgc.js:493-496`
The 'cypher' dispatch case passes `params.query` directly to Neo4j with no sanitization or allowlist. The 'findCircularDeps' case interpolates `params.maxDepth` into a Cypher string template without validating it is a safe integer.

Assessment: 🔴 defect (HIGH finding). Arbitrary Cypher execution and potential query injection.

### 2.5 Design Review Item ID Sanitization
**Where:** `scripts/gsd-t-design-review-server.js:329,357,419,820`
`item.id` values from queue JSON are used directly in `path.join()` calls. A malicious id like `../../.bashrc` would write outside the review directory.

Assessment: 🔴 defect (HIGH finding). Path traversal on local filesystem.

### 2.6 grep Fallback SAFE_ENTITY_RE
**Where:** `bin/graph-query.js:302`
`SAFE_ENTITY_RE = /^[\w.\-/\\:]+$/` allows `/` and `..` sequences, enabling path traversal in grep calls. Entity names containing `.` (common in JS: `foo.bar`) are passed as regex patterns where `.` means "any character."

Assessment: 🔴 defect (HIGH finding). Should use `--fixed-strings` and reject path separator characters.

---

## 3. Workflow and State Machine Rules

### 3.1 Patch Lifecycle State Machine
**Where:** `bin/patch-lifecycle.js`
Five-stage state machine: candidate -> applied -> measured -> promoted -> graduated (or deprecated at any stage).
- `applyPatch`: only transitions if status is exactly `'candidate'`; reads template from rule-engine
- `recordMeasurement`: only operates on `'applied'` or `'measured'` patches; transitions to `'measured'` after first call
- `promote`: only operates on `'measured'`; no intermediate state check
- `graduate`: only operates on `'promoted'`; requires `measured_milestones.length >= 3`
- `deprecate`: operates on any status
- State transitions are one-directional; there is no rollback function

Assessment: state machine logic is sound but has three embedded defects:
- Graduation is permanently unreachable because `recordMeasurement` stops updating promoted patches (status check at line 68 excludes `'promoted'`), so `measured_milestones` cannot grow after promotion (HIGH finding).
- `improvement_pct` treats all metrics as "higher is better." `fix_cycles` (lower is better) produces negative improvement when the patch works, blocking promotion (HIGH finding).
- `applyPatch` and `recordMeasurement` are never called from any production workflow (HIGH finding).

### 3.2 Rule Engine Evaluation and Lifecycle
**Where:** `bin/rule-engine.js`
Rules have status `'active'` or `'consolidated'`. Only active rules are evaluated. Evaluation scope:
- `scope: 'domain'` (default): records filtered to the queried domain
- `scope: 'milestone'`: records filtered to the current milestone
- `scope: 'global'`: all records, unfiltered

Window (`trigger.window > 0`) slices records to the N most recent. Operators: gt, gte, lt, lte, eq, neq, in, pattern_count.

Inactive rule detection (`flagInactiveRules`): a rule is flagged inactive if its `activation_count === 0` and the gap between its `milestone_created` number and the current maximum milestone number is >= the supplied threshold. This uses the highest milestone number seen across ALL rules as a proxy for "current milestone."

Assessment: sound for basic trigger evaluation. `pattern_count` operator counts non-null metric records without comparing values to threshold, which may be surprising (it counts occurrences of non-null fields, not values meeting a threshold). The milestone-number proxy for "current" is imprecise on sparse milestone numbering.

### 3.3 Universal Rule Promotion Thresholds
**Where:** `bin/global-sync-manager.js:28-29,93-94`
A rule becomes `is_universal = true` when `promotion_count >= 3` (UNIVERSAL_THRESHOLD). A rule becomes `is_npm_candidate = true` when `promotion_count >= 5` (NPM_CANDIDATE_THRESHOLD). Deduplication is by trigger fingerprint (JSON-serialized trigger object).

Assessment: thresholds are documented constants. The fingerprint approach is fragile (JSON.stringify key order depends on object construction order), but works in practice because rule objects are constructed programmatically with consistent key order.

### 3.4 Contract Status State Machine
**Where:** `bin/cli-preflight-checks/contracts-stable.cjs:26-50`
Contracts may have status DRAFT, PROPOSED, or STABLE. The pre-execute gate (contracts-stable preflight check, severity: warn) enforces that no contract has DRAFT or PROPOSED status when the project is in a post-PARTITIONED state. POST_PARTITIONED_STATES: ACTIVE, EXECUTING, EXECUTED, TEST-SYNCING, TEST-SYNCED, INTEGRATING, INTEGRATED, VERIFYING, VERIFIED, COMPLETED.

Assessment: 🟡 defect in detection. The regex `/^\s*Status\s*:/gim` does not match `## Status: ACTIVE` (the actual progress.md heading format). The `##` prefix is not matched by `^\s*`. The check is always a noop pass (MEDIUM finding from verified findings).

### 3.5 Task Graph Cycle Detection
**Where:** `bin/gsd-t-task-graph.cjs`
The task graph parser mandates cycle detection (documented as a hard rule). A `TaskGraphCycleError` is thrown with the cycle path when a dependency cycle is detected. This is a non-negotiable invariant -- the graph must be a DAG.

Assessment: required and enforced. Callers that catch this error must not proceed with execution.

### 3.6 Verify Phase Promotion Gate
**Where:** `bin/gsd-t-verify-gate.cjs`, `templates/workflows/gsd-t-verify.workflow.js`
Milestone promotion requires:
1. Track 1 (preflight) passes -- no error-severity check failures
2. Track 2 (CLI substrate: tsc, lint, tests, secrets, complexity, E2E) all pass
3. Orthogonal validation triad passes (code-review, Red Team, QA)
4. M57 CI-Parity gate passes
5. M58 Test-Data Purge completes without errors
6. Red Team verdict must not be `FAIL` (blocks regardless of other results)

Assessment: the layered gate design is correct. However: (a) Red Team FAIL does not have a programmatic invariant enforcing VERIFY-FAILED in the synthesis stage - it relies on the synthesis agent's prompt following (MEDIUM finding); (b) `playwright.config.mjs` extension is not detected in `_detectDefaultTrack2`, silently skipping E2E for ESM projects (MEDIUM finding).

---

## 4. Calculation Rules

### 4.1 Patch Improvement Percentage
**Where:** `bin/patch-lifecycle.js:73-75`

```
improvement_pct = (metricAfter - metricBefore) / Math.abs(metricBefore) * 100
```

Special case: if `metricBefore === 0`, then `improvement_pct = metricAfter > 0 ? 100 : 0`.

The promotion gate threshold is `improvement_pct > 55` (strictly greater than). Two milestones of measurement are required before promotion is considered.

Assessment: the formula is "higher is better" and is incorrect for `fix_cycles` (lower is better). A patch that reduced fix cycles from 5 to 2 produces improvement_pct = -60%, which fails the gate. A patch that increased fix cycles from 1 to 2 produces +100%, which passes (HIGH finding).

### 4.2 ELO Rating for Projects
**Where:** `bin/global-sync-manager.js:26-27`
Starting ELO: 1000. K-factor: 32. These are constants; the actual ELO update computation happens in `checkUniversalPromotion` and `getGlobalELO`. The ELO system is intended to rank projects by process quality across milestones.

Assessment: the constants are standard chess ELO parameters. However, the local `rollup.jsonl` file (needed for per-milestone ELO display) is never written by any production code, making the ELO feature non-functional (HIGH finding).

### 4.3 Signal Weights
**Where:** `bin/metrics-collector.js:17-23`
Signal type to weight mapping:
- `pass-through`: +1.0 (task completed cleanly)
- `phase-skip`: +0.3 (phase skipped with reason)
- `fix-cycle`: -0.5 (one or more fix cycles needed)
- `debug-invoked`: -0.8 (debug tool was needed)
- `user-correction`: -1.0 (user had to correct the output)

Weights are stored with each record as `signal_weight`. They are used downstream by the pre-flight warning system and ELO calculations.

Assessment: weights are reasonable for a process-quality signal. The scale is [-1, +1].

### 4.4 Pre-Flight Warning Thresholds
**Where:** `bin/metrics-collector.js:64-78`
Two threshold rules evaluated against the last 10 task records for a domain:
- First-pass rate < 60%: warn to "consider splitting tasks"
- Average fix cycles > 2.0: warn to "review constraints"

Window is hardcoded to 10 records. Both thresholds are hardcoded constants with no project-level override mechanism.

Assessment: reasonable heuristics. No mechanism to suppress false positives in domains with expected high fix cycles (experimental or research tasks).

### 4.5 In-Session Context Window Headroom Calculation
**Where:** `bin/gsd-t-parallel.cjs:59-77`
Formula: `ctxPct + workerCount * summarySize <= IN_SESSION_CW_CEILING_PCT` (ceiling = 85%).
Default summarySize: 4% per worker. If the formula fails, N is reduced by 1 until the formula holds or N = 1. N=1 (sequential) is always the final fallback; the function never refuses to run.

Assessment: the fallback-to-sequential guarantee is correct. The 4% default may underestimate context cost for opus-model workers processing large changesets.

### 4.6 Unattended Per-Worker Context Window Gate
**Where:** `bin/gsd-t-parallel.cjs:85-93`
Rule: if `estimatedCwPct > 60`, return `{ok:false, split:true}`. Otherwise `{ok:true, split:false}`. Threshold defaults to 60 but is configurable via `opts.threshold`.

Assessment: the gate logic is correct. However, `estimateTaskFootprint` always returns the M61 stub with `estimatedCwPct` undefined, so the gate always receives 0 and always passes (MEDIUM finding -- entire unattended split signal is dead code).

### 4.7 Summary Token Cap in Verify Gate
**Where:** `bin/gsd-t-verify-gate.cjs:61-63,35`
Default cap: 500 tokens. Approximation: 4 chars per token (TOKENS_PER_CHAR = 0.25). The cap is applied to the serialized summary object, truncating per-worker output snippets until total character count / 4 <= 500. Minimum snippet: 16 chars per side (32 chars total).

Assessment: the 4-char/token approximation is accurate for English prose. The minimum snippet floor ensures at least some context survives even at high compression.

---

## 5. Integration Rules (Retry, Fallback, Timeout)

### 5.1 SIGTERM/SIGKILL Escalation
**Where:** `bin/parallel-cli.cjs:338-346`
Worker termination: SIGTERM is sent first; after `SIGKILL_GRACE_MS` (5000 ms), SIGKILL is sent unconditionally. The SIGKILL timer uses `.unref()` so it does not prevent process exit. However, the timer handle is never stored in a variable visible to the close/error handlers, so `clearTimeout(killTimer)` at line 296 always clears null -- the SIGKILL fires even when the child already exited cleanly after SIGTERM.

Assessment: 🟡 defect (MEDIUM finding). Timers leak on clean SIGTERM exit. In practice the OS rejects SIGKILL to non-children with ESRCH, but the 5-second wait delays clean exit.

### 5.2 maxConcurrency Resolution with Fallback
**Where:** `bin/gsd-t-verify-gate.cjs:186-209`
Priority: (1) explicit `opts.maxConcurrency` value, (2) `recommended.peakConcurrency` from `.gsd-t/ratelimit-map.json`, (3) fallback to 2. The fallback is conservative (2 workers) to prevent rate-limit storms on missing config.

Assessment: correct. Notes are emitted when falling back, so the user can diagnose the reason.

### 5.3 git-History Touch-List Fallback
**Where:** `bin/gsd-t-file-disjointness.cjs:67-118`
Fallback resolution chain for file disjointness:
1. Explicit `touches` list from D1 task graph parser (from the `**Touches:**` field or scope.md `## Files Owned`)
2. Git history heuristic: scan last 100 commits in the domain directory for commits whose subject contains the task id
3. If neither source produces a list: `source='none'` -- task is routed to sequential (safe-default)

The git history scan is bounded to 100 commits and only searches within `.gsd-t/domains/<domain>`, not the full repo. The match is by substring inclusion of taskId in the commit subject.

Assessment: safe-default-for-unprovable rule is correct. The 100-commit bound prevents runaway I/O. The scan directory is restricted to domain metadata, not source files -- so it mostly catches re-runs of the same task, not first-time tasks.

### 5.4 Playwright Installation Retry
**Where:** `bin/playwright-bootstrap.cjs`
`installPlaywright` is idempotent: if a `playwright.config.*` already exists, the installation is a no-op. Package manager detection priority: pnpm-lock.yaml -> yarn.lock -> bun.lockb -> npm (default). Installation failure returns `{ok:false, err, hint}` and halts the workflow stage with a `blocked-needs-human` result.

Assessment: correct. The idempotency check is by config file existence, not by actual installation state. A project can have a playwright.config but missing browser binaries; `verifyPlaywrightHealth` handles this separately via the `npx playwright --version` check with a 5-second timeout.

### 5.5 Verify Gate Fallback on runParallel Throw
**Where:** `bin/gsd-t-verify-gate.cjs:147-157`
When `runParallel` throws, the catch block constructs `{ok:false, results:[]}`. This is then passed to `_shapeTrack2`. The function computes `workers.every((w) => w.ok || w.skipped)` on an empty array, which is vacuously `true`, overriding `envelope.ok = false`.

Assessment: 🔴 critical correctness defect (HIGH finding). A crashed parallel substrate produces a false PASS verdict. The fix is: `track2Ok = !!envelope.ok && workers.every(...)` or guard `if (workers.length === 0 && plan.length > 0) track2Ok = false`.

### 5.6 Decision Log Archive Rollover
**Where:** `bin/archive-progress.cjs`
Archive policy: keep the last 5 entries live in progress.md (DEFAULT_KEEP_LIVE = 5). Older entries roll into numbered archive files, max 20 entries per archive (DEFAULT_PER_ARCHIVE = 20). Both parameters are CLI-overridable. The operation is idempotent. Entry identification regex: `/^- \d{4}-\d{2}-\d{2}/`.

Assessment: correct. The format detection is permissive and handles both pre- and post-M59 formats (date-only and date+time prefixes both match).

### 5.7 execSync Timeout Absence
**Where:** `bin/cli-preflight-checks/branch-guard.cjs:44`, `bin/cli-preflight-checks/working-tree-state.cjs:37`, `bin/cli-preflight-checks/ports-free.cjs:48`
None of the three checks that call execSync supply a `timeout` option. A hung git command or lsof call will block the entire preflight indefinitely.

Assessment: 🟡 defect (MEDIUM finding). Should add `timeout: 10000` and convert ETIMEDOUT to ok:false.

### 5.8 Kroki Async Fallback Dead Code
**Where:** `bin/scan-renderer.js:84-121`
`renderDiagram()` is synchronous but `tryKroki()` is async. The comment at line 116 acknowledges "tryKroki is async; skip in sync rendering path." The effective fallback chain is mmdc -> d2 -> placeholder (not mmdc -> d2 -> Kroki as documented).

Assessment: 🟡 defect (MEDIUM finding). Any `KROKI_HOST` configuration is silently ignored.

---

## 6. UI Detection Rules

### 6.1 Framework Detection Priority
**Where:** `bin/ui-detection.cjs:56-65`
Framework detection from package.json deps uses a fixed priority order (first match wins):
1. next (includes react but is a distinct framework)
2. @angular/core
3. vue or @vue/runtime-core
4. svelte
5. react

If no framework dep is found, fallback checks: pubspec.yaml (Flutter), tailwind config files (4 variants checked), then depth-3 walk for .tsx/.jsx/.vue/.svelte/.css/.scss files. Ignored dirs: node_modules, .git, dist, build, .next, .nuxt, coverage, .gsd-t. NOTE: `.storybook` is intentionally NOT ignored.

Assessment: correct priority order.

### 6.2 Design Builder Hardcoded Framework
**Where:** `bin/design-orchestrator.js:116,150`
`buildPrompt()` and `buildSingleItemPrompt()` hardcode "Vue 3 + TypeScript" in all builder prompts regardless of the project's detected framework. `guessPaths()` also hardcodes `.vue` extensions and Vue directory conventions.

Assessment: 🔴 defect (HIGH finding). Design-build is silently broken for React, Svelte, Angular, Next.js projects. The server-side framework detection result is never threaded into the orchestrator.

---

## 7. Stack Rules Injection Rules

### 7.1 Stack Detection
**Where:** `bin/gsd-t-task-brief.js`
Detection sources checked: package.json (React, TypeScript, Node API, Next.js, Vue, Svelte, Redux, Zustand, Tailwind, Playwright, Prisma, Vite), requirements.txt/pyproject.toml (Python, FastAPI, Flask), go.mod (Go), Cargo.toml (Rust), additional configs (Firebase, Supabase, GraphQL, GitHub Actions, Docker, Neo4j, Flutter, React Native).

Universal rules (prefixed with `_`, always injected): `_security.md`, `_auth.md`, `_markdown.md`.

Assessment: detection logic is sound. However, stack rule injection is NOT wired into any M61+ Workflow script. `bin/gsd-t-task-brief.js` is only called from legacy code paths and tests -- never from `templates/workflows/`. The context brief system (bin/gsd-t-context-brief.cjs and all 11 kind collectors) contains zero references to `detectStack`, `loadStackRules`, or `templates/stacks/` (HIGH finding).

### 7.2 Model Selection Rules
**Where:** `bin/model-selector.js:72-120`
Phase-to-model assignment (first matching rule wins, most-specific first):
- execute/test_runner, execute/branch_guard, execute/file_check, quick/test_runner, integrate/test_runner: haiku (mechanical, zero judgment)
- execute/qa, quick (general), integrate (general), plan, test-sync, doc-ripple, wave, qa: sonnet
- execute/red_team, debug/root_cause, debug (general), partition, discuss, verify, red_team: opus

Complexity-signal overrides bump sonnet -> opus for: `cross_module_refactor`, `security_boundary`, `data_loss_risk`, `contract_design`.

Escalation hook: injected into sonnet-tier phases flagged `hasEscalation: true` (execute general, wave, plan). Agents at escalation points are instructed to spawn an opus subagent for high-stakes sub-decisions.

Assessment: 🟡 contract divergence. The model-selection-contract.md declares `plan` should use opus; the code assigns sonnet. Missing phase assignments (fall through to sonnet default with no rule): `impact`, `complete-milestone`, `scan`, `backlog-promote` (HIGH finding per contract's "any divergence is a defect" clause).

---

## Undocumented Rules

Rules found in code that have no counterpart in any contract, command file, or documentation.

### U1 - flagInactiveRules Milestone Gap Heuristic
**Where:** `bin/rule-engine.js:86-95`
A rule with zero activations is considered "inactive" when the gap between its `milestone_created` milestone number and the current maximum milestone number (across all rules) meets or exceeds the supplied threshold. Rules with non-standard milestone names (no "M" prefix) return `parseMilestoneNum = null` and are NEVER flagged inactive, regardless of age.

Not documented in any contract or command file.

### U2 - Wave Task ID Prefix Filtering
**Where:** `bin/gsd-t-parallel.cjs:216-219`
When `--milestone` is passed to `runParallel`, tasks are filtered by matching the task id (uppercased) against `prefix + "-"` (e.g., "M44-"). This assumes the GSD-T task id convention `MXX-DY-TZ`. Tasks with non-conforming ids are silently excluded from the milestone filter.

Not documented in the wave-join contract.

### U3 - Git History Touch Source Bounded to Domain Directory
**Where:** `bin/gsd-t-file-disjointness.cjs:67-75`
The git history fallback scans only within `.gsd-t/domains/<domain>` (not the full repo). The domain directory contains task metadata, not source files. This makes the heuristic useful only for detecting re-runs of the same task (the commit subject must contain the taskId and the commit must have touched the domain metadata dir).

Not documented in the disjointness contract.

### U4 - Rollup Deduplication Key
**Where:** `bin/global-sync-manager.js:134-136`
Global rollup entries are deduplicated by the compound key `(source_project, milestone)`. When the same project reports the same milestone twice (e.g., after a re-run), the existing entry is updated in-place via `Object.assign`. No version history is kept.

Not documented in any contract.

### U5 - captureSpawn Result Shape Stub
**Where:** `bin/parallel-cli.cjs:36-41`
The M61-retired captureSpawn is stubbed as `{ result: await spawnFn(), usage: null, rowWritten: false }`. The `result` field wrapping is non-optional: every caller reads `wrapped.result`. Any future replacement must preserve this envelope shape or all parallel-CLI workers will silently report ok:false (reading `undefined` from a missing `result` property).

Documented only in the inline comment, not in the parallel-cli contract v1.0.0.

### U6 - Journey Coverage String Masking
**Where:** `bin/journey-coverage.cjs:64-130`
Before scanning source files for event listeners, a string mask (Uint8Array) marks all characters inside string literals, single-line comments, multi-line comments, and HTML comments. Characters in masked regions are skipped by all listener detectors, preventing false positives from listener patterns inside string values or disabled code.

Not documented in any contract. The masking handles common cases but does not handle template literal nesting.

### U7 - progress.md Archive File Naming
**Where:** `bin/archive-progress.cjs`
Archive file names are formatted as `NNN-YYYY-MM-DD.md`. The date in the name is taken from the LAST entry in the archived batch (not the first). This is undocumented behavior.

### U8 - Verify Gate runId Format and Collision Risk
**Where:** `bin/gsd-t-verify-gate.cjs:106`
The runId is derived from the `now` Date object. The format is implementation-defined. The tee directory is `.gsd-t/verify-gate/{runId}/`. Two concurrent verify-gate runs at the same second would write to the same directory and could clobber each other's worker output files.

Not documented in the verify-gate contract beyond "a deterministic run id derived from the invocation timestamp."

### U9 - Volume-Based Scan Slicing Thresholds
**Where:** `templates/workflows/gsd-t-scan.workflow.js`
The scan workflow fans out by codebase volume rather than a fixed dimension count. Slice count is computed dynamically from file count, LOC, and domain count. The threshold values for small/medium/large codebase classification are embedded in the workflow script with no external config.

Not documented in the scan contract.

### U10 - Design Review gzip Proxy Gap
**Where:** `scripts/gsd-t-design-review-server.js:443,467`
The proxy forwards all headers including `Accept-Encoding`, allowing the upstream dev server (Vite by default) to respond with gzip/brotli. The proxy deletes `content-encoding` from the forwarded headers but never decompresses the body before calling `toString('utf8')` and injecting the review script.

Not documented anywhere. The expected behavior ("inject script tag into HTML") silently fails when upstream uses compression.

### U11 - Backlog Remove Step 5 Progress.md Write Inconsistency
**Where:** `commands/gsd-t-backlog-remove.md:Step 5 vs Step 6`
Step 5 instructs unconditional progress.md write; Step 6 says "If .gsd-t/progress.md exists." The two steps contradict each other. On a project without progress.md, Step 5 would create a malformed file. Other backlog commands (backlog-edit, backlog-move) use the existence guard correctly.

Not documented as a known inconsistency.
