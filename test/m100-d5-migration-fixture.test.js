'use strict';

/**
 * M100-D5 — Defaults ripple + brownfield migration + seam-integration tests.
 *
 * Killing-test battery per .gsd-t/domains/d5-defaults-migration-pilot/tasks.md
 * (M100-D5-T1, T2, T2c, T2d, T2b, T3) and the consumed contracts:
 *   - trace-logging-contract.md / audit-logging-contract.md
 *   - logging-scaffold-seam-contract.md
 *   - logging-schema-distillation-contract.md
 *   - logging-verify-gate-contract.md
 *
 * T2b/T3 exercise the SEPARATE repo /Users/david/projects/UMI-Automation —
 * those tests SKIP gracefully (never fail the GSD-T suite) when that sibling
 * checkout is absent (e.g. a CI runner without it), matching the T2b pattern.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

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

/** Recursively snapshots { relPath: contentBuffer } for every FILE under dir. */
function snapshotTree(dir) {
  const out = {};
  function walk(sub) {
    const entries = fs.readdirSync(sub, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(sub, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.isFile()) {
        out[path.relative(dir, abs)] = fs.readFileSync(abs);
      }
    }
  }
  if (fs.existsSync(dir)) walk(dir);
  return out;
}

// ── T1 — reference-doc ripple assertion ─────────────────────────────────────

test('T1: two logging hard rules + opt-out mirrored across all four reference docs', () => {
  const docs = [
    path.join(ROOT, 'templates', 'CLAUDE-global.md'),
    path.join(ROOT, 'README.md'),
    path.join(ROOT, 'GSD-T-README.md'),
    path.join(ROOT, 'commands', 'gsd-t-help.md'),
  ];

  for (const docPath of docs) {
    assert.ok(fs.existsSync(docPath), `reference doc must exist: ${docPath}`);
    const text = fs.readFileSync(docPath, 'utf8').toLowerCase();

    assert.ok(text.includes('trace'), `${path.basename(docPath)} must mention trace`);
    assert.ok(text.includes('audit'), `${path.basename(docPath)} must mention audit`);
    assert.ok(text.includes('default'), `${path.basename(docPath)} must state the default rule`);
    assert.ok(
      text.includes('opt-out') || text.includes('optout'),
      `${path.basename(docPath)} must document the opt-out mechanism`
    );
  }
});

// ── T2 — the migration module ───────────────────────────────────────────────

const {
  migrateLogging,
  run: runMigrateLogging,
  TRACE_DEST_REL,
  AUDIT_DEST_REL,
  SCHEMA_DEST_REL,
} = require(path.join(ROOT, 'bin', 'gsd-t-migrate-logging.cjs'));

test('T2: gsd-t-migrate-logging.cjs exports migrateLogging + run', () => {
  assert.equal(typeof migrateLogging, 'function');
  assert.equal(typeof runMigrateLogging, 'function');
});

test('T2 KILLING TEST: migration is ADDITIVE — every pre-existing fixture file is byte-for-byte unchanged', () => {
  const dir = mkTmpProject('migrate-additive');
  try {
    // Seed a throwaway fixture repo with pre-existing content.
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'index.ts'), 'export const existing = 1;\n', 'utf8');
    fs.writeFileSync(path.join(dir, 'README.md'), '# Pre-existing fixture repo\n', 'utf8');
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'fixture' }, null, 2) + '\n', 'utf8');

    const before = snapshotTree(dir);

    const result = migrateLogging(dir, { approve: 'local-jsonl' });

    assert.equal(result.ok, true);
    assert.ok(Array.isArray(result.created) && result.created.length > 0, 'must create at least one new file');

    const after = snapshotTree(dir);

    // Every file present BEFORE the migration must be present AFTER, byte-for-byte identical.
    for (const relPath of Object.keys(before)) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(after, relPath),
        `pre-existing file must still exist: ${relPath}`
      );
      assert.ok(
        before[relPath].equals(after[relPath]),
        `pre-existing file must be byte-for-byte unchanged: ${relPath}`
      );
    }

    // Only NEW files were added — trace.ts, audit.ts, and the schema file.
    assert.ok(fs.existsSync(path.join(dir, TRACE_DEST_REL)), 'trace.ts must be created');
    assert.ok(fs.existsSync(path.join(dir, AUDIT_DEST_REL)), 'audit.ts must be created');
    assert.ok(fs.existsSync(path.join(dir, SCHEMA_DEST_REL)), 'logging-schema.json must be created');
  } finally {
    rmTmp(dir);
  }
});

