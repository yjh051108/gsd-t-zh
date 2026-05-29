'use strict';

/**
 * M44 D8 T7 — spawn-plan-status-updater tests
 *
 * Verifies: markTaskDone patches the correct task, promotes next pending
 * to in_progress, is a no-op on unknown ids, writes tokens field correctly;
 * markSpawnEnded sets endedAt + endedReason; listActivePlans filters.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { writeSpawnPlan } = require('../bin/spawn-plan-writer.cjs');
const {
  markTaskDone,
  markSpawnEnded,
  listActivePlans,
  sumTokensForTask,
  _parseTokensCell,
} = require('../bin/spawn-plan-status-updater.cjs');

function mktemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'm44d8-upd-'));
}

function seedPlan(dir, spawnId, tasks) {
  return writeSpawnPlan({ spawnId, kind: 'in-session-subagent', projectDir: dir, tasks });
}

test('markTaskDone flips the matching task and records commit', () => {
  const dir = mktemp();
  seedPlan(dir, 'm-1', [
    { id: 'T1', title: 'one', status: 'pending' },
    { id: 'T2', title: 'two', status: 'pending' },
  ]);
  const r = markTaskDone({ spawnId: 'm-1', taskId: 'T1', commit: 'sha1234', projectDir: dir });
  assert.equal(r.patched, true);
  const plan = JSON.parse(fs.readFileSync(r.path, 'utf8'));
  assert.equal(plan.tasks[0].status, 'done');
  assert.equal(plan.tasks[0].commit, 'sha1234');
  // next pending promoted
  assert.equal(plan.tasks[1].status, 'in_progress');
});

test('markTaskDone writes tokens field when supplied', () => {
  const dir = mktemp();
  seedPlan(dir, 'm-2', [{ id: 'T1', title: 'one', status: 'pending' }]);
  const tokens = { in: 100, out: 50, cr: 10, cc: 5, cost_usd: 0.25 };
  const r = markTaskDone({ spawnId: 'm-2', taskId: 'T1', commit: 'abc', tokens, projectDir: dir });
  assert.equal(r.patched, true);
  const plan = JSON.parse(fs.readFileSync(r.path, 'utf8'));
  assert.deepEqual(plan.tasks[0].tokens, tokens);
});

test('markTaskDone is a no-op on unknown taskId', () => {
  const dir = mktemp();
  seedPlan(dir, 'm-3', [{ id: 'T1', title: 'one', status: 'pending' }]);
  const r = markTaskDone({ spawnId: 'm-3', taskId: 'UNKNOWN', projectDir: dir });
  assert.equal(r.patched, false);
});

test('markTaskDone is a no-op on unknown spawnId', () => {
  const dir = mktemp();
  const r = markTaskDone({ spawnId: 'does-not-exist', taskId: 'T1', projectDir: dir });
  assert.equal(r.patched, false);
});

test('markSpawnEnded sets endedAt + endedReason', () => {
  const dir = mktemp();
  seedPlan(dir, 'm-4', [{ id: 'T1', title: 'one', status: 'pending' }]);
  const r = markSpawnEnded({ spawnId: 'm-4', endedReason: 'success', projectDir: dir });
  assert.equal(r.patched, true);
  const plan = JSON.parse(fs.readFileSync(r.path, 'utf8'));
  assert.ok(plan.endedAt, 'endedAt set');
  assert.equal(plan.endedReason, 'success');
});

test('listActivePlans only returns plans with endedAt=null', () => {
  const dir = mktemp();
  seedPlan(dir, 'active-1', [{ id: 'T1', title: 'a', status: 'pending' }]);
  seedPlan(dir, 'active-2', [{ id: 'T1', title: 'b', status: 'pending' }]);
  markSpawnEnded({ spawnId: 'active-2', projectDir: dir });
  const active = listActivePlans(dir);
  assert.equal(active.length, 1);
  assert.match(active[0], /active-1\.json$/);
});

test('sumTokensForTask parses token-log rows within spawn window', () => {
  const dir = mktemp();
  const tl = path.join(dir, '.gsd-t', 'token-log.md');
  fs.mkdirSync(path.dirname(tl), { recursive: true });
  fs.writeFileSync(tl, [
    '# GSD-T Token Log',
    '',
    '| Datetime-start | Datetime-end | Command | Step | Model | Duration(s) | Tokens | Notes | Domain | Task | Ctx% |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    '| 2026-04-23 00:05 | 2026-04-23 00:06 | test | - | sonnet | 60s | in=100 out=50 cr=10 cc=5 $0.25 | - | - | M44-D8-T1 | 10 |',
    '| 2026-04-23 00:07 | 2026-04-23 00:08 | test | - | sonnet | 60s | in=200 out=100 cr=20 cc=10 $0.50 | - | - | M44-D8-T1 | 12 |',
    '| 2026-04-22 00:00 | 2026-04-22 00:01 | test | - | sonnet | 60s | in=1 out=1 cr=0 cc=0 $0.10 | too old | - | M44-D8-T1 | 5 |',
  ].join('\n'));
  const tokens = sumTokensForTask({
    projectDir: dir,
    taskId: 'M44-D8-T1',
    spawnStartedAt: '2026-04-23T00:00:00Z',
  });
  assert.ok(tokens, 'found tokens');
  assert.equal(tokens.in, 300);
  assert.equal(tokens.out, 150);
  assert.equal(tokens.cr, 30);
  assert.equal(tokens.cc, 15);
  assert.equal(tokens.cost_usd, 0.75);
});

test('sumTokensForTask returns null when no matches', () => {
  const dir = mktemp();
  const tl = path.join(dir, '.gsd-t', 'token-log.md');
  fs.mkdirSync(path.dirname(tl), { recursive: true });
  fs.writeFileSync(tl, [
    '# GSD-T Token Log',
    '',
    '| Datetime-start | Datetime-end | Command | Step | Model | Duration(s) | Tokens | Notes | Domain | Task | Ctx% |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  ].join('\n'));
  const tokens = sumTokensForTask({ projectDir: dir, taskId: 'X', spawnStartedAt: '2026-04-23T00:00:00Z' });
  assert.equal(tokens, null);
});

test('_parseTokensCell extracts in/out/cr/cc/cost_usd', () => {
  const t = _parseTokensCell('in=12 out=34 cr=5 cc=6 $0.78');
  assert.deepEqual(t, { in: 12, out: 34, cr: 5, cc: 6, cost_usd: 0.78 });
  assert.equal(_parseTokensCell('—'), null);
  assert.equal(_parseTokensCell(''), null);
});
