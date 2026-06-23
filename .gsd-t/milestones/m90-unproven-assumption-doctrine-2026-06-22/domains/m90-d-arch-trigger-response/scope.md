# Domain Scope: m90-d-arch-trigger-response

## Milestone
M90 — The Unproven-Assumption Doctrine

## Wave
**Wave 1** (parallel with m90-d-loop-ledger-halt). **HIGHEST RISK — prove-or-kill.**

## Mission
Build the §2 **architectural hook** — the new load-bearing capability with NO in-house
precedent (R1, the highest-risk slice). A NET-NEW standalone **deterministic trigger
module** that fires EVERYWHERE on every approach decision and on extending existing code,
and the RESPONSE wiring **contract/interface** (blind-adversary directive + executable
spike with forced fallback). The trigger is EXPERIMENTAL+MEASURED: it instruments its own
fire-rate + catch-quality to a measurement sink and NEVER claims it works.

This domain is **quarantined into its own greenfield bin module** so the unproven trigger
code never touches the proven factual slice (D-FACTUAL) or any shared workflow seam. The
actual `agent()` wiring into `*.workflow.js` / triad prompts is **deferred to D-CONTRACT
integrate** — this domain ships only the module, its protocol prompt, and its tests, plus
a stable resolver/CLI signature that D-CONTRACT consumes.

## Files Owned (this domain WRITES these — no other domain may)
- `bin/gsd-t-architectural-trigger.cjs` — NET-NEW deterministic trigger module
- `templates/prompts/blind-adversary-subagent.md` — NET-NEW blind-adversary protocol (separate context/model; extends M83 pre-mortem + Red-Team-on-fable)
- `test/m90-architectural-trigger.test.js` — the prove-or-kill killing test
- `test/fixtures/m90-arch-divergence-corpus.json` — divergent/convergent fresh-context answer fixtures
- `.gsd-t/domains/m90-d-arch-trigger-response/{scope,constraints,tasks}.md`

## NOT Owned (other domains / integrate seam)
- `bin/gsd-t-loop-ledger.cjs` — m90-d-loop-ledger-halt
- `bin/gsd-t-research-gate.cjs` — m90-d-factual-redesign
- ALL `templates/workflows/*.workflow.js` — m90-d-contract-doctrine-integrate (integrate seam)
- `bin/gsd-t.js` dispatch + PROJECT_BIN_TOOLS — m90-d-contract-doctrine-integrate
- `templates/prompts/{qa,red-team,pre-mortem}-subagent.md` — m90-d-contract-doctrine-integrate
- the doctrine contract — m90-d-contract-doctrine-integrate

## Deliverables
1. A deterministic trigger that, given N fresh-context answers to the same approach
   question (R-ARCH-1 consistency-divergence sampling) OR an extend-existing-code signal
   (R-ARCH-2 protocol-class), returns the house-style JSON envelope naming the basis being
   challenged.
2. The RESPONSE interface (contract-only, no agent() wiring): blind-adversary directive
   (R-ARCH-3), executable-spike PREFERRED with forced-fallback (R-ARCH-4 spike fails→stop;
   R-ARCH-5 infeasible→logged skip + adversary MANDATORY; R-ARCH-6 proven-by-adversary-only
   flagged at verify).
3. Fire-rate + catch-quality instrumentation to a measurement sink.
4. The prove-or-kill killing test (see constraints R1 exit).

## Stable interface exposed to D-CONTRACT
- A CLI subcommand signature + a `module.exports` resolver returning the trigger envelope
  and the response-mode flags (`spike` | `adversary-only`). D-CONTRACT wires these into the
  workflow agent()-Bash inline helpers at integrate time. This domain must NOT change that
  signature after Wave 1 closes.