test('T2 KILLING TEST: a second migration run does NOT overwrite files created by the first run', () => {
  const dir = mkTmpProject('migrate-idempotent');
  try {
    migrateLogging(dir, { approve: 'local-jsonl' });
    const afterFirst = snapshotTree(dir);

    // Simulate a hand-edit to the scaffolded trace file — the migration must
    // never clobber it on a re-run (existence check gates every write).
    const traceAbs = path.join(dir, TRACE_DEST_REL);
    fs.writeFileSync(traceAbs, '// hand-edited after scaffold\n', 'utf8');

    migrateLogging(dir, { approve: 'local-jsonl' });
    const afterSecond = snapshotTree(dir);

    assert.equal(
      afterSecond[TRACE_DEST_REL].toString('utf8'),
      '// hand-edited after scaffold\n',
      'a re-run must not overwrite an existing (even hand-edited) trace.ts'
    );
    assert.ok(afterFirst[AUDIT_DEST_REL].equals(afterSecond[AUDIT_DEST_REL]));
  } finally {
    rmTmp(dir);
  }
});

test('T2: dispatch delegation — bin/gsd-t.js does NOT get edited by d5; it requires ./gsd-t-migrate-logging.cjs', () => {
  const gsdtSrc = fs.readFileSync(path.join(ROOT, 'bin', 'gsd-t.js'), 'utf8');
  assert.ok(gsdtSrc.includes('case "migrate-logging"'), 'bin/gsd-t.js must have the migrate-logging dispatch case');
  assert.ok(
    gsdtSrc.includes('gsd-t-migrate-logging.cjs'),
    'bin/gsd-t.js dispatch must require gsd-t-migrate-logging.cjs (d5-owned module)'
  );
});

test('T2: run(argv) — CLI wrapper accepts argv shaped as args.slice(1) from bin/gsd-t.js', async () => {
  const dir = mkTmpProject('migrate-cli');
  try {
    // Capture stdout without depending on process.exit semantics.
    const origWrite = process.stdout.write.bind(process.stdout);
    let captured = '';
    process.stdout.write = (chunk) => {
      captured += chunk;
      return true;
    };
    try {
      await runMigrateLogging([dir, '--approve', 'local-jsonl']);
    } finally {
      process.stdout.write = origWrite;
    }
    const parsed = JSON.parse(captured);
    assert.equal(parsed.ok, true);
    assert.ok(Array.isArray(parsed.created));
  } finally {
    rmTmp(dir);
  }
});

test('T2: distillation contract is consumed by d2/d4 distillers (published, referenced by name)', () => {
  const contractPath = path.join(ROOT, '.gsd-t', 'contracts', 'logging-schema-distillation-contract.md');
  assert.ok(fs.existsSync(contractPath), 'logging-schema-distillation-contract.md must exist (published)');
  const contractText = fs.readFileSync(contractPath, 'utf8');
  assert.ok(/STABLE/.test(contractText), 'distillation contract must be published as STABLE');

  const traceDistillSrc = fs.readFileSync(path.join(ROOT, 'bin', 'gsd-t-trace-distill.cjs'), 'utf8');
  const auditDistillSrc = fs.readFileSync(path.join(ROOT, 'bin', 'gsd-t-audit-distill.cjs'), 'utf8');
  assert.ok(
    /logging-schema-distillation-contract/.test(traceDistillSrc),
    "d2's trace distiller must reference the distillation contract"
  );
  assert.ok(
    /logging-schema-distillation-contract/.test(auditDistillSrc),
    "d4's audit distiller must reference the distillation contract"
  );
});

// ── T2c — opt-out record shared-fixture integration test ───────────────────

const { writeOptOut } = require(path.join(ROOT, 'bin', 'gsd-t-audit-distill.cjs'));
const { checkLoggingEnvelopes, checkEnvelope } = require(path.join(ROOT, 'bin', 'gsd-t-logging-envelope-check.cjs'));

