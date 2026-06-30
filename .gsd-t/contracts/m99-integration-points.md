# M99 Integration Points — Graph Observability & Consolidation

> Wave groupings + cross-domain seams for M99. Planned 2026-06-30. 3 domains, 2 waves, RISK-FIRST (locked).
> Definition + 16 falsifiable criteria: `.gsd-t/progress.md` (M99). Pseudocode source-of-truth:
> `PseudoCode-GraphObservability.md` + `PseudoCode-GraphFolderMigration.md`.
> **RE-PLANNED 2026-06-30** after the M83 pre-mortem BLOCKED the prior plan (commit 3b5b33b) with 9
> falsifiable findings + the traceability gate flagged 16 violations. All 9 folded + all 16 resolved;
> both gates now pass (traceability `ok:true`, pre-mortem CLEARED). See § RE-PLAN fold-in below.

## RE-PLAN fold-in (the 9 pre-mortem findings — each now a required test)

| # | Sev | Finding | Fix + required test | Tasks |
|---|-----|---------|---------------------|-------|
| 1 | CRITICAL | D1-T4's rewire MISSED the PRIMARY cwd-walking store-discovery loop at query-cli `:107` (+ siblings `:229`/`:460`); post-migration it would still search the OLD `.gsd-t/graph.db` → graph-unavailable on every migrated project | rewire `:107`/`:229`/`:460` through the resolver + an END-TO-END `gsd-t graph who-imports` test via the discovery loop on a MIGRATED project (assert `outcome:'hit'`, same result set) | D1-T2 (test), D1-T4 (impl) |
| 2 | CRITICAL | no-raw-literals grep would false-fail on 2 SPIKE files writing `graph.db` to throwaway temp dirs (`k1-sqlite-stream.cjs:81`, `store-bakeoff.cjs:237`) — NOT the live store | marker-keyed (`spike-local-store`) filename allow-list; classified spike-local-not-live; allow-list can't silently expand (loses-marker = fail) | D1-T5 |
| 3 | HIGH | `:514`–`:516` is a TWO-branch ternary — the `.db` branch goes 3-up post-migration, the JSONL `graph-index/` branch STAYS 2-up; a one-size `deriveProjectRoot` breaks JSONL | branch-aware `deriveProjectRoot` + a JSONL-branch test (construct `.gsd-t/graph-index/`, assert TRUE root at 2-up) | D1-T1 (test), D1-T4 (impl) |
| 4 | HIGH | Criterion-11 byte-identical-on/off had NO fail-open-under-throw test | stub `append_ledger_line` to THROW with telemetry ON; assert grep/read decision + output byte-identical to OFF | D2-T1, D2-T2 |
| 5 | HIGH | rotation had no ROLLOVER-BOUNDARY test | `GSDT_GRAPH_TELEMETRY_MAXBYTES` test-only override drives a real rollover at a tiny cap; assert `-001` seals at/under cap, `-002` opens | D1-T3 |
| 6 | MED | no WAL-specific interruption test | write uncommitted edge into `-wal`, kill after copying `graph.db` before `-wal`, re-run; assert migrated result set equals pre-migration | D1-T2 |
| 7 | MED | contract cites `doMetrics` at `:5135` (the `case "metrics"` dispatch); the FUNCTION def is `:4697` | correct the ref + a line-ref-correctness test (grep `function doMetrics`, assert contract matches) | D3-T3 |
| 8 | MED | north-star contradiction (`fallback-announced` + same-window `outcome:'hit'`) was not machine-counted | rollup computes + reports `fallbackAnnouncedDespiteHit`; test asserts ≥1 on a contradiction fixture, 0 on a clean one | D3-T1 |
| 9 | MED | the M81 sandbox has NO `process`/`env`/`fs` → a workflow CANNOT `setenv GSDT_GRAPH_CONSUMER` the shell way | label passed as `--consumer <name>` ARG on the runCli ledger-write; intercept hooks resolve the consumer from the workflow context in their stdin payload (fallback `'cli'` only with no workflow context); test asserts in-workflow interception carries the label, not `'cli'` | D2-T3 |

**Traceability (the 16 violations):** every M99 task used `**Files (ImplPath):**` — the gate's
`FILES_FIELD_RE` (`/^\s*[-*]?\s*files?\s*:/i`) only matches a plain `Files:` label, so the `(ImplPath)`
between `files` and `:` defeated it (→ `hasFiles=false` → `ac-without-path`). Both headline tasks put
`⭐ Headline: true` in the heading suffix, not a standalone `**Headline:** true` field line (→
`headline=false`). FIX: renamed every `**Files (ImplPath):**`→`**Files:**`; added `**Headline:** true`
field lines to D1-T2 + D3-T1. Re-run: `ok:true`, 0/108 violations, both headlines recognized.

## Wave structure (LOCKED — risk-first)

| Wave | Domains | Concurrency | Gate |
|------|---------|-------------|------|
| **Wave 1** | `m99-d1-migration-resolver-sink` | runs **ALONE** (serial gate) | the ONLY irreversible / data-touching work (copy-verify-swap migration) — **MUST be proven in isolation BEFORE Wave 2 starts** |
| **Wave 2** | `m99-d2-layer2-decision-logging` ∥ `m99-d3-metrics-rollup` | parallel, **file-disjoint** | both IMPORT D1's resolver; start only after D1's resolver + migration shim land + are proven |

