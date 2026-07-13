# PseudoCode — Broken Graph HALTS, Absent Graph Auto-Builds

> Milestone source-of-truth (intention-first). Authored during the Architect's Six-Stage Pass.
> Objective: a BROKEN code graph must HALT all work and demand a fix; an ABSENT graph (never
> indexed) may auto-build then continue. Today both collapse to `reason:"graph-unavailable"` and
> every consumer silently greps — silent degradation, banned by GSD-T.

---

## The ONE seam (where broken-vs-absent is classified)

There are TWO failure surfaces, and the classifier must live at BOTH the producer edge and the
delegation edge so no consumer re-implements it:

1. **Producer edge** — `bin/gsd-t-graph-query-cli.cjs` `loadStore()` / `runFreshnessCheck()`:
   these already return `{ok:false, reason:"graph-unavailable"}`. They can DISTINGUISH absent
   (storePath === null → no file on disk) from broken (a store file exists but `loadSqliteStore`
   returned null → parse/corrupt failure).
2. **Delegation edge** — `bin/gsd-t.js` `_graphQueryCli()` (lines 3913–3933): when the CLI process
   **crashes** (missing top-level `require` → exit 1, empty stdout, `MODULE_NOT_FOUND` on stderr —
   PROVEN this pass), this is where "broken" is invisible today. A crash never emits an envelope,
   so `_graphQueryCli` fabricates `graph-unavailable` and hides it. THIS is the 12-day-hidden bug.

---

## CURRENT (broken == absent — silent degradation)

```
# ── PRODUCER: gsd-t-graph-query-cli.cjs ──
resolveStorePath():
    walk up looking for graphDB/graph.db, legacy .gsd-t/graph.db, or JSONL dir
    return null if none found            # ABSENT — no file anywhere

loadStore(storePath):
    if not storePath: return {ok:false, reason:"graph-unavailable"}   # ABSENT
    loaded = loadSqliteStore(storePath) or loadJsonlStore(...)
    if not loaded: return {ok:false, reason:"graph-unavailable"}      # BROKEN (corrupt/parse-fail)
    # ↑ SAME reason code for both. Consumer cannot tell them apart.

# ── DELEGATION: gsd-t.js _graphQueryCli() ──
_graphQueryCli(verbAndArgs):
    result = spawnSync(node, [cliPath, ...args])
    if result.error:  return {ok:false, reason:"graph-unavailable"}   # spawn failed
    if not stdout:    return {ok:false, reason:"graph-unavailable"}   # ← CRASH lands here!
    try: return JSON.parse(stdout)
    catch: return {ok:false, reason:"graph-unavailable"}              # non-JSON
    # ↑ A MODULE_NOT_FOUND crash (missing resolver) = empty stdout = "graph-unavailable".
    #   result.status (1) and result.stderr (MODULE_NOT_FOUND) are DISCARDED. Broken hidden.

# ── CONSUMERS (all 9) ──
every consumer:  if reason == "graph-unavailable": fall back to grep / graphAvailable=false
    # ↑ absent and broken take the SAME grep-fallback branch. No halt on broken. SILENT DEGRADATION.
```

## PROPOSED (broken → HALT, absent → auto-build → continue)

