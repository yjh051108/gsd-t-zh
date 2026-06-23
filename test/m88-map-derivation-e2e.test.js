"use strict";

// M88 G2-T2 — END-TO-END derivation→gate test
// (test/m88-map-derivation-e2e.test.js)
//
// The backlog #35 killing test for the moved A1 piece. M87 D1 proved the
// guard-map GATE discriminates a faithful vs doctored hand-authored --map, but
// the PATH that DERIVES the map from the build (which test assertions back which
// [RULE]) was untested. This closes that gap: derivation is INCLUDED end-to-end,
// not hand-authored.
//
// In a redirected temp dir we seed a REAL PseudoCode doc (copied from the D1
// fixture, which stays read-only) + an evidence manifest backing EVERY derived
// RULE-ID. Then, end-to-end and zero-LLM:
//   (a) run DERIVATION (gsd-t-guard-map-derive.cjs) → feed the DERIVED map (not a
//       hand-authored fixture) to the D1 GATE (gsd-t-guard-map.cjs) → EXIT 0.
//   (b) REMOVE one backing assertion from the evidence manifest → RE-DERIVE → feed
//       to the gate → EXIT non-zero, the now-unbacked RULE-ID NAMED in output.
//   (c) assert the derived map's keyset EXACTLY equals D1's parser's derived id
//       set — generated PROGRAMMATICALLY from the parse, never hand-typed.
//
// Both gate invocations run the REAL CLI as a child process (execFileSync), the
// same invocation pattern test/m87-verify-guardmap-wiring.test.js uses — proving
// the derived map is valid gate input, not just an in-process object.
//
// Contract: pseudocode-source-of-truth-contract.md §2 (gate) + §6 of the PayPal
// exemplar (the money-safety map this derives against).

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

// IMPORT D1's parser to compute the EXPECTED derived id set programmatically
// (never hand-typed) — the same single-source-of-truth grammar the derivation
// and the gate both read.
const { parseRules } = require("../bin/gsd-t-guard-map.cjs");

const DERIVE_CLI = path.resolve(__dirname, "..", "bin", "gsd-t-guard-map-derive.cjs");
const GUARD_MAP_CLI = path.resolve(__dirname, "..", "bin", "gsd-t-guard-map.cjs");
const FIX_DOC = path.resolve(__dirname, "fixtures", "m87", "PseudoCode-PayPal.md");

let TMP; // redirected temp dir — never the real project tree
let DOC; // seeded copy of the read-only fixture
let EVIDENCE; // evidence manifest path
let DERIVED_MAP; // derived map written here for the gate to read

// Run a CLI, capturing both exit code and stdout. execFileSync throws a non-zero
// exit as an error carrying `.status` + `.stdout` — normalize to a plain shape.
function runCli(bin, args) {
  try {
    const stdout = execFileSync("node", [bin, ...args], { encoding: "utf8" });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status == null ? 1 : e.status, stdout: e.stdout ? e.stdout.toString() : "" };
  }
}

// Derive the map via the REAL derivation CLI, capture the printed map JSON.
function deriveMapViaCli(docPath, evidencePath) {
  const r = runCli(DERIVE_CLI, ["--doc", docPath, "--evidence", evidencePath, "--json"]);
  assert.equal(r.code, 0, `derivation must exit 0, got ${r.code} — stdout: ${r.stdout}`);
  return JSON.parse(r.stdout);
}

before(() => {
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), "m88-derive-e2e-"));
  DOC = path.join(TMP, "PseudoCode-PayPal.md");
  EVIDENCE = path.join(TMP, "evidence.json");
  DERIVED_MAP = path.join(TMP, "derived.map.json");

  // Seed a REAL PseudoCode doc — copy the byte-verbatim D1 fixture (read-only:
  // we copy it, never mutate the source).
  fs.copyFileSync(FIX_DOC, DOC);

  // Build an evidence manifest backing EVERY derived RULE-ID. The id set comes
  // from D1's parser on the seeded doc — programmatic, never hand-typed.
  const { rules } = parseRules(fs.readFileSync(DOC, "utf8"), DOC);
  const manifest = {
    evidence: rules.map((r) => ({
      ref: `test/m88-map-derivation-e2e.test.js::${r.id}`,
      backs: [r.id],
    })),
  };
  fs.writeFileSync(EVIDENCE, JSON.stringify(manifest, null, 2) + "\n");
});

