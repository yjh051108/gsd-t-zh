# M98 — The Graph Serves Code (function-level slices) + Read-Intercept

**Status: SHIPPED 2026-06-29 at v4.13.10 — all 6 design decisions built; all 7 ACs green (incl. AC-3 freshness + AC-4 ambiguity killing tests); proven end-to-end on real binvoice (21× char reduction). Open implementation question resolved to option (c) conservative pass-through. Suite 2538/2538.**

**Build summary:** 3 file-disjoint domains, 1 wave. D1 = end-line capture + `nodes.end_line` schema/migration (`gsd-t-graph-edge-extract.cjs`, `gsd-t-graph-index.cjs`). D2 = `body` query verb (`gsd-t-graph-query-cli.cjs`). D3 = Read-intercept hook + install wiring (`scripts/gsd-t-read-intercept.js`, `bin/gsd-t.js`). Contract: [`.gsd-t/contracts/graph-body-serve-contract.md`](../contracts/graph-body-serve-contract.md) (STABLE). Tests: `test/m98-d{1,2,3}-*.test.js` (17 tests). The Read-intercept "structural-vs-edit" signal landed as: intercept ONLY when offset+limit fall inside one known function's range; default pass-through (no file shrinking).

---

**Original definition (DEFINED 2026-06-29 — all 6 design decisions LOCKED):**

