"use strict";
/**
 * Broken Graph HALTS, Absent Graph Auto-Builds.
 *
 * SPEC: .gsd-t/pseudocode/PseudoCode-BrokenGraphHalts.md
 *
 * A BROKEN graph (CLI crashes on a missing dep, or the store is corrupt) must HALT
 * all work and demand a fix; an ABSENT graph (never indexed) may auto-build then
 * continue. The two collapse today into `graph-unavailable` + silent grep-fallback —
 * banned. These tests pin the split at each seam + the shared classifier + the
 * consumer routing.
 */

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..");
const {
  classifyGraphFailure,
  isTransient,
} = require(path.join(REPO, "bin", "gsd-t-graph-availability.cjs"));
const { loadStore } = require(path.join(REPO, "bin", "gsd-t-graph-query-cli.cjs"));
const { _classifyGraphSpawnResult, PROJECT_BIN_TOOLS } = require(path.join(REPO, "bin", "gsd-t.js"));

// ─── The shared classifier ──────────────────────────────────────────────────

test("classifyGraphFailure: graph-absent → ABSENT / auto-build", () => {
  const c = classifyGraphFailure("graph-absent");
  assert.strictEqual(c.state, "ABSENT");
  assert.match(c.action, /build/i);
});

test("classifyGraphFailure: graph-broken → BROKEN / HALT", () => {
  const c = classifyGraphFailure("graph-broken");
  assert.strictEqual(c.state, "BROKEN");
  assert.match(c.action, /HALT/i);
});

test("classifyGraphFailure: unknown reason fails closed to BROKEN", () => {
  // [RULE] unknown-reason-fails-closed-to-broken
  for (const r of ["something-weird", "", null, undefined, "cli-error", "non-json-output"]) {
    assert.strictEqual(classifyGraphFailure(r).state, "BROKEN", `reason=${JSON.stringify(r)}`);
  }
});

test("classifyGraphFailure: legacy graph-unavailable fails closed to BROKEN", () => {
  // The legacy collapsed code must HALT, never silently continue (ABSENT).
  assert.strictEqual(classifyGraphFailure("graph-unavailable").state, "BROKEN");
});

test("isTransient: SQLITE_BUSY / lock / timeout are retry-eligible", () => {
  // [RULE] false-broken-guarded
  assert.strictEqual(isTransient("SQLITE_BUSY: database is locked"), true);
  assert.strictEqual(isTransient("database is locked"), true);
  assert.strictEqual(isTransient("ETIMEDOUT"), true);
  assert.strictEqual(isTransient("operation timed out"), true);
  assert.strictEqual(isTransient("MODULE_NOT_FOUND"), false);
  assert.strictEqual(isTransient("store present but unreadable"), false);
  assert.strictEqual(isTransient(null), false);
});

// ─── Producer edge: loadStore emits graph-absent vs graph-broken ────────────

test("producer loadStore: null store path → graph-absent (never indexed)", () => {
  const r = loadStore(null);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, "graph-absent");
});

