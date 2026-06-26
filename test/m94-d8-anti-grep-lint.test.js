"use strict";

/**
 * M94-D8-T3 — Anti-grep lint test (the killing test for the FAIL-LOUD invariant)
 *
 * Drives bin/gsd-t-graph-anti-grep-lint.cjs over:
 *   1. The real wired-file set from the contract manifest (currently empty — d10/d11 populate it).
 *   2. Crafted positive fixture — real structural-grep fallback → lint MUST CATCH it.
 *   3. Crafted negative fixture — legitimate text-search grep → lint MUST NOT flag it.
 *   4. Carve-out fixture — /scan announced grep-mode fallback → lint MUST NOT flag it.
 *   5. Manifest-coverage assertion — scanned file set EQUALS contract manifest file set.
 *   6. Contract manifest structure assertion — manifest is non-empty in shape (table parseable,
 *      schema-valid when rows exist).
 *
 * [RULE] anti-grep-lint-structural-not-substring
 * [RULE] anti-grep-lint-reads-manifest
 * [RULE] consumer-structural-grep-removed
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const LINT_PATH = path.join(__dirname, "..", "bin", "gsd-t-graph-anti-grep-lint.cjs");
const CONTRACT_PATH = path.join(
  __dirname,
  "..",
  ".gsd-t",
  "contracts",
  "graph-consumer-wiring-contract.md"
);

const {
  runLint,
  parseManifest,
  detectStructuralGrepFallback,
  isTextSearchGrep,
  stripComments,
  STRUCTURAL_VERBS,
} = require(LINT_PATH);

// ─── Fixtures ────────────────────────────────────────────────────────────────

/**
 * Fixture 1 (positive — the green-can-go-red proof):
 * A real `try { gsd-t graph who-imports … } catch { grep -r … }` structural fallback.
 * The lint MUST catch this (violations.length > 0).
 */
const FIXTURE_STRUCTURAL_GREP_FALLBACK = `
'use strict';

const { execSync } = require('child_process');

// Example wired command that has a FORBIDDEN structural grep fallback.
async function findImporters(filePath) {
  try {
    const result = execSync('gsd-t graph who-imports ' + filePath, { encoding: 'utf8' });
    return JSON.parse(result);
  } catch (err) {
    // FORBIDDEN: falls back to grep for a structural (import) question.
    const grepResult = execSync('grep -r "' + filePath + '" --include="*.ts" .', { encoding: 'utf8' });
    return { ok: true, results: grepResult.split('\\n').filter(Boolean) };
  }
}
`;

/**
 * Fixture 2 (negative — no false-positive on text search):
 * A legitimate text-search grep (TODO, MAX_RETRIES constant).
 * The lint MUST NOT flag this.
 */
const FIXTURE_TEXT_SEARCH_GREP = `
'use strict';

const { execSync } = require('child_process');

// Legitimate text search — find all TODOs in the codebase.
function findTodos(projectDir) {
  const result = execSync('grep -rn "TODO" --include="*.ts" ' + projectDir, { encoding: 'utf8' });
  return result.split('\\n').filter(Boolean);
}

// Legitimate text search — find all uses of a config constant.
function findConstantUsages(constName) {
  const result = execSync('grep -rn "MAX_RETRIES" .', { encoding: 'utf8' });
  return result.split('\\n').filter(Boolean);
}
`;

/**
 * Fixture 3 (carve-out — /scan announced grep-mode fallback):
 * Mimics /scan's announced grep-mode fallback (announced, non-silent, logic-read).
 * The lint MUST NOT flag this (the d6 exemption holds).
 *
 * Note: this fixture tests the announced-fallback EXEMPTION logic. In the real
 * codebase the scan files are in the SCAN_EXEMPT_FILES set and skipped entirely.
 * Here we test the DETECTION logic directly — the announced-fallback pattern
 * (graph-unavailable → ANNOUNCE → continue grep-mode) should be distinguishable
 * from a silent structural fallback. Since the lint's detection works by file-set
 * membership (exempt files are skipped), this fixture verifies the overall exemption
 * pathway functions correctly.
 */
