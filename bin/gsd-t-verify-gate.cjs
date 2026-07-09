#!/usr/bin/env node
'use strict';

/**
 * GSD-T verify-gate (M55 D5)
 *
 * Two-track gate:
 *   Track 1 — D1 preflight envelope (`bin/cli-preflight.cjs::runPreflight`).
 *             Hard-fail on any severity:"error" check.
 *   Track 2 — D2 parallel-CLI substrate (`bin/parallel-cli.cjs::runParallel`).
 *             Fans out tsc / lint / tests / dead-code / secrets / complexity.
 *
 * Returns a ≤500-token JSON summary the LLM judge consumes via
 * `bin/gsd-t-verify-gate-judge.cjs`. Raw worker output stays on disk under
 * `.gsd-t/verify-gate/{runId}/`.
 *
 * Contract: .gsd-t/contracts/verify-gate-contract.md v1.0.0 STABLE.
 *
 * Hard rules:
 *   1. Zero external runtime deps. Only Node built-ins + sibling D1/D2 libraries.
 *   2. NEVER call child_process.spawn directly. Track 2 fans out via D2.
 *   3. ok = (skipTrack1 || track1.ok) && (skipTrack2 || track2.ok). Purely deterministic.
 *   4. summary serialization ≤summaryTokenCap (default 500 tokens at 4 chars/token).
 *   5. Defensive on missing .gsd-t/ratelimit-map.json — fall back to maxConcurrency=2.
 */

const fs = require('fs');
const path = require('path');

const { runPreflight } = require('./cli-preflight.cjs');
const { runParallel } = require('./parallel-cli.cjs');

const SCHEMA_VERSION = '1.0.0';
const DEFAULT_SUMMARY_TOKEN_CAP = 500;
const TOKENS_PER_CHAR = 0.25; // 4 chars/token approximation
const DEFAULT_FALLBACK_MAX_CONCURRENCY = 2;
const SNIPPET_CHARS_PER_SIDE_DEFAULT = 200;
const SNIPPET_CHARS_PER_SIDE_FLOOR = 16; // 32 chars total per snippet

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Execute Track 1 + Track 2 and return the v1.0.0 envelope.
 *
 * @param {object} [opts]
 * @param {string} [opts.projectDir='.']
 * @param {string[]} [opts.preflightChecks]      restrict D1 to these checks
 * @param {Array<object>} [opts.parallelTrack]   override default Track 2 worker spec list
 * @param {number} [opts.maxConcurrency]         override D3-map default
 * @param {boolean} [opts.failFast=false]        passed to runParallel
 * @param {number} [opts.summaryTokenCap=500]    summary hard cap
 * @param {boolean} [opts.skipTrack1=false]      diagnostic only
 * @param {boolean} [opts.skipTrack2=false]      diagnostic only
 * @param {Date} [opts.now]                      injected for tests
 * @param {Function} [opts.runParallelImpl]      DI for tests; default = real runParallel
 * @returns {Promise<object>}
 */
