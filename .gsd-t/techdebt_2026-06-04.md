# Tech Debt Register — 2026-04-16 (Scan #11)

## Summary
- **Critical items**: 0 new (1 carried — TD-097 graph-query injection, status unverified)
- **High priority**: 3 new (TD-102, TD-103, TD-104) — all RESOLVED by M38 (v3.12.10)
- **Medium priority**: 4 new (TD-105 through TD-108)
- **Low priority**: 4 new (TD-109 through TD-112)
- **Total new this scan**: 11
- **Total estimated effort**: ~1.5 small milestones (one doc-ripple sweep + one quality pass + ad-hoc cleanup)
- **Previous scan archive**: `techdebt_2026-03-19.md`

**Trend**: post-M37/v3.11.11. The Universal Auto-Pause and local-estimator changes
landed cleanly in production code but left a documentation/contract trail of stale
references to the retired count_tokens API + ANTHROPIC_API_KEY requirement. The
project CLAUDE.md is also still describing the M34-retired task-counter as the "real
guard". Highest-impact items are documentation-class, not code-class — but one stale
test (Q-T01 / SEC-H02) covers the privacy invariant for the deleted code path and
must be repaired before its replacement can be trusted.

---

## Critical Priority

_None new in Scan #11._

> **Carried from Scan #10**: TD-097 (graph-query.js command injection via
> `params.entity`). Verify fix status before next milestone closes. See archive
> `.gsd-t/techdebt_2026-03-19.md`.

---

## High Priority
Items that should be addressed in the next 1–2 milestones.

### TD-102: Stranded context-meter tests after v3.11.11 (privacy invariant at risk)
- **Category**: quality / security
- **Severity**: HIGH
- **Status**: RESOLVED — M38 (v3.12.10) `scripts/gsd-t-context-meter.test.js` rewritten for single-band estimator; 7 stranded tests green
- **Location**: `scripts/gsd-t-context-meter.test.js` (tests 2, 3, 4, 6, 7b, 10c, 11)
- **Description**: 7 tests reference the removed `_countTokens` injection or assert
  on the old log fixture (`tokens=42`). Source was migrated to `_estimateTokens` in
  commit b521019; tests were not. Failing 7/1231.
- **Impact**: privacy-content invariant (test 11) no longer enforced — if the new
  estimator code path were to start logging raw text, no test would catch it. Same for
  fail-open and missing-config edge cases.
- **Remediation**: rewrite the 7 tests against the new estimator API. Preserve the
  privacy assertion with the new log format (`tokens=N pct=X.X band=Y`). Add an
  `_estimateTokens` injection that throws to confirm fail-open still holds.
- **Effort**: small (1–2h, one file)
- **Milestone candidate**: NO — fold into the next patch (v3.11.12) or a "post-v3.11.11
  doc-ripple" cleanup milestone.
- **Promoted**: [ ]

### TD-103: Stale `count_tokens` / `ANTHROPIC_API_KEY` documentation across user-facing surfaces
- **Category**: quality (documentation security)
- **Severity**: HIGH
- **Status**: RESOLVED — M38 (v3.12.10) CD domain doc-ripple updated all 9 living documents; context-meter-contract v1.3.0 rewrites purpose section; methodology §3–§5 historical framing added
- **Location**: README.md (10 hits), docs/infrastructure.md (12), docs/architecture.md
  (4), docs/methodology.md, docs/requirements.md (2),
  `.gsd-t/contracts/context-meter-contract.md` (16, partial update), CHANGELOG.md
  (multiple), commands gsd-t-execute.md, gsd-t-resume.md, gsd-t-wave.md,
  templates/CLAUDE-project.md.
- **Description**: v3.11.11 deleted the count_tokens API path and removed the
  `ANTHROPIC_API_KEY` requirement, but only the doctor command and installer were
  updated. User-facing docs still tell users to set the key, describe the contract as
  "API-based", and explain the bandFor classification through the lens of API responses.
