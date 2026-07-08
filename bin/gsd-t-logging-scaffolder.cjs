"use strict";

// bin/gsd-t-logging-scaffolder.cjs
//
// M100-D1 — the stack-adaptive storage SCAFFOLDER that STOPS for human
// approval and NEVER silently picks a logging backend. Owns the sole
// init-scaffold seam consumed by d2 (trace machinery), d4 (audit machinery),
// and d5 (migrate-logging / defaults pilot).
//
// Contract: .gsd-t/contracts/logging-scaffold-seam-contract.md (1.0.0)
//
// scaffoldLogging({ projectDir, stack, approve }) -> envelope
//   Without `approve`:
//     { status: "PAUSED", alternatives: [...], resumeToken }
//     — NEVER writes a backend, NEVER returns a `backend` value.
//   With `approve` (first-time) or a valid recorded choice already on disk:
//     { backend, traceSink, auditSink, recordedAt, resumeToken }
//
// Zero external npm runtime deps — fs/path/crypto only.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const VALID_BACKENDS = ["db-table", "local-sqlite", "local-jsonl"];

const CHOICE_DIR = ".gsd-t";
const CHOICE_FILE = "logging-scaffold-choice.json";

// ─── Stack detection ─────────────────────────────────────────────────────────
//
// has-DB (package.json deps signal a DB client, or a DB config file/env is
// present) -> table-backed alternative is offered.
// no-server/desktop -> local store alternatives (sqlite | flat-file jsonl),
// with sqlite flagged as the recommended default for audit queryability.

const DB_DEP_SIGNATURES = [
  "pg", "postgres", "postgresql", "mysql", "mysql2", "mongodb", "mongoose",
  "sequelize", "prisma", "typeorm", "knex", "drizzle-orm", "better-sqlite3",
  "sqlite3", "@supabase/supabase-js", "planetscale",
];

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_) {
    return null;
  }
}

function detectStack(projectDir) {
  const pkgPath = path.join(projectDir, "package.json");
  const pkg = readJsonSafe(pkgPath) || {};
  const deps = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
  const depNames = Object.keys(deps).map((d) => d.toLowerCase());

  const hasDb = DB_DEP_SIGNATURES.some((sig) =>
    depNames.some((d) => d === sig || d.includes(sig))
  );

  // Server signal: a "start"/"dev" script implies a running server process
  // that could own a DB connection; a "bin" field implies a CLI/desktop tool.
  const scripts = pkg.scripts || {};
  const hasServerScript = !!(scripts.start || scripts.dev || scripts.serve);
  const isCliOrDesktop = !!pkg.bin || !hasServerScript;

  return {
    hasDb,
    isCliOrDesktop,
    detectedFrom: pkgPath,
  };
}

// ─── Alternatives ────────────────────────────────────────────────────────────
//
// MUST present REAL alternatives — never silently pick. SQLite is flagged
// over flat-file (jsonl) for audit queryability per contract §Detect.

function buildAlternatives(stack) {
  const alternatives = [];

  if (stack.hasDb) {
    alternatives.push({
      backend: "db-table",
      label: "Database table (uses the project's existing DB connection)",
      recommended: true,
      reason: "Project already has a database dependency — reuse it for queryable trace/audit rows.",
    });
  }

  alternatives.push({
    backend: "local-sqlite",
    label: "Local SQLite file (.gsd-t/logging.db)",
    recommended: !stack.hasDb,
    reason: "Queryable via SQL — required for the audit admin query surface. Recommended over flat-file when no server DB is present.",
  });

  alternatives.push({
    backend: "local-jsonl",
    label: "Local flat-file JSONL (.gsd-t/logging.jsonl)",
    recommended: false,
    reason: "Simplest option, but NOT queryable — flagged below SQLite for audit use cases that need query support.",
  });

  return alternatives;
}

// ─── Recorded-choice persistence ────────────────────────────────────────────

function choiceFilePath(projectDir) {
  return path.join(projectDir, CHOICE_DIR, CHOICE_FILE);
}

function isValidRecordedChoice(record) {
  if (!record || typeof record !== "object") return false;
  if (typeof record.backend !== "string") return false;
  if (!VALID_BACKENDS.includes(record.backend)) return false;
  if (typeof record.recordedAt !== "string" || !record.recordedAt) return false;
  if (typeof record.resumeToken !== "string" || !record.resumeToken) return false;
  return true;
}

// Reads + validates the recorded choice. A corrupt/partial/truncated file,
// or a record whose `backend` is out of the fixed enum, is treated as
// "no recorded choice" — never crashes, never silently proceeds with a bad
// value. See M100 pre-mortem FINDING 7.
function readRecordedChoice(projectDir) {
  const filePath = choiceFilePath(projectDir);
  if (!fs.existsSync(filePath)) return null;
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (_) {
    return null;
  }
  let record;
  try {
    record = JSON.parse(raw);
  } catch (_) {
    // Corrupt/truncated JSON — treated as unrecorded, never crashes.
    return null;
  }
  if (!isValidRecordedChoice(record)) return null;
  return record;
}

