"use strict";
/**
 * Guard: the graph require-chain that ships to projects must be COMPLETE.
 *
 * The wired graph consumers (execute/wave disjointness, debug, quick, impact,
 * plan, scan, and now /gsd-t-architect) look for `bin/gsd-t-graph-query-cli.cjs`
 * IN THE PROJECT and fall back to grep when it — or anything it require()s — is
 * missing. update-all copies the files named in PROJECT_BIN_TOOLS. If a graph
 * file gains a NEW local require() but that dependency is not added to
 * PROJECT_BIN_TOOLS, update-all copies an incomplete chain → the CLI throws on
 * load → graph dies silently → every consumer (incl. the architect reuse-check)
 * falls back to grep with no error surfaced.
 *
 * This exact drift shipped once: gsd-t-graph-store-resolver.cjs (added to source
 * in M99, 2026-06-30) was require()d by the query CLI but never added to
 * PROJECT_BIN_TOOLS, so Binvoice's graph was unqueryable until 2026-07-12.
 *
 * This test walks the transitive `require("./...")` chain from each graph entry
 * point and asserts every reachable bin/ file is in PROJECT_BIN_TOOLS. A new
 * un-propagated dependency FAILS here instead of silently disabling the graph.
 */

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const BIN_DIR = path.resolve(__dirname, "..", "bin");
const { PROJECT_BIN_TOOLS } = require(path.join(BIN_DIR, "gsd-t.js"));

// Entry points that ship to projects and drive the graph at runtime.
const GRAPH_ENTRY_POINTS = [
  "gsd-t-graph-query-cli.cjs",
  "gsd-t-graph-index.cjs",
  "gsd-t-graph-freshness.cjs",
];

// Extract every `require("./x.cjs")` (relative, same-dir bin file) from a source.
function localRequires(file) {
  const src = fs.readFileSync(path.join(BIN_DIR, file), "utf8");
  const out = new Set();
  const re = /require\(\s*["']\.\/([A-Za-z0-9._-]+\.cjs)["']\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) out.add(m[1]);
  return out;
}

// Transitive closure of local requires reachable from the entry points.
function reachableChain(entryPoints) {
  const seen = new Set();
  const stack = [...entryPoints];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    const full = path.join(BIN_DIR, f);
    if (!fs.existsSync(full)) continue; // reported separately below
    for (const dep of localRequires(f)) stack.push(dep);
  }
  return seen;
}

test("graph require-chain: every entry point exists in bin/", () => {
  for (const ep of GRAPH_ENTRY_POINTS) {
    assert.ok(fs.existsSync(path.join(BIN_DIR, ep)), `${ep} must exist in bin/`);
  }
});

test("graph require-chain: every transitively-required bin/ file is in PROJECT_BIN_TOOLS", () => {
  const chain = reachableChain(GRAPH_ENTRY_POINTS);
  const list = new Set(PROJECT_BIN_TOOLS);
  const missing = [];
  for (const f of chain) {
    // Only assert on files that actually exist in bin/ (a stale require to a
    // deleted file is a different bug; existence is checked below).
    if (!fs.existsSync(path.join(BIN_DIR, f))) continue;
    if (!list.has(f)) missing.push(f);
  }
  assert.deepStrictEqual(
    missing, [],
    `These graph require-chain files exist in bin/ but are NOT in PROJECT_BIN_TOOLS, ` +
    `so update-all would ship an incomplete chain and silently break the project graph: ${missing.join(", ")}`
  );
});

test("graph require-chain: no require points at a nonexistent bin/ file", () => {
  const chain = reachableChain(GRAPH_ENTRY_POINTS);
  const broken = [];
  for (const f of chain) {
    if (!fs.existsSync(path.join(BIN_DIR, f))) broken.push(f);
  }
  assert.deepStrictEqual(broken, [],
    `A graph file require()s a bin/ file that does not exist: ${broken.join(", ")}`);
});

test("graph require-chain: the specific regression file is present + propagated", () => {
  // gsd-t-graph-store-resolver.cjs — the file whose omission broke Binvoice's graph.
  assert.ok(fs.existsSync(path.join(BIN_DIR, "gsd-t-graph-store-resolver.cjs")),
    "resolver must exist in source");
  assert.ok(PROJECT_BIN_TOOLS.includes("gsd-t-graph-store-resolver.cjs"),
    "resolver must be in PROJECT_BIN_TOOLS so update-all ships it");
});
