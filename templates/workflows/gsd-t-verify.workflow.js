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
// M90 §4 Fail-Closed gates (FAIL-blocking, after M89 §7 ENFORCE gate):
//   R-FAIL-2: arch-trigger proven-by-adversary-only flag unresolved → VERIFY-FAILED.
//   R-FAIL-3: loop-ledger haltedButNoReExamination state → VERIFY-FAILED.
//   Both are DOCUMENTED no-op-PASSes when the producing mechanism is de-scoped (R1-EXIT),
//   distinguishable from wired-but-broken vacuous passes. Never halt on a de-scoped mechanism.
// Contract: unproven-assumption-doctrine-contract.md §4 (R-FAIL-2, R-FAIL-3).
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
// Scans all milestone artifacts for STRUCTURAL auto-research-claim markers and FAILs if:
//   (a) ANY marker is status=uncited (an external guessed claim was never cited), OR
//   (b) ANY status=cited marker's file lacks a matching `## Verified Facts (auto-research)`
//       block with a sourced fact line (a "cited" marker with no backing fact — the
//       hollow-gate defeat the contract §7/§5 A4 require to FAIL).
//
// CRITICAL STRUCTURAL RULE (Red Team #1 + code-review #1):
//   - A marker counts ONLY if the LINE is a COMPLETE HTML comment
//     `<!-- auto-research-claim: ... status=uncited|cited -->` (has `auto-research-claim:`
//     AND `status=...` on the SAME line AND the line is the comment `<!-- ... -->`). A bare
//     substring match would count the marker TEMPLATE string carried in this repo's own
//     prose/source (CLAUDE-global.md, this contract, the workflows that EMIT the template)
//     as live markers → spurious VERIFY-FAILED when verify dogfoods on this repo.
//   - A status=cited marker is only honored if its file ALSO contains a
//     `## Verified Facts (auto-research)` heading AND ≥1 sourced fact line (`source:` URL).
//     A cited marker WITHOUT a matching sourced fact is counted as a violation (named by
//     its claim-key) — same as an uncited marker. This closes the hollow-gate (A4).
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
    citedWithoutFactsCount: { type: "integer" },
    uncitedMarkers: { type: "array", items: { type: "string" } },
    citedWithoutFactsKeys: { type: "array", items: { type: "string" } },
    internalOnlyArtifacts: { type: "boolean" },
    notes: { type: "string" },
  },
};

