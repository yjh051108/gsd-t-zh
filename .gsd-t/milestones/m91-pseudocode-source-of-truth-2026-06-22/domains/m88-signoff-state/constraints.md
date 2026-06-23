# Constraints: m88-signoff-state (M91 Wave 3 — M88 G1)

- Zero external runtime deps (installer zero-dep invariant).
- The module never throws — malformed input is fail-closed (treated as unsigned),
  exit code on bad input, never an exception.
- Structural parsing only — the sign-off marker is a structured HTML comment, read
  by position/regex on the marker form, NOT a substring scan of prose
  (`feedback_coverage_check_structural_not_substring`).
- No silent default-off: an absent/skipped sign-off MUST produce an assertable
  logged decision (`feedback_no_silent_degradation`).
- This domain does NOT edit `commands/gsd-t-milestone.md` (D3-owned) — it ships the
  predicate + a documented integration note for a later doc-ripple pass.
- File-disjoint from the other 3 M88 Wave-3 domains and all 4 M87 domains.
