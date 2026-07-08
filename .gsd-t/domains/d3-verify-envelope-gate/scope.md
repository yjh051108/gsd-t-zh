# Domain: d3-verify-envelope-gate

## Responsibility
TIER 1 (correctness core — Wave 1 spike, run CONCURRENTLY with d1). The `gsd-t-verify` predicate enforcing BOTH the trace envelope and the audit envelope STRUCTURALLY over PER-PROJECT-VARYING schemas — never hardcoding a category/action value — plus the PII bar, append-only/immutability declaration, retention-configurable, audit-default-except-opt-out, and no-collapse. Predicate lives in a standalone module so the ONLY touch to `bin/gsd-t-verify-gate.cjs` is one registration edit owned solely here.

## Owned Files/Directories
- `bin/gsd-t-logging-envelope-check.cjs` — the standalone structural predicate module.
- `bin/gsd-t-verify-gate.cjs` — ONE registration line only (SOLE M100 editor of this file).
- `commands/gsd-t-verify.md` — document the new check in the verify command.
- `test/m100-d3-envelope-gate.test.js` — synthetic envelopes: valid, missing-field, wrong-type, PII-in-trace, collapsed.
- `.gsd-t/contracts/logging-verify-gate-contract.md` — the predicate contract.
- `.gsd-t/domains/d3-verify-envelope-gate/{scope,constraints,tasks}.md`

## NOT Owned (do not modify)
- `bin/gsd-t.js`, `bin/gsd-t-logging-scaffolder.cjs`, `commands/gsd-t-init.md` — owned by d1.
- `templates/logging/*.template.ts`, `bin/gsd-t-*-distill.cjs` — owned by d2/d4.
- `templates/CLAUDE-global.md`, `README.md`, `GSD-T-README.md`, `commands/gsd-t-help.md`, migration files — owned by d5.
