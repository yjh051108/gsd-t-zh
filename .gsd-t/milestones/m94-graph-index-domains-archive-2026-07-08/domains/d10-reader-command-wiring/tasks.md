# Tasks: d10-reader-command-wiring (WAVE B — wire the READER commands)

> **PRE-MORTEM Finding 1 (HIGH — directive-not-dead-prose).** A command `.md` directive ("query the graph") is not self-executing code — a worker could ignore it. The LIVE enforcement that makes every reader directive binding is TWO real-code artifacts, NOT the prose: (1) the d10-T0 `gsd-t-phase.workflow.js` injection (real code that queries the graph + injects the slice into worker context, so the generic-runner readers physically receive the graph slice) + (2) the d8 anti-grep lint (real code that FAILS THE BUILD if a structural-grep fallback remains in the command file). So each reader task's binding deliverable = its manifest row (lint-enforced) + the phase-workflow injection (T0) — the `.md` directive is the human-readable half of a machine-enforced pair. The d10 test is manifest-driven over both. This is why the lint (d8) + the injection seam (T0) are Wave-A/early-Wave-B prerequisites, not afterthoughts.

> **PRE-MORTEM Finding 3 (MEDIUM — verify/integrate bootstrap hazard).** Wiring `gsd-t-verify.workflow.js` to query the graph means verify now depends on the graph. If verify itself hits graph-unavailable, a HARD fail-loud on verify's own dead-code check would brick the verify gate (a bootstrap deadlock). CARVE-OUT (d10-T5/T6): verify's + integrate's graph dead-code/dangling query is ADDITIVE to their existing gates — on graph-unavailable it degrades ANNOUNCED (records "graph unavailable — structural gate skipped, fix it" as a WARNING in the verify result, does NOT hard-fail the whole verify run), exactly like `/scan`'s announced fallback. The structural slice ENRICHES verify/integrate; it does not become a new single point of failure for the gate that must always be able to run. This carve-out is declared in the d8 contract (`[RULE] verify-integrate-graph-additive-announced-not-hard-fail`) and tested in d10-T5/T6.

## Summary
When all tasks complete: every code-ASSESSING command (impact, plan, partition, project, feature, gap-analysis, populate, promote-debt, prd, qa, integrate, verify) queries the graph CLI for its structural question — blast-radius/who-imports/cluster/dead-code/dangling per the verb-map — instead of structural-grep/raw-read, via the shared d8 wiring contract; the shared `gsd-t-phase.workflow.js` injects the structural slice into worker context uniformly for the generic-runner readers; each reader fails LOUD on graph-unavailable (no silent grep); each reader has a row in the d8 consumer manifest and a test asserting graph-not-grep + fail-loud. Wave B — gated on Wave A (d8 contract+lint + d9 verbs). `/scan` reader wiring is d6's (excluded here).

## Wave B

### M94-D10-T0 — Shared phase-workflow structural-slice injection seam (sole owner)
- **Status**: [x] complete
- **Headline**: false
- **Files**: `templates/workflows/gsd-t-phase.workflow.js`, `test/m94-d10-reader-wiring.test.js`
- **Touches**: `templates/workflows/gsd-t-phase.workflow.js`, `test/m94-d10-reader-wiring.test.js`
- **ImplPath**: `templates/workflows/gsd-t-phase.workflow.js` — add an inline `agent()`-Bash runCli helper that calls `gsd-t graph <verb>` for the phase's structural question and threads the returned slice into the worker-agent brief/context (the generic-runner injection seam all `gsd-t workflow-path phase` readers inherit); on `graph-unavailable` it surfaces the loud message into the phase result (no silent grep), per the d8 FAIL-LOUD invariant. Runtime-native (M81 — no require/fs).
- **Test**: `test/m94-d10-reader-wiring.test.js` (shared across d10) — asserts the phase workflow's injection helper exists and calls the graph CLI (spy/mock the runCli, assert graph-query call-count > 0 for a structural phase) and that a `graph-unavailable` return produces a LOUD surfaced message, NOT a grep fallback (assert no structural-grep path is taken)
- **Contract refs**: graph-consumer-wiring-contract.md (d8 — READER pattern + injection seam), graph-query-cli-contract.md (d5+d9)
- **Dependencies**: M94-D8-T1 (contract), M94-D9-T1/T2 (cluster + orphan verbs the readers need) — gated on Wave A
- **Acceptance criteria**:
  - The phase runner queries the graph CLI for the structural slice and injects it into worker context — `[RULE] phase-workflow-injects-structural-slice`. Runtime-native (inline `agent()` Bash, no require/fs/child_process/process).
  - On `graph-unavailable` for a structural question → LOUD surfaced message, NO silent grep — `[RULE] phase-workflow-fail-loud-no-grep`.
  - Spy-proven: graph-query call-count > 0 on a structural phase; the structural-grep path is never taken.
  - This is the SOLE M94 task editing `gsd-t-phase.workflow.js` (file-disjointness).

