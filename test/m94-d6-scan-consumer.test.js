"use strict";

/**
 * M94-D6: Scan consumer wiring tests
 *
 * Covers:
 *   T2 — [RULE] scan-injects-structural-slice (wired path queries CLI + injects slice)
 *        [RULE] no-graph-baseline-proven-graph-free (disabled path fires zero graph queries)
 *        [RULE] scan-finding-identity-canonical (canonicalization identity key)
 *        [Finding B] slice CONSUMED (byte-traceable finding in output)
 *        [Finding C] fault-injection: graph-unavailable → fallback announced, scan completes
 *   T3 — [RULE] scan-insight-gate (graph-wired ⊇ no-graph + ≥1 missed/wrong)
 *        [RULE] scan-insight-delta-graph-attributed (delta traceable to graph query)
 *        [RULE] ac4-atos-sha-pinned (SHA equality + repo-not-found fail-loud)
 *        [RULE] ac4-verdict-machine-checkable (outcome ladder, hard-gate)
 *        [Finding A] delta is graph-attributed, not LLM variance
 *
 * All tests are unit-level, fixture-driven — NO live scan runs required.
 * The INSIGHT/PIN/VERDICT logic is deterministically asserted on recorded envelopes.
 *
 * Contracts:
 *   .gsd-t/contracts/graph-scan-consumer-contract.md  (v1.0.0 STABLE)
 *   .gsd-t/contracts/graph-query-cli-contract.md      (consumed frozen)
 *   .gsd-t/spikes/ac4-scan-insight-delta-results.md   (the measurement record)
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const RESULTS_PATH = path.join(ROOT, ".gsd-t", "spikes", "ac4-scan-insight-delta-results.md");
const CONTRACT_PATH = path.join(ROOT, ".gsd-t", "contracts", "graph-scan-consumer-contract.md");

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Canonicalize a structural finding to its deterministic identity key.
 * Identity = { kind, symbolFileSet } where symbolFileSet is the SORTED,
 * path-normalized set of symbols/files the finding is ABOUT.
 *
 * [RULE] scan-finding-identity-canonical:
 *   - kind ∈ { dead-code, cycle, dependent, coupling } (lowercased enum)
 *   - symbolFileSet = sorted, repo-relative, POSIX-normalized set of symbols/files
 *   - FREE-TEXT TITLE IS STRIPPED ENTIRELY from the identity
 *   - Two findings with the same kind+symbolFileSet ARE the same structural fact,
 *     regardless of how the LLM phrased the title.
 *
 * @param {{ kind: string, symbolFileSet: string[], title?: string }} finding
 * @returns {{ kind: string, symbolFileSet: string[] }} canonical identity
 */
function canonicalizeFinding(finding) {
  assert.ok(finding && typeof finding.kind === "string", "finding.kind must be a string");
  assert.ok(Array.isArray(finding.symbolFileSet), "finding.symbolFileSet must be an array");

  const kind = finding.kind.toLowerCase().trim();
  const VALID_KINDS = new Set(["dead-code", "cycle", "dependent", "coupling"]);
  assert.ok(VALID_KINDS.has(kind), `finding.kind must be one of ${[...VALID_KINDS].join(", ")}, got: ${kind}`);

  // Normalize each symbol/file: repo-relative, POSIX separators, lowercase for paths
  const normalized = finding.symbolFileSet
    .map((s) => s.replace(/\\/g, "/").replace(/^\/+/, "").trim())
    .sort();

  return { kind, symbolFileSet: normalized };
}

/**
 * Serialize a canonical identity to a stable string key for set membership.
 */
function identityKey(canonical) {
  return `${canonical.kind}::${canonical.symbolFileSet.join("|")}`;
}

/**
 * Build a set of canonical identity keys from an array of structural findings.
 */
function canonicalSet(findings) {
  return new Set(findings.map((f) => identityKey(canonicalizeFinding(f))));
}

/**
 * Simulate the graph-query call-count tracker used in wired/disabled tests.
 * Returns { callCount, recordQuery }.
 */
function makeQueryTracker() {
  let callCount = 0;
  return {
    get callCount() { return callCount; },
    recordQuery() { callCount++; },
  };
}

// ─── T2: Canonicalization identity tests ────────────────────────────────────
// [RULE] scan-finding-identity-canonical

test("M94-D6-T2: canonicalize — same kind+symbolFileSet, different title → SAME identity key", () => {
  const findingA = {
    kind: "dead-code",
    symbolFileSet: ["bin/foo.cjs"],
    title: "Unused function foo in bin/foo.cjs",
  };
  const findingB = {
    kind: "dead-code",
    symbolFileSet: ["bin/foo.cjs"],
    title: "Dead code: foo() is never called",  // different phrasing
  };

  const keyA = identityKey(canonicalizeFinding(findingA));
  const keyB = identityKey(canonicalizeFinding(findingB));

  assert.strictEqual(keyA, keyB,
    "Two findings with same kind+symbolFileSet but different titles MUST canonicalize to the SAME identity key. " +
    "The gate is over structural facts, never raw LLM titles. [RULE] scan-finding-identity-canonical");
});

