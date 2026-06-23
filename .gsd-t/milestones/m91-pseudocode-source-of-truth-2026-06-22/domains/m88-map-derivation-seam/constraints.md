# Constraints: m88-map-derivation-seam (M91 Wave 3 — M88 G2)

- Zero external runtime deps.
- IMPORT D1's `[RULE]` parser + RULE-ID derivation from `bin/gsd-t-guard-map.cjs`
  (`require` it) — do NOT re-implement the grammar (single source of truth; a
  re-implementation would drift). This domain is a CONSUMER of D1's parser.
- Doc-keyed non-vacuity: the derived map's keyset MUST equal the doc's derived id
  set EXACTLY; an unbacked rule is `backedBy:[]` PRESENT, never an omitted key
  (an omitted key would re-open the map-side vacuous pass D1 closed).
- Module never throws; bad input → exit code, never an exception.
- Structural, not substring (`feedback_coverage_check_structural_not_substring`).
- Does NOT edit `bin/gsd-t-guard-map.cjs` (D1-owned). File-disjoint from the other
  3 M88 Wave-3 domains and all 4 M87 domains.
