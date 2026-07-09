# Tasks: d1-storage-scaffolder-pause

## Summary
Delivers the stack-adaptive storage scaffolder that PAUSES for human approval, records the choice, resumes deterministically, and publishes the handoff seam — proven standalone in Wave 1 (RISK-FIRST spike) before any dependent work. Sole M100 editor of `bin/gsd-t.js`.

## Wave
W1 — RISK-FIRST spike, runs CONCURRENTLY with d3. Highest-risk novel piece (the human-approval PAUSE). Must be green before W2 machinery (d2/d4) builds on the seam.

## Tasks

### M100-D1-T1: Wave-1 spike — pause + no-silent-pick with a fake/echo scaffold
- **Touches**: `bin/gsd-t-logging-scaffolder.cjs`, `test/m100-d1-storage-scaffolder-pause.test.js`
- **Files**: `bin/gsd-t-logging-scaffolder.cjs` (stack detection + alternative presentation + human-approval PAUSE + choice recording)
- **Contract refs**: `logging-scaffold-seam-contract.md`
- **Dependencies**: NONE (standalone Wave-1 spike)
- **Test**: `test/m100-d1-storage-scaffolder-pause.test.js` — **KILLING TEST (highest-risk piece)**: a call to `scaffoldLogging({...})` WITHOUT `approve` must NOT write any backend and must NOT return a `backend` value (it PAUSES with `status: "PAUSED"` + `alternatives[]`). A run that writes a backend with no recorded approval FAILS. Also asserts `detectStack()` maps has-DB→`db-table`, no-server/desktop→`local-sqlite`|`local-jsonl`, flags SQLite-over-flat-file for audit queryability.
- **ImplPath**: `scaffoldLogging()` probes stack (`package.json`, DB config presence), builds `alternatives[]`, returns `{ status:"PAUSED", alternatives, resumeToken }` when `approve` absent — never auto-selecting. On `approve`, records `{ backend, recordedAt }`.
- **Acceptance criteria**:
  - Detects stack (has-DB → table; no-server/desktop → local store; SQLite-over-flat-file flagged for audit) (M100 #1).
  - Presents real alternatives and STOPS for approval — proven it does NOT auto-pick (falsifier above) (M100 #1).
  - Records the chosen backend + `recordedAt` on approval (M100 #2).

### M100-D1-T2: Deterministic resume + choice recording in project docs
- **Touches**: `bin/gsd-t-logging-scaffolder.cjs`, `commands/gsd-t-init.md`, `test/m100-d1-storage-scaffolder-pause.test.js`
- **Files**: `bin/gsd-t-logging-scaffolder.cjs` (resume-token check + doc-record writer), `commands/gsd-t-init.md` (invoke step)
- **Contract refs**: `logging-scaffold-seam-contract.md`
- **Dependencies**: Requires M100-D1-T1
- **Test**: `test/m100-d1-storage-scaffolder-pause.test.js` — a second `scaffoldLogging()` call with a recorded choice returns the recorded backend WITHOUT re-prompting (no `status:"PAUSED"` on re-run); asserts the backend line lands in the fixture's `CLAUDE.md` / infrastructure doc.
  - **Corrupt/invalid-recorded-choice killing sub-cases (M100 pre-mortem FINDING 7, MEDIUM)**: (a) a CORRUPT or partial recorded-choice record (e.g. truncated JSON, missing `backend` field) → the scaffolder does NOT short-circuit to it; it re-enters PAUSE (`status:"PAUSED"` + `alternatives[]`) exactly as if nothing were recorded — never crashes, never silently proceeds with a bad value; (b) a `resumeToken` that matches NO recorded choice → returns PAUSE, never a stale or empty sink/backend value; (c) a recorded choice whose backend value is NOT one of the valid enum values (`db-table`/`local-sqlite`/`local-jsonl`) → treated as UNRECORDED and re-prompts (re-enters PAUSE) rather than trusting the invalid value through to the seam envelope.
- **ImplPath**: on entry, `scaffoldLogging()` reads the recorded choice keyed by `resumeToken`; if present, short-circuits to the recorded seam envelope. Writes the chosen backend into project `CLAUDE.md` / `docs/infrastructure.md`. The recorded-choice reader validates the record's shape AND the `backend` enum value before trusting it — a corrupt/partial record, an unmatched `resumeToken`, or an out-of-enum `backend` value are all treated as "no recorded choice" and fall through to `status:"PAUSED"`, never a crash and never a silent/stale pass-through.
- **Acceptance criteria**:
  - On re-run with a recorded choice, does NOT re-prompt (deterministic resume) (M100 #2).
  - Records backend in project CLAUDE.md / infrastructure doc.
  - `gsd-t-init` invokes the scaffolder as a scaffolding step.
  - Corrupt/partial recorded-choice → re-enters PAUSE, never crashes or silently proceeds.
  - Unmatched `resumeToken` → PAUSE, never a stale/empty sink.
  - Out-of-enum recorded backend value → treated as unrecorded, re-prompts.

### M100-D1-T3: Dispatch wiring + published seam (incl. d5's migrate-logging case)
- **Touches**: `bin/gsd-t.js`, `.gsd-t/contracts/logging-scaffold-seam-contract.md`
- **Files**: `bin/gsd-t.js` (init dispatch call + `case "migrate-logging"` on d5's behalf), `.gsd-t/contracts/logging-scaffold-seam-contract.md` (publish 1.0.0)
- **Contract refs**: `logging-scaffold-seam-contract.md`
- **Dependencies**: Requires M100-D1-T2
- **Test**: `test/m100-d1-storage-scaffolder-pause.test.js` — asserts `scaffoldLogging()` returns the full seam envelope (`backend` / `traceSink` / `auditSink` / `recordedAt` / `resumeToken`) with `auditSink.kind` QUERYABLE (SQLite, not flat file) on no-server; asserts `bin/gsd-t.js` has a `migrate-logging` dispatch case delegating to `bin/gsd-t-migrate-logging.cjs` (d5's module).
  - **Dispatch-halt-on-PAUSE killing sub-case (M100 pre-mortem FINDING, HIGH — capability built but the caller acting on it is never tested)**: an integration killing-test that drives the REAL init dispatch path in `bin/gsd-t.js` (not `scaffoldLogging` directly) with no recorded choice and asserts: (a) the init flow HALTS on `status:"PAUSED"` — it does NOT continue to write any trace/audit sink files; (b) no downstream module template is instantiated with an undefined/empty backend; (c) the process surfaces the `alternatives[]` to the user rather than consuming the paused envelope as a result. A dispatch that reads `backend:undefined` off the paused envelope and proceeds must FAIL this test.
- **ImplPath**: `bin/gsd-t.js` init path calls `scaffoldLogging()`; a `case "migrate-logging":` in the dispatch switch requires-and-invokes `gsd-t-migrate-logging.cjs` (d5 owns the module, d1 owns the wiring). The init dispatch explicitly checks the returned envelope's `status` field: on `status:"PAUSED"` it halts BEFORE any sink/template write and surfaces `alternatives[]` to the user; it only proceeds to write trace/audit sinks when `status` is absent/resolved with a valid `backend`.
- **Acceptance criteria**:
  - `bin/gsd-t.js` init dispatch calls the scaffolder; `case "migrate-logging"` wired here on d5's behalf (d5 does NOT edit `bin/gsd-t.js`).
  - `scaffoldLogging(...)` returns the seam envelope d2/d4/d5 consume.
  - Seam contract published (1.0.0) + referenced by consumers.
  - Init dispatch HALTS on `status:"PAUSED"` before any sink write, instantiates no template with an undefined/empty backend, and surfaces `alternatives[]` — proven by the dispatch-halt-on-PAUSE integration killing-test above.

## Execution Estimate
- Total tasks: 3
- Independent tasks: 1 (M100-D1-T1)
- Blocked tasks: 0 (intra-domain sequence only)
- Estimated checkpoints: 1 (Wave-1 spike gate before dependents build)
