# Tasks: m89-d1-research-classifier-core

> **Wave 1 — PROVE-OR-KILL (load-bearing).** Concurrent with D2, fully file-disjoint.
> A1 (M89-D1-T3) is the milestone kill-gate: a single mislabel HALTS M89 for re-scope.
> Contract: `.gsd-t/contracts/auto-research-contract.md` v1.0.0 STABLE §1 (envelope), §6 (corpus).

## Files Owned
- `bin/gsd-t-research-gate.cjs`
- `test/m89-research-classifier-corpus.test.js`
- `test/fixtures/m89-labeled-corpus.json`
- `test/fixtures/m89-heldout-corpus.json` — the HELD-OUT generalization corpus (finding #1; NOT used to author/tune the classifier)

## Tasks

### M89-D1-T1 — Author the labeled corpus fixture
**Files**: `test/fixtures/m89-labeled-corpus.json` (NET-NEW)
**Dependencies**: none (Wave-1 entry task)
**Contract**: `auto-research-contract.md` §6 (the A1 killing oracle table)
**Description**: 13 items. Each item: `{ id, source, gap, expectedClass, expectedRoute }` where
`expectedClass ∈ {internal, external}` and `expectedRoute ∈ {grep, web}` (internal⇒grep, external⇒web).
- Items 1–7: the 7 M87 findings (own code / contracts / sandbox / test-architecture) → all `internal`/`grep`, ZERO external.
- Items 8–13: the 6 binvoice S2-M5 findings → exactly 2–3 `external`/`web`, MUST include:
  - PayPal OAuth `/v1/oauth2/token` mint/seed contract → `external`
  - PayPal v2 invoice **TOTAL** amount limit (each line fine, sum overflows) → `external`
  - remaining binvoice items: **each pinned to a single deterministic hand-label** (own-schema/own-route ⇒ internal; popup-blocker browser behavior ⇒ pin it explicitly to `external` — browser/runtime behavior is an external signal per §1 — do NOT leave it floating). The "2–3 external" is the aggregate the per-item labels must SUM to, NOT a license to leave any single item's label ambiguous. Every one of the 13 items has exactly ONE hand-label.
**Acceptance**: valid JSON, exactly 13 items, every item has all 5 keys and a single unambiguous `expectedClass`/`expectedRoute`; aggregate = 7 internal (items 1–7) + 2–3 external (items 8–13); the two named PayPal findings present and labeled `external`; NO item left with a "borderline/either" label.
**Test**: consumed by `test/m89-research-classifier-corpus.test.js` (T3), which asserts the fixture shape (count=13, key-completeness, aggregate bounds) — a malformed fixture FAILS T3.

#### Held-out generalization fixture (finding #1 + premise correction — paired with T1)
**Files**: `test/fixtures/m89-heldout-corpus.json` (NET-NEW — already authored at plan time, 8 items)
**Description**: 8 NOVEL guessed-claims NOT used to author/tune the classifier — the anti-self-fulfilling-oracle guard. 4 external (Stripe webhook signature header; Chrome `storage.local` quota limit; CSS `:has()` browser-support; **HO-E4 — the PROPER-NOUN-LESS external claim "the payments endpoint accepts a max batch size of 100" — routes external by its unverified-external-assertion feature, NO vendor name**) + 4 internal (`isOrderLocked` return; owner of `gsd-t-verify.workflow.js`; `cli-preflight` exit code; **HO-I4 — the SYMBOL-ONLY internal claim about `resolveProfile`, a bare local symbol with no path/anchor**). Each item carries `{ id, source, gap, expectedClass, expectedRoute, featureSignal }`; `featureSignal` NAMES the feature class that drives the label (proof it's a feature decision, not a keyword match). **None of these proper nouns/symbols appears anywhere in `m89-labeled-corpus.json`** — so a classifier that keyword-matched the seen 13 cannot pass these. HO-E4 + HO-I4 are the premise-correction guards: they prove the classifier decides by external-assertion-vs-local-symbol feature, not by surface keywords.
**Acceptance**: valid JSON; 8 items (4 external incl. proper-noun-less HO-E4, 4 internal incl. symbol-only HO-I4); zero token overlap with the seen-corpus keywords (`PayPal`/`OAuth`/`invoice`); every item single-labeled.
**Test**: consumed by T3's HELD-OUT assertion set; a classifier passing the seen 13 but failing any held-out item FAILS A1; specifically a classifier that defaulted the proper-noun-less HO-E4 to internal FAILS.

### M89-D1-T2 — Build the classifier module + CLI (MUST GENERALIZE — feature-class, not keyword-memorized)
**Files**: `bin/gsd-t-research-gate.cjs` (NET-NEW — the implementation path for A1/SC1)
**Dependencies**: M89-D1-T1 (corpus defines the labels the router must satisfy)
**Contract**: `auto-research-contract.md` §1 (envelope shape, incl. the FEATURE-CLASS heuristic) + constraints.md (deterministic, no LLM, zero-dep)
**Description**: Pure deterministic **feature-class** router (a calculator, mirroring `gsd-t-competition-judge.cjs` — NO LLM call, NO network, sync APIs, zero new runtime deps). It classifies by FEATURE CLASS, NOT by keywords scraped from the 13 authoring gaps. Emits the house-style envelope
`{ ok:true, gap, class:"internal"|"external", route:"grep"|"web", reason }` on success; `{ ok:false, error }` on bad input. The `gap` field is ALWAYS echoed (auditable, never silent).
- **INPUT IS A GUESSED CLAIM (premise correction — contract §1):** the classifier's input is a CLAIM the agent tagged GUESSED (§6.5 DETECT step), NOT "a gap." The `gap` envelope field name is retained for shape stability but carries the guessed-claim text.
- **GENERALIZATION REQUIREMENT (finding #1 — the anti-self-fulfilling-oracle guard):** the classifier MUST decide by **feature class**, not by hard-matching corpus strings. A router that hard-matches the literal tokens `PayPal`/`OAuth`/`invoice` scraped from the 13 gap strings would pass the seen corpus 13/13 yet generalize to NOTHING — the shallow-test trap. The discriminator is: **does the claim assert the behavior of a system OUTSIDE this repo** (→ external) **vs. THIS repo's own code/symbols** (→ internal). External signals: a recognized third-party / library / platform / spec **proper noun**; an API / endpoint / HTTP / OAuth / webhook / spec / version / limit / rate-limit / error-shape / auth-flow **term**; a browser / runtime behavior. Internal signals: a repo-relative **path**, a known **local symbol/file** (even a BARE symbol with no path/anchor), an explicit "this repo / our / the existing" **anchor**. Implement as feature/signal-class detection (contract §1), NOT a per-corpus allowlist.
- **PROPER-NOUN-LESS EXTERNAL (premise correction — dissolves cycle-2 finding #3):** a claim that ASSERTS an external system's behavior / return-shape / limit / value WITHOUT a cited source routes EXTERNAL **even with NO proper noun** (e.g. "the payments endpoint accepts a max batch size of 100"; "the create call returns a `url`"). It is an unverified external assertion → external guess; do NOT default it internal for lacking a vendor name. The held-out item HO-E4 pins this.
- **External signals** (→ `external`/`web`): third-party API contract / endpoint / rate-limit / error-shape / auth flow; library / framework / version behavior; platform / browser / runtime behavior; published standard / spec; current-best-practice / latest-version facts.
- **Internal signals** (→ `internal`/`grep`, NEVER `web`): this repo's own code / contracts / schema / file-ownership / sandbox rules / test architecture (repo-relative path, known local symbol/file, "this repo/our/the existing" anchor).
- **Ambiguous → internal-first**: default `class:internal, route:grep`. (Escalation to external on empty grep is the WIRING domains' job, NOT this module's.)
- `internal`+`web` is structurally impossible (route derived from class).
- **Bad-input boundary (finding #6 — SC1):** `classify('')` and `classify('   ')` (whitespace-only) → `{ok:false, error}` + non-zero CLI exit; `classify(non-string)` → `{ok:false, error}`, NO throw. These MUST NOT silently return `class:internal` (a blank/garbage gap is not a "default-internal" gap — it is invalid input).
- CLI: `gsd-t-research-gate classify "<gap>" --json` prints the envelope; bad/empty input → `{ok:false,error}` + non-zero exit.
**Acceptance**: identical gap text → byte-identical envelope (deterministic); never throws on string input; emits exactly the §1 envelope keys; classifies by feature class (passes the held-out corpus, not only the seen 13 — see T3); empty/whitespace/non-string → `{ok:false,error}` + non-zero exit, never silent `class:internal`.
**Test**: `node --check bin/gsd-t-research-gate.cjs` (syntax) + the A1 corpus test T3 exercises every branch via the 13 SEEN labels AND the ≥6 HELD-OUT labels (a mis-routed branch fails a label → no dead branches; a keyword-memorized classifier fails the held-out set).

### M89-D1-T3 — A1 killing test (HEADLINE — SEEN corpus + HELD-OUT generalization + bad-input boundary)
**Headline:** true
**Files**: `bin/gsd-t-research-gate.cjs` (the headline implementation path — deterministic feature-class classifier) + `test/m89-research-classifier-corpus.test.js` (NET-NEW — the test exercising that capability end-to-end against the real 13-item labeled corpus AND the held-out generalization corpus).
**Implements**: `bin/gsd-t-research-gate.cjs` (T2) — the milestone's headline capability; this test is its end-to-end oracle.
**Dependencies**: M89-D1-T1 (seen fixture + held-out fixture), M89-D1-T2 (classifier)
**Contract**: `auto-research-contract.md` §1 (feature-class heuristic) + §6 (corpus) + SC1/A1 (progress.md)
**Description**: Three assertion sets, all functional (no shallow `length>0`):
- **SEEN (the labeled 13):** Load `test/fixtures/m89-labeled-corpus.json`, run each gap through the classifier, assert EVERY item's `class` AND `route` match its hand-label — item-by-item, not just the aggregate. Then assert the aggregate invariants: items 1–7 all `internal` (0 external); items 8–13 exactly 2–3 `external` including the two named PayPal findings. Run a sample gap twice; assert byte-identical envelopes (determinism).
- **HELD-OUT (finding #1 + premise correction — the generalization / anti-self-fulfilling-oracle assertion):** Load `test/fixtures/m89-heldout-corpus.json` (8 NOVEL guessed-claims NOT used to author the classifier: 4 external incl. **HO-E4 the PROPER-NOUN-LESS external claim** + 4 internal incl. **HO-I4 the SYMBOL-ONLY internal claim**). Assert the classifier labels EACH held-out item correctly by feature class. **Assert specifically that HO-E4 (proper-noun-less external assertion) → `external` and HO-I4 (bare local symbol) → `internal`** — these two are the premise-correction discriminators. **"Passes the seen 13 but FAILS any held-out item" is an EXPLICIT FAILURE** — it proves keyword memorization, not generalization. A classifier that defaulted HO-E4 to internal for lacking a vendor proper noun FAILS (the cycle-2 silent-miss).
- **BAD-INPUT BOUNDARY (finding #6 — SC1):** assert `classify('')` and `classify('   ')` → `{ok:false, error}` (NOT `class:internal`); `classify(<non-string>)` → `{ok:false, error}`, no throw; the CLI exits non-zero on these. Assert NONE of these silently returns `class:internal`.
**Acceptance**: ALL 13 SEEN labels match deterministically; ALL ≥6 HELD-OUT labels match by feature class (a keyword-memorized classifier fails here); empty/whitespace/non-string → `{ok:false,error}` + non-zero exit, never silent `class:internal`. A single mislabel (seen or held-out) FAILS. NO shallow `length>0` / existence assertions — each assertion compares against a specific hand-label.
**Test**: this file IS the A1 test. Runner: `npm test` (node built-in test runner). It is the milestone's headline-capability oracle.

### M89-D1-T4 — Prove-or-kill checkpoint (KILL GATE)
**Files**: verification only (no new file)
**Dependencies**: M89-D1-T3
**Description**: `node --check bin/gsd-t-research-gate.cjs`; run T3 in isolation. **GREEN → signal D3/D4 (Wave 2) unblocked.** **RED and not fixable deterministically → HALT M89 + escalate for re-scope. Do NOT soften the corpus or the classifier to force a pass** (constraints.md prove-or-kill gate + [[feedback_coverage_check_structural_not_substring]]).
**Acceptance**: A1 (T3) GREEN, OR the milestone explicitly HALTED with a re-scope escalation recorded in progress.md.
**Test**: re-run of T3 (the gate decision IS the test result).
