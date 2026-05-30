# Tasks: m67-d1-scan-document-stage

## Tasks

### M67-D1-T1 — Add the Document phase to the scan workflow
**Touches**: `templates/workflows/gsd-t-scan.workflow.js`
Add a `Document` phase between Synthesis and Render. Fan out (parallel) one agent per document, each given the slice list + the verified findings + probe totals: docs/architecture.md, docs/workflows.md, docs/infrastructure.md, docs/requirements.md, README.md (merge-not-overwrite), plus the 5 `.gsd-t/scan/*.md` dimension files (architecture/security/quality/business-rules/contract-drift) in the renderer's parsed formats. Move the dimension-file-writing instruction OUT of the synthesis prompt (synthesis writes the register only). Document stage runs BEFORE Render so the HTML report reads the deep architecture.md. Non-fatal per-doc failures (register is authoritative) but logged. Add DOC_RESULT_SCHEMA.

### M67-D1-T2 — Doc-ripple
**Touches**: `commands/gsd-t-scan.md`, `templates/CLAUDE-global.md`, `package.json`, `.gsd-t/progress.md`
Update the command file's Document Ripple section (docs are now produced deterministically by the Document phase, not a manual follow-on) + the workflow phase list in CLAUDE-global. Patch bump 4.0.13 → 4.0.14.

### M67-D1-T3 — Verify
**Touches**: (verification only)
node --check, npm test (baseline 1267/0/4), orthogonal triad (Red Team) on the Document phase. Confirm coverage vs old Step 5 + the renderer-format contract for the dimension files.
