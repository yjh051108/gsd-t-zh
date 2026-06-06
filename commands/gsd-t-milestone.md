# GSD-T: New Milestone — Define and Optionally Partition

You are the lead agent. Define a new milestone by invoking the generic upper-stage Workflow at `templates/workflows/gsd-t-phase.workflow.js` with `phase: "milestone"`. A milestone is a significant deliverable (e.g., "User Authentication", "Payment Integration").

## What this command does

```
preflight → brief (kind=milestone) → milestone agent (opus, with phase protocol)
```

The agent defines the milestone — origin, goal, falsifiable success criteria — and appends it to `.gsd-t/progress.md`. Partition is deferred (the Next Up successor). Effort/scope is expressed in GSD-T-native units (domain count, wave count, spawn count) — never developer-hours.

## Step 1: Load context

Read `.gsd-t/progress.md` (current version + completed milestones), `docs/requirements.md`, and `docs/architecture.md` so the new milestone is framed against existing state.

## Step 2: Invoke the phase Workflow

```js
{
  // Resolve the ABSOLUTE path FIRST via Bash: `gsd-t workflow-path phase` (the
  // workflow ships in the installed @tekyzinc/gsd-t package, not this project — a
  // bare relative path only resolves from the GSD-T source repo). Use its stdout here:
  scriptPath: "<absolute path printed by `gsd-t workflow-path phase`>",
  args: {
    phase: "milestone",
    projectDir: ".",
    userInput: "$ARGUMENTS"
    // M84 Competition Mode is AUTOMATIC — do NOT pass `competition` by default.
    // The workflow probes (opus) and self-decides; milestone decomposition is the
    // highest-altitude decision, so it competes whenever ≥2 genuinely different
    // strategies (risk-first / value-first / dependency-first) exist. Override only
    // on explicit request: `--no-competition` → 0, `--competition N` (2-5) → N.
  }
}
```

**Competition Mode (automatic).** Milestone decomposition auto-competes when the probe finds ≥2 genuinely different strategies. Because a decomposition is a *coupled thesis*, the judge selects one winner whole (pick-one) and salvages only non-overlapping good line-items from the losers — it never Frankensteins. No flag needed; override with `--no-competition` / `--competition N` on explicit request. See `.gsd-t/contracts/competition-mode-contract.md`.

## Step 3: Interpret the result

The Workflow returns `{ status, artifacts, summary, decisions }` (plus `competition: { n, winner, ranked }` when Competition Mode ran).

- `status === "complete"`: milestone defined and appended to progress.md with falsifiable SCs. Do NOT auto-partition for large/risky milestones — show the Next Up hint.
- `status === "blocked"`: the agent needs a scoping decision from the user.
- `status === "failed"`: read `summary`.

## Document Ripple

The milestone agent appends the milestone definition + a Decision Log entry to `.gsd-t/progress.md`.

## Next Up

`/gsd-t-partition` — decompose the milestone into domains.
