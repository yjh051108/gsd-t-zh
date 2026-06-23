# Scope: m93-reader-contract (M93 D2 — the instruction)

## Mission
Bake the sharpened conciseness rule into the framework's instruction layer so the DEFAULT output improves (the Stop-hook gate from D1 is the backstop; this makes the gate rarely need to fire). The rule, as the user specified it:
- **Question (wants an answer)** → answer FIRST. No process-narration ("let me find X before I answer"). Bullets/tables over paragraphs. Expand only on request.
- **Action (about to change code)** → state intent FIRST, so the user can short-circuit a wrong direction. KEEP this.
- **Discriminator:** modifying something → announce intent; just telling → just tell.
- **Gloss every code/jargon token** (`S2-M7`, `HC-003`, acronyms) in plain language on FIRST use.
- The dated banner STAYS.

## Files Owned
- `templates/CLAUDE-global.md` (the Output Style / concise-rules section — sharpen the existing "No process narration" rule with the question-vs-action split + the gloss-jargon rule)
- `templates/prompts/qa-subagent.md`
- `templates/prompts/red-team-subagent.md`
- `templates/prompts/pre-mortem-subagent.md`
- `templates/prompts/blind-adversary-subagent.md`
- `test/m93-reader-contract-presence.test.js` (new — a presence lint that the Reader Contract block exists in CLAUDE-global + each subagent prompt)

## Why these files
`templates/CLAUDE-global.md` is the propagation source (version-update-all pushes it). The subagent prompts are what the triad/worker agents see — today they have ZERO conciseness rules, so everything GSD-T generates starts verbose. Adding a one-line Reader Contract reference to each fixes the default at the source.

## Out of scope
- The Stop hook (D1). The commit-time jargon lint for arbitrary docs (D3). The live `~/.claude/CLAUDE.md` mirror (integrate/propagate — D2 edits the TEMPLATE; the live mirror updates via version-update-all).
- `keep-or-supersede-subagent.md` / `design-verify-subagent.md` — only add the contract to the prompts that produce user-facing prose (qa/red-team/pre-mortem/blind-adversary); leave the others to avoid scope creep unless trivially additive.

## Bar (prose, structural test)
A short, GLOSSED, dog-fooding rule block (the Reader Contract must itself obey its own rule — concise, no jargon). The presence test asserts the block exists in each owned file structurally.
