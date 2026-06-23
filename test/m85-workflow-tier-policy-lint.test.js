"use strict";

// M85 / M71-family / M86 — Model-Tier Policy Drift Enforcer
//
// Asserts every workflow model: literal is a member of the published tier set,
// the 6 designated stages resolve to the correct tiers (6 → fable, producers → opus,
// debug cycle-1 → opus, debug cycle-2 → fable), and deliberately-drifted fixtures
// FAIL the checker.
//
// M86 EXTENDS: also recognises the `??`-override form:
//   model: overrides["<stage>"] ?? "<premium-literal>"
// and validates BOTH the bracket key (must be an injectable designated stage, NOT
// competition-producers) AND the fallback literal (tier set + stage policy).
// Also handles the combined debug form:
//   model: cycle === 1 ? "opus" : (overrides["debug-cycle-2"] ?? "fable")
// FAIL-CLOSED: any model:-bearing line the extractor cannot parse FAILS the lint.
//
// Contract: .gsd-t/contracts/model-tier-policy-contract.md v1.1.0 STABLE
// Contract: .gsd-t/contracts/model-profile-config-contract.md §Drift-Lint Obligation
// Contract: .gsd-t/contracts/model-selection-contract.md

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const WF_DIR = path.resolve(__dirname, "..", "templates", "workflows");
const POLICY_MODULE = path.resolve(__dirname, "..", "bin", "gsd-t-model-tier-policy.cjs");
const POLICY_CONTRACT = path.resolve(__dirname, "..", ".gsd-t", "contracts", "model-tier-policy-contract.md");

// ---------------------------------------------------------------------------
// Load the policy module (single source of truth for tier set + STAGE_TIERS)
// ---------------------------------------------------------------------------

// eslint-disable-next-line import/no-dynamic-require
const policy = require(POLICY_MODULE);
const { MODEL_IDS, STAGE_TIERS } = policy;

// Published tier set (keys of MODEL_IDS)
const VALID_TIERS = new Set(Object.keys(MODEL_IDS)); // {opus, fable, sonnet, haiku}

// Injectable designated stages: STAGE_TIERS keys MINUS competition-producers.
// A bracket key overrides["competition-producers"] is an EXPLICIT violation (M82 HELD).
// Pre-mortem c2 #1: producers IS in STAGE_TIERS, so a naive keys-of-policy check
// would bless overrides["competition-producers"] ?? "opus" — that form is forbidden.
const INJECTABLE_STAGES = new Set(
  Object.keys(STAGE_TIERS).filter((k) => k !== "competition-producers")
);

// ---------------------------------------------------------------------------
// Explicit stage-key → live source-label mapping table
// (pre-mortem r2 finding #3 — contract keys and live labels are DIFFERENT strings)
// ---------------------------------------------------------------------------

// Each entry: { stageKey, expectedTier, labelPattern: RegExp|string, files: [basename] }
// labelPattern matches the live label= value (string literal or template literal) in the agent() call.
// For template literals like `candidate:${ids[i]}`, we use a regex.
// "files" lists which workflow file(s) contain this stage.
const DESIGNATED_STAGE_MAP = [
  {
    stageKey: "solution-space-probe",
    expectedTier: "fable",
    labelPattern: /^"solution-space-probe"$/,
    files: ["gsd-t-phase.workflow.js"],
    description: "solution-space probe (phase)",
  },
  {
    stageKey: "partition-probe",
    expectedTier: "fable",
    labelPattern: /^"partition-probe"$/,
    files: ["gsd-t-phase.workflow.js"],
    description: "partition probe (phase)",
  },
  {
    stageKey: "competition-judge",
    expectedTier: "fable",
    labelPattern: /^"judge:rubric"$/,
    files: ["gsd-t-phase.workflow.js"],
    description: "competition judge (phase)",
  },
  {
    stageKey: "competition-producers",
    expectedTier: "opus",
    labelPattern: /^`candidate:\$\{/, // template literal: `candidate:${ids[i]}`
    files: ["gsd-t-phase.workflow.js"],
    description: "competition producers (phase) — HELD at opus (M82 blindness invariant)",
  },
  {
    stageKey: "pre-mortem",
    expectedTier: "fable",
    labelPattern: /^"pre-mortem"$/,
    files: ["gsd-t-phase.workflow.js"],
    description: "pre-mortem (phase)",
  },
  {
    stageKey: "red-team",
    expectedTier: "fable",
    labelPattern: /^"red-team"$/,
    files: ["gsd-t-verify.workflow.js"],
    description: "red-team (verify)",
  },
  {
    stageKey: "debug-cycle-2",
    expectedTier: "fable",
    labelPattern: /^`debug-cycle-\$\{cycle\}`$|^`debug-cycle-\$\{/, // template literal
    files: ["gsd-t-debug.workflow.js"],
    description: "debug cycle-2 (debug) — per-cycle ternary, cycle-1 → opus, cycle-2 → fable",
  },
];

// ---------------------------------------------------------------------------
// Core checker functions (used for both live and fixture/copy assertions)
// ---------------------------------------------------------------------------

/**
 * Extract all model: values from source text.
 *
 * Recognised forms (evaluated in order, first match wins per line):
 *   1. Combined debug ternary with parenthesized ?? else-branch (M86 pre-mortem r1 #6):
 *        model: cycle === 1 ? "opus" : (overrides["debug-cycle-2"] ?? "fable")
 *      → emits {value:"opus", ternaryBranch:"if"} and
 *              {value:"fable", overrideKey:"debug-cycle-2", isOverrideForm:true, ternaryBranch:"else"}
 *   2. Simple ternary (no ?? in else-branch):
 *        model: cycle === 1 ? "opus" : "fable"
 *      → emits {value:"opus", ternaryBranch:"if"} and {value:"fable", ternaryBranch:"else"}
 *   3. Override form (M86):
 *        model: overrides["stage"] ?? "fallback"
 *      → emits {value:"fallback", overrideKey:"stage", isOverrideForm:true}
 *   4. Bare literal:
 *        model: "opus"   or   model: 'opus'
 *      → emits {value:"opus"}
 *   5. FAIL-CLOSED: any line containing \bmodel\s*: that did not match any form above
 *      → emits {parseError:true} — the checker treats this as a violation.
 *
 * All entries include { line: number, raw: string }.
 * "value" is always a tier alias string (e.g. "opus", "fable", "sonnet", "haiku").
 */
function extractModelLiterals(source) {
  const lines = source.split("\n");
  const results = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip pure comment lines
    const codeOnly = line.replace(/\/\/.*$/, "");

    // Not a model: line at all — skip
    if (!/\bmodel\s*:/.test(codeOnly)) continue;

    // ----- Form 1: combined debug ternary with parenthesized ?? else-branch -----
    // model: <cond> ? "a" : (overrides["key"] ?? "fallback")
    const combinedTernaryMatch = codeOnly.match(
      /\bmodel\s*:.*\?\s*["']([^"']+)["']\s*:\s*\(\s*overrides\s*\[\s*["']([^"']+)["']\s*\]\s*\?\?\s*["']([^"']+)["']\s*\)/
    );
    if (combinedTernaryMatch) {
      results.push({ value: combinedTernaryMatch[1], line: lineNum, raw: line.trim(), ternaryBranch: "if" });
      results.push({
        value: combinedTernaryMatch[3],
        overrideKey: combinedTernaryMatch[2],
        isOverrideForm: true,
        line: lineNum,
        raw: line.trim(),
        ternaryBranch: "else",
      });
      continue;
    }

    // ----- Form 2: simple ternary — model: condition ? "a" : "b" -----
    // (MUST come before Form 3/4 to avoid partial-matching ?? ternaries)
    const ternaryMatch = codeOnly.match(/\bmodel\s*:.*\?\s*["']([^"']+)["']\s*:\s*["']([^"']+)["']/);
    if (ternaryMatch) {
      results.push({ value: ternaryMatch[1], line: lineNum, raw: line.trim(), ternaryBranch: "if" });
      results.push({ value: ternaryMatch[2], line: lineNum, raw: line.trim(), ternaryBranch: "else" });
      continue;
    }

    // ----- Form 3: ?? override form — model: overrides["key"] ?? "fallback" -----
    const overrideMatch = codeOnly.match(
      /\bmodel\s*:\s*overrides\s*\[\s*["']([^"']+)["']\s*\]\s*\?\?\s*["']([^"']+)["']/
    );
    if (overrideMatch) {
      results.push({
        value: overrideMatch[2],
        overrideKey: overrideMatch[1],
        isOverrideForm: true,
        line: lineNum,
        raw: line.trim(),
      });
      continue;
    }

    // ----- Form 4: bare literal — model: "opus"  or  model: 'opus' -----
    const simpleMatch = codeOnly.match(/\bmodel\s*:\s*["']([^"']+)["']/);
    if (simpleMatch) {
      results.push({ value: simpleMatch[1], line: lineNum, raw: line.trim() });
      continue;
    }

    // ----- Form 5: FAIL-CLOSED — unrecognized model: line -----
    // Any line that has \bmodel\s*: but didn't match a known form is a parse error.
    results.push({ parseError: true, line: lineNum, raw: line.trim() });
  }

  return results;
}

