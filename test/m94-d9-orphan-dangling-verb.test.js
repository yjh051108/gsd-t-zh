"use strict";

/**
 * M94-D9-T2 — DEAD-CODE (orphan) + DANGLING verb tests
 *
 * [RULE] dead-code-verb-excludes-entrypoints-and-exports:
 *   Functions with no inbound call or file-import edges — MINUS declared exclusions
 *   (entry points, exported public API, test files). Exclusions declared in the contract.
 *
 * [RULE] dangling-verb-surfaces-missing-dst:
 *   Edges whose dst is a missing node (the delete/rename residue freshness flags).
 *
 * [RULE] orphan-tier-labeled-candidate-not-certainty:
 *   Tree-sitter-floor-tier orphans are labeled CANDIDATE (a missed call could make
 *   a live node look orphan). Compiler-accurate orphans labeled accordingly (candidateLabel=null).
 *
 * Fixture:
 *   - impl.ts: doThing() — called by caller.ts → NOT dead code
 *   - impl.ts: untestedFn() — nobody calls it, file not imported anywhere → dead code
 *   - PublicAPI.ts: PublicClass — uppercase name → EXCLUDED (exported public API)
 *   - bin/cli.ts: cliMain() — in bin/ → EXCLUDED (entry point)
 *   - test/foo.test.ts: testFn() — test file → EXCLUDED
 *   - orphan-floor.ts: floorFn() — tree-sitter-floor tier, no callers → CANDIDATE
 *   - dangling-src.ts → deleted-target.ts (IMPORT edge to a file not in allFiles → dangling)
 *   - dangling-call: call edge from src to a funcId not in funcEntities → dangling
 *   - UNRESOLVED#bar: call edge to UNRESOLVED sentinel → NOT dangling (expected)
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const CLI = require(path.join(__dirname, "..", "bin", "gsd-t-graph-query-cli.cjs"));
const { buildIndexFromRecords, queryDeadCode, queryDangling } = CLI;

// ─── Fixture ──────────────────────────────────────────────────────────────────

function makeOrphanDanglingFixture() {
  return [
    // caller.ts: calls impl.ts#doThing (so doThing has an inbound call edge)
    {
      file: "caller.ts",
      content_hash: "c001",
      tier: "compiler-accurate",
      entities: [
        { funcId: "caller.ts#callSomething@1", name: "callSomething", kind: "FUNCTION", file: "caller.ts", tier: "compiler-accurate" },
      ],
      edges: [
        { kind: "IMPORT", src: "caller.ts", dst: "impl.ts" },
        { kind: "CALL",   src: "caller.ts#callSomething@1", dst: "impl.ts#doThing@5" },
      ],
    },
    // impl.ts: doThing (called) + untestedFn (nobody calls it, file not imported from a caller)
    // NOTE: caller.ts imports impl.ts, so impl.ts IS imported — but untestedFn is NOT called.
    // The dead-code rule: if the FILE is imported, we don't flag individual functions as dead
    // (the file is in use). So untestedFn should NOT appear in dead-code because impl.ts is imported.
    // This is the correct conservative behaviour: file import implies potential use.
    {
      file: "impl.ts",
      content_hash: "i001",
      tier: "compiler-accurate",
      entities: [
        { funcId: "impl.ts#doThing@5", name: "doThing", kind: "FUNCTION", file: "impl.ts", tier: "compiler-accurate" },
        { funcId: "impl.ts#untestedFn@20", name: "untestedFn", kind: "FUNCTION", file: "impl.ts", tier: "compiler-accurate" },
      ],
      edges: [],
    },
    // PublicAPI.ts: PublicClass — uppercase → excluded as exported public API
    {
      file: "PublicAPI.ts",
      content_hash: "p001",
      tier: "compiler-accurate",
      entities: [
        { funcId: "PublicAPI.ts#PublicClass@1", name: "PublicClass", kind: "CLASS", file: "PublicAPI.ts", tier: "compiler-accurate" },
      ],
      edges: [],
    },
    // bin/cli.ts: cliMain — in bin/ → excluded as entry point
    {
      file: "bin/cli.ts",
      content_hash: "b001",
      tier: "compiler-accurate",
      entities: [
        { funcId: "bin/cli.ts#cliMain@1", name: "cliMain", kind: "FUNCTION", file: "bin/cli.ts", tier: "compiler-accurate" },
      ],
      edges: [],
    },
    // test/foo.test.ts: testFn — test file → excluded
    {
      file: "test/foo.test.ts",
      content_hash: "t001",
      tier: "compiler-accurate",
      entities: [
        { funcId: "test/foo.test.ts#testFn@1", name: "testFn", kind: "FUNCTION", file: "test/foo.test.ts", tier: "compiler-accurate" },
      ],
      edges: [
        { kind: "CALL", src: "test/foo.test.ts#testFn@1", dst: "impl.ts#doThing@5" },
      ],
    },
    // orphan-floor.ts: floorFn — tree-sitter-floor tier, no callers, file not imported
    //   → appears in dead-code with candidateLabel="CANDIDATE"
    {
      file: "orphan-floor.ts",
      content_hash: "of001",
      tier: "tree-sitter-floor",
      entities: [
        { funcId: "orphan-floor.ts#floorFn@1", name: "floorFn", kind: "FUNCTION", file: "orphan-floor.ts", tier: "tree-sitter-floor" },
      ],
      edges: [],
    },
    // dangling-src.ts: imports deleted-target.ts (not in allFiles) — dangling IMPORT edge
    //   Also has a CALL edge to a funcId that doesn't exist in funcEntities — dangling CALL
    {
      file: "dangling-src.ts",
      content_hash: "ds001",
      tier: "compiler-accurate",
      entities: [
        { funcId: "dangling-src.ts#danglingCaller@1", name: "danglingCaller", kind: "FUNCTION", file: "dangling-src.ts", tier: "compiler-accurate" },
      ],
      edges: [
        { kind: "IMPORT", src: "dangling-src.ts", dst: "deleted-target.ts" },           // dangling IMPORT
        { kind: "CALL",   src: "dangling-src.ts#danglingCaller@1", dst: "deleted-target.ts#deletedFn@1" }, // dangling CALL
        { kind: "CALL",   src: "dangling-src.ts#danglingCaller@1", dst: "UNRESOLVED#bar" }, // UNRESOLVED sentinel — NOT dangling
      ],
    },
  ];
}

// ─── DEAD-CODE tests ──────────────────────────────────────────────────────────

test("D9-T2.1: queryDeadCode returns array with funcId/file/tier/candidateLabel shape", () => {
  const index = buildIndexFromRecords(makeOrphanDanglingFixture());
  const { results, tier } = queryDeadCode(index);
  assert.ok(Array.isArray(results), "results must be array");
  assert.ok(typeof tier === "string", "tier must be string");
  for (const r of results) {
    assert.ok(typeof r.funcId === "string", `funcId must be string: ${JSON.stringify(r)}`);
    assert.ok(typeof r.file === "string", `file must be string: ${JSON.stringify(r)}`);
    assert.ok(typeof r.tier === "string", `tier must be string: ${JSON.stringify(r)}`);
    // candidateLabel is null or "CANDIDATE"
    assert.ok(r.candidateLabel === null || r.candidateLabel === "CANDIDATE",
      `candidateLabel must be null or "CANDIDATE": ${JSON.stringify(r)}`);
  }
});

test("D9-T2.2: impl.ts functions are NOT dead-code — file is imported by caller.ts", () => {
  // impl.ts is imported by caller.ts → the file is "in use" → its functions excluded
  const index = buildIndexFromRecords(makeOrphanDanglingFixture());
  const { results } = queryDeadCode(index);
  const funcIds = results.map((r) => r.funcId);
  assert.ok(!funcIds.includes("impl.ts#doThing@5"),
    "doThing must not be flagged — it has an inbound CALL edge");
  assert.ok(!funcIds.includes("impl.ts#untestedFn@20"),
    "untestedFn must not be flagged — impl.ts is imported (file in use)");
});

test("D9-T2.3 [RULE dead-code-verb-excludes-entrypoints-and-exports]: entry-point files (bin/) are excluded", () => {
  const index = buildIndexFromRecords(makeOrphanDanglingFixture());
  const { results } = queryDeadCode(index);
  const funcIds = results.map((r) => r.funcId);
  assert.ok(!funcIds.includes("bin/cli.ts#cliMain@1"),
    "cliMain in bin/ must be excluded from dead-code (entry-point)");
});

test("D9-T2.4 [RULE dead-code-verb-excludes-entrypoints-and-exports]: uppercase-named functions excluded (exported public API)", () => {
  const index = buildIndexFromRecords(makeOrphanDanglingFixture());
  const { results } = queryDeadCode(index);
  const funcIds = results.map((r) => r.funcId);
  assert.ok(!funcIds.includes("PublicAPI.ts#PublicClass@1"),
    "PublicClass must be excluded (uppercase → exported public API)");
});

test("D9-T2.5 [RULE dead-code-verb-excludes-entrypoints-and-exports]: test-file functions are excluded", () => {
  const index = buildIndexFromRecords(makeOrphanDanglingFixture());
  const { results } = queryDeadCode(index);
  const funcIds = results.map((r) => r.funcId);
  assert.ok(!funcIds.includes("test/foo.test.ts#testFn@1"),
    "testFn in test/ file must be excluded from dead-code");
});

test("D9-T2.6 [RULE orphan-tier-labeled-candidate-not-certainty]: floor-tier orphan is labeled CANDIDATE", () => {
  const index = buildIndexFromRecords(makeOrphanDanglingFixture());
  const { results } = queryDeadCode(index);
  const floorOrphan = results.find((r) => r.funcId === "orphan-floor.ts#floorFn@1");
  assert.ok(floorOrphan, "orphan-floor.ts#floorFn@1 must appear in dead-code results");
  assert.equal(floorOrphan.candidateLabel, "CANDIDATE",
    "floor-tier orphan must be labeled CANDIDATE, not asserted as definite dead code");
  assert.ok(
    floorOrphan.tier === "tree-sitter-floor" || floorOrphan.tier === "tree-sitter-floor-STALE-SCIP",
    `floor-tier orphan tier must be tree-sitter-floor*, got ${floorOrphan.tier}`
  );
});

test("D9-T2.7: compiler-accurate orphan (if any) has candidateLabel=null (not CANDIDATE)", () => {
  // Use a minimal fixture: one function with no inbound edges and compiler-accurate tier.
  // It should appear with candidateLabel=null (definite dead code, not just candidate).
  const records = [
    {
      file: "lonely.ts",
      content_hash: "lone001",
      tier: "compiler-accurate",
      entities: [
        { funcId: "lonely.ts#loneliness@1", name: "loneliness", kind: "FUNCTION", file: "lonely.ts", tier: "compiler-accurate" },
      ],
      edges: [],
    },
  ];
  const index = buildIndexFromRecords(records);
  const { results } = queryDeadCode(index);
  const entry = results.find((r) => r.funcId === "lonely.ts#loneliness@1");
  assert.ok(entry, "loneliness must be in dead-code (no inbound edges, compiler-accurate, no exclusion)");
  assert.equal(entry.candidateLabel, null,
    "compiler-accurate orphan must have candidateLabel=null (definite, not candidate)");
});

test("D9-T2.8: results are sorted deterministically by funcId", () => {
  const index = buildIndexFromRecords(makeOrphanDanglingFixture());
  const { results } = queryDeadCode(index);
  const funcIds = results.map((r) => r.funcId);
  const sorted = [...funcIds].sort();
  assert.deepEqual(funcIds, sorted, "dead-code results must be sorted by funcId");
});

// ─── DANGLING tests ───────────────────────────────────────────────────────────

test("D9-T2.9: queryDangling returns array with src/dst/kind/note shape", () => {
  const index = buildIndexFromRecords(makeOrphanDanglingFixture());
  const { results, tier } = queryDangling(index);
  assert.ok(Array.isArray(results), "results must be array");
  assert.ok(typeof tier === "string", "tier must be string");
  for (const r of results) {
    assert.ok(typeof r.src === "string", `src must be string: ${JSON.stringify(r)}`);
    assert.ok(typeof r.dst === "string", `dst must be string: ${JSON.stringify(r)}`);
    assert.ok(r.kind === "CALL" || r.kind === "IMPORT", `kind must be CALL or IMPORT: ${JSON.stringify(r)}`);
    assert.ok(typeof r.note === "string", `note must be string: ${JSON.stringify(r)}`);
  }
});

test("D9-T2.10 [RULE dangling-verb-surfaces-missing-dst]: dangling IMPORT edge to deleted file appears", () => {
  const index = buildIndexFromRecords(makeOrphanDanglingFixture());
  const { results } = queryDangling(index);
  const danglingImport = results.find(
    (r) => r.kind === "IMPORT" && r.dst === "deleted-target.ts"
  );
  assert.ok(danglingImport,
    `dangling IMPORT edge to deleted-target.ts must appear in dangling results. Got: ${JSON.stringify(results)}`);
  assert.equal(danglingImport.src, "dangling-src.ts");
});

test("D9-T2.11 [RULE dangling-verb-surfaces-missing-dst]: dangling CALL edge to missing funcId appears", () => {
  const index = buildIndexFromRecords(makeOrphanDanglingFixture());
  const { results } = queryDangling(index);
  const danglingCall = results.find(
    (r) => r.kind === "CALL" && r.dst === "deleted-target.ts#deletedFn@1"
  );
  assert.ok(danglingCall,
    `dangling CALL edge to deleted-target.ts#deletedFn@1 must appear. Got: ${JSON.stringify(results)}`);
});

test("D9-T2.12: UNRESOLVED# sentinel is NOT reported as a dangling edge", () => {
  // UNRESOLVED# targets are expected at tree-sitter floor — they are unknown call targets,
  // NOT deleted nodes. dangling must NOT flag them.
  const index = buildIndexFromRecords(makeOrphanDanglingFixture());
  const { results } = queryDangling(index);
  const unresolvedDangling = results.filter((r) => r.dst.startsWith("UNRESOLVED#"));
  assert.equal(unresolvedDangling.length, 0,
    `UNRESOLVED# targets must NOT appear in dangling results, got: ${JSON.stringify(unresolvedDangling)}`);
});

test("D9-T2.13: real indexed edges (non-dangling) do not appear in dangling results", () => {
  // caller.ts#callSomething → impl.ts#doThing — both nodes exist, must not appear in dangling
  const index = buildIndexFromRecords(makeOrphanDanglingFixture());
  const { results } = queryDangling(index);
  const falsePositive = results.find(
    (r) => r.dst === "impl.ts#doThing@5"
  );
  assert.ok(!falsePositive,
    "impl.ts#doThing@5 exists in the index — must not appear as dangling");
});
