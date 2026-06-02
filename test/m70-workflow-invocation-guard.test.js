"use strict";

// M70 — every workflow-backed command file must carry an imperative "invoke the
// Workflow tool, do not hand-drive" guard. Origin: a brand-new session running a
// scan read the v4.0.16 command file and STILL hand-drove the 18-slice fan-out
// (skipping the deterministic synthesis/document/render stages) because the prose
// described the workflow's internals and read like a to-do list. The guard makes
// hand-driving impossible to rationalize; this test keeps it from regressing.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const CMD_DIR = path.resolve(__dirname, "..", "commands");

// Commands whose body invokes the Workflow tool (must carry the guard).
const WORKFLOW_COMMANDS = ["scan", "execute", "verify", "wave", "integrate", "debug"];

for (const c of WORKFLOW_COMMANDS) {
  test(`gsd-t-${c}.md carries the do-not-hand-drive Workflow guard`, () => {
    const fp = path.join(CMD_DIR, `gsd-t-${c}.md`);
    const body = fs.readFileSync(fp, "utf8");
    // The guard marker (⛔) must appear in the first ~30 lines (top of file), not
    // buried after the prose where an agent has already started improvising.
    const head = body.split("\n").slice(0, 30).join("\n");
    assert.match(head, /⛔/, `gsd-t-${c}.md must have a ⛔ guard near the top`);
    assert.match(
      head,
      /do not hand-drive|do NOT .*hand-driv|invoke the Workflow tool/i,
      `gsd-t-${c}.md guard must forbid hand-driving and direct to the Workflow tool`
    );
  });
}

// The scan command (the proven failure case) gets the strongest guard: it must
// explicitly forbid self-slicing and self-spawning finders, and name the failure.
test("gsd-t-scan.md guard explicitly forbids self-slicing / self-spawning finders", () => {
  const body = fs.readFileSync(path.join(CMD_DIR, "gsd-t-scan.md"), "utf8");
  assert.match(body, /carve the codebase into|slices/i, "names the slicing it forbids");
  assert.match(body, /spawn deep-finder|spawn .*finder|finder agents/i, "forbids self-spawning finders");
  assert.match(body, /fallback/i, "explicitly rejects the 'proven fallback' hand-driven pattern");
  assert.match(body, /FAILURE|doing it wrong/i, "names hand-driving as a failure");
});
