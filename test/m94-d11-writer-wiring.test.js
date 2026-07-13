"use strict";

/**
 * M94-D11 — Writer Command Wiring Test (manifest-driven)
 *
 * [RULE] writer-wiring-test-manifest-driven
 * [RULE] execute-disjointness-graph-aware-dependency-overlap
 * [RULE] execute-disjointness-fail-loud-halts-never-grep-guess
 * [RULE] debug-reader-and-writer-both
 * [RULE] quick-writer-pattern
 * [RULE] test-sync-uses-test-impl-verb
 * [RULE] design-build-writer-pattern
 *
 * Design (manifest-driven, T0 owns this file):
 *   Reads the d8 consumer manifest and for each WRITER-role row asserts:
 *   1. The command file directs its mapped structural graph query (not grep/raw-read)
 *      for the structural question (READER half).
 *   2. The command or workflow file directs a re-index of touched files after edits
 *      (WRITER half — re-index / freshness trigger).
 *   3. The command fails LOUD on graph-unavailable (no silent grep fallback).
 *   4. The command passes the d8 anti-grep lint (no structural-grep-fallback).
 *
 *   Additionally:
 *   5. execute/wave disjointness: the disjointness check consults the graph
 *      (not only literal Touches overlap) — SAFETY-CRITICAL.
 *   6. debug: BOTH reader (blast-radius/who-calls) AND writer (re-index) halves present.
 *   7. test-sync: uses the test-impl+untested-impl verbs.
 *   8. design-build: uses who-imports/cluster verb.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const CONTRACT_PATH = path.join(ROOT, ".gsd-t", "contracts", "graph-consumer-wiring-contract.md");

// ─── Helpers (shared with d10 reader test) ───────────────────────────────────

/**
 * Parse the §Consumer Manifest table from the wiring contract.
 * Returns an array of {commandFile, workflowFile, role, verbs, replacesGrepFor}.
 */
function parseManifest(contractText) {
  const rows = [];
  const lines = contractText.split("\n");
  let inTable = false;
  let headerPassed = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!inTable) {
      if (trimmed.startsWith("| Command File") && trimmed.includes("Workflow File")) {
        inTable = true;
        headerPassed = false;
        continue;
      }
      continue;
    }
    if (!headerPassed) {
      if (trimmed.startsWith("|---") || trimmed.startsWith("| ---")) {
        headerPassed = true;
      }
      continue;
    }
    if (!trimmed.startsWith("|")) break;
    const cols = trimmed.split("|").slice(1, -1).map((c) => c.trim());
    if (cols.length < 5) continue;
    const strip = (s) => s.replace(/^`|`$/g, "").trim();
    const [commandFile, workflowFile, role, verbs, replacesGrepFor] = cols.map(strip);
    if (!commandFile || commandFile.startsWith("_(") || commandFile.startsWith("_d")) continue;
    rows.push({ commandFile, workflowFile, role, verbs, replacesGrepFor });
  }
  return rows;
}

/**
 * Read a repo file as UTF-8. Returns null if missing.
 */
function readFile(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, "utf8");
}

/**
 * Check whether a text contains a structural-grep fallback (in a catch/else after a graph query).
 * Returns the offending line text or null if clean.
 */
function detectStructuralGrepFallback(text) {
  if (!text) return null;
  const structuralVerbs = [
    "who-imports", "who-calls", "blast-radius", "dependents",
    "dead-code", "orphan", "cycles", "cluster", "test-impl",
  ];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;
    if (trimmed.includes("grep") && !trimmed.includes("grep(") && !trimmed.includes("execSync") &&
        !trimmed.includes("spawn") && !trimmed.includes("`grep ")) continue;
    const hasGrepCall =
      (trimmed.includes("execSync") && trimmed.includes("grep")) ||
      (trimmed.includes("`grep ")) ||
      (trimmed.includes('"grep ')) ||
      (trimmed.includes("'grep "));
    if (!hasGrepCall) continue;
    if (/TODO|FIXME|NOTE|carve.out|exempt|legitimate|text.search|text-search|announced|text-content/i.test(line)) continue;
    const context = lines.slice(Math.max(0, i - 15), i).join("\n");
    const hasGraphQuery = structuralVerbs.some((v) =>
      context.includes(`graph ${v}`) || context.includes(`gsd-t graph`) || context.includes(`graph-query`)
    );
    const inFallback = /\b(catch|else if|else\s*\{|fallback|\|\|)\b/.test(context.slice(-400));
    if (hasGraphQuery && inFallback) {
      return line;
    }
  }
  return null;
}

