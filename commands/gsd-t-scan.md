# GSD-T: Scan — Deep Codebase Analysis and Tech Debt Discovery

You are the lead agent. Run a deep codebase scan by invoking the canonical Workflow script at `templates/workflows/gsd-t-scan.workflow.js`.

## What this command does

Replaces the legacy 5-teammate prose scan with a single deterministic, **volume-scaled** Workflow:

```
preflight → volume-probe → pipeline(per-slice deep finder → single verify) → synthesis → document → render
```

**Why volume-scaled (M66):** the legacy scan hard-coded exactly 5 teammates (one per dimension) with zero volume scaling — a 5-file repo and a 1,809-file repo both got 5 agents, so a single `quality` agent sampled the top ~5 issues across the whole codebase and stopped. The volume-probe stage now measures the codebase (files, routes, ORM tables, components, top-level dirs) and carves it into **narrow slices** — one deep-finder agent per area, scaling from 1-3 slices on a tiny repo to 15-40 on a large one. Each finder OWNS its slice and is mandated to *enumerate, not sample*. A single verify pass confirms each finding against the real code and drops false positives. Synthesis dedups/merges/re-ranks into `techdebt.md` and continues TD numbering from the archived prior register.

**Deep document stage (M67):** after the register lands, a `document` phase fans out **one agent per document**, each drawing on the same slices + verified findings, to deterministically produce the full living-document set — `docs/architecture.md` (component map per feature-domain slice), `docs/workflows.md` (a user journey per slice), `docs/infrastructure.md`, `docs/requirements.md`, `README.md` (all merge-not-overwrite) — plus the five `.gsd-t/scan/*.md` dimension files (`architecture`, `security`, `quality`, `business-rules`, `contract-drift`) in the renderer's parsed formats. This replaces M66's non-deterministic "lead-agent follow-on" so the documents are as thorough as the register. The deterministic `bin/scan-*.js` renderers (schema extraction, diagrams, HTML report) run last, reading the deep `.gsd-t/scan/architecture.md`.

Each stage is a schema-validated `agent()` call (or deterministic CLI). Finders and verifiers run concurrently up to the Workflow runtime's concurrency cap. Slice DEPTH scales with `budget.total` when a per-turn token target is set.

## Step 1: Read existing context

Read `CLAUDE.md`, `.gsd-t/progress.md`, `.gsd-t/contracts/`, and any existing `.gsd-t/techdebt.md` (the Workflow archives and continues from it). This tells the scan what's already known so it dedups rather than re-discovers.

## Step 2: Resolve the workflow path, then invoke

First resolve the ABSOLUTE path to the workflow script (the workflow ships inside the installed `@tekyzinc/gsd-t` package, NOT in the current project — a bare relative `templates/workflows/...` path only resolves when CWD is the GSD-T source repo, so from any other project `Workflow()` cannot find it). Run via Bash:

```bash
gsd-t workflow-path scan
```

It prints the absolute path (exit 0). Use that exact string as `scriptPath`. If `gsd-t` is not on PATH, fall back to `npx @tekyzinc/gsd-t workflow-path scan`, or derive it from the package: `node -e "const p=require('child_process').execSync('npm root -g').toString().trim(); console.log(p+'/@tekyzinc/gsd-t/templates/workflows/gsd-t-scan.workflow.js')"`. Do NOT fall back to a relative path or a hand-driven scan — that produces an incomplete result (the original bug). Then call the `Workflow` tool with:

```js
{
  scriptPath: "<absolute path printed by `gsd-t workflow-path scan`>",
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

The scan Workflow updates ALL of these deterministically (no manual follow-on):

- `.gsd-t/techdebt.md` — fresh register (synthesis; prior one archived to `.gsd-t/techdebt_YYYY-MM-DD.md`)
- `.gsd-t/techdebt_in_plain_english.md` — non-technical companion to the register: every TD item in layman's terms, why it matters, and a real-world analogy (document phase)
- `.gsd-t/scan/{architecture,security,quality,business-rules,contract-drift}.md` — dimension analysis files (document phase)
- `docs/architecture.md`, `docs/workflows.md`, `docs/infrastructure.md`, `docs/requirements.md`, `README.md` — living docs, **merged not overwritten** (document phase)
- HTML scan report via `bin/scan-report.js` (render phase)

The document phase + render commit these via git on the feature branch (no push). The lead agent should still add a `.gsd-t/progress.md` Decision Log entry with the scan summary stats.

## Next Up

`/gsd-t-promote-debt` — convert tech-debt items to milestones.

$ARGUMENTS
