# GSD-T: Verify — Quality Gates (Solo or Parallel)

You are the lead agent coordinating verification of the completed work. Each verification dimension should be thorough and independent.

## Argument Parsing

Parse `$ARGUMENTS`. M43 D4 removed the `--watch` opt-out; `--in-session`/`--headless` were never shipped. Under `.gsd-t/contracts/headless-default-contract.md` **v2.0.0** every verify spawn goes headless unconditionally. A legacy `--watch` token is accepted but ignored (stderr deprecation line).

## Spawn Primitive — Always Headless (M43 D4, v2.0.0)

Per `.gsd-t/contracts/headless-default-contract.md` v2.0.0. Spawn classifications used below:

- `spawnType: 'validation'` — Step 4 test-audit subagent, Step 8 auto-invoke complete-milestone

Spawn path is `autoSpawnHeadless({command, spawnType: 'validation', projectDir, sessionContext})`. Auto-invoke of complete-milestone (Step 8) is preserved — spawned headless via the same primitive and surfaced via the read-back banner.

## Model Assignment

Per `.gsd-t/contracts/model-selection-contract.md` v1.0.0.

- **Default**: `opus` (`selectModel({phase: "verify"})`) — milestone verification is the final quality gate before completion. High stakes.
- **Escalation**: already at opus; there is no stronger tier. Verify judgments are always made at full quality.

