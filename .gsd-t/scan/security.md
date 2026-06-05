# Security Audit — 2026-06-04 (Scan #12)

Deep scan of `.` - security findings from the M79+ verified finding set.
Findings from prior scans are preserved below under their original heading.

---

## HIGH Severity

### SEC-H1: Hardcoded Neo4j password in source and Docker run arguments

- **File**: `bin/gsd-t.js` (lines 1312, 1323, ~2930)
- **Details**: The password `gsdt-graph-2026` is hardcoded in three places: the `docker run -e NEO4J_AUTH=neo4j/gsdt-graph-2026` argument (line 1312), the doctor hint string (line 1323), and the doctor output (~2930). `installCgc()` creates a Neo4j container with `--restart unless-stopped`, so this password persists across reboots. The container binds ports 7474 and 7687. All users of this feature share the same known credential.
- **Fix**: Generate a random password on first install via `crypto.randomBytes(16).toString('hex')` and persist it to `~/.claude/.gsd-t-neo4j.json`. Read it back for the `docker run` command and the cgc config call. At minimum, emit a warning in `gsd-t doctor` output that this is a shared known credential.

---

### SEC-H2: agentId used in file path with no containment check - path traversal

- **File**: `scripts/gsd-t-watch-state.js` (line 153)
- **Details**: `filePath = path.join(_stateDir(cwd), agentId + '.json')` at line 153. `agentId` comes from `--agent-id` CLI argument (line 65) or `GSD_T_AGENT_ID` env var (line 67) with no sanitization. Node's `path.join` normalizes `..` segments, so an agentId of `../../evil` resolves outside `.gsd-t/.watch-state/`. The result is passed directly to `_atomicWrite` (line 157), which creates parent directories recursively and writes arbitrary JSON content to the resolved path.
- **Fix**: After constructing `filePath`, add a containment check before calling `_atomicWrite`: `const stateDir = path.resolve(_stateDir(cwd)); if (!filePath.startsWith(stateDir + path.sep)) { process.stderr.write('[gsd-t-watch-state] invalid agent-id\n'); return 1; }`. Also add a character allowlist for agentId: `/^[a-zA-Z0-9_-]+$/`.

---

### SEC-H3: Unchecked Cypher injection in cgcProvider 'cypher' case and maxDepth interpolation

- **File**: `bin/graph-cgc.js` (lines 493-496, 443-446)
- **Details**: The `'cypher'` dispatch case (lines 493-496) passes `params.query` directly to `execute_cypher_query` with zero sanitization - any caller that controls `params.query` can execute arbitrary Cypher, including `MATCH (n) DETACH DELETE n`. The `'findCircularDeps'` case (line 445) interpolates `params.maxDepth` directly into a Cypher template string: `` `MATCH path = (a:Function)-[:CALLS*2..${params.maxDepth || 5}]->(a)` ``. A non-integer or injection string like `5}->(a) RETURN 1 UNION MATCH (n) DETACH DELETE n //` produces a destructive query.
- **Fix**: For `'cypher'`: remove the raw passthrough or restrict to an explicit allowlist of known-safe query templates. For `maxDepth`: validate with `Number.isInteger(v) && v > 0 && v <= 20` before interpolation, defaulting to 5 on any invalid input and rejecting values that do not pass.

---

### SEC-H4: SAFE_ENTITY_RE allows path separators and regex metacharacters - grep pattern injection

- **File**: `bin/graph-query.js` (line 302, 310, 326)
- **Details**: `SAFE_ENTITY_RE = /^[\w.\-/\\:]+$/` (line 302) gates entity names before passing to grep. The regex allows `.` (a grep BRE metacharacter meaning "any char"), `/` and `\\` (path separators), and `..` via consecutive dots. A name like `../etc/passwd` passes the check. In `getImporters` (line 326), the name is passed as part of a `-e` pattern so `.` in a name like `foo.bar` matches `fooXbar`, producing false positives and potential out-of-scope file reads.
- **Fix**: Use `grep -F` (fixed strings) for `getCallers`. For `-e` patterns in `getImporters`, escape regex metacharacters: `name.replace(/[.+*?^${}()|[\]\\]/g, '\\$&')`. Explicitly reject names containing `/` or `..`.

---

### SEC-H5: Unsanitized item.id in file paths - path traversal in feedback and queue endpoints

- **File**: `scripts/gsd-t-design-review-server.js` (lines 419, 801, 807, 814-819)
- **Details**: `item.id` values from queue JSON files are used directly in `path.join()` calls. `writeFeedback()` at line 419 constructs `path.join(fbDir, item.id + '.json')`. The `/review/api/exclude` handler (lines 814-819) uses `reviewQueue[i].id` to build paths for file deletion. The attachment filename at line 398 correctly applies `safeId = String(item.id).replace(/[^a-zA-Z0-9_-]/g, '_')`, but the feedback write and queue deletion paths skip this sanitization entirely.
- **Fix**: Apply the same sanitization used for attachment filenames (line 398) to `item.id` in all `path.join` calls: `const safeItemId = String(item.id).replace(/[^a-zA-Z0-9_-]/g, '_');`. Use `safeItemId` in `writeFeedback`, auto-reject writes, and the `/review/api/exclude` handler.

