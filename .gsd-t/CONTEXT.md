# Discuss CONTEXT — Session Retrospective Agent (the retro-agent / "governor")
Generated: 2026-06-09 17:05 PDT

> **Scope of this document.** This is the settled design for a **future milestone**: a Session
> Retrospective Agent that mines GSD-T's own event/transcript stream, proposes methodology
> improvements safely, and routes them through a human gate. The discuss phase locks the
> architecture; it does **NOT** implement it. The retro-agent is a *governor* — its job is to
> propose changes to the methodology that builds everything else, so a bad proposal that lands
> silently is a self-inflicted regression with no external customer to catch it.
>
> **Winning thesis (competition winner — Candidate A of 3): The Simplest Viable Architecture.**
> A governor fails when it is too elaborate to *trust*, not when it is too plain. Push everything
> that *can* be deterministic into CLI gates (mine, dedup, recurrence bar, audit, triggers), and
> reserve LLM agents for the three irreducibly-judgment tasks (symptom coherence, proposal
> authoring, adversarial review). A simpler governor is a more trustworthy governor — and trust
> is the only thing that lets a self-improvement loop ever be allowed to ship a change. Every
> stage, edge type, and red-team lens earns its place against the **seam test** (split only where
> context, model tier, or verification ownership changes) and the **dead-component test** (would
> removing it lose a real safety property?).

---

## Locked Decisions

The plan phase MUST implement each of these exactly. The partition phase MUST shape domains
consistent with them.

### L1 — Pipeline: 4 agents + 3 deterministic gates, no bespoke orchestrator

The ten conceptual stages from the spec collapse under the seam test to **4 LLM agents and 3
deterministic CLI gates**. The human gate and "adopt-with-prediction" are **not agents** — treating
them as pipeline stages is the over-decomposition that makes a governor unauditable.

```
Gate 0  retro-mine (CLI, deterministic)        — reads .gsd-t/events/*.jsonl
   │                                              + .gsd-t/metrics/{rollup,task-metrics,token-usage}.jsonl
   │                                              + .gsd-t/transcripts/; emits candidate symptom set (JSON);
   │                                              CAPS the candidate set (top-N recurrent by count) so
   │                                              Agent 1's context is bounded by construction.
Agent 1 cluster + silence-judge   [model: fable] — clusters symptoms, applies the silence bar;
   │                                              emits ONLY recurrent+material clusters (often: nothing / SILENT)
Agent 2 evidence-ladder proposal  [model: opus]  — one cluster → one proposal w/ evidence ladder
   │                                              + a falsifiable prediction
Gate 1  retro-ledger --dedup (CLI)               — refuses proposals matching a prior rejected/superseded edge
Agent 3 lens-paired red team      [parallel,opus] — attacks the *proposal* (methodology adversary)
Gate 2  human approval                           — the existing review/PR surface; NOT new code
Gate 3  gsd-t-audit shadow test                  — existing machinery; proves the change before adopt
   │
   └─ adopt-with-prediction = a ledger edge write + the next scheduled run re-checks the prediction
```

**Seam verdicts (the audit trail for why each merge/split is correct):**

| Conceptual stage | Seam verdict | Lands as |
|---|---|---|
| Mine transcripts/events | deterministic, no LLM | **Gate 0 (CLI)** |
| Symptom-cluster | needs LLM, same context+tier as judge | **merged into Agent 1** |
| Silence-judge | model-tier (Fable) + verification-ownership (it is the *bar*) | **Agent 1 (Fable)** |
| Evidence-ladder proposal | model-tier (Opus) + new context | **Agent 2 (Opus)** |
| Ledger-dedup | deterministic graph lookup, no LLM | **Gate 1 (CLI)** |
| Lens-paired red team | verification-ownership (adversarial), parallel | **Agent 3 (parallel)** |
| Human gate | not an agent | **Gate 2 (existing approval surface)** |
| Audit shadow test | reuses `gsd-t-audit` machinery verbatim | **Gate 3 (CLI)** |
| Adopt-with-prediction | a ledger write + a scheduled re-check | **Gate 1 write + Gate 0 on next run** |

