'use strict';

/**
 * M94-D4 — T4: Pre-mortem Fix-1 killing test: touched-set derivation.
 *
 * Proves compute_touched_files() derives the dirty set from the WHOLE TREE,
 * not just the query target. An edited non-target file (B) is never served stale.
 *
 * [RULE] touched-set-is-whole-tree-dirty-not-query-target
 *
 * 3-file fixture: A imports B; B imports C.
 * B's CONTENT is edited but B is NOT the query target.
 * Query: who-imports(C) → must reflect B's NEW state (B's import of C changed).
 *
 * The test FAILS if the implementation derives touched_files only from the
 * query target — B's edit would then be invisible.
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

// ─── T4: Whole-tree dirty set (Fix-1 killing test) ───────────────────────────

test('T4: edited non-target file B detected — whole-tree dirty-set derivation', () => {
  // Graph: A → B → C (A imports B; B imports C)
  // The "query target" is C (we want who-imports(C)).
  // B's content is edited but B is not the query target.
  // REQUIREMENT: B must appear in the dirty set despite not being queried directly.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-d4-t4-'));
  try {
    const db = setupFixtureDb(tmpDir, [
      { rel: 'src/a.js', content: 'import { B } from "./b";\n', imports: ['src/b.js'] },
      { rel: 'src/b.js', content: 'import { C } from "./c";\n', imports: ['src/c.js'] },
      { rel: 'src/c.js', content: 'export const C = 1;\n', imports: [] },
    ]);

    // Verify initial state — no dirty files
    const initialTouched = compute_touched_files(db, tmpDir);
    assert.equal(initialTouched.edits.length, 0, 'No edits initially');

    // Edit B's CONTENT without querying B
    fs.writeFileSync(
      path.join(tmpDir, 'src', 'b.js'),
      'import { C } from "./c"; // b changed — still imports C\n',
      'utf8'
    );

    // compute_touched_files MUST find B as stale (whole-tree scan, not query-target-only)
    const touched = compute_touched_files(db, tmpDir);

    assert.ok(
      touched.edits.includes('src/b.js'),
      'FAIL: B (non-target) NOT detected as stale — dirty-set is likely query-target-only, not whole-tree'
    );
    assert.equal(touched.edits.includes('src/a.js'), false, 'A (unchanged) not in edits');
    assert.equal(touched.edits.includes('src/c.js'), false, 'C (unchanged) not in edits');

    // Simulate: re-index B via freshness_check_on_query before answering who-imports(C)
    const reindexed = [];
    const mockParseAndPut = (rel) => { reindexed.push(rel); };

    freshness_check_on_query(
      db, tmpDir,
      { edits: touched.edits, adds: touched.adds, deletes: touched.deletes },
      mockParseAndPut
    );

    // B must have been re-indexed (its new state feeds who-imports(C))
    assert.ok(reindexed.includes('src/b.js'), 'B re-indexed before who-imports(C) would be answered');

    db.close();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
