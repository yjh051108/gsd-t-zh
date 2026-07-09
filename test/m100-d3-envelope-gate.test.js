'use strict';

/**
 * M100 D3 — Logging Envelope Gate tests.
 *
 * Killing-test battery per .gsd-t/domains/d3-verify-envelope-gate/tasks.md
 * (M100-D3-T1, T2, T3) and .gsd-t/contracts/logging-verify-gate-contract.md.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  checkEnvelope,
  checkLoggingEnvelopes,
} = require('../bin/gsd-t-logging-envelope-check.cjs');

// ── Fixtures ─────────────────────────────────────────────────────────────

function validTrace(overrides) {
  return Object.assign({
    ts: '2026-07-08T12:00:00.000Z',
    category: 'AudioChunk',
    decision: true,
    detail: 'chunk processed',
  }, overrides);
}

function validAudit(overrides) {
  return Object.assign({
    ts: '2026-07-08T12:00:00.000Z',
    actor: 'user-42',
    action: 'record.update',
    target: 'invoice-99',
    before: { status: 'draft' },
    after: { status: 'sent' },
    context: {},
  }, overrides);
}

// ── (a)/(b) valid envelopes PASS ────────────────────────────────────────

test('valid trace envelope PASSES', () => {
  const r = checkEnvelope(validTrace(), { stream: 'trace' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.failures, []);
});

test('valid audit envelope PASSES', () => {
  const r = checkEnvelope(validAudit(), { stream: 'audit' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.failures, []);
});

// ── (c) missing-field FAILS ─────────────────────────────────────────────

test('trace missing required field FAILS', () => {
  const rec = validTrace();
  delete rec.detail;
  const r = checkEnvelope(rec, { stream: 'trace' });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.rule === 'trace-envelope-structural'));
});

test('audit missing required field FAILS', () => {
  const rec = validAudit();
  delete rec.target;
  const r = checkEnvelope(rec, { stream: 'audit' });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.rule === 'audit-envelope-structural'));
});

// ── (d) wrong-type FAILS ────────────────────────────────────────────────

test('trace wrong-type field FAILS', () => {
  const rec = validTrace({ category: 12345 });
  const r = checkEnvelope(rec, { stream: 'trace' });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.rule === 'trace-envelope-structural'));
});

test('audit wrong-type field FAILS', () => {
  const rec = validAudit({ context: 'not-an-object' });
  const r = checkEnvelope(rec, { stream: 'audit' });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.rule === 'audit-envelope-structural'));
});

// ── (e) PII-in-trace FAILS ───────────────────────────────────────────────

test('PII email in trace top-level field FAILS', () => {
  const rec = validTrace({ detail: 'contact john@example.com about this' });
  const r = checkEnvelope(rec, { stream: 'trace' });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.rule === 'trace-pii-barred'));
});

test('PII email nested in trace data FAILS', () => {
  const rec = validTrace({ data: { user: { email: 'jane@example.com' } } });
  const r = checkEnvelope(rec, { stream: 'trace' });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.rule === 'trace-pii-barred'));
});

// ── (e-quote/bracket) delimiter-adjacent email FAILS (Red Team FINDING 2) ───
// EMAIL_RE's trailing lookahead previously failed to match an email immediately
// before `"`, `>`, `]`, or `}` — letting these THROUGH the gate. Each must FAIL.

test('PII email immediately before a closing quote (JSON body string) FAILS', () => {
  const rec = validTrace({ data: { body: '{"buyer":{"email":"jane@buyer.com"}}' } });
  const r = checkEnvelope(rec, { stream: 'trace' });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.rule === 'trace-pii-barred'));
});

test('PII email immediately before a closing angle bracket (Name <email>) FAILS', () => {
  const rec = validTrace({ data: { from: 'Jane Doe <jane@buyer.com>' } });
  const r = checkEnvelope(rec, { stream: 'trace' });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.rule === 'trace-pii-barred'));
});

test('PII emails immediately before closing bracket/quote (JSON array literal) FAILS', () => {
  const rec = validTrace({ data: { recipients: '["a@buyer.com","b@buyer.com"]' } });
  const r = checkEnvelope(rec, { stream: 'trace' });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.rule === 'trace-pii-barred'));
});

// ── (f) NOVEL category/action PASSES (structural, never hardcoded) ─────

test('novel trace category PASSES (structural, not hardcoded)', () => {
  const r = checkEnvelope(validTrace({ category: 'SomeBrandNewCategoryNeverSeenBefore' }), { stream: 'trace' });
  assert.equal(r.ok, true);
});

test('novel audit action PASSES (structural, not hardcoded)', () => {
  const r = checkEnvelope(validAudit({ action: 'a-completely-novel-action-xyz' }), { stream: 'audit' });
  assert.equal(r.ok, true);
});

// ── (g) COLLAPSED single-stream record FAILS (no-collapse) ─────────────

test('collapsed record (trace decision co-present with audit before/after) FAILS', () => {
  const rec = {
    ts: '2026-07-08T12:00:00.000Z',
    category: 'AudioChunk',
    decision: true,
    detail: 'x',
    before: { a: 1 },
    after: { a: 2 },
  };
  const r = checkEnvelope(rec, { stream: 'trace' });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.rule === 'no-collapse'));
});

// ── (g1)-(g3) no-collapse killing sub-cases (pre-mortem FINDING 1, CRITICAL) ─

test('g1: valid trace with decision:null and no before/after PASSES no-collapse', () => {
  const rec = validTrace({ decision: null });
  const r = checkEnvelope(rec, { stream: 'trace' });
  assert.equal(r.ok, true);
  assert.ok(!r.failures.some((f) => f.rule === 'no-collapse'));
});

test('g2: valid audit with nested context.decision + context.before PASSES no-collapse (not a nested key-name scan)', () => {
  const rec = validAudit({ context: { decision: 'some-nested-value', before: 'another-nested-value' } });
  const r = checkEnvelope(rec, { stream: 'audit' });
  assert.equal(r.ok, true);
  assert.ok(!r.failures.some((f) => f.rule === 'no-collapse'));
});

test('g3: genuinely collapsed record (top-level category+decision AND top-level before/after) FAILS', () => {
  const rec = {
    ts: '2026-07-08T12:00:00.000Z',
    category: 'AudioChunk',
    decision: true,
    before: { a: 1 },
    after: { a: 2 },
  };
  const r = checkEnvelope(rec, { stream: 'trace' });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.rule === 'no-collapse'));
});

// ── (g4)-(g5) partial-set collapse killing sub-cases (pre-mortem FINDING 2, HIGH) ─

test('g4: top-level category+decision AND actor+action (no before/after) FAILS no-collapse', () => {
  const rec = {
    ts: '2026-07-08T12:00:00.000Z',
    category: 'AudioChunk',
    decision: true,
    detail: 'x',
    actor: 'user-1',
    action: 'do-thing',
  };
  const r = checkEnvelope(rec, { stream: 'trace' });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.rule === 'no-collapse'));
});

test('g5: top-level decision+action (one marker from each stream) FAILS no-collapse', () => {
  const rec = {
    ts: '2026-07-08T12:00:00.000Z',
    decision: true,
    action: 'do-thing',
  };
  const r = checkEnvelope(rec, { stream: 'trace' });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.rule === 'no-collapse'));
});

// ── (h1)-(h5) null-vs-absent killing sub-cases (pre-mortem FINDING 2, CRITICAL) ─

test('h1: audit before:null after:{...} (create) PASSES', () => {
  const rec = validAudit({ before: null, after: { status: 'new' } });
  const r = checkEnvelope(rec, { stream: 'audit' });
  assert.equal(r.ok, true);
});

test('h2: audit before:{...} after:null (delete) PASSES', () => {
  const rec = validAudit({ before: { status: 'old' }, after: null });
  const r = checkEnvelope(rec, { stream: 'audit' });
  assert.equal(r.ok, true);
});

test('h3: audit before KEY omitted entirely FAILS', () => {
  const rec = validAudit();
  delete rec.before;
  const r = checkEnvelope(rec, { stream: 'audit' });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.rule === 'audit-envelope-structural' && f.detail.includes('before')));
});

test('h4: trace decision:null (key present, value null) PASSES', () => {
  const rec = validTrace({ decision: null });
  const r = checkEnvelope(rec, { stream: 'trace' });
  assert.equal(r.ok, true);
});

test('h5: trace decision KEY omitted entirely FAILS', () => {
  const rec = validTrace();
  delete rec.decision;
  const r = checkEnvelope(rec, { stream: 'trace' });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.rule === 'trace-envelope-structural' && f.detail.includes('decision')));
});

test('predicate never uses truthiness for presence — decision:false PASSES (not "absent")', () => {
  const rec = validTrace({ decision: false });
  const r = checkEnvelope(rec, { stream: 'trace' });
  assert.equal(r.ok, true);
});

// ── Nested-PII recursion killing sub-cases (pre-mortem FINDING 6, MEDIUM) ───

test('nested email at data.a.b.email is REJECTED', () => {
  const rec = validTrace({ data: { a: { b: { email: 'deep@example.com' } } } });
  const r = checkEnvelope(rec, { stream: 'trace' });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.rule === 'trace-pii-barred'));
});

test('legit 10+ digit numeric request-id value PASSES (no false positive)', () => {
  const rec = validTrace({ data: { requestId: '9876543210123' } });
  const r = checkEnvelope(rec, { stream: 'trace' });
  assert.equal(r.ok, true);
});

test('internal id string containing "@" but not a real email PASSES (no false positive)', () => {
  const rec = validTrace({ data: { internalId: 'seller@internal-shard-9' } });
  const r = checkEnvelope(rec, { stream: 'trace' });
  assert.equal(r.ok, true);
});

test('phone-shaped value nested at depth >= 2 is REJECTED', () => {
  const rec = validTrace({ data: { user: { contact: { phone: '555-123-4567' } } } });
  const r = checkEnvelope(rec, { stream: 'trace' });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.rule === 'trace-pii-barred'));
});

test('postal-address-shaped value nested at depth >= 2 is REJECTED', () => {
  const rec = validTrace({ data: { user: { home: { address: '123 Main Street, Springfield 90210' } } } });
  const r = checkEnvelope(rec, { stream: 'trace' });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.rule === 'trace-pii-barred'));
});

// ── M100-D3-T2: Durability + default rules ──────────────────────────────

const {
  _checkAppendOnlyImmutable,
  _checkRetentionConfigurable,
  _checkDefaultExceptOptOut,
  _isValidOptOut,
} = require('../bin/gsd-t-logging-envelope-check.cjs');

test('audit-append-only-immutable: module declaring append-only PASSES', () => {
  const failures = _checkAppendOnlyImmutable({ exportsUpdate: false, exportsDelete: false, declaresAppendOnly: true });
  assert.deepEqual(failures, []);
});

test('audit-append-only-immutable: module exposing update/delete path FAILS', () => {
  const failures = _checkAppendOnlyImmutable({ exportsUpdate: true, exportsDelete: false, declaresAppendOnly: true });
  assert.ok(failures.some((f) => f.rule === 'audit-append-only-immutable'));
});

test('audit-retention-configurable: hardcoded retention FAILS', () => {
  const failures = _checkRetentionConfigurable({ hardcoded: true, configurable: false });
  assert.ok(failures.some((f) => f.rule === 'audit-retention-configurable'));
});

test('audit-retention-configurable: configurable retention PASSES', () => {
  const failures = _checkRetentionConfigurable({ hardcoded: false, configurable: true });
  assert.deepEqual(failures, []);
});

test('audit-default-except-optout: no audit + no opt-out FAILS', () => {
  const failures = _checkDefaultExceptOptOut({ hasAuditStore: false, optOutRecord: null });
  assert.ok(failures.some((f) => f.rule === 'audit-default-except-optout'));
});

test('audit-default-except-optout: valid opt-out record PASSES', () => {
  const failures = _checkDefaultExceptOptOut({ hasAuditStore: false, optOutRecord: { auditOptOut: true, reason: 'trace only, no admin-facing surface' } });
  assert.deepEqual(failures, []);
});

test('opt-out record with auditOptOut:false is NOT valid (treated as opted-in)', () => {
  assert.equal(_isValidOptOut({ auditOptOut: false, reason: 'x' }), false);
});

test('opt-out record with empty reason is NOT valid', () => {
  assert.equal(_isValidOptOut({ auditOptOut: true, reason: '' }), false);
});

// ── M100-D3-T3: checkLoggingEnvelopes({projectDir}) discovery ──────────

function mkTmpProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsdt-m100-d3-'));
  fs.mkdirSync(path.join(dir, '.gsd-t'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src', 'logging'), { recursive: true });
  return dir;
}

test('checkEnvelope export is a function with documented arity 2', () => {
  assert.equal(typeof checkEnvelope, 'function');
  assert.equal(checkEnvelope.length, 2);
});

test('discovery: fixture with conformant trace + audit + no opt-out PASSES', () => {
  const dir = mkTmpProject();
  try {
    fs.writeFileSync(
      path.join(dir, 'src', 'logging', 'audit-module.ts'),
      'export function writeAuditEntry() {}\n// append-only, immutable by design\n// retention: process.env.AUDIT_RETENTION_DAYS\n'
    );
    fs.writeFileSync(path.join(dir, 'src', 'logging', 'trace.ts'), 'export function trace() {}\n');
    fs.writeFileSync(path.join(dir, '.gsd-t', 'trace-records.json'), JSON.stringify([validTrace()]));
    fs.writeFileSync(path.join(dir, '.gsd-t', 'audit-records.json'), JSON.stringify([validAudit()]));

    const r = checkLoggingEnvelopes({ projectDir: dir });
    assert.equal(r.ok, true, 'expected PASS, got failures: ' + JSON.stringify(r.failures));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('discovery: SAME fixture with one planted broken trace record FAILS', () => {
  const dir = mkTmpProject();
  try {
    fs.writeFileSync(
      path.join(dir, 'src', 'logging', 'audit-module.ts'),
      'export function writeAuditEntry() {}\n// append-only, immutable by design\n// retention: process.env.AUDIT_RETENTION_DAYS\n'
    );
    fs.writeFileSync(path.join(dir, 'src', 'logging', 'trace.ts'), 'export function trace() {}\n');
    const brokenTrace = validTrace();
    delete brokenTrace.category; // planted broken record
    fs.writeFileSync(path.join(dir, '.gsd-t', 'trace-records.json'), JSON.stringify([validTrace(), brokenTrace]));
    fs.writeFileSync(path.join(dir, '.gsd-t', 'audit-records.json'), JSON.stringify([validAudit()]));

    const r = checkLoggingEnvelopes({ projectDir: dir });
    assert.equal(r.ok, false, 'expected FAIL — the discovery mechanism must actually validate discovered records');
    assert.ok(r.failures.some((f) => f.rule === 'trace-envelope-structural'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('discovery: fixture with NO logging artifacts and NO opt-out FAILS (never vacuous PASS)', () => {
  const dir = mkTmpProject();
  try {
    const r = checkLoggingEnvelopes({ projectDir: dir });
    assert.equal(r.ok, false);
    // M100 correction: no trace module + no trace opt-out → trace-default-except-optout FAIL
    // (was trace-envelope-structural before the symmetric trace opt-out was added).
    assert.ok(r.failures.some((f) => f.rule === 'trace-default-except-optout'));
    assert.ok(r.failures.some((f) => f.rule === 'audit-default-except-optout'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('discovery: valid TRACE opt-out exempts the trace-module requirement (M100 correction)', () => {
  const dir = mkTmpProject();
  try {
    fs.mkdirSync(path.join(dir, '.gsd-t'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.gsd-t', 'trace-optout.json'), JSON.stringify({ traceOptOut: true, reason: 'stateless CLI, no runtime data-flow to trace' }));
    fs.writeFileSync(path.join(dir, '.gsd-t', 'audit-optout.json'), JSON.stringify({ auditOptOut: true, reason: 'no admin/client accountability surface' }));
    const r = checkLoggingEnvelopes({ projectDir: dir });
    // both streams opted out with valid records → PASS, no trace/audit failures
    assert.ok(!r.failures.some((f) => f.rule === 'trace-default-except-optout'), 'valid trace opt-out must exempt trace');
    assert.ok(!r.failures.some((f) => f.rule === 'audit-default-except-optout'), 'valid audit opt-out must exempt audit');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('discovery: valid opt-out exempts audit-store requirement but trace is unaffected', () => {
  const dir = mkTmpProject();
  try {
    fs.writeFileSync(path.join(dir, 'src', 'logging', 'trace.ts'), 'export function trace() {}\n');
    fs.writeFileSync(path.join(dir, '.gsd-t', 'trace-records.json'), JSON.stringify([validTrace()]));
    fs.writeFileSync(path.join(dir, '.gsd-t', 'audit-optout.json'), JSON.stringify({ auditOptOut: true, reason: 'trace only, no admin-facing accountability surface' }));

    const r = checkLoggingEnvelopes({ projectDir: dir });
    assert.equal(r.ok, true, 'expected PASS with valid opt-out, got: ' + JSON.stringify(r.failures));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── Registration into the verify gate (FAIL-CLOSED, one line) ──────────

test('verify-gate.cjs registers exactly ONE line referencing gsd-t-logging-envelope-check.cjs', () => {
  const gateSrc = fs.readFileSync(path.join(__dirname, '..', 'bin', 'gsd-t-verify-gate.cjs'), 'utf8');
  const matches = gateSrc.split('\n').filter((line) => line.includes('gsd-t-logging-envelope-check.cjs'));
  assert.equal(matches.length, 1, 'expected exactly one registration line, found: ' + matches.length);
});

test('verify-gate Track 2 plan includes the logging-envelope worker (FAIL-CLOSED, not warn-and-proceed)', () => {
  const { _detectDefaultTrack2 } = require('../bin/gsd-t-verify-gate.cjs');
  const dir = mkTmpProject();
  try {
    const notes = [];
    const plan = _detectDefaultTrack2(dir, notes);
    const worker = plan.find((w) => w.id === 'logging-envelope');
    assert.ok(worker, 'expected a logging-envelope worker in the Track 2 plan');
    assert.ok(
      (Array.isArray(worker.args) && worker.args.some((a) => String(a).includes('gsd-t-logging-envelope-check.cjs')))
      || String(worker.cmd).includes('gsd-t-logging-envelope-check.cjs')
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI exit code is non-zero on a failing project (FAIL-CLOSED, never warn-and-proceed)', () => {
  const { execFileSync } = require('child_process');
  const dir = mkTmpProject();
  try {
    let threw = false;
    let status = 0;
    try {
      execFileSync('node', [path.join(__dirname, '..', 'bin', 'gsd-t-logging-envelope-check.cjs'), '--project', dir], { stdio: 'pipe' });
    } catch (err) {
      threw = true;
      status = err.status;
    }
    assert.equal(threw, true);
    assert.notEqual(status, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI exit code is 0 on a passing project', () => {
  const { execFileSync } = require('child_process');
  const dir = mkTmpProject();
  try {
    fs.writeFileSync(path.join(dir, 'src', 'logging', 'trace.ts'), 'export function trace() {}\n');
    fs.writeFileSync(path.join(dir, '.gsd-t', 'trace-records.json'), JSON.stringify([validTrace()]));
    fs.writeFileSync(path.join(dir, '.gsd-t', 'audit-optout.json'), JSON.stringify({ auditOptOut: true, reason: 'trace only' }));
    const out = execFileSync('node', [path.join(__dirname, '..', 'bin', 'gsd-t-logging-envelope-check.cjs'), '--project', dir], { stdio: 'pipe' });
    const parsed = JSON.parse(out.toString('utf8'));
    assert.equal(parsed.ok, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
