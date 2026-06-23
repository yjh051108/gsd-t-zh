"use strict";

// M88 G4 — the killing test for the §4 `⚠ Divergence` flag grammar round-trip.
//
// backlog #35, SC4's grammar half. Contract:
//   .gsd-t/contracts/pseudocode-source-of-truth-contract.md §4
// The canonical §4 form is, EXACTLY:
//   ⚠ Divergence: <RULE-ID or section> — supersedes shipped <what>. Reason: <user intention>.
//
// What this test KILLS:
//   (a) a VALID flag (byte-verbatim, matching §4 exactly) → round-trips
//       format→parse→format BYTE-STABLE;
//   (b) a MALFORMED flag (missing `— supersedes`, or missing `Reason:`) → parse
//       FAILURE asserted, with NO throw (fail-closed = returned error);
//   (c) a doc with K valid flags + some malformed → countDivergences returns
//       EXACTLY K (malformed NOT counted — structural, not substring);
//   (d) the emitted count is a checkable artifact (JSON integer), not prose.
// All deterministic, zero LLM.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  parseDivergence,
  formatDivergence,
  countDivergences,
} = require("../bin/gsd-t-divergence-grammar.cjs");

// ─── Byte-verbatim VALID fixtures (em-dash is U+2014, matching the contract) ───
// Authored to match §4 character-for-character.
const VALID_1 =
  "⚠ Divergence: R-PAYPAL-07 — supersedes shipped auto-retry on 409. Reason: the user wants idempotency keys, not blind retries.";
const VALID_2 =
  "⚠ Divergence: 6-money-safety-map — supersedes shipped silent double-create swallow. Reason: surface a 409 to the caller.";

// ─── (a) VALID flag round-trips format→parse→format BYTE-STABLE ───

test("(a) a valid §4 flag round-trips parse→format BYTE-STABLE", () => {
  for (const line of [VALID_1, VALID_2]) {
    const parsed = parseDivergence(line);
    assert.equal(parsed.ok, true, `expected valid parse for: ${line}`);
    assert.deepEqual(Object.keys(parsed.value).sort(), ["reason", "ref", "supersedes"]);

    const formatted = formatDivergence(parsed.value);
    assert.equal(formatted.ok, true);
    // BYTE-STABLE: format(parse(line)) === line, character for character.
    assert.equal(formatted.value, line, "round-trip MUST be byte-stable");
  }
});

test("(a') the parsed fields are exactly the §4 segments", () => {
  const { value } = parseDivergence(VALID_1);
  assert.equal(value.ref, "R-PAYPAL-07");
  assert.equal(value.supersedes, "auto-retry on 409");
  assert.equal(value.reason, "the user wants idempotency keys, not blind retries");
});

test("(a'') a <what> that itself contains '. Reason: ' still round-trips byte-stable", () => {
  // Guards the lastIndexOf boundary choice in the parser: the reason field is
  // delimited by the LAST '. Reason: ', so a tricky <what> cannot steal it.
  const tricky =
    "⚠ Divergence: §4 — supersedes shipped note saying. Reason: stub here. Reason: the real reason wins.";
  const parsed = parseDivergence(tricky);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.reason, "the real reason wins");
  assert.equal(parsed.value.supersedes, "note saying. Reason: stub here");
  assert.equal(formatDivergence(parsed.value).value, tricky, "byte-stable on tricky <what>");
});

// ─── (b) MALFORMED flag → parse FAILURE, NO throw ───

