"use strict";

/**
 * M94-D7-T1 — Graph dispatch integration test
 *
 * Verifies that the Fix-1 rewire is complete and correct:
 *   (a) `gsd-t graph status` and `gsd-t graph who-imports` shell through the
 *       ENTRY POINT (bin/gsd-t.js) and hit the NEW D5 CLI — NEVER the dead
 *       M20–M21 "No graph index found" string from the old dead engine.
 *   (b) The 6 dead bin/graph-*.js + 3 dead test/graph-*.test.js files NO LONGER
 *       exist on disk.
 *   (c) bin/gsd-t.js LOADS cleanly (no ReferenceError from a dangling export of
 *       a deleted function). [RULE] graph-rewire-no-dangling-export
 *   (d) `gsd-t graph --output json` still emits the M44 task DAG (the separate
 *       working feature is not collateral-damaged by the rewire).
 *   (e) `gsd-t graph index` does NOT throw and does NOT hit the dead engine.
 *
 * [RULE] graph-status-live
 * [RULE] graph-rewire-no-dangling-export
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const PROJECT_ROOT = path.join(__dirname, "..");
const GSD_T_ENTRY = path.join(PROJECT_ROOT, "bin", "gsd-t.js");

// ─── Dead file list (should no longer exist after Fix-1) ─────────────────────

const DEAD_ENGINE_FILES = [
  "bin/graph-store.js",
  "bin/graph-cgc.js",
  "bin/graph-indexer.js",
  "bin/graph-overlay.js",
  "bin/graph-parsers.js",
  "bin/graph-query.js",
  "test/graph-indexer.test.js",
  "test/graph-store.test.js",
  "test/graph-query.test.js",
].map(p => path.join(PROJECT_ROOT, p));

// The exact dead-path string from the M20–M21 engine (must NEVER appear in output)
const DEAD_PATH_MARKER = "No graph index found. Run: gsd-t graph index";

// ─── Helper ───────────────────────────────────────────────────────────────────

// Graph-query subprocesses MUST run against a TINY fixture repo, never the real
// GSD-T repo. Running `gsd-t graph status/who-imports` from PROJECT_ROOT made the
// subprocess load + query the repo's real ~56 MB .gsd-t/graph.db; multiplied across
// the full suite under piped stdio that compounded into an effective HANG (the
// verify-gate symptom — db present → suite hangs forever; db absent → suite passes).
// Build a 2-file fixture index once and point the graph queries at it via cwd.
const os = require("node:os");
let FIXTURE_REPO = null;
function fixtureRepo() {
  if (FIXTURE_REPO) return FIXTURE_REPO;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m94-dispatch-fixture-"));
  fs.mkdirSync(path.join(dir, ".gsd-t"), { recursive: true });
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  fs.writeFileSync(path.join(dir, "src", "b.ts"), "export function b() { return 1; }\n");
  fs.writeFileSync(path.join(dir, "src", "a.ts"), "import { b } from './b';\nexport function a() { return b(); }\n");
  try {
    const { build_index } = require(path.join(PROJECT_ROOT, "bin", "gsd-t-graph-index.cjs"));
    build_index(dir, { dbPath: path.join(dir, ".gsd-t", "graph.db") });
  } catch { /* index build best-effort; dispatch-routing tests don't need it */ }
  FIXTURE_REPO = dir;
  return dir;
}

function runGsdT(args, options) {
  return spawnSync(process.execPath, [GSD_T_ENTRY].concat(args), {
    encoding: "utf8",
    // Default to the tiny fixture repo so graph queries never touch the real
    // repo's large index. Callers that test dispatch ROUTING (not a real query)
    // can still override cwd via options if they need PROJECT_ROOT.
    cwd: fixtureRepo(),
    timeout: 30000,
    ...options,
  });
}

// ─── (c) Load-time safety ─────────────────────────────────────────────────────

test("bin/gsd-t.js loads without ReferenceError — no dangling exports of deleted functions", () => {
  // [RULE] graph-rewire-no-dangling-export
  // A dangling module.exports of a deleted function = load-time ReferenceError
  // on every gsd-t command. This test catches it by requiring the file directly.
  let loadError = null;
  try {
    // Use a fresh require (not cached) by clearing the cache first
    delete require.cache[require.resolve(GSD_T_ENTRY)];
    require(GSD_T_ENTRY);
  } catch (e) {
    loadError = e;
  }
  assert.strictEqual(
    loadError,
    null,
    `bin/gsd-t.js threw on load: ${loadError && loadError.message}. ` +
    `This means a deleted function is still referenced in module.exports. ` +
    `[RULE] graph-rewire-no-dangling-export`
  );
});

