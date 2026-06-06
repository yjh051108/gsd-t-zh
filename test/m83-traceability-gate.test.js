"use strict";

// M83 — Plan-phase acceptance-traceability gate (bin/gsd-t-traceability-gate.cjs).
// Origin: NiceNote M5 shipped its headline AC-6 (100MB+ chunked read) as DEAD
// CODE with no test; the triad burned 4 verify cycles re-litigating the
// milestone's reason to exist. This gate catches that class at PLAN time.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { runGate, parseTasks, assessTask } = require("../bin/gsd-t-traceability-gate.cjs");

function tmpTasks(md) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m83-"));
  const f = path.join(dir, "tasks.md");
  fs.writeFileSync(f, md);
  return f;
}

// ─── The headline failure this gate exists to prevent ────────────────────

test("FAILs a headline task with no test (the NiceNote M5 AC-6 dead-code class)", () => {
  const f = tmpTasks(`# Tasks
### M5-1 — Chunked read (HEADLINE)
- **Headline**: true
- **Files**: \`src/streaming.rs\`
- **Acceptance criteria**:
  - AC-6: open 100MB+ file with bounded memory
`);
  const r = runGate({ tasksFile: f });
  assert.equal(r.ok, false);
  assert.equal(r.exitCode, 4);
  const kinds = r.violations.map((v) => v.kind);
  assert.ok(kinds.includes("headline-without-test"), "must flag headline-without-test");
  assert.ok(kinds.includes("ac-without-test"), "must flag ac-without-test");
});

test("FAILs an AC with no implementing Files path (unbacked promise)", () => {
  const f = tmpTasks(`# Tasks
### Task 1 — feature
- **Acceptance criteria**:
  - does the thing
`);
  const r = runGate({ tasksFile: f });
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => v.kind === "ac-without-path"));
});

test("FAILs a headline with only a test and no real implementation path", () => {
  const f = tmpTasks(`# Tasks
### M5-1 (HEADLINE)
- **Headline**: true
- **Files**: \`e2e/m5.spec.ts\`
- **Acceptance criteria**:
  - AC-6 something
`);
  const r = runGate({ tasksFile: f });
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => v.kind === "headline-without-impl"),
    "a headline backed only by a test file is not a real deliverable");
});

// ─── The passing case ────────────────────────────────────────────────────

test("PASSes a fully traceable plan (impl path + test for every AC)", () => {
  const f = tmpTasks(`# Tasks
### M5-1 — Chunked read (HEADLINE)
- **Headline**: true
- **Files**: \`src/streaming.rs\`, \`src/streaming.test.rs\`
- **Test**: \`e2e/m5-large-file.spec.ts\` opens a >100MB fixture
- **Acceptance criteria**:
  - AC-6: open 100MB+ file with bounded memory

### M5-2 — Size tier
- **Files**: \`src/size-tier.ts\`, \`src/size-tier.test.ts\`
- **Acceptance criteria**:
  - threshold → SourceForced (size-tier.test.ts)
`);
  const r = runGate({ tasksFile: f });
  assert.equal(r.ok, true);
  assert.equal(r.exitCode, 0);
  assert.equal(r.violations.length, 0);
  assert.equal(r.summary.behavioral, 2);
});

test("a runner mention (cargo test / vitest / playwright) counts as a test ref", () => {
  const f = tmpTasks(`# Tasks
### Task 1
- **Files**: \`src/lib.rs\`
- **Acceptance criteria**:
  - parses input; verified by cargo test
`);
  const r = runGate({ tasksFile: f });
  assert.equal(r.ok, true);
});

// ─── Scoping: non-behavioral tasks are out of scope ──────────────────────

test("a scaffolding task with NO acceptance criteria is not gated", () => {
  const f = tmpTasks(`# Tasks
### Task 1 — set up directory
- **Files**: \`src/index.ts\`
`);
  const r = runGate({ tasksFile: f });
  assert.equal(r.ok, true);
  assert.equal(r.tasks.find((t) => /Task 1/.test(t.title)).behavioral, false);
});

test("## Summary and other non-task headings are not parsed as tasks", () => {
  const tasks = parseTasks(`# Tasks
## Summary
some prose
### Task 1 — real task
- **Files**: \`a.ts\`
- **Acceptance criteria**:
  - x (a.test.ts)
`);
  assert.equal(tasks.length, 1);
  assert.match(tasks[0].title, /Task 1/);
});

