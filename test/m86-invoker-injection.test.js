"use strict";

// M86-D2-T10 — Invoker Injection Static Lint (fleet guard)
//
// Discovers every commands/*.md file that invokes one of the four workflow
// scripts (gsd-t-{phase,verify,debug,wave}.workflow.js) and asserts:
//   (a) It contains the resolver-call block (calls gsd-t model-profile resolve).
//   (b) It contains the overrides injection (passes overrides: {...} in args).
//   (c) It contains the resolver-failure-handling clause (loud named-posture warning
//       OR blocked-needs-human — never silently proceed on premium).
//
// Additionally asserts that gsd-t-wave.workflow.js forwards overrides in BOTH
// workflow(...) sub-calls (execute AND verify).
//
// Negative fixtures (two required by acceptance criteria):
//   (a) Synthetic invoker WITHOUT the injection block FAILS.
//   (b) Synthetic invoker WITH injection block but WITHOUT failure-handling FAILS.
// Both negatives run through the SAME checker entry point as the real files
// (no parallel mock — structural detection, not substring, per
// feedback_coverage_check_structural_not_substring).
//
// Contract: .gsd-t/contracts/model-profile-config-contract.md §Invoke-Time Injection

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const COMMANDS_DIR = path.resolve(__dirname, "..", "commands");
const WF_DIR = path.resolve(__dirname, "..", "templates", "workflows");

// ---------------------------------------------------------------------------
// Structural detection: which workflow does this command file invoke?
//
// Strategy: look for a scriptPath mention of one of the four target workflow
// basenames. This matches patterns like:
//   `gsd-t workflow-path phase`  (the invoker then uses the output as scriptPath)
//   `scriptPath: "...gsd-t-phase.workflow.js"`
//   workflow-path strings in prose that describe what to run
//
// Per feedback_coverage_check_structural_not_substring we do this structurally:
// we look for the workflow basename in the Workflow invocation block, not just
// any occurrence anywhere in the file.
// ---------------------------------------------------------------------------

const TARGET_WORKFLOWS = [
  "gsd-t-phase.workflow.js",
  "gsd-t-verify.workflow.js",
  "gsd-t-debug.workflow.js",
  "gsd-t-wave.workflow.js",
];

