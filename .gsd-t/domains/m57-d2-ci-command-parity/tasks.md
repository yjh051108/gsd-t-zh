# Tasks: m57-d2-ci-command-parity

## Summary

When all tasks complete, `bin/gsd-t-ci-parity.cjs` exports
`runCiParity({projectDir})` and runs as `gsd-t ci-parity`, auto-detecting the
project's real CI config (locked precedence), clearing build caches **safely**,
running exactly those commands, and auto-running `docker build` when a
Dockerfile is present — with a STABLE contract and tests proving SC2 (the
TimeTracking warm-cache-masked tsc-strict-regression failure class). The first
design's `clearBuildCaches` shipped 3 CRITICAL Destructive-Action-Guard
violations (Red Team BUG-1: `fs.rmSync` recursive-force OUTSIDE projectDir via
`tsconfig outDir:"../victim"`; BUG-8: regression that force-deleted the ENTIRE
project when `outDir` resolved to root; BUG-2: removing the cache-clear passed
all tests because SC2 self-skipped on Docker-less hosts). The corrected design
makes containment a hard, independently-tested gate.

> Design memory: `feedback_destructive_path_ops_containment.md`.
> Containment predicate (LOCKED): `resolved.startsWith(projectRoot + path.sep) && resolved !== projectRoot`.

## Files Owned

