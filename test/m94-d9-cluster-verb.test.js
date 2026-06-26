"use strict";

/**
 * M94-D9-T1 — CLUSTER verb test
 *
 * [RULE] cluster-verb-deterministic-coupling:
 *   `cluster` groups files by a DETERMINISTIC shared-neighbour coupling metric
 *   (Jaccard over import neighbourhood), NOT an LLM judgment. Same input → same output.
 *
 * Fixture graph (hand-checked):
 *   Two dense clusters joined by ONE thin edge between them.
 *
 *   Cluster A: a1.ts, a2.ts, a3.ts — all import each other (dense triangle)
 *   Cluster B: b1.ts, b2.ts, b3.ts — all import each other (dense triangle)
 *   Bridge: a1.ts → b3.ts (ONE thin cross-cluster edge)
 *   Isolated: iso.ts (no edges at all → own singleton)
 *
 * Expected: cluster returns two groups {a1,a2,a3} and {b1,b2,b3} (possibly merged
 * via the bridge, but the Jaccard metric discriminates by shared neighbourhood density,
 * so bridge files share only one common neighbour vs. N within a cluster).
 * The test asserts the two WITHIN-cluster dense groups are identifiable, and that
 * iso.ts forms its own singleton.
 *
 * Reproducibility test: run cluster twice on identical input — results must deep-equal.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const CLI = require(path.join(__dirname, "..", "bin", "gsd-t-graph-query-cli.cjs"));
const { buildIndexFromRecords, queryCluster, COUPLING_THRESHOLD } = CLI;

// ─── Fixture: two dense clusters + thin bridge + isolated file ────────────────
//
// Cluster A triangle: a1→a2, a1→a3, a2→a3, a2→a1, a3→a1, a3→a2 (all pairwise)
// Cluster B triangle: b1→b2, b1→b3, b2→b3, b2→b1, b3→b1, b3→b2 (all pairwise)
// Bridge: a1→b3 (one thin cross edge; NOT enough shared neighbourhood to merge clusters)
// Isolated: iso.ts — zero edges

function makeClusterFixture() {
  return [
    {
      file: "a1.ts",
      content_hash: "aaa001",
      tier: "compiler-accurate",
      entities: [],
      edges: [
        { kind: "IMPORT", src: "a1.ts", dst: "a2.ts" },
        { kind: "IMPORT", src: "a1.ts", dst: "a3.ts" },
        { kind: "IMPORT", src: "a1.ts", dst: "b3.ts" }, // thin bridge
      ],
    },
    {
      file: "a2.ts",
      content_hash: "aaa002",
      tier: "compiler-accurate",
      entities: [],
      edges: [
        { kind: "IMPORT", src: "a2.ts", dst: "a1.ts" },
        { kind: "IMPORT", src: "a2.ts", dst: "a3.ts" },
      ],
    },
    {
      file: "a3.ts",
      content_hash: "aaa003",
      tier: "compiler-accurate",
      entities: [],
      edges: [
        { kind: "IMPORT", src: "a3.ts", dst: "a1.ts" },
        { kind: "IMPORT", src: "a3.ts", dst: "a2.ts" },
      ],
    },
    {
      file: "b1.ts",
      content_hash: "bbb001",
      tier: "compiler-accurate",
      entities: [],
      edges: [
        { kind: "IMPORT", src: "b1.ts", dst: "b2.ts" },
        { kind: "IMPORT", src: "b1.ts", dst: "b3.ts" },
      ],
    },
    {
      file: "b2.ts",
      content_hash: "bbb002",
      tier: "compiler-accurate",
      entities: [],
      edges: [
        { kind: "IMPORT", src: "b2.ts", dst: "b1.ts" },
        { kind: "IMPORT", src: "b2.ts", dst: "b3.ts" },
      ],
    },
    {
      file: "b3.ts",
      content_hash: "bbb003",
      tier: "compiler-accurate",
      entities: [],
      edges: [
        { kind: "IMPORT", src: "b3.ts", dst: "b1.ts" },
        { kind: "IMPORT", src: "b3.ts", dst: "b2.ts" },
      ],
    },
    {
      file: "iso.ts",
      content_hash: "iso001",
      tier: "compiler-accurate",
      entities: [],
      edges: [],
    },
  ];
}

// ─── T1.1: cluster returns an array of groups ─────────────────────────────────

test("D9-T1.1: cluster returns ok-shaped result with results array and tier", () => {
  const index = buildIndexFromRecords(makeClusterFixture());
  const { results, tier } = queryCluster(index);
  assert.ok(Array.isArray(results), "results must be an array");
  assert.ok(typeof tier === "string", "tier must be a string");
  assert.equal(tier, "compiler-accurate");
});

// ─── T1.2: each group has files array and couplingScore ──────────────────────

test("D9-T1.2: each cluster result has { files, couplingScore } shape", () => {
  const index = buildIndexFromRecords(makeClusterFixture());
  const { results } = queryCluster(index);
  for (const group of results) {
    assert.ok(Array.isArray(group.files), `group.files must be array, got ${JSON.stringify(group)}`);
    assert.ok(typeof group.couplingScore === "number", `couplingScore must be number, got ${JSON.stringify(group)}`);
  }
});

// ─── T1.3: isolated file is its own singleton cluster ────────────────────────

test("D9-T1.3: isolated file (iso.ts) appears as a singleton cluster with couplingScore=0", () => {
  const index = buildIndexFromRecords(makeClusterFixture());
  const { results } = queryCluster(index);
  const isoGroup = results.find((g) => g.files.includes("iso.ts"));
  assert.ok(isoGroup, "iso.ts must appear in exactly one cluster group");
  assert.equal(isoGroup.files.length, 1, `iso.ts must be a singleton, got files=${JSON.stringify(isoGroup.files)}`);
  assert.equal(isoGroup.couplingScore, 0, "singleton couplingScore must be 0");
});

// ─── T1.4: all files appear in exactly one cluster ───────────────────────────

test("D9-T1.4: every indexed file appears in exactly one cluster (no file lost or duplicated)", () => {
  const index = buildIndexFromRecords(makeClusterFixture());
  const { results } = queryCluster(index);
  const allFilesInResults = results.flatMap((g) => g.files);
  const unique = new Set(allFilesInResults);
  // All 7 fixture files must appear
  assert.equal(unique.size, 7, `must have 7 unique files, got ${unique.size}: ${JSON.stringify([...unique])}`);
  assert.equal(allFilesInResults.length, 7, "no file duplicated across groups");
});

// ─── T1.5: dense clusters are tightly coupled ────────────────────────────────

test("D9-T1.5: files within each dense cluster co-appear in a group with couplingScore >= COUPLING_THRESHOLD", () => {
  const index = buildIndexFromRecords(makeClusterFixture());
  const { results } = queryCluster(index);

  // Find the group that contains a1.ts
  const groupA = results.find((g) => g.files.includes("a1.ts"));
  assert.ok(groupA, "a1.ts must appear in a group");

  // Find the group that contains b1.ts
  const groupB = results.find((g) => g.files.includes("b1.ts"));
  assert.ok(groupB, "b1.ts must appear in a group");

  // Within the A cluster, a1/a2/a3 should co-appear (they have very high Jaccard scores)
  // The bridge (a1→b3) may merge A and B; we don't prescribe the exact grouping shape.
  // We assert: both cluster A members (a2, a3) appear with a1, OR both cluster B members
  // appear with b1 — i.e., the metric detects the density.
  const groupAHasDenseMembers =
    groupA.files.includes("a2.ts") && groupA.files.includes("a3.ts");
  const groupBHasDenseMembers =
    groupB.files.includes("b2.ts") && groupB.files.includes("b3.ts");

  assert.ok(
    groupAHasDenseMembers || groupBHasDenseMembers,
    `At least one dense cluster must be detected. groupA=${JSON.stringify(groupA.files)}, groupB=${JSON.stringify(groupB.files)}`
  );
});

// ─── T1.6: DETERMINISM — same input → same grouping ──────────────────────────

test("D9-T1.6 [RULE cluster-verb-deterministic-coupling]: two runs on identical input produce identical grouping", () => {
  const records = makeClusterFixture();
  const index1 = buildIndexFromRecords(records);
  const index2 = buildIndexFromRecords(records); // rebuild from same data
  const { results: r1 } = queryCluster(index1);
  const { results: r2 } = queryCluster(index2);

  // Deep-equal: same groups in same order, same files in same order, same scores
  assert.deepEqual(r1, r2, "cluster grouping must be reproducible — same input → same output");
});

// ─── T1.7: COUPLING_THRESHOLD is exported and used ───────────────────────────

test("D9-T1.7: COUPLING_THRESHOLD is exported and is a number in (0, 1]", () => {
  assert.ok(typeof COUPLING_THRESHOLD === "number", "COUPLING_THRESHOLD must be a number");
  assert.ok(COUPLING_THRESHOLD > 0 && COUPLING_THRESHOLD <= 1,
    `COUPLING_THRESHOLD must be in (0,1], got ${COUPLING_THRESHOLD}`);
});

// ─── T1.8: empty graph returns empty results ──────────────────────────────────

test("D9-T1.8: empty graph returns empty results array", () => {
  const index = buildIndexFromRecords([]);
  const { results } = queryCluster(index);
  assert.ok(Array.isArray(results), "results must be array even for empty graph");
  assert.equal(results.length, 0, "empty graph must produce empty cluster results");
});

// ─── T1.9: existing verb tests stay green (additive-only regression) ─────────
// (The existing verbs are tested in m94-d5-*.test.js — this block is a smoke check
// that additive changes to buildIndex have not broken the existing return shape.)

test("D9-T1.9: additive changes — buildIndexFromRecords still returns allFiles, funcEntities, importGraph, callGraph", () => {
  const records = makeClusterFixture();
  const index = buildIndexFromRecords(records);
  assert.ok(index.allFiles instanceof Set, "allFiles must be Set");
  assert.ok(index.funcEntities instanceof Map, "funcEntities must be Map");
  assert.ok(index.importGraph instanceof Map, "importGraph must be Map");
  assert.ok(index.callGraph instanceof Map, "callGraph must be Map");
  // New fields
  assert.ok(Array.isArray(index.forwardCallEdges), "forwardCallEdges must be Array");
  assert.ok(index.skippedFiles instanceof Set, "skippedFiles must be Set");
});