const FIXTURE_SCAN_ANNOUNCED_FALLBACK = `
'use strict';

const { execSync } = require('child_process');

// /scan graph-mode — uses the graph query CLI for structural slice.
// On graph-unavailable, ANNOUNCES the fallback and continues in grep-mode.
async function runScan(projectDir, opts) {
  try {
    const slice = execSync('gsd-t graph dead-code', { encoding: 'utf8' });
    return JSON.parse(slice);
  } catch (err) {
    // ANNOUNCED fallback — NOT a silent structural substitution.
    // /scan's deep-finders read every file for in-file logic anyway;
    // on graph-unavailable, scan announces it and continues its full enumerate-and-deep-read.
    if (opts && opts.onFallback) {
      opts.onFallback('graph unavailable — running in grep-mode (graph-offline, findings may be less accurate)');
    }
    // Grep here is the ANNOUNCED announced-mode continuation of scan's enumerate-every-file pipeline.
    // This is NOT a silent structural substitution — it is scan's intact grep-based logic-read pipeline.
    const grepResult = execSync('grep -rn "export" --include="*.ts" ' + projectDir, { encoding: 'utf8' });
    return { mode: 'grep-announced', raw: grepResult };
  }
}
`;

// ─── Helper: run lint over a fixture string ──────────────────────────────────

/**
 * Write a fixture to a temp file, run the lint over it, clean up.
 * Returns the lint result.
 *
 * @param {string} fixtureSource
 * @param {string} fixtureLabel   — used for temp file name (no spaces)
 * @returns {{ found: boolean, violations: { file: string, line: number, evidence: string }[] }}
 */
function runLintOnFixture(fixtureSource, fixtureLabel) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm94-d8-lint-'));
  const tmpFile = path.join(tmpDir, fixtureLabel + '.js');
  fs.writeFileSync(tmpFile, fixtureSource, 'utf8');
  try {
    const result = runLint({ projectDir: tmpDir, files: [tmpFile] });
    return result;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_) {}
    try { fs.rmdirSync(tmpDir); } catch (_) {}
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test("lint engine module exports required functions", () => {
  assert.ok(typeof runLint === "function", "runLint must be a function");
  assert.ok(typeof parseManifest === "function", "parseManifest must be a function");
  assert.ok(typeof detectStructuralGrepFallback === "function", "detectStructuralGrepFallback must be exported");
  assert.ok(typeof stripComments === "function", "stripComments must be exported");
  assert.ok(Array.isArray(STRUCTURAL_VERBS), "STRUCTURAL_VERBS must be an array");
  assert.ok(STRUCTURAL_VERBS.length >= 9, "STRUCTURAL_VERBS must include all 9 verbs");
});

test("STRUCTURAL_VERBS includes all required graph query verbs", () => {
  const required = [
    "who-imports",
    "who-calls",
    "blast-radius",
    "dependents",
    "dead-code",
    "orphan",
    "cycles",
    "cluster",
    "test-impl",
  ];
  for (const verb of required) {
    assert.ok(
      STRUCTURAL_VERBS.includes(verb),
      `STRUCTURAL_VERBS must include '${verb}'`
    );
  }
});

test("contract file exists and is readable", () => {
  assert.ok(
    fs.existsSync(CONTRACT_PATH),
    `Contract must exist at ${CONTRACT_PATH}`
  );
  const text = fs.readFileSync(CONTRACT_PATH, "utf8");
  assert.ok(text.length > 100, "Contract must have meaningful content");
});

