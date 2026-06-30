#!/usr/bin/env node
/**
 * gsd-t-read-intercept.js — M98/M99
 *
 * A PostToolUse hook on the `Read` tool. When Claude reads an INDEXED code file
 * with an offset+limit that lands inside exactly one known function's line range,
 * this APPENDS a graph note pointing at the precise `graph body <funcId>` slice
 * (which carries the imports + class header + callers + the ~43× token win).
 *
 * DEFAULT = PASS-THROUGH. A bare `Read(file)` with no structural signal, a non-code
 * file, an unindexed file, or any error → the original full-file output reaches the
 * model UNCHANGED. This hook only ever AUGMENTS (appends a note); it NEVER replaces
 * or shrinks a file read — silently shrinking would break editing. (M98 Decision #4
 * + the open-question resolved conservatively: option (c), no-regression.)
 *
 * Receives JSON on stdin (PostToolUse):
 *   { tool_name, tool_input: { file_path, offset?, limit? }, tool_response/tool_output, cwd, ... }
 *
 * Emits JSON on stdout:
 *   { hookSpecificOutput: { hookEventName: "PostToolUse",
 *       updatedToolOutput: "<original file output> + graph note" } }
 *   ...or nothing (exit 0) to pass the Read through unchanged.
 *
 * M99 D2:
 *   - Presence check and Database open use D1's resolver (resolveStorePath) — never re-derive path.
 *   - Layer-2b logging: one line per augment/passthrough decision via append_ledger_line.
 *     Consumer resolved from GSDT_GRAPH_CONSUMER env or payload hook_data.consumer or 'cli'.
 *     Fail-open: a throwing sink never alters the decision or the output.
 *
 * INVARIANTS:
 *   [RULE] read-intercept-fail-open             — any error / missing graph / non-code → pass through
 *   [RULE] read-intercept-augment-never-shrink  — only APPEND; never replace the file body
 *   [RULE] read-intercept-structural-only       — augment ONLY when offset+limit ∈ one funcId range
 *   [RULE] presence-check-repointed             — M99: presence + DB open via resolver, never literal
 *   [RULE] byte-identical-on-off                — logging is a side-channel; decision unchanged
 *   [RULE] fail-open                            — sink error never propagates
 *   [RULE] import-resolver-never-hardcode       — import resolver, never re-derive path
 *   [RULE] augment-never-shrink-kept            — M98 augment-never-shrink rule KEPT
 *   [RULE] consumer-label-from-context-not-setenv
 *   - NEVER calls Read/Grep (loop guard). Reads the graph DB directly (read-only).
 *   - No graph in this project → pure no-op.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const OUTPUT_CAP = 9000; // stay under the 10K hook output cap

// Code extensions the graph indexes — only these are candidates for a slice note.
const CODE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.rs',
]);

function passThrough() {
  // Emit nothing → the original Read output reaches the model unchanged.
  process.exit(0);
}

// Append `note` beneath `original`, but NEVER shrink the original the model already
// has. [RULE] read-intercept-augment-never-shrink: if original + note would exceed
// the hook output cap, pass through (emit nothing) — the note is advisory; a full
// file read is not worth truncating to fit a pointer.
function emitAugment(original, note) {
  const combined = original + note;
  if (combined.length > OUTPUT_CAP) passThrough();
  const out = {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      updatedToolOutput: combined,
    },
  };
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

// M99 D2: load D1's resolver module.
// [RULE] import-resolver-never-hardcode / [RULE] presence-check-repointed
function loadResolver(cwd) {
  try {
    const pkgLocal = path.join(__dirname, '..', 'bin', 'gsd-t-graph-store-resolver.cjs');
    const projLocal = path.join(cwd, 'bin', 'gsd-t-graph-store-resolver.cjs');
    const resolverPath = fs.existsSync(pkgLocal) ? pkgLocal
      : fs.existsSync(projLocal) ? projLocal
      : null;
    if (!resolverPath) return null;
    return require(resolverPath);
  } catch { return null; }
}

// M99 D2: resolve consumer label from env or payload.
// [RULE] consumer-label-from-context-not-setenv
function resolveConsumer(payload) {
  if (process.env.GSDT_GRAPH_CONSUMER) return process.env.GSDT_GRAPH_CONSUMER;
  if (payload && payload.hook_data && typeof payload.hook_data.consumer === 'string') {
    return payload.hook_data.consumer;
  }
  return 'cli';
}

// M99 D2: emit one Layer-2b ledger line. Fail-open — never alters the decision.
// [RULE] fail-open  [RULE] byte-identical-on-off
function logDecision(appendFn, cwd, consumer, action, filePath) {
  if (!appendFn) return;
  try {
    appendFn({
      kind: 'read',
      ts: new Date().toISOString(),
      action,
      file: String(filePath).slice(0, 500),
      consumer,
    }, cwd);
  } catch { /* FAIL-OPEN: sink error never propagates */ }
}

