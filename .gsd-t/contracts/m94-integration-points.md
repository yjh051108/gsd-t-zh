# M94 Integration Points (integrate-read-path copy)

> **Why this file exists (RE-PLAN Fix-2):** the integrate workflow reads `.gsd-t/contracts/${milestone.toLowerCase()}-integration-points.md` (`templates/workflows/gsd-t-integrate.workflow.js` line 81), i.e. `m94-integration-points.md` — NOT the generic `integration-points.md`. The full M94 narrative + wave diagram lives in the generic `.gsd-t/contracts/integration-points.md`; THIS file is the canonical integrate-stage entry point so the seam-test spec + wave groupings + the AC-descope-record location are FINDABLE at integrate time.

## EXPANDED BACK-HALF (RE-PLAN 2026-06-26 — user decision: wire ALL ~19 code-reading commands, not just /scan)
> The Central Tenet ("graph = MANDATORY structural-knowledge layer for EVERY code-reading step") is delivered by wiring all code-reading commands in 3 LAYERS, grouped into new waves A/B/C after the (complete) Wave-1+2 build. The original Wave-3 (`/scan` only, d6) + INTEGRATE (d7) STAY; the expanded wiring is additive new domains d8–d11.

- **LAYER 1 — Shared wiring contract** (d8): ONE `graph-consumer-wiring-contract.md` = READER pattern (assess → graph query, not structural-grep) + WRITER pattern (reader + re-index touched files after edits) + FAIL-LOUD invariant (structural-grep REMOVED from the assessment path; graph-unavailable on a structural question fails loud, never silent grep) + the TEXT-search-grep carve-out + the `/scan` announced-fallback carve-out + the consumer manifest (the wired-file register).
- **LAYER 2 — Anti-grep lint** (d8): deterministic build gate (`bin/gsd-t-graph-anti-grep-lint.cjs` + `test/m94-d8-anti-grep-lint.test.js`) — FAILS the build if any wired command has a `try graph → catch → structural grep` fallback; manifest-driven (no hardcoded list); written BEFORE wiring so nothing regresses. Extends the d5 AC-5 structural-grep-for-absence idea from the query CLI to the consumer commands.
- **LAYER 3 — Query-CLI extensions** (d9, additive to `bin/gsd-t-graph-query-cli.cjs`, NOT separate contracts): `cluster` (tightly-coupled file groups — partition/project), `dead-code`/`orphan` + `dangling` (absence — qa/verify), `test-impl` (test→impl coverage — test-sync). **CONFIRMED this plan pass:** test→impl needs NO new d3 edge type — call-site edges are already funcId-keyed `file#function` at both ends, so the verb filters them by test-path source.

