# GSD-T: Complete Milestone — Archive and Tag Release

You are finalizing a completed milestone. Your job is to archive the milestone documentation, create a git tag, and prepare for the next milestone.

This command is:
- **Auto-invoked** by `/gsd-t-verify` (Step 8) after all quality gates pass — at ALL autonomy levels
- **Auto-invoked** by `/gsd-t-wave` as part of the VERIFY+COMPLETE phase
- **Standalone** when user wants to manually close a milestone

## Step 1: Verify Completion

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-complete-milestone --step 1 --step-label "Verify Completion" 2>/dev/null || true
```

Read:
1. `.gsd-t/progress.md` — confirm status is VERIFIED
2. `.gsd-t/verify-report.md` — confirm all checks passed

If status is not VERIFIED:
"⚠️ Milestone not yet verified. Run `/gsd-t-verify` first, or use `--force` to complete anyway."

If `--force` flag provided, proceed with warning in archive.

## Step 1.25: Graph-Enhanced Completion Check

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-complete-milestone --step 1 --step-label ".25: Graph-Enhanced Completion Check" 2>/dev/null || true
```

If `.gsd-t/graph/meta.json` exists (graph index is available):
1. Query `getEntitiesByDomain` to validate all planned entities were implemented — compare against domain task lists
2. Query `findDeadCode` to flag unreachable implementations that may indicate incomplete wiring or orphaned code
3. If missing entities or significant dead code found, block completion and report gaps

If graph is not available, skip this step.

## Step 1.5: Smoke Test Artifact Gate (MANDATORY — Categories 2 and 7)

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-complete-milestone --step 1 --step-label ".5: Smoke Test Artifact Gate (MANDATORY — Categories 2 and 7)" 2>/dev/null || true
```

Before archiving, verify that high-risk features have testable artifacts. This gate catches what code review and unit tests cannot.

**Scan this milestone's domains for any of the following:**
- Audio capture/playback, speech recognition/synthesis
- GPU/WebGPU/WebGL compute or rendering
- ML inference, model loading, quantized model execution
- Background workers, service workers, IPC channels
- Native APIs (camera, bluetooth, filesystem, microphone)
- WebAssembly modules
- Any feature whose only prior "test" was manual user interaction

**For each high-risk feature found:**

1. Check that a smoke test script exists (in `scripts/`, `tests/`, or `.gsd-t/smoke-tests/`)
2. Check that the script was run and passed (evidence in token-log.md, CI output, or a `.gsd-t/smoke-tests/{feature}.md` file with run results)
3. If manual steps remain unavoidable: `.gsd-t/smoke-tests/{feature}.md` must exist documenting exact steps and confirming they passed

**If any high-risk feature lacks a smoke test artifact → BLOCK completion.**
Do not proceed to archiving. Create the smoke test now, run it, confirm it passes, then continue.

> This gate exists because complete-milestone is the last opportunity to catch "shipped blind" features before they become user-facing bugs requiring 15 debug sessions to resolve.

## Step 1.75: Goal-Backward Verification Gate (MANDATORY)

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-complete-milestone --step 1 --step-label ".75: Goal-Backward Verification Gate (MANDATORY)" 2>/dev/null || true
```

Before archiving, verify that milestone goals are actually achieved end-to-end — not just structurally present. This catches placeholder implementations that passed all quality gates.

Refer to `.gsd-t/contracts/goal-backward-contract.md` for the full verification flow, placeholder patterns, and findings report format.

### 1.75.1 Check for Existing Goal-Backward Results

1. Read `.gsd-t/verify-report.md` — check if it contains a `Goal-Backward:` line
2. If the verify-report already shows `Goal-Backward: PASS` or `Goal-Backward: WARN` (no CRITICAL/HIGH), skip to Step 2
3. If no goal-backward results exist, or verify was run without this step, execute the full goal-backward check now (follow the same logic as `gsd-t-verify.md` Step 5.5)

### 1.75.2 Evaluate Goal-Backward Status

**If CRITICAL or HIGH findings exist:**
- Display findings report to user in the contract format
- **BLOCK milestone completion** — do not proceed to archiving
- Prompt:
  ```
  ⛔ Goal-Backward Verification FAILED — milestone completion blocked.

  Findings:
  {findings table}

  Options:
  1. Fix the findings and re-run /gsd-t-verify
  2. Override with explicit acknowledgment: re-run this command with --force-goal-backward

  Proceed with option 1 (recommended) or acknowledge to force completion?
  ```
