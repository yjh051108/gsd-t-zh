'use strict';

/**
 * M98-D3 — Read-intercept hook + install wiring.
 *
 *  AC-5 structural read augments / bare read passes through (no shrinking).
 *  AC-6 non-code / unindexed / no-graph passes through.
 *  Fail-open on malformed input. Install: idempotent add + uninstall removal.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const HOOK = path.join(__dirname, '..', 'scripts', 'gsd-t-read-intercept.js');
const INDEX = path.join(__dirname, '..', 'bin', 'gsd-t-graph-index.cjs');
const gsdt = require('../bin/gsd-t.js');

let Database;
try { Database = require('better-sqlite3'); } catch { Database = null; }
const SKIP = Database ? false : 'better-sqlite3 not installed';

const BIN_TOOLS = [
  'gsd-t-graph-query-cli.cjs', 'gsd-t-graph-index.cjs', 'gsd-t-graph-freshness.cjs',
  'gsd-t-graph-edge-extract.cjs', 'gsd-t-graph-scip-upgrade.cjs', 'gsd-t-scip-reader.cjs',
  'gsd-t-require-store.cjs',
];

function runHook(payload) {
  const res = spawnSync(process.execPath, [HOOK], { input: JSON.stringify(payload), encoding: 'utf8', timeout: 20000 });
  return res.stdout.trim();
}

function mkProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm98d3-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.gsd-t'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"m98d3","version":"1.0.0"}');
  fs.writeFileSync(path.join(dir, 'README.md'), '# readme\nline two\nline three\n');
  fs.writeFileSync(path.join(dir, 'src', 'math.ts'), [
    'import { log } from "./util";',           // 1
    '',                                        // 2
    'export function add(a: number): number {',// 3
    '  log("adding");',                        // 4
    '  return a + 1;',                         // 5
    '}',                                       // 6
  ].join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'src', 'util.ts'), 'export function log(m: string){}\n');
  const binDir = path.join(dir, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  for (const f of BIN_TOOLS) fs.copyFileSync(path.join(__dirname, '..', 'bin', f), path.join(binDir, f));
  execFileSync(process.execPath, [INDEX, 'build', '--repo', dir], { cwd: dir, stdio: 'ignore' });
  return dir;
}

test('AC-5: a structural read (offset/limit inside add) is AUGMENTED, original retained', { skip: SKIP }, () => {
  const dir = mkProject();
  try {
    const out = runHook({
      tool_name: 'Read',
      tool_input: { file_path: path.join(dir, 'src', 'math.ts'), offset: 3, limit: 4 },
      tool_response: 'ORIGINAL_FILE_BODY',
      cwd: dir,
    });
    assert.ok(out, 'hook augmented');
    const env = JSON.parse(out);
    const aug = env.hookSpecificOutput.updatedToolOutput;
    assert.match(aug, /ORIGINAL_FILE_BODY/, 'original file output retained (no shrinking)');
    assert.match(aug, /code graph/, 'graph note present');
    assert.match(aug, /graph body 'src\/math\.ts#add@3'/, 'points at the precise body verb');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('AC-5: a bare read (no offset/limit) PASSES THROUGH — no silent shrinking', { skip: SKIP }, () => {
  const dir = mkProject();
  try {
    const out = runHook({
      tool_name: 'Read',
      tool_input: { file_path: path.join(dir, 'src', 'math.ts') },
      tool_response: 'WHOLE_FILE',
      cwd: dir,
    });
    assert.equal(out, '', 'bare read passes through (hook emits nothing)');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('AC-6: non-code file passes through', { skip: SKIP }, () => {
  const dir = mkProject();
  try {
    const out = runHook({
      tool_name: 'Read',
      tool_input: { file_path: path.join(dir, 'README.md'), offset: 1, limit: 2 },
      tool_response: 'x', cwd: dir,
    });
    assert.equal(out, '', 'non-code passes through');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('AC-6: project with no graph passes through', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm98d3-nograph-'));
  fs.mkdirSync(path.join(dir, '.gsd-t'), { recursive: true }); // .gsd-t but no graph.db
  fs.writeFileSync(path.join(dir, 'a.ts'), 'export function f(){}\n');
  try {
    const out = runHook({
      tool_name: 'Read',
      tool_input: { file_path: path.join(dir, 'a.ts'), offset: 1, limit: 1 },
      tool_response: 'x', cwd: dir,
    });
    assert.equal(out, '', 'no graph → pass through');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('AC-6: a read outside any function range passes through', { skip: SKIP }, () => {
  const dir = mkProject();
  try {
    // line 2 is blank, between imports and add() — not inside any function.
    const out = runHook({
      tool_name: 'Read',
      tool_input: { file_path: path.join(dir, 'src', 'math.ts'), offset: 2, limit: 1 },
      tool_response: 'x', cwd: dir,
    });
    assert.equal(out, '', 'read outside a function → pass through');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('augment-never-shrink: a large original (≈cap) passes through rather than being truncated', { skip: SKIP }, () => {
  const dir = mkProject();
  try {
    const huge = 'X'.repeat(9500); // > OUTPUT_CAP (9000) once combined with the note
    const out = runHook({
      tool_name: 'Read',
      tool_input: { file_path: path.join(dir, 'src', 'math.ts'), offset: 3, limit: 4 },
      tool_response: huge,
      cwd: dir,
    });
    // The hook must NOT emit a truncated (shrunk) version — it passes through.
    assert.equal(out, '', 'oversize original → pass through, never truncate the file body');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('fail-open: malformed stdin passes through, never crashes', () => {
  const res = spawnSync(process.execPath, [HOOK], { input: 'not json at all', encoding: 'utf8' });
  assert.equal(res.status, 0, 'exit 0');
  assert.equal(res.stdout.trim(), '', 'pass through');
});

test('fail-open: a non-Read tool passes through', () => {
  const out = runHook({ tool_name: 'Grep', tool_input: { pattern: 'x' }, cwd: '/tmp' });
  assert.equal(out, '', 'non-Read tool → pass through');
});

test('install: configureReadInterceptHook adds once (idempotent) and uninstall removes it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm98d3-inst-'));
  const settings = path.join(dir, 'settings.json');
  fs.writeFileSync(settings, JSON.stringify({ hooks: { PostToolUse: [] } }, null, 2));
  try {
    assert.equal(gsdt.configureReadInterceptHook(settings).action, 'added');
    assert.equal(gsdt.configureReadInterceptHook(settings).action, 'noop', 'idempotent');
    let s = JSON.parse(fs.readFileSync(settings, 'utf8'));
    const reads = s.hooks.PostToolUse.filter((e) => e.matcher === 'Read');
    assert.equal(reads.length, 1);
    assert.match(JSON.stringify(reads), /gsd-t-read-intercept/);

    assert.equal(gsdt.removeInterceptHooks(settings), true, 'uninstall removes it');
    s = JSON.parse(fs.readFileSync(settings, 'utf8'));
    assert.equal(s.hooks.PostToolUse.filter((e) => e.matcher === 'Read').length, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
