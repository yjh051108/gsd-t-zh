# GSD-T: Execute — Run Domain Tasks

You are the lead agent. Execute the current milestone by invoking the canonical Workflow script at `templates/workflows/gsd-t-execute.workflow.js`.

## What this command does

Replaces the M40-era orchestrator/worker/parallel/spawn-plan shell with a single deterministic Workflow:

```
preflight → brief → file-disjointness → parallel(domain workers) → integrate → verify-gate
```

Each domain worker is a schema-validated `agent()` call. Domain workers run concurrently up to the Workflow runtime's concurrency cap. File-disjointness is proved BEFORE fan-out as defense in depth. The brief (M55-D2) is generated once and threaded into every worker.

## Step 1: Read the current milestone state

Read `.gsd-t/progress.md` to determine the active milestone. Read each domain's `tasks.md` to determine the worker set. Use the domain list from `.gsd-t/contracts/m{NN}-integration-points.md` for the current wave, NOT the full domain set.

## Step 2: Invoke the execute Workflow

Call the `Workflow` tool with:

```js
{
  // Resolve the ABSOLUTE path FIRST via Bash: `gsd-t workflow-path execute` (the
  // workflow ships in the installed @tekyzinc/gsd-t package, not this project — a
  // bare relative path only resolves from the GSD-T source repo). Use its stdout here:
  scriptPath: "<absolute path printed by `gsd-t workflow-path execute`>",
  args: {
    milestone: "M{NN}",
    domains: ["m{NN}-d1-...", "m{NN}-d2-...", ...],
    projectDir: "."
  }
}
```

The Workflow handles preflight, brief generation, file-disjointness validation, parallel domain workers, integrate barrier, and verify-gate. Each stage emits a progress line visible via `/workflows`. The runtime persists the script path on every invocation; iterate by editing the persisted file and re-invoking with the same `scriptPath`.

## Step 3: Interpret the result

The Workflow returns:

```js
{
  status: "complete" | "verify-failed" | "failed",
  milestone: "M{NN}",
  domainResults: [{ domain, status, filesTouched, tasksDone, tasksBlocked, notes }, ...],
  integrate: { status, crossDomainEdits, notes },
  verifyGate: { ok, track1, track2, ... }
}
```

- `status === "complete"`: every domain reported `complete`, integrate landed clean, verify-gate green. Auto-advance to the next phase.
- `status === "verify-failed"`: domains completed but verify-gate found regressions. Invoke `gsd-t-debug` (or its Workflow) before retry.
- `status === "failed"`: a domain reported `failed`, integrate failed, or preflight blocked. Read `domainResults` for the blocking entry.

## Document Ripple

After execute completes, ensure these are updated in the same commit chain:

- `.gsd-t/progress.md` — Decision Log entry per executed task or domain
- `docs/architecture.md` — if new components or data-flow changes
- `.gsd-t/contracts/` — if interfaces changed
- `docs/requirements.md` — mark requirements complete or revised

These are normally handled inside each domain worker's commits. The integrate stage verifies they landed.

## Next Up (auto-advance)

`/gsd-t-verify` (or the verify Workflow directly). The execute Workflow's verify-gate step is a fast deterministic check; `/gsd-t-verify` runs the full orthogonal triad (`/code-review ultra` ∥ Red Team ∥ QA) per `.gsd-t/contracts/orthogonal-validation-contract.md`.