## Step 1: Load State

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-verify --step 1 --step-label "Load State" 2>/dev/null || true
```

Read:
1. `CLAUDE.md`
2. `.gsd-t/progress.md` — confirm status is INTEGRATED
3. `.gsd-t/contracts/` — all contracts
4. `.gsd-t/domains/*/tasks.md` — all acceptance criteria
5. `docs/requirements.md` — original requirements
6. All source code

## Step 1.5: Graph-Enhanced Traceability Check

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-verify --step 1 --step-label ".5: Graph-Enhanced Traceability Check" 2>/dev/null || true
```

If `.gsd-t/graph/meta.json` exists (graph index is available):
1. Query `getRequirementFor` on implemented entities to build a requirement-to-code traceability chain — flag entities with no requirement mapping
2. Query `getDomainBoundaryViolations` to verify no cross-domain boundary violations exist in the final codebase
3. Include any violations as FAIL findings in the verification report (Step 5)

If graph is not available, skip this step.

## Step 2: Full Test Audit (Inline)

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-verify --step 2 --step-label "Full Test Audit (Inline)" 2>/dev/null || true
```

Run the full test audit directly:

1. Run the full test suite: `npm test` (or project equivalent) — record pass/fail counts
2. Read all contracts in `.gsd-t/contracts/` — verify each has at least one test validating it
3. Check acceptance criteria from domain task lists — verify each is tested
4. Run E2E suite if `playwright.config.*` exists
5. Report: comprehensive test results with pass/fail counts and coverage gaps

Verification cannot complete if any test fails or critical contract gaps remain.

<!-- M55-D5: verify-gate wire-in -->
**M55 Verify-Gate (mandatory two-track gate):**

Before finalizing the verify report, invoke the M55 verify-gate. It runs Track 1
(`bin/cli-preflight.cjs::runPreflight` — preflight envelope; hard-fails on any
`severity:"error"` check) AND Track 2 (`bin/parallel-cli.cjs::runParallel` fans
out off-the-shelf CLIs: tsc, biome/ruff, npm test, knip, gitleaks, scc/lizard).
Both tracks always run; both report. The gate's `ok` flag is purely
deterministic (`track1.ok && track2.ok`) — the LLM judge's verdict is advisory.

```bash
gsd-t verify-gate --json > /tmp/gsd-t-verify-gate.json || true
GATE_OK=$(node -e "const e=require('/tmp/gsd-t-verify-gate.json');console.log(e.ok?'true':'false')")
```

If `GATE_OK=false`, surface the failed track to the user and do NOT mark verify
complete. The summary in the envelope is ≤500 tokens — pipe it to the LLM judge
for a confirming verdict:

```bash
cat /tmp/gsd-t-verify-gate.json | gsd-t verify-gate-judge > /tmp/gsd-t-verify-gate-prompt.txt
```

The judge prompt (`bin/gsd-t-verify-gate-judge.cjs`) is ≤500 tokens regardless
of envelope size — feed it to the LLM judge to render a `PASS` / `FAIL` verdict
on the deterministic summary. The LLM verdict NEVER overrides `ok` — it
confirms or contradicts. A contradiction is a Red Team finding, not a gate
override.

Raw worker output stays at `.gsd-t/verify-gate/{runId}/{workerId}.{stdout,stderr}.ndjson`
for human-only inspection. The directory is gitignored.

Defensive on missing `.gsd-t/ratelimit-map.json` — verify-gate falls back to
`maxConcurrency=2` and logs a structured note. Override with
`gsd-t verify-gate --max-concurrency N --json` if needed.

Contract: `.gsd-t/contracts/verify-gate-contract.md` v1.0.0 STABLE.

<!-- M57: CI-parity FAIL-blocking gate -->
## Step 2.6: CI-Parity Gate (MANDATORY — FAIL-blocking, never warning-only)

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-verify --step 2 --step-label ".6: CI-Parity Gate" 2>/dev/null || true
```

Origin: TimeTracking v1.10.12 shipped VERIFIED + tagged while Cloud Build
failed (a new top-level `hooks/` dir was committed but never added to the
Dockerfile `COPY` directives, and `noImplicitAny` regressions passed a
warm-cache local `tsc` but failed CI's cold build). `gsd-t-verify` must
reproduce the project's *actual* CI build, not assume local parity.

Run BOTH checks. **Either failing is a verify FAIL — it blocks
complete-milestone. This is never a warning-only signal.**

```bash
# 1. Build-coverage — every new top-level path in the milestone range must be
#    referenced by a real CI build input (structural parse, not substring).
gsd-t build-coverage --json > /tmp/gsd-t-build-coverage.json
BC_EXIT=$?

# 2. CI-parity — reproduce the project's actual CI build locally with caches
#    cleared; auto-runs `docker build` when a Dockerfile is present.
gsd-t ci-parity --json > /tmp/gsd-t-ci-parity.json
CP_EXIT=$?
```

- `build-coverage` exit **4** (`ok:false`, `missing[]` non-empty) → verify
  FAIL. Report each uncovered path; the fix is to add the path to the
  Dockerfile `COPY` / cloudbuild artifact / workflow build input.
- `ci-parity` exit **4** (`ok:false` — a detected CI command or the real
  `docker build` failed) → verify FAIL. Report the failing command.
- exit **0** from both → gate passes.
- exit **2** (usage error, e.g. not a git repo) → record as a structured
  note; not a pass-by-default (investigate before proceeding).

Both are pure-deterministic CLI checks (no LLM). They consume the same
preflight envelope as the M55 verify-gate Track 1, so failing here at
verify mirrors what CI would do — catching the TimeTracking class before
the milestone is tagged.

Contracts: `.gsd-t/contracts/cli-build-coverage-contract.md` v2.0.0 STABLE,
`.gsd-t/contracts/ci-parity-contract.md` v2.0.0 STABLE.
<!-- /M57: CI-parity FAIL-blocking gate -->

## Step 2.5: High-Risk Domain Gate (MANDATORY — Categories 2 and 7)

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-verify --step 2 --step-label ".5: High-Risk Domain Gate (MANDATORY — Categories 2 and 7)" 2>/dev/null || true
```

Before running standard verification dimensions, check whether this milestone involves any high-risk domain:

**High-risk domains**: audio capture/playback, GPU/WebGPU/WebGL, ML/inference/model loading, background workers, native APIs (camera, bluetooth, filesystem), IPC, WebAssembly, real-time data streams.

**If any high-risk domain is present:**

### Category 2 — Technology Reliability Gate
Initialization success does not prove runtime correctness. These technologies can initialize cleanly and fail silently at runtime (compute shader errors, audio context state loss, worker message drops, inference failures).

For each high-risk domain:
1. A **smoke test script** must exist that exercises actual runtime behavior — not just initialization
2. The smoke test must have been run and passed
3. "It initialized without throwing" is NOT a passing smoke test
4. If no smoke test exists → create one now before proceeding with any other verification dimension
5. Smoke test failure → verification FAIL (not WARN)

### Category 7 — Manual QA as Test Gate
"The user will manually test it" is not a test artifact. Scan the milestone's domains for any feature whose acceptance criteria relies solely on manual user testing.

For each such feature:
1. A smoke test script must exist that automates as much of the verification as possible
2. Any remaining manual steps must be explicitly documented in `.gsd-t/smoke-tests/{feature}.md` with exact steps and expected outcomes
3. The documented manual steps must have been executed and passed (noted in the file)
4. If neither automated smoke test nor documented manual procedure exists → verification FAIL

> These gates exist because the pre-commit checklist "did you run the affected tests?" is meaningless when the only test is "user presses Ctrl+Space." That is not a test. It is hope.

---

## Step 3: Define Verification Dimensions

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-verify --step 3 --step-label "Define Verification Dimensions" 2>/dev/null || true
```

Standard dimensions (adjust based on project):

1. **Functional Correctness**: Does it work per requirements?
2. **Contract Compliance**: Does every domain honor its contracts?
3. **Code Quality**: Conventions, patterns, error handling, readability
4. **Test Coverage Completeness**: Every new or changed code path MUST have tests. Check:
   - Do all new functions have unit tests (happy path + edge cases + error cases)?
   - Do all new features/modes/flows have Playwright E2E specs?
   - Do all new UI components have interaction tests?
   - **Zero test coverage on new functionality = FAIL** (not WARN, not "nice to have" — FAIL)
5. **E2E Tests**: Run the FULL Playwright suite — all specs must pass. If new features lack specs, create them before proceeding.
6. **Security**: Auth flows, input validation, data exposure, dependencies
7. **Integration Integrity**: Do the seams between domains hold under stress?
8. **Design Fidelity** (only when `.gsd-t/contracts/design-contract.md` exists):
   - Open every implemented screen in a real browser (dev server + Claude Preview, Chrome MCP, or Playwright)
   - Screenshot each screen at mobile (375px), tablet (768px), and desktop (1280px) widths
   - Get the Figma reference: call Figma MCP `get_screenshot` if available, or use design images from the contract
   - Compare every screen pixel-by-pixel against the Figma design:
     Chart types, colors, typography, spacing, layout, component states, data visualization style
   - Any deviation = FAIL with specifics (e.g., "Number of Tools: build uses vertical bars, design uses horizontal stacked bars")
   - Design fidelity FAIL blocks milestone completion — it has the same weight as functional test failures
9. **Requirements Traceability Close-Out**: Mark verified requirements as complete and report orphans:
   - Read `docs/requirements.md` traceability table (added by plan phase)
   - For each REQ-ID that is fully implemented and tested: update Status to `complete` in the traceability table
   - **Orphan report**: List any REQ-IDs with no task mapping (planning gap) and any tasks with no REQ-ID (potential scope creep)
   - Orphaned requirements = WARN (not blocking unless critical)
   - Update `docs/requirements.md` with the close-out results

## Step 4: Execute Verification

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-verify --step 4 --step-label "Execute Verification" 2>/dev/null || true
```

### Solo Mode (default)
Work through each dimension sequentially. For each:
1. Define what you're checking
2. Check it systematically
3. Record findings as PASS / WARN / FAIL with specifics
4. If FAIL, create a remediation task

**Mandatory test execution:**
1. Run ALL unit/integration tests — every test must pass
2. Detect Playwright (check for `playwright.config.*`, Playwright deps in package.json)
3. Run the FULL Playwright E2E suite — every spec must pass
4. **Coverage audit**: For every new feature, mode, page, or flow added in this milestone:
   - Confirm Playwright specs exist that specifically test it
   - Confirm specs cover: happy path, error states, edge cases, all modes/flags
   - If specs are missing or incomplete → invoke `gsd-t-test-sync` to create them, then re-run
   - **Missing E2E coverage on new functionality = verification FAIL**
5. **Functional test quality audit**: Read every Playwright spec. For each `test()` block, verify assertions check **functional behavior** (state changed after action, data loaded, content updated, widget responded) — NOT just element existence (`isVisible`, `toBeAttached`, `toBeEnabled`). A test that would pass on an empty HTML page with the right element IDs is a **shallow test** and counts as a verification FAIL. Flag shallow tests and rewrite them before proceeding.
6. Tests are NOT optional — verification cannot pass without running them and confirming comprehensive, functional coverage

### Team Mode (when agent teams are enabled)
```
Create an agent team for verification:

ALL TEAMMATES read first:
1. CLAUDE.md
2. .gsd-t/contracts/ — all contracts
3. .gsd-t/domains/*/tasks.md — acceptance criteria
4. docs/requirements.md

