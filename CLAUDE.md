# GSD-T Framework (@tekyzinc/gsd-t)

Prime Directives, core guards, and workflow rules live in `~/.claude/CLAUDE.md`. This file covers what's specific to this repo.

## Overview

Contract-driven development methodology for Claude Code. npm package providing slash commands, a CLI installer, templates, and stack rules for reliable parallelizable AI-assisted development.

## Autonomy Level

> Overrides global: pins the default from `~/.claude/CLAUDE.md` § Autonomy Levels.

**Level 3 — Full Auto**. Only pause for blockers, destructive actions, or project completion.

## Tech Stack

- **Language**: JavaScript (Node.js >= 16), zero external runtime deps for the installer
- **Distribution**: npm package `@tekyzinc/gsd-t`
- **CLI**: `bin/gsd-t.js` (install, update, init, status, uninstall, doctor, graph, headless, …)
- **Testing**: `npm test` (Node built-in test runner) + manual CLI testing

## Project Structure

```
bin/                     — CLI entry (gsd-t.js) + orchestrators (orchestrator.js, design-orchestrator.js)
                           + support modules (gsd-t-context-brief.cjs, cli-preflight.cjs, gsd-t-verify-gate.cjs, model-selector.js, …)
commands/                — slash commands for Claude Code (GSD-T workflow + utility)
templates/               — document + prompt + stack templates
  CLAUDE-{global,project}.md, requirements.md, architecture.md, workflows.md,
  infrastructure.md, progress.md, backlog.md, backlog-settings.md, design-contract.md
  prompts/               — validation subagent protocols (qa, red-team, design-verify)
  stacks/                — Stack Rules Engine templates (injected at spawn time)
scripts/                 — runtime scripts (design review, context meter hook, event writer)
examples/                — example project structure + settings
docs/methodology.md      — GSD → GSD-T evolution and concepts
package.json, README.md, GSD-T-README.md, CHANGELOG.md
```

Exact command list: `ls commands/`. Exact stack rule set: `ls templates/stacks/`. Don't hand-maintain counts in docs.

## Meta-Project Notes

- The "source" is the `.md` files in `commands/` + `templates/` and the JS in `bin/` + `scripts/`. There is no `src/`.
- Changes to command files change the methodology itself — treat them as code; verify by running the workflow.
- The `.gsd-t/` state dir coexists with the commands that *define* `.gsd-t/` — intentional.
- `bin/gsd-t.js` is the primary testable surface; command files are validated by use.

## Conventions

**CLI** — ANSI colors via escape codes, zero external deps, sync file APIs, version tracked in `package.json` and `~/.claude/.gsd-t-version`.

**Command files** — pure markdown, no frontmatter, accept `$ARGUMENTS`, step-numbered, thin Workflow invokers (`Workflow({scriptPath, args})`). Include a Document Ripple section listing files the underlying Workflow expects domain workers to update. Validation protocol bodies stay in `templates/prompts/*-subagent.md`; each triad agent reads its own protocol via Read at spawn time (the workflow embeds a Read directive, not the protocol text — the orchestrator has no `fs`). Don't inline the protocol body into the workflow script.

**Templates** — `{Project Name}`, `{Date}`, `{description}` replacement tokens; tables for structured data.

**Directory structure** — `.gsd-t/contracts/` (domain interfaces), `.gsd-t/domains/{name}/` (scope/tasks/constraints), `.gsd-t/milestones/` (archives), `.gsd-t/scan/` (analysis outputs).

**Publishing** — after `npm publish`, ALWAYS run `/gsd-t-version-update-all` to propagate to registered projects.

## Living Documents (project-specific)

Beyond the global Living Documents set (see `~/.claude/CLAUDE.md`), this repo treats the intention-first behavior map as source-of-truth: `.gsd-t/pseudocode/PseudoCode-[Title].md` is authored before a milestone build and rippled in the same pass whenever code/contract/schema changes (M91). A supersede of shipped behavior writes a `⚠ Divergence` flag; the `[RULE]` guard map feeds the deterministic verify gate.

## GSD-T Workflows (M61 — v4.0.10+)

