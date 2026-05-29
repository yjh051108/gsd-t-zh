# GSD-T: Integrate — Wire Domains Together

You are the lead agent performing integration work. This phase is ALWAYS single-session — one agent with full context across all domains to handle the seams.

## Argument Parsing

Parse `$ARGUMENTS`. M43 D4 removed the `--watch` opt-out; `--in-session`/`--headless` were never shipped. Under `.gsd-t/contracts/headless-default-contract.md` **v2.0.0** every spawn below goes headless unconditionally — QA (Step 5), Red Team (Step 7.5), doc-ripple (Step 9). Integrate's own lead-agent body remains the interactive entry point for this command (it is itself the spawn target when invoked from `/gsd` or `gsd-t-wave`). A legacy `--watch` token is accepted but ignored (stderr deprecation line).

## Spawn Primitive — Always Headless (M43 D4, v2.0.0)

Per `.gsd-t/contracts/headless-default-contract.md` v2.0.0. Spawn classifications used below:

- `spawnType: 'validation'` — QA subagent (Step 5 contract compliance), Red Team (Step 7.5 adversarial), doc-ripple (Step 9)

Spawn path is `autoSpawnHeadless({command, spawnType: 'validation', projectDir, sessionContext})`. Read-back banner surfaces each completion.

## Model Assignment

Per `.gsd-t/contracts/model-selection-contract.md` v1.0.0.

- **Default**: `sonnet` (`selectModel({phase: "integrate"})`) — integration wiring is routine coordination.
- **Mechanical subroutines** (demote to `haiku`): integration test runners.
- **Red Team**: `opus` — adversarial QA at integration seams always runs at top tier.
- **Escalation**: `/advisor` convention-based fallback from `bin/advisor-integration.js` when a seam reveals a contract gap or security boundary. Never silently downgrade the model or skip Red Team / doc-ripple under context pressure — M35 removed that behavior.

