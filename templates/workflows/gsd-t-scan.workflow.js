// templates/workflows/gsd-t-scan.workflow.js
//
// RUNTIME: Anthropic native Workflow tool ONLY. The sandbox exposes EXACTLY these
// globals: agent(), parallel(), pipeline(), log(), phase(), budget, args.
// It does NOT provide require / module / fs / path / child_process / process.
// Using any of those throws `ReferenceError: require is not defined` at runtime —
// the bug (M71) that made every GSD-T workflow silently fail and fall back to a
// hand-driven scan. `node --check` validates syntax only and CANNOT catch this;
// `test/m71-workflow-runtime-native-lint.test.js` is the mechanical guard, and an
// actual sandbox run is the acceptance gate.
//
// THE ARCHITECTURE (M71): the orchestrator body does NO file I/O. It only sequences
// phases and threads data (as strings) between agents. ALL reads, writes, archive,
// git, and counting happen INSIDE subagents — they have Bash/Read/Write/Grep tools.
// `projectDir` is passed into prompts so each agent operates on the right tree.
//
//   preflight(agent) → volume-probe(agent) → pipeline(deep-finder → single verify)
//   → synthesis(agent: archive + write register + git) → document(parallel per-doc
//   agents: living docs + 5 dimension files + plain-english) → render(agent: HTML).
//
// args shape:
//   { projectDir: ".", scanNumber?: 13, verify?: "single"|"none", graphMode?: "wired"|"disabled" }
//   graphMode:
//     "wired"    (default) — build index if absent, query structural slice, inject into scanSlice agents
//     "disabled" — skip all graph calls (the no-graph baseline for AC-4 INSIGHT-delta comparison)
//   (no slice cap — the probe's cohesive-sub-domain decomposition is the slice set.)

export const meta = {
  name: "gsd-t-scan",
  description:
    "GSD-T scan (runtime-native): preflight → volume-probe → pipeline(deep-finder per slice → single verify) → synthesis(archive+register) → document(living docs + 5 dimension files + plain-english) → render. Orchestrator does NO fs/require; all I/O is inside subagents. Fans out by codebase volume.",
  phases: [
    { title: "Preflight",     detail: "branch + prior-register check (agent via Bash)" },
    { title: "Probe",         detail: "volume probe → per-area slice list", model: "sonnet" },
    { title: "Graph-Wiring",  detail: "M94-D6: build index if absent + query structural slice (dead-code/dangling/cluster) → inject into finders ADDITIVELY; fallback announced on graph-unavailable", model: "haiku" },
    { title: "Deep Scan",     detail: "pipeline: per-slice deep finder (graph-augmented when wired) → single verify" },
    { title: "Synthesis",     detail: "archive prior + write fresh register (type-grouped within severity) + git", model: "opus" },
    { title: "Consolidation", detail: "opus + graph-assisted: high-confidence clusters of TDs to fix as one workstream → appended to register", model: "opus" },
    { title: "Document",      detail: "living docs + 5 dimension files (per-doc fan-out)" },
    { title: "Plain-English", detail: "non-technical companion: batched gen + severity-grouped chunked write" },
  ],
};

// CRITICAL (M71): the Workflow runtime passes `args` as a JSON STRING, not a parsed
// object — verified by diagnostic run wf_6934cc1a-537 (typeof args === "string").
// Reading `args.projectDir` directly yields undefined → projectDir defaults to "."
// → agents scan the GSD-T package CWD instead of the target, and maxSlicesHint is
// undefined → the slice cap no-ops → runaway 150+ finder fan-out. Normalize FIRST.
const _args = (typeof args === "string")
  ? (() => { try { return JSON.parse(args); } catch (_) { return {}; } })()
  : (args || {});
const projectDir    = _args.projectDir || ".";
const scanNumber    = _args.scanNumber || null;
const verifyMode    = _args.verify || "single"; // "single" | "none"
const maxSlicesOverride = _args.maxSlicesHint || null; // optional power-user ceiling override
// M94-D6: graph wiring — "wired" (default) or "disabled" (no-graph baseline for AC-4).
// [RULE] scan-injects-structural-slice / [RULE] no-graph-baseline-proven-graph-free
const graphMode     = (_args.graphMode === "disabled") ? "disabled" : "wired";

// VOLUME-DERIVED CAP — a RUNAWAY BACKSTOP, not the target count. The probe decides
// the actual slice count by cohesive sub-domain WITHIN this cap; the cap only fires
// when the probe over-slices. EVIDENCE it's necessary: with no cap, the probe sliced
// a 5-FILE repo into ~20 slices → 44 agents (run wf_9c993376-097), and the GSD-T repo
// into 191 — the slice-definition prose alone does NOT keep it bounded (same lesson as
// M70: prose the agent can ignore isn't enforcement). So the count is structure-driven
// but HARD-capped. Calibrated as a CEILING (the probe normally lands under it):
// tiny(5 files)→3, mid(300)→10, Hilo(1809f/~1M LOC/150 routes/361 tables)→~27,
// huge(10k files)→50. _args.maxSlicesHint optionally overrides. Tune here.
function computeSliceCap(t) {
  const files      = Number(t && (t.files || t.total_files || t.source_files)) || 0;
  const loc        = Number(t && (t.loc || t.lines_of_code || t.totalLoc)) || 0;
  const routes     = Number(t && (t.routes || t.route_modules)) || 0;
  const tables     = Number(t && (t.tables || t.orm_tables)) || 0;
  const components = Number(t && t.components) || 0;
  const domains    = Number(t && (t.featureDomains || t.feature_domains)) || 0;
  const fileSignal   = Math.sqrt(files) * 0.42;
  const structSignal = domains + Math.round(routes / 70) + Math.round(tables / 200) + Math.round(components / 250);
  const locSignal    = Math.sqrt(loc) / 800;
  const raw = fileSignal * 0.7 + structSignal * 0.8 + locSignal;
  return Math.max(3, Math.min(50, Math.round(raw)));
}

// ───── Schemas (pure data — no runtime dependency) ──────────────────────────

const PREFLIGHT_SCHEMA = {
  type: "object",
  required: ["ok", "branch", "priorRegisterExists"],
  additionalProperties: false,
  properties: {
    ok:                  { type: "boolean" },
    branch:              { type: "string" },
    repoName:            { type: "string", description: "the project directory's basename (e.g. 'hilo-figma-atos') — used to suffix shared scan/doc files" },
    priorRegisterExists: { type: "boolean" },
    priorMaxTd:          { type: "integer", description: "highest TD-NNN in the prior register, 0 if none" },
    notes:               { type: "string" },
  },
};

const PROBE_SCHEMA = {
  type: "object",
  required: ["totals", "slices"],
  additionalProperties: false,
  properties: {
    totals: { type: "object", additionalProperties: true },
    slices: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["key", "paths", "dimension"],
        additionalProperties: false,
        properties: {
          key:       { type: "string" },
          paths:     { type: "array", items: { type: "string" } },
          dimension: { type: "string", enum: ["architecture", "business-rules", "security", "quality", "contracts", "feature-domain", "data-layer", "api-surface", "testing"] },
          why:       { type: "string" },
        },
      },
    },
    notes: { type: "string" },
  },
};