### M94-D10-T1 — Wire `/impact` to blast-radius (HIGH — the user's CORE use case)
- **Status**: [x] complete
- **Headline**: true
- **Files**: `commands/gsd-t-impact.md`, `.gsd-t/contracts/graph-consumer-wiring-contract.md`, `test/m94-d10-reader-wiring.test.js`, `test/m94-d10-impact-consumption-proof.test.js`
- **Touches**: `commands/gsd-t-impact.md`, `test/m94-d10-impact-consumption-proof.test.js`
- **ImplPath**: `commands/gsd-t-impact.md` — the downstream-effect-analysis step directs the worker to call `gsd-t graph blast-radius <target>` (union of import+call reverse-reachable) for the blast radius INSTEAD of grepping/reading-to-reconstruct dependents; fail loud on graph-unavailable. Appends the `/impact` row to the d8 consumer manifest (manifest table = sole-edited by d8-T1 at authoring; readers reference it — the row addition is recorded in the d8 contract via the d8 owner OR as a manifest-append the d8 contract pre-declares as the reader work-list; d10 tasks cite their row, they do NOT re-edit the d8 file). The test below is the binding artifact.
- **Test**: `test/m94-d10-reader-wiring.test.js` — `/impact` case: asserts the command directs a `blast-radius` graph query for the structural question (not a grep/raw-read reconstruction) AND fails loud on graph-unavailable. `[RULE] impact-uses-blast-radius-not-grep`. PLUS **`test/m94-d10-impact-consumption-proof.test.js`** (RE-PLAN-EXPANDED Fix-4 — CONSUMPTION PROOF, mirrors d6-T2 byte-traceability): builds a REAL fixture repo via D3 `build_index` where a dependent edge `A → X` exists ONLY through a path a grep/raw-read reconstruction would MISS (e.g. a re-export barrel / a path-alias import / a dynamic-but-resolved call — an edge no naive `grep "import.*X"` over X's name would surface), runs `gsd-t graph blast-radius X` via the REAL D5 CLI, and asserts the `/impact` OUTPUT impact set CONTAINS `A` — proving the graph slice reached the CONCLUSION (the blast radius), not merely the worker's context. The test ALSO asserts a grep-only reconstruction of the same target MISSES `A` (the graph-only edge is real, not reproducible by grep) — so the proof is that the GRAPH changed the answer.
- **Contract refs**: graph-consumer-wiring-contract.md (d8), graph-query-cli-contract.md (blast-radius)
- **Dependencies**: M94-D10-T0; M94-D8-T1; M94-D3-T2 (build_index for the consumption-proof fixture), M94-D5-T1 (blast-radius CLI); gated on Wave A
- **Acceptance criteria**:
  - **(Headline for d10 — `/impact` blast-radius is the user's named core use case.)** `/impact` uses `blast-radius` (union of import+call reverse-reachable, transitive) for the downstream-effect question — `[RULE] impact-uses-blast-radius-not-grep` — never grep/raw-read to reconstruct dependents.
  - **[RE-PLAN-EXPANDED Fix-4 — CONSUMPTION PROOF, not just directive presence]** the `/impact` OUTPUT impact set CONTAINS a graph-only dependent edge that a grep/raw-read reconstruction MISSES — `[RULE] impact-output-contains-graph-only-edge`. Proves the injected slice reached the CONCLUSION (the impact set), mirroring d6-T2's byte-traceability; a test that only asserts the directive EXISTS (manifest-driven presence) is INSUFFICIENT for the headline.
  - Fails LOUD on graph-unavailable; no silent grep fallback (structural path).
  - `/impact` row present in the d8 consumer manifest (command + verb + replaced-grep).
  - Anti-grep lint (d8-T3) passes for `commands/gsd-t-impact.md` (no structural-grep fallback).

### M94-D10-T2 — Wire `/plan` + `/feature` + `/gap-analysis` (HIGH readers, command-file directives)
- **Status**: [x] complete
- **Headline**: false
- **Files**: `commands/gsd-t-plan.md`, `commands/gsd-t-feature.md`, `commands/gsd-t-gap-analysis.md`, `test/m94-d10-reader-wiring.test.js`
- **Touches**: `commands/gsd-t-plan.md`, `commands/gsd-t-feature.md`, `commands/gsd-t-gap-analysis.md`
- **ImplPath**: each command `.md`'s structural-assessment step directs a graph query — `plan` → `who-imports`+`blast-radius` (touched-file dependents for sequencing); `feature` → `blast-radius`+`who-imports` (new-feature impact on existing code); `gap-analysis` → `who-imports`+`dead-code` (requirements-vs-code coverage gaps) — INSTEAD of grep/raw-read; fail loud on graph-unavailable
- **Test**: `test/m94-d10-reader-wiring.test.js` — per-command cases: each of plan/feature/gap-analysis directs its mapped structural graph query (not grep) + fails loud on graph-unavailable
- **Contract refs**: graph-consumer-wiring-contract.md (d8), graph-query-cli-contract.md (who-imports/blast-radius/dead-code)
- **Dependencies**: M94-D10-T0; M94-D8-T1; M94-D9-T2 (dead-code verb for gap-analysis); gated on Wave A
- **Acceptance criteria**:
  - `plan`/`feature`/`gap-analysis` each use their mapped structural verb (constraints.md verb-map) for the structural question — not grep/raw-read. `[RULE] plan-feature-gapanalysis-use-graph-not-grep`
  - Each fails LOUD on graph-unavailable; no silent grep.
  - Each has a manifest row; anti-grep lint passes for all three files.

### M94-D10-T3 — Wire `/partition` + `/project` to the cluster verb (domain/milestone decomposition)
- **Status**: [x] complete
- **Headline**: false
- **Files**: `commands/gsd-t-partition.md`, `commands/gsd-t-project.md`, `test/m94-d10-reader-wiring.test.js`
- **Touches**: `commands/gsd-t-partition.md`, `commands/gsd-t-project.md`
- **ImplPath**: `commands/gsd-t-partition.md` — the domain-boundary step queries `gsd-t graph cluster` for tightly-coupled file groups and suggests domain cuts along low-coupling boundaries (file-disjointness-aware); `commands/gsd-t-project.md` — the milestone-decomposition step queries `cluster` for structure-aligned milestone boundaries — both INSTEAD of LLM-reconstructing coupling by reading
- **Test**: `test/m94-d10-reader-wiring.test.js` — partition/project cases: each directs a `cluster` graph query (not grep/raw-read) for the coupling question + fails loud on graph-unavailable
- **Contract refs**: graph-consumer-wiring-contract.md (d8), graph-query-cli-contract.md (cluster — d9-T1)
- **Dependencies**: M94-D10-T0; M94-D9-T1 (cluster verb); gated on Wave A
- **Acceptance criteria**:
  - `partition` + `project` use the `cluster` verb for tightly-coupled file groups — `[RULE] partition-project-use-cluster-verb` — not LLM-reconstructed coupling.
  - Each fails LOUD on graph-unavailable; manifest rows present; anti-grep lint passes.

### M94-D10-T4 — Wire `/populate` + `/promote-debt` + `/prd` (MED readers)
- **Status**: [x] complete
- **Headline**: false
- **Files**: `commands/gsd-t-populate.md`, `commands/gsd-t-promote-debt.md`, `commands/gsd-t-prd.md`, `test/m94-d10-reader-wiring.test.js`
- **Touches**: `commands/gsd-t-populate.md`, `commands/gsd-t-promote-debt.md`, `commands/gsd-t-prd.md`
- **ImplPath**: `populate` → `who-imports`+`cluster` (derive doc structure from real edges); `promote-debt` → `blast-radius` (scope a debt item's reach before milestone-izing); `prd` → `cluster` (structure-aware decomposition) — each command `.md`'s structural step directs the graph query instead of grep/raw-read; fail loud on graph-unavailable
- **Test**: `test/m94-d10-reader-wiring.test.js` — per-command cases for populate/promote-debt/prd
- **Contract refs**: graph-consumer-wiring-contract.md (d8), graph-query-cli-contract.md (who-imports/blast-radius/cluster)
- **Dependencies**: M94-D10-T0; M94-D9-T1 (cluster); gated on Wave A
- **Acceptance criteria**:
  - `populate`/`promote-debt`/`prd` each use their mapped structural verb — not grep/raw-read. `[RULE] populate-promotedebt-prd-use-graph-not-grep`
  - Each fails LOUD on graph-unavailable; manifest rows present; anti-grep lint passes.

### M94-D10-T5 — Wire `/qa` + `/verify` to the orphan/dangling verbs (dead-code + dangling-ref gates)
- **Status**: [x] complete
- **Headline**: false
- **Files**: `commands/gsd-t-qa.md`, `commands/gsd-t-verify.md`, `templates/workflows/gsd-t-verify.workflow.js`, `test/m94-d10-reader-wiring.test.js`
- **Touches**: `commands/gsd-t-qa.md`, `commands/gsd-t-verify.md`, `templates/workflows/gsd-t-verify.workflow.js`
- **ImplPath**: `commands/gsd-t-qa.md` + the QA-subagent invocation directs `gsd-t graph dead-code`+`dangling` to find dead code / dangling refs structurally (QA is a generic-phase reader — its directive lives in the command `.md`); `templates/workflows/gsd-t-verify.workflow.js` + `commands/gsd-t-verify.md` — verify queries `dead-code`+`dangling` as part of its quality gates (the verify workflow gets a runtime-native inline graph query injecting the dead-code/dangling slice into its validator context) — both INSTEAD of grep/raw-read; fail loud on graph-unavailable
- **Test**: `test/m94-d10-reader-wiring.test.js` — qa/verify cases: each directs a `dead-code`+`dangling` graph query (not grep) + fails loud on graph-unavailable; the verify workflow injection is spy-proven (graph-query call-count > 0)
- **Contract refs**: graph-consumer-wiring-contract.md (d8), graph-query-cli-contract.md (dead-code/dangling — d9-T2)
- **Dependencies**: M94-D10-T0; M94-D9-T2 (orphan/dangling verbs); gated on Wave A. NOTE: `templates/workflows/gsd-t-verify.workflow.js` is sole-owned by this task in M94 (the orthogonal-triad logic is untouched — additive dead-code/dangling slice only; verify's own M94 gates are added by the verify pipeline, not edited here for graph-query beyond this injection)
- **Acceptance criteria**:
  - `qa` + `verify` use `dead-code`+`dangling` for the structural absence question — `[RULE] qa-verify-use-orphan-dangling-verbs` — not grep/raw-read.
  - `verify`'s workflow injection is runtime-native (M81); the orthogonal triad / CI-parity / test-data logic is NOT disrupted (additive-only — Destructive Action Guard).
  - **[PRE-MORTEM Finding 3 — bootstrap carve-out]** `verify` (and `integrate`, T6) degrade ANNOUNCED on graph-unavailable (WARNING, structural gate skipped) rather than hard-failing the whole gate — `[RULE] verify-integrate-graph-additive-announced-not-hard-fail`. Test asserts: graph-unavailable → verify records a warning + COMPLETES its other gates (does NOT brick), and does NOT silently grep for the structural question. `qa` (not the always-runnable verify gate) still hard-stops loud like the other readers.
  - `qa` fails LOUD on graph-unavailable; `verify` degrades announced (carve-out); manifest rows present; anti-grep lint passes (verify's announced fallback is lint-exempt per the d8 carve-out, like scan).

### M94-D10-T6 — Wire `/integrate` to who-imports + blast-radius (cross-domain wiring verification)
- **Status**: [x] complete
- **Headline**: false
- **Files**: `commands/gsd-t-integrate.md`, `templates/workflows/gsd-t-integrate.workflow.js`, `test/m94-d10-reader-wiring.test.js`
- **Touches**: `commands/gsd-t-integrate.md`, `templates/workflows/gsd-t-integrate.workflow.js`
- **ImplPath**: `templates/workflows/gsd-t-integrate.workflow.js` — the cross-domain wiring step queries `who-imports`+`blast-radius` to verify domains are actually wired (real edges across the seam) instead of LLM-reconstructing the wiring by reading; runtime-native inline graph query injecting the slice into the integrate worker context; `commands/gsd-t-integrate.md` — the behavior note + fail-loud
- **Test**: `test/m94-d10-reader-wiring.test.js` — integrate case: directs `who-imports`+`blast-radius` (not grep) + fails loud on graph-unavailable; the workflow injection spy-proven (graph-query call-count > 0)
- **Contract refs**: graph-consumer-wiring-contract.md (d8), graph-query-cli-contract.md (who-imports/blast-radius)
- **Dependencies**: M94-D10-T0; M94-D8-T1; gated on Wave A. NOTE: `templates/workflows/gsd-t-integrate.workflow.js` is sole-owned by this task; d7's integrate-rewire edits `bin/gsd-t.js`, NOT this workflow — disjoint.
- **Acceptance criteria**:
  - `integrate` uses `who-imports`+`blast-radius` to verify cross-domain wiring structurally — `[RULE] integrate-uses-graph-for-wiring-verification` — not LLM-reconstructed.
  - Runtime-native (M81); existing integrate functionality (seam-test read, integration-points read) is NOT disrupted (additive — Destructive Action Guard).
  - **[PRE-MORTEM Finding 3 — bootstrap carve-out]** `integrate` degrades ANNOUNCED on graph-unavailable (WARNING, structural wiring-check skipped) rather than bricking the integrate stage — `[RULE] verify-integrate-graph-additive-announced-not-hard-fail`. Test asserts integrate completes its other integration work + records the warning, and does NOT silently grep. Manifest row present; integrate's announced fallback is lint-exempt per the d8 carve-out.

## Execution Estimate
- Total tasks: 7 (T0 seam + T1–T6 command wiring)
- Independent tasks (after T0 + Wave A): T1–T6 are file-disjoint, run in PARALLEL (each owns distinct command/workflow files; all share the read-only test file `test/m94-d10-reader-wiring.test.js` — single test file, appended per task; sequence the test-file writes OR have one task own the test scaffold and others append cases — RESOLVED: T0 creates the test scaffold, T1–T6 each append their case to it. To keep strict file-disjointness, the test cases per command live in the SAME file; the integrate workflow serializes test-file edits OR each command's assertion is a separate `test/m94-d10-<cmd>-wiring.test.js` — SEE disjointness note below.)
- Intra-domain serial chain: T0 first (seam + test scaffold); T1–T6 parallel after.
- Estimated checkpoints: 1 (Wave-B reader wiring lands together).

## Disjointness note (shared test file)
**RE-PLAN-EXPANDED Fix-4:** `test/m94-d10-impact-consumption-proof.test.js` is a NEW file SOLE-OWNED by T1 (the consumption proof for the headline) — distinct from the shared manifest-driven `test/m94-d10-reader-wiring.test.js`; zero collision (T1 owns `commands/gsd-t-impact.md` + its own consumption-proof test file).

The shared `test/m94-d10-reader-wiring.test.js` is appended by T0–T6. To preserve strict file-disjointness at execute, EITHER (a) T0 owns the test file and T1–T6's per-command assertions are added by T0 as a data-driven loop over the manifest (T1–T6 own ONLY their command/workflow files; the test reads the manifest and asserts each row's command queries-not-greps), OR (b) split into per-command test files. **PLAN DECISION: option (a)** — the d10 test is MANIFEST-DRIVEN (reads the d8 consumer-manifest rows, asserts each reader-role row's command file directs its mapped structural verb + fails loud + passes the anti-grep lint). T0 owns the test; T1–T6 own only their command/workflow files. This makes the test auto-cover every reader row (no per-command test edit needed) and keeps file-disjointness clean — the same manifest-driven pattern as the d8 lint.
