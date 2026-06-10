# M85 Integration Points — Model-Tier Policy + Fable 5

## Seam contract
`.gsd-t/contracts/model-tier-policy-contract.md` v1.0.0 STABLE — the partition-time seam. Every domain codes against the published constants (`claude-opus-4-8` / `claude-fable-5` / `claude-sonnet-4-6` / `claude-haiku-4-5-20251001`) and the stage→tier map, NEVER the policy module's internals.

## Dependency Graph

```
Wave 1 — foundation (the ROOT seam + the enforcer the assignments need):
  D1 m85-d1-tier-policy-module
      │  publishes: bin/gsd-t-model-tier-policy.cjs (MODEL_IDS, STAGE_TIERS,
      │             resolve(), requiresThinkingOmitted()) + the STABLE contract
      │  ALSO independently mergeable value: nothing here regresses if D2/D3 slip
      │
      ├─────────────────────────────┐
      ▼                             ▼
  D4-T1 m85-d4 (lint only)      D2 m85-d2-bin-consumers-alias-selector
      │  test/m85-workflow-          │  fixes bin/gsd-t-parallel.cjs alias
      │  tier-policy-lint.test.js    │  (opus → claude-opus-4-8, +fable),
      │  — the drift guard that      │  adds FABLE tier + ladder to
      │  D3's edits must satisfy     │  bin/model-selector.js (+ its test)
      │                             │  (D2 ∥ D4-T1 — file-disjoint, both need only D1)
      │
      ▼  (lint must precede the assignments it guards)
Wave 2 — assignments (gated on D1 contract STABLE + D4-T1 lint existing):
  D3 m85-d3-workflow-fable-assignments
      │  5 Fable assignments across 3 workflow files; producers STAY opus
      │  (blindness invariant); T4 = REAL-sandbox proof (⚙ [fable] visible)
      │
      ▼  (docs must follow the measurement they cite)
Wave 2b — measure-then-document (D4 tail, gated on D3-T4 real-sandbox run):
  D4-T2 shadow probe → MEASURED verdict in progress.md
  D4-T3 full doc ripple (CLAUDE-global + live ~/.claude + project CLAUDE +
        README + gsd-t-help + model-selection-contract bump), citing the verdict

                GATE: all waves complete
                              │
                              ▼
       VERIFY → COMPLETE-MILESTONE → minor bump 4.3.10 → 4.4.10 → tag v4.4.10
```

## Wave Groupings

| Wave | Domains / tasks | Parallel? | Gate to next |
|------|-----------------|-----------|--------------|
| **W1** | D1 (T1–T4) · D2 (T1–T3) · D4-T1 (lint) | D1 first (ROOT); then D2 ∥ D4-T1 (file-disjoint, both depend on D1 only) | D1 contract STABLE + D4-T1 lint exists |
| **W2** | D3 (T1–T4) | T1/T2/T3 file-disjoint (3 different workflow files) → T4 real-sandbox proof | D3-T4 real-sandbox run shows `⚙ [fable]` for all 5 stages |
| **W2b** | D4-T2 (shadow verdict) → D4-T3 (doc ripple) | serial (docs cite the measured verdict) | doc ripple complete in one pass |

## The Load-Bearing Serial Constraints

1. **D1 before everything** — the policy module + STABLE contract is the ROOT; D2/D3/D4 all read its published constants.
2. **D4-T1 lint before D3 edits** — the lint guards literal-vs-policy agreement; it must exist before the assignments it enforces, so D3 can never regress D1's seam.
3. **D3-T4 real-sandbox run before D4-T2 measurement** — the shadow comparison is only meaningful once the stages actually run on Fable.
4. **D4-T2 measured verdict before D4-T3 doc ripple** — docs cite a number, not a claim (`feedback_measure_dont_claim`).

## File-Disjointness (validated via `gsd-t parallel --dry-run`)

| Domain | Files Owned |
|--------|-------------|
| D1 | `bin/gsd-t-model-tier-policy.cjs`, `test/m85-model-tier-policy.test.js`, `.gsd-t/contracts/model-tier-policy-contract.md` |
| D2 | `bin/gsd-t-parallel.cjs`, `bin/model-selector.js`, `test/model-selector.test.js` |
| D3 | `templates/workflows/gsd-t-phase.workflow.js`, `templates/workflows/gsd-t-verify.workflow.js`, `templates/workflows/gsd-t-debug.workflow.js` |
| D4 | `test/m85-workflow-tier-policy-lint.test.js`, `templates/CLAUDE-global.md`, `~/.claude/CLAUDE.md`, `CLAUDE.md`, `README.md`, `commands/gsd-t-help.md`, `.gsd-t/contracts/model-selection-contract.md`, `.gsd-t/progress.md` |

No file appears in two domains' Files Owned — write-disjoint. D4's lint READS D3's workflow files (read-only assertion, not ownership).

## Abbreviation Key

| Abbrev | Domain |
|--------|--------|
| D1 | m85-d1-tier-policy-module |
| D2 | m85-d2-bin-consumers-alias-selector |
| D3 | m85-d3-workflow-fable-assignments |
| D4 | m85-d4-lint-shadow-docs |
