'use strict';

/**
 * M100 D4 — Audit Machinery tests.
 *
 * Killing-test battery per .gsd-t/domains/d4-audit-machinery/tasks.md
 * (M100-D4-T1, T2), .gsd-t/contracts/audit-logging-contract.md, and
 * .gsd-t/contracts/logging-schema-distillation-contract.md.
 *
 * The audit module template (templates/logging/audit-module.template.ts) is
 * loaded via Node's native TypeScript type-stripping (Node >=22.6, stable in
 * v24) — no external transpiler dependency, mirroring d2's trace-machinery
 * test convention (file-disjoint: this file shares NO import/require path
 * with test/m100-d2-trace-machinery.test.js).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const Database = require('better-sqlite3');
const { checkEnvelope } = require('../bin/gsd-t-logging-envelope-check.cjs');

// ── Import-time export assertion (pre-mortem FINDING 3, HIGH) ──────────────
// Fails loudly at load time (not a cryptic TypeError mid-write) if d3's
// checkEnvelope export shape drifts.
assert.equal(
  typeof checkEnvelope,
  'function',
  'gsd-t-logging-envelope-check.cjs must export checkEnvelope as a function'
);

const {
  distillAuditActions,
  writeOptOut,
  readOptOut,
  OPTOUT_REL_PATH,
} = require('../bin/gsd-t-audit-distill.cjs');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'logging', 'audit-module.template.ts');
const TEMPLATE_URL = 'file://' + TEMPLATE_PATH.split(path.sep).join('/');
const TRACE_DISTILL_PATH = path.join(__dirname, '..', 'bin', 'gsd-t-trace-distill.cjs');
const AUDIT_DISTILL_PATH = path.join(__dirname, '..', 'bin', 'gsd-t-audit-distill.cjs');

let _importCounter = 0;
/** Fresh module instance per call — avoids any shared module-level state leaking across tests. */
function freshAuditModule() {
  _importCounter += 1;
  return import(TEMPLATE_URL + '?instance=' + _importCounter);
}

function mkTmpDb(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return path.join(dir, 'audit.db');
}

function sampleEntry(overrides = {}) {
  return Object.assign(
    {
      ts: new Date().toISOString(),
      actor: 'alice',
      action: 'approve-draft',
      target: 'draft-42',
      before: { status: 'pending' },
      after: { status: 'approved' },
      context: { ip: '10.0.0.5', sessionId: 'sess-1' },
    },
    overrides
  );
}

// ── M100-D4-T1: append-only immutability against REAL embedded SQLite ─────

test('T1: appendAudit inserts a row and the write helper exposes NO update/delete method', async () => {
  const { AuditModule } = await freshAuditModule();
  const dbPath = mkTmpDb('gsd-t-audit-');
  const mod = new AuditModule({ dbPath, retention: { retentionDays: 30 } });
  try {
    const row = mod.appendAudit(sampleEntry());
    assert.equal(typeof row.id, 'number');
    assert.equal(row.actor, 'alice');

    assert.equal(typeof mod.updateEntry, 'undefined');
    assert.equal(typeof mod.deleteEntry, 'undefined');
    assert.equal(typeof mod.update, 'undefined');
    assert.equal(typeof mod.delete, 'undefined');
  } finally {
    mod.close();
  }
});

test('T1: real embedded SQLite REJECTS an UPDATE of an existing entry through the exact write-helper connection', async () => {
  const { AuditModule } = await freshAuditModule();
  const dbPath = mkTmpDb('gsd-t-audit-');
  const mod = new AuditModule({ dbPath, retention: { retentionDays: 30 } });
  try {
    const row = mod.appendAudit(sampleEntry());
    const raw = new Database(dbPath);
    try {
      assert.throws(() => {
        raw.prepare('UPDATE audit_log SET actor = ? WHERE id = ?').run('mallory', row.id);
      }, /append-only/i);
    } finally {
      raw.close();
    }
  } finally {
    mod.close();
  }
});

