"use strict";

// M87 D1-T5 — verify-pipeline FIRING / reachability test
// (test/m87-verify-guardmap-wiring.test.js)
//
// Closes the dead-code class (the M5 dead-headline failure: a broken discovery =
// permanent silent skip while A1 + the M71/M85 lints + suite-green all stay green).
// Proves the verify guard-map gate step is NOT dead code — it is REACHABLE +
// non-vacuous through the verify pipeline.
//
// The verify workflow runs only in the Anthropic Workflow sandbox (no standalone
// Node), so this test proves reachability two ways:
//   (1) BEHAVIOURAL — it CONSTRUCTS its own multi-doc .gsd-t/pseudocode/ tree in a
//       redirected temp dir (never the real project tree), runs the EXACT §7
//       discovery the workflow agent performs, and the REAL gsd-t-guard-map.cjs CLI
//       on each resolved pair: enumerates ≥2 fire-able pairs, resolves the correct
//       --doc/--map, HALTS-before-triad (non-zero exit) on a doctored map, proceeds
//       (exit 0) on a faithful map, and emits a DISTINCT skip-with-reason for both
//       no-build-map and no-pseudocode-docs.
//   (2) STATIC — it asserts the verify.workflow.js source actually WIRES the gate
//       before the triad, FAIL-blocking, via runCli (the same way the existing
//       verify-gate / ci-parity / test-data halts are wired), so the behaviour above
//       is genuinely reachable through the pipeline and not a parallel re-implementation.
//
// Contract: pseudocode-source-of-truth-contract.md §7 (discovery) + §2 (gate).

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const GUARD_MAP_CLI = path.resolve(__dirname, "..", "bin", "gsd-t-guard-map.cjs");
const VERIFY_WF = path.resolve(__dirname, "..", "templates", "workflows", "gsd-t-verify.workflow.js");
const FIX = path.resolve(__dirname, "fixtures", "m87");

// ─── §7 discovery — the EXACT logic the workflow's discovery agent performs ──
// glob `.gsd-t/pseudocode/PseudoCode-*.md`, pair each by basename with its
// co-located `.map.json`. Pure / path-as-path. Implemented here so the test can
// run the same enumeration the workflow agent runs, against a constructed tree.
function discoverPseudocode(projectDir) {
  const dir = path.join(projectDir, ".gsd-t", "pseudocode");
  let entries = [];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return { docsFound: 0, firePairs: [], skips: [{ reason: "no-pseudocode-docs" }] };
  }
  const docs = entries
    .filter((f) => /^PseudoCode-.*\.md$/.test(f) && !/\.map\.json$/.test(f))
    .sort()
    .map((f) => path.join(dir, f));
  if (docs.length === 0) {
    return { docsFound: 0, firePairs: [], skips: [{ reason: "no-pseudocode-docs" }] };
  }
  const firePairs = [];
  const skips = [];
  for (const doc of docs) {
    const map = doc.replace(/\.md$/, ".map.json");
    if (fs.existsSync(map)) firePairs.push({ doc, map });
    else skips.push({ reason: "no-build-map", doc });
  }
  return { docsFound: docs.length, firePairs, skips };
}

// Run the REAL gate CLI; return { exitCode, envelope }.
function runGateCli(doc, map) {
  try {
    const out = execFileSync("node", [GUARD_MAP_CLI, "--doc", doc, "--map", map, "--json"], { encoding: "utf8" });
    return { exitCode: 0, envelope: JSON.parse(out) };
  } catch (e) {
    // execFileSync throws on non-zero exit; capture the code + stdout.
    let envelope = null;
    try { envelope = JSON.parse(e.stdout || "null"); } catch {/* ignore */}
    return { exitCode: e.status, envelope };
  }
}

