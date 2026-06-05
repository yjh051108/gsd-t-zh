"use strict";

// M81 — TD-113 fix: port the other 6 workflows + quick off require("./_lib.js") to the
// runtime-native inline-helper pattern (the Anthropic Workflow sandbox provides no
// require/fs/path/child_process/process). Before this, EVERY workflow except scan threw
// ReferenceError on first eval and never ran — confirmed live by the NiceNote session
// 2026-06-05 (and by the GSD-T self-scan, TD-113). The M71 lint (expanded to all 8) is
// the mechanical guard; this file adds the structural invariants the port must hold.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const WF_DIR = path.resolve(__dirname, "..", "templates", "workflows");
const ALL_WORKFLOWS = [
  "gsd-t-scan", "gsd-t-execute", "gsd-t-verify", "gsd-t-wave",
  "gsd-t-integrate", "gsd-t-debug", "gsd-t-phase", "gsd-t-quick",
].map((n) => `${n}.workflow.js`);

function read(f) { return fs.readFileSync(path.join(WF_DIR, f), "utf8"); }
// Strip line comments so assertions test EXECUTABLE code, not the M81 explanatory
// comments (which legitimately mention the require("./_lib.js") they replaced).
function code(f) { return read(f).split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n"); }

test("no workflow imports _lib.js (the require that crashed the sandbox)", () => {
  for (const f of ALL_WORKFLOWS) {
    assert.doesNotMatch(code(f), /require\(["']\.\/_lib\.js["']\)/, `${f} still requires ./_lib.js`);
  }
});

test("every workflow parses args as a JSON string (the runtime passes args stringified)", () => {
  for (const f of ALL_WORKFLOWS) {
    assert.match(
      read(f),
      /typeof args === ["']string["']/,
      `${f} must guard for args arriving as a JSON string (else args.foo is undefined)`
    );
  }
});

test("the 6 ported + quick define inline runtime-native CLI helpers, not _lib delegation", () => {
  // scan never used _lib helpers; the 7 others replaced lib.runPreflight/etc with inline
  // async functions that call agent()-wrapped Bash. Assert the helper + the call shape.
  const NEEDS_CLI = ["gsd-t-execute", "gsd-t-verify", "gsd-t-integrate", "gsd-t-debug", "gsd-t-phase", "gsd-t-quick"]
    .map((n) => `${n}.workflow.js`);
  for (const f of NEEDS_CLI) {
    const c = code(f);
    assert.match(c, /async function runCli\(/, `${f} must define the runtime-native runCli helper`);
    assert.doesNotMatch(c, /\blib\.\w+\(/, `${f} must not call lib.* (orchestrator spawnSync) anymore`);
  }
});

test("verify's CI-parity + test-data gates are awaited runCli calls, not raw spawnSync", () => {
  const c = code("gsd-t-verify.workflow.js");
  assert.doesNotMatch(c, /\bspawnSync\b/, "verify must not use spawnSync in the orchestrator");
  assert.doesNotMatch(c, /\b_runJsonCli\b/, "the old _runJsonCli helper must be gone");
  // FAIL-blocking semantics preserved: build-coverage + ci-parity + test-data still gate.
  assert.match(c, /build-coverage/, "M57 build-coverage gate preserved");
  assert.match(c, /ci-parity/, "M57 ci-parity gate preserved");
  assert.match(c, /test-data/, "M58 test-data purge gate preserved");
  assert.match(c, /VERIFY-FAILED/, "FAIL-blocking verdict preserved");
});

test("no workflow uses Date.now()/Math.random() in the orchestrator (banned in the sandbox)", () => {
  for (const f of ALL_WORKFLOWS) {
    const body = read(f);
    // Strip line comments; these must not appear in executable orchestrator code.
    const code = body.split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
    assert.doesNotMatch(code, /\bDate\.now\s*\(/, `${f} uses Date.now() — unavailable in the Workflow sandbox`);
    assert.doesNotMatch(code, /\bMath\.random\s*\(/, `${f} uses Math.random() — unavailable in the Workflow sandbox`);
  }
});
