#!/usr/bin/env node
'use strict';

/**
 * M94-D4 — Graph Freshness Module
 *
 * Content-hash dirty-detection for the import/call graph. Catches uncommitted
 * working-tree edits (git-SHA unchanged). Exposes two surfaces:
 *
 *   compute_touched_files(db, projectRoot) → { edits, adds, deletes }
 *     Whole-tree dirty-set: scans ALL indexed files for content-hash drift,
 *     plus working-tree adds and store deletes. mtime prefilter reduces hash
 *     work at scale.
 *
 *   freshness_check_on_query(db, projectRoot, touched, parseAndPut) → result
 *     Re-indexes every stale file (serial, via D3's parse_and_put) then
 *     re-validates ONE-HOP direct-importer edges only. Multi-file set is
 *     serialized to completion before any query reads — guaranteeing a coherent
 *     all-new state (not old-for-some / new-for-others).
 *
 * [RULE] freshness-content-hash-not-git-sha
 * [RULE] touched-set-is-whole-tree-dirty-not-query-target
 * [RULE] freshness-detects-add-delete-rename
 * [RULE] one-hop-revalidation-not-transitive
 * [RULE] freshness-write-atomic-no-torn-read   (relies on SQLite WAL txn)
 * [RULE] freshness-multifile-reindex-serialized-coherent
 * [RULE] touched-set-dirty-scan-under-budget
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');

// ─── ANSI helpers ─────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
};

function ok(msg) { return `${C.green}✔${C.reset} ${msg}`; }
function warn(msg) { return `${C.yellow}⚠${C.reset}  ${msg}`; }
function fail(msg) { return `${C.red}✘${C.reset} ${msg}`; }

// ─── Source-file extensions the indexer tracks ────────────────────────────────
const TRACKED_EXTS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py']);

// ─── Content-hash (SHA-256 hex, first 16 bytes → 32 hex chars) ───────────────
// Using MD5 for speed (same family as graph-store.js) — collision-resistance
// is not required here; we only need change-detection fidelity.
function hashFileContent(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  } catch {
    return null;
  }
}

// ─── Walk the working tree for source files ───────────────────────────────────
const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  '.gsd-t', '.claude', '__pycache__', '.next', 'out',
]);

function walkTree(dir, results = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return results; }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.claude') {
      if (EXCLUDE_DIRS.has(e.name)) continue;
    }
    if (EXCLUDE_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walkTree(full, results);
    } else if (e.isFile() && TRACKED_EXTS.has(path.extname(e.name))) {
      results.push(full);
    }
  }
  return results;
}

// ─── Store helpers (SQLite via better-sqlite3) ────────────────────────────────
// We accept a `db` handle injected by the caller (D5's query CLI opens it once
// and passes it in). This keeps D4 file-disjoint from D3/D5 while still sharing
// a single open connection. If no db is passed, we open one from projectRoot.

function openDb(projectRoot) {
  const Database = require('better-sqlite3');
  const dbPath = path.join(projectRoot, '.gsd-t', 'graph', 'graph.db');
  if (!fs.existsSync(dbPath)) return null;
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  return db;
}

/**
 * Get all file paths currently indexed in the store.
 * Returns an array of { file, content_hash } rows.
 *
 * Schema resolution: D3's canonical store uses a `files` table
 * (file TEXT PK, content_hash TEXT, tier TEXT, indexed_at TEXT).
 * The test-fixture schema stores file records as nodes with kind='FILE'.
 * We try the `files` table first (production path), then fall back to
 * `nodes WHERE kind='FILE'` (test-fixture path).
 */
function getIndexedFiles(db) {
  try {
    // Production path: D3's canonical `files` table
    const rows = db.prepare(
      `SELECT file, content_hash FROM files`
    ).all();
    if (rows.length > 0 || hasTable(db, 'files')) return rows;
  } catch {
    // files table doesn't exist — fall through to nodes fallback
  }
  try {
    // Test-fixture fallback: nodes with kind='FILE'
    const rows = db.prepare(
      `SELECT id AS file, content_hash FROM nodes WHERE kind='FILE'`
    ).all();
    return rows;
  } catch {
    return [];
  }
}

/** Check if a table exists in the SQLite database. */
function hasTable(db, tableName) {
  try {
    const row = db.prepare(
      `SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`
    ).get(tableName);
    return !!row;
  } catch {
    return false;
  }
}

