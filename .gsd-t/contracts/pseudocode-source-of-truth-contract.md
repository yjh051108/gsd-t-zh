# Contract: PseudoCode Source-of-Truth

**Version**: 1.1.0
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

A rule is any line matching the `[RULE …]` marker. Three accepted forms:

```
[RULE] <RULE-ID>: <invariant>      # explicit id (recommended for new docs; money/state guards)
[RULE] <invariant>                  # loose — PayPal exemplar style (id DERIVED)
[RULE — <tag>] <invariant>          # tagged em-dash — Extension exemplar style (id DERIVED)
```

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
`PseudoCode-PayPal.md` exemplar (currently **12** `[RULE]` lines) — a hard count,
not `≥ 0`. A parser that silently extracts zero is itself a FAILURE. "Faithful →
exit 0" is only meaningful once the faithful doc is proven to yield rules to back.

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

---

## Stability

STABLE. Breaking changes to any grammar above require a version bump and a
coordinated edit across all consuming domains.

## Changelog

- **1.1.0 (2026-06-17)** — §2 grammar reconciled to the real binvoice corpus after
  the plan-phase pre-mortem flagged a CRITICAL vacuous-pass: the original
  mandatory-`<RULE-ID>:` grammar matched NEITHER exemplar (PayPal `[RULE] <prose>`,
  Extension `[RULE — <tag>]`), so the gate would extract zero rules and pass
  trivially. §2 now accepts three forms (explicit id / loose / tagged) with
  deterministic id derivation, and mandates the A1 fixture-fidelity assertion
  (parser yields N>0, PayPal=12, on the UNMODIFIED exemplar). No domain boundary
  or file-ownership change.
- **1.0.0 (2026-06-17)** — initial partition-time contract.
