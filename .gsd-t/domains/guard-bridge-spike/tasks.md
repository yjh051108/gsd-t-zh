# Tasks: guard-bridge-spike (M87 D1 — Wave 1 kill gate)

## Files Owned
- `bin/gsd-t-guard-map.cjs`
- `test/m87-guard-map-bridge.test.js`
- `test/fixtures/m87/PseudoCode-PayPal.md`
- `test/fixtures/m87/PseudoCode-Extension.md`
- `test/fixtures/m87/PseudoCode-PayPal-doctored.md`
- `templates/workflows/gsd-t-verify.workflow.js`

---

### M87-D1-T1 — Build the exemplar fixture corpus (REAL, unmodified)
**Touches**: `test/fixtures/m87/PseudoCode-PayPal.md`, `test/fixtures/m87/PseudoCode-Extension.md`, `test/fixtures/m87/PseudoCode-PayPal-doctored.md`
**PseudoCode-Section**: PseudoCode-PayPal#guard-map
Copy the two binvoice exemplars **VERBATIM, byte-for-byte UNMODIFIED** — do NOT
rewrite their `[RULE]` lines to fit a grammar (the source uses `[RULE] <prose>`
in PayPal, `[RULE — <tag>]` in Extension; the parser must handle these, NOT the
fixtures bend to the parser — that's the vacuous-pass trap the pre-mortem caught).
PayPal currently carries **12** `[RULE]` lines; the parser DERIVES ids per §2.
Author the doctored PayPal variant identical to the faithful one EXCEPT exactly
one rule's build-map backing is flipped to contradicted. Fixtures carry their
build→rule map as a sibling JSON the test references.
**Acceptance criteria**: faithful fixture is a byte-identical copy of the real exemplar; faithful + doctored differ by exactly one rule's backing.
**Files**: the three fixtures above.
**Test**: M87-D1-T3.

### M87-D1-T2 — `bin/gsd-t-guard-map.cjs` deterministic gate
**Touches**: `bin/gsd-t-guard-map.cjs`
**PseudoCode-Section**: PseudoCode-PayPal#guard-map
Enumerate every rule from a doc per §2's **dual grammar**: explicit
`[RULE] <RULE-ID>: <invariant>`, loose `[RULE] <invariant>`, and tagged
`[RULE — <tag>] <invariant>`; resolve the id (explicit, else derive
`R-<DOC-SLUG>-<NN>` by appearance order — pure, deterministic). Read a build→rule
map; gate deterministically. Exit 0 (all backed, none contradicted), 4 (≥1
unbacked/contradicted, name the RULE-ID), 64 (bad input). Zero deps, never
throws, pure. CLI: `--doc <path> --map <path> --json`.
**Acceptance criteria**: SC1 — divergence FAILS at contract-breach severity, deterministic, RULE-ID named; parses all three §2 forms.
**Files**: `bin/gsd-t-guard-map.cjs`.
**Test**: M87-D1-T3 (A1).
**Headline**: true

### M87-D1-T3 — A1 falsifiable harness (+ fixture-fidelity)
**Touches**: `test/m87-guard-map-bridge.test.js`
**PseudoCode-Section**: PseudoCode-PayPal#guard-map
The kill-criterion test. **Fixture-fidelity FIRST (non-vacuous guard):** assert the
parser extracts **exactly 12** rules from the UNMODIFIED PayPal exemplar and `>0`
from Extension — a hard count, not `≥0`; a parser that extracts zero is itself a
FAILURE (this is what makes "faithful → exit 0" meaningful). Then: faithful exemplar
→ exit 0; doctored → exit non-zero with the violated RULE-ID in output; both
deterministic (no LLM). Also: unbacked rule fails; contradicted rule fails; malformed
input → 64; module never throws; derived ids are stable across re-parse.
**Acceptance criteria**: A1 — parser yields N>0 (PayPal=12) on the unmodified exemplar; exits 0 faithful / non-zero doctored, RULE-ID named.
**Files**: `test/m87-guard-map-bridge.test.js`.
**Test**: this IS the test (the A1 falsifiable harness; the headline impl it exercises is M87-D1-T2's `bin/gsd-t-guard-map.cjs`).

### M87-D1-T4 — Wire the gate into verify.workflow.js
**Touches**: `templates/workflows/gsd-t-verify.workflow.js`
**PseudoCode-Section**: PseudoCode-PayPal#mechanism
Add a deterministic guard-map gate step (FAIL-blocking, BEFORE the triad,
alongside verify-gate/CI-parity/test-data) via the `runCli` inline-agent helper.
M71 sandbox-clean; M85 tier literal policy-conformant (`haiku`, like the other
gate calls). Run only when a `PseudoCode-[Title].md` + build-map exist for the
milestone (absent → skip, logged, never silent failure).
**Acceptance criteria**: A6 — M71 runtime-native lint + M85 tier-policy lint stay green; full suite green.
**Files**: `templates/workflows/gsd-t-verify.workflow.js`.
**Test**: `test/m71-workflow-runtime-native-lint.test.js`, `test/m85-workflow-tier-policy-lint.test.js` (existing, must stay green).

---

**WAVE GATE:** M87-D1-T3 (A1) MUST pass before any wave-2 domain begins. If it
cannot be made deterministic, HALT the milestone and escalate.