Teammate assignments:
- Teammate "functional": 
  Verify every acceptance criterion in every domain's tasks.md.
  Test each user flow end-to-end.
  Report: list of criteria with PASS/FAIL status.

- Teammate "contracts":
  For each contract in .gsd-t/contracts/:
  Verify the implementing code matches exactly.
  Check types, shapes, error handling, edge cases.
  Report: contract-by-contract compliance status.

- Teammate "quality":
  Review all source code for:
  - Consistency with CLAUDE.md conventions
  - Error handling completeness
  - Code duplication
  - Naming consistency
  - Dead code or TODOs
  Report: file-by-file findings.

- Teammate "security":
  Review for:
  - Auth bypass possibilities
  - Input validation gaps
  - Data exposure in API responses
  - Dependency vulnerabilities (run audit if applicable)
  - Secret/credential handling
  Report: severity-ranked findings.

Lead: After receiving teammate reports:
**OBSERVABILITY LOGGING (MANDATORY) — wrap the validation spawn with `captureSpawn`:**
```
node -e "
const { captureSpawn } = require('./bin/gsd-t-token-capture.cjs');
(async () => {
  await captureSpawn({
    command: 'gsd-t-verify',
    step: 'Step 4',
    model: 'haiku',
    description: 'test audit + contract review',
    projectDir: '.',
    notes: 'test audit + contract review',
    spawnFn: async () => { /* Task subagent (spawnType: validation) runs the full test suite and contract audit — always headless */ },
  });
})();
"
```
`captureSpawn` parses `result.usage` and writes the row to `.gsd-t/token-log.md` under the canonical header. Tokens column renders as `in=N out=N cr=N cc=N $X.XX` or `—`, never `N/A`. Collect all reports, synthesize, create remediation plan.
```

## Step 5: Compile Verification Report

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-verify --step 5 --step-label "Compile Verification Report" 2>/dev/null || true
```