// ─── Robustness ──────────────────────────────────────────────────────────

test("no tasks files → exit 64, never throws", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m83-empty-"));
  assert.doesNotThrow(() => runGate({ projectDir: dir }));
  const r = runGate({ projectDir: dir });
  assert.equal(r.exitCode, 64);
});

test("assessTask never throws on a malformed block", () => {
  assert.doesNotThrow(() => assessTask({ title: "x", lines: [] }));
  assert.doesNotThrow(() => assessTask({ title: "x", lines: ["**Acceptance criteria**:"] }));
});

// ─── Red Team M83-verify regressions (CRITICAL + 2 HIGH + 1 MEDIUM) ──────

test("CRITICAL: colon-INSIDE-bold (**Label:** v) is detected, not skipped", () => {
  // The exact NiceNote M5 dead-code plan in the colon-inside style the contract
  // itself tells authors to write. Must FAIL, not silently pass.
  const f = tmpTasks(`# Tasks
### Task M5-1: chunked 100MB reader (HEADLINE)
- **Headline:** true
- **Acceptance criteria:** opens 100MB+ files with bounded memory
- **Files:** src/reader.js
`);
  const r = runGate({ tasksFile: f });
  assert.equal(r.ok, false);
  assert.equal(r.summary.behavioral, 1, "the colon-inside AC must register the task as behavioral");
  const t = r.tasks.find((x) => /M5-1/.test(x.title));
  assert.equal(t.isHeadline, true, "**Headline:** true (colon inside) must register as headline");
  assert.ok(r.violations.some((v) => v.kind === "headline-without-test"));
});

test("HIGH: a descriptive heading (no 'task'/id word) bearing an AC is still assessed", () => {
  const f = tmpTasks(`# Tasks
### Implement the chunked reader
- **Acceptance criteria**: opens 100MB files
- **Files**: src/reader.js
`);
  const r = runGate({ tasksFile: f });
  assert.equal(r.ok, false, "descriptive-heading task must not be silently dropped");
  assert.ok(r.violations.some((v) => v.kind === "ac-without-test"));
});

test("MEDIUM: a runner mention in an UNRELATED field (Dependencies) does NOT clear the test check", () => {
  const f = tmpTasks(`# Tasks
### Task 1
- **Files**: src/x.js
- **Dependencies**: replaces the old jest setup
- **Acceptance criteria**: does the thing
`);
  const r = runGate({ tasksFile: f });
  assert.equal(r.ok, false, "an incidental 'jest' in Dependencies must not satisfy the killing-test requirement");
  assert.ok(r.violations.some((v) => v.kind === "ac-without-test"));
});

test("a runner named in the Acceptance-criteria bullet DOES clear the test check", () => {
  const f = tmpTasks(`# Tasks
### Task 1
- **Files**: src/lib.rs
- **Acceptance criteria**:
  - parses input; verified by cargo test
`);
  assert.equal(runGate({ tasksFile: f }).ok, true);
});

test("pytest conventions (test_*.py / *_test.py) in Files clear the test check (underscores preserved)", () => {
  // Red Team recheck HIGH: _bare() stripped underscores before TEST_PATH_RE,
  // false-failing Python plans. Value-level scans must preserve underscores.
  const a = tmpTasks(`# Tasks
### Task 1
- **Files:** src/parser.py, test_parser.py
- **Acceptance criteria:** parses input
`);
  assert.equal(runGate({ tasksFile: a }).ok, true, "test_parser.py must satisfy the test check");
  const b = tmpTasks(`# Tasks
### Task 1
- **Files:** src/x.py, x_foo_test.py
- **Acceptance criteria:** does it
`);
  assert.equal(runGate({ tasksFile: b }).ok, true, "*_test.py must satisfy the test check");
});

test("structural headings (Summary/Overview/Notes) are never assessed as tasks", () => {
  const f = tmpTasks(`# Tasks
## Summary
prose with an AC-ish word: acceptance criteria are great
## Overview
more prose
### Real task
- **Files**: a.ts
- **Acceptance criteria**: x (a.test.ts)
`);
  const r = runGate({ tasksFile: f });
  assert.equal(r.ok, true);
  assert.equal(r.summary.behavioral, 1, "only the real task counts; Summary/Overview are skipped");
});
