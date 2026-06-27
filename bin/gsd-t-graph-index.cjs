#!/usr/bin/env node
'use strict';

/**
 * gsd-t-graph-index.cjs
 *
 * M94 D3-T2 — build_index + store write + per-file parse_and_put surface.
 *
 * Exposes:
 *   build_index(repoRoot, { dbPath?, onProgress? })
 *     Full-repo tree-sitter floor index → SQLite store via streaming writes.
 *     The indexer MUST stream — never load the whole graph into RAM
 *     (see K1 OOM finding in .gsd-t/spikes/k1-store-bakeoff-results.md).
 *
 *   parse_and_put(absPath, relPath, { db, scip? })
 *     Per-file re-index surface that D4 (freshness) and D5 (query-cli re-index)
 *     call. Returns { entities, edges, tier, contentHash }.
 *     [RULE] reindex-tier-never-silently-downgraded: caller must pass the scip
 *     upgrader (or null); this function is deterministic — it does not decide
 *     the tier policy, it calls the tier labeller and records what it returns.
 *
 *   openStore(dbPath)   — open / create the SQLite graph store (better-sqlite3)
 *   closeStore(db)      — close it
 *   putRecord(db, rec)  — write a single file record (streaming-safe)
 *   getRecord(db, file) — read a single file record
 *   buildSchema(db)     — idempotent schema creation (called by openStore)
 *
 * Store: SQLite (better-sqlite3), WAL mode, streaming inserts per K1 invariant.
 * Schema per graph-store-schema-contract.md §Record shape:
 *   nodes table: (id TEXT PK, kind TEXT, tier TEXT, content_hash TEXT, file TEXT, name TEXT, func_id TEXT)
 *   edges table: (kind TEXT, src TEXT, dst TEXT, partial INTEGER)
 *   files table: (file TEXT PK, content_hash TEXT, tier TEXT, indexed_at TEXT)
 *
 * [RULE] accuracy-tier-labeled-never-silently-wrong
 * [RULE] rust-cross-crate-flagged-partial
 * [RULE] who-calls-function-identity-disambiguated (via edge-extract)
 * [RULE] wave1-hard-gate-blocks-build (gate assumed cleared — K1=PICK/SQLite, K2=PASS)
 *
 * CLI usage:
 *   node bin/gsd-t-graph-index.cjs build [--repo <path>] [--db <path>]
 *   Emits JSON envelope on stdout, ANSI on stderr, exit 0=ok / 1=error.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// ── ANSI helpers ─────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};
function log(msg) { process.stderr.write(msg + '\n'); }
function info(msg)  { log(`${C.cyan}[IDX]${C.reset} ${msg}`); }
function good(msg)  { log(`${C.green}[IDX OK]${C.reset} ${msg}`); }
function warn(msg)  { log(`${C.yellow}[IDX WARN]${C.reset} ${msg}`); }
function errLog(msg){ log(`${C.red}[IDX ERR]${C.reset} ${msg}`); }

// ── Source-file extensions + skip dirs (matches D2 / K2 probe) ───────────────

const PARSED_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py']);
const SKIP_DIRS = new Set([
  'node_modules', '.next', 'dist', 'build', '.git',
  '.cache', '__pycache__', 'coverage', '.nyc_output',
  'out', '.turbo',
]);

// ── Content hash ──────────────────────────────────────────────────────────────

/**
 * [RULE] freshness-content-hash-not-git-sha: dirty-detection hashes file CONTENT.
 */
function contentHash(absPath) {
  const data = fs.readFileSync(absPath);
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
}

// ── File enumeration ──────────────────────────────────────────────────────────

function enumerateFiles(root) {
  const results = [];
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name));
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (PARSED_EXTS.has(ext)) {
          const absPath = path.join(dir, e.name);
          const relPath = path.relative(root, absPath).split(path.sep).join('/');
          results.push({ absPath, relPath, ext });
        }
      }
    }
  }
  walk(root);
  return results;
}

// ── SQLite store ──────────────────────────────────────────────────────────────

