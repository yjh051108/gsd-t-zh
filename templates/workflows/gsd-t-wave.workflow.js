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
// M86: resolved overrides map injected by the wave invoker (invoke-time injection, M69).
// Forward to BOTH sub-workflow calls so the profile-tier assignments propagate through
// the full cycle (pre-mortem r1 #1 CRITICAL: wave was the only entry point that never
// forwarded overrides, leaving red-team on the premium fallback regardless of profile).
const overrides = (_args.overrides && typeof _args.overrides === "object") ? _args.overrides : {};

const projectDir = _args.projectDir || ".";
const milestone  = _args.milestone || null;
const domains    = _args.domains || [];

if (!milestone || !domains.length) {
  log("wave: args.milestone and args.domains required");
  return { status: "failed", reason: "missing-args" };
}

phase("Execute");
const execResult = await workflow("gsd-t-execute", { milestone, domains, projectDir, overrides });
if (execResult.status !== "complete") {
  log(`execute status=${execResult.status} — halting before verify`);
  return { status: execResult.status, stage: "execute", execResult };
}

phase("Verify");
const verifyResult = await workflow("gsd-t-verify", { milestone, projectDir, overrides });

return {
  status: verifyResult.status === "complete" ? "complete" : "verify-failed",
  milestone,
  execResult,
  verifyResult,
};