// ─── Core: manifest-driven writer assertions ──────────────────────────────────

test("[RULE writer-wiring-test-manifest-driven] manifest has writer rows after d11 wiring", () => {
  const contractText = fs.readFileSync(CONTRACT_PATH, "utf8");
  const rows = parseManifest(contractText);
  const writerRows = rows.filter((r) => r.role === "writer");
  assert.ok(
    writerRows.length > 0,
    "consumer manifest must have at least one writer-role row after d11 wiring"
  );
});

test("[RULE writer-wiring-test-manifest-driven] each writer row: command file exists and references its mapped structural verb (READER half)", () => {
  const contractText = fs.readFileSync(CONTRACT_PATH, "utf8");
  const rows = parseManifest(contractText);
  const writerRows = rows.filter((r) => r.role === "writer");
  assert.ok(writerRows.length > 0, "must have at least one writer row");

  for (const row of writerRows) {
    const cmdText = readFile(row.commandFile);
    assert.ok(
      cmdText !== null,
      `writer command file ${row.commandFile} must exist`
    );
    const verbs = row.verbs.split(",").map((v) => v.trim()).filter(Boolean);
    for (const verb of verbs) {
      assert.ok(
        cmdText.includes(verb) || cmdText.includes(verb.replace("-", " ")),
        `writer command file ${row.commandFile} must reference structural verb "${verb}" from the manifest (READER half)`
      );
    }
  }
});

test("[RULE consumer-structural-grep-removed] each writer row: fails LOUD on graph-unavailable (no silent grep)", () => {
  const contractText = fs.readFileSync(CONTRACT_PATH, "utf8");
  const rows = parseManifest(contractText);
  const writerRows = rows.filter((r) => r.role === "writer");

  for (const row of writerRows) {
    const cmdText = readFile(row.commandFile);
    if (!cmdText) continue;
    assert.ok(
      cmdText.includes("graph-unavailable") ||
        cmdText.includes("graph unavailable") ||
        cmdText.includes("fail loud") ||
        cmdText.includes("FAIL LOUD") ||
        cmdText.includes("FAIL-LOUD") ||
        cmdText.includes("gsd-t graph status"),
      `writer command file ${row.commandFile} must document fail-loud on graph-unavailable [RULE consumer-structural-grep-removed]`
    );
  }
});

test("[RULE consumer-structural-grep-removed] each writer row: command file has no structural-grep fallback (anti-grep lint)", () => {
  const contractText = fs.readFileSync(CONTRACT_PATH, "utf8");
  const rows = parseManifest(contractText);
  const writerRows = rows.filter((r) => r.role === "writer");

  for (const row of writerRows) {
    const cmdText = readFile(row.commandFile);
    if (!cmdText) continue;
    const fallback = detectStructuralGrepFallback(cmdText);
    assert.equal(
      fallback, null,
      `writer command file ${row.commandFile} must NOT have a structural-grep fallback — found: ${fallback}`
    );
    // Also check the workflow file if it is distinct from the phase workflow
    if (row.workflowFile && row.workflowFile !== "templates/workflows/gsd-t-phase.workflow.js") {
      const wfText = readFile(row.workflowFile);
      if (wfText) {
        const wfFallback = detectStructuralGrepFallback(wfText);
        assert.equal(
          wfFallback, null,
          `writer workflow file ${row.workflowFile} must NOT have a structural-grep fallback — found: ${wfFallback}`
        );
      }
    }
  }
});

