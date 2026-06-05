<!-- GSD-T:START — Do not remove this marker. Content between START/END is managed by gsd-t update. -->
# Prime Directives

1. SIMPLICITY ABOVE ALL. Every change should be minimal and impact as little code as possible. No massive refactors.
2. ALWAYS check for unwanted downstream effects before writing any new code or changing existing code.
3. ALWAYS check for completeness that any code creation/change/deletion is implemented thoroughly in every relevant file.
4. ALWAYS work autonomously. ONLY ask for user input when truly blocked.


# GSD-T: Contract-Driven Development

## Work Hierarchy

```
PROJECT or FEATURE or SCAN
  └── MILESTONE (major deliverable)
      └── PARTITION → DISCUSS → PLAN → IMPACT → EXECUTE → TEST-SYNC → INTEGRATE → VERIFY → COMPLETE
```

- **Project**: Full greenfield project → decomposed into milestones
- **Feature**: Major new feature for existing codebase → impact analysis → milestones
- **Scan**: Deep codebase analysis → techdebt.md → promotable to milestones
- **Milestone**: A significant deliverable (e.g., "User Authentication Complete")
- **Domain**: An independent area of responsibility within a milestone, with its own scope, tasks, and file boundaries
- **Contract**: The documented interface between domains — API shapes, schemas, component props

## Commands Reference

See `/gsd-t-help` for the complete command list.


# Living Documents

These documents MUST be maintained and referenced throughout development:

| Document | Location | Purpose |
|----------|----------|---------|
| **Requirements** | `docs/requirements.md` | Functional and technical requirements |
| **Architecture** | `docs/architecture.md` | System design, components, data flow, decisions |
| **Workflows** | `docs/workflows.md` | User journeys and technical process flows |
| **Infrastructure** | `docs/infrastructure.md` | Commands, DB setup, server access, creds |
| **README** | `README.md` | Project overview, setup, features |
| **Progress** | `.gsd-t/progress.md` | Current milestone/phase state + version |
| **Contracts** | `.gsd-t/contracts/` | Interfaces between domains |
| **Tech Debt** | `.gsd-t/techdebt.md` | Debt register from scans |

## The "No Re-Research" Rule

**BEFORE researching how something works, CHECK THE DOCS FIRST.**

```
NEED TO UNDERSTAND SOMETHING?
  ├── Is it about system structure/components? → Read docs/architecture.md
  ├── Is it about how a process flows? → Read docs/workflows.md
  ├── Is it about what to build? → Read docs/requirements.md
  ├── Is it about how to deploy/operate? → Read docs/infrastructure.md
  ├── Is it about domain interfaces? → Read .gsd-t/contracts/
  └── Not documented? → Research, then DOCUMENT IT
```


# Versioning

GSD-T tracks project version in `.gsd-t/progress.md` using semantic versioning: `Major.Minor.Patch`

| Segment | Bumped When | Example |
|---------|-------------|---------|
| **Major** | Breaking changes, major rework, v1 launch | 1.0.10 → 2.0.10 |
| **Minor** | New features, completed feature milestones | 1.10.10 → 1.11.10 |
| **Patch** | Bug fixes, minor improvements, cleanup | 1.1.10 → 1.1.11 |

**Patch convention**: Patch numbers are always 2 digits (≥10). When resetting after a minor or major bump, start at **10** (not 0). This keeps patches always 2 characters without leading zeros, so semver stays valid.

- Version is set during `gsd-t-init`:
  - **New project** (no existing manifest version): starts at `0.1.00` — first `complete-milestone` resets patch to `0.1.10`
  - **Existing repo** (has `package.json`, `pyproject.toml`, `Cargo.toml`, etc. with a version): use that version as the starting point
- Version is bumped during `gsd-t-complete-milestone` based on milestone scope
- Version is reflected in: `progress.md`, `README.md`, package manifest (if any), and git tags (`v{version}`)


# Destructive Action Guard (MANDATORY)

**NEVER perform destructive or structural changes without explicit user approval.** This applies at ALL autonomy levels, including Level 3.

```
BEFORE any of these actions, STOP and ask the user:
  ├── DROP TABLE, DROP COLUMN, DROP INDEX, TRUNCATE, DELETE without WHERE
  ├── Renaming or removing database tables or columns
  ├── Schema migrations that lose data or break existing queries
  ├── Replacing an existing architecture pattern (e.g., normalized → denormalized)
  ├── Removing or replacing existing files/modules that contain working functionality
  ├── Changing ORM models in ways that conflict with the existing database schema
  ├── Removing API endpoints or changing response shapes that existing clients depend on
  ├── Replacing a dependency or framework with a different one
  └── Any change that would require other parts of the system to be rewritten
```

### How to handle schema/architecture mismatches:
1. **READ the existing schema/code first** — understand what exists before proposing changes
2. **Adapt new code to match existing structures** — not the other way around
3. **If restructuring is truly needed**, present the case to the user with:
   - What exists today and why it might have been designed that way
   - What you want to change and why
   - What will break if you make the change
   - What data or functionality will be lost
   - A migration path that preserves existing data
4. **Wait for explicit approval** before proceeding

### Why this matters:
Even in development, the user may have:
- Working functionality they've tested and rely on
- Data they've carefully set up (seed data, test accounts, configuration)
- Other code that depends on the current structure
- Design decisions made for reasons not documented

