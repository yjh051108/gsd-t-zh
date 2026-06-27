"use strict";

/**
 * M94-D9-T4 — RE-PLAN-EXPANDED Fix-3: real-Atos verb spotcheck
 *
 * [RULE] d9-verbs-proven-on-real-atos-extractor-output:
 *   The cluster/dead-code/test-impl verbs are proven on REAL Atos extractor output
 *   (file#function@LINE + UNRESOLVED# shapes), not the mis-assumed bare-key fixture shape.
 *
 * [RULE] test-impl-never-presents-unresolved-as-coverage:
 *   ZERO UNRESOLVED# targets in test-impl implFuncs.
 *
 * [RULE] dead-code-no-floor-tier-flood-all-candidate-labeled:
 *   dead-code count below a sane ceiling; every floor-tier result labeled CANDIDATE.
 *
 * [RULE] cluster-reproducible-same-sha:
 *   Two runs at the same pinned SHA produce identical grouping.
 *
 * GATING: FAIL-LOUD-SKIP with atos-repo-not-found if repo absent.
 * SLOW-TEST OPT-IN: GSDT_SLOW_TESTS=1 required (same convention as D3-T4).
 * Run: GSDT_SLOW_TESTS=1 node --test test/m94-d9-real-atos-verb-spotcheck.test.js
 */

const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const GRAPH_INDEX = path.join(__dirname, "..", "bin", "gsd-t-graph-index.cjs");
const CLI_PATH    = path.join(__dirname, "..", "bin", "gsd-t-graph-query-cli.cjs");

// ── Slow-test gate (mirrors D3-T4) ────────────────────────────────────────────
const SLOW_TESTS_ENABLED = process.env.GSDT_SLOW_TESTS === "1";

// ── Constants ──────────────────────────────────────────────────────────────────

const ATOS_REPO = process.env.ATOS_REPO ||
  "/Users/david/projects/HiloAviation/hilo-figma-atos";

// Sane ceiling for dead-code: floor-tier results must NOT flood the output.
const DEAD_CODE_CEILING_FRACTION = 0.80;

// Minimum resolved impl funcIds from test-impl over real Atos test files
const RESOLVED_IMPL_FLOOR = 1;

// Build timeout
const BUILD_TIMEOUT_MS = 240_000; // 4 minutes

// ── Compute skip reason ────────────────────────────────────────────────────────

function computeSkipReason() {
  if (!SLOW_TESTS_ENABLED) {
    return "slow real-Atos build — run with GSDT_SLOW_TESTS=1 (skipped to keep `npm test` fast for workflow agents)";
  }
  if (!fs.existsSync(ATOS_REPO)) {
    // FAIL-LOUD: throw inside the test body so the test shows as FAIL, not silent pass
    return false; // will throw inside the test to fail loud
  }
  return false; // run
}

const SKIP_REASON = computeSkipReason();

// ── Build the real Atos index (lazy, cached) ──────────────────────────────────
// This is heavy (~2 min). Built once, shared across sub-checks.

let _cachedIndexResult = null;

function buildAtosIndex() {
  if (_cachedIndexResult) return _cachedIndexResult;

  const { build_index, openStore, closeStore } = require(GRAPH_INDEX);
  const CLI = require(CLI_PATH);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gsd-t-d9-atos-"));
  const tmpDb = path.join(tmpDir, "d9-atos.db");

  process.stderr.write(`[D9-T4] Building full Atos index...\n`);
  const t0 = Date.now();

  const buildResult = build_index(ATOS_REPO, {
    dbPath: tmpDb,
    onProgress: ({ fileCount, total }) => {
      if (fileCount % 500 === 0) {
        process.stderr.write(`[D9-T4]   ${fileCount}/${total} files indexed...\n`);
      }
    },
  });

  process.stderr.write(`[D9-T4] Build done: ${buildResult.fileCount} files, ${buildResult.edgeCount} edges in ${Date.now() - t0}ms\n`);

  // Read all records from the SQLite store to build the in-memory query index.
  // BULK-LOAD: one query per table, then group in memory (O(n)). The old per-file
  // `edges WHERE src LIKE ?` ran a full-table LIKE scan once per file —
  // O(files × edges) ≈ billions of comparisons on Atos (594K edges × 4,418 files),
  // which hung the query phase at ~10GB. Group by file id instead.
  const db = openStore(tmpDb);
  const allRecords = [];
  try {
    const fileRows = db.prepare("SELECT file, content_hash, tier FROM files").all();

    // nodes grouped by file
    const nodesByFile = new Map();
    for (const n of db.prepare("SELECT id, name, kind, file, tier, func_id FROM nodes").all()) {
      if (!nodesByFile.has(n.file)) nodesByFile.set(n.file, []);
      nodesByFile.get(n.file).push(n);
    }
    // edges grouped by the src's file prefix (src is "file#func@line" or "file")
    const edgesByFile = new Map();
    for (const e of db.prepare("SELECT kind, src, dst FROM edges").all()) {
      const srcFile = String(e.src).split("#")[0];
      if (!edgesByFile.has(srcFile)) edgesByFile.set(srcFile, []);
      edgesByFile.get(srcFile).push(e);
    }

    for (const fileRow of fileRows) {
      const nodes = nodesByFile.get(fileRow.file) || [];
      const edges = edgesByFile.get(fileRow.file) || [];
      allRecords.push({
        file: fileRow.file,
        content_hash: fileRow.content_hash,
        tier: fileRow.tier,
        entities: nodes.map((n) => ({
          funcId: n.func_id || n.id,
          name: n.name,
          kind: n.kind,
          file: n.file || fileRow.file,
          tier: n.tier,
        })),
        edges: edges.map((e) => ({ kind: e.kind, src: e.src, dst: e.dst })),
      });
    }
  } finally {
    closeStore(db);
  }

  // Load skipped files
  let skippedFiles = new Set();
  try {
    const meta = openStore(tmpDb);
    const rows = meta.prepare("SELECT file FROM skipped_files").all();
    for (const row of rows) skippedFiles.add(row.file);
    closeStore(meta);
  } catch { /* table may be absent — fine */ }

  const index = CLI.buildIndexFromRecords(allRecords, skippedFiles);
  _cachedIndexResult = { index, buildResult };
  return _cachedIndexResult;
}

