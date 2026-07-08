# M98-D2 — `body` query verb — Tasks

## Files Owned
- `bin/gsd-t-graph-query-cli.cjs`
- `test/m98-d2-body.test.js`

---

### M98-D2-T1 — Resolve a symbol/funcId to a node (reuse who-calls disambiguation)
**Touches**: `bin/gsd-t-graph-query-cli.cjs`
- Add `resolveBodyTarget(db, target)`: exact funcId match → node; bare name with one match → node; N>1 → `{ ok:false, reason:"ambiguous-function", verb:"body", target, candidates:[...] }`; none → `{ ok:false, reason:"not-found", verb:"body", target }`.
- Reuse the existing who-calls funcId-line-suffix-tolerant matching so `file#name` (no `@line`) resolves. `[RULE] who-calls-function-identity-disambiguated`.

### M98-D2-T2 — Freshness-before-slice + live slice
**Touches**: `bin/gsd-t-graph-query-cli.cjs`
- Before slicing, run the existing freshness check on the target node's file; if stale, re-index it (so `start`/`end_line` are current). `[RULE] body-freshness-reindex-before-slice`.
- Read the live file, slice lines `start..end_line` inclusive. `[RULE] body-reads-live-never-stored`.
- If resolved node `end_line` is NULL (pre-M98), re-index the file first to populate it; never guess. `[RULE] body-end-line-required`.

### M98-D2-T3 — Attach context (imports + class header + callers)
**Touches**: `bin/gsd-t-graph-query-cli.cjs`
- Collect the file's top-level import/require lines (`imports[]`).
- If the node is a method, find the enclosing `class X {` header line (`classHeader`, else null).
- Callers: run the existing who-calls on this funcId → `callers[]` (funcIds).
- Assemble the envelope: `{ ok:true, verb:"body", target, file, lineRange:[start,end], tier, imports, classHeader, source, callers }` per contract §2.

### M98-D2-T4 — Wire `body` into the verb dispatch + help
**Touches**: `bin/gsd-t-graph-query-cli.cjs`
- Add `"body"` to the valid-verb list and the dispatch switch (next to `who-imports`/`who-calls`/`blast-radius`/`status`).
- Update the header usage comment + `--help` text.

### M98-D2-T5 — Tests
**Touches**: `test/m98-d2-body.test.js`
- AC-1: `body <known funcId>` returns exact source start..end with imports + class header, labeled file:line + tier. (Fixture.)
- AC-2: token win — for a multi-function fixture file, the `body` slice byte/line count ≤ ~1/10th the whole-file read.
- AC-3 (killing): edit a function (shift its range), `body <fn>` returns NEW source at NEW lines with no manual re-index.
- AC-4: ambiguous bare symbol (defined in 2 files) → `candidates`, never a merged body.
