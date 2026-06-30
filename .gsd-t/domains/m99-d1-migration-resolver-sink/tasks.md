# Tasks: m99-d1-migration-resolver-sink

> **Wave 1 — SERIAL GATE.** Runs ALONE. The migration shim MUST be proven in isolation BEFORE
> Wave 2 (D2/D3) starts. Owns every shared path-resolving file so nothing else can run beside it.
> Contract: [`graph-store-resolver-contract.md`](../../contracts/graph-store-resolver-contract.md) v1.0.0.
> Intra-domain note: T1–T5 all touch `bin/gsd-t-graph-store-resolver.cjs` / consumers — `gsd-t parallel`
> reports `disjoint?=no` for them, which is EXPECTED same-owner sequential (`decision=sequential`), not a
> real conflict. Only inter-DOMAIN owned-set overlap matters; that is zero.

## Files Owned
- bin/gsd-t-graph-store-resolver.cjs
- bin/gsd-t-graph-query-cli.cjs
- bin/gsd-t-graph-index.cjs
- bin/gsd-t-graph-freshness.cjs
- bin/gsd-t-graph-k1-sqlite-stream.cjs
- bin/gsd-t-graph-store-bakeoff.cjs
- .gitignore
- test/m99-graph-migration.test.js
- test/m99-graph-telemetry.test.js
- test/m99-graph-rotation.test.js
- test/m99-resolver-no-raw-literals.test.js

