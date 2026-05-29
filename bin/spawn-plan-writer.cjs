'use strict';

/**
 * GSD-T Spawn Plan Writer (M44 D8 T1)
 *
 * Pure module — writes a spawn-plan JSON file under `.gsd-t/spawns/{spawnId}.json`
 * at every spawn chokepoint (captureSpawn, autoSpawnHeadless, unattended-worker
 * resume Step 0). The plan file answers exactly one question:
 *
 *   "Of the tasks that were supposed to happen in this spawn, which are done,
 *    which are in flight, which are pending?"
 *
 * Hard rules (see .gsd-t/domains/m44-d8-spawn-plan-visibility/constraints.md):
 *   1. Writer DERIVES, never decides — no LLM calls, no prompts, no heuristics
 *      beyond reading partition.md + tasks.md.
 *   2. Spawn must launch even if writer fails — callers wrap in try/catch.
 *   3. Atomic writes only (temp file + rename).
 *
 * Contract: .gsd-t/contracts/spawn-plan-contract.md v1.0.0
 *
 * Zero external deps. `.cjs` so it loads in both ESM-default and CJS projects.
 */

const fs = require('fs');
const path = require('path');

const SPAWNS_SUBDIR = path.join('.gsd-t', 'spawns');
const SPAWN_PLAN_SCHEMA_VERSION = 1;

/**
 * Write a spawn-plan file at `.gsd-t/spawns/{spawnId}.json` using an atomic
 * temp-file + rename. Creates the `.gsd-t/spawns/` directory and its
 * `.gitkeep` sentinel if missing.
 *
 * If `tasks` or `domains` are not explicitly supplied, the writer tries
 * to derive them from `.gsd-t/partition.md` + `.gsd-t/domains/*\/tasks.md`
 * via the companion `spawn-plan-derive.cjs` module. When derivation fails
 * (no partition file, malformed tasks.md, ENOENT), the writer falls back to
 * `{tasks: [], note: "no-partition"}` and STILL writes the file — the
 * observability panel's job is to render whatever is present; never to block.
 *
 * @param {object} opts
 * @param {string} opts.spawnId                       filesystem-safe id
 * @param {'unattended-worker'|'headless-detached'|'in-session-subagent'|'unattended-worker-sub'} opts.kind
 * @param {string} [opts.milestone]                   e.g. 'M44'
 * @param {string} [opts.wave]                        e.g. 'wave-3'
 * @param {string[]} [opts.domains]                   domain names involved
 * @param {Array<{id: string, title: string, status?: string}>} [opts.tasks]
 *                                                    explicit task list
 *                                                    (bypasses derivation)
 * @param {string} [opts.projectDir='.']
 * @param {Date}   [opts.now]                         injection for tests
 * @returns {string}                                  absolute path written
 */
function writeSpawnPlan(opts) {
  if (!opts || typeof opts !== 'object') {
    throw new Error('writeSpawnPlan: opts is required');
  }
  const spawnId = _sanitizeSpawnId(opts.spawnId);
  if (!spawnId) {
    throw new Error('writeSpawnPlan: spawnId is required and must be filesystem-safe');
  }
  const kind = opts.kind || 'in-session-subagent';
  const projectDir = opts.projectDir || '.';
  const now = opts.now instanceof Date ? opts.now : new Date();

  const spawnsDir = path.join(projectDir, SPAWNS_SUBDIR);
  _ensureDir(spawnsDir);
  _ensureGitkeep(spawnsDir);

  // Derive or accept explicit plan slice. Explicit wins.
  let plan = _buildPlanSkeleton({ spawnId, kind, now });
  plan.milestone = opts.milestone || null;
  plan.wave = opts.wave || null;
  plan.domains = Array.isArray(opts.domains) ? opts.domains.slice() : [];
  plan.tasks = Array.isArray(opts.tasks)
    ? opts.tasks.map(_normalizeTask)
    : [];

  // Only auto-derive when caller did NOT explicitly supply tasks. A caller
  // can pass `tasks: []` to bypass derivation too.
  if (!Array.isArray(opts.tasks)) {
    try {
      const derive = require('./spawn-plan-derive.cjs');
      const derived = derive.derivePlanFromPartition({
        projectDir,
        milestone: opts.milestone,
        currentIter: opts.currentIter,
      });
      if (derived && typeof derived === 'object') {
        if (!plan.milestone && derived.milestone) plan.milestone = derived.milestone;
        if (!plan.wave && derived.wave) plan.wave = derived.wave;
        if (!plan.domains.length && Array.isArray(derived.domains)) plan.domains = derived.domains.slice();
        if (Array.isArray(derived.tasks)) plan.tasks = derived.tasks.map(_normalizeTask);
      }
    } catch (err) {
      // Derivation failures NEVER block the spawn. The plan file still
      // gets written with `{tasks: [], note: "no-partition"}` shape.
      plan.note = 'no-partition';
      try { process.stderr.write(`[spawn-plan-writer] derive failed (continuing): ${err && err.message || err}\n`); } catch (_) { /* silent */ }
    }
  }

  // Mark first incomplete task as in_progress if every predecessor is done.
  // Only one task per spawn may be in_progress at a time (see constraints §Format rules).
  _applyInProgressHint(plan.tasks);

  const targetPath = path.join(spawnsDir, spawnId + '.json');
  const absTarget = path.resolve(targetPath);
  _atomicWriteJson(absTarget, plan);
  return absTarget;
}

