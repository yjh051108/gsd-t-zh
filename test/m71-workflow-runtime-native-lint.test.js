"use strict";

// M71 — every *.workflow.js MUST be runtime-native: the Anthropic Workflow tool
// sandbox provides ONLY the globals agent/parallel/pipeline/log/phase/budget/args.
// It does NOT provide require/module/fs/path/child_process/process. Any such call
// throws `ReferenceError: require is not defined` at runtime (the bug that made
// EVERY GSD-T workflow silently fail and fall back to a hand-driven run).
//
// `node --check` only validates syntax — it cannot catch a forbidden global. This
// static lint is the cheap mechanical guard; a real-sandbox run is the other half
// of the acceptance gate (per M71 decision: "both").

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const WF_DIR = path.resolve(__dirname, "..", "templates", "workflows");

// Forbidden tokens that indicate a Node/CommonJS dependency the sandbox lacks.
// Matched as whole-ish identifiers to avoid false hits inside strings/comments is
// imperfect, but the workflow scripts must not contain these AT ALL — not even in
// a string the agent might eval — so a blunt presence check is correct here.
const FORBIDDEN = [
  /\brequire\s*\(/,                 // require("fs"), require("./_lib.js")
  /\bmodule\.exports\b/,
  /\bchild_process\b/,
  /\bspawnSync\b/,
  /\bexecSync\b/,
  /\bexecFileSync\b/,
  /\bprocess\.execPath\b/,
  /\bfs\.(readFileSync|writeFileSync|existsSync|renameSync|copyFileSync|mkdirSync|statSync|readdirSync|unlinkSync)\b/,
];

// _lib.js is a CommonJS helper module (require/fs by design) consumed by the OLD
// architecture; once workflows are runtime-native they no longer require it. While
// the migration is in progress, only assert on workflows already migrated.
const RUNTIME_NATIVE = ["gsd-t-scan.workflow.js"]; // M71: scan first; others follow.

for (const f of RUNTIME_NATIVE) {
  test(`${f} contains no sandbox-forbidden Node/CommonJS calls`, () => {
    const body = fs.readFileSync(path.join(WF_DIR, f), "utf8");
    const hits = [];
    body.split("\n").forEach((line, i) => {
      // Skip pure comment lines — a doc reference to "require" in prose is fine.
      const code = line.replace(/\/\/.*$/, "");
      for (const re of FORBIDDEN) {
        if (re.test(code)) hits.push(`  line ${i + 1}: ${line.trim().slice(0, 100)}  [${re}]`);
      }
    });
    assert.equal(
      hits.length,
      0,
      `${f} uses sandbox-forbidden calls (will throw ReferenceError at runtime):\n${hits.join("\n")}`
    );
  });
}

test("the runtime-native list is non-empty (guard against silently disabling the lint)", () => {
  assert.ok(RUNTIME_NATIVE.length >= 1, "at least scan must be runtime-native");
});

// NOTE: a dangling-reference bug (a removed stage leaving `render` referenced in the
// final return) crashed run wf_9c993376-097 with ReferenceError AFTER 44 agents ran.
// `node --check` can't catch that (valid syntax, undefined only at runtime). A regex
// undefined-reference linter proved too crude (false-positives on object keys), so
// the guard against this class of bug is the ACCEPTANCE GATE: every runtime-native
// workflow must be RUN in the real sandbox to completion before shipping — see the
// M71 process note. node --check + this forbidden-globals lint are necessary but NOT
// sufficient; the live run is the proof.
