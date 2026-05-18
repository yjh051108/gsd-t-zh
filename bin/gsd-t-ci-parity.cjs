#!/usr/bin/env node
'use strict';

/**
 * GSD-T ci-parity (M57 D2)
 *
 * Reproduces a project's actual CI build locally instead of relying on
 * potentially warm-cache local tsc/test parity.
 *
 * Auto-detects CI config via locked detection precedence (user decision — do
 * NOT reorder): cloudbuild.yaml → .github/workflows/*.yml → Dockerfile RUN →
 * package.json scripts (build, typecheck, test) → none.
 *
 * Clears build caches before running detected commands so stale incremental
 * artifacts cannot mask regressions (the TimeTracking v1.10.12 SC2 failure
 * class: ~8 noImplicitAny errors passed warm-cache local tsc, failed CI cold
 * build).
 *
 * When a Dockerfile is present, runs a real `docker build` — presence is the
 * sole trigger; no opt-in flag (locked user decision).
 *
 * Contract: .gsd-t/contracts/ci-parity-contract.md v1.0.0 STABLE
 *
 * Parse limits (no external YAML lib; minimal line/regex scanning):
 *   - cloudbuild.yaml: only reads `args:` array elements under `steps:`.
 *     Multi-line folded/block scalars are not supported. Only simple
 *     `args: [...]` one-liner arrays or `- 'val'` list forms are handled.
 *   - .github/workflows/*.yml: only reads `run:` lines from the FIRST job's
 *     steps. Multi-line pipe/fold blocks (`run: |`) capture only the first
 *     continuation line. `uses:` steps (no `run:`) are skipped.
 *   - Dockerfile: reads `RUN` lines (single-line only; backslash-continuations
 *     are joined into one command).
 *   These limits are intentional trade-offs to keep the module at zero
 *   external runtime deps.
 */

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const DEFAULT_TIMEOUT_MS = 120_000;

// ── Detection ─────────────────────────────────────────────────────────────────

/** Parse cloudbuild.yaml steps[].args → array of command strings. */
function detectCloudbuild(projectDir) {
  const f = path.join(projectDir, 'cloudbuild.yaml');
  if (!fs.existsSync(f)) return null;
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  const cmds = [];
  let inArgs = false;
  let argParts = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    // Inline array: `    args: ['node', '-e', '...']`
    const inlineM = line.match(/^\s+args:\s*\[(.+)\]/);
    if (inlineM) {
      const cmd = inlineM[1]
        .split(',')
        .map((t) => t.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)
        .join(' ');
      if (cmd) cmds.push(cmd);
      inArgs = false;
      argParts = [];
      continue;
    }
    // Start of args block: `    args:`
    if (/^\s+args:\s*$/.test(line)) {
      inArgs = true;
      argParts = [];
      continue;
    }
    if (inArgs) {
      // List item under args
      const itemM = line.match(/^\s+-\s+['"]?(.+?)['"]?\s*$/);
      if (itemM) {
        argParts.push(itemM[1]);
        continue;
      }
      // Not a list item → end of args block
      if (argParts.length) {
        cmds.push(argParts.join(' '));
        argParts = [];
      }
      inArgs = false;
    }
  }
  if (inArgs && argParts.length) cmds.push(argParts.join(' '));
  return cmds.length ? cmds : [];
}

/** Parse first job's steps[].run from .github/workflows/*.yml. */
function detectWorkflows(projectDir) {
  const wfDir = path.join(projectDir, '.github', 'workflows');
  if (!fs.existsSync(wfDir)) return null;
  const files = fs.readdirSync(wfDir).filter((f) => /\.ya?ml$/.test(f));
  if (!files.length) return null;
  const lines = fs.readFileSync(path.join(wfDir, files[0]), 'utf8').split('\n');
  const cmds = [];
  let inJobs = false;
  let inSteps = false;
  let firstJobDone = false;
  let jobDepth = 0;
  let pendingRun = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^jobs:/.test(line)) { inJobs = true; continue; }
    if (!inJobs) continue;
    if (firstJobDone) continue;

    // Detect first-job boundary (4-space indent key)
    if (/^  \w[\w-]*:/.test(line)) { jobDepth++; if (jobDepth > 1) { firstJobDone = true; continue; } }
    if (/^\s+steps:/.test(line)) { inSteps = true; continue; }
    if (!inSteps) continue;

    // Inline run: `      - run: cmd`
    const inlineRunM = line.match(/^\s+-\s+run:\s+(.+)$/);
    if (inlineRunM) { cmds.push(inlineRunM[1].trim()); pendingRun = null; continue; }
    // Block run marker: `        run: |` or `        run: >`
    const blockRunM = line.match(/^\s+run:\s*[|>]?\s*$/);
    if (blockRunM) { pendingRun = true; continue; }
    // Inline run value: `        run: cmd`
    const plainRunM = line.match(/^\s+run:\s+(.+)$/);
    if (plainRunM && !blockRunM) { cmds.push(plainRunM[1].trim()); pendingRun = null; continue; }
    // Continuation line for block run (indented more than run:)
    if (pendingRun) {
      const contM = line.match(/^\s{10,}(.+)$/);
      if (contM) { cmds.push(contM[1].trim()); pendingRun = null; continue; }
      if (line.trim() === '') continue;
      pendingRun = null;
    }
  }
  return cmds.length ? cmds : [];
}

