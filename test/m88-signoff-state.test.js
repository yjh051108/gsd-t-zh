"use strict";

// M88 G1 — KILLING TEST for the milestone sign-off STATE (test/m88-signoff-state.test.js)
//
// The backlog #35 kill-criterion for A3: "DEFINED" must become a CODE-READABLE
// state, not prose an LLM writes into progress.md. This test proves, with ZERO
// LLM judgment and byte-verbatim fixtures in a redirected temp dir, that:
//   - an UNSIGNED detailed doc → isDefined NOT-DEFINED (false), readSignoff.signed false;
//   - the SAME doc with a valid sign-off marker prepended → isDefined flips to true;
//   - a mixed set (one signed, one unsigned) → isDefined false (ANY unsigned fails);
//   - a malformed marker (`<!-- signed-off: -->`, no date) → treated as unsigned, NO throw;
//   - recordSkip → emits a greppable/assertable decision line (milestone + reason),
//     proving a skip is observable, never a silent default-off.
//
// If this test cannot be made deterministic, the milestone HALTS (wave gate).
//
// Contract: .gsd-t/contracts/pseudocode-source-of-truth-contract.md §1.

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  readSignoff,
  parseSignoff,
  isDefined,
  recordSkip,
} = require("../bin/gsd-t-milestone-state.cjs");

// ─── byte-verbatim fixtures in a redirected temp dir ───────────────────────

let TMP;
const W = (name, body) => {
  const p = path.join(TMP, name);
  fs.writeFileSync(p, body);
  return p;
};

// A faithful detailed PseudoCode doc BODY (no marker). The marker, when present,
// is a structured HTML comment at the very HEAD of the file (front-matter stamp).
const DETAIL_BODY = [
  "# PseudoCode-Refund (Detailed)",
  "",
  "> **Intention (David, 2026-06-22).** Refund the captured charge.",
  "",
  "```pseudocode",
  "fn refund(charge): assert charge.captured; gateway.refund(charge.id)",
  "```",
  "",
  "| call | one breath |",
  "|------|-----------|",
  "| refund | reverse a captured charge |",
  "",
  "GATE: double-refund → 409   [RULE] a charge refunds at most once",
  "",
].join("\n");

const VALID_MARKER = "<!-- signed-off: 2026-06-22 by david@tekyz.com -->\n";
const VALID_MARKER_WITH_TIME = "<!-- signed-off: 2026-06-22T14:35-07:00 by David Hirschfeld -->\n";
const MALFORMED_NO_DATE = "<!-- signed-off: -->\n"; // no date, no author
const MALFORMED_DATE_ONLY = "<!-- signed-off: 2026-06-22 -->\n"; // date, no ` by <author>`

let UNSIGNED_DOC;
let SIGNED_DOC;
let SIGNED_TIME_DOC;
let MALFORMED_DOC;
let MALFORMED_DATEONLY_DOC;
let MISSING_DOC;

before(() => {
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), "m88-signoff-"));
  UNSIGNED_DOC = W("PseudoCode-Refund-unsigned.md", DETAIL_BODY);
  SIGNED_DOC = W("PseudoCode-Refund-signed.md", VALID_MARKER + DETAIL_BODY);
  SIGNED_TIME_DOC = W("PseudoCode-Refund-signed-time.md", VALID_MARKER_WITH_TIME + DETAIL_BODY);
  MALFORMED_DOC = W("PseudoCode-Refund-malformed.md", MALFORMED_NO_DATE + DETAIL_BODY);
  MALFORMED_DATEONLY_DOC = W("PseudoCode-Refund-dateonly.md", MALFORMED_DATE_ONLY + DETAIL_BODY);
  MISSING_DOC = path.join(TMP, "PseudoCode-DoesNotExist.md"); // never written
});

after(() => {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* best-effort */ }
});

// ─── readSignoff: unsigned vs signed ───────────────────────────────────────

