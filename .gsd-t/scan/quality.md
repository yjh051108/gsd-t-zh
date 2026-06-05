# Code Quality Analysis -- 2026-06-04 (Scan #12)

Dead-code, test-gap, and duplicate findings from the M79+ deep scan.
Severity: 🔴 CRITICAL | 🟠 HIGH | 🟡 MEDIUM | 🟢 LOW

---

## Dead Code

### DC-1: headless-auto-spawn.cjs require in runDispatch production path

`file:bin/gsd-t-parallel.cjs:553`

- **Severity**: 🔴 CRITICAL
- **Impact**: `runDispatch` silently falls to `decision: 'sequential'` on every production call because `headless-auto-spawn.cjs` was deleted in M61. The module-not-found error is caught and swallowed. Fan-out parallelism (5x throughput objective from M44) is permanently disabled in production. Only test-injected stubs via `opts.spawnHeadlessImpl` ever reach the actual fan-out path.
- **Suggestion**: Remove the `require('./headless-auto-spawn.cjs')` fallback at line 553 entirely. If `runDispatch` is now planner-only (the Workflow runtime owns spawning), delete the spawn block and document that spawning is the Workflow's responsibility. At minimum convert the silent `sequential` fallback into a hard error so the breakage is visible.

---

### DC-2: Context meter PostToolUse hook installed on every fresh install despite M61 retirement

`file:bin/gsd-t.js:1550`

- **Severity**: 🟠 HIGH
- **Impact**: `configureContextMeterHooks()` is still called unconditionally in `doInstall()`. The hook command uses a guard that exits 0 when the script is absent, so there is no runtime error -- but every install writes a dead PostToolUse hook entry into `settings.json`. `showStatusContextMeter` (called in `doStatus`) always displays "N/A (meter hook not run this session)" for every user. Approximately 200 lines of dead constants and functions (`installContextMeter`, `CONTEXT_METER_SCRIPT`, `CONTEXT_METER_HOOK_COMMAND`, etc.) ship in the package.
- **Suggestion**: Remove the `configureContextMeterHooks` call from `doInstall` (line 1550), `showStatusContextMeter` call from `doStatus`, and all associated dead constants and functions. Also remove the context-meter gitignore entries if no longer relevant.

---

### DC-3: scan CLI subcommand is a do-nothing stub

`file:bin/gsd-t.js:4552`

- **Severity**: 🟡 MEDIUM
- **Impact**: The `case 'scan':` handler at line 4552 logs a notice about an export flag then breaks. No scan logic runs. Users invoking `gsd-t scan` get exit 0 with no output and no analysis -- silent success on a do-nothing stub. The `/gsd-t-scan` slash command invokes a Workflow correctly; the CLI entry point does nothing.
- **Suggestion**: Either delegate `gsd-t scan` to the Workflow script via `spawnSync` (matching other Workflow-backed commands), or remove the case and let the default handler emit an "unknown command" error. Add a comment if the CLI scan entry is intentionally disabled.

---

### DC-4: tryKroki is async but renderDiagram is synchronous -- Kroki fallback is permanently dead code

`file:bin/scan-renderer.js:84`

- **Severity**: 🟡 MEDIUM
- **Impact**: `tryKroki()` returns a `Promise` (uses `https.request` with `new Promise()`). `renderDiagram()` calls `tryMmdc()` then `tryD2()` synchronously and returns without awaiting Kroki. The comment at line 116 acknowledges this: "tryKroki is async; skip in sync rendering path." Users who set `KROKI_HOST` expecting to avoid installing `mmdc`/`d2` will always get placeholder diagrams. The `https` import is used only by the dead path.
- **Suggestion**: Either make `renderDiagram` async and await `tryKroki` as the third fallback (requires callers in `scan-diagrams.js` to await), or remove `tryKroki` and the `https` import entirely and document that only mmdc and d2 are supported.

---

### DC-5: Patch lifecycle applyPatch and recordMeasurement are never called -- promotion system is dead code

`file:bin/patch-lifecycle.js:1` / `file:commands/gsd-t-complete-milestone.md:1`

- **Severity**: 🔴 CRITICAL
- **Impact**: The five-stage patch lifecycle (candidate - applied - measured - promoted - graduated) is never traversed past "candidate". `applyPatch` and `recordMeasurement` are defined but have zero callers anywhere in `commands/`, `bin/`, or `scripts/` (confirmed by grep). Consequences: patches are created but never transitioned to "applied"; `metric_after` stays null; `improvement_pct` stays null; `checkPromotionGate` always returns `passes: false` because `(null || 0) <= 55` is always true; `getPatchesByStatus('applied', ...)` always returns empty. The entire rule-engine feedback loop produces zero promotions and zero graduations in practice.
- **Suggestion**: Add `applyPatch(patchId, projectDir)` calls in `complete-milestone.md` Step 2.5b immediately after candidate creation, and `recordMeasurement(patchId, milestoneId, actualMetricValue, projectDir)` at each subsequent milestone. Expose both in the workflow steps with concrete metric values from `mc.readTaskMetrics()`.

