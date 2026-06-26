#!/usr/bin/env node
"use strict";

/**
 * gsd-t-graph-query-cli — M94 D5 (extended by D9)
 *
 * The DETERMINISTIC query CLI the model cannot route around — the no-stale-no-wrong KEYSTONE.
 *
 * Verbs (D5 — original):
 *   gsd-t graph who-imports <file>             — file→file reverse import edges
 *   gsd-t graph who-calls <file#function>      — function→function reverse call edges (funcId-keyed)
 *   gsd-t graph blast-radius <target>          — UNION of import-graph + call-graph reverse-reachable set (transitive)
 *   gsd-t graph status                         — live queryable index state
 *
 * Verbs (D9 additions):
 *   gsd-t graph cluster                        — tightly-coupled file groups (for /partition + /project)
 *   gsd-t graph dead-code                      — nodes with no inbound edges (alias: orphan)
 *   gsd-t graph orphan                         — alias for dead-code
 *   gsd-t graph dangling                       — edges whose dst is a missing node (delete/rename residue)
 *   gsd-t graph test-impl [--inverse]          — test→impl call coverage (--inverse = untested-impl)
 *
 * Invariants (all verified by keystone tests):
 *   [RULE] query-cli-never-greps       — NO directive-driven grep fallback in any code path
 *   [RULE] parser-fail-disables-loud-never-silent — genuine parser/store failure → {ok:false, reason:'graph-unavailable'}
 *   [RULE] stale-file-reindexed-before-answer  — D4 freshness check INLINE before answering
 *   [RULE] who-calls-function-identity-disambiguated — bare name matching multiple funcIds → ambiguous-function
 *   [RULE] blast-radius-unions-both-graphs     — UNION of import + call reverse-reachable, transitive closure
 *   [RULE] graph-status-live                   — status returns a live queryable index (M20–M21 anti-goal fails)
 *   [RULE] cluster-verb-deterministic-coupling — DETERMINISTIC coupling metric, not LLM judgment
 *   [RULE] dead-code-verb-excludes-entrypoints-and-exports — exclusions declared in contract
 *   [RULE] dangling-verb-surfaces-missing-dst  — edges whose dst is not in the node set
 *   [RULE] orphan-tier-labeled-candidate-not-certainty — floor-tier orphans labeled CANDIDATE
 *   [RULE] test-impl-verb-from-call-site-edges-no-new-type — derived from existing call-site edges
 *   [RULE] test-impl-no-new-edge-type-needed   — confirmed: call-site edges already cover test→impl
 *   [RULE] test-impl-never-presents-unresolved-as-coverage — UNRESOLVED# targets never in implFuncs
 *   [RULE] query-surfaces-incompleteness-never-silent-empty — coverage field on who-imports/who-calls/blast-radius
 *
 * Dependencies (fail-loud if absent — never silently fall back):
 *   bin/gsd-t-graph-freshness.cjs  — D4: freshness_check_on_query + compute_touched_files
 *   bin/gsd-t-graph-index.cjs      — D3: parse_and_put (called by D4, not directly here)
 *
 * Zero external runtime deps for the installer. Sync file APIs. JSON envelope output.
 *
 * JSON envelope shapes:
 *   { ok: true,  verb: "who-imports|who-calls|blast-radius|status", target: "...", results: [...], tier: "...", coverage: {...} }
 *   { ok: true,  verb: "cluster", results: [{files:[...], couplingScore}], tier: "..." }
 *   { ok: true,  verb: "dead-code", results: [{funcId, file, tier, candidateLabel}], tier: "..." }
 *   { ok: true,  verb: "dangling", results: [{src, dst, kind}], tier: "..." }
 *   { ok: true,  verb: "test-impl", results: [{testFunc, implFuncs:[...]}], tier: "..." }
 *   { ok: false, reason: "graph-unavailable" }
 *   { ok: false, reason: "ambiguous-function", verb: "who-calls", target: "foo", candidates: ["a.ts#foo","b.ts#foo"] }
 *   { ok: false, reason: "unknown-target", verb: "...", target: "..." }
 *
 * CLI usage:
 *   node bin/gsd-t-graph-query-cli.cjs who-imports src/foo.ts
 *   node bin/gsd-t-graph-query-cli.cjs who-calls 'src/foo.ts#bar'
 *   node bin/gsd-t-graph-query-cli.cjs blast-radius src/foo.ts
 *   node bin/gsd-t-graph-query-cli.cjs status
 *   node bin/gsd-t-graph-query-cli.cjs cluster
 *   node bin/gsd-t-graph-query-cli.cjs dead-code
 *   node bin/gsd-t-graph-query-cli.cjs orphan
 *   node bin/gsd-t-graph-query-cli.cjs dangling
 *   node bin/gsd-t-graph-query-cli.cjs test-impl
 *   node bin/gsd-t-graph-query-cli.cjs test-impl --inverse
 *
 * Exit: 0 on success, 1 on graph-unavailable or error, 2 on ambiguous-function.
 */

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

// ─── ANSI colours ────────────────────────────────────────────────────────────
const C = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  red:    "\x1b[31m",
  cyan:   "\x1b[36m",
  dim:    "\x1b[2m",
};

function colorize(str, ...codes) {
  return codes.join("") + str + C.reset;
}

// ─── Store location ───────────────────────────────────────────────────────────
// The store path is resolved from the environment or a default discovery path.
// D3 writes to a store directory; we read from it.
// Convention: GSD_T_GRAPH_STORE env var overrides; otherwise look for
// .gsd-t/graph-index/ relative to cwd.

