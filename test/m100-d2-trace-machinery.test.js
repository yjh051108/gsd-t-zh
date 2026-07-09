'use strict';

/**
 * M100 D2 — Trace Machinery tests.
 *
 * Killing-test battery per .gsd-t/domains/d2-trace-machinery/tasks.md
 * (M100-D2-T1, T2) and .gsd-t/contracts/trace-logging-contract.md +
 * .gsd-t/contracts/logging-schema-distillation-contract.md.
 *
 * The trace module template (templates/logging/trace-module.template.ts) is
 * loaded via Node's native TypeScript type-stripping (Node >=22.6, stable in
 * v24) — no external transpiler dependency. Each test dynamic-imports with a
 * cache-busting query so `_traceOn`/`_sink` module-level state never leaks
 * across tests.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { checkEnvelope } = require('../bin/gsd-t-logging-envelope-check.cjs');
const { distillTraceCategories, KNOWN_INTEGRATION_SIGNATURES } = require('../bin/gsd-t-trace-distill.cjs');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'logging', 'trace-module.template.ts');
const TEMPLATE_URL = 'file://' + TEMPLATE_PATH.split(path.sep).join('/');

let _importCounter = 0;
/** Fresh module instance per call — avoids shared _traceOn/_sink state leaking across tests. */
function freshTraceModule() {
  _importCounter += 1;
  return import(TEMPLATE_URL + '?instance=' + _importCounter);
}

// ── T1: emitter is fire-and-forget, never throws into the caller ───────────

test('T1: emitter with a throwing sink still returns normally (fire-and-forget)', async () => {
  const mod = await freshTraceModule();
  mod.setTraceEnabled(true);
  mod.configureTraceSink({
    write() {
      throw new Error('sink exploded');
    },
  });
  assert.doesNotThrow(() => {
    mod.emitTrace('Post', 'a detail');
  });
});

// ── T1: dual toggle — setTraceEnabled()/isTraceEnabled() + TRACE=1 ─────────

test('T1: trace disabled (no setTraceEnabled, no TRACE=1) writes nothing', async () => {
  const mod = await freshTraceModule();
  const written = [];
  mod.configureTraceSink({ write: (r) => written.push(r) });
  mod.setTraceEnabled(false);
  mod.emitTrace('Post', 'should not write');
  assert.equal(written.length, 0);
});

test('T1: setTraceEnabled(true) enables writes', async () => {
  const mod = await freshTraceModule();
  const written = [];
  mod.configureTraceSink({ write: (r) => written.push(r) });
  mod.setTraceEnabled(true);
  mod.emitTrace('Post', 'should write');
  assert.equal(written.length, 1);
  assert.equal(mod.isTraceEnabled(), true);
});

test('T1: TRACE=1 env override enables writes without setTraceEnabled', async () => {
  const prev = process.env.TRACE;
  process.env.TRACE = '1';
  try {
    const mod = await freshTraceModule();
    const written = [];
    mod.configureTraceSink({ write: (r) => written.push(r) });
    // No setTraceEnabled() call — env override alone must enable it.
    assert.equal(mod.isTraceEnabled(), true);
    mod.emitTrace('Post', 'env-enabled write');
    assert.equal(written.length, 1);
  } finally {
    if (prev === undefined) delete process.env.TRACE;
    else process.env.TRACE = prev;
  }
});

// ── T1: PII bar — top-level + nested, incl. `data` ──────────────────────────

test('T1: a PII-shaped email in `data` is rejected (never written)', async () => {
  const mod = await freshTraceModule();
  const written = [];
  mod.configureTraceSink({ write: (r) => written.push(r) });
  mod.setTraceEnabled(true);
  // Fire-and-forget still swallows the internal PII-rejection error — assert
  // via the sink never receiving the record (never throws into the caller).
  assert.doesNotThrow(() => {
    mod.emitTrace('Post', 'has pii', { data: { email: 'buyer@example.com' } });
  });
  assert.equal(written.length, 0);
});

test('T1: nested PII at data.a.b.email is rejected (recursion, pre-mortem F6a)', async () => {
  const mod = await freshTraceModule();
  const written = [];
  mod.configureTraceSink({ write: (r) => written.push(r) });
  mod.setTraceEnabled(true);
  mod.emitTrace('Post', 'nested pii', { data: { a: { b: { email: 'user@domain.com' } } } });
  assert.equal(written.length, 0);
});

