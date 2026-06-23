# M90 — Unproven-Assumption Doctrine — Behavior Map

**Pseudocode + intention for how GSD-T detects an unproven assumption (factual OR
architectural) and forces STOP → research-how-others-solved-it → re-examine-premise →
proceed — instead of plowing forward on a guess.**

_Intention-first behavior map (the M87/binvoice pattern). DRAFT for David to correct —
zero code until signed off. Grounds in the LOCKED sourced approach
(`.gsd-t/discuss/M90-approach-sourced.md`): **externalize + force, never introspect.**
The model NEVER grades its own assumption; a deterministic trigger fires an external
check (blind adversary and/or reality), and research is protocol-forced where
self-detection can't be trusted._

---

## The one principle, in one breath

| The system is about to… | …on a basis that is | →  Action |
|---|---|---|
| use a FACT (what the code/an API does) | unverified / open-world / time-sensitive | classify → grep (own files) / research-and-cite (external) |
| build on an APPROACH (this fix, this architecture, "the existing code is right") | unproven (never checked it's the right way) | **blind-adversary review + executable spike BEFORE building** |
| keep iterating a loop that produces variant-after-variant | the same failing premise | **HALT the patch path → re-examine the PREMISE, don't patch the next variant** |

> **Inviolable (from the research, sourced):** the model is NEVER asked "are you sure?" /
> "is this sound?" to decide any of this — self-reported confidence is ≈ coin-flip and
> RLHF makes it worse. Every decision below is made by a DETERMINISTIC trigger or an
> EXTERNAL (separate-context) check or REALITY (run it), not by introspection.

---

## 0. Where this lives — three hooks, one doctrine

> **Intention.** The doctrine is not a new phase; it's three hooks into phases that
> already exist, sharing one contract. (a) FACTUAL hook — at any research-eligible step,
> the M89 factual machinery, redesigned. (b) ARCHITECTURAL hook — at plan/design time and
> when "build on existing code" is proposed. (c) NON-CONVERGENCE hook — inside debug/plan/
> verify loops. All three resolve the same way: an unproven basis → external check /
> research, fail-closed.

```text
PRECONDITION:
  An agent is about to act on a load-bearing basis (a fact, an approach, or "the
  current code/architecture is correct"). The doctrine intercepts BEFORE the act.
```

---

## 1. FACTUAL hook — redesigned M89 (the vendor-list lesson, fixed)

> **Real-world example.** While building binvoice's PayPal feature, the agent wrote "the
> system gets a web link back when it creates a PayPal invoice" — it never checked PayPal,
> it just assumed that because it sounded right. That claim is about PayPal (an outside
> company), so the rule is: look it up in PayPal's documentation and write down what's
> actually true, with the source. A claim about your own code ("does our locking function
> block an order once it's invoiced?") just gets read straight from your own code. A claim
> about something that changes over time ("PayPal's login process works like X") gets
> looked up fresh even if it feels certain. And if the agent wrote that PayPal assumption
> into the work and never backed it up, the final check refuses to pass until it's verified.

> **Intention (the M89 fix that paused it).** A claimed FACT that the agent is only
> guessing must be verified. The classifier failed because it tried to recognize the
> OPEN external world by a hardcoded ~40-vendor list. Fix: the mechanical layer recognizes
> ONLY the CLOSED knowable set — THIS repo's own files — and says "internal." It NEVER
> tries to enumerate "external." Anything not confidently-internal goes to the LLM judge
> (which knows the open world); uncertain → research. No frozen list of vendors.

```text
on a load-bearing FACTUAL claim (agent-tagged GUESSED, the M89 Stated-Claims step):
    # ── mechanical filter: the ONLY thing regex may assert is "this is OUR file" ──
    if claim names a CONCRETE repo path/file (bin/x.cjs, *.workflow.js, a real own tool):
        → INTERNAL  → grep/Read our own code   [RULE R-FACT-1]
    else:
        # regex does NOT decide "external" — it can't enumerate the open world
        → hand to LLM JUDGE (knows GitHub/Slack/PayPal/…): internal or external?
        if judge says INTERNAL with confidence:  → grep/Read
        else (external OR judge-uncertain):       → RESEARCH + cite   [RULE R-FACT-2]
    # ── time-anchored protocol override (the temporal blind spot) ──
    if claim is about a fast-moving lib/API/version OR "current/latest best practice":
        → RESEARCH regardless of any confidence   [RULE R-FACT-3]   # CoVe-style always-verify
    # ── enforce (M89 §7 fail-closed gate, KEPT) ──
    external claim proceeds with NO cited source  → verify FAILS   [RULE R-FACT-4]
```

> ⚠ **Divergence from M89 v1.3.3:** the deterministic external-vendor recognition (the
> `EXTERNAL_VENDOR_NOUNS` list) is DELETED. Regex asserts only INTERNAL (own paths);
> the LLM judges external. The §7 fail-closed cite gate is KEPT as-is.

---

## 2. ARCHITECTURAL hook — the new load-bearing piece (no introspection)

> **Real-world example.** In binvoice, the agent assumed "the way the current code finds
> Facebook comments is fine — I'll just tweak it." That assumption was wrong, and it
> tweaked it 7 times. Under this rule, before building on that approach a second,
> independent reviewer (a fresh agent that didn't write it) is told: "assume this is wrong
> — what's the flaw? is there a better-known way?" It answers: "yes — you're keying off the
> part of Facebook's page that changes constantly; key off the text instead." That's the
> same rethink David eventually forced by hand — now it happens automatically, BEFORE the 7
> failed attempts. And rather than just argue about it: build the smallest possible working
> version and run it; if the new approach actually captures the comments the old one missed,
> it's proven, not hoped.

> **Intention (the omission David named).** The dangerous assumption is "THIS approach is
> right" / "the existing code was built right, so I'll build on it." The model cannot judge
> this about its own design (plan self-critique is documented to fail). So the basis is
> checked EXTERNALLY: a blind adversary attacks the design as if it were someone else's,
> and — where feasible — REALITY checks it (build a thin spike, run it). This is the M83
> pre-mortem + Red-Team-on-fable substrate, extended to fire on an architectural trigger.

```text
on a proposed APPROACH / on extending EXISTING code X (David #5: fires for BOTH —
"the existing extractor is fine, I'll just patch it" is itself an unproven approach):

    # ── TRIGGER — runs EVERYWHERE (David #1), the RESPONSE is the real gate ──
    # The trigger's only job is "when in doubt, challenge"; over-triggering just runs
    # more (proven) checks, so it can never be wrong in a costly way.
    # (a) consistency-divergence: ask for the approach N times in fresh context;
    #     divergence ⇒ a load-bearing assumption is unproven.   [RULE R-ARCH-1] (EXPERIMENTAL+MEASURED)
    # (b) protocol class: time-sensitive / unfamiliar-external / extending-unverified-code
    #     → challenge unconditionally.                          [RULE R-ARCH-2]
    # ALWAYS challenge (trigger fires on every approach decision per David #1):
        # ── RESPONSE 1 — BLIND ADVERSARY (separate context/model; author can't grade itself) — PROVEN ──
        adversary(prompt = "find the FATAL flaw in THIS design — assume it is wrong;
                            has this class of problem been solved a better way?
                            if X extends existing code: is THAT code's approach sound, or
                            am I building on an unproven premise?")
        if adversary names a real flaw OR a better-known approach:
            → STOP. research how others solved this class of problem.
            → RE-EXAMINE the premise. redesign. (do NOT proceed on the original.)   [RULE R-ARCH-3]
        # ── RESPONSE 2 — EXECUTABLE SPIKE (reality, not opinion) — PREFERRED, best-effort+forced-fallback (David #2) ──
        # generalizes M87 risk-first "prove the load-bearing claim before scaffolding"
        if a thin spike is feasible:
            build the THINNEST thing that would FAIL if the approach is wrong; RUN it.
            spike fails → STOP + re-examine (premise wrong, cheaply).               [RULE R-ARCH-4]
            spike passes → proceed; the premise is PROVEN by reality, not assumed.
        else (genuinely cannot spike cheaply):
            → log the skip + reason (a DECISION, not a silent dodge — can't self-exempt)
            → RESPONSE 1 (blind adversary) becomes MANDATORY, not optional          [RULE R-ARCH-5]
            → mark the premise "proven-by-adversary-only, NOT by reality"; surfaced at verify
              (fail-closed-flagged: proceeds, but the unproven-by-reality status is visible) [RULE R-ARCH-6]
```

> ⚠ **Divergence / honest limit (David #4 → experimental + MEASURED):** the architectural
> *trigger* R-ARCH-1 (consistency-divergence) has NO published validation. It runs
> EVERYWHERE (#1) but the contract flags it EXPERIMENTAL and M90 INSTRUMENTS it: track
> how often it fires and whether what it caught was a REAL bad approach. If the data shows
> it's noise or useless, that's a MEASURED finding to revisit — never a silent claim that
> it works. Its false-positive cost is bounded: over-triggering just runs the (proven)
> adversary+spike RESPONSE more often. The RESPONSE (blind adversary + spike) is the
> research-backed gate; the trigger is a cheap "challenge by default" hint.

---

## 3. NON-CONVERGENCE hook — the loop must HALT, not narrate

> **Real-world example.** This very effort (M89) went around 8 times — each round a new
> "fix" for the same underlying problem, never stepping back. Under this rule the system
> counts the rounds; a fix that solves one thing but breaks another still counts as going
> in circles. On the 3rd round on the same problem the system stops itself — it is not
> allowed to try a 4th patch — and is forced to ask the bigger question, "is the whole
> approach wrong?" That is what should have happened at round 3 instead of round 8.

> **Intention (the binvoice/M87/M89 signature).** A debug/plan/verify loop producing
> variant-after-variant against the same failing thing IS the live signal that the PREMISE
> is wrong — not that the next patch will fix it. The system must HALT the patch path and
> re-examine the premise/approach, NOT dispatch another variant. The documented failure is
> "narrating the loop" ("I'll stop after this one") instead of stopping — so the halt must
> FIRE from a deterministic ledger, not the agent's prose. (Pairs with backlog #33.)

```text
inside any debug / plan / verify loop:
    after each cycle, append to a ledger keyed by COMPUTED symptom-signature
        (failing assertion / surface / file-class — computed, NOT the agent's label):
    if a fix closes signature A but opens signature B:  still counts as a loop cycle
        (variant-spawning IS the pathology)                          [RULE R-LOOP-1]
    if cycle-count for the same signature reaches N (= 3):
        → HARD-HALT the patch path. The agent MAY NOT dispatch another variant.   [RULE R-LOOP-2]
        → emit a PREMISE-RE-EXAMINATION directive: route to §2 (architectural hook)
          — research how others solved this class; re-examine the approach.        [RULE R-LOOP-3]
    # the halt is a ledger/exit-state fact, never satisfied by the agent SAYING it noticed.
```

> ⚠ **Honest limit:** "thrash ⇒ the premise is wrong" has zero published validation — so
> R-LOOP fires as a LOW-FALSE-POSITIVE ESCALATION (halt + re-examine), not a confident
> "the architecture is definitely wrong" verdict. Worst case of a false positive is one
> wasted re-examination — cheap, and the safe direction.

---

## 4. Fail-closed — uncertainty blocks, never silently proceeds

> **Real-world example.** In M89, a guessed fact about PayPal made it all the way to the
> final check without ever being verified. Under this rule: an unverified claim about an
> outside system reaching the final check makes that check fail — don't ship it. If the
> system was forced to stop and rethink but never actually did, it blocks — you can't just
> continue. And if it needs to look something up but the information isn't reachable, it
> stops and says so, instead of quietly proceeding on a guess.

> **Intention.** Whenever a basis can't be proven (research unavailable/inconclusive, the
> spike can't be built, the judge is uncertain), the system BLOCKS and surfaces the
> unproven premise. It never silently proceeds on a guess — that's the whole point.

```text
research required but unavailable/inconclusive   → BLOCK, surface the unproven premise   [RULE R-FAIL-1]
external factual claim uncited at verify         → verify FAILS                          [RULE R-FAIL-2]
loop halted (R-LOOP-2) but no re-examination ran → BLOCK (cannot proceed on the variant) [RULE R-FAIL-3]
```

---

## 5. Self-obedience — the milestone proves it on itself

> **Real-world example.** M89 assumed its own design would work — that assumption cost 8
> wasted rounds. This effort has to live by its own rule: the approach was researched and
> written down with sources before any building (done); this plain-language description is
> approved before any code is written (the step David just completed); and if building this
> very feature starts going in circles without stepping back, it fails its own test.

> **Intention (SC-SELF-OBEDIENCE).** M90's own build must show the doctrine applied to
> itself: discuss produced a SOURCED approach (done — citations), pseudocode is signed off
> before code (this doc), and any mid-build non-convergence (≥3 same-signature cycles)
> triggers a recorded premise re-examination, not a variant patch.

```text
M90 itself runs a >2-cycle variant loop without a recorded premise step-back  → SC FAILS   [RULE R-SELF-1]
```

---

## 6. Guard map — every [RULE]

> **Real-world example.** This isn't a behavior — it's a plain list of every rule above,
> one line each, so two things can happen at the end. The quality check confirms each rule
> is actually enforced (e.g. "prove the system really does stop itself on the 3rd round").
> And the adversarial reviewer gets the list as a menu of things to try to break ("can I
> trick it into treating a Slack question as if it were about our own code?"). Every rule
> is something to attack.

```text
[RULE R-FACT-1] regex asserts INTERNAL only on a concrete own-repo path (closed set)
[RULE R-FACT-2] not-confidently-internal → LLM judge → external/uncertain → research+cite
[RULE R-FACT-3] time-sensitive/external (libs/APIs/versions/"current best practice") → research regardless of confidence
[RULE R-FACT-4] external factual claim uncited → verify FAILS (M89 §7, kept)
[RULE R-ARCH-1] consistency-divergence over N fresh-context answers = trigger, runs EVERYWHERE (EXPERIMENTAL + MEASURED, unproven)
[RULE R-ARCH-2] time-sensitive/unfamiliar-external/extending-unverified-code → challenge unconditionally
[RULE R-ARCH-3] blind adversary names a flaw / better-known approach → STOP, research, re-examine premise
[RULE R-ARCH-4] executable spike (PREFERRED) fails → STOP + re-examine; passes → proven by reality not assumed
[RULE R-ARCH-5] spike genuinely infeasible → logged skip + blind adversary becomes MANDATORY (no self-exempt)
[RULE R-ARCH-6] adversary-only proof → premise marked "proven-by-adversary-only, NOT by reality", surfaced at verify
[RULE R-LOOP-1] a fix that opens a new signature still counts as a loop cycle (variant-spawning is the pathology)
[RULE R-LOOP-2] 3rd cycle on the same computed signature → HARD-HALT the patch path (ledger-enforced, not narrated)
[RULE R-LOOP-3] on halt → premise-re-examination directive → route to the architectural hook
[RULE R-FAIL-1] research unavailable/inconclusive → BLOCK, surface the unproven premise
[RULE R-FAIL-2] external claim uncited at verify → FAIL
[RULE R-FAIL-3] loop halted but no re-examination → BLOCK
[RULE R-SELF-1] M90's own build thrashing >2 cycles with no recorded premise step-back → SC fails
```

**Never introspect: no decision rests on the model self-reporting confidence. Detect by
deterministic trigger; respond by external adversary + reality; force research where
self-detection can't be trusted; fail closed on uncertainty. The model is checked by
something other than itself, every time.**

---

## DECISIONS (David, 2026-06-21 — resolved; this map is ready for sign-off)

1. **Architectural trigger runs EVERYWHERE** — every approach decision is challenged, not just the protocol class. (§2 trigger, R-ARCH-1/2.)
2. **Executable spike = PREFERRED, best-effort with a forced fallback** — spike when feasible (reality-check wins); if genuinely infeasible, the skip is a logged decision (no self-exempt), the blind adversary becomes MANDATORY, and the premise is flagged "proven-by-adversary-only, not by reality" + surfaced at verify. Never proceeds on nothing. (R-ARCH-4/5/6.)
3. **Loop threshold N=3** — keep GSD-T's existing ">2 cycles" rule. (R-LOOP-2.)
4. **Architectural trigger = ships EVERYWHERE, labeled EXPERIMENTAL + MEASURED** — runs always, but the contract flags it unproven and M90 instruments its fire-rate + catch-quality (did it catch a REAL bad approach?). If the data shows noise/uselessness, that's a measured finding to revisit, never a silent claim it works. The RESPONSE (blind adversary + spike, both proven) is the real gate; the trigger is a cheap "challenge by default" hint whose over-firing only costs more (proven) checks. (R-ARCH-1 caveat.)
5. **Extending existing code DOES fire §2** — "the existing extractor is fine, I'll just patch it" is itself an unproven approach (the binvoice trap); the adversary is explicitly asked whether the EXISTING code's approach is sound. (§2 trigger.)

**SIGN-OFF:** ✅ **APPROVED — David, 2026-06-22.** Behavior map signed off; M90 is partition-ready. (Real-world examples added per request; all 5 decisions folded in.)
