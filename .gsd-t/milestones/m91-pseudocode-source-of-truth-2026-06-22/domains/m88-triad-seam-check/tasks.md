# Tasks: m88-triad-seam-check (M91 Wave 3 — M88 G3)

## Files Owned
- `templates/prompts/qa-subagent.md`
- `templates/prompts/red-team-subagent.md`
- `bin/gsd-t-rule-consume.cjs`
- `test/m88-triad-consumption-seam.test.js`

---

### M88-G3-T1 — Rule-set-ingest directive in the QA + Red Team prompts
**Touches**: `templates/prompts/qa-subagent.md`, `templates/prompts/red-team-subagent.md`
**PseudoCode-Section**: PseudoCode-PayPal#6-money-safety-map-every-guard-against-a-double-create
Add a STRUCTURED, greppable directive block to each prompt instructing the frame to
ingest the guard-map `[RULE]` set and treat each RULE-ID as a required
check (QA: contract-compliance frame — each rule is a compliance assertion; Red
Team: attack-surface frame — each rule is an invariant to attack). The directive is
a structured marker (e.g. `<!-- guard-map-ingest -->` delimited block) so the
seam-check can assert its PRESENCE deterministically, not by prose fuzzy-match.
**Acceptance criteria**: each prompt carries the structured ingest directive in a greppable marked block; the marker form is stable and asserted by M88-G3-T3.
**Files**: `templates/prompts/qa-subagent.md`, `templates/prompts/red-team-subagent.md`.
**Test**: M88-G3-T3.

### M88-G3-T2 — The consuming code path
**Touches**: `bin/gsd-t-rule-consume.cjs`
**PseudoCode-Section**: PseudoCode-PayPal#6-money-safety-map-every-guard-against-a-double-create
Implement the deterministic consumer: input guard-map JSON (`{rules:{<id>:...}}`),
output the surfaced RULE-ID set per frame (`{qa:[...ids], redTeam:[...ids]}`) — every
rule id surfaces in BOTH frames (the seam that proves the rule set reaches the
triad). Zero deps, never throws, pure. CLI: `--map <path> --json`.
**Acceptance criteria**: every RULE-ID in the input map surfaces in both `qa` and `redTeam` output sets; an empty/malformed map → empty sets (fail-closed), no throw.
**Files**: `bin/gsd-t-rule-consume.cjs`.
**Test**: M88-G3-T3.
**Headline**: true

### M88-G3-T3 — Killing test for the triad-consumption seam
**Touches**: `test/m88-triad-consumption-seam.test.js`
**PseudoCode-Section**: PseudoCode-PayPal#6-money-safety-map-every-guard-against-a-double-create
The backlog #35 killing test for A5. Two deterministic assertions, NO live triad:
- **(prompt presence)** assert BOTH `qa-subagent.md` and `red-team-subagent.md`
  contain the structured ingest-directive marked block (M88-G3-T1) — a prompt
  MISSING the directive FAILS (assert against the real shipped prompt files);
- **(consumer surfaces every rule)** feed a guard-map JSON with N RULE-IDs through
  `bin/gsd-t-rule-consume.cjs` and assert each of the N ids surfaces in BOTH the
  QA frame set and the Red Team frame set — a DROPPED rule (consumer omits an id
  from either frame) FAILS.
Both deterministic, zero LLM.
**Acceptance criteria**: a prompt missing the ingest directive FAILS; the consumer surfaces every input RULE-ID in both frames, a dropped id FAILS; no live triad run.
**Files**: `test/m88-triad-consumption-seam.test.js`.
**Test**: this IS the test (exercises M88-G3-T2's consumer + the M88-G3-T1 prompt edits).
