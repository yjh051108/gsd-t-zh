#!/usr/bin/env node
'use strict';

/**
 * GSD-T Logging Envelope Check (M100 D3)
 *
 * Standalone STRUCTURAL predicate enforcing BOTH the trace envelope and the
 * audit envelope over PER-PROJECT-VARYING schemas — never hardcoding a
 * category/action value.
 *
 * Contract: .gsd-t/contracts/logging-verify-gate-contract.md v1.0.0 DRAFT.
 * Consumed contracts: trace-logging-contract.md, audit-logging-contract.md.
 *
 * Exports (per contract §"The predicate: what d3 produces"):
 *   checkEnvelope(record, { stream: "trace" | "audit" }) -> { ok, failures }
 *   checkLoggingEnvelopes({ projectDir }) -> { ok, failures }
 *
 * Hard rules:
 *   - STRUCTURAL ONLY: parse shape as shape, never text.includes(category/action).
 *     A novel category/action value MUST PASS.
 *   - Presence vs. null are TWO SEPARATE checks — never truthiness. A required
 *     field may be PRESENT with value `null` (legal) vs. the key ABSENT (fail).
 *   - No-collapse keys on the TOP-LEVEL marker set of the record, NEVER a
 *     key-name scan of nested `context`/`data` payloads.
 *   - FAIL-CLOSED: any failure blocks. Never warn-and-proceed.
 */

const fs = require('fs');
const path = require('path');

// ── Field definitions (structural — no hardcoded values) ───────────────────

const TRACE_REQUIRED_FIELDS = ['ts', 'category', 'decision', 'detail'];
const AUDIT_REQUIRED_FIELDS = ['ts', 'actor', 'action', 'target', 'before', 'after', 'context'];

// Fields whose TYPE check accepts `null` as a legal value (presence still required).
const NULLABLE_FIELDS = new Set(['decision', 'before', 'after']);

// Top-level marker sets used by the no-collapse boundary (per contract §No-collapse detector).
const TRACE_MARKERS = ['category', 'decision', 'detail'];
const AUDIT_MARKERS = ['before', 'after', 'actor', 'action'];

// ── Type checking ────────────────────────────────────────────────────────────

function _hasKey(record, key) {
  return record != null && typeof record === 'object' && Object.prototype.hasOwnProperty.call(record, key);
}

function _typeOk(field, value) {
  switch (field) {
    case 'ts':
    case 'category':
    case 'detail':
    case 'actor':
    case 'action':
    case 'target':
      return typeof value === 'string';
    case 'decision':
      // boolean | null — presence checked separately.
      return value === null || typeof value === 'boolean';
    case 'before':
    case 'after':
      // Record<string, unknown> | null — presence checked separately.
      return value === null || (typeof value === 'object' && !Array.isArray(value));
    case 'context':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    // Optional trace fields:
    case 'key':
      return typeof value === 'string';
    case 'status':
      return typeof value === 'number';
    case 'data':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    default:
      return true;
  }
}

// ── PII matcher — recurses into nested structures, no false positives ──────

// Real-TLD-shaped email, matched as a whole-token substring (word-boundary-safe):
// local@domain.tld (tld letters only, 2+ chars). Uses lookaround so it also matches
// a bare full-string value (whole-string IS a substring of itself). The trailing
// lookahead allows a closing quote/bracket/angle-bracket/brace immediately after
// the TLD (JSON string bodies, `Name <email>` headers, array literals) — without
// these, an email immediately followed by `"`, `>`, `]`, or `}` was NOT matched.
const EMAIL_RE = /(?<![^\s(])[^\s@()]+@[^\s@()]+\.[a-zA-Z]{2,}(?![^\s).,;:!?"'>\]}])/;
// Phone: grouped digit run with separators/parens — NOT a bare long id, and NOT
// an ISO-8601 date/timestamp shape (YYYY-MM-DD[THH:MM:SS...]) which otherwise
// false-positives against generic digit-dash grouping.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]*)?$/;
const PHONE_RE = /(?<!\d)\+?\(?\d{1,4}\)?[\s.-]\d{2,4}[\s.-]\d{2,4}(?:[\s.-]\d{2,4})?(?!\d)/;

function _isPhoneShaped(value) {
  const matches = value.match(new RegExp(PHONE_RE.source, 'g')) || [];
  return matches.some((m) => !ISO_DATE_RE.test(m) && !ISO_DATE_RE.test(value.trim()));
}
// Postal address: leading street number + street-name + common suffix, or a ZIP-shaped tail.
const ADDRESS_RE = /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl)\b/i;
const ZIP_RE = /\b\d{5}(-\d{4})?\b/;

function _isPiiString(value) {
  if (typeof value !== 'string') return false;
  if (ISO_DATE_RE.test(value.trim())) return false; // structural timestamp, not PII
  if (EMAIL_RE.test(value)) return true;
  if (_isPhoneShaped(value)) return true;
  if (ADDRESS_RE.test(value)) return true;
  return false;
}

function _scanForPii(value, pathParts, hits, depth) {
  if (depth > 12) return; // defensive recursion cap, not a real-world limit
  if (value == null) return;
  if (typeof value === 'string') {
    if (_isPiiString(value)) hits.push(pathParts.join('.'));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => _scanForPii(v, pathParts.concat(String(i)), hits, depth + 1));
    return;
  }
  if (typeof value === 'object') {
    for (const k of Object.keys(value)) {
      _scanForPii(value[k], pathParts.concat(k), hits, depth + 1);
    }
  }
}

