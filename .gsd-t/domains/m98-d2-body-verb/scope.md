# Domain: M98-D2 — `body` query verb

## Mission
Add `gsd-t graph body <funcId|symbol>` — read the live file, slice the function's
`start..end`, prepend import lines + class header, attach callers. This is where the
~43× token win lives (Decision #3).

## Files Owned
- `bin/gsd-t-graph-query-cli.cjs`
- `test/m98-d2-body.test.js` (new)

## Reads (no write)
- nodes schema `end_line` per contract §1 (provided by D1)
- `bin/gsd-t-graph-freshness.cjs` (call its existing freshness check before slicing)

## Contract
`.gsd-t/contracts/graph-body-serve-contract.md` §2 — owns the `body` verb + output envelope.

## Out of scope
- The schema/extractor (D1). The Read-intercept hook (D3).
- Storing bodies (rejected — read live from disk only).