/**
 * For the debug workflow, extract the ternary branches as { cycle1Tier, cycle2Tier }.
 * Returns null if no ternary is found (flat literal — a lint violation).
 *
 * Handles both the simple form:
 *   model: cycle === 1 ? "opus" : "fable"
 * and the M86 combined form:
 *   model: cycle === 1 ? "opus" : (overrides["debug-cycle-2"] ?? "fable")
 * In the combined form, cycle2Tier is the fallback literal "fable".
 */
function extractDebugCycleTernary(source) {
  // Try combined form first: model: cond ? "a" : (overrides["key"] ?? "fallback")
  const combinedMatch = source.match(
    /\bmodel\s*:.*?\?\s*["']([^"']+)["']\s*:\s*\(\s*overrides\s*\[\s*["'][^"']+["']\s*\]\s*\?\?\s*["']([^"']+)["']\s*\)/
  );
  if (combinedMatch) return { cycle1Tier: combinedMatch[1], cycle2Tier: combinedMatch[2] };

  // Simple ternary form: model: cond ? "a" : "b"
  const match = source.match(/\bmodel\s*:.*?\?\s*["']([^"']+)["']\s*:\s*["']([^"']+)["']/);
  if (!match) return null;
  return { cycle1Tier: match[1], cycle2Tier: match[2] };
}

/**
 * Scan one window line for a model: value in all recognised forms.
 * Returns the first match found, or null.
 *
 * Returned shape (one of):
 *   { kind: "combined-ternary", ternaryIf: string, ternaryElse: string,
 *     overrideKey: string }  ← debug combined form
 *   { kind: "ternary",         ternaryIf: string, ternaryElse: string }
 *   { kind: "override",        overrideKey: string, overrideFallback: string }
 *   { kind: "bare",            modelValue: string }
 *   null
 */
function scanLineForModel(wline) {
  const codeOnly = wline.replace(/\/\/.*$/, "");
  if (!/\bmodel\s*:/.test(codeOnly)) return null;

  // Combined debug ternary: model: cond ? "a" : (overrides["key"] ?? "fallback")
  const combinedM = codeOnly.match(
    /\bmodel\s*:.*\?\s*["']([^"']+)["']\s*:\s*\(\s*overrides\s*\[\s*["']([^"']+)["']\s*\]\s*\?\?\s*["']([^"']+)["']\s*\)/
  );
  if (combinedM) {
    return { kind: "combined-ternary", ternaryIf: combinedM[1], overrideKey: combinedM[2], ternaryElse: combinedM[3] };
  }

  // Simple ternary: model: cond ? "a" : "b"
  const ternaryM = codeOnly.match(/\bmodel\s*:.*?\?\s*["']([^"']+)["']\s*:\s*["']([^"']+)["']/);
  if (ternaryM) return { kind: "ternary", ternaryIf: ternaryM[1], ternaryElse: ternaryM[2] };

  // Override form: model: overrides["key"] ?? "fallback"
  const overrideM = codeOnly.match(
    /\bmodel\s*:\s*overrides\s*\[\s*["']([^"']+)["']\s*\]\s*\?\?\s*["']([^"']+)["']/
  );
  if (overrideM) return { kind: "override", overrideKey: overrideM[1], overrideFallback: overrideM[2] };

  // Bare literal
  const simpleM = codeOnly.match(/\bmodel\s*:\s*["']([^"']+)["']/);
  if (simpleM) return { kind: "bare", modelValue: simpleM[1] };

  return null;
}

