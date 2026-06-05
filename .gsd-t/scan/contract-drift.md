# Contract Drift Analysis

**Scan date**: 2026-06-04
**Contracts directory**: `.gsd-t/contracts/` (64 files: 54 domain/feature contracts + 10 milestone integration-point files)
**Scope**: Compare every contract against its implementing code in `bin/`, `templates/workflows/`, `scripts/`, and `commands/`

---

## Summary

The contracts directory is present and well-populated. The majority of contracts are STABLE and accurately describe their implementations. However, six contracts have confirmed drift against the code, three contracts reference deleted modules, one contract has a stale KINDS enumeration, and one critical cross-contract dependency (`headless-default-contract.md`) is referenced but does not exist in the directory.

---

## 1. Confirmed Contract-to-Code Drift

### 1.1 context-brief-contract.md - KINDS list stale (6 listed, 11 implemented)

**Contract**: `.gsd-t/contracts/context-brief-contract.md`
**Severity**: HIGH
**Field in drift**: Line 37 `KINDS` constant

The contract declares:
```
KINDS: ['design-verify','execute','qa','red-team','scan','verify']
```

Actual directory contents of `bin/gsd-t-context-brief-kinds/`:
```
design-verify.cjs, discuss.cjs, execute.cjs, impact.cjs, milestone.cjs,
partition.cjs, plan.cjs, qa.cjs, red-team.cjs, scan.cjs, verify.cjs
```

Five kinds added in M56 D2 (`discuss`, `impact`, `milestone`, `partition`, `plan`) are present on disk but absent from the contract's KINDS list. The CLI description at lines 54-55 says `--kind X` must be one of KINDS - any tooling or documentation consumer relying on this list will have an incomplete picture.

**Fix needed**: Update KINDS array in the contract to all 11 kinds. Update the `--domain` requirement matrix to cover the five new kinds. Bump to v1.1.0 (additive).

---

### 1.2 model-selection-contract.md - Phase map diverges from bin/model-selector.js

**Contract**: `.gsd-t/contracts/model-selection-contract.md`
**Severity**: HIGH
**Field in drift**: Phase Map table (lines 172-188 in contract vs lines 72-120 in `bin/model-selector.js`)

The contract Phase Map (Status: ACTIVE, v1.0.0) declares:
- `plan` -> `opus` (rationale: "Task decomposition - cost of a bad plan is domino-effect rework")
- `impact` -> `opus` (rationale: "Cross-module blast-radius analysis")
- `complete-milestone` -> `opus` (rationale: "goal-backward verification")
- `scan`, `backlog-promote` -> each listed in canonical sonnet/haiku tiers

`bin/model-selector.js` PHASE_RULES (line 104):
```js
{ phase: "plan", model: TIERS.SONNET, reason: "Task decomposition is structured work...", hasEscalation: true },
```

And `impact`, `complete-milestone`, `scan`, `backlog-promote` have NO rules at all - they fall through to `DEFAULT_TIER` (sonnet).

The contract Schema Freeze Policy explicitly states: "Changes to the canonical assignments must be reflected in both this contract and `bin/model-selector.js` atomically." This invariant is violated. `selectModel({phase:'plan'})` returns `sonnet`; `selectModel({phase:'impact'})` returns `sonnet` with `reason: 'Unknown phase'`.

**Fix needed**: Either update `bin/model-selector.js` to add opus rules for `impact`, `complete-milestone`, and change `plan` from sonnet to opus - OR formally update the contract to reflect the sonnet-for-plan decision with rationale. Both files must match atomically.

---

### 1.3 verify-gate-contract.md - Track 2 plan missing playwright.config.mjs detection

**Contract**: `.gsd-t/contracts/verify-gate-contract.md`
**Severity**: HIGH
**Field in drift**: Track 2 default plan (Worker id: playwright)

The contract lists three Playwright config filenames that trigger E2E inclusion (from the "Off-the-Shelf CLIs" table). The implementation at `bin/gsd-t-verify-gate.cjs` line 282:
```js
if (has('playwright.config.ts') || has('playwright.config.js') || has('playwright.config.cjs')) {
```

