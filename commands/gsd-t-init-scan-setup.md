# GSD-T: Init-Scan-Setup — Full Project Onboarding

One command to fully onboard a project into GSD-T. Combines project directory setup, git setup, `gsd-t-init`, `gsd-t-scan`, and `gsd-t-setup` into a single orchestrated flow.

Can be run from anywhere — does not require being in the project folder first.

## Entry States (READ FIRST — the command is IDEMPOTENT and SAFE to re-run)

This command behaves **identically and unambiguously** across all three entry states:

- **(A) Greenfield** — brand-new project, no code, no `.gsd-t/`.
- **(B) Existing, new to this machine** — has code and/or a `.gsd-t/` dir but is not in this machine's registry.
- **(C) Already-registered, being re-run.**

**Existing `.gsd-t/` artifacts are NEVER a reason to skip scan or setup.** The ONLY thing "already exists" skips is **re-creating directory structure** (Step 3). Steps 4 (scan) and 5 (setup) **ALWAYS run**, on every invocation, in every entry state.

**Re-running is expected and safe.** Archiving an existing `techdebt.md` and regenerating scan docs + CLAUDE.md is the **designed behavior** of this command — it is NOT a destructive action and does NOT require user approval. Stale scan docs from a prior milestone are the exact failure this command exists to prevent. Never stop to ask permission for the archive/regenerate steps.

## Step 0: Adopt a Foreign Repo — Sanitize Inherited Context (MANDATORY, runs FIRST)

