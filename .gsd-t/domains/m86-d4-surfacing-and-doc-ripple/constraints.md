# Constraints: m86-d4-surfacing-and-doc-ripple

## Hard Invariants

- **No silent degradation (SC(f)).** The banner/statusline/status MUST NAME the active profile.
  When `.gsd-t/model-profile.json` is absent, show the GLOBAL DEFAULT by name (e.g.
  `profile: premium (default)`) — never blank, never an implicit unsurfaced fallback. Mirrors
  `feedback_no_silent_degradation.md`.
- **Surfacing consumes the resolver — does not reimplement it.** D4 reads the active profile via
  D1's resolver/config-read surface. It MUST NOT re-hardcode profile→tier maps or the config
  schema (single source of truth = D1).
- **Template/live parity.** Editing `templates/CLAUDE-global.md` requires FLAGGING the live
  `~/.claude/CLAUDE.md` equivalent to the user (the global directive: template AND live must
  match). D4 does NOT silently edit the user's live `~/.claude/CLAUDE.md` — it surfaces the diff
  and lets the user/CPUA apply it (the live file is OWNED by D2 in one salvage variant, but in
  this winning structure the live mirror is a FLAG, not a D4 write — keep `~/.claude/CLAUDE.md`
  out of D4's owned set).
- **Version bump shape.** Minor bump (new feature): patch resets to `10` (two-digit convention).
  Bump in `package.json`; progress.md/README version line bump is part of complete-milestone, not D4.
- **Banner must not break the date-guard.** `scripts/gsd-t-auto-route.js` emits `[GSD-T NOW]` and
  the banner token — adding a profile token MUST NOT alter the `[GSD-T NOW]` timestamp format the
  date-guard depends on.

## File-Disjointness (re-validated by partition oracle)

- This domain WRITES ONLY: `scripts/gsd-t-auto-route.js`, `scripts/gsd-t-statusline.js`,
  `commands/gsd-t-status.md`, `commands/gsd-t-help.md`, `README.md`, `GSD-T-README.md`,
  `templates/CLAUDE-global.md`, `CLAUDE.md`, `package.json`, `test/m86-surfacing.test.js`.
- `scripts/gsd-t-statusline.js` is owned EXCLUSIVELY by D4 (the salvage variant that put it in D1
  is REJECTED to preserve disjointness — D4 owns all surfacing).
- Does NOT touch `bin/`, the contract, workflow source, invoker commands, or the lint.
- `~/.claude/CLAUDE.md` (live global) is NOT in D4's owned set — it is a FLAGGED-for-user mirror.

## Pre-Commit Gate (domain-specific)

- Command added (`model-profile`) → README commands table + gsd-t-help + CLAUDE-global updated
  HERE (D4 owns the doc surface; D1 owns only the dispatch/propagation code).
- Command-file/behavior changed → GSD-T-README + README + CLAUDE-global + gsd-t-help in one pass.
- Statusline/banner changed → smoke the script output; confirm `[GSD-T NOW]` format intact.
