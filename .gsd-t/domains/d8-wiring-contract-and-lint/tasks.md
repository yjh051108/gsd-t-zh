# Tasks: d8-wiring-contract-and-lint (WAVE A — foundation, BEFORE any consumer wiring)

## Summary
When all tasks complete: (1) ONE shared `graph-consumer-wiring-contract.md` defines the READER pattern (assess code → query the graph CLI, never structural-grep), the WRITER pattern (reader pattern + fire a re-index of touched files after edits), and the FAIL-LOUD invariant (structural-grep removed from the assessment path; graph-unavailable on a structural question fails loud, never silent grep) — with the explicit TEXT-search-grep-still-legitimate carve-out and the `/scan` announced-fallback carve-out; (2) a deterministic anti-grep lint (`bin/gsd-t-graph-anti-grep-lint.cjs` + `test/m94-d8-anti-grep-lint.test.js`) FAILS the build if any wired command contains a `try graph → catch → structural grep` fallback, reading the wired-file set from the contract's manifest (not a hardcoded list) so coverage auto-extends as d10/d11 wire commands. This domain is written FIRST so the consumer wiring lands against a settled contract and is gated from the first commit.

## Wave A

### M94-D8-T1 — Shared graph-consumer wiring contract (READER / WRITER / FAIL-LOUD)
- **Status**: [ ] pending
- **Headline**: false
- **Files**: `.gsd-t/contracts/graph-consumer-wiring-contract.md`
- **Touches**: `.gsd-t/contracts/graph-consumer-wiring-contract.md`
- **ImplPath**: `.gsd-t/contracts/graph-consumer-wiring-contract.md` — the single source-of-truth wiring contract: §READER pattern, §WRITER pattern, §FAIL-LOUD invariant, §grep distinction (structural vs text), §`/scan` announced-fallback carve-out, §consumer manifest table (the wired-file set the lint reads)
- **Test**: `test/m94-d8-anti-grep-lint.test.js` (T3 — shared) — the contract's consumer-manifest table is parsed by the lint; the test asserts the manifest is non-empty and well-formed (every row = command + workflow file + reader|writer role + the structural verb(s) it uses), so the contract is not dead prose
- **Contract refs**: graph-query-cli-contract.md (D5 envelope), graph-query-cli extensions (D9 verbs — cluster/orphan/test-impl)
- **Dependencies**: none (foundation — written first in Wave A)
- **Acceptance criteria**:
  - **§READER pattern**: a command that ASSESSES code structure calls the graph query CLI (`who-imports` / `who-calls` / `blast-radius` / `dependents` / `dead-code`/`orphan` / `cycles` / `cluster` / `test-impl`) and injects the returned structural slice into its worker-agent context — INSTEAD of grep/raw-read for the structural question. Declares HOW the slice is injected (the brief/agent-context seam) so readers wire uniformly.
  - **§WRITER pattern**: a command that CHANGES code does the READER pattern PLUS, after edits land, fires a re-index of the touched files (the D4 freshness path — content-hash dirty-detection re-indexes touched files on the next query, so the WRITER pattern = "ensure a query/freshness pass runs over the touched set after edits" so downstream consumers see fresh edges). Declares the exact re-index trigger (a `gsd-t graph` query/freshness invocation over the touched set, or the freshness-on-query guarantee, whichever the D4 contract exposes).
  - **§FAIL-LOUD invariant** (`[RULE] consumer-structural-grep-removed`): structural-grep is REMOVED from the code-assessment path of every wired command. On `{ok:false, reason:"graph-unavailable"}` for a STRUCTURAL question, the command FAILS LOUD ("graph unavailable — fix it") and does NOT fall back to grep. Declared as the keystone invariant the lint enforces.
  - **§grep distinction** (`[RULE] text-search-grep-still-legitimate`): plain TEXT search (string literal / TODO / config value / magic constant) STILL uses grep — the graph holds no text content. The contract states precisely which question-classes are structural (graph-only) vs textual (grep-ok), so the lint and the wiring agents both classify correctly.
  - **§`/scan` carve-out** (`[RULE] scan-announced-fallback-not-structural-grep`): `/scan`'s announced grep-MODE fallback on graph-unavailable (d6) is EXEMPT — scan reads every file for in-file logic anyway; its announced, non-silent, logic-read continuation is not a silent structural-grep fallback. The lint exempts the d6 scan files per this clause.
  - **§verify/integrate bootstrap carve-out** (`[RULE] verify-integrate-graph-additive-announced-not-hard-fail` — PRE-MORTEM Finding 3): `/verify` + `/integrate` graph queries (dead-code/dangling, who-imports/blast-radius) ENRICH their gates but must NOT become a single point of failure that bricks the always-runnable verify gate. On graph-unavailable these two degrade ANNOUNCED (record a WARNING "graph unavailable — structural gate skipped, fix it", do NOT hard-fail the whole run) — like scan, NOT like the other readers (which hard-stop). The contract states this is the ONLY exception to the reader hard-stop rule, and names exactly the two commands it applies to (so it is not a loophole the other readers can claim).
  - **§directive-not-dead-prose** (PRE-MORTEM Finding 1): the contract states that a command `.md` directive is made BINDING by two real-code artifacts — the `gsd-t-phase.workflow.js` injection (d10-T0) + this anti-grep lint — NOT by the prose alone. The manifest row (lint-enforced) + the injection seam are the machine-enforced deliverable; the `.md` directive is its human-readable half.
  - **§consumer manifest**: a TABLE enumerating every wired consumer = `{command-file | workflow-file | role: reader|writer | structural verbs used | what structural-grep it REPLACES}`. This table is the lint's input (T2/T3 read it) and the d10/d11 work-list. d10/d11 APPEND their rows as they wire (the table is the shared register, sole-edited here at authoring; readers/writers reference it).