// ── checkEnvelope(record, { stream }) ───────────────────────────────────────

function checkEnvelope(record, opts) {
  opts = opts || {};
  const stream = opts.stream;
  const failures = [];

  if (record == null || typeof record !== 'object' || Array.isArray(record)) {
    return { ok: false, failures: [{ rule: (stream === 'audit' ? 'audit-envelope-structural' : 'trace-envelope-structural'), stream: stream || null, detail: 'record is not an object' }] };
  }

  if (stream !== 'trace' && stream !== 'audit') {
    return { ok: false, failures: [{ rule: 'envelope-structural', stream: stream || null, detail: 'unknown stream: ' + String(stream) }] };
  }

  const requiredFields = stream === 'trace' ? TRACE_REQUIRED_FIELDS : AUDIT_REQUIRED_FIELDS;
  const structuralRule = stream === 'trace' ? 'trace-envelope-structural' : 'audit-envelope-structural';

  for (const field of requiredFields) {
    if (!_hasKey(record, field)) {
      failures.push({ rule: structuralRule, stream, detail: 'missing required field: ' + field });
      continue;
    }
    const value = record[field];
    if (!_typeOk(field, value)) {
      failures.push({ rule: structuralRule, stream, detail: 'wrong type for field: ' + field });
    }
  }

  // Optional-field type checks (only when present).
  if (stream === 'trace') {
    for (const optField of ['key', 'status', 'data']) {
      if (_hasKey(record, optField) && record[optField] != null && !_typeOk(optField, record[optField])) {
        failures.push({ rule: structuralRule, stream, detail: 'wrong type for optional field: ' + optField });
      }
    }
  }

  // PII bar — trace only, recurse into every field including `data`.
  // `ts` is excluded: it is a structural ISO-8601 timestamp (type-checked above),
  // not free-form user content, and its digit-dash grouping otherwise false-positives
  // against the phone matcher.
  if (stream === 'trace') {
    const hits = [];
    for (const field of Object.keys(record)) {
      if (field === 'ts') continue;
      _scanForPii(record[field], [field], hits, 0);
    }
    if (hits.length > 0) {
      failures.push({ rule: 'trace-pii-barred', stream, detail: 'PII-shaped value at: ' + hits.join(', ') });
    }
  }

  // No-collapse — TOP-LEVEL marker set only, never a nested key-name scan.
  const hasTraceMarker = TRACE_MARKERS.some((k) => _hasKey(record, k));
  const hasAuditMarker = AUDIT_MARKERS.some((k) => _hasKey(record, k));
  if (hasTraceMarker && hasAuditMarker) {
    failures.push({ rule: 'no-collapse', stream, detail: 'record carries top-level markers from BOTH trace and audit streams' });
  }

  return { ok: failures.length === 0, failures };
}

// ── Durability + default-rule checks (M100-D3-T2) ───────────────────────────

/**
 * Checks an audit module's declared surface for append-only/immutability.
 * moduleSurface: { exportsUpdate?: boolean, exportsDelete?: boolean, declaresAppendOnly?: boolean }
 */
function _checkAppendOnlyImmutable(moduleSurface) {
  const failures = [];
  if (!moduleSurface || typeof moduleSurface !== 'object') {
    failures.push({ rule: 'audit-append-only-immutable', stream: 'audit', detail: 'no audit module surface discovered' });
    return failures;
  }
  if (moduleSurface.exportsUpdate === true || moduleSurface.exportsDelete === true) {
    failures.push({ rule: 'audit-append-only-immutable', stream: 'audit', detail: 'audit module exposes an update/delete path — not append-only' });
  }
  if (moduleSurface.declaresAppendOnly !== true) {
    failures.push({ rule: 'audit-append-only-immutable', stream: 'audit', detail: 'audit module does not declare append-only/immutability' });
  }
  return failures;
}

