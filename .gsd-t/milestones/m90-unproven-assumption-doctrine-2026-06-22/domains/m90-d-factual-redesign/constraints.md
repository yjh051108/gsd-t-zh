# Domain Constraints: m90-d-factual-redesign

## The frozen-belief rule — premise-corrected 2026-06-22 (pre-mortem CRITICAL #1, verified on disk)
**NEVER hardcode a finite list for an OPEN category — for the INTERNAL decision.** The rule
applies to what is asserted as `internal`: mechanical/regex recognizes ONLY closed, knowable sets
(this repo's own files = internal). **On disk this is ALREADY true** (`bin/gsd-t-research-gate.cjs:211-262`):
`internal` requires a positive own-repo path/anchor; a bare out-of-list vendor routes `ambiguous→judge`
("never guess-internal"). The partition's premise — "the vendor list causes out-of-list vendors to
silently route internal" — is **FALSE**: the vendor list only *upgrades* a match to `external→web`;
its ABSENCE never routes internal (M89 already removed all wins-outright→internal overrides,
auto-research-contract v1.3.3). So this domain does NOT delete the vendor list on the false premise
(that would DOWNGRADE known vendors `external→web`⇒`ambiguous→judge`, a regression that turns held-out
rows HO-E1/E2/E5 RED). It KEEPS the vendor-upgrade heuristic and ASSERTS+TESTS that the internal
decision enumerates no open category. ([[feedback_coverage_check_structural_not_substring]]: structural, not substring.) ([[feedback_unproven_assumption_stop_and_research]]: the doctrine applied to M90 itself.)

## Edit-in-place, do not regress
M89's code is SOUND (preserved at `ed03a8d`, 1824/0). This is edit-in-place, NOT a rewrite:
- KEEP the house-style JSON envelope + bad-input guard (`{ok:false}` never silent-internal).
- KEEP the §7 fail-closed cite gate (R-FACT-4) exactly — an uncited external claim FAILS verify.
- KEEP deterministic behavior (identical claim → byte-identical envelope).
- KEEP the vendor-upgrade machinery (`EXTERNAL_VENDOR_NOUNS`/`EXTERNAL_API_TERMS`) unless D3-T0's
  baseline proves a concrete misroute defect. The Destructive Action Guard applies to ANY change to
  it: grep ALL requirers first; never leave a dangling ref ([[feedback_retire_scan_against_keep_list]]).
  Deleting it on the (falsified) silent-miss premise is forbidden — it is a regression, not a fix.

## Traced requirements
- **R-FACT-0** — Baseline-first known-answer test against CURRENT code grounds the premise (≥10 unseen vendors → none silently-internal); gates R-FACT-1.
- **R-FACT-1** (premise-corrected) — Resolve the vendor list's ACTUAL role: assert the INTERNAL decision enumerates no open category (`internal` only on concrete own-repo path/anchor — already true); change/tighten the vendor-upgrade heuristic ONLY if T0 proves a concrete defect, else KEEP with corrected rationale. NO delete-on-false-premise.
- **R-FACT-2** — not-confidently-internal → LLM judge → external/uncertain → research+cite.
- **R-FACT-3** — time-anchored override: fast-moving lib/API/version OR "current/latest best practice" → research regardless of confidence.
- **R-FACT-4** — KEEP §7 fail-closed cite gate (uncited external → verify FAILS).

## Corpus discipline
The corpus test must:
- Assert the INTERNAL decision enumerates no open category (`internal` requires a positive own-repo
  path/anchor — never a vendor's absence); ≥10 unseen vendors route judge/research, none silently-internal.
- Assert the closed INTERNAL set + time-anchored override classify the labeled corpus
  DETERMINISTICALLY. Since the vendor list is KEPT (premise-corrected), held-out rows HO-E1/E2/E5
  (Stripe/Chrome external→web) MUST still classify `external→web` after the change — a regression
  assertion, NOT a re-label-to-judge. Re-label a row ONLY if T0 proves its current routing is a defect.
- Held-out generalization guard stays: "passes seen, fails held-out" = FAILURE.

## Hard rules
- Zero new runtime deps; Node built-ins; sync APIs.
- Runtime-native: `bin/*.cjs` brain; MUST NOT be `require()`d into a `*.workflow.js`.
- Do NOT touch the contract or any workflow — those are D-CONTRACT integrate seams. Read the
  doctrine envelope shape from D-CONTRACT's contract; do not write it.

## File discipline
Touch ONLY scope.md § Files Owned. The classifier module is yours alone; the contract,
workflows, and `bin/gsd-t.js` are D-CONTRACT's.
