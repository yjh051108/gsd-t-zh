# Tasks: m61-d8-doc-ripple-and-cockpit

## Summary
Rewrite both CLAUDE.md files; update README + GSD-T-README + CHANGELOG; write retire→native map (SC6); execute SC7 cockpit walkthrough. Wave 4 — runs alone.

## Tasks

### Task M61-D8-T1 — Rewrite `~/.claude/CLAUDE.md` (global)
- **Touches**: `~/.claude/CLAUDE.md`
- **Contract refs**: `orthogonal-validation-contract.md` (D7-T1)
- **Dependencies**: BLOCKED by Wave 3 (all retire commits landed)
- **Acceptance**: Cut entirely: Observability Logging, Token Capture Rule, In-Session Conversation Capture, Always-Headless Spawn, Context Meter, supervisor/unattended sections, Mandatory Preflight (replaced by Workflow-framing version). Rewritten: Brief-First Worker Rule, Two-Track Verify-Gate, QA/Design-Verify/Red Team agent sections (Workflow stages), Model Display (Workflow `log()`). Added: cockpit section + orthogonal validation reference. No retired-infra text remains.

### Task M61-D8-T2 — Rewrite `CLAUDE.md` (project)
- **Touches**: `/Users/david/projects/GSD-T/CLAUDE.md`
- **Contract refs**: same as T1
- **Dependencies**: BLOCKED by T1 (same paired commit)
- **Acceptance**: Same scope as T1 for the project file. Pre-Commit Gate (project-specific) updated to drop OBSERVABILITY check. Don't list updated (drop OBSERVABILITY don't).

### Task M61-D8-T3 — Sync templates and run global propagation guard
- **Touches**: `templates/CLAUDE-global.md`, `templates/CLAUDE-project.md` (match T1 and T2)
- **Contract refs**: same as T1
- **Dependencies**: BLOCKED by T1, T2
- **Acceptance**: Templates byte-equivalent (modulo project-specific tokens like `{Project Name}`) to the live files. `gsd-t-init` against a fresh dir produces CLAUDE.md matching the new state.

### Task M61-D8-T4 — Update README, GSD-T-README, CHANGELOG
- **Touches**: `README.md`, `GSD-T-README.md`, `CHANGELOG.md`
- **Contract refs**: all retire/migrate domain scopes (for the breaking-changes section)
- **Dependencies**: BLOCKED by Wave 3
- **Acceptance**: README commands table reflects final command set (post-Wave-3 retirements). CHANGELOG `[4.0.10]` section enumerates every breaking change with a one-line migration note per surface (every removed CLI subcommand, every removed CLAUDE.md rule, every removed contract). `v3.x-legacy` branch documented as migration safety net.

### Task M61-D8-T5 — Write retire→native map (SC6)
- **Touches**: `.gsd-t/milestones/m61-platform-reconciliation-{date}/retire-to-native-map.md`
- **Contract refs**: scopes of D1-D5
- **Dependencies**: BLOCKED by Wave 3
- **Acceptance**: For every retired capability (D1-D5), names the native replacement. Format: `| Retired surface | Native replacement | Notes |`. Empty cells flagged as silent losses (e.g., per-phase historical token analytics — accepted loss per CONTEXT.md risk #3).

### Task M61-D8-T6 — Execute SC7 cockpit walkthrough
- **Touches**: `.gsd-t/milestones/m61-platform-reconciliation-{date}/sc7-cockpit-walkthrough.md`
- **Contract refs**: NONE
- **Dependencies**: BLOCKED by T1, T2, T3, T4, T5 (M61 must be tagged before walkthrough)
- **Acceptance**: Pick a small backlog item exercising file read + edit + test run + git commit + Workflow spawn. Run partition → plan → execute → verify → deliver from desktop only. Record: prompts fired, classification (real decision / allowlist gap / mistake), final artifact diff vs. CLI baseline. PASS iff zero terminal keystrokes AND zero allowlist gaps AND artifacts identical.

### Task M61-D8-T7 — Promote deferred ideas to backlog
- **Touches**: `.gsd-t/backlog.md`
- **Contract refs**: NONE
- **Dependencies**: BLOCKED by T6
- **Acceptance**: 3 deferred items from CONTEXT.md added: (a) deeper SC7 walkthrough on UI-heavy milestone, (b) M52 bake-off, (c) `gsd-t version-update-all` cross-project propagation. Each with origin tag `m61-deferred`.

## Execution Estimate
- Total tasks: 7
- Independent: 0
- Blocked: 7

## Files Owned
- `~/.claude/CLAUDE.md`, `/Users/david/projects/GSD-T/CLAUDE.md` exclusively
- `templates/CLAUDE-global.md`, `templates/CLAUDE-project.md` exclusively
- `README.md`, `GSD-T-README.md`, `CHANGELOG.md` exclusively (for the M61 / v4.0.10 entry)
- `.gsd-t/milestones/m61-*/` retire-to-native-map + sc7 walkthrough
- `.gsd-t/backlog.md` (additive only)
