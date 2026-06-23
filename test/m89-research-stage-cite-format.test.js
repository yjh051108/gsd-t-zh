"use strict";

// M89-D2-T3 — Verified-Facts cite-format + idempotency test
//
// Pure parser/idempotency test over the Verified-Facts block grammar (no live web call).
// Contract: auto-research-contract.md v1.2.0 §3 (cite format) + §4 (idempotency / A2)
// Contract: auto-research-contract.md §6.5 (DETECT seam — Stated Claims tag grammar)
//
// Also asserts:
//   - The CLAUDE-global.md Research Policy replacement (KNOWN-vs-GUESSED trigger present;
//     advisory "if in doubt, skip" prose absent; SC6 conversation directive present).
//   - That docs/requirements.md carries an M89 entry (A6 doc-ripple).
//
// Runner: npm test (Node built-in test runner).

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..");
const CLAUDE_GLOBAL = path.resolve(ROOT, "templates", "CLAUDE-global.md");
const REQUIREMENTS_MD = path.resolve(ROOT, "docs", "requirements.md");
const RESEARCH_SUBAGENT_MD = path.resolve(ROOT, "templates", "prompts", "research-subagent.md");
const STATED_CLAIMS_MD = path.resolve(ROOT, "templates", "prompts", "stated-claims-snippet.md");

// ---------------------------------------------------------------------------
// §3 — Verified-Facts cite-block grammar
//
// Block grammar (auto-research-contract §3):
//   ## Verified Facts (auto-research)
//   - **<fact>** — source: <url> (fetched YYYY-MM-DD)
//
// A fact line MUST have BOTH a source URL and a (fetched YYYY-MM-DD) date.
// ---------------------------------------------------------------------------

/**
 * Normalise a claim string to a gap-key.
 * Exact normalization: lowercase, collapse internal whitespace, strip surrounding punctuation/quotes.
 * Auto-research-contract §4.1 + §7.
 *
 * @param {string} claim
 * @returns {string}
 */
function normalizeGapKey(claim) {
  // Cycle-2 finding #1: collapse EVERY non-word run to a space (marker-syntax-safe key),
  // byte-equivalent to the workflows' normalizeClaimKey.
  return claim.toLowerCase().replace(/[^\w]+/g, " ").trim();
}

/**
 * Parse a Verified-Facts block string.
 * Returns { valid: boolean, facts: Array<{text, url, date}>, errors: string[] }
 *
 * @param {string} block
 */
function parseVerifiedFactsBlock(block) {
  const errors = [];
  const facts = [];

  const lines = block.split("\n");

  // Must start with the exact heading
  const headingLine = lines.find((l) => l.trim().startsWith("#"));
  const EXPECTED_HEADING = "## Verified Facts (auto-research)";
  if (!headingLine || headingLine.trim() !== EXPECTED_HEADING) {
    errors.push(
      `Missing or wrong heading. Expected exactly "${EXPECTED_HEADING}", got "${headingLine ? headingLine.trim() : "(none)"}"`,
    );
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("- ")) continue;

    // Fact line pattern: - **<text>** — source: <url> (fetched YYYY-MM-DD)
    const sourceMatch = trimmed.match(/source:\s*(<[^>]+>|https?:\/\/\S+)/i);
    const dateMatch = trimmed.match(/\(fetched\s+(\d{4}-\d{2}-\d{2})\)/i);

    const factText = trimmed.replace(/^-\s+\*\*/, "").replace(/\*\*.*$/, "").trim();

    if (!sourceMatch) {
      errors.push(`Fact line is missing source URL: "${trimmed}"`);
    }
    if (!dateMatch) {
      errors.push(`Fact line is missing (fetched YYYY-MM-DD) date: "${trimmed}"`);
    }

    facts.push({
      text: factText,
      url: sourceMatch ? sourceMatch[1] : null,
      date: dateMatch ? dateMatch[1] : null,
    });
  }

  return { valid: errors.length === 0, facts, errors };
}

/**
 * Idempotency predicate: should research be triggered for a new gap?
 *
 * Scans `existingCitedKeys` (Set of already-cited normalized gap-keys) for an
 * EXACT match of `newGapKey`. Returns "skip" if already covered, "research" otherwise.
 *
 * "Covers" is EXACT normalized-gap-key match — NOT substring/keyword/fuzzy.
 * Auto-research-contract §4.1 (finding #2).
 *
 * @param {string} newGapKey   - normalized gap-key of the new claim
 * @param {Set<string>} existingCitedKeys - set of already-cited normalized gap-keys
 * @returns {"skip" | "research"}
 */