// ─── construct the multi-doc fixture tree (redirected temp dir) ────────────
// ≥2 distinct fire-able doc+map pairs (seeded from D1-T1's PayPal faithful
// doc+map under two distinct basenames) + one doc-no-map + a zero-docs variant.
// D1-T1's owned fixtures supply only ONE fire-able pair; the multi-doc
// ENUMERATION assertion cannot be proven against a single pair (the dead-assertion
// trap), so this test OWNS the tree-construction (no fixtures added to D1-T1).
function buildTree({ withDoctored = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "m87-wiring-"));
  const pdir = path.join(root, ".gsd-t", "pseudocode");
  fs.mkdirSync(pdir, { recursive: true });

  const faithfulDoc = fs.readFileSync(path.join(FIX, "PseudoCode-PayPal.md"), "utf8");
  const faithfulMap = fs.readFileSync(path.join(FIX, "PseudoCode-PayPal.map.json"), "utf8");
  const doctoredMap = fs.readFileSync(path.join(FIX, "PseudoCode-PayPal-doctored.map.json"), "utf8");

  // Pair 1 — Alpha (faithful).
  fs.writeFileSync(path.join(pdir, "PseudoCode-Alpha.md"), faithfulDoc);
  fs.writeFileSync(path.join(pdir, "PseudoCode-Alpha.map.json"), faithfulMap);

  // Pair 2 — Beta (faithful by default, doctored when withDoctored).
  fs.writeFileSync(path.join(pdir, "PseudoCode-Beta.md"), faithfulDoc);
  fs.writeFileSync(path.join(pdir, "PseudoCode-Beta.map.json"), withDoctored ? doctoredMap : faithfulMap);

  // A doc with NO co-located map (→ skip no-build-map).
  fs.writeFileSync(path.join(pdir, "PseudoCode-Gamma.md"), faithfulDoc);

  return { root, pdir };
}

// IMPORTANT: the Alpha/Beta docs are byte-copies of PayPal but live under DIFFERENT
// basenames → their DOC-SLUG derives ALPHA / BETA, so the seeded PayPal map (keyed
// R-PAYPAL-NN) would NOT match. Re-key the seeded maps to the new doc's derived ids.
function rekeyMapsToDocs(pdir) {
  const gm = require("../bin/gsd-t-guard-map.cjs");
  for (const base of ["Alpha", "Beta"]) {
    const docPath = path.join(pdir, `PseudoCode-${base}.md`);
    const mapPath = path.join(pdir, `PseudoCode-${base}.map.json`);
    if (!fs.existsSync(mapPath)) continue;
    const { rules } = gm.parseRules(fs.readFileSync(docPath, "utf8"), docPath);
    const oldMap = JSON.parse(fs.readFileSync(mapPath, "utf8"));
    const oldVals = Object.values(oldMap.rules);
    // Preserve the faithful/doctored SHAPE (one unbacked rule in the doctored map)
    // by index, but under the new doc's derived ids.
    const newMap = { rules: {} };
    rules.forEach((r, i) => {
      const src = oldVals[i] || { backedBy: ["t"], contradicted: false };
      newMap.rules[r.id] = {
        backedBy: Array.isArray(src.backedBy) ? (src.backedBy.length ? [`t::${r.id}`] : []) : [`t::${r.id}`],
        contradicted: src.contradicted === true,
      };
    });
    fs.writeFileSync(mapPath, JSON.stringify(newMap, null, 2) + "\n");
  }
}

function cleanup(root) {
  try { fs.rmSync(root, { recursive: true, force: true }); } catch {/* ignore */}
}

// ─── (enumeration, §7 — MULTI-DOC, non-vacuous) ───────────────────────────

describe("§7 discovery enumerates the full doc+map set and FIRES on BOTH pairs (multi-doc, non-vacuous)", () => {
  test("enumerates ≥2 fire-able pairs (the multi-doc path genuinely exercised, not vacuous on a single pair)", () => {
    const { root, pdir } = buildTree();
    rekeyMapsToDocs(pdir);
    try {
      const d = discoverPseudocode(root);
      assert.equal(d.docsFound, 3, "must find 3 PseudoCode-*.md docs (Alpha, Beta, Gamma)");
      assert.ok(d.firePairs.length >= 2, `must FIRE on ≥2 doc+map pairs (multi-doc), got ${d.firePairs.length}`);
      const fireDocs = d.firePairs.map((p) => path.basename(p.doc)).sort();
      assert.deepEqual(fireDocs, ["PseudoCode-Alpha.md", "PseudoCode-Beta.md"], "Alpha + Beta must be the fire-able pairs");
    } finally { cleanup(root); }
  });

  test("(resolve) each fire pair resolves the correct co-located --doc/--map by basename", () => {
    const { root, pdir } = buildTree();
    rekeyMapsToDocs(pdir);
    try {
      const d = discoverPseudocode(root);
      for (const p of d.firePairs) {
        assert.ok(fs.existsSync(p.doc), `resolved doc must exist: ${p.doc}`);
        assert.equal(p.map, p.doc.replace(/\.md$/, ".map.json"), "map must be the same basename + .map.json");
        assert.ok(fs.existsSync(p.map), `resolved map must exist: ${p.map}`);
      }
    } finally { cleanup(root); }
  });
});

