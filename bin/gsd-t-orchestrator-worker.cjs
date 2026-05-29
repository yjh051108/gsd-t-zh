'use strict';

const { spawn } = require('child_process');
const path = require('path');
const { assertCompletion } = require('./gsd-t-completion-check.cjs');
// M61 D4: gsd-t-transcript-tee retired. Was the viewer/dashboard's
// transcript capture surface. Native /workflows view replaces it.
// Stub with no-op methods for any worker that calls into it.
const transcriptTee = {
  openTranscript: () => ({}),
  appendFrame: () => {},
  closeTranscript: () => {},
  allocateSpawnId: () => `stub-spawn-${Date.now()}`,
  attachTee: () => ({ close: () => {} }),
};

const DEFAULT_CLAUDE_BIN = 'claude';

function nowIso() {
  return new Date().toISOString();
}

function pickClaudeBin(env) {
  return env.GSD_T_CLAUDE_BIN || DEFAULT_CLAUDE_BIN;
}

function buildArgs(task) {
  const model = (task && task.model) || 'sonnet';
  return [
    '-p',
    '--dangerously-skip-permissions',
    '--output-format', 'stream-json',
    '--verbose',
    '--model', model
  ];
}

function emitBoundary(onFrame, task, state, extra) {
  if (typeof onFrame !== 'function') return;
  const frame = {
    type: 'task-boundary',
    taskId: task.id,
    domain: task.domain || null,
    wave: task.wave == null ? null : task.wave,
    state,
    ts: nowIso()
  };
  if (extra) Object.assign(frame, extra);
  try { onFrame(frame); } catch (_) { /* onFrame must not kill worker */ }
}

function parseLines(buffer, onLine) {
  let start = 0;
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === '\n') {
      const line = buffer.slice(start, i);
      if (line) onLine(line);
      start = i + 1;
    }
  }
  return buffer.slice(start);
}

