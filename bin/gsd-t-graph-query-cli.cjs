#!/usr/bin/env node
"use strict";

/**
 * gsd-t-graph-query-cli — M94 D5
 *
 * The DETERMINISTIC query CLI the model cannot route around — the no-stale-no-wrong KEYSTONE.
 *
 * Verbs:
 *   gsd-t graph who-imports <file>             — file→file reverse import edges
 *   gsd-t graph who-calls <file#function>      — function→function reverse call edges (funcId-keyed)
 *   gsd-t graph blast-radius <target>          — UNION of import-graph + call-graph reverse-reachable set (transitive)
 *   gsd-t graph status                         — live queryable index state
 *
 * Invariants (all verified by keystone tests):
 *   [RULE] query-cli-never-greps       — NO directive-driven grep fallback in any code path
 *   [RULE] parser-fail-disables-loud-never-silent — genuine parser/store failure → {ok:false, reason:'graph-unavailable'}
 *   [RULE] stale-file-reindexed-before-answer  — D4 freshness check INLINE before answering
 *   [RULE] who-calls-function-identity-disambiguated — bare name matching multiple funcIds → ambiguous-function
 *   [RULE] blast-radius-unions-both-graphs     — UNION of import + call reverse-reachable, transitive closure
 *   [RULE] graph-status-live                   — status returns a live queryable index (M20–M21 anti-goal fails)
 *
 * Dependencies (fail-loud if absent — never silently fall back):
 *   bin/gsd-t-graph-freshness.cjs  — D4: freshness_check_on_query + compute_touched_files
 *   bin/gsd-t-graph-index.cjs      — D3: parse_and_put (called by D4, not directly here)
 *
 * Zero external runtime deps for the installer. Sync file APIs. JSON envelope output.
 *
 * JSON envelope shapes:
 *   { ok: true,  verb: "who-imports|who-calls|blast-radius|status", target: "...", results: [...], tier: "..." }
 *   { ok: false, reason: "graph-unavailable" }
 *   { ok: false, reason: "ambiguous-function", verb: "who-calls", target: "foo", candidates: ["a.ts#foo","b.ts#foo"] }
 *   { ok: false, reason: "unknown-target", verb: "...", target: "..." }
 *
 * CLI usage:
 *   node bin/gsd-t-graph-query-cli.cjs who-imports src/foo.ts
 *   node bin/gsd-t-graph-query-cli.cjs who-calls 'src/foo.ts#bar'
 *   node bin/gsd-t-graph-query-cli.cjs blast-radius src/foo.ts
 *   node bin/gsd-t-graph-query-cli.cjs status
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
 *             funcEntities: Map<string,{name:string,file:string}>,
 *             allFiles: Set<string>, tier: string }} IndexStructure
 */

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
 * Build in-memory index structures from raw records.
 *
 * importGraph: Map<dstFile, Set<srcFile>> — reverse import edges (who imports dstFile)
 * callGraph:   Map<dstFuncId, Set<srcFuncId>> — reverse call edges (who calls dstFuncId)
 * funcEntities: Map<funcId, {name, file}> — entity lookup for bare-name disambiguation
 * allFiles:    Set<string> — all indexed file paths
 *
 * @param {object[]} records
 * @returns {IndexStructure}
 */
function buildIndex(records) {
  /** @type {Map<string,Set<string>>} */
  const importGraph = new Map();
  /** @type {Map<string,Set<string>>} */
  const callGraph = new Map();
  /** @type {Map<string,{name:string,file:string}>} */
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

    // Index entities for bare-name disambiguation
    if (Array.isArray(rec.entities)) {
      for (const ent of rec.entities) {
        if (ent.funcId) {
          funcEntities.set(ent.funcId, { name: ent.name, file: ent.file });
        }
      }
    }

    // Build reverse edge indices
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
        }
      }
    }
  }

  if (hasStaleScip) dominantTier = "tree-sitter-floor-STALE-SCIP";
  else if (hasFloor) dominantTier = "tree-sitter-floor";

  return { importGraph, callGraph, funcEntities, allFiles, tier: dominantTier };
}

// ─── Load store + build index (fail-loud on any failure) ─────────────────────

/**
 * Load the on-disk store and build the in-memory index.
 * Returns { ok: true, index: IndexStructure } on success.
 * Returns { ok: false, reason: 'graph-unavailable' } on any load failure.
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
    const index = buildIndex(loaded.records);
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
 * @param {IndexStructure} index
 * @param {string} target  repo-relative POSIX path
 * @returns {{ results: string[], tier: string }}
 */
function queryWhoImports(index, target) {
  const importers = index.importGraph.get(target);
  const results = importers ? Array.from(importers).sort() : [];
  return { results, tier: index.tier };
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

  if (isFuncId) {
    // File-qualified identity — exact funcId lookup
    const callers = index.callGraph.get(identity);
    const results = callers ? Array.from(callers).sort() : [];
    return { results, tier: index.tier };
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
    return { results: [], tier: index.tier };
  }

  if (matchingFuncIds.length === 1) {
    // Unambiguous bare name — resolve directly
    const callers = index.callGraph.get(matchingFuncIds[0]);
    const results = callers ? Array.from(callers).sort() : [];
    return { results, tier: index.tier };
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
  return { results, tier: index.tier };
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

// ─── Public API (for tests to import directly) ────────────────────────────────
// Tests build an index from fixture records, then call these pure functions.
// The query CLI is the only caller of runFreshnessCheck (integration seam).

/**
 * Build an IndexStructure from an array of store records.
 * Used by tests to construct fixture-based indices without disk I/O.
 */
function buildIndexFromRecords(records) {
  return buildIndex(records);
}

module.exports = {
  buildIndexFromRecords,
  queryWhoImports,
  queryWhoCalls,
  queryBlastRadius,
  queryStatus,
  loadStore,
  runFreshnessCheck,
  resolveStorePath,
  // Exported for fault-injection tests
  loadFreshnessModule,
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

  if (!verb) {
    fail({ ok: false, reason: "no-verb", usage: "gsd-t graph <who-imports|who-calls|blast-radius|status> [target]" });
  }

  if (!["who-imports", "who-calls", "blast-radius", "status"].includes(verb)) {
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
    const { results, tier } = queryWhoImports(index, target);
    emit({ ok: true, verb, target, results, tier });

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
    emit({ ok: true, verb, target, results: queryResult.results, tier: queryResult.tier });

  } else if (verb === "blast-radius") {
    if (!target) fail({ ok: false, reason: "missing-target", verb });
    const { results, tier } = queryBlastRadius(index, target);
    emit({ ok: true, verb, target, results, tier });

  } else if (verb === "status") {
    const statusData = queryStatus(index, storePath);
    emit({ ok: true, verb: "status", ...statusData });
  }

  process.exit(0);
}