### Expanded wave groupings
- **WAVE A (foundation — parallel, file-disjoint):** `d8 wiring-contract-and-lint` ∥ `d9 query-cli-extensions`. Written FIRST so consumer wiring lands against a settled contract + lint + verbs.
- **WAVE B (READER commands — parallel after Wave A):** `d10 reader-command-wiring` — impact (blast-radius, the user's CORE use case) · plan · partition+project (cluster) · feature · gap-analysis · populate · promote-debt · prd · qa+verify (orphan/dangling) · integrate. The shared `gsd-t-phase.workflow.js` injection seam (d10-T0) feeds the generic-runner readers uniformly. `/scan` reader wiring stays in d6 (excluded from d10).
- **WAVE C (WRITER commands — parallel after Wave B):** `d11 writer-command-wiring` — execute+wave (SAFETY-CRITICAL disjointness, fail-loud-halts paramount) · debug (BOTH reader+writer) · quick · test-sync (test-impl) · design-build. Each writer = reader pattern + re-index touched files after edits.
- **EXCLUDED (no code-structure assessment):** all backlog-* · status/resume/pause/log/metrics/health/complete-milestone/milestone · init/init-scan-setup/setup/version-update*/help/Claude-md · branch/checkin/cpua/triage-and-merge/gsd · design-audit/design-review/design-decompose · doc-ripple/global-change.

### Expanded-scope seams (NO shared-file edits across domains)
| Seam | Producer | Consumer(s) | Surface |
|------|----------|-------------|---------|
| Shared wiring contract + manifest | d8 (D8-T1) | d10 readers, d11 writers, d6 scan (manifest row) | `graph-consumer-wiring-contract.md` READER/WRITER/FAIL-LOUD + consumer table |
| Anti-grep lint | d8 (D8-T2/T3) | build/verify gate | `bin/gsd-t-graph-anti-grep-lint.cjs` + `test/m94-d8-anti-grep-lint.test.js` (manifest-driven) |
| New query verbs | d9 (D9-T1/T2/T3) | d10 (cluster→partition/project, orphan→qa/verify), d11 (test-impl→test-sync) | `bin/gsd-t-graph-query-cli.cjs` (additive) + `graph-query-cli-contract.md` |
| Phase-workflow injection seam | d10 (D10-T0, sole owner) | generic-runner readers + the generic-runner writers (test-sync/design-build inherit the reader half) | `templates/workflows/gsd-t-phase.workflow.js` |
| Disjointness graph-awareness (SAFETY-CRITICAL) | d11 (D11-T1, sole owner) | execute/wave fan-out | `bin/gsd-t-file-disjointness.cjs` (graph-aware dependency-overlap, fail-loud-halts) |

### Expanded-scope file-disjointness verdict (re-validated this RE-PLAN)
- d8 owns: `graph-consumer-wiring-contract.md`, `bin/gsd-t-graph-anti-grep-lint.cjs`, `test/m94-d8-anti-grep-lint.test.js`.
- d9 owns: `bin/gsd-t-graph-query-cli.cjs` + `graph-query-cli-contract.md` (sole back-half editor — d5's Wave-2 tasks are COMPLETE; d6 only READS the envelope, d8's lint only READS the contract) + 3 new test files.
- d10 owns: `gsd-t-phase.workflow.js` (T0 sole) + 10 reader command `.md`s + `gsd-t-integrate.workflow.js` + `gsd-t-verify.workflow.js` + `test/m94-d10-reader-wiring.test.js` (T0-owned, manifest-driven). EXCLUDES scan files (d6).
- d11 owns: 4 writer workflow `.js`s (execute/wave/debug/quick) + 6 writer command `.md`s + `bin/gsd-t-file-disjointness.cjs` (T1 sole) + `test/m94-d11-writer-wiring.test.js` (T0-owned).
- **Zero cross-domain write collision.** Critical disjointness checks: `bin/gsd-t.js` (d7 ONLY) ≠ `bin/gsd-t-graph-query-cli.cjs` (d9 ONLY) ≠ `bin/gsd-t-file-disjointness.cjs` (d11-T1 ONLY); scan files (d6 ONLY, excluded from d10/d11); each command `.md` + each workflow `.js` has exactly one owning task; the shared test files are manifest-driven + single-owned by their domain's T0.
- **Manifest-driven tests** (d8 lint, d10 reader test, d11 writer test) all read the d8 consumer-manifest rather than hardcoding a consumer list — so coverage auto-extends as commands are wired and no wired file can silently escape the gate (`feedback_coverage_check_structural_not_substring`).

---

## Wave Groupings (the integration shape)
- **WAVE 1 — PROVE-OR-KILL (parallel, file-disjoint, throwaway spike code; HARD GATE):** `d1 store-bakeoff-spike` (K1) ∥ `d2 treesitter-throughput-spike` (K2 = AC-1).
- **WAVE-1 HARD GATE (machine-checkable — RE-PLAN Fix-4):** REQUIRE `k1Verdict == PICK` (store on evidence, ALL 4 sub-criteria: embedded · <50ms query · <1s incremental · concurrent-atomicity, + the Fix-6 footprint ceilings) AND `k2Verdict == PASS` (tree-sitter full-indexes REAL Atos < ~2 min, against a PINNED SHA, within the Fix-6 RSS ceiling AND the Fix-6 MEASURED-scale sanity check vs the bake-off). The verdict fields are written by D1-T3 (`k1Verdict`) + D2-T3 (`k2Verdict`); the gate is enforced by `test/m94-wave1-hard-gate.test.js` (D7-T2). Either fails its numbers → legitimate KILL/RE-SCOPE; **the KILL MUST record an explicit AC-descope (which ACs survive) HERE before any Wave-2 task** (`[RULE] kill-outcome-records-ac-descope`). A KILL with no descope record FAILS the gate; no Wave-2 build artifact may exist while a spike verdict is KILL without a descope.
- **WAVE 2 — BUILD (parallel, file-disjoint over a SHARED on-disk store; D3 writes, D4 mutates, D5 reads):** `d3 indexer-core` ∥ `d4 freshness` ∥ `d5 query-cli` (the keystone).
- **WAVE 3 — CONSUMER WIRING (additive extend-class on existing scan files; current scan kept INTACT):** `d6 scan-wiring` (AC-4 = INSIGHT delta only).
- **INTEGRATE stage — `d7 integrate-rewire`:** the rewire + dead-file deletion (Fix-1) + the live-store seam test (Fix-2) + the Wave-1 hard-gate test (Fix-4). Gated on the Wave-2 trio integrating + the Wave-1 envelopes existing.

## Wave-1-CLOSE scale reconciliation (R3-Fix-6 — no mid-spike deadlock)
D1 (K1 store bake-off) and D2 (K2 throughput + Atos-scale measurement) run CONCURRENTLY at the ~1.5M-node HYPOTHESIS. AFTER both report, BEFORE the hard gate finalizes K1 PICK: if K2's MEASURED Atos node-equivalent scale (`atosFileCount` + entity/edge enumeration — graph units, NOT raw LOC) materially diverges (>1.5× / <0.66×) from the ~1.5M synthetic default, the K1 bake-off is RE-RUN at the corrected `--scale` and K1 PICK is re-confirmed at the right size (so store evidence isn't validated at the wrong size). `scaleMismatch:true` from K2 forces this reconciliation before `k1Verdict` is final. This is a Wave-1-close step, never a mid-spike cross-dependency.

