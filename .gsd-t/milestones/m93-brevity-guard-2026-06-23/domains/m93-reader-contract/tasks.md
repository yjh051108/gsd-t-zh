# Tasks: m93-reader-contract (M93 D2 — the instruction)

## Files Owned
- `templates/CLAUDE-global.md`
- `templates/prompts/qa-subagent.md`
- `templates/prompts/red-team-subagent.md`
- `templates/prompts/pre-mortem-subagent.md`
- `templates/prompts/blind-adversary-subagent.md`
- `test/m93-reader-contract-presence.test.js`

---

### M93-D2-T1 — Sharpen the Reader Contract in CLAUDE-global
**Touches**: `templates/CLAUDE-global.md`
**PseudoCode-Section**: (n/a)
Find the existing Output Style / "No process narration" rules (the global already has them). Add a
tight, GLOSSED **Reader Contract** block that makes the rule unambiguous + machine-aligned with D1's
gate. It MUST state:
- **Question → answer first.** No process-narration (no "let me find/check/verify before I answer").
  One direction-acknowledgement sentence is fine; stacking 2+ "about to do X" sentences before the
  answer is the banned pattern.
- **Action (about to change code) → intent first** (so the user can short-circuit). This is the ONE
  place leading-with-intent is correct.
- **Discriminator:** modifying → announce; telling → just tell.
- **Gloss jargon:** never a bare `S2-M7` / `HC-003` / acronym — gloss in plain words on first use.
- **Format:** bullets/tables over paragraphs; expand only on request; the dated banner stays.
- A one-line note that this is ENFORCED by the `gsd-t-brevity-guard` Stop hook (D1) — so it is a
  gate, not advice.
The block must itself obey the rule (concise, glossed) — dog-food it.
**Acceptance criteria**: the Reader Contract block is present, states the question-vs-action split + the gloss rule + the gate reference; it is itself concise and jargon-glossed; the existing CLAUDE-global structure is preserved (additive).
**Files**: `templates/CLAUDE-global.md`.
**Test**: M93-D2-T3.
**Headline**: true

### M93-D2-T2 — Inject a Reader Contract reference into the user-facing subagent prompts
**Touches**: `templates/prompts/qa-subagent.md`, `templates/prompts/red-team-subagent.md`, `templates/prompts/pre-mortem-subagent.md`, `templates/prompts/blind-adversary-subagent.md`
**PseudoCode-Section**: (n/a)
Add a SHORT structured directive block (a few lines, marker-delimited e.g.
`<!-- reader-contract -->`) to each: "Report findings concisely — answer/verdict first, no preamble,
gloss every code/jargon term on first use, bullets over paragraphs, expand only if asked." Do NOT
alter the existing protocol bodies — ADD the directive. These four are the prompts whose output the
user reads; the rule fixes the verbose default at the source.
**Acceptance criteria**: each of the 4 prompts carries the marker-delimited reader-contract directive; existing protocol bodies unchanged; the directive is concise + glossed.
**Files**: the 4 prompts.
**Test**: M93-D2-T3.

### M93-D2-T3 — Presence lint for the Reader Contract
**Touches**: `test/m93-reader-contract-presence.test.js`
**PseudoCode-Section**: (n/a)
Structural presence assertions (region-scoped, not file-wide substring where a file has multiple
sections): the Reader Contract block exists in `templates/CLAUDE-global.md` (and states the
question-vs-action split — assert both "answer first" and "intent first" appear, proving the SPLIT
not just a generic "be concise"); the `<!-- reader-contract -->` marker block exists in each of the
4 subagent prompts. Negative: a prompt missing the marker FAILS.
**Acceptance criteria**: CLAUDE-global carries the split (both directions asserted); all 4 prompts carry the marker; a missing marker FAILS the lint.
**Files**: `test/m93-reader-contract-presence.test.js`.
**Test**: this IS the test.

---

**INTEGRATE-SEAM:** the live `~/.claude/CLAUDE.md` mirror of CLAUDE-global updates via version-update-all at propagate (flag at complete-milestone).
