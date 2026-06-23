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
- `test/m87-verify-guardmap-wiring.test.js`

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
  **Derived-id stability (cycle-4 LOW — folded into the core):** the faithful
  map's keyset is GENERATED PROGRAMMATICALLY from the parser's derived ids at
  test setup (T3 builds it from the parse, asserts equality), OR via a documented
  regen script — NEVER hand-maintained. So a fixture re-copy that reflows the
  doc's derived ids reflows the map keyset in the SAME change (doc ids AND map
  keyset move together), instead of the keyset rotting against a hand-typed list.
  If the committed `PseudoCode-PayPal.map.json` keys are authored, T1 documents
  the one-line regen command and T3's keyset-equality assertion is the guard.
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
`R-<DOC-SLUG>-<NN>` by appearance order — pure, deterministic). **Invariant capture
is SIDE-AGNOSTIC (§2 v1.1.3):** the invariant text = RIGHT-of-`]` if non-empty,
ELSE the LEFT-of-marker prose (all 8 Extension rules are `<invariant> [RULE — tag]`
with nothing right). A rule whose resolved invariant is EMPTY is a parse FAILURE.
Read a build→rule
map; gate deterministically. Exit 0 (all backed, none contradicted), 4 (≥1
unbacked/contradicted, name the RULE-ID), 64 (bad input). Zero deps, never
throws, pure. CLI: `--doc <path> --map <path> --json`.
**Acceptance criteria**: SC1 — divergence FAILS at contract-breach severity, deterministic, RULE-ID named; parses all three §2 forms; every rule yields a NON-EMPTY invariant (side-agnostic capture).
**Files**: `bin/gsd-t-guard-map.cjs`.
**Test**: M87-D1-T3 (A1).
**Headline**: true

### M87-D1-T3 — A1 falsifiable harness (+ fixture-fidelity)
**Touches**: `test/m87-guard-map-bridge.test.js`
**PseudoCode-Section**: PseudoCode-PayPal#6-money-safety-map-every-guard-against-a-double-create
The kill-criterion test. **Fixture-fidelity FIRST (non-vacuous guard):** assert the
parser extracts **exactly 13** rules from the UNMODIFIED PayPal exemplar and
**exactly 8** from Extension — a hard count, not `≥0`; a parser that extracts zero
is itself a FAILURE (this is what makes "faithful → exit 0" meaningful).
**Non-empty-invariant (side-agnostic capture):** assert EVERY rule of BOTH styles
yields a non-empty invariant — specifically that each of the 8 Extension
`<prose> [RULE — tag]` rules captures its LEFT-of-marker prose (not an empty
string); an empty invariant is a FAILURE. This proves the A5 triad-consumption
seam gets real attack-surface text, not bare RULE-IDs. **Map-keyset
equality (derived-id stability, cycle-4 LOW):** GENERATE the expected keyset
PROGRAMMATICALLY from the parser's derived ids for the byte-verbatim doc (do NOT
hand-type the expected list), then assert the faithful map's
(`PseudoCode-PayPal.map.json`) `rules` keyset EXACTLY equals it — a map that drops
or adds a key is a FAILURE (blocks the map silently drifting from the doc and
re-introducing a vacuous pass; and makes a fixture re-copy reflow doc ids AND map
keyset together, never rot against a hand-maintained list). Then the gate runs:
- faithful doc + **faithful map** → exit 0;
- faithful doc + **doctored map** (`PseudoCode-PayPal-doctored.map.json`, exactly
  one rule unbacked OR contradicted) → exit 4 with the violated RULE-ID NAMED in
  output;
