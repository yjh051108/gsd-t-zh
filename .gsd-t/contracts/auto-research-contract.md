# Contract: Auto-Research Gate + Web-Research Stage (M89)

## Version: 1.2.0
## Status: STABLE
## Owner: m89-d2-research-stage-and-contract
## Consumers: m89-d1-research-classifier-core, m89-d3-wiring-upper-phase-and-gate, m89-d4-wiring-worker-workflows
## Created: 2026-06-18 (M89 partition)

## Changelog
- **v1.2.0 (2026-06-18 — M89 PREMISE CORRECTION after plan pre-mortem cycle-2 / 2 CRITICALs):** the
  original framing ("a deterministic trigger that DETECTS a gap and REPLACES the LLM should-I-research
  discretion") overclaimed — **detecting that you need info is itself an LLM judgment**. Re-scoped: M89
  is **deterministic CLASSIFY + cite-or-fail ENFORCE wrapped around an LLM-PROMPTED DETECT step**.
  Determinism lives in CLASSIFY (§1) + ENFORCE (§5/§7), NOT in DETECT (§6.5).
  - **§1 (input is a GUESSED CLAIM, not "a gap"):** the classifier's input is a claim the agent tagged
    GUESSED. **Added: a proper-noun-LESS claim that ASSERTS an external system's behavior / return-shape /
    limit WITHOUT a cited source routes EXTERNAL** (it's an unverified external assertion) — dissolves
    cycle-2 finding #3 (the silent-miss where a vendor-name-less external guess defaulted internal).
  - **NEW §1.3 — the three guess-types (unknown / assumed / stale):** ANY of the three triggers
    research/verification; staleness DEFAULTS to fail-toward-verify for an external/time-varying fact
    lacking a fresh cited source (do NOT trust the agent's self-staleness-assessment).
  - **NEW §6.5 — the DETECT seam (Stated Claims, LLM-prompted):** each eligible stage prompt REQUIRES a
    structured **Stated Claims** list tagging load-bearing claims KNOWN | GUESSED(type); the wiring
    iterates it through the classifier. Honest best-effort — an untagged claim is an acknowledged miss,
    NOT a silent pass for a tagged one.
  - **NEW §7 — the ENFORCE marker:** at classify time an external guessed claim writes a machine-readable
    marker into the artifact (`<!-- auto-research-claim: class=external key=<claim-key> status=uncited -->`)
    so the verify gate FAILs on an uncited external claim even if nothing else was written; flips to
    `status=cited` when the Verified-Facts block lands. Defines the marker format + normalized-claim-key
    (reused as the §4.1 idempotency exact-match key).
  - **§3:** Verified-Facts fact lines now carry a fetch **DATE** (already in the block grammar) —
    promoted to load-bearing for staleness (§1.3).
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

M89 makes "verify the GUESS instead of asserting it" a **deterministic-where-it-can-be, auditable**
discipline replacing the advisory `Research Policy` prose in `CLAUDE-global.md`. The unit of work is
**a load-bearing CLAIM**, not "a gap": for each claim the agent tags KNOWN vs GUESSED (§6.5, the
LLM-prompted DETECT step); a GUESSED claim is CLASSIFIED internal-vs-external (§1, deterministic);
external → a web-research stage writes a **cited Verified-Facts block** (§3) into the artifact and a
classify-time **marker** (§7) records the claim; the verify gate FAILs if a load-bearing external
claim stays uncited (§5/§7 — ENFORCE). No silent guessing.

**Honest scope (the cycle-2 premise correction):** detecting that you need info is itself a judgment,
so DETECT (§6.5) is an LLM-prompted obligation (best-effort, like keep-or-supersede), NOT a deterministic
trigger. **Determinism lives in CLASSIFY (§1) and ENFORCE (§5/§7)** — the two steps that can be code.
A guess is a claim ON THE PAGE, so it is inspectable; an absent (un-stated) gap is an acknowledged
best-effort miss, not a silent pass.

This contract is the **partition-time seam**: it pins (1) the classifier JSON-envelope shape, (2) the
research agent() stage interface, (3) the Verified-Facts cited-block format, (4) the idempotency rule,
(5) the no-silent-guess gate semantics, (6.5) the DETECT Stated-Claims prompt seam, and (7) the
ENFORCE marker. D1 PRODUCES the classifier matching the envelope below; D3/D4 CONSUME the envelope
SHAPE + stage interface + marker format, never D1's internals.

---

## 1. Classifier JSON Envelope (the seam D1 produces, D3/D4 consume)

`bin/gsd-t-research-gate.cjs` emits the house-style JSON envelope. **Input is a GUESSED CLAIM** (free
text — a claim the agent tagged GUESSED in its Stated-Claims list, §6.5), NOT "a gap." It returns:

```json
{
  "ok": true,
  "gap": "<the guessed claim text, NAMED — auditable, never silent>",
  "class": "internal" | "external",
  "route": "grep" | "web",
  "reason": "<one-line deterministic rationale>"
}
```

The `gap` field name is retained for envelope-shape stability (D1/D3/D4 already build against it); it now
carries the GUESSED-CLAIM text. (A rename would be a breaking shape change for no behavioral gain.)

### 1.1 Classification is by FEATURE CLASS, not by corpus keywords (finding #1 — anti-self-fulfilling-oracle)

The classifier MUST decide by **feature class** — detecting external-vs-internal SIGNALS in the gap —
NOT by hard-matching keywords scraped from the labeled-corpus gap strings. A router that hard-matches
the literal tokens `PayPal` / `OAuth` / `invoice` lifted from the 13 authoring gaps would pass the seen
corpus 13/13 yet generalize to nothing — the shallow-test trap. The discrimination heuristic is
deterministic and feature-based:

- **External-signal set** (any present ⇒ lean external): a recognized **third-party / library /
  platform / spec proper noun** (e.g. a vendor or product name, an SDK, a browser, a standard body);
  an **API / endpoint / HTTP / OAuth / webhook / spec / version / limit / rate-limit / error-shape /
  auth-flow term**; a **browser / runtime behavior** reference; **OR — the cycle-2 finding-#3 fix — a
  claim that ASSERTS an external system's behavior / return-shape / limit / value WITHOUT a cited
  source, even with NO proper noun.** A proper-noun-LESS claim like *"the payments endpoint accepts a
  max batch size of 100"* or *"the create call returns a `url`"* routes EXTERNAL: it asserts the
  behavior of a system OUTSIDE this repo and is unverified, so it is an external guess — NOT a default
  to internal. (The silent-miss the old "needs a proper noun" rule allowed.)
- **Internal-signal set** (any present, and no overriding external signal ⇒ lean internal): a
  **repo-relative path**, a **known local symbol / file name** (even a BARE symbol with no path or
  anchor), an explicit **"this repo / our / the existing"** anchor; this repo's own code / contracts /
  schema / file-ownership / sandbox rules / test architecture.
- **Discriminator when neither surface-keyword dominates:** does the claim assert the behavior of a
  system OUTSIDE this repo (→ external) or of THIS repo's own code/symbols (→ internal)? This is the
  feature that generalizes — surface proper nouns are a signal, not the test.
- The heuristic is deterministic enough to gate without an LLM: it is signal-class detection over the
  claim text, NOT a per-corpus allowlist. A1's HELD-OUT corpus (≥6 NOVEL claims, D1-owned at
  `test/fixtures/m89-heldout-corpus.json`, INCLUDING the proper-noun-LESS external claim HO-E4 and the
  symbol-only internal claim HO-I4) proves generalization — a classifier passing the seen 13 but
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

The classifier is **deterministic**: identical claim text → identical envelope. No LLM call inside the
classifier itself (it is a calculator, not a critic — mirrors the competition-judge convention).

### 1.3 The three GUESS-TYPES (premise correction — any of the three triggers verification)

A claim is GUESSED (not KNOWN) when it falls into ANY of three types. The DETECT step (§6.5) tags the
type; CLASSIFY (§1) + ENFORCE (§7) then handle an EXTERNAL guess. All three are equally load-bearing —
"plausible" and "was true" are NOT "known":

1. **Unknown** — the agent lacks the fact outright.
2. **Assumed** — the agent ASSERTS a shape / value / behavior it never verified (e.g. *"the create call
   returns a `url`"* because it would make sense). **Plausible ≠ confirmed.** This is the binvoice
   S2-M5 failure mode (confident guesses stated as known).
3. **Stale** — the agent KNEW it, but it is an external/time-varying fact with age (an API last seen
   months ago, a price, a model ID, a library signature). **Was-true ≠ is-true. DEFAULT = FAIL TOWARD
   VERIFY:** any external/time-varying load-bearing fact WITHOUT a FRESH cited source (§3 carries a
   fetch DATE) is treated as stale → research. Do NOT trust the agent's self-assessment of its own
   staleness — that self-assessment is itself another guess.

The classifier does not distinguish the three types in its envelope (it classifies internal-vs-external
on the claim text); the type is the DETECT-step tag that decided the claim was GUESSED at all. Staleness
is the one type the wiring can apply deterministically: an external claim whose backing source is absent
or older than the freshness bar is treated as a guess regardless of the agent's confidence.

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

- Every fact line MUST carry a `source: <url>` **AND a `(fetched YYYY-MM-DD)` date**. An **uncited fact
  FAILS** the gate (SC2/SC3); a fact with no fetch date FAILS too — the date is load-bearing for the
  staleness guess-type (§1.3): a fact's freshness can only be judged if its fetch date is recorded.
- The block heading is exactly `## Verified Facts (auto-research)` (machine-detectable by the gate).
- The research subagent prompt (`templates/prompts/research-subagent.md`) MUST instruct the stage to
  emit BOTH the source URL and the fetch date on every fact line.

---

## 4. Idempotency Rule (already-cited fact ⇒ no re-research — A2)

Before triggering research for an external gap, the wiring domain scans the phase artifact for an
existing Verified-Facts entry **covering** that gap. If a cited fact already covers it, the research
stage is SKIPPED (no re-research). Re-running a phase whose artifact already has the cited block
performs ZERO additional WebSearch calls.

### 4.1 "covers" is exact normalized-gap-key match — NOT fuzzy / substring / keyword overlap (finding #2)

"Covers" is defined precisely to avoid a fuzzy match wrongly skipping a DISTINCT gap. A Verified-Facts
entry **covers** a gap iff its recorded **gap-key equals** the gap-key of the new gap, where:

- **gap-key** (= the **normalized-claim-key** of §7 — one key, two uses) = a deterministic normalization
  of the claim statement: lowercase, collapse internal whitespace, strip surrounding punctuation/quotes.
  (NOT a substring test, NOT a token-overlap / keyword score, NOT a fuzzy/edit-distance match.) Identical
  normalized statements ⇒ same key ⇒ covered. The §7 marker `key=` and a Verified-Facts entry's recorded
  key are the SAME normalization, so the idempotency scan is an exact key lookup across both.
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
- **A4 — external guess proceeds uncited → verify FAILS.** A phase artifact carrying an
  `auto-research-claim: ... status=uncited` marker (§7) — an external guessed claim that proceeded
  without a matching Verified-Facts cited block — FAILS the `gsd-t-verify` gate. An artifact where every
  external-claim marker is `status=cited` (with a matching cited fact, same claim-key) PASSES. Wired by
  D3 into `gsd-t-verify.workflow.js`. **The marker (§7) is what makes A4 enforceable on a claim that was
  never written as a Verified-Facts entry** — without it, an unstated/uncited guess would slip (the
  cycle-2 finding: "A4 can't catch a never-stated gap").

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
The held-out set now has **8 items (4 external, 4 internal)** and MUST include the proper-noun-LESS
external claim (HO-E4) and the symbol-only internal claim (HO-I4) — the premise-correction generalization
guards.

---

## 6.5 The DETECT seam — Stated Claims (LLM-prompted, the honest best-effort step — SC2/A2)

DETECT is NOT deterministic (detecting you need info is a judgment). It is an LLM-prompted obligation,
mirroring the keep-or-supersede protocol: **each eligible stage's prompt REQUIRES the agent to emit a
structured `## Stated Claims` list** tagging every load-bearing claim it is relying on:

```markdown
## Stated Claims

- [KNOWN] <claim the agent has verified / is repo-internal-evident>
- [GUESSED:assumed] <claim asserting an unverified external shape/value>
- [GUESSED:unknown] <claim the agent lacks the fact for>
- [GUESSED:stale] <external/time-varying fact known-but-aged, no fresh source>
```

- The wiring (D3/D4) iterates the `[GUESSED:*]` entries through the classifier (§1); each external
  guess → research+cite (§3) + a marker (§7); each internal guess → grep/Read.
- **Honest best-effort, not magic:** a claim the agent FAILED to tag is an acknowledged miss (a limit
  of an LLM-prompted detector), NOT a silent pass for a claim it DID tag. The deterministic guarantees
  (CLASSIFY + ENFORCE) apply to every TAGGED guessed claim; DETECT coverage is the prompt's job.
- The reusable Stated-Claims prompt snippet is a D2 deliverable (D2-T2-adjacent), embedded by each
  eligible stage (Read at spawn time alongside the research-subagent protocol). D3 wires it into the
  upper phases (plan / pre-mortem / partition / discuss / milestone); D4 into the worker phases
  (execute / debug / quick).
- **Staleness (§1.3 type 3) is the deterministic slice of DETECT:** even un-tagged, an external claim
  whose backing source is absent or older than the freshness bar is treated GUESSED:stale by the wiring
  (fail-toward-verify) — the one place code, not the prompt, can force a guess.

---

## 7. The ENFORCE marker — machine-readable external-claim record (SC4/A5)

So the verify gate has something to check even if the agent wrote nothing else, the wiring writes a
machine-readable marker into the artifact AT CLASSIFY TIME for each external guessed claim:

```html
<!-- auto-research-claim: class=external key=<normalized-claim-key> status=uncited -->
```

- **`<normalized-claim-key>`** = the deterministic normalization of the claim statement (lowercase,
  collapse internal whitespace, strip surrounding punctuation/quotes) — the SAME key used by §4.1
  idempotency exact-match. So a marker and a later Verified-Facts entry for the same claim share one key.
- **Lifecycle:** the marker is written `status=uncited` when an external guess is classified. When the
  research stage writes the matching `## Verified Facts (auto-research)` entry (same claim-key), the
  wiring FLIPS the marker to `status=cited`.
- **The ENFORCE gate (§5 A4, D3 in `gsd-t-verify.workflow.js`):** an artifact containing ANY
  `auto-research-claim: ... status=uncited` marker FAILs the verify gate (an external guess proceeded
  uncited — no silent guess). All external-claim markers `status=cited` (with a matching cited fact)
  PASSES. This is what makes A4/A5 enforceable: a guess that proceeds uncited is caught by the marker
  even if the agent wrote nothing further into the artifact.
- The marker is HTML-comment (invisible in rendered markdown, machine-grep-able by the gate).
- Idempotency (§4.1): re-running a phase whose marker is already `status=cited` (matching claim-key)
  performs ZERO additional research.

---

## File Ownership (disjoint)

| Surface | Owner |
|---------|-------|
| `bin/gsd-t-research-gate.cjs`, classifier test, `test/fixtures/m89-labeled-corpus.json`, `test/fixtures/m89-heldout-corpus.json` (8 items, incl. HO-E4 proper-noun-less external + HO-I4 symbol-only internal) | D1 |
| this contract, `templates/prompts/research-subagent.md` (facts carry URL + DATE), the reusable **Stated-Claims** prompt snippet (§6.5), cite-format test | D2 |
| doc-ripple (`templates/CLAUDE-global.md` Research Policy replacement + the SC6 conversation directive, `bin/gsd-t.js` dispatch case, `commands/gsd-t-help.md`, `docs/requirements.md` M89 entry) | D2 |
| `templates/workflows/gsd-t-phase.workflow.js` (Stated-Claims→classify wiring), `gsd-t-verify.workflow.js` (the §7 ENFORCE marker gate) + the **classify-time marker WRITE/flip** + the dogfood e2e test + wiring tests | D3 |
| `templates/workflows/gsd-t-{execute,debug,quick}.workflow.js` (Stated-Claims→classify wiring + marker write); `gsd-t-wave.workflow.js` gets NOTHING (composer, zero `model:`) + wiring tests | D4 |

D3 and D4 NEVER touch each other's workflow files (one-domain-per-workflow-file). D2 is the SINGLE
owner of every shared doc-ripple surface (CLAUDE-global.md, bin/gsd-t.js, commands/gsd-t-help.md) —
no co-author conflict possible.