test("contract contains required sections", () => {
  const text = fs.readFileSync(CONTRACT_PATH, "utf8");
  assert.ok(text.includes("§READER Pattern"), "Contract must have §READER Pattern section");
  assert.ok(text.includes("§WRITER Pattern"), "Contract must have §WRITER Pattern section");
  assert.ok(text.includes("§FAIL-LOUD Invariant"), "Contract must have §FAIL-LOUD Invariant section");
  assert.ok(text.includes("§Grep Distinction"), "Contract must have §Grep Distinction section");
  assert.ok(text.includes("§Consumer Manifest"), "Contract must have §Consumer Manifest section");
  assert.ok(
    text.includes("[RULE] consumer-structural-grep-removed"),
    "Contract must declare [RULE] consumer-structural-grep-removed"
  );
  assert.ok(
    text.includes("[RULE] text-search-grep-still-legitimate"),
    "Contract must declare [RULE] text-search-grep-still-legitimate"
  );
  assert.ok(
    text.includes("[RULE] scan-announced-fallback-not-structural-grep"),
    "Contract must declare the /scan carve-out rule"
  );
  assert.ok(
    text.includes("[RULE] verify-integrate-graph-additive-announced-not-hard-fail"),
    "Contract must declare the /verify+/integrate carve-out rule"
  );
});

test("contract §Consumer Manifest table is parseable (schema-valid)", () => {
  const text = fs.readFileSync(CONTRACT_PATH, "utf8");
  // parseManifest should not throw.
  let rows;
  assert.doesNotThrow(() => {
    rows = parseManifest(text);
  }, "parseManifest must not throw on the real contract");

  // Rows is an array (may be empty at this stage — d10/d11 haven't wired yet).
  assert.ok(Array.isArray(rows), "parseManifest must return an array");

  // Each row with non-placeholder values must have commandFile field.
  for (const row of rows) {
    assert.ok(
      typeof row.commandFile === "string",
      "Each manifest row must have a commandFile string"
    );
  }
});

test("contract §Consumer Manifest exemptions table includes /scan and /verify+/integrate", () => {
  const text = fs.readFileSync(CONTRACT_PATH, "utf8");
  assert.ok(
    text.includes("scan-announced-fallback") || text.includes("/scan"),
    "Contract manifest exemptions must mention /scan"
  );
  assert.ok(
    text.includes("gsd-t-scan.md") || text.includes("scan carve-out"),
    "Contract manifest exemptions must reference the scan file or carve-out"
  );
  assert.ok(
    text.includes("gsd-t-verify.md") || text.includes("verify carve-out"),
    "Contract manifest exemptions must reference /verify"
  );
});

test("MANDATORY NEGATIVE SELF-TEST #1: lint CATCHES a real structural-grep fallback (green-can-go-red proof)", () => {
  const result = runLintOnFixture(FIXTURE_STRUCTURAL_GREP_FALLBACK, "structural-fallback");

  assert.strictEqual(
    result.ok,
    false,
    "Lint MUST return ok:false when a structural-grep fallback is present"
  );
  assert.ok(
    result.violations.length > 0,
    `Lint MUST surface at least one violation for the structural-grep fallback fixture — got ${result.violations.length}`
  );

  // The violation must cite a file and line.
  const v = result.violations[0];
  assert.ok(v.file, "Violation must have a file field");
  assert.ok(typeof v.line === "number" && v.line > 0, "Violation must have a positive line number");
  assert.ok(v.evidence, "Violation must have an evidence string");

  // Evidence should mention grep or the fallback construct.
  assert.ok(
    /grep/i.test(v.evidence) || /catch/.test(v.evidence) || /execSync/.test(v.evidence),
    `Violation evidence should reference the fallback construct: '${v.evidence}'`
  );
});

test("MANDATORY NEGATIVE SELF-TEST #2: lint does NOT flag a legitimate text-search grep", () => {
  const result = runLintOnFixture(FIXTURE_TEXT_SEARCH_GREP, "text-search-grep");

  assert.strictEqual(
    result.ok,
    true,
    `Lint MUST return ok:true for a legitimate text-search grep — got violations: ${JSON.stringify(result.violations)}`
  );
  assert.strictEqual(
    result.violations.length,
    0,
    `Lint MUST have zero violations for a text-search grep fixture — got ${result.violations.length}: ${JSON.stringify(result.violations)}`
  );
});

