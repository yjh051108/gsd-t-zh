# Competition Mode Contract

**Status:** STABLE
**Version:** 2.0.0
**Introduced:** M82 (2026-06-05) · **M84 (2026-06-05): competition is now AUTOMATIC, not opt-in**

## M84 amendment — automatic, self-triggering competition

As of M84, Competition Mode is **automatic and default-on** for eligible phases — the workflow decides per-phase whether to compete; you do not pass a flag. Rationale (user directive + the cost logic): a better artifact produced upstream makes every downstream phase (pre-mortem, execute, verify) cheaper and more likely to pass first time, so the expected downstream savings usually exceed the ~3× upstream cost. Making it opt-in just means people forget to use the thing that lowers total cost.

**The decision (solution-space probe).** At the start of an eligible phase (after brief, before producing), the workflow runs a probe:
- **It runs on OPUS, not haiku.** Deciding "are there ≥2 genuinely different viable approaches?" is high-level reasoning, not a mechanical check — a weak probe forfeits the whole feature (it gates the 3× competition). `runSolutionSpaceProbe` (subjective phases) and `runPartitionProbe` (partition) both use `model: "opus"`.
- **It is BIASED TOWARD COMPETING.** When uncertain, or when even two plausibly-different approaches exist, it competes — the asymmetry favors generating options.
- **Probe failure → compete** (fail-toward-options).
- For **partition**, the opus probe makes the pre-produce compete/skip decision; the objective file-disjointness oracle still JUDGES the produced candidates (decision = heuristic + bias; selection = objective).

**When it fires:** 3 producers + judge (the research elbow). **Overrides** (rarely needed): `competition: N` (2–5) forces N; `competition: 0` or `noCompetition: true` forces off; unset = the workflow decides. Producer **angles are phase-aware** (`ANGLES_BY_PHASE`) so a discuss/milestone producer isn't handed a partition-framed directive.

The rest of this contract (judge, selection policy, artifact classes, invariants) is unchanged — only the *trigger* moved from opt-in to automatic.

---

## (original v1.0.0 — M82)

## Purpose

Competition Mode is the **generative dual** of the [Orthogonal Validation Contract](orthogonal-validation-contract.md). The triad is *adversarial* competition — many critics attack one candidate, and survivors are trusted (a filter). Competition Mode is *generative* competition — many candidates are produced in parallel, and a judge selects or synthesizes a winner (a generator).

GSD-T historically filters hard but **generates singly**: every upstream artifact (milestone decomposition, partition, design) is a single draft that then gets filtered. There is no "vs.", only "pass/fail". Competition Mode adds the missing generator on the phases where it pays.

**The watershed rule:** generate-and-judge **above** the contract; attack-and-filter **below** it. The contract is the dividing line. Competition Mode never runs on post-contract phases (execute / plan / verify / integrate / test-sync) — those are narrow-solution-space and already owned by the adversarial triad.

## Why the judge is the feature

Best-of-N *coverage* (fraction of problems solved by ≥1 of N samples) scales log-linearly with N (Brown et al., "Large Language Monkeys," arXiv 2407.21787, 2024 — SWE-bench Lite 15.9%@N=1 → 56%@N=250). **But coverage is an oracle-selection upper bound — the realized benefit is bounded by judge quality, not N.** A weak judge tripling spend to pick among 3 candidates buys nothing. Therefore this contract spends its rigor on the *judge*, not the fan-out.

## Eligibility

| Phase | Eligible? | Solution space | Blast radius |
|-------|-----------|----------------|--------------|
| **partition** | ✅ **v1 beachhead** | wide + objective oracle | plan→execute→integrate |
| **milestone** (decomposition) | ✅ | very wide | whole project |
| **discuss** (architecture) | ✅ | wide | whole milestone |
| **design-decompose** | ✅ | medium (ambiguous designs) | the screen set |
| plan / impact / prd / doc-ripple | ❌ | narrow / one right answer | local |
| execute / verify / integrate / test-sync | ❌ | one right answer | local — adversarial triad owns it |