Neither the contract nor the code includes `playwright.config.mjs`, which is a valid Playwright configuration format for ESM projects. A project using this format silently skips E2E in Track 2, violating the E2E Enforcement Rule. The contract should enumerate all four variants.

**Fix needed**: Add `playwright.config.mjs` to both the contract Worker table and the detection check in `bin/gsd-t-verify-gate.cjs` line 282.

---

### 1.4 graph-storage-contract.md - isStale() does not check deleted files

**Contract**: `.gsd-t/contracts/graph-storage-contract.md`
**Severity**: HIGH
**Rule in drift**: Rule 3 "isStale() MUST compare file content hashes, not modification times"

The contract says `isStale(sourceFiles)` must detect stale state. The implementation in `bin/graph-store.js` lines 123-135:

```js
function isStale(root, sourceFiles) {
  const meta = readMeta(root);
  if (!meta || !meta.fileHashes) {
    return { stale: true, changedFiles: sourceFiles };
  }
  const changed = [];
  for (const f of sourceFiles) {    // iterates CURRENT files only
    const hash = hashFile(f);
    const rel = path.relative(root, f);
    if (hash !== meta.fileHashes[rel]) changed.push(f);
  }
  return { stale: changed.length > 0, changedFiles: changed };
}
```

The function iterates `sourceFiles` (currently-existing files) but never checks whether any key in `meta.fileHashes` is absent from `sourceFiles`. If a file was deleted since the last index, it is simply missing from the comparison - `isStale` returns `false` and dead entities from the deleted file persist in the graph indefinitely.

The contract Rule 3 says "compare file content hashes" but does not explicitly address deletion detection - this is an omission in the contract and a bug in the implementation.

**Fix needed**: Contract should add Rule 3a: "isStale() MUST also check that every key in meta.fileHashes has a corresponding live file; absent keys indicate stale state." Implementation must iterate `meta.fileHashes` keys and flag missing files as changed.

---

### 1.5 graph-storage-contract.md - Write operations are not atomic (no tmp+rename)

**Contract**: `.gsd-t/contracts/graph-storage-contract.md`
**Severity**: HIGH
**Rule in drift**: Rules 1-2 (implied correctness on partial writes)

The contract lists 8 write operations (`writeIndex`, `writeCalls`, etc.) but specifies no atomicity requirement. The implementation uses plain `fs.writeFileSync` (line 45 in `bin/graph-store.js`). If the process is killed between any two of the 8 sequential writes, the store is left in a partially-updated state. `meta.json` (written last by `bin/graph-indexer.js`) is the de-facto commit marker, but if `index.json` is truncated mid-write before `meta.json` exists, `nativeAvailable()` returns false and all queries silently return empty.

**Fix needed**: Contract should add an atomicity rule: "All write operations MUST use a tmp+rename pattern (write to `{file}.tmp.{pid}`, then rename). `meta.json` MUST be written last - its presence signals a complete write set." Implementation needs `writeFile` updated to use `path+'.tmp'` -> `renameSync`.

---

### 1.6 progress-file-format.md - Three concrete omissions vs live format

**Contract**: `.gsd-t/contracts/progress-file-format.md`
**Severity**: HIGH
**Fields in drift**: Status enum, Completed Milestones schema, Date format

Three confirmed discrepancies:

(a) **Missing ACTIVE status**: The Valid Status Values table (lines 29-45) does not include `ACTIVE`. The live `.gsd-t/progress.md` uses `## Status: ACTIVE - M79 COMPLETED...`. The `cli-preflight-checks/contracts-stable.cjs` specifically looks for `Status: ACTIVE` to determine past-PARTITIONED state.

(b) **Missing Summary column**: Completed Milestones table schema (line 78) shows 4 columns `{name} | {version} | {YYYY-MM-DD} | v{version}`. The actual table in `.gsd-t/progress.md` has 5 columns: `Milestone | Version | Completed | Tag | Summary`.

(c) **Stale Date format**: `## Date:` field (line 21) shows `{YYYY-MM-DD}`. CLAUDE.md M59 (v3.29.10+) mandates `YYYY-MM-DD HH:MM TZ` for all new entries.

