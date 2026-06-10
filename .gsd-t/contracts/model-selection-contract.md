# Contract: Model Selection

## Version: 1.1.0
## Status: ACTIVE
## Owner: m35-model-selector-advisor
## Consumers: `bin/model-selector.js`, `bin/advisor-integration.js`, `commands/gsd-t-execute.md`, `commands/gsd-t-wave.md`, `commands/gsd-t-quick.md`, `commands/gsd-t-integrate.md`, `commands/gsd-t-debug.md`, `commands/gsd-t-partition.md`, `commands/gsd-t-discuss.md`, `commands/gsd-t-plan.md`, `commands/gsd-t-verify.md`, `commands/gsd-t-test-sync.md`, `commands/gsd-t-doc-ripple.md`
## Cross-reference: `.gsd-t/contracts/model-tier-policy-contract.md` v1.0.0 STABLE (M85 — single source of truth for tier assignments; supersedes the ad-hoc tier descriptions in this contract for the 5 designated Fable stages)

---

## Purpose

Define the **declarative, per-phase model assignment** used by every GSD-T subagent spawn. Model selection is explicit at the phase level — never runtime-overridden under context pressure, never silently downgraded by `bin/token-budget.js`, never mutated by the orchestrator based on session state.

Surgical escalation from the phase default to `opus` is supported via declared escalation hooks that invoke Claude Code's native `/advisor` tool (or its convention-based fallback — see `bin/advisor-integration.js` and the `/advisor` findings artifact).

This contract replaces the M31/M34-era model-override map that `bin/token-budget.js` used to return from `getDegradationActions()`. That map was removed in `token-budget-contract.md` v3.0.0 (M35 — No Silent Degradation).

---

## Core Principles