test('T1: real embedded SQLite REJECTS a DELETE of an existing entry through the exact write-helper connection', async () => {
  const { AuditModule } = await freshAuditModule();
  const dbPath = mkTmpDb('gsd-t-audit-');
  const mod = new AuditModule({ dbPath, retention: { retentionDays: 30 } });
  try {
    const row = mod.appendAudit(sampleEntry());
    const raw = new Database(dbPath);
    try {
      assert.throws(() => {
        raw.prepare('DELETE FROM audit_log WHERE id = ?').run(row.id);
      }, /append-only/i);
    } finally {
      raw.close();
    }
  } finally {
    mod.close();
  }
});

test('T1: admin query surface filters by actor, by target, and by time window and returns the inserted row', async () => {
  const { AuditModule } = await freshAuditModule();
  const dbPath = mkTmpDb('gsd-t-audit-');
  const mod = new AuditModule({ dbPath, retention: { retentionDays: 365 } });
  try {
    const early = mod.appendAudit(sampleEntry({ ts: '2020-01-01T00:00:00.000Z', actor: 'alice', target: 'draft-1' }));
    const late = mod.appendAudit(sampleEntry({ ts: '2025-06-01T00:00:00.000Z', actor: 'bob', target: 'draft-2' }));

    const byActor = mod.queryAudit({ actor: 'alice' });
    assert.equal(byActor.length, 1);
    assert.equal(byActor[0].id, early.id);

    const byTarget = mod.queryAudit({ target: 'draft-2' });
    assert.equal(byTarget.length, 1);
    assert.equal(byTarget[0].id, late.id);

    const byWindow = mod.queryAudit({ since: '2024-01-01T00:00:00.000Z', until: '2026-01-01T00:00:00.000Z' });
    assert.equal(byWindow.length, 1);
    assert.equal(byWindow[0].id, late.id);

    const all = mod.queryAudit({});
    assert.equal(all.length, 2);
  } finally {
    mod.close();
  }
});

test('T1: an emitted audit record passes checkEnvelope(record, {stream:"audit"})', async () => {
  const { AuditModule } = await freshAuditModule();
  const dbPath = mkTmpDb('gsd-t-audit-');
  const mod = new AuditModule({ dbPath, retention: { retentionDays: 30 } });
  try {
    const row = mod.appendAudit(sampleEntry());
    // Strip the store-assigned id — the envelope contract does not include it.
    const { id, ...record } = row;
    const result = checkEnvelope(record, { stream: 'audit' });
    assert.equal(result.ok, true, 'expected checkEnvelope to pass: ' + JSON.stringify(result.failures));
  } finally {
    mod.close();
  }
});

// ── Immutability-bypass killing sub-cases (pre-mortem FINDING 4, HIGH) ─────

test('T1 bypass (i): UPDATE and DELETE through the exact write-helper connection object are BOTH rejected', async () => {
  const { AuditModule } = await freshAuditModule();
  const dbPath = mkTmpDb('gsd-t-audit-bypass-');
  const mod = new AuditModule({ dbPath, retention: { retentionDays: 30 } });
  try {
    const row = mod.appendAudit(sampleEntry());
    // "the EXACT write-helper/connection object the audit module itself
    // exposes" — mod has no update/delete method, so the only way to even
    // attempt one is to reach the same underlying db file, which is bound
    // by the SAME triggers regardless of which connection issues the SQL.
    const sameFileConn = new Database(dbPath);
    try {
      assert.throws(() => sameFileConn.prepare('UPDATE audit_log SET actor = ? WHERE id = ?').run('mallory', row.id));
      assert.throws(() => sameFileConn.prepare('DELETE FROM audit_log WHERE id = ?').run(row.id));
    } finally {
      sameFileConn.close();
    }
  } finally {
    mod.close();
  }
});

