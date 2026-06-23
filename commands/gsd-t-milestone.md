# GSD-T: New Milestone — Define and Optionally Partition

You are the lead agent. Define a new milestone by invoking the generic upper-stage Workflow at `templates/workflows/gsd-t-phase.workflow.js` with `phase: "milestone"`. A milestone is a significant deliverable (e.g., "User Authentication", "Payment Integration").

## What this command does

```
preflight → brief (kind=milestone) → milestone agent (opus, with phase protocol)
  → TWO-ALTITUDE intention-first authoring flow (default-ON):
      1. HIGH-LEVEL APPROACH altitude (what/why/when, actors, one-breath summary)
         → user signs off the APPROACH
      2. DETAILED altitude — author `PseudoCode-[Title].md` at exemplar granularity
```

The agent defines the milestone — origin, goal, falsifiable success criteria — and appends it to `.gsd-t/progress.md`. Partition is deferred (the Next Up successor). Effort/scope is expressed in GSD-T-native units (domain count, wave count, spawn count) — never developer-hours.

## Two-Altitude Intention-First Flow (default-ON, M87)

A milestone is authored at **two altitudes, in order** — the high-level approach is signed off BEFORE the detailed decomposition is written. This is the intention-first source-of-truth flow (contract `.gsd-t/contracts/pseudocode-source-of-truth-contract.md` §1). It is a **prose flow** — the command DESCRIBES the sign-off checkpoint below; it does NOT bind a machine-checkable "DEFINED only after sign-off" predicate (that deterministic `isDefined(milestone)` gate is M88).

### Altitude 1 — High-Level Approach (signed off FIRST)

Before any field-level detail, the milestone agent emits a **high-level approach pseudocode** covering:

- **What / Why / When** — the directive the milestone serves, in the user's own intention (never agent reasoning).
- **Actors** — the parties/components/realms the approach touches.
- **One-breath summary** — "one call in one breath": the whole approach stated as a single coherent thought.

The agent then **presents this approach to the user for SIGN-OFF**. The user signs off the APPROACH before the detailed doc is written. This sign-off checkpoint is the gate between the two altitudes — the detailed `PseudoCode-[Title].md` is only authored AFTER the approach is approved.

### Altitude 2 — Detailed `PseudoCode-[Title].md`

Only after the approach is signed off, the agent authors the detailed `PseudoCode-[Title].md` at exemplar granularity (the five section elements of contract §1: Intention, Mechanism, one-breath summary table, Guard map, Divergence flags, Appendix). `[Title]` is the SUBJECT the doc represents (e.g. `PseudoCode-PayPal.md`), never a milestone id; a milestone may produce several. Per-milestone docs live at `.gsd-t/pseudocode/PseudoCode-[Title].md` (contract §7).

### Default-ON; skip is a LOGGED decision

The two-altitude flow is **default-ON**. Skipping the detailed-doc altitude is a **LOGGED decision** in `.gsd-t/progress.md` (Decision Log entry naming WHY it was skipped) — **never a silent default-off** (`feedback_no_silent_degradation`). A skip that is not logged is a process failure.

### Keep-or-supersede on inherited shipped code

When the milestone inherits a model from shipped code, the agent runs the **keep-or-supersede** protocol (`templates/prompts/keep-or-supersede-subagent.md`): per inherited model, ASK keep or supersede. Each **supersede** WRITES a `⚠ Divergence` flag into the doc (contract §4 grammar shape). Keep = no flag. The deterministic divergence-grammar round-trip is M88; the ASK + flag-writing is the M87 prose protocol.

## Step 1: Load context

Read `.gsd-t/progress.md` (current version + completed milestones), `docs/requirements.md`, and `docs/architecture.md` so the new milestone is framed against existing state.

## Step 2: Resolve the active model profile (M86 — invoke-time injection)

Before calling the Workflow, resolve the active model profile to build the `overrides` map:

```bash
# Run via Bash at invoke time:
gsd-t model-profile resolve --json
# Bare form (NO --profile flag): reads .gsd-t/model-profile.json — profile AND stageOverrides
# (set-stage overrides MUST win — contract precedence; --profile is a config-blind diagnostic
# form that ZEROES stageOverrides and must never be used for invocation — Red Team M86 r3)
```

**Resolver-failure handling (M86 — pre-mortem c2 #2):** if the resolve call fails, do NOT
silently proceed on the premium fallback. Either HALT with `blocked-needs-human`, or proceed
ONLY with a loud, surfaced warning:
```
⚠ model-profile resolver unavailable — running on PREMIUM fallback literals
  (configured profile unknown; stale global binary may lack model-profile subcommand)
```

Also surface a SUCCESSFUL resolve that carries a `configError` field (the resolver returns a
named default + `configError` for malformed/hand-edited configs — Red Team M86): print the
`configError` as a visible warning naming the effective profile before proceeding. A clean-looking
run on a posture the user did not configure is the same silent-spend failure class.

## Step 3: Invoke the phase Workflow

```js
{
  // Resolve the ABSOLUTE path FIRST via Bash: `gsd-t workflow-path phase` (the
  // workflow ships in the installed @tekyzinc/gsd-t package, not this project — a
  // bare relative path only resolves from the GSD-T source repo). Use its stdout here:
  scriptPath: "<absolute path printed by `gsd-t workflow-path phase`>",
  args: {
    phase: "milestone",
    projectDir: ".",
    userInput: "$ARGUMENTS",
    // M86: inject the resolved overrides map (probe + judge use this).
    // Pass {} when the resolver failed AND you chose the loud-warning path (not halt).
    overrides: { /* ...from resolver result.overrides, or {} on failure */ }
    // M84 Competition Mode is AUTOMATIC — do NOT pass `competition` by default.
    // The workflow probes (opus) and self-decides; milestone decomposition is the
    // highest-altitude decision, so it competes whenever ≥2 genuinely different
    // strategies (risk-first / value-first / dependency-first) exist. Override only
    // on explicit request: `--no-competition` → 0, `--competition N` (2-5) → N.
  }
}
```

**Competition Mode (automatic).** Milestone decomposition auto-competes when the probe finds ≥2 genuinely different strategies. Because a decomposition is a *coupled thesis*, the judge selects one winner whole (pick-one) and salvages only non-overlapping good line-items from the losers — it never Frankensteins. No flag needed; override with `--no-competition` / `--competition N` on explicit request. See `.gsd-t/contracts/competition-mode-contract.md`.

## Step 4: Interpret the result

The Workflow returns `{ status, artifacts, summary, decisions }` (plus `competition: { n, winner, ranked }` when Competition Mode ran).

- `status === "complete"`: milestone defined and appended to progress.md with falsifiable SCs. Do NOT auto-partition for large/risky milestones — show the Next Up hint.
- `status === "blocked"`: the agent needs a scoping decision from the user.
- `status === "failed"`: read `summary`.

## Document Ripple

The milestone agent appends the milestone definition + a Decision Log entry to `.gsd-t/progress.md`, and:

- **`PseudoCode-[Title].md`** (at `.gsd-t/pseudocode/PseudoCode-[Title].md`) — the detailed intention-first source-of-truth doc authored at Altitude 2 (one per coherent subject; a milestone may produce several). Written only after the Altitude-1 approach is signed off. A skip is a LOGGED Decision Log entry, never a silent omission.

## Next Up

`/gsd-t-partition` — decompose the milestone into domains.
