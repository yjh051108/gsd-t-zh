# Tasks: m86-d1-policy-profiles-config-cli

> Plan-grade Shape D. Every task carries **Files** (impl path), **Touches**
> (parallel-exec ownership), **Acceptance criteria**, and a **Test** (the killing
> test for that AC). The HEADLINE task carries `**Headline:** true`. Seam contract:
> `.gsd-t/contracts/model-profile-config-contract.md` (DRAFT → STABLE at execute) +
> `model-tier-policy-contract.md` (v1.0.0 → v1.1.0 additive, bumped by T4).

## Files Owned

- `bin/gsd-t-model-tier-policy.cjs`
- `bin/gsd-t-model-profile.cjs`
- `bin/gsd-t.js`
- `.gsd-t/contracts/model-tier-policy-contract.md`
- `test/m86-policy-profiles.test.js`

---

### M86-D1-T1 — Profile dimension + profile-aware resolver on the policy module
**Headline:** true
**Touches:** `bin/gsd-t-model-tier-policy.cjs`
**Files:** `bin/gsd-t-model-tier-policy.cjs`
**Test:** `test/m86-policy-profiles.test.js` (the headline `resolveProfile` per-profile census assertion — see T5)
**Depends on:** none (seam producer; D2/D3/D4 consume the published surface).
**Contract refs:** `model-profile-config-contract.md` §Profile Dimension, §Resolver Surface; `model-tier-policy-contract.md` §Published Model-ID Constants, §Stage Policy.

Add `PROFILE_STAGE_TIERS` — a frozen `{ standard, pro, premium } → { stageKey → tier }`
map layered ADDITIVELY over the frozen M85 `STAGE_TIERS` (the M85 v1.0.0 constants stay
byte-functionally unchanged):
- `standard` = ZERO fable: probes→opus, judge→sonnet, pre-mortem→opus, red-team→opus,
  debug-cycle-2→opus; producers→opus.
- `pro` = red-team + pre-mortem + debug-cycle-2 → fable; everything else reverts to standard.
- `premium` = all 6 designated stages → fable (the M85 full set).
- `competition-producers` → **opus in all three profiles** (M82 blindness — NEVER fable).

Add `resolveProfile(stageKey, { profile, stageOverrides })` honoring precedence
`stageOverrides[stage] ?? profile-tier ?? global-default`, returning the concrete model id
via `MODEL_IDS`. Never throws; unknown profile/stage falls back to a named default (no
exception). Export both additively alongside the unchanged M85 surface (`MODEL_IDS`,
`STAGE_TIERS`, `requiresThinkingOmitted`, `resolve`). No top-level side effects (require-safe).

**Acceptance criteria:**
- `resolveProfile` returns the EXACT per-stage concrete model id for each of the three profiles
  (standard zero-fable; pro = red-team + pre-mortem + debug-cycle-2 fable; premium = all 6 fable;
  producers `claude-opus-4-8` in every profile). This is the milestone HEADLINE capability —
  the profile→tier mapping that everything else injects.