test("(b) malformed flags → parse FAILURE (returned error, NEVER a throw)", () => {
  const malformed = [
    // missing the ` — supersedes shipped ` clause:
    "⚠ Divergence: R-X-01 shipped auto-retry. Reason: idempotency.",
    // missing the `. Reason: ` clause:
    "⚠ Divergence: R-X-01 — supersedes shipped auto-retry on 409.",
    // missing the prefix entirely:
    "Divergence: R-X-01 — supersedes shipped auto-retry on 409. Reason: idempotency.",
    // missing the trailing period:
    "⚠ Divergence: R-X-01 — supersedes shipped auto-retry. Reason: idempotency",
    // empty ref:
    "⚠ Divergence:  — supersedes shipped auto-retry. Reason: idempotency.",
    // empty supersedes:
    "⚠ Divergence: R-X-01 — supersedes shipped . Reason: idempotency.",
    // empty reason:
    "⚠ Divergence: R-X-01 — supersedes shipped auto-retry. Reason: .",
    // leading slop (structural anchor, not substring):
    "  ⚠ Divergence: R-X-01 — supersedes shipped auto-retry. Reason: idempotency.",
    // non-string inputs:
    null,
    undefined,
    42,
    {},
  ];
  for (const bad of malformed) {
    let res;
    assert.doesNotThrow(() => {
      res = parseDivergence(bad);
    }, `parseDivergence must NEVER throw (input: ${JSON.stringify(bad)})`);
    assert.equal(res.ok, false, `expected parse FAILURE for: ${JSON.stringify(bad)}`);
    assert.equal(typeof res.error, "string", "failure must carry a NAMED error string");
    assert.ok(res.error.length > 0);
  }
});

test("(b') formatDivergence also never throws on bad input — returns named error", () => {
  for (const bad of [null, undefined, 42, {}, { ref: "", supersedes: "x", reason: "y" }, { ref: "r" }]) {
    let res;
    assert.doesNotThrow(() => {
      res = formatDivergence(bad);
    });
    assert.equal(res.ok, false);
    assert.equal(typeof res.error, "string");
  }
});

// ─── (c) countDivergences returns EXACTLY the valid-flag count ───

test("(c) a doc with K valid + some malformed flags → countDivergences === K (malformed NOT counted)", () => {
  const doc = [
    "# PseudoCode-PayPal",
    "",
    "Some prose about the money call.",
    VALID_1, // valid #1
    "",
    "More prose mentioning the word ⚠ Divergence but not a real flag.", // substring decoy — NOT counted
    VALID_2, // valid #2
    "⚠ Divergence: R-Y-09 — supersedes shipped foo.", // malformed (no Reason) — NOT counted
    "",
    "⚠ Divergence: §7 — supersedes shipped the glob skip. Reason: surface a logged reason.", // valid #3
    "tail",
  ].join("\n");

  // K = 3 valid flags. The decoy substring line + the malformed flag are excluded.
  assert.equal(countDivergences(doc), 3);
});

test("(c') a doc with zero valid flags → 0; empty/non-string → 0 (never throws)", () => {
  assert.equal(countDivergences("no flags here\njust prose\n"), 0);
  assert.equal(countDivergences(""), 0);
  assert.doesNotThrow(() => countDivergences(null));
  assert.equal(countDivergences(null), 0);
  assert.equal(countDivergences(42), 0);
});

test("(c'') count is structural, not substring: a line containing '⚠ Divergence:' but malformed is excluded", () => {
  const decoy = "⚠ Divergence: this line looks like a flag but has no supersedes clause.";
  assert.equal(parseDivergence(decoy).ok, false);
  assert.equal(countDivergences(decoy), 0);
  // …and a real one in the same doc IS counted.
  assert.equal(countDivergences(decoy + "\n" + VALID_1), 1);
});

// ─── (d) the emitted count is a checkable artifact (JSON integer), not prose ───

test("(d) the count is a checkable JSON integer artifact", () => {
  const doc = [VALID_1, VALID_2].join("\n");
  const count = countDivergences(doc);
  assert.equal(typeof count, "number");
  assert.ok(Number.isInteger(count));
  assert.equal(count, 2);
  // Round-trips through JSON as an integer (the artifact shape the CLI emits).
  const artifact = JSON.parse(JSON.stringify({ ok: true, count }));
  assert.equal(artifact.count, 2);
  assert.equal(typeof artifact.count, "number");
});
