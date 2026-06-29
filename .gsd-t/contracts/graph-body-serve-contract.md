# Contract: graph-body-serve (M98)

**Status:** STABLE (M98 SHIPPED) · **Version:** 1.0.0
**Owner of schema change:** D1 · **Owner of `body` verb:** D2 · **Owner of Read-intercept:** D3

The interface between M98's three domains: the function end-line that D1 records, the
`body` query verb D2 builds on it, and the Read-intercept hook D3 wires.

---

## 1. Node end-line (D1 → D2)

The `nodes` table gains an `end_line` column. The extractor records each function/method
node's `endPosition.row + 1` alongside the existing start line.

```sql
ALTER TABLE nodes ADD COLUMN end_line INTEGER;   -- 1-based inclusive end line; NULL if unknown
```

- **Schema:** `bin/gsd-t-graph-index.cjs::buildSchema` adds `end_line INTEGER` to the `nodes`
  CREATE TABLE, and `insNode` writes it. Migration-safe: an existing graph without the column
  is detected (`PRAGMA table_info(nodes)`) and `ALTER TABLE ADD COLUMN` is applied idempotently.
- **Start line** stays where it is: encoded in the funcId `file#name@<startLine>` and reproduced
  in the entity record. **`end_line` is the only new field.**
- **Extractor:** `bin/gsd-t-graph-edge-extract.cjs` — every emitted function/method entity record
  carries `endLine: node.endPosition.row + 1`. The `putRecord` path passes it to `insNode`.
- **Freshness invariant (no new work):** `parse_and_put` already does DELETE-then-reinsert per
  file, so `end_line` is rewritten on every re-index — end-lines stay fresh automatically. D1 must
  NOT add a separate sync path.

### Entity record shape (extractor → index)
```
{ id: "file#name@startLine", type, name, line: startLine, endLine: <int> }   // endLine NEW
```

### Stored node row (index → query)
```
{ id, kind, tier, content_hash, file, name, func_id, end_line }              // end_line NEW
```

## 2. `body` query verb (D2)

`gsd-t graph body <funcId|symbol>` — reads the live file, slices start..end, attaches context.

### Resolution
- Reuse who-calls disambiguation (`[RULE] who-calls-function-identity-disambiguated`):
  - exact funcId (`file#name@line`) → that node
  - bare `name` matching exactly one node → that node
  - bare `name` matching N>1 nodes → `{ ok:false, reason:"ambiguous-function", candidates:[...] }`
  - no match → `{ ok:false, reason:"not-found" }`

### Slice + context (Decision #6)
The returned `body` is assembled, in order:
1. the file's **import lines** (top-of-file import/require statements)
2. the **class header** line(s) if the function is a method (the enclosing `class X {` line)
3. the **function source**, lines `start_line..end_line` inclusive, read LIVE from disk
4. optional **caller list** (funcIds from the existing call graph — who-calls on this funcId)

### Output envelope (matches existing CLI JSON convention)
```
{ ok:true, verb:"body", target:"<funcId>", file:"<rel>", lineRange:[start,end],
  tier:"<compiler-accurate|tree-sitter-floor|partial>",
  imports:[...], classHeader:"...|null", source:"<sliced text>", callers:[...] }
```

### Invariants (feed verify gate)
- `[RULE] body-reads-live-never-stored` — the function text comes from a live disk read at
  serve time, NOT from any stored body column. (Decision #1.)
- `[RULE] body-freshness-reindex-before-slice` — before slicing, the query path runs the existing
  freshness check on the target file; a stale file is re-indexed (fresh start/end lines) BEFORE the
  slice is read. (AC-3 killing test.)
- `[RULE] body-ambiguous-never-merged` — an ambiguous bare symbol returns candidates, never a
  wrong or concatenated body. (AC-4.)
- `[RULE] body-end-line-required` — if a resolved node has a NULL `end_line` (pre-M98 graph not yet
  re-indexed), `body` re-indexes the file first to populate it; never guesses an end.

## 3. Read-intercept hook (D3)

`scripts/gsd-t-read-intercept.js` — PostToolUse on `Read`. Mirrors the M97 grep-intercept
install pattern (`bin/gsd-t.js::configureGraphInterceptHook`).

### Default = PASS-THROUGH (no-regression — Decision, the open question resolved conservatively)
- A bare `Read(file)` with no structural signal → pass through the FULL file untouched.
- The hook only AUGMENTS (never replaces/shrinks) and only when ALL hold:
  - the read target is an **indexed code file** (has graph nodes), AND
  - a structural signal is present (resolved at partition; conservative default below).
- **Conservative structural signal (D3 ships this):** intercept only when the Read carries an
  `offset`+`limit` that lands within exactly one known function's `[start_line,end_line]` range —
  then append a graph note pointing at `graph body <funcId>` for the precise slice. The explicit
  `body` verb (D2) carries the headline token win; the hook is additive guidance, not a silent
  file-shrinker.
- **Fail-open:** any error, missing graph, non-code file, or unindexed file → the Read passes
  through exactly as if the hook were absent. `[RULE] read-intercept-fail-open`.

### Install wiring
- `bin/gsd-t.js` registers a PostToolUse hook (matcher `"Read"`) pointing at the global
  `scripts/gsd-t-read-intercept.js`, mirroring `GRAPH_INTERCEPT_HOOK_MARKER`. New marker
  `gsd-t-read-intercept`. Idempotent; removed on uninstall alongside the grep-intercept hook.

---

## Domain file ownership (file-disjoint — validates with `gsd-t parallel --dry-run`)

| Domain | Owns (writes) | Reads (no write) |
|--------|---------------|------------------|
| **D1 extractor+schema** | `bin/gsd-t-graph-edge-extract.cjs`, `bin/gsd-t-graph-index.cjs` | — |
| **D2 body verb** | `bin/gsd-t-graph-query-cli.cjs` | nodes schema (end_line) per §1 |
| **D3 read-intercept** | `scripts/gsd-t-read-intercept.js` (new), `bin/gsd-t.js` | `body` verb output per §2 |

Tests: each domain adds its own `test/m98-*.test.js` (disjoint files).

## Sequencing
One wave. D1's `end_line` is the contract D2 builds against — D2 codes against §1 (the column +
record shape are fixed here), so D2/D3 run in parallel with D1; integration verifies D2 reads real
end-lines D1 wrote. D3 references D2's `body` verb name but ships the hook independently
(pass-through default needs no `body` to function).
