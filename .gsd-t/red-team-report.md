# Red Team Report — M85 (Model-Tier Policy + Fable 5)

Date: 2026-06-09 17:41 PDT
Branch: m85-model-tier-policy-fable
Scope: bin/gsd-t-model-tier-policy.cjs, bin/gsd-t-parallel.cjs, bin/model-selector.js, 3 workflows (phase/verify/debug), m85 lint + tests, doc ripple

## Bugs

### BUG-1: severity HIGH — Documented CLI surface `gsd-t model-tier-policy` does not exist (no dispatcher case, no bin propagation)
- **Reproduction**: `node bin/gsd-t.js model-tier-policy resolve red-team --json`
- **Expected**: JSON envelope `{ok, stageKey, tier, model, requiresThinkingOmitted}` per `commands/gsd-t-help.md` § "model-tier-policy (M85)" ("**CLI**: `gsd-t model-tier-policy resolve <stageKey> [--json]`") and the contract's "Resolver Surface (M69 invoke-time injection)" ("Command invokers call the resolver at invoke time").
- **Actual**: `✗ Unknown command: model-tier-policy` + generic help. `bin/gsd-t.js` has NO `case "model-tier-policy"` — every sibling tool does (`parallel`, `preflight`, `brief`, `verify-gate`, `build-coverage`, `ci-parity`, `test-data`, `competition-judge`, `traceability-gate` at bin/gsd-t.js:4452–4569). Additionally `gsd-t-model-tier-policy.cjs` appears in NEITHER `GLOBAL_BIN_TOOLS` (bin/gsd-t.js:~1172) nor `PROJECT_BIN_TOOLS` (bin/gsd-t.js:~2468) — `grep -c gsd-t-model-tier-policy bin/gsd-t.js` → 0.
- **Consequence**: in every consumer project the M69 invoke-time resolver path is dead on BOTH arms of the canonical runCli fallback (no project-local `bin/gsd-t-model-tier-policy.cjs`, no `gsd-t` PATH subcommand). The `requiresThinkingOmitted` predicate's declared LIVE surface (AC d-i: "consumed by command invokers at invoke time") is unreachable outside the GSD-T source repo. Repeat of the registered incident class "~/.claude/bin/ has no installer path — silent breakage" (project_global_bin_propagation_gap) and a Pre-Commit-Gate item (dispatch logic in bin/gsd-t.js must track new tool surfaces).
- **Proof**: commands above. Mitigation note: nothing crashes at runtime *today* — no command file invokes the resolver yet, and workflows use lint-guarded alias literals. The breakage is a shipped-broken documented interface + dead contract surface, not a live-path fault.

### BUG-2: severity LOW — Stale comment in `_runCacheWarmProbe` claims env-var backward compat that no longer exists
- bin/gsd-t-parallel.cjs:425-429 says "env may be kept for backwards compat with older CLI versions but the flag takes precedence" — but the M85 edit removed the `env.ANTHROPIC_MODEL` assignment entirely; only `--model` is passed. Comment misstates the code.

### BUG-3: severity LOW — `requiresThinkingOmitted` duplicates the fable id literal instead of referencing `MODEL_IDS.fable`
- bin/gsd-t-model-tier-policy.cjs:66 hardcodes `'claude-fable-5'`; line 25 holds the same string in `MODEL_IDS`. A future fable id bump (e.g. dated snapshot) silently desyncs the predicate inside the very module that claims single-source. Mitigated: m85-model-tier-policy.test.js:28 pins `MODEL_IDS.fable`, and the contract pins the literal. Also note: predicate returns `false` for suffixed live ids (`claude-fable-5[1m]`) — consistent with the contract's exact-equality definition, but a footgun if a spawn site ever feeds back a transcript-reported model string.

### BUG-4: severity LOW — Schema Freeze Policy self-violation in model-selection-contract.md
- v1.0.0 froze: "The tier union 'haiku' | 'sonnet' | 'opus' is frozen for v1.x. Adding a fourth tier requires a v2.0.0 bump." M85 added `fable` at v1.1.0 by rewriting the freeze clause in the same edit. Verified no code consumer asserts the 3-tier union (only model-selector.test.js, which was updated) — process violation only, disclosed in the changelog row.

## Coverage Gaps
- AC(c) partition-probe live `⚙ [fable]` evidence: DOCUMENTED gap (a5c2423), lint-covered, deferred to next natural partition run (M86). Honest deferral.
- `selectModel({phase:"debug", task_type:"cycle_2_escalation"})` is a documented mirror with no live caller (stated in-code); live enforcement is the workflow ternary + lint.

