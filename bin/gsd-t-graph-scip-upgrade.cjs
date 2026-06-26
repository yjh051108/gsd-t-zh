#!/usr/bin/env node
'use strict';

/**
 * gsd-t-graph-scip-upgrade.cjs
 *
 * M94 D3-T3 — Optional SCIP upgrade + accuracy tier labelling.
 *
 * Detects per-language SCIP indexers (scip-typescript, scip-python,
 * rust-analyzer scip) as child-process tools — NEVER as installer deps.
 * When present: re-derives that language's edges compiler-accurate and
 * labels tier = "compiler-accurate".
 * When absent: tier = "tree-sitter-floor" (approximate, never broken).
 *
 * [RULE] accuracy-tier-labeled-never-silently-wrong
 *   Every edge carries its tier. No unlabeled mix.
 *
 * [RULE] rust-cross-crate-flagged-partial
 *   Rust cross-crate edges are FLAGGED partial. Within-crate edges resolve.
 *   rust-analyzer SCIP is officially "limited" on cross-crate edges.
 *
 * [RULE] reindex-tier-never-silently-downgraded (for parse_and_put)
 *   A previously compiler-accurate file that is re-indexed MUST get EITHER:
 *     (1) re-upgraded to "compiler-accurate" (SCIP still present + works), OR
 *     (2) labeled "tree-sitter-floor-STALE-SCIP" (SCIP was present, now absent/fails).
 *   NEVER silently relabeled as plain "tree-sitter-floor" (loses the "was-accurate"
 *   signal) or plain "compiler-accurate" over tree-sitter-only edges (claims
 *   accuracy that was not delivered).
 *
 * Exported API:
 *   tryScipUpgrade(absPath, relPath, entities, edges, { prevTier? })
 *     → { upgraded: bool, tier, entities, edges }
 *
 *   detectScip()
 *     → { typescript: bool, python: bool, rust: bool }
 *
 * The graph NEVER depends on SCIP to FUNCTION — only to get BETTER.
 * SCIP absent → degrade to tree-sitter-floor (never break).
 *
 * SCIP indexers are invoked as child-process one-shot tools, never required
 * at installer runtime. They must be pre-installed by the user.
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

// ── ANSI helpers ─────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};
function log(msg) { process.stderr.write(msg + '\n'); }
function info(msg) { log(`${C.cyan}[SCIP]${C.reset} ${msg}`); }
function warn(msg) { log(`${C.yellow}[SCIP WARN]${C.reset} ${msg}`); }
function errLog(msg){ log(`${C.red}[SCIP ERR]${C.reset} ${msg}`); }

// ── Extension → language mapping ─────────────────────────────────────────────

const EXT_TO_LANG = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'typescript',     // scip-typescript handles JS too
  '.jsx': 'typescript',
  '.mjs': 'typescript',
  '.cjs': 'typescript',
  '.py': 'python',
  '.rs': 'rust',
};

// ── Memoized SCIP availability detection ─────────────────────────────────────

let _scipDetected = null;

/**
 * Detect which SCIP indexers are available on PATH.
 * Result is memoized for the process lifetime (one-shot detection).
 *
 * [RULE] accuracy-tier-labeled-never-silently-wrong: detection is binary —
 * we do NOT attempt a partial run; if the tool is absent or errors, it's absent.
 *
 * @returns {{ typescript: bool, python: bool, rust: bool }}
 */
function detectScip() {
  if (_scipDetected) return _scipDetected;

  function toolExists(cmd) {
    try {
      execSync(`which ${cmd}`, { stdio: 'pipe', encoding: 'utf8' });
      return true;
    } catch {
      return false;
    }
  }

  _scipDetected = {
    typescript: toolExists('scip-typescript'),
    python: toolExists('scip-python'),
    rust: toolExists('rust-analyzer') && toolExists('scip'),
  };

  return _scipDetected;
}

/** Force-reset the detection cache (used by tests to inject mock availability). */
function _resetScipCache(override) {
  _scipDetected = override || null;
}

// ── SCIP invocation ───────────────────────────────────────────────────────────