---

### SEC-H6: Proxy buffers gzip-compressed HTML then attempts string parsing without decompression

- **File**: `scripts/gsd-t-design-review-server.js` (lines 443, 454-467)
- **Details**: `proxyRequest()` (lines 437-484) buffers HTML response chunks then calls `Buffer.concat(chunks).toString('utf8')` and does string replacement to inject the overlay script. Line 467 deletes `content-encoding` from the outgoing headers but never decompresses the body first. The request headers are forwarded unchanged at line 443 (`headers: { ...req.headers, ... }`), so `Accept-Encoding: gzip, br` reaches Vite's dev server, which responds with compressed content. The result is that `toString('utf8')` receives raw compressed bytes, the `</body>` replacement silently fails, and the corrupted buffer is sent to the browser.
- **Fix**: Delete `accept-encoding` from the forwarded request headers before proxying: `delete opts.headers['accept-encoding']`. This forces the upstream dev server to return uncompressed HTML. Alternatively, decompress via `zlib.createGunzip()` or `zlib.createBrotliDecompress()` based on the actual `content-encoding` response header value before calling `toString()`.

---

### SEC-H7: spawnClaudeSession missing --dangerously-skip-permissions - debug-loop exits on first tool use

- **File**: `bin/gsd-t.js` (line 3948, ~3997)
- **Details**: `doHeadlessExec` at line 3653 correctly includes `'--dangerously-skip-permissions'`. `spawnClaudeSession` at line 3948, called by the debug-loop (~line 4101) and `runLedgerCompaction` (~line 3997), does not. Without this flag the child `claude -p` process exits on first tool use, producing "permission required" in output. `parseTestResult` sees "error" and marks the iteration failed. The loop burns all 20 iterations with no changes made, then exits code 1.
- **Fix**: Add `'--dangerously-skip-permissions'` to the args array in `spawnClaudeSession` at line 3948: change `execFileSync("claude", ["-p", prompt, "--model", model], ...)` to `execFileSync("claude", ["-p", "--dangerously-skip-permissions", prompt, "--model", model], ...)`. Apply the same fix to `runLedgerCompaction`.

---

## MEDIUM Severity

### SEC-M1: registerProject read-then-write has no lock - concurrent registrations silently drop entries

- **File**: `bin/gsd-t.js` (~line 282)
- **Details**: `registerProject` reads `PROJECTS_FILE`, appends to an in-memory array, and writes the full file back with plain `writeFileSync`. If two `gsd-t register` or `gsd-t init` processes run simultaneously (e.g. a CI script initializing multiple projects in parallel), both read the same state and the second write overwrites the first. One registration is silently lost. The write is not atomic (no tmp+rename). Stale entries are also never pruned.
- **Fix**: Use a tmp+rename pattern for the write (`PROJECTS_FILE + '.tmp.' + process.pid`, then `fs.renameSync`) to make the write atomic on POSIX. Filter out missing paths in `getRegisteredProjects` and write the cleaned list back when stale entries are found.

---

### SEC-M2: checkin.md instructs 'git add -A' - violates staging policy, risks committing sensitive files

- **File**: `commands/checkin.md` (line 40)
- **Details**: `checkin.md` line 40 instructs staging via `git add -A`. The global CLAUDE.md pre-commit gate and `cpua.md` both explicitly prohibit `git add -A` because it "can accidentally include sensitive files (.env, credentials) or large binaries." `checkin.md` is used across non-GSD-T projects, widening the blast radius.
- **Fix**: Change the instruction to stage files explicitly: "Stage the changed files explicitly using `git add <files>`. Review `git status` first and exclude runtime artifacts, logs, and `.env` files." Mirror the cpua.md pattern which says "Never `git add -A`".

---

### SEC-M3: Orchestrator silently mutates design contract files without user confirmation - Destructive Action Guard violation

- **File**: `bin/orchestrator.js` (lines 786-868)
- **Details**: An "element inventory validation" at lines 786-868 reads design contract files from `.gsd-t/contracts/design/`, uses a word-overlap heuristic (score >= 2) to pick a closest-match replacement for unrecognized element references, then calls `fs.writeFileSync(cfPath, content)` (line 856) to silently overwrite the contract. The Destructive Action Guard in CLAUDE.md requires stopping before any action that would "require other parts of the system to be rewritten." The heuristic regex is hardcoded to a specific set of component prefixes and can produce incorrect substitutions with no user notification.
- **Fix**: Remove the silent auto-correction. Replace with a preflight check that reports which contracts reference unknown elements and halts with an error listing the missing elements and closest matches, requiring the user to update the contract manually. If auto-correction is retained, it must log what will be changed before writing and require an explicit `--auto-correct` flag.

