# GSD-T: Wave — Full Cycle Orchestration

> **⛔ Invoke the Workflow tool — do not hand-drive.** Your only job is to resolve the workflow path (`gsd-t workflow-path wave`) and call the `Workflow` tool as the steps below instruct. Do NOT reconstruct the workflow stages in your own reasoning, spawn finder/worker subagents yourself, or fall back to a hand-driven run — that skips the deterministic stages and produces an incomplete result. The prose below describes what the Workflow does internally; it is background, not a to-do list for you.


You are the lead agent. Run a milestone wave end-to-end by invoking the canonical Workflow script at `templates/workflows/gsd-t-wave.workflow.js`.

## What this command does

Replaces the M40-era wave-orchestrator-agent-per-phase scaffolding with a single Workflow that composes execute and verify as sub-workflows:

```
gsd-t-wave.workflow.js
  ├── workflow("gsd-t-execute", {milestone, domains, projectDir})
  │       └── preflight → brief → disjointness → parallel(workers) → integrate → verify-gate
  └── workflow("gsd-t-verify", {milestone, projectDir})
          └── preflight → verify-gate → M57 gates → M58 gate → orthogonal triad → synthesis
```

The native Workflow `workflow()` global runs each sub-workflow inline and returns its envelope. Sub-workflow tokens count against the parent's budget; sub-workflow agents appear under a "▸ name" group in `/workflows`. Nesting is one level deep — a sub-workflow cannot call another sub-workflow.

## Step 1: Read the current milestone state

Read `.gsd-t/progress.md` to determine the active milestone and the wave domain list from `.gsd-t/contracts/m{NN}-integration-points.md`.

## Step 2: Invoke the wave Workflow

Call the `Workflow` tool with:

```js
{
  // Resolve the ABSOLUTE path FIRST via Bash: `gsd-t workflow-path wave` (the
  // workflow ships in the installed @tekyzinc/gsd-t package, not this project — a
  // bare relative path only resolves from the GSD-T source repo). Use its stdout here:
  scriptPath: "<absolute path printed by `gsd-t workflow-path wave`>",
  args: {
    milestone: "M{NN}",
    domains: ["m{NN}-d1-...", "m{NN}-d2-...", ...],  // domains for this wave only, per integration-points
    projectDir: "."
  }
}
```

## Step 3: Interpret the result

```js
{
  status: "complete" | "verify-failed" | "failed",
  milestone: "M{NN}",
  execResult: { status, domainResults, integrate, verifyGate },
  verifyResult: { status, overallVerdict, verifyGate, buildCoverage, ciParity, testDataPurge, triad, verdict }
}
```

- `complete` → auto-advance to `/gsd-t-complete-milestone`.
- `verify-failed` → execute completed but verify-gate found regressions; invoke `gsd-t-debug` against `verifyResult.verdict.blockingFindings`.
- `failed` → domain worker, integrate, or preflight blocked; read `execResult.domainResults` for the blocking entry.

## Multi-Wave Milestones

For milestones with multiple waves (see `.gsd-t/contracts/m{NN}-integration-points.md` "Wave Sequencing"), invoke `gsd-t-wave` once per wave. Each call uses the domain list for that wave. Checkpoints (C1, C2, C3, …) gate between waves — verify the prior wave's verdict before starting the next.

## Document Ripple

Wave delegates to execute and verify; their doc-ripple guarantees apply. Wave itself adds:

- `.gsd-t/progress.md` — wave-level status line + per-wave verdict

## Next Up

`/gsd-t-complete-milestone` (after final wave). For mid-milestone waves, no next-up — operator runs the next wave when ready.
