# Constraints: m89-d2-research-stage-and-contract

## Hard Rules
- **Contract is STABLE v1.2.0 (premise-corrected)** — D3/D4 build against it. The unit is a load-bearing
  CLAIM (not "a gap"); §6.5 DETECT (Stated-Claims, LLM-prompted), §7 ENFORCE marker. Any shape change after
  Wave 1 ships requires a version bump + notifying both consumers.
- **Citations REQUIRED — URL + DATE.** The Verified-Facts block format mandates `source: <url>` **and a
  `(fetched YYYY-MM-DD)` date** on every fact (the date is load-bearing for the staleness guess-type §1.3);
  an uncited OR undated fact FAILS. The cite-format test enforces this with a negative case.
- **Idempotency — exact normalized-claim-key.** Already-cited claim ⇒ no re-research, keyed on an EXACT
  normalized-claim-key match (§4.1) — NOT substring/keyword/fuzzy. A cited PayPal-OAuth fact must NOT skip a
  DISTINCT PayPal-invoice-TOTAL claim. The test asserts a re-pass over an already-cited (matching claim-key)
  artifact triggers ZERO additional research, AND that a distinct-keyed claim still routes to research.
- **Stage model — BARE `model: "fable"` literal.** The research stage declares its model as a BARE
  `model: "fable"` literal, NOT the `overrides["research"] ?? "<literal>"` form: the `??`-form bracket key
  MUST be one of the 6 injectable designated stages, and `research` is not one (no `research` key in
  `bin/gsd-t-model-tier-policy.cjs`), so the `??`-research form FAILS the live M85 lint
  (`test/m85-workflow-tier-policy-lint.test.js`). The bare literal passes the lint's tier-set membership
  check (mirrors `gsd-t-execute.workflow.js:172`). The M85 drift lint must stay green.
- **Prompt protocol convention.** `templates/prompts/research-subagent.md` is Read at spawn time — NEVER inline
  its body into a workflow script (sandbox has no fs; mirrors qa/red-team/design-verify).
- **Zero new runtime deps** in `bin/gsd-t.js`.

## Shared-Surface Discipline
D2 is the SOLE owner of every shared doc-ripple surface (`CLAUDE-global.md`, `bin/gsd-t.js`,
`commands/gsd-t-help.md`, `package.json`, `docs/requirements.md`). Concentrating the shared blast radius in
one domain makes integrate conflict-free by construction. D3/D4 must NOT touch these files.

## Doc-Ripple (project Pre-Commit Gate)
- `templates/CLAUDE-global.md`: advisory Research Policy prose → the **KNOWN-vs-GUESSED trigger** (per claim,
  tag KNOWN vs GUESSED(unknown|assumed|stale) → classify → external: web-research + cite Verified-Facts
  (URL + date) / internal: grep, never web; staleness fails-toward-verify) **PLUS the SC6 conversation-scope
  standing directive** (verify-or-flag an external/time-varying fact before asserting to the user). Add the
  memory pointer `feedback_auto_research_external_gaps`. Mirror to live `~/.claude/CLAUDE.md` if the
  template/live pairing applies.
- `bin/gsd-t.js`: `research-gate` dispatch + help-line + `PROJECT_BIN_TOOLS` entry (`gsd-t-research-gate.cjs`)
  must all stay consistent.
- `commands/gsd-t-help.md` + `GSD-T-README.md`/`README.md` command surfaces if a new user-facing command lands.
- `docs/requirements.md`: the M89 entry (SC5/A6 — the auto-research known/guessed trigger as a framework
  requirement: classify→research+cite ENFORCE, the three guess-types, the DETECT Stated-Claims seam, the
  §7 ENFORCE marker, the conversation-scope directive).
