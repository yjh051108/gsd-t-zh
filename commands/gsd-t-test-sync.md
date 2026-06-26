# GSD-T: Test Sync — Keep Tests Aligned with Code

You are maintaining test coverage as code changes. Your job is to identify stale tests, coverage gaps, and dead tests, then generate tasks to address them.

## Model Assignment

Per `.gsd-t/contracts/model-selection-contract.md` v1.0.0.

- **Default**: `sonnet` (`selectModel({phase: "test-sync"})`) — test alignment is routine refactoring work.
- **Escalation**: `/advisor` convention-based fallback from `bin/advisor-integration.js` when a test touches a contract boundary or requires judgment about what "missing coverage" means. Never silently skip test-sync under context pressure — M35 removed that behavior.

This command is:
- **Auto-invoked** during execute phase (after each task) and verify phase
- **Standalone** when user wants to audit test health

## Step 1: Load Context

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-test-sync --step 1 --step-label "Load Context" 2>/dev/null || true
```

Read:
1. `CLAUDE.md` — testing conventions, test locations
2. `.gsd-t/progress.md` — what just changed
3. `.gsd-t/test-coverage.md` — previous coverage state (if exists)
4. `.gsd-t/domains/{current}/tasks.md` — recent completed tasks

Identify:
- **Unit/integration test framework** (pytest, jest, vitest, etc.)
- **E2E test framework** (Playwright, Cypress, Puppeteer, etc.) — check for `playwright.config.*`, `cypress.config.*`, `playwright/`, `cypress/`, `e2e/`, or E2E-related dependencies in package.json/requirements.txt
- Test directory structure
- Naming conventions
- Test run commands (from package.json scripts, Makefile, or CI config)

## Graph-Enhanced Test Alignment — WRITER Pattern (M94-D11)

Test-sync applies the **WRITER pattern** from `graph-consumer-wiring-contract.md`:

**READER half (test-impl verb):** Use `gsd-t graph test-impl` to identify which impl functions a test exercises (from call-site edges) and `gsd-t graph test-impl --inverse` (untested-impl mode) to find impl functions with no test-file caller. This replaces grep/filesystem discovery (`find tests/ -name "*{module_name}*"`) for the structural test↔impl mapping question. The test-impl slice is injected into the test-sync agent's context for alignment decisions. `[RULE] test-sync-uses-test-impl-verb`.

**WRITER half:** After writing or updating tests, trigger a re-index of the edited test files (`freshness_check_on_query` from `graph-freshness-contract.md` D4 surface) so the next `test-impl` query sees the updated call-site edges from the new test code. `[RULE] test-sync-uses-test-impl-verb`.

**FAIL-LOUD on graph-unavailable:** On `{ok:false, reason:"graph-unavailable"}`, the test-impl query surfaces `"graph unavailable — fix it (gsd-t graph status)"` and the agent proceeds with filesystem discovery as announced fallback — it does NOT silently treat a missing graph as "no coverage". `[RULE] consumer-structural-grep-removed`.

## Step 1.5: Graph-Enhanced Test Discovery

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-test-sync --step 1 --step-label ".5: Graph-Enhanced Test Discovery" 2>/dev/null || true
```

If `.gsd-t/graph/meta.json` exists (graph index is available):
1. Query `getTestsFor` each changed entity to find stale or missing tests more precisely than filesystem search
2. Query `getTransitiveCallers` for changed functions to find indirectly affected tests that may need updating
3. Feed these findings into the coverage map (Step 3) and issue detection (Step 4)

If graph is not available, skip this step.

## Step 2: Contract Coverage Audit

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-test-sync --step 2 --step-label "Contract Coverage Audit" 2>/dev/null || true
```

Perform inline contract testing and gap analysis:

1. Read all contracts in `.gsd-t/contracts/` — identify the interface each one defines
2. For each contract, check whether a test file exists that validates it
3. Run the full test suite: `npm test` (or project equivalent)
4. Identify gaps: contracts with no tests, stale tests referencing removed APIs, uncovered code paths
5. Report: coverage gaps, stale tests, and recommended test tasks

Test-sync cannot complete if critical contract gaps remain unaddressed.

## Step 3: Map Code to Tests

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-test-sync --step 3 --step-label "Map Code to Tests" 2>/dev/null || true
```

