// templates/workflows/gsd-t-verify.workflow.js
//
// Runtime: Anthropic native Workflow tool only (not standalone-Node parseable).
// Globals provided by runtime: agent, parallel, pipeline, log, phase, budget, args.
//
// Canonical verify-phase Workflow. Replaces the gsd-t-verify command shell with
// a deterministic pipeline:
//   preflight → brief → verify-gate (deterministic, hard-fail) →
//   M89 §7 ENFORCE gate (auto-research-claim marker scan) →
//   parallel( /code-review ultra cooperative, Red Team adversarial, QA mechanics ) →
//   synthesis ( merge findings WITHOUT collapsing categories — see orthogonal-validation-contract.md )
//
// M89 §7 ENFORCE gate: an artifact carrying ANY <!-- auto-research-claim: ... status=uncited -->
// marker FAILs (an external guessed claim proceeded without a cited fact). All markers
// status=cited with matching ## Verified Facts (auto-research) entries → PASS.
// Contract: auto-research-contract.md §7 + §5 (A4).
//
// args shape:
//   {
//     milestone: "M61",
//     projectDir: ".",     // optional
//     skipUltra:  false,   // optional — skip /code-review ultra if rate-limited
//   }

export const meta = {
  name: "gsd-t-verify",
  description:
    "GSD-T verify phase: preflight → brief → verify-gate → M89 §7 ENFORCE gate → CI-parity gate (M57) → test-data purge gate (M58) → parallel(code-review-ultra, Red Team, QA) → synthesis",
  phases: [
    { title: "Preflight",          detail: "preflight + brief" },
    { title: "Verify-Gate",        detail: "deterministic two-track verify-gate" },
    { title: "Auto-Research Gate", detail: "M89 §7 ENFORCE: scan for status=uncited markers (A4 — no silent guess)" },
    { title: "CI-Parity",          detail: "M57 build-coverage + ci-parity (FAIL-blocking)" },
    { title: "Test-Data Purge",    detail: "M58 test-data --purge (FAIL-blocking)" },
    { title: "Orthogonal Triad",   detail: "code-review ultra ∥ Red Team ∥ QA" },
    { title: "Synthesis",          detail: "merge without collapsing categories" },
  ],
};

// M81: runtime-native helpers (sandbox bans require/fs/path/child_process/process — the
// old require("./_lib.js") + the inline require("child_process"/"fs"/"path") in the
// CI-parity block crashed this on first eval, TD-113). All CLI calls (preflight,
// verify-gate, build-coverage, ci-parity, test-data) delegate to an agent's Bash; the
// QA/Red-Team protocol bodies are read by an agent (Read) instead of fs. args arrives as
// a JSON STRING in this runtime. See gsd-t-scan.workflow.js.
const _args = (typeof args === "string") ? (() => { try { return JSON.parse(args); } catch { return {}; } })() : (args || {});
// M86: resolved overrides map injected by the invoker (invoke-time injection, M69).
// Default to {} so the premium fallback literals apply when no invoker injects overrides.
// overrides values are CONCRETE model ids (resolver envelope); the bare literals below
// are tier ALIASES. The sandbox runtime accepts BOTH forms in model: — proven live for
// the concrete-id fable path by probe wf_c9faf817-373 (no HTTP 400).
const overrides = (_args.overrides && typeof _args.overrides === "object") ? _args.overrides : {};
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
async function generateBrief(projectDir, { kind = "verify", milestone, domain, id, label = "brief", phaseName } = {}) {
  const argv = ["--kind", kind, "--spawn-id", id, "--out", `${projectDir}/.gsd-t/briefs/${id}.json`];
  if (milestone) argv.push("--milestone", milestone);
  if (domain) argv.push("--domain", domain);
  const r = await runCli(projectDir, "brief", argv, "gsd-t-context-brief.cjs", label, false, phaseName);
  return { ok: r.ok, briefPath: `${projectDir}/.gsd-t/briefs/${id}.json`, via: r.via };
}
// The QA / Red-Team / design-verify protocol bodies live at templates/prompts/<name>-subagent.md
// inside the installed @tekyzinc/gsd-t package. The orchestrator can't read files (no fs); each
// triad agent reads its OWN protocol via Read at spawn time. loadProtocol returns a Read-instruction
// the agent prompt embeds, rather than the protocol text itself.
function loadProtocolInstruction(name) {
  const rel = `templates/prompts/${name}-subagent.md`;
  // Locate the protocol inside the installed @tekyzinc/gsd-t package using ONLY shell
  // (no require/fs tokens — those trip the runtime-native lint even inside a string).
  return `Read your protocol FIRST. Find it by running in Bash: \`cat "$(npm root -g)/@tekyzinc/gsd-t/${rel}"\` (or, if a project-local \`${rel}\` exists, read that instead). Follow that protocol exactly.`;
}

