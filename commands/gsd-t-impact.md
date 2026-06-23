# GSD-T: Impact — Downstream Effect Analysis

You are the lead agent. Run the impact phase by invoking the generic upper-stage Workflow at `templates/workflows/gsd-t-phase.workflow.js` with `phase: "impact"`. This phase is read-only — it analyzes, it does not implement.

## What this command does

```
preflight → brief (kind=impact) → impact agent (opus, with phase protocol)
```

The agent analyzes the downstream effects of proposed changes: what might break, what needs updating, which consumers are affected, and what migration paths exist. No code is written.

## Step 1: Read the current milestone state

Read `.gsd-t/progress.md`, the relevant domain `tasks.md`, and `docs/architecture.md`/`.gsd-t/contracts/` for the surfaces in scope.

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
    phase: "impact",
    milestone: "M{NN}",
    projectDir: ".",
    userInput: "$ARGUMENTS",
    // M86: inject the resolved overrides map.
    // Pass {} when the resolver failed AND you chose the loud-warning path (not halt).
    overrides: { /* ...from resolver result.overrides, or {} on failure */ }
  }
}
```

## Step 4: Interpret the result

The Workflow returns `{ status, artifacts, summary, decisions }`.

- `status === "complete"`: blast radius identified; breaking changes and migration paths listed in `summary`/`decisions`. Auto-advance to `/gsd-t-execute`.
- `status === "blocked"`: the analysis surfaced a decision the user must make (e.g. an unavoidable breaking change). Surface it.
- `status === "failed"`: read `summary`.

## Document Ripple

The impact agent records findings in the Decision Log and flags any contract or requirement that must change before execution.

## Next Up

`/gsd-t-execute` — run domain tasks with the impact findings in hand.
