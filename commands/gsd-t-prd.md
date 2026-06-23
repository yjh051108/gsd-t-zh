# GSD-T: PRD — Generate a Product Requirements Document

You are the lead agent. Generate a PRD by invoking the generic upper-stage Workflow at `templates/workflows/gsd-t-phase.workflow.js` with `phase: "prd"`. The output, `docs/prd.md`, feeds directly into `gsd-t-project`, `gsd-t-milestone`, `gsd-t-partition`, and `gsd-t-plan`.

## What this command does

```
preflight → brief (kind=prd) → PRD agent (opus, with phase protocol)
```

The agent takes a user's idea — however rough — reads available GSD-T project state, and produces `docs/prd.md` with functional and non-functional requirements traceable to acceptance criteria.

## Step 1: Load context

Read any existing `docs/requirements.md`, `docs/architecture.md`, and `.gsd-t/progress.md`. Capture the user's idea from `$ARGUMENTS`.

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
    phase: "prd",
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

- `status === "complete"`: `docs/prd.md` written, requirements traceable to acceptance criteria.
- `status === "partial" | "blocked"`: the agent needs clarification on scope or priorities. Surface the questions.
- `status === "failed"`: read `summary`.

## Document Ripple

The PRD agent writes `docs/prd.md` and a Decision Log entry.

## Next Up

`/gsd-t-milestone` — define the first milestone from the PRD. (Or `/gsd-t-project` to decompose a full greenfield build.)
