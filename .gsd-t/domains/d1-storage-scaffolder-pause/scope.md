# Domain: d1-storage-scaffolder-pause

## Responsibility
TIER 0 (RISKIEST — Wave 1 spike). The stack-adaptive storage SCAFFOLDER that STOPS for human approval and NEVER silently picks. Owns the sole init-scaffold seam and ALL edits to the single-file `bin/gsd-t.js` hot spot (init dispatch + any new dispatch case), so no other domain co-owns that file. Publishes the scaffolder→machinery handoff seam contract that d2/d4/d5 consume.

## Owned Files/Directories
- `bin/gsd-t-logging-scaffolder.cjs` — stack detection, alternative presentation, human-approval PAUSE, choice recording, deterministic resume.
- `bin/gsd-t.js` — init dispatch wiring + any new dispatch case (SOLE M100 editor of this file, incl. d5's `case "migrate-logging"` on d5's behalf).
- `commands/gsd-t-init.md` — the init scaffolding step invoking the scaffolder.
- `test/m100-d1-storage-scaffolder-pause.test.js` — proves the pause, no-silent-pick, choice-record, deterministic-resume.
- `.gsd-t/contracts/logging-scaffold-seam-contract.md` — the published scaffolder→machinery seam.
- `.gsd-t/domains/d1-storage-scaffolder-pause/{scope,constraints,tasks}.md`

## NOT Owned (do not modify)
- `bin/gsd-t-verify-gate.cjs` — owned by d3-verify-envelope-gate.
- `templates/logging/*.template.ts`, `bin/gsd-t-*-distill.cjs` — owned by d2/d4.
- `templates/CLAUDE-global.md`, `README.md`, `GSD-T-README.md`, `commands/gsd-t-help.md`, `commands/gsd-t-migrate-logging.md`, `bin/gsd-t-migrate-logging.cjs` — owned by d5.
