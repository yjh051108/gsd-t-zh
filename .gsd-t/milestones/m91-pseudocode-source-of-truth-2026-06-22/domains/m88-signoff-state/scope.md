# Scope: m88-signoff-state (M91 Wave 3 — M88 G1)

## Mission
A machine-checkable milestone sign-off STATE + an `isDefined(milestone)` predicate. Today "DEFINED" is prose an LLM writes into `.gsd-t/progress.md` — not a code-readable marker. This domain designs a concrete, code-readable sign-off marker (structured sidecar / front-matter stamp) and the predicate that reads it: a milestone is NOT DEFINED until its detailed `PseudoCode-[Title].md` is signed off; signing flips the state; a skip is a LOGGED decision, never a silent default-off.

## Depends on (Wave 1-2, already shipped before this runs)
- D3 `milestone-two-altitude-flow` — the two-altitude flow + `.gsd-t/pseudocode/PseudoCode-[Title].md` doc location this gate reads.

## Files Owned
- `bin/gsd-t-milestone-state.cjs` (new)
- `test/m88-signoff-state.test.js` (new)

## Out of scope
- The two-altitude FLOW itself (D3, already shipped).
- Wiring the predicate into the milestone command's "DEFINED" emission (D3 owns `commands/gsd-t-milestone.md`; this domain ships the predicate + a documented integration note for a later doc-ripple pass — it does NOT edit D3's command file).

## The deterministic-gate bar (entry criterion)
Pass/fail is deterministic code, ZERO LLM judgment; structural-not-substring; proven by a killing test against byte-verbatim fixtures; no silent degradation.
