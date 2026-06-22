<!-- GSD-T:START — Do not remove this marker. Content between START/END is managed by gsd-t update. -->
# Prime Directives

1. SIMPLICITY ABOVE ALL. Every change should be minimal and impact as little code as possible. No massive refactors.
2. ALWAYS check for unwanted downstream effects before writing any new code or changing existing code.
3. ALWAYS check for completeness that any code creation/change/deletion is implemented thoroughly in every relevant file.
4. ALWAYS work autonomously. ONLY ask for user input when truly blocked.


# Output Style (default: CONCISE)

**Default to concise output. Optimize for fast scanning, not completeness of prose.** The user wants ALL the information — quickly, organized, scannable. Override per-project by setting `Output Style: verbose` in the project CLAUDE.md.

Concise rules (this is the DEFAULT):
- **Answer first, on the banner line or the one right after it.** The literal answer ("all correct", "Yes — runs in the service worker, uses IndexedDB", the number, the verdict) is the FIRST thing after the banner. Nothing precedes it.
- **No process narration. Ever.** Never write what you're about to do or why: "Let me confirm…", "Let me verify, not assume", "Now I can answer…", "Let me check…", "then verify it against the code". DO the verification silently (run the tool), then state the verified answer as fact. The user wants the conclusion, not a tour of how you reached it.
- **No answer sandwich.** State the answer ONCE. Do not answer, explain, then re-state the answer. If a verify step sits between question and answer, the answer appears once — after it — not teased before it.
- **No affirmation/qualifier throat-clearing.** Cut "Great question(s)", "You've got it exactly right", "You're right to ask", "Yes to all three" when "all correct" says it, "to be precise / let me confirm each precisely". Affirm by answering, not by praising the question.
- **No honesty theater.** Cut "let me think it through honestly", "now I can give you a precise, honest answer", "here's the honest breakdown", "to be fully transparent". Just give the answer — accuracy is assumed, announcing it is noise.
- **A table replaces its prose, never repeats it.** After a table/grid, do NOT re-explain its rows in sentences. Add only what the table CAN'T carry (the so-what, the one exception). Same for a list: don't summarize the list you just wrote.
- **Ask once.** If you ask via the question tool, do not also restate the same questions in prose ("So, to clarify with you: …"). One channel, one ask.
- **Bullets over paragraphs.** Default to scannable lists. Use a **table/grid** whenever comparing ≥2 items across dimensions — the user finds grids ideal.
- **Bold the keywords** so the eye can skip-scan.
- **Say it once.** Cut hyperbole and filler ("importantly", "it's worth noting", "as you can see", "basically"). No restating the question back.
- **Layman-first.** Plain words; use a precise technical term only when it IS the right word, then gloss it in one short clause.
- **Detail on demand.** Put deep "why / how it works internally" behind a one-line offer ("Want the reasoning?") rather than dumping it inline — unless the user asked why.
- **Keep load-bearing structure:** the dated status banner (first line), any verdict, and explicit warnings stay. Only the *explanatory body* gets tightened.

The litmus test: if a sentence would survive being deleted without the user losing information, delete it. "Yes to all three. You've got it exactly right. Let me confirm each precisely:" → "Your three questions — all correct."

Verbose mode (opt-in, `Output Style: verbose`): full narrative prose, inline rationale, the longer style. Don't apply verbose unless a project requests it.


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


# Git Worktree Location (MANDATORY)

**NEVER create a git worktree inside the project's own folder.** A worktree placed under the project tree pollutes `git status`, risks accidental commits/deletes, and breaks tooling that walks the project directory.

```
WHEN creating a worktree directly (git worktree add, isolation: "worktree", etc.):
  └── Path MUST be:  ~/Worktrees/<project-name>/<branch-or-task>/
        e.g.  /Users/david/Worktrees/GSD-T/fix-context-window-1m
```

