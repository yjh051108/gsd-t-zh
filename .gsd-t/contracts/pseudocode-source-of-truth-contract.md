# Contract: PseudoCode Source-of-Truth

**Version**: 1.1.5
**Status**: STABLE
**Owner domain**: `template-docripple-contract` (M87 D4)
**Consumed by**: `guard-bridge-spike` (D1), `traceability-section-coverage` (D2), `milestone-two-altitude-flow` (D3)
**Created**: 2026-06-17 14:35 PDT
**Milestone**: M87 — Intention-First PseudoCode as Milestone Source-of-Truth

---

## Purpose

Defines the document shape of `PseudoCode-[Title].md` and the machine-readable
contracts that bind every downstream consumer to it: the `[RULE]` guard-map
grammar (D1), the section-citation grammar (D2), the keep-or-supersede /
divergence-flag grammar (D3), and the ripple reference-point set (D4 lint).

This is the SINGLE source of truth for the PseudoCode document format. No
consumer re-derives these grammars; they import them from here. A grammar
change is a contract-version bump and a coordinated edit across consumers.

---

## 1. Document anatomy (`PseudoCode-[Title].md`)

A pseudocode instance is named `PseudoCode-[Title].md` where `[Title]` is the
SUBJECT it represents (e.g. `PseudoCode-PayPal.md`), never a milestone id. A
project holds many; a milestone may produce several. Only the shipped blank
mold keeps the `-spec` name: `templates/PseudoCode-spec.md`.

Two altitudes, authored in order:

1. **High-Level Approach** (signed off FIRST) — what/why/when, the actors, a
   one-breath summary. No field-level detail.
2. **Detailed** — the full section set below, at exemplar granularity.

The five section elements (each present per SC6, anchored to the binvoice
exemplars `PseudoCode-PayPal.md` + `PseudoCode-Extension.md`):

| Element | Form | Owner-of-grammar |
|---------|------|------------------|
| **Intention** | `> **Intention ({Author}, {date}).**` prose block, ABOVE the pseudocode. The WHY/directive — dated + attributed. Prose is the USER's intention, never agent reasoning. | D4 (template) |
| **Mechanism** | A fenced pseudocode block (the verified HOW). Grounds in EXISTING contracts/schema; defers concrete identifiers to plan-time-against-real-schema. | D4 (template) |
| **One-breath summary** | A "one call in one breath" summary table. | D4 (template) |
| **Guard map** | A guard-enumeration map rendering every invariant as a one-line `[RULE]` — see §2. | D1 (grammar) |
| **Divergence** | Explicit `⚠ Divergence` flags wherever a new intention supersedes shipped code — see §4. | D3 (grammar) |
| **Appendix** | Raw-pseudocode appendix with intention prose stripped (the build's quick-reference). | D4 (template) |

---

## 2. `[RULE]` guard-map grammar (D1 owns the parser)

> **Grammar reconciled to the real corpus (2026-06-17, pre-mortem CRITICAL).**
> The two binvoice exemplars — the fixture corpus this gate MUST validate against —
> do NOT carry explicit RULE-IDs: `PseudoCode-PayPal.md` emits `[RULE] <prose>`
> (no id, no colon) and `PseudoCode-Extension.md` emits `[RULE — <tag>] <prose>`
> (em-dash variant). A parser written to a mandatory-`<RULE-ID>:` grammar extracts
> ZERO rules from both, so A1's "faithful → exit 0" would pass VACUOUSLY (0 rules →
> trivially all-backed). The grammar below accepts BOTH the loose forms the corpus
> already uses AND an optional explicit id, so the gate is non-vacuous on real docs.

A rule is any line CONTAINING the `[RULE …]` marker. The marker is matched
**anywhere on the line, not line-anchored** — the real corpus places it INLINE
after the guard prose (`<guard text>   [RULE] <invariant>`), not at column 0.
A parser anchored to line-start (`^\s*\[RULE`) extracts ZERO from both exemplars
(the original vacuous-pass class). Three accepted marker forms:

```
... [RULE] <RULE-ID>: <invariant>     # explicit id, invariant RIGHT (recommended for new docs)
GATE: ... → 409   [RULE] <invariant>   # loose, invariant RIGHT — PayPal exemplar style (id DERIVED)
<invariant prose> ... [RULE — <tag>]   # tagged, invariant LEFT — Extension exemplar style (id DERIVED)
```