const projectDir = _args.projectDir || ".";
const milestone  = _args.milestone || null;
const skipUltra  = _args.skipUltra || false;
const skipUltraReason = _args.skipUltraReason || null;

// 4.8-audit fix: skipUltra requires a recorded reason per
// orthogonal-validation-contract.md Rule #2. Refuse without one.
if (skipUltra && !skipUltraReason) {
  log("verify: args.skipUltra=true requires args.skipUltraReason: string (per contract Rule #2)");
  return { status: "failed", reason: "skipUltra-without-reason" };
}

// ───── Schemas ─────

const REVIEW_ULTRA_SCHEMA = {
  type: "object",
  required: ["category", "findings"],
  additionalProperties: false,
  properties: {
    category: { const: "correctness-and-cleanup" },
    findings: {
      type: "array",
      items: {
        type: "object",
        required: ["severity", "file", "summary"],
        properties: {
          severity:    { type: "string", enum: ["important", "nit", "pre-existing"] },
          file:        { type: "string" },
          line:        { type: "integer" },
          summary:     { type: "string" },
          suggestion:  { type: "string" },
        },
      },
    },
    notes: { type: "string" },
  },
};

const RED_TEAM_SCHEMA = {
  type: "object",
  required: ["category", "verdict", "bugs"],
  additionalProperties: false,
  properties: {
    category: { const: "adversarial-security-boundaries" },
    verdict:  { type: "string", enum: ["FAIL", "GRUDGING-PASS"] },
    bugs: {
      type: "array",
      items: {
        type: "object",
        required: ["severity", "title", "lens"],
        properties: {
          severity: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"] },
          title:    { type: "string" },
          lens:     { type: "string" },
          file:     { type: "string" },
          repro:    { type: "string" },
        },
      },
    },
    notes: { type: "string" },
  },
};

const QA_SCHEMA = {
  type: "object",
  required: ["category", "suiteResult", "shallowTests", "contractCompliance"],
  additionalProperties: false,
  properties: {
    category:    { const: "test-mechanics-and-compliance" },
    suiteResult: {
      type: "object",
      required: ["pass", "fail"],
      properties: {
        pass:    { type: "integer" },
        fail:    { type: "integer" },
        skipped: { type: "integer" },
      },
    },
    shallowTests: {
      type: "array",
      items: {
        type: "object",
        required: ["file", "test", "reason"],
        properties: {
          file:   { type: "string" },
          test:   { type: "string" },
          reason: { type: "string" },
        },
      },
    },
    contractCompliance: {
      type: "object",
      required: ["compliant", "violations"],
      properties: {
        compliant:  { type: "boolean" },
        violations: { type: "array", items: { type: "string" } },
      },
    },
    notes: { type: "string" },
  },
};

const VERDICT_SCHEMA = {
  type: "object",
  required: ["overallVerdict", "summary"],
  additionalProperties: false,
  properties: {
    overallVerdict: { type: "string", enum: ["VERIFIED", "VERIFIED-WITH-WARNINGS", "VERIFY-FAILED"] },
    summary:        { type: "string" },
    blockingFindings: { type: "array", items: { type: "string" } },
  },
};

// ───── Script body ─────

if (!milestone) {
  log("verify: args.milestone required");
  return { status: "failed", reason: "missing-milestone" };
}

phase("Preflight");
const pre = await runPreflight(projectDir);
if (!pre.ok) {
  log(`preflight FAIL — halting verify`);
  return { status: "failed", reason: "preflight-failed", preflight: pre.envelope };
}
const brief = await generateBrief(projectDir, { kind: "verify", milestone, id: `verify-${(milestone || "m").toLowerCase()}` });

phase("Verify-Gate");
const vg = await runVerifyGate(projectDir);
if (!vg.ok) {
  log(`verify-gate FAIL exitCode=${vg.exitCode} — halting before triad`);
  return {
    status: "verify-gate-failed",
    overallVerdict: "VERIFY-FAILED",
    verifyGate: vg.envelope,
  };
}
log(`verify-gate green`);

