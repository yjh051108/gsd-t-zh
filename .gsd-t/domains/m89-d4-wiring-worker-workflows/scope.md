# Domain: m89-d4-wiring-worker-workflows

## Wave
WAVE 2 — gated on D1's A1 test passing. Concurrent with D3 (disjoint workflow files). EXCLUSIVE owner of the
execute/debug/quick/wave workflow files — D3 never touches these.

## Mission
Hook the same Stated-Claims→classify→research trigger (premise-corrected) into the worker workflows at their
research-eligible steps:
- **execute** — a domain worker hits an unfamiliar API/library mid-build (a GUESSED external claim).
- **debug** — failure root is external behavior; research instead of patch-guess (pairs with #33 circuit-breaker).
- **quick** — fast task hits an unfamiliar external surface.
- **wave** — NOTHING (pure execute+verify composer, M85 zero-`model:`; research reaches it via the sub-workflows).

Each insert (execute/debug/quick) embeds the Stated-Claims snippet (§6.5, LLM-prompted DETECT) so the agent tags
load-bearing claims KNOWN|GUESSED; the wiring iterates each GUESSED claim through the classifier (D1 envelope);
`external` → WRITE the §7 marker (`status=uncited`) → research `agent()` stage citing a Verified-Facts block
(URL + date) → FLIP the marker to `status=cited`; `internal` → grep/Read, asserting the research stage is NEVER
entered on an internal claim (A3 routing decision + sole-web-stage enforcement). Wave gets nothing.

## Files Owned
- `templates/workflows/gsd-t-execute.workflow.js`
- `templates/workflows/gsd-t-debug.workflow.js`
- `templates/workflows/gsd-t-quick.workflow.js`
- `templates/workflows/gsd-t-wave.workflow.js`
- `test/m89-worker-research-wiring.test.js`
- `test/m89-internal-gap-no-websearch.test.js`
- `.gsd-t/domains/m89-d4-wiring-worker-workflows/{scope,constraints,tasks}.md`

## Interface
CONSUMES the D1 classifier envelope + the D2 contract's research stage interface + Verified-Facts cite format +
A3 internal-gap semantics. Wires them inline; does NOT redefine them.

## NOT Owned
- `templates/workflows/gsd-t-{phase,verify}.workflow.js` — D3 (one-domain-per-workflow-file).
- `bin/gsd-t-research-gate.cjs`, the contract, `CLAUDE-global.md`, `bin/gsd-t.js` — D1/D2.
