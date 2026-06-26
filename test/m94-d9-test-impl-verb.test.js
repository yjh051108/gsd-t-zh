"use strict";

/**
 * M94-D9-T3 — TEST→IMPL coverage verb test
 *
 * [RULE] test-impl-verb-from-call-site-edges-no-new-type:
 *   test-impl is derived by filtering existing call-site edges by test-path source.
 *   NO new edge type was added to the indexer — the verb works on existing CALL edges.
 *
 * [RULE] test-impl-no-new-edge-type-needed:
 *   Asserted by the test: the verb works WITHOUT any D3 edge-type change.
 *   (The "confirm-not-add" decision recorded as a test invariant.)
 *
 * [RULE] test-impl-never-presents-unresolved-as-coverage:
 *   UNRESOLVED# targets must NEVER appear in the implFuncs coverage set.
 *
 * Fixture repo:
 *   foo.test.ts: testFoo() calls impl.ts#doThing@5 (resolved) + UNRESOLVED#helper (unresolved)
 *   foo.test.ts: testFoo() also calls impl.ts#doOther@10
 *   impl.ts: doThing@5 — called by testFoo (tested)
 *   impl.ts: doOther@10 — also called by testFoo (tested)
 *   impl.ts: untestedFn@20 — called by NO test (untested)
 *   impl.ts: untestedFn@20 — called by prod.ts (prod caller) (still untested from test perspective)
 *   impl.ts: bothTested@30 — called by test AND prod (still tested)
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const CLI = require(path.join(__dirname, "..", "bin", "gsd-t-graph-query-cli.cjs"));
const {
  buildIndexFromRecords,
  queryTestImpl,
  UNRESOLVED_PREFIX,
  DEFAULT_TEST_PATTERNS,
} = CLI;

// ─── Fixture ──────────────────────────────────────────────────────────────────

function makeTestImplFixture() {
  return [
    // impl.ts: doThing (tested), doOther (tested), untestedFn (not tested), bothTested (tested+prod)
    {
      file: "impl.ts",
      content_hash: "impl001",
      tier: "compiler-accurate",
      entities: [
        { funcId: "impl.ts#doThing@5",    name: "doThing",    kind: "FUNCTION", file: "impl.ts", tier: "compiler-accurate" },
        { funcId: "impl.ts#doOther@10",   name: "doOther",    kind: "FUNCTION", file: "impl.ts", tier: "compiler-accurate" },
        { funcId: "impl.ts#untestedFn@20",name: "untestedFn", kind: "FUNCTION", file: "impl.ts", tier: "compiler-accurate" },
        { funcId: "impl.ts#bothTested@30",name: "bothTested", kind: "FUNCTION", file: "impl.ts", tier: "compiler-accurate" },
      ],
      edges: [],
    },
    // foo.test.ts: testFoo calls doThing, doOther, UNRESOLVED#helper, bothTested
    {
      file: "test/foo.test.ts",
      content_hash: "test001",
      tier: "compiler-accurate",
      entities: [
        { funcId: "test/foo.test.ts#testFoo@1", name: "testFoo", kind: "FUNCTION", file: "test/foo.test.ts", tier: "compiler-accurate" },
      ],
      edges: [
        { kind: "IMPORT", src: "test/foo.test.ts", dst: "impl.ts" },
        { kind: "CALL",   src: "test/foo.test.ts#testFoo@1", dst: "impl.ts#doThing@5" },
        { kind: "CALL",   src: "test/foo.test.ts#testFoo@1", dst: "impl.ts#doOther@10" },
        { kind: "CALL",   src: "test/foo.test.ts#testFoo@1", dst: "UNRESOLVED#helper" }, // UNRESOLVED — must be excluded
        { kind: "CALL",   src: "test/foo.test.ts#testFoo@1", dst: "impl.ts#bothTested@30" },
      ],
    },
    // prod.ts: prodFn calls untestedFn + bothTested (prod callers — should not affect test coverage)
    {
      file: "prod.ts",
      content_hash: "prod001",
      tier: "compiler-accurate",
      entities: [
        { funcId: "prod.ts#prodFn@1", name: "prodFn", kind: "FUNCTION", file: "prod.ts", tier: "compiler-accurate" },
      ],
      edges: [
        { kind: "IMPORT", src: "prod.ts", dst: "impl.ts" },
        { kind: "CALL",   src: "prod.ts#prodFn@1", dst: "impl.ts#untestedFn@20" },
        { kind: "CALL",   src: "prod.ts#prodFn@1", dst: "impl.ts#bothTested@30" },
      ],
    },
  ];
}

// ─── Forward mode tests ───────────────────────────────────────────────────────

test("D9-T3.1: queryTestImpl forward mode returns mode='forward' and results array", () => {
  const index = buildIndexFromRecords(makeTestImplFixture());
  const { results, tier, mode } = queryTestImpl(index);
  assert.equal(mode, "forward");
  assert.ok(Array.isArray(results), "results must be array");
  assert.ok(typeof tier === "string", "tier must be string");
});

test("D9-T3.2: each forward result has { testFunc, implFuncs } shape", () => {
  const index = buildIndexFromRecords(makeTestImplFixture());
  const { results } = queryTestImpl(index);
  for (const r of results) {
    assert.ok(typeof r.testFunc === "string", `testFunc must be string: ${JSON.stringify(r)}`);
    assert.ok(Array.isArray(r.implFuncs), `implFuncs must be array: ${JSON.stringify(r)}`);
  }
});

test("D9-T3.3: test/foo.test.ts#testFoo@1 appears in forward results with its impl callee funcIds", () => {
  const index = buildIndexFromRecords(makeTestImplFixture());
  const { results } = queryTestImpl(index);
  const testFooEntry = results.find((r) => r.testFunc === "test/foo.test.ts#testFoo@1");
  assert.ok(testFooEntry,
    `test/foo.test.ts#testFoo@1 must appear in forward results. Got: ${JSON.stringify(results)}`);
  assert.ok(testFooEntry.implFuncs.includes("impl.ts#doThing@5"),
    "doThing must be in testFoo's implFuncs");
  assert.ok(testFooEntry.implFuncs.includes("impl.ts#doOther@10"),
    "doOther must be in testFoo's implFuncs");
  assert.ok(testFooEntry.implFuncs.includes("impl.ts#bothTested@30"),
    "bothTested must be in testFoo's implFuncs");
});

test("D9-T3.4 [RULE test-impl-never-presents-unresolved-as-coverage]: UNRESOLVED# targets excluded from implFuncs", () => {
  const index = buildIndexFromRecords(makeTestImplFixture());
  const { results } = queryTestImpl(index);
  const testFooEntry = results.find((r) => r.testFunc === "test/foo.test.ts#testFoo@1");
  assert.ok(testFooEntry, "testFoo must appear in results");
  const hasUnresolved = testFooEntry.implFuncs.some((f) => f.startsWith(UNRESOLVED_PREFIX));
  assert.equal(hasUnresolved, false,
    `UNRESOLVED# targets must NEVER appear in implFuncs (violation of [RULE] test-impl-never-presents-unresolved-as-coverage). Got implFuncs: ${JSON.stringify(testFooEntry.implFuncs)}`);
});

test("D9-T3.5: prod.ts functions do NOT appear in forward results (not a test file)", () => {
  const index = buildIndexFromRecords(makeTestImplFixture());
  const { results } = queryTestImpl(index);
  const prodEntry = results.find((r) => r.testFunc.startsWith("prod.ts"));
  assert.ok(!prodEntry,
    `prod.ts must not appear as a testFunc — it is not a test file. Got: ${JSON.stringify(results.map((r) => r.testFunc))}`);
});

test("D9-T3.6: implFuncs are deduped and sorted", () => {
  const index = buildIndexFromRecords(makeTestImplFixture());
  const { results } = queryTestImpl(index);
  for (const r of results) {
    const sorted = [...r.implFuncs].sort();
    assert.deepEqual(r.implFuncs, sorted,
      `implFuncs must be sorted: ${JSON.stringify(r.implFuncs)}`);
    const unique = new Set(r.implFuncs);
    assert.equal(unique.size, r.implFuncs.length,
      `implFuncs must have no duplicates: ${JSON.stringify(r.implFuncs)}`);
  }
});

// ─── Inverse (untested-impl) mode tests ──────────────────────────────────────

test("D9-T3.7: queryTestImpl inverse mode returns mode='untested-impl' and results array", () => {
  const index = buildIndexFromRecords(makeTestImplFixture());
  const { results, tier, mode } = queryTestImpl(index, { inverse: true });
  assert.equal(mode, "untested-impl");
  assert.ok(Array.isArray(results), "results must be array");
  assert.ok(typeof tier === "string", "tier must be string");
});

test("D9-T3.8: each inverse result has { funcId, file } shape", () => {
  const index = buildIndexFromRecords(makeTestImplFixture());
  const { results } = queryTestImpl(index, { inverse: true });
  for (const r of results) {
    assert.ok(typeof r.funcId === "string", `funcId must be string: ${JSON.stringify(r)}`);
    assert.ok(typeof r.file === "string", `file must be string: ${JSON.stringify(r)}`);
  }
});

test("D9-T3.9: impl.ts#untestedFn@20 appears in untested-impl — no test caller", () => {
  const index = buildIndexFromRecords(makeTestImplFixture());
  const { results } = queryTestImpl(index, { inverse: true });
  const funcIds = results.map((r) => r.funcId);
  assert.ok(funcIds.includes("impl.ts#untestedFn@20"),
    `impl.ts#untestedFn@20 must appear in untested-impl. Got: ${JSON.stringify(funcIds)}`);
});

test("D9-T3.10: impl.ts#doThing@5 does NOT appear in untested-impl — has a test caller", () => {
  const index = buildIndexFromRecords(makeTestImplFixture());
  const { results } = queryTestImpl(index, { inverse: true });
  const funcIds = results.map((r) => r.funcId);
  assert.ok(!funcIds.includes("impl.ts#doThing@5"),
    "doThing has a test caller — must NOT appear in untested-impl");
});

test("D9-T3.11: impl.ts#bothTested@30 does NOT appear in untested-impl (has test caller + prod caller)", () => {
  const index = buildIndexFromRecords(makeTestImplFixture());
  const { results } = queryTestImpl(index, { inverse: true });
  const funcIds = results.map((r) => r.funcId);
  assert.ok(!funcIds.includes("impl.ts#bothTested@30"),
    "bothTested has a test caller — must NOT appear in untested-impl (even though prod also calls it)");
});

test("D9-T3.12: test-file functions do NOT appear in untested-impl", () => {
  const index = buildIndexFromRecords(makeTestImplFixture());
  const { results } = queryTestImpl(index, { inverse: true });
  for (const r of results) {
    const isTest = DEFAULT_TEST_PATTERNS.some((re) => re.test(r.file));
    assert.ok(!isTest,
      `test-file function must not appear in untested-impl: ${r.funcId}`);
  }
});

// ─── [RULE] test-impl-no-new-edge-type-needed ─────────────────────────────────

test("D9-T3.13 [RULE test-impl-no-new-edge-type-needed]: verb works on fixture with only IMPORT+CALL edges (no new edge type)", () => {
  // This test encodes the "confirm-not-add" decision: the verb works purely on existing
  // call-site edges. It does NOT require any new edge type in the indexer output.
  // If the verb required a new edge type, this fixture (which has none) would produce no results —
  // but it DOES produce results, proving the verb uses only existing CALL edges.
  const index = buildIndexFromRecords(makeTestImplFixture());
  const edgeKinds = new Set(
    makeTestImplFixture().flatMap((rec) => rec.edges.map((e) => e.kind))
  );
  // Assert: fixture uses only IMPORT and CALL edges (no new "TEST_CALL" or similar)
  assert.ok(edgeKinds.has("IMPORT") || edgeKinds.has("CALL"), "fixture has IMPORT or CALL edges");
  assert.ok(!edgeKinds.has("TEST_CALL"), "fixture must NOT have a TEST_CALL edge type");
  assert.ok(!edgeKinds.has("TEST_IMPL"), "fixture must NOT have a TEST_IMPL edge type");

  // And the verb still returns results
  const { results } = queryTestImpl(index);
  const testFooEntry = results.find((r) => r.testFunc === "test/foo.test.ts#testFoo@1");
  assert.ok(testFooEntry && testFooEntry.implFuncs.length > 0,
    "verb must return test→impl coverage using only existing CALL edges");
});

// ─── funcId-keyed (R4-3) assertion ───────────────────────────────────────────

test("D9-T3.14: implFuncs are file#function@LINE funcIds, not bare names", () => {
  const index = buildIndexFromRecords(makeTestImplFixture());
  const { results } = queryTestImpl(index);
  const testFooEntry = results.find((r) => r.testFunc === "test/foo.test.ts#testFoo@1");
  assert.ok(testFooEntry, "testFoo must appear in results");
  for (const funcId of testFooEntry.implFuncs) {
    // funcId must contain '#' (file-qualified) — not a bare name
    assert.ok(funcId.includes("#"),
      `implFuncs must be file-qualified funcIds (file#function@LINE), got: ${funcId}`);
  }
});