---

### DC-6: startReplayServer() in replay-helpers.ts hard-requires deleted M61 files at call time

`file:e2e/fixtures/journeys/replay-helpers.ts:102`

- **Severity**: 🟠 HIGH
- **Impact**: Lines 102-104 `require(path.resolve(..., 'scripts', 'gsd-t-dashboard-server.js'))` and reference `scripts/gsd-t-transcript.html`. Both were retired in M61 D4 and do not exist. Any caller of `startReplayServer()` throws `MODULE_NOT_FOUND`. The function is currently unreferenced by active specs, so the breakage is latent -- but it poisons the fixture module for any future spec that imports it.
- **Suggestion**: Either delete `replay-helpers.ts` and its fixture NDJSON files entirely (no active specs use them), or update `startReplayServer()` to use the current server infrastructure. Review `replayFixture()` at the same time.

---

### DC-7: pre-commit-capture-lint hook invokes retired CLI subcommand

`file:scripts/hooks/pre-commit-capture-lint:21`

- **Severity**: 🔴 CRITICAL
- **Impact**: The hook calls `gsd-t capture-lint --staged` (line 21) and `gsd-t capture-lint --staged --check-stream-json` (line 33). The `capture-lint` subcommand was deleted in M61 D3 along with `bin/gsd-t-capture-lint.cjs`. The CLI dispatcher has no such case -- it falls to the default which prints "Unknown command: capture-lint" and exits 1. Any project that installed this hook via `gsd-t init --install-hooks` has ALL commits blocked unconditionally.
- **Suggestion**: Either remove `pre-commit-capture-lint` from the package entirely, or rewrite it to reference the current stream-json lint mechanism. Update `gsd-t doctor --install-hooks` to not offer this hook until a valid replacement exists.

---

### DC-8: merged.includes(f) identity check is dead code in scan workflow deduplication

`file:templates/workflows/gsd-t-scan.workflow.js:479`

- **Severity**: 🟡 MEDIUM
- **Impact**: The deduplication filter `allFindings.filter((f) => !merged.includes(f))` uses object identity. Every item in the merge group is spread into a new object at merge time (line 474), so the original reference is never in `merged`. The filter never removes any item. Duplicate near-identical findings from multi-slice overlap can appear in the final report.
- **Suggestion**: Track merged items by a stable key (e.g. index from the original array) rather than object identity. Use a `Set<number>` of dropped indices instead of an object-identity array.

---

## Test Coverage Gaps

### TCG-1: parallel-cli.cjs has zero unit tests in the main suite

`file:bin/parallel-cli.cjs:1` / `file:bin/parallel-cli-tee.cjs:1`

- **Severity**: 🟠 HIGH
- **Impact**: `test/` contains `m44-task-graph.test.js`, `m44-depgraph-validate.test.js`, `m44-file-disjointness.test.js`, and `m44-run-dispatch.test.js` -- but no test for `parallel-cli.cjs` or `parallel-cli-tee.cjs`. A test file existed in worktrees (`agent-aeb7cccc/test/m55-d2-parallel-cli.test.js`) but was never promoted. `parallel-cli.cjs` is the actual subprocess-launching pool executor imported by `gsd-t-verify-gate.cjs` at line 31. Its critical paths -- failFast sibling cancellation, SIGTERM/SIGKILL escalation, per-worker timeout, tee streaming in file-mode and memory-mode -- are covered only in archived worktree tests.
- **Suggestion**: Promote or rewrite the worktree test as `test/m55-d2-parallel-cli.test.js`. Minimum coverage: (1) N workers all succeeding, (2) failFast cancels siblings on first failure, (3) per-worker timeout triggers `timedOut` flag, (4) tee file-mode and memory-mode byte counting, (5) `captureSpawn` stub shape (`result` field must be present).

---

### TCG-2: M71 native-lint test guard covers only gsd-t-scan.workflow.js -- six others unprotected

`file:test/m71-workflow-runtime-native-lint.test.js:38`

- **Severity**: 🟡 MEDIUM
- **Impact**: `RUNTIME_NATIVE = ['gsd-t-scan.workflow.js']` (line 38). The FORBIDDEN patterns list correctly identifies all sandbox-forbidden globals (`require()`, `module.exports`, `child_process`, `spawnSync`, `execSync`, `execFileSync`, `process.execPath`, `fs.*`). Six other workflow files (`execute`, `verify`, `wave`, `integrate`, `debug`, `quick`, `phase`) all violate these patterns and are not checked. New regressions -- re-adding `require()` to scan, or adding new workflow files -- are caught only for scan. The ratchet meant to enforce the M71 migration is frozen after the first file.
- **Suggestion**: After fixing `require()` usage in each workflow, add each fixed file to `RUNTIME_NATIVE`. Final state should be all `*.workflow.js` files in the list. Also add an assertion that all workflow files in the directory are in `RUNTIME_NATIVE` to prevent future additions from being silently unguarded.