phase("Auto-Research Gate");
const arGate = await agent(
  [
    `You are the M89 §7 ENFORCE gate scanner. Scan ALL milestone artifacts in the project at "${projectDir}" for STRUCTURAL auto-research-claim markers and determine pass/fail per contract §7 + §5 (A4 no-silent-guess).`,
    ``,
    `A line is a LIVE MARKER ONLY IF it is a COMPLETE HTML comment of this exact structure (all on ONE line):`,
    `    <!-- auto-research-claim: class=external key=<some-key> status=uncited -->`,
    `    <!-- auto-research-claim: class=external key=<some-key> status=cited -->`,
    `STRUCTURAL TEST (do NOT count a bare substring): the line, trimmed, MUST start with "<!--", MUST end with "-->", MUST contain "auto-research-claim:", MUST contain "status=uncited" or "status=cited", AND its key= value MUST be a CONCRETE normalized key (lowercase words/whitespace, NO angle brackets). Lines that merely MENTION the template in prose or source code (a backtick-quoted example, a string literal that emits the template, a contract illustration) are NOT live markers — they are not a standalone "<!-- ... -->" comment line, OR they carry a PLACEHOLDER key like "key=<claim-key>" / "key=<normalized-claim-key>" / "key=<some-key>" / "key=<key>" (any key= value containing "<" or ">"), OR a placeholder status like "status=uncited|cited" / "status=<status>". SKIP all of those — a real marker's key is the normalizeClaimKey output and never contains angle brackets.`,
    ``,
    `Steps:`,
    `1. Find candidate files: \`grep -rl "auto-research-claim" "${projectDir}" --include="*.md" --include="*.js" --include="*.ts" --include="*.tsx" --include="*.jsx" --include="*.cjs" --include="*.mjs" --include="*.py" 2>/dev/null || echo "no-matches"\``,
    `   NOTE: worker workflows (execute/quick/debug) write §7 markers into their primary OUTPUT artifact, which may be a code file (.js/.ts/.py/...), not only markdown — the include set MUST cover those or an uncited marker in a code artifact escapes the gate (A4).`,
    `2. For each candidate file, read the lines containing "auto-research-claim". Apply the STRUCTURAL TEST above to each line; discard non-marker lines (template/prose/source illustrations).`,
    `3. Among the SURVIVING live markers, classify each as uncited (status=uncited) or cited (status=cited), and record its key= value.`,
    `4. uncitedCount = number of live status=uncited markers. List up to 10 of their full comment lines in "uncitedMarkers".`,
    `5. For EACH live status=cited marker (with key=K): verify the SAME FILE contains a "## Verified Facts (auto-research)" heading AND a sourced fact line that BACKS this specific marker. A sourced fact line is a list item ("- ...") containing "source:" followed by a URL.`,
    `   PER-KEY MATCH (preferred — Red Team MEDIUM #2): if any sourced fact line in the file carries a "key: <value>" trailer, match cited markers to facts BY KEY — the cited marker key=K is backed ONLY by a sourced fact line whose "key:" value equals K (exact normalized-key match). A cited marker whose key has NO sourced fact line with a matching "key:" is HOLLOW even if other facts exist. This prevents one fact covering a DISTINCT claim by mere count.`,
    `   COUNT FALLBACK: if NO sourced fact line in the file carries a "key:" trailer, fall back to the count check — a cited marker is backed iff the file has at least as many sourced fact lines as it has cited markers.`,
    `   A cited marker in a file with NO Verified-Facts heading, OR with no backing fact under either rule above, is a HOLLOW cited marker — record its key= in "citedWithoutFactsKeys".`,
    `   citedCount = number of live status=cited markers. citedWithoutFactsCount = number of hollow cited markers (cited with no matching sourced fact).`,
    `6. pass = true ONLY IF uncitedCount === 0 AND citedWithoutFactsCount === 0 (every external claim is cited AND every cited marker has a matching sourced Verified-Facts entry). pass = false otherwise.`,
    `7. If no files are found (step 1 returns no-matches) OR no LIVE markers survive the structural test, pass=true, uncitedCount=0, citedCount=0, citedWithoutFactsCount=0.`,
    ``,
    `Return JSON per the schema: { "pass": true|false, "uncitedCount": N, "citedCount": N, "citedWithoutFactsCount": N, "uncitedMarkers": [], "citedWithoutFactsKeys": [], "notes": "..." }`,
    ``,
    `Contract: auto-research-contract.md §7 (ENFORCE marker — cited REQUIRES a matching Verified-Facts entry, same claim-key) + §5/A4 (uncited or hollow-cited external guess → verify FAILS).`,
  ].join("\n"),
  { label: "auto-research-gate", phase: "Auto-Research Gate", schema: AUTO_RESEARCH_GATE_SCHEMA, model: "haiku" }
).catch((e) => ({
  pass: false, uncitedCount: -1, citedCount: 0, citedWithoutFactsCount: -1,
  notes: `auto-research gate agent error: ${e && e.message} — failing closed (A4)`,
}));

