# Logging Scaffold-Seam Contract

**Version:** 1.0.0 STABLE (published — M100-D1-T3)
**Owner:** d1-storage-scaffolder-pause
**Consumers:** d2-trace-machinery, d4-audit-machinery, d5-defaults-migration-pilot
**Milestone:** M100 — Universal Trace + Audit Logging (framework defaults).

---

## Purpose

Fixes the **handoff seam** between the stack-adaptive storage SCAFFOLDER (d1) and the trace/audit MODULE machinery (d2/d4) + the migration/pilot wiring (d5). d1 owns the sole init-scaffold seam and the single `bin/gsd-t.js` hot-spot edit; every downstream domain consumes this seam and NEVER co-edits the scaffolder or the dispatch file.

## The seam: what d1 produces

`bin/gsd-t-logging-scaffolder.cjs` exposes a single stable entry the machinery + migration consume:

```
scaffoldLogging({ projectDir, stack, approve }) -> {
  backend: "db-table" | "local-sqlite" | "local-jsonl",   // the RECORDED chosen backend
  traceSink: { kind, path|table },                          // where trace writes
  auditSink: { kind, path|table },                          // where audit writes (queryable required)
  recordedAt: string (ISO-8601),                            // when the human approved
  resumeToken: string                                       // deterministic re-run key
}
```

- **Detect** the stack (has-DB → table; no-server/desktop → local store; SQLite-over-flat-file flagged for audit queryability).
- **Present** real alternatives and **PAUSE** for human approval — NEVER silently pick. This is the ONE sanctioned pause against the Level-3 full-auto default.
- **Record** the chosen backend in the project's `CLAUDE.md` / infrastructure doc.
- **Resume deterministically** on re-run: if a recorded choice exists, do NOT re-prompt.

## What the seam guarantees to consumers

| Guarantee | Consumer relies on it for |
|-----------|---------------------------|
| `backend` is one of the fixed enum values | d2/d4 module templates select the matching transport |
| `auditSink` is QUERYABLE (SQLite, not flat file, on no-server) | d4 admin query surface (audit-logging-contract §Admin query surface) |
| `recordedAt` present ⇒ approval happened | verify `storage-approval-paused` [RULE] |
| `resumeToken` stable across re-runs | deterministic resume (no re-prompt) |

## Ownership boundary (mechanizes no co-edit of the hot spot)

- d1 is the SOLE editor of `bin/gsd-t.js` for M100 (init dispatch + any new dispatch case).
- d5's migration command dispatch case is DELEGATED to d1 via this seam — d5 ships `bin/gsd-t-migrate-logging.cjs` + `commands/gsd-t-migrate-logging.md` but does NOT edit `bin/gsd-t.js`; d1 wires the `case "migrate-logging"` dispatch on d5's behalf.

## Consumed contracts

- [`trace-logging-contract.md`](trace-logging-contract.md) — the trace envelope the trace sink carries.
- [`audit-logging-contract.md`](audit-logging-contract.md) — the audit envelope + queryable requirement the audit sink honors.