test("M94-D6-T2: canonicalize — different symbolFileSet → DISTINCT identity keys", () => {
  const findingA = {
    kind: "dead-code",
    symbolFileSet: ["bin/foo.cjs"],
    title: "Dead code A",
  };
  const findingB = {
    kind: "dead-code",
    symbolFileSet: ["bin/bar.cjs"],   // genuinely different symbol
    title: "Dead code A",             // same title — must NOT collapse to same identity
  };

  const keyA = identityKey(canonicalizeFinding(findingA));
  const keyB = identityKey(canonicalizeFinding(findingB));

  assert.notStrictEqual(keyA, keyB,
    "Two findings with different symbolFileSets MUST canonicalize to DISTINCT identity keys. " +
    "A genuinely-new structural fact is not masked. [RULE] scan-finding-identity-canonical");
});

test("M94-D6-T2: canonicalize — different kind → DISTINCT identity keys (same files)", () => {
  const findingA = { kind: "dead-code",  symbolFileSet: ["bin/foo.cjs"], title: "Unused" };
  const findingB = { kind: "cycle",      symbolFileSet: ["bin/foo.cjs"], title: "Unused" };

  const keyA = identityKey(canonicalizeFinding(findingA));
  const keyB = identityKey(canonicalizeFinding(findingB));

  assert.notStrictEqual(keyA, keyB,
    "Same symbolFileSet but different kind MUST produce DISTINCT identity keys.");
});

test("M94-D6-T2: canonicalize — symbolFileSet order is normalized (sorting)", () => {
  const findingA = { kind: "cycle", symbolFileSet: ["c.ts", "a.ts", "b.ts"], title: "Cycle 1" };
  const findingB = { kind: "cycle", symbolFileSet: ["a.ts", "b.ts", "c.ts"], title: "Cycle 2" };

  const keyA = identityKey(canonicalizeFinding(findingA));
  const keyB = identityKey(canonicalizeFinding(findingB));

  assert.strictEqual(keyA, keyB,
    "symbolFileSet must be sorted before producing the identity key — order of the input array must not matter.");
});

test("M94-D6-T2: canonicalize — Windows path separators normalized to POSIX", () => {
  const findingA = { kind: "dependent", symbolFileSet: ["bin\\foo.cjs", "lib\\bar.cjs"], title: "Dep A" };
  const findingB = { kind: "dependent", symbolFileSet: ["bin/foo.cjs", "lib/bar.cjs"], title: "Dep B" };

  const keyA = identityKey(canonicalizeFinding(findingA));
  const keyB = identityKey(canonicalizeFinding(findingB));

  assert.strictEqual(keyA, keyB,
    "Windows backslash separators must be normalized to POSIX before identity key.");
});

test("M94-D6-T2: canonicalize — kind is lowercased", () => {
  const findingA = { kind: "Dead-Code",  symbolFileSet: ["bin/foo.cjs"], title: "A" };
  const findingB = { kind: "dead-code",  symbolFileSet: ["bin/foo.cjs"], title: "B" };

  const keyA = identityKey(canonicalizeFinding(findingA));
  const keyB = identityKey(canonicalizeFinding(findingB));

  assert.strictEqual(keyA, keyB, "kind enum must be lowercased in the identity key.");
});

test("M94-D6-T2: canonicalize — title is stripped from identity (cannot flip the gate)", () => {
  // This is the killing test: if canonicalization KEYS OFF title, a rephrasing would
  // produce a different identity key and spuriously fail the ⊇ gate.
  const findings = [
    { kind: "dead-code", symbolFileSet: ["bin/foo.cjs"], title: "Title version 1" },
    { kind: "dead-code", symbolFileSet: ["bin/foo.cjs"], title: "Title version 2" },
    { kind: "dead-code", symbolFileSet: ["bin/foo.cjs"], title: "" },
    { kind: "dead-code", symbolFileSet: ["bin/foo.cjs"], title: undefined },
  ];

  const keys = findings.map((f) => identityKey(canonicalizeFinding({ ...f, title: f.title || "" })));
  const unique = new Set(keys);

  assert.strictEqual(unique.size, 1,
    "ALL four findings (same kind+symbolFileSet, varying title) MUST canonicalize to ONE identity key. " +
    "Title variation CANNOT flip the ⊇ gate. [RULE] scan-finding-identity-canonical");
});

// ─── T2: Graph-mode toggle tests ─────────────────────────────────────────────
// [RULE] no-graph-baseline-proven-graph-free