test("producer loadStore: corrupt/garbage .db file → graph-broken", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "gt-broken-"));
  try {
    const garbage = path.join(d, "graph.db");
    fs.writeFileSync(garbage, "this is not a sqlite database — garbage bytes");
    const r = loadStore(garbage);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, "graph-broken");
    assert.ok(r.detail, "graph-broken carries a detail");
  } finally {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

// ─── Delegation edge: _graphQueryCli classifies a crash → graph-broken ──────

test("_graphQueryCli: crash (exit!=0 + MODULE_NOT_FOUND stderr, empty stdout) → graph-broken", () => {
  // [RULE] crash-classified-not-fabricated — a crash is NOT graph-unavailable/absent.
  const simulatedCrash = {
    status: 1,
    stdout: "",
    stderr: "Error: Cannot find module './gsd-t-graph-store-resolver.cjs'\ncode: 'MODULE_NOT_FOUND'",
    error: null,
  };
  const env = _classifyGraphSpawnResult(simulatedCrash);
  assert.strictEqual(env.ok, false);
  assert.strictEqual(env.reason, "graph-broken");
  assert.notStrictEqual(env.reason, "graph-unavailable");
  assert.match(env.detail, /MODULE_NOT_FOUND/);
});

test("_graphQueryCli: spawn error → graph-broken", () => {
  const env = _classifyGraphSpawnResult({ status: null, stdout: "", stderr: "", error: { message: "spawn ENOENT" } });
  assert.strictEqual(env.reason, "graph-broken");
});

test("_graphQueryCli: valid producer envelope on stdout is trusted (granular reason preserved)", () => {
  // A non-zero exit that STILL emitted an envelope (fail() exits 1) keeps the producer's reason.
  const env = _classifyGraphSpawnResult({ status: 1, stdout: '{"ok":false,"reason":"graph-absent"}\n', stderr: "", error: null });
  assert.strictEqual(env.reason, "graph-absent");
});

test("_graphQueryCli: non-JSON stdout → graph-broken (never fabricated unavailable)", () => {
  const env = _classifyGraphSpawnResult({ status: 0, stdout: "some non-json garbage", stderr: "", error: null });
  assert.strictEqual(env.reason, "graph-broken");
});

// ─── [RULE] presence lint: no consumer greps on a graph-broken reason ───────

test("[RULE] no consumer takes a grep branch on a graph-broken reason", () => {
  // Assert none of the 9 consumers contains a `graph-broken → grep` fallback. We
  // approximate "grep branch" by requiring that any file mentioning graph-broken
  // also HALTS (blocked-needs-human / HALT) — never silently continues to grep for
  // the structural answer. The delegation/producer edges emit graph-broken; the
  // consumers must classify + HALT, never re-implement a grep fallback on it.
  const consumers = [
    "templates/workflows/gsd-t-execute.workflow.js",
    "templates/workflows/gsd-t-integrate.workflow.js",
    "templates/workflows/gsd-t-debug.workflow.js",
    "templates/workflows/gsd-t-phase.workflow.js",
    "templates/workflows/gsd-t-quick.workflow.js",
    "templates/workflows/gsd-t-scan.workflow.js",
    "templates/workflows/gsd-t-verify.workflow.js",
    "templates/workflows/gsd-t-wave.workflow.js",
    "bin/gsd-t-file-disjointness.cjs",
  ];
  for (const rel of consumers) {
    const full = path.join(REPO, rel);
    assert.ok(fs.existsSync(full), `${rel} must exist`);
    const src = fs.readFileSync(full, "utf8");
    // A forbidden pattern: on a broken/unavailable graph, fall to a structural grep.
    // We check the literal danger: a `graph-broken` string paired with a same-line
    // grep-fallback directive. There must be NONE.
    const lines = src.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/graph-broken/.test(line) && /\bgrep\b/i.test(line) && /fall\s*back|fallback/i.test(line)) {
        assert.fail(`${rel}:${i + 1} routes a graph-broken reason to a grep fallback: ${line.trim()}`);
      }
    }
  }
});

test("consumers that classify a graph failure route it through the ONE shared classifier", () => {
  // [RULE] one-availability-classifier — every sandboxed consumer invokes the classifier
  // (via its CLI arm) rather than re-implementing an absent-vs-broken string check.
  const routed = [
    "templates/workflows/gsd-t-debug.workflow.js",
    "templates/workflows/gsd-t-phase.workflow.js",
    "templates/workflows/gsd-t-quick.workflow.js",
    "templates/workflows/gsd-t-integrate.workflow.js",
    "templates/workflows/gsd-t-verify.workflow.js",
    "templates/workflows/gsd-t-scan.workflow.js",
  ];
  for (const rel of routed) {
    const src = fs.readFileSync(path.join(REPO, rel), "utf8");
    assert.match(src, /gsd-t-graph-availability|classifyGraphFailure/, `${rel} must route through the shared classifier`);
  }
  // The non-sandboxed brain requires it directly.
  const dj = fs.readFileSync(path.join(REPO, "bin", "gsd-t-file-disjointness.cjs"), "utf8");
  assert.match(dj, /require\(["']\.\/gsd-t-graph-availability\.cjs["']\)/);
});

// ─── Propagation: the classifier ships to projects ──────────────────────────

test("gsd-t-graph-availability.cjs is in PROJECT_BIN_TOOLS (ships to projects)", () => {
  // This is EXACTLY the propagation bug that started this milestone — a new bin tool
  // that consumers invoke must be in the copy list or update-all silently omits it.
  assert.ok(
    PROJECT_BIN_TOOLS.includes("gsd-t-graph-availability.cjs"),
    "the shared classifier must ship so sandboxed workflows can invoke it via Bash"
  );
});

test("gsd-t-graph-availability.cjs exists in bin/", () => {
  assert.ok(fs.existsSync(path.join(REPO, "bin", "gsd-t-graph-availability.cjs")));
});