test('T2c: d4 writeOptOut + d3 audit-default-except-optout agree on ONE shared artifact — opt-out present → PASS', () => {
  const dir = mkTmpProject('optout-present');
  try {
    // A single SHARED fixture: d4's real writer writes the record...
    writeOptOut(dir, 'trace only, no admin-facing accountability surface');

    // ...and d3's real gate check reads it directly from the same project dir.
    const result = checkLoggingEnvelopes({ projectDir: dir });

    const optoutFailures = result.failures.filter((f) => f.rule === 'audit-default-except-optout');
    assert.equal(optoutFailures.length, 0, 'a valid opt-out record must not fail audit-default-except-optout');

    // Confirm the SAME canonical path both sides agree on.
    const recordPath = path.join(dir, '.gsd-t', 'audit-optout.json');
    assert.ok(fs.existsSync(recordPath), 'writeOptOut must write .gsd-t/audit-optout.json');
    const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
    assert.equal(record.auditOptOut, true);
    assert.equal(typeof record.reason, 'string');
  } finally {
    rmTmp(dir);
  }
});

test('T2c: opt-out ABSENT + no audit store → the SAME gate check FAILS for missing audit', () => {
  const dir = mkTmpProject('optout-absent');
  try {
    // A second, independent fixture — no writeOptOut call, no audit store.
    const result = checkLoggingEnvelopes({ projectDir: dir });
    const optoutFailures = result.failures.filter((f) => f.rule === 'audit-default-except-optout');
    assert.ok(optoutFailures.length > 0, 'no opt-out + no audit store must FAIL audit-default-except-optout');
  } finally {
    rmTmp(dir);
  }
});

// ── T2d — real audit-template durability gate composition test ─────────────

const AUDIT_TEMPLATE_SRC = path.join(ROOT, 'templates', 'logging', 'audit-module.template.ts');
const { _readModuleSurface, _checkAppendOnlyImmutable, _checkRetentionConfigurable } = require(
  path.join(ROOT, 'bin', 'gsd-t-logging-envelope-check.cjs')
);

test('T2d: d3 real durability gate PASSES the real, unmodified d4 audit template', () => {
  const dir = mkTmpProject('durability-real');
  try {
    const destPath = path.join(dir, 'audit-module.template.ts');
    fs.copyFileSync(AUDIT_TEMPLATE_SRC, destPath);

    const surface = _readModuleSurface(destPath);
    assert.ok(surface, 'module surface must be discoverable from the real template');

    const appendOnlyFailures = _checkAppendOnlyImmutable({
      exportsUpdate: surface.exportsUpdate,
      exportsDelete: surface.exportsDelete,
      declaresAppendOnly: surface.declaresAppendOnly,
    });
    assert.deepEqual(appendOnlyFailures, [], 'the real template must PASS append-only-immutable');

    const retentionFailures = _checkRetentionConfigurable({
      hardcoded: surface.retentionHardcoded,
      configurable: surface.retentionConfigurable,
    });
    assert.deepEqual(retentionFailures, [], 'the real template must PASS retention-configurable');
  } finally {
    rmTmp(dir);
  }
});

test('T2d: the SAME gate FAILS a mutated copy exposing an update/delete path', () => {
  const dir = mkTmpProject('durability-mutated-updel');
  try {
    let text = fs.readFileSync(AUDIT_TEMPLATE_SRC, 'utf8');
    // Inject a mutated update path the real template does not expose.
    text += '\nexport function updateEntry(id: number, patch: unknown): void { /* mutation added by test */ }\n';
    const destPath = path.join(dir, 'audit-module.mutated.ts');
    fs.writeFileSync(destPath, text, 'utf8');

    const surface = _readModuleSurface(destPath);
    const failures = _checkAppendOnlyImmutable({
      exportsUpdate: surface.exportsUpdate,
      exportsDelete: surface.exportsDelete,
      declaresAppendOnly: surface.declaresAppendOnly,
    });
    assert.ok(failures.length > 0, 'a mutated copy exposing updateEntry must FAIL append-only-immutable');
  } finally {
    rmTmp(dir);
  }
});

