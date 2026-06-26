"use strict";

/**
 * M94-D5-T2 (part 1) — AC-5 keystone: structural grep-for-absence
 *
 * [RULE] query-cli-never-greps: NO directive-driven grep fallback exists in
 * ANY code path of gsd-t-graph-query-cli.cjs.
 *
 * This test STRUCTURALLY parses the query CLI's source code to verify absence of:
 *   - calls to exec/spawn/execSync/spawnSync that invoke grep (i.e. `grep` as a command argument)
 *   - any `child_process` exec/spawn with 'grep' as the command
 *
 * It is NOT a substring scan — a comment saying "grep" must NOT trip it;
 * a real subprocess-invoked grep fallback MUST trip it.
 *
 * The distinction:
 *   - TRIPPED by:   execSync('grep …')   spawnSync('grep', …)   exec('grep …')
 *   - NOT tripped by: // no grep fallback here   strings containing the word grep
 *
 * Implementation: parse the AST using Node's built-in vm module to walk
 * call expression nodes and detect shell-grep invocations. We use a
 * regex-based AST approximation that is specific enough to catch real
 * subprocess grep calls but not comments or string literals as standalone tokens.
 *
 * Structural approach: we parse CALL EXPRESSION patterns, not string content.
 * A comment/string containing the word "grep" is harmless.
 * A call like execSync('grep …') where 'grep' is the FIRST shell token is forbidden.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const CLI_PATH = path.join(__dirname, "..", "bin", "gsd-t-graph-query-cli.cjs");

// ─── Structural grep-detection helpers ───────────────────────────────────────

/**
 * Strips single-line comments (// …) and multi-line comments (/* … *\/) from source.
 * We then ONLY look at non-comment, non-string contexts.
 *
 * This is NOT a full JS parser — it's a conservative structural scanner that:
 *   1. Removes comments to avoid false negatives from commented-out code
 *   2. Detects exec/spawn/execSync/spawnSync call patterns
 *   3. Checks if the first string argument starts with 'grep ' or equals 'grep'
 *
 * Conservative = more likely to false-positive than false-negative.
 * Any match FAILS the test — the author must justify or remove it.
 */

/**
 * Returns true if the source contains a subprocess call that invokes grep.
 * "Subprocess grep" = any of:
 *   - execSync('grep …'), execSync("grep …")
 *   - exec('grep …')
 *   - spawnSync('grep', …), spawn('grep', …)
 *   - child_process.exec('grep …') (any form)
 *
 * A comment or string literal that just CONTAINS the word "grep" (without being
 * the command argument to an exec/spawn call) does NOT trigger this.
 *
 * @param {string} source
 * @returns {{ found: boolean, evidence: string[] }}
 */