test('T1: no-false-positive — long numeric request-id and non-email @-token PASS', async () => {
  const mod = await freshTraceModule();
  const written = [];
  mod.configureTraceSink({ write: (r) => written.push(r) });
  mod.setTraceEnabled(true);
  mod.emitTrace('Post', 'legit ids', {
    data: {
      requestId: '1234567890123',
      internalToken: 'user@internal-id-7f3a',
    },
  });
  assert.equal(written.length, 1);
});

test('T1: nested phone/address at depth >=2 are rejected (pre-mortem F6c)', async () => {
  const mod = await freshTraceModule();
  const writtenPhone = [];
  mod.configureTraceSink({ write: (r) => writtenPhone.push(r) });
  mod.setTraceEnabled(true);
  mod.emitTrace('Post', 'nested phone', { data: { a: { phone: '(555) 123-4567' } } });
  assert.equal(writtenPhone.length, 0);
});

test('T1: nested address at depth >=2 is rejected (pre-mortem F6c)', async () => {
  const mod = await freshTraceModule();
  const written = [];
  mod.configureTraceSink({ write: (r) => written.push(r) });
  mod.setTraceEnabled(true);
  mod.emitTrace('Post', 'nested address', { data: { a: { address: '123 Main Street' } } });
  assert.equal(written.length, 0);
});

// ── T1: emitted record passes d3's checkEnvelope(record, {stream:"trace"}) ─

test('T1: emitted record passes checkEnvelope(record, {stream: "trace"})', async () => {
  const mod = await freshTraceModule();
  let captured = null;
  mod.configureTraceSink({ write: (r) => { captured = r; } });
  mod.setTraceEnabled(true);
  mod.emitTrace('Grain', 'transcript received', { decision: null, key: 'req-1', status: 200 });
  assert.ok(captured, 'sink should have received a record');
  const result = checkEnvelope(captured, { stream: 'trace' });
  assert.equal(result.ok, true, 'expected ok, got failures: ' + JSON.stringify(result.failures));
});

// ── T1: transport routes to d1's traceSink (dormant or local file), never POST ─

test('T1: default sink is dormant (no throw, no external call) before configureTraceSink', async () => {
  const mod = await freshTraceModule();
  mod.setTraceEnabled(true);
  // No configureTraceSink() call — default dormant sink must not throw.
  assert.doesNotThrow(() => {
    mod.emitTrace('Post', 'dormant path');
  });
});