describe("readSignoff — structural marker, fail-closed", () => {
  test("an UNSIGNED doc → signed:false", () => {
    const r = readSignoff(UNSIGNED_DOC);
    assert.equal(r.signed, false);
    assert.equal(r.date, null);
    assert.equal(r.author, null);
  });

  test("the SAME doc with a valid marker prepended → signed:true with date + author", () => {
    const r = readSignoff(SIGNED_DOC);
    assert.equal(r.signed, true);
    assert.equal(r.date, "2026-06-22");
    assert.equal(r.author, "david@tekyz.com");
  });

  test("an ISO date with a time/zone tail + multi-word author parses", () => {
    const r = readSignoff(SIGNED_TIME_DOC);
    assert.equal(r.signed, true);
    assert.equal(r.date, "2026-06-22T14:35-07:00");
    assert.equal(r.author, "David Hirschfeld");
  });

  test("a malformed marker (`<!-- signed-off: -->`, no date) → unsigned, NO throw", () => {
    let r;
    assert.doesNotThrow(() => { r = readSignoff(MALFORMED_DOC); });
    assert.equal(r.signed, false);
  });

  test("a date-only marker (no ` by <author>`) → unsigned (fail-closed), NO throw", () => {
    let r;
    assert.doesNotThrow(() => { r = readSignoff(MALFORMED_DATEONLY_DOC); });
    assert.equal(r.signed, false);
  });

  test("a missing/unreadable doc → unsigned (fail-closed), NO throw", () => {
    let r;
    assert.doesNotThrow(() => { r = readSignoff(MISSING_DOC); });
    assert.equal(r.signed, false);
    assert.ok(r.error, "a missing doc reports an error string but never throws");
  });

  test("not a prose substring scan — 'signed-off' in body prose does NOT count", () => {
    // The word appears in prose but NOT inside a valid <!-- signed-off: ... --> marker.
    const p = W("PseudoCode-Prose.md", "# Doc\n\nThis milestone was signed-off verbally.\n" + DETAIL_BODY);
    const r = readSignoff(p);
    assert.equal(r.signed, false, "a structural parser must ignore prose mentions of 'signed-off'");
  });
});

// ─── parseSignoff: pure, null-safe ─────────────────────────────────────────

describe("parseSignoff — pure + null-safe", () => {
  test("null/undefined text → unsigned, no throw", () => {
    assert.equal(parseSignoff(null).signed, false);
    assert.equal(parseSignoff(undefined).signed, false);
    assert.equal(parseSignoff("").signed, false);
  });
});

// ─── isDefined: the predicate ──────────────────────────────────────────────

describe("isDefined — milestone DEFINED iff EVERY detailed doc is signed", () => {
  test("a single UNSIGNED doc → NOT-DEFINED (false)", () => {
    const r = isDefined([UNSIGNED_DOC]);
    assert.equal(r.defined, false);
    assert.deepEqual(r.unsigned, [UNSIGNED_DOC]);
  });

  test("signing the doc FLIPS the milestone to DEFINED (true)", () => {
    const r = isDefined([SIGNED_DOC]);
    assert.equal(r.defined, true);
    assert.equal(r.total, 1);
    assert.equal(r.signed, 1);
    assert.deepEqual(r.unsigned, []);
  });

  test("a MIXED set (one signed, one unsigned) → NOT-DEFINED (ANY unsigned fails the set)", () => {
    const r = isDefined([SIGNED_DOC, UNSIGNED_DOC]);
    assert.equal(r.defined, false);
    assert.deepEqual(r.unsigned, [UNSIGNED_DOC]);
  });

  test("a set where ALL docs are signed → DEFINED", () => {
    const r = isDefined([SIGNED_DOC, SIGNED_TIME_DOC]);
    assert.equal(r.defined, true);
    assert.equal(r.signed, 2);
  });

  test("a malformed-marker doc in the set → NOT-DEFINED (fail-closed)", () => {
    const r = isDefined([SIGNED_DOC, MALFORMED_DOC]);
    assert.equal(r.defined, false);
    assert.deepEqual(r.unsigned, [MALFORMED_DOC]);
  });

  test("an EMPTY set → NOT-DEFINED (never a vacuous true)", () => {
    const r = isDefined([]);
    assert.equal(r.defined, false);
    assert.equal(r.total, 0);
  });

  test("non-array input → NOT-DEFINED, no throw", () => {
    assert.doesNotThrow(() => isDefined(null));
    assert.equal(isDefined(null).defined, false);
  });
});

// ─── recordSkip: a skip is observable, never silent ────────────────────────

describe("recordSkip — assertable, greppable, never a silent default-off", () => {
  test("the emitted decision line contains the milestone AND the reason", () => {
    const r = recordSkip("M91", "doc not yet authored — tracked in backlog #35");
    assert.equal(r.ok, true);
    assert.equal(r.kind, "milestone-signoff-skip");
    assert.equal(r.milestone, "M91");
    assert.match(r.decision, /M91/);
    assert.match(r.decision, /doc not yet authored/);
    // greppable marker so a downstream grep can find every skip
    assert.match(r.decision, /\[GSD-T SIGNOFF-SKIP\]/);
  });

  test("a reasonless skip is still EMITTED + assertable but flagged ok:false (fail-closed)", () => {
    const r = recordSkip("M91", "");
    assert.equal(r.ok, false, "a skip with no reason cannot be treated as a clean pass");
    assert.match(r.decision, /M91/);
    assert.match(r.decision, /\[GSD-T SIGNOFF-SKIP\]/);
  });

  test("never throws on null inputs", () => {
    assert.doesNotThrow(() => recordSkip(null, null));
    assert.equal(recordSkip(null, null).ok, false);
  });
});
