# Scope: m93-jargon-lint (M93 D3 — the file-surface gate)

## Mission
A deterministic lint for WRITTEN artifacts — the surface the Stop hook (D1) can't reach. The user's exhaustion includes documents (briefs, progress entries, contracts) full of unglossed `S2-M7` / `HC-003` / acronyms. D3 flags an unglossed high-signal jargon token in a target doc so it gets glossed before commit. This is what would have surfaced the "contract item I don't remember agreeing to" in plain language at decision time.

## Files Owned
- `bin/gsd-t-jargon-lint.cjs` (new)
- `test/m93-jargon-lint.test.js` (new)

## What it does
Given a markdown file (or text on stdin), find high-signal code tokens (`S2-M\d+`, `HC-\d+`, `M\d+(-D\d+)?`, ALL-CAPS acronym ≥3 not in an allowlist) and report any whose FIRST occurrence has no plain-language gloss nearby (same sentence or an adjacent parenthetical). Exit 0 (clean) / 4 (unglossed tokens, named with line numbers) / 64 (bad input). Zero deps, never throws, pure.

## Scope discipline (avoid over-reach)
- This is an OPT-IN lint for user-facing decision docs (briefs, milestone definitions) — NOT a blanket gate on every file (code comments, archived milestones, machine-written logs are exempt; an allowlist of exempt path patterns mirrors the date-guard's allowlist).
- It does NOT auto-fix — it FLAGS, naming the token + line, so the author glosses it. (Auto-glossing is an LLM judgment; out of scope.)
- Conservative allowlist (GSD-T, QA, CLI, API, URL, DB, JSON, HTML, HTTP, NDJSON, DTO, timezones, AND/OR/NOT, common English caps) so it doesn't false-flag.

## Out of scope
- The Stop hook (D1) — that handles live replies; D3 handles files.
- Wiring D3 into the Pre-Commit Gate / a workflow (integrate-seam — D3 ships the lint CLI + documents the invocation; wiring it into complete-milestone's doc checks or a commit hook is integrate).
- The Reader Contract prose (D2).

## Deterministic-gate bar
Pure, zero-dep, never-throws. Killing test: a doc with a bare `HC-003` → exit 4 naming it; the same doc with `HC-003 (the "never contact buyer" rule)` → exit 0; an allowlisted acronym (`CLI`) → never flagged; exempt path → skipped.