/**
 * Checks retention configurability.
 * retentionConfig: { hardcoded?: boolean, configurable?: boolean }
 */
function _checkRetentionConfigurable(retentionConfig) {
  const failures = [];
  if (!retentionConfig || typeof retentionConfig !== 'object' || retentionConfig.configurable !== true || retentionConfig.hardcoded === true) {
    failures.push({ rule: 'audit-retention-configurable', stream: 'audit', detail: 'retention window is hardcoded or not configurable' });
  }
  return failures;
}

/**
 * Validates the opt-out record shape per audit-logging-contract.md §opt-out-record.
 */
function _isValidOptOut(optOutRecord) {
  if (!optOutRecord || typeof optOutRecord !== 'object') return false;
  if (optOutRecord.auditOptOut !== true) return false;
  if (typeof optOutRecord.reason !== 'string' || optOutRecord.reason.trim().length === 0) return false;
  return true;
}

function _checkDefaultExceptOptOut({ hasAuditStore, optOutRecord }) {
  const failures = [];
  if (hasAuditStore) return failures;
  if (_isValidOptOut(optOutRecord)) return failures;
  failures.push({ rule: 'audit-default-except-optout', stream: 'audit', detail: 'no audit store and no valid opt-out record' });
  return failures;
}

/**
 * Validates the TRACE opt-out record shape per trace-logging-contract.md §opt-out-record
 * (M100 correction: the "trace has NO opt-out" rule was too absolute — a stateless CLI /
 * library has no runtime data-flow to trace, so a symmetric opt-out exists for that class).
 */
function _isValidTraceOptOut(rec) {
  if (!rec || typeof rec !== 'object') return false;
  if (rec.traceOptOut !== true) return false;
  if (typeof rec.reason !== 'string' || rec.reason.trim().length === 0) return false;
  return true;
}

// ── §discovery — checkLoggingEnvelopes({ projectDir }) ──────────────────────
//
// Real enumeration per logging-verify-gate-contract.md §discovery. Walks the
// project to locate (i) the trace module/store + records, (ii) the audit
// module/store + records, (iii) .gsd-t/audit-optout.json — then runs every
// discovered record through checkEnvelope. Never returns ok:true vacuously.

const TRACE_MODULE_CANDIDATES = [
  'src/logging/trace.ts',
  'src/logging/trace.js',
  'src/trace/index.ts',
  'src/trace/index.js',
];

const TRACE_STORE_CANDIDATES = [
  '.gsd-t/trace-records.json',
  '.gsd-t/logging/trace-records.json',
];

const AUDIT_MODULE_CANDIDATES = [
  'src/logging/audit-module.ts',
  'src/logging/audit.ts',
  'src/logging/audit.js',
  'src/audit/index.ts',
  'src/audit/index.js',
];

const AUDIT_STORE_CANDIDATES = [
  '.gsd-t/audit-records.json',
  '.gsd-t/logging/audit-records.json',
];

