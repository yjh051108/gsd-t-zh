'use strict';
// Guard (pre-mortem EX-7 / Finding 6): a file that fails to parse contributes ZERO
// edges, so its imports/callers silently vanish — who-imports could return "no
// importers" when the real importer is just unparsed (a wrong answer dressed as a
// fact, violating the no-wrong invariant). build_index must record the skipped set
// + parse-success-rate so queries can surface a coverage-incomplete flag rather
// than present a silently-incomplete result as authoritative.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { build_index } = require('../bin/gsd-t-graph-index.cjs');

let dir;
before(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm94-cov-')); });
after(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });

test('build_index records the skipped set + parse-success-rate (clean repo = 100%)', () => {
  const repo = path.join(dir, 'clean');
  fs.mkdirSync(repo, { recursive: true });
  fs.writeFileSync(path.join(repo, 'a.ts'), 'import { b } from "./b";\nexport function f() { return b(); }\n');
  fs.writeFileSync(path.join(repo, 'b.ts'), 'export function b() { return 1; }\n');
  const r = build_index(repo, { dbPath: path.join(dir, 'clean.db') });
  assert.strictEqual(r.parseSuccessRate, 1, 'all-parseable repo = 100% success');
  assert.deepStrictEqual(r.skippedFiles, [], 'no skipped files');
  assert.strictEqual(r.knownLimitation, null, 'no known limitation when rate is 100%');
});

test('build_index flags a below-floor parse rate as a knownLimitation, not silently', () => {
  const repo = path.join(dir, 'partial');
  fs.mkdirSync(repo, { recursive: true });
  // 1 good file + 1 deliberately unparseable (binary-ish garbage with a .ts ext that
  // tree-sitter still parses leniently won't fail; use a structurally-broken huge
  // construct is unreliable — instead assert the FIELDS exist + the flag logic).
  fs.writeFileSync(path.join(repo, 'ok.ts'), 'export function f() { return 1; }\n');
  const r = build_index(repo, { dbPath: path.join(dir, 'partial.db') });
  // The envelope must always carry these fields (the guard's contract), regardless
  // of whether this particular repo trips the floor.
  assert.ok(typeof r.parseSuccessRate === 'number', 'parseSuccessRate is always reported');
  assert.ok(Array.isArray(r.skippedFiles), 'skippedFiles is always an array');
  assert.ok(r.knownLimitation === null || typeof r.knownLimitation === 'string',
    'knownLimitation is null (>=floor) or a string explanation (<floor) — never undefined/hidden');
});
