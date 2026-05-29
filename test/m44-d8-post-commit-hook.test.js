'use strict';

/**
 * M44 D8 T7 — post-commit hook tests
 *
 * Invokes the hook script in a synthetic git repo with an active spawn
 * plan, then verifies that task status flipped and token attribution
 * was applied. Also asserts silent-fail on bad state.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execSync, spawnSync } = require('node:child_process');

const HOOK = path.join(__dirname, '..', 'scripts', 'gsd-t-post-commit-spawn-plan.sh');
const WRITER = path.join(__dirname, '..', 'bin', 'spawn-plan-writer.cjs');
const UPDATER = path.join(__dirname, '..', 'bin', 'spawn-plan-status-updater.cjs');

function hasGit() {
  const r = spawnSync('git', ['--version']);
  return r.status === 0;
}

function setupRepo(fixture) {
  execSync('git init -q', { cwd: fixture });
  execSync('git config user.email test@example.com', { cwd: fixture });
  execSync('git config user.name "Test"', { cwd: fixture });
  // Mirror the GSD-T layout that the hook expects
  fs.mkdirSync(path.join(fixture, '.gsd-t', 'spawns'), { recursive: true });
  fs.mkdirSync(path.join(fixture, 'bin'), { recursive: true });
  fs.copyFileSync(WRITER, path.join(fixture, 'bin', 'spawn-plan-writer.cjs'));
  fs.copyFileSync(UPDATER, path.join(fixture, 'bin', 'spawn-plan-status-updater.cjs'));
  // The derive module is optional — copy if present so writer has no require-miss.
  const derive = path.join(__dirname, '..', 'bin', 'spawn-plan-derive.cjs');
  if (fs.existsSync(derive)) fs.copyFileSync(derive, path.join(fixture, 'bin', 'spawn-plan-derive.cjs'));
}

function mktemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'm44d8-hook-'));
}

test('hook extracts single task id from commit message and marks done', { skip: !hasGit() }, () => {
  const dir = mktemp();
  setupRepo(dir);

  // Seed an active plan
  const { writeSpawnPlan } = require(path.join(dir, 'bin', 'spawn-plan-writer.cjs'));
  writeSpawnPlan({
    spawnId: 'hook-1',
    kind: 'in-session-subagent',
    projectDir: dir,
    tasks: [
      { id: 'M44-D8-T1', title: 'writer', status: 'pending' },
      { id: 'M44-D8-T2', title: 'updater', status: 'pending' },
    ],
  });

  // Create and commit a file with a task-id in the message
  fs.writeFileSync(path.join(dir, 'file.txt'), 'hello');
  execSync('git add file.txt', { cwd: dir });
  execSync('git commit -q -m "[M44-D8-T1] writer landed"', { cwd: dir });

  // Invoke the hook inside the repo
  spawnSync('bash', [HOOK], { cwd: dir });

  const plan = JSON.parse(fs.readFileSync(path.join(dir, '.gsd-t', 'spawns', 'hook-1.json'), 'utf8'));
  assert.equal(plan.tasks[0].status, 'done');
  assert.ok(plan.tasks[0].commit, 'commit sha recorded');
  assert.equal(plan.tasks[1].status, 'in_progress');
});

test('hook handles multiple task ids in one commit', { skip: !hasGit() }, () => {
  const dir = mktemp();
  setupRepo(dir);

  const { writeSpawnPlan } = require(path.join(dir, 'bin', 'spawn-plan-writer.cjs'));
  writeSpawnPlan({
    spawnId: 'multi',
    kind: 'in-session-subagent',
    projectDir: dir,
    tasks: [
      { id: 'M44-D8-T1', title: 'a', status: 'pending' },
      { id: 'M44-D8-T2', title: 'b', status: 'pending' },
      { id: 'M44-D8-T3', title: 'c', status: 'pending' },
    ],
  });

  fs.writeFileSync(path.join(dir, 'file.txt'), 'x');
  execSync('git add file.txt', { cwd: dir });
  execSync('git commit -q -m "[M44-D8-T1] + [M44-D8-T2] two at once"', { cwd: dir });
  spawnSync('bash', [HOOK], { cwd: dir });

  const plan = JSON.parse(fs.readFileSync(path.join(dir, '.gsd-t', 'spawns', 'multi.json'), 'utf8'));
  assert.equal(plan.tasks[0].status, 'done');
  assert.equal(plan.tasks[1].status, 'done');
  // Third task becomes in_progress (single-active invariant)
  assert.equal(plan.tasks[2].status, 'in_progress');
});

test('hook exits 0 when no task ids in commit message', { skip: !hasGit() }, () => {
  const dir = mktemp();
  setupRepo(dir);
  fs.writeFileSync(path.join(dir, 'file.txt'), 'x');
  execSync('git add file.txt', { cwd: dir });
  execSync('git commit -q -m "no task id here"', { cwd: dir });
  const r = spawnSync('bash', [HOOK], { cwd: dir });
  assert.equal(r.status, 0, 'hook exits 0');
});

test('hook applies token attribution from token-log.md', { skip: !hasGit() }, () => {
  const dir = mktemp();
  setupRepo(dir);

  const { writeSpawnPlan } = require(path.join(dir, 'bin', 'spawn-plan-writer.cjs'));
  const plan = writeSpawnPlan({
    spawnId: 'attr-1',
    kind: 'in-session-subagent',
    projectDir: dir,
    tasks: [{ id: 'M44-D8-T1', title: 'a', status: 'pending' }],
  });

  // Write a token-log row with the task id AFTER the plan's startedAt
  const tl = path.join(dir, '.gsd-t', 'token-log.md');
  fs.mkdirSync(path.dirname(tl), { recursive: true });
  fs.writeFileSync(tl, [
    '# GSD-T Token Log',
    '',
    '| Datetime-start | Datetime-end | Command | Step | Model | Duration(s) | Tokens | Notes | Domain | Task | Ctx% |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    // Use an absolutely-in-future date so spawn.startedAt < row.startedAt regardless of current time
    '| 2099-12-31 23:59 | 2099-12-31 23:59 | test | - | sonnet | 1s | in=100 out=50 cr=10 cc=5 $0.25 | - | - | M44-D8-T1 | 10 |',
  ].join('\n'));

  fs.writeFileSync(path.join(dir, 'file.txt'), 'x');
  execSync('git add file.txt', { cwd: dir });
  execSync('git commit -q -m "[M44-D8-T1] done"', { cwd: dir });
  spawnSync('bash', [HOOK], { cwd: dir });

  const updated = JSON.parse(fs.readFileSync(plan, 'utf8'));
  assert.equal(updated.tasks[0].status, 'done');
  assert.ok(updated.tasks[0].tokens, 'tokens attributed');
  assert.equal(updated.tasks[0].tokens.in, 100);
  assert.equal(updated.tasks[0].tokens.cost_usd, 0.25);
});

test('hook is silent-fail (exit 0) when .gsd-t/spawns is missing', { skip: !hasGit() }, () => {
  const dir = mktemp();
  execSync('git init -q', { cwd: dir });
  execSync('git config user.email t@e.com', { cwd: dir });
  execSync('git config user.name "T"', { cwd: dir });
  fs.writeFileSync(path.join(dir, 'file.txt'), 'x');
  execSync('git add file.txt', { cwd: dir });
  execSync('git commit -q -m "[M44-D8-T1] no plan dir"', { cwd: dir });
  const r = spawnSync('bash', [HOOK], { cwd: dir });
  assert.equal(r.status, 0);
});