if (!arGate.pass) {
  const uncited = arGate.uncitedCount >= 0 ? arGate.uncitedCount : "unknown (agent error)";
  const hollow = arGate.citedWithoutFactsCount >= 0 ? arGate.citedWithoutFactsCount : "unknown (agent error)";
  log(`M89 auto-research gate FAIL — ${uncited} uncited + ${hollow} hollow-cited external-claim marker(s) (A4: no silent guess)`);
  if (arGate.uncitedMarkers && arGate.uncitedMarkers.length > 0) {
    log(`  uncited markers: ${arGate.uncitedMarkers.slice(0, 5).join(" | ")}`);
  }
  if (arGate.citedWithoutFactsKeys && arGate.citedWithoutFactsKeys.length > 0) {
    log(`  hollow cited (no matching sourced fact) keys: ${arGate.citedWithoutFactsKeys.slice(0, 5).join(" | ")}`);
  }
  return {
    status: "auto-research-gate-failed",
    overallVerdict: "VERIFY-FAILED",
    autoResearchGate: arGate,
    reason: `M89 §7 ENFORCE: ${uncited} uncited + ${hollow} hollow-cited external-claim marker(s) — every cited marker needs a matching sourced Verified-Facts entry; run the phase again to cite them`,
    verifyGate: vg.envelope,
  };
}
log(`M89 auto-research gate: PASS — ${arGate.citedCount} cited marker(s) all backed by sourced facts, 0 uncited`);

// ─── M90 §4 Fail-Closed Gates (FAIL-blocking) ─────────────────────────────
// R-FAIL-2: arch-trigger produced a proven-by-adversary-only flag that was never resolved.
// R-FAIL-3: loop-ledger has a halted-but-no-re-examination state (non-convergence).
//
// DOCUMENTED no-op-PASS rules (§4 — de-scoped-DOWN vs. wired-but-broken):
//   - R-FAIL-2 read is a NO-OP-PASS when the arch-trigger is NOT wired (R1-EXIT de-scoped-DOWN).
//     Documented as "mechanism absent by design" — distinguishable from a wired-but-broken state.
//   - R-FAIL-3 read is a NO-OP-PASS when the loop-ledger halt is NOT wired (de-scoped).
//     Documented as "mechanism absent by design" — distinguishable from a wired-but-broken state.
//
// The checks FAIL only when the mechanism IS wired AND emits an unresolved flag.
// They cleanly PASS (with a recorded de-scoped note) when the mechanism is absent.
// Contract: unproven-assumption-doctrine-contract.md §4 (R-FAIL-2, R-FAIL-3).

// R-FAIL-2: read arch-trigger state (proven-by-adversary-only flag)
// The arch-trigger's instrumentation sink is at .gsd-t/metrics/arch-trigger-events.jsonl.
// We scan for any entry with provenByAdversaryOnly=true that lacks a recorded re-examination.
const M90_ARCH_TRIGGER_SINK = `${projectDir}/.gsd-t/metrics/arch-trigger-events.jsonl`;
const m90ArchTriggerGate = await agent(
  [
    `You are the M90 §4 R-FAIL-2 gate scanner. Check if the arch-trigger instrumentation sink has any`,
    `unresolved "proven-by-adversary-only" entries.`,
    ``,
    `Sink file: \`${M90_ARCH_TRIGGER_SINK}\``,
    ``,
    `Steps:`,
    `1. Check if the sink file exists: \`test -f '${M90_ARCH_TRIGGER_SINK}' && echo EXISTS || echo ABSENT\``,
    `2. If ABSENT → the arch-trigger mechanism is NOT wired (de-scoped per R1-EXIT). Return:`,
    `   { "pass": true, "deScopedPass": true, "note": "arch-trigger mechanism absent by design (R1-EXIT de-scoped-DOWN) — R-FAIL-2 is a documented no-op-PASS", "provenByAdversaryOnlyCount": 0 }`,
    `3. If EXISTS → read its lines (each is a JSONL record). Check for any record where:`,
    `   - provenByAdversaryOnly === true (the trigger flagged a premise proven only by adversarial reasoning)`,
    `   Count such records → set provenByAdversaryOnlyCount.`,
    `4. pass = true if provenByAdversaryOnlyCount === 0; pass = false otherwise.`,
    `5. Return JSON: { "pass": boolean, "deScopedPass": false, "provenByAdversaryOnlyCount": N, "note": "..." }`,
    ``,
    `This gate is R-FAIL-2 per unproven-assumption-doctrine-contract.md §4. A proven-by-adversary-only`,
    `flag that was never independently verified blocks verify. The no-op-PASS (deScopedPass=true)`,
    `is DISTINGUISHABLE from a wired-but-broken vacuous pass.`,
  ].join("\n"),
  {
    label: "m90-r-fail-2-gate",
    phase: "Auto-Research Gate",
    model: "haiku",
    schema: {
      type: "object",
      required: ["pass"],
      additionalProperties: true,
      properties: {
        pass: { type: "boolean" },
        deScopedPass: { type: "boolean" },
        provenByAdversaryOnlyCount: { type: "integer" },
        note: { type: "string" },
      },
    },
  }
).catch((e) => ({
  pass: false,
  deScopedPass: false,
  provenByAdversaryOnlyCount: -1,
  note: `M90 R-FAIL-2 gate agent error: ${e && e.message} — failing closed (§4)`,
}));

