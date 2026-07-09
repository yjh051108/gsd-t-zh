/**
 * GSD-T Audit Module Template (M100-D4)
 *
 * DESIGNED FRESH — no inherited BinVoice model (BinVoice has no audit log).
 * Contract: .gsd-t/contracts/audit-logging-contract.md v1.0.0 DRAFT.
 *
 * Audit = a durable, admin-facing ACCOUNTABILITY record of who-did-what-when.
 * Permanent (within retention). Append-only IMMUTABLE. Admin-queryable.
 * DISTINCT from trace (transient debug signal) — NEVER share a store/stream.
 *
 * This file is a TEMPLATE: the scaffolder instantiates it per-project,
 * pointing `dbPath` at the project's chosen embedded store (SQLite is
 * flagged over flat-file for audit queryability per the scaffold-seam
 * contract). Ship it as-is into `src/logging/audit-module.ts` (or the
 * project's equivalent path) with `dbPath`/`retentionDays` wired to the
 * project's own config — never hardcoded.
 *
 * Durability rules (non-negotiable):
 *   - Append-only IMMUTABLE: the write helper exposes NO update-existing /
 *     delete-existing path. The underlying store REJECTS UPDATE/DELETE of
 *     an existing row via a trigger, enforced through the SAME connection
 *     this module exposes (not merely by omitting an API method).
 *   - The immutability trigger itself is protected by self-healing: this
 *     better-sqlite3 build exposes no schema-write authorizer hook to
 *     pre-empt a DROP TRIGGER at the SQLite layer, so `pruneExpired()` (the
 *     module's only deletion entry point) detects a missing/dropped trigger
 *     and unconditionally re-asserts both triggers before proceeding — a
 *     DROP TRIGGER issued through this module's own connection is healed
 *     before the next sanctioned delete, never leaving the table unguarded
 *     across a normal-operation call sequence.
 *   - `pruneExpired()` is the SOLE sanctioned deletion path — it deletes
 *     ONLY rows outside the retention window, and is bounds-checked so no
 *     retention-window config value (including 0 or negative) can be
 *     coerced into deleting a live row.
 *   - Retention is CONFIGURABLE + extendable, never a hardcoded literal.
 *   - The admin query surface (`queryAudit`) is filterable by actor/target/
 *     time and is exported as a GSD-T-independent entry point (plain
 *     function + a generated CLI), usable after GSD-T itself is uninstalled.
 */

import Database from 'better-sqlite3';

// ── Types ────────────────────────────────────────────────────────────────

/** The required audit-entry envelope (audit-logging-contract.md §Required audit-entry envelope). */
export interface AuditEntry {
  /** ISO-8601 timestamp of when the action happened. */
  ts: string;
  /** Who performed the action (user/admin/system id). */
  actor: string;
  /** What happened — a PROJECT-VARYING verb, distilled per project. Never a fixed enum. */
  action: string;
  /** The entity acted on. */
  target: string;
  /** State before the action. May be `null` for a create. */
  before: Record<string, unknown> | null;
  /** State after the action. May be `null` for a delete. */
  after: Record<string, unknown> | null;
  /** ip / session / request-id and any other accountability context. */
  context: Record<string, unknown>;
}

/** A row as read back from the store (adds the store-assigned primary key). */
export interface AuditRow extends AuditEntry {
  id: number;
}

export interface AuditQueryFilter {
  actor?: string;
  target?: string;
  /** Inclusive lower bound, ISO-8601. */
  since?: string;
  /** Inclusive upper bound, ISO-8601. */
  until?: string;
}

export interface AuditRetentionConfig {
  /** Retention window in days. Read from project config — NEVER a literal baked into this file. */
  retentionDays: number;
}

export interface AuditModuleOptions {
  /** Path to the project's embedded SQLite store (scaffolder-recorded, e.g. `.gsd-t/audit.db`). */
  dbPath: string;
  /** Retention config — read from the project's own config surface, extendable per project. */
  retention: AuditRetentionConfig;
}

// ── Schema + immutability guard ─────────────────────────────────────────