- One predictable home for all worktrees: `~/Worktrees/`, namespaced by project name.
- Create `~/Worktrees/<project-name>/` on demand (`mkdir -p`) before `git worktree add`.
- Clean up with `git worktree remove` when the branch/task is done — don't leave prunable stragglers.
- **Exception**: harness-managed worktrees the Agent/Workflow runtime creates under the project's gitignored `.claude/worktrees/` path are the harness's own convention — leave those alone. This rule governs worktrees *you* create directly via Bash or the `isolation: "worktree"` option.

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

The session-start hook output is NOT user-visible — so emit a dated status banner as the **first line of every response** (every turn), above any routing header. Source the date from the most recent `[GSD-T NOW]` signal (live clock; the UserPromptSubmit hook emits it each turn). NEVER use `currentDate`/SessionStart banner (both frozen) or intuition. If `[GSD-T NOW]` is absent, fall back to `currentDate` and flag the gap. Trim seconds in the display (`HH:MM TZ`).

Format by session-start token:
- `[GSD-T]` / none (steady state): `Day: Mon DD, YYYY HH:MM TZ — GSD-T v{version} — CURRENT`
- `[GSD-T AUTO-UPDATE]`: `Day: … — GSD-T v{old} → v{new} ✅ AUTO-UPDATED` + `Changelog: https://github.com/Tekyz-Inc/get-stuff-done-teams/blob/main/CHANGELOG.md`
- `[GSD-T UPDATE]` (auto-update failed): `Day: … — GSD-T v{installed} → v{latest} ⬆️ UPDATE AVAILABLE (auto-update failed)` + `Run: /gsd-t-version-update-all` + changelog link; also repeat at the END of your first response.

## Live Clock Rule (MANDATORY)

Every date/timestamp you write to ANY file (progress.md log, `continue-here-{ts}` filenames, memory, banners, `Date:`/`Updated:` frontmatter, archive headings) MUST come from the live clock: the latest `[GSD-T NOW]`, or `node -e "console.log(new Date().toISOString())"` if absent. Never `currentDate`/frozen banner/intuition.

A PreToolUse hook (`scripts/gsd-t-date-guard.js`) blocks Write/Edit whose timestamps drift >±5 min from the live clock (decision-log lines, filename stamps, banners, labeled `Date:`/`Updated:` stamps, and progress.md table cells); it ignores stamps present in both old/new on Edit, allowlists machine-written paths, and fails open. If blocked, re-read `[GSD-T NOW]`, regenerate, retry — do NOT bypass.

**progress.md timestamp precision (M59+)**: `## Date:`, the Completed-Milestones "Completed" cell, and the Session-Log "Date" cell use `YYYY-MM-DD HH:MM TZ`; forward-only (older date-only rows stay; readers accept both). `archive-meta.json::completedAt` uses `localIsoWithOffset()` from `bin/gsd-t-time-format.cjs` (local-offset ISO), not `toISOString()`.

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

## Playwright / E2E Guards (MANDATORY)

Readiness is enforced by code, not by you — the verify/execute Workflow installs Playwright before any E2E stage when `hasUI && !hasPlaywright`, halting `blocked-needs-human` on failure. You do NOT run a pre-check yourself. Manual: `gsd-t setup-playwright [path]`; `gsd-t doctor` reports `playwright missing`. Internals + the commit-time gate: `.gsd-t/contracts/playwright-bootstrap-contract.md`.