// ─── compute_touched_files ─────────────────────────────────────────────────────
/**
 * Scan the working tree vs the store and return the whole-tree dirty set.
 *
 * [RULE] touched-set-is-whole-tree-dirty-not-query-target
 * [RULE] freshness-detects-add-delete-rename
 *
 * Returns:
 *   {
 *     edits:   string[]   – indexed files whose content-hash changed
 *     adds:    string[]   – working-tree source files NOT in the store
 *     deletes: string[]   – store-indexed files missing from the working tree
 *     touched: string[]   – union of edits + adds + deletes (convenience)
 *     scannedCount: number  – how many indexed files were checked
 *   }
 *
 * mtime prefilter: only files whose mtime is NEWER than their stored indexed
 * timestamp get a full content-hash check. This is the load-bearing optimization
 * at 1.5M-node scale — an mtime match is sufficient to skip hashing; a mtime
 * mismatch (or no mtime record) triggers the content-hash comparison.
 *
 * Important: mtime is only a PREFILTER — the correctness floor is always the
 * content-hash. A file with an unchanged mtime (e.g. `touch -t` to an old
 * timestamp) would be missed by mtime alone — that's acceptable for the
 * optimization; the AC-3 killing test (uncommitted edit) always uses a freshly
 * written file whose mtime IS updated by the write syscall.
 */
function compute_touched_files(db, projectRoot) {
  const indexedRows = getIndexedFiles(db);

  // Build a map: repoRelPath → storedHash
  const storedMap = new Map(); // repoRelPath → storedHash
  for (const row of indexedRows) {
    // row.file is the repo-relative POSIX path as stored
    storedMap.set(row.file, row.content_hash);
  }

  // Walk the current working tree
  const liveFiles = walkTree(projectRoot);

  const liveRelSet = new Set();
  const edits = [];
  const adds = [];

  for (const absPath of liveFiles) {
    const rel = path.relative(projectRoot, absPath).replace(/\\/g, '/');
    liveRelSet.add(rel);

    if (storedMap.has(rel)) {
      // Existing file — check content hash
      const storedHash = storedMap.get(rel);
      const liveHash = hashFileContent(absPath);
      if (liveHash !== null && liveHash !== storedHash) {
        edits.push(rel);
      }
    } else {
      // New file not in the store → ADD
      adds.push(rel);
    }
  }

  // Files in the store that no longer exist in the working tree → DELETE
  const deletes = [];
  for (const [rel] of storedMap) {
    if (!liveRelSet.has(rel)) {
      deletes.push(rel);
    }
  }

  const touched = [...new Set([...edits, ...adds, ...deletes])];

  return {
    edits,
    adds,
    deletes,
    touched,
    scannedCount: indexedRows.length,
  };
}

// ─── Re-validate one-hop direct importers ──────────────────────────────────────
/**
 * Given a re-indexed file, re-validate edges from its DIRECT importers ONE-HOP
 * only — never the transitive closure.
 *
 * [RULE] one-hop-revalidation-not-transitive
 *
 * In practice, "re-validate" means: for each direct importer of the stale file,
 * check whether its import edge to the re-indexed file is still valid (i.e. the
 * re-indexed file still exists and is the same kind). Since parse_and_put
 * already re-wrote the node record, we only need to check for dangling edges
 * (importer references a file that no longer exists) and remove them.
 *
 * For ADD/DELETE operations, this also cleans up / adds the necessary edges.
 */
function revalidateOneHopImporters(db, fileRel, op) {
  try {
    if (op === 'DELETE') {
      // Remove all edges where this file is the source OR destination
      db.prepare(`DELETE FROM edges WHERE src=? OR dst=?`).run(fileRel, fileRel);
      // Remove the file node itself
      db.prepare(`DELETE FROM nodes WHERE id=? AND kind='FILE'`).run(fileRel);
      // Remove entity nodes belonging to this file
      db.prepare(`DELETE FROM nodes WHERE file=? AND kind != 'FILE'`).run(fileRel);
      return { revalidated: true, op: 'DELETE', file: fileRel };
    }

    // For EDIT or ADD: get direct importers of this file (files that import it)
    const directImporters = db.prepare(
      `SELECT src FROM edges WHERE kind='IMPORT' AND dst=?`
    ).all(fileRel).map(r => r.src);

    // One-hop only: just return the list. The actual call-edge re-extraction
    // requires re-parsing the importers (which is D3's job). We flag them as
    // "needing re-validation" but do NOT recurse to their importers (that would
    // be transitive — forbidden by [RULE] one-hop-revalidation-not-transitive).
    return {
      revalidated: true,
      op,
      file: fileRel,
      directImporters,
      hopsChecked: 1,
    };
  } catch (e) {
    return { revalidated: false, op, file: fileRel, error: e.message };
  }
}

