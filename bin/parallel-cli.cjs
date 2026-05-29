#!/usr/bin/env node
'use strict';

/**
 * GSD-T parallel-cli substrate (M55 D2)
 *
 * N-worker pool runner. Every worker spawn flows through
 * `bin/gsd-t-token-capture.cjs::captureSpawn`. Per-worker tee log streams
 * via `bin/parallel-cli-tee.cjs`. Lifecycle / per-worker timeout / fail-fast
 * policy.
 *
 * Engine-only — does NOT touch any command file in M55.
 *
 * Contract: .gsd-t/contracts/parallel-cli-contract.md v1.0.0 STABLE.
 *
 * Hard rules:
 *   1. Zero external runtime deps. Only Node built-ins + sibling D2 helper.
 *   2. NEVER call child_process.spawn directly outside `_makeSpawnFn`.
 *   3. Every spawn flows through captureSpawn (the wrapper logs the row).
 *   4. results[] sorted by id ASC. Sort runs AFTER all workers complete.
 *   5. wallClockMs = orchestrator real time, NOT cumulative worker time.
 *   6. Fail-fast: SIGTERM in-flight, escalate SIGKILL after 5s grace.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// M61 D3: gsd-t-token-capture retired. captureSpawn was a wrapper that
// parsed result.usage and wrote a token-log row, returning
// `{ result, usage, rowWritten }`. Native /usage replaces the token-log.
// Stub preserves the RETURN SHAPE (callers read `wrapped.result`) — only the
// token-log side-effect is dropped. Returning the bare spawn result would
// make every parallel-CLI worker read `wrapped.result === undefined` and
// report ok:false regardless of real outcome (M61 post-audit CRITICAL fix).
const captureSpawn = async (opts) => {
  if (typeof opts.spawnFn === 'function') {
    return { result: await opts.spawnFn(), usage: null, rowWritten: false };
  }
  return { result: null, usage: null, rowWritten: false };
};
const { attachTee, VALID_ID_RE } = require('./parallel-cli-tee.cjs');

const SCHEMA_VERSION = '1.0.0';
const SIGKILL_GRACE_MS = 5000;

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {Array<object>} opts.workers
 * @param {number} opts.maxConcurrency
 * @param {boolean} [opts.failFast=false]
 * @param {string} [opts.teeDir]
 * @param {string} [opts.projectDir]
 * @param {string} [opts.command='parallel-cli']
 * @param {string} [opts.step='parallel']
 * @param {string} [opts.domain='-']
 * @param {string} [opts.task='-']
 * @returns {Promise<object>}  envelope per contract
 */
async function runParallel(opts) {
  _validateOpts(opts);

  const workers = opts.workers;
  const maxConcurrency = opts.maxConcurrency;
  const failFast = !!opts.failFast;
  const teeDir = opts.teeDir || null;
  const projectDir = opts.projectDir || process.cwd();
  const command = opts.command || 'parallel-cli';
  const step = opts.step || 'parallel';
  const domain = opts.domain || '-';
  const task = opts.task || '-';

  const notes = [];
  const orchestratorStart = process.hrtime.bigint();

  // Shared cancellation flag (fail-fast). Children registered for cancel.
  const inFlight = new Map(); // workerId → child handle
  const failFastTriggered = { value: false };

  // Rolling pool: walk workers in declaration order, but throttle to maxConcurrency.
  const pending = workers.slice();
  const running = [];
  const results = [];

  while (pending.length > 0 || running.length > 0) {
    // Once failFast trips, do not start any new workers — drain only.
    if (failFast && failFastTriggered.value) {
      pending.length = 0;
    }
    while (running.length < maxConcurrency && pending.length > 0) {
      const w = pending.shift();
      const p = _runOneWorker({
        worker: w,
        teeDir,
        projectDir,
        command,
        step,
        domain,
        task,
        inFlight,
        failFastTriggered,
        failFast,
      })
        .then((r) => ({ workerId: w.id, result: r }))
        .catch((err) => ({
          workerId: w.id,
          result: _errorResult(w.id, err),
        }));
      running.push(p);

      // If failFast, attach a callback to trigger cancel-siblings on first failure.
      p.then(({ result }) => {
        if (failFast && !failFastTriggered.value && result && result.ok === false && !result.cancelled) {
          failFastTriggered.value = true;
          for (const [otherId, child] of inFlight.entries()) {
            if (otherId === result.id) continue;
            _terminateChild(child);
          }
        }
      }).catch(() => { /* swallowed; result already shaped */ });
    }

    // Wait for the next worker to finish — Promise.race over current `running`.
    const settled = await Promise.race(running.map((p, idx) => p.then((v) => ({ idx, v }))));
    running.splice(settled.idx, 1);
    results.push(settled.v.result);
  }

  // Deterministic sort by id ASC, AFTER all workers complete.
  results.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  notes.sort();

  const orchestratorEnd = process.hrtime.bigint();
  const wallClockMs = Math.round(Number(orchestratorEnd - orchestratorStart) / 1e6);

  const ok = !results.some((r) => r.ok === false);

  return {
    schemaVersion: SCHEMA_VERSION,
    ok,
    wallClockMs,
    maxConcurrencyApplied: maxConcurrency,
    failFast,
    results,
    notes,
  };
}