function resolveStorePath() {
  if (process.env.GSD_T_GRAPH_STORE) {
    return process.env.GSD_T_GRAPH_STORE;
  }
  // Walk up from cwd to find .gsd-t/
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, ".gsd-t", "graph-index");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// ─── In-memory store interface ────────────────────────────────────────────────
// Reads the on-disk JSONL/SQLite store (whichever D3 wrote) and builds
// in-memory index structures optimised for the query verbs.
//
// Store format (per graph-store-schema-contract.md):
//   Each record: { file, content_hash, entities: FuncEntity[], edges: Edge[], tier }
//   Edge: { kind: "IMPORT"|"CALL", src, dst }
//   FuncEntity: { funcId, name, kind, file, tier }
//
// D5 supports the JSONL flat-file store (the K1 baseline that PASSED).
// If SQLite becomes the picked store, D3 owns that path; D5 reads via the
// same record shape declared in graph-store-schema-contract.md.

/**
 * @typedef {{ importGraph: Map<string,Set<string>>, callGraph: Map<string,Set<string>>,
 *             funcEntities: Map<string,{name:string,file:string,tier:string}>,
 *             allFiles: Set<string>, tier: string,
 *             skippedFiles: Set<string> }} IndexStructure
 *
 * skippedFiles: files that failed to parse (D3-T6 skipped set). Used by T5 to
 * compute coverage.complete:false when a query's contributors include unparsed files.
 */

// ─── Test-path patterns for test→impl verb (D9-T3) ───────────────────────────
// Declared here (configurable via GSD_T_TEST_PATTERNS env var) so they are
// visible in the contract and overridable for different project layouts.
// Default patterns: *.test.*, *.spec.*, e2e/** directories.
// [RULE] test-impl-verb-from-call-site-edges-no-new-type

const DEFAULT_TEST_PATTERNS = [
  /\.test\.[^.]+$/,     // *.test.ts, *.test.js, etc.
  /\.spec\.[^.]+$/,     // *.spec.ts, *.spec.js, etc.
  /(?:^|\/)e2e\//,      // e2e/** directory prefix
  /(?:^|\/)__tests__\//,// Jest __tests__ directory
  /(?:^|\/)tests?\//,   // tests/ or test/ directory
];

/**
 * Return the active test-path patterns (env override or defaults).
 * @returns {RegExp[]}
 */
function getTestPatterns() {
  const envPatterns = process.env.GSD_T_TEST_PATTERNS;
  if (envPatterns) {
    try {
      return envPatterns.split(",").map((p) => new RegExp(p.trim()));
    } catch (_e) {
      // fall through to defaults on bad regex
    }
  }
  return DEFAULT_TEST_PATTERNS;
}

/**
 * Return true if a funcId's file matches any test-path pattern.
 * @param {string} funcId  — e.g. "test/foo.test.ts#myTest@12"
 * @param {RegExp[]} patterns
 * @returns {boolean}
 */
function isTestFile(funcId, patterns) {
  const file = funcId.includes("#") ? funcId.split("#")[0] : funcId;
  return patterns.some((re) => re.test(file));
}

// ─── UNRESOLVED sentinel (D9-T3 + D9-T4) ─────────────────────────────────────
// The edge extractor emits UNRESOLVED#<name> when a call target cannot be resolved.
// [RULE] test-impl-never-presents-unresolved-as-coverage — these must NEVER appear
// in the implFuncs coverage set.

const UNRESOLVED_PREFIX = "UNRESOLVED#";

/**
 * Load records from a JSONL store directory.
 * Returns null if the store is not present or is corrupt.
 *
 * @param {string} storePath
 * @returns {{ records: object[] } | null}
 */
function loadJsonlStore(storePath) {
  const recordsPath = path.join(storePath, "records.jsonl");
  if (!fs.existsSync(recordsPath)) return null;

  try {
    const raw = fs.readFileSync(recordsPath, "utf8");
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    const records = lines.map((l) => JSON.parse(l));
    return { records };
  } catch (e) {
    return null;
  }
}

/**
 * Load the skipped-file set from the D3-T6 SQLite meta table (best-effort).
 * Returns a Set<string> of file paths that failed to parse.
 * Returns an empty Set if the table is absent or the DB is not accessible.
 *
 * The store path may be either a JSONL directory (in which case we look for
 * a graph.db sibling up the tree) or may be a .db path itself.
 *
 * @param {string|null} storePath
 * @returns {Set<string>}
 */
function loadSkippedFiles(storePath) {
  if (!storePath) return new Set();
  try {
    // The SQLite DB is written by D3 at .gsd-t/graph.db (adjacent to graph-index/ dir).
    // storePath may be .gsd-t/graph-index/ (JSONL) or the db path itself.
    let dbPath = null;
    // Try storePath as a directory: look for graph.db one level up (sibling of graph-index/)
    if (fs.existsSync(storePath) && fs.statSync(storePath).isDirectory()) {
      const candidate = path.join(path.dirname(storePath), "graph.db");
      if (fs.existsSync(candidate)) dbPath = candidate;
    } else if (storePath.endsWith(".db") && fs.existsSync(storePath)) {
      dbPath = storePath;
    }
    if (!dbPath) return new Set();

    // Try to load better-sqlite3 — it is a devDependency, may be absent
    let Database;
    try {
      Database = require("better-sqlite3");
    } catch (_e) {
      return new Set();
    }

    const db = new Database(dbPath, { readonly: true });
    const skipped = new Set();
    try {
      const rows = db.prepare("SELECT file FROM skipped_files").all();
      for (const row of rows) skipped.add(row.file);
    } catch (_e) {
      // Table absent — normal for repos indexed before D3-T6 landed
    } finally {
      db.close();
    }
    return skipped;
  } catch (_e) {
    return new Set();
  }
}

