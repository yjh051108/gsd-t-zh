"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");

const PKG_ROOT = path.resolve(__dirname, "..");
const SRC_GSD_T = path.join(PKG_ROOT, "bin", "gsd-t.js");
const SRC_DEBUG_LEDGER = path.join(PKG_ROOT, "bin", "debug-ledger.js");

function mkTmp(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `gsd-t-resilience-${name}-`));
}

test("bin/gsd-t.js loads without throwing when debug-ledger.js is missing", () => {
  const tmp = mkTmp("missing-ledger");
  const binDir = path.join(tmp, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  // Seed a minimal package.json so the installer's own version lookup succeeds
  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "t", version: "0.0.0" }));
  // Copy gsd-t.js only — intentionally omit debug-ledger.js
  fs.copyFileSync(SRC_GSD_T, path.join(binDir, "gsd-t.js"));
  // Dry-load via --version so it exercises the top-level require without
  // taking any side effects beyond printing the version.
  const res = spawnSync(process.execPath, [path.join(binDir, "gsd-t.js"), "--version"], {
    encoding: "utf8",
    timeout: 15000,
  });
  assert.doesNotMatch(res.stderr || "", /Cannot find module.*debug-ledger/, "missing debug-ledger must not crash");
  assert.doesNotMatch(res.stderr || "", /debug-ledger/, "no debug-ledger references in stderr");
});

test("copyBinToolsToProject removes a stray bin/gsd-t.js matching installer signature", () => {
  const tmp = mkTmp("sweep-match");
  const binDir = path.join(tmp, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  // Seed with current source content — matches signature
  fs.copyFileSync(SRC_GSD_T, path.join(binDir, "gsd-t.js"));
  assert.ok(fs.existsSync(path.join(binDir, "gsd-t.js")), "stray present before sweep");

  const gt = require(SRC_GSD_T);
  gt.copyBinToolsToProject(tmp, "test-project");

  assert.ok(!fs.existsSync(path.join(binDir, "gsd-t.js")), "matching-signature stray must be deleted");
});

test("copyBinToolsToProject sweeps older-version stray with the installer signature", () => {
  const tmp = mkTmp("sweep-older");
  const binDir = path.join(tmp, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  // Simulate an older version of our own file: correct header, different body.
  // The sweep must still remove it because the signature matches the installer.
  const olderVersion = [
    "#!/usr/bin/env node",
    "",
    "/**",
    " * GSD-T CLI Installer",
    " *",
    " * Usage:",
    " *   npx @tekyzinc/gsd-t install",
    " */",
    "",
    "// old v3.13.11 body — intentionally different from current source",
    "const debugLedger = require('./debug-ledger.js');",
    "// …",
  ].join("\n");
  fs.writeFileSync(path.join(binDir, "gsd-t.js"), olderVersion);

  const gt = require(SRC_GSD_T);
  gt.copyBinToolsToProject(tmp, "test-project");

  assert.ok(!fs.existsSync(path.join(binDir, "gsd-t.js")), "older-version stray (signature match) must be deleted");
});

test("copyBinToolsToProject refuses to sweep a project whose package.json name is @tekyzinc/gsd-t", () => {
  // Self-protection: when the target project IS the GSD-T source repo
  // (identified by package.json name), the sweep must be skipped — otherwise
  // running update-all with GSD-T registered as a project would eat the source.
  // Identity is by package name, NOT path, because when invoked from a global
  // install, PKG_ROOT points to the global copy, not the local source.
  const tmp = mkTmp("sweep-self");
  const binDir = path.join(tmp, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(
    path.join(tmp, "package.json"),
    JSON.stringify({ name: "@tekyzinc/gsd-t", version: "0.0.0" })
  );
  // Seed a stray that would otherwise match the signature and get swept.
  fs.copyFileSync(SRC_GSD_T, path.join(binDir, "gsd-t.js"));
  assert.ok(fs.existsSync(path.join(binDir, "gsd-t.js")), "stray must exist before test");

  const gt = require(SRC_GSD_T);
  gt.copyBinToolsToProject(tmp, "GSD-T");

  assert.ok(
    fs.existsSync(path.join(binDir, "gsd-t.js")),
    "source bin/gsd-t.js must survive sweep when package.json identifies project as @tekyzinc/gsd-t"
  );
});

test("copyBinToolsToProject leaves a user-owned bin/gsd-t.js alone when signature doesn't match", () => {
  const tmp = mkTmp("sweep-skip");
  const binDir = path.join(tmp, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  // User's own file: shebang but missing the "GSD-T CLI Installer" marker
  const userOwned = "#!/usr/bin/env node\n// user's own helper script\nconsole.log('mine');\n";
  fs.writeFileSync(path.join(binDir, "gsd-t.js"), userOwned);

  const gt = require(SRC_GSD_T);
  gt.copyBinToolsToProject(tmp, "test-project");

  assert.ok(fs.existsSync(path.join(binDir, "gsd-t.js")), "user-owned file must survive sweep");
  assert.equal(fs.readFileSync(path.join(binDir, "gsd-t.js"), "utf8"), userOwned, "content unchanged");
});

// M68 — retired bin tools (token-telemetry/unattended/headless clusters) must be
// pruned on update-all. Origin: HiloAviation observed not updating; the sweep list
// only carried gsd-t.js, so 11-17 dead .cjs lingered in every project's bin/.
test("copyBinToolsToProject sweeps a retired .cjs that carries GSD-T provenance", () => {
  const tmp = mkTmp("sweep-retired");
  const binDir = path.join(tmp, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "consumer-app", version: "1.0.0" }));
  // A retired tool as this installer shipped it — carries the VERBATIM product header.
  const retired = path.join(binDir, "token-telemetry.cjs");
  fs.writeFileSync(retired, "#!/usr/bin/env node\n\n/**\n * GSD-T Token Telemetry — per-subagent-spawn granular telemetry recorder\n */\nmodule.exports = {};\n");

  const gt = require(SRC_GSD_T);
  gt.copyBinToolsToProject(tmp, "consumer-app");

  assert.ok(!fs.existsSync(retired), "retired .cjs with the verbatim shipped header must be swept");
});

test("copyBinToolsToProject leaves a user's same-named .cjs alone when it lacks the shipped header", () => {
  const tmp = mkTmp("sweep-skip-user-cjs");
  const binDir = path.join(tmp, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "consumer-app", version: "1.0.0" }));
  // A user-authored file sharing a retired tool's name, no verbatim product header.
  const userOwned = "#!/usr/bin/env node\n// my own log-tail utility\nmodule.exports = function tail(){ return 'mine'; };\n";
  const userFile = path.join(binDir, "log-tail.cjs");
  fs.writeFileSync(userFile, userOwned);

  const gt = require(SRC_GSD_T);
  gt.copyBinToolsToProject(tmp, "consumer-app");

  assert.ok(fs.existsSync(userFile), "user-owned same-named .cjs without the shipped header must survive");
  assert.equal(fs.readFileSync(userFile, "utf8"), userOwned, "user file content unchanged");
});

