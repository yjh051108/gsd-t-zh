/**
 * Tests for bin/model-selector.js
 * Uses Node.js built-in test runner (node --test)
 *
 * v1.0.0 (M35 T2): declarative phase→tier rules, complexity-signal overrides,
 * /advisor fallback escalation hook (convention-based per M35-advisor-findings.md).
 *
 * v1.1.0 (M85 D2-T3): FABLE tier + cycle-2 escalation ladder added.
 * Regression guards: debug default + haiku/sonnet bottom-of-ladder unchanged.
 *
 * AC requires at least 15 unit tests and coverage of all 13 phases listed in
 * token-telemetry-contract.md + M35-definition.md Part B.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  selectModel,
  listPhases,
  TIERS,
  DEFAULT_TIER,
  ESCALATION_HOOK,
} = require("../bin/model-selector.js");

// M85: import the policy module to cross-check concrete ids
const { MODEL_IDS } = require("../bin/gsd-t-model-tier-policy.cjs");

describe("selectModel — phase defaults", () => {
  it("execute (default) → sonnet with escalation hook", () => {
    const r = selectModel({ phase: "execute" });
    assert.equal(r.model, TIERS.SONNET);
    assert.ok(r.reason.length > 0);
    assert.equal(r.escalation_hook, ESCALATION_HOOK);
  });

  it("execute + test_runner → haiku (mechanical, no hook)", () => {
    const r = selectModel({ phase: "execute", task_type: "test_runner" });
    assert.equal(r.model, TIERS.HAIKU);
    assert.equal(r.escalation_hook, null);
  });

  it("execute + branch_guard → haiku", () => {
    const r = selectModel({ phase: "execute", task_type: "branch_guard" });
    assert.equal(r.model, TIERS.HAIKU);
  });

  it("execute + file_check → haiku", () => {
    const r = selectModel({ phase: "execute", task_type: "file_check" });
    assert.equal(r.model, TIERS.HAIKU);
  });

  it("execute + qa → sonnet (per M31 refinement)", () => {
    const r = selectModel({ phase: "execute", task_type: "qa" });
    assert.equal(r.model, TIERS.SONNET);
    assert.equal(r.escalation_hook, null);
  });

  it("execute + red_team → opus", () => {
    const r = selectModel({ phase: "execute", task_type: "red_team" });
    assert.equal(r.model, TIERS.OPUS);
    assert.equal(r.escalation_hook, null);
  });

  it("wave → sonnet with escalation hook", () => {
    const r = selectModel({ phase: "wave" });
    assert.equal(r.model, TIERS.SONNET);
    assert.equal(r.escalation_hook, ESCALATION_HOOK);
  });

  it("quick → sonnet", () => {
    const r = selectModel({ phase: "quick" });
    assert.equal(r.model, TIERS.SONNET);
  });

  it("integrate → sonnet", () => {
    const r = selectModel({ phase: "integrate" });
    assert.equal(r.model, TIERS.SONNET);
  });

  it("debug (default) → opus", () => {
    const r = selectModel({ phase: "debug" });
    assert.equal(r.model, TIERS.OPUS);
  });

  it("debug + fix_apply → sonnet", () => {
    const r = selectModel({ phase: "debug", task_type: "fix_apply" });
    assert.equal(r.model, TIERS.SONNET);
  });

  it("debug + root_cause → opus", () => {
    const r = selectModel({ phase: "debug", task_type: "root_cause" });
    assert.equal(r.model, TIERS.OPUS);
  });

  it("partition → opus", () => {
    const r = selectModel({ phase: "partition" });
    assert.equal(r.model, TIERS.OPUS);
  });

  it("discuss → opus", () => {
    const r = selectModel({ phase: "discuss" });
    assert.equal(r.model, TIERS.OPUS);
  });

  it("plan → sonnet with escalation hook", () => {
    const r = selectModel({ phase: "plan" });
    assert.equal(r.model, TIERS.SONNET);
    assert.equal(r.escalation_hook, ESCALATION_HOOK);
  });

  it("verify → opus", () => {
    const r = selectModel({ phase: "verify" });
    assert.equal(r.model, TIERS.OPUS);
  });

  it("test-sync → sonnet", () => {
    const r = selectModel({ phase: "test-sync" });
    assert.equal(r.model, TIERS.SONNET);
  });

  it("doc-ripple → sonnet", () => {
    const r = selectModel({ phase: "doc-ripple" });
    assert.equal(r.model, TIERS.SONNET);
  });

  it("red_team (standalone phase) → opus", () => {
    const r = selectModel({ phase: "red_team" });
    assert.equal(r.model, TIERS.OPUS);
  });

  it("qa (standalone phase) → sonnet", () => {
    const r = selectModel({ phase: "qa" });
    assert.equal(r.model, TIERS.SONNET);
  });
});

describe("selectModel — edge cases", () => {
  it("unknown phase → sonnet default with explanatory reason", () => {
    const r = selectModel({ phase: "not-a-real-phase" });
    assert.equal(r.model, DEFAULT_TIER);
    assert.match(r.reason, /Unknown phase/);
    assert.equal(r.escalation_hook, null);
  });

  it("missing args → sonnet default", () => {
    const r = selectModel();
    assert.equal(r.model, DEFAULT_TIER);
    assert.equal(r.escalation_hook, null);
  });

  it("missing phase → sonnet default", () => {
    const r = selectModel({ task_type: "test_runner" });
    assert.equal(r.model, DEFAULT_TIER);
  });

  it("non-object args → sonnet default", () => {
    const r = selectModel("execute");
    assert.equal(r.model, DEFAULT_TIER);
  });
});

describe("selectModel — complexity signal overrides", () => {
  it("sonnet phase + cross_module_refactor signal → opus", () => {
    const r = selectModel({
      phase: "execute",
      complexity_signals: { cross_module_refactor: true },
    });
    assert.equal(r.model, TIERS.OPUS);
    assert.match(r.reason, /cross_module_refactor/);
  });

  it("sonnet phase + security_boundary signal → opus", () => {
    const r = selectModel({
      phase: "integrate",
      complexity_signals: { security_boundary: true },
    });
    assert.equal(r.model, TIERS.OPUS);
  });

  it("sonnet phase + data_loss_risk signal → opus", () => {
    const r = selectModel({
      phase: "test-sync",
      complexity_signals: { data_loss_risk: true },
    });
    assert.equal(r.model, TIERS.OPUS);
  });

  it("sonnet phase + contract_design signal → opus", () => {
    const r = selectModel({
      phase: "plan",
      complexity_signals: { contract_design: true },
    });
    assert.equal(r.model, TIERS.OPUS);
  });

  it("opus phase + complexity signals → stays opus (no downgrade)", () => {
    const r = selectModel({
      phase: "partition",
      complexity_signals: { contract_design: true },
    });
    assert.equal(r.model, TIERS.OPUS);
  });

  it("haiku phase + complexity signals → stays haiku (no escalation of mechanical work)", () => {
    const r = selectModel({
      phase: "execute",
      task_type: "test_runner",
      complexity_signals: { cross_module_refactor: true },
    });
    assert.equal(r.model, TIERS.HAIKU);
  });

  it("falsy complexity signals are ignored", () => {
    const r = selectModel({
      phase: "execute",
      complexity_signals: { cross_module_refactor: false, security_boundary: null },
    });
    assert.equal(r.model, TIERS.SONNET);
  });

  it("unknown complexity signals are ignored", () => {
    const r = selectModel({
      phase: "execute",
      complexity_signals: { made_up_signal: true },
    });
    assert.equal(r.model, TIERS.SONNET);
  });
});

describe("listPhases — coverage assertions", () => {
  it("returns at least 13 distinct phases (M35 AC)", () => {
    const phases = listPhases();
    assert.ok(phases.length >= 13, `expected ≥13 phases, got ${phases.length}: ${phases.join(",")}`);
  });

  it("covers all M35 Part B canonical phases", () => {
    const phases = new Set(listPhases());
    const required = [
      "execute", "wave", "quick", "integrate", "debug",
      "partition", "discuss", "plan", "verify",
      "test-sync", "doc-ripple", "red_team", "qa",
    ];
    for (const p of required) {
      assert.ok(phases.has(p), `missing required phase: ${p}`);
    }
  });
});

describe("selectModel — return shape", () => {
  it("returns {model, reason, escalation_hook} on every call", () => {
    const r = selectModel({ phase: "execute" });
    assert.ok("model" in r);
    assert.ok("reason" in r);
    assert.ok("escalation_hook" in r);
    assert.equal(typeof r.model, "string");
    assert.equal(typeof r.reason, "string");
    assert.ok(r.escalation_hook === null || typeof r.escalation_hook === "string");
  });

  it("model is always one of haiku/sonnet/opus/fable", () => {
    const valid = new Set([TIERS.HAIKU, TIERS.SONNET, TIERS.OPUS, TIERS.FABLE]);
    for (const phase of listPhases()) {
      const r = selectModel({ phase });
      assert.ok(valid.has(r.model), `phase ${phase} returned invalid model ${r.model}`);
    }
  });
});

// ── M85: gsd-t-parallel.cjs alias map assertions ────────────────────────────
// T1 AC: alias map sources from policy module (no bare literals in parallel),
// opus → claude-opus-4-8, fable → claude-fable-5, cache-warm probe uses --model flag.

describe("M85 — gsd-t-parallel alias map (T1 AC)", () => {
  // Directly access the modelAlias via the exported runDispatch internals.
  // Since modelAlias is local to runDispatch, we verify via the policy module
  // cross-check (the live-module equality test from AC b) and grep invariants.
  const { MODEL_IDS: policyIds } = require("../bin/gsd-t-model-tier-policy.cjs");

  it("policy MODULE_IDS.opus === 'claude-opus-4-8' (stale claude-opus-4-7 is dead)", () => {
    assert.equal(policyIds.opus, "claude-opus-4-8",
      `policy module still points to stale id: ${policyIds.opus}`);
    assert.notEqual(policyIds.opus, "claude-opus-4-7",
      "stale claude-opus-4-7 still present in policy module — not fixed");
  });

  it("policy MODEL_IDS.fable === 'claude-fable-5' (fable tier exists)", () => {
    assert.equal(policyIds.fable, "claude-fable-5");
  });

  it("gsd-t-parallel.cjs sources modelAlias from the policy module (no bare literals)", () => {
    // Read the source file and assert no bare model-id literals outside comments
    const fs = require("node:fs");
    const path = require("node:path");
    const src = fs.readFileSync(path.join(__dirname, "../bin/gsd-t-parallel.cjs"), "utf8");

    // Strip comment lines (lines starting with optional whitespace + //)
    const nonCommentLines = src.split("\n").filter(line => !/^\s*\/\//.test(line));
    const nonCommentText = nonCommentLines.join("\n");

    // No bare claude-opus- / claude-fable- / claude-sonnet- / claude-haiku- literals
    // outside comments (AC b falsifier: a bare model-id string appears in the file)
    const bareModelPattern = /claude-(opus|fable|sonnet|haiku)-[0-9]/;
    assert.ok(
      !bareModelPattern.test(nonCommentText),
      "gsd-t-parallel.cjs contains a bare model-id literal outside comments — violates single-source thesis (AC b)"
    );
  });

  it("gsd-t-parallel.cjs contains no thinking-disable flag or env set (AC d)", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const src = fs.readFileSync(path.join(__dirname, "../bin/gsd-t-parallel.cjs"), "utf8");

    // No thinking-disable param added to spawn paths in this file (AC d invariant)
    const thinkingDisablePattern = /thinking.*disabled|disable.*thinking|budgetTokens.*0|budget_tokens.*0/i;
    assert.ok(
      !thinkingDisablePattern.test(src),
      "gsd-t-parallel.cjs sets a thinking-disable param — violates AC d invariant; predicate surface is D1 resolver, not this file"
    );
  });

  it("_runCacheWarmProbe spawn args include ['--model', id] when model is provided (AC T1 env-pinning fix)", () => {
    // Test the fix: model is passed as --model flag, not via env var
    const fs = require("node:fs");
    const path = require("node:path");
    const src = fs.readFileSync(path.join(__dirname, "../bin/gsd-t-parallel.cjs"), "utf8");

    // The fix: cliArgs.push("--model", model) must be present in the cache-warm probe
    assert.ok(
      src.includes('cliArgs.push("--model", model)'),
      "_runCacheWarmProbe does not pass model via --model flag — env-pinning defect not fixed (AC T1)"
    );

    // The old env-only path (without the flag) should no longer be the sole mechanism
    // The ANTHROPIC_MODEL env set may remain for backwards compat but the flag is required
    assert.ok(
      !src.includes('env.ANTHROPIC_MODEL = model;\n\n  try'),
      "env.ANTHROPIC_MODEL is the sole model-pinning path — --model flag not added"
    );
  });
});

// ── M85: FABLE tier + cycle-2 escalation ladder ─────────────────────────────

describe("M85 — FABLE tier exists", () => {
  it("TIERS.FABLE === 'fable'", () => {
    assert.equal(TIERS.FABLE, "fable");
  });

  it("TIERS has exactly haiku, sonnet, opus, fable (no unexpected entries)", () => {
    const keys = Object.keys(TIERS).sort();
    assert.deepEqual(keys, ["FABLE", "HAIKU", "OPUS", "SONNET"]);
  });
});

describe("M85 — cycle-2 escalation: exact API shape", () => {
  it("selectModel({ phase: 'debug', task_type: 'cycle_2_escalation' }) → fable", () => {
    const r = selectModel({ phase: "debug", task_type: "cycle_2_escalation" });
    assert.equal(r.model, TIERS.FABLE, `expected fable, got ${r.model}`);
  });

  it("cycle-2 fable concrete id equals policy module MODEL_IDS.fable", () => {
    // model-selector returns tier aliases; resolve via policy module to get concrete id
    const r = selectModel({ phase: "debug", task_type: "cycle_2_escalation" });
    // r.model is the tier alias ("fable"); the policy module owns the concrete id
    const concreteId = MODEL_IDS[r.model];
    assert.equal(concreteId, MODEL_IDS.fable,
      `selector tier '${r.model}' resolves to '${concreteId}' but policy MODEL_IDS.fable='${MODEL_IDS.fable}'`);
  });
});

describe("M85 — debug DEFAULT byte-identical to pre-M85 (AC f: no silent degradation)", () => {
  it("selectModel({ phase: 'debug' }) still returns opus (default unchanged)", () => {
    const r = selectModel({ phase: "debug" });
    assert.equal(r.model, TIERS.OPUS,
      `debug default regressed: expected opus, got ${r.model}`);
  });

  it("selectModel({ phase: 'debug', task_type: 'root_cause' }) still returns opus", () => {
    const r = selectModel({ phase: "debug", task_type: "root_cause" });
    assert.equal(r.model, TIERS.OPUS,
      `debug root_cause regressed: expected opus, got ${r.model}`);
  });

  it("selectModel({ phase: 'debug', task_type: 'fix_apply' }) still returns sonnet", () => {
    const r = selectModel({ phase: "debug", task_type: "fix_apply" });
    assert.equal(r.model, TIERS.SONNET,
      `debug fix_apply regressed: expected sonnet, got ${r.model}`);
  });
});

describe("M85 — haiku/sonnet bottom-of-ladder unchanged (regression guard)", () => {
  it("execute + test_runner → haiku (unchanged)", () => {
    assert.equal(selectModel({ phase: "execute", task_type: "test_runner" }).model, TIERS.HAIKU);
  });

  it("execute + branch_guard → haiku (unchanged)", () => {
    assert.equal(selectModel({ phase: "execute", task_type: "branch_guard" }).model, TIERS.HAIKU);
  });

  it("execute + file_check → haiku (unchanged)", () => {
    assert.equal(selectModel({ phase: "execute", task_type: "file_check" }).model, TIERS.HAIKU);
  });

  it("quick + test_runner → haiku (unchanged)", () => {
    assert.equal(selectModel({ phase: "quick", task_type: "test_runner" }).model, TIERS.HAIKU);
  });

  it("integrate + test_runner → haiku (unchanged)", () => {
    assert.equal(selectModel({ phase: "integrate", task_type: "test_runner" }).model, TIERS.HAIKU);
  });

  it("execute (default) → sonnet (unchanged)", () => {
    assert.equal(selectModel({ phase: "execute" }).model, TIERS.SONNET);
  });

  it("plan → sonnet (unchanged)", () => {
    assert.equal(selectModel({ phase: "plan" }).model, TIERS.SONNET);
  });

  it("test-sync → sonnet (unchanged)", () => {
    assert.equal(selectModel({ phase: "test-sync" }).model, TIERS.SONNET);
  });

  it("doc-ripple → sonnet (unchanged)", () => {
    assert.equal(selectModel({ phase: "doc-ripple" }).model, TIERS.SONNET);
  });
});
