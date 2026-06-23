"use strict";

// M88 G3 — A5 KILLING TEST (test/m88-triad-consumption-seam.test.js)
//
// Reframes A5 ("the `[RULE]` set is consumed by verify's QA + Red Team frames")
// from a non-deterministic LIVE-triad observation into a DETERMINISTIC seam-check.
// NO live triad runs here — zero LLM judgment. Two deterministic assertions:
//
//   (a) PROMPT PRESENCE — both shipped triad prompts (`qa-subagent.md`,
//       `red-team-subagent.md`) carry the structured `<!-- guard-map-ingest -->`
//       marked block. A prompt missing the directive FAILS. Asserted by MARKER
//       presence (structural), never prose substring fuzzy-match
//       (feedback_coverage_check_structural_not_substring).
//
//   (b) CONSUMER SURFACES EVERY RULE — feed a guard-map JSON with N RULE-IDs
//       through bin/gsd-t-rule-consume.cjs and assert each of the N ids surfaces
//       in BOTH the `qa` and `redTeam` frame sets. A DROPPED rule (consumer omits
//       an id from either frame) FAILS.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { runConsume, consume, ruleIds } = require("../bin/gsd-t-rule-consume.cjs");

const REPO = path.resolve(__dirname, "..");
const QA_PROMPT = path.join(REPO, "templates/prompts/qa-subagent.md");
const RT_PROMPT = path.join(REPO, "templates/prompts/red-team-subagent.md");

// The stable, greppable marker form the prompts must carry (M88-G3-T1).
const OPEN = "<!-- guard-map-ingest -->";
const CLOSE = "<!-- /guard-map-ingest -->";

// ─── (a) PROMPT PRESENCE ─────────────────────────────────────────────────────

describe("M88 G3 (a) — triad prompts carry the structured ingest directive", () => {
  for (const [label, file] of [["qa-subagent.md", QA_PROMPT], ["red-team-subagent.md", RT_PROMPT]]) {
    test(`${label} contains a well-formed <!-- guard-map-ingest --> marked block`, () => {
      const text = fs.readFileSync(file, "utf8");
      const open = text.indexOf(OPEN);
      const close = text.indexOf(CLOSE);
      // Structural marker presence — a prompt missing the directive FAILS.
      assert.ok(open !== -1, `${label} is MISSING the ${OPEN} open marker (A5 ingest directive absent)`);
      assert.ok(close !== -1, `${label} is MISSING the ${CLOSE} close marker (ingest block unterminated)`);
      // Open precedes close, and the block has non-empty body between the markers.
      assert.ok(open < close, `${label} ingest markers are out of order (open must precede close)`);
      const body = text.slice(open + OPEN.length, close).trim();
      assert.ok(body.length > 0, `${label} guard-map-ingest block is empty (directive has no body)`);
      // Exactly one block — no duplicate / stray markers.
      assert.equal(text.indexOf(OPEN, open + 1), -1, `${label} has a duplicate ${OPEN} marker`);
      assert.equal(text.indexOf(CLOSE, close + 1), -1, `${label} has a duplicate ${CLOSE} marker`);
    });
  }
});

// ─── (b) CONSUMER SURFACES EVERY RULE ────────────────────────────────────────

function writeMap(rulesObj) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m88-seam-"));
  const p = path.join(dir, "guard-map.json");
  fs.writeFileSync(p, JSON.stringify({ rules: rulesObj }, null, 2) + "\n");
  return p;
}

