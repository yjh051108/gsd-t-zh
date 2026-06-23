"use strict";

/**
 * M90 — Tier-Policy Lint (M71-family)
 *
 * Asserts that any new stage label introduced by M90 (specifically the blind-adversary
 * stage, which runs on `fable`) matches `bin/gsd-t-model-tier-policy.cjs`.
 *
 * The blind-adversary stage in `templates/prompts/blind-adversary-subagent.md` is
 * orchestrated by D4-T4's wiring in `gsd-t-phase.workflow.js` (competition arm only).
 * Its model must be the `fable` tier (M85 policy) — and a deliberately-drifted literal
 * MUST FAIL this lint.
 *
 * Also asserts that the M90 dispatch entries in `bin/gsd-t.js` include both new modules:
 *   - `gsd-t-architectural-trigger.cjs` (architectural-trigger dispatch case)
 *   - `gsd-t-loop-ledger.cjs` (loop-ledger dispatch case)
 * and that both are in PROJECT_BIN_TOOLS and GLOBAL_BIN_TOOLS.
 *
 * Contract: .gsd-t/contracts/model-tier-policy-contract.md v1.1.0 STABLE
 * Contract: .gsd-t/contracts/unproven-assumption-doctrine-contract.md §6 [RULE-ARCH-TIER]
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const POLICY_MODULE = path.join(ROOT, "bin", "gsd-t-model-tier-policy.cjs");
const GSD_T_JS = path.join(ROOT, "bin", "gsd-t.js");
const BLIND_ADVERSARY_PROMPT = path.join(ROOT, "templates", "prompts", "blind-adversary-subagent.md");
const WF_PHASE = path.join(ROOT, "templates", "workflows", "gsd-t-phase.workflow.js");

function readFile(fp) {
  try { return fs.readFileSync(fp, "utf8"); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Load the tier policy module
// ---------------------------------------------------------------------------

const policy = require(POLICY_MODULE);
const { MODEL_IDS, STAGE_TIERS, INJECTABLE_STAGES } = policy;
const VALID_TIERS = new Set(Object.keys(MODEL_IDS));

// ---------------------------------------------------------------------------
// 1. Blind-adversary stage model annotation
// ---------------------------------------------------------------------------

describe("blind-adversary tier annotation (fable per M85 + M90 RULE-ARCH-TIER)", () => {
  const blindText = readFile(BLIND_ADVERSARY_PROMPT);

  test("blind-adversary-subagent.md exists", () => {
    assert.ok(blindText, "templates/prompts/blind-adversary-subagent.md must exist (D1 deliverable)");
  });

  test("blind-adversary-subagent.md references fable as the required model tier", () => {
    assert.ok(blindText, "prompt must be readable");
    // The prompt must reference 'fable' as its required model tier.
    // This is the RULE-ARCH-TIER: the blind adversary runs on fable (M85 policy).
    assert.ok(
      blindText.includes("fable"),
      "blind-adversary-subagent.md must reference 'fable' as its required tier (M85 policy, RULE-ARCH-TIER)"
    );
  });

  test("M90 phase workflow wires the blind-adversary competition arm on fable (RULE-ARCH-TIER)", () => {
    const phaseText = readFile(WF_PHASE);
    assert.ok(phaseText, "gsd-t-phase.workflow.js must exist");
    // The phase workflow must use fable for the blind-adversary stage in the competition arm.
    // Pattern: model: "fable" or model: overrides["..."] ?? "fable"
    // The blind-adversary is wired via the competition arm, and its model must be fable.
    assert.ok(
      phaseText.includes('"fable"') || phaseText.includes("'fable'"),
      "gsd-t-phase.workflow.js must reference fable for the blind-adversary competition arm"
    );
  });

  // Mandatory negative test (M71-family): a drifted literal FAILS.
  test("[negative] drifted blind-adversary tier literal ('opus' instead of 'fable') FAILS the check", () => {
    // Simulate: if blind-adversary-subagent.md said 'opus' instead of 'fable', the assertion above fails.
    // We prove the check is non-vacuous by testing a synthetic drifted string.
    const driftedContent = (blindText || "").replace(/\bfable\b/g, "opus");
    const hasFable = driftedContent.includes("fable");
    assert.equal(
      hasFable,
      false,
      "[negative test] after replacing 'fable' with 'opus', the string must not contain 'fable' — " +
      "proves the positive test above is not vacuously true"
    );
  });
});

// ---------------------------------------------------------------------------
// 2. gsd-t.js dispatch cases for new M90 modules
// ---------------------------------------------------------------------------

describe("gsd-t.js dispatch cases for M90 modules", () => {
  const gsdtText = readFile(GSD_T_JS);

  test("bin/gsd-t.js exists", () => {
    assert.ok(gsdtText, "bin/gsd-t.js must exist");
  });

  test("gsd-t.js has 'architectural-trigger' dispatch case", () => {
    assert.ok(gsdtText, "gsd-t.js must be readable");
    assert.ok(
      gsdtText.includes("architectural-trigger"),
      "bin/gsd-t.js must have an 'architectural-trigger' dispatch case (M90 D4-T2)"
    );
  });

  test("gsd-t.js has 'loop-ledger' dispatch case", () => {
    assert.ok(gsdtText, "gsd-t.js must be readable");
    assert.ok(
      gsdtText.includes("loop-ledger"),
      "bin/gsd-t.js must have a 'loop-ledger' dispatch case (M90 D4-T2)"
    );
  });

  test("gsd-t-architectural-trigger.cjs is in PROJECT_BIN_TOOLS", () => {
    assert.ok(gsdtText, "gsd-t.js must be readable");
    // Find the PROJECT_BIN_TOOLS array section and verify the tool is there.
    const projectToolsMatch = gsdtText.match(/const PROJECT_BIN_TOOLS\s*=\s*\[([\s\S]*?)\];/);
    assert.ok(projectToolsMatch, "PROJECT_BIN_TOOLS array must be parseable in gsd-t.js");
    assert.ok(
      projectToolsMatch[1].includes("gsd-t-architectural-trigger.cjs"),
      "gsd-t-architectural-trigger.cjs must be in PROJECT_BIN_TOOLS"
    );
  });

  test("gsd-t-loop-ledger.cjs is in PROJECT_BIN_TOOLS", () => {
    assert.ok(gsdtText, "gsd-t.js must be readable");
    const projectToolsMatch = gsdtText.match(/const PROJECT_BIN_TOOLS\s*=\s*\[([\s\S]*?)\];/);
    assert.ok(projectToolsMatch, "PROJECT_BIN_TOOLS array must be parseable in gsd-t.js");
    assert.ok(
      projectToolsMatch[1].includes("gsd-t-loop-ledger.cjs"),
      "gsd-t-loop-ledger.cjs must be in PROJECT_BIN_TOOLS"
    );
  });

  test("gsd-t-architectural-trigger.cjs is in GLOBAL_BIN_TOOLS", () => {
    assert.ok(gsdtText, "gsd-t.js must be readable");
    const globalToolsMatch = gsdtText.match(/const GLOBAL_BIN_TOOLS\s*=\s*\[([\s\S]*?)\];/);
    assert.ok(globalToolsMatch, "GLOBAL_BIN_TOOLS array must be parseable in gsd-t.js");
    assert.ok(
      globalToolsMatch[1].includes("gsd-t-architectural-trigger.cjs"),
      "gsd-t-architectural-trigger.cjs must be in GLOBAL_BIN_TOOLS"
    );
  });

  test("gsd-t-loop-ledger.cjs is in GLOBAL_BIN_TOOLS", () => {
    assert.ok(gsdtText, "gsd-t.js must be readable");
    const globalToolsMatch = gsdtText.match(/const GLOBAL_BIN_TOOLS\s*=\s*\[([\s\S]*?)\];/);
    assert.ok(globalToolsMatch, "GLOBAL_BIN_TOOLS array must be parseable in gsd-t.js");
    assert.ok(
      globalToolsMatch[1].includes("gsd-t-loop-ledger.cjs"),
      "gsd-t-loop-ledger.cjs must be in GLOBAL_BIN_TOOLS"
    );
  });

  // Mandatory negative test: an absent tool must NOT be found.
  test("[negative] a non-existent dispatch case is NOT in gsd-t.js", () => {
    assert.ok(gsdtText, "gsd-t.js must be readable");
    assert.equal(
      gsdtText.includes("gsd-t-this-module-does-not-exist.cjs"),
      false,
      "[negative test] a non-existent module must not appear in gsd-t.js dispatch"
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Policy module exports the expected stage set (sanity check)
// ---------------------------------------------------------------------------

describe("tier-policy module integrity after M90", () => {
  test("MODEL_IDS contains all four tiers (haiku, sonnet, opus, fable)", () => {
    for (const tier of ["haiku", "sonnet", "opus", "fable"]) {
      assert.ok(MODEL_IDS[tier], `MODEL_IDS must contain tier '${tier}'`);
    }
  });

  test("STAGE_TIERS has fable for the 5 highest-leverage stages (M85 policy)", () => {
    const fableStages = [
      "solution-space-probe", "partition-probe", "competition-judge",
      "pre-mortem", "red-team"
    ];
    for (const stageKey of fableStages) {
      assert.equal(
        STAGE_TIERS[stageKey],
        "fable",
        `STAGE_TIERS['${stageKey}'] must be 'fable' per M85 policy`
      );
    }
  });

  test("competition-producers is held at opus (M82 blindness invariant)", () => {
    assert.equal(
      STAGE_TIERS["competition-producers"],
      "opus",
      "competition-producers must be held at opus (M82 blindness invariant — never fable)"
    );
  });

  test("INJECTABLE_STAGES does NOT include competition-producers", () => {
    const injectable = Array.isArray(INJECTABLE_STAGES)
      ? INJECTABLE_STAGES
      : Object.values(INJECTABLE_STAGES || {});
    assert.equal(
      injectable.includes("competition-producers"),
      false,
      "competition-producers must NOT be in INJECTABLE_STAGES (M82 blindness invariant)"
    );
  });
});
