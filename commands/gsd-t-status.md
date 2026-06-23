# GSD-T: Status — Cross-Domain Progress View

You are checking the current state of the project across all domains.

## Launch via Subagent

To keep the main conversation context lean, run status via a Task subagent.

**If you are the orchestrating agent** (you received the slash command directly):
Spawn a fresh subagent using the Task tool:
```
subagent_type: general-purpose
model: haiku
prompt: "You are running gsd-t-status. Working directory: {current project root}
Read .gsd-t/progress.md and execute the full status report workflow."
```
Wait for the subagent to complete. Relay its output to the user. **Do not read files yourself.**

**If you are the spawned subagent** (your prompt says "running gsd-t-status"):
Continue below.

## Step 0.0: Date + Version Banner (MANDATORY)

Before anything else, print the current date and GSD-T version so a multi-day-old session is immediately dated when the user reads the output:

```bash
node -e "const{dateStamp}=require('./scripts/gsd-t-update-check.js');const fs=require('fs'),os=require('os'),path=require('path');const v=(()=>{try{return fs.readFileSync(path.join(os.homedir(),'.claude/.gsd-t-version'),'utf8').trim()}catch{return 'unknown'}})();process.stdout.write(dateStamp()+'GSD-T v'+v+' — CURRENT\n')" 2>/dev/null || true
```

Format: `Tue: Mar 26, 2026,  GSD-T v3.19.00 — CURRENT`. Currency claim is best-effort — the canonical authority is the `~/.claude/.gsd-t-update-check` cache consulted by the SessionStart hook; status mode trusts the installed version label.

## Step 0: Headless Read-Back Banner (MANDATORY)

Before reading any files, surface any completed headless sessions the user hasn't seen yet. Run this once at the start of every status invocation:

```bash
node bin/check-headless-sessions.js . 2>/dev/null || true
```

This prints a `## Headless runs since you left` banner listing any completed sessions with their duration, outcome, and log path, then marks them surfaced so the banner never re-appears for the same session. If no completed sessions exist, it prints nothing. The banner appears at the very top of status output — before the main status table.

Contract: `.gsd-t/contracts/headless-default-contract.md` v1.0.0

## Read These Files

1. `.gsd-t/progress.md`
2. `.gsd-t/domains/*/tasks.md` — all domain task lists
3. `.gsd-t/contracts/integration-points.md` — dependency graph

## Report Format

Present a concise status to the user:

```
📊 GSD-T Status: {milestone name}
Phase: {PARTITIONED | DISCUSSED | PLANNED | EXECUTING | INTEGRATED | VERIFIED}
Model Profile: {profile-name} [{(default)} if no per-project config set]

Domains:
  {domain-1}: {completed}/{total} tasks {✅ done | 🔄 in progress | ⏳ blocked}
  {domain-2}: {completed}/{total} tasks {✅ done | 🔄 in progress | ⏳ blocked}
  {domain-3}: {completed}/{total} tasks {✅ done | 🔄 in progress | ⏳ blocked}

Backlog: {N} items
  1. {title} ({type})
  2. {title} ({type})
  3. {title} ({type})

Next checkpoint: {description} — waiting on {domain} Task {N}
Next action: {what should happen next}

Recent decisions:
  - {latest decision from Decision Log}
```

### Active Model Profile Line (M86 — SC(f): no silent degradation)

The **Model Profile** line MUST always name the active profile — never blank, never an implicit fallback.

- Read `.gsd-t/model-profile.json` in the project root. If the file exists and contains a valid `profile` field (`standard` | `pro` | `premium`), display it by name: `Model Profile: pro`.
- If the file is absent, display the global default by name with the `(default)` marker: `Model Profile: premium (default)`.
- If the file is present but malformed or contains an unknown profile, display: `Model Profile: premium (default, config-error)` — never silently promote to the most expensive posture.

Profiles control which workflow stages run on Fable vs. Opus/Sonnet:
- `standard` — zero Fable stages (pre-M85 posture)
- `pro` — Fable on red-team + pre-mortem + debug-cycle-2
- `premium` — all 6 M85 designated Fable stages (full posture, global default)

### Backlog Section

If `.gsd-t/backlog.md` exists, read and parse it. Show total count and top 3 items (position, title, type). If no backlog file exists, skip the Backlog section entirely. If the backlog file exists but is empty (no entries), show `Backlog: No items`.

If there are blockers or issues, highlight them.
If the user provides $ARGUMENTS, focus the status on that specific domain or aspect.

## Token Usage Breakdown