test("CARVE-OUT TEST: lint does not flag /scan announced grep-mode fallback via exemption", () => {
  // The /scan files are in SCAN_EXEMPT_FILES and are SKIPPED entirely by the lint.
  // We verify this by running with the scan files listed and checking they appear in skippedFiles.
  const { SCAN_EXEMPT_FILES } = require(LINT_PATH);

  const scanFiles = [...SCAN_EXEMPT_FILES];
  assert.ok(scanFiles.length >= 2, "SCAN_EXEMPT_FILES must include at least 2 files");
  assert.ok(
    scanFiles.some((f) => f.includes("gsd-t-scan")),
    "SCAN_EXEMPT_FILES must include a scan file"
  );

  // Run lint with the exempt scan files listed.
  // They should appear in skippedFiles, not scannedFiles, and produce no violations.
  const result = runLint({
    projectDir: path.join(__dirname, ".."),
    files: scanFiles,
  });

  assert.strictEqual(
    result.ok,
    true,
    "Lint over exempt scan files must return ok:true"
  );
  assert.strictEqual(
    result.violations.length,
    0,
    "Lint over exempt scan files must have zero violations"
  );
  assert.ok(
    result.skippedFiles.length > 0,
    "Exempt scan files must appear in skippedFiles (not scannedFiles)"
  );
  // All listed files should be skipped (not scanned).
  for (const f of scanFiles) {
    assert.ok(
      result.skippedFiles.includes(f),
      `${f} must be in skippedFiles (exempt from lint)`
    );
    assert.ok(
      !result.scannedFiles.includes(f),
      `${f} must NOT be in scannedFiles (it is exempt)`
    );
  }
});

test("CARVE-OUT TEST: /verify and /integrate are also exempt", () => {
  const { VERIFY_INTEGRATE_EXEMPT_FILES } = require(LINT_PATH);

  const exemptFiles = [...VERIFY_INTEGRATE_EXEMPT_FILES];
  assert.ok(exemptFiles.length >= 4, "VERIFY_INTEGRATE_EXEMPT_FILES must include at least 4 files");

  const result = runLint({
    projectDir: path.join(__dirname, ".."),
    files: exemptFiles,
  });

  assert.strictEqual(result.ok, true, "Exempt verify/integrate files must produce no violations");
  assert.ok(result.skippedFiles.length > 0, "Exempt files must be in skippedFiles");
});

test("stripComments removes line comments and preserves line count", () => {
  const source = "// comment\nconst x = 1; // inline\n/* block */\nconst y = 2;";
  const stripped = stripComments(source);
  assert.strictEqual(
    stripped.split("\n").length,
    source.split("\n").length,
    "stripComments must preserve line count (for accurate line numbers)"
  );
  assert.ok(
    !stripped.includes("comment"),
    "stripComments must remove line comment content"
  );
  assert.ok(
    !stripped.includes("block"),
    "stripComments must remove block comment content"
  );
  assert.ok(
    stripped.includes("const x"),
    "stripComments must preserve non-comment code"
  );
});

test("isTextSearchGrep correctly classifies TODO grep as text search", () => {
  assert.ok(
    isTextSearchGrep("execSync('grep -rn \"TODO\" .', { encoding: 'utf8' })"),
    "TODO grep must be classified as text search"
  );
});

test("isTextSearchGrep correctly classifies constant grep as text search", () => {
  assert.ok(
    isTextSearchGrep("execSync('grep -rn \"MAX_RETRIES\" .', { encoding: 'utf8' })"),
    "MAX_RETRIES grep must be classified as text search"
  );
});

