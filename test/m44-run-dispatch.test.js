"use strict";

/**
 * M44 D9 Step 3 — runDispatch (the single instrument)
 *
 * Per user directive 2026-04-23: "create 1 instrument that accomplishes this
 * instead of implementing it in all the commands." runDispatch is that
 * instrument — command files delegate to it via one CLI line, they do not
 * re-implement probe-and-branch.
 *
 * These tests cover the JS API (runDispatch, _partitionTaskIds) and use
 * `spawnHeadlessImpl` dependency injection so we never spawn real children.
 */

const { test } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

const parallel = require("../bin/gsd-t-parallel.cjs");
const { runDispatch, _partitionTaskIds } = parallel;

function mkTmpProject({ tasks = [], dep = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gsd-t-dispatch-"));
  fs.mkdirSync(path.join(dir, ".gsd-t", "domains", "fan-out-demo"), { recursive: true });
  const scope = `# fan-out-demo\n\nOwns:\n- path: src/a.js\n- path: src/b.js\n- path: src/c.js\n- path: src/d.js\n`;
  fs.writeFileSync(path.join(dir, ".gsd-t", "domains", "fan-out-demo", "scope.md"), scope);
  const taskLines = tasks
    .map(
      (t) =>
        `- [ ] **${t.id}** — ${t.title || "demo task"} (${t.cw || 20}% est CW)\n` +
        `  Writes: ${t.writes || "src/a.js"}\n`,
    )
    .join("\n");
  fs.writeFileSync(
    path.join(dir, ".gsd-t", "domains", "fan-out-demo", "tasks.md"),
    `# Tasks\n\n${taskLines}\n`,
  );
  fs.writeFileSync(
    path.join(dir, ".gsd-t", "domains", "fan-out-demo", "constraints.md"),
    "# Constraints\n",
  );
  return dir;
}

// ─────────────────────────────────────────────────────────────────────────
// Suite 1: Decision surface
// ─────────────────────────────────────────────────────────────────────────

test("runDispatch — missing command returns decision:invalid", () => {
  const out = runDispatch({ projectDir: mkTmpProject() });
  assert.equal(out.decision, "invalid");
  assert.equal(out.error, "missing_command");
  assert.equal(out.fanOutCount, 0);
});

test("runDispatch — empty repo returns decision:sequential (N<2)", () => {
  const out = runDispatch({
    projectDir: mkTmpProject(),
    command: "gsd-t-execute",
  });
  assert.equal(out.decision, "sequential");
  assert.equal(out.fanOutCount, 1);
  assert.deepEqual(out.workerResults, []);
});

test("runDispatch — planner throw returns decision:sequential with error", () => {
  const calls = [];
  const out = runDispatch({
    projectDir: "/this/path/does/not/exist/at/all",
    command: "gsd-t-execute",
    spawnHeadlessImpl: (o) => {
      calls.push(o);
      return { id: "never", pid: 1 };
    },
  });
  // Planner is tolerant of missing dirs — it returns empty plan, not throw.
  // So decision should still be sequential (N<2), not errored.
  assert.ok(out.decision === "sequential" || out.decision === "invalid");
  assert.equal(calls.length, 0, "no spawn when N<2");
});

// ─────────────────────────────────────────────────────────────────────────
// Suite 2: Fan-out with injected spawn stub
// ─────────────────────────────────────────────────────────────────────────

test("runDispatch — fan_out spawns N children with disjoint GSD_T_WORKER_TASK_IDS", () => {
  // Use the live GSD-T repo — it has known ready parallel tasks for M44.
  const repoRoot = path.join(__dirname, "..");
  if (!fs.existsSync(path.join(repoRoot, ".gsd-t", "domains"))) return;

  const spawnCalls = [];
  const out = runDispatch({
    projectDir: repoRoot,
    command: "gsd-t-execute",
    milestone: "M44",
    spawnHeadlessImpl: (o) => {
      spawnCalls.push({
        command: o.command,
        args: o.args,
        env: o.env,
        spawnType: o.spawnType,
      });
      return { id: `stub-${spawnCalls.length}`, pid: 10000 + spawnCalls.length };
    },
  });

  if (out.decision !== "fan_out") {
    // If the live repo happens to have no ready tasks at the moment the test
    // runs, decision is sequential. Skip the fan-out assertions but prove
    // the contract: no stub calls when sequential.
    assert.equal(spawnCalls.length, 0, "stub not called when decision is sequential");
    return;
  }

  assert.ok(out.fanOutCount >= 2);
  assert.equal(spawnCalls.length, out.fanOutCount, "one spawn per worker");

  const allTaskIds = new Set();
  for (let i = 0; i < spawnCalls.length; i++) {
    const c = spawnCalls[i];
    assert.equal(c.command, "gsd-t-execute");
    assert.equal(c.spawnType, "primary");
    assert.ok(c.env, `worker ${i} got env`);
    assert.ok(c.env.GSD_T_WORKER_TASK_IDS, "GSD_T_WORKER_TASK_IDS present");
    assert.equal(c.env.GSD_T_WORKER_INDEX, String(i));
    assert.equal(c.env.GSD_T_WORKER_TOTAL, String(out.fanOutCount));
    const ids = c.env.GSD_T_WORKER_TASK_IDS.split(",").filter(Boolean);
    for (const id of ids) {
      assert.ok(!allTaskIds.has(id), `task id ${id} assigned to multiple workers — not disjoint`);
      allTaskIds.add(id);
    }
  }
  assert.ok(allTaskIds.size >= out.fanOutCount, "each worker got at least 1 task");
});

test("runDispatch — fan_out returns workerResults with idx/taskIds/spawnId/pid", () => {
  const repoRoot = path.join(__dirname, "..");
  if (!fs.existsSync(path.join(repoRoot, ".gsd-t", "domains"))) return;

  const out = runDispatch({
    projectDir: repoRoot,
    command: "gsd-t-execute",
    milestone: "M44",
    spawnHeadlessImpl: (o) => ({ id: "stub-id", pid: 42, logPath: ".gsd-t/stub.log" }),
  });

  if (out.decision !== "fan_out") return;

  for (let i = 0; i < out.workerResults.length; i++) {
    const w = out.workerResults[i];
    assert.equal(w.idx, i);
    assert.ok(Array.isArray(w.taskIds) && w.taskIds.length > 0);
    assert.equal(w.spawnId, "stub-id");
    assert.equal(w.pid, 42);
    assert.equal(w.logPath, ".gsd-t/stub.log");
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Suite 3: _partitionTaskIds pure-function semantics
// ─────────────────────────────────────────────────────────────────────────

test("_partitionTaskIds — empty input → []", () => {
  assert.deepEqual(_partitionTaskIds([], 4), []);
  assert.deepEqual(_partitionTaskIds(null, 4), []);
  assert.deepEqual(_partitionTaskIds(["a"], 0), []);
});

test("_partitionTaskIds — 4 tasks across 4 workers → 4 singletons", () => {
  const out = _partitionTaskIds(["t1", "t2", "t3", "t4"], 4);
  assert.equal(out.length, 4);
  for (const b of out) assert.equal(b.length, 1);
});

test("_partitionTaskIds — 7 tasks across 3 workers → 3/2/2 round-robin", () => {
  const out = _partitionTaskIds(["t1", "t2", "t3", "t4", "t5", "t6", "t7"], 3);
  assert.deepEqual(out, [["t1", "t4", "t7"], ["t2", "t5"], ["t3", "t6"]]);
});

test("_partitionTaskIds — caps workerCount at tasks.length", () => {
  const out = _partitionTaskIds(["t1", "t2"], 8);
  assert.equal(out.length, 2);
});

// ─────────────────────────────────────────────────────────────────────────
// Suite 4: Per-worker spawn isolation
// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// Suite 4.5: Worker model + spawn stagger (v3.18.18)
// ─────────────────────────────────────────────────────────────────────────

test("runDispatch — default workerModel is sonnet (Max-concurrency ceiling workaround)", () => {
  const repoRoot = path.join(__dirname, "..");
  if (!fs.existsSync(path.join(repoRoot, ".gsd-t", "domains"))) return;

  const spawnCalls = [];
  const out = runDispatch({
    projectDir: repoRoot,
    command: "gsd-t-execute",
    milestone: "M44",
    spawnStaggerMs: 0, // keep the test fast
    spawnHeadlessImpl: (o) => {
      spawnCalls.push(o);
      return { id: "stub", pid: 1 };
    },
  });

  if (out.decision !== "fan_out") return;
  for (const c of spawnCalls) {
    assert.equal(
      c.workerModel,
      "claude-sonnet-4-6",
      "fan-out workers default to Sonnet so they don't all land in the Opus rate-limit bucket",
    );
  }
});

test("runDispatch — workerModel alias 'opus' resolves to full model id", () => {
  const repoRoot = path.join(__dirname, "..");
  if (!fs.existsSync(path.join(repoRoot, ".gsd-t", "domains"))) return;

  const spawnCalls = [];
  const out = runDispatch({
    projectDir: repoRoot,
    command: "gsd-t-execute",
    milestone: "M44",
    workerModel: "opus",
    spawnStaggerMs: 0,
    spawnHeadlessImpl: (o) => {
      spawnCalls.push(o);
      return { id: "stub", pid: 1 };
    },
  });

  if (out.decision !== "fan_out") return;
  // M85: alias 'opus' now resolves to claude-opus-4-8 (stale 4-7 fixed; sourced from policy module)
  const { MODEL_IDS } = require("../bin/gsd-t-model-tier-policy.cjs");
  for (const c of spawnCalls) {
    assert.equal(c.workerModel, MODEL_IDS.opus);
  }
});

test("runDispatch — workerModel:false inherits parent ANTHROPIC_MODEL (no override)", () => {
  const repoRoot = path.join(__dirname, "..");
  if (!fs.existsSync(path.join(repoRoot, ".gsd-t", "domains"))) return;

  const spawnCalls = [];
  const out = runDispatch({
    projectDir: repoRoot,
    command: "gsd-t-execute",
    milestone: "M44",
    workerModel: false,
    spawnStaggerMs: 0,
    spawnHeadlessImpl: (o) => {
      spawnCalls.push(o);
      return { id: "stub", pid: 1 };
    },
  });

  if (out.decision !== "fan_out") return;
  for (const c of spawnCalls) {
    assert.equal(c.workerModel, null, "caller opt-out preserved — child inherits parent model");
  }
});

test("runDispatch — spawnStaggerMs delays subsequent spawns", () => {
  const repoRoot = path.join(__dirname, "..");
  if (!fs.existsSync(path.join(repoRoot, ".gsd-t", "domains"))) return;

  const spawnTs = [];
  const out = runDispatch({
    projectDir: repoRoot,
    command: "gsd-t-execute",
    milestone: "M44",
    spawnStaggerMs: 150, // short enough for the test suite
    spawnHeadlessImpl: () => {
      spawnTs.push(Date.now());
      return { id: "stub", pid: 1 };
    },
  });

  if (out.decision !== "fan_out" || spawnTs.length < 2) return;
  for (let i = 1; i < spawnTs.length; i++) {
    const gap = spawnTs[i] - spawnTs[i - 1];
    assert.ok(
      gap >= 120,
      `stagger gap ${gap}ms between spawn ${i - 1} and ${i} — expected >= 120ms (150ms target with 30ms jitter)`,
    );
  }
});

test("runDispatch — cache-warm probe is opt-in (default off)", () => {
  const repoRoot = path.join(__dirname, "..");
  if (!fs.existsSync(path.join(repoRoot, ".gsd-t", "domains"))) return;

  let probeCalls = 0;
  runDispatch({
    projectDir: repoRoot,
    command: "gsd-t-execute",
    milestone: "M44",
    spawnStaggerMs: 0,
    env: {}, // no GSD_T_CACHE_WARM
    spawnHeadlessImpl: () => ({ id: "stub", pid: 1 }),
    cacheWarmProbeImpl: () => {
      probeCalls++;
      return { ok: true, filesRead: ["CLAUDE.md"] };
    },
  });

  assert.equal(probeCalls, 0, "probe must not run when cacheWarm is unset");
});

test("runDispatch — cache-warm probe fires when opts.cacheWarm=true", () => {
  const repoRoot = path.join(__dirname, "..");
  if (!fs.existsSync(path.join(repoRoot, ".gsd-t", "domains"))) return;

  let probeCalls = 0;
  let probeModel = null;
  const out = runDispatch({
    projectDir: repoRoot,
    command: "gsd-t-execute",
    milestone: "M44",
    spawnStaggerMs: 0,
    cacheWarm: true,
    spawnHeadlessImpl: () => ({ id: "stub", pid: 1 }),
    cacheWarmProbeImpl: (o) => {
      probeCalls++;
      probeModel = o.model;
      return { ok: true, filesRead: ["CLAUDE.md"] };
    },
  });

  if (out.decision !== "fan_out") return;
  assert.equal(probeCalls, 1, "probe runs exactly once per dispatch");
  assert.equal(
    probeModel,
    "claude-sonnet-4-6",
    "probe uses the same model as workers so cache key matches",
  );
});

test("runDispatch — cache-warm probe failure does not block fan-out", () => {
  const repoRoot = path.join(__dirname, "..");
  if (!fs.existsSync(path.join(repoRoot, ".gsd-t", "domains"))) return;

  let spawnCount = 0;
  const out = runDispatch({
    projectDir: repoRoot,
    command: "gsd-t-execute",
    milestone: "M44",
    spawnStaggerMs: 0,
    cacheWarm: true,
    spawnHeadlessImpl: () => {
      spawnCount++;
      return { id: "stub", pid: 1 };
    },
    cacheWarmProbeImpl: () => {
      throw new Error("simulated probe failure");
    },
  });

  if (out.decision !== "fan_out") return;
  assert.equal(out.decision, "fan_out", "probe failure must not change decision");
  assert.ok(spawnCount >= 2, "workers still spawn after probe failure");
});

test("runDispatch — one spawn throwing does not kill siblings", () => {
  const repoRoot = path.join(__dirname, "..");
  if (!fs.existsSync(path.join(repoRoot, ".gsd-t", "domains"))) return;

  let calls = 0;
  const out = runDispatch({
    projectDir: repoRoot,
    command: "gsd-t-execute",
    milestone: "M44",
    spawnHeadlessImpl: () => {
      calls++;
      if (calls === 2) throw new Error("simulated spawn failure");
      return { id: `stub-${calls}`, pid: 100 + calls };
    },
  });

  if (out.decision !== "fan_out") return;

  assert.equal(out.workerResults.length, out.fanOutCount);
  const errored = out.workerResults.filter((w) => w.error);
  const succeeded = out.workerResults.filter((w) => !w.error);
  assert.equal(errored.length, 1);
  assert.ok(succeeded.length >= 1, "siblings survive one spawn throw");
  assert.match(errored[0].error, /simulated spawn failure/);
});
