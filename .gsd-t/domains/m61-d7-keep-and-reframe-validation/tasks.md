# Tasks: m61-d7-keep-and-reframe-validation

## Summary
Write the orthogonal-validation contract; strip OBSERVABILITY blocks from 13 command files; reframe Red Team / QA / Design-Verify as Workflow stages; wire `/code-review ultra` into verify. Wave 2, parallel with D2-prep.

## Tasks

### Task M61-D7-T1 — Write orthogonal-validation contract
- **Touches**: `.gsd-t/contracts/orthogonal-validation-contract.md` (new)
- **Contract refs**: `verify-gate-contract.md`
- **Dependencies**: NONE
- **Acceptance**: Contract STABLE. Locks the rule: `/code-review ultra` = correctness + cleanup (cooperative); Red Team = adversarial / security / boundaries; QA = test execution + shallow-test detection + contract compliance. Future Claude collapsing any pair = contract violation. Includes worked examples of when each fires.

### Task M61-D7-T2 — De-wire OBSERVABILITY blocks from 13 command files
- **Touches**: `commands/gsd-t-{execute,verify,integrate,debug,wave,quick,plan,prd,design-decompose,doc-ripple,help,visualize,unattended}.md`
- **Contract refs**: NONE (this REMOVES dependency on retired contracts)
- **Dependencies**: NONE — file-disjoint from T1
- **Acceptance**: `grep -rn "captureSpawn\|recordSpawnRow\|autoSpawnHeadless\|gsd-t-token-capture" commands/*.md` returns zero hits. Each file's user-facing step structure preserved.

### Task M61-D7-T3 — Reframe Red Team / QA / Design-Verify protocols as Workflow stage invocations
- **Touches**: `templates/prompts/red-team-subagent.md`, `qa-subagent.md`, `design-verify-subagent.md` (protocol bodies KEPT; only the "spawned how" preamble updated)
- **Contract refs**: `orthogonal-validation-contract.md` (T1)
- **Dependencies**: BLOCKED by T1
- **Acceptance**: Each protocol's preamble updated to "When this protocol runs as a Workflow `agent()` stage with schema-validated output, …". Body (the actual instructions) unchanged. Brief-first rule preserved.

### Task M61-D7-T4 — Wire `/code-review ultra` into verify Workflow stage
- **Touches**: `templates/workflows/gsd-t-verify.workflow.js` (created by D6-T3 — D7-T4 EDITS it)
- **Contract refs**: `orthogonal-validation-contract.md`, `verify-gate-contract.md`
- **Dependencies**: BLOCKED by D6-T3 (the Workflow file must exist first), BLOCKED by T1 (contract must lock orthogonality first)
- **Acceptance**: Verify Workflow spawns `/code-review ultra` as a parallel stage alongside Red Team and QA. Output schemas distinct (cooperative findings vs. adversarial bugs vs. test-mechanics failures). Synthesis stage merges results without collapsing categories.

### Task M61-D7-T5 — Confirm KEEP list integrity
- **Touches**: writes `.gsd-t/scan/m61-d7-keep-list-verify.txt` only
- **Contract refs**: see KEEP list in `.gsd-t/domains/m61-d7-keep-and-reframe-validation/scope.md`
- **Dependencies**: NONE
- **Acceptance**: All KEEP-list files present and unchanged in this session except T3's protocol preamble updates. Output captured for the archive.

## Execution Estimate
- Total tasks: 5
- Independent: 3 (T1, T2, T5)
- Blocked: 2 (T3 by T1; T4 by T1 and D6-T3)

## Files Owned
- `.gsd-t/contracts/orthogonal-validation-contract.md` (exclusive)
- `commands/gsd-t-*.md` OBSERVABILITY block removals (in coordination with D6's Workflow-invocation rewrite — D6 lands first in Wave 1; D7 edits in Wave 2 are additive de-wires that don't conflict)
- `templates/prompts/*-subagent.md` preamble updates only