/**
 * Open (or create) the SQLite graph store.
 * Returns a better-sqlite3 Database instance.
 */
function openStore(dbPath) {
  const Database = require('better-sqlite3');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  buildSchema(db);
  return db;
}

function closeStore(db) {
  if (db && db.open) db.close();
}

/**
 * Idempotent schema creation.
 *
 * Schema per graph-store-schema-contract.md §Record shape.
 *
 * files:  one row per source file, carries the file-level tier + content_hash
 * nodes:  entity nodes (funcId-keyed functions/classes/exports)
 * edges:  import/require/call-site edges; partial flag for Rust cross-crate
 */
function buildSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      file         TEXT PRIMARY KEY,
      content_hash TEXT NOT NULL,
      tier         TEXT NOT NULL,
      indexed_at   TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS nodes (
      id           TEXT PRIMARY KEY,
      kind         TEXT NOT NULL,
      tier         TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      file         TEXT NOT NULL,
      name         TEXT,
      func_id      TEXT
    );
    CREATE TABLE IF NOT EXISTS edges (
      kind    TEXT    NOT NULL,
      src     TEXT    NOT NULL,
      dst     TEXT    NOT NULL,
      partial INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS edges_dst       ON edges(dst);
    CREATE INDEX IF NOT EXISTS edges_src_kind  ON edges(src, kind);
    CREATE INDEX IF NOT EXISTS edges_kind_dst  ON edges(kind, dst);
    CREATE INDEX IF NOT EXISTS nodes_file      ON nodes(file);
  `);
}

/**
 * Write a single file record to the store (streaming-safe — called per-file).
 *
 * Deletes old nodes/edges for this file first, then inserts the new set.
 * WAL mode ensures atomic visibility (no torn reads during write).
 *
 * @param {object} db        - better-sqlite3 Database
 * @param {{ file, contentHash, entities, edges, tier }} rec
 */
/**
 * Prepare (once) and cache the per-file write statements on the db handle.
 * better-sqlite3 statement preparation is expensive; re-preparing all 6
 * statements on EVERY file (putRecord is called per-file across thousands of
 * files) was the dominant cost — a full Atos index took 61 min almost entirely
 * here. Preparing once and reusing drops it to seconds. The cache is keyed on
 * the db handle so a fresh db re-prepares correctly.
 */
function getWriteStmts(db) {
  if (db.__m94WriteStmts) return db.__m94WriteStmts;
  const stmts = {
    deleteNodes: db.prepare('DELETE FROM nodes WHERE file = ?'),
    deleteEdgesSrc: db.prepare("DELETE FROM edges WHERE src = ? OR src LIKE ? OR src = ?"),
    insFile: db.prepare('INSERT OR REPLACE INTO files (file, content_hash, tier, indexed_at) VALUES (?, ?, ?, ?)'),
    insNode: db.prepare('INSERT OR REPLACE INTO nodes (id, kind, tier, content_hash, file, name, func_id) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    insEdge: db.prepare('INSERT INTO edges (kind, src, dst, partial) VALUES (?, ?, ?, ?)'),
  };
  // db.transaction() wrapper is also created once (it closes over the stmts).
  stmts.doWrite = db.transaction((rec) => {
    const { file, contentHash: hash, entities, edges, tier, now } = rec;
    stmts.deleteNodes.run(file);
    stmts.deleteEdgesSrc.run(file, `${file}#%`, file);
    stmts.insFile.run(file, hash, tier, now);
    for (const entity of entities) {
      stmts.insNode.run(entity.id, entity.type || 'function', tier, hash, file, entity.name || null, entity.id);
    }
    for (const edge of edges) {
      stmts.insEdge.run(edge.kind, edge.src, edge.dst, edge.partial ? 1 : 0);
    }
  });
  Object.defineProperty(db, '__m94WriteStmts', { value: stmts, enumerable: false });
  return stmts;
}

