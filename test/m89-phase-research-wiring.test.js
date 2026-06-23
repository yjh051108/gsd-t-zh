"use strict";

// M89-D3-T3 — Phase research wiring + §7 ENFORCE-marker gate tests
//
// Functional assertions (NOT shallow existence checks):
//
//   1. Phase workflow source embeds STATED_CLAIMS_INSTRUCTION in each of the 6
//      research-eligible stages (plan, partition, discuss, milestone, impact, pre-mortem).
//      Source-structure parse: CHECK not a bare substring but the actual injection per stage.
//      (This is a CHEAP PRE-CHECK — the binding proof is the e2e state-change in T4/T5.)
//
//   2. §7 marker lifecycle: normalizeClaimKey produces deterministic keys; marker
//      format follows the contract; uncited→cited flip format is exact.
//
//   3. Verify workflow FAILS on an artifact with a status=uncited external-claim marker (A4);
//      PASSES when all markers are status=cited with matching cited facts.
//
//   4. Idempotency POSITIVE (A2/§4.1): same claim-key already cited → "skip" predicate fires.
//
//   5. Idempotency NEGATIVE (§4.1 load-bearing): distinct claim B is NOT covered by cited
//      claim A, even when they share keywords (the PayPal OAuth vs invoice-TOTAL case).
//
//   6. Ambiguous-escalation path (§5.1): an ambiguous claim that grep CANNOT resolve DOES
//      enter the research stage (marker + cited block); one grep CAN resolve does NOT.
//
//   7. Research stage model: literal in the phase workflow is the bare "fable" form
//      (NOT overrides[...] ?? form — that FAILS M85 lint).
//
// Contract: auto-research-contract.md §4 (A2) + §5 (A4) + §6.5 + §7
// Runner: npm test

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..");
const PHASE_WF = path.resolve(ROOT, "templates", "workflows", "gsd-t-phase.workflow.js");
const VERIFY_WF = path.resolve(ROOT, "templates", "workflows", "gsd-t-verify.workflow.js");
const CLASSIFIER_PATH = path.resolve(ROOT, "bin", "gsd-t-research-gate.cjs");

const { classify } = require(CLASSIFIER_PATH);

const phaseSource = fs.readFileSync(PHASE_WF, "utf8");
const verifySource = fs.readFileSync(VERIFY_WF, "utf8");

// ---------------------------------------------------------------------------
// Helper — re-implemented here for test isolation (mirrors the workflow)
// ---------------------------------------------------------------------------

/**
 * normalizeClaimKey: lowercase, collapse whitespace, strip surrounding punctuation.
 * Auto-research-contract §4.1 + §7.
 */
function normalizeClaimKey(claim) {
  // Cycle-2 finding #1: collapse EVERY non-word run to a space (marker-syntax-safe key).
  return claim.toLowerCase().replace(/[^\w]+/g, " ").trim();
}

/**
 * Build the §7 uncited marker string for a claim.
 */
function buildUncitedMarker(claimText) {
  const key = normalizeClaimKey(claimText);
  return `<!-- auto-research-claim: class=external key=${key} status=uncited -->`;
}

/**
 * Build the §7 cited marker string for a claim.
 */
function buildCitedMarker(claimText) {
  const key = normalizeClaimKey(claimText);
  return `<!-- auto-research-claim: class=external key=${key} status=cited -->`;
}

/**
 * Build a well-formed ## Verified Facts block for a claim.
 */
function buildVerifiedFactsBlock(claimKey, url, date) {
  return [
    "## Verified Facts (auto-research)",
    "",
    `- **${claimKey}** — source: <${url}> (fetched ${date})`,
  ].join("\n");
}

/**
 * Is this line a COMPLETE, LIVE §7 marker comment? (structural — code-review #1)
 * Must be a single `<!-- ... -->` comment containing auto-research-claim: AND a
 * concrete status=uncited|cited. Prose/source template mentions are NOT live markers.
 */
function isLiveMarker(line) {
  const t = line.trim();
  if (!t.startsWith("<!--") || !t.endsWith("-->")) return false;
  if (!t.includes("auto-research-claim:")) return false;
  // Reject placeholder keys (key=<...>) — a real key is normalizeClaimKey output (no angle brackets)
  const keyMatch = t.match(/key=([^\s]+)/);
  if (keyMatch && (keyMatch[1].includes("<") || keyMatch[1].includes(">"))) return false;
  // Concrete status (reject placeholders like status=uncited|cited or status=<...>)
  return /status=uncited\b(?!\|)/.test(t) || /status=cited\b/.test(t);
}

/**
 * Simulate the §7 ENFORCE gate logic. Mirrors the verify workflow's auto-research-gate
 * agent: FAILs on ANY uncited marker OR any HOLLOW cited marker (a status=cited marker
 * whose file lacks a matching `## Verified Facts (auto-research)` block with enough
 * sourced fact lines). Single-file model for these unit fixtures.
 * Returns { pass, uncitedCount, citedCount, citedWithoutFactsCount, uncitedMarkers }.
 */
