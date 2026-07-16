"use strict";

// M69 — `gsd-t workflow-path <name>` resolves a workflow script to its ABSOLUTE
// path from the CLI's own install root, so command files don't hard-code a relative
// `templates/workflows/...` scriptPath (which only resolves from the GSD-T source
// repo, silently breaking Workflow() from any consumer project — the Hilo scan bug).

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");

const CLI = path.resolve(__dirname, "..", "bin", "gsd-t.js");

function run(args, cwd) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", cwd: cwd || process.cwd() });
}

test("workflow-path resolves a known workflow to an existing absolute path", () => {
  const r = run(["workflow-path", "scan"]);
  assert.equal(r.status, 0, "exit 0 for a known workflow");
  const p = r.stdout.trim();
  assert.ok(path.isAbsolute(p), "path is absolute");
  assert.ok(
    p.endsWith(path.normalize("templates/workflows/gsd-t-scan.workflow.js")),
    "points at the scan workflow"
  );
  assert.ok(fs.existsSync(p), "resolved path exists on disk");
});

test("workflow-path resolves correctly even when CWD is an unrelated dir (the consumer-project case)", () => {
  // This is the actual bug: a relative scriptPath fails here, an absolute one works.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wf-path-cwd-"));
  const r = run(["workflow-path", "scan"], tmp);
  assert.equal(r.status, 0, "exit 0 regardless of CWD");
  assert.ok(fs.existsSync(r.stdout.trim()), "absolute path resolves from an unrelated CWD");
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("workflow-path accepts name aliases (with prefix / with suffix)", () => {
  const bare = run(["workflow-path", "scan"]).stdout.trim();
  const prefixed = run(["workflow-path", "gsd-t-scan"]).stdout.trim();
  const suffixed = run(["workflow-path", "scan.workflow.js"]).stdout.trim();
  assert.equal(prefixed, bare, "gsd-t- prefix normalizes to the same path");
  assert.equal(suffixed, bare, ".workflow.js suffix normalizes to the same path");
});

test("workflow-path resolves all 8 shipped workflows", () => {
  for (const w of ["scan", "execute", "verify", "wave", "integrate", "debug", "quick", "phase"]) {
    const r = run(["workflow-path", w]);
    assert.equal(r.status, 0, `${w} resolves (exit 0)`);
    assert.ok(fs.existsSync(r.stdout.trim()), `${w} path exists`);
  }
});

test("workflow-path exits 4 + lists available workflows for an unknown name", () => {
  const r = run(["workflow-path", "bogus"]);
  assert.equal(r.status, 4, "exit 4 for unknown workflow");
  assert.match(r.stderr, /unknown workflow/i, "stderr explains the failure");
  assert.match(r.stderr, /Available:/, "stderr lists available workflows");
});

test("workflow-path exits 64 with usage when no name is given", () => {
  const r = run(["workflow-path"]);
  assert.equal(r.status, 64, "exit 64 (usage) when name omitted");
  assert.match(r.stderr, /usage/i, "prints usage");
});
