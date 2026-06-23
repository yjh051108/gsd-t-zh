# Domain: m89-d3-wiring-upper-phase-and-gate

## Wave
WAVE 2 — gated on D1's A1 test passing. Concurrent with D4 (disjoint workflow files). EXCLUSIVE owner of the
phase + verify workflow files — D4 never touches these.

## Mission
Hook the auto-research trigger into `templates/workflows/gsd-t-phase.workflow.js` at every upper
research-eligible stage (plan, pre-mortem, partition, discuss, milestone, impact — all run through phase).
Each insert embeds the Stated-Claims snippet (§6.5, LLM-prompted DETECT) so the agent tags load-bearing claims
KNOWN|GUESSED; the wiring iterates each GUESSED claim through the classifier (D1 envelope); on `external` it
WRITES the §7 ENFORCE marker (`status=uncited`), runs the research `agent()` stage that writes a cited
Verified-Facts block (URL + date) into the artifact BEFORE the gate re-runs, and FLIPS the marker to
`status=cited` (idempotent — no re-research when the matching claim-key marker is already cited). Also owns the
§7 ENFORCE gate in `gsd-t-verify.workflow.js`: an artifact with a `status=uncited` external-claim marker FAILS
(A4 — no silent guess; the marker is what catches a never-cited external guess). Plus the dogfood e2e test.

## Files Owned
- `templates/workflows/gsd-t-phase.workflow.js` (Stated-Claims→classify→research + §7 marker write/flip)
- `templates/workflows/gsd-t-verify.workflow.js` (the §7 ENFORCE-marker gate)
- `test/m89-phase-research-wiring.test.js`
- `test/m89-e2e-research-cite.test.js` (the dogfood e2e — A5)
- `.gsd-t/domains/m89-d3-wiring-upper-phase-and-gate/{scope,constraints,tasks}.md`

## Interface
CONSUMES the D1 classifier envelope (via the runCli inline helper) + the D2 contract's research-stage interface
+ Stated-Claims snippet (§6.5) + Verified-Facts cite format (§3, URL + date) + §7 marker format + A4 gate
semantics. Wires them inline; does NOT redefine them. OWNS the marker WRITE/flip + the verify gate on it.

## NOT Owned
- `templates/workflows/gsd-t-{execute,debug,quick,wave}.workflow.js` — D4 (one-domain-per-workflow-file).
- `bin/gsd-t-research-gate.cjs`, the contract, `CLAUDE-global.md`, `bin/gsd-t.js` — D1/D2.