/**
 * Compute the coverage field for a query result.
 *
 * [RULE] query-surfaces-incompleteness-never-silent-empty
 *
 * Logic: any file in the skipped set is a potential contributor to ANY query
 * (it could have imported or called any target). So the coverage is incomplete
 * whenever the skipped set is non-empty — we cannot know which of those files
 * would have provided edges pointing at the query target.
 *
 * This is the conservative (correct) semantics: a clean empty result from a
 * fully-parsed graph IS "no importers"; a clean empty result when 5 files failed
 * to parse is NOT "no importers" — it is "no importers among the files we parsed".
 *
 * @param {Set<string>} skippedFiles  — files that failed to parse (D3-T6)
 * @returns {{ complete: boolean, unparsedContributors?: number, note?: string }}
 */
function computeCoverage(skippedFiles) {
  if (!skippedFiles || skippedFiles.size === 0) {
    return { complete: true };
  }
  const n = skippedFiles.size;
  return {
    complete: false,
    unparsedContributors: n,
    note: `result may be incomplete — ${n} file(s) unparsed`,
  };
}

/**
 * Build in-memory index structures from raw records.
 *
 * importGraph: Map<dstFile, Set<srcFile>> — reverse import edges (who imports dstFile)
 * callGraph:   Map<dstFuncId, Set<srcFuncId>> — reverse call edges (who calls dstFuncId)
 * forwardCallEdges: Array<{src,dst}> — raw forward call edges (for dangling detection)
 * funcEntities: Map<funcId, {name, file, tier}> — entity lookup + tier for dead-code labeling
 * allFiles:    Set<string> — all indexed file paths
 * skippedFiles: Set<string> — files that failed to parse (D3-T6; empty if not provided)
 *
 * @param {object[]} records
 * @param {Set<string>} [skippedFiles]  — optional set of skipped file paths from D3-T6
 * @returns {IndexStructure}
 */
function buildIndex(records, skippedFiles) {
  /** @type {Map<string,Set<string>>} */
  const importGraph = new Map();
  /** @type {Map<string,Set<string>>} */
  const callGraph = new Map();
  /** @type {Array<{src:string,dst:string,kind:string}>} */
  const forwardCallEdges = [];
  /** @type {Map<string,{name:string,file:string,tier:string}>} */
  const funcEntities = new Map();
  /** @type {Set<string>} */
  const allFiles = new Set();

  let dominantTier = "compiler-accurate";
  let hasFloor = false;
  let hasStaleScip = false;

  for (const rec of records) {
    allFiles.add(rec.file);

    if (rec.tier === "tree-sitter-floor") hasFloor = true;
    if (rec.tier === "tree-sitter-floor-STALE-SCIP") hasStaleScip = true;

    // Index entities for bare-name disambiguation + tier labeling
    if (Array.isArray(rec.entities)) {
      for (const ent of rec.entities) {
        if (ent.funcId) {
          funcEntities.set(ent.funcId, {
            name: ent.name,
            file: ent.file || rec.file,
            tier: ent.tier || rec.tier,
          });
        }
      }
    }

    // Build reverse edge indices + collect forward call edges for dangling detection
    if (Array.isArray(rec.edges)) {
      for (const edge of rec.edges) {
        if (edge.kind === "IMPORT") {
          // Reverse: dst ← src (who imports dst = src)
          if (!importGraph.has(edge.dst)) importGraph.set(edge.dst, new Set());
          importGraph.get(edge.dst).add(edge.src);
        } else if (edge.kind === "CALL") {
          // Reverse: dst ← src (who calls dst = src)
          if (!callGraph.has(edge.dst)) callGraph.set(edge.dst, new Set());
          callGraph.get(edge.dst).add(edge.src);
          // Forward: collect ALL call edges for dangling + test-impl verbs
          forwardCallEdges.push({ src: edge.src, dst: edge.dst, kind: "CALL" });
        }
      }
    }
  }

  if (hasStaleScip) dominantTier = "tree-sitter-floor-STALE-SCIP";
  else if (hasFloor) dominantTier = "tree-sitter-floor";

  return {
    importGraph,
    callGraph,
    forwardCallEdges,
    funcEntities,
    allFiles,
    tier: dominantTier,
    skippedFiles: skippedFiles instanceof Set ? skippedFiles : new Set(),
  };
}

// ─── Load store + build index (fail-loud on any failure) ─────────────────────

/**
 * Load the on-disk store and build the in-memory index.
 * Returns { ok: true, index: IndexStructure } on success.
 * Returns { ok: false, reason: 'graph-unavailable' } on any load failure.
 *
 * Also loads the D3-T6 skipped-file set (best-effort; never fails the load).
 *
 * @param {string|null} storePath
 * @returns {{ ok: boolean, index?: IndexStructure, reason?: string }}
 */