after(() => {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
});

describe("M88 G2 — end-to-end derivation → gate (faithful build)", () => {
  test("(a) DERIVE the map from doc+evidence, feed the DERIVED map to the gate → exit 0", () => {
    const map = deriveMapViaCli(DOC, EVIDENCE);

    // The derived map is the gate's input — write it and feed it to the REAL gate CLI.
    fs.writeFileSync(DERIVED_MAP, JSON.stringify(map, null, 2) + "\n");
    const gate = runCli(GUARD_MAP_CLI, ["--doc", DOC, "--map", DERIVED_MAP, "--json"]);

    assert.equal(gate.code, 0, `faithful derived build must pass the gate (exit 0), got ${gate.code} — stdout: ${gate.stdout}`);
    const env = JSON.parse(gate.stdout);
    assert.equal(env.ok, true, "gate envelope ok must be true on a faithful derived map");
    assert.deepEqual(env.violations, [], "no violations on a faithful derived build");
    assert.ok(env.ruleCount > 0, "gate must have gated > 0 doc-derived rules (non-vacuous)");
  });

  test("every derived map entry is backed (backedBy non-empty) and none contradicted", () => {
    const map = deriveMapViaCli(DOC, EVIDENCE);
    const entries = Object.entries(map.rules);
    assert.ok(entries.length > 0, "derived map must have > 0 rules");
    for (const [id, e] of entries) {
      assert.ok(Array.isArray(e.backedBy) && e.backedBy.length > 0, `${id} must be backed in the fully-backed derivation`);
      assert.notEqual(e.contradicted, true, `${id} must NOT be contradicted in the faithful derivation`);
    }
  });
});

describe("M88 G2 — end-to-end derivation → gate (one assertion removed → gate FAILS)", () => {
  test("(b) REMOVE one backing assertion → re-derive → gate exit non-zero, the unbacked RULE-ID NAMED", () => {
    // Choose the FIRST derived id to unback — programmatically, not hand-typed.
    const { rules } = parseRules(fs.readFileSync(DOC, "utf8"), DOC);
    const targetId = rules[0].id;

    // Remove the assertion backing exactly that id from the manifest.
    const manifest = JSON.parse(fs.readFileSync(EVIDENCE, "utf8"));
    const reduced = {
      evidence: manifest.evidence.filter((item) => !(Array.isArray(item.backs) && item.backs.includes(targetId))),
    };
    // Sanity: removing it actually dropped a backing for targetId (no silent no-op).
    const stillBacks = reduced.evidence.some((i) => Array.isArray(i.backs) && i.backs.includes(targetId));
    assert.equal(stillBacks, false, `precondition: ${targetId} must no longer be backed after removal`);

    const reducedPath = path.join(TMP, "evidence-reduced.json");
    fs.writeFileSync(reducedPath, JSON.stringify(reduced, null, 2) + "\n");

    // RE-DERIVE from the reduced manifest.
    const map = deriveMapViaCli(DOC, reducedPath);

    // The target id must STILL be a key (doc-keyed non-vacuity) but now unbacked.
    assert.ok(Object.prototype.hasOwnProperty.call(map.rules, targetId), `${targetId} key must remain present (doc-keyed non-vacuity), not omitted`);
    assert.deepEqual(map.rules[targetId].backedBy, [], `${targetId} must be backedBy:[] after its assertion was removed`);

    // Feed the re-derived map to the gate → non-zero, naming the rule.
    const reMap = path.join(TMP, "derived-reduced.map.json");
    fs.writeFileSync(reMap, JSON.stringify(map, null, 2) + "\n");
    const gate = runCli(GUARD_MAP_CLI, ["--doc", DOC, "--map", reMap, "--json"]);

    assert.notEqual(gate.code, 0, `removing a backing assertion must FAIL the gate (non-zero exit), got ${gate.code}`);
    assert.equal(gate.code, 4, `the gate's unbacked-rule exit is 4, got ${gate.code}`);
    const env = JSON.parse(gate.stdout);
    assert.equal(env.ok, false, "gate envelope ok must be false");
    const namedIds = env.violations.map((v) => v.id);
    assert.ok(namedIds.includes(targetId), `the now-unbacked RULE-ID (${targetId}) must be NAMED in violations, got: ${namedIds.join(", ")}`);
    assert.ok(env.reason && env.reason.includes(targetId), `gate reason must NAME the unbacked RULE-ID (${targetId}), got: ${env.reason}`);
    const v = env.violations.find((x) => x.id === targetId);
    assert.equal(v.kind, "unbacked", `${targetId} must be reported as UNBACKED`);
  });
});