```
# ── PRODUCER: gsd-t-graph-query-cli.cjs — split the reason at the seam it ALREADY owns ──
loadStore(storePath):
    if not storePath: return {ok:false, reason:"graph-absent"}        # no file on disk → ABSENT
    loaded = loadSqliteStore(storePath) or loadJsonlStore(...)
    if not loaded:
        return {ok:false, reason:"graph-broken", detail:"store present but unreadable"}  # BROKEN
    ...

runFreshnessCheck(storePath):
    if not db (no real store at root):  return {ok:false, reason:"graph-absent"}   # ABSENT
    catch parse/corrupt:                return {ok:false, reason:"graph-broken", detail:err.code}

# ── DELEGATION: gsd-t.js _graphQueryCli() — CLASSIFY the crash, don't fabricate ──
_graphQueryCli(verbAndArgs):
    result = spawnSync(node, [cliPath, ...args])
    if result.error or (exit != 0 and no valid envelope on stdout):
        # process CRASHED before emitting an envelope → the CLI itself is BROKEN
        return {ok:false, reason:"graph-broken", detail: result.stderr | result.error.message}
    if valid JSON envelope on stdout:  return parsed   # trust the producer's own reason
    # (empty stdout WITH exit 0 shouldn't happen; treat as broken defensively)

# ── ONE shared classifier helper (extracted — the KEY reuse) ──
classifyGraphFailure(reason):        # bin/gsd-t-graph-availability.cjs (NEW, ~15 lines)
    if reason == "graph-absent":  return {state:"ABSENT",  action:"auto-build-then-continue"}
    if reason == "graph-broken":  return {state:"BROKEN",  action:"HALT-demand-fix"}
    return {state:"BROKEN", action:"HALT-demand-fix"}     # unknown reason = fail-closed to BROKEN

# ── CONSUMERS (all 9) route through the ONE helper — no duplicated branch ──
every structural consumer, on ok:false:
    c = classifyGraphFailure(envelope.reason)
    if c.state == "ABSENT":
        run `gsd-t graph index` once (auto-build), re-query           # ABSENT → build → continue
        if STILL absent after build → treat as BROKEN (build itself failing = broken infra)
    if c.state == "BROKEN":
        HALT: surface "graph BROKEN — fix it (gsd-t graph status)", return blocked-needs-human
        # NEVER grep-fallback on BROKEN. This is the whole point.

# ── EXEMPT consumers keep their ANNOUNCED carve-out, but must still DISTINGUISH ──
scan / verify / integrate:  on ABSENT → announced grep-mode / skip-gate continuation (unchanged)
                            on BROKEN → still surface a LOUD warning naming it BROKEN (not absent)
```

---

## Summary table

| Aspect | CURRENT | PROPOSED |
|--------|---------|----------|
| Reason codes | 1 (`graph-unavailable`) | 2 (`graph-absent`, `graph-broken`) |
| Absent (no index) | grep-fallback (silent) | auto-`graph index` → re-query → continue |
| Broken (missing dep / corrupt / crash) | grep-fallback (silent) — **hidden 12 days** | **HALT** → blocked-needs-human, demand fix |
| Crash classification (missing `require`) | fabricated `graph-unavailable` in `_graphQueryCli` | exit≠0 + stderr `MODULE_NOT_FOUND` → `graph-broken` |
| Where classified | nowhere (collapsed) | ONE producer seam + ONE delegation seam + ONE shared helper |
| Consumers | each duplicates grep-fallback branch | each routes `envelope.reason` → `classifyGraphFailure()` |
| Fail direction on unknown | grep (fail-open, wrong) | BROKEN/HALT (fail-closed, safe) |

---

## [RULE] guard map (feeds the deterministic verify gate)

- `[RULE] broken-graph-halts-never-greps` — a `graph-broken` reason NEVER takes a grep-fallback branch in any of the 9 consumers (except the announced verify/integrate/scan carve-out, which must name it BROKEN loudly, not silently continue).
- `[RULE] absent-graph-auto-builds-once` — a `graph-absent` reason triggers exactly one `gsd-t graph index` then re-query; a second consecutive absent = BROKEN (build infra failing).
- `[RULE] crash-classified-not-fabricated` — `_graphQueryCli` MUST inspect `result.status`/`result.stderr`; a non-zero exit with no valid envelope maps to `graph-broken`, never `graph-unavailable`/absent.
- `[RULE] unknown-reason-fails-closed-to-broken` — any unrecognised `ok:false` reason classifies as BROKEN (HALT), never ABSENT (continue).
- `[RULE] one-availability-classifier` — the absent-vs-broken decision lives in ONE helper (`bin/gsd-t-graph-availability.cjs`); no consumer re-implements the string check.
- `[RULE] false-broken-guarded` — transient failures (spawn timeout, DB lock `SQLITE_BUSY`) are retried once before classifying BROKEN, so a slow/locked query does not wrongly HALT all work.

---

## ⚠ Divergence flags

None yet — this supersedes NO shipped behavior; it SPLITS one existing reason code into two and
adds routing. The existing halt verdict (`blocked-needs-human`), the existing envelope shape
(`{ok,reason,detail}`), and the existing auto-build (`gsd-t graph index` / D4 freshness re-index)
are all REUSED. No new halt system, no new envelope, no new build path is created.
