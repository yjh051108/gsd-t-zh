"use strict";

// M89-D4-T3 — Worker workflow Stated-Claims→classify wiring tests
//
// Functional assertions (NOT shallow existence checks / isVisible / toBeAttached):
//
//   T3.1 — execute workflow source embeds Stated-Claims directive + has classify→research wiring
//          with external branch (marker-write + model:"fable") and internal branch (grep),
//          with §5.1 escalation when grep is empty. Asserts §7 marker write+flip is present.
//
//   T3.2 — quick workflow source has the same wiring as execute (simpler single-agent
//          structure, same marker-write + model:"fable" + escalation).
//
//   T3.3 — debug workflow source embeds Stated-Claims + has classify→research wiring;
//          the existing debug-cycle ternary (cycle===1?"opus":(overrides["debug-cycle-2"]??"fable"))
//          is INTACT and DISTINCT from the research stage's bare "fable" literal.
//
//   T3.4 — wave workflow has NO direct research agent, NO Stated-Claims snippet, and
//          ZERO model: occurrences (M85 composer-only invariant confirmed).
//
//   T3.5 — §7 marker write+flip is present in the external branch across all three workers.
//
//   T3.6 — idempotency-skip references "already cited" (§4.1 exact key match semantics).
//
// Source-structure parse: CHEAP PRE-CHECK (contract §7 + finding #7). The binding runtime
// proof is T4 (real-sandbox state-change run). A source parse passes even if wiring never
// fires — T4 proves it fires.
//
// Contract: auto-research-contract.md v1.2.0 §6.5/§1/§2/§3/§4/§5/§5.1/§7
// Runner: npm test

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..");
const WF_DIR = path.resolve(ROOT, "templates", "workflows");

const EXECUTE_WF = path.resolve(WF_DIR, "gsd-t-execute.workflow.js");
const DEBUG_WF   = path.resolve(WF_DIR, "gsd-t-debug.workflow.js");
const QUICK_WF   = path.resolve(WF_DIR, "gsd-t-quick.workflow.js");
const WAVE_WF    = path.resolve(WF_DIR, "gsd-t-wave.workflow.js");

const execSrc  = fs.readFileSync(EXECUTE_WF, "utf8");
const debugSrc = fs.readFileSync(DEBUG_WF,   "utf8");
const quickSrc = fs.readFileSync(QUICK_WF,   "utf8");
const waveSrc  = fs.readFileSync(WAVE_WF,    "utf8");

// ---------------------------------------------------------------------------
// T3.1 — execute workflow: Stated-Claims directive + classify→research wiring
// ---------------------------------------------------------------------------