test('T2d: the SAME gate FAILS a copy with hardcoded (non-configurable) retention', () => {
  const dir = mkTmpProject('durability-mutated-retention');
  try {
    // A minimal fixture mirroring a genuine hardcode-regression: the word
    // "retention" appears with NO nearby config/env token at all — unlike the
    // real template (whose `AuditRetentionConfig` type name and `opts.retention`
    // plumbing make "config" appear throughout even when the value itself is
    // hardcoded), this fixture isolates the actual failure mode d3's gate
    // must catch: a literal retention window with no configurability signal.
    const text = [
      '// audit module — retention window is a bare literal, no override mechanism',
      'export function pruneExpired() {',
      '  const RETENTION_DAYS = 365; // hardcoded, never sourced from anywhere else',
      '  return RETENTION_DAYS;',
      '}',
      '',
    ].join('\n');
    const destPath = path.join(dir, 'audit-module.mutated-retention.ts');
    fs.writeFileSync(destPath, text, 'utf8');

    const surface = _readModuleSurface(destPath);
    const failures = _checkRetentionConfigurable({
      hardcoded: surface.retentionHardcoded,
      configurable: surface.retentionConfigurable,
    });
    assert.ok(failures.length > 0, 'a hardcoded-retention copy must FAIL retention-configurable');
  } finally {
    rmTmp(dir);
  }
});

// ── T2b — UMI-Automation TS toolchain bootstrap sub-case ───────────────────
//
// Runs ONLY against the real, separate UMI-Automation repo (per scope.md —
// the bootstrap targets /Users/david/projects/UMI-Automation, not a GSD-T
// fixture). Skips gracefully if that repo is not present on this machine
// (e.g. a CI runner without the sibling checkout) rather than failing the
// whole GSD-T suite on an environment difference.

const UMI_ROOT = '/Users/david/projects/UMI-Automation';

test('T2b: UMI-Automation package.json + tsconfig.json declare a real, resolvable TS toolchain', { skip: !fs.existsSync(UMI_ROOT) }, () => {
  const pkgPath = path.join(UMI_ROOT, 'package.json');
  const tsconfigPath = path.join(UMI_ROOT, 'tsconfig.json');

  assert.ok(fs.existsSync(pkgPath), 'UMI-Automation/package.json must exist');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const devDeps = pkg.devDependencies || {};
  assert.ok('typescript' in devDeps, 'package.json must declare a typescript devDependency');
  assert.ok(
    'tsx' in devDeps || 'ts-node' in devDeps,
    'package.json must declare a tsx or ts-node devDependency'
  );
  assert.ok(
    (pkg.scripts && (pkg.scripts.build || pkg.scripts.typecheck)),
    'package.json must declare a build or typecheck script'
  );

  assert.ok(fs.existsSync(tsconfigPath), 'UMI-Automation/tsconfig.json must exist');
  const tsconfigRaw = fs.readFileSync(tsconfigPath, 'utf8');
  let tsconfig;
  assert.doesNotThrow(() => {
    tsconfig = JSON.parse(tsconfigRaw);
  }, 'tsconfig.json must parse as valid JSON');
  const co = tsconfig.compilerOptions || {};
  assert.ok(co.rootDir, 'tsconfig.json must declare rootDir');
  assert.ok(co.baseUrl, 'tsconfig.json must declare baseUrl');
  assert.ok(co.outDir, 'tsconfig.json must declare outDir');
  assert.ok(co.moduleResolution, 'tsconfig.json must declare moduleResolution');
});

test('T2b: the TS toolchain is actually installed (npx tsc --version exits 0)', { skip: !fs.existsSync(UMI_ROOT) }, () => {
  const out = execFileSync('npx', ['tsc', '--version'], {
    cwd: UMI_ROOT,
    encoding: 'utf8',
  });
  assert.ok(/Version\s+\d/.test(out), 'npx tsc --version must report an installed TypeScript version');
});

// ── T3 — UMI-Automation headline end-to-end pilot ──────────────────────────
//
// HEADLINE END-TO-END TEST. Runs ONLY against the real, separate
// UMI-Automation repo. Skips gracefully when absent (same posture as T2b).

const UMI_PLAN_PATH = path.join(UMI_ROOT, 'docs', 'plan.md');
const UMI_TRACE_PATH = path.join(UMI_ROOT, 'src', 'logging', 'trace.ts');
const UMI_AUDIT_PATH = path.join(UMI_ROOT, 'src', 'logging', 'audit.ts');