- If user provides `--force-goal-backward` flag or explicit acknowledgment: log the override and proceed with warning
- Log to `.gsd-t/progress.md` Decision Log:
  ```
  - {date}: [goal-backward-override] Milestone "{name}" completed with unresolved goal-backward findings — user acknowledged. Findings: {summary}
  ```

**If only MEDIUM findings (warnings):**
- Log findings to `.gsd-t/progress.md` Decision Log:
  ```
  - {date}: [goal-backward-warn] Goal-backward check found {N} medium findings before milestone archive — {summary}. Not blocking.
  ```
- Proceed to Step 2

**If PASS (no findings):**
- Log to `.gsd-t/progress.md` Decision Log:
  ```
  - {date}: [goal-backward-pass] Goal-backward verification passed — {N} requirements checked, no placeholder patterns found
  ```
- Proceed to Step 2

---

## Step 2: Gap Analysis Gate

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-complete-milestone --step 2 --step-label "Gap Analysis Gate" 2>/dev/null || true
```

After verification passes, run a gap analysis against `docs/requirements.md` scoped to this milestone's deliverables:

1. Identify which requirements this milestone was supposed to satisfy (from domain scopes, tasks, and milestone definition)
2. Run `gsd-t-gap-analysis` against those requirements, comparing spec to actual code
3. If **all gaps resolved** (100% Implemented) → proceed to Step 2
4. If **gaps found** (Partial, Incorrect, or Not Implemented):
   a. Auto-fix: execute remediation for each gap (prioritize Critical → High → Medium)
   b. Run affected tests (unit + integration + Playwright E2E if configured)
   c. Re-run `gsd-t-verify` to confirm fixes don't break anything
   d. Re-run gap analysis to confirm gaps are resolved
   e. If gaps remain after **2 fix cycles** → STOP and report unresolved gaps to user

This is a **mandatory gate** — the milestone cannot be archived with known gaps against its requirements.

## Step 2.5: Distillation — Extract Milestone Patterns

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-complete-milestone --step 2 --step-label ".5: Distillation — Extract Milestone Patterns" 2>/dev/null || true
```

Before archiving, extract learning from the event stream to improve future runs.

1. Check if `.gsd-t/events/` exists and has any `.jsonl` files for this milestone period
   - If no events files found: skip distillation (log "No events recorded — distillation skipped"), continue to Step 3
   - If event-writer not installed (`node ~/.claude/scripts/gsd-t-event-writer.js 2>/dev/null || true`): skip gracefully

2. Parse events: scan `.gsd-t/events/*.jsonl` for events with `"outcome":"failure"` or `"outcome":"learning"`

3. Group by `reasoning` field value — count occurrences of each distinct reasoning string

4. For each group with ≥ 3 occurrences:
   - Formulate a concrete rule (e.g., "Always read X before modifying Y — failed 4 times without this")
   - Present to user: "Pattern found {N} times: {reasoning}. Proposed rule: '{rule}'. Add to CLAUDE.md? [y/n]"
   - **Wait for user confirmation before writing** (Destructive Action Guard — CLAUDE.md changes require approval)
   - If approved: append the rule to CLAUDE.md under the relevant section
   - Write event: `node ~/.claude/scripts/gsd-t-event-writer.js --type distillation --command gsd-t-complete-milestone --reasoning "{rule}" --outcome success || true`

5. If no patterns found (fewer than 3 occurrences): log "Distillation complete — no repeating patterns found"

