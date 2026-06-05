// templates/workflows/gsd-t-quick.workflow.js
//
// Runtime: Anthropic native Workflow tool only.
// Quick — small one-shot task with contract awareness.
// preflight + brief + agent(task) + verify-gate (light)
//
// args: { task, projectDir?, model? }

export const meta = {
  name: "gsd-t-quick",
  description: "Fast single-task execution with brief, preflight, and verify-gate",
  phases: [
    { title: "Preflight", detail: "preflight + brief" },
    { title: "Execute",   detail: "single-agent task" },
    { title: "Verify",    detail: "verify-gate" },
  ],
};

// M81: runtime-native helpers. The Anthropic Workflow sandbox provides ONLY the
// globals agent/parallel/pipeline/log/phase/budget/args — NO require/fs/path/
// child_process/process. The old `require("./_lib.js")` threw ReferenceError on first
// eval, so EVERY workflow except scan silently crashed and never ran (TD-113, confirmed
// by the NiceNote session 2026-06-05). These inline helpers delegate the CLI calls to an
// agent() that runs them via Bash (preferring project-local bin/<tool>.cjs, falling back
// to the global `gsd-t` PATH binary), parsing the JSON envelope — same brains, sandbox-safe
// invocation. The args global also arrives as a JSON STRING in this runtime, so parse it.
const _args = (typeof args === "string") ? (() => { try { return JSON.parse(args); } catch { return {}; } })() : (args || {});

const _CLI_ENVELOPE_SCHEMA = {
  type: "object", required: ["ok", "exitCode"], additionalProperties: true,
  properties: {
    ok: { type: "boolean" }, exitCode: { type: "integer" },
    envelope: {}, stdout: { type: "string" }, stderr: { type: "string" }, via: { type: "string" },
  },
};
// Run a `gsd-t <subcmd>` CLI (or project-local bin/<localBin>) via an agent's Bash and
// return { ok, exitCode, envelope, stderr, via }. parseJson=true parses stdout as the envelope.
async function runCli(projectDir, subcmd, argv, localBin, label, parseJson = true, phaseName) {
  const argStr = (argv || []).map((a) => `'${String(a).replace(/'/g, "'\\''")}'`).join(" ");
  const prompt = [
    `Run a GSD-T CLI command for the project at \`${projectDir}\` and report the result. Steps:`,
    `1. If \`${projectDir}/bin/${localBin}\` exists, run: \`node ${projectDir}/bin/${localBin} ${argStr}\` (set via="local").`,
    `   Otherwise run: \`gsd-t ${subcmd} ${argStr}\` (set via="global").`,
    `   Run it with cwd \`${projectDir}\` (use \`cd ${projectDir} && …\` or \`-C\`/\`--cwd\` as appropriate).`,
    `2. Capture the exit code (ok = exitCode 0) and stdout/stderr.`,
    parseJson
      ? `3. Parse stdout as JSON into \`envelope\` (null if not JSON). Return JSON per the schema.`
      : `3. Put stdout (trimmed, ≤4000 chars) in \`stdout\`. Return JSON per the schema.`,
    `Do NOT do any other work. ONLY run this one command and report.`,
  ].join("\n");
  const opts = { label, schema: _CLI_ENVELOPE_SCHEMA, model: "haiku" };
  if (phaseName) opts.phase = phaseName; // opts.phase MUST be a string, never the phase() fn
  const r = await agent(prompt, opts)
    .catch((e) => ({ ok: false, exitCode: -1, envelope: null, stderr: String(e && e.message), via: "error" }));
  return r || { ok: false, exitCode: -1, envelope: null, via: "error" };
}
async function runPreflight(projectDir, label = "preflight", phaseName) {
  return runCli(projectDir, "preflight", ["--json"], "cli-preflight.cjs", label, true, phaseName);
}
async function runVerifyGate(projectDir, label = "verify-gate", phaseName) {
  return runCli(projectDir, "verify-gate", ["--json"], "gsd-t-verify-gate.cjs", label, true, phaseName);
}
// Brief generation: writes .gsd-t/briefs/<id>.json and returns its path. The id must be
// caller-supplied (no Date.now/Math.random in the sandbox) — pass a stable id per spawn.
async function generateBrief(projectDir, { kind = "execute", milestone, domain, id, label = "brief", phaseName } = {}) {
  const argv = ["--kind", kind, "--spawn-id", id, "--out", `${projectDir}/.gsd-t/briefs/${id}.json`];
  if (milestone) argv.push("--milestone", milestone);
  if (domain) argv.push("--domain", domain);
  const r = await runCli(projectDir, "brief", argv, "gsd-t-context-brief.cjs", label, false, phaseName);
  return { ok: r.ok, briefPath: `${projectDir}/.gsd-t/briefs/${id}.json`, via: r.via };
}

const projectDir = _args.projectDir || ".";
const task = _args.task || null;
const model = _args.model || "sonnet";

const QUICK_SCHEMA = {
  type: "object",
  required: ["status", "filesEdited"],
  properties: {
    status:      { type: "string", enum: ["complete", "partial", "blocked", "failed"] },
    filesEdited: { type: "array", items: { type: "string" } },
    summary:     { type: "string" },
  },
};

if (!task) {
  log("quick: args.task required");
  return { status: "failed", reason: "no-task" };
}

phase("Preflight");
const pre = await runPreflight(projectDir);
if (!pre.ok) return { status: "failed", reason: "preflight-failed", preflight: pre.envelope };
const brief = await generateBrief(projectDir, { kind: "execute", id: "quick-brief" });

phase("Execute");
const result = await agent(
  [
    `Quick task: ${task}`,
    `**Brief:** ${brief.briefPath || "(no brief)"}`,
    ``,
    `Constraints from CLAUDE.md:`,
    `- SIMPLICITY ABOVE ALL — minimal change`,
    `- Check downstream effects before changing existing code`,
    `- Run affected tests before reporting done`,
    `- Update relevant docs in the same commit`,
    ``,
    `Commit with prefix "m61(quick)". Return JSON per the schema.`,
  ].join("\n"),
  { label: "quick", phase: "Execute", schema: QUICK_SCHEMA, model }
).catch((e) => ({ status: "failed", filesEdited: [], summary: `agent error: ${e && e.message}` }));

if (result.status === "failed" || result.status === "blocked") {
  return { status: result.status, result };
}

phase("Verify");
const vg = await runVerifyGate(projectDir);
return {
  status: vg.ok ? "complete" : "verify-failed",
  result,
  verifyGate: vg.envelope,
};