1. **Quality is non-negotiable.** Routine work defaults to `sonnet` (strong enough for almost everything GSD-T does). Heavy-reasoning decision points escalate to `opus` surgically — not categorically, not under context pressure.
2. **Haiku is narrow.** Haiku is reserved for strictly mechanical subroutines where hallucination is effectively impossible (running a test command and reporting the pass/fail count, validating a JSON file's existence, checking out a git branch).
3. **Escalation is explicit.** When a `sonnet` phase hits a decision point that needs deeper reasoning, the command file declares the escalation in its `## Model Assignment` block. The orchestrator logs whether the escalation was actually invoked — missed escalations are a measurable quality signal.
4. **Dual-layer model.** The user's interactive Claude Code session inherits `ANTHROPIC_MODEL` from `~/.claude/settings.json` (typically `opus`) so direct user prompts get the strongest model. GSD-T subagent spawns override this per-phase via the `model:` directive in the spawn prompt — `sonnet` for routine execution, `opus` for partition/discuss/Red Team/verify, `haiku` for mechanical subroutines.
5. **Graceful degradation on `/advisor` absence.** If the `/advisor` tool is unavailable at runtime (not installed, no API access, convention-based fallback path), the caller proceeds at the assigned model and logs the missed escalation. No crash, no block.

---

## Tier Definitions

### `haiku` — mechanical subroutines only

**Use for**: tasks where the only "work" is running a deterministic command and reporting its output. There is no judgment involved — the tool does the work, the model just reports the result.

Canonical `haiku` phases:
- Test-runner dispatch (run `npm test`, report `N/M pass` count)
- Branch guard checks (run `git branch --show-current`, compare to expected)
- File existence checks (stat a path, report boolean)
- JSON structure validation (parse a file, report valid/invalid)
- Token-count bracket calls themselves (read state file, report number)
- Observability log appends (append a row to `token-log.md`)

**Never use `haiku` for**: writing code, writing tests, writing contract language, synthesizing a summary, judging whether something is "done", analyzing an error message.

### `sonnet` — the default for routine work

**Use for**: the bulk of GSD-T execution. `sonnet` is strong enough for the vast majority of tasks and is the default whenever a phase is not explicitly assigned to `haiku` or `opus`.

Canonical `sonnet` phases:
- `execute` Step 2 (routine code changes inside a single domain)
- `test-sync` assertion writing
- `doc-ripple` downstream updates
- `quick` single-task execution
- `integrate` wiring between domains
- `debug` fix-apply iterations (the "try this change" step, not the root-cause step)
- `gap-analysis` requirement-to-code mapping
- `backlog-promote` classification

**Escalation hooks allowed**: `sonnet` phases may declare in-phase checkpoints that escalate to `opus` via `/advisor` (see Escalation Hook Pattern below).

### `opus` — high-stakes reasoning

**Use for**: decision points where a wrong answer creates downstream rework, broken contracts, or silent quality regressions. Opus is the right model when the cost of a single bad decision exceeds the marginal token cost of the stronger tier.

Canonical `opus` phases:
- `partition` — decomposing work into domains and drawing contracts
- `discuss` — multi-perspective design exploration
- `verify` judgment — the "is this actually done?" call, not the test runner
- `debug` root-cause analysis — hypothesis generation from error evidence (cycle-1; cycle-2 escalates to fable)
- `complete-milestone` goal-backward verification
- Contract design and cross-module refactor planning
- Competition producers (M82 — HELD at opus; must differ from the fable judge)

**Escalation hooks**: An `opus` phase may escalate to `fable` for the 5 highest-leverage stages. See `model-tier-policy-contract.md` v1.0.0 for the authoritative list.

### `fable` — highest-stakes calls (M85, tier above opus)

**Use for**: stages where one call's judgment gates the most downstream spend. Claude Fable 5 (`claude-fable-5`, $10/$50 per MTok, 1M ctx / 128K out, same API surface as Opus 4.8). **Breaking change**: explicit thinking-disabled parameter returns HTTP 400 — it MUST be OMITTED (not set false). This is encoded once in `requiresThinkingOmitted(model)` in `bin/gsd-t-model-tier-policy.cjs`.

Canonical `fable` stages (authoritative mapping in `.gsd-t/contracts/model-tier-policy-contract.md` v1.0.0 STABLE):
- Solution-space probe (`gsd-t-phase.workflow.js`) — one call decides whether to fan out 3× competition spend
- Partition probe (`gsd-t-phase.workflow.js`) — pre-produce compete/skip decision
- Competition judge (`gsd-t-phase.workflow.js`, `label: "judge:rubric"`) — different model than producers (M82 blindness invariant; producers stay `opus`)
- Pre-mortem (`gsd-t-phase.workflow.js`, `label: "pre-mortem"`) — adversarial plan attack; one missed failure costs all of execute + verify
- Red Team (`gsd-t-verify.workflow.js`, `label: "red-team"`) — adversarial QA; stays NON-SKIPPABLE on fable tier
- Debug cycle-2 (`gsd-t-debug.workflow.js`, conditional: `cycle === 1 ? "opus" : "fable"`) — escalation before needs-human

**Drift enforcement**: `test/m85-workflow-tier-policy-lint.test.js` (M71-family) proves every workflow `model:` literal matches the tier set AND designated stages have the correct tier. A deliberately-drifted literal FAILS the lint (mandatory negative test). Shadow A/B verdict (M85-D4-T2, MEASURED 2026-06-09): quality TIE within judge noise (blind order-reversed sonnet referees SPLIT; mean A 4.50 vs B 4.58) at 2.37× cost for competition — Fable single-draft $4.74 vs 3-Opus-competition + Fable-judge $11.24, runs `wf_d6b75c28-7d4` / `wf_5d8bc13a-293` (n=1, discuss-class; full provenance + caveats in progress.md).

**Escalation hooks**: N/A. `fable` is the top of the escalation ladder.

---

## `selectModel()` API

```typescript
selectModel({
  phase: string,             // e.g. "execute", "red-team", "partition"
  task_type?: string,        // e.g. "bin-script", "frontend", "contract"
  domain_type?: string,      // e.g. "backend-api", "frontend-ui"
  complexity_signals?: {     // optional — can override the phase default
    hypothesis_count?: number,
    fix_cycle_count?: number,
    error_class?: string,
  },
}) => {
  model: 'haiku' | 'sonnet' | 'opus',
  reason: string,            // human-readable explanation ("phase default: opus (Red Team)")
  escalation_hook: string | null,  // description of in-phase escalation, or null
}
```

**Resolution order**:
1. If a `complexity_signals` field crosses a declared override threshold (e.g., `hypothesis_count > 2` for debug phases), escalate to the next tier.
2. Otherwise, return the phase default from the declarative rules table (see `bin/model-selector.js` — M35 Wave 2, pending).
3. Unknown phases fall through to `sonnet` (safe default — strong enough for almost anything).

The declarative rules table is a plain JavaScript array of rule objects, not an if/else chain. Adding a new phase = appending a rule. See `bin/model-selector.js` for the canonical table (pending — landing in M35 Wave 2 Task 2).

---

## Escalation Hook Pattern

A `sonnet`-default phase may declare that specific in-phase checkpoints escalate to `opus` via `/advisor`. The declaration lives in the command file's `## Model Assignment` block and is mirrored in `bin/model-selector.js`'s `escalation_hook` field.

**Canonical `## Model Assignment` block format** (copy-paste template for M35 Wave 2 Task 5):

```
## Model Assignment

- Default: sonnet
- Escalation points:
  - Step 5 (verify-fix): escalate to opus via /advisor if test still fails after fix-apply
  - Step 6 (root-cause): escalate to opus via /advisor when hypothesis count exceeds 2
- Mechanical subroutines: haiku (Step 0 branch guard, Step 4 test runner)
```

**Semantics**:
- **`Default`** — the tier the phase runs on absent any escalation. Every command file must declare this.
- **`Escalation points`** — zero or more lines of the form `Step N ({purpose}): escalate to {tier} via /advisor when {condition}`. The orchestrator logs each declared escalation point to `.gsd-t/token-log.md` as either `escalated` (advisor was invoked) or `escalation missed` (condition was met but advisor was not invoked).
- **`Mechanical subroutines`** — zero or more steps within the phase that run on a lower tier (typically `haiku`) because the work is strictly mechanical. These are NOT escalations — they are demotions for specific well-bounded subroutines.

**Multiple defaults**: A command file may declare more than one phase section (e.g., `gsd-t-debug.md` has separate blocks for the fix-apply loop and the root-cause analysis). Each block is evaluated independently.

---

## `/advisor` Fallback Behavior

When a `sonnet` phase declares an escalation hook, the command file instructs its subagent prompt to invoke `/advisor` at the declared checkpoint. Three possible outcomes:

1. **Programmable path** — if Claude Code's native `/advisor` tool exposes a programmable API (determined by `.gsd-t/M35-advisor-findings.md`, created in model-selector-advisor Task 1), `bin/advisor-integration.js` calls it directly and returns the guidance to the subagent. The subagent applies the guidance and proceeds.

2. **Convention path** — if `/advisor` is user-initiated only, the command file injects an instructional block into the subagent's system prompt telling the subagent to request `/advisor` guidance at the declared checkpoint. `bin/advisor-integration.js` records whether the subagent complied (via a marker in `.gsd-t/token-log.md`) and the orchestrator tracks the miss rate as a quality signal.

3. **Unavailable path** — if `/advisor` is not installed or not reachable, the subagent proceeds at the assigned model (`sonnet`), `bin/advisor-integration.js` logs a "missed escalation" record, and the orchestrator does NOT block or degrade. This is the graceful-degradation guarantee — a missing `/advisor` never halts a GSD-T run.

Which path is active is determined at runtime by `bin/advisor-integration.js` probing the tool surface. The contract does not mandate a specific path — it mandates that all three paths are supported and none crash.

---

## Dual-Layer Model Convention

GSD-T runs inside a user's Claude Code session. That session has a global model preference — typically `opus`, set via `ANTHROPIC_MODEL` in shell environment or `~/.claude/settings.json`. This is the **interactive layer**: when the user types a prompt directly, they get `opus`.

When GSD-T spawns a subagent via the Task tool or a TeamCreate, the subagent inherits the session's model unless the spawn prompt explicitly overrides it with a `model:` directive. The `## Model Assignment` block in each command file determines the override value.

**Do not remove the user's global `ANTHROPIC_MODEL=opus` setting.** That is their interactive session default, independent of GSD-T. GSD-T overrides it per-spawn via the `model:` directive; that is the mechanism, and the two layers coexist cleanly.

**Example flow**:
1. User's shell has `ANTHROPIC_MODEL=opus`.
2. User types `/gsd-t-execute` in their session. Claude Code runs on `opus`.
3. Claude Code (running on `opus`) reads `commands/gsd-t-execute.md`, sees `## Model Assignment: Default: sonnet`, and issues the `execute` subagent spawn with `model: sonnet`. The subagent runs on `sonnet`.
4. The subagent hits a declared escalation point (e.g., "verify-fix after test failure"). It invokes `/advisor` (programmable path) or emits an `/advisor` request block (convention path). The `/advisor` call runs on `opus`.
5. The subagent proceeds on `sonnet` with the `opus` guidance applied.

The user's interactive layer (`opus`) is untouched. The subagent layer (`sonnet` by default, `opus` for escalations) is controlled by GSD-T.

---

## Phase Map (canonical — matches `bin/model-selector.js`)

This table is the source of truth for phase-to-tier assignments. `bin/model-selector.js` (M35 Wave 2 Task 2) must match this table exactly — any divergence is a defect.

| Phase | Tier | Escalation Hook | Rationale |
|---|---|---|---|
| `partition` | `opus` | (none) | Decomposition + contract drawing — cost of a bad partition is massive downstream rework |
| `discuss` | `opus` | (none) | Multi-perspective reasoning — benefits from the strongest model |
| `plan` | `opus` | (none) | Task decomposition — cost of a bad plan is domino-effect rework |
| `impact` | `opus` | (none) | Cross-module blast-radius analysis |
| `execute` | `sonnet` | Step 2 (code-apply): escalate to opus via /advisor when a test fails twice | Routine code changes are sonnet-strong; stuck iterations need opus judgment |
| `test-sync` | `sonnet` | (none) | Mechanical test writing to match code changes |
| `integrate` | `sonnet` | Integration Step 4 (contract-conflict): escalate to opus via /advisor if cross-domain assertion fails | Wiring is routine; contract conflicts need opus |
| `verify` | `opus` | (none) | "Is this actually done?" — the goal-backward judgment call |
| `debug` (fix-apply) | `sonnet` | Step 5 (verify-fix): escalate to opus via /advisor if test still fails after fix | Routine patches sonnet; stuck debug needs opus |
| `debug` (root-cause) | `opus` | (none) | Hypothesis generation from evidence — cost of wrong hypothesis is chasing phantoms |
| `doc-ripple` | `sonnet` | (none) | Mechanical downstream updates |
| `quick` | `sonnet` | single-task escalation: escalate to opus via /advisor if complexity signal | Most quick tasks are routine |
| QA (inline) | `sonnet` | (none) | Routine test generation + execution |
| Red Team | `opus` | (none) | Adversarial — the whole point is to find bugs routine models miss |
| Branch guard / file exists / JSON validate | `haiku` | N/A | Strictly mechanical — no judgment |
| Test-runner dispatch | `haiku` | N/A | Mechanical — run the command, report the count |
| `complete-milestone` goal-backward | `opus` | (none) | Quality judgment on the whole milestone |

**Minimum count guarantee**: at least 8 distinct phase mappings covering the 13 phase categories above. The table above has 17 entries covering all 13 categories — exceeds the guarantee.

---

## Observability Contract

Every subagent spawn logs its model assignment to `.gsd-t/token-log.md` via the existing OBSERVABILITY LOGGING block. The `Model` column (already present in the token-log schema) records the tier at spawn time. Historical note: M35 also wrote per-spawn records with an `escalated_via_advisor` boolean to `.gsd-t/token-metrics.jsonl`; M38 retires that JSONL stream (along with the deleted token-telemetry-contract), so the escalation signal now lives only in the observability log.

- **`escalated_via_advisor: true`** — the subagent invoked `/advisor` at a declared escalation point.
- **`escalated_via_advisor: false`** — no escalation attempted (either the condition was not met or `/advisor` was unavailable).
- **`escalation missed` marker in `token-log.md`** — the declared condition WAS met but `/advisor` was not invoked (either convention-path non-compliance or programmable-path failure). This is the measurable quality signal.

---

## Schema Freeze Policy

- The tier union is now `'haiku' | 'sonnet' | 'opus' | 'fable'` (extended in v1.1.0 — M85). The authoritative tier set is published by `bin/gsd-t-model-tier-policy.cjs`; this contract must not diverge from it.
- The `selectModel()` return shape `{model, reason, escalation_hook}` is frozen. Additive fields are allowed in v1.x minor bumps.
- The Phase Map above is the source of truth for phase-level assignments. Stage-level assignments (the 5 Fable stages + competition producers + debug cycle conditional) are governed by `model-tier-policy-contract.md` v1.0.0 STABLE. Changes to the canonical assignments must be reflected in both contracts atomically.
- The `## Model Assignment` block format in command files is frozen for v1.x. Parser tooling may assume the exact structure.

---

## Test Coverage (pending — M35 Wave 2)

- `test/model-selector.test.js` — ≥15 unit tests covering each phase mapping, unknown-phase fallback to sonnet, complexity-signal escalation overrides.
- `test/advisor-integration.test.js` — ≥10 unit tests covering programmable path (mocked), convention path, runtime unavailability, miss logging.

---

## Change Log

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | M35 / 2026-04-14 | Initial contract. Three-tier model (haiku/sonnet/opus), declarative phase map, escalation hook pattern, `/advisor` fallback semantics, dual-layer convention (`ANTHROPIC_MODEL` + `model:` directive). Replaces the silent degradation-action model-override map removed in `token-budget-contract.md` v3.0.0. |
| 1.1.0 | M85 / 2026-06-09 | Added `fable` tier (Claude Fable 5, tier above opus). Cross-referenced `model-tier-policy-contract.md` v1.0.0 STABLE as the single source of truth for stage-level assignments. Updated Schema Freeze Policy (tier union now 4-wide). Added Fable tier definition + 5 canonical stages. Shadow A/B verdict pending M85-D4-T2 (see progress.md). |
