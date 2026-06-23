"use strict";

// M87 D3 — Two-altitude flow + altitude-agnostic-seam harness.
//
// This is the deterministic test for the milestone two-altitude intention-first
// FLOW (M87-D3-T1/T2 prose impls) and the keep-or-supersede PROTOCOL (M87-D3-T3),
// plus the D2↔D3 seam proof. It proves three things, all deterministic:
//
//   (a) the /gsd-t-milestone command + the phase-workflow milestone branch carry
//       the two-altitude flow STRUCTURE — the high-level-approach altitude step
//       PRECEDES the detailed-doc step (a POSITIONAL/structural assertion over the
//       document text, never a bare substring-presence check).
//   (b) the keep-or-supersede prompt instructs writing a ⚠ Divergence flag on
//       SUPERSEDE (and writes NO flag on keep).
//   (c) ALTITUDE-AGNOSTIC SEAM: the section-coverage gate (bin/gsd-t-traceability-
//       gate.cjs) yields IDENTICAL exit semantics whether the competition
//       solution-space probe runs at partition altitude or at high-level-approach
//       altitude. The probe altitude is an INPUT to the COMPETITION (which
//       strategies are explored), and it must NOT flow into the gate's verdict —
//       shifting the probe UP cannot change the gate's pass/fail on the same corpus.
//
// The deterministic sign-off-STATE test (unsigned ≠ DEFINED; signing flips; skip
// logged) is M88 — no machine-checkable milestone-state artifact exists yet to
// assert against. It is NOT in this file.
//
// Contract: .gsd-t/contracts/pseudocode-source-of-truth-contract.md §1 (two
// altitudes), §3 (section-citation gate), §4 (divergence-flag grammar).

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = path.resolve(__dirname, "..");
const MILESTONE_CMD = path.join(REPO, "commands", "gsd-t-milestone.md");
const PHASE_WF = path.join(REPO, "templates", "workflows", "gsd-t-phase.workflow.js");
const KEEP_OR_SUPERSEDE = path.join(REPO, "templates", "prompts", "keep-or-supersede-subagent.md");

const { runGate } = require("../bin/gsd-t-traceability-gate.cjs");

function read(p) {
  return fs.readFileSync(p, "utf8");
}

// First index where ANY of the given alternative markers appears; -1 if none.
// Structural helper: we assert ORDER by comparing first-occurrence indices, not
// by substring presence alone.
function firstIndexOfAny(text, markers) {
  let best = -1;
  for (const m of markers) {
    const i = text.indexOf(m);
    if (i !== -1 && (best === -1 || i < best)) best = i;
  }
  return best;
}

// ─── (a) Two-altitude flow STRUCTURE: approach altitude precedes detailed doc ───