**Invariant capture is side-agnostic (2026-06-17, pre-mortem cycle-3 MEDIUM).**
One marker = one rule; the marker may sit anywhere on the line. The invariant
text lives on EITHER side: PayPal-style carries it to the RIGHT of `]`; ALL 8
Extension-style rules carry it to the LEFT (`<invariant> [RULE — <tag>]`, nothing
after `]`). A right-only capture yields an EMPTY invariant for every Extension
rule — which starves the A5 triad-consumption seam (Red Team gets a bare RULE-ID
with nothing to attack). So the parser MUST capture a NON-EMPTY invariant from
whichever side carries it: take the RIGHT-of-`]` text if non-empty, else the
LEFT-of-marker prose (trimmed, with any trailing `→ <code>`/`GATE:` provenance
preserved). A rule whose resolved invariant is empty is a PARSE FAILURE.
Matching: locate the marker `/\[RULE(\s*—\s*[^\]]*)?\]/` anywhere on the line;
invariant = `rightText || leftText` (non-empty). The optional `— <tag>` segment
is captured for provenance but does not change the rule count.

- **Rule ID resolution (deterministic):** if an explicit `<RULE-ID>:` is present,
  that IS the id. Otherwise the parser DERIVES a stable id deterministically:
  `R-<DOC-SLUG>-<NN>` where `<DOC-SLUG>` is from the filename (`PAYPAL`, `EXTENSION`)
  and `<NN>` is the rule's 1-based appearance order within the doc. Derivation is
  pure (same doc bytes → same ids); a reworded invariant keeps its id (order-keyed),
  a reordered/inserted rule reflows ids below it (documented limitation — explicit
  ids are the escape hatch when stability across reordering matters).
- Matching is path-as-RULE-ID, never substring (per
  `feedback_coverage_check_structural_not_substring`).
- A rule is **backed** when ≥1 test assertion references its (explicit or derived) id.
- A rule is **contradicted** (a divergence) when the build/test evidence
  asserts the negation of the invariant. Contradiction and unbacked are both
  FAILURES at contract-breach severity.

**Binding artifact** (build→rule map), consumed by D1's gate:

```json
{ "rules": { "<RULE-ID>": { "backedBy": ["<test assertion id>", ...], "contradicted": false } } }
```

The pass/fail decision over this map is **deterministic code, zero LLM
judgment**. An LLM may PRODUCE the map; code GATES on it. Exit non-zero
(contract-breach code) when any rule is unbacked or contradicted, naming the
violated `<RULE-ID>`. (A1 kill-criterion.)

**Non-vacuity on the MAP side (mandatory — the gate keys on the DOC, not the map).**
The gate iterates the **DOC's derived RULE-ID set** as the source of truth, NOT
the map's own keyset. For each doc-derived `<RULE-ID>`: a map entry that is
present-and-backed (`backedBy` non-empty, `contradicted:false`) passes; a map
entry that is unbacked (`backedBy: []`) or contradicted FAILS; **a doc-derived
`<RULE-ID>` whose key is ABSENT ENTIRELY from the map is treated as UNBACKED →
exit 4 naming it.** Iterating only the map's own keys would let an incomplete map
(one that simply omits a doc rule) pass vacuously — forbidden. (M87-D1-T3 asserts
this: a map missing one doc-derived id exits 4, proving doc-keyed iteration.)

**A1 fixture-fidelity assertion (mandatory — closes the vacuous-pass hole).** The
A1 harness MUST assert the parser extracts `N > 0` rules from the UNMODIFIED
`PseudoCode-PayPal.md` exemplar (the real exemplar's §6 "Money-safety map" carries
**13** `[RULE]` lines — verified by `grep -oE '\[RULE' | wc -l` against
`/Users/david/projects/binvoice/PseudoCode-PayPal.md` at plan time) — a hard count,
not `≥ 0`. A parser that silently extracts zero is itself a FAILURE. "Faithful →
exit 0" is only meaningful once the faithful doc is proven to yield rules to back.
The hard count (13) MUST be re-confirmed against the byte-verbatim fixture in
M87-D1-T3 (the fixture is the source of truth for the count; if the upstream
exemplar gains/loses a rule, T1 re-copies and T3's expected count is updated in
the same change — the count tracks the fixture, the fixture is never bent to a
preordained count).

---

## 3. Section-citation grammar (D2 owns the gate extension)

A plan task cites the pseudocode section it implements via a field:

```
**PseudoCode-Section**: <Title>#<section-anchor>
```