## Shallow Tests Rewritten
- 0. The m85 lint was attacked for evasion: non-literal `model: someVar` escapes the membership scan, but every DESIGNATED stage fails closed ("no model: found near label"); ternary extractor verified on both operands; 7 negative fixtures + real-file drifted-copy meta-tests genuinely fail the checker. Not decorative.

## Contracts Verified
- model-tier-policy-contract.md v1.0.0: STAGE_TIERS ↔ workflow literals ↔ contract table agree (6 fable rows + producers held opus); blindness invariant live (judge fable @ phase:476 vs producers opus @ phase:432, finalizer opus @ phase:566); zero-dep invariant holds; resolver envelope shape correct. VIOLATED only at the Resolver Surface / help-doc CLI claim (BUG-1).
- model-selection-contract.md v1.1.0: phase map matches PHASE_RULES; freeze-policy issue (BUG-4).
- Doc ripple verified: CLAUDE.md, README.md, templates/CLAUDE-global.md AND live ~/.claude/CLAUDE.md all updated (fable tier + Red Team model line).

## Attack Vectors Tried
1. Contract violations — BUG-1, BUG-4 found; stage map/blindness/zero-dep verified clean.
2. Boundary inputs — resolver CLI fuzzed with `constructor`/`__proto__`/`toString`/`hasOwnProperty`/empty/missing stageKey: all rejected, exit 1, no prototype-chain leak (MODEL_IDS[Function] → undefined → null). Predicate truth table incl. null/undefined/aliases/suffixed ids verified.
3. State transitions — maps Object.freeze'd, module stateless; `workerModel === false` opt-out → null handled by `if (model)` guard; cache-warm probe ordering safe.
4. Error paths — resolve() never throws; missing `headless-auto-spawn.cjs` (TD-114) degrades gracefully to `decision:"sequential"` with `spawn_load:` error recorded.
5. Missing flows — partition-probe live evidence gap (documented); resolver has no live invoker (folded into BUG-1).
6. Regression — FULL suite: 1461 tests, 1457 pass, 0 fail, 4 skipped. M85-focused files: 138/138.
7. E2E — Playwright suite run: 3 passed, 1 skipped (placeholder). M85 diff touches zero viewer source, so the M52 journey pass-through patch exercise does not bind to this milestone's diff. No orphan servers; port 7488 free post-run.
8. Design fidelity — no design contract relevant; skipped per protocol.

## Summary
- BUGS FOUND: 4 (1 HIGH, 3 LOW)
- VERDICT: **FAIL** (1 HIGH — BUG-1)

---

# Red Team Report — M57 CI-Parity Verify Gate (CYCLE 4 — FINAL VERIFICATION of the BUG-9 fix)

**Date**: 2026-05-18 16:07
**Branch**: m57-ci-parity-verify-gate
**Attack surface**: `bin/gsd-t-build-coverage.cjs` (D1), `bin/gsd-t-ci-parity.cjs` (D2),
`test/m57-d1-build-coverage.test.js`, `test/m57-d2-ci-parity.test.js`,
`test/fixtures/m57-build-coverage/**` (incl. cycle-3 `bug9-stepname-prose/`),
`test/fixtures/m57-ci-parity/**`
**Contracts**: `cli-build-coverage-contract.md` **v1.0.3 STABLE**,
`ci-parity-contract.md` **v1.0.2 STABLE**
**Baseline integrity**: all 4 source/test files SHA-256 captured at start AND
verified post-exercise — **byte-identical**:
- `bin/gsd-t-build-coverage.cjs` `121606a9012f…`
- `bin/gsd-t-ci-parity.cjs` `9b9443363ddc…`
- `test/m57-d1-build-coverage.test.js` `886f5bf8a9b3…`
- `test/m57-d2-ci-parity.test.js` `7bf9d30da66e…`

Every patch reverted; harness SHA-confirmed each round and final. All
untracked m57 fixture dirs (incl. `bug9-stepname-prose/`) PRESERVED — every
probe ran in `os.tmpdir()` or against existing read-only fixtures; zero
repo-fixture writes. Working-tree ` M` on the 4 files is the pre-existing
fix-cycle state (uncommitted), unchanged by this exercise — proven by the
SHA match against the start-of-session capture.

---

