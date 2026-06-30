# Integration Points

## Current State: M99 — Graph-Store Migration + Layer-1/2 Decision Telemetry + Metrics Rollup — RE-PLANNED 2026-06-30 (pre-mortem RE-RUN). The prior plan (commit 3b5b33b) was BLOCKED by the M83 pre-mortem with 9 falsifiable failure conditions lacking a required test + the traceability gate flagged 16 violations (all M99 tasks used `**Files (ImplPath):**` — the gate's `FILES_FIELD_RE` only matches a plain `Files:` label, so `(ImplPath)` between `files` and `:` defeated it; both headline tasks put `⭐ Headline: true` in the heading suffix instead of a standalone `**Headline:** true` field line). **THIS RE-PLAN folds all 9 pre-mortem findings into the 3 tasks.md + resolves all 16 traceability violations** (renamed every `**Files (ImplPath):**`→`**Files:**`; added standalone `**Headline:** true` field lines to D1-T2 + D3-T1). Both gates now pass: traceability `ok:true` (0/108 violations) + pre-mortem CLEARED. **The 9 folded findings:** #1 CRITICAL (the killer) — D1-T4's query-cli rewire MISSED the PRIMARY cwd-walking store-discovery loop at `:107` (+ sibling fallbacks `:229`/`:460`); after migration to `.gsd-t/graphDB/graph.db` it would still search the OLD `.gsd-t/graph.db` → graph-unavailable on every migrated project (NiceNote-class invisible fallback). FIX: extend the rewire list + a REQUIRED end-to-end `who-imports`-via-discovery-loop test on a migrated project (D1-T2 test (b) / D1-T4). #2 CRITICAL — no-raw-literals grep would false-fail on 2 SPIKE files writing to throwaway temp dirs (`gsd-t-graph-k1-sqlite-stream.cjs:81`, `gsd-t-graph-store-bakeoff.cjs:237`); FIX: explicit marker-keyed allow-list (D1-T5). #3 HIGH — `:514`–`:516` is a TWO-branch ternary; the `.db` branch goes 3-up post-migration but the JSONL `graph-index/` branch stays 2-up — a one-size `deriveProjectRoot` breaks JSONL; FIX: branch-aware depth + a JSONL-branch test (D1-T1/T4). #4 HIGH — Criterion-11 byte-identical had no FAIL-OPEN test; FIX: stub `append_ledger_line` to THROW, assert decision + output byte-identical to telemetry-OFF (D2-T1/T2). #5 HIGH — rotation had no ROLLOVER-BOUNDARY test; FIX: `GSDT_GRAPH_TELEMETRY_MAXBYTES` test-only override drives a real rollover at a tiny cap (D1-T3). #6 MED — no WAL-specific interruption test; FIX: kill after copying `graph.db` before `-wal`, assert migrated result set equals pre-migration (D1-T2 test (c)). #7 MED — contract cites `doMetrics` at `:5135` (the dispatch); the FUNCTION def is `:4697`; FIX: correct the ref + a line-ref-correctness test (D3-T3). #8 MED — north-star: a `fallback-announced` wiring line co-occurring with a same-window Layer-1 `outcome:'hit'` is the machine-visible contradiction; FIX: rollup computes + reports `fallbackAnnouncedDespiteHit` (D3-T1). #9 MED — the M81 sandbox has NO `process`/`env`/`fs`, so a workflow CANNOT `setenv GSDT_GRAPH_CONSUMER` the shell way; FIX: label passed as a `--consumer <name>` ARG on the runCli ledger-write + intercept hooks resolve the consumer from the workflow context in their stdin payload (fallback `'cli'` only when no workflow context); a test asserts an interception inside a labeled workflow carries that label, not `'cli'` (D2-T3). Structure UNCHANGED: **3 file-disjoint domains, 2 waves** (D1 Wave-1 serial gate; D2∥D3 Wave-2).

### M99 Wave Groupings (the integration shape)

```
WAVE 1 — SERIAL GATE (runs ALONE; the migration shim proven in isolation before Wave 2 starts).
         D1 owns EVERY shared path-resolving file so nothing else runs beside it.
  d1 migration-resolver-sink  (bin/gsd-t-graph-store-resolver.cjs + query-cli + producers + .gitignore + 4 tests)
    M99-D1-T1 single resolver module (resolveGraphDir/StorePath/LogsDir/deriveProjectRoot;
                .db branch 3-up, JSONL graph-index/ branch 2-up — BRANCH-AWARE #3)
    M99-D1-T2 copy-verify-swap migration shim  [Headline] — copy→verify→swap, WAL-safe, idempotent,
                interruption-safe, real-root-only guard. TEST: end-to-end who-imports via the :107
                discovery loop on a MIGRATED project (#1) + WAL-pending-edge survival (#6).
    M99-D1-T3 append_ledger_line sink — fail-open, GSDT_GRAPH_TELEMETRY toggle, sized rotation backstop;
                GSDT_GRAPH_TELEMETRY_MAXBYTES test-only override → real rollover-boundary test (#5).
    M99-D1-T4 fold Layer-1 + projectRoot-depth into query-cli — REWIRE :95 + :107 (cwd-walk discovery
                loop, THE KILLER #1) + :229/:460 (sibling fallbacks) + branch-aware depth :514-516/:1246/:1354 (#3)
                + move _logGraphEvent sink :1241/:1278 → graphDB/logs/ (Layer-1 shape KEPT byte-for-byte).
    M99-D1-T5 route producer literals through resolver — index.cjs:392/:525, freshness.cjs:130;
                2 SPIKE files (k1-sqlite-stream:81, store-bakeoff:237) marker-keyed ALLOW-LISTED, spike-local-not-live (#2).
    M99-D1-T6 retarget .gitignore at graphDB/
    M99-D1-T7 update ~20 hardcoded-path tests + author the 4 owned tests
       │  delivers: graph-store-resolver-contract.md (resolveGraphDir/StorePath/LogsDir/deriveProjectRoot
       │            + migrateGraphStore + append_ledger_line; single-discovery-path + never-orphan invariants)
       ▼
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │ WAVE-1 GATE: the migration shim is proven (D1-T2 headline test green: end-to-end │
  │ who-imports via the :107 discovery loop on a migrated project + WAL survival),   │
  │ the resolver is the SOLE path source (D1-T5 no-raw-literals green minus the 2    │
  │ marked spikes), depth branch-aware (D1-T1 JSONL-branch test green). Wave 2 waits.│
  │ [RULE] discovery-loop-end-to-end  [RULE] copy-verify-swap-never-orphan           │
  └──────────────────────────────────────────────────────────────────────────────┘
       │
WAVE 2 — BUILD (D2 ∥ D3, fully file-disjoint; both IMPORT D1's resolver, never hardcode a path):
       ▼
  d2 layer2-decision-logging                    ║  d3 metrics-rollup (READER + sole contract owner)
    M99-D2-T1 grep-intercept repoint + Layer-2a     M99-D3-T1 read-only rollup helper [Headline] — 8
                logging (incl. passthrough);                    dimensions + fallbackAnnouncedDespiteHit
                FAIL-OPEN-on-throw test (#4)                    north-star contradiction count (#8);
    M99-D2-T2 read-intercept repoint :74/:108 +                 zeroed-on-empty, never-writes proof
                Layer-2b logging; augment-never-      M99-D3-T2 wire `gsd-t graph metrics` dispatch
                shrink KEPT; FAIL-OPEN test (#4)                 (append-only doGraph switch arm, :3884)
    M99-D2-T3 per-workflow consumer label +         M99-D3-T3 finalize graph-metrics-contract.md;
                graphWiringMode — label via                     FIX doMetrics ref :5135→:4697 (#7) +
                --consumer ARG + hook resolves from              line-ref-correctness test
                workflow stdin context, NOT setenv    M99-D3-T4 author the rollup test
                (#9); test: in-workflow ≠ 'cli'                 │  delivers: graph-metrics-contract.md
    M99-D2-T4 stamp wiringMode into scan header                 │  (v1.0.0 STABLE; ledger event +
                (north-star feeds D3's #8 count)                 │   rollup shape, in sync w/ emitted keys)
    M99-D2-T5 author the 2 owned tests
       │  consumes: graph-store-resolver-contract.md (import resolveStorePath/append_ledger_line)
       │  + graph-metrics-contract.md § Layer-2a/2b/2c
       ▼  GATE: every interception logs exactly one ledger line (incl. passthrough); byte-identical
       │       decision + output with telemetry on/off AND on-throw (#4); consumer attributed from
       │       workflow context never 'cli'-leaks (#9); the rollup computes all 8 dims + the
       │       fallbackAnnouncedDespiteHit north-star count (#8); contract in sync (#7). Suite green.
```

