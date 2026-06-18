# Constraints: m89-d2-research-stage-and-contract

## Hard Rules
- **Contract is STABLE v1.0.0** — D3/D4 build against it. Any shape change after Wave 1 ships requires a
  version bump + notifying both consumers.
- **Citations REQUIRED.** The Verified-Facts block format mandates `source: <url>` on every fact; an uncited
  fact FAILS. The cite-format test enforces this with a negative case (uncited fact → FAIL).
- **Idempotency.** Already-cited fact ⇒ no re-research. The test asserts a second pass over an artifact that
  already has the cited block triggers ZERO additional WebSearch.
- **Stage model per M85 tier policy.** The research stage declares its model via the `research` tier alias and
  the `overrides["research"] ?? "<literal>"` M86 form. The M85 drift lint must stay green.
- **Prompt protocol convention.** `templates/prompts/research-subagent.md` is Read at spawn time — NEVER inline
  its body into a workflow script (sandbox has no fs; mirrors qa/red-team/design-verify).
- **Zero new runtime deps** in `bin/gsd-t.js`.

## Shared-Surface Discipline
D2 is the SOLE owner of every shared doc-ripple surface (`CLAUDE-global.md`, `bin/gsd-t.js`,
`commands/gsd-t-help.md`, `package.json`). Concentrating the shared blast radius in one domain makes integrate
conflict-free by construction. D3/D4 must NOT touch these files.

## Doc-Ripple (project Pre-Commit Gate)
- `templates/CLAUDE-global.md`: Research Policy prose → deterministic trigger description (and mirror to live
  `~/.claude/CLAUDE.md` if the template/live pairing applies).
- `bin/gsd-t.js`: dispatch + help-line + `PROJECT_BIN_TOOLS` entry must all stay consistent.
- `commands/gsd-t-help.md` + `GSD-T-README.md`/`README.md` command surfaces if a new user-facing command lands.