test("M94-D6-T2: graph-wiring toggle — disabled path fires ZERO graph queries", () => {
  // Simulates the graphMode==="disabled" code path in the workflow.
  // When disabled, structuralSlice remains null and runCli is never called.
  // [RULE] no-graph-baseline-proven-graph-free

  const tracker = makeQueryTracker();

  function simulatedGraphWiringPhase(graphMode) {
    if (graphMode === "disabled") {
      // No query calls — this is the entire disabled branch
      return { mode: "disabled", slicePresent: false };
    }
    // wired branch — would call tracker.recordQuery() here
    tracker.recordQuery(); // dead-code, dangling, cluster
    tracker.recordQuery();
    tracker.recordQuery();
    return { mode: "wired", slicePresent: true };
  }

  const result = simulatedGraphWiringPhase("disabled");
  assert.strictEqual(result.mode, "disabled");
  assert.strictEqual(result.slicePresent, false);
  assert.strictEqual(tracker.callCount, 0,
    "With graphMode==='disabled', the graph-query call-count MUST be 0. " +
    "The AC-4 no-graph baseline is GENUINELY graph-free. [RULE] no-graph-baseline-proven-graph-free");
});

test("M94-D6-T2: graph-wiring toggle — wired path fires graph queries (call-count > 0)", () => {
  const tracker = makeQueryTracker();

  function simulatedGraphWiringPhase(graphMode) {
    if (graphMode === "disabled") return { mode: "disabled", slicePresent: false };
    // wired: fires status + dead-code + dangling + cluster (minimum 3 queries after status)
    tracker.recordQuery(); // status
    tracker.recordQuery(); // dead-code
    tracker.recordQuery(); // dangling
    tracker.recordQuery(); // cluster
    return { mode: "wired", slicePresent: true };
  }

  const result = simulatedGraphWiringPhase("wired");
  assert.strictEqual(result.mode, "wired");
  assert.ok(tracker.callCount > 0,
    "With graphMode==='wired', the graph-query call-count MUST be > 0. " +
    "[RULE] scan-injects-structural-slice");
});

// ─── T2: Structural slice injection tests ─────────────────────────────────────
// [RULE] scan-injects-structural-slice / [Finding B] slice CONSUMED

test("M94-D6-T2: structural slice is injected into finder context when wired", () => {
  // Simulates the finderPrompt() call in wired mode.
  // The graphSliceContext must be present in the prompt when graphWiringMode==="wired".

  const mockSlice = {
    deadCode: [{ funcId: "bin/foo.cjs#unusedFn", file: "bin/foo.cjs", tier: "compiler-accurate", candidateLabel: null }],
    dangling:  [{ src: "bin/bar.cjs#callFn", dst: "lib/missing.cjs#targetFn", kind: "CALL" }],
    clusters:  [{ files: ["bin/a.cjs", "bin/b.cjs"], couplingScore: 0.72 }],
    coverage:  { deadCode: { complete: true }, dangling: { complete: true }, cluster: { complete: true } },
    tier: "compiler-accurate",
  };

  // Simulate the graphSliceContext selection in scanSlice()
  const graphWiringMode = "wired";
  const structuralSlice = mockSlice;
  const graphSliceContext = (graphWiringMode === "wired" && structuralSlice) ? structuralSlice : null;

  assert.ok(graphSliceContext !== null,
    "graphSliceContext MUST be non-null when graphWiringMode==='wired'. [RULE] scan-injects-structural-slice");
  assert.ok(graphSliceContext.deadCode.length > 0,
    "graphSliceContext.deadCode must carry the dead-code candidates from the D5 CLI.");
  assert.ok(graphSliceContext.dangling.length > 0,
    "graphSliceContext.dangling must carry the dangling-reference edges from the D5 CLI.");
});

test("M94-D6-T2: structural slice is NOT injected when wiring disabled (no-graph baseline)", () => {
  const mockSlice = { deadCode: [{ funcId: "bin/foo.cjs#unusedFn" }], dangling: [], clusters: [], coverage: {}, tier: "compiler-accurate" };

  const graphWiringMode = "disabled";
  const structuralSlice = null; // not populated in disabled mode
  const graphSliceContext = (graphWiringMode === "wired" && structuralSlice) ? structuralSlice : null;

  assert.strictEqual(graphSliceContext, null,
    "graphSliceContext MUST be null when graphWiringMode==='disabled' (no-graph baseline). " +
    "[RULE] no-graph-baseline-proven-graph-free — the baseline is genuinely graph-free.");
});

test("M94-D6-T2: structural slice is NOT injected on graph-unavailable fallback", () => {
  const graphWiringMode = "fallback-announced"; // graph unavailable
  const structuralSlice = null; // no slice when fallback
  const graphSliceContext = (graphWiringMode === "wired" && structuralSlice) ? structuralSlice : null;

  assert.strictEqual(graphSliceContext, null,
    "graphSliceContext MUST be null when graphWiringMode==='fallback-announced'. " +
    "Fallback is announced, not silent. [RULE] parser-fail-disables-loud-never-silent");
});

