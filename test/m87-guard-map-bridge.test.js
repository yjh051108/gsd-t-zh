"use strict";

// M87 D1 — A1 KILL-CRITERION harness (test/m87-guard-map-bridge.test.js)
//
// Proves the single uncertain claim the whole milestone rests on: a prose
// `[RULE]` guard map in PseudoCode-[Title].md can be turned into a
// machine-checkable verify gate where divergence is a DETERMINISTIC,
// non-vacuous FAILURE — zero LLM judgment in the pass/fail decision.
//
// If this test cannot be made deterministic, the milestone HALTS (wave gate).
//
// Contract: .gsd-t/contracts/pseudocode-source-of-truth-contract.md §2.
//
// FIXTURE-FIDELITY NOTE (the 13→11 correction): the contract/task were written
// when PayPal's §6 carried 13 [RULE] lines; the upstream binvoice exemplar has
// since changed to 11 (Extension = 8, unchanged). Per the task's own governing
// rule — "The count tracks the byte-verbatim fixture; the fixture is never bent
// to a preordained number" — the byte-verbatim fixture wins and the hard count
// asserted here is 11 for PayPal. Bending the fixture to 13 would be the
// vacuous-pass trap the task warns against.
//
// FAITHFUL-MAP REGEN (the map keyset is GENERATED from the parser's derived ids,
// never hand-maintained — cycle-4 LOW / §A7). To regenerate
// PseudoCode-PayPal.map.json + -doctored.map.json after a fixture re-copy:
//   node -e 'const {parseRules}=require("./bin/gsd-t-guard-map.cjs");const fs=require("node:fs");
//     const p="test/fixtures/m87/PseudoCode-PayPal.md";const {rules}=parseRules(fs.readFileSync(p,"utf8"),p);
//     const f={rules:{}};for(const r of rules)f.rules[r.id]={backedBy:[`test/m87-guard-map-bridge.test.js::${r.id}`],contradicted:false};
//     fs.writeFileSync("test/fixtures/m87/PseudoCode-PayPal.map.json",JSON.stringify(f,null,2)+"\n");
//     const d=JSON.parse(JSON.stringify(f));d.rules["R-PAYPAL-07"].backedBy=[];
//     fs.writeFileSync("test/fixtures/m87/PseudoCode-PayPal-doctored.map.json",JSON.stringify(d,null,2)+"\n");'
// T3 (below) asserts the committed faithful keyset == the parser's derived id set,
// so a drifted hand-edit FAILS — the keyset can never silently rot against the doc.

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const gm = require("../bin/gsd-t-guard-map.cjs");
const { parseRules, runGate } = gm;

const FIX = path.resolve(__dirname, "fixtures", "m87");
const PAYPAL_DOC = path.join(FIX, "PseudoCode-PayPal.md");
const EXT_DOC = path.join(FIX, "PseudoCode-Extension.md");
const PAYPAL_DOCTORED_DOC = path.join(FIX, "PseudoCode-PayPal-doctored.md");
const PAYPAL_MAP = path.join(FIX, "PseudoCode-PayPal.map.json");
const PAYPAL_DOCTORED_MAP = path.join(FIX, "PseudoCode-PayPal-doctored.map.json");

const readDoc = (p) => fs.readFileSync(p, "utf8");

// ─── Fixture-fidelity FIRST (non-vacuous guard) ────────────────────────────
// A parser that extracts ZERO is itself a FAILURE — this is what makes
// "faithful → exit 0" meaningful.