Phase orchestration lives in `templates/workflows/`. Each command file (`commands/gsd-t-*.md`) is a thin invoker that calls `Workflow({scriptPath, args})`. Canonical scripts:

- `gsd-t-execute.workflow.js` — preflight → brief → file-disjointness → parallel(domain workers) → integrate → verify-gate
- `gsd-t-verify.workflow.js` — orthogonal triad with M57 CI-parity + M58 test-data purge as FAIL-blocking gates
- `gsd-t-wave.workflow.js`, `-integrate`, `-debug`, `-quick`, `-phase` (generic upper-stage runner; M82: `-phase` carries the opt-in `competition: N` arm — generate-and-judge on partition/milestone/discuss/design-decompose, judged by `bin/gsd-t-competition-judge.cjs`; contract `competition-mode-contract.md`)

**Runtime-native invariant (M81 — v4.0.29+):** the Anthropic Workflow sandbox provides ONLY the globals `agent/parallel/pipeline/log/phase/budget/args` — NO `require`/`fs`/`path`/`child_process`/`process`, and `args` arrives as a JSON STRING. Every `*.workflow.js` MUST be self-contained: it `JSON.parse`s `args`, and delegates all CLI calls (preflight, verify-gate, brief, build-coverage, ci-parity, test-data, parallel/disjointness) to inline `async` helpers that run the command via an `agent()`'s Bash (preferring project-local `bin/<tool>.cjs`, falling back to the global `gsd-t` PATH binary) and parse the JSON envelope. The old `require("./_lib.js")` pattern threw `ReferenceError` on first eval — it silently broke every workflow except scan (TD-113). `_lib.js` is retired as a workflow dependency. The M71 lint (`test/m71-workflow-runtime-native-lint.test.js`) enforces this for all 8 workflows.

The brains stay in `bin/`: `gsd-t-file-disjointness.cjs`, `gsd-t-task-graph.cjs`, `gsd-t-context-brief.cjs`, `cli-preflight.cjs`, `gsd-t-verify-gate.cjs`, `gsd-t-verify-gate-judge.cjs`, `gsd-t-build-coverage.cjs`, `gsd-t-ci-parity.cjs`, `gsd-t-test-data-ledger.cjs`, `gsd-t-competition-judge.cjs` (M82), `gsd-t-traceability-gate.cjs` (M83), `gsd-t-model-tier-policy.cjs` (M85 — single source of truth for tier policy: haiku/sonnet/opus/fable + `resolveProfile`), `gsd-t-model-profile.cjs` (M86 — config read/write + CLI for per-project profile), `journey-coverage.cjs`. Workflows invoke them via an `agent()`-wrapped Bash call (the runCli inline helper), never via in-orchestrator `spawnSync`.

**M85 — Model-Tier Policy + Fable 5 tier:** `bin/gsd-t-model-tier-policy.cjs` is the SINGLE source of truth for model-tier assignments (haiku/sonnet/opus/fable). Contract: `.gsd-t/contracts/model-tier-policy-contract.md` v1.1.0 STABLE. The 5 highest-leverage stages run on Fable (solution-space probe, partition probe, competition judge, pre-mortem, Red Team); competition producers stay opus (M82 blindness invariant). Debug: cycle-1→opus, cycle-2→fable. The M71-family drift enforcer lint (`test/m85-workflow-tier-policy-lint.test.js`) proves every workflow `model:` literal matches the policy — a drifted literal FAILS the lint.

**M86 — Model Profiles (per-project tier-spend switch):** `bin/gsd-t-model-profile.cjs` adds a second dimension — three named profiles (`standard` / `pro` / `premium`) controlling which workflow stages run on Fable vs. Opus/Sonnet. Contract: `.gsd-t/contracts/model-profile-config-contract.md` v1.0.0 STABLE. Config: `.gsd-t/model-profile.json` (`{ "profile": "pro", "stageOverrides": {} }`). Absent file → global default (`premium`), NAMED as `profile: premium (default)` — SC(f) no-silent-degradation. Invoke-time injection: command invokers call the resolver and pass `overrides` into workflow `args`; workflows use `overrides["<stage>"] ?? "<premium-literal>"` (`??`-form). Blindness clamps enforced at resolve time: `competition-producers` not overridable; `competition-judge` cannot equal producers' model. D3 drift lint (`test/m86-lint-unwrap-fallback.test.js`) validates the `??`-form, bracket key, and fallback literals. Active profile surfaced in session banner (`[GSD-T PROFILE]`), statusline, and `gsd-t status` — always named.

