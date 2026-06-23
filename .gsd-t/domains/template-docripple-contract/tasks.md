# Tasks: template-docripple-contract (M87 D4 — Wave 2)

## Files Owned
- `templates/PseudoCode-spec.md`
- `commands/gsd-t-doc-ripple.md`
- `.gsd-t/contracts/pseudocode-source-of-truth-contract.md`
- `test/m87-docripple-presence-lint.test.js`

---

### M87-D4-T0 — Author the source-of-truth contract (partition-time, DONE)
**Touches**: `.gsd-t/contracts/pseudocode-source-of-truth-contract.md`
**PseudoCode-Section**: PseudoCode-PayPal#1-create-the-seller-creates-a-paypal-invoice-for-a-buyer-group-web-app-server
v1.0.0 STABLE — all grammars (guard-map §2, section-citation §3, divergence §4,
ripple-points §5). Consumed by D1/D2/D3. Written at partition so wave-2 domains
can build against a stable contract.
**Acceptance criteria**: contract on disk, STABLE, defines all four grammars.
**Files**: the contract. **Status**: COMPLETE at partition.
**Test**: M87-D4-T3 (`test/m87-docripple-presence-lint.test.js`) exercises the contract's §5 ripple-point set structurally; the consuming-domain harnesses (`test/m87-guard-map-bridge.test.js` §2 grammar, `test/m87-traceability-section-coverage.test.js` §3 grammar) prove the grammars this contract defines are correctly consumed. The contract is non-code; these are its downstream test surfaces.

### M87-D4-T1 — Ship templates/PseudoCode-spec.md
**Touches**: `templates/PseudoCode-spec.md`
**PseudoCode-Section**: PseudoCode-PayPal#1-create-the-seller-creates-a-paypal-invoice-for-a-buyer-group-web-app-server
The blank mold: intention / mechanism / one-breath / guard-map / divergence /
appendix + BOTH altitudes + all five section elements (§1), structurally
matching the binvoice exemplars per SC6. Replacement tokens (`{Title}`,
`{Author}`, `{date}`).
**Acceptance criteria**: SC6 — ships, matches exemplar structure, both altitudes.
**Files**: `templates/PseudoCode-spec.md`.
**Test**: M87-D4-T3 + a structure assertion.
**Headline**: true

### M87-D4-T2 — Add PseudoCode-[Title].md to doc-ripple command
**Touches**: `commands/gsd-t-doc-ripple.md`
**PseudoCode-Section**: PseudoCode-Extension#6-rules-vs-ai-the-decision-map
Add `PseudoCode-[Title].md` to the Living Documents ripple set in the doc-ripple
command (ripple point 3 of 4 — the only point this domain owns).
**Acceptance criteria**: SC5 — doc appears in the doc-ripple ripple set.
**Files**: `commands/gsd-t-doc-ripple.md`.
**Test**: M87-D4-T3.

### M87-D4-T3 — A4 ripple-presence drift lint
**Touches**: `test/m87-docripple-presence-lint.test.js`
**PseudoCode-Section**: PseudoCode-Extension#6-rules-vs-ai-the-decision-map
M71-family negative lint: assert `PseudoCode-[Title].md` appears in ALL FOUR
ripple reference points. **Region-scoped, NEVER file-wide substring** (per
`feedback_coverage_check_structural_not_substring`) — critical because TWO of
the four points (Living Documents table AND Pre-Commit Gate) live in the SAME
file `templates/CLAUDE-global.md`, so a file-wide substring would let one region
satisfy the other. For `templates/CLAUDE-global.md`, locate the Living Documents
**table region** AND the Pre-Commit Gate **region** SEPARATELY (by their
structural boundaries) and assert the `PseudoCode-[Title].md` token in EACH
region independently. The other two points: doc-ripple command
(`commands/gsd-t-doc-ripple.md`) and project `CLAUDE.md` Living Documents ref.
**Negative test: FOUR distinct cases** — delete the token from EACH of the four
regions independently (including the two same-file regions, checked separately)
and assert the lint FAILS in each case. Structural/path-as-path, never substring.
**Acceptance criteria**: A4 — lint passes when all four present; each of the four regions checked by its OWN structural region (the two same-file CLAUDE-global regions scoped separately); FAILS when the token is removed from any one region.
**Files**: `test/m87-docripple-presence-lint.test.js`.
**Test**: this IS the test (the A4 drift lint; the headline impl it guards is M87-D4-T1's `templates/PseudoCode-spec.md` + M87-D4-T2's doc-ripple ripple-set edit + the integrate-time seams 1/2/4).

---

**DEPENDENCY:** Wave 2 (build T1-T3 after D1's A1 passes). T0 (contract) done at partition.
**INTEGRATE-TIME:** ripple points 1/2/4 (`templates/CLAUDE-global.md` ×2, project
`CLAUDE.md`) written serially at integrate; the A4 lint then verifies all four.