**Fix needed**: Add `ACTIVE` to Valid Status Values. Add Summary column to Completed Milestones schema. Update Date format to `{YYYY-MM-DD HH:MM TZ}` with a note that this is forward-only (pre-existing rows stay date-only).

---

### 1.7 parallel-cli-contract.md - captureSpawn invariant broken by retired module

**Contract**: `.gsd-t/contracts/parallel-cli-contract.md`
**Severity**: HIGH
**Rule in drift**: "Every worker spawn flows through bin/gsd-t-token-capture.cjs::captureSpawn"

The contract STABLE v1.0.0 states this as a hard invariant. However, `bin/gsd-t-token-capture.cjs` was retired in M61 D2 (confirmed in CHANGELOG v4.0.10). The file does not exist in `bin/`. The contract's captureSpawn invariant section still references it as the mandatory wrapper, but `bin/parallel-cli.cjs` cannot satisfy this rule if the module is gone.

The contract was promoted STABLE on the premise this module exists. Its retirement without a contract update creates a permanent contradiction between the STABLE contract and the live implementation.

**Fix needed**: Contract needs a version bump (at minimum to v1.1.0) acknowledging the retirement of `gsd-t-token-capture.cjs` in M61 and replacing the captureSpawn invariant with the current mechanism (or documenting that token capture for CLI workers is no longer performed).

---

### 1.8 stack-rules-contract.md - "Commands That Must Implement Detection" is dead for Workflow-era commands

**Contract**: `.gsd-t/contracts/stack-rules-contract.md`
**Severity**: HIGH
**Section in drift**: "Commands That Must Implement Detection" (lines 88-95)

The contract lists 5 commands that must inject stack rules: `gsd-t-execute`, `gsd-t-quick`, `gsd-t-integrate`, `gsd-t-wave`, `gsd-t-debug`. The contract describes a Bash detection script pattern.

Post-M61, all 5 commands delegate to Workflow scripts (`templates/workflows/`). The stack detection logic lives in `bin/gsd-t-task-brief.js::detectStack()` + `loadStackRules()`, which is called only by the legacy `bin/gsd-t-task-brief.js` path (used in tests only, not by any production Workflow). The Workflow scripts (`gsd-t-execute.workflow.js`, etc.) build agent prompts from `lib.readScope()` + `lib.readDomainTasks()` + a context brief - none carry stack rules. `templates/workflows/_lib.js` has no stack-detection function.

The contract says these 5 commands implement detection; they do not in practice.

**Fix needed**: Contract must be updated to reflect M61 reality: either (a) note that stack rule injection is currently bypassed for Workflow-era invocations and track as tech debt, or (b) document the correct injection point (a new `detectAndLoadStackRules(projectDir)` function in `_lib.js` threaded into every `agent()` prompt). The current contract is misleading about a non-functional feature.

---

## 2. Contracts Referencing Deleted or Non-Existent Modules

### 2.1 unattended-supervisor-contract.md - References deleted bin modules

**Contract**: `.gsd-t/contracts/unattended-supervisor-contract.md` (v1.5.0, Status: ACTIVE)
**Severity**: CRITICAL

The contract references `bin/supervisor-pid-fingerprint.cjs` (v1.4.1 section, line 624) as the module that upgrades the PID file to JSON fingerprint format. This module was deleted in M61 D2. Correspondingly, `commands/gsd-t-unattended.md` Step 2 requires it and crashes with MODULE_NOT_FOUND. The contract is ACTIVE and describes a supervisor that cannot launch.

The contract also references `headless-default-contract.md` (line 7 "Depends on") which does not exist in `.gsd-t/contracts/` (see section 3.1 below).

---

### 2.2 token-budget-contract.md - References bin/runway-estimator.js which does not exist

**Contract**: `.gsd-t/contracts/token-budget-contract.md` (v3.1.0, Status: ACTIVE)
**Severity**: HIGH

Line 7 of the contract lists consumers: `bin/runway-estimator.js (M35 Wave 3)`. This file does not exist in `bin/`. Several command files also call `bin/runway-estimator.cjs` (with the `.cjs` extension in some references), and `gsd.md` references `bin/runway-estimator.cjs` for dialog-growth warning in Step 5. Neither form exists in `bin/`. The contract consumer list is partially dead.

