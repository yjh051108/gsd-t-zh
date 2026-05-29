# Constraints: m61-d7-keep-and-reframe-validation

## Must Follow
- KEEP list is enforced — no retire domain may delete any file on the explicit KEEP list. Plan-review validates this.
- Validation subagent protocols (`templates/prompts/*-subagent.md`) are PROTECTED — they're methodology, not infra. Only their *invocation context* changes (Workflow `agent()` call vs. Task spawn).
- The three orthogonal objectives — `/code-review ultra`, Red Team, QA — are declared in a contract so they cannot be collapsed in future milestones.
- Wave 2 ordering: this domain de-wires command files BEFORE Wave 3 retire domains delete the underlying modules. Without this ordering, Wave 3 deletes break command files.
- Run M58 (or a representative milestone) end-to-end after D7 Wave 2 commit to confirm validation still passes via Workflow stages.

## Must Not
- Delete or modify the M58/M60-hardened test-data adapters
- Modify protocol bodies in `templates/prompts/*-subagent.md` — only the invoking Workflow stage changes
- Add `/code-review ultra` as a replacement for Red Team — they're complementary, not substitutable
- Collapse Red Team into QA or vice versa
- Touch retire targets (D1-D5 own those)

## Must Read Before Implementing
- The bake-off Workflow script — to see how Red Team / QA / Design-Verify are invoked as `parallel()` `agent()` calls with schema-validated output
- All 13 command files that contain OBSERVABILITY LOGGING blocks — to understand the exact de-wire footprint
- `.gsd-t/contracts/test-data-tagging-contract.md` v1.1.0 (M60 STABLE) — confirm test-data purge stays in verify
- `.gsd-t/contracts/cli-preflight-contract.md`, `context-brief-contract.md`, `verify-gate-contract.md` — these stay STABLE (D7 explicitly protects them)

## Dependencies
- Depends on: D6 (Workflow scripts exist before D7 reframes validation as Workflow stages)
- Depended on by: D2 / D3 / D4 (Wave 3 retire requires D7 de-wire to be in place — otherwise deleting underlying modules breaks command files)
- Parallel-with: D2 in Wave 2 (D2 strips unattended subcommands from `bin/gsd-t.js`; D7 strips OBSERVABILITY blocks from `commands/*.md` — file-disjoint)
