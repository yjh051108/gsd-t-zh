# Domain: d5-defaults-migration-pilot

## Responsibility
TIER 3 + TIER 4 (Waves 3-4 — depends on ALL machinery). Two parts, sequenced but file-disjoint from every machinery domain: (Wave 3) the TWO CLAUDE.md hard rules (trace default every project; audit default except explicit opt-out) rippled across the sole-owned reference-doc set, plus the brownfield MIGRATION command proven on a throwaway fixture; (Wave 4) the UMI-Automation greenfield build-into pilot, ALL pilot files in the SEPARATE repo `/Users/david/projects/UMI-Automation`, trivially disjoint from every GSD-T-repo domain.

## Files Owned
- `templates/CLAUDE-global.md`
- `README.md`
- `GSD-T-README.md`
- `commands/gsd-t-help.md`
- `bin/gsd-t-migrate-logging.cjs`
- `commands/gsd-t-migrate-logging.md`
- `test/m100-d5-migration-fixture.test.js`
- `.gsd-t/contracts/logging-schema-distillation-contract.md`
- `/Users/david/projects/UMI-Automation/src/logging/trace.ts`
- `/Users/david/projects/UMI-Automation/src/logging/audit.ts`
- `/Users/david/projects/UMI-Automation/CLAUDE.md`
- `/Users/david/projects/UMI-Automation/docs/infrastructure.md`
- `/Users/david/projects/UMI-Automation/package.json` (M100-D5-T2b — TS toolchain bootstrap, pre-pilot)
- `/Users/david/projects/UMI-Automation/tsconfig.json` (M100-D5-T2b — TS toolchain bootstrap, pre-pilot)

## Owned Files/Directories
- `templates/CLAUDE-global.md` — the two logging hard rules (trace default; audit default-except-opt-out).
- `README.md`, `GSD-T-README.md`, `commands/gsd-t-help.md` — reference-doc ripple of the two rules + the migration command.
- `bin/gsd-t-migrate-logging.cjs` — brownfield migration module (dispatch case DELEGATED to d1 via the seam contract — d5 does NOT edit `bin/gsd-t.js`).
- `commands/gsd-t-migrate-logging.md` — thin command file.
- `test/m100-d5-migration-fixture.test.js` — migration proven additive/non-destructive on a throwaway fixture.
- `.gsd-t/contracts/logging-schema-distillation-contract.md` — the per-project distillation contract.
- `/Users/david/projects/UMI-Automation/src/logging/trace.ts` — UMI trace build-into (Grain/Airtable/Anthropic/Apify REST trace points).
- `/Users/david/projects/UMI-Automation/src/logging/audit.ts` — UMI audit build-into (PodCoach human draft-approval targets).
- `/Users/david/projects/UMI-Automation/CLAUDE.md` — UMI storage-choice record + the two rules.
- `/Users/david/projects/UMI-Automation/docs/infrastructure.md` — UMI logging storage/infra doc.
- `/Users/david/projects/UMI-Automation/package.json` — minimal TS toolchain manifest (bootstrapped by M100-D5-T2b, BEFORE M100-D5-T3 writes `src/logging/*.ts`).
- `/Users/david/projects/UMI-Automation/tsconfig.json` — real TS config (bootstrapped by M100-D5-T2b, BEFORE M100-D5-T3 writes `src/logging/*.ts`).
- `.gsd-t/domains/d5-defaults-migration-pilot/{scope,constraints,tasks}.md`

## NOT Owned (do not modify)
- `bin/gsd-t.js` — owned by d1 (d5's migration dispatch case is wired by d1 via the seam).
- `bin/gsd-t-logging-scaffolder.cjs`, `commands/gsd-t-init.md` — owned by d1.
- `bin/gsd-t-verify-gate.cjs`, `bin/gsd-t-logging-envelope-check.cjs`, `commands/gsd-t-verify.md` — owned by d3.
- `templates/logging/*.template.ts`, `bin/gsd-t-trace-distill.cjs`, `bin/gsd-t-audit-distill.cjs` — owned by d2/d4.
