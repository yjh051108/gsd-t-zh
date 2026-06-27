# M95 — Build Real SCIP Call-Graph Resolution (finish M94's stubbed precise tier)

**Status: BUILDING 2026-06-26 — core resolution SHIPPED, heavy Atos verify in progress.**

## Build progress (2026-06-26 21:xx PDT)
- ✅ **SCIP reader** (`bin/gsd-t-scip-reader.cjs`) — decodes `index.scip` via scip-typescript's bundled protobuf decoder; builds symbol→funcId + per-file reference maps. Located across install layouts, fail-loud if absent.
- ✅ **Repo-level resolver** (`buildScipResolver` in `gsd-t-graph-scip-upgrade.cjs`) — runs scip-typescript ONCE per repo (was: once per file, output discarded), reads it, resolves each file's `UNRESOLVED#<name>` call edges to real cross-file funcIds.
- ✅ **`tryScipUpgrade` rewritten** — resolves edges from the repo resolver; labels `compiler-accurate` ONLY when ≥1 edge actually resolved (tier honesty); kills the relabel-lie.
- ✅ **`build_index` wires it** — auto-builds the resolver once, threads it through `parse_and_put`.
- ✅ **Fixture proof** — `e2e/calc.spec.ts → src/calc.ts#computeTotal` resolves; `test-impl` returns the impl (was `[]`).
- ✅ **Tier honesty proof** — a file with only unresolvable calls stays `tree-sitter-floor`, not falsely `compiler-accurate`.
- ✅ **M95 tests** — `test/m95-scip-call-resolution.test.js` 5/5 (resolution, tier honesty, fail-loud, passthrough).
- ✅ **No regressions** — D3/D4/D5/D9 non-heavy suites green.
- ✅ **Contract updated** — `graph-indexer-build-contract.md` tier definition now describes real SCIP resolution.
- ⏳ **Heavy Atos d9 verify** — running (scip-typescript over 4,418 files is slow; SCIP adds meaningful time → AC-5 budget impact to record).
- ⬜ **Auto-install wiring** — `gsd-t install` runs `npm i -g @sourcegraph/scip-typescript` (NEXT, after Atos verify passes).
- ⬜ **Python** — scip-python (follow-on).

---

**Status: DEFINED 2026-06-26 21:01 PDT — awaiting partition.**
**Origin:** discovered during M94 close-out (heavy real-Atos test run). Not a bug fix — a milestone-scope GAP: the precise call-graph resolution M94 advertised was never built.

---

## The one-breath call
Make GSD-T's "compiler-accurate" tier label TRUE. Today the SCIP upgrader runs `scip-typescript`, checks it exits 0, then re-labels the SAME unresolved tree-sitter call edges as "compiler-accurate" **without ever reading SCIP's output**. M95 reads `index.scip` and replaces `UNRESOLVED#<name>` call targets with real file-qualified funcIds — so `who-calls`, `test-impl`, and `blast-radius` resolve across files/imports, and the tier label stops lying.

## Why this exists (the discovery, verified this session)
- M94's heavy d9 real-Atos test (`test/m94-d9-real-atos-verb-spotcheck.test.js`) fails: `test-impl` returns 0 resolved impl funcIds on the real Atos repo (4,418 files, 1,086 test files present).
- Fast 1-second fixture repro: a `.spec.ts` that imports + calls `computeTotal` produces edge `UNRESOLVED#computeTotal`, never linked to `src/calc.ts#computeTotal`.
- Root cause is NOT "SCIP not installed." With `scip-typescript@0.4.0` installed and detected (`detectScip().typescript === true`), the call edges STILL stay `UNRESOLVED#` and the tier is STILL labeled `compiler-accurate`.
- The code admits it (`bin/gsd-t-graph-scip-upgrade.cjs:128-131`): *"Phase-1 SCIP upgrade is tier labelling only — it re-uses the tree-sitter edges but labels them compiler-accurate. Phase-2 will replace the edges with SCIP-derived ones."* **Phase-2 = this milestone.**
- Net: precise call-graph resolution exists at NO tier today; the "compiler-accurate" label is a silent-degradation lie (`feedback_no_silent_degradation`, `feedback_measure_dont_claim`).