test("each writer row: command or workflow file directs re-index of touched files after edits (WRITER half)", () => {
  const contractText = fs.readFileSync(CONTRACT_PATH, "utf8");
  const rows = parseManifest(contractText);
  const writerRows = rows.filter((r) => r.role === "writer");
  assert.ok(writerRows.length > 0, "must have at least one writer row");

  for (const row of writerRows) {
    const cmdText = readFile(row.commandFile) || "";
    const wfText = (row.workflowFile && readFile(row.workflowFile)) || "";
    const combined = cmdText + "\n" + wfText;
    // The WRITER half must direct a re-index or freshness trigger on the touched set.
    // Acceptable patterns: "re-index", "reindex", "freshness", "gsd-t graph", "graph query",
    // "freshness_check_on_query", "touched files", "re-indexes touched"
    const hasReIndex =
      combined.includes("re-index") ||
      combined.includes("reindex") ||
      combined.includes("freshness") ||
      combined.includes("freshness_check_on_query") ||
      combined.includes("touched files") ||
      combined.includes("re-indexes") ||
      combined.includes("WRITER") ||
      combined.includes("writer half") ||
      combined.includes("WRITER half") ||
      combined.includes("re-indexe");
    assert.ok(
      hasReIndex,
      `writer command/workflow "${row.commandFile}" must direct a re-index/freshness trigger after edits (WRITER half)`
    );
  }
});

// ─── T1: execute/wave — SAFETY-CRITICAL disjointness ─────────────────────────

test("[RULE execute-disjointness-graph-aware-dependency-overlap] execute command documents graph-aware disjointness", () => {
  const text = readFile("commands/gsd-t-execute.md");
  assert.ok(text, "commands/gsd-t-execute.md must exist");
  assert.ok(
    text.includes("graph") || text.includes("disjointness"),
    "execute command must reference graph-aware disjointness"
  );
  assert.ok(
    text.includes("graph-unavailable") ||
      text.includes("FAIL LOUD") ||
      text.includes("fail loud") ||
      text.includes("FAIL-LOUD") ||
      text.includes("halts"),
    "execute command must document fail-loud halts on graph-unavailable [RULE execute-disjointness-fail-loud-halts-never-grep-guess]"
  );
});

test("[RULE execute-disjointness-graph-aware-dependency-overlap] bin/gsd-t-file-disjointness.cjs has graph-aware check", () => {
  const text = readFile("bin/gsd-t-file-disjointness.cjs");
  assert.ok(text, "bin/gsd-t-file-disjointness.cjs must exist");
  // Must reference graph query CLI or graph-aware dependency check
  const hasGraphCheck =
    text.includes("gsd-t graph") ||
    text.includes("graph-query") ||
    text.includes("who-imports") ||
    text.includes("blast-radius") ||
    text.includes("queryGraphDisjointness") ||
    text.includes("graphAwareDisjointness") ||
    text.includes("graph_unavailable") ||
    text.includes("graph-unavailable");
  assert.ok(hasGraphCheck, "bin/gsd-t-file-disjointness.cjs must have graph-aware dependency check [RULE execute-disjointness-graph-aware-dependency-overlap]");
});

test("[RULE execute-disjointness-fail-loud-halts-never-grep-guess] disjointness check fails LOUD on graph-unavailable", () => {
  const text = readFile("bin/gsd-t-file-disjointness.cjs");
  assert.ok(text, "bin/gsd-t-file-disjointness.cjs must exist");
  // Must have the fail-loud halt message (not a silent grep fallback)
  const hasFailLoud =
    text.includes("graph-unavailable") ||
    text.includes("graph unavailable") ||
    text.includes("FAIL LOUD") ||
    text.includes("fail loud") ||
    text.includes("HALT");
  assert.ok(hasFailLoud, "disjointness check must fail LOUD on graph-unavailable [RULE execute-disjointness-fail-loud-halts-never-grep-guess]");
  // Must NOT have a silent grep reconstruction of dependency info (the anti-goal)
  const fallback = detectStructuralGrepFallback(text);
  assert.equal(fallback, null, `disjointness must NOT have a structural-grep fallback — found: ${fallback}`);
});