async function runVerifyGate(opts) {
  opts = opts || {};
  const projectDir = opts.projectDir || '.';
  const summaryTokenCap = Number.isFinite(opts.summaryTokenCap) && opts.summaryTokenCap > 0
    ? opts.summaryTokenCap
    : DEFAULT_SUMMARY_TOKEN_CAP;
  const skipTrack1 = !!opts.skipTrack1;
  const skipTrack2 = !!opts.skipTrack2;
  const failFast = !!opts.failFast;
  const now = opts.now instanceof Date ? opts.now : new Date();
  const runParallelImpl = typeof opts.runParallelImpl === 'function'
    ? opts.runParallelImpl
    : runParallel;

  const notes = [];

  // ── Track 1 ───────────────────────────────────────────────────────────────
  let track1;
  if (skipTrack1) {
    track1 = {
      schemaVersion: '1.0.0',
      ok: true,
      skipped: true,
      checks: [],
      notes: ['skipped by flag'],
    };
  } else {
    try {
      track1 = runPreflight({ projectDir, checks: opts.preflightChecks });
    } catch (err) {
      track1 = {
        schemaVersion: '1.0.0',
        ok: false,
        checks: [],
        notes: ['runPreflight threw: ' + (err && err.message || String(err))],
      };
    }
  }

  // ── Resolve maxConcurrency from D3 map (defensive) ────────────────────────
  const resolved = _resolveMaxConcurrency({
    projectDir,
    explicit: opts.maxConcurrency,
  });
  const maxConcurrency = resolved.value;
  for (const n of resolved.notes) notes.push(n);

  // ── runId + on-disk dir ───────────────────────────────────────────────────
  const runId = _runIdFromDate(now);
  const teeDir = path.join(projectDir, '.gsd-t', 'verify-gate', runId);

  // ── Track 2 ───────────────────────────────────────────────────────────────
  let track2;
  if (skipTrack2) {
    track2 = {
      ok: true,
      skipped: true,
      wallClockMs: 0,
      maxConcurrencyApplied: maxConcurrency,
      workers: [],
      notes: ['skipped by flag'],
    };
  } else {
    const plan = Array.isArray(opts.parallelTrack)
      ? opts.parallelTrack
      : _detectDefaultTrack2(projectDir, notes);

    if (plan.length === 0) {
      track2 = {
        ok: true,
        wallClockMs: 0,
        maxConcurrencyApplied: maxConcurrency,
        workers: [],
        notes: ['track 2: no detected CLIs — Track 2 is a no-op'],
      };
    } else {
      let envelope;
      try {
        envelope = await runParallelImpl({
          workers: plan,
          maxConcurrency,
          failFast,
          teeDir,
          projectDir,
          command: 'gsd-t-verify-gate',
          step: 'Track 2',
          domain: 'm55-d5',
          task: '-',
        });
      } catch (err) {
        envelope = {
          ok: false,
          wallClockMs: 0,
          maxConcurrencyApplied: maxConcurrency,
          results: [],
          notes: ['runParallel threw: ' + (err && err.message || String(err))],
        };
      }

      track2 = _shapeTrack2(envelope, plan);
    }
  }

  // ── Summary (≤summaryTokenCap) ────────────────────────────────────────────
  const summary = _buildSummary({ track1, track2, summaryTokenCap });

  const ok = (skipTrack1 ? true : !!track1.ok) && (skipTrack2 ? true : !!track2.ok);

  // Sort notes for determinism.
  notes.sort();

  return {
    schemaVersion: SCHEMA_VERSION,
    ok,
    track1,
    track2,
    summary,
    llmJudgePromptHint: 'Render PASS / FAIL verdict on the summary above. Be terse. The deterministic verdict is `summary.verdict`; you confirm or contradict.',
    meta: {
      runId,
      generatedAt: now.toISOString(),
    },
    notes,
  };
}

// ── Internal: maxConcurrency resolution ─────────────────────────────────────

function _resolveMaxConcurrency({ projectDir, explicit }) {
  const notes = [];
  if (Number.isFinite(explicit) && explicit > 0) {
    return { value: Math.floor(explicit), notes };
  }
  const mapPath = path.join(projectDir, '.gsd-t', 'ratelimit-map.json');
  let mapData;
  try {
    mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  } catch (_err) {
    notes.push('ratelimit-map.json absent — using maxConcurrency=' + DEFAULT_FALLBACK_MAX_CONCURRENCY + ' conservative default');
    return { value: DEFAULT_FALLBACK_MAX_CONCURRENCY, notes };
  }
  const peak = mapData
    && mapData.recommended
    && typeof mapData.recommended.peakConcurrency === 'number'
    && mapData.recommended.peakConcurrency >= 1
    ? Math.floor(mapData.recommended.peakConcurrency)
    : null;
  if (peak == null) {
    notes.push('ratelimit-map.json missing recommended.peakConcurrency — using maxConcurrency=' + DEFAULT_FALLBACK_MAX_CONCURRENCY);
    return { value: DEFAULT_FALLBACK_MAX_CONCURRENCY, notes };
  }
  return { value: peak, notes };
}

// ── Internal: Track 2 default plan detection ───────────────────────────────
//
// Detection is read-only — D5 NEVER auto-installs.
// CLIs that aren't installed surface as workers with skipped:true downstream.

