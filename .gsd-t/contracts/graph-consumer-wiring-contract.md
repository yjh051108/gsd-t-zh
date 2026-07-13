# Contract: Graph Consumer Wiring

**Status:** DRAFT — authored by D8 in Wave A (foundation, written BEFORE any consumer wiring by d10/d11).
**Owner:** d8-wiring-contract-and-lint
**Consumers:** d10-reader-command-wiring, d11-writer-command-wiring (append manifest rows as they wire)
**Version:** 0.1.0 (DRAFT — Wave A foundation; the consumer-manifest table starts EMPTY here and is populated by d10/d11 as they wire each command)

## Purpose

The ONE shared wiring specification every code-reading command obeys. All ~19 code-reading commands wire against this contract instead of re-deriving their graph integration per command.

**Central Tenet:** the graph is the MANDATORY structural-knowledge layer for EVERY code-reading workflow step. Structural questions are answered by the graph, never by grep. Text-search grep stays legitimate.

This contract operationalizes two pseudocode rules from `PseudoCode-CodeGraphIndex.md`:
- `[RULE] query-cli-never-greps` — no grep fallback in the query CLI itself.
- `[RULE] parser-fail-disables-loud-never-silent` — graph-unavailable on a structural question fails loud.

## §READER Pattern — How code-reading commands consume the graph

A command that ASSESSES code structure (reads code to understand relationships, dependencies, dead code, call chains, cycles, clusters, or test↔implementation linkage) MUST:

1. **Call the graph query CLI** (`gsd-t graph <structural-verb>`) instead of grep/raw-read for the structural question. The supported structural verbs are:
   - `who-imports <file>` — file→file reverse import edges
   - `who-calls <file#function>` — function→function reverse call edges (file-qualified identity)
   - `blast-radius <target>` — downstream impact set (import ∪ call graph, transitive)
   - `dependents <file>` — alias for who-imports; files that depend on the target
   - `dead-code` — symbols/files with no live importers or callers
   - `orphan` — files with no incoming or outgoing edges (fully disconnected nodes)
   - `cycles` — strongly-connected components in the import or call graph
   - `cluster <file>` — the connected component containing the target file
   - `test-impl <file>` — the implementation file(s) a test file exercises (or vice versa)

2. **Inject the returned structural slice** into the worker-agent context. The injection seam is the brief/agent-context seam: the graph query result (a JSON envelope per `graph-query-cli-contract.md`) is passed to the agent BEFORE the agent reasons over the code. The agent receives the pre-computed structural slice alongside (or instead of) raw file reads for the structural question.

3. **Handle `{ok:false, reason:"graph-unavailable"}`** per the §FAIL-LOUD invariant below (hard-stop, no fallback).

### What READER wiring looks like in a command workflow

```
1. Call:   gsd-t graph <verb> <target>
2. Parse:  JSON envelope → check ok field
3. ok:true → inject results into agent context as structured slice
4. ok:false, reason:"graph-unavailable" → FAIL LOUD (§FAIL-LOUD invariant)
5. ok:false, reason:"ambiguous-function" → surface the candidates to the caller
```

The `gsd-t-phase.workflow.js` injection (d10-T0) makes this pattern binding in every wired command by injecting the structural slice into the agent context at spawn time. A `.md` directive alone is NOT sufficient — the machine-enforced deliverable is the injection seam + this anti-grep lint.

## §WRITER Pattern — How code-changing commands consume the graph

A command that CHANGES code does the §READER pattern PLUS, after edits land, triggers a re-index of the touched files:

1. **All §READER steps apply** (call the graph CLI for structural questions before the edit).
2. **After edits land**, trigger a freshness pass over the touched set:
   - Issue a `gsd-t graph` query/freshness invocation over the touched set, OR
   - Rely on the D4 freshness-on-query guarantee: `freshness_check_on_query` re-indexes any content-hash-dirty file BEFORE answering the next query, so the next structural query over a touched file auto-re-indexes it.
   - The WRITER pattern = "ensure a query/freshness pass runs over the touched set after edits" so downstream consumers see fresh edges (`graph-freshness-contract.md` D4 surface).

## §FAIL-LOUD Invariant — `[RULE] consumer-structural-grep-removed`

**Structural-grep is REMOVED from the code-assessment path of every wired command.**