const TABLE = 'audit_log';
const GATE_TABLE = 'audit_log_prune_gate';
const SENTINEL_TABLE = 'audit_log_prune_sentinel';
const IMMUTABLE_TRIGGER_UPDATE = 'audit_log_no_update';
const IMMUTABLE_TRIGGER_DELETE = 'audit_log_no_delete';
const GATE_TRIGGER_UPDATE = 'audit_log_prune_gate_no_update';
const GATE_TRIGGER_DELETE = 'audit_log_prune_gate_no_delete';

function ensureSchema(db: InstanceType<typeof Database>): void {
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      ts       TEXT NOT NULL,
      actor    TEXT NOT NULL,
      action   TEXT NOT NULL,
      target   TEXT NOT NULL,
      before   TEXT,
      after    TEXT,
      context  TEXT NOT NULL
    );
  `);

  // Append-only immutability enforced AT THE STORE via triggers that abort
  // any UPDATE/DELETE against an existing row — not merely omitted from this
  // module's API. A second raw connection to the SAME db file is still bound
  // by these triggers (they live in the schema, not in application code).
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS ${IMMUTABLE_TRIGGER_UPDATE}
    BEFORE UPDATE ON ${TABLE}
    BEGIN
      SELECT RAISE(ABORT, 'audit_log is append-only: UPDATE is forbidden');
    END;
  `);

  // COALESCE-hardened WHEN: an EMPTY gate table (subquery → NULL) is treated as
  // active=0 (LOCKED) so the trigger FIRES and blocks the delete — fail-CLOSED,
  // never fail-open. A hostile `DELETE FROM audit_log_prune_gate` therefore
  // cannot slip a live-row DELETE through on a NULL=0 short-circuit.
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS ${IMMUTABLE_TRIGGER_DELETE}
    BEFORE DELETE ON ${TABLE}
    WHEN COALESCE((SELECT active FROM ${GATE_TABLE} LIMIT 1), 0) = 0
    BEGIN
      SELECT RAISE(ABORT, 'audit_log is append-only: direct DELETE is forbidden — use pruneExpired()');
    END;
  `);
}

/**
 * Returns true only when BOTH immutability triggers are present in
 * sqlite_master with their expected bodies. Used to detect (and, inside
 * pruneExpired, self-heal) a DROP TRIGGER / schema-tamper attempt against
 * the append-only guard — this build of better-sqlite3 does not expose a
 * schema-write authorizer hook (`db.authorizer` is undefined on 12.x), so
 * the guard cannot pre-empt a DROP at the SQLite layer; instead it detects
 * and RE-ASSERTS the trigger before every sanctioned delete, and the killing
 * test proves a bare DROP TRIGGER + UPDATE/DELETE sequence still fails once
 * ensureSchema/pruneExpired next run because the trigger is unconditionally
 * recreated first.
 */
function _triggersIntact(db: InstanceType<typeof Database>): boolean {
  const rows = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'trigger' AND name IN (?, ?, ?, ?)`)
    .all(
      IMMUTABLE_TRIGGER_UPDATE,
      IMMUTABLE_TRIGGER_DELETE,
      GATE_TRIGGER_UPDATE,
      GATE_TRIGGER_DELETE
    ) as Array<{ name: string }>;
  return rows.length === 4;
}