## 1. BUG-9 CLOSURE — the fix (`isWorkflowNameLabel()` + `parseWorkflows()` gate)

The cycle-3 BUG-9 fix added `isWorkflowNameLabel(rawLine)` (matches
`^\s*(?:-\s+)?name\s*:` after comment-strip) and a `parseWorkflows()` guard
`if (isWorkflowNameLabel(line)) continue;` — workflow-YAML-only, keyed strictly
off the `name` YAML key.

### 1a. The 4 documented cycle-3 BUG-9 variants — ALL NOW CLOSED

`/tmp/rt-m57-c4/bug9-closure.js`, synthetic temp projects, `_newPaths:
["src/index.js","hooks/pre-push","package.json"]`, Dockerfile `COPY src/`
+ `COPY package.json` only (hooks/ uncovered):

| Variant | Workflow line | Result |
|---|---|---|
| V1 unquoted | `- name: Set up hooks/ directory for git client-side validation` | `ok:false missing:["hooks"]` — **CLOSED** |
| V2 unquoted | `- name: Configure hooks/ for git` | `ok:false missing:["hooks"]` — **CLOSED** |
| V3 unquoted | `- name: Run hooks/validate.sh` | `ok:false missing:["hooks"]` — **CLOSED** |
| V4 quoted | `- name: "Set up hooks/ dir"` | `ok:false missing:["hooks"]` — **CLOSED** |

All 4 cycle-3 reproductions now return `ok:false` with `hooks` in `missing`.
The canonical TimeTracking-class single-line `name:` prose vector is genuinely
closed. P-NEW broken patch (below) proves it is test-enforced.

### 1b. Adversarial residual hunt — vectors OUTSIDE the documented residual

Contract v1.0.3 documented-accepted residual (lines 109–127) is **strictly**:
*a dir name as the first path component **inside a quoted command string in a
`run:`/value (command) position**.* Everything else in the M57 core
false-negative class must be closed. Probes (`bug9-closure.js`):

| Vector | Class | Result | Disposition |
|---|---|---|---|
| A1 job-level `name: Deploy hooks/ pipeline` | name:-prose | `missing:["hooks"]` | **CLOSED** (caught) |
| A2 workflow top-level `name: hooks/ CI pipeline` | name:-prose | `missing:["hooks"]` | **CLOSED** (caught) |
| A3 odd spacing `- name : Set up hooks/ dir` | name:-prose | `missing:["hooks"]` | **CLOSED** (caught) |
| A5 non-leading `- name: Prepare the hooks/ tree` | name:-prose | `missing:["hooks"]` | **CLOSED** (caught) |
| **A4 block scalar `- name: \|` + continuation `Set up hooks/ directory`** | name:-prose (multi-line) | `ok:true missing:[]` | **FALSE NEGATIVE → BUG-9b** |
| **A9 folded scalar `- name: >` + continuation `Set up hooks/ directory`** | name:-prose (multi-line) | `ok:true missing:[]` | **FALSE NEGATIVE → BUG-9b** |
| A6 `env: HOOKS_DIR: hooks/` | YAML value (plausible build input) | counted | accepted-residual-adjacent, NOT a bug (false **positive**) |
| A7 `if: contains(..., 'hooks/')` | quoted expr | counted | accepted-residual-adjacent, NOT a bug |
| A8 `with: dir: hooks/` | action input value | counted | accepted-residual-adjacent, NOT a bug |
| A10 `run: echo "hooks/build is generated"` | quoted command string in run-position | counted | **EXACTLY the documented-accepted residual** — NOT a bug |

Single-line `name:` (job/workflow/step), odd spacing, and non-leading position
are all genuinely closed. A6/A7/A8 are YAML *values* that plausibly are or
accompany real build inputs — acceptable false **positives**, consistent with
the contract's "false positives acceptable" bias, not the forbidden
false-negative class. A10 is verbatim the documented-accepted residual.

