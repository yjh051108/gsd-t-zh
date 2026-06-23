# Constraints: m89-d3-wiring-upper-phase-and-gate

## Hard Rules
- **M71 runtime-native invariant.** NO `require`/`fs`/`path`/`child_process`/`process` in the edited workflows.
  Delegate the classifier call to an `agent()`'s Bash via the inline `runCli` helper (project-local
  `bin/gsd-t-research-gate.cjs` first, else global `gsd-t`). `args` is a JSON STRING. The M71 lint must stay green.
- **M85 tier policy — BARE `model: "fable"` literal.** The research `agent()` stage declares a BARE
  `model: "fable"` literal, NOT the `overrides["research"] ?? "<literal>"` form — `research` is not one of
  the 6 injectable designated stages, so the `??`-research form FAILS the live M85 lint. The bare literal
  passes the lint's tier-set membership check. The M85 drift lint must stay green.
- **DETECT via Stated-Claims (§6.5, LLM-prompted).** Embed the Stated-Claims snippet so the agent tags each
  load-bearing claim KNOWN | GUESSED(unknown|assumed|stale); the wiring iterates the `[GUESSED:*]` entries
  through the classifier. An untagged claim is an acknowledged best-effort miss, NOT a silent pass.
- **§7 ENFORCE marker.** On `class:external`, WRITE the `<!-- auto-research-claim: class=external
  key=<claim-key> status=uncited -->` marker at classify time, then FLIP it to `status=cited` when the
  matching Verified-Facts block lands (same normalized-claim-key).
- **Idempotent — exact claim-key.** Scan the artifact for an existing marker/Verified-Facts entry before
  researching; skip ONLY on an exact normalized-claim-key match (§4.1, NOT substring/keyword). No re-research
  on a re-run; a distinct-keyed claim still researches.
- **Gate ordering.** The cited Verified-Facts block + the marker flip must be written into the phase artifact
  BEFORE the phase gate re-runs.
- **A4 in verify (marker-keyed).** A phase artifact carrying ANY `status=uncited` external-claim marker (§7)
  FAILS the `gsd-t-verify` gate — the marker is what makes A4 enforceable even on a claim never written as a
  Verified-Facts entry. All markers `status=cited` (with matching cited facts) PASSES.
- **RUN, don't node --check.** Per the workflow-sandbox feedback: validate by running the workflow to completion
  in the real sandbox, not just `node --check`.

## Gated Start
Do NOT begin until D1's A1 corpus test is GREEN (prove-or-kill). A red A1 means HALT for re-scope.

## Test Standard
Own `test/m89-phase-research-wiring.test.js` (wiring + marker lifecycle + idempotency + escalation) and
`test/m89-e2e-research-cite.test.js` (the deterministic-offline dogfood A5: Stated-Claims→classify→marker
write→gate FAIL→stubbed research→cite+flip→gate PASS). Assert the §7 marker write+flip as a real artifact
state change (not a source-pattern match), the A4 FAIL-then-PASS on the SAME claim, idempotency POSITIVE
(exact claim-key skip) AND NEGATIVE (distinct claim still researches), and the ambiguous→grep→escalate path.
Functional assertions (behavior/state), not existence checks.
