#!/usr/bin/env node
/**
 * gsd-t-read-intercept.js — M98
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
 * INVARIANTS:
 *   [RULE] read-intercept-fail-open          — any error / missing graph / non-code → pass through
 *   [RULE] read-intercept-augment-never-shrink — only APPEND; never replace the file body
 *   [RULE] read-intercept-structural-only      — augment ONLY when offset+limit ∈ one funcId range
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

function main(payload) {
  // Only act on Read.
  if (!payload || payload.tool_name !== 'Read') passThrough();

  const cwd = payload.cwd || process.cwd();

  // Must be a GSD-T project with a graph present.
  if (!fs.existsSync(path.join(cwd, '.gsd-t'))) passThrough();
  if (!fs.existsSync(path.join(cwd, '.gsd-t', 'graph.db'))) passThrough();

  const input = payload.tool_input || {};
  const filePath = input.file_path;
  if (typeof filePath !== 'string' || !filePath) passThrough();

  // Only code files. (Non-code / docs / config → pass through, AC-6.)
  if (!CODE_EXTS.has(path.extname(filePath).toLowerCase())) passThrough();

  // STRUCTURAL SIGNAL (conservative): the read must carry an offset+limit. A bare
  // full-file read has no structural target → pass through (no silent shrinking).
  const offset = Number(input.offset);
  const limit = Number(input.limit);
  if (!Number.isFinite(offset) || !Number.isFinite(limit) || limit <= 0) passThrough();
  const readStart = offset;          // 1-based first line read (Read's offset is 1-based)
  const readEnd = offset + limit - 1;

  // Relativize the file path against cwd so it matches stored funcIds (file#name@line).
  let rel = filePath;
  if (path.isAbsolute(filePath)) rel = path.relative(cwd, filePath);
  rel = rel.split(path.sep).join('/');

  // Find the function whose [start,end] range the read window lands inside, by
  // enumerating this file's funcIds straight from the graph DB (read-only). Cheaper
  // and more direct than spawning the query CLL — and it's the same store the CLI reads.
  let match = null;
  try {
    // Resolve the store loader from the global package (where this hook ships) first,
    // falling back to the project's own copy — a synthetic project may have neither,
    // in which case we fail-open (pass through).
    let requireStore;
    try { requireStore = require(path.join(__dirname, '..', 'bin', 'gsd-t-require-store.cjs')); }
    catch { requireStore = require(path.join(cwd, 'bin', 'gsd-t-require-store.cjs')); }
    const Database = requireStore.requireBetterSqlite();
    const db = new Database(path.join(cwd, '.gsd-t', 'graph.db'), { readonly: true });
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
          // The read window starts inside this function's [start,end] body.
          if (readStart >= start && readStart <= end) {
            // Prefer the innermost (largest start) enclosing function.
            if (!match || start > match.start) match = { funcId: r.func_id, name: r.name, start, end };
          }
        }
      }
    } finally {
      try { db.close(); } catch { /* best-effort */ }
    }
  } catch (_e) { passThrough(); }

  if (!match) passThrough();

  // Build the augment note (appended beneath the original file output, kept intact).
  const original = payload.tool_response || payload.tool_output || '';
  const note =
    `\n\n▸ GSD-T code graph: this read (lines ${readStart}-${readEnd}) sits inside ` +
    `\`${match.name}\` (${rel}:${match.start}-${match.end}). For just this function's ` +
    `source + its imports, class header, and callers (≈10× fewer tokens), run:\n` +
    `    gsd-t graph body '${match.funcId}'`;

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