// ─── M89 §7 ENFORCE Gate (FAIL-blocking — A4 no-silent-guess) ─────────────
// Scans all milestone artifacts for <!-- auto-research-claim: ... status=uncited -->
// markers. An uncited marker means an external guessed claim was never cited — FAIL.
// Contract: auto-research-contract.md §7 + §5 (A4).
// M81: no fs — delegate to an agent's Bash (grep) + parse result.
const AUTO_RESEARCH_GATE_SCHEMA = {
  type: "object",
  required: ["pass", "uncitedCount", "citedCount"],
  additionalProperties: true,
  properties: {
    pass: { type: "boolean" },
    uncitedCount: { type: "integer" },
    citedCount: { type: "integer" },
    uncitedMarkers: { type: "array", items: { type: "string" } },
    internalOnlyArtifacts: { type: "boolean" },
    notes: { type: "string" },
  },
};

phase("Auto-Research Gate");
const arGate = await agent(
  [
    `You are the M89 §7 ENFORCE gate scanner. Scan ALL milestone artifacts in the project at "${projectDir}" for auto-research-claim markers and determine if ANY status=uncited markers exist.`,
    ``,
    `Steps:`,
    `1. Run: \`grep -r "auto-research-claim" "${projectDir}" --include="*.md" --include="*.js" --include="*.ts" --include="*.tsx" --include="*.jsx" --include="*.cjs" --include="*.mjs" --include="*.py" -l 2>/dev/null || echo "no-matches"\``,
    `   This finds all files with auto-research-claim markers. NOTE: worker workflows (execute/quick/debug) write §7 markers into their primary OUTPUT artifact, which may be a code file (.js/.ts/.py/...), not only markdown — the include set MUST cover those or an uncited marker in a code artifact escapes the gate (A4 no-silent-guess).`,
    `2. For each matching file, run: \`grep "auto-research-claim" <file>\``,
    `   to get the actual marker lines.`,
    `3. Count:`,
    `   - uncitedCount = lines containing "status=uncited"`,
    `   - citedCount   = lines containing "status=cited" (excluding any that also contain "uncited")`,
    `4. pass = true ONLY if uncitedCount === 0 (all markers are cited OR no markers exist).`,
    `   pass = false if ANY marker has status=uncited.`,
    `5. List up to 10 uncited marker lines in "uncitedMarkers" (the full HTML comment).`,
    `6. If no files are found (step 1 returns no-matches), pass=true, uncitedCount=0, citedCount=0.`,
    ``,
    `Return JSON per the schema: { "pass": true|false, "uncitedCount": N, "citedCount": N, "uncitedMarkers": [], "notes": "..." }`,
    ``,
    `Contract: auto-research-contract.md §7 (ENFORCE marker) + §5/A4 (uncited external guess → verify FAILS).`,
  ].join("\n"),
  { label: "auto-research-gate", phase: "Auto-Research Gate", schema: AUTO_RESEARCH_GATE_SCHEMA, model: "haiku" }
).catch((e) => ({
  pass: false, uncitedCount: -1, citedCount: 0,
  notes: `auto-research gate agent error: ${e && e.message} — failing closed (A4)`,
}));

if (!arGate.pass) {
  const uncited = arGate.uncitedCount >= 0 ? arGate.uncitedCount : "unknown (agent error)";
  log(`M89 auto-research gate FAIL — ${uncited} uncited external-claim marker(s) found (A4: no silent guess)`);
  if (arGate.uncitedMarkers && arGate.uncitedMarkers.length > 0) {
    log(`  uncited markers: ${arGate.uncitedMarkers.slice(0, 5).join(" | ")}`);
  }
  return {
    status: "auto-research-gate-failed",
    overallVerdict: "VERIFY-FAILED",
    autoResearchGate: arGate,
    reason: `M89 §7 ENFORCE: ${uncited} uncited external-claim marker(s) — run the phase again to cite them before verify`,
    verifyGate: vg.envelope,
  };
}
log(`M89 auto-research gate: PASS — ${arGate.citedCount} cited marker(s), 0 uncited`);