test("gsd-t status exits cleanly (no load-time ReferenceError)", () => {
  const r = runGsdT(["status"]);
  assert.notStrictEqual(r.status, null, "gsd-t status timed out");
  assert.ok(
    r.status === 0 || (r.stdout || "").toLowerCase().includes("gsd-t"),
    `gsd-t status should exit cleanly, got status=${r.status}, stderr: ${r.stderr && r.stderr.slice(0, 200)}`
  );
  // Must not have ReferenceError or TypeError in stderr
  assert.ok(
    !(r.stderr || "").includes("ReferenceError"),
    `gsd-t status has a ReferenceError in stderr — dangling export of deleted function? stderr: ${r.stderr && r.stderr.slice(0, 400)}`
  );
});

// ─── (b) Dead files gone ──────────────────────────────────────────────────────

test("All 6 dead bin/graph-*.js files are deleted from disk", () => {
  const stillExist = DEAD_ENGINE_FILES.filter(p => p.includes("bin/graph-") && fs.existsSync(p));
  assert.deepStrictEqual(
    stillExist,
    [],
    `The following dead engine files still exist (should be deleted, USER-APPROVED): ${stillExist.map(p => path.relative(PROJECT_ROOT, p)).join(", ")}`
  );
});

test("All 3 dead test/graph-*.test.js files are deleted from disk", () => {
  const stillExist = DEAD_ENGINE_FILES.filter(p => p.includes("test/graph-") && fs.existsSync(p));
  assert.deepStrictEqual(
    stillExist,
    [],
    `The following dead test files still exist (should be deleted, USER-APPROVED): ${stillExist.map(p => path.relative(PROJECT_ROOT, p)).join(", ")}`
  );
});

// ─── (a) gsd-t graph status hits the NEW CLI (not the dead path) ─────────────

test("gsd-t graph status hits the NEW D5 CLI — NEVER the dead 'No graph index found' path", () => {
  // [RULE] graph-status-live
  const r = runGsdT(["graph", "status"]);
  const combined = (r.stdout || "") + (r.stderr || "");

  assert.ok(
    !combined.includes(DEAD_PATH_MARKER),
    `gsd-t graph status hit the DEAD M20–M21 path! Found the dead string: "${DEAD_PATH_MARKER}". ` +
    `The rewire to the D5 CLI did not take effect. Combined output: ${combined.slice(0, 400)}`
  );

  // The new CLI returns either a live index answer or "graph-unavailable" (fail-loud)
  // The output should contain "Graph" (our heading) and either "unavailable" or a live result
  assert.ok(
    combined.includes("Graph") || combined.includes("graph"),
    `gsd-t graph status should produce output mentioning "Graph", got: ${combined.slice(0, 200)}`
  );
});

// ─── (a) gsd-t graph who-imports hits the NEW CLI ───────────────────────────

test("gsd-t graph who-imports hits the NEW D5 CLI — not the dead path", () => {
  // [RULE] graph-status-live
  // Use a dummy file — expected: graph-unavailable (no index) or actual results
  // Never: the dead "No graph index found" string
  const r = runGsdT(["graph", "who-imports", "src/fake-file.js"]);
  const combined = (r.stdout || "") + (r.stderr || "");

  assert.ok(
    !combined.includes(DEAD_PATH_MARKER),
    `gsd-t graph who-imports hit the DEAD path! Found: "${DEAD_PATH_MARKER}". Combined: ${combined.slice(0, 400)}`
  );

  // The new CLI outputs JSON — check it is valid JSON or mentions graph-unavailable
  const trimmed = (r.stdout || "").trim();
  if (trimmed) {
    let parsed;
    try { parsed = JSON.parse(trimmed); } catch { /* might be non-JSON on error */ }
    if (parsed) {
      // Either { ok: true, ... } (live result) or { ok: false, reason: 'graph-unavailable' }
      assert.ok(
        "ok" in parsed,
        `D5 CLI output should be a JSON envelope with 'ok' field, got: ${JSON.stringify(parsed)}`
      );
    }
  }
});

// ─── (a) gsd-t graph body routes to the D5 CLI (M98 front-door wiring) ───────