- bin/gsd-t-ci-parity.cjs
- .gsd-t/contracts/ci-parity-contract.md
- test/m57-d2-ci-parity.test.js
- test/fixtures/m57-ci-parity/**

## Tasks

### M57-D2-T1 — Fixtures per detection source + planted regression + path-traversal repros
- **Touches**: `test/fixtures/m57-ci-parity/**`
- **Files**: `test/fixtures/m57-ci-parity/{cloudbuild,workflows,dockerfile-run,pkg-fallback,planted-regression,traversal-outdir,root-outdir}/`
- **Contract refs**: ci-parity-contract.md (Detection Precedence, SC2, Cache-Clear Containment)
- **Dependencies**: NONE
- **Acceptance criteria**:
  - One fixture per detection source so precedence ordering is independently testable: `cloudbuild/` (`cloudbuild.yaml` steps[].args), `workflows/` (`.github/workflows/ci.yml` jobs[].steps[].run), `dockerfile-run/` (Dockerfile RUN, no cloudbuild/workflows), `pkg-fallback/` (only package.json scripts)
  - `planted-regression/` reproduces SC2: a `noImplicitAny` violation that a warm-cache `tsc` (stale `.tsbuildinfo` present) would skip, but a cold/docker build catches; includes a Dockerfile
  - **`traversal-outdir/`**: a project whose `tsconfig.json` sets `outDir: "../victim"` (and a sibling `victim/precious.txt`) — the BUG-1 repro
  - **`root-outdir/`**: projects whose `tsconfig.json` sets `outDir` to each of `"."`, `"./"`, `"src/.."`, `"./foo/../"` — the BUG-8 repro (every one resolves to projectRoot)
  - Fixtures runnable without network; docker-dependent assertions guarded (T4) but containment + cache-clear assertions are UNCONDITIONAL (no Docker needed)

### M57-D2-T2 — Detection + command runner (cache-clear delegated to T2b)
- **Touches**: `bin/gsd-t-ci-parity.cjs`
- **Files**: `bin/gsd-t-ci-parity.cjs` (module export only — docker step in T3)
- **Contract refs**: ci-parity-contract.md (API, Detection Precedence)
- **Dependencies**: Requires M57-D2-T1
- **Acceptance criteria**:
  - `runCiParity({projectDir, timeoutMs?})` returns `{ok, detectedSource, commands, dockerBuilt, dockerSkippedReason?, cacheCleared, refusedPaths?, note?}` per contract
  - Detection precedence LOCKED + exact: `cloudbuild.yaml` → `.github/workflows/*.yml` → Dockerfile RUN → package.json scripts (`build`, `typecheck`, `test` in that order) → `none`
  - Parsers extract commands **key-positionally** (cloudbuild `steps[].args`; workflow `jobs.<job>.steps[].run`; Dockerfile `RUN`); documented parse limits in docblock + contract
  - `runCiParity` MUST call the T2b containment-safe `clearBuildCaches` BEFORE running any detected command — the call is unconditional and on the mandatory path (closes BUG-2)
  - Each command spawned with a bounded timeout, output captured; any non-zero exit → that command `ok:false` → envelope `ok:false`
  - none-detected + no package scripts → `ok:true`, `detectedSource:'none'`, `note` set
  - Zero ext deps; functions <30 lines; `'use strict';` + contract-naming header docblock

### M57-D2-T2b — Containment-safe clearBuildCaches (Destructive Action Guard)
- **Touches**: `bin/gsd-t-ci-parity.cjs`
- **Files**: `bin/gsd-t-ci-parity.cjs` (the `clearBuildCaches` function + a `_isSafeToDelete(resolved, projectRoot)` helper)
- **Contract refs**: ci-parity-contract.md (Cache-Clear Containment — normative)
- **Dependencies**: Requires M57-D2-T1 (traversal/root fixtures)
- **Acceptance criteria**:
  - `clearBuildCaches(projectDir)` removes `*.tsbuildinfo`, `node_modules/.cache`, and tsc `outDir`/`tsBuildInfoFile` derived from `tsconfig*.json`
  - **Before ANY `fs.rmSync`/recursive delete**: resolve the target to an absolute real path and apply the LOCKED predicate `path.resolve(p)` is deleted ONLY IF `resolved.startsWith(projectRoot + path.sep) && resolved !== projectRoot`. Both halves are load-bearing:
    - resolves OUTSIDE projectRoot (`../victim`, absolute paths) → **REFUSE** (record in `refusedPaths[]`, never delete)
    - resolves EQUAL TO projectRoot (`.`, `./`, `src/..`, `./foo/../`) → **REFUSE** (deleting the repo is never a cache-clear; this is the BUG-8 regression edge)
    - a `projectRoot`-prefixed *sibling* (e.g. `projectRoot-evil/`) must NOT pass (the `+ path.sep` guards the prefix-collision)
  - Refusal is silent-safe: it records `refusedPaths[]` and continues clearing the legitimate caches; it never throws away the run
  - There is NO code path that deletes a config-derived path without passing `_isSafeToDelete` first
  - Functions <30 lines; the predicate is a single named helper (testable in isolation)

### M57-D2-T3 — Auto docker build (presence-triggered, no flag)
- **Touches**: `bin/gsd-t-ci-parity.cjs`
- **Files**: `bin/gsd-t-ci-parity.cjs`
- **Contract refs**: ci-parity-contract.md (Docker Trigger)
- **Dependencies**: Requires M57-D2-T2, M57-D2-T2b (within domain)
- **Acceptance criteria**:
  - `Dockerfile` present → real `docker build` runs (bounded timeout, output captured); build failing → envelope `ok:false`; `dockerBuilt:true`
  - `Dockerfile` absent → `dockerBuilt:false`, `dockerSkippedReason:'no-dockerfile'`, NOT a failure
  - `docker` binary missing → `dockerBuilt:false`, `dockerSkippedReason:'docker-unavailable'`, NOT a hard failure
  - No opt-in flag anywhere — presence of Dockerfile is the sole trigger (locked decision)

### M57-D2-T4 — CLI entry + exit codes + unit tests (SC2 + containment, unconditional)
- **Touches**: `bin/gsd-t-ci-parity.cjs`, `test/m57-d2-ci-parity.test.js`
- **Files**: `bin/gsd-t-ci-parity.cjs` (add `require.main === module`), `test/m57-d2-ci-parity.test.js`
- **Contract refs**: ci-parity-contract.md (Exit Codes, Success Criterion Binding, Cache-Clear Containment)
- **Dependencies**: Requires M57-D2-T2, M57-D2-T2b, M57-D2-T3 (within domain)
- **Acceptance criteria**:
  - CLI: `require.main === module`, `--json` envelope output, exit **0** `ok:true` / **4** `ok:false` / **2** usage error (matches D1 + journey-CLI convention)
  - Detection-precedence tests: each fixture resolves to the expected `detectedSource`
  - **Containment tests (UNCONDITIONAL — no Docker, the BUG-1/BUG-8 regression guarantee)**:
    - `traversal-outdir/` → `clearBuildCaches` REFUSES `../victim`; sibling `victim/precious.txt` SURVIVES; path recorded in `refusedPaths[]`
    - `root-outdir/` each of `.`, `./`, `src/..`, `./foo/../` → REFUSED; project files (a sentinel `src/index.ts` + `package.json`) SURVIVE
    - prefix-collision: a path resolving to `projectRoot + "-evil"` → REFUSED
    - legitimate `outDir: "dist"` under projectRoot → still removed (no over-correction)
  - **Cache-clear-on-mandatory-path test (closes BUG-2)**: a stale `.tsbuildinfo` is removed before commands run, asserted on the Docker-less path (commenting out the `clearBuildCaches` call MUST fail this test even with no Docker daemon)
  - **SC2 test**: `planted-regression` fixture with a Dockerfile → docker build runs and fails on the planted tsc strict regression → `ok:false`, exit 4. Self-skips with a clear message when no Docker daemon is available, BUT the cache-clear + detection + containment assertions run unconditionally
  - `no-dockerfile` / `docker-unavailable` paths assert non-failure
  - Node built-in test runner; zero new deps; full suite stays green (baseline 2547 + new D2 tests; 0 fail)

### M57-D2-T5 — Contract rewrite (containment + cache-clear normative) + flip DRAFT → STABLE
- **Touches**: `.gsd-t/contracts/ci-parity-contract.md`
- **Files**: `.gsd-t/contracts/ci-parity-contract.md`
- **Contract refs**: self
- **Dependencies**: Requires M57-D2-T4
- **Acceptance criteria**:
  - Contract body rewritten to specify the **Cache-Clear Containment** rule as NORMATIVE (the exact predicate `resolved.startsWith(root + path.sep) && resolved !== root`, explicit "REFUSE outside AND equal-to projectRoot", `refusedPaths[]` envelope field), the locked detection precedence, the docker presence-trigger, and a **Mandatory Cache-Clear** clause stating the clear is on the unconditional path (no test may self-skip it)
  - Contract removes any prior "best-effort" language that licensed the unguarded delete
  - `Status: DRAFT` → `STABLE`, `Version: 0.1.0` → `1.0.0`
  - Code and contract must agree (divergence found in T2–T4 reconciled); flip only after T4 green

## Execution Estimate
- Total tasks: 6 (added T2b — containment is a dedicated Destructive-Action-Guard task, not a sub-bullet)
- Independent tasks (no blockers): 1 (T1)
- Blocked tasks (intra-domain ordering only): 5 (T2→T1, T2b→T1, T3→T2/T2b, T4→T2/T2b/T3, T5→T4)
- Cross-domain blockers: 0 (file-disjoint from D1)
- Estimated checkpoints: 1 (C2 — D2 execute clean → integrate wire-in)
