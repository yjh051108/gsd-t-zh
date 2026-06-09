# Integration Points

## Current State: M85 — Model-Tier Policy (single source of truth) + Fable 5 Integration (PLANNED — 4 domains, 2 waves). See `.gsd-t/contracts/m85-integration-points.md`.

## Prior State: Milestone 41 — Universal Token Capture Across GSD-T (PARTITIONED — 5 domains)

## M41 Dependency Graph

```
Wave 1 (foundation — no external blockers):
  D1 token-capture-wrapper
      │   (exports captureSpawn + recordSpawnRow from bin/gsd-t-token-capture.cjs)
      │   (reuses schema v1 from M40 D4 aggregator)
      │
      ▼
Wave 2 (unlocked by D1 landed + tested):
  D2 command-file-doc-ripple ─── rewrites all 20 command files + canonical block
                                 in templates/CLAUDE-global.md and CLAUDE.md

  D3 historical-backfill       ─── bin/gsd-t-token-backfill.cjs +
                                 `gsd-t backfill-tokens` CLI subcommand
                                 reads .gsd-t/events/*.jsonl + .gsd-t/headless-*.log

  D2 and D3 ship in parallel — both depend on D1 only, not on each other.

      │
      ▼
Wave 3 (unlocked by D2 + D3 landed):
  D4 token-dashboard           ─── bin/gsd-t-token-dashboard.cjs +
                                 `gsd-t tokens` CLI + status-tail injection

  D5 enforcement               ─── bin/gsd-t-capture-lint.cjs + opt-in pre-commit
                                 hook + CLAUDE MUST rule

  D4 and D5 ship in parallel — D4 renders, D5 protects. Neither depends on the other.

                GATE: all waves complete
                              │
                              ▼
       VERIFY → COMPLETE-MILESTONE → tag v3.15.10
```

### Abbreviation Key

| Abbrev | Domain |
|--------|--------|
| D1 | d1-token-capture-wrapper |
| D2 | d2-command-file-doc-ripple |
| D3 | d3-historical-backfill |
| D4 | d4-token-dashboard |
| D5 | d5-enforcement |

### Checkpoints

- **M41-CP1** (Wave 1 complete): `bin/gsd-t-token-capture.cjs` loads; `captureSpawn` + `recordSpawnRow` exported; 12+ unit tests green; full suite at baseline+N.
- **M41-CP2** (Wave 2 complete): every command file spawn site goes through the wrapper; no `| N/A |` rows left in canonical templates; `gsd-t backfill-tokens --dry-run` reports real parsed-envelope count > 0 on this project.
- **M41-CP3** (Wave 3 complete): `gsd-t tokens` prints live + backfilled totals; `gsd-t status` shows the two-line token block; `gsd-t capture-lint --all` exits 0 on main; CLAUDE files carry the new MUST rule.

### Cross-Domain Interfaces

| Producer | Consumer | Interface |
|----------|----------|-----------|
| D1 `recordSpawnRow` | D2 command files | Function call in a `node -e "..."` block inside each command's observability section |
| D1 JSONL schema v1 | D3 backfill | Same record shape, with added optional `source: "backfill" \| "live"` field |
| D1 JSONL schema v1 | D4 dashboard | Streaming line-by-line read, in-memory aggregation |
| D2 converted command files | D5 linter | Wrapped spawn sites are the "clean" state the linter checks for |
| M40 D4 aggregator | D1 + D3 | `scripts/gsd-t-token-aggregator.js` envelope-parse helpers — both reuse |
| M40 D5 stream-feed UI | D4 dashboard | Shared `humanizeTokens` + `formatCost` formatters for consistent rendering |

### Contracts Referenced (no new contracts in M41 — reuses M40 shapes)

| Contract | Source | M41 consumers |
|----------|--------|---------------|
| `metrics-schema-contract.md` | M40 D4 | D1 (write), D3 (write + backfill extension), D4 (read) |
| `stream-json-sink-contract.md` v1.1.0 | M40 D1 | D1 (envelope parsing), D3 (log archive parsing) |
| `completion-signal-contract.md` | M40 D3 | not directly consumed — M41 observes spawns that already terminated |

No new contract files are added by M41. The existing schema v1 remains the source of truth; M41 just fills in the data.

---

## Must-Read List (Assumption Audit Category 3 — Black Box)

Every M41 domain MUST read these before treating them as correct:

| File | Why |
|------|-----|
| `scripts/gsd-t-token-aggregator.js` (M40 D4) | Assistant-frame-vs-result-frame usage precedence; D1 + D3 reuse these helpers |
| `.gsd-t/contracts/metrics-schema-contract.md` | Schema v1 record shape |
| `.gsd-t/contracts/stream-json-sink-contract.md` v1.1.0 | Which frames carry authoritative usage |
| `bin/gsd-t-token-capture.cjs` (D1 output) | The wrapper is the source of truth for row formatting — D2, D3, D4 all depend on it |
| `scripts/gsd-t-stream-feed.html` (M40 D5) | `humanizeTokens` + `formatCost` — D4 must match |

## External Reference Dispositions (Assumption Audit Category 1)

| Reference from M41 definition | Disposition | Notes |
|-------------------------------|-------------|-------|
| `scripts/gsd-t-token-aggregator.js` | **USE** | Import envelope-parse helpers; do not modify |
| `scripts/gsd-t-stream-feed.html` | **INSPECT** | Read `humanizeTokens` + `formatCost` for parity; do not import from HTML |
| `bin/gsd-t-orchestrator.js` worker spawn path | **INSPECT** | Already captures usage via stream-json sink (M40). Understand how, don't rewire. |
| `commands/gsd-t-execute.md` | **USE** (as reference target for D2) | Convert in isolation first as the worked example |
| Historical `.gsd-t/headless-*.log` | **USE** (read-only) | D3 parses these; never deletes or rotates |
| Historical `.gsd-t/events/*.jsonl` | **USE** (read-only) | D3 parses these; never deletes or rotates |

## User Intent Locked-In Interpretations (Assumption Audit Category 4)

| Ambiguous phrase from M41 definition | Interpretations | Locked |
|--------------------------------------|-----------------|--------|
| "universal token capture" | (a) every spawn surface, (b) only new spawns going forward | **(a)** — D3 backfills the historical record; D1+D2 cover forward |
| "missing usage" handling | (a) write `0`, (b) write `—`, (c) write `N/A` | **(b)** — `—` means "gap acknowledged", never `0` (a zero is a measurement) and never `N/A` (the old convention being retired) |
| "enforcement" (D5) | (a) hard fail on any bare spawn, (b) warn in CI, (c) opt-in pre-commit hook + MUST rule in CLAUDE | **(c)** — opt-in hook for ship; methodology rule blocks from day 1; automatic hook installation deferred to post-shakedown |
| "dashboard" (D4) | (a) web UI, (b) CLI table | **(b)** — M40 D5 is the live web UI; M41 D4 is the historical CLI view. No second web server. |
| "backfill" (D3) | (a) retroactively rewrite old `N/A` rows, (b) append backfill-only JSONL | **both** — `--patch-log` rewrites rows in place; default writes JSONL-only with `source: "backfill"` marker |

---

## Prior Milestone Archives

Previous integration-points content (M40 and earlier) is preserved in milestone archives under `.gsd-t/milestones/`. Most recent: `M40-external-task-orchestrator-2026-04-20/`.
