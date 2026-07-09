# Tasks: d5-defaults-migration-pilot

## Summary
Delivers the two CLAUDE.md defaults rippled across all reference docs (W3), the brownfield migration command proven on a throwaway fixture (W3), and the UMI-Automation greenfield build-into pilot with BOTH streams — the milestone's HEADLINE payoff (W4) — all depending on the full machinery. File-disjoint from every machinery domain; does NOT edit `bin/gsd-t.js` (d1 wires the dispatch case via the seam).

## Wave
W3-4 — depends on ALL machinery (d1/d2/d3/d4). T1+T2 = W3 (defaults + migration); T2c+T2d = W3 seam-integration (opt-out shared-fixture test, real-template durability composition test — both run once d3/d4's Wave-2 pieces are green); T2b+T3 = W4 (T2b bootstraps UMI's TS toolchain PRE-PILOT, then T3 = UMI pilot, the falsifiable payoff, in the SEPARATE repo `/Users/david/projects/UMI-Automation`).

## Tasks

### M100-D5-T1 (Wave 3): Two CLAUDE.md hard rules + reference-doc ripple
- **Touches**: `templates/CLAUDE-global.md`, `README.md`, `GSD-T-README.md`, `commands/gsd-t-help.md`
- **Files**: `templates/CLAUDE-global.md` (the two hard rules: trace default every project; audit default-except-opt-out) + reference-doc ripple across `README.md`, `GSD-T-README.md`, `commands/gsd-t-help.md`
- **Contract refs**: `trace-logging-contract.md`, `audit-logging-contract.md`
- **Dependencies**: BLOCKED by d1/d2/d3/d4 (machinery must exist to reference)
- **Test**: `test/m100-d5-migration-fixture.test.js` (ripple assertion) — greps all four reference docs and asserts BOTH rules (trace=default, audit=default-except-opt-out) are present in each, and that the opt-out mechanism is documented; a doc missing either rule FAILS (Document Ripple Completion Gate mechanized).
- **ImplPath**: add the two hard-rule blocks to `templates/CLAUDE-global.md`; mirror the rule text + the migration command reference into the other three docs in the SAME pass.
- **Acceptance criteria**:
  - Two rules present + mirrored across all four docs (M100 #12); opt-out documented (#13).
  - Document Ripple Completion Gate: all four updated in one pass.

### M100-D5-T2 (Wave 3): Brownfield migration command on a throwaway fixture
- **Touches**: `bin/gsd-t-migrate-logging.cjs`, `commands/gsd-t-migrate-logging.md`, `test/m100-d5-migration-fixture.test.js`, `.gsd-t/contracts/logging-schema-distillation-contract.md`
- **Files**: `bin/gsd-t-migrate-logging.cjs` (brownfield migration module — ADDITIVE/non-destructive), `commands/gsd-t-migrate-logging.md` (thin command), `.gsd-t/contracts/logging-schema-distillation-contract.md` (publish)
- **Contract refs**: `logging-scaffold-seam-contract.md`, `logging-schema-distillation-contract.md`
- **Dependencies**: BLOCKED by M100-D1-T3 (dispatch `case "migrate-logging"` wired by d1)
- **Test**: `test/m100-d5-migration-fixture.test.js` — **KILLING TEST**: runs the migration against a THROWAWAY fixture repo and asserts it is ADDITIVE/non-destructive — every pre-existing file is byte-for-byte unchanged (snapshot before/after), only NEW logging files added; asserts the dispatch runs via `bin/gsd-t.js` `case "migrate-logging"` (d5 does not edit that file); asserts the distillation contract is consumed by d2/d4 distillers. A run that modifies or deletes any pre-existing fixture file FAILS.
- **ImplPath**: `migrateLogging(projectDir)` scaffolds trace+audit modules via the d1 seam and the d2/d4 templates without touching existing files; invoked through d1's dispatch case.
- **Acceptance criteria**:
  - Migration proven ADDITIVE / non-destructive on a throwaway fixture (#10–11).
  - Dispatch delegated to d1 (d5 does not edit `bin/gsd-t.js`).
  - Distillation contract published + consumed by d2/d4 distillers.

### M100-D5-T2c (Wave 3, seam integration): Opt-out record shared-fixture integration test
- **Touches**: `test/m100-d5-migration-fixture.test.js`
- **Files**: `test/m100-d5-migration-fixture.test.js` (shared-fixture opt-out integration case)
- **Contract refs**: `audit-logging-contract.md` §opt-out-record (M100 pre-mortem FINDING 2, HIGH)
- **Dependencies**: Requires M100-D4-T2 (`writeOptOut`) + M100-D3-T2 (`audit-default-except-optout` check)
- **Test**: `test/m100-d5-migration-fixture.test.js` (seam integration) — **ONE SHARED ARTIFACT, not two independent fixtures**: calls d4's real `writeOptOut(projectDir)` against a single fixture project dir, writing `.gsd-t/audit-optout.json` per `audit-logging-contract.md` §opt-out-record; then runs d3's real `audit-default-except-optout` gate check over that SAME fixture dir and asserts it reads the record d4 actually wrote and PASSES (opt-out honored, no audit store required); then asserts that with the record absent (a second fixture, no `writeOptOut` call) the SAME gate check FAILS the project for missing audit. A test that fabricates its own opt-out JSON instead of calling `writeOptOut` does not satisfy this task.
- **ImplPath**: fixture helper creates a temp project dir, invokes `writeOptOut(dir)` from d4's module, then invokes d3's envelope-check module's opt-out predicate directly against that dir; asserts read-what-was-written.
- **Acceptance criteria**:
  - d4's writer and d3's reader agree on ONE shared artifact at `.gsd-t/audit-optout.json` (#13).
  - Opt-out present → PASS; opt-out absent + no audit store → FAIL.

### M100-D5-T2d (Wave 3, seam integration): Real audit-template durability gate composition test
- **Touches**: `test/m100-d5-migration-fixture.test.js`
- **Files**: `test/m100-d5-migration-fixture.test.js` (real-template composition integration case)
- **Contract refs**: `audit-logging-contract.md` (`audit-append-only-immutable`, `audit-retention-configurable`)
- **Dependencies**: Requires M100-D4-T1 (real `templates/logging/audit-module.template.ts`) + M100-D3-T2 (`audit-append-only-immutable` + `audit-retention-configurable` checks in `bin/gsd-t-logging-envelope-check.cjs`)
- **Test**: `test/m100-d5-migration-fixture.test.js` (seam integration) — scaffolds d4's ACTUAL shipped `templates/logging/audit-module.template.ts` into a fixture project (not a hand-authored stand-in), runs d3's real durability gate (`audit-append-only-immutable` + `audit-retention-configurable` in `bin/gsd-t-logging-envelope-check.cjs`) against that scaffolded fixture and asserts PASS; then asserts the SAME gate FAILS against a deliberately-mutated copy of the template that exposes an update/delete path on the audit store, and separately FAILS a copy with a hardcoded (non-configurable) retention window. Proves the gate and the real template actually compose, not just that each passes its own domain's synthetic fixtures.
- **ImplPath**: fixture helper copies `templates/logging/audit-module.template.ts` verbatim into a temp project, instantiates it, runs `checkEnvelope`'s durability checks against the live instance; a second mutated-copy fixture (update/delete path added, or retention literal hardcoded) is asserted to FAIL the same checks.
- **Acceptance criteria**:
  - d3's real durability gate PASSES the real, unmodified d4 template (#7, #9).
  - The same gate FAILS a mutated copy exposing update/delete or hardcoded retention.

### M100-D5-T2b (Wave 4, pre-pilot): Bootstrap UMI-Automation TS toolchain
- **Touches**: `/Users/david/projects/UMI-Automation/package.json`, `/Users/david/projects/UMI-Automation/tsconfig.json`
- **Files**: `/Users/david/projects/UMI-Automation/package.json` (minimal manifest: `name`, `type`, a devDependency on `typescript` + `tsx` (or `ts-node`), a `build`/`typecheck` script), `/Users/david/projects/UMI-Automation/tsconfig.json` (real config: `moduleResolution: "node"` or `"bundler"`, `rootDir: "src"`, `baseUrl`, `outDir`)
- **Contract refs**: (none — infra bootstrap, no logging-contract behavior)
- **Dependencies**: BLOCKED by NOTHING upstream in GSD-T; MUST run BEFORE M100-D5-T3 (the headline task's `src/logging/*.ts` writes require a resolvable TS toolchain already in place — bootstrap-before-pilot, per user decision: option A, bootstrap UMI's TS toolchain in the pilot rather than assuming one exists).
- **Destructive-Action-Guard note**: UMI-Automation is a near-empty repo today. This task is ADDITIVE ONLY — it creates `package.json`/`tsconfig.json` where none of substance exist and installs the TS toolchain (`npm install`/equivalent). If either file already contains non-trivial pre-existing content (a real manifest or tsconfig beyond a stub), STOP and get explicit user approval before overwriting — do not silently replace pre-existing configuration.
- **Test**: `test/m100-d5-migration-fixture.test.js` (bootstrap sub-case) — asserts `package.json` exists with `typescript` + `tsx`/`ts-node` as a devDependency and a build/typecheck script; asserts `tsconfig.json` exists, parses as valid JSON, and declares `rootDir`/`baseUrl`/`outDir`/`moduleResolution`; asserts the toolchain is actually installed (e.g. `npx tsc --version` or `npx tsx --version` exits 0) — a stub-only config with no installed toolchain FAILS.
- **ImplPath**: write a minimal `package.json` + `tsconfig.json` into UMI-Automation and run the install step, BEFORE any file under `src/logging/` is written by M100-D5-T3.
- **Acceptance criteria**:
  - `package.json` + `tsconfig.json` exist in UMI-Automation with a real, resolvable TS toolchain (not stub files).
  - No pre-existing UMI file overwritten without explicit user approval.
  - M100-D5-T3's import-resolvability sub-case (c) PASSES only once this task has run; it FAILS against UMI's current empty state.

### M100-D5-T3 (Wave 4): UMI-Automation greenfield build-into pilot — HEADLINE
- **Headline:** true
- **Touches**: `/Users/david/projects/UMI-Automation/src/logging/trace.ts`, `/Users/david/projects/UMI-Automation/src/logging/audit.ts`, `/Users/david/projects/UMI-Automation/CLAUDE.md`, `/Users/david/projects/UMI-Automation/docs/infrastructure.md`
- **Files**: `/Users/david/projects/UMI-Automation/src/logging/trace.ts` (trace points on Grain/Airtable/Anthropic/Apify REST calls), `/Users/david/projects/UMI-Automation/src/logging/audit.ts` (audit targets on PodCoach draft-approval), `/Users/david/projects/UMI-Automation/CLAUDE.md` (storage choice + two rules), `/Users/david/projects/UMI-Automation/docs/infrastructure.md`
- **Contract refs**: `trace-logging-contract.md`, `audit-logging-contract.md`, `logging-schema-distillation-contract.md`, `logging-scaffold-seam-contract.md`
- **Dependencies**: BLOCKED by M100-D5-T1 + M100-D5-T2 + M100-D5-T2b (UMI TS toolchain bootstrap MUST run before this task writes `src/logging/*.ts` — bootstrap-before-pilot) + d2 (trace module + distiller) + d4 (audit module + distiller)
- **Test**: `test/m100-d5-migration-fixture.test.js` (UMI end-to-end assertion) — **HEADLINE END-TO-END TEST**: builds real trace + audit records from the UMI modules (a Grain/Airtable/Anthropic/Apify trace point AND a PodCoach draft-approval audit target, distilled from UMI's ACTUAL plan — none confabulated), runs BOTH through d3's `gsd-t-logging-envelope-check.cjs` gate and asserts BOTH streams PASS AND the no-collapse boundary holds (a trace record with an audit marker, or vice-versa, FAILS). Asserts the UMI storage choice is recorded in UMI's CLAUDE.md and that NO project other than UMI is touched. This is the milestone's headline capability exercised end-to-end — it is NOT deferred.
  - **Plan-grounding killing sub-cases (M100 pre-mortem FINDING 5, HIGH)**: (a) the distilled trace CATEGORIES asserted in this test are the OUTPUT of actually RUNNING `bin/gsd-t-trace-distill.cjs` against UMI's real `docs/plan.md` — never a literal array hand-authored into the test; each returned category must have a grep-able source line in that plan — a category with no plan-source line FAILS the test; (b) same discipline for the distilled audit ACTIONS via `bin/gsd-t-audit-distill.cjs` — every action must be grep-traceable to a plan line, INCLUDING the PodCoach draft-approval action, which is traced to UMI's mandatory-human-approve clause in `docs/plan.md:73`: *"Mandatory human review-and-approve gate on every draft (replaces the per-paste approval gate). PodCoach reviews + edits + approves."* (also echoed at `docs/plan.md:15/99/209` as "review/edit/approve") — (`before` = original draft, `after` = edited+approved draft). The test does NOT hardcode this quote as ground truth — it asserts the distilled PodCoach draft-approval action's CITED SOURCE STRING is FOUND by grepping UMI's real `docs/plan.md` at test-run time; a returned action whose cited source string is ABSENT from `plan.md` FAILS the test. This is CONFIRMED/grounded in the plan, not a hypothesis; any task/doc language still labeling this a 'HYPOTHESIS' must be updated to 'grounded in plan.md'; (c) asserts the pilot files land in a real, import-resolvable `src/logging/` path inside UMI-Automation by ACTUALLY importing them through the configured resolver (from M100-D5-T2b's `tsconfig.json` + installed toolchain) — e.g. `tsx -e "import('./src/logging/trace').then(m => process.exit(m.emitTrace ? 0 : 1))"` and the analogous check for `audit.ts`'s append helper (e.g. `m.appendAudit ? 0 : 1`) — each MUST exit 0 with the live symbol present, not merely `fs.existsSync`. This sub-case FAILS against UMI's current empty state (no toolchain, no tsconfig) and PASSES only after M100-D5-T2b's bootstrap has run — proving the dependency, not just asserting it in prose.
- **ImplPath**: instantiate the d2 trace module + d4 audit module inside UMI, wire the distilled categories/actions to UMI's real REST/approval seams, record the storage choice, and run the envelope gate over live records from both streams. Categories/actions come from RUNNING the distillers against UMI's real `docs/plan.md`, not from a hardcoded fixture list; the PodCoach draft-approval audit target is grounded in the plan's explicit review→edit→approve clause (confirmed, not hypothesized).
- **Acceptance criteria**:
  - Trace points on Grain/Airtable/Anthropic/Apify REST calls; audit targets on PodCoach draft-approval — distilled from UMI's real plan (#14–15).
  - UMI has BOTH streams, passes d3's envelope gate for both, no-collapse; storage choice recorded in UMI CLAUDE.md.
  - No other project touched (#16).
  - Distilled categories/actions are the OUTPUT of running the real distillers against UMI's `docs/plan.md`, each grep-traceable to a plan line; PodCoach draft-approval action confirmed grounded (not labeled HYPOTHESIS).
  - Pilot files resolve as real, import-resolvable modules under `src/logging/` in UMI-Automation.

## Execution Estimate
- Total tasks: 6
- Independent tasks: 0 (all blocked on machinery)
- Blocked tasks: 6 (Waves 3-4, sequenced; T2b precedes T3 within Wave 4)
- Estimated checkpoints: 2 (Wave-3 defaults+migration+seam-integration, Wave-4 bootstrap+pilot)