// ── Validation ──────────────────────────────────────────────────────────────

function _validateOpts(opts) {
  if (!opts || typeof opts !== 'object') {
    throw new Error('runParallel: opts is required');
  }
  if (!Array.isArray(opts.workers) || opts.workers.length === 0) {
    throw new Error('runParallel: opts.workers must be a non-empty array');
  }
  if (!Number.isInteger(opts.maxConcurrency) || opts.maxConcurrency < 1) {
    throw new Error('runParallel: opts.maxConcurrency must be a positive integer');
  }
  const seen = new Set();
  for (const w of opts.workers) {
    if (!w || typeof w !== 'object') {
      throw new Error('runParallel: every worker must be an object');
    }
    if (typeof w.id !== 'string' || w.id === '') {
      throw new Error('runParallel: worker.id is required and must be a non-empty string');
    }
    if (!VALID_ID_RE.test(w.id)) {
      throw new Error('runParallel: worker.id contains illegal characters: ' + w.id);
    }
    if (seen.has(w.id)) {
      throw new Error('runParallel: duplicate worker.id: ' + w.id);
    }
    seen.add(w.id);
    if (typeof w.cmd !== 'string' || w.cmd === '') {
      throw new Error('runParallel: worker.cmd is required (worker ' + w.id + ')');
    }
    if (!Array.isArray(w.args)) {
      throw new Error('runParallel: worker.args must be an array (worker ' + w.id + ')');
    }
    if (w.timeoutMs != null && (!Number.isFinite(w.timeoutMs) || w.timeoutMs <= 0)) {
      throw new Error('runParallel: worker.timeoutMs must be a positive finite number or null (worker ' + w.id + ')');
    }
  }
}

// ── Per-worker run ──────────────────────────────────────────────────────────

async function _runOneWorker(ctx) {
  const w = ctx.worker;
  const startNs = process.hrtime.bigint();

  // captureSpawn-wrapped. spawnFn wires the actual child_process.spawn.
  const wrapped = await captureSpawn({
    command: ctx.command,
    step: ctx.step,
    model: w.model || 'cli',
    description: w.description || w.id,
    projectDir: ctx.projectDir,
    domain: ctx.domain,
    task: ctx.task,
    spawnFn: () => _makeSpawnFn({
      worker: w,
      teeDir: ctx.teeDir,
      projectDir: ctx.projectDir,
      inFlight: ctx.inFlight,
      failFastTriggered: ctx.failFastTriggered,
    })(),
    notes: 'parallel-cli worker',
  });

  const endNs = process.hrtime.bigint();
  const durationMs = Math.round(Number(endNs - startNs) / 1e6);

  // captureSpawn returns { result, usage, rowWritten }; we tunneled our
  // structured result through `result`.
  const r = wrapped.result || {};
  return {
    id: w.id,
    ok: r.exitCode === 0 && !r.cancelled && !r.timedOut && r.signal == null,
    exitCode: typeof r.exitCode === 'number' ? r.exitCode : null,
    signal: r.signal || null,
    durationMs,
    stdoutPath: r.stdoutPath || null,
    stderrPath: r.stderrPath || null,
    stdoutBytes: typeof r.stdoutBytes === 'number' ? r.stdoutBytes : 0,
    stderrBytes: typeof r.stderrBytes === 'number' ? r.stderrBytes : 0,
    stdoutTruncatedToTemp: !!r.stdoutTruncatedToTemp,
    stderrTruncatedToTemp: !!r.stderrTruncatedToTemp,
    timedOut: !!r.timedOut,
    cancelled: !!r.cancelled,
  };
}

