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
  }
}
```

## Step 3: Interpret the result

The Workflow returns `{ status, artifacts, summary, decisions }`.

- `status === "complete"`: the element → widget → page contract tree is written under `.gsd-t/contracts/design/`.
- `status === "partial" | "blocked"`: the agent needs the design source (e.g. Figma auth) or a stack-capability decision. Surface it.
- `status === "failed"`: read `summary`.

## Document Ripple

The design agent writes the contract tree and a Decision Log entry.

## Next Up

`/gsd-t-design-build` — deterministic design-to-code pipeline. (`/gsd-t-partition` first if domains are needed before building.)