When the graph query CLI returns `{ok:false, reason:"graph-unavailable"}` for a STRUCTURAL question:
- The command FAILS LOUD: surfaces the message "graph unavailable — fix it (`gsd-t graph status`)" and halts.
- The command does NOT fall back to grep for the structural question. EVER.
- There is no silent degradation. The user learns the graph is broken NOW, not after receiving a structurally-wrong answer.

This is the M20–M21 lesson encoded as a hard invariant: the prior graph systems silently fell back to grep when the index was absent, producing structurally-wrong answers presented as facts. That failure mode is CLOSED.

**This invariant is enforced by `bin/gsd-t-graph-anti-grep-lint.cjs`** which scans every wired command file and workflow file for a `try graph-query → catch/else → structural grep` fallback pattern and exits non-zero on any violation. See §Anti-Grep Lint below.

**Exceptions (both are ANNOUNCED, not silent):**

### Exception 1 — `/scan` announced-fallback carve-out (`[RULE] scan-announced-fallback-not-structural-grep`)

`/scan`'s grep-mode fallback on `graph-unavailable` (d6-scan-wiring) is EXEMPT from the FAIL-LOUD rule.

**Reason:** scan's deep-finders read every file for in-file LOGIC defects anyway (finding logic bugs requires reading the file; a relationship graph holds no logic content). When the graph is unavailable, scan announces the fallback ("graph unavailable — running in grep-mode"), continues its enumerate-and-deep-read pipeline, and surfaces its findings. This is an announced, non-silent, logic-read continuation — NOT a silent structural-grep substitution that hides a broken graph.

The lint exempts d6 scan files per this clause. A d6 file that does an UNANNOUNCED silent grep-fallback is NOT exempt — the carve-out is specifically for the announced grep-mode continuation.

### Exception 2 — `/verify` and `/integrate` announced-degradation (`[RULE] verify-integrate-graph-additive-announced-not-hard-fail`)

`/verify` and `/integrate` are exempt from the reader hard-stop rule.

**Reason:** these two commands must remain ALWAYS RUNNABLE. Graph queries in verify/integrate (dead-code/dangling detection, who-imports/blast-radius for dependency checks) ENRICH their gates but must NOT become a single point of failure that bricks verify. On `graph-unavailable`, these two commands:
- Record a WARNING: "graph unavailable — structural gate skipped, fix it (`gsd-t graph status`)"
- Continue with all non-graph gates (type checks, tests, CI parity, etc.)
- Do NOT hard-fail the whole run solely due to graph unavailability

This is the ONLY exception to the reader hard-stop rule. It applies to EXACTLY these two commands (`/verify` and `/integrate`). No other command may claim this exception.

## §Grep Distinction — `[RULE] text-search-grep-still-legitimate`

The FAIL-LOUD invariant applies ONLY to structural-grep. Plain text search remains legitimate.

| Question class | Correct tool | Forbidden alternative |
|---|---|---|
| Who imports file X? | `gsd-t graph who-imports X` | grep for `import.*X` |
| Who calls function foo? | `gsd-t graph who-calls file#foo` | grep for `foo(` across the codebase |
| What files are in the same cluster as X? | `gsd-t graph cluster X` | grep for shared import patterns |
| Which symbols are dead code? | `gsd-t graph dead-code` | grep for symbols with no references |
| Which files form cycles? | `gsd-t graph cycles` | grep/read to reconstruct dependency chains |
| Find all TODOs in the codebase | grep `TODO` | (no graph equivalent — text content) |
| Find all uses of constant MAX_RETRIES | grep `MAX_RETRIES` | (no graph equivalent — text content) |
| Find files containing a magic string | grep `'magic-string'` | (no graph equivalent — text content) |
| Find config value across YAML files | grep for the config key | (no graph equivalent — text content) |

**The anti-grep lint classifies by QUESTION CLASS, not by the presence of the word "grep":**
- A grep that answers a STRUCTURAL question (import, call, dependency, dead-code, cycle, cluster, test-impl) in a graph-query FALLBACK position → VIOLATION.
- A grep that answers a TEXT question (string literal, TODO, config value, magic constant) → LEGITIMATE.
- A comment mentioning grep → LEGITIMATE (obviously).

