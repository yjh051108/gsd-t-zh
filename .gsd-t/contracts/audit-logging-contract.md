# Audit Logging Contract

**Version:** 1.0.0 DRAFT (fixed at Altitude-2 sign-off; STABLE at milestone completion)
**Status:** DRAFT — authored at M100 DEFINE. DESIGNED FRESH (no BinVoice template). Enforcement lands in `gsd-t-verify`.
**Subject:** the required AUDIT-entry ENVELOPE, append-only immutability, configurable retention, the admin query surface, and the trace-vs-audit no-collapse boundary.
**Milestone:** M100 — Universal Trace + Audit Logging (framework defaults).
**No reference template.** BinVoice has NO audit log (sensitive admin actions hit only ephemeral Pino stdout). This contract is designed fresh.

---

## What this contract fixes (and what it deliberately does NOT)

This contract fixes the **envelope** (the required shape of one audit entry) plus the **durability rules** (append-only immutability, configurable retention, a queryable surface). It does NOT fix the **schema** — the concrete audit ACTION set VARIES per project (an e-commerce app audits refunds/role-changes/impersonation; a CRM audits record edits/exports). A per-project distillation step teases out the concrete action list at build time AGAINST this envelope. The enforcement gate checks the SHAPE structurally and NEVER hardcodes an action value (`feedback_coverage_check_structural_not_substring`).

## Definition

**Audit** = a durable, admin-facing ACCOUNTABILITY record of who-did-what-when for accountability and compliance. Permanent (within the retention window). Append-only IMMUTABLE. Admin-queryable. It is DISTINCT from trace: trace = transient debug signal; audit = permanent accountability record. The whole point is an administrator can look back at (e.g.) a client's history **without getting GSD-T involved**.

## Required audit-entry envelope

Every audit entry MUST carry these fields:

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `ts` | `string` (ISO-8601) | REQUIRED | When the action happened. |
| `actor` | `string` | REQUIRED | Who — the user/admin/system id that performed the action. |
| `action` | `string` | REQUIRED | What — a PROJECT-VARYING verb (distilled per project). The gate checks presence + type, NEVER a hardcoded value. |
| `target` | `string` | REQUIRED | The entity acted on. |
| `before` | `unknown` | REQUIRED | State before the action (may be `null` for a create). |
| `after` | `unknown` | REQUIRED | State after the action (may be `null` for a delete). |
| `context` | `Record<string, unknown>` | REQUIRED | ip / session / request-id and any other accountability context. |

Unlike trace's `decision:boolean|null`, audit is a STATE-CHANGE record — the `before`→`after` pair is its defining shape and MUST be present (either side may be `null`, but the fields are required).

## Append-only immutability (non-negotiable — David's stated choice)

Audit entries are IMMUTABLE: append-only, NEVER edited or deleted in normal operation. The write helper MUST NOT expose an update-existing or delete-existing path in normal operation. The enforcement gate proves the store rejects an UPDATE/DELETE of an existing entry.

## Configurable retention window (extendable)

A DEFAULT retention window is present, and a project can EXTEND it (high-compliance → extend to years/indefinite). Retention MUST NOT be hardcoded. (Contrast trace, which may rotate/purge freely.)

### The retention prune is the SOLE sanctioned mutation, and it is BOUNDED (pre-mortem F4 — HIGH)

Append-only immutability has exactly ONE sanctioned exception: the retention `prune_expired()` path. Everything else (UPDATE, DELETE of a live row, DROP/ALTER of the immutability guard) is forbidden.

- **`prune_expired()` deletes ONLY window-EXPIRED rows** — it MUST refuse to delete a row inside the retention window, and MUST NOT be coercible (via any config value) into deleting a live/non-expired row.
- **The immutability guard itself is protected** — a `DROP TRIGGER` / `ALTER TABLE` that would remove the append-only enforcement is itself blocked (or the store is opened in a mode where schema changes on the audit table are rejected). A guarantee defeated by `DROP TRIGGER` is cosmetic, not real.
- The enforcement gate proves UPDATE/DELETE rejection **through the exact write-helper/connection the audit module exposes** — not merely at a raw-SQL layer a second connection could bypass.

## Admin query surface (mandatory — this is the whole point)

A conformant audit implementation MUST provide a query/view surface filterable by **actor / target / time** — the "look back without GSD-T" surface. A store with no queryable surface violates this contract. Because audit is admin-QUERYABLE, a no-server project needs something QUERYABLE (embedded SQLite likely, not a flat file) — the scaffolder flags this at storage-approval time.

## Default + opt-out

