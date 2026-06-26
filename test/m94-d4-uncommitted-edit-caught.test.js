'use strict';

/**
 * M94-D4 — AC-3 KILLING TEST: uncommitted working-tree edit IS detected.
 *
 * This is the structural proof that dirty-detection uses file CONTENT, not git-SHA.
 * [RULE] freshness-content-hash-not-git-sha
 *
 * Test: edit a working-tree file WITHOUT committing (git-SHA unchanged);
 * the content-hash mismatch IS detected and the file re-indexed.
 * FAILS LOUD if a git-SHA-based implementation lets the unchanged SHA pass.
 *
 * Also asserts:
 *   - One-hop (not transitive) re-validation: a 2-hop importer is NOT re-checked.
 *   - NO inline wall-clock assertion ([#6 timing split]).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const {
  compute_touched_files,
  freshness_check_on_query,
} = require(path.join(__dirname, '..', 'bin', 'gsd-t-graph-freshness.cjs'));

// ─── Skip guard ───────────────────────────────────────────────────────────────

let Database;
try { Database = require('better-sqlite3'); }
catch { Database = null; }

if (!Database) {
  test('SKIP: better-sqlite3 not installed — AC-3 killing test requires it', () => {
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
    CREATE INDEX IF NOT EXISTS edges_src_kind ON edges(src, kind);
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
    if (f.importsDst) insEdge.run(f.rel, f.importsDst);
  }

  return db;
}

// ─── AC-3 Killing Test ────────────────────────────────────────────────────────

test('AC-3: uncommitted working-tree edit IS detected by content-hash (git-SHA unchanged)', () => {
  // [RULE] freshness-content-hash-not-git-sha
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-ac3-'));
  try {
    // Set up 3 files: C imports B; B imports A.
    // Graph: A (edited) ← B (direct importer) ← C (2-hop, must NOT be re-checked)
    const db = setupFixtureDb(tmpDir, [
      { rel: 'src/a.js', content: 'export const A = 1; // initial\n' },
      { rel: 'src/b.js', content: 'import { A } from "./a";\n', importsDst: 'src/a.js' },
      { rel: 'src/c.js', content: 'import { B } from "./b";\n', importsDst: 'src/b.js' },
    ]);

    // ── Verify git-SHA stays the same after a write (if git is available) ──
    // We write the file and check that git still sees "no staged changes"
    // (the file is modified in working tree but not committed).
    const aAbs = path.join(tmpDir, 'src', 'a.js');

    // Optionally init a git repo to make the "git-SHA unchanged" claim concrete.
    // This is a best-effort proof — if git is not available, skip the git-SHA check
    // but still prove content-hash detection works.
    let gitShaBeforeEdit = null;
    let gitShaAfterEdit = null;
    const isGitDir = fs.existsSync(path.join(tmpDir, '.git'));
    if (!isGitDir) {
      try {
        execFileSync('git', ['-C', tmpDir, 'init', '--quiet']);
        execFileSync('git', ['-C', tmpDir, 'config', 'user.email', 'test@test.com']);
        execFileSync('git', ['-C', tmpDir, 'config', 'user.name', 'Test']);
        execFileSync('git', ['-C', tmpDir, 'add', '.']);
        execFileSync('git', ['-C', tmpDir, 'commit', '-m', 'initial', '--quiet']);
        // Get the git SHA of a.js before the edit
        gitShaBeforeEdit = execFileSync(
          'git', ['-C', tmpDir, 'rev-parse', 'HEAD:src/a.js'],
          { encoding: 'utf8' }
        ).trim();
      } catch {
        // git not available or init failed — still run content-hash proof
      }
    }

    // ── The edit: modify a.js WITHOUT committing ──
    fs.writeFileSync(aAbs, 'export const A = 99; // uncommitted edit\n', 'utf8');

    // Check git-SHA after edit (should be SAME as before — the file is not committed)
    if (gitShaBeforeEdit) {
      try {
        gitShaAfterEdit = execFileSync(
          'git', ['-C', tmpDir, 'rev-parse', 'HEAD:src/a.js'],
          { encoding: 'utf8' }
        ).trim();
        assert.equal(
          gitShaBeforeEdit, gitShaAfterEdit,
          'PROOF: git-SHA is UNCHANGED after an uncommitted edit — a git-SHA detector would miss this'
        );
      } catch { /* git SHA check optional */ }
    }

    // ── The killing assertion: content-hash MUST detect the edit ──
    const touched = compute_touched_files(db, tmpDir);

    assert.ok(
      touched.edits.includes('src/a.js'),
      'FAIL: uncommitted edit to src/a.js NOT detected — content-hash detector broken (possibly using git-SHA)'
    );

    // ── Re-index via parseAndPut (mocked — D3 not yet built) ──
    const parseAndPutCalls = [];
    const mockParseAndPut = (rel) => { parseAndPutCalls.push(rel); };

    const result = freshness_check_on_query(
      db, tmpDir,
      { edits: ['src/a.js'], adds: [], deletes: [] },
      mockParseAndPut
    );

    assert.ok(
      parseAndPutCalls.includes('src/a.js'),
      'Stale file a.js was re-indexed via parseAndPut'
    );
    assert.equal(result.errors.length, 0, 'No re-index errors');

    // ── One-hop re-validation: B is the direct importer, C is 2-hop ──
    const rv = result.revalidated.find(r => r.file === 'src/a.js');
    assert.ok(rv, 'Revalidation record present for a.js');
    assert.ok(
      rv.directImporters.includes('src/b.js'),
      'B (direct importer) appears in one-hop revalidation'
    );
    assert.equal(
      rv.directImporters.includes('src/c.js'), false,
      'C (2-hop importer) is NOT in one-hop revalidation — transitive closure NOT walked'
    );
    assert.equal(rv.hopsChecked, 1, 'Exactly 1 hop checked');

    // ── No timing assertion (per [#6 timing split]) ──
    // The sub-~1s budget is measured at 1.5M-node scale in T3 / the spike doc.

    db.close();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
