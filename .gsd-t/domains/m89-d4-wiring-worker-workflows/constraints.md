# Constraints: m89-d4-wiring-worker-workflows

## Hard Rules
- **M71 runtime-native invariant.** NO `require`/`fs`/`path`/`child_process`/`process` in the edited workflows.
  Classifier call via the inline `runCli` helper (project-local `bin/gsd-t-research-gate.cjs` first, else global
  `gsd-t`). `args` is a JSON STRING. The M71 lint must stay green.
- **M85 tier policy — BARE `model: "fable"` literal.** The research `agent()` stage declares a BARE
  `model: "fable"` literal, NOT the `overrides["research"] ?? "<literal>"` form — `research` is not one of
  the 6 injectable designated stages, so the `??`-research form FAILS the live M85 lint. The bare literal
  passes the lint's tier-set membership check. **`gsd-t-wave.workflow.js` gets NOTHING** — it is a pure
  execute+verify composer and the M85 lint asserts it has ZERO `model:` occurrences; the research behavior
  reaches a wave run transitively through its execute (D4) + verify (D3) sub-workflows. The M85 drift lint
  must stay green (incl. the wave-zero-`model:` + debug-cycle-ternary assertions).
- **DETECT via Stated-Claims (§6.5).** Embed the Stated-Claims snippet in execute/debug/quick; tag claims
  KNOWN | GUESSED(type); iterate `[GUESSED:*]` through the classifier. Preserve the existing debug-cycle
  ternary `model: cycle === 1 ? "opus" : (overrides["debug-cycle-2"] ?? "fable")` — the research stage is a
  SEPARATE `agent()` with its own bare `"fable"` literal; do NOT fold it into the cycle ternary.
- **§7 ENFORCE marker.** On `class:external`, WRITE the `status=uncited` marker at classify time, then FLIP
  to `status=cited` when the Verified-Facts block lands (same normalized-claim-key).
- **A3 — internal gap → research stage NOT entered.** An internal-classified gap routes to grep/Read only;
  the research `agent()` stage is NOT reached. Asserted on the ROUTING DECISION, not a literal WebSearch-call
  count (the sandbox exposes no per-stage `tools:` allowlist) + structurally: the research stage is the SOLE
  web-tool-granting `agent()`. Own the A3 assertion test.
- **Ambiguous → internal-first → grep → escalate (§5.1).** An ambiguous claim classified internal greps
  first; grep-empty → re-route external → marker → research + cite → flip. Ship the full escalation, do NOT
  defer.
- **Idempotent — exact claim-key.** Skip research ONLY on an exact normalized-claim-key already-cited marker
  (§4.1, NOT substring/keyword); a distinct-keyed claim still researches.
- **RUN, don't node --check.** Validate by running each of the four workflows to completion in the real sandbox.

## Gated Start
Do NOT begin until D1's A1 corpus test is GREEN (prove-or-kill).

## Test Standard
- `test/m89-worker-research-wiring.test.js`: assert execute/quick/debug each embed the Stated-Claims snippet
  + insert the classify→(external: marker-write→research+cite→marker-flip / internal: grep, with
  grep-empty→external escalation) trigger; assert `wave` carries NO research agent + NO `model:` (composer
  invariant). Source-parse is a CHEAP PRE-CHECK; the binding runtime proof is D4-T4 (real-sandbox state
  change).
- `test/m89-internal-gap-no-websearch.test.js` (A3): every labeled internal gap → `class:internal` → the
  research-stage branch is NOT taken (asserted on the ROUTING DECISION, not a WebSearch-call count) + the
  research stage is the SOLE web-tool-granting `agent()` (exactly one).
- Functional assertions, not existence checks.
