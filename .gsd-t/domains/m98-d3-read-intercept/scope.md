# Domain: M98-D3 — Read-intercept hook + install wiring

## Mission
Intercept the `Read` tool (PostToolUse) so a STRUCTURAL code-read is augmented with the
graph's view — conservatively (Decision #4: Read only; the open question resolved to
PASS-THROUGH default for no-regression). Wire the hook into install, mirroring M97
grep-intercept.

## Files Owned
- `scripts/gsd-t-read-intercept.js` (new)
- `bin/gsd-t.js` (install/uninstall hook registration only)
- `test/m98-d3-read-intercept.test.js` (new)

## Reads (no write)
- `scripts/gsd-t-graph-intercept.js` (the M97 pattern to mirror)
- D2's `body` verb output shape (contract §2) — referenced in the augment note

## Contract
`.gsd-t/contracts/graph-body-serve-contract.md` §3 — owns the Read-intercept behavior + install.

## Out of scope
- The `body` verb (D2). The schema/extractor (D1).
- Silently shrinking any file read — default is PASS-THROUGH the full file.

## NOTE on `bin/gsd-t.js` co-ownership
Only D3 touches `bin/gsd-t.js` in M98 (adds the Read-intercept hook marker + register/unregister
calls beside the existing M97 grep-intercept ones). No other M98 domain writes this file →
file-disjoint holds.
