# Contract: Graph Parser Floor (K2)

**Status:** DRAFT — resolved by the D2 Wave-1 K2 tree-sitter-throughput spike. Marked STABLE once the throughput probe passes (or re-scoped if K2 kills).
**Owner:** d2-treesitter-throughput-spike
**Consumers:** d3-indexer-core (lifts the taxonomy + parse-harness interface)
**Version:** 0.1.0 (DRAFT)

## Purpose
The tree-sitter floor parse harness + the entity/edge taxonomy D3 builds its fresh extraction against, plus the AC-1 throughput proof.

## The decision K2 resolves
Full tree-sitter floor index of the REAL Atos repo (`/Users/david/projects/HiloAviation/hilo-figma-atos`, ~1.5M LOC) builds under ~2 min → PASS (AC-1); else KILL/re-scope budget/parallelism. Measured on the real repo. `[RULE] K2: treesitter-atos-build-under-budget-or-rescope`

## Atos commit-SHA pin (`[RULE] k2-atos-sha-pinned` — no number against an unpinned/absent repo)
The K2 throughput measurement MUST PIN and RECORD the Atos commit SHA it ran against (`git -C <atos> rev-parse HEAD`). The probe **fails LOUD on repo-not-found** (the Atos repo absent at run time) — it NEVER fabricates or records a wall-clock against an unpinned or absent repo. The recorded SHA is the same pin AC-4 (D6) must match for its run-1/run-2 comparison to be commensurable.

## Edge/entity taxonomy (the WHAT — salvaged as LESSONS from bin/graph-parsers.js, NOT lifted)
| Kind | Edge / entity |
|------|---------------|
| import | file→file import edge |
| export | exported symbol entity |
| require | file→file require edge |
| function | function entity (def site) |
| class | class entity |
| call-site | function→function call edge |

The WHAT (the edge set) is KEPT from M20–M21; the regex HOW is superseded by tree-sitter (see `PseudoCode-CodeGraphIndex.md` §Divergence).

## Parse-harness interface (D3 consumes)
- per-file parse → `{ entities, edges }` in the taxonomy above
- parallelism strategy (the throughput proof's worker model) D3 reuses for full-repo build

## Open until K2 resolves
- The measured Atos build wall-clock + PASS/KILL verdict (recorded in `.gsd-t/spikes/k2-treesitter-atos-throughput-results.md` + progress.md)
- The chosen parallelism degree