---

### TCG-3: contracts-stable _isPastPartitioned regex never matches real progress.md heading format

`file:bin/cli-preflight-checks/contracts-stable.cjs:43`

- **Severity**: 🟡 MEDIUM
- **Impact**: Regex at line 43: `/^\s*Status\s*:\s*\**\s*([A-Za-z\-]+)/gim`. Real `progress.md` files use `## Status: ACTIVE -- M79...` (ATX heading). The `##` prefix is not matched by `\s*`, so the regex returns no match. The check always returns `isPastPartitioned=false` regardless of milestone state, making the DRAFT-contract warning permanently a no-op. The existing test at line 33-35 uses `'Status: ACTIVE\n'` as a standalone line -- it does not test the `## Status: ACTIVE` format.
- **Suggestion**: Update the regex to also match ATX headings: `/(?:^#{1,6}\s+|^\s*\*{0,2}\s*)Status\s*:?\s*\**\s*([A-Za-z\-]+)/gim`. Add a test case for `'## Status: ACTIVE'` (the actual progress.md format) that asserts true.

---

### TCG-4: verify.cjs \\Z in JS regex is literal 'Z' -- success criteria extraction fails at EOF

`file:bin/gsd-t-context-brief-kinds/verify.cjs:66`

- **Severity**: 🟠 HIGH
- **Impact**: Line 66 regex: `/^##[^\n]*(?:Success Criteria|Falsifiable[^\n]*)\s*$([\s\S]*?)(?=^##\s+|\Z)/mi`. In JavaScript, `\Z` is not a valid regex escape and is treated as the literal character 'Z'. The lookahead `(?=^##\s+|\Z)` requires a '##' heading or the character 'Z' to follow. When the Falsifiable Success Criteria section is the last section in the charter file (the common case), the lookahead never matches and `_successCriteriaFromCharter` returns `{ source: rel, items: [] }`. The verify subagent receives no success criteria to validate against. The existing unit test only covers the case where a '## Other section' follows -- the EOF case is untested and broken.
- **Suggestion**: Replace `\Z` with end-of-string: restructure to find the heading first, then capture everything until the next `##` or actual end of string. Fix: `/^##[^\n]*(?:Success Criteria|Falsifiable[^\n]*)\s*$([\s\S]*?)(?=^##\s+|$)/mi` with a trailing `(?![\s\S])` guard, or use a two-step approach (locate heading offset, slice to next `##` or end). Add a test for the EOF case.

---

### TCG-5: False-pass in _shapeTrack2 when runParallel throws or returns empty results

`file:bin/gsd-t-verify-gate.cjs:373`

- **Severity**: 🟠 HIGH
- **Impact**: When `runParallel` throws an exception (lines 147-155 catch block), the constructed fallback envelope has `results: []`. Inside `_shapeTrack2`, `workers = (envelope.results || []).map(...)` produces an empty array. Then `track2Ok = workers.every((w) => w.ok || w.skipped)` evaluates `[].every()` -- vacuously true per JavaScript spec. `track2.ok` becomes `true` even though all workers crashed and `envelope.ok = false`. The outer `ok` computation (`track1.ok && track2.ok`) becomes `true`, reporting a PASS verdict when all CLI tools failed to run. Milestone promotion can proceed through a completely untested codebase.
- **Suggestion**: In `_shapeTrack2`, propagate the envelope-level ok flag: `const track2Ok = !!envelope.ok && workers.every((w) => w.ok || w.skipped)`. Alternatively: if `workers.length === 0 && plan.length > 0`, default `track2Ok = false` because planned workers produced no results. Add a unit test for the throw-path.

---

### TCG-6: Synthesis verdict has no programmatic invariant enforcing Red Team FAIL blocks completion

`file:templates/workflows/gsd-t-verify.workflow.js:332`

- **Severity**: 🟡 MEDIUM
- **Impact**: The synthesis agent at line 332 is the sole arbiter of the final verdict. Its only constraint is a natural-language prompt and `VERDICT_SCHEMA` (which only validates the shape of `overallVerdict`, not logical consistency). A hallucinating synthesis agent could return `VERIFIED` even when the Red Team result in `triadResults` has `verdict: 'FAIL'`. This contradicts `orthogonal-validation-contract.md` v1.0.0 Rule 1 ("Red Team FAIL blocks completion"). The invariant is enforced only in prompts, not in code.
- **Suggestion**: After the synthesis agent returns its verdict (line 337), add a programmatic guard: inspect `triadResults` for any result with `category === 'adversarial-security-boundaries'` and `verdict === 'FAIL'`. If found, downgrade `overallVerdict` to `'VERIFY-FAILED'` unconditionally and add a note to `blockingFindings`. This is deterministic and prevents prompt-following failures from granting false VERIFIED status.

