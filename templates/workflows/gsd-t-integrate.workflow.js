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
// Broken-Graph-Halts (EXEMPT carve-out): integrate is additive/announced — it does not
// hard-fail on an unavailable graph. But it MUST DISTINGUISH absent from broken and name
// BROKEN loudly, never silently continue as if merely un-indexed.
// [RULE] one-availability-classifier [RULE] broken-graph-halts-never-greps (carve-out: name BROKEN loudly)
async function classifyGraphFailure(projectDir, reason, detail, phaseName) {
  const r = await runCli(
    projectDir, "graph-availability",
    ["classify", String(reason || ""), String(detail || "")],
    "gsd-t-graph-availability.cjs", "graph-classify", true, phaseName
  ).catch(() => null);
  const env = r && r.envelope;
  if (env && (env.state === "ABSENT" || env.state === "BROKEN")) return env.state;
  return "BROKEN";
}
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

// M99 D2: persist a kind:'wiring' ledger line for this workflow.
// Uses the `gsd-t graph wiring-log --auto` CLI shim (avoids embedding require() in strings).
// [RULE] wiring-mode-three-states / [RULE] consumer-label-from-context-not-setenv
async function persistWiringMode(phaseName) {
  const consumer = "integrate";
  await agent(
    [
      `Persist one graph-wiring-mode ledger line for the integrate workflow.`,
      `Run: \`gsd-t graph wiring-log --consumer ${consumer} --auto --project '${projectDir}'\``,
      `(--auto detects WIRED if the graph store exists, else fallback-announced)`,
      `If the command is not found, exit 0 (ledger write is optional).`,
      `Return ONLY: {"ok": true, "mode": "<mode>"} or {"ok": false, "reason": "<short reason>"}.`,
    ].join("\n"),
    { label: "integrate:wiring-ledger", phase: phaseName, model: "haiku", schema: { type: "object", required: ["ok"], properties: { ok: { type: "boolean" }, mode: { type: "string" }, reason: { type: "string" } } } }
  ).catch(() => null); // fail-open
}

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
// M99 D2: persist graphWiringMode for the integrate consumer. [RULE] wiring-mode-three-states
await persistWiringMode("Preflight");

// M94-D10-T6: Graph Structural Slice — who-imports + blast-radius (ADDITIVE, announced-degradation)
// [RULE] integrate-uses-graph-for-wiring-verification
// [RULE] verify-integrate-graph-additive-announced-not-hard-fail — bootstrap carve-out:
//   integrate degrades ANNOUNCED on graph-unavailable, does NOT hard-fail.
let _graphWhoImportsSlice = null;
let _graphBlastRadiusSlice = null;
let _graphIntegrateWarning = null;

{
  const wiResult = await runCli(
    projectDir, "graph who-imports", [], "gsd-t-graph-query-cli.cjs",
    "graph:who-imports", true, "Integrate"
  );
  const wiEnv = wiResult.envelope || {};
  if (wiEnv.ok === true) {
    _graphWhoImportsSlice = wiEnv;
    log(`M94 graph who-imports: ${(wiEnv.results || []).length} result(s) (tier: ${wiEnv.tier || "?"})`);
  } else if (wiEnv.ok === false) {
    // [RULE] one-availability-classifier — distinguish ABSENT (announced skip) from BROKEN (LOUD).
    const _state = await classifyGraphFailure(projectDir, wiEnv.reason, wiEnv.detail, "Integrate");
    if (_state === "BROKEN") {
      _graphIntegrateWarning = `⚠ graph BROKEN (reason=${wiEnv.reason || "?"}) — structural wiring-check skipped. This is NOT merely un-indexed; FIX it (gsd-t graph status).`;
    } else {
      _graphIntegrateWarning = "⚠ graph ABSENT (never indexed) — structural wiring-check skipped (announced carve-out; build with gsd-t graph index)";
    }
    log(`M94 graph who-imports: ${_graphIntegrateWarning}`);
  } else {
    _graphIntegrateWarning = `⚠ graph who-imports query unexpected envelope (reason: ${wiEnv.reason || "?"}); structural wiring-check skipped`;
    log(`M94 graph who-imports: ${_graphIntegrateWarning}`);
  }

  if (!_graphIntegrateWarning) {
    const brResult = await runCli(
      projectDir, "graph blast-radius", [], "gsd-t-graph-query-cli.cjs",
      "graph:blast-radius", true, "Integrate"
    );
    const brEnv = brResult.envelope || {};
    if (brEnv.ok === true) {
      _graphBlastRadiusSlice = brEnv;
      log(`M94 graph blast-radius: ${(brEnv.results || []).length} result(s)`);
    } else {
      log(`M94 graph blast-radius: query failed (reason: ${brEnv.reason || "?"}) — no blast-radius slice`);
    }
  }
}

phase("Integrate");
const integrate = await agent(
  [
    `You are the integration agent for milestone \`${milestone}\`. Domains complete: ${domains.join(", ")}.`,
    `**Brief:** ${brief.briefPath || "(no brief — re-walk repo)"}`,
    // M94-D10-T6: thread graph slice into the integrate agent (ADDITIVE)
    _graphIntegrateWarning
      ? `\n**Graph Structural Check:** ${_graphIntegrateWarning} (WARNING only — integrate continues cross-domain wire-up)`
      : (_graphWhoImportsSlice
        ? `\n**Graph Structural Slice (who-imports):** ${JSON.stringify(_graphWhoImportsSlice)}\n**Graph Structural Slice (blast-radius):** ${_graphBlastRadiusSlice ? JSON.stringify(_graphBlastRadiusSlice) : "N/A"}\nUse these pre-computed slices to verify cross-domain wiring — that real import/call edges exist across domain seams. Do NOT grep/read-to-reconstruct cross-domain edges; the graph slice above is authoritative.`
        : ""),
    ``,
    `Read .gsd-t/contracts/${milestone ? milestone.toLowerCase() : ""}-integration-points.md if present.`,
    `Resolve any shared-file edits sequenced at integrate (per "Cross-Domain File Contention Matrix").`,
    `Update cross-domain contracts as needed.`,
    `Commit cross-domain edits with a clear "m61(integrate)" prefix.`,
    ``,
    `Return JSON per the schema.`,
  ].filter(Boolean).join("\n"),
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