function _readJsonArrayIfExists(absPath) {
  try {
    if (!fs.existsSync(absPath)) return null;
    const raw = fs.readFileSync(absPath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (_err) {
    return null;
  }
}

function _firstExisting(projectDir, candidates) {
  for (const rel of candidates) {
    const abs = path.join(projectDir, rel);
    try {
      if (fs.existsSync(abs)) return abs;
    } catch (_err) { /* ignore */ }
  }
  return null;
}

/**
 * Reads a module's declared surface out of its source text — best-effort,
 * structural signal only (looks for documented export/declaration markers),
 * never a substring scan of business content.
 */
function _readModuleSurface(absModulePath) {
  let text = '';
  try {
    text = fs.readFileSync(absModulePath, 'utf8');
  } catch (_err) {
    return null;
  }
  return {
    declaresAppendOnly: /append-?only/i.test(text) || /immutable/i.test(text),
    exportsUpdate: /export\s+(async\s+)?function\s+update\w*Entry|export\s+const\s+update\w*Entry/i.test(text),
    exportsDelete: /export\s+(async\s+)?function\s+delete\w*Entry|export\s+const\s+delete\w*Entry/i.test(text),
    retentionConfigurable: /retention/i.test(text) && (/process\.env/.test(text) || /config/i.test(text)),
    retentionHardcoded: /retention/i.test(text) && !(/process\.env/.test(text) || /config/i.test(text)),
  };
}

function checkLoggingEnvelopes(opts) {
  opts = opts || {};
  const projectDir = opts.projectDir || '.';
  const failures = [];

  // (i) Trace discovery — default for every project EXCEPT explicit opt-out
  // (M100 correction: stateless CLI/library class has no runtime data-flow to trace,
  // so a symmetric .gsd-t/trace-optout.json opt-out exists, mirroring audit's).
  const traceModulePath = _firstExisting(projectDir, TRACE_MODULE_CANDIDATES);
  const traceStorePath = _firstExisting(projectDir, TRACE_STORE_CANDIDATES);
  const traceRecords = traceStorePath ? _readJsonArrayIfExists(traceStorePath) : null;
  let traceOptOutRecord = null;
  const traceOptOutPath = path.join(projectDir, '.gsd-t', 'trace-optout.json');
  try {
    if (fs.existsSync(traceOptOutPath)) traceOptOutRecord = JSON.parse(fs.readFileSync(traceOptOutPath, 'utf8'));
  } catch (_e) { traceOptOutRecord = null; }

  if (!traceModulePath && !traceStorePath) {
    if (!_isValidTraceOptOut(traceOptOutRecord)) {
      failures.push({ rule: 'trace-default-except-optout', stream: 'trace', detail: 'no trace module or store discoverable and no valid trace opt-out record' });
    }
  } else if (Array.isArray(traceRecords)) {
    for (const rec of traceRecords) {
      const result = checkEnvelope(rec, { stream: 'trace' });
      if (!result.ok) failures.push(...result.failures);
    }
  }
  // else: trace module is present but the store is absent or not a JSON array
  // yet (traceRecords === null) — a fresh project that has scaffolded trace
  // but not yet emitted a record. This is intentionally legal: there is
  // nothing to validate yet, and the module's mere presence already satisfies
  // trace-default-except-optout above.

  // (ii) Audit discovery.
  const auditModulePath = _firstExisting(projectDir, AUDIT_MODULE_CANDIDATES);
  const auditStorePath = _firstExisting(projectDir, AUDIT_STORE_CANDIDATES);
  const auditRecords = auditStorePath ? _readJsonArrayIfExists(auditStorePath) : null;
  const hasAuditStore = !!(auditModulePath || auditStorePath);

  // (iii) Opt-out file.
  let optOutRecord = null;
  const optOutPath = path.join(projectDir, '.gsd-t', 'audit-optout.json');
  try {
    if (fs.existsSync(optOutPath)) {
      optOutRecord = JSON.parse(fs.readFileSync(optOutPath, 'utf8'));
    }
  } catch (_err) {
    optOutRecord = null;
  }

  const defaultOptOutFailures = _checkDefaultExceptOptOut({ hasAuditStore, optOutRecord });
  failures.push(...defaultOptOutFailures);

  if (hasAuditStore) {
    if (Array.isArray(auditRecords)) {
      for (const rec of auditRecords) {
        const result = checkEnvelope(rec, { stream: 'audit' });
        if (!result.ok) failures.push(...result.failures);
      }
    }

    if (auditModulePath) {
      const surface = _readModuleSurface(auditModulePath);
      failures.push(..._checkAppendOnlyImmutable({
        exportsUpdate: surface ? surface.exportsUpdate : false,
        exportsDelete: surface ? surface.exportsDelete : false,
        declaresAppendOnly: surface ? surface.declaresAppendOnly : false,
      }));
      failures.push(..._checkRetentionConfigurable({
        hardcoded: surface ? surface.retentionHardcoded : true,
        configurable: surface ? surface.retentionConfigurable : false,
      }));
    } else {
      // Audit store present but no module surface to inspect declared durability rules.
      failures.push({ rule: 'audit-append-only-immutable', stream: 'audit', detail: 'no audit module surface discoverable to verify append-only declaration' });
      failures.push({ rule: 'audit-retention-configurable', stream: 'audit', detail: 'no audit module surface discoverable to verify retention configurability' });
    }
  }

  return { ok: failures.length === 0, failures };
}

module.exports = {
  checkEnvelope,
  checkLoggingEnvelopes,
  // Test surface (not part of the public contract):
  _hasKey,
  _typeOk,
  _isPiiString,
  _scanForPii,
  _checkAppendOnlyImmutable,
  _checkRetentionConfigurable,
  _isValidOptOut,
  _checkDefaultExceptOptOut,
  _readModuleSurface,
};

// ── CLI (invoked by the verify gate as a Track 2 worker) ────────────────────

function _parseArgv(argv) {
  const out = { projectDir: '.' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project') out.projectDir = argv[++i] || '.';
  }
  return out;
}

if (require.main === module) {
  const args = _parseArgv(process.argv.slice(2));
  const result = checkLoggingEnvelopes({ projectDir: args.projectDir });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(result.ok ? 0 : 1);
}