**"Adapt to what exists" is always safer than "replace what exists."**


# Autonomous Execution Rules

## Update Notices

The hook output at session start is NOT visible to the user — only your response text is. So you MUST emit a dated status banner as the **very first line of every response** (every turn, not just the first), above any routing header or other content.

**Date source — MANDATORY**: use the timestamp from the most recent `[GSD-T NOW]` signal in your context. The UserPromptSubmit hook (`scripts/gsd-t-auto-route.js`) emits `[GSD-T NOW] Day: Mon DD, YYYY HH:MM:SS TZ` at the start of every turn — this is live system clock. Do NOT use:
- The SessionStart banner (frozen at session start — wrong on day 2 of a long session)
- The `currentDate` field in your context (frozen at session start — same problem)
- Your training-cutoff intuition (always wrong)

If `[GSD-T NOW]` is absent for any reason, fall back to `currentDate` and flag the gap.

**Format** — one line, no changelog noise in steady state:

- Steady state (`[GSD-T]` token seen at session start, or no version-check token — default):
  ```
  Day: Mon DD, YYYY HH:MM TZ — GSD-T v{version} — CURRENT
  ```
  Example: `Sun: May 3, 2026 12:21 PDT — GSD-T v3.19.00 — CURRENT`

- Auto-updated this session (`[GSD-T AUTO-UPDATE]` token seen at session start):
  ```
  Day: Mon DD, YYYY HH:MM TZ — GSD-T v{old} → v{new} ✅ AUTO-UPDATED
  Changelog: https://github.com/Tekyz-Inc/get-stuff-done-teams/blob/main/CHANGELOG.md
  ```
  (The changelog link earns its place here — there's new code to read about.)

- Update available, auto-update failed (`[GSD-T UPDATE]` token seen at session start):
  ```
  Day: Mon DD, YYYY HH:MM TZ — GSD-T v{installed} → v{latest} ⬆️ UPDATE AVAILABLE (auto-update failed)
  Run: /gsd-t-version-update-all
  Changelog: https://github.com/Tekyz-Inc/get-stuff-done-teams/blob/main/CHANGELOG.md
  ```
  Also repeat at the **end** of your first response.

(Drop seconds from the displayed banner — keep it to `HH:MM TZ` for readability. The hook emits seconds; you trim.)

**Why every response, not just the first**: long sessions span multiple days. A dated header on every turn means the user can scroll back and immediately see when any exchange happened, without inferring from context.

**Order**: dated status banner FIRST. Then routing header (if any). Then your response body.

## Live Clock Rule (MANDATORY)

Whenever you write a date or timestamp to any file — decision log entries in `progress.md`, `continue-here-{ts}.md` filenames, memory entries, banners, "Updated:" / "Date:" frontmatter, archive headings, anything visible — source it from **the live system clock**. Never from `currentDate` (frozen at session start), the SessionStart banner (frozen), or your intuition (unreliable).

**How to obtain the live clock**:
1. Read the most recent `[GSD-T NOW]` signal from your context (UserPromptSubmit hook emits it every turn).
2. If absent, run `node -e "console.log(new Date().toISOString())"` via Bash before writing.

**Enforcement**: a PreToolUse hook (`scripts/gsd-t-date-guard.js`) blocks Write/Edit calls whose content contains timestamps drifting more than ±5 minutes from the live system clock. The guard:
- Validates decision-log entries (`- YYYY-MM-DD HH:MM:`), filename timestamps (`continue-here-YYYY-MM-DDTHHMMSS`), banners (`Day: Mon DD, YYYY HH:MM`), labeled stamps (`Date:`, `Updated:`, `Created:`, etc., with optional TZ abbr / numeric offset / `Z`), and **progress.md table cells carrying `YYYY-MM-DD HH:MM TZ`** (M59, v3.29.10+ — Completed Milestones + Session Log).
- For Edit, ignores timestamps that appear in BOTH `old_string` and `new_string` (pre-existing context, not new writes).
- Allowlists machine-written paths (`.gsd-t/events/`, `.gsd-t/transcripts/`, `.gsd-t/metrics/`, `.git/`, `node_modules/`, archives, log files).
- Fails open on internal error — broken tool calls would be worse than drift.

**Timestamp precision in progress.md (M59, v3.29.10+)**: the `## Date:` frontmatter line, the "Completed" cell of the Completed Milestones table, and the "Date" cell of the Session Log table MUST be written as `YYYY-MM-DD HH:MM TZ` (e.g. `2026-05-27 10:15 PDT`). This is **forward-only** — pre-3.29.10 rows that read date-only (`YYYY-MM-DD`) stay as-is. Readers (status, dashboard, GSD-T-Board) MUST accept both. `archive-meta.json::completedAt` is local-offset ISO (`YYYY-MM-DDTHH:MM:SS±HH:MM`) — use `localIsoWithOffset()` from `bin/gsd-t-time-format.cjs`, not `new Date().toISOString()` (which produces UTC `Z`).

If the guard blocks your write, do NOT bypass it. Re-read `[GSD-T NOW]`, regenerate the timestamp, retry.

## Conversation vs. Work

Only execute GSD-T workflow behavior when a `/gsd-t-*` command is invoked or when actively mid-phase (resumed via `/gsd-t-resume`). **Plain text messages — especially questions — should be answered conversationally.** Do not launch into workflow execution, file reading, or phase advancement from a question or comment. If the user wants work done, they will invoke a command.

**Exception — Auto-Route signal**: When `[GSD-T AUTO-ROUTE]` appears in your context (injected by the UserPromptSubmit hook), the user's plain text message should be treated as a `/gsd {message}` invocation. Execute the `/gsd` smart router with the user's full message as the argument instead of replying conversationally. The hook only fires in GSD-T projects (directories containing `.gsd-t/progress.md`) — it silently passes through in all other directories.

## Auto-Init Guard

Before executing any GSD-T workflow command, check if **any** of these files are missing in the current project:
- `.gsd-t/progress.md`, `.gsd-t/backlog.md`, `.gsd-t/backlog-settings.md`
- `.gsd-t/contracts/`, `.gsd-t/domains/`
- `CLAUDE.md`, `README.md`
- `docs/requirements.md`, `docs/architecture.md`, `docs/workflows.md`, `docs/infrastructure.md`

If any are missing:
1. Run `gsd-t-init` automatically (it skips files that already exist)
2. Then continue with the originally requested command

**Exempt commands** (do not trigger auto-init): `gsd-t-init`, `gsd-t-init-scan-setup`, `gsd-t-help`, `gsd-t-version-update`, `gsd-t-version-update-all`.

## Playwright Readiness Guard (M50 — deterministic enforcement)

Playwright readiness is enforced by executable code, not prose. Three layers:

1. **Bootstrap library** — `bin/playwright-bootstrap.cjs` exports `hasPlaywright`, `detectPackageManager`, `installPlaywright`, `verifyPlaywrightHealth`. `bin/ui-detection.cjs` exports `hasUI`, `detectUIFlavor`. See `.gsd-t/contracts/playwright-bootstrap-contract.md`.
2. **Workflow-stage gate** — the verify/execute Workflow scripts call `playwright-bootstrap.cjs::installPlaywright()` before any E2E stage when `hasUI(projectDir)` AND `!hasPlaywright(projectDir)`. On install failure the stage halts with a structured `blocked-needs-human` result. (M61: replaced the retired `headless-auto-spawn.cjs` spawn-time gate — the Workflow runtime owns spawning now.)
3. **Commit-time gate** — `scripts/hooks/pre-commit-playwright-gate` (opt-in via `gsd-t doctor --install-hooks`) blocks commits that touch viewer/UI source files when Playwright tests have not passed since the most recent change. Reads `.gsd-t/.last-playwright-pass`; fails open on missing/corrupt timestamps.

Operator overrides:
- Manual install: `gsd-t setup-playwright [path]` (or `gsd-t doctor --install-playwright`).
- Health check: `gsd-t doctor` reports `playwright missing` for any UI project without `playwright.config.*`.

You no longer need to run a check yourself before testing commands — the Workflow stage runs the readiness gate before E2E.

### Playwright Cleanup

After Playwright tests finish (pass or fail), **kill any app/server processes that were started for the tests**. Playwright often launches a dev server (via `webServer` config or manually). These processes must not be left running:
1. Check for any dev server processes spawned during the test run
2. Kill them (e.g., `npx kill-port`, or terminate the process directly)
3. Verify the port is free before proceeding

This applies everywhere Playwright tests are executed: execute, test-sync, verify, quick, wave, debug, complete-milestone, and integrate.

### E2E Enforcement Rule (MANDATORY)

**Running only unit tests when E2E tests exist is a test failure.** This is non-negotiable.

```
BEFORE reporting "tests pass" for ANY task:
  ├── Does playwright.config.* or cypress.config.* exist?
  │     YES → You MUST run the full E2E suite. Unit-only results are INCOMPLETE.
  │     NO  → Unit/integration tests are sufficient.
  ├── Did you run every detected test runner?
  │     NO → Run it now. Do not commit until ALL suites pass.
  └── Report format MUST include all suites:
        "Unit: X/Y pass | E2E: X/Y pass" (or "E2E: N/A — no config")
```

The conditional "if UI/routes/flows changed" in command files applies to **writing new E2E specs**, not to **running existing ones**. You always run existing E2E specs. Always.

### E2E Test Quality Standard (MANDATORY)

**E2E tests must be FUNCTIONAL tests, not LAYOUT tests.** This is non-negotiable.

A layout test checks that elements exist (`isVisible`, `toBeAttached`, `toBeEnabled`, `toHaveCount`). A functional test checks that features work — actions produce correct outcomes.

```
LAYOUT TEST (WRONG — passes even if every feature is broken):
  await expect(page.locator('#tab-sessions')).toBeVisible();
  await page.click('#tab-sessions');
  // ← No assertion that the tab's content actually loaded

FUNCTIONAL TEST (RIGHT — fails if the feature is broken):
  await page.click('#tab-sessions');
  await expect(page.locator('.session-list')).toContainText('Session 1');
  // ← Proves clicking the tab loaded the session data
```

Every Playwright assertion must verify one of:
- **State changed**: After click/type/submit, the app state is different (new content, updated data, changed status)
- **Data flowed**: User input → API call → response rendered (use `page.waitForResponse` or assert on rendered data)
- **Content loaded**: Navigation/tab switch → destination content appeared (assert on text/data unique to destination)
- **Widget responded**: Terminal accepted keystrokes and produced output, editor saved changes, form submitted and data persisted

**If a test would pass on an empty HTML page with the correct element IDs and no JavaScript, it is not a functional test.** Rewrite it.

### Test Data Cleanup (MANDATORY — M58)

**Tests that insert data into a project's stores MUST register those inserts with the GSD-T test-data ledger so Verify can purge them.** Tests that leave orphaned `E2E_*` records in production data violate this rule.

The supported mechanism is the `withTestData()` Playwright fixture:

```ts
import { test as base } from '@playwright/test';
import { withTestData } from '@tekyzinc/gsd-t/templates/test-helpers/test-data-fixture';

export const test = base.extend(withTestData());

test('drag idea creates new column', async ({ page, testData }) => {
  const id = testData.tag('E2E_DRAG');  // → "E2E_DRAG_{runId}_{counter}"
  await testData.register({
    kind: 'localStorage-key-prefix',
    store: 'gsd-t-board:idea:',
    id,
    taggedPrefix: 'E2E_',
  });
  // … UI interactions that insert a row keyed by `${store}${id}` …
});
```

Three built-in adapters: `localStorage-key-prefix`, `file-json-array`, `sqlite-table-where`. Extend via `registerAdapter(kind, adapter)`. Each adapter refuses to delete a record whose id does not start with the ledger row's `taggedPrefix` (defense in depth — see `.gsd-t/contracts/test-data-tagging-contract.md`).

After the E2E suite, `gsd-t-verify` Step 4.5 runs `gsd-t test-data --purge --run "$GSD_T_VERIFY_RUN_ID"`. If any adapter throws or refuses, verify FAILs the gate (block-promotion semantics — equivalent to a failing CI-Parity Gate). Contract: `.gsd-t/contracts/test-data-ledger-contract.md` v1.0.0 STABLE.

## Orthogonal Validation Triad (Mandatory)

Every code-producing phase ends with `gsd-t-verify.workflow.js`, which runs three orthogonal validators as `parallel()` `agent()` stages with schema-validated output. Per `.gsd-t/contracts/orthogonal-validation-contract.md` v1.0.0 STABLE, they are declared orthogonal objective functions — no collapse, no substitution, no transitive trust.

- **`/code-review ultra`** — cooperative correctness + cleanup. Severity: `important` / `nit` / `pre-existing`. Skippable via `args.skipUltra=true` + `args.skipUltraReason`. `skipUltra=true` is INELIGIBLE for `VERIFIED`.
- **Red Team** — adversarial / security / boundaries. Non-skippable. Protocol: `templates/prompts/red-team-subagent.md`. Verdict: `FAIL` (any CRITICAL or HIGH bug — blocks completion) or `GRUDGING-PASS` (exhaustive search, nothing found). CRITICAL/HIGH bugs get up to 2 fix cycles before deferral. Runs on `model: "opus"`.
- **QA** — test execution + shallow-test detection + contract compliance. Non-skippable. Protocol: `templates/prompts/qa-subagent.md`. Writes ZERO feature code. Any shallow E2E test blocks phase completion. Runs on `model: "sonnet"`.

When `.gsd-t/contracts/design-contract.md` or `.gsd-t/contracts/design/` exists, a fourth stage runs Design Verification (protocol: `templates/prompts/design-verify-subagent.md`) — opens a browser, compares the build against the design, returns a structured element-by-element MATCH/DEVIATION schema. Deviations block completion.

Synthesis stage merges results without category collapse. Verdict: `VERIFIED` / `VERIFIED-WITH-WARNINGS` / `VERIFY-FAILED`.

## Model Display (MANDATORY)

**Each Workflow `agent()` call declares its model explicitly** via the `model:` option (`"haiku"` / `"sonnet"` / `"opus"`). The Workflow runtime emits a `⚙ [{model}] {label}` line per stage in `/workflows`, giving the user real-time visibility into which model handles each operation.

**Model assignments:**
- `model: "haiku"` — strictly mechanical tasks: run test suites and report counts, check file existence, validate JSON structure, branch guard checks
- `model: "sonnet"` — mid-tier reasoning: routine code changes, standard refactors, test writing, QA evaluation, straightforward synthesis
- `model: "opus"` — high-stakes reasoning: architecture decisions, security analysis, complex debugging, cross-module refactors, Red Team adversarial QA, quality judgment on critical paths

**Context budget:** Workflow scripts receive a `budget` global (`budget.total`, `budget.spent()`, `budget.remaining()`) tied to the user's per-turn token target. Use it for dynamic loops (`while (budget.total && budget.remaining() > 50_000) { ... }`) or to scale fleet size. Opus 4.7/4.8 ship 1M context windows; the legacy meter at `bin/token-budget.cjs` was retired in M61 — use native `/context` for live in-session usage.

## Desktop as Cockpit (M61 SC7 — v4.0.10+)

Routine GSD-T actions (milestone → partition → plan → execute → verify → deliver) run from the Claude Code desktop app via Workflows + Skills. CLI residue is intentional and limited to: (a) background hooks the harness fires automatically, (b) jobs that must outlive the desktop session. No routine build / rebuild / debug / deliver action should require terminal keystrokes.

## GSD-T Workflows (M61 — v4.0.10+)

GSD-T workflows live at `templates/workflows/`. Each workflow is a self-contained native Workflow script that handles one phase of the GSD-T lifecycle. Command files (`commands/gsd-t-*.md`) are thin invokers that call `Workflow({scriptPath, args})`. The `scriptPath` MUST be resolved to an absolute path at invoke time via `gsd-t workflow-path <name>` (M69) — the workflow ships inside the installed `@tekyzinc/gsd-t` package, not the consumer project, so a bare relative `templates/workflows/...` path only resolves from the GSD-T source repo and silently breaks `Workflow()` everywhere else.

Canonical scripts:
- `gsd-t-execute.workflow.js` — preflight → brief → file-disjointness → parallel(domain workers) → integrate → verify-gate
- `gsd-t-verify.workflow.js` — preflight → verify-gate → M57 CI-parity → M58 test-data purge → parallel(/code-review ultra ∥ Red Team ∥ QA) → synthesis
- `gsd-t-wave.workflow.js` — composes execute + verify as sub-workflows
- `gsd-t-integrate.workflow.js` — cross-domain wire-up + light verify-gate
- `gsd-t-debug.workflow.js` — 2-cycle diagnose/fix/verify (CLAUDE.md Prime Rule)
- `gsd-t-quick.workflow.js` — preflight + brief + single-task + verify-gate (M56-D4)
- `gsd-t-phase.workflow.js` — generic upper-stage runner (partition / plan / discuss / impact / milestone / prd / design-decompose / doc-ripple)
- `gsd-t-scan.workflow.js` — preflight → volume-probe → pipeline(per-slice deep finder → single verify) → synthesis → document → render (M66: fans out by codebase VOLUME, not a fixed 5-teammate dimension count; M67: deep document phase deterministically produces the full living-doc set + dimension files, per-doc fan-out)

**Runtime-native invariant (M81 — v4.0.29+):** the Workflow sandbox provides ONLY `agent/parallel/pipeline/log/phase/budget/args` — NO `require`/`fs`/`path`/`child_process`/`process`, and `args` arrives as a JSON STRING. Each workflow is self-contained: it `JSON.parse`s `args` and delegates every CLI call (preflight, verify-gate, brief, build-coverage, ci-parity, test-data, disjointness) to inline `async` helpers that run the command via an `agent()`'s Bash (preferring project-local `bin/<tool>.cjs`, else the global `gsd-t` PATH binary) and parse the JSON envelope — preserving the M55-D5 project-local-bin invariant. The old `require("./_lib.js")` pattern threw `ReferenceError` on first eval and silently broke every workflow except scan (TD-113, fixed M81); `_lib.js` is retired as a workflow dependency.

## Preflight Gate (KEPT from M55)

Every Workflow script begins with `lib.runPreflight({projectDir})`. Hard-fails on any `severity:"error"` check (wrong branch, occupied required port). Non-error checks record but do not block. Same envelope feeds `verify-gate` Track 1.

Library: `bin/cli-preflight.cjs::runPreflight({projectDir, checks?})`.
Contract: `.gsd-t/contracts/cli-preflight-contract.md` v1.0.0 STABLE.

## Brief-First Worker Rule (KEPT from M55, REFRAMED for M61)

Every Workflow `agent()` call threads `$BRIEF_PATH` — a ≤2,500-token JSON snapshot generated by `bin/gsd-t-context-brief.cjs`. Workers grep the brief instead of re-walking the repo. `execute.workflow.js` generates a per-domain brief inside the `parallel()` map (M55-D2 brief-per-spawn semantic).

The 3 validation-subagent protocols (`templates/prompts/{qa,red-team,design-verify}-subagent.md`) carry the canonical instruction "If you're about to grep, read, or run a test, check the brief first at `$BRIEF_PATH`."

`.gsd-t/briefs/` is gitignored — briefs are per-spawn ephemera, not committed artifacts.

Library: `bin/gsd-t-context-brief.cjs::generateBrief(...)`.
Contract: `.gsd-t/contracts/context-brief-contract.md` v1.0.0 STABLE.

## Verify-Gate + Orthogonal Validation Triad (M61 v4.0.10+)

`gsd-t verify-gate --json` runs as a deterministic stage inside `gsd-t-verify.workflow.js`. Track 1 = preflight envelope. Track 2 = parallel-CLI substrate (`tsc`, `biome`/`ruff`, `npm test`, `knip`, `gitleaks`, `scc`/`lizard`). Both tracks always run; non-zero exit halts before the orthogonal triad.

After verify-gate, `verify.workflow.js` runs two FAIL-blocking gates inherited from M57 + M58:
- M57 CI-Parity: `gsd-t build-coverage` + `gsd-t ci-parity` (origin TimeTracking v1.10.12 Dockerfile incident)
- M58 Test-Data Purge: `gsd-t test-data --purge --run <id>` (origin GSD-T-Board v0.1.10 2442 E2E orphans incident)

Then the orthogonal validation triad runs as `parallel()` `agent()` stages per `.gsd-t/contracts/orthogonal-validation-contract.md` v1.0.0 STABLE:
- `/code-review ultra` — cooperative correctness + cleanup (skippable; requires `skipUltraReason`)
- Red Team — adversarial / security / boundaries (non-skippable; verdict `FAIL` / `GRUDGING-PASS`)
- QA — test mechanics + shallow-test detection + contract compliance (non-skippable)

Synthesis stage merges results WITHOUT collapsing categories. Verdict: `VERIFIED` / `VERIFIED-WITH-WARNINGS` / `VERIFY-FAILED`. `skipUltra=true` is INELIGIBLE for `VERIFIED`.

Library: `bin/gsd-t-verify-gate.cjs::runVerifyGate(...)` + `bin/gsd-t-verify-gate-judge.cjs::buildJudgePrompt(...)`.
Contracts: `verify-gate-contract.md` v1.0.0 STABLE + `orthogonal-validation-contract.md` v1.0.0 STABLE.

## API Documentation Guard (Swagger/OpenAPI)

**Every API endpoint MUST be documented in a Swagger/OpenAPI spec. No exceptions.**

When any GSD-T command creates or modifies an API endpoint:
1. **If no Swagger/OpenAPI spec exists**: Set one up immediately
   - Detect the framework (Express, Fastify, Hono, Django, FastAPI, etc.)
   - Install the appropriate Swagger integration (e.g., `swagger-jsdoc` + `swagger-ui-express`, `@fastify/swagger`, FastAPI's built-in OpenAPI)
   - Create the OpenAPI spec file or configure auto-generation from code
   - Add a `/docs` or `/api-docs` route serving the Swagger UI
2. **Update the spec**: Every new or changed endpoint must be reflected in the Swagger/OpenAPI spec — routes, request/response schemas, auth requirements, error responses
3. **Publish the Swagger URL**: The Swagger/API docs URL MUST appear in:
   - `CLAUDE.md` — under Documentation or Infrastructure section
   - `README.md` — under API section or Getting Started
   - `docs/infrastructure.md` — under API documentation
4. **Verify**: After any API change, confirm the Swagger UI loads and reflects the current endpoints

This applies during: `gsd-t-execute`, `gsd-t-quick`, `gsd-t-integrate`, `gsd-t-wave`, and any command that touches API code.

## Prime Rule
KEEP GOING. Only stop for:
1. Unrecoverable errors after 2 fix attempts (delegate to `gsd-t headless --debug-loop` first — only stop if exit code 4)
2. Ambiguity that fundamentally changes project direction
3. Milestone completion (checkpoint for user review)
4. Destructive actions (see Destructive Action Guard above — ALWAYS stop)

## Pre-Commit Gate (MANDATORY)

NEVER commit code without running this checklist. This is not optional.

```
BEFORE EVERY COMMIT:
  ├── Am I on the correct branch?
  │     CHECK → Run `git branch --show-current`
  │     Compare against "Expected branch" in project CLAUDE.md
  │     WRONG BRANCH → STOP. Do NOT commit. Switch to the correct branch first.
  │     No guard set → Proceed (but warn user to set one)
  ├── Did I create or change an API endpoint or response shape?
  │     YES → Update .gsd-t/contracts/api-contract.md
  │     YES → Update Swagger/OpenAPI spec (see API Documentation Guard below)
  │     YES → Verify Swagger URL is in CLAUDE.md and README.md
  ├── Did I change the database schema?
  │     YES → Update .gsd-t/contracts/schema-contract.md AND docs/schema.md
  ├── Did I add/change a UI component interface?
  │     YES → Update .gsd-t/contracts/component-contract.md
  ├── Did I add new files or directories?
  │     YES → Update the owning domain's scope.md
  ├── Did I implement or change a requirement?
  │     YES → Update docs/requirements.md (mark complete or revise)
  ├── Did I add/change/remove a component or change data flow?
  │     YES → Update docs/architecture.md
  ├── Did I modify any document, script, or code file?
  │     YES → Add timestamped entry to .gsd-t/progress.md Decision Log
  │     Format: `- YYYY-MM-DD HH:MM: {what was done} — {brief context or result}`
  │     This includes ALL file-modifying activities:
  │       project, feature, scan, gap-analysis, milestone, partition, discuss,
  │       plan, impact, execute, test-sync, integrate, verify, complete-milestone,
  │       wave, quick, debug, promote-debt, populate, setup, init, init-scan-setup,
  │       backlog-add/edit/move/remove/promote/settings, and any manual code changes
  ├── Did I make an architectural or design decision?
  │     YES → Also include decision rationale in the progress.md entry
  ├── Did I discover or fix tech debt?
  │     YES → Update .gsd-t/techdebt.md
  ├── Did I establish a pattern future work should follow?
  │     YES → Update CLAUDE.md or domain constraints.md
  ├── Did I add/change tests?
  │     YES → Verify test names and paths are referenced in requirements
  ├── Did I change UI, routes, or user flows?
  │     YES → Update affected E2E test specs (Playwright/Cypress)
  ├── Did I add a new top-level dir, or change build/CI config?
  │     This is ENFORCED MECHANICALLY by `gsd-t-verify` Step 2.6
  │     (CI-Parity Gate: `gsd-t build-coverage` + `gsd-t ci-parity`,
  │     FAIL-blocking). You do NOT self-attest this — verify runs the
  │     real CI build. It exists because TimeTracking v1.10.12 shipped
  │     VERIFIED+tagged with a new dir absent from the Dockerfile COPY.
  └── Did I run the affected tests?
        YES → Verify they pass. NO → Run them now.
```

If ANY answer is YES and the doc is NOT updated, update it BEFORE committing. No exceptions.

## Document Ripple Completion Gate (MANDATORY)

**NEVER report a task as "done" or present a summary until ALL downstream documents are updated.** This is not optional.

When a change affects multiple files (e.g., a new standard that applies across command files, a renamed API, a new convention), you MUST:

1. **Identify the full blast radius BEFORE starting**: List every file that needs the change
2. **Complete ALL updates in one pass**: Do not update 3 of 8 files and then present a summary
3. **Run the Pre-Commit Gate on the COMPLETE changeset**: Not on a partial subset
4. **Only THEN report completion**

```
BEFORE reporting "done" or presenting a summary:
  ├── Did this change establish a new standard, rule, or convention?
  │     YES → Grep for every file that should enforce it. Update ALL of them.
  ├── Did this change modify a pattern used in multiple command files?
  │     YES → Find and update EVERY command file that uses that pattern.
  ├── Did this change affect a template (CLAUDE-global, CLAUDE-project, etc.)?
  │     YES → The template AND the live equivalent (~/.claude/CLAUDE.md) must match.
  ├── Did this change add a new requirement?
  │     YES → Add to docs/requirements.md in the same pass.
  ├── Have I checked EVERY file in the blast radius?
  │     NO → Keep going. Do not present partial work.
  └── Am I about to say "want me to also update X?" or "should I check Y?"
        YES → STOP. Just update X and check Y. Then report done.
```

**The test for this gate**: If the user asks "did you update all the documents?" and the answer would be "no, I missed some" — you failed this gate. The user should never need to ask.

## Effort Estimates — GSD-T-Native Units (MANDATORY)

**NEVER express effort or scope in developer-hours, dev-days, sprints, story points, or person-weeks.** GSD-T operates on a different cost model — the worker is Claude, not a human team — and human-time estimates have no predictive value for GSD-T workflows. They actively mislead by suggesting a calendar shape that doesn't match how the system runs.

Use GSD-T-native units instead:

| Unit | When to use |
|------|-------------|
| **Domain count** | Milestone scope (1-2 simple, 3-4 medium, 5+ complex) |
| **Wave count** | Cross-domain dependency depth — how many serial gates exist |
| **Parallel-domain count** | How many domains can run concurrently (file-disjoint) |
| **Spawn count** | Estimated `claude -p` / Task subagent invocations |
| **Token-spend range** | `$X-Y` dollars based on trailing-3 comparable milestones in `.gsd-t/token-log.md` |
| **Rate-limit-window count** | If the work might span > 1 5h Claude Max window |

Where this applies:
- `/gsd-t-milestone` Step 4 — Pre-Partition Assessment
- `/gsd-t-scan` techdebt milestone suggestions
- `/gsd-t-promote-debt` effort fields
- `docs/requirements.md`, `progress.md` Decision Log entries
- Any internal estimate the user might read

Acceptable: machine-time references (e.g. "5 min cache TTL", "5h rate-limit window", "14 day staleness threshold") — these are concrete system properties, not effort estimates. The rule applies to **effort/scope**, not to **system timeouts**.

## Execution Behavior
- ALWAYS check docs/architecture.md before adding or modifying components.
- ALWAYS check docs/workflows.md before changing any multi-step process.
- ALWAYS update docs as part of completing work — not as an afterthought.
- ALWAYS self-verify work by running tests and verification commands.
- NEVER re-research how something works if you built it — it should be documented.
- NEVER pause to show verification steps — execute them.
- NEVER ask "should I continue?" — just continue.
- NEVER summarize what you're "about to do" — just do it.
- IF a test fails, fix it immediately (up to 2 attempts) before reporting. If both attempts fail, delegate to `gsd-t headless --debug-loop` before stopping.

## Autonomy Levels

Projects can specify an autonomy level in their project CLAUDE.md:

| Level | Behavior |
|-------|----------|
| **Level 1: Supervised** | Pause at each phase for confirmation |
| **Level 2: Standard** | Pause only at milestones |
| **Level 3: Full Auto** | Only pause for blockers or project completion (default) |

If not specified, use Level 3.

## Workflow Preferences (Defaults — override in project CLAUDE.md)

### Research Policy
Before planning a phase, evaluate whether research is needed:

**Run research when:**
- Phase involves unfamiliar libraries, APIs, or services
- Architectural decisions are required
- Integrating external systems
- Phase scope is ambiguous or complex

**Skip research when:**
- Patterns are already established from earlier phases
- Straightforward CRUD, UI, or config work
- Domain is well understood
- Phase builds directly on existing code patterns

If in doubt, skip research and proceed — research if execution reveals gaps.

### Phase Flow
- Upon completing a phase, automatically proceed to the next phase
- ONLY run Discussion phase if truly required (clear path → skip to Plan)
- ALWAYS self-verify work by running verification commands
- NEVER pause to show verification steps — execute them

### Next Command Hint

When a GSD-T command completes (and does NOT auto-advance to the next phase), display a "Next Up" block at the very end of your response. This format is designed to trigger Claude Code's prompt suggestion engine — making the next command appear as ghost text in the user's input field.

**MANDATORY format** — use this exact structure:

```
───────────────────────────────────────────────────────────────

## ▶ Next Up

**{Phase Name}** — {one-line description of what happens next}

`/gsd-t-{command}`

───────────────────────────────────────────────────────────────
```

If there are alternative commands that also make sense, add them:

```
**Also available:**
- `/gsd-t-{alt-1}` — {description}
- `/gsd-t-{alt-2}` — {description}
```

Successor mapping:
| Completed | Next | Also available |
|-----------|------|----------------|
| `project` | `milestone` | |
| `feature` | `milestone` | |
| `milestone` | `partition` | |
| `partition` | `plan` | `discuss` (if complex) |
| `discuss` | `plan` | |
| `plan` | `execute` | `impact` (if risky) |
| `impact` | `execute` | |
| `execute` | `test-sync` | |
| `test-sync` | `verify` | `integrate` (if multi-domain) |
| `integrate` | `verify` | |
| `verify` | *(auto-invokes complete-milestone)* | |
| `complete-milestone` | `status` | |
| `scan` | `promote-debt` | `milestone` |
| `init` | `scan` | `milestone` |
| `init-scan-setup` | `milestone` | |
| `gap-analysis` | `milestone` | `feature` |
| `populate` | `status` | |
| `setup` | `status` | |
| `design-decompose` | `design-build` | `partition` (if domains needed first) |

Commands with no successor (standalone): `quick`, `debug`, `brainstorm`, `status`, `help`, `resume`, `prompt`, `log`, `health`, `pause`, backlog commands.

Skip the hint if auto-advancing (Level 3 mid-wave) — only show when the user needs to manually invoke the next step.


# Don't Do These Things

- NEVER perform destructive or structural changes without explicit user approval (see Destructive Action Guard above).
- NEVER drop database tables, remove columns, or run destructive SQL on an existing database — adapt new code to the existing schema.
- NEVER replace existing architecture patterns (e.g., normalized → denormalized) without user approval — even if you think the new way is better.
- NEVER commit code without running the Pre-Commit Gate checklist. EVERY commit.
- NEVER batch doc updates for later — update docs as part of the same commit as the code change.
- NEVER start a phase without reading contracts and relevant docs first.
- NEVER complete a phase without running document ripple on affected docs.
- NEVER re-research how a component works — read architecture.md and contracts.
- NEVER let code and contract disagree — fix one or the other immediately.
- NEVER make changes that touch more than 3 files without pausing to confirm approach.


# Code Standards (Defaults — override in project CLAUDE.md)

## Patterns
- Type hints required on all function signatures
- Dataclasses/interfaces for data models, not raw dicts
- Functions under 30 lines — split if longer
- Files under 200 lines — create new modules if needed
- Enums for state management and fixed option sets

## Naming
```
files:      snake_case        (user_service.py)
classes:    PascalCase        (UserService)
functions:  snake_case        (get_user)
constants:  UPPER_SNAKE_CASE  (MAX_RETRIES)
private:    _underscore       (_internal_method)
```

## Markdown Tables

Markdown table emoji-padding rules live in `templates/stacks/_markdown.md` (auto-injected via Stack Rules Engine).


## Stack Rules Engine

GSD-T auto-detects project tech stack at subagent spawn time and injects mandatory best-practice rules into the subagent prompt.

**Detection sources**: `package.json` (React, TypeScript, Node API), `requirements.txt`/`pyproject.toml` (Python), `go.mod` (Go), `Cargo.toml` (Rust).

**Universal rules**: Templates prefixed with `_` (e.g., `_security.md`) are **always** injected, regardless of stack.

**Stack-specific rules**: Injected only when the matching stack is detected (e.g., `react.md` when `"react"` is in `package.json`).

**Design-to-code**: Activated when `.gsd-t/contracts/design-contract.md` (flat), `.gsd-t/contracts/design/` (hierarchical element/widget/page contracts — bootstrap via `/gsd-t-design-decompose`), `design-tokens.json`, `design-tokens/`, `.figmarc`, or `figma.config.json` exists, OR when Figma MCP is configured in `~/.claude/settings.json`. Auto-bootstrapped during partition when Figma URLs or design references are detected in requirements. Enforces pixel-perfect frontend implementation from designs with: Figma MCP auto-detection, design token extraction protocol, stack capability evaluation (recommends alternatives if stack can't achieve the design), component decomposition, responsive breakpoint strategy, and a mandatory visual verification loop — every implemented screen must be rendered in a real browser, screenshotted at mobile/tablet/desktop breakpoints, and compared pixel-by-pixel against the Figma design. Visual deviations block task completion.

**Enforcement**: Stack rule violations have the same weight as contract violations — they are task failures, not warnings.

**Extensible**: Drop a `.md` file into `templates/stacks/` in the GSD-T package to add rules for a new stack. If the directory is missing, detection skips silently.

**Commands that inject stack rules**: `gsd-t-execute`, `gsd-t-quick`, `gsd-t-integrate`, `gsd-t-wave`, `gsd-t-debug`.


# Recovery After Interruption

When resuming work (new session or after /clear):
1. Read `.gsd-t/progress.md` for current state
2. Read `docs/requirements.md` for what's left to build
3. Read `docs/architecture.md` for how the system is structured
4. Read `.gsd-t/contracts/` for domain interfaces
5. Verify last task's work is intact (files exist, tests pass)
6. Continue from current task — don't restart the phase

**CRITICAL: Do NOT research how the system works. The docs tell you. Read them.**
<!-- GSD-T:END — Do not remove this marker. -->