describe("M88 G2 — derived keyset EXACTLY equals the parser's derived id set", () => {
  test("(c) derived map keyset == D1 parser's derived id set (programmatic, never hand-typed)", () => {
    const map = deriveMapViaCli(DOC, EVIDENCE);

    // The expected keyset is GENERATED from the parser — never a hand-typed list.
    const { rules } = parseRules(fs.readFileSync(DOC, "utf8"), DOC);
    const derived = rules.map((r) => r.id).sort();
    const mapKeys = Object.keys(map.rules).sort();

    assert.deepEqual(
      mapKeys,
      derived,
      "derived map keyset must EXACTLY equal the parser's derived id set (no extra/missing key)"
    );
    // And the keyset is non-empty — a derivation that emits zero rules is vacuous.
    assert.ok(mapKeys.length > 0, "derived keyset must be non-empty (non-vacuous)");
  });

  test("the source fixture stays UNMODIFIED (read-only) — derivation never mutates the doc", () => {
    const seeded = fs.readFileSync(DOC);
    const source = fs.readFileSync(FIX_DOC);
    assert.ok(seeded.equals(source), "the seeded doc must stay byte-identical to the read-only fixture");
  });
});

describe("M88 G2 — derivation robustness (never throws, bad input → 64)", () => {
  test("missing --doc and/or --evidence → exit 64", () => {
    assert.equal(runCli(DERIVE_CLI, ["--evidence", EVIDENCE]).code, 64);
    assert.equal(runCli(DERIVE_CLI, ["--doc", DOC]).code, 64);
    assert.equal(runCli(DERIVE_CLI, []).code, 64);
  });

  test("nonexistent doc path → exit 64", () => {
    assert.equal(runCli(DERIVE_CLI, ["--doc", path.join(TMP, "nope.md"), "--evidence", EVIDENCE]).code, 64);
  });

  test("malformed evidence JSON → exit 64", () => {
    const bad = path.join(TMP, "bad-evidence.json");
    fs.writeFileSync(bad, "{ not valid json ");
    assert.equal(runCli(DERIVE_CLI, ["--doc", DOC, "--evidence", bad]).code, 64);
  });

  test("phantom evidence ids (not in the doc) are IGNORED — keyset still equals the doc's", () => {
    const phantom = { evidence: [{ ref: "test/x::phantom", backs: ["R-PAYPAL-99-PHANTOM"] }] };
    const phantomPath = path.join(TMP, "phantom-evidence.json");
    fs.writeFileSync(phantomPath, JSON.stringify(phantom) + "\n");
    const map = deriveMapViaCli(DOC, phantomPath);

    const { rules } = parseRules(fs.readFileSync(DOC, "utf8"), DOC);
    const derived = rules.map((r) => r.id).sort();
    assert.deepEqual(Object.keys(map.rules).sort(), derived, "phantom ids must never invent a map key (doc is the source of truth)");
    assert.ok(!Object.prototype.hasOwnProperty.call(map.rules, "R-PAYPAL-99-PHANTOM"), "the phantom id must NOT appear as a key");
  });
});
