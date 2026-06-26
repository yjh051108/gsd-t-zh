"use strict";

/**
 * M94-D1 — K1 store bake-off tests.
 * Covers T1 (synthetic graph generator) + T2 (bake-off harness).
 *
 * Key kill-criterion assertions:
 *   (a) A candidate that fails one sub-criterion is NOT picked (kill-criterion live).
 *   (b) A candidate engineered to exceed the < 50 ms latency target fails on latency-over-target.
 *   (c) A concurrent-update atomicity failure results in NOT picked.
 *   (#Pre-mortem Fix-6) Footprint: a candidate exceeding peak-RSS or index-size ceiling is NOT picked.
 *   (#RE-PLAN Fix-5) KILL_OR_RESCOPE verdict carries per-candidate per-criterion breakdown.
 *   (#RE-PLAN Fix-4) Envelope carries k1Verdict machine-checkable field.
 *   Envelope shape asserted.
 *   Deterministic re-run on fixed seed.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const GEN = require(path.join(__dirname, "..", "bin", "gsd-t-graph-synthetic-gen.cjs"));
const BAKEOFF = require(path.join(__dirname, "..", "bin", "gsd-t-graph-store-bakeoff.cjs"));

const { generate, generateGraph, makePrng } = GEN;
const { runBakeoff, evaluateCandidate, CEILINGS } = BAKEOFF;

// ─── T1: Synthetic graph generator ───────────────────────────────────────

test("T1: generator returns ok:true envelope with required top-level fields", () => {
  const r = generate({ nodes: 200, seed: 42 });
  assert.equal(r.ok, true);
  assert.ok(Array.isArray(r.nodes), "nodes must be an array");
  assert.ok(Array.isArray(r.edges), "edges must be an array");
  assert.equal(typeof r.seed, "number");
  assert.equal(typeof r.scale, "number");
  assert.equal(typeof r.nodeCount, "number");
  assert.equal(typeof r.edgeCount, "number");
  assert.equal(r.seed, 42);
  assert.equal(r.scale, 200);
  assert.equal(r.nodeCount, r.nodes.length);
  assert.equal(r.edgeCount, r.edges.length);
});

test("T1: generator produces approximately the requested node count", () => {
  const r = generate({ nodes: 1000, seed: 1 });
  // Allow ±5% variance (rounding in distribution)
  assert.ok(r.nodeCount >= 950 && r.nodeCount <= 1050,
    `nodeCount ${r.nodeCount} out of expected range [950, 1050]`);
});

test("T1: FILE nodes carry required schema fields", () => {
  const r = generate({ nodes: 100, seed: 42 });
  const fileNodes = r.nodes.filter((n) => n.kind === "FILE");
  assert.ok(fileNodes.length > 0, "must have FILE nodes");
  for (const n of fileNodes) {
    assert.ok(n.id, `FILE node missing id: ${JSON.stringify(n)}`);
    assert.ok(n.kind === "FILE", "kind must be FILE");
    assert.ok(["compiler-accurate", "tree-sitter-floor"].includes(n.tier),
      `invalid tier: ${n.tier}`);
    assert.ok(n.contentHash, `FILE node missing contentHash`);
    assert.ok(n.file, `FILE node missing file`);
  }
});

test("T1: entity nodes carry funcId + required schema fields", () => {
  const r = generate({ nodes: 100, seed: 42 });
  const entityNodes = r.nodes.filter((n) => n.kind !== "FILE");
  assert.ok(entityNodes.length > 0, "must have entity nodes");
  for (const n of entityNodes) {
    assert.ok(n.id, `entity node missing id`);
    assert.ok(["FUNCTION", "CLASS", "EXPORT"].includes(n.kind), `invalid entity kind: ${n.kind}`);
    assert.ok(["compiler-accurate", "tree-sitter-floor"].includes(n.tier), `invalid tier: ${n.tier}`);
    assert.ok(n.contentHash, `entity node missing contentHash`);
    assert.ok(n.file, `entity node missing file`);
    assert.ok(n.funcId, `entity node missing funcId`);
    // funcId must be file-qualified: "file#name" or "file#name@line"
    assert.ok(n.funcId.includes("#"), `funcId not file-qualified: ${n.funcId}`);
  }
});

test("T1: edges carry required schema fields (kind, src, dst)", () => {
  const r = generate({ nodes: 200, seed: 42 });
  assert.ok(r.edges.length > 0, "must produce edges");
  for (const e of r.edges) {
    assert.ok(["IMPORT", "CALL"].includes(e.kind), `invalid edge kind: ${e.kind}`);
    assert.ok(e.src, "edge missing src");
    assert.ok(e.dst, "edge missing dst");
  }
  const kinds = new Set(r.edges.map((e) => e.kind));
  assert.ok(kinds.has("IMPORT"), "must produce IMPORT edges");
  assert.ok(kinds.has("CALL"), "must produce CALL edges");
});

test("T1: CALL edges use file-qualified funcIds at both ends", () => {
  const r = generate({ nodes: 200, seed: 42 });
  const callEdges = r.edges.filter((e) => e.kind === "CALL");
  assert.ok(callEdges.length > 0, "must produce CALL edges");
  for (const e of callEdges) {
    assert.ok(e.src.includes("#"),
      `CALL edge src not file-qualified funcId: ${e.src}`);
    assert.ok(e.dst.includes("#"),
      `CALL edge dst not file-qualified funcId: ${e.dst}`);
  }
});

test("T1: deterministic — same seed produces identical output", () => {
  const r1 = generate({ nodes: 300, seed: 77 });
  const r2 = generate({ nodes: 300, seed: 77 });
  assert.equal(r1.nodeCount, r2.nodeCount);
  assert.equal(r1.edgeCount, r2.edgeCount);
  assert.equal(r1.nodes[0].id, r2.nodes[0].id);
  assert.equal(r1.nodes[0].contentHash, r2.nodes[0].contentHash);
});

test("T1: different seeds produce different output", () => {
  const r1 = generate({ nodes: 300, seed: 1 });
  const r2 = generate({ nodes: 300, seed: 2 });
  // At least the content hashes or node IDs should differ
  const same = r1.nodes[0].contentHash === r2.nodes[0].contentHash &&
               r1.nodes[0].id === r2.nodes[0].id;
  assert.ok(!same, "different seeds must produce different output");
});

// ─── T2: Bake-off harness ─────────────────────────────────────────────────

// ── Envelope shape ──────────────────────────────────────────────────────
test("T2: envelope carries required top-level fields", () => {
  // Use synthetic overrides to avoid real store I/O (fast, deterministic)
  const goodMetrics = {
    importLatencyMs: 5,
    callLatencyMs: 5,
    incrementalMs: 100,
    incrementalS: 0.1,
    atomicityOk: true,
    peakRssBytes: 512 * 1024 * 1024,      // 512 MB
    indexSizeBytes: 1024 * 1024,           // 1 MB
    indexToSourceMult: 1.0,
  };

  const envelope = runBakeoff({
    nodes: 200,
    seed: 42,
    overrides: {
      sqlite: goodMetrics,
      jsonl: goodMetrics,
      graphology: goodMetrics,
      kuzu: goodMetrics,
    },
  });

  assert.ok(typeof envelope.ok === "boolean", "envelope.ok must be boolean");
  assert.ok(typeof envelope.verdict === "string", "envelope.verdict must be string");
  assert.ok(["PICK", "KILL_OR_RESCOPE"].includes(envelope.verdict),
    `verdict must be PICK or KILL_OR_RESCOPE, got: ${envelope.verdict}`);
  // [RULE] k1-verdict-field-machine-checkable (Fix-4)
  assert.ok(typeof envelope.k1Verdict === "string", "k1Verdict must be present");
  assert.equal(envelope.k1Verdict, envelope.verdict,
    "k1Verdict must match verdict");
  assert.ok(typeof envelope.candidateSetJustification === "string",
    "candidateSetJustification must be present");
  assert.ok(envelope.candidateSetJustification.length > 10,
    "candidateSetJustification must be non-trivial");
  assert.ok(Array.isArray(envelope.candidates), "candidates must be an array");
  assert.ok(envelope.candidates.length > 0, "must have at least one candidate");
});

test("T2: each candidate record has required shape", () => {
  const goodMetrics = {
    importLatencyMs: 5, callLatencyMs: 5,
    incrementalMs: 100, incrementalS: 0.1,
    atomicityOk: true,
    peakRssBytes: 100, indexSizeBytes: 100, indexToSourceMult: 1,
  };

  const envelope = runBakeoff({
    nodes: 100, seed: 42,
    overrides: { sqlite: goodMetrics, jsonl: goodMetrics, graphology: goodMetrics, kuzu: goodMetrics },
  });

  for (const c of envelope.candidates) {
    assert.ok(typeof c.name === "string", "candidate.name must be string");
    assert.ok(Array.isArray(c.passed), `candidate.passed must be array for ${c.name}`);
    assert.ok(Array.isArray(c.failed), `candidate.failed must be array for ${c.name}`);
    assert.ok(c.measured !== null && typeof c.measured === "object",
      `candidate.measured must be object for ${c.name}`);
  }
});

// ── Killing test #1 — one failing sub-criterion → NOT picked ─────────────
test("T2 kill #1: candidate failing embedded-eligibility is NOT picked", () => {
  const envelope = runBakeoff({
    nodes: 100, seed: 42,
    overrides: {
      sqlite: { embeddedEligible: false, error: "not available" },
      jsonl: { embeddedEligible: false, error: "not available" },
      graphology: { embeddedEligible: false, error: "not available" },
      kuzu: { embeddedEligible: false, error: "not available" },
    },
  });
  assert.equal(envelope.k1Verdict, "KILL_OR_RESCOPE",
    "all candidates failing embedded-eligibility must produce KILL_OR_RESCOPE");
  assert.ok(!envelope.pickedStore,
    "pickedStore must be absent on KILL");
  // Each candidate must record the failure
  for (const c of envelope.candidates) {
    if (c.failed.includes("skipped-by-caller")) continue;
    assert.ok(c.failed.includes("embedded-eligibility"),
      `candidate ${c.name} should record embedded-eligibility failure`);
  }
});

test("T2 kill #1: candidate failing ONE sub-criterion (incremental) while others pass is NOT picked", () => {
  const goodMetrics = {
    importLatencyMs: 5, callLatencyMs: 5,
    incrementalMs: 100, incrementalS: 0.1,
    atomicityOk: true,
    peakRssBytes: 100, indexSizeBytes: 100, indexToSourceMult: 1,
  };
  const badIncremental = {
    importLatencyMs: 5, callLatencyMs: 5,
    incrementalMs: 2000, incrementalS: 2.0, // OVER 1s ceiling
    atomicityOk: true,
    peakRssBytes: 100, indexSizeBytes: 100, indexToSourceMult: 1,
  };

  const envelope = runBakeoff({
    nodes: 100, seed: 42,
    overrides: {
      sqlite: badIncremental,
      jsonl: badIncremental,
      graphology: badIncremental,
      kuzu: badIncremental,
    },
  });

  assert.equal(envelope.k1Verdict, "KILL_OR_RESCOPE",
    "all candidates failing incremental must produce KILL");
  for (const c of envelope.candidates) {
    if (c.failed.includes("skipped-by-caller")) continue;
    assert.ok(c.failed.some((f) => f.includes("incremental")),
      `candidate ${c.name} should record incremental failure`);
  }
});

// ── Killing test #3 — latency over 50 ms → NOT picked ───────────────────
test("T2 kill #3: candidate with import latency > 50 ms is NOT picked", () => {
  const latencyFailMetrics = {
    importLatencyMs: 75, // OVER 50 ms
    callLatencyMs: 10,
    incrementalMs: 100, incrementalS: 0.1,
    atomicityOk: true,
    peakRssBytes: 100, indexSizeBytes: 100, indexToSourceMult: 1,
  };
  const { passed, failed } = evaluateCandidate("synthetic", latencyFailMetrics);
  assert.ok(failed.some((f) => f.includes("query-latency-import")),
    `Expected latency-import failure, got failed: ${failed.join(", ")}`);
  assert.ok(!passed.includes("query-latency-import"),
    "import latency must NOT pass when over 50 ms");
});

test("T2 kill #3: candidate with call latency > 50 ms is NOT picked", () => {
  const latencyFailMetrics = {
    importLatencyMs: 10,
    callLatencyMs: 80, // OVER 50 ms
    incrementalMs: 100, incrementalS: 0.1,
    atomicityOk: true,
    peakRssBytes: 100, indexSizeBytes: 100, indexToSourceMult: 1,
  };
  const { passed, failed } = evaluateCandidate("synthetic", latencyFailMetrics);
  assert.ok(failed.some((f) => f.includes("query-latency-call")),
    `Expected latency-call failure, got: ${failed.join(", ")}`);
});

test("T2 kill #3: a bake-off run where all candidates exceed 50 ms yields KILL_OR_RESCOPE", () => {
  const slowMetrics = {
    importLatencyMs: 200,
    callLatencyMs: 200,
    incrementalMs: 100, incrementalS: 0.1,
    atomicityOk: true,
    peakRssBytes: 100, indexSizeBytes: 100, indexToSourceMult: 1,
  };

  const envelope = runBakeoff({
    nodes: 100, seed: 42,
    overrides: { sqlite: slowMetrics, jsonl: slowMetrics, graphology: slowMetrics, kuzu: slowMetrics },
  });
  assert.equal(envelope.k1Verdict, "KILL_OR_RESCOPE");
  for (const c of envelope.candidates) {
    if (c.failed.includes("skipped-by-caller")) continue;
    assert.ok(
      c.failed.some((f) => f.includes("latency")),
      `candidate ${c.name} must record latency failure`
    );
  }
});

// ── Killing test #4 — atomicity failure → NOT picked ─────────────────────
test("T2 kill #4: candidate with torn-read risk (atomicityOk=false) is NOT picked", () => {
  const atomicityFailMetrics = {
    importLatencyMs: 5, callLatencyMs: 5,
    incrementalMs: 100, incrementalS: 0.1,
    atomicityOk: false, // torn read
    peakRssBytes: 100, indexSizeBytes: 100, indexToSourceMult: 1,
  };
  const { passed, failed } = evaluateCandidate("synthetic", atomicityFailMetrics);
  assert.ok(failed.includes("atomicity-torn-read-risk"),
    "atomicity failure must appear in failed list");
  assert.ok(!passed.includes("concurrent-update-atomicity"),
    "concurrent-update-atomicity must NOT pass on atomicity failure");
});

test("T2 kill #4: a bake-off run where all candidates fail atomicity yields KILL_OR_RESCOPE", () => {
  const atomFailMetrics = {
    importLatencyMs: 5, callLatencyMs: 5,
    incrementalMs: 100, incrementalS: 0.1,
    atomicityOk: false,
    peakRssBytes: 100, indexSizeBytes: 100, indexToSourceMult: 1,
  };

  const envelope = runBakeoff({
    nodes: 100, seed: 42,
    overrides: { sqlite: atomFailMetrics, jsonl: atomFailMetrics, graphology: atomFailMetrics, kuzu: atomFailMetrics },
  });
  assert.equal(envelope.k1Verdict, "KILL_OR_RESCOPE");
  for (const c of envelope.candidates) {
    if (c.failed.includes("skipped-by-caller")) continue;
    assert.ok(
      c.failed.includes("atomicity-torn-read-risk"),
      `candidate ${c.name} must record atomicity failure`
    );
  }
});

// ── Pre-mortem Fix-6: footprint ceiling ──────────────────────────────────
test("T2 fix-6: candidate exceeding peak-RSS ceiling is NOT picked", () => {
  const rssFailMetrics = {
    importLatencyMs: 5, callLatencyMs: 5,
    incrementalMs: 100, incrementalS: 0.1,
    atomicityOk: true,
    peakRssBytes: CEILINGS.PEAK_RSS_CEILING_BYTES + 1,  // OVER 4 GB
    indexSizeBytes: 100, indexToSourceMult: 1,
  };
  const { passed, failed } = evaluateCandidate("synthetic", rssFailMetrics);
  assert.ok(failed.some((f) => f.includes("peak-rss")),
    `Expected peak-rss failure, got: ${failed.join(", ")}`);
});

test("T2 fix-6: candidate exceeding index-size-vs-source ceiling is NOT picked", () => {
  const indexFailMetrics = {
    importLatencyMs: 5, callLatencyMs: 5,
    incrementalMs: 100, incrementalS: 0.1,
    atomicityOk: true,
    peakRssBytes: 100,
    indexSizeBytes: 100,
    indexToSourceMult: CEILINGS.INDEX_SIZE_MULT_CEILING + 1,  // OVER 10×
  };
  const { passed, failed } = evaluateCandidate("synthetic", indexFailMetrics);
  assert.ok(failed.some((f) => f.includes("footprint-index-over")),
    `Expected footprint-index failure, got: ${failed.join(", ")}`);
});

test("T2 fix-6: envelope carries peakRssBytes and indexSizeBytes per candidate", () => {
  const metrics = {
    importLatencyMs: 5, callLatencyMs: 5,
    incrementalMs: 100, incrementalS: 0.1,
    atomicityOk: true,
    peakRssBytes: 256 * 1024 * 1024,
    indexSizeBytes: 4096,
    indexToSourceMult: 2,
  };
  const envelope = runBakeoff({
    nodes: 100, seed: 42,
    overrides: { sqlite: metrics, jsonl: metrics, graphology: metrics, kuzu: metrics },
  });
  for (const c of envelope.candidates) {
    if (c.failed.includes("skipped-by-caller")) continue;
    assert.ok(typeof c.measured.peakRssBytes === "number",
      `candidate ${c.name} must carry peakRssBytes in measured`);
    assert.ok(typeof c.measured.indexSizeBytes === "number",
      `candidate ${c.name} must carry indexSizeBytes in measured`);
  }
});

// ── RE-PLAN Fix-5: KILL attributable per-candidate per-criterion ──────────
test("T2 fix-5: KILL_OR_RESCOPE verdict carries per-candidate per-criterion breakdown", () => {
  const failMetrics = {
    importLatencyMs: 999, callLatencyMs: 999,
    incrementalMs: 9000, incrementalS: 9,
    atomicityOk: false,
    peakRssBytes: CEILINGS.PEAK_RSS_CEILING_BYTES * 2,
    indexSizeBytes: 1, indexToSourceMult: 99,
  };
  const envelope = runBakeoff({
    nodes: 100, seed: 42,
    overrides: { sqlite: failMetrics, jsonl: failMetrics, graphology: failMetrics, kuzu: failMetrics },
  });
  assert.equal(envelope.k1Verdict, "KILL_OR_RESCOPE");
  for (const c of envelope.candidates) {
    if (c.failed.includes("skipped-by-caller")) continue;
    assert.ok(c.failed.length > 0,
      `candidate ${c.name} must have at least one failure criterion listed`);
    // Each failure entry must be a meaningful string, not just "killed"
    for (const f of c.failed) {
      assert.ok(typeof f === "string" && f.length > 3,
        `failure entry must be a descriptive string, got: ${f}`);
    }
  }
});

test("T2 fix-5: KILL_OR_RESCOPE carries non-empty candidateSetJustification", () => {
  const failMetrics = {
    importLatencyMs: 999, callLatencyMs: 999,
    incrementalMs: 9000, incrementalS: 9,
    atomicityOk: false, peakRssBytes: 1, indexSizeBytes: 1, indexToSourceMult: 1,
  };
  // embeddedEligible: false for all → fastest KILL path
  const envelope = runBakeoff({
    nodes: 100, seed: 42,
    overrides: {
      sqlite: { embeddedEligible: false, error: "test" },
      jsonl: { embeddedEligible: false, error: "test" },
      graphology: { embeddedEligible: false, error: "test" },
      kuzu: { embeddedEligible: false, error: "test" },
    },
  });
  assert.equal(envelope.k1Verdict, "KILL_OR_RESCOPE");
  assert.ok(typeof envelope.candidateSetJustification === "string",
    "candidateSetJustification must be present on KILL");
  assert.ok(envelope.candidateSetJustification.length > 20,
    "candidateSetJustification must be substantive");
});

// ── RE-PLAN Fix-4: k1Verdict machine-checkable ────────────────────────────
test("T2 fix-4: k1Verdict=PICK when all candidates pass", () => {
  const perfectMetrics = {
    importLatencyMs: 1, callLatencyMs: 1,
    incrementalMs: 10, incrementalS: 0.01,
    atomicityOk: true,
    peakRssBytes: 100, indexSizeBytes: 10, indexToSourceMult: 0.5,
  };
  const envelope = runBakeoff({
    nodes: 100, seed: 42,
    overrides: { sqlite: perfectMetrics, jsonl: perfectMetrics, graphology: perfectMetrics, kuzu: perfectMetrics },
  });
  assert.equal(envelope.k1Verdict, "PICK");
  assert.ok(typeof envelope.pickedStore === "string" && envelope.pickedStore.length > 0,
    "pickedStore must be a non-empty string on PICK");
  assert.ok(envelope.ok === true);
});

test("T2 fix-4: KILL path has k1Verdict=KILL_OR_RESCOPE + no pickedStore", () => {
  const failMetrics = { embeddedEligible: false, error: "test" };
  const envelope = runBakeoff({
    nodes: 100, seed: 42,
    overrides: { sqlite: failMetrics, jsonl: failMetrics, graphology: failMetrics, kuzu: failMetrics },
  });
  assert.equal(envelope.k1Verdict, "KILL_OR_RESCOPE");
  assert.ok(!envelope.pickedStore || envelope.pickedStore === null,
    "pickedStore must be absent/null on KILL");
});

// ── KILL path carries acDescope record ────────────────────────────────────
test("T2: KILL_OR_RESCOPE envelope carries acDescope record per kill-outcome-records-ac-descope rule", () => {
  const failMetrics = { embeddedEligible: false, error: "test" };
  const envelope = runBakeoff({
    nodes: 100, seed: 42,
    overrides: { sqlite: failMetrics, jsonl: failMetrics, graphology: failMetrics, kuzu: failMetrics },
  });
  assert.equal(envelope.k1Verdict, "KILL_OR_RESCOPE");
  assert.ok(envelope.acDescope, "KILL envelope must carry acDescope");
  assert.ok(Array.isArray(envelope.acDescope.survivingAcs),
    "acDescope.survivingAcs must be an array");
  assert.ok(Array.isArray(envelope.acDescope.descopedToPhase2),
    "acDescope.descopedToPhase2 must be an array");
  assert.ok(typeof envelope.acDescope.requiredNextStep === "string",
    "acDescope.requiredNextStep must be a string");
});

// ── Determinism ────────────────────────────────────────────────────────────
test("T2: same seed + same overrides produces identical envelope structure", () => {
  const metrics = {
    importLatencyMs: 10, callLatencyMs: 10,
    incrementalMs: 100, incrementalS: 0.1,
    atomicityOk: true, peakRssBytes: 100, indexSizeBytes: 10, indexToSourceMult: 1,
  };
  const opts = {
    nodes: 100, seed: 77,
    overrides: { sqlite: metrics, jsonl: metrics, graphology: metrics, kuzu: metrics },
  };
  const e1 = runBakeoff(opts);
  const e2 = runBakeoff(opts);
  assert.equal(e1.k1Verdict, e2.k1Verdict);
  assert.equal(e1.pickedStore, e2.pickedStore);
  assert.equal(e1.graphStats.nodeCount, e2.graphStats.nodeCount);
  assert.equal(e1.graphStats.edgeCount, e2.graphStats.edgeCount);
});

// ── graphStats in envelope ────────────────────────────────────────────────
test("T2: envelope carries graphStats", () => {
  const metrics = {
    importLatencyMs: 5, callLatencyMs: 5,
    incrementalMs: 50, incrementalS: 0.05,
    atomicityOk: true, peakRssBytes: 100, indexSizeBytes: 10, indexToSourceMult: 1,
  };
  const envelope = runBakeoff({
    nodes: 200, seed: 42,
    overrides: { sqlite: metrics, jsonl: metrics, graphology: metrics, kuzu: metrics },
  });
  assert.ok(envelope.graphStats, "envelope must carry graphStats");
  assert.ok(typeof envelope.graphStats.nodeCount === "number");
  assert.ok(typeof envelope.graphStats.edgeCount === "number");
  assert.equal(envelope.graphStats.seed, 42);
  assert.equal(envelope.graphStats.scale, 200);
});

// ── ceilings declared in envelope ─────────────────────────────────────────
test("T2: envelope exposes pre-registered ceilings", () => {
  const metrics = {
    importLatencyMs: 5, callLatencyMs: 5,
    incrementalMs: 50, incrementalS: 0.05,
    atomicityOk: true, peakRssBytes: 100, indexSizeBytes: 10, indexToSourceMult: 1,
  };
  const envelope = runBakeoff({
    nodes: 100, seed: 42,
    overrides: { sqlite: metrics, jsonl: metrics, graphology: metrics, kuzu: metrics },
  });
  assert.ok(envelope.ceilings, "envelope must carry ceilings");
  assert.equal(envelope.ceilings.LATENCY_CEILING_MS, 50);
  assert.equal(envelope.ceilings.INCREMENTAL_CEILING_S, 1.0);
  assert.ok(envelope.ceilings.PEAK_RSS_CEILING_BYTES > 0);
  assert.ok(envelope.ceilings.INDEX_SIZE_MULT_CEILING > 0);
});

// ── JSONL candidate smoke test (real I/O) ────────────────────────────────
test("T2: JSONL candidate runs real I/O without error on a tiny graph", (t, done) => {
  const os = require("node:os");
  const fs = require("node:fs");
  const path = require("node:path");
  const { candidateJsonl } = BAKEOFF;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gsd-t-test-jsonl-"));
  const graph = generate({ nodes: 50, seed: 42 });
  const graphObj = { nodes: graph.nodes, edges: graph.edges };

  let result;
  try {
    result = candidateJsonl(tmpDir, graphObj);
  } catch (err) {
    // Clean up
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw err;
  }

  assert.ok(typeof result.importLatencyMs === "number", "importLatencyMs must be a number");
  assert.ok(typeof result.callLatencyMs === "number", "callLatencyMs must be a number");
  assert.ok(typeof result.incrementalMs === "number", "incrementalMs must be a number");
  assert.ok(typeof result.atomicityOk === "boolean", "atomicityOk must be boolean");
  assert.ok(typeof result.peakRssBytes === "number", "peakRssBytes must be a number");
  assert.ok(typeof result.indexSizeBytes === "number", "indexSizeBytes must be a number");
  assert.ok(result.atomicityOk === true, "JSONL atomic write+rename must pass atomicity test");

  // Clean up
  fs.rmSync(tmpDir, { recursive: true, force: true });
  done();
});

// ── SQLite candidate smoke test (if better-sqlite3 installed) ────────────
test("T2: SQLite candidate smoke test (skip if better-sqlite3 absent)", (t, done) => {
  let Database;
  try { Database = require("better-sqlite3"); } catch { t.skip("better-sqlite3 not installed"); return done(); }

  const os = require("node:os");
  const fs = require("node:fs");
  const path = require("node:path");
  const { candidateSqlite } = BAKEOFF;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gsd-t-test-sqlite-"));
  const graph = generate({ nodes: 50, seed: 42 });
  const graphObj = { nodes: graph.nodes, edges: graph.edges };

  let result;
  try {
    result = candidateSqlite(tmpDir, graphObj);
  } catch (err) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw err;
  }

  if (result.embeddedEligible === false) {
    t.skip(`SQLite candidate failed: ${result.error}`);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return done();
  }

  assert.ok(typeof result.importLatencyMs === "number");
  assert.ok(typeof result.callLatencyMs === "number");
  assert.ok(typeof result.incrementalMs === "number");
  assert.ok(typeof result.atomicityOk === "boolean");
  assert.ok(typeof result.peakRssBytes === "number");
  assert.ok(typeof result.indexSizeBytes === "number");

  fs.rmSync(tmpDir, { recursive: true, force: true });
  done();
});
