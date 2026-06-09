# Contract: Model-Tier Policy

## Version: 1.0.0
## Status: STABLE
## Owner: m85-d1-tier-policy-module
## Consumers: `bin/gsd-t-parallel.cjs`, `bin/model-selector.js`, `templates/workflows/gsd-t-phase.workflow.js`, `templates/workflows/gsd-t-verify.workflow.js`, `templates/workflows/gsd-t-debug.workflow.js`, `test/m85-workflow-tier-policy-lint.test.js`
## Created: 2026-06-09 14:42 PDT

---

## Purpose

Define the SINGLE source of truth for GSD-T model-tier policy. Before M85, tier assignments lived in 4 unsynced authorities (hard-coded `model:` literals in the 8 workflows; a duplicated phase table in `bin/model-selector.js` the sandbox cannot `require`; the alias map in `bin/gsd-t-parallel.cjs`; CLAUDE.md prose) with zero drift enforcement — and the alias map was provably STALE (`opus → claude-opus-4-7`, a live bug). This contract publishes the constants every M85 domain codes against, so the implementation file (`bin/gsd-t-model-tier-policy.cjs`) can change internals without rippling to consumers.

This is the **partition-time seam**. The serial gate for the whole milestone is the id constants below landing in `model-tier-policy-contract.md` + `bin/gsd-t-model-tier-policy.cjs`. Every other domain (D2 consumers, D3 workflows, D4 lint) codes against these published constants — NOT against the module's internals.

---

## Published Model-ID Constants (authoritative)

| Tier alias | Concrete model id | Notes |
|------------|-------------------|-------|
| `opus`   | `claude-opus-4-8`            | Replaces the STALE `claude-opus-4-7` in the parallel alias map (M85 live-bug fix). |
| `fable`  | `claude-fable-5`             | Tier ABOVE opus. $10/$50 per MTok. 1M ctx / 128K out. Same API surface as Opus 4.8. Breaking change: see `requiresThinkingOmitted` below. |
| `sonnet` | `claude-sonnet-4-6`          | Default tier. Unchanged. |
| `haiku`  | `claude-haiku-4-5-20251001`  | Mechanical tier. Unchanged. |

Consumers MUST source these ids from the policy module / this contract — never re-hardcode them.

---

## `requiresThinkingOmitted(model)` predicate

Encodes the Fable thinking-disabled-400 breaking change EXACTLY ONCE:

```
requiresThinkingOmitted(model) === true   iff   model === "claude-fable-5"
```

Rationale (the single canonical home): `claude-fable-5` returns **HTTP 400** when the explicit thinking-disabled parameter is sent. The parameter must therefore be OMITTED for Fable. No other file may re-implement this predicate or re-state the rationale.

**Consumption site (the predicate must be LIVE, not a dead export).** The only GSD-T-controlled spawn path that sets model/thinking params is `bin/gsd-t-parallel.cjs` (it spawns `claude -p` and sets `ANTHROPIC_MODEL`). That path is where `requiresThinkingOmitted(model)` is consulted: when the resolved worker model is `claude-fable-5`, the spawn OMITS any explicit thinking-disabled param. Workflow `agent()` `model:` aliases (e.g. `"fable"`) are translated by the Anthropic Workflow sandbox runtime, which GSD-T does NOT control — workflows therefore do not (and cannot) consult this predicate directly. (M85-D2 owns this binding.)

---

## Stage Policy (M85 Fable assignments)

The policy maps the M85 designated stages to a tier. The 5 Fable assignments and the held opus invariant:

| Stage key | File (consumer) | Tier | Invariant |
|-----------|-----------------|------|-----------|
| `solution-space-probe`      | gsd-t-phase.workflow.js   | `fable` | M84 |
| `partition-probe`           | gsd-t-phase.workflow.js   | `fable` | M84 |
| `competition-judge`         | gsd-t-phase.workflow.js   | `fable` | M82 — judge is a DIFFERENT model than producers (producers stay opus) |
| `competition-producers`     | gsd-t-phase.workflow.js   | `opus`  | M82 blindness — HELD, do NOT move to fable |
| `pre-mortem`                | gsd-t-phase.workflow.js   | `fable` | M83 |
| `red-team`                  | gsd-t-verify.workflow.js  | `fable` | stays NON-SKIPPABLE |
| `debug-cycle-2`             | gsd-t-debug.workflow.js   | `fable` | cycle-1 opus → cycle-2 fable → needs-human |

Bottom of the escalation ladder (`haiku`, `sonnet`) is UNCHANGED across M85.

---

## Resolver Surface (M69 invoke-time injection)

`bin/gsd-t-model-tier-policy.cjs` exposes:
- `resolve(stageKey) → concreteModelId` (function)
- A CLI command (`node bin/gsd-t-model-tier-policy.cjs resolve <stageKey> [--json]`) emitting a JSON envelope.

Command invokers call the resolver at invoke time and inject the concrete model id into the workflow via `args` (M69 pattern). Workflows stay runtime-native — they NEVER `require` this module (TD-113 sandbox ban on `require`/`fs`).

---

## Drift Enforcement

`test/m85-workflow-tier-policy-lint.test.js` (M71-family, owned by D4) READS all 8 `templates/workflows/*.workflow.js` (read-only) and this contract / the policy module, and asserts:
1. Every workflow `model:` literal is a member of the published tier set.
2. The 5 designated stages resolve to `fable`; competition producers resolve to `opus`.
3. A deliberately-drifted literal FAILS (mandatory negative test).

---

## Zero-Dep Invariant

`bin/gsd-t-model-tier-policy.cjs` has zero external runtime deps (installer-package invariant). Pure Node built-ins.
