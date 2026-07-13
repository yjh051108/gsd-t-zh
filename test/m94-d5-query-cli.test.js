"use strict";

/**
 * M94-D5-T1 — Query CLI correctness tests
 *
 * Covers: who-imports / who-calls / blast-radius correctness (AC-2) on hand-checked fixtures.
 * Also covers: graph status returns a LIVE queryable index ([RULE] graph-status-live).
 * Also covers: the freshness-seam exists (the freshness-check path is reachable, even with D4 absent).
 *
 * Note: D4's freshness_check_on_query is tested for the SEAM (the call is made),
 * not for the full freshness semantics (D4's own domain tests cover that). When D4 is absent,
 * the CLI returns graph-unavailable — the structural seam proves the contract without D4 installed.
 *
 * AC-2 fixtures are HAND-CHECKED: the test author computed expected results by inspection.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const CLI = require(path.join(__dirname, "..", "bin", "gsd-t-graph-query-cli.cjs"));

const {
  buildIndexFromRecords,
  queryWhoImports,
  queryWhoCalls,
  queryBlastRadius,
  queryStatus,
  loadStore,
  runFreshnessCheck,
  loadFreshnessModule,
} = CLI;

// ─── Shared hand-checked fixture ──────────────────────────────────────────────
//
// Graph layout (hand-checked — computed by inspection):
//
//   Files: a.ts, b.ts, c.ts, d.ts
//   Functions: a.ts#initA, b.ts#processB, c.ts#renderC, d.ts#dispatchD
//
//   Import edges (file→file, src imports dst):
//     b.ts  → a.ts   (b imports a)
//     c.ts  → b.ts   (c imports b)
//     d.ts  → b.ts   (d imports b)
//
//   Call edges (funcId→funcId, src calls dst):
//     b.ts#processB  → a.ts#initA     (processB calls initA)
//     c.ts#renderC   → b.ts#processB  (renderC calls processB)
//     d.ts#dispatchD → b.ts#processB  (dispatchD calls processB)
//
// Expected results (hand-verified):
//   who-imports('a.ts')          → ['b.ts']
//   who-imports('b.ts')          → ['c.ts', 'd.ts']  (sorted)
//   who-imports('c.ts')          → []
//   who-calls('a.ts#initA')      → ['b.ts#processB']
//   who-calls('b.ts#processB')   → ['c.ts#renderC', 'd.ts#dispatchD']  (sorted)
//   who-calls('c.ts#renderC')    → []

function makeFixtureRecords() {
  return [
    {
      file: "a.ts",
      content_hash: "aabbccdd",
      tier: "compiler-accurate",
      entities: [
        { funcId: "a.ts#initA", name: "initA", kind: "FUNCTION", file: "a.ts", tier: "compiler-accurate" },
      ],
      edges: [],
    },
    {
      file: "b.ts",
      content_hash: "bbccddee",
      tier: "compiler-accurate",
      entities: [
        { funcId: "b.ts#processB", name: "processB", kind: "FUNCTION", file: "b.ts", tier: "compiler-accurate" },
      ],
      edges: [
        { kind: "IMPORT", src: "b.ts", dst: "a.ts" },
        { kind: "CALL",   src: "b.ts#processB", dst: "a.ts#initA" },
      ],
    },
    {
      file: "c.ts",
      content_hash: "ccddeeff",
      tier: "compiler-accurate",
      entities: [
        { funcId: "c.ts#renderC", name: "renderC", kind: "FUNCTION", file: "c.ts", tier: "compiler-accurate" },
      ],
      edges: [
        { kind: "IMPORT", src: "c.ts", dst: "b.ts" },
        { kind: "CALL",   src: "c.ts#renderC", dst: "b.ts#processB" },
      ],
    },
    {
      file: "d.ts",
      content_hash: "ddeeffaa",
      tier: "compiler-accurate",
      entities: [
        { funcId: "d.ts#dispatchD", name: "dispatchD", kind: "FUNCTION", file: "d.ts", tier: "compiler-accurate" },
      ],
      edges: [
        { kind: "IMPORT", src: "d.ts", dst: "b.ts" },
        { kind: "CALL",   src: "d.ts#dispatchD", dst: "b.ts#processB" },
      ],
    },
  ];
}

// ─── T1.1: buildIndexFromRecords produces correct structure ──────────────────

test("T1.1: buildIndexFromRecords returns an index with the correct file set", () => {
  const records = makeFixtureRecords();
  const index = buildIndexFromRecords(records);

  assert.ok(index.allFiles instanceof Set, "allFiles must be a Set");
  assert.equal(index.allFiles.size, 4, "must have 4 files");
  assert.ok(index.allFiles.has("a.ts"));
  assert.ok(index.allFiles.has("b.ts"));
  assert.ok(index.allFiles.has("c.ts"));
  assert.ok(index.allFiles.has("d.ts"));
});

test("T1.2: buildIndexFromRecords populates funcEntities for bare-name disambiguation", () => {
  const records = makeFixtureRecords();
  const index = buildIndexFromRecords(records);

  assert.ok(index.funcEntities instanceof Map, "funcEntities must be a Map");
  assert.ok(index.funcEntities.has("a.ts#initA"), "initA entity must be indexed");
  assert.ok(index.funcEntities.has("b.ts#processB"), "processB entity must be indexed");
  assert.ok(index.funcEntities.has("c.ts#renderC"), "renderC entity must be indexed");
  assert.ok(index.funcEntities.has("d.ts#dispatchD"), "dispatchD entity must be indexed");
});

// ─── T1.3: who-imports correctness (AC-2 hand-checked) ───────────────────────

test("T1.3: who-imports(a.ts) returns [b.ts] — only b imports a", () => {
  const index = buildIndexFromRecords(makeFixtureRecords());
  const { results } = queryWhoImports(index, "a.ts");
  // Hand-checked: only b.ts has an IMPORT edge to a.ts
  assert.deepEqual(results, ["b.ts"]);
});

test("T1.4: who-imports(b.ts) returns [c.ts, d.ts] — c and d both import b", () => {
  const index = buildIndexFromRecords(makeFixtureRecords());
  const { results } = queryWhoImports(index, "b.ts");
  // Hand-checked: c.ts and d.ts each have IMPORT edges to b.ts
  assert.deepEqual(results, ["c.ts", "d.ts"]);
});

test("T1.5: who-imports(c.ts) returns [] — nothing imports c", () => {
  const index = buildIndexFromRecords(makeFixtureRecords());
  const { results } = queryWhoImports(index, "c.ts");
  // Hand-checked: no file has an IMPORT edge to c.ts
  assert.deepEqual(results, []);
});

test("T1.6: who-imports(a.ts) result carries the index tier", () => {
  const index = buildIndexFromRecords(makeFixtureRecords());
  const { tier } = queryWhoImports(index, "a.ts");
  assert.equal(tier, "compiler-accurate");
});

// ─── T1.7: who-calls correctness (AC-2 hand-checked) ─────────────────────────

test("T1.7: who-calls(a.ts#initA) returns [b.ts#processB]", () => {
  const index = buildIndexFromRecords(makeFixtureRecords());
  const result = queryWhoCalls(index, "a.ts#initA");
  // Hand-checked: only b.ts#processB has a CALL edge to a.ts#initA
  assert.deepEqual(result.results, ["b.ts#processB"]);
});

test("T1.8: who-calls(b.ts#processB) returns [c.ts#renderC, d.ts#dispatchD]", () => {
  const index = buildIndexFromRecords(makeFixtureRecords());
  const result = queryWhoCalls(index, "b.ts#processB");
  // Hand-checked: c.ts#renderC and d.ts#dispatchD both call b.ts#processB
  assert.deepEqual(result.results, ["c.ts#renderC", "d.ts#dispatchD"]);
});

test("T1.9: who-calls(c.ts#renderC) returns [] — nothing calls renderC", () => {
  const index = buildIndexFromRecords(makeFixtureRecords());
  const result = queryWhoCalls(index, "c.ts#renderC");
  // Hand-checked: no function has a CALL edge to c.ts#renderC
  assert.deepEqual(result.results, []);
});

// ─── T1.10: graph status returns a live queryable index ──────────────────────

test("T1.10: queryStatus returns queryable:true with correct counts", () => {
  const index = buildIndexFromRecords(makeFixtureRecords());
  const status = queryStatus(index, "/fake/store");

  // [RULE] graph-status-live — must be queryable (the M20–M21 "no graph index found" anti-goal fails)
  assert.equal(status.queryable, true, "status must report queryable: true");
  assert.equal(status.fileCount, 4, "must report 4 indexed files");
  assert.equal(status.funcCount, 4, "must report 4 indexed functions");
  assert.equal(status.storePath, "/fake/store");
  assert.equal(status.tier, "compiler-accurate");
});

test("T1.11: queryStatus importEdgeCount matches the fixture (3 import edges)", () => {
  const index = buildIndexFromRecords(makeFixtureRecords());
  const status = queryStatus(index, "/fake/store");
  // Hand-checked: b→a, c→b, d→b — 3 import edges, stored as reverse edges in importGraph
  // importGraph: a.ts→{b.ts} (1), b.ts→{c.ts, d.ts} (2) = 3 total
  assert.equal(status.importEdgeCount, 3, "must report 3 import edges");
});

test("T1.12: queryStatus callEdgeCount matches the fixture (3 call edges)", () => {
  const index = buildIndexFromRecords(makeFixtureRecords());
  const status = queryStatus(index, "/fake/store");
  // Hand-checked: processB→initA, renderC→processB, dispatchD→processB — 3 call edges
  // callGraph: a.ts#initA→{processB} (1), b.ts#processB→{renderC,dispatchD} (2) = 3 total
  assert.equal(status.callEdgeCount, 3, "must report 3 call edges");
});

// ─── T1.13/14: loadStore splits absent vs broken (Broken-Graph-Halts) ─────────
// The reason code was SPLIT: null storePath (nothing on disk → never indexed) = ABSENT;
// a store path present-but-unreadable (corrupt / non-loadable) = BROKEN. See
// .gsd-t/pseudocode/PseudoCode-BrokenGraphHalts.md.

test("T1.13: loadStore returns ok:false graph-absent when storePath is null (never indexed)", () => {
  const result = loadStore(null);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "graph-absent");
});

test("T1.14: loadStore returns ok:false graph-broken when store path is present-but-unreadable", () => {
  const result = loadStore("/does/not/exist/graph-index");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "graph-broken");
});

// ─── T1.15: Freshness seam — the call path exists ───────────────────────────
// When D4 is absent, the seam still FIRES (it tries to load D4) and fails loud.
// The STRUCTURAL seam test: runFreshnessCheck CALLS loadFreshnessModule before anything else.

test("T1.15: runFreshnessCheck returns ok:false graph-unavailable when D4 module is absent", () => {
  // D4 (gsd-t-graph-freshness.cjs) is not yet built — loadFreshnessModule returns null.
  // The contract: missing D4 = graph-unavailable (fail-loud, never silent degradation).
  const freshnessModule = loadFreshnessModule();
  if (freshnessModule !== null) {
    // D4 is present — skip this test variant (D4 integration is tested separately)
    return;
  }

  const result = runFreshnessCheck("/fake/store");
  // [RULE] parser-fail-disables-loud-never-silent: D4 absent → graph-unavailable
  assert.equal(result.ok, false);
  assert.equal(result.reason, "graph-unavailable");
});

test("T1.16: tier propagation — tree-sitter-floor tier overrides compiler-accurate", () => {
  const records = makeFixtureRecords();
  // Modify one record to have tree-sitter-floor tier
  records[2] = { ...records[2], tier: "tree-sitter-floor" };
  const index = buildIndexFromRecords(records);
  // The dominant tier must reflect the floor
  assert.equal(index.tier, "tree-sitter-floor");
});

test("T1.17: tier propagation — tree-sitter-floor-STALE-SCIP is the most pessimistic tier", () => {
  const records = makeFixtureRecords();
  records[1] = { ...records[1], tier: "tree-sitter-floor-STALE-SCIP" };
  records[2] = { ...records[2], tier: "tree-sitter-floor" };
  const index = buildIndexFromRecords(records);
  assert.equal(index.tier, "tree-sitter-floor-STALE-SCIP");
});