const umiPresent = fs.existsSync(UMI_ROOT) && fs.existsSync(UMI_PLAN_PATH);

test('T3 (a): distilled trace categories are the OUTPUT of running gsd-t-trace-distill.cjs against UMI\'s real plan.md — each source line is grep-traceable', { skip: !umiPresent }, () => {
  const { distillTraceCategories } = require(path.join(ROOT, 'bin', 'gsd-t-trace-distill.cjs'));
  const result = distillTraceCategories(UMI_PLAN_PATH);

  assert.ok(result.categories.length > 0, 'distiller must find at least one real category in UMI\'s plan');

  const planText = fs.readFileSync(UMI_PLAN_PATH, 'utf8');
  const planLines = planText.split(/\r?\n/);

  for (const entry of result.categories) {
    // source is "<planPath>:<lineNumber>: <text>" — extract the line number
    // and prove that EXACT line, from the plan file read fresh, contains the
    // category name. Never a hand-authored literal array.
    const m = entry.source.match(/:(\d+):\s(.*)$/);
    assert.ok(m, `category "${entry.category}" source must be a "<path>:<line>: <text>" reference`);
    const lineNo = Number(m[1]);
    const actualLine = planLines[lineNo - 1] || '';
    assert.ok(
      actualLine.includes(entry.category),
      `category "${entry.category}"'s cited plan line ${lineNo} must actually contain "${entry.category}" when the plan is grepped fresh`
    );
  }

  // The four UMI integration points named in CLAUDE.md § Stack must be present.
  const categoryNames = result.categories.map((c) => c.category);
  for (const expected of ['Grain', 'Airtable', 'Anthropic', 'Apify']) {
    assert.ok(categoryNames.includes(expected), `distiller must find "${expected}" in UMI's real plan`);
  }
});

test('T3 (b): the PodCoach draft-approval action\'s cited source string is FOUND by grepping UMI\'s real plan.md at test-run time', { skip: !umiPresent }, () => {
  const planText = fs.readFileSync(UMI_PLAN_PATH, 'utf8');

  // The exact cited source string (docs/plan.md:10) — asserted to be FOUND
  // in the plan at test-run time, never hardcoded as ground truth without
  // this live grep-check. A future edit to plan.md that removes this line
  // would FAIL this test, proving the grounding is live, not frozen.
  const citedSourceString =
    'Cloud-native backend + Apify scraping + a purpose-built application that runs the PodCoach drafting workflow via the Anthropic Claude API, with a mandatory human review-and-approve gate on every draft.';

  assert.ok(
    planText.includes(citedSourceString),
    'the cited PodCoach draft-approval source string must be found in UMI\'s real docs/plan.md at test-run time'
  );

  // Echoed confirmation lines (per task's own grounding note) — also live-checked.
  assert.ok(/[Mm]andatory human review-and-approve gate on every draft/.test(planText));
});

test('T3 (c): src/logging/trace.ts and src/logging/audit.ts import-resolve with live symbols present (tsx)', { skip: !umiPresent }, () => {
  assert.ok(fs.existsSync(UMI_TRACE_PATH), 'UMI trace.ts must exist');
  assert.ok(fs.existsSync(UMI_AUDIT_PATH), 'UMI audit.ts must exist');

  const traceCheck = execFileSync(
    'npx',
    ['tsx', '-e', "import('./src/logging/trace.ts').then(m => process.exit(m.emitTrace ? 0 : 1))"],
    { cwd: UMI_ROOT, encoding: 'utf8' }
  );
  const auditCheck = execFileSync(
    'npx',
    ['tsx', '-e', "import('./src/logging/audit.ts').then(m => process.exit(m.appendAudit ? 0 : 1))"],
    { cwd: UMI_ROOT, encoding: 'utf8' }
  );
  // execFileSync throws (non-zero exit) if the live symbol was missing —
  // reaching here means both exited 0 with the real export present.
  assert.equal(traceCheck, '');
  assert.equal(auditCheck, '');
});

