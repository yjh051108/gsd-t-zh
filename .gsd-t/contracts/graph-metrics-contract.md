# Contract: Graph Metrics & Telemetry Ledger

## Version: 1.0.0 (M99 — Graph Observability & Consolidation)
## Status: STABLE (D3 finalized — emitted keys reconciled, rollup implemented, contract owner: m99-d3-metrics-rollup)
## Owner: graph-observability domain (M99)
## Consumers: `gsd-t graph metrics` (Layer 3 rollup); the 6 graph-consuming workflows (scan/verify/debug/integrate/quick/phase) + the 2 intercept hooks (writers)

---

## Purpose

Defines (1) the append-only telemetry **ledger event schema** written under
`.gsd-t/graphDB/logs/graph-events-NNN.jsonl`, and (2) the **rollup output shape** of
`gsd-t graph metrics`. The ledger makes the graph-vs-grep DECISION observable: every graph query
(Layer 1), every grep-intercept and read-intercept decision (Layer 2), and every workflow's wiring
mode (Layer 2c) is recorded. The rollup turns the raw ledger into the answer "did the graph answer,
or did we fall back to grep, and what for?".

## Sink, rotation, toggle

- **Sink:** `.gsd-t/graphDB/logs/graph-events-NNN.jsonl` (NOT the legacy `.gsd-t/metrics/graph-events.jsonl`).
- **Rotation:** by FILE SIZE or ENTRY COUNT (sized ≈ 2–3 hrs of heavy work per file), NOT daily;
  rollover seals `graph-events-001.jsonl` and starts `graph-events-002.jsonl`, etc.
- **Toggle:** `GSDT_GRAPH_TELEMETRY` env flag. Default **ON** (stated explicitly — never silent-off);
  `"0"` => OFF (zero lines written, graph still answers normally).
- **Fail-open:** a ledger write that throws NEVER blocks or alters a graph query, a grep result, or a
  read result. Logging is best-effort; the underlying decision is byte-identical with logging on/off.

---

## Ledger event schema

Each line is one JSON object. Three event families share the file; `kind` disambiguates.

### Layer 1 — graph query event (`kind:"query"`)

| Field | Type | Meaning |
|-------|------|---------|
| `kind` | `"query"` | event family |
| `ts` | ISO-8601 string | write time |
| `verb` | string\|null | graph verb (who-imports / who-calls / blast-radius / body / …) |
| `target` | string\|null | the queried symbol/file |
| `outcome` | enum | `hit` \| `hit-empty` \| `ambiguous` \| `not-found` \| `graph-unavailable` \| `error` |
| `tier` | string\|null | accuracy tier (compiler-accurate / tree-sitter-floor / partial) |
| `resultCount` | number\|null | result rows |
| `candidateCount` | number\|null | ambiguous-symbol candidates |
| `latencyMs` | number | query latency |
| `consumer` | string | `GSDT_GRAPH_CONSUMER` or `"cli"` |
| `via` | string\|null | `GSDT_GRAPH_VIA` |
| `staleOnQuery` | bool\|null | query ran against changed code |
| `reindexedCount` | number\|null | files auto-refreshed before answering |
| `addsCount` / `deletesCount` | number\|null | edge deltas on refresh |
| `reindexedFiles` | string[]\|null | refreshed file list (only when `reindexedCount>0`) |

### Layer 2a — grep-intercept decision (`kind:"grep"`)

| Field | Type | Meaning |
|-------|------|---------|
| `kind` | `"grep"` | event family |
| `ts` | ISO-8601 string | write time |
| `classified` | `"structural"` \| `"text"` \| null | grep classification |
| `action` | `"replaced"` \| `"passthrough"` | what the hook did |
| `patternShape` | string | structural shape of the grep pattern (not raw user text) |
| `consumer` | string | `GSDT_GRAPH_CONSUMER` or `"cli"` |

> EVERY grep that reaches the hook logs exactly one line — INCLUDING text-classified passthrough.

### Layer 2b — read-intercept decision (`kind:"read"`)

