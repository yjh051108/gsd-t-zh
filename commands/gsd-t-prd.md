# GSD-T: PRD — Generate a Product Requirements Document

You are the lead agent. Generate a PRD by invoking the generic upper-stage Workflow at `templates/workflows/gsd-t-phase.workflow.js` with `phase: "prd"`. The output, `docs/prd.md`, feeds directly into `gsd-t-project`, `gsd-t-milestone`, `gsd-t-partition`, and `gsd-t-plan`.

## What this command does

```
preflight → brief (kind=prd) → PRD agent (opus, with phase protocol)
```

The agent takes a user's idea — however rough — reads available GSD-T project state, and produces `docs/prd.md` with functional and non-functional requirements traceable to acceptance criteria.

## Step 1: Load context

Read any existing `docs/requirements.md`, `docs/architecture.md`, and `.gsd-t/progress.md`. Capture the user's idea from `$ARGUMENTS`.

## Step 2: Invoke the phase Workflow

```js
{
  // Resolve the ABSOLUTE path FIRST via Bash: `gsd-t workflow-path phase` (the
  // workflow ships in the installed @tekyzinc/gsd-t package, not this project — a
  // bare relative path only resolves from the GSD-T source repo). Use its stdout here:
  scriptPath: "<absolute path printed by `gsd-t workflow-path phase`>",
  args: {
    phase: "prd",
    projectDir: ".",
    userInput: "$ARGUMENTS"
  }
}
```

## Step 3: Interpret the result

The Workflow returns `{ status, artifacts, summary, decisions }`.

- `status === "complete"`: `docs/prd.md` written, requirements traceable to acceptance criteria.
- `status === "partial" | "blocked"`: the agent needs clarification on scope or priorities. Surface the questions.
- `status === "failed"`: read `summary`.

## Document Ripple

The PRD agent writes `docs/prd.md` and a Decision Log entry.

## Next Up

`/gsd-t-milestone` — define the first milestone from the PRD. (Or `/gsd-t-project` to decompose a full greenfield build.)