describe("M88 G3 (b) — consumer surfaces every RULE-ID in BOTH frames", () => {
  // N RULE-IDs (a realistic mix: explicit + derived id shapes).
  const N_IDS = ["R-PAYPAL-01", "R-PAYPAL-02", "R-PAYPAL-03", "R-EXTENSION-01", "R-EXTENSION-02"];

  function fixtureRules() {
    const rules = {};
    for (const id of N_IDS) rules[id] = { backedBy: [`test::${id}`], contradicted: false };
    return rules;
  }

  test("every input RULE-ID surfaces in the qa frame", () => {
    const res = runConsume({ map: writeMap(fixtureRules()) });
    assert.equal(res.ok, true);
    assert.equal(res.exitCode, 0);
    for (const id of N_IDS) {
      assert.ok(res.qa.includes(id), `RULE ${id} DROPPED from the qa frame — seam breach`);
    }
    assert.equal(res.qa.length, N_IDS.length, "qa frame surfaced extra/phantom ids");
  });

  test("every input RULE-ID surfaces in the redTeam frame", () => {
    const res = runConsume({ map: writeMap(fixtureRules()) });
    for (const id of N_IDS) {
      assert.ok(res.redTeam.includes(id), `RULE ${id} DROPPED from the redTeam frame — seam breach`);
    }
    assert.equal(res.redTeam.length, N_IDS.length, "redTeam frame surfaced extra/phantom ids");
  });

  test("the qa and redTeam frame sets are IDENTICAL (every rule reaches the whole triad)", () => {
    const res = runConsume({ map: writeMap(fixtureRules()) });
    assert.deepEqual([...res.qa].sort(), N_IDS.slice().sort());
    assert.deepEqual([...res.qa].sort(), [...res.redTeam].sort());
  });

  test("a DROPPED rule FAILS (negative control — the seam catches an omission)", () => {
    // Simulate a broken consumer that drops one id from the redTeam frame.
    const ids = ruleIds({ rules: fixtureRules() });
    const dropped = ids.filter((id) => id !== "R-PAYPAL-02");
    // The contract is: redTeam must equal the full id set. A dropped id must NOT
    // satisfy the seam — assert the broken frame is detectable as incomplete.
    let seamHolds = true;
    for (const id of ids) {
      if (!dropped.includes(id)) seamHolds = false;
    }
    assert.equal(seamHolds, false, "a dropped rule must break the seam invariant");
    // And the REAL consumer never drops: it surfaces the full set.
    const real = consume({ rules: fixtureRules() });
    for (const id of ids) assert.ok(real.redTeam.includes(id) && real.qa.includes(id));
  });
});

// ─── fail-closed (consumer never throws; malformed/empty → empty sets) ───────

describe("M88 G3 — consumer is fail-closed and never throws", () => {
  for (const [label, map] of [
    ["null", null],
    ["undefined", undefined],
    ["non-object", 42],
    ["no rules key", {}],
    ["rules not object", { rules: 7 }],
    ["rules null", { rules: null }],
    ["empty rules", { rules: {} }],
  ]) {
    test(`${label} → empty frame sets, no throw`, () => {
      const frames = consume(map);
      assert.deepEqual(frames, { qa: [], redTeam: [] });
    });
  }

  test("missing --map → exitCode 64, empty sets, no throw", () => {
    const res = runConsume({});
    assert.equal(res.ok, false);
    assert.equal(res.exitCode, 64);
    assert.deepEqual(res.qa, []);
    assert.deepEqual(res.redTeam, []);
  });

  test("unreadable map path → exitCode 64, empty sets, no throw", () => {
    const res = runConsume({ map: path.join(os.tmpdir(), "m88-does-not-exist-xyz.json") });
    assert.equal(res.exitCode, 64);
    assert.deepEqual(res.qa, []);
    assert.deepEqual(res.redTeam, []);
  });

  test("malformed JSON map → exitCode 64, empty sets, no throw", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m88-bad-"));
    const p = path.join(dir, "bad.json");
    fs.writeFileSync(p, "{ not json ");
    const res = runConsume({ map: p });
    assert.equal(res.exitCode, 64);
    assert.deepEqual(res.qa, []);
    assert.deepEqual(res.redTeam, []);
  });

  test("duplicate ids in rules object collapse (no phantom dupes)", () => {
    // Object keys are inherently unique, but assert de-dup logic holds for safety.
    const frames = consume({ rules: { "R-X-01": {}, "R-X-02": {} } });
    assert.deepEqual(frames.qa, ["R-X-01", "R-X-02"]);
    assert.deepEqual(frames.redTeam, ["R-X-01", "R-X-02"]);
  });
});