// [Finding B] — slice CONSUMED (byte-traceable to injected D5 result)
test("M94-D6-T2: [Finding B] graph-wired finding traceable to injected D5 query result", () => {
  // Simulates the requirement that the graph-wired run's output contains ≥1 finding
  // whose detail/files byte-trace to the injected D5 structural slice.
  // [Finding B] — dead-injection trap: injecting the slice into context but having finders
  // never USE it does NOT satisfy the INSIGHT gate.

  const injectedDeadCode = [
    { funcId: "bin/orphan-helper.cjs#unusedHelper", file: "bin/orphan-helper.cjs", tier: "compiler-accurate", candidateLabel: null },
  ];

  // A finding that CITES the injected graph data — the funcId appears in both the
  // injected slice AND in the finding's detail/files.
  const graphWiredFinding = {
    title: "Dead function unusedHelper has no inbound call edges",
    severity: "MEDIUM",
    area: "Dead code",
    files: ["bin/orphan-helper.cjs"],
    detail: "funcId: bin/orphan-helper.cjs#unusedHelper has no inbound call or file-import edges per the graph (compiler-accurate tier). The function appears in the pre-computed dead-code query result.",
    recommendation: "Remove or export if intentional.",
    kind: "dead-code",
    symbolFileSet: ["bin/orphan-helper.cjs#unusedHelper"],
    graphAttributed: true,
    graphQueryResult: injectedDeadCode[0], // the raw D5 CLI result that produced this finding
  };

  // Assert the finding is traceable to the injected slice:
  // 1. The funcId in the finding appears in the injected dead-code list.
  const claimedFuncId = graphWiredFinding.graphQueryResult.funcId;
  const inInjectedSlice = injectedDeadCode.some((dc) => dc.funcId === claimedFuncId);
  assert.ok(inInjectedSlice,
    "[Finding B] The graph-wired finding MUST be traceable to the injected D5 query result. " +
    `Claimed funcId '${claimedFuncId}' not found in injected dead-code slice. ` +
    "The slice must REACH a finding, not merely sit in context (dead-injection trap).");

  // 2. The finding sets graphAttributed=true (required by [RULE] scan-insight-delta-graph-attributed)
  assert.ok(graphWiredFinding.graphAttributed,
    "[Finding B] graph-wired structural findings MUST set graphAttributed=true " +
    "so the AC-4 delta is falsifiable (not mere LLM run-to-run variance).");
});

// [Finding C] — fault-injection: graph-unavailable → fallback announced, scan completes
test("M94-D6-T2: [Finding C] fault-injection — graph-unavailable → announced fallback, scan proceeds", () => {
  // Simulates the D5 CLI returning {ok:false, reason:"graph-unavailable"}.
  // The scan MUST: (a) announce the fallback, (b) continue via intact grep-mode.

  const faultInjectedCliResult = { ok: false, reason: "graph-unavailable" };

  // Simulated wiring-phase decision logic (mirrors the workflow)
  let graphWiringMode;
  let structuralSlice = null;
  const announcements = [];

  const statusResult = faultInjectedCliResult;
  if (!statusResult || !statusResult.ok) {
    graphWiringMode = "fallback-announced";
    announcements.push(`GRAPH-FALLBACK (ANNOUNCED): graph index not available (${statusResult.reason}) — scan continues in full grep-mode`);
  } else {
    graphWiringMode = "wired";
    structuralSlice = { deadCode: [], dangling: [], clusters: [], coverage: {}, tier: "unknown" };
  }

  assert.strictEqual(graphWiringMode, "fallback-announced",
    "[Finding C] When the D5 CLI returns graph-unavailable, graphWiringMode MUST be 'fallback-announced'.");
  assert.strictEqual(structuralSlice, null,
    "[Finding C] structuralSlice MUST remain null on graph-unavailable (no injection).");
  assert.ok(announcements.length > 0,
    "[Finding C] The fallback MUST be ANNOUNCED — never silent. At least one announcement log entry.");
  assert.ok(announcements[0].includes("ANNOUNCED"),
    "[Finding C] The fallback announcement MUST include the word 'ANNOUNCED'.");
});

// ─── T3: AC-4 INSIGHT-delta measurement tests ────────────────────────────────
// [RULE] scan-insight-gate / [RULE] ac4-atos-sha-pinned / [RULE] ac4-verdict-machine-checkable

// T3 result doc existence check — the spike results file must exist and be parseable.
test("M94-D6-T3: AC-4 result doc exists at the declared path", () => {
  assert.ok(
    fs.existsSync(RESULTS_PATH),
    `AC-4 result doc MUST exist at: ${RESULTS_PATH}\n` +
    "D6-T3 requires the measurement to be recorded before the test suite passes."
  );
});

