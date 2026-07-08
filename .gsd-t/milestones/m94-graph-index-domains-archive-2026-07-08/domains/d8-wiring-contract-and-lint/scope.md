# Scope: d8-wiring-contract-and-lint (Wave A — foundation, written BEFORE any consumer wiring)

## Mission
Author the ONE shared graph-consumer wiring contract every code-reading command obeys, and the deterministic anti-grep lint that FAILS THE BUILD if a structural-grep fallback creeps into any wired command. Written FIRST so the readers/writers (d10/d11) wire against a settled contract and the lint guards every commit from the moment wiring starts.

## Why this domain exists (the user's expanded scope, 2026-06-26)
The Central Tenet ("the graph is the MANDATORY structural-knowledge layer for EVERY code-reading workflow step") is delivered by wiring ALL ~19 code-reading commands — NOT just `/scan`. To keep that tractable and uniform, the READER pattern, the WRITER pattern, and the FAIL-LOUD invariant are written ONCE here; all consumers reference this contract instead of re-deriving wiring per command. The FAIL-LOUD invariant is the M20–M21 lesson encoded: structural-grep is REMOVED from the code-assessment path entirely — graph-unavailable on a STRUCTURAL question FAILS LOUD, never silently falls back to grep.

## Files Owned
- `.gsd-t/contracts/graph-consumer-wiring-contract.md` (NEW — the shared READER/WRITER/FAIL-LOUD contract)
- `test/m94-d8-anti-grep-lint.test.js` (NEW — the deterministic anti-grep build gate)
- `bin/gsd-t-graph-anti-grep-lint.cjs` (NEW — the structural lint engine the test drives + the build/verify gate can call)

## Not Owned
- The query-CLI verbs (d9 owns `bin/gsd-t-graph-query-cli.cjs`).
- Any consumer command file or workflow (d10 readers / d11 writers / d6 scan own those).
- The existing AC-5 query-CLI structural-grep test (`test/m94-d5-no-grep-fallback-structural.test.js`) — d5-owned; d8 EXTENDS its idea to consumers, it does not edit it.

## Contract refs
- graph-query-cli-contract.md (D5 — the envelope the readers/writers consume)
- pseudocode `[RULE] query-cli-never-greps` + `[RULE] parser-fail-disables-loud-never-silent` (the invariants this contract operationalizes for consumers)
