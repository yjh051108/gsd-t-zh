# Logging Schema-Distillation Contract

**Version:** 1.0.0 DRAFT (M100 partition)
**Owner:** d5-defaults-migration-pilot
**Consumers:** d2-trace-machinery (trace-half distiller), d4-audit-machinery (audit-half distiller), the UMI pilot build-into.
**Milestone:** M100 — Universal Trace + Audit Logging (framework defaults).

---

## Purpose

Fixes HOW a per-project concrete SCHEMA (trace CATEGORY set, audit ACTION set) is distilled AGAINST the universal envelopes at build time — WITHOUT the envelope gate ever hardcoding a category/action. The envelope contracts fix the SHAPE; this contract fixes the per-project SPECIALIZATION step.

## Two halves, never collapsed

| Half | Produced by | Distills | Source of truth |
|------|-------------|----------|-----------------|
| trace categories | d2's `bin/gsd-t-trace-distill.cjs` | the concrete trace CATEGORY list | the project's PLAN / integration points |
| audit actions | d4's `bin/gsd-t-audit-distill.cjs` | the concrete audit ACTION list + opt-out convention | the project's PLAN / human-decision steps |

d5 OWNS this contract; d2 and d4 each own ONE half's distiller module. The two distillers NEVER share a file, mechanizing no-collapse.

## Distillation rules

- Distill FROM the project's own plan/integration points — NEVER confabulate an example (`feedback_no_confabulated_examples`). An unstated category/action is a QUESTION, not an invented value.
- Categories/actions are project-VARYING data, fed to the modules — they are NOT baked into the envelope gate (d3 stays value-blind).
- The distilled sets are recorded in the project's own docs (per-project), not in the GSD-T framework.

## UMI pilot grounding (Wave 4)

- Trace categories distilled from UMI-Automation's real REST integration points: Grain / Airtable / Anthropic / Apify calls.
- Audit actions distilled from UMI's real human decision points: PodCoach draft-approval steps (who approved/rejected a draft, before→after).
- Both grounded against UMI's ACTUAL plan; both streams present; additive build-into (no existing logging to reconcile).

## Consumed contracts

- [`trace-logging-contract.md`](trace-logging-contract.md), [`audit-logging-contract.md`](audit-logging-contract.md) — the envelopes distillation specializes against.
- [`logging-scaffold-seam-contract.md`](logging-scaffold-seam-contract.md) — the storage the distilled schemas write into.