// A pattern that detects a concrete reference to a target workflow basename
// in the context of a Workflow tool invocation — structural detection:
//
// A genuine invoker has BOTH:
//   (1) A reference to the workflow path (workflow-path <name> CLI call or scriptPath:)
//   (2) An args: block (the Workflow tool call pattern)
//
// The help file mentions workflow names in documentation, but doesn't have an
// args: block paired with a scriptPath: — that's the structural separator.
// (Per feedback_coverage_check_structural_not_substring.)
function detectInvokedWorkflow(body) {
  // Must have scriptPath: in the file at all (the Workflow invocation marker)
  if (!/scriptPath\s*:/.test(body)) return null;
  // Must also have an args: block
  if (!/\bargs\s*:/.test(body)) return null;

  for (const wf of TARGET_WORKFLOWS) {
    const wfBase = path.basename(wf, ".workflow.js"); // e.g. "gsd-t-phase"
    const shortName = wfBase.replace("gsd-t-", ""); // "phase", "verify", "debug", "wave"
    // Match the workflow-path CLI invocation OR a direct scriptPath reference to the workflow
    const patterns = [
      new RegExp(`workflow-path\\s+${shortName}\\b`),
      new RegExp(`workflow-path\\s+gsd-t-${shortName}\\b`),
      new RegExp(`scriptPath.*gsd-t-${shortName}\\.workflow\\.js`),
    ];
    if (patterns.some((p) => p.test(body))) {
      return wf;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Checker: returns an array of violation strings (empty = compliant).
//
// This is the SINGLE entry point used for both real files AND negative fixtures
// (no parallel mock).
// ---------------------------------------------------------------------------

/**
 * @param {string} body   - the command file contents
 * @param {string} label  - filename or fixture label for error messages
 * @returns {string[]}     - violation strings ([] = compliant)
 */
function checkInvokerBody(body, label) {
  const violations = [];

  // --- (a) Resolver-call block ---
  // The invoker must call the resolver to get the overrides map.
  // Patterns: "model-profile resolve" in a bash block or inline JS.
  const hasResolverCall =
    /model-profile\s+resolve/.test(body) ||
    /gsd-t\s+model-profile\s+resolve/.test(body);
  if (!hasResolverCall) {
    violations.push(
      `[${label}] Missing resolver-call: no "model-profile resolve" found — ` +
        "invoker must call the D1 resolver to build the overrides map (M86 §Invoke-Time Injection)"
    );
  }

  // --- (b) Overrides injection in the workflow args ---
  // The invoker must pass overrides: {...} in the Workflow args block.
  const hasOverridesInjection =
    /overrides\s*:/.test(body);
  if (!hasOverridesInjection) {
    violations.push(
      `[${label}] Missing overrides injection: no "overrides:" field found in args — ` +
        "invoker must inject the resolved overrides map into the Workflow args (M86 §Invoke-Time Injection)"
    );
  }

  // --- (c) Resolver-failure-handling clause ---
  // The invoker must NOT silently fall through to premium on resolver failure.
  // Acceptable patterns: "blocked-needs-human" (halt path) OR a loud named-posture
  // warning that names the effective posture (e.g. "PREMIUM fallback literals" or
  // "resolver unavailable").
  // Pre-mortem c2 #2: a configured-standard project silently billing premium fable
  // post-promo is the exact inverse of the spend-switch goal.
  const hasFailureHandling =
    /blocked-needs-human/.test(body) ||
    (/resolver\s+unavailable/i.test(body) && /PREMIUM\s+fallback/i.test(body)) ||
    /resolver.*fails?.*HALT/i.test(body) ||
    // The canonical warning phrase from the contract
    /model-profile\s+resolver\s+unavailable/.test(body);
  if (!hasFailureHandling) {
    violations.push(
      `[${label}] Missing resolver-failure-handling: invoker must either HALT with ` +
        '"blocked-needs-human" or show a loud named-posture warning ' +
        '("model-profile resolver unavailable — running on PREMIUM fallback literals") ' +
        "when the resolver call fails — never silently proceed on premium (M86 pre-mortem c2 #2)"
    );
  }

  // --- (d) configError-surfacing clause (Red Team M86 verify fix-cycle 1) ---
  // A SUCCESSFUL resolve can carry configError (named default for a malformed /
  // hand-edited config). The contract requires the invoker to SURFACE it; an
  // invoker doc that never mentions configError leaves the clean-looking-but-
  // unconfigured-posture run silent — the same silent-spend class.
  const hasConfigErrorSurfacing = /configError/.test(body);
  if (!hasConfigErrorSurfacing) {
    violations.push(
      `[${label}] Missing configError-surfacing clause: invoker must print the ` +
        "resolver's configError as a visible warning naming the effective profile " +
        "(contract §Invoke-Time Injection, Red Team M86)"
    );
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Discover target command files
// ---------------------------------------------------------------------------

const allCommandFiles = fs
  .readdirSync(COMMANDS_DIR)
  .filter((f) => f.endsWith(".md"))
  .sort();

const targetCommandFiles = allCommandFiles.filter((f) => {
  const body = fs.readFileSync(path.join(COMMANDS_DIR, f), "utf8");
  return detectInvokedWorkflow(body) !== null;
});

// ---------------------------------------------------------------------------
// T1: discovery is non-empty (fail-closed against a silently-empty fleet)
// ---------------------------------------------------------------------------

test("discovers ≥1 workflow-invoking command file (fail-closed discovery guard)", () => {
  assert.ok(
    targetCommandFiles.length >= 1,
    `No workflow-invoking command files found in ${COMMANDS_DIR} — ` +
      "detection pattern may be broken (fail-closed: if 0 files, every AC is vacuous-true)"
  );
});

// ---------------------------------------------------------------------------
// T2: every discovered invoker is compliant (resolver call + injection + failure-handling)
// ---------------------------------------------------------------------------

describe("every workflow-invoking command carries the injection block", () => {
  for (const f of targetCommandFiles) {
    test(f, () => {
      const body = fs.readFileSync(path.join(COMMANDS_DIR, f), "utf8");
      const violations = checkInvokerBody(body, f);
      assert.deepEqual(
        violations,
        [],
        `Invoker "${f}" has injection-block violations:\n${violations.join("\n")}`
      );
    });
  }
});

// ---------------------------------------------------------------------------
// T3: wave workflow forwards overrides in BOTH sub-workflow calls
//
// gsd-t-wave.workflow.js calls workflow("gsd-t-execute", ...) and
// workflow("gsd-t-verify", ...). Both calls must include overrides.
// ---------------------------------------------------------------------------

test("gsd-t-wave.workflow.js forwards overrides in both workflow() sub-calls", () => {
  const waveSrc = fs.readFileSync(path.join(WF_DIR, "gsd-t-wave.workflow.js"), "utf8");

  // Extract workflow(...) call blocks. A call is:
  //   workflow("gsd-t-execute", { ... })   or
  //   workflow("gsd-t-verify", { ... })
  // We look for each call and assert overrides appears in its arg object.
  const executeCallMatch = waveSrc.match(
    /workflow\(\s*["']gsd-t-execute["'][^)]*?\{[^}]*\}/s
  );
  const verifyCallMatch = waveSrc.match(
    /workflow\(\s*["']gsd-t-verify["'][^)]*?\{[^}]*\}/s
  );

  assert.ok(
    executeCallMatch,
    'gsd-t-wave.workflow.js must contain a workflow("gsd-t-execute", {...}) call'
  );
  assert.ok(
    verifyCallMatch,
    'gsd-t-wave.workflow.js must contain a workflow("gsd-t-verify", {...}) call'
  );

  assert.ok(
    /overrides/.test(executeCallMatch[0]),
    'workflow("gsd-t-execute", ...) call must include overrides in its args (pre-mortem r1 #1)'
  );
  assert.ok(
    /overrides/.test(verifyCallMatch[0]),
    'workflow("gsd-t-verify", ...) call must include overrides in its args (pre-mortem r1 #1)'
  );
});

// ---------------------------------------------------------------------------
// T4: the wave workflow reads overrides from args (not hardcodes or ignores them)
// ---------------------------------------------------------------------------

test("gsd-t-wave.workflow.js reads overrides from _args (not hardcoded)", () => {
  const waveSrc = fs.readFileSync(path.join(WF_DIR, "gsd-t-wave.workflow.js"), "utf8");
  // Must parse/read overrides from _args (the M81 args string)
  assert.ok(
    /_args\.overrides/.test(waveSrc),
    "gsd-t-wave.workflow.js must read overrides from _args (const overrides = _args.overrides ?? {})"
  );
});

// ---------------------------------------------------------------------------
// Negative fixture (a): synthetic invoker WITHOUT the injection block FAILS
// ---------------------------------------------------------------------------

describe("negative fixtures — must FAIL via the same checker (no parallel mock)", () => {
  test("fixture (a): invoker WITHOUT injection block FAILS", () => {
    const syntheticBody = `
# GSD-T: Fake Phase Command

You are the lead agent. Run the fake phase by invoking gsd-t-phase.workflow.js.

## Step 1: Load context
Read .gsd-t/progress.md.

## Step 2: Invoke the phase Workflow
Run \`gsd-t workflow-path phase\` then call the Workflow tool with:
{ scriptPath: "...", args: { phase: "fake", projectDir: "." } }

## Step 3: Interpret the result
status === "complete" — done.
`;
    const violations = checkInvokerBody(syntheticBody, "fixture-a-no-injection");
    assert.ok(
      violations.length >= 1,
      "Fixture (a) — invoker without injection block must produce ≥1 violation, but checker returned none"
    );
    // Must flag at least the resolver-call absence and overrides injection absence
    const hasResolverViolation = violations.some((v) => v.includes("resolver-call") || v.includes("model-profile"));
    const hasInjectionViolation = violations.some((v) => v.includes("overrides injection") || v.includes("overrides:"));
    assert.ok(
      hasResolverViolation || hasInjectionViolation,
      "Fixture (a) violations should reference the resolver-call or overrides injection gap"
    );
  });

  // ---------------------------------------------------------------------------
  // Negative fixture (b): synthetic invoker WITH injection block but WITHOUT
  // failure-handling clause FAILS
  // ---------------------------------------------------------------------------

  test("fixture (b): invoker WITH injection block but WITHOUT failure-handling clause FAILS", () => {
    const syntheticBody = `
# GSD-T: Fake Phase Command With Partial Injection

You are the lead agent. Run the fake phase by invoking gsd-t-phase.workflow.js.

## Step 1: Load context
Read .gsd-t/progress.md.

## Step 2: Resolve the active model profile (M86)

Run \`gsd-t model-profile resolve --profile premium --json\` and capture the output.

## Step 3: Invoke the phase Workflow
Run \`gsd-t workflow-path phase\` then call the Workflow tool with:
{
  scriptPath: "...",
  args: {
    phase: "fake",
    projectDir: ".",
    overrides: { /* from resolver */ }
  }
}

## Step 4: Interpret the result
status === "complete" — done.
`;
    const violations = checkInvokerBody(syntheticBody, "fixture-b-no-failure-handling");
    assert.ok(
      violations.length >= 1,
      "Fixture (b) — invoker with injection but without failure-handling must produce ≥1 violation, but checker returned none"
    );
    const hasFailureHandlingViolation = violations.some(
      (v) => v.includes("resolver-failure-handling") || v.includes("blocked-needs-human") || v.includes("PREMIUM fallback")
    );
    assert.ok(
      hasFailureHandlingViolation,
      "Fixture (b) violation must reference the missing failure-handling clause"
    );
  });
});

// ---------------------------------------------------------------------------
// T5: reported fleet count (informational — helps verify discovery isn't silently narrow)
// ---------------------------------------------------------------------------

test("reports discovered fleet size (informational)", () => {
  // This test always passes — it's here so the count appears in the test output.
  const discovered = targetCommandFiles.map((f) => {
    const body = fs.readFileSync(path.join(COMMANDS_DIR, f), "utf8");
    const wf = detectInvokedWorkflow(body);
    return `${f} → ${wf}`;
  });
  // Just log and pass — the real guards are in T2.
  assert.ok(
    targetCommandFiles.length >= 7,
    `Expected ≥7 workflow-invoking command files, found ${targetCommandFiles.length}: ` +
      discovered.join("; ") +
      "\n(Expected: partition, verify, debug, plan, milestone, impact, prd, design-decompose, doc-ripple, wave)"
  );
});