/**
 * Extract agent() calls from source and return a list of objects describing
 * the label and model form found for each call.
 *
 * Handles:
 *   agent(prompt, { label: "foo", model: "opus" })
 *   agent(prompt, { label: "red-team", model: overrides["red-team"] ?? "fable" })  (M86)
 *   agent(prompt, { label: `candidate:${ids[i]}`, model: "opus" })
 *   model: cycle === 1 ? "opus" : (overrides["debug-cycle-2"] ?? "fable")         (M86)
 *   const opts = { label: "solution-space-probe", model: "opus" }; agent(prompt, opts)
 *   (multi-line objects)
 *
 * Each returned object: { label, labelRaw, lineNum,
 *   modelValue: string|null,  ← for bare/override-fallback
 *   ternaryIf: string|null, ternaryElse: string|null,
 *   overrideKey: string|null,        ← set when model is the ?? form
 *   overrideFallback: string|null,   ← set when model is the ?? form (bare override or combined else)
 *   isOverrideForm: boolean,
 * }
 */
function extractAgentCallsWithLabels(source) {
  const lines = source.split("\n");
  const calls = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    // Look for a label: "..." or label: `...` on this line
    const codeLine = lines[i].replace(/\/\/.*$/, "");
    const labelMatch = codeLine.match(/\blabel\s*:\s*("([^"]+)"|`([^`]+)`)/);
    if (!labelMatch) continue;

    const labelRaw = labelMatch[1]; // "foo" or `bar:${...}`
    const labelValue = labelMatch[2] !== undefined ? labelMatch[2] : labelMatch[3];

    // Now find model: in this line or within the next 6 lines (object context)
    let modelValue = null;
    let ternaryIf = null;
    let ternaryElse = null;
    let overrideKey = null;
    let overrideFallback = null;
    let isOverrideForm = false;
    let found = false;

    const windowEnd = Math.min(lines.length, i + 7);
    for (let j = i; j < windowEnd; j++) {
      const hit = scanLineForModel(lines[j]);
      if (!hit) continue;
      if (hit.kind === "combined-ternary") {
        ternaryIf = hit.ternaryIf;
        ternaryElse = hit.ternaryElse;
        overrideKey = hit.overrideKey;
        overrideFallback = hit.ternaryElse;
        isOverrideForm = true;
        found = true;
        break;
      } else if (hit.kind === "ternary") {
        ternaryIf = hit.ternaryIf;
        ternaryElse = hit.ternaryElse;
        found = true;
        break;
      } else if (hit.kind === "override") {
        overrideKey = hit.overrideKey;
        overrideFallback = hit.overrideFallback;
        modelValue = hit.overrideFallback;
        isOverrideForm = true;
        found = true;
        break;
      } else if (hit.kind === "bare") {
        modelValue = hit.modelValue;
        found = true;
        break;
      }
    }

    // Also look backwards (for `const opts = { label: ..., model: ... }` where label comes first)
    if (!found) {
      const lookBack = Math.max(0, i - 6);
      for (let j = lookBack; j < i; j++) {
        const hit = scanLineForModel(lines[j]);
        if (!hit) continue;
        if (hit.kind === "combined-ternary") {
          ternaryIf = hit.ternaryIf;
          ternaryElse = hit.ternaryElse;
          overrideKey = hit.overrideKey;
          overrideFallback = hit.ternaryElse;
          isOverrideForm = true;
          break;
        } else if (hit.kind === "ternary") {
          ternaryIf = hit.ternaryIf;
          ternaryElse = hit.ternaryElse;
          break;
        } else if (hit.kind === "override") {
          overrideKey = hit.overrideKey;
          overrideFallback = hit.overrideFallback;
          modelValue = hit.overrideFallback;
          isOverrideForm = true;
          break;
        } else if (hit.kind === "bare") {
          modelValue = hit.modelValue;
          break;
        }
      }
    }

    calls.push({ label: labelValue, labelRaw, modelValue, ternaryIf, ternaryElse,
                 overrideKey, overrideFallback, isOverrideForm, lineNum });
  }

  return calls;
}

/**
 * Check a source string for tier-policy violations.
 * Returns an array of violation strings (empty = no violations).
 *
 * Checks performed:
 *   1. Every model: value is in the valid tier set (bare AND ?? fallback).
 *   2. Fail-closed: unparseable model: lines are violations.
 *   3. ?? override form: bracket key must be in INJECTABLE_STAGES
 *      (STAGE_TIERS keys minus competition-producers — M82 HELD).
 *   4. ?? fallback must equal the premium tier for that designated stage.
 *   5. Designated stage label mapping / ternary checks (unless skipDesignatedCheck).
 *   6. Judge ≠ producer blindness invariant (phase.workflow.js only).
 *
 * @param {string} source - the workflow source code
 * @param {string} filename - basename, used for error messages
 * @param {object} opts
 * @param {boolean} [opts.skipDesignatedCheck] - skip designated-stage checks (for non-workflow fixtures)
 */