function _detectDefaultTrack2(projectDir, notes) {
  const plan = [];
  const has = (rel) => {
    try { return fs.existsSync(path.join(projectDir, rel)); } catch (_) { return false; }
  };

  // typecheck — tsc. Run ONLY when tsc is actually INSTALLED (the binary exists).
  // A bare `tsconfig.json` is NOT sufficient: scip-typescript auto-creates an empty
  // `{}` tsconfig at the root of any project it indexes (including zero-dep plain-JS
  // repos like GSD-T itself). The old `has('tsconfig.json')` OR-trigger then ran
  // `npx --no-install tsc` with no tsc present → "TypeScript not installed" → a
  // FALSE verify-gate FAIL on a non-TS project. A genuine TS project ships tsc in
  // node_modules/.bin/, so requiring the binary cannot disable typecheck where it
  // truly applies. (We still require a tsconfig so tsc has a config to read.)
  if (has('node_modules/.bin/tsc') && has('tsconfig.json')) {
    plan.push({
      id: 'tsc',
      cmd: 'npx',
      args: ['--no-install', 'tsc', '--noEmit'],
      timeoutMs: 120000,
    });
  }

  // lint (JS) — biome
  if (has('biome.json') || has('biome.jsonc')) {
    plan.push({
      id: 'lint-js',
      cmd: 'npx',
      args: ['--no-install', 'biome', 'check'],
      timeoutMs: 60000,
    });
  }

  // lint (Py) — ruff (only if pyproject.toml has [tool.ruff])
  if (has('pyproject.toml')) {
    let pyproject = '';
    try { pyproject = fs.readFileSync(path.join(projectDir, 'pyproject.toml'), 'utf8'); } catch (_) {}
    if (/\[tool\.ruff\]/.test(pyproject)) {
      plan.push({
        id: 'lint-py',
        cmd: 'ruff',
        args: ['check', '.'],
        timeoutMs: 60000,
      });
    }
  }

  // tests — npm test
  if (has('package.json')) {
    let pkg = {};
    try { pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8')); } catch (_) {}
    if (pkg && pkg.scripts && typeof pkg.scripts.test === 'string') {
      plan.push({
        id: 'tests',
        cmd: 'npm',
        args: ['test', '--silent'],
        timeoutMs: 600000,
      });
    }
  }

  // dead-code — knip
  if (has('node_modules/.bin/knip')) {
    plan.push({
      id: 'dead-code',
      cmd: 'npx',
      args: ['--no-install', 'knip'],
      timeoutMs: 60000,
    });
  }

  // M56 D1: playwright e2e — native CLI worker (not Task subagent wrapper)
  if (has('playwright.config.ts') || has('playwright.config.js') || has('playwright.config.cjs')) {
    plan.push({
      id: 'playwright',
      cmd: 'npx',
      args: ['--no-install', 'playwright', 'test'],
      timeoutMs: 600000,
    });
  }

  // M56 D1: journey coverage — gsd-t check-coverage (native CLI, no LLM)
  if (has('.gsd-t/journey-manifest.json')) {
    plan.push({
      id: 'journey-coverage',
      cmd: 'node',
      args: ['./bin/gsd-t.js', 'check-coverage'],
      timeoutMs: 30000,
    });
  }

  plan.push({ id: 'logging-envelope', cmd: 'node', args: [path.join(__dirname, 'gsd-t-logging-envelope-check.cjs'), '--project', projectDir], timeoutMs: 30000 }); // M100 D3: structural trace+audit envelope gate, FAIL-CLOSED

  // secrets — gitleaks (PATH detection deferred to runtime)
  if (_hasOnPath('gitleaks')) {
    plan.push({
      id: 'secrets',
      cmd: 'gitleaks',
      args: ['detect', '--no-git', '-v'],
      timeoutMs: 60000,
    });
  }

  // complexity — scc preferred, lizard fallback
  if (_hasOnPath('scc')) {
    plan.push({
      id: 'complexity',
      cmd: 'scc',
      args: ['.'],
      timeoutMs: 60000,
    });
  } else if (_hasOnPath('lizard')) {
    plan.push({
      id: 'complexity',
      cmd: 'lizard',
      args: ['.'],
      timeoutMs: 120000,
    });
  }

  if (plan.length === 0) {
    notes.push('track 2: no off-the-shelf CLIs detected — Track 2 plan is empty');
  }

  return plan;
}

function _hasOnPath(cmd) {
  // Probe via PATH segments. Read-only, no spawn.
  const PATH = process.env.PATH || '';
  const sep = process.platform === 'win32' ? ';' : ':';
  for (const dir of PATH.split(sep)) {
    if (!dir) continue;
    try {
      if (fs.existsSync(path.join(dir, cmd))) return true;
    } catch (_) {}
  }
  return false;
}

// ── Internal: Shape D2 envelope into track2 ─────────────────────────────────

function _shapeTrack2(envelope, plan) {
  const planById = new Map();
  for (const w of plan) planById.set(w.id, w);

  const workers = (envelope.results || []).map((r) => {
    const planEntry = planById.get(r.id) || {};
    const cap = Number.isFinite(planEntry.summarySnippetCharsPerSide)
      && planEntry.summarySnippetCharsPerSide > 0
      ? Math.floor(planEntry.summarySnippetCharsPerSide)
      : SNIPPET_CHARS_PER_SIDE_DEFAULT;
    return {
      id: r.id,
      ok: !!r.ok,
      exitCode: typeof r.exitCode === 'number' ? r.exitCode : null,
      durationMs: typeof r.durationMs === 'number' ? r.durationMs : 0,
      skipped: false,
      reason: null,
      summarySnippet: _readSummarySnippet(r, cap),
    };
  });

  workers.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const track2Ok = workers.every((w) => w.ok || w.skipped);
  const track2Notes = Array.isArray(envelope.notes) ? envelope.notes.slice() : [];
  track2Notes.sort();

  return {
    ok: track2Ok,
    wallClockMs: typeof envelope.wallClockMs === 'number' ? envelope.wallClockMs : 0,
    maxConcurrencyApplied: typeof envelope.maxConcurrencyApplied === 'number'
      ? envelope.maxConcurrencyApplied
      : 0,
    workers,
    notes: track2Notes,
  };
}

function _readSummarySnippet(workerResult, cap) {
  // Prefer reading the tee NDJSON, but the file-system read is best-effort —
  // a failure surfaces as an empty snippet, not a crash.
  let stdoutText = '';
  let stderrText = '';
  if (workerResult.stdoutPath) {
    stdoutText = _readNdjsonText(workerResult.stdoutPath);
  }
  if (workerResult.stderrPath) {
    stderrText = _readNdjsonText(workerResult.stderrPath);
  }

  const stdoutSnip = _headTail(stdoutText, cap);
  const stderrSnip = stderrText.length > 0 ? '\nSTDERR: ' + _headTail(stderrText, cap) : '';
  const out = (stdoutSnip + stderrSnip).trim();
  return _sanitizeForJson(out);
}

function _readNdjsonText(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\n/);
    const data = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (typeof obj.data === 'string') data.push(obj.data);
      } catch (_) {
        // Skip malformed line.
      }
    }
    return data.join('\n');
  } catch (_) {
    return '';
  }
}

