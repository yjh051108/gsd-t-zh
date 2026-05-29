# M65 Integration Points

Single-domain milestone — no cross-domain contracts, no consumer surfaces. This file records the **intra-domain task ordering** (driven by the inline-before-delete safety invariant) and the single execution wave.

## Dependency Graph

### Independent (can start immediately)
- T1 — inline `mapHeadlessExitCode` → delete `headless-exit-codes.cjs`
- T2 — inline 3 gating exports into `gsd-t-parallel.cjs` (config file NOT yet deleted)
- T4 — delete spawn-plan cluster + hooks
- T6 — clean `gsd-t-resume.md` dangling ref

### Ordering edges (safety invariant: never delete a file a survivor still requires)
- **T3 requires T2** — `gsd-t-parallel.cjs` (KEEP) must be inlined off `orchestrator-config.cjs` BEFORE T3 deletes that config file. `orchestrator.js:7` (the config's other requirer) is deleted in T3 itself, so post-T2+T3 nothing requires the config.
- **T5 requires T1–T4** — the 6 test files `require()` the now-deleted modules; deleting subjects first prevents transient MODULE_NOT_FOUND from masking real regressions.
- **T7 requires T1–T6** — doctor/LOC/retire-map gate runs after all deletions + cleanups.

## Wave Execution Groups

### Wave 1 — all of M65 (single wave, solo-sequential internal order)
- Order: T1, T2, T4, T6 (independent, any order) → T3 (after T2) → T5 (after T1–T4) → T7 (after all)
- **Shared files**: T1, T3, T4 all edit `bin/gsd-t.js` → MUST be sequential (not parallel) on that file. This is why M65 runs solo-sequential, not parallel — the single shared edit target is `bin/gsd-t.js` (PROJECT_BIN_TOOLS + dispatch + inline + help all live there).
- **KEEP files never touched** except the one surgical inline into `gsd-t-parallel.cjs` (T2).
- **Completes when**: T7 acceptance gate green (doctor clean, LOC delta recorded, retire-map updated, KEEP files resolve).

## Execution Order (solo mode)
1. T1 — inline mapHeadlessExitCode, delete headless-exit-codes.cjs, suite green
2. T2 — inline gating exports into gsd-t-parallel.cjs, suite green (config file still on disk)
3. T3 — delete orchestrator.js + worker + queue + config + remove orchestrate dispatch, suite green
4. T4 — delete spawn-plan cluster + hooks, suite green
5. T6 — clean gsd-t-resume.md
6. T5 — delete the 6 dependent test files, suite green (no MODULE_NOT_FOUND)
7. T7 — gsd-t doctor + LOC delta + retire→native map + KEEP-resolve confirmation

> Note: T1/T2/T4/T6 are independent and could be reordered; the listed order minimizes churn on `bin/gsd-t.js` by batching its edits and keeps a green suite after each step. T5 runs after T4 (its last subject) but is placed after T6 for a clean single test re-run near the end.

## Verify-gate parallel-readiness
`gsd-t parallel --dry-run` (the `_lib.proveFileDisjointness` probe) is the KEEP-file canary: it must run successfully BEFORE and AFTER the milestone, proving the T2 inline didn't break `gsd-t-parallel.cjs`.
