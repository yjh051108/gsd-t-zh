# Scope: d10-reader-command-wiring (Wave B — wire the READER commands)

## Mission
Wire every code-reading command that ASSESSES (but does not change) code structure to query the graph CLI via the shared d8 wiring contract — replacing structural-grep/raw-read in its assessment path. Each command gets: (1) a behavior directive in its command `.md` (query the graph for the structural question, fail loud on graph-unavailable), (2) a row appended to the d8 consumer manifest, (3) a test asserting it queries the graph (not grep) for structural questions + fails loud on graph-unavailable.

## The two wiring seams (architectural — verified this plan pass)
1. **Command-file directive** (`commands/gsd-t-<cmd>.md`): most readers route through the GENERIC `gsd-t-phase.workflow.js` runner (impact/plan/partition/project/feature/gap-analysis/populate/promote-debt/prd/qa/test-sync all use `gsd-t workflow-path phase`). So the per-command wiring lives in the command `.md`'s step that assesses structure: it directs the worker to call the graph query CLI first.
2. **Shared phase-workflow injection** (`templates/workflows/gsd-t-phase.workflow.js`): ONE task owns the shared injection seam — the phase runner queries the graph for the structural slice and threads it into the worker-agent brief/context (so readers on the generic runner get the slice uniformly). This file has a SINGLE owner in d10 (T0) to preserve disjointness.

## READER command set (13 — verified against `ls commands/`)
HIGH: `impact` (blast-radius — the user's CORE use case), `plan`, `partition` (cluster verb), `scan` (NOTE: scan's reader wiring is OWNED BY d6 via the insight-delta; d10 only ensures scan's manifest row references the shared d8 contract — d10 does NOT edit scan files), `feature`, `gap-analysis`. MED: `project` (cluster verb), `populate`, `promote-debt`, `prd`, `integrate` (has its OWN workflow — d10 edits that workflow), `qa` (orphan verbs), `verify` (orphan verbs — has its OWN workflow).

> `/scan` reader wiring = d6 (already planned, rescoped to reference the shared contract). d10 EXCLUDES scan files to avoid two-domain collision; d10's scope is the OTHER 12 readers.

## Files Owned
- `templates/workflows/gsd-t-phase.workflow.js` (T0 — shared injection seam, sole owner)
- `commands/gsd-t-impact.md`, `commands/gsd-t-plan.md`, `commands/gsd-t-partition.md`, `commands/gsd-t-feature.md`, `commands/gsd-t-gap-analysis.md`, `commands/gsd-t-project.md`, `commands/gsd-t-populate.md`, `commands/gsd-t-promote-debt.md`, `commands/gsd-t-prd.md`, `commands/gsd-t-qa.md` (per-command directives — one task per file, each sole owner)
- `templates/workflows/gsd-t-integrate.workflow.js`, `templates/workflows/gsd-t-verify.workflow.js` (the two readers WITH dedicated workflows)
- `commands/gsd-t-integrate.md`, `commands/gsd-t-verify.md` (their command-file notes)
- `test/m94-d10-reader-wiring.test.js` (NEW — asserts each reader queries graph-not-grep + fails loud)

## Not Owned
- `commands/gsd-t-scan.md` + `templates/workflows/gsd-t-scan.workflow.js` (d6 owns scan).
- The query-CLI verbs (d9) + the shared contract/lint (d8) — d10 CONSUMES them.
- WRITER commands (debug/quick/execute/wave/test-sync/design-build) — d11.

## Contract refs
- graph-consumer-wiring-contract.md (d8 — READER pattern + FAIL-LOUD + manifest)
- graph-query-cli-contract.md (d5 + d9 verbs: who-imports/blast-radius/cluster/dead-code/dangling)
