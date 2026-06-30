'use strict';
// Regression guards for 3 real-scale indexer bugs the real-Atos streaming smoke
// test surfaced (all missed by small-fixture unit tests):
//   Bug 1 — putRecord re-prepared 6 SQL statements PER FILE → 61-min full index.
//           Fix: prepare once per db handle (getWriteStmts). Guard: putRecord must
//           not call db.prepare; build-time on a many-file fixture stays bounded.
//   Bug 2 — tree-sitter-python 0.25 was ABI-incompatible with tree-sitter 0.21 →
//           every .py file crashed in setLanguage. Fix: tree-sitter-python@0.21.0.
//           Guard: a real-ish Python source extracts entities+edges without throwing.
//   Bug 3 — SCIP absent reported tier.upgraded:0 silently. Fix: build_index emits a
//           loud scipNotice + scipAvailable flag (R4-2 honesty). Guard: notice present
//           when no SCIP indexer was provided.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { extractEdges } = require('../bin/gsd-t-graph-edge-extract.cjs');
const { build_index, putRecord } = require('../bin/gsd-t-graph-index.cjs');

let dir;
before(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm94-realscale-')); });
after(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });

// ── Bug 1: prepared statements hoisted (structural — not a flaky wall-clock) ──
test('putRecord does not re-prepare SQL statements per call (Bug 1 perf)', () => {
  const Database = require('better-sqlite3');
  const db = new Database(path.join(dir, 'b1.db'));
  // minimal schema
  db.exec(`
    CREATE TABLE files (file TEXT PRIMARY KEY, content_hash TEXT, tier TEXT, indexed_at TEXT);
    CREATE TABLE nodes (id TEXT PRIMARY KEY, kind TEXT, tier TEXT, content_hash TEXT, file TEXT, name TEXT, func_id TEXT, end_line INTEGER);
    CREATE TABLE edges (kind TEXT, src TEXT, dst TEXT, partial INTEGER);
  `);
  let prepareCount = 0;
  const origPrepare = db.prepare.bind(db);
  db.prepare = (sql) => { prepareCount++; return origPrepare(sql); };

  const rec = (i) => ({ file: `f${i}.ts`, contentHash: 'h', tier: 'tree-sitter-floor',
    entities: [{ id: `f${i}.ts#fn`, type: 'function', name: 'fn' }],
    edges: [{ kind: 'CALL', src: `f${i}.ts#fn`, dst: 'g.ts#h', partial: 0 }] });

  putRecord(db, rec(1)); // first call prepares the bundle once
  const afterFirst = prepareCount;
  for (let i = 2; i <= 50; i++) putRecord(db, rec(i)); // 49 more files
  const afterMany = prepareCount;

  // The 49 subsequent files must add ZERO new prepares (statements are cached).
  assert.strictEqual(afterMany, afterFirst, `subsequent putRecord calls must not re-prepare (first=${afterFirst}, after 50 files=${afterMany})`);
  db.close();
});

// ── Bug 2: Python files index (ABI-compatible grammar) ──────────────────────
test('extractEdges parses a Python file without crashing (Bug 2)', () => {
  const f = path.join(dir, 'sample.py');
  fs.writeFileSync(f, 'import os\nfrom sys import path\n\ndef build(x):\n    return os.path.join(x)\n\nclass Thing:\n    def run(self):\n        return build("a")\n', 'utf8');
  const r = extractEdges(f, 'sample.py');
  assert.ok(r && Array.isArray(r.entities), 'returns entities (does not throw on .py)');
  assert.ok(r.entities.length >= 2, `python entities extracted (got ${r.entities.length})`);
});

// ── Bug 3: SCIP-absent is surfaced loudly, not silently 0-upgraded ──────────
test('build_index surfaces a loud notice when no SCIP indexer is available (Bug 3)', () => {
  // tiny one-file repo
  const repo = path.join(dir, 'repo');
  fs.mkdirSync(repo, { recursive: true });
  fs.writeFileSync(path.join(repo, 'a.ts'), 'export function f() { return 1; }\n', 'utf8');
  // Force the SCIP-UNAVAILABLE path explicitly with a resolver-less scip context.
  // Passing `scip: null` would auto-detect the upgrader, and when scip-typescript
  // IS installed in the environment (M95 made it real), the build genuinely upgrades
  // → scipAvailable:true → this test's "no indexer available" premise no longer
  // holds. An explicit { resolver: null } context tests the notice behavior
  // deterministically regardless of whether scip-typescript is installed.
  const r = build_index(repo, {
    dbPath: path.join(dir, 'b3.db'),
    scip: { resolver: null, projectRoot: repo },
  });
  assert.strictEqual(r.scipAvailable, false, 'scipAvailable=false when the scip context has no resolver');
  assert.ok(typeof r.scipNotice === 'string' && /SCIP indexer not available/.test(r.scipNotice),
    'scipNotice clearly states SCIP is absent + edges are tree-sitter-floor');
  assert.strictEqual(r.tier.upgraded, 0, 'no compiler-accurate upgrade without SCIP (honest floor)');
});