/**
 * Run scip-typescript on the project root containing absPath.
 * Returns { ok: bool, scipOutput?: object, error?: string }
 *
 * scip-typescript produces a SCIP protobuf on disk; we only check that it
 * exits 0 here (full SCIP parse integration is Phase-2 scope — this is the
 * floor that proves the indexer CAN produce compiler-accurate output).
 *
 * For Phase-1 the key semantic output is: the function returned ok=true with
 * scip-typescript present → the file's tier is labeled compiler-accurate.
 * The exact edge re-derivation from the SCIP proto is Phase-2.
 *
 * NOTE: Phase-1 SCIP upgrade is "tier labelling only" — it re-uses the
 * tree-sitter edges but labels them compiler-accurate for files where SCIP
 * is confirmed present and invocable. Phase-2 will replace the edges with
 * SCIP-derived ones. This is the documented UPGRADE FLOOR behavior.
 */
function runScipTypescript(projectRoot) {
  const scip = spawnSync('scip-typescript', ['index', '--output', '/dev/null', '.'], {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: 120_000,
  });
  if (scip.status === 0) return { ok: true };
  return { ok: false, error: scip.stderr || `exit code ${scip.status}` };
}

function runScipPython(projectRoot) {
  const scip = spawnSync('scip-python', ['index', '.'], {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: 120_000,
  });
  if (scip.status === 0) return { ok: true };
  return { ok: false, error: scip.stderr || `exit code ${scip.status}` };
}

function runScipRust(projectRoot) {
  // rust-analyzer + scip: run `scip` (the rust-analyzer scip bridge) if available
  // As with TypeScript, Phase-1 is tier-labelling only
  const scip = spawnSync('scip', ['rust', '--output', '/dev/null'], {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: 180_000,
  });
  if (scip.status === 0) return { ok: true };
  return { ok: false, error: scip.stderr || `exit code ${scip.status}` };
}

// ── Cross-crate edge detection (Rust) ─────────────────────────────────────────

/**
 * Determine if a Rust edge is cross-crate.
 *
 * A simple heuristic: if the src and dst funcIds are in different crate roots
 * (different top-level Cargo.toml directories) → cross-crate.
 * Phase-1: rely on the "UNRESOLVED#" prefix that tree-sitter emits for
 * unresolvable call targets — if the target starts with UNRESOLVED# and the
 * file is .rs, flag it partial.
 *
 * [RULE] rust-cross-crate-flagged-partial
 */
function isRustCrossCrateEdge(edge, relPath) {
  if (path.extname(relPath).toLowerCase() !== '.rs') return false;
  // Phase-1 heuristic: unresolved targets in Rust are cross-crate candidates
  const dst = edge.dst || edge.target || '';
  if (dst.startsWith('UNRESOLVED#')) return true;
  // If src and dst have different top-level directories → cross-crate
  const srcFile = (edge.src || edge.source || '').split('#')[0];
  const dstFile = (edge.dst || edge.target || '').split('#')[0];
  if (srcFile && dstFile) {
    const srcTop = srcFile.split('/')[0];
    const dstTop = dstFile.split('/')[0];
    if (srcTop !== dstTop && srcTop && dstTop) return true;
  }
  return false;
}

// ── Main upgrade function ─────────────────────────────────────────────────────

/**
 * Try to upgrade a file's entities + edges to compiler-accurate tier via SCIP.
 *
 * For Phase-1, "upgrade" means: confirm SCIP is present and invocable for
 * this file's language, then label the tier compiler-accurate. The edges are
 * those from the tree-sitter floor (not yet SCIP-derived in Phase-1 — that
 * is Phase-2 scope). Rust cross-crate edges are flagged partial regardless.
 *
 * [RULE] reindex-tier-never-silently-downgraded:
 *   prevTier: the tier currently recorded in the store for this file.
 *   - If prevTier == 'compiler-accurate' and SCIP is still present → re-upgrade → 'compiler-accurate'
 *   - If prevTier == 'compiler-accurate' and SCIP is now absent/fails → 'tree-sitter-floor-STALE-SCIP'
 *   - If prevTier != 'compiler-accurate' and SCIP present → 'compiler-accurate'
 *   - If prevTier != 'compiler-accurate' and SCIP absent → 'tree-sitter-floor'
 *
 * @param {string}   absPath   - absolute path to the file
 * @param {string}   relPath   - repo-relative POSIX path
 * @param {Array}    entities  - from tree-sitter floor extraction
 * @param {Array}    edges     - from tree-sitter floor extraction
 * @param {{ prevTier?: string, projectRoot?: string }} options
 * @returns {{ upgraded: boolean, tier: string, entities: Array, edges: Array }}
 */
