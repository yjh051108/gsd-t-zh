# Stated Claims — DETECT Prompt Snippet (auto-research-contract §6.5)

<!-- M89 — D2 deliverable: the reusable DETECT seam (§6.5 + §1.3). Each eligible stage embeds
     this snippet (Read at spawn time alongside research-subagent.md) in its prompt. -->

## What This Is

This snippet defines the **Stated Claims** requirement injected into every eligible GSD-T stage prompt
(plan, pre-mortem, partition, discuss, milestone [D3 — upper phases]; execute, debug, quick [D4 —
worker phases]).

**DETECT is NOT deterministic.** Detecting that you need info is a judgment. This snippet is an
LLM-prompted obligation (best-effort), mirroring the keep-or-supersede protocol. Determinism lives
in CLASSIFY (`bin/gsd-t-research-gate.cjs`) and ENFORCE (the §7 marker + verify gate) — not in DETECT.

---

## Required Emission: `## Stated Claims`

**Every eligible stage MUST emit a `## Stated Claims` section** listing every load-bearing claim it
relies on, tagged with one of the four labels below. This list is how the wiring knows which claims to
route through the classifier.

```markdown
## Stated Claims

- [KNOWN] <a claim the agent has verified via source, or is repo-internal-evident>
- [GUESSED:unknown] <a claim the agent lacks the fact for — has no basis at all>
- [GUESSED:assumed] <a claim asserting an unverified external shape / value / behavior>
- [GUESSED:stale] <an external/time-varying fact that was known but may have aged>
```

### The Four Tags — Exact Grammar

The wiring (`D3`/`D4`) machine-parses this section. Use EXACTLY these tags (case-sensitive, bracket
syntax); other formats are ignored by the parser and treated as untagged:

| Tag | Meaning |
|-----|---------|
| `[KNOWN]` | You have verified this claim: it is repo-internal-evident (grep, Read, or your working context from THIS session), OR you are citing a source you fetched this session. |
| `[GUESSED:unknown]` | You lack the fact outright — you have no basis for it. |
| `[GUESSED:assumed]` | You ASSERT a shape, return value, limit, or behavior you NEVER verified. "Plausible" and "would make sense" are NOT `KNOWN`. |
| `[GUESSED:stale]` | You KNEW it but it is an external/time-varying fact (API, price, model ID, library signature, rate limit) that may have changed since you last saw it. |

### The Three GUESS-TYPES (auto-research-contract §1.3)

Any `[GUESSED:*]` claim triggers the classify+verify pipeline. The type matters for explainability
but all three route the same way:

1. **Unknown** — you have no basis. The agent lacks the fact.
2. **Assumed** — confident but unverified. The dominant failure mode in the binvoice S2-M5 incident
   (API return shapes stated as fact, never checked). **Plausible ≠ confirmed.**
3. **Stale** — was true, may not be now. **DEFAULT: FAIL TOWARD VERIFY.** Any external/time-varying
   fact without a FRESH cited source is stale → research. Do NOT trust your self-assessment of your own
   staleness — that self-assessment is itself another guess.

### The Honest Best-Effort Contract

- You are REQUIRED to try to tag every load-bearing claim you rely on.
- A claim you FAILED to tag is an **acknowledged miss** — a limit of an LLM-prompted detector — NOT
  a silent pass for claims you DID tag.
- The deterministic guarantees (CLASSIFY + ENFORCE via the §7 marker) apply to every TAGGED guessed
  claim. DETECT coverage is YOUR job; enforcement is the gate's job.
- **An absent (un-stated) gap is a best-effort miss, not a silent pass.** The more you tag, the more
  the system can verify on your behalf.

### What Counts as "Load-Bearing"

A claim is load-bearing if a deliverable or decision in this phase DEPENDS on it being correct. Examples:

- The shape of an external API response your code will parse.
- A version or feature availability assertion ("this SDK supports X").
- A rate limit or quota your logic needs to respect.
- A default value or flag behavior in a third-party tool.
- A contract clause, spec wording, or standard requirement you are implementing against.

Internal claims (this repo's own code, contracts, tests, schema — things you can verify with grep/Read)
that you have just verified in this session are `[KNOWN]`, not `[GUESSED]`.

---

## For the Wiring (D3/D4 reference — not for the stage agent)

The wiring iterates every `[GUESSED:*]` line through `bin/gsd-t-research-gate.cjs`. Each external
guess → research stage → `## Verified Facts (auto-research)` block + §7 ENFORCE marker. Each internal
guess → grep/Read (and escalate to external if grep returns nothing — §5.1). The `## Stated Claims`
heading is the machine-parseable entry point; the wiring greps for exactly this heading string.

**Contract reference:** `auto-research-contract.md` v1.2.0 §6.5 (DETECT seam) + §1.3 (three guess-types).
