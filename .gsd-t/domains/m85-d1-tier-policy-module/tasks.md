# Tasks: m85-d1-tier-policy-module

## Summary
The dependency-graph ROOT. Ship the single zero-dep canonical tier-policy module (`bin/gsd-t-model-tier-policy.cjs`) and finalize its cross-domain contract. Publishes the concrete model-id constants (`claude-opus-4-8`, `claude-fable-5`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`), the `{stageKey → tier → model id}` map, the `requiresThinkingOmitted(model)` predicate (encoding the Fable thinking-disabled-400 breaking change exactly ONCE), and a `resolve(stageKey)` function + CLI resolver. The serial gate for the whole milestone is these constants landing — D2/D3/D4 code against the published contract, never the module internals.

## Tasks

### M85-D1-T1 — Tier-policy module: constants + stage map + predicate + resolver
- **Touches**: `bin/gsd-t-model-tier-policy.cjs` (NEW)
- **Files**: `bin/gsd-t-model-tier-policy.cjs`
- **Test**: `test/m85-model-tier-policy.test.js`
- **Contract refs**: `.gsd-t/contracts/model-tier-policy-contract.md` v1.0.0 (the file this domain finalizes in T4)
- **Deps**: NONE (ROOT)
- **Headline**: true
- **Acceptance criteria**:
  - Exports a frozen `MODEL_IDS` map of the 4 published tier aliases to concrete ids EXACTLY as the contract's "Published Model-ID Constants" table states: `opus → claude-opus-4-8`, `fable → claude-fable-5`, `sonnet → claude-sonnet-4-6`, `haiku → claude-haiku-4-5-20251001`. *(Falsifier: any id drifts from the contract table — e.g. `opus → claude-opus-4-7`. Test: `test/m85-model-tier-policy.test.js` asserts the map value-for-value.)*
  - Exports a frozen `STAGE_TIERS` map of the 7 contract stage keys to a tier alias EXACTLY per the contract's "Stage Policy" table: `solution-space-probe → fable`, `partition-probe → fable`, `competition-judge → fable`, `competition-producers → opus`, `pre-mortem → fable`, `red-team → fable`, `debug-cycle-2 → fable`. *(Falsifier: `competition-producers` resolves to anything but `opus`, or any of the 5 Fable stages resolves to non-fable. Test: `test/m85-model-tier-policy.test.js` iterates all 7 keys.)*
  - `resolve(stageKey)` returns the concrete model id for the stage's tier (e.g. `resolve("red-team") === "claude-fable-5"`, `resolve("competition-producers") === "claude-opus-4-8"`); unknown key returns `null` and never throws. *(Falsifier: `resolve` throws on unknown key, or returns a tier alias instead of a concrete id. Test: `test/m85-model-tier-policy.test.js`.)*
  - `requiresThinkingOmitted(model)` returns `true` IFF `model === "claude-fable-5"`, `false` for every other id (tier aliases, other concrete ids, unknown strings); the rationale comment (HTTP-400) is encoded ONCE here. *(Falsifier: returns `true` for any non-Fable id, or `false` for `claude-fable-5`. Test: `test/m85-model-tier-policy.test.js` truth-table case.)*
  - Module is pure: zero external `require` beyond Node built-ins, no top-level side effects, never throws on any exported-function call. *(Falsifier: a runtime dep appears, or an exported fn throws on bad input. Test: `test/m85-model-tier-policy.test.js` + zero-dep grep assertion.)*

### M85-D1-T2 — Resolver CLI command + JSON envelope
- **Touches**: `bin/gsd-t-model-tier-policy.cjs` (additive — CLI dispatch block)
- **Files**: `bin/gsd-t-model-tier-policy.cjs`
- **Test**: `test/m85-model-tier-policy.test.js` (CLI-envelope cases)
- **Contract refs**: `.gsd-t/contracts/model-tier-policy-contract.md` v1.0.0 § "Resolver Surface"
- **Deps**: Requires T1
- **Acceptance criteria**:
  - `node bin/gsd-t-model-tier-policy.cjs resolve <stageKey> --json` prints `{ok:true, stageKey, tier, model, requiresThinkingOmitted}` and exits 0 for a known key. *(Falsifier: non-JSON under `--json`, or missing `model`/`tier`. Test: `test/m85-model-tier-policy.test.js` spawns the CLI.)*
  - Unknown stage key prints `{ok:false, stageKey, error}` and exits non-zero (mis-typed key fails loud). *(Falsifier: unknown key exits 0 or emits a usable id. Test: `test/m85-model-tier-policy.test.js` spawns `resolve bogus --json`.)*
  - The CLI is the M69 invoke-time injection surface (invoker resolves the id, injects via `args`); workflows NEVER `require` this module. *(Falsifier: a workflow requires it — caught by D4's `test/m85-workflow-tier-policy-lint.test.js`.)*

### M85-D1-T3 — Unit tests for module + CLI (TDD)
- **Touches**: `test/m85-model-tier-policy.test.js` (NEW)
- **Files**: `test/m85-model-tier-policy.test.js`
- **Test**: self — `node --test test/m85-model-tier-policy.test.js`
- **Contract refs**: `.gsd-t/contracts/model-tier-policy-contract.md` v1.0.0
- **Deps**: Requires T1, T2
- **Acceptance criteria**:
  - Asserts `MODEL_IDS` matches the contract table value-for-value (4 entries) and the map is frozen. *(Test: self.)*
  - Asserts `resolve()` for all 7 stage keys returns the contract-mandated concrete id, including `competition-producers → claude-opus-4-8` (held-opus invariant) and the 5 Fable stages → `claude-fable-5`. *(Test: self.)*
  - Asserts the `requiresThinkingOmitted` truth table: `true` only for `claude-fable-5`; `false` for `claude-opus-4-8`/`claude-sonnet-4-6`/`claude-haiku-4-5-20251001`/unknown/each alias. *(Test: self.)*
  - Asserts `resolve(<unknown>) === null` and no exported fn throws. *(Test: self.)*
  - CLI test: spawn `resolve red-team --json` → `{ok:true, model:"claude-fable-5"}`; spawn `resolve bogus --json` → `{ok:false}` + non-zero exit. *(Test: self.)*
  - Suite total green; M71 runtime-native lint unaffected (no workflow touched). *(Test: `npm test`.)*

### M85-D1-T4 — Finalize the cross-domain contract as STABLE
- **Touches**: `.gsd-t/contracts/model-tier-policy-contract.md` (already drafted v1.0.0 — confirm STABLE + module consistency)
- **Files**: `.gsd-t/contracts/model-tier-policy-contract.md`
- **Test**: `test/m85-model-tier-policy.test.js` (T3's value-for-value assertions are the contract-drift detector — a contract id the module doesn't emit is a test failure)
- **Contract refs**: self (`model-tier-policy-contract.md` v1.0.0)
- **Deps**: Requires T1, T3
- **Acceptance criteria**:
  - The contract's "Published Model-ID Constants", "Stage Policy", and "`requiresThinkingOmitted`" sections exactly match the shipped module values. *(Falsifier: a contract id/tier the module does not emit. Test: `test/m85-model-tier-policy.test.js` fails on mismatch.)*
  - Status line reads `STABLE`; consumers cite this version, never the module internals. *(Test: grep `Status: STABLE` in the contract.)*

## Execution Estimate
- Total tasks: 4
- Independent tasks (no blockers): 1 (T1 — ROOT)
- Blocked tasks (within-domain): 3 (T2 needs T1; T3 needs T1+T2; T4 needs T1+T3)
- Estimated checkpoints: 1 (after T3 — module + CLI + tests green = the seam the other domains depend on)

## REQ Coverage
- AC (b)/(d)/(g) root enablers → T1, T2 (module + resolver + predicate)
- Drift-enforceable seam (AC a depends on this) → T1, T4 (published constants D4's lint reads)
- Zero-dep + runtime-native invariants → T1, T2
