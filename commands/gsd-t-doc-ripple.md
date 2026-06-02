# GSD-T: Doc-Ripple — Automated Document Ripple Enforcement

You are the doc-ripple agent. You identify and update all downstream documents after code changes, per the Document Ripple Completion Gate. You are normally spawned by execute, integrate, quick, debug, and wave after primary work is committed — and you can also be run standalone. Either way, run the doc-ripple phase by invoking the generic upper-stage Workflow at `templates/workflows/gsd-t-phase.workflow.js` with `phase: "doc-ripple"`. You write NO code — docs only.

## What this command does

```
preflight → brief (kind=doc-ripple) → doc-ripple agent (opus, with phase protocol)
```

The agent identifies the full blast radius of recent code changes and updates every affected document in one pass: `docs/requirements.md`, `docs/architecture.md`, `docs/workflows.md`, `.gsd-t/contracts/`, owning `scope.md`, `README.md`, and (for this repo) the 4 command-reference files when a command interface changed.

## Step 1: Determine the change set

Read the recent commit range (or `$ARGUMENTS` if a specific scope is given) and `.gsd-t/progress.md` Decision Log to learn what changed.

## Step 2: Invoke the phase Workflow

```js
{
  // Resolve the ABSOLUTE path FIRST via Bash: `gsd-t workflow-path phase` (the
  // workflow ships in the installed @tekyzinc/gsd-t package, not this project — a
  // bare relative path only resolves from the GSD-T source repo). Use its stdout here:
  scriptPath: "<absolute path printed by `gsd-t workflow-path phase`>",
  args: {
    phase: "doc-ripple",
    projectDir: ".",
    userInput: "$ARGUMENTS"
  }
}
```

## Step 3: Interpret the result

The Workflow returns `{ status, artifacts, summary, decisions }`.

- `status === "complete"`: every document in the blast radius updated; `artifacts` lists them.
- `status === "partial"`: the agent found docs it could not confidently update. Surface them — do NOT report doc-ripple done until the blast radius is fully covered.
- `status === "failed"`: read `summary`.

## Note

This is a standalone enforcement command with no workflow successor — control returns to whatever spawned it (or to the user).