/** Parse RUN lines from a Dockerfile (backslash-continuations joined). */
function detectDockerfileRun(projectDir) {
  const f = path.join(projectDir, 'Dockerfile');
  if (!fs.existsSync(f)) return null;
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  const cmds = [];
  let buf = '';

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^RUN\s+/.test(line)) {
      buf = line.replace(/^RUN\s+/, '').replace(/\\$/, '').trim();
    } else if (buf && /^\s/.test(line)) {
      buf += ' ' + line.replace(/\\$/, '').trim();
    } else {
      if (buf) { cmds.push(buf); buf = ''; }
    }
  }
  if (buf) cmds.push(buf);
  return cmds.length ? cmds : [];
}

/** Extract package.json scripts: build, typecheck, test (in that order). */
function detectPackageScripts(projectDir) {
  const f = path.join(projectDir, 'package.json');
  if (!fs.existsSync(f)) return null;
  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
  const scripts = (pkg && pkg.scripts) || {};
  const ORDER = ['build', 'typecheck', 'test'];
  const found = ORDER.filter((k) => scripts[k]);
  if (!found.length) return null;
  return found.map((k) => `npm run ${k}`);
}

/**
 * Detect CI source and return { source, commands }.
 * Precedence: cloudbuild → workflows → dockerfile-run → package-scripts → none.
 */
function detectCi(projectDir) {
  const cb = detectCloudbuild(projectDir);
  if (cb !== null) return { source: 'cloudbuild', commands: cb };

  const wf = detectWorkflows(projectDir);
  if (wf !== null) return { source: 'workflows', commands: wf };

  const df = detectDockerfileRun(projectDir);
  if (df !== null) return { source: 'dockerfile-run', commands: df };

  const ps = detectPackageScripts(projectDir);
  if (ps !== null) return { source: 'package-scripts', commands: ps };

  return { source: 'none', commands: [] };
}

// ── Cache clearing ─────────────────────────────────────────────────────────────

function collectFiles(dir, pred, depth, out) {
  if (depth <= 0) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules') continue;
      collectFiles(full, pred, depth - 1, out);
    } else if (pred(e.name)) {
      out.push(full);
    }
  }
}

/** Parse tsBuildInfoFile and outDir from tsconfig*.json files. */
function parseTsconfigArtifacts(projectDir) {
  const paths = [];
  let entries;
  try { entries = fs.readdirSync(projectDir); } catch { return paths; }
  for (const name of entries) {
    if (!/^tsconfig.*\.json$/.test(name)) continue;
    let cfg;
    try { cfg = JSON.parse(fs.readFileSync(path.join(projectDir, name), 'utf8')); } catch { continue; }
    const opts = (cfg && cfg.compilerOptions) || {};
    if (opts.tsBuildInfoFile) {
      paths.push(path.resolve(projectDir, opts.tsBuildInfoFile));
    }
    if (opts.outDir) {
      paths.push(path.resolve(projectDir, opts.outDir));
    }
  }
  return paths;
}

