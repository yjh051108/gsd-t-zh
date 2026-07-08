# Constraints: d3-indexer-core

## Must Follow
- **Zero external runtime deps for the installer** — tree-sitter grammars + SCIP indexers are local one-shot tools invoked as child processes, NOT installer `dependencies`. SCIP indexers are detected-if-present, never required.
- `bin/<tool>.cjs` CLI convention: JSON envelope, ANSI colors, sync file APIs.
- Consume D1's `graph-store-schema-contract.md` (node/edge/tier/content-hash columns) and D2's `graph-parser-floor-contract.md` (taxonomy) as FROZEN — do not re-litigate them.
- **The graph NEVER depends on an external tool to FUNCTION — only to get BETTER.** tree-sitter floor always works; SCIP present → that language upgraded to compiler-accurate; SCIP absent → tree-sitter floor (approximate). Absence degrades, never breaks.
- **[RULE] accuracy-tier-labeled-never-silently-wrong** — every edge carries its tier (compiler-accurate where SCIP present, tree-sitter-floor where absent); never an unlabeled mix.
- **[RULE] rust-cross-crate-flagged-partial** — Rust cross-crate edges FLAGGED partial (rust-analyzer SCIP is officially "limited"); within-crate resolves, cross-crate partial — never returned as if complete.
- Build the entity/edge extraction FRESH on tree-sitter — do NOT lift regex logic from `bin/graph-parsers.js` (read for the edge taxonomy lessons only).
- Expose the per-file parse as a callable function (D4 calls it for re-index; D5 calls it for inline re-index) — a function-level surface, not a shared file edit.

## Must Not
- Modify files outside owned scope (D4's freshness, D5's query CLI, D1/D2 spike files/contracts).
- Add tree-sitter / SCIP packages to the shipped installer `dependencies`.
- Return an unlabeled edge tier, or a Rust cross-crate edge as if complete.
- Lift regex parsers from `bin/graph-parsers.js`.
- Implement freshness or query logic — those are D4/D5. This domain WRITES store records only.

## Dependencies
- Depends on: d1 (graph-store-schema-contract — store columns), d2 (graph-parser-floor-contract — taxonomy + parse harness). BLOCKED until the K1+K2 hard gate passes.
- Depended on by: d4-freshness (calls the per-file parse function to re-index a stale file), d5-query-cli (calls re-index inline). Both via the **graph-indexer-build-contract** function surface, not file edits.