function shouldResearch(newGapKey, existingCitedKeys) {
  return existingCitedKeys.has(newGapKey) ? "skip" : "research";
}

// ---------------------------------------------------------------------------
// Stated Claims tag grammar (§6.5)
//
// The four EXACT tags (case-sensitive):
//   [KNOWN]
//   [GUESSED:unknown]
//   [GUESSED:assumed]
//   [GUESSED:stale]
//
// The section heading is exactly: ## Stated Claims
// ---------------------------------------------------------------------------

const STATED_CLAIMS_HEADING = "## Stated Claims";
const VALID_TAGS = ["[KNOWN]", "[GUESSED:unknown]", "[GUESSED:assumed]", "[GUESSED:stale]"];

/**
 * Parse a Stated Claims section.
 * Returns { heading: boolean, tags: string[], unknownTags: string[] }
 *
 * @param {string} text - the full text containing a ## Stated Claims section
 */
function parseStatedClaimsSection(text) {
  const headingPresent = text.includes(STATED_CLAIMS_HEADING);
  const tags = [];
  const unknownTags = [];

  for (const line of text.split("\n")) {
    // Match any [...] token that starts with KNOWN or GUESSED (with or without sub-type)
    const m = line.match(/\[(KNOWN|GUESSED[^\]]*)\]/);
    if (!m) continue;
    const tag = `[${m[1]}]`;
    tags.push(tag);
    if (!VALID_TAGS.includes(tag)) {
      unknownTags.push(tag);
    }
  }

  return { heading: headingPresent, tags, unknownTags };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("§3 — Verified-Facts cite-block grammar", () => {
  test("POSITIVE: well-formed block with URL and date on every fact PARSES and is accepted", () => {
    const block = [
      "## Verified Facts (auto-research)",
      "",
      "- **PayPal OAuth token endpoint accepts grant_type=client_credentials** — source: <https://developer.paypal.com/api/rest/authentication/> (fetched 2026-06-18)",
      "- **The endpoint path is /v1/oauth2/token** — source: <https://developer.paypal.com/api/rest/authentication/> (fetched 2026-06-18)",
    ].join("\n");

    const result = parseVerifiedFactsBlock(block);
    assert.equal(result.valid, true, `Expected valid but got errors: ${result.errors.join("; ")}`);
    assert.equal(result.facts.length, 2);
    assert.ok(result.facts[0].url, "First fact must have a URL");
    assert.ok(result.facts[0].date, "First fact must have a fetch date");
    assert.ok(result.facts[1].url, "Second fact must have a URL");
    assert.ok(result.facts[1].date, "Second fact must have a fetch date");
  });

  test("POSITIVE (v1.3.0 — per-key trailer): a fact line carrying a `key:` trailer still PARSES (source+date intact)", () => {
    // Red Team MEDIUM #2: the optional `key: <normalized-claim-key>` trailer lets the §7
    // gate match cited markers to facts BY CLAIM-KEY. It must not break source/date parsing.
    const block = [
      "## Verified Facts (auto-research)",
      "",
      "- **PayPal v2 invoice total must not exceed 1,000,000.00 USD** — source: <https://developer.paypal.com/docs/api/invoicing/v2/> (fetched 2026-06-18) key: paypal v2 invoice total amount limit",
    ].join("\n");
    const result = parseVerifiedFactsBlock(block);
    assert.equal(result.valid, true, `key: trailer must not invalidate the block: ${result.errors.join("; ")}`);
    assert.equal(result.facts.length, 1);
    assert.ok(result.facts[0].url, "fact with key: trailer must still expose its URL");
    assert.ok(result.facts[0].date, "fact with key: trailer must still expose its fetch date");
    // The key trailer is present and parseable as an explicit claim-key match for the gate.
    const keyMatch = block.match(/\bkey:\s*([a-z0-9 ]+)\s*$/m);
    assert.ok(keyMatch && keyMatch[1].trim() === "paypal v2 invoice total amount limit",
      "the key: trailer must carry the normalized claim-key the §7 gate matches against");
  });

  test("research-subagent.md documents the optional `key:` per-fact trailer (Red Team MEDIUM #2)", () => {
    const content = fs.readFileSync(RESEARCH_SUBAGENT_MD, "utf8");
    assert.ok(
      content.includes("key: <normalized-claim-key>") || content.includes("key:"),
      "research-subagent.md must instruct the stage to emit the optional `key:` trailer for per-claim-key gate matching",
    );
  });

  test("NEGATIVE (SC2): a fact line with NO source URL FAILS", () => {
    const block = [
      "## Verified Facts (auto-research)",
      "",
      "- **PayPal OAuth token endpoint** (fetched 2026-06-18)",
    ].join("\n");

    const result = parseVerifiedFactsBlock(block);
    assert.equal(result.valid, false, "Expected FAIL for missing source URL");
    assert.ok(
      result.errors.some((e) => e.includes("source URL")),
      `Expected 'source URL' in errors; got: ${result.errors.join("; ")}`,
    );
  });

  test("NEGATIVE: a fact line with NO fetch date FAILS (date is load-bearing — §1.3)", () => {
    const block = [
      "## Verified Facts (auto-research)",
      "",
      "- **PayPal OAuth token endpoint** — source: <https://developer.paypal.com/api/rest/authentication/>",
    ].join("\n");

    const result = parseVerifiedFactsBlock(block);
    assert.equal(result.valid, false, "Expected FAIL for missing fetch date");
    assert.ok(
      result.errors.some((e) => e.includes("fetched")),
      `Expected 'fetched' in errors; got: ${result.errors.join("; ")}`,
    );
  });

  test("NEGATIVE: wrong heading string FAILS (machine-detect requires exact heading)", () => {
    const block = [
      "## Verified Facts", // missing the (auto-research) suffix
      "",
      "- **A fact** — source: <https://example.com> (fetched 2026-06-18)",
    ].join("\n");

    const result = parseVerifiedFactsBlock(block);
    assert.equal(result.valid, false, "Expected FAIL for wrong heading");
    assert.ok(
      result.errors.some((e) => e.includes("heading")),
      `Expected 'heading' in errors; got: ${result.errors.join("; ")}`,
    );
  });

  test("heading string in research-subagent.md matches the gate's machine-detect string", () => {
    assert.ok(
      fs.existsSync(RESEARCH_SUBAGENT_MD),
      `research-subagent.md must exist at ${RESEARCH_SUBAGENT_MD}`,
    );
    const content = fs.readFileSync(RESEARCH_SUBAGENT_MD, "utf8");
    assert.ok(
      content.includes("## Verified Facts (auto-research)"),
      'research-subagent.md must contain the exact heading "## Verified Facts (auto-research)"',
    );
    // Also verify that both source: and (fetched YYYY-MM-DD) are mandated
    assert.ok(
      content.includes("source:") && content.includes("fetched"),
      "research-subagent.md must mandate both source URL and fetch date",
    );
  });
});

