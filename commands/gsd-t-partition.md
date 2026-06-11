# GSD-T: Partition Work into Domains

You are the lead agent. Decompose the current milestone into independent domains by invoking the generic upper-stage Workflow at `templates/workflows/gsd-t-phase.workflow.js` with `phase: "partition"`.

## What this command does

Runs the partition phase as a deterministic Workflow:

```
preflight → brief (kind=partition) → partition agent (opus, with phase protocol)
```

The agent decomposes the milestone into 2–5 file-disjoint domains, writes `.gsd-t/domains/{domain}/{scope,constraints,tasks}.md`, and records cross-domain contracts under `.gsd-t/contracts/`. The brief (M55-D2) is generated once so the agent doesn't re-walk the repo.

## Step 1: Read the current milestone state

Read `.gsd-t/progress.md` to determine the active milestone and its defined scope. If a scan exists and is stale (>10 commits or >14 days), the agent refreshes the relevant dimensions before partitioning.

## Step 2: Resolve the active model profile (M86 — invoke-time injection)

Before calling the Workflow, resolve the active model profile to build the `overrides` map:

```bash
# Run via Bash at invoke time:
gsd-t model-profile resolve --profile <active-profile> --json
# <active-profile> = read from .gsd-t/model-profile.json "profile" field, or default "premium"
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

A configured-standard project silently billing premium fable post-promo is the exact inverse of
the spend-switch goal. Never silently fall through.

Also surface a SUCCESSFUL resolve that carries a `configError` field (the resolver returns a
named default + `configError` for malformed/hand-edited configs — Red Team M86): print the
`configError` as a visible warning naming the effective profile before proceeding. A clean-looking
run on a posture the user did not configure is the same silent-spend failure class.

## Step 3: Invoke the phase Workflow

Call the `Workflow` tool with:

```js
{
  // Resolve the ABSOLUTE path FIRST via Bash: `gsd-t workflow-path phase` (the
  // workflow ships in the installed @tekyzinc/gsd-t package, not this project — a
  // bare relative path only resolves from the GSD-T source repo). Use its stdout here:
  scriptPath: "<absolute path printed by `gsd-t workflow-path phase`>",
  args: {
    phase: "partition",
    milestone: "M{NN}",
    projectDir: ".",
    userInput: "$ARGUMENTS",
    // M86: inject the resolved overrides map so the workflow's ?? forms pick up the
    // profile-tier assignments instead of falling back to the premium literals.
    // Pass {} when the resolver failed AND you chose the loud-warning path (not halt).
    overrides: { /* ...from resolver result.overrides, or {} on failure */ }
    // M84 Competition Mode is AUTOMATIC — do NOT pass `competition` by default.
    // The workflow runs a solution-space probe and self-decides whether to fan out
    // N candidate partitions (judged by the file-disjointness oracle). Only pass an
    // override if the user explicitly asked: `--competition 0`/`--no-competition`
    // → competition: 0; `--competition N` (2-5) → competition: N.
  }
}
```

**Competition Mode (automatic).** Partition auto-competes when the workflow's probe finds ≥2 genuinely different ways to carve the domains; the objective file-disjointness oracle judges the candidates and picks the most-parallelizable valid one. No flag needed. Override only on explicit request: `/gsd-t-partition --no-competition` (force single draft) or `--competition N` (force N). See `.gsd-t/contracts/competition-mode-contract.md`.

## Step 4: Interpret the result

The Workflow returns `{ status, artifacts, summary, decisions }` (plus `competition: { n, winner, ranked }` when Competition Mode ran).

- `status === "complete"`: domains scoped, contracts drafted. Auto-advance to `/gsd-t-plan`.
- `status === "partial" | "blocked"`: read `summary` for what's missing (e.g. ambiguous scope needing discussion).
- `status === "failed"`: preflight blocked or the agent could not decompose. Read `summary`.

## Document Ripple

The partition agent writes domain scope/constraints/tasks and a Decision Log entry. Verify `.gsd-t/contracts/m{NN}-integration-points.md` reflects the wave sequencing.

## Next Up

`/gsd-t-plan` — write per-domain `tasks.md` with file-disjointness validation. (`/gsd-t-discuss` first if the milestone is architecturally complex.)