---

## Tech Debt

### TD-1: parseDrizzle column regex runs on entire file instead of each table's block

`file:bin/scan-schema-parsers.js:86`

- **Severity**: 🟠 HIGH
- **Impact**: In `parseDrizzle()`, `tableRe` correctly iterates each `pgTable`/`mysqlTable`/`sqliteTable` call at line 81, but `colRe` (`/(\w+)\s*:\s*\w+\(/g`) at line 86 is then executed against the FULL `content` string -- not scoped to the matched table block. For a Drizzle schema file with N tables, every column from every table is pushed into every entity's `fields` array N times. Every entity shows all columns from all tables; column counts are wildly inflated. This is the root of the `unknown` column-type issue noted in `scan-diagrams.js` line 48 that caused the schema diagram to be suppressed by default.
- **Suggestion**: Scope `colRe` to the matched table block. Extract the block content between the opening `(` and its matching `)` of each `pgTable(...)` call, then run `colRe` only on that substring.

---

### TD-2: parseTechDebtItems and parseSeverityMap expect legacy prose format -- always return empty for new deep-scan output

`file:bin/scan-data-collector.js:88`

- **Severity**: 🟠 HIGH
- **Impact**: `parseSeverityMap()` at line 88 matches `High priority: N (TD-102, TD-103)` -- legacy GSD-T prose. `parseTechDebtItems()` at line 111 matches a markdown pipe table `| ID | Title | Status |`. Neither format appears in deep-scan output: `quality.md` uses `### DC-N / TCG-N / TD-N` sections; `techdebt.md` uses a severity TABLE (`| 🔴 CRITICAL | 9 |`). `parseDebtSummary()` was updated in M77 to handle the table format but `parseSeverityMap` was not. As a result, `collectScanData` always returns `techDebt: []` and the HTML report Tech Debt table is always empty regardless of actual findings.
- **Suggestion**: Rewrite `parseTechDebtItems` to parse the `### TD-NNN - <title>` section format from `techdebt.md`, extracting severity from `- **Severity:** ...` and status from `- **Status:** ...`. Retire `parseSeverityMap` or update it to parse the severity table format.

---

### TD-3: tryD2 writes hardcoded stub diagram instead of actual Mermaid content

`file:bin/scan-renderer.js:73`

- **Severity**: 🟠 HIGH
- **Impact**: `tryD2()` line 73: `fs.writeFileSync(tmpIn, 'app -> db: query', 'utf8')`. The `mmdContent` parameter is accepted but ignored. Whenever `mmdc` is unavailable and `d2` IS installed, both the `system-architecture` and `data-flow` diagrams render the trivial two-node stub `app -> db: query` regardless of the real codebase structure. Users with `d2` installed as a fallback renderer see a meaningless diagram in the report.
- **Suggestion**: Change line 73 from `fs.writeFileSync(tmpIn, 'app -> db: query', 'utf8')` to `fs.writeFileSync(tmpIn, mmdContent, 'utf8')`. Note that `d2` uses its own D2 syntax, not Mermaid syntax, so a proper format conversion may also be needed, or the fallback should document that it only works when `mmdContent` is already D2-formatted.

---

### TD-4: token-log column index mismatch -- updateTokenLog silently no-ops on every call

`file:scripts/gsd-t-token-aggregator.js:218`

- **Severity**: 🟠 HIGH
- **Impact**: `updateTokenLog()` at line 218 hard-codes column indices based on a 12-column table format that includes a 'Compacted' column (`parts[8]=Tokens`, `parts[11]=Task`). The actual `token-log.md` has 11 columns with no 'Compacted' column: `parts[7]=Tokens`, `parts[8]=Notes`, `parts[10]=Task`, `parts[11]=Ctx%`. As a result: `taskCell = parts[11]` reads 'Ctx%' values like 'N/A' as the task id -- no row in `byTask` matches -- so `updated` is always 0. The function has never successfully updated `token-log.md` since the schema diverged. The comment on line 218 documents the WRONG format.
- **Suggestion**: Update column indices to match the actual 11-column format: change `parts[11]` (taskCell) to `parts[10]` and the token write target from `parts[8]` to `parts[7]`. Update the format comment. Add a test that exercises `updateTokenLog` against the actual token-log format.

---

### TD-5: writeTokenUsageJsonl always appends all rows -- tail mode grows unboundedly

`file:scripts/gsd-t-token-aggregator.js:192`

- **Severity**: 🟠 HIGH
- **Impact**: In `runTail()`, every time `rows.length !== lastWroteRows` (line 328), `writeTokenUsageJsonl()` unconditionally appends ALL current rows to the output file via `appendFileSync` (line 192). No overwrite or dedup logic exists. After N group-count changes the file contains the triangular sum: 1+2+3+...+N rows instead of N unique rows. For a typical workflow run with 10 task groups, the JSONL ends up with 55 rows instead of 10, with early groups duplicated proportionally. Token dashboards and metrics rollups that read the file see duplicate task rows and overcount token usage significantly.
- **Suggestion**: Replace the append pattern in `writeTokenUsageJsonl` with `writeFileSync` to overwrite the entire file with the current snapshot. `--tail` mode's `groups` map is always authoritative. Also remove the dead `let acc = ''` at line 302 (leftover from prior refactor).