function putRecord(db, rec) {
  const { file, contentHash: hash, entities, edges, tier } = rec;
  const now = new Date().toISOString();
  // Prepared-statement bundle is created ONCE per db handle (see getWriteStmts).
  getWriteStmts(db).doWrite({ file, contentHash: hash, entities, edges, tier, now });
}

/**
 * Read a single file's record from the store.
 * Returns { file, contentHash, tier, indexedAt } or null if not found.
 */
function getRecord(db, file) {
  const row = db.prepare('SELECT * FROM files WHERE file = ?').get(file);
  if (!row) return null;
  return {
    file: row.file,
    contentHash: row.content_hash,
    tier: row.tier,
    indexedAt: row.indexed_at,
  };
}

// ── Per-file parse + put (the surface D4/D5 call) ────────────────────────────

/**
 * Parse a single file and write it to the store.
 *
 * This is the per-file re-index surface that D4 (freshness) and D5 (query-cli)
 * call when a file is stale or needs inline re-indexing.
 *
 * [RULE] reindex-tier-never-silently-downgraded: the scip upgrader (or null)
 * is passed by the caller; this function is deterministic — it applies the
 * tier policy that the upgrader declares and records it faithfully.
 *
 * @param {string} absPath         - absolute path to the file
 * @param {string} relPath         - repo-relative POSIX path
 * @param {{ db: Database, scip?: object, existingTier?: string }} options
 * @returns {{ entities, edges, tier, contentHash }}
 */
function parse_and_put(absPath, relPath, options) {
  const { db, scip = null, existingTier = null } = options || {};

  const { extractEdges } = require('./gsd-t-graph-edge-extract.cjs');
  const { tryScipUpgrade } = scip || {};

  // Extract via tree-sitter floor
  const { entities, edges, loc } = extractEdges(absPath, relPath);
  const hash = contentHash(absPath);

  let finalEntities = entities;
  let finalEdges = edges;
  let tier = 'tree-sitter-floor';

  // Optional SCIP upgrade
  // [RULE] reindex-tier-never-silently-downgraded: pass existingTier as prevTier so
  // the upgrader can produce 'tree-sitter-floor-STALE-SCIP' instead of plain floor
  // when a previously compiler-accurate file loses its SCIP indexer.
  if (typeof tryScipUpgrade === 'function') {
    const upgraded = tryScipUpgrade(absPath, relPath, entities, edges, {
      prevTier: existingTier,
      projectRoot: scip.projectRoot || require('path').dirname(absPath),
      resolver: scip.resolver || null,
    });
    if (upgraded) {
      // ALWAYS use the tier returned by the upgrader — it encodes the full
      // tier-preservation logic including STALE-SCIP (even when upgraded=false)
      tier = upgraded.tier;
      finalEntities = upgraded.entities;
      finalEdges = upgraded.edges;
    }
  }

  // Normalize edges to store schema (map from parser-floor shape to store shape)
  const storeEdges = finalEdges.map(edge => {
    if (edge.kind === 'import' || edge.kind === 'require') {
      return {
        kind: 'IMPORT',
        src: edge.source || edge.src,
        dst: edge.target || edge.dst,
        partial: 0,
      };
    }
    if (edge.kind === 'call-site') {
      return {
        kind: 'CALL',
        src: edge.source || edge.src,
        dst: edge.target || edge.dst,
        partial: edge.partial ? 1 : 0,
      };
    }
    // passthrough
    return {
      kind: edge.kind,
      src: edge.source || edge.src,
      dst: edge.target || edge.dst,
      partial: edge.partial ? 1 : 0,
    };
  });

  // Normalize entities to store schema
  const storeEntities = finalEntities.map(e => ({
    id: e.id,
    type: e.type,
    name: e.name,
    file: relPath,
    exported: e.exported,
    parentClass: e.parentClass,
  }));

  if (db) {
    putRecord(db, {
      file: relPath,
      contentHash: hash,
      entities: storeEntities,
      edges: storeEdges,
      tier,
    });
  }

  return { entities: storeEntities, edges: storeEdges, tier, contentHash: hash, loc };
}

// ── build_index (full-repo) ───────────────────────────────────────────────────