## Step 1: Load Full State

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-integrate --step 1 --step-label "Load Full State" 2>/dev/null || true
```

Read everything:
1. `CLAUDE.md`
2. `.gsd-t/progress.md`
3. `.gsd-t/contracts/` — all contracts (this is your source of truth)
4. `.gsd-t/contracts/integration-points.md` — all connection points
5. `.gsd-t/domains/*/scope.md` — understand boundaries
6. All source code produced during execution

## Step 1.5: Graph-Enhanced Integration Validation

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-integrate --step 1 --step-label ".5: Graph-Enhanced Integration Validation" 2>/dev/null || true
```

If `.gsd-t/graph/meta.json` exists (graph index is available):
1. Query `getDomainBoundaryViolations` to validate that cross-domain wiring matches contracts — flag any code that crosses boundaries without a contract
2. Query `getCallers` and `getCallees` across domain boundaries to verify all integration points are accounted for in `integration-points.md`
3. Add any unregistered cross-domain calls to the audit findings in Step 2

If graph is not available, skip this step.

## Step 2: Contract Compliance Audit

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-integrate --step 2 --step-label "Contract Compliance Audit" 2>/dev/null || true
```

Before wiring anything together, verify each domain honored its contracts:

For each contract file:
1. Read the contract specification
2. Find the implementing code
3. Verify exact compliance:
   - Types/shapes match?
   - Endpoint signatures match?
   - Error responses match?
   - Schema matches?
4. Log findings:

```markdown
## Contract Audit — {date}

### api-contract.md
- POST /api/auth/login: ✅ matches
- GET /api/users/:id: ⚠️ response missing `role` field
  - Fix: Update auth/userController.js to include role

### schema-contract.md  
- Users table: ✅ matches
- Sessions table: ✅ matches
```

Fix any mismatches BEFORE proceeding to integration.

## Step 2.5: Worktree Merge Status Check

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-integrate --step 2 --step-label ".5: Worktree Merge Status Check" 2>/dev/null || true
```

Before wiring integration points, check whether team mode execution left any domains with rolled-back worktree merges:

1. Read `.gsd-t/progress.md` — look for `[rollback]` entries in the Decision Log from the execute phase
2. If any domains were rolled back: list them and their failure reasons before proceeding
3. Integration point wiring should only proceed for domains whose worktree merges PASSED — rolled-back domains are not yet in the main working tree

If rolled-back domains exist, report them to the user (or if Level 3: log to `.gsd-t/deferred-items.md` as `[integration-gap] {domain}: not yet merged — worktree rollback during execute`). Do NOT attempt to re-merge rolled-back domains here; that requires re-running execute for the affected domain.

## Step 3: Wire Integration Points

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-integrate --step 3 --step-label "Wire Integration Points" 2>/dev/null || true
```

### Parallel Dispatch (MANDATORY — single instrument)

Delegate to `gsd-t parallel --command` — do NOT re-implement probe-and-branch logic here (M44 D9 Step 3: "create 1 instrument that accomplishes this instead of implementing it in all the commands").

```bash
node bin/gsd-t.js parallel --milestone {milestone} --command gsd-t-integrate && exit 0 || true
# Exit 0  → multi-domain integration; N detached children handle disjoint subsets.
# Exit 2+ → single-domain wiring. Fall through to sequential dispatch below.
```

`runDispatch` owns the D4/D5/D6 gates + disjoint task-id partitioning + `autoSpawnHeadless()` fan-out. Mode auto-detects from `GSD_T_UNATTENDED=1`. No user prompt. Parallel-when-safe + headless-when-possible are both the default.

Contract: `.gsd-t/contracts/wave-join-contract.md` v1.1.0; `.gsd-t/contracts/headless-default-contract.md` v2.0.0.

**Stack Rules Detection (before spawning subagent):**
Run via Bash to detect project stack and collect matching rules:
`GSD_T_DIR=$(npm root -g 2>/dev/null)/@tekyzinc/gsd-t; STACKS_DIR="$GSD_T_DIR/templates/stacks"; STACK_RULES=""; if [ -d "$STACKS_DIR" ]; then for f in "$STACKS_DIR"/_*.md; do [ -f "$f" ] && STACK_RULES="${STACK_RULES}$(cat "$f")"$'\n\n'; done; if [ -f "package.json" ]; then grep -q '"react"' package.json 2>/dev/null && [ -f "$STACKS_DIR/react.md" ] && STACK_RULES="${STACK_RULES}$(cat "$STACKS_DIR/react.md")"$'\n\n'; (grep -q '"typescript"' package.json 2>/dev/null || [ -f "tsconfig.json" ]) && [ -f "$STACKS_DIR/typescript.md" ] && STACK_RULES="${STACK_RULES}$(cat "$STACKS_DIR/typescript.md")"$'\n\n'; grep -qE '"(express|fastify|hono|koa)"' package.json 2>/dev/null && [ -f "$STACKS_DIR/node-api.md" ] && STACK_RULES="${STACK_RULES}$(cat "$STACKS_DIR/node-api.md")"$'\n\n'; fi; [ -f "requirements.txt" ] || [ -f "pyproject.toml" ] && [ -f "$STACKS_DIR/python.md" ] && STACK_RULES="${STACK_RULES}$(cat "$STACKS_DIR/python.md")"$'\n\n'; [ -f "go.mod" ] && [ -f "$STACKS_DIR/go.md" ] && STACK_RULES="${STACK_RULES}$(cat "$STACKS_DIR/go.md")"$'\n\n'; [ -f "Cargo.toml" ] && [ -f "$STACKS_DIR/rust.md" ] && STACK_RULES="${STACK_RULES}$(cat "$STACKS_DIR/rust.md")"$'\n\n'; ([ -f ".gsd-t/contracts/design-contract.md" ] || [ -f "design-tokens.json" ] || [ -d "design-tokens" ] || [ -f ".figmarc" ] || [ -f "figma.config.json" ] || grep -q '"figma"' ~/.claude/settings.json 2>/dev/null) && [ -f "$STACKS_DIR/design-to-code.md" ] && STACK_RULES="${STACK_RULES}$(cat "$STACKS_DIR/design-to-code.md")"$'\n\n'; fi`

If STACK_RULES is non-empty, append to the subagent prompt:
```
## Stack Rules (MANDATORY — violations fail this task)

{STACK_RULES}

These standards have the same enforcement weight as contract compliance.
Violations are task failures, not warnings.
```

If STACK_RULES is empty (no templates/stacks/ dir or no matches), skip silently.

Work through each integration point in `integration-points.md`. If integration work spans multiple domains with independent tasks, use the **task-level dispatch pattern** (per fresh-dispatch-contract.md): spawn one Task subagent per integration task, passing only the relevant contracts, the specific integration point to wire, and summaries from prior integration tasks (max 5, 10-20 lines each). This prevents context accumulation across integration tasks.

**Multi-domain integration merging**: If integration work itself requires merging domain outputs that weren't merged during execute (e.g., domains executed in separate waves and integration needs to combine them), use the Sequential Merge Protocol from `.gsd-t/contracts/worktree-isolation-contract.md`:
1. Sort domains by dependency order (from integration-points.md)
2. Merge domain A's branch → run tests → merge domain B's branch → run tests
3. If tests fail after a merge, roll back that domain's merge and log the failure
4. Contract validation runs between merges
5. All temporary branches cleaned up after integration completes

For each connection:
1. Identify the producing domain (provides the interface)
2. Identify the consuming domain (calls the interface)
3. Write or verify the glue code:
   - Import statements
   - Configuration (env vars, connection strings)
   - Middleware chains
   - Route registration
   - Dependency injection
4. Ensure error handling flows across the boundary correctly

### Common integration tasks:
- **API → UI**: Verify fetch calls match endpoint signatures
- **Auth → Routes**: Wire middleware into route definitions
- **Data layer → Services**: Connect repositories/models to service layer
- **Config**: Ensure shared config (env vars, constants) is consistent

## Step 4: End-to-End Smoke Test

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-integrate --step 4 --step-label "End-to-End Smoke Test" 2>/dev/null || true
```

Run through the primary user flows:
1. Identify the 3-5 most critical paths from requirements
2. Trace each path through all domain boundaries
3. Run or manually verify each path works
4. Document results:

```markdown
## Smoke Test Results

### Flow: User Login
1. UI → POST /api/auth/login ✅
2. Auth → Users table lookup ✅
3. Auth → JWT generation ✅
4. Auth → Response to UI ✅
5. UI → Store token, redirect ✅
Result: PASS

### Flow: Protected Resource Access
1. UI → GET /api/data with token ✅
2. Auth middleware → verify token ✅
3. Data layer → query ⚠️ — missing pagination
Result: PARTIAL — needs pagination contract addition
```

## Step 5: Contract Compliance Testing

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-integrate --step 5 --step-label "Contract Compliance Testing" 2>/dev/null || true
```

Spawn a QA subagent via the Task tool to verify contract compliance at all domain boundaries — `spawnType: 'validation'` (always headless per headless-default-contract v2.0.0):

```
Task subagent (spawnType: validation, general-purpose, model: sonnet):
"Run contract compliance tests for this integration. Read .gsd-t/contracts/ for all contract definitions.
Test every domain boundary: verify that producers and consumers match their contract shapes.
Run ALL configured test suites — detect and run every one:
a. Unit tests (vitest/jest/mocha): run the full suite
b. E2E tests: check for playwright.config.* or cypress.config.* — if found, run the FULL E2E suite
c. NEVER skip E2E when a config file exists. Running only unit tests is a QA FAILURE.
d. AUDIT E2E test quality: Review each Playwright spec — if any test only checks element existence
   (isVisible, toBeAttached, toBeEnabled) without verifying functional behavior (state changes,
   data loaded, content updated after actions), flag it as 'SHALLOW TEST — needs functional assertions'.
Report: 'Unit: X/Y pass | E2E: X/Y pass (or N/A if no config) | Boundary: pass/fail by contract | Shallow tests: N'

## Exploratory Testing (if Playwright MCP available)

After all scripted tests pass:
1. Check if Playwright MCP is registered in Claude Code settings (look for "playwright" in mcpServers)
2. If available: spend 3 minutes on interactive exploration using Playwright MCP
   - Try variations of happy paths with unexpected inputs
   - Probe for race conditions, double-submits, empty states
   - Test accessibility (keyboard navigation, screen reader flow)
3. Tag all findings [EXPLORATORY] in your report and append to .gsd-t/qa-issues.md with [EXPLORATORY] prefix
4. If Playwright MCP is not available: skip this section silently
Note: Exploratory findings do NOT count against the scripted test pass/fail ratio."
```

**OBSERVABILITY LOGGING (MANDATORY) — wrap the Step 5 validation spawn with `captureSpawn`:**

```
node -e "
const { captureSpawn } = require('./bin/gsd-t-token-capture.cjs');
(async () => {
  await captureSpawn({
    command: 'gsd-t-integrate',
    step: 'Step 5',
    model: 'haiku',
    description: 'cross-boundary integration QA',
    projectDir: '.',
    notes: '{pass/fail}, {N} boundaries tested',
    spawnFn: async () => { /* Task validation subagent call */ },
  });
})();
"
```

`captureSpawn` writes the row to `.gsd-t/token-log.md` under the canonical header. Tokens column renders as `in=N out=N cr=N cc=N $X.XX` or `—`, never `N/A`.
If QA found issues, append each to `.gsd-t/qa-issues.md` (create with header `| Date | Command | Step | Model | Duration(s) | Severity | Finding |` if missing):
`| {DT_START} | gsd-t-integrate | Step 5 | haiku | {DURATION}s | {severity} | {finding} |`

QA failure blocks integration completion.

## Step 6: Document Ripple

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-integrate --step 6 --step-label "Document Ripple" 2>/dev/null || true
```

