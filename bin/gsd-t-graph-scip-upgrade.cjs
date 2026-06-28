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
function runScipTypescript(projectRoot, outPath) {
  // M95: emit to a REAL file (outPath) so the index can be READ and call edges
  // resolved — not /dev/null. The old /dev/null path only proved invocability.
  const out = outPath || path.join(projectRoot, '.gsd-t', 'index.scip');
  // --infer-tsconfig: resolve a tsconfig even when one isn't at the repo root
  // (monorepos / nested layouts — e.g. web/tsconfig.json). Without it, projects
  // whose tsconfig lives in a subdir got 0 resolved call edges. [RULE] scip-infer-nested-tsconfig
  const scip = spawnSync('scip-typescript', ['index', '--infer-tsconfig', '--output', out, '.'], {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: 180_000,
  });
  if (scip.status === 0) return { ok: true, scipPath: out };
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

// ── Repo-level SCIP resolver (M95) ────────────────────────────────────────────

/**
 * Build a repo-wide SCIP resolver ONCE: run scip-typescript over the whole repo,
 * read the emitted index.scip, and return the resolution maps + a per-file
 * call-edge resolver. This is the object passed as `scip` into parse_and_put so
 * each file resolves its UNRESOLVED# call targets against real cross-file data.
 *
 * Running SCIP once per repo (not once per file) is the correctness AND
 * performance fix — the old per-file run re-indexed the whole repo for every
 * file and never read the output.
 *
 * @param {string} repoRoot
 * @param {{ languages?: { typescript?: bool, python?: bool } }} [opts]
 * @returns {{ ok: bool, reason?: string, scipPath?: string,
 *             resolveFileEdges: (relPath, edges) => { edges, resolved: number } }}
 */
function buildScipResolver(repoRoot, opts = {}) {
  const { readScipIndex } = require('./gsd-t-scip-reader.cjs');
  const avail = detectScip();

  // Phase-1 of M95: TypeScript/JavaScript only (scip-typescript). Python is a
  // sequenced follow-on. If TS SCIP is absent, the resolver is a no-op (floor).
  if (!avail.typescript) {
    return { ok: false, reason: 'scip-typescript-absent', resolveFileEdges: passthroughResolver };
  }

  const scipPath = path.join(repoRoot, '.gsd-t', 'index.scip');
  let run;
  try {
    run = runScipTypescript(repoRoot, scipPath);
  } catch (e) {
    return { ok: false, reason: `scip-run-threw: ${e.message}`, resolveFileEdges: passthroughResolver };
  }
  if (!run || !run.ok) {
    return { ok: false, reason: run ? run.error : 'scip-run-failed', resolveFileEdges: passthroughResolver };
  }

  const read = readScipIndex(run.scipPath);
  if (!read.ok) {
    return { ok: false, reason: read.reason, resolveFileEdges: passthroughResolver };
  }

  // Build a fast per-file callee lookup: for a given test/impl file, the set of
  // funcIds it references (resolved). Used to rewrite UNRESOLVED# call edges.
  const fileRefs = read.fileRefs; // relPath → [{symbol, funcId, line}]

  /**
   * Resolve a single file's call edges. For each CALL edge whose dst is
   * UNRESOLVED#<name>, if SCIP found a reference to <name> in this file that
   * resolves to a real funcId, rewrite dst to that funcId.
   */
  function resolveFileEdges(relPath, edges) {
    const refs = fileRefs.get(relPath);
    if (!refs || !refs.length) return { edges, resolved: 0 };

    // name → resolved funcId (last writer wins; SCIP refs in this file)
    const nameToFuncId = new Map();
    for (const r of refs) {
      const name = r.funcId.includes('#') ? r.funcId.split('#')[1] : r.funcId;
      nameToFuncId.set(name, r.funcId);
    }

    let resolved = 0;
    const out = edges.map((edge) => {
      const dst = edge.target || edge.dst || '';
      const kind = edge.kind;
      const isCall = kind === 'call-site' || kind === 'CALL';
      if (!isCall || !dst.startsWith('UNRESOLVED#')) return edge;
      const calleeName = dst.slice('UNRESOLVED#'.length);
      const funcId = nameToFuncId.get(calleeName);
      if (!funcId) return edge; // still unresolved → stays floor
      resolved++;
      // rewrite dst to the resolved funcId, mark scip-derived
      return { ...edge, target: funcId, dst: funcId, scipResolved: true };
    });
    return { edges: out, resolved };
  }

  return { ok: true, scipPath: run.scipPath, resolveFileEdges };
}

/** No-op resolver used when SCIP is unavailable (floor mode). */
function passthroughResolver(relPath, edges) {
  return { edges, resolved: 0 };
}

// ── Main upgrade function ─────────────────────────────────────────────────────

/**
 * Try to upgrade a file's entities + edges to compiler-accurate tier via SCIP.
 *
 * M95: "upgrade" now RESOLVES call edges from real SCIP output. A file is labeled
 * compiler-accurate only when SCIP data was actually applied (resolver present);
 * edges that stay UNRESOLVED keep floor semantics. Rust cross-crate edges are
 * flagged partial regardless.
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

  // M95: resolve call edges from the REPO-LEVEL SCIP resolver built once by
  // build_index and threaded through options.resolver. We NEVER re-run SCIP per
  // file here (the old per-file run re-indexed the whole repo for every file and
  // discarded the output). If no resolver was provided, we cannot resolve —
  // stay floor (honest), never relabel.
  const resolver = options.resolver || null;
  if (!resolver || typeof resolver.resolveFileEdges !== 'function') {
    const tier = prevTier === 'compiler-accurate'
      ? 'tree-sitter-floor-STALE-SCIP'
      : 'tree-sitter-floor';
    return { upgraded: false, tier, entities, edges };
  }

  // Resolve this file's UNRESOLVED# call edges against the SCIP index.
  const { edges: resolvedEdges, resolved } = resolver.resolveFileEdges(relPath, edges);

  // Rust cross-crate edges stay flagged partial.
  // [RULE] rust-cross-crate-flagged-partial
  const finalEdges = resolvedEdges.map(edge => {
    if (lang === 'rust' && isRustCrossCrateEdge(edge, relPath)) {
      return { ...edge, partial: true };
    }
    return edge;
  });

  // [RULE] scip-tier-honest: label compiler-accurate ONLY when SCIP actually
  // resolved ≥1 edge in this file OR the file has no call edges to resolve (a
  // pure-definition file SCIP indexed cleanly). A file whose calls all stayed
  // UNRESOLVED is NOT compiler-accurate — it's floor.
  const hadCallEdges = edges.some(e => (e.kind === 'call-site' || e.kind === 'CALL'));
  const isAccurate = !hadCallEdges || resolved > 0;
  const tier = isAccurate ? 'compiler-accurate' : 'tree-sitter-floor';

  return {
    upgraded: isAccurate,
    tier,
    entities,
    edges: finalEdges,
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
  buildScipResolver,
  detectScip,
  _resetScipCache,
  isRustCrossCrateEdge,
  EXT_TO_LANG,
};