If `.gsd-t/token-log.md` exists, read it and append a token breakdown to the status report.

Parse each row in the table. Handle both old format (9 columns) and extended format (12 columns with Domain, Task, Ctx%). Rows with missing or empty Domain column are assigned domain "(untagged)".

### Token Usage by Domain
Group rows by Domain. For each domain, sum Tokens and collect all Ctx% values (ignoring "N/A" and empty). Display:

```
## Token Usage by Domain
| Domain         | Tokens | Subagents | Peak Ctx% |
|----------------|--------|-----------|-----------|
| auth           | 12,400 | 4         | 14%       |
| notifications  | 45,200 | 3         | 52% ⚠️    |
| (untagged)     | 8,100  | 6         | N/A       |
```

Flag any domain where Peak Ctx% >= 70 with `⚠️` suffix.

### Token Usage by Phase/Command
Group rows by Command. For each command, sum Tokens and count subagent rows. Display:

```
## Token Usage by Command
| Command       | Tokens | Subagents |
|---------------|--------|-----------|
| gsd-t-execute | 86,200 | 14        |
| gsd-t-wave    | 12,400 | 9         |
| gsd-t-plan    | 3,400  | 1         |
```

If token-log.md does not exist or is empty, skip this section entirely (no error).

## Process Health

If `.gsd-t/metrics/rollup.jsonl` exists, read the latest entry and append to the status report:

```
Process Health:
  ELO: {elo_after} ({elo_delta > 0 ? '↑' : '↓'} {elo_delta})
  Quality: {first_pass_rate * 100}% first-pass rate | {total_fix_cycles} fix cycles
```

If `.gsd-t/metrics/task-metrics.jsonl` exists but no rollup.jsonl, compute first_pass_rate directly from task-metrics for the current milestone and display:

```
Process Health:
  Quality: {rate}% first-pass rate (current milestone, no rollup yet)
```

If neither file exists, skip this section entirely.

## Graph Status

If `.gsd-t/graph/meta.json` exists, read it and append to the status report:
```
Graph: {entityCount} entities indexed — last indexed {lastIndexed timestamp}
```
If the graph does not exist, skip this section.

## Harness Health (M31 — if available)

If `bin/component-registry.js` exists, check for flagged components:

Run via Bash:
`node -e "const cr = require('./bin/component-registry.js'); const flagged = cr.getFlaggedComponents('.'); if(flagged.length) { flagged.forEach(c => console.log('⚠️  FLAGGED: ' + c.name + ' — ' + c.reason)); } else { console.log('No flagged components'); }" 2>/dev/null`

If flagged components exist, display them in the report:
```
Flagged Components:
  ⚠️  {component-name} — {reason}
```

If `bin/component-registry.js` does not exist, skip this section entirely.

## Version Check

After displaying the project status, check for GSD-T updates:

1. Read `~/.claude/.gsd-t-version` to get the installed version
2. Read `~/.claude/.gsd-t-update-check` (JSON with `latest` and `timestamp` fields) to get the latest known version
3. If the file doesn't exist or is unreadable, run `gsd-t status` (CLI) in the background to trigger a cache refresh, and skip the notice
4. If `latest` is newer than the installed version, append to the report:

```
⬆️  GSD-T update available: {installed} → {latest}
   Run: npm update -g @tekyzinc/gsd-t && gsd-t update-all
```

5. If versions match, skip — don't show anything

## Global ELO & Cross-Project Rankings

After the Process Health section, check for global metrics:

1. Run via Bash:
   ```bash
   node -e "const g = require('./bin/global-sync-manager.js'); const name = (() => { try { return require('./package.json').name; } catch { return require('path').basename(process.cwd()); } })(); const elo = g.getGlobalELO(name); const ranks = g.getProjectRankings(); console.log(JSON.stringify({ elo, ranks, name }));" 2>/dev/null
   ```

2. If the result returns `elo: null` or the command fails: display "No global metrics yet" and skip.

3. If global ELO data exists, display:
   ```
   Global ELO: {elo} (rank #{position} of {total} projects)
   ```
   Where position is the 1-based index of the current project in the rankings array.

4. If 2+ projects have global rollup data, display the top 5 rankings:
   ```
   ## Cross-Project Rankings (Top 5)
   | Rank | Project          | ELO    | Latest Milestone |
   |------|------------------|--------|------------------|
   | 1    | {project}        | {elo}  | {milestone}      |
   ```

$ARGUMENTS

## Auto-Clear

All work is committed to project files. Execute `/clear` to free the context window for the next command.
