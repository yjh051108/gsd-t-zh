# Constraints: m85-d4-lint-shadow-docs

## Patterns to follow
- **Read-only assertion, not ownership** — the lint READS all 8 `templates/workflows/*.workflow.js`. It must NOT write them. Ownership of those files is D3's. Reading for assertion is disjoint from writing.
- **Mandatory negative test** — the lint MUST include a deliberately-drifted-literal-FAILS case (AC a). A lint that only asserts the happy path is incomplete.
- **Measure, don't claim** (feedback_measure_dont_claim) — the shadow verdict in progress.md is a NUMBER: quality comparison + token/cost delta + explicit conclusion. Run the gsd-t-audit shadow probe (1 Fable single-draft vs 3-Opus competition+judge on an eligible phase) and record the MEASURED result. Never write a verdict you did not measure.
- **Template + live must match** — `templates/CLAUDE-global.md` and `/Users/david/.claude/CLAUDE.md` Model Display sections are kept identical (Document Ripple Completion Gate).
- **Live clock** — every timestamp written to progress.md / contract `Updated:` lines is sourced from the live `[GSD-T NOW]` signal, never `currentDate`.

## Boundaries to respect
- This domain owns ONLY its new test file, the docs listed in scope, the two contracts it bumps/cross-refs (`model-selection-contract.md` — it does NOT author `model-tier-policy-contract.md`, D1 does), and `.gsd-t/progress.md`.
- The lint exists BEFORE D2/D3 land their literals (it guards them) — but it READS, never writes, their files.
- Version bump: minor 4.3.10 → 4.4.10 (new feature, additive; patch resets to 10). Reflect in progress.md narrative; the package.json / tag bump happens at complete-milestone, not here.

## Doc ripple blast radius (must update ALL in one pass)
`test/m85-workflow-tier-policy-lint.test.js` (new), `templates/CLAUDE-global.md`, `/Users/david/.claude/CLAUDE.md`, `CLAUDE.md`, `README.md`, `commands/gsd-t-help.md`, `.gsd-t/contracts/model-selection-contract.md`, `.gsd-t/progress.md`.
