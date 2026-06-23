# Domain: guard-bridge-spike

**Milestone**: M87 — Intention-First PseudoCode as Source-of-Truth
**Wave**: 1 (LOAD-BEARING, PROVE-OR-KILL — runs ALONE before any wave-2 domain)
**Risk**: HIGHEST — this is the milestone's kill-criterion (A1)
**Risk isolation**: touches ONLY new files (plus the verify-workflow wiring it
owns). If A1 fails, the milestone HALTS having contaminated no existing brain.

## Thesis

Prove the single uncertain claim the whole milestone rests on: that a prose
`[RULE]` guard map in `PseudoCode-[Title].md` can be turned into a
machine-checkable verify gate where divergence is a deterministic, non-vacuous
FAILURE — zero LLM judgment in the pass/fail decision.

## Deliverables

- `bin/gsd-t-guard-map.cjs` — NEW deterministic module. Enumerates every
  `[RULE]` from a `PseudoCode-[Title].md` guard map (§2 of the source-of-truth
  contract), binds each to ≥1 test assertion via a build→rule map, and gates:
  exits non-zero at contract-breach severity when a rule is UNBACKED or
  CONTRADICTED, naming the violated `<RULE-ID>`. Zero deps, never throws, pure
  (mirrors the M83 traceability-gate engineering bar).
- The A1 falsifiable harness: faithful build of a binvoice exemplar → exit
  ZERO; doctored variant with exactly one rule violated → exit NON-ZERO with
  the violated rule named. Both deterministic.
- Wiring of the new check into `templates/workflows/gsd-t-verify.workflow.js`
  as a deterministic substrate step (M71 sandbox-clean: no require/fs/process;
  delegate the CLI call via the runCli inline-agent helper, like verify-gate).
- The binvoice exemplar fixtures (PayPal faithful + doctored, Extension
  faithful) + the build-map fixtures, copied read-only as the proof corpus.

## Files Owned

- `bin/gsd-t-guard-map.cjs`
- `test/m87-guard-map-bridge.test.js`
- `test/fixtures/m87/PseudoCode-PayPal.md`
- `test/fixtures/m87/PseudoCode-Extension.md`
- `test/fixtures/m87/PseudoCode-PayPal-doctored.md`
- `templates/workflows/gsd-t-verify.workflow.js`
- `.gsd-t/domains/guard-bridge-spike/{scope,constraints,tasks}.md`

## Acceptance Criteria

- **A1 (KILLS THE MILESTONE if it fails):** faithful exemplar → exit 0;
  doctored exemplar (one `[RULE]` violated) → exit non-zero, violated RULE-ID
  named; both deterministic, zero LLM judgment. If A1 cannot be built
  deterministically, HALT and escalate for re-scope — do NOT paper over.
- SC1: the verify-time gate fails a divergence at contract-breach severity.

## Boundaries (NOT owned)

- Does NOT edit `bin/gsd-t.js` CLI dispatch (integrate seam).
- Does NOT edit `commands/gsd-t-verify.md` (integrate seam).
- Does NOT edit `bin/gsd-t-traceability-gate.cjs` (D2 owns it).
- Does NOT edit the verify triad prompts (A5 integrate seam).
- Does NOT author the spec template or the contract (D4 owns; D1 consumes the
  `[RULE]` grammar from `pseudocode-source-of-truth-contract.md` §2).
