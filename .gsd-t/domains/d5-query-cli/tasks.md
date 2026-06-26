# Tasks: d5-query-cli

## Summary
When all tasks complete: a deterministic query CLI (who-imports / who-calls / blast-radius + `graph status`) that calls D4's freshness check inline before answering, NEVER greps, and fails LOUD (`graph-unavailable`) on parser death — with the no-grep-fallback (structural grep-for-absence) and fault-injection keystone tests passing. WAVE-2 BUILD — after the K1+K2 HARD GATE; runs concurrently with d3 and d4. The no-stale-no-wrong KEYSTONE (AC-5). This domain READS the store; D3 writes, D4 mutates on re-index. The CLI triggers re-index via D4's function — it does not write store records itself.

## Wave 2

### M94-D5-T1 — Query CLI (who-imports/who-calls/blast-radius + status) + envelope contract
- **Status**: [ ] pending
- **Headline**: true
- **Files**: `bin/gsd-t-graph-query-cli.cjs`, `.gsd-t/contracts/graph-query-cli-contract.md`, `test/m94-d5-query-cli.test.js`
- **Touches**: `bin/gsd-t-graph-query-cli.cjs`, `.gsd-t/contracts/graph-query-cli-contract.md`, `test/m94-d5-query-cli.test.js`
- **ImplPath**: `bin/gsd-t-graph-query-cli.cjs` — `gsd-t graph <verb>` dispatch (`who-imports` / `who-calls` / `blast-radius` / `status`); each verb calls D4's `freshness_check_on_query` INLINE before answering from the D1 store; emits the JSON envelope
- **Test**: `test/m94-d5-query-cli.test.js` — `who-imports`/`who-calls`/`blast-radius` return correct results on hand-checked fixtures (AC-2); a stale touched file is re-indexed INLINE before the answer (asserts the freshness call fires); `gsd-t graph status` returns a LIVE queryable index (the M20–M21 "no graph index found" anti-goal fails the test)
- **Contract refs**: graph-store-schema-contract (D1, read-only), graph-freshness-contract (D4 — the inline check), graph-query-cli-contract (authored here)
- **Dependencies**: M94-D4-T1 (the `freshness_check_on_query` surface) — and the Wave-1 HARD GATE; reads M94-D1-T3 store-schema
- **Acceptance criteria**:
  - (AC-2 who-imports/who-calls correctness + the keystone freshness seam)
  - Answers who-imports / who-calls / blast-radius from the store (AC-2, hand-checked fixtures)
  - **[#9 blast-radius semantics]** `blast-radius(target)` returns the **UNION of the import-graph AND call-graph reverse-reachable sets**, transitive closure (NOT one-hop) — `[RULE] blast-radius-unions-both-graphs`; the semantics (which graphs, hop-depth) are DECLARED in `graph-query-cli-contract.md` (authored here, before D5-T3's fixture test)
  - Calls D4's freshness check INLINE before answering — `[RULE] stale-file-reindexed-before-answer`
  - `gsd-t graph status` returns a live queryable index — `[RULE] graph-status-live`
  - Authors `graph-query-cli-contract.md` (the JSON envelope D6 reads)
  - READS the store only — re-index is triggered via D4's function, never a direct store write here
  - **Builds in the AC-5 keystone invariants** (proven by T2): NO directive-driven grep fallback path exists in any code path (`[RULE] query-cli-never-greps`); a genuine parser/store-load failure returns `{ok:false, reason:'graph-unavailable'}` FAIL-LOUD, never a partial edge (`[RULE] parser-fail-disables-loud-never-silent`)

### M94-D5-T2 — AC-5 keystone tests: no-grep-fallback (structural) + fault-injection fail-loud
- **Status**: [ ] pending
- **Files**: `test/m94-d5-no-grep-fallback-structural.test.js`, `test/m94-d5-fault-injection-fail-loud.test.js`
- **Touches**: `test/m94-d5-no-grep-fallback-structural.test.js`, `test/m94-d5-fault-injection-fail-loud.test.js`
- **ImplPath**: `bin/gsd-t-graph-query-cli.cjs` (T1) — these tests are the structural + fault-injection proof of the keystone invariant on that implementation
- **Test**: two files —
  - `test/m94-d5-no-grep-fallback-structural.test.js` — STRUCTURAL grep-for-absence: parses the query CLI's code paths and asserts NO directive-driven grep fallback path EXISTS (proves absence by parsing the code structure, NOT a substring scan — a comment mentioning "grep" must not trip it; a real fallback branch must)
  - `test/m94-d5-fault-injection-fail-loud.test.js` — FAULT-INJECTION: forces a parser/store-load failure (e.g. corrupts the store) and asserts the CLI returns `{ok:false, reason:'graph-unavailable'}` — FAIL-LOUD, never a partial or silent-wrong edge
- **Contract refs**: graph-query-cli-contract (T1)
- **Dependencies**: M94-D5-T1
- **Acceptance criteria**:
  - (AC-5 — the no-stale-no-wrong keystone)
  - `[RULE] query-cli-never-greps`: structural grep-for-absence — parses the CLI's code paths and asserts NO directive-driven grep fallback exists (not a substring scan)
  - `[RULE] parser-fail-disables-loud-never-silent`: fault-injection forces a parser-load failure → asserts `{ok:false, reason:'graph-unavailable'}`, never a partial edge (commands then fall back to grep mode ANNOUNCED, in D6)

### M94-D5-T3 — Blast-radius union fixture test (#9 — both graphs unioned, neither over- nor under-broad)
- **Status**: [ ] pending
- **Files**: `test/m94-d5-blast-radius-union.test.js`
- **Touches**: `test/m94-d5-blast-radius-union.test.js`
- **ImplPath**: `bin/gsd-t-graph-query-cli.cjs` (T1) — this test is the hand-checked proof of the blast-radius union semantics on that implementation
- **Test**: `test/m94-d5-blast-radius-union.test.js` — a hand-checked fixture graph where one downstream node is reachable from `target` ONLY via the call graph (NOT the import graph) and an unrelated node is reachable via NEITHER. Asserts `blast-radius(target)`:
  - INCLUDES the call-graph-only node (proves both graphs are UNIONED, not import-only) — fails if it's missing (under-broad)
  - EXCLUDES the unrelated node — fails if it's present (over-broad)
- **Contract refs**: graph-query-cli-contract (T1 — the blast-radius semantics section)
- **Dependencies**: M94-D5-T1
- **Acceptance criteria**:
  - (`[RULE] blast-radius-unions-both-graphs` — the hand-checked union proof)
  - The call-graph-only downstream node IS in the result (both graphs unioned)
  - The unrelated node is NOT in the result (set is not over-broad)
  - Hop-depth is transitive: the fixture includes a 2-hop downstream node that MUST appear (blast-radius is full reverse-reachable closure, distinct from D4's deliberate one-hop freshness)

## Execution Estimate
- Total tasks: 3
- Independent tasks (no cross-domain blockers): 0 (gated on the Wave-1 HARD GATE + D4's freshness surface)
- Blocked tasks (waiting on other domains): T1 (on d4's freshness contract; on d1's store-schema)
- Intra-domain serial chain: T1 → T2, T1 → T3
- Estimated checkpoints: 1 (Wave-2 integration with d3 + d4 over the shared on-disk store)