function _errorResult(id, err) {
  return {
    id,
    ok: false,
    exitCode: null,
    signal: null,
    durationMs: 0,
    stdoutPath: null,
    stderrPath: null,
    stdoutBytes: 0,
    stderrBytes: 0,
    stdoutTruncatedToTemp: false,
    stderrTruncatedToTemp: false,
    timedOut: false,
    cancelled: false,
    error: err && err.message ? err.message : String(err),
  };
}

// ── Spawn factory ───────────────────────────────────────────────────────────

function _makeSpawnFn(ctx) {
  const w = ctx.worker;
  return function spawnAndWait() {
    return new Promise((resolve) => {
      const child = spawn(w.cmd, w.args || [], {
        cwd: w.cwd || ctx.projectDir,
        env: { ...process.env, ...(w.env || {}) },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
      });

      const tee = attachTee(child, { workerId: w.id, teeDir: ctx.teeDir });

      let timedOut = false;
      let cancelled = false;
      let timeoutTimer = null;
      let killTimer = null;

      // Attach cancel hook BEFORE inFlight registration so the orchestrator
      // never observes a child without its hook.
      child.__pcli_cancel = () => {
        if (cancelled) return;
        cancelled = true;
        _killChild(child, killTimer);
      };
      ctx.inFlight.set(w.id, child);

      if (Number.isFinite(w.timeoutMs) && w.timeoutMs > 0) {
        timeoutTimer = setTimeout(() => {
          timedOut = true;
          cancelled = true;
          _killChild(child, killTimer);
        }, w.timeoutMs);
      }

      child.on('close', async (code, signal) => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (killTimer) clearTimeout(killTimer);
        ctx.inFlight.delete(w.id);
        await tee.close();
        // captureSpawn does not consume `usage` from this object (no `usage`
        // field present), so the token-log row will render `—`.
        resolve({
          exitCode: typeof code === 'number' ? code : null,
          signal: signal || null,
          stdoutPath: tee.stdoutPath,
          stderrPath: tee.stderrPath,
          stdoutBytes: tee.stdoutBytes(),
          stderrBytes: tee.stderrBytes(),
          stdoutTruncatedToTemp: tee.stdoutTruncatedToTemp(),
          stderrTruncatedToTemp: tee.stderrTruncatedToTemp(),
          timedOut,
          cancelled,
        });
      });

      child.on('error', async (err) => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (killTimer) clearTimeout(killTimer);
        ctx.inFlight.delete(w.id);
        await tee.close();
        resolve({
          exitCode: null,
          signal: null,
          stdoutPath: tee.stdoutPath,
          stderrPath: tee.stderrPath,
          stdoutBytes: tee.stdoutBytes(),
          stderrBytes: tee.stderrBytes(),
          stdoutTruncatedToTemp: tee.stdoutTruncatedToTemp(),
          stderrTruncatedToTemp: tee.stderrTruncatedToTemp(),
          timedOut,
          cancelled,
          error: err && err.message ? err.message : String(err),
        });
      });
    });
  };
}

function _killChild(child, killTimer) {
  if (!child) return;
  try { child.kill('SIGTERM'); } catch (_) { /* may be dead already */ }
  if (!killTimer) {
    setTimeout(() => {
      try { child.kill('SIGKILL'); } catch (_) { /* may be dead already */ }
    }, SIGKILL_GRACE_MS).unref?.();
  }
}

