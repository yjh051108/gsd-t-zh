# Tasks: traceability-section-coverage (M87 D2 — Wave 2)

## Files Owned
- `bin/gsd-t-traceability-gate.cjs`
- `test/m87-traceability-section-coverage.test.js`

---

### M87-D2-T1 — Document the competition-altitude design decision (Wave 1 contribution)
**Touches**: `.gsd-t/domains/traceability-section-coverage/scope.md`
**PseudoCode-Section**: PseudoCode-Extension#the-two-ais-in-one-breath
Record (in scope.md §"Design decision") the M82-competition-altitude-shift
interaction: gate stays altitude-agnostic; the shift is D3's workflow change
wired at integrate-time. (DONE at partition — this is the wave-1 contribution.)
**Acceptance criteria**: the interaction is SPECIFIED before build, not discovered at integrate.
**Files**: scope.md (this domain).
**Test**: M87-D3-T4 (`test/m87-milestone-signoff-flow.test.js`) — the consumer test that exercises the altitude-shift this note specifies (the phase-workflow probe shifting UP to the high-level-approach altitude); the note is non-code, so its downstream realization is the test surface. Plus the M83 regression suite (`test/m83-*`) proving the gate stays altitude-agnostic.

### M87-D2-T2 — Extend the gate with section-citation coverage
**Touches**: `bin/gsd-t-traceability-gate.cjs`
**PseudoCode-Section**: PseudoCode-Extension#6-rules-vs-ai-the-decision-map
Parse `**PseudoCode-Section**: <Title>#<anchor>` from task blocks (path-as-path,
emphasis-stripped via existing `_bare`). When a `PseudoCode-[Title].md` is in
scope, build the **set of its sections per contract §3.1** (every `##` heading
OUTSIDE Appendix code fences) and the set of cited sections (each cited anchor
resolved against the **§3.2 GitHub-style slug** of each heading — slug-as-slug,
never substring); report any section with zero citing tasks as an uncovered
structural gap. An anchor that resolves to NO `##`-heading slug is itself a
FAILURE (unresolvable-citation class). Preserve ALL existing M83 behavior + exit
codes.
**Acceptance criteria**: SC2 — extended not replaced; structural parse per §3.1/§3.2; unresolvable citation FAILS; existing M83 tests stay green.
**Files**: `bin/gsd-t-traceability-gate.cjs`.
**Test**: M87-D2-T3.
**Headline**: true

### M87-D2-T3 — A2 planted-gap test (+ fixture-fidelity floor + citation-resolution)
**Touches**: `test/m87-traceability-section-coverage.test.js`
**PseudoCode-Section**: PseudoCode-Extension#6-rules-vs-ai-the-decision-map
**Fixture-fidelity FIRST (non-vacuous guard, mirrors D1's §2 floor):** assert the
gate enumerates a HARD COUNT of `##` sections from the UNMODIFIED exemplars —
PayPal = **10**, Extension = **10** (per contract §3.1/§3.3) — not `≥0`; a gate
that enumerates zero sections is itself a FAILURE (this is what makes "faithful →
no gap" meaningful). **Citation-resolution (catches the phantom-anchor class):**
assert that EVERY `**PseudoCode-Section**` anchor cited across all four M87
`tasks.md` files RESOLVES to a real `##`-heading slug (§3.2) in the named doc —
an unresolvable citation is a FAILURE. Then: feed a tasks.md that omits a task
for one section of a binvoice exemplar (read D1's fixtures read-only) → the gate
reports that exact section as an uncovered gap, path-as-path. Faithful corpus
(every section cited) → no gap. Add a substring-trap negative: a task mentioning
the section NAME in prose but NOT citing it structurally must STILL be reported
as a gap.
**Acceptance criteria**: A2 — gate enumerates the hard section count (PayPal=10, Extension=10); every M87 tasks.md citation resolves to a real `##` slug; planted gap detected structurally; substring mention does not satisfy coverage.
**Files**: `test/m87-traceability-section-coverage.test.js`.
**Test**: this IS the test (the A2 planted-gap harness; the headline impl it exercises is M87-D2-T2's extension of `bin/gsd-t-traceability-gate.cjs`).

---

**DEPENDENCY:** Wave 2. Build M87-D2-T2/T3 only after D1's A1 passes.
M87-D2-T1 (design note) is the wave-1 contribution, complete at partition.
