# Constraints: m93-brevity-guard-hook (M93 D1)

- Zero external deps; pure text analysis; ZERO LLM (deterministic gate).
- **FAIL-OPEN is non-negotiable.** Any error / malformed payload / unreadable transcript / no assistant message → exit 0 (allow). A broken brevity guard must NEVER block a legitimate reply — the cost of a false-block (gagging real work) far exceeds a missed-verbose-reply.
- **Conservative thresholds.** Block only the egregious: ≥2 stacked narration sentences, or a bare high-signal jargon token. One direction-ack sentence is fine. Do not police word count, tone, or every acronym.
- **Action-mode is EXEMPT from the answer-first rule** — intent-first before a code change is wanted. The discriminator (tool_use turn / about-to-mutate → action) gates this.
- The dated banner (first line) is always allowed; tables + code blocks are content, never "preamble."
- Loop-guard: respect `stop_hook_active` — never block a re-entry (no infinite rewrite loop).
- The block REASON must itself be concise (dog-food the rule).
- Do NOT edit `settings.json` (integrate-seam) or any D2/D3 file. File-disjoint from D2 (CLAUDE-global + prompts) and D3 (the commit lint + its test).
- REUSE the `gsd-t-conversation-capture.js` transcript-tail extraction — do not re-invent it.
