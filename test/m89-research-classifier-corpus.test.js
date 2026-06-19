"use strict";

// M89-D1-T3 — A1 KILLING TEST (headline)
//
// Three assertion sets — all functional, no shallow length>0 / existence checks:
//
//   1. SEEN (13-item labeled corpus): every item's class AND route match the hand-label.
//      Aggregate invariants: items 1-7 all internal (0 external); items 8-13 exactly
//      2-3 external, MUST include PayPal OAuth + invoice-TOTAL findings.
//      Determinism: same gap text → byte-identical envelope on two runs.
//
//   2. HELD-OUT (8 novel items NOT used to author the classifier — anti-self-fulfilling-
//      oracle guard): each item must be labeled by FEATURE CLASS, not by keyword match
//      to the seen 13. Specific guards: HO-E4 (proper-noun-less external assertion) →
//      external; HO-I4 (bare local symbol, no path/anchor) → internal.
//      "Passes seen 13 but fails any held-out item" = EXPLICIT FAILURE.
//
//   3. BAD-INPUT BOUNDARY (finding #6 — SC1): classify('') / classify('   ') → {ok:false};
//      classify(non-string) → {ok:false}, no throw. NONE silently returns class:internal.
//
// Kill gate: a single mislabel (seen or held-out) FAILS. If the classifier cannot hit
// all labels deterministically, HALT M89 and escalate for re-scope.
//
// Contract: .gsd-t/contracts/auto-research-contract.md §1 + §6 + SC1/A1

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

// ---------------------------------------------------------------------------
// Load the classifier under test
// ---------------------------------------------------------------------------

const CLASSIFIER_PATH = path.resolve(__dirname, "..", "bin", "gsd-t-research-gate.cjs");
const SEEN_CORPUS_PATH = path.resolve(__dirname, "fixtures", "m89-labeled-corpus.json");
const HELDOUT_CORPUS_PATH = path.resolve(__dirname, "fixtures", "m89-heldout-corpus.json");

const { classify } = require(CLASSIFIER_PATH);
const seenCorpus = require(SEEN_CORPUS_PATH);
const heldoutCorpus = require(HELDOUT_CORPUS_PATH);

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function runCLI(args) {
  return spawnSync(process.execPath, [CLASSIFIER_PATH, ...args], {
    encoding: "utf8",
    timeout: 5000,
  });
}

// ---------------------------------------------------------------------------
// Assertion set 1: SEEN corpus (13-item labeled oracle)
// ---------------------------------------------------------------------------

