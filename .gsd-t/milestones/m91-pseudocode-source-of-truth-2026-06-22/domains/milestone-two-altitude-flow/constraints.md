# Constraints: milestone-two-altitude-flow

## No silent degradation
- Sign-off gate is DEFAULT-ON. Skipping the detailed-doc sign-off is a LOGGED
  decision in progress.md — never a silent default-off
  (`feedback_no_silent_degradation`). A3 asserts the skip path is logged.

## Sign-off is a real state gate
- A milestone is NOT "DEFINED" until the detailed `PseudoCode-[Title].md` is
  signed off. The state transition must be assertable (A3 negative test:
  unsigned ≠ DEFINED; signing flips it).

## Keep-or-supersede forcing
- Per inherited-from-shipped-code model, ASK keep-or-supersede before encoding
  it. Reliability is bounded by how FORCING the question is (it is a
  prompt-protocol obligation, not a deterministic gate) — make the prompt
  maximally forcing. Each supersede MUST emit a `⚠ Divergence` flag (§4
  grammar). Doc prose is the USER's intention, never agent reasoning.

## Workflow invariants (gsd-t-phase.workflow.js)
- **M71 runtime-native:** NO `require`/`fs`/`path`/`child_process`/`process`;
  `args` is a JSON STRING (`JSON.parse` it); delegate any CLI call via an
  `agent()`'s Bash inline helper. The M71 lint MUST stay green.
- **M85 tier-policy:** any `model:` literal MUST match
  `bin/gsd-t-model-tier-policy.cjs`. The competition-altitude-shift probe stays
  on the policy tier the solution-space probe already uses (`fable` per M85).
  The M85 lint MUST stay green.
- **M82 blindness invariant** preserved: competition producers stay `opus`,
  judge differs from producers — the altitude shift does NOT change WHO
  competes, only WHAT they compete on (approach vs partition).

## Command-file conventions
- Pure markdown, no frontmatter, accepts `$ARGUMENTS`, step-numbered, thin
  Workflow invoker. Include a Document Ripple section.

## Wave discipline
- Wave 2 only. Do NOT start until D1's A1 passes.
