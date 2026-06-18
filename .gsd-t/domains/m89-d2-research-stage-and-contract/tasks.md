# Tasks: m89-d2-research-stage-and-contract

> **Wave 1 — concurrent with D1, fully file-disjoint.** Provides the interface D3/D4 wire against in Wave 2.
> D2 is the SOLE owner of every shared doc-ripple surface (CLAUDE-global.md, bin/gsd-t.js,
> commands/gsd-t-help.md, package.json) — integrate-conflict-free by construction.
> Contract: `.gsd-t/contracts/auto-research-contract.md` v1.0.0 STABLE.

## Files Owned
- `.gsd-t/contracts/auto-research-contract.md`
- `templates/prompts/research-subagent.md`
- `test/m89-research-stage-cite-format.test.js`
- `templates/CLAUDE-global.md`
- `bin/gsd-t.js`
- `commands/gsd-t-help.md`
- `package.json`

## Tasks

### M89-D2-T1 — Finalize the auto-research contract + correct the stage MODEL form
**Files**: `.gsd-t/contracts/auto-research-contract.md`
**Dependencies**: none (Wave-1 entry; D1 consumes §1 in parallel — shape is already pinned)
**Description**: Confirm v1.0.0 pins: classifier envelope (§1), research-stage interface (§2), Verified-Facts cite format (§3), idempotency (§4), no-silent-guess A3/A4 (§5), labeled-corpus oracle (§6).
**CORRECTION (plan-hardening — load-bearing for A5):** §2 currently prescribes the research stage's model as `overrides["research"] ?? "<literal>"`. **This FAILS the live M85 lint** (`test/m85-workflow-tier-policy-lint.test.js`): the `??`-form bracket key MUST be one of the 6 INJECTABLE designated stages (`solution-space-probe`, `partition-probe`, `competition-judge`, `pre-mortem`, `red-team`, `debug-cycle-2`) — `research` is not one, and `bin/gsd-t-model-tier-policy.cjs` has no `research` key (an unknown stage resolves to a defensive `sonnet` WITH a configError, never fable). Worker workflows already declare non-designated stages with **bare literals** (`model: "haiku"`, `model: "sonnet"` — see `gsd-t-execute.workflow.js:172`). **Resolution: the research stage uses a BARE literal `model: "fable"`** (a high-stakes web call gating downstream spend — Fable tier per the M85 rationale), NOT the `??`-override form. Update §2 to state: *"Model: bare `model: "fable"` literal (Fable tier — single highest-leverage web call per phase). The `??`-override form is reserved for the 6 injectable designated stages and would FAIL the M85 lint for a `research` key."*
**Acceptance**: §2 names the bare-`fable`-literal form, explicitly rejects the `??`-research form with the lint rationale; §1/§3/§4/§5/§6 unchanged in shape (D1/D3/D4 already build against them). Contract stays v1.0.0 STABLE (the §2 correction is a clarification of the intended form, not a shape change — record it in the version note).
**Test**: `test/m85-workflow-tier-policy-lint.test.js` stays GREEN after D3/D4 wire the bare-`fable` literal (the contract correction is what makes their wiring lint-clean — see D3-T1, D4-T1).

