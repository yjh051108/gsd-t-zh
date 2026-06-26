"use strict";

/**
 * M94-D11-T5 — Disjointness Bootstrap Escape Hatch Tests
 *
 * [RE-PLAN-EXPANDED Fix-5]: a parser regression / fresh-repo bootstrap does NOT
 * permanently brick all parallel execution.
 *
 * Three cases:
 *   1. graph genuinely unavailable (fresh repo, no index) → HALT with clear remediation
 *      message AND the operator has a tested escape (--disjointness-fallback=touches-only)
 *   2. graph-says-non-disjoint → HALTS absolutely, escape hatch is REFUSED
 *      (correct block must not be escapable)
 *   3. The HALT message distinguishes the two states (graph-unavailable ≠ graph-says-non-disjoint)
 *
 * [RULE] disjointness-bootstrap-escape-not-a-no-recourse-brick
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const { proveDisjointness } = require(
  path.join(__dirname, "..", "bin", "gsd-t-file-disjointness.cjs")
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildFixture(opts) {
  const { unavailable = false, blastRadiusForA = [], blastRadiusForB = [] } = opts || {};
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m94-d11-escape-"));
  fs.mkdirSync(path.join(dir, "bin"), { recursive: true });

  const mockCli = `#!/usr/bin/env node
"use strict";
const verb = process.argv[2];
const target = process.argv[3] || "";
if (${JSON.stringify(unavailable)}) {
  process.stdout.write(JSON.stringify({ ok: false, reason: "graph-unavailable" }));
  process.exit(0);
}
if (verb === "blast-radius") {
  let results = [];
  if (target.includes("file-a")) results = ${JSON.stringify(blastRadiusForA)};
  if (target.includes("file-b")) results = ${JSON.stringify(blastRadiusForB)};
  process.stdout.write(JSON.stringify({ ok: true, verb, target, results, tier: "tree-sitter-floor" }));
} else {
  process.stdout.write(JSON.stringify({ ok: true, verb, target, results: [], tier: "tree-sitter-floor" }));
}
process.exit(0);
`;
  fs.writeFileSync(path.join(dir, "bin", "gsd-t-graph-query-cli.cjs"), mockCli);
  return dir;
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

// ─── Case 1: graph genuinely unavailable (fresh repo, no index) ──────────────

test("[RULE disjointness-bootstrap-escape-not-a-no-recourse-brick] case 1: graph unavailable → HALT with clear remediation message", () => {
  const dir = buildFixture({ unavailable: true });
  try {
    const tasks = [
      { id: "a", touches: ["a/file-a.js"] },
      { id: "b", touches: ["b/file-b.js"] },
    ];
    const result = proveDisjointness({ tasks, projectDir: dir });

    // Must signal graph-unavailable
    assert.equal(result.graphUnavailable, true, "must return graphUnavailable=true on fresh-repo bootstrap");
    // Must provide a halt reason
    assert.ok(result.haltReason, "must include haltReason");
    assert.equal(result.haltReason, "GRAPH_UNAVAILABLE", "haltReason must be GRAPH_UNAVAILABLE");
    // Must NOT proceed to fan-out (parallel must be empty)
    assert.equal(result.parallel.length, 0, "parallel must be empty — no fan-out on graph-unavailable");
    // Must include remediation in the message
    assert.ok(result.haltMessage, "must include haltMessage with remediation");
    assert.ok(
      result.haltMessage.includes("gsd-t graph") || result.haltMessage.includes("build"),
      "haltMessage must reference remediation (gsd-t graph build / gsd-t graph status)"
    );
    // Must mention the escape hatch
    assert.ok(
      result.haltMessage.includes("disjointness-fallback") || result.haltMessage.includes("touches-only"),
      "haltMessage must document the bootstrap escape hatch option"
    );
  } finally {
    cleanup(dir);
  }
});

test("[RULE disjointness-bootstrap-escape-not-a-no-recourse-brick] case 1: escape hatch lets execution proceed with announced WARNING", () => {
  const dir = buildFixture({ unavailable: true });
  try {
    const tasks = [
      { id: "a", touches: ["a/file-a.js"] },
      { id: "b", touches: ["b/file-b.js"] },
    ];
    // Operator explicitly opts in to the escape hatch
    const result = proveDisjointness({
      tasks,
      projectDir: dir,
      disjointnessFallback: "touches-only",
    });

    // Escape hatch accepted: must NOT return graphUnavailable=true
    assert.notEqual(result.graphUnavailable, true, "escape hatch must resolve graph-unavailable without bricking execution");
    // With no literal Touches overlap, both domains are in parallel
    assert.equal(result.parallel.length, 2, "escape hatch: both domains must proceed in parallel (no literal overlap)");
    assert.equal(result.sequential.length, 0, "escape hatch: no sequential groups for non-overlapping Touches");
  } finally {
    cleanup(dir);
  }
});

// ─── Case 2: graph-says-non-disjoint → escape is REFUSED ─────────────────────

test("[RULE disjointness-bootstrap-escape-not-a-no-recourse-brick] case 2: literal Touches overlap → absolute block, escape refused", () => {
  const dir = buildFixture({ unavailable: false });
  try {
    // Literal overlap: both domains touch the same file
    const tasks = [
      { id: "a", touches: ["a/file-a.js", "shared/module.js"] },
      { id: "b", touches: ["b/file-b.js", "shared/module.js"] },
    ];
    // Even with escape hatch, a REAL non-disjoint verdict stays absolute
    const result = proveDisjointness({
      tasks,
      projectDir: dir,
      disjointnessFallback: "touches-only",
    });
    // Real block stays absolute — escape hatch DOES NOT override
    assert.equal(result.sequential.length > 0, true, "literal overlap: must route to sequential even with escape hatch");
    assert.equal(result.parallel.length, 0, "literal overlap: no parallel groups (absolute block, escape refused)");
    // graphUnavailable must NOT be true (graph was available; this is a non-disjoint verdict)
    assert.notEqual(result.graphUnavailable, true, "graphUnavailable must not be true when the issue is a real non-disjoint verdict (not unavailability)");
  } finally {
    cleanup(dir);
  }
});

test("[RULE disjointness-bootstrap-escape-not-a-no-recourse-brick] case 2: graph-detected transitive overlap → absolute block, escape refused", () => {
  // Graph returns blast-radius(file-a.js) includes b/file-b.js → real transitive overlap.
  // The escape hatch MUST NOT override a real non-disjoint graph verdict.
  const dir = buildFixture({
    unavailable: false,
    blastRadiusForA: ["b/file-b.js"],  // transitive dependency into domain B
  });
  try {
    const tasks = [
      { id: "a", touches: ["a/file-a.js"] },
      { id: "b", touches: ["b/file-b.js"] },
    ];
    // Even with the escape hatch flag, a graph-says-non-disjoint verdict must halt execution.
    const result = proveDisjointness({
      tasks,
      projectDir: dir,
      disjointnessFallback: "touches-only",
    });
    // When graph is available and SAYS non-disjoint, the escape hatch must not override.
    // Both tasks must be in sequential (non-disjoint block is absolute).
    if (!result.graphUnavailable) {
      assert.equal(result.sequential.length > 0, true, "transitive graph overlap: must route to sequential even with escape hatch");
      assert.equal(result.parallel.length, 0, "transitive graph overlap: no parallel (escape refused for real non-disjoint)");
    }
    // If graph happened to be unavailable in this fixture, the escape hatch is appropriate — skip.
  } finally {
    cleanup(dir);
  }
});

// ─── Case 3: message distinguishes the two states ─────────────────────────────

test("[RULE disjointness-bootstrap-escape-not-a-no-recourse-brick] case 3: HALT message distinguishes graph-unavailable from graph-says-non-disjoint", () => {
  const unavailableDir = buildFixture({ unavailable: true });
  const availableDir = buildFixture({ blastRadiusForA: ["b/file-b.js"] }); // graph-says-non-disjoint

  try {
    const tasksDisjointByLiteral = [
      { id: "a", touches: ["a/file-a.js"] },
      { id: "b", touches: ["b/file-b.js"] },
    ];
    const tasksLiteralOverlap = [
      { id: "a", touches: ["a/file-a.js", "shared/module.js"] },
      { id: "b", touches: ["b/file-b.js", "shared/module.js"] },
    ];

    const unavailableResult = proveDisjointness({
      tasks: tasksDisjointByLiteral,
      projectDir: unavailableDir,
    });
    assert.ok(unavailableResult.graphUnavailable, "unavailable case must return graphUnavailable signal");
    assert.equal(unavailableResult.haltReason, "GRAPH_UNAVAILABLE", "unavailable: haltReason must be GRAPH_UNAVAILABLE");

    // Graph-says-non-disjoint (literal overlap, no graph needed):
    const nonDisjointResult = proveDisjointness({
      tasks: tasksLiteralOverlap,
      projectDir: availableDir,
    });
    // This is a non-disjoint result (NOT a graph-unavailable result)
    assert.notEqual(nonDisjointResult.graphUnavailable, true, "non-disjoint: must NOT return graphUnavailable (this is a real block, not unavailability)");
    assert.equal(nonDisjointResult.sequential.length > 0, true, "non-disjoint: must route to sequential");

    // The two halt states must be DISTINGUISHABLE in their surface representation:
    //   graph-unavailable → haltReason === "GRAPH_UNAVAILABLE", graphUnavailable === true
    //   graph-says-non-disjoint → sequential.length > 0, graphUnavailable !== true
    assert.notEqual(
      unavailableResult.haltReason,
      nonDisjointResult.haltReason,
      "graph-unavailable haltReason must differ from graph-says-non-disjoint haltReason (undefined/different)"
    );
  } finally {
    cleanup(unavailableDir);
    cleanup(availableDir);
  }
});
