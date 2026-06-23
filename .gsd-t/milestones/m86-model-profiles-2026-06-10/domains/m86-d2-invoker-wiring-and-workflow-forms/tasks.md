# Tasks: m86-d2-invoker-wiring-and-workflow-forms

> Plan-grade Shape D. QUARANTINED runtime-native surface (TD-113). Every behavioral
> task carries **Files**, **Touches**, **Acceptance criteria**, **Test**. This domain
> WRITES ONLY workflow source + invoker commands; it NEVER touches the lint (D3) that
> verifies it, so a defect here cannot mask a guard defect. Seam: D1's resolver
> envelope (`gsd-t model-profile resolve --profile <p> --json`).

## Files Owned

- `templates/workflows/gsd-t-phase.workflow.js`
- `templates/workflows/gsd-t-verify.workflow.js`
- `templates/workflows/gsd-t-debug.workflow.js`
- `templates/workflows/gsd-t-wave.workflow.js`
- `commands/gsd-t-partition.md`
- `commands/gsd-t-verify.md`
- `commands/gsd-t-debug.md`
- `commands/gsd-t-plan.md`
- `commands/gsd-t-milestone.md`
- `commands/gsd-t-impact.md`
- `commands/gsd-t-prd.md`
- `commands/gsd-t-design-decompose.md`
- `commands/gsd-t-doc-ripple.md`
- `commands/gsd-t-wave.md`
- `test/m86-invoker-injection.test.js`

> Pre-mortem r1 finding #1 (CRITICAL — dead-deliverable): the original 3-invoker set left the
> spend switch DEAD on plan/milestone/impact/prd/design-decompose/doc-ripple and on the
> wave-composed verify path (`gsd-t-wave.workflow.js` forwarded NO overrides and was owned by
> nobody). T8/T9/T10 below close it; the owned set above is the corrected partition.

---