describe("SEEN corpus — 13-item hand-labeled oracle (A1 kill gate)", () => {
  const items = seenCorpus.items;

  test("corpus fixture has exactly 13 items", () => {
    assert.strictEqual(items.length, 13, `Expected 13 items, got ${items.length}`);
  });

  test("every item has the required 5 keys", () => {
    for (const item of items) {
      assert.ok("id" in item, `Item missing 'id': ${JSON.stringify(item)}`);
      assert.ok("source" in item, `Item ${item.id} missing 'source'`);
      assert.ok("gap" in item, `Item ${item.id} missing 'gap'`);
      assert.ok("expectedClass" in item, `Item ${item.id} missing 'expectedClass'`);
      assert.ok("expectedRoute" in item, `Item ${item.id} missing 'expectedRoute'`);
    }
  });

  test("every item's expectedClass is 'internal' or 'external' (no ambiguous labels)", () => {
    for (const item of items) {
      assert.ok(
        item.expectedClass === "internal" || item.expectedClass === "external",
        `Item ${item.id} has invalid expectedClass: "${item.expectedClass}"`,
      );
    }
  });

  test("every item's expectedRoute is 'grep' or 'web' (no ambiguous labels)", () => {
    for (const item of items) {
      assert.ok(
        item.expectedRoute === "grep" || item.expectedRoute === "web",
        `Item ${item.id} has invalid expectedRoute: "${item.expectedRoute}"`,
      );
    }
  });

  // Per-item classification assertions — each compared against its SPECIFIC hand-label
  // (NOT just the aggregate count — a label-swap within the same class would fool
  // aggregate-only checks)
  test("each of the 13 items matches its hand-label (class + route)", () => {
    for (const item of items) {
      const result = classify(item.gap);
      assert.strictEqual(
        result.ok,
        true,
        `Item ${item.id}: classify() returned {ok:false}: ${JSON.stringify(result)}`,
      );
      assert.strictEqual(
        result.class,
        item.expectedClass,
        `Item ${item.id} MISLABELED: got class="${result.class}", want "${item.expectedClass}"\n` +
          `  gap: "${item.gap}"\n  reason: "${result.reason}"`,
      );
      assert.strictEqual(
        result.route,
        item.expectedRoute,
        `Item ${item.id} WRONG ROUTE: got route="${result.route}", want "${item.expectedRoute}"\n` +
          `  gap: "${item.gap}"\n  reason: "${result.reason}"`,
      );
    }
  });

  test("envelope always echoes the gap text (auditable, never silent)", () => {
    for (const item of items) {
      const result = classify(item.gap);
      if (result.ok) {
        assert.ok(
          typeof result.gap === "string" && result.gap.length > 0,
          `Item ${item.id}: envelope.gap is absent or empty`,
        );
        assert.strictEqual(
          result.gap,
          item.gap.trim(),
          `Item ${item.id}: envelope.gap does not match the input text`,
        );
      }
    }
  });

  // Aggregate invariants (belt-and-suspenders on top of the per-item checks)
  test("items 1-7 (M87 findings) are ALL internal — 0 external", () => {
    const m87Items = items.slice(0, 7);
    assert.strictEqual(m87Items.length, 7, "Expected exactly 7 M87 items");
    for (const item of m87Items) {
      const result = classify(item.gap);
      assert.strictEqual(
        result.class,
        "internal",
        `M87 item ${item.id} must be internal, got "${result.class}": "${item.gap}"`,
      );
    }
    const externalCount = m87Items.filter((item) => classify(item.gap).class === "external").length;
    assert.strictEqual(externalCount, 0, `M87 items must have 0 external, got ${externalCount}`);
  });

  test("items 8-13 (binvoice S2-M5 findings) have exactly 2-3 external", () => {
    const binvoiceItems = items.slice(7); // items 8-13 (0-indexed: 7-12)
    assert.strictEqual(binvoiceItems.length, 6, "Expected exactly 6 binvoice items");
    const externalCount = binvoiceItems.filter((item) => classify(item.gap).class === "external").length;
    assert.ok(
      externalCount >= 2 && externalCount <= 3,
      `Binvoice items must have 2-3 external, got ${externalCount}`,
    );
  });

  test("PayPal OAuth /v1/oauth2/token finding is labeled external (required by §6)", () => {
    const oauthItem = items.find((item) => item.id === "S2M5-F1");
    assert.ok(oauthItem, "PayPal OAuth /v1/oauth2/token item (S2M5-F1) not found in corpus");
    const result = classify(oauthItem.gap);
    assert.strictEqual(
      result.class,
      "external",
      `PayPal OAuth item must be external, got "${result.class}": "${oauthItem.gap}"`,
    );
    assert.strictEqual(result.route, "web", "PayPal OAuth item must route to web");
  });

  test("PayPal v2 invoice TOTAL amount limit finding is labeled external (required by §6)", () => {
    const totalItem = items.find((item) => item.id === "S2M5-F4");
    assert.ok(totalItem, "PayPal v2 invoice TOTAL amount limit item (S2M5-F4) not found in corpus");
    const result = classify(totalItem.gap);
    assert.strictEqual(
      result.class,
      "external",
      `Invoice TOTAL limit item must be external, got "${result.class}": "${totalItem.gap}"`,
    );
    assert.strictEqual(result.route, "web", "Invoice TOTAL limit item must route to web");
  });

  // Determinism check: same gap text → byte-identical envelope
  test("classify() is deterministic: same gap text → byte-identical envelope (two runs)", () => {
    const sampleItem = items[0]; // M87-F1
    const result1 = classify(sampleItem.gap);
    const result2 = classify(sampleItem.gap);
    assert.deepStrictEqual(
      result1,
      result2,
      `Non-deterministic: two calls on same gap produced different envelopes\n` +
        `  Run 1: ${JSON.stringify(result1)}\n  Run 2: ${JSON.stringify(result2)}`,
    );
  });
});