- **Impact**: new users export an API key thinking it gates the meter — a false trust
  boundary. Existing users may keep stale shell-init lines that have nothing to do
  with current behavior. Also breaks the "no re-research" rule: the docs lie.
- **Remediation**: full doc-ripple pass:
  1. README — gate the "API key" section behind a clear "OPTIONAL" header; remove
     "you must set" claims.
  2. context-meter-contract — rewrite Purpose paragraph + Field reference + audit
     `apiKeyEnvVar` field's deprecation status.
  3. infrastructure.md / architecture.md / methodology.md — remove obsolete narrative;
     keep historical note in a "v2.75–v3.11" subsection.
  4. command files — drop API key references from execute / resume / wave preambles.
  5. CLAUDE-project.md template — remove the "Requires ANTHROPIC_API_KEY" comment.
- **Effort**: medium (4–8h, ~12 files)
- **Milestone candidate**: YES — recommended as a tightly scoped "v3.11.11 Doc Ripple"
  cleanup milestone (M38 candidate).
- **Promoted**: [ ]

### TD-104: Project `CLAUDE.md` describes the retired `bin/task-counter.cjs` as the "real guard"
- **Category**: quality (documentation)
- **Severity**: HIGH
- **Status**: RESOLVED — M38 (v3.12.10) CD-T5 updated project CLAUDE.md; task-counter.cjs prose retired; Context Meter section updated to single-band v1.3.0
- **Location**: `/Users/david/projects/GSD-T/CLAUDE.md` — sections "Observability
  Logging" and the "Orchestrator Task-Count Gate" subsection.
- **Description**: M34 (v2.75.10) retired `bin/task-counter.cjs` and the install/update
  migration deletes it from downstream projects. Live commands (gsd-t-execute,
  gsd-t-wave) and global `~/.claude/CLAUDE.md` were updated. The project-local
  `CLAUDE.md` still instructs the orchestrator to call `node bin/task-counter.cjs
  status` / `should-stop` / `increment task` and frames the task-counter as the real
  guard.
- **Impact**: any agent that reads project CLAUDE.md (which always happens at session
  start in this repo) gets contradictory instructions vs the global CLAUDE.md and the
  live command files. The agent will try to call a script that doesn't exist or follow
  rules that don't apply.
- **Remediation**: replace the stale section with the M34/M35/M37 narrative
  (context-meter + token-budget + universal auto-pause). Mirror the language from the
  global `CLAUDE-global.md` template — that file is correct.
- **Effort**: small (1h)
- **Milestone candidate**: NO — fold into TD-103's doc-ripple milestone.
- **Promoted**: [ ]

---

## Medium Priority
Items to plan for but not urgent.

### TD-105: Two parallel dashboard implementations — agent dashboard unwired
- **Category**: architecture / dead code
- **Severity**: MEDIUM
- **Status**: OPEN
- **Location**: `scripts/gsd-t-agent-dashboard-server.js`,
  `scripts/gsd-t-agent-dashboard.html` (untracked / new this session).
- **Description**: a second SSE dashboard exists (port 7434) alongside the original
  metrics dashboard (port 7433). The new one has zero references in commands, CLI,
  README, or contracts.
- **Impact**: ships in the npm package (scripts/ is in `package.json#files`) so
  downstream consumers receive ~2 unused files. Confusion for new contributors who
  see two dashboards and can't tell which is canonical. Doubles the "unauth localhost
  port" surface (TD-090 carried).
- **Remediation**: decide direction. Either
  (a) add `gsd-t-visualize-agents` command (or `gsd-t-visualize --agents` flag),
      add port 7434 + endpoints to `dashboard-server-contract.md`, document in README,
      add tests; OR
  (b) delete both files and the corresponding skip rule (if any) from `bin/gsd-t.js`.
- **Effort**: small (delete) or medium (full wire-up).
- **Milestone candidate**: NO — fold into a quality cleanup pass.
- **Promoted**: [ ]

