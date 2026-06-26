'use strict';
// Regression: Python relative imports (from .utils / from ..pkg.mod) must resolve
// to real repo-relative file ids so who-imports works on Python/Django code. The
// original extractor did a blind dot->slash replace, turning `from .utils` into a
// bogus `/utils` absolute id (leading dot = current package, not root) — so
// who-imports never matched across Python files. Found by testing a Django-shaped
// fixture; fixed by translating leading dots to ../ levels + a relative specifier.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { extractEdges } = require('../bin/gsd-t-graph-edge-extract.cjs');
const { build_index } = require('../bin/gsd-t-graph-index.cjs');
const cli = require('../bin/gsd-t-graph-query-cli.cjs');

let dir;
before(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm94-py-')); });
after(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });

test('Python single-dot relative import → ./relative specifier (not /absolute)', () => {
  const f = path.join(dir, 'models.py');
  fs.writeFileSync(f, 'from .utils import compute_total\nfrom django.db import models\n');
  const r = extractEdges(f, 'app/models.py');
  const imports = r.edges.filter((e) => e.kind === 'import');
  const rel = imports.find((e) => e.names.includes('compute_total'));
  assert.strictEqual(rel.target, './utils', `from .utils → ./utils (got ${rel.target})`);
  const pkg = imports.find((e) => e.names.includes('models'));
  assert.strictEqual(pkg.target, 'django/db', 'absolute package import unaffected');
});

test('Python two-dot relative import → ../ parent specifier', () => {
  const f = path.join(dir, 'views.py');
  fs.writeFileSync(f, 'from ..core.helpers import render_page\n');
  const r = extractEdges(f, 'app/sub/views.py');
  const imp = r.edges.find((e) => e.kind === 'import' && e.names.includes('render_page'));
  // 2 dots = parent package: './' + '../' + 'core/helpers' = './../core/helpers'
  // (normalizes to ../core/helpers; the query layer resolves it against the source dir).
  assert.strictEqual(imp.target, './../core/helpers', `from ..core.helpers → ./../core/helpers (got ${imp.target})`);
});

test('Python who-imports resolves across a relative import (end-to-end)', () => {
  const repo = path.join(dir, 'repo');
  fs.mkdirSync(path.join(repo, 'app'), { recursive: true });
  fs.mkdirSync(path.join(repo, '.gsd-t'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'app', 'utils.py'), 'def compute_total(x):\n    return x * 1.1\n');
  fs.writeFileSync(path.join(repo, 'app', 'models.py'), 'from .utils import compute_total\ndef total(a):\n    return compute_total(a)\n');
  const db = path.join(repo, '.gsd-t', 'graph.db');
  build_index(repo, { dbPath: db });
  const store = cli.loadStore(db);
  const res = cli.queryWhoImports(store.index, 'app/utils.py');
  assert.ok((res.results || []).includes('app/models.py'),
    `who-imports(app/utils.py) includes app/models.py (got ${JSON.stringify(res.results)})`);
});
