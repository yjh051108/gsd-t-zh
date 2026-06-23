# Verification Report — 2026-06-10

## Milestone: M86 — Model Profiles (standard/pro/premium tier-spend switch)

## Verdict: VERIFIED-WITH-WARNINGS

Orthogonal triad run: `wf_96b71b77-537` (premium envelope injected per the M86 invoker pattern —
the run itself is SC(e) evidence). Three Red Team fix cycles; final scoped re-validation clean.

## Triad Results (no category collapse)

| Validator | Model | Result |
|-----------|-------|--------|
| /code-review ultra | opus | 2 important + 4 nits — ALL resolved in fix cycle 1 |
| Red Team | **fable** (injected premium override — live AC evidence) | r1 FAIL (1 HIGH, 2 MED, 3 LOW) → fixed; r2 FAIL (1 NEW HIGH — fired live) → fixed; r3 FAIL (1 NEW HIGH) → fixed; scoped re-validation: closed=true, 0 regressions |
| QA | sonnet | GREEN — zero shallow tests, contract compliance confirmed |

## Red Team fix-cycle ledger

1. **r1 HIGH — prototype-key validation bypass**: `"constructor"` as a tier passed truthiness
   validation; the stage was JSON-dropped from the envelope; the workflow `?? "fable"` fallback
   billed premium on a standard profile with a CLEAN envelope. Fixed: `hasOwn()` guards on every
   map lookup + per-entry membership validation in readConfig. 4 prototype-key killing tests.
2. **r2 HIGH — self-propagation clobber (fired live mid-run)**: `gsd-t update-all` (global 4.4.11)
   copied the pre-M86 policy module over this repo's committed copy — the source repo is a
   registered project and `copyBinToolsToProject`'s COPY loop had no source-repo guard (the
   existing guard covered only the stray sweep). Fixed: `_isGsdTSourcePackage()` hoisted to guard
   the copy loop; version-skew guard in the CLI (structured error, not TypeError).
3. **r3 HIGH — config-blind invoker resolve form**: all 10 invokers documented
   `resolve --profile <active>`, which zeroes config `stageOverrides` — persisted `set-stage`
   overrides displayed in `show` but never applied on real runs. Fixed: bare `resolve --json`
   form everywhere; T10 lint check (b2) FAILS the config-blind form; contract documents both
   forms' semantics. Lead adjudication for cycle 3 over deferral recorded in the Decision Log.

## Gates

- Verify-gate (Track 1 + Track 2): PASS (2 warn-level notes: package-lock staleness, 2 dirty
  playwright artifacts outside whitelist — pre-existing working-tree noise).
- M57 CI-parity: ok (package-scripts source, `npm run test` exit 0). Build coverage: ok.
- M58 test-data purge: ok (0 purged, 0 errors, run `verify-m86`).

## Tests

- Unit/integration: **1598 pass / 0 fail / 4 skip** (final, after all 3 fix cycles; +26 new
  killing tests across the cycles).
- E2E (Playwright): 3 pass / 1 intentional placeholder skip (journey specs, via verify-gate).
- Lints: M71 runtime-native 9/9; M85/M86 tier-policy 60/60; T10 invoker-injection 17/17;
  unwrap negatives 10/10.

## Goal-Backward: PASS

Every AC carries measured or test-asserted evidence (no placeholders):
- (a) standard → ZERO fable live (`wf_7d445551-089` usage frames); premium → red-team on
  `claude-fable-5` live (this verify run's own frames, agent a3d2a462052edbbee); pro → resolver
  envelope exact + lint-proven (live ?? -path census = documented deferral, banks at first
  natural pro run).
- (b) override-beats-profile live (`wf_54fc96ed-e98`: probe on fable, rest standard).
- (c) drift lint bites both forms + bracket key + combined form + wrapped-producers (8 negatives).
- (d) per-project divergence: fixture-vs-repo envelopes diverge from the same installed package.
- (e) overrides visible in args on phase AND verify surfaces, consumed live.
- (f) named defaults at every surface (banner gated to GSD-T projects, statusline, status, CLI).
- (g) M85 partition-probe ledger closed 6/6 (banked 2026-06-10 18:27).

## WARNINGS (the verdict's qualifiers)

1. **Residual until v4.5.10 publishes**: the INSTALLED global 4.4.11 still carries the unguarded
   propagation loop — do NOT run `update-all`/CPUA before publishing 4.5.10 (or restore via
   `git checkout` after).
2. Pro-profile live census on the `??` path (pre-mortem/debug-cycle-2 fable lines) — documented
   deferral, lint-proven equivalent, banks at the first natural pro-profile plan/debug run.
