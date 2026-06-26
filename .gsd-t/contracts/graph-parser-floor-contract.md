# Contract: Graph Parser Floor (K2)

**Status:** STABLE — K2 throughput probe executed. See `.gsd-t/spikes/k2-treesitter-atos-throughput-results.md` for the wall-clock + verdict.
**Owner:** d2-treesitter-throughput-spike
**Consumers:** d3-indexer-core (lifts the taxonomy + parse-harness interface)
**Version:** 1.0.0 (STABLE)

## Purpose
The tree-sitter floor parse harness + the entity/edge taxonomy D3 builds its fresh extraction against, plus the AC-1 throughput proof.

## The decision K2 resolves
Full tree-sitter floor index of the REAL Atos repo (`/Users/david/projects/HiloAviation/hilo-figma-atos`) builds under ~2 min → PASS (AC-1); else KILL/re-scope budget/parallelism. Measured on the real repo. `[RULE] K2: treesitter-atos-build-under-budget-or-rescope`

## Scale correction (measured, not assumed)
The `~1.5M LOC` assumption in the milestone brief was a hypothesis. The probe MEASURES the real scale at the pinned SHA and records it in the spike results doc. The `scaleDivergenceVsBakeoff` field flags if the measured scale materially diverges from D1's synthetic scale.

## Atos commit-SHA pin (`[RULE] k2-atos-sha-pinned` — no number against an unpinned/absent repo)
The K2 throughput measurement MUST PIN and RECORD the Atos commit SHA it ran against (`git -C <atos> rev-parse HEAD`). The probe **fails LOUD on repo-not-found** (the Atos repo absent at run time) — it NEVER fabricates or records a wall-clock against an unpinned or absent repo. The recorded SHA is the same pin AC-4 (D6) must match for its run-1/run-2 comparison to be commensurable.

## Edge/entity taxonomy (the WHAT — salvaged as LESSONS from bin/graph-parsers.js, NOT lifted)
| Kind | Edge / entity |
|------|---------------|
| `import` | file→file ES-module import edge |
| `require` | file→file CommonJS require edge |
| `export` | exported symbol entity (name + whether default) |
| `function` | function entity (def site; includes arrow functions assigned to const) |
| `class` | class entity (def site) |
| `call-site` | function→function call edge (best-effort; keyed by funcId at both ends per graph-store-schema-contract) |

The WHAT (the edge set) is KEPT from M20–M21; the regex HOW is superseded by tree-sitter (see `PseudoCode-CodeGraphIndex.md` §Divergence).

**Not in scope for the floor:** Python-specific import styles handled separately (tree-sitter-python grammar). Rust cross-crate edges flagged partial. Method entities extracted but stored as a sub-kind of `function` (type = `method`, parent class in `parentClass` field).

## Parse-harness interface (D3 consumes)

### Per-file parse output shape
```js
{
  file: string,          // repo-relative POSIX path
  entities: Array<{
    id: string,          // funcId = "file#name" or "file#name@line"
    name: string,
    type: 'function' | 'class' | 'method' | 'export',
    line: number,
    exported: boolean,
    parentClass?: string // for methods
  }>,
  edges: Array<{
    kind: 'import' | 'require' | 'call-site',
    source: string,      // repo-relative path (for import/require) or funcId (for call-site)
    target: string,      // module specifier (for import/require) or funcId (for call-site)
    names?: string[],    // imported names (for import/require)
    line: number
  }>
}
```

### Parallelism strategy (D3 inherits)
- **Worker count:** `Math.max(2, Math.floor(os.cpus().length * 0.75))` — leave ¼ of cores for the host
- **Batch dispatch:** files split into per-worker chunks; each worker parses its chunk synchronously (tree-sitter is sync-C-binding, no async I/O per file beyond `fs.readFileSync`)
- **Peak-RSS ceiling (pre-registered):** ≤ 4 GB RSS for a full Atos-scale laptop-local build (`[RULE] k2-build-footprint-ceiling`)
- **Budget threshold:** ~2 min wall-clock for the full repo (`[RULE] K2: treesitter-atos-build-under-budget-or-rescope`)

## Probe output envelope (`bin/gsd-t-graph-ts-throughput.cjs` stdout)
```js
{
  verdict: 'PASS' | 'KILL',       // machine-readable K2 verdict (`[RULE] k2-verdict-field-machine-checkable`)
  k2Verdict: 'PASS' | 'KILL',    // alias (the field D7-T2 hard-gate test reads)
  atosSha: string,                // pinned commit SHA (`[RULE] k2-atos-sha-pinned`)
  wallClockMs: number,            // full-index wall-clock in ms
  budgetMs: number,               // threshold (120000 ms = 2 min)
  atosFileCount: number,          // source files enumerated by the harness
  atosTotalLoc: number,           // total LOC across parsed files
  atosLangBreakdown: object,      // per-extension {count, loc}
  peakRssBytes: number,           // peak process RSS (`[RULE] k2-build-footprint-ceiling`)
  peakRssCeilingBytes: number,    // pre-registered ceiling (4 GB)
  scaleDivergenceVsBakeoff: object, // {bakeoffAssumedLoc, measuredLoc, ratio, scaleMismatch}
  scaleMismatch: boolean,         // true if ratio > 1.5 or < 0.66
  workerCount: number,
  filesPerWorker: number,
  error?: string                  // set on repo-not-found / unpinned-sha / footprint-exceeded
}
```

## Rules enforced by this contract
- `[RULE] K2: treesitter-atos-build-under-budget-or-rescope` — PASS iff wall-clock ≤ 120000 ms; else KILL
- `[RULE] k2-atos-sha-pinned` — SHA must be pinned; absent SHA = FAIL-LOUD
- `[RULE] k2-build-footprint-ceiling` — peak RSS ≤ 4 GB; exceeded = KILL
- `[RULE] k2-atos-scale-measured-not-assumed` — `atosFileCount` + `atosTotalLoc` + `atosLangBreakdown` MUST be present
- `[RULE] k2-scale-sanity-vs-bakeoff` — if measured scale diverges > 1.5× or < 0.66× from D1 synthetic, `scaleMismatch: true` and verdict = KILL
- `[RULE] k2-verdict-field-machine-checkable` — `k2Verdict` field MUST be present in the result envelope

## Resolved fields (recorded in spike results doc)
- Measured Atos build wall-clock + PASS/KILL verdict: see `.gsd-t/spikes/k2-treesitter-atos-throughput-results.md`
- Measured Atos scale (atosFileCount, atosTotalLoc, atosLangBreakdown): see spike results doc
- Chosen parallelism degree: see spike results doc