### TD-106: 76 `heartbeat-*.jsonl` files cluttering `.gsd-t/`
- **Category**: housekeeping / minor performance
- **Severity**: MEDIUM
- **Status**: OPEN
- **Location**: `.gsd-t/heartbeat-*.jsonl`
- **Description**: gitignored (verified) but accumulating in the working tree —
  76 files / ~9.7 MB total `.gsd-t/`. No rotation rule.
- **Impact**: slow `ls`, slow `du`, slow scan walks. If user `tar`s `.gsd-t/` to share
  state with a teammate, all session telemetry travels with it (low risk; gitignore
  already handles git-side leakage).
- **Remediation**: add a session-end cleanup hook (in `gsd-t-pause` or a new
  `gsd-t doctor --gc`) that rotates heartbeats >7 days old into
  `.gsd-t/heartbeat-archive/` (or deletes them entirely).
- **Effort**: small.
- **Milestone candidate**: NO.
- **Promoted**: [ ]

### TD-107: Paired `.js` / `.cjs` files have no drift-detection check
- **Category**: quality / risk
- **Severity**: MEDIUM
- **Status**: OPEN
- **Location**: `bin/gsd-t-unattended.{js,cjs}`,
  `bin/gsd-t-unattended-platform.{js,cjs}`,
  `bin/gsd-t-unattended-safety.{js,cjs}`,
  `bin/runway-estimator.{js,cjs}`,
  `bin/token-telemetry.{js,cjs}`,
  `bin/headless-auto-spawn.{js,cjs}`,
  `bin/handoff-lock.{js,cjs}`.
- **Description**: 7 paired modules where `.js` and `.cjs` must stay in sync. No CI
  check exists.
- **Impact**: a future fix to one half can silently diverge from the other; bugs reach
  production via whichever consumer (hook vs CLI) is invoked first.
- **Remediation**: add a `test/paired-files.test.js` that compares exported symbols +
  line counts (±10%) for each pair. Fail CI on mismatch. Or, longer-term, generate the
  `.cjs` from the `.js` at publish time and check the generated artifact in.
- **Effort**: small.
- **Milestone candidate**: NO.
- **Promoted**: [ ]

### TD-108: Threshold-band classification implemented in two places
- **Category**: duplication / drift risk
- **Severity**: MEDIUM
- **Status**: OPEN
- **Location**: `bin/token-budget.cjs` `bandFor`, `scripts/context-meter/threshold.js`
  `bandFor`.
- **Description**: same logic, two implementations. The meter side
  (`scripts/context-meter/threshold.js`) is canonical (M35 contract).
- **Impact**: a tweak to the band cutoffs in one file silently disagrees with the
  other; gates fire at different thresholds.
- **Remediation**: have `bin/token-budget.cjs` `require('../scripts/context-meter/threshold.js')`
  for `bandFor` instead of re-implementing. Add a regression test that asserts both
  sides return the same band for the same input across the boundaries (69, 70, 84, 85, 100).
- **Effort**: small.
- **Milestone candidate**: NO — fold into TD-107's quality pass.
- **Promoted**: [ ]

---

## Low Priority
Nice-to-haves and cleanup.

### TD-109: Bump `engines.node` from `>=16` to `>=18` (or `>=20`)
- **Category**: dependency / hygiene
- **Severity**: LOW
- **Status**: OPEN
- **Location**: `package.json`
- **Description**: Node 16 reached EOL April 2024. Project still declares `>=16`.
- **Impact**: npm prints EOL warnings to users; CI matrix may include a dead version.
- **Remediation**: bump to `>=18.17` (current LTS minor) or `>=20.10`. Verify
  `node --test` syntax used remains compatible (it is).
- **Effort**: trivial.
- **Promoted**: [ ]

### TD-110: `scripts/context-meter/` lives outside `bin/` despite being library code
- **Category**: organization
- **Severity**: LOW
- **Status**: OPEN
- **Location**: `scripts/context-meter/{estimate-tokens,threshold,transcript-parser}.{js,test.js}`
- **Description**: pure library modules required by `scripts/gsd-t-context-meter.js`
  (the hook). Other library code lives in `bin/`. Inconsistent organization.
