# Contract: Auto-Research Gate + Web-Research Stage (M89)

## Version: 1.1.0
## Status: STABLE
## Owner: m89-d2-research-stage-and-contract
## Consumers: m89-d1-research-classifier-core, m89-d3-wiring-upper-phase-and-gate, m89-d4-wiring-worker-workflows
## Created: 2026-06-18 (M89 partition)

## Changelog
- **v1.1.0 (2026-06-18 — M89 plan-phase pre-mortem fixes):** closes 4 plan findings.
  - **§1.1 (finding #1, CRITICAL):** classification is by **FEATURE CLASS** (external-signal vs.
    internal-signal sets), NOT by corpus-keyword matching. Defines the deterministic signal-class
    heuristic precisely; A1 now also feeds a HELD-OUT corpus (≥6 novel gaps) so a classifier that
    memorized the seen 13 FAILS — kills the self-fulfilling-oracle trap.
  - **§4.1 (finding #2, HIGH):** "covers" is defined as **exact normalized-gap-key match** (NOT
    substring/keyword/fuzzy), with the PayPal-OAuth-vs-invoice-TOTAL negative example — a cited gap A
    must NOT skip a distinct gap B that merely shares keywords.
  - **§5.1 (finding #3, HIGH):** the **ambiguous → internal-first → grep → escalate-to-external**
    capability is owned + functionally tested by the WIRING domains (D3/D4), not deferred and not
    orphaned. An ambiguous gap grep cannot resolve DOES trigger research + a cited block.
  - **§5/A3 (finding #5, MEDIUM):** A3 reconciled to the **routing-decision** wording (the sandbox has
    no per-stage `tools:` allowlist) and structurally enforced — the research stage is the SOLE
    web-tool-granting `agent()`, so internal class never searches.
- **v1.0.0 (2026-06-18 — M89 partition):** initial seam (§1 envelope, §2 stage interface incl. the
  bare-`fable` model correction, §3 cite format, §4 idempotency, §5 no-silent-guess, §6 corpus oracle).

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

### 1.1 Classification is by FEATURE CLASS, not by corpus keywords (finding #1 — anti-self-fulfilling-oracle)

The classifier MUST decide by **feature class** — detecting external-vs-internal SIGNALS in the gap —
NOT by hard-matching keywords scraped from the labeled-corpus gap strings. A router that hard-matches
the literal tokens `PayPal` / `OAuth` / `invoice` lifted from the 13 authoring gaps would pass the seen
corpus 13/13 yet generalize to nothing — the shallow-test trap. The discrimination heuristic is
deterministic and feature-based:

- **External-signal set** (any present ⇒ lean external): a recognized **third-party / library /
  platform / spec proper noun** (e.g. a vendor or product name, an SDK, a browser, a standard body);
  an **API / endpoint / HTTP / OAuth / webhook / spec / version / limit / rate-limit / error-shape /
  auth-flow term**; a **browser / runtime behavior** reference.
- **Internal-signal set** (any present, and no overriding external signal ⇒ lean internal): a
  **repo-relative path**, a **known local symbol / file name**, an explicit **"this repo / our / the
  existing"** anchor; this repo's own code / contracts / schema / file-ownership / sandbox rules /
  test architecture.
- The heuristic is deterministic enough to gate without an LLM: it is signal-class detection over the
  gap text, NOT a per-corpus allowlist. A1's HELD-OUT corpus (≥6 NOVEL gaps, D1-owned at
  `test/fixtures/m89-heldout-corpus.json`) proves generalization — a classifier passing the seen 13 but
  failing any held-out item FAILS A1.

### 1.2 Class → route mapping

- `class: external` + `route: web` when the gap concerns: a **third-party API** contract / endpoint /
  rate-limit / error-shape / auth flow; **library / framework / version** behavior; **platform /
  browser / runtime** behavior; a published **standard / spec**; or **current-best-practice /
  latest-version** facts.
- `class: internal` + `route: grep` (NEVER web) when the gap concerns **this repo's own**
  code / contracts / schema / file-ownership / sandbox rules / test architecture.
- **Ambiguous → internal-first**: when neither signal set dominates, classify internal, route grep;
  escalate to external ONLY if grep/Read returns nothing. The classifier emits `class:internal`;
  the **escalation step is owned and tested by the wiring domains (D3 + D4)** — see §5.1.
- The envelope ALWAYS names the gap text (`gap` field) — classification is auditable, never silent.
- On bad input → `{ "ok": false, "error": "<reason>" }` (house-style error envelope). **Bad input
  includes empty string, whitespace-only, and non-string** — these return `{ok:false,error}` (NOT a
  silent `class:internal`) and a non-zero CLI exit (finding #6).

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
  change — landed in v1.0.0; §2 itself is unchanged at the v1.1.0 bump.)_

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
existing Verified-Facts entry **covering** that gap. If a cited fact already covers it, the research
stage is SKIPPED (no re-research). Re-running a phase whose artifact already has the cited block
performs ZERO additional WebSearch calls.

### 4.1 "covers" is exact normalized-gap-key match — NOT fuzzy / substring / keyword overlap (finding #2)

"Covers" is defined precisely to avoid a fuzzy match wrongly skipping a DISTINCT gap. A Verified-Facts
entry **covers** a gap iff its recorded **gap-key equals** the gap-key of the new gap, where:

- **gap-key** = a deterministic normalization of the gap statement: lowercase, collapse internal
  whitespace, strip surrounding punctuation/quotes. (NOT a substring test, NOT a token-overlap / keyword
  score, NOT a fuzzy/edit-distance match.) Identical normalized statements ⇒ same key ⇒ covered.
