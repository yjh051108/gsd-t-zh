# Scope: d9-query-cli-extensions (Wave A — the new verbs special-case consumers need)

## Mission
Add the few NEW query verbs that several special-case commands need, as ADDITIONS to the existing `bin/gsd-t-graph-query-cli.cjs` (NOT separate CLIs, NOT separate contracts) — extending `graph-query-cli-contract.md` in place. Three verb families:
1. **CLUSTER / subgraph** — tightly-coupled file groups (for `/partition` + `/project`).
2. **ORPHAN / absence** — nodes with no edges (= dead code) + edges to a missing node (= dangling ref) (for `/qa` + `/verify`).
3. **TEST→IMPL coverage** — which impl functions a test file's functions call (for `/test-sync`).

## Critical pre-finding (verified this plan pass — de-risks the test→impl verb)
The indexer ALREADY emits `call-site` edges keyed `file#function` at BOTH ends (`bin/gsd-t-graph-edge-extract.cjs:266` source=enclosingFuncId, target=callee funcId). So a TEST→IMPL edge is DERIVABLE by filtering existing call-site edges where the SOURCE file matches a test-path pattern (`*.test.*` / `*.spec.*` / `e2e/`) — **NO new edge TYPE is needed in d3's extraction.** The test→impl verb is a QUERY-CLI filter over existing call-site edges, owned entirely here. (User asked to "CONFIRM the indexer extracts test→impl call edges first; if not, add that edge type to d3" — CONFIRMED present as call-site edges; the d3 add is NOT needed. Recorded so the verify gate doesn't expect a d3 edge-type change.)

## Files Owned
- `bin/gsd-t-graph-query-cli.cjs` (EXTEND — add the 3 verb families; the existing who-imports/who-calls/blast-radius/status stay intact)
- `.gsd-t/contracts/graph-query-cli-contract.md` (EXTEND — declare the new verbs' envelopes + semantics)
- `test/m94-d9-cluster-verb.test.js` (NEW)
- `test/m94-d9-orphan-dangling-verb.test.js` (NEW)
- `test/m94-d9-test-impl-verb.test.js` (NEW)

## Ownership note (file-disjointness)
`bin/gsd-t-graph-query-cli.cjs` and `graph-query-cli-contract.md` were d5's at Wave-2 build, now COMPLETE. d9 is the SOLE M94 editor of these two files in the back-half waves (d5's Wave-2 tasks are done; no concurrent d5 task touches them in Wave A). d6 READS the envelope, d8's lint READS the contract — neither edits these files. Confirmed sole-owner for the back half.

## Not Owned
- The consumer commands (d10 readers query these verbs; d11 writers too) — d9 only ADDS the verbs.
- The shared wiring contract (d8) — d9's verbs are referenced BY d8's manifest, but d8 owns that file.
- d3's edge-extractor — NOT edited (see the pre-finding: no new edge type needed).

## Contract refs
- graph-query-cli-contract.md (the contract d9 extends)
- graph-store-schema-contract.md (D1 — the edges table: kind ∈ {import, require, call-site}, src/dst funcId-keyed, partial flag)