/**
 * Full-repo index build.
 *
 * Streams per-file: enumerate → parse → store.put (never loads all in RAM).
 * Calls the SCIP upgrader if present (per-language tier upgrade).
 *
 * @param {string} repoRoot       - absolute path to the repo root
 * @param {{ dbPath?, scip?, onProgress? }} options
 * @returns {{ fileCount, entityCount, edgeCount, tier: { floor, upgraded }, durationMs }}
 */
function build_index(repoRoot, options) {
  const {
    dbPath = path.join(repoRoot, '.gsd-t', 'graph.db'),
    scip = null,
    onProgress = null,
  } = options || {};

  // Ensure the parent directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = openStore(dbPath);
  const files = enumerateFiles(repoRoot);

  // M95: build the repo-level SCIP resolver ONCE (run scip-typescript over the
  // whole repo, read index.scip, build the symbol→funcId resolution maps). Each
  // file's parse_and_put then resolves its call edges against this shared map.
  // If the caller passed a `scip` object explicitly (tests inject mocks), respect
  // it; otherwise auto-build from the upgrader.
  let scipCtx = scip;
  if (!scipCtx) {
    const upg = require('./gsd-t-graph-scip-upgrade.cjs');
    const resolver = upg.buildScipResolver(repoRoot);
    scipCtx = {
      tryScipUpgrade: upg.tryScipUpgrade,
      resolver: resolver.ok ? resolver : null,
      projectRoot: repoRoot,
    };
    if (resolver.ok) {
      info(`SCIP resolver active (${resolver.scipPath}) — call edges will be resolved compiler-accurate.`);
    } else {
      info(`SCIP resolver unavailable (${resolver.reason}) — tree-sitter floor (approximate). Install scip-typescript for compiler-accurate call edges.`);
    }
  }

  const t0 = Date.now();
  let fileCount = 0;
  let entityCount = 0;
  let edgeCount = 0;
  let tierFloor = 0;
  let tierUpgraded = 0;
  let errors = 0;
  const skippedFiles = [];

  // Stream: parse + put each file one at a time (never accumulate the full set)
  for (const { absPath, relPath } of files) {
    try {
      const result = parse_and_put(absPath, relPath, { db, scip: scipCtx });
      fileCount++;
      entityCount += result.entities.length;
      edgeCount += result.edges.length;
      if (result.tier === 'compiler-accurate') tierUpgraded++;
      else tierFloor++;
      if (typeof onProgress === 'function') {
        onProgress({ file: relPath, tier: result.tier, fileCount, total: files.length });
      }
    } catch (err) {
      errors++;
      skippedFiles.push({ file: relPath, reason: err.message });
      warn(`Failed to index ${relPath}: ${err.message}`);
    }
  }

  // Record the skipped set + parse-success-rate so a query whose edges live in a
  // skipped file can return a coverage flag ('result may be incomplete — N files
  // unparsed') instead of a bare empty set that reads as authoritative truth.
  // A silently-missing edge is a WRONG answer (the no-wrong invariant).
  const totalEnumerated = files.length;
  const parseSuccessRate = totalEnumerated > 0 ? (totalEnumerated - errors) / totalEnumerated : 1;
  const PARSE_RATE_FLOOR = 0.95;
  const knownLimitation = parseSuccessRate < PARSE_RATE_FLOOR
    ? `parse-success-rate ${(parseSuccessRate * 100).toFixed(1)}% is below the ${PARSE_RATE_FLOOR * 100}% floor — ${errors} of ${totalEnumerated} files unparsed; queries touching those files surface a coverage-incomplete flag`
    : null;
  // Persist the skipped set into the store so queries can consult it (best-effort;
  // a meta table keyed by file).
  try {
    const meta = openStore(dbPath);
    meta.exec('CREATE TABLE IF NOT EXISTS skipped_files (file TEXT PRIMARY KEY, reason TEXT)');
    const insSkip = meta.prepare('INSERT OR REPLACE INTO skipped_files (file, reason) VALUES (?, ?)');
    const tx = meta.transaction((rows) => { for (const r of rows) insSkip.run(r.file, r.reason); });
    tx(skippedFiles);
    closeStore(meta);
  } catch { /* meta is best-effort; the result envelope still carries the set */ }

  closeStore(db);

  const durationMs = Date.now() - t0;

  // R4-2 honesty: SCIP is an OPTIONAL accuracy upgrade. When no SCIP indexer was
  // provided/available, EVERY file stays tree-sitter-floor (approximate edges) —
  // that is correct (the graph never depends on SCIP to function), but it must be
  // SURFACED LOUDLY, never a silent 0-upgrade that reads like full accuracy.
  // SCIP is active when the resolver built successfully (auto-built or injected).
  const scipActive = !!(scipCtx && scipCtx.resolver && scipCtx.resolver.ok);
  let scipNotice = null;
  if (!scipActive && tierUpgraded === 0) {
    scipNotice =
      'SCIP indexer not available — all edges are tree-sitter-floor (approximate, not compiler-accurate). ' +
      'This is a working graph; for compiler-accurate TS/JS/Python edges, install a SCIP indexer ' +
      '(e.g. scip-typescript) and re-index. The graph never requires SCIP to function.';
    console.error(`\x1b[33m[IDX NOTICE]\x1b[0m ${scipNotice}`);
  }

  return {
    fileCount,
    entityCount,
    edgeCount,
    tier: { floor: tierFloor, upgraded: tierUpgraded },
    scipAvailable: scipActive,
    scipNotice,
    errors,
    skippedFiles,
    parseSuccessRate,
    knownLimitation,
    durationMs,
    dbPath,
  };
}

