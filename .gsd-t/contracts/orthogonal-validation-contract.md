# Orthogonal Validation Contract

**Status:** STABLE
**Version:** 1.0.0
**Introduced:** M61 D7-T1 (2026-05-29)

## Purpose

Three validation passes run in every GSD-T verify phase: `/code-review ultra`, Red Team, and QA. This contract declares them **orthogonal objective functions** so future Claude (or future humans) do not collapse them, substitute one for another, or skip one because "the other one will catch it." None of them substitutes for either of the others.

The risk this contract prevents: a single review pass passes, and somebody concludes verification is done. M58 shipped this way — its in-context Red Team claimed "6/6 defended" but a fresh-context adversarial Workflow Red Team found a live CRITICAL the in-context pass had rationalized away (M60). The fix is structural: declare the categories distinct, give each a different success criterion, and require all three to clear before VERIFIED.

## The Three Objective Functions

| Pass                      | Objective                                            | Success criterion                                                          | Stance      |
|---------------------------|------------------------------------------------------|----------------------------------------------------------------------------|-------------|
| **`/code-review ultra`**  | Correctness + cleanup of the build                   | No "important" severity findings remain                                    | Cooperative |
| **Red Team**              | Adversarial / security / boundary failures           | GRUDGING-PASS (exhaustive search, zero CRITICAL or HIGH bugs found)        | Adversarial |
| **QA**                    | Test mechanics + contract compliance                 | Suite passes; no shallow tests; contract-compliance violations zero        | Mechanical  |

### `/code-review ultra` — cooperative correctness + cleanup

- Native `/code-review ultra` invocation (or its in-Workflow equivalent).
- Scope: bugs that any competent reviewer would flag, plus cleanup/simplification/efficiency findings.
- Severity vocabulary: `important` (must-fix), `nit` (style/clarity), `pre-existing` (out of milestone scope).
- It assumes the implementer is acting in good faith and asks "is the code right?"
- It does NOT exhaustively probe for security or boundary attacks — Red Team's job.
- It does NOT verify the test suite ran or that the tests are functional — QA's job.

### Red Team — adversarial security + boundaries

- Workflow stage (or external) running the protocol at `templates/prompts/red-team-subagent.md`.
- Scope: deliberately try to break the code. Memory says "success is measured by bugs found, not tests passed."
- Severity vocabulary: `CRITICAL` (data loss / RCE / privacy leak), `HIGH` (security impact, exploitable), `MEDIUM`, `LOW`.
- Verdict: `FAIL` (any CRITICAL or HIGH found — blocks completion) or `GRUDGING-PASS` (exhaustive search, nothing found).
- Lens-diverse on Opus: defense-in-depth, SQL-injection, path-traversal, prototype-pollution, etc. — at minimum 3 lenses per pass.
- It DOES NOT find readability nits or test-mechanics issues — that's the other two.

### QA — test mechanics + contract compliance

- Workflow stage running the protocol at `templates/prompts/qa-subagent.md`.
- Scope:
  - Run the test suite (unit + integration + E2E if config exists). Report `{pass, fail, skipped}`.
  - Detect shallow tests — assertions that would pass on an empty HTML page with correct IDs.
  - Verify every contract in `.gsd-t/contracts/` is honored by the actual code on disk.
- It does NOT find new bugs by reading code adversarially — Red Team's job.
- It does NOT rate cleanup opportunities — `/code-review ultra`'s job.

## Distinctness Rules (the core contract)

These rules MUST hold at all times. A violation is a contract violation, same weight as a broken API contract.

1. **No collapse**: a stage's output may NEVER be re-categorized into another stage's vocabulary. A Red Team CRITICAL is not a `/code-review ultra` "important." A QA shallow-test is not a Red Team bug. The verify synthesis stage merges results but preserves category labels.

2. **No substitution**: only `/code-review ultra` is skippable, and only via an explicit `skipUltra: true` arg with a recorded `skipUltraReason: string`. Red Team and QA are **non-skippable** — there is no `skipRedTeam` or `skipQa` arg, and any attempt to add one is a contract violation. Rationale: `/code-review ultra` may be rate-limited or unavailable on certain plans; Red Team and QA can always run locally. A run with `skipUltra: true` cannot achieve `VERIFIED` — the best attainable verdict is `VERIFIED-WITH-WARNINGS` with a note recording that the cooperative pass was skipped. (4.8-audit fix: prevents the substitution-by-elision pathway where omitting a stage masquerades as passing it.)

3. **No transitive trust**: passing one stage does not raise confidence that another stage will pass. The stages are independent — the joint probability of all three passing on broken code is much lower than any single stage's pass rate.

4. **Schema enforcement**: each stage's output is schema-validated at the Workflow runtime layer. A stage that returns a malformed envelope is treated as a stage failure, not a passing result.

5. **Brief threading**: every stage receives the M55-D2 context-brief path (`$BRIEF_PATH`) and is instructed to grep it before re-walking the repo. This is shared infrastructure, not a per-stage convention.

## Verdict Computation

Verify produces one of three overall verdicts:

| Verdict                     | All three stages must satisfy                                                                                |
|-----------------------------|--------------------------------------------------------------------------------------------------------------|
| `VERIFIED`                  | Red Team = GRUDGING-PASS, QA suite = green + zero shallow tests + contracts compliant, `/code-review ultra` ran AND has no "important" findings. `skipUltra=true` is INELIGIBLE for `VERIFIED`. |
| `VERIFIED-WITH-WARNINGS`    | Red Team = GRUDGING-PASS, QA suite green + contracts compliant, AND any of: (a) `/code-review ultra` has "important" findings, (b) `skipUltra=true` (with recorded reason), (c) QA shallow tests = 1 (single, non-core path). Two or more shallow tests = VERIFY-FAILED. |
| `VERIFY-FAILED`             | Any of: Red Team verdict = FAIL, QA suite fail > 0, QA contract violations > 0, QA shallow tests ≥ 2 OR any in core paths, `/code-review ultra` ran AND reported "important" findings that block (case-by-case, see synthesis prompt). |

`VERIFIED-WITH-WARNINGS` allows the milestone to proceed to complete-milestone but the warnings persist in `progress.md` Decision Log and the milestone archive.

## Cooperative + Adversarial Tension (the productive friction)

The pattern `/code-review ultra` is cooperative; Red Team is adversarial. Running them in parallel creates productive disagreement: cooperative finds clarity bugs the adversarial pass would miss; adversarial finds exploit chains the cooperative pass would defer as "edge cases." The combined coverage is strictly larger than either alone.

If a future change makes them substitutes for each other (e.g., Red Team starts producing cooperative findings, or `/code-review ultra` starts including security probing), that change is a contract violation and must be rejected — even if it produces fewer "findings" overall. The orthogonality is the point.

## Bind Sites

- `templates/workflows/gsd-t-verify.workflow.js` — invokes all three stages with the schemas above.
- `templates/prompts/{red-team,qa}-subagent.md` — methodology bodies, KEPT unchanged from M61 (the protocols are the methodology layer).
- `commands/gsd-t-verify.md` — thin invoker of the verify Workflow (D6-T7).

## Origin

- **M58 retrospective**: in-context Red Team "6/6 defended" was wrong (M60 fix).
- **Bake-off (2026-05-29)**: fresh-context adversarial Workflow Red Team caught the CRITICAL that the in-context pass missed.
- **Lesson**: Red Team adversarial review is irreplaceable AND it scales with model capability. `/code-review ultra` is irreplaceable AND it does a different job. QA is irreplaceable AND it does a third. The contract locks this lesson in.