---

### 2.3 context-brief-contract.md - captureSpawn Exemption references a deleted module

**Contract**: `.gsd-t/contracts/context-brief-contract.md` (v1.0.0, Status: STABLE)
**Severity**: MEDIUM

Section "captureSpawn Exemption" (lines 146-153) references `bin/gsd-t-token-capture.cjs` as the wrapper that brief generation is exempt from. This module was retired in M61. The exemption section is now vacuously true (there is nothing to be exempt from), but a future implementer reading the contract would expect `gsd-t-token-capture.cjs` to exist. The reference should be updated to note the module was retired.

---

## 3. Missing Contracts (Referenced but Not Present)

### 3.1 headless-default-contract.md - Cited by 3 contracts, not in directory

**Referenced by**: `unattended-supervisor-contract.md` line 7, `iter-parallel-contract.md` line 7, `watch-progress-contract.md` line 294

The dependency chain `unattended-supervisor-contract` -> `headless-default-contract.md` v1.0.0/v2.0.0 is a broken link. Three contracts cite it as an active dependency. The file does not exist in `.gsd-t/contracts/`.

**De-facto interface worth documenting**: The headless spawn pattern is currently embodied in `bin/gsd-t.js::doHeadlessExec()` (which correctly passes `--dangerously-skip-permissions`) and `spawnClaudeSession()` (which does not). A contract covering: required flags (`--output-format stream-json --verbose --dangerously-skip-permissions`), exit code semantics, spawn observable pattern, and `GSD_T_*` env propagation would close this gap.

---

### 3.2 context-meter-contract.md - Referenced by token-budget-contract.md, not in directory

**Referenced by**: `token-budget-contract.md` lines 10, 17 (references `context-meter-contract.md` "Stale Band and Resume Gating")

The token-budget contract v3.1.0 refers to `context-meter-contract.md` for the full rationale of the `stale` band. This file is not in `.gsd-t/contracts/`. Given that the context meter itself was retired in M61, this reference is to a document that should exist as a retirement notice or should be struck from the token-budget contract changelog.

---

### 3.3 worktree-isolation-contract.md - Status: DRAFT, implementation absent

**Contract**: `.gsd-t/contracts/worktree-isolation-contract.md`
**Severity**: MEDIUM

This contract exists in the directory with DRAFT status. Its implementation (`bin/worktree-isolation.cjs` or equivalent) is not present in `bin/`. The contract is referenced nowhere else. It appears to be a planning document for a feature that was never built.

**De-facto interface**: Worktrees are used as isolated build contexts for parallel agent work. The relevant isolation behavior today lives in the Workflow system's task-isolation approach (file-disjointness prover, per-domain `teeDir`). This contract should either be updated to describe actual worktree isolation behavior or marked PROPOSED-ABANDONED.

---

## 4. De-Facto Interfaces Worth Documenting (No Contract Exists)

### 4.1 Workflow script sandbox API (no contract)

The six GSD-T Workflow scripts (`gsd-t-execute.workflow.js` etc.) operate inside the Anthropic native Workflow sandbox, which bans `require()`, `module`, `fs`, `path`, `child_process`, and `process`. The only migrated script (`gsd-t-scan.workflow.js`) includes a comment documenting this (lines 3-6). There is no formal contract.

The sandbox API that IS available (documented only in `gsd-t-scan.workflow.js` comments) includes: `Workflow()`, `parallel()`, `agent()`, `series()`, `meta`, `args` global, schema-validated output. A contract covering the sandbox boundary would have caught the CRITICAL M71 bug (all other workflows still use `require()`).

**Interface worth documenting**:
- Banned globals: `require`, `module.exports`, `fs.*`, `path.*`, `child_process.*`, `process.execPath`, `spawnSync`, `execFileSync`
- Available globals: `Workflow`, `parallel`, `agent`, `series`, `meta`, `args`
- Agent call signature: `agent(prompt, {label, phase, schema, model})`
- Model values: `"haiku"` / `"sonnet"` / `"opus"`
- `args` shape per workflow (currently undocumented)

