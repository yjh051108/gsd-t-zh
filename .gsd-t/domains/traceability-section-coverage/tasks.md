# Tasks: traceability-section-coverage (M87 D2 — Wave 2)

> **FOLDED cycle-4 MEDIUM (gate-scoping) into this domain (2026-06-17).**
> `listTasksFiles` (`bin/gsd-t-traceability-gate.cjs` ~lines 244–248) filters
> domains by `name.startsWith(mPrefix)` and FALLS BACK to ALL domains when zero
> match. The M87 domains are SUBJECT-named (guard-bridge-spike,
> traceability-section-coverage, milestone-two-altitude-flow,
> template-docripple-contract — no `m87` prefix), so `--milestone M87` matches
> zero and mis-scopes to EVERY historical domain. Fix below (M87-D2-T4) +
> killing test (M87-D2-T5). Subject-naming is intentional — do NOT rename domains.

## Files Owned
- `bin/gsd-t-traceability-gate.cjs`
- `test/m87-traceability-section-coverage.test.js`
- `test/m87-gate-milestone-scoping.test.js`

---

### M87-D2-T1 — Document the competition-altitude design decision (Wave 1 contribution)
**Touches**: `.gsd-t/domains/traceability-section-coverage/scope.md`
**PseudoCode-Section**: PseudoCode-Extension#the-two-ais-in-one-breath
Record (in scope.md §"Design decision") the M82-competition-altitude-shift
interaction: gate stays altitude-agnostic; the shift is D3's workflow change
wired at integrate-time. (DONE at partition — this is the wave-1 contribution.)
**Acceptance criteria**: the interaction is SPECIFIED before build, not discovered at integrate.
**Files**: scope.md (this domain).
**Test**: M87-D3-T4 (`test/m87-milestone-flow.test.js`) — the consumer test that exercises the altitude-shift this note specifies (the phase-workflow probe shifting UP to the high-level-approach altitude); the note is non-code, so its downstream realization is the test surface. Plus the M83 regression suite (`test/m83-*`) proving the gate stays altitude-agnostic.

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

### M87-D2-T4 — Gate-scoping fix: explicit milestone→domains scoping (cycle-4 MEDIUM)
**Touches**: `bin/gsd-t-traceability-gate.cjs`
**PseudoCode-Section**: PseudoCode-Extension#6-rules-vs-ai-the-decision-map
Fix `listTasksFiles` so `--milestone M87` scopes to EXACTLY the M87 domains and
NEVER falls back to all historical domains when the `mNN` prefix matches zero.
**Minimal mechanism (chosen — does NOT rename the subject-named domains): accept
an explicit domain-list.** Add a `--domains <a,b,c>` CLI option (and a matching
`domains: [...]` param to `runGate`/`listTasksFiles`): when provided, the gate
scopes to exactly those domain directories (each must exist + carry a `tasks.md`;
a named-but-missing domain is an error, not a silent drop). The zero-prefix-match
fall-back-to-all is REPLACED by deterministic behavior: if `--milestone` is given,
prefix-match yields zero, AND no `--domains` list is supplied → the gate returns a
structured error (exit 64, `reason: "milestone-scope-unresolved"`) naming the
milestone and instructing `--domains`, rather than silently scoping to all
historical domains. (The existing prefix-match path is preserved for
prefix-named milestones; the single-domain `--tasks-file` path is unchanged.)
**Acceptance criteria**: SC2 (scoping half) — `--domains` scopes to exactly the
listed domains; a missing named domain errors; with `--milestone` set, zero
prefix-match + no `--domains` → exit 64 `milestone-scope-unresolved`, never
fall-back-to-all; existing prefix-match + `--tasks-file` paths + all M83 tests stay green.
**Files**: `bin/gsd-t-traceability-gate.cjs`.
**Test**: M87-D2-T5.
**Headline**: true

### M87-D2-T5 — Gate-scoping killing test
**Touches**: `test/m87-gate-milestone-scoping.test.js`
**PseudoCode-Section**: PseudoCode-Extension#6-rules-vs-ai-the-decision-map
Assert `--milestone M87 --domains guard-bridge-spike,traceability-section-coverage,milestone-two-altitude-flow,template-docripple-contract`
scopes to EXACTLY those four domains and ZERO historical domains (assert the set
of `domain` values in the result equals exactly the four). Negative: `--milestone
M87` with NO `--domains` (and no `m87`-prefixed dir present) → exit 64
`milestone-scope-unresolved`, NOT a run over all historical domains. Negative: a
named domain that does not exist → error, not silent drop. Regression: a
genuinely prefix-named milestone still scopes by prefix (M83 behavior preserved).
**Acceptance criteria**: `--milestone M87 --domains <the four>` → exactly the four
M87 domains, zero historical; missing `--domains` with zero prefix-match → exit 64;
missing named domain errors; prefix-named milestone path unchanged.
**Files**: `test/m87-gate-milestone-scoping.test.js`.
**Test**: this IS the test (the gate-scoping killing test; the headline impl it exercises is M87-D2-T4's `listTasksFiles`/`runGate` scoping fix).

---

**DEPENDENCY:** Wave 2. Build M87-D2-T2/T3/T4/T5 only after D1's A1 passes.
M87-D2-T1 (design note) is the wave-1 contribution, complete at partition.
