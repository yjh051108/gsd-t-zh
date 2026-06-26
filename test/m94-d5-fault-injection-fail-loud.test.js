"use strict";

/**
 * M94-D5-T2 (part 2) — AC-5 keystone: fault-injection fail-loud
 *
 * [RULE] parser-fail-disables-loud-never-silent:
 *   A genuine parser/store-load failure returns {ok:false, reason:'graph-unavailable'}.
 *   NEVER a partial edge, NEVER a silently-wrong answer.
 *
 * Fault-injection scenarios:
 *   1. storePath is null (no index found)
 *   2. storePath points to a non-existent directory
 *   3. storePath exists but records.jsonl is missing
 *   4. storePath exists but records.jsonl is corrupt JSON
 *   5. storePath exists but records.jsonl is truncated (partial line)
 *   6. D4 freshness module absent — graph-unavailable (not a silent grep fallback)
 *
 * Each scenario MUST return {ok:false, reason:'graph-unavailable'} — never a partial
 * result, never a silently-wrong edge, never a fallback to grep.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const CLI = require(path.join(__dirname, "..", "bin", "gsd-t-graph-query-cli.cjs"));
const { loadStore, runFreshnessCheck, loadFreshnessModule } = CLI;

// ─── Fault scenario helpers ───────────────────────────────────────────────────

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "m94-d5-fault-"));
}

function writeFaultStore(tmpDir, content) {
  const recordsPath = path.join(tmpDir, "records.jsonl");
  fs.writeFileSync(recordsPath, content, "utf8");
  return tmpDir;
}

// ─── Fault 1: null storePath ──────────────────────────────────────────────────

test("fault-1: loadStore(null) → {ok:false, reason:'graph-unavailable'}", () => {
  const result = loadStore(null);
  assert.equal(result.ok, false, "must not return ok:true for null store");
  assert.equal(result.reason, "graph-unavailable");
  // Must NOT be a partial result or undefined
  assert.equal(typeof result.index, "undefined", "no partial index on failure");
});

// ─── Fault 2: non-existent directory ─────────────────────────────────────────

test("fault-2: loadStore(non-existent-path) → {ok:false, reason:'graph-unavailable'}", () => {
  const result = loadStore("/does/not/exist/at/all/graph-index");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "graph-unavailable");
  assert.equal(typeof result.index, "undefined", "no partial index on failure");
});

// ─── Fault 3: directory exists but records.jsonl is missing ──────────────────

test("fault-3: records.jsonl missing → {ok:false, reason:'graph-unavailable'}", () => {
  const tmpDir = makeTmpDir();
  try {
    // Directory exists but no records.jsonl inside
    const result = loadStore(tmpDir);
    assert.equal(result.ok, false);
    assert.equal(result.reason, "graph-unavailable");
    assert.equal(typeof result.index, "undefined", "no partial index on failure");
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// ─── Fault 4: records.jsonl is corrupt (invalid JSON) ────────────────────────

test("fault-4: corrupt records.jsonl (invalid JSON) → {ok:false, reason:'graph-unavailable'}", () => {
  const tmpDir = makeTmpDir();
  try {
    writeFaultStore(tmpDir, "{ this is not valid JSON }\n{ also not valid }\n");
    const result = loadStore(tmpDir);
    assert.equal(result.ok, false, "corrupt JSON must not return ok:true");
    assert.equal(result.reason, "graph-unavailable");
    assert.equal(typeof result.index, "undefined", "no partial index on corrupt store");
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// ─── Fault 5: records.jsonl is truncated (partial last line) ─────────────────

test("fault-5: truncated records.jsonl (partial last line) → {ok:false, reason:'graph-unavailable'}", () => {
  const tmpDir = makeTmpDir();
  try {
    // Valid first line, then a truncated second line
    const validLine = JSON.stringify({
      file: "a.ts",
      content_hash: "aabbccdd",
      tier: "compiler-accurate",
      entities: [],
      edges: [],
    });
    const truncatedContent = validLine + "\n{ \"file\": \"b.ts\", \"content_hash\": \"bb"; // truncated
    writeFaultStore(tmpDir, truncatedContent);

    const result = loadStore(tmpDir);
    assert.equal(result.ok, false, "truncated JSON must not return ok:true");
    assert.equal(result.reason, "graph-unavailable");
    assert.equal(typeof result.index, "undefined", "no partial index on truncated store");
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// ─── Fault 6: D4 freshness module absent ─────────────────────────────────────

test("fault-6: D4 module absent → runFreshnessCheck returns {ok:false, reason:'graph-unavailable'}", () => {
  // This is the key seam test: when D4 is not installed, the query CLI must fail loud,
  // NOT fall back to grep, NOT return a partial result, NOT silently succeed.
  //
  // [RULE] parser-fail-disables-loud-never-silent: D4 absent = graph-unavailable.
  // The absence of D4 IS a "graph infrastructure unavailable" condition.

  const freshnessModule = loadFreshnessModule();

  if (freshnessModule !== null) {
    // D4 is present — test is about the ABSENT case.
    // When D4 IS present, runFreshnessCheck either succeeds or returns graph-unavailable
    // if D4's own internals fail — that's D4's test domain.
    // We verify the contract still holds: result must have ok and reason fields.
    const result = runFreshnessCheck("/fake/store");
    // D4 present but store fake → D4 may error internally → graph-unavailable
    // or D4 might succeed on the fake path. Either way, the envelope is valid.
    assert.equal(typeof result.ok, "boolean", "result.ok must be a boolean");
    return;
  }

  // D4 absent — this is the primary test scenario
  const result = runFreshnessCheck("/fake/store");

  assert.equal(result.ok, false, "D4 absent must return ok:false");
  assert.equal(result.reason, "graph-unavailable",
    "[RULE] parser-fail-disables-loud-never-silent: D4 absent → graph-unavailable, never a silent fallback");
  assert.equal(typeof result.index, "undefined", "no partial index when D4 is absent");
});

// ─── Fault 7: graph-unavailable envelope shape is correct ────────────────────

test("fault-7: graph-unavailable envelope has exactly {ok:false, reason:'graph-unavailable'}", () => {
  // The contract defines the exact shape for the fail-loud case.
  // Any extra fields (like 'results', 'edges', 'tier') on a failure envelope
  // would risk a consumer treating it as a partial success — forbidden.
  const result = loadStore(null);

  assert.equal(result.ok, false);
  assert.equal(result.reason, "graph-unavailable");

  // No 'results', no 'edges', no 'tier' on a failure envelope (per contract)
  // The contract allows ok+reason to be the minimal shape.
  assert.equal(typeof result.results, "undefined", "failure envelope must not carry results");
  assert.equal(typeof result.edges, "undefined", "failure envelope must not carry edges");
  assert.equal(typeof result.tier, "undefined", "failure envelope must not carry tier");
});

// ─── Fault 8: empty store (zero records) — NOT a fault, must succeed ─────────

test("fault-8: empty records.jsonl (zero records) → ok:true with empty index", () => {
  // An empty index is a valid state (nothing indexed yet, freshly initialised).
  // This must NOT be treated as graph-unavailable — it's a live queryable (empty) index.
  const tmpDir = makeTmpDir();
  try {
    // Write a valid but empty JSONL file
    writeFaultStore(tmpDir, "");
    const result = loadStore(tmpDir);

    // An empty but valid store is ok (query results will be empty, but it's not an error)
    assert.equal(result.ok, true, "empty-but-valid store must return ok:true");
    assert.ok(result.index, "empty-but-valid store must return an index");
    assert.equal(result.index.allFiles.size, 0, "empty store has no files");
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});
