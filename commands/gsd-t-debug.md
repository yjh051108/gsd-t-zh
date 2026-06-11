# GSD-T: Debug — Systematic Debugging with Contract Awareness

> **⛔ Invoke the Workflow tool — do not hand-drive.** Your only job is to resolve the workflow path (`gsd-t workflow-path debug`) and call the `Workflow` tool as the steps below instruct. Do NOT reconstruct the workflow stages in your own reasoning, spawn finder/worker subagents yourself, or fall back to a hand-driven run — that skips the deterministic stages and produces an incomplete result. The prose below describes what the Workflow does internally; it is background, not a to-do list for you.


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

## Step 2: Resolve the active model profile (M86 — invoke-time injection)

Before calling the Workflow, resolve the active model profile to build the `overrides` map:

```bash
# Run via Bash at invoke time:
gsd-t model-profile resolve --json
# Bare form (NO --profile flag): reads .gsd-t/model-profile.json — profile AND stageOverrides
# (set-stage overrides MUST win — contract precedence; --profile is a config-blind diagnostic
# form that ZEROES stageOverrides and must never be used for invocation — Red Team M86 r3)
# Output: { "ok": true, "profile": "...", "overrides": { "stage-key": "concrete-model-id", ... } }
```

**Resolver-failure handling (M86 — SC(f), pre-mortem c2 #2):** if the resolve call fails
(`{ok:false}`, spawn error, or the `model-profile` subcommand is not present in the installed
binary), do NOT silently proceed on the premium fallback. Either:
- HALT with `blocked-needs-human` and explain the resolver is unavailable; OR
- Proceed ONLY with a **loud, surfaced warning** that names the effective posture:

  ```
  ⚠ model-profile resolver unavailable — running on PREMIUM fallback literals
    (configured profile unknown; stale global binary may lack model-profile subcommand)
  ```

Also surface a SUCCESSFUL resolve that carries a `configError` field (the resolver returns a
named default + `configError` for malformed/hand-edited configs — Red Team M86): print the
`configError` as a visible warning naming the effective profile before proceeding. A clean-looking
run on a posture the user did not configure is the same silent-spend failure class.

## Step 3: Invoke the debug Workflow

Call the `Workflow` tool with:

```js
{
  // Resolve the ABSOLUTE path FIRST via Bash: `gsd-t workflow-path debug` (the
  // workflow ships in the installed @tekyzinc/gsd-t package, not this project — a
  // bare relative path only resolves from the GSD-T source repo). Use its stdout here:
  scriptPath: "<absolute path printed by `gsd-t workflow-path debug`>",
  args: {
    symptom: "describe the failing test or runtime error in one sentence",
    projectDir: ".",
    // M86: inject the resolved overrides map so the workflow's ?? form for debug-cycle-2
    // picks up the profile-tier assignment instead of the premium fable literal.
    // Pass {} when the resolver failed AND you chose the loud-warning path (not halt).
    overrides: { /* ...from resolver result.overrides, or {} on failure */ }
  }
}
```

The Workflow runs up to 2 cycles. Cycle 2 receives Cycle 1's failed hypothesis to prevent re-trying the same approach.

## Step 4: Interpret the result

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