- **Remediation**: move to `bin/context-meter/` and update one require path.
- **Effort**: trivial.
- **Promoted**: [ ]

### TD-111: Working notes accumulate in `.gsd-t/` root
- **Category**: housekeeping
- **Severity**: LOW
- **Status**: OPEN
- **Location**: `.gsd-t/continue-here-*.md` (6), `.gsd-t/brainstorm-*.md` (4),
  `.gsd-t/M*-*-findings.md` (3+).
- **Description**: working notes pile up; no archival rule like
  `progress-archive/` and `milestones/`.
- **Remediation**: define archival semantics. Move continue-here-* into
  `.gsd-t/progress-archive/` after they expire (e.g., next session). Move
  brainstorm-* / M*-findings.md into the relevant milestone archive once the
  milestone closes.
- **Effort**: small.
- **Promoted**: [ ]

### TD-112: Test layout split — `test/` vs `scripts/*.test.js` vs `scripts/context-meter/*.test.js` vs `bin/*.test.cjs`
- **Category**: organization
- **Severity**: LOW
- **Status**: OPEN
- **Location**: 4 test discovery roots.
- **Description**: easy to forget one when running scoped subsets; `npm test` picks
  them all up via `node --test` walking, but ad-hoc invocations
  (`node --test test/`) miss the scripts and bin tests.
- **Remediation**: either consolidate (`test/context-meter/`, `test/bin/`) or
  document the convention in CONTRIBUTING.md / CLAUDE.md.
- **Effort**: small (consolidate) or trivial (document).
- **Promoted**: [ ]

---

## Dependency Updates

| Package | Current | Latest | Breaking? | Priority |
|---------|---------|--------|-----------|----------|
| (none — zero declared deps) | — | — | — | — |
| `engines.node` | `>=16` | `>=18` LTS | no | LOW (TD-109) |

`npm audit` cannot run — no `package-lock.json` (no deps). Recommend generating a
lockfile in CI to catch any future dep additions.

---

## Suggested Tech Debt Milestones

### Suggested: Post-v3.11.11 Doc & Test Ripple (recommended as M38)
Combines: TD-102, TD-103, TD-104  (and optionally TD-105 if scope allows).
- Estimated effort: 1 small milestone (1–2 days).
- Should be prioritized: **BEFORE next feature milestone**.
- Why: closes the trail left by yesterday's v3.11.11 patch; restores doc/test alignment
  with shipped behavior; one of the items (TD-102) is a privacy-invariant test gap
  that should not sit open.

### Suggested: Quality & Hygiene Sweep (defer until M39+)
Combines: TD-105 (decision), TD-107, TD-108, TD-110, TD-112.
- Estimated effort: 1 small milestone.
- Can be scheduled: AFTER current feature work.
- Why: drift-prevention (paired files), code reuse (band classification), and code
  organization. None blocking. Group together to avoid death-by-a-thousand-cuts PRs.

### Suggested: Housekeeping (ad-hoc)
Combines: TD-106, TD-109, TD-111.
- Estimated effort: a single afternoon.
- Can be scheduled: during any maintenance window or as a backlog fill task.

---

## Scan Metadata
- Scan date: 2026-04-16
- Scan number: 11
- Files analyzed: 218 source files (49 bin, 12 scripts top-level, 6 context-meter,
  61 commands, 38 tests, ~29 templates) — plus 16 docs and 40 contracts.
- Lines of code (approx): bin/ ~19,931 + scripts/ ~5,837 + commands/ ~14,663 +
  test/ ~13,694 + templates/ ~9,890 ≈ **64,000 LOC** (markdown + JS combined).
- Languages: JavaScript (Node.js), Markdown (commands/templates as primary "source").
- Previous scan archive: `techdebt_2026-03-19.md`
- TD numbering: continues from TD-101 (last in archive). New range: TD-102 → TD-112.
