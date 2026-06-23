# Constraints: m88-triad-seam-check (M91 Wave 3 — M88 G3)

- Zero external runtime deps.
- NO live triad run — this is a deterministic SEAM-CHECK only (the whole point of
  the A5 reframe; a live run is non-deterministic and explicitly rejected).
- The prompt ingest-directive is a STRUCTURED marked block, asserted by presence
  of the marker, NOT a prose substring fuzzy-match
  (`feedback_coverage_check_structural_not_substring`).
- Consumer never throws; malformed/empty map → empty frame sets (fail-closed).
- Editing `qa-subagent.md` / `red-team-subagent.md` adds a directive block; it does
  NOT alter the existing protocol bodies (methodology layer unchanged — only the
  ingest seam added). These two prompt files are NOT owned by any M87 domain.
- File-disjoint from the other 3 M88 Wave-3 domains and all 4 M87 domains.
