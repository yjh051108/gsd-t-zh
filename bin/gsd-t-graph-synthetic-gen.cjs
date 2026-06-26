"use strict";

/**
 * gsd-t-graph-synthetic-gen — M94 D1-T1
 *
 * Synthetic ~1.5M-node graph generator for the K1 store bake-off spike.
 * Produces a deterministic (seeded) node/edge set at configurable scale
 * (default ~1.5M nodes, Atos scale hypothesis).
 *
 * Node types: FILE + FUNCTION/ENTITY nodes.
 * Edge types: import (file→file) + call (function→function, funcId-keyed).
 *
 * Each node/edge carries the candidate schema fields:
 *   node: { id, kind, tier, contentHash, file, name? }
 *   edge: { kind, src, dst }  — where src/dst are funcId / file paths
 *
 * Envelope emitted to stdout:
 *   { ok: true, nodes: [...], edges: [...], seed, scale, nodeCount, edgeCount }
 *   or { ok: false, error: "..." } on failure
 *
 * CLI:
 *   node bin/gsd-t-graph-synthetic-gen.cjs [--nodes N] [--seed S] [--out FILE]
 *   Flags:
 *     --nodes N   total graph-node count (files + function/entity nodes), default 1500000
 *     --seed  S   integer seed for deterministic output, default 42
 *     --out FILE  write envelope JSON to FILE instead of stdout
 *     --small     alias for --nodes 10000 (fast test mode)
 *     --tiny      alias for --nodes 500 (unit-test mode, returned in-memory)
 *
 * Exit: 0 on success, 1 on error.
 * Zero external deps — Node built-ins only.
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

// ─── Seeded PRNG (xorshift32) ─────────────────────────────────────────────
// Reproducible across Node versions without external deps.
function makePrng(seed) {
  let s = (seed >>> 0) || 1; // ensure non-zero uint32
  return function () {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s = s >>> 0;
    return s / 0x100000000;
  };
}

// ─── Schema-field generators ──────────────────────────────────────────────
const TIERS = ["compiler-accurate", "tree-sitter-floor"];
const LANGS = ["ts", "js", "py", "rs"];
const EXT_MAP = { ts: ".ts", js: ".js", py: ".py", rs: ".rs" };
const KINDS_FILE = ["FILE"];
const KINDS_ENTITY = ["FUNCTION", "CLASS", "EXPORT"];

// Stable short hash placeholder (not crypto-strong — content-hash placeholder)
function syntheticHash(rng) {
  // 8-char hex (deterministic from rng, not filesystem)
  let h = "";
  for (let i = 0; i < 8; i++) {
    h += Math.floor(rng() * 16).toString(16);
  }
  return h;
}

// ─── Graph generation ─────────────────────────────────────────────────────

/**
 * Generate a synthetic graph at `targetNodeCount` total nodes (FILE + FUNCTION/ENTITY).
 *
 * Atos-scale observation: real JS/TS repos have roughly 3–5 functions per file.
 * We target FILE nodes = ~20% of total, ENTITY nodes = ~80%.
 * Edge densities:
 *   import edges: ~3 per file node on average (fan-out import graph)
 *   call edges:   ~4 per function entity on average (call graph)
 *
 * @param {number} targetNodeCount
 * @param {number} seed
 * @returns {{ nodes: object[], edges: object[], nodeCount: number, edgeCount: number }}
 */