### Step 2.5b: Rule Engine Distillation

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-complete-milestone --step 2 --step-label ".5b: Rule Engine Distillation" 2>/dev/null || true
```

After event-stream pattern detection, run rule-based distillation using the declarative rule engine and patch lifecycle:

1. **Rule Evaluation**: Run via Bash:
   `node -e "const re = require('./bin/rule-engine.js'); const domains = [/* list milestone domain names */]; domains.forEach(d => { const m = re.evaluateRules(d, { projectDir: '.', milestone: '{milestone-id}' }); m.forEach(x => { console.log('FIRED: ' + x.rule.id + ' — ' + x.rule.name + ' [' + x.severity + ']'); re.recordActivation(x.rule.id, '.'); }); });" 2>/dev/null || true`

2. **Patch Candidate Generation**: For each fired rule with `action: 'patch'`, run via Bash:
   `node -e "const re = require('./bin/rule-engine.js'); const pl = require('./bin/patch-lifecycle.js'); const fired = [/* rule IDs from step 1 */]; fired.forEach(ruleId => { const rule = re.getActiveRules('.').find(r => r.id === ruleId); if(rule && rule.action === 'patch' && rule.patch_template_id) { const p = pl.createCandidate(ruleId, rule.patch_template_id, 0, '.'); console.log('CANDIDATE: ' + p.id + ' from ' + ruleId); } });" 2>/dev/null || true`

3. **Promotion Gate Check**: For all applied/measured patches, run via Bash:
   `node -e "const pl = require('./bin/patch-lifecycle.js'); ['applied','measured'].forEach(s => { pl.getPatchesByStatus(s, '.').forEach(p => { const g = pl.checkPromotionGate(p.id, '.'); if(g.passes) { pl.promote(p.id, '.'); console.log('PROMOTED: ' + p.id); } else if(p.measured_milestones && p.measured_milestones.length >= 2) { pl.deprecate(p.id, g.reason, '.'); console.log('DEPRECATED: ' + p.id + ' — ' + g.reason); } }); });" 2>/dev/null || true`

4. **Graduation**: For promoted patches sustained 3+ milestones, run via Bash:
   `node -e "const pl = require('./bin/patch-lifecycle.js'); pl.getPatchesByStatus('promoted', '.').forEach(p => { const r = pl.graduate(p.id, '.'); if(r.target) console.log('GRADUATED: ' + p.id + ' → ' + r.target); });" 2>/dev/null || true`

5. **Consolidation & Deprecation**: Run via Bash:
   `node -e "const re = require('./bin/rule-engine.js'); const f = re.flagInactiveRules(5, '.'); if(f.length) f.forEach(r => console.log('INACTIVE: ' + r.id + ' — no activations in 5+ milestones'));" 2>/dev/null || true`

6. **Quality Budget Governance**: Compute rework percentage from task-metrics. Run via Bash:
   `node -e "const mc = require('./bin/metrics-collector.js'); const recs = mc.readTaskMetrics({ milestone: '{milestone-id}' }, '.'); if(recs.length) { const rework = recs.filter(r => r.fix_cycles > 0).length; const pct = (rework/recs.length*100).toFixed(1); console.log('Rework: ' + pct + '% (' + rework + '/' + recs.length + ')'); if(pct > 20) console.log('⚠️ REWORK CEILING EXCEEDED — triggering constraint tightening for next milestone'); }" 2>/dev/null || true`

   When rework ceiling (20%) exceeded: log warning and note that next milestone should: force discuss phase, require contract review, split large tasks.

### Step 2.5c: Global Rule Promotion

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-complete-milestone --step 2 --step-label ".5c: Global Rule Promotion" 2>/dev/null || true
```

After local rule promotion completes, propagate newly promoted rules to global metrics:

1. **Check for promoted rules**: Run via Bash:
   ```bash
   node -e "const pl = require('./bin/patch-lifecycle.js'); const promoted = pl.getPatchesByStatus('promoted', '.'); console.log(JSON.stringify(promoted.map(p => ({ id: p.id, rule_id: p.rule_id, template_id: p.template_id }))));" 2>/dev/null || true
   ```

2. **Copy promoted rules to global**: For each promoted rule, run via Bash:
   ```bash
   node -e "
     const gsm = require('./bin/global-sync-manager.js');
     const re = require('./bin/rule-engine.js');
     const pl = require('./bin/patch-lifecycle.js');
     const promoted = pl.getPatchesByStatus('promoted', '.');
     let count = 0;
     for (const p of promoted) {
       const rule = re.getActiveRules('.').find(r => r.id === p.rule_id);
       if (!rule) continue;
       const written = gsm.writeGlobalRule({
         id: rule.id,
         original_rule: rule,
         source_project: (() => { try { return require('./package.json').name; } catch { return require('path').basename(process.cwd()); } })(),
         source_project_dir: process.cwd(),
       });
       gsm.checkUniversalPromotion(written.global_id);
       count++;
     }
     if (count > 0) console.log('Promoted ' + count + ' rules to global metrics');
   " 2>/dev/null || true
   ```

