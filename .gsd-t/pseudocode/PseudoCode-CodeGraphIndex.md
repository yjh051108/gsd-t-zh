# PseudoCode-CodeGraphIndex

> **Subject:** CodeGraphIndex — the persistent, all-local, on-disk index of a codebase's
> structure (files, functions, imports/exports, file→file import graph, function→function
> call graph) + the deterministic query CLI that consumes it. Milestone: **M94 — Persistent
> Code Graph Index (Phase 1, backlog #44b graph half)**. `[Title]` is the SUBJECT, not the
> milestone id.

---

## Intention

> **Intention (David, 2026-06-25).** Build the codebase's structure ONCE into a persistent,
> all-local, no-paid-license, on-disk index, then make code-reading commands query that index
> instead of re-grepping the whole repo every run. On-demand grep is structurally blind to two
> things I keep getting bitten by: (1) the dependency I didn't know to look for (the
> unknown-unknown — the BinVoice "starve-the-source" and N≥3-consolidation failures), and (2) a
> whole-repo speedup (the Atos `/scan` re-reads ~1.5M LOC every run, ~2hr). A built-once index
> answers "who imports X / who calls f" in one query and lets `/scan` run-2 read-once-query-after.
> M92 (#44a, the no-graph paradigm half) shipped at v4.9.10 and was the gate on this work; that
> gate is now lifted.
>
> The graph that GSD-T shipped before (M20–M21, v2.38–2.39) DIED — maintenance burden, external
> infra, always-on across 21 commands, and a model-chosen silent grep fallback. I am NOT rebuilding
> that. Every documented cause of death is inverted (see §Divergence + the inversion table in the
> milestone definition). The graph NEVER depends on an external tool to FUNCTION (tree-sitter is
> the always-bundled floor) — only to get BETTER (per-language SCIP indexers upgrade accuracy when
> present). On a genuine parser failure the CLI FAILS LOUD (graph-unavailable, commands fall back to
> today's grep mode, announced) — it NEVER serves a stale or half-accurate edge.
>
> **CENTRAL TENET (the spine, David 2026-06-25 — reframe).** Dumb reach vs. smart reach into code.
> DUMB reach = today: the LLM gets a pile of text and must assemble + figure out the structure before
> it can reason. SMART reach = the graph: relationships are already organized and identified, so the
> LLM does the one thing only it can — THINK — with all the facts in hand. The code graph is the
> MANDATORY structural-knowledge layer for EVERY workflow step that reaches into code (structure /
> downstream effects / debugging); no code-reading step reconstructs from raw text what the graph
> already knows. Four wins on every code-reading consumer: (1) fewer tokens (compact graph ≪ raw
> source); (2) skip relationship-tracing (call chains / imports / dependents / dead-code / cycles
> PRE-COMPUTED, not reconstructed by reading); (3) pre-organized for reasoning — the LLM skips
> comprehension, goes straight to judgment (less load = faster AND better); (4) better/accurate
> structural insight. Only deep logic-bug reading INSIDE a function is not graph-replaceable (but the
> LLM arrives oriented). **Scope discipline (avoids the M20–M21 "21-commands-at-once" death):** the
> tenet is the PRINCIPLE + the shared query layer + the contract MANDATE that code-reading steps
> consume the graph; Phase 1 WIRES `/scan` + the query CLI as the FIRST PROOF; the other consumers
> (`/debug` `/quick` `/impact` `/execute` file-disjointness `/plan` partition M92-reflex) are
> MANDATED, SEQUENCED follow-on wiring — in-scope by principle, sequenced by execution, NEVER dropped.
> AC-4 (`/scan`) is the falsifiable PROOF of the tenet — RESCOPED (David, 2026-06-25) to **INSIGHT
> delta only**: the current `/scan` is kept FULLY INTACT and the graph is wired ADDITIVELY (the
> structural slice is INJECTED into the scanSlice deep-finders so its findings are ACCURATE, not
> LLM-reconstructed). PROOF = a graph-wired scan surfaces ≥ the no-graph run's structural findings
> PLUS ≥1 it missed/got wrong, on a pinned Atos SHA — neither asserted. The SPEED / file-count axis
> is DROPPED from M94 (unbindable without redesigning scan's enumerate-EVERY-file logic-bug mandate)
> and deferred to a SEPARATE "re-think /scan from the graph up" milestone.
>
> **The risk-first wave shape is the decision I signed off on.** The two existential unknowns the
> research left genuinely OPEN — the embedded store choice, and whether tree-sitter can index Atos
> in budget — are Wave-1 PROVE-OR-KILL spikes measured on the REAL Atos repo, with hard numeric
> kill-criteria, BEFORE any indexer / freshness / query-CLI / `/scan`-wiring work begins. Spending
> the first wave on de-risking rather than visible deliverables is deliberate: a fatal "this can't
> hold the invariant / can't hit the budget" failure costs one spike-wave, not a built-and-wired
> milestone.

---

## Mechanism

Pseudocode grounds in EXISTING GSD-T conventions (`bin/<tool>.cjs` CLIs returning a JSON
envelope, `gsd-t <verb>` dispatch, content-hash dirty-detection). Concrete identifiers — the
specific embedded store, the exact SCIP invocation per language, the store schema — are DEFERRED
to plan-time-against-real-inputs (resolved by the Wave-1 spikes, not asserted here).

```
# ============================================================
# WAVE 1 — PROVE-OR-KILL (no milestone-body build until BOTH pass)
# ============================================================

PROCEDURE spike_store_bakeoff():          # K1 — KILL CRITERION
    synthetic_graph = generate_graph(nodes ~= 1_500_000)   # match Atos scale
    FOR store IN [KuzuDB_embedded, SQLite_recursive_CTE, JSONL, graphology]:
        IF NOT store.is_embedded_on_disk_no_server_no_paid_license(): CONTINUE
        load(store, synthetic_graph)
        t_query = measure(store.query("who_imports X") + store.query("who_calls f"))
        t_incr  = measure(store.single_file_update + store.one_hop_edge_revalidation)
        IF t_query <= QUERY_LATENCY_TARGET AND t_incr < ~1s:
            RETURN PICK(store)            # store chosen ON EVIDENCE, recorded in progress.md
    # no option cleared all three sub-criteria →
    KILL_OR_RESCOPE()                     # e.g. narrow Phase-1 to import-graph-only, or cap repo size
                                          #  [RULE] K1: store-picked-on-evidence-or-rescope   [RULE]

PROCEDURE spike_treesitter_atos_throughput():   # K2 — KILL CRITERION
    t_build = measure(treesitter_floor.full_index(ATOS_REPO))   # ~1.5M LOC, mostly TS + some Python
    IF t_build < ~2min: RETURN PASS       # AC-1 proven on the REAL repo
    KILL_OR_RESCOPE()                     # adjust budget / parallelism BEFORE building on it
                                          #  [RULE] K2: treesitter-atos-build-under-budget-or-rescope   [RULE]

GATE wave_1: REQUIRE spike_store_bakeoff() == PICK AND spike_treesitter_atos_throughput() == PASS
             # HARD GATE — Wave 2 does not start otherwise   [RULE] wave1-hard-gate-blocks-build   [RULE]

# ============================================================
# WAVE 2 — BUILD (only after K1+K2 pass)
# ============================================================

PROCEDURE build_index(repo):              # Indexer (D2)
    FOR file IN repo.source_files():
        entities, edges = treesitter_floor.parse(file)        # syntax-level floor, every language
        IF scip_indexer_present(file.language):               # optional, local, one-shot
            entities, edges = scip_upgrade(file, entities, edges)  # compiler-accurate
            tier = "compiler-accurate"
        ELSE:
            tier = "tree-sitter-floor"                        # approximate, LABELED
        IF file.language == "rust" AND edge.is_cross_crate():
            edge.flag = "partial"                             # rust-analyzer SCIP "limited"
        store.put(file, content_hash(file), entities, edges, tier)
                                          #  [RULE] accuracy-tier-labeled-never-silently-wrong   [RULE]
                                          #  [RULE] rust-cross-crate-flagged-partial   [RULE]

PROCEDURE freshness_check_on_query(touched_files):    # Freshness (D3)
    FOR f IN touched_files:
        IF content_hash(f) != store.stored_hash(f):    # CONTENT-hash, not git-SHA (catch uncommitted edits)
            entities, edges = reparse(f)
            store.put(f, content_hash(f), entities, edges)
            FOR importer IN store.direct_importers(f):  # ONE-HOP only, NOT transitive
                revalidate_edges(importer, f)
                                          #  [RULE] freshness-content-hash-not-git-sha   [RULE]
                                          #  [RULE] one-hop-revalidation-not-transitive   [RULE]

PROCEDURE query(verb, target):            # Query CLI (D4) — deterministic, the ONLY interface
    freshness_check_on_query(files_touched_since_last_index())   # fresh-or-reindex-inline
    TRY:
        RETURN store.answer(verb, target)        # who-imports / who-calls / blast-radius
    CATCH ParserLoadFailure:
        RETURN { ok: false, reason: "graph-unavailable" }   # FAIL LOUD — never a partial edge
                                          #  [RULE] query-cli-never-greps   [RULE]
                                          #  [RULE] parser-fail-disables-loud-never-silent   [RULE]
                                          #  [RULE] stale-file-reindexed-before-answer   [RULE]

# ============================================================
# WAVE 3 — CONSUMER WIRING (the falsifiable payoff)
# ============================================================

PROCEDURE scan_consumer():                # /scan FIRST (D5) — narrow consumer set; ADDITIVE, scan kept INTACT
    IF NOT store.exists(): build_index(repo)        # build the index if absent
    # query the structural slice + INJECT it into the scanSlice deep-finders (additive)
    slice = query_structural_slice()       # dependents/dead-code/cycles/coupling, pre-computed + accurate
    RETURN scan_with_injected_slice(slice) # AC-4 = INSIGHT delta only (no wall-clock); scan's per-file
                                          #  read pipeline is UNCHANGED — graph is additive
                                          #  [RULE] scan-injects-structural-slice   [RULE]
```

---

## One call in one breath

| | |
|---|---|
| **One breath** | Build a codebase's structure ONCE into a local on-disk index (files, functions, imports/exports, import graph, call graph) parsed by tree-sitter as the always-bundled floor and upgraded to compiler-accurate SCIP per-language where present; keep it fresh by per-file content-hash dirty-detection (re-index the touched file + re-check its one-hop edges on query); query it through a deterministic CLI the model can't route around (fresh-or-reindex-inline, never a grep fallback, FAIL-LOUD on parser death); and wire `/scan` first ADDITIVELY — inject the graph's pre-computed structural slice so scan's structural findings are accurate (the INSIGHT proof), keeping the current scan architecture fully intact. |
| **Actors** | Indexer (tree-sitter floor + optional SCIP upgrade) · Store (embedded, on-disk — specific engine resolved by the K1 spike) · Freshness checker (content-hash + one-hop re-validation) · Query CLI (deterministic, no-grep-fallback, fail-loud) · Consumer (`/scan` first). |
| **Risk-first** | Wave 1 = two PROVE-OR-KILL spikes (store-bakeoff K1 + tree-sitter-Atos-throughput K2) with hard numeric kill-criteria on the REAL Atos repo. No milestone-body build until both pass. |

---

## Guard map

Every invariant the verify gate must hold, as one-line `[RULE]`s (loose form per §2 grammar —
invariant prose carries the marker; RULE-IDs derived). These feed `bin/gsd-t-guard-map.cjs`.

- `[RULE] K1: store picked on evidence (embedded/on-disk/no-server/no-paid-license + query-latency + sub-~1s incremental) OR Phase-1 re-scoped — never asserted.`
- `[RULE] K2: tree-sitter full index of the real Atos repo builds under ~2 min OR budget/parallelism re-scoped — measured, not assumed.`
- `[RULE] wave1-hard-gate: no indexer / freshness / query-CLI / scan-wiring work begins until K1 AND K2 pass.`
- `[RULE] freshness-content-hash-not-git-sha: dirty-detection hashes file CONTENT (catches an uncommitted working-tree edit; git-SHA unchanged MUST still be caught).`
- `[RULE] one-hop-revalidation-not-transitive: a stale file re-indexes itself + re-checks edges from its DIRECT importers only — never the transitive closure.`
- `[RULE] query-cli-never-greps: no directive-driven grep fallback exists in any code path — verified by a structural grep-for-absence, not a substring scan.`
- `[RULE] parser-fail-disables-loud-never-silent: a genuine parser-load failure returns graph-unavailable (commands fall back to grep mode, announced) — never a silent half-accurate index; verified by fault-injection.`
- `[RULE] stale-file-reindexed-before-answer: a query re-indexes any stale touched file inline BEFORE returning — never serves a stale or wrong edge.`
- `[RULE] accuracy-tier-labeled: edges carry their tier — compiler-accurate where SCIP present, tree-sitter-floor (approximate) where absent — never an unlabeled mix.`
- `[RULE] rust-cross-crate-flagged-partial: Rust cross-crate edges are FLAGGED partial (rust-analyzer SCIP is "limited") — never returned as if complete.`
- `[RULE] scan-injects-structural-slice: /scan (index warm) queries the index for the pre-computed structural slice (dependents/dead-code/cycles/coupling) and INJECTS it ADDITIVELY into the scanSlice deep-finders so those findings are accurate (graph-derived, not LLM-reconstructed); the current scan architecture (enumerate + per-file deep-read) is KEPT INTACT.`
- `[RULE] graph-status-live: gsd-t graph status returns a live queryable index on the Atos repo — the M20–M21 "no graph index found" state is the anti-goal.`

### Reframe-required guards (the CENTRAL TENET binding — AC-4 RESCOPED 2026-06-25: INSIGHT-delta only; the speed/cost-path/three-run guards RETIRED)
- `[RULE] scan-insight-gate` (the SOLE AC-4 binding): a graph-wired `/scan` surfaces ≥ the NO-GRAPH baseline run's structural findings PLUS ≥1 concrete named structural finding (a real dead-code symbol / cycle / coupling / dependent) the no-graph run MISSED or got WRONG, on a pinned Atos SHA. The comparison is graph-wired-vs-no-graph (NOT graph-vs-graph, which would show ~zero delta and silently mis-pass). A pre-registered gate in graph-scan-consumer-contract.md.
- `[RULE] scan-insight-delta-graph-attributed` (pre-mortem Finding A — anti-variance): since /scan deep-finders are stochastic LLM agents, the ≥1 missed/wrong delta finding MUST be traceable to the graph's deterministic query result (present in the injected slice, recorded in the result doc) — a delta that is mere LLM run-to-run variance with no graph contribution does NOT pass. This makes the insight gate falsifiable, not a variance artifact.
- `[RULE] scan-slice-consumed` (pre-mortem Finding B — anti-dead-injection): the graph-wired run's output MUST contain ≥1 structural finding byte-traceable to the injected D5 query result (the same symbol/cycle/dependent the CLI returned) — proving the slice was CONSUMED by a finding, not merely passed into context the deep-finders never use.
- `[RULE] ac4-two-distinct-runs`: AC-4 measures TWO runs on the SAME pinned Atos SHA — a NO-GRAPH baseline (graph wiring disabled, today's scan) and a GRAPH-WIRED run. The insight baseline is the no-graph run; comparing graph-vs-graph shows ~zero delta and is forbidden.
- ~~`[RULE] scan-run2-on-cost-critical-path` / `[RULE] scan-run2-speed-ceiling` / `[RULE] ac4-three-distinct-runs`~~ — **RETIRED** by the user AC-4 rescope (2026-06-25): the SPEED / file-count / cost-critical-path axis is unbindable without redesigning scan's enumerate-EVERY-file logic-bug mandate; DROPPED from M94 and deferred to a separate "re-think /scan from the graph up" milestone. AC-4 measures NO wall-clock.
- `[RULE] k1-query-latency-target` (#3): who-imports / who-calls each return < 50 ms at ~1.5M-node scale — a pre-registered number in graph-store-schema-contract.md BEFORE D1; an engineered-to-fail candidate fails on latency-over-target.
- `[RULE] k1-atomic-single-file-update` + `[RULE] freshness-write-atomic-no-torn-read` (#4): while a single-file re-index WRITE is in flight, a concurrent who-imports(F) returns fully-old OR fully-new edges, NEVER torn/partial — the picked store's declared atomicity (single-writer lock / atomic write+rename / txn); K1's 4th measured sub-criterion.
- `[RULE] kill-outcome-records-ac-descope` (#5): every Wave-1 KILL outcome records an explicit AC-descope (which ACs survive → which move to Phase-2, tests removed from THIS milestone's acceptance, never silently failed) in progress.md BEFORE any Wave-2 task runs.
- `[RULE] ac3-timing-split` (#6): AC-3/K1 incremental timing is split — a deterministic CORRECTNESS test (content-hash mismatch detected, one-hop not transitive, NO timing assertion) gates the build; a SEPARATE scale-budget measurement records the sub-~1s number at 1.5M-node scale against a pre-committed ceiling. No flaky inline wall-clock on a toy fixture.
- `[RULE] ac4-atos-sha-pinned` + `[RULE] k2-atos-sha-pinned` (#7): AC-4 (no-graph run == graph-wired run) AND K2 PIN the Atos commit SHA and fail LOUD on repo-not-found / commit-mismatch — a finding-set / number is NEVER recorded against an unpinned/absent repo.
- `[RULE] live-store-seam` (#8, integrate-owned): a real D3 index into a real D1 store, edited on disk, queried via D5 — the answer reflects the EDIT (proves D5→D4→D3→D1 fired live + the store mutated). Not mocked.
- `[RULE] blast-radius-unions-both-graphs` (#9): blast-radius(target) returns the UNION of the import-graph AND call-graph reverse-reachable sets (transitive); a node reachable only via the call graph IS included, an unrelated node is EXCLUDED — neither over- nor under-broad. Semantics declared in graph-query-cli-contract.md.

---

## Divergence

Three models inherited from shipped M20–M21 code were run through the keep-or-supersede protocol
(`templates/prompts/keep-or-supersede-subagent.md`) before encoding. KEEP writes no flag; each
SUPERSEDE writes a flag in the §4 grammar.

- ⚠ Divergence: §Mechanism/Freshness — supersedes shipped build-on-demand-store-nothing (design-brief §0.5 CLOSED decision). Reason: on-demand structurally can't catch the unknown-unknown dependency or speed up /scan; David's intention is a persistent full-index-up-front.
- ⚠ Divergence: §Mechanism/Query — supersedes shipped 3-tier provider chain CGC→native→grep with silent model-chosen grep fallthrough (M20–M21). Reason: the model-chosen grep fallback is the VERIFIED cause of death; David's intention is a tree-sitter floor + optional SCIP upgrade, NO grep fallback, FAIL-LOUD on parser death.
- ⚠ Divergence: §Mechanism/Indexer (HOW only) — supersedes shipped regex entity/edge extraction (bin/graph-parsers.js). Reason: the regex parsers logged their own bugs and leak on re-exports / arrow / destructure / scope-resolution; David's intention keeps the edge TAXONOMY (which edges: imports, exports, functions, classes, requires, call sites) as lessons but builds it fresh on tree-sitter. (The WHAT — the edge set — is KEPT, no flag; only the HOW is superseded.)

---

## Appendix — raw pseudocode (intention prose stripped, quick-reference)

```
# Wave 1 (PROVE-OR-KILL):
K1 store_bakeoff(synthetic ~1.5M nodes): pick store iff embedded+no-server+no-paid AND query<=target AND incr<~1s; else KILL/rescope
K2 treesitter_atos(): build full index of real Atos (~1.5M LOC) iff <~2min; else KILL/rescope
GATE wave1: K1==PICK AND K2==PASS  (hard gate)

# Wave 2 (BUILD):
build_index(repo): per file -> treesitter floor parse; SCIP upgrade if present (tier); rust cross-crate -> flag=partial; store.put(file, content_hash, entities, edges, tier)
freshness_check(touched): per f, if content_hash(f) != stored -> reparse + store.put + revalidate direct-importer edges (one-hop, NOT transitive)
query(verb,target): freshness_check(touched_since_index); try store.answer; catch ParserLoadFailure -> {ok:false, reason:"graph-unavailable"} (fail loud, no grep)

# Wave 3 (WIRE — additive, scan kept intact):
scan_consumer(): build_index if absent; query structural slice; INJECT into scanSlice deep-finders (additive); AC-4 = INSIGHT delta only (graph-wired vs no-graph baseline, pinned SHA), NO wall-clock
```
