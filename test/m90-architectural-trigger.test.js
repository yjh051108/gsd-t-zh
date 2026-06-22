"use strict";

// M90-D1-T6 — THE KILLING TEST (prove-or-kill, headline)
//
// This file is the R1 prove-or-kill gate for M90's highest-risk slice:
// "Can a deterministic trigger detect an agent operating on an unproven
// architectural premise?"
//
// If THIS FILE IS RED:
//   - The trigger cannot fire deterministically (divergent→fire, convergent→silent)
//   - The milestone HALTS for R1 re-scope DOWN to factual-only
//   - The trigger is NOT wired into workflows (D4-T4 is blocked)
//   - The architectural slice of M90 does NOT ship
//
// If THIS FILE IS GREEN:
//   - The trigger is proven-or-at-minimum-passes-the-generalization-guard
//   - The frozen §2 interface is ready for D-CONTRACT (D4) to wire at integrate
//
// Tests cover (SC-ARCH-TRIGGER):
//   1. TUNED corpus (m90-arch-divergence-corpus.json) — divergent→fire, convergent→silent
//   2. HELD-OUT corpus (m90-arch-heldout-divergence.json) — generalization guard
//      (rows independently labeled, NOT used to tune threshold; a held-out miss = FAILURE)
//   3. R-ARCH-2 extend-existing-code path fires unconditionally
//   4. Response mode interface: spike/adversary-only/spike-fail/provenByAdversaryOnly
//   5. Measurement instrumentation: structured record, no self-efficacy claim
//   6. Bad input → { ok:false } + non-zero exit
//   7. Determinism: same input → byte-identical output across multiple calls
//   8. Module.exports shape verification
//   9. CLI bad-input exit behavior
//
// Run: node --test test/m90-architectural-trigger.test.js
//
// Contract: .gsd-t/contracts/m90-doctrine-mechanisms-contract.md §2 v1.0.0 PROPOSED

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { spawnSync } = require("node:child_process");

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const TRIGGER_PATH = path.resolve(__dirname, "..", "bin", "gsd-t-architectural-trigger.cjs");
const TUNED_CORPUS_PATH = path.resolve(__dirname, "fixtures", "m90-arch-divergence-corpus.json");
const HELDOUT_CORPUS_PATH = path.resolve(__dirname, "fixtures", "m90-arch-heldout-divergence.json");

// ---------------------------------------------------------------------------
// Load under test
// ---------------------------------------------------------------------------

const {
  resolve,
  triggerDivergenceSampling,
  triggerExtendExistingCode,
  resolveResponseMode,
  computeDivergenceScore,
  DIVERGENCE_THRESHOLD,
} = require(TRIGGER_PATH);

const tunedCorpus = require(TUNED_CORPUS_PATH);
const heldoutCorpus = require(HELDOUT_CORPUS_PATH);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runCLI(args, input) {
  return spawnSync(process.execPath, [TRIGGER_PATH, ...args], {
    encoding: "utf8",
    timeout: 5000,
  });
}

// ---------------------------------------------------------------------------
// §0 — Module shape verification (M90-D1-T5)
// ---------------------------------------------------------------------------

describe("Module exports — frozen §2 signature (M90-D1-T5)", () => {
  test("module.exports exposes resolve function", () => {
    assert.strictEqual(typeof resolve, "function", "resolve must be a function");
  });

  test("module.exports exposes triggerDivergenceSampling function", () => {
    assert.strictEqual(
      typeof triggerDivergenceSampling,
      "function",
      "triggerDivergenceSampling must be a function"
    );
  });

  test("module.exports exposes triggerExtendExistingCode function", () => {
    assert.strictEqual(
      typeof triggerExtendExistingCode,
      "function",
      "triggerExtendExistingCode must be a function"
    );
  });

  test("module.exports exposes resolveResponseMode function", () => {
    assert.strictEqual(
      typeof resolveResponseMode,
      "function",
      "resolveResponseMode must be a function"
    );
  });

  test("module.exports exposes computeDivergenceScore function", () => {
    assert.strictEqual(
      typeof computeDivergenceScore,
      "function",
      "computeDivergenceScore must be a function"
    );
  });

  test("DIVERGENCE_THRESHOLD is a declared numeric constant", () => {
    assert.strictEqual(typeof DIVERGENCE_THRESHOLD, "number", "DIVERGENCE_THRESHOLD must be a number");
    assert.ok(
      DIVERGENCE_THRESHOLD > 0 && DIVERGENCE_THRESHOLD <= 1,
      `DIVERGENCE_THRESHOLD must be in (0, 1], got ${DIVERGENCE_THRESHOLD}`
    );
  });
});