test('T1 bypass (ii): DROP TRIGGER + UPDATE sequence is healed — pruneExpired self-heals and refuses to touch live rows', async () => {
  const { AuditModule } = await freshAuditModule();
  const dbPath = mkTmpDb('gsd-t-audit-bypass-');
  const mod = new AuditModule({ dbPath, retention: { retentionDays: 30 } });
  try {
    const row = mod.appendAudit(sampleEntry({ actor: 'alice' }));
    assert.equal(mod.triggersIntact(), true);

    const raw = new Database(dbPath);
    try {
      // Attempt to DROP the immutability trigger, then UPDATE the now-unguarded row.
      raw.exec('DROP TRIGGER audit_log_no_update');
      raw.prepare('UPDATE audit_log SET actor = ? WHERE id = ?').run('mallory', row.id);
    } finally {
      raw.close();
    }
    // The DROP+UPDATE succeeded at the raw-SQL layer (this build of
    // better-sqlite3 exposes no authorizer hook to pre-empt it at CREATE
    // time) — the guarantee under test is that the SOLE sanctioned mutation
    // path (pruneExpired) detects and re-asserts the guard before it acts,
    // and — critically — even with the trigger dropped, no living/authorized
    // path other than pruneExpired can act, and pruneExpired itself refuses
    // to touch a live (non-expired) row.
    assert.equal(mod.triggersIntact(), false, 'trigger should read as dropped before self-heal');

    const pruneResult = mod.pruneExpired();
    assert.equal(pruneResult.deletedCount, 0, 'live row must not be pruned');
    assert.equal(mod.triggersIntact(), true, 'pruneExpired must self-heal the dropped trigger');

    // Guard is now healed — a fresh UPDATE attempt is rejected again.
    const raw2 = new Database(dbPath);
    try {
      assert.throws(() => raw2.prepare('UPDATE audit_log SET actor = ? WHERE id = ?').run('mallory2', row.id));
    } finally {
      raw2.close();
    }
  } finally {
    mod.close();
  }
});

test('T1 bypass (iii): prune_expired() deletes ONLY window-expired rows — one expired, one live', async () => {
  const { AuditModule } = await freshAuditModule();
  const dbPath = mkTmpDb('gsd-t-audit-prune-');
  const mod = new AuditModule({ dbPath, retention: { retentionDays: 30 } });
  try {
    const expiredTs = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    const liveTs = new Date().toISOString();
    const expired = mod.appendAudit(sampleEntry({ ts: expiredTs, actor: 'expired-actor' }));
    const live = mod.appendAudit(sampleEntry({ ts: liveTs, actor: 'live-actor' }));

    const result = mod.pruneExpired();
    assert.equal(result.deletedCount, 1);

    const remaining = mod.queryAudit({});
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, live.id);
    assert.equal(mod.queryAudit({ actor: 'expired-actor' }).length, 0);
    assert.equal(mod.queryAudit({ actor: 'live-actor' }).length, 1);
  } finally {
    mod.close();
  }
});

// ── Gate-table tamper killing sub-cases (Red Team M100 BUG 1 CRITICAL + BUG 2 HIGH) ──
// The audit immutability once delegated to a WIDE-OPEN `audit_log_prune_gate`
// flag with NO trigger protecting itself. Two second-connection attacks defeated
// it; both must now be BLOCKED (the live audit row must SURVIVE).

test('BUG 1 (CRITICAL): second-connection UPDATE audit_log_prune_gate SET active=1 then DELETE a live row is BLOCKED (row survives)', async () => {
  const { AuditModule } = await freshAuditModule();
  const dbPath = mkTmpDb('gsd-t-audit-gate1-');
  const mod = new AuditModule({ dbPath, retention: { retentionDays: 30 } });
  try {
    const live = mod.appendAudit(sampleEntry({ actor: 'victim', ts: new Date().toISOString() }));

    const raw = new Database(dbPath);
    try {
      // Attack: flip the gate open from a hostile second connection, then delete a live row.
      assert.throws(
        () => raw.prepare('UPDATE audit_log_prune_gate SET active = 1').run(),
        /tamper-protected/i,
        'out-of-band gate UPDATE must be aborted by the gate self-protection trigger'
      );
      // Even if the flip is retried some other way, the live DELETE itself must still abort.
      assert.throws(
        () => raw.prepare('DELETE FROM audit_log WHERE id = ?').run(live.id),
        /append-only/i,
        'live-row DELETE must remain blocked'
      );
    } finally {
      raw.close();
    }

    // The live row must still be present.
    const rows = mod.queryAudit({ actor: 'victim' });
    assert.equal(rows.length, 1, 'live audit row must SURVIVE the gate-flip attack');
    assert.equal(rows[0].id, live.id);
  } finally {
    mod.close();
  }
});