### M86-D2-T1 — phase workflow `??` forms (4 designated stages)
**Touches:** `templates/workflows/gsd-t-phase.workflow.js`
**Files:** `templates/workflows/gsd-t-phase.workflow.js`
**Test:** `test/m85-workflow-tier-policy-lint.test.js` (D3's unwrap lint — validates these `??` forms read-only) + the T7 real-sandbox run
**Depends on:** D1-T1/T2 (the `overrides` map shape from the resolver).
**Contract refs:** `model-profile-config-contract.md` §Workflow `??`-Form Obligation.

`JSON.parse` `args` (a STRING — TD-113); read `const overrides = parsed.overrides ?? {}`.
Convert four stages to the EXACT form D3 unwraps (`model: overrides["<stage>"] ?? "<premium-literal>"`):
- solution-space-probe (~L172): `model: overrides["solution-space-probe"] ?? "fable"`
- partition-probe (~L198): `model: overrides["partition-probe"] ?? "fable"`
- competition-judge (~L476): `model: overrides["competition-judge"] ?? "fable"`
- pre-mortem (~L656): `model: overrides["pre-mortem"] ?? "fable"`
Leave producers (~L432) a BARE `model: "opus"` (M82 HELD — NOT wrapped). Stay runtime-native
(NO require/fs/path/child_process/process). Default `overrides` to `{}` so the premium literal
fallback applies when no invoker injects (byte-identical to M85 today).

**Acceptance criteria:**
- The four designated stages read the exact `model: overrides["<stage>"] ?? "fable"` form; the
  producers line stays bare `model: "opus"`.
- No require/fs/path/child_process/process introduced (the M71 runtime-native lint stays green).
- D3's unwrap lint PASSES against this file (cross-domain check at verify).
- Verified by `node --test test/m85-workflow-tier-policy-lint.test.js` +
  `node --test test/m71-workflow-runtime-native-lint.test.js`.

### M86-D2-T2 — verify workflow `??` form (red-team)
**Touches:** `templates/workflows/gsd-t-verify.workflow.js`
**Files:** `templates/workflows/gsd-t-verify.workflow.js`
**Test:** `test/m85-workflow-tier-policy-lint.test.js` + the T7 real-sandbox run
**Depends on:** D1-T1/T2.
**Contract refs:** `model-profile-config-contract.md` §Workflow `??`-Form Obligation.

`JSON.parse` args, read `overrides`. Convert red-team (~L307):
`model: overrides["red-team"] ?? "fable"`. Leave code-review-ultra + synthesis as their existing
`"opus"` literals (NOT designated stages). Stay runtime-native; default `overrides` to `{}`.

**Acceptance criteria:**
- red-team reads `model: overrides["red-team"] ?? "fable"`; ultra/synthesis unchanged.
- No require/fs reintroduced (M71 lint green).
- D3's unwrap lint PASSES against this file.
- Verified by `node --test test/m85-workflow-tier-policy-lint.test.js` + M71 lint.

### M86-D2-T3 — debug workflow cycle-2 `??` form
**Touches:** `templates/workflows/gsd-t-debug.workflow.js`
**Files:** `templates/workflows/gsd-t-debug.workflow.js`
**Test:** `test/m85-workflow-tier-policy-lint.test.js` + the T7 real-sandbox run
**Depends on:** D1-T1/T2.
**Contract refs:** `model-profile-config-contract.md` §Workflow `??`-Form Obligation.

`JSON.parse` args, read `overrides`. Convert the cycle ternary (~L97):
`model: cycle === 1 ? "opus" : (overrides["debug-cycle-2"] ?? "fable")`. Cycle-1 stays a bare
`"opus"` literal (NOT a designated stage). Stay runtime-native; default `overrides` to `{}`.

**Acceptance criteria:**
- The ternary reads `cycle === 1 ? "opus" : (overrides["debug-cycle-2"] ?? "fable")`.
- No require/fs reintroduced (M71 lint green).
- D3's unwrap lint PASSES against this file (recognizes the cycle-2 `??` branch).
- Verified by `node --test test/m85-workflow-tier-policy-lint.test.js` + M71 lint.

### M86-D2-T4 — partition invoker wire-in
**Touches:** `commands/gsd-t-partition.md`
**Files:** `commands/gsd-t-partition.md`
**Test:** the T7 real-sandbox run (asserts `overrides` appears in the args the invoker passes — SC(e))
**Depends on:** D1-T2/T3 (the resolver CLI), D2-T1 (the workflow that reads `overrides`).
**Contract refs:** `model-profile-config-contract.md` §Invoke-Time Injection (M69).

At invoke time, call D1's resolver (`gsd-t model-profile resolve --profile <active> --json`),
build the `overrides` map (stage → concrete model id), and inject it into the phase workflow via
`args` alongside the existing partition args (M69 path; `scriptPath` resolved via
`gsd-t workflow-path gsd-t-phase`). Document the new `overrides` arg in the command body.

> **Vocabulary BANKED (pre-mortem r1 #4 resolved empirically, 2026-06-10):** the sandbox
> runtime ACCEPTS concrete model ids in `model:` injected via args — probe run
> `wf_c9faf817-373`, usage frames: `claude-fable-5` (concrete, no 400) + `claude-opus-4-8`
> (concrete) + alias control all routed correctly. The contract's concrete-id `overrides`
> vocabulary stands; no pivot needed. T7 re-confirms incidentally per profile run.

**Resolver-failure semantics (pre-mortem c2 #2 HIGH — applies to T4/T5/T6/T8/T9, the canonical
injection-block pattern):** the injection block MUST define what happens when the resolve call
FAILS (stale global binary without the `model-profile` subcommand — the
`project_global_bin_propagation_gap` class; `{ok:false}` envelope; spawn error). Defined behavior:
**do NOT silently proceed on the premium fallback.** Either HALT with blocked-needs-human, or
proceed ONLY with a LOUD surfaced warning that NAMES the effective posture (e.g.
`⚠ model-profile resolver unavailable — running on PREMIUM fallback literals (configured profile
unknown)`). A configured-standard project silently billing premium fable post-promo is the exact
inverse of SC(f) on the path that gates ALL spend. This failure-handling clause is part of the
pattern every invoker carries; T10's lint asserts its presence.

**Acceptance criteria:**
- The invoker resolves the active profile and injects an `overrides` map into the phase workflow
  `args`; the args shape matches `gsd-t-phase.workflow.js`'s `meta.phases` + the new `overrides`
  field (the dead-export fix — SC(e)).
- Verified by T7's real-sandbox partition run (the resolved `overrides` is visible in the passed
  args, and the `⚙ [model]` lines match the active profile).

### M86-D2-T5 — verify invoker wire-in
**Touches:** `commands/gsd-t-verify.md`
**Files:** `commands/gsd-t-verify.md`
**Test:** the T7 real-sandbox run (verify run shows red-team on the profile-resolved model)
**Depends on:** D1-T2/T3, D2-T2.
**Contract refs:** `model-profile-config-contract.md` §Invoke-Time Injection (M69).

Same pattern: resolve active profile → build `overrides` (at minimum `red-team`) → inject into the
verify workflow `args` (`scriptPath` via `gsd-t workflow-path gsd-t-verify`).

**Acceptance criteria:**
- The verify invoker injects `overrides` (incl. `red-team`) into the verify workflow args.
- Verified by T7's real-sandbox verify run (red-team runs on the profile-resolved model;
  `overrides` visible in args).

