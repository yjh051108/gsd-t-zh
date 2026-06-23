# Design Brief: The Understand-Before-Build Reflex + the Pipeline's Missing Subtract Half

**Created:** 2026-06-22 18:00 PDT
**Author:** David (diagnosis + direction) / captured this session
**Status:** DESIGN BRIEF — pre-promotion. Not yet a milestone. Decide build timing against the live M87/M88 PseudoCode work (see §Coordination).
**Backlog slot:** #44
**Origin:** BinVoice pricing-migration session (2026-06-22) — four converging failures, one root cause.

---

## 0. The one-sentence thesis

> GSD-T is a pipeline of purely **additive** gates. Every gate's only operation is ADD (pre-mortem mints required tests, traceability requires a task per requirement, competition picks the richest proposal, Red Team adds hardening). It has **no subtract half** and **no understand-first half** — so when a plan starts at the wrong (too-high) altitude, every gate makes it *bigger*, and the harder GSD-T works the more complex the result. The fix inverts the paradigm: **understand what exists before planning, default to the smallest change that hits the crux, and make "we made it smaller" a first-class success — not an absence the verdict can't even express.**

The goal is three-dimensional and the dimensions are the *same event*: **simpler · faster · smarter.** BinVoice's 4 non-converging re-plan cycles were the over-complication, the time sink, and the intelligence failure all at once.

---

## 1. The evidence (BinVoice, 2026-06-22) — five data points, one principle each

All five are the **same shape at a different point in the data flow**: GSD-T edits *outward* at the consumers/symptoms when the crux is *one cut inward at the source*. "Three boards, not a new ship," expressed in code.

