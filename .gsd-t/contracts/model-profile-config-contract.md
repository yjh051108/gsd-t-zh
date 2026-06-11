# Contract: Model-Profile Config + Resolver Seam (M86)

## Version: 1.0.0
## Status: STABLE
## Owner: m86-d1-policy-profiles-config-cli
## Consumers: m86-d2-invoker-wiring-and-workflow-forms, m86-d3-drift-lint-unwrap-guard, m86-d4-surfacing-and-doc-ripple
## Created: 2026-06-10 18:23 PDT (M86 partition)
## Promoted: 2026-06-10 (D1 execute — hardened per pre-mortem c2 closures #2, #3, #4, #5)

---

## Purpose

M86 adds three named **profiles** (standard / pro / premium) as a SECOND dimension over the
M85 frozen `STAGE_TIERS`, selectable per-project, injected at invoke time (M69 path — NO
tracked-file rewriting on switch). This contract is the **partition-time seam**: D1 PRODUCES the
profile dimension + config + resolver; D2/D3/D4 CONSUME the published surface below, never D1's
internals. Riskiest internal logic (override-beats-profile precedence) lives behind this envelope.

This seam is layered ADDITIVELY on top of `model-tier-policy-contract.md` (M85 v1.0.0 STABLE
constants unchanged). D1 bumps that contract to v1.1.0 to fold this dimension in at execute.

---

## Profile Dimension (the second axis)

| Profile | Fable stages | Definition |
|---------|--------------|------------|
| `standard` | ZERO fable | pre-M85 tiers: probes→opus, judge→sonnet, pre-mortem→opus, red-team→opus, debug both cycles→opus; producers→opus (unchanged). |
| `pro` | red-team + pre-mortem + debug-cycle-2 | the 3 highest-value fable stages; everything else reverts to standard. |
| `premium` | all 6 (M85 full set) | solution-space-probe + partition-probe + competition-judge + pre-mortem + red-team + debug-cycle-2 on fable; producers HELD opus. |

`competition-producers` is `opus` in ALL three profiles (M82 blindness invariant — never fable).
Bottom of the ladder (`haiku`, `sonnet`) unchanged except `standard`'s judge→sonnet remap.

---

## Per-Project Config Schema

`.gsd-t/model-profile.json`:
```json
{ "profile": "pro", "stageOverrides": { "competition-judge": "fable" } }
```
- `profile` ∈ { standard, pro, premium }. Absent file → GLOBAL DEFAULT, NAMED (SC(f) — no silent
  degradation). The global default is `premium` (the M85 full posture) unless documented otherwise.
- `stageOverrides` (optional) → per-stage `tier` that WINS over the profile.

---

## Resolver Surface (the seam D2/D3/D4 consume)

**Two resolve forms with DIFFERENT semantics (Red Team M86 r3 HIGH — do not confuse them):**

```
gsd-t model-profile resolve --json                      # BARE form — THE INVOKER FORM
gsd-t model-profile resolve --profile <p> [stage] --json # diagnostic form — config-blind
```
- **Bare form (invokers MUST use this):** reads `.gsd-t/model-profile.json` — profile AND
  `stageOverrides`. Persisted `set-stage` overrides WIN per the precedence chain. Surfaces
  `configError` from a malformed config.
- **`--profile <p>` form (diagnostics/census ONLY):** resolves the named profile with
  **`stageOverrides` ZEROED by design** — a pure profile envelope for divergence tests and
  census runs. Using it for invocation silently drops every persisted override (`show` would
  display haiku while the workflow billed fable — the r3 HIGH).
  `test/m86-invoker-injection.test.js` FAILS any invoker command that uses this form.

Emits:
```json
{
  "ok": true,
  "profile": "pro",
  "overrides": { "red-team": "claude-fable-5", "pre-mortem": "claude-fable-5", "debug-cycle-2": "claude-fable-5" },
  "requiresThinkingOmitted": { "red-team": true, ... }
}
```
- **Precedence:** `stageOverrides[stage] ?? profile-tier ?? global-default`.
- `overrides` maps designated stage key → concrete model id (from M85 `MODEL_IDS`).
- The CLI: `show` / `set <profile>` / `set-stage <stage> <tier>` / `resolve` / `--json`.
- **`requiresThinkingOmitted` is INFORMATIONAL** (verify fix-cycle 1): no workflow or invoker
  consumes it at the `agent()` call site. The Workflow sandbox runtime handles thinking-param
  stripping for fable itself — proven empirically for the concrete-id injection path by probe
  run `wf_c9faf817-373` (`model: "claude-fable-5"` via args completed with no HTTP 400). The
  flag stays in the envelope for diagnostic display and for any future spawn surface
  (`claude -p`-class) that must strip the thinking param itself.