---

### TD-6: SIGKILL escalation timer leaks -- never canceled when child exits cleanly after SIGTERM

`file:bin/parallel-cli.cjs:338`

- **Severity**: 🟡 MEDIUM
- **Impact**: `_killChild(child, killTimer)` at line 338 sends SIGTERM and creates a `setTimeout` for SIGKILL. The timer reference is created inside `_killChild` and never returned. Call sites pass `killTimer=null` to `_killChild`. The `close` handler at line 296 does `clearTimeout(killTimer)` -- but `killTimer` is always null. The SIGKILL timer always fires 5 seconds after SIGTERM, even if the child already exited cleanly. In high-concurrency scenarios with many short-lived children, the 5-second accumulated delay per cancelled worker slows the verify-gate's clean shutdown.
- **Suggestion**: Return the timer handle from `_killChild` and store it: `killTimer = _killChild(child, ...)`. Then `clearTimeout(killTimer)` in the close/error handlers correctly cancels the pending SIGKILL. Alternatively, store the timer on the child object itself (`child.__pcli_sigkill_timer`).

---

### TD-7: _buildSummary mutates caller's track2.notes array via .push()

`file:bin/gsd-t-verify-gate.cjs:479`

- **Severity**: 🟡 MEDIUM
- **Impact**: Inside `_buildSummary` loop, when worker output truncation occurs, the function calls `track2.notes.push(truncatedNote)` and `track2.notes.sort()` directly on the caller's `track2` object (lines 479-481 and 509-511). This mutates the passed-in reference. The same `truncatedNote` can be appended again if `_buildSummary` is called more than once with the same `track2`. The returned envelope's `track2.notes` and `summary.track2` both reference the same mutated array, contaminating the canonical `track2` result.
- **Suggestion**: Replace `track2.notes.push(truncatedNote)` with a local copy: `const notes = [...(track2.notes || []), truncatedNote].sort()`. Return the notes in the summary object from the local copy rather than mutating the canonical track2 notes.

---

### TD-8: Multi-domain disjointness gate checks only the last --domain due to last-wins parseArgv bug

`file:bin/gsd-t-parallel.cjs:142`

- **Severity**: 🔴 CRITICAL
- **Impact**: In `parseArgv()` at line 142, each `--domain` argument overwrites `out.domain` -- there is only one slot. `_lib.js::proveFileDisjointness` iterates the `domains` array and pushes multiple `--domain <name>` pairs (e.g. `['--dry-run','--domain','d1','--domain','d2','--domain','d3']`). The CLI silently discards all but the last, leaving `domain='d3'`. Only d3's intra-domain overlap is checked. d1-vs-d2 file overlap is never evaluated. `gsd-t-execute.workflow.js` calls `proveFileDisjointness({ projectDir, domains })` with the full domain array before spawning all domain workers in parallel -- it relies on this gate returning `ok=false` to abort. The primary safety invariant of parallel execution (no two concurrent workers write the same file) is silently bypassed for every multi-domain execution.
- **Suggestion**: Change `parseArgv` to accumulate repeated `--domain` flags into an array (`out.domains = []`, push each). Or change `proveFileDisjointness` in `_lib.js` to call `gsd-t parallel --dry-run` once per domain-pair and aggregate results. Simplest: call `runParallel` directly via `require` rather than through the CLI subprocess so the full domain array can be passed programmatically.

---

### TD-9: MutationObserver counter consumed before eslint-exempt check -- selector values shift on insertion/removal

`file:bin/journey-coverage.cjs:215`

- **Severity**: 🟡 MEDIUM
- **Impact**: In `detectMutationObserver()`, `counter++` at line 215 executes before the `isEslintExempt` check at line 217. When an eslint-exempt observer appears at position N, the counter slot is consumed but no listener is emitted. Any non-exempt observer after it receives a higher counter value than it would without the exempt one. The selector is `mutation-observer:{file}:{counter}`, so adding or removing any eslint-exempt observer before a covered non-exempt one invalidates all subsequent manifest coverage entries for that file, producing false GAP and STALE reports.
- **Suggestion**: Move `counter++` to after both the `masked()` check and the `isEslintExempt()` check, so only observers that will actually be emitted consume a counter slot. This is symmetric with how the `masked` path works and produces stable counter values regardless of how many exempt observers exist.

---

### TD-10: model-selector.js diverges from model-selection-contract.md

`file:bin/model-selector.js:104` / `file:.gsd-t/contracts/model-selection-contract.md:1`

