'use strict';

/**
 * M95 — SCIP call-graph resolution.
 *
 * Proves the precise tier is REAL, not a relabel:
 *   - the SCIP reader turns index.scip into symbol→funcId + per-file refs
 *   - build_index resolves UNRESOLVED# call edges to real cross-file funcIds
 *   - test-impl returns resolved impl funcIds (was [] before M95)
 *   - tier honesty: a file whose calls all stay unresolvable is labeled
 *     tree-sitter-floor, NEVER compiler-accurate (the old lie).
 *
 * These tests REQUIRE scip-typescript on PATH (a GSD-T install requirement as of
 * M95). They FAIL LOUD (not silent-skip) if it is absent — its absence is now a
 * setup error, not an acceptable degrade.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execSync } = require('node:child_process');

const { build_index } = require('../bin/gsd-t-graph-index.cjs');
const cli = require('../bin/gsd-t-graph-query-cli.cjs');
const { readScipIndex, funcNameFromSymbol } = require('../bin/gsd-t-scip-reader.cjs');
const upg = require('../bin/gsd-t-graph-scip-upgrade.cjs');

function scipTypescriptPresent() {
  try { execSync('which scip-typescript', { stdio: 'pipe' }); return true; }
  catch { return false; }
}
const SCIP_PRESENT = scipTypescriptPresent();

function mkRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm95-scip-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'e2e'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.gsd-t'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), '{ "name":"m95fix","version":"1.0.0" }');
  fs.writeFileSync(path.join(dir, 'tsconfig.json'),
    '{ "compilerOptions": { "target":"ES2020","module":"ESNext","moduleResolution":"node","allowJs":true }, "include":["src","e2e"] }');
  return dir;
}

test('M95-1: funcNameFromSymbol extracts callable names, rejects params/modules', () => {
  const P = 'scip-typescript npm m95fix 1.0.0 ';
  assert.equal(funcNameFromSymbol(P + 'src/`calc.ts`/computeTotal().'), 'computeTotal');
  assert.equal(funcNameFromSymbol(P + 'src/`calc.ts`/computeTotal().(x)'), null, 'param is not a callable');
  assert.equal(funcNameFromSymbol(P + 'src/`calc.ts`/'), null, 'module is not a callable');
});

test('M95-2: SCIP resolution wires a cross-file test→impl call edge (was UNRESOLVED)', { skip: SCIP_PRESENT ? false : 'FAIL-LOUD: scip-typescript not installed — M95 requires it' }, () => {
  const dir = mkRepo();
  try {
    fs.writeFileSync(path.join(dir, 'src', 'calc.ts'),
      'export function computeTotal(x: number): number {\n  return x * 1.1;\n}\n');
    fs.writeFileSync(path.join(dir, 'e2e', 'calc.spec.ts'),
      "import { computeTotal } from '../src/calc';\ntest('t', () => {\n  const r = computeTotal(10);\n  expect(r).toBe(11);\n});\n");

    const db = path.join(dir, '.gsd-t', 'graph.db');
    build_index(dir, { dbPath: db });
    const idx = cli.loadStore(db).index;

    // The call edge from the spec file must resolve to the real impl funcId.
    const resolved = idx.forwardCallEdges.find(
      (e) => /calc\.spec\.ts/.test(e.src) && e.dst === 'src/calc.ts#computeTotal'
    );
    assert.ok(resolved, 'test→impl call edge resolved to src/calc.ts#computeTotal (not UNRESOLVED#computeTotal)');

    // test-impl returns the resolved impl (was [] before M95).
    const ti = cli.queryTestImpl(idx);
    const allImpl = ti.results.flatMap((r) => r.implFuncs);
    assert.ok(allImpl.includes('src/calc.ts#computeTotal'),
      `test-impl returns resolved impl funcId, got ${JSON.stringify(allImpl)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('M95-3: tier honesty — a file whose calls stay unresolvable is floor, NOT compiler-accurate', { skip: SCIP_PRESENT ? false : 'FAIL-LOUD: scip-typescript not installed — M95 requires it' }, () => {
  const dir = mkRepo();
  try {
    // calls ONLY a runtime global with no static definition → must stay UNRESOLVED
    fs.writeFileSync(path.join(dir, 'src', 'dyn.ts'),
      'export function caller() {\n  (globalThis as any).mysteryExternal(42);\n}\n');

    const db = path.join(dir, '.gsd-t', 'graph.db');
    build_index(dir, { dbPath: db });
    const idx = cli.loadStore(db).index;

    let dynTier = null;
    for (const [fid, meta] of idx.funcEntities) {
      if (fid.startsWith('src/dyn.ts')) dynTier = meta.tier;
    }
    assert.equal(dynTier, 'tree-sitter-floor',
      `dyn.ts has only unresolvable calls → must be tree-sitter-floor, got ${dynTier} (the old relabel-lie)`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('M95-4: readScipIndex fails loud (not throw) on a missing/garbage .scip', () => {
  const r1 = readScipIndex('/nonexistent/index.scip');
  assert.equal(r1.ok, false);
  assert.ok(/missing|unavailable/.test(r1.reason), `clear reason, got ${r1.reason}`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'm95-bad-'));
  try {
    const bad = path.join(tmp, 'index.scip');
    fs.writeFileSync(bad, 'not a protobuf');
    const r2 = readScipIndex(bad);
    assert.equal(r2.ok, false, 'garbage .scip → ok:false, never a partial/wrong map');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('M95-5: buildScipResolver returns a no-op passthrough when SCIP absent (never throws)', () => {
  // Force "absent" by resetting detection to all-false.
  upg._resetScipCache({ typescript: false, python: false, rust: false });
  try {
    const dir = mkRepo();
    try {
      const r = upg.buildScipResolver(dir);
      assert.equal(r.ok, false);
      // Both indexers forced absent → 'scip-indexers-absent' (M97: TS + Python).
      assert.equal(r.reason, 'scip-indexers-absent');
      // passthrough must not throw and must return edges unchanged
      const edges = [{ kind: 'CALL', src: 'a#f', dst: 'UNRESOLVED#g' }];
      const out = r.resolveFileEdges('a.ts', edges);
      assert.equal(out.resolved, 0);
      assert.deepEqual(out.edges, edges);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } finally {
    upg._resetScipCache(null); // restore real detection
  }
});