// Red-team HIGH-1 regression: a user file that MENTIONS gsd-t / references a .gsd-t/
// path (realistic in a consumer repo) but does NOT carry a verbatim product header
// must survive. The prior loose-substring guard would have deleted this.
test("copyBinToolsToProject does NOT delete a user .cjs that merely references a .gsd-t/ path", () => {
  const tmp = mkTmp("sweep-skip-gsdt-mention");
  const binDir = path.join(tmp, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "consumer-app", version: "1.0.0" }));
  // User's own event-stream helper that tails .gsd-t/events/ — same name as a retired tool.
  const userOwned =
    "#!/usr/bin/env node\n" +
    "// My helper: tails .gsd-t/events/ and posts to Slack. Integrates with gsd-t.\n" +
    "const fs = require('fs');\nmodule.exports = function watch(){ /* mine */ };\n";
  const userFile = path.join(binDir, "event-stream.cjs");
  fs.writeFileSync(userFile, userOwned);

  const gt = require(SRC_GSD_T);
  gt.copyBinToolsToProject(tmp, "consumer-app");

  assert.ok(fs.existsSync(userFile), "user file referencing .gsd-t/ but lacking the shipped header must survive");
  assert.equal(fs.readFileSync(userFile, "utf8"), userOwned, "user file content unchanged");
});

// Red-team re-verify HIGH-1 (round 2): the 4 entries that previously carried a bare
// "GSD-T" sentinel must NOT delete a user file that merely says "GSD-T" in a comment.
test("copyBinToolsToProject does NOT delete user files named after the formerly-loose strays", () => {
  const looseNames = [
    "context-budget-audit.cjs",
    "context-meter-config.cjs",
    "handoff-lock.cjs",
    "unattended-watch-format.cjs",
  ];
  const tmp = mkTmp("sweep-skip-loose");
  const binDir = path.join(tmp, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "consumer-app", version: "1.0.0" }));
  const userOwned = {};
  for (const n of looseNames) {
    // Mentions "GSD-T" in a comment (realistic in a consumer repo) but carries NO
    // verbatim product header — must survive the sweep.
    const content = "#!/usr/bin/env node\n// my own helper for my GSD-T project\nmodule.exports = function(){ return 'mine'; };\n";
    userOwned[n] = content;
    fs.writeFileSync(path.join(binDir, n), content);
  }

  const gt = require(SRC_GSD_T);
  gt.copyBinToolsToProject(tmp, "consumer-app");

  for (const n of looseNames) {
    const fp = path.join(binDir, n);
    assert.ok(fs.existsSync(fp), `user file ${n} mentioning GSD-T (no shipped header) must survive`);
    assert.equal(fs.readFileSync(fp, "utf8"), userOwned[n], `${n} content unchanged`);
  }
});

// Positive-match: the genuine retired headless-exit-codes.cjs (verbatim shipped
// header, lowercase "headless") MUST be swept. Guards against sentinel/header drift
// (a case-mismatched sentinel would silently under-delete — M68 red-team LOW).
test("copyBinToolsToProject sweeps the genuine headless-exit-codes.cjs by its verbatim header", () => {
  const tmp = mkTmp("sweep-headless-exit");
  const binDir = path.join(tmp, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "consumer-app", version: "1.0.0" }));
  const real = path.join(binDir, "headless-exit-codes.cjs");
  // Verbatim shipped header (lowercase "headless", as it actually shipped).
  fs.writeFileSync(real, "/**\n * Shared helper: map a `claude -p` process exit code + output to the\n * GSD-T headless exit-code contract.\n */\nmodule.exports = {};\n");

  const gt = require(SRC_GSD_T);
  gt.copyBinToolsToProject(tmp, "consumer-app");

  assert.ok(!fs.existsSync(real), "genuine retired headless-exit-codes.cjs must be swept");
});