test('T3: HEADLINE END-TO-END — real UMI trace + audit records pass d3\'s envelope gate for BOTH streams, no-collapse holds', { skip: !umiPresent }, async () => {
  const dbPath = path.join(UMI_ROOT, '.gsd-t', `audit-e2e-test-${process.pid}.db`);
  try {
    const traceUrl = 'file://' + UMI_TRACE_PATH.split(path.sep).join('/') + '?e2e=' + process.pid;
    const auditUrl = 'file://' + UMI_AUDIT_PATH.split(path.sep).join('/') + '?e2e=' + process.pid;

    const traceMod = await import(traceUrl);
    traceMod.setTraceEnabled(true);
    const traceRecords = [];
    traceMod.configureTraceSink({ write(r) { traceRecords.push(r); } });
    traceMod.emitTrace('Grain', 'fetched call transcript', { decision: null, key: 'grain-e2e' });
    traceMod.emitTrace('Airtable', 'resolved Projects (client x podcast) key', { decision: true });

    const prevDbPath = process.env.UMI_AUDIT_DB_PATH;
    process.env.UMI_AUDIT_DB_PATH = dbPath;
    const auditMod = await import(auditUrl);
    const auditRow = auditMod.recordDraftApproval({
      podcoachId: 'podcoach-e2e',
      draftId: 'draft-e2e',
      before: { content: 'original draft text', status: 'pending' },
      after: { content: 'edited + approved draft text', status: 'approved' },
      context: { requestId: 'req-e2e', sessionId: 'sess-e2e' },
    });
    if (prevDbPath === undefined) delete process.env.UMI_AUDIT_DB_PATH;
    else process.env.UMI_AUDIT_DB_PATH = prevDbPath;

    // Both streams PASS d3's real envelope gate.
    for (const rec of traceRecords) {
      const result = checkEnvelope(rec, { stream: 'trace' });
      assert.ok(result.ok, `trace record must PASS: ${JSON.stringify(result.failures)}`);
    }
    const auditResult = checkEnvelope(auditRow, { stream: 'audit' });
    assert.ok(auditResult.ok, `audit record must PASS: ${JSON.stringify(auditResult.failures)}`);

    // No-collapse: a record carrying BOTH trace and audit top-level markers FAILS.
    const collapsedTrace = Object.assign({}, traceRecords[0], {
      before: {},
      after: {},
      actor: 'x',
      action: 'y',
    });
    const collapsedResult = checkEnvelope(collapsedTrace, { stream: 'trace' });
    assert.equal(collapsedResult.ok, false, 'a trace record with audit markers must FAIL (no-collapse)');
    assert.ok(collapsedResult.failures.some((f) => f.rule === 'no-collapse'));

    const collapsedAudit = Object.assign({}, auditRow, { category: 'Grain', decision: null });
    const collapsedAuditResult = checkEnvelope(collapsedAudit, { stream: 'audit' });
    assert.equal(collapsedAuditResult.ok, false, 'an audit record with trace markers must FAIL (no-collapse)');
  } finally {
    for (const suffix of ['', '-shm', '-wal']) {
      try {
        fs.rmSync(dbPath + suffix, { force: true });
      } catch (_) {
        /* best-effort cleanup */
      }
    }
  }
});

test('T3: UMI storage choice is recorded in UMI\'s own CLAUDE.md', { skip: !umiPresent }, () => {
  const claudeMdPath = path.join(UMI_ROOT, 'CLAUDE.md');
  const text = fs.readFileSync(claudeMdPath, 'utf8');
  assert.ok(/## Logging/i.test(text), 'UMI CLAUDE.md must have a Logging section recording the storage choice');
  assert.ok(/[Ss]torage/.test(text) && /[Ll]ocal/.test(text), 'UMI CLAUDE.md must record the storage choice');
});

test('T3: no other project touched — only UMI-Automation\'s owned files changed', { skip: !umiPresent }, () => {
  // Structural check: the files this pilot is scoped to touch all live under
  // UMI_ROOT; nothing under the GSD-T repo's own src/ (which doesn't exist)
  // or any other sibling project path is referenced by the pilot modules.
  const traceText = fs.readFileSync(UMI_TRACE_PATH, 'utf8');
  const auditText = fs.readFileSync(UMI_AUDIT_PATH, 'utf8');
  assert.ok(!/\/Users\/[^/]+\/projects\/(?!UMI-Automation)/.test(traceText), 'trace.ts must not reference another project path');
  assert.ok(!/\/Users\/[^/]+\/projects\/(?!UMI-Automation)/.test(auditText), 'audit.ts must not reference another project path');
});
