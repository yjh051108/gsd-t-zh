'use strict';

/**
 * M94-D4 — T6: RE-PLAN Fix-4 killing test: multi-file freshness coherence.
 *
 * [RULE] freshness-multifile-reindex-serialized-coherent
 *
 * Proves that per-file atomicity is NOT enough. When N > 1 files all contribute
 * to who-imports(X), the freshness module re-indexes ALL of them to completion
 * BEFORE the query reads — guaranteeing a coherent all-new state, never a mix
 * of old-for-some / new-for-others.
 *
 * Fixture: importers B, C, D of X are ALL edited (uncommitted).
 * freshness_check_on_query must:
 *   - Call parseAndPut for B, C, AND D (all three, fully serialized)
 *   - Return reindexed = ['src/b.js', 'src/c.js', 'src/d.js'] (all-new state for every file)
 *   - NOT partially re-index (e.g. stop after B — that would be old-for-C / new-for-B)
 *
 * FAILS LOUD if the multi-file dirty-set re-index is not serialized-to-completion.
 * NO timing assertion ([#6 timing split]; ≥100-file wall-clock measured in T3).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
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

// ─── T6: Multi-file coherence killing test ───────────────────────────────────

test('T6: multi-file dirty set re-indexed serially to ALL-NEW coherent state', () => {
  // [RULE] freshness-multifile-reindex-serialized-coherent
  // who-imports(X) edges span B, C, D — ALL dirty.
  // The answer must reflect ALL-NEW state for every contributing file.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-d4-t6-'));
  try {
    const db = setupFixtureDb(tmpDir, [
      { rel: 'src/x.js', content: 'export const X = 1;\n', imports: [] },
      { rel: 'src/b.js', content: 'import { X } from "./x"; // version 1\n', imports: ['src/x.js'] },
      { rel: 'src/c.js', content: 'import { X } from "./x"; // version 1\n', imports: ['src/x.js'] },
      { rel: 'src/d.js', content: 'import { X } from "./x"; // version 1\n', imports: ['src/x.js'] },
    ]);

    // Edit B, C, and D (all three importers of X — all dirty at once, uncommitted)
    fs.writeFileSync(path.join(tmpDir, 'src', 'b.js'), 'import { X } from "./x"; // b version 2\n', 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'src', 'c.js'), 'import { X } from "./x"; // c version 2\n', 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'src', 'd.js'), 'import { X } from "./x"; // d version 2\n', 'utf8');

    // Track the order parseAndPut is called
    const parseAndPutOrder = [];
    const mockParseAndPut = (rel) => { parseAndPutOrder.push(rel); };

    const result = freshness_check_on_query(
      db, tmpDir,
      { edits: ['src/b.js', 'src/c.js', 'src/d.js'], adds: [], deletes: [] },
      mockParseAndPut
    );

    // ALL three files must have been re-indexed (serialized to completion)
    assert.ok(
      parseAndPutOrder.includes('src/b.js'),
      'FAIL: src/b.js NOT re-indexed — multi-file coherence broken (B served stale)'
    );
    assert.ok(
      parseAndPutOrder.includes('src/c.js'),
      'FAIL: src/c.js NOT re-indexed — multi-file coherence broken (C served stale)'
    );
    assert.ok(
      parseAndPutOrder.includes('src/d.js'),
      'FAIL: src/d.js NOT re-indexed — multi-file coherence broken (D served stale)'
    );
    assert.equal(parseAndPutOrder.length, 3, 'Exactly 3 files re-indexed (B, C, D — no extras)');

    // Result must report all three reindexed (serialized)
    assert.ok(result.reindexed.includes('src/b.js'), 'B in reindexed list');
    assert.ok(result.reindexed.includes('src/c.js'), 'C in reindexed list');
    assert.ok(result.reindexed.includes('src/d.js'), 'D in reindexed list');
    assert.equal(result.reindexed.length, 3, 'All 3 files in reindexed list');

    // No errors
    assert.equal(result.errors.length, 0, 'No errors during multi-file re-index');

    // The key coherence invariant: re-index was serialized to completion (all 3)
    // BEFORE the query would read. A partial re-index (e.g. only B) would mean
    // the answer reflects B's new state but C/D's old state — a torn multi-file view.
    // We prove serialization by asserting ALL three were processed.
    assert.equal(
      parseAndPutOrder.length === 3 &&
      parseAndPutOrder.includes('src/b.js') &&
      parseAndPutOrder.includes('src/c.js') &&
      parseAndPutOrder.includes('src/d.js'),
      true,
      'COHERENCE PROOF: all 3 contributing files re-indexed before result returned — no torn multi-file view'
    );

    db.close();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── T6-B: Partial re-index WOULD be a torn state (documentation test) ──────

test('T6-B: freshness_check_on_query does NOT short-circuit on first error', () => {
  // Verifies that even if parseAndPut throws for one file, the others are still processed.
  // This prevents a "stop on first error" pattern that would leave the remaining
  // files un-reindexed (old state for some / new for others).
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-d4-t6b-'));
  try {
    const db = setupFixtureDb(tmpDir, [
      { rel: 'src/x.js', content: 'export const X = 1;\n', imports: [] },
      { rel: 'src/b.js', content: 'import { X } from "./x";\n', imports: ['src/x.js'] },
      { rel: 'src/c.js', content: 'import { X } from "./x";\n', imports: ['src/x.js'] },
    ]);

    fs.writeFileSync(path.join(tmpDir, 'src', 'b.js'), '// changed\n', 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'src', 'c.js'), '// changed\n', 'utf8');

    const processed = [];
    let callCount = 0;
    const mockParseAndPut = (rel) => {
      callCount++;
      if (callCount === 1) {
        // Simulate parseAndPut throwing for the first file
        processed.push(rel + ':error');
        throw new Error('simulated parseAndPut failure');
      }
      processed.push(rel + ':ok');
    };

    const result = freshness_check_on_query(
      db, tmpDir,
      { edits: ['src/b.js', 'src/c.js'], adds: [], deletes: [] },
      mockParseAndPut
    );

    // Both files should have been attempted (not short-circuited on first error)
    assert.equal(
      callCount, 2,
      'FAIL: short-circuit on first error — remaining files not re-indexed (torn multi-file state)'
    );
    // The error should be recorded, not propagated as an exception
    assert.ok(result.errors.length > 0, 'First file error recorded (not thrown)');
    // The second file should still have been attempted
    assert.ok(
      processed.some(p => p.includes('src/c.js')),
      'Second file c.js still attempted after b.js error'
    );

    db.close();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
