# GSD-T: Init-Scan-Setup — Full Project Onboarding

One command to fully onboard a project into GSD-T. Combines project directory setup, git setup, `gsd-t-init`, `gsd-t-scan`, and `gsd-t-setup` into a single orchestrated flow.

Can be run from anywhere — does not require being in the project folder first.

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

**If `.gsd-t/` already exists**: Skip init — it's already done. Log and continue to scan. Still check and create settings.local (step 5) even if init is skipped.

## Step 3.5: Graph Indexing Note

If the project has source code, graph indexing (`.gsd-t/graph/`) will run as part of the scan phase (Step 4). The graph provides code-level queries (callers, callees, domain ownership, dead code detection) that enhance all subsequent GSD-T commands. No separate setup is needed — the scan handles it.

## Step 4: Deep Codebase Scan (gsd-t-scan)

Execute the full scan by invoking the volume-scaled scan Workflow (same as `/gsd-t-scan` — `templates/workflows/gsd-t-scan.workflow.js`):

1. The volume-probe slices the codebase by area (scaling with volume, not a fixed dimension set); per-slice deep finders enumerate; a single verify pass drops false positives.
2. Synthesis builds the `.gsd-t/techdebt.md` register and the `.gsd-t/scan/*.md` analysis files.
3. Cross-populate findings into living documents (docs/architecture.md, docs/workflows.md, docs/infrastructure.md, docs/requirements.md) from the register + analysis files.
4. Update README.md with discovered tech stack and setup info.

The Workflow's fan-out scales with codebase volume automatically — no team-mode toggle.

**If `.gsd-t/techdebt.md` already exists**: the Workflow archives it to `.gsd-t/techdebt_YYYY-MM-DD.md` and continues TD numbering.

## Step 5: Generate Project CLAUDE.md (gsd-t-setup)

Execute the full setup workflow (same as `/gsd-t-setup`):

1. Read global `~/.claude/CLAUDE.md` to understand what's already covered
2. Use scan findings + auto-detection to populate project-specific sections
3. Remove any global duplicates from the project CLAUDE.md
4. Generate and write the optimized CLAUDE.md

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

Next steps:
  → Review .gsd-t/techdebt.md for critical items
  → /gsd-t-milestone to define your first milestone
  → /gsd-t-wave to run a full development cycle
```

### Autonomy Behavior

**Level 3 (Full Auto)**: Run all steps without pausing. Only stop if git remote is needed (requires user input) or if a scan reveals critical security blockers.

**Level 1-2**: Pause after each major step (init, scan, setup) for user review before continuing.

$ARGUMENTS

## Auto-Clear

All work is committed to project files. Execute `/clear` to free the context window for the next command.
