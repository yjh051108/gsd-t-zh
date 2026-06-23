# Constraints: m88-divergence-grammar (M91 Wave 3 — M88 G4)

- Zero external runtime deps.
- Match the contract §4 grammar form EXACTLY — this domain IMPLEMENTS the spec D4
  owns; it does NOT redefine the grammar (single source of truth in
  `pseudocode-source-of-truth-contract.md` §4).
- Round-trip MUST be byte-stable: `format(parse(line)) === line` for every valid flag.
- Module never throws — a parse failure is a returned/named error, not an exception
  (fail-closed).
- Structural parsing on the marker form, NOT a prose substring scan
  (`feedback_coverage_check_structural_not_substring`).
- Does NOT edit the contract (D4-owned) or the keep-or-supersede prompt (D3-owned).
- File-disjoint from the other 3 M88 Wave-3 domains and all 4 M87 domains.
