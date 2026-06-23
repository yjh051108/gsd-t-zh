# Tasks: m89-d2-research-stage-and-contract

> **Wave 1 — concurrent with D1, fully file-disjoint.** Provides the interface D3/D4 wire against in Wave 2.
> D2 is the SOLE owner of every shared doc-ripple surface (CLAUDE-global.md, bin/gsd-t.js,
> commands/gsd-t-help.md, package.json, docs/requirements.md) — integrate-conflict-free by construction.
> Contract: `.gsd-t/contracts/auto-research-contract.md` v1.2.0 STABLE (premise-corrected).

## Files Owned
- `.gsd-t/contracts/auto-research-contract.md`
- `templates/prompts/research-subagent.md`
- `templates/prompts/stated-claims-snippet.md` (NET-NEW — the reusable DETECT prompt seam, §6.5)
- `test/m89-research-stage-cite-format.test.js`
- `templates/CLAUDE-global.md`
- `bin/gsd-t.js`
- `commands/gsd-t-help.md`
- `package.json`
- `docs/requirements.md` (M89 entry — SC5/A6 doc-ripple)

## Tasks

### M89-D2-T1 — Finalize the auto-research contract + correct the stage MODEL form
**Files**: `.gsd-t/contracts/auto-research-contract.md`
**Dependencies**: none (Wave-1 entry; D1 consumes §1 in parallel — shape is already pinned)
**Description**: Confirm the seam pins: classifier envelope (§1), research-stage interface (§2), Verified-Facts cite format (§3), idempotency (§4), no-silent-guess A3/A4 (§5), DETECT Stated-Claims seam (§6.5), ENFORCE marker (§7), labeled-corpus + held-out oracle (§6).
**CORRECTION (plan-hardening — load-bearing for A5):** §2 currently prescribes the research stage's model as `overrides["research"] ?? "<literal>"`. **This FAILS the live M85 lint** (`test/m85-workflow-tier-policy-lint.test.js`): the `??`-form bracket key MUST be one of the 6 INJECTABLE designated stages (`solution-space-probe`, `partition-probe`, `competition-judge`, `pre-mortem`, `red-team`, `debug-cycle-2`) — `research` is not one, and `bin/gsd-t-model-tier-policy.cjs` has no `research` key (an unknown stage resolves to a defensive `sonnet` WITH a configError, never fable). Worker workflows already declare non-designated stages with **bare literals** (`model: "haiku"`, `model: "sonnet"` — see `gsd-t-execute.workflow.js:172`). **Resolution: the research stage uses a BARE literal `model: "fable"`** (a high-stakes web call gating downstream spend — Fable tier per the M85 rationale), NOT the `??`-override form. Update §2 to state: *"Model: bare `model: "fable"` literal (Fable tier — single highest-leverage web call per phase). The `??`-override form is reserved for the 6 injectable designated stages and would FAIL the M85 lint for a `research` key."*
**CONTRACT v1.2.0 (PREMISE CORRECTION after plan pre-mortem cycle-2 / 2 CRITICALs):** the contract is bumped v1.1.0 → **v1.2.0** (the v1.1.0 findings #1/#2/#3/#5 fixes stay). The premise-correction Changelog entry covers:
- **§1 (input is a GUESSED CLAIM, not "a gap"):** classifier input is a claim the agent tagged GUESSED. **A proper-noun-LESS claim that ASSERTS an external system's behavior/return-shape/limit WITHOUT a cited source routes EXTERNAL** — dissolves the cycle-2 finding #3 silent-miss (vendor-name-less external guess defaulting internal).
- **NEW §1.3 — the three guess-types (unknown/assumed/stale):** any triggers verification; staleness DEFAULTS to fail-toward-verify for an external/time-varying fact lacking a fresh cited source (don't trust the agent's self-staleness-assessment).
- **NEW §6.5 — the DETECT seam (Stated Claims, LLM-prompted):** each eligible stage prompt REQUIRES a structured `## Stated Claims` list tagging load-bearing claims KNOWN | GUESSED(type); the wiring iterates it through the classifier. Honest best-effort — an untagged claim is an acknowledged miss, NOT a silent pass for a tagged one. Determinism lives in CLASSIFY+ENFORCE, NOT DETECT.
- **NEW §7 — the ENFORCE marker:** at classify time an external guess writes `<!-- auto-research-claim: class=external key=<claim-key> status=uncited -->` into the artifact so the verify gate FAILs on an uncited external claim even if nothing else was written; flips to `status=cited` when the Verified-Facts block lands. Defines marker format + the normalized-claim-key (= the §4.1 idempotency exact-match key).
- **§3:** Verified-Facts fact lines carry a fetch DATE — promoted load-bearing for staleness (§1.3).
- **Carried from v1.1.0:** §1.1 feature-class, §4.1 exact-key "covers", §5.1 ambiguous-escalation owned by D3/D4, §5/A3 routing-decision wording + sole-web-stage enforcement. §2 stays the bare-`fable` literal (rejects the `??`-research form per the M85 lint).
**Acceptance**: §1 input is a guessed claim + proper-noun-less external rule; §1.3 three guess-types; §6.5 DETECT Stated-Claims seam; §7 ENFORCE marker (format + claim-key); §3 fact date load-bearing; §2 bare-`fable`; v1.1.0 sections intact; Changelog records v1.2.0 (premise correction) ABOVE v1.1.0. D1/D3/D4 build against §1/§1.3/§3/§4.1/§5/§6.5/§7.
**Test**: `test/m85-workflow-tier-policy-lint.test.js` stays GREEN after D3/D4 wire the bare-`fable` literal (the contract correction is what makes their wiring lint-clean — see D3-T1, D4-T1).

### M89-D2-T2 — Author the research-subagent prompt protocol (facts carry URL + DATE)
**Files**: `templates/prompts/research-subagent.md` (NET-NEW)
**Dependencies**: M89-D2-T1 (stage interface §2)
**Contract**: `auto-research-contract.md` §2 (stage interface) + §3 (cite format, URL + DATE)
**Description**: Reusable stage prompt, Read at spawn time (mirrors `qa/red-team/design-verify-subagent.md` — NEVER inlined into a workflow; the sandbox has no `fs`). Input = one external guessed claim (the classifier envelope's `gap` text). Tools = `WebSearch` + `WebFetch` ONLY (the only stages granted web tools). Output = a `## Verified Facts (auto-research)` block (§3) where every fact line carries **BOTH** `source: <url>` **AND `(fetched YYYY-MM-DD)`** — the fetch date is load-bearing for the staleness guess-type (§1.3): a fact's freshness can only be judged if its fetch date is recorded. Schema-validated.
**Acceptance**: protocol specifies the input guessed claim, the WebSearch+WebFetch-only tool grant, the exact `## Verified Facts (auto-research)` heading, the per-fact `source: <url>` **and `(fetched YYYY-MM-DD)`** requirement, and that an uncited OR undated fact is a stage failure.
**Test**: `test/m89-research-stage-cite-format.test.js` (T3) asserts the protocol's cite-block grammar parses (URL + date), and that the heading string the protocol mandates matches the gate's machine-detect string.

### M89-D2-T2b — Author the Stated-Claims DETECT prompt snippet (NEW — the §6.5 seam)
**Files**: `templates/prompts/stated-claims-snippet.md` (NET-NEW)
**Dependencies**: M89-D2-T1 (§6.5 + §1.3)
**Contract**: `auto-research-contract.md` §6.5 (DETECT seam) + §1.3 (three guess-types)
**Description**: The reusable prompt SNIPPET each eligible stage embeds (Read at spawn time alongside the research-subagent protocol) that REQUIRES the agent to emit a structured `## Stated Claims` list tagging every load-bearing claim `[KNOWN]` | `[GUESSED:unknown]` | `[GUESSED:assumed]` | `[GUESSED:stale]` (per §1.3). The snippet defines the exact tag grammar (machine-parseable by the wiring), explains the three guess-types with the "plausible ≠ confirmed" and "was-true ≠ is-true / fail-toward-verify" rules, and states the honest-best-effort contract: an untagged claim is an acknowledged miss, NOT a silent pass for a tagged one. Mirrors the keep-or-supersede protocol convention.
**Acceptance**: the snippet mandates the `## Stated Claims` heading + the four exact tags; defines the three guess-types incl. the staleness fail-toward-verify default; states the best-effort honesty contract. D3/D4 embed it verbatim at each eligible stage.
**Test**: `test/m89-research-stage-cite-format.test.js` (T3) asserts the snippet's tag grammar parses (the four tags + the `## Stated Claims` heading the wiring greps for) — so D3/D4 wiring tests can rely on a stable tag set.

### M89-D2-T3 — Cite-format + idempotency test
**Files**: `test/m89-research-stage-cite-format.test.js` (NET-NEW — the implementation path for A2/SC2)
**Dependencies**: M89-D2-T2 (the protocol defines the block grammar this test parses)
**Contract**: `auto-research-contract.md` §3 (cite format) + §4 (idempotency / A2)
**Description**: A pure parser/idempotency test over the Verified-Facts block grammar (no live web call):
- Positive: a well-formed `## Verified Facts (auto-research)` block with `source: <url>` on every fact PARSES and is accepted.
- **Negative (load-bearing): a fact line with NO `source: <url>` FAILS** (uncited fact → reject — SC2).
- **Idempotency POSITIVE (A2 — contract §4.1): given an artifact that already contains a cited Verified-Facts entry whose recorded gap-key EXACTLY matches a gap, the "should-research?" predicate returns FALSE** — a re-pass triggers ZERO additional research. Assert the predicate detects an existing exact-gap-key match and short-circuits.
- **Idempotency NEGATIVE (finding #2 — contract §4.1, load-bearing): an artifact citing gap A ("PayPal OAuth `/v1/oauth2/token` mint") MUST still route a DISTINCT gap B ("PayPal v2 invoice TOTAL limit") to research** — the predicate returns TRUE (research) for gap B even though both share the keyword "PayPal". "Covers" is exact normalized-gap-key match, NOT substring/keyword/fuzzy; a fuzzy "covers" that skipped gap B FAILS this assertion.
**Acceptance**: positive parses; uncited-fact case FAILS; the idempotency predicate returns "skip" only for an EXACT-gap-key already-cited gap, and "research" for an uncovered external gap AND for a distinct gap that merely shares keywords with a cited one (the PayPal-OAuth-vs-invoice-TOTAL negative). Functional assertions, not existence.
**Test**: this file IS the test. Runner: `npm test`.

### M89-D2-T4 — Dispatch + doc-ripple (shared surfaces, single owner)
**Files**: `bin/gsd-t.js`, `commands/gsd-t-help.md`, `templates/CLAUDE-global.md`, `docs/requirements.md`
**Dependencies**: M89-D1-T2 (the `gsd-t-research-gate.cjs` module the dispatch routes to must exist), M89-D2-T1
**Contract**: `auto-research-contract.md` §1/§6.5/§7 + project Pre-Commit Gate + Document Ripple gate (doc-ripple)
**Description**:
- `bin/gsd-t.js`: add a `research-gate` dispatch case routing to `bin/gsd-t-research-gate.cjs`; add `gsd-t-research-gate.cjs` to `PROJECT_BIN_TOOLS` (propagated to each registered project's `bin/`, so the workflow `runCli` fallback resolves downstream — per [[project_global_bin_propagation_gap]]); add the help line.
- `commands/gsd-t-help.md`: add the `research-gate` help line.
- `templates/CLAUDE-global.md`: REPLACE the advisory `Research Policy` prose (the "evaluate whether research is needed… if in doubt, skip" LLM-discretion block) with the **KNOWN-vs-GUESSED trigger** (premise-corrected, NOT "detect a gap"): *for each load-bearing claim, tag KNOWN vs GUESSED(unknown|assumed|stale) → a GUESSED claim is classified (`gsd-t-research-gate`) → external: web-research stage + cite Verified-Facts (URL + date) into the artifact before the gate re-runs / internal: grep/Read, never web. Staleness defaults to fail-toward-verify.* **PLUS the SC6 CONVERSATION-scope standing directive:** when answering the USER about an external/time-varying fact, verify-or-flag before asserting (a habit rule, not a workflow gate). Add the matching memory pointer `feedback_auto_research_external_gaps`. Mirror to live `~/.claude/CLAUDE.md` if the template/live pairing applies.
- `docs/requirements.md`: ADD an M89 entry (SC5/A6 — cycle-2 MED #4): the auto-research known/guessed trigger as a framework requirement (classify→research+cite ENFORCE, the three guess-types, the DETECT Stated-Claims seam, the ENFORCE marker, conversation-scope directive).
**Acceptance**: `node bin/gsd-t.js research-gate classify "<claim>"` dispatches to the module and prints the envelope; `gsd-t-research-gate.cjs` is in `PROJECT_BIN_TOOLS`; help lines present in both `bin/gsd-t.js` and `commands/gsd-t-help.md`; the advisory Research Policy prose is gone, replaced by the KNOWN-vs-GUESSED trigger + the SC6 conversation directive; `docs/requirements.md` carries the M89 entry.
**Test**: `test/m89-research-stage-cite-format.test.js` may assert the CLAUDE-global Research-Policy replacement text (known/guessed-trigger keywords present, advisory "if in doubt, skip" absent, SC6 conversation directive present) AND that `docs/requirements.md` carries the M89 entry (A6); dispatch smoke-tested in M89-D2-T5. (If an existing installer test covers `PROJECT_BIN_TOOLS` membership, extend it to assert `gsd-t-research-gate.cjs` is present, mirroring the M87 propagation test pattern.)

### M89-D2-T5 — Version bump + verify
**Files**: `package.json`
**Dependencies**: M89-D2-T4
**Description**: Patch bump (per `~/.claude/CLAUDE.md` versioning — patch ≥10, 2-digit). `node --check bin/gsd-t.js`; run T3; smoke-test `node bin/gsd-t.js research-gate classify "<gap>"`; confirm `test/m85-workflow-tier-policy-lint.test.js` GREEN (no `research` `??`-form introduced anywhere).
**Acceptance**: `node --check bin/gsd-t.js` clean; T3 green; dispatch smoke prints a valid envelope; M85 lint green.
**Test**: `npm test` (T3 + M85 lint) + the `node --check` + dispatch smoke.