/**
 * Return the `.gsd-t/spawns/` directory for the given project.
 */
function spawnsDirFor(projectDir) {
  return path.join(projectDir || '.', SPAWNS_SUBDIR);
}

// ── Internal helpers ────────────────────────────────────────────────────────

function _sanitizeSpawnId(id) {
  if (id == null) return null;
  const s = String(id);
  // Filesystem-safe: alphanumerics, dash, underscore, dot. See constraints.md §Format rules.
  if (!/^[A-Za-z0-9._-]{1,200}$/.test(s)) return null;
  return s;
}

function _ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function _ensureGitkeep(dir) {
  const gk = path.join(dir, '.gitkeep');
  if (!fs.existsSync(gk)) {
    try { fs.writeFileSync(gk, ''); } catch (_) { /* best-effort */ }
  }
}

function _buildPlanSkeleton({ spawnId, kind, now }) {
  return {
    schemaVersion: SPAWN_PLAN_SCHEMA_VERSION,
    spawnId,
    kind,
    startedAt: now.toISOString(),
    endedAt: null,
    milestone: null,
    wave: null,
    domains: [],
    tasks: [],
    endedReason: null,
  };
}

function _normalizeTask(t) {
  if (!t || typeof t !== 'object') return null;
  const id = typeof t.id === 'string' ? t.id : null;
  const title = typeof t.title === 'string' ? t.title : '';
  const statusIn = typeof t.status === 'string' ? t.status : 'pending';
  const status = ['pending', 'in_progress', 'done'].includes(statusIn) ? statusIn : 'pending';
  const normalized = {
    id,
    title,
    status,
  };
  if (typeof t.commit === 'string' && t.commit) normalized.commit = t.commit;
  if (t.tokens && typeof t.tokens === 'object') {
    normalized.tokens = t.tokens;
  } else {
    normalized.tokens = null;
  }
  return normalized;
}

function _applyInProgressHint(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return;
  // Already an in_progress? Leave as-is.
  if (tasks.some((t) => t && t.status === 'in_progress')) return;
  for (const t of tasks) {
    if (!t) continue;
    if (t.status === 'pending') { t.status = 'in_progress'; return; }
    // Skip already-done; continue to next.
  }
}

function _atomicWriteJson(targetPath, obj) {
  const tmp = targetPath + '.tmp-' + process.pid + '-' + Date.now();
  const json = JSON.stringify(obj, null, 2) + '\n';
  fs.writeFileSync(tmp, json);
  fs.renameSync(tmp, targetPath);
}

module.exports = {
  writeSpawnPlan,
  spawnsDirFor,
  SPAWN_PLAN_SCHEMA_VERSION,
  // Exposed for unit-test reach-in only; not part of the public contract.
  _sanitizeSpawnId,
  _normalizeTask,
  _applyInProgressHint,
  _atomicWriteJson,
};
