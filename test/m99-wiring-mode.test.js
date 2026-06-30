"use strict";

/**
 * M99-D2-T3 + T4 + T5 — per-consumer wiring-mode persistence + scan report header stamp
 *
 * Proves:
 *   - Each of the 6 consumers (scan/verify/debug/integrate/quick/phase) has a
 *     `persistWiringMode` async function defined in its workflow script
 *   - Each workflow script emits exactly one `kind:'wiring'` ledger line call
 *     (structural: the function is defined and the correct consumer label is embedded)
 *   - The scan workflow stamps `graphWiringMode` into its report header string
 *   - A `fallback-announced` mode is visible in the scan header (the NiceNote north-star)
 *   - Intercept hooks resolve consumer from GSDT_GRAPH_CONSUMER env (never 'cli'-leaks
 *     inside a labeled workflow) — pre-mortem #9
 *   - A bare CLI interception (no workflow context) falls back to 'cli'
 *
 * [RULE] wiring-mode-three-states
 * [RULE] consumer-label-from-context-not-setenv
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

// ─── T3: each consumer workflow defines persistWiringMode ─────────────────────

const WORKFLOWS = [
  { name: "scan",      file: "gsd-t-scan.workflow.js",      consumerLabel: '"scan"' },
  { name: "verify",    file: "gsd-t-verify.workflow.js",    consumerLabel: '"verify"' },
  { name: "debug",     file: "gsd-t-debug.workflow.js",     consumerLabel: '"debug"' },
  { name: "integrate", file: "gsd-t-integrate.workflow.js", consumerLabel: '"integrate"' },
  { name: "quick",     file: "gsd-t-quick.workflow.js",     consumerLabel: '"quick"' },
  { name: "phase",     file: "gsd-t-phase.workflow.js",     consumerLabel: '"phase"' },
];

for (const wf of WORKFLOWS) {
  test(`workflow ${wf.name}: defines async function persistWiringMode`, () => {
    const wfPath = path.join(ROOT, "templates", "workflows", wf.file);
    assert.ok(fs.existsSync(wfPath), `workflow file exists: ${wfPath}`);
    const content = fs.readFileSync(wfPath, "utf8");
    assert.ok(
      content.includes("async function persistWiringMode"),
      `${wf.name} defines async function persistWiringMode [RULE] wiring-mode-three-states`
    );
  });

  test(`workflow ${wf.name}: embeds correct consumer label '${wf.consumerLabel}'`, () => {
    const wfPath = path.join(ROOT, "templates", "workflows", wf.file);
    const content = fs.readFileSync(wfPath, "utf8");
    assert.ok(
      content.includes(`consumer = ${wf.consumerLabel}`),
      `${wf.name} embeds consumer label ${wf.consumerLabel} [RULE] consumer-label-from-context-not-setenv`
    );
  });

  test(`workflow ${wf.name}: calls await persistWiringMode`, () => {
    const wfPath = path.join(ROOT, "templates", "workflows", wf.file);
    const content = fs.readFileSync(wfPath, "utf8");
    assert.ok(
      content.includes("await persistWiringMode("),
      `${wf.name} calls await persistWiringMode(...) [RULE] wiring-mode-three-states`
    );
  });

  test(`workflow ${wf.name}: includes kind:'wiring' ledger record`, () => {
    const wfPath = path.join(ROOT, "templates", "workflows", wf.file);
    const content = fs.readFileSync(wfPath, "utf8");
    assert.ok(
      content.includes("kind:'wiring'") || content.includes('kind:"wiring"'),
      `${wf.name} includes kind:wiring ledger record [RULE] wiring-mode-three-states`
    );
  });

  test(`workflow ${wf.name}: references three-state values`, () => {
    const wfPath = path.join(ROOT, "templates", "workflows", wf.file);
    const content = fs.readFileSync(wfPath, "utf8");
    // Must reference 'WIRED' (or use it in the logic)
    assert.ok(
      content.includes("WIRED") || content.includes("wired"),
      `${wf.name} references WIRED mode [RULE] wiring-mode-three-states`
    );
    // Must reference fallback-announced
    assert.ok(
      content.includes("fallback-announced"),
      `${wf.name} references fallback-announced mode [RULE] wiring-mode-three-states`
    );
  });
}

// ─── T4: scan workflow stamps graphWiringMode into the report header ──────────

test("scan workflow: fmtChunks includes graphWiringMode stamp in header", () => {
  const scanPath = path.join(ROOT, "templates", "workflows", "gsd-t-scan.workflow.js");
  const content = fs.readFileSync(scanPath, "utf8");
  // The header builder must push a line with graphWiringMode
  assert.ok(
    content.includes("graphWiringMode") && content.includes("Graph wiring"),
    "scan fmtChunks stamps graphWiringMode into report header [RULE] wiring-mode-three-states"
  );
});

test("scan workflow: fmtChunks header includes fallback-announced description", () => {
  const scanPath = path.join(ROOT, "templates", "workflows", "gsd-t-scan.workflow.js");
  const content = fs.readFileSync(scanPath, "utf8");
  assert.ok(
    content.includes("fallback-announced") && content.includes("grep"),
    "scan header describes fallback-announced as grep-mode fallback (NiceNote north-star)"
  );
});

test("scan workflow: all three wiring modes are handled — disabled, fallback-announced, wired", () => {
  const scanPath = path.join(ROOT, "templates", "workflows", "gsd-t-scan.workflow.js");
  const content = fs.readFileSync(scanPath, "utf8");
  assert.ok(content.includes('"disabled"'), 'scan handles disabled mode [RULE] wiring-mode-three-states');
  assert.ok(content.includes('"fallback-announced"'), 'scan handles fallback-announced mode [RULE] wiring-mode-three-states');
  assert.ok(content.includes('"wired"'), 'scan handles wired mode [RULE] wiring-mode-three-states');
});

// ─── Pre-mortem #9: consumer label propagation ────────────────────────────────

test("grep-intercept: resolves consumer from GSDT_GRAPH_CONSUMER env (pre-mortem #9)", () => {
  const interceptPath = path.join(ROOT, "scripts", "gsd-t-graph-intercept.js");
  const content = fs.readFileSync(interceptPath, "utf8");
  // The hook must read GSDT_GRAPH_CONSUMER from process.env
  assert.ok(
    content.includes("GSDT_GRAPH_CONSUMER"),
    "grep-intercept reads GSDT_GRAPH_CONSUMER from env [RULE] consumer-label-from-context-not-setenv"
  );
  // And must fall back to 'cli' when absent
  assert.ok(
    content.includes("'cli'") || content.includes('"cli"'),
    "grep-intercept falls back to 'cli' when no context"
  );
});

test("read-intercept: resolves consumer from GSDT_GRAPH_CONSUMER env (pre-mortem #9)", () => {
  const interceptPath = path.join(ROOT, "scripts", "gsd-t-read-intercept.js");
  const content = fs.readFileSync(interceptPath, "utf8");
  assert.ok(
    content.includes("GSDT_GRAPH_CONSUMER"),
    "read-intercept reads GSDT_GRAPH_CONSUMER from env [RULE] consumer-label-from-context-not-setenv"
  );
  assert.ok(
    content.includes("'cli'") || content.includes('"cli"'),
    "read-intercept falls back to 'cli' when no context"
  );
});

test("grep-intercept: GSDT_GRAPH_CONSUMER takes precedence over default 'cli'", () => {
  // Structural: verify the env read comes before the default
  const interceptPath = path.join(ROOT, "scripts", "gsd-t-graph-intercept.js");
  const content = fs.readFileSync(interceptPath, "utf8");
  const envPos = content.indexOf("GSDT_GRAPH_CONSUMER");
  const cliPos = content.indexOf("'cli'");
  assert.ok(envPos !== -1, "GSDT_GRAPH_CONSUMER reference exists");
  assert.ok(cliPos !== -1, "cli fallback exists");
  assert.ok(
    envPos < cliPos,
    "GSDT_GRAPH_CONSUMER env check precedes 'cli' fallback in the function [RULE] consumer-label-from-context-not-setenv"
  );
});

// ─── Intercept scripts: presence-check repointed to resolver ─────────────────

test("grep-intercept: no raw .gsd-t/graph.db presence-check literal (M99 repoint)", () => {
  const interceptPath = path.join(ROOT, "scripts", "gsd-t-graph-intercept.js");
  const content = fs.readFileSync(interceptPath, "utf8");
  // After M99 D2 repoint, the old hardcoded path must be gone
  assert.ok(
    !content.includes(path.join(".gsd-t", "graph.db")),
    "grep-intercept must NOT contain raw .gsd-t/graph.db literal [RULE] presence-check-repointed"
  );
  // Must import or call resolveStorePath from the resolver
  assert.ok(
    content.includes("resolveStorePath") || content.includes("resolveStorePathViaResolver"),
    "grep-intercept uses resolver for store path [RULE] import-resolver-never-hardcode"
  );
});

test("read-intercept: no raw .gsd-t/graph.db presence-check or DB-open literal (M99 repoint)", () => {
  const interceptPath = path.join(ROOT, "scripts", "gsd-t-read-intercept.js");
  const content = fs.readFileSync(interceptPath, "utf8");
  // The old hardcoded path must be gone
  assert.ok(
    !content.includes("path.join(cwd, '.gsd-t', 'graph.db')"),
    "read-intercept must NOT have raw .gsd-t/graph.db open [RULE] presence-check-repointed"
  );
  // Must import or call resolveStorePath from the resolver
  assert.ok(
    content.includes("resolveStorePath") || content.includes("loadResolver"),
    "read-intercept uses resolver for store path [RULE] import-resolver-never-hardcode"
  );
});

// ─── Layer-2a: grep-intercept emits kind:grep lines ──────────────────────────

test("grep-intercept: emits one kind:grep line per decision (contract: every grep logs exactly one)", () => {
  const interceptPath = path.join(ROOT, "scripts", "gsd-t-graph-intercept.js");
  const content = fs.readFileSync(interceptPath, "utf8");
  // Both passthrough and replaced paths must call logDecision
  const logDecisionCount = (content.match(/logDecision\(/g) || []).length;
  assert.ok(logDecisionCount >= 2, `expected at least 2 logDecision calls (passthrough + replaced); got ${logDecisionCount}`);
  // The log function must emit kind:'grep'
  assert.ok(
    content.includes("kind: 'grep'") || content.includes("kind:\"grep\""),
    "grep-intercept emits kind:'grep' ledger events [RULE]"
  );
});

// ─── Layer-2b: read-intercept emits kind:read lines ──────────────────────────

test("read-intercept: emits kind:read lines (contract: every read decision logs exactly one)", () => {
  const interceptPath = path.join(ROOT, "scripts", "gsd-t-read-intercept.js");
  const content = fs.readFileSync(interceptPath, "utf8");
  const logDecisionCount = (content.match(/logDecision\(/g) || []).length;
  assert.ok(logDecisionCount >= 1, `expected at least 1 logDecision call; got ${logDecisionCount}`);
  assert.ok(
    content.includes("kind: 'read'") || content.includes("kind:\"read\""),
    "read-intercept emits kind:'read' ledger events [RULE]"
  );
  // Must emit both action:'augment' and action:'passthrough'
  assert.ok(
    content.includes("'augment'") || content.includes('"augment"'),
    "read-intercept logs augment action"
  );
  assert.ok(
    content.includes("'passthrough'") || content.includes('"passthrough"'),
    "read-intercept logs passthrough action"
  );
});

test("read-intercept: augment-never-shrink rule is kept (M98 invariant)", () => {
  const interceptPath = path.join(ROOT, "scripts", "gsd-t-read-intercept.js");
  const content = fs.readFileSync(interceptPath, "utf8");
  // The never-shrink logic: emitAugment checks combined.length > OUTPUT_CAP
  assert.ok(
    content.includes("augment-never-shrink"),
    "read-intercept still references augment-never-shrink rule [RULE] augment-never-shrink-kept"
  );
  assert.ok(
    content.includes("OUTPUT_CAP"),
    "read-intercept still has OUTPUT_CAP cap check [RULE] augment-never-shrink-kept"
  );
});

// ─── Scan wiring mode emitted from all 3 code paths (disabled/fallback/wired) ─

test("scan workflow: persistWiringMode called after graphWiringMode='disabled'", () => {
  const scanPath = path.join(ROOT, "templates", "workflows", "gsd-t-scan.workflow.js");
  const content = fs.readFileSync(scanPath, "utf8");
  // Look for the assignment `graphWiringMode = "disabled"` and then find persistWiringMode nearby
  const assignIdx = content.indexOf('graphWiringMode = "disabled"');
  assert.ok(assignIdx !== -1, 'scan has graphWiringMode = "disabled" assignment');
  const disabledBlock = content.slice(assignIdx, assignIdx + 500);
  assert.ok(
    disabledBlock.includes("persistWiringMode"),
    "scan calls persistWiringMode in the disabled branch [RULE] wiring-mode-three-states"
  );
});

test("scan workflow: persistWiringMode called after graphWiringMode='fallback-announced'", () => {
  const scanPath = path.join(ROOT, "templates", "workflows", "gsd-t-scan.workflow.js");
  const content = fs.readFileSync(scanPath, "utf8");
  const allFallbackPositions = [];
  let pos = 0;
  while ((pos = content.indexOf('"fallback-announced"', pos)) !== -1) {
    allFallbackPositions.push(pos);
    pos++;
  }
  assert.ok(allFallbackPositions.length >= 1, "fallback-announced referenced at least once");
  // After at least one fallback-announced assignment, persistWiringMode must appear
  const found = allFallbackPositions.some((p) => {
    const slice = content.slice(p, p + 600);
    return slice.includes("persistWiringMode");
  });
  assert.ok(found, "scan calls persistWiringMode after at least one fallback-announced assignment");
});