A `competition: N` arg on an ineligible phase is **ignored** (a single producer runs, and the workflow logs that it was ignored). This is enforced in `templates/workflows/gsd-t-phase.workflow.js` (`COMPETITION_ELIGIBLE`).

## Producers — Self-MoA, not a model zoo

N candidate producers are **N samples of ONE strong model** (`opus`), differentiated by an explicit per-candidate **angle** (max-parallelism / simplicity / risk-isolation / dependency-depth / balance), NOT by using different models.

Rationale (Self-MoA / "Rethinking Mixture-of-Agents," arXiv 2502.00674, ICLR 2025; 3-vote verified): aggregation quality is **far more sensitive to candidate quality than to diversity** (regression coefficients quality ≫ diversity across MMLU/CRUX/MATH). Mixing diverse models injects low-quality candidates → a quality-diversity trade-off that degrades the result. Self-MoA beat Mixed-MoA by 6.6% on AlpacaEval, 3.8% avg. Diversity comes from the prompt angle, which keeps quality uniform.

- **N is clamped to [1, 5].** Default 1 (off). Recommended 3 — gains plateau fast (optimal N < 10; SWE-bench elbow ≈ N=5).
- Producers **propose only** — they write/commit nothing. The winning approach is committed once, by a single finalizer agent.
- **No debate.** Producers are independent; they never see each other's output. (Multi-agent debate does not reliably beat independent-sampling + judge at lower cost.)

## The judge

### Objective judge (partition) — a calculator, not a critic

Partition is the v1 beachhead because it is the **only** eligible phase with a built-in *objective* fitness function. Candidate partitions are scored by `bin/gsd-t-competition-judge.cjs --kind partition`, which runs each candidate's domains through the **same disjointness oracle** the real parallel dispatcher uses (`bin/gsd-t-file-disjointness.cjs`). This sidesteps every LLM-judge bias (position / verbosity / self-preference) because no LLM judges — it is arithmetic.

Metrics (higher better unless noted):
- `valid` — zero write-target overlaps across domains. **HARD gate: invalid candidates are disqualified and can never win.**
- `parallelGroups` — count of disjoint domains that fan out concurrently.
- `waveDepth` — serial gates (LOWER better).
- `unprovableCount` — domains with no declared touch list (LOWER better; safe-default sequential).

Ranking among valid candidates: `(parallelGroups desc, waveDepth asc, unprovableCount asc, domainCount asc)`.

Touch paths are normalized before overlap detection (`./a.js` ≡ `a.js`, collapsed `//`, backslashes → `/`, trailing slash dropped, intra-domain duplicates deduped) so path-spelling variants of the same file ARE caught as conflicts. **Case is preserved** (CI typically runs on case-sensitive Linux, where `App.js` and `app.js` are genuinely different files) — collapsing case would manufacture false conflicts on case-sensitive repos. If a real partition ever produces case-variant paths for the same file on a case-insensitive filesystem, that is a shared limitation of the underlying `gsd-t-file-disjointness.cjs` oracle the dispatcher also uses (Invariant 1 requires byte-identical reuse), not a judge regression.

### Subjective judge (milestone / discuss / design-decompose) — bias-controlled

Phases without an oracle use an LLM rubric judge with **all of these mandatory mitigations** (the judge is the feature, so these are not optional):

1. **Blind + shuffled** — candidates are presented with arbitrary labels (A/B/C), content only, no author identity → kills position/identity bias.
2. **Different-model judge** — the judge runs on a *different* model (`sonnet`) than the producers (`opus`) → attacks self-preference bias.
3. **Rubric-scored** — the judge scores each candidate 1-5 on explicit weighted axes (per phase), not a holistic "which is better" → reduces verbosity/halo bias.
4. **Deterministic finalization** — the numeric winner is chosen by `gsd-t competition-judge --kind generic` (highest weighted score; ties → lowest index in the score list the workflow submits — stable per run, so selection is reproducible and never random). Inference never decides the final pick alone (per `deterministic-orchestration`).