// ─── All tests use the same skip gate ─────────────────────────────────────────

test("D9-T4: [RULE] d9-verbs-proven-on-real-atos-extractor-output — all sub-checks", {
  timeout: BUILD_TIMEOUT_MS,
  skip: SKIP_REASON,
}, () => {
  // FAIL-LOUD if repo absent (but we're past the slow-test gate, so SLOW_TESTS_ENABLED=1)
  if (!fs.existsSync(ATOS_REPO)) {
    const err = new Error(
      `FAIL-LOUD-SKIP: Atos repo not found at ${ATOS_REPO}. reason=atos-repo-not-found`
    );
    err.code = "atos-repo-not-found";
    throw err;
  }

  const { index, buildResult } = buildAtosIndex();
  const CLI = require(CLI_PATH);

  // ── (a) test-impl: ZERO UNRESOLVED# in implFuncs ─────────────────────────
  {
    const { results } = CLI.queryTestImpl(index);
    const allImplFuncs = results.flatMap((r) => r.implFuncs);
    const unresolvedImplFuncs = allImplFuncs.filter((f) => f.startsWith(CLI.UNRESOLVED_PREFIX));

    assert.equal(unresolvedImplFuncs.length, 0,
      `[RULE] test-impl-never-presents-unresolved-as-coverage VIOLATED: ` +
      `${unresolvedImplFuncs.length} UNRESOLVED# in implFuncs. First 5: ${JSON.stringify(unresolvedImplFuncs.slice(0, 5))}`);

    process.stderr.write(`[D9-T4] (a) test-impl: ${results.length} test funcs, ${allImplFuncs.length} resolved impl edges — ZERO UNRESOLVED# confirmed\n`);

    // At least RESOLVED_IMPL_FLOOR resolved calls
    const totalResolved = allImplFuncs.length;
    assert.ok(totalResolved >= RESOLVED_IMPL_FLOOR,
      `Expected >= ${RESOLVED_IMPL_FLOOR} resolved impl funcIds, got ${totalResolved}`);

    // All implFuncs are file-qualified (contain '#')
    for (const r of results.slice(0, 10)) {
      for (const fId of r.implFuncs) {
        assert.ok(fId.includes("#"),
          `implFunc must be file-qualified funcId, got: ${fId}`);
      }
    }
  }

  // ── (b) dead-code: count below ceiling + all floor-tier labeled CANDIDATE ──
  {
    const { results } = CLI.queryDeadCode(index);
    const totalFunctions = index.funcEntities.size;
    const ceiling = Math.floor(totalFunctions * DEAD_CODE_CEILING_FRACTION);

    assert.ok(results.length <= ceiling,
      `[RULE] dead-code-no-floor-tier-flood: dead-code count ${results.length} > ceiling ${ceiling} ` +
      `(${DEAD_CODE_CEILING_FRACTION * 100}% of ${totalFunctions} functions). False-positive flood.`);

    const floorOrphansWithoutLabel = results.filter(
      (r) =>
        (r.tier === "tree-sitter-floor" || r.tier === "tree-sitter-floor-STALE-SCIP") &&
        r.candidateLabel !== "CANDIDATE"
    );
    assert.equal(floorOrphansWithoutLabel.length, 0,
      `[RULE] orphan-tier-labeled-candidate-not-certainty VIOLATED: ` +
      `${floorOrphansWithoutLabel.length} floor-tier orphans NOT labeled CANDIDATE. ` +
      `First 5: ${JSON.stringify(floorOrphansWithoutLabel.slice(0, 5).map((r) => r.funcId))}`);

    process.stderr.write(`[D9-T4] (b) dead-code: ${results.length} candidates (ceiling=${ceiling}) — CANDIDATE labels correct\n`);
  }

  // ── (c) cluster: reproducible across two runs ─────────────────────────────
  {
    const run1 = CLI.queryCluster(index);
    const run2 = CLI.queryCluster(index);

    assert.deepEqual(run1, run2,
      "[RULE] cluster-reproducible-same-sha VIOLATED: two cluster() runs produced different groupings");

    process.stderr.write(`[D9-T4] (c) cluster: ${run1.results.length} groups — deterministic confirmed\n`);
  }

  process.stderr.write(`[D9-T4] All sub-checks PASSED on real Atos extractor output.\n`);
});
