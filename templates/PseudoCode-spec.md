# {Title} — {one-line subject of this behavior map}

**Pseudocode + intention for how {the subject} behaves, end to end.**
Covers WHERE the system makes each decision, WHEN it refuses to, and how the
result reaches every consumer. **{Scope line — what this is, and the one thing
it deliberately does NOT do.}**

> **⚠ {THE LOAD-BEARING DIRECTIVE} ({Author}, {date}).** {The single sentence a
> reader must not miss — the WHY behind the whole map, stated as the user's
> intention. Prose here is the USER's directive, never agent reasoning.}

_Forward-looking behavior map for **{milestone / scope id}**. Not yet built —
grounds itself in the EXISTING contracts it must respect:
`{existing-contract-a}.md`, `{existing-contract-b}.md`, and the frozen
`{Schema}` (`{field}` / `{field}` / `{field}`). Companion to
`PseudoCode-{Other}.md`. See `{roadmap ref}` for the milestone scope._

<!--
  ─────────────────────────────────────────────────────────────────────────────
  HOW TO USE THIS MOLD  (delete this comment block in the real instance)
  ─────────────────────────────────────────────────────────────────────────────
  • Name the instance PseudoCode-[Title].md where [Title] is the SUBJECT
    (PseudoCode-PayPal.md), never a milestone id. Only THIS blank mold keeps the
    `-spec` suffix.
  • Author the TWO ALTITUDES in order:
      1. HIGH-LEVEL APPROACH  — what / why / when, the actors, a one-breath
         summary table. NO field-level detail. SIGN THIS OFF FIRST.
      2. DETAILED             — the full numbered `##` section set below, at
         exemplar granularity (one section per decision boundary).
  • Every section carries the FIVE SECTION ELEMENTS (see the contract §1):
      Intention prose · Mechanism pseudocode · one-breath summary ·
      [RULE] guard map · ⚠ Divergence flags · Appendix.
  • Each `> **Intention.**` prose block sits ABOVE its fenced pseudocode and is
    dated + attributed; the prose is the USER's WHY, never agent reasoning.
  • The Mechanism block grounds in EXISTING contracts/schema and DEFERS concrete
    identifiers to plan-time-against-the-real-schema.
  • Guard map: render EVERY invariant as a one-line `[RULE] <invariant>` (or the
    tagged `<invariant> [RULE — <tag>]` form). One marker = one rule.
  • Divergence: wherever a NEW intention supersedes shipped code, write an
    explicit `⚠ Divergence:` flag. Keep = no flag.
  • Cite each implementing plan task back with:
        **PseudoCode-Section**: {Title}#<github-slug-of-the-## heading>
  Grammars are owned by the contract:
  `.gsd-t/contracts/pseudocode-source-of-truth-contract.md`
  (§2 guard-map, §3 section-citation, §4 divergence). Do NOT re-derive them here.
  ─────────────────────────────────────────────────────────────────────────────
-->

---

<!-- ═══════════════ ALTITUDE 1 — HIGH-LEVEL APPROACH (sign off FIRST) ═══════════════ -->

## The one {call / decision}, in one breath

> **High-Level Approach ({Author}, {date}).** {What this does, why, and when —
> the actors and the single decision, in plain language. No field-level detail.
> This altitude is signed off BEFORE the Detailed sections below are written.}

| {Call / decision} | Lives in | Decides | Runs only when… |
|-------------------|----------|---------|-----------------|
| **{The call}** | **{realm — Server / Extension / …}** | {what it turns the input into} | {the precondition that triggers it} |
| **{The read / fallback}** | **{realm}** | {the question it answers} | {seller- / event-initiated trigger} |

> **SCOPE ({Author}, {date}).** {The deliberate OUT-of-scope boundary — what this
> map does NOT do. State the one status / call / surface it touches and the ones
> it refuses to touch. This keeps the Detailed sections honest.}

---

<!-- ═══════════════ ALTITUDE 2 — DETAILED (exemplar granularity) ═══════════════ -->

## 0. Where this picks up — {precondition / what exists before}

> **Intention ({Author}, {date}).** {What state the system is in when this map
> begins — the precondition. If this SUPERSEDES a shipped model, say so here and
> add the ⚠ Divergence flag below.}

```text
PRECONDITION:
  {The exact starting state — what is loaded / grouped / present, and what is
   deliberately NOT persisted yet.}
```

> ⚠ **Divergence from shipped {what} (plan-time reconcile):** {what the shipped
> code does today} vs. {what THIS intention does instead}. {What becomes dead
> code / what is reused.} Flag for the {milestone} plan.
> *(Keep = delete this flag. Supersede = keep it, per contract §4.)*

---

## 1. {First boundary} — {the trigger → the actor that owns it}

> **Intention.** {WHY this step exists and what the user wants it to do — the
> directive. One short paragraph, the user's voice.}

```text
{ACTOR}  on {trigger}:
    {step}
    {the call / the guard}
    on {outcome}:  {what happens}
    on {failure}:  {the safe fallback — never a crash}
```

---

## 2. {Second boundary} — `{the operation}`  (★ {why this one is load-bearing})

> **Intention.** {The WHY. Name the one invariant this section exists to protect
> — e.g. "every guard makes a double-click HARMLESS".}

```text
{operationName}({inputs}):

    # ── GATE 1 — {what it validates} (RULE) ────────────────────────────────
    # Intention: {why this gate exists, in the user's voice}.
    {load / lock}
    if {precondition fails}:   → {status / error}   # {what it protects}

    # ── GATE 2 — {backstop} (RULE, backstop) ───────────────────────────────
    # Intention: {why — name it a backstop if upstream already blocks it}.
    if {impossible condition}:   → {status}

    # ── STEP 3 — {the side-effecting call} ─────────────────────  ★ {marker}
    # Intention: {what crosses the boundary and what is deferred to real schema}.
    {the call}                                   # defer concrete ids to plan-time

    # ── STEP 4 — PERSIST + {atomic effect} (RULE, one tx) ──────────────────
    # Intention: {the record is born / the state flips — atomically}.
    in ONE tx:
        {write}
        {flip state}
    return {success shape}

    # ── FAILURE — never half-{do the thing} (RULE) ─────────────────────────
    # Intention: a failed {op} persists NOTHING — safe retry.
    on {failure} (any point):  nothing persisted ; → {status}
```

---

## 3. {Further boundaries as needed} — {one `##` section per decision}

> **Intention.** {Add as many numbered `##` sections as the subject has distinct
> decision boundaries — match the exemplars' granularity, one section per real
> decision, not one giant section.}

```text
{the mechanism for this boundary}
```

---

## {N}. {Subject}-safety map — every guard, as a one-line [RULE]

```text
GATE: {condition} → {status}                     [RULE] {the invariant in one line}
GATE: {lock / serialize}                          [RULE] {what it prevents}
{deterministic guard}                             [RULE — {tag}] {invariant, tagged form}
{never-do-this}                                   [RULE] {the prohibition}
{born / set at this exact point}                  [RULE] {the lifecycle invariant}
on {failure}: persist NOTHING                     [RULE] {the safe-failure invariant}
```

**{One paragraph restating the whole safety story in prose: the record is born
WHEN, the lock means WHAT, the one thing that can never happen, and why every
retry / double-action is harmless.}**

---

## {Optional} — {ONE STORE / shared-state / known-gaps notes}

> {Optional sections the exemplars carry: a shared-store note, a "Known gaps /
> status (as of {version})" list. Include only if the subject has them.}

---

## Appendix — Raw pseudocode (no intention comments)

```text
# ════════════════════════════════════════════════════════════════════════════
# {REALM A} — {what it covers}
# ════════════════════════════════════════════════════════════════════════════
{the §1–§N mechanism, intention prose STRIPPED — the build's quick-reference}

# ════════════════════════════════════════════════════════════════════════════
# {REALM B} — {what it covers}
# ════════════════════════════════════════════════════════════════════════════
{operationName}({inputs}):
    {guard}                                       # {one-line reason}
    {the call}                                    # ★ {the load-bearing call}
    tx: {write} ; {flip state}
    return {success}
    on fail: persist NOTHING ; → {status}         # safe retry
```