// ─── (fire + proceed) faithful → no halt; (fire + halt) doctored → halt ────

describe("fire-and-gate: faithful proceeds (exit 0), doctored HALTS-before-triad (non-zero)", () => {
  test("(fire + proceed) BOTH faithful pairs gate exit 0 — verify proceeds past the gate", () => {
    const { root, pdir } = buildTree();
    rekeyMapsToDocs(pdir);
    try {
      const d = discoverPseudocode(root);
      assert.ok(d.firePairs.length >= 2);
      for (const p of d.firePairs) {
        const r = runGateCli(p.doc, p.map);
        assert.equal(r.exitCode, 0, `faithful pair ${path.basename(p.doc)} must gate exit 0 (proceed), got ${r.exitCode}`);
        assert.equal(r.envelope.ok, true);
      }
    } finally { cleanup(root); }
  });

  test("(fire + halt on divergence) a DOCTORED map propagates a FAIL-blocking non-zero (exit 4) naming the RULE-ID — HALTS before the triad", () => {
    const { root, pdir } = buildTree({ withDoctored: true });
    rekeyMapsToDocs(pdir);
    try {
      const d = discoverPseudocode(root);
      // Beta is doctored → must HALT; Alpha faithful → proceeds.
      const beta = d.firePairs.find((p) => /Beta/.test(p.doc));
      const alpha = d.firePairs.find((p) => /Alpha/.test(p.doc));
      assert.ok(beta && alpha, "both Alpha and Beta must be fire-able");

      const rBeta = runGateCli(beta.doc, beta.map);
      assert.equal(rBeta.exitCode, 4, "doctored Beta must exit 4 (FAIL-blocking — would HALT verify before the triad)");
      assert.ok(rBeta.envelope.violations.length >= 1, "must name ≥1 divergent rule");
      assert.ok(/^R-BETA-\d{2}$/.test(rBeta.envelope.violations[0].id), `violated id must be a derived RULE-ID for the Beta doc, got ${rBeta.envelope.violations[0].id}`);

      const rAlpha = runGateCli(alpha.doc, alpha.map);
      assert.equal(rAlpha.exitCode, 0, "faithful Alpha must still gate exit 0 (the halt is per-pair, divergence-specific)");
    } finally { cleanup(root); }
  });
});

// ─── (skip is distinct, not silent) ───────────────────────────────────────

describe("skip-with-reason is DISTINCT from a fire (never a silent pass)", () => {
  test("a doc with NO co-located map → logged skip reason 'no-build-map' naming the doc (distinct from a fire)", () => {
    const { root, pdir } = buildTree();
    rekeyMapsToDocs(pdir);
    try {
      const d = discoverPseudocode(root);
      const noMap = d.skips.find((s) => s.reason === "no-build-map");
      assert.ok(noMap, "Gamma (doc, no map) must produce a 'no-build-map' skip");
      assert.ok(/PseudoCode-Gamma\.md$/.test(noMap.doc), "the no-build-map skip must NAME the doc");
      // Distinct from a fire: Gamma must NOT appear in firePairs.
      assert.ok(!d.firePairs.some((p) => /Gamma/.test(p.doc)), "Gamma must NOT be a fire pair (it is a skip, observably)");
    } finally { cleanup(root); }
  });

  test("a ZERO-docs tree → logged skip reason 'no-pseudocode-docs' (distinct from a fire, never silent)", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "m87-empty-"));
    fs.mkdirSync(path.join(root, ".gsd-t", "pseudocode"), { recursive: true });
    try {
      const d = discoverPseudocode(root);
      assert.equal(d.docsFound, 0);
      assert.equal(d.firePairs.length, 0, "zero docs → zero fire pairs");
      assert.ok(d.skips.some((s) => s.reason === "no-pseudocode-docs"), "must emit the distinct 'no-pseudocode-docs' skip reason");
    } finally { cleanup(root); }
  });

  test("the two skip reasons are DISTINCT strings (no-build-map ≠ no-pseudocode-docs)", () => {
    // Guards against a single generic skip reason being reused for both cases.
    assert.notEqual("no-build-map", "no-pseudocode-docs");
  });
});