3. **Write global rollup entry**: Run via Bash:
   ```bash
   node -e "
     const gsm = require('./bin/global-sync-manager.js');
     const mc = require('./bin/metrics-collector.js');
     const mr = require('./bin/metrics-rollup.js');
     const name = (() => { try { return require('./package.json').name; } catch { return require('path').basename(process.cwd()); } })();
     const rollups = mr.readRollups({}, '.');
     const latest = rollups.length > 0 ? rollups[rollups.length - 1] : null;
     if (latest) {
       gsm.writeGlobalRollup({
         source_project: name, source_project_dir: process.cwd(),
         milestone: latest.milestone, version: latest.version,
         total_tasks: latest.total_tasks, first_pass_rate: latest.first_pass_rate,
         avg_duration_s: latest.avg_duration_s, total_fix_cycles: latest.total_fix_cycles,
         total_tokens: latest.total_tokens, elo_after: latest.elo_after,
         signal_distribution: latest.signal_distribution,
         domain_breakdown: latest.domain_breakdown,
       });
       console.log('Updated global rollup for ' + name);
     }
   " 2>/dev/null || true
   ```

4. **Write global signal distribution**: Run via Bash:
   ```bash
   node -e "
     const gsm = require('./bin/global-sync-manager.js');
     const mc = require('./bin/metrics-collector.js');
     const name = (() => { try { return require('./package.json').name; } catch { return require('path').basename(process.cwd()); } })();
     const allRecs = mc.readTaskMetrics({}, '.');
     if (allRecs.length === 0) { process.exit(0); }
     const counts = {};
     allRecs.forEach(r => { counts[r.signal_type] = (counts[r.signal_type] || 0) + 1; });
     const total = allRecs.length;
     const rates = {};
     for (const [k, v] of Object.entries(counts)) { rates[k] = Math.round(v / total * 1000) / 1000; }
     gsm.writeGlobalSignalDistribution({
       source_project: name, source_project_dir: process.cwd(),
       total_tasks: total, signal_counts: counts, signal_rates: rates,
       domain_type_signals: [],
     });
     console.log('Updated global signal distribution for ' + name);
   " 2>/dev/null || true
   ```

5. If no rules were promoted this milestone: skip silently (steps 3-4 still run for rollup/signal tracking).

### Step 2.5d: Component Impact Evaluation (if available)

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-complete-milestone --step 2 --step-label ".5d: Component Impact Evaluation (if available)" 2>/dev/null || true
```

Record impact data for each active component:

1. **Record component impact** — for each domain that completed tasks, run via Bash:
   `node -e "const cr = require('./bin/component-registry.js'); const domains = [/* list completed domain names */]; domains.forEach(d => cr.recordImpact(d, '{milestone-id}', '.')); " 2>/dev/null || true`

2. If `bin/component-registry.js` does not exist, skip silently.

## Step 3: Gather Milestone Artifacts

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-complete-milestone --step 3 --step-label "Gather Milestone Artifacts" 2>/dev/null || true
```

Collect all files related to this milestone:
- `.gsd-t/progress.md` (current state)
- `.gsd-t/verify-report.md`
- `.gsd-t/impact-report.md` (if exists)
- `.gsd-t/test-coverage.md` (if exists)
- `.gsd-t/domains/*/` (all domain folders)
- `.gsd-t/contracts/` (snapshot)

## Step 4: Create Archive

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-complete-milestone --step 4 --step-label "Create Archive" 2>/dev/null || true
```

Create milestone archive directory:

```
.gsd-t/milestones/{milestone-name}-{date}/
├── progress.md           # Final state
├── verify-report.md      # Verification results
├── impact-report.md      # Impact analysis (if any)
├── test-coverage.md      # Test sync report (if any)
├── summary.md            # Generated summary (see below)
├── contracts/            # Contract snapshot at completion
│   └── ...
└── domains/              # Domain artifacts
    └── ...
```

## Step 5: Generate Summary

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-complete-milestone --step 5 --step-label "Generate Summary" 2>/dev/null || true
```

Create `summary.md`:

```markdown
# Milestone Complete: {name}

**Completed**: {YYYY-MM-DD HH:MM TZ}
**Duration**: {start date} → {end date}
**Status**: {VERIFIED | FORCED}

## What Was Built
{Extract from progress.md and domain scopes}

## Domains
| Domain | Tasks Completed | Key Deliverables |
|--------|-----------------|------------------|
| {name} | {N} | {summary} |

## Contracts Defined/Updated
- {contract}: {new | updated | unchanged}

## Key Decisions
{Extract from Decision Log in progress.md}

## Issues Encountered
{Extract any remediation tasks or blocked items}

## Test Coverage
- Tests added: {N}
- Tests updated: {N}
- Coverage: {if known}

## Git Tag
`{tag-name}`

## Files Changed
{Summary of files created/modified/deleted}
```

## Step 6: Bump Version

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-complete-milestone --step 6 --step-label "Bump Version" 2>/dev/null || true
```

GSD-T tracks project version in `.gsd-t/progress.md` using semantic versioning: `Major.Minor.Patch`

- **Major** (X.0.0): Breaking changes, major rework, v1 launch
- **Minor** (0.X.0): New features, completed feature milestones
- **Patch** (0.0.X): Bug fixes, minor improvements, cleanup milestones

Determine the version bump based on the milestone:
1. Read current version from `.gsd-t/progress.md`
2. Assess milestone scope:
   - Was this a major/breaking milestone? → bump **major**, reset minor to 0, reset patch to **10**
   - Was this a feature milestone? → bump **minor**, reset patch to **10**
   - Was this a bugfix/cleanup/debt milestone? → bump **patch** (increment by 1)
   - **Patch numbers are always 2 digits (≥10).** After any minor/major reset, start at 10, never 0 or 1.
3. Update version in `.gsd-t/progress.md`
4. If a package manifest exists (`package.json`, `pyproject.toml`, `Cargo.toml`, etc.), update its version to match
5. Update `README.md` version badge or version reference if present
6. Include version in the milestone summary and git tag

## Step 7: Clean Working State

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-complete-milestone --step 7 --step-label "Clean Working State" 2>/dev/null || true
```

Reset `.gsd-t/` for next milestone:

1. **Archive + sweep the completed milestone's domains — DETERMINISTICALLY (backlog #40, NOT prose).**
   This step was prose-only for ~30 milestones and got skipped, accumulating 77 stale domain dirs
   that polluted the file-disjointness oracle. Run the helper with the EXPLICIT set of THIS
   milestone's domain dirs (the partition's domain set — NOT a blanket wipe; a later still-active
   milestone may legitimately have live domains):
   ```bash
   gsd-t archive-domains --domains "{comma-separated domain dir names for THIS milestone}" \
     --archive ".gsd-t/milestones/{name}-{date}" --projectDir .
   ```
   (prefer the project-local `bin/gsd-t-archive-domains.cjs` when present). It (a) copies each named
   domain → `<archive>/domains/<name>/`, then (b) removes it from `.gsd-t/domains/`. Idempotent
   (re-running is a no-op), containment-guarded (refuses any name with path separators / dot-segments
   or resolving outside `.gsd-t/domains/`), and fail-closed (a bad name aborts the whole batch — no
   partial sweep). Domains belonging to other (still-active) milestones are left untouched.