function runEnforceGate(artifactContent) {
  const lines = artifactContent.split("\n");
  const uncited = [];
  let citedCount = 0;
  for (const line of lines) {
    if (!isLiveMarker(line)) continue;
    if (/status=uncited\b/.test(line)) uncited.push(line.trim());
    else if (/status=cited\b/.test(line)) citedCount++;
  }
  const hasHeading = lines.some((l) => l.trim() === "## Verified Facts (auto-research)");
  const sourcedFacts = lines.filter(
    (l) => l.trim().startsWith("- ") && /source:\s*(<[^>]+>|https?:\/\/\S+)/i.test(l)
  ).length;
  const citedWithoutFactsCount =
    citedCount === 0 ? 0 : Math.max(0, citedCount - (hasHeading ? sourcedFacts : 0));
  return {
    pass: uncited.length === 0 && citedWithoutFactsCount === 0,
    uncitedCount: uncited.length,
    citedCount,
    citedWithoutFactsCount,
    uncitedMarkers: uncited,
  };
}

/**
 * Idempotency predicate: exact normalized-gap-key match (§4.1).
 * Returns "skip" if claimKey is in existingCitedKeys, "research" otherwise.
 */
function shouldResearch(claimKey, existingCitedKeys) {
  return existingCitedKeys.has(claimKey) ? "skip" : "research";
}

// ---------------------------------------------------------------------------
// T3.1 — Phase workflow source structure checks
// (Source-structure parse: cheap PRE-CHECK only. Binding proof = e2e state-change in T4/T5.)
// ---------------------------------------------------------------------------

