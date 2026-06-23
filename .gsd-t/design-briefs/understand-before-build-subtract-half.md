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

## 0.5. Review addendum (2026-06-23, fresh-session review of the research transcript)

> **Provenance:** this section was added after a fresh session re-read the full research conversation (`e7bbfd5f`, 2026-06-22) that produced this brief — not just the brief's conclusions. The brief is a *faithful but compressed* summary of a much richer reasoning arc; compression cost three insights the transcript shows were load-bearing. Restoring them here. (The two cited code anchors — `verify.workflow.js` verdict enum + the `VERIFIED = AND-of-gates` synthesis — were re-verified against the live tree post-M91 and still hold; line numbers shifted ~+15 from M91's guard-map insertion.)

**The conversation is itself the proof.** The session converged ONLY because the user repeatedly dragged the altitude down (turns 6/9/13/20). Twice the assistant climbed (propose a "Minimality Gate" → propose a "GraphRAG layer") and twice caught itself mid-climb — *"answer 'this is an architectural flaw' by proposing four new gates is the disease, not the cure"* / *"this is the premature-abstraction trap from the research, applied to our own design decision."* That propose-big → step-back → find-the-crux → shrink loop **is the exact reflex this brief installs, demonstrated on the design of the fix itself.** Keep it as evidence — it is the most honest data point in the file.

**Three restorations (each was sharper in the transcript than in the brief above):**

1. **The reflex already exists as SHIPPED CODE inside M90 — reuse it, don't invent a new ladder (smaller fix).** ⚠ *Correction (2026-06-23): the transcript called this "M89's pipeline," but **M89 was RETIRED into M90** (2026-06-22, see `.gsd-t/milestones/m89-RETIRED-absorbed-into-m90-*/RETIREMENT.md`). There is NO standing M89 — its factual-classifier slice became M90's §1, redesigned. The accurate framing is below.* The "look before you assert" machinery is **`bin/gsd-t-research-gate.cjs` — M90's §1 factual classifier — SHIPPED and wired into 5 workflows** (`classify → grep-internal / research-external → cite`). It already fires autonomously, deterministically. **But M90 shipped its TWO mechanisms unevenly:** §1 (FACTUAL "is this claim about existing code true?") has a working classify→ground response; **§2 (R-ARCH-2 ARCHITECTURAL "are you about to commit to a scope/approach assumption?") fires on exactly the BinVoice moment but its RESPONSE is interface-only — no live producer (backlog #42).** So the prevention reflex is NOT new machinery and NOT a resurrection — it is **giving M90's §2 architectural trigger the SAME treatment its sibling §1 already got: a working classify→grep-what-exists→ground response, modeled on the shipped `research-gate.cjs` pipeline.** One M90 mechanism is done; build its stubbed twin. That is the three-boards version of move #1/#4.

2. **"Faster" is load-bearing and the brief drops it after §0.** The user escalated to a THREE-axis goal (simpler·faster·smarter) with the unifier *"the regressions ARE the slowness ARE the complexity"* — milestones "take forever now." Faster is the most MEASURABLE axis and the strongest cost-justification. The TDAD 70%-fewer-regressions number is a SPEED claim in disguise (fewer re-plan cycles = less wall-clock). The headline for promoting this work is **"kills the BinVoice 4-cycle re-plan spiral,"** not "makes plans smaller" — name and operationalize the faster axis (re-plan-cycle count, wall-clock-to-VERIFIED) as a success metric, not just a side effect.

3. **The shrink is a per-phase BEAT, not one front stage (the stronger design got flattened).** The transcript's actual design (Pascal frame, Assistant 7): **two beats EVERY phase — a *before* (crux/altitude) and an *after* (shrink-what-I-just-built), where the after-beat is "the entire missing half."** Move #2 above captures the after-beat as a single Shrink/Defer stage at the front — but BinVoice inflated ACROSS re-plan cycles, not only at step 0, so a single front stage still lets each downstream phase re-inflate. The durable design is *every phase ends by trying to shrink what it produced and passes forward only what survived* — the letter gets shorter at every step, not just once.

