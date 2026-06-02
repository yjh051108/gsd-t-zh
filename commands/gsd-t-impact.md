# GSD-T: Impact — Downstream Effect Analysis

You are the lead agent. Run the impact phase by invoking the generic upper-stage Workflow at `templates/workflows/gsd-t-phase.workflow.js` with `phase: "impact"`. This phase is read-only — it analyzes, it does not implement.

## What this command does

```
preflight → brief (kind=impact) → impact agent (opus, with phase protocol)
```

The agent analyzes the downstream effects of proposed changes: what might break, what needs updating, which consumers are affected, and what migration paths exist. No code is written.

## Step 1: Read the current milestone state

Read `.gsd-t/progress.md`, the relevant domain `tasks.md`, and `docs/architecture.md`/`.gsd-t/contracts/` for the surfaces in scope.

## Step 2: Invoke the phase Workflow

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
    userInput: "$ARGUMENTS"
  }
}
```

## Step 3: Interpret the result

The Workflow returns `{ status, artifacts, summary, decisions }`.

- `status === "complete"`: blast radius identified; breaking changes and migration paths listed in `summary`/`decisions`. Auto-advance to `/gsd-t-execute`.
- `status === "blocked"`: the analysis surfaced a decision the user must make (e.g. an unavoidable breaking change). Surface it.
- `status === "failed"`: read `summary`.

## Document Ripple

The impact agent records findings in the Decision Log and flags any contract or requirement that must change before execution.

## Next Up

`/gsd-t-execute` — run domain tasks with the impact findings in hand.