- **Severity**: 🟠 HIGH
- **Impact**: The contract declares `plan` -> `opus` ("Task decomposition -- cost of a bad plan is domino-effect rework"), `impact` -> `opus`, and `complete-milestone` -> `opus`. But `model-selector.js` line 104 assigns `plan` -> `sonnet` with `hasEscalation: true`. And `impact`, `complete-milestone`, `scan`, `backlog-promote` have no rules at all -- they silently fall through to `DEFAULT_TIER` (sonnet). Runtime verification: `selectModel({phase:'plan'})` returns 'sonnet'; `selectModel({phase:'impact'})` returns 'sonnet' with reason 'Unknown phase'. The contract states "any divergence is a defect" and requires atomic updates to both files.
- **Suggestion**: Either (a) update `model-selector.js` to add rules for `impact` (opus), `complete-milestone` (opus), `scan` (sonnet), `backlog-promote` (sonnet), and change `plan` from sonnet to opus per the contract; OR (b) formally update the contract to reflect the current sonnet-for-plan decision with rationale. The two files must be in sync.

---

### TD-11: Stack Rules Engine completely bypassed by M61 Workflow system

`file:bin/gsd-t-task-brief.js:1` / `file:templates/workflows/gsd-t-execute.workflow.js:1`

- **Severity**: 🟠 HIGH
- **Impact**: CLAUDE.md, README.md, and GSD-T-README.md document that `gsd-t-execute`, `gsd-t-quick`, `gsd-t-integrate`, `gsd-t-wave`, `gsd-t-debug` inject stack rules into subagent prompts. The stack detection and injection logic lives in `bin/gsd-t-task-brief.js::detectStack()` + `loadStackRules()`. However: (1) M61 Workflow scripts build agent prompts from `lib.readScope()` + `lib.readDomainTasks()` + context brief -- none carry stack rules. (2) `bin/gsd-t-context-brief.cjs` and all 11 kind collectors have zero references to `detectStack`, `loadStackRules`, or `templates/stacks/`. (3) `templates/workflows/_lib.js` has no stack-detection function. The only path that still injects stack rules is the legacy `bin/gsd-t-task-brief.js` path, called only in test files. React, TypeScript, security (`_security.md`), and auth (`_auth.md`) rules are silently dropped from every agent spawn.
- **Suggestion**: Add stack detection and injection to `templates/workflows/_lib.js` (new `detectAndLoadStackRules(projectDir)` function) and thread its output into every `agent()` prompt in the Workflow scripts. Alternatively, add a `stack-rules` kind to the context brief system so briefs carry the injected rules and workers read them from the brief.

---

### TD-12: context-brief-contract.md KINDS list is stale -- 6 listed, 11 implemented

`file:.gsd-t/contracts/context-brief-contract.md:37`

- **Severity**: 🟡 MEDIUM
- **Impact**: The contract at line 37 lists `KINDS` as `['design-verify','execute','qa','red-team','scan','verify']` (6 kinds, M55-era). M56 D2 added 5 more: `discuss`, `impact`, `milestone`, `partition`, `plan`. `bin/gsd-t-context-brief-kinds/` contains 11 files on disk. The CLI flag description at line 54-55 says `--kind X` must be one of `KINDS`, which would appear to reject the 5 new kinds if taken literally. Agents or validators reading the contract have an incomplete picture of which brief kinds exist.
- **Suggestion**: Update `KINDS` in the contract to list all 11 kinds. Update the `--domain` requirement matrix to state which of the new kinds require a domain. Bump the contract to v1.1.0 (additive, non-breaking).

---

### TD-13: progress-file-format.md contract missing ACTIVE status, Summary column, and M59 HH:MM TZ requirements

`file:.gsd-t/contracts/progress-file-format.md:1`

- **Severity**: 🟡 MEDIUM
- **Impact**: Three discrepancies between the contract and reality: (1) Valid Status Values table does not include `ACTIVE`, but `progress.md` uses `## Status: ACTIVE` and `cli-preflight` looks for `Status: ACTIVE` to determine past-PARTITIONED state. (2) Completed Milestones table schema shows 4 columns but the actual table has 5 (Milestone, Version, Completed, Tag, Summary). (3) `## Date:` field shows `{YYYY-MM-DD}` but CLAUDE.md M59 mandates `YYYY-MM-DD HH:MM TZ` for all new entries. Agents writing progress.md against this contract will miss the ACTIVE status, omit the Summary column, and write date-only timestamps instead of the required format.
- **Suggestion**: Add ACTIVE to the Valid Status Values table. Add the Summary column to the Completed Milestones table schema. Update `## Date:` format to `{YYYY-MM-DD HH:MM TZ}` with a note that this is forward-only from v3.29.10. Bump the contract version.

---

### TD-14: fetchLatestVersion in gsd-t-update-check.js always returns null due to syntax error in inline node -e script

`file:scripts/gsd-t-update-check.js:40`