function loadStore(storePath) {
  if (!storePath) return { ok: false, reason: "graph-unavailable" };

  // Try JSONL store (the primary format; SQLite adapter is D3's concern)
  const loaded = loadJsonlStore(storePath);
  if (!loaded) return { ok: false, reason: "graph-unavailable" };

  try {
    // Load skipped files (best-effort — never fails the store load)
    const skippedFiles = loadSkippedFiles(storePath);
    const index = buildIndex(loaded.records, skippedFiles);
    return { ok: true, index };
  } catch (_e) {
    return { ok: false, reason: "graph-unavailable" };
  }
}

// ─── D4 freshness integration ─────────────────────────────────────────────────
// D5 calls D4's freshness_check_on_query INLINE before answering any query.
// If D4's module is absent, the graph is unavailable (fail-loud per the contract).
//
// D4 exports: { freshness_check_on_query, compute_touched_files }
// Both are called from the same module — no grep fallback ever.

/**
 * Load D4's freshness module. Returns null if unavailable.
 * If null, the caller MUST return graph-unavailable (fail-loud).
 */
function loadFreshnessModule() {
  try {
    const freshnessPath = path.join(__dirname, "gsd-t-graph-freshness.cjs");
    return require(freshnessPath);
  } catch (_e) {
    return null;
  }
}

/**
 * Run D4's freshness check inline.
 * Returns { ok: true } if index is fresh (or was re-indexed to become fresh).
 * Returns { ok: false, reason: 'graph-unavailable' } if D4 is missing or fails.
 *
 * @param {string|null} storePath
 * @returns {{ ok: boolean, reason?: string }}
 */
function runFreshnessCheck(storePath) {
  const freshnessModule = loadFreshnessModule();
  if (!freshnessModule) {
    // D4 not yet built — fail-loud per [RULE] parser-fail-disables-loud-never-silent
    return { ok: false, reason: "graph-unavailable" };
  }

  try {
    // D4 contract: compute_touched_files() → whole-tree dirty set
    // then freshness_check_on_query(touched_files) → re-indexes stale files
    const touchedFiles = freshnessModule.compute_touched_files(storePath);
    freshnessModule.freshness_check_on_query(touchedFiles, storePath);
    return { ok: true };
  } catch (_e) {
    return { ok: false, reason: "graph-unavailable" };
  }
}

// ─── Query: who-imports ───────────────────────────────────────────────────────

/**
 * who-imports(target): return all files that import `target`.
 * Answers from the reverse import-graph index.
 *
 * Adds a `coverage` field per [RULE] query-surfaces-incompleteness-never-silent-empty:
 * when the skipped-file set includes files that could have imported `target` (any
 * file in the skipped set is a potential contributor), the coverage is incomplete.
 *
 * @param {IndexStructure} index
 * @param {string} target  repo-relative POSIX path
 * @returns {{ results: string[], tier: string, coverage: object }}
 */
function queryWhoImports(index, target) {
  const importers = index.importGraph.get(target);
  const results = importers ? Array.from(importers).sort() : [];
  const coverage = computeCoverage(index.skippedFiles);
  return { results, tier: index.tier, coverage };
}

// ─── Query: who-calls ─────────────────────────────────────────────────────────

/**
 * who-calls(identity): return all callers of a function identified by funcId or bare name.
 *
 * Identity forms:
 *   'file#function'         — file-qualified (exact funcId lookup)
 *   'file#function@line'    — overload-qualified funcId
 *   'function'              — bare name (may be ambiguous)
 *
 * Per [RULE] who-calls-function-identity-disambiguated:
 *   - A file#function identity resolves exactly one funcId.
 *   - A bare name matching multiple funcIds returns { ambiguous: true, candidates: [...] }.
 *   - A bare name matching exactly one funcId resolves directly.
 *   - NEVER merges callers across same-named functions.
 *
 * @param {IndexStructure} index
 * @param {string} identity
 * @returns {{ results?: string[], tier?: string, ambiguous?: boolean, candidates?: string[], notFound?: boolean }}
 */
function queryWhoCalls(index, identity) {
  const isFuncId = identity.includes("#");
  const coverage = computeCoverage(index.skippedFiles);

  if (isFuncId) {
    // File-qualified identity — exact funcId lookup
    const callers = index.callGraph.get(identity);
    const results = callers ? Array.from(callers).sort() : [];
    return { results, tier: index.tier, coverage };
  }

  // Bare name — disambiguate against all funcIds
  const bareName = identity;
  const matchingFuncIds = [];
  for (const [funcId, meta] of index.funcEntities) {
    if (meta.name === bareName) {
      matchingFuncIds.push(funcId);
    }
  }

  if (matchingFuncIds.length === 0) {
    return { results: [], tier: index.tier, coverage };
  }

  if (matchingFuncIds.length === 1) {
    // Unambiguous bare name — resolve directly
    const callers = index.callGraph.get(matchingFuncIds[0]);
    const results = callers ? Array.from(callers).sort() : [];
    return { results, tier: index.tier, coverage };
  }

  // Multiple matches — ambiguous, NEVER merge
  return { ambiguous: true, candidates: matchingFuncIds.sort() };
}

// ─── Query: blast-radius ──────────────────────────────────────────────────────

