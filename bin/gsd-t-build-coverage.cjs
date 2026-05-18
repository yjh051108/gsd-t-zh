#!/usr/bin/env node
'use strict';

/**
 * GSD-T build-coverage (M57 D1)
 *
 * Detects new top-level paths added in a milestone commit range that no
 * CI build artifact references — the TimeTracking v1.10.12 failure class
 * (new `hooks/` dir committed, absent from Dockerfile COPY, shipped broken
 * while local verify reported VERIFIED).
 *
 * Exports: checkBuildCoverage({ projectDir, baseRef, headRef })
 * CLI:     node bin/gsd-t-build-coverage.cjs [--json] [--base REF] [--head REF]
 *
 * Contract: .gsd-t/contracts/cli-build-coverage-contract.md v1.0.0 STABLE.
 *
 * Exit codes (CLI):
 *   0 — ok:true (all new paths covered, OR no CI artifacts found)
 *   4 — ok:false (≥1 new top-level path uncovered)
 *   2 — usage error (bad refs, not a git repo, detached HEAD)
 *
 * Hard rules:
 *   1. Zero external runtime deps — Node built-ins only.
 *   2. Functions <30 lines where practical.
 *   3. Defensive: never throw out of checkBuildCoverage; usage errors surface
 *      as a thrown UsageError caught by the CLI entry.
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

/** Run git diff --name-only baseRef..headRef, return array of changed file paths. */
function gitDiffNames(projectDir, baseRef, headRef) {
  const range = `${baseRef}..${headRef}`;
  const raw = execSync(`git diff --name-only ${range}`, {
    cwd: projectDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return raw.split('\n').map(s => s.trim()).filter(Boolean);
}

/** Resolve default refs; throws UsageError if repo state is unusable. */
function resolveRefs(projectDir, baseRef, headRef) {
  // Verify it's a git repo
  execSync('git rev-parse --git-dir', {
    cwd: projectDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const base = baseRef || 'HEAD~1';
  const head = headRef || 'HEAD';
  if (base === head) {
    throw new UsageError(`baseRef and headRef are identical: ${base}`);
  }
  return { base, head };
}

/** Collapse a list of file paths to distinct top-level path segments. */
function collapseToTopLevel(filePaths) {
  const seen = new Set();
  for (const p of filePaths) {
    const seg = p.split('/')[0];
    if (seg) seen.add(seg);
  }
  return Array.from(seen).sort();
}

// ---------------------------------------------------------------------------
// CI-artifact parsers
// ---------------------------------------------------------------------------

/** Parse Dockerfile: return { found: boolean, coversAll: boolean, paths: string[] } */
function parseDockerfile(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const paths = [];
  let coversAll = false;
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip COPY --from= (multi-stage copy from image, not from workspace)
    if (/^COPY\s+--from=/i.test(trimmed)) continue;
    // Match COPY or ADD directives
    const m = trimmed.match(/^(?:COPY|ADD)\s+(.+)/i);
    if (!m) continue;
    // Parse the source(s) — all tokens except the last (destination)
    const tokens = m[1].trim().split(/\s+/);
    if (tokens.length < 2) continue;
    const sources = tokens.slice(0, tokens.length - 1);
    for (const src of sources) {
      // COPY . . or ADD . . covers everything
      if (src === '.') { coversAll = true; continue; }
      // Extract the top-level segment from the source path
      const seg = src.split('/')[0];
      if (seg && seg !== '.') paths.push(seg);
    }
  }
  return { found: true, coversAll, paths };
}

/** Parse cloudbuild.yaml: return array of referenced path segments (line/regex scan). */
function parseCloudBuild(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const paths = [];
  for (const line of lines) {
    // Find any word-like path segment that appears in the line (heuristic scan)
    // Look for patterns like: src/, hooks/, dist/, config/ etc.
    const matches = line.match(/\b([a-zA-Z0-9_.-]+)\//g);
    if (matches) {
      for (const m of matches) {
        const seg = m.replace(/\/$/, '');
        if (seg && !seg.startsWith('-') && seg !== '.') paths.push(seg);
      }
    }
  }
  return paths;
}

/** Parse .github/workflows/*.yml files: return array of referenced path segments. */
function parseWorkflows(workflowDir) {
  const paths = [];
  let files;
  try {
    files = fs.readdirSync(workflowDir);
  } catch {
    return paths;
  }
  for (const f of files) {
    if (!/\.ya?ml$/.test(f)) continue;
    const content = fs.readFileSync(path.join(workflowDir, f), 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const matches = line.match(/\b([a-zA-Z0-9_.-]+)\//g);
      if (matches) {
        for (const m of matches) {
          const seg = m.replace(/\/$/, '');
          if (seg && !seg.startsWith('-') && seg !== '.') paths.push(seg);
        }
      }
    }
  }
  return paths;
}

// ---------------------------------------------------------------------------
// CI artifact detection
// ---------------------------------------------------------------------------

/** Detect CI artifacts in projectDir; return { artifacts: string[], coversAll: boolean, coveredPaths: string[] } */
function detectCIArtifacts(projectDir) {
  const artifacts = [];
  let coversAll = false;
  const coveredPaths = [];

  const dockerfilePath = path.join(projectDir, 'Dockerfile');
  if (fs.existsSync(dockerfilePath)) {
    artifacts.push('Dockerfile');
    const result = parseDockerfile(dockerfilePath);
    if (result.coversAll) coversAll = true;
    coveredPaths.push(...result.paths);
  }

  const cloudbuildPath = path.join(projectDir, 'cloudbuild.yaml');
  if (fs.existsSync(cloudbuildPath)) {
    artifacts.push('cloudbuild.yaml');
    coveredPaths.push(...parseCloudBuild(cloudbuildPath));
  }

  const workflowDir = path.join(projectDir, '.github', 'workflows');
  if (fs.existsSync(workflowDir)) {
    const wfPaths = parseWorkflows(workflowDir);
    if (wfPaths.length > 0) {
      artifacts.push('.github/workflows');
      coveredPaths.push(...wfPaths);
    }
  }

  return { artifacts, coversAll, coveredPaths };
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Check whether every new top-level path in the milestone commit range is
 * referenced by at least one CI build artifact.
 *
 * @param {object} opts
 * @param {string}  opts.projectDir   - project root (required)
 * @param {string}  [opts.baseRef]    - git base ref (default HEAD~1)
 * @param {string}  [opts.headRef]    - git head ref (default HEAD)
 * @param {string[]} [opts._newPaths] - override diff enumeration (test seam)
 * @returns {{ ok: boolean, missing: string[], checkedAgainst: string[], newPaths: string[], note?: string }}
 */
function checkBuildCoverage({ projectDir, baseRef, headRef, _newPaths }) {
  // Resolve refs (throws UsageError for bad state — caller handles)
  const { base, head } = resolveRefs(projectDir, baseRef, headRef);

  // Enumerate new top-level paths
  let newPaths;
  if (_newPaths !== undefined) {
    // Test seam: caller supplies the diff list directly
    newPaths = collapseToTopLevel(_newPaths);
  } else {
    const changedFiles = gitDiffNames(projectDir, base, head);
    newPaths = collapseToTopLevel(changedFiles);
  }

  // Empty diff — nothing to check
  if (newPaths.length === 0) {
    return { ok: true, missing: [], checkedAgainst: [], newPaths: [], note: 'empty diff' };
  }

  // Detect CI artifacts
  const { artifacts, coversAll, coveredPaths } = detectCIArtifacts(projectDir);

  // No CI artifacts — not a failure (nothing to be inconsistent with)
  if (artifacts.length === 0) {
    return {
      ok: true,
      missing: [],
      checkedAgainst: [],
      newPaths,
      note: 'no CI artifacts detected',
    };
  }

  // COPY . . covers everything
  if (coversAll) {
    return { ok: true, missing: [], checkedAgainst: artifacts, newPaths };
  }

  // Check which new paths are not referenced
  const coveredSet = new Set(coveredPaths);
  const missing = newPaths.filter(p => !coveredSet.has(p));

  return {
    ok: missing.length === 0,
    missing,
    checkedAgainst: artifacts,
    newPaths,
  };
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

function parseArgv(argv) {
  const opts = { json: false, base: undefined, head: undefined, projectDir: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--base') opts.base = argv[++i];
    else if (a === '--head') opts.head = argv[++i];
    else if (a === '--project-dir') opts.projectDir = argv[++i];
    else if (a === '-h' || a === '--help') {
      process.stdout.write([
        'Usage: gsd-t build-coverage [--json] [--base REF] [--head REF] [--project-dir PATH]',
        '',
        'Exit codes:',
        '  0  ok:true — all new top-level paths covered, or no CI artifacts found.',
        '  4  ok:false — ≥1 new top-level path not covered by any CI artifact.',
        '  2  usage error (bad refs, not a git repo).',
        '',
      ].join('\n'));
      process.exit(0);
    }
  }
  return opts;
}

if (require.main === module) {
  const opts = parseArgv(process.argv.slice(2));
  let result;
  try {
    result = checkBuildCoverage({
      projectDir: opts.projectDir,
      baseRef: opts.base,
      headRef: opts.head,
    });
  } catch (e) {
    if (e && e.name === 'UsageError') {
      process.stderr.write(`build-coverage: ${e.message}\n`);
      process.exit(2);
    }
    // Any other error (e.g., git not found, bad ref) — treat as usage error
    process.stderr.write(`build-coverage: ${e && e.message ? e.message : String(e)}\n`);
    process.exit(2);
  }

  if (opts.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    if (result.ok) {
      const note = result.note ? ` (${result.note})` : '';
      process.stdout.write(`OK: all new top-level paths covered${note}\n`);
    } else {
      process.stdout.write(`FAIL: uncovered paths: ${result.missing.join(', ')}\n`);
    }
  }

  process.exit(result.ok ? 0 : 4);
}

module.exports = { checkBuildCoverage };
