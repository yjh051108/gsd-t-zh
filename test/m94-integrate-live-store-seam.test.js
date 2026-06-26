"use strict";

/**
 * M94-D7-T3 — Live-store seam test (#8, the ownerless seam given a real owner)
 *
 * Builds a REAL fixture repo via D3's build_index into a REAL D1 store (NO mocks),
 * queries who-imports via the REAL D5 query functions, EDITS a source file ON DISK,
 * RE-parses via D3 parse_and_put, then RE-queries to assert the SECOND answer reflects
 * the edit — proving:
 *   D3 (build_index/parse_and_put) → D1 (SQLite store mutation) → D5 (query from store)
 *   all fired LIVE.
 *
 * Self-contained fixture repo: no external Atos repo needed; runs in CI.
 * FAIL-LOUD if D3/D4/D5 surfaces are absent — never a silent green.
 *
 * Store note: D3 writes SQLite at .gsd-t/graph.db; D5's programmatic API
 * (buildIndexFromRecords / queryWhoImports) reads records in the graph-store-schema-contract.md
 * shape regardless of on-disk format. The seam test reads records from the live SQLite store
 * and feeds them to D5's in-memory index builder — this is the real pipeline, not a mock.
 *
 * [RULE] live-store-seam-real-pipeline
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PROJECT_ROOT = path.join(__dirname, "..");
const D3_PATH = path.join(PROJECT_ROOT, "bin", "gsd-t-graph-index.cjs");
const D4_PATH = path.join(PROJECT_ROOT, "bin", "gsd-t-graph-freshness.cjs");
const D5_CLI_PATH = path.join(PROJECT_ROOT, "bin", "gsd-t-graph-query-cli.cjs");

// ─── Fail-loud surface checks ─────────────────────────────────────────────────

test("D3 build_index surface exists (fail-loud guard)", () => {
  assert.ok(
    fs.existsSync(D3_PATH),
    `D3 indexer not found at ${D3_PATH} — the live-store seam test requires the real D3 build surface. [RULE] live-store-seam-real-pipeline`
  );
});

test("D4 freshness surface exists (fail-loud guard)", () => {
  assert.ok(
    fs.existsSync(D4_PATH),
    `D4 freshness not found at ${D4_PATH} — the live-store seam test requires the real D4 freshness surface. [RULE] live-store-seam-real-pipeline`
  );
});

test("D5 query CLI exists (fail-loud guard)", () => {
  assert.ok(
    fs.existsSync(D5_CLI_PATH),
    `D5 query CLI not found at ${D5_CLI_PATH} — the live-store seam test requires the real D5 CLI. [RULE] live-store-seam-real-pipeline`
  );
});

// ─── Fixture repo setup ───────────────────────────────────────────────────────

/**
 * Creates a self-contained JS fixture repo in a temp dir.
 * Layout:
 *   src/a.js  — exports initA; imports nothing
 *   src/b.js  — exports processB; imports initA from a.js  (require('./a'))
 *   src/c.js  — exports renderC; imports processB from b.js (require('./b'))
 *
 * D3 stores raw import specifiers as edge dst values:
 *   src/b.js  → requires './a'  → IMPORT edge: src='src/b.js', dst='./a'
 *   src/c.js  → requires './b'  → IMPORT edge: src='src/c.js', dst='./b'
 *
 * D5's importGraph is keyed by the raw dst specifier:
 *   who-imports('./a') → ['src/b.js']
 *   who-imports('./b') → ['src/c.js']
 *
 * After adding d.js which requires('./a'):
 *   who-imports('./a') → ['src/b.js', 'src/d.js']
 */
function createFixtureRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m94-seam-"));
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });

  fs.writeFileSync(path.join(dir, "src", "a.js"), [
    '"use strict";',
    "function initA() { return 'a'; }",
    "module.exports = { initA };",
  ].join("\n") + "\n");

  fs.writeFileSync(path.join(dir, "src", "b.js"), [
    '"use strict";',
    "const { initA } = require('./a');",
    "function processB() { return initA() + 'b'; }",
    "module.exports = { processB };",
  ].join("\n") + "\n");

  fs.writeFileSync(path.join(dir, "src", "c.js"), [
    '"use strict";',
    "const { processB } = require('./b');",
    "function renderC() { return processB() + 'c'; }",
    "module.exports = { renderC };",
  ].join("\n") + "\n");

  return dir;
}

/**
 * Read all records from the SQLite store and return them in the shape
 * that D5's buildIndexFromRecords expects:
 *   { file, entities: [{funcId, name, kind, tier}], edges: [{kind, src, dst}] }
 *
 * This bridges the D3 SQLite store → D5 in-memory index without faking anything.
 */