test('BUG 2 (HIGH): second-connection DELETE FROM audit_log_prune_gate (empty gate = NULL) then DELETE a live row is BLOCKED (fail-closed)', async () => {
  const { AuditModule } = await freshAuditModule();
  const dbPath = mkTmpDb('gsd-t-audit-gate2-');
  const mod = new AuditModule({ dbPath, retention: { retentionDays: 30 } });
  try {
    const live = mod.appendAudit(sampleEntry({ actor: 'victim2', ts: new Date().toISOString() }));

    const raw = new Database(dbPath);
    try {
      // Attack: empty the gate so the DELETE trigger's subquery returns NULL.
      // The gate self-protection trigger aborts the DELETE outright...
      assert.throws(
        () => raw.prepare('DELETE FROM audit_log_prune_gate').run(),
        /tamper-protected/i,
        'out-of-band gate DELETE must be aborted by the gate self-protection trigger'
      );
      // ...and COALESCE-hardening means an empty gate reads as active=0 (LOCKED),
      // so the live-row DELETE is still blocked fail-CLOSED.
      assert.throws(
        () => raw.prepare('DELETE FROM audit_log WHERE id = ?').run(live.id),
        /append-only/i,
        'empty-gate live-row DELETE must be blocked fail-closed'
      );
    } finally {
      raw.close();
    }

    const rows = mod.queryAudit({ actor: 'victim2' });
    assert.equal(rows.length, 1, 'live audit row must SURVIVE the empty-gate attack');
    assert.equal(rows[0].id, live.id);
  } finally {
    mod.close();
  }
});

test('BUG 2 fail-closed: even if the gate table is forcibly emptied, a live-row DELETE reads NULL as LOCKED and is BLOCKED', async () => {
  const { AuditModule } = await freshAuditModule();
  const dbPath = mkTmpDb('gsd-t-audit-gate2b-');
  const mod = new AuditModule({ dbPath, retention: { retentionDays: 30 } });
  try {
    const live = mod.appendAudit(sampleEntry({ actor: 'victim3', ts: new Date().toISOString() }));

    // Prove the COALESCE fail-closed property in isolation: drop the gate
    // self-protection triggers first (so the empty is possible), empty the gate,
    // then confirm the audit_log DELETE trigger STILL fires (NULL → active=0).
    const raw = new Database(dbPath);
    try {
      raw.exec('DROP TRIGGER IF EXISTS audit_log_prune_gate_no_delete');
      raw.prepare('DELETE FROM audit_log_prune_gate').run(); // gate now empty → subquery NULL
      assert.throws(
        () => raw.prepare('DELETE FROM audit_log WHERE id = ?').run(live.id),
        /append-only/i,
        'COALESCE must treat an empty (NULL) gate as active=0 → trigger fires → DELETE blocked'
      );
    } finally {
      raw.close();
    }

    const rows = mod.queryAudit({ actor: 'victim3' });
    assert.equal(rows.length, 1, 'live row must survive when the gate is emptied (fail-closed)');
  } finally {
    mod.close();
  }
});