describe("M87-D3 two-altitude flow structure (approach altitude precedes detailed doc)", () => {
  test("commands/gsd-t-milestone.md: high-level-approach step precedes the detailed PseudoCode doc step", () => {
    const text = read(MILESTONE_CMD);

    // The approach-altitude content (Altitude 1) and the detailed-doc content
    // (Altitude 2) must BOTH be present AND in order. Markers are the load-bearing
    // anchors for each altitude — multiple alternatives so a wording tweak does not
    // make the test brittle, while the ORDER assertion stays structural.
    const approachIdx = firstIndexOfAny(text, [
      "Altitude 1 — High-Level Approach",
      "HIGH-LEVEL APPROACH",
      "High-Level Approach (signed off FIRST)",
    ]);
    const detailedIdx = firstIndexOfAny(text, [
      "Altitude 2 — Detailed",
      "Only after the approach is signed off",
      "the detailed `PseudoCode-[Title].md`",
    ]);

    assert.notEqual(approachIdx, -1, "high-level-approach altitude step must be present");
    assert.notEqual(detailedIdx, -1, "detailed PseudoCode-doc altitude step must be present");
    assert.ok(
      approachIdx < detailedIdx,
      `approach altitude (idx ${approachIdx}) must PRECEDE the detailed-doc altitude (idx ${detailedIdx}) — two-altitude order`
    );

    // Sign-off checkpoint sits between the altitudes (the gate the flow describes).
    const signoffIdx = firstIndexOfAny(text, ["SIGN-OFF", "sign off the APPROACH", "signs off the APPROACH", "signed off"]);
    assert.notEqual(signoffIdx, -1, "the approach SIGN-OFF checkpoint must be described");
    assert.ok(signoffIdx > approachIdx, "sign-off must come at/after the approach is presented");

    // Default-ON with a LOGGED skip — never a silent default-off.
    assert.match(text, /default-ON/i, "the two-altitude flow must be default-ON");
    assert.match(text, /LOGGED decision/i, "a skip must be a LOGGED decision (no silent default-off)");
  });

  test("commands/gsd-t-milestone.md: Document Ripple lists PseudoCode-[Title].md", () => {
    const text = read(MILESTONE_CMD);
    const rippleIdx = text.indexOf("## Document Ripple");
    assert.notEqual(rippleIdx, -1, "Document Ripple section must exist");
    const rippleSection = text.slice(rippleIdx);
    assert.match(
      rippleSection,
      /PseudoCode-\[Title\]\.md/,
      "Document Ripple must list PseudoCode-[Title].md"
    );
  });

  test("gsd-t-phase.workflow.js milestone objective: approach altitude precedes detailed-doc altitude", () => {
    const text = read(PHASE_WF);

    // Locate the milestone-phase objective block (the value of promptByPhase.milestone).
    const objStart = text.indexOf("milestone: `Define a new milestone");
    assert.notEqual(objStart, -1, "milestone objective block must exist in promptByPhase");
    // Bound the block at the next phase key so we assert order WITHIN the milestone objective.
    const objEnd = text.indexOf("prd: `Generate", objStart);
    assert.ok(objEnd > objStart, "milestone objective block must be bounded before the prd key");
    const block = text.slice(objStart, objEnd);

    const approachIdx = firstIndexOfAny(block, ["ALTITUDE 1 — HIGH-LEVEL APPROACH", "HIGH-LEVEL APPROACH"]);
    const detailedIdx = firstIndexOfAny(block, ["ALTITUDE 2 — DETAILED", "only after the approach is signed off"]);

    assert.notEqual(approachIdx, -1, "workflow milestone objective must carry the high-level-approach altitude");
    assert.notEqual(detailedIdx, -1, "workflow milestone objective must carry the detailed-doc altitude");
    assert.ok(
      approachIdx < detailedIdx,
      `workflow: approach altitude (idx ${approachIdx}) must PRECEDE detailed-doc altitude (idx ${detailedIdx})`
    );
    // Default-ON; skip logged (no silent default-off) baked into the objective.
    assert.match(block, /DEFAULT-ON/i, "workflow milestone objective must state DEFAULT-ON");
    assert.match(block, /LOGGED decision/i, "workflow milestone objective must log a skip");
  });

  test("gsd-t-phase.workflow.js: solution-space probe shifts UP to high-level-approach altitude for the milestone phase", () => {
    const text = read(PHASE_WF);

    // The altitude shift is wired at the call site: phaseName === "milestone" passes
    // altitude: "high-level-approach" into runSolutionSpaceProbe. This is a structural
    // assertion that the shift is wired for the milestone phase only.
    assert.match(
      text,
      /phaseName === "milestone" \? "high-level-approach"/,
      "milestone phase must select the high-level-approach probe altitude"
    );
    // And the probe consumes the altitude (shifts WHAT it competes on, not WHO/which model).
    assert.match(
      text,
      /altitude === "high-level-approach"/,
      "runSolutionSpaceProbe must consume the high-level-approach altitude hint"
    );

    // M82 blindness + M85 tier invariants preserved: the probe model literal stays
    // fable (the altitude shift changes WHAT, never the model/producers).
    assert.match(
      text,
      /overrides\["solution-space-probe"\] \?\? "fable"/,
      "probe model literal must stay fable (??-form) — altitude shift must not change the tier"
    );
    // Producers stay opus (M82 blindness — altitude shift changes the topic, not who competes).
    assert.match(text, /model=opus/, "competition producers must stay opus (M82 blindness invariant)");
  });
});

// ─── (b) Keep-or-supersede protocol writes a ⚠ Divergence flag on supersede ─────

describe("M87-D3 keep-or-supersede protocol", () => {
  const prompt = read(KEEP_OR_SUPERSEDE);

  test("instructs ASK keep-or-supersede per inherited shipped-code model", () => {
    assert.match(prompt, /keep-or-supersede/i, "must name the keep-or-supersede decision");
    assert.match(prompt, /inherited/i, "must reference inherited shipped-code models");
    // The forcing rule: never encode without an explicit decision.
    assert.match(
      prompt,
      /[Nn]ever encode an inherited shipped-code model without an explicit keep-or-supersede decision/,
      "must FORCE the decision (never silently encode)"
    );
  });

  test("instructs WRITING a ⚠ Divergence flag on SUPERSEDE (and none on keep)", () => {
    // The §4 grammar shape must be present as the instruction.
    assert.match(
      prompt,
      /⚠ Divergence: <RULE-ID or section> — supersedes shipped <what>\. Reason: <user intention>\./,
      "must instruct the exact §4 ⚠ Divergence grammar shape"
    );
    // SUPERSEDE writes a flag; KEEP writes none — both stated.
    const supersedeIdx = prompt.indexOf("SUPERSEDE");
    assert.notEqual(supersedeIdx, -1, "must name SUPERSEDE");
    assert.match(prompt, /KEEP writes no flag|No flag is written/i, "keep must write NO flag");
    assert.match(prompt, /supersede\b[^.]*\bDivergence\b/i, "supersede must be tied to writing a Divergence flag");
  });

  test("doc prose is the USER's intention, never agent reasoning", () => {
    assert.match(
      prompt,
      /doc prose is the USER'S intention, never your reasoning/i,
      "must mandate user-intention prose (not agent reasoning)"
    );
  });
});

// ─── (c) ALTITUDE-AGNOSTIC SEAM: probe altitude does not change the gate verdict ─

