#!/usr/bin/env node
'use strict';

/**
 * GSD-T Audit-Half Action Distiller (M100-D4-T2)
 *
 * Distills the concrete per-project audit ACTION set from the project's own
 * plan/integration points — NEVER confabulates an example
 * (`feedback_no_confabulated_examples`). An unstated action is a QUESTION,
 * not an invented value. Ships the opt-out record writer for the audit
 * default-except-opt-out convention.
 *
 * Contract: .gsd-t/contracts/logging-schema-distillation-contract.md
 * Consumed contract: .gsd-t/contracts/audit-logging-contract.md §opt-out-record.
 *
 * NEVER shares a file with the trace distiller (bin/gsd-t-trace-distill.cjs,
 * owned by d2) — mechanizes no-collapse by construction (this file's own
 * path is distinct from that path).
 *
 * Exports:
 *   distillAuditActions(planPath) -> { actions: Array<{ action, target, source }> }
 *   writeOptOut(projectDir, reason) -> the written opt-out record
 *   readOptOut(projectDir) -> the opt-out record, or null if absent/invalid
 */

const fs = require('fs');
const path = require('path');

// ── §opt-out-record — pinned shape (audit-logging-contract.md §opt-out-record) ──

const OPTOUT_REL_PATH = path.join('.gsd-t', 'audit-optout.json');

/**
 * Writes the canonical opt-out record to `<projectDir>/.gsd-t/audit-optout.json`.
 * Shape is FIXED by the contract — do not invent alternate keys/paths.
 */
function writeOptOut(projectDir, reason) {
  if (typeof reason !== 'string' || reason.trim().length === 0) {
    throw new Error('writeOptOut: reason must be a non-empty string');
  }
  const record = { auditOptOut: true, reason };
  const dir = path.join(projectDir, '.gsd-t');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(projectDir, OPTOUT_REL_PATH);
  fs.writeFileSync(filePath, JSON.stringify(record, null, 2) + '\n', 'utf8');
  return record;
}

/**
 * Reads + validates the opt-out record. Returns null if the file is absent,
 * unparseable, or fails either field rule (fail-closed — an unrecognized
 * record is treated as absent, never as an implicit pass).
 */
function readOptOut(projectDir) {
  const filePath = path.join(projectDir, OPTOUT_REL_PATH);
  let parsed;
  try {
    if (!fs.existsSync(filePath)) return null;
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_err) {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  if (parsed.auditOptOut !== true) return null;
  if (typeof parsed.reason !== 'string' || parsed.reason.trim().length === 0) return null;
  return parsed;
}

// ── Distillation — grounded extraction, never confabulated ─────────────────

// Structural cues that mark a plan line as an accountability-worthy human
// decision point (approve/reject/edit a record with a before/after state).
// This is a STRUCTURAL grep over the plan's own text — it extracts what the
// plan says, it does not invent a domain-specific action.
// Note: bare noun 'approval' is intentionally excluded — the approve[sd]?
// branch already covers the decision verb, and keeping the action set
// verb-consistent avoids emitting action:'approval' alongside 'approve'/
// 'approved' for the same decision (code-review nit).
const DECISION_VERB_RE = /\b(approve[sd]?|reject[sd]?|edit(?:ed|s)?|revis(?:e|ed|es)|review(?:ed|s)?|impersonat(?:e|ed|es|ion)|refund(?:ed|s)?|delet(?:e|ed|es)|role[- ]?chang(?:e|ed|es)|export(?:ed|s)?)\b/i;

// Lines that look like a markdown heading or list item naming a step.
const PLAN_LINE_RE = /^\s*(?:[-*+]\s+|#{1,6}\s+|\d+[.)]\s+)(.*\S)\s*$/;

/**
 * Extracts a target noun phrase near the matched verb — best-effort, purely
 * structural (adjacent capitalized/quoted token), never a fabricated value.
 * Falls back to the generic 'record' target only when no more specific noun
 * is structurally recoverable from the line itself.
 */
function _extractTarget(line) {
  const quoted = line.match(/"([^"]+)"|'([^']+)'|`([^`]+)`/);
  if (quoted) return quoted[1] || quoted[2] || quoted[3];
  const capitalized = line.match(/\b([A-Z][a-zA-Z]*(?:\s[A-Z][a-zA-Z]*)*)\b/);
  if (capitalized) return capitalized[1];
  return 'record';
}

/**
 * distillAuditActions(planPath) -> { actions: Array<{ action, target, source }> }
 *
 * Reads the project's own plan file and extracts accountability-worthy
 * actions GROUNDED in the plan's actual text (source = the exact matched
 * line, for grep-traceability back to the plan). Returns an EMPTY array
 * (never an error, never a confabulated placeholder) when the plan contains
 * no accountability-worthy actions — the empty-input pole is a legitimate,
 * non-error outcome.
 */
function distillAuditActions(planPath) {
  if (!fs.existsSync(planPath)) {
    throw new Error('distillAuditActions: plan file not found: ' + planPath);
  }
  const text = fs.readFileSync(planPath, 'utf8');
  const lines = text.split(/\r?\n/);

  const actions = [];
  for (const rawLine of lines) {
    const lineMatch = rawLine.match(PLAN_LINE_RE);
    const candidate = lineMatch ? lineMatch[1] : rawLine;
    if (!candidate || !DECISION_VERB_RE.test(candidate)) continue;

    const verbMatch = candidate.match(DECISION_VERB_RE);
    const action = verbMatch[1].toLowerCase();
    const target = _extractTarget(candidate);

    actions.push({
      action,
      target,
      source: candidate.trim(),
    });
  }

  return { actions };
}

module.exports = {
  distillAuditActions,
  writeOptOut,
  readOptOut,
  OPTOUT_REL_PATH,
  // Test surface:
  _extractTarget,
  DECISION_VERB_RE,
};

// ── CLI ──────────────────────────────────────────────────────────────────

function _parseArgv(argv) {
  const out = { cmd: null, planPath: null, projectDir: '.', reason: null };
  out.cmd = argv[0] || null;
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--plan') out.planPath = argv[++i];
    else if (a === '--project') out.projectDir = argv[++i];
    else if (a === '--reason') out.reason = argv[++i];
  }
  return out;
}

if (require.main === module) {
  const args = _parseArgv(process.argv.slice(2));
  if (args.cmd === 'distill') {
    const result = distillAuditActions(args.planPath);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else if (args.cmd === 'opt-out') {
    const record = writeOptOut(args.projectDir, args.reason);
    process.stdout.write(JSON.stringify(record, null, 2) + '\n');
  } else {
    process.stderr.write('Usage: gsd-t-audit-distill.cjs distill --plan <path> | opt-out --project <dir> --reason <text>\n');
    process.exit(1);
  }
}