**A4 and A9 are NOT in the accepted residual.** A `- name: |` / `- name: >`
block/folded scalar value is: (1) **not** a quoted command string; (2) **not**
in a `run:`/value command position — it is the *value of a `name:` label*; (3)
pure descriptive display prose, structurally and semantically identical to a
comment, **never a build input**. The contract v1.0.3 (lines 71–90) explicitly
claims this class is closed: *"a line whose YAML key is exactly `name` … its
value is discarded before any path token is extracted."* For a block/folded
scalar the **value spans multiple physical lines**; the line-oriented
`isWorkflowNameLabel()` regex matches and excludes only the `- name: |`
**marker** line — the indented continuation line carrying the actual prose
(`          Set up hooks/ directory`) is a *separate physical line* whose key
is not `name`, so it is **not** excluded and `topLevelSegmentsInLine()`
extracts `hooks` from it as phantom coverage. Mechanism trace:
`/tmp/rt-m57-c4/trace.js` — `isNameLabel=true` for `- name: |`, but
`isNameLabel=false tokens=["hooks"]` for `          Set up hooks/ directory`.
End-to-end confirmed via `checkBuildCoverage` (`bug9-confirm.js`):
`ok:true missing:[]` for both; control plain `- name:` correctly `ok:false
missing:["hooks"]`.

### **BUG-9b — HIGH — multi-line `name:` block/folded scalar continuation masks an uncovered new top-level dir**

- **Component**: `bin/gsd-t-build-coverage.cjs` — `isWorkflowNameLabel()` /
  `parseWorkflows()`. The exclusion is line-oriented and does not track YAML
  block/folded-scalar (`name: |` / `name: >`) multi-line value state.
- **Reproduction** (`/tmp/rt-m57-c4/bug9-confirm.js`, exact TimeTracking class):
  Dockerfile `COPY package.json ./` + `COPY src/ ./src/` (hooks/ NOT copied).
  `.github/workflows/ci.yml`:
  ```
        - name: |
            Set up hooks/ directory for git
          run: npm ci
  ```
  (or `- name: >` folded). `_newPaths:["src/index.js","hooks/pre-push",
  "package.json"]`.
- **Expected**: `ok:false`, `missing:["hooks"]` — the M57 core mandate;
  contract v1.0.3 Purpose/SC1: false negatives are NOT acceptable; the
  contract explicitly states a `name:` value "is discarded".
- **Actual**: `{"ok":true,"missing":[]}` — gate GREEN, broken build ships.
- **Proof**: `bug9-confirm.js` (`ok:true missing:[]` for both `|` and `>`;
  plain `- name:` control correctly `ok:false missing:["hooks"]`);
  mechanism `trace.js` (continuation line `isNameLabel=false tokens=["hooks"]`).
- **Why a NEW bug, not the documented-accepted residual**: the residual is
  *strictly* a quoted command string in `run:`/value position (contract
  v1.0.3 lines 109–127). A block/folded `name:` scalar continuation is
  unquoted, is the value of a `name:` label (not a command), and is pure
  prose the contract claims is discarded. It is the **same forbidden
  false-negative class** the cycle-3 BUG-9 fix was declared to close — just
  via the multi-line scalar form of the same `name:` key. Same defect family,
  one syntactic step removed.
- **Severity HIGH**: the Dockerfile is still parsed structurally; the hole is
  the secondary workflow heuristic and needs the new dir name to appear as a
  leading `name/`-token on a `name:` block-scalar continuation line. A
  multi-line block-scalar step name is a real, idiomatic GitHub Actions
  pattern (used for long multi-line step descriptions) and silently defeats
  the entire M57 gate when it does. Per the task definition, a non-quoted,
  non-accepted-residual false negative in the M57 core failure class is a new
  real bug, severity HIGH; consistent with the cycle-3 BUG-9 severity for the
  structurally-identical single-line form.
- **Coverage gap**: no D1 test exercises a block/folded-scalar `name:` value
  continuation; the suite covers single-line plain + quoted `name:` (BUG-9a)
  but not the multi-line scalar form of the same key.

---

## 2. OVER-CORRECTION CHECK — none (legitimate coverage intact)

`/tmp/rt-m57-c4/overcorrection.js`, all PASS:

| Case | Expectation | Result |
|---|---|---|
| `run: cp -r workers/ out/` | `workers` covered | covered, not missing — **PASS** |
| `working-directory: workers/` | `workers` covered | covered — **PASS** |
| `args`-position `tar … lib/ src/` | `lib` covered | covered — **PASS** |
| `paths:\n  - api/` trigger filter | `api` covered | covered — **PASS** |
| **cloudbuild step `name: tools/builder-image`** | `tools` STILL covered (builder image = real build input) | covered — **PASS, no over-correction** |

