# Constraints: d6-scan-wiring

## Must Follow
- **Zero external runtime deps for the installer** — wiring edits invoke the existing query CLI; no new dependency.
- **Extend-class change** (R-ARCH-2): `commands/gsd-t-scan.md` and `templates/workflows/gsd-t-scan.workflow.js` are EXISTING files — read them first, adapt to their structure, do NOT replace working scan functionality (Destructive Action Guard).
- **Runtime-native invariant (M81)**: `gsd-t-scan.workflow.js` runs in the sandbox — ONLY `agent/parallel/pipeline/log/phase/budget/args`, no `require`/`fs`/`path`/`child_process`/`process`; `args` is a JSON STRING. Delegate any CLI call (the query CLI) to an inline `async` helper running it via an `agent()`'s Bash.
- Consume D5's `graph-query-cli-contract.md` (the JSON envelope) as FROZEN.
- **[RULE] scan-injects-structural-slice** — /scan (index warm) queries the index via the D5 CLI for the pre-computed structural slice (dependents/dead-code/cycles/coupling) and INJECTS it ADDITIVELY into the `scanSlice` deep-finders so those findings are accurate, NOT LLM-reconstructed; the current scan architecture is KEPT INTACT (additive only).
- Fall back to grep mode ONLY on `graph-unavailable`, and ANNOUNCE it (never silent).
- Pre-Commit Gate: command-file behavior change → update `GSD-T-README.md` + `README.md` + `templates/CLAUDE-global.md` + `commands/gsd-t-help.md` if the scan interface changes (handled at execute/integrate time, flagged here).
- **AC-4 = INSIGHT DELTA ONLY** (user rescope 2026-06-25): record both structural-findings sets (no-graph baseline vs graph-wired) + the named ≥1 finding the no-graph run missed/got wrong, on a pinned Atos SHA, in `progress.md` + `CHANGELOG.md` (the headline win). NO wall-clock / speed / files-read assertion — that axis is DROPPED from M94, deferred to a separate scan-redesign milestone.

## Must Not
- Modify any `bin/gsd-t-graph-*.cjs` (build trio + spike files) — D6 is a thin consumer.
- Replace existing scan functionality — extend it.
- Reintroduce `require`/`fs`/`child_process` into the scan workflow (sandbox-forbidden).
- Grep when the index is live — only fall back on announced graph-unavailable.

## Dependencies
- Depends on: d5-query-cli (graph-query-cli-contract — the JSON envelope), and the full Wave-2 build trio (d3+d4+d5) integrated. BLOCKED until Wave 2 completes (Wave 3).
- Depended on by: nothing (the terminal consumer — the falsifiable payoff).