both deterministic (no LLM). The doctoring flips a MAP entry, not the doc text,
so the derived ids stay identical between the faithful and doctored runs. Also:
unbacked rule fails; contradicted rule fails; malformed input → 64; module never
throws; derived ids are stable across re-parse.
**Map-side non-vacuity (cycle MED — gate keys on the DOC, not the map):** feed a
map that is MISSING one doc-derived RULE-ID ENTIRELY (the key absent, not merely
unbacked) → the gate MUST exit 4 naming that rule as UNBACKED. This proves the
gate iterates the DOC's derived id set as source of truth and treats an absent
map entry as unbacked — an incomplete map that simply omits a doc rule can NEVER
pass vacuously (contract §2 "Non-vacuity on the MAP side").
**Acceptance criteria**: A1 — parser yields N>0 (PayPal=13) on the unmodified exemplar; faithful map keyset == derived id set; faithful doc+faithful map → exit 0 / faithful doc+doctored map → exit 4, RULE-ID named; a map MISSING a doc-derived id (key absent) → exit 4 naming it as unbacked (doc-keyed iteration, no map-side vacuous pass).
**Files**: `test/m87-guard-map-bridge.test.js`.
**Test**: this IS the test (the A1 falsifiable harness; the headline impl it exercises is M87-D1-T2's `bin/gsd-t-guard-map.cjs`).

### M87-D1-T4 — Wire the gate into verify.workflow.js
**Touches**: `templates/workflows/gsd-t-verify.workflow.js`
**PseudoCode-Section**: PseudoCode-PayPal#2-server-post-invoicescreate-the-money-call-the-record-is-born-here
Add a deterministic guard-map gate step (FAIL-blocking, BEFORE the triad,
alongside verify-gate/CI-parity/test-data) via the `runCli` inline-agent helper.
M71 sandbox-clean; M85 tier literal policy-conformant (`haiku`, like the other
gate calls). **Discovery per contract §7:** glob `.gsd-t/pseudocode/PseudoCode-*.md`
(multi-doc), pair each with its co-located `PseudoCode-[Title].map.json` by
basename; a doc+map pair FIREs the gate; a doc with no map → logged
skip-with-reason (`no-build-map`); zero docs → logged skip-with-reason
(`no-pseudocode-docs`) — never a silent pass. The fire path passes the resolved
`--doc`/`--map` to `gsd-t-guard-map.cjs`; a FAIL-blocking non-zero HALTS verify
BEFORE the triad.
**Acceptance criteria**: A6 — M71 runtime-native lint + M85 tier-policy lint stay green; full suite green. PLUS the reachability AC (proven by M87-D1-T5): the gate step FIRES on a discovered doc+map pair, HALTS verify before the triad on a doctored (divergent) map, and logs a DISTINCT skip-with-reason when the doc/map is absent — i.e. the step is reachable and non-vacuous through the pipeline, NOT dead code.
**Files**: `templates/workflows/gsd-t-verify.workflow.js`.
**Test**: `test/m87-verify-guardmap-wiring.test.js` (the firing/reachability test — M87-D1-T5), plus `test/m71-workflow-runtime-native-lint.test.js`, `test/m85-workflow-tier-policy-lint.test.js` (existing, must stay green).
**Headline**: true

### M87-D1-T5 — Verify-pipeline FIRING / reachability test (closes the dead-code class)
**Touches**: `test/m87-verify-guardmap-wiring.test.js`
**PseudoCode-Section**: PseudoCode-PayPal#2-server-post-invoicescreate-the-money-call-the-record-is-born-here
The reachability test for M87-D1-T4 — proves the verify gate step is NOT dead
code (the M5 dead-headline class: a broken discovery = permanent silent skip
while A1 + the M71/M85 lints + suite-green all stay green). **The test
CONSTRUCTS its own fixture `.gsd-t/pseudocode/` tree at setup** (in a temp dir,
HOME/cwd-redirected per the non-destructive sandbox pattern — never the real
project tree): it WRITES ≥2 distinct `PseudoCode-[Title].md` docs EACH with a
co-located `PseudoCode-[Title].map.json` (e.g. seeded from D1-T1's PayPal
faithful doc+map, copied under two distinct basenames) PLUS one
doc-with-no-map and a zero-docs variant — because D1-T1's owned fixtures supply
only ONE fire-able pair, and the multi-doc ENUMERATION assertion below cannot be
proven against a single pair (the dead-assertion trap: a single-pair tree lets
the multi-doc claim pass vacuously). The test owns this tree-construction;
no fixture files are added to D1-T1's Files-Owned. Against this fixture tree,
assert:
- **(enumeration, §7 — MULTI-DOC, non-vacuous)** the step ENUMERATES the full
  doc+map set from the constructed `.gsd-t/pseudocode/` tree and FIREs on **BOTH**
  fire-able pairs (≥2 distinct `PseudoCode-[Title].md`, each paired to its
  `.map.json` by basename) — assert the count of fired pairs is ≥2, not just ≥1,
  so the multi-doc path is genuinely exercised;
- **(resolve)** the step RESOLVES and passes the correct `--doc`/`--map` paths to
  `bin/gsd-t-guard-map.cjs` for each discovered pair;
- **(fire + halt on divergence)** on the DOCTORED map the step propagates a
  FAIL-blocking non-zero that HALTS verify BEFORE the triad — asserted the same
  way the existing verify-gate / ci-parity / test-data halts are asserted in the
  workflow;
- **(fire + proceed)** on the FAITHFUL map the step proceeds (no halt);
- **(skip is distinct, not silent)** a pure-skip run (doc absent, or doc present
  with no co-located map) LOGS the skip WITH A REASON (`no-pseudocode-docs` /
  `no-build-map`), asserted DISTINCT from a fire (a skip must be observably a skip,
  never indistinguishable from a clean fire-and-pass).
Reachability-adjacent to the headline; M71 sandbox-clean assertions preserved.
**Acceptance criteria**: the test CONSTRUCTS its own multi-doc fixture tree (≥2 fire-able doc+map pairs + a doc-no-map + a zero-docs variant) in a redirected temp dir; the gate step enumerates the §7 doc+map set and FIRES on ALL fire-able pairs (count ≥2, the multi-doc path genuinely exercised, never vacuous on a single pair), resolves correct `--doc`/`--map`, HALTS-before-triad on a doctored map, proceeds on a faithful map, and logs a DISTINCT skip-with-reason for both `no-build-map` and `no-pseudocode-docs` — the gate is reachable + non-vacuous through the verify pipeline.
**Files**: `test/m87-verify-guardmap-wiring.test.js`.
**Test**: this IS the test (the firing/reachability harness; the impl it exercises is M87-D1-T4's verify-workflow gate step + M87-D1-T2's `bin/gsd-t-guard-map.cjs`).

---

**WAVE GATE:** M87-D1-T3 (A1) MUST pass before any wave-2 domain begins. If it
cannot be made deterministic, HALT the milestone and escalate.