**Two decisions the brief leaves "open" that the transcript already closed:**
- **Graph freshness:** the user/assistant converged on **build-the-slice-on-demand** (parse touched files + callers fresh per planning step, store nothing → no index-debt/staleness), scoped to the prevention reflex first. Reconsider a persistent graph ONLY if the consolidation track later proves it needs whole-repo multiplicity counts. This is a decision, not an open question (§6 "freshness architecture decision (open)" → CLOSED for prevention).
- **Scope split (review recommendation):** promote as TWO milestones, M87→M88-style. **#44a (paradigm, no graph):** the scope-assumption reflex (before-beat — built by giving M90's stubbed §2 trigger the same response its shipped §1 `research-gate.cjs` already has, see point 1 above) + verdict vocabulary with a DETERMINISTIC shrink-metric (net LOC / file-count / removed-vs-added from a `git diff --stat` envelope — per [[feedback_measure_dont_claim]], not an LLM self-attesting "simpler") + invert-the-default (#3/#5 + the §2-response reflex; ~10 files, extends shipped machinery, low M91 overlap). **#44b (graph):** understand-before-plan stage + shrink/defer beat + the consolidation N≥3 lens, build-on-demand, GATED on #44a moving the needle. The graph is where scope and risk concentrate and its payoff is scale-dependent (§6 flag) — do not bundle it into the cheap, high-leverage paradigm half.

### Why grep-first-then-graph is a sequence, not a choice — and not throwaway work

The #44a/#44b split is **NOT** "grep vs. graph, pick one." Both implement the **same reflex** — *classify the scope-claim → ground it in reality → don't act on the assumption.* Whether "ground it" means a grep or a graph query is an **implementation detail of the sensor inside that reflex.** So:

- **#44a builds the reflex** with a grep-grounded sensor (reusing M90's shipped §1 pipeline). grep gets the cheap ~80%: it would have caught BinVoice failure #1 (assume-don't-look — grep finds `src/classify` → "this is one redirect, don't delete the module") and the discovered-wart trap.
- **#44b swaps a better sensor into the reflex #44a already built** — graph makes *relationships* (call edges, data flow) the first-class answer instead of something you reconstruct from grep hits by hand. It is NOT a new reflex; it is a sensor upgrade plus a new use-case the better sensor unlocks (consolidation).