**Structural question in a fallback position** means: the grep appears in a `catch`/`else`/`|| grep` branch AFTER a failed `gsd-t graph <structural-verb>` call, OR the grep's pattern is a structural query (import pattern, function call pattern, dependency structure).

## §Anti-Grep Lint

`bin/gsd-t-graph-anti-grep-lint.cjs` is the machine enforcement of §FAIL-LOUD.

It:
1. Reads the wired-file set from the §Consumer Manifest table below (manifest-driven, NOT hardcoded).
2. Scans each listed file for a `try graph-query → catch/else → structural grep` fallback.
3. Returns `{ok:false, violations:[{file, line, evidence}]}` and exits non-zero on any violation.
4. Returns `{ok:true, violations:[]}` and exits 0 when the wired-file set is clean.

The lint is callable by `gsd-t-verify-gate.cjs` and `gsd-t-build-coverage.cjs` as a FAIL-blocking check. It is exercised by `test/m94-d8-anti-grep-lint.test.js`.

## §Directive-Not-Dead-Prose (`[RULE] directive-binding-requires-machine-enforcement`)

A command `.md` directive stating "use the graph CLI for structural questions" is NOT binding on its own — prose directives are ignored when convenient, which is the M20–M21 failure pattern.

A directive is BINDING by two real-code artifacts:
1. **`gsd-t-phase.workflow.js` injection (d10-T0):** the workflow injects the graph structural slice into the agent context at spawn time, so the agent receives the pre-computed answer and has no reason to grep.
2. **This anti-grep lint:** the lint scans every wired file and fails the build if a structural-grep fallback exists.

The `.md` directive is the human-readable half; the injection seam + lint are the machine-enforced deliverable. Without both artifacts, the directive is dead prose.

## §Consumer Manifest

This table is the lint's input. The lint reads it at runtime — adding a row here auto-extends lint coverage. A wired file cannot escape the gate by being omitted.

**d10 (reader-command-wiring) and d11 (writer-command-wiring) APPEND their rows here as they wire each command.** This table is the shared register for the wired-file set.

| Command File | Workflow File | Role | Structural Verbs Used | Replaces Structural Grep For |
|---|---|---|---|---|
| `commands/gsd-t-impact.md` | `templates/workflows/gsd-t-phase.workflow.js` | reader | `blast-radius` | grep-reconstructed dependent set for downstream-effect analysis |
| `commands/gsd-t-plan.md` | `templates/workflows/gsd-t-phase.workflow.js` | reader | `who-imports,blast-radius` | grep-reconstructed dependency ordering for task sequencing |
| `commands/gsd-t-feature.md` | `templates/workflows/gsd-t-phase.workflow.js` | reader | `blast-radius,who-imports` | grep-reconstructed blast-radius/dependent discovery for feature impact |
| `commands/gsd-t-gap-analysis.md` | `templates/workflows/gsd-t-phase.workflow.js` | reader | `who-imports,dead-code` | grep/filesystem dead-code discovery and dependency reconstruction for gap analysis |
| `commands/gsd-t-partition.md` | `templates/workflows/gsd-t-phase.workflow.js` | reader | `cluster` | LLM-reconstructed file-coupling for domain-boundary decisions |
| `commands/gsd-t-project.md` | `templates/workflows/gsd-t-phase.workflow.js` | reader | `cluster` | LLM-estimated coupling for milestone decomposition |
| `commands/gsd-t-populate.md` | `templates/workflows/gsd-t-phase.workflow.js` | reader | `who-imports,cluster` | grep/filesystem-scan for import/coupling structure during doc population |
| `commands/gsd-t-promote-debt.md` | `templates/workflows/gsd-t-phase.workflow.js` | reader | `blast-radius` | grep-reconstructed caller-count for debt impact scoping |
| `commands/gsd-t-prd.md` | `templates/workflows/gsd-t-phase.workflow.js` | reader | `cluster` | LLM-estimated structure for PRD decomposition |
| `commands/gsd-t-qa.md` | `templates/workflows/gsd-t-phase.workflow.js` | reader | `dead-code,dangling` | grep/filesystem dead-code discovery for QA coverage gap analysis |
| `commands/gsd-t-verify.md` | `templates/workflows/gsd-t-verify.workflow.js` | reader | `dead-code,dangling` | grep-based dead-code/dangling detection (carve-out: announced WARNING on unavailable) |
| `commands/gsd-t-integrate.md` | `templates/workflows/gsd-t-integrate.workflow.js` | reader | `who-imports,blast-radius` | LLM-read-reconstructed cross-domain wiring verification (carve-out: announced WARNING on unavailable) |
| `commands/gsd-t-execute.md` | `templates/workflows/gsd-t-execute.workflow.js` | writer | `blast-radius,who-imports` | grep/raw-read structural dependency reconstruction for file-disjointness (the SAFETY-CRITICAL seam — graph-aware transitive overlap, fail-loud halt on graph-unavailable) |
| `commands/gsd-t-wave.md` | `templates/workflows/gsd-t-wave.workflow.js` | writer | `blast-radius,who-imports` | inherits execute's graph-aware disjointness; re-indexes touched files after each domain's edits |
| `commands/gsd-t-debug.md` | `templates/workflows/gsd-t-debug.workflow.js` | writer | `blast-radius,who-calls` | grep-reconstructed call-chain for bug localization (READER half) + re-index after fix lands (WRITER half) |
| `commands/gsd-t-quick.md` | `templates/workflows/gsd-t-quick.workflow.js` | writer | `blast-radius,who-imports` | grep/raw-read structural impact assessment before editing (READER half) + re-index touched files after edits (WRITER half) |
| `commands/gsd-t-test-sync.md` | `templates/workflows/gsd-t-phase.workflow.js` | writer | `test-impl,untested-impl` | grep/filesystem test-discovery and coverage-gap detection; replaced by test-impl (which test exercises which impl) + untested-impl (impl funcs with no test) graph verbs + re-index after test writes |
| `commands/gsd-t-design-build.md` | `templates/workflows/gsd-t-phase.workflow.js` | writer | `who-imports,cluster` | grep/raw-read structure before generating code; replaced by who-imports/cluster graph query + re-index of generated files |

