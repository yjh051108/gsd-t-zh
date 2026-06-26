'use strict';

/**
 * M94-D4 — T5: Pre-mortem Fix-2 killing test: add/delete/rename freshness.
 *
 * [RULE] freshness-detects-add-delete-rename
 *
 * Three cases:
 *   (1) DELETE — delete an indexed file F that another file G imported;
 *       query who-imports of the file F imported → F's dangling edge REMOVED.
 *   (2) ADD — add a new file H importing existing file E;
 *       query who-imports(E) → H appears as a new importer.
 *   (3) RENAME — rename old path → new path;
 *       old path GONE from graph, new path PRESENT.
 *
 * FAILS LOUD if freshness only re-hashes existing files and ignores adds/deletes.
 * NO timing assertion ([#6 timing split]).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  compute_touched_files,
  freshness_check_on_query,
} = require(path.join(__dirname, '..', 'bin', 'gsd-t-graph-freshness.cjs'));

// ─── Skip guard ───────────────────────────────────────────────────────────────

let Database;
try { Database = require('better-sqlite3'); }
catch { Database = null; }

if (!Database) {
  test('SKIP: better-sqlite3 not installed', () => {
    console.log('  [SKIP] better-sqlite3 not installed');
  });
  module.exports = {};
  return;
}

// ─── Fixture helper ───────────────────────────────────────────────────────────

function setupFixtureDb(tmpDir, files) {
  const crypto = require('node:crypto');
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
  `);
  const insNode = db.prepare(
    `INSERT OR REPLACE INTO nodes (id, kind, tier, content_hash, file, name, func_id)
     VALUES (?, 'FILE', 'tree-sitter-floor', ?, ?, null, null)`
  );
  const insEdge = db.prepare(`INSERT INTO edges (kind, src, dst) VALUES ('IMPORT', ?, ?)`);
  for (const f of files) {
    const absPath = path.join(tmpDir, f.rel);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, f.content, 'utf8');
    const hash = crypto.createHash('md5').update(f.content).digest('hex');
    insNode.run(f.rel, hash, f.rel);
    for (const dst of (f.imports || [])) insEdge.run(f.rel, dst);
  }
  return db;
}

function getEdges(db, dst) {
  return db.prepare(`SELECT src FROM edges WHERE kind='IMPORT' AND dst=?`).all(dst).map(r => r.src);
}

function nodeExists(db, id) {
  return !!db.prepare(`SELECT 1 FROM nodes WHERE id=?`).get(id);
}

// ─── (1) DELETE: dangling edge removed/flagged ────────────────────────────────

test('T5-1: DELETE — dangling edge from deleted file removed from graph', () => {
  // File F (src/f.js) imports G (src/g.js).
  // Delete F from the working tree.
  // After freshness check: the edge F→G must be GONE (dangling edge removed).
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-d4-t5-delete-'));
  try {
    const db = setupFixtureDb(tmpDir, [
      { rel: 'src/g.js', content: 'export const G = 1;\n', imports: [] },
      { rel: 'src/f.js', content: 'import { G } from "./g";\n', imports: ['src/g.js'] },
    ]);

    // Confirm dangling-edge setup
    const edgesBefore = getEdges(db, 'src/g.js');
    assert.ok(edgesBefore.includes('src/f.js'), 'Edge f→g exists before delete');

    // Delete f.js from working tree
    fs.unlinkSync(path.join(tmpDir, 'src', 'f.js'));

    const touched = compute_touched_files(db, tmpDir);
    assert.ok(touched.deletes.includes('src/f.js'), 'f.js detected as DELETE');

    freshness_check_on_query(
      db, tmpDir,
      { edits: [], adds: [], deletes: ['src/f.js'] },
      null
    );

    // Dangling edge must be gone
    const edgesAfter = getEdges(db, 'src/g.js');
    assert.equal(
      edgesAfter.includes('src/f.js'), false,
      'FAIL: dangling edge f.js→g.js still live after f.js deleted — EDIT-only freshness blind spot'
    );

    // f.js node must be gone
    assert.equal(
      nodeExists(db, 'src/f.js'), false,
      'f.js node must be removed from store'
    );

    db.close();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── (2) ADD: new importer surfaces ──────────────────────────────────────────

test('T5-2: ADD — new file H importing E appears as an importer', () => {
  // E (src/e.js) is indexed. H (src/h.js) is a NEW file not in the store.
  // After adding H and running freshness check, who-imports(E) must include H.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-d4-t5-add-'));
  try {
    const db = setupFixtureDb(tmpDir, [
      { rel: 'src/e.js', content: 'export const E = 1;\n', imports: [] },
    ]);

    // Initial: no importers of e.js
    const edgesBefore = getEdges(db, 'src/e.js');
    assert.equal(edgesBefore.length, 0, 'No importers of e.js initially');

    // Add h.js to the working tree (new file importing e.js)
    const hPath = path.join(tmpDir, 'src', 'h.js');
    fs.writeFileSync(hPath, 'import { E } from "./e";\n', 'utf8');

    const touched = compute_touched_files(db, tmpDir);
    assert.ok(touched.adds.includes('src/h.js'), 'h.js detected as ADD');

    // Mock parseAndPut: when called for h.js, insert h→e edge into the store
    const mockParseAndPut = (rel, absPath, dbHandle) => {
      if (rel === 'src/h.js' && dbHandle) {
        // Simulate D3's parse_and_put: insert the FILE node and the IMPORT edge
        const crypto = require('node:crypto');
        const content = fs.readFileSync(absPath || path.join(tmpDir, rel), 'utf8');
        const hash = crypto.createHash('md5').update(content).digest('hex');
        dbHandle.prepare(
          `INSERT OR REPLACE INTO nodes (id, kind, tier, content_hash, file, name, func_id)
           VALUES (?, 'FILE', 'tree-sitter-floor', ?, ?, null, null)`
        ).run(rel, hash, rel);
        dbHandle.prepare(`INSERT INTO edges (kind, src, dst) VALUES ('IMPORT', ?, ?)`).run(rel, 'src/e.js');
      }
    };

    freshness_check_on_query(
      db, tmpDir,
      { edits: [], adds: ['src/h.js'], deletes: [] },
      mockParseAndPut
    );

    // After freshness check, h.js must appear as an importer of e.js
    const edgesAfter = getEdges(db, 'src/e.js');
    assert.ok(
      edgesAfter.includes('src/h.js'),
      'FAIL: new file h.js (importing e.js) does NOT appear as importer — ADD freshness blind spot'
    );

    db.close();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── (3) RENAME: old path gone, new path present ─────────────────────────────

test('T5-3: RENAME — old path gone from graph, new path present (rename = delete + add)', () => {
  // old.js is indexed. Rename to new.js (delete old path + add new path).
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-d4-t5-rename-'));
  try {
    const db = setupFixtureDb(tmpDir, [
      { rel: 'src/old.js', content: 'export const OLD = 1;\n', imports: [] },
      { rel: 'src/consumer.js', content: 'import { OLD } from "./old";\n', imports: ['src/old.js'] },
    ]);

    // Confirm old path is in the store
    assert.ok(nodeExists(db, 'src/old.js'), 'src/old.js in store before rename');

    // Rename on disk (delete old + create new)
    fs.renameSync(
      path.join(tmpDir, 'src', 'old.js'),
      path.join(tmpDir, 'src', 'new.js')
    );

    const touched = compute_touched_files(db, tmpDir);
    // old.js should be a DELETE (gone from tree); new.js should be an ADD
    assert.ok(touched.deletes.includes('src/old.js'), 'src/old.js detected as DELETE (rename origin)');
    assert.ok(touched.adds.includes('src/new.js'), 'src/new.js detected as ADD (rename destination)');

    // Mock parseAndPut for new.js
    const mockParseAndPut = (rel, absPath, dbHandle) => {
      if (rel === 'src/new.js' && dbHandle) {
        const crypto = require('node:crypto');
        const content = fs.readFileSync(absPath || path.join(tmpDir, rel), 'utf8');
        const hash = crypto.createHash('md5').update(content).digest('hex');
        dbHandle.prepare(
          `INSERT OR REPLACE INTO nodes (id, kind, tier, content_hash, file, name, func_id)
           VALUES (?, 'FILE', 'tree-sitter-floor', ?, ?, null, null)`
        ).run(rel, hash, rel);
      }
    };

    freshness_check_on_query(
      db, tmpDir,
      { edits: [], adds: touched.adds, deletes: touched.deletes },
      mockParseAndPut
    );

    // Old path must be gone
    assert.equal(
      nodeExists(db, 'src/old.js'), false,
      'FAIL: src/old.js still in store after rename — DELETE not processed'
    );

    // New path must be present
    assert.ok(
      nodeExists(db, 'src/new.js'),
      'FAIL: src/new.js NOT in store after rename — ADD not processed'
    );

    db.close();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
