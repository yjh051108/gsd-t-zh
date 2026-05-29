# Constraints: m65-d1-orchestration-shell-retirement

## Must Follow
- **Destructive Action Guard (MANDATORY)** — every file deletion runs a zero-live-reference scan FIRST (`grep -rln "<basename>" bin scripts templates commands test | grep -v node_modules | grep -v <self>`). The changeset touches >3 files, so execute pauses to confirm the deletion list before removing working code.
- **Inline-then-delete ordering** — for `headless-exit-codes.cjs` and `gsd-t-orchestrator-config.cjs`, the inline edit lands and the suite is green BEFORE the source file is `rm`'d. Never delete a file a survivor still requires.
- CLI conventions: zero external runtime deps, ANSI via escape codes, sync file APIs (CLAUDE.md § Conventions).
- After removing `case "orchestrate"`: update `bin/gsd-t.js` command-count logic + help output to stay consistent (project Pre-Commit Gate: "Command added/removed → update command-counting logic").
- Project Pre-Commit Gate: a removed CLI subcommand (`orchestrate`) is a command-surface change → check `GSD-T-README.md` + `README.md` commands table + `templates/CLAUDE-global.md` + `commands/gsd-t-help.md` for any `orchestrate` reference and clean it.

## Must Read Before Using (Black Box — Category 3)
- `bin/gsd-t-parallel.cjs` lines 40–60, 160–170, 230–265 — the exact call signatures of `computeInSessionHeadroom`/`computeUnattendedGate`/`DEFAULT_SUMMARY_SIZE_PCT` before inlining. Inlined behavior must be identical.
- `bin/gsd-t-orchestrator-config.cjs` lines 7–80 — the source of the 3 inline targets + their 3 dependency constants.
- `bin/gsd-t.js` lines 40–41, 2482, 3512, 3607, 4243, 4170, 4379 — all `headless-exit-codes`/`mapHeadlessExitCode`/`orchestrate` touch points (the call site at 3607 must keep working post-inline).
- `bin/gsd-t-verify-gate.cjs:31` + `templates/workflows/_lib.js:107` — proof that `parallel-cli.cjs` and `gsd-t-parallel.cjs` are load-bearing KEEP files; verify they still resolve after the work.

## Must Not
- Modify, delete, or change the behavior of any KEEP-list file (`parallel-cli.cjs`, `parallel-cli-tee.cjs`, `gsd-t-verify-gate.cjs`, `_lib.js`, etc.) — the ONLY permitted KEEP edit is the surgical inline into `gsd-t-parallel.cjs`.
- Delete `bin/orchestrator.js` or `bin/design-orchestrator.js` (OUT of M65 scope — separate backlog item).
- Delete `parallel-cli.cjs` / `parallel-cli-tee.cjs` / `gsd-t-parallel.cjs` (raw-brief named them; live scan disproved — they are substrate).
- Change `mapHeadlessExitCode`'s logic during inline — the 5-code contract (0/1/2/3/4/5) + the terminal-marker regexes must be copied verbatim (M45 false-positive history: bare "tests failed" substring caused a halt — keep the boundary-anchored regexes intact).
- Introduce any new test failure beyond the 22 M61-carryover baseline fails.

## Dependencies
- Depends on: nothing (single domain, no cross-domain contracts).
- Depended on by: nothing (CLI-internal demolition; no consumer surfaces).

## Acceptance (mirrors progress.md SCs)
- SC1: 8 files deleted; bin/ −~1,838 LOC (22,051 → ~20,213), reported as measured delta. Not gated on M61 ≤12K umbrella.
- SC2: every deleted file proven zero-live-reference before deletion; KEEP files still resolve + still required by verify-gate + _lib.
- SC3: no NEW test fails beyond 22-carryover baseline (1427 pass / 22 fail / 3 skip / 1452 total); the 6 deleted test files drop from the denominator.
- SC4: `gsd-t doctor` clean, no dangling refs; `gsd-t-resume.md` no longer points at `gsd-t-orchestrator-recover.cjs`.
- SC5: `mapHeadlessExitCode` works post-inline (call site 3607 + smoke assertion).
- SC6: retire→native map updated (orchestrate→execute.workflow, spawn-plan→/workflows+Agent View, headless-exit→inlined).
