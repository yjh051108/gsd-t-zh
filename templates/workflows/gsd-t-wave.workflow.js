// templates/workflows/gsd-t-wave.workflow.js
//
// Runtime: Anthropic native Workflow tool only.
// Full milestone wave: execute then verify, with C-checkpoint gates between.
//
// args: { milestone, domains: [...], projectDir?, autoIntegrate? }

export const meta = {
  name: "gsd-t-wave",
  description: "Execute then verify a milestone end-to-end, with integrate barrier",
  phases: [
    { title: "Execute",   detail: "domain workers + integrate" },
    { title: "Verify",    detail: "orthogonal triad + verify-gate" },
  ],
};

// M81: this workflow only composes sub-workflows (execute + verify) — it never used
// lib.*, but the `require("./_lib.js")` import alone crashed it on first eval in the
// sandbox (TD-113). Removed. args arrives as a JSON STRING in this runtime, so parse it.
const _args = (typeof args === "string") ? (() => { try { return JSON.parse(args); } catch { return {}; } })() : (args || {});

const projectDir = _args.projectDir || ".";
const milestone  = _args.milestone || null;
const domains    = _args.domains || [];

if (!milestone || !domains.length) {
  log("wave: args.milestone and args.domains required");
  return { status: "failed", reason: "missing-args" };
}

phase("Execute");
const execResult = await workflow("gsd-t-execute", { milestone, domains, projectDir });
if (execResult.status !== "complete") {
  log(`execute status=${execResult.status} — halting before verify`);
  return { status: execResult.status, stage: "execute", execResult };
}

phase("Verify");
const verifyResult = await workflow("gsd-t-verify", { milestone, projectDir });

return {
  status: verifyResult.status === "complete" ? "complete" : "verify-failed",
  milestone,
  execResult,
  verifyResult,
};
