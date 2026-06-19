"use strict";

// M89-D1 anti-hardcode guard (Red Team finding #3, HIGH)
//
// The held-out corpus (test/fixtures/m89-heldout-corpus.json) proves the classifier
// GENERALIZES by feature/structural SHAPE rather than memorizing a list of specific
// repo symbols. If the classifier hard-codes the held-out corpus's specific novel
// symbols (resolveProfile / isOrderLocked / cli-preflight / proveDisjointness) into
// its pattern lists, the held-out test proves NOTHING (the self-fulfilling-oracle
// trap reborn in the implementation).
//
// This guard asserts NONE of those specific held-out symbols appear as a string
// LITERAL in bin/gsd-t-research-gate.cjs. Re-hard-coding any of them FAILS this test.
// They must be classified by STRUCTURE (camelCase / kebab-ish local-symbol shape or
// repo-relative path shape), not by enumeration.
//
// Contract: auto-research-contract.md §1.1 + §6 (held-out generalization corpus)
// Runner: npm test

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CLASSIFIER_PATH = path.resolve(ROOT, "bin", "gsd-t-research-gate.cjs");
const classifierSrc = fs.readFileSync(CLASSIFIER_PATH, "utf8");

// The specific held-out symbols that MUST NOT be hard-coded into the classifier.
// (Lowercased for a case-insensitive presence check — the classifier lowercases input.)
const FORBIDDEN_HELDOUT_SYMBOLS = [
  "resolveprofile",   // HO-I4
  "isorderlocked",    // HO-I1
  "cli-preflight",    // HO-I3
  "provedisjointness", // (held-out generalization symbol)
];

describe("D1 anti-hardcode guard — held-out symbols are NOT enumerated in the classifier (finding #3)", () => {
  const lowerSrc = classifierSrc.toLowerCase();

  for (const sym of FORBIDDEN_HELDOUT_SYMBOLS) {
    test(`classifier source does NOT contain the held-out symbol literal "${sym}"`, () => {
      assert.ok(
        !lowerSrc.includes(sym),
        `bin/gsd-t-research-gate.cjs contains the held-out symbol "${sym}" as a literal.\n` +
          `  Held-out symbols MUST be classified by STRUCTURAL SHAPE (camelCase / kebab-ish\n` +
          `  local-symbol or repo-path shape), NOT enumerated — otherwise the held-out\n` +
          `  generalization test (m89-research-classifier-corpus) proves nothing (the\n` +
          `  self-fulfilling-oracle trap). Remove the literal; rely on matchLocalSymbolShape.`,
      );
    });
  }

  test("classifier still defines a STRUCTURAL local-symbol shape detector (the generalizing path)", () => {
    assert.ok(
      classifierSrc.includes("matchLocalSymbolShape"),
      "Classifier must define matchLocalSymbolShape() — the structural (non-enumerated) " +
        "local-symbol detector that classifies held-out symbols by shape.",
    );
  });

  test("the held-out symbols still classify correctly BY SHAPE (generalization holds)", () => {
    const { classify } = require(CLASSIFIER_PATH);
    const cases = [
      ["Does resolveProfile clamp the competition-judge model?", "internal"], // camelCase
      ["What does isOrderLocked return when the order is locked?", "internal"], // camelCase
      ["What exit code does cli-preflight use on a wrong branch?", "internal"], // kebab + anchor
      ["Does proveDisjointness reject overlapping file ownership?", "internal"], // camelCase
    ];
    for (const [gap, expected] of cases) {
      const r = classify(gap);
      assert.strictEqual(
        r.class,
        expected,
        `"${gap}" must classify ${expected} by SHAPE, got "${r.class}" (reason: ${r.reason})`,
      );
    }
  });
});
