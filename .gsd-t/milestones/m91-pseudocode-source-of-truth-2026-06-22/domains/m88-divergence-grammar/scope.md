# Scope: m88-divergence-grammar (M91 Wave 3 — M88 G4)

## Mission
The deterministic `parseDivergence()` / `formatDivergence()` grammar round-trip over the `⚠ Divergence: …` flag (contract §4). M87's D3 ships the keep-or-supersede ASK + the prose WRITING of a divergence flag on supersede; this domain makes that flag a code-checkable artifact: a `⚠ Divergence` line round-trips format→parse→format byte-stable; a malformed flag FAILS; the divergence COUNT is emitted as a checkable artifact that can feed D1's rule map.

## Contract reference
`pseudocode-source-of-truth-contract.md` §4 — grammar already SPEC'd there (annotated "M88", not deleted):
```
⚠ Divergence: <RULE-ID or section> — supersedes shipped <what>. Reason: <user intention>.
```

## Depends on (Wave 2, already shipped before this runs)
- D3 `milestone-two-altitude-flow` — the keep-or-supersede protocol that WRITES the `⚠ Divergence` flags this grammar parses. D4 owns the contract §4 spec.

## Files Owned
- `bin/gsd-t-divergence-grammar.cjs` (new — `parseDivergence`/`formatDivergence` + count)
- `test/m88-divergence-grammar.test.js` (new)

## Out of scope
- The keep-or-supersede PROMPT/protocol (D3-owned).
- The contract §4 grammar DEFINITION (D4-owned; already spec'd) — this domain IMPLEMENTS it, does not redefine it.

## The deterministic-gate bar (entry criterion)
Deterministic code, ZERO LLM judgment; structural-not-substring; killing test; no silent degradation.
