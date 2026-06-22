# Domain Scope: m90-d-factual-redesign

## Milestone
M90 — The Unproven-Assumption Doctrine

## Wave
**Wave 2** (after Wave 1 prove-or-kill clears). **LOWEST RISK — edit-in-place.**

## Mission
Redesign the §1 **factual hook** inside the EXISTING `bin/gsd-t-research-gate.cjs`. M89's
code is sound (preserved at `ed03a8d`, 1824/0 tests).

> **PREMISE CORRECTED (pre-mortem CRITICAL #1, verified on disk 2026-06-22).** The partition
> asserted: "a hardcoded finite vendor list… any out-of-list vendor (GitHub/Slack/OpenAI)
> silently routes non-external → the silent miss." **This is FALSE on disk.** In the current
> classifier (`bin/gsd-t-research-gate.cjs:211-262`) an out-of-list vendor with no internal
> path/anchor falls through to the FINAL branch → `class:"ambiguous", route:"judge"` (commented
> "never guess-internal"). The vendor list ONLY *upgrades* a match to high-confidence
> `external→web` (skipping the judge); its ABSENCE never routes internal. M89 already
> "removed ALL wins-outright→internal overrides" (`auto-research-contract.md` v1.3.3,
> 2026-06-20) — the silent-miss class is ALREADY structurally closed. Empirically confirmed:
> 10 never-seen vendors (GitHub/Slack/OpenAI/Plaid/Twilio/a freshly-invented "Fizzbuzzeroo") ALL
> route `ambiguous→judge`; NONE classify internal.
>
> **This domain therefore obeys M90's own doctrine: it does NOT delete machinery on the false
> premise.** D3's ACTUAL delta is (a) a **baseline known-answer test** that grounds the premise
> against current code FIRST; (b) the **time-anchored protocol override (R-FACT-3)** — genuinely
> NEW, not in current code; (c) a baseline-GATED decision on the vendor list's *real* role
> (upgrade-to-web vs. ambiguous→judge) — kept or tightened only if the baseline proves a concrete
> defect, never deleted on the (falsified) silent-miss premise; (d) KEEP the §7 cite gate
> (R-FACT-4). SC-NO-FINITE-LIST is reframed: the layer must enumerate no OPEN category for the
> *internal* decision — already true; the test proves it on ≥10 unseen vendors.

This domain is the safe edit-in-place island, quarantined to the M89-owned classifier
module + its corpus test/fixture. It does **NOT** touch the contract (D-CONTRACT) or any
workflow wiring (D-CONTRACT integrate seam).

## Files Owned (this domain WRITES these — no other domain may)
- `bin/gsd-t-research-gate.cjs` — the classifier module (the ONLY domain editing it)
- `test/m89-research-classifier-corpus.test.js` — corpus test, edited in place
- `test/fixtures/m89-labeled-corpus.json` — labeled corpus fixture, edited in place
- `.gsd-t/domains/m90-d-factual-redesign/{scope,constraints,tasks}.md`

## NOT Owned (other domains / integrate seam)
- `.gsd-t/contracts/auto-research-contract.md` + the new doctrine contract — m90-d-contract-doctrine-integrate
- ALL `templates/workflows/*.workflow.js` — m90-d-contract-doctrine-integrate
- `bin/gsd-t.js` dispatch — m90-d-contract-doctrine-integrate (research-gate dispatch already registered; any change is D-CONTRACT's)
- The two Wave-1 bin modules + their tests

## Deliverables (the R-FACT redesign — premise-corrected)
0. **R-FACT-0 (baseline-first, the doctrine in action)** — BEFORE any edit, a baseline
   known-answer test against the CURRENT classifier capturing actual routing for ≥10 unseen
   vendors. Grounds the premise on disk; gates whether R-FACT-1 is justified at all.
1. **R-FACT-1 (premise-corrected)** — Resolve the vendor list's ACTUAL role against the R-FACT-0
   baseline. The list does NOT cause a silent-miss (the absence never routes internal — verified);
   it only *upgrades* a match to high-confidence `external→web`. So: assert the layer enumerates
   no OPEN category for the *internal* decision (already true — `internal` needs a positive
   own-repo path/anchor). Delete or tighten the vendor list ONLY if the baseline proves a concrete
   defect (e.g. a real unseen vendor that today misroutes) — NEVER on the falsified silent-miss
   premise. If the baseline shows no defect, the "delete" reduces to a documented no-op/tightening
   with the corrected rationale recorded.
2. **R-FACT-2** — everything not-confidently-internal is handed to the LLM judge →
   external/uncertain → research+cite. The mechanical layer recognizes only the closed
   internal set; the open external world is the judge's call.
3. **R-FACT-3** — add the time-anchored protocol override: a fast-moving lib/API/version OR
   "current/latest best practice" → research regardless of confidence (CoVe-style
   always-verify).
4. **R-FACT-4** — KEEP the §7 fail-closed cite gate: an external claim left uncited → verify
   FAILS.
5. Update the M89 corpus test to assert NO external-enumeration path remains AND that the
   closed INTERNAL set + time-anchored override classify the 13-item labeled corpus
   deterministically. Add a vendor-deletion negative test (out-of-list vendor like
   GitHub/Slack/OpenAI no longer string-matches → goes to judge, never silent-internal).

## Sequencing
Gated AFTER Wave 1 (risk-first build order). File-disjoint from all other domains — its
only shared dependency is the doctrine envelope shape pinned by D-CONTRACT's contract,
which D-FACTUAL CONSUMES (reads) but does not write.