Create or update `.gsd-t/verify-report.md`:

```markdown
# Verification Report — {date}

## Milestone: {name}

## Summary
- Functional: {PASS/WARN/FAIL} — {X}/{Y} criteria met
- Contracts: {PASS/WARN/FAIL} — {X}/{Y} contracts compliant
- Code Quality: {PASS/WARN/FAIL} — {N} issues found
- Unit Tests: {PASS/WARN/FAIL} — {N}/{total} passing
- E2E Tests: {PASS/WARN/FAIL} — {N}/{total} specs passing
- Security: {PASS/WARN/FAIL} — {N} findings
- Integration: {PASS/WARN/FAIL}

## Overall: {PASS / CONDITIONAL PASS / FAIL}

## Findings

### Critical (must fix before milestone complete)
1. {finding} — {domain} — {remediation}

### Warnings (should fix, not blocking)
1. {finding} — {domain} — {remediation}

### Notes (informational)
1. {observation}

## Remediation Tasks
| # | Domain | Description | Priority |
|---|--------|-------------|----------|
| 1 | auth | Fix missing role in user response | CRITICAL |
| 2 | ui | Add loading states for async calls | WARN |
```

## Step 5.25: Metrics Quality Budget Check

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-verify --step 5 --step-label ".25: Metrics Quality Budget Check" 2>/dev/null || true
```

Check task-metrics for the current milestone to detect quality budget violations:

1. Run via Bash:
   `node -e "const c = require('./bin/metrics-collector.js'); const r = c.readTaskMetrics({milestone: '{milestone-id}'}); if(!r.length){console.log('No metrics data — quality budget check skipped');process.exit(0);} const pass=r.filter(t=>t.fix_cycles===0&&t.pass).length; const rate=pass/r.length; console.log('First-pass rate: '+(rate*100).toFixed(1)+'% ('+pass+'/'+r.length+')'); if(rate<0.6) console.log('⚠️ Quality budget WARNING: first-pass rate below 60%');" 2>/dev/null || true`

2. Run heuristics check via Bash:
   `node -e "const m=require('./bin/metrics-rollup.js'); const r=m.readRollups({milestone:'{milestone-id}'}); if(r.length&&r[r.length-1].heuristic_flags.some(f=>f.severity==='HIGH')) console.log('⚠️ HIGH severity heuristic flag detected — review before completing milestone');" 2>/dev/null || true`

3. Display quality metrics summary inline. Quality budget violation is a **WARNING** (non-blocking) — does not fail verify.

4. Include quality budget status in the verification report (Step 5):
   `- Quality Budget: {PASS/WARN} — first-pass rate {N}%{, HIGH heuristic: {name} if any}`

## Step 5.5: Goal-Backward Verification (Post-Gate Behavior Check)

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-verify --step 5 --step-label ".5: Goal-Backward Verification (Post-Gate Behavior Check)" 2>/dev/null || true
```