// ---------------------------------------------------------------------------
// Assertion set 2: HELD-OUT generalization corpus (8 novel items)
// ---------------------------------------------------------------------------

describe("HELD-OUT generalization corpus — anti-self-fulfilling-oracle guard (A1 kill gate)", () => {
  const items = heldoutCorpus.items;

  test("held-out corpus fixture has exactly 8 items", () => {
    assert.strictEqual(items.length, 8, `Expected 8 held-out items, got ${items.length}`);
  });

  test("each held-out item has required keys incl. featureSignal", () => {
    for (const item of items) {
      assert.ok("id" in item, `Held-out item missing 'id': ${JSON.stringify(item)}`);
      assert.ok("gap" in item, `Held-out item ${item.id} missing 'gap'`);
      assert.ok("expectedClass" in item, `Held-out item ${item.id} missing 'expectedClass'`);
      assert.ok("expectedRoute" in item, `Held-out item ${item.id} missing 'expectedRoute'`);
      assert.ok("featureSignal" in item, `Held-out item ${item.id} missing 'featureSignal'`);
    }
  });

  test("held-out corpus has exactly 4 external and 4 internal items", () => {
    const externalCount = items.filter((i) => i.expectedClass === "external").length;
    const internalCount = items.filter((i) => i.expectedClass === "internal").length;
    assert.strictEqual(externalCount, 4, `Expected 4 external held-out items, got ${externalCount}`);
    assert.strictEqual(internalCount, 4, `Expected 4 internal held-out items, got ${internalCount}`);
  });

  // Per-item held-out assertions
  test("each held-out item matches its hand-label (class + route) — proves generalization not keyword memorization", () => {
    for (const item of items) {
      const result = classify(item.gap);
      assert.strictEqual(
        result.ok,
        true,
        `Held-out item ${item.id}: classify() returned {ok:false}: ${JSON.stringify(result)}`,
      );
      assert.strictEqual(
        result.class,
        item.expectedClass,
        `Held-out item ${item.id} MISLABELED (keyword memorization / generalization failure):\n` +
          `  got class="${result.class}", want "${item.expectedClass}"\n` +
          `  gap: "${item.gap}"\n` +
          `  featureSignal: "${item.featureSignal}"\n` +
          `  reason: "${result.reason}"\n` +
          `  NOTE: "Passes seen 13 but fails any held-out item" = EXPLICIT A1 FAILURE`,
      );
      assert.strictEqual(
        result.route,
        item.expectedRoute,
        `Held-out item ${item.id} wrong route: got "${result.route}", want "${item.expectedRoute}"`,
      );
    }
  });

  // Specific premise-correction discriminators (the critical guards)
  test("HO-E4 (proper-noun-LESS external assertion) → external (cycle-2 finding #3 guard)", () => {
    const hoE4 = items.find((i) => i.id === "HO-E4");
    assert.ok(hoE4, "HO-E4 item not found in held-out corpus");
    // Verify no proper noun overlap with seen corpus
    const seenProperNouns = ["paypal", "oauth", "v1/oauth2/token", "invoice total"];
    for (const noun of seenProperNouns) {
      assert.ok(
        !hoE4.gap.toLowerCase().includes(noun),
        `HO-E4 gap must NOT contain seen-corpus proper noun "${noun}": "${hoE4.gap}"`,
      );
    }
    const result = classify(hoE4.gap);
    assert.strictEqual(
      result.class,
      "external",
      `HO-E4 (proper-noun-less external assertion) MUST be external, got "${result.class}"\n` +
        `  gap: "${hoE4.gap}"\n` +
        `  reason: "${result.reason}"\n` +
        `  NOTE: A classifier that defaults proper-noun-less claims to internal FAILS A1 ` +
        `(the cycle-2 silent-miss finding #3 this item is designed to catch)`,
    );
    assert.strictEqual(result.route, "web", "HO-E4 must route to web");
  });

  test("HO-I4 (symbol-only internal, no path/anchor) → internal (premise-correction guard)", () => {
    const hoI4 = items.find((i) => i.id === "HO-I4");
    assert.ok(hoI4, "HO-I4 item not found in held-out corpus");
    const result = classify(hoI4.gap);
    assert.strictEqual(
      result.class,
      "internal",
      `HO-I4 (bare local symbol) MUST be internal, got "${result.class}"\n` +
        `  gap: "${hoI4.gap}"\n` +
        `  reason: "${result.reason}"\n` +
        `  NOTE: A bare local symbol with no path/anchor is still internal (grep-able local code)`,
    );
    assert.strictEqual(result.route, "grep", "HO-I4 must route to grep");
  });

  // Finding #4 (MEDIUM): a claim with a bare internal anchor ("our"/"internal"/
  // "this repo's") routes INTERNAL even when it carries an API/rate-limit term — the
  // internal signal wins (internal-first). The genuinely-external HO-E4 (no anchor)
  // must stay external — proving the anchor, not the limit term, is the discriminator.
  test("finding #4: 'rate limit OUR INTERNAL gateway' → internal (bare anchor beats API term); HO-E4 (no anchor) stays external", () => {
    const internalClaim = "What is the rate limit our internal API gateway enforces per tenant?";
    const rInternal = classify(internalClaim);
    assert.strictEqual(
      rInternal.class,
      "internal",
      `An 'our internal' anchored rate-limit claim must be internal (internal-first), got "${rInternal.class}"\n` +
        `  reason: "${rInternal.reason}"`,
    );
    assert.strictEqual(rInternal.route, "grep", "Internal-anchored claim must route to grep");

    // The genuinely external HO-E4 (no internal anchor) must NOT regress to internal
    const hoE4 = heldoutCorpus.items.find((i) => i.id === "HO-E4");
    const rExternal = classify(hoE4.gap);
    assert.strictEqual(
      rExternal.class,
      "external",
      `HO-E4 (no internal anchor, asserts external limit) must stay external, got "${rExternal.class}"`,
    );
  });

  // Zero token overlap guard (held-out symbols must not appear in seen corpus)
  test("held-out proper nouns/symbols are absent from the seen corpus text (no keyword cross-contamination)", () => {
    const seenGaps = seenCorpus.items.map((i) => i.gap.toLowerCase());
    const seenText = seenGaps.join(" ");

    // The held-out items' discriminating symbols that must NOT appear in seen corpus
    const heldoutUniqueTokens = [
      "stripe",       // HO-E1
      "storage.local", // HO-E2
      ":has()",       // HO-E3
      "isorderlocked", // HO-I1
      "gsd-t-verify.workflow.js", // HO-I2
      "resolveprofile", // HO-I4
    ];

    for (const token of heldoutUniqueTokens) {
      assert.ok(
        !seenText.includes(token.toLowerCase()),
        `Token "${token}" appears in the seen corpus — breaks the held-out non-overlap guarantee\n` +
          `  A classifier that keyword-matched the seen corpus would pass held-out without generalizing`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Assertion set 3: BAD-INPUT BOUNDARY (finding #6 — SC1)
// ---------------------------------------------------------------------------

describe("BAD-INPUT BOUNDARY — finding #6 / SC1 (empty/whitespace/non-string)", () => {
  test("classify('') → {ok:false, error} — NOT class:internal", () => {
    const result = classify("");
    assert.strictEqual(result.ok, false, `classify('') must return {ok:false}, got ${JSON.stringify(result)}`);
    assert.ok(typeof result.error === "string" && result.error.length > 0, "Must include an error message");
    assert.ok(!("class" in result), `classify('') must NOT have a 'class' field, got: ${JSON.stringify(result)}`);
  });

  test("classify('   ') → {ok:false, error} — whitespace-only is invalid input", () => {
    const result = classify("   ");
    assert.strictEqual(result.ok, false, `classify('   ') must return {ok:false}, got ${JSON.stringify(result)}`);
    assert.ok(typeof result.error === "string" && result.error.length > 0, "Must include an error message");
    assert.ok(!("class" in result), `classify('   ') must NOT have a 'class' field`);
  });

  test("classify(null) → {ok:false, error} — no throw", () => {
    let result;
    assert.doesNotThrow(() => {
      result = classify(null);
    }, "classify(null) must not throw");
    assert.strictEqual(result.ok, false, `classify(null) must return {ok:false}, got ${JSON.stringify(result)}`);
    assert.ok(!("class" in result), "classify(null) must NOT have a 'class' field");
  });

  test("classify(undefined) → {ok:false, error} — no throw", () => {
    let result;
    assert.doesNotThrow(() => {
      result = classify(undefined);
    }, "classify(undefined) must not throw");
    assert.strictEqual(result.ok, false, `classify(undefined) must return {ok:false}`);
  });

  test("classify(42) → {ok:false, error} — non-string input", () => {
    let result;
    assert.doesNotThrow(() => {
      result = classify(42);
    }, "classify(42) must not throw");
    assert.strictEqual(result.ok, false, `classify(42) must return {ok:false}`);
    assert.ok(!("class" in result), "Non-string input must NOT produce a class field");
  });

  test("classify({}) → {ok:false, error} — object input", () => {
    let result;
    assert.doesNotThrow(() => {
      result = classify({});
    }, "classify({}) must not throw");
    assert.strictEqual(result.ok, false, `classify({}) must return {ok:false}`);
  });

  test("CLI exits non-zero on empty gap string", () => {
    const result = runCLI(["classify", ""]);
    assert.notStrictEqual(result.status, 0, "CLI must exit non-zero on empty gap");
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.ok, false, "CLI must emit {ok:false} on empty gap");
    assert.ok(!("class" in output), "CLI {ok:false} envelope must not contain 'class'");
  });

  test("CLI exits non-zero on whitespace-only gap", () => {
    const result = runCLI(["classify", "   "]);
    assert.notStrictEqual(result.status, 0, "CLI must exit non-zero on whitespace-only gap");
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.ok, false, "CLI must emit {ok:false} on whitespace-only gap");
  });
});

// ---------------------------------------------------------------------------
// Envelope shape contract (§1 structural assertions)
// ---------------------------------------------------------------------------

describe("envelope shape — §1 contract compliance", () => {
  test("success envelope has exactly {ok,gap,class,route,reason} — no extra keys", () => {
    const result = classify("What does gsd-t-verify-gate return when biome fails?");
    assert.strictEqual(result.ok, true);
    const keys = Object.keys(result).sort();
    assert.deepStrictEqual(
      keys,
      ["class", "gap", "ok", "reason", "route"],
      `Unexpected envelope keys: ${JSON.stringify(keys)}`,
    );
  });

  test("class:internal → route:grep (never route:web for internal)", () => {
    const result = classify("Which domain owns bin/gsd-t-verify-gate.cjs in this repo?");
    if (result.ok && result.class === "internal") {
      assert.strictEqual(result.route, "grep", "internal class must always route to grep, never web");
    }
  });

  test("class:external → route:web (structural guarantee)", () => {
    const result = classify("What is the PayPal v2 OAuth /v1/oauth2/token rate limit?");
    if (result.ok && result.class === "external") {
      assert.strictEqual(result.route, "web", "external class must always route to web");
    }
  });

  test("reason field is always a non-empty string on success", () => {
    const gaps = [
      "What does gsd-t-file-disjointness.cjs return on a conflict?",
      "What is the Stripe webhook signature header?",
    ];
    for (const gap of gaps) {
      const result = classify(gap);
      if (result.ok) {
        assert.ok(
          typeof result.reason === "string" && result.reason.length > 0,
          `reason must be a non-empty string for gap: "${gap}"`,
        );
      }
    }
  });
});
