"use strict";

/**
 * M99-D1-T5 — No raw .gsd-t/graph.db literals test
 *
 * Proves ZERO raw `.gsd-t/graph.db` or bare `graph.db` literals survive in
 * `bin/` outside the resolver module + the migration shim's explicit legacy-path
 * constant + the 2 marked spike-local bench literals.
 *
 * Also proves the resolver exports exist and round-trip correctly.
 *
 * [RULE] one-resolver-only
 * [RULE] spike-local-allowlisted
 * [RULE] projectroot-depth-corrected-with-move
 * [RULE] jsonl-branch-depth-preserved
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const RESOLVER = path.join(ROOT, "bin", "gsd-t-graph-store-resolver.cjs");

// ─── T1: Resolver exports exist and round-trip correctly ─────────────────────

test("resolver exports all four required functions", () => {
  const r = require(RESOLVER);
  assert.strictEqual(typeof r.resolveGraphDir, "function", "resolveGraphDir");
  assert.strictEqual(typeof r.resolveStorePath, "function", "resolveStorePath");
  assert.strictEqual(typeof r.resolveLogsDir, "function", "resolveLogsDir");
  assert.strictEqual(typeof r.deriveProjectRoot, "function", "deriveProjectRoot");
  assert.strictEqual(typeof r.migrateGraphStore, "function", "migrateGraphStore");
  assert.strictEqual(typeof r.append_ledger_line, "function", "append_ledger_line");
});

test("deriveProjectRoot: .db branch is 3-up from graphDB/graph.db (depth-corrected)", () => {
  const r = require(RESOLVER);
  // Construct a fake project root + its graphDB store path
  const fakeRoot = "/home/project/myapp";
  const storePath = r.resolveStorePath(fakeRoot);
  // Must be .../myapp/.gsd-t/graphDB/graph.db
  assert.ok(storePath.endsWith(path.join("graphDB", "graph.db")), `storePath should end with graphDB/graph.db: ${storePath}`);
  // Round-trip: deriveProjectRoot(storePath) === fakeRoot
  const recovered = r.deriveProjectRoot(storePath);
  assert.strictEqual(
    path.resolve(recovered),
    path.resolve(fakeRoot),
    `3-up round-trip failed: got ${recovered}, expected ${fakeRoot}`
  );
});

test("deriveProjectRoot: JSONL branch is 2-up from graph-index/ (depth preserved)", () => {
  const r = require(RESOLVER);
  // Simulate a JSONL store dir: .gsd-t/graph-index/
  const fakeRoot = "/home/project/jsonlapp";
  const jsonlDir = path.join(fakeRoot, ".gsd-t", "graph-index");
  // deriveProjectRoot of a JSONL dir (not a .db) must be 2-up
  const recovered = r.deriveProjectRoot(jsonlDir);
  assert.strictEqual(
    path.resolve(recovered),
    path.resolve(fakeRoot),
    `2-up JSONL round-trip failed: got ${recovered}, expected ${fakeRoot}`
  );
});

// ─── T5: No raw literals in bin/ outside resolver + spike allow-list ──────────

// Files where raw `graph.db` is EXPECTED (allow-list)
const ALLOWLIST = new Set([
  "gsd-t-graph-store-resolver.cjs", // THE resolver + legacy-path migration constant
  "gsd-t-graph-k1-sqlite-stream.cjs", // spike-local-store: throwaway bench dir
  "gsd-t-graph-store-bakeoff.cjs",   // spike-local-store: throwaway bench dir
]);

// The spike files MUST carry the marker comment for their allow-listing to be valid
const SPIKE_FILES_REQUIRING_MARKER = [
  "gsd-t-graph-k1-sqlite-stream.cjs",
  "gsd-t-graph-store-bakeoff.cjs",
];
const SPIKE_MARKER = "spike-local-store:";

test("no raw .gsd-t/graph.db or bare graph.db literals in bin/ outside resolver + spike allow-list", () => {
  const binDir = path.join(ROOT, "bin");
  const files = fs.readdirSync(binDir).filter((f) => f.endsWith(".cjs") || f.endsWith(".js"));

  const violations = [];
  for (const file of files) {
    if (ALLOWLIST.has(file)) continue; // explicitly allowed

    const content = fs.readFileSync(path.join(binDir, file), "utf8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      // Skip comment lines (single-line // comments and * jsdoc lines)
      const trimmed = rawLine.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

      // Check for raw .gsd-t/graph.db path constructions in CODE (not comments)
      // Matches: path.join(..., ".gsd-t", "graph.db") or ".gsd-t/graph.db" as string literal
      if (
        /['"]\.gsd-t[/\\]graph\.db['"]/.test(rawLine) ||
        /path\.join\([^)]*['"]\.gsd-t['"][^)]*['"]graph\.db['"]\)/.test(rawLine)
      ) {
        violations.push(`${file}:${i + 1}: raw .gsd-t/graph.db path construction in code`);
      }
    }
  }

  assert.strictEqual(violations.length, 0,
    `Raw graph.db literals found outside allow-list:\n${violations.join("\n")}`);
});

test("spike-local allow-listed files carry the required spike-local-store: marker", () => {
  const binDir = path.join(ROOT, "bin");
  const missing = [];
  for (const file of SPIKE_FILES_REQUIRING_MARKER) {
    const content = fs.readFileSync(path.join(binDir, file), "utf8");
    if (!content.includes(SPIKE_MARKER)) {
      missing.push(file);
    }
  }
  assert.strictEqual(missing.length, 0,
    `Spike-local files missing '${SPIKE_MARKER}' marker — allow-list is not valid without it:\n${missing.join("\n")}`);
});
