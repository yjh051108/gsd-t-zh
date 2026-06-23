# Constraints: m93-reader-contract (M93 D2)

- The Reader Contract must DOG-FOOD itself: concise, jargon-glossed, no preamble. (A verbose rule about being concise is self-refuting.)
- ADDITIVE: do not remove/rewrite existing CLAUDE-global Output Style rules — sharpen + extend them with the question-vs-action split and the gate reference. Do not alter subagent protocol bodies — add a marker-delimited directive.
- Keep the dated-banner rule intact (the user keeps the banner).
- Edit the TEMPLATE `templates/CLAUDE-global.md`, not the live `~/.claude/CLAUDE.md` (that mirror updates via propagate — integrate-seam).
- Structural presence test, not file-wide substring (CLAUDE-global has many sections).
- File-disjoint from D1 (the hook script + its test) and D3 (the commit lint + its test).