test('sanctioned path intact: pruneExpired of an EXPIRED row still succeeds after the gate hardening', async () => {
  const { AuditModule } = await freshAuditModule();
  const dbPath = mkTmpDb('gsd-t-audit-gate-sane-');
  const mod = new AuditModule({ dbPath, retention: { retentionDays: 30 } });
  try {
    const expiredTs = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    mod.appendAudit(sampleEntry({ ts: expiredTs, actor: 'expired-actor' }));
    const live = mod.appendAudit(sampleEntry({ ts: new Date().toISOString(), actor: 'live-actor' }));

    const result = mod.pruneExpired();
    assert.equal(result.deletedCount, 1, 'the sanctioned prune must still delete the expired row');

    const remaining = mod.queryAudit({});
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, live.id);
  } finally {
    mod.close();
  }
});

test('self-heal: pruneExpired restores a missing gate row (re-INSERT active=0) before pruning', async () => {
  const { AuditModule } = await freshAuditModule();
  const dbPath = mkTmpDb('gsd-t-audit-gate-heal-');
  const mod = new AuditModule({ dbPath, retention: { retentionDays: 30 } });
  try {
    const expiredTs = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    mod.appendAudit(sampleEntry({ ts: expiredTs, actor: 'expired-heal' }));
    const live = mod.appendAudit(sampleEntry({ ts: new Date().toISOString(), actor: 'live-heal' }));

    // Forcibly remove the gate row out-of-band (drop the self-protection trigger first).
    const raw = new Database(dbPath);
    try {
      raw.exec('DROP TRIGGER IF EXISTS audit_log_prune_gate_no_delete');
      raw.prepare('DELETE FROM audit_log_prune_gate').run();
      const cnt = raw.prepare('SELECT COUNT(*) AS n FROM audit_log_prune_gate').get();
      assert.equal(cnt.n, 0, 'precondition: gate row removed');
    } finally {
      raw.close();
    }

    // pruneExpired must self-heal the missing gate row, then prune only the expired row.
    const result = mod.pruneExpired();
    assert.equal(result.deletedCount, 1, 'prune must succeed after restoring the gate row');

    const check = new Database(dbPath);
    try {
      const cnt = check.prepare('SELECT COUNT(*) AS n FROM audit_log_prune_gate').get();
      assert.equal(cnt.n, 1, 'gate row must be restored to exactly one row');
      const active = check.prepare('SELECT active FROM audit_log_prune_gate LIMIT 1').get();
      assert.equal(active.active, 0, 'restored gate row must be active=0 (locked)');
    } finally {
      check.close();
    }

    const remaining = mod.queryAudit({});
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, live.id);
  } finally {
    mod.close();
  }
});

test('T1 bypass (iii): prune_expired() cannot be coerced via a malicious retention-window override into deleting a live row', async () => {
  const dbPath = mkTmpDb('gsd-t-audit-coerce-');

  for (const maliciousDays of [0, -1, -9999, NaN, Infinity]) {
    const { AuditModule } = await freshAuditModule();
    const mod = new AuditModule({ dbPath, retention: { retentionDays: maliciousDays } });
    try {
      // Seed a live row fresh under each malicious config, prune, then confirm
      // it survives — a negative/zero/NaN/Infinity window must NOT widen the
      // cutoff into "delete everything, including the present."
      const live = mod.appendAudit(sampleEntry({ ts: new Date().toISOString(), actor: 'still-here-' + maliciousDays }));
      const result = mod.pruneExpired();
      assert.equal(result.deletedCount, 0, 'malicious retentionDays=' + maliciousDays + ' must not prune the live row');
      const rows = mod.queryAudit({ actor: 'still-here-' + maliciousDays });
      assert.equal(rows.length, 1, 'live row must survive coercion attempt for retentionDays=' + maliciousDays);
    } finally {
      mod.close();
    }
  }
});

// ── Standalone admin query surface killing sub-case (MEDIUM) ──────────────

