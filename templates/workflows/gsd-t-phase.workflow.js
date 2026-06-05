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

// M81: runtime-native helpers (sandbox bans require/fs/child_process/process — the old
// require("./_lib.js") crashed this workflow on first eval, TD-113). Delegate CLI calls
// to an agent's Bash; args arrives as a JSON STRING in this runtime. See gsd-t-scan.workflow.js.
const _args = (typeof args === "string") ? (() => { try { return JSON.parse(args); } catch { return {}; } })() : (args || {});
const _CLI_ENVELOPE_SCHEMA = {
  type: "object", required: ["ok", "exitCode"], additionalProperties: true,
  properties: { ok: { type: "boolean" }, exitCode: { type: "integer" }, envelope: {}, stdout: { type: "string" }, stderr: { type: "string" }, via: { type: "string" } },
};
async function runCli(projectDir, subcmd, argv, localBin, label, parseJson = true, phaseNameOpt) {
  const argStr = (argv || []).map((a) => `'${String(a).replace(/'/g, "'\\''")}'`).join(" ");
  const prompt = [
    `Run a GSD-T CLI command for the project at \`${projectDir}\` and report the result. Steps:`,
    `1. If \`${projectDir}/bin/${localBin}\` exists, run: \`node ${projectDir}/bin/${localBin} ${argStr}\` (set via="local"). Otherwise run: \`gsd-t ${subcmd} ${argStr}\` (set via="global"). Use cwd \`${projectDir}\`.`,
    `2. Capture exit code (ok = exitCode 0) and stdout/stderr.`,
    parseJson ? `3. Parse stdout as JSON into \`envelope\` (null if not JSON). Return JSON per the schema.` : `3. Put stdout (trimmed, ≤4000 chars) in \`stdout\`. Return JSON per the schema.`,
    `Do NOT do any other work. ONLY run this one command and report.`,
  ].join("\n");
  const opts = { label, schema: _CLI_ENVELOPE_SCHEMA, model: "haiku" };
  if (phaseNameOpt) opts.phase = phaseNameOpt;
  const r = await agent(prompt, opts).catch((e) => ({ ok: false, exitCode: -1, envelope: null, stderr: String(e && e.message), via: "error" }));
  return r || { ok: false, exitCode: -1, envelope: null, via: "error" };
}
async function runPreflight(projectDir, label = "preflight", phaseNameOpt) { return runCli(projectDir, "preflight", ["--json"], "cli-preflight.cjs", label, true, phaseNameOpt); }
async function generateBrief(projectDir, { kind = "execute", milestone, domain, id, label = "brief", phaseNameOpt } = {}) {
  const argv = ["--kind", kind, "--spawn-id", id, "--out", `${projectDir}/.gsd-t/briefs/${id}.json`];
  if (milestone) argv.push("--milestone", milestone);
  if (domain) argv.push("--domain", domain);
  const r = await runCli(projectDir, "brief", argv, "gsd-t-context-brief.cjs", label, false, phaseNameOpt);
  return { ok: r.ok, briefPath: `${projectDir}/.gsd-t/briefs/${id}.json`, via: r.via };
}

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

const projectDir = _args.projectDir || ".";
const milestone  = _args.milestone || null;
const userInput  = _args.userInput || "";
const phaseName  = _args.phase;

if (!phaseName || !VALID_PHASES.includes(phaseName)) {
  log(`phase: args.phase must be one of: ${VALID_PHASES.join(", ")}`);
  return { status: "failed", reason: "invalid-phase" };
}

phase("Preflight");
const pre = await runPreflight(projectDir);
if (!pre.ok) return { status: "failed", reason: "preflight-failed", preflight: pre.envelope };
const brief = await generateBrief(projectDir, { kind: phaseName, milestone, id: `${phaseName}-${(milestone || "m").toLowerCase()}` });

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
