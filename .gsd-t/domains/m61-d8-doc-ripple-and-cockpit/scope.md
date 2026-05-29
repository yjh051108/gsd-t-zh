# Domain: m61-d8-doc-ripple-and-cockpit

## Responsibility
Rewrite CLAUDE-global.md / CLAUDE-project.md + commands→Skills mapping to drop all retired-infra rules. Bake in the desktop-as-cockpit outcome (SC7). Final domain — runs Wave 4, after every retire/reframe wave has committed. **Wave 4 (single domain).**

## Owned Files (edit — heavy revision)

**Global CLAUDE.md** (`~/.claude/CLAUDE.md`):
- Cut entirely: Observability Logging, Token Capture Rule, In-Session Conversation Capture, Always-Headless Spawn, Context Meter references, Auto-Relaunch on supervisor=failed
- Rewrite: Mandatory Preflight Before Spawn (move from "every command file" → "every Workflow script"), Brief-First Worker Rule (same shift), Two-Track Verify-Gate (same shift), QA / Design Verification / Red Team agent sections (Workflow stages, not Task spawns), Model Display (Workflow `log()` calls)
- Add: brief section on desktop-as-cockpit + orthogonal validation rule pointing at D7's contract

**Project CLAUDE.md** (`/Users/david/projects/GSD-T/CLAUDE.md`):
- Cut entirely: Observability Logging, Token Capture Rule
- Rewrite: Mandatory Preflight + Brief-First (Workflow framing), Don't list ("NEVER spawn a Task subagent without OBSERVABILITY LOGGING" cut)
- Update: Conventions / Command files (command files are thin invokers of Workflow scripts; spawn-a-Task convention is removed)
- Update: Pre-Commit Gate (project-specific) — drop OBSERVABILITY block check

**Templates**:
- `templates/CLAUDE-global.md` — match the live `~/.claude/CLAUDE.md` edits
- `templates/CLAUDE-project.md` — same
- Any other templates that reference retired infra

**README files**:
- `README.md` — update commands table, drop retired commands, add Workflow-based execution model
- `GSD-T-README.md` — same
- `CHANGELOG.md` — enumerate every breaking change with one-line migration note per surface

**Help / Commands → Skills mapping**:
- `commands/gsd-t-help.md` — drop retired commands; refresh examples
- Confirm `commands/gsd.md` (smart router) reflects the new state

**Backlog / techdebt**:
- `.gsd-t/backlog.md` — promote any post-M61 follow-ups (deferred ideas from CONTEXT.md: deeper SC7 UI walkthrough, M52 bake-off, cross-project propagation)

## Owned Files (create)

- `.gsd-t/milestones/m61-platform-reconciliation-{date}/retire-to-native-map.md` — for every retired capability, name the native replacement (SC6 — "measure-don't-claim")
- `.gsd-t/milestones/m61-platform-reconciliation-{date}/sc7-cockpit-walkthrough.md` — record of the post-M61 small-backlog-item desktop walkthrough (zero terminal keystrokes)

## NOT Owned (do not modify)
- Any bin/ source (D1-D7 own those)
- Workflow scripts (D6)
- Contracts owned by D7

## SC7 Cockpit-Equivalence Proof

After Waves 0-3 commit and M61 is tagged v4.0.10:
1. Pick a small ready backlog item (single-domain bug or doc update) exercising ≥1 each of: file read, file edit, test run, git commit, Workflow spawn
2. Drive partition → plan → execute → verify → deliver entirely from the desktop app (no terminal)
3. PASS iff: zero terminal keystrokes, every prompt fires on either a real decision (destructive guard / ambiguity) or an allowlist gap (= SC7 violation), final artifacts identical to CLI path
4. Record under `sc7-cockpit-walkthrough.md`

## Estimated LOC
- Net ~30–40% reduction in both CLAUDE.md files
- ~200-400 LOC removed (the cut sections)
- ~50 LOC added (cockpit + orthogonal validation reference)

## Pre-merge gate
1. Every cut/rewrite section in CLAUDE.md points only at things that still exist post-M61
2. CHANGELOG breaking-changes section covers every removed CLI subcommand, every removed CLAUDE.md rule, every removed contract
3. SC7 walkthrough recorded as PASS
4. Retire→native map covers every D1-D5 retired surface (SC6)