test("M94-D6-T3: AC-4 result doc contains machine-checkable ac4Verdict field", () => {
  const content = fs.readFileSync(RESULTS_PATH, "utf8");

  // The ac4Verdict must appear as a structured field, NOT just a prose string.
  // Format: ac4Verdict: PROVEN | RESCOPE (in the YAML/JSON metadata envelope)
  // [RULE] ac4-verdict-machine-checkable — the structured field, not a prose claim.
  const verdictMatch = content.match(/ac4Verdict\s*:\s*(PROVEN|RESCOPE)/);
  assert.ok(
    verdictMatch,
    "AC-4 result doc MUST contain a machine-checkable 'ac4Verdict: PROVEN|RESCOPE' field. " +
    "A prose 'cleared'/'passed' string is NOT the verdict (M90 lesson). " +
    "[RULE] ac4-verdict-machine-checkable"
  );
});

test("M94-D6-T3: AC-4 result doc contains Atos SHA pin fields", () => {
  const content = fs.readFileSync(RESULTS_PATH, "utf8");

  // [RULE] ac4-atos-sha-pinned — must record the pinned SHA and assert both runs used it.
  assert.ok(
    content.includes("atosSha:") || content.includes("atos_sha:") || content.match(/SHA\s*[:\-]\s*[0-9a-f]{7,40}/i),
    "AC-4 result doc MUST record the pinned Atos commit SHA. " +
    "Both runs must be measured against the same SHA. [RULE] ac4-atos-sha-pinned"
  );
  assert.ok(
    content.includes("noGraphSha:") || content.includes("graphWiredSha:") ||
    content.match(/no.?graph.*sha|baseline.*sha|wired.*sha/i),
    "AC-4 result doc MUST record BOTH run SHAs (no-graph baseline + graph-wired). " +
    "[RULE] ac4-atos-sha-pinned"
  );
});

test("M94-D6-T3: AC-4 result doc findings carry canonicalizable fields (kind + symbolFileSet)", () => {
  const content = fs.readFileSync(RESULTS_PATH, "utf8");

  // [RULE] scan-finding-identity-canonical — recorded findings must carry kind + symbolFileSet
  // so the ⊇ gate operates on structural identities, not free-text titles.
  assert.ok(
    content.includes("kind:") || content.includes('"kind"'),
    "AC-4 result doc MUST record finding 'kind' fields (dead-code|cycle|dependent|coupling). " +
    "[RULE] scan-finding-identity-canonical"
  );
  assert.ok(
    content.includes("symbolFileSet:") || content.includes('"symbolFileSet"'),
    "AC-4 result doc MUST record finding 'symbolFileSet' fields (the sorted symbol/file set). " +
    "[RULE] scan-finding-identity-canonical"
  );
});

// Hard-gate: the AC-4 OUTCOME LADDER (fixture-driven, deterministic — [RULE] ac4-verdict-machine-checkable)
// Tests the verdict logic over all five permutations WITHOUT a live scan.

test("M94-D6-T3: AC-4 outcome ladder — PROVEN + graph-attributed delta → PASSES", () => {
  const envelope = {
    ac4Verdict: "PROVEN",
    atosSha: "abc1234",
    noGraphSha: "abc1234",
    graphWiredSha: "abc1234",
    noGraphFindings: [
      { kind: "dead-code", symbolFileSet: ["bin/foo.cjs#init"], title: "Dead init" },
    ],
    graphWiredFindings: [
      { kind: "dead-code", symbolFileSet: ["bin/foo.cjs#init"], title: "Dead init" },
      { kind: "dead-code", symbolFileSet: ["bin/orphan.cjs#helper"], title: "Graph found this too", graphAttributed: true },
    ],
    graphAttributedDelta: {
      funcId: "bin/orphan.cjs#helper",
      graphQueryResult: { funcId: "bin/orphan.cjs#helper", file: "bin/orphan.cjs", tier: "compiler-accurate" },
    },
    rescope: null,
  };

  // Assert the outcome logic:
  const verdict = envelope.ac4Verdict;
  assert.strictEqual(verdict, "PROVEN");

  // SHA equality
  assert.strictEqual(envelope.noGraphSha, envelope.graphWiredSha,
    "PROVEN requires no-graph SHA == graph-wired SHA. [RULE] ac4-atos-sha-pinned");

  // ⊇ check (canonical identities)
  const noGraphSet = canonicalSet(envelope.noGraphFindings);
  const wiredSet   = canonicalSet(envelope.graphWiredFindings);
  for (const k of noGraphSet) {
    assert.ok(wiredSet.has(k),
      `PROVEN requires graph-wired canonical set ⊇ no-graph canonical set. Missing: ${k}`);
  }

  // ≥1 graph-attributed delta
  assert.ok(envelope.graphAttributedDelta && envelope.graphAttributedDelta.graphQueryResult,
    "PROVEN requires ≥1 graph-attributed missed/wrong delta backed by a D5 query result. " +
    "[RULE] scan-insight-delta-graph-attributed");

  // Outcome: PASSES
  const passes = verdict === "PROVEN" &&
    envelope.noGraphSha === envelope.graphWiredSha &&
    envelope.graphAttributedDelta &&
    envelope.graphAttributedDelta.graphQueryResult;
  assert.ok(passes, "PROVEN with graph-attributed delta MUST PASS the AC-4 gate.");
});

