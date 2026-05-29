# Constraints: m61-d6-migrate-orchestration-to-workflow

## Must Follow
- This is the highest-stakes domain in M61. Every command lifecycle currently passes through orchestrator/worker/parallel. Ship Workflow scripts BEFORE any retire wave commits.
- The 2026-05-29 bake-off proved the migration is safe by running M58 as a single Workflow (preflight → brief → parallel D1∥D2 fan-out → integrate → verify-gate → adversarial Red Team) and caught the M60 CRITICAL. The bake-off script itself was ephemeral (Workflow tool input, not persisted). D6 implements the **architecture pattern** the bake-off demonstrated, NOT a literal port of the bake-off script. The architecture is documented in progress.md:120 (M60 fix entry) and the M60 fix commit (`0b791c8`).
- Brief-First Worker Rule MUST hold: every `agent()` call inside Workflows threads `$BRIEF_PATH` from `gsd-t-context-brief.cjs`.
- File-disjointness prover MUST run inside the Workflow before fan-out (defense in depth — Workflow `parallel()` doesn't know about file ownership).
- Workflow scripts include `export const meta = { name, description, phases }` per Workflow tool contract.
- Use `pipeline()` by default — barrier `parallel()` only when stage N needs cross-item state from stage N-1.

## Must Not
- Delete orchestrator/parallel/spawn-plan scripts in the same commit as the Workflow port. Two commits: (1) add Workflow script + flip command file to invoke it, (2) delete old orchestrator after a verify-gate green run.
- Delete the brains (`file-disjointness.cjs`, `task-graph.cjs`, `context-brief.cjs`, `cli-preflight.cjs`) — they migrate inside, not away.
- Embed methodology / validation-subagent prompts inline. Keep referring to `templates/prompts/{qa,red-team,design-verify}-subagent.md` via `readFileSync`.
- Use `Math.random()` / `Date.now()` / argless `new Date()` inside Workflow scripts (Workflow runtime throws — pass timestamps via args, vary by index).

## Must Read Before Implementing
- The architecture pattern from the 2026-05-29 bake-off (documented in progress.md:120): one Workflow script per command lifecycle, structured as preflight → brief → parallel domain fan-out (using Workflow `parallel()` or `pipeline()`) → integrate barrier → verify-gate stage → adversarial Red Team stage with perspective-diverse refuters
- `bin/gsd-t-file-disjointness.cjs` (boundary prover — invocation surface)
- `bin/gsd-t-task-graph.cjs` (task-graph reader — invocation surface)
- `bin/gsd-t-context-brief.cjs` (brief generator — kinds + output schema)
- `bin/cli-preflight.cjs` (preflight envelope — JSON shape)
- `bin/gsd-t-verify-gate.cjs` + `bin/gsd-t-verify-gate-judge.cjs` (D7 KEEP — Workflow stages invoke these)
- `templates/prompts/{qa,red-team,design-verify}-subagent.md` (protocols stay; Workflow imports them)
- The Workflow tool's `meta` schema and `agent()`/`parallel()`/`pipeline()`/`log()` API

## Dependencies
- Depends on: none from M61 (D6 lands first in Wave 1)
- Depended on by: D1, D2, D3, D4 (retire waves run only after D6's Workflows replace their callers), D7 (validation reframe runs Wave 2 after D6 lands), D8 (doc-ripple references the new Workflow architecture)
- Parallel-with: D5 in Wave 1 (file-disjoint — D5 deletes proof scratch with zero live refs)