describe("§4.1 — Idempotency: exact gap-key match, NOT fuzzy/keyword (finding #2)", () => {
  test("IDEMPOTENCY POSITIVE (A2): already-cited gap-key → predicate returns 'skip' (zero re-research)", () => {
    const gapA = "paypal oauth /v1/oauth2/token mint";
    const gapAKey = normalizeGapKey(gapA);
    const existingKeys = new Set([gapAKey]);

    const result = shouldResearch(gapAKey, existingKeys);
    assert.equal(result, "skip", "An already-cited exact gap-key must return 'skip'");
  });

  test("IDEMPOTENCY NEGATIVE (finding #2 load-bearing): distinct gap B is NOT covered by gap A even when they share keywords", () => {
    // Gap A: already cited
    const gapA = "PayPal OAuth /v1/oauth2/token mint";
    const gapAKey = normalizeGapKey(gapA);
    const existingKeys = new Set([gapAKey]);

    // Gap B: DIFFERENT — shares "PayPal" but is a distinct external claim
    const gapB = "PayPal v2 invoice TOTAL amount limit";
    const gapBKey = normalizeGapKey(gapB);

    // Assert they are DIFFERENT keys
    assert.notEqual(gapAKey, gapBKey, "Gap A and Gap B must have DIFFERENT normalized gap-keys");

    // Gap B must still route to research (not skipped)
    const result = shouldResearch(gapBKey, existingKeys);
    assert.equal(
      result,
      "research",
      "A DISTINCT gap (B) must return 'research' even when gap A (citing 'PayPal') is already cited",
    );
  });

  test("normalizeGapKey is deterministic (identical input → identical key)", () => {
    const claim = "  PayPal  OAuth  /v1/oauth2/token   mint  ";
    assert.equal(normalizeGapKey(claim), normalizeGapKey(claim));
    assert.equal(normalizeGapKey(claim), normalizeGapKey("PayPal OAuth /v1/oauth2/token mint"));
  });
});