The hard rules (non-negotiable, all projects):
- **No focus-steal.** E2E must never steal keyboard focus or pop visible windows. Headless is the DEFAULT everywhere; visible is opt-in (`HEADED=1`). Never hardcode `headless: false` in a spec/config — decide visibility in ONE env-controlled launch helper. MV3 extensions: use `channel: 'chromium'` + `headless: true` (new headless loads extensions; bare `headless: true` launches the old shell that can't). Template: `templates/test-helpers/launch-extension.ts`. See [[feedback_playwright_no_focus_steal]].
- **Cleanup.** After tests (pass or fail), kill any dev-server/app processes started for them and free the port. Applies to execute, test-sync, verify, quick, wave, debug, complete-milestone, integrate.
- **E2E enforcement.** If `playwright.config.*`/`cypress.config.*` exists, running unit-only is a test FAILURE — run the full E2E suite, every runner, before reporting pass. Report `Unit: X/Y | E2E: X/Y` (or `E2E: N/A`). You always run existing specs; the "if UI changed" conditional governs *writing new* specs only.
- **Functional, not layout.** Every assertion must prove state changed / data flowed / content loaded / widget responded — not mere existence (`isVisible`/`toBeAttached`). If a test would pass on empty HTML with the right IDs and no JS, rewrite it.
- **Test-data cleanup.** Tests that insert data MUST register it via the `withTestData()` fixture so verify Step 4.5 (`gsd-t test-data --purge`) can remove it; an adapter throw/refusal FAILs the gate. Adapters refuse to delete ids lacking the ledger `taggedPrefix`. See [[feedback_test_data_cleanup_convention]] + `.gsd-t/contracts/test-data-ledger-contract.md`.

## Orthogonal Validation Triad (Mandatory)

Every code-producing phase ends with `gsd-t-verify.workflow.js`, which runs three orthogonal validators as `parallel()` `agent()` stages with schema-validated output. Per `.gsd-t/contracts/orthogonal-validation-contract.md` v1.0.0 STABLE, they are declared orthogonal objective functions — no collapse, no substitution, no transitive trust.

- **`/code-review ultra`** — cooperative correctness + cleanup. Severity: `important` / `nit` / `pre-existing`. Skippable via `args.skipUltra=true` + `args.skipUltraReason`. `skipUltra=true` is INELIGIBLE for `VERIFIED`.
- **Red Team** — adversarial / security / boundaries. Non-skippable. Protocol: `templates/prompts/red-team-subagent.md`. Verdict: `FAIL` (any CRITICAL or HIGH bug — blocks completion) or `GRUDGING-PASS` (exhaustive search, nothing found). CRITICAL/HIGH bugs get up to 2 fix cycles before deferral. Runs on `model: "fable"` (M85).
- **QA** — test execution + shallow-test detection + contract compliance. Non-skippable. Protocol: `templates/prompts/qa-subagent.md`. Writes ZERO feature code. Any shallow E2E test blocks phase completion. Runs on `model: "sonnet"`.

When `.gsd-t/contracts/design-contract.md` or `.gsd-t/contracts/design/` exists, a fourth stage runs Design Verification (protocol: `templates/prompts/design-verify-subagent.md`) — opens a browser, compares the build against the design, returns a structured element-by-element MATCH/DEVIATION schema. Deviations block completion.

Synthesis stage merges results without category collapse. Verdict: `VERIFIED` / `VERIFIED-WITH-WARNINGS` / `VERIFY-FAILED`.

## Model Display (MANDATORY)

**Each Workflow `agent()` call declares its model explicitly** via the `model:` option (`"haiku"` / `"sonnet"` / `"opus"` / `"fable"`). The Workflow runtime emits a `⚙ [{model}] {label}` line per stage in `/workflows`, giving the user real-time visibility into which model handles each operation.

**Model assignments:**
- `model: "haiku"` — strictly mechanical tasks: run test suites and report counts, check file existence, validate JSON structure, branch guard checks
- `model: "sonnet"` — mid-tier reasoning: routine code changes, standard refactors, test writing, QA evaluation, straightforward synthesis
- `model: "opus"` — high-stakes reasoning: architecture decisions, security analysis, complex debugging, cross-module refactors, quality judgment on critical paths
- `model: "fable"` — highest-stakes calls where one judgment gates the most downstream spend (M85): solution-space probe, partition probe, competition judge, pre-mortem, Red Team. Competition producers STAY `opus` (M82 blindness invariant — judge must differ from producers). Debug cycle-1 → `opus`, cycle-2 → `fable` (escalation). **Single source of truth for tier assignments:** `bin/gsd-t-model-tier-policy.cjs` + `.gsd-t/contracts/model-tier-policy-contract.md` v1.0.0 STABLE. The M71-family lint (`test/m85-workflow-tier-policy-lint.test.js`) proves every workflow `model:` literal matches the policy and a drifted literal FAILS the lint (mandatory negative test).

**Context budget:** Workflow scripts receive a `budget` global (`budget.total`, `budget.spent()`, `budget.remaining()`) tied to the user's per-turn token target. Use it for dynamic loops (`while (budget.total && budget.remaining() > 50_000) { ... }`) or to scale fleet size. Opus 4.7/4.8 ship 1M context windows; the legacy meter at `bin/token-budget.cjs` was retired in M61 — use native `/context` for live in-session usage.

## GSD-T Workflows (M61+ — v4.0.10+)

Routine actions (milestone → partition → plan → execute → verify → deliver) run from the desktop app via Workflows + Skills — no terminal keystrokes for routine build/debug/deliver. Phase orchestration lives in `templates/workflows/*.workflow.js`; command files are thin invokers calling `Workflow({scriptPath, args})`, where `scriptPath` is resolved to an ABSOLUTE path at invoke time via `gsd-t workflow-path <name>` (a bare relative path silently breaks `Workflow()` outside the source repo).

The deterministic gates each verify-producing Workflow runs (all FAIL-blocking; you don't self-attest them):
- **Preflight** (`bin/cli-preflight.cjs`) — hard-fails on wrong branch / occupied required port.
- **Brief-first** — each `agent()` threads `$BRIEF_PATH` (≤2,500-tok snapshot); workers grep it before re-walking the repo. `.gsd-t/briefs/` gitignored.
- **Verify-gate** (`bin/gsd-t-verify-gate.cjs`) — Track 1 preflight + Track 2 CLI substrate (`tsc`, `biome`/`ruff`, `npm test`, `knip`, `gitleaks`, `scc`/`lizard`); non-zero halts before the triad.
- **M57 CI-parity** (`build-coverage` + `ci-parity`) + **M58 test-data purge** — then the orthogonal triad (see below) → synthesis.
- **Competition (M82/M84, auto)** on partition/milestone/discuss/design-decompose; **Plan hardening (M83)** = traceability-gate + pre-mortem before execute. Contracts: `competition-mode-contract.md`, `plan-hardening-contract.md`.

**Runtime-native invariant (M81):** the Workflow sandbox provides ONLY `agent/parallel/pipeline/log/phase/budget/args`; NO `require`/`fs`/`path`/`child_process`/`process`, and `args` is a JSON STRING. Each workflow `JSON.parse`s `args` and delegates every CLI call to an inline `async` helper running it via an `agent()`'s Bash (project-local `bin/<tool>.cjs` first, else global `gsd-t`). `budget` global (`total`/`spent()`/`remaining()`) drives dynamic loops; use native `/context` for live usage.

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

NEVER commit without this checklist. For each trigger that fired, do the action BEFORE committing — no exceptions.

- **Branch** — `git branch --show-current` must match the project CLAUDE.md "Expected branch". Wrong branch → STOP, do not commit, switch first. No guard set → proceed but warn.
- **API endpoint/response shape changed** → update `.gsd-t/contracts/api-contract.md` + Swagger/OpenAPI spec + verify Swagger URL in CLAUDE.md & README.md.
- **DB schema changed** → `.gsd-t/contracts/schema-contract.md` + `docs/schema.md`.
- **UI component interface changed** → `.gsd-t/contracts/component-contract.md`.
- **New files/dirs** → owning domain's `scope.md`.
- **Requirement implemented/changed** → `docs/requirements.md`.
- **Component or data-flow changed** → `docs/architecture.md`.
- **ANY document/script/code file modified** → timestamped `.gsd-t/progress.md` Decision Log entry (`- YYYY-MM-DD HH:MM: {what} — {result}`); covers every workflow command AND manual edits. Architectural decision → include rationale in that entry.
- **Tech debt found/fixed** → `.gsd-t/techdebt.md`.
- **New pattern for future work** → CLAUDE.md or domain `constraints.md`.
- **Tests added/changed** → test names/paths referenced in requirements.
- **UI/routes/flows changed** → affected E2E specs.
- **Affected tests** → run them, confirm pass.
- New top-level dir / build/CI config: ENFORCED mechanically by `gsd-t-verify` CI-Parity Gate (`build-coverage` + `ci-parity`, FAIL-blocking) — you do NOT self-attest; verify runs the real CI build.

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

### Unproven-Assumption Doctrine (M90 — governed, enforced — supersedes M89 advisory prose)

**Contract:** `.gsd-t/contracts/unproven-assumption-doctrine-contract.md` v1.0.0 STABLE

Never act on an unproven assumption — FACTUAL OR ARCHITECTURAL. Three enforced mechanisms:

**§1 — Factual Classifier (`gsd-t research-gate classify "<claim>"`):**
For every load-bearing claim, tag it:
- **`[KNOWN]`** — verified (repo-internal-evident via grep/Read, or cited this session).
- **`[GUESSED:unknown]`** — you lack the fact outright.
- **`[GUESSED:assumed]`** — you ASSERT a shape / value / behavior you NEVER verified.
- **`[GUESSED:stale]`** — external/time-varying fact that may have changed.

A `[GUESSED:*]` claim is then CLASSIFIED — mechanical string-fact filter, three classes:
- **`class: external`** → research agent (`model: "fable"`) writes a `## Verified Facts (auto-research)` block (URL + fetch date); ENFORCE marker `<!-- auto-research-claim: class=external key=<key> status=uncited -->` is written; verify FAILs if it stays `status=uncited` (R-FAIL-1).
- **`class: internal`** → grep/Read only; escalate to external if grep empty.
- **`class: ambiguous`** → LLM judge (`model: "fable"`) decides; uncertain → research (never guess-internal).

**§2 — Architectural Trigger (`gsd-t architectural-trigger trigger '<JSON>'`):**
Two fire paths — both INSTRUMENTED (fire-rate emitted to `.gsd-t/metrics/arch-trigger-events.jsonl`):
- **R-ARCH-1 (divergence-sampling, competition-arm-only, EXPERIMENTAL+MEASURED):** N fresh-context producer outputs → divergence score → fires on high variance. NEVER claimed to work — measured.
- **R-ARCH-2 (protocol-class, everywhere):** a task whose `**Touches**` lists an EXISTING file → extend-class → trigger fires unconditionally. COMPUTED from real runtime inputs.

If the trigger fires with `provenByAdversaryOnly=true` and it is never resolved, verify FAILs (R-FAIL-2).

**§3 — Loop Ledger (`gsd-t loop-ledger append-cycle/read-exit-state`):**
Debug workflow calls `append-cycle` each iteration. When the SAME computed symptom-signature appears across both cycles (cycle-2 boundary), `read-exit-state` returns `haltedButNoReExamination=true` → workflow exits with **PREMISE_RE_EXAMINATION directive** (option b, not generic needs-human). Verify FAILs if this flag is unresolved (R-FAIL-3).

**§4 — Fail-Closed (verify gates):** R-FAIL-1/2/3 ALWAYS FAIL, never warn-and-proceed. When a mechanism is R1-de-scoped (not wired), the corresponding check is a DOCUMENTED no-op-PASS distinguishable from wired-but-broken.

**SC6 — Conversation-scope directive:** when answering the USER about an external or time-varying fact
(API behavior, library version, pricing, rate limits, current best-practice), verify-or-flag before
asserting. If you lack a fresh source, say so explicitly: *"I believe X, but I do not have a current
source — please verify."* Do NOT state an external/time-varying fact as known when it is a guess.
See memory pointer: `feedback_auto_research_external_gaps`.

### Phase Flow
- Upon completing a phase, automatically proceed to the next phase
- ONLY run Discussion phase if truly required (clear path → skip to Plan)
- ALWAYS self-verify work by running verification commands
- NEVER pause to show verification steps — execute them

### Next Command Hint

When a GSD-T command completes and does NOT auto-advance, end your response with a "Next Up" block (triggers the prompt-suggestion ghost text). Exact format:

```
## ▶ Next Up

**{Phase Name}** — {one-line description}

`/gsd-t-{command}`
```

Add `**Also available:**` with `- /gsd-t-{alt} — {desc}` lines if alternatives make sense. Successor mapping:
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