For each file changed in recent tasks:

### A) Find Existing Tests
```bash
# Common patterns
find tests/ -name "*{module_name}*"
find __tests__/ -name "*{module_name}*"
find . -name "*.test.*" | xargs grep -l "{function_name}"
find . -name "*.spec.*" | xargs grep -l "{class_name}"
```

### B) Build Coverage Map
```
| Source File | Test File(s) | Coverage Status |
|-------------|--------------|-----------------|
| src/auth/login.py | tests/test_login.py | COVERED |
| src/auth/roles.py | (none) | GAP |
| src/api/users.py | tests/test_users.py | PARTIAL |
```

## Step 4: Detect Test Issues

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-test-sync --step 4 --step-label "Detect Test Issues" 2>/dev/null || true
```

### A) Stale Tests
Tests that reference old behavior:
- Function signatures that changed
- Removed functions still being tested
- Old API shapes in assertions
- Mocked data that no longer matches schema

Check:
```bash
# Find tests importing changed modules
grep -r "from {changed_module}" tests/
# Check if test assertions match new behavior
```

### B) Coverage Gaps
New or changed code without tests:
- New functions with no test
- New branches with no coverage
- Changed behavior with no updated assertions
- New error cases with no error tests

### C) Dead Tests
Tests for deleted functionality:
- Tests importing deleted modules
- Tests for removed features
- Skipped tests that should be removed

### D) Flaky Tests (if test history available)
Tests that sometimes fail:
- Check recent CI runs
- Note any intermittent failures

## Step 5: Run Affected Tests

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-test-sync --step 5 --step-label "Run Affected Tests" 2>/dev/null || true
```

### A) Unit/Integration Tests
Execute tests that cover changed code:

```bash
# Example for pytest
pytest tests/test_{module}.py -v

# Example for jest
npm test -- --testPathPattern="{module}"
```

### B) E2E Tests (MANDATORY when config exists)
If `playwright.config.*` or `cypress.config.*` exists, you MUST run E2E tests — skipping is never acceptable:

```bash
# Playwright
npx playwright test {affected-spec}.spec.ts

# Cypress
npx cypress run --spec "cypress/e2e/{affected-spec}.cy.ts"
```

Determine which E2E specs are affected:
- Changed a UI component or page? → Run specs that test that page/flow
- Changed an API endpoint? → Run specs that exercise that endpoint
- Changed auth/session logic? → Run all auth-related E2E specs
- Changed database schema? → Run specs that depend on that data
- Not sure what's affected? → Run the full E2E suite

### C) Create and Update Playwright E2E Tests (MANDATORY when UI/routes/flows/modes changed)

If Playwright is configured (`playwright.config.*` or Playwright in dependencies):

**For new features, pages, modes, or flows — CREATE comprehensive specs:**
- Happy path for every new user flow
- All feature modes/flags (e.g., `--component` mode gets its own test suite, not just default mode)
- Form validation: valid input, invalid input, empty fields, boundary values
- Error states: network failures, API errors, permission denied, timeout
- Empty states: no data, first-time user, cleared data
- Loading states: skeleton screens, spinners, progressive loading
- Edge cases: rapid clicking, double submission, back/forward navigation, browser refresh mid-flow
- Responsive: test at mobile and desktop breakpoints if layout changes

**For changed features — UPDATE existing specs AND add missing coverage:**
- Changed UI elements (selectors, text, layout) → update locators and assertions
- Changed form fields or validation → update form fill steps and error assertions
- Removed features → remove or update affected E2E specs
- Review existing specs for missing edge cases and add them

**This is NOT optional.** Every new code path that a user can reach must have a Playwright spec. "We'll add tests later" is never acceptable.