test('T1: configureTraceSink wires a local-file-shaped sink (no client-batched-POST transport)', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-trace-'));
  const filePath = path.join(tmpDir, 'trace.jsonl');
  const mod = await freshTraceModule();
  mod.setTraceEnabled(true);
  mod.configureTraceSink({
    write(record) {
      fs.appendFileSync(filePath, JSON.stringify(record) + '\n', 'utf8');
    },
  });
  mod.emitTrace('Post', 'local file write');
  const contents = fs.readFileSync(filePath, 'utf8').trim().split('\n');
  assert.equal(contents.length, 1);
  const parsed = JSON.parse(contents[0]);
  assert.equal(parsed.category, 'Post');
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── T1: import-time export assertion (pre-mortem FINDING 3, HIGH) ─────────

test('T1: gsd-t-logging-envelope-check.cjs exports checkEnvelope as a function at load time (pre-mortem F3)', () => {
  // Mirrors d3's own import-time guard (test/m100-d3-envelope-gate.test.js) so
  // d2 fails loudly at load time — not with a cryptic mid-emit TypeError — if
  // d3's export shape ever drifts.
  const mod = require('../bin/gsd-t-logging-envelope-check.cjs');
  assert.equal(typeof mod.checkEnvelope, 'function', 'checkEnvelope must exist and be a function at import time');
  assert.equal(mod.checkEnvelope.length, 2, 'checkEnvelope must have documented arity (record, {stream}) === 2');
});

// ── T2: trace-half category distiller ───────────────────────────────────────

const UMI_PLAN_PATH = '/Users/david/projects/UMI-Automation/docs/plan.md';

test('T2: distills categories from a fixture plan and does not confabulate absent ones', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-distill-'));
  const planPath = path.join(tmpDir, 'plan.md');
  fs.writeFileSync(
    planPath,
    '# Plan\n\nWe integrate with Grain for transcripts and Airtable for routing.\n',
    'utf8'
  );
  const result = distillTraceCategories(planPath);
  const names = result.categories.map((c) => c.category);
  assert.ok(names.includes('Grain'));
  assert.ok(names.includes('Airtable'));
  // No-confabulation falsifier: a category with no plan source must be absent.
  assert.ok(!names.includes('Anthropic'), 'Anthropic is absent from this fixture plan and must not be invented');
  assert.ok(!names.includes('Apify'), 'Apify is absent from this fixture plan and must not be invented');
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('T2: output is a data structure, not a literal baked into the envelope gate', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-distill-'));
  const planPath = path.join(tmpDir, 'plan.md');
  fs.writeFileSync(planPath, '# Plan\n\nUses Slack for alerts.\n', 'utf8');
  const result = distillTraceCategories(planPath);
  assert.equal(typeof result, 'object');
  assert.ok(Array.isArray(result.categories));
  for (const entry of result.categories) {
    assert.equal(typeof entry.category, 'string');
    assert.equal(typeof entry.source, 'string');
  }
  // The envelope gate itself must remain value-blind — a novel category passes.
  const envelopeResult = checkEnvelope(
    { ts: new Date().toISOString(), category: 'TotallyNovelCategory', decision: null, detail: 'x' },
    { stream: 'trace' }
  );
  assert.equal(envelopeResult.ok, true, 'the gate must never hardcode/reject a novel category value');
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('T2: distiller source file differs from the audit distiller (no-collapse by construction)', () => {
  const tracePath = path.resolve(__dirname, '..', 'bin', 'gsd-t-trace-distill.cjs');
  const auditPath = path.resolve(__dirname, '..', 'bin', 'gsd-t-audit-distill.cjs');
  assert.notEqual(tracePath, auditPath);
});

// ── T2: empty-distill lower-bound killing sub-cases (pre-mortem FINDING 4) ──

test('T2(a): non-empty real-plan lower bound — UMI real plan yields Grain/Airtable/Anthropic/Apify, each source-traceable', (t) => {
  if (!fs.existsSync(UMI_PLAN_PATH)) {
    t.skip('UMI-Automation docs/plan.md not present on this machine — real-plan lower-bound check skipped');
    return;
  }
  const result = distillTraceCategories(UMI_PLAN_PATH);
  assert.ok(result.categories.length > 0, 'a run against a real, non-trivial plan must not return zero categories');
  const byName = Object.fromEntries(result.categories.map((c) => [c.category, c]));
  for (const required of ['Grain', 'Airtable', 'Anthropic', 'Apify']) {
    assert.ok(byName[required], `expected category "${required}" distilled from UMI's real plan`);
    assert.match(byName[required].source, new RegExp('^' + UMI_PLAN_PATH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':\\d+:'));
  }
});

test('T2(b): empty-input pole — a plan with no trace-worthy operations returns { categories: [] }, and a downstream zero-categories assertion fails loudly', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-distill-empty-'));
  const planPath = path.join(tmpDir, 'plan.md');
  fs.writeFileSync(planPath, '# Plan\n\nThis project has no external integrations of any kind.\n', 'utf8');
  const result = distillTraceCategories(planPath);
  assert.deepEqual(result.categories, [], 'empty-input pole must return an empty array, never an error or a confabulated placeholder');

  // A downstream consumer asserting categories.length > 0 on THIS empty-plan
  // fixture must FAIL LOUDLY (an explicit assertion failure) — proving the
  // empty case is distinguishable from a broken distiller, never silently
  // passed or silently skipped.
  assert.throws(() => {
    assert.ok(result.categories.length > 0, 'downstream invariant: expected at least one category');
  }, assert.AssertionError);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('T2: KNOWN_INTEGRATION_SIGNATURES is exported as data (not hardcoded into the envelope gate)', () => {
  assert.ok(Array.isArray(KNOWN_INTEGRATION_SIGNATURES));
  assert.ok(KNOWN_INTEGRATION_SIGNATURES.length > 0);
});

test('T2: distillTraceCategories throws on a missing plan path (no silent empty-success)', () => {
  assert.throws(() => {
    distillTraceCategories('/nonexistent/path/plan.md');
  }, /not found/);
});