## AC-descope record (Wave-1 KILL outcomes — `[RULE] kill-outcome-records-ac-descope`)
> If K1 or K2 KILLs, record the explicit AC-descope HERE (which ACs survive, which move to Phase-2) BEFORE any Wave-2 task. The D7-T2 hard-gate test reads this section.

- **K1 verdict:** _(recorded at Wave-1 close: `PICK` + picked store + 4 sub-metrics, OR `KILL_OR_RESCOPE` + per-candidate per-criterion breakdown + the surviving-AC descope)_
- **K2 verdict:** _(recorded at Wave-1 close: `PASS` + Atos build wall-clock + MEASURED scale + pinned SHA, OR `KILL` + the surviving-AC descope)_

## Cross-domain seams (function-level / contract-level — NO shared file edits)
| Seam | Producer | Consumer(s) | Surface |
|------|----------|-------------|---------|
| Store schema | d1 (M94-D1-T3) | d3 (write), d4 (read hash), d5 (read) | `graph-store-schema-contract.md` columns + `k1Verdict` + footprint ceilings |
| Parser-floor taxonomy | d2 (M94-D2-T1) | d3 (lifts WHAT) | `graph-parser-floor-contract.md` |
| Build/put surface | d3 (M94-D3-T2) | d4 (`parse_and_put`), d5 (re-index inline) | `graph-indexer-build-contract.md` function surface |
| Freshness check | d4 (M94-D4-T1) | d5 (inline before answer) | `graph-freshness-contract.md` `freshness_check_on_query` |
| Query envelope | d5 (M94-D5-T1) | d6 (scan reads it), d7 (dispatch delegates to the CLI) | `graph-query-cli-contract.md` JSON envelope |
| Scan wiring | d6 (M94-D6-T2) | none (terminal) | extend-class edits to existing scan files (d6 sole owner) |
| **Live store seam (#8, D7-OWNED — Fix-2)** | d7 (M94-D7-T3) | n/a | `test/m94-integrate-live-store-seam.test.js` — real D3 index → real D1 store → edit file → D5 query reflects edit |
| **Graph dispatch rewire (Fix-1, D7-OWNED)** | d7 (M94-D7-T1) | n/a — terminal | `bin/gsd-t.js` `case "graph"` delegates to `bin/gsd-t-graph-query-cli.cjs`; 6 dead `bin/graph-*.js` + 3 dead tests DELETED |

## RE-PLAN (2026-06-26) — the 6 deeper-pre-mortem fixes
| Fix | Sev | Rule / test | Owner | `[RULE]` |
|-----|-----|-------------|-------|----------|
| 1 | CRITICAL (USER-APPROVED destructive) | Rewire `bin/gsd-t.js` `case "graph"` → D5 CLI; DELETE 6 dead `bin/graph-*.js` + 3 dead tests; integration test shells out real `gsd-t graph status`/`who-imports` through the entry point, asserts the NEW CLI (live/graph-unavailable), NEVER the dead "No graph index found" | D7-T1 | `graph-status-live` |
| 2 | CRITICAL | Live-store seam test (#8) gets a NAMED owner (`test/m94-integrate-live-store-seam.test.js`) + a FINDABLE spec — M94 integration-points doc published at the integrate-read path (`m94-integration-points.md`) | D7-T3 | `live-store-seam-real-pipeline` |
| 3 | HIGH | AC-4 insight ⊇ over a deterministic structural-finding IDENTITY (`{kind | sorted symbol/file set}`, free-text title stripped) + canonicalization; unit test: rephrase → same identity, new fact → distinct identity | D6-T1 (contract) + D6-T2 (test) | `scan-finding-identity-canonical` |
| 4 | HIGH | Wave-1 HARD GATE machine-checkable: D1-T3/D2-T3 write `k1Verdict`/`k2Verdict`; gate test reads them, a KILL with no AC-descope FAILS, no Wave-2 artifact while KILL-without-descope | D7-T2 + D1-T3 + D2-T3 | `wave1-hard-gate-machine-checkable` · `kill-outcome-records-ac-descope` |
| 5 | MEDIUM | K1 KILL attributable: per-candidate per-criterion breakdown + `candidateSetJustification` (closure of the embedded/no-server/no-paid category or next candidate); a bare KILL FAILS | D1-T2 (test) + D1-T3 (doc) | `k1-kill-attributable-per-candidate` |
| 6 | MEDIUM | K2 measures REAL Atos scale (`atosFileCount` + `atosTotalLoc` + `atosLangBreakdown`), never assumes ~1.5M; the D1 synthetic scale + the K1/K2 ceilings are sanity-checked against the measured number; material divergence → FAIL-LOUD | D2-T2/T3 (+ D1-T1 scale derivation) | `k2-atos-scale-measured-not-assumed` · `k2-scale-sanity-vs-bakeoff` |

## RE-PLAN (4) (2026-06-26) — 4 deeper-re-attack fixes on the R3 fixes (2 genuine design bugs; NO scope change beyond these 4)
| Fix | Sev | Rule / test | Owner | `[RULE]` |
|-----|-----|-------------|-------|----------|
| R4-1 | HIGH (AC-4 had NO halt path → infinite-fail risk) | AC-4 gets a machine-checkable `ac4Verdict ∈ {PROVEN, RESCOPE}` outcome ladder + a hard-gate verdict test (peer of D7-T2's Wave-1 gate). `PROVEN` = the ≥1 graph-attributed missed/wrong delta exists; `RESCOPE` = zero delta BUT either (a) a graph-attributed ACCURACY correction (a baseline finding the graph proves WRONG) OR (b) a documented descope per `kill-outcome-records-ac-descope`. Zero-delta AND no rescope record ⇒ FAIL (forces halt+descope, never a silent loop). The STRUCTURED `ac4Verdict` is authoritative — a prose "cleared" string is NOT the verdict (M90 lesson). Gives AC-4 a halt path matching K1/K2/AC-3 | D6-T1 (contract) + D6-T3 (verdict + gate test) | `ac4-verdict-machine-checkable` |
| R4-2 | HIGH (REAL BUG — silent accuracy DOWNGRADE on incremental re-index) | SCIP indexers are WHOLE-PROJECT BATCH tools (one `index.scip` per repo/crate) — they can't re-derive one file. `parse_and_put(file)` re-parses ONE file via tree-sitter only, so a previously `compiler-accurate` file gets silently re-written `tree-sitter-floor` on the next incremental edit (smart-reach silently degrading to dumb-reach on the AC-3 path). FREEZE `parse_and_put`'s tier behavior in `graph-indexer-build-contract.md`: re-upgrade SCIP for that language if feasible, OR honestly downgrade-with-flag `tier=tree-sitter-floor-STALE-SCIP` — NEVER silently relabel `compiler-accurate` / drop to an unlabeled approximate edge. Test: build a SCIP-present fixture so a file is `compiler-accurate`, edit it, `parse_and_put`, assert re-upgraded OR explicitly STALE-SCIP-flagged | D3-T2/T3 (contract invariant) + D3-T5 (test) | `reindex-tier-never-silently-downgraded` |
| R4-3 | HIGH (who-calls function-identity ambiguity — not provable on real data) | `who-calls <function>` took a bare NAME, but real codebases have many same-named functions (`handle`/`init`/`run`) across files — `who-calls('handle')` on real Atos merges wrong callers. Define a function-identity key `funcId = file#function` (FQN/`@line` where overloaded) in `graph-query-cli-contract.md` + `graph-store-schema-contract.md`; call edges keyed by `funcId` at both ends; a bare name matching multiple `funcId`s returns `{ok:false, reason:"ambiguous-function", candidates:[...]}` or per-candidate grouped results, never a flat merge. Test: TWO `foo`s in different files with distinct callers; `who-calls('a.ts#foo')` returns ONLY a.ts's callers; bare `who-calls('foo')` disambiguates | D5-T1 + D3-T1 (contract+emit) + D5-T4 (test) | `who-calls-function-identity-disambiguated` |
| R4-4 | MEDIUM (multi-file freshness coherence) | The store's per-file atomicity covers ONE in-flight single-file write vs a read of that file. But `compute_touched_files()` returns the WHOLE-TREE dirty set — a branch-switch/git-pull/rebase dirties hundreds of files re-indexed inline, and per-file atomicity ≠ multi-file query coherence. `graph-freshness-contract.md` declares the multi-file dirty-set re-index is SERIALIZED and the query observes the post-re-index COHERENT state (a `who-imports(X)` whose edges span several re-indexing files = all-new for every contributor, never a mix). Test: dirty N>1 files all contributing to `who-imports(X)`, assert the edge set is COHERENT. D4-T3's AC-3 scale-budget ALSO measures a ≥100-file dirty-set re-index wall-clock against a stated multi-file ceiling — the branch-switch budget is MEASURED, not assumed | D4-T1 (contract) + D4-T6 (coherence test) + D4-T3 (scale budget) | `freshness-multifile-reindex-serialized-coherent` · `multifile-dirty-set-reindex-under-budget` |

## Disjointness verdict (re-validated this RE-PLAN (4) — 27 tasks)
- 24 prior tasks + 3 new test tasks (D3-T5, D5-T4, D4-T6) = **27 atomic tasks**, every task carries an explicit `**Touches**` list. (R4-1 folds into the already-sole-owned D6-T1 contract + D6-T3's `test/m94-d6-scan-consumer.test.js` — no new file.)
- New write targets (R4), all uniquely owned, zero overlap: `test/m94-d3-tier-preserved-on-reindex.test.js` (D3-T5), `test/m94-d5-who-calls-identity.test.js` (D5-T4), `test/m94-d4-multifile-coherence.test.js` (D4-T6).
- R4-1 (`ac4Verdict` ladder) = EDITS to `graph-scan-consumer-contract.md` (D6-T1 sole-owned) + `test/m94-d6-scan-consumer.test.js` (D6-T2/T3 sole-owned) + the D6-T3 result doc — no new write target.
- R4-2 = contract invariant in `graph-indexer-build-contract.md` (D3-T2 sole-owned) + `graph-store-schema-contract.md` `tier` enum (D1-T3 sole-owned) + the new D3-T5 test — no overlap.
- R4-3 = contract edits in `graph-query-cli-contract.md` (D5-T1 sole-owned) + `graph-store-schema-contract.md` (D1-T3 sole-owned) + the D3-T1 edge-extractor (D3-T1 sole-owned, emits `funcId`) + the new D5-T4 test — no overlap.
- R4-4 = contract edits in `graph-freshness-contract.md` (D4-T1 sole-owned) + the new D4-T6 test + extended measurement in D4-T3's result doc (D4-T3 sole-owned) — no overlap.
- Prior R3 write targets unchanged: `bin/gsd-t.js` (D7-T1 SOLE owner anywhere in M94), `test/m94-d5-graph-dispatch.test.js` (D7-T1), `test/m94-wave1-hard-gate.test.js` (D7-T2), `test/m94-integrate-live-store-seam.test.js` (D7-T3), `.gsd-t/contracts/m94-integration-points.md` (D7-T3).
- The 6 dead `bin/graph-*.js` use the bare `graph-` prefix — disjoint from the new `gsd-t-graph-*` prefix; deleted ONLY by D7-T1, requirer-verified safe (only the rewired dispatch + the 3 dead tests reference them).