### Manifest schema (machine-parsed by the lint)

Each data row (non-header, non-separator, non-placeholder) must have exactly 5 pipe-separated columns:

| Column | Type | Description |
|---|---|---|
| `command-file` | path | Relative path to the `.md` command file (e.g. `commands/gsd-t-impact.md`) |
| `workflow-file` | path | Relative path to the `.workflow.js` file (e.g. `templates/workflows/gsd-t-impact.workflow.js`) |
| `role` | `reader` or `writer` | Whether the command reads-only (READER pattern) or reads+writes (WRITER pattern) |
| `structural-verbs` | comma-separated verbs | Which structural verbs the command uses (from §READER Pattern verb list) |
| `replaces-grep-for` | description | Plain-language description of what structural grep this wiring REPLACES |

The lint skips rows where `command-file` contains `_(` (placeholder rows) or is empty.

### Lint exemptions (tracked here, respected by the lint)

| Exemption | Files | Reason |
|---|---|---|
| `/scan` announced-fallback | `commands/gsd-t-scan.md`, `templates/workflows/gsd-t-scan.workflow.js` | §`/scan` carve-out — announced, non-silent, logic-read continuation on graph-unavailable |
| `/verify` + `/integrate` degradation | `commands/gsd-t-verify.md`, `templates/workflows/gsd-t-verify.workflow.js`, `commands/gsd-t-integrate.md`, `templates/workflows/gsd-t-integrate.workflow.js` | §`/verify` + `/integrate` carve-out — announced WARNING, non-blocking degradation on graph-unavailable |

## §Broken-vs-Absent Split — `graph-absent` HALTS nothing, `graph-broken` HALTS everything

**Source-of-truth:** `.gsd-t/pseudocode/PseudoCode-BrokenGraphHalts.md`.

Previously a BROKEN graph (CLI crashes on a missing dependency, or the store is corrupt) and an
ABSENT graph (never indexed) both collapsed to `reason:"graph-unavailable"`, and every consumer
silently fell back to grep. That is silent degradation (banned). The failure is now SPLIT into two
reason codes, classified at ONE producer seam + ONE delegation seam, routed through ONE shared helper.

### The two reason codes (produced at the seams, never fabricated)