Audit is a default for EVERY project EXCEPT explicit opt-out declared in the project's own CLAUDE.md (e.g. WindowsVoiceTranscription wants trace but NOT audit). A project with neither an audit store NOR an explicit opt-out record → `gsd-t-verify` FAIL. A project with a valid opt-out record → verify does NOT fail it for missing audit.

## §opt-out-record — pinned opt-out record shape (load-bearing seam, M100 pre-mortem FINDING 2)

This is the EXACT, canonical shape of the audit opt-out record — the seam BOTH d4 (writer, `writeOptOut(projectDir)`) and d3 (reader, the `audit-default-except-optout` check) build to. Neither side may invent its own shape or path; both consume THIS definition.

- **Canonical file path**: `.gsd-t/audit-optout.json`, resolved relative to the project's root directory (the same `projectDir` passed to `writeOptOut`).
- **Canonical shape** (exactly these two keys, no others required):
  ```json
  {
    "auditOptOut": true,
    "reason": "<string — human-readable justification, e.g. \"trace only, no admin-facing accountability surface\">"
  }
  ```
- **Field rules**:
  - `auditOptOut` — REQUIRED, type `boolean`, MUST be exactly `true` for a valid opt-out. A file with `auditOptOut: false` (or any non-`true` value) is NOT a valid opt-out — the gate treats the project as opted IN (default) and FAILs it for missing audit if no audit store exists.
  - `reason` — REQUIRED, type non-empty `string`. A missing or empty `reason` makes the record invalid (gate treats it as no-opt-out).
- **Validity rule**: the gate's `audit-default-except-optout` check reads `.gsd-t/audit-optout.json` at the project root; the record is valid ONLY if the file exists, parses as JSON, and satisfies both field rules above. Any other file shape, path, or key name is NOT a recognized opt-out (fail-closed — an unrecognized record is treated as absent, never as an implicit pass).

## Storage (stack-adaptive, human-approval-gated)

Storage is chosen at `gsd-t-init` scaffolding time, STACK-ADAPTIVE, and the scaffolder MUST STOP for human approval presenting alternatives (has-DB → dedicated `audit_log` table; no-server → an embedded queryable store — SQLite flagged OVER a flat file because audit is queryable). The contract fixes the ENVELOPE + durability; storage is whatever fits, never silently picked.

## The no-collapse boundary (load-bearing)

Audit and TRACE are TWO DISTINCT STREAMS and MUST NEVER collapse into one. An audit record MUST NOT be reused as a trace entry and vice-versa. A single shared stream/store serving both is a contract VIOLATION. See [`trace-logging-contract.md`](trace-logging-contract.md).

## Enforcement (`gsd-t-verify`)

`gsd-t-verify` enforces this contract STRUCTURALLY:
- An audit envelope missing a REQUIRED field (`ts`/`actor`/`action`/`target`/`before`/`after`/`context`) → FAIL.
- An audit envelope with a wrong-typed required field → FAIL.
- An audit store that permits UPDATE/DELETE of an existing entry in normal operation → FAIL (not append-only).
- An audit store with no query surface filterable by actor/target/time → FAIL.
- Retention hardcoded / not extendable → FAIL.
- A project with no audit and no opt-out record → FAIL; a valid opt-out → PASS.
- A project routing trace events into the audit stream (or vice-versa) → FAIL (no-collapse).
- A novel `action` value → PASS (the gate never hardcodes actions).

## Guard map ([RULE] IDs → falsifiable acceptance)

| [RULE] | Guarantees | Falsifier (→ FAIL) | Acceptance # |
|--------|------------|--------------------|--------------|
| `audit-envelope-structural` | required fields present + typed, actions free | missing/wrong-typed field passes, or novel action fails | 4 |
| `audit-append-only-immutable` | no edit/delete of existing entries | an UPDATE/DELETE succeeds through the write helper | 7 |
| `audit-query-surface` | filterable by actor/target/time | no queryable surface, or cannot filter | 8 |
| `audit-retention-configurable` | default present, extendable | retention hardcoded / not extendable | 9 |
| `audit-default-except-optout` | default on, opt-out honored | opt-out ignored, or opt-out project fails for missing audit | 13 |
| `no-collapse` | audit ≠ trace, separate streams | a collapsed single-stream impl passes | 6 |
| `storage-approval-paused` | storage chosen via human pause; SQLite-vs-flat-file flagged | scaffolder writes a backend with no recorded approval | 1, 2 |

---

## ⚠ Divergence flags

AUDIT is DESIGNED FRESH — no inherited BinVoice model — so keep-or-supersede does not apply to it and NO `⚠ Divergence` flag is written for audit. See [`PseudoCode-AuditLogging.md`](../pseudocode/PseudoCode-AuditLogging.md).