function checkWorkflowSource(source, filename, opts = {}) {
  const violations = [];

  // --- 1 + 2 + 3 + 4. Scan every model: line ---
  const allLiterals = extractModelLiterals(source);
  for (const lit of allLiterals) {

    // Fail-closed: unparseable model: line
    if (lit.parseError) {
      violations.push(
        `[${filename}] model:-bearing line could not be parsed (fail-closed): "${lit.raw}" (line ${lit.line})`
      );
      continue;
    }

    // Validate tier membership (bare and ?? fallback)
    if (!VALID_TIERS.has(lit.value)) {
      violations.push(
        `[${filename}] model: "${lit.value}" (line ${lit.line}) is NOT in the valid tier set {${[...VALID_TIERS].join(", ")}}`
      );
    }

    // ?? form: validate bracket key
    if (lit.isOverrideForm && lit.overrideKey !== undefined) {
      if (!INJECTABLE_STAGES.has(lit.overrideKey)) {
        violations.push(
          `[${filename}] ?? form bracket key "${lit.overrideKey}" (line ${lit.line}) is NOT in the injectable stage set {${[...INJECTABLE_STAGES].join(", ")}} — pre-mortem r1 #2 / c2 #1 class`
        );
      } else {
        // Key is injectable: fallback must equal the premium tier for this stage
        const expectedFallback = STAGE_TIERS[lit.overrideKey]; // the policy tier (= premium tier for designated stages)
        if (lit.value !== expectedFallback) {
          violations.push(
            `[${filename}] ?? form key "${lit.overrideKey}" fallback is "${lit.value}", expected "${expectedFallback}" (line ${lit.line})`
          );
        }
      }
    }
  }

  if (opts.skipDesignatedCheck) return violations;

  // --- 2. Designated stage checks via label mapping ---
  const agentCalls = extractAgentCallsWithLabels(source);

  // Build a lookup by label value for quick access
  const callsByLabel = new Map();
  for (const call of agentCalls) {
    const key = call.label;
    if (!callsByLabel.has(key)) callsByLabel.set(key, []);
    callsByLabel.get(key).push(call);
  }

  // Check each entry in DESIGNATED_STAGE_MAP for this file
  for (const entry of DESIGNATED_STAGE_MAP) {
    if (!entry.files.includes(filename)) continue;

    // Find matching agent calls
    const matchingCalls = agentCalls.filter((c) => entry.labelPattern.test(c.labelRaw));

    if (matchingCalls.length === 0) {
      violations.push(
        `[${filename}] Designated stage "${entry.stageKey}" (label pattern ${entry.labelPattern}) matched ZERO agent() calls — mapping is broken or file has drifted`
      );
      continue;
    }

    // Special case: debug-cycle ternary (M85 and M86 combined form)
    if (entry.stageKey === "debug-cycle-2") {
      // Must be a ternary (simple or combined ??), not a flat literal
      for (const call of matchingCalls) {
        if (call.ternaryIf !== null) {
          // Assert cycle-1 → opus
          if (call.ternaryIf !== "opus") {
            violations.push(
              `[${filename}] debug-cycle ternary cycle-1 branch is "${call.ternaryIf}", expected "opus" (line ~${call.lineNum})`
            );
          }
          // Assert cycle-2 → fable (bare else value OR ?? fallback)
          const cycle2Tier = call.ternaryElse;
          if (cycle2Tier !== "fable") {
            violations.push(
              `[${filename}] debug-cycle ternary cycle-2 branch is "${cycle2Tier}", expected "fable" (line ~${call.lineNum})`
            );
          }
          // If it's the combined form (isOverrideForm), the bracket key must be debug-cycle-2
          if (call.isOverrideForm && call.overrideKey && call.overrideKey !== "debug-cycle-2") {
            violations.push(
              `[${filename}] debug-cycle combined ?? form bracket key is "${call.overrideKey}", expected "debug-cycle-2" (line ~${call.lineNum})`
            );
          }
        } else if (call.modelValue !== null && !call.isOverrideForm) {
          // Flat literal — VIOLATION (can't distinguish cycle-1 vs cycle-2)
          violations.push(
            `[${filename}] debug-cycle agent() has flat model: "${call.modelValue}" instead of a ternary — cycle-1 and cycle-2 cannot be distinguished (line ~${call.lineNum})`
          );
        } else if (!call.isOverrideForm) {
          violations.push(
            `[${filename}] debug-cycle agent() has no model: found near label (line ~${call.lineNum})`
          );
        }
      }
      continue;
    }

    // Standard designated stage: every matching call must use expectedTier.
    // For the ?? form, modelValue is the fallback literal (already set by extractAgentCallsWithLabels).
    // For the bare form, modelValue is the literal itself.
    for (const call of matchingCalls) {
      const actual = call.modelValue;
      const expected = entry.expectedTier;
      if (actual === null) {
        violations.push(
          `[${filename}] Stage "${entry.stageKey}" (label match) has no model: found near its agent() call (line ~${call.lineNum})`
        );
      } else if (actual !== expected) {
        violations.push(
          `[${filename}] Stage "${entry.stageKey}" (${entry.description}) is model: "${actual}", expected "${expected}" (line ~${call.lineNum})`
        );
      }
    }
  }

  // --- 6. Judge ≠ producer blindness invariant (only in phase.workflow.js) ---
  if (filename === "gsd-t-phase.workflow.js") {
    const judgeEntry = DESIGNATED_STAGE_MAP.find((e) => e.stageKey === "competition-judge");
    const producerEntry = DESIGNATED_STAGE_MAP.find((e) => e.stageKey === "competition-producers");

    if (judgeEntry && producerEntry) {
      const judgeCalls = agentCalls.filter((c) => judgeEntry.labelPattern.test(c.labelRaw));
      const producerCalls = agentCalls.filter((c) => producerEntry.labelPattern.test(c.labelRaw));

      if (judgeCalls.length > 0 && producerCalls.length > 0) {
        const judgeModel = judgeCalls[0].modelValue;
        const producerModel = producerCalls[0].modelValue;
        if (judgeModel && producerModel && judgeModel === producerModel) {
          violations.push(
            `[${filename}] BLINDNESS INVARIANT BROKEN: judge model ("${judgeModel}") === producer model ("${producerModel}") — judge must differ from producers (M82)`
          );
        }
      }
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// T1.1 — Policy module / contract must exist and be valid
// ---------------------------------------------------------------------------

test("policy module exists and exports MODEL_IDS and STAGE_TIERS", () => {
  assert.ok(fs.existsSync(POLICY_MODULE), `policy module not found: ${POLICY_MODULE}`);
  assert.ok(typeof MODEL_IDS === "object" && MODEL_IDS !== null, "MODEL_IDS must be an object");
  assert.ok(typeof STAGE_TIERS === "object" && STAGE_TIERS !== null, "STAGE_TIERS must be an object");
  assert.ok(VALID_TIERS.size >= 4, "MODEL_IDS must have at least 4 tiers");
  assert.ok(VALID_TIERS.has("opus"), "tier set must include opus");
  assert.ok(VALID_TIERS.has("fable"), "tier set must include fable");
  assert.ok(VALID_TIERS.has("sonnet"), "tier set must include sonnet");
  assert.ok(VALID_TIERS.has("haiku"), "tier set must include haiku");
});

test("policy contract file exists and contains STAGE_TIERS keys", () => {
  assert.ok(fs.existsSync(POLICY_CONTRACT), `policy contract not found: ${POLICY_CONTRACT}`);
  const body = fs.readFileSync(POLICY_CONTRACT, "utf8");
  assert.ok(body.includes("solution-space-probe"), "contract must document solution-space-probe");
  assert.ok(body.includes("red-team"), "contract must document red-team");
  assert.ok(body.includes("debug-cycle-2"), "contract must document debug-cycle-2");
});

test("STAGE_TIERS contains all 7 designated stage keys", () => {
  const expectedKeys = [
    "solution-space-probe",
    "partition-probe",
    "competition-judge",
    "competition-producers",
    "pre-mortem",
    "red-team",
    "debug-cycle-2",
  ];
  for (const key of expectedKeys) {
    assert.ok(key in STAGE_TIERS, `STAGE_TIERS missing key: "${key}"`);
  }
});

// ---------------------------------------------------------------------------
// T1.1b — M86: INJECTABLE_STAGES set (sourced from policy module, NOT re-hardcoded)
// Pre-mortem c2 #1: competition-producers IS in STAGE_TIERS but must NOT be injectable.
// ---------------------------------------------------------------------------

test("INJECTABLE_STAGES contains the 6 injectable designated stages (not producers)", () => {
  const expectedInjectable = [
    "solution-space-probe",
    "partition-probe",
    "competition-judge",
    "pre-mortem",
    "red-team",
    "debug-cycle-2",
  ];
  for (const key of expectedInjectable) {
    assert.ok(INJECTABLE_STAGES.has(key), `INJECTABLE_STAGES missing injectable stage: "${key}"`);
  }
  assert.ok(
    !INJECTABLE_STAGES.has("competition-producers"),
    "competition-producers must NOT be in INJECTABLE_STAGES (M82 HELD — never injectable)"
  );
  assert.equal(
    INJECTABLE_STAGES.size,
    6,
    `Expected exactly 6 injectable stages, got ${INJECTABLE_STAGES.size}: ${[...INJECTABLE_STAGES].join(", ")}`
  );
});

// ---------------------------------------------------------------------------
// T1.1c — M86: extractModelLiterals handles ?? form and combined debug ternary
// ---------------------------------------------------------------------------

describe("M86: extractModelLiterals recognises ?? forms", () => {

  test("bare literal is still extracted (M85 invariant preserved)", () => {
    const src = `const r = await agent(prompt, { label: "red-team", model: "fable" });`;
    const lits = extractModelLiterals(src);
    assert.equal(lits.length, 1, "must find 1 literal");
    assert.equal(lits[0].value, "fable");
    assert.ok(!lits[0].isOverrideForm, "bare literal is not override form");
    assert.ok(!lits[0].parseError, "bare literal is not a parse error");
  });

  test("?? form: yields overrideKey + fallback value", () => {
    const src = `const opts = { label: "red-team", model: overrides["red-team"] ?? "fable" };`;
    const lits = extractModelLiterals(src);
    assert.equal(lits.length, 1);
    assert.equal(lits[0].value, "fable");
    assert.equal(lits[0].overrideKey, "red-team");
    assert.ok(lits[0].isOverrideForm, "must be flagged as override form");
    assert.ok(!lits[0].parseError);
  });

  test("combined debug ternary: yields if-branch (opus) and else ?? fallback (fable)", () => {
    const src = `model: cycle === 1 ? "opus" : (overrides["debug-cycle-2"] ?? "fable")`;
    const lits = extractModelLiterals(src);
    assert.equal(lits.length, 2, "must yield 2 entries (if-branch + else-branch)");
    const ifBranch = lits.find((l) => l.ternaryBranch === "if");
    const elseBranch = lits.find((l) => l.ternaryBranch === "else");
    assert.ok(ifBranch, "must have if-branch entry");
    assert.ok(elseBranch, "must have else-branch entry");
    assert.equal(ifBranch.value, "opus");
    assert.equal(elseBranch.value, "fable");
    assert.equal(elseBranch.overrideKey, "debug-cycle-2");
    assert.ok(elseBranch.isOverrideForm);
  });

  test("fail-closed: unrecognized model: line yields parseError entry", () => {
    // A hypothetical future form the extractor doesn't know about
    const src = `model: someFunction("fable")`;
    const lits = extractModelLiterals(src);
    assert.equal(lits.length, 1, "must yield 1 entry (the parse error)");
    assert.ok(lits[0].parseError, "unrecognised model: line must produce parseError");
  });

  test("fail-closed: checkWorkflowSource reports violation for unparseable line", () => {
    const src = `
      const r = await agent("p", { label: "some-stage", model: someFunction("fable") });
    `;
    const violations = checkWorkflowSource(src, "gsd-t-phase.workflow.js", { skipDesignatedCheck: true });
    assert.ok(violations.length >= 1, "unparseable model: must produce a violation");
    assert.ok(
      violations.some((v) => v.includes("could not be parsed")),
      `violation must mention parse failure, got: ${violations.join("; ")}`
    );
  });
});

// ---------------------------------------------------------------------------
// T1.2 — Real-file discovery assertion (pre-mortem finding #5)
// Asserts exactly 8 *.workflow.js files found, 7 non-wave have ≥1 model:
// ---------------------------------------------------------------------------

const WF_FILES = fs.readdirSync(WF_DIR).filter((f) => f.endsWith(".workflow.js")).sort();

test("discovers exactly 8 workflow files (fail-closed discovery check)", () => {
  assert.equal(
    WF_FILES.length,
    8,
    `Expected exactly 8 *.workflow.js in ${WF_DIR}, found ${WF_FILES.length}: ${WF_FILES.join(", ")}`
  );
});

test("wave.workflow.js is present in the discovered set", () => {
  assert.ok(WF_FILES.includes("gsd-t-wave.workflow.js"), "gsd-t-wave.workflow.js must be discovered");
});

test("each non-wave workflow yields ≥1 model: occurrence (real-file read proof)", () => {
  const NON_WAVE = WF_FILES.filter((f) => f !== "gsd-t-wave.workflow.js");
  for (const f of NON_WAVE) {
    const src = fs.readFileSync(path.join(WF_DIR, f), "utf8");
    const literals = extractModelLiterals(src);
    assert.ok(
      literals.length >= 1,
      `${f} yielded 0 model: occurrences — glob matched the file but the regex is dead-on-real-source (decorative lint)`
    );
  }
});

test("wave.workflow.js has 0 model: occurrences (held invariant — wave delegates to sub-workflows)", () => {
  const src = fs.readFileSync(path.join(WF_DIR, "gsd-t-wave.workflow.js"), "utf8");
  const literals = extractModelLiterals(src);
  assert.equal(
    literals.length,
    0,
    `gsd-t-wave.workflow.js should have 0 direct model: calls (it orchestrates sub-workflows), found: ${literals.map((l) => l.raw).join("; ")}`
  );
});

// ---------------------------------------------------------------------------
// T1.3 — Every model: literal in every workflow is in the valid tier set
// ---------------------------------------------------------------------------

describe("every model: literal is a member of {opus, fable, sonnet, haiku}", () => {
  for (const f of WF_FILES) {
    test(f, () => {
      const src = fs.readFileSync(path.join(WF_DIR, f), "utf8");
      const violations = checkWorkflowSource(src, f, { skipDesignatedCheck: true });
      assert.deepEqual(
        violations,
        [],
        `${f} has model: literals outside the valid tier set:\n${violations.join("\n")}`
      );
    });
  }
});

// ---------------------------------------------------------------------------
// T1.4 — Designated stage mapping: every entry matches ≥1 real agent() call
// (pre-mortem r2 finding #3 — fail-closed: no vacuous "every member of {} is fable")
// ---------------------------------------------------------------------------

describe("designated stage label mapping matches ≥1 real agent() call per stage", () => {
  for (const entry of DESIGNATED_STAGE_MAP) {
    test(`${entry.stageKey} → ≥1 real agent() call in ${entry.files.join(", ")}`, () => {
      let totalMatches = 0;
      for (const basename of entry.files) {
        const src = fs.readFileSync(path.join(WF_DIR, basename), "utf8");
        const agentCalls = extractAgentCallsWithLabels(src);
        const matches = agentCalls.filter((c) => entry.labelPattern.test(c.labelRaw));
        totalMatches += matches.length;
      }
      assert.ok(
        totalMatches >= 1,
        `Designated stage "${entry.stageKey}" (pattern: ${entry.labelPattern}) matched ZERO agent() calls across [${entry.files.join(", ")}] — the mapping is broken or a stage was renamed (fail-closed: vacuous-true prevention per pre-mortem r2)`
      );
    });
  }
});

// ---------------------------------------------------------------------------
// T1.5 — Designated stages assert correct tier assignments
// ---------------------------------------------------------------------------

describe("designated stages have correct tier assignments", () => {
  // Non-debug stages (flat literal)
  const flatStages = DESIGNATED_STAGE_MAP.filter((e) => e.stageKey !== "debug-cycle-2");
  for (const entry of flatStages) {
    test(`${entry.stageKey} → "${entry.expectedTier}" (${entry.description})`, () => {
      for (const basename of entry.files) {
        const src = fs.readFileSync(path.join(WF_DIR, basename), "utf8");
        const violations = checkWorkflowSource(src, basename).filter((v) =>
          v.includes(entry.stageKey) || v.includes("BLINDNESS")
        );
        assert.deepEqual(
          violations,
          [],
          `Stage "${entry.stageKey}" tier check FAILED in ${basename}:\n${violations.join("\n")}`
        );
      }
    });
  }

  // debug-cycle-2: ternary check
  test("debug-cycle ternary: cycle-1 → opus, cycle-2 → fable (DISTINCT assertions)", () => {
    const src = fs.readFileSync(path.join(WF_DIR, "gsd-t-debug.workflow.js"), "utf8");
    const agentCalls = extractAgentCallsWithLabels(src);
    const entry = DESIGNATED_STAGE_MAP.find((e) => e.stageKey === "debug-cycle-2");
    const debugCalls = agentCalls.filter((c) => entry.labelPattern.test(c.labelRaw));

    assert.ok(debugCalls.length >= 1, "Must find ≥1 agent() call matching debug-cycle pattern");

    let foundTernary = false;
    for (const call of debugCalls) {
      if (call.ternaryIf !== null) {
        foundTernary = true;
        assert.equal(
          call.ternaryIf,
          "opus",
          `debug-cycle ternary cycle-1 (if-branch) must be "opus", got "${call.ternaryIf}"`
        );
        assert.equal(
          call.ternaryElse,
          "fable",
          `debug-cycle ternary cycle-2 (else-branch) must be "fable", got "${call.ternaryElse}"`
        );
        // Distinct: the two values must differ (cycle-1 ≠ cycle-2)
        assert.notEqual(
          call.ternaryIf,
          call.ternaryElse,
          "cycle-1 tier and cycle-2 tier must be DISTINCT (loose regex that can't distinguish cycles is decorative)"
        );
      } else {
        // Flat literal — fail
        assert.fail(
          `debug-cycle agent() has a flat model: "${call.modelValue}" instead of a ternary — cycle-1 and cycle-2 cannot be distinguished (pre-mortem D3-T3 wiring requirement)`
        );
      }
    }

    assert.ok(
      foundTernary,
      "No ternary found for debug-cycle — the checker's ternary extractor may be broken"
    );
  });

  // Judge ≠ producer blindness invariant
  test("competition judge tier ≠ competition producer tier (M82 blindness invariant)", () => {
    const src = fs.readFileSync(path.join(WF_DIR, "gsd-t-phase.workflow.js"), "utf8");
    const calls = extractAgentCallsWithLabels(src);
    const judgeEntry = DESIGNATED_STAGE_MAP.find((e) => e.stageKey === "competition-judge");
    const producerEntry = DESIGNATED_STAGE_MAP.find((e) => e.stageKey === "competition-producers");

    const judgeCalls = calls.filter((c) => judgeEntry.labelPattern.test(c.labelRaw));
    const producerCalls = calls.filter((c) => producerEntry.labelPattern.test(c.labelRaw));

    assert.ok(judgeCalls.length >= 1, "Must find ≥1 judge agent() call");
    assert.ok(producerCalls.length >= 1, "Must find ≥1 producer agent() call");

    const judgeModel = judgeCalls[0].modelValue;
    const producerModel = producerCalls[0].modelValue;

    assert.ok(judgeModel !== null, "Judge must have a model: value");
    assert.ok(producerModel !== null, "Producer must have a model: value");
    assert.notEqual(
      judgeModel,
      producerModel,
      `BLINDNESS INVARIANT BROKEN: judge="${judgeModel}" === producer="${producerModel}" — they must differ (M82)`
    );
  });
});

// ---------------------------------------------------------------------------
// T1.6 — Mandatory negative tests (AC a)
// A deliberately-drifted fixture MUST make checkWorkflowSource() return violations.
// These test the CHECKER FUNCTION, not the live suite.
// ---------------------------------------------------------------------------

describe("mandatory negative tests — drift fixtures must FAIL the checker", () => {

  test("fixture: red-team reverted to opus → must report violation", () => {
    // Synthesize a minimal verify-like source with red-team on opus
    const fixture = `
      const r = await agent(prompt, {
        label: "red-team", phase: "Orthogonal Triad", schema: RED_TEAM_SCHEMA, model: "opus"
      });
    `;
    const violations = checkWorkflowSource(fixture, "gsd-t-verify.workflow.js");
    assert.ok(
      violations.length >= 1,
      `Drift fixture (red-team → opus) should produce violations, got none. Checker is decorative.`
    );
    assert.ok(
      violations.some((v) => v.includes("red-team")),
      `Violation must mention "red-team", got: ${violations.join("; ")}`
    );
  });

  test("fixture: solution-space-probe on sonnet → must report violation", () => {
    const fixture = `
      const opts = { label: "solution-space-probe", schema: _PROBE_SCHEMA, model: "sonnet" };
      const r = await agent(prompt, opts);
    `;
    const violations = checkWorkflowSource(fixture, "gsd-t-phase.workflow.js");
    assert.ok(
      violations.length >= 1,
      `Drift fixture (solution-space-probe → sonnet) should produce violations, got none.`
    );
    assert.ok(
      violations.some((v) => v.includes("solution-space-probe")),
      `Violation must mention "solution-space-probe", got: ${violations.join("; ")}`
    );
  });

  test("fixture: debug ternary FLATTENED to fable (cycle-1 wrongly fable) → must report violation", () => {
    // Flat fable: both cycles on fable
    const fixture = `
      for (let cycle = 1; cycle <= 2; cycle++) {
        const r = await agent(prompt, {
          label: \`debug-cycle-\${cycle}\`,
          phase: \`Cycle \${cycle}\`,
          schema: DEBUG_CYCLE_SCHEMA,
          model: "fable",
        });
      }
    `;
    const violations = checkWorkflowSource(fixture, "gsd-t-debug.workflow.js");
    assert.ok(
      violations.length >= 1,
      `Drift fixture (debug ternary flattened → fable) should produce violations, got none.`
    );
    assert.ok(
      violations.some((v) => v.includes("debug-cycle") || v.includes("flat")),
      `Violation must mention debug-cycle or flat, got: ${violations.join("; ")}`
    );
  });

  test("fixture: debug ternary SWAPPED (cycle-1 fable, cycle-2 opus) → must report violation", () => {
    const fixture = `
      for (let cycle = 1; cycle <= 2; cycle++) {
        const r = await agent(prompt, {
          label: \`debug-cycle-\${cycle}\`,
          phase: \`Cycle \${cycle}\`,
          schema: DEBUG_CYCLE_SCHEMA,
          model: cycle === 1 ? "fable" : "opus",
        });
      }
    `;
    const violations = checkWorkflowSource(fixture, "gsd-t-debug.workflow.js");
    assert.ok(
      violations.length >= 1,
      `Drift fixture (debug ternary swapped) should produce violations, got none.`
    );
    assert.ok(
      violations.some((v) => v.includes("cycle-1") || v.includes("fable")),
      `Violation must mention cycle-1 or fable branch error, got: ${violations.join("; ")}`
    );
  });

  test("fixture: model: value outside tier set → must report violation", () => {
    const fixture = `
      const r = await agent(prompt, {
        label: "some-stage", model: "claude-opus-4-7"
      });
    `;
    // This should fail the membership check (claude-opus-4-7 is not a tier alias)
    const violations = checkWorkflowSource(fixture, "gsd-t-phase.workflow.js", { skipDesignatedCheck: true });
    assert.ok(
      violations.length >= 1,
      `model: "claude-opus-4-7" (concrete id) should produce a tier-set violation, got none.`
    );
    assert.ok(
      violations.some((v) => v.includes("claude-opus-4-7")),
      `Violation must mention the bad literal, got: ${violations.join("; ")}`
    );
  });

  test("fixture: pre-mortem on haiku → must report violation", () => {
    const fixture = `
      const r = await agent(prompt, {
        label: "pre-mortem", phase: "Plan Hardening", schema: PRE_MORTEM_SCHEMA, model: "haiku"
      });
    `;
    const violations = checkWorkflowSource(fixture, "gsd-t-phase.workflow.js");
    assert.ok(
      violations.length >= 1,
      `Drift fixture (pre-mortem → haiku) should produce violations, got none.`
    );
    assert.ok(
      violations.some((v) => v.includes("pre-mortem")),
      `Violation must mention "pre-mortem", got: ${violations.join("; ")}`
    );
  });

  test("fixture: mapping deliberately pointing at nonexistent label (meta-case per AC) → must detect zero-match", () => {
    // Build a "bad mapping" directly and verify the zero-match detection logic
    // (extension of the real DESIGNATED_STAGE_MAP logic)
    const source = `
      const r = await agent(prompt, {
        label: "actual-label", model: "fable"
      });
    `;

    // Simulate checking a stage whose label pattern matches nothing
    const badPattern = /^"nonexistent-label"$/;
    const agentCalls = extractAgentCallsWithLabels(source);
    const matches = agentCalls.filter((c) => badPattern.test(c.labelRaw));

    assert.equal(
      matches.length,
      0,
      "The bad mapping pattern should match zero calls (proving zero-match detection works)"
    );
    // If this is zero, the real lint would emit a violation — verified here
    // (we can't call the full checkWorkflowSource with a custom mapping, but the
    // pattern-match count = 0 is exactly what triggers the violation in checkWorkflowSource)
  });
});

// ---------------------------------------------------------------------------
// T1.7 — Meta-tests through the real-file code path (pre-mortem r1 finding #5)
// Copy a real workflow to a temp path, drift one literal, run the SAME checker.
// ---------------------------------------------------------------------------

describe("meta-tests: drifted copies of real workflow files fail the checker (production scan path)", () => {

  test("verify.workflow.js copy with red-team drifted to opus → checker returns violation", () => {
    const realSrc = fs.readFileSync(path.join(WF_DIR, "gsd-t-verify.workflow.js"), "utf8");

    // Drift: replace the model assignment for red-team with a drifted literal.
    // The real file (post-D2) may have model: overrides["red-team"] ?? "fable"
    // or the pre-D2 bare literal model: "fable".
    // Strategy: use a regex that handles BOTH forms and replaces with model: "opus".
    // (1) Replace ?? form: overrides["red-team"] ?? "fable" → "opus"
    // (2) Replace bare literal form near red-team label
    let driftedSrc = realSrc;

    // Replace the ?? form for red-team (M86 D2 shipped form)
    driftedSrc = driftedSrc.replace(
      /\bmodel\s*:\s*overrides\s*\[\s*"red-team"\s*\]\s*\?\?\s*"[^"]+"/,
      'model: "opus"'
    );

    // If the above didn't change anything (pre-D2 bare form), do a targeted line-level replace
    if (driftedSrc === realSrc) {
      const lines = realSrc.split("\n");
      const driftedLines = [...lines];
      let redTeamLineIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].replace(/\/\/.*$/, "").includes('"red-team"')) {
          redTeamLineIdx = i;
          break;
        }
      }
      assert.ok(redTeamLineIdx >= 0, "Must find red-team label line in verify workflow");

      // Replace model: in the vicinity (within 6 lines after label)
      for (let j = redTeamLineIdx; j < Math.min(lines.length, redTeamLineIdx + 7); j++) {
        if (driftedLines[j].match(/\bmodel\s*:/)) {
          driftedLines[j] = driftedLines[j].replace(/\bmodel\s*:.*/, 'model: "opus",');
          break;
        }
      }
      driftedSrc = driftedLines.join("\n");
    }

    const violations = checkWorkflowSource(driftedSrc, "gsd-t-verify.workflow.js");
    assert.ok(
      violations.length >= 1,
      `Real-file copy with red-team drifted to opus must produce violations. Checker is decorative on real-file path. Got: none`
    );
    assert.ok(
      violations.some((v) => v.includes("red-team")),
      `Violation must mention "red-team", got: ${violations.join("; ")}`
    );
  });
});

