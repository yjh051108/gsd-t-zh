# GSD-T: Verify — Quality Gates

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

## Step 2: Invoke the verify Workflow

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
    // Optional: skip /code-review ultra when rate-limited.
    // skipUltra: false,
    // skipUltraReason: "ultra rate-limited per error E429",
  }
}
```

`skipUltra: true` requires `skipUltraReason: string` per contract Rule #2. A run with `skipUltra: true` is INELIGIBLE for `VERIFIED` — best attainable verdict is `VERIFIED-WITH-WARNINGS`. Red Team and QA are non-skippable.

## Step 3: Interpret the result

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