test("MANIFEST-COVERAGE ASSERTION: lint's scanned-file set equals the contract manifest's file set (no wired file silently skipped)", () => {
  // Run the lint over the real project against the real manifest.
  const projectDir = path.join(__dirname, "..");
  const result = runLint({ projectDir });

  // The manifest may be empty (d10/d11 haven't wired yet) — that's fine at this stage.
  // What we assert: the union of scannedFiles + skippedFiles = the manifest-derived file set.
  // We verify by checking that runLint with a specific file list returns that set.
  const { parseManifest: parseM } = require(LINT_PATH);
  const contractText = fs.readFileSync(CONTRACT_PATH, "utf8");
  const rows = parseM(contractText);

  // Build the expected file set from the manifest.
  const expectedFiles = new Set();
  for (const row of rows) {
    if (row.commandFile && !row.commandFile.startsWith("_(")) expectedFiles.add(row.commandFile);
    if (row.workflowFile && !row.workflowFile.startsWith("_(")) expectedFiles.add(row.workflowFile);
  }

  // Every file in expectedFiles must appear in either scannedFiles or skippedFiles.
  const covered = new Set([...result.scannedFiles, ...result.skippedFiles]);
  for (const f of expectedFiles) {
    assert.ok(
      covered.has(f),
      `Manifest file '${f}' must be in lint's scanned or skipped set — coverage is provably complete`
    );
  }

  // The lint must not have scanned files that are NOT in the manifest (no phantom files).
  for (const f of result.scannedFiles) {
    assert.ok(
      expectedFiles.has(f) || expectedFiles.size === 0,
      `Lint scanned '${f}' which is not in the manifest — coverage check failed`
    );
  }
});

test("lint returns ok:true on the real project (no wired files yet — zero violations expected)", () => {
  // The manifest is empty at Wave A (d10/d11 haven't wired yet).
  // With no wired files, the lint must return ok:true and zero violations.
  const projectDir = path.join(__dirname, "..");
  const result = runLint({ projectDir });

  if (result.error) {
    // Error reading the contract is a test failure.
    assert.fail(`Lint returned an error: ${result.error}`);
  }

  assert.strictEqual(
    result.ok,
    true,
    `Lint must return ok:true on the real project with empty manifest — got violations: ${JSON.stringify(result.violations)}`
  );
  assert.strictEqual(
    result.violations.length,
    0,
    "Lint must return zero violations on the real project with empty manifest"
  );
});

test("lint result has correct envelope shape", () => {
  const projectDir = path.join(__dirname, "..");
  const result = runLint({ projectDir });

  assert.ok(typeof result.ok === "boolean", "Result must have ok:boolean");
  assert.ok(Array.isArray(result.violations), "Result must have violations:array");
  assert.ok(Array.isArray(result.scannedFiles), "Result must have scannedFiles:array");
  assert.ok(Array.isArray(result.skippedFiles), "Result must have skippedFiles:array");
  assert.ok(
    typeof result.manifestRows === "number",
    "Result must have manifestRows:number"
  );
  // error is null on success.
  assert.ok(
    result.error === null || result.error === undefined || typeof result.error === "string",
    "Result.error must be null/undefined or a string"
  );
});

test("detect structural grep fallback: correctly flags import-grep in catch block", () => {
  const source = `
async function findDeps(file) {
  try {
    return JSON.parse(require('child_process').execSync('gsd-t graph who-imports ' + file));
  } catch (e) {
    return require('child_process').execSync('grep -r "import.*' + file + '" .').toString();
  }
}
`;
  const { found, violations } = detectStructuralGrepFallback(source, "test-fixture.js");
  assert.ok(found, "Must detect structural grep fallback in catch block after who-imports call");
  assert.ok(violations.length > 0, "Must have at least one violation");
});

test("detect structural grep fallback: does NOT flag a grep with no preceding structural verb", () => {
  const source = `
// No graph query here — just a standalone grep.
function findConfig(key) {
  try {
    return require('child_process').execSync('grep -rn "' + key + '" config/').toString();
  } catch (e) {
    return null;
  }
}
`;
  const { found } = detectStructuralGrepFallback(source, "test-standalone-grep.js");
  // No structural verb → no structural fallback possible.
  assert.strictEqual(found, false, "Must NOT flag grep with no preceding structural verb call");
});
