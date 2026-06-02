# GSD-T: Debug — Systematic Debugging with Contract Awareness

You are the lead agent. Debug a failing test or runtime error by invoking the canonical Workflow script at `templates/workflows/gsd-t-debug.workflow.js`.

## What this command does

Replaces the M40-era debug-orchestrator scaffolding with a deterministic 2-cycle Workflow per CLAUDE.md Prime Rule ("up to 2 fix attempts before delegating"):

```
preflight → brief → Cycle 1 (diagnose → hypothesis → fix → test → report)
                  → Cycle 2 (only if Cycle 1 didn't resolve; sees Cycle 1's failed hypothesis)
                  → exit "needs-human" if both cycles exhausted
```

## Step 1: Read the current milestone state

Read `.gsd-t/progress.md`. Note any failing tests or runtime errors in the Decision Log.

## Step 2: Invoke the debug Workflow

Call the `Workflow` tool with:

```js
{
  // Resolve the ABSOLUTE path FIRST via Bash: `gsd-t workflow-path debug` (the
  // workflow ships in the installed @tekyzinc/gsd-t package, not this project — a
  // bare relative path only resolves from the GSD-T source repo). Use its stdout here:
  scriptPath: "<absolute path printed by `gsd-t workflow-path debug`>",
  args: {
    symptom: "describe the failing test or runtime error in one sentence",
    projectDir: "."
  }
}
```

The Workflow runs up to 2 cycles. Cycle 2 receives Cycle 1's failed hypothesis to prevent re-trying the same approach.

## Step 3: Interpret the result

```js
{
  status: "complete" | "needs-human",
  cyclesUsed: 1 | 2,
  finalResult: {
    resolved: boolean,
    rootCause: string,
    filesEdited: [...],
    testRunResult: { pass, fail },
    nextStepsIfNotResolved: string
  }
}
```

- `complete` → re-run verify (`/gsd-t-verify`); auto-advance.
- `needs-human` → present root-cause hypothesis + nextStepsIfNotResolved to the user. Do NOT spawn a third cycle; that's the Prime Rule.

## Contract-Boundary Debugging

If the bug is at a domain contract boundary (one domain calls another via API/schema/component contract), the debug cycle agent is instructed to:
1. Read both domains' constraints.md
2. Read the contract definition
3. Verify both sides honor the contract
4. Identify which side drifted

This is a Workflow-stage instruction, not a separate command — same `gsd-t-debug.workflow.js` handles both intra-domain bugs and contract-boundary bugs.

## Document Ripple

- `.gsd-t/progress.md` — Decision Log entry per cycle with hypothesis + resolution
- `.gsd-t/qa-issues.md` — append if bug came from QA findings
- `.gsd-t/red-team-report.md` — mark as resolved if bug came from Red Team

## Next Up

`/gsd-t-verify` on resolution, OR human review on `needs-human`.