const FINDER_SCHEMA = {
  type: "object",
  required: ["slice", "findings"],
  additionalProperties: false,
  properties: {
    slice: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        required: ["title", "severity", "area", "files", "detail", "recommendation"],
        additionalProperties: false,
        properties: {
          title:          { type: "string" },
          severity:       { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"] },
          area:           { type: "string" },
          files:          { type: "array", items: { type: "string" } },
          detail:         { type: "string" },
          impact:         { type: "string" },
          recommendation: { type: "string" },
          confidence:     { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
    notes: { type: "string" },
  },
};

const VERIFY_SCHEMA = {
  type: "object",
  required: ["confirmed", "verdict"],
  additionalProperties: false,
  properties: {
    confirmed:         { type: "boolean" },
    verdict:           { type: "string", enum: ["confirmed", "false-positive", "needs-detail"] },
    note:              { type: "string" },
    correctedSeverity: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"] },
  },
};

// M75: synthesis no longer writes the register via one agent (the Hilo Scan #14
// synthesis stalled after 9 of 322 items typing a 466KB file). Instead: a bounded
// dedup agent (inline DEDUP_SCHEMA, small input) decides merge groups; the
// orchestrator deterministically sorts/numbers/formats the register STRING (no fs);
// a bounded write-agent does ONE Write. Each agent step is bounded → can't stall.

const DOC_RESULT_SCHEMA = {
  type: "object",
  required: ["doc", "status"],
  additionalProperties: false,
  properties: {
    doc:    { type: "string" },
    status: { type: "string", enum: ["written", "merged", "skipped", "failed"] },
    path:   { type: "string" },
    notes:  { type: "string" },
  },
};

const RENDER_SCHEMA = {
  type: "object",
  required: ["status"],
  additionalProperties: false,
  properties: {
    status:     { type: "string", enum: ["rendered", "skipped", "failed"] },
    outputPath: { type: "string" },
    notes:      { type: "string" },
  },
};

// M94-D6: Graph-wiring schemas (additive — consumed only when graphMode === "wired").
// The structural slice the D5 CLI returns; injected into scanSlice finder agents.
// [RULE] scan-injects-structural-slice / [RULE] scan-slice-consumed
const GRAPH_STATUS_SCHEMA = {
  type: "object",
  required: ["ok"],
  additionalProperties: true,
  properties: {
    ok:     { type: "boolean" },
    reason: { type: "string" },
    // ok=true fields (from graph-query-cli-contract §status verb):
    storeExists: { type: "boolean" },
    notes:       { type: "string" },
  },
};

const GRAPH_BUILD_SCHEMA = {
  type: "object",
  required: ["ok"],
  additionalProperties: true,
  properties: {
    ok:    { type: "boolean" },
    notes: { type: "string" },
  },
};

const GRAPH_SLICE_SCHEMA = {
  type: "object",
  required: ["ok"],
  additionalProperties: true,
  properties: {
    ok:       { type: "boolean" },
    reason:   { type: "string" },
    deadCode: { type: "array", items: { type: "object" }, description: "dead-code verb results" },
    dangling: { type: "array", items: { type: "object" }, description: "dangling verb results" },
    clusters: { type: "array", items: { type: "object" }, description: "cluster verb results" },
    coverage: { type: "object", description: "coverage envelope from the query" },
    notes:    { type: "string" },
  },
};

// ───── Script body — orchestration only, ZERO file I/O here ─────────────────

// M94-D6: structuralSlice — the pre-computed structural findings from the D5 CLI.
// Populated by the Graph-Wiring phase (after Probe, before Deep Scan) when graphMode==="wired".
// Null when graphMode==="disabled" (no-graph baseline) or graph-unavailable (fallback).
// [RULE] scan-injects-structural-slice / [RULE] no-graph-baseline-proven-graph-free
let structuralSlice = null;   // { deadCode, dangling, clusters, coverage, tier } | null
let graphWiringMode = "pending"; // "wired" | "fallback-announced" | "disabled"

// M94-D6: runCli — inline async helper that delegates the D5 graph-query CLI to an
// agent() Bash. M81 invariant: NO require/fs/child_process in the orchestrator body —
// the agent runs the command; we read back a SCHEMA-VALIDATED envelope.
//
// v4.13.12 HARDENING (root cause of the NiceNote 2026-06-29 silent grep-fallback):
// the old version told a HAIKU agent to "return ONLY the raw JSON line" and then
// JSON.parse()'d its free-text reply. Haiku wrapped the JSON in a ```json fence →
// JSON.parse threw → caught → graph-unavailable → grep-mode, even though the graph
// was live (status returned ok, 156 files, compiler-accurate). Three fixes, mirroring
// the proven gsd-t-verify.workflow.js runCli:
//   1. SCHEMA-validated agent output (StructuredOutput) — the model returns structured
//      JSON via the tool layer, never fenced text; no brittle JSON.parse of prose.
//   2. project-local bin → GLOBAL `gsd-t` fallback (a project without a local bin copy
//      no longer fails the probe — it was hardcoded to `node bin/...cjs`).
//   3. stderr captured (dropped `2>/dev/null`) and surfaced in `reason` so the fallback
//      log can say WHY (parse-fail vs not-found vs CLI-error), never a bare "unavailable".
// [RULE] no-graph-baseline-proven-graph-free — called ONLY when graphMode==="wired".
// [RULE] graph-probe-schema-validated-never-fence-parsed
const _GRAPH_CLI_ENVELOPE_SCHEMA = {
  type: "object",
  required: ["ok"],
  additionalProperties: true,
  properties: {
    ok:       { type: "boolean", description: "true iff the CLI printed a JSON envelope with ok:true" },
    reason:   { type: "string",  description: "on failure: graph-unavailable / cli-not-found / cli-error / non-json-output, plus any stderr" },
    via:      { type: "string",  description: "local | global | error" },
    results:  { type: "array", items: {}, description: "the verb's results array (dead-code/dangling/cluster/etc.), [] if none" },
    tier:     { type: "string",  description: "compiler-accurate | tree-sitter-floor | ... when present" },
    coverage: {                   description: "coverage envelope when the verb returns one" },
  },
};
async function runCli(verb, target, label) {
  const targetArg = target ? ` '${String(target).replace(/'/g, "'\\''")}'` : "";
  const prompt = [
    `Run the GSD-T graph-query CLI for the project at \`${projectDir}\` and report its result. Steps:`,
    `1. If \`${projectDir}/bin/gsd-t-graph-query-cli.cjs\` exists, run: \`node ${projectDir}/bin/gsd-t-graph-query-cli.cjs ${verb}${targetArg}\` (set via="local"). Otherwise run: \`gsd-t graph ${verb}${targetArg}\` (set via="global"). Use cwd \`${projectDir}\`. Do NOT redirect stderr — capture it.`,
    `2. The command prints ONE JSON envelope to stdout. Parse it. Set ok = (the parsed envelope's "ok" field === true). Copy its "results", "tier", and "coverage" fields through if present.`,
    `3. If the command exits non-zero, prints no JSON, or stdout is not valid JSON: set ok=false and put a short reason in "reason" — "cli-not-found" if the file/binary was missing, else "cli-error", else "non-json-output" — and append the first ~200 chars of stderr.`,
    `Do NOT do any other work. ONLY run this one command and report the structured result.`,
  ].join("\n");
  const r = await agent(prompt, {
    label: `graph:${label || verb}`,
    phase: "Graph-Wiring",
    model: "haiku",
    schema: _GRAPH_CLI_ENVELOPE_SCHEMA,
  }).catch((e) => ({ ok: false, reason: `agent-error: ${e && e.message}`, via: "error" }));
  return r || { ok: false, reason: "graph-unavailable", via: "error" };
}

// Build the graph index (`gsd-t graph index`) when it is absent. The wired path
// is documented "build index if absent, then query" but the BUILD step was never
// wired — so on any project without a pre-built index (the common case), scan
// silently grep-fell-back and the graph was NEVER used (observed on hilo-figma-atos
// 2026-06-30: a 30M-token scan grep-fell-back because the index was never built).
// `graph index` is a longer command than the verb queries → bigger timeout.
// [RULE] scan-builds-index-when-absent
async function runCliBuild() {
  const prompt = [
    `Build the GSD-T code-graph index for the project at \`${projectDir}\`, then report. Steps:`,
    `1. If \`${projectDir}/bin/gsd-t.js\` exists, run: \`node ${projectDir}/bin/gsd-t.js graph index\` (via="local"). Otherwise run: \`gsd-t graph index\` (via="global"). Use cwd \`${projectDir}\`. This may take up to a few minutes on a large repo — wait for it to finish. Do NOT redirect stderr.`,
    `2. Set ok=true if the command exits 0 (the index built). Set ok=false with a short reason + first ~200 chars of stderr otherwise.`,
    `Do NOT do any other work. ONLY run this one build command and report the structured result.`,
  ].join("\n");
  const r = await agent(prompt, {
    label: "graph:index-build",
    phase: "Graph-Wiring",
    model: "haiku",
    schema: GRAPH_BUILD_SCHEMA,
  }).catch((e) => ({ ok: false, reason: `agent-error: ${e && e.message}` }));
  return r || { ok: false, reason: "build-failed" };
}

// Broken-Graph-Halts (EXEMPT carve-out): scan continues in announced grep-mode when the
// graph is unavailable, but it MUST DISTINGUISH absent from broken. On ABSENT it builds
// once (below); on BROKEN it must name BROKEN loudly, not treat it as merely un-indexed.
// Routes the reason through the ONE shared classifier via Bash.
// [RULE] one-availability-classifier [RULE] unknown-reason-fails-closed-to-broken
async function classifyGraphFailure(reason, detail) {
  const r = await agent(
    [
      `Classify a GSD-T graph-availability failure for the project at \`${projectDir}\`. Steps:`,
      `1. If \`${projectDir}/bin/gsd-t-graph-availability.cjs\` exists, run: \`node ${projectDir}/bin/gsd-t-graph-availability.cjs classify '${String(reason || "").replace(/'/g, "'\\''")}' '${String(detail || "").replace(/'/g, "'\\''")}'\` (via="local"). Otherwise run: \`gsd-t graph-availability classify '${String(reason || "")}' '${String(detail || "")}'\` (via="global"). cwd \`${projectDir}\`.`,
      `2. The command prints ONE JSON envelope with a "state" field ("ABSENT" or "BROKEN"). Copy "state" up to the top level of your reply.`,
      `Do NOT do any other work.`,
    ].join("\n"),
    { label: "graph:classify", phase: "Graph-Wiring", model: "haiku", schema: { type: "object", required: ["state"], additionalProperties: true, properties: { state: { type: "string" } } } }
  ).catch(() => null);
  return (r && (r.state === "ABSENT" || r.state === "BROKEN")) ? r.state : "BROKEN";
}

// M99 D2: persist a kind:'wiring' ledger line for this workflow.
// M81 sandbox: all I/O through agent() Bash; no require/fs in the sandbox.
// Uses the `gsd-t graph wiring-log` CLI shim (avoids embedding require() in strings).
// [RULE] wiring-mode-three-states / [RULE] consumer-label-from-context-not-setenv
async function persistWiringMode(mode) {
  const consumer = "scan";
  await agent(
    [
      `Persist one graph-wiring-mode ledger line for the scan workflow.`,
      `Run: \`gsd-t graph wiring-log --consumer ${consumer} --mode ${mode} --project '${projectDir}'\``,
      `If the command is not found, exit 0 (ledger write is optional).`,
      `Return ONLY: {"ok": true} or {"ok": false, "reason": "<short reason>"}.`,
    ].join("\n"),
    { label: "scan:wiring-ledger", phase: "Graph-Wiring", model: "haiku", schema: { type: "object", required: ["ok"], properties: { ok: { type: "boolean" }, reason: { type: "string" } } } }
  ).catch(() => null); // fail-open
}

// Preflight: an agent checks branch + whether a prior register exists, via Bash.
// (No fs in the body — that was the bug.)
phase("Preflight");
const pre = await agent(
  [
    `You are the preflight check for a GSD-T deep scan of the project at \`${projectDir}\`.`,
    `Using Bash/Read tools, determine:`,
    `1. The current git branch (\`git -C ${projectDir} rev-parse --abbrev-ref HEAD\`; if not a git repo, report branch "(no-git)").`,
    `2. The repo name = the basename of the resolved project dir (\`basename "$(cd ${projectDir} && pwd)"\`) — e.g. "hilo-figma-atos". Report as repoName (used to label the team-shared share/ copies).`,
    `3. Whether \`${projectDir}/.gsd-t/techdebt.md\` exists (priorRegisterExists).`,
    `4. If it exists, the HIGHEST TD-NNN number in it (grep \`### TD-\`, parse the max integer; priorMaxTd). If absent, priorMaxTd=0.`,
    `Set ok=true unless something makes scanning impossible (e.g. projectDir does not exist). Return JSON per the schema.`,
  ].join("\n"),
  { label: "preflight", phase: "Preflight", schema: PREFLIGHT_SCHEMA, model: "haiku" }
);
if (!pre || !pre.ok) {
  log(`preflight failed — halting. notes: ${pre && pre.notes}`);
  return { status: "failed", reason: "preflight-failed", preflight: pre };
}
const tdStart = (pre.priorRegisterExists ? (pre.priorMaxTd || 0) : 0) + 1;
// #47: repo-name suffix for the TEAM-SHARED copies only. INTERNAL files keep their
// fixed names (.gsd-t/techdebt.md, .gsd-t/scan/<dim>.md, docs/*.md) so all internal
// tooling (promote-debt, gap-analysis, complete-milestone, …) keeps working — zero
// blast radius. The repo suffix appears ONLY on the share/ exports at the end.
const repoName = (pre.repoName && /^[A-Za-z0-9._-]+$/.test(pre.repoName)) ? pre.repoName : "project";
log(`preflight ok — branch=${pre.branch}, repo=${repoName}, priorRegister=${pre.priorRegisterExists}, TD numbering starts at TD-${tdStart}`);

// Volume probe — an agent measures the codebase (its own Bash) and carves slices.
phase("Probe");
const probe = await agent(
  [
    `⛔ TARGET DIRECTORY IS FIXED: you MUST scan ONLY the project at the absolute path \`${projectDir}\`. Before any measurement, \`cd ${projectDir}\` (or pass that exact path to every Read/Grep/Bash). Do NOT scan your current working directory, the GSD-T package, or any other tree — every file you measure and every slice path you emit MUST be under \`${projectDir}\`. If \`${projectDir}\` does not exist or is empty, return a single slice noting that.`,
    ``,
    `You are the VOLUME PROBE for a GSD-T deep scan. Measure the codebase (Bash/Grep/Read), then decompose it into SLICES.`,
    ``,
    `WHAT A SLICE IS: one COHESIVE SUB-DOMAIN or RESPONSIBILITY — a logical section of the code, like a domain but SMALLER. Finer than a domain, coarser than a single file. Examples: "invoice generation", "Stripe webhook handling", "refund/void logic", "tenant-scoping enforcement", "the work-order state machine", "scheduling conflict detection", "the auth/session layer". Each slice is something a developer would name as a distinct concern, and small enough that ONE agent can read EVERY file in it and reason about it as a coherent whole.`,
    ``,
    `HOW TO DECOMPOSE (structure leads, not a number):`,
    `1. Find the logical seams — walk the actual structure (dirs, modules, services, feature areas, route groups, schema groupings) and identify cohesive units of responsibility. Think the way you'd list a system's sub-domains.`,
    `2. Size-check each unit — if a logical section is too big for one agent to read exhaustively (e.g. a giant component tree, a monolithic schema with hundreds of tables, a sprawling service), SUBDIVIDE it into smaller cohesive sub-sections until each fits one agent.`,
    `3. The slice COUNT falls out of this — you produce as many slices as the code has cohesive, agent-sized sections. Do NOT target a number; do NOT split by raw file boundaries; do NOT make one slice per file/per module. A small repo naturally yields few slices; a large multi-domain app yields more.`,
    ``,
    `Each slice: a \`key\` (kebab name of the responsibility, e.g. "invoice-generation"), concrete \`paths\` it owns (under \`${projectDir}\`), a \`dimension\`, and \`why\` (what makes it one cohesive concern).`,
    ``,
    `Decompose HONESTLY by cohesive responsibility: not so coarse that an agent can't read its whole slice, not so fine that you emit one slice per file. A well-decomposed system has a finite, sensible number of real responsibilities — find them. (A volume-derived backstop cap is enforced after you return ONLY to catch over-slicing; a clean sub-domain decomposition lands under it. Report accurate \`totals\` — they set the backstop. If your count is truncated, you sliced too finely.)`,
    ``,
    `Measure with real tooling and report in \`totals\`: files, loc, routes, tables, components, featureDomains (distinct business/feature areas). Read \`${projectDir}/package.json\` for the stack. Return JSON per the schema: totals + slices.`,
  ].join("\n"),
  { label: "volume-probe", phase: "Probe", schema: PROBE_SCHEMA, model: "sonnet" }
);
const rawSlices = (probe && Array.isArray(probe.slices) && probe.slices) || [];
if (!rawSlices.length) {
  log("probe returned no slices — halting");
  return { status: "failed", reason: "no-slices", probe };
}
// Volume-derived cap as a runaway backstop (the probe over-slices without it).
const computedCap = computeSliceCap(probe.totals || {});
const sliceCap = maxSlicesOverride || computedCap;
let slices = rawSlices;
if (rawSlices.length > sliceCap) {
  slices = rawSlices.slice(0, sliceCap);
  log(`⚠ SLICE CAP ENFORCED: probe returned ${rawSlices.length} cohesive slices; volume-derived backstop=${computedCap}${maxSlicesOverride ? ` (override ${maxSlicesOverride})` : ""}. Truncated to ${sliceCap} to bound the agent fan-out. Dropped ${rawSlices.length - sliceCap}: ${rawSlices.slice(sliceCap).map((s) => s.key).join(", ")}. (Probe over-sliced — it should group by cohesive sub-domain, not per file/module.)`);
}
log(`probe derived ${rawSlices.length} slice(s); backstop cap=${computedCap}; running ${slices.length} deep-finder(s); totals=${JSON.stringify(probe.totals)}`);

// M94-D6: Graph-Wiring phase — ADDITIVE injection of the pre-computed structural slice.
// Current scan architecture is KEPT FULLY INTACT (Destructive Action Guard).
// [RULE] scan-injects-structural-slice / [RULE] no-graph-baseline-proven-graph-free
phase("Graph-Wiring");
if (graphMode === "disabled") {
  // No-graph baseline mode (AC-4 INSIGHT-delta measurement).
  // ZERO graph calls in this path — [RULE] no-graph-baseline-proven-graph-free.
  graphWiringMode = "disabled";
  log("graph-wiring: DISABLED (no-graph baseline mode — graph-query call-count == 0; AC-4 baseline)");
  await persistWiringMode("disabled"); // M99 D2: persist wiring mode [RULE] wiring-mode-three-states
} else {
  // graphMode === "wired": build index if absent, then query structural slice.
  // Step 1: check if index exists and is queryable.
  let statusResult = await runCli("status", null, "status");
  // Step 1b: if the index is absent/unqueryable, BUILD it once, then re-probe.
  // This is the previously-missing build step — without it scan grep-fell-back on
  // every project lacking a pre-built index (hilo-figma-atos 2026-06-30).
  // [RULE] scan-builds-index-when-absent
  if (!statusResult || !statusResult.ok) {
    // [RULE] one-availability-classifier — distinguish ABSENT (build once) from BROKEN (name it).
    const _reason = (statusResult && statusResult.reason) || "graph-broken";
    const _state = await classifyGraphFailure(_reason, statusResult && statusResult.detail);
    if (_state === "ABSENT") {
      // [RULE] absent-graph-auto-builds-once / [RULE] scan-builds-index-when-absent
      log(`graph-wiring: index ABSENT (${_reason}) — building it now (gsd-t graph index)...`);
      const buildResult = await runCliBuild();
      if (buildResult && buildResult.ok) {
        log(`graph-wiring: index build OK — re-probing status.`);
        statusResult = await runCli("status", null, "status");
      } else {
        log(`graph-wiring: index build FAILED [${(buildResult && buildResult.reason) || "build-failed"}] — graph now BROKEN (build infra failing).`);
      }
    } else {
      // BROKEN — do NOT waste a build; name it loudly (announced carve-out continues grep-mode).
      log(`graph-wiring: graph BROKEN (${_reason}) — NOT merely un-indexed; a build won't fix it. Fix it: gsd-t graph status.`);
    }
  }
  if (!statusResult || !statusResult.ok) {
    // Graph still unavailable — classify for an honest ABSENT-vs-BROKEN message, then
    // announce fallback and continue with intact grep-mode scan (exempt carve-out).
    // [RULE] parser-fail-disables-loud-never-silent [RULE] broken-graph-halts-never-greps (carve-out: name BROKEN loudly)
    graphWiringMode = "fallback-announced";
    const _finReason = (statusResult && statusResult.reason) || "graph-broken";
    const _finState = await classifyGraphFailure(_finReason, statusResult && statusResult.detail);
    log(`⚠ GRAPH-FALLBACK (ANNOUNCED): graph ${_finState} [reason=${_finReason}, via=${(statusResult && statusResult.via) || "?"}] — scan continues in full grep-mode (today's architecture, intact). Structural findings from LLM reconstruction only.${_finState === "BROKEN" ? " NOTE: graph is BROKEN, not merely absent — fix it (gsd-t graph status)." : ""}`);
    await persistWiringMode("fallback-announced"); // M99 D2 [RULE] wiring-mode-three-states
  } else {
    // Step 2: query the structural slice (dead-code + dangling + clusters).
    // These are the findings the deep-finders currently reconstruct by reading files (error-prone);
    // the graph hands them over pre-computed and ACCURATE.
    const [deadCodeResult, danglingResult, clusterResult] = await parallel([
      () => runCli("dead-code", null, "dead-code"),
      () => runCli("dangling",  null, "dangling"),
      () => runCli("cluster",   null, "cluster"),
    ]);

    const allOk = (deadCodeResult && deadCodeResult.ok) ||
                  (danglingResult && danglingResult.ok) ||
                  (clusterResult  && clusterResult.ok);

    if (!allOk) {
      // All three verbs returned graph-unavailable — announce fallback.
      graphWiringMode = "fallback-announced";
      log(`⚠ GRAPH-FALLBACK (ANNOUNCED): all structural-slice queries returned graph-unavailable — scan continues in full grep-mode. Dead-code / dangling / cluster findings from LLM reconstruction only.`);
      await persistWiringMode("fallback-announced"); // M99 D2 [RULE] wiring-mode-three-states
    } else {
      // Structural slice assembled — will be injected into scanSlice finder agents.
      structuralSlice = {
        deadCode: (deadCodeResult && deadCodeResult.ok && deadCodeResult.results) || [],
        dangling: (danglingResult && danglingResult.ok && danglingResult.results) || [],
        clusters: (clusterResult  && clusterResult.ok  && clusterResult.results)  || [],
        // Coverage envelopes: any incomplete coverage is surfaced to finders.
        coverage: {
          deadCode: (deadCodeResult && deadCodeResult.coverage) || null,
          dangling: (danglingResult && danglingResult.coverage) || null,
          cluster:  (clusterResult  && clusterResult.coverage)  || null,
        },
        tier: (deadCodeResult && deadCodeResult.tier) || (danglingResult && danglingResult.tier) || "unknown",
      };
      // M99 Red Team fix: emit "WIRED" (uppercase) to MATCH the --auto router
      // producers (bin/gsd-t.js:3915) AND the rollup's comparison
      // (gsd-t-graph-metrics-rollup.cjs:333 `=== "WIRED"`). Lowercase "wired" here
      // fell through all three rollup branches → a successfully-wired scan reported
      // WIRED:0, defeating success criterion 13 (the metric M99 exists to surface).
      // [RULE] wiring-mode-casing-matches-rollup
      graphWiringMode = "WIRED";
      log(`graph-wiring: WIRED — structural slice ready (dead-code: ${structuralSlice.deadCode.length} candidates, dangling: ${structuralSlice.dangling.length} edges, clusters: ${structuralSlice.clusters.length} groups, tier: ${structuralSlice.tier}). Slice will be INJECTED ADDITIVELY into scanSlice deep-finders. [RULE] scan-injects-structural-slice`);
      await persistWiringMode("WIRED"); // M99 D2 [RULE] wiring-mode-three-states / wiring-mode-casing-matches-rollup
    }
  }
}

const deep = budget && budget.total && budget.total > 300000 ? "MAXIMUM" : "thorough";

// Deep scan — pipeline: per-slice deep finder → single verify (no barrier).
phase("Deep Scan");

// M72: a finder that returns no schema-valid output (runtime nudged it twice then
// dropped it) must NOT be silently treated as a clean slice — that presents PARTIAL
// coverage as complete (7/19 slices dropped this way on the Hilo run). So: (1) the
// finder call is RETRIED once on a null/invalid result; (2) a slice that still fails
// is flagged `failed:true` and tracked — never conflated with a genuinely-empty slice.
//
// M94-D6: finderPrompt accepts an optional graphSliceContext string — the pre-computed
// structural slice from the D5 CLI, INJECTED ADDITIVELY so the finder reasons over
// accurate, deterministic structure rather than LLM-reconstructing relationships by reading.
// [RULE] scan-injects-structural-slice / [RULE] scan-slice-consumed
function finderPrompt(slice, graphSliceContext) {
  return [
    `⛔ Scan ONLY files under the absolute project path \`${projectDir}\`. \`cd ${projectDir}\` first; never read outside this tree.`,
    `You are a DEEP tech-debt finder for ONE slice of a scan of \`${projectDir}\`: \`${slice.key}\` (dimension: ${slice.dimension}).`,
    `Owned paths (relative to \`${projectDir}\`): ${JSON.stringify(slice.paths)}.`,
    slice.why ? `Why this slice matters: ${slice.why}` : ``,
    ``,
    // M94-D6: graph structural slice — ADDITIVE injection block.
    // Present only when graphMode==="wired" AND the slice was fetched.
    // The finder MUST use this data to answer structural questions — do NOT re-read
    // the graph from files (that is error-prone reconstruction; this is accurate).
    // [RULE] scan-injects-structural-slice / [RULE] scan-slice-consumed
    graphSliceContext ? [
      `## Pre-computed Structural Slice (GRAPH-WIRED — use this for structural findings)`,
      ``,
      `The following structural data has been PRE-COMPUTED from the deterministic dependency graph`,
      `(D5 query CLI — ${graphSliceContext.tier || "unknown"} tier). Use this data DIRECTLY for dead-code,`,
      `cycle, dangling-reference, and coupling findings — do NOT reconstruct these from file reads`,
      `(the graph is more accurate). This is ADDITIVE: you still read files for in-file logic defects.`,
      ``,
      `**Dead-code candidates** (functions/files with no inbound edges from the graph):`,
      graphSliceContext.deadCode && graphSliceContext.deadCode.length > 0
        ? "```json\n" + JSON.stringify(graphSliceContext.deadCode.slice(0, 50), null, 1) + "\n```"
        : "(none — all indexed symbols have inbound edges, OR the index has incomplete coverage)",
      graphSliceContext.coverage && graphSliceContext.coverage.deadCode && graphSliceContext.coverage.deadCode.complete === false
        ? `⚠ Dead-code coverage incomplete (${graphSliceContext.coverage.deadCode.unparsedContributors || "?"} file(s) unparsed — result may be partial).`
        : "",
      ``,
      `**Dangling references** (call/import edges to missing nodes — delete/rename residue):`,
      graphSliceContext.dangling && graphSliceContext.dangling.length > 0
        ? "```json\n" + JSON.stringify(graphSliceContext.dangling.slice(0, 30), null, 1) + "\n```"
        : "(none found)",
      ``,
      `**Tightly-coupled file clusters** (may indicate coupling/cycle debt):`,
      graphSliceContext.clusters && graphSliceContext.clusters.length > 0
        ? "```json\n" + JSON.stringify(graphSliceContext.clusters.slice(0, 20), null, 1) + "\n```"
        : "(none found — no file groups above the coupling threshold)",
      ``,
      `When you report a dead-code / dangling / coupling finding, CITE the graph data above`,
      `(e.g. "funcId: X has no inbound call edges per the graph") so the finding is traceable`,
      `to the pre-computed query result. [RULE] scan-insight-delta-graph-attributed`,
    ].filter(Boolean).join("\n") : "",
    ``,
    `MANDATE: ENUMERATE, do NOT sample. Read EVERY file under your owned paths (use Read/Grep). You own only this slice, so go to the bottom of it.`,
    `Depth = ${deep}. "thorough" = every file, every non-trivial real defect (high+medium confidence). "MAXIMUM" = also lower-confidence/speculative items worth review.`,
    `Surface: bugs, security holes, missing validation, broken invariants, race conditions, dead/duplicated code, N+1s, untested critical paths, contract drift, domain-specific correctness (money math, state-machine gaps, timezone bugs, idempotency holes).`,
    `For each finding: title, severity (CRITICAL/HIGH/MEDIUM/LOW), human area label, concrete file:line refs, detail, impact, remediation, honest confidence. If a substantial slice yields only 1-2 findings, re-check before concluding it's clean. Empty findings array ONLY if genuinely clean.`,
    `CRITICAL: you MUST return a JSON object matching the schema (slice + findings array) as your FINAL output — even if findings is empty. Do not end without the structured result.`,
  ].filter(Boolean).join("\n");
}
// M73: GLOBAL CONCURRENCY GATE (shared-worker-pool model). The v4.0.19 Hilo run
// fanned out 29 finders + their verifiers ALL AT ONCE → ~58 concurrent Sonnet agents
// → server-side API rate limit → all errored empty → 0 findings. Rather than batch
// per-slice (which leaves slots idle while a slice serializes its verifies), use ONE
// global semaphore of MAX_CONCURRENT permits that EVERY agent call (finder OR verify,
// from any slice) must acquire. Work fans out naturally; the gate alone enforces the
// cap. The instant any agent finishes, the next queued one starts → always ≈10 in
// flight while work remains = max throughput at a safe ceiling. (All gated agents are
// Sonnet; the lone Opus synthesis runs after, ungated.)
const MAX_CONCURRENT = 10;

// Minimal counting semaphore: acquire() resolves when a permit is free; release()
// hands the permit to the next waiter (FIFO).
// M74: ADAPTIVE semaphore — the ceiling can shrink (on a rate limit) and recover.
// `inUse` = permits currently held; a permit is grantable only while inUse < ceiling.
// Lowering the ceiling doesn't yank in-flight permits; it just stops granting new
// ones until enough release that inUse drops below the new ceiling.
const MIN_CONCURRENT = 4; // never throttle below this — keeps the run moving
function makeAdaptiveSemaphore(initial) {
  let ceiling = initial;
  let inUse = 0;
  const waiters = [];
  function pump() {
    while (inUse < ceiling && waiters.length) { inUse++; waiters.shift()(); }
  }
  return {
    async acquire() {
      if (inUse < ceiling) { inUse++; return; }
      await new Promise((res) => waiters.push(res)); // pump() increments inUse on grant
    },
    release() { inUse--; pump(); },
    lower() { // shrink ceiling by 1 on a rate limit (floor at MIN_CONCURRENT)
      if (ceiling > MIN_CONCURRENT) { ceiling--; return true; }
      return false;
    },
    raise() { // gentle recovery toward the initial ceiling after sustained success
      if (ceiling < initial) { ceiling++; pump(); return true; }
      return false;
    },
    get ceiling() { return ceiling; },
  };
}
const gate = makeAdaptiveSemaphore(MAX_CONCURRENT);

function isRateLimit(err) {
  const s = String((err && (err.message || err)) || "").toLowerCase();
  return /rate.?limit|temporarily limiting|429|overloaded|too many requests|capacity/.test(s);
}

// M74: gatedAgent now reacts to rate limits in REAL TIME — on a rate-limit error it
// lowers the global ceiling (10→9→8…, floor MIN_CONCURRENT), backs off, and retries
// the SAME agent (up to a few times) instead of letting it fail. After a streak of
// clean completions it nudges the ceiling back up. This means a transient rate limit
// throttles the run down automatically rather than failing it (the v4.0.19 wipeout).
let _cleanStreak = 0;
async function gatedAgent(prompt, opts) {
  await gate.acquire();
  try {
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const r = await agent(prompt, opts);
        // success: nudge the ceiling back up after every 8 clean completions.
        if (++_cleanStreak >= 8) { _cleanStreak = 0; if (gate.raise()) log(`↑ throttle recovered to ${gate.ceiling} concurrent (clean streak)`); }
        return r;
      } catch (e) {
        if (isRateLimit(e) && attempt < 4) {
          _cleanStreak = 0;
          const lowered = gate.lower();
          const backoffMs = 2000 * attempt; // 2s, 4s, 6s
          log(`⚠ rate limit hit — ${lowered ? `throttling down to ${gate.ceiling} concurrent` : `already at floor ${gate.ceiling}`}; backing off ${backoffMs}ms then retry ${attempt + 1}/4 (${(opts && opts.label) || "agent"})`);
          await sleep(backoffMs);
          continue;
        }
        throw e; // non-rate-limit error, or out of retries → bubble up
      }
    }
  } finally {
    gate.release();
  }
}
// Backoff sleep. setTimeout is available in the Workflow sandbox (verified by a
// real sandbox probe, run wf_7e90a974 — NOT assumed; Date.now/Math.random ARE banned
// but setTimeout is not). Used only for rate-limit backoff between retries.
function sleep(ms) { return new Promise((res) => setTimeout(res, ms)); }

async function runFinder(slice, graphSliceContext) {
  // up to 2 attempts; a null/invalid (non-array findings) result counts as a drop.
  // M94-D6: graphSliceContext passed through to finderPrompt for ADDITIVE injection.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await gatedAgent(finderPrompt(slice, graphSliceContext), {
        label: attempt === 1 ? `find:${slice.key}` : `find:${slice.key} (retry)`,
        phase: "Deep Scan", schema: FINDER_SCHEMA, model: "sonnet",
      });
      if (r && Array.isArray(r.findings)) return r; // valid (incl. empty)
      log(`⚠ finder slice "${slice.key}" attempt ${attempt} returned no valid output${attempt < 2 ? " — retrying" : ""}`);
    } catch (e) {
      log(`⚠ finder slice "${slice.key}" attempt ${attempt} threw: ${e && e.message}${attempt < 2 ? " — retrying" : ""}`);
    }
  }
  return null; // both attempts failed → dropped slice
}