// ---------------------------------------------------------------------------
// §1 — TUNED corpus (M90-D1-T1, M90-D1-T6 tuned set)
// Divergent rows must fire; convergent rows must stay silent.
// KILL GATE: any mislabel fails the test.
// ---------------------------------------------------------------------------

describe("TUNED corpus — divergent→fire, convergent→silent (kill gate)", () => {
  const items = tunedCorpus.items;

  test("tuned corpus has the expected structure (6 items)", () => {
    assert.ok(Array.isArray(items), "items must be an array");
    assert.ok(items.length >= 6, `Expected ≥6 items, got ${items.length}`);
  });

  test("tuned corpus has ≥3 divergent and ≥3 convergent rows", () => {
    const divergent = items.filter((i) => i.label === "divergent");
    const convergent = items.filter((i) => i.label === "convergent");
    assert.ok(divergent.length >= 3, `Expected ≥3 divergent rows, got ${divergent.length}`);
    assert.ok(convergent.length >= 3, `Expected ≥3 convergent rows, got ${convergent.length}`);
  });

  test("every tuned item has required fields", () => {
    for (const item of items) {
      assert.ok("id" in item, `Item missing 'id': ${JSON.stringify(item)}`);
      assert.ok("label" in item, `Item ${item.id} missing 'label'`);
      assert.ok("answers" in item, `Item ${item.id} missing 'answers'`);
      assert.ok("expectedFired" in item, `Item ${item.id} missing 'expectedFired'`);
      assert.ok("labelDerivation" in item, `Item ${item.id} missing 'labelDerivation' (derivation rule required)`);
      assert.ok(Array.isArray(item.answers), `Item ${item.id}: answers must be an array`);
      assert.ok(item.answers.length >= 2, `Item ${item.id}: must have ≥2 answers, got ${item.answers.length}`);
      assert.ok(
        ["divergent", "convergent"].includes(item.label),
        `Item ${item.id}: label must be 'divergent' or 'convergent', got '${item.label}'`
      );
    }
  });

  // Per-item kill gate: every item must match its label
  test("KILL GATE: every tuned corpus item classified correctly (divergent→fire, convergent→silent)", () => {
    for (const item of items) {
      const result = resolve({
        type: "divergence-sampling",
        answers: item.answers,
        basis: item.id + " test basis",
      });
      assert.strictEqual(
        result.ok,
        true,
        `Item ${item.id}: resolve() returned {ok:false}: ${JSON.stringify(result)}`
      );
      assert.strictEqual(
        result.fired,
        item.expectedFired,
        `Item ${item.id} MISLABELED (KILL GATE FAILURE): ` +
        `fired=${result.fired} but expectedFired=${item.expectedFired}\n` +
        `  label: '${item.label}'\n` +
        `  reason: '${result.reason}'\n` +
        `  divergenceScore: ${result.divergenceScore}\n` +
        `  labelDerivation: '${item.labelDerivation}'\n` +
        `  If this is RED: the trigger cannot be made deterministically correct → R1 re-scope DOWN`
      );
    }
  });

  // Aggregate invariants (belt-and-suspenders)
  test("all divergent-labeled tuned rows fire (none stays silent)", () => {
    const divergent = items.filter((i) => i.label === "divergent");
    for (const item of divergent) {
      const result = resolve({
        type: "divergence-sampling",
        answers: item.answers,
        basis: item.id + " divergent basis",
      });
      assert.ok(result.ok, `Item ${item.id}: ok:false on divergent`);
      assert.ok(result.fired, `Divergent item ${item.id} must fire`);
    }
  });

  test("all convergent-labeled tuned rows stay silent (no false-positive)", () => {
    const convergent = items.filter((i) => i.label === "convergent");
    for (const item of convergent) {
      const result = resolve({
        type: "divergence-sampling",
        answers: item.answers,
        basis: item.id + " convergent basis",
      });
      assert.ok(result.ok, `Item ${item.id}: ok:false on convergent`);
      assert.ok(!result.fired, `Convergent item ${item.id} must NOT fire (false-positive guard)`);
    }
  });
});

