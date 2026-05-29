// templates/workflows/gsd-t-phase.workflow.js
//
// Runtime: Anthropic native Workflow tool only.
// Generic upper-stage phase runner — covers partition, plan, discuss, impact,
// milestone, prd, design-decompose, doc-ripple.
//
// Each upper-stage phase is essentially: load brief -> primary agent (with phase-
// specific protocol) -> optional validation -> commit artifacts. Wrapping each
// in its own Workflow script is overengineering; this generic runner takes the
// phase name as an arg and threads the right brief kind + acceptance schema.
//
// args: {
//   phase: "partition" | "plan" | "discuss" | "impact" | "milestone"
//          | "prd" | "design-decompose" | "doc-ripple",
//   milestone?: "M61",
//   projectDir?: ".",
//   userInput?: string,   // arbitrary input to the phase (e.g. "$ARGUMENTS")
// }

export const meta = {
  name: "gsd-t-phase",
  description: "Generic upper-stage phase runner (partition/plan/discuss/etc.)",
  phases: [
    { title: "Preflight", detail: "preflight + brief" },
    { title: "Phase",     detail: "primary agent with phase-specific protocol" },
  ],
};

const lib = require("./_lib.js");

const VALID_PHASES = [
  "partition", "plan", "discuss", "impact",
  "milestone", "prd", "design-decompose", "doc-ripple",
];

const PHASE_RESULT_SCHEMA = {
  type: "object",
  required: ["status", "artifacts"],
  additionalProperties: false,
  properties: {
    status:    { type: "string", enum: ["complete", "partial", "blocked", "failed"] },
    artifacts: { type: "array", items: { type: "string" } },
    summary:   { type: "string" },
    decisions: { type: "array", items: { type: "string" } },
  },
};

const projectDir = (args && args.projectDir) || ".";
const milestone  = (args && args.milestone)  || null;
const userInput  = (args && args.userInput)  || "";
const phaseName  = args && args.phase;

if (!phaseName || !VALID_PHASES.includes(phaseName)) {
  log(`phase: args.phase must be one of: ${VALID_PHASES.join(", ")}`);
  return { status: "failed", reason: "invalid-phase" };
}

phase("Preflight");
const pre = lib.runPreflight({ projectDir });
if (!pre.ok) return { status: "failed", reason: "preflight-failed", preflight: pre.envelope };
const brief = lib.generateBrief({ kind: phaseName, milestone, projectDir });

phase("Phase");
const promptByPhase = {
  partition: `Decompose the milestone into 2-5 independent domains. Write .gsd-t/domains/{domain}/{scope,constraints,tasks}.md. Cross-domain contracts in .gsd-t/contracts/.`,
  plan: `For each domain, write atomic tasks.md entries with files, contract refs, dependencies, acceptance criteria. Update .gsd-t/contracts/integration-points.md with wave groupings.`,
  discuss: `Multi-perspective exploration of design questions. Settle locked decisions into .gsd-t/CONTEXT.md. Do NOT implement.`,
  impact: `Analyze downstream effects of proposed changes. Identify breaking changes, affected consumers, migration paths.`,
  milestone: `Define a new milestone — origin, goal, success criteria, falsifiable acceptance. Append to .gsd-t/progress.md. Defer partition/plan.`,
  prd: `Generate a product requirements doc at docs/prd.md. Functional + non-functional requirements traceable to acceptance criteria.`,
  "design-decompose": `Decompose a design reference (Figma URL / images) into hierarchical contracts: elements -> widgets -> pages, each at .gsd-t/contracts/design/.`,
  "doc-ripple": `Identify and update all docs affected by recent code changes per the Document Ripple Completion Gate. No code edits.`,
};

const result = await agent(
  [
    `You are the ${phaseName} phase agent.`,
    milestone ? `Milestone: ${milestone}` : "",
    `**Brief (REQUIRED):** ${brief.briefPath || "(no brief — re-walk repo)"}`,
    userInput ? `\nUser input:\n${userInput}` : "",
    ``,
    `Objective: ${promptByPhase[phaseName]}`,
    ``,
    `Follow the CLAUDE.md Pre-Commit Gate. Commit artifacts with prefix "m61(${phaseName})" or similar.`,
    `Return JSON per the schema.`,
  ].filter(Boolean).join("\n"),
  { label: phaseName, phase: "Phase", schema: PHASE_RESULT_SCHEMA, model: "opus" }
).catch((e) => ({
  status: "failed",
  artifacts: [],
  summary: `agent error: ${e && e.message}`,
}));

return result;
