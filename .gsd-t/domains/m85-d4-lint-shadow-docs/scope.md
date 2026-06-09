# Domain: m85-d4-lint-shadow-docs

## Responsibility
Enforcement + measurement + doc ripple — fully disjoint from all source files. Owns the NEW M71-family lint (read-only assertion over all 8 workflows + the policy module/contract), the gsd-t-audit shadow probe that records a MEASURED verdict in progress.md, and the full doc ripple. Never writes a workflow, the policy module, or a `bin/` consumer.

## Owned Files/Directories
- `test/m85-workflow-tier-policy-lint.test.js` — NEW. M71-family lint. READS all 8 `templates/workflows/*.workflow.js` (read-only assertion, NOT ownership) + the policy module/contract. Asserts: every workflow `model:` literal is a member of the policy tier set; the 5 designated stages resolve to fable; the competition producers stay opus; a deliberately-drifted literal FAILS (mandatory negative test — AC a).
- `templates/CLAUDE-global.md` — Model Display section: add FABLE tier + the shipped policy description, cite the measured shadow verdict.
- `/Users/david/.claude/CLAUDE.md` — live equivalent of CLAUDE-global; mirror the Model Display update (template + live must match).
- `CLAUDE.md` (project) — note the Fable tier + single-source tier policy where model assignments are described.
- `README.md` — reflect the new tier/policy in the relevant section.
- `commands/gsd-t-help.md` — reflect the new tier/policy.
- `.gsd-t/contracts/model-selection-contract.md` — minor version bump; cross-reference the new `model-tier-policy-contract.md`; cite the measured verdict.
- `.gsd-t/progress.md` — record the MEASURED shadow-test verdict (quality + token/cost delta + conclusion) per feedback_measure_dont_claim; Decision Log entry; version bump narrative 4.3.10 → 4.4.10.

## NOT Owned (do not modify)
- `bin/gsd-t-model-tier-policy.cjs`, `.gsd-t/contracts/model-tier-policy-contract.md` — owned by m85-d1-tier-policy-module
- `bin/gsd-t-parallel.cjs`, `bin/model-selector.js`, `test/model-selector.test.js` — owned by m85-d2-bin-consumers-alias-selector
- `templates/workflows/*.workflow.js` — owned by m85-d3-workflow-fable-assignments (this domain READS them in the lint, but WRITES none)

## Files Owned
- `test/m85-workflow-tier-policy-lint.test.js`
- `templates/CLAUDE-global.md`
- `/Users/david/.claude/CLAUDE.md`
- `CLAUDE.md`
- `README.md`
- `commands/gsd-t-help.md`
- `.gsd-t/contracts/model-selection-contract.md`
- `.gsd-t/progress.md`
