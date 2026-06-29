# M98-D1 — Extractor end-line + schema — Tasks

## Files Owned
- `bin/gsd-t-graph-edge-extract.cjs`
- `bin/gsd-t-graph-index.cjs`
- `test/m98-d1-endline.test.js`

---

### M98-D1-T1 — Add `end_line` to the nodes schema (migration-safe)
**Touches**: `bin/gsd-t-graph-index.cjs`
- Add `end_line INTEGER` to the `nodes` CREATE TABLE in `buildSchema`.
- Add an idempotent migration: `PRAGMA table_info(nodes)`; if `end_line` absent, `ALTER TABLE nodes ADD COLUMN end_line INTEGER`. Run it on store open so pre-M98 graphs gain the column without a rebuild.
- Extend `insNode` prepared statement to write `end_line` (8th column).
- Update `putRecord`/`doWrite` to pass `entity.endLine ?? null` into `insNode`.
- `[RULE] body-end-line-required` reference: NULL is allowed (pre-M98 nodes) — D2 re-indexes to populate.

### M98-D1-T2 — Extractor records end position
**Touches**: `bin/gsd-t-graph-edge-extract.cjs`
- For every emitted function/method entity record (each `${relPath}#${name}@${start}` site), add `endLine: node.endPosition.row + 1`.
- Cover all function-emitting branches (function_declaration, method_definition, arrow/function-expression assignment, exports) — grep the file for `id: funcId`/`id: \`${relPath}#...` sites and add `endLine` to each.
- `endPosition` is already on the tree-sitter node next to `startPosition` — no extra walk.

### M98-D1-T3 — Test: end-line captured and stored
**Touches**: `test/m98-d1-endline.test.js`
- Fixture: a small TS file with a 1-line fn, a multi-line fn, and a class method.
- Run extract → assert each entity record's `endLine` equals the true last line.
- Build a graph (index path) → assert the stored `nodes.end_line` matches.
- Migration test: open a graph created WITHOUT the column (simulate by dropping it), re-open, assert `ALTER TABLE` added it and no data lost.
- Freshness test: edit the fixture to shift a function down 3 lines, re-index that file, assert `end_line` updated (DELETE+reinsert keeps it fresh).