async function scanSlice(slice) {
  const sliceKey = slice.key || "unknown-slice";
  // M94-D6: inject the structural slice context ADDITIVELY — only when graph is wired.
  // When graphMode==="disabled" OR graph-unavailable, graphSliceContext is null (no injection).
  // [RULE] scan-injects-structural-slice / [RULE] no-graph-baseline-proven-graph-free
  const graphSliceContext = (graphWiringMode === "wired" && structuralSlice) ? structuralSlice : null;
  const finderResult = await runFinder(slice, graphSliceContext);
  // M72: distinguish a FAILED finder (null after retries) from a genuinely-clean slice.
  if (!finderResult || !Array.isArray(finderResult.findings)) {
    return { slice: sliceKey, findings: [], failed: true };
  }
  if (verifyMode === "none" || finderResult.findings.length === 0) {
    return { slice: sliceKey, findings: finderResult.findings || [], failed: false };
  }
  // Fan out ALL verifies for this slice — the global gate (not a per-slice limit)
  // bounds total in-flight, so this is safe AND keeps every worker slot busy.
  const verified = await parallel(
    finderResult.findings.map((f) => async () => {
      try {
        const v = await gatedAgent(
          [
            `You are a VERIFIER for one tech-debt finding in \`${projectDir}\`. Confirm it against the ACTUAL code (open the referenced files with Read) — do not trust the finder.`,
            `Finding: ${JSON.stringify(f)}`,
            `confirmed=true only if the defect genuinely exists. If misread → verdict="false-positive". If real but wrong severity → set correctedSeverity. If real but underspecified → verdict="needs-detail" (kept). Return JSON per the schema.`,
          ].join("\n"),
          { label: `verify:${sliceKey}`, phase: "Deep Scan", schema: VERIFY_SCHEMA, model: "sonnet" }
        );
        if (!v || v.verdict === "false-positive" || v.confirmed === false) return null;
        return { ...f, severity: v.correctedSeverity || f.severity, _verify: v.verdict };
      } catch (e) {
        return { ...f, _verify: "verify-errored" };
      }
    })
  );
  return { slice: sliceKey, findings: verified.filter(Boolean), failed: false };
}