| # | What happened | The 1-line crux it missed | Principle |
|---|---|---|---|
| 1 | "Server owns classification" → planned to delete `src/classify`, make verdict optional, rethread persistence, rewire panel (5 domains, 36 files, 4 re-plans) | redirect **one** `fetch()` | **Assume-don't-look** — commit to a shape before grepping reality |
| 2 | Discovered an extension fallback that shouldn't exist → expanded scope to rip out ALL fallback machinery | stop calling it, **leave it**, capture cleanup for later | **Discovered-wart cleanup** — finding a wart is not a mandate to remove it *this* step |
| 3 | Regex price consumed in 3 places → chased & neutered each call site (N edits, N broken tests, spreading) | `parsedPrice = null` at the **source** — every consumer shows "pending" for free | **Starve-the-source** — change the 1 producer, not the N consumers |
| 4 | Built server pricing but **left the old extension wiring live** → user can't tell which source the price came from → can't test | starve the old source **when building the new path** | **Add-the-new-never-subtract-the-old** — the additive pipeline in its purest form |
| 5 | (the generative twin of #3) "value produced in N≥3 places" while *keeping* it | that multiplicity **is the rule-of-three firing** — a counted abstraction signal | **Multiplicity = abstraction trigger** — count, don't guess |

**The through-line:** edit **inward at the source**, not outward at the consumers. Almost always 1 file, not N.

---

## 2. Diagnosis — proven against the code, not asserted

Two audits this session (file:line grounded):

**A. The pipeline is BENDABLE-IN-PLACE, not baked-in (HIGH confidence).** A rewrite is NOT justified — and "rewrite the whole system because one philosophy is wrong" is itself failure #2 at maximum scale.
- The verify spine is **7 sequential `phase()`+`agent()` blocks**, data flowing via local return-envelopes, no shared mutable state (`gsd-t-verify.workflow.js:218-595`). Splicing a new stage is a **paste, not a refactor**.
- 51 command files are **genuinely thin** `Workflow({scriptPath, args})` invokers — zero gate logic.
- 73 contracts, **shallow coupling** (max 9 cross-refs, an aggregator; the rest 0–2).
- M90 *already proved* a new stage (the architectural trigger) inserts into that spine without a rewrite — it sits at `verify.workflow.js:352`.

**B. The deepest flaw is the verdict vocabulary itself.** `overallVerdict` is a frozen enum `VERIFIED | VERIFIED-WITH-WARNINGS | VERIFY-FAILED` (`verify.workflow.js:205`), and `VERIFIED` is a pure **AND of additive gates passing** (`:610`). **The schema literally cannot represent "we made the change smaller / removed code / chose the lighter altitude" as a success.** A net-negative diff has no positive token. This is the one structural place "more is better" is baked — but it is **one enum + one synthesis rule**, an edit-in-place fix.

**C. There is ZERO subtract/simplify stage in the pipeline today.** The only hits for simplify/prune/smallest-change are a non-gated prose string `"SIMPLICITY ABOVE ALL — minimal change"` (`gsd-t-quick.workflow.js:186`) and the delegated `/code-review` cleanup label. **The gap is an ABSENCE, not a wrong presence** — which is why the fix is insertion, not teardown.

---

## 3. What M90 already built — and what it's missing

M90 (the Unproven-Assumption Doctrine, shipped v4.7.10) is **most of the prevention machinery, with the response stubbed out**:

- **§2 R-ARCH-2 architectural trigger FIRES** on exactly the BinVoice moment: a task whose `**Touches**` lists an EXISTING file → "extend-class, this is an architectural assumption." **The BinVoice URL change touched existing files — this trigger would have fired.**
- **But its RESPONSE is interface-only.** Per the contract's own DECLARED SCOPE: "no live producer this milestone… R-FAIL-2 is a DECLARED interface-only no-op-PASS." The smoke alarm is installed and chirping; the sprinkler is a drawing on the wall. (`backlog #42` = the deferred live producer.)
- **§3 Loop Ledger IS wired** (debug cycle-2 boundary, symptom-keyed) — the non-convergence halt that catches the 8→7→5→9 whack-a-mole. This half works.

**M90's response was aimed one notch too high.** It made `spike` (write executable code to prove the approach) the PREFERRED response. BinVoice proves the response ladder should be **cheaper-first**:

1. **Look** (grep / graph blast-radius) — nearly free, kills most assumptions. *The missing rung.*
2. **Smallest change that hits the crux** — set the altitude ceiling.
3. **Spike** — only if 1+2 leave real uncertainty (M90's current default → demote to rare fallback).
4. **Defer-don't-inline** — discovered warts get captured, never cleaned inline.

---

## 4. The unifying mechanism — one graph query, two intent-lenses

The research (current, spring 2026 — see §6) and the BinVoice evidence converge on a single substrate: a **code graph answering "where is this value PRODUCED, and who CONSUMES it"** (one hop = blast radius).

Read through an **intent lens**, the same query serves both tracks:

| Intent | "produced in N places" means | Right move |
|---|---|---|
| **Eliminate** (failure #3) | N source points to starve | cut at the source/root — 1 file |
| **Keep but change** (failure #5) | N≥3 same-job producers = **rule-of-three, counted** | flag for consolidation (deferred), then 1 place to change |

This is the key unlock: **the graph automates the abstraction trigger the research said was unautomatable folklore.** "Produced in 3 places, same shape" is a deterministic, *countable* signal — not a judgment call. Premature-abstraction risk (Metz: "duplication is far cheaper than the wrong abstraction") drops because you abstract on *measured multiplicity*, not a hunch — and the **defer-don't-inline valve** means the signal is *surfaced and captured*, never executed inline during an unrelated change.

---

## 5. The fix — concentrated insertions, NOT a rewrite

Five moves. The audit proved each is insertion-into-a-modular-pipeline (~5 files each), not teardown.

1. **Front stage — Understand-before-plan.** Graph blast-radius ("produced where / consumed where / what breaks") → propose the **smallest-altitude** change that hits the crux. Gives M90's already-firing R-ARCH-2 trigger its missing **response** (the grep/graph-grounded ladder in §3).
2. **New Shrink/Defer stage** — the subtract half the pipeline has never had. After a step produces, re-read it: "did I miss an obvious simplification? edit inward not outward? source-cut vs consumer-chase?" Captures discovered warts for later (defer-don't-inline), never inlines them.
3. **Invert the default.** Milestone/quick framing prompts recommend the **smallest** option; ceremony (plan→execute, partition, competition) becomes **opt-in, justified by the crux** — not the default "Recommended." (BinVoice's GSD-T recommended the heaviest option every time; the user had to drag it down manually each turn — and in autonomous runs nothing drags it down.)
4. **Give M90's trigger its response** (the dormant interface at `verify.workflow.js:352`, backlog #42) — but with the **cheaper-first ladder** (look → smallest → spike → defer), not spike-first.
5. **Change the verdict vocabulary (the keystone).** Make "made it smaller / removed code / chose the lighter altitude / starved a redundant source / collapsed N producers" a **first-class success token**, not an absence. Without this, every other change is still graded by an all-additive rubric and the paradigm snaps back. One enum + one synthesis rule (`verify.workflow.js:205`, `:610`).

**Multiplicity→consolidation (failure #5)** rides move #1's graph as a *surfaced, deferred* signal (N≥3 same-job producers → backlog flag), governed by move #2's defer valve. It is NOT a new standing subsystem.

---

## 6. Research findings (current — spring 2026), labeled by strength

Full cited report in session history. Headlines:

- **Graph beats grep for blast-radius — PROVEN at scale (2026):** code-graph tooling is a "breakout category" (GitNexus, CodeGraph — two tools >40k stars, a $252M-funded vendor). Independent numbers on Opus 4.8 across 7 repos: **22% faster wall-clock, 58% fewer tool calls, 47–82× less context per question.** Answers "what breaks if I change this?" in ONE call vs. the agent chaining 10+ greps and reconstructing relationships by hand — **the exact step where the BinVoice wrong-assumption snuck in.**
- **Graph-based impact analysis cuts regressions — PROVEN (academic, small-N):** TDAD (arXiv 2603.17973) — feeding the agent the impact map *before* it patches cut regressions **70%** (6.08%→1.82%); a single blast-radius-blind patch had broken 322 tests. **This is the BinVoice re-plan-cycle killer, measured.** It also admits over-engineering itself first ("simplifying SKILL.md from 107→20 lines quadrupled resolution") — the disease, confirmed *in the research about curing it*.
- **Your doc-ripple freshness instinct is how the winners work — PROVEN:** CodeGraph auto-syncs via file-watcher+debounce (incremental, cheap), shows **staleness banners** ("⚠ read this directly") during sync windows instead of lying, and hash-reconciles on reconnect. The "confident liar" risk is solved conservatively.

**Three honesty flags (where we'd be INVENTING, not building on prior art):**
1. **Docs/memory in the graph has NO production precedent.** CodeGraph/GitNexus index *code structure only*. "One graph for code + docs + memory" is the **unproven climb** — defer it; ship **code-structure-first**.
2. **Value is scale-dependent.** Every source: "material only once a repo is large and tangled." Helps BinVoice-scale projects; helps GSD-T's own (small) codebase less.
3. **Static-analysis ceiling** — misses dynamic dispatch, monkey-patching, runtime. The graph is a powerful *first look*, not the whole truth; it reduces the reconstruction step, doesn't replace judgment.
4. **The "worth-it?" abstraction decision stays human/deferred** — the graph COUNTS multiplicity; it does not decide the collapse is correct (Metz's wrong-abstraction risk).

**Freshness architecture decision (open):** persistent kept-fresh graph (doc-ripple model, CodeGraph-style) vs. **build-on-demand slice** (parse touched files + callers fresh per planning step, nothing stored → no staleness). Leaning build-on-demand for the prevention reflex to avoid index-debt; reconsider for the consolidation track which wants whole-repo multiplicity counts.

---

## 7. Coordination with the live M87/M88 PseudoCode work (CRITICAL)

**Another GSD-T session is merging M87+M88 and building the PseudoCode milestone NOW.** This brief **builds on that work, does not collide with it** — but the file overlap is real and must be respected.

- **M87/M88 = intention-first pseudocode as milestone source-of-truth** (backlog #34/#35). PseudoCode is *exactly* the "clean logic flow where over-complication is visible" substrate this whole session kept landing on. **M87/M88 is the prevention reflex's natural home at the DEFINE altitude** (get the approach right in confirmed language before building). This brief is the prevention reflex at the **PLAN/EXECUTE altitude** (understand existing code + smallest change + subtract half) — the temporal complement.
- **Overlap risk:** both touch the front of the milestone/plan flow (`gsd-t-phase.workflow.js`, `VALID_PHASES`, the milestone framing prompts, the traceability gate, doc-ripple). **Do NOT start building this brief's moves while M87/M88 is mid-flight in those files.** Sequence after M87/M88 ships, then design this *on top of* the pseudocode flow (e.g. the "understand-before-plan" stage reads/produces the pseudocode's existing-code grounding; the subtract stage checks the pseudocode's `[RULE]` map didn't grow).
- **Move #3 (invert default) + #5 (verdict vocabulary)** are largely independent of M87/M88 and could go first if desired.

---

## 8. What is PROVEN vs. INVENTED (decision ledger)

| Element | Status |
|---|---|
| Pipeline is bendable-in-place (insertion not teardown) | **PROVEN** — this session's code audit, file:line |
| Verdict vocabulary can't express "smaller" | **PROVEN** — `verify.workflow.js:205,610` |
| M90 trigger fires on BinVoice moment but response is stubbed | **PROVEN** — M90 contract DECLARED SCOPE + backlog #42 |
| Graph blast-radius → faster + fewer regressions | **PROVEN (production + academic)** — §6 |
| doc-ripple-style freshness works | **PROVEN** — CodeGraph |
| Multiplicity (N≥3) as a counted abstraction trigger | **PLAUSIBLE, our synthesis** — graph counts it; collapse-worth-it stays deferred/human |
| One graph for code+docs+memory | **INVENTED — no precedent; defer; code-structure-first** |
| Build-on-demand vs persistent graph | **OPEN design decision** |
| The "worth-it?" collapse decision | **Deferred to human / dedicated step — never inline (Metz guardrail)** |

---

## 9. Memory links

[[feedback_unproven_assumption_stop_and_research]] · [[feedback_no_confabulated_examples]] · [[feedback_coverage_check_structural_not_substring]] (non-convergence = design defect, halt) · [[feedback_debug_loop_must_halt_not_narrate]] · [[feedback_intention_first_pseudocode]] (M87/M88) · [[feedback_no_silent_degradation]] (skip is logged, never silent) · [[feedback_dont_keep_spawning_milestones]] (localized fixes stay hands-on)