function readRecordsFromSqlite(dbPath) {
  const Database = require("better-sqlite3");
  const db = new Database(dbPath, { readonly: true });
  try {
    // Get all files
    const files = db.prepare("SELECT DISTINCT file FROM files").all().map(r => r.file);

    const records = [];
    for (const file of files) {
      // Get entities (nodes) for this file
      const nodeRows = db.prepare("SELECT func_id, name, kind, tier FROM nodes WHERE file = ?").all(file);
      const entities = nodeRows.map(n => ({
        funcId: n.func_id,
        id: n.func_id,
        name: n.name,
        kind: n.kind,
        tier: n.tier,
      }));

      // Get edges where src is this file or starts with "file#"
      const edgeRows = db.prepare(
        "SELECT kind, src, dst FROM edges WHERE src = ? OR src LIKE ?"
      ).all(file, `${file}#%`);
      const edges = edgeRows.map(e => ({ kind: e.kind, src: e.src, dst: e.dst }));

      // Get tier from files table
      const fileRow = db.prepare("SELECT tier FROM files WHERE file = ?").get(file);
      records.push({
        file,
        entities,
        edges,
        tier: fileRow ? fileRow.tier : "tree-sitter-floor",
      });
    }
    return records;
  } finally {
    db.close();
  }
}

// ─── Seam test 1: D3→D1→D5 pipeline (import graph mutation) ─────────────────

test("Live-store seam: D3 build_index → D1 SQLite → D5 who-imports reflects a real on-disk edit", { timeout: 60000 }, () => {
  const repoDir = createFixtureRepo();

  try {
    const { build_index, parse_and_put, openStore, closeStore } = require(D3_PATH);
    const { buildIndexFromRecords, queryWhoImports } = require(D5_CLI_PATH);

    const dbPath = path.join(repoDir, ".gsd-t", "graph.db");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    // ── Step 1: Build initial index via D3 ──
    const buildResult = build_index(repoDir, { dbPath });
    assert.ok(fs.existsSync(dbPath), `D3 build_index should have created the SQLite store at ${dbPath}`);

    // ── Step 2: Read records from D1 SQLite + build D5 in-memory index ──
    const beforeRecords = readRecordsFromSqlite(dbPath);
    assert.ok(beforeRecords.length >= 3, `Expected ≥3 file records in store, got ${beforeRecords.length}`);

    const beforeIndex = buildIndexFromRecords(beforeRecords, new Set());

    // ── Step 3: Query who-imports('./a') BEFORE the edit ──
    // D3 stores raw require specifiers as IMPORT edge dst values.
    // b.js has: const { initA } = require('./a')  → edge dst = './a'
    // So D5's importGraph is keyed by the raw specifier, not the resolved path.
    const { results: beforeImporters } = queryWhoImports(beforeIndex, "./a");
    assert.ok(
      beforeImporters.includes("src/b.js"),
      `Before edit: who-imports('./a') should include 'src/b.js' (b.js has require('./a')), got: ${JSON.stringify(beforeImporters)}. ` +
      `Note: D3 stores raw specifiers as edge dst values.`
    );
    assert.ok(
      !beforeImporters.includes("src/d.js"),
      `Before edit: who-imports('./a') should NOT include 'src/d.js' (not yet created), got: ${JSON.stringify(beforeImporters)}`
    );

    // ── Step 4: Add a new file d.js that imports a.js (ON DISK edit) ──
    const dJsPath = path.join(repoDir, "src", "d.js");
    fs.writeFileSync(dJsPath, [
      '"use strict";',
      "const { initA } = require('./a');",
      "function dispatchD() { return initA() + 'd'; }",
      "module.exports = { dispatchD };",
    ].join("\n") + "\n");

    // ── Step 5: parse_and_put the new file into the REAL D1 store (D3 surface) ──
    const db = openStore(dbPath);
    try {
      parse_and_put(dJsPath, "src/d.js", { db });
    } finally {
      closeStore(db);
    }

    // ── Step 6: Re-read records from D1 store + rebuild D5 index ──
    const afterRecords = readRecordsFromSqlite(dbPath);
    // d.js should now be in the store
    const dRecord = afterRecords.find(r => r.file === "src/d.js");
    assert.ok(dRecord, `After parse_and_put: 'src/d.js' should be in the D1 store, but it is missing. Store has: ${afterRecords.map(r => r.file).join(", ")}`);

    // ── Step 7: Re-query who-imports('./a') AFTER the edit ──
    // d.js has: const { initA } = require('./a')  → edge dst = './a'
    const afterIndex = buildIndexFromRecords(afterRecords, new Set());
    const { results: afterImporters } = queryWhoImports(afterIndex, "./a");

    assert.ok(
      afterImporters.includes("src/d.js"),
      `After parse_and_put of d.js: who-imports('./a') should include 'src/d.js'. ` +
      `Got: ${JSON.stringify(afterImporters)}. ` +
      `This proves D3 (parse_and_put) → D1 (SQLite mutation) → D5 (queryWhoImports) fired LIVE. ` +
      `[RULE] live-store-seam-real-pipeline`
    );
    assert.ok(
      afterImporters.includes("src/b.js"),
      `After edit: who-imports('./a') should still include 'src/b.js'. Got: ${JSON.stringify(afterImporters)}`
    );

  } finally {
    try { fs.rmSync(repoDir, { recursive: true, force: true }); } catch {}
  }
});