- **Severity**: 🟠 HIGH
- **Impact**: Line 40 contains an inline `node -e` script with a syntax error: `r.on('data',(c)=>d+=c;` -- the semicolon after `d+=c` terminates the arrow function body but the closing `)` for `r.on()` is missing. Running this script produces `SyntaxError: missing ) after argument list` (exit code 1). The outer `execFileSync` catch silently returns `null`. `fetchLatestVersion()` always returns `null`, the cached object is never populated, and the SessionStart hook never emits `[GSD-T AUTO-UPDATE]` or `[GSD-T UPDATE]` signals. Auto-update from SessionStart is completely broken.
- **Suggestion**: Fix the inline script: change `r.on('data',(c)=>d+=c;` to `r.on('data',(c)=>{d+=c});`. Alternatively, replace the inline script with a call to the already-correct `scripts/gsd-t-fetch-version.js`.

---

### TD-15: rollup.jsonl is never written -- gsd-t-metrics ELO display is dead code

`file:commands/gsd-t-metrics.md:1` / `file:bin/metrics-collector.js:1`

- **Severity**: 🟠 HIGH
- **Impact**: `gsd-t-metrics.md` Step 2 reads `.gsd-t/metrics/rollup.jsonl` for per-milestone ELO and aggregation data. Steps 3 (Process ELO), 5 (Domain Breakdown with duration), and 6 (Trend Comparison) all require `rollup.jsonl` data. No code anywhere in `bin/` or `scripts/` writes this file. `global-sync-manager.js` manages only a separate `~/.claude/metrics/global-rollup.jsonl`. ELO display, domain breakdown by duration, and trend comparison silently show no data. The telemetry system's core value proposition is non-functional.
- **Suggestion**: Implement a `writeProjectRollup()` function in `bin/metrics-collector.js` that computes and writes `.gsd-t/metrics/rollup.jsonl` at the end of each execute/verify phase. Or remove ELO from the command documentation until the write path exists, to prevent user-facing misleading empty sections.

---

### TD-16: Date guard produces false positives on Write of progress.md with historical decision-log entries

`file:scripts/gsd-t-date-guard.js:1`

- **Severity**: 🟠 HIGH
- **Impact**: The `decision-log` pattern is validated against +/-5 min of the live clock for ALL Write calls (where `oldContent = ''`). When `/gsd-t-log` Step 6 (full reconstruction from git history) or `/gsd-t-populate` writes a `progress.md` containing historical entries (e.g., `- 2024-01-15 09:30: Initial commit`), the guard blocks the Write with a false positive. The Edit dedup only protects when `old_string` already contains the entry. This causes `/gsd-t-log` full-reconstruction and `/gsd-t-populate` git-history reconstruct to be blocked at the Write step.
- **Suggestion**: Option (a): narrow the decision-log pattern to validate same-calendar-day rather than +/-5 min for Write operations. Option (b): teach `/gsd-t-log` and `/gsd-t-populate` to exclusively use Edit (append) rather than Write (replace) for progress.md. Option (c): add `progress.md` to the allowlist when content matches a full-reconstruct pattern. The most surgical fix is option (a).

---

### TD-17: patch-lifecycle graduation permanently unreachable for patches promoted with fewer than 3 pre-promotion measurements

`file:bin/patch-lifecycle.js:116`

- **Severity**: 🟠 HIGH
- **Impact**: `graduate()` checks `patch.measured_milestones.length < 3` at line 116. But `recordMeasurement()` at line 68 only processes patches whose status is `'applied'` or `'measured'`. Once `promote()` sets status to `'promoted'` (line 102), `recordMeasurement` silently returns without adding new milestone IDs. A patch promoted with exactly 2 measurements can never reach 3 and will never graduate. The graduation criterion comment says "promoted for 3+ additional milestones" but the code checks total historical measurements -- a semantic mismatch. No patch ever graduates to a permanent methodology artifact.
- **Suggestion**: Either: (a) add a separate `post_promotion_milestones` counter incremented by a new `recordPostPromotionMilestone()` call in the workflow; (b) lower the graduation threshold to 2 measurements; or (c) allow `recordMeasurement` to operate on promoted patches by including `'promoted'` in the status check at line 68.

---

### TD-18: patch-lifecycle.js improvement_pct treats all metrics as "higher is better" -- fix_cycles always fails promotion

`file:bin/patch-lifecycle.js:73`

- **Severity**: 🟠 HIGH
- **Impact**: `recordMeasurement` computes `improvement_pct = ((metricAfter - metricBefore) / |metricBefore|) * 100` at line 73. For `fix_cycles` (lower is better), a patch that reduced fix cycles from 5 to 2 produces `improvement_pct = -60%`, which fails `checkPromotionGate`'s `<= 55` check. Conversely, a patch that increased fix cycles from 1 to 2 produces `improvement_pct = +100%`, which passes the gate. The test in `patch-lifecycle.test.js` line 209 validates `metricBefore=2`, `metricAfter=3` produces 50% "improvement" for `fix_cycles` -- an increase framed as improvement. The primary `fix_cycles` template (tpl-001) can never promote.
- **Suggestion**: Add a `direction` field to patch templates (`'higher_is_better'` or `'lower_is_better'`) and adjust `improvement_pct` calculation in `recordMeasurement` to invert the sign for `lower_is_better` metrics. Update `checkPromotionGate` to use the corrected signed improvement. Update `patch-templates.jsonl` to include direction for existing templates (`fix_cycles` -> `lower_is_better`).

