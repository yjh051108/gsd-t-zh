// templates/workflows/gsd-t-integrate.workflow.js
//
// Runtime: Anthropic native Workflow tool only.
// Integrate phase — runs after parallel domains have committed their work.
// Cross-domain wire-up + lightweight verify-gate sanity check.
//
// args: { milestone, domains: [...], projectDir? }

export const meta = {
  name: "gsd-t-integrate",
  description: "Cross-domain integration after parallel workers complete",
  phases: [
    { title: "Preflight",   detail: "preflight + brief" },
    { title: "Integrate",   detail: "cross-domain wire-up" },
    { title: "Verify-Gate", detail: "quick verify-gate" },
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
async function runCli(projectDir, subcmd, argv, localBin, label, parseJson = true, phaseName) {
  const argStr = (argv || []).map((a) => `'${String(a).replace(/'/g, "'\\''")}'`).join(" ");
  const prompt = [
    `Run a GSD-T CLI command for the project at \`${projectDir}\` and report the result. Steps:`,
    `1. If \`${projectDir}/bin/${localBin}\` exists, run: \`node ${projectDir}/bin/${localBin} ${argStr}\` (set via="local"). Otherwise run: \`gsd-t ${subcmd} ${argStr}\` (set via="global"). Use cwd \`${projectDir}\`.`,
    `2. Capture exit code (ok = exitCode 0) and stdout/stderr.`,
    parseJson ? `3. Parse stdout as JSON into \`envelope\` (null if not JSON). Return JSON per the schema.` : `3. Put stdout (trimmed, ≤4000 chars) in \`stdout\`. Return JSON per the schema.`,
    `Do NOT do any other work. ONLY run this one command and report.`,
  ].join("\n");
  const opts = { label, schema: _CLI_ENVELOPE_SCHEMA, model: "haiku" };
  if (phaseName) opts.phase = phaseName;
  const r = await agent(prompt, opts).catch((e) => ({ ok: false, exitCode: -1, envelope: null, stderr: String(e && e.message), via: "error" }));
  return r || { ok: false, exitCode: -1, envelope: null, via: "error" };
}
async function runPreflight(projectDir, label = "preflight", phaseName) { return runCli(projectDir, "preflight", ["--json"], "cli-preflight.cjs", label, true, phaseName); }
async function runVerifyGate(projectDir, label = "verify-gate", phaseName) { return runCli(projectDir, "verify-gate", ["--json"], "gsd-t-verify-gate.cjs", label, true, phaseName); }
async function generateBrief(projectDir, { kind = "execute", milestone, domain, id, label = "brief", phaseName } = {}) {
  const argv = ["--kind", kind, "--spawn-id", id, "--out", `${projectDir}/.gsd-t/briefs/${id}.json`];
  if (milestone) argv.push("--milestone", milestone);
  if (domain) argv.push("--domain", domain);
  const r = await runCli(projectDir, "brief", argv, "gsd-t-context-brief.cjs", label, false, phaseName);
  return { ok: r.ok, briefPath: `${projectDir}/.gsd-t/briefs/${id}.json`, via: r.via };
}

const projectDir = _args.projectDir || ".";
const milestone  = _args.milestone || null;
const domains    = _args.domains || [];

const INTEGRATE_SCHEMA = {
  type: "object",
  required: ["status", "crossDomainEdits"],
  properties: {
    status:           { type: "string", enum: ["green", "warnings", "failed"] },
    crossDomainEdits: { type: "array", items: { type: "string" } },
    notes:            { type: "string" },
  },
};

if (!milestone || !domains.length) {
  log("integrate: args.milestone and args.domains required");
  return { status: "failed", reason: "missing-args" };
}

phase("Preflight");
const pre = await runPreflight(projectDir);
if (!pre.ok) return { status: "failed", reason: "preflight-failed", preflight: pre.envelope };
const brief = await generateBrief(projectDir, { kind: "execute", milestone, id: `integrate-${(milestone || "m").toLowerCase()}` });

phase("Integrate");
const integrate = await agent(
  [
    `You are the integration agent for milestone \`${milestone}\`. Domains complete: ${domains.join(", ")}.`,
    `**Brief:** ${brief.briefPath || "(no brief — re-walk repo)"}`,
    ``,
    `Read .gsd-t/contracts/${milestone ? milestone.toLowerCase() : ""}-integration-points.md if present.`,
    `Resolve any shared-file edits sequenced at integrate (per "Cross-Domain File Contention Matrix").`,
    `Update cross-domain contracts as needed.`,
    `Commit cross-domain edits with a clear "m61(integrate)" prefix.`,
    ``,
    `Return JSON per the schema.`,
  ].join("\n"),
  { label: "integrate", phase: "Integrate", schema: INTEGRATE_SCHEMA, model: "sonnet" }
).catch((e) => ({ status: "failed", crossDomainEdits: [], notes: `agent error: ${e && e.message}` }));

if (integrate.status === "failed") {
  return { status: "failed", reason: "integrate-failed", integrate };
}

phase("Verify-Gate");
const vg = await runVerifyGate(projectDir);
return {
  status: vg.ok ? "complete" : "verify-failed",
  integrate,
  verifyGate: vg.envelope,
};