function _terminateChild(child) {
  if (!child || typeof child.__pcli_cancel !== 'function') return;
  child.__pcli_cancel();
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function _parseCliArgs(argv) {
  const out = {
    plan: null,
    maxConcurrency: null,
    failFast: false,
    teeDir: null,
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--plan') out.plan = argv[++i];
    else if (a === '--max-concurrency') out.maxConcurrency = parseInt(argv[++i], 10);
    else if (a === '--fail-fast') out.failFast = true;
    else if (a === '--tee-dir') out.teeDir = argv[++i];
    else if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error('unknown flag: ' + a);
  }
  return out;
}

function _readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { data += c; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

async function _cliMain(argv) {
  let parsed;
  try {
    parsed = _parseCliArgs(argv);
  } catch (e) {
    process.stderr.write('parallel-cli: ' + e.message + '\n');
    process.exit(2);
  }

  if (parsed.help) {
    process.stdout.write([
      'Usage: node bin/parallel-cli.cjs --max-concurrency N [--plan FILE] [--fail-fast] [--tee-dir DIR] [--json]',
      '',
      'Reads worker plan from --plan FILE or stdin. Plan shape:',
      '  { "workers": [ { "id": "lint", "cmd": "npx", "args": ["biome","check"] }, ... ] }',
      '',
    ].join('\n'));
    process.exit(0);
  }

  if (!Number.isInteger(parsed.maxConcurrency) || parsed.maxConcurrency < 1) {
    process.stderr.write('parallel-cli: --max-concurrency is required (positive integer)\n');
    process.exit(2);
  }

  let planText;
  try {
    if (parsed.plan) {
      planText = fs.readFileSync(parsed.plan, 'utf8');
    } else {
      planText = await _readStdin();
    }
  } catch (e) {
    process.stderr.write('parallel-cli: cannot read plan: ' + e.message + '\n');
    process.exit(2);
  }

  let plan;
  try {
    plan = JSON.parse(planText);
  } catch (e) {
    process.stderr.write('parallel-cli: plan JSON parse error: ' + e.message + '\n');
    process.exit(2);
  }
  if (!plan || !Array.isArray(plan.workers)) {
    process.stderr.write('parallel-cli: plan.workers must be an array\n');
    process.exit(2);
  }

  let envelope;
  try {
    envelope = await runParallel({
      workers: plan.workers,
      maxConcurrency: parsed.maxConcurrency,
      failFast: parsed.failFast,
      teeDir: parsed.teeDir,
      command: 'parallel-cli',
      step: 'cli',
    });
  } catch (e) {
    process.stderr.write('parallel-cli: runtime error: ' + (e && e.stack || e) + '\n');
    process.exit(3);
  }

  if (parsed.json) {
    process.stdout.write(JSON.stringify(envelope, null, 2) + '\n');
  } else {
    process.stdout.write(_renderText(envelope));
  }
  process.exit(envelope.ok ? 0 : 1);
}

function _renderText(envelope) {
  const lines = [];
  lines.push('parallel-cli: ' + (envelope.ok ? 'OK' : 'FAIL') +
             '  (workers=' + envelope.results.length +
             ', maxConcurrency=' + envelope.maxConcurrencyApplied +
             ', wallClockMs=' + envelope.wallClockMs + ')');
  for (const r of envelope.results) {
    const tag = r.ok ? '✓' : '✗';
    lines.push('  ' + tag + ' ' + r.id +
               ' exit=' + r.exitCode +
               ' sig=' + r.signal +
               ' ' + r.durationMs + 'ms' +
               (r.timedOut ? ' [TIMEOUT]' : '') +
               (r.cancelled ? ' [CANCELLED]' : ''));
  }
  return lines.join('\n') + '\n';
}

if (require.main === module) {
  _cliMain(process.argv.slice(2)).catch((e) => {
    process.stderr.write('parallel-cli: unhandled: ' + (e && e.stack || e) + '\n');
    process.exit(3);
  });
}

module.exports = {
  runParallel,
  SCHEMA_VERSION,
  SIGKILL_GRACE_MS,
  // exposed for tests
  _validateOpts,
  _renderText,
};