## Validation Protocols (KEPT — methodology layer)

Three validation protocol bodies stay at `templates/prompts/`:
- `qa-subagent.md` — test mechanics + shallow-test detection + contract compliance
- `red-team-subagent.md` — adversarial / security / boundaries; verdict `FAIL` / `GRUDGING-PASS`
- `design-verify-subagent.md` — visual MATCH/DEVIATION against the design contract
- `pre-mortem-subagent.md` (M83) — adversarial PLAN review (pre-execute): predicts edge-case / dead-deliverable / NFR failures, each → a required test; verdict `BLOCK` / `CLEARED`. The temporal dual of the Red Team (attack the design at plan, not the code at verify). Contract: `plan-hardening-contract.md`.

These are invoked as Workflow `agent()` stages with schema-validated output. The methodology body is unchanged; only the invocation context (Workflow stage vs. Task subagent) updated. Per `.gsd-t/contracts/orthogonal-validation-contract.md` v1.0.0 STABLE.


# Destructive Action Guard (MANDATORY)

**NEVER perform destructive or structural changes without explicit user approval.** This applies at ALL autonomy levels.

Before any of these actions, STOP and ask the user:
- DROP TABLE, DROP COLUMN, DROP INDEX, TRUNCATE, DELETE without WHERE
- Renaming or removing database tables or columns
- Schema migrations that lose data or break existing queries
- Replacing an existing architecture pattern (e.g., normalized → denormalized)
- Removing or replacing existing files/modules that contain working functionality
- Changing ORM models in ways that conflict with the existing database schema
- Removing API endpoints or changing response shapes that existing clients depend on
- Any change that would require other parts of the system to be rewritten

**Rule: "Adapt new code to existing structures, not the other way around."**

## Pre-Commit Gate (project-specific additions)

The global gate applies first (see `~/.claude/CLAUDE.md`). Additionally for this repo:

- **Command file interface/behavior changed** → update `GSD-T-README.md` + `README.md` commands table + `templates/CLAUDE-global.md` + `commands/gsd-t-help.md`.
- **Command added/removed** → update all 4 files above, bump `package.json`, update any command-counting logic in `bin/gsd-t.js`.
- **New command invokes a Workflow** → verify `scriptPath` resolves to `templates/workflows/<name>.workflow.js` and `args` shape matches the script's `meta.phases`.
- **CLI installer changed** → smoke test `install`, `update`, `status`, `doctor`, `init`, `uninstall`.
- **Template changed** → verify `gsd-t-init` still produces correct output.
- **Wave flow changed (phases added/removed/reordered)** → update `gsd-t-wave.md`, `GSD-T-README.md` wave diagram, `README.md` workflow section.
- **Contract or domain boundary changed** → update `.gsd-t/contracts/` and owning `scope.md`.

## Don't

- NEVER add external npm runtime dependencies to the installer — zero-dep invariant.
- NEVER rename a command without updating all 4 reference files above.
- NEVER modify wave phase sequence without updating wave, README, GSD-T-README in the same commit.
- NEVER let installer's command count diverge from `commands/` directory reality.
- NEVER inline validation-subagent protocol bodies into Workflow scripts — each triad agent reads its own `templates/prompts/{qa,red-team,design-verify}-subagent.md` via Read at spawn time (the workflow passes a Read directive; the sandboxed orchestrator can't read files).
- NEVER reintroduce `require`/`fs`/`path`/`child_process`/`process` into a `*.workflow.js` — the sandbox forbids them (TD-113). Delegate CLI calls to an `agent()`'s Bash via the inline runCli helper.

## Recovery After Interruption

1. Read `.gsd-t/progress.md`
2. Read `README.md` for what the package delivers
3. Check `commands/` and `package.json` for current state
4. Continue from current task; don't restart the phase

## Current Status

See `.gsd-t/progress.md`.
