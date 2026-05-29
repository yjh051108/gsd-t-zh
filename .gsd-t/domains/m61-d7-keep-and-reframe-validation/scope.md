# Domain: m61-d7-keep-and-reframe-validation

## Responsibility
KEEP the methodology gates unchanged. REFRAME Red Team / QA / Design-Verify as Workflow stages (perspective-diverse adversarial `parallel()` calls). DE-WIRE command files from retired `gsd-t-token-capture` wrapper and `headless-auto-spawn` calls. Add `/code-review ultra` as a cooperative correctness/cleanup pass in verify. **Wave 2 (parallel with D2 retire-relay).**

Declares Red Team / QA / `/code-review ultra` as **orthogonal objective functions** so future Claude doesn't collapse them.

## Owned Files (KEEP unchanged — methodology, not infra)

Listed for explicit protection during M61 (cannot be deleted by retire domains):
- `bin/gsd-t-verify-gate.cjs` + `bin/gsd-t-verify-gate-judge.cjs`
- `bin/gsd-t-ci-parity.cjs`
- `bin/gsd-t-build-coverage.cjs`
- `bin/gsd-t-test-data-ledger.cjs` + `bin/gsd-t-test-data-adapters/*` (M60-hardened)
- `bin/journey-coverage.cjs` + `bin/journey-coverage-cli.cjs`
- `bin/cli-preflight.cjs`
- `bin/gsd-t-context-brief.cjs` (MORE valuable post-M61 — cheap context for Workflow agents)
- `bin/playwright-bootstrap.cjs` + `bin/ui-detection.cjs`
- All scan engine modules + `bin/rule-engine*` + `bin/graph-*`
- `bin/archive-progress.cjs` + `bin/global-sync-manager.cjs`
- `templates/prompts/qa-subagent.md`, `red-team-subagent.md`, `design-verify-subagent.md`

## Owned Files (edit — Wave 2 de-wire)

Remove `captureSpawn` / `recordSpawnRow` / `autoSpawnHeadless` / `gsd-t-unattended` / `headless-auto-spawn` references from command files. After this commit, retire waves can safely delete the underlying modules in Wave 3.

- `commands/gsd-t-execute.md` — strip OBSERVABILITY LOGGING block + headless-spawn check
- `commands/gsd-t-verify.md` — strip OBSERVABILITY LOGGING + headless-spawn check (KEEP Step 2.6 CI-parity, Step 4.5 test-data purge)
- `commands/gsd-t-integrate.md` — strip OBSERVABILITY + headless
- `commands/gsd-t-debug.md` — strip OBSERVABILITY + headless + `gsd-t headless --debug-loop` reference (replaced by D6 debug.workflow.js)
- `commands/gsd-t-wave.md`, `quick.md`, `plan.md`, `prd.md`, `design-decompose.md`, `doc-ripple.md`, `help.md` — strip OBSERVABILITY block
- `commands/gsd-t-init.md`, `scan.md` — strip headless-spawn check

## Owned Files (create)

- `.gsd-t/contracts/orthogonal-validation-contract.md` — locks the rule: `/code-review ultra` = correctness + cleanup (cooperative); Red Team = adversarial / security / boundaries; QA = test execution + shallow-test detection + contract compliance. Future Claude collapsing them = contract violation.
- Reframed validation subagent prompts (if needed) under `templates/prompts/` — the protocols themselves stay; only the invocation context changes (Workflow stage vs. Task spawn).

## Owned Files (edit — verify wiring)

- `commands/gsd-t-verify.md` (or its D6 Workflow analogue) — add `/code-review ultra` invocation step running parallel to the Red Team Workflow stage. Choose ordering (pre-Red-Team / post-Red-Team / parallel) at execute time; pick whichever produces the clearest verify report.

## NOT Owned (do not modify)
- Any D1-D5 retire targets (they get deleted; we just stop calling them)
- D6 Workflow scripts (we declare orthogonal validation, but D6 implements the Workflow stages)
- D8 CLAUDE.md edits (those come after this)

## Estimated LOC
- KEEP list: 0 LOC change (this is the explicit-protection scope)
- De-wire edits: ~200-400 LOC removed across 13 command files (the OBSERVABILITY blocks)
- New contract: ~100 LOC

## Pre-merge gate
After D7 Wave 2 commits:
1. `grep -rn "captureSpawn\|recordSpawnRow\|autoSpawnHeadless" commands/*.md` returns zero hits
2. `grep -rn "gsd-t-token-capture\|headless-auto-spawn\|gsd-t-unattended" commands/*.md bin/gsd-t.js` returns only references about to be retired in Wave 3
3. `/code-review ultra` invocation present in verify path
4. Orthogonal validation contract STABLE and referenced from CLAUDE.md (D8 picks it up)
