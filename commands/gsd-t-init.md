# GSD-T: Init — Initialize Project

You are setting up a new project (or converting an existing one) to use the GSD-T contract-driven workflow.

## Step 0: Project Directory + Git + GitHub (new projects only)

If `$ARGUMENTS` contains a project name AND the current directory is NOT already a project directory (no `package.json`, `pyproject.toml`, `Cargo.toml`, `src/`, or `CLAUDE.md`), this is a NEW project. Set it up from scratch:

### 0a. Resolve the base projects directory

Check `~/.claude/.gsd-t-config` for settings:
```
# ~/.claude/.gsd-t-config format (one key=value per line):
projects_dir=/Users/username/projects
github_org=MyOrg
```

- If `projects_dir` is set → use that path
- If not → ask user: "Where should new projects be created? (e.g., /Users/you/projects)"
  - Save their answer to `~/.claude/.gsd-t-config` as `projects_dir={path}` so they're never asked again

### 0b. Create the project directory

```bash
mkdir -p {projects_dir}/{project-name}
cd {projects_dir}/{project-name}
```

If the directory already exists and has files → treat as an existing project, skip to Step 1.

### 0c. Initialize git

```bash
git init
git checkout -b main
```

### 0d. Create GitHub repo

Check if `gh` CLI is available and authenticated:
```bash
gh auth status
```

- If `gh` is available and authenticated:
  - Check `~/.claude/.gsd-t-config` for `github_org` setting
  - If `github_org` is set:
    ```bash
    gh repo create {github_org}/{project-name} --private --source=. --push
    ```
    Log: "Created GitHub repo: {github_org}/{project-name} (private)"
  - If `github_org` is NOT set (personal repos):
    ```bash
    gh repo create {project-name} --private --source=. --push
    ```
    Log: "Created GitHub repo: {user}/{project-name} (private)"
- If `gh` is not available or not authenticated:
  Log: "GitHub CLI not available — skipping repo creation. Create manually and run: `git remote add origin {url}`"

### 0e. Continue with init

All subsequent steps run from inside `{projects_dir}/{project-name}`.

**Skip Step 0 entirely if:**
- No project name in `$ARGUMENTS`, OR
- Current directory already looks like a project (has code/config files), OR
- Current directory is already inside a git repo with files

## Step 1: Assess Current State

Check what exists:
- `CLAUDE.md` — project instructions?
- `.gsd-t/` — already initialized?
- `.gsd/` — legacy GSD structure?
- `docs/` — existing documentation?
- `src/` — existing code?

### If `.gsd-t/` already exists:
Report current state and ask if user wants to reset or continue.

### If `.gsd/` exists (legacy GSD):
Offer to migrate: "Found legacy GSD structure. Want me to migrate to GSD-T?"
If yes, read `.gsd/` state and create equivalent `.gsd-t/` structure.

## Step 2: Copy Local Settings

1. **Ensure `~/.claude/settings.local` exists**:
   - If it does NOT exist, create it now with these default permissions:
     ```json
     {
       "permissions": {
         "allow": [
           "Edit",
           "Write",
           "Bash",
           "Read",
           "WebSearch",
           "WebFetch",
           "Skill"
         ]
       },
       "outputStyle": "default"
     }
     ```
     After creating it, log: "Created ~/.claude/settings.local with default permissions — update the allow list to match your security preferences."

## Step 3: Create Directory Structure

```
.gsd-t/
├── contracts/
│   └── .gitkeep
├── domains/
│   └── .gitkeep
├── stacks/
│   └── README.md
├── events/
├── backlog.md
├── backlog-settings.md
├── progress.md
├── token-log.md
└── qa-issues.md
```

Create `.gsd-t/stacks/` directory with a `README.md` explaining the override mechanism:
- This folder holds project-specific overrides of global stack rule files
- If a file with the same name as a global stack file exists here, it replaces the global version
- Folder stays empty until the developer explicitly adds overrides

Create `.gsd-t/events/` directory (empty — populated at runtime by heartbeat and event writer).

Create `token-log.md` with header row:
```
| Date | Command | Step | Model | Duration(s) | Notes |
|------|---------|------|-------|-------------|-------|
```

Create `qa-issues.md` with header row:
```
| Date | Command | Step | Model | Duration(s) | Severity | Finding |
|------|---------|------|-------|-------------|----------|---------|
```

## Step 4: Initialize Backlog

Create the backlog files from templates:
1. Copy `templates/backlog.md` → `.gsd-t/backlog.md`
2. Copy `templates/backlog-settings.md` → `.gsd-t/backlog-settings.md`

### Category Derivation

Read the project's `CLAUDE.md` (if it exists) to auto-populate backlog settings:

1. **Apps**: Scan for app names, service names, or product names (look for headings, "Tech Stack" sections, or named components). Populate the `## Apps` section in `backlog-settings.md` with discovered names (lowercase).
2. **Categories**: Scan for domain concepts, module names, and technical areas (e.g., "authentication", "payments", "api", "database"). Populate the `## Categories` section.
3. **Default App**: Set `**Default App:**` to the most prominent app found (the one mentioned most, or the first one). If only one app is found, use it.
4. **If nothing found**: Leave the placeholder values from the template — the user can configure later via `/gsd-t-backlog-settings`.