---

## Workflow `??`-Form Obligation (D2 produces, D3 validates)

Each designated workflow stage becomes exactly:
```
model: overrides["<stage>"] ?? "<premium-literal>"
```
- The premium literal stays the **lint-guarded fallback** (D3 unwraps + validates it).
- The resolved override (injected by the invoker via `args`) WINS when present.
- Producers stay a BARE `model: "opus"` (M82 — NOT wrapped).
- Designated stages + their premium fallback literal:
  `solution-space-probe → "fable"`, `partition-probe → "fable"`,
  `competition-judge → "fable"`, `pre-mortem → "fable"`, `red-team → "fable"`,
  `debug-cycle-2 → "fable"` (cycle-1 stays `"opus"`).

---

## Drift-Lint Obligation (D3 owns)

`test/m85-workflow-tier-policy-lint.test.js` UNWRAPS the `??` form and validates the FALLBACK
literal against the tier set + designated-stage policy. Three mandatory negatives: drifted bare
literal FAILS, drifted fallback FAILS, out-of-tier fallback FAILS. Fail-closed on unparseable
`model:` lines.

---

## Invoke-Time Injection (M69 — closes the M85 dead-export concern, SC(e))

**ALL 10 workflow-invoking commands** call the profile resolver at invoke time, build the `overrides` map, and inject it into the workflow via `args`. The workflow `JSON.parse`s `args` (a STRING — TD-113) and reads `overrides` (default `{}`). The resolved map is VISIBLE in the args the invoker passes (the live-export proof).

**10 invoking command files:**
1. `commands/gsd-t-partition.md` — invokes `gsd-t-phase.workflow.js` (phase: partition)
2. `commands/gsd-t-doc-ripple.md` — invokes `gsd-t-phase.workflow.js` (phase: doc-ripple)
3. `commands/gsd-t-plan.md` — invokes `gsd-t-phase.workflow.js` (phase: plan)
4. `commands/gsd-t-impact.md` — invokes `gsd-t-phase.workflow.js` (phase: impact)
5. `commands/gsd-t-milestone.md` — invokes `gsd-t-phase.workflow.js` (phase: milestone)
6. `commands/gsd-t-prd.md` — invokes `gsd-t-phase.workflow.js` (phase: prd)
7. `commands/gsd-t-design-decompose.md` — invokes `gsd-t-phase.workflow.js` (phase: design-decompose)
8. `commands/gsd-t-verify.md` — invokes `gsd-t-verify.workflow.js`
9. `commands/gsd-t-debug.md` — invokes `gsd-t-debug.workflow.js`
10. `commands/gsd-t-wave.md` — invokes `gsd-t-wave.workflow.js` (MUST forward `overrides` to sub-workflows it composes)

> **`discuss` has NO command invoker** (`commands/gsd-t-discuss.md` was deleted at M38; the
> earlier draft of this list named it in error — verify fix-cycle 1). The `discuss` phase is
> competition-eligible inside `gsd-t-phase.workflow.js`, so a hypothetical discuss launch
> without an injecting invoker would run the solution-space-probe on the premium fallback
> literal regardless of profile. This is ACCEPTED as out of reach (no repo entry point invokes
> phase: discuss); if a discuss invoker is ever recreated, `test/m86-invoker-injection.test.js`
> discovers it structurally and FAILS until it carries the injection block.

**Wave forwarding obligation:** `gsd-t-wave.workflow.js` composes execute + verify as sub-workflows. It MUST read the `overrides` from its own `args` (injected by `gsd-t-wave.md`) and forward them into the sub-workflow invocations. An `overrides`-forwarding test in D2 asserts this.