| Field | Type | Meaning |
|-------|------|---------|
| `kind` | `"read"` | event family |
| `ts` | ISO-8601 string | write time |
| `action` | `"augment"` \| `"passthrough"` | augment-vs-passthrough (never shrink) |
| `file` | string | the read target |
| `consumer` | string | `GSDT_GRAPH_CONSUMER` or `"cli"` |

### Layer 2c — workflow wiring mode (`kind:"wiring"`)

| Field | Type | Meaning |
|-------|------|---------|
| `kind` | `"wiring"` | event family |
| `ts` | ISO-8601 string | write time |
| `consumer` | string | the workflow (scan/verify/debug/integrate/quick/phase) |
| `graphWiringMode` | `"WIRED"` \| `"fallback-announced"` \| `"disabled"` | the graph-vs-grep posture |

> North-star: a `fallback-announced` wiring line co-occurring with a same-window `outcome:"hit"`
> query is the previously-invisible NiceNote scan-#12 contradiction, now machine-visible.

---

## Rollup output shape — `gsd-t graph metrics`

Mirrors `gsd-t metrics` (`doMetrics`, `bin/gsd-t.js:4873`) in shape and flags. READ-ONLY; tolerates
an empty or rotated ledger (never crashes). Implemented in `bin/gsd-t-graph-metrics-rollup.cjs`;
dispatched via `gsd-t graph metrics` (the `case "metrics"` arm added at `bin/gsd-t.js:4016`).
Reports, at minimum:

| Dimension | Source | Rollup field |
|-----------|--------|--------------|
| graph-hit-vs-grep-passthrough ratio | Layer-1 `outcome:hit*` vs. Layer-2a `action:passthrough` | `layer1.hitRatio` |
| fallback-rate | Layer-2c `graphWiringMode:fallback-announced` / total wiring events | `layer2c.fallbackRate` |
| p50 / p95 latency | Layer-1 `latencyMs` percentiles | `layer1.latency.{p50,p95}` |
| tier mix | Layer-1 `tier` distribution | `layer1.tierMix` |
| stale-query frequency | Layer-1 `staleOnQuery:true` rate | `layer1.staleRate` |
| reindex frequency | Layer-1 `reindexedCount>0` rate | `layer1.reindexRate` |
| per-consumer breakdown | group by `consumer` | `byConsumer` |
| per-verb breakdown | group by `verb` | `byVerb` |
| fallbackAnnouncedDespiteHit | Layer-2c `fallback-announced` co-occurring (same consumer + minute-window) with Layer-1 `outcome:hit` | `fallbackAnnouncedDespiteHit` |

### `fallbackAnnouncedDespiteHit` — North-star contradiction count (pre-mortem #8)

A non-zero value means a workflow consumer emitted a `graphWiringMode:"fallback-announced"` wiring
event in the same consumer+minute-window as a Layer-1 `outcome:"hit"` — i.e. the consumer claimed
it was falling back to grep, but the graph DID answer successfully. This count is the single
machine-visible proof that the scan-#12 NiceNote contradiction is now observable.

Co-occurrence window: same `consumer` field + same truncated-to-minute ISO-8601 timestamp bucket
(`ts.slice(0,16)` = `"YYYY-MM-DDTHH:MM"`).  The rollup counts distinct matching minute-buckets.

---

## Invariants (FAIL-blocking)

- The ledger sink is `graphDB/logs/`, never `.gsd-t/metrics/graph-events.jsonl`.
- Rotation is size/count-based, never daily.
- Telemetry OFF writes zero lines; the graph still answers.
- The classify→replace/passthrough and augment/passthrough decisions are byte-identical with
  logging on vs. off (fail-open never alters a decision).
- Every grep and every read interception logs exactly one line.
- Each of the 6 consumers + 2 hooks sets `GSDT_GRAPH_CONSUMER`; no `cli`-default leakage from inside
  a labeled workflow.
- This contract stays in sync with the emitted event keys (a drifted key set FAILs verify).