/**
 * blast-radius(target): downstream impact set — UNION of reverse-reachable nodes
 * from `target` in BOTH the import graph AND the call graph, transitive closure.
 *
 * Per [RULE] blast-radius-unions-both-graphs:
 *   - Import graph: file→file (reverse: who transitively imports target)
 *   - Call graph:   funcId→funcId (reverse: who transitively calls target)
 *   - Both graphs UNIONED: a node reachable via EITHER is in the set.
 *   - Transitive closure (full reverse-reachable), NOT one-hop.
 *   - A node reachable via ONLY the call graph MUST appear (not just import-reachable).
 *   - A node reachable via NEITHER is excluded.
 *
 * File-root expansion:
 *   When `target` is a FILE path (not a funcId — no '#'), the BFS initial frontier is
 *   expanded to include ALL funcIds owned by that file. This ensures call-graph-only
 *   downstream nodes (callers of functions IN the target file) are included in the
 *   blast radius, not just import-graph reachable nodes.
 *
 *   Why: the call-graph edges are keyed by funcId (e.g. "target.ts#targetFn"), not by
 *   file. A query like blast-radius("target.ts") without expansion would only follow
 *   import-graph edges, missing any function callers — producing an under-broad result.
 *   The UNION semantics require expanding to both the file node AND its owned funcIds.
 *
 * Note: blast-radius is a SEQUENCED-FOLLOW-ON deliverable per
 * [RULE] blast-radius-sequenced-follow-on-not-phase1-consumed — it is built and
 * tested here (D5-T1 verb + D5-T3 union fixture) but has ZERO Phase-1 consumer.
 * Its /impact + /debug consumers are DEFERRED. This is an honest foundation.
 *
 * @param {IndexStructure} index
 * @param {string} target  file path or funcId
 * @returns {{ results: string[], tier: string }}
 */
function queryBlastRadius(index, target) {
  const isFilePath = !target.includes("#");

  // Build the initial frontier (multi-root if file-path: include owned funcIds)
  const initialFrontier = new Set([target]);

  if (isFilePath) {
    // Expand file-root to include ALL funcIds owned by this file.
    // This is the UNION seam: call-graph edges are keyed by funcId, not file.
    // Without this expansion, callers of target's functions would be missed.
    for (const [funcId, meta] of index.funcEntities) {
      if (meta.file === target) {
        initialFrontier.add(funcId);
      }
    }
  }

  // BFS over the UNION of reverse import + call edges, transitive closure
  const visited = new Set();
  const queue = Array.from(initialFrontier);

  while (queue.length > 0) {
    const node = queue.shift();
    if (visited.has(node)) continue;
    visited.add(node);

    // Reverse import edges: who imports this file node?
    const importers = index.importGraph.get(node);
    if (importers) {
      for (const imp of importers) {
        if (!visited.has(imp)) queue.push(imp);
      }
    }

    // Reverse call edges: who calls this function node?
    const callers = index.callGraph.get(node);
    if (callers) {
      for (const caller of callers) {
        if (!visited.has(caller)) queue.push(caller);
      }
    }
  }

  // Exclude the initial frontier (the root and its owned funcIds) from the result set.
  // They are roots, not downstream nodes.
  for (const root of initialFrontier) {
    visited.delete(root);
  }

  const results = Array.from(visited).sort();
  const coverage = computeCoverage(index.skippedFiles);
  return { results, tier: index.tier, coverage };
}

// ─── Query: status ────────────────────────────────────────────────────────────

/**
 * status: return live queryable index state.
 * Per [RULE] graph-status-live — must return a LIVE queryable index;
 * the M20–M21 "no graph index found" is the anti-goal.
 *
 * @param {IndexStructure} index
 * @param {string} storePath
 * @returns {object}
 */
function queryStatus(index, storePath) {
  return {
    queryable: true,
    storePath,
    fileCount: index.allFiles.size,
    funcCount: index.funcEntities.size,
    importEdgeCount: Array.from(index.importGraph.values()).reduce((s, v) => s + v.size, 0),
    callEdgeCount: Array.from(index.callGraph.values()).reduce((s, v) => s + v.size, 0),
    tier: index.tier,
  };
}

// ─── D9-T1: Query: cluster (tightly-coupled file groups) ─────────────────────
//
// [RULE] cluster-verb-deterministic-coupling
// Algorithm: shared-neighbour coupling over the IMPORT graph.
// Coupling score between files A and B = (|shared import targets| + |shared importers|)
// normalised by (|A's neighbours| + |B's neighbours|). This is a DETERMINISTIC metric
// (same edges → same score → same grouping), NOT an LLM judgment.
//
// Grouping: Union-Find over all file pairs whose coupling score ≥ COUPLING_THRESHOLD.
// A file with NO other coupled file becomes its own singleton cluster.
//
// Consumers: /partition (domain-boundary suggestion), /project (milestone decomposition).

const COUPLING_THRESHOLD = 0.2; // declared in contract — files sharing ≥20% of their import neighbourhood

/**
 * Union-Find (path-compressed) for cluster grouping.
 * @param {string[]} items
 */
function makeUnionFind(items) {
  const parent = new Map(items.map((x) => [x, x]));
  function find(x) {
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)));
    return parent.get(x);
  }
  function union(x, y) {
    const rx = find(x), ry = find(y);
    if (rx !== ry) parent.set(rx, ry);
  }
  return { find, union, parent };
}

/**
 * cluster: return tightly-coupled file groups by a DETERMINISTIC coupling metric.
 *
 * @param {IndexStructure} index
 * @returns {{ results: Array<{files:string[], couplingScore:number}>, tier: string }}
 */
