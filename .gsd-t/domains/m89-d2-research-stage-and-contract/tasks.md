# Tasks: m89-d2-research-stage-and-contract

## Files Owned
- `.gsd-t/contracts/auto-research-contract.md`
- `templates/prompts/research-subagent.md`
- `test/m89-research-stage-cite-format.test.js`
- `templates/CLAUDE-global.md`
- `bin/gsd-t.js`
- `commands/gsd-t-help.md`
- `package.json`

## Tasks

### M89-D2-T1 — Finalize the auto-research contract
**Touches**: `.gsd-t/contracts/auto-research-contract.md`
Confirm v1.0.0 STABLE pins: classifier envelope shape (§1), research stage interface (§2), Verified-Facts cite
format (§3), idempotency rule (§4), no-silent-guess semantics A3/A4 (§5), labeled-corpus oracle (§6).

### M89-D2-T2 — Author the research-subagent prompt protocol
**Touches**: `templates/prompts/research-subagent.md`
Input = one external gap; tools = WebSearch + WebFetch (only); output = Verified-Facts block with source URLs;
schema-validated. Read at spawn time. Mirrors qa/red-team/design-verify protocol convention.

### M89-D2-T3 — Cite-format + idempotency test
**Touches**: `test/m89-research-stage-cite-format.test.js`
Assert the `## Verified Facts (auto-research)` block parses; every fact has `source: <url>`; an uncited fact
FAILS; a re-pass over an already-cited artifact triggers ZERO additional research (A2 idempotency).

### M89-D2-T4 — Dispatch + doc-ripple
**Touches**: `bin/gsd-t.js`, `commands/gsd-t-help.md`, `templates/CLAUDE-global.md`
Add `research-gate` dispatch case + `PROJECT_BIN_TOOLS` entry + help line in `bin/gsd-t.js`; help line in
`commands/gsd-t-help.md`; REPLACE the advisory `Research Policy` prose in `templates/CLAUDE-global.md` with the
deterministic trigger description (gap → classify → external: research+cite / internal: grep, never web).

### M89-D2-T5 — Version bump + verify
**Touches**: `package.json`
Patch bump. `node --check bin/gsd-t.js`; run T3; smoke-test the dispatch case; M85 lint green.