test('standalone: the audit module exposes a GSD-T-independent admin query entry point reachable without the GSD-T CLI', async () => {
  const { AuditModule, adminQueryAudit } = await freshAuditModule();
  const dbPath = mkTmpDb('gsd-t-audit-standalone-');

  // Seed via the module directly (simulating the project's own runtime).
  const seeder = new AuditModule({ dbPath, retention: { retentionDays: 365 } });
  seeder.appendAudit(sampleEntry({ actor: 'carol', target: 'draft-99', ts: '2024-03-01T00:00:00.000Z' }));
  seeder.appendAudit(sampleEntry({ actor: 'dave', target: 'draft-100', ts: '2024-04-01T00:00:00.000Z' }));
  seeder.close();

  // adminQueryAudit is a plain exported function — no bin/, no commands/, no
  // GSD-T toolchain call in this invocation — exactly what a project's own
  // admin tooling would call after GSD-T is uninstalled.
  assert.equal(typeof adminQueryAudit, 'function');
  const rows = adminQueryAudit(dbPath, { actor: 'carol' }, { retentionDays: 365 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].target, 'draft-99');

  const byTime = adminQueryAudit(
    dbPath,
    { since: '2024-03-15T00:00:00.000Z', until: '2024-05-01T00:00:00.000Z' },
    { retentionDays: 365 }
  );
  assert.equal(byTime.length, 1);
  assert.equal(byTime[0].actor, 'dave');
});

// ── Retention configurable + extendable (not hardcoded) ────────────────────

test('retention is configuration-driven, not a literal — two different configs produce two different cutoffs', async () => {
  const dbPath = mkTmpDb('gsd-t-audit-retention-');
  const ts60DaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  {
    const { AuditModule } = await freshAuditModule();
    const mod = new AuditModule({ dbPath, retention: { retentionDays: 30 } });
    mod.appendAudit(sampleEntry({ ts: ts60DaysAgo, actor: 'short-window' }));
    const result = mod.pruneExpired();
    assert.equal(result.deletedCount, 1, 'a 30-day retention must expire a 60-day-old row');
    mod.close();
  }

  const dbPath2 = mkTmpDb('gsd-t-audit-retention2-');
  {
    const { AuditModule } = await freshAuditModule();
    const mod = new AuditModule({ dbPath: dbPath2, retention: { retentionDays: 3650 } });
    mod.appendAudit(sampleEntry({ ts: ts60DaysAgo, actor: 'long-window' }));
    const result = mod.pruneExpired();
    assert.equal(result.deletedCount, 0, 'a 10-year retention must NOT expire a 60-day-old row (extendable, not hardcoded)');
    mod.close();
  }
});

// ── No-collapse: audit template never shares a file with trace ────────────

test('no-collapse: the audit distiller source path differs from the trace distiller path', () => {
  assert.notEqual(AUDIT_DISTILL_PATH, TRACE_DISTILL_PATH);
});

// ── M100-D4-T2: audit-half action distiller + opt-out convention ──────────

test('T2: distillAuditActions extracts ACTUAL actions from a fixture plan and invents none', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-audit-distill-'));
  const planPath = path.join(tmpDir, 'plan.md');
  fs.writeFileSync(
    planPath,
    [
      '# Project Plan',
      '',
      '## Draft review',
      '- A PodCoach must review, edit, and approve every "Draft" before delivery.',
      '- Refund requests on an "Order" require a manager to approve or reject them.',
      '',
      '## Non-accountability step',
      '- Fetch the weather forecast for tomorrow.',
    ].join('\n')
  );

  const { actions } = distillAuditActions(planPath);
  assert.ok(Array.isArray(actions));
  assert.ok(actions.length > 0, 'expected at least one distilled action from the fixture plan');

  // Every distilled action must be grep-traceable back to the plan's own text.
  const planText = fs.readFileSync(planPath, 'utf8');
  for (const a of actions) {
    assert.ok(planText.includes(a.source), 'distilled action source must be traceable to the plan text: ' + a.source);
  }

  // No-confabulation falsifier: nothing about "weather" was distilled as an action.
  assert.ok(!actions.some((a) => /weather/i.test(a.source)));
});