---

### 4.2 gsd-t-scan.workflow.js volume-probe output shape (no contract)

`templates/workflows/gsd-t-scan.workflow.js` is the only Workflow that correctly runs in the sandbox. It produces a volume-probe result and uses it to fan out slices. The shape of the volume-probe output and the slice schema are undocumented. Downstream agents (scan deep-finder) consume this shape; any change breaks the scan pipeline with no contract to catch it.

---

### 4.3 Context brief schema for the five new kinds (no addendum)

The five kinds added in M56 (`discuss`, `impact`, `milestone`, `partition`, `plan`) each have a `.cjs` collector in `bin/gsd-t-context-brief-kinds/` but no documented schema for their `ancillary` field. The master contract documents only the six original kinds fail-open/fail-closed behavior. The `--domain` requirement for the new kinds is unspecified.

---

### 4.4 gsd-t-verify-gate.cjs _shapeTrack2 false-pass on empty results (undocumented behavior vs contract)

**Contract**: `verify-gate-contract.md` line 115-119 ("ok - Strictly track1.ok && track2.ok. No LLM influence")

The implementation has a latent false-pass: when `runParallel` throws an exception, `_shapeTrack2` receives `{ok: false, results: []}`. Inside `_shapeTrack2`, `workers = [].map(...)` produces `[]`, and `[].every(...)` is vacuously true per JavaScript spec. This makes `track2Ok = true` even though `envelope.ok = false`. The contract says `ok` is "purely deterministic" and "no LLM influence" - but it implicitly assumes `runParallel` never produces empty results. The contract needs a field rule: "track2.ok MUST be false if envelope.ok is false, regardless of worker count."

---

## 5. Contracts with Status Inconsistencies

### 5.1 cli-preflight-contract.md - Marked PROPOSED despite being in STABLE use

**File**: `.gsd-t/contracts/cli-preflight-contract.md`
**Current status line**: `Status: PROPOSED (M55 D1 complete; STABLE pending D5 wire-in)`
**Actual state**: `bin/cli-preflight.cjs` is shipped, used in production by `gsd-t-verify-gate.cjs` Track 1, and tested.

This contract was marked PROPOSED pending D5 wire-in. D5 is complete (M55 COMPLETED). The contract should be promoted to STABLE.

---

### 5.2 unattended-supervisor-contract.md - ACTIVE "for M43" but M43 is long complete

**File**: `.gsd-t/contracts/unattended-supervisor-contract.md`
**Status line**: "Status: ACTIVE for M43"

The contract is version 1.5.0 covering M44 D9 features. The "for M43" qualifier in the status line is stale - the contract covers M36-M44 functionality and is permanently in use (not scoped to a single milestone). The verification status section (section 18) says "PENDING - awaiting code domain implementation" which is also stale (M36 completed long ago).

---

### 5.3 fresh-dispatch-contract.md - DRAFT status, implementation present

**File**: `.gsd-t/contracts/fresh-dispatch-contract.md`
**Status**: DRAFT

This contract describes fresh headless dispatch behavior. The implementation in `bin/gsd-t.js::doHeadlessExec()` exists and is in production use. The DRAFT status is a promotion gap.

---

### 5.4 goal-backward-contract.md - DRAFT status, referenced by complete-milestone workflow

**File**: `.gsd-t/contracts/goal-backward-contract.md`
**Status**: DRAFT

Referenced by `commands/gsd-t-complete-milestone.md`. The complete-milestone command ships and works. Draft status is a promotion gap.

---

## 6. Verified Correct Contract-to-Implementation Matches

The following contracts were verified against their implementations and found accurate:

| Contract | Implementation | Status |
|----------|----------------|--------|
| `context-brief-contract.md` | `bin/gsd-t-context-brief.cjs` - API, schema, path-safety, MAX_BRIEF_BYTES | Correct (except KINDS stale - see 1.1) |
| `verify-gate-contract.md` | `bin/gsd-t-verify-gate.cjs` - Track 1+2 structure, summary truncation algorithm, envelope schema | Correct (except playwright.config.mjs - see 1.3) |
| `parallel-cli-contract.md` | `bin/parallel-cli.cjs` - result envelope, fail-fast, per-worker timeout, sort by id ASC | Correct (except captureSpawn drift - see 1.7) |
| `file-disjointness-contract.md` | `bin/gsd-t-file-disjointness.cjs` - proof algorithm, fallback chain, event format | Correct |
| `task-graph-contract.md` | `bin/gsd-t-task-graph.cjs` - node schema, Shape C/D parsing, cycle detection, ready-mask | Correct |
| `graph-query-contract.md` | `bin/graph-query.js` - query type enumeration, data shapes | Correct (security issues noted in findings, not drift) |
| `graph-storage-contract.md` | `bin/graph-store.js` - file layout, read/write API, clear() | Mostly correct (isStale deletion gap - see 1.4; atomicity gap - see 1.5) |
| `graph-cgc-contract.md` | `bin/graph-cgc.js` - query types, health check timeout, overlay enrichment | Correct (performance issues noted in findings, not contract drift) |
| `cli-preflight-contract.md` | `bin/cli-preflight.cjs`, `bin/cli-preflight-checks/` - envelope schema, severity model, 6 built-in checks | Correct |
| `test-data-ledger-contract.md` | `bin/gsd-t-test-data-ledger.cjs` - appendInsert, listInserts, purgeRunInserts, adapters | Correct |
| `journey-coverage-contract.md` | `bin/journey-coverage.cjs`, `bin/journey-coverage-cli.cjs` - manifest schema, detector interface | Correct (MutationObserver counter bug noted in findings, not drift) |
| `playwright-bootstrap-contract.md` | `bin/playwright-bootstrap.cjs`, `bin/ui-detection.cjs` - hasPlaywright, installPlaywright, hasUI | Correct |

---

## 7. Prioritized Fix List

| Priority | Contract | Action |
|----------|----------|--------|
| P0 | `unattended-supervisor-contract.md` | Remove references to deleted `bin/supervisor-pid-fingerprint.cjs`; document M61 retirement; update supervisor status section 18 |
| P1 | `model-selection-contract.md` | Sync Phase Map with `bin/model-selector.js` (plan/impact/complete-milestone diverge) |
| P1 | `context-brief-contract.md` | Update KINDS to all 11; document `--domain` req for new kinds; bump to v1.1.0 |
| P1 | `progress-file-format.md` | Add ACTIVE status; add Summary column; update Date format to include HH:MM TZ |
| P1 | `verify-gate-contract.md` | Add `playwright.config.mjs` to Track 2 detection; add false-pass guard rule for empty results |
| P1 | `stack-rules-contract.md` | Update "Commands That Must Implement Detection" to reflect M61 Workflow bypass; track as debt |
| P1 | `graph-storage-contract.md` | Add atomicity requirement (tmp+rename); add deletion detection to isStale() contract |
| P1 | `parallel-cli-contract.md` | Update captureSpawn invariant to reflect M61 retirement of gsd-t-token-capture.cjs |
| P2 | `cli-preflight-contract.md` | Promote to STABLE (implementation complete) |
| P2 | Create new: `workflow-sandbox-contract.md` | Document native Workflow sandbox API boundary (banned globals, available globals, agent() signature) |
| P2 | `context-brief-contract.md` | Add ancillary schema for 5 new kinds (discuss/impact/milestone/partition/plan) |
| P2 | `token-budget-contract.md` | Remove `bin/runway-estimator.js` from consumer list (file does not exist) |
| P2 | `unattended-supervisor-contract.md` | Add note about missing `headless-default-contract.md` dependency |
| P2 | `context-brief-contract.md` | Update captureSpawn Exemption section to note gsd-t-token-capture.cjs was retired |
| P2 | `fresh-dispatch-contract.md` | Promote DRAFT to STABLE |
| P2 | `goal-backward-contract.md` | Promote DRAFT to STABLE |
| P3 | `worktree-isolation-contract.md` | Mark PROPOSED-ABANDONED or update to describe actual isolation mechanism |
| P3 | `unattended-supervisor-contract.md` | Update status from "ACTIVE for M43" to "STABLE" |