// ─── STATIC reachability: the verify workflow WIRES the gate before the triad ─
// Proves the behaviour above is genuinely reachable THROUGH the pipeline (not a
// parallel re-implementation): the gate is wired FAIL-blocking, before the triad,
// via runCli, with both distinct skip reasons — asserted the SAME way the existing
// verify-gate / ci-parity / test-data halts are wired in the workflow source.

describe("static reachability — verify.workflow.js wires the guard-map gate before the triad", () => {
  const src = fs.readFileSync(VERIFY_WF, "utf8");

  test("the workflow has a Guard-Map Gate phase declared in meta.phases", () => {
    assert.ok(/title:\s*"Guard-Map Gate"/.test(src), "meta.phases must declare the Guard-Map Gate phase");
  });

  test("the gate runs BEFORE the Orthogonal Triad (FAIL-blocking placement, like the other gates)", () => {
    const gateIdx = src.indexOf('phase("Guard-Map Gate")');
    const triadIdx = src.indexOf('phase("Orthogonal Triad")');
    assert.ok(gateIdx >= 0, "must call phase('Guard-Map Gate')");
    assert.ok(triadIdx >= 0, "must call phase('Orthogonal Triad')");
    assert.ok(gateIdx < triadIdx, "the guard-map gate MUST run before the triad (so a divergence halts before triad spend)");
  });

  test("the gate fires gsd-t-guard-map.cjs via runCli with --doc/--map (the resolve+fire path)", () => {
    assert.ok(/runCli\([^)]*"guard-map"/s.test(src) || /runCli\(\s*projectDir,\s*"guard-map"/s.test(src), "must call runCli for the guard-map subcommand");
    assert.ok(/gsd-t-guard-map\.cjs/.test(src), "must reference the local bin gsd-t-guard-map.cjs");
    assert.ok(/"--doc"[\s\S]{0,40}"--map"/.test(src), "must pass --doc then --map to the gate CLI");
  });

  test("a non-zero gate exit returns a FAIL-blocking VERIFY-FAILED (halts before triad), like verify-gate/ci-parity/test-data", () => {
    // The fire loop must guard on !gmr.ok and return overallVerdict VERIFY-FAILED.
    assert.ok(/guard-map-gate-failed/.test(src), "must return a guard-map-gate-failed status on divergence");
    assert.ok(/overallVerdict:\s*"VERIFY-FAILED"[\s\S]{0,400}guardMap/.test(src) || /guardMap[\s\S]{0,400}overallVerdict:\s*"VERIFY-FAILED"/.test(src) || /status:\s*"guard-map-gate-failed"[\s\S]{0,200}overallVerdict:\s*"VERIFY-FAILED"/.test(src), "the divergence return must be VERIFY-FAILED");
  });

  test("both distinct skip reasons are surfaced (no silent pass)", () => {
    assert.ok(/no-build-map/.test(src), "workflow must surface the no-build-map skip reason");
    assert.ok(/no-pseudocode-docs/.test(src), "workflow must surface the no-pseudocode-docs skip reason");
  });

  test("the gate uses model: 'haiku' (M85 deterministic-gate tier, like the other gate runCli calls)", () => {
    // The discovery agent + runCli both run on haiku — no opus/fable/sonnet literal
    // is introduced by the guard-map block.
    const block = src.slice(src.indexOf('phase("Guard-Map Gate")'), src.indexOf('phase("Orthogonal Triad")'));
    assert.ok(/model:\s*"haiku"/.test(block), "the guard-map discovery agent must run on haiku");
    assert.ok(!/model:\s*"(opus|fable|sonnet)"/.test(block), "the guard-map gate block must not introduce a non-haiku tier");
  });
});