function queryCluster(index) {
  const files = Array.from(index.allFiles).sort(); // deterministic order

  // Build forward import adjacency: srcFile → Set<dstFile>
  // importGraph is reverse (dst→Set<src>), so we invert it.
  /** @type {Map<string,Set<string>>} */
  const importTargets = new Map(); // file → files it imports
  /** @type {Map<string,Set<string>>} */
  const importedBy = index.importGraph;   // file → files that import it (already built)

  for (const [dst, srcs] of importedBy) {
    for (const src of srcs) {
      if (!importTargets.has(src)) importTargets.set(src, new Set());
      importTargets.get(src).add(dst);
    }
  }

  // Compute pairwise coupling scores for all file pairs that share at least one neighbour.
  // Only compute O(N²) where N = files with edges — skip fully-isolated files for pairing.
  const uf = makeUnionFind(files);

  // For each unique pair (i < j), compute coupling = Jaccard over import neighbourhood.
  // neighbourhood(f) = importTargets(f) ∪ importedBy(f)
  const neighbourhood = new Map();
  for (const f of files) {
    const nb = new Set();
    if (importTargets.has(f)) for (const x of importTargets.get(f)) nb.add(x);
    if (importedBy.has(f))    for (const x of importedBy.get(f))    nb.add(x);
    neighbourhood.set(f, nb);
  }

  for (let i = 0; i < files.length; i++) {
    const a = files[i];
    const nbA = neighbourhood.get(a);
    if (nbA.size === 0) continue;
    for (let j = i + 1; j < files.length; j++) {
      const b = files[j];
      const nbB = neighbourhood.get(b);
      if (nbB.size === 0) continue;
      // Jaccard(A,B) = |A∩B| / |A∪B|
      let intersection = 0;
      for (const x of nbA) if (nbB.has(x)) intersection++;
      const unionSize = nbA.size + nbB.size - intersection;
      if (unionSize === 0) continue;
      const score = intersection / unionSize;
      if (score >= COUPLING_THRESHOLD) {
        uf.union(a, b);
      }
    }
  }

  // Collect groups
  const groupMap = new Map();
  for (const f of files) {
    const root = uf.find(f);
    if (!groupMap.has(root)) groupMap.set(root, []);
    groupMap.get(root).push(f);
  }

  // Sort groups by descending size, then by first file name (deterministic)
  const groups = Array.from(groupMap.values());
  groups.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return a[0] < b[0] ? -1 : 1;
  });

  // Compute a representative coupling score for each group (average pairwise Jaccard among members)
  const results = groups.map((group) => {
    if (group.length === 1) return { files: group, couplingScore: 0 };
    let totalScore = 0, pairs = 0;
    for (let i = 0; i < group.length; i++) {
      const nbA = neighbourhood.get(group[i]);
      for (let j = i + 1; j < group.length; j++) {
        const nbB = neighbourhood.get(group[j]);
        let intersection = 0;
        for (const x of nbA) if (nbB.has(x)) intersection++;
        const unionSize = nbA.size + nbB.size - intersection;
        if (unionSize > 0) totalScore += intersection / unionSize;
        pairs++;
      }
    }
    const avg = pairs > 0 ? totalScore / pairs : 0;
    return { files: group, couplingScore: Math.round(avg * 1000) / 1000 };
  });

  return { results, tier: index.tier };
}

// ─── D9-T2: Query: dead-code / orphan (no inbound edges) ─────────────────────
//
// [RULE] dead-code-verb-excludes-entrypoints-and-exports
// Exclusions (declared here and in the contract):
//   1. Files matching ENTRY_POINT_PATTERNS (bin/, main.*, index.*, cli.*)
//   2. Test files (matched by DEFAULT_TEST_PATTERNS) — these intentionally have no callers
//   3. Functions whose name starts with an uppercase letter (exported class constructors / public API)
//   4. Functions named "exports", "module.exports", or matching EXPORTED_FUNC_PATTERNS
//
// [RULE] orphan-tier-labeled-candidate-not-certainty
//   Tree-sitter-floor-tier orphans are labeled CANDIDATE (a missed unresolved call
//   could make a live function look orphan). Compiler-accurate orphans labeled accordingly.

const ENTRY_POINT_PATTERNS = [
  /(?:^|\/)bin\//,
  /(?:^|\/)main\.[^.]+$/,
  /(?:^|\/)index\.[^.]+$/,
  /(?:^|\/)cli\.[^.]+$/,
  /(?:^|\/)app\.[^.]+$/,
  /(?:^|\/)server\.[^.]+$/,
];

const EXPORTED_FUNC_PATTERNS = [
  /^exports?\./,
  /^module\.exports/,
];

/**
 * dead-code / orphan: return function entities with no inbound edges (callers or importers).
 * Applies declared exclusions and tier-honest CANDIDATE labeling.
 *
 * @param {IndexStructure} index
 * @returns {{ results: Array<{funcId:string, file:string, tier:string, candidateLabel:string|null}>, tier: string }}
 */