**Resolver-failure semantics (pre-mortem c2 #2):** If the resolver returns `{ ok:false }` at invoke time (e.g. corrupt config, unknown profile), the invoker MUST either halt with an explicit error OR use the named global default with a loud warning. It MUST NEVER silently fall through to the premium posture without any indication of the failure. The resolver is designed to return a named default + `configError` for graceful degradation — the invoker surfaces the `configError`.

---

## Drift-Lint Obligation (D3 owns — FULL negative set)

`test/m85-workflow-tier-policy-lint.test.js` UNWRAPS the `??` form and validates the FALLBACK literal. The full mandatory negative set (each MUST produce a lint FAILURE):

1. **Drifted bare literal**: `model: "fable"` (not wrapped) on a designated stage → FAIL
2. **Drifted fallback**: `model: overrides["red-team"] ?? "opus"` (wrong premium literal) → FAIL
3. **Out-of-tier fallback**: `model: overrides["red-team"] ?? "gpt-4"` (not in tier set) → FAIL
4. **Typo'd bracket key**: `model: overrides["red_team"] ?? "fable"` (key mismatch for `red-team` stage) → FAIL
5. **Wrapped producers**: `model: overrides["competition-producers"] ?? "opus"` (producers must be BARE) → FAIL
6. **Combined-form drifted cycle-1**: `model: overrides["debug-cycle-1"] ?? "fable"` (cycle-1 stays opus, not fable) → FAIL
7. **Combined-form drifted parenthesized fallback**: `model: (overrides["red-team"] ?? "fable")` (parenthesized variant that may fool a naive regex) → parsed correctly, validated as above
8. **Fail-closed**: an unparseable `model:` line (neither bare nor `??` form) → FAIL (no silent pass)

**Bracket-key validation:** for each of the 6 INJECTABLE stages, the key inside `overrides["..."]` MUST exactly match the stage key. The 6 injectable stages: `solution-space-probe`, `partition-probe`, `competition-judge`, `pre-mortem`, `red-team`, `debug-cycle-2`. Producers excluded.

**Combined-form positive**: `model: overrides["red-team"] ?? "fable"` passes lint when `red-team` is a designated fable stage and `"fable"` is the correct premium literal. This is the canonical passing form.

---

## File Ownership (re-validated for disjointness by the partition oracle)

| Domain | Owns |
|--------|------|
| D1 (15 files) | `bin/gsd-t-model-tier-policy.cjs`, `bin/gsd-t-model-profile.cjs`, `bin/gsd-t.js`, `.gsd-t/contracts/model-tier-policy-contract.md`, `.gsd-t/contracts/model-profile-config-contract.md`, `test/m86-policy-profiles.test.js` |
| D2 (15 files) | `templates/workflows/gsd-t-phase.workflow.js`, `templates/workflows/gsd-t-verify.workflow.js`, `templates/workflows/gsd-t-debug.workflow.js`, `templates/workflows/gsd-t-wave.workflow.js`, `commands/gsd-t-partition.md`, `commands/gsd-t-doc-ripple.md`, `commands/gsd-t-plan.md`, `commands/gsd-t-impact.md`, `commands/gsd-t-milestone.md`, `commands/gsd-t-prd.md`, `commands/gsd-t-design-decompose.md`, `commands/gsd-t-verify.md`, `commands/gsd-t-debug.md`, `commands/gsd-t-wave.md`, `test/m86-invoker-injection.test.js` |
| D3 | `test/m85-workflow-tier-policy-lint.test.js`, `test/m86-lint-unwrap-fallback.test.js` |
| D4 | `scripts/gsd-t-auto-route.js`, `scripts/gsd-t-statusline.js`, `commands/gsd-t-status.md`, `commands/gsd-t-help.md`, `README.md`, `GSD-T-README.md`, `templates/CLAUDE-global.md`, `CLAUDE.md`, `package.json`, `test/m86-surfacing.test.js` |

No file appears under two domains. This contract file (`.gsd-t/contracts/model-profile-config-contract.md`) is owned by D1, disjoint from every domain's source files.

---

## Out of Scope

- Session default model (`/model`) — profiles govern workflow stages only.
- New tiers / new stages — profiles re-map the existing M85 `STAGE_TIERS` set.
- Tracked-file rewriting on switch — the entire point is invoke-time injection.
