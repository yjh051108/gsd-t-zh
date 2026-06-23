# Scope: m93-brevity-guard-hook (M93 D1 — the gate)

## Mission
A `Stop` hook that BLOCKS exhausting replies before the user reads them — the deterministic enforcement the prose rule never had. On each response, read the last assistant message, classify ANSWER-mode vs ACTION-mode, and in answer-mode block egregious preamble / process-narration / unglossed jargon (forcing a rewrite). Tuned CONSERVATIVE per the user: catch the egregious cases, never police every word.

## Why this is the right mechanism (proven, not speculative)
- The `Stop` hook is already wired (`~/.claude/settings.json`). Precedent: `gsd-t-conversation-capture.js` is a Stop hook that already reads the last assistant message from `transcript_path` by scanning the JSONL tail — D1 REUSES that extraction.
- The block precedent: `scripts/gsd-t-date-guard.js` blocks bad output via exit 2 + stderr, FAIL-OPEN on error. D1 follows the same pattern (Stop-hook block = `{"decision":"block","reason":...}` on stdout, or exit 2).

## The mode discriminator (the hard part — but it's already encoded in the transcript)
- **ACTION-mode** = the turn is about to change something → the latest assistant turn carries tool_use blocks (Write/Edit/Bash-mutation). Intent-first is WANTED here → ALLOW.
- **ANSWER-mode** = a pure-text reply to a question → the latest assistant turn has text blocks, no mutating tool calls → ENFORCE answer-first.
- The capture hook's tail-scan already distinguishes "text blocks present" vs "tool_use-only" — D1 builds the discriminator on that signal.

## Files Owned
- `scripts/gsd-t-brevity-guard.js` (new — the Stop hook)
- `test/m93-brevity-guard.test.js` (new)

## Out of scope
- Wiring the hook into `settings.json` (D-integrate / installer — D1 ships the script + documents the settings entry; the live `~/.claude/settings.json` wiring is an integrate step).
- The Reader Contract prose (D2). The commit-time jargon lint for files (D3).

## Detection rules (conservative thresholds — block ONLY the egregious)
- **Process-narration before answer (ANSWER-mode):** block when ≥2 narration sentences precede the first substantive sentence. Narration = first-person "about to" framing ("Let me find / check / verify…", "Before I answer…", "I'm going to…", "First, let me…") that states intent without content. (ACTION-mode: these are fine — do NOT block.)
- **Unglossed jargon:** block when a known code-token pattern (`S2-M\d+`, `HC-\d+`, `M\d+-D\d+`, an ALL-CAPS acronym ≥3 letters not in an allowlist) appears with NO plain-language gloss within the same sentence/parenthetical on first use. Conservative: only the high-signal patterns; an allowlist (GSD-T, QA, CLI, API, URL, DB, …) is exempt.
- Always allow: the dated banner (first line), tables, code blocks, the user-approved answer-first format.

## Deterministic-gate bar
Pure text analysis, zero LLM, zero deps, never throws (fail-OPEN — a broken guard must NEVER block a legitimate reply). Killing test against seeded answer-mode-verbose (BLOCK), action-mode-intent (ALLOW), answer-first-clean (ALLOW), glossed-jargon (ALLOW), bare-jargon (BLOCK) fixtures.