test("gsd-t graph body routes through the router to the D5 CLI — NOT 'Unknown graph subcommand'", () => {
  // M98 regression guard: the `body` verb (function source slices) lived in the
  // query CLI but the top-level `gsd-t graph` router had no `case "body"`, so
  // `gsd-t graph body <fn>` fell through to "Unknown graph subcommand" — the
  // headline M98 feature was unreachable from the front door. This test calls
  // the ENTRY POINT (not the CLI directly) so the router wiring is exercised.
  const r = runGsdT(["graph", "body", "a"]);
  const combined = (r.stdout || "") + (r.stderr || "");

  assert.ok(
    !combined.includes("Unknown graph subcommand"),
    `gsd-t graph body fell through to the Unknown-subcommand default — the router ` +
    `is missing 'case "body"'. Combined: ${combined.slice(0, 400)}`
  );

  // The router prints the CLI's JSON envelope. It must be a valid { ok, verb:"body" }
  // envelope — either a real slice (ok:true) or an honest not-found/unavailable.
  const trimmed = (r.stdout || "").trim();
  assert.ok(trimmed, `gsd-t graph body produced no stdout. stderr: ${r.stderr && r.stderr.slice(0, 200)}`);
  let parsed;
  try { parsed = JSON.parse(trimmed); } catch { /* fall through to assert below */ }
  assert.ok(
    parsed && "ok" in parsed && parsed.verb === "body",
    `gsd-t graph body should emit a JSON envelope { ok, verb:"body", ... }, got: ${trimmed.slice(0, 200)}`
  );
});

// ─── (d) task-DAG path preserved ─────────────────────────────────────────────

test("gsd-t graph --output json still emits the M44 task DAG (not collateral-damaged)", () => {
  // The task-DAG verb reads the REAL repo's .gsd-t/domains/ (not the graph index),
  // so it must run from PROJECT_ROOT — the empty fixture has no tasks. (Only the
  // graph-QUERY verbs use the fixture, to avoid the real 56 MB index.)
  const r = runGsdT(["graph", "--output", "json"], { cwd: PROJECT_ROOT });
  assert.strictEqual(r.status, 0, `gsd-t graph --output json failed with status ${r.status}, stderr: ${r.stderr && r.stderr.slice(0, 200)}`);

  let dag;
  try {
    dag = JSON.parse(r.stdout);
  } catch {
    assert.fail(`gsd-t graph --output json output is not valid JSON: ${(r.stdout || "").slice(0, 200)}`);
  }

  // The M44 task DAG has a 'nodes' array (tasks) and 'edges' array (dependencies)
  assert.ok(
    Array.isArray(dag.nodes),
    `Task DAG JSON should have a 'nodes' array, got keys: ${Object.keys(dag || {}).join(", ")}`
  );
  // Assert the task-DAG SHAPE (not-collateral-damaged into entity-graph output),
  // NOT a non-empty node count. A completed milestone legitimately has ZERO live
  // domains (they're archived at complete-milestone), so `nodes: []` is a valid
  // state — the invariant is that the DAG path still emits task-DAG-shaped JSON.
  assert.ok(
    Array.isArray(dag.nodes) && Array.isArray(dag.edges),
    `Task DAG JSON should have 'nodes' + 'edges' arrays (task-DAG shape, not entity graph), got keys: ${Object.keys(dag || {}).join(", ")}`
  );
  // If any live domains exist, their nodes must look like tasks (id/domain fields).
  if (dag.nodes.length > 0) {
    const firstNode = dag.nodes[0];
    assert.ok(
      firstNode && (firstNode.id || firstNode.domain),
      `Task DAG nodes should have 'id' or 'domain' fields (GSD-T task format), got: ${JSON.stringify(firstNode)}`
    );
  }
});

// ─── (e) gsd-t graph index does not throw or hit dead engine ─────────────────

test("gsd-t graph index does not throw and does not hit the dead M20–M21 engine", () => {
  // [RULE] graph-status-live
  // This invokes doGraphIndex() which now delegates to gsd-t-graph-index.cjs.
  // Even if no SCIP indexer is present (expected in CI), it should NOT reference
  // the deleted graph-indexer.js and should NOT crash with ReferenceError.
  const r = runGsdT(["graph", "index"], { timeout: 60000 });

  assert.ok(
    !(r.stderr || "").includes("ReferenceError"),
    `gsd-t graph index has a ReferenceError — it may still reference the deleted engine. stderr: ${r.stderr && r.stderr.slice(0, 400)}`
  );
  assert.ok(
    !(r.stderr || "").includes("Cannot find module './graph-indexer'"),
    `gsd-t graph index tried to require the deleted graph-indexer.js. stderr: ${r.stderr && r.stderr.slice(0, 400)}`
  );
  // Must not print the dead path marker
  const combined = (r.stdout || "") + (r.stderr || "");
  assert.ok(
    !combined.includes(DEAD_PATH_MARKER),
    `gsd-t graph index hit the DEAD path: "${DEAD_PATH_MARKER}". combined: ${combined.slice(0, 400)}`
  );
});
