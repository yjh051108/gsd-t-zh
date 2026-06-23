# Domain Constraints: m90-d-arch-trigger-response

## The R1 prove-or-kill exit (NON-NEGOTIABLE)
This is the HIGHEST-RISK slice — there is no published precedent for "detect an agent
operating on an unproven architectural premise." The killing test asserts the trigger
**fires deterministically on divergent fresh-context answers and stays silent on
convergent ones**. If it CANNOT fire deterministically, **HALT for re-scope DOWN to
factual-only** per the M90 R1 exit (the doctrine applied to itself — failing here is cheap,
a single domain, not a 7-cycle execute loop). Do NOT plow forward on a noisy trigger.

## Traced requirements
- **R-ARCH-1** — consistency-divergence sampling over N fresh-context answers (EXPERIMENTAL+MEASURED).
- **R-ARCH-2** — protocol-class trigger fires on extending existing code too, not only greenfield.
- **R-ARCH-3** — blind-adversary directive runs in a SEPARATE context/model (extends M83 pre-mortem + Red-Team-on-fable). Interface only; wiring is D-CONTRACT.
- **R-ARCH-4** — executable spike PREFERRED; spike fails → STOP (do not proceed on the unproven approach).
- **R-ARCH-5** — spike infeasible → logged skip + adversary MANDATORY (never silently skip both).
- **R-ARCH-6** — premise proven-by-adversary-only → flagged at verify (surfaced state D-CONTRACT reads).

## Hard rules (inherit repo invariants)
- **Zero new runtime deps** — Node built-ins only; sync file APIs; ANSI via escape codes.
- **House-style JSON envelope** — `{ ok:true, ... }` on success, `{ ok:false, error }` on bad input; never throw on string/structured input; non-zero CLI exit on error.
- **Deterministic** — identical input → byte-identical envelope. The trigger's DECISION must be a computed fact, never the agent's prose label.
- **NEVER claim it works** — instrument fire-rate + catch-quality to a measurement sink; the module emits data, not a verdict that it is reliable.
- **Runtime-native (M81/TD-113)** — this is a `bin/*.cjs` brain, invoked by workflows via an `agent()`-Bash inline helper. It must NOT be `require()`d inside any `*.workflow.js`. Do NOT touch workflow files (that is the D-CONTRACT integrate seam).
- **Model-tier policy (M85)** — any new stage the response interface implies must have its tier declared in `bin/gsd-t-model-tier-policy.cjs`. Adding the tier entry is a D-CONTRACT edit; this domain only NAMES the required model (`fable` for the blind adversary, per Red-Team-on-fable precedent) in the protocol prompt + contract interface notes.

## Self-obedience (R-SELF-1)
This domain MUST obey the doctrine it builds: do not assume the trigger mechanism is sound —
the killing test is the proof. If divergence sampling is itself an unproven approach,
the R1 exit fires.

## File discipline
Touch ONLY the files in scope.md § Files Owned. Any edit to a workflow, `bin/gsd-t.js`,
a triad prompt, or a contract is a DISJOINTNESS VIOLATION (those are D-CONTRACT's).