function queryDeadCode(index) {
  const testPatterns = getTestPatterns();
  const results = [];

  for (const [funcId, meta] of index.funcEntities) {
    // Exclusion 1: entry-point files
    if (ENTRY_POINT_PATTERNS.some((re) => re.test(meta.file))) continue;
    // Exclusion 2: test files
    if (testPatterns.some((re) => re.test(meta.file))) continue;
    // Exclusion 3: exported public API — function name starts with uppercase
    if (/^[A-Z]/.test(meta.name)) continue;
    // Exclusion 4: module.exports patterns
    if (EXPORTED_FUNC_PATTERNS.some((re) => re.test(meta.name))) continue;

    // Check for inbound call edges
    const callers = index.callGraph.get(funcId);
    if (callers && callers.size > 0) continue;

    // Check for inbound import edges (function's file is imported)
    const fileImporters = index.importGraph.get(meta.file);
    // If the file is imported, do NOT flag its functions as dead — the file is in use.
    // (The import itself is the "caller" at the file level.)
    if (fileImporters && fileImporters.size > 0) continue;

    // This function has no callers AND its file is not imported by anyone.
    // [RULE] orphan-tier-labeled-candidate-not-certainty:
    // Floor-tier results are CANDIDATE (a missed unresolved call could explain the absence).
    const tier = meta.tier || index.tier;
    const isFloor = tier === "tree-sitter-floor" || tier === "tree-sitter-floor-STALE-SCIP";
    const candidateLabel = isFloor ? "CANDIDATE" : null;

    results.push({ funcId, file: meta.file, tier, candidateLabel });
  }

  // Sort deterministically by funcId
  results.sort((a, b) => (a.funcId < b.funcId ? -1 : 1));
  return { results, tier: index.tier };
}

// ─── D9-T2: Query: dangling (edges to missing nodes) ─────────────────────────
//
// [RULE] dangling-verb-surfaces-missing-dst
// A dangling edge: a CALL edge whose dst funcId is NOT in the funcEntities map
// and is NOT an UNRESOLVED# sentinel (those are expected floor-tier unknowns).
// IMPORT dangling: an IMPORT edge whose dst file is NOT in allFiles.
//
// Consumer: /qa + /verify (dead-code / dangling-ref detection).

/**
 * dangling: return edges whose dst is a missing node (delete/rename residue).
 *
 * @param {IndexStructure} index
 * @returns {{ results: Array<{src:string, dst:string, kind:string, note:string}>, tier: string }}
 */
function queryDangling(index) {
  const results = [];

  for (const { src, dst, kind } of index.forwardCallEdges) {
    // Skip UNRESOLVED# sentinels — these are expected at the tree-sitter floor;
    // they represent unresolvable call targets, NOT deleted/missing nodes.
    if (dst.startsWith(UNRESOLVED_PREFIX)) continue;
    // If the dst funcId is not in the entities map, it is a dangling ref
    if (!index.funcEntities.has(dst)) {
      results.push({
        src,
        dst,
        kind: "CALL",
        note: "dst function not in index — possibly deleted or renamed",
      });
    }
  }

  // Also check IMPORT edges: importGraph is reverse (dst → srcs).
  // To find dangling import dsts, scan all dst keys in importGraph
  // and check if they are in allFiles.
  for (const [dst, srcs] of index.importGraph) {
    if (!index.allFiles.has(dst)) {
      for (const src of srcs) {
        results.push({
          src,
          dst,
          kind: "IMPORT",
          note: "dst file not in index — possibly deleted or renamed",
        });
      }
    }
  }

  results.sort((a, b) => {
    const c = a.src < b.src ? -1 : a.src > b.src ? 1 : 0;
    if (c !== 0) return c;
    return a.dst < b.dst ? -1 : 1;
  });
  return { results, tier: index.tier };
}

// ─── D9-T3: Query: test-impl (test→impl coverage from call-site edges) ───────
//
// [RULE] test-impl-verb-from-call-site-edges-no-new-type
// [RULE] test-impl-no-new-edge-type-needed
// [RULE] test-impl-never-presents-unresolved-as-coverage
//
// The extractor already emits call-site edges keyed file#function@LINE at both ends.
// A test→impl edge is DERIVABLE by filtering call edges where src file matches a
// test-path pattern. NO new edge type is added to D3.
//
// Consumers: /test-sync (align tests with impl via coverage edges).

/**
 * test-impl: return, per test function, the impl funcIds it calls.
 *
 * @param {IndexStructure} index
 * @param {{ inverse?: boolean, testPatterns?: RegExp[] }} [options]
 *   inverse: if true, return impl funcs with NO test-file caller (untested-impl)
 * @returns {{ results: Array<{testFunc:string, implFuncs:string[]}> |
 *             Array<{funcId:string, file:string}>, tier: string, mode: string }}
 */
function queryTestImpl(index, options) {
  const { inverse = false, testPatterns = getTestPatterns() } = options || {};

  if (!inverse) {
    // Forward mode: for each test function, list the impl funcIds it calls.
    // [RULE] test-impl-never-presents-unresolved-as-coverage:
    //   UNRESOLVED# targets are filtered out — they are NOT coverage.
    /** @type {Map<string, string[]>} */
    const testToImpl = new Map();

    for (const { src, dst } of index.forwardCallEdges) {
      // src must be a test file
      if (!isTestFile(src, testPatterns)) continue;
      // dst must NOT be a test file (it's an impl target)
      if (isTestFile(dst, testPatterns)) continue;
      // dst must NOT be an UNRESOLVED sentinel
      if (dst.startsWith(UNRESOLVED_PREFIX)) continue;

      if (!testToImpl.has(src)) testToImpl.set(src, []);
      testToImpl.get(src).push(dst);
    }

    // Deduplicate and sort implFuncs for each test function
    const results = [];
    for (const [testFunc, implFuncs] of testToImpl) {
      const unique = Array.from(new Set(implFuncs)).sort();
      results.push({ testFunc, implFuncs: unique });
    }
    results.sort((a, b) => (a.testFunc < b.testFunc ? -1 : 1));
    return { results, tier: index.tier, mode: "forward" };
  }

  // Inverse mode: impl funcs with NO test-file caller (untested-impl).
  // Collect all impl funcIds that have at least one test caller.
  const testedFuncIds = new Set();
  for (const { src, dst } of index.forwardCallEdges) {
    if (!isTestFile(src, testPatterns)) continue;
    if (isTestFile(dst, testPatterns)) continue;
    if (dst.startsWith(UNRESOLVED_PREFIX)) continue;
    testedFuncIds.add(dst);
  }

  const untested = [];
  for (const [funcId, meta] of index.funcEntities) {
    // Only consider impl files (not test files)
    if (isTestFile(funcId, testPatterns)) continue;
    if (!testedFuncIds.has(funcId)) {
      untested.push({ funcId, file: meta.file });
    }
  }
  untested.sort((a, b) => (a.funcId < b.funcId ? -1 : 1));
  return { results: untested, tier: index.tier, mode: "untested-impl" };
}