> **SPIKE-LOCAL classification (pre-mortem #2):** `gsd-t-graph-k1-sqlite-stream.cjs:81` and
> `gsd-t-graph-store-bakeoff.cjs:237` write a bare `graph.db` into a `mkdtemp`/passed-in THROWAWAY
> bench dir — NOT the live `.gsd-t/` store. They are **spike-local-not-live**: the no-raw-literals
> grep (T5) ALLOW-LISTS these two by filename + a `// spike-local-store: throwaway bench dir` comment
> marker. T5 still ROUTES them through the resolver where it makes the bench cleaner, but their survival
> is NOT a split-brain violation.

---

### M99-D1-T1 — the single resolver module
**What:** Create `bin/gsd-t-graph-store-resolver.cjs` exporting `resolveGraphDir(projectRoot?)`,
`resolveStorePath(projectRoot?)`, `resolveLogsDir(projectRoot?)`, `deriveProjectRoot(storePath)`.
The new store lives at `.gsd-t/graphDB/graph.db` → `deriveProjectRoot` is **3 levels up** (`graphDB/`
adds one level vs. the old `.gsd-t/graph.db` 2-levels-up), depth-corrected atomically with the move.
**Files:** `bin/gsd-t-graph-store-resolver.cjs` (NEW) — `resolveGraphDir`/`resolveStorePath`/`resolveLogsDir`/`deriveProjectRoot`.
**Touches:** bin/gsd-t-graph-store-resolver.cjs
**Contract:** graph-store-resolver-contract.md § Exported surface (rows 1–4).
**Depends on:** —
**Test:** `test/m99-resolver-no-raw-literals.test.js` — asserts the four exports exist and that
`deriveProjectRoot(resolveStorePath(root)) === root` for the **.db store branch** (round-trip proves the
3-levels-up depth), AND drives the **JSONL `graph-index/` branch** (construct `.gsd-t/graph-index/` with no
`graphDB/graph.db`, assert `deriveProjectRoot` returns the TRUE root at 2-up — pre-mortem #3: the two
branches have DIFFERENT depths post-migration, so a single one-size deriveProjectRoot must NOT break JSONL).
**AC:** Criterion 4 (single resolver exists), Criterion 1 (graphDB/ layout), Criterion 6 (JSONL-branch depth). `[RULE] one-resolver-only`, `[RULE] projectroot-depth-corrected-with-move`, `[RULE] jsonl-branch-depth-preserved`.

### M99-D1-T2 — copy-verify-swap migration shim
**Headline:** true
**What:** Add `migrateGraphStore(projectRoot?)` to the resolver: copy → verify → swap. (1) WAL-checkpoint
the SQLite write-ahead log before copy **OR** copy `graph.db`+`-wal`+`-shm` together (WAL mode CONFIRMED:
`gsd-t-graph-index.cjs:141` `journal_mode=WAL`). (2) Idempotent — second run is a no-op once `graphDB/`
holds a readable store. (3) Interruption-safe — at every step an old-OR-new readable graph exists, NEVER
neither (old retained until new is verified-readable, then swapped). (4) Real-root-only guard — refuses to
run inside an `mkdtemp`/throwaway dir (the M94 fake-root OOM lesson: guard root === home / root === '/').
(5) Fires automatically on first graph touch (self-heal) AND during CPUA `gsd-t update-all`.
**Files:** `bin/gsd-t-graph-store-resolver.cjs` — `migrateGraphStore()` + the first-touch
self-heal call site (wired into `resolveStorePath`/the query-cli store-open path in T4).
**Touches:** bin/gsd-t-graph-store-resolver.cjs
**Contract:** graph-store-resolver-contract.md § Exported surface (row `migrateGraphStore`) + § Invariants (never-orphan).
**Depends on:** M99-D1-T1.
**Test:** `test/m99-graph-migration.test.js` — builds a graph at the legacy `.gsd-t/graph.db` (+`-wal`/`-shm`)
in a real temp **project root** (NOT relocated by the real-root guard's allow-list — uses an explicit
`projectRoot` arg so the test opts in), runs the shim, asserts:
(a) `graphDB/graph.db` answers IDENTICALLY to a pre-migration control copy (same `who-imports` result set);
(b) **END-TO-END headline proof (pre-mortem #1):** after `migrateGraphStore`, run an ACTUAL
`gsd-t graph who-imports <known-symbol>` query against the migrated project **via the cwd-walking
discovery loop** (NOT a direct `loadStore` of an explicit path) and assert `outcome:'hit'` with the SAME
result set as pre-migration — this exercises the `:107` store-discovery loop end-to-end and FAILS if the
loop still searches the legacy `.gsd-t/graph.db`;
(c) **WAL-interruption (pre-mortem #6):** write an uncommitted edge into `-wal` (NOT checkpointed), simulate
a kill AFTER copying `graph.db` but BEFORE `-wal`, re-run the shim, assert the migrated graph's result set
EQUALS pre-migration (the `-wal`-pending edge survives);
(d) second run = `{migrated:false}` no-op;
(e) kill-mid-migration simulation (throw between copy and swap) leaves a readable graph (old), re-run completes.
**AC:** Criteria 1 + 2 + 3 + 13 (the milestone's irreversible data-touching work AND the end-to-end
discovery-loop proof — THE headline). `[RULE] copy-verify-swap-never-orphan`, `[RULE] migration-real-root-only`, `[RULE] discovery-loop-end-to-end`. Destructive Action Guard: pre-approved at M99 define for this exact copy-verify-swap shape.

### M99-D1-T3 — shared append_ledger_line sink (Layer-1 substrate)
**What:** Add `append_ledger_line(record)` to the resolver: fail-open append to
`graphDB/logs/graph-events-NNN.jsonl`; honors `GSDT_GRAPH_TELEMETRY` (default **ON**, `"0"`→OFF writes
zero lines); sized rotation backstop at **50 MB OR 250,000 entries** (`-001`→`-002`…) — a runaway
backstop, NOT routine rotation (a full on-flag analysis session lands in ONE file). A throw inside the
sink is swallowed (best-effort) and NEVER propagates to the caller. **Test-only threshold override
(pre-mortem #5):** read `GSDT_GRAPH_TELEMETRY_MAXBYTES` (and `..._MAXENTRIES`) env overrides for the
rollover cap so a test can drive a REAL rollover at a tiny cap without writing 50 MB — production default
is unchanged when the env var is absent.
**Files:** `bin/gsd-t-graph-store-resolver.cjs` — `append_ledger_line()` + the rotation helper + the
`GSDT_GRAPH_TELEMETRY_MAXBYTES`/`..._MAXENTRIES` override read.
**Touches:** bin/gsd-t-graph-store-resolver.cjs
**Contract:** graph-store-resolver-contract.md § `append_ledger_line` + graph-metrics-contract.md § Sink/rotation/toggle.
**Depends on:** M99-D1-T1.
**Test:** `test/m99-graph-rotation.test.js` — **ROLLOVER-BOUNDARY proof (pre-mortem #5):** set
`GSDT_GRAPH_TELEMETRY_MAXBYTES` to a tiny cap (e.g. 1 KB), write entries PAST the cap, assert `-001` seals
at/under the cap and `-002` opens for the overflow (a real rollover at a boundary, not a mocked counter) +
`test/m99-graph-telemetry.test.js` (toggle OFF ⇒ zero lines written; a thrown fs error inside the sink
does NOT propagate — fail-open).
**AC:** Criteria 6 (sink path), 7 (sized rotation, rollover-boundary proven), 8 (toggle + fail-open), 14 (override is test-only, production default intact). `[RULE] fail-open-telemetry`, `[RULE] layer1-shape-kept`, `[RULE] rollover-boundary-proven`.

### M99-D1-T4 — fold Layer-1 + projectRoot-depth fix into query-cli
**What:** In `bin/gsd-t-graph-query-cli.cjs`:
(1) **STORE-DISCOVERY REWIRE (pre-mortem #1 — THE KILLER):** route ALL store-resolution sites through the
resolver, NOT just the `resolveStorePath` function shell at `:95`. The PRIMARY discovery path is the
**cwd-walking loop at `:107`** (`path.join(dir, ".gsd-t", "graph.db")`) — the ACTUAL resolver in practice;
after migration to `.gsd-t/graphDB/graph.db` it would still search the OLD legacy path → graph-unavailable
on EVERY migrated project (the NiceNote-class invisible fallback this milestone exists to prevent). ALSO
rewire the sibling fallbacks at **`:229`** (`path.join(path.dirname(storePath), "graph.db")`) and **`:460`**
(`loadSqliteStore(path.join(path.dirname(storePath), "graph.db"))`). Replace the function body at `:95` so
the whole cwd-walk resolves via `resolveStorePath`/`resolveGraphDir`; the loop, `:229`, `:460` all resolve
through the single resolver (which itself knows the legacy→graphDB self-heal via T2's `migrateGraphStore`).
(2) **projectRoot depth fix at `:514`–`:516`, `:1246`, `:1354`** — route through `deriveProjectRoot`. NOTE
(pre-mortem #3): `:514`–`:516` is a TWO-BRANCH ternary — the `.db` branch (`storePath.endsWith(".db")`)
becomes **3-up** after the `graphDB/` move, but the JSONL `.gsd-t/graph-index/` branch STAYS **2-up**.
`deriveProjectRoot` MUST be branch-aware (key off `.db` vs `graph-index`), NOT one-size — a one-size depth
breaks the JSONL branch (covered by T1's JSONL-branch test).
(3) move the `_logGraphEvent` sink (`:1241`/`:1278`) from `.gsd-t/metrics/` to `graphDB/logs/` via
`resolveLogsDir` + `append_ledger_line`. KEEP the Layer-1 record SHAPE and the fail-open invariant
byte-for-byte (KEPT, no Divergence — only the sink path + rotation/toggle is the supersede).
**Files:** `bin/gsd-t-graph-query-cli.cjs` — `:95` (resolver import), `:107` (cwd-walk discovery loop),
`:229` + `:460` (sibling fallbacks), `:514`–`:516`/`:1246`/`:1354` (branch-aware depth fix), `:1241`–`:1278` (sink fold).
**Touches:** bin/gsd-t-graph-query-cli.cjs
**Contract:** graph-store-resolver-contract.md § Invariants (depth-corrected, fail-open, single-discovery-path) + graph-metrics-contract.md § Layer-1 schema (shape KEPT).
**Depends on:** M99-D1-T1, T2, T3.
**Test:** `test/m99-graph-migration.test.js` (the end-to-end `who-imports` via the `:107` discovery loop on a
migrated project — see T2 test (b)) + `test/m99-graph-telemetry.test.js` — Layer-1 events land at
`graphDB/logs/graph-events-NNN.jsonl` (NOT `.gsd-t/metrics/`), record shape unchanged
(verb/target/outcome/tier/resultCount/latencyMs/consumer/via + freshness fields present), query result
byte-identical with telemetry on vs. off.
**AC:** Criteria 1 (discovery loop finds graphDB/), 2 (migrated project queries hit), 6 (sink moved), 8 (byte-identical on/off), Criterion 4 (no surviving `:95`/`:107`/`:229`/`:460` raw literal), 13 (no invisible fallback). `[RULE] projectroot-depth-corrected-with-move`, `[RULE] jsonl-branch-depth-preserved`, `[RULE] discovery-loop-end-to-end`, `[RULE] layer1-shape-kept`.

### M99-D1-T5 — route producer-side literals through the resolver
**What:** Replace the raw store-path literals in the producer files with `resolveStorePath`/`resolveGraphDir`:
`gsd-t-graph-index.cjs:392` + `:525`, `gsd-t-graph-freshness.cjs:130`. The two SPIKE files
(`gsd-t-graph-k1-sqlite-stream.cjs:81`, `gsd-t-graph-store-bakeoff.cjs:237`) write a bare `graph.db` into a
THROWAWAY `mkdtemp`/passed-in bench dir, NOT the live store — they are **spike-local-not-live** (pre-mortem
#2): add a `// spike-local-store: throwaway bench dir` comment marker on each and ALLOW-LIST them in the
no-raw-literals test by filename keyed on that marker. After this, ZERO raw `.gsd-t/graph.db` literals
survive in `bin/`/`scripts/` outside the resolver + the migration shim's explicit legacy-path constant +
the 2 marked spike-local bench literals.
**Files:** `bin/gsd-t-graph-index.cjs` (`:392`,`:525`), `bin/gsd-t-graph-freshness.cjs` (`:130`); marker-only edits to `bin/gsd-t-graph-k1-sqlite-stream.cjs` (`:81`), `bin/gsd-t-graph-store-bakeoff.cjs` (`:237`).
**Touches:** bin/gsd-t-graph-index.cjs, bin/gsd-t-graph-freshness.cjs, bin/gsd-t-graph-k1-sqlite-stream.cjs, bin/gsd-t-graph-store-bakeoff.cjs
**Contract:** graph-store-resolver-contract.md § Invariants (path single-source).
**Depends on:** M99-D1-T1.
**Test:** `test/m99-resolver-no-raw-literals.test.js` — greps `bin/` + `scripts/` for `\.gsd-t/graph\.db`
and bare `graph\.db` literals; PASS only when the sole survivors are inside `gsd-t-graph-store-resolver.cjs`
(resolver + migration-shim legacy constant) AND the explicit 2-file spike allow-list
(`gsd-t-graph-k1-sqlite-stream.cjs`, `gsd-t-graph-store-bakeoff.cjs`, each carrying the
`spike-local-store` marker). FAILS on any surviving NON-allow-listed producer/reader literal, AND fails if
an allow-listed file LOSES its marker (so the allow-list can't silently expand).
**AC:** Criteria 4 (zero raw literals outside resolver + marked spikes — M96 split-brain guard), 5 (spike-local classified, not false-failed). `[RULE] one-resolver-only`, `[RULE] spike-local-allowlisted`.

### M99-D1-T6 — retarget .gitignore at graphDB/
**What:** Retarget the generated-store ignore lines (currently `.gsd-t/graph.db`/`-wal`/`-shm` +
`.gsd-t/metrics/graph-events.jsonl`) to `.gsd-t/graphDB/` (db + sidecars + scip indexes + `logs/`).
**Files:** `.gitignore` — the graph-store + telemetry ignore block.
**Touches:** .gitignore
**Contract:** — (build-output hygiene; supports Criterion 1).
**Depends on:** M99-D1-T1.
**Test:** `test/m99-graph-migration.test.js` (shared) asserts a post-build `git status --porcelain`
shows no `graphDB/` artifact tracked (ignore covers the new layout). Lightweight grep-assert on `.gitignore` content.
**AC:** Criterion 1 (all artifacts under graphDB/, none leaking into git).

### M99-D1-T7 — update the ~20 hardcoded-path tests + author the 4 owned tests
**What:** Update the 20 test files that hardcode `graph.db` to route through the resolver / assert the new
`graphDB/graph.db` live path (none may still assert `.gsd-t/graph.db` as the LIVE path). Confirm NO fixture
builds a graph at a path the shim would itself relocate (the shim's real-root guard + explicit-`projectRoot`
opt-in already prevents this — verify, document the zero co-location). Author the 4 owned test files
(migration, telemetry, rotation, no-raw-literals) referenced by T2–T5.
**Files:** the 20 existing `test/*graph*.test.js` (route through resolver) + the 4 NEW owned test files: `test/m99-graph-migration.test.js`, `test/m99-graph-telemetry.test.js`, `test/m99-graph-rotation.test.js`, `test/m99-resolver-no-raw-literals.test.js`.
**Touches:** test/m99-graph-migration.test.js, test/m99-graph-telemetry.test.js, test/m99-graph-rotation.test.js, test/m99-resolver-no-raw-literals.test.js
**Contract:** graph-store-resolver-contract.md § Invariants (never inside mkdtemp fixtures).
**Depends on:** M99-D1-T1..T6.
**Test:** the full graph test suite green via `npm test` and the heavy subset via
`--test-concurrency=1 GSDT_SLOW_TESTS=1` (per `feedback_slow_tests_starve_workflow_watchdog`).
**AC:** Criterion 5 (all ~20 path tests pass against new layout; no fixture×shim co-location), Criterion 16 (suite green).