**Why D1 alone:** D1 owns every shared path-resolving file (the resolver + 5 producers + query-cli +
.gitignore + the ~20 path tests). Concentrating them in one owner means no other domain can open a file
that resolves a graph path → the M96-class silent split-brain cannot recur. The migration is the
milestone's only irreversible act (Destructive Action Guard, pre-approved for copy-verify-swap at define).

## The cross-domain seam — D1's resolver (the ONE import surface)

`bin/gsd-t-graph-store-resolver.cjs` (D1 WRITES; D2 + D3 IMPORT read-only). Contract:
`graph-store-resolver-contract.md` v1.0.0.

| Export | Who imports | For what |
|--------|-------------|----------|
| `resolveStorePath()` | D2 (both intercepts) | repoint presence-check + `Database(...)` open at the new `graphDB/graph.db` |
| `resolveLogsDir()` | D2 (workflows), D3 (rollup) | the `graphDB/logs/` sink dir |
| `append_ledger_line(record)` | D2 (intercepts + workflows) | the shared fail-open sink (Layer-2a/2b/2c writes) |
| `migrateGraphStore()` | D1 internal + CPUA `update-all` + first-touch self-heal | the copy-verify-swap shim |
| `deriveProjectRoot()` / `resolveGraphDir()` | D1 internal (query-cli depth fix) | 3-levels-up projectRoot correction |

**Invariant across the seam:** NO domain outside `gsd-t-graph-store-resolver.cjs` may contain a raw
`.gsd-t/graph.db` / `.gsd-t/graphDB/` literal. D2 and D3 are subject to D1's
`test/m99-resolver-no-raw-literals.test.js` grep proof (Criterion 4 — M96 split-brain guard).

## The ledger — shared write target, single reader

| Layer | Writer (domain) | Event `kind` | Reader |
|-------|-----------------|--------------|--------|
| Layer 1 — graph query | D1 (query-cli `_logGraphEvent` fold) | `query` | D3 rollup |
| Layer 2a — grep decision | D2 (`gsd-t-graph-intercept.js`) | `grep` | D3 rollup |
| Layer 2b — read decision | D2 (`gsd-t-read-intercept.js`) | `read` | D3 rollup |
| Layer 2c — wiring mode | D2 (6 workflows) | `wiring` | D3 rollup + scan-header stamp |

All four families share `graphDB/logs/graph-events-NNN.jsonl`; `kind` disambiguates. Schema +
rollup shape: `graph-metrics-contract.md` (D3-owned). **D3 reconciles the documented key set against
the keys D1/D2 actually emit at integrate** (Criterion 15 / `[RULE] contract-matches-emitted-keys`).

## File-ownership disjointness (inter-domain: ZERO overlap)

| Domain | Owned files (count) | Touches `bin/gsd-t.js`? | Touches resolver? |
|--------|--------------------|--------------------------|--------------------|
| D1 | 11 (resolver + 5 producers/query-cli + .gitignore + 4 tests) | NO | WRITES it |
| D2 | 10 (2 intercepts + 6 workflows + 2 tests) | NO | IMPORTS it |
| D3 | 4 (gsd-t.js arm + rollup + contract + 1 test) | YES (sole editor, append-only arm) | IMPORTS it |

Inter-domain owned-set overlap = **zero** (verified at partition: D1=11, D2=10, D3=3 owned, no file
owned by >1 domain). `gsd-t parallel --dry-run` reporting `disjoint?=no` flags INTRA-domain task-to-task
file sharing (e.g. D1-T1..T5 all touch the resolver — expected same-owner sequential, `decision=sequential`),
NOT an inter-domain conflict. Only inter-domain owned-set overlap is a real conflict; it is zero.

## Integration order (within Wave 2)

D2 and D3 are file-disjoint and may land in either order, BUT D3's contract-finalize (T3) must reconcile
against the actual emitted keys from BOTH D1 (Layer-1) and D2 (Layer-2a/2b/2c) — so D3-T3 runs LAST at
integrate, after D2's emitters exist. The rollup (D3-T1) can be built against the contract schema in
parallel with D2; only the final key-set reconciliation waits.

## Verify-phase probes (Red Team / pre-mortem focus)

- **Migration destructive path** (Criteria 2/3): interruption-safety (old-OR-new-never-neither),
  WAL-pending survival (#6: kill after `graph.db` before `-wal`), idempotency, real-root-only guard.
  Destructive Action Guard pre-approved.
- **End-to-end discovery loop** (#1, Criteria 1/2/13 — THE killer): after migration, an ACTUAL
  `gsd-t graph who-imports` via the cwd-walking `:107` discovery loop on a migrated project returns
  `outcome:'hit'` with the same result set as pre-migration — FAILS if the loop still searches the legacy path.
- **Fail-open invariant** (Criteria 8/11): a ledger write that throws NEVER blocks/alters a grep, read,
  or query; byte-identical decision + output with `GSDT_GRAPH_TELEMETRY` on vs off AND on-throw (#4).
- **Rollover boundary** (#5, Criterion 7): a real rollover at a tiny `GSDT_GRAPH_TELEMETRY_MAXBYTES` cap.
- **JSONL-branch depth** (#3, Criterion 6): branch-aware `deriveProjectRoot` — `.db` 3-up, `graph-index/` 2-up.
- **Consumer label from context** (#9, Criterion 12): an interception inside a labeled workflow carries
  that label (via `--consumer` arg / hook payload), never `'cli'`-leaks.
- **Silent-disable regression** (Criterion 13 north-star): both intercepts repointed at the resolver so
  they don't disable post-migration; a `fallback-announced` beside a live `outcome:hit` is machine-visible
  AND counted by the rollup's `fallbackAnnouncedDespiteHit` (#8).
