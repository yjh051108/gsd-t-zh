# Tasks: m88-signoff-state (M91 Wave 3 — M88 G1)

## Files Owned
- `bin/gsd-t-milestone-state.cjs`
- `test/m88-signoff-state.test.js`

---

### M88-G1-T1 — Sign-off marker + `isDefined(milestone)` predicate
**Touches**: `bin/gsd-t-milestone-state.cjs`
**PseudoCode-Section**: PseudoCode-Extension#the-two-ais-in-one-breath
Design a concrete, code-readable sign-off marker the gate can read: a structured
front-matter stamp at the head of the detailed `PseudoCode-[Title].md`
(`<!-- signed-off: <ISO-date> by <author> -->` HTML comment, parseable, NOT
free prose). Implement:
- `readSignoff(docPath)` → `{signed: bool, date, author}` (absent marker → `signed:false`).
- `isDefined(milestoneDocs)` → `true` IFF every detailed PseudoCode doc in the set
  carries a valid sign-off marker; `false` if ANY is unsigned.
- `recordSkip(milestone, reason)` → emits an ASSERTABLE logged decision line
  (structured, to a returnable string / stdout JSON) — a skip is NEVER a silent
  default-off; it is an explicit, greppable decision.
Zero deps, never throws, pure. CLI: `--doc <path> --json` (single-doc readSignoff),
`--docs <glob-resolved-list> --json` (isDefined over a set), `--skip <milestone>
--reason <text>` (recordSkip).
**Acceptance criteria**: unsigned doc → `isDefined` false / `readSignoff.signed` false; a valid sign-off marker flips it true; `recordSkip` emits an assertable logged-decision artifact (not silent); malformed marker → treated as unsigned (fail-closed), never a crash.
**Files**: `bin/gsd-t-milestone-state.cjs`.
**Test**: M88-G1-T2.
**Headline**: true

### M88-G1-T2 — Killing test for the sign-off state
**Touches**: `test/m88-signoff-state.test.js`
**PseudoCode-Section**: PseudoCode-Extension#the-two-ais-in-one-breath
The kill-criterion test (the backlog #35 killing test for A3). Construct byte-verbatim
fixture docs in a redirected temp dir:
- an UNSIGNED detailed doc → `isDefined` returns NOT-DEFINED (false), `readSignoff.signed` false;
- the SAME doc with a valid sign-off marker prepended → `isDefined` flips to true;
- a mixed set (one signed, one unsigned) → `isDefined` false (ANY unsigned fails the set);
- a malformed marker (`<!-- signed-off: -->` with no date) → treated as unsigned, no throw;
- `recordSkip(milestone, reason)` → the emitted decision line is greppable/assertable
  (contains the milestone + reason), proving a skip is observable, never silent.
All deterministic, zero LLM.
**Acceptance criteria**: unsigned → NOT-DEFINED; signing flips to DEFINED; mixed set fails; malformed marker fail-closed (unsigned, no throw); skip emits an assertable logged decision.
**Files**: `test/m88-signoff-state.test.js`.
**Test**: this IS the test (exercises M88-G1-T1's `bin/gsd-t-milestone-state.cjs`).