// ---------------------------------------------------------------------------
// T1.8 — Debug ternary meta-tests (pre-mortem r4 finding #2)
// Copy gsd-t-debug.workflow.js with: (i) flattened ternary, (ii) swapped branches.
// Both must produce violations through the real-file code path.
// ---------------------------------------------------------------------------

describe("debug ternary meta-tests: drifted debug.workflow.js copies fail the checker", () => {

  // Helper: produce a debug source where the loop has a ternary (post-D3 form)
  function makeDebugSourceWithTernary(cycle1Tier, cycle2Tier) {
    // Construct a minimal but realistic debug source with a ternary
    return `
// templates/workflows/gsd-t-debug.workflow.js
// runtime-native, debug loop
const _args = (typeof args === "string") ? (() => { try { return JSON.parse(args); } catch { return {}; } })() : (args || {});
const _CLI_ENVELOPE_SCHEMA = { type: "object", required: ["ok", "exitCode"], additionalProperties: true };
async function runCli(p, c, a, b, l) {
  const opts = { label: l, schema: _CLI_ENVELOPE_SCHEMA, model: "haiku" };
  return await agent("run " + c, opts);
}
const DEBUG_CYCLE_SCHEMA = { type: "object", required: ["resolved"] };
let lastResult = null;
for (let cycle = 1; cycle <= 2; cycle++) {
  lastResult = await agent("debug cycle " + cycle, {
    label: \`debug-cycle-\${cycle}\`,
    phase: \`Cycle \${cycle}\`,
    schema: DEBUG_CYCLE_SCHEMA,
    model: cycle === 1 ? "${cycle1Tier}" : "${cycle2Tier}",
  });
}
return { status: "done", finalResult: lastResult };
    `;
  }

  test("debug copy: ternary FLATTENED (flat model: fable) → checker reports violation", () => {
    const flatSrc = `
const DEBUG_CYCLE_SCHEMA = { type: "object" };
let lastResult = null;
for (let cycle = 1; cycle <= 2; cycle++) {
  lastResult = await agent("debug cycle " + cycle, {
    label: \`debug-cycle-\${cycle}\`,
    phase: \`Cycle \${cycle}\`,
    schema: DEBUG_CYCLE_SCHEMA,
    model: "fable",
  });
}
    `;
    const violations = checkWorkflowSource(flatSrc, "gsd-t-debug.workflow.js");
    assert.ok(violations.length >= 1,
      `Flattened debug ternary (flat fable) must produce violations. Got none.`);
    assert.ok(
      violations.some((v) => v.includes("debug-cycle") || v.includes("flat")),
      `Violation must mention debug-cycle or flat: ${violations.join("; ")}`
    );
  });

  test("debug copy: ternary SWAPPED (cycle-1→fable, cycle-2→opus) → checker reports violation", () => {
    const swappedSrc = makeDebugSourceWithTernary("fable", "opus");
    const violations = checkWorkflowSource(swappedSrc, "gsd-t-debug.workflow.js");
    assert.ok(violations.length >= 1,
      `Swapped debug ternary (cycle-1 fable, cycle-2 opus) must produce violations. Got none.`);
    assert.ok(
      violations.some((v) => v.includes("cycle-1") || v.includes("opus") || v.includes("fable")),
      `Violation must mention cycle-1/opus/fable mismatch: ${violations.join("; ")}`
    );
  });

  test("debug copy: correct ternary (cycle-1→opus, cycle-2→fable) → checker returns NO violations (positive case)", () => {
    const correctSrc = makeDebugSourceWithTernary("opus", "fable");
    const violations = checkWorkflowSource(correctSrc, "gsd-t-debug.workflow.js");
    // Filter to debug-cycle violations only (the fixture only has the debug-cycle agent call)
    const debugViolations = violations.filter((v) => v.includes("debug-cycle") || v.includes("flat") || v.includes("cycle"));
    assert.deepEqual(
      debugViolations,
      [],
      `Correct ternary should produce no debug-cycle violations: ${debugViolations.join("; ")}`
    );
  });

  test("debug ternary extractor reads BOTH operands and distinguishes cycle-1 from cycle-2", () => {
    // Direct unit test of extractDebugCycleTernary
    const withTernary = `model: cycle === 1 ? "opus" : "fable"`;
    const result = extractDebugCycleTernary(withTernary);
    assert.ok(result !== null, "Ternary extractor must return non-null for ternary source");
    assert.equal(result.cycle1Tier, "opus", "cycle1Tier must be opus");
    assert.equal(result.cycle2Tier, "fable", "cycle2Tier must be fable");

    const swapped = `model: cycle === 1 ? "fable" : "opus"`;
    const swappedResult = extractDebugCycleTernary(swapped);
    assert.ok(swappedResult !== null, "Ternary extractor must return non-null for swapped source");
    assert.equal(swappedResult.cycle1Tier, "fable");
    assert.equal(swappedResult.cycle2Tier, "opus");

    const flat = `model: "opus"`;
    const flatResult = extractDebugCycleTernary(flat);
    assert.equal(flatResult, null, "Flat literal should return null from ternary extractor");
  });
});

// ---------------------------------------------------------------------------
// T1.9 — checker function guard: verify checker itself is functional
// (meta-check: the checker is callable and returns the right shape)
// ---------------------------------------------------------------------------

test("checkWorkflowSource returns an array (always, not null/undefined)", () => {
  const r = checkWorkflowSource("", "fake.workflow.js");
  assert.ok(Array.isArray(r), "checkWorkflowSource must return an array");
});

test("checkWorkflowSource clean source returns empty array", () => {
  const cleanSrc = `
    const r = await agent("prompt", {
      label: "some-stage", phase: "Test", model: "sonnet"
    });
  `;
  const violations = checkWorkflowSource(cleanSrc, "gsd-t-execute.workflow.js", { skipDesignatedCheck: true });
  assert.deepEqual(violations, [], "Clean source with valid tier should return no violations");
});
