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
| _(d10/d11 append rows here)_ | | | | |

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

## Consumed (frozen)

- `graph-query-cli-contract.md` (D5) — the JSON envelope this contract's readers consume
- `graph-freshness-contract.md` (D4) — the `freshness_check_on_query` the WRITER pattern relies on
- `PseudoCode-CodeGraphIndex.md` — the milestone source-of-truth whose `[RULE]` entries this contract operationalizes