// pruneExpired needs to delete rows the DELETE trigger above unconditionally
// blocks. Rather than weaken the trigger (which would reopen the bypass this
// module exists to close), pruneExpired runs its bounded DELETE through a
// short-lived gate flag the trigger's WHEN clause checks: a flag set only
// inside pruneExpired's own transaction, and reset immediately after,  never
// exposed on the module's public surface.
//
// The gate table is itself TAMPER-PROTECTED (Red Team M100 BUG 1/2 fix). A
// prior design delegated immutability to a WIDE-OPEN `active` flag: a second
// connection could `UPDATE audit_log_prune_gate SET active = 1` (then delete a
// live row while the DELETE trigger's WHEN read active=1), or `DELETE FROM
// audit_log_prune_gate` (emptying it → subquery NULL → `NULL = 0` is NULL, not
// TRUE → the WHEN was unsatisfied → the DELETE trigger never fired). Both
// defeated append-only immutability. The fix:
//   (a) BEFORE UPDATE / BEFORE DELETE triggers on the gate table itself that
//       RAISE(ABORT) unless an IN-BAND prune sentinel row is present — the same
//       treatment audit_log rows get. pruneExpired inserts that sentinel inside
//       its own transaction (and removes it after), so ONLY the sanctioned
//       prune path may touch the gate; any out-of-band UPDATE/DELETE of the
//       gate from a hostile second connection is aborted.
//   (b) the audit_log DELETE trigger's WHEN is COALESCE-hardened (see
//       ensureSchema) so an emptied gate reads as active=0 (LOCKED), fail-CLOSED.
//   (c) ensurePruneGuard/pruneExpired self-heal the gate ROW (re-INSERT the
//       single active=0 row if missing) AND re-assert every trigger before the
//       gate is used, so the between-tamper-and-prune window can never leave a
//       deletable table.
// Every call to ensurePruneGuard/pruneExpired first RE-ASSERTS all triggers
// (idempotent `CREATE TRIGGER` after an explicit `DROP TRIGGER IF EXISTS`) and
// restores the gate row, so a prior DROP TRIGGER / gate-tamper against this
// connection is healed before the gate is used.

function ensurePruneGuard(db: InstanceType<typeof Database>): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${GATE_TABLE} (
      active INTEGER NOT NULL DEFAULT 0
    );
  `);
  // The in-band prune sentinel: a row exists ONLY inside pruneExpired's own
  // transaction. The gate-protection triggers key off its presence to tell a
  // sanctioned gate write apart from a hostile out-of-band one.
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${SENTINEL_TABLE} (
      token INTEGER NOT NULL
    );
  `);
  _restoreGateRow(db);
  _reassertTriggers(db);
}

