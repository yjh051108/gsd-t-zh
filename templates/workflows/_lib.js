// templates/workflows/_lib.js
// Shared helpers for GSD-T Workflow scripts. CommonJS, zero deps.
//
// Workflow scripts call these helpers from inside agent()/parallel()/pipeline()
// stages so the brains (file-disjointness prover, brief generator, preflight,
// verify-gate) stay invocable while the orchestration shell becomes a Workflow.

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");

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
  const r = spawnSync("gsd-t", args, { cwd: projectDir, stdio: "pipe" });
  if (r.status !== 0) {
    return { ok: false, briefPath: out, stderr: r.stderr && r.stderr.toString() };
  }
  return { ok: true, briefPath: out };
}

function runPreflight({ projectDir = ".", checks } = {}) {
  const args = ["preflight", "--json"];
  if (Array.isArray(checks) && checks.length) args.push("--checks", checks.join(","));
  const r = spawnSync("gsd-t", args, { cwd: projectDir, stdio: "pipe" });
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
  };
}

function proveFileDisjointness({ projectDir = ".", taskIds } = {}) {
  // Shells out to gsd-t parallel --dry-run to leverage the existing prover.
  const args = ["parallel", "--dry-run"];
  if (Array.isArray(taskIds) && taskIds.length) {
    args.push("--tasks", taskIds.join(","));
  }
  const r = spawnSync("gsd-t", args, { cwd: projectDir, stdio: "pipe" });
  return {
    ok: r.status === 0,
    exitCode: r.status,
    stdout: r.stdout && r.stdout.toString(),
    stderr: r.stderr && r.stderr.toString(),
  };
}

function runVerifyGate({ projectDir = ".", skipTrack1, skipTrack2 } = {}) {
  const args = ["verify-gate", "--json"];
  if (skipTrack1) args.push("--skip-track1");
  if (skipTrack2) args.push("--skip-track2");
  const r = spawnSync("gsd-t", args, { cwd: projectDir, stdio: "pipe" });
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