This step runs **after all 8 quality gates pass**. It verifies that milestone goals are actually achieved end-to-end — not just structurally present. It catches placeholder implementations that pass all structural gates.

Refer to `.gsd-t/contracts/goal-backward-contract.md` for the full verification flow, placeholder patterns, and findings report format.

### 5.5.1 Load Milestone Goals and Requirements

1. Read `.gsd-t/progress.md` — extract the current milestone name and goals
2. Read `docs/requirements.md` — identify **critical requirements** (skip trivial/low-priority items)

### 5.5.2 Trace Requirements to Behavior

For each critical requirement:

1. **If `.gsd-t/graph/meta.json` exists (graph available)**:
   - Trace the requirement → code path → behavior chain using graph queries
   - Use `getRequirementFor`, `getCallers`, and `getTestsFor` to build the chain
   - Flag requirements with no traceable code path as CRITICAL findings

2. **If graph is not available (fallback to grep)**:
   - Search the codebase for the feature/function implementing each requirement
   - Trace from entry point → core logic → output/response

### 5.5.3 Scan for Placeholder Patterns

For each file identified in the requirement traces above, scan for these placeholder patterns:

| Pattern | Detection Hint | Severity |
|---------|---------------|----------|
| console.log placeholder | `console.log.*TODO\|console.log.*implement` | CRITICAL |
| TODO/FIXME in implementation | `// TODO\|// FIXME\|# TODO\|# FIXME` in non-test files | CRITICAL |
| Empty function body | `function \w+\(\) \{\}` or `\(\) => \{\}` with no logic | CRITICAL |
| Throw not-implemented | `throw new Error.*not implemented\|throw new Error.*TODO` | CRITICAL |
| Hardcoded return | `return "success"\|return true` with no conditional logic | HIGH |
| Static UI text | Static `<span>` or text that never updates based on state | HIGH |
| Pass-through stub | `return input\|return req\|return data` with no transformation | MEDIUM |

### 5.5.4 Produce Findings Report

Format findings per the goal-backward-contract.md report format:

```markdown
## Goal-Backward Verification Report

### Status: PASS | FAIL

### Findings
| # | Requirement | File:Line | Pattern | Severity | Description |
|---|-------------|-----------|---------|----------|-------------|
| 1 | {req-id}    | {path}:{line} | {pattern} | {severity} | {what's wrong} |

### Summary
- Requirements checked: {N}
- Findings: {N} ({critical}, {high}, {medium})
- Verdict: {PASS if 0 critical/high, FAIL otherwise}
```

### 5.5.5 Apply Blocking Rules

- **CRITICAL or HIGH findings** → Goal-Backward status = **FAIL** — block verification
  - Append findings to the Critical section of the verification report (Step 5)
  - Set overall verification status to FAIL
- **MEDIUM findings** → Goal-Backward status = **WARN** — log but do not block
  - Append findings to the Warnings section of the verification report (Step 5)
- **No findings** → Goal-Backward status = **PASS** — add to verification report summary

Add a `Goal-Backward:` line to the Step 5 verification report summary:
```
- Goal-Backward: {PASS/WARN/FAIL} — {N} requirements checked, {N} findings ({critical} critical, {high} high, {medium} medium)
```

---

## Step 6: Handle Remediation

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-verify --step 6 --step-label "Handle Remediation" 2>/dev/null || true
```

If there are CRITICAL findings:
1. Create remediation tasks in the affected domain's `tasks.md`
2. Execute fixes (solo — don't spawn teams for remediation)
3. Re-verify the specific findings
4. Update the verification report

## Step 7: Update State

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-verify --step 7 --step-label "Update State" 2>/dev/null || true
```

Update `.gsd-t/progress.md`:
- If all PASS: Set status to `VERIFIED`
- If CONDITIONAL PASS: Set status to `VERIFIED-WITH-WARNINGS`, list warnings
- If FAIL: Set status to `VERIFY-FAILED`, list required remediations
- Record verification date and summary

### Autonomy Behavior