function main(payload) {
  // Only act on Read.
  if (!payload || payload.tool_name !== 'Read') passThrough();

  const cwd = payload.cwd || process.cwd();

  // Must be a GSD-T project.
  if (!fs.existsSync(path.join(cwd, '.gsd-t'))) passThrough();

  // M99 D2: resolve consumer and logging sink early (used in ALL decision branches).
  const consumer = resolveConsumer(payload);
  const resolver = loadResolver(cwd);
  const appendFn = resolver && typeof resolver.append_ledger_line === 'function'
    ? resolver.append_ledger_line : null;

  // M99 D2: repoint presence check at D1's resolver. [RULE] presence-check-repointed
  const storePath = resolver ? resolver.resolveStorePath(cwd) : null;
  if (!storePath || !fs.existsSync(storePath)) passThrough();

  const input = payload.tool_input || {};
  const filePath = input.file_path;
  if (typeof filePath !== 'string' || !filePath) passThrough();

  // Only code files. (Non-code / docs / config → pass through, AC-6.)
  if (!CODE_EXTS.has(path.extname(filePath).toLowerCase())) passThrough();

  // STRUCTURAL SIGNAL (conservative): the read must carry an offset+limit. A bare
  // full-file read has no structural target → pass through (no silent shrinking).
  const offset = Number(input.offset);
  const limit = Number(input.limit);
  if (!Number.isFinite(offset) || !Number.isFinite(limit) || limit <= 0) {
    // Log passthrough for reads with a code file but no structural signal.
    logDecision(appendFn, cwd, consumer, 'passthrough', filePath);
    passThrough();
  }
  const readStart = offset;          // 1-based first line read (Read's offset is 1-based)
  const readEnd = offset + limit - 1;

  // Relativize the file path against cwd so it matches stored funcIds (file#name@line).
  let rel = filePath;
  if (path.isAbsolute(filePath)) rel = path.relative(cwd, filePath);
  rel = rel.split(path.sep).join('/');

  // Find the function whose [start,end] range the read window lands inside.
  let match = null;
  try {
    // M99 D2: open the DB via the resolver-provided store path.
    // [RULE] presence-check-repointed — storePath comes from D1's resolver, not a literal.
    let requireStore;
    try { requireStore = require(path.join(__dirname, '..', 'bin', 'gsd-t-require-store.cjs')); }
    catch { requireStore = require(path.join(cwd, 'bin', 'gsd-t-require-store.cjs')); }
    const Database = requireStore.requireBetterSqlite();
    // Use the resolver-provided storePath (M99 D2 repoint).
    const db = new Database(storePath, { readonly: true });
    try {
      const hasEnd = db.prepare('PRAGMA table_info(nodes)').all().some((c) => c.name === 'end_line');
      if (hasEnd) {
        const rows = db.prepare(
          'SELECT func_id, name, end_line FROM nodes WHERE file = ? AND func_id IS NOT NULL AND end_line IS NOT NULL'
        ).all(rel);
        for (const r of rows) {
          const m = /@(\d+)$/.exec(r.func_id);
          if (!m) continue;
          const start = parseInt(m[1], 10);
          const end = r.end_line;
          if (readStart >= start && readStart <= end) {
            if (!match || start > match.start) match = { funcId: r.func_id, name: r.name, start, end };
          }
        }
      }
    } finally {
      try { db.close(); } catch { /* best-effort */ }
    }
  } catch (_e) {
    logDecision(appendFn, cwd, consumer, 'passthrough', rel);
    passThrough();
  }

  if (!match) {
    logDecision(appendFn, cwd, consumer, 'passthrough', rel);
    passThrough();
  }

  // Build the augment note (appended beneath the original file output, kept intact).
  const original = payload.tool_response || payload.tool_output || '';
  const note =
    `\n\n▸ GSD-T code graph: this read (lines ${readStart}-${readEnd}) sits inside ` +
    `\`${match.name}\` (${rel}:${match.start}-${match.end}). For just this function's ` +
    `source + its imports, class header, and callers (≈10× fewer tokens), run:\n` +
    `    gsd-t graph body '${match.funcId}'`;

  // Log augment decision BEFORE emitting (fail-open: if logging throws, decision unchanged).
  logDecision(appendFn, cwd, consumer, 'augment', rel);

  emitAugment(typeof original === 'string' ? original : JSON.stringify(original), note);
}

// ── stdin → main, fail-open everywhere ────────────────────────────────────────
let inputBuf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { inputBuf += c; });
process.stdin.on('end', () => {
  let payload;
  try { payload = JSON.parse(inputBuf); } catch { passThrough(); }
  try { main(payload); } catch { passThrough(); }
});
process.stdin.on('error', () => passThrough());
