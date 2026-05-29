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

const lib = require("./_lib.js");

const projectDir = (args && args.projectDir) || ".";
const milestone  = (args && args.milestone)  || null;
const domains    = (args && args.domains)    || [];

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