// ─── Seam test 2: D4 freshness_check triggers parse_and_put on stale file ────

test("Live-store seam: D4 compute_touched_files detects stale file (freshness seam)", { timeout: 60000 }, () => {
  const { build_index, parse_and_put, openStore, closeStore } = require(D3_PATH);
  const { compute_touched_files } = require(D4_PATH);
  const { buildIndexFromRecords, queryWhoImports } = require(D5_CLI_PATH);

  const repoDir = createFixtureRepo();

  try {
    const dbPath = path.join(repoDir, ".gsd-t", "graph.db");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    // Build initial index
    build_index(repoDir, { dbPath });
    assert.ok(fs.existsSync(dbPath), `D3 build_index should create store`);

    // Mutate b.js ON DISK (add a new import)
    const bJsPath = path.join(repoDir, "src", "b.js");
    fs.writeFileSync(bJsPath, [
      '"use strict";',
      "const { initA } = require('./a');",
      "const { renderC } = require('./c');  // new cross-import (stale file edit)",
      "function processB() { return initA() + 'b'; }",
      "module.exports = { processB };",
    ].join("\n") + "\n");

    // D4: compute_touched_files should detect b.js as stale
    const db = openStore(dbPath);
    let touched;
    try {
      touched = compute_touched_files(db, repoDir);
    } finally {
      closeStore(db);
    }

    assert.ok(
      touched && touched.edits && touched.edits.includes("src/b.js"),
      `D4 compute_touched_files should detect 'src/b.js' as stale (edited), ` +
      `got edits: ${JSON.stringify(touched && touched.edits)}. ` +
      `This proves the D4 freshness detection seam is LIVE. [RULE] live-store-seam-real-pipeline`
    );

    // D3: re-index the stale file via parse_and_put
    const db2 = openStore(dbPath);
    try {
      parse_and_put(bJsPath, "src/b.js", { db: db2 });
    } finally {
      closeStore(db2);
    }

    // D5: query after re-index — b.js now also requires c.js (require('./c')),
    // so who-imports('./c') should now include 'src/b.js' (new edge dst='./c')
    const afterRecords = readRecordsFromSqlite(dbPath);
    const afterIndex = buildIndexFromRecords(afterRecords, new Set());
    const { results: cImporters } = queryWhoImports(afterIndex, "./c");

    assert.ok(
      cImporters.includes("src/b.js"),
      `After D4-triggered re-index: who-imports('./c') should include 'src/b.js' (b.js now has require('./c')), ` +
      `got: ${JSON.stringify(cImporters)}. ` +
      `D3 stores raw specifiers; b.js's new require('./c') → edge dst='./c'. ` +
      `This proves D4 (stale detection) → D3 (parse_and_put) → D1 (store-mutation) → D5 (re-query) fired LIVE. ` +
      `[RULE] live-store-seam-real-pipeline`
    );

  } finally {
    try { fs.rmSync(repoDir, { recursive: true, force: true }); } catch {}
  }
});

// ─── Integration-points doc at the integrate-read-path ───────────────────────

test("m94-integration-points.md exists at the integrate-read-path", () => {
  const integPath = path.join(PROJECT_ROOT, ".gsd-t", "contracts", "m94-integration-points.md");
  assert.ok(
    fs.existsSync(integPath),
    `m94-integration-points.md must exist at ${integPath} — the integrate workflow reads ` +
    '".gsd-t/contracts/${milestone.toLowerCase()}-integration-points.md". [RULE] live-store-seam-real-pipeline'
  );
  const md = fs.readFileSync(integPath, "utf8");
  assert.ok(
    md.includes("WAVE 1") || md.includes("Wave 1") || md.includes("WAVE-1"),
    "m94-integration-points.md should contain Wave groupings"
  );
  assert.ok(
    md.includes("live-store-seam") || md.includes("seam test") || md.includes("seam-test"),
    "m94-integration-points.md should reference the live-store seam test"
  );
  assert.ok(
    md.includes("K1 verdict") && md.includes("K2 verdict"),
    "m94-integration-points.md should contain AC-descope-record section with K1/K2 verdict entries"
  );
});
