# Domain: traceability-section-coverage

**Milestone**: M87 — Intention-First PseudoCode as Source-of-Truth
**Wave**: 2 (starts only after D1's A1 passes)
**Risk**: HIGH — mutates EXISTING shipped code (the M83 traceability-gate); the
known non-converging-Red-Team trap for coverage checks.
**Risk isolation**: sole owner of the gate file + its test; fully disjoint from
D1's new module and from D3/D4's workflow/command/template files.

## Thesis (R2)

Extend the EXISTING M83 deterministic gate so plan tasks must CITE the
pseudocode section they implement; a section with ZERO implementing tasks is a
structural coverage gap (path-as-path parse, NEVER substring). Extends, does
not replace.

## Deliverables

- Extend `bin/gsd-t-traceability-gate.cjs`: parse the `**PseudoCode-Section**:
  <Title>#<anchor>` task field (§3 of the source-of-truth contract); when a
  `PseudoCode-[Title].md` is in scope, every section must have ≥1 citing task;
  a zero-task section is reported as an uncovered structural gap (like
  journey-coverage). The existing AC→(path+test) binding is preserved untouched.
- The A2 planted-gap test against the binvoice exemplar corpus (consumes D1's
  fixtures READ-ONLY; does not write them).
- A **scope.md design note** (in this file, §"Design decision" below) recording
  the competition-altitude-shift interaction — leaving the workflow wiring of
  that decision to integrate-time.

## Files Owned

- `bin/gsd-t-traceability-gate.cjs`
- `test/m87-traceability-section-coverage.test.js`
- `.gsd-t/domains/traceability-section-coverage/{scope,constraints,tasks}.md`

## Acceptance Criteria

- **A2:** a tasks.md omitting a task for one pseudocode section → the extended
  gate reports that section as an uncovered gap (structural, path-as-path).
  Passes the binvoice exemplar corpus, fails the planted gap.
- **SC2:** the M83 gate is EXTENDED, not replaced — existing AC→path+test
  binding still enforced; existing M83 traceability tests stay green.

## Design decision — competition-altitude shift (R2, documented here)

Backlog #34: when behavior is spec'd in pseudocode, M82 competition shifts UP
to the **high-level-approach altitude** — producers compete on the *approach*
(the high-level pseudocode), not on the partition. **Decision (recorded for
integrate-time):** the section-coverage gate stays altitude-agnostic — it
checks tasks↔sections structurally regardless of where competition runs. The
altitude shift is a `gsd-t-phase.workflow.js` solution-space-probe change,
OWNED BY D3's workflow file, wired at integrate-time, NOT here. This domain
only DOCUMENTS the interaction so it is specified, not discovered at integrate.

## Boundaries (NOT owned)
- Does NOT edit `bin/gsd-t.js` dispatch or `commands/gsd-t-verify.md` (integrate seams).
- Does NOT edit D1's `bin/gsd-t-guard-map.cjs` (consumes its JSON contract only).
- Does NOT edit the verify triad prompts (A5 integrate seam — D2 only documents
  that the rule set feeds them).
- Does NOT write the fixtures (D1 owns; D2 reads them).
