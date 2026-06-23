# Domain: m89-d2-research-stage-and-contract

## Wave
WAVE 1 — concurrent with D1, fully file-disjoint (no shared file). Provides the interface D3/D4 wire against in Wave 2.

## Mission
Author the reusable web-research `agent()` stage HELPER spec + the Verified-Facts cite format, the new
`.gsd-t/contracts/auto-research-contract.md` v1.0.0 STABLE, and the reusable stage prompt protocol at
`templates/prompts/research-subagent.md` (Read at spawn time, mirroring the triad-protocol convention).
Also owns the SHARED doc-ripple surfaces (single-owner, integrate-clean by construction): replace the advisory
`Research Policy` prose in `templates/CLAUDE-global.md` with the deterministic trigger description, add the
research-gate dispatch case to `bin/gsd-t.js`, and add the help line to `commands/gsd-t-help.md`.

## Files Owned
- `.gsd-t/contracts/auto-research-contract.md` — pins envelope shape, stage interface, cite format, idempotency, no-silent-guess (already drafted at partition)
- `templates/prompts/research-subagent.md` — reusable stage prompt protocol (NET-NEW)
- `test/m89-research-stage-cite-format.test.js` — Verified-Facts cite-format + idempotency test (NET-NEW)
- `templates/CLAUDE-global.md` — REPLACE advisory Research Policy with deterministic trigger (shared surface, single owner)
- `bin/gsd-t.js` — add `research-gate` dispatch case + `PROJECT_BIN_TOOLS` entry (shared surface, single owner)
- `commands/gsd-t-help.md` — help line for the research-gate (shared surface, single owner)
- `package.json` — version bump (single owner of the manifest for this milestone)
- `.gsd-t/domains/m89-d2-research-stage-and-contract/{scope,constraints,tasks}.md`

## Interface
PRODUCES the contract + cite format + stage protocol that D3/D4 embed inline. CONSUMES D1's classifier as a
stable dependency (envelope shape only). The contract is the SINGLE interface between the classifier (D1) and
the wiring domains (D3/D4) — they agree without coupling.

## NOT Owned
- `bin/gsd-t-research-gate.cjs` + its corpus test/fixture — D1.
- Any `templates/workflows/*.workflow.js` — D3/D4.
