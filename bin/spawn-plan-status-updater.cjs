'use strict';

/**
 * GSD-T Spawn Plan Status Updater (M44 D8 T2)
 *
 * Pure module — patches spawn-plan files written by spawn-plan-writer.cjs.
 * Called by the post-commit git hook and by `captureSpawn` on completion.
 *
 * Contract: .gsd-t/contracts/spawn-plan-contract.md v1.0.0
 *
 * Hard rules:
 *   - Atomic rewrites only (temp file + rename)
 *   - No-op on unknown spawnId or unknown taskId — observability is best-effort
 *   - Never throw for missing files; callers rely on silent-fail behavior
 */

const fs = require('fs');
const path = require('path');

const SPAWNS_SUBDIR = path.join('.gsd-t', 'spawns');

/**
 * Patch `{spawnId}.json`: find the task with the given id and flip its
 * status to `done`, recording the commit SHA and (optional) token
 * attribution. If the next pending task exists, promote it to
 * `in_progress` so the single-active-task invariant is preserved.
 *
 * @param {object} opts
 * @param {string} opts.spawnId
 * @param {string} opts.taskId
 * @param {string} [opts.commit]                         short or full SHA
 * @param {object|null} [opts.tokens]                    `{in,out,cr,cc,cost_usd}` or null
 * @param {string} [opts.projectDir='.']
 * @returns {{ patched: boolean, path: string }}
 */
function markTaskDone(opts) {
  if (!opts || typeof opts !== 'object') return { patched: false, path: null };
  const { spawnId, taskId } = opts;
  if (!spawnId || !taskId) return { patched: false, path: null };

  const projectDir = opts.projectDir || '.';
  const fp = _planPath(projectDir, spawnId);
  const plan = _readPlan(fp);
  if (!plan) return { patched: false, path: fp };

  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  const idx = tasks.findIndex((t) => t && t.id === taskId);
  if (idx < 0) return { patched: false, path: fp };

  const task = tasks[idx];
  task.status = 'done';
  if (typeof opts.commit === 'string' && opts.commit) task.commit = opts.commit;
  // Token attribution is "null when absent" per constraints §Format rules.
  // The caller passes `null` or an object; we never silently overwrite
  // an already-populated tokens field with null.
  if (Object.prototype.hasOwnProperty.call(opts, 'tokens')) {
    if (opts.tokens && typeof opts.tokens === 'object') {
      task.tokens = _normalizeTokens(opts.tokens);
    } else if (task.tokens == null) {
      task.tokens = null;
    }
  }

  // Promote the next pending task to in_progress (single-active invariant).
  const anyInProgress = tasks.some((t) => t && t.status === 'in_progress');
  if (!anyInProgress) {
    for (let j = idx + 1; j < tasks.length; j++) {
      if (tasks[j] && tasks[j].status === 'pending') {
        tasks[j].status = 'in_progress';
        break;
      }
    }
  }

  _atomicWriteJson(fp, plan);
  return { patched: true, path: fp };
}

/**
 * Mark a spawn plan as ended. Sets `endedAt` to now-ISO and records
 * `endedReason` ('success' | 'error' | caller-supplied). No-op on missing
 * file. Atomic rewrite.
 *
 * @param {object} opts
 * @param {string} opts.spawnId
 * @param {string} [opts.endedReason='success']
 * @param {string} [opts.projectDir='.']
 * @param {Date}   [opts.now]
 * @returns {{ patched: boolean, path: string }}
 */
function markSpawnEnded(opts) {
  if (!opts || typeof opts !== 'object') return { patched: false, path: null };
  const { spawnId } = opts;
  if (!spawnId) return { patched: false, path: null };

  const projectDir = opts.projectDir || '.';
  const fp = _planPath(projectDir, spawnId);
  const plan = _readPlan(fp);
  if (!plan) return { patched: false, path: fp };

  const now = opts.now instanceof Date ? opts.now : new Date();
  plan.endedAt = now.toISOString();
  plan.endedReason = opts.endedReason || 'success';
  _atomicWriteJson(fp, plan);
  return { patched: true, path: fp };
}

/**
 * Enumerate active plan files (those where `endedAt === null`). Returns
 * absolute file paths, sorted by startedAt descending.
 *
 * @param {string} [projectDir='.']
 * @returns {string[]}
 */
function listActivePlans(projectDir) {
  const dir = path.join(projectDir || '.', SPAWNS_SUBDIR);
  if (!fs.existsSync(dir)) return [];
  let files;
  try { files = fs.readdirSync(dir); } catch (_) { return []; }
  const results = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const fp = path.resolve(path.join(dir, f));
    const plan = _readPlan(fp);
    if (plan && plan.endedAt == null) results.push({ fp, plan });
  }
  results.sort((a, b) => {
    const ta = Date.parse(a.plan && a.plan.startedAt || '') || 0;
    const tb = Date.parse(b.plan && b.plan.startedAt || '') || 0;
    return tb - ta;
  });
  return results.map((r) => r.fp);
}

// ── token-log attribution lookup ───────────────────────────────────────────