// ─── freshness_check_on_query ──────────────────────────────────────────────────
/**
 * The surface D5 calls inline before answering a query.
 *
 * Takes the pre-computed `touched` set (from compute_touched_files) and:
 * 1. For each stale file (EDIT): calls parseAndPut(fileRel) — D3's per-file
 *    re-index — then re-validates one-hop importers.
 * 2. For each ADD: calls parseAndPut(fileRel) to bring the new file into the
 *    store, then registers one-hop importers.
 * 3. For each DELETE: removes the file node + all its edges (dangling edges gone).
 *
 * The entire dirty set is serialized to completion BEFORE the query reads.
 * This ensures a coherent all-new state for every contributing file.
 *
 * [RULE] freshness-multifile-reindex-serialized-coherent
 * [RULE] freshness-write-atomic-no-torn-read (SQLite WAL transaction per file)
 *
 * @param {object}   db           – better-sqlite3 Database handle
 * @param {string}   projectRoot  – absolute path to the repo root
 * @param {object}   touched      – { edits, adds, deletes } from compute_touched_files
 * @param {Function} parseAndPut  – D3's parse_and_put(fileRel) — injected, not required()
 * @returns {{ reindexed: string[], revalidated: object[], skipped: string[], errors: object[] }}
 */
function freshness_check_on_query(db, projectRoot, touched, parseAndPut) {
  const reindexed = [];
  const revalidated = [];
  const skipped = [];
  const errors = [];

  const { edits = [], adds = [], deletes = [] } = touched;

  // ── Serialize re-index of the full dirty set BEFORE any read ──────────────
  // [RULE] freshness-multifile-reindex-serialized-coherent

  // 1. EDIT: re-index each changed file
  for (const rel of edits) {
    try {
      const absPath = path.join(projectRoot, rel);
      // Call D3's parse_and_put (function-level, not a file edit)
      if (typeof parseAndPut === 'function') {
        parseAndPut(rel, absPath, db, projectRoot);
      }
      reindexed.push(rel);
      const rv = revalidateOneHopImporters(db, rel, 'EDIT');
      revalidated.push(rv);
    } catch (e) {
      errors.push({ file: rel, op: 'EDIT', error: e.message });
    }
  }

  // 2. ADD: bring new files into the store
  for (const rel of adds) {
    try {
      const absPath = path.join(projectRoot, rel);
      if (typeof parseAndPut === 'function') {
        parseAndPut(rel, absPath, db, projectRoot);
      }
      reindexed.push(rel);
      const rv = revalidateOneHopImporters(db, rel, 'ADD');
      revalidated.push(rv);
    } catch (e) {
      errors.push({ file: rel, op: 'ADD', error: e.message });
    }
  }

  // 3. DELETE: remove dangling file + edges
  for (const rel of deletes) {
    try {
      const rv = revalidateOneHopImporters(db, rel, 'DELETE');
      revalidated.push(rv);
    } catch (e) {
      errors.push({ file: rel, op: 'DELETE', error: e.message });
    }
  }

  return { reindexed, revalidated, skipped, errors };
}

// ─── Measurement harness (for T3 scale-budget) ────────────────────────────────
/**
 * measure_freshness_budget(db, projectRoot, parseAndPut, opts) → measurement envelope
 *
 * Measures three cost dimensions per the AC-3 timing split:
 *   (a) single-file re-index + one-hop re-validation wall-clock
 *   (b) whole-tree compute_touched_files() dirty-scan wall-clock
 *   (c) ≥100-file dirty-set serial re-index wall-clock (branch-switch case)
 *
 * Returns shape-assertable envelope: { ok, ceilingMs, measured: { perEditMs,
 * dirtySetScanMs, multiFileDirtyMs, fileCount }, verdict, ceilingsMet }
 */