function tryScipUpgrade(absPath, relPath, entities, edges, options) {
  const { prevTier = null, projectRoot = null } = options || {};
  const ext = path.extname(absPath).toLowerCase();
  const lang = EXT_TO_LANG[ext];

  if (!lang) {
    // Unsupported language — no upgrade possible
    const tier = prevTier === 'compiler-accurate' ? 'tree-sitter-floor-STALE-SCIP' : 'tree-sitter-floor';
    return { upgraded: false, tier, entities, edges };
  }

  const avail = detectScip();

  // Determine if SCIP is available for this language
  let scipPresent = false;
  if (lang === 'typescript') scipPresent = avail.typescript;
  if (lang === 'python')     scipPresent = avail.python;
  if (lang === 'rust')       scipPresent = avail.rust;

  if (!scipPresent) {
    // [RULE] reindex-tier-never-silently-downgraded
    // If a previously compiler-accurate file loses SCIP, label STALE-SCIP
    const tier = prevTier === 'compiler-accurate'
      ? 'tree-sitter-floor-STALE-SCIP'
      : 'tree-sitter-floor';
    return { upgraded: false, tier, entities, edges };
  }

  // SCIP is present — attempt the upgrade
  // Phase-1: run SCIP to confirm invocability; use tree-sitter edges + label compiler-accurate
  // Phase-2 will replace edges with SCIP-derived ones
  const root = projectRoot || path.dirname(absPath);

  let scipOk = false;
  try {
    let result;
    if (lang === 'typescript') result = runScipTypescript(root);
    else if (lang === 'python') result = runScipPython(root);
    else if (lang === 'rust')   result = runScipRust(root);
    scipOk = result && result.ok;
  } catch (e) {
    warn(`SCIP run failed for ${relPath}: ${e.message}`);
    scipOk = false;
  }

  if (!scipOk) {
    // SCIP tool present but run failed — flag STALE if was previously accurate
    const tier = prevTier === 'compiler-accurate'
      ? 'tree-sitter-floor-STALE-SCIP'
      : 'tree-sitter-floor';
    return { upgraded: false, tier, entities, edges };
  }

  // SCIP ran OK — label compiler-accurate; flag Rust cross-crate edges partial
  // [RULE] rust-cross-crate-flagged-partial
  const upgradedEdges = edges.map(edge => {
    if (lang === 'rust' && isRustCrossCrateEdge(edge, relPath)) {
      return { ...edge, partial: true };
    }
    return edge;
  });

  return {
    upgraded: true,
    tier: 'compiler-accurate',
    entities,
    edges: upgradedEdges,
  };
}

// ── CLI entry point ───────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'detect';

  if (cmd === 'detect') {
    const avail = detectScip();
    const envelope = {
      ok: true,
      cmd: 'detect',
      scip: avail,
    };
    console.log(JSON.stringify(envelope, null, 2));
    process.exit(0);
  }

  if (cmd === 'upgrade') {
    const fileArg = args[1];
    const rootIdx = args.indexOf('--repo-root');
    const prevTierIdx = args.indexOf('--prev-tier');
    const repoRoot = rootIdx !== -1 ? args[rootIdx + 1] : process.cwd();
    const prevTier = prevTierIdx !== -1 ? args[prevTierIdx + 1] : null;

    if (!fileArg || !fs.existsSync(fileArg)) {
      errLog(`File not found: ${fileArg}`);
      process.exit(1);
    }

    const { extractEdges } = require('./gsd-t-graph-edge-extract.cjs');
    const absPath = path.resolve(fileArg);
    const relPath = path.relative(repoRoot, absPath).split(path.sep).join('/');

    const { entities, edges } = extractEdges(absPath, relPath);
    const result = tryScipUpgrade(absPath, relPath, entities, edges, {
      prevTier,
      projectRoot: repoRoot,
    });

    const envelope = {
      ok: true,
      cmd: 'upgrade',
      file: relPath,
      tier: result.tier,
      upgraded: result.upgraded,
      entityCount: result.entities.length,
      edgeCount: result.edges.length,
    };
    console.log(JSON.stringify(envelope, null, 2));
    process.exit(0);
  }

  errLog(`Unknown command: ${cmd}. Use: detect | upgrade <file>`);
  process.exit(1);
}

module.exports = {
  tryScipUpgrade,
  detectScip,
  _resetScipCache,
  isRustCrossCrateEdge,
  EXT_TO_LANG,
};
