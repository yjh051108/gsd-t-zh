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
//
// v1.3.0 (3-result mechanical filter): a BARE camelCase symbol is shape-identical to an
// external symbol, so it is NOT a string fact about this repo — the classifier returns
// AMBIGUOUS for it (the LLM judge + grep place it). The old matchLocalSymbolShape()
// "camelCase => this-repo" heuristic was DELETED (it was a GUESS — the sin M89 prevents).
// The anti-hardcode invariant is UNCHANGED and even stronger: no held-out symbol may be
// enumerated as a literal — bare symbols simply fall through to ambiguous.
//
// Contract: auto-research-contract.md §1.1 + §6 (held-out generalization corpus, v1.3.0)
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

  test("classifier does NOT re-introduce a camelCase 'shape => this-repo' guesser (deleted in v1.3.0)", () => {
    // The old matchLocalSymbolShape() guessed camelCase => internal — a belief, the sin
    // M89 prevents. It is intentionally GONE; bare symbols fall through to ambiguous.
    assert.ok(
      !classifierSrc.includes("matchLocalSymbolShape"),
      "Classifier must NOT define matchLocalSymbolShape() — the camelCase 'shape implies this-repo' " +
        "guesser was deleted (it was a guess). A bare symbol is ambiguous → the LLM judge places it.",
    );
  });

  test("held-out bare symbols classify AMBIGUOUS (shape is not a string fact) — generalization holds", () => {
    const { classify } = require(CLASSIFIER_PATH);
    // A bare camelCase/kebab symbol with no anchor/path is ambiguous (not a string fact).
    const ambiguousCases = [
      "Does resolveProfile clamp the competition-judge model?",
      "What does isOrderLocked return when the order is locked?",
      "Does proveDisjointness reject overlapping file ownership?",
    ];
    for (const gap of ambiguousCases) {
      const r = classify(gap);
      assert.strictEqual(
        r.class, "ambiguous",
        `"${gap}" must be AMBIGUOUS (bare symbol is not a string fact → LLM judge), got "${r.class}" (reason: ${r.reason})`,
      );
    }
    // A concrete string fact (anchor / path / tool shape) still classifies confidently.
    assert.strictEqual(
      classify("What exit code does cli-preflight use on a wrong branch?").class,
      "internal",
      "'exit code' anchor is a string fact → internal (NOT via enumerating cli-preflight)",
    );
  });
});