- The M85 v1.0.0 surface is byte-functionally unchanged (existing M85 tests still pass — proven
  by `node --test test/m85-*.test.js` staying green in T5's run).
- Verified by `node --test test/m86-policy-profiles.test.js` (the per-profile census assertion).

### M86-D1-T2 — model-profile config read/write + CLI module (NEW)
**Touches:** `bin/gsd-t-model-profile.cjs`
**Files:** `bin/gsd-t-model-profile.cjs`
**Test:** `test/m86-policy-profiles.test.js` (resolve-envelope shape + absent-config named-default + reject-unknown cases)
**Depends on:** T1 (consumes `resolveProfile` / `PROFILE_STAGE_TIERS` from the policy module via `require`).
**Contract refs:** `model-profile-config-contract.md` §Per-Project Config Schema, §Resolver Surface.

New zero-dep module (pure Node built-ins). Read/write `.gsd-t/model-profile.json`
(`{ profile, stageOverrides }`) with safe absent-file defaulting (the global default — `premium`
— NAMED in the envelope, never silently degraded, SC(f)). CLI subcommands:
`show` / `set <profile>` / `set-stage <stage> <tier>` / `resolve --profile <p> [stage]` / `--json`.
The `resolve` command emits the seam D2/D4 consume:
`{ ok, profile, overrides: { "<stage>": "<concreteModelId>" }, requiresThinkingOmitted? }`.
Validate profile names ∈ {standard,pro,premium} and tier names ∈ {opus,fable,sonnet,haiku};
reject unknown with a non-zero exit + `{ ok:false, error }` envelope. No top-level side effects.

**Blindness clamps (pre-mortem r1 #3 HIGH):** `set-stage` validation is NOT mere tier-membership:
- `set-stage competition-producers <anything>` → REJECTED (`{ok:false}`, non-zero exit). Producers
  are HELD opus by the M82 blindness invariant — not an overridable stage, in ANY profile.
- `set-stage competition-judge opus` (any value equal to the producers' held model) → REJECTED.
  Judge model must NEVER equal producer model; the static lint can't see args-injected values,
  so this dynamic clamp is the only guard on the runtime path.
- `resolveProfile` itself enforces the invariant: for every profile × every ACCEPTED override
  combination, resolved competition-judge model ≠ the producers' model.

**Malformed-config behavior (pre-mortem r1 #5 MEDIUM):** `.gsd-t/model-profile.json` is
hand-editable; corrupt JSON, wrong-typed `profile` (e.g. `42`), wrong-typed/non-string-valued
`stageOverrides`, or `null` must each produce a DEFINED envelope — `{ok:false,error}` from
resolve, or the named default carrying an explicit `configError` marker that D4's surfacing
renders. NEVER a silent clean-premium envelope (a typo'd attempt to set `standard` must not
silently become the most expensive posture).

**Acceptance criteria:**
- `resolve --profile <p> --json` emits a well-formed envelope whose `overrides` map matches T1's
  `resolveProfile` output for every designated stage, and carries `requiresThinkingOmitted` for
  fable stages (propagated from the M85 predicate).
- Absent `.gsd-t/model-profile.json` → the named global default is returned (`profile` field set,
  never blank — SC(f)).
- Unknown profile / unknown tier → non-zero exit + `{ ok:false, error }` (no silent acceptance).
- Blindness clamps hold: `set-stage competition-producers *` and `set-stage competition-judge opus`
  both REJECTED; resolveProfile never emits judge === producers' model.
- Malformed config (corrupt/wrong-typed/null) → DEFINED envelope with explicit error/configError —
  never a silent premium fall-through.
- Verified by `node --test test/m86-policy-profiles.test.js` (envelope-shape, absent-default,
  reject-unknown, blindness-clamp, malformed-config cases).

### M86-D1-T3 — gsd-t.js dispatch + dual bin-propagation
**Touches:** `bin/gsd-t.js`
**Files:** `bin/gsd-t.js`
**Test:** `test/m86-policy-profiles.test.js` (asserts `gsd-t-model-profile.cjs` is registered in BOTH `GLOBAL_BIN_TOOLS` and `PROJECT_BIN_TOOLS`; smoke-spawns the dispatch)
**Depends on:** T2 (the case delegates to `gsd-t-model-profile.cjs`).
**Contract refs:** `model-profile-config-contract.md` §Resolver Surface (the `gsd-t model-profile …` CLI alias).

Add a THIN `case "model-profile"` (mirror the existing `model-tier-policy` dispatch case —
delegate all logic to `gsd-t-model-profile.cjs`, keep `bin/gsd-t.js` minimal since it is
high-traffic). Register `gsd-t-model-profile.cjs` in BOTH `GLOBAL_BIN_TOOLS` (~line 1190) and
`PROJECT_BIN_TOOLS` (~line 2486) — the dual propagation that prevents the
`project_global_bin_propagation_gap` silent-breakage class.

**Acceptance criteria:**
- `gsd-t model-profile --json` dispatches to the new module and returns its envelope (smoke).
- `gsd-t-model-profile.cjs` appears in BOTH `GLOBAL_BIN_TOOLS` and `PROJECT_BIN_TOOLS` (asserted
  by a test that reads `bin/gsd-t.js` and checks both arrays contain the filename — a missing
  entry FAILS).
- Verified by `node --test test/m86-policy-profiles.test.js` (dual-registration assertion).

### M86-D1-T4 — Contract bump to v1.1.0 (additive) + DRAFT seam promotion
**Touches:** `.gsd-t/contracts/model-tier-policy-contract.md`
**Files:** `.gsd-t/contracts/model-tier-policy-contract.md`
**Test:** `test/m86-policy-profiles.test.js` (a doc-assertion that the contract declares Version 1.1.0 and contains the 3-profile dimension table + the `??`-form lint obligation string)
**Depends on:** T1 (the published constants the contract documents).
**Contract refs:** `model-profile-config-contract.md` (the DRAFT seam this folds in additively).

Bump `model-tier-policy-contract.md` Version `1.0.0` → `1.1.0` (Status stays STABLE). Add
additively (M85 §Published Model-ID Constants + §Stage Policy stay byte-unchanged):
- the profile dimension table (3 profiles × designated-fable-stage set, producers held opus);
- the profile-aware resolve surface shape (`overrides` map + precedence);
- the `??`-form workflow lint obligation (`model: overrides["<stage>"] ?? "<premium-literal>"`,
  premium literal = the lint-guarded fallback) — INCLUDING bracket-KEY validation (the unwrapped
  `overrides["<stage>"]` key must equal the designated stageKey — pre-mortem r1 #2);
- the blindness-clamp validation rules (producers not overridable; judge ≠ producers' model —
  pre-mortem r1 #3) + the malformed-config defined-behavior rule (pre-mortem r1 #5).
Update the Consumers list to add `bin/gsd-t-model-profile.cjs` + the profile-aware surface.
The companion DRAFT seam `model-profile-config-contract.md` is promoted DRAFT → STABLE in this
task (its `## Status:` line).

**Acceptance criteria:**
- `model-tier-policy-contract.md` declares `## Version: 1.1.0`, retains the unchanged M85
  constants section, and adds the profile dimension + `??`-form lint obligation.
- `model-profile-config-contract.md` `## Status:` reads STABLE (no longer DRAFT).
- Verified by `node --test test/m86-policy-profiles.test.js` (contract doc-assertion).

### M86-D1-T5 — Unit tests (the killing tests for the headline + every D1 AC)
**Touches:** `test/m86-policy-profiles.test.js`
**Files:** `test/m86-policy-profiles.test.js`
**Test:** `node --test test/m86-policy-profiles.test.js`
**Depends on:** T1–T4 (exercises all of them).
**Contract refs:** `model-profile-config-contract.md` §Profile Dimension, §Resolver Surface.

NEW test file (distinct from D3's drift lint). Cases:
- **Headline census:** `resolveProfile` returns the EXACT per-stage model id for each of the
  three profiles (standard zero-fable; pro = red-team+pre-mortem+debug-cycle-2 fable; premium =
  all 6 fable; producers `claude-opus-4-8` everywhere). FAILS if any profile maps producers to
  fable, or if a designated stage's tier is wrong.
- **Override beats profile:** `resolveProfile("competition-judge", { profile:"pro",
  stageOverrides:{ "competition-judge":"fable" } })` → fable (precedence proof for SC(b)).
- **Absent config → named global default** (SC(f)): config-read with no file returns the named
  default, never blank.
- **`requiresThinkingOmitted` propagated** for fable stages in the resolve envelope.
- **Reject unknown** profile/stage (non-zero / `{ok:false}`).
- **Blindness clamps (r1 #3):** (1) `set-stage competition-producers <any-non-opus>` AND
  `set-stage competition-producers opus` both REJECTED (not an overridable stage); (2)
  `set-stage competition-judge opus` REJECTED; (3) invariant case — for every profile × any
  accepted stageOverrides combination, resolved competition-judge ≠ `claude-opus-4-8` (FAILS if
  the resolver ever emits judge = producers' model).
- **Malformed-config fixtures (r1 #5):** (1) syntactically corrupt JSON, (2) `profile` of wrong
  type, (3) `stageOverrides` wrong-typed / non-string values — each asserted to produce a DEFINED
  envelope (`{ok:false,error}` or named default + explicit `configError`), never a silent clean
  premium envelope.
- **Dual bin-propagation:** reads `bin/gsd-t.js`, asserts `gsd-t-model-profile.cjs` in BOTH tool
  arrays.
- **Contract doc-assertion:** `model-tier-policy-contract.md` is v1.1.0 with the profile table.

**Acceptance criteria:**
- The suite is GREEN (`node --test test/m86-policy-profiles.test.js`) AND the headline census
  case would FAIL if T1's `PROFILE_STAGE_TIERS` regressed (it is the dead-code killer for the
  milestone's headline mapping).
- Existing M85 tests stay green (`node --test test/m85-*.test.js`) — proves additive-only.
- Verified by running both test globs to green before commit.

---

## Acceptance bindings → milestone ACs (this domain)

| Milestone AC | Bound task(s) | Impl path | Killing test |
|--------------|---------------|-----------|--------------|
| Foundation for (a) profile→spend | T1 | `bin/gsd-t-model-tier-policy.cjs` | T5 headline census |
| (b) override beats profile | T1 + T2 | resolver precedence | T5 override-beats-profile case |
| (d) per-project divergence | T2 | `bin/gsd-t-model-profile.cjs` config-read | T5 absent/per-project case (live 2-project proof = verify) |
| (e) resolver consumed at invoke time | T2 | resolve envelope | T5 envelope-shape (live injection = D2) |
| (f) no silent degradation | T2 | named global default | T5 absent-config named-default case |

D1 publishes the seam; D2/D3 prove (a)/(b)/(c)/(e) LIVE in a real sandbox run.
