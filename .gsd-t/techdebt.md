# Tech Debt Register - .

**Scan #12** - Deep codebase scan (runtime-native, full coverage)
**Date:** 2026-06-04
**Slices run:** 17 | **Coverage:** FULL - all 17 slices succeeded
**Verified findings:** 181

> Effort estimates use GSD-T-native units (domain / wave / spawn / token-spend). Never human-hours.
> TD numbering continues from the prior register (if any, archived). This scan begins at **TD-113**.

## Summary

| Severity | Open | Resolved |
|----------|------|----------|
| 🔴 CRITICAL | 3 | 1 |
| 🟠 HIGH | 41 | 1 |
| 🟡 MEDIUM | 77 | 1 |
| 🟢 LOW | 58 | 2 |
| **Total** | **179** | **5** |

> 5 items resolved by M81 runtime-native workflows (v4.0.29) — see the `## ✅ Resolved` section at the bottom.

---

## 🔴 Critical Priority

### TD-114 - Retired headless-auto-spawn.cjs still required in runDispatch production path
- **Area:** Fan-out execution
- **Severity:** CRITICAL
- **Status:** OPEN
- **Location:** bin/gsd-t-parallel.cjs
- **Description:** At line 553, `runDispatch` attempts `require(path.join(__dirname, 'headless-auto-spawn.cjs')).autoSpawnHeadless` when no `spawnHeadlessImpl` is injected. `headless-auto-spawn.cjs` was retired in M61 and deleted from the main tree. The `require` throws `MODULE_NOT_FOUND`, which is caught at line 554 and silently demotes the decision from `fan_out` to `sequential` with `error: 'spawn_load:Cannot find module ...'`. Verified live: `runDispatch({ projectDir, command: 'gsd-t-execute' })` always returns `decision: 'sequential'` on a two-domain project with two disjoint ready tasks. The fan-out machinery has been broken in production since M61/M65 retired the module. Tests pass because they always inject `spawnHeadlessImpl`.
- **Impact:** Fan-out parallelism is silently disabled for all in-production calls that do not inject a spawn stub. Every `gsd-t execute` run falls through to sequential even when the planner correctly identifies N≥2 disjoint parallel tasks. The 5× throughput objective from M44 is not achieved in production.
- **Remediation:** Replace the `require('./headless-auto-spawn.cjs')` path with the actual spawn mechanism that replaced it in M61 (the Workflow runtime's native `spawn`/`agent()` call). If `runDispatch` is now only used as a planner (plan-only, no spawning), remove the spawn block entirely and document that spawning is the Workflow runtime's responsibility. At minimum, convert the silent `sequential` fallback into a hard error so the breakage is visible.
- **Found in slice:** parallel-execution-and-task-graph
### TD-115 - reviewQueue used before declaration - ReferenceError crashes /review/api/exclude
- **Area:** Review server - /review/api/exclude endpoint
- **Severity:** CRITICAL
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/scripts/gsd-t-design-review-server.js
- **Description:** The /review/api/exclude POST handler references `reviewQueue` at lines 795, 814, 815, 817, 819, and 822, but `reviewQueue` is never declared anywhere in the file. The canonical queue state is read on-demand from disk via `readQueue()`. At runtime, this throws `ReferenceError: reviewQueue is not defined` the moment any item is excluded, crashing the handler. The auto-reject path (lines 297-338) and the readQueue() function both work correctly with disk state, but this handler uses a ghost variable.
- **Impact:** Any request to POST /review/api/exclude (triggered by the 'Remove from review' button in the UI) will crash the server request handler with an unhandled exception. The exclusion operation silently fails from the client's perspective; contract files and source files are not deleted; the build pipeline stalls.
- **Remediation:** Replace all `reviewQueue` references in the /review/api/exclude handler with the result of `readQueue()`. To remove from queue, delete the queue JSON file on disk (matching the pattern already used at line 817 for the one case that does read item.id from the loop variable). Example: const queueItems = readQueue(); then filter/process from queueItems, and delete disk files directly.
- **Found in slice:** design-to-code-pipeline
### TD-116 - gsd-t-unattended.md and gsd-t-unattended-watch.md reference deleted bin modules - commands are completely non-functional
- **Area:** Unattended Supervisor Launch & Watch
- **Severity:** CRITICAL
- **Status:** OPEN
- **Location:** /Users/david/.claude/commands/gsd-t-unattended.md, /Users/david/.claude/commands/gsd-t-unattended-watch.md
- **Description:** gsd-t-unattended.md Step 2 does `require('./bin/gsd-t-unattended-platform.cjs')` and Step 2 also calls `require('./bin/gsd-t-token-capture.cjs')`. gsd-t-unattended-watch.md Step 2 calls `require('./bin/supervisor-pid-fingerprint.cjs')` and Step 6b calls `require('./bin/event-stream.cjs')` and `require('./bin/unattended-watch-format.cjs')`. All five of these modules were retired and deleted in M61 D2 (confirmed in CHANGELOG v4.0.10, progress.md line 122, and verified absent from both `/Users/david/projects/GSD-T/bin/` and `~/.claude/bin/`). CHANGELOG explicitly states these commands were replaced by 'Native background Workflows + /loop skill' but the command .md files were never updated to reflect that replacement. Any invocation of /gsd-t-unattended crashes at Step 2 with MODULE_NOT_FOUND. Any invocation of /gsd-t-unattended-watch crashes partway through Step 2 when reading the PID file.
- **Impact:** The entire zero-touch autonomous overnight-run feature is non-functional. Users invoking /gsd-t-unattended or /gsd-t-unattended-watch get a Node.js MODULE_NOT_FOUND crash. The skills are advertised in the system-reminder skill list, creating silent breakage.
- **Remediation:** Either (a) rewrite the three command files to use ScheduleWakeup + /loop + native Workflows as described in CHANGELOG v4.0.10, or (b) delete the ~/.claude/commands/gsd-t-unattended*.md files and remove the skills from the registry until a replacement is built.
- **Found in slice:** unattended-supervisor-and-headless-mode

## 🟠 High Priority

### TD-118 - agentId used directly in file path without containment check - path traversal
- **Area:** Security / path traversal
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** scripts/gsd-t-watch-state.js, /Users/david/projects/GSD-T/scripts/gsd-t-watch-state.js
- **Description:** Line 153 constructs the watch-state file path as `path.join(_stateDir(cwd), agentId + '.json')`. Node's `path.join` normalises `..` segments, so an `agentId` of `../../evil` resolves to a path outside the `.gsd-t/.watch-state/` directory (verified: resolves to `/evil.json` on the test machine). `agentId` comes from `--agent-id` CLI argument (line 65) or `GSD_T_AGENT_ID` env var (line 67), both of which are attacker-controllable in a multi-tenant or CI environment. There is no containment check (`startsWith(stateDir + path.sep)`) before the `_atomicWrite` call.
- **Impact:** Attacker-controlled agent-id (via CLI arg or env var) can write arbitrary JSON to any path the process has write access to, enabling privilege escalation or clobbering system files.
- **Remediation:** After constructing `filePath`, verify: `const stateDir = _stateDir(cwd); if (!filePath.startsWith(path.resolve(stateDir) + path.sep)) { process.stderr.write('[gsd-t-watch-state] invalid agent-id\n'); return 1; }`. Also add a regex allowlist for agent-id characters (alphanumeric, hyphens, underscores).
- **Found in slice:** real-time-agent-dashboard, unattended-supervisor-and-headless-mode
### TD-119 - spawnClaudeSession in debug-loop missing --dangerously-skip-permissions flag
- **Area:** Headless execution correctness
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** bin/gsd-t.js
- **Description:** doHeadlessExec (line 3653) correctly passes '--dangerously-skip-permissions' when spawning claude -p. However, spawnClaudeSession (line 3948) - called by the debug-loop at line 4101 and by runLedgerCompaction at line 3997 - does NOT include '--dangerously-skip-permissions'. Per the MEMORY.md entry 'Headless needs --dangerously-skip-permissions', every headless claude -p spawn must include this flag or the child exits on first tool use. The debug-loop is the path most likely to need tool use (it reads files, runs tests, edits code). Without this flag, each debug iteration silently exits early, the output contains 'permission required' text, parseTestResult sees the word 'error' (line 3971) and marks the iteration as failed, and the loop escalates unnecessarily. runLedgerCompaction (line 3997) has the same gap.
- **Impact:** Every debug-loop iteration fails at first tool use, the loop cycles through all 20 iterations without fixing anything, and exits with code 1 (max iterations) or 4 (escalation stop). The debug-loop is completely non-functional without this flag.
- **Remediation:** Add '--dangerously-skip-permissions' to the args array in spawnClaudeSession at line 3948: change `execFileSync("claude", ["-p", prompt, "--model", model], ...)` to `execFileSync("claude", ["-p", "--dangerously-skip-permissions", prompt, "--model", model], ...)`. Apply the same fix to the execFileSync call in runLedgerCompaction at line 3997.
- **Found in slice:** cli-installer-updater
### TD-120 - Hardcoded Neo4j password in source code and docker run arguments
- **Area:** Security / credential management
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** bin/gsd-t.js
- **Description:** The Neo4j password 'gsdt-graph-2026' is hardcoded in three places: the docker run -e NEO4J_AUTH=neo4j/gsdt-graph-2026 argument at line 1312, the cgc config set NEO4J_PASSWORD call at line 1350, and the doctor hint at line 2930. When installCgc() creates a Neo4j container, this password is baked into every user's installation. Any user who uses this feature has a predictable shared password on their local Neo4j instance at port 7687, which is network-accessible by default. The container is created with --restart unless-stopped so it persists across reboots.
- **Impact:** Any process on the local machine (or on the local network if Docker's port mapping is accessible) can authenticate to Neo4j with the known password. For a developer tool this is limited-severity, but graph data includes full project file content, which could expose code from confidential projects.
- **Remediation:** Generate a random password during first install (e.g., crypto.randomBytes(16).toString('hex')) and persist it to a config file (e.g., ~/.claude/.gsd-t-neo4j.json). Use the generated password in the docker run command and in the cgc config call. Fall back to a prompt if the user prefers to set their own. At minimum, document that this is a shared known credential in the doctor output.
- **Found in slice:** cli-installer-updater
### TD-121 - Multi-domain disjointness gate checks only the last --domain (last-wins parseArgv bug)
- **Area:** File-disjointness safety gate
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** bin/gsd-t-parallel.cjs, templates/workflows/_lib.js, templates/workflows/gsd-t-execute.workflow.js
- **Description:** In `parseArgv` (bin/gsd-t-parallel.cjs line 142), each `--domain` argument overwrites `out.domain` - there is only one slot. `_lib.js::proveFileDisjointness` (line 104-106) iterates the `domains` array and pushes multiple `--domain <name>` pairs, e.g. `['--dry-run','--domain','d1','--domain','d2','--domain','d3']`. The CLI silently discards all but the last, leaving `domain='d3'`. `runParallel` then filters candidates to only d3's tasks, so only d3's intra-domain overlap is checked. d1-vs-d2 file overlap is never evaluated. `gsd-t-execute.workflow.js` calls `proveFileDisjointness({ projectDir, domains })` with the full domain array before spawning all domain workers in parallel - it relies on this gate returning `ok=false` to abort. Since d1 and d2 are not checked, `ok=true` is returned even when they share write targets, and all workers run concurrently. Verified live by constructing a two-domain project where d1 and d2 both claim `bin/shared.cjs`: gate returned exit 0 (ok=true) showing only d2's task.
- **Impact:** The primary safety invariant of the parallel-execution layer - no two concurrent workers write the same file - is silently bypassed for every multi-domain execution. Two workers can clobber each other's writes, producing corrupt or non-deterministic output with no error signal.
- **Remediation:** Change `parseArgv` to accept repeated `--domain` flags into an array, OR change `proveFileDisjointness` in `_lib.js` to call `gsd-t parallel --dry-run` once per domain-pair and aggregate results, OR - simplest - call `runParallel` directly via `require` rather than through the CLI subprocess so the full domain array can be passed programmatically.
- **Found in slice:** parallel-execution-and-task-graph
### TD-122 - parallel-cli.cjs (the actual worker pool executor) has zero unit tests in the main suite
- **Area:** Test coverage
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** bin/parallel-cli.cjs, bin/parallel-cli-tee.cjs
- **Description:** The `test/` directory contains `m44-task-graph.test.js`, `m44-depgraph-validate.test.js`, `m44-file-disjointness.test.js`, and `m44-run-dispatch.test.js` - but no test for `parallel-cli.cjs` or `parallel-cli-tee.cjs`. A test file existed in the worktrees (`agent-aeb7cccc/test/m55-d2-parallel-cli.test.js`) but was never promoted to the main suite. `parallel-cli.cjs` is the actual subprocess-launching pool executor used by `gsd-t-verify-gate.cjs` (imported at line 31). Its critical paths - failFast sibling cancellation, SIGTERM/SIGKILL escalation, per-worker timeout, tee streaming in both file-mode and memory-mode, captureSpawn stub returning correct result shape - are all covered only in archived worktree tests that no longer run.
- **Impact:** Changes to `parallel-cli.cjs` or `parallel-cli-tee.cjs` have no test safety net. Regressions in the verify-gate's parallel substrate (the executor `gsd-t-verify-gate.cjs` depends on) can ship undetected. The failFast logic and SIGKILL escalation in particular are correctness-critical and easy to break.
- **Remediation:** Promote or rewrite the worktree test file `agent-aeb7cccc/test/m55-d2-parallel-cli.test.js` into `test/m55-d2-parallel-cli.test.js`. At minimum cover: (1) runParallel with N workers all succeeding, (2) failFast cancels siblings on first failure, (3) per-worker timeout triggers timedOut flag, (4) tee file-mode and memory-mode byte counting, (5) the captureSpawn stub shape (result field must be present).
- **Found in slice:** parallel-execution-and-task-graph
### TD-123 - Multiple critical bin files referenced in commands do not exist
- **Area:** Dead/broken references
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** commands/gsd-t-quick.md, commands/gsd-t-resume.md, commands/gsd-t-status.md, commands/gsd.md
- **Description:** Six bin files are called by command files but do not exist in either the source repo (`/bin/`) or the published package: `bin/gsd-t-token-capture.cjs` (required by `gsd-t-quick.md` lines 112-114 for mandatory observability logging via `captureSpawn`), `bin/runway-estimator.cjs` (required by `gsd.md` line 237 for dialog-growth warning in Step 5), `bin/token-budget.cjs` (required by `gsd-t-resume.md` line 151 for context meter health check, and `gsd-t-quick.md` line 40), `bin/check-headless-sessions.js` (required by `gsd-t-status.md` line 37 and `gsd-t-resume.md` line 132), `bin/supervisor-pid-fingerprint.cjs` (required by `gsd-t-resume.md` line 55), `bin/handoff-lock.cjs` (required by `gsd-t-resume.md` line 109). All calls use `|| true` or `2>/dev/null` so they fail silently - the features they guard (token logging, context pressure warnings, context meter health, headless session readback, supervisor fingerprinting, handoff lock) silently become no-ops rather than crashing, but the command text misleads the agent into believing these checks ran.
- **Impact:** Silent no-ops where critical observability and safety checks should run: token capture logs are never written, dialog pressure warnings never fire, context meter health never checked on resume, headless session banners never shown.
- **Remediation:** Either ship the missing modules in the package (they were likely removed during M61 retirement or never propagated from a prior branch), or remove the code blocks from the command files that reference them and replace with explicit 'not available - skip' notes. If these were retired with the M61 orchestrator, the command prose must be updated to reflect that.
- **Found in slice:** slash-command-library
### TD-124 - False-pass in _shapeTrack2 when runParallel throws or returns empty results
- **Area:** Verify-gate correctness
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** bin/gsd-t-verify-gate.cjs
- **Description:** When runParallel throws an exception (lines 147-155 catch block), the constructed fallback envelope has `results: []`. This is passed to `_shapeTrack2(envelope, plan)`. Inside _shapeTrack2 at line 354-369, `workers = (envelope.results || []).map(...)` produces an empty array. Then `track2Ok = workers.every((w) => w.ok || w.skipped)` at line 373 evaluates `[].every()` which is vacuously true per JavaScript spec. This makes `track2.ok = true` even though `envelope.ok = false` and all workers crashed. The outer `ok` computation (`track1.ok && track2.ok`) becomes `true`, reporting a PASS verdict when all CLI tools failed to run. Reproduced empirically: passing a `runParallelImpl` that throws produces `envelope.ok=true` (see test above). The same applies when `runParallelImpl` returns `{ok: false, results: [], notes: ['runParallel threw: ...']}` which is exactly what the catch block constructs.
- **Impact:** A crashing parallel-cli substrate (network error, spawn failure, Node crash) causes the verify gate to silently pass. All CI-gating checks (tsc, biome, tests, secrets scan) report as passing when they actually never ran. Milestone promotion could proceed through a completely untested codebase.
- **Remediation:** In _shapeTrack2, propagate the envelope-level ok flag: `const track2Ok = !!envelope.ok && workers.every((w) => w.ok || w.skipped)`. Alternatively: if `workers.length === 0 && plan.length > 0`, default `track2Ok = false` because planned workers produced no results. Add a unit test specifically for the throw-path where plan=[{id:'tsc'}] and runParallelImpl throws.
- **Found in slice:** verify-gate-and-ci-parity
### TD-125 - tryD2 writes hardcoded stub diagram instead of the actual Mermaid content
- **Area:** Diagram Rendering
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** bin/scan-renderer.js:73
- **Description:** In `tryD2()`, the code writes the literal string `'app -> db: query'` to the `.d2` temp file instead of `mmdContent` (the actual Mermaid diagram string passed in). Line 73: `fs.writeFileSync(tmpIn, 'app -> db: query', 'utf8');`. The `mmdContent` parameter is accepted but ignored. As a result, whenever `mmdc` is unavailable and `d2` IS installed, both the `system-architecture` and `data-flow` diagrams render a trivial stub `app -> db: query` regardless of the real codebase structure.
- **Impact:** Users who have `d2` installed as a fallback renderer see a meaningless two-node diagram for system architecture and data flow. The report is misleading - it shows content that has no relationship to the scanned project.
- **Remediation:** Change line 73 from `fs.writeFileSync(tmpIn, 'app -> db: query', 'utf8')` to `fs.writeFileSync(tmpIn, mmdContent, 'utf8')`. Note: `d2` uses its own D2 syntax, not Mermaid syntax, so a proper conversion from Mermaid to D2 may be needed, or the fallback should be restricted to when mmdContent is already D2-formatted.
- **Found in slice:** codebase-scan-engine
### TD-126 - parseDrizzle: column regex runs on entire file instead of each table's block - all columns attributed to every table
- **Area:** Schema Parsing
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** bin/scan-schema-parsers.js:82-96
- **Description:** In `parseDrizzle()`, `tableRe` correctly iterates each `pgTable`/`mysqlTable`/`sqliteTable` call, but `colRe` (`/( \w+)\s*:\s*\w+\(/g`) is then executed against the FULL `content` string - not scoped to the matched table block. For a Drizzle schema file with N tables, every column from every table is pushed into every entity's `fields` array N times (once per table match iteration). The resulting entities are duplicates of each other's complete column list, and column counts are wildly inflated.
- **Impact:** The ER diagram and schema data produced for Drizzle projects are incorrect. Every entity shows all columns from every table, making the diagram both redundant and misleading. This is the root of the `unknown` column-type issue noted in comments (scan-diagrams.js line 48) that caused the schema diagram to be suppressed by default.
- **Remediation:** Scope `colRe` to the matched table block. Extract the block content between the opening `(` and its matching `)` of each `pgTable(...)`  call, then run `colRe` only on that substring. Alternatively, restructure the loop to track start/end positions of each table definition.
- **Found in slice:** codebase-scan-engine
### TD-127 - parseTechDebtItems and parseSeverityMap expect legacy prose format - always return empty for new deep-scan output
- **Area:** Scan Data Collection / HTML Report
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** bin/scan-data-collector.js:88-123, bin/scan-data-collector.js:108-123
- **Description:** `parseSeverityMap()` matches patterns like `High priority: N (TD-102, TD-103)` - the legacy GSD-T prose format. `parseTechDebtItems()` matches a markdown pipe table `| ID | Title | Status |`. Neither format appears in the deep-scan output: the new `quality.md` uses `### DC-N / TCG-N / TD-N` sections, and `techdebt.md` uses a severity TABLE (`| 🔴 CRITICAL | 9 |`). `parseDebtSummary()` was updated in M77 to handle the table format, but `parseSeverityMap` was not. As a result, `collectScanData` always returns `techDebt: []`, and the HTML report's Tech Debt table is always empty regardless of actual findings.
- **Impact:** The HTML scan report's Tech Debt section shows `No open tech debt items` for every project scanned with the deep-scan workflow. Severity in `parseTechDebtItems` always defaults to `'low'` even when real CRITICAL/HIGH items exist.
- **Remediation:** Rewrite `parseTechDebtItems` to parse the `### TD-NNN - <title>` section format from `techdebt.md`, extracting severity from the `- **Severity:** ...` line and status from `- **Status:** ...`. Retire `parseSeverityMap` or update it to parse the severity table format. Align with the format `fmtChunks()` produces.
- **Found in slice:** codebase-scan-engine
### TD-128 - sendToolCallSync blocks for full timeout on every CGC query - MCP server never exits
- **Area:** Performance / Correctness
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/bin/graph-cgc.js
- **Description:** Every call to cgcQuery() -> sendToolCallSync() spawns a new `cgc mcp start` process via execFileSync, writes 3 JSON-RPC messages on stdin, and waits for the process to exit. MCP servers are persistent long-running processes that do not exit after a single tool call. Therefore execFileSync always blocks until its timeout (default 10 seconds) before SIGKILL-ing the child. In practice every graph query costs a 10-second wall-clock delay plus process-spawn overhead. The comment on lines 118-138 acknowledges the approach "won't work for stdio" and falls through to sendToolCallSync anyway. The long-polling approach in sendRequest (lines 76-116) exists and is correct but is never used by cgcQuery.
- **Impact:** Any workflow that reaches the CGC provider path - gsd-t graph, enrichWithOverlay in cgcProvider - imposes a 10-second penalty per query, making interactive use unusable and automated scans that touch multiple entities minutes-slow.
- **Remediation:** Either (a) adopt the persistent process pattern: start cgcProcess once (startCgcServer already exists but is never called), use sendRequest (the async stdio approach) for all queries, and shut down on process exit; or (b) add a 'cgc query' one-shot CLI subcommand that accepts a tool name and JSON args and exits, so execFileSync can get a real exit code. Remove the dead sendRequestSync/startCgcServer functions.
- **Found in slice:** code-graph-engine

### TD-129 - Non-atomic multi-file write in graph-store - RESOLVED (M20–M21 dead engine deleted)
- **Area:** Data integrity
- **Severity:** HIGH
- **Status:** RESOLVED — 2026-06-26 10:46 PDT (M94 D7-T1). The entire M20–M21 dead engine deleted; the new M94 D3 SQLite store uses WAL + transactional putRecord (atomic per-file). See ✅ Resolved section.
- **Found in slice:** code-graph-engine
### TD-130 - isStale() misses deleted files - stale index never detected after file deletion
- **Area:** Correctness / Staleness detection
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/bin/graph-store.js
- **Description:** isStale() iterates sourceFiles (currently-existing files) and compares their hashes against meta.fileHashes. If a file was deleted since the last index, it is absent from sourceFiles and is never compared against the stored hash. The function returns stale:false if all surviving files have unchanged hashes, even though the index still contains entities from the deleted file. Dead entities (functions from removed files) persist in the graph indefinitely, inflating dead-code and call-chain results.
- **Impact:** Deleted functions stay in the graph forever. Dead-code queries report false positives. Call chains through deleted intermediaries appear valid. The index only self-heals on a force re-index.
- **Remediation:** In isStale(), also check: for every key in meta.fileHashes, does the corresponding absolute path still exist? If any stored hash key has no live file, mark as stale. O(|stored_files|) not O(|source_files|).
- **Found in slice:** code-graph-engine
### TD-131 - SAFE_ENTITY_RE in grep fallback allows path traversal and regex metacharacters
- **Area:** Security / Input validation
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/bin/graph-query.js
- **Description:** SAFE_ENTITY_RE = /^[\w.\-/\\:]+$/ (line 302) is used to gate entity names before passing them to grep. The regex allows '.' (a grep regex metacharacter meaning 'any char'), '/' and '\\' (path separators), and '..' via consecutive dots. A name like '../etc/passwd' passes the check (verified by running the regex). For getCallers, the name is passed as a literal grep pattern: execFileSync('grep', ['-rn', name + '(', ...]) - here grep receives name as a positional arg (not -e), so it's treated as a literal BRE pattern where '.' still means 'any char'. For getImporters, it's passed as -e 'import.*' + name - the name IS part of a regex, where '.' in e.g. 'foo.bar' matches 'fooXbar'.
- **Impact:** False positives in getImporters for any entity name containing a dot (common in JS: file.js, class.method patterns). Path traversal component '..' allows searching outside projectRoot if a grep version doesn't bounds-check the search dir.
- **Remediation:** For grep literal matching use fgrep (grep -F) or grep --fixed-strings. For -e patterns, escape regex metacharacters: name.replace(/[.+*?^${}()|[\]\\]/g, '\\$&'). Reject names containing '/' or '..' explicitly.
- **Found in slice:** code-graph-engine
### TD-132 - Unchecked Cypher injection via params.query in cgcProvider 'cypher' case
- **Area:** Security / Injection
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/bin/graph-cgc.js
- **Description:** The 'cypher' dispatch case (lines 493-496) passes params.query directly to execute_cypher_query with zero sanitization. Any caller that can influence params.query can execute arbitrary Cypher against the Neo4j instance, including destructive queries (MATCH (n) DETACH DELETE n). Additionally, the 'findCircularDeps' case interpolates params.maxDepth directly into a Cypher string template (line 445): MATCH path = (a:Function)-[:CALLS*2..${params.maxDepth || 5}]->(a)... . A non-integer maxDepth value or an injection string like '5}->(a) RETURN 1 UNION MATCH (n) DETACH DELETE n //' crafts a malformed/destructive query.
- **Impact:** Arbitrary Cypher execution against a potentially production Neo4j instance. DETACH DELETE can wipe the entire code graph. The severity depends on Neo4j credentials and network exposure, but the attack surface is any GSD-T caller that reaches cgcProvider.
- **Remediation:** For 'cypher': remove the passthrough or add an explicit allowlist of known-safe query templates. For maxDepth: validate with Number.isInteger(v) && v > 0 && v <= 20 before interpolation, defaulting to 5 on invalid input.
- **Found in slice:** code-graph-engine
### TD-133 - Proxy buffers gzip-compressed HTML then attempts string parsing without decompression
- **Area:** Review server - HTML proxy / injection
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/scripts/gsd-t-design-review-server.js
- **Description:** proxyRequest() (lines 450-470) identifies HTML responses and buffers all chunks, then calls Buffer.concat(chunks).toString('utf8') and performs string operations (replace('</body>', ...)). The code deletes content-encoding from the outgoing headers (line 467) to suppress the encoding hint, but it never actually decompresses the body before calling toString(). Vite's dev server (the typical target) sends gzip or brotli by default when the Accept-Encoding request header is forwarded unchanged (line 443 spreads req.headers). The result is that the buffered bytes are raw compressed data, not UTF-8 HTML; toString('utf8') produces garbage; the script injection fails silently; and the corrupted response body is sent to the browser with a wrong content-length.
- **Impact:** The review overlay inject script is never loaded in the proxied app, making inspect mode non-functional. The browser receives a malformed response body for every HTML page request. When Vite uses brotli, the browser may not even render the page. This breaks the core visual inspection feature of the design review workflow.
- **Remediation:** Before the proxy request, strip Accept-Encoding from the forwarded headers (or set it to 'identity') so the dev server returns uncompressed HTML. Alternatively, use Node's zlib.createGunzip() / zlib.createBrotliDecompress() to decompress based on the actual content-encoding header value before calling toString(). The simplest fix: delete req.headers['accept-encoding'] from the opts headers object before forwarding.
- **Found in slice:** design-to-code-pipeline
### TD-134 - Unsanitized item.id used directly in file paths - path traversal in review queue and feedback endpoints
- **Area:** Review server - feedback and queue file writes
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/scripts/gsd-t-design-review-server.js
- **Description:** item.id values from queue JSON files are used directly in path.join() calls at lines 329, 357, 419, and 820. For example: path.join(fbDir, `${item.id}.json`) and path.join(queueDir, `${reviewQueue[i].id}.json`). The queue files are written by the orchestrator but the feedback POST endpoint (line 768-784) also accepts an array of items from HTTP clients and calls writeFeedback() which writes `${item.id}.json` for each. If id contains '../' sequences (e.g. '../../.bashrc'), path.join resolves to a path outside REVIEW_DIR. The attachment filename uses safeId at line 398 (correctly sanitized), but the main item.id used for feedback and auto-reject filenames is not sanitized.
- **Impact:** A client (or malicious queue file) could write files outside the .gsd-t/design-review directory tree by supplying an id like '../../malicious'. This is a local-server tool, so the practical risk is mainly against misconfigured environments, but any feedback JSON with a crafted id would overwrite arbitrary files relative to REVIEW_DIR.
- **Remediation:** Apply the same sanitization used for attachment filenames (line 398) to item.id before constructing any file paths: const safeItemId = String(item.id).replace(/[^a-zA-Z0-9_-]/g, '_'); Use safeItemId everywhere item.id is used in path.join calls.
- **Found in slice:** design-to-code-pipeline
### TD-135 - Hardcoded 'Vue 3 + TypeScript' in all builder prompts - breaks React/Svelte/Angular projects
- **Area:** Design orchestrator - prompt generation
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/bin/design-orchestrator.js
- **Description:** Both buildPrompt() (line 116) and buildSingleItemPrompt() (line 150) hardcode 'You are building {singular} components for a Vue 3 + TypeScript project.' regardless of the actual project framework. The server-side detectFramework() correctly identifies React, Svelte, Angular, and Vue, but this detection result is never passed to the orchestrator. The guessPaths() function (line 310-317) also hardcodes '.vue' extensions and Vue directory conventions (src/components/elements, src/components/widgets, src/views). Claude will attempt to write Vue SFCs into React/Next/Svelte projects, producing either build errors or completely wrong component syntax.
- **Impact:** The design-build command is silently broken for all non-Vue projects. A React project will receive Vue SFC files with <script setup>, <template>, <style scoped> syntax. The builder agent will consistently produce wrong output across all three tiers (elements, widgets, pages) with no error - the orchestrator will proceed to review a Vue component in a React codebase.
- **Remediation:** Read the project's package.json at orchestrator init time (the server already does this at line 34) and pass the detected framework to buildPrompt()/buildSingleItemPrompt(). Parameterize the framework name, file extension (.vue/.tsx/.svelte), and the guessPaths() directory/extension mappings. Alternatively, read the design-contract's Stack Evaluation table which already records the framework.
- **Found in slice:** design-to-code-pipeline
### TD-136 - Missing gsd-t-dashboard-server.js crashes autostart at runtime
- **Area:** Broken dependency / dead code path
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** scripts/gsd-t-dashboard-autostart.cjs
- **Description:** Lines 132 and 145 of gsd-t-dashboard-autostart.cjs reference `./gsd-t-dashboard-server.js`. This file does not exist in the main branch's `scripts/` directory (only in stale worktrees). `require('./gsd-t-dashboard-server.js')` at line 132 will throw `MODULE_NOT_FOUND` synchronously when `ensureDashboardRunning` is called without a `port` option. The `spawn` at line 146 will also silently fail to start any server. Every call site in `bin/gsd-t.js` that invokes `ensureDashboardRunning` without a pre-resolved port is affected.
- **Impact:** Any consumer calling `ensureDashboardRunning()` without a port throws an unhandled exception; the dashboard feature is entirely broken in the published package.
- **Remediation:** Either commit the missing `gsd-t-dashboard-server.js` to `scripts/`, or guard the `require` with a try/catch that emits a useful error and returns `{ port: null, alreadyRunning: false }`. Also add an integration test that verifies the server script exists before publishing.
- **Found in slice:** real-time-agent-dashboard
### TD-137 - Unbounded POST /ingest body accumulation - no size limit
- **Area:** Denial of service / memory exhaustion
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** scripts/gsd-t-stream-feed-server.js
- **Description:** The `ingestStream` function (lines 260-286) accumulates all incoming bytes into a string `buf` with no maximum size check. A slow sender that never emits `\n` (or an accidental loop sending data faster than it is drained) can grow `buf` to gigabytes before the process OOMs or the OS kills it. The loopback-only guard (line 173) reduces exposure but does not eliminate it - any compromised local process can exploit this.
- **Impact:** Local denial of service: a misbehaving worker or accidental tight loop can exhaust server memory and crash the process, taking down the stream feed for all connected dashboard clients.
- **Remediation:** Add a `MAX_BODY_BYTES` constant (e.g. 64 MB) and track cumulative bytes received. If the limit is exceeded, call `req.destroy()`, respond 413, and clear `buf`. A per-line cap (e.g. 1 MB) on `line.length` before `JSON.parse` is also advisable.
- **Found in slice:** real-time-agent-dashboard
### TD-138 - WebSocket close frame encodes payload > 125 bytes - RFC 6455 violation
- **Area:** Protocol correctness / client disconnection
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** scripts/gsd-t-stream-feed-server.js
- **Description:** RFC 6455 §5.5 requires all control frames (opcode 0x8 close, 0x9 ping, 0xA pong) to have a payload of at most 125 bytes and to not be fragmented. `encodeWsCloseFrame` (lines 343-352) writes `body.length` directly into `header[1]` for any reason string length. When the JSON-encoded `kick` message plus code exceeds 123 bytes (2-byte code prefix + reason), the close frame becomes non-conformant: `header[1]` encodes a value > 125 without the required extended-length headers (126/127 prefix). Strict RFC-compliant clients (browser WebSocket API, many ws library defaults) may reject or silently drop the malformed frame, leaving the client stuck without a proper close handshake.
- **Impact:** Malformed close frames sent to backpressured clients; in the worst case the client's WebSocket state machine errors, the socket is orphaned, and the connection is never cleanly torn down.
- **Remediation:** Truncate the reason string to at most 123 UTF-8 bytes before encoding: `const r = Buffer.from((reason || '').slice(0, 123), 'utf8');`. Add an assertion `assert(body.length <= 125)` in tests.
- **Found in slice:** real-time-agent-dashboard
### TD-139 - token-log column index mismatch - updateTokenLog silently no-ops on every call
- **Area:** Token Aggregation
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** scripts/gsd-t-token-aggregator.js
- **Description:** updateTokenLog() at line 218 hard-codes column indices based on a 12-column table format that includes a 'Compacted' column: parts[8]=Tokens, parts[11]=Task. The actual token-log.md has 11 columns with no 'Compacted' column (confirmed against the live file): parts[7]=Tokens, parts[8]=Notes, parts[10]=Task, parts[11]=Ctx%. As a result: (1) taskCell = parts[11] reads 'Ctx%' values like 'N/A' as the task id - no row in byTask matches these - so `updated` is always 0. (2) Even if a match were found, the code would overwrite the 'Notes' column (parts[8]) instead of the 'Tokens' column. The function has never successfully updated the token-log.md since the schema diverged. The comment on line 218 documents the WRONG format.
- **Impact:** The token-log.md is never updated with real token counts from aggregated JSONL data. All token telemetry rows remain at their initial values forever. This is a silent no-op on every run.
- **Remediation:** Update the column indices to match the actual 11-column format: change `parts[11]` (taskCell) to `parts[10]` and `parts[8]` (tokenSummary write target) to `parts[7]`. Also update the format comment on line 218 to match the live schema. Add a test that exercises updateTokenLog against the actual token-log format.
- **Found in slice:** context-and-token-monitoring
### TD-140 - tail mode unbounded JSONL growth - writeTokenUsageJsonl always appends all rows
- **Area:** Token Aggregation
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** scripts/gsd-t-token-aggregator.js
- **Description:** In runTail(), every time groups grows (rows.length !== lastWroteRows), line 329 calls writeTokenUsageJsonl() which unconditionally appends ALL current rows to the output file (line 192: appendFileSync). There is no overwrite/dedup logic. After N group-count changes the file contains the triangular sum: 1+2+3+...+N rows instead of N unique rows. For a typical workflow run with ~10 task groups that accumulate sequentially, the JSONL ends up with 55 rows (10*11/2) instead of 10, with the first groups duplicated proportionally to how many updates occurred. This is an unbounded append problem - the file grows without bound across long tail sessions.
- **Impact:** token-usage.jsonl grows unboundedly during long tail sessions. Downstream consumers that read the file (token dashboards, metrics rollups) see duplicate task rows and overcount token usage significantly.
- **Remediation:** Replace the append pattern in writeTokenUsageJsonl with a write mode that either: (a) uses writeFileSync to overwrite the entire file with the current snapshot, or (b) deduplicates by task key before appending. Option (a) is simpler and correct for --tail mode since the groups map is always authoritative. Also note there is dead code at line 302 (`let acc = ''`) - a leftover from a prior refactor - that should be removed.
- **Found in slice:** context-and-token-monitoring
### TD-141 - verify.cjs \Z in JS regex is literal 'Z' - success criteria extraction fails at EOF
- **Area:** Context Brief Generation
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** bin/gsd-t-context-brief-kinds/verify.cjs
- **Description:** At line 66, the regex `/^##[^\n]*(?:Success Criteria|Falsifiable[^\n]*)\s*$([\s\S]*?)(?=^##\s+|\Z)/mi` uses `\Z` in the lookahead alternation. In JavaScript, `\Z` is not a valid regex escape sequence and is treated as the literal character 'Z'. The lookahead `(?=^##\s+|\Z)` therefore requires either a '##' heading OR the character 'Z' to follow the matched content. When the Falsifiable Success Criteria section is the LAST section in the charter file (no following '## ' heading), the lookahead never matches, the regex returns null, and `_successCriteriaFromCharter` returns `{source: rel, items: []}`. This is the common case since success criteria is typically the final section. The existing unit test (verify.test.js line 55-75) only tests the case where '## Other section' follows - the EOF case is untested and broken.
- **Impact:** The verify kind brief always returns an empty successCriteria array when the charter's Falsifiable Success Criteria section is last (the typical layout). The verify subagent receives no success criteria to validate against, defeating a key purpose of the brief.
- **Remediation:** Replace `\Z` with `$` anchored by a trailing `(?!\n)`-style pattern, or restructure to use a two-step approach: first locate the section heading, then capture everything until the next `##` or end of string. Fix: change the regex to `/^##[^\n]*(?:Success Criteria|Falsifiable[^\n]*)\s*$([\s\S]*?)(?=^##\s+|$(?!\n[^]))/mi` or simpler: extract the section body without a lookahead (find the heading, slice to next ## or end). Add a test for the EOF case.
- **Found in slice:** context-and-token-monitoring
### TD-142 - pre-commit-capture-lint hook invokes retired CLI subcommand - always fails, blocks all commits on any project that installs it
- **Area:** Pre-Commit Hook - Capture Lint
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/scripts/hooks/pre-commit-capture-lint
- **Description:** The hook calls `gsd-t capture-lint --staged` (line 21) and `gsd-t capture-lint --staged --check-stream-json` (line 33). The `capture-lint` CLI subcommand was deleted in M61 D3 along with `bin/gsd-t-capture-lint.cjs` (confirmed in CHANGELOG v4.0.10 and progress.md). The main `gsd-t.js` command dispatcher has no `capture-lint` case - it falls to the default handler which prints 'Unknown command: capture-lint' and exits 1. Since the hook does `if ! $GSD_T_BIN capture-lint --staged; then ... exit 1 fi`, any project that has installed this hook via `gsd-t init --install-hooks` will have ALL commits blocked unconditionally. The error message in the hook also references `captureSpawn({..., spawnFn})` which is a retired API.
- **Impact:** Any registered project that installed this opt-in hook has commits completely blocked. The hook is currently not installed in this project's .git/hooks/pre-commit, but it ships as a deployable artifact and `gsd-t doctor --install-hooks` could install it to other projects.
- **Remediation:** Either (a) remove `pre-commit-capture-lint` from the package or mark it clearly as retired/defunct, or (b) rewrite it to reference the current stream-json lint mechanism if that replaced capture-lint. Update the `gsd-t doctor --install-hooks` path to not offer this hook.
- **Found in slice:** unattended-supervisor-and-headless-mode
### TD-143 - MutationObserver counter consumed by eslint-exempt observers, breaking manifest stability
- **Area:** Journey Coverage Detector
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/bin/journey-coverage.cjs
- **Description:** In `detectMutationObserver` (line 215), `counter++` executes before the `isEslintExempt` check (line 217). When an eslint-exempt observer appears at position N, the counter slot is consumed but no listener is emitted. Any non-exempt observer after it receives a higher counter value than it would without the exempt one. The selector is `mutation-observer:{file}:{counter}`, so if an exempt observer is later added or removed before a previously-covered observer, that observer's selector value shifts. The manifest entry becomes stale (wrong counter number), triggering false GAP and STALE reports. By contrast, observers inside strings/comments correctly skip `counter++` via the early `masked()` continue - the eslint-exempt path is inconsistent with that pattern.
- **Impact:** Adding or removing any eslint-exempt MutationObserver before a covered non-exempt one invalidates all subsequent manifest coverage entries for that file, producing false coverage gaps and false stale entries until the manifest is regenerated.
- **Remediation:** Move `counter++` to after both the `masked()` check and the `isEslintExempt()` check, so only observers that will actually be emitted consume a counter slot. The selector generated at emit time then uses the incremented value. This is symmetric with how the masked path works and produces stable counter values regardless of how many exempt observers exist.
- **Found in slice:** testing-infrastructure
### TD-144 - startReplayServer() in replay-helpers.ts hard-requires retired M61 files at call time
- **Area:** E2E Fixture Helpers
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/e2e/fixtures/journeys/replay-helpers.ts
- **Description:** Lines 102-104 of `replay-helpers.ts` call `require(path.resolve(..., 'scripts', 'gsd-t-dashboard-server.js'))` and reference `scripts/gsd-t-transcript.html`. Both files were retired in M61 D4 and no longer exist in the repository. `gsd-t-dashboard-server.js` is missing entirely; `gsd-t-transcript.html` is also gone. `gsd-t-dashboard.html` still exists but is the wrong file. Any caller of `startReplayServer()` will throw a MODULE_NOT_FOUND error at runtime.
- **Impact:** Any E2E test that imports and calls `startReplayServer()` will fail immediately at the `require()` call with no graceful error. The function is currently unreferenced by active specs (no specs import replay-helpers), so the breakage is latent - but it is dead, broken code that silently poisons the fixture module.
- **Remediation:** Either delete `replay-helpers.ts` and its fixture NDJSON files entirely (since no spec uses them), or update `startReplayServer()` to use the current server infrastructure if it is still needed for future M52-style journey tests. The `replayFixture()` function also silently fails for a different reason (see separate finding) and should be reviewed together.
- **Found in slice:** testing-infrastructure
### TD-145 - model-selector.js diverges from model-selection-contract.md: plan→sonnet (should be opus), impact/complete-milestone/scan/backlog-promote missing
- **Area:** Model Selection
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** bin/model-selector.js, .gsd-t/contracts/model-selection-contract.md
- **Description:** The contract (model-selection-contract.md Phase Map, Status: ACTIVE) declares:
- `plan` → `opus` ("Task decomposition - cost of a bad plan is domino-effect rework")
- `impact` → `opus` ("Cross-module blast-radius analysis")
- `complete-milestone` → `opus` ("goal-backward verification")

But model-selector.js line 104 assigns `plan` → `sonnet` with `hasEscalation: true`. And `impact`, `complete-milestone`, `scan`, `backlog-promote` have no rules at all - they silently fall through to the `DEFAULT_TIER` (sonnet), overriding opus-designated phases.

Verified at runtime: `selectModel({phase:'plan'})` returns 'sonnet'; `selectModel({phase:'impact'})` returns 'sonnet' with reason 'Unknown phase'. The contract explicitly says this divergence is a defect: "any divergence is a defect" (contract §Phase Map).
- **Impact:** Plan phase runs on sonnet instead of the mandated opus. A weak plan increases downstream rework. Impact analysis runs on sonnet, potentially missing cross-module blast radius. The contract's Schema Freeze Policy says changes to canonical assignments must be reflected in both files atomically - this has not been done, so the contract is lying about what the system actually does.
- **Remediation:** Either (a) update model-selector.js to add rules for `impact` (opus), `complete-milestone` (opus), `scan` (sonnet or opus per decision), `backlog-promote` (sonnet), and change `plan` from sonnet to opus; OR (b) formally update the contract to reflect the current sonnet-for-plan decision with rationale. The two files must be in sync. Per the contract: changes to canonical assignments must be reflected in both this contract and `bin/model-selector.js` atomically.
- **Found in slice:** stack-rules-engine
### TD-146 - Stack Rules Engine is completely bypassed by M61 Workflow system - stack rules never injected into Workflow agent() spawns
- **Area:** Stack Rules Injection
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** bin/gsd-t-task-brief.js, templates/workflows/gsd-t-execute.workflow.js, templates/workflows/gsd-t-quick.workflow.js, templates/workflows/gsd-t-debug.workflow.js, templates/workflows/gsd-t-wave.workflow.js, bin/gsd-t-context-brief.cjs
- **Description:** The CLAUDE.md, README.md, and GSD-T-README.md all document that `gsd-t-execute`, `gsd-t-quick`, `gsd-t-integrate`, `gsd-t-wave`, `gsd-t-debug` inject stack rules into subagent prompts. The stack detection+injection logic lives in `bin/gsd-t-task-brief.js::detectStack()` + `loadStackRules()`. However:

1. The M61 Workflow scripts (`templates/workflows/gsd-t-execute.workflow.js` etc.) build their agent prompts from `lib.readScope()` + `lib.readDomainTasks()` + a context brief path - none of these carry stack rules.
2. `bin/gsd-t-context-brief.cjs` and all 11 kind collectors contain zero references to `detectStack`, `loadStackRules`, or `templates/stacks/`.
3. `templates/workflows/_lib.js` has no stack-detection or stack-injection function.
4. The stack-rules.test.js comment at line 361 says "Stack-rule injection now happens inside the Workflow runtime at agent() spawn time" - but there is no such code anywhere in the Workflow scripts.

The only path that still injects stack rules is the legacy `bin/gsd-t-task-brief.js` path, which is only called in test files (test/m40-task-brief.test.js) - not by any production Workflow.
- **Impact:** All post-M61 execute/quick/debug/wave/integrate runs receive zero stack rules in their worker prompts. React projects get no React standards enforcement. TypeScript projects get no TypeScript rules. Security (`_security.md`) and auth (`_auth.md`) universal rules are silently dropped from every agent spawn. The system documentation claims otherwise, creating a silent correctness regression.
- **Remediation:** Add stack detection and injection to `templates/workflows/_lib.js` (new `detectAndLoadStackRules(projectDir)` function) and thread its output into every `agent()` prompt in the Workflow scripts, similar to how `scope` and `tasks` are threaded. Alternatively, add a `stack-rules` kind to the context brief system so briefs carry the injected rules and workers can read them from the brief.
- **Found in slice:** stack-rules-engine

### TD-147 - queryBacklog always returns empty - parses table rows but file uses heading format
- **Area:** CLI / programmatic API
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/bin/gsd-t.js
- **Description:** The `queryBacklog` function (line 3832) filters for lines starting with `| ` and maps pipe-delimited cells to `{ id, title, status }`. The actual backlog.md format uses `## {N}. {title}` headings and `- **Type:** ... | **App:** ...` metadata lines - no table rows. Every correctly-formatted backlog will be parsed as zero items regardless of content. `gsd-t query backlog` always reports `{ items: [], count: 0 }`. Any consumer of this API (dashboards, status commands, brief generators) receives a permanently-empty backlog.
- **Impact:** Any feature consuming `gsd-t query backlog` silently sees no items. Currently used by at least the `gsd-t` CLI `query` subcommand and any workflow that calls it.
- **Remediation:** Rewrite `queryBacklog` to parse the heading format: split on `\n`, collect lines matching `/^## (\d+)\. (.+)$/` as entries. Extract type/app from the following `- **Type:** ... | **App:** ...` line. Return `{ id: N, title, type, app }` per entry.
- **Found in slice:** backlog-management
### TD-148 - backlog-settings remove-app does not check if removed app is the current Default App
- **Area:** Backlog settings state machine
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/commands/gsd-t-backlog-settings.md
- **Description:** Step 4 `remove-app` reads backlog.md to warn about entries using that app value, but never checks whether the app being removed is the current `Default App` in the Defaults section. After removing the default app, `gsd-t-backlog-add` will resolve `--app not provided` to an invalid app name, fail Step 4 validation, and block all new items until the user manually invokes `gsd-t-backlog-settings default-app <valid-name>`. No warning is issued at removal time.
- **Impact:** Silent state corruption: the settings file contains a Default App that is no longer in the Apps list. Every subsequent `gsd-t-backlog-add` without `--app` will fail validation.
- **Remediation:** In `remove-app` handling, after the usage check, also check: if the app-to-remove equals the current `Default App` value, warn: `'{name}' is the current Default App. Removing it will break gsd-t-backlog-add until you set a new default. Remove anyway and clear the default? (y/n)`. On confirm, remove the app and set Default App to the first remaining app (or empty).
- **Found in slice:** backlog-management
### TD-149 - Patch lifecycle applyPatch and recordMeasurement are never called in the workflow - entire promotion system is dead code
- **Area:** Patch lifecycle / complete-milestone orchestration
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** commands/gsd-t-complete-milestone.md, bin/patch-lifecycle.js
- **Description:** The five-stage patch lifecycle (candidate → applied → measured → promoted → graduated) is incomplete in the actual workflow. In complete-milestone.md Step 2.5b, the inline Node snippets call `createCandidate`, `checkPromotionGate`, `promote`, and `graduate`, but neither `applyPatch` nor `recordMeasurement` is ever called - anywhere in the commands/, bin/, or scripts/ tree (grep confirmed). Consequences: (1) Patches are created as candidates but never transitioned to 'applied'. (2) `metric_after` stays null and `improvement_pct` stays null indefinitely. (3) `checkPromotionGate` receives a patch whose `improvement_pct` is null, so `(null || 0) <= 55` is always true, making the gate always return `passes: false`. (4) `getPatchesByStatus('applied', ...)` and `getPatchesByStatus('measured', ...)` always return empty arrays because no patch ever leaves 'candidate'. The entire rule-engine→patch-lifecycle feedback loop produces zero promotions and zero graduations in practice.
- **Impact:** The patch auto-improvement system that the GSD-T methodology describes as a continuous learning loop delivers zero value. Rules fire, candidates are created, but no patch is ever applied or measured, so no methodology improvements propagate.
- **Remediation:** Add `applyPatch(patchId, projectDir)` calls in Step 2.5b immediately after candidate creation (to apply the template edit to the target file), and add `recordMeasurement(patchId, milestoneId, actualMetricValue, projectDir)` at each subsequent milestone to track real improvement. Expose `applyPatch` and `recordMeasurement` in the workflow steps with concrete metric values sourced from `mc.readTaskMetrics()`.
- **Found in slice:** project-init-and-lifecycle
### TD-150 - patch-lifecycle.js: graduation is permanently unreachable for patches promoted with fewer than 3 pre-promotion measurements
- **Area:** Patch lifecycle / graduation logic
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** bin/patch-lifecycle.js
- **Description:** `graduate()` checks `patch.measured_milestones.length < 3` (line 116). However, `recordMeasurement()` only processes patches whose status is `'applied'` or `'measured'` (line 68). Once `promote()` sets status to `'promoted'` (line 102), `recordMeasurement` silently returns without adding new milestone IDs. Therefore `measured_milestones` can never grow after promotion. The minimum measured_milestones.length to pass `checkPromotionGate` is 2 (line 86). A patch promoted with exactly 2 measurements can never reach 3 and will never graduate. Even if a patch accumulated 3 measurements before promotion (the only way graduation becomes reachable), there is no mechanism in the workflow to add post-promotion measurements. The graduation criterion comment says 'promoted for 3+ additional milestones' but the code checks total historical measurements - a semantic mismatch between intent and implementation.
- **Impact:** No patch ever graduates to a permanent methodology artifact, making the graduated-patch path of the learning loop permanently non-functional.
- **Remediation:** Either: (a) change the graduation check to a separate counter `post_promotion_milestones` that is incremented by a new `recordPostPromotionMilestone()` call in the workflow, or (b) lower the graduation threshold to 2 measurements if the intent is 'sustained over the same milestones used for promotion', or (c) allow `recordMeasurement` to operate on promoted patches by including `'promoted'` in the status check at line 68.
- **Found in slice:** project-init-and-lifecycle
### TD-151 - patch-lifecycle.js: improvement_pct treats all metrics as 'higher is better', causing lower-is-better metrics (fix_cycles) to be silently inverted
- **Area:** Patch lifecycle / metric direction
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** bin/patch-lifecycle.js, bin/rule-engine.js
- **Description:** `recordMeasurement` computes `improvement_pct = ((metricAfter - metricBefore) / |metricBefore|) * 100` (line 73). For `fix_cycles` (lower is better), a patch that reduced fix cycles from 5 to 2 produces improvement_pct = -60%, which fails `checkPromotionGate`'s `<= 55` check. Conversely, a patch that increased fix cycles from 1 to 2 produces improvement_pct = +100%, which passes the gate. The patch-templates.jsonl schema has no `direction` field, and `patch-lifecycle.js` contains no direction-aware logic. The test in patch-lifecycle.test.js (line 209) validates metricBefore=2, metricAfter=3 produces 50% 'improvement' for `target_metric: 'fix_cycles'` - an increase in fix_cycles is framed as improvement. As a result, patches that improve 'lower is better' metrics can never be promoted, and patches that worsen them may be promoted.
- **Impact:** The primary fix_cycles template (tpl-001) can never promote, defeating the core purpose of the rule engine. Any patch targeting a 'lower is better' metric is permanently excluded from the promotion system.
- **Remediation:** Add a `direction` field to patch templates (`'higher_is_better'` | `'lower_is_better'`) and adjust `improvement_pct` calculation in `recordMeasurement` to invert the sign for `lower_is_better` metrics. Update `checkPromotionGate` to use the corrected signed improvement. Update patch-templates.jsonl to include direction for existing templates (fix_cycles → lower_is_better).
- **Found in slice:** project-init-and-lifecycle
### TD-152 - fetchLatestVersion in gsd-t-update-check.js always returns null due to syntax error in inline node -e script
- **Area:** Update Check / SessionStart Hook
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** scripts/gsd-t-update-check.js
- **Description:** Line 40 contains an inline node -e script with a syntax error: `r.on('data',(c)=>d+=c;` - the semicolon after `d+=c` terminates the arrow function body but the closing `)` for `r.on()` is missing. Running this script produces `SyntaxError: missing ) after argument list` (exit code 1). The outer `execFileSync` catch silently returns `null`. As a result, `fetchLatestVersion()` always returns `null`, the `cached` object is never populated, and the SessionStart hook never emits `[GSD-T AUTO-UPDATE]` or `[GSD-T UPDATE]` signals - auto-update from SessionStart is completely broken. The `gsd-t.js` CLI path (using the separate `scripts/gsd-t-fetch-version.js`) is unaffected and works correctly.
- **Impact:** Every GSD-T session silently skips the auto-update path. Users never see update banners from the SessionStart hook. Accumulated update lag on managed installs.
- **Remediation:** Fix the inline script: change `r.on('data',(c)=>d+=c;` to `r.on('data',(c)=>{d+=c});`. Alternatively, replace the inline script with a call to the already-correct `scripts/gsd-t-fetch-version.js` (same pattern as `bin/gsd-t.js` uses).
- **Found in slice:** metrics-telemetry-and-events
### TD-153 - Date guard produces false positives on Write of progress.md containing historical decision-log entries
- **Area:** Date Guard / Progress Log Correctness
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** scripts/gsd-t-date-guard.js, commands/gsd-t-log.md
- **Description:** The `decision-log` pattern (`/^- (\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):/gm`) is validated against ±DRIFT_MINUTES (5 min) of the live clock for ALL Write calls (where `oldContent = ''`). When `/gsd-t-log` Step 6 (full reconstruction from git history) or `/gsd-t-populate` writes a progress.md containing historical entries (e.g., `- 2024-01-15 09:30: Initial commit`), the guard blocks the Write with a false positive, even though these are legitimately historical. The Edit dedup only protects when old_string already contains the entry. Verified: a Write of progress.md with even one entry dated more than 5 minutes ago returns `{ ok: false }` and blocks the tool call.
- **Impact:** The `/gsd-t-log` full-reconstruction path and `/gsd-t-populate` git-history reconstruct are blocked at the Write step, causing the model to receive a tool error and potentially loop, produce partial results, or silently fail to update progress.md.
- **Remediation:** Either (a) add `progress.md`'s decision log section to the allowlist when content matches a full-reconstruct pattern, (b) narrow the decision-log pattern to require timestamps within the last 24h for Write operations (use a `dateOnly`-style day check for decision-log entries in Write mode), or (c) teach `/gsd-t-log` and `/gsd-t-populate` to exclusively use Edit (append) rather than Write (replace) for progress.md. The most surgical fix is option (b): for `decision-log` on Write, validate same-calendar-day rather than ±5 min.
- **Found in slice:** metrics-telemetry-and-events
### TD-154 - rollup.jsonl (per-project ELO and milestone aggregation) is never written - gsd-t-metrics ELO display is dead code
- **Area:** Metrics Completeness / Feature Parity
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** commands/gsd-t-metrics.md, commands/gsd-t-status.md, bin/metrics-collector.js
- **Description:** gsd-t-metrics.md Step 2 reads `.gsd-t/metrics/rollup.jsonl` for per-milestone ELO and aggregation data. Steps 3 (Process ELO), 5 (Domain Breakdown with duration), and 6 (Trend Comparison) all require rollup.jsonl data. No code in `bin/` or `scripts/` writes this file. `global-sync-manager.js` manages a separate `~/.claude/metrics/global-rollup.jsonl` (global cross-project), not the local per-project file. gsd-t-status.md acknowledges the missing file with a fallback for `first_pass_rate`. ELO display, domain breakdown by duration, and trend comparison are effectively dead - they silently show no data rather than erroring.
- **Impact:** Users see stub/empty ELO sections in /gsd-t-metrics output. The telemetry system's core value proposition (ELO-based process quality tracking across milestones) is non-functional. gsd-t-status metrics section falls back to a minimal first-pass-rate only display.
- **Remediation:** Implement a `writeProjectRollup()` function in `bin/metrics-collector.js` (or a new `bin/metrics-rollup.js`) that computes and writes `.gsd-t/metrics/rollup.jsonl` at the end of each execute/verify phase. Or remove ELO from the command documentation until the write path exists, to prevent user-facing misleading empty sections.
- **Found in slice:** metrics-telemetry-and-events
### TD-155 - context-brief-contract.md KINDS list is stale - 6 listed, 11 implemented after M56
- **Area:** Contract Drift - Stale Enumeration
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** .gsd-t/contracts/context-brief-contract.md
- **Description:** The contract at line 37 lists `KINDS` as `['design-verify','execute','qa','red-team','scan','verify']` (6 kinds, M55-era). M56 D2 added 5 more: `discuss`, `impact`, `milestone`, `partition`, `plan`. Confirmed on disk: `bin/gsd-t-context-brief-kinds/` contains 11 files: design-verify.cjs, discuss.cjs, execute.cjs, impact.cjs, milestone.cjs, partition.cjs, plan.cjs, qa.cjs, red-team.cjs, scan.cjs, verify.cjs. The CLI flag description at line 54-55 says `--kind X` must be one of `KINDS`, which would appear to reject the 5 new kinds if taken literally.
- **Impact:** Any agent or operator reading the contract's KINDS list will have an incomplete picture of which brief kinds exist. Documentation generators, validators, or new kind collectors that cross-check against the contract's KINDS constant will be missing 5 valid entries. The `--domain` requirement at line 55 also needs updating to cover the 5 new kinds.
- **Remediation:** Update `KINDS` in the contract to list all 11 kinds. Update the `--domain` requirement matrix to state which of the new kinds require a domain. Bump the contract to v1.1.0 (additive, non-breaking).
- **Found in slice:** living-document-contracts-and-state
### TD-156 - progress-file-format.md contract is missing ACTIVE status, Summary column, and M59 HH:MM TZ requirements
- **Area:** Contract Drift - Progress File Format
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** .gsd-t/contracts/progress-file-format.md, .gsd-t/progress.md
- **Description:** Three concrete discrepancies between the contract and reality: (1) Valid Status Values table (lines 29-45) does not include `ACTIVE`, but progress.md uses `## Status: ACTIVE - M79 COMPLETED ...` as its status. The cli-preflight `contracts-stable` check specifically looks for `Status: ACTIVE` to determine past-PARTITIONED state, so ACTIVE is a real status value that the contract simply omits. (2) The Completed Milestones table schema at line 78 shows 4 columns (`{name} | {version} | {YYYY-MM-DD} | v{version}`) but the actual table in progress.md has 5 columns (Milestone | Version | Completed | Tag | **Summary**). (3) The `## Date:` field at line 21 shows `{YYYY-MM-DD}` but CLAUDE.md M59 (v3.29.10+) mandates `YYYY-MM-DD HH:MM TZ` for all new entries from v3.29.10 onward. The contract was never updated to reflect M59.
- **Impact:** Agents writing or validating progress.md against this contract will: miss the ACTIVE status as valid, omit the Summary column from new Completed Milestones rows, and write date-only timestamps instead of the required HH:MM TZ format. The date-guard hook (`scripts/gsd-t-date-guard.js`) enforces M59, but the contract document itself is the reference agents read first.
- **Remediation:** Add ACTIVE to the Valid Status Values table with the note `Set By: (informal compound status for between-milestones state)`. Add the Summary column to the Completed Milestones table schema. Update `## Date:` format to `{YYYY-MM-DD HH:MM TZ}` with a note that this is mandatory from v3.29.10 (forward-only, pre-existing rows stay date-only).
- **Found in slice:** living-document-contracts-and-state

### TD-294 - M83 pre-mortem gate has no quiescence criterion — BLOCKs on ANY finding, loop may never terminate
- **Area:** Plan-hardening gate semantics / methodology
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** templates/workflows/gsd-t-phase.workflow.js (plan-hardening stage), .gsd-t/contracts/plan-hardening-contract.md
- **Description:** The pre-mortem verdict rule is binary — BLOCK on any concrete falsifiable finding lacking a test, with no severity threshold, no headline-materiality requirement, and no convergence/stop rule. A fresh-context adversarial agent pointed at a 20+ task plan can essentially always produce one more coverage-class finding, so the gate can loop indefinitely. MEASURED on M85 (2026-06-09): 4 cycles, finding counts 6 -> 3 -> 1 -> 3 (trajectory broke upward at cycle 4), ~280k subagent tokens per cycle, all 10 prior closures verified holding each round; resolved only by explicit human adjudication (user approved fold-and-proceed).
- **Impact:** Plan phase can consume unbounded tokens/wall-clock with diminishing returns; in unattended runs (no human to adjudicate) a milestone would stall at plan forever; pressure builds to weaken findings instead of fixing the stop rule.
- **Remediation:** Amend plan-hardening-contract.md with a quiescence criterion, e.g.: BLOCK only when a finding is CRITICAL, or HIGH AND headline-material; coverage-class MEDIUM/LOW findings convert to required tests without blocking; and/or a convergence rule — when a cycle produces no CRITICAL/HIGH-on-headline and all prior closures hold, verdict = CLEARED-WITH-NOTES (findings folded as tasks). Route the amendment through the standard contract-change process; this is also a candidate first case for the planned retro-agent governor (backlog #27).
- **Found in slice:** m85-plan-hardening-loop (live observation, not scan)

### TD-295 - gsd-t-phase plan path: agent narrative contradicts the gate verdict; workflow summary carries stale finding counts
- **Area:** Workflow result wiring / observability integrity
- **Severity:** HIGH
- **Status:** OPEN
- **Location:** templates/workflows/gsd-t-phase.workflow.js (plan-hardening result assembly)
- **Description:** In ALL FOUR M85 plan cycles (2026-06-09, runs wf_ff3459cc-c39, wf_215a63de-871, wf_46708ed1-863, wf_da3fb0fc-139) the planning agent's summary claimed "CLEARED" / "converged" while the authoritative preMortem.verdict in the same result envelope was BLOCK. The agent writes its narrative without (or before) seeing the gate stage's output, and the workflow concatenates the two without reconciliation. Additionally the workflow's top-level blocked summary line cited finding counts that did not match the current cycle's preMortem block in at least one cycle (cycle 4 said "3 findings" in the status line, which coincidentally matched but was assembled from the gate, while the narrative said zero — the orchestrating session had to parse the raw preMortem JSON every cycle to learn the truth).
- **Impact:** The result's human-readable summary is actively misleading on the single most important fact (did the gate pass). Any consumer that trusts result.summary over the preMortem block — including a human reading /workflows — will advance a BLOCKED plan. Violates the detached-fanout lesson (never trust narration; verify the artifact).
- **Remediation:** Derive the result summary's verdict sentence mechanically from preMortem.verdict and findings.length in the workflow script (deterministic string assembly), and prepend it BEFORE the agent narrative; never let agent prose state a gate outcome. Optionally pass the gate result INTO a final summarizer agent instead of using the planning agent's pre-gate narrative.
- **Found in slice:** m85-plan-hardening-loop (live observation, not scan)

## 🟡 Medium Priority

### TD-157 - gsd-t-init.md references the retired headless-auto-spawn.cjs spawn-time gate
- **Area:** Stale/incorrect documentation
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** commands/gsd-t-init.md
- **Description:** Line 351 of `gsd-t-init.md` (Step 11 Playwright Setup) states: 'The spawn-time gate in `bin/headless-auto-spawn.cjs` re-runs the install on first need if the project skipped this step.' The global `CLAUDE.md` at line 204 explicitly states this file was retired in M61: '(M61: replaced the retired `headless-auto-spawn.cjs` spawn-time gate - the Workflow runtime owns spawning now.)' The file does not exist in `bin/`. An agent reading this instruction would attempt to reference a gate that no longer exists.
- **Impact:** An agent following init.md may misreport the Playwright gate behavior, or future documentation writers may reference a non-existent component.
- **Remediation:** Remove the sentence from `gsd-t-init.md` Step 11 that references `headless-auto-spawn.cjs`. Replace with a note that the Workflow runtime handles spawn-time gate via `playwright-bootstrap.cjs` per the M61 contract.
- **Found in slice:** slash-command-library, project-init-and-lifecycle
### TD-158 - context-meter-config.json template ships with hardcoded 200K modelWindowSize - wrong for all 1M-window models
- **Area:** Context Meter Configuration
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** templates/context-meter-config.json, .gsd-t/.context-meter-state.json, bin/gsd-t.js
- **Description:** The template at line 4 sets `"modelWindowSize": 200000`. This value was correct for pre-Claude-4 models but is 5x too small for Opus 4.7/4.8 and Sonnet 4.5+ which have 1M context windows. The config is copied to new projects via `gsd-t init`. The CLAUDE.md global instructions explicitly state 'Opus 4.7/4.8 ship 1M context windows; the legacy meter at bin/token-budget.cjs was retired in M61.' The gsd-t-calibration-hook.js already uses `SAFE_DEFAULT_WINDOW = 1_000_000`. The 200K value causes the threshold alarm (75% = 150K tokens) to fire far too early on 1M-window sessions - at only 15% actual usage - triggering unnecessary headless-spawn routing.
- **Impact:** New projects initialized with gsd-t init get a 200K window config. The context meter triggers at 150K tokens (15% of actual 1M capacity), causing premature headless spawning and incorrect context percentage reporting in the status line.
- **Remediation:** Update the template to `"modelWindowSize": 1000000`. Also update the `thresholdPct` comment to reflect that the threshold now applies to the 1M window. The `checkDoctorContextMeter` function in gsd-t.js should also validate that installed project configs have been updated. Consider deprecating the field entirely since gsd-t-calibration-hook.js already uses model-aware resolution.
- **Found in slice:** context-and-token-monitoring, living-document-contracts-and-state
### TD-159 - backlog-remove Step 5 writes progress.md unconditionally but file may not exist
- **Area:** Document ripple consistency
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/commands/gsd-t-backlog-remove.md, /Users/david/projects/GSD-T/commands/gsd-t-backlog-add.md
- **Description:** Step 5 (`Log Removal`) instructs: 'Add a Decision Log entry in `.gsd-t/progress.md`' with no existence guard. Step 6 then says 'If `.gsd-t/progress.md` exists, update...' - contradicting Step 5. On a fresh project where `gsd-t-init` was not run (or only partially), progress.md may not exist. The LLM will attempt to write to the file, creating it mid-operation with only the removal log entry and no required frontmatter - corrupting the format. By contrast, `backlog-edit` (line 92) and `backlog-move` (line 76) correctly guard with 'If `.gsd-t/progress.md` exists'.
- **Impact:** In a project without progress.md, `gsd-t-backlog-remove` will create a malformed progress.md with only a partial removal log entry, breaking subsequent `gsd-t-status` and other progress.md readers.
- **Remediation:** Align Step 5 with Step 6: add 'If `.gsd-t/progress.md` exists' to the Step 5 instruction. Or make both steps unconditional and accept creating the file. The inconsistency across commands is the core defect.
- **Found in slice:** backlog-management
### TD-160 - Decision Log format inconsistent across all backlog commands - does not match contract
- **Area:** Document ripple / contract compliance
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/commands/gsd-t-backlog-remove.md, /Users/david/projects/GSD-T/commands/gsd-t-backlog-add.md, /Users/david/projects/GSD-T/commands/gsd-t-backlog-edit.md, /Users/david/projects/GSD-T/commands/gsd-t-backlog-move.md, /Users/david/projects/GSD-T/commands/gsd-t-backlog-promote.md, /Users/david/projects/GSD-T/.gsd-t/contracts/progress-file-format.md, commands/gsd-t-backlog-remove.md, commands/gsd-t-backlog-add.md, commands/gsd-t-backlog-move.md, commands/gsd-t-backlog-edit.md
- **Description:** The `progress-file-format.md` contract specifies Decision Log entries as: `- YYYY-MM-DD HH:MM: {description}` (dash-prefixed list item, with time). Backlog commands deviate: (1) `backlog-remove` Step 5 writes `| {YYYY-MM-DD} | Removed... |` - a table row format, no time, no dash prefix; (2) `backlog-add` Step 6 writes `{date} - Added backlog item...` - no dash prefix, no time, em-dash separator instead of colon; (3) `backlog-edit`, `backlog-move`, `backlog-promote` say 'Date: today's date' without specifying HH:MM. None of the backlog commands reference the `[GSD-T NOW]` signal for the live clock as required by the Live Clock Rule in CLAUDE.md.
- **Impact:** Progress.md accumulates malformed Decision Log entries in mixed formats. Status readers and the date-guard hook may reject or misparse entries. The date-guard hook explicitly validates `- YYYY-MM-DD HH:MM:` format.
- **Remediation:** Standardize all six backlog command Document Ripple steps to use the contract format: `- YYYY-MM-DD HH:MM: {description}` sourced from `[GSD-T NOW]`. Specifically fix `backlog-remove` Step 5 which uses completely the wrong format (table row).
- **Found in slice:** backlog-management, slash-command-library
### TD-161 - settings.json corrupted by five independent read-modify-write cycles during install
- **Area:** Installer correctness / race condition
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** bin/gsd-t.js
- **Description:** doInstall() calls five separate functions that each independently read settings.json, mutate an in-memory object, and write the file back: configureHeartbeatHooks (line 356), configureUpdateCheckHook (line 893), configureAutoRouteHook (line 973), configureInSessionHooks (line 1060), and configureContextMeterHooks (line 1550). Each function calls readSettingsJson(), which re-reads from disk at the time it's invoked. If any two of these five writes interleave - or if another process (e.g., Claude Code itself) writes settings.json between any two of these calls - the last writer wins and silently drops the hooks written by earlier writers. The five writes are sequential within a single Node.js process so concurrency is limited to external processes, but the install flow runs at session startup with Claude Code also active, making the race window real. The fix is to load settings.json once at the start of doInstall, pass the in-memory object through all five configurators, and write once at the end.
- **Impact:** On a machine where Claude Code is running during install (the normal case), hooks added by earlier configure* calls can be silently lost when a later call reads and overwrites settings.json. The user sees success messages but some hooks are missing, causing missed heartbeats, skipped auto-route, or dropped conversation capture.
- **Remediation:** Refactor doInstall to load settings.json once, pass the mutable settings object into each configure* function as a parameter, and flush to disk a single time after all hooks have been applied. The configure* functions already operate on in-memory objects - only the I/O calls at each function boundary need to move.
- **Found in slice:** cli-installer-updater
### TD-162 - Context meter PostToolUse hook still installed on fresh install despite M61 retirement
- **Area:** Installer correctness / dead code
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** bin/gsd-t.js
- **Description:** The comment at line 1757-1761 documents that the context meter was retired in M61 D1 and that installContextMeter / configureContextMeterHooks should not be called because gsd-t-context-meter.js was deleted. However, configureContextMeterHooks(SETTINGS_JSON) is still called unconditionally on line 1550 inside doInstall. The hook command it installs (CONTEXT_METER_HOOK_COMMAND, line 411-412) uses a guard that silently exits 0 if the script is absent, so there is no runtime error - but every fresh install or update still writes a dead PostToolUse hook entry into settings.json. showStatusContextMeter (line 1822) is also still called unconditionally in doStatus and will always display 'N/A (meter hook not run this session)' for every user. The functions installContextMeter, configureContextMeterHooks, promptForApiKeyIfMissing, resolveApiKeyEnvVar, checkDoctorContextMeter, and the associated constants (CONTEXT_METER_SCRIPT, CONTEXT_METER_DEPS_DIR, CONTEXT_METER_CONFIG_TEMPLATE, CONTEXT_METER_CONFIG_DEST, CONTEXT_METER_GITIGNORE_ENTRIES, CONTEXT_METER_HOOK_MARKER, CONTEXT_METER_HOOK_COMMAND, CONTEXT_METER_STALE_PATTERNS) are all dead weight (~200 lines).
- **Impact:** Every install adds a dead hook entry to settings.json (noise, extra PostToolUse invocations that silently no-op). Status output always shows 'Context: N/A' which is confusing. The dead code adds ~200 lines of maintenance burden and contributes to cognitive load when reading the installer.
- **Remediation:** Remove the configureContextMeterHooks call from doInstall (line 1550), the showStatusContextMeter call from doStatus (line 1822), and all the associated dead constants and functions. Also remove the context-meter-related entries from UNATTENDED_GITIGNORE_ENTRIES if they are no longer relevant.
- **Found in slice:** cli-installer-updater
### TD-163 - parseTestResult in debug-loop yields false negatives: 'error' substring matches any error mention
- **Area:** Headless execution correctness
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** bin/gsd-t.js
- **Description:** parseTestResult at line 3962 marks output as failed if it contains the word 'error' (line 3971: /\berror\b/.test(out)). This is applied to the full lowercased output string. Any test run that reports '0 errors', 'no error found', or uses the word 'error' in a passing summary (e.g., 'error handling tests passed') will be classified as failed=true regardless of whether it also matched a passed pattern. The result is { passed: passed && !failed }. Since 'failed' is true for any 'error' mention, even a clean test run that says 'all tests passed, error-handling suite: ok' would be classified as STILL_FAILS, causing unnecessary debug iterations.
- **Impact:** Debug-loop iterations that actually succeed are classified as failures, consuming the full 20-iteration budget without fixing anything. The loop exits with code 1 instead of code 0, upstream orchestrators treat clean outputs as broken.
- **Remediation:** Tighten the failed heuristic to match structured failure patterns rather than bare 'error'. Use patterns similar to the mapHeadlessExitCode regexes already in the file: require a non-zero count prefix for error counts (e.g., /\b([1-9]\d*)\s+errors?\b/), or require a clearly terminal line like /^error:/im. At minimum, exclude 'error' from the single-word check and require 'errors' to be accompanied by a count or structural context.
- **Found in slice:** cli-installer-updater

### TD-164 - registerProject read-then-write on PROJECTS_FILE has no lock - concurrent register calls can lose entries
- **Area:** Race condition / installer correctness
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** bin/gsd-t.js
- **Description:** registerProject (line 282) reads PROJECTS_FILE, appends to the in-memory array, and writes the full file back. If two gsd-t register or gsd-t init processes run simultaneously (e.g., in a script that initializes multiple projects), both read the same state, both write their updated array, and one registration is silently lost. The write is not atomic (plain writeFileSync with no tmp+rename). Additionally, stale entries are never pruned: projects that no longer exist on disk are validated out of getRegisteredProjects but never removed from the file, so PROJECTS_FILE grows unboundedly.
- **Impact:** In normal single-user interactive use the race is unlikely. In CI pipelines or scripts that call gsd-t init in parallel for multiple projects, one or more registrations can be silently dropped, breaking update-all propagation.
- **Remediation:** Use a tmp+rename pattern for the write (write to PROJECTS_FILE + '.tmp.' + process.pid, then fs.renameSync) to make the write atomic on POSIX. For the stale-pruning issue, filter out missing paths in getRegisteredProjects and write the cleaned list back when stale entries are found. A file lock (e.g., via a lock file with a short spin) would fully address the concurrent-register race but may be overkill for a CLI installer.
- **Found in slice:** cli-installer-updater
### TD-165 - scan command is a do-nothing stub - silently succeeds without executing any scan
- **Area:** Dead / missing functionality
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** bin/gsd-t.js
- **Description:** The case 'scan' handler at line 4552 only logs a notice about an export flag if present, then breaks. No scan logic is invoked. The help text at line 4232 does not list 'scan' as a CLI command, so users invoking 'gsd-t scan' get no output and no error - the command silently succeeds (exit 0). This is deceptive: the /gsd-t-scan slash command in commands/ invokes a Workflow, but the CLI entry point does nothing.
- **Impact:** A developer scripting around gsd-t scan (e.g., in CI) gets exit 0 with no output and no analysis performed. Silent success on a do-nothing stub is a correctness bug.
- **Remediation:** Either delegate 'gsd-t scan' to the Workflow script via spawnSync (like the other Workflow-backed commands), or remove the case and let the default handler emit an 'unknown command' error. If 'gsd-t scan' is intentionally a no-op (the Workflow handles it), remove the case entirely and add a comment in the CLI switch explaining that scan only runs via the Workflow (not the CLI).
- **Found in slice:** cli-installer-updater
### TD-166 - Integrate agent in gsd-t-execute.workflow.js missing required model: field
- **Area:** Model Display contract compliance
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** templates/workflows/gsd-t-execute.workflow.js
- **Description:** Line 181-185 calls `agent(integratePrompt, { label: 'integrate', phase: 'Integrate', schema: INTEGRATE_RESULT_SCHEMA })` without a `model:` field. The Model Display contract in CLAUDE.md (§ Model Display, MANDATORY) requires every Workflow `agent()` call to declare its model explicitly. The integration agent performs cross-domain wire-up and conflict resolution - this should be `model: 'sonnet'` per the mid-tier reasoning criteria (the standalone gsd-t-integrate.workflow.js assigns sonnet to the same task at line 58). All other agent() calls in execute.workflow.js (the domain workers at line 144) correctly declare `model: 'sonnet'`.
- **Impact:** The Workflow runtime emits a `⚙ [{model}] {label}` line per stage for real-time visibility. Without a model declaration, the runtime uses an unspecified default - the user cannot see which model handled integration, and the contract's traceability requirement is broken. On a rate-limit event, the runtime cannot apply the correct backoff tier for the model being used.
- **Remediation:** Add `model: 'sonnet'` to the integrate agent options at line 183-184: `agent(integratePrompt, { label: 'integrate', phase: 'Integrate', schema: INTEGRATE_RESULT_SCHEMA, model: 'sonnet' })`
- **Found in slice:** workflow-orchestration-engine
### TD-167 - Hardcoded m61 commit prefix in four workflow scripts - wrong for any other milestone
- **Area:** Prompt correctness / methodology
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** templates/workflows/gsd-t-debug.workflow.js, templates/workflows/gsd-t-quick.workflow.js, templates/workflows/gsd-t-phase.workflow.js, templates/workflows/gsd-t-integrate.workflow.js
- **Description:** Four workflow scripts instruct their agents to use a hardcoded 'm61' commit prefix regardless of the actual milestone being executed: debug.workflow.js line 60 (`'m61(debug-cycle${cycle})'`), quick.workflow.js line 57 (`'m61(quick)'`), phase.workflow.js line 84 (`'m61(${phaseName})'`), and integrate.workflow.js line 54 (`'m61(integrate)'`). All four scripts receive `milestone` as an arg. The execute.workflow.js correctly avoids this - it tells domain workers to 'make commits' without dictating the prefix, leaving it to the worker to derive from context. The gsd-t-debug and gsd-t-quick workflows are also used across ALL milestones (they are general-purpose tools, not milestone-specific).
- **Impact:** Every commit made by these workflows on a project working on M62, M63, M70, or any non-M61 milestone will be tagged with 'm61(...)' in the git log. This corrupts the commit history traceability that GSD-T uses to track which milestone changed which file. The Progress Decision Log and architecture audit tools that grep commit messages by milestone prefix will misreport coverage.
- **Remediation:** Replace the hardcoded 'm61' with the `milestone` variable: e.g., `\`${milestone}(debug-cycle${cycle})\`` in debug.workflow.js, `\`${milestone}(quick)\`` in quick.workflow.js, `\`${milestone}(${phaseName})\`` in phase.workflow.js, and `\`${milestone}(integrate)\`` in integrate.workflow.js. For debug and quick which do not always receive a milestone, fall back: `${milestone || 'fix'}(debug-cycle${cycle})`.
- **Found in slice:** workflow-orchestration-engine
### TD-169 - Orchestrator element auto-correction silently mutates design contract files without user confirmation
- **Area:** Destructive Action Guard violation
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** bin/orchestrator.js
- **Description:** Lines 786-868 implement an 'element inventory validation' that reads design contract files (.gsd-t/contracts/design/{phase}/*.contract.md), finds element name references that don't match the current element inventory, uses a word-overlap heuristic to pick a 'closest' replacement, then silently writes the modified contract back (line 856: `fs.writeFileSync(cfPath, content)`). The CLAUDE.md Destructive Action Guard explicitly requires stopping before 'Removing or replacing existing files/modules that contain working functionality' and 'Any change that would require other parts of the system to be rewritten'. Contracts are defined interfaces - silently rewriting them changes what the downstream build agents are instructed to implement. The matching regex is hardcoded to only catch a specific set of component prefixes (chart-, legend-, stat-, table-, select-, tabs-, date-, pagination, icon, tooltip) - any other component type is silently ignored. The bestScore >= 2 threshold can produce wrong substitutions: any two-word-share between different component types would trigger a replacement.
- **Impact:** A contract referencing a renamed or typo'd element can get auto-corrected to the wrong component (e.g. 'stat-card' might become 'data-card' if 'card' and a prefix share ≥2 words with a wrong element). The build agent then implements the wrong component, but no error is reported because the correction was silent. The heuristic also misses any component type not listed in the regex - those silently pass through as undetected drift.
- **Remediation:** Remove the silent auto-correction. Replace with a preflight check that (a) reports which contracts reference unknown elements, (b) halts with an error and lists the missing elements and their closest matches, (c) asks the user to update the contract manually. If auto-correction is kept, it must: log clearly what will be changed before writing, require an explicit --auto-correct CLI flag, and not use the hardcoded prefix list (instead check all referenced identifiers against the full inventory).
- **Found in slice:** workflow-orchestration-engine
### TD-170 - SIGKILL escalation timer leaks: never canceled when child exits cleanly after SIGTERM
- **Area:** Process lifecycle management
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** bin/parallel-cli.cjs
- **Description:** `_killChild` (line 338) sends SIGTERM and then creates a `setTimeout` that fires SIGKILL after `SIGKILL_GRACE_MS` (5000ms). The timer reference is created inside `_killChild` and never returned. The call sites (`child.__pcli_cancel` at line 282 and `timeoutTimer` at line 290) pass `killTimer=null` to `_killChild`. The `close` handler at line 296 does `clearTimeout(killTimer)` - but `killTimer` is always null (it was never written by `_killChild`). So the SIGKILL timer always fires 5 seconds after SIGTERM is sent, regardless of whether the child already exited cleanly. If the child's PID has been recycled by the OS within those 5 seconds, SIGKILL is delivered to an unrelated process. `.unref()` prevents the timer from keeping the Node process alive, but does not cancel it.
- **Impact:** In normal operation the PID recycling window is small and the OS rejects SIGKILL to non-children with ESRCH (caught silently). However in high-concurrency scenarios with many short-lived children, PID recycling becomes more likely. The main correctness impact is that processes that exit quickly after SIGTERM still tie up the SIGKILL timer, creating a 5-second delay before the test runner or verify-gate can cleanly exit.
- **Remediation:** Return the timer handle from `_killChild` and store it in a variable visible to the close/error handlers: `killTimer = _killChild(child)`. Then `clearTimeout(killTimer)` in both handlers correctly cancels the pending SIGKILL. Alternatively, store the timer on the child object itself (`child.__pcli_sigkill_timer`).
- **Found in slice:** parallel-execution-and-task-graph
### TD-171 - estimateTaskFootprint M61 stub lacks estimatedCwPct field - unattended CW gate is permanently broken
- **Area:** Mode-aware gating (unattended)
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** bin/gsd-t-parallel.cjs
- **Description:** The M61 stub at line 44-46 returns `{ inputTokens: 0, outputTokens: 0, costUSD: 0, source: 'm61-stub' }` - it does not include `estimatedCwPct` or `split`. At line 264, `est = estimateTaskFootprint({...})` therefore produces an object with `est.estimatedCwPct === undefined`. The catch block at line 265-266 is only for thrown exceptions, not for missing properties, so the catch-time default `estimatedCwPct: 0` is not reached. At line 280, `computeUnattendedGate({ estimatedCwPct: undefined })` coerces to 0 (via `Number.isFinite(undefined) === false`), so `gate.split` is always false. The `task_split` event (line 282-289) can never fire, and the `'parallel-split'` decision label (line 325) is permanently dead. `est.split` at line 325 is also undefined (falsy), so `'parallel-split'` is doubly unreachable.
- **Impact:** The unattended-mode per-worker context-window gate is non-functional. Tasks that would exceed the 60% CW threshold are never signaled for splitting. This causes unattended workers to potentially run tasks that exceed their context budget without any advance warning, leading to mid-task compaction or truncated output.
- **Remediation:** Either (a) update the stub to return `{ estimatedCwPct: 0, split: false, ...}` so at least the gate logic is exercised with neutral values, or (b) replace the stub with a real implementation that reads task size from tasks.md line count or scope.md file sizes as a heuristic. Option (a) is the minimal fix; option (b) restores the intended gate.
- **Found in slice:** parallel-execution-and-task-graph
### TD-172 - Double event emission for D4 dep-vetoed and D5 disjointness-fallback tasks
- **Area:** Event stream correctness
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** bin/gsd-t-parallel.cjs, bin/gsd-t-depgraph-validate.cjs, bin/gsd-t-file-disjointness.cjs
- **Description:** `validateDepGraph` (D4) internally appends a `dep_gate_veto` event (event_type field) for each vetoed task via `_appendEvent` in `gsd-t-depgraph-validate.cjs` lines 36-46. Then `runParallel` in `gsd-t-parallel.cjs` at lines 227-233 iterates `depVetoed` and appends a second `gate_veto` event (type field, different schema) for the same tasks. Similarly, `proveDisjointness` (D5) appends `disjointness_fallback` events internally (gsd-t-file-disjointness.cjs line 47-55), and then `runParallel` at lines 249-256 appends a second `gate_veto` event for the same sequential tasks. Each vetoed/fallback task therefore generates 2 JSONL lines: one from the gate module (with its full schema) and one from `runParallel` (with a different, sparser schema). The event types also differ (`dep_gate_veto` vs `gate_veto`; `disjointness_fallback` vs `gate_veto`), breaking any tooling that reads the event stream.
- **Impact:** Dashboard, visualizer, and `gsd-t status` tools that parse `.gsd-t/events/YYYY-MM-DD.jsonl` see each veto/fallback twice. Deduplication by `task_id` is not possible because the two events have different `type`/`event_type` keys. Over a session with many vetoed tasks, the event log grows at 2× the expected rate and query results double-count decisions.
- **Remediation:** Remove the redundant `appendEvent` calls from `runParallel` in `gsd-t-parallel.cjs` (lines 227-233 for D4, lines 249-256 for D5). Each gate module already writes the canonical event. If `runParallel` needs to emit additional metadata not in the gate-module events, use a distinct event type (e.g. `parallel_gate_summary`) emitted once per run rather than per task.
- **Found in slice:** parallel-execution-and-task-graph
### TD-173 - gsd-t-partition.md 'Next Up' hint references retired /gsd-t-discuss command
- **Area:** Stale/incorrect documentation
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** commands/gsd-t-partition.md
- **Description:** `gsd-t-partition.md` line 52 says: '(`/gsd-t-discuss` first if the milestone is architecturally complex.)' The `/gsd-t-discuss` command was retired in M38 and no longer has a command file in `commands/`. `gsd-t-help.md` line 232 (Note M38) explicitly states these conversational commands 'are now handled by the Smart Router's conversational mode.' An agent seeing this instruction would try to invoke `/gsd-t-discuss` which does not exist as a standalone slash command. The `discuss` phase is still available via the phase workflow runner (`gsd-t-phase.workflow.js`), but must be triggered differently.
- **Impact:** Agent attempting to invoke `/gsd-t-discuss` will fail because no command file exists; depending on Claude Code behavior it may silently skip or error.
- **Remediation:** Update the hint in `gsd-t-partition.md` line 52 to say: 'Use `/gsd "let's discuss the architecture before partitioning"` first if the milestone is architecturally complex.' This routes through the Smart Router which now handles the discuss phase inline.
- **Found in slice:** slash-command-library
### TD-174 - global-change.md uses wrong package name @tekyz/gsd-t instead of @tekyzinc/gsd-t
- **Area:** Incorrect configuration/reference
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** commands/global-change.md
- **Description:** `global-change.md` line 98 specifies the fallback GSD-T package directory as `node_modules/@tekyz/gsd-t/`. The actual published package is `@tekyzinc/gsd-t` (confirmed by `package.json`: `"name": "@tekyzinc/gsd-t"`). The prefix `@tekyz` vs `@tekyzinc` differs. An agent following the fallback resolution would look for the package at the wrong path, fail to find it, and then ask the user - degrading the `copy` operation UX.
- **Impact:** The `copy` fallback path resolution fails silently; agent falls through to asking the user for the directory path instead of finding it automatically.
- **Remediation:** Change `node_modules/@tekyz/gsd-t/` to `node_modules/@tekyzinc/gsd-t/` on line 98 of `global-change.md`.
- **Found in slice:** slash-command-library
### TD-175 - gsd-t-gap-analysis.md is missing Step 5 - numbering jumps from Step 4 to Step 6
- **Area:** Structural gap/missing content
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** commands/gsd-t-gap-analysis.md
- **Description:** The step sequence in `gsd-t-gap-analysis.md` is: Step 0.5, Step 1, Step 1.5, Step 2, Step 3, Step 4, then directly Step 6 (line 174). Step 5 is entirely absent. This is not a renumbering artifact - the jump from team-based classification (Step 4) to document generation (Step 6) skips what should be a synthesis/result-collection step where the lead gathers outputs from the 10-teammate fan-out before writing the document. The watch-state advance call also jumps from step 4 to step 6 (line 174 `--step 6`), confirming the gap is in the original source.
- **Impact:** An agent strictly following numbered steps may skip the synthesis phase, writing the Step 6 document from incomplete data if team mode was used.
- **Remediation:** Add Step 5: Synthesize Team Results - the lead reads each teammate's output and merges the classification tables before writing the gap analysis document in Step 6. This is implied by the Step 4 team-mode instructions ('Lead: collect classification results, resolve conflicts, merge results') but has no formal step.
- **Found in slice:** slash-command-library
### TD-176 - gsd-t-health.md valid status list is missing INITIALIZED, ROADMAPPED, ACTIVE, and EXECUTING
- **Area:** Broken invariant / incomplete validation
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** commands/gsd-t-health.md
- **Description:** `gsd-t-health.md` line 59 defines the valid status values as: `DEFINED, PARTITIONED, DISCUSSED, PLANNED, EXECUTED, SYNCED, INTEGRATED, VERIFIED, VERIFIED-WITH-WARNINGS, VERIFY-FAILED, COMPLETED`. Four status values written by other commands are missing from this allowlist: `INITIALIZED` (written by `gsd-t-init.md` line 182), `ROADMAPPED` (written by `gsd-t-project.md` line 171), `ACTIVE` (written by `gsd-t-complete-milestone.md` line 422 when resetting for the next milestone), `EXECUTING` (shown in `gsd-t-status.md` line 56 as a valid phase value). Any project using these statuses would be flagged as INVALID by the health check.
- **Impact:** Projects fresh from `/gsd-t-init` (status=INITIALIZED) or `/gsd-t-project` (status=ROADMAPPED) will report a false INVALID check when health is run, potentially triggering unnecessary repair attempts.
- **Remediation:** Add `INITIALIZED`, `ROADMAPPED`, `ACTIVE`, and `EXECUTING` to the valid status list in `gsd-t-health.md` line 59.
- **Found in slice:** slash-command-library
### TD-177 - gsd-t-help.md wave description says it runs partition→plan→impact→execute→test-sync→integrate→verify+complete but wave.md only runs execute+verify
- **Area:** Misleading documentation
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** commands/gsd-t-help.md, commands/gsd-t-wave.md
- **Description:** `gsd-t-help.md` line 292 says wave '**Runs**: partition → plan → impact → execute → test-sync → integrate → verify+complete'. But `gsd-t-wave.md` is clear: it composes only two sub-workflows - `gsd-t-execute` (which internally does preflight→brief→disjointness→parallel-workers→integrate→verify-gate) and `gsd-t-verify` (which does the orthogonal triad). Wave does NOT run partition, plan, impact, or test-sync as phases. These must be run manually before invoking wave. The help description implies wave is a full project lifecycle command when it is actually an execute+verify orchestrator.
- **Impact:** Users expecting wave to run partition/plan/impact will be surprised when those phases are skipped; they may run wave on an unplanned milestone and get domain-worker failures because no tasks.md exists.
- **Remediation:** Update `gsd-t-help.md` line 292 to accurately describe wave's scope: '**Runs**: execute (preflight → brief → disjointness → parallel domain workers → integrate → verify-gate) → verify (orthogonal triad → synthesis → complete-milestone). Partition, plan, and impact must be run first.'
- **Found in slice:** slash-command-library
### TD-178 - checkin.md uses 'git add -A' which is explicitly prohibited by the pre-commit gate and cpua.md
- **Area:** Policy violation / security
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** commands/checkin.md
- **Description:** `checkin.md` line 40 instructs: 'Stage all changes (including the version bump and changelog) with `git add -A`'. The global `CLAUDE.md` pre-commit gate and `cpua.md` explicitly prohibit `git add -A`: 'When staging files, prefer adding specific files by name rather than using "git add -A" or "git add ."... which can accidentally include sensitive files (.env, credentials) or large binaries.' The `cpua.md` equivalent step explicitly says 'Never `git add -A`' and 'Stage only relevant files explicitly.' The `checkin.md` command is used by non-GSD-T projects too and could inadvertently commit runtime logs, `.env` files, or other sensitive artifacts.
- **Impact:** A commit via checkin.md could include sensitive files, large binaries, or runtime noise that should not be in the repo.
- **Remediation:** Change `checkin.md` Step 11 to use explicit staged files: 'Stage the changed files explicitly using `git add <files>`. Include the version bump (`package.json`) and changelog (`CHANGELOG.md`) but review `git status` first and exclude runtime artifacts, logs, and `.env` files.'
- **Found in slice:** slash-command-library
### TD-179 - contracts-stable _isPastPartitioned regex never matches real progress.md heading format
- **Area:** Preflight check correctness
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** bin/cli-preflight-checks/contracts-stable.cjs, test/m55-d1-cli-preflight-checks/contracts-stable.test.js
- **Description:** The regex at line 41 is `/^\s*Status\s*:\s*\**\s*([A-Za-z\-]+)/gim`. The `^\s*` requires only whitespace before 'Status'. Real progress.md files use `## Status: ACTIVE - M79...` (an ATX heading). The `##` prefix is not matched by `\s*`, so the regex returns no match. Tested against the actual .gsd-t/progress.md: zero matches despite the file containing `## Status: ACTIVE`. The check therefore always returns `isPastPartitioned=false` for projects using the standard template format, making the check a permanent no-op - DRAFT contracts are never flagged regardless of milestone state. The existing test at test line 33-35 uses `'## Status\n\nStatus: ACTIVE\n'` which has a SEPARATE `Status: ACTIVE` line that happens to match - giving a false sense of coverage. The `## Status: ACTIVE` single-line format is never tested and returns false.
- **Impact:** DRAFT/PROPOSED contracts past the PARTITIONED state are never caught by the contracts-stable preflight check. The check silently passes on every run. This is a warn-severity check so it does not block execution, but it eliminates the safety net for contracts that remain DRAFT when they should be STABLE.
- **Remediation:** Update the regex to also match ATX headings and bold-prefixed formats: `/(?:^#{1,6}\s+|^\s*\*{0,2}\s*)Status\s*:?\s*\**\s*([A-Za-z\-]+)/gim`. Also add a test case for `'## Status: ACTIVE'` (the actual progress.md format) that asserts true.
- **Found in slice:** verify-gate-and-ci-parity
### TD-180 - _buildSummary mutates caller's track2.notes array via .push()
- **Area:** Verify-gate output integrity
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** bin/gsd-t-verify-gate.cjs
- **Description:** Inside _buildSummary (lines 479-510 in the while loop), when worker output truncation occurs, the function calls `track2.notes.push(truncatedNote)` directly on the caller's track2 object (lines 479-480 and 509-510). This mutates the passed-in track2 reference. The same truncatedNote can be appended again if _buildSummary is ever called more than once with the same track2 (e.g. in tests or if the caller retries). Verified: calling _buildSummary with `summaryTokenCap=50` and two large workers appends 'truncated: 1 more failed workers' to the input object's notes array. The returned envelope's `track2.notes` and `summary.track2` both reference the same mutated array. This contaminates the canonical track2 result that runVerifyGate returns.
- **Impact:** The returned envelope's track2.notes contains spurious truncation notes that weren't there before the build - callers inspecting track2.notes will see entries that are artifacts of the summary-building process rather than track2 execution. In tests that reuse a track2 fixture, repeated calls accumulate noise.
- **Remediation:** Replace `track2.notes.push(truncatedNote)` and `track2.notes.sort()` with a local copy: `const notes = [...(track2.notes || []), truncatedNote].sort()`. Return the notes in the summary object separately from the canonical track2 notes, or pass a separate notes sink array into _buildSummary.
- **Found in slice:** verify-gate-and-ci-parity
### TD-181 - playwright.config.mjs not detected - ESM playwright configs skip E2E in Track 2
- **Area:** Verify-gate test coverage detection
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** bin/gsd-t-verify-gate.cjs
- **Description:** The _detectDefaultTrack2 function at line 282 checks for three config filenames: `playwright.config.ts`, `playwright.config.js`, `playwright.config.cjs`. It does NOT check for `playwright.config.mjs`. Playwright supports ESM configs (playwright.config.mjs) as a valid configuration format. Projects using this format will have their E2E test suite silently excluded from Track 2. This contradicts the E2E Enforcement Rule in CLAUDE.md: 'Running only unit tests when E2E tests exist is a test failure.'
- **Impact:** A project with playwright.config.mjs gets a verify-gate PASS verdict without any E2E testing. CI can report VERIFIED on a milestone where E2E tests would fail. Particularly problematic because playwright.config.mjs is increasingly common in modern TypeScript/ESM projects.
- **Remediation:** Add `playwright.config.mjs` to the detection check at line 282: `has('playwright.config.ts') || has('playwright.config.js') || has('playwright.config.cjs') || has('playwright.config.mjs')`.
- **Found in slice:** verify-gate-and-ci-parity

### TD-182 - execSync calls in branch-guard, working-tree-state, ports-free have no timeout
- **Area:** Preflight check reliability
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** bin/cli-preflight-checks/branch-guard.cjs, bin/cli-preflight-checks/working-tree-state.cjs, bin/cli-preflight-checks/ports-free.cjs
- **Description:** All three checks call execSync without a `timeout` option: branch-guard line 44 (`git branch --show-current`), working-tree-state line 37 (`git status --porcelain`), ports-free line 48 (`lsof -nP -iTCP:<port> -sTCP:LISTEN`). If any of these hang (slow network-mounted git repos, git hooks that make network calls, lsof waiting on unresponsive sockets), the entire preflight run hangs indefinitely, blocking the verify-gate from completing. The preflight contract (cli-preflight-contract.md) states the API is synchronous and never throws, but a hung execSync violates the spirit of this contract.
- **Impact:** An unresponsive git or lsof call will hang the entire verify phase with no timeout, no error, and no way to abort short of killing the parent process. This is particularly problematic in CI/CD environments or network-mounted repos.
- **Remediation:** Add `timeout: 10000` (10 seconds) to all three execSync calls and convert any `ETIMEDOUT` error to an ok=false result with a descriptive msg. The ports-free check already handles lsof errors gracefully (lines 55-57) - just add the timeout option.
- **Found in slice:** verify-gate-and-ci-parity
### TD-183 - Synthesis verdict has no programmatic invariant enforcing Red Team FAIL → VERIFY-FAILED
- **Area:** Verify workflow correctness
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** templates/workflows/gsd-t-verify.workflow.js
- **Description:** The synthesis agent at line 332 is the sole arbiter of the final verdict. Its only constraint is the natural-language prompt (lines 322-330) and the VERDICT_SCHEMA (which only validates that overallVerdict is one of three strings). There is no programmatic post-synthesis check that verifies: if Red Team verdict=FAIL then overallVerdict must be VERIFY-FAILED. A hallucinating synthesis agent could return VERIFIED even when the Red Team result object in triadResults has `verdict: 'FAIL'`. The JSON schema validates the shape but not the logical consistency between triadResults and the synthesis verdict.
- **Impact:** An adversarial or confused synthesis agent could grant VERIFIED status despite a Red Team FAIL (CRITICAL or HIGH bugs found). This contradicts orthogonal-validation-contract.md v1.0.0 Rule #1 ('Red Team FAIL blocks completion'). The probability is low with Opus 4.x but the invariant should be enforced in code, not just in prompts.
- **Remediation:** After the synthesis agent returns its verdict (line 337), add a programmatic guard: inspect triadResults for any result with `category === 'adversarial-security-boundaries'` and `verdict === 'FAIL'`. If found, downgrade overallVerdict to 'VERIFY-FAILED' unconditionally and add a note to blockingFindings. This is deterministic and prevents prompt-following failures from granting false VERIFIED status.
- **Found in slice:** verify-gate-and-ci-parity
### TD-184 - tryKroki is async but renderDiagram is synchronous - Kroki fallback is permanently dead code
- **Area:** Diagram Rendering
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** bin/scan-renderer.js:84-108, bin/scan-renderer.js:110-121
- **Description:** `tryKroki()` returns a `Promise` (it uses `https.request` with a `new Promise()` wrapper). `renderDiagram()` calls `tryMmdc()` then `tryD2()` synchronously and returns without awaiting Kroki. The comment at line 116 acknowledges this: `tryKroki is async; skip in sync rendering path`. The `https` module is imported but Kroki can never be reached. Any project without `mmdc` or `d2` always gets a placeholder, even when a Kroki server is running.
- **Impact:** The three-tier fallback documented in the module (mmdc → d2 → kroki) is actually two-tier (mmdc → d2 → placeholder). Users who set `KROKI_HOST` expecting to avoid installing mmdc/d2 will always get placeholder diagrams.
- **Remediation:** Either: (a) make `renderDiagram` async and await `tryKroki` as the third fallback, or (b) remove `tryKroki` and the `https` import entirely and document that only mmdc and d2 are supported. Option (a) requires callers (scan-diagrams.js) to await the result.
- **Found in slice:** codebase-scan-engine
### TD-185 - merged.includes(f) identity check is dead code - never filters anything
- **Area:** Scan Workflow Deduplication
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** templates/workflows/gsd-t-scan.workflow.js:479
- **Description:** In `finalFindings` construction (line 479), `allFindings.map(...).filter(Boolean).filter((f) => !merged.includes(f))` is intended to exclude original items that were merged. However, every item in a merge group has its index added to `dropped` (line 474, `idxs.forEach(i => dropped.has(i))`), and the spread before the filter already excludes `dropped` items via `(dropped.has(i) ? null : f)`. The `.filter((f) => !merged.includes(f))` then checks reference equality - `merged` contains NEW spread-copy objects (`keep = { ...allFindings[idxs[0]] }`), never the original references - so `merged.includes(f)` is always `false` and the filter is a no-op.
- **Impact:** No incorrect behavior today (the dedup still works because `dropped` does the real exclusion), but the dead filter adds confusion and could mask future bugs if the dedup logic is refactored. If someone removes the `dropped.add(idxs[0])` thinking the `merged.includes` filter handles it, duplicates would appear in the register.
- **Remediation:** Remove the `.filter((f) => !merged.includes(f))` call. The comment `// pump() increments inUse on grant` in acquire() already documents that dropped handles exclusion. Optionally add an explanatory comment that `dropped` is the sole dedup mechanism.
- **Found in slice:** codebase-scan-engine
### TD-186 - Heredoc delimiter GSDTEOF is not sanitized from chunk content - potential register truncation
- **Area:** Scan Workflow Register Writing
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** templates/workflows/gsd-t-scan.workflow.js:588, templates/workflows/gsd-t-scan.workflow.js:749
- **Description:** The chunk-write agent prompt instructs the subagent to use `cat >> path <<'GSDTEOF' ... GSDTEOF` for appending. If any finding's `detail`, `title`, `recommendation`, or other free-text field contains the literal string `GSDTEOF` on its own line, the heredoc terminates early and the remainder of that chunk is dropped as a shell command, potentially corrupting the register. The `ascii()` normalizer does not sanitize this token. While unlikely in normal LLM output, adversarial input (e.g. a finding about shell injection that uses this literal as an example) would trigger it.
- **Impact:** Silent register truncation at the finding containing `GSDTEOF`. Subsequent findings in the same chunk are dropped without error. The agent may then attempt to execute the trailing content as shell commands.
- **Remediation:** Use `sed 's/GSDTEOF/GSDTEOF_ESCAPED/g'` in `ascii()`, or switch the append instruction to use the Write tool (read existing content, concatenate chunk, write back) rather than a heredoc. The Write tool approach avoids shell injection entirely.
- **Found in slice:** codebase-scan-engine
### TD-187 - Domain mapping false-positives via String.includes() - short file path fragments match wrong entities
- **Area:** Correctness / Overlay mapping
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/bin/graph-overlay.js
- **Description:** mapDomains() (line 44) assigns a domain to an entity if files.some(f => entity.file.includes(f)). The scope.md file references like 'api' or 'bin' are plain substrings. An entity at 'bin/graph-api.js' would match a scope entry of 'api' because 'bin/graph-api.js'.includes('api') === true. Conversely, 'cabin.js'.includes('bin') === true - a domain owning 'bin/' would incorrectly claim 'cabin.js'. The same substring match applies in mapContracts (line 65, content.includes(entity.name)) and mapTests (line 114) - entity named 'get', 'set', 'on', 'run', or 'to' would match virtually every contract document.
- **Impact:** Domain assignments, contract mappings, and test mappings are systematically noisy. getDomainBoundaryViolations() produces false violations based on wrong domain assignments. Common function names like 'get' or 'on' map to every contract file.
- **Remediation:** Domain-to-file matching: use path.normalize and check that entity.file starts with f + '/' or equals f exactly (not substring). Contract/test matching: require word-boundary matching (\bname\b) or require entity.name to appear in a code-specific pattern (e.g., backtick reference `name` or exact symbol identifier).
- **Found in slice:** code-graph-engine
### TD-188 - isStale path separator inconsistency - always stale on Windows
- **Area:** Cross-platform correctness
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/bin/graph-store.js, /Users/david/projects/GSD-T/bin/graph-indexer.js
- **Description:** indexProject normalizes paths before storing in fileHashes: path.relative(projectRoot, filePath).replace(/\\/g, '/') (line 79-80 of graph-indexer.js). isStale() does not normalize: it looks up meta.fileHashes[path.relative(root, f)] (line 131 of graph-store.js) without the backslash replacement. On Windows, path.relative() produces backslash separators ('src\\foo.js'), so every lookup misses the stored forward-slash key ('src/foo.js'), causing isStale to always return {stale:true, changedFiles: all}. Every query triggers a full re-index.
- **Impact:** On Windows, performance degrades to a full re-index on every single query call. The 500ms debounce still fires indexProject on every non-excluded query type.
- **Remediation:** Add .replace(/\\/g, '/') to the key computation in isStale, or extract a shared normalizeRelPath(root, abs) helper used by both functions.
- **Found in slice:** code-graph-engine
### TD-189 - call resolution uses first-match-only by entity name - multi-file name collisions silently resolved wrong
- **Area:** Correctness / Graph accuracy
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/bin/graph-indexer.js
- **Description:** entityByName Map (lines 100-105) maps each entity name to the FIRST entity with that name and ignores duplicates. When resolving calls (lines 106-114), all call edges to a given callee name resolve to the first-seen entity with that name. In any project with functions named identically across files (e.g., every file exporting a 'validate', 'parse', 'init', or 'handler'), all incoming call edges point to the same arbitrary entity. This produces a single hot-spot in the call graph while other same-named functions appear to have zero callers.
- **Impact:** getCallers and findDeadCode results are wrong for any project using common function names across modules. findDeadCode may flag functions that ARE called as dead because their call edges were attributed to a different entity.
- **Remediation:** Resolve callee names to entity IDs by file context: the caller's file is known (call.caller contains filePath), so resolve to the entity in the same file or the imported file (cross-reference allImports for the caller's file). Fall back to a list of all matching entities if no import-based resolution is possible.
- **Found in slice:** code-graph-engine
### TD-190 - Python parser silently skips all dunder methods except __init__
- **Area:** Correctness / Parser coverage
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/bin/graph-parsers.js
- **Description:** parsePython() line 270: if (!defMatch[2].startsWith('_') || defMatch[2] === '__init__') skips all methods whose name starts with underscore, which includes ALL dunder/magic methods (__str__, __repr__, __len__, __eq__, __hash__, __enter__, __exit__, __call__, __getitem__, etc.). These are important public interface points in Python classes - they define iteration, context management, comparison, and string representation. They are entirely absent from the code graph.
- **Impact:** Call graph and dead-code analysis for Python code misses all dunder methods. __enter__/__exit__ for context managers, __getitem__ for custom collections, __call__ for callable objects are all invisible to the graph engine.
- **Remediation:** Change the filter to only skip single-underscore private methods: allow names that start with '__' (double underscore) as these are dunder/magic methods. Condition: !defMatch[2].startsWith('_') || defMatch[2].startsWith('__'). This correctly includes dunders while excluding _private helpers.
- **Found in slice:** code-graph-engine
### TD-191 - Log injection in advisor-integration via HTML comment terminator in question text
- **Area:** Security / Log integrity
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/bin/advisor-integration.js
- **Description:** logMissedEscalation formats the log entry as an HTML comment: <!-- missed_escalation {ts} ... q="{q}" -->. sanitizeOneLine() (line 85) replaces whitespace with spaces and trims but does NOT escape '-->' sequences. If the question or context values contain '-->', the HTML comment closes prematurely and the remainder of the sanitized string appears as raw markdown in token-log.md. Example: question = 'help --> ## Injected Header' produces: <!-- missed_escalation ... q="help --> ## Injected Header" --> which renders the injected header as visible markdown.
- **Impact:** Corrupts token-log.md rendering. An attacker or bug that controls the question argument can inject arbitrary markdown into the log file, potentially breaking downstream parsers that read token-log.md for metrics.
- **Remediation:** In sanitizeOneLine, also replace '-->' with '-- >' (or encode as '--&gt;'): return String(s).replace(/\s+/g, ' ').replace(/-->/g, '-- >').trim().slice(0, 500).
- **Found in slice:** code-graph-engine
### TD-192 - No request body size limit - feedback POST can OOM the server with large attachment payloads
- **Area:** Review server - POST endpoints
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/scripts/gsd-t-design-review-server.js
- **Description:** All four POST handlers (/review/api/ai-assist at line 649, /review/api/feedback at line 769, /review/api/exclude at line 788, /review/api/write-source at line 835) accumulate the full request body with `body += chunk` and no size limit. The /review/api/feedback endpoint is particularly risky because it accepts `attachments` arrays containing base64-encoded image data URLs (visible in the client code at gsd-t-design-review.html lines 1394-1409). A review session with many large screenshots could produce a feedback POST body many megabytes in size, all held in memory as a string before any processing.
- **Impact:** A feedback submission with multiple high-resolution screenshots can cause the Node.js process to run out of memory, crashing the review server mid-session. The review pipeline stalls and the build orchestrator's polling loop never sees review-complete.json, causing a timeout. In a developer workflow this is disruptive but recoverable; resuming from state may lose the feedback.
- **Remediation:** Add a body size limit check: track body.length during accumulation and reject (HTTP 413) if it exceeds a threshold (e.g. 50MB for the feedback endpoint, 1MB for others). Example: req.on('data', chunk => { body += chunk; if (body.length > MAX_BYTES) { req.destroy(); res.writeHead(413); res.end(); } });
- **Found in slice:** design-to-code-pipeline
### TD-193 - postMessage sent to '*' origin - inject script leaks computed styles to any parent frame
- **Area:** Design review inject script - postMessage origin
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/scripts/gsd-t-design-review-inject.js
- **Description:** All window.parent.postMessage() calls in gsd-t-design-review-inject.js use '*' as the target origin (e.g. lines 637, 675, 880, 904, 1065, 1116). The inject script runs inside an iframe inside the design review UI. Using '*' means that if the iframe is ever loaded in a different context (e.g. developer opens the proxied app directly in another tab that happens to be cross-framed, or a third-party page loads the app in an iframe), the message containing full computed styles, element paths, text content, and SVG attributes is delivered to that origin. Similarly, the window.addEventListener('message', ...) handler (line 689) accepts messages from any origin without checking e.origin.
- **Impact:** Computed styles, element content (textContent up to 100 chars), DOM paths, and SVG attributes are broadcast to any parent frame origin. For internal design tooling the practical risk is low, but if the project under review contains sensitive data rendered in the UI (user information, business data in charts), this data leaks to any embedding origin. The message handler also accepts style-mutation commands from any origin, so a malicious parent frame could silently modify the app's live styles.
- **Remediation:** Replace '*' in all postMessage calls with the actual review UI origin (e.g. `http://localhost:${PORT}`). In the message listener, validate e.origin against the expected review server origin and ignore messages from other origins. The review server port is passed as a known constant that can be embedded in the inject script at serve time.
- **Found in slice:** design-to-code-pipeline
### TD-194 - Proxy forwards client's Accept-Encoding header, causing brotli/deflate responses that are not handled
- **Area:** Review server - gallery and preview proxy paths
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/scripts/gsd-t-design-review-server.js
- **Description:** The gallery route (lines 539-568) and preview route (lines 583-616) each construct their own proxyOpts and spread ...req.headers directly, forwarding Accept-Encoding to Vite. Unlike proxyRequest() which at least deletes content-encoding before forwarding the response body, these inline proxy paths do not strip content-encoding from the response headers when buffering and modifying the HTML. Both paths do Buffer.concat(chunks).toString('utf8') on the raw response, which will produce garbage if Vite returns compressed content. The gallery path also writes the garbled HTML to a temp file (__gsd-preview.html) and then does a second proxy fetch of that file.
- **Impact:** The /review/gallery and /review/preview routes silently serve garbled content whenever Vite uses compression. Components never render correctly in the preview pane, making the entire visual review UI non-functional. The gallery is especially affected since it renders all queued components in a grid for side-by-side review.
- **Remediation:** In the proxyOpts for both gallery and preview routes, explicitly set `headers: { ...req.headers, 'accept-encoding': 'identity', host: ... }` to prevent compressed responses. Alternatively, decompress the buffer using zlib before calling toString().
- **Found in slice:** design-to-code-pipeline
### TD-195 - Measurement script uses shallow layout checks only - misses chart type, data, accessibility
- **Area:** Design orchestrator - Playwright measurement
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/bin/design-orchestrator.js
- **Description:** buildMeasureScript() (lines 230-289) generates a Playwright script that checks only: element exists, display !== 'none', width > 0, height > 0. This is the exact 'layout test (WRONG)' anti-pattern called out in CLAUDE.md's E2E Test Quality Standard. The design-to-code pipeline's own verification doc (design-verify-subagent.md) mandates checking chart type, colors, typography, spacing, SVG structure, and data labels - none of which this script measures. Passing measurements (all 4 checks green) gives false confidence that a component is correct even when it renders entirely the wrong chart type or shows placeholder data.
- **Impact:** The automated measurement gate that drives auto-rejection and review scoring is structurally blind to the most critical deviations: wrong chart type (donut instead of stacked bar), wrong orientation, wrong colors, placeholder data. Items that fail these design-critical properties pass the measurement gate and proceed to human review without a CRITICAL flag, defeating the purpose of automated pre-screening. The design-verify-subagent.md (Step 0.5) specifically calls out wrong data labels as the #1 failure mode.
- **Remediation:** Extend buildMeasureScript() to include contract-aware checks per component: (1) for chart elements, verify the expected SVG structure (donut = circle elements, bar = rect elements); (2) check at least one contract-specified color via getComputedStyle; (3) verify text content matches at least one label from the contract's Test Fixture. The full contract data is available in the queue item and can be embedded in the generated script.
- **Found in slice:** design-to-code-pipeline
### TD-196 - Design review command still uses bash poll loop - documented as an approach that fails
- **Area:** Design review command - gsd-t-design-review.md
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/commands/gsd-t-design-review.md
- **Description:** gsd-t-design-review.md Step 2 prescribes a bash `while [ ! -f ... ]; do ... sleep 5; done` poll loop for the Term 2 reviewer agent. The gsd-t-design-build.md command explicitly documents why this pattern was abandoned: 'Three separate attempts to enforce review gates via prompt instructions all failed. The JS orchestrator moves flow control out of prompts entirely.' The design-review command is the last remaining command using the discredited bash-poll-loop approach for an agent that must maintain long-running state across multiple queue items.
- **Impact:** The design-review reviewer agent will not reliably poll the queue in practice - Claude Code agents optimize for task completion and will exit the loop early, skip sleeps, or fail to re-enter the loop after processing items. Reviewer agent sessions quietly complete before all items are reviewed, leaving the orchestrator waiting indefinitely for AI review annotations that never arrive. This was the documented failure mode that led to creating the JS orchestrator.
- **Remediation:** Retire gsd-t-design-review.md's bash poll loop in favor of the AI review path already embedded in the orchestrator (buildReviewPrompt / buildAutoFixPrompt in design-orchestrator.js, invoked via the orchestrator's automated review cycles). The Term 2 reviewer is already modeled as orchestrator-spawned Claude invocations with structured output parsing; the separate poll-loop command is an orphaned design from before the orchestrator existed.
- **Found in slice:** design-to-code-pipeline
### TD-197 - TOCTOU race: lstatSync check then appendFileSync in event writer
- **Area:** Security / file integrity race
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** scripts/gsd-t-event-writer.js
- **Description:** Lines 128-132 of `appendEvent` perform: (1) `lstatSync(filePath).isSymbolicLink()` → return 2 if symlink, then (2) `appendFileSync(filePath, ...)`. Between the check and the write, an attacker can replace the regular file with a symlink (classic TOCTOU). The mitigation requires atomic `O_NOFOLLOW` semantics, which `fs.appendFileSync` does not provide on Node.js. This affects the `.gsd-t/events/YYYY-MM-DD.jsonl` files.
- **Impact:** A local attacker can redirect event log writes to an arbitrary file (e.g. overwrite a crontab or SSH authorized_keys) by winning the race between the lstat check and the append.
- **Remediation:** Use `fs.openSync(filePath, fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_CREAT | fs.constants.O_NOFOLLOW, 0o644)` followed by `fs.writeSync` and `fs.closeSync`. `O_NOFOLLOW` refuses to open a symlink and eliminates the race window.
- **Found in slice:** real-time-agent-dashboard
### TD-198 - WebSocket decoder silently drops high 32 bits of 64-bit payload length
- **Area:** Protocol correctness
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** scripts/gsd-t-stream-feed-server.js
- **Description:** In `decodeWsFrames` (lines 368-371), when `len === 127` (64-bit payload length), the code does `offset += 4` (skipping the high 32 bits) then `len = buf.readUInt32BE(offset)` (reading only the low 32 bits). This is incorrect per RFC 6455 §5.2: the 8-byte length is a single big-endian 64-bit integer. For payloads > 4 GB the decoded length will be wrong, but more practically for any frame where the high 32 bits are non-zero (including small exotic values), the parser will misalign and corrupt subsequent frames.
- **Impact:** Malformed frame parsing when a 64-bit length frame is received; subsequent frames in the same TCP segment are silently misaligned or dropped. No current code path generates such frames, but the bug is latent.
- **Remediation:** Use: `const hi = buf.readUInt32BE(offset); offset += 4; len = hi * 0x100000000 + buf.readUInt32BE(offset); offset += 4;`. In practice, also add a sanity cap (e.g. reject any single frame > 64 MB) since Node.js Buffers are limited to 2 GB anyway.
- **Found in slice:** real-time-agent-dashboard
### TD-199 - WebSocket decoder does not buffer partial frames across TCP data events
- **Area:** Protocol correctness / data loss
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** scripts/gsd-t-stream-feed-server.js
- **Description:** `decodeWsFrames` processes a single `buf` argument. When `buf.length - i < 2` (or any other incomplete-frame check triggers), the function silently breaks and drops the remaining bytes - there is no carry-over buffer. TCP does not guarantee message boundaries, so a multi-frame WS message split across two `data` events will lose the latter fragment. In practice the server only decodes client→server frames (close/ping), which are small and unlikely to fragment, but the invariant is violated.
- **Impact:** A WS close frame that arrives split across two TCP segments will be silently ignored; the server keeps the socket alive despite the client initiating close. Low probability in loopback use but a correctness violation.
- **Remediation:** Maintain a per-client `client.remainingBuf = Buffer.alloc(0)` and prepend it: `const full = Buffer.concat([client.remainingBuf, buf]);`. After the parse loop, store any trailing bytes in `client.remainingBuf`.
- **Found in slice:** real-time-agent-dashboard
### TD-200 - Dashboard HTML injects unescaped event fields into innerHTML - stored XSS
- **Area:** Security / XSS
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** scripts/gsd-t-dashboard.html
- **Description:** Lines 193 and 196-207 build HTML strings using template literals with unescaped event data: `ev.event_type`, `ev.model`, `ev.outcome`, `ev.command`, `ev.phase`, `ev.reasoning`, and the model name `n` are all interpolated directly into `mp.innerHTML` and `feed.innerHTML`. Additionally, lines 258-261 inject `d.domain` unescaped into a table's innerHTML. These fields are sourced from SSE frames served by the dashboard server; any stream-json frame with a crafted `event_type` like `<img src=x onerror=alert(1)>` will execute arbitrary JavaScript in the browser viewing the dashboard.
- **Impact:** Any agent process that emits a crafted `event_type` or `command` field can execute arbitrary JavaScript in the operator's browser when the dashboard is open. Severity is lower than typical because the SSE source is localhost, but a rogue subprocess or compromised tool output can reach this path.
- **Remediation:** Introduce a `esc()` helper (same as `escapeHtml` in `gsd-t-stream-feed.html`) and wrap every event field before template interpolation: `esc(ev.event_type)`, `esc(ev.model)`, etc. Alternatively, use `document.createElement` + `textContent` for all dynamic content instead of innerHTML.
- **Found in slice:** real-time-agent-dashboard
### TD-201 - stream-feed.html Maps (toolUseById, taskStartByKey) grow unboundedly - memory leak
- **Area:** Memory management / resource leak
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** scripts/gsd-t-stream-feed.html
- **Description:** `state.toolUseById` (Map, line 336), `state.taskStartByKey` (Map, line 337), `state.waveStartByNum` (Map, line 338), and `usageState.byTaskKey` (Map, line 366) are populated on every matching frame and never pruned. A long-running session with thousands of tasks will accumulate Map entries and DOM element references indefinitely. No `delete` or `clear` calls exist on these Maps anywhere in the file. `filterState.seen` (task/domain/wave Sets) similarly grows without bound.
- **Impact:** Long-running unattended sessions (the primary use case) will eventually exhaust browser memory, causing tab crashes or slowdowns after hundreds of tasks.
- **Remediation:** After a task reaches `done`/`failed` state, delete its entry from `toolUseById` for any tool_use IDs within that task. Cap `taskStartByKey` at e.g. last 500 tasks (prune oldest on insert). Similarly cap `waveStartByNum` and `filterState.seen` sets.
- **Found in slice:** real-time-agent-dashboard

### TD-202 - dashboard.html agentMap.current grows without bound - memory leak
- **Area:** Memory management / resource leak
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** scripts/gsd-t-dashboard.html
- **Description:** `agentMap.current` (line 128) and `modelCounts.current` (line 129) are plain objects that accumulate an entry per unique `agent_id` seen, and per model name, respectively. There is no eviction. In a long-running wave with many spawned agents, the graph (`newNodes`, `newEdges` at lines 150-160) is recomputed and laid out on every single incoming event - O(n²) Dagre layout work for n agents. After 1000 agents the layout computation will visibly freeze the browser tab.
- **Impact:** Progressive browser slowdown in long sessions; O(n²) graph layout on each event makes the dashboard unusable after ~500 agents, which is realistic for a multi-wave milestone.
- **Remediation:** Cap `agentMap.current` at a maximum number of agents (e.g. 200); evict completed agents (those with a terminal outcome) when the cap is reached. Debounce `setNodes`/`setEdges` calls - only re-layout when `agentMap` actually changes, not on every event.
- **Found in slice:** real-time-agent-dashboard
### TD-203 - writeTranscriptMarker path-traversal guard missing path.sep suffix
- **Area:** Compaction Detection
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** scripts/gsd-t-compact-detector.js
- **Description:** writeRow() at line 105 uses `resolvedMetrics + path.sep` as the containment prefix (correct: prevents paths like `.gsd-t/metrics-evil/` from matching). writeTranscriptMarker() at line 229 uses `path.resolve(transcriptsDir)` WITHOUT adding `path.sep`. A path like `/home/user/.gsd-t/transcripts-evil/payload.ndjson` would pass `startsWith(path.resolve('/home/user/.gsd-t/transcripts'))` but would be blocked by the correct `+ path.sep` form. In practice the transcriptPath comes from findActiveTranscript() which only returns actual filesystem entries (readdirSync), so user injection is not directly exploitable. However the inconsistency is a correctness defect that could matter if the path derivation changes.
- **Impact:** Low direct exploitability (transcriptPath is filesystem-derived), but the guard is weaker than the sibling writeRow() guard, creating an inconsistent security posture.
- **Remediation:** At line 229, change `path.resolve(transcriptsDir)` to `path.resolve(transcriptsDir) + path.sep` to match the defense-in-depth pattern used by writeRow().
- **Found in slice:** context-and-token-monitoring
### TD-204 - resolveTurnIdFromTranscript reads entire transcript synchronously on every PostToolUse hook
- **Area:** Heartbeat Hook
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** scripts/gsd-t-heartbeat.js
- **Description:** resolveTurnIdFromTranscript() at line 258 calls `fs.readFileSync(transcriptPath, 'utf8')` to load the full Claude Code session transcript every time PostToolUse fires. Real-world transcripts grow to 10-15 MB (confirmed: two observed transcripts at ~15 MB and ~10 MB in this project's `.claude/projects/` directory). Reading 15 MB synchronously on every tool call - which can fire dozens of times per minute in active sessions - creates measurable latency in the hook handler. The code comment says '~0ms' but this is based on the matching tool_use being 'near the end' and the scan stopping early. However, `readFileSync` always reads the entire file from disk before the scan begins. The `fs.existsSync` check does not reduce I/O.
- **Impact:** 10-15 MB synchronous read on every PostToolUse hook firing. In a busy session with rapid tool use, this can accumulate to hundreds of MB of I/O per minute, adding latency to each tool call and potentially causing observable slowdown in the Claude Code UI.
- **Remediation:** Replace the full readFileSync with a tail-read approach: use `fs.openSync` + `fs.readSync` to read only the last N bytes of the transcript (e.g. last 64 KB), since the matching tool_use is always in the most recent assistant turn. Alternatively, track the last-seen offset between hook calls. This avoids the 15 MB read on every tool invocation.
- **Found in slice:** context-and-token-monitoring
### TD-205 - gsd-t-auto-route.js produces wrong timezone abbreviation in UTC and single-word timezone environments
- **Area:** Auto-Route Hook - Timestamp
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/scripts/gsd-t-auto-route.js
- **Description:** The `liveTimestamp()` function at line 29 extracts the timezone by splitting the JS Date `toString()` parenthetical on spaces and joining the first letters: `tzMatch[1].split(' ').map(w => w[0]).join('')`. For multi-word timezone names like 'Pacific Daylight Time' → 'PDT' this works correctly. For single-word names: on macOS with TZ=UTC, `new Date().toString()` gives 'Coordinated Universal Time' → 'CUT' (wrong; expected 'UTC'). On CI/Docker/Linux systems configured to UTC, the Date toString() may give '(UTC)' → 'U' (wrong). The [GSD-T NOW] banner with a wrong timezone abbreviation causes the date guard in `scripts/gsd-t-date-guard.js` to receive an incorrect TZ and potentially fail timestamp validation. Verified empirically: `TZ=UTC node -e "..."` → tzShort='CUT'.
- **Impact:** All sessions running in UTC environments (CI, Docker, cloud desktops, servers) emit malformed [GSD-T NOW] timestamps with incorrect timezone labels. This degrades the dated banner's reliability for multi-day session tracking and may interact incorrectly with the date-guard hook.
- **Remediation:** Use `Intl.DateTimeFormat().resolvedOptions().timeZone` for the IANA timezone name, then map to an abbreviation using a lookup table or `Intl.DateTimeFormat(..., {timeZoneName: 'short'}).format(now)` which correctly returns 'UTC' for UTC environments. Alternatively, fall back to the numeric offset from `getTimezoneOffset()` when the extracted abbreviation doesn't look like a standard 2-4 letter code.
- **Found in slice:** unattended-supervisor-and-headless-mode
### TD-206 - gsd-t-tools.js stateSet: replacement string injection via value containing $ special chars corrupts progress.md
- **Area:** State Management - gsd-t-tools.js
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/scripts/gsd-t-tools.js
- **Description:** In `stateSet()` (lines 37-45), the value is sanitized to strip newlines (`String(value).replace(/[\r\n]/g, ' ')`) but then used directly in a `String.prototype.replace()` replacement string at line 44: `content.replace(re, \`$1${safeValue}\`)`. JavaScript's `String.replace()` interprets `$&` (whole match), `$1`-`$9` (capture groups), `$'` (post-match), and `` $` `` (pre-match) specially in replacement strings. If `value` contains `$&`, the replacement expands it to the full matched string, producing duplicated content. For example, `value = 'new $&injected'` on `content = '## Status: old_value'` yields `## Status: new ## Status: old_valueinjected`. Verified with a Node.js test: the output is demonstrably corrupted.
- **Impact:** Any progress.md field that gets set via `gsd-t-tools state set` with a value containing `$&`, `$1`, `$'`, or `` $` `` silently corrupts progress.md. In practice, CLI args rarely contain these chars, but it is a latent correctness bug in a core state-mutation primitive.
- **Remediation:** Replace the replacement string with a replacer function: `content.replace(re, (_, g1) => g1 + safeValue)`. This avoids all special replacement-string interpretation. Alternatively, escape dollars in safeValue: `safeValue.replace(/\$/g, '$$$$')`.
- **Found in slice:** unattended-supervisor-and-headless-mode
### TD-207 - Unattended config.json in this project is missing 'main' in protectedBranches - supervisor would have pushed to main unguarded
- **Area:** Unattended Supervisor Safety Config
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/.gsd-t/.unattended/config.json
- **Description:** The live `.gsd-t/.unattended/config.json` has `protectedBranches: ["master", "develop", "trunk", "release/*", "hotfix/*"]` - 'main' is absent. This project's primary branch is 'main' (`git symbolic-ref HEAD` = `refs/heads/main`). The template in `bin/gsd-t.js` at line 2704 now correctly includes 'main', but `ensureUnattendedConfig()` only creates the config when it doesn't exist (`if (fs.existsSync(configPath)) return false`) - so existing configs never get migrated. There is no config migration path. Any project whose config.json was generated before 'main' was added to the template will allow the supervisor to run while on the main branch without protection.
- **Impact:** If the unattended supervisor were functional (it is not, per Finding 1), it could run on the 'main' branch of this project and push commits or modify state without the protected-branch safety rail. For other projects registered with GSD-T that have functional supervisors and the same config generation timing, this is an active gap.
- **Remediation:** Add a migration step in `ensureUnattendedConfig()` that reads the existing config and adds 'main' if missing. Alternatively, add a `gsd-t doctor` check that warns when 'main' is absent from protectedBranches on a repo where main is the default branch.
- **Found in slice:** unattended-supervisor-and-headless-mode
### TD-208 - replayFixture() silently dispatches no frames - EventSource.dispatchEvent always throws on Real instances
- **Area:** E2E Fixture Helpers
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/e2e/fixtures/journeys/replay-helpers.ts
- **Description:** Lines 146-151: `replayFixture()` injects an init script that wraps `window.EventSource` and then calls `(es as any).dispatchEvent(ev)` on the real EventSource instance. The catch block silently swallows every exception with the comment 'Real EventSource won't accept synthetic events'. The function thus always delivers zero frames to the page, making it a no-op for its primary purpose. Any test using `replayFixture()` expecting frames to appear in the UI would silently see nothing and likely pass spuriously if it only checks element existence.
- **Impact:** If any future spec uses `replayFixture()` expecting frame replay, it will get zero frames with no error. Tests that check functional outcome (data rendered) would fail; tests that only check layout (element exists) would pass, violating the E2E functional-test quality standard. Currently no specs call it.
- **Remediation:** Remove or rewrite `replayFixture()`. The correct approach is to use `page.route()` to intercept the SSE URL and inject frames, as the comment itself notes. The current implementation should at minimum throw or log a warning rather than silently doing nothing.
- **Found in slice:** testing-infrastructure
### TD-209 - installPlaywrightSync() is exported but has zero test coverage
- **Area:** Playwright Bootstrap
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/bin/playwright-bootstrap.cjs, /Users/david/projects/GSD-T/test/m50-d1-playwright-bootstrap.test.js
- **Description:** `playwright-bootstrap.cjs` exports both `installPlaywright` (async, thoroughly tested with 9 test cases via a `_makeRunner` stub) and `installPlaywrightSync` (synchronous, lines 270-303). The test file has zero tests for `installPlaywrightSync`. The sync variant duplicates all the same logic as the async variant (package manager detection, chromium install, config file write, e2e scaffold) and is used by `bin/headless-auto-spawn.cjs` in worktrees. Error paths, idempotency, partial-install failures, and all four package manager branches are untested for the sync path.
- **Impact:** Silent regressions in `installPlaywrightSync` (e.g. error classification breakage, config write failure handling) will not be caught by the test suite. The sync path is the one called from synchronous hot paths in the orchestrator.
- **Remediation:** Add a `_makeRunnerSync` helper (parallel to `_makeRunner`) and a `describe('installPlaywrightSync')` block mirroring the async test cases: idempotent short-circuit, npm/pnpm/yarn/bun paths, package-manager-not-found error, chromium-download-failure + partial:true, config written, e2e placeholder written, existing e2e preserved.
- **Found in slice:** testing-infrastructure
### TD-210 - TRACKED_FUNCTIONS in journey-coverage.cjs is hardcoded to GSD-T-internal names and not extensible
- **Area:** Journey Coverage Detector
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/bin/journey-coverage.cjs
- **Description:** Line 29: `const TRACKED_FUNCTIONS = new Set(['connectMain', 'connect', 'fetchMainSession'])`. These are internal GSD-T viewer function names. The set is not exported in `module.exports` (only `KNOWN_KINDS` is). Consumers cannot extend the tracked function list without modifying the source. Any consumer project that wants to track their own entry-point functions (e.g. `initApp`, `connectWebSocket`) has no API to register them. The journey-coverage module is published as part of the `@tekyzinc/gsd-t` package and installed in consumer projects.
- **Impact:** Consumer projects cannot use the function-call detector for their own functions, limiting the journey-coverage tool to GSD-T's own viewer code. As the viewer is retired (M61), even these 3 hardcoded names may become dead coverage.
- **Remediation:** Export `TRACKED_FUNCTIONS` from `module.exports` and add a `registerTrackedFunction(name)` or `detectListeners(filepaths, { projectDir, trackedFunctions })` API. Also add `TRACKED_FUNCTIONS` to the contract documentation. As a quick fix, exporting the Set allows callers to mutate it: `jc.TRACKED_FUNCTIONS.add('initApp')`.
- **Found in slice:** testing-infrastructure
### TD-211 - detectPackageManager() does not detect bun.lock text format (Bun v1.1+)
- **Area:** Playwright Bootstrap
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/bin/playwright-bootstrap.cjs, /Users/david/projects/GSD-T/test/m50-d1-playwright-bootstrap.test.js
- **Description:** Line 20 checks for `bun.lockb` (binary lockfile format from Bun < v1.1). Bun v1.1+ (released 2024-03-07) switched the default lockfile to `bun.lock` (text format). Projects using Bun v1.1+ will have `bun.lock` not `bun.lockb`, so `detectPackageManager()` returns `'npm'` and installs Playwright with npm rather than bun. This results in a silent package manager mismatch in bun-primary projects. The test suite only tests `bun.lockb`.
- **Impact:** Playwright bootstrap runs `npm install` in a bun project, which may succeed but produces an npm lockfile alongside bun's lockfile, creating an inconsistent state and potentially causing CI mismatches in projects that enforce single-lockfile policies.
- **Remediation:** Add `if (fs.existsSync(path.join(projectDir, 'bun.lock'))) return 'bun';` before the `bun.lockb` check (or check both). Add a corresponding test case for `bun.lock` in the detectPackageManager describe block.
- **Found in slice:** testing-infrastructure
### TD-212 - detectStack() in gsd-t-task-brief.js is missing 18 of 26 supported stack templates
- **Area:** Stack Detection
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** bin/gsd-t-task-brief.js, templates/stacks/
- **Description:** The `detectStack()` function (lines 103-125) only detects 8 stacks from package.json (react, typescript, nextjs, vue, playwright, node-api, tailwind, prisma) and python from requirements.txt/pyproject.toml. But `templates/stacks/` contains 26 stack-specific templates (plus 3 universal `_`-prefixed files). Missing detections:
- `docker.md` - no Dockerfile/compose.yaml check
- `github-actions.md` - no .github/workflows/*.yml check
- `fastapi.md` - no fastapi dep in requirements.txt check
- `firebase.md` - no firebase dep check
- `flutter.md` - no pubspec.yaml check
- `graphql.md` - no graphql dep check
- `llm.md` - no openai/anthropic/langchain dep check
- `neo4j.md` - no neo4j dep check
- `postgresql.md` - no pg/postgres dep check
- `queues.md` - no celery/redis/bull dep check
- `react-native.md` - no react-native dep check
- `redux.md` - no @reduxjs dep check
- `rest-api.md` - no REST-specific check
- `supabase.md` - no @supabase dep check
- `vite.md` - no vite dep check
- `vue.md` - already detected, fine
- `zustand.md` - no zustand dep check
- `design-to-code.md` - no design-contract.md / .figmarc / figma.config.json check

The README.md documents design-to-code as "Auto-bootstraps during partition when design references are detected" but no such detection exists in code.

Additionally, the `stack-rules.test.js` `detectStacks()` helper is a synthetic test utility (not the real function) that detects `go.mod` → `go.md` and `Cargo.toml` → `rust.md`, but these template files (`go.md`, `rust.md`) do not exist in `templates/stacks/`. The README claims Go and Rust are supported stacks.
- **Impact:** Projects using Firebase, Docker, FastAPI, Flutter, GraphQL, Supabase, Vite, Redux, queues, or LLM libraries get no stack-specific rules injected. Design-to-code projects get no design-to-code rules. The README's advertised support is not delivered. Tests for Go/Rust detection reference template files that don't exist.
- **Remediation:** Extend `detectStack()` in `gsd-t-task-brief.js` to check for additional deps (firebase, graphql, @supabase/supabase-js, vite, zustand, react-native, @reduxjs/toolkit, pg/postgres) and additional config files (Dockerfile, pubspec.yaml, .figmarc, figma.config.json, .gsd-t/contracts/design-contract.md). For the test-only Go/Rust references: either add go.md/rust.md templates or remove the go/rust detection from stack-rules.test.js.
- **Found in slice:** stack-rules-engine
### TD-213 - getPreMortemRules() ignores its domainType parameter - always returns all rules with any activation
- **Area:** Rule Engine
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** bin/rule-engine.js
- **Description:** The `getPreMortemRules(domainType, projectDir)` function at line 58-60 ignores `domainType` entirely:
```js
function getPreMortemRules(domainType, projectDir) {
  return getActiveRules(projectDir || process.cwd()).filter((r) => r.activation_count > 0);
}
```
The contract (rule-engine-contract.md line 175-178) specifies: "Get rules relevant to a domain type for pre-mortem analysis @param {string} domainType - domain type/name pattern". The function should filter rules by domain type (e.g., rules that fired in similar backend-api or frontend-ui domains), but instead returns all rules that have ever fired regardless of domain.

The test suite (test/rule-engine.test.js lines 330-344) confirms this - tests only verify that rules with `activation_count > 0` are returned, never that `domainType` filtering applies. No test exercises the domain-type parameter.
- **Impact:** Pre-mortem analysis surfaces irrelevant rules (e.g., a frontend-specific rule surfaces during backend domain planning). The pre-mortem loses its precision signal - instead of "here's what went wrong in similar domains," it returns "here's everything that ever went wrong." For projects with many rules this creates noise that degrades the pre-mortem quality.
- **Remediation:** Rules need a `domain_type` or `domain_pattern` field in the schema (currently absent from rule-engine-contract.md). Add this field to the schema and implement filtering by domainType pattern match (e.g., prefix match or regex). Until the schema is extended, at minimum document that `domainType` is a no-op parameter to avoid callers expecting it to work.
- **Found in slice:** stack-rules-engine
### TD-214 - atomicWriteJsonl() has no cleanup on writeFileSync failure - orphan .tmp files accumulate
- **Area:** Rule Engine
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** bin/rule-engine.js
- **Description:** The `atomicWriteJsonl()` function (lines 149-155) writes to a temp file then renames:
```js
function atomicWriteJsonl(fp, records) {
  const dir = path.dirname(fp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = fp + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
  fs.renameSync(tmp, fp);
}
```
If `writeFileSync` throws (e.g., disk full, permissions error), the exception propagates and `renameSync` never runs - but no `finally` block removes the empty or partial `.tmp.{pid}` file. The function also has no try/catch, meaning the caller (`recordActivation`, `consolidateRules`) receives the raw error with no context about the state of the filesystem.

Additionally, using `process.pid` as the temp file discriminator means that if two Node.js processes run on the same system with the same PID (pid reuse after process exit, which is common on Linux), they can race on the same temp filename. A safer approach is `crypto.randomBytes`.
- **Impact:** Repeated disk-full or permission errors leave orphan `.tmp.{pid}` files next to `rules.jsonl`. On subsequent writes by the same PID (pid reuse), a stale temp file could be silently overwritten mid-write by another process. In a multi-process GSD-T unattended session this is a plausible scenario.
- **Remediation:** Wrap `writeFileSync` + `renameSync` in try/finally: in the finally block, attempt `fs.unlinkSync(tmp)` if `renameSync` has not been called. Use `crypto.randomBytes(6).toString('hex')` instead of `process.pid` for the temp suffix to eliminate PID-reuse races.
- **Found in slice:** stack-rules-engine
### TD-215 - backlog-add has no fallback when Auto-categorize is false and --type is not provided
- **Area:** Backlog add state machine
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/commands/gsd-t-backlog-add.md
- **Description:** Step 3 says: '--type not provided: If Auto-categorize is true, infer the type...; If unclear, default to feature'. But it specifies no behavior for when Auto-categorize is false and --type is not provided. Step 4 then validates the type must be in the Types list. If the LLM leaves type as empty/undefined, validation will fail and stop the operation with a confusing error rather than a clear prompt like 'No type specified and Auto-categorize is off. Please provide --type from: {list}'.
- **Impact:** With Auto-categorize disabled, users get opaque validation failures instead of actionable guidance. This is a common configuration for projects that want explicit tagging.
- **Remediation:** Add to Step 3: 'If Auto-categorize is false and --type is not provided: stop and tell the user: "--type is required (Auto-categorize is disabled). Provide one of: {types list}".' This gives a clear, actionable error rather than a cryptic validation failure.
- **Found in slice:** backlog-management
### TD-216 - File references non-existent contract path .gsd-t/contracts/file-format-contract.md
- **Area:** Contract compliance / documentation
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/commands/gsd-t-backlog-settings.md, /Users/david/projects/GSD-T/commands/gsd-t-backlog-promote.md
- **Description:** `backlog-settings.md` Step 6 references `.gsd-t/contracts/file-format-contract.md` as the document to check if settings format changes are needed. `backlog-promote.md` Step 8 tells the LLM to confirm 'the file-format-contract'. That file does not exist - the actual contracts are `.gsd-t/contracts/backlog-file-formats.md` and `.gsd-t/contracts/progress-file-format.md`. An LLM following these instructions will look for a non-existent file and either skip the step silently or hallucinate a contract.
- **Impact:** Contract compliance checks during settings changes and promotions point to a dead file. Changes that should trigger a contract review silently pass without any check.
- **Remediation:** Replace all references to `file-format-contract.md` in these two command files with the correct paths: `.gsd-t/contracts/backlog-file-formats.md` (for backlog entry format) and `.gsd-t/contracts/progress-file-format.md` (for progress.md format).
- **Found in slice:** backlog-management
### TD-217 - backlog-settings.md template ships unreplaced app tokens that gsd-t init does not substitute
- **Area:** Init / template correctness
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/templates/backlog-settings.md, /Users/david/projects/GSD-T/bin/gsd-t.js
- **Description:** The `backlog-settings.md` template contains `{app1}`, `{app2}`, and `{app}` tokens (lines 11-12, 17). `writeTemplateFile` calls `applyTokens` (line 158) which only replaces `{Project Name}` and `{Date}`. These three tokens are left as literal strings `{app1}`, `{app2}`, `{app}` in the output file. The LLM-driven Step 8 of `gsd-t-init.md` is supposed to overwrite these via natural language instructions, but if init is interrupted or the LLM skips Step 8, the settings file contains `{app1}` and `{app2}` as actual app names. Subsequent `gsd-t-backlog-add` calls will use `{app}` as the default app and fail validation.
- **Impact:** Projects where init doesn't complete Step 8 fully end up with a settings file that causes validation failures on every `gsd-t-backlog-add` call.
- **Remediation:** Either: (a) extend `applyTokens` to replace `{app1}`, `{app2}`, `{app}` with empty-string or a sensible default like the project name; (b) change the template to use empty Apps section (like Categories); or (c) add a programmatic post-init step that strips unreplaced placeholder tokens from backlog-settings.md.
- **Found in slice:** backlog-management
### TD-218 - Zero automated tests for the entire backlog command surface
- **Area:** Test coverage
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/commands/gsd-t-backlog-add.md, /Users/david/projects/GSD-T/commands/gsd-t-backlog-edit.md, /Users/david/projects/GSD-T/commands/gsd-t-backlog-move.md, /Users/david/projects/GSD-T/commands/gsd-t-backlog-promote.md, /Users/david/projects/GSD-T/commands/gsd-t-backlog-remove.md, /Users/david/projects/GSD-T/commands/gsd-t-backlog-list.md, /Users/david/projects/GSD-T/commands/gsd-t-backlog-settings.md
- **Description:** The test suite under `/Users/david/projects/GSD-T/test/` has no test file covering any backlog command or the `queryBacklog` function. The `queryBacklog` parsing bug (finding #1) would have been caught by a unit test with a sample backlog.md. The `backlog-settings remove-app` default-app corruption (finding #2) has no regression guard. For a CRUD surface that directly manages file state, this is a critical gap - especially since `queryBacklog` is exported and tested in worktree snapshots only.
- **Impact:** Regressions in backlog parsing and state management go undetected. The `queryBacklog` format bug has likely been broken since the backlog feature was added - no test caught it.
- **Remediation:** Add a test file `test/backlog.test.js` covering: (1) `queryBacklog` with a correctly formatted backlog.md returns correct item count and titles; (2) `queryBacklog` with empty backlog returns 0 items; (3) backlog entry parsing round-trip (add/remove/renumber). Also add CLI integration tests for the `gsd-t query backlog` subcommand.
- **Found in slice:** backlog-management
### TD-219 - archive-progress.cjs writes updated progress.md non-atomically - crash between archive and rewrite loses entries from both locations
- **Area:** Milestone archival / data integrity
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** bin/archive-progress.cjs
- **Description:** The tool writes archive files via `fs.writeFileSync(outPath, ...)` (line 284) and the INDEX via `fs.writeFileSync(path.join(archiveDir, 'INDEX.md'), ...)` (line 291), then rewrites the live progress.md via `fs.writeFileSync(progressPath, newProgress)` (line 296). None of these writes use the tmp-file + rename pattern. By contrast, `global-sync-manager.js` correctly uses `atomicWriteJsonl` (tmp file + `fs.renameSync`). If the process is killed or crashes between line 291 (archive files written) and line 296 (progress.md rewritten), the old entries are now in the archive but the live progress.md still contains them - duplication. If the crash happens mid-write of progress.md (unlikely but possible on large files), the file is partially written and corrupted. Line 279 also contains dead code: `let seq = opts.dryRun ? nextArchiveSeq(archiveDir) : nextArchiveSeq(archiveDir)` - both branches are identical.
- **Impact:** Progress.md corruption or entry duplication on process kill. While uncommon in practice, progress.md is the source of truth for milestone state and its corruption requires manual recovery.
- **Remediation:** Write progress.md via a temp file + rename: write to `progressPath + '.tmp.' + process.pid`, then rename. Apply the same pattern to archive files. Remove the duplicate `nextArchiveSeq` call on line 279 (both branches are identical; collapse to one call).
- **Found in slice:** project-init-and-lifecycle
### TD-220 - templates/progress.md hardcodes version '0.1.0', conflicting with init.md and CLAUDE-global.md which specify '0.1.00'
- **Area:** Init / versioning consistency
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** templates/progress.md, commands/gsd-t-init.md, templates/CLAUDE-global.md
- **Description:** `templates/progress.md` line 4 reads `## Version: 0.1.0`. The GSD-T versioning convention (documented in `commands/gsd-t-init.md` line 173 and `templates/CLAUDE-global.md` line 75) is that new projects start at `0.1.00` (two-digit patch). The difference is not cosmetic: `0.1.0` is a valid 3-part semver while `0.1.00` is the GSD-T-specific convention requiring 2-digit patches. If gsd-t-init copies the template verbatim and the model does not override the version field, newly initialized projects will start at `0.1.0`, and the first milestone completion will bump to `0.1.11` instead of the intended `0.1.10`.
- **Impact:** New projects initialize with the wrong version format, breaking the 2-digit patch convention enforced by complete-milestone.
- **Remediation:** Update `templates/progress.md` line 4 to `## Version: 0.1.00` to match the documented convention, or add a note that gsd-t-init will substitute the correct value from its version-detection logic.
- **Found in slice:** project-init-and-lifecycle
### TD-221 - complete-milestone.md summary.md is written before version bump and ELO computation, requiring undocumented backfill steps
- **Area:** Milestone archival / complete-milestone orchestration
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** commands/gsd-t-complete-milestone.md
- **Description:** Step 5 writes `summary.md` to the archive directory with a `{tag-name}` placeholder. The actual new version is computed in Step 6. Step 8.7 computes the ELO score and instructs 'Include ELO score in the milestone summary (Step 5)'. Step 6 says 'Include version in the milestone summary and git tag'. Both instructions require the model to go back and update the already-written summary.md in the archive directory - but neither step explicitly says 'update summary.md now'. The only explicit write to summary.md is in Step 5, before the version and ELO are known. In practice this causes `summary.md` to contain the placeholder `{tag-name}` and no ELO data.
- **Impact:** Milestone archives contain incomplete summaries with missing git tag names and no ELO data, reducing the utility of the archive for retrospectives.
- **Remediation:** Move summary.md generation to after Step 8.7 (after ELO is computed), or restructure Step 5 to produce a draft and add an explicit 'Update summary.md with final version tag and ELO' sub-step after Step 8.7. At minimum, add an explicit instruction in Step 6 and Step 8.7: 'Update the summary.md in the archive directory with the computed value.'
- **Found in slice:** project-init-and-lifecycle
### TD-222 - global-sync-manager.js JSONL files have no file-level locking - concurrent update-all runs silently lose writes
- **Area:** Global sync / concurrency
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** bin/global-sync-manager.js
- **Description:** `atomicWriteJsonl` uses `process.pid` in the temp filename (line 343), preventing collision within a single process. However, the read-modify-write pattern (loadJsonl → mutate → atomicWriteJsonl) is not protected against concurrent processes. If two simultaneous `gsd-t update-all` runs on different projects both read global-rules.jsonl, compute different states, and both rename their `.tmp.{pid}` files, the second rename wins and silently overwrites the first process's changes. This is realistic when a user runs update-all on a large project list with parallelism or triggers it from two terminals.
- **Impact:** Concurrent promotions or rollup writes can silently drop entries, corrupting the cross-project metrics history.
- **Remediation:** Use a lock file (e.g., `~/.claude/metrics/.lock` via `fs.openSync(..., 'wx')` with a retry loop or `flock`-equivalent) around the read-modify-write cycle in each write function. Alternatively, document that concurrent update-all runs are unsafe and serialize them at the CLI layer.
- **Found in slice:** project-init-and-lifecycle
### TD-223 - compactLedger writes a record with result='compacted' that violates VALID_RESULTS invariant
- **Area:** Debug Ledger / Data Integrity
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** bin/debug-ledger.js
- **Description:** Lines 111-132: `compactLedger()` writes a sentinel entry with `result: 'compacted'`. `VALID_RESULTS = new Set(['PASS', 'STILL_FAILS'])`. The compacted entry is stored in the JSONL file and later read back by `getLedgerStats()`, `generateAntiRepetitionPreamble()`, and any consumer that reads the file. `getLedgerStats` counts it in `entryCount` but not in `passCount` or `failCount`, making the sum inconsistent (`passCount + failCount != entryCount`). If the compacted entry is re-passed to `appendEntry()` it throws (result validation). Additionally `generateAntiRepetitionPreamble` correctly excludes compacted entries from failed-hypothesis reporting but the `learnings` filter (`!e.compacted`) skips it - this is correct but fragile: relies on the `compacted: true` boolean, not on result field consistency.
- **Impact:** getLedgerStats telemetry is misleading after compaction. Consumers that rely on `passCount + failCount === entryCount` will see an off-by-one. Low immediate harm since compaction is rare, but data quality is compromised.
- **Remediation:** Add `'COMPACTED'` to `VALID_RESULTS` and update `getLedgerStats` to treat it as a third category, or give the compacted sentinel a dedicated field check (`if (e.compacted) continue`) in stats aggregation. Also update `generateAntiRepetitionPreamble` to filter by `e.compacted` rather than by result string for clarity.
- **Found in slice:** metrics-telemetry-and-events
### TD-224 - metrics-collector.js has no test coverage in the main branch test suite
- **Area:** Test Coverage / Metrics Correctness
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** bin/metrics-collector.js
- **Description:** The main `test/` directory has `debug-ledger.test.js` but no `metrics-collector.test.js` or `metrics-rollup.test.js`. Tests for these exist only in abandoned worktree branches (`/.claude/worktrees/`). `metrics-collector.js` is the sole write path for all per-task telemetry; its `collectTaskMetrics`, `readTaskMetrics`, and `getPreFlightWarnings` functions are untested. The `getPreFlightWarnings` logic (first-pass rate threshold 0.6, avg fix-cycles threshold 2.0) has no regression coverage. Bugs in the write path would silently corrupt the JSONL file.
- **Impact:** Regressions in the telemetry write path (e.g., field coercion, JSONL corruption, filter logic) will ship undetected. Pre-flight warnings that incorrectly fire or fail to fire will mislead domain workers.
- **Remediation:** Port the existing worktree tests (`metrics-collector.test.js`, `metrics-rollup.test.js`) into `test/` and add them to the npm test run. At minimum: add round-trip tests for `collectTaskMetrics` + `readTaskMetrics`, boundary tests for `validateRecord` (especially the missing `tokens_used` type check), and threshold tests for `getPreFlightWarnings`.
- **Found in slice:** metrics-telemetry-and-events
### TD-225 - tokens_used has no type or range validation - accepts strings, objects, and negative numbers
- **Area:** Metrics Validation / Data Integrity
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** bin/metrics-collector.js
- **Description:** Lines 27-30 list `tokens_used` in `REQUIRED_FIELDS` (existence check only). Lines 83-101 (`validateRecord`) apply numeric checks only to `duration_s`, `context_pct`, and `fix_cycles`. `tokens_used` is passed through without any `typeof` or range validation. As verified: `tokens_used: 'not-a-number'`, `tokens_used: -999`, and `tokens_used: { count: 100 }` are all accepted silently. These corrupt values are serialized into `task-metrics.jsonl` and then used in aggregations (sums, averages in `gsd-t-metrics.md`). Similarly, `milestone`, `domain`, `task`, and `command` have no type checks - any value (including `undefined`-adjacent types that pass the `!== null` check) is accepted.
- **Impact:** Corrupted JSONL records silently accumulate, causing NaN or incorrect averages in metrics reports. ELO computation (when rollup.jsonl is eventually implemented) would be poisoned by bad token counts.
- **Remediation:** Add to `validateRecord`: `if (typeof data.tokens_used !== 'number' || data.tokens_used < 0) return 'tokens_used must be a non-negative number';`. Similarly add `typeof` checks for `milestone`, `domain`, `task`, `command` as strings. This mirrors the pattern already applied to `duration_s`, `context_pct`, and `fix_cycles`.
- **Found in slice:** metrics-telemetry-and-events
### TD-226 - M65-M79 (14 completed milestones) are absent from the Completed Milestones table in progress.md
- **Area:** State File Integrity - Progress Tracking
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** .gsd-t/progress.md
- **Description:** The `## Completed Milestones` table at line 180 only includes milestones through M58 (the last row). M59 through M79 (approximately 14 milestones including M59, M60, M61, M65, M66, M67, M68, M69, M70, M71, M72, M73, M74, M75, M76, M77, M78, M79) are only described as narrative prose sections under `## Current Milestone` (lines 10-178). The progress-file-format contract requires completed milestones to be added to the Completed Milestones table by `gsd-t-complete-milestone`. The `gsd-t-status` and `gsd-t-resume` commands consume the Completed Milestones table structure to understand project history. Additionally, M66 and M67 have no archive directory in `.gsd-t/milestones/` (M65 is archived, M66/M67 are not).
- **Impact:** The `gsd-t status` command's Completed Milestones report will omit 14 milestones worth of completed work, making the project history incomplete. Any tool or agent reading the Completed Milestones table to understand version history will be missing 6+ months of work. M66 and M67 specifically have no milestone archive, meaning their domain files remain in `.gsd-t/domains/` without a corresponding archive.
- **Remediation:** Add M59-M79 to the Completed Milestones table with the correct format (Milestone | Version | Completed [YYYY-MM-DD HH:MM TZ] | Tag | Summary). Create milestone archives for M66 and M67 in `.gsd-t/milestones/`. Clear the corresponding domain directories per the domain-structure contract lifecycle rule.
- **Found in slice:** living-document-contracts-and-state
### TD-227 - Multiple DRAFT/PROPOSED contracts remain active in a post-PARTITIONED project, triggering preflight warnings
- **Area:** Contract Status Management
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** .gsd-t/contracts/adaptive-replan-contract.md, .gsd-t/contracts/goal-backward-contract.md, .gsd-t/contracts/fresh-dispatch-contract.md, .gsd-t/contracts/worktree-isolation-contract.md, .gsd-t/contracts/unattended-event-stream-contract.md, .gsd-t/contracts/m52-integration-points.md, .gsd-t/contracts/m54-integration-points.md
- **Description:** Seven contracts have DRAFT or PROPOSED status headers while the project is past PARTITIONED (the cli-preflight `contracts-stable` check fires a `warn` in this condition). Four are for pending features in a DRAFT state: `adaptive-replan-contract.md`, `goal-backward-contract.md`, `fresh-dispatch-contract.md`, `worktree-isolation-contract.md`. One is for a RETIRED system: `unattended-event-stream-contract.md` (Status: PROPOSED - M38 Domain 3) describes the unattended event-stream from M38, but the entire unattended relay was retired in M61 D2 (`gsd-t-unattended.cjs` is deleted). Two integration-point files have stale PROPOSED headers: `m52-integration-points.md` line 3 says PROPOSED but all 3 checkpoints are PUBLISHED; `m54-integration-points.md` line 3 says PROPOSED but all 3 checkpoints are PUBLISHED.
- **Impact:** The `contracts-stable` preflight check (`severity: warn`) fires on every verify-gate run, adding noise to verify output. The unattended-event-stream-contract.md actively misleads by describing a PROPOSED design for a system that has been retired. The two integration-point files with stale headers misrepresent their actual completion state.
- **Remediation:** Update `m52-integration-points.md` and `m54-integration-points.md` headers from PROPOSED to PUBLISHED. Mark `unattended-event-stream-contract.md` as RETIRED/LEGACY since the unattended relay no longer exists. For the 4 DRAFT pending-feature contracts, either promote them to STABLE (if the features are now shipped) or ensure they are tracked in the backlog, and consider if they should be in `.gsd-t/contracts/` or a separate `proposed/` subdirectory.
- **Found in slice:** living-document-contracts-and-state
### TD-228 - token-budget-contract.md Consumers list references two deleted files
- **Area:** Contract Drift - Retired Infrastructure
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** .gsd-t/contracts/token-budget-contract.md
- **Description:** The Consumers header at line 7 lists `bin/orchestrator.js` and `bin/runway-estimator.js (M35 Wave 3)`. `bin/runway-estimator.js` was deleted (not present on disk). `bin/orchestrator.js` still exists but is now the abstract Workflow base engine (not the M40 task orchestrator that actually called `getSessionStatus()`). The M40 `gsd-t-orchestrator.js` that was the actual consumer was deleted in M65. The Integration Points table at line 219 lists `bin/orchestrator.js` task-budget gate calling `getSessionStatus()`, which no longer happens. Additionally, the gsd-t.js `doStatus` function still reads `.context-meter-state.json` directly (line 1860) and the statusline script still reads it (line 73), but neither `bin/token-budget.cjs` nor `context-meter-config.cjs` exist any more, making the v3.1.0 stale-band logic unreachable.
- **Impact:** The contract falsely suggests two files are active consumers. Any audit or dependency analysis based on this contract will produce incorrect results. The stale Integration Points table may mislead about the token-budget enforcement chain.
- **Remediation:** Remove `bin/orchestrator.js` and `bin/runway-estimator.js` from the Consumers list. Update the Integration Points table to reflect that the M40 orchestrator is gone and the current enforcement path runs through native Workflow preflight checks, not `getSessionStatus()` gate calls. Note that `bin/token-budget.js` itself no longer exists (only `bin/token-budget.cjs` was planned but that file is absent from disk) - verify whether any active consumer still calls it.
- **Found in slice:** living-document-contracts-and-state
### TD-229 - doc-ripple-contract.md Integration Pattern section describes retired Task subagent spawning
- **Area:** Contract Drift - Workflow Migration
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** .gsd-t/contracts/doc-ripple-contract.md
- **Description:** The contract's Integration Pattern section (lines 113-134) instructs commands to spawn a doc-ripple agent via a `Task subagent (general-purpose, model: sonnet)` with a verbatim Task prompt. But `commands/gsd-t-doc-ripple.md` now invokes the generic upper-stage Workflow at `templates/workflows/gsd-t-phase.workflow.js` with `phase: 'doc-ripple'`. The Parallel Dispatch section (lines 96-103) also describes spawning parallel subagents via `TaskCreate`, which is the pre-M61 pattern. The contract's Model Assignment section uses 'haiku'/'sonnet' labels that align with M61's Workflow model assignment, but the Integration Pattern still shows the old Task approach.
- **Impact:** Commands that implement the doc-ripple integration per the contract's Integration Pattern section will use the deprecated Task subagent approach instead of the Workflow invocation. This creates an inconsistency between what the contract prescribes and how existing commands actually work.
- **Remediation:** Update the Integration Pattern section to show the current Workflow invocation pattern: resolve path via `gsd-t workflow-path phase`, then call `Workflow({scriptPath, args: {phase: 'doc-ripple', ...}})`. Remove or update the Task-subagent spawn pattern. This aligns with the actual `commands/gsd-t-doc-ripple.md` implementation.
- **Found in slice:** living-document-contracts-and-state
### TD-230 - progress.md missing required Session Log section
- **Area:** State File Integrity - Missing Required Section
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** .gsd-t/progress.md, .gsd-t/contracts/progress-file-format.md
- **Description:** The progress-file-format.md contract at lines 132-139 specifies a `## Session Log` section as a required section of progress.md, with format `| Date | Session | What was accomplished |`. A grep for 'Session Log' in progress.md returns zero results - the section is completely absent from the actual file. The contract says this section is 'Append-only. One row per working session. Never cleared.'
- **Impact:** Tools or workflows that try to read the Session Log section from progress.md will find nothing. The `gsd-t-status` and dashboard commands that are supposed to display session history have no data to show. Any agent following the contract to append session log entries will write to a section that doesn't exist, creating malformed markdown.
- **Remediation:** Add the `## Session Log` section to `progress.md` with the required table header. Backfill it with approximate session entries from the Decision Log entries. Update `commands/gsd-t-complete-milestone.md` to ensure it actually appends to Session Log.
- **Found in slice:** living-document-contracts-and-state
### TD-231 - docs/requirements.md is 14+ milestones out of date - M57-M79 have no requirement entries
- **Area:** Living Document Staleness
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** docs/requirements.md
- **Description:** The requirements.md `Last Updated` header shows `2026-03-09 (Scan #9 - M17 complete)`. The last REQ entries are through M56 (marked as 'planned' - `REQ-M56-*`). Milestones M57 through M79 - including the CI-Parity Gate (M57), Test Data Cleanup Gate (M58), M59 timestamp precision, M60 Red Team fix, M61 Platform Reconciliation, M65-M79 scan milestones - have zero requirement entries. This spans at least 14 milestones and all REQ-M57 through REQ-M79 are missing. The functional requirements table also still has REQ-036 through REQ-048 in `planned` status even though several have been implemented.
- **Impact:** Any agent or gap-analysis tool reading docs/requirements.md to understand what the system delivers will have a picture frozen at M17 for the header and M56 for the traceability. The goal-backward verification in complete-milestone uses requirements.md to measure completion - it will miss all M57+ deliverables. REQ-049 through REQ-062 show the gap can grow because even M32-era requirements are barely tracked.
- **Remediation:** Add `## M57 CI-Parity Verify Gate`, `## M58 Test Data Cleanup`, and sections through M79 with corresponding REQ entries. Update `Last Updated` header. At minimum, mark completed requirements with their implementing milestone in the Status column. This is a doc-ripple obligation from every milestone's Pre-Commit Gate.
- **Found in slice:** living-document-contracts-and-state
### TD-232 - docs/architecture.md command count is wrong (49 vs actual 51) and is 14 months stale
- **Area:** Living Document Staleness
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** docs/architecture.md, docs/infrastructure.md
- **Description:** `docs/architecture.md` at line 32 says `Count: 49 (45 GSD-T workflow + 4 utility)` and `Last Updated: 2026-03-22 (M23 - Headless Mode)`. `docs/infrastructure.md` at line 51 says `ls commands/*.md | wc -l  # Should be 48`. Actual count: `ls commands/*.md | wc -l` returns 51. The discrepancy is 51 vs 49/48. The architecture.md also still describes `headless-auto-spawn.cjs`, `handoff-lock.cjs`, `gsd-t-token-capture.cjs`, `bin/orchestrator.js` as the Real-Time Agent Dashboard and related infrastructure that was retired in M61. The entire M55-M79 infrastructure additions (cli-preflight, parallel-cli, context-brief, verify-gate, Workflows) are absent from the architecture description.
- **Impact:** Engineers and agents using architecture.md to understand the system structure see an M23-era view. The command count check in infrastructure.md's test script would fail if run. The `bin/headless-auto-spawn.cjs` reference in architecture.md describes a deleted file as active infrastructure.
- **Remediation:** Update `Last Updated` and command count in both files. Add sections for the Workflow orchestration layer, CLI-Preflight Pattern, Verify Gate, Context Brief, and scan Workflow. Remove or mark as retired the headless-auto-spawn, handoff-lock, token-capture, and unattended infrastructure sections.
- **Found in slice:** living-document-contracts-and-state
### TD-233 - docs/workflows.md is severely stale - last updated M17 (2026-03-09), missing 61+ milestones of workflow changes
- **Area:** Living Document Staleness
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** docs/workflows.md
- **Description:** `docs/workflows.md` Last Updated is `2026-03-09 (Scan #9, Post-M17)`. The document describes workflows through M17 (Scan Visual Output). The entire Workflow-native orchestration added in M61 (preflight → brief → Workflow script → verify-gate pattern), the scan volume-scaled workflow (M66/M67), the native parallel fan-out, the CI-parity gate (M57), test data cleanup (M58), and the desktop-cockpit workflow (M61 SC7) are all absent. The Full Wave Cycle section still describes the pre-M61 team-mode execution and doesn't mention the native Workflow invocation pattern.
- **Impact:** Any agent resuming work and reading docs/workflows.md to understand how processes flow will implement the pre-M61 manual orchestration pattern. The gap is substantial - workflows.md describes a system that evolved through 61+ milestones of changes after M17.
- **Remediation:** Update `Last Updated` and add a `### Native Workflow Execution (M61+)` section describing the current `preflight → brief → Workflow({scriptPath}) → verify-gate` pattern. Update the Full Wave Cycle section. Add scan workflow section. This is a major doc-ripple that was not completed across M61-M79.
- **Found in slice:** living-document-contracts-and-state

### TD-296 - Plan-phase brief is stale: described M65 (not the current milestone) in four consecutive M85 runs
- **Area:** Context-brief generation
- **Severity:** MEDIUM
- **Status:** OPEN
- **Location:** bin/gsd-t-context-brief.cjs (kind=plan), templates/workflows/gsd-t-phase.workflow.js (generateBrief call)
- **Description:** In all four M85 plan-phase runs (2026-06-09) the generated $BRIEF_PATH described M65 domains/contracts and contained zero M85 scope — both the planning agent and the pre-mortem agent independently flagged it and fell back to reading the M85 artifacts directly. The brief id/kind cache appears to serve a stale snapshot rather than regenerating against the current milestone's domains/contracts.
- **Impact:** Brief-first rule (M55-D5) silently defeated for the plan phase: every worker re-walks the repo, paying the 30-60k context cost the brief exists to avoid; worse, an agent that TRUSTED the brief would plan against M65 state.
- **Remediation:** Make brief generation milestone-aware (include current milestone domains/tasks/contracts for kind=plan/partition), or key the brief cache by milestone id so a stale cross-milestone snapshot can never be served; add a freshness assertion (brief must mention the requested milestone id, else regenerate).
- **Found in slice:** m85-plan-hardening-loop (live observation, not scan)

## 🟢 Low Priority

### TD-234 - wave-join-contract.md references retired headless-auto-spawn.cjs and has version drift
- **Area:** Contract / documentation drift
- **Severity:** LOW
- **Status:** OPEN
- **Location:** .gsd-t/contracts/wave-join-contract.md, bin/gsd-t-parallel.cjs, .gsd-t/contracts/spawn-plan-contract.md
- **Description:** The contract at `.gsd-t/contracts/wave-join-contract.md` line 150 states `runDispatch` 'spawns N detached headless children via `autoSpawnHeadless()` from `bin/headless-auto-spawn.cjs`'. This module was retired in M61 and is flagged in `DEPRECATED_BIN_STRAYS` in `gsd-t.js`. Additionally, `bin/gsd-t-parallel.cjs` references the contract as `v1.1.0` (lines 23, 49, 188, 466) but the contract header declares itself `v1.2.0`.
- **Impact:** Developers reading the contract to understand how fan-out spawning works are directed to a deleted module. The version mismatch makes it impossible to tell which code tracks which contract version.
- **Remediation:** Update wave-join-contract.md: remove the `headless-auto-spawn.cjs` reference, document the actual spawn mechanism (Workflow runtime's native `agent()`/`spawn()`), and bump the version to 1.3.0 or 2.0.0 to reflect the M61 architectural change. Update `bin/gsd-t-parallel.cjs` to reference the correct version number.
- **Found in slice:** parallel-execution-and-task-graph, living-document-contracts-and-state
### TD-235 - HEADLESS_STRUCTURED_FAIL_RE matches any line starting with FAIL including FAILOVER, FAIL-SAFE
- **Area:** Headless execution correctness
- **Severity:** LOW
- **Status:** OPEN
- **Location:** bin/gsd-t.js
- **Description:** HEADLESS_STRUCTURED_FAIL_RE at line 3557 is /^FAIL[:\s]/m. This matches any line that starts with 'FAIL' followed by a colon or whitespace. It correctly captures Jest-style 'FAIL src/foo.test.js' lines. However, it also matches 'FAIL-SAFE:' or 'FAIL: fast mode' from log output if such a line appears at the start of a line. Since [:\s] includes all whitespace the actual range is quite specific (only 'FAIL:' and 'FAIL ' patterns), and the m flag anchors to line start, so the practical false-positive surface is narrow - only lines that literally begin with 'FAIL:' or 'FAIL ' trigger this. Real risk is low but non-zero for projects that use 'FAIL' as a status label in non-test output.
- **Impact:** A passing run where output contains a line starting 'FAIL: fast-mode skipped' maps to exit code 1 instead of 0. Probability is low for typical project output.
- **Remediation:** Tighten to /^FAIL[:\s][^A-Z]/m to exclude all-caps compound words, or to /^FAIL(?:[:\s]\S)/m to require a following non-whitespace. Alternatively rename to HEADLESS_JEST_LINE_FAIL_RE and document the intent so future readers understand its scope.
- **Found in slice:** cli-installer-updater
### TD-236 - isSymlink check for CLAUDE.md is performed AFTER reading the file content in updateProjectClaudeMd
- **Area:** Installer correctness / symlink TOCTOU
- **Severity:** LOW
- **Status:** OPEN
- **Location:** bin/gsd-t.js
- **Description:** In updateProjectClaudeMd (line 2051), the code reads the file at line 2052 (fs.readFileSync), then checks isSymlink at line 2056. This is a TOCTOU window: if the file is a symlink, its content is already read through the symlink before the check fires. More critically, if CLAUDE.md is a symlink to a file outside the project, the guard fires too late - the read already traversed it. In this specific function the symlink guard was intended to prevent writes through symlinks (not reads), so the read is less dangerous than the skipped write. But the ordering is inconsistent with the rest of the installer, which checks isSymlink before any I/O.
- **Impact:** Limited: the read-through-symlink is benign for content detection (you get the symlink target's content, which is fine for guard-section detection). The real risk is the symlink check being late in a refactor that adds a write before the current check line.
- **Remediation:** Move the isSymlink(claudeMd) check to line 2051 (before the readFileSync call) to match the pattern used everywhere else in the file.
- **Found in slice:** cli-installer-updater
### TD-237 - exportUniversalRulesForNpm reads global rules twice with a mutation window between reads
- **Area:** Data integrity / race condition
- **Severity:** LOW
- **Status:** OPEN
- **Location:** bin/gsd-t.js
- **Description:** exportUniversalRulesForNpm (line 2255) calls gsm.readGlobalRules() at line 2258 to get npmCandidates, mutates the npmCandidates in-memory at lines 2275-2278, then calls gsm.readGlobalRules() again at line 2281 to get allRules. It then merges the mutated npmCandidates.shipped_in_version back into allRules and writes the file. Between the two readGlobalRules calls, another process could have modified global-rules.jsonl. The merge logic (lines 2282-2284) would then silently overwrite the concurrent change because allRules is now from the second read but the shipped_in_version mutation was applied to the first read's npmCandidates array. The tmp+rename at line 2291 makes the final write atomic, but the double-read mutation window remains.
- **Impact:** In a concurrent scenario (two processes calling exportUniversalRulesForNpm simultaneously - unlikely given it's a developer tool), one process's shipped_in_version update could be silently lost.
- **Remediation:** Read global rules once, apply the shipped_in_version updates to the allRules array directly (not to a separate npmCandidates copy), and write once with the tmp+rename pattern. Eliminates the double-read window.
- **Found in slice:** cli-installer-updater

### TD-238 - Orchestrator _parseStreamJson collects both content_block_delta and assistant message text - potential output duplication
- **Area:** Output parsing correctness
- **Severity:** LOW
- **Status:** OPEN
- **Location:** bin/orchestrator.js
- **Description:** Lines 352-363 of _parseStreamJson collect text from both `event.type === 'assistant'` (complete message content) AND `event.type === 'content_block_delta'` (streaming partial chunks). When `claude -p --output-format stream-json` runs in streaming mode, it emits content_block_delta events progressively and then a final assistant event with the complete assembled content. Collecting both means the text is concatenated twice: once from the individual streaming chunks and once from the complete final message. The `event.type === 'result'` branch (lines 362-364) adds a third potential source if the result field contains the final text. This means the orchestrator's parsed output could contain the full assistant response 2-3x, causing review-log files to be inflated and any pattern-matching on the output (such as _parseDefaultReviewResult's regex search) to scan redundant content.
- **Impact:** The build-log files written at lines 944-947 and 958-960 are inflated with duplicated content (up to 3x). The _parseDefaultReviewResult's regex searches over the duplicated content, which could cause false positives on the FAIL/DEVIATION keyword detection if a passing response happens to include those words in its explanation of what was checked. The maxBuffer: 10MB cap means very long responses may get truncated in the callback.
- **Remediation:** Collect text from only one source. Prefer the `assistant` event type (complete message, no ordering concerns) and remove the `content_block_delta` handler. Alternatively, track whether an assistant event has been seen and skip delta accumulation after that. Also consider using only the `result` type if it reliably carries the final answer.
- **Found in slice:** workflow-orchestration-engine
### TD-241 - Hardcoded 'src/components/{phases[0]}' path in orchestrator element validation - Vue/TSX only
- **Area:** Framework portability / hardcoded assumptions
- **Severity:** LOW
- **Status:** OPEN
- **Location:** bin/orchestrator.js
- **Description:** Line 792 hardcodes `path.join(projectDir, 'src', 'components', phases[0])` as the element directory, and line 799-800 filters for `.vue` and `.tsx` file extensions only. The regex on line 816 hardcodes a fixed set of component name prefixes (chart-, legend-, stat-, table-, select-, tabs-, date-, pagination, icon, tooltip). This means the element inventory validation only works for Vue or TSX projects with a `src/components/` structure. React projects using `.jsx`, Svelte projects using `.svelte`, or projects with a different component directory layout will silently skip the validation (availableElements.size === 0 on line 805 causes the entire validation block to be skipped without warning).
- **Impact:** Projects not matching the hardcoded assumptions receive no element inventory validation and no indication that validation was skipped. Any element name drift in contracts goes undetected. Additionally, the regex's specificity means components with names outside the listed prefixes (e.g. 'button', 'input', 'form') are never checked even in Vue/TSX projects.
- **Remediation:** Make the element directory configurable via `workflow.elementDir` and the file extensions configurable via `workflow.elementExtensions`. Alternatively, log a clear warning when availableElements.size === 0 due to missing directory or unsupported extensions. Replace the hardcoded prefix regex with a general kebab-case identifier pattern that catches all component references in contract tables.
- **Found in slice:** workflow-orchestration-engine
### TD-242 - Memory-mode tee: open+write+close syscall per chunk after 1MB overflow
- **Area:** I/O performance
- **Severity:** LOW
- **Status:** OPEN
- **Location:** bin/parallel-cli-tee.cjs
- **Description:** In `_attachMemoryMode` (line 128), after the in-memory buffer exceeds `IN_MEMORY_CAP_BYTES` (1MB), `rotate()` is called once to create a temp file. After that, every subsequent data chunk calls `appendToTemp(streamName, buf)` (line 171), which at line 159-161 does `fs.openSync(slot.rotatedPath, 'a')` + `fs.writeSync` + `fs.closeSync`. For a worker that produces verbose output (e.g. a `claude -p --output-format stream-json --verbose` process with thousands of JSONL frames), this means 3 synchronous syscalls per streamed chunk after the 1MB threshold. File-mode tee keeps the fd open (lines 80-81) and pays 1 `writeSync` per chunk - 3× more efficient.
- **Impact:** Workers with high-verbosity output in memory mode (no `teeDir` set) experience significant I/O overhead. Since `runParallel` in `parallel-cli.cjs` defaults to `teeDir: null` when not provided (line 67), callers that don't set `teeDir` get memory mode. The verify-gate, which is the primary caller, sets `teeDir` to a real path, so the impact is limited to direct `runParallel` invocations without a teeDir.
- **Remediation:** Hold the temp file fd open across chunks: store `slot.fd` after the first open in `rotate()` and reuse it in `appendToTemp`. Close only in `close()`. This mirrors the file-mode pattern and reduces to 1 syscall per chunk.
- **Found in slice:** parallel-execution-and-task-graph
### TD-243 - Dead ternary in dry-run footer output always evaluates to 0
- **Area:** Code clarity / dead code
- **Severity:** LOW
- **Status:** OPEN
- **Location:** bin/gsd-t-parallel.cjs
- **Description:** In `runCli` at line 765-769, the `reducedCount` display condition is `result.reducedCount !== result.parallelTasks.length + (result.parallelTasks.length === 0 ? 0 : 0)`. The ternary `(result.parallelTasks.length === 0 ? 0 : 0)` always evaluates to 0 regardless of the condition - both branches produce the same value. The effective condition is `result.reducedCount !== result.parallelTasks.length`. This appears to be a remnant of a draft that was supposed to add a different value in the false branch (e.g., a minimum floor).
- **Impact:** The reduced-count banner may appear when it shouldn't (e.g. when there are no parallel tasks at all, `reducedCount=1` and `parallelTasks.length=0` means `1 !== 0` → banner shows). Minor UX noise only; no correctness impact.
- **Remediation:** Remove the dead ternary. The intended condition should be evaluated explicitly, e.g. `result.reducedCount != null && result.reducedCount < (result.parallelTasks.length || plannerWorkerCount)`.
- **Found in slice:** parallel-execution-and-task-graph
### TD-244 - Shell injection via domain directory name in gitHistoryTouches
- **Area:** Security / input sanitization
- **Severity:** LOW
- **Status:** OPEN
- **Location:** bin/gsd-t-file-disjointness.cjs
- **Description:** `gitHistoryTouches` (line 67-96) builds a shell command string using a template literal: `\`git log ... -- "${domainDir}"\``. `domainDir` is `path.join('.gsd-t', 'domains', domain)` where `domain` comes from `fs.readdirSync` of the actual filesystem. If a directory name on disk contains a double-quote character (e.g. `foo"-bar`), the shell command becomes `... -- ".gsd-t/domains/foo"-bar"` which mis-parses the shell quoting. A directory name containing `"$(command)"` or backticks could execute arbitrary shell commands. `execSync` on Unix uses `/bin/sh -c` for string arguments. Domain naming conventions (`m44-d1-foo`) don't allow quotes, but this is enforced only by convention, not by code.
- **Impact:** In a scenario where an attacker controls the contents of `.gsd-t/domains/` (e.g. via a compromised git repo), maliciously named directories could lead to command injection. In practice GSD-T projects are trusted environments so the real-world risk is low, but the absence of sanitization is a latent correctness issue even for directory names with spaces or special chars.
- **Remediation:** Replace `execSync` with `spawnSync` (non-string form) using an args array: `spawnSync('git', ['log', '--name-only', '--pretty=format:COMMIT:%H %s', '-n', '100', '--', domainDir], { cwd: projectDir, ... })`. This bypasses the shell entirely and is immune to injection.
- **Found in slice:** parallel-execution-and-task-graph
### TD-245 - complete-milestone.md Step 1 references 'Auto-invoked by /gsd-t-verify (Step 8)' - stale step reference
- **Area:** Stale/incorrect documentation
- **Severity:** LOW
- **Status:** OPEN
- **Location:** commands/gsd-t-complete-milestone.md, commands/gsd-t-verify.md
- **Description:** `gsd-t-complete-milestone.md` line 6 states it is 'Auto-invoked by `/gsd-t-verify` (Step 8)'. But `gsd-t-verify.md` only has three numbered steps (Step 1: Read state, Step 2: Invoke Workflow, Step 3: Interpret result). There is no Step 8 in the current verify command. This reference traces to the pre-M61 hand-driven verify workflow which had 8+ steps. The auto-invocation now happens as part of interpreting the Workflow return value (Step 3), not a named Step 8.
- **Impact:** Minor confusion for agents reasoning about the auto-invocation trigger; not behaviorally harmful but creates documentation drift.
- **Remediation:** Change the parenthetical in `gsd-t-complete-milestone.md` line 6 from '(Step 8)' to '(Step 3 - on VERIFIED/VERIFIED-WITH-WARNINGS verdict)' to match the current workflow structure.
- **Found in slice:** slash-command-library
### TD-246 - gsd-t-quick.md Step 3 parallel-exit comment references 'Step 0.1' which is the orchestrator's step, not the spawned subagent's context
- **Area:** Misleading documentation
- **Severity:** LOW
- **Status:** OPEN
- **Location:** commands/gsd-t-quick.md
- **Description:** `gsd-t-quick.md` line 218 says: `# Exit 2+ → sequential (N<2 or quick is single-task - the common case). # Fall through to the single-subagent path in Step 0.1.` But Step 0.1 is the orchestrator's step (the outer agent that spawned this subagent). The spawned subagent starts at Step 1 per its prompt ('execute gsd-t-quick starting at Step 1'). When the parallel dispatch exits 2+, it should fall through to the sequential single-task execution path *within Step 3 itself*, not to Step 0.1. The comment misleads an agent about where execution continues.
- **Impact:** An agent confused by the step reference may attempt to re-enter Step 0.1 (the orchestrator spawn) instead of continuing with the sequential task execution in Step 3.
- **Remediation:** Change the comment to: `# Exit 2+ → sequential (N<2 or quick is single-task - the common case). # Fall through to the single-task sequential path below in Step 3.`
- **Found in slice:** slash-command-library
### TD-247 - gsd-t-resume.md Step 1 load-order list has duplicate item number 4
- **Area:** Structural defect
- **Severity:** LOW
- **Status:** OPEN
- **Location:** commands/gsd-t-resume.md
- **Description:** `gsd-t-resume.md` lines 181-188 list the cross-session state files to read in order. Items 3 and 4 are: `3. .gsd-t/progress.md` / `4. .gsd-t/contracts/` / `4. .gsd-t/domains/*/scope.md`. There are two items numbered `4`. The second item 4 should be item 5, which shifts the remaining items (currently 5, 6, 7, 8) to 6, 7, 8, 9.
- **Impact:** Minor authoring defect. An agent reading the numbered list may skip one file or misread the reading order.
- **Remediation:** Fix the numbering: change the second `4.` to `5.` and renumber subsequent items 5→6, 6→7, 7→8, 8→9.
- **Found in slice:** slash-command-library
### TD-248 - gsd-t-quick.md Step 3 Deviation Rules has a '3-attempt limit' that contradicts the global Prime Rule's '2-attempt limit'
- **Area:** Conflicting invariants
- **Severity:** LOW
- **Status:** OPEN
- **Location:** commands/gsd-t-quick.md
- **Description:** `gsd-t-quick.md` lines 227 and 232 say: 'Fix it, up to 3 attempts' and '3-attempt limit: Stop looping after 3 failed fix attempts.' The global `CLAUDE.md` Prime Rule states: 'IF a test fails, fix it immediately (up to 2 attempts) before reporting.' The orthogonal validation contract also uses 2 cycles. Using 3 attempts in quick mode creates inconsistency - an agent running quick will do one more fix cycle than expected by the system design before delegating to `headless --debug-loop`.
- **Impact:** An agent following quick.md will attempt one extra fix cycle per blocked bug before deferring, slightly extending execution time and token use, but no data loss risk.
- **Remediation:** Change the limit in `gsd-t-quick.md` Deviation Rules from 3 to 2, matching the global Prime Rule: 'Fix it, up to 2 attempts. If still blocked, add to `.gsd-t/deferred-items.md` and skip.'
- **Found in slice:** slash-command-library
### TD-249 - gsd-t-project.md uses 'Est. Sessions' as an effort unit and 'focused sessions' as a sizing estimate, violating the GSD-T-native units mandate
- **Area:** Policy violation
- **Severity:** LOW
- **Status:** OPEN
- **Location:** commands/gsd-t-project.md
- **Description:** `gsd-t-project.md` line 94 says 'Each milestone should be completable in roughly 1-3 focused sessions' and line 175 creates a progress.md table column `Est. Sessions`. The global `CLAUDE.md` § Effort Estimates explicitly prohibits developer-hours, dev-days, sprints, and story points: 'GSD-T operates on a different cost model - the worker is Claude, not a human team.' The mandate says to use domain count, wave count, spawn count, token-spend range, or rate-limit-window count. 'Sessions' is a human-calendar concept equivalent to 'sprints'.
- **Impact:** Agents generating roadmaps will use session-count estimates that have no predictive value for GSD-T workflow execution time.
- **Remediation:** Replace 'focused sessions' with domain count + wave count language. Change line 94 to: 'Each milestone should decompose to 2-5 domains (1-3 waves for complex milestones).' Replace the `Est. Sessions` column in the progress.md template with `Domains | Waves`.
- **Found in slice:** slash-command-library
### TD-250 - gsd-t-triage-and-merge.md Step 7 pre-commit check references 'GSD-T-README.md' without the docs/ path prefix
- **Area:** Incorrect path reference
- **Severity:** LOW
- **Status:** OPEN
- **Location:** commands/gsd-t-triage-and-merge.md
- **Description:** `gsd-t-triage-and-merge.md` line 126 says: 'update GSD-T-README.md, README.md, CLAUDE-global template, gsd-t-help' - without a path prefix. The actual file is at `docs/GSD-T-README.md` (confirmed by file system). The same file correctly uses the path `docs/GSD-T-README.md` in the Document Ripple section at line 163. The inconsistency means an agent reading Step 7 pre-commit might look for `GSD-T-README.md` at the project root and fail to find it.
- **Impact:** Agent may fail to update or incorrectly locate the GSD-T README during triage-and-merge's pre-commit gate.
- **Remediation:** Change 'update GSD-T-README.md' on line 126 to 'update docs/GSD-T-README.md' to match the actual file location and the Document Ripple reference on line 163.
- **Found in slice:** slash-command-library
### TD-251 - gsd-t-help.md main command table omits gsd-t-metrics and gsd-t-design-audit
- **Area:** Documentation completeness
- **Severity:** LOW
- **Status:** OPEN
- **Location:** commands/gsd-t-help.md
- **Description:** The main command reference table in `gsd-t-help.md` (the block inside the code fence starting line 10) lists 50 command slugs. Two command files that exist in `commands/` are entirely absent from the table: `gsd-t-design-audit.md` (a full audit command with its own workflow) and `gsd-t-metrics.md` (process health dashboard). `gsd-t-metrics.md` does appear in the Command Summaries section (line 322) but not the table shown to users running `/gsd-t-help` with no arguments. `gsd-t-design-audit.md` is referenced in `gsd-t-design-audit-design-audit` but has no table entry or summary entry.
- **Impact:** Users running `/gsd-t-help` will not discover these two commands from the default table output.
- **Remediation:** Add `metrics` under the UTILITIES section and `design-audit` under UTILITIES (or a new DESIGN section) in the main command table in `gsd-t-help.md`. Add a Command Summary entry for `design-audit`.
- **Found in slice:** slash-command-library
### TD-252 - gsd-t-status.md references headless-default-contract.md v1.0.0 but current version is v2.0.0
- **Area:** Stale contract version reference
- **Severity:** LOW
- **Status:** OPEN
- **Location:** commands/gsd-t-status.md, commands/gsd-t-resume.md
- **Description:** `gsd-t-status.md` line 42 cites 'Contract: `.gsd-t/contracts/headless-default-contract.md` v1.0.0'. `gsd-t-resume.md` lines 119 and 137 also cite v1.0.0 for the handoff-lock and headless-banner contracts respectively. The current headless-default-contract version is v2.0.0 per `gsd-t-quick.md` (lines 9, 11, 42), `gsd.md` (lines 29, 51), and the global CLAUDE.md references. v2.0.0 introduced the 'always headless' invariant (inverted default). Commands citing v1.0.0 may lead agents to consult an outdated contract version.
- **Impact:** Agents may reference the wrong contract version when reasoning about headless spawn behavior.
- **Remediation:** Update all v1.0.0 references to headless-default-contract in `gsd-t-status.md` and the affected sections of `gsd-t-resume.md` to v2.0.0. Note: resume.md also has a v2.1.0 reference (line 43) for the sub-dispatch section - the overall contract version may be 2.1.0 now; verify and use consistently.
- **Found in slice:** slash-command-library
### TD-253 - gsd-t-backlog-remove.md always prompts for user confirmation (y/n) without respecting Level 3 Full Auto
- **Area:** Autonomy level violation
- **Severity:** LOW
- **Status:** OPEN
- **Location:** commands/gsd-t-backlog-remove.md, commands/gsd-t-backlog-promote.md
- **Description:** `gsd-t-backlog-remove.md` Step 2 always asks 'Confirm removal? (y/n)' and 'Wait for user confirmation before proceeding.' No autonomy level check exists. At Level 3 (Full Auto), the global CLAUDE.md directs agents to 'Only stop for blockers, destructive actions, or project completion.' Deleting a backlog item is not a destructive action (no data loss, reversible from git). `gsd-t-backlog-promote.md` similarly has 'Wait for user confirmation' gates at Steps 3 and 4 with no Level 3 bypass path.
- **Impact:** At Level 3, backlog-remove and backlog-promote will pause and wait for user input, breaking the full-auto contract.
- **Remediation:** Add autonomy level handling: 'At Level 3 (Full Auto): proceed without confirmation. At Level 1-2: display entry and wait for confirmation.' Mirror the pattern used by gap-analysis Step 3 which handles this correctly.
- **Found in slice:** slash-command-library
### TD-254 - cpua.md hardcodes 'Claude Opus 4.7' in the Co-Authored-By commit template
- **Area:** Stale model reference
- **Severity:** LOW
- **Status:** OPEN
- **Location:** commands/cpua.md
- **Description:** `cpua.md` line 88 includes `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` in the commit message template. The global CLAUDE.md convention says commits should use `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` (as seen in recent commit messages in git log: `eb8686f`, `36990ab`). This will create inconsistent co-authorship attribution in the GSD-T release commit history.
- **Impact:** Commits created via /cpua will have incorrect co-authorship attribution.
- **Remediation:** Update `cpua.md` line 88 to use the current model: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` (or whatever the current default model is). Consider making this a template variable rather than hardcoding the model name.
- **Found in slice:** slash-command-library
### TD-255 - contracts-stable does not scan .gsd-t/contracts/design/ subdirectory
- **Area:** Preflight check coverage
- **Severity:** LOW
- **Status:** OPEN
- **Location:** bin/cli-preflight-checks/contracts-stable.cjs
- **Description:** The _scanContracts function uses `fs.readdirSync(contractsDir)` (line 55-56) without recursion, scanning only the flat `contracts/` directory. The CLAUDE.md documents `.gsd-t/contracts/design/` as a valid hierarchical design contract location ('hierarchical element/widget/page contracts - bootstrap via /gsd-t-design-decompose'). Design contracts in this subdirectory can have `Status: DRAFT` or `Status: PROPOSED` and will never be flagged by the contracts-stable check regardless of milestone state.
- **Impact:** DRAFT design contracts are invisible to the preflight check. Since contracts-stable is warn-severity, this doesn't block execution, but the safety net for un-promoted design contracts is absent for subdirectory-organized contracts. Note: currently no subdirectory exists in this repo's contracts/, but projects that use gsd-t-design-decompose will create one.
- **Remediation:** Make _scanContracts recursive, or explicitly also scan `path.join(contractsDir, 'design')` if it exists. Match the behavior documented in CLAUDE.md for the design contract location.
- **Found in slice:** verify-gate-and-ci-parity
### TD-256 - ci-parity detectWorkflows reads only the first workflow file and first job
- **Area:** CI parity detection accuracy
- **Severity:** LOW
- **Status:** OPEN
- **Location:** bin/gsd-t-ci-parity.cjs
- **Description:** detectWorkflows at lines 96-136 reads only `files[0]` (the first alphabetically sorted .yml file in .github/workflows/) and extracts commands from only the first job (firstJobDone=true stops scanning after the second top-level job key). Multi-job workflows (build + test + deploy) or repos with multiple workflow files will have their CI commands undersampled. The comment at lines 27-32 acknowledges this as an intentional trade-off ('Parse limits... These limits are intentional trade-offs'), but it creates a false sense of CI parity coverage - the ci-parity check may pass while the actual CI pipeline (running all jobs) would fail.
- **Impact:** If build happens in job1 (captured) but tests happen in job2 (not captured), ci-parity only reruns the build. The test job is skipped. A code change that breaks tests but not build gets a false PASS from ci-parity. This is the exact class of regression M57 was designed to prevent.
- **Remediation:** Consider reading all .yml files and all jobs within each, at minimum capturing `run:` lines from every job. If the zero-dep constraint makes full YAML parsing prohibitive, at least document the limitation in the envelope's result.note field so consumers know the coverage is partial.
- **Found in slice:** verify-gate-and-ci-parity
### TD-257 - findFiles performs unbounded recursive sync file reads - can stall on large repos
- **Area:** Schema Detection
- **Severity:** LOW
- **Status:** OPEN
- **Location:** bin/scan-schema.js:6-19, bin/scan-schema.js:32-47
- **Description:** `findFiles()` recurses into every non-dotfile, non-`node_modules` directory without a depth limit. `detectOrm()` calls it for `.ts`, `.py`, and `.sql` files. On a large TypeScript monorepo with thousands of `.ts` files, this performs thousands of synchronous `fs.readFileSync()` calls (via `fileContains()`) before the CLI scan command can proceed. The function is called synchronously from `extractSchema()` which is called from the CLI render path.
- **Impact:** CLI hangs or slow startup on large projects. Particularly bad for the Drizzle detection path which searches ALL `.ts` files ending in `schema.ts`.
- **Remediation:** Add a `maxDepth` parameter (e.g. default 6) to `findFiles()`. Also consider short-circuiting after finding the first matching file for ORM types that only need one file (Prisma already checks a fixed path). Cache the result within a single `extractSchema` call.
- **Found in slice:** codebase-scan-engine
### TD-258 - Dead code: startCgcServer, sendRequest, sendRequestSync, cgcProcess state are unused
- **Area:** Code quality / Dead code
- **Severity:** LOW
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/bin/graph-cgc.js
- **Description:** startCgcServer() (line 48), sendRequest() (line 76), sendRequestSync() (line 118), and the module-level cgcProcess variable (line 13) are defined but never called outside graph-cgc.js itself. startCgcServer is not exported. The intended persistent-MCP-server approach was abandoned in favor of sendToolCallSync which spawn-per-call. cgcProcess remains null throughout. sendRequestSync's body explicitly acknowledges it 'won't work for stdio' and delegates to sendToolCallSync. stopCgcServer() is exported but cgcProcess is never set, so it always no-ops.
- **Impact:** Confusion about intended architecture. The 80+ lines of dead code obscures the actual behavior (spawn-per-call) and makes the performance defect (Finding 1) harder to diagnose.
- **Remediation:** Remove startCgcServer, sendRequest, sendRequestSync, cgcProcess, and stopCgcServer. If the persistent-server pattern is the intended fix for Finding 1, then implement it fully; otherwise remove the scaffolding.
- **Found in slice:** code-graph-engine
### TD-259 - sessionProvider cache in graph-query is set but never used by query()
- **Area:** Dead code / Architecture drift
- **Severity:** LOW
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/bin/graph-query.js
- **Description:** selectProvider() maintains a sessionProvider cache (lines 26-33) that memoizes the first available provider. But query() (lines 405-441) does not call selectProvider() - it iterates all providers directly. sessionProvider is set in selectProvider but the only callers are external code via getProviders/selectProvider exports. The sessionProvider and _lastFreshnessCheck state can get out of sync: resetSession() clears both, but query() only uses _lastFreshnessCheck; sessionProvider is vestigial.
- **Impact:** The cached provider could be stale (CGC becomes available mid-session but sessionProvider still points to native), but since query() doesn't use it, this is a latent confusion risk rather than an active bug. Code complexity without benefit.
- **Remediation:** Either (a) make query() use selectProvider() for the first matched provider (and skip the manual loop), or (b) remove selectProvider/sessionProvider entirely and keep the explicit loop. Pick one.
- **Found in slice:** code-graph-engine
### TD-260 - getIndexStatus always returns stale:false from nativeProvider - staleness never surfaced to callers
- **Area:** Correctness / API contract
- **Severity:** LOW
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/bin/graph-query.js
- **Description:** nativeQuery for 'getIndexStatus' (line 259-269) always returns stale:false and stalePaths:[]. It does not call store.isStale() to compute the actual staleness. Any caller using this query to check whether a re-index is needed always gets a 'fresh' answer, even when files have changed.
- **Impact:** Workflows or CLI commands that gate re-index on getIndexStatus will never trigger a re-index through this path. The auto-reindex in query() compensates internally, but any external staleness check via this API is broken.
- **Remediation:** Call store.isStale(projectRoot, walkFiles(projectRoot, DEFAULT_EXCLUDE)) inside the 'getIndexStatus' case and populate stale and stalePaths from the result. Import walkFiles from graph-indexer.
- **Found in slice:** code-graph-engine

### TD-261 - findDuplicates generates incomplete pairs for 3+ same-named entities
- **Area:** Correctness / Analysis quality
- **Severity:** LOW
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/bin/graph-query.js
- **Description:** The findDuplicates implementation (lines 162-179) uses a sliding-window pair generator: for entities [A, B, C] with the same name, it emits (A,B) and (B,C) but not (A,C). For N same-named entities, it emits N-1 pairs instead of N*(N-1)/2. All pairs are given similarity:1.0 (name-match only) regardless of structural similarity.
- **Impact:** Duplicate detection results are incomplete. In a codebase with 4 functions named 'handler', only 3 of the 6 pairs are reported. Downstream consumers treating the result as exhaustive will miss true duplicates.
- **Remediation:** Use all-pairs generation: for (let i=0; i<ents.length-1; i++) for (let j=i+1; j<ents.length; j++) dupes.push({entityA:ents[i], entityB:ents[j], similarity:1.0}). Consider documenting that similarity:1.0 means name-match only, not content similarity.
- **Found in slice:** code-graph-engine
### TD-262 - mapTests only scans one directory level - nested test files in subdirectories are invisible
- **Area:** Correctness / Test mapping coverage
- **Severity:** LOW
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/bin/graph-overlay.js
- **Description:** mapTests() (line 107) calls readdirSync(testDir) which is non-recursive. Test files in tests/unit/, tests/integration/, __tests__/components/ etc. are never scanned. Projects with organized test directories have zero test mappings for any entities, making the 'getTestsFor' query return [] even when tests exist.
- **Impact:** Test coverage overlay is empty for any project using nested test directories, which is the majority of modern JavaScript/Python projects. findDeadCode may incorrectly flag tested-but-untraceable functions as untested.
- **Remediation:** Use the existing walkFiles() utility from graph-indexer to recursively collect test files, filtering by the /\.(test|spec)\.(js|ts|py)$/ pattern instead of using readdirSync with no recursion.
- **Found in slice:** code-graph-engine
### TD-263 - PERMITTED_VALUES used before its declaration in startSvgEdit()
- **Area:** Review UI - JavaScript hoisting in gsd-t-design-review.html
- **Severity:** LOW
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/scripts/gsd-t-design-review.html
- **Description:** The function startSvgEdit() is defined at line 1889 and references PERMITTED_VALUES at line 1897. PERMITTED_VALUES is declared with `const` at line 2199 (inside the same IIFE scope). In JavaScript, `const` declarations are NOT hoisted - they are in the Temporal Dead Zone until the declaration is reached. If startSvgEdit() is ever called before the JS engine has parsed line 2199 (which can happen if the call triggers during initial render or during a rapid user interaction before the IIFE completes), it will throw `ReferenceError: Cannot access 'PERMITTED_VALUES' before initialization`.
- **Impact:** SVG attribute editing for enum-type attributes (stroke-linecap, stroke-linejoin, text-anchor, dominant-baseline) fails with a ReferenceError. Since the IIFE runs synchronously to completion before any event handlers can fire, in practice the risk is only during extremely early event dispatch (e.g., from a preloaded iframe postMessage before the IIFE finishes). Low probability but non-zero for slow devices. More importantly, it is a code smell indicating PERMITTED_VALUES should be defined before the functions that use it.
- **Remediation:** Move the PERMITTED_VALUES const declaration to before the startSvgEdit() function definition (before line 1889). This eliminates the TDZ risk and makes the dependency order explicit.
- **Found in slice:** design-to-code-pipeline
### TD-264 - Contract INDEX.md link parser misses contracts in nested subdirectories
- **Area:** Design orchestrator - contract discovery
- **Severity:** LOW
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/bin/design-orchestrator.js
- **Description:** discoverWork() (lines 29-66) parses INDEX.md for markdown links using the regex /^\s*-\s+\[([^\]]+)\]\(([^)]+)\)/gm and then classifies each link by checking if relPath.startsWith(`${p}/`) for p in ['elements', 'widgets', 'pages']. If INDEX.md links to contracts in subdirectories (e.g. elements/charts/chart-donut.contract.md), the startsWith check still matches. However, the fullPath is constructed as path.join(contractsDir, relPath) which is correct. The real issue is that if any INDEX.md link uses an absolute path, an external path, or a non-standard prefix (e.g. '../shared/'), the contract is silently skipped with no warning (the only warning is for missing files, not unclassifiable links).
- **Impact:** Contracts outside the elements/widgets/pages top-level directories are silently ignored. If a project's INDEX.md includes shared contracts or uses non-standard organization, some components are never built without any error message. The pipeline reports completion but has built fewer components than contracted.
- **Remediation:** Add a warning when a link is parsed but fails all phase classification checks. Consider also logging a count of classified vs. total links at startup so operators can verify discovery completeness.
- **Found in slice:** design-to-code-pipeline
### TD-265 - dashboard.html uses deprecated React 17 and unpinned chart.js@4 from CDN
- **Area:** Dependency hygiene / supply chain
- **Severity:** LOW
- **Status:** OPEN
- **Location:** scripts/gsd-t-dashboard.html
- **Description:** The dashboard loads React 17 (`react@17`), `dagre@0.8.5`, `reactflow@11.11.4`, and `chart.js@4` from `unpkg.com` / `cdn.jsdelivr.net` without Subresource Integrity (SRI) hashes. React 17 is EOL (React 18 released April 2022). The `@4` tag on chart.js is a semver range, not a pinned version - unpkg resolves this to the latest 4.x, which can change without notice. If either CDN serves compromised content, arbitrary code runs in the operator's browser.
- **Impact:** CDN compromise or MITM (even on localhost via a proxy) delivers malicious JS to every dashboard user. The `@4` range silently picks up breaking changes or security-relevant patches without awareness.
- **Remediation:** Add `integrity="sha384-..."` and `crossorigin="anonymous"` attributes to every `<script src>` and `<link rel=stylesheet>`. Pin exact versions (e.g. `chart.js@4.4.3`). Consider bundling these dependencies into the package rather than loading from CDN.
- **Found in slice:** real-time-agent-dashboard
### TD-266 - writeStream has no error handler - ENOSPC/EACCES crashes the process
- **Area:** Robustness / crash safety
- **Severity:** LOW
- **Status:** OPEN
- **Location:** scripts/gsd-t-stream-feed-server.js
- **Description:** Lines 40 and 56 create `fs.WriteStream` instances but attach no `'error'` event listener. In Node.js, an unhandled `error` event on a stream causes an uncaught exception that crashes the process. If the disk fills up (`ENOSPC`) or permissions change (`EACCES`) during an active session, the entire stream-feed server process dies, disconnecting all WS clients.
- **Impact:** Any disk-full or permission error terminates the server process; all connected WS clients are dropped and the stream feed goes dark until the server is manually restarted.
- **Remediation:** After each `fs.createWriteStream(...)` call, add: `writeStream.on('error', (err) => { process.stderr.write('[stream-feed-server] write error: ' + err.message + '\n'); });`. Optionally set a flag to stop broadcasting while disk is full.
- **Found in slice:** real-time-agent-dashboard
### TD-267 - dashboard.html port fallback hardcodes 7433 - mismatches stream-feed-server default 7842
- **Area:** Configuration correctness
- **Severity:** LOW
- **Status:** OPEN
- **Location:** scripts/gsd-t-dashboard.html, scripts/gsd-t-stream-feed-server.js
- **Description:** Line 100 of `gsd-t-dashboard.html` falls back to port `7433` when no `?port=` query parameter is provided and `location.port` is empty. The stream-feed server (`gsd-t-stream-feed-server.js`, line 20) defaults to port `7842`. When the dashboard is opened directly as a file (`file://`) or via a server that strips the port, all SSE and metrics fetch calls go to port 7433, which is typically not bound - the dashboard shows `Connecting...` forever with no error message.
- **Impact:** The dashboard silently fails to connect in the default no-parameter case; operators assume the stream is empty when the server is actually running.
- **Remediation:** Change the fallback to match: `const PORT = params.get('port') || location.port || '7842';`. Alternatively serve the dashboard from the stream-feed server on the same port and use relative URLs.
- **Found in slice:** real-time-agent-dashboard
### TD-268 - SECRET_SHORT regex over-scrubs harmless -p flags in Bash command summaries
- **Area:** Heartbeat Hook
- **Severity:** LOW
- **Status:** OPEN
- **Location:** scripts/gsd-t-heartbeat.js
- **Description:** At line 117, `SECRET_SHORT = /(\ s-p\ s)\ S+/gi` matches any command fragment of the form ` -p <value>` and replaces the value with `***`. This pattern is too broad: it matches `grep -p pattern` (POSIX), `git -p log` (paginate), `ssh -p 22 host` (port), `curl -p` etc. The intent was to scrub `mysql -p password` and similar, but the pattern fires on many non-secret uses of the `-p` flag. This causes the heartbeat event stream to contain garbled Bash command summaries.
- **Impact:** Bash command summaries in the heartbeat/events JSONL lose correct values for any tool call that uses -p for non-secret purposes. Diagnostics and audit logs become misleading.
- **Remediation:** Scope the pattern to known secret-taking commands that specifically use `-p` for password, or make the pattern more specific (e.g., `mysql\s+-p\s*\S+`, `psql\s+-p`). Alternatively, use SECRET_FLAGS (which matches `--password`) as the primary scrubber and remove the ambiguous SECRET_SHORT.
- **Found in slice:** context-and-token-monitoring
### TD-269 - _scanContracts function body duplicated across three kind collectors
- **Area:** Context Brief Generation
- **Severity:** LOW
- **Status:** OPEN
- **Location:** bin/gsd-t-context-brief-kinds/qa.cjs, bin/gsd-t-context-brief-kinds/red-team.cjs, bin/gsd-t-context-brief-kinds/verify.cjs
- **Description:** The `_scanContracts()` function (reads .gsd-t/contracts/*.md, parses Status: field, returns sorted [{path,status}]) is copy-pasted verbatim across qa.cjs (lines 72-88), red-team.cjs (lines 79-95), and verify.cjs (lines 20-38). The three copies are functionally identical (minor comment wording differs). Any bug fix or behavior change must be applied three times.
- **Impact:** Maintenance burden: a bug in this logic (e.g., Status regex, file filter) must be fixed in three places. One-fix miss will cause divergent behavior between QA, Red Team, and Verify briefs.
- **Remediation:** Extract _scanContracts into a shared utility module at `bin/gsd-t-context-brief-kinds/_shared.cjs` and require it from all three collectors. This also makes it easier to unit-test the common logic once.
- **Found in slice:** context-and-token-monitoring
### TD-270 - Dead code: unused 'acc' variable and unreachable 'return result' after process.exit
- **Area:** Token Aggregation
- **Severity:** LOW
- **Status:** OPEN
- **Location:** scripts/gsd-t-token-aggregator.js, scripts/gsd-t-compaction-scanner.js
- **Description:** Two dead code instances: (1) gsd-t-token-aggregator.js line 302: `let acc = ''` is declared inside runTail()'s poll function but never used or written - it's a leftover from a refactor that intended to accumulate partial lines across reads but was never completed. (2) gsd-t-compaction-scanner.js line 287: `return result` appears immediately after `process.exit(0)` at line 286 inside the try block - process.exit() terminates the process synchronously and the return is never reached.
- **Impact:** Misleading code - the acc variable suggests partial-line accumulation was intended but not implemented, which could cause a future developer to trust that JSONL line-splitting edge cases are handled.
- **Remediation:** Remove `let acc = ''` from runTail(). Remove `return result` from the compaction scanner main() try block. Both are noise that can mislead future readers.
- **Found in slice:** context-and-token-monitoring
### TD-271 - shortPath() uses process.cwd() instead of hook.cwd - produces wrong relative paths in event stream
- **Area:** Heartbeat Hook
- **Severity:** LOW
- **Status:** OPEN
- **Location:** scripts/gsd-t-heartbeat.js
- **Description:** shortPath() at line 174 calls `process.cwd()` to relativize file paths in Bash/Read/Edit/Write/Grep tool summaries. When the heartbeat script runs as a Claude Code hook, `process.cwd()` is the Claude Code application directory, not the user's project directory (which is available as `hook.cwd`). File paths under the user's project (e.g. `/Users/alice/projects/MyApp/src/app.js`) will NOT be relativized to `src/app.js`; they remain as full absolute paths in the event stream since they don't start with the app CWD.
- **Impact:** Event JSONL entries under .gsd-t/events/ contain absolute file paths instead of readable relative paths, making audit logs less useful. Not a correctness bug for functionality, but degrades observability.
- **Remediation:** Pass the project cwd into shortPath() or derive it from hook.cwd. In summarize() (line 142), hook data is available - thread the cwd parameter through summarize → shortPath so it uses the correct base path.
- **Found in slice:** context-and-token-monitoring
### TD-272 - gsd-t-calibration-hook.js is orphaned dead code - its trigger (supervisor status=running) can never occur since the supervisor was retired in M61 D2
- **Area:** Calibration Hook / Compaction Metrics
- **Severity:** LOW
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/scripts/gsd-t-calibration-hook.js
- **Description:** The calibration hook fires on SessionStart, reads `.gsd-t/.unattended/state.json`, and only produces output when `state.status === 'running'` (line 182). The supervisor that wrote `status: 'running'` was deleted in M61 D2. No other component writes `status: 'running'` to state.json. The current state.json in this project shows `status: 'failed'` - a terminal state from the last unattended run before M61. The hook will never write a `compaction_post_spawn` row to `metrics/compactions.jsonl`. It is registered as a SessionStart hook (appears to be referenced in `~/.claude/settings.json`), so it fires on EVERY session start, reads a file from disk, and silently no-ops. Progress.md M61 D1 note says 'KEPT scripts/gsd-t-calibration-hook.js `SAFE_DEFAULT_WINDOW` → 1M inline literal' - it was intentionally kept during M61 but its purpose evaporated when D2 deleted the supervisor.
- **Impact:** The hook is installed and runs on every Claude Code session start, doing a filesystem read and JSON parse on `.gsd-t/.unattended/state.json` for zero benefit. More critically, the calibration data that D6's estimator depended on will never be generated, so any future effort to re-enable CW prediction calibration will find an empty compactions log.
- **Remediation:** Remove the calibration hook from `~/.claude/settings.json` SessionStart hooks and either delete the file or add a prominent 'RETIRED - supervisor deleted in M61 D2' comment. If compaction calibration is needed in the future, a new mechanism tied to the current Workflow runtime must be designed.
- **Found in slice:** unattended-supervisor-and-headless-mode
### TD-273 - gsd-t-unattended-watch.md liveness check treats EPERM as 'process dead' - false crash reports when supervisor runs as different user
- **Area:** Unattended Watch - Liveness Detection
- **Severity:** LOW
- **Status:** OPEN
- **Location:** /Users/david/.claude/commands/gsd-t-unattended-watch.md
- **Description:** In Step 2's node block (line 74): `catch (_) { alive = false; }`. This catches all errors from `process.kill(pid, 0)` including EPERM (errno 1 on POSIX). EPERM from signal 0 means 'the process exists but you lack permission to signal it' - the process is alive, not crashed. The correct handling (as implemented in `gsd-t-unattended.md` Step 1b line 58) is `alive = e.code === 'EPERM'`. With the watch command's current handling, a supervisor started by root or a different user would be reported as crashed every tick, and the watch loop would stop rescheduling. For comparison, gsd-t-unattended.md Step 1b and Step 3's liveness poll both correctly handle EPERM.
- **Impact:** False-positive crash diagnostics when the supervisor runs under a different UID (e.g., in a systemd service, Docker, or multi-user setup). The watch loop halts unnecessarily and prints the crash diagnostic block.
- **Remediation:** Change `catch (_) { alive = false; }` to `catch (e) { alive = e.code === 'EPERM'; }` to match the pattern used in gsd-t-unattended.md Steps 1b and 3.
- **Found in slice:** unattended-supervisor-and-headless-mode
### TD-274 - gsd-t-unattended-watch.md Step 2 null-STATUS falls through all decision branches - infinite rescheduling when state.json is transiently corrupt
- **Area:** Unattended Watch - Decision Tree
- **Severity:** LOW
- **Status:** OPEN
- **Location:** /Users/david/.claude/commands/gsd-t-unattended-watch.md
- **Description:** The Step 2 node block retries state.json parsing once on parse failure, then sets `STATE=null` and `STATUS=null`. The decision tree in Steps 3-6 checks: Step 3 (PID_FILE_EXISTS=false), Step 4 (ALIVE=false), Step 5 (STATUS=done|failed|stopped), Step 6 (STATUS=initializing|running). When PID_FILE_EXISTS=true, ALIVE=true, and STATUS=null, none of the conditions match. The command falls straight to Step 7 (ScheduleWakeup) and reschedules without rendering any visible output. This creates a silent infinite loop for as long as state.json remains unreadable while the supervisor is alive.
- **Impact:** If state.json is corrupted or being written atomically at the exact moment watch fires, the watch loop silently reschedules forever with no user-visible output. The user has no indication anything is wrong.
- **Remediation:** Add an explicit null-STATUS guard in the Step 6 rendering section: if STATUS is not one of the expected enum values, render a warning block and reschedule (or STOP). E.g., 'If STATUS is null or unrecognized: render ⚠️ watch tick unable to parse state.json - retrying in 270s.'
- **Found in slice:** unattended-supervisor-and-headless-mode
### TD-275 - gsd-t-unattended-watch.md reconciliation uses substring milestone matching - 'M5' would match M55, M57, M51 archives, producing false-positive success reports
- **Area:** Unattended Watch - Reconciliation Logic
- **Severity:** LOW
- **Status:** OPEN
- **Location:** /Users/david/.claude/commands/gsd-t-unattended-watch.md
- **Description:** Step 3a reconciliation (lines 221-229) does: `const milestone = (state.milestone || '').toLowerCase()` then `archives.filter(n => n.toLowerCase().includes(milestone))`. If `state.milestone` is a short label like 'M5', this substring matches archives named 'm55-cli-preflight-pattern-...', 'm57-ci-parity-...', 'm51-...', etc. It would then check the mtime of the most recent of these matched archives against the supervisor's `startedAt`, potentially triggering a false reconciliation report that claims a failed run actually succeeded.
- **Impact:** False 'milestone completed (auto-reconciled)' success reports for genuinely failed runs. This is most likely with short milestone labels (M1-M9, M10-M19 matching M10x), but in practice most labels are specific enough to avoid this.
- **Remediation:** Use an exact-prefix match rather than substring: `archives.filter(n => n.toLowerCase().startsWith(milestone + '-'))`. This matches 'm55-' but not 'm551-' or 'm5-something'.
- **Found in slice:** unattended-supervisor-and-headless-mode
### TD-276 - gsd-t-in-session-probe.js: hook_event_name with path separator creates subdirectory outside probeDir's rotation scope
- **Area:** In-Session Probe Hook
- **Severity:** LOW
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/scripts/hooks/gsd-t-in-session-probe.js
- **Description:** At line 39, `event` is set from `hook.hook_event_name || 'unknown'` without sanitization. It is used directly in `path.join(probeDir, \`${event}-${ts}-${sid}.json\`)`. If `hook_event_name` contains a forward slash (e.g., 'Stop/evil'), `path.join` resolves this to `probeDir/Stop/evil-{ts}-{sid}.json`. The path containment check at line 42 (`resolved.startsWith(path.resolve(probeDir) + path.sep)`) PASSES for this path because `/probeDir/Stop/evil-...` starts with `/probeDir/`. The file would be written to a subdirectory `Stop/` inside probeDir. The `rotate()` function at line 50 only reads `probeDir` (not recursively), so the rotation limit of 10 files per event type is bypassed - these subdirectory files grow unboundedly.
- **Impact:** An adversarial Claude Code payload with a slash in `hook_event_name` can create subdirectories and bypass the 10-file rotation cap. In practice, hook event names are controlled by the Claude Code harness and are alphanumeric (Stop, SessionStart, PostToolUse), so this is a theoretical attack surface.
- **Remediation:** Sanitize event name before use: `const event = (hook.hook_event_name || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_')`. This prevents path separator injection.
- **Found in slice:** unattended-supervisor-and-headless-mode
### TD-277 - verifyPlaywrightHealth and _runSubprocess have a double-resolve race between error and close handlers
- **Area:** Playwright Bootstrap
- **Severity:** LOW
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/bin/playwright-bootstrap.cjs
- **Description:** In `verifyPlaywrightHealth` (lines 28-49): when `exec()` cannot start a process (ENOENT), both the exec callback (line 34, err !== null) and the `child.on('error')` handler (line 47) fire, calling `resolve()` twice. Similarly in `_runSubprocess` (lines 123-145), when `spawn` cannot start a process, both `child.on('error')` (line 140, resolves with code:127) and `child.on('close')` (line 143, resolves with code:1) can fire, calling `resolve()` twice. Calling `resolve()` on an already-settled Promise is a no-op in the spec, so the result is deterministic (first caller wins), but the close handler would win if it fires before error in some Node versions, returning code:1 instead of code:127 - which would misclassify the error.
- **Impact:** On a process that fails to spawn (ENOENT), `_runSubprocess` could return `{code: 1}` instead of `{code: 127}`, causing `_classifyError` to return 'install-failed' instead of 'package-manager-not-found' - a subtly wrong error message and hint. Functionally benign (ok:false is returned either way) but the user sees the wrong hint.
- **Remediation:** Add a `settled` flag and check before calling resolve: `let settled = false; const once = (v) => { if (!settled) { settled = true; resolve(v); } };` Use `once()` in both handlers. Alternatively, remove the redundant `child.on('error')` in `verifyPlaywrightHealth` since exec already surfaces spawn errors through the callback.
- **Found in slice:** testing-infrastructure
### TD-278 - Inline HTML event-handler detector fails to match multiline attribute blocks
- **Area:** Journey Coverage Detector
- **Severity:** LOW
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/bin/journey-coverage.cjs
- **Description:** Line 190: `detectInlineHandler` uses the regex `/<(\w+)([^>]*?)\s+on(\w+)\s*=\s*(['"])([^'"]*)/g`. The `[^>]*?` character class does not cross newlines by default (JavaScript regex `.` and `[^x]` do match newlines, but `[^>]` matches any char except `>` including `\n`). However the tag-spanning scenario like `<button\n  id="x"\n  onclick="fn()">` would match because `[^>]*?` is lazy and `\n` is in `[^>]`. Testing confirms it works. The real gap is the regex stops collecting attrs at the first `>`, so attributes after a `>` in an attribute value (e.g. a tooltip containing HTML) would mis-parse. More practically, there is no test for multiline attribute detection.
- **Impact:** Low - viewer HTML files are typically minified or have clean attribute formatting. A missing test leaves multiline inline-handler detection unverified against future refactors.
- **Remediation:** Add a test case with a multiline `<button\n  id="x"\n  onclick="handler()">` to `test/m52-d1-journey-coverage.test.js` to pin the current behavior.
- **Found in slice:** testing-infrastructure
### TD-279 - localStorage adapter purge is structurally impossible from the ledger's batch-purge path
- **Area:** Test Data Ledger / Adapters
- **Severity:** LOW
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/bin/gsd-t-test-data-ledger.cjs, /Users/david/projects/GSD-T/bin/gsd-t-test-data-adapters/localstorage-key-prefix.cjs, /Users/david/projects/GSD-T/templates/test-helpers/README.md
- **Description:** `purgeRunInserts()` (line 128) calls `adapter.purge({ store, id, taggedPrefix, projectDir })` - it never passes `page`. The localStorage adapter requires `page` to call `page.evaluate()`. When `page` is absent, the adapter returns `'absent'` (line 36). This means every `localStorage-key-prefix` ledger entry processed by `gsd-t test-data --purge` is reported as `skipped` (not an error), and no actual browser cleanup occurs. The adapter's comment acknowledges this: "Playwright is gone, the data is gone too" - relying on browser session teardown. This design assumption is correct for ephemeral in-browser localStorage but undocumented in the README.md and the test-data-tagging-contract, which list `localStorage-key-prefix` as a first-class adapter without noting the purge limitation.
- **Impact:** Users who expect the verify-step purge to clean localStorage entries (e.g., for SSR or persistent storage setups) will silently get no-op purges. Verify will report success with `skipped: N` rather than `errors: N`, making the failure invisible.
- **Remediation:** Document in `README.md` (under 'What this does NOT do') that `localStorage-key-prefix` rows are not deleted by the server-side `gsd-t test-data --purge` sweep - they rely on browser session teardown. For SSR/persistent-localStorage scenarios, use `file-json-array` or `sqlite-table-where` instead. Optionally, update the tagging contract to note this per-adapter limitation.
- **Found in slice:** testing-infrastructure
### TD-280 - Windows desktop.ini file committed to templates/stacks/ and would be bundled in npm package
- **Area:** Stack Rules Templates
- **Severity:** LOW
- **Status:** OPEN
- **Location:** templates/stacks/desktop.ini
- **Description:** `templates/stacks/desktop.ini` is a Windows shell metadata file (content: `[.ShellClassInfo] IconResource=C:\Program Files\Google\Drive File Stream\...`) committed to the repo (confirmed via `git ls-files`). It is correctly ignored by `loadStackRules()` because it does not end with `.md`. However:
1. It is committed to git and will be included in the npm package, increasing package size.
2. It is listed in `.gitignore` (line 4 says `desktop.ini`) but git is not respecting this because the file is already tracked.
3. It may confuse developers scanning the stacks directory for available templates.
- **Impact:** Minor package bloat. Developer confusion about supported stacks. No functional impact because `loadStackRules()` filters on `.md` extension.
- **Remediation:** Run `git rm --cached templates/stacks/desktop.ini` to untrack it (the .gitignore already covers it). The file will then be ignored on future OS writes.
- **Found in slice:** stack-rules-engine
### TD-281 - model-selector.js is exported from bin/ but no production Workflow or CLI subcommand requires it
- **Area:** Model Selection
- **Severity:** LOW
- **Status:** OPEN
- **Location:** bin/model-selector.js
- **Description:** Searching the entire codebase, `model-selector.js` is only imported in:
- `test/model-selector.test.js` (test file)
- `templates/CLAUDE-project.md` (mentions it in a file listing, not a require)

No Workflow script, no `bin/gsd-t.js` subcommand, no `_lib.js` helper, and no command file actually `require`s `bin/model-selector.js`. The model tier is instead hardcoded inline in each Workflow script as a string literal (e.g., `model: "sonnet"` at gsd-t-execute.workflow.js line 147, or `model: "opus"` at gsd-t-verify.workflow.js lines 262, 284). The `selectModel()` API - the whole purpose of the module - is never called in production code paths.
- **Impact:** The model-selector module is dead code in production. All the logic (phase rules, complexity overrides, escalation hooks) is inert. The escalation hook text (`ESCALATION_HOOK`) is never injected into any prompt. Model assignments are made by copy-pasting tier string literals, which means the model-selector's phase rules can silently drift from actual behavior without any test catching it (since tests only call `selectModel()` directly, not through a Workflow).
- **Remediation:** Either wire `selectModel()` into `_lib.js::generateBrief()` or into each Workflow's `agent()` call (replacing hardcoded `model:` strings), or formally mark the module as a reference specification rather than executable code. If it is executable code, at minimum add an integration test that calls `selectModel()` and verifies the returned tier matches the `model:` literal in the corresponding Workflow script.
- **Found in slice:** stack-rules-engine
### TD-282 - Context-brief execute kind: _contractsReferenced() only scans scope.md, misses contracts mentioned in tasks.md or constraints.md
- **Area:** Context Brief Generation
- **Severity:** LOW
- **Status:** OPEN
- **Location:** bin/gsd-t-context-brief-kinds/execute.cjs
- **Description:** In `execute.cjs`, `_contractsReferenced(scopeText, projectDir)` (lines 91-111) only searches the scope.md text for `.gsd-t/contracts/*.md` patterns. However, contract references in `tasks.md` (e.g., `Contract refs: context-brief-contract.md` in task entries) and in `constraints.md` are never scanned. The `collect()` function calls `_contractsReferenced(scopeText, ...)` but never passes `constraintsText` or `tasksText` (lines 183-183).

This means the brief omits contract status for contracts listed under `**Contract refs**:` in tasks.md - which is a standard GSD-T task shape field (`plan.cjs` parses `filesOwnedFirst3` from scope.md, not tasks.md contracts).
- **Impact:** Workers reading the brief see fewer contract statuses than they should. A DRAFT contract referenced in tasks.md is invisible to the brief, so the worker cannot know to check it. This is a minor correctness gap - the worker can re-read the tasks.md directly, but it defeats the brief's purpose of being the single pre-read source.
- **Remediation:** In `execute.cjs::collect()`, also scan `constraintsText` and `tasksText` through `_contractsReferenced()` and merge the results (deduplicate by path) before assigning `contracts`.
- **Found in slice:** stack-rules-engine
### TD-283 - backlog-settings help entry omits backlog.md from Files list despite reading it during remove operations
- **Area:** Documentation accuracy
- **Severity:** LOW
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/commands/gsd-t-help.md
- **Description:** The `backlog-settings` entry in `gsd-t-help.md` (line 432) lists only `backlog-settings.md` under Files. However, `remove-type`, `remove-app`, and `remove-category` all read `.gsd-t/backlog.md` to check for entries using the value being removed (Step 4). The help entry is incomplete, which could mislead users who need to check file locking or backup requirements.
- **Impact:** Cosmetic accuracy issue. Users checking `gsd-t-help` to understand file access patterns will see an incomplete picture for settings remove operations.
- **Remediation:** Update the `backlog-settings` help entry Files field to: `.gsd-t/backlog-settings.md` (read-write), `.gsd-t/backlog.md` (read-only, for remove operations).
- **Found in slice:** backlog-management
### TD-284 - --top N flag in backlog-list has no validation for non-positive or non-integer values
- **Area:** Input validation
- **Severity:** LOW
- **Status:** OPEN
- **Location:** /Users/david/projects/GSD-T/commands/gsd-t-backlog-list.md
- **Description:** Step 3 applies `--top N` by keeping the first N entries but specifies no validation. If the user passes `--top 0`, `--top -5`, or `--top abc`, the LLM receives no guidance. It may return 0 results, fail silently, or hallucinate behavior. The contract in `backlog-command-interface.md` lists `[--top N]` as a valid argument but provides no constraints.
- **Impact:** Edge case: inconsistent LLM behavior on malformed --top values. Low priority.
- **Remediation:** Add to Step 3: 'If N is not a positive integer, inform the user: "--top requires a positive integer. Got: {value}." and stop.' This is a minor UX hardening.
- **Found in slice:** backlog-management
### TD-285 - complete-milestone.md Step 2 self-references: 'proceed to Step 2' is a no-op instruction (should be Step 2.5 or Step 3)
- **Area:** Complete-milestone workflow instructions
- **Severity:** LOW
- **Status:** OPEN
- **Location:** commands/gsd-t-complete-milestone.md
- **Description:** Step 2 (Gap Analysis Gate), line 132: 'If all gaps resolved (100% Implemented) → proceed to Step 2'. This is a recursive self-reference - we are already in Step 2. The intended target is Step 2.5 (Distillation) or Step 3 (Gather Artifacts). Similarly, Step 10 (line 544) says 'include test pass/fail counts and shallow test audit results in the milestone summary (Step 4)' but Step 4 only creates the archive directory; summary.md is created in Step 5.
- **Impact:** Ambiguous workflow instructions may cause agents to loop on Step 2 or write test results to the wrong step's output.
- **Remediation:** Line 132: change 'proceed to Step 2' to 'proceed to Step 2.5'. Line 544: change '(Step 4)' to '(Step 5)'.
- **Found in slice:** project-init-and-lifecycle
### TD-286 - gsd-t-init.md Step 12 references non-existent 'Step 7.6' for Playwright setup
- **Area:** Init command / documentation correctness
- **Severity:** LOW
- **Status:** OPEN
- **Location:** commands/gsd-t-init.md
- **Description:** Step 12 (Test Verification), line 358: 'If existing code without tests: Playwright is now set up (Step 7.6)'. There is no Step 7.6 in gsd-t-init.md; Playwright setup is Step 11. This is a broken internal step reference.
- **Impact:** Minor confusion when following init documentation; agents or users may search for a Step 7.6 that does not exist.
- **Remediation:** Change '(Step 7.6)' to '(Step 11)' to match the actual step number for Playwright Setup.
- **Found in slice:** project-init-and-lifecycle
### TD-287 - init-scan-setup.md: techdebt archive filename uses only date (no time/sequence), overwriting previous archives on same-day re-runs
- **Area:** Init-scan-setup / archival
- **Severity:** LOW
- **Status:** OPEN
- **Location:** commands/gsd-t-init-scan-setup.md
- **Description:** Step 4 documents: 'If .gsd-t/techdebt.md already exists: the Workflow archives it to `.gsd-t/techdebt_YYYY-MM-DD.md`'. If a user runs init-scan-setup twice on the same day, the second run overwrites the first archive silently. No uniqueness mechanism (timestamp with time, sequence number, hash) is documented.
- **Impact:** Previous tech debt snapshots silently overwritten on same-day re-scans, losing historical diff data.
- **Remediation:** Change the archive filename to include an HH-MM timestamp or an incrementing sequence number: `.gsd-t/techdebt_YYYY-MM-DD_HHMM.md` or `.gsd-t/techdebt_YYYY-MM-DD_001.md` with collision detection.
- **Found in slice:** project-init-and-lifecycle
### TD-288 - doAutoUpdate failure notice redundantly displays the installed version instead of the available version
- **Area:** Update Check / User Messaging
- **Severity:** LOW
- **Status:** OPEN
- **Location:** scripts/gsd-t-update-check.js
- **Description:** Line 61 in `doAutoUpdate`'s catch block: `update available (v${installed} → v${latest})` - the variable is `installed` (current version) where it should be `installed` (old) on the left and `latest` (new) on the right. The issue is that the outer text already says `v${installed}`, making the banner read: `[GSD-T UPDATE] v4.0.12 - update available (v4.0.12 → v4.0.13)`. The installed version appears twice. It should read: `v{installed} - update available: v{latest}` or simply omit the redundant first part inside the parenthetical.
- **Impact:** Minor UX friction: the update banner is slightly confusing and duplicates version information. No functional impact since the SessionStart fetchLatestVersion is already broken (finding #1).
- **Remediation:** Change line 61 to: `console.log(\`${dateStamp()}[GSD-T UPDATE] v${installed} → v${latest} available. Auto-update failed - run: /gsd-t-version-update-all. Changelog: ${CHANGELOG}\`);` - consistent with the success banner format and removes the redundancy.
- **Found in slice:** metrics-telemetry-and-events
### TD-289 - readTaskMetrics reads entire JSONL file into memory synchronously on every preflight check
- **Area:** Metrics Performance / Scalability
- **Severity:** LOW
- **Status:** OPEN
- **Location:** bin/metrics-collector.js
- **Description:** Lines 51-60: `readTaskMetrics` uses `readFileSync` and loads the entire `task-metrics.jsonl` file into memory, then parses every line. `getPreFlightWarnings` (line 64) calls `readTaskMetrics` with a domain filter but still reads the full file. For long-running projects with many tasks (thousands of records across milestones), this is a synchronous block on every preflight invocation. No file-size cap, no streaming, no early-exit once enough records are loaded. The function then calls `.slice(-10)` on the filtered result - so the last 10 records per domain are the only ones used.
- **Impact:** Negligible for projects under 100 tasks. On large/long-running projects (1000+ tasks), each preflight adds measurable synchronous latency. Unlikely to be noticeable in practice given GSD-T usage patterns, but the architectural risk exists.
- **Remediation:** Add a size check: if the file exceeds a threshold (e.g., 1MB), log a warning or implement a tail-read (read from the end of file, parse backward until 10 domain-matched records are found). At minimum, cap the result set at the last N records before filtering to avoid parsing thousands of irrelevant lines.
- **Found in slice:** metrics-telemetry-and-events
### TD-290 - gsd-t-completion-check.cjs uses shell-interpolated execSync for git commands - potential injection via branch/date parameters
- **Area:** Security / Shell Safety
- **Severity:** LOW
- **Status:** OPEN
- **Location:** bin/gsd-t-completion-check.cjs
- **Description:** Lines 6-8: `run()` wraps `execSync(cmd, { cwd })` where `cmd` is a template literal string: `git log ${JSON.stringify(expectedBranch)} --since=${sinceArg} ...`. While `JSON.stringify` adds double-quotes around branch names (preventing simple injection like `main; rm -rf /`), `execSync` passes the string to the shell (`/bin/sh -c`). A branch name containing embedded double-quotes or backslashes could break out of the JSON quoting. The `taskStart` string is also JSON.stringify'd. In practice, these values come from the workflow orchestrator (not user input), so exploitation requires a compromised upstream caller. Still, `execFileSync('git', ['log', expectedBranch, '--since='+taskStart, ...])` would be categorically safer.
- **Impact:** Low practical risk given controlled caller context. The mitigation (JSON.stringify) provides meaningful protection for common cases. Severity elevated slightly because this module is called from Workflow orchestrators that might forward user-supplied values.
- **Remediation:** Replace the shell-string execSync with `execFileSync('git', ['log', expectedBranch, '--since='+taskStart, '--pretty=format:%H%x00%s'], { cwd, encoding: 'utf8', stdio: [...] })` to avoid shell interpolation entirely. Same pattern for `git status --porcelain` and `npm test --silent`.
- **Found in slice:** metrics-telemetry-and-events
### TD-291 - 33 orphan domain directories remain in .gsd-t/domains/ from M43-M65 milestones that were already archived
- **Area:** State File Integrity - Orphan Domain Dirs
- **Severity:** LOW
- **Status:** OPEN
- **Location:** .gsd-t/domains/
- **Description:** The domain-structure contract states: 'Archived by: gsd-t-complete-milestone - moves to .gsd-t/milestones/{name}/domains/. Cleared: After archival, .gsd-t/domains/ is emptied for next milestone.' M43 through M65 are all archived in `.gsd-t/milestones/` but their domain directories were never cleared from `.gsd-t/domains/`. Counting: m43-d1 through m43-d6, m44-d9, m45-d1, m45-d2, m52-d1, m52-d2, m54-d1, m54-d2, m56-d1 through m56-d5, m57-d1, m57-d2, m58-d1, m58-d2, m61-d1 through m61-d8, m65-d1 = 33 domain directories from completed+archived milestones still present in `.gsd-t/domains/`.
- **Impact:** The `buildTaskGraph()` library scans ALL domain directories when building the task graph. Having 33 orphan directories means every task graph build processes ~150+ stale task files. This adds noise to `gsd-t parallel --dry-run`, `gsd-t graph --output table`, and any tool consuming the task graph. The file-disjointness prover also reads all domains.
- **Remediation:** Run the domain cleanup for M43-M65: move domain dirs to their respective milestone archives (which already exist) or simply delete them since they're already archived. Then clear `.gsd-t/domains/` to contain only the current active milestone's domains (m66-d1, m67-d1, and any current active milestone domains).
- **Found in slice:** living-document-contracts-and-state
### TD-292 - unattended-supervisor-contract.md describes a retired system (gsd-t-unattended.cjs deleted in M61 D2)
- **Area:** Contract Drift - Retired Infrastructure
- **Severity:** LOW
- **Status:** OPEN
- **Location:** .gsd-t/contracts/unattended-supervisor-contract.md
- **Description:** The contract (639 lines) references `bin/gsd-t-unattended.cjs` as its primary implementation at lines 166, 174, 498, 637. This file does not exist on disk - it was deleted when M61 D2 retired the unattended relay supervisor. The contract describes ScheduleWakeup behavior, heartbeat, supervisor state machine, and iter-parallel mechanics that are now replaced by the native Workflow Unattended mode. Status at line 639: `PENDING - awaiting code domain implementation`. The unattended-event-stream-contract.md (Status: PROPOSED - M38 Domain 3) similarly describes a retired event stream format.
- **Impact:** Any agent reading this contract to implement unattended behavior will implement a deleted system. The contract's `PENDING` status is misleading - the system was not just pending, it was implemented and then retired. This is a documentation dead-end that could confuse future work on native unattended Workflow scheduling.
- **Remediation:** Mark both `unattended-supervisor-contract.md` and `unattended-event-stream-contract.md` as RETIRED with a note pointing to the native Workflow Unattended mode (M61 SC7) as the replacement. Add a cross-reference to `templates/workflows/gsd-t-unattended.workflow.js` if one exists, or to the CLAUDE.md Desktop as Cockpit section.
- **Found in slice:** living-document-contracts-and-state
### TD-293 - context-observability-contract.md references context-meter-state.json which M61 was supposed to retire
- **Area:** Contract Drift - Retired Infrastructure
- **Severity:** LOW
- **Status:** OPEN
- **Location:** .gsd-t/contracts/context-observability-contract.md, .gsd-t/contracts/token-budget-contract.md
- **Description:** context-observability-contract.md v2.0.0 (Status: ACTIVE) at line 25 says 'M34: read from `.gsd-t/.context-meter-state.json` (`pct` field) at log-write time.' and at line 68 says 'M34: Ctx% reads from `.gsd-t/.context-meter-state.json`'. This file was planned for deletion in M61 D1 T2 but survived. token-budget-contract.md v3.1.0 at line 111 says `getSessionStatus()` reads `.gsd-t/.context-meter-state.json`. Both contracts treat the file as live infrastructure while M61 was supposed to retire the whole context-meter subsystem in favor of native `/context`. The file on disk is stale (200K window, dated 2026-05-29).
- **Impact:** These contracts misdirect any agent implementing context observability toward a retired pattern. The `gsd-t.js doStatus` function reads this stale file and shows incorrect context utilization (200K window vs 1M actual).
- **Remediation:** After deleting `.gsd-t/.context-meter-state.json` and the context-meter code in gsd-t.js (per the HIGH finding above), update these contracts to say Ctx% is no longer measured via PostToolUse hook - agents should use the native `/context` command or `CLAUDE_CONTEXT_TOKENS_USED` env if available. Mark context-observability-contract.md as RETIRED or update to v3.0.0.
- **Found in slice:** living-document-contracts-and-state


---

## ✅ Resolved

> Items confirmed resolved and moved here from the open register. Full original text preserved.

### TD-129 - Non-atomic multi-file write in graph-store (M20–M21 dead engine retired)
- **Area:** Graph engine
- **Severity:** HIGH
- **Status:** RESOLVED
- **Resolved:** 2026-06-26 10:46 PDT — M94 D7-T1 (d7-integrate-rewire). The entire M20–M21 dead engine (`bin/graph-{store,cgc,indexer,overlay,parsers,query}.js`) was DELETED (USER-APPROVED, requirer-verified). The atomicity concern is moot — the new M94 D3 SQLite store uses WAL mode + `better-sqlite3` transactions (atomic per-file putRecord). Dispatch rewired in `bin/gsd-t.js` to the new D5 CLI (`bin/gsd-t-graph-query-cli.cjs`). Dead test files (`test/graph-{indexer,store,query}.test.js`) also deleted. `[RULE] graph-status-live`.

### TD-113 - Six 'native Workflow' scripts use Node.js require() / fs / process - ReferenceError in sandbox
- **Area:** Sandbox contract violation
- **Severity:** CRITICAL
- **Status:** RESOLVED
- **Resolved:** 2026-06-05 16:53 PDT — M81 runtime-native workflows (v4.0.29, commits 98a2e04 / 83a0912). All 8 `templates/workflows/*.workflow.js` are now runtime-native: zero `require(`/`child_process`/`spawnSync`/`process.` outside comments; each `JSON.parse`s `args` and delegates CLI calls via inline `runCli`/agent-Bash helpers. Verified on disk.
- **Location:** templates/workflows/gsd-t-execute.workflow.js, templates/workflows/gsd-t-verify.workflow.js, templates/workflows/gsd-t-wave.workflow.js, templates/workflows/gsd-t-integrate.workflow.js, templates/workflows/gsd-t-debug.workflow.js, templates/workflows/gsd-t-quick.workflow.js, templates/workflows/gsd-t-phase.workflow.js
- **Description:** All six workflows claim 'Runtime: Anthropic native Workflow tool only' in their headers, but every one calls `require('./_lib.js')` at the top level. The native Workflow sandbox explicitly does NOT provide `require`, `module`, `fs`, `path`, `child_process`, or `process` - the M71 comment in gsd-t-scan.workflow.js (line 5-6) documents this exactly: 'Using any of those throws `ReferenceError: require is not defined` at runtime - the bug (M71) that made every GSD-T workflow silently fail'. gsd-t-scan.workflow.js was correctly migrated to not use require(); the other six were not. Additionally: gsd-t-verify.workflow.js (line 183-187) uses `require('child_process')`, `require('fs')`, `require('path')`, and `process.execPath` inside the _runJsonCli function body; gsd-t-wave.workflow.js imports lib but never uses it (dead import that still crashes); gsd-t-execute.workflow.js imports both _lib and `path` (path is never used). The M71 lint test (test/m71-workflow-runtime-native-lint.test.js) guards only `RUNTIME_NATIVE = ['gsd-t-scan.workflow.js']` - the other six are outside the guard.
- **Impact:** Every invocation of execute, verify, wave, integrate, debug, quick, or phase via the Workflow tool crashes immediately with `ReferenceError: require is not defined` before executing a single agent() call. The full GSD-T phase lifecycle is broken for all workflows except scan. This is the same class of failure M71 was created to prevent - the migration stalled after scan.
- **Remediation:** Complete the M71 migration for all six remaining workflows: (1) Move the _lib.js helper functions that are actually needed (runPreflight, generateBrief, proveFileDisjointness, runVerifyGate, loadProtocol) into agent() call prompts - the agents have Bash tool access and can shell out to `gsd-t preflight --json`, `gsd-t brief`, etc. (2) For gsd-t-verify.workflow.js's _runJsonCli, move CI-parity and test-data CLI calls into a dedicated agent() stage (haiku model) that uses Bash. (3) Add all six filenames to the RUNTIME_NATIVE array in test/m71-workflow-runtime-native-lint.test.js so the lint gate covers them. (4) gsd-t-wave.workflow.js: remove the unused `const lib = require('./_lib.js')` entirely since wave only composes two workflow() calls.
- **Found in slice:** workflow-orchestration-engine

### TD-117 - gsd-t-verify.workflow.js uses sandbox-banned globals (require, spawnSync, fs, process.execPath)
- **Area:** Workflow sandbox compliance
- **Severity:** HIGH
- **Status:** RESOLVED
- **Resolved:** 2026-06-05 16:53 PDT — M81 (v4.0.29). gsd-t-verify.workflow.js no longer has the top-level `require('./_lib.js')` or the `_runJsonCli` spawnSync/require block; CLI calls now run via agent-Bash helpers and the file is in the M71 lint RUNTIME_NATIVE list. Verified clean.
- **Location:** templates/workflows/gsd-t-verify.workflow.js
- **Description:** Lines 33 and 183-196 use require('./_lib.js'), require('child_process'), require('fs'), require('path'), spawnSync, and process.execPath. The Anthropic native Workflow sandbox (documented in gsd-t-scan.workflow.js lines 3-6 and memory:feedback_workflow_must_run_in_real_sandbox.md) does NOT provide these globals. Any call throws ReferenceError at runtime. The very first executed line - `const lib = require('./_lib.js')` - fails, making the entire verify workflow abort before running preflight, verify-gate, CI-Parity (M57), Test-Data Purge (M58), or the orthogonal triad. All quality gates are silently bypassed. The M71 lint test (test/m71-workflow-runtime-native-lint.test.js line 38) explicitly excludes gsd-t-verify.workflow.js from the forbidden-globals check, confirming this is known migration debt. The _runJsonCli helper embedded at lines 183-206 (spawnSync for build-coverage, ci-parity, test-data) is the additional failure surface beyond the lib= require.
- **Impact:** Every /gsd-t-verify invocation via the Workflow tool fails on the first line. The CLI instruction says 'do NOT hand-drive', but the Workflow tool throws, forcing a fallback to hand-driven mode which skips all deterministic gates. This means the FAIL-blocking CI-Parity (M57) and Test-Data Purge (M58) gates are never enforced in production verify runs.
- **Remediation:** Migrate gsd-t-verify.workflow.js to runtime-native architecture following the gsd-t-scan.workflow.js pattern: remove all top-level require() calls, move I/O into agent() stages (subagents have Bash/Read/Write tools), pass projectDir into prompts instead of reading directly. The _runJsonCli calls should become agent() stages that run the CLI tools via Bash. Add 'gsd-t-verify.workflow.js' to the RUNTIME_NATIVE list in test/m71-workflow-runtime-native-lint.test.js after migrating.
- **Found in slice:** verify-gate-and-ci-parity, workflow-orchestration-engine

### TD-168 - M71 native-lint test guard covers only gsd-t-scan.workflow.js - six others unprotected
- **Area:** Test coverage gap
- **Severity:** MEDIUM
- **Status:** RESOLVED
- **Resolved:** 2026-06-05 16:53 PDT — M81 (v4.0.29). The RUNTIME_NATIVE array in test/m71-workflow-runtime-native-lint.test.js now lists all 8 workflows, not just scan. Verified on disk.
- **Location:** test/m71-workflow-runtime-native-lint.test.js
- **Description:** The RUNTIME_NATIVE list in the M71 lint test (line 38) contains only `['gsd-t-scan.workflow.js']`. The FORBIDDEN patterns list (lines 24-33) correctly identifies all sandbox-forbidden globals: require(), module.exports, child_process, spawnSync, execSync, execFileSync, process.execPath, and fs.* calls. However, six other workflows (execute, verify, wave, integrate, debug, quick, phase) all violate these patterns and are not checked. The test comment (line 37) explicitly acknowledges this: 'once workflows are runtime-native they no longer require it. While the migration is in progress, only assert on workflows already migrated.' The migration has stalled - the comment implies the list should grow as workflows are fixed.
- **Impact:** New regressions (accidentally re-adding require() to scan, or adding new workflow files with require()) are caught only for scan. The six unguarded workflows can ship with sandbox-breaking calls indefinitely. This test was designed as a ratchet to enforce the M71 migration, but the ratchet is frozen.
- **Remediation:** After fixing the require() usage in each workflow per finding #2, add each fixed file to the RUNTIME_NATIVE array. The final state should be all *.workflow.js files in the list. Consider also adding a 'all workflow files are in the lint list' assertion to prevent future additions from being silently unguarded.
- **Found in slice:** workflow-orchestration-engine

### TD-239 - gsd-t-wave.workflow.js imports _lib.js but never uses it - dead require in sandbox-violating import
- **Area:** Dead code / sandbox violation
- **Severity:** LOW
- **Status:** RESOLVED
- **Resolved:** 2026-06-05 16:53 PDT — M81 (v4.0.29). gsd-t-wave.workflow.js no longer has any `require("./_lib.js")` (only a comment referencing the old bug). Verified on disk.
- **Location:** templates/workflows/gsd-t-wave.workflow.js
- **Description:** Line 17 imports `const lib = require('./_lib.js')` but `lib` is never referenced anywhere else in the file. The wave workflow only calls `workflow('gsd-t-execute', ...)` and `workflow('gsd-t-verify', ...)` - it needs no lib helpers. This dead import contributes nothing but causes the sandbox ReferenceError described in finding #2. If the workflow is fixed by removing all require() calls, this line must be removed as the first step.
- **Impact:** Currently masks under finding #2 (the require() crash), but if someone removes only the 'used' require calls and misses this one, the dead import continues to cause the sandbox crash.
- **Remediation:** Remove line 17 (`const lib = require('./_lib.js')`). The wave workflow is the simplest of all - it only composes two workflow() calls and needs no helper imports.
- **Found in slice:** workflow-orchestration-engine

### TD-240 - gsd-t-execute.workflow.js imports path module but never uses it - dead require
- **Area:** Dead code / sandbox violation
- **Severity:** LOW
- **Status:** RESOLVED
- **Resolved:** 2026-06-05 16:53 PDT — M81 (v4.0.29). gsd-t-execute.workflow.js no longer has `const path = require('path')`. Verified on disk.
- **Location:** templates/workflows/gsd-t-execute.workflow.js
- **Description:** Line 69 (`const path = require('path')`) imports the Node.js path module, but no `path.*` call appears anywhere in the execute workflow body. The lib import at line 68 does use path internally, but execute's own code does not. This is a dead import that also contributes to the sandbox ReferenceError crash.
- **Impact:** When fixing the require() violations, this dead import could be mistakenly preserved because it 'looks harmless'. It must be removed as part of the M71 migration.
- **Remediation:** Remove line 69. If path manipulation is needed in the future (e.g., to resolve briefPath), it should be expressed via agent() Bash calls, not Node.js require().
- **Found in slice:** workflow-orchestration-engine