| Reason | Meaning | Routing |
|---|---|---|
| `graph-absent` | No store file on disk — the repo was never indexed | **ABSENT** → auto-build once (`gsd-t graph index`), re-query, continue. A SECOND consecutive absent (build failed / still absent) is reclassified BROKEN. |
| `graph-broken` | Store present-but-unreadable (corrupt), a CLI crash (missing `require` → exit≠0 + `MODULE_NOT_FOUND`), or any unknown reason | **BROKEN** → HALT (`blocked-needs-human`), surface "graph BROKEN — run `gsd-t graph status`". NEVER grep-fallback. |

### The three seams

1. **Producer edge** — `bin/gsd-t-graph-query-cli.cjs` `loadStore()` / `runFreshnessCheck()`:
   `storePath === null` → `graph-absent`; store present but `loadSqliteStore`/`loadJsonlStore` returned
   null, or a parse/corrupt/index-build throw → `graph-broken` (with `detail`). The main-entry `fail()`
   propagates the granular reason instead of collapsing to `graph-unavailable`.
2. **Delegation edge** — `bin/gsd-t.js` `_graphQueryCli()`: parses stdout FIRST (trusts the producer's
   granular reason even on a non-zero exit that still emitted an envelope). A true crash (spawn error, or
   non-zero exit with no envelope, or non-JSON stdout) → `graph-broken` carrying `result.stderr`. It no
   longer fabricates `graph-unavailable`.
3. **Shared classifier** — `bin/gsd-t-graph-availability.cjs` exports `classifyGraphFailure(reason)`
   → `{state:"ABSENT"|"BROKEN", action}` and `isTransient(detail)`. It is the ONE place the absent-vs-broken
   decision lives; every consumer routes `envelope.reason` through it (the sandboxed workflows via its
   `classify` CLI arm over Bash, the non-sandboxed `gsd-t-file-disjointness.cjs` via `require`). Added to
   `PROJECT_BIN_TOOLS` so it ships to every project.

### Consumer routing

- **Structural readers** (`quick`, `debug`, `phase`): on `ok:false`, classify. ABSENT → build once + re-query;
  still absent → BROKEN. BROKEN → HALT the workflow (`blocked-needs-human`). No grep fallback.
- **Disjointness** (`gsd-t-file-disjointness.cjs`, used by `execute`/`wave` via `gsd-t parallel --dry-run`):
  ABSENT → auto-build once + re-check; BROKEN → HALT fan-out (`gsd-t-parallel.cjs` exits non-zero, refusing an
  unprovable plan) unless the operator passes the announced `--disjointness-fallback=touches-only` escape hatch.
- **EXEMPT carve-out consumers** (`scan`, `verify`, `integrate`): keep their ANNOUNCED grep/skip continuation on
  ABSENT, but on BROKEN emit a LOUD warning that NAMES it BROKEN ("not merely un-indexed — fix it"), never silently
  continuing as if it were absent.

### [RULE] guard map (feeds the deterministic verify gate)

- `[RULE] broken-graph-halts-never-greps` — a `graph-broken` reason NEVER takes a grep-fallback branch in any of
  the 9 consumers (except the announced verify/integrate/scan carve-out, which must NAME it BROKEN loudly).
- `[RULE] absent-graph-auto-builds-once` — a `graph-absent` reason triggers exactly one `gsd-t graph index` then
  re-query; a second consecutive absent = BROKEN.
- `[RULE] crash-classified-not-fabricated` — `_graphQueryCli` MUST inspect `result.status`/`result.stderr`; a
  non-zero exit with no valid envelope maps to `graph-broken`, never `graph-unavailable`.
- `[RULE] unknown-reason-fails-closed-to-broken` — any unrecognised `ok:false` reason (incl. legacy
  `graph-unavailable`) classifies as BROKEN (HALT), never ABSENT (continue).
- `[RULE] one-availability-classifier` — the absent-vs-broken decision lives in ONE helper
  (`bin/gsd-t-graph-availability.cjs`); no consumer re-implements the string check.
- `[RULE] false-broken-guarded` — transient failures (`SQLITE_BUSY` / lock / timeout) are retried ONCE before
  classifying BROKEN, so a slow/locked query does not wrongly HALT all work.

## Consumed (frozen)

- `graph-query-cli-contract.md` (D5) — the JSON envelope this contract's readers consume
- `graph-freshness-contract.md` (D4) — the `freshness_check_on_query` the WRITER pattern relies on
- `PseudoCode-CodeGraphIndex.md` — the milestone source-of-truth whose `[RULE]` entries this contract operationalizes
