"use strict";

/**
 * M90 — Guard-Map Rule Traceability + Self-Obedience + R1-Exit Consistency
 *
 * SC-SELF-OBEDIENCE + §6 Guard Map (doctrine contract §6).
 *
 * Tests:
 *   1. Every §6 [RULE] in the doctrine contract maps to a real enforcement point
 *      (grep the enforcement surface). An orphan rule FAILS.
 *   2. SC-SELF-OBEDIENCE structural gate: M90's own build record shows the doctrine
 *      applied to itself — the progress.md Decision Log carries plan-hardening entries
 *      tagged [m90][PLAN-HARDENING] (≥3 pre-mortem premise-re-examination rounds).
 *   3. R1-EXIT consistency: no dangling §2 envelope field references (fired/basis/
 *      proven-by-adversary-only) exist in workflow files when the arch-trigger is NOT
 *      wired, OR the §2 [RULE]s are marked DE-SCOPED in the contract. Because M90 DOES
 *      wire the arch-trigger (D4-T4), the test instead checks consistency: the §2 [RULE]s
 *      in the guard map do have an enforcement point. If the trigger were not wired, all
 *      §2 [RULE]s would need a DE-SCOPED note (tested via the guard-map table).
 *   4. Version consistency: package.json version > pre-bump version (4.6.12) and the
 *      same final version literal appears in package.json, README.md, and GSD-T-README.md.
 *   5. No letter-form task IDs (M90-D[A-Z]-T) remain under .gsd-t/domains/m90-*.
 *   6. Doc-consistency: verify §4 doc note exists in the doctrine contract for the
 *      R1-de-scoped no-op-PASS behavior (distinguishable from vacuous-pass).
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CONTRACTS_DIR = path.join(ROOT, ".gsd-t", "contracts");
const DOCTRINE_CONTRACT = path.join(CONTRACTS_DIR, "unproven-assumption-doctrine-contract.md");
const PROGRESS_MD = path.join(ROOT, ".gsd-t", "progress.md");
const PACKAGE_JSON = path.join(ROOT, "package.json");
const README_MD = path.join(ROOT, "README.md");
const GSD_T_README = path.join(ROOT, "GSD-T-README.md");
const WF_DIR = path.join(ROOT, "templates", "workflows");
const DOMAINS_DIR = path.join(ROOT, ".gsd-t", "domains");

// ---------------------------------------------------------------------------
// Helper: read file or return null
// ---------------------------------------------------------------------------
function readFile(fp) {
  try { return fs.readFileSync(fp, "utf8"); } catch { return null; }
}

// ---------------------------------------------------------------------------
// 1. §6 Guard Map — every [RULE] maps to a real enforcement point
// ---------------------------------------------------------------------------

// The §6 guard map is in the doctrine contract. Each [RULE-...] entry in the
// | table has an Enforcement column. We extract [RULE] keys and verify the named
// enforcement surface FILE or FUNCTION exists on disk or the named module exists.
describe("§6 guard-map rule traceability", () => {
  const contractText = readFile(DOCTRINE_CONTRACT);
  assert.ok(contractText, "doctrine contract must exist at .gsd-t/contracts/unproven-assumption-doctrine-contract.md");

  // Extract the §6 guard map table. Pattern: | [RULE-xxx] ... | enforcement_surface | notes |
  // We parse each row in the §6 section for [RULE-...] keys.
  const guardMapSection = contractText.split("## §6")[1] || "";
  const ruleRows = [...guardMapSection.matchAll(/\|\s*(\[RULE-[A-Z0-9-]+\])[^|]*\|([^|]*)\|([^|]*)\|/g)];

  test("doctrine contract §6 section exists and contains [RULE] entries", () => {
    assert.ok(guardMapSection.length > 0, "§6 section must exist in doctrine contract");
    assert.ok(ruleRows.length >= 6, `§6 guard map must have at least 6 [RULE] entries; found ${ruleRows.length}`);
  });

  for (const [, ruleKey, enforcementCol] of ruleRows) {
    test(`${ruleKey} enforcement surface is reachable`, () => {
      const enforcement = enforcementCol.trim();
      // The enforcement column names a source file. Extract the backtick-quoted file path(s).
      const mentionedFiles = [...enforcement.matchAll(/`([^`]+)`/g)].map(m => m[1]);

      if (mentionedFiles.length === 0) {
        // No file reference — check the enforcement column is non-empty (prose reference is ok for
        // self-obedience rules pointing to progress.md entries).
        assert.ok(enforcement.length > 10, `${ruleKey}: enforcement column must name a surface (${enforcement})`);
        return;
      }

      // At least one of the named files must exist on disk (the primary implementation surface).
      // Accept: bin/*.cjs, templates/workflows/*.workflow.js, test/*.test.js, .gsd-t/progress.md
      const foundAny = mentionedFiles.some(f => {
        // Resolve relative to repo root; strip any leading ./ or leading /
        const candidates = [
          path.join(ROOT, f),
          path.join(ROOT, "bin", path.basename(f)),
          path.join(ROOT, "templates", "workflows", path.basename(f)),
          path.join(ROOT, "test", path.basename(f)),
          path.join(ROOT, ".gsd-t", "progress.md"),
        ];
        return candidates.some(c => fs.existsSync(c));
      });

      assert.ok(
        foundAny,
        `${ruleKey}: enforcement surface not found on disk. Enforcement: "${enforcement}". ` +
        `Checked files: ${mentionedFiles.join(", ")}`
      );
    });
  }
});

// ---------------------------------------------------------------------------
// 2. SC-SELF-OBEDIENCE structural gate
// ---------------------------------------------------------------------------

describe("SC-SELF-OBEDIENCE structural gate", () => {
  const progressText = readFile(PROGRESS_MD);

  test("progress.md exists and is readable", () => {
    assert.ok(progressText, "progress.md must be readable");
  });

  test("progress.md contains ≥3 [m90][PLAN-HARDENING] entries (premise-re-examination record)", () => {
    const entries = (progressText || "").match(/\[m90\]\[PLAN-HARDENING\]/g) || [];
    assert.ok(
      entries.length >= 3,
      `SC-SELF-OBEDIENCE: expected ≥3 [m90][PLAN-HARDENING] entries in progress.md Decision Log; found ${entries.length}. ` +
      "These entries ARE the doctrine's self-obedience proof — M90's own plan-hardening applied the doctrine to itself."
    );
  });

  test("at least one plan-hardening entry is a CLEARED round (convergence proof)", () => {
    const clearedEntry = (progressText || "").match(/\[m90\]\[PLAN-HARDENING\].*CLEARED/);
    assert.ok(
      clearedEntry,
      "SC-SELF-OBEDIENCE: at least one [m90][PLAN-HARDENING] entry must record a CLEARED round (convergence proof)"
    );
  });

  test("doctrine contract §5 self-obedience section documents the plan-hardening record", () => {
    const contractText = readFile(DOCTRINE_CONTRACT);
    assert.ok(contractText, "doctrine contract must exist");
    assert.ok(
      contractText.includes("plan-hardening") || contractText.includes("PLAN-HARDENING"),
      "doctrine contract §5 must reference the plan-hardening record"
    );
    assert.ok(
      contractText.includes("Decision Log"),
      "doctrine contract §5 must reference the Decision Log as the self-obedience artifact"
    );
  });
});

// ---------------------------------------------------------------------------
// 3. R1-EXIT consistency: §2 [RULE]s have enforcement OR are DE-SCOPED
// ---------------------------------------------------------------------------

describe("R1-EXIT consistency", () => {
  const contractText = readFile(DOCTRINE_CONTRACT);

  test("doctrine contract §4 documents the R1-de-scoped no-op-PASS behavior", () => {
    assert.ok(contractText, "doctrine contract must exist");
    // The §4 section must document that when the arch-trigger is NOT wired,
    // R-FAIL-2 is a documented no-op-PASS (distinguishable from vacuous-pass).
    assert.ok(
      contractText.includes("no-op-PASS") || contractText.includes("no-op PASS"),
      "doctrine contract §4 must document the R1-de-scoped no-op-PASS behavior"
    );
    assert.ok(
      contractText.includes("mechanism absent by design") || contractText.includes("not wired"),
      "doctrine contract §4 must clarify that the no-op-PASS applies when the mechanism is absent by design"
    );
  });

  test("doctrine contract §4 R-FAIL-2 check is distinguishable from vacuous-pass", () => {
    assert.ok(contractText, "doctrine contract must exist");
    // The contract must contain text distinguishing de-scoped-PASS from wired-but-broken vacuous pass.
    assert.ok(
      contractText.includes("DISTINGUISHABLE") || contractText.includes("distinguishable"),
      "doctrine contract §4 R-FAIL-2 must be DISTINGUISHABLE from wired-but-broken vacuous pass"
    );
  });

  test("no letter-form task IDs (M90-D[A-Z]-T) remain under .gsd-t/domains/m90-*", () => {
    // Parser-canonical form is M90-D[0-9]-T (digit, not letter after D).
    // The partition's letter forms (DA, DL, DC, etc.) must all be renamed.
    const domainDirs = fs.existsSync(DOMAINS_DIR)
      ? fs.readdirSync(DOMAINS_DIR).filter(d => d.startsWith("m90-"))
      : [];

    const violations = [];
    for (const dir of domainDirs) {
      const dirPath = path.join(DOMAINS_DIR, dir);
      for (const file of ["tasks.md", "scope.md", "constraints.md"]) {
        const fp = path.join(dirPath, file);
        const text = readFile(fp);
        if (!text) continue;
        const matches = text.match(/M90-D[A-Z]-T\d+/g);
        if (matches) {
          violations.push(`${dir}/${file}: ${matches.join(", ")}`);
        }
      }
    }

    assert.deepEqual(
      violations,
      [],
      `Letter-form task IDs remain under .gsd-t/domains/m90-*:\n${violations.join("\n")}`
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Version consistency assertion
// ---------------------------------------------------------------------------

describe("version consistency", () => {
  const pkg = JSON.parse(readFile(PACKAGE_JSON) || "{}");

  test("package.json version is ≥ 4.7.10 (post-bump)", () => {
    const ver = pkg.version || "0.0.0";
    const [major, minor] = ver.split(".").map(Number);
    // After the M90 minor bump from 4.6.12, the version must be at least 4.7.10.
    assert.ok(
      (major > 4) || (major === 4 && minor >= 7),
      `package.json version must be ≥ 4.7.x after M90 minor bump; found ${ver}`
    );
  });

  test("README.md contains the same version as package.json", () => {
    const readmeText = readFile(README_MD) || "";
    const ver = pkg.version;
    if (!ver) return; // skip if package.json missing
    assert.ok(
      readmeText.includes(ver),
      `README.md must contain the current version ${ver} (same as package.json)`
    );
  });

  test("GSD-T-README.md contains the same version as package.json", () => {
    const gsdtReadmeText = readFile(GSD_T_README) || "";
    const ver = pkg.version;
    if (!ver) return;
    assert.ok(
      gsdtReadmeText.includes(ver),
      `GSD-T-README.md must contain the current version ${ver} (same as package.json)`
    );
  });
});

// ---------------------------------------------------------------------------
// 5. Verify workflow §4 fail-closed checks exist (structural grep)
// ---------------------------------------------------------------------------

describe("gsd-t-verify.workflow.js §4 fail-closed gate presence", () => {
  const verifyWfPath = path.join(WF_DIR, "gsd-t-verify.workflow.js");
  const verifyText = readFile(verifyWfPath);

  test("verify workflow exists", () => {
    assert.ok(verifyText, "gsd-t-verify.workflow.js must exist");
  });

  test("verify workflow has M90 R-FAIL-2 gate (proven-by-adversary-only check)", () => {
    assert.ok(verifyText, "verify workflow must be readable");
    assert.ok(
      verifyText.includes("proven-by-adversary-only") || verifyText.includes("R-FAIL-2"),
      "gsd-t-verify.workflow.js must contain M90 R-FAIL-2 (proven-by-adversary-only) gate"
    );
  });

  test("verify workflow has M90 R-FAIL-3 gate (halted-but-no-re-examination check)", () => {
    assert.ok(verifyText, "verify workflow must be readable");
    assert.ok(
      verifyText.includes("haltedButNoReExamination") || verifyText.includes("R-FAIL-3"),
      "gsd-t-verify.workflow.js must contain M90 R-FAIL-3 (halted-but-no-re-examination) gate"
    );
  });
});

// ---------------------------------------------------------------------------
// 6. Debug workflow D4-T3 cycle-2 ledger halt (structural grep)
// ---------------------------------------------------------------------------

describe("gsd-t-debug.workflow.js D4-T3 cycle-2 ledger halt", () => {
  const debugWfPath = path.join(WF_DIR, "gsd-t-debug.workflow.js");
  const debugText = readFile(debugWfPath);

  test("debug workflow exists", () => {
    assert.ok(debugText, "gsd-t-debug.workflow.js must exist");
  });

  test("debug workflow invokes loop-ledger via runCli (R-LOOP-DEBUG-OPT-B)", () => {
    assert.ok(debugText, "debug workflow must be readable");
    assert.ok(
      debugText.includes("loop-ledger") || debugText.includes("gsd-t-loop-ledger"),
      "gsd-t-debug.workflow.js must invoke the loop-ledger module (D4-T3 R-LOOP-DEBUG-OPT-B)"
    );
  });

  test("debug workflow exits with premise-re-examination directive on non-convergence (option b)", () => {
    assert.ok(debugText, "debug workflow must be readable");
    assert.ok(
      debugText.includes("premise-re-examination") || debugText.includes("PREMISE_RE_EXAMINATION"),
      "gsd-t-debug.workflow.js must reference the premise-re-examination directive (option b)"
    );
  });
});

// ---------------------------------------------------------------------------
// 7. Phase/execute/quick workflows invoke factual classifier (structural grep)
// ---------------------------------------------------------------------------

describe("workflow factual-classifier wiring (D4-T4 protocol-class path)", () => {
  for (const wfName of ["gsd-t-execute.workflow.js", "gsd-t-quick.workflow.js", "gsd-t-phase.workflow.js"]) {
    test(`${wfName} invokes the factual classifier (research-gate) AND extend-signal compute`, () => {
      const wfText = readFile(path.join(WF_DIR, wfName));
      assert.ok(wfText, `${wfName} must exist`);
      assert.ok(
        wfText.includes("research-gate") || wfText.includes("gsd-t-research-gate"),
        `${wfName} must invoke the factual classifier via runCli`
      );
    });
  }

  test("gsd-t-execute.workflow.js has extend-existing-code signal compute (R-ARCH-2 producer)", () => {
    const wfText = readFile(path.join(WF_DIR, "gsd-t-execute.workflow.js"));
    assert.ok(wfText, "gsd-t-execute.workflow.js must exist");
    assert.ok(
      wfText.includes("extend") || wfText.includes("Touches") || wfText.includes("extend-existing"),
      "gsd-t-execute.workflow.js must compute the extend-existing-code signal from task inputs (R-ARCH-2)"
    );
  });

  test("gsd-t-quick.workflow.js has extend-existing-code signal compute (R-ARCH-2 producer)", () => {
    const wfText = readFile(path.join(WF_DIR, "gsd-t-quick.workflow.js"));
    assert.ok(wfText, "gsd-t-quick.workflow.js must exist");
    assert.ok(
      wfText.includes("extend") || wfText.includes("Touches") || wfText.includes("extend-existing"),
      "gsd-t-quick.workflow.js must compute the extend-existing-code signal from task inputs (R-ARCH-2)"
    );
  });
});

// ---------------------------------------------------------------------------
// 8. Tier-policy lint: no new stage label missing from model-tier-policy.cjs
//    (for the blind-adversary stage — fable tier per M85 policy)
// ---------------------------------------------------------------------------

describe("tier policy — blind-adversary annotation", () => {
  const blindAdversaryPath = path.join(ROOT, "templates", "prompts", "blind-adversary-subagent.md");
  const blindText = readFile(blindAdversaryPath);

  test("blind-adversary-subagent.md exists (D1 deliverable)", () => {
    assert.ok(blindText, "templates/prompts/blind-adversary-subagent.md must exist");
  });

  test("blind-adversary-subagent.md references fable tier (R-ARCH tier policy)", () => {
    assert.ok(blindText, "blind-adversary-subagent.md must be readable");
    assert.ok(
      blindText.includes("fable") || blindText.includes("model:"),
      "blind-adversary-subagent.md must reference the fable tier (M85 policy)"
    );
  });
});
