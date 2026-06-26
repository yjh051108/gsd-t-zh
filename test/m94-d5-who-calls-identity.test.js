"use strict";

/**
 * M94-D5-T4 — RE-PLAN Fix-3: who-calls function-identity disambiguation test
 *
 * [RULE] who-calls-function-identity-disambiguated:
 *   who-calls resolves a file-qualified identity (file#function), NOT a bare name.
 *   A bare name matching MULTIPLE funcIds MUST return ambiguous-function envelope.
 *   NEVER merges callers across same-named functions.
 *
 * Fixture: TWO functions named 'foo' in different files (a.ts#foo, b.ts#foo) with DISTINCT callers.
 *
 * Assertions:
 *   (1) who-calls('a.ts#foo') returns ONLY a.ts#foo's callers, NEVER b.ts#foo's
 *   (2) who-calls('b.ts#foo') returns ONLY b.ts#foo's callers, NEVER a.ts#foo's
 *   (3) bare who-calls('foo') returns {ambiguous: true, candidates: ['a.ts#foo', 'b.ts#foo']}
 *       OR per-candidate grouped results — NEVER a flat merged caller set
 *   (4) FAILS if the query merges callers across same-named functions
 *
 * This test makes AC-2 (who-calls correctness) provable on real data, not just unique-named fixtures.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const CLI = require(path.join(__dirname, "..", "bin", "gsd-t-graph-query-cli.cjs"));
const { buildIndexFromRecords, queryWhoCalls } = CLI;

// ─── Fixture: TWO functions named 'foo' in different files ───────────────────
//
// Graph layout (hand-checked by inspection):
//
//   Files:     a.ts, b.ts, caller-of-a.ts, caller-of-b.ts, shared-caller.ts
//   Functions:
//     a.ts#foo               — function "foo" in a.ts
//     b.ts#foo               — function "foo" in b.ts  (SAME NAME, different file)
//     caller-of-a.ts#callsA  — calls a.ts#foo
//     caller-of-b.ts#callsB  — calls b.ts#foo
//     shared-caller.ts#callsBoth — would cause a merge if disambiguated by name only
//
//   Call edges:
//     caller-of-a.ts#callsA   → a.ts#foo      (a's caller)
//     caller-of-b.ts#callsB   → b.ts#foo      (b's caller)
//
// Expected results (hand-verified):
//   who-calls('a.ts#foo')   → ['caller-of-a.ts#callsA']  (exact, only a's caller)
//   who-calls('b.ts#foo')   → ['caller-of-b.ts#callsB']  (exact, only b's caller)
//   who-calls('foo')        → ambiguous: true, candidates: ['a.ts#foo', 'b.ts#foo']
//                             (bare name matching two funcIds — never merged)

function makeDisambiguationFixture() {
  return [
    // a.ts — contains function "foo"
    {
      file: "a.ts",
      content_hash: "aa000001",
      tier: "compiler-accurate",
      entities: [
        { funcId: "a.ts#foo", name: "foo", kind: "FUNCTION", file: "a.ts", tier: "compiler-accurate" },
      ],
      edges: [],
    },
    // b.ts — also contains function "foo" (SAME NAME, different file)
    {
      file: "b.ts",
      content_hash: "bb000002",
      tier: "compiler-accurate",
      entities: [
        { funcId: "b.ts#foo", name: "foo", kind: "FUNCTION", file: "b.ts", tier: "compiler-accurate" },
      ],
      edges: [],
    },
    // caller-of-a.ts — callsA calls a.ts#foo specifically
    {
      file: "caller-of-a.ts",
      content_hash: "cc000003",
      tier: "compiler-accurate",
      entities: [
        { funcId: "caller-of-a.ts#callsA", name: "callsA", kind: "FUNCTION", file: "caller-of-a.ts", tier: "compiler-accurate" },
      ],
      edges: [
        { kind: "CALL", src: "caller-of-a.ts#callsA", dst: "a.ts#foo" },
      ],
    },
    // caller-of-b.ts — callsB calls b.ts#foo specifically
    {
      file: "caller-of-b.ts",
      content_hash: "dd000004",
      tier: "compiler-accurate",
      entities: [
        { funcId: "caller-of-b.ts#callsB", name: "callsB", kind: "FUNCTION", file: "caller-of-b.ts", tier: "compiler-accurate" },
      ],
      edges: [
        { kind: "CALL", src: "caller-of-b.ts#callsB", dst: "b.ts#foo" },
      ],
    },
  ];
}

// ─── T4.1: who-calls('a.ts#foo') returns ONLY a's caller ────────────────────

test("T4.1: who-calls('a.ts#foo') returns exactly a.ts#foo's callers — not b.ts#foo's", () => {
  const index = buildIndexFromRecords(makeDisambiguationFixture());
  const result = queryWhoCalls(index, "a.ts#foo");

  // Must not be ambiguous (file-qualified identity)
  assert.equal(result.ambiguous, undefined, "file-qualified who-calls must not be ambiguous");
  assert.ok(Array.isArray(result.results), "must return results array for file-qualified identity");

  // Must include a's caller
  assert.ok(result.results.includes("caller-of-a.ts#callsA"),
    `who-calls('a.ts#foo') must include caller-of-a.ts#callsA. Got: ${JSON.stringify(result.results)}`);

  // MUST NOT include b's caller (the function-identity disambiguation test)
  assert.ok(!result.results.includes("caller-of-b.ts#callsB"),
    `[RULE] who-calls-function-identity-disambiguated VIOLATED: ` +
    `who-calls('a.ts#foo') merged callers of b.ts#foo into result. Got: ${JSON.stringify(result.results)}`);
});

test("T4.2: who-calls('a.ts#foo') returns exactly 1 caller (no spurious entries)", () => {
  const index = buildIndexFromRecords(makeDisambiguationFixture());
  const result = queryWhoCalls(index, "a.ts#foo");

  assert.equal(result.results.length, 1,
    `who-calls('a.ts#foo') must return exactly 1 caller. Got: ${JSON.stringify(result.results)}`);
  assert.deepEqual(result.results, ["caller-of-a.ts#callsA"]);
});

// ─── T4.3: who-calls('b.ts#foo') returns ONLY b's caller ────────────────────

test("T4.3: who-calls('b.ts#foo') returns exactly b.ts#foo's callers — not a.ts#foo's", () => {
  const index = buildIndexFromRecords(makeDisambiguationFixture());
  const result = queryWhoCalls(index, "b.ts#foo");

  assert.equal(result.ambiguous, undefined, "file-qualified who-calls must not be ambiguous");
  assert.ok(Array.isArray(result.results), "must return results array");

  // Must include b's caller
  assert.ok(result.results.includes("caller-of-b.ts#callsB"),
    `who-calls('b.ts#foo') must include caller-of-b.ts#callsB. Got: ${JSON.stringify(result.results)}`);

  // MUST NOT include a's caller
  assert.ok(!result.results.includes("caller-of-a.ts#callsA"),
    `[RULE] who-calls-function-identity-disambiguated VIOLATED: ` +
    `who-calls('b.ts#foo') merged callers of a.ts#foo into result. Got: ${JSON.stringify(result.results)}`);
});

test("T4.4: who-calls('b.ts#foo') returns exactly 1 caller (no spurious entries)", () => {
  const index = buildIndexFromRecords(makeDisambiguationFixture());
  const result = queryWhoCalls(index, "b.ts#foo");

  assert.equal(result.results.length, 1,
    `who-calls('b.ts#foo') must return exactly 1 caller. Got: ${JSON.stringify(result.results)}`);
  assert.deepEqual(result.results, ["caller-of-b.ts#callsB"]);
});

// ─── T4.5: bare who-calls('foo') returns ambiguous-function ─────────────────

test("T4.5: who-calls('foo') [bare name] returns ambiguous:true with both candidate funcIds", () => {
  const index = buildIndexFromRecords(makeDisambiguationFixture());
  const result = queryWhoCalls(index, "foo");

  // [RULE] who-calls-function-identity-disambiguated:
  // A bare name matching MULTIPLE funcIds MUST return ambiguous:true with candidates.
  // NEVER a flat merged caller set across same-named functions.
  assert.equal(result.ambiguous, true,
    `[RULE] who-calls-function-identity-disambiguated VIOLATED: ` +
    `bare who-calls('foo') must return {ambiguous:true, candidates:[...]} when name matches multiple funcIds. ` +
    `Got: ${JSON.stringify(result)}`);

  assert.ok(Array.isArray(result.candidates),
    "ambiguous result must carry candidates array");

  assert.ok(result.candidates.includes("a.ts#foo"),
    `candidates must include a.ts#foo. Got: ${JSON.stringify(result.candidates)}`);

  assert.ok(result.candidates.includes("b.ts#foo"),
    `candidates must include b.ts#foo. Got: ${JSON.stringify(result.candidates)}`);

  assert.equal(result.candidates.length, 2,
    `candidates must be exactly [a.ts#foo, b.ts#foo]. Got: ${JSON.stringify(result.candidates)}`);
});

test("T4.6: bare who-calls('foo') does NOT return a flat merged caller set", () => {
  const index = buildIndexFromRecords(makeDisambiguationFixture());
  const result = queryWhoCalls(index, "foo");

  // The key invariant: NEVER a flat merged caller set across same-named functions.
  // If results were defined (a flat merge), that's the violation.
  if (!result.ambiguous) {
    // If not ambiguous, it MUST have resolved to exactly ONE funcId (impossible here — two 'foo's exist)
    // If it resolved to a flat set, the test fails
    const isFlat = Array.isArray(result.results);
    if (isFlat) {
      // Flat result with 2 callers merged = the violation
      const hasACallers = result.results.includes("caller-of-a.ts#callsA");
      const hasBCallers = result.results.includes("caller-of-b.ts#callsB");
      assert.ok(!(hasACallers && hasBCallers),
        `[RULE] who-calls-function-identity-disambiguated VIOLATED: ` +
        `bare who-calls('foo') returned a FLAT MERGED caller set containing BOTH a's and b's callers. ` +
        `This is the forbidden merge. Got: ${JSON.stringify(result.results)}`);
    }
  }
  // If ambiguous:true, the test passes (no flat merge possible)
});

// ─── T4.7: Unique bare name resolves directly (no ambiguity for unique names) ──

test("T4.7: who-calls('callsA') [unique bare name] resolves directly without ambiguity", () => {
  // 'callsA' is a unique name — only one funcId matches. Should resolve directly.
  const index = buildIndexFromRecords(makeDisambiguationFixture());
  const result = queryWhoCalls(index, "callsA");

  // callsA has no callers in the fixture (nothing calls caller-of-a.ts#callsA)
  // It should NOT be ambiguous (unique name)
  assert.equal(result.ambiguous, undefined, "unique bare name must not be ambiguous");
  assert.ok(Array.isArray(result.results), "unique bare name must return results array");
  // callsA is itself a leaf caller — no one calls it in the fixture
  assert.deepEqual(result.results, [], "callsA has no callers in the fixture");
});

// ─── T4.8: Sorted candidates in ambiguous response ──────────────────────────

test("T4.8: ambiguous-function candidates are sorted alphabetically", () => {
  const index = buildIndexFromRecords(makeDisambiguationFixture());
  const result = queryWhoCalls(index, "foo");

  if (result.ambiguous && Array.isArray(result.candidates)) {
    const sorted = [...result.candidates].sort();
    assert.deepEqual(result.candidates, sorted,
      `ambiguous candidates must be sorted. Got: ${JSON.stringify(result.candidates)}`);
  }
});

// ─── T4.9: The merge failure mode is detectable ──────────────────────────────

test("T4.9: sanity — the two callers in the fixture are distinct (merge would be detectable)", () => {
  // Self-consistency check: the fixture has two distinct callers.
  // If the implementation merged them, both would appear — and we'd catch it.
  const index = buildIndexFromRecords(makeDisambiguationFixture());

  const aResult = queryWhoCalls(index, "a.ts#foo");
  const bResult = queryWhoCalls(index, "b.ts#foo");

  // The callers must be DISTINCT (fixture is correctly designed)
  const aCallers = new Set(aResult.results || []);
  const bCallers = new Set(bResult.results || []);

  const intersection = [...aCallers].filter((c) => bCallers.has(c));
  assert.equal(intersection.length, 0,
    `Fixture sanity: a.ts#foo and b.ts#foo must have DISTINCT callers (no overlap). ` +
    `Overlap: ${JSON.stringify(intersection)}`);
});
