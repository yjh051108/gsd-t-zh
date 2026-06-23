# M90 — Sourced Approach (DISCUSS output, research-gated)

**Date:** 2026-06-21 16:29 PDT
**Milestone:** M90 — The Unproven-Assumption Doctrine
**Status:** APPROACH LOCKED (user-approved 2026-06-21) — satisfies SC-RESEARCH-GATE (≥1 external citation per detection mechanism). Plan is now permitted after intention-first PseudoCode sign-off.
**Method:** the milestone obeyed its own doctrine — researched how others solve this BEFORE choosing an approach (parallel deep-research, sources below), surfaced candidate mechanisms, user steered convergence mid-way.

---

## The decisive research finding (reframes the whole design)

**You cannot rely on the model knowing it is guessing.** Self-introspection — verbalized confidence, self-critique, "is this approach sound?" — is documented to be unreliable, and *worse* on the exact models we run:

- Verbalized self-confidence ≈ coin-flip (AUROC 0.52–0.60), worst on specialized knowledge — https://arxiv.org/abs/2306.13063
- RLHF (deployed models) makes calibration ~10× WORSE (ECE 0.007→0.074) — https://arxiv.org/abs/2303.08774
- Sycophancy: asking "is this sound?" is the worst-case prompt — https://arxiv.org/abs/2310.13548
- "LLMs Cannot Self-Correct Reasoning Yet" — intrinsic self-critique degrades quality; prior gains came from an ORACLE label, not the model — https://arxiv.org/abs/2310.01798
- Plan self-critique specifically fails (the closest analog to "is my approach right?") — external verifier works, self-critique lowers quality — https://arxiv.org/abs/2310.08118

**This root-causes the entire binvoice + M87 + M89 saga:** every failed approach assumed the agent could introspect its own correctness. The M89 hardcoded-vendor-list was the same anti-pattern (enumerate an open set); the field's documented response is to replace enumeration with intrinsic signals — https://arxiv.org/abs/2212.10511

## The architecture (LOCKED): **externalize + force, never introspect**

The model never grades its own assumption. A deterministic TRIGGER fires an EXTERNAL check (a blind adversary and/or reality), and research is FORCED by protocol for the class that can't be self-detected.

| Layer | Mechanism | Source(s) |
|---|---|---|
| **TRIGGER (deterministic)** | (a) consistency-divergence sampling — sample N plans/solutions; divergence ⇒ a load-bearing unproven assumption exists; (b) non-convergence loop-detection — N variant fixes on the same computed symptom-signature ⇒ thrash | ClarifyGPT https://arxiv.org/pdf/2310.10996 (70.96→80.80% Pass@1) ; SWE-Search low-reward abandonment https://arxiv.org/abs/2410.20285 |
| **RESPONSE — blind adversary** | a separate-context/model critic told "find the fatal flaw in someone ELSE's design" — escapes self-preference bias the author can't escape | Kambhampati (external verifier works) https://arxiv.org/abs/2310.08118 ; self-preference bias https://arxiv.org/abs/2404.13076 |
| **RESPONSE — executable spike** | the premise is checked by BUILDING a thin thing and RUNNING it (tool-grounded, not introspective) — the M87 risk-first "prove R1 before scaffolding" pattern, generalized | CRITIC tool-grounding https://arxiv.org/abs/2305.11738 |
| **FORCE — protocol research gate** | for time-sensitive / external-approach questions, research is mandatory by PROTOCOL, NOT confidence-gated (the target failure is *confident* wrongness, so a confidence gate can't catch it) | CoVe always-verify https://arxiv.org/abs/2309.11495 |
| **FACTUAL knowledge-boundary** | replace the M89 vendor-list with an INTRINSIC self-knowledge gate (recognition, not enumeration) for facts; PAIR with a time-anchored protocol rule (fast-moving libs/APIs/"current best practice" → research regardless of confidence — intrinsic signals collapse to chance on the temporal axis) | SKR https://arxiv.org/abs/2310.05002 ; Self-RAG https://arxiv.org/abs/2310.11511 ; temporal-collapse https://arxiv.org/html/2510.19172v1 |

**Validates GSD-T's existing bones:** the literature's strongest positive signal is *orthogonal separation of context/model* — exactly what M83 pre-mortem + Red-Team-on-fable already do. M90 EXTENDS those (adds the trigger + the executable-spike + the architectural-assumption framing), it does not invent new introspection.

## Honest limits (the research does NOT support these — flagged per the doctrine)

- **Self-reported confidence as a detector — unsupported.** Any design gating on "the model flags its own unproven assumption" is re-scoped DOWN. (This is why the architecture is trigger+external, not self-tagging.)
- **"Thrashing ⇒ the architectural premise is wrong" — zero published validation.** Sound engineering inference; build it as a LOW-FALSE-POSITIVE-COST escalation (loop → replan/escalate), NOT a confident "the architecture is wrong" classifier. (GSD-T's existing ">2 cycles = halt" is ahead of the published SOTA — keep it, but as an escalation trigger.)
- **Architectural-assumption DETECTION has no proven precedent** — only the blind-review + spike RESPONSE is supported. So detection = the deterministic triggers above (divergence, non-convergence, protocol-class), explicitly best-effort; the milestone's value is the reliable RESPONSE once triggered, plus forcing research where self-detection can't be trusted.

## Scope split (the DISCUSS output — was deliberately open at definition)

Settled by the research: the well-supported parts ship; the unproven part ships as the *response*, not as a claimed detector.

- **IN (research-backed, this milestone):**
  1. **Factual slice** — M89 redesigned: delete the vendor list; intrinsic self-knowledge gate + regex-knows-only-own-repo-paths + LLM-judges-the-rest + the time-anchored protocol rule; keep the §7 fail-closed cite gate. (Absorbs `auto-research-contract.md` v1.3.3.)
  2. **Non-convergence → replan escalation** — loop-detection on computed symptom-signature → HALT patch path → premise-re-examination directive (fires, not narrates — pairs with backlog #33). The SC-LOOP-HOOK-FIRES criterion.
  3. **Protocol research-gate** at plan-time for the time-sensitive/external-approach class (unconditional, not confidence-gated).
  4. **Blind-adversary + executable-spike RESPONSE** wired as the premise-re-examination action (extends M83 pre-mortem + Red-Team-on-fable; the spike generalizes M87 risk-first).
- **EXPERIMENTAL / best-effort (flagged unproven in-contract):** the architectural-assumption DETECTION trigger (consistency-divergence sampling). Ships as a real mechanism but documented as the one piece without published validation — measured, not claimed.
- **OUT (separate):** Red Team Realism gate (#39 — complementary, its own milestone).

## Ranked shortlist (for the record)
1. Orthogonal adversarial plan-review (separate model/context) + executable spike — the only positive path for architectural premises. https://arxiv.org/abs/2310.08118 + https://arxiv.org/abs/2305.11738
2. Consistency-sampling as the deterministic trigger. https://arxiv.org/pdf/2310.10996
3. Non-convergence → replan escalation. https://arxiv.org/abs/2410.20285
4. Protocol (not confidence-gated) research step. https://arxiv.org/abs/2309.11495

## Next
Intention-first PseudoCode behavior-map (M87 pattern; zero code until signed off) → then partition. The pseudocode locks the trigger thresholds, the blind-review/spike protocol, the intrinsic-gate + time-anchored rule, and the §7 fail-closed gate as the FACTUAL carry-over.
