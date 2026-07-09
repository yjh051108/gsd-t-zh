# Constraints: d9-query-cli-extensions

## Additions only — never break the existing verbs
- `who-imports` / `who-calls` / `blast-radius` / `status` are SHIPPED + tested (Wave 2). EXTEND the dispatch (`bin/gsd-t-graph-query-cli.cjs` ~line 482 verb whitelist + ~503 dispatch) ADDITIVELY. The existing tests (`m94-d5-*.test.js`) MUST stay green — re-run them as a regression gate.
- Each new verb returns the SAME envelope shape: `{ok:true, verb, target?, results:[…], tier}` on success, `{ok:false, reason}` on failure. Inherits the SAME freshness-check-inline + fail-loud-on-graph-unavailable path (the new verbs go through the same Step-1 freshness + Step-2 load-store guards). No new fallback path.

## Verb semantics (declare precisely in the contract)
- **cluster**: returns tightly-coupled file groups — connected components / dense sub-graphs of the import graph (a deterministic coupling metric, e.g. mutual-import or shared-dependent density; declare the exact metric + threshold in the contract so it is not LLM-judged). For `/partition` (suggest domain boundaries along low-coupling cuts) + `/project` (milestone decomposition).
- **dead-code / orphan**: a node (function/export) with NO inbound edges (no importer, no caller) = candidate dead code. Declare the exclusions (entry points, exported public API, test files) so it is not a false-positive flood.
- **dangling**: an edge whose `dst` resolves to a missing node (UNRESOLVED# target, or a dst funcId/file not present in the nodes table) = a dangling reference. (Complements freshness's add/delete/rename — a delete leaves dangling edges the freshness path flags; this verb SURFACES them for /qa + /verify.)
- **test-impl**: given a test file (or all test files), return the impl funcIds its functions call — = filter call-site edges where `src` file matches the test-path pattern (`*.test.*` / `*.spec.*` / `e2e/**`), dst = the impl funcId. Coverage-shaped: "which impl functions does this test exercise" + the inverse "which impl functions have NO test caller" (untested-impl). Declare the test-path patterns in the contract (configurable, sane defaults).

## funcId identity (R4-3 invariant — inherited)
- call-site edges are keyed `file#function` at both ends. The test→impl verb groups by funcId, never by bare name (a bare-name match across same-named functions is the R4-3 ambiguity bug). Ambiguous bare-name input returns the same `{ok:false, reason:"ambiguous-function", candidates:[…]}` envelope as who-calls.

## Tier honesty (AC-6 — inherited)
- Results carry the tier of the underlying edges (compiler-accurate / tree-sitter-floor / partial). dead-code from tree-sitter-floor edges is APPROXIMATE (a call the floor missed could make a node look orphan) — the contract states the dead-code verb's results are tier-labeled and tree-sitter-floor dead-code is a CANDIDATE, not a certainty. Never present an approximate orphan as a definite one.
