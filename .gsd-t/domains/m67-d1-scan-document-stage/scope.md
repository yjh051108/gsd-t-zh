# Domain: m67-d1-scan-document-stage

## Mission
M66 made the tech-debt register deep but left living-document cross-population as a non-deterministic "lead agent follow-on" (effectively dropped). M67 adds a deterministic **Document phase** to the scan workflow that fans out per-document agents from the SAME slices + findings the finders produced, so the docs are as thorough as the register.

## Files Owned
- `templates/workflows/gsd-t-scan.workflow.js` (add Document phase between Synthesis and Render; move .gsd-t/scan/*.md writing out of synthesis into the deep doc stage)
- `commands/gsd-t-scan.md` (Document Ripple section + result shape)
- `templates/CLAUDE-global.md` (workflow phase list)
- `package.json` (patch bump 4.0.13 → 4.0.14)
- `.gsd-t/progress.md`

## Documents the Document phase must produce (deep, merge-not-overwrite)
Living docs: `docs/architecture.md`, `docs/workflows.md`, `docs/infrastructure.md`, `docs/requirements.md`, `README.md`.
Scan dimension files (for the HTML renderer + knowledge persistence): `.gsd-t/scan/architecture.md` (with the `N files (~N LOC)` line), `.gsd-t/scan/security.md`, `.gsd-t/scan/quality.md`, `.gsd-t/scan/business-rules.md`, `.gsd-t/scan/contract-drift.md`.

Must cover everything the old prose Step 5 did (see commit 3d2c705) and go deeper: per-feature-domain user journeys in workflows.md, component map in architecture.md, ops in infrastructure.md.

## NOT Owned
- `bin/scan-*.js` renderers (unchanged).
- The finder/probe/synthesis stages' core logic (only synthesis's dimension-file-writing instruction moves out).

## Single sequential domain
The Document phase + its doc-ripple are one coherent change.
