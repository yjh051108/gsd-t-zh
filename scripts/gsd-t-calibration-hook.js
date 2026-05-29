#!/usr/bin/env node
/**
 * gsd-t-calibration-hook.js
 *
 * SessionStart hook that records a calibration event whenever Claude Code
 * fires `source=compact` AND we can correlate the compaction with an
 * active unattended spawn.
 *
 * The output is one NDJSON row appended to
 * `<cwd>/.gsd-t/metrics/compactions.jsonl`, alongside the rows produced by
 * the v1.0.0 detector (`scripts/gsd-t-compact-detector.js`). The two hooks
 * are independent listeners on the same stdin payload and do not interact.
 *
 *   { "type": "compaction_post_spawn", "schemaVersion": 1,
 *     "ts": ..., "cw_id": ..., "task_id": ..., "spawn_id": ...,
 *     "estimatedCwPct": ..., "actualCwPct": ... }
 *
 * The pairing of `estimatedCwPct` (D6's pre-spawn prediction) with
 * `actualCwPct` (derived from the live compaction event) is what makes
 * the calibration loop actionable — D6's estimator can self-correct from
 * the delta.
 *
 * Behavior:
 * - Zero-dep. Reads stdin JSON, silently fails on any error. Always exits
 *   0 — throwing here would break Claude Code session startup.
 * - Only acts when `payload.source === "compact"`.
 * - Silently no-ops when `<cwd>/.gsd-t/.unattended/state.json` is missing,
 *   unparseable, not running, or carries no spawn correlation. The
 *   supervisor may not be running when a manual session compacts —
 *   accepted.
 * - Safe to register alongside `gsd-t-compact-detector.js`. Both fire on
 *   SessionStart, both read the same payload, both write to the same
 *   sink, and neither reads or writes the other's rows.
 *
 * Contract: .gsd-t/contracts/compaction-events-contract.md (v1.1.0)
 */
"use strict";

const fs = require("fs");
const path = require("path");

// M61 D1: model-windows retired. SAFE_DEFAULT_WINDOW was 1M (the Opus 4.7/4.8
// native window). Native /context replaces the meter that consumed this.
const SAFE_DEFAULT_WINDOW = 1_000_000;

const MAX_STDIN = 1024 * 1024; // 1 MiB
const SCHEMA_VERSION = 1;
// Input-token budget per CW = the model context window. Default to the
// model-aware safe window (1M); the old 200K literal was correct only for
// pre-4 models and skewed every actualCwPct calibration ratio 5× on
// Opus/Sonnet. Event state may still override via cwCeilingTokens (the
// economics estimator records the model-aware ceiling it actually used).
const DEFAULT_CW_CEILING_TOKENS = SAFE_DEFAULT_WINDOW;

if (require.main === module) {
  let input = "";
  let aborted = false;

  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    input += chunk;
    if (input.length > MAX_STDIN) {
      aborted = true;
      try { process.stdin.destroy(); } catch { /* noop */ }
    }
  });
  process.stdin.on("error", () => { /* silent */ });
  process.stdin.on("end", () => {
    if (aborted) { exitClean(); return; }
    try {
      handle(input);
    } catch {
      // silent — never throw from a SessionStart hook
    }
    exitClean();
  });
}

/**
 * Handle a single SessionStart payload. Pure-ish: I/O is via fs but no
 * argument is mutated. Exported for testing.
 *
 * @param {string} rawInput  raw stdin contents (UTF-8 JSON or empty)
 * @param {object} [overrides] test injection: { cwd, now }
 * @returns {object|null}    the row that was written, or null if no-op
 */