The `name:`-exclusion is keyed strictly off the workflow `name` key, leaves
`run:`/`working-directory:`/`args:`/`paths:` and every build-relevant key
contributing coverage, and is workflow-YAML-only — a cloudbuild step `name:`
(the BUILDER IMAGE, a genuine build input) is correctly NOT suppressed. No
real covered path is wrongly reported missing. **Zero over-correction.**

---

## 3. PRIOR 8 BUGS — RE-CONFIRMED CLOSED

Behavioral re-confirmation `/tmp/rt-m57-c4/prior8.js` (**16/16 PASS**) +
broken-patch enforcement `/tmp/rt-m57-c4/patch.js` (14/14 CAUGHT):

| Bug | Behavioral proof | Broken patch | Status |
|---|---|---|---|
| BUG-1 | sibling `../VICTIM` + `precious.txt` SURVIVE clearBuildCaches | P8 `isContained→true` → D2 fail 5 → rev 0 | **RESOLVED** |
| BUG-2 | runCiParity removed stale `tsconfig.tsbuildinfo` (dockerless pkg-scripts) | P7 `clearBuildCaches` removed → D2 fail 1 → rev 0 | **RESOLVED** |
| BUG-3 | relative `COPY --from=builder dist/` excluded → `dist` missing, `src` covered | P2 `^COPY --from=` skip `&& false` → D1 fail 1 → rev 0 | **RESOLVED** |
| BUG-4 | `node_modules/husky/hooks/` incidental token does NOT cover new `hooks/`; non-reg `src/` still covered | P15 `collapseToTopLevel [0]→[1]` → D1 fail 17; P6 `!has→has` → D1 fail 17 → rev 0 | **RESOLVED** (residual class → BUG-9/9b) |
| BUG-5 | unparseable cloudbuild + no Dockerfile → `ok:false`+note; `none` → `ok:true` | P10 BUG-5 consequence `if(false&&…)` → D2 fail 1 → rev 0 | **RESOLVED**, no over-correction |
| BUG-6 | workflow + cloudbuild comment naming `hooks/` → `hooks` still missing; non-reg `cp -r src/` covers `src` | P4 `stripComment→rawLine` → D1 fail 2 → rev 0 | **RESOLVED** (comment vector) |
| BUG-7 | first-component `node_modules/` token does NOT cover committed `node_modules/` | P5 `head==='node_modules'→'XXXX'` → D1 fail 1 → rev 0 | **RESOLVED** |
| BUG-8 | root SURVIVES `outDir:"."`/`"./"`/`"src/.."`/`"./foo/../"`; non-reg `dist/` STILL removed | P9 `isContained` allow `p===root` → D2 fail 3 → rev 0 | **RESOLVED** |

All 8 prior bugs stay closed — both behaviorally and via the cycle-1/2/3
previously-UNCAUGHT patches now permanently test-enforced (P2, P7, P5).

---

## 4. DELIBERATELY-BROKEN PATCH EXERCISE (14 patches incl. fresh name:-exclusion)

`/tmp/rt-m57-c4/patch.js`. Each: literal substitution (occurrence == 1) →
`node --test <file>` → fail count → revert → re-confirm fail 0. Source/test
SHA byte-identical before, each round, and after.

| ID | File | Patch | Test | applied→fail | rev→fail | Result |
|----|------|-------|------|--------------|----------|--------|
| **P-NEW** | build-coverage | `isWorkflowNameLabel(line)` guard `&& false` (disable BUG-9 fix) | D1 | 2 | 0 | **CAUGHT** ← the fresh name:-exclusion patch |
| P2 | build-coverage | `^COPY --from=` skip `&& false` (BUG-3) | D1 | 1 | 0 | **CAUGHT** |
| P4 | build-coverage | `stripComment(rawLine)→rawLine` (BUG-6) | D1 | 2 | 0 | **CAUGHT** |
| P5 | build-coverage | `head==='node_modules'→'XXXX'` (BUG-7) | D1 | 1 | 0 | **CAUGHT** |
| P6 | build-coverage | `!coveredSet.has→coveredSet.has` | D1 | 17 | 0 | **CAUGHT** |
| P15 | build-coverage | `collapseToTopLevel split('/')[0]→[1]` | D1 | 17 | 0 | **CAUGHT** |
| P3 | build-coverage | D1 CLI `result.ok ? 0 : 4`→`: 0` | D1 | 1 | 0 | **CAUGHT** |
| P7 | ci-parity | `clearBuildCaches(projectDir);` commented (BUG-2) | D2 | 1 | 0 | **CAUGHT** |
| P8 | ci-parity | `isContained`→`return true;` (BUG-1) | D2 | 5 | 0 | **CAUGHT** |
| P9 | ci-parity | `isContained` allow `p===root` (BUG-8 reintro) | D2 | 3 | 0 | **CAUGHT** |
| P10 | ci-parity | BUG-5 consequence `if(false&&…)` | D2 | 1 | 0 | **CAUGHT** |
| P12 | ci-parity | LOCKED precedence reorder (cloudbuild↔workflows) | D2 | 1 | 0 | **CAUGHT** |
| P13 | ci-parity | `runCommand ok:exitCode===0→true` | D2 | 1 | 0 | **CAUGHT** |
| P14 | ci-parity | D2 CLI `result.ok ? 0 : 4`→`: 0` | D2 | 1 | 0 | **CAUGHT** |

