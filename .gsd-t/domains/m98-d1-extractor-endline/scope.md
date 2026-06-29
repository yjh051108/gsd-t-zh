# Domain: M98-D1 — Extractor end-line + schema

## Mission
Capture each function/method node's END line so a body slice has a `start..end` range.
This is the one real schema/extractor change in M98 (Decision #5).

## Files Owned
- `bin/gsd-t-graph-edge-extract.cjs`
- `bin/gsd-t-graph-index.cjs`
- `test/m98-d1-endline.test.js` (new)

## Reads (no write)
- `bin/gsd-t-graph-freshness.cjs` (understand the re-index path; do NOT modify)

## Contract
`.gsd-t/contracts/graph-body-serve-contract.md` §1 — owns the `end_line` column + entity record shape.

## Out of scope
- The `body` verb (D2). The Read-intercept hook (D3).
- Any new freshness/sync path — DELETE+reinsert per file already keeps end_line fresh.
