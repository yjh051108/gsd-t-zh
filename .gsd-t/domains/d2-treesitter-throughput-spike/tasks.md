# Tasks: d2-treesitter-throughput-spike

## Summary
When all tasks complete: a measured Atos full-index build wall-clock (PASS under ~2 min = AC-1, or KILL/re-scope verdict) recorded in progress.md, and a STABLE `graph-parser-floor-contract.md` (entity/edge taxonomy + parse-harness/parallelism interface) that unblocks D3's indexer build. WAVE-1 PROVE-OR-KILL spike (K2) — throughput PROBE + taxonomy contract only, no production indexer. Measured on the REAL Atos repo, never assumed.

## Wave 1

### M94-D2-T1 — Parser-floor contract (edge taxonomy from M20–M21 lessons)
- **Status**: [ ] pending
- **Files**: `.gsd-t/contracts/graph-parser-floor-contract.md`
- **Touches**: `.gsd-t/contracts/graph-parser-floor-contract.md`
- **ImplPath**: `.gsd-t/contracts/graph-parser-floor-contract.md` — the entity/edge taxonomy (imports/exports/functions/classes/requires/call-sites) + the per-file parse-harness + parallelism interface D3 consumes
- **Test**: `test/m94-k2-treesitter-throughput.test.js` (shared with T2) — the probe's per-file parse output is asserted against the taxonomy the contract declares (entities/edges in the declared kinds), exercising the contract shape
- **Contract refs**: graph-parser-floor-contract (authored here)
- **Dependencies**: none
- **Acceptance criteria**:
  - Declares the entity/edge taxonomy: imports, exports, functions, classes, requires, call-sites (the M20–M21 WHAT, salvaged as LESSONS from `bin/graph-parsers.js` — NOT the regex HOW lifted; see PseudoCode §Divergence)
  - Declares the parse-harness + parallelism interface D3 consumes (per-file parse → `{entities, edges}`)
  - Marked STABLE once the throughput probe passes (or re-scoped if K2 kills)

### M94-D2-T2 — Tree-sitter throughput probe (K2 = AC-1 kill-criterion)
- **Status**: [ ] pending
- **Headline**: true
- **Files**: `bin/gsd-t-graph-ts-throughput.cjs`, `test/m94-k2-treesitter-throughput.test.js`
- **Touches**: `bin/gsd-t-graph-ts-throughput.cjs`, `test/m94-k2-treesitter-throughput.test.js`
- **ImplPath**: `bin/gsd-t-graph-ts-throughput.cjs` — full tree-sitter floor parse of the REAL Atos repo (`/Users/david/projects/HiloAviation/hilo-figma-atos`, ~1.5M LOC), wall-clock measured, parallelism strategy applied, PASS/KILL verdict
- **Test**: `test/m94-k2-treesitter-throughput.test.js` — fixture-based (no Atos repo needed); asserts verdict logic at/around the ~2-min budget threshold (a synthetic over-budget run → KILL), the `repo-not-found` FAIL-LOUD path, **[#7 Atos pin]** the `commit-mismatch`/unpinned-repo FAIL-LOUD path (a recorded wall-clock with no pinned SHA is rejected), and the envelope shape (which MUST carry the `atosSha` field). The real-repo wall-clock is a runtime spike measurement recorded in T3's result doc, NOT a test assertion.
- **Contract refs**: graph-parser-floor-contract (T1)
- **Dependencies**: M94-D2-T1
- **Acceptance criteria**:
  - (K2 = `[RULE] K2: treesitter-atos-build-under-budget-or-rescope`)
  - Full tree-sitter floor parse of the REAL Atos repo, wall-clock measured, parallelism strategy applied
  - **PASS iff build under ~2 min**; else a `KILL`/re-scope verdict (adjust budget/parallelism) — measured on the real repo, never assumed
  - **FAILS LOUD with `repo-not-found`** if the Atos repo is absent at run time — never fakes a PASS
  - **[#7 Atos SHA pin]** PINS and records the Atos commit SHA (`git -C <atos> rev-parse HEAD`) in the envelope (`[RULE] k2-atos-sha-pinned`); fails LOUD on repo-not-found — NEVER records a wall-clock against an unpinned/absent repo. This SHA is the pin AC-4 (D6) must match.
  - **Killing test**: a synthetic over-budget measurement yields KILL (the test fails if the probe rubber-stamps PASS); the `repo-not-found` path is asserted (the probe cannot fabricate a number); the unpinned/absent-SHA path is asserted (no number without a pin)
  - tree-sitter + grammar packages used by the probe are dev/spike-only — NEVER added to shipped installer `dependencies`

### M94-D2-T3 — K2 result doc + progress.md (AC-1 wall-clock)
- **Status**: [ ] pending
- **Files**: `.gsd-t/spikes/k2-treesitter-atos-throughput-results.md`
- **Touches**: `.gsd-t/spikes/k2-treesitter-atos-throughput-results.md`
- **ImplPath**: `.gsd-t/spikes/k2-treesitter-atos-throughput-results.md` — the AC-1 build wall-clock + PASS/KILL verdict record
- **Test**: `test/m94-k2-treesitter-throughput.test.js` — the envelope it records (wall-clock + verdict fields) is shape-asserted by T2's test
- **Contract refs**: NONE
- **Dependencies**: M94-D2-T2
- **Acceptance criteria**:
  - Records the real-repo build wall-clock + PASS/KILL verdict + the pinned Atos commit SHA with a LIVE-CLOCK timestamp
  - progress.md updated with the build wall-clock (AC-1) + the pinned SHA
  - **[#5 kill-path descope]** If K2's verdict is KILL/re-scope, record the explicit AC-descope per the Wave-1 kill-path rule in `integration-points.md` (`[RULE] kill-outcome-records-ac-descope`): e.g. K2 kill → cap repo size / narrow language set → the affected AC-1 build-coverage formally re-scoped, recorded in progress.md, never silently failed. A recorded KILL with no AC-descope record blocks any Wave-2 task.

## Execution Estimate
- Total tasks: 3
- Independent tasks (no cross-domain blockers): all 3 (Wave 1 — d2 has no upstream dependency; it GATES the Wave-2 trio jointly with d1)
- Intra-domain serial chain: T1 → T2 → T3
- Estimated checkpoints: 1 (Wave-1 HARD GATE, jointly with d1 — Wave 2 does not begin until K1 PICK + K2 PASS)