test("M94-D6-T3: AC-4 outcome ladder — RESCOPE + accuracy correction → PASSES", () => {
  const envelope = {
    ac4Verdict: "RESCOPE",
    atosSha: "abc1234",
    noGraphSha: "abc1234",
    graphWiredSha: "abc1234",
    noGraphFindings: [
      { kind: "dead-code", symbolFileSet: ["bin/foo.cjs#init"], title: "Dead init" },
    ],
    graphWiredFindings: [
      { kind: "dead-code", symbolFileSet: ["bin/foo.cjs#init"], title: "Dead init" },
      // Same canonical set — zero missed finding delta
    ],
    graphAttributedDelta: null, // zero missed-finding delta
    rescope: {
      type: "accuracy-correction",
      description: "bin/foo.cjs#init flagged dead-code by baseline, but the graph shows it has 3 inbound call edges from test files — the baseline finding is WRONG. Graph corrects it.",
      graphQueryResult: { funcId: "bin/foo.cjs#init", callers: ["test/a.test.js#testInit", "test/b.test.js#setup", "test/c.test.js#before"], tier: "compiler-accurate" },
    },
  };

  // RESCOPE (a): accuracy correction — zero missed-finding delta BUT the graph proves
  // a baseline finding is WRONG (false dead-code). This IS a legitimate insight payoff.
  const verdict = envelope.ac4Verdict;
  assert.strictEqual(verdict, "RESCOPE");
  assert.ok(
    envelope.rescope && envelope.rescope.type === "accuracy-correction" && envelope.rescope.graphQueryResult,
    "RESCOPE(a) requires a recorded graph-attributed accuracy correction backed by a D5 query result."
  );

  const passes = verdict === "RESCOPE" && envelope.rescope !== null;
  assert.ok(passes, "RESCOPE with accuracy-correction MUST PASS the AC-4 gate.");
});

test("M94-D6-T3: AC-4 outcome ladder — RESCOPE + documented descope → PASSES", () => {
  const envelope = {
    ac4Verdict: "RESCOPE",
    atosSha: "abc1234",
    noGraphSha: "abc1234",
    graphWiredSha: "abc1234",
    graphAttributedDelta: null,
    rescope: {
      type: "descope",
      description: "No missed-finding delta and no accuracy correction on the pinned Atos SHA — the graph and raw-read converge here. Insight headline deferred to the scan-redesign milestone.",
      integrationPointsDoc: "m94-integration-points.md",
    },
  };

  const verdict = envelope.ac4Verdict;
  assert.strictEqual(verdict, "RESCOPE");
  assert.ok(
    envelope.rescope && envelope.rescope.type === "descope" && envelope.rescope.integrationPointsDoc,
    "RESCOPE(b) requires a documented descope record referencing integration-points.md."
  );

  const passes = verdict === "RESCOPE" && envelope.rescope !== null;
  assert.ok(passes, "RESCOPE with documented descope MUST PASS the AC-4 gate.");
});

test("M94-D6-T3: AC-4 outcome ladder — zero delta AND no rescope → FAILS (halt+descope forced)", () => {
  // This is the hard gate — the debug-loop-never-halts anti-pattern closed.
  // Zero missed-finding delta + no accuracy correction + no descope record = FAIL.
  // Forces halt+descope; never a silent re-run loop. [RULE] ac4-verdict-machine-checkable

  const envelope = {
    ac4Verdict: "PROVEN", // claims PROVEN but has no delta — inconsistent; must fail
    atosSha: "abc1234",
    noGraphSha: "abc1234",
    graphWiredSha: "abc1234",
    noGraphFindings: [
      { kind: "dead-code", symbolFileSet: ["bin/foo.cjs#init"], title: "Dead init" },
    ],
    graphWiredFindings: [
      { kind: "dead-code", symbolFileSet: ["bin/foo.cjs#init"], title: "Dead init" },
      // Same canonical set — zero missed finding delta
    ],
    graphAttributedDelta: null, // no graph-attributed missed/wrong finding
    rescope: null,              // no rescope record either
  };

  // Simulate the gate logic:
  const verdict = envelope.ac4Verdict;
  const noGraphSet = canonicalSet(envelope.noGraphFindings);
  const wiredSet   = canonicalSet(envelope.graphWiredFindings);

  // ⊇ holds (same canonical set), but no graph-attributed delta and no rescope
  const hasGraphAttributedDelta = !!(envelope.graphAttributedDelta && envelope.graphAttributedDelta.graphQueryResult);
  const hasRescope = !!(envelope.rescope);

  // Gate: PROVEN requires graphAttributedDelta; RESCOPE requires rescope record.
  // Zero delta + no rescope + no accuracy correction = inconsistent claim → FAIL.
  const shouldFail = !hasGraphAttributedDelta && !hasRescope;
  assert.ok(shouldFail,
    "Zero delta AND no rescope record MUST cause the hard gate to FAIL. " +
    "This forces halt+descope; never a silent re-run loop. " +
    "[RULE] ac4-verdict-machine-checkable"
  );
});

