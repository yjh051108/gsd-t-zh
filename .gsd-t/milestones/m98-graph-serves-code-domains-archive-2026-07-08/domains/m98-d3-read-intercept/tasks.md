# M98-D3 — Read-intercept hook + install wiring — Tasks

## Files Owned
- `scripts/gsd-t-read-intercept.js` (new)
- `bin/gsd-t.js`
- `test/m98-d3-read-intercept.test.js` (new)

---

### M98-D3-T1 — Read-intercept hook (PASS-THROUGH default, augment-only)
**Touches**: `scripts/gsd-t-read-intercept.js`
- Mirror `scripts/gsd-t-graph-intercept.js` structure: stdin JSON → main → fail-open everywhere; PostToolUse envelope via `updatedToolOutput`.
- Act only on `tool_name === 'Read'`. No `.gsd-t/graph.db` → pass through. Non-code / unindexed file → pass through (`[RULE] read-intercept-fail-open`, AC-6).
- **Default = PASS-THROUGH the full file.** Only AUGMENT (never replace/shrink) when the conservative structural signal holds:
  - the Read carries `offset`+`limit` (tool_input) landing within exactly one indexed function's `[start_line,end_line]` range for that file.
  - Then APPEND (beneath the original file output, kept intact) a graph note: the matched funcId, its line range, and a pointer `→ gsd-t graph body '<funcId>'` for the precise slice + callers.
- NEVER call Read/Grep (loop guard). Only spawn the graph query CLI. Output-cap like the M97 hook.

### M98-D3-T2 — Install/uninstall wiring in bin/gsd-t.js
**Touches**: `bin/gsd-t.js`
- Add `READ_INTERCEPT_HOOK_MARKER = "gsd-t-read-intercept"` + the bash launcher string (mirror `GRAPH_INTERCEPT_HOOK_MARKER` at ~line 459).
- Add `configureReadInterceptHook(settingsPath)` mirroring `configureGraphInterceptHook`, matcher `"Read"`. Idempotent (marker-guarded).
- Call it in the install path next to `configureGraphInterceptHook` (~line 1786); remove it in the uninstall path wherever the grep-intercept hook is removed.

### M98-D3-T3 — Tests
**Touches**: `test/m98-d3-read-intercept.test.js`
- AC-5: a Read whose offset/limit lands inside a known function's range → output is AUGMENTED (original file text retained + graph note appended). A bare `Read(file)` (no offset/limit) → PASS-THROUGH unchanged (no shrinking).
- AC-6: non-code file / unindexed file / no graph.db → pass through untouched.
- Fail-open: malformed stdin, missing CLI, CLI throw → pass through (emit nothing), never crash the Read.
- Install: `configureReadInterceptHook` on a fresh settings.json adds the PostToolUse Read hook once; second call is a no-op (idempotent); uninstall removes it.