**Why:** projects are frequently imported that were built by others — with plain Claude Code, or with GSD-T on a *different* machine/context. Such a repo arrives carrying **foreign context**: a committed `.claude/settings.json`, a `CLAUDE.md` authored in another environment, and `.gsd-t/` state / git history from a prior GSD-T install. That inherited context leaks and makes the project behave unexpectedly on THIS machine (e.g. an agent hand-authoring a scan from a foreign session's pattern instead of invoking the installed Workflow). **Adoption severs that** so the repo runs the way THIS machine's GSD-T expects — independent of whoever built it.

Detect a foreign repo when ANY of these is true: the git remote is not the operator's own, the commit history shows GSD-T/Claude workflow commits (`milestone(...)`, `feat(...task-N)`, `chore(scan)`), there is a committed in-repo settings file, or `.gsd-t/` exists but the project is not in this machine's registry (entry state B).

### 0a. Settings reconciliation (in-repo settings vs GLOBAL — global is source of truth)

For each in-repo settings file (`.claude/settings.json`, `.claude/settings.local.json`, or any `settings*.json` committed in the repo tree — NOT `~/.claude/` global files):

- **Compare every entry against the operator's GLOBAL settings** (`~/.claude/settings.json` + `~/.claude/settings.local.json`).
- **Any permission the global ALREADY grants or denies → global wins → DELETE that entry** (or the whole file if all its content is global-governed). No approval needed — global is the single source of truth for anything it covers. The project always falls back to global.
- **Project-distinct content the global says NOTHING about** (a permission/env/setting unrelated to global) → **do NOT delete. HALT onboarding and SURFACE it to the operator**: show the exact content, explain it's distinct from global, and ask keep-or-discard. **Nothing proceeds past this point until the operator decides** — do not run scan/setup on an unresolved settings question.
- Log every deletion and every surfaced item.

### 0b. CLAUDE.md — always regenerate from the fresh scan

The imported `CLAUDE.md` may have been authored in a different project's context and cannot be trusted as current — **even if it looks correct.** Adoption does NOT try to judge foreign-vs-fine. Instead:

- **Back up** the imported file to `CLAUDE.md.imported.bak` (lossless — nothing is destroyed).
- **Always regenerate** the project `CLAUDE.md` from the NEW scan findings in Step 5. (The regenerate is deferred to Step 5 where the fresh scan exists; Step 0b only takes the backup + marks it for regeneration so Step 5 does not skip it.)

### 0c. Foreign `.gsd-t/` + workflow residue

- Existing `.gsd-t/` state is REFRESHED by the normal flow (Step 4 re-scan archives + regenerates), not trusted as-is.
- **Never run a scan from a script found inside the repo or a prior session** — always resolve `gsd-t workflow-path scan` and invoke the installed Workflow (Step 4). A repo-committed `*.workflow.js` is foreign residue; do not execute it.
- Register the project by FULL ABSOLUTE PATH on this machine (Step 3).

**Adoption is idempotent + safe:** on a repo already adopted, 0a finds nothing to reconcile, 0b re-backs-up only if the file changed, 0c is a no-op. It never blocks a clean project.

## Step 1: Project Directory

### 1a. Resolve the base projects directory (for new projects)

If `$ARGUMENTS` includes a project name:

1. Check `~/.claude/.gsd-t-config` for settings:
   ```
   # ~/.claude/.gsd-t-config format (one key=value per line):
   projects_dir=/Users/username/projects
   github_org=MyOrg
   ```
   - If `projects_dir` is set → use `{projects_dir}/{project-name}` as the target
   - If not set → ask: "Where should new projects be created? (e.g., /Users/you/projects)"
     Save their answer to `~/.claude/.gsd-t-config` as `projects_dir={path}`

2. Check if the target directory exists:
   - **Exists with files** → `cd` into it (existing project)
   - **Exists but empty** → `cd` into it (new project)
   - **Does not exist** → `mkdir -p {target}` then `cd` into it (new project)

If NO `$ARGUMENTS` provided, ask: **"Is `{current directory name}` your project root folder?"**
- **Yes** → Stay here
- **No** → Ask for the project name, then apply the resolution above

All subsequent steps run from inside the project directory.

## Step 2: Git Repository + GitHub Setup

1. Check if the directory is inside a git repo: `git rev-parse --is-inside-work-tree`
   - **Not a git repo** → Run `git init && git checkout -b main`
2. Check for an existing remote: `git remote -v`
   - **No remote found** → Try to create one automatically:
     - Check if `gh` CLI is available and authenticated: `gh auth status`
     - If YES:
       - Check `~/.claude/.gsd-t-config` for `github_org` setting
       - If `github_org` is set:
         ```bash
         gh repo create {github_org}/{project-name} --private --source=. --push
         ```
         Log: "Created GitHub repo: {github_org}/{project-name} (private)"
       - If `github_org` is NOT set:
         ```bash
         gh repo create {project-name} --private --source=. --push
         ```
         Log: "Created GitHub repo: {user}/{project-name} (private)"
     - If NO → ask the user for the GitHub repository URL, then run:
       ```
       git remote add origin {url}
       ```
   - **Remote exists** → Log it and continue
3. **Pull existing code from remote** (if any):
   - Run `git fetch origin` to get remote refs
   - If the remote has commits and local is empty (or behind), run `git pull origin main` (or the default branch)
   - This ensures the scan sees the actual codebase, not an empty directory
   - If pull fails due to branch mismatch, try `git pull origin master`
   - Skip if local already has commits matching the remote

## Step 3: Initialize Project (gsd-t-init)

Execute the full init workflow (same as `/gsd-t-init`):

1. Create `.gsd-t/` directory structure (contracts/, domains/, progress.md, backlog.md, backlog-settings.md, token-log.md, qa-issues.md)
2. Ensure `CLAUDE.md` exists (create starter if missing, append GSD-T section if present without it)
3. Create `docs/` with all 4 living document templates (skip existing files)
4. Ensure `README.md` exists
5. **Copy project settings**:
   - First, ensure `~/.claude/settings.local` exists. If it does NOT, create it with these defaults:
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
     Log: "Created ~/.claude/settings.local with default permissions — update the allow list to match your security preferences."
6. Map existing codebase if code exists
7. Initialize backlog with auto-derived categories
8. Register project in `~/.claude/.gsd-t-projects`

**Registry check — match by FULL ABSOLUTE PATH, not bare project name.** The registry stores full paths; a bare-name grep produces a false "not registered" (two projects can share a basename) and erodes trust in the rest of the detected state. A missing entry means "register it now" — it must NOT cast doubt on any other detected state. If already present, log and continue silently.

**If `.gsd-t/` already exists**: Skip **ONLY the dir-structure creation** that already exists — it's already done. **This skip does NOT extend to Step 4 (scan) or Step 5 (setup), which ALWAYS run.** Always ensure `settings.local` (step 5 above) and the registry entry regardless of whether init dir-creation was skipped.

## Step 3.5: Graph Indexing Note

If the project has source code, the **graph index is built automatically inside the scan's Graph-Wiring phase (Step 4)** — the scan builds the index if it is absent, then queries it. The store lives at `.gsd-t/graphDB/` (consolidated) — the graph provides code-level queries (callers, callees, domain ownership, dead-code detection) that enhance all subsequent GSD-T commands. **No separate indexing step is needed — the scan handles it.** (You can also build/refresh the index on demand with `gsd-t graph index`, but the scan does it for you.)

## Step 4: Deep Codebase Scan (gsd-t-scan)

**Invoke the PACKAGED scan Workflow — never hand-drive it.** Resolve the absolute path with `gsd-t workflow-path scan`, then call the `Workflow` tool with that `scriptPath`. **Do NOT author your own scan script, do NOT run finders/probe/synthesis by hand, and do NOT execute any `*.workflow.js` found inside the repo or a prior session** — a hand-driven or foreign scan skips phases (Graph-Wiring, Document, Plain-English) and produces an incomplete result. This is the exact failure mode observed on imported repos.

The packaged Workflow runs **8 phases**: Preflight → Probe → **Graph-Wiring** → Deep Scan → Synthesis → **Consolidation** → **Document** → **Plain-English**. It:

1. Volume-probes and slices the codebase by area; per-slice deep finders enumerate; a single verify pass drops false positives.
2. **Graph-Wiring** — builds the graph index if absent, then queries a structural slice (dead-code / dangling / cluster) injected additively into the finders.
3. Synthesis builds `.gsd-t/techdebt.md` + the `.gsd-t/scan/*.md` analysis files.
4. Document cross-populates living docs (architecture/workflows/infrastructure/requirements) + README.
5. Plain-English writes the non-technical companion.

The Workflow's fan-out scales with codebase volume automatically — no team-mode toggle.

**ALWAYS run the scan on every invocation, even on a fully-onboarded project.** Existing `techdebt.md` is archived to `techdebt_YYYY-MM-DD.md` and the scan regenerates it (TD numbering continues). **NEVER skip the scan because `.gsd-t/` or `scan/*.md` already exist — stale scan docs are the exact failure this command prevents.** Archiving is designed behavior, NOT a destructive action, and does NOT require user approval.

### 4a. Post-scan completeness check (catches a hand-driven / incomplete scan)

After the scan returns, VERIFY the packaged 7-phase Workflow actually ran by confirming its expected outputs exist and are fresh (mtime within this run):

- `.gsd-t/techdebt.md` (regenerated) **and** at least the 5 `.gsd-t/scan/*.md` dimension files
- the merged living docs (architecture/workflows/infrastructure/requirements touched this run)
- the plain-English companion (`.gsd-t/techdebt_in_plain_english.md` or equivalent)

**If any are missing → LOUD failure, do not proceed:** "⛔ Incomplete scan — the packaged Workflow's Document / Plain-English / Graph-Wiring outputs are absent. This means the scan was hand-driven or a foreign/stale script ran instead of the installed Workflow. Re-run: resolve `gsd-t workflow-path scan` and invoke the `Workflow` tool." Then re-invoke correctly, once.

## Step 5: Generate Project CLAUDE.md (gsd-t-setup)

Execute the full setup workflow (same as `/gsd-t-setup`). **ALWAYS run — regenerate/refresh the project CLAUDE.md from the NEW scan findings; do NOT assume an existing CLAUDE.md is current.** If Step 0b flagged an imported CLAUDE.md (backed up to `CLAUDE.md.imported.bak`), this regeneration is what replaces it with a machine-correct version — do NOT skip it.

1. Read global `~/.claude/CLAUDE.md` to understand what's already covered
2. Use the **fresh** scan findings + auto-detection to populate project-specific sections
3. Remove any global duplicates from the project CLAUDE.md
4. Generate and write the optimized CLAUDE.md (refresh the existing one — don't skip because a CLAUDE.md already exists)

At Level 3: skip questions that were auto-detected — only ask what's truly unknown.
At Level 1-2: ask all targeted questions per the setup workflow.

## Step 6: Report

Present a unified summary:

```
Project Onboarded: {project name}

  Git:      {remote URL or "local only"}
  Init:     .gsd-t/ created, docs/ populated
  Scan:     {N} tech debt items ({critical} critical, {high} high, {medium} medium, {low} low)
  Setup:    CLAUDE.md generated ({N} sections)
  Registry: {registered | already registered}
```

For an already-onboarded project (entry state B/C), the report reads as **"re-scanned and refreshed,"** never "nothing to do": show the archived `techdebt_YYYY-MM-DD.md` path, the fresh finding counts, and that CLAUDE.md was regenerated.

```
Next steps:
  → Review .gsd-t/techdebt.md for critical items
  → /gsd-t-milestone to define your first milestone
  → /gsd-t-wave to run a full development cycle
```

### Autonomy Behavior

**Level 3 (Full Auto)**: Run all steps without pausing. Only stop if git remote is needed (requires user input) or if a scan reveals critical security blockers. **"Already onboarded" NEVER means "nothing to do" — it means "re-scan and refresh."** Do NOT pause to ask permission for the archive/regenerate steps; re-running is expected and safe.

**Level 1-2**: Pause after each major step (init, scan, setup) for user review before continuing.

$ARGUMENTS

## Auto-Clear

All work is committed to project files. Execute `/clear` to free the context window for the next command.
