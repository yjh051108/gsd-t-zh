# PseudoCode-AuditLogging

> **Subject:** AuditLogging — the framework-default AUDIT substrate every new GSD-T project (except explicit
> opt-out) is born with: the audit-entry envelope, append-only immutability, configurable retention, the
> admin query surface, and the stack-adaptive human-approval-gated storage seam. Milestone: **M100 —
> Universal Trace + Audit Logging (framework defaults)**. `[Title]` is the SUBJECT, not the milestone id.
> The trace substrate lives in its sibling doc [`PseudoCode-TraceLogging.md`](PseudoCode-TraceLogging.md).
> Governed by [`audit-logging-contract.md`](../contracts/audit-logging-contract.md). **DESIGNED FRESH — no
> BinVoice template.**

---

## Intention

> **Intention (David).** An administrator needs to look back at (e.g.) a client's history when there's an
> issue — WITHOUT getting GSD-T involved — and to satisfy compliance. This is DISTINCT from trace: trace is
> a transient debugging signal stream; audit is a durable, admin-readable record of who-did-what for
> accountability. BinVoice has NONE — sensitive admin actions (user creation, "Login As" impersonation,
> activation clicks) hit only ephemeral Pino stdout: no persisted table, no admin history UI, no lookback
> query surface. So audit is DESIGNED FRESH.
>
> **The sharpened ask.** Bake audit into GSD-T as a framework default (every project EXCEPT explicit
> opt-out) so every future project is BORN with a durable accountability record. The INFRASTRUCTURE is
> uniform (one envelope, append-only, one query surface, one verify check); the SCHEMA varies (the audited
> ACTIONS an e-commerce app records ≠ a CRM's). The contract fixes the ENVELOPE; a per-project distillation
> step teases out the concrete action list at the right build stage.
>
> **The trace-vs-audit distinction is load-bearing — never collapse.** Trace = transient debug signal (may
> rotate/purge freely, PII-barred). Audit = permanent accountability record (append-only, retention-
> windowed, admin-viewable). BinVoice's admin "Trace" view is explicitly NOT an audit log; repeating that
> conflation is the exact anti-pattern to avoid.
>
> **Append-only + configurable retention (my choice).** Entries are IMMUTABLE — append-only, never
> edited/deleted in normal operation — with a default retention period a project can EXTEND (high-compliance
> → years/indefinite). The whole point is admin-QUERYABLE: there must be a query/view surface filterable by
> actor/target/time.
>
> **Storage: stack-adaptive, PAUSE for human approval.** Same rule as trace — has-DB → a dedicated
> `audit_log` table; no-server → a local queryable store. Since audit is admin-QUERYABLE, a no-server
> project needs something QUERYABLE (embedded SQLite likely, not a flat file) — flag this at approval time.
>
> **Risk-first sequencing is the decision I signed off on.** Audit's own novel piece — durability =
> append-only immutability + configurable retention + a queryable no-server store, with NO BinVoice template
> — is Tier 2 (medium-high risk: a silent failure here, an "append-only" store that's actually editable or
> a flat file that can't be queried, defeats the compliance purpose invisibly). Prove the immutable-append +
> admin-query surface against a real embedded SQLite store before the mechanical rules/pilot land on top.

---

## Mechanism

Pseudocode grounds in EXISTING GSD-T conventions: `gsd-t-init` scaffolding steps, `bin/<tool>.cjs` CLIs,
and the `gsd-t-verify` gate. The exact final envelope field set, the default retention window value, and
the exact per-stack storage menu are DEFERRED to plan-time-against-real-inputs; this is a designed-fresh
artifact ratified at Altitude-2 contract sign-off.

```
# ============================================================
# THE AUDIT ENVELOPE (contract-fixed; action set is per-project)
# ============================================================

TYPE AuditRecord = {
    ts:       string,                # ISO-8601                         [RULE] audit-envelope-structural
    actor:    string,                # WHO — user/admin/system id
    action:   string,                # WHAT — PROJECT-VARYING verb; gate checks presence+type, not value
    target:   string,                # the entity acted on
    before:   unknown,               # state before (null for a create)
    after:    unknown,               # state after  (null for a delete)
    context:  Record<string,unknown> # ip / session / request-id + accountability context
}

# ============================================================
# THE WRITE HELPER (append-only; NO edit/delete in normal operation)
# ============================================================

PROCEDURE audit(actor, action, target, before, after, context):
    record = AuditRecord{ ts: now_iso(), actor, action, target, before, after, context }
    store().append(record)                         # append-only — the ONLY mutation exposed
    # NO update_existing(), NO delete_existing()    [RULE] audit-append-only-immutable

# ============================================================
# THE ADMIN QUERY SURFACE (the whole point — "look back without GSD-T")
# ============================================================

PROCEDURE query_audit({actor?, target?, from?, to?}):
    RETURN store().filter(byActor(actor), byTarget(target), byTimeRange(from,to))
    # MUST be filterable by actor / target / time      [RULE] audit-query-surface

# ============================================================
# RETENTION (configurable, extendable — never hardcoded)
# ============================================================

VAR retention_window = project_config("audit.retention") OR DEFAULT_WINDOW  # extendable to indefinite
PROCEDURE prune_expired():                          # only expired-by-window entries; NEVER an ad-hoc delete
    store().drop_where(ts < now() - retention_window)  # [RULE] audit-retention-configurable

# ============================================================
# DEFAULT + OPT-OUT
# ============================================================

PROCEDURE audit_required(project):
    IF project_claude_md_declares_optout(project): RETURN false   # WindowsVoiceTranscription case
    RETURN true                                     # default: every project        [RULE] audit-default-except-optout

# ============================================================
# THE STORAGE SEAM (stack-adaptive; scaffolder PAUSES; SQLite-over-flat-file flagged)
# ============================================================

PROCEDURE scaffold_audit_storage(stack):            # runs INSIDE gsd-t-init (only if audit_required)
    alternatives = propose_by_stack(stack)          # has-DB -> audit_log table; no-server -> embedded SQLite
    flag_queryability(alternatives)                 # audit is QUERYABLE -> SQLite over flat-file, surfaced
    choice = STOP_AND_ASK_HUMAN(alternatives)       # [RULE] storage-approval-paused — never silently pick
    record_choice(project_claude_md, choice)        # recorded; re-run respects it
    RETURN build_append_only_store(choice)

# ============================================================
# VERIFY ENFORCEMENT (structural — NEVER hardcodes an action)
# ============================================================

PROCEDURE verify_audit(project):
    IF NOT audit_required(project) AND NOT scaffolded(project): PASS   # valid opt-out
    IF audit_required(project) AND NOT scaffolded(project) AND NOT optout(project): FAIL
    FOR each required field in [ts, actor, action, target, before, after, context]:
        IF field absent OR wrong-typed in project's audit records: FAIL   # [RULE] audit-envelope-structural
    IF store permits UPDATE/DELETE of an existing entry in normal op: FAIL # [RULE] audit-append-only-immutable
    IF no query surface filterable by actor/target/time: FAIL             # [RULE] audit-query-surface
    IF retention hardcoded / not extendable: FAIL                         # [RULE] audit-retention-configurable
    IF trace events routed into the audit stream (or vice-versa): FAIL    # [RULE] no-collapse
    # a NOVEL action value PASSES — the gate never enumerates actions
```

---

## One-breath table

| Actor | One-breath responsibility | Guard |
|-------|---------------------------|-------|
| `audit()` write helper | append one immutable record; expose NO edit/delete in normal op | `audit-append-only-immutable` |
| `query_audit()` | filter history by actor / target / time (the admin lookback surface) | `audit-query-surface` |
| `prune_expired()` | drop only window-expired entries; retention configurable/extendable | `audit-retention-configurable` |
| `audit_required()` | default on; honor explicit CLAUDE.md opt-out | `audit-default-except-optout` |
| `scaffold_audit_storage` | propose per-stack, flag SQLite-over-flat-file, STOP for approval, record choice | `storage-approval-paused` |
| `verify_audit` | structural envelope + append-only + query-surface + opt-out + no-collapse | `audit-envelope-structural`, `no-collapse` |
| per-project distillation | tease out the concrete action list from the PLAN, against the envelope | grounded-not-confabulated |

---

## Guard map ([RULE] IDs → falsifiable acceptance)

| [RULE] | What it guarantees | Falsifier (→ FAIL) | Acceptance # |
|--------|--------------------|--------------------|--------------|
| `audit-envelope-structural` | required fields present+typed; actions free | missing/wrong-typed field passes, OR a novel-action envelope fails | 4 |
| `audit-append-only-immutable` | no edit/delete of existing entries in normal op | an UPDATE/DELETE succeeds through the write helper | 7 |
| `audit-query-surface` | filterable by actor/target/time | no queryable surface, or cannot filter | 8 |
| `audit-retention-configurable` | default present, extendable | retention hardcoded / not extendable | 9 |
| `audit-default-except-optout` | default on; opt-out honored | opt-out ignored, OR opt-out project fails for missing audit | 13 |
| `storage-approval-paused` | storage chosen via human pause; SQLite-vs-flat-file flagged | scaffolder writes a backend with no recorded approval | 1, 2 |
| `no-collapse` | audit ≠ trace, separate streams | a collapsed single-stream impl passes verify | 6 |

---

## ⚠ Divergence flags (keep-or-supersede)

**AUDIT is DESIGNED FRESH — there is NO inherited BinVoice model to keep or supersede** (BinVoice has no
audit log; its admin actions hit only ephemeral Pino stdout). Therefore the keep-or-supersede protocol
finds NO inherited audit model and NO `⚠ Divergence` flag is written for audit. Every audit design decision
above is a fresh intention ratified at Altitude-2 contract sign-off, not an inheritance.

---

## Appendix — sequencing, scope fence, distillation

**Risk-first tiers (the signed-off sequencing) — audit's stake in each:**
- **Tier 0** — the shared storage-approval scaffolder PAUSE (trace + audit share it). For audit it also
  flags SQLite-over-flat-file (audit is queryable).
- **Tier 1** — the verify-gate envelope enforcement over per-project actions (structural; also asserts the
  append-only/immutability property is declared).
- **Tier 2** — audit durability = append-only immutability + configurable retention + queryable no-server
  store (audit's own novel piece; NO template). Prove the immutable-append + admin-query surface against a
  real embedded SQLite store BEFORE the mechanical parts.
- **Tier 4** — the CLAUDE.md hard rule (default except opt-out) + the gsd-t-init audit store copy + the
  per-project action distillation + the UMI audit pilot (mechanical, last).

**Per-project distillation (grounded, not confabulated):** the concrete audit ACTIONS are distilled from
the project's PLAN at build time, against this envelope. For UMI-Automation they are distilled from its
PodCoach human draft-approval steps (who approved/rejected a draft, before→after) — a HYPOTHESIS to confirm
against UMI's actual `docs/plan.md` at build time, NOT hardcoded (`feedback_no_confabulated_examples`).

**Scope fence (locked):** IN: the audit substrate (contract + store + write helper + append-only + retention
+ admin query surface + verify check + distillation + UMI audit pilot). OUT: the trace substrate (sibling
doc), the brownfield migration command, backlog #43 (build-number). BinVoice is READ-ONLY reference. UMI is
a greenfield ADDITIVE build — essentially no destructive changes.
