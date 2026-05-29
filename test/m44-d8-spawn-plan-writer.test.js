'use strict';

/**
 * M44 D8 T7 — spawn-plan-writer tests
 *
 * Verifies: atomic write to .gsd-t/spawns/{spawnId}.json, derivation from
 * partition.md + tasks.md fixtures, silent-fail when partition absent,
 * in_progress hint applied to first pending task.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { writeSpawnPlan, spawnsDirFor, _sanitizeSpawnId } = require('../bin/spawn-plan-writer.cjs');

function mktemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'm44d8-writer-'));
}

test('writes a plan file at .gsd-t/spawns/{spawnId}.json', () => {
  const dir = mktemp();
  const p = writeSpawnPlan({
    spawnId: 'test-one',
    kind: 'in-session-subagent',
    projectDir: dir,
    tasks: [{ id: 'X-1', title: 'foo', status: 'pending' }],
  });
  assert.ok(fs.existsSync(p), 'plan file exists');
  assert.match(p, /\.gsd-t\/spawns\/test-one\.json$/);
  const plan = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.equal(plan.spawnId, 'test-one');
  assert.equal(plan.kind, 'in-session-subagent');
  assert.equal(plan.endedAt, null);
  assert.equal(plan.schemaVersion, 1);
});

test('creates .gsd-t/spawns/.gitkeep sentinel on first write', () => {
  const dir = mktemp();
  writeSpawnPlan({ spawnId: 'boot', kind: 'in-session-subagent', projectDir: dir, tasks: [] });
  const gk = path.join(spawnsDirFor(dir), '.gitkeep');
  assert.ok(fs.existsSync(gk), '.gitkeep created');
});

test('atomic write: temp file + rename leaves no .tmp artifacts', () => {
  const dir = mktemp();
  writeSpawnPlan({ spawnId: 'atom', kind: 'in-session-subagent', projectDir: dir, tasks: [] });
  const files = fs.readdirSync(spawnsDirFor(dir));
  for (const f of files) {
    assert.ok(!f.includes('.tmp-'), 'no tmp file remains: ' + f);
  }
});

test('explicit tasks bypass derivation', () => {
  const dir = mktemp();
  const p = writeSpawnPlan({
    spawnId: 'explicit',
    kind: 'in-session-subagent',
    projectDir: dir,
    tasks: [
      { id: 'A', title: 'a', status: 'pending' },
      { id: 'B', title: 'b', status: 'pending' },
    ],
  });
  const plan = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.equal(plan.tasks.length, 2);
  // First pending flipped to in_progress
  assert.equal(plan.tasks[0].status, 'in_progress');
  assert.equal(plan.tasks[1].status, 'pending');
});

test('derives plan from partition.md + tasks.md when tasks not passed', () => {
  const dir = mktemp();
  // Write a synthetic partition.md
  fs.mkdirSync(path.join(dir, '.gsd-t'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, '.gsd-t', 'partition.md'),
    '# M99 Partition\n\nMilestone M99 for tests.\n'
  );
  // Domain folder with tasks.md containing two unchecked tasks
  const domain = 'm99-d1-demo';
  const ddir = path.join(dir, '.gsd-t', 'domains', domain);
  fs.mkdirSync(ddir, { recursive: true });
  fs.writeFileSync(
    path.join(ddir, 'tasks.md'),
    '# M99-D1 — Demo — Tasks\n\n## Wave 1\n\n- [ ] **M99-D1-T1** — first task\n- [ ] **M99-D1-T2** — second task\n'
  );
  const p = writeSpawnPlan({
    spawnId: 'derive-1',
    kind: 'in-session-subagent',
    projectDir: dir,
    milestone: 'M99',
  });
  const plan = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.equal(plan.milestone, 'M99');
  assert.equal(plan.wave, 'wave-1');
  assert.deepEqual(plan.domains, [domain]);
  assert.equal(plan.tasks.length, 2);
  assert.equal(plan.tasks[0].id, 'M99-D1-T1');
  assert.equal(plan.tasks[0].status, 'in_progress');
  assert.equal(plan.tasks[1].id, 'M99-D1-T2');
  assert.equal(plan.tasks[1].status, 'pending');
});

test('silent-fails when partition.md is absent but still writes a plan', () => {
  const dir = mktemp();
  const p = writeSpawnPlan({
    spawnId: 'no-partition',
    kind: 'unattended-worker',
    projectDir: dir,
  });
  assert.ok(fs.existsSync(p), 'plan file still written');
  const plan = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.deepEqual(plan.tasks, []);
});

test('rejects unsafe spawn ids', () => {
  assert.equal(_sanitizeSpawnId('good-id.1'), 'good-id.1');
  assert.equal(_sanitizeSpawnId('bad/id'), null);
  assert.equal(_sanitizeSpawnId('bad id'), null);
  assert.equal(_sanitizeSpawnId(''), null);
  assert.equal(_sanitizeSpawnId(null), null);
});

test('returns absolute path of written file', () => {
  const dir = mktemp();
  const p = writeSpawnPlan({ spawnId: 'absP', kind: 'in-session-subagent', projectDir: dir, tasks: [] });
  assert.ok(path.isAbsolute(p), 'path is absolute: ' + p);
});