test("[RULE execute-disjointness-fail-loud-halts-never-grep-guess] wave command inherits execute disjointness fail-loud behavior", () => {
  const text = readFile("commands/gsd-t-wave.md");
  assert.ok(text, "commands/gsd-t-wave.md must exist");
  // Wave inherits execute's disjointness — it should either state this or reference execute/disjointness
  assert.ok(
    text.includes("disjoint") || text.includes("execute") || text.includes("graph"),
    "wave command must reference disjointness inheritance from execute [RULE execute-disjointness-fail-loud-halts-never-grep-guess]"
  );
});

test("[RULE disjointness-bootstrap-escape-not-a-no-recourse-brick] execute command documents bootstrap escape hatch", () => {
  const text = readFile("commands/gsd-t-execute.md");
  assert.ok(text, "commands/gsd-t-execute.md must exist");
  // Bootstrap escape hatch: graph-unavailable must offer an operator escape
  // (either --disjointness-fallback or explicit documented operator escape)
  const hasEscape =
    text.includes("disjointness-fallback") ||
    text.includes("escape") ||
    text.includes("--disjointness-fallback") ||
    text.includes("bootstrap") ||
    text.includes("touches-only") ||
    text.includes("fallback=touches-only");
  assert.ok(hasEscape, "execute command must document bootstrap escape hatch for graph-unavailable [RULE disjointness-bootstrap-escape-not-a-no-recourse-brick]");
});

test("[RULE disjointness-bootstrap-escape-not-a-no-recourse-brick] disjointness check distinguishes graph-unavailable vs graph-says-non-disjoint", () => {
  const text = readFile("bin/gsd-t-file-disjointness.cjs");
  assert.ok(text, "bin/gsd-t-file-disjointness.cjs must exist");
  // Must distinguish the two halt states (unavailable = bootstrap/escapable vs non-disjoint = absolute block)
  const hasDistinction =
    (text.includes("graph-unavailable") && text.includes("non-disjoint")) ||
    (text.includes("unavailable") && text.includes("GRAPH_NON_DISJOINT")) ||
    (text.includes("GRAPH_UNAVAILABLE") && text.includes("NON_DISJOINT")) ||
    (text.includes("graph unavailable") && (text.includes("non-disjoint") || text.includes("nonDisjoint"))) ||
    // The check must handle unavailable separately from verdict=non-disjoint
    (text.includes("graph-unavailable") && text.includes("disjointness-fallback"));
  assert.ok(hasDistinction, "disjointness must distinguish graph-unavailable (bootstrap/escapable) from graph-says-non-disjoint (absolute block) [RULE disjointness-bootstrap-escape-not-a-no-recourse-brick]");
});

test("[RULE execute-disjointness-output-flips-on-graph-edge] existing Touches-overlap check is preserved (additive)", () => {
  const text = readFile("bin/gsd-t-file-disjointness.cjs");
  assert.ok(text, "bin/gsd-t-file-disjointness.cjs must exist");
  // The original Touches-only overlap check must still exist (Destructive Action Guard — additive only)
  assert.ok(
    text.includes("haveOverlap") || text.includes("touches") || text.includes("Touches"),
    "bin/gsd-t-file-disjointness.cjs must preserve the existing Touches-overlap check (additive — Destructive Action Guard)"
  );
  assert.ok(
    text.includes("proveDisjointness"),
    "bin/gsd-t-file-disjointness.cjs must still export proveDisjointness"
  );
});

// ─── T2: /debug — BOTH reader and writer ─────────────────────────────────────

test("[RULE debug-reader-and-writer-both] debug command documents BOTH reader (blast-radius/who-calls) and writer (re-index) halves", () => {
  const text = readFile("commands/gsd-t-debug.md");
  assert.ok(text, "commands/gsd-t-debug.md must exist");
  // READER half: query blast-radius/who-calls to localize
  const hasReader =
    text.includes("blast-radius") || text.includes("who-calls");
  assert.ok(hasReader, "debug command must reference blast-radius or who-calls graph query (READER half) [RULE debug-reader-and-writer-both]");
  // WRITER half: re-index after fix
  const hasWriter =
    text.includes("re-index") || text.includes("reindex") ||
    text.includes("freshness") || text.includes("WRITER") ||
    text.includes("re-indexes") || text.includes("touched files");
  assert.ok(hasWriter, "debug command must reference re-index after fix (WRITER half) [RULE debug-reader-and-writer-both]");
});