**Broken patches CAUGHT: 14 / 14. ZERO uncaught on contract-mandated
behavior.** The fresh patch targeting the new name:-exclusion line (P-NEW)
is test-enforced — disabling the BUG-9 fix fails 2 D1 tests
(`BUG-9: workflow step …`, `BUG-9: a quoted step …`).

---

## 5. REGRESSION / STABILITY

- **Full `npm test` ×2**: run 1 → `2607 tests, 2606 pass, 0 fail, 1 skipped`;
  run 2 → `2607 tests, 2606 pass, 0 fail, 1 skipped`. **Identical, clean,
  zero regressions.** The single skip is the by-design Docker-less SC2 skip.
- **M57-isolated determinism**: `node --test m57-d1 m57-d2` ×2 → both
  `57 tests, 56 pass, 0 fail, 1 skipped`. Deterministic; the 1 skip is the
  documented Docker-less SC2 skip; stable across runs.
- **m43-flake disposition**: the documented pre-existing
  `test/m43-dashboard-autostart.test.js` parallel-execution flake **did not
  surface in either full run** (both 0-fail). In isolation it passed
  **6/6 runs** (`pass 6 fail 0` each). It is pure-CLI-unrelated to M57 (M57
  is library-only build-coverage/ci-parity code with no dashboard surface).
  **Not an M57 bug — and this cycle it did not even manifest.** M57's isolated
  tests are clean and deterministic; the only theoretical full-suite
  nondeterminism source is that unrelated m43 test, which was green.

---

## ATTACK VECTORS TRIED (every category — one-line each)

1. **Contract Violations** — every D1/D2 envelope key vs v1.0.3/v1.0.2; exit
   0/4/2; LOCKED D2 precedence (P12); strict-descendant containment
   (BUG-1/8); comment-strip + name:-exclusion precedence (BUG-6/9);
   `node_modules` rule (BUG-7); BUG-5 detected-but-unparseable + exemptions.
   Contract v1.0.3 lines 71–90 claim a `name:` value "is discarded" — true
   for single-line, **false for block/folded multi-line scalars → BUG-9b**.
2. **Boundary Inputs** — name: job/workflow/step level, `name :` spacing,
   `name: |` block scalar, `name: >` folded scalar, non-leading dir position,
   quoted name, env:/if:/with:/paths: YAML values, quoted run-string;
   outDir ∈ {`.`,`./`,`src/..`,`./foo/../`,`../VICTIM`,abs,`dist`}. Found
   **BUG-9b** (multi-line scalar name: continuation FN).
3. **State Transitions** — N/A: stateless pure functions; clearBuildCaches /
   checkBuildCoverage idempotent across repeated calls (verified).
4. **Error Paths** — malformed tsconfig → no throw; not-a-git / identical
   refs → exit 2 (test-bound); docker-unavailable → non-failure. No crash
   escapes checkBuildCoverage/runCiParity.
5. **Missing Flows** — TimeTracking-class core mandate re-probed via the
   block/folded scalar name: form → **BUG-9b** (a new realistic FN still
   reachable). Single-line name: (BUG-9a), comment (BUG-6), node_modules
   (BUG-7), interior token (BUG-4) all closed and test-enforced.
6. **Regression** — full `npm test` ×2: 2607/2606/0fail/1skip both, identical.
   M57-isolated deterministic. m43-flake did not surface; 6/6 in isolation.
   All 4 source/test files SHA-256 byte-identical pre- and post-exercise.
   m57 fixture dirs PRESERVED.
7. **E2E Functional Gaps** — N/A. M57 is pure CLI/Node; no
   `playwright.config.*`/`cypress.config.*` relevant. Stated, skipped.
