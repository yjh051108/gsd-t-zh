'use strict';

/**
 * M98-D2 — `body` query verb.
 *
 * Drives bin/gsd-t-graph-query-cli.cjs `body` against a real fixture graph.
 *  AC-1 exact source + context · AC-2 token win · AC-3 freshness · AC-4 ambiguity.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const INDEX = path.join(__dirname, '..', 'bin', 'gsd-t-graph-index.cjs');
const CLI = path.join(__dirname, '..', 'bin', 'gsd-t-graph-query-cli.cjs');

let Database;
try { Database = require('better-sqlite3'); } catch { Database = null; }
const SKIP = Database ? false : 'better-sqlite3 not installed';

const BIN_TOOLS = [
  'gsd-t-graph-query-cli.cjs', 'gsd-t-graph-index.cjs', 'gsd-t-graph-freshness.cjs',
  'gsd-t-graph-edge-extract.cjs', 'gsd-t-graph-scip-upgrade.cjs', 'gsd-t-scip-reader.cjs',
  'gsd-t-require-store.cjs',
];

function mkProject(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm98d2-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.gsd-t'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"m98d2","version":"1.0.0"}');
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  const binDir = path.join(dir, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  for (const f of BIN_TOOLS) fs.copyFileSync(path.join(__dirname, '..', 'bin', f), path.join(binDir, f));
  execFileSync(process.execPath, [INDEX, 'build', '--repo', dir], { cwd: dir, stdio: 'ignore' });
  return dir;
}

function body(dir, target) {
  const res = spawnSync(process.execPath, [CLI, 'body', target], { cwd: dir, encoding: 'utf8', timeout: 20000 });
  return JSON.parse(res.stdout.trim().split('\n').pop());
}

const MATH = [
  'import { log } from "./util";',           // 1
  '',                                        // 2
  'export function add(a: number): number {',// 3
  '  log("adding");',                        // 4
  '  return a + 1;',                         // 5
  '}',                                       // 6
  '',                                        // 7
  'export class Calc {',                     // 8
  '  mul(x: number, y: number): number {',   // 9
  '    return x * y;',                       // 10
  '  }',                                     // 11
  '}',                                       // 12
].join('\n') + '\n';

test('AC-1: body returns exact source + imports + tier + line range', { skip: SKIP }, () => {
  const dir = mkProject({ 'src/math.ts': MATH, 'src/util.ts': 'export function log(m: string){ console.log(m); }\n' });
  try {
    const r = body(dir, 'src/math.ts#add');
    assert.equal(r.ok, true);
    assert.deepEqual(r.lineRange, [3, 6]);
    assert.match(r.source, /export function add\(a: number\): number \{/);
    assert.match(r.source, /return a \+ 1;/);
    assert.ok(!/export class Calc/.test(r.source), 'slice does not bleed past the function end');
    assert.ok(r.imports.some((l) => /import \{ log \}/.test(l)), 'imports attached');
    assert.ok(r.tier, 'tier labeled');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('AC-1b: a method body carries its class header', { skip: SKIP }, () => {
  const dir = mkProject({ 'src/math.ts': MATH, 'src/util.ts': 'export function log(m: string){}\n' });
  try {
    const r = body(dir, 'src/math.ts#mul');
    assert.equal(r.ok, true);
    assert.deepEqual(r.lineRange, [9, 11]);
    assert.match(r.classHeader || '', /class Calc/);
    assert.match(r.source, /return x \* y;/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('AC-2: body slice is far smaller than the whole file', { skip: SKIP }, () => {
  // A file with one small target function among many lines.
  const big = ['import { z } from "./z";', ''].concat(
    Array.from({ length: 200 }, (_, i) => `// filler line ${i}`),
    ['export function target(): number {', '  return 42;', '}'],
    Array.from({ length: 200 }, (_, i) => `// more filler ${i}`),
  ).join('\n') + '\n';
  const dir = mkProject({ 'src/big.ts': big, 'src/z.ts': 'export const z = 1;\n' });
  try {
    const r = body(dir, 'src/big.ts#target');
    assert.equal(r.ok, true);
    const sliceLen = (r.source + (r.imports || []).join('\n')).length;
    const wholeLen = big.length;
    assert.ok(sliceLen * 10 <= wholeLen, `slice (${sliceLen}) should be ≤ 1/10th of whole file (${wholeLen})`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('AC-3 (killing): editing the function reflows body at new lines with no manual reindex', { skip: SKIP }, () => {
  const dir = mkProject({ 'src/math.ts': MATH, 'src/util.ts': 'export function log(m: string){}\n' });
  try {
    // Shift add() down 4 lines AND change its body.
    const edited = ['// x', '// y', '// z', '// w'].join('\n') + '\n' +
      MATH.replace('  return a + 1;', '  log("more");\n  return a + 99;');
    fs.writeFileSync(path.join(dir, 'src', 'math.ts'), edited);
    const r = body(dir, 'src/math.ts#add'); // bare file#name — no @line, query re-resolves
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.match(r.source, /return a \+ 99;/, 'new body served');
    assert.ok(r.lineRange[0] >= 7, `add() moved down (start ${r.lineRange[0]})`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('tier-preserving reindex: a pre-M98 node (null end_line) is re-indexed WITHOUT downgrading its stored tier', { skip: SKIP }, () => {
  const dir = mkProject({ 'src/math.ts': MATH, 'src/util.ts': 'export function log(m: string){}\n' });
  try {
    // Simulate a pre-M98 state: wipe end_line on add() AND force the file's stored
    // tier to a compiler-accurate value, so a downgrade would be observable.
    const dbPath = path.join(dir, '.gsd-t', 'graph.db');
    let db = new Database(dbPath);
    db.prepare("UPDATE nodes SET end_line = NULL WHERE name = 'add'").run();
    db.prepare("UPDATE files SET tier = 'compiler-accurate' WHERE file = 'src/math.ts'").run();
    db.prepare("UPDATE nodes SET tier = 'compiler-accurate' WHERE file = 'src/math.ts'").run();
    db.close();

    // body triggers the inline re-index (null end_line → needsReindex).
    const r = body(dir, 'src/math.ts#add');
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(r.lineRange, [3, 6], 'end_line repopulated by the re-index');

    // The file's stored tier must NOT have been silently downgraded to plain floor.
    // Honest label for a metadata-only re-index of a previously-accurate file is
    // STALE-SCIP (not a lie of "compiler-accurate", not a silent drop to floor).
    db = new Database(dbPath, { readonly: true });
    const fileTier = db.prepare("SELECT tier FROM files WHERE file = 'src/math.ts'").get().tier;
    db.close();
    assert.equal(fileTier, 'tree-sitter-floor-STALE-SCIP', 'tier not silently downgraded to plain floor');
    assert.notEqual(fileTier, 'tree-sitter-floor', 'a previously compiler-accurate file is never silently dropped to plain floor');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('AC-4 (killing): an ambiguous bare symbol returns candidates, never a merged body', { skip: SKIP }, () => {
  const dir = mkProject({
    'src/a.ts': 'export function helper(): number { return 1; }\n',
    'src/b.ts': 'export function helper(): string { return "x"; }\n',
  });
  try {
    const res = spawnSync(process.execPath, [CLI, 'body', 'helper'], { cwd: dir, encoding: 'utf8' });
    const r = JSON.parse(res.stdout.trim().split('\n').pop());
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'ambiguous-function');
    assert.equal(r.candidates.length, 2);
    assert.ok(!('source' in r), 'never returns a body for an ambiguous symbol');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