**Reuse, don't build.** Gate 0 is a thin reader over the *already-existing* `.gsd-t/events/*.jsonl`,
`.gsd-t/metrics/{rollup,task-metrics,token-usage}.jsonl`, and `.gsd-t/transcripts/`. Gate 3 is the
*already-existing* `gsd-t-audit` shadow probe. The deterministic gates are immune to LLM drift, so they
need no red-teaming themselves (GSD-T house style: "gates in JS, not prose" —
`feedback_deterministic_orchestration`).

**The whole new surface is:**
- `bin/gsd-t-retro-mine.cjs` (Gate 0 — zero-dep, pure, never-throws posture, like `gsd-t-competition-judge.cjs`)
- `bin/gsd-t-retro-ledger.cjs` (Gate 1 dedup + ledger writes)
- `templates/workflows/gsd-t-retro.workflow.js` (one runtime-native workflow, M81 invariant: no `require`/`fs`/`process`, `args` arrives as a JSON STRING, all CLI calls via an `agent()`-Bash `runCli` helper)
- three prompt protocols in `templates/prompts/`: cluster+silence (Agent 1), proposal (Agent 2), and `retro-red-team-subagent.md` (Agent 3)

Everything else reuses existing event/metrics/audit infra. Gate 2 (human) and Gate 3 (`gsd-t-audit`)
add **zero** new code.

**Bounded-context mitigation (the accepted tradeoff, mitigated):** merging cluster+silence-judge means a
single Fable context holds both the raw symptom corpus and the bar logic. Gate 0's top-N cap bounds
Agent 1's context *before* Fable sees it. No streaming, no map-reduce fan-out in v1. Exceeding the cap is a
v2 scaling signal, not a v1 requirement (YAGNI).

### L2 — Ledger: append-only JSONL, four edge verbs, `model_era` as a scalar field

Append-only typed-edge JSONL at `.gsd-t/retro/ledger.jsonl`. **Graph data model, NO graph DB.** One flat
record type, one edge per line. Matches the existing `.gsd-t/events/*.jsonl` substrate — zero new dependency,
git-diffable, line-atomic appends, append-only (immutable history = the audit trail a self-modifying system
requires).

```jsonc
// .gsd-t/retro/ledger.jsonl  (append-only, one edge per line)
{
  "id": "retro-0007",                 // monotonic, stable
  "ts": "2026-06-10T00:00:00-07:00",  // local-offset ISO via localIsoWithOffset() from bin/gsd-t-time-format.cjs
  "edge": "PROPOSES",                 // closed 4-verb vocabulary (below)
  "from": "cluster-virtualized-dom",  // symptom cluster id OR proposal id
  "to":   "proposal-0007",            // proposal id OR contract/file target OR prior edge id (for supersede)
  "model_era": "opus-4-8",            // the model that authored/judged THIS edge
  "evidence": ["binvoice 692fe9fc", "scan#12 TD-113"],  // citations, not prose
  "prediction": "debug needs-human x2 rate drops >50% over next 5 runs",  // for PROPOSES/ADOPTS
  "status": "open"                    // open | rejected | adopted | superseded
}
```

**Edge vocabulary — exactly four verbs. The closed vocabulary IS the robustness lever; an open vocabulary rots.**

| Edge | Meaning | Written by |
|---|---|---|
| `OBSERVES` | a symptom cluster was seen (count, span) | Gate 0 / Agent 1 |
| `PROPOSES` | a cluster → a methodology change w/ prediction | Agent 2 |
| `REJECTS`  | a proposal was killed (by red team OR human OR audit) | the gate/agent that killed it |
| `ADOPTS`   | a proposal shipped; carries the prediction to re-check | Gate 2/3 + next run |

