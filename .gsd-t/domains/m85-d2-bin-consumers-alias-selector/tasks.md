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
  - The id strings are sourced from / agree with D1's published constants (not a fresh hardcode of a different value; the policy module is the authority). Because the M81 sandbox does NOT apply to `bin/` (only to `*.workflow.js`), `gsd-t-parallel.cjs` MAY `require("./gsd-t-model-tier-policy.cjs")` to source the ids, OR mirror them with a test that asserts equality against the module — either way the test proves agreement. *(Falsifier: alias hardcodes a string that can silently drift from the policy module. Test: assertion compares alias values to the policy module's `MODEL_IDS`.)*

### M85-D2-T1b — Consult requiresThinkingOmitted at the GSD-T-controlled spawn site (pre-mortem finding #3)
- **Touches**: `bin/gsd-t-parallel.cjs` (the `claude -p` spawn env block, ~line 423–424 where `ANTHROPIC_MODEL` is set)
- **Files**: `bin/gsd-t-parallel.cjs`
- **Test**: `test/model-selector.test.js` (or `test/m85-parallel-alias.test.js`) — Fable-spawn-config case
- **Contract refs**: `.gsd-t/contracts/model-tier-policy-contract.md` v1.0.0 § "`requiresThinkingOmitted`"
- **Deps**: Requires M85-D2-T1 (same file)
- **Acceptance criteria**:
  - **The binding (closes the dead-predicate gap):** the ONLY GSD-T-controlled spawn site is `bin/gsd-t-parallel.cjs` (it spawns `claude -p` and sets `ANTHROPIC_MODEL`). The workflow `model:` aliases are consumed by the Anthropic Workflow sandbox runtime, which GSD-T does NOT control — so `requiresThinkingOmitted` would be a DEAD export unless consulted here. When the resolved worker model is `claude-fable-5`, the spawn path consults `requiresThinkingOmitted(model)` and, if `true`, OMITS any explicit thinking-disabled flag/env from the spawn (never sets it false). *(Falsifier: a Fable worker spawn carries an explicit thinking-disabled param → HTTP 400 in production; OR `requiresThinkingOmitted` is exported but never called by any GSD-T code — the dead-code class AC d is meant to prevent. Test: `test/model-selector.test.js` asserts a Fable worker spawn config omits the thinking-disabled param, and a non-Fable spawn is unchanged.)*

### M85-D2-T2 — Add FABLE tier + escalation ladder to model-selector
- **Touches**: `bin/model-selector.js` (`TIERS` enum + escalation/ladder logic; `MODEL_IDS`-equivalent reconciliation)
- **Files**: `bin/model-selector.js`
- **Test**: `test/model-selector.test.js`
- **Contract refs**: `.gsd-t/contracts/model-tier-policy-contract.md` v1.0.0 § "Stage Policy" + § "Published Model-ID Constants"
- **Deps**: BLOCKED by M85-D1-T1
- **Acceptance criteria**:
  - `TIERS` enum gains `FABLE: "fable"` (alongside HAIKU/SONNET/OPUS). *(Falsifier: no FABLE tier. Test: `test/model-selector.test.js` asserts `TIERS.FABLE === "fable"`.)*
  - The debug escalation ladder is cycle-1 `opus` → cycle-2 `fable` → needs-human (matches the contract's `debug-cycle-2 → fable` stage). *(Falsifier: cycle-2 stays opus, or skips to needs-human. Test: `test/model-selector.test.js` asserts cycle-2 selection resolves to fable.)*
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
  - Asserts the escalation ladder cycle-2 resolves to fable. *(Test: self.)*
  - Asserts haiku/sonnet bottom-of-ladder selections are unchanged from pre-M85 (regression guard for AC f). *(Test: self.)*
  - Asserts the model-selector's fable concrete id equals the policy module's `MODEL_IDS.fable`. *(Test: self.)*
  - `npm test` green for this suite and the overall suite. *(Test: `npm test`.)*

## Execution Estimate
- Total tasks: 3
- Independent tasks (no blockers, once D1 lands): 2 (T1, T2 — file-disjoint from each other)
- Blocked tasks (within-domain): 1 (T3 needs T2)
- Estimated checkpoints: 1 (after T3 — both consumers + test green = alias bug dead, FABLE tier live)

## REQ Coverage
- AC (b) alias fixed, test-asserted → T1
- AC (f) no silent degradation (haiku/sonnet unchanged) → T2, T3
- FABLE tier + ladder enabler for D3 assignments → T2
