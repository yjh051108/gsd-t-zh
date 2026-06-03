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
//   { projectDir: ".", scanNumber?: 13, verify?: "single"|"none" }
//   (no slice cap — the probe's cohesive-sub-domain decomposition is the slice set.)

export const meta = {
  name: "gsd-t-scan",
  description:
    "GSD-T scan (runtime-native): preflight → volume-probe → pipeline(deep-finder per slice → single verify) → synthesis(archive+register) → document(living docs + 5 dimension files + plain-english) → render. Orchestrator does NO fs/require; all I/O is inside subagents. Fans out by codebase volume.",
  phases: [
    { title: "Preflight",  detail: "branch + prior-register check (agent via Bash)" },
    { title: "Probe",      detail: "volume probe → per-area slice list", model: "sonnet" },
    { title: "Deep Scan",  detail: "pipeline: per-slice deep finder → single verify" },
    { title: "Synthesis",  detail: "archive prior + write fresh register + git", model: "opus" },
    { title: "Document",   detail: "living docs + 5 dimension files + plain-english (per-doc fan-out)" },
    { title: "Render",     detail: "HTML scan report via gsd-t bin renderers (agent via Bash)" },
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

const SYNTHESIS_SCHEMA = {
  type: "object",
  required: ["status", "counts"],
  additionalProperties: false,
  properties: {
    status:       { type: "string", enum: ["written", "failed"] },
    registerPath: { type: "string" },
    archivePath:  { type: "string" },
    counts: {
      type: "object",
      required: ["critical", "high", "medium", "low"],
      properties: {
        critical: { type: "integer" }, high: { type: "integer" },
        medium:   { type: "integer" }, low:  { type: "integer" }, total: { type: "integer" },
      },
    },
    tdRange: { type: "string", description: "e.g. 'TD-01..TD-119'" },
    notes:   { type: "string" },
  },
};

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

// ───── Script body — orchestration only, ZERO file I/O here ─────────────────

// Preflight: an agent checks branch + whether a prior register exists, via Bash.
// (No fs in the body — that was the bug.)
phase("Preflight");
const pre = await agent(
  [
    `You are the preflight check for a GSD-T deep scan of the project at \`${projectDir}\`.`,
    `Using Bash/Read tools, determine:`,
    `1. The current git branch (\`git -C ${projectDir} rev-parse --abbrev-ref HEAD\`; if not a git repo, report branch "(no-git)").`,
    `2. Whether \`${projectDir}/.gsd-t/techdebt.md\` exists (priorRegisterExists).`,
    `3. If it exists, the HIGHEST TD-NNN number in it (grep \`### TD-\`, parse the max integer; priorMaxTd). If absent, priorMaxTd=0.`,
    `Set ok=true unless something makes scanning impossible (e.g. projectDir does not exist). Return JSON per the schema.`,
  ].join("\n"),
  { label: "preflight", phase: "Preflight", schema: PREFLIGHT_SCHEMA, model: "haiku" }
);
if (!pre || !pre.ok) {
  log(`preflight failed — halting. notes: ${pre && pre.notes}`);
  return { status: "failed", reason: "preflight-failed", preflight: pre };
}
const tdStart = (pre.priorRegisterExists ? (pre.priorMaxTd || 0) : 0) + 1;
log(`preflight ok — branch=${pre.branch}, priorRegister=${pre.priorRegisterExists}, TD numbering starts at TD-${tdStart}`);

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

const deep = budget && budget.total && budget.total > 300000 ? "MAXIMUM" : "thorough";

// Deep scan — pipeline: per-slice deep finder → single verify (no barrier).
phase("Deep Scan");

// M72: a finder that returns no schema-valid output (runtime nudged it twice then
// dropped it) must NOT be silently treated as a clean slice — that presents PARTIAL
// coverage as complete (7/19 slices dropped this way on the Hilo run). So: (1) the
// finder call is RETRIED once on a null/invalid result; (2) a slice that still fails
// is flagged `failed:true` and tracked — never conflated with a genuinely-empty slice.
function finderPrompt(slice) {
  return [
    `⛔ Scan ONLY files under the absolute project path \`${projectDir}\`. \`cd ${projectDir}\` first; never read outside this tree.`,
    `You are a DEEP tech-debt finder for ONE slice of a scan of \`${projectDir}\`: \`${slice.key}\` (dimension: ${slice.dimension}).`,
    `Owned paths (relative to \`${projectDir}\`): ${JSON.stringify(slice.paths)}.`,
    slice.why ? `Why this slice matters: ${slice.why}` : ``,
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
function makeSemaphore(permits) {
  let avail = permits;
  const waiters = [];
  return {
    async acquire() {
      if (avail > 0) { avail--; return; }
      await new Promise((res) => waiters.push(res));
      // resumed: a release() handed us the permit (avail already decremented there).
    },
    release() {
      const next = waiters.shift();
      if (next) next();           // hand permit directly to the next waiter
      else avail++;               // no waiter: return permit to the pool
    },
  };
}
const gate = makeSemaphore(MAX_CONCURRENT);
async function gatedAgent(prompt, opts) {
  await gate.acquire();
  try { return await agent(prompt, opts); }
  finally { gate.release(); }
}

async function runFinder(slice) {
  // up to 2 attempts; a null/invalid (non-array findings) result counts as a drop.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await gatedAgent(finderPrompt(slice), {
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
  const finderResult = await runFinder(slice);
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

// Synthesis — an agent does the ARCHIVE + REGISTER WRITE + GIT entirely via its
// own Bash/Write tools. The orchestrator does NOT touch fs. The agent is given the
// deterministic tdStart so numbering can't drift, and is told to archive FIRST.
phase("Synthesis");
const findingsJson = JSON.stringify(allFindings, null, 2);
const synthesis = await agent(
  [
    `You are the SYNTHESIS agent for a GSD-T deep scan of \`${projectDir}\`. ${slices.length} slices ran; ${allFindings.length} verified findings came back.`,
    scanNumber ? `This is scan #${scanNumber} — put it in the register header.` : ``,
    ``,
    `STEP 1 — ARCHIVE (do this FIRST, deterministically, via Bash): if \`${projectDir}/.gsd-t/techdebt.md\` exists, rename it to \`${projectDir}/.gsd-t/techdebt_YYYY-MM-DD.md\` using its header date (fallback: today's date from \`date +%F\`); on same-day collision append \`_2\`, \`_3\`. Use \`git mv\` if it's a git repo, else \`mv\`. Capture the archive path. ${pre.priorRegisterExists ? "(A prior register EXISTS — you MUST archive it.)" : "(No prior register — skip archiving.)"}`,
    ``,
    // M72: MANDATORY coverage banner — enforced here, not left to the agent's notice.
    coverageComplete
      ? `COVERAGE: all ${slices.length} slices succeeded — full coverage. Note this in the header.`
      : `⚠ COVERAGE IS INCOMPLETE — ${failedSlices.length} of ${slices.length} slices FAILED to return findings and were NOT scanned: ${failedSlices.join(", ")}. You MUST put a prominent "> ⚠ PARTIAL COVERAGE — N of M codebase areas were not scanned this pass (listed below); findings UNDER-COUNT the real debt. Re-run for full coverage." banner at the TOP of the register, AND list the un-scanned slice names. Do NOT present this as a complete picture.`,
    ``,
    `STEP 2 — WRITE the fresh \`${projectDir}/.gsd-t/techdebt.md\` (Write tool). Start TD numbering at TD-${tdStart} (computed deterministically — do NOT renumber or restart). Structure: the coverage banner (above), a Summary table (CRITICAL/HIGH/MEDIUM/LOW counts), then sections Critical→High→Medium→Low, each finding as \`### TD-NNN — {title}\` with Area / Severity / Status: OPEN / Location (file:line) / Description / Impact / Remediation / Milestone candidate. Re-rank globally by true severity; de-duplicate findings multiple slices surfaced into one item listing all locations. GSD-T effort units only (domain/wave/spawn/token) — never human-hours.`,
    `If the findings set is large, WRITE INCREMENTALLY — create the file with the header+summary first (Write), then APPEND each severity section with Edit. Do NOT attempt to emit the entire multi-hundred-item register in a single Write call (it can stall); build it up section by section so progress is durable.`,
    ``,
    `STEP 3 — COMMIT via Bash if it's a git repo (\`git add .gsd-t/techdebt.md\` + the archive; commit). Do NOT push.`,
    ``,
    `Verified findings (${allFindings.length} total):`,
    "```json",
    findingsJson.length > 500000 ? findingsJson.slice(0, 500000) + "\n…(TRUNCATED — too many findings to inline; the above is the first portion. Note in the register that some lower-severity items may be omitted due to volume.)" : findingsJson,
    "```",
    ``,
    `Return JSON per the schema: status "written" once the register file is on disk, the counts, the archivePath (or ""), and tdRange (e.g. "TD-${tdStart}..TD-NNN").`,
  ].filter(Boolean).join("\n"),
  { label: "synthesis", phase: "Synthesis", schema: SYNTHESIS_SCHEMA, model: "opus" }
);
if (!synthesis || synthesis.status !== "written") {
  log("synthesis did not write the register — halting before document phase");
  return { status: "failed", reason: "synthesis-failed", synthesis, findingCount: allFindings.length };
}
log(`register written: ${JSON.stringify(synthesis.counts)} (${synthesis.tdRange || ""})`);

// Document — per-doc fan-out. Each agent writes its file via Write/Edit (its tools).
// The orchestrator passes the findings + (for plain-english) tells the agent to
// READ the just-written register itself, since the orchestrator can't read it.
phase("Document");
const sliceSummary = slices.map((s) => `- ${s.key} (${s.dimension}): ${JSON.stringify(s.paths)}`).join("\n");
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
  { id: "techdebt-plain-english", label: ".gsd-t/techdebt_in_plain_english.md", needsRegister: true,
    prompt: `Write \`${projectDir}/.gsd-t/techdebt_in_plain_english.md\` — a NON-TECHNICAL companion to the register for a non-engineer (founder/PM/stakeholder). FIRST read \`${projectDir}/.gsd-t/techdebt.md\` (Read tool) to get the EXACT TD-NNN ids/order — it was just written and IS the source of truth (the findings JSON has no TD ids). Cover EVERY item, one entry each: \`### TD-NNN — <plain-English name>\`; **What it is** (no jargon; define any unavoidable term in parentheses); **Why it matters** (business/user consequence); **Real-world analogy** (a concrete everyday comparison that genuinely maps to THIS item); **Severity in plain terms** (CRITICAL/HIGH/MEDIUM/LOW → "fix before launch"/"schedule soon"/"clean up eventually"). Open with a 2-3 sentence plain-English health summary + headline counts.` },
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
      `Read the actual code under the relevant slice paths for specifics — don't summarize only from findings. Use Write/Edit to write the file, then return JSON per the schema (status "written"/"merged"/"skipped"/"failed"). Do NOT commit — the workflow handles git at the end.`,
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

// Commit the docs + dimension files + plain-english via a small agent (Bash git).
const commitAgent = await agent(
  [
    `Commit the GSD-T scan's generated documents in \`${projectDir}\` via Bash git, IF it is a git repo (else report skipped).`,
    `Stage: \`.gsd-t/scan\`, \`.gsd-t/techdebt_in_plain_english.md\`, \`docs\`, \`README.md\` (do NOT stage \`.gsd-t/scan/.doc-backup\` if present). Commit message: "scan: deep document cross-population (${docsOk.length} docs) + dimension files". Do NOT push. Return JSON per the schema (status "rendered" if committed, "skipped" if not a git repo / nothing to commit, "failed" on error; outputPath optional).`,
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
  htmlReport: null, // render stage removed (M71)
  probeTotals: probe.totals,
};