function writeRecordedChoice(projectDir, record) {
  const dir = path.join(projectDir, CHOICE_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = choiceFilePath(projectDir);
  fs.writeFileSync(filePath, JSON.stringify(record, null, 2) + "\n", "utf8");
}

// ─── Doc-record writer ──────────────────────────────────────────────────────
//
// Records the chosen backend into the project's CLAUDE.md (preferred) or
// docs/infrastructure.md (fallback) so the choice is human-visible without
// re-reading the raw JSON record.

const DOC_MARKER_START = "<!-- gsd-t-logging-scaffold:start -->";
const DOC_MARKER_END = "<!-- gsd-t-logging-scaffold:end -->";

function docBlock(envelope) {
  return [
    DOC_MARKER_START,
    "## Logging Backend (M100)",
    "",
    `**Backend:** \`${envelope.backend}\``,
    `**Recorded:** ${envelope.recordedAt}`,
    `**Trace sink:** ${envelope.traceSink.kind} (${envelope.traceSink.path || envelope.traceSink.table})`,
    `**Audit sink:** ${envelope.auditSink.kind} (${envelope.auditSink.path || envelope.auditSink.table}) — queryable: ${envelope.auditSink.kind !== "flat-file"}`,
    "",
    DOC_MARKER_END,
  ].join("\n");
}

function writeChoiceToProjectDocs(projectDir, envelope) {
  const candidates = [
    path.join(projectDir, "CLAUDE.md"),
    path.join(projectDir, "docs", "infrastructure.md"),
  ];
  const targetPath = candidates.find((p) => fs.existsSync(p)) || candidates[0];

  const block = docBlock(envelope);
  let content = "";
  if (fs.existsSync(targetPath)) {
    content = fs.readFileSync(targetPath, "utf8");
  } else {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  if (content.includes(DOC_MARKER_START) && content.includes(DOC_MARKER_END)) {
    const startIdx = content.indexOf(DOC_MARKER_START);
    const endIdx = content.indexOf(DOC_MARKER_END) + DOC_MARKER_END.length;
    content = content.slice(0, startIdx) + block + content.slice(endIdx);
  } else {
    content = content.replace(/\s*$/, "") + "\n\n" + block + "\n";
  }

  fs.writeFileSync(targetPath, content, "utf8");
  return targetPath;
}

// ─── Seam envelope builder ──────────────────────────────────────────────────

function sinkFor(backend, kind) {
  // kind: "trace" | "audit"
  if (backend === "db-table") {
    return { kind: "db-table", table: kind === "trace" ? "gsdt_trace_log" : "gsdt_audit_log" };
  }
  if (backend === "local-sqlite") {
    return { kind: "sqlite", path: `.gsd-t/${kind}.db` };
  }
  // local-jsonl
  return { kind: "flat-file", path: `.gsd-t/${kind}.jsonl` };
}

function buildEnvelope(backend, recordedAt, resumeToken) {
  return {
    backend,
    traceSink: sinkFor(backend, "trace"),
    auditSink: sinkFor(backend, "audit"),
    recordedAt,
    resumeToken,
  };
}

function makeResumeToken(projectDir) {
  return crypto.createHash("sha256").update(path.resolve(projectDir)).digest("hex").slice(0, 16);
}

// ─── The seam entry point ───────────────────────────────────────────────────

function scaffoldLogging({ projectDir, stack, approve, resumeToken } = {}) {
  if (!projectDir) throw new Error("scaffoldLogging: projectDir is required");

  const detectedStack = stack || detectStack(projectDir);
  const token = resumeToken || makeResumeToken(projectDir);

  // Deterministic resume: if a VALID recorded choice already exists for this
  // token, short-circuit — never re-prompt. Corrupt/partial/unmatched/
  // out-of-enum records all fall through to PAUSE (M100 pre-mortem FINDING 7).
  const recorded = readRecordedChoice(projectDir);
  if (recorded && recorded.resumeToken === token) {
    return buildEnvelope(recorded.backend, recorded.recordedAt, recorded.resumeToken);
  }

  if (!approve) {
    // NEVER silently pick. STOP for human approval — the ONE sanctioned pause.
    return {
      status: "PAUSED",
      alternatives: buildAlternatives(detectedStack),
      resumeToken: token,
    };
  }

  if (!VALID_BACKENDS.includes(approve)) {
    throw new Error(
      `scaffoldLogging: approve must be one of ${VALID_BACKENDS.join(", ")}, got "${approve}"`
    );
  }

  const recordedAt = new Date().toISOString();
  const record = { backend: approve, recordedAt, resumeToken: token };
  writeRecordedChoice(projectDir, record);

  const envelope = buildEnvelope(approve, recordedAt, token);
  writeChoiceToProjectDocs(projectDir, envelope);

  return envelope;
}

module.exports = {
  scaffoldLogging,
  detectStack,
  buildAlternatives,
  readRecordedChoice,
  isValidRecordedChoice,
  VALID_BACKENDS,
};