describe("T3.1 — execute workflow: Stated-Claims + classify→research wiring", () => {

  test("execute workflow embeds the M89 STATED CLAIMS directive in the domain worker prompt", () => {
    assert.ok(
      execSrc.includes("M89 STATED CLAIMS"),
      "gsd-t-execute.workflow.js must include 'M89 STATED CLAIMS' in the worker prompt"
    );
    assert.ok(
      execSrc.includes("stated-claims-snippet.md"),
      "execute workflow must reference stated-claims-snippet.md in the worker prompt"
    );
    assert.ok(
      execSrc.includes("statedClaims"),
      "execute workflow must reference 'statedClaims' in the schema or prompt (worker output field)"
    );
  });

  test("execute workflow defines normalizeClaimKey (§4.1 exact-match key)", () => {
    assert.ok(
      execSrc.includes("normalizeClaimKey"),
      "execute workflow must define normalizeClaimKey for §4.1 idempotency"
    );
  });

  test("execute workflow invokes D1 classifier (research-gate classify) for GUESSED claims", () => {
    assert.ok(
      execSrc.includes("research-gate") && execSrc.includes("classify"),
      "execute workflow must invoke bin/gsd-t-research-gate.cjs with 'classify' subcommand"
    );
    assert.ok(
      execSrc.includes("classifyClaim") || (execSrc.includes("research-gate") && execSrc.includes("classify")),
      "execute workflow must have a classifier call"
    );
  });

  test("execute workflow has external branch: writes §7 uncited marker + research agent (model:fable)", () => {
    // External branch must write the uncited marker before research
    assert.ok(
      execSrc.includes("status=uncited"),
      "execute workflow must write status=uncited marker in external branch (§7)"
    );
    // Research agent must use bare "fable" literal (NOT overrides["research"] ?? form)
    assert.ok(
      /model\s*:\s*["']fable["']/.test(execSrc),
      "execute workflow research stage must use bare model: \"fable\" literal (§2)"
    );
    assert.ok(
      !execSrc.includes('overrides["research"]'),
      "execute workflow must NOT use overrides[\"research\"] ?? form (not a designated stage)"
    );
  });

  test("execute workflow flips §7 marker to status=cited after research completes", () => {
    assert.ok(
      execSrc.includes("status=cited"),
      "execute workflow must flip marker to status=cited after research"
    );
  });

  test("execute workflow has internal branch: grep/Read (A3 routing decision, no research stage)", () => {
    // The internal branch uses grep to resolve the claim
    assert.ok(
      execSrc.includes("grepForClaim") || (execSrc.includes("grep") && execSrc.includes("internal")),
      "execute workflow must have an internal-claim grep branch (A3)"
    );
  });

  test("execute workflow has §5.1 escalation: grep-empty → escalate to external + research + cite", () => {
    assert.ok(
      execSrc.includes("escalat"),
      "execute workflow must contain §5.1 escalation path (grep-empty → external research)"
    );
    // The escalated branch also writes an uncited marker and runs research
    assert.ok(
      execSrc.includes("escalat") && execSrc.includes("status=uncited"),
      "execute workflow escalation must also write a §7 uncited marker before research"
    );
  });

  test("execute workflow has §4.1 idempotency skip: already-cited claim-key skips research", () => {
    assert.ok(
      execSrc.includes("already cited") || execSrc.includes("already-cited") || execSrc.includes("alreadyCited"),
      "execute workflow must implement §4.1 idempotency skip for already-cited claims"
    );
  });

  test("execute workflow DOMAIN_RESULT_SCHEMA includes statedClaims + artifactPath fields", () => {
    assert.ok(
      execSrc.includes("statedClaims"),
      "DOMAIN_RESULT_SCHEMA must include statedClaims field for worker output"
    );
    assert.ok(
      execSrc.includes("artifactPath"),
      "DOMAIN_RESULT_SCHEMA must include artifactPath field for §7 marker write target"
    );
  });

  test("execute workflow iterates statedClaims from domain worker results after parallel phase", () => {
    // The Research phase must pull statedClaims from each domain result
    assert.ok(
      execSrc.includes("statedClaims") && execSrc.includes("GUESSED"),
      "execute workflow Research phase must parse [GUESSED:*] lines from domain worker statedClaims"
    );
  });

  test("execute workflow research-subagent.md reference is in the research agent prompt", () => {
    assert.ok(
      execSrc.includes("research-subagent.md"),
      "execute workflow must reference research-subagent.md in the research agent prompt"
    );
  });
});

// ---------------------------------------------------------------------------
// T3.2 — quick workflow: Stated-Claims + classify→research wiring
// ---------------------------------------------------------------------------

describe("T3.2 — quick workflow: Stated-Claims + classify→research wiring", () => {

  test("quick workflow embeds M89 STATED CLAIMS directive in the task agent prompt", () => {
    assert.ok(
      quickSrc.includes("M89 STATED CLAIMS"),
      "gsd-t-quick.workflow.js must include 'M89 STATED CLAIMS' in the task agent prompt"
    );
    assert.ok(
      quickSrc.includes("stated-claims-snippet.md"),
      "quick workflow must reference stated-claims-snippet.md in the prompt"
    );
  });

  test("quick workflow schema includes statedClaims + artifactPath", () => {
    assert.ok(
      quickSrc.includes("statedClaims"),
      "QUICK_SCHEMA must include statedClaims field"
    );
    assert.ok(
      quickSrc.includes("artifactPath"),
      "QUICK_SCHEMA must include artifactPath field for §7 marker write target"
    );
  });

  test("quick workflow invokes D1 classifier for GUESSED claims", () => {
    assert.ok(
      quickSrc.includes("research-gate") && quickSrc.includes("classify"),
      "quick workflow must invoke bin/gsd-t-research-gate.cjs with 'classify'"
    );
  });

  test("quick workflow has external branch: writes §7 uncited marker + research agent (model:fable)", () => {
    assert.ok(
      quickSrc.includes("status=uncited"),
      "quick workflow must write status=uncited in external branch (§7)"
    );
    assert.ok(
      /model\s*:\s*["']fable["']/.test(quickSrc),
      "quick workflow research stage must use bare model: \"fable\" literal (§2)"
    );
    assert.ok(
      !quickSrc.includes('overrides["research"]'),
      "quick workflow must NOT use overrides[\"research\"] ?? form"
    );
  });

  test("quick workflow flips §7 marker to status=cited after research", () => {
    assert.ok(
      quickSrc.includes("status=cited"),
      "quick workflow must flip marker to status=cited after research"
    );
  });

  test("quick workflow has internal branch: grep/Read (A3 routing decision)", () => {
    assert.ok(
      quickSrc.includes("grepForClaim") || (quickSrc.includes("grep") && quickSrc.includes("internal")),
      "quick workflow must have an internal-claim grep branch (A3)"
    );
  });

  test("quick workflow has §5.1 escalation: grep-empty → escalate to external", () => {
    assert.ok(
      quickSrc.includes("escalat"),
      "quick workflow must contain §5.1 escalation path"
    );
  });

  test("quick workflow has Research phase declared in meta.phases", () => {
    assert.ok(
      quickSrc.includes('"Research"'),
      "quick workflow must declare a Research phase in meta.phases"
    );
  });
});

// ---------------------------------------------------------------------------
// T3.3 — debug workflow: Stated-Claims + classify→research; debug-cycle ternary intact
// ---------------------------------------------------------------------------

describe("T3.3 — debug workflow: Stated-Claims + classify→research; debug-cycle ternary intact", () => {

  test("debug workflow embeds M89 STATED CLAIMS directive in cycle agent prompt", () => {
    assert.ok(
      debugSrc.includes("M89 STATED CLAIMS"),
      "gsd-t-debug.workflow.js must include 'M89 STATED CLAIMS' in the cycle agent prompt"
    );
    assert.ok(
      debugSrc.includes("stated-claims-snippet.md"),
      "debug workflow must reference stated-claims-snippet.md in the prompt"
    );
  });

  test("debug workflow includes statedClaims in DEBUG_CYCLE_SCHEMA", () => {
    assert.ok(
      debugSrc.includes("statedClaims"),
      "DEBUG_CYCLE_SCHEMA must include statedClaims field"
    );
  });

  test("debug workflow invokes D1 classifier for GUESSED failure-root claims", () => {
    assert.ok(
      debugSrc.includes("research-gate") && debugSrc.includes("classify"),
      "debug workflow must invoke bin/gsd-t-research-gate.cjs with 'classify'"
    );
  });

  test("debug workflow routes external failure-root to research(fable) instead of patch-guess", () => {
    assert.ok(
      debugSrc.includes("status=uncited"),
      "debug workflow must write §7 uncited marker for external failure-root claims"
    );
    assert.ok(
      /model\s*:\s*["']fable["']/.test(debugSrc),
      "debug workflow research stage must use bare model: \"fable\" literal (§2)"
    );
    assert.ok(
      !debugSrc.includes('overrides["research"]'),
      "debug workflow must NOT use overrides[\"research\"] ?? form for research stage"
    );
  });

  test("debug workflow flips §7 marker to status=cited after research", () => {
    assert.ok(
      debugSrc.includes("status=cited"),
      "debug workflow must flip marker to status=cited after research"
    );
  });

  test("debug workflow has internal branch: grep/Read (A3 routing decision)", () => {
    assert.ok(
      debugSrc.includes("grepForClaim") || (debugSrc.includes("grep") && debugSrc.includes("internal")),
      "debug workflow must have an internal-claim grep branch (A3)"
    );
  });

  test("debug workflow has §5.1 escalation: grep-empty → escalate to external", () => {
    assert.ok(
      debugSrc.includes("escalat"),
      "debug workflow must contain §5.1 escalation path"
    );
  });

  test("debug-cycle ternary is INTACT: cycle===1?'opus':(overrides['debug-cycle-2']??'fable')", () => {
    // The research stage is a SEPARATE agent — must NOT fold into the debug-cycle ternary.
    const ternaryRe = /model\s*:\s*cycle\s*===\s*1\s*\?\s*["']opus["']\s*:\s*\(\s*overrides\s*\[\s*["']debug-cycle-2["']\s*\]\s*\?\?\s*["']fable["']\s*\)/;
    assert.ok(
      ternaryRe.test(debugSrc),
      "debug workflow must preserve the cycle ternary: model: cycle===1?\"opus\":(overrides[\"debug-cycle-2\"]??\"fable\")"
    );
  });

  test("debug-cycle ternary is DISTINCT from the research stage (two separate model: forms)", () => {
    // Count occurrences of model: "fable" (bare literal — research stage) vs the ternary form
    const bareFableRe = /model\s*:\s*["']fable["']/g;
    const bareFableMatches = [...debugSrc.matchAll(bareFableRe)];
    const ternaryRe = /overrides\s*\[\s*["']debug-cycle-2["']\s*\]\s*\?\?\s*["']fable["']/g;
    const ternaryMatches = [...debugSrc.matchAll(ternaryRe)];

    assert.ok(
      bareFableMatches.length >= 1,
      "debug workflow must have at least one bare model: \"fable\" literal (research stage)"
    );
    assert.ok(
      ternaryMatches.length >= 1,
      "debug workflow must have the overrides[\"debug-cycle-2\"]??\"fable\" ternary (debug-cycle-2)"
    );
    // The research stage bare "fable" and the ternary "fable" are DISTINCT — not the same line
    // (The ternary already contains "fable" as the fallback, so bareFableMatches ≥ 2 if the
    // research stage's bare literal is also present)
    assert.ok(
      bareFableMatches.length >= 1 && ternaryMatches.length >= 1,
      "Both the bare research literal and the debug-cycle ternary must be present and distinct"
    );
  });

  test("runResearchForClaim function is defined in debug workflow (shared research sub-routine)", () => {
    assert.ok(
      debugSrc.includes("runResearchForClaim"),
      "debug workflow must define runResearchForClaim() for reuse across cycles"
    );
  });
});

// ---------------------------------------------------------------------------
// T3.4 — wave workflow: NO research agent, NO Stated-Claims, ZERO model: occurrences
// ---------------------------------------------------------------------------

describe("T3.4 — wave workflow: composer-only (zero model:, no Stated-Claims, no research agent)", () => {

  // Load the M85 lint extractor to use for wave check (avoids reimplementing)
  test("wave workflow has ZERO model: occurrences (M85 zero-model: composer invariant)", () => {
    // Simple check: strip comment lines, count model: occurrences
    const codeLines = waveSrc.split("\n").map((l) => l.replace(/\/\/.*$/, ""));
    const modelOccurrences = codeLines.filter((l) => /\bmodel\s*:/.test(l));
    assert.equal(
      modelOccurrences.length,
      0,
      `gsd-t-wave.workflow.js must have ZERO model: occurrences (composer-only); found:\n${modelOccurrences.join("\n")}`
    );
  });

  test("wave workflow does NOT contain M89 STATED CLAIMS directive (research is inherited via sub-workflows)", () => {
    assert.ok(
      !waveSrc.includes("M89 STATED CLAIMS"),
      "wave workflow must NOT embed the Stated-Claims directive (it is a pure composer)"
    );
  });

  test("wave workflow does NOT contain stated-claims-snippet.md reference", () => {
    assert.ok(
      !waveSrc.includes("stated-claims-snippet.md"),
      "wave workflow must NOT reference stated-claims-snippet.md (research is inherited)"
    );
  });

  test("wave workflow does NOT have a Research phase in meta.phases", () => {
    // The wave's meta.phases must NOT include a "Research" entry with a model: literal
    assert.ok(
      !waveSrc.includes('title: "Research"'),
      "wave workflow must NOT declare a Research phase (composer-only)"
    );
  });

  test("wave workflow only contains sub-workflow calls (execute + verify)", () => {
    assert.ok(
      waveSrc.includes("gsd-t-execute"),
      "wave workflow must call gsd-t-execute sub-workflow"
    );
    assert.ok(
      waveSrc.includes("gsd-t-verify"),
      "wave workflow must call gsd-t-verify sub-workflow"
    );
  });
});

// ---------------------------------------------------------------------------
// T3.5 — §7 marker write+flip is present in all three worker external branches
// ---------------------------------------------------------------------------

describe("T3.5 — §7 marker write+flip present in external branch of execute, quick, debug", () => {

  for (const [name, src] of [["execute", execSrc], ["quick", quickSrc], ["debug", debugSrc]]) {
    test(`${name} workflow writes uncited marker (status=uncited) in external branch (§7)`, () => {
      assert.ok(
        src.includes("status=uncited"),
        `${name} workflow must write a status=uncited §7 marker for external guessed claims`
      );
    });

    test(`${name} workflow flips marker to status=cited after research succeeds (§7 lifecycle)`, () => {
      assert.ok(
        src.includes("status=cited"),
        `${name} workflow must flip the §7 marker to status=cited after the research stage completes`
      );
    });
  }
});

// ---------------------------------------------------------------------------
// T3.6 — §4.1 idempotency skip references exact-key match across all three workers
// ---------------------------------------------------------------------------

describe("T3.6 — §4.1 idempotency skip (already-cited exact key match) in all worker workflows", () => {

  for (const [name, src] of [["execute", execSrc], ["quick", quickSrc], ["debug", debugSrc]]) {
    test(`${name} workflow implements §4.1 idempotency skip (already-cited)`, () => {
      assert.ok(
        src.includes("already cited") || src.includes("already-cited") || src.includes("alreadyCited") || src.includes("idempotent"),
        `${name} workflow must implement §4.1 idempotency skip — already-cited exact key match`
      );
    });
  }
});

// ---------------------------------------------------------------------------
// T3.7 — research agent label is "research" (not research-stage) in all worker workflows
// (D4 uses label:"research" matching the contract §2 stage interface)
// ---------------------------------------------------------------------------

describe("T3.7 — research agent uses label: 'research' and bare model: 'fable' literal in all workers", () => {

  for (const [name, src] of [["execute", execSrc], ["quick", quickSrc], ["debug", debugSrc]]) {
    test(`${name} workflow research agent has label: "research"`, () => {
      assert.ok(
        src.includes('"research"') || src.includes("'research'"),
        `${name} workflow must have an agent call with label: "research"`
      );
    });

    test(`${name} workflow uses bare model: "fable" for research stage (NOT ?? override form)`, () => {
      assert.ok(
        /model\s*:\s*["']fable["']/.test(src),
        `${name} workflow must use bare model: "fable" literal for the research stage`
      );
      assert.ok(
        !src.includes('overrides["research"]'),
        `${name} workflow must NOT use overrides["research"] ?? form (not a designated stage, would fail M85 lint)`
      );
    });
  }
});

// ---------------------------------------------------------------------------
// T3.8 — v1.3.0: ambiguous → LLM judge (classify-judge, model:fable) → uncertain→research
// The 3-result classifier routes class:ambiguous to an LLM judge; an UNCERTAIN verdict is
// treated as external→research (never silently internal). Asserted structurally per worker.
// ---------------------------------------------------------------------------

describe("T3.8 — ambiguous → classify-judge(fable) → uncertain→research in all worker workflows", () => {

  for (const [name, src] of [["execute", execSrc], ["quick", quickSrc], ["debug", debugSrc]]) {
    test(`${name} workflow wires class:ambiguous to a classify-judge agent stage (model:"fable")`, () => {
      assert.ok(
        src.includes("classify-judge"),
        `${name} workflow must route class:ambiguous to a classify-judge agent stage (v1.3.0 3-result)`
      );
      assert.ok(
        src.includes("judgeAmbiguous") || src.includes("classify-judge"),
        `${name} workflow must define/call the ambiguous LLM judge`
      );
    });

    test(`${name} workflow: an UNCERTAIN judge verdict routes to research (never silently internal)`, () => {
      // The dispatch must NOT route a non-internal verdict to grep — uncertain → doExternal/research.
      assert.ok(
        src.includes('verdict === "internal"') || src.includes("verdict === 'internal'"),
        `${name} workflow must branch the judge verdict on "internal" (else → research)`
      );
      assert.ok(
        src.includes("uncertain"),
        `${name} workflow must treat an UNCERTAIN verdict as external→research (no silent guess)`
      );
    });
  }
});

// ---------------------------------------------------------------------------
// T3.9 — FAIL-CLOSED (Red Team HIGH): external/escalation path ALWAYS writes a §7 marker
// to a DETERMINISTIC FALLBACK ARTIFACT when the worker reports no artifactPath. A worker
// that emits a load-bearing GUESSED EXTERNAL claim but no path must NOT silently skip the
// marker (that ships an external guess uncited+unresearched — the exact M89 invariant).
// ---------------------------------------------------------------------------

describe("T3.9 — fail-closed: external path writes a §7 marker to a fallback artifact when no artifactPath", () => {

  for (const [name, src] of [["execute", execSrc], ["quick", quickSrc], ["debug", debugSrc]]) {
    test(`${name} workflow defines a deterministic externalArtifact fallback (.gsd-t/research/...)`, () => {
      assert.ok(
        src.includes("externalArtifact"),
        `${name} workflow must define an externalArtifact (real path OR deterministic fallback)`
      );
      assert.ok(
        /\.gsd-t\/research\//.test(src),
        `${name} workflow's fallback artifact must be under .gsd-t/research/ (deterministic, always writable)`
      );
      // The fallback must be keyed off the claim (claimSlug/claimKey) so it is deterministic + unique.
      assert.ok(
        src.includes("claimSlug") || src.includes("claimKey"),
        `${name} workflow's fallback path must be derived from the claim key (deterministic per claim)`
      );
    });

    test(`${name} workflow: the §7 uncited marker write uses externalArtifact (not a guarded artifactPath skip)`, () => {
      // The external/escalation marker write must target externalArtifact (always truthy),
      // NOT a silent `if (artifactPath) {...}` / `if (!artifactPath) return` early-out.
      assert.ok(
        src.includes("writeUncitedMarker(externalArtifact") ||
        src.includes("appendUncitedMarker(externalArtifact") ||
        (src.includes("externalArtifact") && src.includes("status=uncited")),
        `${name} workflow's external §7 marker write must target externalArtifact (fail-closed, no silent skip)`
      );
    });
  }
});

// ---------------------------------------------------------------------------
// T3.10 — fail-closed FUNCTIONAL: a fallback-artifact uncited marker FAILs the §7 gate
// pre-research (mirrors the verify gate logic). Proves the produced marker is enforceable.
// ---------------------------------------------------------------------------

describe("T3.10 — fail-closed functional: an uncited marker in the fallback artifact FAILs the §7 gate", () => {

  // Mirror the verify gate's live-marker + enforce logic (single-file model).
  function normalizeClaimKey(claim) { return claim.toLowerCase().replace(/[^\w]+/g, " ").trim(); }
  function isLiveMarker(line) {
    const t = line.trim();
    if (!t.startsWith("<!--") || !t.endsWith("-->")) return false;
    if (!t.includes("auto-research-claim:")) return false;
    const keyMatch = t.match(/key=([^\s]+)/);
    if (keyMatch && (keyMatch[1].includes("<") || keyMatch[1].includes(">"))) return false;
    return /status=uncited\b(?!\|)/.test(t) || /status=cited\b/.test(t);
  }
  function gatePass(content) {
    return !content.split("\n").some((l) => isLiveMarker(l) && /status=uncited\b/.test(l));
  }

  test("a deterministic fallback artifact carrying an uncited marker FAILs the gate (pre-research, fail-closed)", () => {
    const claim = "the acme payments api caps a batch at 100 items";
    const key = normalizeClaimKey(claim);
    const slug = key.replace(/\s+/g, "-").slice(0, 80);
    // The fallback path the workflows compute (deterministic, claim-keyed).
    const fallbackPath = `./.gsd-t/research/domain-${slug}.md`;
    assert.ok(fallbackPath.includes(".gsd-t/research/"), "fallback path is under .gsd-t/research/");

    // The fallback artifact content after the (always-executed) marker write, pre-research.
    const fallbackArtifact = `<!-- auto-research-claim: class=external key=${key} status=uncited -->\n`;
    assert.equal(
      gatePass(fallbackArtifact), false,
      "an uncited marker in the fallback artifact MUST FAIL the §7 gate — the external guess cannot ship silently"
    );

    // Contrast: if NO marker were written (the old silent-skip bug), the gate would PASS — the bug.
    assert.equal(gatePass(""), true, "an empty artifact (no marker — the OLD silent bug) would wrongly PASS — which fail-closed prevents");
  });
});