---

### TD-19: settings.json corrupted by five independent read-modify-write cycles during install

`file:bin/gsd-t.js:1550`

- **Severity**: 🟡 MEDIUM
- **Impact**: `doInstall()` calls five separate functions that each independently read `settings.json`, mutate in-memory, and write back: `configureHeartbeatHooks` (line 356), `configureUpdateCheckHook` (line 893), `configureAutoRouteHook` (line 973), `configureInSessionHooks` (line 1060), and `configureContextMeterHooks` (line 1550). If another process (e.g., Claude Code itself) writes `settings.json` between any two of these calls, the last writer wins and silently drops hooks. The install flow runs at session startup with Claude Code also active, making the race window real.
- **Suggestion**: Refactor `doInstall` to load `settings.json` once, pass the mutable settings object into each `configure*` function as a parameter, and flush to disk a single time after all hooks have been applied.

---

### TD-20: parseTestResult in debug-loop yields false negatives -- 'error' substring matches any error mention

`file:bin/gsd-t.js:3971`

- **Severity**: 🟡 MEDIUM
- **Impact**: `parseTestResult` at line 3962 marks output as failed if it contains the word 'error' (`/\berror\b/.test(out)`). This is applied to the full lowercased output string. Any test run that reports "0 errors", "no error found", or uses the word "error" in a passing summary (e.g. "error handling tests passed") is classified as `failed=true`. Since `passed: passed && !failed`, even a clean test run that says "all tests passed, error-handling suite: ok" would be classified as STILL_FAILS, consuming the full 20-iteration debug budget unnecessarily.
- **Suggestion**: Tighten the failed heuristic to require a non-zero count prefix (e.g. `/\b([1-9]\d*)\s+errors?\b/`) or a clearly terminal line (e.g. `/^error:/im`). At minimum exclude bare 'error' from the single-word check and require 'errors' to be accompanied by a count or structural context.

---

### TD-21: registerProject read-then-write on PROJECTS_FILE has no lock

`file:bin/gsd-t.js:282`

- **Severity**: 🟡 MEDIUM
- **Impact**: `registerProject` at line 282 reads `PROJECTS_FILE`, appends to the in-memory array, and writes the full file back. If two `gsd-t register` or `gsd-t init` processes run simultaneously (e.g., in a script that initializes multiple projects), both read the same state, both write their updated array, and one registration is silently lost. The write is not atomic (plain `writeFileSync` with no tmp+rename). Additionally, stale entries are pruned from `getRegisteredProjects` results but never removed from the file on disk, so `PROJECTS_FILE` grows unboundedly.
- **Suggestion**: Use a tmp+rename pattern for the write (write to `PROJECTS_FILE + '.tmp.' + process.pid`, then `fs.renameSync`) to make the write atomic on POSIX. Filter out missing paths and write the cleaned list back when stale entries are found.

---

## Duplication

*(No new duplication findings this scan -- see DC-2 in Scan #11 for the JS/CJS paired-file drift risk, still unresolved.)*

---

## Naming / Structural

*(No new findings this scan.)*

---

## Performance Issues

### perf-1: sendToolCallSync in graph-cgc.js blocks for full timeout on every CGC query

`file:bin/graph-cgc.js:1`

- **Severity**: 🟠 HIGH
- **Impact**: Every call to `cgcQuery()` -> `sendToolCallSync()` spawns a new `cgc mcp start` process via `execFileSync`, writes 3 JSON-RPC messages on stdin, and waits for the process to exit. MCP servers are persistent long-running processes that do not exit after a single tool call. `execFileSync` always blocks until its timeout (default 10 seconds) before SIGKILL-ing the child. Every graph query costs a 10-second wall-clock delay plus process-spawn overhead. The `sendRequest` long-polling approach at lines 76-116 is correct but never used by `cgcQuery`.
- **Suggestion**: Adopt the persistent process pattern: start `cgcProcess` once (`startCgcServer` already exists but is never called), use `sendRequest` (the async stdio approach) for all queries, and shut down on process exit. Or add a `cgc query` one-shot CLI subcommand that accepts a tool name and JSON args and exits, so `execFileSync` gets a real exit code. Remove the dead `sendRequestSync`/`startCgcServer` functions.

---

## Error Handling Gaps

*(Carried from Scan #11: `bin/scan-export.js` / `bin/scan-renderer.js` `execSync` string-interpolation issue -- still unresolved.)*