/**
 * Parse `.gsd-t/token-log.md` and return the sum of `{in,out,cr,cc,cost_usd}`
 * across all rows whose `Task` column matches the given id and whose
 * `Datetime-start` is >= the spawn's startedAt.
 *
 * Returns `null` when no matching rows exist (per the "zero is a
 * measurement, dash is acknowledged gap" rule).
 *
 * @param {object} opts
 * @param {string} opts.projectDir
 * @param {string} opts.taskId
 * @param {string} opts.spawnStartedAt   ISO-8601 (matches plan.startedAt)
 * @param {string} [opts.tokenLogPath]   override for tests
 * @returns {{in:number, out:number, cr:number, cc:number, cost_usd:number}|null}
 */
function sumTokensForTask(opts) {
  if (!opts || typeof opts !== 'object') return null;
  const { projectDir, taskId } = opts;
  if (!projectDir || !taskId) return null;

  const fp = opts.tokenLogPath || path.join(projectDir, '.gsd-t', 'token-log.md');
  if (!fs.existsSync(fp)) return null;

  const startMs = _parseDatetime(opts.spawnStartedAt);

  let text;
  try { text = fs.readFileSync(fp, 'utf8'); } catch (_) { return null; }

  const lines = text.split('\n');
  // Find header row to locate column indices.
  const headerIdx = lines.findIndex((l) => /^\|\s*Datetime-start\s*\|/.test(l));
  if (headerIdx < 0) return null;
  const header = lines[headerIdx].split('|').map((s) => s.trim());
  const iStart = header.indexOf('Datetime-start');
  const iTokens = header.indexOf('Tokens');
  const iTask = header.indexOf('Task');
  if (iStart < 0 || iTask < 0) return null;

  const sum = { in: 0, out: 0, cr: 0, cc: 0, cost_usd: 0 };
  let matched = 0;
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const row = lines[i];
    if (!row || !row.startsWith('|')) continue;
    const cells = row.split('|').map((s) => s.trim());
    if (cells.length < header.length) continue;
    const startedAt = cells[iStart] || '';
    const task = cells[iTask] || '';
    if (task !== taskId) continue;
    // Only rows whose Datetime-start >= spawn.startedAt count.
    if (startMs != null) {
      const rowMs = _parseDatetime(startedAt);
      if (rowMs != null && rowMs < startMs) continue;
    }
    const tokensCell = iTokens >= 0 ? (cells[iTokens] || '') : '';
    const parsed = _parseTokensCell(tokensCell);
    if (parsed) {
      sum.in += parsed.in;
      sum.out += parsed.out;
      sum.cr += parsed.cr;
      sum.cc += parsed.cc;
      sum.cost_usd += parsed.cost_usd;
      matched++;
    } else {
      // No token data in the row; still counts as a "match" for the task
      // but contributes zero. Keep going.
      matched++;
    }
  }
  if (matched === 0) return null;
  // Round cost to 2 decimals for determinism.
  sum.cost_usd = Math.round(sum.cost_usd * 100) / 100;
  return sum;
}

// ── internal helpers ───────────────────────────────────────────────────────

function _planPath(projectDir, spawnId) {
  return path.resolve(path.join(projectDir, SPAWNS_SUBDIR, spawnId + '.json'));
}

function _readPlan(fp) {
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function _atomicWriteJson(targetPath, obj) {
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = targetPath + '.tmp-' + process.pid + '-' + Date.now();
  const json = JSON.stringify(obj, null, 2) + '\n';
  fs.writeFileSync(tmp, json);
  fs.renameSync(tmp, targetPath);
}

function _normalizeTokens(t) {
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
  return {
    in: num(t.in != null ? t.in : t.input_tokens),
    out: num(t.out != null ? t.out : t.output_tokens),
    cr: num(t.cr != null ? t.cr : t.cache_read_input_tokens),
    cc: num(t.cc != null ? t.cc : t.cache_creation_input_tokens),
    cost_usd: num(
      t.cost_usd != null
        ? t.cost_usd
        : (t.total_cost_usd != null ? t.total_cost_usd : 0)
    ),
  };
}

function _parseDatetime(s) {
  if (!s) return null;
  if (typeof s === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) {
    const [d, t] = s.split(' ');
    const ms = Date.parse(`${d}T${t}:00`);
    return Number.isFinite(ms) ? ms : null;
  }
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Parse a tokens cell of the form `in=N out=N cr=N cc=N $X.XX` or `—`
 * or a mixed form. Returns null when no numeric data is present.
 */
function _parseTokensCell(cell) {
  if (!cell || cell === '—' || cell === '-') return null;
  const num = (re) => {
    const m = cell.match(re);
    return m ? Number(m[1]) : 0;
  };
  const inp = num(/\bin=(\d+)/);
  const out = num(/\bout=(\d+)/);
  const cr = num(/\bcr=(\d+)/);
  const cc = num(/\bcc=(\d+)/);
  const costM = cell.match(/\$(\d+(?:\.\d+)?)/);
  const cost_usd = costM ? Number(costM[1]) : 0;
  if (!inp && !out && !cr && !cc && !cost_usd) return null;
  return { in: inp, out, cr, cc, cost_usd };
}

module.exports = {
  markTaskDone,
  markSpawnEnded,
  listActivePlans,
  sumTokensForTask,
  // test-only
  _parseTokensCell,
  _parseDatetime,
  _normalizeTokens,
};