8. **Design Fidelity** — N/A. No design contract relevant to M57; no UI.
   Stated, skipped.

Exploratory (Playwright MCP): N/A — no UI surface.

---

## SUMMARY

- **BUGS FOUND this cycle: 1 — BUG-9b (HIGH)**: a GitHub Actions block/folded
  scalar step `name:` value (`- name: |` / `- name: >`) whose continuation
  line names a new top-level dir as a leading `name/`-token still masks a
  genuinely-uncovered new dir → `ok:true missing:[]`. Outside the contract
  v1.0.3 documented-and-accepted residual (strictly quoted command strings in
  run/value position). Same forbidden false-negative class the cycle-3 BUG-9
  single-line fix closed — reached via the multi-line scalar form of the same
  `name:` key the line-oriented `isWorkflowNameLabel()` does not track.
- **BUG-1 RESOLVED** — sibling `../VICTIM` survives; P8 caught.
- **BUG-2 RESOLVED** — runCiParity clears stale `.tsbuildinfo` dockerless; P7 caught.
- **BUG-3 RESOLVED** — relative `COPY --from= dist/` excluded; P2 caught.
- **BUG-4 RESOLVED** — incidental `node_modules/husky/hooks/` does not cover new `hooks/`; P15/P6 caught.
- **BUG-5 RESOLVED** — unparseable+no-Dockerfile → ok:false; `none` → ok:true; P10 caught.
- **BUG-6 RESOLVED** — workflow + cloudbuild comment naming `hooks/` still missing; P4 caught.
- **BUG-7 RESOLVED** — first-component `node_modules/` token never coverage; P5 caught.
- **BUG-8 RESOLVED** — root survives `outDir:"."`/variants; strict-descendant `dist/` still cleared; P9 caught.
- **BUG-9 (single-line `name:` prose, cycle-3)** — **RESOLVED**: all 4
  documented cycle-3 variants now `ok:false missing:["hooks"]`; job/workflow/
  step level, `name :` spacing, non-leading, quoted all closed; P-NEW caught.
  **BUG-9b (multi-line block/folded `name:` scalar continuation)** — **OPEN
  (HIGH)**: the same prose class via the multi-line scalar form is still a
  false negative outside the documented residual.
- **Broken patches CAUGHT: 14 / 14** — ZERO uncaught on contract-mandated
  behavior. The fresh name:-exclusion patch (P-NEW) and all 8
  prior-bug-specific patches (incl. cycle-1/2 previously-UNCAUGHT P2/P7/P5)
  caught.
- **CONTRACTS VERIFIED: 2 / 2** — cli-build-coverage **v1.0.3**, ci-parity
  **v1.0.2**. ci-parity v1.0.2 strict-descendant containment fully verified
  (no divergence, no over-correction). cli-build-coverage v1.0.3:
  comment-strip + node_modules rule + single-line name:-exclusion verified;
  the v1.0.3 claim that a `name:` value "is discarded before any path token
  is extracted" (lines 71–90) holds for single-line scalars but is
  **violated for block/folded multi-line `name:` scalars → BUG-9b**, an FN
  in the forbidden Purpose/SC1 class outside the documented residual.
- **COVERAGE GAPS**: no D1 test exercises a block/folded-scalar `name:` value
  continuation (BUG-9b). All cycle-1/2/3 single-line gaps closed and
  test-enforced.
- **REGRESSION**: full `npm test` ×2 → 2607/2606 pass/0 fail/1 skip,
  identical both runs. M57-isolated 57/56/0/1 deterministic ×2. Documented
  pre-existing m43-dashboard-autostart parallel flake did not surface this
  cycle (both full runs 0-fail; 6/6 in isolation) — explicitly NOT an M57
  bug, M57 is library-only with no dashboard surface.
- **SHALLOW TESTS REWRITTEN: 0** (Red Team leaves the tree as found;
  source/test SHA byte-identical; fixtures preserved).