Rubric axes by phase live in `RUBRIC_AXES_BY_PHASE` in the workflow.

Optional escalation (not v1 default): a 3-judge panel + majority vote for the highest-altitude calls (milestone decomposition).

## Selection policy — the two-gate rule

The single most important rule for AVOIDING a "Frankenstein" (an incoherent graft worse than any single candidate). **Synthesize only when BOTH gates pass; otherwise pick-one:**

| Gate | Synthesize | Pick-one |
|------|-----------|----------|
| **Candidate quality uniform?** | yes → safe to merge | no → pick-one (or quality-gate the pool first) |
| **Artifact shape** | list / loosely-coupled | coupled thesis |

Evidence: synthesis beats pick-one on loosely-coupled free-form tasks (MoA 61.3% vs ranker 47.8%, AlpacaEval; arXiv 2406.04692; 3-0) — but "synthesis beats best" is **NOT unconditional** (the no-regressions claim was 3-0 refuted). The Frankenstein mechanism is candidate **quality variance**, not coupling per se.

### Three artifact classes

1. **Coupled thesis** (milestone strategy, architecture decision) → **pick-one**. Parts mutually justify each other; grafting destroys the thesis.
2. **Independent line-items** (risk registers, requirements, acceptance criteria, test cases) → **union / dedup**, never holistic regraft. Strictly additive, zero coherence risk.
3. **Structurally-validated** (partition) → **synthesize + re-validate**. The oracle re-checks coherence after any graft; on failure, fall back to the best valid pick-one.

### Operational rule (the finalizer's mandate)

For every eligible phase the finalizer does **pick-one at the thesis level, union at the embedded-list level**: implement the winning proposal whole (do NOT Frankenstein it), then fold in only the non-overlapping, clearly-good line-items from the losers that do not conflict with the winning structure. "Winner + salvage the orphaned good ideas." When in doubt, leave a salvage item out.

## Cost posture

- **Default OFF.** Opt-in per phase via `--competition N` on the eligible command files (`gsd-t-partition`, `gsd-t-milestone`, `gsd-t-discuss`, `gsd-t-design-build`/`design-decompose`).
- ~N× the wrapped phase's token spend. Justified ONLY pre-contract where blast radius is large. Build work is Max-funded (zero marginal $), but context window + wall-clock are real → N small, upstream-only.

## Composition with the orthogonal triad

The two are duals and **stack**: Competition Mode produces the best upstream artifact; the orthogonal triad still validates the downstream code. Competition Mode does **not** touch verify — verify is already the adversarial dual. Neither substitutes for the other.

## Implementation surface

- `bin/gsd-t-competition-judge.cjs` — the selection oracle (objective partition judge + deterministic generic rubric selector). Zero external deps, never throws, pure. Dispatched as `gsd-t competition-judge`.
- `bin/gsd-t-file-disjointness.cjs` — the partition oracle the judge reuses.
- `templates/workflows/gsd-t-phase.workflow.js` — the competition arm (`competition` arg → `parallel()` of N producers → judge stage → finalizer). Runtime-native (M71 lint).
- Command flags: `--competition N` on the eligible command files.

## Invariants (do not regress)

1. The partition judge MUST score via the same disjointness oracle as the dispatcher — never a bespoke re-implementation that could drift from real parallelizability.
2. Invalid (file-overlapping) partition candidates are NEVER selected.
3. Subjective judges MUST be blind + shuffled + different-model + rubric-scored.
4. The finalizer NEVER grafts a coupled thesis — pick-one at the thesis level, union only at the separable line-item level.
5. A `competition: N` arg on an ineligible phase is a no-op (single producer), logged — never an error, never silent escalation onto a post-contract phase.
6. The judge CLI performs zero LLM inference — it is deterministic arithmetic over scores the workflow supplies (inference stays in the producer/judge agents, never in the substrate).