// Fan out ALL slices at once — every finder + verify acquires the shared gate, so
// total in-flight never exceeds MAX_CONCURRENT regardless of slice/finding counts.
log(`deep scan: ${slices.length} slices via a shared ${MAX_CONCURRENT}-permit gate (Sonnet finders+verifiers; max throughput at a safe ceiling)`);
const sliceResults = await parallel(slices.map((slice) => () => scanSlice(slice)));

// M72: coverage accounting — a dropped pipeline result (null) OR a failed:true slice
// is a COVERAGE GAP. Surface it deterministically; never present partial as complete.
const resultsByIndex = sliceResults; // pipeline preserves order
const failedSlices = [];
slices.forEach((s, i) => {
  const r = resultsByIndex[i];
  if (!r || r.failed) failedSlices.push(s.key);
});
const succeededCount = slices.length - failedSlices.length;
const coverageComplete = failedSlices.length === 0;
const allFindings = sliceResults.filter(Boolean).filter((r) => !r.failed).flatMap((r) => (r.findings || []).map((f) => ({ ...f, slice: r.slice })));
if (!coverageComplete) {
  log(`⚠ PARTIAL COVERAGE — ${failedSlices.length}/${slices.length} slices failed after retry and produced NO findings: ${failedSlices.join(", ")}. The register will be flagged INCOMPLETE. Resume the run to re-scan only the failed slices.`);
}
log(`deep scan complete: ${allFindings.length} verified findings across ${succeededCount}/${slices.length} slices${coverageComplete ? " (full coverage)" : " (PARTIAL)"}`);

