# GSD-T: Design Decompose — Hierarchical Contract Extraction

You are the lead agent. Decompose a design (Figma file, image, screenshot, or prototype URL) into a hierarchy of element / widget / page contracts by invoking the generic upper-stage Workflow at `templates/workflows/gsd-t-phase.workflow.js` with `phase: "design-decompose"`.

**Output**: A tree of contracts under `.gsd-t/contracts/design/` — elements at the bottom (atomic, reusable, variant-per-contract), widgets in the middle (element composition + data binding), pages at the top (widget assembly + layout + routing). Widgets are component *types*, not instances; sections live in the page layout, not separate contracts.

## What this command does

```
preflight → brief (kind=design-decompose) → design agent (opus, with phase protocol)
```

## Step 1: Load context

Capture the design reference from `$ARGUMENTS` (Figma URL / image path). If Figma MCP is configured, the agent uses it to extract tokens. Read any existing `.gsd-t/contracts/design/` to avoid duplication.

## Step 2: Resolve the active model profile (M86 — invoke-time injection)

Before calling the Workflow, resolve the active model profile to build the `overrides` map:

```bash
# Run via Bash at invoke time:
gsd-t model-profile resolve --profile <active-profile> --json
# <active-profile> = read from .gsd-t/model-profile.json "profile" field, or default "premium"
```

**Resolver-failure handling (M86 — pre-mortem c2 #2):** if the resolve call fails, do NOT
silently proceed on the premium fallback. Either HALT with `blocked-needs-human`, or proceed
ONLY with a loud, surfaced warning:
```
⚠ model-profile resolver unavailable — running on PREMIUM fallback literals
  (configured profile unknown; stale global binary may lack model-profile subcommand)
```

Also surface a SUCCESSFUL resolve that carries a `configError` field (the resolver returns a
named default + `configError` for malformed/hand-edited configs — Red Team M86): print the
`configError` as a visible warning naming the effective profile before proceeding. A clean-looking
run on a posture the user did not configure is the same silent-spend failure class.

## Step 3: Invoke the phase Workflow

```js
{
  // Resolve the ABSOLUTE path FIRST via Bash: `gsd-t workflow-path phase` (the
  // workflow ships in the installed @tekyzinc/gsd-t package, not this project — a
  // bare relative path only resolves from the GSD-T source repo). Use its stdout here:
  scriptPath: "<absolute path printed by `gsd-t workflow-path phase`>",
  args: {
    phase: "design-decompose",
    projectDir: ".",
    userInput: "$ARGUMENTS",
    // M86: inject the resolved overrides map (probe + judge use this).
    // Pass {} when the resolver failed AND you chose the loud-warning path (not halt).
    overrides: { /* ...from resolver result.overrides, or {} on failure */ }
    // M84 Competition Mode is AUTOMATIC — do NOT pass `competition` by default.
    // The workflow probes (opus) and self-decides; it competes when a design is
    // ambiguous or the element/widget/page boundaries aren't obvious (a blind,
    // different-model rubric judge picks the winner). Override only on explicit
    // request: `--no-competition` → 0, `--competition N` (2-5) → N.
  }
}
```

**Competition Mode (`--competition N`).** When a design is ambiguous or the element/widget/page boundaries aren't obvious, `/gsd-t-design-decompose --competition 3` fans out N candidate decompositions and a blind, different-model rubric judge picks the best. Parse N (clamped 2..5). See `.gsd-t/contracts/competition-mode-contract.md`. Default off.

## Step 4: Interpret the result

The Workflow returns `{ status, artifacts, summary, decisions }` (plus `competition: { n, winner, ranked }` when Competition Mode ran).

- `status === "complete"`: the element → widget → page contract tree is written under `.gsd-t/contracts/design/`.
- `status === "partial" | "blocked"`: the agent needs the design source (e.g. Figma auth) or a stack-capability decision. Surface it.
- `status === "failed"`: read `summary`.

## Document Ripple

The design agent writes the contract tree and a Decision Log entry.

## Next Up

`/gsd-t-design-build` — deterministic design-to-code pipeline. (`/gsd-t-partition` first if domains are needed before building.)