describe("fixture-fidelity: hard rule counts on the byte-verbatim exemplars", () => {
  test("PayPal §6 'Money-safety map' yields EXACTLY 11 rules (byte-verbatim count; was 13 in upstream-of-record)", () => {
    const { rules, parseErrors } = parseRules(readDoc(PAYPAL_DOC), PAYPAL_DOC);
    assert.equal(parseErrors.length, 0, `PayPal must have 0 parse errors, got: ${JSON.stringify(parseErrors)}`);
    assert.equal(rules.length, 11, `PayPal must yield EXACTLY 11 rules (the byte-verbatim count), got ${rules.length}`);
    assert.ok(rules.length > 0, "N must be > 0 (a parser that extracts zero is a FAILURE)");
  });

  test("Extension yields EXACTLY 8 rules", () => {
    const { rules, parseErrors } = parseRules(readDoc(EXT_DOC), EXT_DOC);
    assert.equal(parseErrors.length, 0, `Extension must have 0 parse errors, got: ${JSON.stringify(parseErrors)}`);
    assert.equal(rules.length, 8, `Extension must yield EXACTLY 8 rules, got ${rules.length}`);
  });

  test("the byte-verbatim fixtures match the raw [RULE] marker count (the count tracks the fixture)", () => {
    // Independent confirmation that the parser's count == the literal marker count
    // in the byte-verbatim doc (no rule lost or double-counted).
    const countMarkers = (md) => (md.match(/\[RULE/g) || []).length;
    assert.equal(countMarkers(readDoc(PAYPAL_DOC)), 11, "PayPal fixture must carry 11 literal [RULE markers");
    assert.equal(countMarkers(readDoc(EXT_DOC)), 8, "Extension fixture must carry 8 literal [RULE markers");
  });
});

// ─── Non-empty-invariant (side-agnostic capture) ───────────────────────────
// Every rule of BOTH styles must yield a NON-EMPTY invariant. Proves the A5
// triad-consumption seam gets real attack-surface text, not a bare RULE-ID.

describe("non-empty invariant (side-agnostic capture, §2 v1.1.3)", () => {
  test("every PayPal rule (invariant RIGHT-of-marker) has a non-empty invariant", () => {
    const { rules } = parseRules(readDoc(PAYPAL_DOC), PAYPAL_DOC);
    for (const r of rules) {
      assert.ok(r.invariant && r.invariant.trim().length > 0, `${r.id} must have a non-empty invariant`);
    }
  });

  test("every Extension rule (invariant LEFT-of-marker, '<prose> [RULE — tag]') captures its LEFT prose, not empty", () => {
    const { rules } = parseRules(readDoc(EXT_DOC), EXT_DOC);
    assert.equal(rules.length, 8, "precondition: 8 Extension rules");
    for (const r of rules) {
      assert.ok(
        r.invariant && r.invariant.trim().length > 0,
        `${r.id} (Extension '<prose> [RULE — tag]') must capture its LEFT-of-marker prose as a non-empty invariant — a right-only capture would starve the A5 seam`
      );
      // The tag is captured for provenance; all 8 Extension rules are tagged.
      assert.ok(r.tag && r.tag.length > 0, `${r.id} must carry its '— <tag>' provenance`);
    }
  });
});

// ─── Map-keyset equality (derived-id stability, cycle-4 LOW) ────────────────
// GENERATE the expected keyset PROGRAMMATICALLY from the parser's derived ids,
// then assert the faithful map's keyset EXACTLY equals it. Blocks the map
// silently drifting from the doc and re-introducing a vacuous pass.

describe("map-keyset equality (faithful map keyset == parser derived id set)", () => {
  test("faithful PseudoCode-PayPal.map.json keyset EXACTLY equals the parser's derived id set", () => {
    const { rules } = parseRules(readDoc(PAYPAL_DOC), PAYPAL_DOC);
    const derived = rules.map((r) => r.id).sort();
    const map = JSON.parse(fs.readFileSync(PAYPAL_MAP, "utf8"));
    const mapKeys = Object.keys(map.rules).sort();
    assert.deepEqual(
      mapKeys,
      derived,
      `faithful map keyset must EXACTLY equal the parser's derived ids (no extra/missing key) — a drifted hand-edit must FAIL here`
    );
  });

  test("every faithful map entry is backed (backedBy non-empty) and none contradicted", () => {
    const map = JSON.parse(fs.readFileSync(PAYPAL_MAP, "utf8"));
    for (const [id, e] of Object.entries(map.rules)) {
      assert.ok(Array.isArray(e.backedBy) && e.backedBy.length > 0, `${id} must be backed in the faithful map`);
      assert.notEqual(e.contradicted, true, `${id} must NOT be contradicted in the faithful map`);
    }
  });

  test("doctored map differs from faithful by EXACTLY one rule's backing (map-only divergence; docs byte-identical)", () => {
    const faithful = JSON.parse(fs.readFileSync(PAYPAL_MAP, "utf8"));
    const doctored = JSON.parse(fs.readFileSync(PAYPAL_DOCTORED_MAP, "utf8"));
    // Same keyset.
    assert.deepEqual(Object.keys(doctored.rules).sort(), Object.keys(faithful.rules).sort(), "doctored keyset must match faithful");
    // Exactly one rule differs, and it differs by becoming unbacked OR contradicted.
    const diffs = Object.keys(faithful.rules).filter((id) => {
      const a = faithful.rules[id], b = doctored.rules[id];
      return JSON.stringify(a) !== JSON.stringify(b);
    });
    assert.equal(diffs.length, 1, `doctored must differ from faithful by EXACTLY one rule, differs by: ${diffs.join(", ")}`);
    const flipped = doctored.rules[diffs[0]];
    const isUnbacked = Array.isArray(flipped.backedBy) && flipped.backedBy.length === 0;
    const isContradicted = flipped.contradicted === true;
    assert.ok(isUnbacked || isContradicted, `the one flipped rule (${diffs[0]}) must be unbacked OR contradicted`);
  });

  test("the doctored .md is BYTE-IDENTICAL to the faithful .md (doctoring lives only in the .map.json)", () => {
    const faithfulMd = fs.readFileSync(PAYPAL_DOC);
    const doctoredMd = fs.readFileSync(PAYPAL_DOCTORED_DOC);
    assert.ok(faithfulMd.equals(doctoredMd), "doctored .md must be byte-identical to faithful .md — derived ids stay stable between runs");
  });
});

// ─── A1: the deterministic gate decision ───────────────────────────────────

describe("A1 — deterministic gate (faithful → exit 0; doctored → exit 4, RULE-ID named)", () => {
  test("faithful doc + faithful map → exit 0 (every rule backed, none contradicted)", () => {
    const r = runGate({ doc: PAYPAL_DOC, map: PAYPAL_MAP });
    assert.equal(r.exitCode, 0, `faithful → exit 0, got ${r.exitCode} (reason: ${r.reason})`);
    assert.equal(r.ok, true);
    assert.equal(r.ruleCount, 11, "must have gated all 11 doc-derived rules");
    assert.deepEqual(r.violations, [], "no violations on the faithful build");
  });

  test("faithful doc + doctored map → exit 4 with the violated RULE-ID NAMED", () => {
    const r = runGate({ doc: PAYPAL_DOC, map: PAYPAL_DOCTORED_MAP });
    assert.equal(r.exitCode, 4, `doctored → exit 4, got ${r.exitCode}`);
    assert.equal(r.ok, false);
    assert.ok(r.violations.length >= 1, "must report ≥1 violation");
    // The violated RULE-ID must be named in the envelope output.
    const namedIds = r.violations.map((v) => v.id);
    assert.ok(namedIds.length === 1, `exactly one rule was doctored, got ${namedIds.length}: ${namedIds.join(",")}`);
    assert.ok(/^R-PAYPAL-\d{2}$/.test(namedIds[0]), `violated id must be a derived RULE-ID, got ${namedIds[0]}`);
    assert.ok(r.reason && r.reason.includes(namedIds[0]), `reason must NAME the violated RULE-ID (${namedIds[0]}), got: ${r.reason}`);
  });

  test("the doctored run uses the SAME derived ids as the faithful run (doctoring is map-only)", () => {
    const a = runGate({ doc: PAYPAL_DOC, map: PAYPAL_MAP });
    const b = runGate({ doc: PAYPAL_DOCTORED_DOC, map: PAYPAL_DOCTORED_MAP });
    assert.deepEqual(b.derivedIds, a.derivedIds, "derived ids must be identical between faithful and doctored runs");
  });
});

// ─── unbacked / contradicted both fail ─────────────────────────────────────

describe("both unbacked AND contradicted are FAILURES (contract-breach severity)", () => {
  function mapFrom(rules, mutate) {
    const m = { rules: {} };
    for (const r of rules) m.rules[r.id] = { backedBy: [`t::${r.id}`], contradicted: false };
    mutate(m);
    return m;
  }

  test("an UNBACKED rule (backedBy: []) → exit 4 naming it", () => {
    const { rules } = parseRules(readDoc(PAYPAL_DOC), PAYPAL_DOC);
    const m = mapFrom(rules, (mm) => { mm.rules["R-PAYPAL-03"].backedBy = []; });
    const tmp = path.join(FIX, ".tmp-unbacked.map.json");
    fs.writeFileSync(tmp, JSON.stringify(m));
    try {
      const r = runGate({ doc: PAYPAL_DOC, map: tmp });
      assert.equal(r.exitCode, 4);
      assert.ok(r.violations.some((v) => v.id === "R-PAYPAL-03" && v.kind === "unbacked"), "R-PAYPAL-03 must fail as unbacked");
    } finally { fs.unlinkSync(tmp); }
  });

  test("a CONTRADICTED rule (contradicted: true) → exit 4 naming it", () => {
    const { rules } = parseRules(readDoc(PAYPAL_DOC), PAYPAL_DOC);
    const m = mapFrom(rules, (mm) => { mm.rules["R-PAYPAL-05"].contradicted = true; });
    const tmp = path.join(FIX, ".tmp-contradicted.map.json");
    fs.writeFileSync(tmp, JSON.stringify(m));
    try {
      const r = runGate({ doc: PAYPAL_DOC, map: tmp });
      assert.equal(r.exitCode, 4);
      assert.ok(r.violations.some((v) => v.id === "R-PAYPAL-05" && v.kind === "contradicted"), "R-PAYPAL-05 must fail as contradicted");
    } finally { fs.unlinkSync(tmp); }
  });
});

// ─── Map-side non-vacuity (gate keys on the DOC, not the map) ───────────────
// A map MISSING one doc-derived id ENTIRELY (key absent, not merely unbacked)
// → exit 4 naming that rule UNBACKED. Proves doc-keyed iteration: an incomplete
// map that omits a doc rule can NEVER pass vacuously (contract §2).

describe("map-side non-vacuity — a map MISSING a doc-derived id → exit 4 (doc-keyed iteration)", () => {
  test("a map with one doc-derived key ABSENT → exit 4 naming that rule as unbacked", () => {
    const { rules } = parseRules(readDoc(PAYPAL_DOC), PAYPAL_DOC);
    const m = { rules: {} };
    for (const r of rules) m.rules[r.id] = { backedBy: [`t::${r.id}`], contradicted: false };
    // DELETE one doc-derived key entirely (not just unback it).
    delete m.rules["R-PAYPAL-09"];
    const tmp = path.join(FIX, ".tmp-missing.map.json");
    fs.writeFileSync(tmp, JSON.stringify(m));
    try {
      const r = runGate({ doc: PAYPAL_DOC, map: tmp });
      assert.equal(r.exitCode, 4, "a missing doc-derived key must FAIL (not pass vacuously)");
      const v = r.violations.find((x) => x.id === "R-PAYPAL-09");
      assert.ok(v && v.kind === "unbacked", "R-PAYPAL-09 (key absent) must be reported as UNBACKED");
      // Still gated ALL 11 doc rules (iterates the DOC's id set, not the map's smaller keyset).
      assert.equal(r.ruleCount, 11, "gate must iterate the DOC's 11 derived rules, not the map's 10 keys");
    } finally { fs.unlinkSync(tmp); }
  });

  test("a map with EXTRA keys not in the doc does not change the verdict (doc is the source of truth)", () => {
    const { rules } = parseRules(readDoc(PAYPAL_DOC), PAYPAL_DOC);
    const m = { rules: {} };
    for (const r of rules) m.rules[r.id] = { backedBy: [`t::${r.id}`], contradicted: false };
    m.rules["R-PAYPAL-99-PHANTOM"] = { backedBy: [], contradicted: true }; // an unbacked+contradicted phantom NOT in the doc
    const tmp = path.join(FIX, ".tmp-extra.map.json");
    fs.writeFileSync(tmp, JSON.stringify(m));
    try {
      const r = runGate({ doc: PAYPAL_DOC, map: tmp });
      assert.equal(r.exitCode, 0, "a phantom map key NOT in the doc must NOT fail the gate (doc-keyed iteration ignores it)");
    } finally { fs.unlinkSync(tmp); }
  });
});

// ─── malformed input → 64; never throws; ids stable across re-parse ────────

describe("robustness — malformed → 64, never throws, deterministic", () => {
  test("missing --doc and/or --map → exit 64 (no throw)", () => {
    assert.equal(runGate({ map: PAYPAL_MAP }).exitCode, 64);
    assert.equal(runGate({ doc: PAYPAL_DOC }).exitCode, 64);
    assert.equal(runGate({}).exitCode, 64);
  });

  test("nonexistent doc path → exit 64 (no throw)", () => {
    const r = runGate({ doc: path.join(FIX, "does-not-exist.md"), map: PAYPAL_MAP });
    assert.equal(r.exitCode, 64);
  });

  test("malformed map JSON → exit 64 (no throw)", () => {
    const tmp = path.join(FIX, ".tmp-bad.json");
    fs.writeFileSync(tmp, "{ this is not valid json ");
    try {
      const r = runGate({ doc: PAYPAL_DOC, map: tmp });
      assert.equal(r.exitCode, 64);
    } finally { fs.unlinkSync(tmp); }
  });

  test("map JSON with no `rules` object → exit 64 (no throw)", () => {
    const tmp = path.join(FIX, ".tmp-norules.json");
    fs.writeFileSync(tmp, JSON.stringify({ foo: "bar" }));
    try {
      const r = runGate({ doc: PAYPAL_DOC, map: tmp });
      assert.equal(r.exitCode, 64);
    } finally { fs.unlinkSync(tmp); }
  });

  test("the module NEVER throws on adversarial input", () => {
    assert.doesNotThrow(() => runGate(undefined));
    assert.doesNotThrow(() => runGate(null));
    assert.doesNotThrow(() => runGate({ doc: 12345, map: {} }));
  });

  test("derived ids are STABLE across re-parse (pure — same bytes → same ids)", () => {
    const a = parseRules(readDoc(PAYPAL_DOC), PAYPAL_DOC).rules.map((r) => r.id);
    const b = parseRules(readDoc(PAYPAL_DOC), PAYPAL_DOC).rules.map((r) => r.id);
    assert.deepEqual(a, b, "re-parse must yield identical derived ids");
    assert.deepEqual(a, [
      "R-PAYPAL-01", "R-PAYPAL-02", "R-PAYPAL-03", "R-PAYPAL-04", "R-PAYPAL-05",
      "R-PAYPAL-06", "R-PAYPAL-07", "R-PAYPAL-08", "R-PAYPAL-09", "R-PAYPAL-10", "R-PAYPAL-11",
    ], "derived ids must be the appearance-ordered R-PAYPAL-NN set");
  });
});
