// templates/workflows/gsd-t-execute.workflow.js
//
// IMPORTANT: this file is NOT executable via `node` directly. It is a script
// body for the Anthropic native Workflow tool, which wraps the body in an
// async runtime and exposes globals: agent(), parallel(), pipeline(), log(),
// phase(), budget, args. Top-level await + return are runtime-legal in that
// context. To run: invoke the Workflow tool with {script: this file contents,
// args: {milestone, domains, projectDir?}}.
//
// Canonical native-Workflow implementation of the GSD-T execute phase.
// Replaces the orchestrator/worker/parallel/spawn-plan scaffolding with a
// single deterministic Workflow script. KEEPS the brains: preflight,
// context-brief, file-disjointness, verify-gate — all invoked from inside
// stages via templates/workflows/_lib.js helpers.
//
// Invocation contract:
//   The Workflow tool reads this file's `meta` block and runs the script
//   body. `args` is the JSON object passed in via Workflow({args}). Expected
//   shape:
//     {
//       milestone: "M61",
//       domains:   ["m61-d6-migrate-orchestration-to-workflow", ...],
//       projectDir: ".",    // optional
//     }

export const meta = {
  name: "gsd-t-execute",
  description:
    "Run a GSD-T execute phase: preflight → brief → parallel domain workers → integrate barrier → verify-gate",
  phases: [
    { title: "Preflight",    detail: "gsd-t preflight + brief generation" },
    { title: "Disjointness", detail: "prove tasks are file-disjoint" },
    { title: "Domains",      detail: "parallel domain workers" },
    { title: "Integrate",    detail: "cross-domain wire-up" },
    { title: "Verify-Gate",  detail: "two-track verify-gate" },
  ],
};

// ───── Shared schemas (re-used across stages) ───────────────────────────────

const DOMAIN_RESULT_SCHEMA = {
  type: "object",
  required: ["domain", "status", "filesTouched"],
  additionalProperties: false,
  properties: {
    domain:       { type: "string" },
    status:       { type: "string", enum: ["complete", "partial", "blocked", "failed"] },
    filesTouched: { type: "array", items: { type: "string" } },
    tasksDone:    { type: "array", items: { type: "string" } },
    tasksBlocked: { type: "array", items: { type: "string" } },
    notes:        { type: "string" },
  },
};

const INTEGRATE_RESULT_SCHEMA = {
  type: "object",
  required: ["status", "crossDomainEdits"],
  additionalProperties: false,
  properties: {
    status:           { type: "string", enum: ["green", "warnings", "failed"] },
    crossDomainEdits: { type: "array", items: { type: "string" } },
    notes:            { type: "string" },
  },
};

// ───── Script body ──────────────────────────────────────────────────────────

// M81: runtime-native helpers (sandbox bans require/fs/path/child_process/process — the
// old require("./_lib.js")+require("path") crashed this on first eval, TD-113). CLI calls
// delegate to an agent's Bash; file reads (scope.md/tasks.md) move INTO the worker agent
// (it has Read). args arrives as a JSON STRING in this runtime. See gsd-t-scan.workflow.js.
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
async function proveFileDisjointness(projectDir, domains, label = "disjointness", phaseName) {
  const argv = ["--dry-run"];
  for (const d of (domains || [])) { argv.push("--domain", d); }
  return runCli(projectDir, "parallel", argv, "gsd-t-parallel.cjs", label, false, phaseName);
}
async function generateBrief(projectDir, { kind = "execute", milestone, domain, id, label = "brief", phaseName } = {}) {
  const argv = ["--kind", kind, "--spawn-id", id, "--out", `${projectDir}/.gsd-t/briefs/${id}.json`];
  if (milestone) argv.push("--milestone", milestone);
  if (domain) argv.push("--domain", domain);
  const r = await runCli(projectDir, "brief", argv, "gsd-t-context-brief.cjs", label, false, phaseName);
  return { ok: r.ok, briefPath: `${projectDir}/.gsd-t/briefs/${id}.json`, via: r.via };
}

const projectDir = _args.projectDir || ".";
const milestone  = _args.milestone || null;
const domains    = (Array.isArray(_args.domains) && _args.domains) || [];

if (!milestone) {
  log("execute: no milestone provided — args.milestone is required");
  return { status: "failed", reason: "missing-milestone" };
}
if (!domains.length) {
  log("execute: no domains — args.domains is required (non-empty list)");
  return { status: "failed", reason: "no-domains" };
}

phase("Preflight");
log(`execute: milestone=${milestone}, domains=${domains.length}`);
const pre = await runPreflight(projectDir);
if (!pre.ok) {
  log(`preflight FAIL — exitCode=${pre.exitCode}: ${pre.stderr || "(no stderr)"}`);
  return { status: "failed", reason: "preflight-failed", preflight: pre.envelope };
}
log(`preflight OK`);