---

### SEC-M4: settings.json corrupted by five independent read-modify-write cycles during install

- **File**: `bin/gsd-t.js` (~lines 356, 893, 973, 1060, 1550)
- **Details**: `doInstall()` calls five separate functions that each independently read `settings.json`, mutate an in-memory object, and write the file back. If Claude Code (also active during install) writes `settings.json` between any two of these calls, the last writer wins and silently drops hooks written by earlier functions. The install flow runs at session startup with Claude Code active, making the race window real.
- **Fix**: Load `settings.json` once at the start of `doInstall`, pass the mutable object into each `configure*` function as a parameter, and flush to disk a single time after all hooks have been applied.

---

### SEC-M5: Unbounded POST /ingest body accumulation - no size limit

- **File**: `scripts/gsd-t-stream-feed-server.js` (lines 260-286)
- **Details**: `ingestStream` (lines 260-286) accumulates all incoming bytes into `buf` with no maximum size check. The loopback-only guard at lines 173-177 reduces exposure but does not eliminate it. A misbehaving local worker or a tight loop that never emits `\n` can grow `buf` to gigabytes before the process OOMs. There is no per-line cap on line length before `JSON.parse` either.
- **Fix**: Add a `MAX_BODY_BYTES` constant (e.g. 64 MB) and track cumulative bytes received. If the limit is exceeded, call `req.destroy()`, respond 413, and clear `buf`. Add a per-line cap (e.g. 1 MB) on `line.length` before `JSON.parse`.

---

### SEC-M6: WebSocket close frame encodes payload > 125 bytes - RFC 6455 violation

- **File**: `scripts/gsd-t-stream-feed-server.js` (lines 343-352)
- **Details**: `encodeWsCloseFrame` writes `body.length` directly into `header[1]` (line 350) for any reason string length. RFC 6455 section 5.5 requires all control frames to have a payload of at most 125 bytes and not be fragmented. When a JSON-encoded reason plus the 2-byte status code exceeds 125 bytes, the close frame is non-conformant. Strict RFC-compliant clients may reject or silently drop the malformed frame, leaving the connection in an undefined state.
- **Fix**: Truncate the reason string to at most 123 UTF-8 bytes before encoding: `const r = Buffer.from((reason || '').slice(0, 123), 'utf8');`. Add an assertion `assert(body.length <= 125)` in the test suite.

---

# Security Audit — 2026-04-16 (Scan #11, archived)

GSD-T is a developer-tooling package distributed via npm with **zero runtime
dependencies**. Threat surface is narrow: local file I/O, child-process invocation
(git, claude, node, playwright, tree-sitter binaries, npm), and two localhost-bound
HTTP servers (dashboards). No network listeners that bind to public interfaces, no
auth tokens issued, no DB.

## Critical (fix immediately)

_None new in Scan #11._

(Note: the previously-tracked **TD-097 / SEC-C01** — command injection in
`bin/graph-query.js` `grepQuery()` via `params.entity` — is carried forward from
Scan #10 in the archive at `.gsd-t/techdebt_2026-03-19.md`. Confirm fix status before
the next milestone closes.)

## High (fix soon)

### SEC-H01 — `runway-estimator.js` still requires/uses `ANTHROPIC_API_KEY` as if it were mandatory
- File: `bin/runway-estimator.js`, `bin/runway-estimator.cjs`
- After v3.11.11 the context meter no longer needs the key, but `runway-estimator`
  was not audited in the same change. If a user follows the stale "you must set
  `ANTHROPIC_API_KEY`" instruction in CHANGELOG.md / README.md / docs and exports a
  key, it is now used **only** by runway-estimator (and possibly a few telemetry paths)
  — vs the broad "this is required for context-meter" framing. Risk: users assume the
  key is for measurement and don't realize it gates a separate pre-flight estimator.
- Remediation: doc-ripple every reference to align with v3.11.11 reality (see
  Quality TD-103); if runway-estimator should also drop the requirement, do that as a
  follow-up.
- Severity: HIGH (documentation security — wrong mental model leads to misconfigured
  trust boundaries).

### SEC-H02 — Test file `scripts/gsd-t-context-meter.test.js` references `_countTokens` injection that no longer exists
- File: `scripts/gsd-t-context-meter.test.js` (lines 108, 130, 152, 178, 209, 220, 358)
- 7 tests fail because `runMeter()` no longer accepts a `_countTokens` injection (the
  whole API path was deleted in v3.11.11 in favor of `_estimateTokens`).
