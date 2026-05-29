// templates/workflows/_lib.js
// Shared helpers for GSD-T Workflow scripts. CommonJS, zero deps.
//
// Workflow scripts call these helpers from inside agent()/parallel()/pipeline()
// stages so the brains (file-disjointness prover, brief generator, preflight,
// verify-gate) stay invocable while the orchestration shell becomes a Workflow.

"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

// 4.8-audit fix: prefer project-local bin/<tool>.cjs when present, fall back to
// global `gsd-t` PATH binary. Preserves M55-D5 project-local-bin invariant: a
// detached/sandboxed Workflow worker no longer requires `gsd-t` on PATH.
//
// Returns { cmd, args, source: "local" | "global" }.
function _resolveTool(projectDir, subcommand, subcommandArgs, localBinName) {
  if (localBinName) {
    const local = path.join(projectDir, "bin", localBinName);
    if (fs.existsSync(local)) {
      return {
        cmd: process.execPath,
        args: [local, ...subcommandArgs],
        source: "local",
      };
    }
  }
  return { cmd: "gsd-t", args: [subcommand, ...subcommandArgs], source: "global" };
}

function readBrief(briefPath) {
  if (!briefPath || !fs.existsSync(briefPath)) {
    return { _missing: true, briefPath: briefPath || null };
  }
  try {
    return JSON.parse(fs.readFileSync(briefPath, "utf8"));
  } catch (e) {
    return { _missing: true, error: String(e && e.message) };
  }
}

function generateBrief({ kind, milestone, domain, task, spawnId, projectDir = "." } = {}) {
  const id =
    spawnId ||
    `${kind || "generic"}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const outDir = path.join(projectDir, ".gsd-t", "briefs");
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `${id}.json`);
  const args = [
    "brief",
    "--kind",
    kind || "execute",
    "--spawn-id",
    id,
    "--out",
    out,
  ];
  if (milestone) args.push("--milestone", milestone);
  if (domain) args.push("--domain", domain);
  if (task) args.push("--task", task);
  const t = _resolveTool(projectDir, "brief", args, "gsd-t-context-brief.cjs");
  const r = spawnSync(t.cmd, t.args, { cwd: projectDir, stdio: "pipe" });
  if (r.status !== 0) {
    return {
      ok: false,
      briefPath: out,
      stderr: r.stderr && r.stderr.toString(),
      spawnError: r.error ? String(r.error.message) : null,
      via: t.source,
    };
  }
  return { ok: true, briefPath: out, via: t.source };
}

function runPreflight({ projectDir = ".", checks } = {}) {
  const subArgs = ["--json"];
  if (Array.isArray(checks) && checks.length) subArgs.push("--checks", checks.join(","));
  const t = _resolveTool(projectDir, "preflight", subArgs, "cli-preflight.cjs");
  const r = spawnSync(t.cmd, t.args, { cwd: projectDir, stdio: "pipe" });
  const stdout = r.stdout ? r.stdout.toString() : "";
  let envelope = null;
  try {
    envelope = stdout ? JSON.parse(stdout) : null;
  } catch (_) {
    envelope = null;
  }
  return {
    ok: r.status === 0,
    exitCode: r.status,
    envelope,
    stderr: r.stderr && r.stderr.toString(),
    spawnError: r.error ? String(r.error.message) : null,
    via: t.source,
  };
}

function proveFileDisjointness({ projectDir = ".", domains, taskIds } = {}) {
  // Shells out to `gsd-t parallel --dry-run` (or project-local equivalent).
  // 4.8-audit: domains array preferred over taskIds (the CLI supports --domain
  // but not --tasks). taskIds kept for back-compat but logged as no-op.
  const subArgs = ["--dry-run"];
  if (Array.isArray(domains) && domains.length) {
    for (const d of domains) subArgs.push("--domain", d);
  }
  const t = _resolveTool(projectDir, "parallel", subArgs, "gsd-t-parallel.cjs");
  const r = spawnSync(t.cmd, t.args, { cwd: projectDir, stdio: "pipe" });
  return {
    ok: r.status === 0,
    exitCode: r.status,
    stdout: r.stdout && r.stdout.toString(),
    stderr: r.stderr && r.stderr.toString(),
    spawnError: r.error ? String(r.error.message) : null,
    via: t.source,
  };
}

function runVerifyGate({ projectDir = ".", skipTrack1, skipTrack2 } = {}) {
  const subArgs = ["--json"];
  if (skipTrack1) subArgs.push("--skip-track1");
  if (skipTrack2) subArgs.push("--skip-track2");
  const t = _resolveTool(projectDir, "verify-gate", subArgs, "gsd-t-verify-gate.cjs");
  const r = spawnSync(t.cmd, t.args, { cwd: projectDir, stdio: "pipe" });
  let envelope = null;
  try {
    envelope = r.stdout ? JSON.parse(r.stdout.toString()) : null;
  } catch (_) {
    envelope = null;
  }
  return {
    ok: r.status === 0,
    exitCode: r.status,
    envelope,
    stderr: r.stderr && r.stderr.toString(),
    spawnError: r.error ? String(r.error.message) : null,
    via: t.source,
  };
}

function loadProtocol(name) {
  // name = "qa" | "red-team" | "design-verify"
  const validNames = ["qa", "red-team", "design-verify"];
  if (!validNames.includes(name)) {
    throw new Error(
      `loadProtocol: unknown protocol ${JSON.stringify(name)}. Valid: ${validNames.join(", ")}`
    );
  }
  const fp = path.join(__dirname, "..", "prompts", `${name}-subagent.md`);
  return fs.readFileSync(fp, "utf8");
}

function readDomainTasks({ projectDir = ".", domain } = {}) {
  if (!domain) throw new Error("readDomainTasks: domain required");
  const fp = path.join(projectDir, ".gsd-t", "domains", domain, "tasks.md");
  if (!fs.existsSync(fp)) return null;
  return fs.readFileSync(fp, "utf8");
}

function readScope({ projectDir = ".", domain } = {}) {
  if (!domain) throw new Error("readScope: domain required");
  const fp = path.join(projectDir, ".gsd-t", "domains", domain, "scope.md");
  if (!fs.existsSync(fp)) return null;
  return fs.readFileSync(fp, "utf8");
}

module.exports = {
  readBrief,
  generateBrief,
  runPreflight,
  proveFileDisjointness,
  runVerifyGate,
  loadProtocol,
  readDomainTasks,
  readScope,
};