`superseded` is a **status mutation written as a new line** whose `to` references a prior edge `id` — **NOT** a
fifth edge verb. JSONL is append-only, so "supersede" is just an `ADOPTS`/`REJECTS` pointing at a prior id. The
vocabulary stays closed; dedup stays a flat scan.

**Dedup (Gate 1) is a flat scan, not a graph traversal.** "Have we proposed this cluster signature before, and
was it REJECTED or ADOPTED?" is grep-level: read the JSONL, match on `from` cluster signature + `edge`. No graph
engine, no transitive closure in v1. The "typed-edge graph" framing is honored by the *vocabulary*; the
*implementation* is a line scan. That is the entire point of "graph data model, NO graph DB."

**Model-era fencing — a scalar field, not a partition.** `model_era` is just a string on each edge. Recurrence
thresholds (L3) count only edges whose `model_era` matches the current era (default = current-only, the
strictest bar; configurable to "within the last K eras"). When a new model ships, old-era edges are
**down-weighted but not deleted** — an old model's pain may be a solved problem. This is one comparison in the
mine step: no schema versioning, no migration, no separate era table. *(Salvaged refinement from Candidate B:
a "persists-across-eras" recurrence — a cluster that recurs in BOTH the current and a prior era — is a
**stronger** signal and may be surfaced separately even when the default bar is current-only. Cross-era
aggregation is explicit, never the default.)*

**Tradeoff accepted:** O(n) flat scans, no rich relationship queries. The ledger grows by a handful of edges per
*milestone*, so n stays in the hundreds for years. A graph DB would solve a problem we will not have. If the
ledger ever exceeds ~10k lines, an index file is a trivial v2 add — YAGNI until measured.

### L3 — Silence-judge bar: a deterministic recurrence gate in front of a Fable judgment

The silence-judge's whole value is **saying nothing most of the time.** The bar is biased toward silence; most of
it is deterministic. Two layers, deterministic-first:

1. **Deterministic recurrence gate (CLI, inside Gate 0 — runs BEFORE Fable):**
   - A symptom cluster passes only if `count >= R` within the current `model_era`. **Default R = 3** (once is
     noise, twice is coincidence, three times is a pattern). R is config, not a magic number hard-coded in source.
   - AND it must be **material**: tied to one of the deterministic workflow signals (L5) OR a measured metric
     regression in `metrics/rollup.jsonl`. Aesthetic/style symptoms are filtered here, before any LLM sees them.
   - This gate alone kills the vast majority of candidate symptoms at zero token cost.
   - **CRITICAL severity escape hatch:** symptoms tagged `CRITICAL` by a workflow signal (e.g. a
     destructive-action-guard trip, a data-loss event) bypass the recurrence count and go straight to Fable with
     `R = 1`. One extra branch, not a tunable model.

2. **Fable silence-judgment (Agent 1 — only on survivors):** Fable does the *quality* judgment the deterministic
   gate cannot: "are these N occurrences the *same* root cause, or N coincidentally-similar symptoms?" Returns
   either a tight cluster with a single hypothesized root cause, or **`SILENT`** (propose nothing). The bias is
   structural — Fable is instructed that `SILENT` is the *expected* output and a proposal must clear an explicit
   "would I bet a milestone on this?" framing.

**Calibration — two known-answer fixtures, run in CI (the acceptance gate, lock this):**
- **Positive fixture:** the `binvoice 692fe9fc` case — *3 distinct symptoms → 1 virtualized-DOM root cause*. The
  silence-judge MUST cluster those 3 into 1 root cause and surface exactly ONE proposal. Staying `SILENT` on
  binvoice = false-negative = bar too high. This catches **under-clustering** (splitting one root cause into N
  noisy proposals); **over-clustering** is caught by the negative fixture.
- **Negative fixture:** 3 superficially-similar but unrelated symptoms the judge MUST stay `SILENT` on
  (false-positive guard / over-clustering guard).