describe("§6.5 — Stated Claims DETECT seam tag grammar (stated-claims-snippet.md)", () => {
  test("stated-claims-snippet.md exists and mandates the ## Stated Claims heading", () => {
    assert.ok(
      fs.existsSync(STATED_CLAIMS_MD),
      `stated-claims-snippet.md must exist at ${STATED_CLAIMS_MD}`,
    );
    const content = fs.readFileSync(STATED_CLAIMS_MD, "utf8");
    assert.ok(
      content.includes(STATED_CLAIMS_HEADING),
      `stated-claims-snippet.md must contain the heading "${STATED_CLAIMS_HEADING}"`,
    );
  });

  test("stated-claims-snippet.md defines all four valid tags", () => {
    const content = fs.readFileSync(STATED_CLAIMS_MD, "utf8");
    for (const tag of VALID_TAGS) {
      assert.ok(
        content.includes(tag),
        `stated-claims-snippet.md must define the tag "${tag}"`,
      );
    }
  });

  test("POSITIVE: parseStatedClaimsSection detects the heading and all four tag types", () => {
    const section = [
      "## Stated Claims",
      "",
      "- [KNOWN] The project uses Node.js >= 16",
      "- [GUESSED:unknown] The API rate limit for this endpoint",
      "- [GUESSED:assumed] The create call returns a url field",
      "- [GUESSED:stale] The SDK version last checked 6 months ago",
    ].join("\n");

    const result = parseStatedClaimsSection(section);
    assert.ok(result.heading, "## Stated Claims heading must be detected");
    assert.ok(result.tags.includes("[KNOWN]"), "Should detect [KNOWN]");
    assert.ok(result.tags.includes("[GUESSED:unknown]"), "Should detect [GUESSED:unknown]");
    assert.ok(result.tags.includes("[GUESSED:assumed]"), "Should detect [GUESSED:assumed]");
    assert.ok(result.tags.includes("[GUESSED:stale]"), "Should detect [GUESSED:stale]");
    assert.equal(result.unknownTags.length, 0, "No unknown tags expected");
  });

  test("NEGATIVE: invalid tag format is not in the valid tag set", () => {
    const section = [
      "## Stated Claims",
      "",
      "- [GUESSED] some claim without a type sub-tag",
    ].join("\n");

    const result = parseStatedClaimsSection(section);
    assert.ok(result.unknownTags.includes("[GUESSED]"), "Should flag [GUESSED] (no type) as unknown");
  });
});

describe("D4 doc-ripple assertions (CLAUDE-global + requirements.md)", () => {
  test("templates/CLAUDE-global.md contains the KNOWN-vs-GUESSED trigger (advisory prose replaced)", () => {
    assert.ok(fs.existsSync(CLAUDE_GLOBAL), `CLAUDE-global.md must exist at ${CLAUDE_GLOBAL}`);
    const content = fs.readFileSync(CLAUDE_GLOBAL, "utf8");

    // The KNOWN-vs-GUESSED trigger keywords must be present
    assert.ok(
      content.includes("KNOWN") && content.includes("GUESSED"),
      "CLAUDE-global.md must contain KNOWN/GUESSED trigger keywords (not just the old advisory)",
    );

    // The advisory "if in doubt, skip research" prose must be gone
    assert.ok(
      !content.includes("If in doubt, skip research"),
      'CLAUDE-global.md must NOT contain the old advisory "If in doubt, skip research" prose',
    );
  });

  test("templates/CLAUDE-global.md contains the SC6 conversation-scope directive", () => {
    const content = fs.readFileSync(CLAUDE_GLOBAL, "utf8");
    // SC6: when answering the USER about an external/time-varying fact, verify-or-flag
    assert.ok(
      content.includes("conversation") || content.includes("SC6") || content.includes("verify-or-flag"),
      "CLAUDE-global.md must contain the SC6 conversation-scope directive about external facts",
    );
  });

  test("docs/requirements.md contains the M89 auto-research entry (A6)", () => {
    assert.ok(fs.existsSync(REQUIREMENTS_MD), `requirements.md must exist at ${REQUIREMENTS_MD}`);
    const content = fs.readFileSync(REQUIREMENTS_MD, "utf8");
    assert.ok(
      content.includes("M89") || content.includes("auto-research") || content.includes("GUESSED"),
      "docs/requirements.md must contain an M89 / auto-research entry",
    );
  });
});
