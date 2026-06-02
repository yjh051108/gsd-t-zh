# GSD-T: Plan — Create Domain Task Lists with Dependencies

You are the lead agent. Run the plan phase by invoking the generic upper-stage Workflow at `templates/workflows/gsd-t-phase.workflow.js` with `phase: "plan"`. Planning is ALWAYS single-session — one agent with full context across all domains to ensure consistency. The phase Workflow runs exactly one planning agent, preserving that property.

## What this command does

```
preflight → brief (kind=plan) → plan agent (opus, with phase protocol)
```

For each domain, the agent writes atomic `tasks.md` entries in parallel-execution shape (`### Mxx-Dx-Tx — title`, a `**Touches**:` field per task, `## Files Owned` in scope.md), with contract refs, dependencies, and acceptance criteria. It updates `.gsd-t/contracts/integration-points.md` with wave groupings and validates file-disjointness via `gsd-t parallel --dry-run`.

## Step 1: Read the current milestone state

Read `.gsd-t/progress.md` and each domain's `scope.md`/`constraints.md`. The partition output is the input to planning.

## Step 2: Invoke the phase Workflow

```js
{
  // Resolve the ABSOLUTE path FIRST via Bash: `gsd-t workflow-path phase` (the
  // workflow ships in the installed @tekyzinc/gsd-t package, not this project — a
  // bare relative path only resolves from the GSD-T source repo). Use its stdout here:
  scriptPath: "<absolute path printed by `gsd-t workflow-path phase`>",
  args: {
    phase: "plan",
    milestone: "M{NN}",
    projectDir: ".",
    userInput: "$ARGUMENTS"
  }
}
```

## Step 3: Interpret the result

The Workflow returns `{ status, artifacts, summary, decisions }`.

- `status === "complete"`: every domain has atomic tasks; `gsd-t parallel --dry-run` validates disjointness. Auto-advance to `/gsd-t-execute`.
- `status === "partial" | "blocked"`: read `summary` (e.g. file-overlap between domains needing re-scoping).
- `status === "failed"`: read `summary`.

## Document Ripple

The plan agent writes per-domain `tasks.md`, updates `integration-points.md`, and adds a Decision Log entry.

## Next Up

`/gsd-t-execute` — run domain tasks (solo or parallel). (`/gsd-t-impact` first if the change is risky.)
