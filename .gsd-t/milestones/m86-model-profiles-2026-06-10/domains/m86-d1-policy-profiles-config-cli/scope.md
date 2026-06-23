# Domain: m86-d1-policy-profiles-config-cli

**Milestone:** M86 — Model Profiles (standard/pro/premium tier-spend switch)
**Role:** CONTRACT SEAM + medium-risk core, isolated behind a stable resolver envelope.

## Thesis

This domain is the PRODUCER of the seam every other domain codes against. It owns the
riskiest module-internal logic (override-beats-profile precedence) and hides it behind a
stable resolver envelope so consumers never depend on internals. It publishes the v1.1.0
additive contract as the brief seam for D2 (workflow forms), D3 (drift lint), and D4
(surfacing + docs).

## Owned Files (this domain WRITES these — no other domain may)

| File | Why |
|------|-----|
| `bin/gsd-t-model-tier-policy.cjs` | Extend with the profile dimension + profile-aware resolve surface. |
| `bin/gsd-t-model-profile.cjs` | NEW — the `gsd-t model-profile` CLI brain + config read/write. |
| `bin/gsd-t.js` | Wire the `case "model-profile"` dispatch + dual bin-propagation registration. |
| `.gsd-t/contracts/model-tier-policy-contract.md` | Bump to v1.1.0 (additive: profile dimension + resolve surface + `??`-form lint obligation). |
| `.gsd-t/contracts/model-profile-config-contract.md` | The seam contract — T4 AMENDS it to the hardened plan (10 invokers, full negative set, real ownership table) BEFORE promoting DRAFT→STABLE (pre-mortem c2 #3; previously owned by nobody). |
| `test/m86-policy-profiles.test.js` | NEW — unit tests for the new resolver/config logic (distinct from D3's drift-lint). |

## Deliverables

1. **Profile dimension** on `bin/gsd-t-model-tier-policy.cjs` — a `PROFILE_STAGE_TIERS`
   second dimension over the frozen M85 `STAGE_TIERS` (the M85 v1.0.0 constants stay
   byte-unchanged — additive only):
   - `standard` = ZERO fable (pre-M85 tiers: probes→opus, judge→sonnet, pre-mortem→opus,
     red-team→opus, debug both cycles→opus; producers→opus unchanged).
   - `pro` = red-team + pre-mortem + debug-cycle-2 on fable; everything else reverts to standard.
   - `premium` = all 6 M85 fable stages; producers HELD opus (M82 blindness invariant).
2. **Profile-aware resolve surface** — `resolve` honoring precedence
   `stageOverrides[stage] > profile-tier > global-default` and returning concrete per-stage
   model ids. `requiresThinkingOmitted` propagation preserved in the envelope.
3. **`.gsd-t/model-profile.json` read/write** — schema `{ profile, stageOverrides }` with
   safe absent-file defaulting (global default named, never silently degraded — SC(f)).
4. **`gsd-t model-profile` CLI** (new bin file `bin/gsd-t-model-profile.cjs`): `show` /
   `set <profile>` / `set-stage <stage> <tier>` / `--json` envelope.
5. **Dispatch + propagation** — `case "model-profile"` in `bin/gsd-t.js`, plus register
   `gsd-t-model-profile.cjs` in BOTH `GLOBAL_BIN_TOOLS` (~line 1190) and `PROJECT_BIN_TOOLS`
   (~line 2486) for dual propagation (the no-installer-path silent-breakage guard).
6. **Contract v1.1.0** — publish the profile dimension + profile-aware resolve surface +
   the `model: overrides[x] ?? literal` workflow-form lint obligation as the brief seam.

## The Published Seam (what D2/D3/D4 code against)

```
node bin/gsd-t-model-profile.cjs resolve --profile <p> [stage] [--json]
  → { ok, profile, overrides: { "<stage>": "<concreteModelId>", ... }, requiresThinkingOmitted? }
```
- `overrides` is the map the invokers (D2) inject into the workflow via `args`.
- Precedence: `stageOverrides[stage] ?? profile-tier ?? global-default`.
- The premium-literal in each workflow stage remains the lint-guarded FALLBACK (D3 validates it).

## NOT Owned (other domains)

- Workflow source + invoker command files → D2.
- The drift lint (`test/m85-workflow-tier-policy-lint.test.js`) + unwrap negative fixture → D3.
- `scripts/` surfacing, status/help commands, README/CLAUDE docs, package.json → D4.

## Dependencies

None inbound. D1 is the seam producer; D2/D3/D4 consume its published surface.
