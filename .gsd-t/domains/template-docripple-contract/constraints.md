# Constraints: template-docripple-contract

## Pure-additive
- This domain ADDS files + one ripple line; it removes/replaces nothing. No
  destructive edits.

## Template anchored to exemplars
- `templates/PseudoCode-spec.md` is the shipped blank MOLD, structurally
  matching the binvoice exemplars (`PseudoCode-PayPal.md` +
  `PseudoCode-Extension.md`) per SC6 — both altitudes + all five section
  elements (§1 of the contract). NOT a blank page; anchored to the exemplar
  shape. Only the `-spec` name keeps the spec suffix (it is the mold, not an
  instance — instances are `PseudoCode-[Title].md`, subject-named).

## Contract is the single source of truth
- `pseudocode-source-of-truth-contract.md` v1.0.0 STABLE owns ALL grammars
  (guard-map §2, section-citation §3, divergence §4, ripple-points §5).
  D1/D2/D3 consume it; they do not re-define grammars. A grammar change is a
  version bump + coordinated cross-domain edit.

## Ripple ownership boundary
- This domain WRITES exactly ONE of the four ripple points: the doc-ripple
  command (`commands/gsd-t-doc-ripple.md`). The other three
  (`templates/CLAUDE-global.md` ×2, project `CLAUDE.md`) are integrate-time
  seams — shared files, NEVER parallel-written. The lint VERIFIES all four
  post-integration but writes none of points 1/2/4.

## Lint is a mandatory negative test (M71-family)
- The A4 lint MUST FAIL when `PseudoCode-[Title].md` is removed from any one of
  the four ripple points (structural assertion, path-as-path — never
  substring). Pattern mirrors the existing M71-family ripple/drift lints.

## Command-file conventions
- `commands/gsd-t-doc-ripple.md`: pure markdown, no frontmatter, step-numbered.

## Wave discipline
- Wave 2 only. Do NOT start (beyond the partition-time contract authoring)
  until D1's A1 passes.
