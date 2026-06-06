# Plan Hardening Contract

**Status:** STABLE
**Version:** 1.0.0
**Introduced:** M83 (2026-06-05)

## Purpose

Left-shift failure detection from **verify** to **plan**. GSD-T's adversarial validation (the [Orthogonal Validation Triad](orthogonal-validation-contract.md), Red Team in particular) runs at verify — *after* code exists. That catches real bugs, but late: the NiceNote build burned **four verify cycles** on M5 because the milestone's headline capability (AC-6, open 100MB+ files via a chunked reader) shipped as **dead code** — the reader was built but `openPath` still materialized whole files, and no test exercised it, so the suite stayed green. Each verify cycle re-litigated the milestone's reason to exist.

The root cause was not in execute. It was in **plan**: the plan never bound each acceptance criterion to (a) a real code path and (b) a test that fails if that path is absent — and nothing adversarial reviewed the design before code was written.

This contract adds two blocking gates to the **plan** phase, run after the plan agent writes `tasks.md` and **before the plan is declared complete** (i.e. before execute may start):

1. **Acceptance-traceability gate** (deterministic) — the structural check: every behavioral task's acceptance criteria bind to a code path + a killing test.
2. **Adversarial pre-mortem** (generative) — the edge-case check: an opus, fresh-context reviewer predicts how the milestone will fail and converts each prediction into a required test.

They are complementary, not redundant: the gate proves the *knowns* are wired; the pre-mortem finds the *unknowns*. The M5 evidence needed both — the dead-code wiring failure (structural) **and** three distinct chunk-boundary edge cases (generative).

## Relationship to the validation duals

GSD-T now runs adversarial review at **both ends of the contract**:

| When | Mechanism | Attacks |
|------|-----------|---------|
| **Plan** (pre-execute) | **Pre-mortem** (this contract) | the DESIGN — predicted failures before code exists |
| **Verify** (post-execute) | **Red Team** (orthogonal triad) | the CODE — actual bugs in finished work |

The pre-mortem makes the post-mortem cheap. It is the temporal dual of the Red Team, just as [Competition Mode](competition-mode-contract.md) is the generative dual of the triad.

## Gate 1 — Acceptance-traceability (deterministic)

`bin/gsd-t-traceability-gate.cjs`, dispatched as `gsd-t traceability-gate`. Parses `.gsd-t/domains/*/tasks.md` and assesses each task block.

Field labels are matched **emphasis-stripped and colon-position-agnostic** — both `**Label**: value` and `**Label:** value` forms are recognized (the gate strips `*`/`_`/`` ` `` before matching). Task blocks are detected by **any** `##`–`####` heading except a structural-heading skip list (Summary/Overview/Notes/Context/Goal/etc.) — a block is assessed iff it bears an acceptance-criteria field, so a descriptive heading like `### Implement the chunked reader` is never silently dropped.

A task is **behavioral** (subject to the gate) if it declares **Acceptance criteria**. For every behavioral task:

- **Must declare `**Files**`** — a concrete implementing code path. An AC with no path is an unbacked promise → `ac-without-path` violation.
- **Must name a test** — via a relevant field only: a `**Test**`/`**Tests**` field, a test-file path or runner in the **Files** value, or a runner/test-path in the **Acceptance criteria** value/bullets (where an AC may name its own verifying test). A runner word in an UNRELATED field (Dependencies/Notes/Scope) does NOT count — that would clear the check vacuously. An AC with no killing test is the dead-code class → `ac-without-test` violation.

A task tagged **`Headline:` true** (the one task delivering the milestone's defining capability) gets stricter checks:
- **Must have a non-test implementing path** → else `headline-without-impl` (the M5 AC-6 dead-code failure).
- **Must have a test** → else `headline-without-test` (the missing >100MB-fixture failure).

Any violation → exit 4, plan **blocked** from execute. The gate judges plan *completeness*, never code *correctness* (that's verify). Pure, zero-deps, never throws.

## Gate 2 — Adversarial pre-mortem (generative)

Protocol: `templates/prompts/pre-mortem-subagent.md`. Runs as a Workflow `agent()` stage on **`model: "opus"`**, fresh context, inverted incentives (value = real failure conditions surfaced, not plan approved). Reads its own protocol via Read at spawn time (the orchestrator has no `fs`).

Attack categories (exhaust all): dead-deliverable/wiring gaps, boundary/edge inputs, resource/NFR conditions, error/failure paths, state/ordering/concurrency, contract/integration seams, shallow-test traps, missing acceptance coverage.

**The load-bearing rule:** every blocking finding MUST convert to a concrete **`requiredTest`** the plan must adopt. **Advisory notes are forbidden** — an advisory note gets deferred, and a deferred edge case is exactly how M5's chunk reader shipped three distinct data-loss bugs across three cycles. A finding without a `requiredTest` is incomplete.

Verdict `BLOCK` (any concrete, falsifiable failure condition lacks a named required test) or `CLEARED` (exhaustive search; all predicted failures already covered, headline bound+reachable+tested, every NFR has a measured acceptance check). `BLOCK` blocks the plan from execute.

## Invariants (do not regress)

1. Both gates run in the **plan** phase, after `tasks.md` is written, **before** the plan is reported complete. Execute never starts on a blocked plan.
2. The traceability gate reuses ONE definition of "traceable" (path + killing test); the headline check is strictly stricter (impl + test), never looser.
3. An invalid/blocked plan returns `status: "blocked"` with the violations/findings attached — never silently `complete`.
4. A milestone's **own headline capability or a core AC may never be deferred** to a later milestone. Deferral is for genuine edge-cases only (e.g. an M9 hardening backlog), never for the thing the milestone is named after. Both gates treat headline-deferral as blocking.
5. Pre-mortem findings are **required tests**, not advisories. The plan is not CLEARED until each blocking finding is answered by a named test (or the design is changed to make the condition impossible).
6. The traceability gate performs zero LLM inference (deterministic substrate); the pre-mortem is the only inference stage, and it cannot APPROVE a plan the deterministic gate blocked (the gate runs first and short-circuits).

## Implementation surface

- `bin/gsd-t-traceability-gate.cjs` — the deterministic gate. Dispatched as `gsd-t traceability-gate [--milestone Mxx] [--tasks FILE]`.
- `templates/prompts/pre-mortem-subagent.md` — the adversarial protocol.
- `templates/workflows/gsd-t-phase.workflow.js` — the plan-phase wiring (both gates, blocking, runtime-native).
- The `plan` objective in the phase workflow instructs the plan agent to write traceable tasks (AC → Files → test, headline tagged) up front, so the gates usually pass first try.
