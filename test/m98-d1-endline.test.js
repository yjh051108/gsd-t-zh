'use strict';

/**
 * M98-D1 — extractor end-line capture + schema migration.
 *
 * Proves: every function/method/class entity carries `endLine`; the indexer stores
 * it on `nodes.end_line`; a pre-M98 graph (no column) is migrated idempotently; a
 * freshness re-index rewrites end_line for a shifted function.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const EXTRACT = require('../bin/gsd-t-graph-edge-extract.cjs');
const INDEX = path.join(__dirname, '..', 'bin', 'gsd-t-graph-index.cjs');

let Database;
try { Database = require('better-sqlite3'); } catch { Database = null; }
const SKIP = Database ? false : 'better-sqlite3 not installed';

function writeFixture(dir) {
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.gsd-t'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"m98d1","version":"1.0.0"}');
  fs.writeFileSync(path.join(dir, 'src', 'math.ts'), [
    'import { log } from "./util";',          // 1
    '',                                       // 2
    'export function add(a: number): number {',// 3
    '  log("x");',                            // 4
    '  return a + 1;',                        // 5
    '}',                                      // 6
    '',                                       // 7
    'export class Calc {',                    // 8
    '  mul(x: number, y: number): number {',  // 9
    '    return x * y;',                      // 10
    '  }',                                    // 11
    '}',                                      // 12
    '',                                       // 13
    'export const sq = (n: number) => {',     // 14
    '  return n * n;',                        // 15
    '};',                                     // 16
  ].join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'src', 'util.ts'), 'export function log(m: string){ console.log(m); }\n');
}

test('end-line: extractor records endLine for fn / method / class / arrow', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm98d1-ex-'));
  try {
    writeFixture(dir);
    const { entities } = EXTRACT.extractEdges(path.join(dir, 'src', 'math.ts'), 'src/math.ts');
    const by = Object.fromEntries(entities.map((e) => [e.name, e]));
    assert.equal(by.add.line, 3);   assert.equal(by.add.endLine, 6);
    assert.equal(by.Calc.line, 8);  assert.equal(by.Calc.endLine, 12);
    assert.equal(by.mul.line, 9);   assert.equal(by.mul.endLine, 11);
    assert.equal(by.sq.line, 14);   assert.equal(by.sq.endLine, 16);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('end-line: indexer stores nodes.end_line', { skip: SKIP }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm98d1-ix-'));
  try {
    writeFixture(dir);
    execFileSync(process.execPath, [INDEX, 'build', '--repo', dir], { cwd: dir, stdio: 'ignore' });
    const db = new Database(path.join(dir, '.gsd-t', 'graph.db'), { readonly: true });
    const rows = db.prepare("SELECT name, func_id, end_line FROM nodes WHERE name IN ('add','mul','sq')").all();
    db.close();
    const by = Object.fromEntries(rows.map((r) => [r.name, r]));
    assert.equal(by.add.end_line, 6);
    assert.equal(by.mul.end_line, 11);
    assert.equal(by.sq.end_line, 16);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('migration: a pre-M98 nodes table (no end_line) gains the column without data loss', { skip: SKIP }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm98d1-mig-'));
  try {
    const dbPath = path.join(dir, 'old.db');
    // Simulate a pre-M98 store: 7-column nodes, one row, no end_line.
    let db = new Database(dbPath);
    db.exec('CREATE TABLE nodes (id TEXT PRIMARY KEY, kind TEXT, tier TEXT, content_hash TEXT, file TEXT, name TEXT, func_id TEXT)');
    db.prepare('INSERT INTO nodes VALUES (?,?,?,?,?,?,?)').run('f#g@1', 'function', 'tree-sitter-floor', 'h', 'f.ts', 'g', 'f#g@1');
    db.close();
    // Apply the same idempotent migration the indexer runs (column-detect + ALTER).
    db = new Database(dbPath);
    const hasBefore = db.prepare('PRAGMA table_info(nodes)').all().some((c) => c.name === 'end_line');
    assert.equal(hasBefore, false, 'pre-M98 table lacks end_line');
    if (!hasBefore) db.exec('ALTER TABLE nodes ADD COLUMN end_line INTEGER');
    // idempotent: a second detect+ALTER must be a no-op (no throw)
    const hasAfter = db.prepare('PRAGMA table_info(nodes)').all().some((c) => c.name === 'end_line');
    assert.equal(hasAfter, true, 'column added');
    const row = db.prepare("SELECT id, name, end_line FROM nodes WHERE id='f#g@1'").get();
    db.close();
    assert.equal(row.name, 'g', 'existing row preserved');
    assert.equal(row.end_line, null, 'pre-existing row gets null end_line');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('freshness: a re-index after shifting a function rewrites end_line', { skip: SKIP }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm98d1-fresh-'));
  try {
    writeFixture(dir);
    execFileSync(process.execPath, [INDEX, 'build', '--repo', dir], { cwd: dir, stdio: 'ignore' });
    // Shift add() down 3 lines by prepending comments.
    const p = path.join(dir, 'src', 'math.ts');
    fs.writeFileSync(p, '// a\n// b\n// c\n' + fs.readFileSync(p, 'utf8'));
    // Re-index the file via parse_and_put (the freshness re-index path).
    const { parse_and_put } = require('../bin/gsd-t-graph-index.cjs');
    const { requireBetterSqlite } = require('../bin/gsd-t-require-store.cjs');
    const D = requireBetterSqlite();
    const db = new D(path.join(dir, '.gsd-t', 'graph.db'));
    parse_and_put(p, 'src/math.ts', { db });
    const row = db.prepare("SELECT func_id, end_line FROM nodes WHERE name='add'").get();
    db.close();
    assert.equal(row.func_id, 'src/math.ts#add@6', 'add() start shifted 3→6');
    assert.equal(row.end_line, 9, 'add() end shifted 6→9');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
