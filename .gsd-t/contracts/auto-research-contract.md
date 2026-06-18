# Contract: Auto-Research Gate + Web-Research Stage (M89)

## Version: 1.0.0
## Status: STABLE
## Owner: m89-d2-research-stage-and-contract
## Consumers: m89-d1-research-classifier-core, m89-d3-wiring-upper-phase-and-gate, m89-d4-wiring-worker-workflows
## Created: 2026-06-18 (M89 partition)

---

## Purpose

M89 makes "research the unknown instead of guessing" a **deterministic, auditable gate** rather than
the advisory `Research Policy` prose in `CLAUDE-global.md`. A stated gap is classified
internal-vs-external; an external gap triggers a real web-research stage that writes a **cited
Verified-Facts block** into the phase artifact BEFORE the gate re-runs. An external gap that proceeds
WITHOUT research FAILS. No silent guessing.

This contract is the **partition-time seam**: it pins (1) the classifier JSON-envelope shape so the
classifier (D1) and the wiring domains (D3/D4) agree without coupling, (2) the research agent() stage
interface, (3) the Verified-Facts cited-block format, (4) the idempotency rule, and (5) the
no-silent-guess gate semantics. D1 PRODUCES the classifier matching the envelope below; D3/D4 CONSUME
the envelope SHAPE + stage interface, never D1's internals.

---

## 1. Classifier JSON Envelope (the seam D1 produces, D3/D4 consume)

`bin/gsd-t-research-gate.cjs` emits the house-style JSON envelope. Given a stated gap (free text),
it returns:

```json
{
  "ok": true,
  "gap": "<the stated gap text, NAMED — auditable, never silent>",
  "class": "internal" | "external",
  "route": "grep" | "web",
  "reason": "<one-line deterministic rationale>"
}
```

- `class: external` + `route: web` when the gap concerns: a **third-party API** contract / endpoint /
  rate-limit / error-shape / auth flow; **library / framework / version** behavior; **platform /
  browser / runtime** behavior; a published **standard / spec**; or **current-best-practice /
  latest-version** facts.
- `class: internal` + `route: grep` (NEVER web) when the gap concerns **this repo's own**
  code / contracts / schema / file-ownership / sandbox rules / test architecture.
- **Ambiguous → internal-first**: classify internal, route grep; escalate to external ONLY if
  grep/Read returns nothing (the wiring domains own the escalation step).
- The envelope ALWAYS names the gap text (`gap` field) — classification is auditable, never silent.
- On bad input → `{ "ok": false, "error": "<reason>" }` (house-style error envelope).

The classifier is **deterministic**: identical gap text → identical envelope. No LLM call inside the
classifier itself (it is a calculator, not a critic — mirrors the competition-judge convention).

---

## 2. Research agent() Stage Interface (D2 spec; D3/D4 embed inline)

The orchestrator sandbox has NO `fs`/`require` (M81), so the research stage is embedded **inline** in
each consuming workflow as an `agent()` call. D2 defines the canonical shape so all six workflows wire
it identically; the prompt body lives at `templates/prompts/research-subagent.md` (Read at spawn time,
mirroring the triad-protocol convention).

