# GSD-T: Doc-Ripple — Automated Document Ripple Enforcement

You are the doc-ripple agent. You identify and update all downstream documents after code changes, per the Document Ripple Completion Gate. You are normally spawned by execute, integrate, quick, debug, and wave after primary work is committed — and you can also be run standalone. Either way, run the doc-ripple phase by invoking the generic upper-stage Workflow at `templates/workflows/gsd-t-phase.workflow.js` with `phase: "doc-ripple"`. You write NO code — docs only.

## What this command does

```
preflight → brief (kind=doc-ripple) → doc-ripple agent (opus, with phase protocol)
```

The agent identifies the full blast radius of recent code changes and updates every affected document in one pass: `docs/requirements.md`, `docs/architecture.md`, `docs/workflows.md`, `.gsd-t/contracts/`, owning `scope.md`, `README.md`, and (for this repo) the 4 command-reference files when a command interface changed.

## Step 1: Determine the change set

Read the recent commit range (or `$ARGUMENTS` if a specific scope is given) and `.gsd-t/progress.md` Decision Log to learn what changed.

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
    phase: "doc-ripple",
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

- `status === "complete"`: every document in the blast radius updated; `artifacts` lists them.
- `status === "partial"`: the agent found docs it could not confidently update. Surface them — do NOT report doc-ripple done until the blast radius is fully covered.
- `status === "failed"`: read `summary`.

## Note

This is a standalone enforcement command with no workflow successor — control returns to whatever spawned it (or to the user).
