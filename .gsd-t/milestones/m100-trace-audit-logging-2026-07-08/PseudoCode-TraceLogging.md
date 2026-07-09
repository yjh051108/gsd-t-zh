# PseudoCode-TraceLogging

> **Subject:** TraceLogging — the framework-default TRACE substrate every new GSD-T project is born with:
> the trace-entry envelope, the runtime + env toggle, the PII bar, the fire-and-forget emitter, and the
> stack-adaptive human-approval-gated storage seam. Milestone: **M100 — Universal Trace + Audit Logging
> (framework defaults)**. `[Title]` is the SUBJECT, not the milestone id. The audit substrate lives in its
> sibling doc [`PseudoCode-AuditLogging.md`](PseudoCode-AuditLogging.md). Governed by
> [`trace-logging-contract.md`](../contracts/trace-logging-contract.md).

---

## Intention

> **Intention (David).** There is NEVER enough detail. Multi-day debugging sessions (BinVoice,
> WindowsVoiceTranscription) could have been minutes if a full trace stream had been visible. If a result
> happens in the running app — a data packet, an event, a transmission, an LLM call, an error/catch, a
> decision (candidate-vs-chosen) — it MUST be traceable when there's a bug. This must be a BIRTHRIGHT of
> every project, not a thing re-invented per app.
>
> **The sharpened ask.** Bake trace into GSD-T as a framework default so every future project is BORN with
> it. The INFRASTRUCTURE is uniform (one envelope, one toggle, one storage seam, one verify check); the
> SCHEMA varies (the trace CATEGORIES a browser extension emits ≠ a transcription app's). The contract
> fixes the ENVELOPE; a per-project distillation step teases out the concrete category list at the right
> build stage.
>
> **Trace is a DEBUGGING SIGNAL STREAM — not an audit log, not PII storage.** This self-declaration is
> load-bearing. Trace is transient (may rotate/purge freely) and PII-barred (HC-003: no buyer emails,
> phones, addresses). The trace-vs-audit distinction must NEVER collapse — BinVoice's admin "Trace" view
> is explicitly NOT an audit log, and repeating that conflation is the exact anti-pattern to avoid. The
> audit substrate is a separate stream, in the sibling doc.
>
> **Toggle: runtime flag + env override (my choice).** Trace is a LOT of data — on when debugging/hunting
> unknown issues, off in normal runs. So it needs both the one-line in-module `setTraceEnabled()` seam AND
> an env var (`TRACE=1`) so it can flip without code.
>
> **Storage: stack-adaptive, but PAUSE for human approval.** The scaffolder proposes per detected stack
> (has-DB → a `trace_logs` table; no-server → a local rotating JSONL file) but must STOP and get my
> approval of the storage choice, presenting the alternatives — never silently pick.
>
> **Risk-first sequencing is the decision I signed off on.** The scope is locked; the SEQUENCING is the
> lever. Front-load the two genuinely novel, unproven pieces so a failure is cheap and early: (Tier 0) the
> storage scaffolder that STOPS for human approval — it fights the Level-3 full-auto default and is the one
> sanctioned pause; and (Tier 1) the verify-gate envelope enforcement over per-project-VARYING categories —
> a structural check, never a hardcoded category list. Both are cheap to spike in isolation and
> catastrophic to discover broken after the CLAUDE.md rules + init scaffold + UMI pilot are built on top.

---

## Mechanism

Pseudocode grounds in EXISTING GSD-T conventions: `gsd-t-init` scaffolding steps, `bin/<tool>.cjs` CLIs
returning a JSON envelope, the `gsd-t-verify` gate, and the verified BinVoice `TraceRecord` DTO shape.
Concrete numeric caps (JSONL rotation size) and the exact per-stack storage menu are DEFERRED to
plan-time-against-real-inputs.

```
# ============================================================
# THE TRACE ENVELOPE (contract-fixed; category set is per-project)
# ============================================================

TYPE TraceRecord = {
    ts:        string,               # ISO-8601                        [RULE] trace-envelope-structural
    category:  string,               # member of PROJECT-VARYING set — gate checks presence+type, not value
    decision:  boolean | null,       # decision at this point, or null if not a decision
    detail:    string,               # human-readable one-liner
    key?:      string,               # optional correlation key
    status?:   number,               # optional status code
    data?:     Record<string,unknown># optional payload — SUBJECT TO THE PII BAR
}

# ============================================================
# THE EMITTER (fire-and-forget; NEVER throws into caller)
# ============================================================

PROCEDURE trace(category, detail, {decision=null, key, status, data}):
    IF NOT isTraceEnabled(): RETURN                 # off in normal runs; zero cost
    assert_no_pii(data)                             # [RULE] trace-pii-barred — reject buyer email/phone/addr
    record = TraceRecord{ ts: now_iso(), category, decision, detail, key, status, data }
    TRY:
        sink().write(record)                        # storage seam (chosen at scaffold, approval-gated)
    CATCH:
        RETURN                                      # [RULE] trace-fire-and-forget — never break the app

# ============================================================
# THE TOGGLE (runtime seam + env override — both required)
# ============================================================

VAR _traceOn = env("TRACE") == "1"                  # env override seeds initial state
PROCEDURE setTraceEnabled(on): _traceOn = on        # one-line in-module runtime seam (BinVoice pattern)
PROCEDURE isTraceEnabled(): RETURN _traceOn         # [RULE] trace-toggle-runtime-and-env

# ============================================================
# THE STORAGE SEAM (stack-adaptive; scaffolder PAUSES for human approval)
# ============================================================

PROCEDURE scaffold_trace_storage(stack):            # runs INSIDE gsd-t-init
    alternatives = propose_by_stack(stack)          # has-DB -> trace_logs table; no-server -> rotating JSONL
    # THE ONE SANCTIONED PAUSE — never silently pick    [RULE] storage-approval-paused
    choice = STOP_AND_ASK_HUMAN(alternatives)       # present alternatives, require a decision
    record_choice(project_claude_md, choice)        # recorded so re-run respects it (deterministic resume)
    RETURN build_sink(choice)

PROCEDURE sink():                                   # dormant OR local-file — never silent-lose a local sink
    IF no_endpoint_and_no_local_store(): RETURN dormant_noop_sink()   # ⚠ Divergence (see below)
    RETURN configured_sink()

# ============================================================
# VERIFY ENFORCEMENT (structural — NEVER hardcodes a category)
# ============================================================

PROCEDURE verify_trace(project):
    FOR each required field in [ts, category, decision, detail]:
        IF field absent OR wrong-typed in project's trace records: FAIL   # [RULE] trace-envelope-structural
    IF any trace field is PII-shaped (email/phone/address): FAIL          # [RULE] trace-pii-barred
    IF audit events routed into the trace stream (or vice-versa): FAIL    # [RULE] no-collapse
    # a NOVEL category value PASSES — the gate never enumerates categories
```

---

## One-breath table

| Actor | One-breath responsibility | Guard |
|-------|---------------------------|-------|
| `trace()` emitter | build the envelope, bar PII, write to the sink, swallow every error | `trace-fire-and-forget`, `trace-pii-barred` |
| `setTraceEnabled()` / `TRACE=1` | flip the channel at runtime AND from the environment | `trace-toggle-runtime-and-env` |
| `scaffold_trace_storage` | propose per-stack storage, STOP for human approval, record the choice | `storage-approval-paused` |
| `sink()` | dormant-or-local when no endpoint; never silently lose a configured local sink | `trace-sink-dormant-or-local` |
| `verify_trace` | structural envelope + PII + no-collapse check, never a hardcoded category | `trace-envelope-structural`, `no-collapse` |
| per-project distillation | tease out the concrete category list from the PLAN, against the envelope | grounded-not-confabulated |

---

## Guard map ([RULE] IDs → falsifiable acceptance)

| [RULE] | What it guarantees | Falsifier (→ FAIL) | Acceptance # |
|--------|--------------------|--------------------|--------------|
| `trace-envelope-structural` | required fields present+typed; categories free | missing/wrong-typed field passes, OR a novel-category envelope fails | 3 |
| `trace-pii-barred` | no buyer PII in any field incl. `data` | an email/phone/address field passes | 5 |
| `trace-toggle-runtime-and-env` | both `setTraceEnabled()` and `TRACE=1` exist | either toggle path absent | 2, 15 |
| `trace-fire-and-forget` | emitter never throws into caller | an emit path that can throw into the app | 17(module test) |
| `storage-approval-paused` | storage chosen via human pause; choice recorded | scaffolder writes a backend with no recorded approval; re-run re-prompts | 1, 2 |
| `trace-sink-dormant-or-local` | dormant OR local file, never silent-lose | a configured local sink silently dropped | 15 |
| `no-collapse` | trace ≠ audit, separate streams | a collapsed single-stream impl passes verify | 6 |

---

## ⚠ Divergence flags (keep-or-supersede over the inherited BinVoice trace model)

The inherited models come from BinVoice `src/trace/` (READ-ONLY reference) — each inheritance is a
HYPOTHESIS about intent. Keep-or-supersede ledger:

**KEPT (no flag):**
- **The TraceRecord envelope** `{ts, category, decision:boolean|null, detail, key?, status?, data?}` — KEEP.
  It is the canonical reference implementation; the brief calls it the canonical REFERENCE.
- **The `decision:boolean|null` field** — KEEP. A trace point may or may not be a decision.
- **The one-line `setTraceEnabled()` / `isTraceEnabled()` runtime seam** — KEEP. The `TRACE=1` env override
  is an EXTENSION alongside the runtime flag (KEEP-plus-extend), not a supersede of the seam → no flag on
  the seam itself.
- **The fire-and-forget / NEVER-throws-into-caller emitter contract** — KEEP. A debug channel must never
  break the app.

**SUPERSEDED (flag written):**

⚠ Divergence: trace-sink-dormant-or-local — supersedes shipped soft-dormant-when-no-endpoint. Reason: for a framework default the channel must become "dormant OR local file" rather than a pure no-op, so a desktop/no-server project still captures trace to a local rotating store.

⚠ Divergence: storage-approval-paused / storage seam — supersedes shipped client-batched-POST → server-bulk-insert → newest-first admin viewer transport. Reason: that transport is BinVoice-web-specific; a stack-adaptive framework default abstracts storage behind a human-approval-gated seam so each project's storage fits its stack, never a hardcoded web transport.

---

## Appendix — sequencing, scope fence, distillation

**Risk-first tiers (the signed-off sequencing) — trace's stake in each:**
- **Tier 0** — the storage-approval scaffolder PAUSE (trace + audit share it; the one sanctioned pause). HIGHEST uncertainty: it fights Level-3 full-auto. Prove standalone with a fake/echo scaffold BEFORE any envelope work.
- **Tier 1** — the verify-gate envelope enforcement over per-project categories (structural, no hardcoded list). Prove the predicate on synthetic envelopes (valid, missing-field, wrong-type, PII-in-trace) before wiring.
- **Tier 4** — the CLAUDE.md hard rule + the gsd-t-init trace module copy + the per-project category distillation + the UMI trace pilot (mechanical, last).

**Per-project distillation (grounded, not confabulated):** the concrete trace CATEGORIES are distilled from the project's PLAN at build time, against this envelope. For UMI-Automation they are distilled from its REST/JSON integration points (Grain / Airtable / Anthropic / Apify) — a HYPOTHESIS to confirm against UMI's actual `docs/plan.md` at build time, NOT hardcoded to BinVoice's set (`feedback_no_confabulated_examples`).

**Scope fence (locked):** IN: the trace substrate (contract + module + toggle + PII bar + storage seam + verify check + distillation + UMI trace pilot). OUT: the audit substrate (sibling doc), the brownfield migration command, backlog #43 (build-number). BinVoice is READ-ONLY reference, never modified.