**M99 cross-domain seams (the only inter-domain contracts):**
| Producer | Artifact | Consumer | Seam guarantee |
|----------|----------|----------|----------------|
| D1 | `resolveStorePath` / `resolveGraphDir` / `resolveLogsDir` / `deriveProjectRoot` / `migrateGraphStore` / `append_ledger_line` (graph-store-resolver-contract.md) | D2 (intercepts + workflows), D3 (rollup) | D2/D3 IMPORT the resolver — never hardcode a path. D1 is the serial gate; D2/D3 start only after it lands. |
| D2 | Layer-2a `kind:'grep'` + Layer-2b `kind:'read'` + Layer-2c `kind:'wiring'` ledger lines (graph-metrics-contract.md § Layer-2) | D3 rollup | D3 reads what D2 emits; D3-T3 reconciles the contract against D2's ACTUAL emitted keys at integrate (drift = fail). |
| D2-T4 | scan-header `graphWiringMode` + the `fallback-announced`+`outcome:'hit'` co-occurrence | D3-T1 `fallbackAnnouncedDespiteHit` | The north-star: D2 produces the contradiction signal in the ledger, D3 counts it (#8). |
| D1-T4 Layer-1 `_logGraphEvent` | `kind:'query'` ledger line (shape KEPT) | D3 rollup hit/passthrough ratio, p50/p95, tier mix | Layer-1 shape byte-for-byte unchanged (KEPT, no Divergence — only the sink PATH + rotation/toggle supersede). |

**File-disjointness (M99):** D1 owns all `bin/gsd-t-graph-*` path files + `bin/gsd-t-graph-query-cli.cjs` + `.gitignore` + its 4 tests. D2 owns the 2 `scripts/*-intercept.js` + the 6 `templates/workflows/*.workflow.js` + its 2 tests. D3 owns `bin/gsd-t.js` (SOLE editor for M99 — D1/D2 touch it in ZERO places) + `bin/gsd-t-graph-metrics-rollup.cjs` + `graph-metrics-contract.md` + its 1 test. Zero inter-domain write-target overlap. (Intra-D1, T1–T5 all touch the resolver/consumers → `gsd-t parallel` reports `disjoint?=no` = EXPECTED same-owner sequential, not a real conflict.)

## Current State: M94 — Persistent Code Graph Index (Phase 1, backlog #44b) — RE-PLANNED 2026-06-26 (4) (deeper re-attack on the R3 fixes — 4 MORE falsifiable gaps found, 2 genuine design bugs; NO scope change beyond these 4). **RE-PLAN (4) — the 4 fixes (see the RE-PLAN (4) Fixes table below):** R4-1 (HIGH) AC-4 had NO halt path → infinite-fail risk: add a machine-checkable `ac4Verdict ∈ {PROVEN, RESCOPE}` outcome ladder + a hard-gate verdict test (peer of D7-T2's Wave-1 gate) so the insight headline can resolve PASS-via-proof / PASS-via-rescope / FAIL-forcing-descope, matching K1/K2/AC-3 — the STRUCTURED verdict is authoritative, not a prose "cleared" (M90 lesson) [D6-T1 contract + D6-T3 verdict+test]; R4-2 (HIGH, REAL BUG) silent accuracy DOWNGRADE on incremental re-index: SCIP is a whole-project batch tool, so `parse_and_put(file)`'s per-file tree-sitter re-index would silently relabel a previously compiler-accurate file `tree-sitter-floor` on the next edit — FREEZE the `parse_and_put` tier invariant (re-upgrade OR honest `tree-sitter-floor-STALE-SCIP` flag, never silent downgrade) [D3-T2/T3 contract + D3-T5 test]; R4-3 (HIGH) who-calls function-identity ambiguity — bare-name `who-calls` merges callers across same-named functions on real data: define a `funcId = file#function` key (FQN/`@line` where overloaded), call edges keyed at both ends, bare-name ambiguity returns an `ambiguous-function` envelope [D5-T1/D3-T1 contract+emit + D5-T4 test]; R4-4 (MEDIUM) multi-file freshness coherence — per-file atomicity ≠ multi-file query coherence: declare the multi-file dirty-set re-index SERIALIZED + the query observes the COHERENT post-re-index state, and MEASURE a ≥100-file branch-switch dirty-set re-index wall-clock [D4-T1 contract + D4-T6 test + D4-T3 budget]. +3 net-new test files (D3-T5, D5-T4, D4-T6); R4-1 folds into already-sole-owned D6 files — disjointness preserved over all 27 tasks. AC-4 RESCOPED to INSIGHT-delta-only per user decision 2026-06-25, around the CENTRAL TENET (dumb-reach vs smart-reach). RISK-FIRST: **7 file-disjoint domains** (d1–d6 + the INTEGRATE-stage d7), **27 atomic tasks (Shape D)**, zero write-target collisions (file-disjointness PROVEN over all 27). **PRIOR RE-PLAN (3) — the 6 deeper-pre-mortem fixes (2 CRITICAL wiring/owner gaps + 4 HIGH/MEDIUM — see the RE-PLAN (3) Fixes table below):** R3-Fix-1 (CRITICAL, USER-APPROVED destructive) rewire `bin/gsd-t.js` `case "graph"` → the D5 CLI + DELETE the 6 dead M20–M21 `bin/graph-*.js` + 3 dead tests (the dead path was WINNING — `gsd-t graph status` kept returning the M20–M21 "No graph index found" anti-goal) [D7-T1]; R3-Fix-2 (CRITICAL) the #8 live-store seam test gets a NAMED owner + a FINDABLE spec (`m94-integration-points.md` at the integrate-read path) [D7-T3]; R3-Fix-3 (HIGH) AC-4 ⊇ over a deterministic structural-finding IDENTITY, not LLM free-text [D6-T1/T2]; R3-Fix-4 (HIGH) Wave-1 HARD GATE machine-checkable via `k1Verdict`/`k2Verdict` + a gate test [D7-T2 + D1-T3/D2-T3]; R3-Fix-5 (MEDIUM) K1 KILL attributable per-candidate per-criterion [D1-T2/T3]; R3-Fix-6 (MEDIUM) K2 MEASURES real Atos scale, never assumes ~1.5M [D2-T2/T3]. PRIOR RE-PLANNED 2026-06-26 (2): +3 pre-mortem-fix test tasks (D3-T4 real-Atos spotcheck, D4-T4 touched-set derivation, D4-T5 add/delete/rename) + 2 contract clarifications (freshness touched-set derivation + add/del/rename) + toggle assertion folded into D6-T2 + footprint contract markings — NO scope change, all net-new test files, disjointness preserved. Wave 1 is a PROVE-OR-KILL HARD GATE — no Wave-2 body build until both spikes PASS. The graph is the MANDATORY structural-knowledge layer; the shared query layer (D5) + the contract mandate that code-reading steps consume the graph are Phase-1 deliverables so the follow-on consumers (/debug /quick /impact /execute /plan partition M92-reflex) are wiring, not redesign. Phase 1 WIRES only /scan as the first proof (ADDITIVELY — current scan kept FULLY INTACT); the others are the MANDATED SEQUENCED roadmap (below), never dropped. **AC-4 = INSIGHT delta only** (graph-wired scan surfaces ≥ the no-graph run's structural findings PLUS ≥1 it missed/got wrong, on a pinned Atos SHA); the SPEED / file-count / cost-critical-path axis is DROPPED from M94 (deferred to a separate "re-think /scan from the graph up" milestone) — D6-T4 (cost-critical-path) removed, D6-T1/T2/T3 reframed insight-only. 7 reframe-required rules remain (the 2 speed/cost-path rules retired — see the table below).

### M94 Wave Groupings (the integration shape)

```
WAVE 1 — PROVE-OR-KILL (parallel, file-disjoint, throwaway spike code). HARD GATE blocks Wave 2.
  d1 store-bakeoff-spike (K1)            ║  d2 treesitter-throughput-spike (K2 = AC-1)
    M94-D1-T1 synthetic-gen                 M94-D2-T1 parser-floor contract (taxonomy from lessons)
    M94-D1-T2 store bake-off [Headline]     M94-D2-T2 ts-throughput probe [Headline]
    M94-D1-T3 store-schema contract+result  M94-D2-T3 K2 result doc + progress.md (AC-1)
       │  delivers: graph-store-schema-contract.md    │  delivers: graph-parser-floor-contract.md
       │  (node/edge/tier/content-hash columns)       │  (entity/edge taxonomy + parse harness)
       ▼                                              ▼
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │ WAVE-1 HARD GATE (MACHINE-CHECKABLE — R3-Fix-4): REQUIRE k1Verdict==PICK (store  │
  │ on evidence, ALL 4 sub-criteria: embedded · <50ms query · <1s incremental ·      │
  │ concurrent-atomicity + Fix-6 footprint ceilings) AND k2Verdict==PASS (tree-sitter│
  │ full-indexes REAL Atos < ~2 min, PINNED SHA, RSS ceiling + MEASURED-scale sanity).│
  │ Verdicts are STRUCTURED FIELDS (D1-T3 k1Verdict, D2-T3 k2Verdict); the gate is    │
  │ ENFORCED by test/m94-wave1-hard-gate.test.js (D7-T2), not prose. Either fails →   │
  │ legitimate KILL/RE-SCOPE; the KILL MUST record an explicit AC-descope (in         │
  │ m94-integration-points.md) before any Wave-2 task — a KILL w/ no descope FAILS;   │
  │ no Wave-2 artifact may exist while a verdict is KILL-without-descope. Wave 2 waits.│
  │ [RULE] wave1-hard-gate-machine-checkable  [RULE] kill-outcome-records-ac-descope  │
  └──────────────────────────────────────────────────────────────────────────────┘
       │
WAVE 2 — BUILD (parallel, file-disjoint over a SHARED on-disk store; D3 writes, D4 mutates, D5 reads):
       ▼
  d3 indexer-core             ║  d4 freshness               ║  d5 query-cli (the keystone)
    M94-D3-T1 edge-extract        M94-D4-T1 content-hash         M94-D5-T1 query CLI + envelope [Headline]
       (+funcId-keyed edges R4-3)    checker + contract            (who-imports/who-calls[funcId R4-3]/
    M94-D3-T2 build_index            (+compute_touched_files,        blast-radius/status)
       +parse_and_put [Headline]     atomicity-reliant,           M94-D5-T2 AC-5 keystone tests
       (+tier-freeze invariant R4-2)  multi-file-coherent R4-4)      (no-grep structural + fault-injection)
    M94-D3-T3 SCIP + tiers (AC-6)        [Headline]               M94-D5-T3 blast-radius union fixture (#9,
    M94-D3-T4 real-Atos edge       M94-D4-T2 AC-3 uncommitted-       + Fix-5 sole liveness guarantee)
       spotcheck (Fix-4)             edit killing test (no timing)  M94-D5-T4 who-calls function-identity
    M94-D3-T5 tier-preserved-on-   M94-D4-T3 AC-3 scale-budget        disambiguation test (R4-3)
       reindex test (R4-2)           measurement (#6 timing split,    │  delivers: graph-query-cli-contract.md
       │  delivers: graph-           +≥100-file branch-switch R4-4)   │  (blast-radius unions both graphs;
       │  indexer-build-contract  M94-D4-T4 Fix-1 touched-set          │   blast-radius = sequenced follow-on;
       │  (build_index +             derivation killing test          │   who-calls funcId R4-3)
       │   parse_and_put surface,  M94-D4-T5 Fix-2 add/delete/        │
       │   tier-freeze R4-2)          rename freshness test           │
       │                          M94-D4-T6 multi-file coherence     │
       │                             killing test (R4-4)             │
       │                          │  delivers: graph-               │
       │                          │  freshness-contract.md          │
       │                          │  (+touched-set + add/del/rename │
       │                          │   + multi-file coherence R4-4)  │
       └── D4 calls D3's parse_and_put (function call, NOT a file edit) ───┘
       └── D5 calls D4's freshness_check_on_query INLINE before answering ─┘
       ▼  GATE: AC-2 (who-imports/calls correct) + AC-3 (correctness deterministic + scale-budget <1s) +
       │       AC-5 (no grep path structurally + fail-loud on injection) + AC-6 (tiers honest) green.
       │       INTEGRATE-owned seam test (#8): real D3 index → real D1 store → edit a file → D5 query
       │       reflects the EDIT (proves D5→D4→D3→D1 fired live + the store mutated).
       │
WAVE 3 — CONSUMER WIRING (the falsifiable SMART-REACH payoff; ADDITIVE extend-class on EXISTING scan files — current scan kept INTACT):
       ▼
  d6 scan-wiring  (AC-4 = INSIGHT delta only; SPEED / cost-critical-path axis DROPPED from M94)
    M94-D6-T1 scan-consumer contract (consumes graph-query-cli-contract.md; INSIGHT gate + SHA pin)
    M94-D6-T2 wire scan.md + scan.workflow.js — INJECT the pre-computed structural slice into scanSlice agents (ADDITIVE)
    M94-D6-T3 AC-4 INSIGHT-delta measure [Headline] — no-graph baseline vs graph-wired (#INSIGHT) + SHA pin (#7) + ac4Verdict (R4-1)
       │  build-if-absent; query INJECTS the graph's structural slice (dependents/dead-code/cycles) into the
       │  deep-finders so findings are ACCURATE (graph-derived, not LLM-reconstructed) — additive, scan kept intact.
       │  Falls back to grep mode ANNOUNCED on graph-unavailable. NO wall-clock measured (speed axis out of M94).
       │  toggle-integrity asserted — baseline graph-query call-count == 0 (genuinely graph-free), graph-wired > 0.
       │  R3-Fix-3: AC-4 ⊇ over a deterministic structural-finding IDENTITY ({kind | sorted symbol/file set}), NOT raw LLM titles.
       │  R4-1: machine-checkable ac4Verdict ∈ {PROVEN, RESCOPE} outcome ladder + hard-gate verdict test — AC-4 HALT path (no infinite-fail loop); STRUCTURED verdict authoritative, not prose.
       │  [RULE] scan-injects-structural-slice · scan-insight-gate · scan-finding-identity-canonical · ac4-verdict-machine-checkable · ac4-atos-sha-pinned · no-graph-baseline-proven-graph-free
       │
INTEGRATE — d7 integrate-rewire (after the Wave-2 trio integrates; the 2 CRITICAL wiring/owner gaps + the machine-checkable Wave-1 gate):
       ▼
  d7 integrate-rewire
    M94-D7-T1 rewire bin/gsd-t.js `case "graph"` → the D5 CLI + DELETE the 6 dead M20–M21 bin/graph-*.js + 3 dead tests (R3-Fix-1, USER-APPROVED destructive)
       └─ integration test shells out REAL `gsd-t graph status`/`who-imports` through the entry point → asserts the NEW CLI (live/graph-unavailable), NEVER the dead "No graph index found". [RULE] graph-status-live
    M94-D7-T2 machine-checkable Wave-1 HARD GATE test — reads k1Verdict/k2Verdict; a KILL w/o AC-descope FAILS; no Wave-2 artifact while KILL-without-descope (R3-Fix-4). [RULE] wave1-hard-gate-machine-checkable
    M94-D7-T3 live-store seam test owner (#8 given a real owner) + m94-integration-points.md at the integrate-read path (R3-Fix-2). [RULE] live-store-seam-real-pipeline
       └─ d7 is the SOLE writer of bin/gsd-t.js anywhere in M94 (the rewire edits ONLY the graph-dispatch; the new CLI is gsd-t-graph-*, the dead engine bare graph-*) — file-disjointness holds.
```

### M94 Cross-domain seams (function-level / contract-level — NO shared file edits)
| Seam | Producer | Consumer(s) | Surface | Shared file? |
|------|----------|-------------|---------|--------------|
| Store schema | d1 (M94-D1-T3) | d3 (write), d4 (read hash), d5 (read) | `graph-store-schema-contract.md` columns | NO — contract, frozen at K1 PICK |
| Parser-floor taxonomy | d2 (M94-D2-T1) | d3 (lifts WHAT) | `graph-parser-floor-contract.md` | NO — contract, frozen at K2 PASS |
| Build/put surface | d3 (M94-D3-T2) | d4 (`parse_and_put`), d5 (re-index inline) | `graph-indexer-build-contract.md` function surface | NO — function call, not a file edit |
| Freshness check | d4 (M94-D4-T1) | d5 (inline before answer) | `graph-freshness-contract.md` `freshness_check_on_query` | NO — function call |
| Query envelope | d5 (M94-D5-T1) | d6 (scan reads it), d7 (dispatch delegates) | `graph-query-cli-contract.md` JSON envelope | NO — contract |
| Scan wiring | d6 (M94-D6-T2) | none (terminal) | extend-class edits to existing scan files | d6 SOLE owner of both scan files |
| **Live store seam (#8, D7-OWNED — R3-Fix-2)** | d7 (M94-D7-T3) | n/a | `test/m94-integrate-live-store-seam.test.js` — real D3 index → real D1 store → edit file → D5 query reflects edit | NO — net-new test file, SOLE-owned by D7-T3 |
| **Graph dispatch rewire (R3-Fix-1, D7-OWNED, USER-APPROVED destructive)** | d7 (M94-D7-T1) | n/a — terminal | `bin/gsd-t.js` `case "graph"` delegates to `bin/gsd-t-graph-query-cli.cjs`; 6 dead `bin/graph-*.js` + 3 dead tests DELETED | `bin/gsd-t.js` — D7-T1 SOLE owner anywhere in M94 |
| **Wave-1 hard-gate (R3-Fix-4, D7-OWNED)** | d7 (M94-D7-T2) | reads D1-T3 `k1Verdict` + D2-T3 `k2Verdict` | `test/m94-wave1-hard-gate.test.js` — KILL-without-descope FAILS; no Wave-2 artifact while KILL-without-descope | NO — net-new test file, SOLE-owned by D7-T2 |

### M94 Reframe-required rules (the CENTRAL TENET binding — AC-4 RESCOPED 2026-06-25: rules #1 + #2 RETIRED, insight rule kept)
| # | Sev | Rule / test | Owner | `[RULE]` |
|---|-----|-------------|-------|----------|
| ~~1~~ | RETIRED | ~~AC-4 cost-critical-path (run-2 reads fewer files)~~ — DROPPED from M94 by the user rescope (unbindable without a scan redesign); deferred to the separate "re-think /scan from the graph up" milestone. D6-T4 task removed | — | ~~`scan-run2-on-cost-critical-path`~~ |
| ~~2~~ | RETIRED | ~~Pre-registered SPEED threshold (run-2 < 0.5× run-1)~~ — DROPPED from M94 (same rescope); AC-4 measures NO wall-clock. Deferred to the scan-redesign milestone | — | ~~`scan-run2-speed-ceiling`~~ |
| INSIGHT | CRITICAL | AC-4 INSIGHT gate (the SOLE AC-4 binding): graph-wired scan surfaces ≥ the no-graph baseline's structural findings PLUS ≥1 concrete named finding the no-graph run missed/got wrong, on a pinned Atos SHA | D6-T1 (contract) + D6-T3 (check) | `scan-insight-gate` |
| 3 | HIGH | Numeric query-latency target (<50ms who-imports/who-calls) in graph-store-schema-contract.md BEFORE D1; engineered-to-fail candidate fails on latency | D1-T2/T3 + contract | `k1-query-latency-target` |
| 4 | HIGH | Store concurrency/atomicity: concurrent who-imports during re-index returns fully-old OR fully-new, never torn; K1 4th sub-criterion | D1-T2 (K1) + D4-T1 (reliance) + store-schema contract | `k1-atomic-single-file-update` · `freshness-write-atomic-no-torn-read` |
| 5 | HIGH | Per Wave-1 KILL outcome, an explicit AC-descope tied to which ACs survive, recorded before any Wave-2 task — now MACHINE-CHECKED via the `k1Verdict`/`k2Verdict` fields + the D7-T2 gate test (R3-Fix-4) | D1-T3 / D2-T3 + D7-T2 gate test | `kill-outcome-records-ac-descope` |
| 6 | MEDIUM | AC-3/K1 timing split: deterministic CORRECTNESS test (no timing) gates the build; separate SCALE-BUDGET measurement records the <1s number | D4-T2 (correctness) + D4-T3 (scale) | (timing-split) |
| 7 | MEDIUM | Atos commit-SHA pin for AC-4 (no-graph run == graph-wired run) AND K2; fail-loud on repo-not-found/commit-mismatch | D6-T3 + D2-T2 + both contracts | `ac4-atos-sha-pinned` · `k2-atos-sha-pinned` |
| 8 | MEDIUM | Wave-2 integration seam test (NOW D7-OWNED — R3-Fix-2, not mocked): real index→store→edit→query reflects the edit + store mutated; spec findable at `m94-integration-points.md` | D7-T3 | `live-store-seam-real-pipeline` |
| 9 | LOW | Blast-radius semantics (which graphs, hop-depth) in graph-query-cli-contract.md + fixture test: union of import+call graphs, neither over- nor under-broad | D5-T1 (contract) + D5-T3 (test) | `blast-radius-unions-both-graphs` |

### M94 Pre-mortem Fixes (RE-PLAN 2026-06-26 — 6 gaps, NO scope change: missing tests + 2 freshness-contract clarifications)
| Fix | Sev | Rule / test | Owner | `[RULE]` |
|-----|-----|-------------|-------|----------|
| 1 | CRITICAL | `touched_files` derivation DEFINED in graph-freshness-contract.md = whole-tree content-hash dirty set (ALL indexed files), NEVER the query target; 3-file A→B→C test: edit B's content, query who-imports(C), assert B's NEW state reflected (edited non-target not served stale) | D4-T1 (contract `compute_touched_files`) + D4-T4 (test) | `touched-set-is-whole-tree-dirty-not-query-target` |
| 1b | HIGH (Fix-1 follow-on, found this re-plan) | The whole-tree dirty-scan Fix-1 introduces is a NEW per-query cost (scan ALL indexed files every query) — at 1.5M-node Atos scale it could blow the sub-1s AC-3 budget. D4-T3 scale-budget ALSO measures `compute_touched_files()` per-query cost (mtime-prefilter → content-hash) against the < 1 s ceiling; over budget → kill/re-scope (git-status-bounded candidate set) as an AC-descope | D4-T3 (scale measurement) + freshness contract | `touched-set-dirty-scan-under-budget` |
| 2 | CRITICAL | Add/delete/rename freshness declared in graph-freshness-contract.md (dirty-set enumerates adds + deletes, rename = delete+add); test: delete→dangling edge removed, add→new importer surfaces, rename→old gone+new present | D4-T1 (contract) + D4-T5 (test) | `freshness-detects-add-delete-rename` |
| 3 | HIGH | No-graph toggle proven OFF: spy/mock runCli, assert graph-query call-count == 0 in baseline mode, > 0 graph-wired — baseline genuinely graph-free so AC-4's recorded baseline set is not bogus | D6-T2 (toggle-integrity assertion) | `no-graph-baseline-proven-graph-free` |
| 4 | HIGH | AC-2 correctness bound to REAL Atos (not toy fixtures): build_index over real Atos at pinned SHA, ≥3 hand-picked known real edges appear + total edge count > floor (>10k); fail-loud-skip if Atos absent (K2 pattern) | D3-T4 (test) | `real-atos-edge-spotcheck-or-loud-skip` |
| 5 | MEDIUM | blast-radius marked SEQUENCED-follow-on (NOT Phase-1-consumed, /impact + /debug deferred, NOT wired into /scan) in graph-query-cli-contract.md + this file; D5-T3 union fixture = sole Phase-1 liveness — declared foundation, not silent dead deliverable | D5-T1 (contract marking) + D5-T3 (liveness) | `blast-radius-sequenced-follow-on-not-phase1-consumed` |
| 6 | MEDIUM | Build footprint ceiling: K2 (D2-T2/T3) records peak build RSS; K1 (D1-T2/T3) records peak load RSS + on-disk index size against PRE-REGISTERED ceilings (peak-RSS bound + index-size-vs-source multiple) in store-schema contract; over ceiling → KILL/not-picked (prove-or-kill peer to latency/throughput) | D2-T2/T3 + D1-T2/T3 + store-schema contract | `k2-build-footprint-ceiling` · `k1-footprint-ceiling` |

### M94 RE-PLAN (3) Fixes (2026-06-26 — deeper pre-mortem re-attack; 2 CRITICAL wiring/owner gaps + 4 HIGH/MEDIUM; +1 INTEGRATE-stage domain d7, +3 D7 tasks, NO Wave-1/2/3 scope change)
| Fix | Sev | Rule / test | Owner | `[RULE]` |
|-----|-----|-------------|-------|----------|
| R3-1 | CRITICAL (USER-APPROVED destructive) | Dead `gsd-t graph` dispatch collision: `bin/gsd-t.js` `case "graph"` STILL routed to the dead M20–M21 `graph-store/indexer/query.js` (the dead path WON → `gsd-t graph status` returned the M20–M21 "No graph index found" anti-goal). Rewire the dispatch → the NEW `bin/gsd-t-graph-query-cli.cjs`; DELETE the 6 dead `bin/graph-{store,cgc,indexer,overlay,parsers,query}.js` + 3 dead `test/graph-{indexer,store,query}.test.js` (requirer-verified safe: only the rewired dispatch + those 3 tests reference them); integration test `test/m94-d5-graph-dispatch.test.js` shells out REAL `gsd-t graph status`/`who-imports` through the entry point, asserts the NEW CLI (live/graph-unavailable), NEVER the dead string | D7-T1 | `graph-status-live` |
| R3-2 | CRITICAL | The #8 live-store seam test was NAMED but ownerless + integrate couldn't find its spec. Give it a NAMED owner (`test/m94-integrate-live-store-seam.test.js`, real D3 build→D1 store→D5 who-imports→edit on disk→re-query reflects the edit, NO mocks) AND publish the M94 integration-points doc at the integrate-read path (`.gsd-t/contracts/m94-integration-points.md` per `gsd-t-integrate.workflow.js:81`) | D7-T3 | `live-store-seam-real-pipeline` |
| R3-3 | HIGH | AC-4 insight ⊇ compared LLM free-text titles (spurious pass/fail). Define a deterministic structural-finding IDENTITY key (`{kind ∈ {dead-code,cycle,dependent,coupling} | sorted symbol/file set}`) + canonicalization (strip the title) in `graph-scan-consumer-contract.md`; the ⊇ is over canonical identities; unit test: rephrase → SAME identity (can't break ⊇), new fact → DISTINCT identity | D6-T1 (contract) + D6-T2 (test) | `scan-finding-identity-canonical` |
| R3-4 | HIGH | Wave-1 prove-or-kill HARD GATE was prose, not machine-checkable. D1-T3/D2-T3 write `k1Verdict` (PICK\|KILL_OR_RESCOPE) / `k2Verdict` (PASS\|KILL) into the result-doc envelope; gate test `test/m94-wave1-hard-gate.test.js` reads both: a verdict != PICK/PASS with NO AC-descope record FAILS; no Wave-2 build artifact may exist while a verdict is KILL-without-descope | D7-T2 + D1-T3 + D2-T3 | `wave1-hard-gate-machine-checkable` · `kill-outcome-records-ac-descope` |
| R3-5 | MEDIUM | K1 KILL must be attributable. D1-T2's bake-off envelope records, PER CANDIDATE, WHICH sub-criterion failed + a `candidateSetJustification` (closure of the embedded/no-server/no-paid-license category, or the next candidate to try before declaring an architectural kill); a bare KILL with no per-candidate per-criterion breakdown FAILS the test | D1-T2 (test) + D1-T3 (doc) | `k1-kill-attributable-per-candidate` |
| R3-6 | MEDIUM | K2 must MEASURE real Atos scale, not assume ~1.5M. D2-T2 measures + records `atosFileCount` + `atosTotalLoc` + `atosLangBreakdown` (scc/cloc or the parse harness) at the pinned SHA; the D1 synthetic scale + the K1/K2 ceilings are sanity-checked against the MEASURED number; material divergence (e.g. >1.5×/<0.66×) flags `scaleMismatch` and FAILS-LOUD (so K1 store evidence isn't validated at the wrong size) | D2-T2/T3 (+ D1-T1 scale derivation) | `k2-atos-scale-measured-not-assumed` · `k2-scale-sanity-vs-bakeoff` |

### M94 RE-PLAN (4) Fixes (2026-06-26 — deeper re-attack on the R3 fixes; 4 MORE falsifiable gaps, 2 genuine design bugs; NO scope change beyond these 4; +3 net-new test tasks, no new write-target collisions)
| Fix | Sev | Rule / test | Owner | `[RULE]` |
|-----|-----|-------------|-------|----------|
| R4-1 | HIGH (AC-4 had NO halt path → infinite-fail risk) | AC-4's INSIGHT gate could FAIL with no KILL/RESCOPE outcome when both runs find the same canonical set (today's `/scan` already finds dead-code/cycles/dependents — architecture kept intact), unlike K1/K2/AC-3 which all carry a kill-outcome record. Add a machine-checkable `ac4Verdict ∈ {PROVEN, RESCOPE}` outcome ladder + a hard-gate verdict test (peer of D7-T2's Wave-1 gate): `PROVEN` = the ≥1 graph-attributed missed/wrong delta exists; `RESCOPE` = zero delta BUT either (a) a graph-attributed ACCURACY correction (a baseline finding the graph proves WRONG, e.g. a false dead-code symbol the graph shows is live) OR (b) a documented descope per `kill-outcome-records-ac-descope`. Zero-delta AND no rescope record ⇒ FAILS (forces halt+descope, never a silent loop — the debug-loop-never-halts anti-pattern). The STRUCTURED `ac4Verdict` is authoritative, NOT a prose "cleared" string (M90 lesson). Gives the headline a halt path matching K1/K2/AC-3 | D6-T1 (contract) + D6-T3 (verdict + gate test) | `ac4-verdict-machine-checkable` |
| R4-2 | HIGH (REAL BUG — silent accuracy DOWNGRADE on incremental re-index) | `build_index` does tree-sitter-floor → OPTIONAL SCIP upgrade → `store.put(tier)`. SCIP indexers are WHOLE-PROJECT BATCH tools (one `index.scip` per repo/crate) — they CANNOT re-derive a single file. `parse_and_put(file)` (the per-file re-index D4/D5 call on EVERY stale file) re-parses ONE file via tree-sitter only — so a file that was `tier=compiler-accurate` after `build_index` gets SILENTLY re-written `tier=tree-sitter-floor` on the very next incremental edit (smart-reach silently degrading to dumb-reach on the EXACT path AC-3 exercises). FREEZE `parse_and_put`'s tier behavior in `graph-indexer-build-contract.md` BEFORE D3/D4 execute: re-run SCIP for that language if feasible, OR honestly downgrade-with-flag `tier=tree-sitter-floor-STALE-SCIP` — NEVER silently relabel plain `compiler-accurate` / plain `tree-sitter-floor` / drop to an unlabeled approximate edge. Test (`test/m94-d3-tier-preserved-on-reindex.test.js`): build a SCIP-present fixture so a file is `compiler-accurate`, edit it, `parse_and_put`, assert re-upgraded OR explicitly STALE-SCIP-flagged; FAIL-LOUD-SKIP `scip-indexer-not-present` if no SCIP installed | D3-T2/T3 (contract invariant) + D3-T5 (test) | `reindex-tier-never-silently-downgraded` |
| R4-3 | HIGH (who-calls identity ambiguity — not provable on real data) | `who-calls <function>` took a bare NAME, but real codebases have many same-named functions (`handle`/`init`/`run`/`get`/`render`) across files — `who-calls('handle')` on real Atos MERGES wrong callers; AC-2's hand-checked fixtures can pick unique names and pass while the query is broken on real data. Define a function-identity key `funcId = file#function` (FQN / `file#function@line` where overloaded) in `graph-query-cli-contract.md` + `graph-store-schema-contract.md`; call edges keyed by `funcId` at BOTH ends (D3-T1 emits it); a bare name matching multiple `funcId`s returns `{ok:false, reason:"ambiguous-function", candidates:[...]}` or per-candidate grouped results, NEVER a flat merge. Test (`test/m94-d5-who-calls-identity.test.js`): TWO `foo`s in different files with distinct callers; `who-calls('a.ts#foo')` returns ONLY a.ts's callers; bare `who-calls('foo')` disambiguates. Until who-calls identity is defined+tested, AC-2 who-calls correctness is NOT provable on real data | D5-T1 + D3-T1 (contract+emit) + D5-T4 (test) | `who-calls-function-identity-disambiguated` |
| R4-4 | MEDIUM (multi-file freshness coherence) | The store's per-file atomicity (sub-criterion 4) covers ONE in-flight single-file write vs a read of THAT file. But `compute_touched_files()` returns the WHOLE-TREE dirty set — a branch-switch/git-pull/rebase dirties HUNDREDS of files re-indexed inline before answering, and per-file atomicity ≠ multi-file query coherence. `graph-freshness-contract.md` declares the multi-file dirty-set re-index is SERIALIZED and the query observes the post-re-index COHERENT state (a `who-imports(X)` whose reverse-import edges span several re-indexing files = all-new for EVERY contributor, never a mix of old-for-some/new-for-others). Test (`test/m94-d4-multifile-coherence.test.js`): dirty N>1 files all contributing to `who-imports(X)`, assert the edge set is COHERENT. D4-T3's AC-3 scale-budget ALSO measures a ≥100-file dirty-set serial re-index wall-clock against a stated multi-file ceiling — the branch-switch budget is MEASURED, not assumed | D4-T1 (contract) + D4-T6 (coherence test) + D4-T3 (scale budget) | `freshness-multifile-reindex-serialized-coherent` · `multifile-dirty-set-reindex-under-budget` |

### M94 Mandated SEQUENCED follow-on consumers (in-scope by principle, sequenced by execution — NEVER dropped)
The Central Tenet makes the graph the structural-knowledge layer for EVERY code-reading step. Phase 1 WIRES only `/scan` (the first proof). The shared query layer (D5 CLI) + the contract mandate are Phase-1 deliverables so each follow-on is WIRING, not redesign. The mandated roadmap (each a later sequenced wiring milestone): `/debug` · `/quick` · `/impact` · `/execute` file-disjointness · `/plan` · partition · M92 simplicity-reflex. Each consumes the same `graph-query-cli-contract.md` envelope; none re-derives structure from raw text.

### M94 Disjointness verdict (re-validated this RE-PLAN (4) phase 2026-06-26 — 27 tasks across 7 domains)
- **27 tasks** parsed (parser-canonical `### M94-Dx-Ty —` Shape D), every task carries an explicit `**Touches**` list (source: declared, never git-fallback). RE-PLAN (4) delta = +3 net-new single-file test tasks, zero overlap, + edits to already-sole-owned files:
  - **D3-T5** → `test/m94-d3-tier-preserved-on-reindex.test.js` (net-new — R4-2 tier-preservation killing test). R4-2 contract invariant edits `graph-indexer-build-contract.md` (D3-T2 sole-owned) + `graph-store-schema-contract.md` `tier` enum (D1-T3 sole-owned).
  - **D5-T4** → `test/m94-d5-who-calls-identity.test.js` (net-new — R4-3 who-calls disambiguation test). R4-3 contract edits `graph-query-cli-contract.md` (D5-T1 sole-owned) + `graph-store-schema-contract.md` `funcId` key (D1-T3 sole-owned) + D3-T1's edge-extractor emits `funcId` (D3-T1 sole-owned).
  - **D4-T6** → `test/m94-d4-multifile-coherence.test.js` (net-new — R4-4 coherence killing test). R4-4 contract edits `graph-freshness-contract.md` (D4-T1 sole-owned) + the ≥100-file budget extends D4-T3's result-doc measurement (D4-T3 sole-owned).
  - **R4-1** folds into **D6-T1** (`graph-scan-consumer-contract.md`, already sole-owned — the `ac4Verdict` ladder) + **D6-T3**'s existing `test/m94-d6-scan-consumer.test.js` + the D6-T3 result doc — NO new write target.
  - PRIOR RE-PLAN (3) delta (the +3 D7 tasks + R3 edits) below stands unchanged:
  - **D7-T1** → `bin/gsd-t.js` (graph-dispatch region — D7-T1 is the SOLE writer of `bin/gsd-t.js` ANYWHERE in M94) + `test/m94-d5-graph-dispatch.test.js` (net-new) + DELETES the 6 dead `bin/graph-*.js` + 3 dead `test/graph-*.test.js` (USER-APPROVED, requirer-verified — only the rewired dispatch + those 3 tests reference them)
  - **D7-T2** → `test/m94-wave1-hard-gate.test.js` (net-new)
  - **D7-T3** → `test/m94-integrate-live-store-seam.test.js` (net-new, the #8 seam given an owner) + `.gsd-t/contracts/m94-integration-points.md` (net-new, the integrate-read-path doc)
  - **R3-Fix-3** folded into **D6-T1** (`graph-scan-consumer-contract.md`, already sole-owned) + **D6-T2**'s existing `test/m94-d6-scan-consumer.test.js` — no new file.
  - **R3-Fix-4** `k1Verdict`/`k2Verdict` are envelope-field additions in **D1-T3** / **D2-T3** (already sole-owned docs) — no new file.
  - **R3-Fix-5** is an envelope-field + test assertion in **D1-T2** (`test/m94-k1-store-bakeoff.test.js`, already sole-owned) — no new file.
  - **R3-Fix-6** is envelope-field + test assertion in **D2-T2** (`test/m94-k2-treesitter-throughput.test.js`, already sole-owned) + the D2-T3 result doc — no new file.
- **Sole-owner invariant for the shared file:** `bin/gsd-t.js` is edited by EXACTLY ONE task in the milestone (D7-T1). No Wave-1/2/3 domain touches it. The new query CLI lives under the `gsd-t-graph-*` prefix; the dead engine under the bare `graph-*` prefix — the rewire edits only the dispatch, the new CLI is D5-owned and only invoked.
- `proveDisjointness` over ALL 27 tasks: **0 sequential (write-target-overlap) groups, 0 unprovable** — no two tasks anywhere in the milestone write the same path. The 3 new R4 test files + the dispatch edit are uniquely owned by exactly one task; the edited contracts/test files stay sole-owned by their original authoring task. (Re-validate via `gsd-t parallel --dry-run` at execute time.)
- Per-stage concurrent sets (Wave 1 d1∥d2, Wave 2 d3∥d4∥d5, Wave 3 d6, INTEGRATE d7 — D7-T1∥T2∥T3 mutually disjoint) all fully parallel-provable within their stage. The 3 R4 test tasks slot into their owning domains' Wave-2 (D3-T5, D5-T4, D4-T6) intra-domain serial chains (gated on the same-domain impl task), changing no stage's concurrency set.
- Intra-domain order is enforced by `**Dependencies**` (same-owner serial chain), NOT by file overlap. D7 is gated on the Wave-2 trio integrating (D5 CLI + real pipeline exist) + the Wave-1 K1/K2 envelopes existing.
- The dead M20–M21 `bin/graph-*.js` use the bare `graph-` prefix — disjoint from the new `gsd-t-graph-*` prefix; deleted ONLY by D7-T1 (USER-APPROVED), requirer-verified safe.

### M94 Plan-hardening (M83) status
- Every behavioral task declares **Files + Test + ImplPath**; the milestone's headline capabilities are each tagged **Headline:** true with a real impl path AND an end-to-end killing test:
  - K1 store pick (D1-T2) — kill-criterion test: a candidate failing one of the FOUR sub-criteria (incl. <50ms latency #3 + atomicity #4) is NOT picked.
  - K2 = AC-1 Atos throughput (D2-T2) — over-budget → KILL; `repo-not-found` + unpinned-SHA (#7) fail-loud.
  - AC-3 freshness (D4-T1 impl, atomicity-reliant #4) — content-hash catches an uncommitted edit (D4-T2, no inline timing #6); scale-budget <1s measured separately (D4-T3 #6); **Fix-1** touched-set derivation killing test (D4-T4 — edited non-target not served stale); **Fix-2** add/delete/rename freshness test (D4-T5).
  - AC-5 keystone (D5-T1 impl) — structural grep-for-absence (D5-T2) + fault-injection (D5-T2); blast-radius union (D5-T3 #9, also Fix-5 sole Phase-1 liveness for the sequenced-follow-on blast-radius).
  - AC-6 tiers (D3-T3) — compiler-accurate vs tree-sitter-floor labeled; Rust cross-crate flagged partial.
  - **Fix-4** real-Atos edge spotcheck (D3-T4) — binds AC-2 correctness to REAL Atos at the pinned SHA (≥3 known real edges + >10k edge floor; fail-loud-skip if Atos absent), so green is not achievable on near-zero/garbage real-world extraction.
  - **Fix-3** no-graph toggle proven OFF (D6-T2) — baseline graph-query call-count == 0, graph-wired > 0, so the AC-4 INSIGHT baseline is genuinely graph-free (not a bogus graph-fed baseline that mis-passes the insight gate).
  - **Fix-6** build footprint ceilings (D1-T2/T3 peak load RSS + on-disk index size; D2-T2/T3 peak build RSS) measured against PRE-REGISTERED ceilings in the store-schema contract — prove-or-kill peer to latency/throughput.
  - **R3-Fix-1** dead-dispatch rewire + dead-engine deletion (D7-T1) — `test/m94-d5-graph-dispatch.test.js` shells out the REAL `gsd-t graph status`/`who-imports` through the entry point and asserts the NEW CLI answers (live/graph-unavailable), NEVER the M20–M21 "No graph index found"; the 6 dead files + 3 dead tests are gone from disk. `graph-status-live` is now bound to a real rewire+test, not just the D5 unit test.
  - **R3-Fix-2** live-store seam (D7-T3) — `test/m94-integrate-live-store-seam.test.js` runs the REAL D3→D1→D5 pipeline (no mocks): build → store → who-imports → edit on disk → re-query reflects the edit; the spec is findable at `m94-integration-points.md` (the integrate-read path).
  - **R3-Fix-4** Wave-1 hard gate machine-checkable (D7-T2) — reads `k1Verdict`/`k2Verdict`; a KILL with no AC-descope FAILS; no Wave-2 artifact while KILL-without-descope (fixture-driven, deterministic).
  - **R3-Fix-3** AC-4 ⊇ over a deterministic structural-finding IDENTITY (D6-T1 contract + D6-T2 test) — rephrase → same identity, new fact → distinct identity; the gate compares canonical facts, not raw LLM titles.
  - **R3-Fix-5** K1 KILL attributable (D1-T2/T3) — per-candidate per-criterion breakdown + candidate-set justification; a bare KILL FAILS.
  - **R3-Fix-6** K2 real-scale measured (D2-T2/T3) — `atosFileCount`/`atosTotalLoc`/`atosLangBreakdown` measured, sanity-checked vs the bake-off synthetic scale; material divergence FAILS-LOUD.
  - AC-4 payoff (D6-T3 impl, INSIGHT delta only — scan kept intact) — INSIGHT gate (`scan-insight-gate`) + SHA pin #7. The SPEED ceiling + cost-critical-path axis is DROPPED from M94 (rules #1/#2 retired, D6-T4 removed); deferred to a separate scan-redesign milestone.
  - **R4-1** AC-4 HALT path (D6-T1 contract + D6-T3 verdict+test) — machine-checkable `ac4Verdict ∈ {PROVEN, RESCOPE}` outcome ladder; hard-gate verdict test (peer of D7-T2's Wave-1 gate) asserts PROVEN⇒pass / RESCOPE+accuracy-correction⇒pass / RESCOPE+descope⇒pass / zero-delta-no-rescope⇒FAIL / missing-field⇒FAIL. The STRUCTURED verdict is authoritative, not a prose "cleared". Gives the insight headline a halt path matching K1/K2/AC-3 (no infinite-fail loop).
  - **R4-2** parse_and_put tier-preservation (D3-T2/T3 contract invariant + D3-T5 test) — a per-file re-index of a previously-compiler-accurate file re-upgrades OR honestly flags `tree-sitter-floor-STALE-SCIP`, NEVER silently downgrades (SCIP is a whole-project batch tool); fail-loud-skip if no SCIP installed. Closes the silent smart-reach→dumb-reach degradation on the AC-3 path.
  - **R4-3** who-calls function-identity (D5-T1 + D3-T1 contract+emit, D5-T4 test) — `funcId = file#function` key disambiguates same-named functions; `who-calls('a.ts#foo')` returns ONLY a.ts's callers, bare-name ambiguity → `ambiguous-function` envelope, never a flat merge. Makes AC-2 who-calls correctness provable on REAL data.
  - **R4-4** multi-file freshness coherence (D4-T1 contract + D4-T6 test + D4-T3 budget) — multi-file dirty-set re-index serialized + the query observes the coherent post-re-index state (per-file atomicity ≠ multi-file coherence); ≥100-file branch-switch dirty-set re-index wall-clock MEASURED at scale against a stated ceiling.
- Store choice / SCIP invocation / edge taxonomy stay **DEFERRED to Wave-1 spike evidence** — never asserted in the plan.

---

## Prior: M90 — The Unproven-Assumption Doctrine (PLANNED 2026-06-22 — risk-first, 4 file-disjoint domains, 3 waves). Plan hardened: traceability-gate GREEN (exit 0, 0 violations, 24 behavioral, 7 headline). Supersedes/absorbs M89 (its factual slice = D3/R-FACT). M87 resumes after M90's relevant slices land.

### M90 Architecture (LOCKED at discuss — `.gsd-t/discuss/M90-approach-sourced.md`)
**Externalize + force, never introspect.** The decisive sourced finding: a model cannot reliably self-grade its own assumption (verbalized confidence ≈ coin-flip; RLHF makes calibration ~10× worse; self-critique degrades plan quality) — which root-causes the binvoice + M87 + M89 saga. So the model NEVER grades itself: a DETERMINISTIC trigger fires an EXTERNAL response (blind-adversary plan-review on a separate context/`fable` model + executable spike), and research is FORCED by protocol (not confidence-gated) for the time-sensitive/external class. Extends M83 pre-mortem + Red-Team-on-fable; invents no new introspection. The architectural-DETECTION trigger ships EXPERIMENTAL/measured (the one piece with no published precedent — instrumented, never claimed).

### M90 Seam contract
`.gsd-t/contracts/m90-doctrine-mechanisms-contract.md` v1.0.0 PROPOSED (firms to STABLE when Wave-1 prove-or-kill clears) — the single seam pinning the FROZEN JSON-envelope signatures of all three mechanisms so the integrate domain (D4) wires them WITHOUT any Wave-1/2 domain touching a shared file: §1 factual classifier (`bin/gsd-t-research-gate.cjs` `classify(gap)`, vendor-list **KEPT** as an `external→web` upgrade — premise-corrected: `internal` is asserted only on a concrete own-repo path/anchor, a bare out-of-list vendor already routes `ambiguous→judge`, so deleting the list is a regression not a silent-miss fix; LLM-judges-the-open-world + time-anchored override, §7 fail-closed cite gate PRESERVED), §2 architectural trigger + response (`bin/gsd-t-architectural-trigger.cjs` + `blind-adversary-subagent.md`), §3 loop ledger + halt (`bin/gsd-t-loop-ledger.cjs`), §4 fail-closed integration points, the wiring-seam-ownership table (D4 = sole writer of ALL shared surfaces). The full doctrine spine (§4/§5/§6) lands in the NEW `unproven-assumption-doctrine-contract.md` (D4-T1, absorbs `auto-research-contract.md` v1.3.3). **Stability rule:** producers FREEZE their exported signatures when Wave 1/2 closes; D4 wires against the frozen shapes — a post-freeze signature change is a contract violation.

### M90 task-ID rename (plan-phase correction)
The partition emitted task IDs in the LETTER form `M90-DA/DL/DF/DC-Tn`. The task-graph parser regex is `^###\s+([A-Z]\d+-D\d+-T\d+)` — a **letter after `D` silently parses 0 tasks** (the file-disjointness oracle + traceability gate would see an empty M90). Plan renamed to the parser-canonical digit form, preserving the wave structure: **D1 = arch-trigger-response (DA)**, **D2 = loop-ledger-halt (DL)**, **D3 = factual-redesign (DF)**, **D4 = contract-doctrine-integrate (DC)**. Cross-domain deps in D4 reference the renamed IDs.

### M90 Wave Plan (risk-first — prove-or-kill before wiring)

```
WAVE 1 — prove-or-kill (parallel, file-disjoint, zero shared files). HIGHEST RISK FRONT-LOADED:
  D1 arch-trigger-response (M90-D1)      D2 loop-ledger-halt (M90-D2)
    bin/gsd-t-architectural-trigger.cjs    bin/gsd-t-loop-ledger.cjs
    + blind-adversary-subagent.md (fable)  + computed symptom-signature + 3-cycle hard-halt
    + divergence-sampling + extend-class   + premise-re-examination directive + R-FAIL-3 state
    + spike/adversary response interface   + killing test M90-D2-T6 (must FIRE not narrate)
    + measurement sink (no-claim)
    + killing test M90-D1-T6 (R1 exit)
        │                                       │
        ▼  KILL GATE: M90-D1-T6 GREEN —          ▼  GATE: M90-D2-T6 GREEN — 3 same-signature
        │  trigger fires on divergent /          │  cycles HARD-HALT deterministically (exit-
        │  extend, silent on convergent,         │  state, not prose). RED = design defect →
        │  deterministically. RED → HALT for     │  STOP + escalate (non-converging-Red-Team
        │  R1 re-scope DOWN to factual-only      │  trap; do not keep patching).
        │  (D3 then carries the milestone).      │
        │  Wave 1 touches ONLY net-new files — no shared workflow contaminated if a gate fails.
        │
WAVE 2 — edit-in-place (gated on Wave 1 clearing). LOWEST RISK:
        ▼
  D3 factual-redesign (M90-D3)
    bin/gsd-t-research-gate.cjs (EDIT IN PLACE — M89 code on disk)
    + D3-T0 baseline-first known-answer test against CURRENT code (premise-grounding gate)
    + ASSERT the INTERNAL decision enumerates NO open category (internal only on own-repo path/anchor)
      — KEEP the vendor-upgrade list (premise-corrected; deleting it regresses HO-E1/E2/E5) (SC-NO-FINITE-LIST)
    + closed-internal + judge routing + time-anchored override (GUESSED:stale)
    + KEEP §7 fail-closed cite gate (SC-FAIL-CLOSED)
    + corpus + classifier test redesign (≥10 never-seen externals → judge, none silent-internal;
      held-out rows HO-E1/E2/E5 STILL → external→web [regression guard]; held-out generalization
      guard; test count ≥ ed03a8d baseline 1824/0 — SC-FACTUAL-PRESERVED)
        │
        ▼  GATE: M90-D3 suite green at ≥ baseline + the internal-side no-open-category test passes
        │  (≥10 never-seen externals → judge, none silent-internal) + HO-E1/E2/E5 still external→web.
        │
WAVE 3 — integrate seam (single-owner of ALL shared surfaces; nothing parallel-written):
        ▼
  D4 contract-doctrine-integrate (M90-D4) — serial T1→T2→T3→T4→T5→T6→T7
    T1 unproven-assumption-doctrine-contract.md v1.0.0 STABLE (§4 fail-closed / §5 self-obedience
       / §6 guard map; pins all 3 envelopes; absorbs auto-research v1.3.3) [Headline]
    T2 bin/gsd-t.js dispatch + PROJECT/GLOBAL_BIN_TOOLS + tier-policy fable entry
    T3 wire D-LOOP halt into gsd-t-debug.workflow.js (runtime-native, RUN in sandbox)
    T4 wire D-ARCH trigger (IFF M90-D1-T6 green) + D-FACTUAL classify into phase/execute/quick
    T5 gsd-t-verify.workflow.js FAILS on the 3 flagged states + triad prompts read them [Headline]
    T6 doc-ripple (CLAUDE-global doctrine, requirements, help, README, GSD-T-README, pkg 4.6.12→4.7.10
       — READ live version at execute; 4.6.12 is on disk, the old 4.6.11 literal is stale)
    T7 guard-map [RULE]→enforcement lint + tier-policy drift lint (SC-SELF-OBEDIENCE)
        │
        ▼
       VERIFY (triad + §4 fail-closed reads) → COMPLETE-MILESTONE → tag v4.7.10 (minor)
```

### M90 Wave Groupings

| Wave | Domains | Parallel? | Gate to next |
|------|---------|-----------|--------------|
| **W1** | D1 arch-trigger-response (M90-D1-T1..T6) · D2 loop-ledger-halt (M90-D2-T1..T6) | concurrent, file-disjoint (D1 = `bin/gsd-t-architectural-trigger.cjs` + `blind-adversary-subagent.md` + test + fixture; D2 = `bin/gsd-t-loop-ledger.cjs` + test — zero overlap) | **BOTH killing tests GREEN.** M90-D1-T6: trigger fires on divergent/extend, silent on convergent, deterministic — RED → HALT + R1 re-scope DOWN to factual-only. M90-D2-T6: 3 same-signature cycles HARD-HALT from exit-state — RED → STOP + escalate (design defect). |
| **W2** | D3 factual-redesign (M90-D3-T0..T5) | runs alone, gated on W1 clearing (edit-in-place island) | **D3 suite green at test count ≥ ed03a8d baseline (1824/0)** + the internal-side no-open-category test (≥10 never-seen externals → judge, none silent-internal) passes + held-out rows HO-E1/E2/E5 STILL classify `external→web` (vendor list KEPT — regression guard). If W1 R1-exited to factual-only, D3 CARRIES the milestone. |
| **W3** | D4 contract-doctrine-integrate (M90-D4-T1..T7) | runs alone, serial single-owner of ALL shared surfaces (gated on W1+W2 green) | all 7 D4 tasks complete + M71 + M85 lints green + the §4 fail-closed verify run FAILS on each seeded flagged state and PASSES when clear + the guard-map [RULE]→enforcement lint green. |

### M90 Cross-Domain Dependencies

| Consumer | Depends on | Via |
|----------|-----------|-----|
| D3 (all) | W1 GREEN (M90-D1-T6 + M90-D2-T6) — risk-first build order | gate; D3 reads the §1 envelope shape (pinned by the mechanisms contract), writes only its own classifier |
| D4-T1 doctrine contract | the FROZEN §1/§2/§3 signatures (M90-D1-T6, M90-D2-T6, M90-D3-T5) | pins the three envelope shapes verbatim; never edits producer source |
| D4-T2 dispatch | `bin/gsd-t-architectural-trigger.cjs` + `bin/gsd-t-loop-ledger.cjs` exist (W1) | dispatch cases + bin-tool arrays route to the modules |
| D4-T3 debug-wire | D2 frozen append-cycle/read-exit-state signature | inline `runCli` agent-Bash helper into `gsd-t-debug.workflow.js` |
| D4-T4 phase/worker-wire | D3 classifier (always) + D1 trigger (IFF M90-D1-T6 green; else factual-only per R1 re-scope) | inline `runCli` into `gsd-t-phase`/`gsd-t-execute`/`gsd-t-quick` |
| D4-T5 verify-fail-closed | §1 uncited-external marker (D3) + §2 proven-by-adversary-only flag (D1) + §3 halted-but-no-re-examination state (D2) | `gsd-t-verify.workflow.js` reads the 3 flagged states; FAILS on any |

### M90 Integrate-Time Seams (D4 single-owned — NOT cross-domain co-authored)

| Seam | File | Owner | Why no conflict |
|------|------|-------|-----------------|
| Doctrine contract + absorbed pointer | `.gsd-t/contracts/unproven-assumption-doctrine-contract.md`, `.gsd-t/contracts/auto-research-contract.md` | D4 (M90-D4-T1) | D4 is the sole writer; producers only READ the §1/§2/§3 envelope shapes. |
| CLI dispatch + bin-tool arrays + tier policy | `bin/gsd-t.js`, `bin/gsd-t-model-tier-policy.cjs` | D4 (M90-D4-T2) | single-owner; routes to D1/D2 modules (must exist first — W1 dep). |
| Debug-halt wire | `templates/workflows/gsd-t-debug.workflow.js` | D4 (M90-D4-T3) | single-owner; D2 owns NO workflow. |
| Trigger+classify wire | `templates/workflows/gsd-t-phase.workflow.js`, `gsd-t-execute.workflow.js`, `gsd-t-quick.workflow.js` | D4 (M90-D4-T4) | single-owner; D1/D3 own NO workflow. |
| Verify fail-closed + triad prompts | `templates/workflows/gsd-t-verify.workflow.js`, `red-team/qa/pre-mortem-subagent.md` | D4 (M90-D4-T5) | single-owner of every shared surface. |
| Doc ripple + version bump | `templates/CLAUDE-global.md`, `docs/requirements.md`, `commands/gsd-t-help.md`, `README.md`, `GSD-T-README.md`, `package.json` | D4 (M90-D4-T6) | single-owner; Document Ripple Completion Gate (live `~/.claude/CLAUDE.md` matched). |

### M90 Load-Bearing Serial Constraints

1. **W1 before W2 before W3.** D1/D2 are the prove-or-kill; D3 is gated on W1; D4 is gated on W1+W2. No shared workflow file is edited until D4 (W3).
2. **M90-D1-T6 governs the trigger wire (D4-T4).** If the architectural trigger cannot fire deterministically, the milestone re-scopes DOWN to factual-only — D4-T4 wires classify only, recorded in the contract (the doctrine applied to itself — SC-SELF-OBEDIENCE).
3. **Non-converging gate = escalate, never patch.** If D2's halt won't fire, or any W1 killing test spawns variant-after-variant (>2 cycles same signature), that IS the M90 pathology — STOP + escalate, do not keep patching.
4. **Workflow edits stay sandbox-clean (D4).** No `require`/`fs`/`process`; `args` is a JSON STRING; CLI via the inline `runCli` agent-Bash helper. M71 + M85 lints stay green; each edited workflow RUNS to completion in the sandbox (not `node --check`).
5. **Producers freeze signatures at W1/W2 close.** D4 wires against the frozen §1/§2/§3 envelopes; a post-freeze change breaks the integrate seam (contract violation).

### M90 File-Disjointness (validated via `gsd-t parallel --dry-run` + per-task Touches scan — 29 distinct owned files, zero cross-domain overlap)

| Domain | Files Owned |
|--------|-------------|
| D1 arch-trigger-response | `bin/gsd-t-architectural-trigger.cjs`, `templates/prompts/blind-adversary-subagent.md`, `test/m90-architectural-trigger.test.js`, `test/fixtures/m90-arch-divergence-corpus.json` |
| D2 loop-ledger-halt | `bin/gsd-t-loop-ledger.cjs`, `test/m90-loop-ledger-halt.test.js` |
| D3 factual-redesign | `bin/gsd-t-research-gate.cjs`, `test/m89-research-classifier-corpus.test.js`, `test/fixtures/m89-labeled-corpus.json` |
| D4 contract-doctrine-integrate | `.gsd-t/contracts/unproven-assumption-doctrine-contract.md`, `.gsd-t/contracts/auto-research-contract.md`, `templates/workflows/gsd-t-debug.workflow.js`, `templates/workflows/gsd-t-execute.workflow.js`, `templates/workflows/gsd-t-phase.workflow.js`, `templates/workflows/gsd-t-quick.workflow.js`, `templates/workflows/gsd-t-verify.workflow.js`, `bin/gsd-t.js`, `bin/gsd-t-model-tier-policy.cjs`, `templates/prompts/red-team-subagent.md`, `templates/prompts/qa-subagent.md`, `templates/prompts/pre-mortem-subagent.md`, `templates/CLAUDE-global.md`, `docs/requirements.md`, `commands/gsd-t-help.md`, `README.md`, `GSD-T-README.md`, `package.json`, `test/m90-guardmap-rule-traceability.test.js`, `test/m90-tier-policy-lint.test.js` |

D1/D4 split `templates/prompts/` — D1 owns `blind-adversary-subagent.md` only; D4 owns the three triad prompts. No file appears in two Files-Owned blocks.

### M90 Acceptance-Criteria → Domain Map

| Success criterion | Owner | Killing test |
|----|-------|--------------|
| SC-ARCH-TRIGGER (trigger fires on unproven architectural premise) | D1 | M90-D1-T6 — divergent→fire / convergent→silent / extend→fire, deterministic; RED → R1 re-scope DOWN |
| SC-LOOP-HOOK-FIRES (3rd same-signature cycle HARD-HALTS, not narrated) | D2 | M90-D2-T6 — 3-cycle halt from exit-state + variant-B increment + directive + R-FAIL-3 state |
| SC-NO-FINITE-LIST (INTERNAL decision enumerates no open category; ≥10 never-seen externals → judge) | D3 | M90-D3-T0/T1 + M90-D3-T5 — internal-side no-open-category assertion (vendor list KEPT as external→web upgrade; HO-E1/E2/E5 still external→web) |
| SC-FACTUAL-PRESERVED (classifier green at ≥ ed03a8d baseline 1824/0) | D3 | M90-D3-T5 — suite ≥ baseline, held-out guard retained |
| SC-FAIL-CLOSED (verify FAILS on uncited / proven-by-adversary-only / halted-but-no-re-examination) | D4 | M90-D4-T5 — seeded-state verify run FAILS each, PASSES when clear |
| SC-RESEARCH-GATE (sourced approach with ≥1 citation per mechanism) | DISCUSS (banked) | `.gsd-t/discuss/M90-approach-sourced.md` — satisfied at discuss; D4-T1 absorbs into the contract |
| SC-SELF-OBEDIENCE (doctrine enforced on M90's own artifacts) | D4 | M90-D4-T7 — guard-map [RULE]→enforcement lint + tier-policy drift lint |

### M90 Abbreviation Key

| Abbrev | Domain | Wave |
|--------|--------|------|
| D1 | arch-trigger-response (was DA) | 1 (prove-or-kill) |
| D2 | loop-ledger-halt (was DL) | 1 (prove-or-kill) |
| D3 | factual-redesign (was DF) | 2 (edit-in-place) |
| D4 | contract-doctrine-integrate (was DC) | 3 (integrate seam) |

---

## Prior State: M89 — Auto-Research: KNOWN-vs-GUESSED per-claim verification at every workflow phase + in conversation (RE-DEFINED 2026-06-18 — premise corrected after plan pre-mortem cycle-2 / 2 CRITICALs; re-plan next; risk-first, 4 file-disjoint domains, 2 waves; Wave 1 = D1 prove-or-kill A1 classifier + D2 contract/stage concurrent; Wave 2 = D3 upper-phase+verify + D4 worker-workflows, gated on A1 GREEN). M87 PAUSED for M89 (user-prioritized 2026-06-18). M89 active.

### M89 Premise correction (cycle-2 rethink)
The original "deterministic trigger that DETECTS a gap and REPLACES LLM should-I-research discretion" overclaimed — **detecting you need info is itself a judgment**. Re-scoped: M89 = **deterministic CLASSIFY (§1) + cite-or-fail ENFORCE (§5/§7) wrapped around an LLM-PROMPTED DETECT step (§6.5 Stated Claims)**. Unit of work = a load-bearing CLAIM, not "a gap": the agent tags each claim KNOWN vs GUESSED (three guess-types: unknown / assumed / stale, §1.3). Determinism lives in CLASSIFY + ENFORCE, not DETECT. Cycle-2 CRITICALs fold in as the §6.5 DETECT/Stated-Claims seam (SC2) + the §7 external-claim MARKER so ENFORCE can fire even on a never-cited guess (SC4/A5).

### M89 Seam contract
`.gsd-t/contracts/auto-research-contract.md` **v1.2.0 STABLE (premise-corrected)** — the SINGLE seam between the classifier (D1) and the wiring domains (D3/D4): §1 classifier JSON envelope (input = a GUESSED CLAIM; §1.1 FEATURE-CLASS heuristic + the proper-noun-LESS-external-assertion rule; §1.3 the three guess-types unknown/assumed/stale), §2 research `agent()` stage interface (bare `model:"fable"`), §3 Verified-Facts cite-block (URL + DATE, date load-bearing for staleness), §4 idempotency (§4.1 exact normalized-claim-key "covers"), §5 no-silent-guess (A3 routing-decision + sole-web-stage enforcement; §5.1 ambiguous→grep→escalate owned by D3/D4), **§6.5 the DETECT Stated-Claims seam (LLM-prompted)**, **§7 the ENFORCE marker (classify-time write, cite-time flip; verify FAILs on `status=uncited`)**, §6 the 13-SEEN + 8-HELD-OUT labeled-corpus oracle (A1, incl. proper-noun-less HO-E4 + symbol-only HO-I4). **v1.2.0 (2026-06-18) — premise correction; v1.1.0 findings #1/#2/#3/#5 carried (Changelog in the contract).** D1 PRODUCES the classifier matching §1; D3/D4 CONSUME the envelope SHAPE + stage interface + Stated-Claims snippet + marker format inline, never D1's internals. D2 OWNS every shared doc-ripple surface (CLAUDE-global.md, bin/gsd-t.js, commands/gsd-t-help.md, package.json, docs/requirements.md) — integrate-conflict-free by construction.

**Plan-hardening correction (M89 plan):** §2's model form was `overrides["research"] ?? "<literal>"` — this FAILS the live M85 lint (`test/m85-workflow-tier-policy-lint.test.js`): the `??`-form bracket key must be one of the 6 injectable designated stages, and `research` is not one (no `research` key in `bin/gsd-t-model-tier-policy.cjs`). **Corrected to a BARE literal `model: "fable"`** (passes the lint's tier-set membership check; mirrors how non-designated stages already declare models, e.g. `gsd-t-execute.workflow.js:172`). D2-T1 records the §2 correction; D3-T1/D4-T1/D4-T2 wire the bare-`fable` literal.

### M89 Wave Plan (risk-first — prove-or-kill before wiring)

```
WAVE 1 — D1 (prove-or-kill, LOAD-BEARING) + D2 (contract/stage/doc-ripple), CONCURRENT + file-disjoint:
  D1 research-classifier-core          D2 research-stage-and-contract
    bin/gsd-t-research-gate.cjs           auto-research-contract.md (the seam) v1.2.0
    (input = a GUESSED CLAIM)             + research-subagent.md (facts = URL+DATE)
    + 13-SEEN labeled corpus              + stated-claims-snippet.md (§6.5 DETECT, NEW)
    + 8-HELD-OUT corpus (incl.            + cite-format + idempotency test
      proper-noun-less HO-E4 +              (incl. negative: distinct claim-key
      symbol-only HO-I4)                     ≠ skip — finding #2)
    + A1 killing test (M89-D1-T3:         + SHARED doc-ripple (CLAUDE-global known/guessed
      seen+held-out+bad-input)              trigger + SC6 conv-directive, gsd-t.js, help,
                                            package.json, docs/requirements.md)
        │
        ▼  KILL GATE: A1 (M89-D1-T3) MUST pass — every one of the 13 SEEN +
        │  8 HELD-OUT hand-labels matched deterministically by FEATURE CLASS
        │  (finding #1 + premise: proper-noun-less HO-E4 → external, symbol-only
        │  HO-I4 → internal; a keyword-memorized classifier fails held-out) +
        │  bad-input boundary (finding #6). A mislabel FAILS → HALT M89 + re-scope.
        │  Wave 1 touches ONLY net-new files + D2's single-owned shared surfaces —
        │  if A1 fails, NO workflow file is contaminated (none edited yet).
        │
WAVE 2 — D3 + D4, file-disjoint (one-domain-per-workflow-file), START ONLY AFTER A1 GREEN:
      ├──────────────────────────────────┬────────────────────────────────────┐
      ▼                                   ▼
  D3 wiring-upper-phase-and-gate      D4 wiring-worker-workflows
    gsd-t-phase.workflow.js             gsd-t-{execute,quick,debug}.workflow.js
    (6 stages: Stated-Claims §6.5 →     (Stated-Claims §6.5 → classify → §7 marker
     classify → §7 marker write →        write→research→flip; wave = NOTHING, 0 model:)
     research → flip; ambiguous-         + A3 routing-decision test (internal claim) +
     escalate §5.1)                       sole-web-stage enforcement (finding #5)
    gsd-t-verify.workflow.js            + ambiguous-escalate §5.1 (finding #3)
    (§7 ENFORCE marker gate:            + runtime state-change proof (marker+facts,
     status=uncited → FAIL)               D4-T4, finding #7)
    + phase-research-wiring test
    + E2E dogfood (D3-T4, A5 — Stated-
      Claims→classify→marker→gate FAIL
      →research-stub→cite+flip→gate
      PASS, offline)
    + runtime state-change (D3-T5, #7)

  D3/D4 are write-disjoint (6 workflow files split 2/4, zero overlap) + depend on A1 only,
  not each other. Both CONSUME the D1 classifier + D2 contract inline.

                GATE: A1 passed + both wave-2 domains complete
                              │
                              ▼
       INTEGRATE (D2 single-owned shared surfaces already merged) → VERIFY → COMPLETE-MILESTONE
       patch bump (D2-T5) → tag
```

### M89 Wave Groupings

| Wave | Domains | Parallel? | Gate to next |
|------|---------|-----------|--------------|
| **W1** | D1 research-classifier-core (T1–T4, + held-out fixture) · D2 research-stage-and-contract (T1, T2, T2b, T3–T5) | concurrent, file-disjoint (D1 = net-new bin+test+2 fixtures incl. 8-item held-out; D2 = contract v1.2.0 + research-subagent + Stated-Claims snippet + test + shared doc-ripple incl. docs/requirements.md) | **A1 (M89-D1-T3) GREEN** — all 13 SEEN + 8 HELD-OUT hand-labels matched deterministically (feature-class generalization incl. proper-noun-less HO-E4 + symbol-only HO-I4) + bad-input boundary (finding #6). A1 fails → HALT + re-scope. |
| **W2** | D3 wiring-upper-phase-and-gate (T1–T5: Stated-Claims+classify+§7 marker wiring, §7 ENFORCE gate, E2E dogfood T4, runtime state-change T5) · D4 wiring-worker-workflows (T1–T4: Stated-Claims+classify+§7 marker wiring in execute/quick/debug, runtime state-change T4) | concurrent, write-disjoint (D3 = phase+verify+e2e; D4 = execute/debug/quick/wave) — both depend on A1 only | both wave-2 domains complete + the E2E dogfood (marker flip + gate FAIL-then-PASS) green + M71 + M85 lints green (incl. wave-zero-`model:` + debug-cycle-ternary). |

### M89 Integrate-Time Seams (D2 single-owned — NOT cross-domain co-authored)

| Seam | File | Owner | Why no conflict |
|------|------|-------|-----------------|
| Research Policy replacement (known/guessed trigger + SC6 conv-directive) | `templates/CLAUDE-global.md` | D2 (M89-D2-T4) | D2 is the SOLE writer; D3/D4 must not touch it. |
| CLI dispatch + `PROJECT_BIN_TOOLS` | `bin/gsd-t.js` | D2 (M89-D2-T4) | single-owner; routes to D1's `gsd-t-research-gate.cjs` (which must exist first — dep on M89-D1-T2). |
| help line | `commands/gsd-t-help.md` | D2 (M89-D2-T4) | single-owner. |
| requirements M89 entry (SC5/A6) | `docs/requirements.md` | D2 (M89-D2-T4) | single-owner; Document Ripple gate (cycle-2 MED #4). |
| version bump | `package.json` | D2 (M89-D2-T5) | single-owner of the manifest for M89. |

### M89 Cross-Domain Dependencies

| Consumer | Depends on | Via |
|----------|-----------|-----|
| D2-T4 dispatch | D1-T2 `bin/gsd-t-research-gate.cjs` exists | dispatch routes to the module |
| D3 (all) | D1 A1 GREEN (gate) + D1 classifier + D2 §1/§1.3/§2/§3/§4.1/§5.1/§6.5/§7 + D2 `research-subagent.md` + `stated-claims-snippet.md` | inline `runCli` + Read-at-spawn prompts; D3 owns the Stated-Claims wiring, the §7 marker WRITE/flip + verify gate, the ambiguous→grep→escalate step (§5.1), the E2E dogfood test |
| D4 (all) | D1 A1 GREEN (gate) + D1 classifier + D2 §1/§1.3/§2/§3/§4.1/§5/§5.1/§6.5/§7 + D2 `research-subagent.md` + `stated-claims-snippet.md` | inline `runCli` + Read-at-spawn prompts; D4 owns the Stated-Claims wiring + §7 marker write/flip in execute/debug/quick, the ambiguous→grep→escalate step (§5.1), the sole-web-stage A3 enforcement |

---

## Prior State: M87 — Intention-First PseudoCode as Milestone Source-of-Truth (PLANNED + RE-SCOPED — risk-first, 4 file-disjoint domains, 2 waves; Wave 1 = prove-or-kill A1; Wave 2 gated on A1; M83 traceability-gate PASSES all 4 domains, 0 violations). **Cycle-4 split (2026-06-17):** the deterministic core stays in M87 (A1 guard-bridge gate, A2 section-coverage + the folded gate-scoping fix, A4 ripple drift lint, A6 regression bar + A7 derived-id stability); the soft-AC halves that resist deterministic gating moved to **M88** (backlog #35): A3 deterministic sign-off STATE/gate, the A1 map-GENERATION path, the A5 triad-consumption seam (M87-INT-T1 — descoped), and the SC4 divergence-grammar round-trip. D3 still ships the two-altitude FLOW + keep-or-supersede PROMPT here.

### Seam contract
`.gsd-t/contracts/pseudocode-source-of-truth-contract.md` v1.1.5 STABLE — the SINGLE source of all grammars (guard-map §2, section-citation §3, divergence §4, ripple-points §5, **discovery convention §7**). Authored at partition (D4-T0); §2 reconciled to the real binvoice corpus across the plan-phase pre-mortem fix (v1.1.0 dual grammar) and the re-plan re-validation (v1.1.1: hard count = 13, non-anchored inline marker); §3 reconciled (v1.1.2: citable-section source = `##` headings outside Appendix fences, PayPal=10/Extension=10 floor, deterministic GitHub-style slug §3.2, D2 non-vacuity floor + citation-resolution §3.3; §6/A5 wired to task M87-INT-T1). v1.1.4 records the M87/M88 split: §4 (divergence parse/format round-trip) and §6 (A5 triad-consumption seam) are annotated **M88** (their deterministic obligation moved); the GRAMMAR DEFINITIONS stay — they remain the spec. **v1.1.5 — post-split reachability/non-vacuity fixes (2 HIGH + 1 MED):** NEW **§7 discovery convention** (docs at `.gsd-t/pseudocode/PseudoCode-[Title].md` + co-located `.map.json`; verify globs `PseudoCode-*.md` multi-doc, FIREs on a doc+map pair, logs a skip-WITH-REASON otherwise — never silent) closes the dead-code class; **§2 clarification** — the gate keys on the DOC's derived id set (an absent map entry = unbacked → exit 4), no map-side vacuous pass. D1/D2/D3 consume it; no domain re-derives a grammar. A grammar change is a contract version bump + coordinated cross-domain edit.

### M87 Wave Plan (risk-first — prove-or-kill before scaffolding)

```
WAVE 1 — guard-bridge-spike ALONE (LOAD-BEARING, PROVE-OR-KILL):
  D1 guard-bridge-spike
      │  Proves A1: a prose [RULE] guard map → a deterministic verify gate where
      │  divergence is a non-vacuous FAILURE, ZERO LLM judgment in pass/fail.
      │  Builds NEW bin/gsd-t-guard-map.cjs (zero-dep, never-throws, pure;
      │  exits 0 backed / 4 divergence-RULE-ID-named / 64 bad-input),
      │  the A1 falsifiable harness (faithful exemplar → exit 0; doctored
      │  one-rule variant → exit non-zero, RULE-ID named — both deterministic),
      │  binvoice fixtures (PayPal faithful + doctored, Extension faithful),
      │  and wires the gate into gsd-t-verify.workflow.js (M71 sandbox-clean,
      │  M85 tier `haiku`, FAIL-blocking, BEFORE the triad) with §7 discovery
      │  (glob .gsd-t/pseudocode/PseudoCode-*.md + co-located .map.json).
      │  M87-D1-T5 is the FIRING/reachability test (gate fires + halts on a
      │  doctored map + logs a DISTINCT skip when absent) — closes the dead-code
      │  class; M87-D1-T3 adds map-side non-vacuity (absent map id = exit 4).
      │
      ▼  KILL GATE: M87-D1-T3 (A1) MUST pass. If A1 cannot be made
      │  deterministic → HALT the milestone + escalate for re-scope.
      │  Wave 1 touches ONLY new files + the one workflow it owns — if A1
      │  fails, NO existing brain is contaminated.
      │
WAVE 2 — three domains, file-disjoint, START ONLY AFTER A1 PASSES:
      ├──────────────────────┬──────────────────────────┐
      ▼                      ▼                          ▼
  D2 traceability-       D3 milestone-two-          D4 template-docripple-
     section-coverage       altitude-flow              contract
  EXTENDS M83            commands/gsd-t-milestone   templates/PseudoCode-spec.md
  bin/gsd-t-             .md + gsd-t-phase.work-    + doc-ripple ripple-set edit
  traceability-gate.cjs  flow.js milestone branch   (ripple point 3 of 4)
  (section-citation      ship the two-altitude      + A4 drift lint verifying
  coverage, struct/      FLOW + keep-or-supersede   ALL FOUR ripple points.
  path-as-path) + A2     PROMPT (PROSE/PROTOCOL).   Contract (D4-T0) already
  planted-gap test       Deterministic sign-off     on disk from partition.
  + FOLDED gate-scoping  GATE (A3) → M88.
  fix (--milestone M87   Wires D2's documented
  → exactly 4 domains)   altitude shift into the
  + scoping test.        solution-space probe.
  Owns the competition-
  altitude design note.

  D2/D3/D4 are write-disjoint (10 distinct owned files across the three; 18
  across all four domains incl. D1, zero overlap) and run concurrently once A1
  is green. None depends on the others' code:
    - D2 CONSUMES D1's gsd-t-guard-map.cjs JSON contract (never edits it).
    - D3 wires the altitude shift D2 only DOCUMENTS (in scope.md).
    - D4's contract is the seam all three already build against.

                GATE: A1 passed + all wave-2 domains complete
                              │
                              ▼
       INTEGRATE (serial seams) → VERIFY → COMPLETE-MILESTONE
       minor bump 4.6.12 → 4.7.10 → tag v4.7.10 (read live version at execute)
```

### M87 Wave Groupings

| Wave | Domains | Parallel? | Gate to next |
|------|---------|-----------|--------------|
| **W1** | D1 guard-bridge-spike (T1–T5, incl. §7-discovery wiring + the firing/reachability test) | runs ALONE (no wave-2 domain starts) | **A1 (M87-D1-T3) PASSES** — faithful exit 0 / doctored exit non-zero, RULE-ID named, deterministic. A1 fails → HALT + re-scope. |
| **W2** | D2 (T2–T5, incl. gate-scoping fix) · D3 (T1–T4, FLOW/protocol only) · D4 (T1–T3) | all 3 concurrent (write-disjoint, all depend on A1 only, not each other) | all wave-2 tasks complete + the partition-time wave-1 contributions (D2-T1 design note, D4-T0 contract) on disk |

### M87 Integrate-Time Seams (NOT parallel-written — serial at integrate, no domain owns)

| Seam | File | Why serial | Owning AC |
|------|------|------------|-----------|
| Living Documents table | `templates/CLAUDE-global.md` (~line 60) | shared file (file-disjointness invariant) | A4 ripple point 1 |
| Pre-Commit Gate | `templates/CLAUDE-global.md` | shared file | A4 ripple point 2 |
| project Living Documents ref | `CLAUDE.md` | shared file, co-owned at merge with D4's lint | A4 ripple point 4 |
| ~~verify-triad consumption (**M87-INT-T1**)~~ **→ MOVED TO M88** (backlog #35) | `templates/prompts/qa-subagent.md`, `templates/prompts/red-team-subagent.md` | A5 (the [RULE]-set → QA/Red-Team frames seam) is DESCOPED from M87 to M88, where it is redesigned as a DETERMINISTIC seam-check (prompt-presence of the structured ingest directive + a unit test feeding guard-map JSON), not a live triad run. NOT wired in M87 integrate. | ~~A5~~ → M88 |
| CLI dispatch + **dual bin-propagation** (**M87-INT-T2** — no domain owns) | `bin/gsd-t.js` | (a) shared dispatch table — adds `guard-map` subcommand routing to D1's module; (b) **adds `gsd-t-guard-map.cjs` to BOTH `GLOBAL_BIN_TOOLS` (→ `~/.claude/bin/`) AND `PROJECT_BIN_TOOLS` (→ each registered project's `bin/`)** — like every peer verify gate. Without this the gate's `runCli` global fallback resolves to a binary never propagated, so it silently no-ops in downstream projects (the exact use case). **Killing test:** `test/m87-guard-map-propagation.test.js` — run `node bin/gsd-t.js install` with **HOME redirected to a sandbox tmp dir** (the non-destructive `test/m86-installer-statusline-ctxcue.test.js` pattern: `mkdtempSync(realpathSync(os.tmpdir()))` + `env:{...process.env,HOME:sandbox}`, never the real `~`), then assert `<sandbox>/.claude/bin/gsd-t-guard-map.cjs` exists+readable AND membership in BOTH arrays; removal from either FAILS (mirrors M54). Per `project_global_bin_propagation_gap`. | A1 wiring / reachability |
| verify command invoker | `commands/gsd-t-verify.md` | shared command file; reflects the new guard-map gate step | A1 (A5 triad-consumption descoped to M88) |

The A4 drift lint (D4-T3) VERIFIES ripple points 1/2/4 POST-integration; D4 WRITES only point 3 (doc-ripple command).

### M87 Cross-Domain Interfaces

| Producer | Consumer | Interface |
|----------|----------|-----------|
| D4 `pseudocode-source-of-truth-contract.md` v1.1.5 STABLE | D1/D2/D3 | The partition-time seam — guard-map §2, section-citation §3, divergence §4 (round-trip → M88), ripple §5, discovery §7; all code against the contract, never re-derive |
| D1 `bin/gsd-t-guard-map.cjs` (`--doc --map --json`, exit 0/4/64, build→rule map) | D2 (rule-aware paths); the A5 triad-consumption seam moved to M88 | JSON contract: `{ rules: { "<RULE-ID>": { backedBy:[...], contradicted:bool } } }`; consumers read the JSON, never edit D1 source. **Gate keys on the DOC's derived id set (§2): an absent map entry = unbacked → exit 4 (no map-side vacuous pass).** Verify discovery per §7 (`.gsd-t/pseudocode/PseudoCode-*.md` + co-located `.map.json`). M87 proves the gate's DISCRIMINATION + reachability through verify (M87-D1-T5); the map-GENERATION path is M88. |
| D2 extended `bin/gsd-t-traceability-gate.cjs` (`**PseudoCode-Section**: <Title>#<anchor>` parse, path-as-path; `--domains` explicit milestone-scoping) | plan phase | section-coverage gap report (zero-citing-task section = structural gap), additive over M83 AC→(path+test); `--milestone M87 --domains <4>` scopes to exactly the 4 subject-named domains, no fall-back-to-all |
| D2 scope.md competition-altitude design note | D3 `gsd-t-phase.workflow.js` (integrate-time) | the documented decision D3 wires: solution-space probe shifts UP to high-level-approach altitude when behavior is spec'd; gate stays altitude-agnostic |
| D3 `keep-or-supersede-subagent.md` | milestone flow | per inherited shipped-code model, ASK keep/supersede (prose PROTOCOL); each supersede WRITES a `⚠ Divergence` flag (§4 shape) into the doc. The deterministic `parseDivergence()`/`formatDivergence()` round-trip is M88. |
| D4 `templates/PseudoCode-spec.md` | every future milestone | the shipped blank mold (both altitudes + all five section elements, anchored to binvoice exemplars per SC6) |

### M87 File-Disjointness (validated via `gsd-t parallel --dry-run` — 20 distinct owned files, zero cross-domain overlap)

| Domain | Files Owned |
|--------|-------------|
| D1 guard-bridge-spike | `bin/gsd-t-guard-map.cjs`, `test/m87-guard-map-bridge.test.js`, `test/m87-verify-guardmap-wiring.test.js`, `test/fixtures/m87/PseudoCode-PayPal.md`, `test/fixtures/m87/PseudoCode-Extension.md`, `test/fixtures/m87/PseudoCode-PayPal-doctored.md`, `test/fixtures/m87/PseudoCode-PayPal.map.json`, `test/fixtures/m87/PseudoCode-PayPal-doctored.map.json`, `templates/workflows/gsd-t-verify.workflow.js` |
| D2 traceability-section-coverage | `bin/gsd-t-traceability-gate.cjs`, `test/m87-traceability-section-coverage.test.js`, `test/m87-gate-milestone-scoping.test.js` |
| D3 milestone-two-altitude-flow | `commands/gsd-t-milestone.md`, `templates/workflows/gsd-t-phase.workflow.js`, `templates/prompts/keep-or-supersede-subagent.md`, `test/m87-milestone-flow.test.js` |
| D4 template-docripple-contract | `templates/PseudoCode-spec.md`, `commands/gsd-t-doc-ripple.md`, `.gsd-t/contracts/pseudocode-source-of-truth-contract.md`, `test/m87-docripple-presence-lint.test.js` |

D1 owns `gsd-t-verify.workflow.js`; D3 owns `gsd-t-phase.workflow.js` — DIFFERENT workflow files, no shared workflow. No file appears in two Files-Owned blocks.

### M87 Acceptance-Criteria → Domain Map

| AC | Owner | Killing test |
|----|-------|--------------|
| **A1** (kill-criterion — gate DISCRIMINATION; map-GENERATION → M88) | D1 | M87-D1-T3 — faithful map exit 0 / doctored map exit non-zero, RULE-ID named, deterministic; **+ map-side non-vacuity: a map MISSING a doc-derived id (key absent) → exit 4 (doc-keyed iteration)** |
| **Verify-pipeline reachability** (gate FIRES + halts-on-divergence + distinct skip; closes the dead-code class) | D1 | M87-D1-T5 (`test/m87-verify-guardmap-wiring.test.js`) — **CONSTRUCTS its own multi-doc fixture tree** (≥2 fire-able doc+map pairs + doc-no-map + zero-docs, in a redirected temp dir; D1-T1 supplies only ONE fire pair so the multi-doc assertion can't be proven against it) → enumerates §7 doc+map set and FIREs on **ALL** pairs (count ≥2, non-vacuous), resolves `--doc`/`--map`, HALTS before triad on a doctored map, proceeds on faithful, logs a DISTINCT skip-with-reason (`no-build-map` / `no-pseudocode-docs`) when absent |
| A2 (section-coverage gap) | D2 | M87-D2-T3 — planted gap detected structurally; substring mention insufficient |
| A2 (gate-scoping — folded cycle-4 MEDIUM) | D2 | M87-D2-T5 (`test/m87-gate-milestone-scoping.test.js`) — `--milestone M87 --domains <4>` scopes to exactly the 4 M87 domains, zero historical; missing `--domains` + zero prefix-match → exit 64 |
| A4 (ripple-presence drift lint, 4 points) | D4 | M87-D4-T3 — passes when all four present, FAILS when any one removed |
| A6 (regression: suite green + M71 + M85 lints) | D1+D3 (workflow edits) | `test/m71-workflow-runtime-native-lint.test.js`, `test/m85-workflow-tier-policy-lint.test.js` stay green |
| A7 (derived-id stability — folded cycle-4 LOW) | D1 | M87-D1-T3 — faithful-map keyset GENERATED programmatically from the parser's derived ids == the keyset asserted; a re-copied fixture reflows doc ids + map keyset together |
| ~~A3~~ → **M88** (deterministic sign-off STATE/predicate) | — | descoped: no milestone-state artifact exists yet; M88 designs the marker + `isDefined(milestone)`. M87's D3 ships only the prose FLOW + PROMPT. |
| ~~A5~~ → **M88** (verify-triad consumption as a deterministic seam-check) | — | descoped: M88 reframes it as prompt-presence + a unit test feeding guard-map JSON (not a live triad run). |
| (SC4 deterministic half) → **M88** (`parseDivergence()`/`formatDivergence()` round-trip) | — | descoped: M88 builds the grammar round-trip; M87's D3 keeps the keep-or-supersede ASK + flag-writing as prose protocol. |

### M87 Load-Bearing Serial Constraints

1. **A1 before all of wave 2.** D1 runs ALONE; no wave-2 domain begins until M87-D1-T3 passes. A1 fails → HALT + escalate (no papering over — `feedback_coverage_check_structural_not_substring`).
2. **Coverage-check Red-Team convergence guard (D2).** If the Red Team on the section-coverage check does NOT converge in ≤2 cycles (each fix spawning a variant), that is a DESIGN DEFECT → STOP + escalate, do not keep patching (the known non-converging trap).
3. **Integrate seams serial, after wave 2.** `templates/CLAUDE-global.md` ×2, project `CLAUDE.md`, `bin/gsd-t.js` dispatch + dual bin-propagation (M87-INT-T2), `commands/gsd-t-verify.md` are wired serially at integrate — never parallel-written. The A4 lint then verifies all four ripple points post-merge. (The verify-triad-prompt seam M87-INT-T1/A5 moved to M88 — not wired in M87.)
4. **Workflow edits stay sandbox-clean (D1, D3).** No `require`/`fs`/`process`; `args` is a JSON STRING; CLI calls via the `runCli` inline-agent helper. M85 tier literals policy-conformant. M71 + M85 lints stay green (A6).

### M87 Abbreviation Key

| Abbrev | Domain | Wave |
|--------|--------|------|
| D1 | guard-bridge-spike | 1 (alone, prove-or-kill) |
| D2 | traceability-section-coverage | 2 |
| D3 | milestone-two-altitude-flow | 2 |
| D4 | template-docripple-contract | 2 |

---

## Prior State: M86 — Model Profiles (standard/pro/premium tier-spend switch) (EXECUTED + INTEGRATED — 4/4 domains complete, 1 wave; checkpoints CP1–CP4 verified at integrate; full suite 1572/0; verify next).

### M86 Wave Plan

```
Wave 1 (single wave — all 4 domains file-disjoint, 23 distinct owned files, zero overlap):

  D1 m86-d1-policy-profiles-config-cli   ── SEAM PRODUCER (medium-risk core behind a stable
      │                                      resolver envelope). Owns bin/gsd-t-model-tier-policy.cjs
      │                                      (PROFILE_STAGE_TIERS + resolveProfile), NEW
      │                                      bin/gsd-t-model-profile.cjs (config + CLI),
      │                                      bin/gsd-t.js (dispatch + dual bin-propagation),
      │                                      model-tier-policy-contract.md (→v1.1.0 additive),
      │                                      test/m86-policy-profiles.test.js. Promotes the DRAFT
      │                                      seam model-profile-config-contract.md → STABLE.
      │   publishes: `gsd-t model-profile resolve --profile <p> [stage] --json`
      │              → { ok, profile, overrides:{stage:modelId}, requiresThinkingOmitted? }
      │
      ├──────────────┬───────────────────┬──────────────────────┐
      ▼              ▼                   ▼                      ▼
  D2 invoker+     D3 drift-lint        D4 surfacing+docs    (consume D1's published seam —
  workflow `??`   unwrap-guard         (banner/statusline    code against the contract, not
  forms           (SAFETY NET)         /status/README/CLAUDE  D1's internals)
  (TD-113         (test/ only,         /package.json bump)
  QUARANTINE)     write-disjoint
                  from D2)
```

D2/D3/D4 all CONSUME D1's published resolver surface; none depends on the others. Although the
four are file-disjoint (1 wave for parallel execution), there is a CONTENT seam: D1 must land its
resolver + the published `overrides` shape before D2's invokers can inject and D3's lint can
validate against the v1.1.0 policy. Execute treats D1 as the contract-first seam (mirroring M85);
the file-disjointness oracle clears all 4 to run concurrently with D1's contract published first.

### M86 Cross-Domain Interfaces

| Producer | Consumer | Interface |
|----------|----------|-----------|
| D1 `gsd-t model-profile resolve --json` | D2 invokers | `overrides` map (stage → concrete model id) injected into the workflow via `args` (M69 invoke-time injection) |
| D1 `PROFILE_STAGE_TIERS` + `MODEL_IDS` | D3 lint | The tier set + designated-stage policy the lint validates each `??`-form fallback literal against |
| D2 workflow `??` forms (`model: overrides["x"] ?? "<premium-literal>"`) | D3 lint | The exact shape D3's extractor UNWRAPS read-only (D3 never writes D2's files — independent verification) |
| D1 config-read / resolver | D4 banner/statusline/status | The named active profile (global-default named when config absent — SC(f)) |
| `model-profile-config-contract.md` (DRAFT→STABLE) | D2/D3/D4 | The partition-time seam; D1 owns it, all consumers code against the envelope, not internals |
| `model-tier-policy-contract.md` v1.1.0 | all 4 | Additive over M85 v1.0.0 STABLE constants (unchanged); folds in the profile dimension + `??`-form lint obligation |

### M86 Checkpoints

- **M86-CP1** (D1 seam): `gsd-t model-profile resolve --profile premium --json` emits a well-formed
  `overrides` map; `test/m86-policy-profiles.test.js` green (headline census per profile);
  contract is v1.1.0 + DRAFT seam promoted STABLE; `gsd-t-model-profile.cjs` in BOTH bin-tool arrays.
- **M86-CP2** (D2 wired): the 3 designated-stage workflows carry the exact `??` forms; the wave
  workflow FORWARDS `overrides` to its verify/execute sub-calls; ALL 10 workflow-invoking commands
  (partition/plan/milestone/impact/prd/design-decompose/doc-ripple/verify/debug/wave) inject
  `overrides` via args (`test/m86-invoker-injection.test.js` green — pre-mortem r1 #1); a
  real-sandbox run per profile shows the correct fable-stage census on EVERY entry point incl.
  plan, milestone, and wave-composed verify (SC(a)).
- **M86-CP3** (D3 guard): the unwrap lint passes on D2's real workflows, validating bracket KEY
  (vs policy stageKeys) + fallback, flat AND combined-debug forms; all 7 negatives (+fail-closed,
  +combined-form positive) behave as designed (SC(c)) — pre-mortem r1 #2/#6.
- **M86-CP4** (D4 surfaced + docs): banner/statusline/status NAME the active profile (SC(f),
  `test/m86-surfacing.test.js` green); full doc-ripple complete; package.json 4.4.10 → 4.5.10.

### M86 Acceptance-Criteria → Domain Map

| AC | Owner(s) | Killing test |
|----|----------|--------------|
| (a) profile→spend real-sandbox | D1 (mapping) + D2 (`??`+injection) | D2-T7 live model census |
| (b) override beats profile live | D1 (precedence) + D2 (injection) | D1-T5 precedence case + D2-T7 live override |
| (c) lint bites both forms | D3 | D3-T3 negatives (drifted-bare, drifted-fallback, out-of-tier) |
| (d) per-project divergence | D1 (config-read) | D1-T5 absent/per-project (live 2-project = verify) |
| (e) resolver consumed at invoke time | D2 (args injection) | D2-T7 `overrides`-visible-in-args |
| (f) no silent degradation | D1 (named default) + D4 (surfacing) | D1-T5 named-default + D4 `test/m86-surfacing.test.js` |
| (g) M85 partition-probe fable | ALREADY SATISFIED (banked 2026-06-10 18:27, ledger 6/6) | — (re-confirmed incidentally by D2-T7 premium partition) |

Invariants held in the plan: competition producers stay bare `model: "opus"` in ALL profiles
(M82 blindness); the premium literal stays the lint-guarded `??` fallback; NO tracked-file mutation
on profile switch (invoke-time injection via args, M69); workflows stay runtime-native (no
require/fs — TD-113).

---

## Prior State: M85 — Model-Tier Policy (single source of truth) + Fable 5 Integration (4 domains, 2 waves). See `.gsd-t/contracts/m85-integration-points.md`.

## Prior State: Milestone 41 — Universal Token Capture Across GSD-T (PARTITIONED — 5 domains)

## M41 Dependency Graph

```
Wave 1 (foundation — no external blockers):
  D1 token-capture-wrapper
      │   (exports captureSpawn + recordSpawnRow from bin/gsd-t-token-capture.cjs)
      │   (reuses schema v1 from M40 D4 aggregator)
      │
      ▼
Wave 2 (unlocked by D1 landed + tested):
  D2 command-file-doc-ripple ─── rewrites all 20 command files + canonical block
                                 in templates/CLAUDE-global.md and CLAUDE.md

  D3 historical-backfill       ─── bin/gsd-t-token-backfill.cjs +
                                 `gsd-t backfill-tokens` CLI subcommand
                                 reads .gsd-t/events/*.jsonl + .gsd-t/headless-*.log

  D2 and D3 ship in parallel — both depend on D1 only, not on each other.

      │
      ▼
Wave 3 (unlocked by D2 + D3 landed):
  D4 token-dashboard           ─── bin/gsd-t-token-dashboard.cjs +
                                 `gsd-t tokens` CLI + status-tail injection

  D5 enforcement               ─── bin/gsd-t-capture-lint.cjs + opt-in pre-commit
                                 hook + CLAUDE MUST rule

  D4 and D5 ship in parallel — D4 renders, D5 protects. Neither depends on the other.

                GATE: all waves complete
                              │
                              ▼
       VERIFY → COMPLETE-MILESTONE → tag v3.15.10
```

### Abbreviation Key

| Abbrev | Domain |
|--------|--------|
| D1 | d1-token-capture-wrapper |
| D2 | d2-command-file-doc-ripple |
| D3 | d3-historical-backfill |
| D4 | d4-token-dashboard |
| D5 | d5-enforcement |

### Checkpoints

- **M41-CP1** (Wave 1 complete): `bin/gsd-t-token-capture.cjs` loads; `captureSpawn` + `recordSpawnRow` exported; 12+ unit tests green; full suite at baseline+N.
- **M41-CP2** (Wave 2 complete): every command file spawn site goes through the wrapper; no `| N/A |` rows left in canonical templates; `gsd-t backfill-tokens --dry-run` reports real parsed-envelope count > 0 on this project.
- **M41-CP3** (Wave 3 complete): `gsd-t tokens` prints live + backfilled totals; `gsd-t status` shows the two-line token block; `gsd-t capture-lint --all` exits 0 on main; CLAUDE files carry the new MUST rule.

### Cross-Domain Interfaces

| Producer | Consumer | Interface |
|----------|----------|-----------|
| D1 `recordSpawnRow` | D2 command files | Function call in a `node -e "..."` block inside each command's observability section |
| D1 JSONL schema v1 | D3 backfill | Same record shape, with added optional `source: "backfill" \| "live"` field |
| D1 JSONL schema v1 | D4 dashboard | Streaming line-by-line read, in-memory aggregation |
| D2 converted command files | D5 linter | Wrapped spawn sites are the "clean" state the linter checks for |
| M40 D4 aggregator | D1 + D3 | `scripts/gsd-t-token-aggregator.js` envelope-parse helpers — both reuse |
| M40 D5 stream-feed UI | D4 dashboard | Shared `humanizeTokens` + `formatCost` formatters for consistent rendering |

### Contracts Referenced (no new contracts in M41 — reuses M40 shapes)

| Contract | Source | M41 consumers |
|----------|--------|---------------|
| `metrics-schema-contract.md` | M40 D4 | D1 (write), D3 (write + backfill extension), D4 (read) |
| `stream-json-sink-contract.md` v1.1.0 | M40 D1 | D1 (envelope parsing), D3 (log archive parsing) |
| `completion-signal-contract.md` | M40 D3 | not directly consumed — M41 observes spawns that already terminated |

No new contract files are added by M41. The existing schema v1 remains the source of truth; M41 just fills in the data.

---

## Must-Read List (Assumption Audit Category 3 — Black Box)

Every M41 domain MUST read these before treating them as correct:

| File | Why |
|------|-----|
| `scripts/gsd-t-token-aggregator.js` (M40 D4) | Assistant-frame-vs-result-frame usage precedence; D1 + D3 reuse these helpers |
| `.gsd-t/contracts/metrics-schema-contract.md` | Schema v1 record shape |
| `.gsd-t/contracts/stream-json-sink-contract.md` v1.1.0 | Which frames carry authoritative usage |
| `bin/gsd-t-token-capture.cjs` (D1 output) | The wrapper is the source of truth for row formatting — D2, D3, D4 all depend on it |
| `scripts/gsd-t-stream-feed.html` (M40 D5) | `humanizeTokens` + `formatCost` — D4 must match |

## External Reference Dispositions (Assumption Audit Category 1)

| Reference from M41 definition | Disposition | Notes |
|-------------------------------|-------------|-------|
| `scripts/gsd-t-token-aggregator.js` | **USE** | Import envelope-parse helpers; do not modify |
| `scripts/gsd-t-stream-feed.html` | **INSPECT** | Read `humanizeTokens` + `formatCost` for parity; do not import from HTML |
| `bin/gsd-t-orchestrator.js` worker spawn path | **INSPECT** | Already captures usage via stream-json sink (M40). Understand how, don't rewire. |
| `commands/gsd-t-execute.md` | **USE** (as reference target for D2) | Convert in isolation first as the worked example |
| Historical `.gsd-t/headless-*.log` | **USE** (read-only) | D3 parses these; never deletes or rotates |
| Historical `.gsd-t/events/*.jsonl` | **USE** (read-only) | D3 parses these; never deletes or rotates |

## User Intent Locked-In Interpretations (Assumption Audit Category 4)

| Ambiguous phrase from M41 definition | Interpretations | Locked |
|--------------------------------------|-----------------|--------|
| "universal token capture" | (a) every spawn surface, (b) only new spawns going forward | **(a)** — D3 backfills the historical record; D1+D2 cover forward |
| "missing usage" handling | (a) write `0`, (b) write `—`, (c) write `N/A` | **(b)** — `—` means "gap acknowledged", never `0` (a zero is a measurement) and never `N/A` (the old convention being retired) |
| "enforcement" (D5) | (a) hard fail on any bare spawn, (b) warn in CI, (c) opt-in pre-commit hook + MUST rule in CLAUDE | **(c)** — opt-in hook for ship; methodology rule blocks from day 1; automatic hook installation deferred to post-shakedown |
| "dashboard" (D4) | (a) web UI, (b) CLI table | **(b)** — M40 D5 is the live web UI; M41 D4 is the historical CLI view. No second web server. |
| "backfill" (D3) | (a) retroactively rewrite old `N/A` rows, (b) append backfill-only JSONL | **both** — `--patch-log` rewrites rows in place; default writes JSONL-only with `source: "backfill"` marker |

---

## Prior Milestone Archives

Previous integration-points content (M40 and earlier) is preserved in milestone archives under `.gsd-t/milestones/`. Most recent: `M40-external-task-orchestrator-2026-04-20/`.