Integration is where the real system takes shape. Verify documentation matches reality:

### Always update:
1. **`.gsd-t/progress.md`** — Log integration results, contract audit findings, smoke test outcomes

### Check if affected:
2. **`docs/architecture.md`** — Now that domains are wired together, does the documented architecture match the actual data flow, component relationships, and integration patterns? Update it
3. **`docs/requirements.md`** — Did integration reveal missing requirements or invalidate existing ones? Update it
4. **`docs/schema.md`** — Does the documented schema match the actual database state? Update it
5. **`CLAUDE.md`** — Did integration establish new conventions (error handling patterns, middleware chains, configuration approaches) that future work should follow? Add them
6. **`.gsd-t/techdebt.md`** — Did integration reveal new debt (workarounds, temporary glue code, known shortcuts)? Add TD items

### Skip what's not affected.

## Step 7: Test Verification

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-integrate --step 7 --step-label "Test Verification" 2>/dev/null || true
```

After integration and doc ripple, verify everything works together:

1. **Update tests**: Add or update integration tests for newly wired domain boundaries
2. **Run ALL configured test suites** — detect and run every one:
   a. Unit/integration tests (vitest/jest/mocha)
   b. If `playwright.config.*` exists → run `npx playwright test` (full suite, not just affected specs)
   c. Unit tests alone are NEVER sufficient when E2E exists
   d. Report: "Unit: X/Y pass | E2E: X/Y pass"
3. **Verify passing**: All tests must pass. If any fail, fix before proceeding (up to 2 attempts)
4. **Functional test quality**: Spot-check E2E specs — every assertion must verify functional behavior (state changed, data loaded, content updated after action), not just element existence. Shallow tests that would pass on an empty HTML page are not acceptable.
5. **Smoke test results**: Ensure the Step 4 smoke test results are still valid after any fixes

## Step 7.5: Red Team — Adversarial QA (MANDATORY)

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-integrate --step 7 --step-label ".5: Red Team — Adversarial QA (MANDATORY)" 2>/dev/null || true
```