// ─── M57 CI-Parity Gate (FAIL-blocking) ───────────────────────────────────
// Per commands/gsd-t-verify.md Step 2.6 + cli-build-coverage-contract.md +
// ci-parity-contract.md. NEITHER track is currently inside verify-gate.cjs.
// Origin: TimeTracking v1.10.12 shipped VERIFIED+tagged with a new dir absent
// from Dockerfile COPY — silent CI-divergence regression. M57 made this gate
// mandatory; Workflow MUST preserve it or we re-introduce that exact failure.
// Detected by user/worker in parallel session 2026-05-29 13:00.
// M81: these were raw spawnSync + require("fs"/"path"/"child_process") in the orchestrator
// — the exact sandbox-forbidden pattern (TD-113). Now awaited runCli agent calls. The
// FAIL-blocking semantics are UNCHANGED: a non-zero exit halts verify before the triad.
phase("CI-Parity");
const bc = await runCli(projectDir, "build-coverage", ["--json"], "gsd-t-build-coverage.cjs", "m57:build-coverage", true, "CI-Parity");
if (!bc.ok) {
  log(`M57 build-coverage FAIL exitCode=${bc.exitCode} — halting (FAIL-blocking)`);
  return { status: "ci-parity-failed", overallVerdict: "VERIFY-FAILED", buildCoverage: bc.envelope };
}
const cip = await runCli(projectDir, "ci-parity", ["--json"], "gsd-t-ci-parity.cjs", "m57:ci-parity", true, "CI-Parity");
if (!cip.ok) {
  log(`M57 ci-parity FAIL exitCode=${cip.exitCode} — halting (FAIL-blocking)`);
  return { status: "ci-parity-failed", overallVerdict: "VERIFY-FAILED", ciParity: cip.envelope };
}
log(`M57 CI-parity gate green`);

// ─── M58 Test-Data Purge Gate (FAIL-blocking) ─────────────────────────────
// Per commands/gsd-t-verify.md Step 4.5 + test-data-tagging-contract.md v1.1.0.
// Origin: GSD-T-Board v0.1.10 shipped VERIFIED with 2442 E2E_TEST_* orphans
// live in production data. M58 made post-E2E purge mandatory; M60 hardened
// the adapters against empty-prefix bypass. Workflow MUST preserve.
phase("Test-Data Purge");
// M81: run-id is stable per verify run (no Date.now in the sandbox); the milestone scope
// is sufficient for purge targeting and is deterministic on resume.
const verifyRunId = `verify-${(milestone || "M__").toLowerCase()}`;
const td = await runCli(projectDir, "test-data", ["--purge", "--run", verifyRunId, "--json"], "gsd-t-test-data-ledger.cjs", "m58:test-data-purge", true, "Test-Data Purge");
if (!td.ok) {
  log(`M58 test-data purge FAIL exitCode=${td.exitCode} — halting (FAIL-blocking)`);
  return { status: "test-data-purge-failed", overallVerdict: "VERIFY-FAILED", testDataPurge: td.envelope };
}
log(`M58 test-data purge green — proceeding to orthogonal triad`);

phase("Orthogonal Triad");

const briefRef = brief.briefPath || "(brief generation failed — re-walk repo)";

// M81: the protocol body lives in templates/prompts/<name>-subagent.md inside the installed
// package; the orchestrator can't read files (no fs). Each triad agent reads its OWN
// protocol via Read at spawn time — loadProtocolInstruction returns the Read directive.
const redTeamProtocolInstruction = loadProtocolInstruction("red-team");
const qaProtocolInstruction = loadProtocolInstruction("qa");