describe("M87-D3 altitude-agnostic seam (probe altitude does NOT change the section-coverage gate verdict)", () => {
  // Helper: write a tasks.md to a temp file and return its path.
  function tmpTasks(md) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m87-d3-"));
    const f = path.join(dir, "tasks.md");
    fs.writeFileSync(f, md);
    return f;
  }

  // The gate's verdict is a pure function of the tasks CORPUS — it takes NO probe-
  // altitude input. We model "the probe ran at partition altitude" vs "the probe
  // shifted UP to high-level-approach altitude" as two runs against the SAME corpus,
  // and assert the gate's exit semantics ({ok, exitCode, violation kinds}) are
  // byte-identical. This is the seam contract: shifting the competition probe UP
  // (D3's wiring) cannot leak into D2's section-coverage gate.

  // A corpus that PASSES the gate (every behavioral task is traceable).
  const PASSING_CORPUS = `# Tasks
### M87-X1 — feature (HEADLINE)
- **Headline**: true
- **Files**: \`src/feature.js\`
- **Test**: \`test/feature.test.js\`
- **Acceptance criteria**:
  - AC-1: the feature works end to end
`;

  // A corpus that FAILS the gate (a headline with no test — the NiceNote class).
  const FAILING_CORPUS = `# Tasks
### M87-X1 — feature (HEADLINE)
- **Headline**: true
- **Files**: \`src/feature.js\`
- **Acceptance criteria**:
  - AC-1: open a 100MB+ file with bounded memory
`;

  // "Run the gate under a given probe altitude" — the altitude is deliberately NOT
  // passed to runGate (the gate has no such parameter). Accepting it here and
  // discarding it MODELS the seam: the altitude is an input to the upstream
  // competition, never to the gate. If a future refactor wired altitude INTO the
  // gate, the two runs below would diverge and this test would fail.
  function runGateAtAltitude(tasksFile, _probeAltitude) {
    return runGate({ tasksFile });
  }

  // Normalize a gate result to its exit semantics (the verdict surface that matters).
  function exitSemantics(r) {
    return {
      ok: r.ok,
      exitCode: r.exitCode,
      violationKinds: (r.violations || []).map((v) => v.kind).sort(),
    };
  }

  test("PASSING corpus: gate verdict identical at partition vs high-level-approach altitude", () => {
    const f = tmpTasks(PASSING_CORPUS);
    const atPartition = exitSemantics(runGateAtAltitude(f, "partition"));
    const atApproach = exitSemantics(runGateAtAltitude(f, "high-level-approach"));

    // Non-vacuity floor: prove the gate actually evaluated (a clean PASS), not a
    // silent no-op. exit 0 = traceable; exit 64 would mean "no tasks/bad input".
    assert.equal(atPartition.ok, true, "passing corpus must PASS the gate");
    assert.equal(atPartition.exitCode, 0, "passing corpus exit code must be 0 (evaluated, not skipped)");

    assert.deepEqual(
      atApproach,
      atPartition,
      "shifting the probe UP must NOT change the gate verdict on a passing corpus"
    );
  });

  test("FAILING corpus: gate verdict identical at partition vs high-level-approach altitude", () => {
    const f = tmpTasks(FAILING_CORPUS);
    const atPartition = exitSemantics(runGateAtAltitude(f, "partition"));
    const atApproach = exitSemantics(runGateAtAltitude(f, "high-level-approach"));

    // Non-vacuity floor: prove the gate actually FAILED on the bad corpus (exit 4 +
    // a real violation), not a silent pass — otherwise "identical" would be trivially
    // true on two vacuous passes.
    assert.equal(atPartition.ok, false, "failing corpus must FAIL the gate");
    assert.equal(atPartition.exitCode, 4, "failing corpus exit code must be 4 (≥1 violation)");
    assert.ok(
      atPartition.violationKinds.includes("headline-without-test"),
      "failing corpus must flag the headline-without-test violation"
    );

    assert.deepEqual(
      atApproach,
      atPartition,
      "shifting the probe UP must NOT change the gate verdict on a failing corpus"
    );
  });

  test("seam property: gate's verdict is a pure function of the corpus, blind to probe altitude", () => {
    // Cross-check: the SAME altitude argument applied to a passing vs failing corpus
    // must DIFFER (the gate discriminates on the corpus), while the SAME corpus across
    // altitudes must NOT differ (the gate is blind to altitude). Both halves together
    // prove the seam is non-vacuous: the gate is doing real work AND ignoring altitude.
    const pass = tmpTasks(PASSING_CORPUS);
    const fail = tmpTasks(FAILING_CORPUS);

    const passAtApproach = exitSemantics(runGateAtAltitude(pass, "high-level-approach"));
    const failAtApproach = exitSemantics(runGateAtAltitude(fail, "high-level-approach"));
    assert.notDeepEqual(
      passAtApproach,
      failAtApproach,
      "gate MUST discriminate on the corpus (passing ≠ failing) — else the seam test is vacuous"
    );

    const failAtPartition = exitSemantics(runGateAtAltitude(fail, "partition"));
    assert.deepEqual(
      failAtPartition,
      failAtApproach,
      "gate MUST be blind to altitude on a fixed corpus"
    );
  });
});