function removePath(p) {
  try {
    const st = fs.statSync(p);
    if (st.isDirectory()) fs.rmSync(p, { recursive: true, force: true });
    else fs.unlinkSync(p);
  } catch { /* best-effort */ }
}

/** Clear build caches before running detected commands (mandatory). */
function clearBuildCaches(projectDir) {
  // 1. Remove all *.tsbuildinfo files recursively
  const tsBuildInfoFiles = [];
  collectFiles(projectDir, (name) => name.endsWith('.tsbuildinfo'), 6, tsBuildInfoFiles);
  for (const f of tsBuildInfoFiles) removePath(f);

  // 2. Remove node_modules/.cache
  removePath(path.join(projectDir, 'node_modules', '.cache'));

  // 3. Remove tsconfig-referenced outDir / tsBuildInfoFile (best-effort)
  for (const p of parseTsconfigArtifacts(projectDir)) removePath(p);
}

// ── Command runner ─────────────────────────────────────────────────────────────

/** Run a single shell command with bounded timeout. Returns {cmd, exitCode, ok, output}. */
function runCommand(cmd, projectDir, timeoutMs) {
  let result;
  try {
    result = child_process.spawnSync('sh', ['-c', cmd], {
      cwd: projectDir,
      timeout: timeoutMs,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    return { cmd, exitCode: 1, ok: false, output: String(err) };
  }
  const exitCode = result.status != null ? result.status : 1;
  return { cmd, exitCode, ok: exitCode === 0, output: (result.stdout || '') + (result.stderr || '') };
}

// ── Docker ─────────────────────────────────────────────────────────────────────

/** Check whether the `docker` binary is available on PATH. */
function dockerAvailable() {
  try {
    const r = child_process.spawnSync('docker', ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 5000,
    });
    return r.status === 0;
  } catch { return false; }
}

/**
 * Run `docker build` in projectDir with a bounded timeout.
 * Returns { ok, exitCode, output }.
 */
function runDockerBuild(projectDir, timeoutMs) {
  const tag = `gsd-t-ci-parity-${Date.now()}`;
  let result;
  try {
    result = child_process.spawnSync(
      'docker', ['build', '--no-cache', '-t', tag, '.'],
      {
        cwd: projectDir,
        timeout: timeoutMs,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
  } catch (err) {
    return { ok: false, exitCode: 1, output: String(err) };
  }
  // Best-effort cleanup of created image
  try {
    child_process.spawnSync('docker', ['rmi', '-f', tag], {
      stdio: 'ignore', timeout: 10000,
    });
  } catch { /* ignore */ }
  const exitCode = result.status != null ? result.status : 1;
  return { ok: exitCode === 0, exitCode, output: (result.stdout || '') + (result.stderr || '') };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Run CI parity check for a project.
 *
 * @param {object} opts
 * @param {string} opts.projectDir
 * @param {number} [opts.timeoutMs]
 * @returns {{ ok: boolean, detectedSource: string, commands: Array, dockerBuilt: boolean, dockerSkippedReason?: string, note?: string }}
 */
function runCiParity(opts) {
  const projectDir = (opts && opts.projectDir) || process.cwd();
  const timeoutMs = (opts && opts.timeoutMs) || DEFAULT_TIMEOUT_MS;

  const { source, commands } = detectCi(projectDir);

  // No CI config found — not a failure
  if (source === 'none') {
    const hasDockerfile = fs.existsSync(path.join(projectDir, 'Dockerfile'));
    const dockerResult = hasDockerfile
      ? runDockerStep(projectDir, timeoutMs)
      : { dockerBuilt: false, dockerSkippedReason: 'no-dockerfile' };
    return {
      ok: !dockerResult.dockerFailed,
      detectedSource: 'none',
      commands: [],
      ...dockerResult,
      note: 'No CI config detected (no cloudbuild.yaml, .github/workflows, Dockerfile RUN lines, or package.json scripts)',
    };
  }

  // Clear caches before running anything
  clearBuildCaches(projectDir);

  // Run all detected commands
  const commandResults = [];
  let allOk = true;
  for (const cmd of commands) {
    const r = runCommand(cmd, projectDir, timeoutMs);
    commandResults.push({ cmd: r.cmd, exitCode: r.exitCode, ok: r.ok });
    if (!r.ok) allOk = false;
  }

  // Docker step (presence-triggered, not a failure if docker unavailable)
  const hasDockerfile = fs.existsSync(path.join(projectDir, 'Dockerfile'));
  const dockerResult = hasDockerfile
    ? runDockerStep(projectDir, timeoutMs)
    : { dockerBuilt: false, dockerSkippedReason: 'no-dockerfile' };

  if (dockerResult.dockerFailed) allOk = false;

  const envelope = {
    ok: allOk,
    detectedSource: source,
    commands: commandResults,
    dockerBuilt: dockerResult.dockerBuilt,
  };
  if (dockerResult.dockerSkippedReason) envelope.dockerSkippedReason = dockerResult.dockerSkippedReason;
  if (!allOk && commands.length === 0) envelope.note = 'No commands detected';
  return envelope;
}

/**
 * Run docker build step (T3 logic).
 * Returns { dockerBuilt, dockerFailed?, dockerSkippedReason? }
 */
function runDockerStep(projectDir, timeoutMs) {
  if (!dockerAvailable()) {
    return { dockerBuilt: false, dockerSkippedReason: 'docker-unavailable', dockerFailed: false };
  }
  const r = runDockerBuild(projectDir, timeoutMs);
  return {
    dockerBuilt: r.ok,
    dockerFailed: !r.ok,
  };
}

module.exports = { runCiParity, detectCi, clearBuildCaches };

// ── CLI entry ──────────────────────────────────────────────────────────────────

if (require.main === module) {
  const argv = process.argv.slice(2);
  let jsonMode = false;
  let projectDir = process.cwd();
  let timeoutMs = DEFAULT_TIMEOUT_MS;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') { jsonMode = true; continue; }
    if (a === '--project-dir' && argv[i + 1]) { projectDir = argv[++i]; continue; }
    if (a === '--timeout-ms' && argv[i + 1]) { timeoutMs = Number(argv[++i]); continue; }
    if (a === '--help' || a === '-h') {
      process.stdout.write(
        'Usage: gsd-t ci-parity [--project-dir <dir>] [--timeout-ms <ms>] [--json]\n' +
        'Exit 0 = all CI commands + docker build passed\n' +
        'Exit 4 = failure\n' +
        'Exit 2 = usage error\n'
      );
      process.exit(0);
    }
  }

  let result;
  try {
    result = runCiParity({ projectDir, timeoutMs });
  } catch (err) {
    if (jsonMode) {
      process.stdout.write(JSON.stringify({ ok: false, error: String(err) }) + '\n');
    } else {
      process.stderr.write('ci-parity error: ' + String(err) + '\n');
    }
    process.exit(4);
  }

  if (jsonMode) {
    process.stdout.write(JSON.stringify(result) + '\n');
  } else {
    const status = result.ok ? 'PASS' : 'FAIL';
    process.stdout.write(`[ci-parity] ${status} detectedSource=${result.detectedSource}\n`);
    for (const c of result.commands) {
      process.stdout.write(`  [${c.ok ? 'ok' : 'FAIL'}] ${c.cmd} (exit ${c.exitCode})\n`);
    }
    if (result.dockerBuilt) {
      process.stdout.write('  [ok] docker build\n');
    } else if (result.dockerSkippedReason) {
      process.stdout.write(`  [skip] docker build: ${result.dockerSkippedReason}\n`);
    } else if (!result.dockerBuilt) {
      process.stdout.write('  [FAIL] docker build\n');
    }
    if (result.note) process.stdout.write(`  note: ${result.note}\n`);
  }

  process.exit(result.ok ? 0 : 4);
}
