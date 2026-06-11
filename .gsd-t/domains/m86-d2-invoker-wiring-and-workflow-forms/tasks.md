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
- `commands/gsd-t-partition.md`
- `commands/gsd-t-verify.md`
- `commands/gsd-t-debug.md`

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
**Depends on:** D2-T1..T6, D1 (resolver live).
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

**Acceptance criteria:**
- standard/pro/premium each produce the EXACT fable-stage set above, measured from live usage
  frames (NOT from config) — SC(a).
- override-beats-profile demonstrated live — SC(b).
- the resolved `overrides` is visible in the workflow args of each run — SC(e).
- Verified by capturing the model census from the live `wf_*` transcript usage frames per run.

---

## Acceptance bindings → milestone ACs (this domain)

| Milestone AC | Bound task(s) | Impl path | Killing test |
|--------------|---------------|-----------|--------------|
| (a) profile→spend real-sandbox | T1+T2+T3 (`??` forms) + T4+T5+T6 (injection) | the 3 workflows + 3 invokers | T7 live model census per profile |
| (b) override beats profile live | T4 (injects stageOverrides-derived map) | partition invoker | T7 override case |
| (e) resolver consumed at invoke time | T4+T5+T6 | invoker `args` injection | T7 `overrides`-visible-in-args |
| (g) M85 partition-probe fable | ALREADY SATISFIED (banked 6/6) | — | re-confirmed incidentally by T7 premium partition |

D2 produces the EXACT `??` form D3 unwraps; D3 (write-disjoint) independently verifies it.