// Synthesis (M75 redesign). The Hilo Scan #14 failure: one agent asked to dedup +
// rank + WRITE a 322-item / 466KB register stalled after 9 items (turn/output budget).
// Fix: split judgment from writing, and do all the heavy lifting DETERMINISTICALLY.
//   (a) The orchestrator already HAS allFindings as data — it sorts by severity and
//       assigns sequential TD numbers itself (no agent needed for that).
//   (b) Dedup is the only real judgment-add; a bounded agent does ONLY dedup over a
//       compact title+location list (small input) and returns merge groups.
//   (c) The orchestrator formats the full markdown as a STRING (no fs, no agent).
//   (d) A dedicated archive-agent renames the prior register (one mv); a dedicated
//       write-agent does ONE Write of the formatted string. Each is bounded → can't
//       stall regardless of register size.
phase("Synthesis");

// (b) Dedup pass — small input (title|severity|first-location per finding), so the
// agent never holds the full register. It returns groups of indices that are the
// same underlying issue. Best-effort: on failure we proceed with no dedup.
const dedupList = allFindings.map((f, i) => `${i}: [${f.severity}] ${f.title} @ ${(f.files && f.files[0]) || "?"}`).join("\n");
let mergeGroups = [];
if (allFindings.length > 1) {
  const DEDUP_SCHEMA = {
    type: "object", required: ["groups"], additionalProperties: false,
    properties: { groups: { type: "array", items: { type: "array", items: { type: "integer" } } }, notes: { type: "string" } },
  };
  try {
    const d = await agent(
      [
        `You are DEDUPLICATING tech-debt findings from a multi-slice scan. Below are ${allFindings.length} findings as "index: [SEVERITY] title @ location".`,
        `Different slices sometimes surface the SAME underlying issue. Return "groups": arrays of indices that are the SAME root issue (only group true duplicates — same defect, not merely similar). Singletons need not be listed. If nothing is a duplicate, return groups: [].`,
        ``,
        dedupList.slice(0, 120000),
      ].join("\n"),
      { label: "synthesis:dedup", phase: "Synthesis", schema: DEDUP_SCHEMA, model: "opus" }
    );
    mergeGroups = (d && Array.isArray(d.groups)) ? d.groups : [];
  } catch (e) {
    log(`dedup pass failed (non-fatal — proceeding with no dedup): ${e && e.message}`);
  }
}

// (a)+(c) Deterministically merge dups, sort by severity, assign TD numbers, format.
const SEV_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const dropped = new Set();
const merged = [];
for (const group of mergeGroups) {
  const idxs = group.filter((i) => Number.isInteger(i) && i >= 0 && i < allFindings.length && !dropped.has(i));
  if (idxs.length < 2) continue;
  const keep = { ...allFindings[idxs[0]] };
  keep.files = [...new Set(idxs.flatMap((i) => allFindings[i].files || []))];
  keep.slice = [...new Set(idxs.map((i) => allFindings[i].slice).filter(Boolean))].join(", ");
  idxs.forEach((i) => dropped.add(i));
  merged.push(keep);
}
const finalFindings = [
  ...merged,
  ...allFindings.map((f, i) => (dropped.has(i) ? null : f)).filter(Boolean).filter((f) => !merged.includes(f)),
];
finalFindings.sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9));
const counts = { critical: 0, high: 0, medium: 0, low: 0 };
for (const f of finalFindings) {
  if (f.severity === "CRITICAL") counts.critical++;
  else if (f.severity === "HIGH") counts.high++;
  else if (f.severity === "MEDIUM") counts.medium++;
  else if (f.severity === "LOW") counts.low++;
}
counts.total = finalFindings.length;


// M75 chunked formatter: returns an ARRAY of markdown chunks, each ≤ ~30KB, so each
// can be written through one bounded agent prompt WITHOUT truncation (a single write
// of a 466KB register truncates at ~165KB — verified). Chunk 0 is the header+summary
// (Write/create); the rest are appends. Items are grouped so a chunk never splits an
// item, and the severity-section heading rides with its first item's chunk.
// M76 (revised): the mojibake culprit was EM-DASHES (—) and smart quotes, NOT the
// severity color bullets (🔴🟠🟡🟢) — those render fine and are intentional/wanted.
// So ascii() normalizes em/en-dashes, smart quotes, and ellipsis (and tidies trailing
// whitespace), but KEEPS emoji. It's applied to finder-supplied free-text fields so a
// stray dash in a description doesn't mojibake; the severity bullets live in the
// template below and are preserved.
function ascii(s) {
  return String(s == null ? "" : s)
    .replace(/[—–]/g, "-")        // em/en dash -> hyphen (the actual mojibake cause)
    .replace(/[‘’]/g, "'")        // smart single quotes
    .replace(/[“”]/g, '"')        // smart double quotes
    .replace(/…/g, "...")              // ellipsis
    .replace(/[ \t]+\n/g, "\n");            // tidy trailing whitespace
}

// Register ordering — SINGLE source of truth so the formatter's TD-numbering and the
// consolidation stage's TD references stay identical. Within each severity, findings
// are sub-grouped by TYPE (derived from `area`). typeOf() maps free-text area→bucket;
// unmatched → "Other". `orderedFindings` is the final, numbered sequence (TD-tdStart..).
function typeOf(f) {
  const a = String(f.area || "").toLowerCase() + " " + String(f.title || "").toLowerCase();
  if (/(vuln|idor|auth|injection|xss|csrf|secret|privilege|tenant|security|rce|ssrf)/.test(a)) return "Security / Vulnerability";
  if (/(dead.?code|unreachable|unused|orphan|never (called|used|imported))/.test(a)) return "Dead Code";
  if (/(duplicat|redundant|reimplement|copy)/.test(a)) return "Duplication";
  if (/(data.?integrity|race|concurren|transaction|idempoten|double|constraint)/.test(a)) return "Data Integrity / Concurrency";
  if (/(perf|n\+1|slow|latency|batch|query.?count)/.test(a)) return "Performance";
  if (/(contract.?drift|schema.?drift|api.?mismatch|404|endpoint.*(missing|not exist))/.test(a)) return "Contract Drift";
  if (/(test|coverage|shallow|flaky)/.test(a)) return "Testing";
  return "Other";
}
const TYPE_ORDER = ["Security / Vulnerability", "Dead Code", "Duplication", "Data Integrity / Concurrency", "Performance", "Contract Drift", "Testing", "Other"];
const SEV_ORDER2 = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
// Stable sort: severity, then type, then original index. Computed ONCE; both consumers use it.
const orderedFindings = finalFindings
  .map((f, i) => ({ f, i, t: typeOf(f) }))
  .sort((a, b) => {
    const sv = (SEV_ORDER2[a.f.severity] ?? 9) - (SEV_ORDER2[b.f.severity] ?? 9);
    if (sv !== 0) return sv;
    const tv = TYPE_ORDER.indexOf(a.t) - TYPE_ORDER.indexOf(b.t);
    if (tv !== 0) return tv;
    return a.i - b.i;
  });

function fmtChunks(today) {
  const sevHead = { CRITICAL: "🔴 Critical", HIGH: "🟠 High", MEDIUM: "🟡 Medium", LOW: "🟢 Low" };
  const head = [];
  head.push(`# Tech Debt Register - ${projectDir.split("/").pop()}`, "");
  if (scanNumber) head.push(`**Scan #${scanNumber}** - Deep codebase scan (runtime-native, ${coverageComplete ? "full coverage" : "PARTIAL coverage"})`);
  head.push(`**Date:** ${today}`);
  head.push(`**Slices run:** ${slices.length} | **Coverage:** ${coverageComplete ? `FULL - all ${slices.length} slices succeeded` : `PARTIAL - ${succeededCount}/${slices.length} succeeded`}`);
  head.push(`**Verified findings:** ${counts.total}`, "");
  // M99 D2 T4: stamp graphWiringMode into the header (north-star: invisible fallback leaves a trace).
  // A `fallback-announced` mode co-occurring with a same-window outcome:'hit' is the machine-visible
  // NiceNote scan-#12 contradiction. [RULE] wiring-mode-three-states
  const _wiringEmoji = { "wired": "✅", "fallback-announced": "⚠️", "disabled": "🚫", "pending": "⏳" };
  head.push(`**Graph wiring:** ${_wiringEmoji[graphWiringMode] || "?"} \`${graphWiringMode}\` (WIRED = graph answered structural queries; fallback-announced = graph unavailable, fell back to grep; disabled = no-graph baseline)`, "");
  head.push(`> Effort estimates use GSD-T-native units (domain / wave / spawn / token-spend). Never human-hours.`);
  head.push(`> TD numbering continues from the prior register (if any, archived). This scan begins at **TD-${tdStart}**.`, "");
  if (!coverageComplete) head.push(`> ⚠️ **PARTIAL COVERAGE - ${failedSlices.length} of ${slices.length} codebase areas were NOT scanned this pass** (failed to return findings): ${ascii(failedSlices.join(", "))}. Findings UNDER-COUNT the real debt. Re-run (resume) for full coverage.`, "");
  head.push(`## Summary`, "", `| Severity | Count |`, `|----------|-------|`,
    `| 🔴 CRITICAL | ${counts.critical} |`, `| 🟠 HIGH | ${counts.high} |`,
    `| 🟡 MEDIUM | ${counts.medium} |`, `| 🟢 LOW | ${counts.low} |`,
    `| **Total** | **${counts.total}** |`, "", "---", "");

  function itemMd(f, td) {
    const L = [`### TD-${td} - ${ascii(f.title) || "(untitled)"}`,
      `- **Area:** ${ascii(f.area) || "(none)"}`, `- **Severity:** ${f.severity}`, `- **Status:** OPEN`,
      `- **Location:** ${(f.files && f.files.length) ? ascii(f.files.join(", ")) : "(none)"}`];
    if (f.detail) L.push(`- **Description:** ${ascii(f.detail)}`);
    if (f.impact) L.push(`- **Impact:** ${ascii(f.impact)}`);
    if (f.recommendation) L.push(`- **Remediation:** ${ascii(f.recommendation)}`);
    if (f.slice) L.push(`- **Found in slice:** ${ascii(f.slice)}`);
    L.push("");
    return L.join("\n");
  }

  const CHUNK_MAX = 30000;
  const chunks = [head.join("\n")];
  let buf = "", n = tdStart, lastSev = null, lastType = null;
  const flush = () => { if (buf) { chunks.push(buf); buf = ""; } };
  // Consume the shared `orderedFindings` (severity → type → original-index) so the
  // TD numbers assigned here are IDENTICAL to those the consolidation stage references.
  for (const { f, t } of orderedFindings) {
    let piece = "";
    if (f.severity !== lastSev) { piece += `\n## ${sevHead[f.severity] || f.severity} Priority\n\n`; lastSev = f.severity; lastType = null; }
    // Type sub-heading uses a bold marker line (NOT `###`) so it never collides with
    // the `### TD-N` item headings that downstream tools grep for. ASCII hyphens only
    // (M76: no em/en-dashes in fmtChunks literals).
    if (t !== lastType) { piece += `**-- ${t} --**\n\n`; lastType = t; }
    piece += itemMd(f, n++);
    if (buf.length + piece.length > CHUNK_MAX) flush();
    buf += piece;
  }
  flush();
  return { chunks, lastTd: n - 1 };
}