### M86-D2-T6 — debug invoker wire-in
**Touches:** `commands/gsd-t-debug.md`
**Files:** `commands/gsd-t-debug.md`
**Test:** the T7 real-sandbox run (debug cycle-2 on the profile-resolved model)
**Depends on:** D1-T2/T3, D2-T3.
**Contract refs:** `model-profile-config-contract.md` §Invoke-Time Injection (M69).

Same pattern: resolve active profile → build `overrides` (at minimum `debug-cycle-2`) → inject into
the debug workflow `args` (`scriptPath` via `gsd-t workflow-path gsd-t-debug`).

**Acceptance criteria:**
- The debug invoker injects `overrides` (incl. `debug-cycle-2`) into the debug workflow args.
- Verified by T7's real-sandbox debug run (cycle-2 on the profile-resolved model; `overrides`
  visible in args).

### M86-D2-T7 — real-sandbox profile→spend run (killing test for SC(a)/(b)/(e)/(g))
**Touches:** (verification — no new file)
**Files:** `templates/workflows/gsd-t-phase.workflow.js`, `templates/workflows/gsd-t-verify.workflow.js`, `templates/workflows/gsd-t-debug.workflow.js`, `commands/gsd-t-partition.md`, `commands/gsd-t-verify.md`, `commands/gsd-t-debug.md`
**Test:** real-sandbox workflow runs (model census extracted from live usage frames — per `feedback_workflow_must_run_in_real_sandbox`); this IS the killing observation for SC(a)
**Depends on:** D2-T1..T6, T8, T9, D1 (resolver live).
**Contract refs:** `model-profile-config-contract.md` §Profile Dimension, §Invoke-Time Injection.

Run a real-sandbox phase + verify + debug under each profile and confirm the `⚙ [model]` lines
(and the model census from live workflow usage frames) match the profile:
- `standard` → ZERO `⚙ [fable]` lines.
- `pro` → EXACTLY red-team + pre-mortem + debug-cycle-2 on fable.
- `premium` → all 6 designated stages on fable; producers on opus (M82).
Also: with `profile=pro` + override `{ "competition-judge":"fable" }`, that stage runs on fable
live while the rest of pro holds (SC(b)). This is verify's deep proof but D2 self-smokes before
handoff. NOTE — SC(g) is ALREADY SATISFIED (banked 2026-06-10 18:27, ledger closed 6/6); no
re-run needed for (g), but a premium partition run here re-confirms the partition-probe fable line
incidentally.

**Census extension (pre-mortem r1 #1):** the standard-profile leg MUST also cover the
previously-orphaned entry points: (1) a real-sandbox `/gsd-t-plan` run → ZERO fable (pre-mortem
on the standard tier); (2) a `/gsd-t-milestone` (or design-decompose) run → ZERO fable (probe +
judge on standard tiers); (3) a wave-composed verify run → red-team on the profile-resolved
model (proves T9's forwarding, not just the direct verify invoker).

**Resolver-failure leg (pre-mortem c2 #2):** one run with the resolver forced to FAIL (mask the
binary from PATH / point at a stale install lacking the subcommand) asserting the run does NOT
silently proceed on premium — either it halts, or the loud named-posture warning is visible in
the run output.

**Acceptance criteria:**
- standard/pro/premium each produce the EXACT fable-stage set above, measured from live usage
  frames (NOT from config) — SC(a).
- the 3 census-extension runs (plan, milestone/design-decompose, wave-composed verify) show the
  profile honored on every entry point — the switch is LIVE everywhere, not just the 3 original
  invokers (dead-deliverable kill).
- override-beats-profile demonstrated live — SC(b).
- the resolved `overrides` is visible in the workflow args of each run — SC(e).
- Verified by capturing the model census from the live `wf_*` transcript usage frames per run.

### M86-D2-T8 — remaining phase-invoker wire-ins (pre-mortem r1 #1 CRITICAL)
**Touches:** `commands/gsd-t-plan.md`, `commands/gsd-t-milestone.md`, `commands/gsd-t-impact.md`, `commands/gsd-t-prd.md`, `commands/gsd-t-design-decompose.md`, `commands/gsd-t-doc-ripple.md`
**Files:** `commands/gsd-t-plan.md`, `commands/gsd-t-milestone.md`, `commands/gsd-t-impact.md`, `commands/gsd-t-prd.md`, `commands/gsd-t-design-decompose.md`, `commands/gsd-t-doc-ripple.md`
**Test:** `test/m86-invoker-injection.test.js` (T10 static lint — a phase invoker lacking the injection block FAILS) + T7's census extension (live)
**Depends on:** D1-T2/T3, D2-T1, D2-T4 (the pattern it replicates).
**Contract refs:** `model-profile-config-contract.md` §Invoke-Time Injection (M69).

Apply T4's exact injection pattern to ALL remaining `gsd-t-phase` invokers (7 total command files
invoke the phase workflow — partition is T4; these are the other 6). Without this, a
standard-profile project still runs fable on every `/gsd-t-plan` pre-mortem and every
`/gsd-t-milestone` probe/judge post-promo — the headline spend switch is DEAD on most entry
points (the NiceNote-M5 class the pre-mortem caught).

**Acceptance criteria:**
- All 7 `gsd-t-phase` invoker commands carry the resolver-call + `overrides`-injection block.
- T10's static lint passes (and FAILS when any one of the 6 lacks the block — proven by its
  negative fixture).
