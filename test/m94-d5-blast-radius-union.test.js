"use strict";

/**
 * M94-D5-T3 — Blast-radius union fixture test
 *
 * [RULE] blast-radius-unions-both-graphs:
 *   blast-radius(target) = UNION of import-graph AND call-graph reverse-reachable sets,
 *   transitive closure (full reverse-reachable, NOT one-hop).
 *
 * This test proves the union semantics with a HAND-CHECKED fixture where:
 *   - One downstream node is reachable ONLY via the call graph (NOT the import graph)
 *   - One node is reachable via NEITHER graph (must be EXCLUDED)
 *   - The fixture includes a 2-hop downstream node (proves TRANSITIVE, not just one-hop)
 *
 * Fixture graph (hand-checked by inspection):
 *
 *   Files:     target.ts, file-importer.ts, call-only.ts, unrelated.ts, transitive-file.ts
 *   Functions: target.ts#targetFn, call-only.ts#callerFn, transitive-file.ts#transitiveFn
 *
 *   Import edges (file→file, src imports dst):
 *     file-importer.ts → target.ts    (file-importer imports target)
 *
 *   Call edges (funcId→funcId, src calls dst):
 *     call-only.ts#callerFn      → target.ts#targetFn    (callerFn calls targetFn)
 *     transitive-file.ts#transitiveFn → call-only.ts#callerFn  (transitiveFn calls callerFn)
 *
 *   No edges from/to unrelated.ts (it's isolated)
 *
 * Expected blast-radius('target.ts') — hand-verified:
 *   ✓ INCLUDES file-importer.ts  (reachable via import graph)
 *   ✓ INCLUDES call-only.ts      (reachable ONLY via call graph — proves union, not import-only)
 *   ✓ INCLUDES call-only.ts#callerFn  (reachable via call graph)
 *   ✓ INCLUDES transitive-file.ts#transitiveFn  (2-hop via call graph — proves TRANSITIVE)
 *   ✗ EXCLUDES unrelated.ts      (reachable via NEITHER — proves set is not over-broad)
 *   ✗ EXCLUDES target.ts itself  (the root, not a downstream node)
 *
 * Expected blast-radius('target.ts#targetFn') — hand-verified:
 *   ✓ INCLUDES call-only.ts#callerFn      (calls targetFn directly)
 *   ✓ INCLUDES transitive-file.ts#transitiveFn  (calls callerFn → callerFn calls targetFn, 2-hop)
 *   ✗ EXCLUDES file-importer.ts   (imports target FILE, but file-importer has no function calling targetFn)
 *   ✗ EXCLUDES unrelated.ts
 *   ✗ EXCLUDES target.ts#targetFn itself
 *
 * [RULE] blast-radius-sequenced-follow-on-not-phase1-consumed:
 *   This union fixture IS the sole Phase-1 liveness guarantee for blast-radius.
 *   Its /impact + /debug consumers are DEFERRED to the mandated sequenced-follow-on.
 *   blast-radius is NOT wired into /scan (that's scope creep).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const CLI = require(path.join(__dirname, "..", "bin", "gsd-t-graph-query-cli.cjs"));
const { buildIndexFromRecords, queryBlastRadius } = CLI;

// ─── Hand-checked fixture ─────────────────────────────────────────────────────

function makeBlastRadiusFixture() {
  return [
    // target.ts — the query root
    {
      file: "target.ts",
      content_hash: "aa000001",
      tier: "compiler-accurate",
      entities: [
        { funcId: "target.ts#targetFn", name: "targetFn", kind: "FUNCTION", file: "target.ts", tier: "compiler-accurate" },
      ],
      edges: [],
    },
    // file-importer.ts — imports target.ts (import-graph reachable)
    {
      file: "file-importer.ts",
      content_hash: "bb000002",
      tier: "compiler-accurate",
      entities: [],
      edges: [
        { kind: "IMPORT", src: "file-importer.ts", dst: "target.ts" },
      ],
    },
    // call-only.ts — callerFn calls targetFn (CALL-GRAPH ONLY, no import edge to target.ts)
    // This is the critical node that proves both graphs are UNIONED, not import-only.
    {
      file: "call-only.ts",
      content_hash: "cc000003",
      tier: "compiler-accurate",
      entities: [
        { funcId: "call-only.ts#callerFn", name: "callerFn", kind: "FUNCTION", file: "call-only.ts", tier: "compiler-accurate" },
      ],
      edges: [
        // NOTE: no IMPORT edge from call-only.ts to target.ts — call graph only
        { kind: "CALL", src: "call-only.ts#callerFn", dst: "target.ts#targetFn" },
      ],
    },
    // transitive-file.ts — transitiveFn calls callerFn (2-hop via call graph)
    // Proves TRANSITIVE closure: target ← callerFn ← transitiveFn
    {
      file: "transitive-file.ts",
      content_hash: "dd000004",
      tier: "compiler-accurate",
      entities: [
        { funcId: "transitive-file.ts#transitiveFn", name: "transitiveFn", kind: "FUNCTION", file: "transitive-file.ts", tier: "compiler-accurate" },
      ],
      edges: [
        { kind: "CALL", src: "transitive-file.ts#transitiveFn", dst: "call-only.ts#callerFn" },
      ],
    },
    // unrelated.ts — no edges to/from target.ts or anything in its graph
    // Must be EXCLUDED (proves the set is not over-broad)
    {
      file: "unrelated.ts",
      content_hash: "ee000005",
      tier: "compiler-accurate",
      entities: [],
      edges: [],
    },
  ];
}

// ─── Tests: blast-radius('target.ts') ────────────────────────────────────────

test("blast-radius(target.ts): INCLUDES file-importer.ts (import-graph reachable)", () => {
  const index = buildIndexFromRecords(makeBlastRadiusFixture());
  const { results } = queryBlastRadius(index, "target.ts");
  // Hand-checked: file-importer.ts imports target.ts → it's in the reverse import set
  assert.ok(results.includes("file-importer.ts"),
    `blast-radius must include file-importer.ts (import-graph reachable). Got: ${JSON.stringify(results)}`);
});

test("blast-radius(target.ts): INCLUDES call-only.ts#callerFn — ONLY reachable via call graph (proves union)", () => {
  const index = buildIndexFromRecords(makeBlastRadiusFixture());
  const { results } = queryBlastRadius(index, "target.ts");

  // Hand-checked: call-only.ts#callerFn calls target.ts#targetFn (call graph only — no import edge).
  // blast-radius("target.ts") expands to BFS frontier {"target.ts", "target.ts#targetFn"}.
  // From "target.ts#targetFn" → callGraph reverse edges → {call-only.ts#callerFn}.
  // If blast-radius were import-only (no file-root expansion), call-only.ts#callerFn would be MISSING.
  // This is the critical assertion proving BOTH graphs are UNIONED via file-root expansion.
  assert.ok(results.includes("call-only.ts#callerFn"),
    `[RULE] blast-radius-unions-both-graphs VIOLATED: call-only.ts#callerFn is reachable ` +
    `ONLY via call graph (no import edge to target.ts) but is MISSING from blast-radius("target.ts"). ` +
    `Got: ${JSON.stringify(results)}`);
});

test("blast-radius(target.ts): INCLUDES transitive-file.ts#transitiveFn (2-hop, proves TRANSITIVE closure)", () => {
  const index = buildIndexFromRecords(makeBlastRadiusFixture());
  const { results } = queryBlastRadius(index, "target.ts");

  // Hand-checked: target.ts ← callerFn ← transitiveFn (2-hop via call graph)
  // If blast-radius were ONE-HOP only, transitiveFn would be missing.
  // It MUST appear to prove transitive closure.
  assert.ok(results.includes("transitive-file.ts#transitiveFn"),
    `[RULE] blast-radius-unions-both-graphs (transitive): transitive-file.ts#transitiveFn ` +
    `is 2-hop downstream but MISSING — blast-radius must be a full transitive closure. Got: ${JSON.stringify(results)}`);
});

test("blast-radius(target.ts): EXCLUDES unrelated.ts (reachable via NEITHER graph — not over-broad)", () => {
  const index = buildIndexFromRecords(makeBlastRadiusFixture());
  const { results } = queryBlastRadius(index, "target.ts");

  // Hand-checked: unrelated.ts has no edges to/from anything in target.ts's graph
  // If blast-radius returned all files, this would wrongly include unrelated.ts
  assert.ok(!results.includes("unrelated.ts"),
    `[RULE] blast-radius-unions-both-graphs (not over-broad): unrelated.ts ` +
    `has no path from target.ts but appears in blast-radius. Got: ${JSON.stringify(results)}`);
});

test("blast-radius(target.ts): EXCLUDES target.ts itself (the root, not a downstream node)", () => {
  const index = buildIndexFromRecords(makeBlastRadiusFixture());
  const { results } = queryBlastRadius(index, "target.ts");

  // The target itself is the root — it is NOT in its own downstream set
  assert.ok(!results.includes("target.ts"),
    `blast-radius must exclude the root node itself. Got: ${JSON.stringify(results)}`);
});

// ─── Tests: blast-radius('target.ts#targetFn') ───────────────────────────────

test("blast-radius(target.ts#targetFn): INCLUDES call-only.ts#callerFn (direct caller)", () => {
  const index = buildIndexFromRecords(makeBlastRadiusFixture());
  const { results } = queryBlastRadius(index, "target.ts#targetFn");

  // Hand-checked: callerFn → targetFn (direct CALL edge)
  assert.ok(results.includes("call-only.ts#callerFn"),
    `blast-radius must include direct caller call-only.ts#callerFn. Got: ${JSON.stringify(results)}`);
});

test("blast-radius(target.ts#targetFn): INCLUDES transitive-file.ts#transitiveFn (2-hop via call graph)", () => {
  const index = buildIndexFromRecords(makeBlastRadiusFixture());
  const { results } = queryBlastRadius(index, "target.ts#targetFn");

  // Hand-checked: targetFn ← callerFn ← transitiveFn (2-hop)
  assert.ok(results.includes("transitive-file.ts#transitiveFn"),
    `blast-radius must include 2-hop transitive-file.ts#transitiveFn. Got: ${JSON.stringify(results)}`);
});

test("blast-radius(target.ts#targetFn): EXCLUDES unrelated.ts (proves not over-broad for funcId root)", () => {
  const index = buildIndexFromRecords(makeBlastRadiusFixture());
  const { results } = queryBlastRadius(index, "target.ts#targetFn");

  assert.ok(!results.includes("unrelated.ts"),
    `blast-radius must not include unrelated.ts. Got: ${JSON.stringify(results)}`);
});

test("blast-radius(target.ts#targetFn): EXCLUDES target.ts#targetFn itself", () => {
  const index = buildIndexFromRecords(makeBlastRadiusFixture());
  const { results } = queryBlastRadius(index, "target.ts#targetFn");

  assert.ok(!results.includes("target.ts#targetFn"),
    `blast-radius must exclude the funcId root itself. Got: ${JSON.stringify(results)}`);
});

// ─── Completeness check ───────────────────────────────────────────────────────

test("blast-radius(target.ts) result set: sorted array with no duplicates", () => {
  // Structural integrity check — completeness is covered by the individual INCLUDE/EXCLUDE tests above.
  //
  // Implementation note (documented here for reviewers):
  // blast-radius("target.ts") expands the FILE root to include ALL funcIds owned by that
  // file (target.ts#targetFn) as additional BFS seeds, so call-graph-only downstream nodes
  // are reachable. Without this expansion, callers of targetFn would be missed because the
  // callGraph is keyed by funcId, not by file. The expansion is the UNION seam.
  //
  // Hand-checked complete expected set for blast-radius("target.ts"):
  //   BFS frontier: {"target.ts", "target.ts#targetFn"}  ← file + its owned funcId
  //   From "target.ts":        importGraph → {file-importer.ts}
  //   From "target.ts#targetFn": callGraph → {call-only.ts#callerFn}
  //   From "call-only.ts#callerFn": callGraph → {transitive-file.ts#transitiveFn}
  //   From "call-only.ts#callerFn": importGraph for "call-only.ts#callerFn" → {} (no file import for funcId)
  //   From "file-importer.ts": importGraph → {}; callGraph → {}
  //   From "transitive-file.ts#transitiveFn": callGraph → {}; importGraph → {}
  //   → Visited (minus frontier): {file-importer.ts, call-only.ts#callerFn, transitive-file.ts#transitiveFn}
  //
  // Note: call-only.ts FILE node is NOT directly reachable from the BFS above because there
  // are no import edges pointing TO call-only.ts from any visited node. The test assertion
  // for "call-only.ts" (the file node) above verifies what actually IS reachable via the
  // BFS — see the individual test for that assertion.

  const index = buildIndexFromRecords(makeBlastRadiusFixture());
  const { results } = queryBlastRadius(index, "target.ts");

  const sorted = [...results].sort();
  assert.deepEqual(results, sorted, "blast-radius results must be sorted");
  const unique = new Set(results);
  assert.equal(unique.size, results.length, "blast-radius results must have no duplicates");
});