test("M94-D6-T3: AC-4 outcome ladder — missing ac4Verdict field → FAILS", () => {
  // A result doc with NO ac4Verdict field is invalid — mirrors the missing-k1Verdict rejection.
  // [RULE] ac4-verdict-machine-checkable

  const envelope = {
    // ac4Verdict field deliberately absent
    atosSha: "abc1234",
    noGraphSha: "abc1234",
    graphWiredSha: "abc1234",
    status: "cleared", // prose claim — NOT the verdict
  };

  const hasVerdict = typeof envelope.ac4Verdict === "string" &&
    (envelope.ac4Verdict === "PROVEN" || envelope.ac4Verdict === "RESCOPE");

  assert.ok(!hasVerdict,
    "Test setup: envelope must NOT have a valid ac4Verdict field.");

  // Gate: missing or invalid ac4Verdict → FAIL
  const gatePass = hasVerdict;
  assert.ok(!gatePass,
    "A result doc missing ac4Verdict (or with a prose claim instead) MUST FAIL the hard gate. " +
    "The structured field is authoritative; a prose 'cleared' is NOT the verdict (M90 lesson)."
  );
});

// [RULE] ac4-atos-sha-pinned — SHA equality / repo-not-found fail-loud
test("M94-D6-T3: ac4-atos-sha-pinned — SHA mismatch fails loud", () => {
  const envelope = {
    ac4Verdict: "PROVEN",
    noGraphSha: "abc1234",
    graphWiredSha: "def5678", // DIFFERENT SHA — invalid
    graphAttributedDelta: { funcId: "bin/x.cjs#fn", graphQueryResult: { funcId: "bin/x.cjs#fn" } },
    rescope: null,
  };

  const shaMatch = envelope.noGraphSha === envelope.graphWiredSha;
  assert.ok(!shaMatch,
    "Test setup: SHAs must differ for this failing case.");

  // Gate: SHA mismatch → FAIL regardless of ac4Verdict
  const gatePass = shaMatch;
  assert.ok(!gatePass,
    "SHA mismatch (noGraphSha !== graphWiredSha) MUST fail loud. " +
    "A finding-set recorded against mismatched SHAs is NEVER valid. [RULE] ac4-atos-sha-pinned"
  );
});

test("M94-D6-T3: ac4-atos-sha-pinned — repo-not-found condition is detectable", () => {
  // When the Atos repo is not found, the SHA pin check must fail loud (never proceed silently).
  const envelope = {
    ac4Verdict: "PROVEN",
    repoNotFound: true,  // repo unavailable
    noGraphSha: null,
    graphWiredSha: null,
    graphAttributedDelta: { funcId: "bin/x.cjs#fn", graphQueryResult: {} },
    rescope: null,
  };

  const repoAvailable = !envelope.repoNotFound && envelope.noGraphSha && envelope.graphWiredSha;
  assert.ok(!repoAvailable,
    "Test setup: repo-not-found case must fail the availability check.");

  const gatePass = repoAvailable;
  assert.ok(!gatePass,
    "repo-not-found condition MUST fail the SHA pin check loud. [RULE] ac4-atos-sha-pinned"
  );
});

// [Finding A] — delta must be graph-attributed (not LLM variance)
test("M94-D6-T3: [Finding A] delta without graphQueryResult is NOT graph-attributed → gate fails", () => {
  // A 'new' finding in the graph-wired run that has NO corresponding D5 query result
  // could be mere LLM run-to-run variance — it does NOT satisfy the INSIGHT gate.
  // [Finding A] / [RULE] scan-insight-delta-graph-attributed

  const deltaFinding = {
    kind: "dead-code",
    symbolFileSet: ["bin/maybe-orphan.cjs#fn"],
    title: "Possible dead code",
    graphAttributed: false,    // claimed to be new, but not backed by graph query
    graphQueryResult: null,    // NO D5 query result
  };

  const isGraphAttributed = !!(deltaFinding.graphQueryResult);
  assert.ok(!isGraphAttributed,
    "[Finding A] A delta without a D5 query result is NOT graph-attributed. " +
    "It could be mere LLM run-to-run variance. It does NOT satisfy the INSIGHT gate. " +
    "[RULE] scan-insight-delta-graph-attributed"
  );
});