- Two gaps that merely share keywords are **DISTINCT** and BOTH route to research. Worked example
  (the load-bearing negative): a cited fact for **"PayPal OAuth `/v1/oauth2/token` mint"** (gap A) does
  NOT cover **"PayPal v2 invoice TOTAL amount limit"** (gap B) — different normalized statements ⇒
  different gap-keys ⇒ gap B still routes to research even though both contain "PayPal". A fuzzy
  "covers" that skipped gap B because gap A mentioned PayPal would be a defect.
- The Verified-Facts block records, per entry, the gap-key it answers (so the idempotency scan is an
  exact key lookup, not prose matching). The skip predicate returns `skip` ONLY on an exact gap-key
  hit; otherwise `research`.

---

## 5. No-Silent-Guess Gate Semantics (A3 + A4)

- **A3 — internal gap → research stage NOT entered.** An internal-classified gap routes to grep/Read
  only; the research `agent()` stage is NOT reached. **A3 is asserted on the ROUTING DECISION, not on a
  literal WebSearch-call count** (finding #5): the Workflow `agent()` sandbox exposes NO declarative
  per-stage `tools:` allowlist — tool access is harness/prompt-governed, so "zero WebSearch" is provable
  only as "the internal class routes to grep and the external-research branch condition is FALSE, so no
  research agent() is reached." The wiring tests assert this routing decision over the labeled internal
  corpus. **Structural enforcement:** the ONLY `agent()` stage whose PROMPT grants WebSearch/WebFetch is
  the research stage (§2) — there is no other web-capable stage — so "internal never searches" holds
  because the only path to a web tool is the research stage, and the internal class never enters it.
  D4's `m89-internal-gap-no-websearch.test.js` asserts BOTH the routing decision AND that the research
  stage is the sole web-tool-granting `agent()` (grep the workflow + prompt set: exactly one stage
  references WebSearch/WebFetch).
- **A4 — external gap skipped → verify FAILS.** A phase artifact that recorded an external gap (the
  classifier returned `class: external`) but contains NO matching Verified-Facts cited block FAILS the
  `gsd-t-verify` gate. Wired by D3 into `gsd-t-verify.workflow.js`.

### 5.1 Ambiguous → internal-first → grep → escalate-to-external (finding #3 — owned + tested by D3/D4)

The "ambiguous → internal-first, escalate to external only if grep/Read returns nothing" capability is
a FULL behavior, not a deferral. It is owned by the WIRING domains (D3 for upper phases, D4 for worker
phases) and exercised by a functional test. The flow:

1. Classifier returns `class:internal` for an ambiguous gap (neither signal set dominates — §1.1).
2. The wiring stage runs grep/Read against the repo for the gap.
3. **If grep/Read resolves it** → done; the gap is internal, no web. (No research stage.)
4. **If grep/Read returns nothing** → the wiring stage RE-ROUTES the gap to external → runs the research
   `agent()` stage → writes a cited `## Verified Facts (auto-research)` block (§3) into the artifact.

This escalation is NOT in the classifier (D1 stays a pure calculator). It lives in D3 (`gsd-t-phase`)
and D4 (`gsd-t-execute`/`gsd-t-quick`/`gsd-t-debug`) and is asserted by a functional test: an ambiguous
gap that grep CANNOT resolve DOES trigger the research stage and DOES produce a cited block. (Do NOT
defer — the full capability ships here.)

---

## 6. Labeled Corpus (the A1 killing oracle — D1 owns)

The classifier's A1 test feeds a 13-item hand-labeled corpus and asserts every label matches
deterministically; a single mislabel FAILS, and the milestone HALTS for re-scope before any wiring.

| # | Source | Gap (abbrev) | Expected |
|---|--------|--------------|----------|
| 1-7 | M87 findings | repo-internal (own code/contracts/sandbox/tests) | all **internal** (0 external) |
| 8-13 | binvoice S2-M5 findings | mixed | **2-3 external** incl. PayPal OAuth `/v1/oauth2/token` mint + v2 invoice-TOTAL limit |

Corpus lives at `test/fixtures/m89-labeled-corpus.json` (D1-owned).

**Held-out generalization corpus (finding #1).** A1 ALSO feeds a SECOND fixture
`test/fixtures/m89-heldout-corpus.json` (D1-owned) — ≥6 NOVEL gaps NOT used to author the classifier
(3 external: Stripe webhook signature header; Chrome `storage.local` quota limit; CSS `:has()`
browser-support — 3 internal: `isOrderLocked` return; owner of `gsd-t-verify.workflow.js`;
`cli-preflight` exit code). The classifier must label the held-out set correctly by feature class.
**Passing the seen 13 but failing any held-out item is an EXPLICIT A1 FAILURE** (proves keyword
memorization, not generalization). None of the held-out proper nouns/symbols appears in the seen corpus.

---

## File Ownership (disjoint)

| Surface | Owner |
|---------|-------|
| `bin/gsd-t-research-gate.cjs`, classifier test, `test/fixtures/m89-labeled-corpus.json`, `test/fixtures/m89-heldout-corpus.json` | D1 |
| this contract, `templates/prompts/research-subagent.md`, cite-format test | D2 |
| doc-ripple (`templates/CLAUDE-global.md` Research Policy replacement, `bin/gsd-t.js` dispatch case, `commands/gsd-t-help.md`) | D2 |
| `templates/workflows/gsd-t-phase.workflow.js`, `gsd-t-verify.workflow.js` + wiring tests | D3 |
| `templates/workflows/gsd-t-{execute,debug,quick,wave}.workflow.js` + wiring tests | D4 |

D3 and D4 NEVER touch each other's workflow files (one-domain-per-workflow-file). D2 is the SINGLE
owner of every shared doc-ripple surface (CLAUDE-global.md, bin/gsd-t.js, commands/gsd-t-help.md) —
no co-author conflict possible.
