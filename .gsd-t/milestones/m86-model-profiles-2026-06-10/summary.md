# Milestone Complete: M86 — Model Profiles (standard/pro/premium tier-spend switch)

**Completed**: 2026-06-10 22:27 PDT
**Duration**: 2026-06-10 08:37 → 2026-06-10 22:27 (single day, single session)
**Status**: VERIFIED-WITH-WARNINGS
**Version**: 4.4.10 → 4.5.10 (minor — new feature)
**Branch**: m86-model-profiles · **Tag**: v4.5.10

## What Was Built

Three named spend profiles as a second dimension over the M85 tier policy, selected per-project,
injected at invoke time — the June-22 Fable-promo-end re-decide checklist becomes one command:

| Profile | Fable stages | Posture |
|---------|--------------|---------|
| `standard` | ZERO | probes/pre-mortem/red-team/debug-2 → opus, judge → sonnet |
| `pro` | red-team + pre-mortem + debug-cycle-2 | the 3 highest-value fable stages |
| `premium` | all 6 designated stages | the M85 full set (global default, named) |

Mechanism: `PROFILE_STAGE_TIERS` + `resolveProfile` on the policy module; per-project
`.gsd-t/model-profile.json` (+ per-stage overrides, blindness-clamped); `gsd-t model-profile`
CLI; ALL 10 workflow-invoking commands resolve the active config (bare `resolve --json` — the
stageOverrides-honoring form) and inject `overrides` via args; designated workflow stages read
`model: overrides["<stage>"] ?? "<premium-literal>"` (premium literal stays the lint-guarded
fallback); wave forwards overrides to both sub-workflow calls. NO tracked file mutates on switch.
Producers HELD bare `model: "opus"` in every profile (M82 blindness).

## Domains (4, file-disjoint, 1 wave — risk-stratified competition winner)

| Domain | Status | Key deliverables |
|--------|--------|------------------|
| m86-d1-policy-profiles-config-cli | verified | profile dimension + resolver + config + CLI + contracts (v1.1.0, seam STABLE) + 79 tests |
| m86-d2-invoker-wiring-and-workflow-forms | verified | 4 workflow `??` forms + 10 invoker wire-ins + wave forwarding + invoker fleet lint (17 tests) |
| m86-d3-drift-lint-unwrap-guard | verified | unwrap extractor (5 forms, fail-closed, bracket-key vs 6 INJECTABLE stages) + 8 mandatory negatives |
| m86-d4-surfacing-and-doc-ripple | verified | banner/statusline/status surfacing (gated, resilient) + full doc-ripple + version bump |

## Contracts

- `model-tier-policy-contract.md` v1.0.0 → **v1.1.0** (additive: profile dimension + `??`-form obligations)
- `model-profile-config-contract.md` **NEW → v1.0.0 STABLE** (config schema, resolver surface
  incl. the two resolve forms' semantics, invoke-time injection, drift-lint obligations, ownership)

## Process Highlights

- **Partition via auto-competition** (3 proposals; objective disjointness oracle picked the
  4-domain risk-stratified quarantine) — the run also banked M85 AC(c)'s last fable line (6/6).
- **M83 plan hardening: 3 pre-mortem cycles, 7→5→0 findings** — cycle 1 caught the headline
  shipping DEAD on 7 of 10 entry points (CRITICAL, the NiceNote-M5 class, pre-execute).
- **Verify: 3 Red Team fix cycles**, each HIGH real and fixed-with-killing-tests: prototype-key
  validation bypass; self-propagation clobber (fired LIVE mid-verify — update-all reverted the
  in-flight policy module); config-blind invoker resolve form (set-stage overrides never applied).
- **Live evidence, usage-frame extracted**: standard → zero fable (wf_7d445551-089); override
  beats profile (wf_54fc96ed-e98); premium red-team on fable in the verify run itself
  (wf_96b71b77-537); concrete-id vocabulary probe (wf_c9faf817-373, no 400).

## Issues / Warnings carried

1. **Do NOT run `update-all`/CPUA until v4.5.10 publishes** — the installed global 4.4.11 still
   carries the unguarded propagation loop that clobbered this repo once already.
2. Pro-profile live census on the `??` path — documented deferral (lint-proven equivalent),
   banks at the first natural pro-profile plan/debug run.

## Tests

- Suite: **1598 pass / 0 fail / 4 skip** (+~33 M86 tests incl. 26 fix-cycle killing tests)
- E2E: Playwright 3 pass / 1 placeholder skip
- Lints: M71 9/9 · M85/M86 tier-policy 60/60 · invoker-injection 17/17 · unwrap negatives 10/10

## Git

Commits: a8b00bc (define) · 5aaa3f9 (partition) · 9da982d (M85 evidence) · aa2a073 (plan) ·
50d3cfa + cb9e4ed + aaa3e5a (plan hardening ×3) · 13b9104/0877ace/635e643/adb1ba5 (D1–D4) ·
cd44b32 (integrate) · ffd6992 (census) · 0e7451b/242576b/07e3157 (verify fixes ×3) ·
38a7e02 (verdict) · completion commit + tag v4.5.10.