**All Levels**:
- VERIFIED or CONDITIONAL PASS → **Auto-invoke complete-milestone** (see Step 8 below). Completing a verified milestone is mechanical — there is no judgment call that benefits from user review.
- FAIL → **Level 3**: Auto-execute remediation tasks (up to 2 fix attempts). If still failing after 2 attempts:
  1. Write failure context to `.gsd-t/debug-state.jsonl` via `node -e "require('./bin/debug-ledger.js').appendEntry('.', {iteration:1,timestamp:new Date().toISOString(),test:'verify-remediation',error:'2 in-context fix attempts exhausted',hypothesis:'see verify-report.md',fix:'n/a',fixFiles:[],result:'STILL_FAILS',learning:'delegating to headless debug-loop',model:'sonnet',duration:0})"`
  2. Log: "Delegating to headless debug-loop (2 in-context attempts exhausted)"
  3. Run: `gsd-t headless --debug-loop --max-iterations 10`
  4. Exit code 0 → re-run verification; 1/4 → log to `.gsd-t/deferred-items.md`, STOP and report to user; 3 → report error
  **Level 1–2**: Return to execute phase for remediation tasks.

## Document Ripple

### Always update:
1. **`.gsd-t/progress.md`** — Set status to VERIFIED/VERIFY-FAILED, log verification summary
2. **`.gsd-t/verify-report.md`** — Created with full verification results (Step 4)

### Check if affected:
3. **`.gsd-t/domains/{domain}/tasks.md`** — If remediation tasks were created (Step 5)
4. **`.gsd-t/techdebt.md`** — If verification found new quality or security issues, add as debt
5. **`docs/requirements.md`** — If verification revealed unmet requirements, update status

## Step 8: Auto-Invoke Complete-Milestone

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-verify --step 8 --step-label "Auto-Invoke Complete-Milestone" 2>/dev/null || true
```

**This step is MANDATORY and runs at ALL autonomy levels.** Completing a verified milestone is a mechanical operation (archive, tag, bump version, update docs). There is no decision that benefits from user review — the decision was made when verification passed.

If status is VERIFY-FAILED:
- Do NOT invoke complete-milestone
- Report failures and stop

If status is VERIFIED or VERIFIED-WITH-WARNINGS:
1. Log: "✅ Verify complete — spawning complete-milestone agent..."

**OBSERVABILITY LOGGING (MANDATORY) — wrap the complete-milestone auto-invoke with `captureSpawn`:**

2. Spawn through `captureSpawn` — `spawnType: 'validation'`, model: sonnet, mode: bypassPermissions (always headless per headless-default-contract v2.0.0):

```
node -e "
const { captureSpawn } = require('./bin/gsd-t-token-capture.cjs');
(async () => {
  await captureSpawn({
    command: 'gsd-t-verify',
    step: 'Step 8',
    model: 'sonnet',
    description: 'auto-complete-milestone',
    projectDir: '.',
    notes: 'auto-complete-milestone',
    spawnFn: async () => { /* Task subagent (spawnType: validation, model: sonnet, mode: bypassPermissions):
      'Execute the complete-milestone phase of the current GSD-T milestone.
       Read and follow the full instructions in commands/gsd-t-complete-milestone.md
       (resolve from ~/.claude/commands/ if not in project).
       Read .gsd-t/progress.md for current milestone and state.
       Read CLAUDE.md for project conventions.
       Read .gsd-t/contracts/ for domain interfaces.
       Complete the phase fully:
       - Follow every step in the command file
       - Update .gsd-t/progress.md status when done
       - Run document ripple as specified
       - Commit your work
       Report back: one-line status summary.' */ },
  });
})();
"
```

`captureSpawn` parses `result.usage` and writes the row to `.gsd-t/token-log.md` under the canonical header. Tokens column renders as `in=N out=N cr=N cc=N $X.XX` or `—`, never `N/A`.

3. Verify subagent result: Read `.gsd-t/progress.md` — confirm status is COMPLETED. If not, report the failure.

**Why this is mandatory**: Without auto-completion, verified milestones remain in VERIFIED state indefinitely. Requirements stay unmarked, progress.md is stale, and future sessions cannot tell the work was done. This is the root cause of "GSD-T forgot it did this work" — the milestone was built and verified but never formally completed.

**Why a subagent**: Complete-milestone is a 12-step process (gap analysis, archive, version bump, git tag, doc ripple). Verify is already heavy with 8+ quality gates. Spawning a fresh-context subagent avoids compaction risk — and complete-milestone loads everything it needs from files (progress.md, verify-report.md, contracts).

$ARGUMENTS

## Auto-Clear

All work is committed to project files. Execute `/clear` to free the context window for the next command.
