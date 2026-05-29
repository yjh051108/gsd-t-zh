# M61 Integration Points

## Wave Sequencing (Hybrid Option C — locked in CONTEXT.md 2026-05-29 11:31 PDT)

```
Wave 0 (DONE — 2026-05-29 11:31 PDT)
  └── v3.x-legacy branch cut at v3.29.11, pushed to origin
      Acts as 4.0.0 safety net + D6 migration source reference

Wave 1: D6 (migrate orchestration to Workflow) ∥ D5 (retire proof scratch)
  ├── D6: Port orchestrator/parallel/spawn-plan → Workflow scripts
  │       KEEP brains (file-disjointness, task-graph, brief, preflight)
  │       Edit 12 command files → thin Workflow invokers
  └── D5: Delete 8 proof/benchmark/probe scripts (zero live refs)

Wave 2: D7 (reframe validation + de-wire commands) ∥ D2-prep
  ├── D7: Strip OBSERVABILITY blocks from 13 command files
  │       Add /code-review ultra to verify path
  │       Write orthogonal-validation-contract.md
  │       Reframe Red Team / QA / Design-Verify as Workflow stages
  └── D2-prep: ONLY edits to bin/gsd-t.js (remove unattended subcommands)
      File-disjoint from D7's command-file edits

Wave 3: D1 ∥ D2 ∥ D3 ∥ D4 (4-way parallel retire)
  ├── D1: Delete context-meter/runway machinery + hook
  ├── D2: Delete unattended-relay supervisor + handoff + heartbeat
  ├── D3: Delete token-telemetry capture/dashboard/attribution stack
  └── D4: Delete viewer/dashboard SSE stack + conversation-capture hook

Wave 4: D8 (doc-ripple + cockpit)
  ├── Rewrite both CLAUDE.md files (drop retired-infra rules)
  ├── Update README + CHANGELOG (exhaustive breaking-changes)
  ├── Write retire→native map (SC6)
  └── Execute SC7 cockpit walkthrough (zero terminal keystrokes)
```

## Task-Level Wave Map (added at plan, 2026-05-29 12:37 PDT)

| Wave | Domain.Task | Parallel-with | Blocked-by |
|------|-------------|---------------|------------|
| 1 | D6-T1 (scaffolding) | — | — |
| 1 | D5-T1 (zero-ref gate) | D6-T1 | — |
| 1 | D6-T2 (execute workflow) | D6-T3, D6-T5, D6-T6, D5-T2 | D6-T1 |
| 1 | D6-T3 (verify workflow) | D6-T2, D6-T5, D6-T6, D5-T2 | D6-T1 |
| 1 | D6-T5 (integrate/debug/quick workflows) | D6-T2, D6-T3, D6-T6, D5-T2 | D6-T1 |
| 1 | D6-T6 (upper-stage workflows) | D6-T2, D6-T3, D6-T5, D5-T2 | D6-T1 |
| 1 | D5-T2 (delete proof scratch) | D6-T2/3/5/6 | D5-T1 |
| 1 | D6-T4 (wave workflow) | — | D6-T2, D6-T3 |
| 1 | D6-T7 (edit 12 command files) | — | D6-T2..T6 |
| 1 | D6-T8 (M58 reproduction — SC2) | — | D6-T7 |
| 1 | D5-T3 (archive ratelimit-map) | — | D5-T2, D6-T3 |
| 2 | D7-T1 (orthogonal-validation contract) | D7-T2, D7-T5, D2-T1 | C1 |
| 2 | D7-T2 (de-wire 13 command files) | D7-T1, D7-T5, D2-T1 | C1 |
| 2 | D7-T5 (KEEP-list integrity) | D7-T1, D7-T2, D2-T1 | C1 |
| 2 | D2-T1 (remove unattended subcommands from gsd-t.js) | D7-T1, D7-T2, D7-T5 | C1 |
| 2 | D7-T3 (reframe protocol preambles) | D7-T4 | D7-T1 |
| 2 | D7-T4 (wire /code-review ultra into verify Workflow) | D7-T3 | D7-T1, D6-T3 |
| 3 | D1-T1 (zero-ref gate) | D2-T2, D3-T1, D4-T1, D4-T2 | C2 |
| 3 | D2-T2 (zero-ref gate) | D1-T1, D3-T1, D4-T1, D4-T2 | C2, D2-T1 |
| 3 | D3-T1 (zero-ref gate) | D1-T1, D2-T2, D4-T1, D4-T2 | C2 |
| 3 | D4-T1 (decide design-review-server fate) | D1-T1, D2-T2, D3-T1, D4-T2 | — |
| 3 | D4-T2 (zero-ref gate) | D1-T1, D2-T2, D3-T1 | C2, D4-T1 |
| 3 | D3-T2 (archive token-log + metrics) | D1-T2, D2-T3, D4-T3 | D3-T1 |
| 3 | D1-T2 (delete context-meter files) | D2-T3, D3-T3, D4-T3 | D1-T1 |
| 3 | D2-T3 (delete relay files + commands + contracts) | D1-T2, D3-T3, D4-T3 | D2-T2 |
| 3 | D3-T3 (delete token-telemetry files + hook) | D1-T2, D2-T3, D4-T3 | D3-T2 |
| 3 | D4-T3 (delete dashboard/viewer/SSE + conversation hook) | D1-T2, D2-T3, D3-T3 | D4-T2 |
| 3 | D1-T3 (statusline ctx% rewire) | — | D1-T2 |
| 4 | D8-T1 (rewrite ~/.claude/CLAUDE.md) | D8-T2 | C3 |
| 4 | D8-T2 (rewrite project CLAUDE.md) | D8-T1 | C3 |
| 4 | D8-T3 (sync templates + init guard) | D8-T4, D8-T5 | D8-T1, D8-T2 |
| 4 | D8-T4 (README + GSD-T-README + CHANGELOG) | D8-T3, D8-T5 | C3 |
| 4 | D8-T5 (retire→native map — SC6) | D8-T3, D8-T4 | C3 |
| 4 | D8-T6 (SC7 cockpit walkthrough) | — | D8-T1..T5 |
| 4 | D8-T7 (promote deferred ideas to backlog) | — | D8-T6 |