// (d) Archive the prior register (one bounded agent: mv/git mv), then write the new
// one (one bounded agent: a SINGLE Write of the pre-formatted string).
const todayAgent = await agent(
  `Run \`date +%F\` via Bash and return ONLY the date string (YYYY-MM-DD), nothing else.`,
  { label: "synthesis:date", phase: "Synthesis", model: "haiku" }
).catch(() => null);
const today = (typeof todayAgent === "string" && /\d{4}-\d{2}-\d{2}/.test(todayAgent)) ? todayAgent.match(/\d{4}-\d{2}-\d{2}/)[0] : "today";

let archivePath = "";
if (pre.priorRegisterExists) {
  // #47: archive the prior register + ALL prior dimension files into
  // .gsd-t/scan/archive/ with a DATETIME stamp so the user can diff new-vs-prior.
  // Handles BOTH the new suffixed names and any legacy unsuffixed leftovers.
  const arch = await agent(
    [
      `Archive the existing scan outputs in \`${projectDir}\` into a dated archive folder so the user can diff new-vs-prior, then report the archive dir. Steps (via Bash):`,
      `1. STAMP="$(date +%Y%m%d-%H%M)". ARCH="${projectDir}/.gsd-t/scan/archive". mkdir -p "$ARCH".`,
      `2. Move each existing scan output into "$ARCH" with the STAMP appended before .md. For EACH that exists, move it: \`${projectDir}/.gsd-t/techdebt.md\`, \`${projectDir}/.gsd-t/techdebt_in_plain_english.md\`, and \`${projectDir}/.gsd-t/scan/<dim>.md\` for each dim in {architecture,security,quality,business-rules,contract-drift}. Target name: same basename + "-$STAMP.md" (e.g. techdebt-20260630-1542.md). Use \`git mv\` if a git repo else \`mv\`. Skip any that don't exist (no error).`,
      `3. Reply with ONLY the archive dir path "$ARCH".`,
    ].join("\n"),
    { label: "synthesis:archive", phase: "Synthesis", model: "haiku" }
  ).catch(() => null);
  archivePath = (typeof arch === "string") ? arch.trim().split("\n").pop() : "";
}

const { chunks, lastTd } = fmtChunks(today);
// M75: write the register in BOUNDED CHUNKS (≤30KB each). A single write of a large
// register truncates at ~165KB (verified) — so chunk 0 creates the file (Write), and
// each subsequent chunk is APPENDED. Done SEQUENTIALLY so the file builds in order and
// each agent's prompt+output stays small enough to pass intact. The register path is
// passed to each chunk; only the chunk content varies.
const regPath = `${projectDir}/.gsd-t/techdebt.md`; // internal fixed name (shared copy suffixed in share/)
let chunkOk = 0;
for (let ci = 0; ci < chunks.length; ci++) {
  const isFirst = ci === 0;
  const res = await agent(
    [
      isFirst
        ? `Create the file \`${regPath}\` (overwrite if it exists) with EXACTLY the content between the markers below, using the Write tool. Verbatim — no edits, no summarizing, no truncation.`
        : `APPEND EXACTLY the content between the markers below to the END of \`${regPath}\` (do not overwrite existing content — append). Verbatim — no edits, no truncation. Use a Bash heredoc append (\`cat >> ${regPath} <<'GSDTEOF'\` … \`GSDTEOF\`) or read-then-Write-concatenation; preserve the file's existing content exactly.`,
      `This is chunk ${ci + 1}/${chunks.length} of a tech-debt register. After writing, reply with ONLY "OK".`,
      ``,
      `<<<CHUNK>>>`,
      chunks[ci],
      `<<<END_CHUNK>>>`,
    ].join("\n"),
    { label: `synthesis:write-register ${ci + 1}/${chunks.length}`, phase: "Synthesis", model: "haiku" }
  ).catch((e) => ({ _err: String(e && e.message) }));
  if (typeof res === "string" && /ok/i.test(res)) chunkOk++;
  else log(`⚠ register chunk ${ci + 1}/${chunks.length} write uncertain: ${typeof res === "string" ? res.slice(0, 60) : JSON.stringify(res).slice(0, 80)}`);
}
log(`register written in ${chunkOk}/${chunks.length} chunks (${counts.total} findings, TD-${tdStart}..TD-${lastTd})`);

const synthesis = { status: "written", counts, archivePath, tdRange: `TD-${tdStart}..TD-${lastTd}`, finalFindings };
log(`register written: ${JSON.stringify(synthesis.counts)} (${synthesis.tdRange})`);

// ── Consolidation Opportunities (opus + graph-assisted) ────────────────────────
// After the register is written (TD numbers final), cluster HIGH-CONFIDENCE groups
// of TDs that share a root and should be fixed as ONE workstream (duplicate-function
// families, batch dead-code deletions, a guard-pattern missing across N sites, god-file
// splits). Only tight clusters — ungrouped TDs stay standalone (user directive). The
// section is APPENDED to the END of the register, after all individual items.
// Graph-assisted: an agent may run `gsd-t graph who-imports/who-calls/blast-radius`
// (project-local bin first, else global) on a TD's files to confirm two TDs truly share
// code before grouping — grounds the clustering in real relationships, not just prose
// similarity. Best-effort: any failure leaves the register intact (no section).
phase("Consolidation");
try {
  // Number from the SHARED `orderedFindings` so each TD-N here is EXACTLY the id the
  // register wrote (severity → type → original-index — the single ordering source).
  let _n = tdStart;
  const consInput = orderedFindings.map(({ f }) => {
    const td = _n++;
    return `TD-${td} [${f.severity}] (${ascii(f.area) || "?"}) ${ascii(f.title)} @ ${(f.files && f.files[0]) || "?"}`;
  }).join("\n");
  const CONS_SCHEMA = {
    type: "object", required: ["groups"], additionalProperties: false,
    properties: {
      groups: {
        type: "array",
        items: {
          type: "object", required: ["title", "members", "sharedRoot", "recommendedAction"], additionalProperties: false,
          properties: {
            title: { type: "string" },
            members: { type: "array", items: { type: "string" } },   // e.g. ["TD-75","TD-143"]
            sharedRoot: { type: "string" },
            recommendedAction: { type: "string" },
            effort: { type: "string" },                              // GSD-T-native units
          },
        },
      },
      notes: { type: "string" },
    },
  };
  const consAgent = await agent(
    [
      `You are identifying CONSOLIDATION OPPORTUNITIES in a tech-debt register — sets of findings that share a ROOT and should be fixed as ONE workstream, not one-by-one.`,
      `Below are ${finalFindings.length} findings as "TD-N [SEVERITY] (area) title @ location".`,
      ``,
      `Group ONLY HIGH-CONFIDENCE clusters (user directive — tight, not loose themes):`,
      `  • duplicate-functionality families (same logic implemented 2+ times / diverging copies)`,
      `  • batch dead-code deletions (multiple never-used modules/components removable together)`,
      `  • a single missing pattern repeated across N sites (e.g. the same auth guard absent on many routes)`,
      `  • god-file / god-object splits touching several TDs`,
      `  • the SAME remediation applied in multiple places`,
      `Findings with no strong shared root MUST be left OUT (they stay standalone — do not force weak groupings).`,
      ``,
      `GRAPH-ASSIST (optional, strengthens confidence): to confirm two TDs truly share code, you MAY run the code graph via Bash on their files — try a project-local binary first then the global one:`,
      `  \`${projectDir}/bin/gsd-t-graph-query-cli.cjs who-imports <file>\`  OR  \`gsd-t graph who-imports <file>\` (also who-calls / blast-radius). If the graph is unavailable, fall back to the location/area text — do NOT fail.`,
      ``,
      `Return "groups": each = { title, members: ["TD-N",...] (>=2), sharedRoot, recommendedAction (which to keep/delete/extract), effort (GSD-T-native units: domain/wave/spawn count — NEVER human-hours) }. If nothing clusters with high confidence, return groups: [].`,
      ``,
      consInput.slice(0, 140000),
    ].join("\n"),
    { label: "consolidation:cluster", phase: "Consolidation", schema: CONS_SCHEMA, model: "opus" }
  ).catch((e) => { log(`consolidation cluster failed (non-fatal): ${e && e.message}`); return null; });

  const groups = (consAgent && Array.isArray(consAgent.groups)) ? consAgent.groups : [];
  if (groups.length) {
    const cs = [
      ``, `---`, ``, `## 🧩 Consolidation Opportunities`, ``,
      `> High-confidence clusters of findings that share a root cause and should be addressed as ONE workstream (candidates for a single consolidation milestone). Findings not listed here have no strong shared root and stand alone. Effort is in GSD-T-native units.`, ``,
    ];
    groups.forEach((g, gi) => {
      cs.push(`### CG-${gi + 1} - ${ascii(g.title)}`);
      cs.push(`- **Members:** ${(g.members || []).map((m) => ascii(m)).join(", ")}`);
      cs.push(`- **Shared root:** ${ascii(g.sharedRoot)}`);
      cs.push(`- **Recommended action:** ${ascii(g.recommendedAction)}`);
      if (g.effort) cs.push(`- **Effort:** ${ascii(g.effort)}`);
      cs.push("");
    });
    if (consAgent.notes) cs.push(`> Notes: ${ascii(consAgent.notes)}`, "");
    // Append via a bounded agent Bash heredoc (orchestrator has no fs).
    const consBlock = cs.join("\n");
    await agent(
      [
        `APPEND EXACTLY the content between the markers to the END of \`${regPath}\` (append — do NOT overwrite existing content). Use a Bash heredoc: \`cat >> ${regPath} <<'GSDTEOF'\` … \`GSDTEOF\`. After writing, reply ONLY "OK".`,
        ``, `<<<CHUNK>>>`, consBlock, `<<<END_CHUNK>>>`,
      ].join("\n"),
      { label: "consolidation:write", phase: "Consolidation", model: "haiku" }
    ).catch((e) => log(`consolidation append uncertain (non-fatal): ${e && e.message}`));
    log(`consolidation: ${groups.length} high-confidence group(s) appended to register`);
  } else {
    log(`consolidation: no high-confidence clusters found (register unchanged)`);
  }
} catch (e) {
  log(`consolidation phase failed (non-fatal — register intact): ${e && e.message}`);
}

