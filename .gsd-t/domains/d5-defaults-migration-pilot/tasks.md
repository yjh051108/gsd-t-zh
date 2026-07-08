# Tasks: d5-defaults-migration-pilot

## Summary
Delivers the two CLAUDE.md defaults rippled across all reference docs (W3), the brownfield migration command proven on a throwaway fixture (W3), and the UMI-Automation greenfield build-into pilot with BOTH streams — the milestone's HEADLINE payoff (W4) — all depending on the full machinery. File-disjoint from every machinery domain; does NOT edit `bin/gsd-t.js` (d1 wires the dispatch case via the seam).

## Wave
W3-4 — depends on ALL machinery (d1/d2/d3/d4). T1+T2 = W3 (defaults + migration); T3 = W4 (UMI pilot, the falsifiable payoff, in the SEPARATE repo `/Users/david/projects/UMI-Automation`).

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

### M100-D5-T3 (Wave 4): UMI-Automation greenfield build-into pilot — HEADLINE
- **Headline:** true
- **Touches**: `/Users/david/projects/UMI-Automation/src/logging/trace.ts`, `/Users/david/projects/UMI-Automation/src/logging/audit.ts`, `/Users/david/projects/UMI-Automation/CLAUDE.md`, `/Users/david/projects/UMI-Automation/docs/infrastructure.md`
- **Files**: `/Users/david/projects/UMI-Automation/src/logging/trace.ts` (trace points on Grain/Airtable/Anthropic/Apify REST calls), `/Users/david/projects/UMI-Automation/src/logging/audit.ts` (audit targets on PodCoach draft-approval), `/Users/david/projects/UMI-Automation/CLAUDE.md` (storage choice + two rules), `/Users/david/projects/UMI-Automation/docs/infrastructure.md`
- **Contract refs**: `trace-logging-contract.md`, `audit-logging-contract.md`, `logging-schema-distillation-contract.md`, `logging-scaffold-seam-contract.md`
- **Dependencies**: BLOCKED by M100-D5-T1 + M100-D5-T2 + d2 (trace module + distiller) + d4 (audit module + distiller)
- **Test**: `test/m100-d5-migration-fixture.test.js` (UMI end-to-end assertion) — **HEADLINE END-TO-END TEST**: builds real trace + audit records from the UMI modules (a Grain/Airtable/Anthropic/Apify trace point AND a PodCoach draft-approval audit target, distilled from UMI's ACTUAL plan — none confabulated), runs BOTH through d3's `gsd-t-logging-envelope-check.cjs` gate and asserts BOTH streams PASS AND the no-collapse boundary holds (a trace record with an audit marker, or vice-versa, FAILS). Asserts the UMI storage choice is recorded in UMI's CLAUDE.md and that NO project other than UMI is touched. This is the milestone's headline capability exercised end-to-end — it is NOT deferred.
- **ImplPath**: instantiate the d2 trace module + d4 audit module inside UMI, wire the distilled categories/actions to UMI's real REST/approval seams, record the storage choice, and run the envelope gate over live records from both streams.
- **Acceptance criteria**:
  - Trace points on Grain/Airtable/Anthropic/Apify REST calls; audit targets on PodCoach draft-approval — distilled from UMI's real plan (#14–15).
  - UMI has BOTH streams, passes d3's envelope gate for both, no-collapse; storage choice recorded in UMI CLAUDE.md.
  - No other project touched (#16).

## Execution Estimate
- Total tasks: 3
- Independent tasks: 0 (all blocked on machinery)
- Blocked tasks: 3 (Waves 3-4, sequenced)
- Estimated checkpoints: 2 (Wave-3 defaults+migration, Wave-4 pilot)