After integration tests pass, spawn an adversarial Red Team agent on the integrated system. Success is measured by bugs found, not tests passed.

⚙ [opus] Red Team → adversarial validation of integrated system

Resolve the templated prompt path via Bash:
```bash
RT_PROMPT="$(npm root -g 2>/dev/null)/@tekyzinc/gsd-t/templates/prompts/red-team-subagent.md"
[ -f "$RT_PROMPT" ] || RT_PROMPT="templates/prompts/red-team-subagent.md"
```

Then spawn through `captureSpawn` — `spawnType: 'validation'` (always headless per headless-default-contract v2.0.0):

```
node -e "
const { captureSpawn } = require('./bin/gsd-t-token-capture.cjs');
(async () => {
  await captureSpawn({
    command: 'gsd-t-integrate',
    step: 'Red Team',
    model: 'opus',
    description: 'cross-domain adversarial validation',
    projectDir: '.',
    notes: '{VERDICT} — {N} bugs found',
    spawnFn: async () => { /* Task subagent (spawnType: validation, general-purpose, model: opus):
      'Read \$RT_PROMPT and follow it. Context: cross-domain integration run.
      Additional category for this run: Cross-Domain Boundaries — test data flow across every
      domain boundary; does data arriving from domain A get validated by domain B; what happens
      when A sends malformed data that passed A own validation.
      Write findings to .gsd-t/red-team-report.md.' */ },
  });
})();
"
```