function generateGraph(targetNodeCount, seed) {
  const rng = makePrng(seed);

  // ── Node counts ──────────────────────────────────────────────────────────
  const fileCount = Math.max(1, Math.round(targetNodeCount * 0.2));
  const entityCount = Math.max(1, targetNodeCount - fileCount);

  const nodes = [];
  const edges = [];

  // ── FILE nodes ───────────────────────────────────────────────────────────
  // Generate file paths that look like a real repo
  const filePaths = [];
  const dirs = [
    "src", "lib", "bin", "core", "utils", "api", "models", "controllers",
    "services", "handlers", "parsers", "validators", "transforms", "types",
    "helpers", "middleware", "routes", "adapters", "stores", "queries"
  ];
  const prefixes = [
    "user", "auth", "index", "main", "core", "base", "common", "shared",
    "graph", "cache", "config", "logger", "client", "server", "worker",
    "loader", "parser", "builder", "factory", "manager"
  ];

  for (let i = 0; i < fileCount; i++) {
    const lang = LANGS[Math.floor(rng() * LANGS.length)];
    const ext = EXT_MAP[lang];
    const dir = dirs[Math.floor(rng() * dirs.length)];
    const prefix = prefixes[Math.floor(rng() * prefixes.length)];
    const filePath = `${dir}/${prefix}-${i}${ext}`;
    const contentHash = syntheticHash(rng);
    const tier = TIERS[Math.floor(rng() * TIERS.length)];

    filePaths.push(filePath);
    nodes.push({
      id: filePath,
      kind: "FILE",
      tier,
      contentHash,
      file: filePath,
    });
  }

  // ── ENTITY nodes (functions / classes / exports) ─────────────────────────
  // Each entity is file-qualified: funcId = "file#name" or "file#name@line"
  // for disambiguation when multiple same-named entities exist per file.
  // Entities are distributed across file nodes.
  const entityNodes = [];
  const funcIds = [];

  // Distribution: every file gets at least 1 entity; remainder distributed randomly
  const basePerFile = Math.max(1, Math.floor(entityCount / fileCount));
  let entityIdx = 0;

  for (let fi = 0; fi < filePaths.length && entityIdx < entityCount; fi++) {
    const filePath = filePaths[fi];
    // How many entities for this file?
    const extras = fi === filePaths.length - 1
      ? entityCount - entityIdx  // last file gets all remaining
      : Math.round(rng() * basePerFile * 1.5);
    const count = Math.min(extras, entityCount - entityIdx);

    const kindPool = KINDS_ENTITY;
    const funcNamesUsed = new Set();

    for (let ei = 0; ei < count && entityIdx < entityCount; ei++, entityIdx++) {
      const kind = kindPool[Math.floor(rng() * kindPool.length)];
      const baseName = `fn_${entityIdx}`;
      // Make funcId file-qualified and unique within the file
      const funcName = funcNamesUsed.has(baseName)
        ? `${baseName}_${ei}`
        : baseName;
      funcNamesUsed.add(funcName);
      const funcId = `${filePath}#${funcName}`;
      const tier = TIERS[Math.floor(rng() * TIERS.length)];
      const contentHash = syntheticHash(rng);

      funcIds.push(funcId);
      const node = {
        id: funcId,
        kind,
        tier,
        contentHash,
        file: filePath,
        name: funcName,
        funcId,
      };
      entityNodes.push(node);
    }
  }

  nodes.push(...entityNodes);

  // ── IMPORT edges (file→file) ─────────────────────────────────────────────
  // Avg ~3 import edges per file node. Fan-out from each file to random other files.
  // No self-loops.
  const avgImports = 3;
  for (let fi = 0; fi < filePaths.length; fi++) {
    const src = filePaths[fi];
    const count = Math.max(0, Math.round(rng() * avgImports * 2));
    for (let k = 0; k < count; k++) {
      let dstIdx = Math.floor(rng() * filePaths.length);
      if (dstIdx === fi) dstIdx = (fi + 1) % filePaths.length;
      edges.push({ kind: "IMPORT", src, dst: filePaths[dstIdx] });
    }
  }

  // ── CALL edges (funcId→funcId) ───────────────────────────────────────────
  // Avg ~4 call edges per entity node.
  if (funcIds.length > 1) {
    const avgCalls = 4;
    for (let ei = 0; ei < funcIds.length; ei++) {
      const caller = funcIds[ei];
      const count = Math.max(0, Math.round(rng() * avgCalls * 2));
      for (let k = 0; k < count; k++) {
        let dstIdx = Math.floor(rng() * funcIds.length);
        if (dstIdx === ei) dstIdx = (ei + 1) % funcIds.length;
        edges.push({ kind: "CALL", src: caller, dst: funcIds[dstIdx] });
      }
    }
  }

  return {
    nodes,
    edges,
    nodeCount: nodes.length,
    edgeCount: edges.length,
  };
}

// ─── CLI entry point ──────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = argv.slice(2);
  let nodes = 1_500_000;
  let seed = 42;
  let out = null;
  let i = 0;
  while (i < args.length) {
    const a = args[i];
    if (a === "--nodes" && args[i + 1]) {
      nodes = parseInt(args[++i], 10);
    } else if (a === "--seed" && args[i + 1]) {
      seed = parseInt(args[++i], 10);
    } else if (a === "--out" && args[i + 1]) {
      out = args[++i];
    } else if (a === "--small") {
      nodes = 10_000;
    } else if (a === "--tiny") {
      nodes = 500;
    }
    i++;
  }
  return { nodes, seed, out };
}

// Export for programmatic use (tests)
function generate(opts = {}) {
  const nodes = opts.nodes ?? 500;
  const seed = opts.seed ?? 42;
  const result = generateGraph(nodes, seed);
  return {
    ok: true,
    nodes: result.nodes,
    edges: result.edges,
    seed,
    scale: nodes,
    nodeCount: result.nodeCount,
    edgeCount: result.edgeCount,
  };
}

module.exports = { generate, generateGraph, makePrng };

// ─── CLI main ─────────────────────────────────────────────────────────────
if (require.main === module) {
  const { nodes, seed, out } = parseArgs(process.argv);

  let envelope;
  try {
    if (isNaN(nodes) || nodes < 1) {
      throw new Error(`--nodes must be a positive integer, got: ${nodes}`);
    }
    if (isNaN(seed)) {
      throw new Error(`--seed must be an integer, got: ${seed}`);
    }
    const result = generateGraph(nodes, seed);
    envelope = {
      ok: true,
      nodes: result.nodes,
      edges: result.edges,
      seed,
      scale: nodes,
      nodeCount: result.nodeCount,
      edgeCount: result.edgeCount,
    };
  } catch (err) {
    envelope = { ok: false, error: err.message };
    process.stdout.write(JSON.stringify(envelope) + "\n");
    process.exit(1);
  }

  const json = JSON.stringify(envelope, null, 2);
  if (out) {
    fs.writeFileSync(out, json, "utf8");
    // Summary to stdout when writing to file
    const summary = {
      ok: true,
      seed: envelope.seed,
      scale: envelope.scale,
      nodeCount: envelope.nodeCount,
      edgeCount: envelope.edgeCount,
      writtenTo: out,
    };
    process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  } else {
    process.stdout.write(json + "\n");
  }
  process.exit(0);
}