// ---------------------------------------------------------------------------
// §2 — HELD-OUT corpus (M90-D1-T6 — the generalization guard)
// Independently-labeled rows NOT used to tune DIVERGENCE_THRESHOLD.
// A held-out miss = test FAILURE (the trigger does not generalize).
// ---------------------------------------------------------------------------

describe("HELD-OUT corpus — generalization guard (independently labeled, not threshold-tuned)", () => {
  const items = heldoutCorpus.items;

  test("held-out corpus has ≥3 divergent and ≥3 convergent rows (per task requirements)", () => {
    const divergent = items.filter((i) => i.label === "divergent");
    const convergent = items.filter((i) => i.label === "convergent");
    assert.ok(divergent.length >= 3, `Held-out: expected ≥3 divergent rows, got ${divergent.length}`);
    assert.ok(convergent.length >= 3, `Held-out: expected ≥3 convergent rows, got ${convergent.length}`);
  });

  test("held-out corpus fixture documents derivation + NOT-TUNED note", () => {
    // The fixture's _comment must document the independent labeling
    assert.ok(
      typeof heldoutCorpus._comment === "string" && heldoutCorpus._comment.length > 20,
      "Held-out fixture must have a _comment documenting the labeling derivation"
    );
    assert.ok(
      heldoutCorpus.note && heldoutCorpus.note.includes("NOT"),
      "Held-out fixture must have a 'note' field stating it was NOT used to tune the threshold"
    );
    // Every item must have its own labelDerivation
    for (const item of items) {
      assert.ok(
        typeof item.labelDerivation === "string" && item.labelDerivation.length > 10,
        `Held-out item ${item.id} must have 'labelDerivation' documenting the independent label source`
      );
    }
  });

  // Per-item generalization kill gate
  test("GENERALIZATION KILL GATE: every held-out item classified correctly (a miss = trigger does not generalize → R1 re-scope DOWN)", () => {
    for (const item of items) {
      const result = resolve({
        type: "divergence-sampling",
        answers: item.answers,
        basis: item.id + " held-out basis",
      });
      assert.strictEqual(
        result.ok,
        true,
        `Held-out item ${item.id}: resolve() returned {ok:false}: ${JSON.stringify(result)}`
      );
      assert.strictEqual(
        result.fired,
        item.expectedFired,
        `Held-out item ${item.id} MISLABELED — GENERALIZATION FAILURE (KILL GATE): ` +
        `fired=${result.fired} but expectedFired=${item.expectedFired}\n` +
        `  label: '${item.label}'\n` +
        `  divergenceScore: ${result.divergenceScore}\n` +
        `  labelDerivation: '${item.labelDerivation}'\n` +
        `  CONSEQUENCE: trigger passes tuned set but fails held-out → tautology trap → R1 re-scope DOWN`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// §3 — R-ARCH-2: extend-existing-code path (M90-D1-T2)
// Protocol class fires UNCONDITIONALLY — no threshold gate.
// Reason string is DISTINCT from R-ARCH-1 divergence reason.
// ---------------------------------------------------------------------------

describe("R-ARCH-2 extend-existing-code protocol-class path (M90-D1-T2)", () => {
  test("extend-existing-code input fires unconditionally (protocol, not confidence-gated)", () => {
    const result = resolve({
      type: "extend-existing-code",
      context: "editing existing bin/gsd-t-research-gate.cjs classifier module",
      basis: "the existing classifier's approach is correct and can be extended",
    });
    assert.strictEqual(result.ok, true, `ok:false: ${JSON.stringify(result)}`);
    assert.strictEqual(
      result.fired,
      true,
      "extend-existing-code must ALWAYS fire (R-ARCH-2: protocol, not threshold)"
    );
  });

  test("extend-existing-code reason is DISTINCT from divergence-sampling reason (R-ARCH-2 distinguishability)", () => {
    const extResult = resolve({
      type: "extend-existing-code",
      context: "modifying gsd-t-verify-gate.cjs",
      basis: "existing verify logic is correct",
    });
    const divResult = resolve({
      type: "divergence-sampling",
      answers: [
        "Use a mutex lock to serialize access. Acquire the mutex before each write and release after completion.",
        "Route all writes through an async queue. Enqueue each write and process sequentially from the queue head.",
        "Apply optimistic locking with a version field. Each write reads the current version and rejects if it changed.",
      ],
      basis: "concurrent write handling approach",
    });
    assert.notStrictEqual(
      extResult.reason,
      divResult.reason,
      `extend-existing-code reason "${extResult.reason}" must be DISTINCT from divergence reason "${divResult.reason}"`
    );
    assert.strictEqual(
      extResult.reason,
      "protocol-class:extend-existing",
      `extend-existing-code reason must be the literal "protocol-class:extend-existing", got "${extResult.reason}"`
    );
  });

  test("extend-existing-code from a saga retro case (seeded from M89 loop saga, per task acceptance criteria)", () => {
    // The M89 loop saga: extending the M89 classifier each verify cycle
    const result = resolve({
      type: "extend-existing-code",
      context:
        "M89 verify cycle 5: adding another regex pattern to gsd-t-research-gate.cjs to catch a new paraphrase class the existing regex missed",
      basis:
        "the existing regex-based classifier approach is correct — we just need to add more patterns for the cases it misses",
    });
    assert.ok(result.ok, `ok:false: ${JSON.stringify(result)}`);
    assert.ok(result.fired, "Must fire on this M89 saga extend-existing-code case");
    assert.strictEqual(result.reason, "protocol-class:extend-existing");
    assert.ok(result.firePath === "protocol-class", `firePath must be 'protocol-class', got '${result.firePath}'`);
  });

  test("extend-existing-code from the binvoice saga (seeded from binvoice FB-modal, per task acceptance criteria)", () => {
    // The binvoice FB-modal saga: each cycle extended the previous fix
    const result = resolve({
      type: "extend-existing-code",
      context:
        "binvoice debug cycle 4: adding a touchstart listener workaround on top of the z-index fix that was applied in cycle 1",
      basis:
        "the WebView rendering approach is fundamentally correct — each fix builds on the previous to handle more iOS edge cases",
    });
    assert.ok(result.ok, `ok:false: ${JSON.stringify(result)}`);
    assert.ok(result.fired, "Must fire on binvoice saga extend-existing-code case");
    assert.strictEqual(result.reason, "protocol-class:extend-existing");
  });
});

// ---------------------------------------------------------------------------
// §4 — Response interface (R-ARCH-3..6) (M90-D1-T3)
// ---------------------------------------------------------------------------

describe("Response interface — spike/adversary-only/stop/provenByAdversaryOnly (M90-D1-T3)", () => {
  test("default response mode is spike (R-ARCH-3: spike PREFERRED)", () => {
    const result = resolve({
      type: "extend-existing-code",
      context: "some existing code",
      basis: "some basis",
    });
    assert.ok(result.ok, `ok:false: ${JSON.stringify(result)}`);
    assert.strictEqual(
      result.mode,
      "spike",
      `Default response mode must be 'spike' (preferred), got '${result.mode}'`
    );
  });

  test("resolveResponseMode with no args returns mode:spike", () => {
    const rm = resolveResponseMode();
    assert.strictEqual(rm.mode, "spike", `Expected mode:'spike', got '${rm.mode}'`);
    assert.strictEqual(rm.adversaryMandatory, false);
    assert.strictEqual(rm.stopDirective, false);
  });

  test("spike-infeasible → mode:adversary-only + adversaryMandatory:true + provenByAdversaryOnly:true (R-ARCH-5)", () => {
    const result = resolve({
      type: "extend-existing-code",
      context: "third-party PayPal API behavior",
      basis: "PayPal invoice total rounding behaves as documented",
      responseOpts: { spikeFeasible: false },
    });
    assert.ok(result.ok, `ok:false: ${JSON.stringify(result)}`);
    assert.strictEqual(result.mode, "adversary-only", `Expected 'adversary-only', got '${result.mode}'`);
    assert.strictEqual(result.adversaryMandatory, true, "adversaryMandatory must be true when spike infeasible");
    assert.strictEqual(result.provenByAdversaryOnly, true, "provenByAdversaryOnly must be true when spike infeasible");
    assert.ok(
      typeof result.spikeSkipReason === "string" && result.spikeSkipReason.length > 0,
      "spikeSkipReason must be a non-empty string when spike infeasible (logged skip, never silent)"
    );
  });

  test("spike-fail → stopDirective:true (R-ARCH-4: spike fails → STOP)", () => {
    const result = resolve({
      type: "extend-existing-code",
      context: "approach being tested",
      basis: "premise X is true",
      responseOpts: { spikeFeasible: true, spikePassed: false },
    });
    assert.ok(result.ok, `ok:false: ${JSON.stringify(result)}`);
    assert.strictEqual(
      result.stopDirective,
      true,
      "spike-fail must produce stopDirective:true (R-ARCH-4: agent cannot proceed)"
    );
    assert.ok(
      typeof result.stopReason === "string" && result.stopReason.length > 0,
      "stopReason must be present when stopDirective:true"
    );
  });

  test("provenByAdversaryOnly:true surfaces a verify flag when spike infeasible (R-ARCH-6)", () => {
    const rm = resolveResponseMode({ spikeFeasible: false });
    assert.strictEqual(
      rm.provenByAdversaryOnly,
      true,
      "provenByAdversaryOnly must be true when spike is infeasible (R-ARCH-6 verify flag)"
    );
    // The verify gate reads this flag — assert it is present in the envelope
    const result = resolve({
      type: "extend-existing-code",
      context: "runtime behavior",
      basis: "some runtime behavior premise",
      responseOpts: { spikeFeasible: false },
    });
    assert.ok("provenByAdversaryOnly" in result, "provenByAdversaryOnly must be in the trigger envelope");
    assert.strictEqual(result.provenByAdversaryOnly, true);
  });

  test("spike-passed → mode:spike, adversaryMandatory:false (happy path)", () => {
    const rm = resolveResponseMode({ spikeFeasible: true, spikePassed: true });
    assert.strictEqual(rm.mode, "spike");
    assert.strictEqual(rm.adversaryMandatory, false);
    assert.strictEqual(rm.provenByAdversaryOnly, false);
    assert.strictEqual(rm.stopDirective, false);
  });
});

// ---------------------------------------------------------------------------
// §5 — Measurement instrumentation (M90-D1-T4)
// Every fire emits a structured record; no self-efficacy claim in envelope.
// ---------------------------------------------------------------------------

describe("Measurement instrumentation — fire emits record, no self-efficacy claim (M90-D1-T4)", () => {
  test("divergence-sampling envelope does NOT contain a self-efficacy claim field", () => {
    const result = resolve({
      type: "divergence-sampling",
      answers: [
        "Use a mutex lock to serialize access. Acquire the mutex before each write.",
        "Route all writes through a queue. Enqueue each write and process sequentially.",
        "Apply optimistic locking with a version field. Each write checks the version.",
      ],
      basis: "concurrency approach",
    });
    assert.ok(result.ok, `ok:false: ${JSON.stringify(result)}`);
    // Envelope must NOT have self-efficacy claim fields
    const FORBIDDEN_FIELDS = ["works", "reliable", "proven", "validated", "accurate", "correct"];
    for (const field of FORBIDDEN_FIELDS) {
      assert.ok(
        !(field in result),
        `Envelope MUST NOT contain self-efficacy field '${field}' — the trigger emits data, not a verdict (no-claim invariant)`
      );
    }
  });

  test("extend-existing-code envelope does NOT contain self-efficacy claim", () => {
    const result = resolve({
      type: "extend-existing-code",
      context: "some existing code",
      basis: "some premise",
    });
    assert.ok(result.ok, `ok:false: ${JSON.stringify(result)}`);
    const FORBIDDEN_FIELDS = ["works", "reliable", "proven", "validated", "accurate", "correct"];
    for (const field of FORBIDDEN_FIELDS) {
      assert.ok(
        !(field in result),
        `Envelope MUST NOT contain self-efficacy field '${field}'`
      );
    }
  });

  test("divergence-sampling fired envelope exposes divergenceScore (instrumentation data field)", () => {
    const divergentAnswers = [
      "Use a mutex lock to serialize access. Acquire the mutex before each write operation.",
      "Route all writes through an async queue. Enqueue each write and process sequentially.",
      "Apply optimistic locking with a version field. Reject the write if the version changed.",
    ];
    const result = resolve({
      type: "divergence-sampling",
      answers: divergentAnswers,
      basis: "concurrency mechanism",
    });
    assert.ok(result.ok, `ok:false: ${JSON.stringify(result)}`);
    assert.ok(
      typeof result.divergenceScore === "number",
      "Fired envelope must contain divergenceScore (instrumentation data, not a claim)"
    );
    assert.ok(
      result.divergenceScore >= 0 && result.divergenceScore <= 1,
      `divergenceScore must be in [0, 1], got ${result.divergenceScore}`
    );
  });

  test("divergence-sampling envelope contains experimental:true flag (NEVER omitted — this path is experimental+measured)", () => {
    const result = resolve({
      type: "divergence-sampling",
      answers: ["Answer one with unique technical terms alpha beta gamma.", "Answer two with different vocabulary delta epsilon zeta."],
      basis: "some approach",
    });
    assert.ok(result.ok, `ok:false: ${JSON.stringify(result)}`);
    assert.strictEqual(
      result.experimental,
      true,
      "divergence-sampling envelope MUST contain experimental:true (the R-ARCH-1 path is experimental+measured)"
    );
  });

  test("REGRESSION (Red Team CRITICAL): provenByAdversaryOnly is PERSISTED to the sink the R-FAIL-2 verify gate scans", () => {
    // The verify R-FAIL-2 gate scans .gsd-t/metrics/arch-trigger-events.jsonl for
    // provenByAdversaryOnly===true. If the producer never writes that field, the gate count is
    // always 0 → the §4 fail-closed gate is vacuous (can never fire) — the exact hollow-gate
    // failure M90 exists to prevent. This proves the field reaches the sink.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m90-arch-sink-"));
    const prevCwd = process.cwd();
    try {
      process.chdir(dir);
      // extend-existing-code with spikeFeasible:false → resolveResponseMode sets
      // provenByAdversaryOnly:true (R-ARCH-5). It MUST land in the persisted record.
      const result = resolve({
        type: "extend-existing-code",
        context: "extending bin/foo.js",
        basis: "the existing parser is fine, just patch it",
        responseOpts: { spikeFeasible: false },
      });
      assert.ok(result.ok, `ok:false: ${JSON.stringify(result)}`);
      assert.strictEqual(result.provenByAdversaryOnly, true, "envelope flag (sanity)");

      const sink = path.join(dir, ".gsd-t", "metrics", "arch-trigger-events.jsonl");
      assert.ok(fs.existsSync(sink), "instrumentation sink must be written");
      const records = fs.readFileSync(sink, "utf8").trim().split(/\r?\n/).map((l) => JSON.parse(l));
      const last = records[records.length - 1];
      assert.ok("provenByAdversaryOnly" in last, "PERSISTED record MUST carry provenByAdversaryOnly (R-FAIL-2 scans for it)");
      assert.strictEqual(last.provenByAdversaryOnly, true, "the persisted flag must be true so the gate can actually fire");
      assert.ok("mode" in last, "persisted record carries mode");
    } finally {
      process.chdir(prevCwd);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// §6 — Determinism (same input → byte-identical output) (M90-D1-T1 acceptance)
// ---------------------------------------------------------------------------

describe("Determinism — identical input → byte-identical envelope (no clock/random/order dependence)", () => {
  test("divergence-sampling same input → same output on repeated calls", () => {
    const input = {
      type: "divergence-sampling",
      answers: [
        "Use a mutex lock to serialize all write access to the shared state.",
        "Route all mutations through a single async message queue for serialization.",
        "Apply optimistic locking with a version counter on each shared resource.",
      ],
      basis: "concurrency control mechanism",
    };
    const r1 = resolve(input);
    const r2 = resolve(input);
    const r3 = resolve(input);
    assert.strictEqual(
      JSON.stringify(r1),
      JSON.stringify(r2),
      "First and second calls produced different envelopes (non-deterministic!)"
    );
    assert.strictEqual(
      JSON.stringify(r2),
      JSON.stringify(r3),
      "Second and third calls produced different envelopes (non-deterministic!)"
    );
  });

  test("extend-existing-code same input → same output on repeated calls", () => {
    const input = {
      type: "extend-existing-code",
      context: "editing gsd-t-research-gate.cjs",
      basis: "the existing classifier approach",
    };
    const r1 = resolve(input);
    const r2 = resolve(input);
    assert.strictEqual(
      JSON.stringify(r1),
      JSON.stringify(r2),
      "extend-existing-code produced different envelopes on repeated calls (non-deterministic!)"
    );
  });

  test("computeDivergenceScore same answers → same score on repeated calls", () => {
    const answers = [
      "Use a mutex lock to serialize access. Acquire the mutex before each write.",
      "Route all writes through a queue. Enqueue each write and process sequentially.",
      "Apply optimistic locking with a version field. Each write checks the version.",
    ];
    const s1 = computeDivergenceScore(answers);
    const s2 = computeDivergenceScore(answers);
    const s3 = computeDivergenceScore(answers);
    assert.strictEqual(s1, s2, "computeDivergenceScore not deterministic (s1 !== s2)");
    assert.strictEqual(s2, s3, "computeDivergenceScore not deterministic (s2 !== s3)");
  });
});

// ---------------------------------------------------------------------------
// §7 — Bad input → { ok:false, error } + non-zero exit (M90-D1-T5)
// ---------------------------------------------------------------------------

describe("Bad input handling — { ok:false, error } + non-zero CLI exit (M90-D1-T5)", () => {
  test("resolve(null) → { ok:false, error }", () => {
    const r = resolve(null);
    assert.strictEqual(r.ok, false, "null input must return ok:false");
    assert.ok(typeof r.error === "string" && r.error.length > 0, "Must have error message");
  });

  test("resolve(undefined) → { ok:false, error }", () => {
    const r = resolve(undefined);
    assert.strictEqual(r.ok, false);
    assert.ok(typeof r.error === "string");
  });

  test("resolve('string') → { ok:false, error } (non-object input)", () => {
    const r = resolve("string input");
    assert.strictEqual(r.ok, false);
    assert.ok(typeof r.error === "string");
  });

  test("resolve([]) → { ok:false, error } (array input)", () => {
    const r = resolve([]);
    assert.strictEqual(r.ok, false);
    assert.ok(typeof r.error === "string");
  });

  test("resolve({ type: 'divergence-sampling' }) with no answers → { ok:false, error }", () => {
    const r = resolve({ type: "divergence-sampling", basis: "test" });
    assert.strictEqual(r.ok, false, "Missing answers must return ok:false");
    assert.ok(typeof r.error === "string");
  });

  test("resolve({ type: 'divergence-sampling', answers: [] }) with N<2 → { ok:false, error }", () => {
    const r = resolve({ type: "divergence-sampling", answers: [], basis: "test" });
    assert.strictEqual(r.ok, false, "Empty answers array must return ok:false");
    assert.ok(typeof r.error === "string");
  });

  test("resolve({ type: 'divergence-sampling', answers: ['one'] }) N=1 < MIN_ANSWERS → { ok:false, error }", () => {
    const r = resolve({ type: "divergence-sampling", answers: ["only one answer"], basis: "test" });
    assert.strictEqual(r.ok, false, "N=1 must return ok:false (MIN_ANSWERS=2)");
    assert.ok(typeof r.error === "string");
  });

  test("resolve with empty basis → { ok:false, error }", () => {
    const r = resolve({ type: "divergence-sampling", answers: ["a", "b"], basis: "" });
    assert.strictEqual(r.ok, false, "Empty basis must return ok:false");
    assert.ok(typeof r.error === "string");
  });

  test("resolve with whitespace-only basis → { ok:false, error }", () => {
    const r = resolve({ type: "divergence-sampling", answers: ["a", "b"], basis: "   " });
    assert.strictEqual(r.ok, false, "Whitespace-only basis must return ok:false");
    assert.ok(typeof r.error === "string");
  });

  test("resolve with unknown type → { ok:false, error }", () => {
    const r = resolve({ type: "unknown-type", answers: ["a", "b"], basis: "test" });
    assert.strictEqual(r.ok, false, "Unknown type must return ok:false");
    assert.ok(typeof r.error === "string");
  });

  test("resolve with missing type → { ok:false, error }", () => {
    const r = resolve({ answers: ["a", "b"], basis: "test" });
    assert.strictEqual(r.ok, false, "Missing type must return ok:false");
    assert.ok(typeof r.error === "string");
  });

  test("resolve extend-existing-code with empty context → { ok:false, error }", () => {
    const r = resolve({ type: "extend-existing-code", context: "", basis: "test" });
    assert.strictEqual(r.ok, false, "Empty context must return ok:false");
    assert.ok(typeof r.error === "string");
  });

  test("resolve extend-existing-code with missing context → { ok:false, error }", () => {
    const r = resolve({ type: "extend-existing-code", basis: "test" });
    assert.strictEqual(r.ok, false, "Missing context must return ok:false");
    assert.ok(typeof r.error === "string");
  });

  test("resolve does not THROW on any bad input (returns {ok:false} instead)", () => {
    const badInputs = [null, undefined, "", "  ", 0, false, [], ["a"], { type: "" }];
    for (const input of badInputs) {
      assert.doesNotThrow(() => {
        const r = resolve(input);
        assert.strictEqual(r.ok, false, `Expected ok:false for input: ${JSON.stringify(input)}`);
      }, `resolve() must not throw on bad input: ${JSON.stringify(input)}`);
    }
  });
});

// ---------------------------------------------------------------------------
// §8 — CLI subcommand (M90-D1-T5)
// ---------------------------------------------------------------------------

describe("CLI subcommand — bad input → {ok:false} + non-zero exit (M90-D1-T5)", () => {
  test("CLI with no args → { ok:false } + non-zero exit", () => {
    const result = runCLI([]);
    assert.notStrictEqual(result.status, 0, "Exit code must be non-zero for missing args");
    const parsed = JSON.parse(result.stdout.trim());
    assert.strictEqual(parsed.ok, false, "Output must be {ok:false}");
    assert.ok(typeof parsed.error === "string", "Must have error message");
  });

  test("CLI with unknown subcommand → { ok:false } + non-zero exit", () => {
    const result = runCLI(["unknown"]);
    assert.notStrictEqual(result.status, 0, "Exit code must be non-zero for unknown subcommand");
    const parsed = JSON.parse(result.stdout.trim());
    assert.strictEqual(parsed.ok, false);
  });

  test("CLI trigger with no JSON arg → { ok:false } + non-zero exit", () => {
    const result = runCLI(["trigger"]);
    assert.notStrictEqual(result.status, 0, "Exit code must be non-zero for missing JSON arg");
    const parsed = JSON.parse(result.stdout.trim());
    assert.strictEqual(parsed.ok, false);
  });

  test("CLI trigger with malformed JSON → { ok:false } + non-zero exit", () => {
    const result = runCLI(["trigger", "{not valid json"]);
    assert.notStrictEqual(result.status, 0, "Exit code must be non-zero for malformed JSON");
    const parsed = JSON.parse(result.stdout.trim());
    assert.strictEqual(parsed.ok, false);
  });

  test("CLI trigger with bad input object → { ok:false } + non-zero exit", () => {
    const result = runCLI(["trigger", '{"type":"unknown"}']);
    assert.notStrictEqual(result.status, 0, "Exit code must be non-zero for bad input object");
    const parsed = JSON.parse(result.stdout.trim());
    assert.strictEqual(parsed.ok, false);
  });

  test("CLI trigger with valid extend-existing-code input → { ok:true } + exit 0", () => {
    const input = JSON.stringify({
      type: "extend-existing-code",
      context: "editing existing module",
      basis: "existing approach is correct",
    });
    const result = runCLI(["trigger", input]);
    assert.strictEqual(result.status, 0, `Expected exit 0, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout.trim());
    assert.strictEqual(parsed.ok, true);
    assert.strictEqual(parsed.fired, true);
  });
});

// ---------------------------------------------------------------------------
// §9 — Divergence score boundary conditions
// ---------------------------------------------------------------------------

describe("computeDivergenceScore — boundary conditions", () => {
  test("empty answers array → score 0 (degenerate case)", () => {
    // degenerate — the public API rejects N<2, but computeDivergenceScore is also exported
    const score = computeDivergenceScore([]);
    assert.strictEqual(score, 0, "Empty answers → score 0");
  });

  test("all-identical answers → score near 0 (maximally convergent)", () => {
    const same = "process.stdout.write JSON.stringify newline stdout output";
    const answers = [same, same, same, same, same];
    const score = computeDivergenceScore(answers);
    assert.ok(
      score < DIVERGENCE_THRESHOLD,
      `Identical answers must produce score < threshold (${DIVERGENCE_THRESHOLD}), got ${score}`
    );
  });

  test("score is always in [0, 1]", () => {
    const cases = [
      ["a b c", "d e f", "g h i"], // short, non-overlapping
      ["the the the", "a a a", "is is is"], // all stopwords
      ["process.stdout.write JSON.stringify", "process.stdout.write JSON.stringify"], // identical technical
    ];
    for (const answers of cases) {
      const score = computeDivergenceScore(answers);
      assert.ok(score >= 0 && score <= 1, `Score ${score} is outside [0, 1] for answers: ${JSON.stringify(answers)}`);
    }
  });
});
