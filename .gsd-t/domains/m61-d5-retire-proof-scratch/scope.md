# Domain: m61-d5-retire-proof-scratch

## Responsibility
Delete one-time milestone-proof / benchmark / probe scratch artifacts that have zero live references and exist only as completed-milestone evidence. Wave 1 (parallel with D6 — genuinely safe parallel companion).

## Owned Files (delete)
- `bin/m44-proof-measure.cjs`
- `bin/m46-iter-proof.cjs`
- `bin/m46-worker-proof.cjs`
- `bin/m55-substrate-proof.cjs`
- `bin/gsd-t-benchmark-orchestrator.cjs`
- `bin/gsd-t-parallel-probe.cjs`
- `bin/gsd-t-ratelimit-probe.cjs`
- `bin/gsd-t-ratelimit-probe-worker.cjs`

## Owned Files (edit)
- `bin/gsd-t.js` — remove `benchmark` / `parallel-probe` / `ratelimit-probe` subcommands if present

## NOT Owned (do not modify)
- `.gsd-t/ratelimit-map.json` — gets archived (not deleted) to `.gsd-t/milestones/m61-*/` since `gsd-t-verify-gate` may still consult it; reframe at D7 plan time
- Anything in `.gsd-t/milestones/m44-*/`, `m46-*/`, `m55-*/` archives (historical record)

## Estimated LOC removed
~1,900 LOC

## Pre-deletion gate
- `grep -rn "require.*m44-proof\|require.*m46-iter\|require.*m46-worker\|require.*m55-substrate\|require.*benchmark-orchestrator\|require.*parallel-probe\|require.*ratelimit-probe" --include='*.js' --include='*.cjs' --include='*.md' .` returns zero live references (these are confirmed orphans at partition time)