- *(Salvaged from Candidate B — strengthens the lock):* both fixtures are **executable known-answer tests (KATs)**
  checked into the test suite, run as a regression gate on **every** retro-agent change. A future model-era swap or
  prompt edit that degrades the judge's discrimination **fails CI, not production**. Store at
  `templates/test-fixtures/retro/` (e.g. `binvoice-692fe9fc-kat.json` for the positive + an unrelated-symptoms KAT
  for the negative): sanitized transcript + expected cluster + expected single root cause + expected `SILENT`. This
  makes the bar *tunable without fear* — KATs catch over-loosening (noise floods) and over-tightening (real findings
  silenced). No ROC curves, no threshold sweeps — two hand-labeled cases, pass/fail.

### L4 — Lens-paired adversarial red team: 3 agents, not 4

This is the **4th adversarial dual** of the orthogonal-validation triad: the existing Red Team attacks *code* at
verify; this one attacks *proposals to change GSD-T itself* at the retro stage. **3 lenses**, each the adversarial
dual of one affirmative claim in the proposal — three claims, three attackers, no claim un-attacked, no attacker
redundant.

| Agent | Lens | Paired adversarial question |
|---|---|---|
| 1 | **Regression lens** | "What working behavior does this proposal break?" (Prime Directive #2 — downstream effects; dual of the proposal's *"this helps"* claim) |
| 2 | **Goodhart lens** | "If adopted, what does the metric reward that we don't actually want? How is the prediction gameable?" (dual of the *"here's a falsifiable prediction"* claim) |
| 3 | **Evidence lens** | "Is the evidence ladder real, or a 1-occurrence story dressed as a pattern? Re-check the ledger counts and `model_era` fencing." (dual of the silence-judge's *"this recurs"* claim) |

**Why 3, not 4:** a 4th agent's marginal coverage is dominated by the two human-in-the-loop gates immediately
downstream (Gate 2 human approval + Gate 3 audit shadow test) that a *code* red team does not have. The methodology
red team can afford to be leaner *because* it is not the last line of defense — the human and the empirical shadow
test are. A 4th lens would have to attack a claim that doesn't exist yet, i.e. invent coverage the proposal doesn't
need. Over-investing in red-team breadth here defends a position already defended twice more downstream.

**Verdict semantics (reuse the existing red-team contract verbatim):** `FAIL` (any lens lands a CRITICAL/HIGH on
the proposal → proposal does not reach the human gate; logged as `REJECTS` in the ledger) / `GRUDGING-PASS` (all
three lenses exhausted, nothing landed → proposal proceeds to human). Run on `model: opus`, fresh context, parallel.
Same machinery as `templates/prompts/red-team-subagent.md` with a methodology-attack protocol body —
`templates/prompts/retro-red-team-subagent.md`. A `FAIL` is **never silently dropped and never silently adopted** —
the proposal is annotated with the defeater and either auto-revised once + re-attacked, or returned to the human as
"red-team-blocked, here's why."

### L5 — Scheduling + event-trigger wiring: one weekly cron + three deterministic signals, sentinel-file mechanism

The retro-agent runs **cheaply and rarely on a schedule, and reactively on hard signals.** Both paths are
deterministic — **NO LLM in the trigger logic** (`feedback_deterministic_orchestration`).

1. **Scheduled path (the baseline):** one cron entry, **weekly**, low-priority, off-peak. It runs Gate 0 (mine) and
   *only* continues to the Fable judge if the deterministic recurrence gate produced survivors. Most weekly runs cost
   one cheap CLI mine and stop at "nothing recurrent — SILENT." Weekly (not daily) because methodology pain accrues
   over *milestones*, not hours — daily would just re-mine an unchanged event stream.

2. **Event-trigger path (the reactive escape hatch)** — wire to three signals the workflows **already emit**:

   | Signal | Source (already exists) | Threshold |
   |---|---|---|
   | `debug needs-human` | `gsd-t-debug.workflow.js` emits `blocked-needs-human` after 2-cycle exhaustion | **x2** (same milestone / same file-set) within a window → trigger |
   | `verify failed` | `gsd-t-verify.workflow.js` emits `VERIFY-FAILED` | **x2** consecutive on the same milestone/domain → trigger |
   | `red-team non-convergence` | red-team cycles >2 without GRUDGING-PASS | **x1** (non-convergence is itself the rare signal; per `feedback_coverage_check_structural_not_substring` it is "a design defect, halt + escalate") → trigger |

   **Mechanism — the simplest possible: a counter file + a workflow-completion hook.** Each workflow already writes
   its terminal result; a thin appender bumps a per-signal counter in `.gsd-t/retro/triggers.jsonl`. When a counter
   crosses its threshold, the hook drops a sentinel file (`.gsd-t/retro/.fire`) that the next scheduled tick (or a
   dedicated lightweight cron checking the sentinel every few hours) acts on. **No new event bus, no daemon, no live
   subscription.** The trigger is "a file exists" — the most debuggable trigger mechanism possible.

   **Why sentinel-file over live event subscription:** a live subscriber is a long-running process that can die
   silently (the `compaction_regression` / `global_bin_propagation_gap` failure class — silent breakage of background
   machinery). A sentinel file is inspectable (`ls .gsd-t/retro/.fire`), survives restarts, and its worst failure mode
   is "retro runs one tick late," not "retro silently never runs." For a governor, observable-and-late beats
   invisible-and-prompt.

**Out-of-band invariant (salvaged from Candidate B — promoted to a hard rule):** the retro-agent **NEVER runs inside
a hot workflow.** A `verify-failed` or `debug needs-human` trigger does NOT pause the triggering workflow — it
appends a counter line / drops the sentinel and the workflow moves on. The retro runs out-of-band (scheduled tick or
a dedicated sentinel-checking tick). This protects the hot path's latency and prevents a retro proposing a change
mid-milestone that destabilizes the very run that triggered it.

**Kill semantics (matches `feedback_kill_loop_cron_removal`):** killing the loop = deleting the cron/wakeup entry
(CronList → CronDelete), not just "stop re-arming." Removing the sentinel + the cron entry is a clean kill.

**Cross-project note — single-project in v1.** `.gsd-t/retro/` is per-project. Cross-project aggregation is a
git-shared-learning concern (a separate backlog item) and a clear v2 seam — do NOT couple it into v1. One project,
one ledger, one cron. Prove the loop closes on GSD-T's own repo (dogfood) before generalizing.

---

## Risks

1. **A bad methodology change landing unverified compounds across every project the framework touches.** This is the
   one failure mode that matters for a self-modifying loop. Mitigation: the triple downstream defense (red team →
   human gate → audit shadow test) plus the silence bar's bias-toward-silence. No proposal reaches adopt without
   clearing all three.
2. **Alert fatigue trains the human to rubber-stamp the gate.** Mitigation: the high, calibrated silence bar (L3) —
   the bar exists to protect the human's attention, the scarcest resource in a human-gated loop. The two KAT fixtures
   guard both over- and under-surfacing.
3. **Model-era drift silently poisons the next model's retro with stale verdicts** (the `feedback_audit_old_model_work`
   failure class — old-model work usually sound but must be re-judged fresh). Mitigation: mandatory `model_era` scalar
   on every edge; default recurrence bar is current-era-only.
4. **Background trigger machinery breaking silently** (the `compaction_regression` / `global_bin_propagation_gap`
   class). Mitigation: sentinel-file mechanism (inspectable, restart-surviving) instead of a live subscriber; fail-open
   counter hook (a missing/corrupt counter file degrades to "retro runs on schedule," never "retro crashes a
   workflow").
5. **Bounded Fable context if a project's symptom corpus is huge.** Mitigation: Gate 0's top-N cap bounds Agent 1's
   context by construction. Exceeding the cap is a v2 scaling signal, not a v1 requirement.

---

## Deferred Ideas

Good ideas surfaced in competing proposals but **NOT** in scope for v1. Plan must NOT implement these.

- **Node/edge file separation (`nodes.jsonl` + `edges.jsonl`)** — Candidate B's robust storage shape. Deferred: the
  flat single-stream JSONL with a closed 4-verb vocabulary makes dedup a flat scan already; node/edge separation buys
  query convenience we don't need at this volume. Revisit only if dedup becomes a measured bottleneck.
- **Registry-backed plugin seams (collectors / lenses / edge-vocab / triggers as data registries)** — Candidate C's
  extensibility architecture. Deferred: it is the explicit anti-thesis of the winning simplicity thesis. Four
  registration seams before a single retro run has executed is premature generality. If a *measured* need to add a
  second collector or lens appears, *that* is the v2 signal to introduce a registry — not before.
- **A 4th red-team lens** (e.g. an opposed lens-pair / a generality lens). Deferred: 3 lenses cover the three
  affirmative claims; downstream human + audit gates cover the rest.
- **Daily (or sub-weekly) scheduled cadence.** Deferred: methodology pain accrues over milestones; weekly is the
  correct steady-state cadence.
- **Live event-subscription triggering.** Deferred in favor of the sentinel file (observable-and-late > invisible-and-prompt).
- **Cross-project aggregation / git-shared learning.** Deferred to a v2 seam — single-project in v1.
- **A ledger index file / richer relationship queries.** YAGNI until the ledger exceeds ~10k lines (years away at a
  handful of edges per milestone).

---

## Claude's Discretion

Implementation details Claude may choose freely during plan/execute, within the locked shape above:

- Exact symptom-cluster **fingerprint hash algorithm** (used for dedup matching on `from`).
- The exact top-N cap value in Gate 0 (bound it; the number is tunable).
- Exact JSONL field names *within* the locked schema shape, and the exact `R`/cap/window config field names in a
  retro config file.
- Whether the sentinel-checking tick reuses the existing `gsd-t-unattended-watch` tick harness or is a dedicated
  lightweight cron.
- The precise weekly cron day/time (off-peak).
- Exact prompt wording for the three protocol bodies (cluster+silence, proposal, retro-red-team) — the
  *verdicts/outputs* are locked (SILENT / one-proposal-with-prediction / FAIL|GRUDGING-PASS), the prose is not.
- Whether Gate 0 and the existing `.gsd-t/events` writer share a reader module (an impact-analysis question for the
  plan/impact phase).

---

## Future-Milestone Domain Sketch (non-binding — for the eventual partition phase)

When the retro-agent milestone is launched, a file-disjoint partition consistent with L1–L5 might shape as:

- **D-mine** — `bin/gsd-t-retro-mine.cjs` (Gate 0: reader + deterministic recurrence/materiality gate + top-N cap + CRITICAL escape).
- **D-ledger** — `bin/gsd-t-retro-ledger.cjs` (Gate 1 dedup + the four-verb append-only writes) + `.gsd-t/retro/` layout.
- **D-workflow** — `templates/workflows/gsd-t-retro.workflow.js` (runtime-native orchestrator wiring the 4 agents + 3 gates) + the three `templates/prompts/` protocol bodies (incl. `retro-red-team-subagent.md`).
- **D-triggers-fixtures** — the sentinel/counter hook + `.gsd-t/retro/triggers.jsonl` wiring + the two KAT fixtures under `templates/test-fixtures/retro/` + the M71-family CI lint that runs them.

No file is assigned to two domains. The two reused surfaces (`gsd-t-audit`, the human review surface) add no new
code and belong to no domain. This sketch is **non-binding** — the partition phase owns the final shape.

---

> *Superseded:* the prior contents of this file documented the **M61 Platform Reconciliation** discuss
> (concluded; M61 shipped as v4.0.10). That discuss is complete and its decisions live in the M61 milestone
> archive under `.gsd-t/milestones/`. This file now carries the live retro-agent discuss output.
