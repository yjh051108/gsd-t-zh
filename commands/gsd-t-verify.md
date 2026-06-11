# GSD-T: Verify — Quality Gates

> **⛔ Invoke the Workflow tool — do not hand-drive.** Your only job is to resolve the workflow path (`gsd-t workflow-path verify`) and call the `Workflow` tool as the steps below instruct. Do NOT reconstruct the workflow stages in your own reasoning, spawn finder/worker subagents yourself, or fall back to a hand-driven run — that skips the deterministic stages and produces an incomplete result. The prose below describes what the Workflow does internally; it is background, not a to-do list for you.


You are the lead agent. Verify the current milestone by invoking the canonical Workflow script at `templates/workflows/gsd-t-verify.workflow.js`.

## What this command does

Replaces the M40-era verify-orchestrator scaffolding with a single deterministic Workflow:

```
preflight → brief → verify-gate (deterministic Track 1+2)
         → M57 CI-Parity (build-coverage + ci-parity, FAIL-blocking)
         → M58 Test-Data Purge (FAIL-blocking)
         → parallel(/code-review ultra ∥ Red Team ∥ QA)
         → synthesis (no category collapse)
```

Per `.gsd-t/contracts/orthogonal-validation-contract.md` v1.0.0 STABLE, the three triad stages are orthogonal objective functions — no collapse, no substitution, no transitive trust. Synthesis preserves category labels.

**Hard-failing gates** (each halts before triad):
- `verify-gate` — deterministic Track 1 (preflight envelope) + Track 2 (tsc/biome/npm-test/knip/gitleaks/scc fan-out)
- M57 `build-coverage` + `ci-parity` — origin TimeTracking v1.10.12 Dockerfile incident
- M58 `test-data --purge` — origin GSD-T-Board v0.1.10 2442 E2E orphans incident

## Step 1: Read the current milestone state

Read `.gsd-t/progress.md` to determine the active milestone.

## Step 2: Resolve the active model profile (M86 — invoke-time injection)

Before calling the Workflow, resolve the active model profile to build the `overrides` map:

```bash
# Run via Bash at invoke time:
gsd-t model-profile resolve --json
# Bare form (NO --profile flag): reads .gsd-t/model-profile.json — profile AND stageOverrides
# (set-stage overrides MUST win — contract precedence; --profile is a config-blind diagnostic
# form that ZEROES stageOverrides and must never be used for invocation — Red Team M86 r3)
# Output: { "ok": true, "profile": "...", "overrides": { "stage-key": "concrete-model-id", ... } }
```

**Resolver-failure handling (M86 — SC(f), pre-mortem c2 #2):** if the resolve call fails
(`{ok:false}`, spawn error, or the `model-profile` subcommand is not present in the installed
binary), do NOT silently proceed on the premium fallback. Either:
- HALT with `blocked-needs-human` and explain the resolver is unavailable; OR
- Proceed ONLY with a **loud, surfaced warning** that names the effective posture:

  ```
  ⚠ model-profile resolver unavailable — running on PREMIUM fallback literals
    (configured profile unknown; stale global binary may lack model-profile subcommand)
  ```

Also surface a SUCCESSFUL resolve that carries a `configError` field (the resolver returns a
named default + `configError` for malformed/hand-edited configs — Red Team M86): print the
`configError` as a visible warning naming the effective profile before proceeding. A clean-looking
run on a posture the user did not configure is the same silent-spend failure class.

## Step 3: Invoke the verify Workflow

Call the `Workflow` tool with:

```js
{
  // Resolve the ABSOLUTE path FIRST via Bash: `gsd-t workflow-path verify` (the
  // workflow ships in the installed @tekyzinc/gsd-t package, not this project — a
  // bare relative path only resolves from the GSD-T source repo). Use its stdout here:
  scriptPath: "<absolute path printed by `gsd-t workflow-path verify`>",
  args: {
    milestone: "M{NN}",
    projectDir: ".",
    // M86: inject the resolved overrides map so the workflow's ?? forms (including
    // red-team) pick up the profile-tier assignments instead of premium literals.
    // Pass {} when the resolver failed AND you chose the loud-warning path (not halt).
    overrides: { /* ...from resolver result.overrides, or {} on failure */ },
    // Optional: skip /code-review ultra when rate-limited.
    // skipUltra: false,
    // skipUltraReason: "ultra rate-limited per error E429",
  }
}
```

`skipUltra: true` requires `skipUltraReason: string` per contract Rule #2. A run with `skipUltra: true` is INELIGIBLE for `VERIFIED` — best attainable verdict is `VERIFIED-WITH-WARNINGS`. Red Team and QA are non-skippable.

## Step 4: Interpret the result

The Workflow returns:

```js
{
  status: "complete" | "failed",
  overallVerdict: "VERIFIED" | "VERIFIED-WITH-WARNINGS" | "VERIFY-FAILED",
  verifyGate: { ... },        // Track 1+2
  buildCoverage: { ... },     // M57
  ciParity: { ... },          // M57
  testDataPurge: { ... },     // M58
  triad: [ultraResult, redTeamResult, qaResult],
  verdict: { overallVerdict, summary, blockingFindings }
}
```

- `VERIFIED` → auto-advance to `/gsd-t-complete-milestone`
- `VERIFIED-WITH-WARNINGS` → same auto-advance; warnings persist in `progress.md` Decision Log
- `VERIFY-FAILED` → invoke `gsd-t-debug` against the first blocking finding

## Document Ripple

Verify is a quality gate — the work it inspects is already committed by execute/integrate. Verify itself adds:

- `.gsd-t/progress.md` — verdict + summary line
- `.gsd-t/red-team-report.md` — Red Team findings (if any)
- `.gsd-t/qa-issues.md` — QA shallow tests + contract violations

## Next Up

`/gsd-t-complete-milestone` (auto-invoked on `VERIFIED` / `VERIFIED-WITH-WARNINGS`).
