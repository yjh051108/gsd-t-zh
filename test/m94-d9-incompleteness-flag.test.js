"use strict";

/**
 * M94-D9-T5 — Incompleteness coverage flag (Fix-7 query-layer half)
 *
 * [RULE] query-surfaces-incompleteness-never-silent-empty:
 *   who-imports/who-calls/blast-radius attach a `coverage` field. When a target's
 *   only potential contributors include skipped/unparsed files, the result MUST carry
 *   coverage.complete:false + unparsedContributors:N + the incompleteness note —
 *   NEVER a bare empty result that reads as "no importers/callers".
 *
 * KILLING TEST: a fixture where file B.ts imports target X.ts but B.ts is deliberately
 * registered in the skipped set (unparseable). who-imports(X.ts) MUST surface
 * coverage.complete:false — NOT a clean empty {results:[]} that reads as "no importers".
 *
 * A second fixture where all contributors parse → coverage.complete:true.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const CLI = require(path.join(__dirname, "..", "bin", "gsd-t-graph-query-cli.cjs"));
const {
  buildIndexFromRecords,
  queryWhoImports,
  queryWhoCalls,
  queryBlastRadius,
  computeCoverage,
} = CLI;

// ─── Fixture: all-parsed (no skipped files) ───────────────────────────────────

function makeFullyParsedFixture() {
  return [
    {
      file: "target.ts",
      content_hash: "t001",
      tier: "compiler-accurate",
      entities: [{ funcId: "target.ts#doTarget@1", name: "doTarget", kind: "FUNCTION", file: "target.ts", tier: "compiler-accurate" }],
      edges: [],
    },
    {
      file: "importer.ts",
      content_hash: "i001",
      tier: "compiler-accurate",
      entities: [],
      edges: [
        { kind: "IMPORT", src: "importer.ts", dst: "target.ts" },
        { kind: "CALL",   src: "importer.ts#callTarget@1", dst: "target.ts#doTarget@1" },
      ],
    },
  ];
}

// ─── Fixture: one unparseable file (B.ts registered in skipped set) ───────────
// B.ts WOULD have imported target.ts, but it failed to parse.
// The parsed index has no record for B.ts — so who-imports(target.ts) returns []
// from the parsed portion. The skipped set tells us B.ts was skipped.
// The coverage field MUST surface this incompleteness.

function makeSkippedFileFixture() {
  // Only the parseable files have records
  return [
    {
      file: "target.ts",
      content_hash: "t002",
      tier: "compiler-accurate",
      entities: [{ funcId: "target.ts#doThing@1", name: "doThing", kind: "FUNCTION", file: "target.ts", tier: "compiler-accurate" }],
      edges: [],
    },
    // B.ts is intentionally absent from the records (it failed to parse)
    // Its entry in the skipped set is passed separately to buildIndexFromRecords.
  ];
}

const SKIPPED_FILE_B = "B.ts";

// ─── T5.1: fully-parsed query carries coverage.complete:true ─────────────────

test("D9-T5.1: who-imports with no skipped files carries coverage.complete:true", () => {
  const index = buildIndexFromRecords(makeFullyParsedFixture()); // no skippedFiles arg
  const { results, coverage } = queryWhoImports(index, "target.ts");
  assert.ok(results.includes("importer.ts"), "importer.ts must appear in results");
  assert.ok(typeof coverage === "object" && coverage !== null, "coverage must be an object");
  assert.equal(coverage.complete, true,
    `fully-parsed query must carry coverage.complete:true, got: ${JSON.stringify(coverage)}`);
  assert.equal(coverage.unparsedContributors, undefined,
    "no unparsedContributors key on complete:true result");
});

// ─── T5.2: KILLING TEST — one importer in a skipped file → incompleteness flag ─

test("D9-T5.2 [RULE query-surfaces-incompleteness-never-silent-empty]: KILLING TEST — skipped importer → coverage.complete:false (NEVER bare empty)", () => {
  // B.ts would have been an importer of target.ts, but it failed to parse.
  // The skipped set is passed to buildIndexFromRecords.
  const skippedFiles = new Set([SKIPPED_FILE_B]);
  const index = buildIndexFromRecords(makeSkippedFileFixture(), skippedFiles);

  const { results, coverage } = queryWhoImports(index, "target.ts");

  // The parsed result is empty (B.ts has no record)
  // But the coverage MUST NOT be presented as authoritative "no importers"
  assert.equal(results.length, 0, "no parsed importers in this fixture — results is []");

  // THE KILLING ASSERTION: coverage.complete must be FALSE
  assert.equal(coverage.complete, false,
    `[RULE] query-surfaces-incompleteness-never-silent-empty VIOLATED: ` +
    `who-imports returned an empty result with coverage.complete:true (or missing) ` +
    `when B.ts (a potential importer) was in the skipped set. ` +
    `An empty result with skipped files present reads as "no importers" — WRONG. ` +
    `Got coverage: ${JSON.stringify(coverage)}`);

  assert.ok(typeof coverage.unparsedContributors === "number" && coverage.unparsedContributors >= 1,
    `coverage.unparsedContributors must be >= 1, got: ${coverage.unparsedContributors}`);

  assert.ok(typeof coverage.note === "string" && coverage.note.length > 0,
    `coverage.note must be a non-empty string explaining the incompleteness, got: ${JSON.stringify(coverage.note)}`);
});

// ─── T5.3: who-calls coverage flag ───────────────────────────────────────────

test("D9-T5.3: who-calls with skipped files carries coverage.complete:false", () => {
  const skippedFiles = new Set(["caller-that-failed.ts"]);
  const index = buildIndexFromRecords(makeSkippedFileFixture(), skippedFiles);
  const { coverage } = queryWhoCalls(index, "target.ts#doThing@1");
  assert.equal(coverage.complete, false,
    "who-calls with skipped files must carry coverage.complete:false");
  assert.ok(coverage.unparsedContributors >= 1, "unparsedContributors must be >= 1");
});

test("D9-T5.4: who-calls with no skipped files carries coverage.complete:true", () => {
  const index = buildIndexFromRecords(makeFullyParsedFixture());
  const { coverage } = queryWhoCalls(index, "target.ts#doTarget@1");
  assert.equal(coverage.complete, true,
    "who-calls with no skipped files must carry coverage.complete:true");
});

// ─── T5.5: blast-radius coverage flag ────────────────────────────────────────

test("D9-T5.5: blast-radius with skipped files carries coverage.complete:false", () => {
  const skippedFiles = new Set(["upstream-that-failed.ts"]);
  const index = buildIndexFromRecords(makeSkippedFileFixture(), skippedFiles);
  const { coverage } = queryBlastRadius(index, "target.ts");
  assert.equal(coverage.complete, false,
    "blast-radius with skipped files must carry coverage.complete:false");
});

test("D9-T5.6: blast-radius with no skipped files carries coverage.complete:true", () => {
  const index = buildIndexFromRecords(makeFullyParsedFixture());
  const { coverage } = queryBlastRadius(index, "target.ts");
  assert.equal(coverage.complete, true,
    "blast-radius with no skipped files must carry coverage.complete:true");
});

// ─── T5.7: computeCoverage unit tests ────────────────────────────────────────

test("D9-T5.7: computeCoverage with empty skipped set returns complete:true", () => {
  const c = computeCoverage(new Set());
  assert.equal(c.complete, true);
  assert.equal(c.unparsedContributors, undefined);
});

test("D9-T5.8: computeCoverage with non-empty skipped set returns complete:false with count", () => {
  const c = computeCoverage(new Set(["a.ts", "b.ts"]));
  assert.equal(c.complete, false);
  assert.equal(c.unparsedContributors, 2);
  assert.ok(typeof c.note === "string" && c.note.length > 0, "note must be non-empty string");
});

test("D9-T5.9: computeCoverage with null/undefined skipped set returns complete:true (safe default)", () => {
  const c1 = computeCoverage(null);
  assert.equal(c1.complete, true);
  const c2 = computeCoverage(undefined);
  assert.equal(c2.complete, true);
});

// ─── T5.10: buildIndexFromRecords accepts optional skippedFiles Set ───────────

test("D9-T5.10: buildIndexFromRecords correctly stores skippedFiles in the index", () => {
  const skipped = new Set(["unparseable.ts"]);
  const index = buildIndexFromRecords(makeFullyParsedFixture(), skipped);
  assert.ok(index.skippedFiles instanceof Set, "index.skippedFiles must be a Set");
  assert.ok(index.skippedFiles.has("unparseable.ts"), "skipped file must be in index.skippedFiles");
});

test("D9-T5.11: buildIndexFromRecords without skippedFiles has empty skippedFiles Set", () => {
  const index = buildIndexFromRecords(makeFullyParsedFixture());
  assert.ok(index.skippedFiles instanceof Set, "index.skippedFiles must be a Set even when not provided");
  assert.equal(index.skippedFiles.size, 0, "skippedFiles must be empty when not provided");
});

// ─── T5.12: existing verb tests stay green (additive coverage field) ─────────

test("D9-T5.12: additive coverage field does not break existing who-imports shape (results + tier still present)", () => {
  const index = buildIndexFromRecords(makeFullyParsedFixture());
  const result = queryWhoImports(index, "target.ts");
  assert.ok(Array.isArray(result.results), "results must be array");
  assert.ok(typeof result.tier === "string", "tier must be string");
  assert.ok(typeof result.coverage === "object", "coverage must be object");
  // The existing fields are intact
  assert.ok(result.results.includes("importer.ts"), "who-imports(target.ts) still returns importer.ts");
});
