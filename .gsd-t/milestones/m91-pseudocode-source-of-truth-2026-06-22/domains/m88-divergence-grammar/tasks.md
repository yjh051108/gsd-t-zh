# Tasks: m88-divergence-grammar (M91 Wave 3 — M88 G4)

## Files Owned
- `bin/gsd-t-divergence-grammar.cjs`
- `test/m88-divergence-grammar.test.js`

---

### M88-G4-T1 — `parseDivergence` / `formatDivergence` round-trip + count
**Touches**: `bin/gsd-t-divergence-grammar.cjs`
**PseudoCode-Section**: PseudoCode-Extension#the-two-ais-in-one-breath
Implement the §4 grammar round-trip. Match the contract form EXACTLY:
`⚠ Divergence: <RULE-ID or section> — supersedes shipped <what>. Reason: <user intention>.`
- `parseDivergence(line)` → `{ref, supersedes, reason}` (a line not matching the
  form → parse FAILURE, named);
- `formatDivergence({ref, supersedes, reason})` → the canonical line;
- round-trip: `format(parse(line)) === line` byte-stable for every valid flag;
- `countDivergences(docText)` → integer count of valid `⚠ Divergence` flags in a
  doc — the checkable artifact that can feed D1's rule map.
Zero deps, never throws (parse failure is a returned error, not an exception), pure.
CLI: `--parse "<line>" --json`, `--count <docPath> --json`.
**Acceptance criteria**: a valid `⚠ Divergence` flag round-trips format→parse→format byte-stable; a malformed flag → parse FAILURE (named, no throw); `countDivergences` returns the exact integer count over a doc; the count is emitted as a checkable JSON artifact.
**Files**: `bin/gsd-t-divergence-grammar.cjs`.
**Test**: M88-G4-T2.
**Headline**: true

### M88-G4-T2 — Killing test for the divergence grammar
**Touches**: `test/m88-divergence-grammar.test.js`
**PseudoCode-Section**: PseudoCode-Extension#the-two-ais-in-one-breath
The backlog #35 killing test for SC4's grammar half. Byte-verbatim fixtures:
- a VALID `⚠ Divergence` flag (matching contract §4 exactly) → round-trips
  format→parse→format BYTE-STABLE;
- a MALFORMED flag (missing `— supersedes`, or missing `Reason:`) → parse FAILURE
  (asserted, no throw);
- a doc with K valid flags + some malformed → `countDivergences` returns EXACTLY K
  (malformed not counted);
- the emitted count is a checkable artifact (JSON integer), not prose.
All deterministic, zero LLM.
**Acceptance criteria**: valid flag round-trips byte-stable; malformed flag → parse FAILURE no throw; `countDivergences` returns exactly the valid-flag count; count emitted as checkable JSON.
**Files**: `test/m88-divergence-grammar.test.js`.
**Test**: this IS the test (exercises M88-G4-T1's `bin/gsd-t-divergence-grammar.cjs`).
