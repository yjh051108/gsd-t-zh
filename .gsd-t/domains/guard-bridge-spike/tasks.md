# Tasks: guard-bridge-spike (M87 D1 — Wave 1 kill gate)

## Files Owned
- `bin/gsd-t-guard-map.cjs`
- `test/m87-guard-map-bridge.test.js`
- `test/fixtures/m87/PseudoCode-PayPal.md`
- `test/fixtures/m87/PseudoCode-Extension.md`
- `test/fixtures/m87/PseudoCode-PayPal-doctored.md`
- `test/fixtures/m87/PseudoCode-PayPal.map.json`
- `test/fixtures/m87/PseudoCode-PayPal-doctored.map.json`
- `templates/workflows/gsd-t-verify.workflow.js`

---

### M87-D1-T1 — Build the exemplar fixture corpus (REAL, unmodified) + the build→rule-map JSON fixtures
**Touches**: `test/fixtures/m87/PseudoCode-PayPal.md`, `test/fixtures/m87/PseudoCode-Extension.md`, `test/fixtures/m87/PseudoCode-PayPal-doctored.md`, `test/fixtures/m87/PseudoCode-PayPal.map.json`, `test/fixtures/m87/PseudoCode-PayPal-doctored.map.json`
**PseudoCode-Section**: PseudoCode-PayPal#6-money-safety-map-every-guard-against-a-double-create
Copy the two binvoice exemplars **VERBATIM, byte-for-byte UNMODIFIED** — do NOT
rewrite their `[RULE]` lines to fit a grammar. The source places the marker
INLINE after the guard prose (`<GATE/guard text>   [RULE] <invariant>`), NOT at
line-start — PayPal style `... [RULE] <prose>`, Extension style `... [RULE — <tag>]`;
the parser must match the marker anywhere on the line and handle both, NOT the
fixtures bend to the parser — that's the vacuous-pass trap the pre-mortem caught.
PayPal's §6 "Money-safety map" carries **13** `[RULE]` lines (verified at plan time:
`grep -oE '\[RULE' /Users/david/projects/binvoice/PseudoCode-PayPal.md | wc -l` → 13);
the parser DERIVES ids per §2. The count tracks the byte-verbatim fixture — never bend
the fixture to a preordained number.
**The build→rule-map JSON fixtures (the doctored-vs-faithful distinction — A1's
required input, formerly UNOWNED):** author the two sibling maps the gate reads
via `--map`:
- `PseudoCode-PayPal.map.json` — **faithful**: all 13 derived RULE-IDs backed
  (each `backedBy` non-empty), NONE contradicted → the faithful doc + this map →
  exit 0. Its `rules` keyset MUST equal the parser's derived RULE-ID set for the
  byte-verbatim PayPal fixture EXACTLY (no extra/missing key) — so the map can't
  silently drift from the doc and re-open a vacuous pass.
- `PseudoCode-PayPal-doctored.map.json` — identical to the faithful map EXCEPT
  **exactly one** RULE-ID flipped to unbacked (`backedBy: []`) OR contradicted
  (`contradicted: true`). **Doctoring flips a MAP entry, NOT the doc text** — the
  `PseudoCode-PayPal-doctored.md` doc stays byte-identical to faithful so the
  parser's DERIVED ids are stable between faithful and doctored (the divergence
  lives only in the map). (`PseudoCode-PayPal-doctored.md` therefore == the
  faithful `.md`; the doctoring is map-only.)
**Acceptance criteria**: faithful fixture is a byte-identical copy of the real exemplar; the faithful map backs all 13 derived ids with none contradicted and its keyset equals the parser's derived id set; faithful + doctored maps differ by exactly one rule's backing while the docs are byte-identical.
**Files**: the five fixtures above.
**Test**: M87-D1-T3.

### M87-D1-T2 — `bin/gsd-t-guard-map.cjs` deterministic gate
**Touches**: `bin/gsd-t-guard-map.cjs`
**PseudoCode-Section**: PseudoCode-PayPal#6-money-safety-map-every-guard-against-a-double-create
Enumerate every rule from a doc per §2's grammar — match the `[RULE …]` marker
**anywhere on the line (NOT `^`-anchored)**; the corpus puts guard prose to the
LEFT of the marker. Handle explicit `... [RULE] <RULE-ID>: <invariant>`, loose
`... [RULE] <invariant>`, and tagged `... [RULE — <tag>] <invariant>` forms;
resolve the id (explicit, else derive
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
**PseudoCode-Section**: PseudoCode-PayPal#6-money-safety-map-every-guard-against-a-double-create
The kill-criterion test. **Fixture-fidelity FIRST (non-vacuous guard):** assert the
parser extracts **exactly 13** rules from the UNMODIFIED PayPal exemplar and `>0`
from Extension — a hard count, not `≥0`; a parser that extracts zero is itself a
FAILURE (this is what makes "faithful → exit 0" meaningful). **Map-keyset
equality:** assert the faithful map's (`PseudoCode-PayPal.map.json`) `rules`
keyset EXACTLY equals the parser's derived RULE-ID set for the byte-verbatim doc
— a map that drops or adds a key is a FAILURE (blocks the map silently drifting
from the doc and re-introducing a vacuous pass). Then the gate runs:
- faithful doc + **faithful map** → exit 0;
- faithful doc + **doctored map** (`PseudoCode-PayPal-doctored.map.json`, exactly
  one rule unbacked OR contradicted) → exit 4 with the violated RULE-ID NAMED in
  output;
both deterministic (no LLM). The doctoring flips a MAP entry, not the doc text,
so the derived ids stay identical between the faithful and doctored runs. Also:
unbacked rule fails; contradicted rule fails; malformed input → 64; module never
throws; derived ids are stable across re-parse.
**Acceptance criteria**: A1 — parser yields N>0 (PayPal=13) on the unmodified exemplar; faithful map keyset == derived id set; faithful doc+faithful map → exit 0 / faithful doc+doctored map → exit 4, RULE-ID named.
**Files**: `test/m87-guard-map-bridge.test.js`.
**Test**: this IS the test (the A1 falsifiable harness; the headline impl it exercises is M87-D1-T2's `bin/gsd-t-guard-map.cjs`).

### M87-D1-T4 — Wire the gate into verify.workflow.js
**Touches**: `templates/workflows/gsd-t-verify.workflow.js`
**PseudoCode-Section**: PseudoCode-PayPal#2-server-post-invoicescreate-the-money-call-the-record-is-born-here
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