function handle(rawInput, overrides = {}) {
  let payload;
  try {
    payload = JSON.parse(rawInput);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  if (payload.source !== "compact") return null;

  const cwd = resolveCwd(payload, overrides);
  if (!cwd) return null;

  const gsdDir = path.join(cwd, ".gsd-t");
  if (!fs.existsSync(gsdDir)) return null;

  const correlation = readActiveSpawn(cwd);
  if (!correlation) return null; // silent no-op when no active spawn

  const actualCwPct = deriveActualCwPct(payload, correlation.cwCeilingTokens);
  if (actualCwPct == null) return null;

  const metricsDir = path.join(gsdDir, "metrics");
  const outPath = path.join(metricsDir, "compactions.jsonl");

  const resolvedOut = path.resolve(outPath);
  const resolvedMetrics = path.resolve(metricsDir) + path.sep;
  if (!resolvedOut.startsWith(resolvedMetrics)) return null;

  try {
    fs.mkdirSync(metricsDir, { recursive: true });
  } catch {
    return null;
  }

  const now = (overrides.now instanceof Date) ? overrides.now : new Date();
  const row = {
    type: "compaction_post_spawn",
    schemaVersion: SCHEMA_VERSION,
    ts: now.toISOString(),
    cw_id: correlation.cw_id,
    task_id: correlation.task_id,
    spawn_id: correlation.spawn_id,
    estimatedCwPct: correlation.estimatedCwPct,
    actualCwPct,
  };

  fs.appendFileSync(outPath, JSON.stringify(row) + "\n", "utf8");
  return row;
}

/**
 * Resolve a usable cwd from the payload, mirroring detector semantics:
 * absolute string → use as-is; missing/null → fall back to process.cwd();
 * any other shape → no-op (return null).
 */
function resolveCwd(payload, overrides) {
  if (overrides && typeof overrides.cwd === "string") return overrides.cwd;
  if (typeof payload.cwd === "string") {
    if (!path.isAbsolute(payload.cwd)) return null;
    return payload.cwd;
  }
  if (payload.cwd === undefined || payload.cwd === null) return process.cwd();
  return null;
}

/**
 * Read the supervisor's view of the currently-active spawn from
 * `.gsd-t/.unattended/state.json`. Returns null when:
 *   - the file is missing / unreadable / not JSON
 *   - state.status is not "running"
 *   - we cannot derive a spawn_id (no sessionId)
 *
 * The fields we expose:
 *   - cw_id   : per-CW attribution key (== spawn_id for unattended workers)
 *   - task_id : active task identifier, if the supervisor recorded one
 *   - spawn_id: stable spawn identifier (sessionId for unattended)
 *   - estimatedCwPct: D6's pre-spawn prediction (if supervisor recorded it)
 *   - cwCeilingTokens: optional override of the default ceiling
 */
function readActiveSpawn(cwd) {
  const statePath = path.join(cwd, ".gsd-t", ".unattended", "state.json");
  let raw;
  try {
    raw = fs.readFileSync(statePath, "utf8");
  } catch {
    return null;
  }
  let state;
  try {
    state = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!state || typeof state !== "object") return null;
  if (state.status !== "running") return null;

  const spawn_id =
    (typeof state.activeSpawnId === "string" && state.activeSpawnId) ||
    (typeof state.spawn_id === "string" && state.spawn_id) ||
    (typeof state.sessionId === "string" && state.sessionId) ||
    null;
  if (!spawn_id) return null;

  const cw_id =
    (typeof state.cw_id === "string" && state.cw_id) ||
    (typeof state.activeCwId === "string" && state.activeCwId) ||
    spawn_id; // unattended: one spawn = one CW

  const task_id =
    (typeof state.activeTask === "string" && state.activeTask) ||
    (typeof state.task_id === "string" && state.task_id) ||
    (typeof state.currentTask === "string" && state.currentTask) ||
    null;

  let estimatedCwPct = null;
  for (const key of ["estimatedCwPct", "estimated_cw_pct", "predictedCwPct"]) {
    if (typeof state[key] === "number" && Number.isFinite(state[key])) {
      estimatedCwPct = state[key];
      break;
    }
  }

  let cwCeilingTokens = DEFAULT_CW_CEILING_TOKENS;
  for (const key of ["cwCeilingTokens", "cw_ceiling_tokens", "cwCeiling"]) {
    if (typeof state[key] === "number" && state[key] > 0) {
      cwCeilingTokens = state[key];
      break;
    }
  }

  return { cw_id, task_id, spawn_id, estimatedCwPct, cwCeilingTokens };
}

/**
 * Derive actualCwPct (0.0–2.0) from the compaction payload. Looks at
 * `payload.input_tokens`, then falls back to nested fields used by the
 * scanner's compactMetadata shape. Returns null when nothing usable.
 */
function deriveActualCwPct(payload, cwCeilingTokens) {
  const ceiling = (typeof cwCeilingTokens === "number" && cwCeilingTokens > 0)
    ? cwCeilingTokens
    : DEFAULT_CW_CEILING_TOKENS;

  let inputTokens = null;
  if (typeof payload.input_tokens === "number" && payload.input_tokens >= 0) {
    inputTokens = payload.input_tokens;
  } else if (typeof payload.preTokens === "number" && payload.preTokens >= 0) {
    inputTokens = payload.preTokens;
  } else if (payload.compactMetadata && typeof payload.compactMetadata === "object") {
    const m = payload.compactMetadata;
    if (typeof m.preTokens === "number" && m.preTokens >= 0) {
      inputTokens = m.preTokens;
    }
  }
  if (inputTokens == null) return null;

  const pct = inputTokens / ceiling;
  // Clamp: keep within a sane band. We allow >1.0 (ceiling can be lower
  // than the actual hard limit) but cap at 2.0 to avoid runaway values.
  if (!Number.isFinite(pct) || pct < 0) return 0;
  if (pct > 2) return 2;
  return pct;
}

function exitClean() {
  try { process.stdout.write(""); } catch { /* noop */ }
  process.exit(0);
}

module.exports = {
  handle,
  // Exported for white-box testing only:
  _readActiveSpawn: readActiveSpawn,
  _deriveActualCwPct: deriveActualCwPct,
  _resolveCwd: resolveCwd,
  SCHEMA_VERSION,
  DEFAULT_CW_CEILING_TOKENS,
};
