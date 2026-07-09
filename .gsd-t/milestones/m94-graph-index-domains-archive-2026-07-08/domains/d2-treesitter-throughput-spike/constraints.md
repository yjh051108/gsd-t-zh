# Constraints: d2-treesitter-throughput-spike

## Must Follow
- **Zero external runtime deps for the installer** — tree-sitter and any grammar packages used by the SPIKE are dev/spike-only; never added to shipped installer `dependencies`. The probe proves throughput; it does not ship the parser into the installer.
- `bin/<tool>.cjs` CLI convention: JSON envelope on stdout, ANSI colors, sync file APIs, exit code reflects PASS/KILL.
- **[RULE] K2: treesitter-atos-build-under-budget-or-rescope** — PASS iff the full tree-sitter floor index of the REAL Atos repo builds under ~2 min; else emit a KILL/re-scope verdict (adjust budget/parallelism) — measured on the real repo, never assumed.
- Measure on the REAL Atos repo at `/Users/david/projects/HiloAviation/hilo-figma-atos`. If absent at run time, the probe FAILS LOUD with `repo-not-found` (never fakes a PASS).
- Tests run WITHOUT the Atos repo using a small fixture — they prove harness/verdict correctness, not the real-repo number (that is a runtime spike measurement, recorded in the result doc).
- The parser-floor contract carries the edge taxonomy as LESSONS from `bin/graph-parsers.js` — the WHAT (which edges), not the regex HOW.
- Record build wall-clock + verdict in the result doc AND progress.md, live-clock timestamped.

## Must Not
- Modify files outside owned scope.
- Add tree-sitter to the shipped installer `dependencies` (zero-dep invariant).
- Write ANY production indexer code (no `build_index`, no edge-extraction module) — that is D3. This domain owns the throughput PROBE + the taxonomy contract only.
- Lift the regex parsing logic from `bin/graph-parsers.js` — read it for the edge taxonomy only.
- Fake a PASS when the Atos repo is missing.

## Dependencies
- Depends on: nothing (Wave 1, runs concurrently with d1). Requires the real Atos repo present at run time for the actual measurement.
- Depended on by: d3-indexer-core for the **graph-parser-floor-contract** (entity/edge taxonomy + parse-harness/parallelism interface). The Wave-2 trio is BLOCKED until the K1+K2 hard gate passes.
