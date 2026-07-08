# Tasks: d5-defaults-migration-pilot

## Summary
Delivers the two CLAUDE.md defaults rippled across all reference docs, the brownfield migration command proven on a throwaway fixture, and the UMI-Automation greenfield build-into pilot with both streams — all depending on the full machinery.

## Tasks

### Task 1 (Wave 3): Two CLAUDE.md hard rules + reference-doc ripple
- **Files**: `templates/CLAUDE-global.md`, `README.md`, `GSD-T-README.md`, `commands/gsd-t-help.md`
- **Contract refs**: `trace-logging-contract.md`, `audit-logging-contract.md`
- **Dependencies**: BLOCKED by d1/d2/d3/d4 (machinery must exist to reference)
- **Acceptance criteria**:
  - Two rules present + mirrored across all four docs (M100 acceptance #12); opt-out documented (#13).
  - Document Ripple Completion Gate: all four updated in one pass.

### Task 2 (Wave 3): Brownfield migration command on a throwaway fixture
- **Files**: `bin/gsd-t-migrate-logging.cjs`, `commands/gsd-t-migrate-logging.md`, `test/m100-d5-migration-fixture.test.js`, `.gsd-t/contracts/logging-schema-distillation-contract.md`
- **Contract refs**: `logging-scaffold-seam-contract.md`, `logging-schema-distillation-contract.md`
- **Dependencies**: BLOCKED by d1 Task 3 (dispatch case wired by d1)
- **Acceptance criteria**:
  - Migration proven ADDITIVE / non-destructive on a throwaway fixture (#10–11).
  - Dispatch delegated to d1 (d5 does not edit `bin/gsd-t.js`).
  - Distillation contract published + consumed by d2/d4 distillers.

### Task 3 (Wave 4): UMI-Automation greenfield build-into pilot
- **Files**: `/Users/david/projects/UMI-Automation/src/logging/trace.ts`, `/Users/david/projects/UMI-Automation/src/logging/audit.ts`, `/Users/david/projects/UMI-Automation/CLAUDE.md`, `/Users/david/projects/UMI-Automation/docs/infrastructure.md`
- **Contract refs**: `trace-logging-contract.md`, `audit-logging-contract.md`, `logging-schema-distillation-contract.md`, `logging-scaffold-seam-contract.md`
- **Dependencies**: BLOCKED by Task 1 + Task 2 + d2 + d4
- **Acceptance criteria**:
  - Trace points on Grain/Airtable/Anthropic/Apify REST calls; audit targets on PodCoach draft-approval — distilled from UMI's real plan (#14–15).
  - UMI has BOTH streams, passes d3's envelope gate for both, no-collapse; storage choice recorded in UMI CLAUDE.md.
  - No other project touched (#16).

## Execution Estimate
- Total tasks: 3
- Independent tasks: 0 (all blocked on machinery)
- Blocked tasks: 3 (Waves 3-4, sequenced)
- Estimated checkpoints: 2 (Wave-3 defaults+migration, Wave-4 pilot)