test('T2: opt-out convention — writeOptOut/readOptOut round-trip a valid record per §opt-out-record', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-audit-optout-'));
  const written = writeOptOut(tmpDir, 'trace only, no admin-facing accountability surface');

  assert.equal(written.auditOptOut, true);
  assert.equal(typeof written.reason, 'string');

  const filePath = path.join(tmpDir, OPTOUT_REL_PATH);
  assert.ok(fs.existsSync(filePath));
  const onDisk = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.deepEqual(onDisk, written);

  const readBack = readOptOut(tmpDir);
  assert.deepEqual(readBack, written);
});

test('T2: readOptOut fail-closed on an invalid record (auditOptOut:false, missing reason, absent file)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-audit-optout-invalid-'));
  assert.equal(readOptOut(tmpDir), null, 'absent file must read as null (not an implicit pass)');

  fs.mkdirSync(path.join(tmpDir, '.gsd-t'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, '.gsd-t', 'audit-optout.json'),
    JSON.stringify({ auditOptOut: false, reason: 'not really' })
  );
  assert.equal(readOptOut(tmpDir), null, 'auditOptOut:false must not be recognized as a valid opt-out');

  fs.writeFileSync(path.join(tmpDir, '.gsd-t', 'audit-optout.json'), JSON.stringify({ auditOptOut: true, reason: '' }));
  assert.equal(readOptOut(tmpDir), null, 'empty reason must not be recognized as a valid opt-out');
});

test('T2: an opt-out record produced by writeOptOut is recognized by the standalone _isValidOptOut convention checker', () => {
  const { _isValidOptOut } = require('../bin/gsd-t-logging-envelope-check.cjs');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-audit-optout-check-'));
  const record = writeOptOut(tmpDir, 'audit not applicable to this project');
  assert.equal(_isValidOptOut(record), true);
});

// ── Empty-distill lower-bound killing sub-cases (pre-mortem FINDING 4, MEDIUM) ──

test('T2 (a): NON-EMPTY real-plan lower bound — UMI-Automation REAL docs/plan.md yields actions.length > 0 including PodCoach draft-approval', () => {
  const umiPlanPath = path.join(os.homedir(), 'projects', 'UMI-Automation', 'docs', 'plan.md');
  assert.ok(fs.existsSync(umiPlanPath), 'UMI-Automation real plan.md must exist at ' + umiPlanPath);

  const { actions } = distillAuditActions(umiPlanPath);
  assert.ok(actions.length > 0, 'distillAuditActions against UMI real plan.md must return > 0 actions');

  // PodCoach draft-approval action, grep-traceable to the plan's own
  // review->edit->approve clause (docs/plan.md: "PodCoach reviews, edits,
  // and approves it before anything leaves the system").
  const hasApprovalAction = actions.some((a) => /approv/i.test(a.action) || /approv/i.test(a.source));
  assert.ok(hasApprovalAction, 'expected a distilled draft-approval action grounded in the real UMI plan');

  const planText = fs.readFileSync(umiPlanPath, 'utf8');
  for (const a of actions) {
    assert.ok(planText.includes(a.source), 'every distilled action must be grep-traceable to UMI docs/plan.md');
  }
});

test('T2 (b): empty-input pole — a plan with NO accountability-worthy actions returns { actions: [] }, never an error or placeholder', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-audit-distill-empty-'));
  const planPath = path.join(tmpDir, 'plan.md');
  fs.writeFileSync(
    planPath,
    ['# Project Plan', '', '## Infra', '- Provision a CDN.', '- Configure DNS records.'].join('\n')
  );

  const result = distillAuditActions(planPath);
  assert.deepEqual(result, { actions: [] });
});

test('T2 (b): a downstream consumer asserting actions.length > 0 on the empty-plan fixture FAILS LOUDLY, never silently passes', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-audit-distill-empty2-'));
  const planPath = path.join(tmpDir, 'plan.md');
  fs.writeFileSync(planPath, ['# Plan', '- Provision a CDN.'].join('\n'));

  const { actions } = distillAuditActions(planPath);
  assert.throws(() => {
    assert.ok(actions.length > 0, 'downstream consumer requires at least one distilled action');
  }, assert.AssertionError);
});