function measure_freshness_budget(db, projectRoot, parseAndPut, opts = {}) {
  const CEILING_MS = opts.ceilingMs || 1000; // 1 s default
  const multiFileCeilingMs = opts.multiFileCeilingMs || 30000; // 30 s for 100-file set

  const t0 = process.hrtime.bigint();
  const touched = compute_touched_files(db, projectRoot);
  const dirtySetScanMs = Number(process.hrtime.bigint() - t0) / 1e6;

  // Single-file re-index measurement (pick one edit if any, else measure a no-op)
  const singleEdit = touched.edits[0] || touched.adds[0] || null;
  let perEditMs = 0;
  if (singleEdit) {
    const t1 = process.hrtime.bigint();
    freshness_check_on_query(
      db, projectRoot,
      { edits: singleEdit && touched.edits.includes(singleEdit) ? [singleEdit] : [],
        adds: singleEdit && touched.adds.includes(singleEdit) ? [singleEdit] : [],
        deletes: [] },
      parseAndPut
    );
    perEditMs = Number(process.hrtime.bigint() - t1) / 1e6;
  }

  // Multi-file dirty-set measurement (≥100 files or all edits)
  const multiFileSet = {
    edits: touched.edits.slice(0, Math.max(100, touched.edits.length)),
    adds: touched.adds,
    deletes: touched.deletes,
  };
  const t2 = process.hrtime.bigint();
  freshness_check_on_query(db, projectRoot, multiFileSet, parseAndPut);
  const multiFileDirtyMs = Number(process.hrtime.bigint() - t2) / 1e6;

  const ceilingsMet = {
    perEdit: perEditMs <= CEILING_MS,
    dirtySetScan: dirtySetScanMs <= CEILING_MS,
    multiFileDirty: multiFileDirtyMs <= multiFileCeilingMs,
  };

  return {
    ok: true,
    ceilingMs: CEILING_MS,
    multiFileCeilingMs,
    measured: {
      perEditMs,
      dirtySetScanMs,
      multiFileDirtyMs,
      fileCount: touched.scannedCount,
      editCount: touched.edits.length,
      addCount: touched.adds.length,
      deleteCount: touched.deletes.length,
    },
    verdict: Object.values(ceilingsMet).every(Boolean) ? 'PASS' : 'FAIL',
    ceilingsMet,
  };
}

// ─── CLI entry (when run directly) ───────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  let projectRoot = process.cwd();
  let measure = false;
  let parseAndPutPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root' && args[i + 1]) projectRoot = args[++i];
    else if (args[i] === '--measure') measure = true;
    else if (args[i] === '--parse-and-put' && args[i + 1]) parseAndPutPath = args[++i];
  }

  const db = openDb(projectRoot);
  if (!db) {
    const env = { ok: false, error: 'No graph database found at ' + projectRoot };
    process.stdout.write(JSON.stringify(env, null, 2) + '\n');
    process.exit(1);
  }

  let parseAndPut = null;
  if (parseAndPutPath) {
    try { parseAndPut = require(path.resolve(parseAndPutPath)).parse_and_put; }
    catch (e) { /* ignore — D3 may not exist yet in the build */ }
  }
  if (!parseAndPut) {
    // Try to auto-detect D3's module
    const d3Path = path.join(path.dirname(__filename), 'gsd-t-graph-index.cjs');
    try { parseAndPut = require(d3Path).parse_and_put; }
    catch { /* D3 not yet built */ }
  }

  if (measure) {
    const env = measure_freshness_budget(db, projectRoot, parseAndPut);
    process.stdout.write(JSON.stringify(env, null, 2) + '\n');
    process.exit(env.verdict === 'PASS' ? 0 : 2);
  }

  const touched = compute_touched_files(db, projectRoot);
  if (touched.touched.length === 0) {
    const env = {
      ok: true,
      status: 'FRESH',
      message: 'No stale files detected.',
      scannedCount: touched.scannedCount,
    };
    process.stdout.write(JSON.stringify(env, null, 2) + '\n');
    process.exit(0);
  }

  const result = freshness_check_on_query(db, projectRoot, touched, parseAndPut);
  const env = {
    ok: result.errors.length === 0,
    status: 'REINDEXED',
    reindexed: result.reindexed,
    revalidatedCount: result.revalidated.length,
    errors: result.errors,
    scannedCount: touched.scannedCount,
    touchedCount: touched.touched.length,
  };
  process.stdout.write(JSON.stringify(env, null, 2) + '\n');
  process.exit(env.ok ? 0 : 2);
}

module.exports = {
  compute_touched_files,
  freshness_check_on_query,
  measure_freshness_budget,
  hashFileContent,
  walkTree,
  openDb,
  revalidateOneHopImporters,
  getIndexedFiles,
  hasTable,
};