// Document — per-doc fan-out. Each agent writes its file via Write/Edit (its tools).
// The orchestrator passes the findings + (for plain-english) tells the agent to
// READ the just-written register itself, since the orchestrator can't read it.
phase("Document");
const sliceSummary = slices.map((s) => `- ${s.key} (${s.dimension}): ${JSON.stringify(s.paths)}`).join("\n");
// Compact serialization of the verified findings handed to each document agent. Project
// only the fields the docs need (full objects can carry verbose verify metadata); the
// baseCtx caps it at 120KB below. (Bugfix: findingsJson was referenced but never defined,
// which crashed the entire workflow at the Document phase AFTER all finders/verify/synthesis
// ran — ReferenceError: findingsJson is not defined.)
const findingsJson = JSON.stringify(
  finalFindings.map((f) => ({
    title: f.title, severity: f.severity, area: f.area,
    files: f.files, detail: f.detail, impact: f.impact,
    recommendation: f.recommendation, slice: f.slice,
  })),
  null, 1
);
const baseCtx = [
  `Project: \`${projectDir}\`. Probe totals: ${JSON.stringify(probe.totals)}.`,
  `Slices the scan covered:`,
  sliceSummary,
  `Verified findings:`,
  "```json",
  findingsJson.length > 120000 ? findingsJson.slice(0, 120000) + "\n…(truncated)" : findingsJson,
  "```",
].join("\n");

const mergeNote =
  `If the target file already exists with real content: MERGE using the Edit tool ` +
  `(targeted section edits) — do NOT overwrite with Write (that destroys content you ` +
  `didn't reproduce). If it's placeholder/template-only, you may replace. If absent, create. ` +
  `Replace {Project Name}/{Date} tokens with real values. Derive everything from the slices, ` +
  `findings, and the actual code you read — invent nothing.`;

const docTargets = [
  { id: "scan-architecture", label: "scan:architecture",
    prompt: `Write \`${projectDir}/.gsd-t/scan/architecture.md\` (use Bash mkdir -p for .gsd-t/scan first if needed) — architecture dimension: stack, structure, patterns, a Components/Domains list (one per feature-domain slice), data flow. For the HTML renderer, give the file+LOC GRAND TOTAL as a markdown TABLE ROW exactly: \`| Grand Total | <N> files | <LOC> |\` from the probe totals. Per-dir \`<n> files (~<loc> LOC)\` lines in a Structure section are fine; do NOT write a second bare grand-total line.` },
  { id: "scan-security", label: "scan:security",
    prompt: `Write \`${projectDir}/.gsd-t/scan/security.md\` — security findings as sections \`### SEC-H<n>: <title>\` (HIGH) / \`### SEC-M<n>: <title>\` (MEDIUM), each with \`- **Details**: …\` and \`- **Fix**: …\` bullets.` },
  { id: "scan-quality", label: "scan:quality",
    prompt: `Write \`${projectDir}/.gsd-t/scan/quality.md\` — quality/dead-code/dup/test-gap findings as \`### DC-<n>: <title>\` / \`### TCG-<n>: <title>\` / \`### TD-<n>: <title>\`, each with a \`\\\`file:line\\\`\` location line and \`- **Impact**: …\` / \`- **Suggestion**: …\` bullets.` },
  { id: "scan-business-rules", label: "scan:business-rules",
    prompt: `Write \`${projectDir}/.gsd-t/scan/business-rules.md\` — embedded business logic across the slices: validation, authorization, workflow/state-machine, calculation (pricing/scoring/quotas), integration (retry/fallback/timeout) rules. Each: where implemented (file:line) + assessment. Add an "Undocumented Rules" section.` },
  { id: "scan-contract-drift", label: "scan:contract-drift",
    prompt: `Write \`${projectDir}/.gsd-t/scan/contract-drift.md\` — compare \`${projectDir}/.gsd-t/contracts/\` (if present) to the implementation: endpoints vs api-contract, schema vs schema-contract, undocumented endpoints/tables/components, drift. If no contracts dir, say so + list de-facto interfaces worth documenting.` },
  { id: "docs-architecture", label: "docs/architecture.md", merge: true,
    prompt: `Update or create \`${projectDir}/docs/architecture.md\`: system overview; component descriptions w/ locations+dependencies (one section per feature-domain slice); data flow (request→handler→service→data→response); data models; API structure; integrations; design decisions. Go deep.` },
  { id: "docs-workflows", label: "docs/workflows.md", merge: true,
    prompt: `Update or create \`${projectDir}/docs/workflows.md\`: a USER JOURNEY per feature-domain slice (entry→handlers→data); technical workflows (cron/queues/scheduled); API workflows for multi-step ops; integration workflows; state machines/approval flows. ≥1 journey per feature-domain slice.` },
  { id: "docs-infrastructure", label: "docs/infrastructure.md", merge: true,
    prompt: `Update or create \`${projectDir}/docs/infrastructure.md\`: Quick Reference commands (package.json scripts/Makefile/CI); local dev setup; DB commands (migrations/seeds/ORM/backups); cloud provisioning; credentials/secrets (NAMES ONLY, never values); deployment; logging/monitoring.` },
  { id: "docs-requirements", label: "docs/requirements.md", merge: true,
    prompt: `Update or create \`${projectDir}/docs/requirements.md\`: functional requirements from routes/handlers/UI; technical from configs/package.json/runtime; non-functional from perf configs/rate limits/caching.` },
  { id: "readme", label: "README.md", merge: true,
    prompt: `Update or create \`${projectDir}/README.md\`: project name+description; tech stack+versions; getting-started/setup; brief architecture overview; link to docs/. If it exists, MERGE — preserve the user's structure/custom content.` },
  // NOTE (M78): the plain-english companion is NOT in docTargets — a single agent
  // stalls writing 300+ entries (the M75 register bug). It has its own dedicated phase
  // below: batched generation (bounded fan-out) + deterministic severity-grouped,
  // chunked write.
];

const docResults = await parallel(
  docTargets.map((d) => async () => {
    const isLiving = !!d.merge;
    const prompt = [
      `You are the documentation agent for ONE document in a GSD-T deep scan of \`${projectDir}\`.`,
      baseCtx,
      d.needsRegister ? `\nThe synthesized register lives at \`${projectDir}/.gsd-t/techdebt.md\` — READ it first for the authoritative TD-NNN ids/order.` : ``,
      ``,
      d.prompt,
      ``,
      isLiving ? mergeNote : `Write the file fresh in the format described (use Bash \`mkdir -p\` for parent dirs if needed).`,
      `PUNCTUATION: do NOT use em-dashes (use " - "), en-dashes, smart quotes, or ellipsis characters — those render as garbage in non-UTF-8 terminals. Use plain ASCII hyphens and straight quotes. (Severity color bullets 🔴🟠🟡🟢 are fine to keep where used for severity.)`,
      `Read the actual code under the relevant slice paths for specifics - don't summarize only from findings. Use Write/Edit to write the file, then return JSON per the schema (status "written"/"merged"/"skipped"/"failed"). Do NOT commit - the workflow handles git at the end.`,
    ].filter(Boolean).join("\n");
    try {
      return await agent(prompt, { label: d.label, phase: "Document", schema: DOC_RESULT_SCHEMA, model: "sonnet" });
    } catch (e) {
      return { doc: d.id, status: "failed", notes: `agent error: ${e && e.message}` };
    }
  })
);
const docsOk = docResults.filter(Boolean).filter((r) => r.status === "written" || r.status === "merged");
const docsFailed = docResults.filter(Boolean).filter((r) => r.status === "failed");
log(`document phase: ${docsOk.length}/${docTargets.length} written/merged${docsFailed.length ? `; ${docsFailed.length} failed (non-fatal): ${docsFailed.map((d) => d.doc).join(", ")}` : ""}`);

// ─── Plain-English phase (M78) ───────────────────────────────────────────────
// The non-technical companion can be 300+ entries — a single agent stalls writing
// it (the M75 register bug). So: batch the (already severity-sorted) findings, fan
// out bounded generator agents (each writes its batch's entries via the shared gate),
// then ASSEMBLE deterministically with severity section headers, and chunk-write.
phase("Plain-English");
const peTarget = `${projectDir}/.gsd-t/techdebt_in_plain_english.md`; // internal fixed name (shared copy suffixed in share/)
const sevLabel = { CRITICAL: "fix before launch", HIGH: "fix soon", MEDIUM: "schedule", LOW: "clean up eventually" };
// Attach the deterministic TD number (matches the register: severity-sorted, tdStart+).
const peItems = finalFindings.map((f, i) => ({
  td: tdStart + i, severity: f.severity, title: ascii(f.title),
  area: ascii(f.area), detail: ascii(f.detail || f.impact || "").slice(0, 500),
}));
const PE_BATCH = 36;
const peBatches = [];
for (let i = 0; i < peItems.length; i += PE_BATCH) peBatches.push(peItems.slice(i, i + PE_BATCH));
const PE_SCHEMA = { type: "object", required: ["entries"], additionalProperties: false,
  properties: { entries: { type: "array", items: { type: "object", required: ["td", "markdown"], properties: { td: { type: "integer" }, markdown: { type: "string" } } } } } };