### M89-D2-T2 — Author the research-subagent prompt protocol
**Files**: `templates/prompts/research-subagent.md` (NET-NEW)
**Dependencies**: M89-D2-T1 (stage interface §2)
**Contract**: `auto-research-contract.md` §2 (stage interface) + §3 (cite format)
**Description**: Reusable stage prompt, Read at spawn time (mirrors `qa/red-team/design-verify-subagent.md` — NEVER inlined into a workflow; the sandbox has no `fs`). Input = one external gap (the classifier envelope's `gap` text). Tools = `WebSearch` + `WebFetch` ONLY (the only stages granted web tools). Output = a `## Verified Facts (auto-research)` block (§3) where every fact line carries `source: <url> (fetched YYYY-MM-DD)`. Schema-validated.
**Acceptance**: protocol specifies the input gap, the WebSearch+WebFetch-only tool grant, the exact `## Verified Facts (auto-research)` heading, the per-fact `source: <url>` requirement, and that an uncited fact is a stage failure.
**Test**: `test/m89-research-stage-cite-format.test.js` (T3) asserts the protocol's cite-block grammar parses and that the heading string the protocol mandates matches the gate's machine-detect string.

### M89-D2-T3 — Cite-format + idempotency test
**Files**: `test/m89-research-stage-cite-format.test.js` (NET-NEW — the implementation path for A2/SC2)
**Dependencies**: M89-D2-T2 (the protocol defines the block grammar this test parses)
**Contract**: `auto-research-contract.md` §3 (cite format) + §4 (idempotency / A2)
**Description**: A pure parser/idempotency test over the Verified-Facts block grammar (no live web call):
- Positive: a well-formed `## Verified Facts (auto-research)` block with `source: <url>` on every fact PARSES and is accepted.
- **Negative (load-bearing): a fact line with NO `source: <url>` FAILS** (uncited fact → reject — SC2).
- **Idempotency (A2): given an artifact that already contains a cited Verified-Facts entry covering a gap, the "should-research?" predicate returns FALSE** — a re-pass triggers ZERO additional research. Assert the predicate detects an existing matching cited fact and short-circuits.
**Acceptance**: positive parses; uncited-fact case FAILS; the idempotency predicate returns "skip" for an already-cited gap and "research" for an uncovered external gap. Functional assertions, not existence.
**Test**: this file IS the test. Runner: `npm test`.

### M89-D2-T4 — Dispatch + doc-ripple (shared surfaces, single owner)
**Files**: `bin/gsd-t.js`, `commands/gsd-t-help.md`, `templates/CLAUDE-global.md`
**Dependencies**: M89-D1-T2 (the `gsd-t-research-gate.cjs` module the dispatch routes to must exist), M89-D2-T1
**Contract**: `auto-research-contract.md` §1 + project Pre-Commit Gate (doc-ripple)
**Description**:
- `bin/gsd-t.js`: add a `research-gate` dispatch case routing to `bin/gsd-t-research-gate.cjs`; add `gsd-t-research-gate.cjs` to `PROJECT_BIN_TOOLS` (propagated to each registered project's `bin/`, so the workflow `runCli` fallback resolves downstream — per [[project_global_bin_propagation_gap]]); add the help line.
- `commands/gsd-t-help.md`: add the `research-gate` help line.
- `templates/CLAUDE-global.md`: REPLACE the advisory `Research Policy` prose (the "evaluate whether research is needed… if in doubt, skip" LLM-discretion block) with the deterministic-trigger description: *gap → classify (`gsd-t-research-gate`) → external: web-research stage + cite Verified-Facts into the artifact before the gate re-runs / internal: grep/Read, never web.* Mirror to live `~/.claude/CLAUDE.md` if the template/live pairing applies.
**Acceptance**: `node bin/gsd-t.js research-gate classify "<gap>"` dispatches to the module and prints the envelope; `gsd-t-research-gate.cjs` is in `PROJECT_BIN_TOOLS`; help lines present in both `bin/gsd-t.js` and `commands/gsd-t-help.md`; the advisory Research Policy prose is gone, replaced by the deterministic trigger.
**Test**: `test/m89-research-stage-cite-format.test.js` may assert the CLAUDE-global Research-Policy replacement text (deterministic-trigger keywords present, advisory "if in doubt, skip" absent); dispatch smoke-tested in M89-D2-T5. (If an existing installer test covers `PROJECT_BIN_TOOLS` membership, extend it to assert `gsd-t-research-gate.cjs` is present, mirroring the M87 propagation test pattern.)

### M89-D2-T5 — Version bump + verify
**Files**: `package.json`
**Dependencies**: M89-D2-T4
**Description**: Patch bump (per `~/.claude/CLAUDE.md` versioning — patch ≥10, 2-digit). `node --check bin/gsd-t.js`; run T3; smoke-test `node bin/gsd-t.js research-gate classify "<gap>"`; confirm `test/m85-workflow-tier-policy-lint.test.js` GREEN (no `research` `??`-form introduced anywhere).
**Acceptance**: `node --check bin/gsd-t.js` clean; T3 green; dispatch smoke prints a valid envelope; M85 lint green.
**Test**: `npm test` (T3 + M85 lint) + the `node --check` + dispatch smoke.
