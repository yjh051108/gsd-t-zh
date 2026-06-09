# Tasks: m85-d4-lint-shadow-docs

## Summary
Enforcement + measurement + doc ripple — fully write-disjoint from all M85 source files. Owns the NEW M71-family lint (read-only assertion over all 8 workflows + the policy module/contract), the `gsd-t-audit` shadow probe that records a MEASURED verdict in `progress.md`, and the full doc ripple. Never writes a workflow, the policy module, or a `bin/` consumer.

## Tasks

### M85-D4-T1 — M71-family tier-policy lint (the drift enforcer)
- **Touches**: `test/m85-workflow-tier-policy-lint.test.js` (NEW)
- **Files**: `test/m85-workflow-tier-policy-lint.test.js`
- **Test**: self — `node --test test/m85-workflow-tier-policy-lint.test.js`
- **Contract refs**: `.gsd-t/contracts/model-tier-policy-contract.md` v1.0.0 § "Drift Enforcement"
- **Deps**: BLOCKED by M85-D1-T1 (needs the policy module/contract to assert against)
- **Acceptance criteria**:
  - Reads all 8 `templates/workflows/*.workflow.js` (read-only) + the policy module/contract; asserts every workflow `model:` value (string literal OR the operand(s) of a ternary like `cycle===1 ? "opus" : "fable"`) is a member of the policy tier set `{opus, fable, sonnet, haiku}`. The 8 workflows carry varying counts (scan 15, phase 9, verify 5, debug/execute/integrate 2, quick 1, wave 0) — ALL must pass the membership check, not just the designated ones. *(Falsifier: a workflow literal outside the set passes the lint, or the ternary operands are not unwrapped. Test: self — positive membership assertion over every `model:` occurrence in all 8 files.)*
  - **Stage identification (pre-mortem finding #2):** the lint maps a designated stage to its literal by keying off the `agent()` call's `label:` field (`solution-space-probe`, `partition-probe`, `judge:rubric`/competition-judge, `pre-mortem`, `red-team`, the per-cycle `debug-cycle-${cycle}`, and `candidate:*`/competition-producers) — NOT by line number (line numbers drift). Non-designated literals (e.g. verify `synthesis`/`code-review-ultra`/`qa`, the haiku CLI helpers, scan's stages) are checked for MEMBERSHIP ONLY, never forced to fable. *(Falsifier: the lint keys off brittle line numbers, or forces a non-designated stage to fable. Test: self — assert each designated `label:` maps to the contract tier; assert a representative non-designated label is unconstrained beyond membership.)*
  - Asserts the 5 designated stages resolve to `fable` AND `competition-producers` resolves to `opus` (the held invariant); for `debug-cycle-${cycle}` the lint unwraps the per-cycle ternary and asserts cycle-1→opus, cycle-2→fable. *(Falsifier: a designated stage maps to non-fable, producers to non-opus, or the debug ternary is mis-read, and the lint passes. Test: self — per-stage assertion incl. debug conditional.)*
  - **Mandatory negative test**: a deliberately-drifted literal (e.g. an in-test fixture reverting Red Team to `opus`, setting a stage to `sonnet`, or flattening the debug ternary so cycle-1 becomes fable) MUST make the lint's checker FUNCTION return a violation — asserted via a returned-violations assertion / `assert.throws` against a synthetic drifted-source fixture (NOT by failing the live suite). *(Falsifier per AC a: the drift fixture passes the checker → the lint is decorative. Test: self — negative-case assertion is REQUIRED, run against an in-test drifted fixture string, not the real files.)*
  - `npm test` is green: the negative case asserts the checker rejects drift on a fixture, not an actual suite failure. *(Test: `npm test`.)*

### M85-D4-T2 — gsd-t-audit shadow probe + MEASURED verdict in progress.md
- **Touches**: `.gsd-t/progress.md` (shadow-verdict block — measured numbers)
- **Files**: `.gsd-t/progress.md`
- **Test**: the `gsd-t-audit` shadow run itself is the measurement instrument (1 Fable single-draft vs 3-Opus-producers + Opus-finalize on one eligible phase); the recorded verdict is the evidence. Verification: `grep` that `progress.md` carries a numeric quality comparison + token/cost delta + an explicit conclusion (not a prose claim).
- **Contract refs**: `feedback_measure_dont_claim`, `.gsd-t/contracts/competition-mode-contract.md` v2.0.0 (the competition path being compared against)
- **Deps**: BLOCKED by M85-D3-T4 (stages must actually run on Fable before the shadow comparison is meaningful)
- **Acceptance criteria**:
  - The `gsd-t-audit` shadow test runs: 1 Fable single-draft vs 3-Opus competition+judge (~4 opus ≈ 2 fable calls) on an eligible phase, and produces a MEASURED result. *(Falsifier per AC e: a verdict stated without the run. "Probably equivalent" is not a verdict. Test: the audit run completes and emits numbers.)*
  - `progress.md` records: (i) a quality comparison, (ii) a token/cost delta (numbers, never `N/A`/`0`), (iii) an explicit conclusion on whether Fable-single-draft matches judged-competition for those phases. *(Falsifier: any of the three missing, or stated as a claim not a measurement. Test: `grep` the three components in `progress.md`.)*

### M85-D4-T3 — Full doc ripple (one pass, gated on the measured verdict)
- **Touches**: `templates/CLAUDE-global.md`, `/Users/david/.claude/CLAUDE.md`, `CLAUDE.md` (project), `README.md`, `commands/gsd-t-help.md`, `.gsd-t/contracts/model-selection-contract.md`, `.gsd-t/progress.md`
- **Files**: `templates/CLAUDE-global.md`, `/Users/david/.claude/CLAUDE.md`, `CLAUDE.md`, `README.md`, `commands/gsd-t-help.md`, `.gsd-t/contracts/model-selection-contract.md`, `.gsd-t/progress.md`
- **Test**: `test/doc-ripple` consistency grep (template == live `~/.claude/CLAUDE.md` Model Display match) + `grep` each target carries the FABLE tier + cites the measured verdict; Document Ripple Completion Gate (no partial pass)
- **Contract refs**: `.gsd-t/contracts/model-selection-contract.md` (minor bump), `.gsd-t/contracts/model-tier-policy-contract.md` v1.0.0
- **Deps**: Requires M85-D4-T2 (within domain — the verdict must exist before docs cite it)
- **Acceptance criteria**:
  - The Model Display sections in `templates/CLAUDE-global.md` and live `~/.claude/CLAUDE.md` are updated IDENTICALLY (FABLE tier + the shipped single-source policy). *(Falsifier: template and live diverge. Test: diff/grep the two Model Display sections match.)*
  - Project `CLAUDE.md`, `README.md`, `commands/gsd-t-help.md` reflect the new tier + single-source tier policy. *(Falsifier: any of the three omits FABLE/policy. Test: `grep` each for the FABLE tier + policy-module reference.)*
  - `.gsd-t/contracts/model-selection-contract.md` is minor-version-bumped and cross-references `model-tier-policy-contract.md`, citing the measured verdict. *(Falsifier: version unchanged, or no cross-ref. Test: `grep` version line + cross-ref.)*
  - `progress.md`: Decision Log entry + the version-bump narrative 4.3.10 → 4.4.10 (minor). *(Falsifier: no Decision Log entry or no version narrative. Test: `grep` progress.md.)*
  - ALL updates land in ONE pass (Document Ripple Completion Gate — no "I updated 3 of 7"). *(Test: every file in **Touches** is modified in the same changeset.)*

## Execution Estimate
- Total tasks: 3
- Independent tasks (T1 once D1 lands): 1 (T1)
- Blocked tasks (within-domain + cross-domain): T2 needs D3-T4; T3 needs T2
- Estimated checkpoints: 2 (after T1 — lint guards D3's edits; after T3 — doc ripple complete)

## REQ Coverage
- AC (a) lint proves literals == policy, negative test mandatory → T1
- AC (e) shadow test MEASURED not claimed → T2
- Doc ripple (CLAUDE-global + live + project CLAUDE + README + help + model-selection-contract) → T3
- Version narrative 4.3.10 → 4.4.10 → T3