## Step 5: Initialize Progress File

### Version Detection

Before creating the progress file, determine the starting version:

1. **Check for an existing version** in the project's manifest file (in this priority order):
   - `package.json` → `version` field
   - `pyproject.toml` → `[project] version` or `[tool.poetry] version`
   - `Cargo.toml` → `[package] version`
   - `setup.py` → `version=` argument
   - `build.gradle` / `build.gradle.kts` → `version = `
   - `.version` file → contents as-is
2. **If a version is found**: Use it as the starting GSD-T version (the project already has its own versioning history).
3. **If no version is found**: Use `0.1.00` — the standard GSD-T starting point for a brand-new project with no prior releases. The first `gsd-t-complete-milestone` will reset the patch to `0.1.10` (or bump minor/major per milestone scope).

Create `.gsd-t/progress.md`:

```markdown
# GSD-T Progress

## Project: {name from CLAUDE.md or $ARGUMENTS}
## Version: {detected version, or 0.1.00}
## Status: INITIALIZED
## Date: {today YYYY-MM-DD HH:MM TZ — source from the live `[GSD-T NOW]` signal; never date-only}

## Milestones
| # | Milestone | Status | Domains |
|---|-----------|--------|---------|
| 1 | {TBD} | not started | TBD |

## Domains
(populated during partition phase)

## Contracts
(populated during partition phase)

## Integration Checkpoints
(populated during plan phase)

## Decision Log
- {date}: Project initialized with GSD-T workflow
```

## Step 6: Ensure CLAUDE.md Exists

If no `CLAUDE.md`:
Create a starter template:

```markdown
# {Project Name}

## Overview
{Brief project description — fill this in}

## Tech Stack
{Languages, frameworks, services — fill this in}

## Documentation
- Requirements: docs/requirements.md
- Architecture: docs/architecture.md
- Workflows: docs/workflows.md
- Infrastructure: docs/infrastructure.md

## Autonomy Level
**Level 3 — Full Auto** (only pause for blockers or completion)

## Branch Guard
**Expected branch**: {current branch from `git branch --show-current`}

## Conventions
- {Coding style, naming patterns — fill this in}

## Workflow Preferences
<!-- Override global defaults. Delete what you don't need to override. -->

## GSD-T Workflow
This project uses contract-driven development.
- State: .gsd-t/progress.md
- Contracts: .gsd-t/contracts/
- Domains: .gsd-t/domains/
```

If `CLAUDE.md` exists but doesn't reference GSD-T, append the GSD-T section.

## Step 6.5: Set Quality North Star

Detect the project type and offer a quality persona preset. This writes a `## Quality North Star` section to `CLAUDE.md` so subagents have a quality lens at execute time.

**Skip this step if `CLAUDE.md` already contains `## Quality North Star`.**

### Auto-detect project type

Read `package.json` (if it exists) and apply the first matching rule:

| Signal | Suggested preset |
|--------|-----------------|
| `"bin"` field present | `cli` |
| `"react"`, `"next"`, or `"vue"` in `dependencies` or `devDependencies` | `web-app` |
| `"main"` field present AND no `"scripts.dev"` field | `library` |
| No strong signal | prompt user to choose |

### Preset text

| Preset ID | Text to write |
|-----------|---------------|
| `library` | `This is a published npm library. Every public API must be intuitive, well-documented, and backward-compatible. Type safety and zero-dependency design are non-negotiable.` |
| `web-app` | `This is a user-facing web application. Every feature must be accessible, performant, and visually consistent. The user experience is the product.` |
| `cli` | `This is a developer CLI tool. Every command must be fast, predictable, and produce clear output. Error messages must explain what went wrong and how to fix it.` |
| `custom` | Ask user for a 1–3 sentence description of what "excellent" means for this project. |

### Write to CLAUDE.md

Append (or insert before `## GSD-T Workflow` if present):

```markdown
## Quality North Star

{selected preset text or user-provided custom text}
```

If no `package.json` is found and this is a non-JS project, prompt the user to choose a preset or provide custom text.

Log in `.gsd-t/progress.md` Decision Log: `- {date}: Quality North Star set — preset: {preset-id}`

## Step 7: Create docs/ if Needed

If no `docs/` directory, create it with all 4 living document templates.
For each file, skip if it already exists:

```
docs/
├── requirements.md    — Functional, technical, and non-functional requirements
├── architecture.md    — System design, components, data flow, design decisions
├── workflows.md       — User journeys, technical processes, API flows
└── infrastructure.md  — Dev setup, DB commands, cloud provisioning, deployment, credentials
```

These are the living documents that persist across milestones and keep institutional knowledge alive. The `infrastructure.md` is especially important — it captures the exact commands for provisioning cloud resources, setting up databases, managing secrets, and deploying, so this knowledge doesn't get lost between sessions.

## Step 8: Ensure README.md Exists