// ── CLI entry point ───────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'build';

  if (cmd !== 'build') {
    errLog(`Unknown command: ${cmd}. Use: build`);
    process.exit(1);
  }

  const repoIdx = args.indexOf('--repo');
  const dbIdx = args.indexOf('--db');
  const repoRoot = repoIdx !== -1 ? args[repoIdx + 1] : process.cwd();
  const dbPath = dbIdx !== -1 ? args[dbIdx + 1] : path.join(repoRoot, '.gsd-t', 'graph.db');

  if (!fs.existsSync(repoRoot)) {
    errLog(`Repo root not found: ${repoRoot}`);
    process.exit(1);
  }

  info(`build_index — repo: ${repoRoot}`);
  info(`Store: ${dbPath}`);

  // Load SCIP upgrader if available
  let scip = null;
  try {
    scip = require('./gsd-t-graph-scip-upgrade.cjs');
  } catch {
    warn('SCIP upgrader not found — using tree-sitter-floor only');
  }

  const result = build_index(repoRoot, {
    dbPath,
    scip,
    onProgress: ({ file, tier, fileCount, total }) => {
      if (fileCount % 100 === 0) {
        info(`[${fileCount}/${total}] ${tier === 'compiler-accurate' ? C.green : C.dim}${file}${C.reset}`);
      }
    },
  });

  good(`Indexed ${result.fileCount} files, ${result.entityCount} entities, ${result.edgeCount} edges in ${result.durationMs}ms`);
  good(`Tiers — floor: ${result.tier.floor}, compiler-accurate: ${result.tier.upgraded}`);
  if (result.errors > 0) warn(`${result.errors} files had parse errors (skipped)`);

  const envelope = {
    ok: true,
    cmd: 'build',
    repoRoot,
    dbPath: result.dbPath,
    fileCount: result.fileCount,
    entityCount: result.entityCount,
    edgeCount: result.edgeCount,
    tier: result.tier,
    errors: result.errors,
    durationMs: result.durationMs,
  };
  console.log(JSON.stringify(envelope, null, 2));
  process.exit(0);
}

module.exports = {
  build_index,
  parse_and_put,
  openStore,
  closeStore,
  buildSchema,
  putRecord,
  getRecord,
  contentHash,
  enumerateFiles,
  PARSED_EXTS,
  SKIP_DIRS,
};