## Decisions already locked (do NOT re-litigate)
- **Zero-dep is a guiding principle, NOT a hard rule** — dropped where it weakens the product (`feedback_zero_dep_is_guiding_not_hard`). Bundling SCIP indexers as a GSD-T install requirement is SANCTIONED.
- **Install UX:** AUTO-INSTALL on `gsd-t install` (user-chosen) — the installer runs `npm i -g @sourcegraph/scip-typescript` (+ scip-python), fail-loud on failure. Wire this AS PART of M95 once resolution is proven (do not wire the installer before the resolution actually works — that was the 2-day trap).
- **Verified facts (this session, cite-don't-reguess):** scip-typescript = Apache-2.0, `npm i -g @sourcegraph/scip-typescript`, Node-only, needs a `tsconfig.json`/`package.json`. scip-python = MIT (Pyright fork), `npm i -g @sourcegraph/scip-python`, Node + reads pip env. rust-analyzer `scip` already on this machine; Rust stays best-effort/flag-partial. `index.scip` is a protobuf — reading it needs either the `scip` CLI (`scip print --json`, NOT currently installed) or a protobuf parser. This open choice is the first thing partition must settle.

## Scope (Phase 1 — TS/JS first, the bulk of real code)
1. **Read SCIP output** — invoke `scip-typescript index --output <tmp>.scip`, parse the protobuf. Decide the reader: bundle the `scip` CLI for `scip print --json`, OR add a protobuf-parsing dep, OR vendor the SCIP proto schema. (Partition decides; verify the real format, don't assume.)
2. **Remap call edges** — turn SCIP symbol occurrences into file-qualified funcIds; replace `UNRESOLVED#<name>` call targets with resolved `file#func@line` ids. Cross-file + cross-import resolution is the win.
3. **Honest tier** — `compiler-accurate` ONLY for edges actually derived from SCIP; everything else stays `tree-sitter-floor` (labeled). Kill the current blanket-relabel. Add a killing test: an unresolved edge must NEVER carry `compiler-accurate`.
4. **Auto-install wiring** — once resolution is proven on the fixture + Atos, wire SCIP install into `gsd-t install` (fail-loud).
5. **Re-verify on real Atos** — d9 `test-impl` resolves ≥1 (really ≫1) impl funcId at the pinned SHA; the heavy test passes for REAL, not by lowering the floor.
6. **Python (Phase 2 within M95 or a follow-on)** — same pattern via scip-python.

## Falsifiable acceptance
- AC-1: fixture `.spec.ts` calling an imported `computeTotal` → `test-impl` returns `e2e/calc.spec.ts → src/calc.ts#computeTotal` (resolved, not UNRESOLVED).
- AC-2: on real Atos at pinned SHA `b062c80129c0c8e5b82ee3a4eaf9dcc4255c43b5`, `test-impl` returns ≥1 resolved impl funcId; `who-calls` resolves a known cross-file call. (d9 heavy test passes as written.)
- AC-3: tier honesty — a deliberately-unresolvable call (dynamic dispatch / missing SCIP) is labeled `tree-sitter-floor`, NEVER `compiler-accurate`. Negative test required.
- AC-4: `gsd-t install` brings up scip-typescript automatically; `gsd-t doctor` reports it present; fail-loud if install fails.
- AC-5: memory/throughput on Atos stays within a re-pinned budget; heavy tests gated `GSDT_SLOW_TESTS=1` AND run `--test-concurrency=1` (M94 found 2 parallel builds = 2×8GB = OOM).

## M94 close-out carry-overs (fold into M95 or note as done)
- ✅ DONE & committed (ce91ff7): runFreshnessCheck `/`-walk OOM fix + parse_and_put signature fix. Non-heavy suite green.
- ⚠️ Heavy tests must run `--test-concurrency=1` + `GSDT_SLOW_TESTS=1` — add the guard.
- ⚠️ `build_index` uses ~8GB / 174s on Atos — re-pin the AC-1 budget or optimize (streaming) as part of M95 AC-5.
- M94 itself: the import-graph, who-imports, blast-radius, dead-code, freshness, /scan-wiring all WORK and are committed. Only the precise CALL-graph tier is unbuilt → M95.

**Next:** `/gsd-t-partition` M95 (Wave 1 = settle the SCIP-reader choice + prove fixture resolution before any Atos/installer work).
