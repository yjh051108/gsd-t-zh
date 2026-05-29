'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULTS = Object.freeze({
  maxParallel: 3,
  workerTimeoutMs: 270000,
  retryOnFail: true,
  haltOnSecondFail: true
});

const MAX_PARALLEL_CEILING = 15;
const WORKER_RAM_BUDGET_BYTES = 2 * 1024 * 1024 * 1024;
const ADAPTIVE_FLOOR = 3;

// ─── M44 D2 — mode-aware gating math ──────────────────────────────────────
// Contract: `.gsd-t/contracts/wave-join-contract.md` v1.1.0 §Mode-Aware Gating Math.

const IN_SESSION_CW_CEILING_PCT = 85;
const UNATTENDED_PER_WORKER_CW_PCT = 60;
const DEFAULT_SUMMARY_SIZE_PCT = 4;

/**
 * [in-session] headroom gate.
 *
 * Returns `{ok, reducedCount}`.
 *   ok=true iff `ctxPct + workerCount * summarySize ≤ IN_SESSION_CW_CEILING_PCT`.
 *   Otherwise reduces N repeatedly; final floor is N=1. NEVER refuses
 *   (constraints.md: never throw a pause/resume prompt under any condition).
 *
 *   - reducedCount = the largest N ≤ requested workerCount such that the
 *     headroom inequality holds. If the inequality fails for every N ≥ 1
 *     (e.g. ctxPct already > ceiling), returns { ok: true, reducedCount: 1 }
 *     — sequential always remains feasible because the 4% summary is only
 *     spent *post*-worker, and one worker is the irreducible floor.
 */
function computeInSessionHeadroom(opts) {
  const o = opts || {};
  const ctxPct = Number.isFinite(o.ctxPct) ? o.ctxPct : 0;
  const requested = Number.isFinite(o.workerCount) ? Math.max(0, Math.floor(o.workerCount)) : 0;
  const summarySize = Number.isFinite(o.summarySize) ? o.summarySize : DEFAULT_SUMMARY_SIZE_PCT;
  const ceiling = IN_SESSION_CW_CEILING_PCT;

  // Direct fit.
  if (ctxPct + requested * summarySize <= ceiling) {
    return { ok: true, reducedCount: requested };
  }
  // Reduce N until it fits or we hit the floor.
  let n = requested - 1;
  while (n > 1) {
    if (ctxPct + n * summarySize <= ceiling) {
      return { ok: true, reducedCount: n };
    }
    n -= 1;
  }
  // Floor: 1 worker (sequential). Never refuses.
  return { ok: true, reducedCount: 1 };
}

/**
 * [unattended] per-worker CW gate.
 *
 * Returns `{ok, split}`.
 *   ok=true, split=false if `estimatedCwPct ≤ threshold` (default 60).
 *   ok=false, split=true otherwise — caller MUST slice the task into
 *   multiple `claude -p` iters (actual splitting is scheduled by the
 *   caller; this function only signals the split requirement).
 */
function computeUnattendedGate(opts) {
  const o = opts || {};
  const estimatedCwPct = Number.isFinite(o.estimatedCwPct) ? o.estimatedCwPct : 0;
  const threshold = Number.isFinite(o.threshold) ? o.threshold : UNATTENDED_PER_WORKER_CW_PCT;
  if (estimatedCwPct > threshold) {
    return { ok: false, split: true };
  }
  return { ok: true, split: false };
}

function computeAdaptiveMaxParallel(freeBytes) {
  const free = typeof freeBytes === 'number' ? freeBytes : os.freemem();
  if (!Number.isFinite(free) || free <= 0) return ADAPTIVE_FLOOR;
  const byMemory = Math.floor(free / WORKER_RAM_BUDGET_BYTES);
  const clamped = Math.max(ADAPTIVE_FLOOR, Math.min(MAX_PARALLEL_CEILING, byMemory));
  return clamped;
}

function loadConfigFile(projectDir) {
  const p = path.join(projectDir, '.gsd-t', 'orchestrator.config.json');
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    throw new Error(`orchestrator.config.json parse error: ${err.message}`);
  }
}

function parseIntStrict(v, name) {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  if (typeof v === 'string' && /^\d+$/.test(v)) return parseInt(v, 10);
  throw new Error(`${name} must be a non-negative integer, got ${JSON.stringify(v)}`);
}

function loadConfig(opts) {
  const { projectDir, cliFlags = {}, env = process.env, freeMemBytes } = opts || {};
  if (!projectDir) throw new Error('loadConfig requires projectDir');

  const fileCfg = loadConfigFile(projectDir);
  const fileSetMaxParallel = Object.prototype.hasOwnProperty.call(fileCfg, 'maxParallel');
  const merged = { ...DEFAULTS, ...fileCfg };
  let maxParallelSource = fileSetMaxParallel ? 'config-file' : 'adaptive';
  if (!fileSetMaxParallel) {
    merged.maxParallel = computeAdaptiveMaxParallel(freeMemBytes);
  }

  if (cliFlags.maxParallel != null) {
    merged.maxParallel = parseIntStrict(cliFlags.maxParallel, '--max-parallel');
    maxParallelSource = 'cli';
  }
  if (cliFlags.workerTimeoutMs != null) merged.workerTimeoutMs = parseIntStrict(cliFlags.workerTimeoutMs, '--worker-timeout');
  if (cliFlags.retryOnFail != null) merged.retryOnFail = !!cliFlags.retryOnFail;
  if (cliFlags.haltOnSecondFail != null) merged.haltOnSecondFail = !!cliFlags.haltOnSecondFail;

  if (env.GSD_T_MAX_PARALLEL != null && env.GSD_T_MAX_PARALLEL !== '') {
    merged.maxParallel = parseIntStrict(env.GSD_T_MAX_PARALLEL, 'GSD_T_MAX_PARALLEL');
    maxParallelSource = 'env';
  }
  if (env.GSD_T_WORKER_TIMEOUT_MS != null && env.GSD_T_WORKER_TIMEOUT_MS !== '') {
    merged.workerTimeoutMs = parseIntStrict(env.GSD_T_WORKER_TIMEOUT_MS, 'GSD_T_WORKER_TIMEOUT_MS');
  }

  if (merged.maxParallel < 1) {
    throw new Error(`maxParallel must be >= 1, got ${merged.maxParallel}`);
  }
  if (merged.maxParallel > MAX_PARALLEL_CEILING) {
    throw new Error(`maxParallel ${merged.maxParallel} exceeds Team Mode §15 ceiling (${MAX_PARALLEL_CEILING})`);
  }
  if (merged.workerTimeoutMs < 1000) {
    throw new Error(`workerTimeoutMs must be >= 1000, got ${merged.workerTimeoutMs}`);
  }

  merged.projectDir = projectDir;
  merged.maxParallelSource = maxParallelSource;
  return merged;
}

module.exports = {
  loadConfig,
  DEFAULTS,
  MAX_PARALLEL_CEILING,
  computeAdaptiveMaxParallel,
  WORKER_RAM_BUDGET_BYTES,
  ADAPTIVE_FLOOR,
  // M44 D2 — mode-aware gating math
  computeInSessionHeadroom,
  computeUnattendedGate,
  IN_SESSION_CW_CEILING_PCT,
  UNATTENDED_PER_WORKER_CW_PCT,
  DEFAULT_SUMMARY_SIZE_PCT,
};