phase("Disjointness");
// 4.8-audit fix: scope disjointness to the requested domain set, not the whole project.
// Without this, an unrelated DRAFT domain elsewhere in the project could flip the result.
const disj = await proveFileDisjointness(projectDir, domains);
if (!disj.ok) {
  log(`disjointness FAIL — exitCode=${disj.exitCode}: ${disj.stderr || disj.stdout}`);
  return { status: "failed", reason: "non-disjoint" };
}
log(`disjointness OK`);

phase("Domains");
const domainResults = await parallel(
  domains.map((domain) => async () => {
    // 4.8-audit fix: per-domain brief (M55-D2 brief-per-spawn semantic) — each worker
    // gets a brief scoped to its own domain so grep-the-brief is most effective.
    // M81: generated via an awaited agent (sandbox-safe); the worker reads its own
    // scope.md/tasks.md (it has Read) instead of the orchestrator pre-reading via fs.
    const domBrief = await generateBrief(projectDir, { kind: "execute", milestone, domain, id: `execute-${(milestone || "m").toLowerCase()}-${domain}`, phaseName: "Domains", label: `brief:${domain}` });
    const briefRef = domBrief.ok ? domBrief.briefPath : "(brief generation failed — re-walk repo)";
    const scopePath = `${projectDir}/.gsd-t/domains/${domain}/scope.md`;
    const tasksPath = `${projectDir}/.gsd-t/domains/${domain}/tasks.md`;
    const prompt = [
      `You are the worker agent for the GSD-T domain \`${domain}\` in milestone \`${milestone}\`.`,
      ``,
      `FIRST, read these two files in full (do NOT skip or truncate them):`,
      `- Scope (your owned files): \`${scopePath}\``,
      `- Tasks: \`${tasksPath}\``,
      ``,
      `Your job: execute every task listed under "## Tasks" in tasks.md, respecting the file ownership in scope.md.`,
      ``,
      `**Brief (REQUIRED READ):** ${briefRef} — if present, grep this JSON first instead of re-reading CLAUDE.md and contracts.`,
      ``,
      `Constraints:`,
      `- Touch only files in your scope's "Owned Files" list.`,
      `- Make commits via bash/git tools FIRST as you complete each task or task group, THEN emit the final StructuredOutput JSON describing what you did. Do not skip commits to satisfy the schema faster.`,
      `- Update affected docs (progress.md Decision Log, architecture.md, contracts/, requirements.md, README.md) per the Document Ripple Completion Gate in CLAUDE.md — in the SAME commits as the code changes.`,
      `- If a task is blocked (dependency not met), record it in tasksBlocked and continue with the next.`,
      `- Return a JSON object matching the StructuredOutput schema. The "status" field is the OVERALL domain status: "complete" if all tasks done, "partial" if some done and some blocked, "blocked" if you couldn't start, "failed" on error.`,
    ].join("\n");

    try {
      return await agent(prompt, {
        label: `worker:${domain}`,
        phase: "Domains",
        model: "sonnet",  // 4.8-audit fix: explicit per Model Display contract
        schema: DOMAIN_RESULT_SCHEMA,
      });
    } catch (e) {
      return {
        domain,
        status: "failed",
        filesTouched: [],
        notes: `agent error: ${e && e.message}`,
      };
    }
  })
);

const blocking = domainResults.filter(Boolean).filter((r) => r.status === "failed");
if (blocking.length) {
  log(`${blocking.length} domain(s) failed — halting before integrate`);
  return { status: "failed", reason: "domain-failed", domainResults };
}

phase("Integrate");
const integratePrompt = [
  `You are the integration agent. ${domainResults.length} domain workers have completed.`,
  ``,
  `Domain results:`,
  "```json",
  JSON.stringify(domainResults, null, 2),
  "```",
  ``,
  `Your job: perform any cross-domain wire-up needed (e.g. resolving shared-file edits sequenced at integrate, updating cross-domain contracts, running interleaved-touch resolution). DO NOT re-do work the domain workers already did. Make commits for the cross-domain edits only.`,
  ``,
  `Return a JSON object per the StructuredOutput schema. status="green" if all wiring landed cleanly, "warnings" if there are non-blocking issues, "failed" if cross-domain integration cannot complete.`,
].join("\n");

const integrate = await agent(integratePrompt, {
  label: "integrate",
  phase: "Integrate",
  schema: INTEGRATE_RESULT_SCHEMA,
}).catch((e) => ({
  status: "failed",
  crossDomainEdits: [],
  notes: `integrate agent error: ${e && e.message}`,
}));

if (integrate.status === "failed") {
  log("integrate FAILED — halting before verify-gate");
  return { status: "failed", reason: "integrate-failed", domainResults, integrate };
}

phase("Verify-Gate");
const vg = await runVerifyGate(projectDir);
log(`verify-gate exitCode=${vg.exitCode} ok=${vg.ok}`);

return {
  status: vg.ok ? "complete" : "verify-failed",
  milestone,
  domainResults,
  integrate,
  verifyGate: vg.envelope,
};
