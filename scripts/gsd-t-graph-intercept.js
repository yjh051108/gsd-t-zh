#!/usr/bin/env node
/**
 * gsd-t-graph-intercept.js — M97/M99
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
 * M99 D2:
 *   - Presence check uses D1's resolver (resolveStorePath) — never re-derives the path.
 *   - Layer-2a logging: one ledger line per decision (replaced + passthrough) via
 *     append_ledger_line. Consumer resolved from GSDT_GRAPH_CONSUMER env or
 *     payload hook_data.consumer; falls back to 'cli'. Fail-open.
 *
 * [RULE] graph-intercept-fail-open-never-breaks-grep
 * [RULE] graph-intercept-structural-only-text-passes-through
 * [RULE] presence-check-repointed
 * [RULE] byte-identical-on-off
 * [RULE] fail-open
 * [RULE] import-resolver-never-hardcode
 * [RULE] consumer-label-from-context-not-setenv
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

// M99 D2: load D1's resolver module (resolveStorePath + append_ledger_line).
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

// M99 D2: resolve consumer label from env or payload; falls back to 'cli'.
// [RULE] consumer-label-from-context-not-setenv
function resolveConsumer(payload) {
  if (process.env.GSDT_GRAPH_CONSUMER) return process.env.GSDT_GRAPH_CONSUMER;
  if (payload && payload.hook_data && typeof payload.hook_data.consumer === 'string') {
    return payload.hook_data.consumer;
  }
  return 'cli';
}

// M99 D2: emit one Layer-2a ledger line. Fail-open — never alters the decision.
// [RULE] fail-open  [RULE] byte-identical-on-off
function logDecision(appendFn, cwd, consumer, classified, action, patternShape) {
  if (!appendFn) return;
  try {
    appendFn({
      kind: 'grep',
      ts: new Date().toISOString(),
      classified,
      action,
      patternShape: String(patternShape).slice(0, 200),
      consumer,
    }, cwd);
  } catch { /* FAIL-OPEN: sink error never propagates */ }
}

function main(payload) {
  // Only act on Grep.
  if (!payload || payload.tool_name !== 'Grep') passThrough();

  const cwd = payload.cwd || process.cwd();

  // Must be a GSD-T project.
  if (!fs.existsSync(path.join(cwd, '.gsd-t'))) passThrough();

  // M99 D2: repoint presence check at D1's resolver. [RULE] presence-check-repointed
  const resolver = loadResolver(cwd);
  const storePath = resolver ? resolver.resolveStorePath(cwd) : null;
  if (!storePath || !fs.existsSync(storePath)) passThrough();

  const pattern = payload.tool_input && payload.tool_input.pattern;
  if (typeof pattern !== 'string' || !pattern) passThrough();

  // Resolve consumer and logging sink BEFORE the classify decision.
  const consumer = resolveConsumer(payload);
  const appendFn = resolver && typeof resolver.append_ledger_line === 'function'
    ? resolver.append_ledger_line : null;

  // Classify (the classifier itself fails safe → text).
  let cls;
  try {
    const { classifyGrep } = require(path.join(__dirname, '..', 'bin', 'gsd-t-grep-classifier.cjs'));
    cls = classifyGrep(pattern);
  } catch {
    // Classifier unavailable — passthrough without logging (no classified info to log)
    passThrough();
  }

  if (!cls || !cls.structural) {
    // Text-classified passthrough — log one line per the contract.
    // [RULE] byte-identical-on-off: logging is a side-channel; passthrough is unchanged.
    const classified = (cls && cls.classified) || 'text';
    const patternShape = (cls && cls.patternShape) || pattern.slice(0, 80);
    logDecision(appendFn, cwd, consumer, classified, 'passthrough', patternShape);
    passThrough();
  }

  const cliPath = resolveQueryCli(cwd);
  if (!cliPath) {
    // Structural but no CLI — log passthrough, pass through.
    logDecision(appendFn, cwd, consumer, 'structural', 'passthrough', cls.patternShape || pattern.slice(0, 80));
    passThrough();
  }

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

  // No graph answer → log passthrough (structural query but empty result), pass through.
  if (!sections.length) {
    logDecision(appendFn, cwd, consumer, 'structural', 'passthrough', cls.patternShape || pattern.slice(0, 80));
    passThrough();
  }

  // Graph answered — log replaced, then emit.
  logDecision(appendFn, cwd, consumer, 'structural', 'replaced', cls.patternShape || pattern.slice(0, 80));

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