- **Why this is a security item, not just a quality one**: the broken tests cover the
  exact paths that handle missing API key, API timeout, API failure, fail-open, and
  the "log never contains message content" privacy invariant. A failing/skipped privacy
  test is a real risk — if the `estimate-tokens.js` code path were to start logging
  message content, no test would catch it because the corresponding assertion is in a
  test that fails on import-time API mismatch, not on the privacy invariant itself.
- Remediation: rewrite the 7 tests to inject `_estimateTokens` and target the local
  estimator's behavior, including a test that the new code path also never logs
  content. (The `tokens=42`-vs-`tokens=8` discrepancy in test #11 confirms the fixture
  numbers were not updated for the new estimator output.)
- Severity: HIGH (privacy-test regression).

## Medium (plan to fix)

### SEC-M01 — Two dashboard servers bind to localhost ports without auth
- Files: `scripts/gsd-t-dashboard-server.js` (port 7433), new
  `scripts/gsd-t-agent-dashboard-server.js` (port 7434).
- Carried debt (`TD-090` in archive — original was 7433 only). The new agent dashboard
  doubles the surface.
- Localhost-only is reasonable for a dev tool, but multi-user macOS/Linux machines
  share `127.0.0.1` between users — a co-tenant could read events/heartbeat/context-meter
  state via the SSE stream.
- Remediation: bind to `127.0.0.1` only (verify in code), add a one-time auth token
  printed at startup that the HTML page must echo back, or document the trust model
  explicitly in `infrastructure.md`.
- Severity: MEDIUM.

### SEC-M02 — Stale documentation tells users to export `ANTHROPIC_API_KEY` — risk of key paste in shared docs
- Files: README.md (10 hits), docs/infrastructure.md (12), docs/architecture.md (4),
  docs/methodology.md (multiple), CHANGELOG.md (multiple).
- The instructions say "free tier is sufficient — `count_tokens` is inexpensive" and
  show an `export ANTHROPIC_API_KEY="sk-ant-..."` snippet. Post-v3.11.11 these are
  obsolete: the count_tokens path is removed. Users who follow the stale instructions
  may copy keys into shared shell-init files thinking they need to.
- Remediation: doc-ripple — either remove all references or move to a clearly labeled
  "Optional: for runway estimator and telemetry — not required by context meter"
  section.
- Severity: MEDIUM (mis-instruction → unnecessary credential exposure).

### SEC-M03 — `bin/scan-export.js` and `bin/scan-renderer.js` still use `execSync` with string interpolation
- Carried debt (TD-084 in archive). Confirm scope hasn't grown.
- Remediation: switch to `execFileSync` with array args.

## Low (nice to have)

### SEC-L01 — 76 `heartbeat-*.jsonl` files clutter `.gsd-t/`
- Gitignored (verified) — not a leak risk, but each file contains session telemetry
  that may include task names/file paths. If a user accidentally tarballs `.gsd-t/` to
  share progress with a teammate, this pile travels with it.
- Remediation: add a `gsd-t doctor` hint or a session-end cleanup step that rotates
  heartbeats >30 days old into `.gsd-t/heartbeat-archive/` (or deletes them).

### SEC-L02 — `bin/gsd-t-unattended.js` uses `execSync` for cross-platform queries
- Carried context. Already uses array-arg form for most calls (verified
  `gsd-t-unattended-platform.js:132`, `:212`, `:247`, `:332`, `:342`, `:354`); audit
  remaining `execSync` site at `gsd-t-unattended.js:252` for input sanitization.

### SEC-L03 — No SRI hashes on dashboard CDN resources
- Carried debt (TD-095, TD-096 in archive). New `gsd-t-agent-dashboard.html` should be
  audited for the same.

## Dependency Audit

```
$ npm audit
npm error code ENOLOCK
npm error audit This command requires an existing lockfile.
```

- **No `package-lock.json`** in the repo. With zero declared dependencies this is fine
  in production (nothing to lock), but it disables `npm audit` as a routine check in CI.
- Recommendation: generate a lockfile in CI (`npm i --package-lock-only`) and run audit
  there — even with zero deps it would catch any future dependency added without going
  through the zero-dep policy review.

## Secret Management
- No `.env*` files in the repo (verified — only the `.env*` rule in `.gitignore`).
- No hardcoded credentials found in `bin/` or `scripts/`. The 10 files matched by the
  initial grep all reference `password|secret|api_key|token|credential` as identifier
  strings (config field names, telemetry tags) — not literal values.
- Config-loader API-key leak guard (`bin/context-meter-config.cjs`) actively rejects
  fields that look key-shaped — strong positive control.

## CORS / CSP / Rate Limiting
- N/A — no public HTTP surface. Localhost dashboards do not implement CSP (carried
  TD-096); low priority while local-only.

## File Upload
- N/A.