const peResults = await parallel(peBatches.map((batch, bi) => async () => {
  const prompt = [
    `Write NON-TECHNICAL ("plain English") companion entries for a tech-debt register, for a non-engineer stakeholder (founder/PM).`,
    `For EACH finding below, produce one entry. Return JSON {entries:[{td, markdown}]} where markdown is EXACTLY:`,
    `### TD-<td> - <plain-English name, no jargon>`,
    `**What it is.** <1-2 sentences, no jargon; define any unavoidable term in parentheses>`,
    `**Why it matters.** <business/user consequence>`,
    `**Real-world analogy.** <a concrete everyday comparison that genuinely maps to THIS issue>`,
    `**Severity.** <the plain-urgency phrase given per item>`,
    `Keep the td number EXACTLY. ASCII punctuation only (hyphens, straight quotes — NO em-dashes/smart-quotes/ellipsis). No preamble.`,
    ``,
    `Findings (batch ${bi + 1}/${peBatches.length}):`,
    "```json",
    JSON.stringify(batch.map((it) => ({ ...it, severityPhrase: sevLabel[it.severity] || "review" }))),
    "```",
  ].join("\n");
  try {
    const r = await gatedAgent(prompt, { label: `plain-english ${bi + 1}/${peBatches.length}`, phase: "Plain-English", schema: PE_SCHEMA, model: "sonnet" });
    return { bi, entries: (r && Array.isArray(r.entries)) ? r.entries : [] };
  } catch (e) { return { bi, entries: [], failed: true }; }
}));
// Map td -> entry markdown, then assemble grouped by severity (deterministic headers).
const peByTd = {};
for (const r of peResults) for (const e of (r.entries || [])) if (e && e.td != null) peByTd[e.td] = ascii(e.markdown || "");
const peFailed = peResults.filter((r) => r.failed).length;
const peGroups = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [] };
for (const it of peItems) { const md = peByTd[it.td]; if (md && peGroups[it.severity]) peGroups[it.severity].push(md.trim()); }
const peSevHead = { CRITICAL: "## 🔴 Critical", HIGH: "## 🟠 High", MEDIUM: "## 🟡 Medium", LOW: "## 🟢 Low" };
const peHeader = [
  `# Tech Debt - Plain English`, "",
  `> Non-technical companion to .gsd-t/techdebt.md (Scan${scanNumber ? " #" + scanNumber : ""}, ${peItems.length} findings). One entry per item: what it is, why it matters, a real-world analogy, plain-urgency severity. Grouped by severity.`, "", "---",
].join("\n");
// Build chunks: header, then per-severity section (header + its entries), sub-split ≤30KB.
const peChunks = [peHeader];
for (const sev of ["CRITICAL", "HIGH", "MEDIUM", "LOW"]) {
  const items = peGroups[sev];
  if (!items.length) continue;
  let buf = `\n${peSevHead[sev]} (${items.length})\n\n`;
  for (const md of items) {
    const piece = md + "\n\n";
    if (buf.length + piece.length > 30000) { peChunks.push(buf); buf = ""; }
    buf += piece;
  }
  if (buf.trim()) peChunks.push(buf);
}
// M80 fix: a SINGLE owning agent writes ALL chunks sequentially and SELF-VERIFIES the
// final `### TD-` entry count, retrying short writes. The prior design fanned each chunk
// to a separate haiku agent via heredoc-append — agents replied "OK" without faithfully
// appending 30KB blobs of markdown (special chars `$` ` # collide with the heredoc /
// get paraphrased), so the middle chunks silently dropped: run wf_b2a6a9e0-9de wrote
// only 65/181 entries (Critical+High + a 2-item tail). With one owner + a count check,
// an incomplete write is detected and fixed in-agent instead of shipping truncated.
const peExpectedEntries = Object.values(peGroups).reduce((a, b) => a + b.length, 0);
const peWriteRes = await gatedAgent(
  [
    `You write ONE file: \`${peTarget}\`. It has ${peChunks.length} ordered chunks (below, each between <<<C n>>> and <<<END n>>>).`,
    `Procedure — follow EXACTLY:`,
    `1. Write chunk 1 to \`${peTarget}\` VERBATIM using the Write tool (creates/overwrites).`,
    `2. For chunks 2..${peChunks.length}, APPEND each VERBATIM to the END of the file. Use the Write tool with the FULL accumulated content (read the file, concatenate the next chunk, Write the whole thing) — do NOT use a heredoc (special chars corrupt it).`,
    `3. After all chunks: run \`grep -c '^### TD-' ${peTarget}\`. It MUST equal ${peExpectedEntries}.`,
    `4. If the count is LESS than ${peExpectedEntries}, you dropped content — redo the append for the missing chunks until the count is exactly ${peExpectedEntries}.`,
    `Reply with ONLY the final integer count from step 3 (e.g. "${peExpectedEntries}"). Nothing else. Reproduce every chunk verbatim — do not summarize, reword, or skip entries.`,
    ``,
    ...peChunks.map((c, i) => `<<<C ${i + 1}>>>\n${c}\n<<<END ${i + 1}>>>`),
  ].join("\n"),
  { label: `plain-english write (${peChunks.length} chunks, ${peExpectedEntries} entries)`, phase: "Plain-English", model: "sonnet" }
).catch((e) => ({ _e: String(e && e.message) }));
// Independent verification by a second cheap agent (the writer self-reports; trust but verify).
const peVerify = await gatedAgent(
  `Run \`grep -c '^### TD-' ${peTarget}\` and reply with ONLY the integer it prints.`,
  { label: `plain-english verify-count`, phase: "Plain-English", model: "haiku" }
).catch(() => null);
const peActual = (typeof peVerify === "string" && /\d+/.test(peVerify)) ? parseInt(peVerify.match(/\d+/)[0], 10) : null;
const peComplete = peActual === peExpectedEntries;
if (!peComplete) log(`⚠ plain-english INCOMPLETE: wrote ${peActual}/${peExpectedEntries} entries (writer said ${typeof peWriteRes === "string" ? peWriteRes.trim().slice(0, 20) : JSON.stringify(peWriteRes).slice(0, 40)})`);
log(`plain-english: ${peExpectedEntries}/${peItems.length} entries, grouped by severity, ${peChunks.length} chunks, on-disk count ${peActual ?? "?"} (${peComplete ? "COMPLETE" : "INCOMPLETE"})${peFailed ? `; ${peFailed} gen batch(es) failed` : ""}`);

// #47: EXPORT-COPY the living docs into a share/ folder with the repo-name suffix —
// the LAST scan step. Originals stay at their fixed docs/ names (GSD-T reads them by
// hardcoded path under the No-Re-Research rule); the share/ copies are the team-shareable,
// project-labeled set. Regenerated each scan (overwrite). The scan reports themselves are
// already suffixed in place (techdebt-<repo>.md, scan/<dim>-<repo>.md).
const shareAgent = await agent(
  [
    `Create a shareable, repo-labeled copy of this project's living docs in \`${projectDir}\` via Bash. Steps:`,
    `1. \`mkdir -p ${projectDir}/share\`.`,
    `2. COPY (do NOT move — keep the original at its fixed name) each of these that EXISTS into \`${projectDir}/share/\` with the repo name "${repoName}" suffixed before .md. Living docs: \`docs/architecture.md\`→\`share/architecture-${repoName}.md\`, \`docs/requirements.md\`→\`share/requirements-${repoName}.md\`, \`docs/workflows.md\`→\`share/workflows-${repoName}.md\`, \`docs/infrastructure.md\`→\`share/infrastructure-${repoName}.md\`, \`README.md\`→\`share/README-${repoName}.md\`. Scan reports: \`.gsd-t/techdebt.md\`→\`share/techdebt-${repoName}.md\`, \`.gsd-t/techdebt_in_plain_english.md\`→\`share/techdebt_in_plain_english-${repoName}.md\`, and each \`.gsd-t/scan/<dim>.md\`→\`share/<dim>-${repoName}.md\` for dim in {architecture,security,quality,business-rules,contract-drift} (NOTE these scan dimension files share basenames with the living-doc architecture — keep them distinct: prefer \`share/scan-<dim>-${repoName}.md\` for the .gsd-t/scan/ ones to avoid colliding with docs/architecture). Overwrite existing share/ files (always fresh). Skip any source that doesn't exist (no error).`,
    `3. Reply with ONLY the count of files copied.`,
  ].join("\n"),
  { label: "share-export", phase: "Document", model: "haiku" }
).catch(() => null);
log(`share/ export: ${typeof shareAgent === "string" ? shareAgent.trim().slice(0, 40) : "done"} → ${projectDir}/share/`);

// Commit the docs + dimension files + plain-english + share/ via a small agent (Bash git).
const commitAgent = await agent(
  [
    `Commit the GSD-T scan's generated documents in \`${projectDir}\` via Bash git, IF it is a git repo (else report skipped).`,
    `Stage: \`.gsd-t/scan\`, \`.gsd-t/techdebt.md\`, \`.gsd-t/techdebt_in_plain_english.md\`, \`share\`, \`docs\`, \`README.md\` (do NOT stage \`.gsd-t/scan/.doc-backup\` if present; \`.gsd-t/scan/archive\` MAY be staged — the dated history is worth keeping). Commit message: "scan: deep document cross-population (${docsOk.length} docs) + dimension files + share/ export". Do NOT push. Return JSON per the schema (status "rendered" if committed, "skipped" if not a git repo / nothing to commit, "failed" on error; outputPath optional).`,
  ].join("\n"),
  { label: "commit-docs", phase: "Document", schema: RENDER_SCHEMA, model: "haiku" }
).catch((e) => ({ status: "failed", notes: String(e && e.message) }));
log(`docs commit: ${commitAgent && commitAgent.status}`);

// NOTE (M71): the HTML render stage was REMOVED. The deterministic bin/scan-report.js
// renderer resolves its output path relative to the package dir (where the renderer
// modules live), not projectDir — so it wrote/overwrote `scan-report.html` in the
// GSD-T package instead of the target project (a data-loss risk: it clobbered the
// package's own committed report). The authoritative deliverables are the register +
// 5 dimension files + plain-english + living docs, all correctly written to
// projectDir. The fragile, wrong-tree HTML report is not worth that risk; dropped.

return {
  // M72: status reflects coverage — a partial scan is NOT "complete".
  status: coverageComplete ? "complete" : "complete-partial-coverage",
  coverageComplete,
  slicesTotal: slices.length,
  slicesSucceeded: succeededCount,
  slicesFailed: failedSlices,           // names of un-scanned areas (empty if full coverage)
  findings: allFindings.length,
  counts: synthesis.counts,
  tdRange: synthesis.tdRange,
  archivePath: synthesis.archivePath || null,
  docsWritten: docsOk.length,
  docsFailed: docsFailed.map((d) => d.doc),
  docsCommitted: commitAgent && commitAgent.status,
  // M80: plain-english completeness is surfaced, not silent. plainEnglishComplete=false
  // means the companion doc is truncated (writer dropped entries) — the caller should flag it.
  plainEnglishEntries: peActual,
  plainEnglishExpected: peExpectedEntries,
  plainEnglishComplete: peComplete,
  htmlReport: null, // render stage removed (M71)
  probeTotals: probe.totals,
  // M94-D6: graph wiring status (surfaced for AC-4 INSIGHT-delta comparison).
  // [RULE] scan-injects-structural-slice / [RULE] no-graph-baseline-proven-graph-free
  graphWiring: {
    mode: graphWiringMode,  // "wired" | "fallback-announced" | "disabled"
    structuralSlicePresent: structuralSlice !== null,
    deadCodeCount: (structuralSlice && structuralSlice.deadCode) ? structuralSlice.deadCode.length : 0,
    danglingCount: (structuralSlice && structuralSlice.dangling) ? structuralSlice.dangling.length : 0,
    clusterCount:  (structuralSlice && structuralSlice.clusters) ? structuralSlice.clusters.length : 0,
  },
};
