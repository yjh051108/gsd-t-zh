# Domain: m61-d6-migrate-orchestration-to-workflow

## Responsibility
Port the GSD-T orchestration core to native Workflow scripts (Anthropic native Workflow tool). This is THE migration domain — the bake-off (2026-05-29) already proved this is feasible by re-running M58 as a single Workflow script. **Wave 1, paired with D5.**

KEEP the brains (file-disjointness prover, task-graph reader, brief generator) but RUN them inside Workflow scripts instead of the supervisor/unattended/headless-auto-spawn shell.

## Owned Files (port + delete)

**Port to Workflow scripts (delete after port verified):**
- `bin/gsd-t-orchestrator.js`
- `bin/orchestrator.js`
- `bin/gsd-t-orchestrator-worker.cjs`
- `bin/gsd-t-orchestrator-queue.cjs`
- `bin/gsd-t-orchestrator-config.cjs`
- `bin/gsd-t-parallel.cjs`
- `bin/parallel-cli.cjs` + `bin/parallel-cli-tee.cjs`
- `bin/spawn-plan-writer.cjs` + any sibling `spawn-plan-*` scripts

**KEEP unchanged (brains — invoked from Workflow scripts):**
- `bin/gsd-t-file-disjointness.cjs` (file-disjointness prover)
- `bin/gsd-t-task-graph.cjs` (task-graph reader)
- `bin/gsd-t-context-brief.cjs` (brief generator)
- `bin/cli-preflight.cjs` (preflight envelope)

## Owned Files (create)

Workflow scripts (location decided at execute time — likely `templates/workflows/` so they ship with the package + can be customized per project):
- `gsd-t-execute.workflow.js` — replaces the orchestrator + worker loop for execute
- `gsd-t-verify.workflow.js` — pipelines preflight → brief → verify-gate → Red Team / QA stages
- `gsd-t-wave.workflow.js` — full milestone cycle
- `gsd-t-integrate.workflow.js` — cross-domain integration phase
- `gsd-t-debug.workflow.js` — replaces `gsd-t headless --debug-loop`
- `gsd-t-partition.workflow.js`, `plan.workflow.js`, `discuss.workflow.js`, `impact.workflow.js`, `milestone.workflow.js` (M56 upper-stage briefs already wired — port these)

## Owned Files (edit)
- `commands/gsd-t-execute.md`, `verify.md`, `wave.md`, `integrate.md`, `debug.md`, `quick.md`, `partition.md`, `plan.md`, `discuss.md`, `impact.md`, `milestone.md`, `prd.md` — convert from prose-driven imperative shell to thin invokers of the corresponding Workflow script. Step structure preserved; bash blocks shrink to "invoke Workflow X".

## NOT Owned (do not modify)
- D1-D5 retire targets (those waves run after D6 commits)
- D7 KEEP list (validation gates) — D6 invokes them inside Workflow stages but does not edit them
- D8 doc-ripple (CLAUDE.md edits happen after D6+D7 land)

## Estimated LOC
- Removed (orchestration shell): ~6,500 LOC
- Added (Workflow scripts): ~500 LOC (Workflows are dense)
- Net: ~-6,000 LOC

## Falsifiable acceptance
A representative milestone (re-run of M58 — already validated by the bake-off) runs end-to-end via the new Workflow scripts:
- Wave preflight passes
- D1∥D2 parallel agents executed via `parallel()` or `pipeline()`
- File-disjointness prover invoked inside Workflow
- Brief generator threaded through workers
- Red Team / QA / Design-Verify run as `parallel()` `agent()` calls
- verify-gate exits 0
- `/code-review ultra` runs alongside Red Team and produces complementary findings (no double-counting)
- Final commits / tags identical to what the M58 native run produced

## Pre-merge gate
M58 re-run via new Workflow scripts produces identical contracts, identical commits modulo dates, and clean verify-gate.
