'use strict';

/**
 * M94-D4 — Freshness tests (T1 correctness + T3 scale-budget envelope shape).
 *
 * T1 (DETERMINISTIC CORRECTNESS — NO timing assertions per [#6 timing split]):
 *   - content-hash dirty-detection flags a changed file
 *   - one-hop (NOT transitive) re-validation: a 2-hop importer is NOT re-checked
 *   - re-index goes through D3's parse_and_put (function-level call, not a file edit)
 *   - whole-tree dirty set (not just the query target)
 *   - add/delete/rename detection
 *
 * T3 (SCALE-BUDGET ENVELOPE SHAPE — shape-asserted here; real wall-clock numbers
 *     are in .gsd-t/spikes/ac3-freshness-scale-budget-results.md):
 *   - measure_freshness_budget() returns a shape-correct envelope
 *   - ceilingMs field present, measured sub-object present
 *   - verdict field ∈ { 'PASS', 'FAIL' }
 *   - NO wall-clock assertion on toy fixture (would flake)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const FRESHNESS = require(path.join(__dirname, '..', 'bin', 'gsd-t-graph-freshness.cjs'));
const {
  compute_touched_files,
  freshness_check_on_query,
  measure_freshness_budget,
  hashFileContent,
} = FRESHNESS;

// ─── Helpers ──────────────────────────────────────────────────────────────────

let Database;
try { Database = require('better-sqlite3'); }
catch { Database = null; }

function setupFixtureDb(tmpDir, files) {
  // files: [{ rel, content, importsDst? }]
  // Creates a SQLite DB with FILE nodes + IMPORT edges, plus the real files on disk.
  if (!Database) return null;

  const dbPath = path.join(tmpDir, 'graph.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY, kind TEXT, tier TEXT, content_hash TEXT,
      file TEXT, name TEXT, func_id TEXT
    );
    CREATE TABLE IF NOT EXISTS edges (kind TEXT, src TEXT, dst TEXT);
    CREATE INDEX IF NOT EXISTS edges_dst ON edges(dst);
    CREATE INDEX IF NOT EXISTS edges_src_kind ON edges(src, kind);
  `);

  const crypto = require('node:crypto');
  const insNode = db.prepare(
    `INSERT OR REPLACE INTO nodes (id, kind, tier, content_hash, file, name, func_id)
     VALUES (?, 'FILE', 'tree-sitter-floor', ?, ?, null, null)`
  );
  const insEdge = db.prepare(
    `INSERT INTO edges (kind, src, dst) VALUES ('IMPORT', ?, ?)`
  );

  for (const f of files) {
    const absPath = path.join(tmpDir, f.rel);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, f.content, 'utf8');
    const hash = crypto.createHash('md5').update(f.content).digest('hex');
    insNode.run(f.rel, hash, f.rel);
    if (f.importsDst) {
      insEdge.run(f.rel, f.importsDst);
    }
  }

  return db;
}

function getStoredHash(db, rel) {
  const row = db.prepare(`SELECT content_hash FROM nodes WHERE id=?`).get(rel);
  return row ? row.content_hash : null;
}

function getEdges(db, dst) {
  return db.prepare(`SELECT src FROM edges WHERE kind='IMPORT' AND dst=?`).all(dst).map(r => r.src);
}

// ─── Skip guard if better-sqlite3 is not installed ───────────────────────────

if (!Database) {
  test('SKIP: better-sqlite3 not installed — freshness tests require it', () => {
    console.log('  [SKIP] better-sqlite3 not installed');
  });
  // Export early
  module.exports = {};
  return; // In CJS test runner, return exits the module
}

// ─── T1-A: content-hash dirty-detection ───────────────────────────────────────

test('T1-A: content-hash detects a changed file (not git-SHA)', () => {
  // [RULE] freshness-content-hash-not-git-sha
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-d4-t1a-'));
  try {
    const db = setupFixtureDb(tmpDir, [
      { rel: 'src/a.js', content: 'const x = 1;\n' },
      { rel: 'src/b.js', content: 'import a from "./a";\n', importsDst: 'src/a.js' },
    ]);

    // Verify initial state: no touched files
    const before = compute_touched_files(db, tmpDir);
    assert.deepEqual(before.edits, [], 'No edits before modification');
    assert.deepEqual(before.adds, [], 'No adds before modification');
    assert.deepEqual(before.deletes, [], 'No deletes before modification');

    // Modify src/a.js WITHOUT committing (git-SHA would be unchanged)
    const aPath = path.join(tmpDir, 'src', 'a.js');
    fs.writeFileSync(aPath, 'const x = 2; // uncommitted edit\n', 'utf8');

    // Detect: content-hash must catch the edit
    const after = compute_touched_files(db, tmpDir);
    assert.ok(after.edits.includes('src/a.js'), 'Edited file appears in dirty edits');
    assert.equal(after.deletes.length, 0, 'No deletes');

    db.close();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── T1-B: one-hop (NOT transitive) re-validation ────────────────────────────

test('T1-B: re-validation is one-hop only — 2-hop importer is NOT re-checked', () => {
  // [RULE] one-hop-revalidation-not-transitive
  // Graph: C imports B; B imports A. A is stale.
  // Direct importer of A = B (one-hop). C is a 2-hop importer — must NOT be re-checked.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-d4-t1b-'));
  try {
    const db = setupFixtureDb(tmpDir, [
      { rel: 'src/a.js', content: 'export const A = 1;\n' },
      { rel: 'src/b.js', content: 'import { A } from "./a";\n', importsDst: 'src/a.js' },
      { rel: 'src/c.js', content: 'import { B } from "./b";\n', importsDst: 'src/b.js' },
    ]);

    // Edit A
    fs.writeFileSync(path.join(tmpDir, 'src', 'a.js'), 'export const A = 99;\n', 'utf8');

    const touched = compute_touched_files(db, tmpDir);
    assert.ok(touched.edits.includes('src/a.js'), 'A detected as stale');

    const parseAndPutCalls = [];
    const mockParseAndPut = (rel) => {
      parseAndPutCalls.push(rel);
      // No-op: we just record the call
    };

    const result = freshness_check_on_query(
      db, tmpDir,
      { edits: ['src/a.js'], adds: [], deletes: [] },
      mockParseAndPut
    );

    // parse_and_put called for A only (not for B or C)
    assert.ok(parseAndPutCalls.includes('src/a.js'), 'parse_and_put called for stale file A');
    assert.equal(
      parseAndPutCalls.filter(r => r !== 'src/a.js').length, 0,
      'parse_and_put NOT called for importers B or C (one-hop revalidation is metadata-only, not re-parse)'
    );

    // The revalidation result for A should list B as a direct importer, NOT C
    const rv = result.revalidated.find(r => r.file === 'src/a.js');
    assert.ok(rv, 'Revalidation record for A present');
    assert.ok(rv.directImporters.includes('src/b.js'), 'B is a direct importer of A');
    assert.equal(
      rv.directImporters.includes('src/c.js'), false,
      'C (2-hop) is NOT in direct importers of A'
    );
    assert.equal(rv.hopsChecked, 1, 'Only one hop checked');

    db.close();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── T1-C: re-index goes through parseAndPut (function call, not file edit) ──

test('T1-C: re-index calls parseAndPut function for stale files', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-d4-t1c-'));
  try {
    const db = setupFixtureDb(tmpDir, [
      { rel: 'src/x.js', content: 'export const X = 1;\n' },
    ]);

    // Edit x.js
    fs.writeFileSync(path.join(tmpDir, 'src', 'x.js'), 'export const X = 2;\n', 'utf8');

    const called = [];
    const mockParseAndPut = (rel, absPath, dbHandle, root) => {
      called.push({ rel, absPath, hasDb: !!dbHandle, hasRoot: !!root });
    };

    freshness_check_on_query(
      db, tmpDir,
      { edits: ['src/x.js'], adds: [], deletes: [] },
      mockParseAndPut
    );

    assert.equal(called.length, 1, 'parseAndPut called exactly once for one stale file');
    assert.equal(called[0].rel, 'src/x.js', 'Called for the stale file');
    assert.ok(called[0].hasDb, 'db handle passed to parseAndPut');
    assert.ok(called[0].hasRoot, 'projectRoot passed to parseAndPut');

    db.close();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── T1-D: whole-tree dirty scan (not just the query target) ─────────────────

test('T1-D: compute_touched_files scans ALL indexed files, not only the query target', () => {
  // [RULE] touched-set-is-whole-tree-dirty-not-query-target
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-d4-t1d-'));
  try {
    const db = setupFixtureDb(tmpDir, [
      { rel: 'src/a.js', content: 'export const A = 1;\n' },
      { rel: 'src/b.js', content: 'import { A } from "./a";\n', importsDst: 'src/a.js' },
      { rel: 'src/c.js', content: 'export const C = 3;\n' },
    ]);

    // Edit b.js (NOT the "target" — we're imagining the query is about a.js)
    fs.writeFileSync(path.join(tmpDir, 'src', 'b.js'), '// changed\n', 'utf8');

    // compute_touched_files must find b.js as stale even though the "query target" is a.js
    const touched = compute_touched_files(db, tmpDir);
    assert.ok(touched.edits.includes('src/b.js'), 'Non-target file b.js detected as stale');
    assert.equal(touched.edits.includes('src/a.js'), false, 'Unchanged a.js not in edits');
    assert.equal(touched.edits.includes('src/c.js'), false, 'Unchanged c.js not in edits');

    db.close();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── T1-E: ADD detection ──────────────────────────────────────────────────────

test('T1-E: compute_touched_files detects a new source file (ADD)', () => {
  // [RULE] freshness-detects-add-delete-rename
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-d4-t1e-'));
  try {
    const db = setupFixtureDb(tmpDir, [
      { rel: 'src/a.js', content: 'export const A = 1;\n' },
    ]);

    // Add a new file not in the store
    const newFile = path.join(tmpDir, 'src', 'new.js');
    fs.writeFileSync(newFile, 'export const NEW = 99;\n', 'utf8');

    const touched = compute_touched_files(db, tmpDir);
    assert.ok(touched.adds.includes('src/new.js'), 'New file detected as ADD');
    assert.equal(touched.edits.length, 0, 'No edits (a.js unchanged)');
    assert.equal(touched.deletes.length, 0, 'No deletes');

    db.close();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── T1-F: DELETE detection ───────────────────────────────────────────────────

test('T1-F: compute_touched_files detects a deleted source file (DELETE)', () => {
  // [RULE] freshness-detects-add-delete-rename
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-d4-t1f-'));
  try {
    const db = setupFixtureDb(tmpDir, [
      { rel: 'src/a.js', content: 'export const A = 1;\n' },
      { rel: 'src/b.js', content: 'export const B = 2;\n' },
    ]);

    // Delete b.js from the working tree
    fs.unlinkSync(path.join(tmpDir, 'src', 'b.js'));

    const touched = compute_touched_files(db, tmpDir);
    assert.ok(touched.deletes.includes('src/b.js'), 'Deleted file detected as DELETE');
    assert.equal(touched.edits.length, 0, 'No edits');
    assert.equal(touched.adds.length, 0, 'No adds');

    db.close();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── T1-G: DELETE removes dangling edges ──────────────────────────────────────

test('T1-G: freshness_check_on_query removes dangling edges on DELETE', () => {
  // [RULE] freshness-detects-add-delete-rename
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-d4-t1g-'));
  try {
    const db = setupFixtureDb(tmpDir, [
      { rel: 'src/a.js', content: 'export const A = 1;\n' },
      { rel: 'src/b.js', content: 'import a from "./a";\n', importsDst: 'src/a.js' },
    ]);

    // Confirm edge exists
    const edgesBefore = getEdges(db, 'src/a.js');
    assert.ok(edgesBefore.includes('src/b.js'), 'Import edge b.js→a.js exists before delete');

    // Delete b.js from working tree
    fs.unlinkSync(path.join(tmpDir, 'src', 'b.js'));

    freshness_check_on_query(
      db, tmpDir,
      { edits: [], adds: [], deletes: ['src/b.js'] },
      null
    );

    // Dangling edges from b.js must be gone
    const edgesAfter = getEdges(db, 'src/a.js');
    assert.equal(edgesAfter.includes('src/b.js'), false, 'Dangling edge b.js→a.js removed');

    // b.js node must be gone
    const nodeAfter = db.prepare(`SELECT id FROM nodes WHERE id=?`).get('src/b.js');
    assert.equal(nodeAfter, undefined, 'b.js node removed from store');

    db.close();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── T1-H: multi-file dirty-set serialized coherence ─────────────────────────

test('T1-H: multi-file dirty set is re-indexed serially to completion (coherent state)', () => {
  // [RULE] freshness-multifile-reindex-serialized-coherent
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-d4-t1h-'));
  try {
    const db = setupFixtureDb(tmpDir, [
      { rel: 'src/x.js', content: 'export const X = 1;\n' },
      { rel: 'src/y.js', content: 'import { X } from "./x";\n', importsDst: 'src/x.js' },
      { rel: 'src/z.js', content: 'import { X } from "./x";\n', importsDst: 'src/x.js' },
    ]);

    // Edit both y.js and z.js (both contribute to who-imports(x.js))
    fs.writeFileSync(path.join(tmpDir, 'src', 'y.js'), '// y changed\n', 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'src', 'z.js'), '// z changed\n', 'utf8');

    const callOrder = [];
    const mockParseAndPut = (rel) => { callOrder.push(rel); };

    // ALL edits must be processed before the result is returned
    freshness_check_on_query(
      db, tmpDir,
      { edits: ['src/y.js', 'src/z.js'], adds: [], deletes: [] },
      mockParseAndPut
    );

    // Both y.js and z.js must have been processed (serialized)
    assert.ok(callOrder.includes('src/y.js'), 'y.js re-indexed');
    assert.ok(callOrder.includes('src/z.js'), 'z.js re-indexed');
    assert.equal(callOrder.length, 2, 'Exactly 2 re-indexes for 2 dirty files');

    db.close();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── T3: measure_freshness_budget — shape assertion (no wall-clock gate) ──────

test('T3: measure_freshness_budget returns shape-correct envelope', () => {
  // [#6 timing split] — we assert the SHAPE of the envelope, NOT the wall-clock.
  // The real wall-clock at 1.5M-node scale is recorded in ac3-freshness-scale-budget-results.md.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-d4-t3shape-'));
  try {
    const db = setupFixtureDb(tmpDir, [
      { rel: 'src/a.js', content: 'export const A = 1;\n' },
    ]);

    const result = measure_freshness_budget(db, tmpDir, null, { ceilingMs: 1000 });

    // Shape assertions
    assert.equal(result.ok, true, 'envelope ok');
    assert.equal(typeof result.ceilingMs, 'number', 'ceilingMs is a number');
    assert.ok(['PASS', 'FAIL'].includes(result.verdict), 'verdict is PASS or FAIL');
    assert.equal(typeof result.measured, 'object', 'measured sub-object present');
    assert.equal(typeof result.measured.perEditMs, 'number', 'perEditMs present');
    assert.equal(typeof result.measured.dirtySetScanMs, 'number', 'dirtySetScanMs present');
    assert.equal(typeof result.measured.multiFileDirtyMs, 'number', 'multiFileDirtyMs present');
    assert.equal(typeof result.measured.fileCount, 'number', 'fileCount present');
    assert.equal(typeof result.ceilingsMet, 'object', 'ceilingsMet sub-object present');
    assert.ok('perEdit' in result.ceilingsMet, 'perEdit ceiling present');
    assert.ok('dirtySetScan' in result.ceilingsMet, 'dirtySetScan ceiling present');
    assert.ok('multiFileDirty' in result.ceilingsMet, 'multiFileDirty ceiling present');

    db.close();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
