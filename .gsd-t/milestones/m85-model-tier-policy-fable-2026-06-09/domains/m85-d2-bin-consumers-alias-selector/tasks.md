# Tasks: m85-d2-bin-consumers-alias-selector

## Summary
The two `bin/` CONSUMER files that resolve/document tiers, plus the model-selector test. Fix the live STALE `opus → claude-opus-4-7` alias bug in `bin/gsd-t-parallel.cjs`, add the FABLE tier + escalation ladder to `bin/model-selector.js`, and reconcile `test/model-selector.test.js` — all sourcing ids from the policy contract's published constants, write-disjoint from the policy module and from all workflows. Gated on D1's module/contract existing.

## Tasks

### M85-D2-T1 — Fix the stale alias map in gsd-t-parallel
- **Touches**: `bin/gsd-t-parallel.cjs` (line ~585, the `modelAlias` object)
- **Files**: `bin/gsd-t-parallel.cjs`
- **Test**: `test/model-selector.test.js` (alias-assertion cases) — or a targeted `test/m85-parallel-alias.test.js` if the parallel suite is the cleaner home
- **Contract refs**: `.gsd-t/contracts/model-tier-policy-contract.md` v1.0.0 § "Published Model-ID Constants"
- **Deps**: BLOCKED by M85-D1-T1 (needs published `MODEL_IDS`)
- **Acceptance criteria**:
  - `modelAlias.opus` resolves to `claude-opus-4-8`; the stale `claude-opus-4-7` literal is ABSENT from the file. *(Falsifier: alias still returns `claude-opus-4-7`. Test: assertion `modelAlias.opus === "claude-opus-4-8"` + grep that `claude-opus-4-7` no longer appears.)*
  - `modelAlias.fable` added, resolves to `claude-fable-5`. *(Falsifier: no fable entry, or it returns a different id. Test: `modelAlias.fable === "claude-fable-5"`.)*
  - **REQUIRED `require()` sourcing (pre-mortem finding #4 — no mirrored literals):** `gsd-t-parallel.cjs` MUST `require("./gsd-t-model-tier-policy.cjs")` and source `modelAlias` values from `MODEL_IDS` (the M81 sandbox ban applies only to `*.workflow.js`, not `bin/`). Mirroring the ids as bare literals guarded by a snapshot test is FORBIDDEN — a mirrored literal reintroduces a second authority that can co-drift, defeating the milestone's single-source thesis at the exact file that motivated it. *(Falsifier: a bare `claude-opus-4-` / `claude-fable-` / `claude-sonnet-4-` / `claude-haiku-` string literal appears in `gsd-t-parallel.cjs` outside a comment. Test: live-module equality — the test `require`s the policy module at test time and asserts `modelAlias.opus === policy.MODEL_IDS.opus` and `modelAlias.fable === policy.MODEL_IDS.fable`; PLUS a grep assertion that no bare model-id literal exists in the file outside comments. Changing a policy id alone MUST fail the equality test.)*
  - **No thinking-param claims (pre-mortem r1 finding #1 closed by reclassification):** this file sets NO thinking parameters anywhere (verified on disk — only `ANTHROPIC_MODEL` at the cache-warm probe; the worker spawner is M61-retired/absent, TD-114). The `requiresThinkingOmitted` predicate's live surface is D1's resolver envelope, NOT a binding in this file; this task makes NO consultation claim. A grep assertion documents the invariant: no thinking-disable flag/env is set in this file. *(Falsifier: a thinking-disable param is added to a spawn path without consulting the predicate — contract obligation violated. Test: grep assertion in the alias test.)*
  - **CLI-surface Fable proof — BANKED, both forms (pre-mortem r3 finding, required-test option A, executed live 2026-06-09 ~15:26–15:28 PDT):** (i) flag form `claude -p --model claude-fable-5` completed `result: success, is_error: false` with `init.model === claude-fable-5` — the `claude -p` CLI surface does NOT 400 on Fable's default thinking config; (ii) env form `ANTHROPIC_MODEL=claude-fable-5 claude -p` completed without error BUT the env var was SILENTLY IGNORED — `init.model === claude-opus-4-8`. The latent-400 class is refuted by measurement on both forms. Cite both probes in the execute evidence; no per-suite re-run required (the CLI surface is environment-level, not file-level). *(Falsifier: a future `claude -p` Fable spawn 400s — would contradict the banked measurement; re-probe before concluding code is at fault.)*
  - **Fix the measured env-pinning defect (discovered by the r3 probe):** `_runCacheWarmProbe`'s model pinning via `env.ANTHROPIC_MODEL` (line ~424) is INEFFECTIVE on the current CLI (measured: env form ran opus-4-8) — the probe silently warms the WRONG model's cache, defeating its cache-key-match purpose. Change the spawn to pass the model explicitly: append `"--model", model` to the `claude -p` args array when `model` is set (env line may be kept or dropped; the flag is authoritative). *(Falsifier: cache-warm still relies on the ignored env var. Test: unit test asserts the spawn args include `["--model", <resolved id>]` when a model is provided, and omit the flag when not.)*

### M85-D2-T2 — Add FABLE tier + escalation ladder to model-selector
- **Touches**: `bin/model-selector.js` (`TIERS` enum + escalation/ladder logic; `MODEL_IDS`-equivalent reconciliation)
- **Files**: `bin/model-selector.js`
- **Test**: `test/model-selector.test.js`
- **Contract refs**: `.gsd-t/contracts/model-tier-policy-contract.md` v1.0.0 § "Stage Policy" + § "Published Model-ID Constants"
- **Deps**: BLOCKED by M85-D1-T1
- **Acceptance criteria**:
  - `TIERS` enum gains `FABLE: "fable"` (alongside HAIKU/SONNET/OPUS). *(Falsifier: no FABLE tier. Test: `test/model-selector.test.js` asserts `TIERS.FABLE === "fable"`.)*
  - **Exact API shape for cycle-2 selection (pre-mortem r2 finding #2 — `selectModel` has NO cycle dimension; an unspecified "ladder" would be an improvised, unguarded, consumed-by-nobody table):** add ONE new `PHASE_RULES` entry `{ phase: "debug", task_type: "cycle_2_escalation", model: TIERS.FABLE }`, selectable via the existing signature as `selectModel({ phase: "debug", task_type: "cycle_2_escalation" })` — no new parameter, no ladder state, no signature change. The debug DEFAULT rule (`debug → OPUS`) is UNTOUCHED, so cycle-1/default selection is byte-identical to pre-M85. Honest scope note (encoded in the rule's `reason` field): like the rest of model-selector.js, this entry DOCUMENTS the policy for Task-based/`bin/` callers — the live debug workflow's ternary (D3-T3) is the runtime enforcement, and the D4 lint guards THAT; this table is the documented mirror, reconciled to the policy module by T3's equality assertions. *(Falsifier: a `cycle` param or ladder mechanism is improvised; or the debug default rule changes. Test: `test/model-selector.test.js` asserts the exact documented call returns fable.)*
  - `haiku`/`sonnet` bottom-of-ladder rules are UNCHANGED — no existing rule's model field is altered (AC f, no silent degradation). *(Falsifier: any haiku/sonnet PHASE_RULES entry changes tier. Test: `test/model-selector.test.js` asserts representative haiku + sonnet phase selections are byte-identical to pre-M85.)*
  - Concrete ids reconciled to the policy module's `MODEL_IDS` (Fable concrete id `claude-fable-5` where a concrete id is emitted). *(Falsifier: model-selector emits a fable id that disagrees with the policy module. Test: equality assertion vs the policy module.)*

### M85-D2-T3 — Reconcile the model-selector test
- **Touches**: `test/model-selector.test.js` (additive cases)
- **Files**: `test/model-selector.test.js`
- **Test**: self — `node --test test/model-selector.test.js`
- **Contract refs**: `.gsd-t/contracts/model-tier-policy-contract.md` v1.0.0
- **Deps**: Requires M85-D2-T2 (within domain)
- **Acceptance criteria**:
  - Asserts the FABLE tier exists. *(Test: self.)*
  - **Asserts the EXACT cycle-2 call shape (pre-mortem r2 finding #2):** `selectModel({ phase: "debug", task_type: "cycle_2_escalation" })` returns model `fable` — the named signature from D2-T2, not a vacuous assertion against an undefined surface. *(Test: self.)*
  - **Asserts the debug DEFAULT is byte-identical to pre-M85:** `selectModel({ phase: "debug" })` (and `{ phase: "debug", task_type: "root_cause" }`) still return `opus` exactly as before — the AC (f) no-silent-degradation guard on this file. *(Test: self.)*
  - Asserts haiku/sonnet bottom-of-ladder selections are unchanged from pre-M85 (regression guard for AC f). *(Test: self.)*
  - Asserts the model-selector's fable concrete id equals the policy module's `MODEL_IDS.fable`. *(Test: self.)*
  - `npm test` green for this suite and the overall suite. *(Test: `npm test`.)*

## Execution Estimate
- Total tasks: 3
- Independent tasks (no blockers, once D1 lands): 2 (T1, T2 — file-disjoint from each other)
- Blocked tasks (within-domain): 1 (T3 needs T2)
- Estimated checkpoints: 1 (after T3 — both consumers + test green = alias bug dead, FABLE tier live)

## REQ Coverage
- AC (b) alias fixed via live `require()` of the policy module, no mirrored literals, test-asserted → T1
- AC (d) supporting invariant: no thinking params set in this file (grep-asserted; predicate's live surface is D1's resolver envelope) → T1
- AC (f) no silent degradation (haiku/sonnet unchanged) → T2, T3
- FABLE tier + ladder enabler for D3 assignments → T2
