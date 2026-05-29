# Tasks: m61-d6-migrate-orchestration-to-workflow

## Summary
Port the orchestration core to native Workflow scripts. KEEP the brains (file-disjointness, task-graph, brief, preflight) and invoke them from inside Workflows. Convert 12 command files from prose-driven orchestrator invocations to thin Workflow invokers. Wave 1 — must land before any retire wave.

## Tasks

### Task M61-D6-T1 — Author Workflow script scaffolding
- **Touches**: `templates/workflows/` (new dir), `templates/workflows/_lib.js` (shared helpers — read brief, exec preflight, parse file-disjointness)
- **Contract refs**: `.gsd-t/contracts/file-disjointness-contract.md`, `context-brief-contract.md`, `cli-preflight-contract.md`
- **Dependencies**: NONE
- **Acceptance**: `templates/workflows/_lib.js` exports `loadBrief()`, `runPreflight()`, `proveFileDisjointness(tasks)`, `runVerifyGate()`. Pure functions; no side effects on import.

### Task M61-D6-T2 — Workflow: gsd-t-execute
- **Touches**: `templates/workflows/gsd-t-execute.workflow.js`
- **Contract refs**: `headless-default-contract.md` (the architecture pattern documented in progress.md:120)
- **Dependencies**: BLOCKED by T1
- **Acceptance**: One Workflow script exporting `meta = {name, description, phases}`. Pipeline: preflight → brief → `parallel(domainTasks → agent(taskPrompt, {schema}))` → integrate barrier → verify-gate. Dry-runs against a 2-task fixture and returns expected schema.

### Task M61-D6-T3 — Workflow: gsd-t-verify (with /code-review ultra cooperative pass)
- **Touches**: `templates/workflows/gsd-t-verify.workflow.js`
- **Contract refs**: `verify-gate-contract.md`, `test-data-tagging-contract.md` v1.1.0, `orthogonal-validation-contract.md` (D7 will create)
- **Dependencies**: BLOCKED by T1
- **Acceptance**: Pipeline: preflight → brief → verify-gate → `parallel([RedTeamStage, /code-review ultra stage, QA stage])` → synthesis. Each stage uses schema-validated `agent()` output. Test-data purge runs after E2E, before VERDICT (Step 4.5 logic preserved).

### Task M61-D6-T4 — Workflow: gsd-t-wave (milestone full cycle)
- **Touches**: `templates/workflows/gsd-t-wave.workflow.js`
- **Contract refs**: `headless-default-contract.md`
- **Dependencies**: BLOCKED by T2, T3
- **Acceptance**: Invokes T2 (execute) and T3 (verify) as sub-workflows per the documented wave order. Idempotent — re-running on a partially-complete milestone resumes from the last checkpoint.

### Task M61-D6-T5 — Workflows: integrate, debug, quick
- **Touches**: `templates/workflows/gsd-t-{integrate,debug,quick}.workflow.js`
- **Contract refs**: `verify-gate-contract.md`, `debug-loop-contract.md`
- **Dependencies**: BLOCKED by T1
- **Acceptance**: Each script implements its phase's pipeline. `gsd-t-debug` includes the up-to-2-fix-cycles policy. `gsd-t-quick` includes brief + preflight + verify-gate as M56-D4 requires.

### Task M61-D6-T6 — Workflows: upper-stage (partition, plan, discuss, impact, milestone, prd, design-decompose, doc-ripple)
- **Touches**: `templates/workflows/gsd-t-{partition,plan,discuss,impact,milestone,prd,design-decompose,doc-ripple}.workflow.js`
- **Contract refs**: `context-brief-contract.md` (M56-D2 kinds: partition/plan/discuss/impact/milestone)
- **Dependencies**: BLOCKED by T1
- **Acceptance**: Each thin pipeline: brief → primary agent → optional validation. Brief generation uses M56 kinds.

### Task M61-D6-T7 — Edit command files to invoke Workflows
- **Touches**: `commands/gsd-t-{execute,verify,wave,integrate,debug,quick,partition,plan,discuss,impact,milestone,prd}.md` (12 files)
- **Contract refs**: Each command's workflow analogue from T2-T6
- **Dependencies**: BLOCKED by T2, T3, T4, T5, T6
- **Acceptance**: Each command file's Step blocks become "invoke `templates/workflows/{name}.workflow.js` with args {…}". Prose-orchestrator + bash-block scaffolding removed. Preserves user-visible step labels.

### Task M61-D6-T8 — Reproduce M58 via Workflow (SC2)
- **Touches**: `.gsd-t/milestones/m61-platform-reconciliation-{date}/m58-reproduction-record.md` (new), no production-code edits
- **Contract refs**: All M58 contracts + the new Workflow scripts
- **Dependencies**: BLOCKED by T7
- **Acceptance**: Run M58 (test-data-cleanup-gate) end-to-end via the new Workflow scripts. Produces: identical adapter behavior, verify-gate green, Red Team finds the M60 fix is still in place (cannot regress empty-prefix bypass). Record the run output in the M61 archive.

## Execution Estimate
- Total tasks: 8
- Independent: 1 (T1)
- Blocked: 7
- Wave count within domain: 4 sub-waves (T1 → T2∥T3∥T5∥T6 → T4 → T7 → T8)

## Files Owned
- `templates/workflows/` (entire new directory)
- `commands/gsd-t-{execute,verify,wave,integrate,debug,quick,partition,plan,discuss,impact,milestone,prd}.md` (edits only — D7 owns the OBSERVABILITY block removal in Wave 2, D6 owns the Workflow-invocation rewrite in Wave 1; commits are sequenced)