// ─── Public API (for tests to import directly) ────────────────────────────────
// Tests build an index from fixture records, then call these pure functions.
// The query CLI is the only caller of runFreshnessCheck (integration seam).

/**
 * Build an IndexStructure from an array of store records.
 * Used by tests to construct fixture-based indices without disk I/O.
 *
 * @param {object[]} records
 * @param {Set<string>} [skippedFiles]  — optional skipped-file set for T5 coverage tests
 */
function buildIndexFromRecords(records, skippedFiles) {
  return buildIndex(records, skippedFiles);
}

module.exports = {
  buildIndexFromRecords,
  queryWhoImports,
  queryWhoCalls,
  queryBlastRadius,
  queryStatus,
  // D9 additions
  queryCluster,
  queryDeadCode,
  queryDangling,
  queryTestImpl,
  computeCoverage,
  loadStore,
  runFreshnessCheck,
  resolveStorePath,
  // Exported for fault-injection tests
  loadFreshnessModule,
  // Exported constants for test assertions
  COUPLING_THRESHOLD,
  DEFAULT_TEST_PATTERNS,
  UNRESOLVED_PREFIX,
  getTestPatterns,
  isTestFile,
};

// ─── CLI entry point ───────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const verb = args[0];
  const target = args[1];

  function emit(envelope) {
    process.stdout.write(JSON.stringify(envelope) + "\n");
  }

  function fail(envelope) {
    emit(envelope);
    process.exit(1);
  }

  const ALL_VERBS = [
    "who-imports", "who-calls", "blast-radius", "status",
    "cluster", "dead-code", "orphan", "dangling", "test-impl",
  ];

  if (!verb) {
    fail({ ok: false, reason: "no-verb", usage: `gsd-t graph <${ALL_VERBS.join("|")}> [target]` });
  }

  if (!ALL_VERBS.includes(verb)) {
    fail({ ok: false, reason: "unknown-verb", verb });
  }

  const storePath = resolveStorePath();

  // ── Step 1: D4 freshness check INLINE — [RULE] stale-file-reindexed-before-answer ──
  const freshnessResult = runFreshnessCheck(storePath);
  if (!freshnessResult.ok) {
    fail({ ok: false, reason: "graph-unavailable" });
  }

  // ── Step 2: Load store (fail-loud if missing or corrupt) ──
  const storeResult = loadStore(storePath);
  if (!storeResult.ok) {
    fail({ ok: false, reason: "graph-unavailable" });
  }

  const index = storeResult.index;

  // ── Step 3: Dispatch verb ──
  if (verb === "who-imports") {
    if (!target) fail({ ok: false, reason: "missing-target", verb });
    const { results, tier, coverage } = queryWhoImports(index, target);
    emit({ ok: true, verb, target, results, tier, coverage });

  } else if (verb === "who-calls") {
    if (!target) fail({ ok: false, reason: "missing-target", verb });
    const queryResult = queryWhoCalls(index, target);
    if (queryResult.ambiguous) {
      // [RULE] who-calls-function-identity-disambiguated
      process.stdout.write(JSON.stringify({
        ok: false,
        reason: "ambiguous-function",
        verb,
        target,
        candidates: queryResult.candidates,
      }) + "\n");
      process.exit(2);
    }
    emit({ ok: true, verb, target, results: queryResult.results, tier: queryResult.tier, coverage: queryResult.coverage });

  } else if (verb === "blast-radius") {
    if (!target) fail({ ok: false, reason: "missing-target", verb });
    const { results, tier, coverage } = queryBlastRadius(index, target);
    emit({ ok: true, verb, target, results, tier, coverage });

  } else if (verb === "status") {
    const statusData = queryStatus(index, storePath);
    emit({ ok: true, verb: "status", ...statusData });

  } else if (verb === "cluster") {
    const { results, tier } = queryCluster(index);
    emit({ ok: true, verb: "cluster", results, tier });

  } else if (verb === "dead-code" || verb === "orphan") {
    const { results, tier } = queryDeadCode(index);
    emit({ ok: true, verb: "dead-code", results, tier });

  } else if (verb === "dangling") {
    const { results, tier } = queryDangling(index);
    emit({ ok: true, verb: "dangling", results, tier });

  } else if (verb === "test-impl") {
    const inverse = args.includes("--inverse");
    const { results, tier, mode } = queryTestImpl(index, { inverse });
    emit({ ok: true, verb: "test-impl", mode, results, tier });
  }

  process.exit(0);
}
