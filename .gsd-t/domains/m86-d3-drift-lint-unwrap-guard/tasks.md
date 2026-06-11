# Tasks: m86-d3-drift-lint-unwrap-guard

> Plan-grade Shape D. QUARANTINED SAFETY NET — the single highest-consequence
> surface. WRITES ONLY under `test/` (read-only on `templates/workflows/`), so it
> independently verifies D2 without sharing a file. Every behavioral task carries
> **Files**, **Touches**, **Acceptance criteria**, **Test**. Fail-CLOSED: an
> unrecognized `model:` line is a FAILURE, never a silent skip.

## Files Owned

- `test/m85-workflow-tier-policy-lint.test.js`
- `test/m86-lint-unwrap-fallback.test.js`

---

### M86-D3-T1 — Unwrap the `??` form in the literal extractor
**Touches:** `test/m85-workflow-tier-policy-lint.test.js`
**Files:** `test/m85-workflow-tier-policy-lint.test.js`
**Test:** `node --test test/m85-workflow-tier-policy-lint.test.js` (the suite runs against D2's real edited workflows)
**Depends on:** D1-T4 (the published tier set + designated-stage policy the lint validates against); reads D2-T1/T2/T3's `??` forms read-only.
**Contract refs:** `model-profile-config-contract.md` §Drift-Lint Obligation; `model-tier-policy-contract.md` §Drift Enforcement.

Extend the lint's model-literal extractor/regex so it recognizes
`model: overrides["<stage>"] ?? "<premium-literal>"` and YIELDS **BOTH the bracket stage KEY and
the FALLBACK literal** for validation, while still recognizing the bare `model: "<literal>"` form.
Validate (a) the extracted fallback against the published tier set (D1's `MODEL_IDS` keys) AND the
designated-stage policy (premium = the fallback for every designated stage); (b) **the bracket key
=== that stage's designated stageKey, sourced from the policy module's `PROFILE_STAGE_TIERS`/
`STAGE_TIERS` keys — NOT re-hardcoded** (pre-mortem r1 #2: a typo'd key like `overrides["red-tem"]`
has a correct fallback, passes a fallback-only lint, and silently disables the override FOREVER —
the stage runs premium fable on every profile). The extractor must ALSO recognize the combined
debug form `cycle === 1 ? "opus" : (overrides["debug-cycle-2"] ?? "fable")`, validating the
cycle-1 if-branch literal AND the parenthesized `??` else-branch (key + fallback) — pre-mortem
r1 #6. FAIL-CLOSED: any `model:`-bearing line the extractor cannot parse FAILS the lint (never a
silent skip).

**Acceptance criteria:**
- The extractor returns key + fallback for every `??`-form line (flat AND combined-ternary) and
  the bare literal for every bare line; fallbacks validated against tier set + stage policy;
  bracket keys validated against the policy module's stage keys (not a re-hardcoded list).
- An unparseable `model:`-bearing line FAILS (fail-closed) — proven by a fixture in T3.
- Verified by `node --test test/m85-workflow-tier-policy-lint.test.js` GREEN against D2's real
  edited workflows.

### M86-D3-T2 — Designated-stage labelPattern assertions + non-empty-match meta
**Touches:** `test/m85-workflow-tier-policy-lint.test.js`
**Files:** `test/m85-workflow-tier-policy-lint.test.js`
**Test:** `node --test test/m85-workflow-tier-policy-lint.test.js`
**Depends on:** T1.
**Contract refs:** `model-tier-policy-contract.md` §Stage Policy.

Update discovery so each designated stage's `labelPattern` still matches its `??` line, and the
extracted fallback equals the expected premium-active tier (solution-space-probe / partition-probe
/ competition-judge / pre-mortem / red-team / debug-cycle-2 → `fable`; producers → bare `opus`).
PRESERVE the M85 non-empty-match meta-assertion (≥1 `model:` line matched per designated stage —
a regex silently matching zero lines is the vacuous-pass failure mode this guard exists to prevent).

**Acceptance criteria:**
- Each designated stage matches ≥1 `model:` line and its extracted fallback equals the expected
  premium tier; producers resolve to bare `opus`.
- The non-empty-match meta-assertion holds (vacuous-zero-match FAILS).
- Verified by `node --test test/m85-workflow-tier-policy-lint.test.js` GREEN.

### M86-D3-T3 — Mandatory negative fixtures (NEW — the three non-negotiable negatives)
**Touches:** `test/m86-lint-unwrap-fallback.test.js`
**Files:** `test/m86-lint-unwrap-fallback.test.js`
**Test:** `node --test test/m86-lint-unwrap-fallback.test.js` (each negative ASSERTED to FAIL via the same extractor/validator entry point)
**Depends on:** T1 (the extractor/validator under test); uses fixture STRINGS, not real-workflow edits (keeps D3 write-disjoint from D2).
**Contract refs:** `model-profile-config-contract.md` §Drift-Lint Obligation (3 mandatory negatives).

NEW test file. Fixtures fed to the extractor/validator, each negative asserted to FAIL:
- (i) drifted BARE literal (e.g. `model: "claude-opus-4-7"`) → FAILS (M85 invariant preserved).
- (ii) `??` form with a drifted FALLBACK (e.g. `overrides["red-team"] ?? "claude-opus-4-7"`) → FAILS.
- (iii) `??` form with a fallback OUTSIDE the tier set (e.g. `?? "gpt-4"`) → FAILS.
- (iv) **typo'd bracket KEY with correct fallback** (`overrides["red-tem"] ?? "fable"`) → FAILS
  (pre-mortem r1 #2 — the silently-disabled-override class).
- (v) **combined debug form, drifted cycle-1 branch**
  (`cycle === 1 ? "fable" : (overrides["debug-cycle-2"] ?? "fable")`) → FAILS (pre-mortem r1 #6).
- (vi) **combined debug form, drifted parenthesized fallback**
  (`cycle === 1 ? "opus" : (overrides["debug-cycle-2"] ?? "claude-opus-4-7")`) → FAILS.
Plus: the CORRECT combined form as a passing POSITIVE (proves the rewritten extractor actually
recognizes it, not vacuous), and a fail-closed fixture (an unparseable `model:`-bearing line
FAILS). Use a fixture-string harness so this domain stays write-disjoint from D2's workflow source.

**Acceptance criteria:**
- All seven negatives FAIL as designed (a green suite with no negative coverage is a FAILED
  domain); the correct combined form PASSES.
- The negatives drive the SAME validator path the real-workflow lint uses (not a parallel mock).
- Verified by `node --test test/m86-lint-unwrap-fallback.test.js` (each negative asserted via
  expected-throw / FAIL-detection harness).

### M86-D3-T4 — Green run + cross-check against D2's real workflows (killing test for SC(c))
**Touches:** (verification — no new file)
**Files:** `test/m85-workflow-tier-policy-lint.test.js`, `test/m86-lint-unwrap-fallback.test.js`
**Test:** `node --test test/m85-workflow-tier-policy-lint.test.js test/m86-lint-unwrap-fallback.test.js`
**Depends on:** T1–T3, D2-T1/T2/T3 (the real edited workflows the lint runs against).
**Contract refs:** `model-tier-policy-contract.md` §Drift Enforcement.

Run both test files. Confirm: D2's actual edited workflows PASS the unwrap lint, all three (+1
fail-closed) negatives FAIL as designed, and all M85 invariants intact (bare-literal producers
stay `opus`; bottom ladder unchanged). This is SC(c)'s killing observation.

**Acceptance criteria:**
- Real workflows PASS; drifted-bare AND drifted-fallback BOTH FAIL; out-of-tier fallback FAILS;
  M85 invariants intact — SC(c).
- Verified by running both globs to the designed pass/fail pattern.

---

## Acceptance bindings → milestone ACs (this domain)

| Milestone AC | Bound task(s) | Impl path | Killing test |
|--------------|---------------|-----------|--------------|
| (c) lint bites both forms | T1+T2 (unwrap+validate) + T3 (negatives) | `test/m85-workflow-tier-policy-lint.test.js` extractor | T3 drifted-bare + drifted-fallback + out-of-tier negatives; T4 cross-check |

D3 is the independent verifier of D2: a drifted fallback in D2 makes this lint FAIL.