const stages = [
  // Stage A — /code-review ultra (cooperative correctness + cleanup)
  // Per orthogonal-validation-contract.md: this finds bugs+cleanups in the
  // "build it right" lens. NEVER substitutes for Red Team.
  !skipUltra && (() => agent(
    [
      `You are running a /code-review ultra cooperative pass for milestone \`${milestone}\`.`,
      ``,
      `**Brief (REQUIRED):** ${briefRef}`,
      ``,
      `Per .gsd-t/contracts/orthogonal-validation-contract.md, your scope is`,
      `**correctness + cleanup** — reuse, simplification, efficiency, altitude cleanups.`,
      `You are COOPERATIVE — assume the code is being built in good faith. You are`,
      `NOT looking for adversarial security bugs (Red Team's job) or test-mechanics`,
      `issues (QA's job). Report only findings in your category.`,
      ``,
      `Severity: "important" (must-fix bugs), "nit" (style/clarity), "pre-existing"`,
      `(out of milestone scope but worth flagging).`,
      ``,
      `Return JSON per the schema.`,
    ].join("\n"),
    { label: "code-review-ultra", phase: "Orthogonal Triad", schema: REVIEW_ULTRA_SCHEMA, model: "opus" }
  )),

  // Stage B — Red Team (adversarial / security / boundaries)
  () => agent(
    [
      `You are the Red Team adversarial validator for milestone \`${milestone}\`.`,
      ``,
      `**Brief (REQUIRED):** ${briefRef}`,
      ``,
      `Per .gsd-t/contracts/orthogonal-validation-contract.md, your scope is`,
      `**adversarial / security / boundaries**. You are NOT cooperative — your`,
      `success is measured in bugs FOUND, not tests passed. Try to break the code.`,
      ``,
      `Run the Red Team protocol. ${redTeamProtocolInstruction}`,
      ``,
      `Verdict is FAIL if you found any CRITICAL or HIGH severity bug; GRUDGING-PASS`,
      `if you searched exhaustively and found nothing. Return JSON per the schema.`,
    ].join("\n"),
    { label: "red-team", phase: "Orthogonal Triad", schema: RED_TEAM_SCHEMA, model: overrides["red-team"] ?? "fable" }
  ),

  // Stage C — QA (test execution + shallow-test detection + contract compliance)
  () => agent(
    [
      `You are the QA validator for milestone \`${milestone}\`.`,
      ``,
      `**Brief (REQUIRED):** ${briefRef}`,
      ``,
      `Per .gsd-t/contracts/orthogonal-validation-contract.md, your scope is`,
      `**test mechanics + contract compliance**. Run the test suite. Report pass/fail/skip`,
      `counts. Detect shallow tests (layout-only assertions that pass on an empty HTML page).`,
      `Verify contract compliance against .gsd-t/contracts/.`,
      ``,
      `Run the QA protocol. ${qaProtocolInstruction}`,
      ``,
      `Return JSON per the schema.`,
    ].join("\n"),
    { label: "qa", phase: "Orthogonal Triad", schema: QA_SCHEMA, model: "sonnet" }
  ),
].filter(Boolean);

const triadResults = await parallel(stages);

phase("Synthesis");
const synthesisPrompt = [
  `You are the synthesis agent. Three orthogonal validators have run.`,
  `**Do NOT collapse categories**: a Red Team CRITICAL is not the same as a`,
  `/code-review ultra "important" finding. Per orthogonal-validation-contract.md,`,
  `they're declared orthogonal objective functions and must stay distinct in the report.`,
  ``,
  `Validator results:`,
  "```json",
  JSON.stringify(triadResults, null, 2),
  "```",
  ``,
  `Compute the overall verdict per orthogonal-validation-contract.md v1.0.0:`,
  `- VERIFIED iff: Red Team verdict=GRUDGING-PASS AND QA suiteResult.fail=0 AND QA shallowTests=[] AND QA contractCompliance.compliant=true AND code-review ultra ran AND has no "important" findings. **skipUltra=${skipUltra} → ${skipUltra ? "INELIGIBLE for VERIFIED (skipUltra=true downgrades to VERIFIED-WITH-WARNINGS at best per Rule #2)" : "eligible"}.**`,
  `- VERIFIED-WITH-WARNINGS if: Red Team GRUDGING-PASS, QA suite green, contracts compliant, AND any of: code-review ultra has "important" findings, OR skipUltra=true (reason: ${skipUltraReason || "(none — would have failed above)"}), OR QA shallowTests.length === 1 (single non-core).`,
  `- VERIFY-FAILED otherwise (Red Team FAIL, QA fail>0, contract violations>0, shallowTests ≥ 2 or in core paths).`,
  ``,
  `Return JSON per VERDICT_SCHEMA with blockingFindings listing concrete things that must fix.`,
].join("\n");

const verdict = await agent(synthesisPrompt, {
  label: "synthesis",
  phase: "Synthesis",
  schema: VERDICT_SCHEMA,
  model: "opus",
});

return {
  status: verdict.overallVerdict === "VERIFY-FAILED" ? "failed" : "complete",
  overallVerdict: verdict.overallVerdict,
  verifyGate: vg.envelope,
  autoResearchGate: arGate,
  buildCoverage: bc.envelope,
  ciParity: cip.envelope,
  testDataPurge: td.envelope,
  triad: triadResults,
  verdict,
};