test("[RULE debug-reader-and-writer-both] debug workflow has graph query for localization + fail-loud + no grep fallback", () => {
  const text = readFile("templates/workflows/gsd-t-debug.workflow.js");
  assert.ok(text, "templates/workflows/gsd-t-debug.workflow.js must exist");
  // READER half in workflow
  const hasReader =
    text.includes("blast-radius") || text.includes("who-calls") ||
    text.includes("graph") || text.includes("READER") ||
    text.includes("queryStructural");
  assert.ok(hasReader, "debug workflow must direct a graph query for call-chain localization (READER half)");
  // WRITER half in workflow: re-index after fix
  const hasWriter =
    text.includes("re-index") || text.includes("reindex") ||
    text.includes("freshness") || text.includes("WRITER") ||
    text.includes("touched") || text.includes("re-indexes");
  assert.ok(hasWriter, "debug workflow must direct a re-index after fix lands (WRITER half)");
  // Fail-loud
  const hasFailLoud =
    text.includes("graph-unavailable") || text.includes("graph unavailable") ||
    text.includes("FAIL LOUD") || text.includes("fail loud");
  assert.ok(hasFailLoud, "debug workflow must fail loud on graph-unavailable");
  // No structural grep fallback
  const fallback = detectStructuralGrepFallback(text);
  assert.equal(fallback, null, `debug workflow must NOT have a structural-grep fallback — found: ${fallback}`);
  // Existing debug-loop logic must NOT be disrupted (additive)
  assert.ok(
    text.includes("cycle") || text.includes("Cycle"),
    "debug workflow must preserve existing debug-cycle logic (additive — Destructive Action Guard)"
  );
});

// ─── T3: /quick — writer ─────────────────────────────────────────────────────

test("[RULE quick-writer-pattern] quick command documents graph query for structural impact + re-index after edits", () => {
  const text = readFile("commands/gsd-t-quick.md");
  assert.ok(text, "commands/gsd-t-quick.md must exist");
  // READER half: structural impact query
  const hasReader =
    text.includes("blast-radius") || text.includes("who-imports") ||
    text.includes("graph") || text.includes("structural");
  assert.ok(hasReader, "quick command must reference a structural graph query (READER half) [RULE quick-writer-pattern]");
  // WRITER half
  const hasWriter =
    text.includes("re-index") || text.includes("reindex") ||
    text.includes("freshness") || text.includes("WRITER") ||
    text.includes("touched files") || text.includes("re-indexes");
  assert.ok(hasWriter, "quick command must reference re-index after edits (WRITER half) [RULE quick-writer-pattern]");
  // Fail-loud
  assert.ok(
    text.includes("graph-unavailable") || text.includes("graph unavailable") ||
      text.includes("fail loud") || text.includes("FAIL LOUD") ||
      text.includes("FAIL-LOUD"),
    "quick command must document fail-loud on graph-unavailable [RULE quick-writer-pattern]"
  );
});