2. (Step 1 already cleared this milestone's domains from `.gsd-t/domains/` — do NOT blanket-wipe the dir.)
3. Archive current reports → milestone folder
4. Clear `.gsd-t/impact-report.md`, `.gsd-t/test-coverage.md`
5. Update `.gsd-t/progress.md`:

**CRITICAL — Decision Log Trim**: This trim happens AFTER Step 4's archive copy of `.gsd-t/progress.md` is written. The archive snapshot at `.gsd-t/milestones/{name}-{date}/progress.md` is the source-of-truth for full history. The live Decision Log is reset to the just-completed milestone's entries only — everything dated before the milestone's start date is deleted from the live file (it remains in the archive). This prevents the live progress.md from growing without bound.

Steps to apply the trim:
- Identify the just-completed milestone's start date (typically the `[milestone-defined]` entry for this milestone)
- Delete all Decision Log entries dated BEFORE that start date from the live `.gsd-t/progress.md`
- Keep entries from the start date onward (they cover the milestone arc + the completion entry you're about to add)
- Prepend the pointer line shown below

```markdown
# GSD-T Progress

## Version: {new version}
## Status: ACTIVE
## Date: {YYYY-MM-DD HH:MM TZ — source from live `[GSD-T NOW]`}
## Current Milestone
None — ready for next milestone

## Completed Milestones
| Milestone | Version | Completed | Tag |
|-----------|---------|-----------|-----|
| {name} | {version} | {YYYY-MM-DD HH:MM TZ} | v{version} |
| {previous} | {version} | {YYYY-MM-DD HH:MM TZ — keep existing rows as-is; forward-only format} | v{version} |
<!-- M59 (v3.29.10): "Completed" cells are written `YYYY-MM-DD HH:MM TZ` from this version forward. Pre-3.29.10 rows that read `YYYY-MM-DD` stay as-is (forward-only — never rewrite). Readers MUST accept both. -->


## Decision Log

> Prior decision log entries preserved in `.gsd-t/milestones/*/progress.md` — see archive snapshots for pre-{next-milestone-name} history.

- {date}: [success] Milestone "{name}" completed — {summary of what was built}. v{version}
{Trim: delete all decision-log entries older than the just-completed milestone's start date. Those entries are preserved in the milestone archive created in Step 4. Keep only the completion entry above plus any entries logged on or after the cutoff — typically the live log is near-empty when the next milestone begins.}
```

## Step 8: Update README.md

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-complete-milestone --step 8 --step-label "Update README.md" 2>/dev/null || true
```

If `README.md` exists, update it to reflect the completed milestone:
- Add or update a **Features** / **What's Included** section with capabilities delivered
- Update version number if displayed in README
- Update setup instructions if infrastructure changed
- Update tech stack if new dependencies were added
- Keep existing user content — merge, don't overwrite

If `README.md` doesn't exist, create one with project name, description, version, tech stack, setup instructions, and link to `docs/`.

## Step 8.5: Scan Doc Milestone Checkpoint

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-complete-milestone --step 8 --step-label ".5: Scan Doc Milestone Checkpoint" 2>/dev/null || true
```

Before tagging, ensure scan docs reflect the final state of the codebase after all milestone work. This is the full-refresh counterpart to the micro-updates done during execute/quick/debug.

If `.gsd-t/techdebt.md` exists (a prior scan has been run):
1. Check staleness — count commits since the register was last written (use `.gsd-t/scan/.cache.json` if present, else the register's git mtime).
2. If **stale** (>0 commits since scan):
   - Log: "Running milestone scan checkpoint — refreshing the tech-debt register..."
   - Re-run the scan by invoking the volume-scaled scan Workflow (`templates/workflows/gsd-t-scan.workflow.js`, same as `/gsd-t-scan`) — the probe re-slices the codebase and the finders refresh the register. This replaces the retired fixed-5-teammate dimension refresh.
   - Update `.gsd-t/techdebt.md` — mark any items resolved during this milestone as `[RESOLVED]`
3. If fresh → skip with log: "Scan register is fresh — no checkpoint refresh needed"

If `.gsd-t/scan/` doesn't exist → skip (no scan data to maintain).

## Step 8.7: Generate Metrics Rollup

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-complete-milestone --step 8 --step-label ".7: Generate Metrics Rollup" 2>/dev/null || true
```

Generate milestone-level metrics aggregation and ELO score:

1. Run via Bash:
   `node bin/metrics-rollup.js {milestone-id} {version} 2>/dev/null`
2. If rollup succeeds, display:
   ```
   ## Process Metrics — {milestone}
   - ELO: {elo_before} → {elo_after} ({elo_delta > 0 ? '+' : ''}{elo_delta})
   - First-pass rate: {first_pass_rate * 100}%
   - Tasks: {total_tasks} | Fix cycles: {total_fix_cycles}
   - Avg duration: {avg_duration_s}s | Avg context: {avg_context_pct}%
   ```
3. If `trend_delta` is present (previous milestone exists), display:
   ```
   Trend vs previous: first-pass rate {delta > 0 ? '↑' : '↓'} {delta}%, duration {delta}s
   ```
4. If `heuristic_flags` has entries, display as warnings:
   ```
   ⚠️ Heuristic: {heuristic} ({severity}) — {description}
   ```
5. If rollup fails (no task-metrics data): log "No task-metrics found — rollup skipped" and continue.

Include ELO score in the milestone summary (Step 5) and git tag message (Step 11).

## Step 9: Document Ripple

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-complete-milestone --step 9 --step-label "Document Ripple" 2>/dev/null || true
```

Before creating the git tag, verify all documentation is up to date:

### Always update:
1. **`.gsd-t/progress.md`** — Already updated in Step 6, verify it's complete with version and milestone state
2. **`README.md`** — Already updated in Step 7, verify it reflects all delivered capabilities

### Check if affected:
3. **`docs/requirements.md`** — Verify all requirements delivered in this milestone are marked as complete
4. **`docs/architecture.md`** — Verify the architecture doc matches the current system state after all milestone work
5. **`docs/workflows.md`** — Verify any workflows added or changed during the milestone are documented
6. **`docs/infrastructure.md`** — If infrastructure changed during the milestone (new services, new deployment steps), verify it's documented
7. **`CLAUDE.md`** — Verify any conventions established during the milestone are captured
8. **`.gsd-t/techdebt.md`** — Verify any debt resolved during the milestone is marked done, and any new debt discovered is logged

### This is the LAST GATE before tagging — nothing should be undocumented.

## Step 10: Test Verification

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-complete-milestone --step 10 --step-label "Test Verification" 2>/dev/null || true
```

Verify the milestone is truly complete:

1. **Run ALL configured test suites** — detect and run every one:
   a. Unit/integration tests (vitest/jest/mocha)
   b. If `playwright.config.*` exists → run `npx playwright test` (full suite). Unit tests alone are NEVER sufficient when E2E exists.
   c. If specs are missing or stale, invoke `gsd-t-test-sync` first.
   d. Report: "Unit: X/Y pass | E2E: X/Y pass"
2. **Verify all pass**: Every test must pass. If any fail, fix before tagging (up to 2 attempts)
3. **Functional test quality gate**: Read every Playwright spec. Verify assertions check **functional behavior** (state changed after action, data loaded, content updated, widget responded to input) — NOT just element existence (`isVisible`, `toBeAttached`, `toBeEnabled`). Shallow tests that would pass on an empty HTML page with the right element IDs are a milestone completion FAIL. Flag and rewrite before proceeding.
4. **Compare to baseline**: If a test baseline was recorded at milestone start, verify coverage has improved or at minimum not regressed
5. **Log test results**: Include test pass/fail counts and shallow test audit results in the milestone summary (Step 4)

## Step 11: Create Git Tag

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-complete-milestone --step 11 --step-label "Create Git Tag" 2>/dev/null || true
```

```bash
# Stage any remaining .gsd-t changes
git add .gsd-t/

# Commit the archive
git commit -m "milestone({milestone-name}): complete and archive v{version}"

# Create annotated tag with version
git tag -a "v{version}" -m "v{version} — Milestone: {name}

{Brief description from summary}

Domains: {list}
Verified: {date}"
```

## Step 12: Report Completion

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-complete-milestone --step 12 --step-label "Report Completion" 2>/dev/null || true
```

```
✅ Milestone "{name}" completed — v{version}

📁 Archived to: .gsd-t/milestones/{name}-{date}/
🏷️  Tagged as: v{version}

Summary:
- Version: {previous version} → {new version}
- Domains completed: {N}
- Tasks completed: {N}
- Contracts: {N} defined/updated
- Tests: {N} added/updated

Next steps:
- Push tags: git push origin v{version}
- Start next milestone: /gsd-t-milestone "{next name}"
- Or view roadmap: /gsd-t-status
```

## Step 13: Update Roadmap (if exists)

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-complete-milestone --step 13 --step-label "Update Roadmap (if exists)" 2>/dev/null || true
```

If `.gsd-t/roadmap.md` exists:
- Mark this milestone as complete
- Update any dependent milestones
- Highlight next recommended milestone

## Error Handling

### If verify failed:
"Cannot complete — verification found issues. Address them first or use `--force`."

### If no milestone active:
"No active milestone to complete. Run `/gsd-t-status` to see state."

### If git operations fail:
- Still create archive
- Report git error
- Provide manual tag command

$ARGUMENTS

## Auto-Clear

All work is committed to project files. Execute `/clear` to free the context window for the next command.
