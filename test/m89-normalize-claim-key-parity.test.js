"use strict";

// M89 normalizeClaimKey cross-workflow parity guard (code-review #2 + nit #3)
//
// §4.1/§7 require the claim-key normalization to be byte-identical across the phase
// (upper) workflow and the three worker workflows (execute/quick/debug) — otherwise an
// uncited→cited marker find/replace, or the idempotency exact-key match, breaks across
// the phase↔worker boundary for any claim with trailing punctuation (?/!/:/etc).
//
// This guard extracts the normalizeClaimKey FUNCTION BODY from each of the four workflow
// sources and asserts they are byte-identical. A future drift (a different .replace(...)
// form in one workflow) FAILS this test.
//
// Contract: auto-research-contract.md §4.1 (exact normalized-claim-key) + §7 (one key, two uses)
// Runner: npm test

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const WF_DIR = path.resolve(__dirname, "..", "templates", "workflows");

const WORKFLOWS = [
  "gsd-t-phase.workflow.js",   // upper phases (D3) — the canonical form
  "gsd-t-execute.workflow.js", // worker (D4)
  "gsd-t-quick.workflow.js",   // worker (D4)
  "gsd-t-debug.workflow.js",   // worker (D4)
];

/**
 * Extract the body of `function normalizeClaimKey(claim) { ... }` from source.
 * Returns the substring from the opening brace to its matching close, whitespace-
 * preserved (byte-exact). Throws if the function is absent.
 */
function extractNormalizeBody(src) {
  const sigIdx = src.indexOf("function normalizeClaimKey(");
  assert.ok(sigIdx !== -1, "normalizeClaimKey function must be defined");
  const braceIdx = src.indexOf("{", sigIdx);
  assert.ok(braceIdx !== -1, "normalizeClaimKey must have a body");
  let depth = 0;
  for (let i = braceIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return src.slice(braceIdx, i + 1);
    }
  }
  throw new Error("Unbalanced braces extracting normalizeClaimKey body");
}

describe("normalizeClaimKey is byte-identical across phase + worker workflows (finding #6)", () => {
  const bodies = {};
  for (const wf of WORKFLOWS) {
    bodies[wf] = extractNormalizeBody(fs.readFileSync(path.join(WF_DIR, wf), "utf8"));
  }

  const canonical = bodies["gsd-t-phase.workflow.js"];

  test("phase workflow defines the canonical normalizeClaimKey body", () => {
    assert.ok(canonical.includes("toLowerCase"), "canonical body must lowercase");
    assert.ok(canonical.includes("[^\\w]"), "canonical body must strip with the [^\\w] form (matches test oracles)");
  });

  for (const wf of WORKFLOWS) {
    test(`${wf} normalizeClaimKey body matches the canonical (phase) body byte-for-byte`, () => {
      assert.strictEqual(
        bodies[wf],
        canonical,
        `${wf} normalizeClaimKey body DIVERGES from gsd-t-phase.workflow.js.\n` +
          `  Drifted keys break §4.1 idempotency + the uncited→cited flip across the phase/worker boundary.\n` +
          `  canonical: ${JSON.stringify(canonical)}\n  ${wf}: ${JSON.stringify(bodies[wf])}`,
      );
    });
  }
});