- The citation is parsed **path-as-path** (`<Title>` and `<section-anchor>` as
  structured segments), NEVER substring-matched against the doc text.
- A section in `PseudoCode-[Title].md` with ZERO citing tasks is a structural
  coverage gap, reported like a `journey-coverage` gap. (A2.)
- D2 EXTENDS `bin/gsd-t-traceability-gate.cjs` (M83) — it does not replace it.
  The existing AC→(path+test) binding is preserved.

> **§3 source-of-sections + anchor mapping reconciled to the real corpus
> (2026-06-17, pre-mortem CRITICAL A2 — the same vacuous-pass class already
> closed for D1 in §2).** Before this clarification §3 named no SOURCE for "the
> set of sections" and no heading→anchor function, so the gate could enumerate
> ZERO sections and pass A2 vacuously; worse, the M87 tasks.md files cited
> CONCEPTUAL anchors (`#guard-map`, `#one-breath`, `#mechanism`, `#divergence`,
> `#intention`) that are NOT real headings and would never resolve. The
> definitions below make the section set and the anchor function deterministic
> and make an unresolvable citation a FAILURE.

### 3.1 What counts as a citable section (deterministic)

A **citable section** is every **level-2 (`##`) heading** in the
`PseudoCode-[Title].md` doc — no more, no less. Explicitly EXCLUDED: the
single-`#`-banner lines that appear INSIDE the Appendix raw-pseudocode code
fences (`# 0.`, `# 1.`, …) — those are pseudocode comments, not document
sections, and live between fence delimiters. The enumerator counts `^## `
heading lines OUTSIDE fenced code blocks ONLY.

Hard counts on the byte-verbatim binvoice exemplars (verified at plan time by
`grep -cE '^## ' <doc>`): `PseudoCode-PayPal.md` = **10** `##` sections;
`PseudoCode-Extension.md` = **10** `##` sections. (These are the fixture floor
the D2 test asserts against — see §3.3. The count tracks the byte-verbatim
fixture; it is never bent to a preordained number.)

### 3.2 Heading → `#anchor` slug (deterministic, GitHub-style)

The anchor segment of a citation is matched against the slug DERIVED from each
`##` heading text by this exact function (GitHub-style, pure — same heading text
→ same slug):

1. Take the heading text after `## ` (trim leading/trailing whitespace).
2. Lowercase it.
3. Drop every character that is NOT an ASCII alphanumeric, a space, or a hyphen
   (so backticks, `—`, `→`, `★`, `/`, `:`, `+`, `(`, `)`, `,`, `;`, `.`, `#`
   are removed).
4. Replace each space with a hyphen (`-`).
5. Collapse runs of consecutive hyphens into one.

Examples (verified against the real exemplars):

| Heading | Slug |
|---------|------|
| `## 6. Money-safety map — every guard against a double-create` | `6-money-safety-map-every-guard-against-a-double-create` |
| `## The two AIs, in one breath` | `the-two-ais-in-one-breath` |
| `## 2. Server — `POST /invoices/create`  (★ THE MONEY CALL — the record is born here)` | `2-server-post-invoicescreate-the-money-call-the-record-is-born-here` |

Matching is **path-as-path / slug-as-slug**, never substring (per
`feedback_coverage_check_structural_not_substring`).

### 3.3 D2 non-vacuity floor + citation-resolution requirement (mandatory)

Mirroring §2's A1 fixture-fidelity assertion, the D2 test (M87-D2-T3) MUST:

- assert the gate enumerates a **HARD COUNT** of `##` sections from the
  UNMODIFIED exemplars — PayPal = **10**, Extension = **10** — not `≥ 0`. A gate
  that enumerates zero sections is itself a FAILURE; "faithful → no gap" is only
  meaningful once the faithful doc is proven to yield sections to cover.
- assert that **every** `**PseudoCode-Section**` anchor cited across the M87
  `tasks.md` files RESOLVES to a real `##`-heading slug (per §3.2) in the named
  doc. An **unresolvable citation is a FAILURE** (catches the phantom-anchor
  class — `#guard-map`, `#mechanism`, etc. — that was the A2 CRITICAL).

---

## 4. Divergence-flag grammar (D3 owns the keep-or-supersede protocol)