Where grep is genuinely too weak (so the graph earns its keep, not before):
- **"Starve-the-source" (failure #3):** grep finds the 3 call sites but you still must REASON "is the upstream root safe to null?" — a relationship question. The graph shows "produced here, consumed there, nothing else depends" in one hop.
- **N≥3 consolidation (failure #5):** grep can count occurrences but **cannot** confirm "same *job*, different code." That is the graph's whole point — grep structurally can't do it.

The gate (#44b waits on #44a) isn't doubt about the graph — it's the brief's own discipline applied to itself: **prove the cheap fix works before adding the dependency.** If #44a alone kills the re-plan spiral, the graph's marginal value is mostly the (separate, later) consolidation track. If #44a's grep-grounding proves too relationship-blind on the starve-the-source cases, *that* is the evidence the graph is needed for prevention too — and #44b gets built with proof in hand.

### ⚠ PRIOR-ART AUTOPSY — GSD-T already built a code graph (M20–M21) and it DIED. Read this before promoting #44b.

This is the single most important unproven-assumption check on #44b, and it nearly got missed: **GSD-T shipped a full code-graph engine in M20–M21 (v2.38–2.39, March 2026) and it is now dead.** Grounded in the record (not memory):

**What was built:** 6 `bin/graph-*.js` files (`graph-store/parsers/overlay/indexer/query/cgc`), a **3-tier provider chain (CGC→native-indexer→grep)**, `graph index/status/query` CLI, 4 contracts, 70 tests, and **21 commands rewired to query it.** Premium tier = **CGC backed by Neo4j in Docker** (`docs/neo4j-setup.md`).

**It was never deliberately removed — it ROTTED and was abandoned.** The `bin/graph-*.js` code is STILL in the tree (untouched since 2026-04-17); `gsd-t graph status` today returns *"No graph index found"* — orphaned, ~3 months dormant, the 21 commands' graph paths silently fall through to grep. (The 2026-06-22 deletion was only the stale *domain dirs* in the 77-dir prune — bookkeeping, not a decision.)

**Cause of death (from the CHANGELOG + the live-era comparison doc, in GSD-T's own words):**
- **Maintenance firefighting on an external dependency:** "CGC 0.3.1 Windows bug workaround," "PYTHONIOENCODING to prevent crash on emoji," "CGC sync retries with --force on failure," backlog items "#8 Auto-Setup Graph Dependencies" + "#9 Provider Failure Warnings + Auto-Recovery." Neo4j + Docker + CGC + a Python toolchain = constant Windows/encoding/sync breakage.
- **Marginal value, by GSD-T's own measurement** (`.gsd-t/scan/graph-vs-grep-comparison.md`, 2026-03-19, written when it was LIVE): *"The graph does NOT replace grep... most findings come from reading code and comparing to contracts. The graph adds a verification layer."* Net new findings over grep-only: **5 — and several were bugs IN the graph engine itself** (worktree contamination, complexity-data gap, absolute-path contract violation).
- **Verdict:** marginal value ÷ heavy maintenance = abandoned. The maximalist altitude (persistent, dependency-heavy, always-on, value-unproven) — the exact trap this brief is about, committed once already.

**How #44b's design inverts each cause of death (this is WHY it's different, not a repeat):**

| M20/M21 (died of) | #44b (built to avoid it) |
|---|---|
| Persistent index kept in sync every command boundary → staleness + sync-firefighting | **Build-on-demand slice** — parse touched files + callers fresh per planning step, store NOTHING. No index, no sync, no staleness. |
| External deps (Neo4j/Docker/CGC/Python) → Windows bugs, encoding crashes, auto-setup backlog | **Zero-dep, in-process** (installer invariant). No daemon, no container. |
| Always-on engine wired into 21 commands, value diffuse | **One narrow job** — blast-radius for the prevention reflex (+ N≥3 for consolidation), only where graph beats grep (relationships, not strings). |
| Built first, justified later (comparison written AFTER shipping found it marginal) | **GATED on #44a** — prove the grep-grounded reflex works first; the comparison doc IS the prior. |

**Salvage opportunity (the consolidation move the brief itself preaches):** `bin/graph-parsers.js` (entity/relationship extraction) + `graph-query.js`'s query logic ALREADY EXIST and are tested. #44b's build-on-demand slice can **reuse the parser and DELETE the storage/provider/sync layer that was the actual cause of death** — reuse the one good part, throw away the heavy parts. This makes #44b cheaper than greenfield AND is itself an instance of "starve the source / reuse-don't-rebuild." (Verify the parser still runs + is zero-dep before relying on it — it predates several conventions; don't assume.)

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

> **Read with §0.5 (review addendum).** Two corrections to the five moves below: (a) move #1/#4's "response" should reuse the **shipped `research-gate.cjs` classify→grep→ground pipeline (M90's §1 factual classifier)** — give M90's stubbed §2 ARCHITECTURAL trigger the same treatment its FACTUAL sibling already got — not invent a new ladder (M89 does NOT exist standalone; it was retired into M90); (b) move #2's shrink is a **per-phase beat** (every phase ends by shrinking), not a single front stage. And the moves split into **#44a (paradigm: #3 + #5 + the scope-reflex on M90's shipped §1 pipeline, no graph)** and **#44b (graph: #1 + #2 + N≥3 lens, build-on-demand, gated on #44a)**.

Five moves. The audit proved each is insertion-into-a-modular-pipeline (~5 files each), not teardown.

1. **Front stage — Understand-before-plan.** Graph blast-radius ("produced where / consumed where / what breaks") → propose the **smallest-altitude** change that hits the crux. Gives M90's already-firing R-ARCH-2 trigger its missing **response** (the grep/graph-grounded ladder in §3).
2. **New Shrink/Defer stage** — the subtract half the pipeline has never had. After a step produces, re-read it: "did I miss an obvious simplification? edit inward not outward? source-cut vs consumer-chase?" Captures discovered warts for later (defer-don't-inline), never inlines them.
3. **Invert the default.** Milestone/quick framing prompts recommend the **smallest** option; ceremony (plan→execute, partition, competition) becomes **opt-in, justified by the crux** — not the default "Recommended." (BinVoice's GSD-T recommended the heaviest option every time; the user had to drag it down manually each turn — and in autonomous runs nothing drags it down.)
4. **Give M90's trigger its response** (the dormant interface at `verify.workflow.js:352`, backlog #42) — but with the **cheaper-first ladder** (look → smallest → spike → defer), not spike-first.
5. **Change the verdict vocabulary (the keystone).** Make "made it smaller / removed code / chose the lighter altitude / starved a redundant source / collapsed N producers" a **first-class success token**, not an absence. Without this, every other change is still graded by an all-additive rubric and the paradigm snaps back. One enum + one synthesis rule (`verify.workflow.js:205`, `:610`).

**Multiplicity→consolidation (failure #5)** rides move #1's graph as a *surfaced, deferred* signal (N≥3 same-job producers → backlog flag), governed by move #2's defer valve. It is NOT a new standing subsystem.

---

## 6. Research findings (current — spring 2026), labeled by strength

> ⚠ **Read §0.5's PRIOR-ART AUTOPSY first.** This external research (graphs help) must be weighed against GSD-T's OWN prior attempt: M20–M21 shipped a code graph and it DIED of maintenance burden + marginal measured value. The external numbers below are real, but GSD-T's internal `graph-vs-grep-comparison.md` (2026-03-19, live-era) found only 5 net new findings over grep — so the design constraint (build-on-demand, zero-dep, narrow, gated) is what makes the external promise reachable HERE.

Full cited report in session history. Headlines:

- **Graph beats grep for blast-radius — PROVEN at scale (2026):** code-graph tooling is a "breakout category" (GitNexus, CodeGraph — two tools >40k stars, a $252M-funded vendor). Independent numbers on Opus 4.8 across 7 repos: **22% faster wall-clock, 58% fewer tool calls, 47–82× less context per question.** Answers "what breaks if I change this?" in ONE call vs. the agent chaining 10+ greps and reconstructing relationships by hand — **the exact step where the BinVoice wrong-assumption snuck in.**
- **Graph-based impact analysis cuts regressions — PROVEN (academic, small-N):** TDAD (arXiv 2603.17973) — feeding the agent the impact map *before* it patches cut regressions **70%** (6.08%→1.82%); a single blast-radius-blind patch had broken 322 tests. **This is the BinVoice re-plan-cycle killer, measured.** It also admits over-engineering itself first ("simplifying SKILL.md from 107→20 lines quadrupled resolution") — the disease, confirmed *in the research about curing it*.
- **Your doc-ripple freshness instinct is how the winners work — PROVEN:** CodeGraph auto-syncs via file-watcher+debounce (incremental, cheap), shows **staleness banners** ("⚠ read this directly") during sync windows instead of lying, and hash-reconciles on reconnect. The "confident liar" risk is solved conservatively.

**Three honesty flags (where we'd be INVENTING, not building on prior art):**
1. **Docs/memory in the graph has NO production precedent.** CodeGraph/GitNexus index *code structure only*. "One graph for code + docs + memory" is the **unproven climb** — defer it; ship **code-structure-first**.
2. **Value is scale-dependent.** Every source: "material only once a repo is large and tangled." Helps BinVoice-scale projects; helps GSD-T's own (small) codebase less.
3. **Static-analysis ceiling** — misses dynamic dispatch, monkey-patching, runtime. The graph is a powerful *first look*, not the whole truth; it reduces the reconstruction step, doesn't replace judgment.
4. **The "worth-it?" abstraction decision stays human/deferred** — the graph COUNTS multiplicity; it does not decide the collapse is correct (Metz's wrong-abstraction risk).

**Freshness architecture decision (~~open~~ → CLOSED for prevention per §0.5):** persistent kept-fresh graph (doc-ripple model, CodeGraph-style) vs. **build-on-demand slice** (parse touched files + callers fresh per planning step, nothing stored → no staleness). **Decided: build-on-demand** for the prevention reflex (avoids index-debt/staleness); reconsider a persistent graph ONLY if the consolidation track later proves it needs whole-repo multiplicity counts.

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
| M90 §2 ARCHITECTURAL trigger fires on BinVoice moment but response is stubbed; M90 §1 FACTUAL classifier (`research-gate.cjs`) IS shipped+wired (the response pattern to clone) | **PROVEN** — M90 contract DECLARED SCOPE + backlog #42; M89 RETIRED into M90 (no standalone M89) |
| Graph blast-radius → faster + fewer regressions (EXTERNAL tools) | **PROVEN (production + academic)** — §6 — but see next row |
| **GSD-T's OWN prior graph (M20–M21) died of maintenance burden + marginal measured value** | **PROVEN (internal autopsy, §0.5)** — `graph-vs-grep-comparison.md` (5 net findings, live-era); CHANGELOG firefighting; engine orphaned, `gsd-t graph status` = no index |
| doc-ripple-style freshness works (external) — but a kept-fresh index is the SAME class that rotted in M20/M21 | **PROVEN external / CAUTION internal** — #44b avoids it via build-on-demand (no index to keep fresh) |
| Multiplicity (N≥3) as a counted abstraction trigger | **PLAUSIBLE, our synthesis** — graph counts it; collapse-worth-it stays deferred/human |
| One graph for code+docs+memory | **INVENTED — no precedent; defer; code-structure-first** |
| Build-on-demand vs persistent graph | **DECIDED — build-on-demand** (§0.5; persistent is what died in M20/M21) |
| Salvage `graph-parsers.js` + `graph-query.js` logic, drop storage/provider/sync layer | **PLAUSIBLE — verify parser still runs + zero-dep before relying (predates conventions)** |
| The "worth-it?" collapse decision | **Deferred to human / dedicated step — never inline (Metz guardrail)** |

---

## 9. Memory links

[[feedback_unproven_assumption_stop_and_research]] · [[feedback_no_confabulated_examples]] · [[feedback_coverage_check_structural_not_substring]] (non-convergence = design defect, halt) · [[feedback_debug_loop_must_halt_not_narrate]] · [[feedback_intention_first_pseudocode]] (M87/M88) · [[feedback_no_silent_degradation]] (skip is logged, never silent) · [[feedback_dont_keep_spawning_milestones]] (localized fixes stay hands-on)