function runWorker(opts) {
  const {
    task,
    brief,
    config,
    onFrame,
    env = process.env,
    spawnImpl = spawn
  } = opts || {};

  if (!task || !task.id) throw new Error('runWorker requires task with id');
  if (typeof brief !== 'string' || !brief.length) throw new Error('runWorker requires non-empty brief');
  if (!config || !config.projectDir) throw new Error('runWorker requires config.projectDir');
  if (!config.workerTimeoutMs) throw new Error('runWorker requires config.workerTimeoutMs');

  const startMs = Date.now();
  const taskStart = nowIso();
  const bin = pickClaudeBin(env);
  const args = buildArgs(task);

  // M42 D1 — allocate a spawn-id and open the transcript registry entry
  const parentSpawnId = (opts && opts.parentSpawnId) || env.GSD_T_SPAWN_ID || null;
  const spawnId = (opts && opts.spawnId) || transcriptTee.allocateSpawnId({ parentId: parentSpawnId });
  let transcriptOpened = false;
  try {
    transcriptTee.openTranscript({
      spawnId,
      projectDir: config.projectDir,
      meta: {
        parentId: parentSpawnId,
        command: 'orchestrator-worker',
        description: `task=${task.id} domain=${task.domain || '-'} wave=${task.wave == null ? '-' : task.wave}`,
        model: (task && task.model) || 'sonnet',
      },
    });
    transcriptOpened = true;
  } catch (_) { /* tee is best-effort */ }

  emitBoundary(onFrame, task, 'start');

  return new Promise((resolve) => {
    const child = spawnImpl(bin, args, {
      cwd: config.projectDir,
      env: { ...env, GSD_T_PROJECT_DIR: config.projectDir, GSD_T_SPAWN_ID: spawnId },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const workerPid = child && typeof child.pid === 'number' ? child.pid : null;
    emitBoundary(onFrame, task, 'pid', { workerPid });
    if (transcriptOpened && workerPid != null) {
      try {
        const idx = transcriptTee._readIndex(config.projectDir);
        const i = idx.spawns.findIndex((s) => s.spawnId === spawnId);
        if (i >= 0) { idx.spawns[i].workerPid = workerPid; transcriptTee._writeIndex(config.projectDir, idx); }
      } catch (_) {}
    }
    if (typeof opts.onSpawn === 'function') {
      try { opts.onSpawn({ child, pid: workerPid, spawnId }); } catch (_) {}
    }

    let stdoutBuf = '';
    let stderrBuf = '';
    let timedOut = false;
    let killTimer = null;

    const handleLine = (line) => {
      if (transcriptOpened) {
        try { transcriptTee.appendFrame({ spawnId, projectDir: config.projectDir, frame: line }); } catch (_) {}
      }
      try {
        const frame = JSON.parse(line);
        if (typeof onFrame === 'function') onFrame(frame);
      } catch (_) {
        if (typeof onFrame === 'function') {
          onFrame({ type: 'raw', line });
        }
      }
    };

    child.stdout.on('data', (chunk) => {
      stdoutBuf += chunk.toString('utf8');
      stdoutBuf = parseLines(stdoutBuf, handleLine);
    });
    child.stderr.on('data', (chunk) => {
      stderrBuf += chunk.toString('utf8');
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      const elapsed = Date.now() - startMs;
      if (config.logger && typeof config.logger.log === 'function') {
        config.logger.log(`[worker_timeout] task=${task.id} budget=${config.workerTimeoutMs}ms elapsed=${elapsed}ms`);
      }
      try { child.kill('SIGTERM'); } catch (_) {}
      killTimer = setTimeout(() => { try { child.kill('SIGKILL'); } catch (_) {} }, 5000);
    }, config.workerTimeoutMs);

    child.on('error', (err) => {
      clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
      const durationMs = Date.now() - startMs;
      emitBoundary(onFrame, task, 'failed', { reason: 'spawn_error', error: String(err), workerPid });
      resolve({
        result: { ok: false, missing: ['spawn_error'], details: { error: String(err) } },
        exitCode: -1,
        durationMs,
        timedOut: false,
        stderr: stderrBuf,
        workerPid
      });
    });

    child.on('exit', async (code, signal) => {
      clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
      if (stdoutBuf.length) {
        stdoutBuf = parseLines(stdoutBuf + '\n', handleLine);
      }
      const durationMs = Date.now() - startMs;
      const exitCode = code == null ? (signal ? -1 : 0) : code;

      let result;
      try {
        result = assertCompletion({
          taskId: task.canonicalId || task.id,
          projectDir: config.projectDir,
          expectedBranch: task.expectedBranch || config.expectedBranch || 'main',
          taskStart,
          skipTest: !!task.skipTest,
          ownedPatterns: task.ownedPatterns || []
        });
      } catch (err) {
        result = { ok: false, missing: ['completion_check_error'], details: { error: String(err) } };
      }

      if (timedOut) {
        result = {
          ok: false,
          missing: ['worker_exited_via_timeout', ...(result.missing || [])],
          details: { ...(result.details || {}), timedOut: true, budget: config.workerTimeoutMs }
        };
      } else if (exitCode !== 0) {
        const missing = result.missing ? [...result.missing] : [];
        if (!missing.includes('worker_exit_nonzero')) missing.unshift('worker_exit_nonzero');
        result = { ok: false, missing, details: { ...(result.details || {}), exitCode, signal: signal || null, stderr: stderrBuf.slice(-2000) } };
      }

      emitBoundary(onFrame, task, result.ok ? 'done' : 'failed', { exitCode, durationMs, workerPid });
      if (transcriptOpened) {
        try { transcriptTee.closeTranscript({ spawnId, projectDir: config.projectDir, status: result.ok ? 'done' : 'failed' }); } catch (_) {}
      }
      resolve({ result, exitCode, durationMs, timedOut, stderr: stderrBuf, workerPid, spawnId });
    });

    child.stdin.on('error', () => { /* ignore — covered by child exit */ });
    child.stdin.write(brief);
    child.stdin.end();
  });
}

module.exports = {
  runWorker,
  buildArgs,
  DEFAULT_CLAUDE_BIN
};