function detectSubprocessGrep(source) {
  const evidence = [];

  // Step 1: strip comments to prevent commented-out code from being a false negative
  // (if someone commented out a grep call, it's not a live code path — that's fine)
  // We do a minimal strip of line comments and block comments.
  const noComments = stripComments(source);

  // Step 2: look for exec/spawn patterns with 'grep' as the command
  // Pattern: execSync/exec/spawnSync/spawn followed by ( then 'grep' or "grep"
  // This catches: execSync('grep foo'), exec("grep …"), spawnSync('grep', ['…'])
  // It does NOT catch: require('grep-lib') (different structure)

  // Pattern A: exec*('grep …') or exec*("grep …")
  const execGrepPattern = /\bexec(?:Sync|File(?:Sync)?)?\s*\(\s*(['"`])grep[\s\b]/g;
  let match;
  while ((match = execGrepPattern.exec(noComments)) !== null) {
    const context = noComments.slice(Math.max(0, match.index - 20), match.index + 60).replace(/\n/g, " ");
    evidence.push(`exec*('grep …') at: ${context}`);
  }

  // Pattern B: spawn*('grep', …) — first arg is the command 'grep'
  const spawnGrepPattern = /\bspawn(?:Sync)?\s*\(\s*(['"`])grep\1/g;
  while ((match = spawnGrepPattern.exec(noComments)) !== null) {
    const context = noComments.slice(Math.max(0, match.index - 20), match.index + 60).replace(/\n/g, " ");
    evidence.push(`spawn*('grep', …) at: ${context}`);
  }

  // Pattern C: direct shell string with grep as command (e.g. in template literals)
  // Only flags if it looks like an exec call wrapping a template with grep as first token
  const templateGrepPattern = /\bexec(?:Sync)?\s*\(\s*`grep\s/g;
  while ((match = templateGrepPattern.exec(noComments)) !== null) {
    const context = noComments.slice(Math.max(0, match.index - 20), match.index + 60).replace(/\n/g, " ");
    evidence.push("exec*(`grep …`) template at: " + context);
  }

  return { found: evidence.length > 0, evidence };
}

/**
 * Minimal comment stripper.
 * Removes // line comments and /* block comments *\/ from JS source.
 * Leaves string literals intact (we handle them by limiting what we search for).
 *
 * This is conservative: some edge cases (// inside strings, regex literals) are
 * not handled perfectly, but false positives are acceptable (they fail the test,
 * prompting human review). False negatives are not introduced by over-stripping.
 *
 * @param {string} source
 * @returns {string}
 */
function stripComments(source) {
  // Remove block comments
  let result = source.replace(/\/\*[\s\S]*?\*\//g, (match) => " ".repeat(match.length));
  // Remove line comments
  result = result.replace(/\/\/[^\n]*/g, (match) => " ".repeat(match.length));
  return result;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test("structural: gsd-t-graph-query-cli.cjs source file exists", () => {
  assert.ok(fs.existsSync(CLI_PATH), `query CLI must exist at: ${CLI_PATH}`);
});

test("structural: [RULE] query-cli-never-greps — NO subprocess grep call exists in any code path", () => {
  const source = fs.readFileSync(CLI_PATH, "utf8");
  const { found, evidence } = detectSubprocessGrep(source);

  assert.equal(
    found,
    false,
    `[RULE] query-cli-never-greps VIOLATED — directive-driven grep fallback found:\n${evidence.join("\n")}`
  );
});

test("structural: detector correctly identifies exec('grep …') as a grep call (sanity check)", () => {
  // Self-test: the detector catches a real grep exec pattern
  const fakeSource = `
    function fallback(target) {
      return execSync('grep -r ' + target + ' .');
    }
  `;
  const { found } = detectSubprocessGrep(fakeSource);
  assert.equal(found, true, "detector must catch execSync('grep …')");
});

test("structural: detector correctly identifies spawn('grep', args) as a grep call (sanity check)", () => {
  const fakeSource = `
    const result = spawnSync('grep', ['-r', target, '.']);
  `;
  const { found } = detectSubprocessGrep(fakeSource);
  assert.equal(found, true, "detector must catch spawnSync('grep', …)");
});

test("structural: detector does NOT flag comments mentioning grep (no false positive)", () => {
  const fakeSource = `
    // query-cli-never-greps — no grep fallback here
    /* The M20-M21 cause of death was a grep fallback. We do not do that. */
    function queryWhoImports(index, target) {
      // Direct index lookup — never grep
      return index.importGraph.get(target);
    }
  `;
  const { found } = detectSubprocessGrep(fakeSource);
  assert.equal(found, false, "comments mentioning 'grep' must NOT be flagged");
});

test("structural: detector does NOT flag string variables named 'grep-output' etc.", () => {
  const fakeSource = `
    const reason = 'query-cli-never-greps';
    const msg = "The anti-pattern is grep-based fallback";
    const rule = \`[RULE] query-cli-never-greps\`;
  `;
  const { found } = detectSubprocessGrep(fakeSource);
  assert.equal(found, false, "string literals containing 'grep' must NOT be flagged");
});

test("structural: query CLI source does not require child_process (belt-and-suspenders)", () => {
  // The query CLI must not import child_process at all (belt-and-suspenders guard).
  // A grep fallback via child_process.exec is the exact M20–M21 failure mode.
  // Note: gsd-t-graph-store-bakeoff.cjs DOES use child_process (it's a spike harness).
  // The QUERY CLI must not.
  const source = fs.readFileSync(CLI_PATH, "utf8");
  const noComments = stripComments(source);

  // Look for require('child_process') or require("child_process")
  const cpRequire = /require\s*\(\s*(['"])child_process\1\s*\)/;
  const found = cpRequire.test(noComments);

  assert.equal(
    found,
    false,
    "[belt-and-suspenders] query CLI must not require child_process — any subprocess exec is a potential grep fallback path"
  );
});
