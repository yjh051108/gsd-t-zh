"use strict";

// M89-D1-T3 / M90-D3 — A1 KILLING TEST (headline) — v1.4.0 (M90 premise-corrected + time-anchored)
//
// The classifier is a MECHANICAL STRING-FACT FILTER returning internal | external |
// AMBIGUOUS. internal/external fire ONLY on an unambiguous STRING FACT; everything that
// would require JUDGMENT is AMBIGUOUS (routed to the LLM judge by the wiring, then
// uncertain->research). The A1 oracle proves it does NOT memorize keywords and that the
// previously-"external-assertion" paraphrases (HO-E4, react/useState, stripe createCharge,
// CSS :has) now correctly return AMBIGUOUS — never silently internal.
//
// Five assertion sets — all functional, no shallow length>0 / existence checks:
//
//   1. SEEN (13-item labeled corpus): every item's class AND route match the hand-label.
//      Aggregate invariants: items 1-7 carry 6 internal + 1 ambiguous (0 external);
//      items 8-13 carry exactly 2 external (PayPal OAuth + invoice-TOTAL string facts).
//      Determinism: same gap text → byte-identical envelope on two runs.
//
//   2. HELD-OUT (21 novel items NOT used to author the classifier — anti-self-fulfilling-
//      oracle guard): each item must be labeled by STRING FACT, not by keyword match.
//      Specific guards: HO-E4 (proper-noun-less external assertion) → AMBIGUOUS (the LLM
//      judge's call, NOT a regex guess); HO-I4 (bare camelCase symbol) → AMBIGUOUS
//      (shape-identical to an external symbol → not a string fact). HO-T1/T2 (temporal
//      signal phrases) → external/web (R-FACT-3 time-anchored override).
//      "Passes seen 13 but fails any held-out item" = EXPLICIT FAILURE.
//
//   3. BAD-INPUT BOUNDARY (SC1): classify('') / classify('   ') → {ok:false};
//      classify(non-string) → {ok:false}, no throw. NONE silently returns a class.
//
//   4. M90 D3 — R-FACT-0 BASELINE (premise-grounding, D3-T0): ≥10 never-seen external
//      vendors / freshly-invented names → NONE route silently-internal. Grounds the
//      partition premise (vendor list does not cause silent-miss) on disk.
//
//   5. M90 D3 — R-FACT-3 TIME-ANCHORED OVERRIDE (D3-T3): fast-moving / best-practice
//      / version / deprecation gaps → external/web REGARDLESS of other signals.
//
// Kill gate: a single mislabel (seen or held-out) FAILS.
//
// Contract: .gsd-t/contracts/auto-research-contract.md §1 + §1.1 + §6 + SC1/A1 (v1.3.3)
//           .gsd-t/contracts/m90-doctrine-mechanisms-contract.md §1 v1.0.0

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

  test("every item's expectedClass is internal|external|ambiguous (3-result filter)", () => {
    for (const item of items) {
      assert.ok(
        ["internal", "external", "ambiguous"].includes(item.expectedClass),
        `Item ${item.id} has invalid expectedClass: "${item.expectedClass}"`,
      );
    }
  });

  test("every item's expectedRoute is grep|web|judge (route derived from class)", () => {
    for (const item of items) {
      assert.ok(
        ["grep", "web", "judge"].includes(item.expectedRoute),
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
  // M87 findings are all repo-internal: those carrying a concrete string fact (anchor or
  // path/tool shape) classify internal; the one with NO string fact (M87-F5 — generic
  // "contract file") is AMBIGUOUS and reaches the LLM judge (which resolves it internal via
  // grep). The load-bearing invariant: NONE of the M87 items is ever EXTERNAL.
  test("items 1-7 (M87 findings) are never external (internal or ambiguous only)", () => {
    const m87Items = items.slice(0, 7);
    assert.strictEqual(m87Items.length, 7, "Expected exactly 7 M87 items");
    const externalCount = m87Items.filter((item) => classify(item.gap).class === "external").length;
    assert.strictEqual(externalCount, 0, `M87 items must have 0 external, got ${externalCount}`);
    // At least the explicitly-anchored/path-shaped ones must be confidently internal.
    const internalCount = m87Items.filter((item) => classify(item.gap).class === "internal").length;
    assert.ok(internalCount >= 5, `Most M87 items must classify confidently internal, got ${internalCount}/7`);
  });

  test("items 8-13 (binvoice S2-M5 findings) have exactly 2 external (PayPal string facts)", () => {
    const binvoiceItems = items.slice(7); // items 8-13 (0-indexed: 7-12)
    assert.strictEqual(binvoiceItems.length, 6, "Expected exactly 6 binvoice items");
    const externalCount = binvoiceItems.filter((item) => classify(item.gap).class === "external").length;
    assert.strictEqual(
      externalCount, 2,
      `Binvoice items must have exactly 2 external (PayPal OAuth + invoice-TOTAL), got ${externalCount}`,
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

  test("held-out corpus fixture has exactly 21 items (19 M89 + 2 M90 temporal-override)", () => {
    assert.strictEqual(items.length, 21, `Expected 21 held-out items, got ${items.length}`);
  });

  // v1.3.3 FINAL rule: the mechanical classifier returns `internal` ONLY when there is ZERO
  // strong-external signal. NOTHING overrides a strong external signal — not an anchor, NOT
  // a concrete repo path. A claim can carry BOTH a real repo path AND a real external-API
  // subject at once ("wire the Stripe OAuth refresh into gsd-t-execute.workflow.js"), so any
  // "wins outright → internal" override re-opens the silent miss. This is the structural close.
  test("strong-external + ANYTHING (anchor OR path) → AMBIGUOUS; internal only with zero strong-external", () => {
    // anchor + strong external → ambiguous
    assert.strictEqual(classify(items.find((i) => i.id === "HO-E8").gap).class, "ambiguous"); // 'exit code' + Stripe API
    assert.strictEqual(classify(items.find((i) => i.id === "HO-E9").gap).class, "ambiguous"); // 'who owns' + Auth0 OAuth
    // PATH + strong external → ambiguous (the cycle-6 closer — a path does NOT override)
    assert.strictEqual(classify(items.find((i) => i.id === "HO-I8").gap).class, "ambiguous"); // path + Stripe
    assert.strictEqual(classify(items.find((i) => i.id === "HO-E10").gap).class, "ambiguous"); // path + Stripe OAuth
    assert.strictEqual(classify(items.find((i) => i.id === "HO-E11").gap).class, "ambiguous"); // bin/handler.js + Stripe API
    assert.strictEqual(
      classify("Wire the Stripe OAuth token refresh into templates/workflows/gsd-t-execute.workflow.js").class,
      "ambiguous",
      "a repo path does NOT override a strong external signal — both subjects present → ambiguous → research",
    );
    // internal ONLY when zero strong-external: same anchor/path with an INTERNAL subject.
    assert.strictEqual(classify("what exit code does cli-preflight use on a wrong branch?").class, "internal");
    assert.strictEqual(classify("which domain owns templates/workflows/gsd-t-verify.workflow.js?").class, "internal");
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

  test("held-out corpus covers all 3 result classes (internal, external, AND ambiguous)", () => {
    const externalCount = items.filter((i) => i.expectedClass === "external").length;
    const internalCount = items.filter((i) => i.expectedClass === "internal").length;
    const ambiguousCount = items.filter((i) => i.expectedClass === "ambiguous").length;
    assert.ok(externalCount >= 1, `Expected ≥1 confident-external held-out item, got ${externalCount}`);
    assert.ok(internalCount >= 1, `Expected ≥1 confident-internal held-out item, got ${internalCount}`);
    assert.ok(
      ambiguousCount >= 1,
      `Expected ≥1 AMBIGUOUS held-out item — the premise-correction class that proves the classifier ` +
        `does NOT guess a paraphrase's semantic class, got ${ambiguousCount}`,
    );
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
  // HO-E4 USED to be forced external by a hand-fit "external-assertion" regex (a belief).
  // Under v1.3.0 it has NO string fact (no vendor proper noun) → it MUST be AMBIGUOUS and
  // reach the LLM judge. The silent-miss to internal is impossible because ambiguous never
  // routes silently-internal — the wiring researches an ambiguous claim the LLM can't
  // confidently place internal (uncertain → verify).
  test("HO-E4 (proper-noun-LESS assertion) → AMBIGUOUS (not a regex guess; goes to the LLM judge)", () => {
    const hoE4 = items.find((i) => i.id === "HO-E4");
    assert.ok(hoE4, "HO-E4 item not found in held-out corpus");
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
      "ambiguous",
      `HO-E4 (proper-noun-less assertion) MUST be AMBIGUOUS — regex must NOT BELIEVE a paraphrase ` +
        `is external (that guess was the sin M89 prevents). got "${result.class}"\n  reason: "${result.reason}"`,
    );
    assert.strictEqual(result.route, "judge", "HO-E4 must route to the LLM judge");
    // Critically: it is NEVER silently internal (the silent-miss the directive forbids).
    assert.notStrictEqual(result.class, "internal", "an unverified external assertion must NEVER be silently internal");
  });

  test("HO-I4 (bare camelCase symbol, no anchor/path) → AMBIGUOUS (shape is not a string fact)", () => {
    const hoI4 = items.find((i) => i.id === "HO-I4");
    assert.ok(hoI4, "HO-I4 item not found in held-out corpus");
    const result = classify(hoI4.gap);
    assert.strictEqual(
      result.class,
      "ambiguous",
      `HO-I4 (bare camelCase symbol) MUST be AMBIGUOUS — a camelCase shape is identical to an ` +
        `external symbol, so it is NOT a string fact; the LLM judge + grep place it. got "${result.class}"\n` +
        `  reason: "${result.reason}"`,
    );
    assert.strictEqual(result.route, "judge", "HO-I4 must route to the LLM judge");
  });

  // A bare internal anchor wins over a co-occurring API term (string fact precedence):
  // "rate limit our internal API gateway" is about THIS repo → internal, NOT external.
  test("internal anchor precedence: 'rate limit OUR INTERNAL gateway' → internal (string-fact anchor wins)", () => {
    const rInternal = classify("What is the rate limit our internal API gateway enforces per tenant?");
    assert.strictEqual(
      rInternal.class, "internal",
      `An 'our internal' anchored claim must be internal (anchor is a string fact), got "${rInternal.class}"\n  reason: "${rInternal.reason}"`,
    );
    assert.strictEqual(rInternal.route, "grep", "Internal-anchored claim must route to grep");
  });

  // v1.3.0 discriminators — the 3-result string-fact filter, asserted by RULE.
  test("confident external: vendor proper-noun + API term → external (string fact)", () => {
    assert.strictEqual(classify("How does Stripe construct the webhook signature header?").class, "external");
    assert.strictEqual(classify("What is the Chrome extension storage.local quota api limit?").class, "external");
    // Genuine repo anchors still pull internal regardless of the question word.
    assert.strictEqual(classify("How does the existing gsd-t-traceability-gate.cjs enumerate tasks?").class, "internal");
  });

  test("vendor proper-noun WITHOUT an API-term co-signal → AMBIGUOUS (one signal is not a string fact)", () => {
    // proper noun + bare symbol, no api term → ambiguous (the LLM judge decides → research)
    assert.strictEqual(classify("react useState returns a stateful value").class, "ambiguous");
    assert.strictEqual(classify("the stripe createCharge call returns a chargeId field").class, "ambiguous");
    // bare symbol, NO signal at all → ambiguous (shape is not a string fact)
    assert.strictEqual(classify("parseConfig clamps the model").class, "ambiguous");
    // PATH-shaped string fact → internal even with a vendor name present
    assert.strictEqual(classify("how does gsd-t-verify.workflow.js call Stripe?").class, "internal");
  });

  test("single-word homographs (square/edge) are NOT proper nouns → AMBIGUOUS, never external", () => {
    // homographs were DELETED from the proper-noun list → no string fact → ambiguous
    assert.strictEqual(classify("we square the input value before hashing").class, "ambiguous");
    assert.strictEqual(classify("the function bails at the edge case").class, "ambiguous");
    // but a real vendor + api term is a string fact → external
    assert.strictEqual(classify("the stripe api rejects negative amounts").class, "external");
    assert.strictEqual(classify("deploy to cloudflare via the workers api").class, "external");
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

// ---------------------------------------------------------------------------
// M90 D3 — R-FACT-0 BASELINE (D3-T0): premise grounding against CURRENT code
// ---------------------------------------------------------------------------
//
// The Unproven-Assumption Doctrine in action: BEFORE any edit, a baseline test
// runs the CURRENT classifier against ≥10 never-seen / freshly-invented external
// references and asserts NONE route silently-internal. This grounds the partition
// premise (the vendor list causes "silent-miss" routing) on disk.
//
// PREMISE RESULT: FALSE. All 12 unseen vendors route `ambiguous→judge`; NONE
// route silently-internal. The vendor list ONLY upgrades a vendor+API match to
// high-confidence `external→web`; its ABSENCE never routes internal. M89 already
// removed ALL "wins-outright→internal" overrides (auto-research-contract v1.3.3).
// Therefore R-FACT-1 is a documented no-op/tightening with corrected rationale,
// NOT a deletion.
//
// SC-NO-FINITE-LIST (premise-corrected): the layer must enumerate no OPEN category
// for the INTERNAL decision — already true and proven by this baseline.

describe("M90 D3 — R-FACT-0 BASELINE: ≥10 unseen vendors → none silently-internal (D3-T0)", () => {
  // These vendors are NOT in EXTERNAL_VENDOR_NOUNS. Their ABSENCE from the list
  // must NOT cause silent-internal routing. This is the premise test.
  const UNSEEN_VENDOR_GAPS = [
    // Real vendors not in the list
    { id: "UV-1", gap: "What is the GitHub API rate limit per hour for authenticated requests?", vendor: "GitHub" },
    { id: "UV-2", gap: "How does Slack webhook deliver events to my endpoint?", vendor: "Slack" },
    { id: "UV-3", gap: "Does OpenAI API support streaming responses via SSE?", vendor: "OpenAI" },
    { id: "UV-4", gap: "What is the Zapier webhook endpoint format for triggers?", vendor: "Zapier" },
    { id: "UV-5", gap: "What is the Notion API rate limit for workspace queries?", vendor: "Notion" },
    { id: "UV-6", gap: "How does Pagerduty webhook signature verification work?", vendor: "Pagerduty" },
    { id: "UV-7", gap: "What is the Airtable API endpoint for creating records?", vendor: "Airtable" },
    { id: "UV-8", gap: "How does Linear webhook deliver issue update events?", vendor: "Linear" },
    { id: "UV-9", gap: "What is the Asana API endpoint for creating tasks?", vendor: "Asana" },
    { id: "UV-10", gap: "What HTTP headers does Shopify webhook include for verification?", vendor: "Shopify" },
    // Freshly-invented vendor name (must never route internal)
    { id: "UV-11", gap: "What is the freshly-invented Fizzbuzzeroo API endpoint for webhooks?", vendor: "Fizzbuzzeroo" },
    { id: "UV-12", gap: "How does the Quartanoid API authenticate webhook calls?", vendor: "Quartanoid" },
  ];

  test(`baseline has ≥10 unseen vendor + API claims (got ${UNSEEN_VENDOR_GAPS.length})`, () => {
    assert.ok(
      UNSEEN_VENDOR_GAPS.length >= 10,
      `Expected ≥10 unseen vendor claims, got ${UNSEEN_VENDOR_GAPS.length}`,
    );
  });

  test("NONE of the ≥10 unseen vendors route silently-internal (premise proven FALSE)", () => {
    for (const { id, gap, vendor } of UNSEEN_VENDOR_GAPS) {
      const result = classify(gap);
      assert.ok(
        result.ok,
        `${id} (${vendor}): classify() returned {ok:false}: ${JSON.stringify(result)}`,
      );
      assert.notStrictEqual(
        result.class,
        "internal",
        `${id} (${vendor}) SILENT-MISS: routed class:"internal" — the absent vendor "${vendor}" ` +
          `must NEVER route internal (premise falsified: vendor list does not cause silent-miss; ` +
          `absent vendor → ambiguous→judge, not internal). gap: "${gap}"`,
      );
    }
  });

  test("unseen vendors route to judge (ambiguous) or web (external) — never internal", () => {
    let judgeCount = 0;
    let webCount = 0;
    for (const { id, gap } of UNSEEN_VENDOR_GAPS) {
      const result = classify(gap);
      if (result.route === "judge") judgeCount++;
      else if (result.route === "web") webCount++;
      assert.ok(
        result.route === "judge" || result.route === "web",
        `${id}: route must be "judge" or "web" for an unseen vendor, got "${result.route}"`,
      );
    }
    // Most unseen vendors should go to judge (not in the upgrade list)
    assert.ok(
      judgeCount + webCount === UNSEEN_VENDOR_GAPS.length,
      `All unseen vendors must route to judge or web, got judge=${judgeCount}, web=${webCount}`,
    );
  });

  test("R-FACT-1: vendor list role is UPGRADE (kept vendor + API → web; absent vendor → judge NOT internal)", () => {
    // Kept vendors (in EXTERNAL_VENDOR_NOUNS + an API term) still route external→web
    const kept = [
      { gap: "What is the exact name of the Stripe webhook signature-verification header?", expectedClass: "external" },
      { gap: "What is the per-origin storage-quota limit for the Chrome extension storage.local API?", expectedClass: "external" },
      { gap: "What is the Plaid API token exchange endpoint?", expectedClass: "external" },
      { gap: "How does Twilio webhook authenticate requests?", expectedClass: "external" },
    ];
    for (const { gap, expectedClass } of kept) {
      const result = classify(gap);
      assert.strictEqual(
        result.class, expectedClass,
        `Kept vendor + API term must route "${expectedClass}" (the upgrade role): "${gap}"\n  got: "${result.class}"`,
      );
      assert.strictEqual(result.route, "web", `Kept vendor + API term must route to web: "${gap}"`);
    }

    // Absent vendors with API term → ambiguous (not internal)
    for (const { id, gap } of UNSEEN_VENDOR_GAPS) {
      const result = classify(gap);
      assert.notStrictEqual(result.class, "internal",
        `${id}: absent vendor must go to ambiguous/web, not internal — vendor list absence never routes internal`);
    }
  });

  test("R-FACT-2: internal ONLY on concrete own-repo path/anchor (closed set, NEVER open category)", () => {
    // A concrete repo path → internal
    assert.strictEqual(
      classify("Which domain owns bin/gsd-t-verify-gate.cjs?").class,
      "internal",
      "Concrete repo path must classify internal",
    );
    // A this-repo anchor → internal
    assert.strictEqual(
      classify("What does gsd-t-verify-gate return in this repo when biome fails?").class,
      "internal",
      "This-repo anchor must classify internal",
    );
    // A bare claim with no anchor/path → NOT internal (never guess)
    assert.notStrictEqual(
      classify("What does the validator return when the schema is invalid?").class,
      "internal",
      "A bare claim with no anchor or path must NOT classify internal",
    );
    // An unseen vendor claim → NOT internal even with no anchor
    assert.notStrictEqual(
      classify("How does GitHub authenticate webhook requests?").class,
      "internal",
      "An unseen vendor + API claim must NOT classify internal",
    );
  });
});

// ---------------------------------------------------------------------------
// M90 D3 — R-FACT-3 TIME-ANCHORED OVERRIDE (D3-T3)
// ---------------------------------------------------------------------------
//
// A fast-moving claim (current/latest best-practice, version, deprecation, migration,
// recommended approach) → research REGARDLESS of any other signal. Temporal-collapse
// makes a cached "latest" or "current best practice" belief unreliable; the safe rule
// is always-verify. (CoVe: arXiv:2309.11495; Self-RAG: arXiv:2310.11511.)
//
// SC-NO-FINITE-LIST compliance: the INTERNAL decision still requires a POSITIVE
// own-repo signal; the mere absence of a temporal phrase never routes internal.

describe("M90 D3 — R-FACT-3 time-anchored override: fast-moving claims → research regardless of confidence", () => {
  const TEMPORAL_GAPS = [
    // "current/latest best practice" — the primary target
    {
      id: "T-1",
      gap: "What is the current best practice for JWT authentication in Node.js?",
      signal: "current best practice",
    },
    {
      id: "T-2",
      gap: "What is the latest best practice for handling OAuth token refresh?",
      signal: "latest best practice",
    },
    // Version / release signals
    {
      id: "T-3",
      gap: "What is the current version of Node.js LTS?",
      signal: "current version",
    },
    {
      id: "T-4",
      gap: "What is the latest version of TypeScript that supports this feature?",
      signal: "latest version",
    },
    {
      id: "T-5",
      gap: "What is the latest stable release of the React framework?",
      signal: "latest stable",
    },
    // Deprecation / migration
    {
      id: "T-6",
      gap: "Is Express.js deprecated in favor of something else?",
      signal: "is deprecated",
    },
    {
      id: "T-7",
      gap: "How do I migrate to the new Prisma v5 API?",
      signal: "migrate to",
    },
    // Recommended approach
    {
      id: "T-8",
      gap: "What is the recommended approach for React server components?",
      signal: "recommended approach",
    },
    {
      id: "T-9",
      gap: "What is the recommended practice for environment variable management?",
      signal: "recommended practice",
    },
    // Temporal + internal path: temporal override fires first (the recommendation is external)
    {
      id: "T-10",
      gap: "What is the current best practice for gsd-t-phase.workflow.js timeout handling?",
      signal: "current best practice",
    },
  ];

  test("each time-anchored gap routes to external/web regardless of other signals", () => {
    for (const { id, gap, signal } of TEMPORAL_GAPS) {
      const result = classify(gap);
      assert.strictEqual(
        result.ok,
        true,
        `${id}: classify() returned {ok:false}: ${JSON.stringify(result)}`,
      );
      assert.strictEqual(
        result.class,
        "external",
        `${id} (signal: "${signal}") must route class:"external" — ` +
          `temporal-signal means always-research (R-FACT-3). got "${result.class}"\n  gap: "${gap}"\n  reason: "${result.reason}"`,
      );
      assert.strictEqual(
        result.route,
        "web",
        `${id} (signal: "${signal}") must route to "web" — fast-moving claims go to research. got "${result.route}"`,
      );
    }
  });

  test("time-anchored override is deterministic: same text → same result on two runs", () => {
    const gap = TEMPORAL_GAPS[0].gap;
    const r1 = classify(gap);
    const r2 = classify(gap);
    assert.deepStrictEqual(r1, r2, "Non-deterministic: two calls on same temporal gap produced different envelopes");
  });

  test("T-10: time-anchored fires even when an internal path is ALSO present (override takes priority)", () => {
    const { gap, signal } = TEMPORAL_GAPS[9]; // 'current best practice for gsd-t-phase.workflow.js'
    const result = classify(gap);
    assert.strictEqual(
      result.class,
      "external",
      `Time-anchored signal "${signal}" must override the internal-path signal — ` +
        `the recommendation is fast-moving (external) regardless of which file will be changed. ` +
        `got "${result.class}"\n  reason: "${result.reason}"`,
    );
    assert.strictEqual(result.route, "web", "Time-anchored override routes to web even with a repo path present");
  });

  test("temporal-signal reason mentions R-FACT-3 (auditable provenance)", () => {
    const result = classify(TEMPORAL_GAPS[0].gap);
    assert.ok(
      result.reason.toLowerCase().includes("r-fact-3") || result.reason.toLowerCase().includes("temporal"),
      `Temporal-override reason must mention R-FACT-3 or 'temporal' for auditability. got: "${result.reason}"`,
    );
  });

  test("non-temporal internal gap is NOT affected by temporal override (no false-positive)", () => {
    // Internal claims WITHOUT temporal phrases must still route internal
    assert.strictEqual(
      classify("Which domain in this repo owns bin/gsd-t-wave.workflow.js?").class,
      "internal",
      "A non-temporal internal gap must not be falsely triggered by the temporal override",
    );
    assert.strictEqual(
      classify("What exit code does cli-preflight use on a wrong branch?").class,
      "internal",
      "A non-temporal internal anchor gap must still route internal",
    );
    // Bare 'our best practice' (internal anchor, no temporal qualifier) → internal
    assert.strictEqual(
      classify("What is our best practice for naming domains in this repo?").class,
      "internal",
      "A bare 'our best practice' with an internal anchor routes internal (not a temporal-signal phrase)",
    );
  });

  test("temporal + unseen vendor: temporal override fires first (double-verify route)", () => {
    // A claim that has BOTH a temporal signal AND an unseen vendor — temporal wins
    const gap = "What is the latest version of the GitHub API?";
    const result = classify(gap);
    assert.strictEqual(
      result.class,
      "external",
      `Temporal signal must fire even with an unseen vendor present. got "${result.class}"`,
    );
    assert.strictEqual(result.route, "web");
  });
});

// ---------------------------------------------------------------------------
// M90 D3 — R-FACT-4: §7 fail-closed cite gate PRESERVED (D3-T4)
// ---------------------------------------------------------------------------
//
// The M89 §7 cite gate writes an uncited marker at classify time for external claims.
// D3 must not break the classifier's output that triggers the marker. This section
// asserts the external class + route are still produced for the same claim types
// that triggered the marker in M89 (verify gate reads these fields).

describe("M90 D3 — R-FACT-4: §7 fail-closed cite gate preserved (D3-T4)", () => {
  test("external claim envelope still has class:external + route:web (§7 marker trigger preserved)", () => {
    // The §7 cite gate is triggered by class:"external" in the wiring. As long as
    // external claims still produce class:"external" + route:"web", the marker write
    // in the wiring fires identically. This test asserts the classifier side is intact.
    const externalClaims = [
      "What is the exact endpoint path for the PayPal OAuth /v1/oauth2/token token-mint call?",
      "What is the maximum total amount allowed on a single PayPal v2 invoice before the API returns an error?",
      "What is the exact name of the Stripe webhook signature-verification header?",
    ];
    for (const gap of externalClaims) {
      const result = classify(gap);
      assert.ok(result.ok, `classify() must return {ok:true} for: "${gap}"`);
      assert.strictEqual(
        result.class,
        "external",
        `External claim must still classify "external" for §7 marker trigger: "${gap}"\n  got "${result.class}"`,
      );
      assert.strictEqual(
        result.route,
        "web",
        `External claim must still route "web" for §7 gate: "${gap}"`,
      );
    }
  });

  test("envelope shape unchanged vs M89 baseline ({ok,gap,class,route,reason} — no extra keys)", () => {
    // D4 (integrate domain) reads the envelope shape; it must not change.
    const result = classify("What is the Stripe webhook signature header?");
    assert.strictEqual(result.ok, true);
    const keys = Object.keys(result).sort();
    assert.deepStrictEqual(
      keys,
      ["class", "gap", "ok", "reason", "route"],
      `Envelope shape must be unchanged vs M89 baseline (D4 reads it). got keys: ${JSON.stringify(keys)}`,
    );
  });

  test("time-anchored external claims also trigger §7 gate (class:external preserved)", () => {
    // Temporal claims route external/web — the §7 marker fires for them too.
    const result = classify("What is the current best practice for JWT token signing?");
    assert.strictEqual(
      result.class,
      "external",
      "Time-anchored claim must still produce class:external for §7 marker trigger",
    );
    assert.strictEqual(result.route, "web", "Time-anchored claim must route to web");
  });

  test("internal claim does NOT trigger §7 gate (class:internal, route:grep — unchanged)", () => {
    // Internal claims must still not produce class:external — the §7 gate must NOT fire.
    const result = classify("Which domain in this repo owns the gsd-t-wave.workflow.js file?");
    assert.strictEqual(
      result.class,
      "internal",
      "Internal claim must still classify internal — §7 gate must not fire for internal claims",
    );
    assert.strictEqual(result.route, "grep", "Internal claim must still route to grep");
  });

  test("SC-FAIL-CLOSED: ambiguous claim routes to judge (not silently proceeds)", () => {
    // When research is required but inconclusive (the ambiguous path), the claim goes to
    // the judge — never silently proceeds. This asserts the fail-closed path for ambiguous.
    const result = classify(
      "The payments endpoint accepts a maximum batch size of 100 items per request.",
    );
    assert.strictEqual(
      result.class,
      "ambiguous",
      "Proper-noun-less assertion must be ambiguous (judge decides, then researches if unsure)",
    );
    assert.strictEqual(result.route, "judge", "Ambiguous claim must route to judge for R-FACT-4 fail-closed");
    assert.notStrictEqual(result.class, "internal", "Ambiguous must never be silently internal");
  });
});
