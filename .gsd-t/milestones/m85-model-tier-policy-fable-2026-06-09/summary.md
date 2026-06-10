# Milestone Complete: M85 — Model-Tier Policy (single source of truth) + Fable 5 Integration

**Completed**: 2026-06-09 18:02 PDT
**Duration**: 2026-06-09 14:26 PDT → 2026-06-09 18:02 PDT (single day, single session)
**Status**: VERIFIED-WITH-WARNINGS (round 2; both warnings closed post-verdict in 0203b10)
**Version**: 4.3.10 → 4.4.10 (minor) · Tag `v4.4.10`

## What Was Built
- `bin/gsd-t-model-tier-policy.cjs` — the SINGLE source of truth for model-tier assignments: frozen `MODEL_IDS` (opus→claude-opus-4-8, fable→claude-fable-5, sonnet, haiku), frozen `STAGE_TIERS` (7 keys: 6 fable + producers held opus), `requiresThinkingOmitted` predicate (Fable HTTP-400 breaking change encoded once; accepts the live bracket-suffix form), `resolve()` + CLI resolver (M69 envelope), `gsd-t model-tier-policy` dispatcher + dual bin-propagation registration.
- Live-bug fix: `bin/gsd-t-parallel.cjs` alias map was STALE (`opus → claude-opus-4-7`); now `require()`s the policy module — zero bare model-id literals. Cache-warm probe model pinning fixed (`--model` flag; the env var was measured silently ignored).
- `bin/model-selector.js`: FABLE tier + `cycle_2_escalation` rule via the existing signature; debug default byte-identical pre-M85.
- Five Fable workflow assignments (producers HELD at opus — M82 blindness): M84 probes, competition judge, M83 pre-mortem, Red Team (non-skippable), debug cycle-2 ternary.
- `test/m85-workflow-tier-policy-lint.test.js` — M71-family drift enforcer: 8-file discovery, stage-key→label mapping with per-stage non-empty match, negative drift fixtures, real-file + debug-ternary meta-tests (44 assertions).
- MEASURED shadow A/B (AC e): Fable single-draft TIED judged 3-Opus competition at 42% cost ($4.74 vs $11.24; blind order-reversed referees split → position bias > quality gap; n=1, caveats recorded). Runs `wf_d6b75c28-7d4` / `wf_5d8bc13a-293`.
- Bonus artifact: the settled L1–L5 Session Retrospective Agent design (`.gsd-t/CONTEXT.md`, 271e5a9) produced by the measurement's competition run.

## Domains
| Domain | Tasks | Key Deliverables |
|--------|-------|------------------|
| m85-d1-tier-policy-module | 4/4 | policy module + resolver CLI + 20→25 tests + STABLE contract |
| m85-d2-bin-consumers-alias-selector | 3/3 | alias fix via require(), --model cache-warm fix, FABLE tier + 57 tests |
| m85-d3-workflow-fable-assignments | 4/4 | 5 fable literals + producer invariant + live forcing evidence |
| m85-d4-lint-shadow-docs | 3/3 | drift lint 44/44, measured A/B verdict, full doc ripple |

## Contracts
- `model-tier-policy-contract.md` v1.0.0 — NEW, STABLE
- `model-selection-contract.md` v1.0.0 → v1.1.0

## Process Record (notable)
- Plan survived 4 adversarial pre-mortem cycles (13 findings absorbed) + explicit HUMAN gate adjudication (the M83 gate has no quiescence criterion — TD-294). Pre-mortem cycle findings discovered 2 real defects by measurement: the ignored ANTHROPIC_MODEL env pin and the unwired resolver surface (caught at verify round 1 by Red Team as HIGH).
- AC(c) evidence ledger: 5 of 6 fable stage lines captured live from transcript usage frames (probe, judge+producers-opus same-run, pre-mortem 21,211-token run, debug cycle-1-opus/cycle-2-fable induced run, Red Team in verify round 2). partition-probe = documented gap, banks at first M86 partition.
- New techdebt registered from live observation: TD-294 (gate quiescence), TD-295 (narrative-vs-verdict wiring), TD-296 (stale plan brief).

## Tests
- Suite: 1466 tests, 1462 pass / 0 fail / 4 env-skips. E2E: 3/4 (+1 intentional placeholder skip). Zero shallow tests (QA-audited twice).

## Git Tag
`v4.4.10`
