# Tasks: m57-d1-build-coverage-check

## Summary

When all tasks complete, `bin/gsd-t-build-coverage.cjs` exports
`checkBuildCoverage({projectDir, baseRef, headRef})` and runs as
`gsd-t build-coverage`, flagging any new top-level path in a milestone commit
range that no CI build artifact references. Coverage is decided by
**structurally parsing** the CI files (extracting real path references from
build-input positions) — NOT by substring-matching the directory name against
raw config text. The first design's substring approach failed Red Team across
5 non-converging cycles (BUG-4 → BUG-6 → BUG-9 → BUG-9b: each fix spawned a new
syntactic variant where the dir name appeared as prose, not a build input). The
corrected detector ships with a STABLE contract and a test suite that includes
one assertion per falsification-corpus fixture
(`test/fixtures/m57-build-coverage/bug*/`) proving the genuinely-uncovered dir
returns `ok:false` / non-empty `missing[]`.

> Design memory: `feedback_coverage_check_structural_not_substring.md`.
> STRUCTURAL PARSE, NEVER `configText.includes(dir)`.

## Files Owned

- bin/gsd-t-build-coverage.cjs
- .gsd-t/contracts/cli-build-coverage-contract.md
- test/m57-d1-build-coverage.test.js
- test/fixtures/m57-build-coverage/** (corpus already committed @ 56ddded — T1 only ADDS missing baseline fixtures, never edits the bug* corpus)

## Tasks

### M57-D1-T1 — Baseline fixtures (corpus already exists; add only the non-bug baselines)
- **Touches**: `test/fixtures/m57-build-coverage/**`
- **Files**: confirm/repair `test/fixtures/m57-build-coverage/{docker-cloudbuild,gha-only,no-ci,copy-dot,relative-from}/`; the `bug{4,6,7,9,9b}*` corpus is FROZEN (committed 56ddded — do NOT modify)
- **Contract refs**: cli-build-coverage-contract.md (Detection Rules, SC1)
- **Dependencies**: NONE
- **Acceptance criteria**:
  - The Red Team falsification corpus is present and unmodified: `bug4-incidental-token`, `bug6-cloudbuild-comment`, `bug6-workflow-comment`, `bug7-node-modules-token`, `bug9-stepname-prose`, `bug9b-name-block-scalar`, `bug9b-name-folded-scalar` — each a synthetic project where `hooks/` (or the relevant new dir) is genuinely uncovered but the dir name appears somewhere as prose/comment/`name:`/interior-token
  - `docker-cloudbuild/`: Dockerfile `COPY src/ ./src/` (NOT `hooks/`) + a real `hooks/` dir → SC1 positive case
  - `copy-dot/`: Dockerfile `COPY . .` → everything covered (true negative — must NOT flag)
  - `relative-from/`: `COPY --from=builder dist/ ./dist/` relative source (BUG-3 class — relative `--from=` source IS a real build input, must be parsed as covering `dist`)
  - `gha-only/`: workflow references some paths, genuinely omits one
  - `no-ci/`: no Dockerfile/cloudbuild/workflows
  - Fixtures are static files consumable via an injectable new-paths list (no git needed) — see T2 seam
  - **Constraint**: T1 MUST NOT add/edit/delete anything under `bug*/` — that corpus is the frozen falsification set; touching it invalidates the regression guarantee

### M57-D1-T2 — checkBuildCoverage detector + STRUCTURAL CI parsers
- **Touches**: `bin/gsd-t-build-coverage.cjs`
- **Files**: `bin/gsd-t-build-coverage.cjs` (module export only — no CLI entry yet)
- **Contract refs**: cli-build-coverage-contract.md (API, Structural Parse Rules, Defensive Behavior)
- **Dependencies**: Requires M57-D1-T1 (fixtures to test against)
- **Acceptance criteria**:
  - `checkBuildCoverage({projectDir, baseRef, headRef})` returns `{ok, missing, checkedAgainst, newPaths, note?}` exactly per contract
  - New-path enumeration: `git diff --name-only baseRef..headRef` collapsed to distinct **first** top-level segments; default range `HEAD~1..HEAD` when refs omitted
  - **Dockerfile parser — structural, line-oriented**: tokenize each instruction; only `COPY`/`ADD` instructions contribute coverage; the **source argument(s)** (all args except the last = dest) are the covered paths; `COPY . .` / `ADD . .` ⇒ all covered; `COPY --from=<stage> <src> <dest>` — the `<src>` IS a real build input and contributes coverage (relative AND absolute); flags (`--from=`, `--chown=`, `--chmod=`) are NOT path tokens. A path appearing only in a `RUN`/`CMD`/comment/`ENV` does NOT contribute coverage.
  - **cloudbuild.yaml parser — structural, key-positional**: extract path tokens ONLY from `steps[].args` list items and recognized artifact/copy step positions. A token is build-input-bearing only when it is the *value of an `args` list item* (or a recognized copy-step path field). The same string in a `#` comment, a step `id:`/`name:`, an `env:` block, or a folded/block scalar that is NOT an `args` value MUST NOT contribute coverage.
  - **.github/workflows/*.yml parser — structural, key-positional**: extract path tokens ONLY from `jobs.<job>.steps[].run` command strings (and `with.path`-style recognized inputs). A dir name appearing in a step `name:` (single-line plain, single-line quoted, OR multi-line `|`/`>` block/folded scalar continuation), a `#` comment, a job/workflow-level `name:`, or any non-`run` descriptive position MUST NOT contribute coverage. (This is the exact BUG-9 / BUG-9b class — the parser must key on YAML structure, not line text.)
  - **node_modules/ exclusion (hard rule)**: a path whose first segment is `node_modules` is NEVER coverage for any other dir, even if `node_modules/` is committed and a CI line references `node_modules/.bin` (BUG-7 class). This rule is contract-mandated and must have its own enforced test.
  - **Coverage decision is set membership of a new top-level segment against the parsed build-input path set** — there is NO code path that does `text.includes(segment)` or regex-greps raw config text for the segment name. (If such a path exists the implementation is wrong by mandate.)
  - Defensive: no git repo / detached HEAD / identical refs → typed/usage error (caught by CLI in T3); no CI artifacts → `ok:true` + `note`; empty diff → `ok:true`, `newPaths:[]`
  - Zero external runtime deps (Node built-ins only); functions <30 lines where practical; `'use strict';` + contract-naming header docblock referencing `cli-build-coverage-contract.md`

### M57-D1-T3 — CLI entry + exit codes
- **Touches**: `bin/gsd-t-build-coverage.cjs`
- **Files**: `bin/gsd-t-build-coverage.cjs` (add `require.main === module` self-invoke)
- **Contract refs**: cli-build-coverage-contract.md (Exit Codes)
- **Dependencies**: Requires M57-D1-T2 (within domain)
- **Acceptance criteria**:
  - `if (require.main === module)` parses argv (`--json`, optional `--base`/`--head`, default `projectDir=cwd`)
  - Exit **0** when `ok:true`; exit **4** when `ok:false` (`missing[]` non-empty); exit **2** on usage error (bad refs / not a git repo)
  - `--json` prints the full envelope; non-`--json` prints a human one-liner summary
  - Exit-code convention matches `bin/journey-coverage-cli.cjs` (0/4/2)

### M57-D1-T4 — Unit tests: SC1 + FULL falsification-corpus binding
- **Touches**: `test/m57-d1-build-coverage.test.js`
- **Files**: `test/m57-d1-build-coverage.test.js`
- **Contract refs**: cli-build-coverage-contract.md (Success Criterion Binding, Falsification Corpus)
- **Dependencies**: Requires M57-D1-T2, M57-D1-T3 (within domain)
- **Acceptance criteria**:
  - **SC1 test**: `docker-cloudbuild` fixture → `ok:false`, `missing` includes `"hooks"`; CLI subprocess exits 4
  - **Falsification corpus — one test per bug fixture, all asserting the uncovered dir is FLAGGED** (these are the regression guarantee against re-opening the Red Team's non-converging class):
    - `bug4-incidental-token` → `ok:false`, `missing` includes the uncovered dir (interior token `node_modules/husky/hooks/` must NOT cover `hooks`)
    - `bug6-cloudbuild-comment` → `ok:false` (dir named only in a cloudbuild `#` comment is NOT coverage)
    - `bug6-workflow-comment` → `ok:false` (dir named only in a workflow `#` comment is NOT coverage)
    - `bug7-node-modules-token` → `ok:false` (committed `node_modules/` + `ls node_modules/.bin` CI line must NOT mask the uncovered dir)
    - `bug9-stepname-prose` → `ok:false` (dir in a single-line GHA step `name:` is NOT coverage)
    - `bug9b-name-block-scalar` → `ok:false` (dir in a `name: |` block-scalar continuation is NOT coverage)
    - `bug9b-name-folded-scalar` → `ok:false` (dir in a `name: >` folded-scalar continuation is NOT coverage)
  - **True-negative guards (no over-correction)**: `copy-dot` → `ok:true`; `relative-from` → `dist` IS covered (relative `--from=` source is a real build input) so a `dist/`-only diff → `ok:true`; `no-ci` → `ok:true` + `note`; empty-diff → `ok:true`, `newPaths:[]`; usage error (bad ref) → exit 2
  - All tests use Node built-in test runner (`node --test`); zero new deps; full suite stays green (baseline 2547 + new D1 tests; 0 fail)

### M57-D1-T5 — Contract rewrite (structural mandate) + flip DRAFT → STABLE
- **Touches**: `.gsd-t/contracts/cli-build-coverage-contract.md`
- **Files**: `.gsd-t/contracts/cli-build-coverage-contract.md`
- **Contract refs**: self
- **Dependencies**: Requires M57-D1-T4 (tests prove the contract holds)
- **Acceptance criteria**:
  - Contract body rewritten to specify the **Structural Parse Rules** (Dockerfile COPY/ADD source-arg extraction incl. `--from=` source; cloudbuild `args`-positional extraction; workflow `run`-positional extraction; explicit "comment / `name:` / folded-scalar / interior-token / `node_modules` are NOT coverage"), a **Falsification Corpus** section enumerating every `bug*` fixture as a contract-bound guarantee, and an explicit **"no substring/regex-over-raw-text" prohibition** clause
  - `Status: DRAFT` → `STABLE`, `Version: 0.1.0` → `1.0.0`
  - Contract and code must agree (any divergence found in T2–T4 reconciled into the contract)
  - Flip happens only after T4 tests are green

## Execution Estimate
- Total tasks: 5
- Independent tasks (no blockers): 1 (T1)
- Blocked tasks (intra-domain ordering only): 4 (T2→T1, T3→T2, T4→T2/T3, T5→T4)
- Cross-domain blockers: 0 (file-disjoint from D2)
- Estimated checkpoints: 1 (C1 — D1 execute clean → integrate wire-in)
