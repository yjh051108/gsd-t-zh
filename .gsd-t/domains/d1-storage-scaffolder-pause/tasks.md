# Tasks: d1-storage-scaffolder-pause

## Summary
Delivers the stack-adaptive storage scaffolder that pauses for human approval, records the choice, resumes deterministically, and publishes the handoff seam — proven standalone in Wave 1 before any dependent work.

## Tasks

### Task 1: Wave-1 spike — pause + no-silent-pick with a fake scaffold
- **Files**: `bin/gsd-t-logging-scaffolder.cjs`, `test/m100-d1-storage-scaffolder-pause.test.js`
- **Contract refs**: `logging-scaffold-seam-contract.md`
- **Dependencies**: NONE
- **Acceptance criteria**:
  - Detects stack (has-DB → table; no-server/desktop → local store; SQLite-over-flat-file flagged for audit).
  - Presents real alternatives and STOPS for approval — proven it does NOT auto-pick (falsifier: a run that writes a backend with no recorded approval FAILS).
  - Records the chosen backend + `recordedAt` (M100 acceptance #1–2).

### Task 2: Deterministic resume + choice recording in project docs
- **Files**: `bin/gsd-t-logging-scaffolder.cjs`, `commands/gsd-t-init.md`, `test/m100-d1-storage-scaffolder-pause.test.js`
- **Contract refs**: `logging-scaffold-seam-contract.md`
- **Dependencies**: Requires Task 1
- **Acceptance criteria**:
  - On re-run with a recorded choice, does NOT re-prompt (deterministic resume).
  - Records backend in project CLAUDE.md / infrastructure doc.
  - `gsd-t-init` invokes the scaffolder as a scaffolding step.

### Task 3: Dispatch wiring + published seam
- **Files**: `bin/gsd-t.js`, `.gsd-t/contracts/logging-scaffold-seam-contract.md`
- **Contract refs**: `logging-scaffold-seam-contract.md`
- **Dependencies**: Requires Task 2
- **Acceptance criteria**:
  - `bin/gsd-t.js` init dispatch calls the scaffolder; the migration dispatch `case "migrate-logging"` is wired here on d5's behalf (d5 does NOT edit `bin/gsd-t.js`).
  - `scaffoldLogging(...)` returns the seam envelope (`backend`/`traceSink`/`auditSink`/`recordedAt`/`resumeToken`) d2/d4/d5 consume.
  - Seam contract published + referenced by consumers.

## Execution Estimate
- Total tasks: 3
- Independent tasks: 1 (Task 1)
- Blocked tasks: 0 (intra-domain sequence only)
- Estimated checkpoints: 1 (Wave-1 spike gate before dependents build)
