# GSD-T: Design Decompose — Hierarchical Contract Extraction

You are the lead agent. Decompose a design (Figma file, image, screenshot, or prototype URL) into a hierarchy of element / widget / page contracts by invoking the generic upper-stage Workflow at `templates/workflows/gsd-t-phase.workflow.js` with `phase: "design-decompose"`.

**Output**: A tree of contracts under `.gsd-t/contracts/design/` — elements at the bottom (atomic, reusable, variant-per-contract), widgets in the middle (element composition + data binding), pages at the top (widget assembly + layout + routing). Widgets are component *types*, not instances; sections live in the page layout, not separate contracts.

## What this command does

```
preflight → brief (kind=design-decompose) → design agent (opus, with phase protocol)
```

## Step 1: Load context

Capture the design reference from `$ARGUMENTS` (Figma URL / image path). If Figma MCP is configured, the agent uses it to extract tokens. Read any existing `.gsd-t/contracts/design/` to avoid duplication.

## Step 2: Invoke the phase Workflow

```js
{
  // Resolve the ABSOLUTE path FIRST via Bash: `gsd-t workflow-path phase` (the
  // workflow ships in the installed @tekyzinc/gsd-t package, not this project — a
  // bare relative path only resolves from the GSD-T source repo). Use its stdout here:
  scriptPath: "<absolute path printed by `gsd-t workflow-path phase`>",
  args: {
    phase: "design-decompose",
    projectDir: ".",
    userInput: "$ARGUMENTS"
    // M84 Competition Mode is AUTOMATIC — do NOT pass `competition` by default.
    // The workflow probes (opus) and self-decides; it competes when a design is
    // ambiguous or the element/widget/page boundaries aren't obvious (a blind,
    // different-model rubric judge picks the winner). Override only on explicit
    // request: `--no-competition` → 0, `--competition N` (2-5) → N.
  }
}
```

**Competition Mode (`--competition N`).** When a design is ambiguous or the element/widget/page boundaries aren't obvious, `/gsd-t-design-decompose --competition 3` fans out N candidate decompositions and a blind, different-model rubric judge picks the best. Parse N (clamped 2..5). See `.gsd-t/contracts/competition-mode-contract.md`. Default off.

## Step 3: Interpret the result

The Workflow returns `{ status, artifacts, summary, decisions }` (plus `competition: { n, winner, ranked }` when Competition Mode ran).

- `status === "complete"`: the element → widget → page contract tree is written under `.gsd-t/contracts/design/`.
- `status === "partial" | "blocked"`: the agent needs the design source (e.g. Figma auth) or a stack-capability decision. Surface it.
- `status === "failed"`: read `summary`.

## Document Ripple

The design agent writes the contract tree and a Decision Log entry.

## Next Up

`/gsd-t-design-build` — deterministic design-to-code pipeline. (`/gsd-t-partition` first if domains are needed before building.)