- **VERDICT: `FAIL`** — the cycle-3 BUG-9 single-line `name:` vector is
  *genuinely* closed (all 4 documented variants, plus job/workflow-level,
  odd-spacing, non-leading, and quoted adversarial variants — all caught and
  test-enforced via P-NEW), and the prior 8 bugs *all stay closed* (16/16
  behavioral, 14/14 broken patches caught, zero uncaught on contract-mandated
  behavior, both previously-UNCAUGHT cycle-1 patches and the cycle-2 UNCAUGHT
  patch permanently test-enforced, the cycle-1-introduced root-deletion defect
  hardened). No over-correction: legitimate `run:`/`working-directory:`/
  `args:`/`paths:` coverage and the cloudbuild builder-image `name:` are all
  intact. This is real, substantial, verified progress and the BUG-9 fix is
  not papered over. But the exhaustive adversarial search found **one new
  real bug, BUG-9b (HIGH)**: the BUG-4/BUG-6/BUG-9 false-negative class
  (`textual presence ≠ shipped by build`) was again *narrowed without being
  fully closed* — the line-oriented `name:`-exclusion does not track YAML
  block/folded multi-line scalar values, so the structurally-identical
  multi-line `- name: |` / `- name: >` prose continuation still defeats the
  gate. Per contract v1.0.3 Purpose/SC1 (and the contract's own explicit
  claim that a `name:` value "is discarded"), a false negative outside the
  documented-and-accepted residual is a forbidden defect, not an accepted
  limitation.

## M90 Red Team (verify-m90) — 2026-06-22

### BUG-1 (HIGH): loop-ledger never halts variant-spawning loops — contract R-LOOP-1 contradicted
- **Surface**: bin/gsd-t-loop-ledger.cjs (appendCycle, lines 230-244) + templates/workflows/gsd-t-debug.workflow.js (thisRunSigCycles, lines 378-389)
- **Reproduction**: append-cycle 3× with the SAME --assertion ("symptom") but a DIFFERENT --surface each cycle (the variant-spawning / whack-a-mole pathology). Each variant gets a distinct SHA-256 signature key in state.cycles, so each stays at cycles:1 and the `cycles >= HALT_THRESHOLD(3)` halt NEVER fires.
- **Expected** (contract m90-doctrine-mechanisms-contract.md §3 R-LOOP-1): "A fix that closes signature A but opens signature B still increments (variant-spawning IS the pathology)" → such a loop should HALT.
- **Actual**: read-exit-state returns haltedSignatures:[] after 3+ variant cycles. The debug workflow's run-local detector (`thisRunSigCycles[sig] >= 2`) also misses it because the signature differs each cycle (surface = filesEdited[0] changes). Verify R-FAIL-3 then PASSES a genuinely non-converging loop.
- **Impact**: This is the exact failure mode M90 §3 exists to catch (binvoice FB-modal saga, [Debug loop must halt, not narrate]). A whack-a-mole debug loop that "fixes" a different file each cycle is silently passed by the gate (silent-wrong-output of a safety gate). Only a same-symptom + same-file 3× loop halts.
- **Shallow test**: test/m90-loop-ledger-halt.test.js:157 ("R-LOOP-1: ... still increments overall ledger count") ASSERTS the buggy behavior — `assert.equal(r.cycles, 1, 'signature B starts at 1')` + `assert.equal(exitState.haltedSignatures.length, 0)`. The test name claims R-LOOP-1 is satisfied; its assertions lock in the escape. Must be rewritten to require that variant-spawning across surfaces (same symptom) accumulates toward a halt.

### Lower-severity observations (not verdict-blocking)
- Legacy state-file `reExaminationPending:false` + `halted:{S:true}` migrates to not-pending → gate passes a halted sig. Only reachable from hand-crafted/legacy files (new model sets halt+pending together; recordReExamination full-resets). LOW.
- R-FAIL-2 arch-trigger instrumentation sink is best-effort (swallows write errors) → a proven-by-adversary-only event could vanish → gate reads count 0 (fail-open). Documented interface-only this milestone (backlog #42). LOW.

### Attack vectors tried
- Contract: §1/§2/§3 signatures verified; R-LOOP-1 invariant VIOLATED (BUG-1).
- Boundary inputs: empty/whitespace/non-string/array-typed state → all fail-closed correctly. prototype-pollution via assertion → moot (SHA-256 keyed).
- State transitions: per-signature clear, blanket-clear refusal, milestone scoping (decision A) → all correct.
- Error paths: corrupt state → fail-closed (exit 1) correctly; verify gate FAILs on it.
- Classifier silent-miss: external-claim misroute attempts → all → ambiguous/judge or internal→grep→§5.1-escalate (wired). No silent-miss.
- Regression: full suite 1993 pass / 0 fail / 4 skip.

### VERDICT: FAIL (1 HIGH bug — BUG-1)
