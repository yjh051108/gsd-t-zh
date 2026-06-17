# Contract: PseudoCode Source-of-Truth

**Version**: 1.1.2
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
... [RULE] <RULE-ID>: <invariant>   # explicit id (recommended for new docs; money/state guards)
... [RULE] <invariant>               # loose — PayPal exemplar style (id DERIVED)
... [RULE — <tag>] <invariant>       # tagged em-dash — Extension exemplar style (id DERIVED)
```

The text LEFT of the marker (the guard/GATE prose) is part of the invariant's
provenance, not a separate rule; one marker = one rule. Matching regex shape:
`/\[RULE(\s*—\s*[^\]]*)?\]\s*(.*)$/` applied per line (marker may be preceded by
arbitrary text). The optional `— <tag>` segment is captured but does not change
the rule count.

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

Before encoding ANY model inherited from shipped code, the milestone flow asks
"keep this or supersede it?" per inherited model. Each **supersede** emits:

```
⚠ Divergence: <RULE-ID or section> — supersedes shipped <what>. Reason: <user intention>.
```

The divergence flag is captured IN the doc and is a checkable artifact (it may
feed D1's rule map). Keep = no flag. (SC4.)

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

## 6. Verify-triad consumption (A5 — integrate-time seam)

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

## Stability

STABLE. Breaking changes to any grammar above require a version bump and a
coordinated edit across all consuming domains.

## Changelog

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
