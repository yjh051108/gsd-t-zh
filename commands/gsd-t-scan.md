# GSD-T: Scan — Deep Codebase Analysis and Tech Debt Discovery

You are the lead agent. Run a deep codebase scan by invoking the canonical Workflow script at `templates/workflows/gsd-t-scan.workflow.js`.

## What this command does

Replaces the legacy 5-teammate prose scan with a single deterministic, **volume-scaled** Workflow:

```
preflight → volume-probe → pipeline(per-slice deep finder → single verify) → synthesis → render
```

**Why volume-scaled (M66):** the legacy scan hard-coded exactly 5 teammates (one per dimension) with zero volume scaling — a 5-file repo and a 1,809-file repo both got 5 agents, so a single `quality` agent sampled the top ~5 issues across the whole codebase and stopped. The volume-probe stage now measures the codebase (files, routes, ORM tables, components, top-level dirs) and carves it into **narrow slices** — one deep-finder agent per area, scaling from 1-3 slices on a tiny repo to 15-40 on a large one. Each finder OWNS its slice and is mandated to *enumerate, not sample*. A single verify pass confirms each finding against the real code and drops false positives. Synthesis dedups/merges/re-ranks into `techdebt.md` and continues TD numbering from the archived prior register. The deterministic `bin/scan-*.js` renderers (schema extraction, diagrams, HTML report) run as the final stage, unchanged.

Each stage is a schema-validated `agent()` call (or deterministic CLI). Finders and verifiers run concurrently up to the Workflow runtime's concurrency cap. Slice DEPTH scales with `budget.total` when a per-turn token target is set.

## Step 1: Read existing context

Read `CLAUDE.md`, `.gsd-t/progress.md`, `.gsd-t/contracts/`, and any existing `.gsd-t/techdebt.md` (the Workflow archives and continues from it). This tells the scan what's already known so it dedups rather than re-discovers.

## Step 2: Invoke the scan Workflow

Call the `Workflow` tool with:

```js
{
  scriptPath: "templates/workflows/gsd-t-scan.workflow.js",
  args: {
    projectDir: ".",        // the project to scan
    scanNumber: 12,         // optional — for the register header
    maxSlicesHint: 40,      // optional — soft cap on derived slices (no silent truncation)
    verify: "single"        // optional — "single" (default) | "none"
  }
}
```

The Workflow handles preflight, the volume probe, the per-slice deep-finder fan-out, the single verify pass, register synthesis (with archive + TD-numbering continuation), and the deterministic schema/diagram/HTML render. Each stage emits a progress line visible via `/workflows`. The runtime persists the script path on every invocation; iterate by editing the persisted file and re-invoking with the same `scriptPath`.

## Step 3: Interpret the result

The Workflow returns:

```js
{
  status: "complete" | "failed",
  slices: 24,                       // how many slices the probe derived
  findings: 117,                    // verified findings after the verify pass
  counts: { critical, high, medium, low, total },
  registerPath: ".gsd-t/techdebt.md",
  archivePath: ".gsd-t/techdebt_YYYY-MM-DD.md" | null,
  htmlReport: "<path>" | null,
  probeTotals: { files, routes, tables, components, ... }
}
```

- `status === "complete"`: the deep register is written; present the summary (counts + top critical items) and offer `/gsd-t-promote-debt`.
- `status === "failed"`: read `reason` — `preflight-failed`, `no-slices` (probe produced an empty slice list), or `synthesis-failed` (register not written).

Present a summary: headline volume totals, findings by severity, the top critical items, and the archive path. Then ask: "Want to promote any tech debt items to milestones with `/gsd-t-promote-debt`?"

## Document Ripple

The scan Workflow updates these (synthesis stage commits the register + archive):

- `.gsd-t/techdebt.md` — fresh register (prior one archived to `.gsd-t/techdebt_YYYY-MM-DD.md`)
- `.gsd-t/progress.md` — Decision Log entry with scan summary stats

The deterministic render stage produces the HTML scan report via `bin/scan-report.js`. Living-document cross-population (`docs/architecture.md`, `docs/workflows.md`, `docs/infrastructure.md`, `docs/requirements.md`, `README.md`) is a follow-on the lead agent performs from the register + `.gsd-t/scan/` outputs when present.

## Next Up

`/gsd-t-promote-debt` — convert tech-debt items to milestones.

$ARGUMENTS