- T7 census extension: standard-profile plan + milestone runs show ZERO fable live.

### M86-D2-T9 — wave workflow + invoker overrides forwarding (pre-mortem r1 #1 CRITICAL)
**Touches:** `templates/workflows/gsd-t-wave.workflow.js`, `commands/gsd-t-wave.md`
**Files:** `templates/workflows/gsd-t-wave.workflow.js`, `commands/gsd-t-wave.md`
**Test:** `test/m86-invoker-injection.test.js` (T10 — wave forwarding asserted statically) + T7's census extension (wave-composed verify live)
**Depends on:** D2-T2/T5 (the verify form + invoker it forwards to).
**Contract refs:** `model-profile-config-contract.md` §Invoke-Time Injection (M69).

`gsd-t-wave.workflow.js`: `JSON.parse` args, read `overrides`, and FORWARD it in the
`workflow("gsd-t-verify", {...})` and `workflow("gsd-t-execute", {...})` sub-workflow calls (the
canonical full-cycle path currently passes `{ milestone, projectDir }` only — red-team would run
on the premium fallback regardless of profile). `commands/gsd-t-wave.md`: resolve the active
profile and inject `overrides` like T4. Stay runtime-native (TD-113).

**Acceptance criteria:**
- The wave workflow forwards `overrides` to BOTH sub-workflow calls; the wave invoker resolves
  and injects it.
- M71 runtime-native lint stays green on the edited wave workflow.
- T7 census extension: under `standard`, a wave-composed verify shows red-team NOT on fable.

### M86-D2-T10 — invoker-injection static lint (NEW test — the fleet guard for #1)
**Touches:** `test/m86-invoker-injection.test.js`
**Files:** `test/m86-invoker-injection.test.js`
**Test:** `node --test test/m86-invoker-injection.test.js`
**Depends on:** T4/T5/T6/T8/T9 (the invokers it discovers and asserts).
**Contract refs:** `model-profile-config-contract.md` §Invoke-Time Injection.

NEW test file. Discovers every `commands/*.md` whose body resolves a `scriptPath` to
`gsd-t-{phase,verify,debug,wave}.workflow.js` (structural detection, not substring — per
`feedback_coverage_check_structural_not_substring`) and asserts each contains the
resolver-call + `overrides`-injection block **including the resolver-failure-handling clause
(pre-mortem c2 #2 — halt or loud named-posture warning; never silent premium)**. Also asserts
`gsd-t-wave.workflow.js` forwards `overrides` in both `workflow(...)` sub-calls. Negative
fixtures: (a) a synthetic invoker doc WITHOUT the injection block FAILS; (b) a synthetic invoker
WITH the injection block but WITHOUT the failure-handling clause FAILS — both through the same
checker entry point (no parallel mock).

**Acceptance criteria:**
- Every workflow-invoking command file is discovered and asserted; a phase invoker lacking the
  injection block OR the failure-handling clause FAILS the suite.
- Both negative fixtures FAIL via the same code path the real files use.
- Verified by `node --test test/m86-invoker-injection.test.js` green (with the negatives proven).

---

## Acceptance bindings → milestone ACs (this domain)

| Milestone AC | Bound task(s) | Impl path | Killing test |
|--------------|---------------|-----------|--------------|
| (a) profile→spend real-sandbox | T1+T2+T3 (`??` forms) + T4+T5+T6+T8+T9 (injection, ALL entry points) | the 4 workflows + 10 invokers | T7 live model census per profile incl. census extension (plan/milestone/wave) |
| (b) override beats profile live | T4 (injects stageOverrides-derived map) | partition invoker | T7 override case |
| (e) resolver consumed at invoke time | T4+T5+T6+T8+T9 | invoker `args` injection | T7 `overrides`-visible-in-args + T10 static lint |
| (g) M85 partition-probe fable | ALREADY SATISFIED (banked 6/6) | — | re-confirmed incidentally by T7 premium partition |

D2 produces the EXACT `??` form D3 unwraps; D3 (write-disjoint) independently verifies it.