If no `README.md` exists, create one with:
- Project name and brief description
- Tech stack summary
- Getting started / setup instructions (from existing configs or placeholder)
- Link to `docs/` for detailed documentation

If `README.md` exists, leave it as-is — don't overwrite user content during init.

## Step 9: Map Existing Codebase (if code exists)

If there's existing source code:
1. Scan the codebase structure
2. Identify natural domain boundaries based on file organization
3. Note existing patterns and conventions
4. Add findings to CLAUDE.md
5. Log in progress.md: "Existing codebase analyzed — {summary}"

## Step 10: Document Ripple

After initialization, verify all created documentation is consistent:

### Always update:
1. **`.gsd-t/progress.md`** — Already created in Step 3, verify it's complete
2. **`CLAUDE.md`** — Already handled in Step 4, verify GSD-T section is present and references all docs

### Check if affected:
3. **`docs/requirements.md`** — If existing code was scanned (Step 7), verify requirements doc reflects discovered functionality
4. **`docs/architecture.md`** — If existing code was scanned, verify architecture doc reflects the actual system structure
5. **`README.md`** — Already handled in Step 6, verify it links to docs/ and reflects project state

### Skip what's not affected — init creates docs, so most ripple is about consistency verification.

## Step 11: Playwright Setup (MANDATORY)

M50: this step is now executable code, not prose. The `bin/gsd-t.js init` flow calls `installPlaywright(projectDir)` from `bin/playwright-bootstrap.cjs` automatically when `hasUI(projectDir) && !hasPlaywright(projectDir)`. See `.gsd-t/contracts/playwright-bootstrap-contract.md`.

The installer:
1. Detects the package manager via `detectPackageManager(projectDir)` (`pnpm-lock.yaml` → `pnpm`; `yarn.lock` → `yarn`; `bun.lockb` → `bun`; default `npm`).
2. Installs `@playwright/test` as a devDependency + `npx playwright install chromium`.
3. Writes `playwright.config.ts` (testDir `./e2e`, chromium project) idempotently — does NOT overwrite an existing config.
4. Creates `e2e/__placeholder.spec.ts` (empty `test.skip`) when `e2e/` is absent or empty.

Fallback (when not running through `bin/gsd-t.js init`):
- bun: `bun add -d @playwright/test && bunx playwright install chromium`
- npm: `npm install -D @playwright/test && npx playwright install chromium`
- yarn: `yarn add -D @playwright/test && yarn playwright install chromium`
- pnpm: `pnpm add -D @playwright/test && pnpm exec playwright install chromium`

Operator overrides: `gsd-t setup-playwright [path]` (explicit single-project install) or `gsd-t doctor --install-playwright`.

The spawn-time gate in `bin/headless-auto-spawn.cjs` re-runs the install on first need if the project skipped this step (e.g., older project that pre-dates M50).

## Step 11.5: Logging Backend Scaffold (M100)

The `bin/gsd-t.js init` flow calls `runLoggingScaffoldStep(projectDir)` (from `bin/gsd-t-logging-scaffolder.cjs`) automatically, right before the init tree summary. This is the sole init-scaffold seam for M100's trace/audit logging.

- It detects the stack (has-DB → `db-table` alternative; no-server/desktop → `local-sqlite` | `local-jsonl`, with SQLite flagged over flat-file for audit queryability).
- It **presents real alternatives and PAUSES for human approval** — this is the ONE sanctioned pause against the Level-3 full-auto default (see `.gsd-t/contracts/logging-scaffold-seam-contract.md`). It never silently picks a backend.
- On re-run with a previously-approved choice, it resumes deterministically (no re-prompt) and records the backend into the project's `CLAUDE.md`.
- If it halts with `status:"PAUSED"`, report the presented alternatives to the user and wait for them to choose before re-running init with an approved backend — do NOT guess or auto-select on their behalf.

See `.gsd-t/contracts/logging-scaffold-seam-contract.md` for the full seam envelope shape consumed by d2 (trace), d4 (audit), and d5 (migrate-logging).

## Step 12: Test Verification

After initialization:

1. **If existing code with tests**: Run the full test suite to establish a baseline. Document results in `.gsd-t/progress.md`
2. **If existing code without tests**: Playwright is now set up (Step 7.6) — note unit test framework should be added as part of the first milestone
3. **If greenfield**: Playwright is ready. Note that unit test infrastructure should be added in Milestone 1
4. **Verify init outputs**: Confirm all created files exist and are non-empty

## Step 13: Report

Tell the user:
1. What was created (including backlog files: `.gsd-t/backlog.md` and `.gsd-t/backlog-settings.md`)
2. What they should fill in (CLAUDE.md details, requirements)
3. Backlog settings status: whether apps/categories were auto-derived from CLAUDE.md or need manual configuration via `/gsd-t-backlog-settings`
4. Recommended next step:
   - New project: "Define your milestone, then run /gsd-t-partition"
   - Existing code: "I've mapped the codebase. Ready for /gsd-t-partition {milestone}"

$ARGUMENTS

## Auto-Clear

All work is committed to project files. Execute `/clear` to free the context window for the next command.