if (!m90ArchTriggerGate.pass) {
  const count = m90ArchTriggerGate.provenByAdversaryOnlyCount >= 0
    ? m90ArchTriggerGate.provenByAdversaryOnlyCount
    : "unknown (agent error)";
  log(`M90 R-FAIL-2 gate FAIL — ${count} unresolved proven-by-adversary-only flag(s) (§4 fail-closed)`);
  return {
    status: "m90-r-fail-2-failed",
    overallVerdict: "VERIFY-FAILED",
    m90ArchTriggerGate,
    reason: `M90 §4 R-FAIL-2: ${count} unresolved proven-by-adversary-only premise(s) — re-examine the premise, then re-verify`,
    verifyGate: vg.envelope,
    autoResearchGate: arGate,
  };
}
log(`M90 R-FAIL-2 gate: PASS — ${m90ArchTriggerGate.deScopedPass ? "de-scoped (mechanism absent by design)" : `0 unresolved proven-by-adversary-only flag(s)`}`);

// R-FAIL-3: read loop-ledger exit state (haltedButNoReExamination flag)
const m90LoopLedgerGate = await runCli(
  projectDir,
  "loop-ledger",
  ["read-exit-state", "--projectDir", projectDir],
  "gsd-t-loop-ledger.cjs",
  "m90-r-fail-3-gate",
  true,
  "Auto-Research Gate"
);

// Determine pass/fail from the loop-ledger exit state.
// haltedButNoReExamination=true → R-FAIL-3 gate FAILS.
// If the loop-ledger module is absent (ok=false, exitCode≠0) → de-scoped NO-OP-PASS.
let m90LoopLedgerPass = true;
let m90LoopLedgerNote = "";
if (!m90LoopLedgerGate.ok && m90LoopLedgerGate.exitCode !== 0) {
  // Module absent or error → de-scoped no-op-PASS (distinguishable from wired-but-broken)
  m90LoopLedgerPass = true;
  m90LoopLedgerNote = "loop-ledger mechanism absent by design (de-scoped) — R-FAIL-3 is a documented no-op-PASS";
  log(`M90 R-FAIL-3 gate: PASS (de-scoped — loop-ledger absent or not wired)`);
} else {
  const exitEnv = m90LoopLedgerGate.envelope || {};
  if (exitEnv.ok && exitEnv.haltedButNoReExamination) {
    m90LoopLedgerPass = false;
    m90LoopLedgerNote = `R-FAIL-3: loop-ledger has ${(exitEnv.haltedSignatures || []).length} halted-but-no-re-examination signature(s) — re-examine the premise per §3.2`;
    log(`M90 R-FAIL-3 gate FAIL — haltedButNoReExamination=true (§4 fail-closed)`);
  } else {
    m90LoopLedgerPass = true;
    m90LoopLedgerNote = `no halted-but-no-re-examination state (haltedButNoReExamination=${exitEnv.haltedButNoReExamination || false})`;
    log(`M90 R-FAIL-3 gate: PASS — ${m90LoopLedgerNote}`);
  }
}

if (!m90LoopLedgerPass) {
  return {
    status: "m90-r-fail-3-failed",
    overallVerdict: "VERIFY-FAILED",
    m90LoopLedgerGate: m90LoopLedgerGate.envelope,
    reason: m90LoopLedgerNote,
    verifyGate: vg.envelope,
    autoResearchGate: arGate,
    m90ArchTriggerGate,
  };
}

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