## The one-breath call
Today the code graph is an INDEX — it stores names, files, line numbers, and call/import edges, but NOT the code itself. M98 makes the graph SERVE CODE: a new query returns a single function's source (sliced live from disk by line range, plus its class header + imports + callers), and the Read tool is intercepted so a structural file-read is augmented with the graph's view. This closes the last "smart reach" gap (M97's deferred #6): when Claude reaches into code, it gets the precise slice it needs (~180 tokens) instead of a whole file (~7,750 tokens) — a ~43× token reduction on the common "I need this one function" case.

## Origin
- M97 shipped grep-intercept (the graph answers structural greps). Its deferred limitation #6: the graph isn't consulted on `Read` or other non-grep tools.
- User (2026-06-29): "Claude should use the graph when it uses Read… I thought the graph would serve code." It doesn't today — it's index-only.
- Research (two threads, 2026-06-29, cited): index-only vs index+code, plus hard measurements on the real GSD-T graphs.

## LOCKED design decisions (user-confirmed 2026-06-29 — do NOT re-litigate)

| # | Decision | LOCKED choice | Rationale |
|---|----------|---------------|-----------|
| 1 | Store code bodies, or read live from disk? | **READ LIVE from disk, slice by line range** | User works only on local files. Benchmark: read-live ~25µs vs db-blob ~5µs per fetch — both invisible; LLM token cost is identical. Storing bodies buys only "search-without-disk" (N/A locally) at the cost of a duplicate source-of-truth + sync. Freshness is ALREADY handled: a query hashes the touched file, sees it stale, re-indexes it (DELETE+re-insert nodes with fresh `@line`) BEFORE answering — verified in `gsd-t-graph-freshness.cjs` + `parse_and_put` (`DELETE FROM nodes WHERE file=?` then re-insert). So line ranges are current at serve time; no stale-code risk. |
| 2 | Read-intercept: augment or replace? | **SLICE — serve only the relevant function(s) + context, not the whole file** | User: "Needs the code but only the relevant slice." When Claude reads a code file for a specific symbol, return that function's slice; the full file remains one explicit Read away. |
| 3 | New "give me this function" query verb? | **YES** | `gsd-t graph body <funcId|symbol>` returns the function's source. This is where the 43× token win lives. |
| 4 | Which tools to intercept? | **Read only** (not Glob/LS) | Glob/LS are filesystem questions, not code-structure. Don't bolt the graph onto things it can't help. |
| 5 | Capture function END lines? | **YES — required** | Today only the START line is stored (`file#name@line`). To slice a body you need the end line. The extractor must record it (tree-sitter already walks the node — its end position is free). |
| 6 | Context to attach to a slice | **function + class header + imports + anything relevant (e.g. caller list)** | Research consensus (cAST/Sourcegraph/Greptile): function-level is the unit, but attach class header + imports for cross-method context; never whole-file/whole-class. Callers come free from the existing call-graph. |

## Research baked in (cited 2026-06-29)
- **Granularity = function-level, unanimous** (cAST arXiv 2506.15655, Sourcegraph, Aider, Greptile, Sweep, LlamaIndex). Caveat: attach class header + imports; do NOT chunk whole-file or whole-class. Split on AST boundaries, cap ~40 lines, recurse oversized, merge tiny siblings.
- **Kythe (Google) + Glean (Meta)** store body once-per-file + offsets — we go one better: don't store at all, read live (files are local).
- **SCIP/Cody** deliberately store no bodies, read the live file at serve time — exactly our chosen model (always fresh, zero sync).
- **Measured on real GSD-T graphs:** a typical function = ~20 lines / ~750 bytes / ~180 tokens; full-file Read median ~7,750 tokens → **~43× token reduction** per "one function" lookup. Storing bodies would add only ~3% (gzipped) to a DB that's 86% edges — but read-live needs zero storage.

## Scope
1. **Extractor: capture function end-line** (`bin/gsd-t-graph-edge-extract.cjs`) — record each function node's end position alongside its start. Store it (new `end_line` column on `nodes`, or extend the funcId/record). Freshness re-index already rewrites nodes per file, so end-lines stay fresh automatically.
2. **`body` query verb** (`bin/gsd-t-graph-query-cli.cjs`) — `body <funcId|symbol>`: resolve to the funcId (reuse who-calls disambiguation), read the live file, slice start..end, prepend the class header (if the function is a method) + the file's import lines + an optional caller list. Return labeled with tier + file:line range. Ambiguous symbol → candidate list (like who-calls).
3. **Read-intercept hook** (`scripts/gsd-t-read-intercept.js`, PostToolUse on `Read`) — when Claude reads a CODE file (indexed, has a graph) AND the read targets a structural lookup, serve the relevant function slice(s) instead of the full file. CRITICAL nuance: a bare `Read(file)` with no symbol target is ambiguous — default to PASS-THROUGH (full file) unless the read is clearly structural; do NOT silently shrink every file read (that would break editing). Likely: only intercept when a companion signal says "structural" (TBD at partition — this is the one open implementation question, not a design question). Fail-open, no-op without a graph, never intercept non-code files.
4. **Wire `body` into install + the consumer set** — register the Read-intercept hook in settings.json via `gsd-t install` (mirror the M97 grep-intercept install).

## Falsifiable acceptance
- AC-1: `gsd-t graph body <known funcId>` returns the EXACT function source (start..end), with class header + imports prepended, labeled file:line + tier. (Fixture test.)
- AC-2: token win — for a real multi-function file, `body <fn>` returns ≤ ~1/10th the tokens of reading the whole file. (Measured on binvoice.)
- AC-3: freshness — edit a function (change its body + shift its line range), then `body <fn>` returns the NEW source at the NEW lines without a manual re-index (the query path re-indexes). Killing test.
- AC-4: ambiguity — a bare symbol defined in N places returns candidates, never a wrong/merged body.
- AC-5: Read-intercept augments a structural code read with the slice; a bare/edit-intent file read PASSES THROUGH (full file) — no silent shrinking that breaks editing. Fail-open on error.
- AC-6: non-code / unindexed / no-graph → Read passes through untouched.
- AC-7: end-to-end on binvoice — Claude reading for one function gets the slice, not the 600-line file.

## The ONE open implementation question (settle at partition, NOT a design decision)
**How does the Read-intercept know a read is "structural" (serve a slice) vs "I need the whole file to edit" (pass through)?** Options to evaluate at partition: (a) only intercept when the Read has an offset/limit targeting a known function's range; (b) a heuristic on what Claude said it's doing; (c) conservative default = always pass through full file, and rely on the explicit `body` verb for slicing (safest — the verb gives the win without touching Read's default). Lean (c) unless partition finds a clean signal — it's the no-regression path.

## Out of scope (follow-ons)
- Storing code bodies in the DB (rejected — read-live chosen; revisit only if a non-local/search-without-disk need appears).
- Vue/Svelte `.vue` SFC `<script>` extraction (separate gap from the M97 review).
- A visibility signal for graph-vs-grep/Read decisions (nice-to-have, separate).

**Next (after /clear):** `/gsd-t-partition` M98 — first task settles the Read-intercept "structural-vs-edit" signal (the one open question); the `body` verb + end-line capture are unambiguous and can build immediately.