C1 = Wave 1 checkpoint (D6 + D5 done). C2 = Wave 2 checkpoint (D7 + D2-T1 done). C3 = Wave 3 checkpoint (D1+D2+D3+D4 retire done).

## Checkpoints (block-promotion gates)

### C1 — Wave 1 done → unblocks Wave 2
- D6: Workflow scripts shipped + 12 command files invoke them + bake-off-equivalent end-to-end runs green via Workflow (M58 reproduction)
- D5: 8 proof scripts deleted + grep gate confirms zero remaining references

### C2 — Wave 2 done → unblocks Wave 3
- D7: 13 command files have NO `captureSpawn`/`recordSpawnRow`/`autoSpawnHeadless` references
- D7: `orthogonal-validation-contract.md` STABLE
- D7: `/code-review ultra` wired into verify Workflow stage
- D2-prep: `bin/gsd-t.js` has no `unattended` / `unattended-watch` / `unattended-stop` subcommands

### C3 — Wave 3 done → unblocks Wave 4
- D1: context-meter/runway files deleted; PostToolUse hook removed from settings.json; no `require()` leftovers
- D2: unattended relay files + 3 commands deleted; no `require()` leftovers
- D3: token-telemetry files + capture-lint deleted; no `require()` leftovers
- D4: viewer/dashboard stack + conversation-capture hook deleted; no `require()` leftovers
- All four: `bin/gsd-t.js` subcommands removed for retired surfaces
- Cross-domain integration check: `node bin/gsd-t.js doctor` reports zero dangling references (SC4)
- Full suite green vs. M60 baseline (2466 pass / 1 known-flaky / 3 sqlite-skip), excluding tests deleted with their subjects (SC3)

### C4 — Wave 4 done → milestone COMPLETE
- D8: both CLAUDE.md files rewritten; templates match live versions
- D8: README + GSD-T-README + CHANGELOG breaking-changes exhaustive
- D8: retire→native map covers every D1-D5 surface (SC6)
- D8: SC7 walkthrough recorded PASS (zero terminal keystrokes, no allowlist gaps)
- M61 verify-gate green; Red Team GRUDGING PASS (SC8)

## Cross-Domain File Contention Matrix

`bin/gsd-t.js` is edited by D1, D2, D3, D4, D5 (CLI subcommand removal). To avoid Wave 3 merge conflicts:
- Each Wave-3 retire domain owns ONE subcommand-removal commit
- Sequenced order: D1 → D2 → D3 → D4 (alphabetical-by-domain), all within Wave 3
- Final integration commit rebases / linearizes if needed

`commands/*.md` is edited by D7 only (Wave 2). Wave 3 retire domains do NOT touch command files — D7 already de-wired them.

`~/.claude/settings.json` is edited by D1 (context-meter hook removal) and D4 (conversation-capture hook removal). File-disjoint at the hook-entry level; sequenced at integrate.

`~/.claude/CLAUDE.md` and `templates/CLAUDE-global.md` are owned by D8 exclusively (Wave 4).

## Falsifiable Acceptance for the Whole Milestone

- **SC1** — bin/ drops from 37,785 → ≤12,000 LOC (measured `wc -l` before/after)
- **SC2** — M58 re-run via Workflow scripts produces identical contracts + clean verify-gate
- **SC3** — full unit suite green vs. M60 baseline (excluding co-deleted tests)
- **SC4** — `gsd-t doctor` zero dangling references
- **SC5** — Red Team / QA / Design-Verify run as Workflow stages, de-duped against `/code-review ultra`
- **SC6** — retire→native map covers every retired capability
- **SC7** — desktop-cockpit walkthrough zero terminal keystrokes
- **SC8** — Red Team GRUDGING PASS

## Versioning
M61 ships as **v4.0.10** (major bump — substrate shift). Patch starts at 10 per the 2-digit convention. `v3.x-legacy` branch already exists as safety net.

## Risk Notes
- D6 is the highest-stakes domain. Land it, verify M58 reproduction, THEN start Wave 2.
- D2 is the largest demolition (~8,800 LOC). Wave-2 de-wire by D7 is the gate that makes Wave-3 D2 deletion safe.
- Build-hold is in force for the entire milestone (user directive). No other work runs in this repo.
- Scan freshness: scan/.cache.json is 43 days old. Retire targets are explicit (not scan-derived); staleness doesn't affect partition decisions.
