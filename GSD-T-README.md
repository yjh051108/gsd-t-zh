# GSD-T Framework Reference — v4.8.10

This file is a companion to `README.md` and tracks framework-level documentation — methodology decisions, internal architecture, and per-milestone capability summaries. Maintained alongside `README.md` per the Pre-Commit Gate.

---

## Model Tier Policy (M85)

`bin/gsd-t-model-tier-policy.cjs` is the SINGLE source of truth for model-tier assignments. The M85 Fable assignments (contract v1.1.0 STABLE):

| Stage | Tier | Why |
|-------|------|-----|
| `solution-space-probe` | `fable` | Highest-leverage upstream judgment |
| `partition-probe` | `fable` | Domain decomposition quality gates entire wave |
| `competition-judge` | `fable` | Blind judge in competition mode |
| `competition-producers` | `opus` | HELD — M82 blindness invariant (never fable) |
| `pre-mortem` | `fable` | Attack the design before any code is written |
| `red-team` | `fable` | Adversarial security + correctness after build |
| `debug-cycle-2` | `fable` | Escalation tier for hard bugs |

The M71-family drift lint (`test/m85-workflow-tier-policy-lint.test.js`) mechanically enforces that every workflow `model:` literal matches the policy — a drifted literal FAILS the lint.

---

## Model Profiles (M86)

`bin/gsd-t-model-profile.cjs` adds a per-project **tier-spend switch** as a second dimension over the M85 stage-tier policy. Contract: `.gsd-t/contracts/model-profile-config-contract.md` v1.0.0 STABLE.

### Profile Dimension

| Profile | Fable stages | Definition |
|---------|--------------|------------|
| `standard` | None | Pre-M85 posture: probes→opus, judge→sonnet, pre-mortem→opus, red-team→opus, debug both cycles→opus |
| `pro` | red-team + pre-mortem + debug-cycle-2 | Three highest-value Fable gates; everything else reverts to standard |
| `premium` | All 6 M85 designated stages | Full M85 posture — **global default** |

`competition-producers` is `opus` in ALL profiles (M82 blindness invariant — not overridable).

### Per-Project Config

`.gsd-t/model-profile.json`:
```json
{ "profile": "pro", "stageOverrides": { "competition-judge": "fable" } }
```

- Absent file → global default (`premium`), NAMED in the banner/statusline/status (SC(f) — no silent degradation).
- `stageOverrides` → per-stage tier that beats the profile. Blindness clamps enforced at resolve time.

### Invoke-Time Injection (M69)

Command invokers (`commands/gsd-t-{partition,verify,debug,...}.md`) call the resolver at invoke time, build an `overrides` map, and inject it into the workflow via `args`. Workflows read `overrides` (default `{}`). No tracked-file rewriting on profile switch — the entire point is invoke-time injection.

### Active Profile Surfacing

The active profile is always named — never blank, never an implicit fallback (SC(f)):

- **Session banner** (`scripts/gsd-t-auto-route.js`): `[GSD-T PROFILE] profile: pro` — emitted on every turn, every project.
- **Statusline** (`scripts/gsd-t-statusline.js`): `│ profile: pro` — shown in `statusLine`.
- **`gsd-t status`** (`commands/gsd-t-status.md`): `Model Profile: pro` — in the status report header.

When the config is absent: `profile: premium (default)`. When config is malformed: `profile: premium (default, config-error: <reason>)`.

### Workflow `??`-Form

Each designated workflow stage uses the `??`-form:
```js
model: overrides["<stage>"] ?? "<premium-literal>"
```
The premium literal is the lint-guarded fallback; the resolved override wins when present. The D3 drift lint (`test/m86-lint-unwrap-fallback.test.js`) validates the `??` form, the bracket key, and all fallback literals.

---

## Competition Mode (M82/M84)

On upstream phases (partition / milestone / discuss / design-decompose), an Opus solution-space probe auto-decides whether to compete. If it fires: 3 parallel producers (opus) → a judge (fable for partition, different-model blind for subjective) → a finalizer. Contract: `.gsd-t/contracts/competition-mode-contract.md` v1.0.0.

---

## Plan Hardening (M83)

The `plan` phase runs two blocking gates before execute:
1. **Traceability gate** (`gsd-t traceability-gate`) — every AC binds to a code path + a killing test.
2. **Pre-mortem** (fable, fresh-context) — adversarial prediction of edge-case/NFR/dead-deliverable failures; each → a required test.

Contract: `.gsd-t/contracts/plan-hardening-contract.md` v1.0.0.

---

## Wave Diagram

```
/gsd-t-wave
  ├── gsd-t-execute.workflow.js
  │     preflight → brief → file-disjointness → parallel(domain workers) → integrate → verify-gate
  └── gsd-t-verify.workflow.js
        preflight → verify-gate (tsc+lint+tests+knip) → CI-parity (M57) → test-data-purge (M58)
          → parallel[ /code-review ultra | Red Team (fable) | QA (sonnet) ] → synthesis
```

---

## Version History (recent)

| Version | Milestone | Key capability |
|---------|-----------|----------------|
| 4.8.10 | M91 (M87+M88) | PseudoCode Source-of-Truth — intention-first behavior map as the milestone source-of-truth: `[RULE]` guard-map verify gate, section-citation traceability, two-altitude flow, + 4 deterministic M88 gates (sign-off `isDefined`, build→map derivation, triad-consumption seam, divergence-grammar round-trip) |
| 4.7.11 | #40 | Deterministic domain archive+sweep at complete-milestone (`bin/gsd-t-archive-domains.cjs`) — stops stale-domain accumulation |
| 4.7.10 | M90 | The Unproven-Assumption Doctrine — factual classifier + loop-ledger non-convergence halt + architectural trigger, wired fail-closed |
| 4.5.10 | M86 | Model Profiles (standard/pro/premium) — per-project tier-spend switch |
| 4.4.10 | M85 | Fable 5 tier + single-source model-tier policy (`bin/gsd-t-model-tier-policy.cjs`) |
| 4.0.10 | M61 | Native Workflow orchestration — Workflow runtime owns spawning |
| 3.29.10 | M59 | Timestamp precision in progress.md + date-guard hardening |
