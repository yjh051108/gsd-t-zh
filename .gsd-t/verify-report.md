# Verification Report — 2026-05-29

## Milestone: M65 — Orchestration-Shell Retirement (M61 D6 port-then-delete completion)

## Summary
- Functional: PASS — pure deletion; both entry modules (`gsd-t.js`, `gsd-t-parallel.cjs`) load, `gsd-t orchestrate` → clean Unknown-command, `gsd-t parallel --dry-run` exit 0
- Contracts: PASS — wave-join gating math constants (85/60/4) + 5-code headless exit contract preserved verbatim in the two inlines
- Code Quality: PASS — Red Team byte-faithful-inline audit (25-case adversarial corpus → 100% parity); 3 LOW doc-debt findings only
- Unit Tests: WARN — 1361–1362 pass / 22–23 fail / 3 skip / 1387 total. **All failures pre-existing M61 D1–D8 carryover** (proven against parent commit `5a5c6c0^` = 1427 pass / 22 fail). Zero M65-caused. The 6 deleted test files (−66 cases) account for the count drop.
- E2E Tests: WARN — Playwright suite fails to COLLECT (`e2e/viewer/title.spec.ts:10` imports `scripts/gsd-t-dashboard-server.js`, deleted in M61 D4). **M61-D4 carryover** — M65 touched zero E2E files. ~18 orphaned viewer/journey specs import retired viewer infra.
- Test Data Cleanup: N/A — M65 ran no E2E suite (no UI), no `withTestData()` inserts
- Security: PASS — no auth/input/secret surface; pure CLI deletion
- Integration: PASS — KEEP-invariant holds (verify-gate.cjs:31→parallel-cli, _lib.js:107→gsd-t-parallel both resolve)

## Gate Results

| Gate | Result | M65-caused? |
|------|--------|-------------|
| M55 verify-gate Track 1 (preflight) | PASS | — |
| M55 verify-gate Track 2 (CLI fan-out) | **ok:false** — `tests` exit 1 + `playwright` exit 1 | **NO** — both inherited M61 carryover |
| M57 build-coverage | PASS (ok:true, exit 0, missing=[]) | — (M65 added zero new top-level paths) |
| M57 ci-parity | **ok:false** exit 4 — only failing cmd is `npm run test` | **NO** — same 23 carryover unit fails |
| M58 test-data purge | N/A — no E2E run | — |
| Orthogonal — `/code-review ultra` | SKIPPED (`skipUltraReason`: pure mechanical deletion + 2 verbatim inlines, exhaustively covered by Red Team + QA; no cooperative-review surface) | — |
| Orthogonal — Red Team (opus) | **GRUDGING PASS** — 0 CRITICAL/HIGH, 6 attack vectors + regression baseline exhausted | — |
| Orthogonal — QA (sonnet) | **PASS** — 0 M65-caused failures, delete-with-subject clean, contract compliance pass | — |

## Overall: VERIFIED-WITH-WARNINGS

M65's own work is clean and complete — Red Team GRUDGING PASS + QA PASS, both inlines byte-faithful, all KEEP files intact, zero new regressions (proven against the parent commit). The deterministic verify-gate / ci-parity reds are **100% inherited M61 D1–D8 carryover** that M65 neither caused nor was scoped to fix. Per measure-don't-claim, M65 is NOT marked clean-VERIFIED over the red baseline gates — the carryover is surfaced as blocking warnings owned by M61, not M65.

## Findings

### Critical (must fix before milestone complete)
_None for M65._

### Warnings (M61-carryover — not M65's to fix, but blocking a clean-green baseline)
1. **23 unit-test failures** — command-format tests (M56-D3/D4 marker blocks, Stack Rules blocks, preflight/verify-gate wire-in blocks), command-count tests (expect 55/49 vs actual 51/45), `test/m56-d5-stream-json-gap-closures.test.js` (requires deleted `gsd-t-capture-lint.cjs`). Origin: M61 D2/D8 removed command files + conventions but never updated these tests.
2. **~18 orphaned Playwright E2E specs** under `e2e/viewer/` + `e2e/journeys/` import `scripts/gsd-t-dashboard-server.js` (deleted M61 D4) — the whole suite fails to collect. Origin: M61 D4 retired the viewer/dashboard but left its E2E specs.
3. **`verifyPlaywrightHealth` / "npx playwright --version succeeds"** — intermittent (pass 20/0 in isolation; 5s timeout only under full-suite parallel subprocess contention). Pre-existing flake, not M65.

### Notes (LOW doc-debt, from Red Team)
1. `commands/gsd-t-help.md` `parallel` entry prose still says "wraps the M40 orchestrator" — historically inaccurate now (the gating math was inlined; feature works). Cosmetic.
2. `commands/gsd-t-resume.md` step-numbering gap 0.2→0.5 after removing dead Step 0.3 (0.4 was already absent pre-M65). LLM-read labels, no flow-control anchor references them.
3. `docs/requirements.md` historical REQ-M44-D2/D8 entries cite now-deleted files — completed-requirement records, not live pointers.

## Remediation Tasks
_None for M65._ The two blocking warnings are M61-carryover — flagged for a separate M61-carryover-cleanup milestone (delete orphaned viewer E2E specs + fix command-format/count tests). Not bundled into this orchestration-shell retirement (out of scope, different blast radius).
