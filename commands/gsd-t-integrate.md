# GSD-T: Integrate — Wire Domains Together

You are the lead agent. Integrate cross-domain work by invoking the canonical Workflow script at `templates/workflows/gsd-t-integrate.workflow.js`.

## What this command does

Replaces the M40-era single-session integrate scaffolding with a deterministic Workflow that runs cross-domain wire-up between completed parallel domain workers:

```
preflight → brief → integrate agent (sees all domain results) → light verify-gate
```

Integrate runs AFTER parallel domain workers commit their work and BEFORE the full verify Workflow. It handles:

- Shared-file edits sequenced at integrate (per `.gsd-t/contracts/m{NN}-integration-points.md` "Cross-Domain File Contention Matrix")
- Cross-domain contract updates (e.g. integration-points.md status flips)
- Interleaved-touch resolution where two domains both modified the same file's separate regions

It does NOT re-do work that domain workers already did, and does NOT run the full orthogonal validation triad (that's `/gsd-t-verify`).

## Step 1: Read the current milestone state

Read `.gsd-t/progress.md` and verify all required domain workers have completed (status `complete` in their tasks.md). Read `.gsd-t/contracts/m{NN}-integration-points.md` for the shared-file matrix.

## Step 2: Invoke the integrate Workflow

Call the `Workflow` tool with:

```js
{
  // Resolve the ABSOLUTE path FIRST via Bash: `gsd-t workflow-path integrate` (the
  // workflow ships in the installed @tekyzinc/gsd-t package, not this project — a
  // bare relative path only resolves from the GSD-T source repo). Use its stdout here:
  scriptPath: "<absolute path printed by `gsd-t workflow-path integrate`>",
  args: {
    milestone: "M{NN}",
    domains: ["m{NN}-d1-...", "m{NN}-d2-..."],  // domains that just completed
    projectDir: "."
  }
}
```

## Step 3: Interpret the result

```js
{
  status: "complete" | "verify-failed" | "failed",
  integrate: {
    status: "green" | "warnings" | "failed",
    crossDomainEdits: [...],
    notes: string
  },
  verifyGate: { ... }
}
```

- `complete` (integrate green + verify-gate green) → auto-advance to `/gsd-t-verify` for the full triad.
- `verify-failed` (integrate green but verify-gate red) → invoke `gsd-t-debug`.
- `failed` (integrate failed) → cross-domain wire-up could not complete; read `integrate.notes` for the blocker.

## Document Ripple

The integrate agent updates:
- Cross-domain contracts in `.gsd-t/contracts/` (status flips, API surface changes)
- `.gsd-t/contracts/m{NN}-integration-points.md` — checkpoint flag (C1 done → C2 ready)
- `.gsd-t/progress.md` — integrate verdict + cross-domain edit summary

Each domain's own doc-ripple was handled by the domain worker (per execute Workflow's worker prompt).

## Next Up

`/gsd-t-verify` (full orthogonal triad on the integrated milestone state).