**FUNCTIONAL TESTS — NOT LAYOUT TESTS (MANDATORY):**
E2E specs that only check element existence (`isVisible`, `toBeAttached`, `toBeEnabled`) are
layout tests. Layout tests pass even when every feature is broken — they are worthless for QA.

Every Playwright assertion MUST verify **functional behavior** — that an action produced the
correct outcome:
- **Tab/navigation**: Click → assert the NEW content loaded (unique text, data, or elements
  that only appear on the destination view). Never just assert the tab element exists.
- **Forms**: Fill → submit → assert success feedback AND data persisted (API call observed
  via `page.waitForResponse`, or list/table updated with new entry).
- **Interactive widgets** (terminals, editors, code panels): Open → interact → assert the
  widget responded (keystroke produced output, content was saved, command executed).
- **Connections** (WebSocket, SSE, polling): Assert status transitions ("Connecting" →
  "Connected") and verify data flows through the connection.
- **State toggles** (dark mode, expand/collapse, enable/disable): Assert the EFFECT of the
  toggle, not just that the toggle control exists.
- **Error handling**: Trigger error → assert error content → assert recovery path works.

**Rule: If a test would pass on an empty HTML page with the correct element IDs and no
JavaScript, it is not a functional test. Rewrite it.**

### D) Capture Results
For all test types:
- PASS: Test still valid
- FAIL: Test needs update or code has bug
- ERROR: Test broken (import error, etc.)

## Step 6: Produce Test Coverage Report

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-test-sync --step 6 --step-label "Produce Test Coverage Report" 2>/dev/null || true
```

Create/update `.gsd-t/test-coverage.md`:

```markdown
# Test Coverage Report — {date}

## Summary
- Source files analyzed: {N}
- Unit/integration test files: {N}
- E2E test specs: {N}
- Coverage gaps: {N}
- Stale tests: {N}
- Dead tests: {N}
- Unit tests passing: {N}/{total}
- E2E tests passing: {N}/{total}

## Coverage Status

### ✅ Well Covered
| Source | Test | Last Verified |
|--------|------|---------------|
| {file} | {test} | {date} |

### ⚠️ Partial Coverage
| Source | Test | Gap |
|--------|------|-----|
| {file} | {test} | {missing: error cases, edge cases, etc.} |

### ❌ No Coverage
| Source | Risk Level | Reason |
|--------|------------|--------|
| {file} | {HIGH/MED/LOW} | {new file, complex logic, etc.} |

---

## Issues Found

### Stale Tests
| Test | Issue | Action |
|------|-------|--------|
| {test} | {function signature changed} | Update assertions |
| {test} | {mock data outdated} | Update mock |

### Dead Tests
| Test | Reason | Action |
|------|--------|--------|
| {test} | {tests deleted feature} | Remove |
| {test} | {imports removed module} | Remove |

### Failing Tests
| Test | Error | Likely Cause |
|------|-------|--------------|
| {test} | {error message} | {code bug or test needs update} |

---

## Test Health Metrics

- Test-to-code ratio: {N tests / N source files}
- Average assertions per test: {N}
- Critical paths covered: {list}
- Critical paths uncovered: {list}

---

## Generated Tasks

### High Priority (blocking)
- [ ] TEST-001: Fix failing test {test} — {reason}
- [ ] TEST-002: Update stale test {test} — {what changed}

### Medium Priority (should do)
- [ ] TEST-010: Add tests for {file} — {N} functions uncovered
- [ ] TEST-011: Add error case tests for {function}

### Low Priority (nice to have)
- [ ] TEST-020: Remove dead test {test}
- [ ] TEST-021: Add edge case tests for {function}

---

## Recommendations

{Based on findings, what should be prioritized}
```

## Step 7: Generate Test Tasks

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-test-sync --step 7 --step-label "Generate Test Tasks" 2>/dev/null || true
```

If issues found, add to current domain's tasks:

```markdown
## Auto-Generated Test Tasks

### From Test Sync — {date}

- [ ] TEST-001: Fix failing test `test_login.py::test_valid_credentials`
  - Error: AssertionError — expected 200, got 201
  - Cause: API return code changed
  - Action: Update assertion to expect 201

- [ ] TEST-002: Add tests for `src/auth/roles.py`
  - Functions: check_permission, assign_role, revoke_role
  - Priority: HIGH — authorization logic
  
- [ ] TEST-003: Update mock data in `test_users.py`
  - Schema changed: added `last_login` field
  - Action: Update all user fixtures
```

## Step 8: Integration with Workflow

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-test-sync --step 8 --step-label "Integration with Workflow" 2>/dev/null || true
```

### During Execute Phase (auto-invoked):
After each task completes:
1. Scan changed files and map to existing tests
2. **If new code paths have zero test coverage: write tests NOW** — do not defer
3. Run ALL affected unit/integration tests
4. Run ALL affected Playwright E2E tests
5. If failures: fix immediately (up to 2 attempts) before continuing. If both attempts fail:
   1. Write failure context to `.gsd-t/debug-state.jsonl` via `node -e "require('./bin/debug-ledger.js').appendEntry('.', {iteration:1,timestamp:new Date().toISOString(),test:'test-sync-failure',error:'2 in-context fix attempts exhausted',hypothesis:'see test-coverage.md',fix:'n/a',fixFiles:[],result:'STILL_FAILS',learning:'delegating to headless debug-loop',model:'sonnet',duration:0})"`
   2. Log: "Delegating to headless debug-loop (2 in-context attempts exhausted)"
   3. Run: `gsd-t headless --debug-loop --max-iterations 10`
   4. Exit code 0 → tests pass, continue; 1/4 → log to `.gsd-t/deferred-items.md`, report failure; 3 → report error
6. If E2E specs are missing for new features/modes/flows: **create them NOW**, not later
7. If E2E specs need updating for changed behavior: update them before continuing
8. **No task is complete until its tests exist and pass** — do not move to the next task with test gaps

### During Verify Phase (auto-invoked):
Full sync:
1. Complete coverage analysis (unit + E2E)
2. Run ALL unit/integration tests
3. Run the FULL E2E test suite — this is mandatory, not optional
4. Generate full report
5. Block verification if any critical tests failing (unit or E2E)

### Standalone Mode:
```
/gsd-t-test-sync
```
1. Full analysis of entire codebase
2. Comprehensive report
3. Generate all test tasks
4. Do not auto-add to domains — present for review

## Step 9: Report to User

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-test-sync --step 9 --step-label "Report to User" 2>/dev/null || true
```

### Quick Mode (during execute):
```
🧪 Test sync: 3 tests affected, 3 passing
   1 coverage gap noted → will address in verify phase
```

### Full Mode (during verify or standalone):
```
🧪 Test Sync Complete

Unit/Integration:
- Tests run: 45
- Passing: 43
- Failing: 2

E2E ({framework}):
- Specs run: 12
- Passing: 11
- Failing: 1

Coverage:
- Gaps: 3
- Stale tests: 1
- Dead tests: 0

Action Required:
- 2 failing unit tests must be fixed before verify passes
- 1 failing E2E spec must be fixed before verify passes
- See .gsd-t/test-coverage.md for details

Generated 5 test tasks → added to current domain
```

### Autonomy Behavior

**Level 3 (Full Auto)**: Log the summary and auto-advance to the next phase. If there are failing tests, attempt auto-fix (up to 2 attempts) before continuing. Do NOT wait for user input.

**Level 1–2**: Present the full report and wait for user input before proceeding.

## Document Ripple

### Always update:
1. **`.gsd-t/progress.md`** — Log test sync results in Decision Log (standalone mode)
2. **`.gsd-t/test-coverage.md`** — Created/updated with coverage report (Step 5)

### Check if affected:
3. **`docs/requirements.md`** — If test tasks map to requirements, update the Test Coverage table
4. **`.gsd-t/domains/{current}/tasks.md`** — If test tasks were generated, append them (Step 6)
5. **`.gsd-t/techdebt.md`** — If persistent test gaps were found, add as debt items

$ARGUMENTS

## Auto-Clear

All work is committed to project files. Execute `/clear` to free the context window for the next command.
