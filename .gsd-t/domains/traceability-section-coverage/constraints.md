# Constraints: traceability-section-coverage

## Extend, never replace
- This is an ADDITIVE extension of the shipped M83 gate
  (`bin/gsd-t-traceability-gate.cjs`). The existing AC→(code path + named test)
  binding, the `_bare`/`_barePath` emphasis-strip helpers, and the exit-code
  set MUST be preserved. All existing M83 traceability tests stay green
  (regression bar).
- Removing or replacing the M83 behavior is a Destructive Action — adapt the
  new section-coverage check to the existing structure.

## Structural, never substring
- Section citations parsed **path-as-path** — `<Title>` and `<anchor>` as
  structured segments, never `text.includes(section)` (per
  `feedback_coverage_check_structural_not_substring`). This file is the exact
  place a second non-converging Red Team could ignite.
- **Halt rule:** if the Red Team on the coverage check does NOT converge in ≤2
  cycles (each fix spawning a new variant), that is a DESIGN DEFECT — STOP and
  escalate, do not keep patching.

## Engineering bar (inherited from M83 gate)
- Zero deps, never throws, pure/read-only. Same JSON envelope + exit codes
  (0 / 4 / 64).

## Grammar source
- Section-citation grammar = `pseudocode-source-of-truth-contract.md` §3.
- The `[RULE]` grammar (if referenced) = §2 (D1 owns the parser; D2 does not
  re-implement it — consumes D1's CLI/JSON output for any rule-aware path).

## Wave discipline
- Wave 2 only. Do NOT start until D1's A1 passes. Wave 1 contribution from this
  domain is ONLY the documented competition-altitude design decision (in
  scope.md) — no code build until A1 is green.

## Boundaries
- Edit ONLY the two owned files. The verify-triad prompt edits (A5) and the CLI
  dispatch are integrate seams — out of scope here.