`captureSpawn` writes the row to `.gsd-t/token-log.md` under the canonical header. Tokens column renders as `in=N out=N cr=N cc=N $X.XX` or `—`, never `N/A`.

**If FAIL:** fix CRITICAL/HIGH bugs (≤2 cycles) → re-run. Persistent bugs → `.gsd-t/deferred-items.md`.
**If GRUDGING-PASS:** proceed to doc-ripple.

## Step 8: Doc-Ripple (Automated)

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-integrate --step 8 --step-label "Doc-Ripple (Automated)" 2>/dev/null || true
```

After all integration work is committed but before reporting completion:

1. Run threshold check — read `git diff --name-only HEAD~1` and evaluate against doc-ripple-contract.md trigger conditions
2. If SKIP: log "Doc-ripple: SKIP — {reason}" and proceed to completion
3. If FIRE: spawn doc-ripple agent — `spawnType: 'validation'` (always headless per headless-default-contract v2.0.0):

⚙ [{model}] gsd-t-doc-ripple → blast radius analysis + parallel updates

Task subagent (spawnType: validation, general-purpose, model: sonnet):
"Execute the doc-ripple workflow per commands/gsd-t-doc-ripple.md.
Git diff context: {files changed list}
Command that triggered: integrate
Produce manifest at .gsd-t/doc-ripple-manifest.md.
Update all affected documents.
Report: 'Doc-ripple: {N} checked, {N} updated, {N} skipped'"

4. After doc-ripple returns, verify manifest exists and report summary inline

## Step 9: Handle Integration Issues

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-integrate --step 9 --step-label "Handle Integration Issues" 2>/dev/null || true
```

For each issue found:
1. Determine if it's a contract gap (missing specification) or implementation bug
2. **Contract gap**: Update the contract, create a follow-up task
3. **Implementation bug**: Fix it directly, document the fix
4. Log everything in progress.md

## Step 10: Update State

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-integrate --step 10 --step-label "Update State" 2>/dev/null || true
```

Update `.gsd-t/progress.md`:
- Set status to `INTEGRATED`
- Add contract audit results
- Add smoke test results
- List any new tasks created for gaps

Commit: `[integration] Wire domains together — all contracts verified`

### Autonomy Behavior

**Level 3 (Full Auto)**: Log a brief status line (e.g., "✅ Integrate complete — all domain boundaries wired, {N} contracts verified") and auto-advance to the next phase. Do NOT wait for user input.

**Level 1–2**: Report integration results and recommend proceeding to verify phase. Wait for confirmation.

$ARGUMENTS

## Auto-Clear

All work is committed to project files. Execute `/clear` to free the context window for the next command.