### M94-D8-T2 — Anti-grep lint engine (deterministic, structural, manifest-driven)
- **Status**: [ ] pending
- **Headline**: true
- **Files**: `bin/gsd-t-graph-anti-grep-lint.cjs`, `test/m94-d8-anti-grep-lint.test.js`
- **Touches**: `bin/gsd-t-graph-anti-grep-lint.cjs`
- **ImplPath**: `bin/gsd-t-graph-anti-grep-lint.cjs` — reads the consumer-manifest table from `graph-consumer-wiring-contract.md`, scans each listed command-file + workflow-file for a `try graph-query → catch/else → grep (structural)` fallback, returns a JSON envelope `{ok, violations:[{file, line, evidence}]}`; exits non-zero on any violation (the build/verify gate calls this)
- **Test**: `test/m94-d8-anti-grep-lint.test.js` (T3)
- **Contract refs**: graph-consumer-wiring-contract.md (T1 — the manifest + the structural/text classification)
- **Dependencies**: M94-D8-T1 (the contract + manifest exist)
- **Acceptance criteria**:
  - **Structural, not substring** (`[RULE] anti-grep-lint-structural-not-substring`): flags ONLY a grep that answers a STRUCTURAL question in a graph-query fallback position (catch/else after a `gsd-t graph <structural-verb>` call, or a grep whose pattern is an import/call/dependency structural query). A comment mentioning grep, or a legitimate TEXT-search grep, does NOT trip it. (Follows the AC-5 D5 test's structural-parse approach — strip comments/strings, detect the fallback shape, not the word.)
  - **Manifest-driven, no hardcoded list** (`[RULE] anti-grep-lint-reads-manifest`): the wired-file set comes from the contract's consumer-manifest table at runtime — NOT a finite list literal in the engine. Adding a consumer row auto-extends coverage; a wired file cannot escape the gate by being omitted from a hardcoded array.
  - **Exempts the carve-outs**: respects the `/scan` announced-fallback clause (d6 files) and the text-search clause — never false-flags them.
  - **CLI envelope + non-zero exit**: returns `{ok:false, violations:[…]}` and exits non-zero when a structural-grep fallback is found; `{ok:true, violations:[]}` + exit 0 when clean. (Callable by the verify gate / build-coverage as a FAIL-blocking check.)
  - Node built-ins only (zero-dep invariant).
  - **(Headline for d8 — the lint ENGINE is the milestone's anti-regression keystone for the expanded scope; it is real non-test code (`bin/gsd-t-graph-anti-grep-lint.cjs`) exercised end-to-end by `test/m94-d8-anti-grep-lint.test.js` over the real wired-file set + the negative self-test fixtures in T3.)** A structural-grep fallback in ANY wired command makes the build RED via this engine.

### M94-D8-T3 — Anti-grep lint test (the killing test for the FAIL-LOUD invariant)
- **Status**: [ ] pending
- **Headline**: false
- **Files**: `test/m94-d8-anti-grep-lint.test.js`
- **Touches**: `test/m94-d8-anti-grep-lint.test.js`
- **ImplPath**: `test/m94-d8-anti-grep-lint.test.js` — drives `bin/gsd-t-graph-anti-grep-lint.cjs` over the real wired-file set (from the manifest) AND over crafted fixtures; the build FAILS if any wired command has a structural-grep fallback. This is the deterministic gate that makes "grep cannot silently creep back as a structural fallback" a build invariant rather than a hope.
- **Test**: `test/m94-d8-anti-grep-lint.test.js` (self — this IS the headline test)
- **Contract refs**: graph-consumer-wiring-contract.md (T1), the lint engine (T2)
- **Dependencies**: M94-D8-T2 (the lint engine), M94-D8-T1 (the manifest)
- **Acceptance criteria**:
  - Runs the lint over EVERY wired file in the contract manifest and asserts ZERO structural-grep-fallback violations — the build is RED if any wired command (current or future) reintroduces a structural-grep fallback.
  - **Mandatory negative self-test #1 (the green-can-go-red proof)**: a fixture containing a real `try { gsd-t graph who-imports … } catch { grep -r … }` structural fallback — assert the lint CATCHES it (`violations.length > 0`, file+line cited). A lint that never fires is worthless.
  - **Mandatory negative self-test #2 (no false-positive on text search)**: a fixture with a legitimate `grep -r "TODO"` / `grep "MAX_RETRIES"` text search — assert the lint does NOT flag it (`violations.length === 0`).
  - **Carve-out test**: a fixture mimicking `/scan`'s announced grep-mode fallback (announced, non-silent, logic-read) — assert the lint does NOT flag it (the d6 exemption holds).
  - **Manifest-coverage assertion**: asserts the lint's scanned-file set EQUALS the contract manifest's file set (no wired file silently skipped) — coverage is provably complete, the `feedback_coverage_check_structural_not_substring` lesson applied.

## Execution Estimate
- Total tasks: 3
- Independent tasks (no cross-domain blockers): T1 (foundation, no deps)
- Intra-domain serial chain: T1 → T2 → T3
- Estimated checkpoints: 0 (Wave-A foundation; lands with d9 before reader/writer wiring)
