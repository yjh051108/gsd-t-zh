'use strict';

/**
 * M97 follow-on — scip-python call resolution.
 *
 * Proves the resolver runs scip-python for a Python project and resolves
 * cross-file Python call edges (was tree-sitter-floor / UNRESOLVED before).
 * REQUIRES scip-python on PATH; FAIL-LOUD-SKIP if absent (never silent green).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, execSync } = require('node:child_process');

const { build_index } = require('../bin/gsd-t-graph-index.cjs');
const cli = require('../bin/gsd-t-graph-query-cli.cjs');
const { funcNameFromSymbol } = require('../bin/gsd-t-scip-reader.cjs');

function present(bin) {
  try { execSync(`which ${bin}`, { stdio: 'pipe' }); return true; } catch { return false; }
}
const PY_SCIP = present('scip-python');
let DB;
try { DB = require('better-sqlite3'); } catch { DB = null; }
const SKIP = !DB ? 'better-sqlite3 not installed'
  : !PY_SCIP ? 'FAIL-LOUD-SKIP: scip-python not installed — M97 Python resolution requires it'
  : false;

test('Python SCIP symbols extract callable names (same name(). form as TS)', () => {
  assert.equal(funcNameFromSymbol('scip-python python proj 1.0 `bo.auth`/login_required().'), 'login_required');
  assert.equal(funcNameFromSymbol('scip-python python proj 1.0 `bo.x`/get_logger().'), 'get_logger');
});

test('scip-python resolves a cross-file Python call edge', { skip: SKIP }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm97-py-'));
  fs.mkdirSync(path.join(dir, 'pkg'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.gsd-t'), { recursive: true });
  try {
    fs.writeFileSync(path.join(dir, 'pkg', '__init__.py'), '');
    fs.writeFileSync(path.join(dir, 'pkg', 'util.py'), 'def compute_total(x):\n    return x + 1\n');
    fs.writeFileSync(path.join(dir, 'pkg', 'main.py'),
      'from pkg.util import compute_total\n\ndef run():\n    return compute_total(10)\n');

    const db = path.join(dir, '.gsd-t', 'graph.db');
    build_index(dir, { dbPath: db });
    const idx = cli.loadStore(db).index;

    const resolved = idx.forwardCallEdges.find(
      (e) => /main\.py/.test(e.src) && e.dst === 'pkg/util.py#compute_total'
    );
    assert.ok(resolved, `cross-file Python call resolved to pkg/util.py#compute_total (edges: ${JSON.stringify(idx.forwardCallEdges.filter(e => /main\.py/.test(e.src)))})`);

    const wc = cli.queryWhoCalls(idx, 'pkg/util.py#compute_total');
    assert.ok((wc.results || []).some((c) => /main\.py/.test(c)),
      `who-calls(compute_total) includes the caller in main.py, got ${JSON.stringify(wc.results)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