function _headTail(text, cap) {
  if (!text) return '';
  if (text.length <= cap * 2) return text;
  return text.slice(0, cap) + '\n…\n' + text.slice(-cap);
}

function _sanitizeForJson(s) {
  // Replace unprintable control chars (except \n, \t) with '?'.
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 9 || c === 10) { out += s[i]; continue; }
    if (c < 32 || c === 127) { out += '?'; continue; }
    out += s[i];
  }
  return out;
}

// ── Internal: build summary with hard cap ──────────────────────────────────

function _buildSummary({ track1, track2, summaryTokenCap }) {
  const track1Failed = (track1.checks || [])
    .filter((c) => c.ok === false)
    .map((c) => ({ id: c.id, severity: c.severity, msg: String(c.msg || '') }));

  const track2FailedFull = (track2.workers || [])
    .filter((w) => !w.ok && !w.skipped)
    .map((w) => ({
      id: w.id,
      exitCode: w.exitCode,
      summarySnippet: String(w.summarySnippet || ''),
    }));

  let snippetCap = SNIPPET_CHARS_PER_SIDE_DEFAULT;
  let truncatedNote = null;
  let working = track2FailedFull.map((w) => ({ ...w }));

  // Iteratively shrink snippets until the serialized summary fits.
  while (true) {
    const summary = {
      verdict: (track1.ok && track2.ok) ? 'PASS' : 'FAIL',
      track1: {
        ok: !!track1.ok,
        failedChecks: track1Failed,
      },
      track2: {
        ok: !!track2.ok,
        failedWorkers: working,
      },
    };
    const json = JSON.stringify(summary);
    const tokenEstimate = Math.ceil(json.length * TOKENS_PER_CHAR);
    if (tokenEstimate <= summaryTokenCap) {
      if (truncatedNote && Array.isArray(track2.notes)) {
        track2.notes.push(truncatedNote);
        track2.notes.sort();
      }
      return summary;
    }

    // Halve the per-side snippet cap.
    snippetCap = Math.floor(snippetCap / 2);
    if (snippetCap < SNIPPET_CHARS_PER_SIDE_FLOOR) {
      // We're at the floor. Truncate the failedWorkers list.
      if (working.length > 1) {
        const removed = working.length - 1;
        working = working.slice(0, 1);
        truncatedNote = 'truncated: ' + removed + ' more failed workers';
        // Re-loop with truncated list.
        continue;
      }
      // Single worker, smallest snippet, still over cap — accept and emit.
      const summaryFinal = {
        verdict: (track1.ok && track2.ok) ? 'PASS' : 'FAIL',
        track1: {
          ok: !!track1.ok,
          failedChecks: track1Failed,
        },
        track2: {
          ok: !!track2.ok,
          failedWorkers: working,
        },
      };
      if (truncatedNote && Array.isArray(track2.notes)) {
        track2.notes.push(truncatedNote);
        track2.notes.sort();
      }
      return summaryFinal;
    }

    // Re-shrink each working snippet head+tail to floor*2 chars.
    working = working.map((w) => ({
      ...w,
      summarySnippet: _shrinkSnippet(w.summarySnippet, snippetCap),
    }));
  }
}