- **Input:** one external gap (the classifier envelope's `gap` text).
- **Tool access:** `WebSearch` + `WebFetch` (the ONLY stages granted web tools).
- **Output:** a Verified-Facts block (§3) with source URLs. Schema-validated.
- **Model:** the research stage uses a **BARE literal `model: "fable"`** (Fable tier — the single
  highest-leverage web call per phase; mirrors the M85 rationale for the 5 highest-leverage stages).
  **It does NOT use the `overrides["research"] ?? "<literal>"` form.** Plan-hardening correction (M89
  plan phase): the `??`-override form's bracket key MUST be one of the 6 INJECTABLE designated stages
  (`solution-space-probe`, `partition-probe`, `competition-judge`, `pre-mortem`, `red-team`,
  `debug-cycle-2`) — `research` is not one, `bin/gsd-t-model-tier-policy.cjs` has no `research` key
  (an unknown stage resolves to a defensive `sonnet` WITH a configError, never fable), and the live
  M85 lint (`test/m85-workflow-tier-policy-lint.test.js`) FAILS any `overrides["research"] ?? …` line.
  Non-designated workflow stages already declare models with bare literals (e.g.
  `gsd-t-execute.workflow.js:172` `model: "sonnet"`). The bare `"fable"` literal passes the lint's
  tier-set membership check. _(This is a clarification of the intended form, not an envelope-shape
  change — contract stays v1.0.0 STABLE.)_

---

## 3. Verified-Facts Cited-Block Format (uncited fact FAILS — SC2)

Written into the phase artifact (the markdown the phase produces). Canonical block:

```markdown
## Verified Facts (auto-research)

- **<fact statement>** — source: <https://exact.url/path> (fetched YYYY-MM-DD)
- **<fact statement>** — source: <https://exact.url/path> (fetched YYYY-MM-DD)
```

- Every fact line MUST carry a `source: <url>`. An **uncited fact FAILS** the gate (SC2).
- The block heading is exactly `## Verified Facts (auto-research)` (machine-detectable by the gate).

---

## 4. Idempotency Rule (already-cited fact ⇒ no re-research — A2)

Before triggering research for an external gap, the wiring domain scans the phase artifact for an
existing Verified-Facts entry covering that gap. If a cited fact already covers it, the research stage
is SKIPPED (no re-research). Re-running a phase whose artifact already has the cited block performs
ZERO additional WebSearch calls.

---

## 5. No-Silent-Guess Gate Semantics (A3 + A4)

- **A3 — internal gap → ZERO WebSearch.** An internal-classified gap routes to grep/Read only;
  invoking WebSearch on an internal gap is a FAILURE. The wiring tests assert zero WebSearch calls on
  the labeled internal corpus.
- **A4 — external gap skipped → verify FAILS.** A phase artifact that recorded an external gap (the
  classifier returned `class: external`) but contains NO matching Verified-Facts cited block FAILS the
  `gsd-t-verify` gate. Wired by D3 into `gsd-t-verify.workflow.js`.

---

## 6. Labeled Corpus (the A1 killing oracle — D1 owns)

The classifier's A1 test feeds a 13-item hand-labeled corpus and asserts every label matches
deterministically; a single mislabel FAILS, and the milestone HALTS for re-scope before any wiring.

| # | Source | Gap (abbrev) | Expected |
|---|--------|--------------|----------|
| 1-7 | M87 findings | repo-internal (own code/contracts/sandbox/tests) | all **internal** (0 external) |
| 8-13 | binvoice S2-M5 findings | mixed | **2-3 external** incl. PayPal OAuth `/v1/oauth2/token` mint + v2 invoice-TOTAL limit |

Corpus lives at `test/fixtures/m89-labeled-corpus.json` (D1-owned).

---

## File Ownership (disjoint)

| Surface | Owner |
|---------|-------|
| `bin/gsd-t-research-gate.cjs`, classifier test, `test/fixtures/m89-labeled-corpus.json` | D1 |
| this contract, `templates/prompts/research-subagent.md`, cite-format test | D2 |
| doc-ripple (`templates/CLAUDE-global.md` Research Policy replacement, `bin/gsd-t.js` dispatch case, `commands/gsd-t-help.md`) | D2 |
| `templates/workflows/gsd-t-phase.workflow.js`, `gsd-t-verify.workflow.js` + wiring tests | D3 |
| `templates/workflows/gsd-t-{execute,debug,quick,wave}.workflow.js` + wiring tests | D4 |

D3 and D4 NEVER touch each other's workflow files (one-domain-per-workflow-file). D2 is the SINGLE
owner of every shared doc-ripple surface (CLAUDE-global.md, bin/gsd-t.js, commands/gsd-t-help.md) —
no co-author conflict possible.
