'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  loadConfig,
  DEFAULTS,
  MAX_PARALLEL_CEILING,
  computeAdaptiveMaxParallel,
  WORKER_RAM_BUDGET_BYTES,
  ADAPTIVE_FLOOR
} = require('../bin/gsd-t-orchestrator-config.cjs');

function mkProj(cfg) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm40-cfg-'));
  fs.mkdirSync(path.join(dir, '.gsd-t'));
  if (cfg) fs.writeFileSync(path.join(dir, '.gsd-t', 'orchestrator.config.json'), JSON.stringify(cfg));
  return dir;
}

test('defaults when no config, no cli, no env — adaptive maxParallel', () => {
  const dir = mkProj();
  const c = loadConfig({ projectDir: dir, env: {}, freeMemBytes: 16 * 1024 * 1024 * 1024 });
  assert.equal(c.maxParallel, 8);
  assert.equal(c.maxParallelSource, 'adaptive');
  assert.equal(c.workerTimeoutMs, DEFAULTS.workerTimeoutMs);
  assert.equal(c.retryOnFail, DEFAULTS.retryOnFail);
  assert.equal(c.haltOnSecondFail, DEFAULTS.haltOnSecondFail);
  assert.equal(c.projectDir, dir);
});

test('static DEFAULTS.maxParallel is the safe floor (3)', () => {
  assert.equal(DEFAULTS.maxParallel, 3);
});

test('computeAdaptiveMaxParallel scales by 2GB-per-worker, floor 3, ceiling 15', () => {
  assert.equal(computeAdaptiveMaxParallel(0), ADAPTIVE_FLOOR);
  assert.equal(computeAdaptiveMaxParallel(1 * 1024 * 1024 * 1024), ADAPTIVE_FLOOR);
  assert.equal(computeAdaptiveMaxParallel(4 * 1024 * 1024 * 1024), ADAPTIVE_FLOOR);
  assert.equal(computeAdaptiveMaxParallel(8 * 1024 * 1024 * 1024), 4);
  assert.equal(computeAdaptiveMaxParallel(16 * 1024 * 1024 * 1024), 8);
  assert.equal(computeAdaptiveMaxParallel(20 * 1024 * 1024 * 1024), 10);
  assert.equal(computeAdaptiveMaxParallel(64 * 1024 * 1024 * 1024), MAX_PARALLEL_CEILING);
  assert.equal(computeAdaptiveMaxParallel(NaN), ADAPTIVE_FLOOR);
});

test('config-file maxParallel takes precedence over adaptive default', () => {
  const dir = mkProj({ maxParallel: 6 });
  const c = loadConfig({ projectDir: dir, env: {}, freeMemBytes: 64 * 1024 * 1024 * 1024 });
  assert.equal(c.maxParallel, 6);
  assert.equal(c.maxParallelSource, 'config-file');
});

test('low-memory machine without config falls back to floor (3), not 10', () => {
  const dir = mkProj();
  const c = loadConfig({ projectDir: dir, env: {}, freeMemBytes: 2 * 1024 * 1024 * 1024 });
  assert.equal(c.maxParallel, ADAPTIVE_FLOOR);
});

test('config file overrides defaults', () => {
  const dir = mkProj({ maxParallel: 5, workerTimeoutMs: 60000 });
  const c = loadConfig({ projectDir: dir, env: {} });
  assert.equal(c.maxParallel, 5);
  assert.equal(c.workerTimeoutMs, 60000);
});

test('cli flags override config file', () => {
  const dir = mkProj({ maxParallel: 5 });
  const c = loadConfig({ projectDir: dir, cliFlags: { maxParallel: 7 }, env: {} });
  assert.equal(c.maxParallel, 7);
});

test('env overrides cli flags', () => {
  const dir = mkProj({ maxParallel: 5 });
  const c = loadConfig({
    projectDir: dir,
    cliFlags: { maxParallel: 7 },
    env: { GSD_T_MAX_PARALLEL: '9' }
  });
  assert.equal(c.maxParallel, 9);
});

test('env empty string is ignored', () => {
  const dir = mkProj({ maxParallel: 5 });
  const c = loadConfig({
    projectDir: dir,
    cliFlags: { maxParallel: 7 },
    env: { GSD_T_MAX_PARALLEL: '' }
  });
  assert.equal(c.maxParallel, 7);
});

test('rejects maxParallel > ceiling', () => {
  const dir = mkProj();
  assert.throws(
    () => loadConfig({ projectDir: dir, cliFlags: { maxParallel: MAX_PARALLEL_CEILING + 1 }, env: {} }),
    /exceeds Team Mode §15 ceiling/
  );
});

test('rejects maxParallel < 1', () => {
  const dir = mkProj();
  assert.throws(
    () => loadConfig({ projectDir: dir, cliFlags: { maxParallel: 0 }, env: {} }),
    /maxParallel must be >= 1/
  );
});

test('rejects workerTimeoutMs < 1000', () => {
  const dir = mkProj();
  assert.throws(
    () => loadConfig({ projectDir: dir, cliFlags: { workerTimeoutMs: 500 }, env: {} }),
    /workerTimeoutMs must be >= 1000/
  );
});

test('rejects non-integer env value', () => {
  const dir = mkProj();
  assert.throws(
    () => loadConfig({ projectDir: dir, env: { GSD_T_MAX_PARALLEL: 'abc' } }),
    /must be a non-negative integer/
  );
});

test('rejects corrupt config file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm40-cfg-'));
  fs.mkdirSync(path.join(dir, '.gsd-t'));
  fs.writeFileSync(path.join(dir, '.gsd-t', 'orchestrator.config.json'), '{not json');
  assert.throws(
    () => loadConfig({ projectDir: dir, env: {} }),
    /parse error/
  );
});

test('missing projectDir throws', () => {
  assert.throws(() => loadConfig({ env: {} }), /requires projectDir/);
});