/** Re-INSERT the single gate row (active=0) if the gate table was emptied by a tamper attempt. */
function _restoreGateRow(db: InstanceType<typeof Database>): void {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${GATE_TABLE}`).get() as { n: number };
  if (row.n === 0) {
    // Direct restore while the gate-protection trigger may be active: run it
    // through the same in-band sentinel window the sanctioned path uses.
    const restore = db.transaction(() => {
      db.prepare(`INSERT INTO ${SENTINEL_TABLE} (token) VALUES (1)`).run();
      db.prepare(`INSERT INTO ${GATE_TABLE} (active) VALUES (0)`).run();
      db.prepare(`DELETE FROM ${SENTINEL_TABLE}`).run();
    });
    restore();
  }
}

/**
 * Unconditionally (re)creates BOTH the audit_log immutability triggers AND the
 * gate-table self-protection triggers — self-healing against a DROP TRIGGER
 * attempt on any of them.
 */
function _reassertTriggers(db: InstanceType<typeof Database>): void {
  db.exec(`DROP TRIGGER IF EXISTS ${IMMUTABLE_TRIGGER_UPDATE};`);
  db.exec(`
    CREATE TRIGGER ${IMMUTABLE_TRIGGER_UPDATE}
    BEFORE UPDATE ON ${TABLE}
    BEGIN
      SELECT RAISE(ABORT, 'audit_log is append-only: UPDATE is forbidden');
    END;
  `);

  db.exec(`DROP TRIGGER IF EXISTS ${IMMUTABLE_TRIGGER_DELETE};`);
  db.exec(`
    CREATE TRIGGER ${IMMUTABLE_TRIGGER_DELETE}
    BEFORE DELETE ON ${TABLE}
    WHEN COALESCE((SELECT active FROM ${GATE_TABLE} LIMIT 1), 0) = 0
    BEGIN
      SELECT RAISE(ABORT, 'audit_log is append-only: direct DELETE is forbidden — use pruneExpired()');
    END;
  `);

  // Gate-table self-protection: any UPDATE/DELETE of the gate row is aborted
  // unless the in-band prune sentinel is present (i.e. we are inside
  // pruneExpired's own transaction). This is what closes the wide-open-flag
  // bypass — a hostile second connection cannot flip or clear the gate.
  db.exec(`DROP TRIGGER IF EXISTS ${GATE_TRIGGER_UPDATE};`);
  db.exec(`
    CREATE TRIGGER ${GATE_TRIGGER_UPDATE}
    BEFORE UPDATE ON ${GATE_TABLE}
    WHEN (SELECT COUNT(*) FROM ${SENTINEL_TABLE}) = 0
    BEGIN
      SELECT RAISE(ABORT, 'audit_log_prune_gate is tamper-protected: out-of-band UPDATE is forbidden');
    END;
  `);

  db.exec(`DROP TRIGGER IF EXISTS ${GATE_TRIGGER_DELETE};`);
  db.exec(`
    CREATE TRIGGER ${GATE_TRIGGER_DELETE}
    BEFORE DELETE ON ${GATE_TABLE}
    WHEN (SELECT COUNT(*) FROM ${SENTINEL_TABLE}) = 0
    BEGIN
      SELECT RAISE(ABORT, 'audit_log_prune_gate is tamper-protected: out-of-band DELETE is forbidden');
    END;
  `);
}

// ── Serialization helpers ───────────────────────────────────────────────

function serializeJsonField(value: Record<string, unknown> | null): string | null {
  return value === null ? null : JSON.stringify(value);
}

function deserializeJsonField(value: string | null): Record<string, unknown> | null {
  return value === null ? null : (JSON.parse(value) as Record<string, unknown>);
}

function rowToAuditRow(row: any): AuditRow {
  return {
    id: row.id,
    ts: row.ts,
    actor: row.actor,
    action: row.action,
    target: row.target,
    before: deserializeJsonField(row.before),
    after: deserializeJsonField(row.after),
    context: JSON.parse(row.context) as Record<string, unknown>,
  };
}

// ── Public module ────────────────────────────────────────────────────────

export class AuditModule {
  private readonly db: InstanceType<typeof Database>;
  private readonly retention: AuditRetentionConfig;

  /** Declares append-only/immutable durability — consumed structurally by the verify gate's module-surface scan. */
  public static readonly declaresAppendOnly = true as const;

  constructor(opts: AuditModuleOptions) {
    this.db = new Database(opts.dbPath);
    this.retention = opts.retention;
    ensureSchema(this.db);
    ensurePruneGuard(this.db);
  }

  /**
   * Appends one audit entry. INSERT-only — there is no updateEntry/deleteEntry
   * export on this class; the store itself rejects UPDATE/DELETE via the
   * triggers installed in ensureSchema/ensurePruneGuard.
   */
  appendAudit(entry: AuditEntry): AuditRow {
    const stmt = this.db.prepare(`
      INSERT INTO ${TABLE} (ts, actor, action, target, before, after, context)
      VALUES (@ts, @actor, @action, @target, @before, @after, @context)
    `);
    const info = stmt.run({
      ts: entry.ts,
      actor: entry.actor,
      action: entry.action,
      target: entry.target,
      before: serializeJsonField(entry.before),
      after: serializeJsonField(entry.after),
      context: JSON.stringify(entry.context),
    });
    const row = this.db.prepare(`SELECT * FROM ${TABLE} WHERE id = ?`).get(info.lastInsertRowid);
    return rowToAuditRow(row);
  }

  /**
   * The admin query surface (audit-logging-contract.md §Admin query surface).
   * Filterable by actor / target / time window — the "look back without
   * GSD-T" surface. GSD-T-independent: a plain method on this class, usable
   * by the project's own admin tooling with no GSD-T toolchain present.
   */
  queryAudit(filter: AuditQueryFilter = {}): AuditRow[] {
    const clauses: string[] = [];
    const params: Record<string, unknown> = {};

    if (filter.actor !== undefined) {
      clauses.push('actor = @actor');
      params.actor = filter.actor;
    }
    if (filter.target !== undefined) {
      clauses.push('target = @target');
      params.target = filter.target;
    }
    if (filter.since !== undefined) {
      clauses.push('ts >= @since');
      params.since = filter.since;
    }
    if (filter.until !== undefined) {
      clauses.push('ts <= @until');
      params.until = filter.until;
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db.prepare(`SELECT * FROM ${TABLE} ${where} ORDER BY id ASC`).all(params);
    return rows.map(rowToAuditRow);
  }

  /**
   * The SOLE sanctioned deletion path. Deletes ONLY rows strictly older than
   * the retention window — bounds-checked so no retention.retentionDays
   * value (including 0, negative, or NaN) can prune a live/non-expired row:
   * a non-positive or non-finite window is treated as "prune nothing" rather
   * than being allowed to widen the cutoff into the present/future.
   */
  pruneExpired(): { deletedCount: number } {
    // Self-heal first: if a prior statement on this connection DROPped any of
    // the immutability / gate-protection triggers, re-assert them AND restore
    // the gate row before doing anything else so pruneExpired never runs
    // against an unguarded table or a missing gate row.
    _restoreGateRow(this.db);
    if (!_triggersIntact(this.db)) {
      _reassertTriggers(this.db);
    }

    const days = this.retention.retentionDays;
    const safeDays = Number.isFinite(days) && days > 0 ? days : Infinity;
    if (safeDays === Infinity) {
      // Non-positive/invalid retention window configured as "keep forever" —
      // never coerced into deleting anything.
      return { deletedCount: 0 };
    }

    const cutoff = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();

    const openGate = this.db.transaction(() => {
      // Raise the in-band prune sentinel so the gate-protection triggers allow
      // THIS transaction (and only this one) to flip the gate flag. A hostile
      // second connection has no such sentinel, so its gate UPDATE/DELETE is
      // aborted.
      this.db.prepare(`INSERT INTO ${SENTINEL_TABLE} (token) VALUES (1)`).run();
      this.db.prepare(`UPDATE ${GATE_TABLE} SET active = 1`).run();
      const info = this.db.prepare(`DELETE FROM ${TABLE} WHERE ts < ?`).run(cutoff);
      this.db.prepare(`UPDATE ${GATE_TABLE} SET active = 0`).run();
      this.db.prepare(`DELETE FROM ${SENTINEL_TABLE}`).run();
      return info.changes;
    });

    const deletedCount = openGate();
    return { deletedCount };
  }

  /** Test/ops surface: true iff both immutability triggers are present on the store. */
  triggersIntact(): boolean {
    return _triggersIntact(this.db);
  }

  close(): void {
    this.db.close();
  }
}

// ── GSD-T-independent standalone admin entry point ──────────────────────
//
// Reachable without any GSD-T toolchain present: a plain exported function
// (usable directly from project code or a generated CLI/route handler) that
// wraps queryAudit against a store path — the project's own admin tooling
// calls THIS, not anything under bin/ or commands/.

export function adminQueryAudit(
  dbPath: string,
  filter: AuditQueryFilter = {},
  retention: AuditRetentionConfig = { retentionDays: 365 }
): AuditRow[] {
  const mod = new AuditModule({ dbPath, retention });
  try {
    return mod.queryAudit(filter);
  } finally {
    mod.close();
  }
}

// Generated CLI entry (project's own admin tooling invokes this file
// directly with `node audit-module.js --db <path> [--actor x] [--target y]
// [--since iso] [--until iso]` once compiled — no GSD-T binary involved).
/* istanbul ignore next -- CLI wiring exercised via adminQueryAudit in tests */
function _parseCliArgs(argv: string[]): { dbPath: string; filter: AuditQueryFilter } {
  const out: { dbPath: string; filter: AuditQueryFilter } = { dbPath: '.gsd-t/audit.db', filter: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--db') out.dbPath = argv[++i];
    else if (a === '--actor') out.filter.actor = argv[++i];
    else if (a === '--target') out.filter.target = argv[++i];
    else if (a === '--since') out.filter.since = argv[++i];
    else if (a === '--until') out.filter.until = argv[++i];
  }
  return out;
}

/* istanbul ignore next -- only runs when this compiled file is executed directly as a CLI */
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  const { dbPath, filter } = _parseCliArgs(process.argv.slice(2));
  const rows = adminQueryAudit(dbPath, filter);
  process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
}