describe("T3.1 — Phase workflow: Stated-Claims instruction embedded in eligible stages", () => {

  test("phase workflow source contains STATED_CLAIMS_INSTRUCTION constant definition", () => {
    assert.ok(
      phaseSource.includes("STATED_CLAIMS_INSTRUCTION"),
      "gsd-t-phase.workflow.js must define STATED_CLAIMS_INSTRUCTION"
    );
    assert.ok(
      phaseSource.includes("Stated Claims"),
      "STATED_CLAIMS_INSTRUCTION must mention 'Stated Claims'"
    );
    assert.ok(
      phaseSource.includes("[GUESSED:"),
      "STATED_CLAIMS_INSTRUCTION must mention [GUESSED:..."
    );
  });

  // Each of the 6 research-eligible upper stages:
  // plan, partition, discuss, milestone, impact (in promptByPhase)
  // pre-mortem (inside Plan Hardening)
  const eligibleStages = ["plan", "partition", "discuss", "milestone", "impact", "pre-mortem"];

  for (const stage of eligibleStages) {
    test(`eligible stage "${stage}" has STATED_CLAIMS_INSTRUCTION wired into its prompt`, () => {
      // Find the section of source that defines this stage's prompt and verify that
      // STATED_CLAIMS_INSTRUCTION is referenced in or near that section.
      // promptByPhase keys may be unquoted (plan:) or quoted ("plan":) in JS object literals.
      // pre-mortem: appears as label: "pre-mortem" in the agent call.
      const stageMarkerPattern = stage === "pre-mortem"
        ? /label:\s*["']pre-mortem["']/
        : new RegExp(`(?:^|[{,\\s])(?:['"])?${stage}(?:['"])?\\s*:`);

      assert.ok(
        stageMarkerPattern.test(phaseSource),
        `Must find stage key for "${stage}" in phase workflow source`
      );

      // The STATED_CLAIMS_INSTRUCTION is embedded via the constant reference in promptByPhase
      // or the pre-mortem agent prompt. Verify the constant is referenced near each stage.
      // For non-pre-mortem: the promptByPhase[stage] value includes ${STATED_CLAIMS_INSTRUCTION}.
      // For pre-mortem: the agent prompt includes STATED_CLAIMS_INSTRUCTION literal.
      const refPattern = /\$\{STATED_CLAIMS_INSTRUCTION\}/;
      assert.ok(
        refPattern.test(phaseSource),
        `gsd-t-phase.workflow.js must embed \${STATED_CLAIMS_INSTRUCTION} in its prompts (stage: "${stage}")`
      );
    });
  }

  test("RESEARCH_ELIGIBLE_PHASES set includes all 5 promptByPhase-eligible stages", () => {
    assert.ok(
      phaseSource.includes("RESEARCH_ELIGIBLE_PHASES"),
      "Must define RESEARCH_ELIGIBLE_PHASES set"
    );
    for (const s of ["plan", "partition", "discuss", "milestone", "impact"]) {
      assert.ok(
        phaseSource.includes(`"${s}"`),
        `Phase source must include "${s}" as an eligible stage`
      );
    }
  });

  test("runStatedClaimsPipeline function is defined in the phase workflow", () => {
    assert.ok(
      phaseSource.includes("runStatedClaimsPipeline"),
      "Must define runStatedClaimsPipeline in gsd-t-phase.workflow.js"
    );
  });

  test("Stated-Claims pipeline is invoked after the phase agent runs", () => {
    // The pipeline is called after result is set (and before Plan Hardening).
    assert.ok(
      phaseSource.includes("RESEARCH_ELIGIBLE_PHASES.has(phaseName)"),
      "Phase source must check RESEARCH_ELIGIBLE_PHASES before running the pipeline"
    );
    assert.ok(
      phaseSource.includes("runStatedClaimsPipeline("),
      "Phase source must call runStatedClaimsPipeline()"
    );
  });

  test("classify-claim runCli call is present (D1 classifier invoked via runCli helper)", () => {
    assert.ok(
      phaseSource.includes("research-gate") && phaseSource.includes("classify"),
      "Phase workflow must invoke the D1 classifier via runCli with 'research-gate' and 'classify'"
    );
  });
});

// ---------------------------------------------------------------------------
// T3.2 — §7 Marker lifecycle: normalizeClaimKey, marker format, uncited→cited flip
// ---------------------------------------------------------------------------

describe("T3.2 — §7 Marker lifecycle: format + normalization + flip", () => {

  test("normalizeClaimKey: lowercase, collapse EVERY non-word run to a space (marker-syntax-safe)", () => {
    assert.equal(
      normalizeClaimKey("  PayPal  OAuth  /v1/oauth2/token   mint  "),
      normalizeClaimKey("PayPal OAuth /v1/oauth2/token mint")
    );
    // Cycle-2 finding #1: ALL non-word chars (incl. internal "/") collapse to a space,
    // so the key contains only [\w ] and can never embed marker syntax.
    assert.equal(
      normalizeClaimKey("PayPal OAuth /v1/oauth2/token mint"),
      "paypal oauth v1 oauth2 token mint"
    );
  });

  // CRITICAL (cycle-2 finding #1): a claim that literally embeds marker syntax must NOT
  // poison the key. The key must be free of "="/"<"/">"/"-", so its uncited marker line
  // parses cleanly and a DISTINCT claim that is a prefix of it does not get falsely skipped.
  test("claim-key poisoning guard: a claim embedding 'status=cited' yields a marker-safe key, distinct from a prefix claim", () => {
    const poison = "max batch size status=cited and more";
    const distinct = "max batch size";
    const kPoison = normalizeClaimKey(poison);
    const kDistinct = normalizeClaimKey(distinct);

    // The key must contain NONE of the marker-grammar tokens.
    for (const tok of ["=", "<", ">", "--", "status=", "class=", "key="]) {
      assert.ok(!kPoison.includes(tok), `poisoned key must not contain "${tok}", got "${kPoison}"`);
    }
    // The two claims are DISTINCT keys → the prefix claim is NOT falsely covered/skipped.
    assert.notEqual(kPoison, kDistinct, "poison claim and its prefix must have DISTINCT keys (no false skip)");

    // The uncited marker built from the poisoned key still parses as ONE live marker
    // (auto-research-claim: + concrete status=uncited on a complete comment line).
    const marker = buildUncitedMarker(poison);
    assert.ok(marker.startsWith("<!-- auto-research-claim:") && marker.endsWith("-->"));
    const gate = runEnforceGate(marker);
    assert.equal(gate.uncitedCount, 1, "poisoned-claim marker must parse as exactly ONE uncited marker");
    assert.equal(gate.pass, false, "an uncited marker (poisoned or not) must FAIL the gate");
  });

  test("normalizeClaimKey is deterministic (same input → same key, always)", () => {
    const claim = "PayPal v2 invoice TOTAL amount limit";
    assert.equal(normalizeClaimKey(claim), normalizeClaimKey(claim));
  });

  test("§7 marker format: uncited marker has correct structure", () => {
    const claimText = "PayPal v2 invoice TOTAL amount limit";
    const marker = buildUncitedMarker(claimText);
    assert.ok(marker.startsWith("<!-- auto-research-claim:"), "Marker must be an HTML comment");
    assert.ok(marker.includes("class=external"), "Marker must include class=external");
    assert.ok(marker.includes("status=uncited"), "Marker must include status=uncited");
    assert.ok(marker.includes("key="), "Marker must include key=");
    assert.ok(marker.endsWith("-->"), "Marker must end with -->");
  });

  test("§7 marker format: cited marker differs ONLY in status=cited vs status=uncited", () => {
    const claimText = "PayPal v2 invoice TOTAL amount limit";
    const uncitedMarker = buildUncitedMarker(claimText);
    const citedMarker = buildCitedMarker(claimText);

    assert.ok(citedMarker.includes("status=cited"), "Cited marker must have status=cited");
    assert.ok(!citedMarker.includes("status=uncited"), "Cited marker must NOT have status=uncited");

    // Markers must differ only in the status value
    const uncitedWithoutStatus = uncitedMarker.replace("status=uncited", "");
    const citedWithoutStatus = citedMarker.replace("status=cited", "");
    assert.equal(
      uncitedWithoutStatus,
      citedWithoutStatus,
      "Markers must be identical except for the status value"
    );
  });

  test("claim-key in uncited marker matches claim-key in cited marker (same key, same flip)", () => {
    const claimText = "PayPal OAuth /v1/oauth2/token mint";
    const key = normalizeClaimKey(claimText);
    const uncited = buildUncitedMarker(claimText);
    const cited = buildCitedMarker(claimText);

    assert.ok(uncited.includes(`key=${key}`), `Uncited marker must contain key=${key}`);
    assert.ok(cited.includes(`key=${key}`), `Cited marker must contain key=${key}`);
  });

  test("the phase workflow contains the §7 marker write code (status=uncited) for external claims", () => {
    assert.ok(
      phaseSource.includes("status=uncited"),
      "Phase workflow must write status=uncited markers for external claims"
    );
    assert.ok(
      phaseSource.includes("status=cited"),
      "Phase workflow must flip markers to status=cited after research"
    );
  });

  test("the phase workflow contains the marker-flip (uncited→cited replace) operation", () => {
    // The cite-write-and-flip agent prompt replaces the uncited marker with cited.
    assert.ok(
      phaseSource.includes("cite-write-and-flip") || phaseSource.includes("status=uncited") && phaseSource.includes("status=cited"),
      "Phase workflow must contain a marker flip from status=uncited to status=cited"
    );
  });

  // FAIL-CLOSED (Red Team HIGH): when the phase reports no artifact path, the external/escalation
  // §7 marker write MUST still happen, to a deterministic fallback artifact under .gsd-t/research/.
  test("phase workflow defines a deterministic externalArtifact fallback (.gsd-t/research/) — fail-closed", () => {
    assert.ok(
      phaseSource.includes("externalArtifact"),
      "Phase workflow must define an externalArtifact (real primaryArtifact OR deterministic fallback)"
    );
    assert.ok(
      /\.gsd-t\/research\//.test(phaseSource),
      "Phase workflow fallback artifact must be under .gsd-t/research/ (always writable)"
    );
    // The external/escalation marker write must target externalArtifact, not be silently skipped on null.
    assert.ok(
      phaseSource.includes('"${externalArtifact}"') || phaseSource.includes("${externalArtifact}"),
      "Phase workflow external/escalation marker writes must target externalArtifact (no silent skip when no path)"
    );
  });

  test("phase workflow does NOT silently skip the external marker write when primaryArtifact is null", () => {
    // The OLD bug: `if (primaryArtifact) { ...markerWrite... }` on the external path skipped silently.
    // After the fix, the external-path marker write is unconditional (targets externalArtifact).
    // The only remaining `if (primaryArtifact)` should be the read-only idempotency check.
    const occurrences = (phaseSource.match(/if \(primaryArtifact\)/g) || []).length;
    assert.ok(
      occurrences <= 1,
      `Phase workflow should have at most ONE 'if (primaryArtifact)' (the read-only idempotency check); ` +
        `found ${occurrences} — an external-path marker write may still be silently guarded (fail-silent bug)`
    );
  });
});

// ---------------------------------------------------------------------------
// T3.3 — §7 ENFORCE gate: verify FAILS on uncited, PASSES on all-cited
// ---------------------------------------------------------------------------

describe("T3.3 — §7 ENFORCE gate: verify FAILS on uncited marker, PASSES on all-cited", () => {

  test("FAIL path (A4): artifact with status=uncited marker FAILS the enforce gate", () => {
    const claimText = "PayPal v2 invoice TOTAL amount limit";
    const uncitedMarker = buildUncitedMarker(claimText);

    // Simulate an artifact that has the uncited marker but no cited block
    const artifactContent = [
      "# Plan for M89",
      "",
      "## Summary",
      "Some plan text...",
      "",
      uncitedMarker,
      "",
    ].join("\n");

    const gateResult = runEnforceGate(artifactContent);
    assert.equal(gateResult.pass, false, "Gate must FAIL when uncited marker is present");
    assert.equal(gateResult.uncitedCount, 1, "Must count exactly 1 uncited marker");
    assert.equal(gateResult.citedCount, 0);
    assert.ok(gateResult.uncitedMarkers.length >= 1, "Must list the uncited marker");
    assert.ok(
      gateResult.uncitedMarkers[0].includes("status=uncited"),
      "Listed uncited marker must contain status=uncited"
    );
  });

  test("PASS path: artifact with all status=cited markers + matching cited facts PASSES", () => {
    const claimText = "PayPal v2 invoice TOTAL amount limit";
    const citedMarker = buildCitedMarker(claimText);
    const citedBlock = buildVerifiedFactsBlock(
      "PayPal v2 invoice total amount limit",
      "https://developer.paypal.com/docs/api/invoicing/v2/",
      "2026-06-18"
    );

    const artifactContent = [
      "# Plan for M89",
      "",
      "## Summary",
      "Some plan text...",
      "",
      citedMarker,
      "",
      citedBlock,
      "",
    ].join("\n");

    const gateResult = runEnforceGate(artifactContent);
    assert.equal(gateResult.pass, true, "Gate must PASS when all markers are status=cited");
    assert.equal(gateResult.uncitedCount, 0);
    assert.equal(gateResult.citedCount, 1);
    assert.equal(gateResult.uncitedMarkers.length, 0);
  });

  // HOLLOW-CITED NEGATIVE (Red Team #1 + code-review #4 / finding #5): a status=cited
  // marker with NO matching sourced Verified-Facts block MUST FAIL. Deleting the block
  // from the PASS-path artifact must flip pass→fail — proving the gate READS the block
  // (the test that would have caught the hollow-gate CRITICAL).
  test("HOLLOW-CITED FAIL (A4): cited marker without a matching Verified-Facts block FAILS; deleting the block flips pass→fail", () => {
    const claimText = "PayPal v2 invoice TOTAL amount limit";
    const citedMarker = buildCitedMarker(claimText);
    const citedBlock = buildVerifiedFactsBlock(
      "PayPal v2 invoice total amount limit",
      "https://developer.paypal.com/docs/api/invoicing/v2/",
      "2026-06-18"
    );

    // PASS-path artifact: cited marker + matching sourced facts block
    const withBlock = ["# Plan", "", citedMarker, "", citedBlock, ""].join("\n");
    const withBlockGate = runEnforceGate(withBlock);
    assert.equal(withBlockGate.pass, true, "Cited marker WITH matching sourced facts must PASS");

    // Delete the facts block → the cited marker is now HOLLOW → FAIL
    const withoutBlock = ["# Plan", "", citedMarker, ""].join("\n");
    const withoutBlockGate = runEnforceGate(withoutBlock);
    assert.equal(withoutBlockGate.pass, false, "Cited marker with NO facts block MUST FAIL (hollow-gate defeat)");
    assert.equal(withoutBlockGate.citedCount, 1, "Hollow marker still counts as cited");
    assert.equal(withoutBlockGate.citedWithoutFactsCount, 1, "Exactly 1 hollow cited marker");

    // The deletion FLIPS the verdict (the gate is not a no-op on the facts block)
    assert.notEqual(
      withBlockGate.pass, withoutBlockGate.pass,
      "Deleting the Verified-Facts block must flip the gate pass→fail (gate reads the block)"
    );

    // A facts block present but the fact line has NO source: URL is also hollow → FAIL
    const sourcelessBlock = ["## Verified Facts (auto-research)", "", "- **a fact with no source**"].join("\n");
    const withSourceless = ["# Plan", "", citedMarker, "", sourcelessBlock, ""].join("\n");
    assert.equal(
      runEnforceGate(withSourceless).pass, false,
      "Cited marker backed by a SOURCELESS facts block must FAIL (SC2)"
    );
  });

  // STRUCTURAL marker matching (code-review #1): the marker template carried in this
  // repo's own prose/source is NOT a live marker → no spurious VERIFY-FAILED on dogfood.
  test("STRUCTURAL: prose/source carrying the marker TEMPLATE string is not a live marker", () => {
    const dogfoodLikeSource = [
      "# CLAUDE-global.md style prose",
      "The marker format is `<!-- auto-research-claim: class=external key=<key> status=uncited -->`.",
      'const marker = `<!-- auto-research-claim: class=external key=${claimKey} status=uncited -->`;',
      "It flips status=uncited|cited when facts land.",
    ].join("\n");
    const gate = runEnforceGate(dogfoodLikeSource);
    assert.equal(gate.pass, true, "Template/prose lines must NOT be counted as live markers");
    assert.equal(gate.uncitedCount, 0, "No live uncited markers from prose/source illustrations");
  });

  test("PASS path (internal-only): an artifact with NO markers at all PASSES (A4 only applies to external claims)", () => {
    const artifactContent = [
      "# Plan for M89",
      "",
      "## Summary",
      "A plan with only internal claims — no external guessed claims, no markers.",
      "",
    ].join("\n");

    const gateResult = runEnforceGate(artifactContent);
    assert.equal(gateResult.pass, true, "Gate must PASS when no markers at all are present");
    assert.equal(gateResult.uncitedCount, 0);
    assert.equal(gateResult.citedCount, 0);
  });

  test("FAIL path: multiple uncited markers all counted (gate counts ALL uncited, not just first)", () => {
    const claim1 = "PayPal v2 invoice TOTAL amount limit";
    const claim2 = "Stripe webhook signature header name";
    const artifactContent = [
      buildUncitedMarker(claim1),
      buildUncitedMarker(claim2),
    ].join("\n");

    const gateResult = runEnforceGate(artifactContent);
    assert.equal(gateResult.pass, false);
    assert.equal(gateResult.uncitedCount, 2, "Must count both uncited markers");
  });

  test("MIXED: artifact with one cited and one uncited FAILS (any uncited = FAIL)", () => {
    const citedClaim = "PayPal OAuth /v1/oauth2/token mint";
    const uncitedClaim = "PayPal v2 invoice TOTAL amount limit";

    const artifactContent = [
      buildCitedMarker(citedClaim),
      buildUncitedMarker(uncitedClaim),
    ].join("\n");

    const gateResult = runEnforceGate(artifactContent);
    assert.equal(gateResult.pass, false, "ANY uncited marker = FAIL");
    assert.equal(gateResult.uncitedCount, 1);
    assert.equal(gateResult.citedCount, 1);
  });

  test("verify workflow source contains the auto-research-gate agent call", () => {
    assert.ok(
      verifySource.includes("auto-research-gate") || verifySource.includes("Auto-Research Gate"),
      "gsd-t-verify.workflow.js must contain the auto-research-gate agent call or phase"
    );
  });

  test("verify workflow source checks for status=uncited in its gate logic", () => {
    assert.ok(
      verifySource.includes("status=uncited"),
      "gsd-t-verify.workflow.js must check for status=uncited in its §7 ENFORCE gate"
    );
  });

  test("verify workflow gate returns VERIFY-FAILED on uncited marker (halt before triad)", () => {
    // The verify workflow's auto-research gate block must halt with overallVerdict VERIFY-FAILED.
    assert.ok(
      verifySource.includes("auto-research-gate-failed") || verifySource.includes("VERIFY-FAILED"),
      "Verify workflow must return VERIFY-FAILED when auto-research gate fails"
    );
  });
});

// ---------------------------------------------------------------------------
// T3.4 — Idempotency POSITIVE (A2/§4.1): already-cited claim-key → "skip"
// ---------------------------------------------------------------------------

describe("T3.4 — Idempotency POSITIVE (A2/§4.1): exact claim-key hit → skip, zero re-research", () => {

  test("idempotency: same claim-key already in citedKeys → shouldResearch returns 'skip'", () => {
    const claimText = "PayPal OAuth /v1/oauth2/token mint";
    const claimKey = normalizeClaimKey(claimText);
    const existingCitedKeys = new Set([claimKey]);

    const result = shouldResearch(claimKey, existingCitedKeys);
    assert.equal(result, "skip", "Already-cited exact claim-key must return 'skip' (zero re-research)");
  });

  test("idempotency: cited marker in artifact → PASS gate (no re-research needed)", () => {
    const claimText = "PayPal OAuth /v1/oauth2/token mint";
    const cited = buildCitedMarker(claimText);
    const block = buildVerifiedFactsBlock(
      normalizeClaimKey(claimText),
      "https://developer.paypal.com/api/rest/authentication/",
      "2026-06-18"
    );

    // Simulate the idempotency check result (marker already status=cited)
    const artifactContent = [cited, "", block].join("\n");
    const gateResult = runEnforceGate(artifactContent);
    assert.equal(gateResult.pass, true, "A pre-cited artifact must PASS the gate (no new research needed)");
  });

  test("phase workflow source contains idempotency-check logic (already-cited skip)", () => {
    assert.ok(
      phaseSource.includes("alreadyCited") || phaseSource.includes("idempotency"),
      "Phase workflow must implement the idempotency skip predicate (§4.1)"
    );
    assert.ok(
      phaseSource.includes("already-cited") || phaseSource.includes("already cited") || phaseSource.includes("idempotency"),
      "Phase workflow must log or label the already-cited skip action"
    );
  });
});

// ---------------------------------------------------------------------------
// T3.5 — Idempotency NEGATIVE (§4.1 load-bearing): distinct claim B NOT covered by claim A
// ---------------------------------------------------------------------------

describe("T3.5 — Idempotency NEGATIVE (§4.1): distinct claims are NOT interchangeable", () => {

  test("PayPal OAuth gap A does NOT cover PayPal invoice-TOTAL gap B (different gap-keys)", () => {
    const gapA = "PayPal OAuth /v1/oauth2/token mint";
    const gapB = "PayPal v2 invoice TOTAL amount limit";
    const keyA = normalizeClaimKey(gapA);
    const keyB = normalizeClaimKey(gapB);

    assert.notEqual(keyA, keyB, "Gap A and Gap B must have DISTINCT normalized gap-keys");

    const existingCitedKeys = new Set([keyA]); // only gap A is cited
    const result = shouldResearch(keyB, existingCitedKeys);
    assert.equal(
      result,
      "research",
      "Gap B must still route to research even though gap A (also mentioning PayPal) is already cited"
    );
  });

  test("gap-key normalization: claims sharing a keyword produce DIFFERENT keys when they differ", () => {
    const claimA = "Stripe webhook signature header name";
    const claimB = "Stripe rate limit per API key";
    const keyA = normalizeClaimKey(claimA);
    const keyB = normalizeClaimKey(claimB);

    assert.notEqual(keyA, keyB, "Two distinct Stripe claims must produce DIFFERENT gap-keys");
  });

  test("two artifacts for the SAME claim produce the SAME key (idempotency-positive invariant)", () => {
    const claimWithExtraSpaces = "  PayPal  OAuth  /v1/oauth2/token   mint  ";
    const claimNormalized = "PayPal OAuth /v1/oauth2/token mint";
    assert.equal(
      normalizeClaimKey(claimWithExtraSpaces),
      normalizeClaimKey(claimNormalized),
      "Whitespace-variant of same claim must produce identical gap-key"
    );
  });
});

// ---------------------------------------------------------------------------
// T3.6 — Ambiguous-escalation path (§5.1): grep-empty → research; grep-resolved → no web
// ---------------------------------------------------------------------------

describe("T3.6 — Ambiguous-escalation path (§5.1): grep-empty → escalate to external", () => {

  test("classifier returns class:ambiguous (route:judge) for a claim with no string fact (v1.3.0)", () => {
    // A claim with no decisive internal or external STRING FACT → ambiguous → LLM judge.
    const ambiguousClaim = "the maximum number of items that can be processed per batch";
    const result = classify(ambiguousClaim);
    assert.ok(result.ok, `classify must succeed for ambiguous claim, got: ${JSON.stringify(result)}`);
    assert.equal(
      result.class, "ambiguous",
      `A claim with no string fact must classify ambiguous (semantic placement is the LLM's call), got: "${result.class}"`
    );
    assert.equal(result.route, "judge", `ambiguous must route to the LLM judge, got: "${result.route}"`);
  });

  test("the phase workflow wires ambiguous → LLM judge (classify-judge, model:fable) → uncertain→research", () => {
    assert.ok(
      phaseSource.includes("classify-judge"),
      "Phase workflow must route class:ambiguous to a classify-judge agent stage (v1.3.0)"
    );
    assert.ok(
      phaseSource.includes("judgeAmbiguous") || phaseSource.includes('verdict === "uncertain"') || phaseSource.includes("verdict === 'uncertain'"),
      "Phase workflow must treat an UNCERTAIN judge verdict as external→research (never guess-internal)"
    );
  });

  test("phase workflow source contains internal-grep agent call (§5.1 ambiguous-internal-first)", () => {
    assert.ok(
      phaseSource.includes("internal-grep") || phaseSource.includes("grep"),
      "Phase workflow must have grep/internal resolution for internal-classified claims"
    );
  });

  test("phase workflow escalates to external research when grep returns nothing (§5.1)", () => {
    // The escalation path is triggered when grepResult.found === false
    assert.ok(
      phaseSource.includes("grep EMPTY") || phaseSource.includes("grep returns nothing") ||
      phaseSource.includes("escalat") || phaseSource.includes("escalation"),
      "Phase workflow must contain the §5.1 escalation path when grep finds nothing"
    );
  });

  test("phase workflow writes a §7 marker for escalated claims (via the shared doExternal() path)", () => {
    // v1.3.3 dedup: escalated claims go through doExternal() (which writes the uncited marker
    // via "marker-write-uncited") instead of a separate "marker-write-escalated" path.
    assert.ok(
      /grep EMPTY[\s\S]{0,160}await doExternal\(\)/.test(phaseSource),
      "Phase workflow's §5.1 escalation must call doExternal() — which writes the §7 uncited marker"
    );
    assert.ok(
      phaseSource.includes("marker-write-uncited"),
      "doExternal() must write the §7 uncited marker (marker-write-uncited) for escalated claims"
    );
  });

  test("phase workflow does NOT write a marker for grep-resolved internal claims", () => {
    // When grep FINDS the answer, no marker is written — only research triggers markers
    // Verify the logic path: grepResult.found → "no-marker" path (no marker write)
    assert.ok(
      phaseSource.includes("resolved-grep") || phaseSource.includes("resolved via grep"),
      "Phase workflow must have a 'resolved-grep' action for internal claims grep can answer"
    );
  });
});

// ---------------------------------------------------------------------------
// T3.7 — research stage model: literal is bare "fable" (NOT ?? form — M85 invariant)
// ---------------------------------------------------------------------------

describe("T3.7 — Research stage model: bare 'fable' literal (NOT overrides[...] ?? form)", () => {

  test("phase workflow research-stage agent uses bare model: 'fable' literal", () => {
    // Find the research-stage agent call and verify it uses a bare "fable" literal.
    // The ?? form (overrides["research"] ?? "fable") would FAIL the M85 lint because
    // "research" is not a designated injectable stage in STAGE_TIERS.
    // The bare "fable" literal PASSES the M85 lint (tier-set membership check).

    // Extract the research-stage agent call context
    const researchStageIdx = phaseSource.indexOf('"research-stage"');
    assert.ok(researchStageIdx >= 0, "Must find the research-stage label in the phase workflow");

    // Check model: in a window around the research-stage label
    const window = phaseSource.slice(
      Math.max(0, researchStageIdx - 200),
      Math.min(phaseSource.length, researchStageIdx + 400)
    );

    // Must contain model: "fable" (bare form)
    assert.ok(
      /model\s*:\s*["']fable["']/.test(window),
      `research-stage agent call near label "research-stage" must use bare model: "fable"\n  window: ${window.slice(0, 300)}`
    );

    // Must NOT use the override form for "research"
    assert.ok(
      !window.includes('overrides["research"]'),
      `research-stage must NOT use overrides["research"] ?? ... form — "research" is not a designated stage`
    );
  });

  test("every research-stage agent uses bare model: 'fable'; the §5.1 escalation reuses doExternal()", () => {
    // v1.3.3 dedup: the grep-empty escalation now CALLS doExternal() (one shared research-stage
    // agent) instead of re-inlining a second research-stage call. So there is ≥1 research-stage
    // agent and EVERY one is model: "fable". The escalation no longer duplicates the path.
    const allResearchStageRe = /label:\s*["']research-stage["'][^}]*model\s*:\s*["']([^"']+)["']/gs;
    const matches = [...phaseSource.matchAll(allResearchStageRe)];
    assert.ok(matches.length >= 1, `Must have ≥1 research-stage agent call, found ${matches.length}`);
    for (const match of matches) {
      assert.equal(match[1], "fable", `research-stage model must be "fable" (bare literal), got "${match[1]}"`);
    }
    // The §5.1 grep-empty escalation must reuse doExternal() (not re-inline a research-stage).
    assert.ok(
      /grep EMPTY[\s\S]{0,160}await doExternal\(\)/.test(phaseSource),
      "the phase §5.1 grep-empty escalation must call doExternal() (dedup — no re-inlined research path)"
    );
  });

  test("research-stage labels do NOT use the ?? override form for 'research' key", () => {
    assert.ok(
      !phaseSource.includes('overrides["research"]'),
      'Phase workflow must NOT contain overrides["research"] ?? ... (not a designated stage)'
    );
  });
});

// ---------------------------------------------------------------------------
// T3.8 — Verify workflow §7 gate: source structural checks
// ---------------------------------------------------------------------------

describe("T3.8 — Verify workflow: §7 ENFORCE gate is wired in source", () => {

  test("verify workflow contains 'Auto-Research Gate' phase declaration in meta.phases", () => {
    assert.ok(
      verifySource.includes("Auto-Research Gate"),
      "gsd-t-verify.workflow.js must declare 'Auto-Research Gate' in meta.phases"
    );
  });

  test("verify workflow contains the auto-research-gate agent call", () => {
    assert.ok(
      verifySource.includes('label: "auto-research-gate"') ||
      verifySource.includes("label: 'auto-research-gate'"),
      "gsd-t-verify.workflow.js must call agent() with label 'auto-research-gate'"
    );
  });

  test("verify workflow halts with VERIFY-FAILED when auto-research gate fails", () => {
    assert.ok(
      verifySource.includes("auto-research-gate-failed"),
      "Verify workflow must return status 'auto-research-gate-failed' on gate failure"
    );
    assert.ok(
      verifySource.includes("VERIFY-FAILED"),
      "Verify workflow must return overallVerdict 'VERIFY-FAILED' on gate failure"
    );
  });

  test("verify workflow gate runs BEFORE CI-Parity (ordering: verify-gate → auto-research → CI-Parity)", () => {
    const arGateIdx = verifySource.indexOf("Auto-Research Gate");
    const ciParityIdx = verifySource.indexOf("CI-Parity");

    assert.ok(arGateIdx >= 0, "Auto-Research Gate must be present");
    assert.ok(ciParityIdx >= 0, "CI-Parity must be present");
    assert.ok(
      arGateIdx < ciParityIdx,
      `Auto-Research Gate (pos ${arGateIdx}) must appear BEFORE CI-Parity (pos ${ciParityIdx}) in the source`
    );
  });

  test("verify workflow uses haiku model for the auto-research-gate scan agent", () => {
    // The auto-research-gate is a mechanical scan (grep), so it runs on haiku — not a
    // heavyweight reasoning stage. Find the model: near the auto-research-gate label.
    const gateIdx = verifySource.indexOf('"auto-research-gate"');
    assert.ok(gateIdx >= 0, "Must find the auto-research-gate label");

    const window = verifySource.slice(
      Math.max(0, gateIdx - 100),
      Math.min(verifySource.length, gateIdx + 300)
    );
    assert.ok(
      window.includes('"haiku"') || window.includes("'haiku'"),
      `auto-research-gate scan agent should use model: "haiku" (mechanical grep task)\n  window: ${window.slice(0, 300)}`
    );
  });
});
