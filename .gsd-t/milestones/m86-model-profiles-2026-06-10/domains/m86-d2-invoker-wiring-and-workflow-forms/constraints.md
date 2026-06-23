# Constraints: m86-d2-invoker-wiring-and-workflow-forms

## Hard Invariants

- **Runtime-native (TD-113).** The workflow sandbox provides ONLY
  `agent/parallel/pipeline/log/phase/budget/args` — NO `require`/`fs`/`path`/`child_process`/
  `process`. `args` arrives as a JSON STRING. Each workflow `JSON.parse`s `args` and reads
  `overrides`. NEVER reintroduce `require`/`fs`/`spawnSync` (the M71 lint enforces this).
- **Exact `??` form.** Each designated stage MUST be literally
  `model: overrides["<stage>"] ?? "<premium-literal>"` — the form D3's lint unwraps. The
  premium literal MUST match the M85/D1 policy (the premium-active tier for that stage):
  - solution-space-probe → `"fable"`, partition-probe → `"fable"`, competition-judge → `"fable"`,
    pre-mortem → `"fable"`, red-team → `"fable"`, debug-cycle-2 → `"fable"`.
- **Producers HELD opus.** Do NOT wrap `competition-producers` (M82 blindness invariant). It
  stays a bare `model: "opus"` literal.
- **Fallback safety.** When `overrides` is absent/empty, the premium literal applies — the
  workflow behaves byte-identically to M85 today (premium = M85 default posture). No regression.
- **Stay self-contained.** Each workflow `JSON.parse`s its own `args`; default `overrides` to
  `{}` so an invoker that doesn't inject still works.

## File-Disjointness (re-validated by partition oracle)

- This domain WRITES ONLY (expanded at plan-hardening r1 #1): `templates/workflows/gsd-t-phase.workflow.js`,
  `gsd-t-verify.workflow.js`, `gsd-t-debug.workflow.js`, `gsd-t-wave.workflow.js` (overrides
  forwarding ONLY — no model: lines), `commands/gsd-t-partition.md`, `commands/gsd-t-verify.md`,
  `commands/gsd-t-debug.md`, `commands/gsd-t-plan.md`, `commands/gsd-t-milestone.md`,
  `commands/gsd-t-impact.md`, `commands/gsd-t-prd.md`, `commands/gsd-t-design-decompose.md`,
  `commands/gsd-t-doc-ripple.md`, `commands/gsd-t-wave.md`, `test/m86-invoker-injection.test.js`.
- It does NOT touch the lint (D3) — write-disjoint, so a defect here cannot mask a guard defect.
  (`test/m86-invoker-injection.test.js` is D2's OWN static guard over command files, not the
  model-literal lint — D3's files stay untouched.)
- It does NOT touch `bin/`, config, the contracts (D1), or `scripts/`/status/help/README (D4).
- `gsd-t-execute/integrate/quick/scan` workflows are NOT designated-stage carriers for M86 —
  leave them untouched (they have no `??`-eligible stages in scope per the milestone).

## Pre-Commit Gate (domain-specific)

- New command invokes a Workflow → verify `scriptPath` resolves via `gsd-t workflow-path <name>`
  (M69) and `args` shape matches the script's `meta.phases` + the new `overrides` field.
- Workflow source changed → MUST run the affected workflow to completion in the real sandbox
  (node --check is insufficient — see `feedback_workflow_must_run_in_real_sandbox`). Confirm the
  `??` form resolves and zero require/fs reintroduced.
- Command-invoker behavior changed → README/help/GSD-T-README updates are D4's job; D2 only edits
  the three invoker bodies.
