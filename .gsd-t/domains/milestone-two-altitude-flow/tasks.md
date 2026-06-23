# Tasks: milestone-two-altitude-flow (M87 D3 — Wave 2)

> **RE-SCOPED at the cycle-4 split (2026-06-17).** D3 ships the two-altitude
> FLOW + the keep-or-supersede PROMPT as PROSE/PROTOCOL. The DETERMINISTIC
> sign-off GATE (A3 — a machine-checkable "unsigned ≠ DEFINED" state + an
> `isDefined(milestone)` predicate) **moved to M88** (backlog #35): no
> milestone-state artifact exists in the codebase today, so the gate needs its
> own design. The keep-or-supersede ASK stays here (inherent prose protocol);
> the deterministic `parseDivergence()`/`formatDivergence()` grammar round-trip
> (SC4 deterministic half) also moved to M88. What REMAINS below is the flow +
> the altitude shift + the prompt — all M83-valid (Files + Test).

## Files Owned
- `commands/gsd-t-milestone.md`
- `templates/workflows/gsd-t-phase.workflow.js`
- `templates/prompts/keep-or-supersede-subagent.md`
- `test/m87-milestone-flow.test.js`

---

### M87-D3-T1 — Two-altitude flow in /gsd-t-milestone (PROSE/PROTOCOL)
**Touches**: `commands/gsd-t-milestone.md`
**PseudoCode-Section**: PseudoCode-Extension#the-two-ais-in-one-breath
Add steps: high-level approach pseudocode (what/why/when, actors, one-breath
summary) → user signs off APPROACH → detailed `PseudoCode-[Title].md`.
Default-ON; skip = logged decision. Add Document Ripple section listing
`PseudoCode-[Title].md`. **This is the prose FLOW only** — the machine-checkable
"DEFINED only after sign-off" GATE moved to M88 (no state artifact exists yet).
The command may DESCRIBE the sign-off checkpoint in prose; it does not bind a
deterministic predicate (that is M88's `isDefined(milestone)`).
**Acceptance criteria**: SC3 (flow half) — two-altitude flow runs; approach
sign-off precedes detailed-doc; skip logged. (The deterministic DEFINED gate is M88.)
**Files**: `commands/gsd-t-milestone.md`.
**Test**: M87-D3-T4.
**Headline**: true

### M87-D3-T2 — Phase-workflow milestone branch + altitude shift (NO deterministic sign-off state — M88)
**Touches**: `templates/workflows/gsd-t-phase.workflow.js`
**PseudoCode-Section**: PseudoCode-Extension#3-the-verdict-rule-rule-ai-service-worker-realm
Implement the `"milestone"` phase two-altitude flow (high-level approach → detailed
doc). Wire D2's documented competition-altitude shift: the solution-space probe
shifts UP to the high-level-approach altitude when behavior is spec'd. M71
sandbox-clean; M85 tier literals policy-conformant; M82 blindness preserved
(producers stay opus, judge differs). **The deterministic sign-off STATE
transition (unsigned ≠ DEFINED) moved to M88** — this task ships only the flow +
the altitude shift, not a machine-checkable state machine.
**Acceptance criteria**: A6 — M71 + M85 lints stay green; the milestone-phase
two-altitude flow + altitude shift wired (no deterministic DEFINED-state assertion — that is M88).
**Files**: `templates/workflows/gsd-t-phase.workflow.js`.
**Test**: M87-D3-T4, plus existing `test/m71-...lint`, `test/m85-...lint` (stay green).
**Headline**: true

### M87-D3-T3 — Keep-or-supersede prompt protocol (PROSE PROTOCOL — divergence grammar round-trip is M88)
**Touches**: `templates/prompts/keep-or-supersede-subagent.md`
**PseudoCode-Section**: PseudoCode-PayPal#4b-unlock-recreate-confirm-deletion-on-paypal-first-web-app-server
Author the forcing keep-or-supersede protocol: per inherited shipped-code model,
ASK keep or supersede; each supersede WRITES a `⚠ Divergence` flag (§4 grammar
shape) into the doc. Bakes the PayPal stored-draft over-trust rescue into
methodology. **This is the inherent prose PROTOCOL (the ASK) — its reliability is
bounded by how forcing the prompt is, NOT a deterministic gate.** The
deterministic `parseDivergence()`/`formatDivergence()` grammar round-trip (so the
divergence count is a checkable artifact) moved to M88 (§4 grammar stays defined
in the contract, annotated M88).
**Acceptance criteria**: SC4 (protocol half) — the prompt forces the keep/supersede
ASK and instructs writing a `⚠ Divergence` flag on supersede. (The deterministic grammar round-trip is M88.)
**Files**: `templates/prompts/keep-or-supersede-subagent.md`.
**Test**: M87-D3-T4.

### M87-D3-T4 — Flow + altitude-agnostic seam tests (deterministic sign-off STATE test → M88)
**Touches**: `test/m87-milestone-flow.test.js`
**PseudoCode-Section**: PseudoCode-Extension#3-the-verdict-rule-rule-ai-service-worker-realm
**The deterministic sign-off-state test (unsigned ≠ DEFINED; signing flips; skip
logged) MOVED to M88** — no machine-checkable milestone-state artifact exists yet
to assert against. What this test proves (all deterministic, available now):
- the `/gsd-t-milestone` command + phase-workflow milestone branch carry the
  two-altitude flow structure (the approach-altitude step precedes the
  detailed-doc step — structural assertion over the command/workflow text);
- the keep-or-supersede prompt instructs writing a `⚠ Divergence` flag on supersede;
- **Altitude-agnostic seam (proves the D2↔D3 seam end-to-end — pre-mortem LOW
  A2):** the section-coverage gate yields IDENTICAL exit semantics whether the
  competition solution-space probe runs at partition altitude or at
  high-level-approach altitude — i.e. shifting the probe UP (D2's documented
  decision, wired here in `gsd-t-phase.workflow.js`) does NOT change the gate's
  pass/fail verdict on the same corpus. Proves the "gate stays altitude-agnostic"
  seam contract, not just the documented note.
**Acceptance criteria**: two-altitude flow structure present; keep-or-supersede
prompt emits a Divergence flag on supersede; section-coverage gate exit semantics
identical across both competition altitudes (altitude-agnostic seam proven end-to-end). _(The deterministic DEFINED-state assertion is M88.)_
**Files**: `test/m87-milestone-flow.test.js`.
**Test**: this IS the test (the flow + altitude-agnostic-seam harness; the headline impls it exercises are M87-D3-T1/T2's milestone flow + phase-workflow altitude shift).

---

**DEPENDENCY:** Wave 2. Build only after D1's A1 passes.
