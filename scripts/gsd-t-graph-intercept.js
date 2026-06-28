#!/usr/bin/env node
/**
 * gsd-t-graph-intercept.js — M97
 *
 * A PostToolUse hook on the `Grep` tool. When Claude runs a grep that is actually
 * a STRUCTURAL question (who-calls / who-imports / a bare symbol), this answers it
 * from the precomputed code graph and REPLACES the grep output the model sees
 * (via `updatedToolOutput`). Text searches pass through untouched.
 *
 * Receives JSON on stdin (PostToolUse):
 *   { tool_name, tool_input: { pattern, path? }, tool_response/tool_output, cwd, ... }
 *
 * Emits JSON on stdout:
 *   { hookSpecificOutput: { hookEventName: "PostToolUse",
 *       updatedToolOutput: "<graph answer + original grep beneath>" } }
 *   ...or nothing (exit 0) to pass the grep through unchanged.
 *
 * INVARIANTS:
 *   - FAIL-OPEN: any error / missing graph / non-structural → pass through (emit nothing).
 *   - NEVER calls Grep/Read (loop guard). Only spawns the graph query CLI.
 *   - No graph in this project → pure no-op.
 *   - Original grep hits are RETAINED beneath the graph answer (no silent hiding).
 *
 * [RULE] graph-intercept-fail-open-never-breaks-grep
 * [RULE] graph-intercept-structural-only-text-passes-through
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const OUTPUT_CAP = 9000; // stay under the 10K hook output cap, leave headroom

function passThrough() {
  // Emit nothing → the original grep output reaches the model unchanged.
  process.exit(0);
}

function emitReplacement(text) {
  const out = {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      updatedToolOutput: text.length > OUTPUT_CAP
        ? text.slice(0, OUTPUT_CAP) + '\n…(truncated — query the graph CLI directly for the full list)'
        : text,
    },
  };
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

// Resolve the project-local graph query CLI. Returns null if absent.
function resolveQueryCli(cwd) {
  const local = path.join(cwd, 'bin', 'gsd-t-graph-query-cli.cjs');
  if (fs.existsSync(local)) return local;
  return null;
}

function main(payload) {
  // Only act on Grep.
  if (!payload || payload.tool_name !== 'Grep') passThrough();

  const cwd = payload.cwd || process.cwd();

  // Must be a GSD-T project with a graph present.
  if (!fs.existsSync(path.join(cwd, '.gsd-t'))) passThrough();
  if (!fs.existsSync(path.join(cwd, '.gsd-t', 'graph.db'))) passThrough();

  const pattern = payload.tool_input && payload.tool_input.pattern;
  if (typeof pattern !== 'string' || !pattern) passThrough();

  // Classify (the classifier itself fails safe → text).
  let cls;
  try {
    const { classifyGrep } = require(path.join(__dirname, '..', 'bin', 'gsd-t-grep-classifier.cjs'));
    cls = classifyGrep(pattern);
  } catch { passThrough(); }
  if (!cls || !cls.structural) passThrough();

  const cliPath = resolveQueryCli(cwd);
  if (!cliPath) passThrough();

  // Query the graph. who-calls for symbols/calls; who-imports for imports.
  // For a bare symbol we ALSO try who-imports so the model sees both usages.
  const verbs = cls.verb === 'who-imports'
    ? ['who-imports']
    : ['who-calls', 'who-imports'];

  const sections = [];
  for (const verb of verbs) {
    let res;
    try {
      res = spawnSync(process.execPath, [cliPath, verb, cls.symbol], {
        cwd, encoding: 'utf8', timeout: 8000,
      });
    } catch { continue; }
    // Parse the envelope regardless of exit status — an ambiguous-symbol result
    // exits non-zero with ok:false but still carries a valid structural answer
    // (the candidate list). Only a missing/garbled stdout is unusable.
    if (!res || !res.stdout) continue;
    let env;
    try { env = JSON.parse(res.stdout.trim().split('\n').pop()); } catch { continue; }
    if (!env) continue;
    const results = env.results || [];
    if (results.length) {
      const tier = env.tier ? ` [tier: ${env.tier}]` : '';
      const shown = results.slice(0, 60);
      const more = results.length > 60 ? ` (+${results.length - 60} more)` : '';
      sections.push(`${verb}(${cls.symbol})${tier}: ${shown.join(', ')}${more}`);
    } else if ((env.candidates || []).length) {
      // ambiguous symbol (ok:false, reason:'ambiguous-function') — the candidate
      // list IS the structural answer: the symbol exists in N places.
      const cands = env.candidates.slice(0, 20);
      const more = env.candidates.length > 20 ? ` (+${env.candidates.length - 20} more)` : '';
      sections.push(`${verb}(${cls.symbol}) → defined in ${env.candidates.length} place(s): ${cands.join(', ')}${more}`);
    }
  }

  // No graph answer → pass the grep through (don't replace with nothing).
  if (!sections.length) passThrough();

  // Build the replacement: graph answer first (labeled), original grep beneath.
  const original = payload.tool_response || payload.tool_output || '';
  const replacement =
    `▸ Structural answer from the GSD-T code graph (precomputed; faster + more accurate than text grep for "where is this used"):\n` +
    sections.map((s) => `  • ${s}`).join('\n') +
    `\n\n─── original grep output (kept for reference) ───\n` +
    (typeof original === 'string' ? original : JSON.stringify(original));

  emitReplacement(replacement);
}

// ── stdin → main, fail-open everywhere ────────────────────────────────────────
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  let payload;
  try { payload = JSON.parse(input); } catch { passThrough(); }
  try { main(payload); } catch { passThrough(); }
});
process.stdin.on('error', () => passThrough());