test("[RULE quick-writer-pattern] quick workflow has graph query + re-index + no structural grep fallback", () => {
  const text = readFile("templates/workflows/gsd-t-quick.workflow.js");
  assert.ok(text, "templates/workflows/gsd-t-quick.workflow.js must exist");
  // READER half
  const hasReader =
    text.includes("blast-radius") || text.includes("who-imports") ||
    text.includes("gsd-t graph") || text.includes("queryGraphStructural") ||
    text.includes("READER") || text.includes("structural");
  assert.ok(hasReader, "quick workflow must direct a structural graph query (READER half) [RULE quick-writer-pattern]");
  // WRITER half
  const hasWriter =
    text.includes("re-index") || text.includes("reindex") ||
    text.includes("freshness") || text.includes("WRITER") ||
    text.includes("touched") || text.includes("re-indexes");
  assert.ok(hasWriter, "quick workflow must direct a re-index after edits (WRITER half) [RULE quick-writer-pattern]");
  // Fail-loud / HALT (Broken-Graph-Halts: a BROKEN graph now HALTS, stronger than the
  // old announced-skip; the workflow surfaces BROKEN + HALT instead of the collapsed
  // "graph-unavailable" string).
  assert.ok(
    text.includes("graph-unavailable") || text.includes("graph unavailable") ||
      text.includes("fail loud") || text.includes("FAIL LOUD") ||
      text.includes("graph BROKEN") || text.includes("HALT"),
    "quick workflow must fail loud / HALT on a broken graph"
  );
  // No structural grep fallback
  const fallback = detectStructuralGrepFallback(text);
  assert.equal(fallback, null, `quick workflow must NOT have a structural-grep fallback — found: ${fallback}`);
  // Existing quick functionality preserved
  assert.ok(
    text.includes("task") || text.includes("Execute"),
    "quick workflow must preserve existing task-execution logic (additive)"
  );
});

// ─── T4: /test-sync and /design-build — generic-runner writers ───────────────

test("[RULE test-sync-uses-test-impl-verb] test-sync command uses test-impl + untested-impl verbs", () => {
  const text = readFile("commands/gsd-t-test-sync.md");
  assert.ok(text, "commands/gsd-t-test-sync.md must exist");
  assert.ok(
    text.includes("test-impl"),
    "test-sync command must reference the test-impl graph verb [RULE test-sync-uses-test-impl-verb]"
  );
  assert.ok(
    text.includes("untested-impl") || text.includes("untested"),
    "test-sync command must reference untested-impl (impl funcs with no test) [RULE test-sync-uses-test-impl-verb]"
  );
  // WRITER half
  const hasWriter =
    text.includes("re-index") || text.includes("reindex") ||
    text.includes("freshness") || text.includes("WRITER") ||
    text.includes("touched files") || text.includes("re-indexes") ||
    text.includes("after writing") || text.includes("after test");
  assert.ok(hasWriter, "test-sync command must reference re-index after writing/updating tests (WRITER half) [RULE test-sync-uses-test-impl-verb]");
  // Fail-loud
  assert.ok(
    text.includes("graph-unavailable") || text.includes("graph unavailable") ||
      text.includes("fail loud") || text.includes("FAIL LOUD") ||
      text.includes("FAIL-LOUD"),
    "test-sync command must document fail-loud on graph-unavailable [RULE test-sync-uses-test-impl-verb]"
  );
  // No structural grep fallback
  const fallback = detectStructuralGrepFallback(text);
  assert.equal(fallback, null, `test-sync command must NOT have a structural-grep fallback — found: ${fallback}`);
});

test("[RULE design-build-writer-pattern] design-build command uses who-imports or cluster verb", () => {
  const text = readFile("commands/gsd-t-design-build.md");
  assert.ok(text, "commands/gsd-t-design-build.md must exist");
  assert.ok(
    text.includes("who-imports") || text.includes("cluster") || text.includes("graph"),
    "design-build command must reference who-imports/cluster graph query (READER half) [RULE design-build-writer-pattern]"
  );
  // WRITER half
  const hasWriter =
    text.includes("re-index") || text.includes("reindex") ||
    text.includes("freshness") || text.includes("WRITER") ||
    text.includes("touched files") || text.includes("re-indexes") ||
    text.includes("generated files");
  assert.ok(hasWriter, "design-build command must reference re-index of generated files (WRITER half) [RULE design-build-writer-pattern]");
  // Fail-loud
  assert.ok(
    text.includes("graph-unavailable") || text.includes("graph unavailable") ||
      text.includes("fail loud") || text.includes("FAIL LOUD") ||
      text.includes("FAIL-LOUD"),
    "design-build command must document fail-loud on graph-unavailable [RULE design-build-writer-pattern]"
  );
  // No structural grep fallback
  const fallback = detectStructuralGrepFallback(text);
  assert.equal(fallback, null, `design-build command must NOT have a structural-grep fallback — found: ${fallback}`);
});
