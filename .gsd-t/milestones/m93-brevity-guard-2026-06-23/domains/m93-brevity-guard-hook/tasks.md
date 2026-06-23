# Tasks: m93-brevity-guard-hook (M93 D1 — the gate)

## Files Owned
- `scripts/gsd-t-brevity-guard.js`
- `test/m93-brevity-guard.test.js`

---

### M93-D1-T1 — The brevity-guard Stop hook
**Touches**: `scripts/gsd-t-brevity-guard.js`
**PseudoCode-Section**: (n/a)
A `Stop` hook. Read JSON on stdin (`{transcript_path, stop_hook_active}`). Extract the last
assistant message by scanning the transcript JSONL tail (REUSE the
`gsd-t-conversation-capture.js::_readAssistantFromTranscript` approach — text blocks
concatenated, tool_use/thinking ignored; do NOT re-invent, copy the proven tail-scan). Then:
- **Loop-guard:** if `stop_hook_active === true` (this Stop is already a re-entry from a prior
  block), EXIT 0 — never block twice on the same turn (prevents an infinite rewrite loop).
- **Mode classify:** ACTION-mode if the latest assistant turn carried mutating tool_use blocks
  (Write/Edit/NotebookEdit, or Bash with a write/mutation) OR the message has tool_use blocks and
  empty text → ALLOW (exit 0). ANSWER-mode if it is a pure-text reply.
- **ANSWER-mode detection (conservative BLOCK):**
  - **process-narration:** ≥2 leading narration sentences before the first substantive sentence
    (narration = intent-without-content: `/^(let me|before i|i'?ll|i'?m going to|first,? let me|i want to|let's)\b/i`
    style openers that state what the reply is about to do rather than answering). Skip the dated
    banner line. ONE narration sentence is allowed (a brief "good instinct" / direction ack is fine);
    TWO+ stacked is the egregious case the user flagged.
  - **unglossed jargon:** a high-signal code token (`/\bS2-M\d+\b/`, `/\bHC-\d+\b/`, `/\bM\d+(-D\d+)?\b/`,
    an ALL-CAPS acronym `/\b[A-Z]{3,}\b/` NOT in the allowlist) on its FIRST occurrence with no gloss
    in the same sentence or an adjacent parenthetical. Allowlist: GSD-T, QA, CLI, API, URL, DB, JSON,
    HTML, CSS, HTTP, NDJSON, DTO, PDT/EST/UTC, AND, OR, NOT (extend conservatively).
- **Block:** on a detected ANSWER-mode violation → emit `{"decision":"block","reason":"<concise why + the rule>"}` on stdout (and exit 0 per the Stop-hook block contract) OR exit 2 with the reason on stderr — whichever the installed Claude Code Stop-hook contract honors; the reason tells the model to rewrite answer-first / gloss the term. The reason itself MUST be concise (dog-food the rule).
- **Fail-OPEN, always:** any internal error, unreadable transcript, malformed payload, no assistant
  message → EXIT 0 (never block). A broken guard must never gag a legitimate reply.
Zero deps, pure, defensive. CLI-testable: accept a `--text <reply> --mode answer|action` path so the
detector is unit-testable WITHOUT a transcript.
**Acceptance criteria**: action-mode reply (intent-first, or tool_use turn) → ALLOW; answer-mode reply with ≥2 leading narration sentences → BLOCK with a concise reason; answer-mode reply with a bare unglossed `HC-003`/`S2-M7` → BLOCK; the same reply with the term glossed → ALLOW; the user-approved answer-first format → ALLOW; `stop_hook_active:true` → ALLOW (no double-block); ANY error/malformed input → exit 0 (fail-open). Reason text is itself concise.
**Files**: `scripts/gsd-t-brevity-guard.js`.
**Test**: M93-D1-T2.
**Headline**: true

### M93-D1-T2 — Killing test for the brevity guard
**Touches**: `test/m93-brevity-guard.test.js`
**PseudoCode-Section**: (n/a)
Drive the detector via the `--text/--mode` CLI path (no transcript needed) with byte-known fixtures:
- **BLOCK (answer-mode):** a reply opening with 3 narration sentences ("Important question. Let me
  find the record. Before I say anything, I should check…") then the answer → BLOCK (this is the
  EXACT failure the user cited — non-vacuous).
- **ALLOW (action-mode):** the SAME intent-first opener but mode=action (about to edit code) → ALLOW
  (intent-first is wanted in action-mode — proves the discriminator, not a blanket ban).
- **ALLOW (answer-first):** the user-approved rewrite format (answer first, bullets, glossed) → ALLOW.
- **BLOCK (jargon):** a reply with a bare `HC-003` / `S2-M7` / `M92-D1` and no gloss → BLOCK.
- **ALLOW (glossed):** the same reply with `HC-003 (your "never contact the buyer" rule)` → ALLOW.
- **ALLOW (one ack):** a single direction-acknowledgement sentence before the answer → ALLOW (one is fine).
- **FAIL-OPEN:** malformed payload / empty text / unreadable → exit 0.
- **Loop-guard:** `stop_hook_active:true` → exit 0.
**Acceptance criteria**: all 8 fixtures assert the exact ALLOW/BLOCK decision; the action-vs-answer discriminator proven (same opener, opposite decision by mode); fail-open + loop-guard proven; a BLOCK reason is non-empty and itself concise.
**Files**: `test/m93-brevity-guard.test.js`.
**Test**: this IS the test.

---

**INTEGRATE-SEAM (serial):** wire the hook into `~/.claude/settings.json` Stop array + the installer's settings template (so propagation installs it). Document the settings entry in the hook header.
