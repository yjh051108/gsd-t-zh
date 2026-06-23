# Tasks: m93-jargon-lint (M93 D3 — the file-surface gate)

## Files Owned
- `bin/gsd-t-jargon-lint.cjs`
- `test/m93-jargon-lint.test.js`

---

### M93-D3-T1 — `bin/gsd-t-jargon-lint.cjs` deterministic jargon-gloss lint
**Touches**: `bin/gsd-t-jargon-lint.cjs`
**PseudoCode-Section**: (n/a)
Input: a markdown file path (`--file <p>`) or text on stdin (`--stdin`). Detect high-signal code
tokens — `/\bS2-M\d+\b/`, `/\bHC-\d+\b/`, `/\bM\d+(-D\d+(-T\d+)?)?\b/`, ALL-CAPS acronym
`/\b[A-Z]{3,}\b/` NOT in the allowlist. For each DISTINCT token, check its FIRST occurrence: is there
a gloss within the same sentence OR an immediately adjacent parenthetical `(...)`? A gloss =
parenthetical text, OR an em-dash clause, OR the acronym's expansion. Report every unglossed
first-occurrence token with its line number. Skip fenced code blocks and inline-code spans (a token
inside `` `...` `` or a ``` fence is a code reference, not prose jargon). Exit 0 (clean) / 4 (unglossed
tokens — name token+line in `--json`) / 64 (bad input). Allowlist (exempt acronyms): GSD-T, QA, CLI,
API, URL, DB, JSON, JSONL, NDJSON, HTML, CSS, HTTP, HTTPS, DTO, SQL, PDT, EST, UTC, PST, AND, OR, NOT,
TODO, FIXME, README, ID, OK, NPM, CPUA (extend conservatively). Exempt PATHS (skip entirely, mirror
date-guard allowlist): `.gsd-t/milestones/`, `.gsd-t/events/`, `.gsd-t/transcripts/`, `node_modules/`,
`.git/`, `CHANGELOG.md`, `.gsd-t/token-log.md`. Zero deps, never throws, pure.
**Acceptance criteria**: a doc with a bare `HC-003` → exit 4 naming it + line; same doc with `HC-003 (the never-contact-buyer rule)` → exit 0; an allowlisted acronym (`CLI`, `API`) → never flagged; a token inside a code fence/inline-code → not flagged; exempt path → skipped (exit 0); malformed input → exit 64, no throw; only the FIRST occurrence of a token is checked (a glossed-then-reused token passes).
**Files**: `bin/gsd-t-jargon-lint.cjs`.
**Test**: M93-D3-T2.
**Headline**: true

### M93-D3-T2 — Killing test for the jargon lint
**Touches**: `test/m93-jargon-lint.test.js`
**PseudoCode-Section**: (n/a)
Byte-known inline-markdown fixtures via `--stdin`:
- bare `HC-003` in prose → exit 4, token+line named;
- `HC-003 (your "never contact the buyer" rule)` → exit 0 (glossed);
- `S2-M7` bare → exit 4; `S2-M7 (the trace-logging milestone)` → exit 0;
- allowlisted `CLI`/`API`/`GSD-T` → never flagged (exit 0);
- token inside `` `HC-003` `` inline-code or a ``` fence → not flagged;
- a token glossed on first use then reused bare later → exit 0 (only first occurrence checked);
- malformed/empty → exit 64 / handled, no throw.
**Acceptance criteria**: all fixtures assert the exact exit + named tokens; glossed forms pass; allowlist + code-span exemptions hold; first-occurrence-only proven; fail-closed on bad input; never throws.
**Files**: `test/m93-jargon-lint.test.js`.
**Test**: this IS the test.

---

**INTEGRATE-SEAM:** register `gsd-t-jargon-lint.cjs` in `bin/gsd-t.js` PROJECT_BIN_TOOLS (propagation) + document invocation; optional wiring into complete-milestone's doc checks is a later step.
