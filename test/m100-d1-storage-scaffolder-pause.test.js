"use strict";

/**
 * M100-D1 — storage scaffolder pause / no-silent-pick / deterministic resume.
 *
 * Proves:
 *   - T1: scaffoldLogging() WITHOUT `approve` PAUSES — never writes a backend,
 *     never returns a `backend` value (KILLING TEST).
 *   - T1: detectStack() maps has-DB -> db-table alternative; no-server/desktop
 *     -> local-sqlite | local-jsonl; sqlite flagged over flat-file for audit
 *     queryability.
 *   - T2: a recorded choice resumes deterministically (no re-prompt).
 *   - T2: corrupt/partial/unmatched/out-of-enum recorded choices are treated
 *     as unrecorded and re-enter PAUSE — never crash, never silently proceed.
 *   - T2: the chosen backend lands in the fixture's CLAUDE.md.
 *   - T3: the full seam envelope shape, with a QUERYABLE audit sink on
 *     no-server (sqlite, not flat file).
 *   - T3: bin/gsd-t.js has a "migrate-logging" dispatch case delegating to
 *     bin/gsd-t-migrate-logging.cjs.
 *   - T3: dispatch-halt-on-PAUSE integration killing-test — the real init
 *     dispatch path halts on status:"PAUSED" before any sink write.
 *
 * [RULE] storage-approval-paused
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const ROOT = path.join(__dirname, "..");
const {
  scaffoldLogging,
  detectStack,
  buildAlternatives,
  VALID_BACKENDS,
} = require(path.join(ROOT, "bin", "gsd-t-logging-scaffolder.cjs"));

function mkTmpProject(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `gsdt-${prefix}-`));
}

function rmTmp(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_) {
    // best-effort cleanup
  }
}

// ─── T1: KILLING TEST — no approve => PAUSE, never a backend ────────────────

test("scaffoldLogging without approve PAUSES and never returns a backend value", () => {
  const dir = mkTmpProject("pause");
  try {
    const result = scaffoldLogging({ projectDir: dir });
    assert.equal(result.status, "PAUSED");
    assert.ok(Array.isArray(result.alternatives) && result.alternatives.length > 0);
    assert.equal(result.backend, undefined, "PAUSED envelope must not carry a backend value");
    assert.equal(typeof result.resumeToken, "string");
  } finally {
    rmTmp(dir);
  }
});

test("scaffoldLogging without approve does not write any backend file to disk", () => {
  const dir = mkTmpProject("pause-nowrite");
  try {
    scaffoldLogging({ projectDir: dir });
    const choiceFile = path.join(dir, ".gsd-t", "logging-scaffold-choice.json");
    assert.equal(fs.existsSync(choiceFile), false, "no choice file should be written without approve");
  } finally {
    rmTmp(dir);
  }
});

// ─── T1: detectStack() mapping ───────────────────────────────────────────────

test("detectStack: has-DB dependency maps to a db-table alternative", () => {
  const dir = mkTmpProject("hasdb");
  try {
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "x", dependencies: { pg: "^8.0.0" }, scripts: { start: "node server.js" } })
    );
    const stack = detectStack(dir);
    assert.equal(stack.hasDb, true);
    const alts = buildAlternatives(stack);
    const dbAlt = alts.find((a) => a.backend === "db-table");
    assert.ok(dbAlt, "db-table alternative must be present when a DB dep is detected");
    assert.equal(dbAlt.recommended, true);
  } finally {
    rmTmp(dir);
  }
});

test("detectStack: no-server/desktop project maps to local store alternatives, sqlite flagged for audit queryability", () => {
  const dir = mkTmpProject("nodb");
  try {
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "x", bin: { x: "./bin/x.js" } })
    );
    const stack = detectStack(dir);
    assert.equal(stack.hasDb, false);
    assert.equal(stack.isCliOrDesktop, true);
    const alts = buildAlternatives(stack);
    const backends = alts.map((a) => a.backend);
    assert.ok(backends.includes("local-sqlite"));
    assert.ok(backends.includes("local-jsonl"));
    const sqliteAlt = alts.find((a) => a.backend === "local-sqlite");
    const jsonlAlt = alts.find((a) => a.backend === "local-jsonl");
    assert.equal(sqliteAlt.recommended, true, "sqlite should be flagged/recommended over flat-file for audit queryability");
    assert.equal(jsonlAlt.recommended, false);
  } finally {
    rmTmp(dir);
  }
});

// ─── T2: deterministic resume ────────────────────────────────────────────────

test("scaffoldLogging: a recorded choice resumes deterministically without re-prompting", () => {
  const dir = mkTmpProject("resume");
  try {
    const first = scaffoldLogging({ projectDir: dir, approve: "local-sqlite" });
    assert.equal(first.backend, "local-sqlite");
    assert.equal(typeof first.recordedAt, "string");

    const second = scaffoldLogging({ projectDir: dir });
    assert.notEqual(second.status, "PAUSED", "a recorded choice must not re-prompt");
    assert.equal(second.backend, "local-sqlite");
    assert.equal(second.resumeToken, first.resumeToken);
  } finally {
    rmTmp(dir);
  }
});

test("scaffoldLogging: records the backend into the project's CLAUDE.md", () => {
  const dir = mkTmpProject("docrecord");
  try {
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), "# Test Project\n");
    scaffoldLogging({ projectDir: dir, approve: "db-table" });
    const claudeMd = fs.readFileSync(path.join(dir, "CLAUDE.md"), "utf8");
    assert.ok(claudeMd.includes("db-table"), "CLAUDE.md must record the chosen backend");
    assert.ok(claudeMd.includes("Logging Backend"));
  } finally {
    rmTmp(dir);
  }
});

// ─── T2: corrupt/invalid recorded-choice killing sub-cases (pre-mortem #7) ──

test("scaffoldLogging: corrupt/truncated recorded-choice JSON re-enters PAUSE, never crashes", () => {
  const dir = mkTmpProject("corrupt");
  try {
    fs.mkdirSync(path.join(dir, ".gsd-t"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, ".gsd-t", "logging-scaffold-choice.json"),
      '{"backend": "local-sqlite", "recordedAt": ' // truncated
    );
    const result = scaffoldLogging({ projectDir: dir });
    assert.equal(result.status, "PAUSED");
    assert.equal(result.backend, undefined);
  } finally {
    rmTmp(dir);
  }
});

test("scaffoldLogging: recorded-choice missing the backend field re-enters PAUSE", () => {
  const dir = mkTmpProject("missingfield");
  try {
    fs.mkdirSync(path.join(dir, ".gsd-t"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, ".gsd-t", "logging-scaffold-choice.json"),
      JSON.stringify({ recordedAt: new Date().toISOString(), resumeToken: "abc123" })
    );
    const result = scaffoldLogging({ projectDir: dir });
    assert.equal(result.status, "PAUSED");
    assert.equal(result.backend, undefined);
  } finally {
    rmTmp(dir);
  }
});

test("scaffoldLogging: a resumeToken matching NO recorded choice returns PAUSE, never a stale/empty backend", () => {
  const dir = mkTmpProject("unmatched");
  try {
    fs.mkdirSync(path.join(dir, ".gsd-t"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, ".gsd-t", "logging-scaffold-choice.json"),
      JSON.stringify({ backend: "local-sqlite", recordedAt: new Date().toISOString(), resumeToken: "token-A" })
    );
    const result = scaffoldLogging({ projectDir: dir, resumeToken: "token-B-does-not-match" });
    assert.equal(result.status, "PAUSED");
    assert.equal(result.backend, undefined);
  } finally {
    rmTmp(dir);
  }
});

test("scaffoldLogging: an out-of-enum recorded backend value is treated as unrecorded and re-prompts", () => {
  const dir = mkTmpProject("badenum");
  try {
    fs.mkdirSync(path.join(dir, ".gsd-t"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, ".gsd-t", "logging-scaffold-choice.json"),
      JSON.stringify({ backend: "mongodb-blob-nonsense", recordedAt: new Date().toISOString(), resumeToken: "abc123" })
    );
    const result = scaffoldLogging({ projectDir: dir, resumeToken: "abc123" });
    assert.equal(result.status, "PAUSED");
    assert.equal(result.backend, undefined);
    assert.ok(!VALID_BACKENDS.includes("mongodb-blob-nonsense"));
  } finally {
    rmTmp(dir);
  }
});

// ─── T3: full seam envelope shape + queryable audit sink ────────────────────

test("scaffoldLogging: returns the full seam envelope with a QUERYABLE audit sink on no-server", () => {
  const dir = mkTmpProject("envelope");
  try {
    const result = scaffoldLogging({ projectDir: dir, approve: "local-sqlite" });
    assert.equal(result.backend, "local-sqlite");
    assert.ok(result.traceSink && typeof result.traceSink.kind === "string");
    assert.ok(result.auditSink && typeof result.auditSink.kind === "string");
    assert.notEqual(result.auditSink.kind, "flat-file", "audit sink must be queryable, not a flat file, on no-server");
    assert.equal(typeof result.recordedAt, "string");
    assert.equal(typeof result.resumeToken, "string");
  } finally {
    rmTmp(dir);
  }
});

// ─── T3: dispatch wiring in bin/gsd-t.js ────────────────────────────────────

test("bin/gsd-t.js has a migrate-logging dispatch case delegating to gsd-t-migrate-logging.cjs", () => {
  const content = fs.readFileSync(path.join(ROOT, "bin", "gsd-t.js"), "utf8");
  assert.ok(content.includes('case "migrate-logging"'), "dispatch switch must include case \"migrate-logging\"");
  assert.ok(
    content.includes("gsd-t-migrate-logging.cjs") || content.includes("gsd-t-migrate-logging"),
    "migrate-logging case must delegate to bin/gsd-t-migrate-logging.cjs"
  );
});

test("bin/gsd-t.js init dispatch calls scaffoldLogging via gsd-t-logging-scaffolder.cjs", () => {
  const content = fs.readFileSync(path.join(ROOT, "bin", "gsd-t.js"), "utf8");
  assert.ok(
    content.includes("gsd-t-logging-scaffolder.cjs"),
    "bin/gsd-t.js must require the logging scaffolder module"
  );
  assert.ok(
    content.includes("scaffoldLogging("),
    "bin/gsd-t.js init flow must call scaffoldLogging(...)"
  );
});

// ─── T3: dispatch-halt-on-PAUSE integration killing-test ────────────────────
//
// M100 pre-mortem FINDING (HIGH): capability built but the caller acting on
// it is never tested. This drives the REAL init dispatch path in
// bin/gsd-t.js (via runLoggingScaffoldStep, the extracted, directly callable
// step function) with no recorded choice and asserts the flow halts.

test("init dispatch HALTS on status:PAUSED before any sink/template write (integration)", () => {
  const dir = mkTmpProject("dispatch-halt");
  try {
    const gsdt = require(path.join(ROOT, "bin", "gsd-t.js"));
    assert.equal(
      typeof gsdt.runLoggingScaffoldStep,
      "function",
      "bin/gsd-t.js must export runLoggingScaffoldStep for the init dispatch path to be integration-tested"
    );

    const outcome = gsdt.runLoggingScaffoldStep(dir);

    // (a) halts on PAUSED — does not continue to write any trace/audit sink files
    assert.equal(outcome.halted, true, "init dispatch must halt on status:PAUSED");
    const traceDb = path.join(dir, ".gsd-t", "trace.db");
    const auditDb = path.join(dir, ".gsd-t", "audit.db");
    const traceJsonl = path.join(dir, ".gsd-t", "trace.jsonl");
    const auditJsonl = path.join(dir, ".gsd-t", "audit.jsonl");
    for (const p of [traceDb, auditDb, traceJsonl, auditJsonl]) {
      assert.equal(fs.existsSync(p), false, `must not write sink file ${p} while paused`);
    }

    // (b) no downstream module template instantiated with an undefined/empty backend
    assert.equal(outcome.backend, undefined, "must not surface an undefined/empty backend as if resolved");

    // (c) surfaces alternatives[] to the user rather than consuming the paused envelope as a result
    assert.ok(Array.isArray(outcome.alternatives) && outcome.alternatives.length > 0);
  } finally {
    rmTmp(dir);
  }
});

test("init dispatch proceeds to a resolved backend once approved (no halt, envelope valid)", () => {
  const dir = mkTmpProject("dispatch-resolved");
  try {
    const gsdt = require(path.join(ROOT, "bin", "gsd-t.js"));
    const outcome = gsdt.runLoggingScaffoldStep(dir, { approve: "local-jsonl" });
    assert.equal(outcome.halted, false);
    assert.equal(outcome.backend, "local-jsonl");
  } finally {
    rmTmp(dir);
  }
});