> **M87/M88 split (2026-06-17, v1.1.4).** The keep-or-supersede ASK + the
> writing of a `⚠ Divergence` flag on supersede ship in **M87** (D3
> `keep-or-supersede-subagent.md`, prose PROTOCOL). The DETERMINISTIC
> `parseDivergence()`/`formatDivergence()` grammar round-trip (so the divergence
> count is a code-checkable artifact that can feed D1's rule map) is **M88**
> (backlog #35). The grammar BELOW is the spec for both — it is NOT deleted; only
> the round-trip IMPLEMENTATION is deferred to M88.

Before encoding ANY model inherited from shipped code, the milestone flow asks
"keep this or supersede it?" per inherited model. Each **supersede** emits:

```
⚠ Divergence: <RULE-ID or section> — supersedes shipped <what>. Reason: <user intention>.
```

The divergence flag is captured IN the doc. In M87 it is WRITTEN by the prose
protocol; in M88 it becomes a deterministically parseable/formattable artifact
(round-trip byte-stable; a malformed flag FAILS) that may feed D1's rule map.
Keep = no flag. (SC4 — protocol half M87, grammar round-trip M88.)

---

## 5. Ripple reference-point set (D4 owns the lint)

`PseudoCode-[Title].md` MUST appear in all FOUR ripple reference points; the
A4 drift lint (M71-family) FAILS if it is missing from any one:

1. **Living Documents table** — `templates/CLAUDE-global.md` (~line 60). *Integrate-time seam.*
2. **Pre-Commit Gate** — `templates/CLAUDE-global.md`. *Integrate-time seam.*
3. **doc-ripple command** — `commands/gsd-t-doc-ripple.md`. *D4 owns.*
4. **project CLAUDE.md** — Living Documents reference. *Integrate-time seam (co-owned at merge).*

D4 OWNS reference point 3 (doc-ripple command) and the lint that verifies all
four. Reference points 1, 2, 4 are written SERIALLY at integrate-time (shared
`templates/CLAUDE-global.md` + project `CLAUDE.md` are integrate seams, never
parallel-written — file-disjointness invariant). (SC5, A4.)

---

## 6. Verify-triad consumption (A5 — MOVED TO M88)

> **M87/M88 split (2026-06-17, v1.1.4).** A5 (the integrate-time seam wiring the
> `[RULE]` set into the QA/Red-Team prompts) is **DESCOPED from M87 to M88**
> (backlog #35). As framed below it leaned on observing a LIVE triad run, which
> is non-deterministic; M88 redesigns it as a DETERMINISTIC seam-check
> (prompt-presence of the structured ingest directive + a unit test feeding
> guard-map JSON through the consuming code path), NOT a live triad run. The seam
> description below is RETAINED as the design intent the M88 redesign starts
> from; the M87-INT-T1 task + its `test/m87-verify-triad-rule-consumption.test.js`
> are NOT executed in M87.

The guard-map `[RULE]` set is fed to verify's orthogonal triad: QA receives the
rules as contract-compliance assertions; the Red Team receives them as a
pre-enumerated attack surface. The triad-prompt edits
(`templates/prompts/qa-subagent.md`, `templates/prompts/red-team-subagent.md`)
are an **integrate-time seam**, wired serially after D1's module passes A1 —
NOT assigned to any parallel domain. D1 exposes the rule set via its CLI/JSON
contract; the prompts consume it by that contract, never by editing D1 source.

**A5 is WIRED, not dangling (pre-mortem MEDIUM).** This seam carries an explicit
integrate-time task **M87-INT-T1** with its own killing test:

- **Edit**: `templates/prompts/qa-subagent.md` (add a step that ingests D1's
  `gsd-t guard-map --json` rule set and asserts each derived `<RULE-ID>` as a
  contract-compliance assertion) and `templates/prompts/red-team-subagent.md`
  (add the rule set as a pre-enumerated attack surface to probe for
  contradiction). Both consume D1's JSON contract only — never edit D1 source.
- **Test** (`test/m87-verify-triad-rule-consumption.test.js`): a verify run on a
  spec'd milestone (a PseudoCode doc + build-map present) surfaces the derived
  RULE-IDs in BOTH the QA contract-compliance frame AND the Red Team
  attack-surface frame — a frame missing the rule set is a FAILURE.
- **Ownership**: no parallel domain — it edits shared integrate seams
  (`templates/prompts/*`) wired serially after D1's A1 passes. Recorded in
  `integration-points.md` § "M87 Integrate-Time Seams" (the A5 row).

---

## 7. Doc + build-map discovery convention (deterministic — D1 owns the verify-step glob)

> **Added v1.1.5 (plan-phase pre-mortem cycle, HIGH — discovery seam unspecified).**
> Without a fixed on-disk convention for WHERE a milestone's PseudoCode docs +
> build-maps live, the verify step's discovery is undefined → it could always
> return nothing → the gate is permanent DEAD CODE (silent skip on every run).
> This section makes discovery deterministic.

Per-milestone PseudoCode docs and their build-maps live under a single project
directory (mirrors the existing `.gsd-t/briefs/<id>.json` pattern):

```
.gsd-t/pseudocode/PseudoCode-[Title].md          # the doc (one per coherent subject)
.gsd-t/pseudocode/PseudoCode-[Title].map.json    # its co-located build-map (same basename + .map.json)
```

The verify-workflow guard-map step (D1, in `gsd-t-verify.workflow.js`) discovers
deterministically:

1. **Glob** `.gsd-t/pseudocode/PseudoCode-*.md` for the project. A milestone may
   produce SEVERAL docs (one per subject) — the step handles the multi-doc set,
   not just one.
2. For each doc, the map is the **same basename with `.md` → `.map.json`**
   (`PseudoCode-Foo.md` → `PseudoCode-Foo.map.json`), co-located in the same dir.
3. **Pairing outcomes** (each a distinct, observable outcome — never a silent pass):
   - doc **+** co-located map present → **FIRE** the gate on that pair.
   - doc with **no** co-located map → a **logged skip WITH A REASON**
     (`reason: "no-build-map"`, naming the doc) — distinct from a fire, never a
     silent pass.
   - **zero** `PseudoCode-*.md` docs → a **logged skip WITH A REASON**
     (`reason: "no-pseudocode-docs"`) — the gate legitimately has nothing to gate,
     but the skip is surfaced, not silent (`feedback_no_silent_degradation`).
4. The fire path passes `--doc <doc> --map <map>` to `bin/gsd-t-guard-map.cjs`;
   any FAIL-blocking non-zero HALTS verify BEFORE the triad (peer of the
   verify-gate / CI-parity / test-data halts).

Discovery is path-as-path (glob + basename derivation), never substring. The set
the step enumerates is asserted by M87-D1-T5 against a fixture `.gsd-t/pseudocode/`
tree (incl. the multi-doc case).

---

## Stability

STABLE. Breaking changes to any grammar above require a version bump and a
coordinated edit across all consuming domains.

## Changelog

- **1.1.5 (2026-06-17)** — post-split pre-mortem fixes (2 HIGH + 1 MED, all about
  the gate's REACHABILITY + non-vacuity THROUGH the verify pipeline — NOT the
  module A1 already proves; NO boundary/domain change, STABLE preserved). **NEW §7
  "Doc + build-map discovery convention"** (HIGH — discovery seam was unspecified
  → the verify gate could be permanent DEAD CODE): per-milestone docs live at
  `.gsd-t/pseudocode/PseudoCode-[Title].md` with a co-located
  `.map.json`; the verify step globs `PseudoCode-*.md` (multi-doc), pairs each by
  basename, FIREs on a doc+map pair, and emits a logged skip-WITH-REASON
  (`no-build-map` / `no-pseudocode-docs`) — never a silent pass. **§2 clarification**
  (MED — map-side non-vacuity): the gate iterates the DOC's derived RULE-ID set as
  source of truth, NOT the map's keyset; a doc-derived id whose key is ABSENT from
  the map is treated as UNBACKED → exit 4 naming it (an incomplete map can't pass
  vacuously). Companion task changes (in D1 tasks, not this contract): the
  verify-workflow gate gains a real FIRING test (HIGH dead-code finding) —
  `test/m87-verify-guardmap-wiring.test.js` (M87-D1-T5) asserts discovery resolves
  + fires + halts-on-divergence + logs a distinct skip; M87-D1-T3 gains the
  missing-map-entry → exit-4 assertion.
- **1.1.4 (2026-06-17)** — M87/M88 SPLIT recorded (plan-phase pre-mortem cycle-4,
  8→5→2→6 findings; NO grammar change, NO domain-boundary change, STABLE
  preserved). The user split M87 into a deterministic core (ships now) + a
  follow-up milestone **M88** (backlog #35) for the soft-ACs that resist
  deterministic gating as-scoped. Contract annotations: **§4** — the divergence
  parse/format round-trip (SC4 deterministic half) is annotated M88 (the
  keep-or-supersede ASK + flag-writing stays M87 prose protocol; the grammar
  DEFINITION is retained, not deleted). **§6** — A5 verify-triad consumption is
  annotated MOVED TO M88, where it is redesigned as a deterministic seam-check
  (prompt-presence + a unit test feeding guard-map JSON) rather than a live triad
  run; the seam description is retained as design intent. The M87 core that
  REMAINS: §2 guard-map gate (A1 — gate DISCRIMINATION; the map-GENERATION path
  is M88), §3 section-citation coverage (A2) + the folded gate-scoping fix
  (`--milestone M87 --domains <4>` scopes to exactly the four subject-named M87
  domains, never fall-back-to-all), §5 ripple drift lint (A4), the A6 regression
  bar, and the folded A7 derived-id stability (the faithful-map keyset is
  generated programmatically from the parser's derived ids). All remaining M87
  obligations are deterministically gateable.
- **1.1.3 (2026-06-17)** — §2 invariant-capture made SIDE-AGNOSTIC (plan-phase
  pre-mortem cycle-3 MEDIUM; NO boundary/ownership/domain change, STABLE
  preserved). The right-only capture regex yielded an EMPTY invariant for all 8
  Extension-style `<invariant> [RULE — tag]` rules (invariant is LEFT of the
  marker there), starving the A5 triad-consumption seam. Parser now takes the
  RIGHT-of-`]` text if non-empty, else the LEFT-of-marker prose; empty resolved
  invariant = parse FAILURE. Also (companion, recorded in D1 tasks not the
  contract): `bin/gsd-t-guard-map.cjs` must be added to BOTH `GLOBAL_BIN_TOOLS`
  and `PROJECT_BIN_TOOLS` in `bin/gsd-t.js` (the HIGH global-bin-propagation
  finding — the gate is invoked in downstream projects where it must propagate,
  per `project_global_bin_propagation_gap`).
- **1.1.2 (2026-06-17)** — §3 clarification (plan-phase pre-mortem fix; NO
  boundary / ownership / domain change, STABLE preserved). Closes the A2
  vacuous-pass class (the §2 fix's twin): §3 now DEFINES the citable-section
  source (every `##` heading OUTSIDE Appendix code fences; PayPal=10,
  Extension=10 hard floor), the deterministic GitHub-style heading→`#anchor`
  slug function (§3.2), and a D2 non-vacuity floor + citation-resolution
  requirement (§3.3 — every M87 tasks.md `**PseudoCode-Section**` anchor MUST
  resolve to a real `##` slug; an unresolvable citation FAILS). §6 (A5) wired:
  it now names the integrate-time task **M87-INT-T1** + its killing test
  `test/m87-verify-triad-rule-consumption.test.js` so A5 is no longer dangling.
  Knock-on (outside this contract): the five phantom conceptual anchors
  (`#guard-map`/`#one-breath`/`#mechanism`/`#divergence`/`#intention`) cited in
  all four domains' tasks.md were replaced with anchors that resolve to real
  `##` slugs.
- **1.1.1 (2026-06-17)** — re-plan re-validation: corrected the §2 hard count to
  **13** (real PayPal exemplar; was 12) and mandated **non-anchored, inline** marker
  matching (the marker sits after the guard prose, not at line-start). Both errors
  would have re-opened the vacuous/false-fail hole. Grammar clarification only — no
  boundary, file-ownership, or domain change; STABLE preserved.
- **1.1.0 (2026-06-17)** — §2 grammar reconciled to the real binvoice corpus after
  the plan-phase pre-mortem flagged a CRITICAL vacuous-pass: the original
  mandatory-`<RULE-ID>:` grammar matched NEITHER exemplar (PayPal `[RULE] <prose>`,
  Extension `[RULE — <tag>]`), so the gate would extract zero rules and pass
  trivially. §2 now accepts three forms (explicit id / loose / tagged) with
  deterministic id derivation, and mandates the A1 fixture-fidelity assertion
  on the UNMODIFIED exemplar. Re-plan (2026-06-17, post-fix re-validation) corrected
  TWO residual errors found by re-grepping the real corpus: (a) the hard count is
  **13** `[RULE]` lines in PayPal, not 12 (off-by-one would have failed a faithful
  build OR invited bending the byte-verbatim fixture); (b) the marker is INLINE
  (`<prose> [RULE] ...`), not line-anchored — a `^\s*\[RULE` parser extracts zero, the
  same vacuous-pass class. §2 now mandates non-anchored marker matching. No domain
  boundary or file-ownership change.
- **1.0.0 (2026-06-17)** — initial partition-time contract.