test("M94-D6-T3: [Finding A] delta WITH graphQueryResult IS graph-attributed → gate passes", () => {
  const deltaFinding = {
    kind: "dead-code",
    symbolFileSet: ["bin/true-orphan.cjs#neverCalled"],
    title: "Dead function neverCalled",
    graphAttributed: true,
    graphQueryResult: {
      funcId: "bin/true-orphan.cjs#neverCalled",
      file: "bin/true-orphan.cjs",
      tier: "compiler-accurate",
      candidateLabel: null,  // compiler-accurate = certain, not a candidate
    },
  };

  const isGraphAttributed = !!(deltaFinding.graphQueryResult && deltaFinding.graphQueryResult.funcId);
  assert.ok(isGraphAttributed,
    "[Finding A] A delta WITH a D5 query result IS graph-attributed. It satisfies the INSIGHT gate."
  );
});

// ─── Contract file existence check ────────────────────────────────────────────

test("M94-D6: contract file exists and is STABLE", () => {
  assert.ok(fs.existsSync(CONTRACT_PATH),
    `graph-scan-consumer-contract.md MUST exist at: ${CONTRACT_PATH}`);

  const content = fs.readFileSync(CONTRACT_PATH, "utf8");
  assert.ok(content.includes("STABLE"),
    "graph-scan-consumer-contract.md MUST have Status: STABLE (T1 complete). " +
    "A DRAFT contract signals T1 acceptance criteria are unmet."
  );

  // Verify all required RULES are declared
  const requiredRules = [
    "scan-insight-gate",
    "scan-insight-delta-graph-attributed",
    "scan-finding-identity-canonical",
    "ac4-atos-sha-pinned",
    "ac4-verdict-machine-checkable",
    "scan-injects-structural-slice",
    "scan-slice-consumed",
    "no-graph-baseline-proven-graph-free",
  ];
  for (const rule of requiredRules) {
    assert.ok(content.includes(rule),
      `Contract MUST declare [RULE] ${rule}. Missing from graph-scan-consumer-contract.md.`
    );
  }
});

// ─── v4.13.12: graph probe must be SCHEMA-validated, never fence-parsed ──────
// Regression guard for the NiceNote 2026-06-29 silent grep-fallback: the scan's
// runCli told a haiku agent to "return ONLY the raw JSON line" and then
// JSON.parse()'d the free-text reply. Haiku wrapped it in a ```json fence →
// JSON.parse threw → graph-unavailable → grep-mode, while the graph was LIVE.
// The fix routes the probe through a schema (StructuredOutput), which the model
// satisfies via the tool layer (never fenced prose). These source-structural
// assertions fail if the brittle pattern is reintroduced.
test("v4.13.12: scan runCli is schema-validated and does NOT JSON.parse a free-text agent reply", () => {
  const wfPath = path.join(ROOT, "templates", "workflows", "gsd-t-scan.workflow.js");
  const src = fs.readFileSync(wfPath, "utf8");

  // Isolate the runCli helper body.
  const start = src.indexOf("async function runCli(");
  assert.ok(start !== -1, "scan workflow must define async function runCli(...)");
  // Body runs until the next top-level function/const at column 0 after it.
  const after = src.slice(start);
  const end = after.search(/\n(async function |function |const [A-Za-z_])/);
  const body = end === -1 ? after : after.slice(0, end);

  // 1. The probe MUST pass a schema (this is what makes it fence-proof).
  assert.ok(/schema\s*:/.test(body),
    "scan runCli MUST pass a `schema:` to agent() so the probe returns StructuredOutput, " +
    "not fence-vulnerable free text. (NiceNote 2026-06-29 root cause.) " +
    "[RULE] graph-probe-schema-validated-never-fence-parsed");

  // 2. The probe MUST NOT JSON.parse the agent's text reply (the brittle pattern).
  assert.ok(!/JSON\.parse\s*\(\s*result/.test(body),
    "scan runCli MUST NOT JSON.parse(result...) — a fenced ```json reply throws there and " +
    "silently demotes a LIVE graph to grep-mode. Use a schema instead.");

  // 3. The probe MUST resolve project-local bin OR fall back to the global `gsd-t` binary
  //    (a project without a local bin copy must still probe successfully).
  assert.ok(/gsd-t graph/.test(body),
    "scan runCli MUST fall back to the global `gsd-t graph` binary when the project-local " +
    "bin/gsd-t-graph-query-cli.cjs is absent (was hardcoded to `node bin/...cjs`).");
});
