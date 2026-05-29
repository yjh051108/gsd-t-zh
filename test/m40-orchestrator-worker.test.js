'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { runWorker, buildArgs } = require('../bin/gsd-t-orchestrator-worker.cjs');

function mkProj() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm40-worker-'));
  fs.mkdirSync(path.join(dir, '.gsd-t'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.gsd-t', 'progress.md'), '# Progress\n');
  return dir;
}

test('buildArgs: default model sonnet', () => {
  const args = buildArgs({ id: 't1' });
  assert.ok(args.includes('--model'));
  assert.equal(args[args.indexOf('--model') + 1], 'sonnet');
  assert.ok(args.includes('--dangerously-skip-permissions'));
  assert.ok(args.includes('stream-json'));
});

test('buildArgs: explicit model honored', () => {
  const args = buildArgs({ id: 't1', model: 'opus' });
  assert.equal(args[args.indexOf('--model') + 1], 'opus');
});

function mockSpawn(behavior) {
  const { EventEmitter } = require('events');
  return (_bin, _args, _opts) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { write: () => {}, end: () => {}, on: () => {} };
    child.kill = () => {};
    setImmediate(() => {
      if (behavior === 'happy') {
        child.stdout.emit('data', Buffer.from('{"type":"assistant","content":"ok"}\n{"type":"result","ok":true}\n'));
        child.emit('exit', 0, null);
      } else if (behavior === 'fail') {
        child.stdout.emit('data', Buffer.from('{"type":"assistant","content":"bad"}\n'));
        child.emit('exit', 2, null);
      }
    });
    return child;
  };
}

test('runWorker: happy path — frames emitted, completion check runs, ok=false (no commit)', async () => {
  const dir = mkProj();
  const frames = [];
  const result = await runWorker({
    task: { id: 'm40-t', domain: 'd-x', wave: 0, skipTest: true },
    brief: 'do a thing',
    config: { projectDir: dir, workerTimeoutMs: 5000 },
    onFrame: (f) => frames.push(f),
    env: process.env,
    spawnImpl: mockSpawn('happy')
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.timedOut, false);
  assert.ok(result.durationMs >= 0);

  const boundaries = frames.filter(f => f.type === 'task-boundary');
  assert.equal(boundaries[0].state, 'start');
  assert.equal(boundaries[boundaries.length - 1].state, 'failed');

  const native = frames.filter(f => f.type === 'assistant' || f.type === 'result');
  assert.equal(native.length, 2);

  assert.equal(result.result.ok, false);
  assert.ok(result.result.missing.includes('no_commit_on_branch'));
});

test('runWorker: non-zero exit → missing includes worker_exit_nonzero', async () => {
  const dir = mkProj();
  const result = await runWorker({
    task: { id: 'm40-fail', domain: 'd-x', wave: 0, skipTest: true },
    brief: 'fail me',
    config: { projectDir: dir, workerTimeoutMs: 5000 },
    onFrame: () => {},
    env: process.env,
    spawnImpl: mockSpawn('fail')
  });

  assert.equal(result.exitCode, 2);
  assert.equal(result.timedOut, false);
  assert.equal(result.result.ok, false);
  assert.equal(result.result.missing[0], 'worker_exit_nonzero');
});

test('runWorker: timeout triggers SIGTERM and missing worker_exited_via_timeout', async () => {
  const { EventEmitter } = require('events');
  const dir = mkProj();
  const logs = [];
  const t0 = Date.now();

  const spawnImpl = () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { write: () => {}, end: () => {}, on: () => {} };
    child.kill = (sig) => {
      if (sig === 'SIGTERM') {
        setTimeout(() => child.emit('exit', null, 'SIGTERM'), 10);
      }
    };
    return child;
  };

  const result = await runWorker({
    task: { id: 'm40-hang', domain: 'd-x', wave: 0, skipTest: true },
    brief: 'never finishes',
    config: {
      projectDir: dir,
      workerTimeoutMs: 100,
      logger: { log: (m) => logs.push(m) }
    },
    onFrame: () => {},
    env: process.env,
    spawnImpl
  });

  const elapsed = Date.now() - t0;
  assert.equal(result.timedOut, true);
  assert.ok(result.result.missing.includes('worker_exited_via_timeout'));
  assert.ok(logs.some(m => /\[worker_timeout\]/.test(m)));
  assert.ok(elapsed < 2000, 'mock timeout must not wait for a real sleep');
});

test('runWorker: spawn error → result includes spawn_error', async () => {
  const dir = mkProj();
  const result = await runWorker({
    task: { id: 'm40-bad-bin', domain: 'd-x', wave: 0, skipTest: true },
    brief: 'whatever',
    config: { projectDir: dir, workerTimeoutMs: 5000 },
    onFrame: () => {},
    env: { ...process.env, GSD_T_CLAUDE_BIN: '/definitely/not/a/binary' }
  });

  assert.equal(result.exitCode, -1);
  assert.ok(
    result.result.missing.includes('spawn_error') || result.result.missing.includes('worker_exit_nonzero'),
    'missing should include spawn_error or nonzero: ' + JSON.stringify(result.result.missing)
  );
});

test('runWorker: invalid json lines wrapped as {type:"raw"}', async () => {
  const { EventEmitter } = require('events');
  const dir = mkProj();
  const frames = [];

  const spawnImpl = () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { write: () => {}, end: () => {}, on: () => {} };
    child.kill = () => {};
    setImmediate(() => {
      child.stdout.emit('data', Buffer.from('not json at all\n{"type":"result","ok":true}\n'));
      child.emit('exit', 0, null);
    });
    return child;
  };

  await runWorker({
    task: { id: 'm40-raw', domain: 'd-x', wave: 0, skipTest: true },
    brief: 'garbled',
    config: { projectDir: dir, workerTimeoutMs: 5000 },
    onFrame: (f) => frames.push(f),
    env: process.env,
    spawnImpl
  });
  const raw = frames.filter(f => f.type === 'raw');
  assert.equal(raw.length, 1);
  assert.equal(raw[0].line, 'not json at all');
});

test('runWorker: worker cwd = config.projectDir, env has GSD_T_PROJECT_DIR', async () => {
  const { EventEmitter } = require('events');
  const dir = mkProj();
  let capturedOpts = null;

  const spawnImpl = (_bin, _args, opts) => {
    capturedOpts = opts;
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { write: () => {}, end: () => {}, on: () => {} };
    child.kill = () => {};
    setImmediate(() => child.emit('exit', 0, null));
    return child;
  };

  await runWorker({
    task: { id: 'm40-env', domain: 'd-x', wave: 0, skipTest: true },
    brief: 'check env',
    config: { projectDir: dir, workerTimeoutMs: 5000 },
    onFrame: () => {},
    env: { PATH: process.env.PATH },
    spawnImpl
  });

  assert.equal(capturedOpts.cwd, dir);
  assert.equal(capturedOpts.env.GSD_T_PROJECT_DIR, dir);
});

test('runWorker: validates required args', async () => {
  await assert.rejects(async () => {
    await runWorker({ task: null, brief: 'x', config: { projectDir: '/tmp', workerTimeoutMs: 1000 } });
  });
  await assert.rejects(async () => {
    await runWorker({ task: { id: 't' }, brief: '', config: { projectDir: '/tmp', workerTimeoutMs: 1000 } });
  });
  await assert.rejects(async () => {
    await runWorker({ task: { id: 't' }, brief: 'x', config: { workerTimeoutMs: 1000 } });
  });
  await assert.rejects(async () => {
    await runWorker({ task: { id: 't' }, brief: 'x', config: { projectDir: '/tmp' } });
  });
});