function _shrinkSnippet(snip, cap) {
  if (typeof snip !== 'string' || snip.length <= cap * 2) return snip || '';
  return snip.slice(0, cap) + '\n…\n' + snip.slice(-cap);
}

// ── Internal: runId ─────────────────────────────────────────────────────────

function _runIdFromDate(d) {
  const iso = d.toISOString().replace(/[:.]/g, '-');
  return 'verify-gate-' + iso.slice(0, 19) + 'Z';
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function _parseArgv(argv) {
  const out = {
    projectDir: '.',
    mode: 'json',
    skipTrack1: false,
    skipTrack2: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project') out.projectDir = argv[++i] || '.';
    else if (a === '--json') out.mode = 'json';
    else if (a === '--skip-track1') out.skipTrack1 = true;
    else if (a === '--skip-track2') out.skipTrack2 = true;
    else if (a === '--max-concurrency') {
      const v = parseInt(argv[++i] || '', 10);
      if (Number.isFinite(v) && v >= 1) out.maxConcurrency = v;
      else out._badFlag = '--max-concurrency requires a positive integer';
    } else if (a === '--fail-fast') out.failFast = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else { out._badFlag = 'unknown flag: ' + a; }
  }
  return out;
}

function _printHelp() {
  const lines = [
    'Usage: gsd-t verify-gate [options]',
    '',
    'Options:',
    '  --project DIR        Project root (default: .)',
    '  --json               Print JSON envelope (default)',
    '  --skip-track1        Skip preflight (diagnostic only)',
    '  --skip-track2        Skip parallel CLIs (diagnostic only)',
    '  --max-concurrency N  Override D3-map default (default: read .gsd-t/ratelimit-map.json)',
    '  --fail-fast          Cancel siblings on first failure (passed to runParallel)',
    '  --help               Show this help',
    '',
    'Exit codes:',
    '  0  ok=true',
    '  4  ok=false',
    '  2  CLI usage error',
    '  3  unhandled internal error',
  ];
  process.stdout.write(lines.join('\n') + '\n');
}

async function _runCli(argv) {
  const args = _parseArgv(argv);
  if (args.help) {
    _printHelp();
    return 0;
  }
  if (args._badFlag) {
    process.stderr.write('verify-gate: ' + args._badFlag + '\n');
    return 2;
  }
  let envelope;
  try {
    envelope = await runVerifyGate({
      projectDir: args.projectDir,
      maxConcurrency: args.maxConcurrency,
      failFast: !!args.failFast,
      skipTrack1: args.skipTrack1,
      skipTrack2: args.skipTrack2,
    });
  } catch (err) {
    process.stderr.write('verify-gate: ' + (err && err.message || String(err)) + '\n');
    return 3;
  }
  process.stdout.write(JSON.stringify(envelope, null, 2) + '\n');
  return envelope.ok ? 0 : 4;
}

if (require.main === module) {
  _runCli(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => { process.stderr.write(String(err) + '\n'); process.exit(3); }
  );
}

module.exports = {
  runVerifyGate,
  SCHEMA_VERSION,
  // Test surface (not part of the public contract):
  _resolveMaxConcurrency,
  _detectDefaultTrack2,
  _shapeTrack2,
  _buildSummary,
  _shrinkSnippet,
  _runIdFromDate,
  _parseArgv,
  _readNdjsonText,
  _headTail,
  _sanitizeForJson,
};
