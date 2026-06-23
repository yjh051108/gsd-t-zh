# Domain: template-docripple-contract

**Milestone**: M87 — Intention-First PseudoCode as Source-of-Truth
**Wave**: 2 (starts only after D1's A1 passes)
**Risk**: LOWEST — pure-additive authoring.
**Risk isolation**: owns the spec template, the doc-ripple command edit, the new
contract, and the A4 ripple lint — disjoint from the bin modules (D1/D2) and
the milestone flow (D3).

## Thesis (R5)

Ship the shipped blank mold + the source-of-truth contract + the doc-ripple
integration + the drift lint that proves the ripple is intact.

## Deliverables

- `templates/PseudoCode-spec.md` — the blank skeleton:
  intention / mechanism / guard-map / divergence / appendix + BOTH altitudes +
  all five section elements (§1 of the contract), structurally matching the
  binvoice exemplars per SC6 (anchored to them, not a blank page).
- `commands/gsd-t-doc-ripple.md` — add `PseudoCode-[Title].md` to the Living
  Documents ripple set (the ONE of the four ripple points this domain owns).
- `.gsd-t/contracts/pseudocode-source-of-truth-contract.md` v1.0.0 STABLE —
  the SINGLE source of truth for all grammars (guard-map §2, section-citation
  §3, divergence §4, ripple-points §5). Consumed by D1/D2/D3. **(Written at
  partition — already on disk.)**
- `test/m87-docripple-presence-lint.test.js` — the A4 M71-family drift lint
  asserting `PseudoCode-[Title].md` appears in ALL FOUR ripple reference points;
  removing it from any one FAILS the lint (mandatory negative test).

## Files Owned

- `templates/PseudoCode-spec.md`
- `commands/gsd-t-doc-ripple.md`
- `.gsd-t/contracts/pseudocode-source-of-truth-contract.md`
- `test/m87-docripple-presence-lint.test.js`
- `.gsd-t/domains/template-docripple-contract/{scope,constraints,tasks}.md`

## Acceptance Criteria

- **A4:** the lint asserts `PseudoCode-[Title].md` in all four ripple points;
  removing it from any one FAILS the lint.
- **SC5:** `PseudoCode-[Title].md` in the ripple set across all four points,
  kept identical (ripple intact).
- **SC6:** `templates/PseudoCode-spec.md` ships, structurally matching the
  binvoice exemplars (both altitudes + all five section elements present).

## Integrate-time seams (NOT written here — written serially at integrate)

The four ripple reference points: this domain owns ONLY point 3 (doc-ripple
command) + the lint. The other three are integrate-time seams (shared files,
never parallel-written):
1. `templates/CLAUDE-global.md` Living Documents table — integrate seam.
2. `templates/CLAUDE-global.md` Pre-Commit Gate — integrate seam.
4. project `CLAUDE.md` Living Documents reference — integrate seam (co-owned at merge with this lint).

The lint VERIFIES all four POST-integration; it does not WRITE points 1/2/4.

## Boundaries (NOT owned)
- Does NOT edit `templates/CLAUDE-global.md` or project `CLAUDE.md` (integrate seams).
- Does NOT edit the bin modules (D1/D2), the milestone flow (D3), or the verify
  triad prompts (A5 integrate seam).
