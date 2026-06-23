# Domain: milestone-two-altitude-flow

**Milestone**: M87 — Intention-First PseudoCode as Source-of-Truth
**Wave**: 2 (starts only after D1's A1 passes)
**Risk**: LOW — known GSD-T patterns (`/gsd-t-milestone` + phase-workflow +
a prompt protocol).
**Risk isolation**: owns the milestone command, the phase-workflow milestone
branch, and the keep-or-supersede prompt — disjoint from the bin modules (D1/D2)
and from D4's template/contract/doc-ripple.

> **RE-SCOPED at the cycle-4 split (2026-06-17).** D3 ships the two-altitude
> FLOW + the keep-or-supersede PROMPT as PROSE/PROTOCOL. The DETERMINISTIC
> sign-off GATE (A3 — a machine-checkable "unsigned ≠ DEFINED" state + an
> `isDefined(milestone)` predicate) and the deterministic divergence-grammar
> round-trip (SC4's deterministic half) **moved to M88** (backlog #35): no
> milestone-state artifact exists in the codebase today.

## Thesis (R3 + R4 — FLOW/PROTOCOL only; deterministic gate → M88)

The two-altitude intention-first authoring flow plus the keep-or-supersede
protocol:

1. High-level approach pseudocode (what/why/when, actors, one-breath summary)
   → user signs off the APPROACH →
2. Detailed decomposition to `PseudoCode-[Title].md` at exemplar granularity →
3. The flow DESCRIBES a sign-off checkpoint before the milestone is treated as
   DEFINED. Default-ON; skip is a LOGGED decision, never a silent default-off
   (`feedback_no_silent_degradation`). **The machine-checkable DEFINED-state
   GATE is M88** — D3 ships only the prose flow, not a state predicate.

Per inherited-from-shipped-code model, the agent asks **keep-or-supersede**
(prose protocol); each supersede WRITES a `⚠ Divergence` flag in the doc (§4 of
the source-of-truth contract). This bakes in the exact PayPal stored-draft
over-trust rescue. The deterministic `parseDivergence()`/`formatDivergence()`
round-trip is M88.

## Deliverables

- `commands/gsd-t-milestone.md` — the two-altitude flow steps (prose; sign-off
  checkpoint described, not a deterministic gate).
- `templates/workflows/gsd-t-phase.workflow.js` — the `"milestone"` phase branch
  carrying the two-altitude flow. ALSO owns the integrate-time wiring of D2's
  documented competition-altitude shift (the solution-space probe shifting UP to
  the high-level-approach altitude). (No deterministic sign-off state machine —
  that is M88.)
- `templates/prompts/keep-or-supersede-subagent.md` — the forcing keep-or-supersede
  prompt protocol that writes `⚠ Divergence` flags.
- Flow + altitude-agnostic-seam tests (`test/m87-milestone-flow.test.js`).

## Files Owned

- `commands/gsd-t-milestone.md`
- `templates/workflows/gsd-t-phase.workflow.js`
- `templates/prompts/keep-or-supersede-subagent.md`
- `test/m87-milestone-flow.test.js`
- `.gsd-t/domains/milestone-two-altitude-flow/{scope,constraints,tasks}.md`

## Acceptance Criteria

- **SC3 (FLOW half):** `/gsd-t-milestone` runs the two-altitude flow (approach
  sign-off precedes the detailed doc); default-ON; skip logged. (The deterministic
  "DEFINED only after sign-off" gate — old A3 — is M88.)
- **SC4 (PROTOCOL half):** keep-or-supersede asked per inherited model; each
  supersede WRITES a `⚠ Divergence` flag in the doc. (The deterministic grammar
  round-trip is M88.)
- **Altitude-agnostic seam:** the section-coverage gate's exit semantics are
  identical whether the competition probe runs at partition or high-level-approach
  altitude (proven end-to-end in `test/m87-milestone-flow.test.js`).

## Boundaries (NOT owned)
- Does NOT edit the bin modules (D1/D2) or `bin/gsd-t.js`.
- Does NOT author `templates/PseudoCode-spec.md`, the contract, or doc-ripple (D4).
- Does NOT edit the verify triad prompts (A5 integrate seam).
- Workflow edits stay M71 sandbox-clean (no require/fs/process) and M85
  tier-policy-conformant (A6).
