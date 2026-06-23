# GSD-T: Plan — Create Domain Task Lists with Dependencies

You are the lead agent. Run the plan phase by invoking the generic upper-stage Workflow at `templates/workflows/gsd-t-phase.workflow.js` with `phase: "plan"`. Planning is ALWAYS single-session — one agent with full context across all domains to ensure consistency. The phase Workflow runs exactly one planning agent, preserving that property.

## What this command does

```
preflight → brief (kind=plan) → plan agent (opus, with phase protocol)
```

For each domain, the agent writes atomic `tasks.md` entries in parallel-execution shape (`### Mxx-Dx-Tx — title`, a `**Touches**:` field per task, `## Files Owned` in scope.md), with contract refs, dependencies, and acceptance criteria. It updates `.gsd-t/contracts/integration-points.md` with wave groupings and validates file-disjointness via `gsd-t parallel --dry-run`.

## Step 1: Read the current milestone state

Read `.gsd-t/progress.md` and each domain's `scope.md`/`constraints.md`. The partition output is the input to planning.

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
    phase: "plan",
    milestone: "M{NN}",
    projectDir: ".",
    userInput: "$ARGUMENTS",
    // M86: inject the resolved overrides map (pre-mortem uses this).
    // Pass {} when the resolver failed AND you chose the loud-warning path (not halt).
    overrides: { /* ...from resolver result.overrides, or {} on failure */ }
  }
}
```

## Step 4: Interpret the result

The Workflow returns `{ status, artifacts, summary, decisions, traceability?, preMortem? }`.

- `status === "complete"`: every domain has atomic tasks; `gsd-t parallel --dry-run` validates disjointness; **M83 plan hardening passed** (acceptance-traceability gate + adversarial pre-mortem). Auto-advance to `/gsd-t-execute`.
- `status === "partial" | "blocked"`: read `summary` (e.g. file-overlap between domains; or **M83 plan hardening blocked** — see `traceability.violations` / `preMortem.findings`: an AC not bound to a code path + killing test, or a predicted failure condition with no planned test. Fix `tasks.md` and re-run plan).
- `status === "failed"`: read `summary`.

**M83 Plan Hardening (runs automatically at the end of plan, blocking before execute).** Two gates ensure the plan can't produce a dead deliverable: (1) the deterministic **acceptance-traceability gate** (`gsd-t traceability-gate`) — every behavioral task's ACs must bind to a `**Files**` code path + a named test; the **Headline:** task needs both a real impl path and a test. (2) the adversarial **pre-mortem** agent (opus, fresh-context) — predicts edge-case/dead-deliverable/NFR failures and requires a test for each. Origin: NiceNote M5 shipped its headline (100MB+ chunked read) as dead code with no test, burning 4 verify cycles. Contract: `.gsd-t/contracts/plan-hardening-contract.md`.

## Document Ripple

The plan agent writes per-domain `tasks.md`, updates `integration-points.md`, and adds a Decision Log entry.

## Next Up

`/gsd-t-execute` — run domain tasks (solo or parallel). (`/gsd-t-impact` first if the change is risky.)
