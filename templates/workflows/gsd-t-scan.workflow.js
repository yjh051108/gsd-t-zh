// templates/workflows/gsd-t-scan.workflow.js
//
// Runtime: Anthropic native Workflow tool only (not standalone-Node parseable).
// Globals provided by runtime: agent, parallel, pipeline, log, phase, budget, args.
// Top-level await + return are runtime-legal in that context.
//
// Canonical native-Workflow implementation of the GSD-T scan phase.
//
// WHY THIS EXISTS (M66): the legacy commands/gsd-t-scan.md was the ONLY major
// phase never migrated to a Workflow. It hard-coded exactly 5 teammates (one per
// DIMENSION: architecture/business-rules/security/quality/contracts) with ZERO
// volume scaling — a 5-file repo and a 1,809-file repo both got 5 agents. A single
// `quality` agent asked to cover dead-code+dup+complexity+errors+perf+test-gaps
// across the whole codebase samples ~5 issues and stops. That produced a cursory
// 16-item register on a codebase whose deep scan surfaced 117 findings.
// It also referenced a retired `autoSpawnHeadless()` + `headless-default-contract
// v2.0.0` that no longer exist post-M61/M65.
//
// THE FIX: fan out by codebase VOLUME, not by a fixed dimension count.
//   preflight → volume-probe (derive per-AREA slice list) →
//   pipeline( slice → deep-finder "enumerate, do not sample" → single verify ) →
//   archive prior register → synthesis (dedup/merge/re-rank, continue TD numbering) →
//   deterministic bin/scan-*.js stages (schema / diagrams / HTML report).
//
// The number of finders scales with the slice list the probe derives, and slice
// DEPTH scales with budget.total when a turn target is set. KEEPS the brains:
// preflight + the deterministic bin/scan-*.js renderers.
//
// args shape:
//   {
//     projectDir: ".",          // optional — the project to scan
//     scanNumber: 12,           // optional — for the register header
//     maxSlicesHint: 40,        // optional — soft cap on derived slices
//     verify: "single",         // optional — "single" (default) | "none"
//   }

export const meta = {
  name: "gsd-t-scan",
  description:
    "GSD-T scan phase: preflight → volume-probe → pipeline(deep-finder per slice → single verify) → archive → synthesis → deep document cross-population (living docs + dimension files) → deterministic schema/diagram/HTML render. Fans out by codebase volume, not a fixed 5-teammate dimension count.",
  phases: [
    { title: "Preflight",   detail: "preflight + load prior register" },
    { title: "Probe",       detail: "volume probe → derive per-area slice list", model: "haiku" },
    { title: "Deep Scan",   detail: "pipeline: per-slice deep finder → single verify" },
    { title: "Synthesis",   detail: "dedup / merge / re-rank into techdebt.md", model: "opus" },
    { title: "Document",    detail: "deep living-doc + dimension-file + plain-English cross-population (per-doc fan-out)" },
    { title: "Render",      detail: "schema extraction + diagrams + HTML report" },
  ],
};

const lib = require("./_lib.js");
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectDir   = (args && args.projectDir) || ".";
const scanNumber   = (args && args.scanNumber) || null;
const maxSlicesHint = (args && args.maxSlicesHint) || 40;
const verifyMode   = (args && args.verify) || "single"; // "single" | "none"

// ───── Schemas ──────────────────────────────────────────────────────────────

// Probe output: a list of slices to fan out over. Each slice is one narrow area
// of the codebase a single deep-finder agent can exhaustively own.
const PROBE_SCHEMA = {
  type: "object",
  required: ["totals", "slices"],
  additionalProperties: false,
  properties: {
    totals: {
      type: "object",
      additionalProperties: true,
      description: "Headline counts: files, routes, tables, components, testFiles, topLevelDirs.",
    },
    slices: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["key", "paths", "dimension"],
        additionalProperties: false,
        properties: {
          key:       { type: "string", description: "kebab slice id, e.g. 'lib-billing' or 'routes-tenant-scoping'" },
          paths:     { type: "array", items: { type: "string" }, description: "globs/dirs this slice exhaustively owns" },
          dimension: {
            type: "string",
            enum: ["architecture", "business-rules", "security", "quality", "contracts", "feature-domain", "data-layer", "api-surface", "testing"],
          },
          why:       { type: "string", description: "what makes this slice worth a dedicated deep finder" },
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
          area:           { type: "string", description: "human area label, e.g. 'Multi-tenant isolation'" },
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
    confirmed: { type: "boolean", description: "true if the finding is real after checking the actual code" },
    verdict:   { type: "string", enum: ["confirmed", "false-positive", "needs-detail"] },
    note:      { type: "string" },
    correctedSeverity: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"] },
  },
};

const DOC_RESULT_SCHEMA = {
  type: "object",
  required: ["doc", "status", "path"],
  additionalProperties: false,
  properties: {
    doc:    { type: "string", description: "logical doc id, e.g. 'docs/architecture.md'" },
    status: { type: "string", enum: ["written", "merged", "skipped", "failed"] },
    path:   { type: "string" },
    bytes:  { type: "integer" },
    notes:  { type: "string" },
  },
};

const SYNTHESIS_SCHEMA = {
  type: "object",
  required: ["status", "registerPath", "counts"],
  additionalProperties: false,
  properties: {
    status:       { type: "string", enum: ["written", "failed"] },
    registerPath: { type: "string" },
    counts: {
      type: "object",
      required: ["critical", "high", "medium", "low"],
      properties: {
        critical: { type: "integer" },
        high:     { type: "integer" },
        medium:   { type: "integer" },
        low:      { type: "integer" },
        total:    { type: "integer" },
      },
    },
    archivePath:  { type: "string" },
    notes:        { type: "string" },
  },
};

// ───── Local-bin resolution for the deterministic bin/scan-*.js renderers ─────
// Mirrors verify.workflow.js::_runJsonCli — prefer project-local bin/, the scan
// renderers live in the GSD-T package bin/ which is the project root here.
function _runNode(scriptRelPath, evalExpr, argv = []) {
  const local = path.join(projectDir, scriptRelPath);
  if (!fs.existsSync(local)) return { ok: false, exitCode: 127, stderr: `missing ${scriptRelPath}` };
  const r = spawnSync(process.execPath, ["-e", evalExpr, ...argv], { cwd: projectDir, stdio: "pipe" });
  return {
    ok: r.status === 0,
    exitCode: r.status,
    stdout: r.stdout && r.stdout.toString(),
    stderr: r.stderr && r.stderr.toString(),
  };
}

// ───── Script body ────────────────────────────────────────────────────────────

phase("Preflight");
const pre = lib.runPreflight({ projectDir });
if (!pre.ok) {
  log(`preflight FAIL exitCode=${pre.exitCode} — halting scan`);
  return { status: "failed", reason: "preflight-failed", preflight: pre.envelope };
}
log("preflight OK");

// Load prior register (for dedup + TD-numbering continuation).
// Red-team fix (CRITICAL-1/CRITICAL-2/MEDIUM-1): the archive + TD-numbering must be
// DETERMINISTIC JS, not LLM prose — an agent told to "archive then rewrite" can
// clobber the register without archiving, and an agent told to "continue numbering"
// with no data hallucinates a start number → colliding TD IDs. So we do the rename
// here (collision-safe), parse the max TD number, and PASS the prior content into
// synthesis. This mirrors verify.workflow.js, where every destructive gate is
// deterministic code, not an agent instruction.
let priorRegister = null;
let priorArchivePath = null;
let tdStart = 1;
const registerPath = path.join(projectDir, ".gsd-t", "techdebt.md");

function _parseMaxTd(text) {
  // Match TD-1, TD-01, TD-001, TD-117 in any "### TD-NNN" or "TD-NNN" form.
  const nums = [];
  const re = /TD-0*(\d+)/g;
  let m;
  while ((m = re.exec(text)) !== null) nums.push(parseInt(m[1], 10));
  return nums.length ? Math.max(...nums) : 0;
}
function _archiveDateFrom(text, fallbackDate) {
  // Prefer an explicit YYYY-MM-DD in the header; else use the fallback (mtime-derived).
  const m = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return (m && m[1]) || fallbackDate;
}

if (fs.existsSync(registerPath)) {
  priorRegister = fs.readFileSync(registerPath, "utf8");
  tdStart = _parseMaxTd(priorRegister) + 1;
  // Derive archive date deterministically: header date, else file mtime (NOT Date.now —
  // unavailable in this runtime). Collision-safe suffixing.
  const mtime = fs.statSync(registerPath).mtime;
  const fallbackDate = mtime.toISOString().slice(0, 10);
  const archiveDate = _archiveDateFrom(priorRegister, fallbackDate);
  const scanDir = path.join(projectDir, ".gsd-t");
  let candidate = path.join(scanDir, `techdebt_${archiveDate}.md`);
  let counter = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(scanDir, `techdebt_${archiveDate}_${counter}.md`);
    counter += 1;
  }
  fs.renameSync(registerPath, candidate);
  priorArchivePath = candidate;
  log(`prior register archived → ${path.basename(candidate)} (${priorRegister.length} bytes); TD numbering continues at TD-${tdStart}`);
} else {
  log(`no prior register — TD numbering starts at TD-01`);
}

// ─── Volume probe — derive the slice list (this is the fix for the 5-teammate cap) ───
phase("Probe");
const probePrompt = [
  `You are the VOLUME PROBE for a GSD-T deep codebase scan of \`${projectDir}\`.`,
  ``,
  `Your job: measure the codebase's volume, then carve it into NARROW SLICES — one`,
  `slice per area that a single deep-finder agent can EXHAUSTIVELY own. The number`,
  `of slices MUST scale with volume: a tiny repo yields 1-3 slices; a large repo`,
  `(thousands of files, hundreds of routes/tables, many feature domains) yields`,
  `15-40. Do NOT default to a fixed 5 — that under-scaling is exactly the bug M66 fixes.`,
  ``,
  `How to slice (combine these axes — prefer FEATURE-DOMAIN slicing for large apps):`,
  `- By feature domain: each major business area (e.g. billing, scheduling, dispatch,`,
  `  work-orders, LMS, maintenance, integrations) is its own slice, owned end-to-end.`,
  `- By layer where a layer is huge: routes/API surface, data/schema layer, the`,
  `  largest component trees, async jobs/queues.`,
  `- By cross-cutting concern: tenant-isolation, secrets/config, auth, rate-limiting.`,
  `Each slice names the concrete \`paths\` (dirs/globs) it owns and a \`dimension\`.`,
  ``,
  `Use real tooling to measure: count files by extension, count route modules,`,
  `count ORM table definitions (e.g. pgTable/Entity/model), count components, list`,
  `top-level source dirs and their subdirs. Read package.json for the stack. If a`,
  `single dir (e.g. src/lib/) has many independent subdirs, each substantial subdir`,
  `is a candidate slice.`,
  ``,
  `Soft cap: aim for ≤ ${maxSlicesHint} slices. If volume genuinely exceeds that,`,
  `merge the smallest related areas but state in notes what you merged so depth loss`,
  `is visible (no silent truncation).`,
  ``,
  `Return JSON per the schema: totals (headline counts) + slices (the fan-out list).`,
].join("\n");

// Red-team fix: probe runs on SONNET, not haiku. The probe's whole job is to
// measure volume and resist under-slicing; a haiku probe that under-counts a large
// repo (truncated tooling output → guesses) would re-introduce the exact under-scaling
// M66 fixes. Sonnet is the right tier for this measurement+judgment task.
const probe = await agent(probePrompt, {
  label: "volume-probe",
  phase: "Probe",
  schema: PROBE_SCHEMA,
  model: "sonnet",
});

const slices = (probe && Array.isArray(probe.slices) && probe.slices) || [];
if (!slices.length) {
  log("probe returned no slices — halting (cannot scan with an empty slice list)");
  return { status: "failed", reason: "no-slices", probe };
}
log(`probe derived ${slices.length} slice(s) from totals=${JSON.stringify(probe.totals)}`);

// Red-team fix (HIGH-2): deterministic silent-truncation detection. If the probe hit
// the soft cap, the operator MUST be told whether coverage was merged away. CLAUDE.md
// forbids silent caps — so we surface a coverage-risk warning in code, not just prose.
if (slices.length >= maxSlicesHint) {
  if (probe.notes && /merg/i.test(probe.notes)) {
    log(`⚠ COVERAGE NOTE: probe hit the ${maxSlicesHint}-slice cap and merged areas — see probe.notes: ${probe.notes}`);
  } else {
    log(`⚠ COVERAGE RISK: probe returned ${slices.length} slices (≥ cap ${maxSlicesHint}) with NO documented merges. Some areas may be under-covered. Re-run with a higher maxSlicesHint to confirm full coverage.`);
  }
}

// budget-aware depth hint: with a larger turn target, finders are told to dig deeper.
// "thorough" and "MAXIMUM" are defined inline in the finder prompt so the hint is actionable.
const deep = budget && budget.total && budget.total > 300000 ? "MAXIMUM" : "thorough";

// ─── Deep scan — pipeline: per-slice deep finder → single verify (no barrier) ───
// pipeline() runs each slice through both stages independently: slice A can be in
// verify while slice B is still finding. Wall-clock = slowest single chain.
phase("Deep Scan");
const sliceResults = await pipeline(
  slices,
  // Stage 1 — deep finder. One agent OWNS one slice and enumerates exhaustively.
  (slice) => agent(
    [
      `You are a DEEP tech-debt finder for ONE slice of a GSD-T scan: \`${slice.key}\`.`,
      `Dimension: ${slice.dimension}. Owned paths: ${JSON.stringify(slice.paths)}.`,
      slice.why ? `Why this slice matters: ${slice.why}` : ``,
      ``,
      `MANDATE: ENUMERATE, do NOT sample. Walk EVERY file under your owned paths.`,
      `The legacy scan failed because one agent sampled the top ~5 issues across the`,
      `whole repo and stopped. You own only this slice, so go to the bottom of it.`,
      ``,
      `Depth = ${deep}. "thorough" = walk every file in your paths and report every`,
      `non-trivial real defect, high and medium confidence. "MAXIMUM" = additionally`,
      `include lower-confidence and speculative issues worth a human's review.`,
      `Surface every real defect: bugs, security holes, missing validation, broken`,
      `invariants, race conditions, dead/duplicated code, N+1s, untested critical`,
      `paths, contract drift, and domain-specific correctness flaws (e.g. money math,`,
      `state-machine gaps, timezone bugs, idempotency holes).`,
      ``,
      `For each finding give: title, severity (CRITICAL/HIGH/MEDIUM/LOW), a human area`,
      `label, concrete file:line refs, the detail, the impact, and a remediation.`,
      `Set confidence honestly. If this slice is a substantial area (many files), a`,
      `result of only 1-2 findings is suspicious — re-check before concluding it is`,
      `clean. If the slice is genuinely clean, return an empty findings array.`,
      ``,
      `Return JSON per the schema.`,
    ].filter(Boolean).join("\n"),
    { label: `find:${slice.key}`, phase: "Deep Scan", schema: FINDER_SCHEMA, model: "sonnet" }
  ),
  // Stage 2 — single verify pass (per user decision: single, not 3-vote).
  // Confirms each finding against the ACTUAL code; drops false positives.
  // Red-team fix (HIGH-3): pipeline() stage-2 contract is (prevResult, originalItem, index).
  // Defend against an unexpected runtime signature so a missing `slice` arg can never
  // throw `slice.key` and silently drop a whole slice's findings (which would resolve
  // to null at the pipeline level). Recover the key from the finder result if needed.
  async (finderResult, originalItem, _index) => {
    const slice = originalItem || {};
    const sliceKey = slice.key || (finderResult && finderResult.slice) || "unknown-slice";
    if (!finderResult || !Array.isArray(finderResult.findings)) {
      return { slice: sliceKey, findings: [] };
    }
    if (verifyMode === "none" || finderResult.findings.length === 0) {
      return { slice: sliceKey, findings: finderResult.findings || [] };
    }
    const verified = await parallel(
      finderResult.findings.map((f) => async () => {
        try {
          const v = await agent(
            [
              `You are a VERIFIER for one tech-debt finding. Confirm it against the ACTUAL code — do not trust the finder.`,
              `Open the referenced files and check the claim is real and correctly characterized.`,
              ``,
              `Finding: ${JSON.stringify(f)}`,
              ``,
              `Set confirmed=true only if the defect genuinely exists. If the finder`,
              `misread the code, return verdict="false-positive". If real but the`,
              `severity is wrong, set correctedSeverity. If real but underspecified,`,
              `verdict="needs-detail" (still kept). Return JSON per the schema.`,
            ].join("\n"),
            { label: `verify:${sliceKey}`, phase: "Deep Scan", schema: VERIFY_SCHEMA, model: "sonnet" }
          );
          if (!v || v.verdict === "false-positive" || v.confirmed === false) return null;
          return { ...f, severity: v.correctedSeverity || f.severity, _verify: v.verdict };
        } catch (e) {
          // verify errored — keep the finding flagged rather than silently drop it
          return { ...f, _verify: "verify-errored" };
        }
      })
    );
    return { slice: sliceKey, findings: verified.filter(Boolean), notes: finderResult.notes };
  }
);

const allFindings = sliceResults
  .filter(Boolean)
  .flatMap((r) => (r.findings || []).map((f) => ({ ...f, slice: r.slice })));
log(`deep scan complete: ${allFindings.length} verified findings across ${sliceResults.filter(Boolean).length} slices`);

// ─── Synthesis — archive prior register, dedup/merge/re-rank, write fresh register ───
phase("Synthesis");
// Red-team fix (CRITICAL-1/CRITICAL-2): the archive already happened in JS above.
// Synthesis no longer touches the archive — it gets the prior register CONTENT and the
// deterministically-computed starting TD number, so dedup + numbering can't hallucinate.
// Red-team fix (HIGH-1): synthesis ALSO writes the .gsd-t/scan/*.md dimension files the
// deterministic renderer (bin/scan-data-collector.js) reads, so the HTML report reflects
// real data instead of silently rendering a hollow shell. scanNumber (formerly dead) is
// threaded into the register header here.
const synthesisPrompt = [
  `You are the SYNTHESIS agent for a GSD-T deep scan of \`${projectDir}\`.`,
  `${slices.length} slices ran; ${allFindings.length} verified findings came back.`,
  scanNumber ? `This is scan #${scanNumber} — put it in the register header.` : ``,
  ``,
  priorRegister
    ? [
        `The prior register was ALREADY archived (in code) to \`${priorArchivePath ? path.basename(priorArchivePath) : "an archive"}\`.`,
        `Start TD numbering at TD-${tdStart} (computed deterministically from the highest`,
        `prior TD number — do NOT renumber existing items or restart at 1).`,
        `DEDUPLICATE against the prior register below: do not re-add a finding already`,
        `represented there; cross-reference the prior TD id instead.`,
        ``,
        `Prior register content (for dedup + numbering reference):`,
        "```markdown",
        priorRegister.slice(0, 20000),
        "```",
      ].join("\n")
    : `No prior register — start TD numbering at TD-${String(tdStart).padStart(2, "0")}.`,
  ``,
  `Verified findings:`,
  "```json",
  JSON.stringify(allFindings, null, 2),
  "```",
  ``,
  `Write a FRESH \`.gsd-t/techdebt.md\` (use the Write tool). Structure per the GSD-T`,
  `register format: a Summary table (CRITICAL/HIGH/MEDIUM/LOW counts), then sections`,
  `Critical → High → Medium → Low, each finding as \`### TD-NNN — {title}\` with`,
  `Area / Severity / Status: OPEN / Location (file:line) / Description / Impact /`,
  `Remediation / Milestone candidate fields. Re-rank globally by true severity, not`,
  `by slice order. De-duplicate findings that multiple slices surfaced (e.g. a`,
  `cross-cutting tenant-scoping gap) into one item that lists all locations.`,
  ``,
  `Write ONLY the register here. The .gsd-t/scan/*.md analysis files and the living`,
  `docs are produced by the Document phase that runs next (M67) — do not write them.`,
  ``,
  `Do NOT express effort in human-hours/days/sprints — GSD-T units only (domain/`,
  `wave/spawn/token-spend) per the effort-estimates rule. Then commit the new`,
  `register via git (you are on a feature branch; do not push).`,
  `Return JSON per the schema with the final counts and the archivePath`,
  `\`${priorArchivePath || ""}\`.`,
].filter(Boolean).join("\n");

const synthesis = await agent(synthesisPrompt, {
  label: "synthesis",
  phase: "Synthesis",
  schema: SYNTHESIS_SCHEMA,
  model: "opus",
});

if (!synthesis || synthesis.status !== "written") {
  log("synthesis did not write the register — halting before render");
  return { status: "failed", reason: "synthesis-failed", synthesis, findingCount: allFindings.length, archivePath: priorArchivePath };
}
// Deterministic confirmation the register actually landed (don't trust the agent's status alone).
if (!fs.existsSync(registerPath)) {
  log("synthesis reported written but .gsd-t/techdebt.md is absent — halting");
  return { status: "failed", reason: "register-missing", synthesis, archivePath: priorArchivePath };
}
log(`register written: ${JSON.stringify(synthesis.counts)}`);

// Read the synthesized register so the plain-English doc can mirror its EXACT
// TD-NNN ids / order (red-team HIGH-1: raw findings carry no TD ids, so a doc
// built only from findings would invent divergent numbering and break the
// cross-reference to techdebt.md). The register exists here (confirmed above).
let registerText = "";
try { registerText = fs.readFileSync(registerPath, "utf8"); } catch (_) {}

// ─── Document — deep living-doc + dimension-file cross-population (M67) ───
// M66 made the register deep but left doc cross-population as a non-deterministic
// "lead agent follow-on" — effectively dropped. M67 fans out one agent PER DOCUMENT,
// each drawing on the SAME slices + verified findings the finders produced, so the
// docs are as thorough as the register. Runs BEFORE Render so the HTML report reads
// the deep .gsd-t/scan/architecture.md (with the parseable file/LOC line) instead of
// a stub. Per-doc failures are non-fatal (the register is authoritative) but logged.
phase("Document");

// Red-team fix (HIGH-1): the living-doc agents "merge not overwrite" via prose, and a
// dirty working tree does NOT halt the scan (working-tree-state is a warn, not error).
// So a doc agent could clobber a user's UNCOMMITTED edits to docs/ or README.md —
// unrecoverable via git. Deterministic backstop: snapshot every existing living doc to
// .gsd-t/scan/.doc-backup/ BEFORE the fan-out, mirroring the deterministic archive the
// register gets. Recovery is then a plain file copy, regardless of git state.
const LIVING_DOCS = [
  "docs/architecture.md",
  "docs/workflows.md",
  "docs/infrastructure.md",
  "docs/requirements.md",
  "README.md",
];
const docBackupDir = path.join(projectDir, ".gsd-t", "scan", ".doc-backup");
const backedUp = [];
fs.mkdirSync(docBackupDir, { recursive: true });
for (const rel of LIVING_DOCS) {
  const src = path.join(projectDir, rel);
  if (fs.existsSync(src)) {
    const dest = path.join(docBackupDir, rel.replace(/[\/]/g, "__"));
    fs.copyFileSync(src, dest);
    backedUp.push(rel);
  }
}
if (backedUp.length) {
  log(`backed up ${backedUp.length} existing living doc(s) to .gsd-t/scan/.doc-backup/ before the document phase (recover by copying back if a merge clobbers content): ${backedUp.join(", ")}`);
}

const sliceSummary = slices.map((s) => `- ${s.key} (${s.dimension}): ${JSON.stringify(s.paths)}`).join("\n");
const findingsByArea = {};
for (const f of allFindings) {
  const k = (f.area || "general").toLowerCase();
  (findingsByArea[k] = findingsByArea[k] || []).push(f);
}
const findingsJson = JSON.stringify(allFindings, null, 2).slice(0, 40000);

// Each entry: { id, label, prompt }. mergeNote is appended to every living-doc prompt.
const mergeNote =
  `If the file already exists with real content: MERGE, and do it with the Edit tool ` +
  `(targeted section edits/appends) — do NOT call Write on a pre-existing file, because ` +
  `Write is a full overwrite that would destroy the user's structure and any content you ` +
  `did not reproduce. Preserve the user's structure and custom content; update/add sections. ` +
  `If the file is only placeholder/template tokens, you may replace it. If absent, create it ` +
  `with Write. Replace {Project Name}/{Date} tokens with real values (date from the system ` +
  `clock). Do NOT invent facts — derive everything from the slices, findings, and the actual ` +
  `code you read. (A pre-edit backup exists at .gsd-t/scan/.doc-backup/ as a safety net, but ` +
  `do not rely on it — edit carefully.)`;

const baseCtx = [
  `Project: \`${projectDir}\`. Probe totals: ${JSON.stringify(probe.totals)}.`,
  ``,
  `Slices the scan covered (your raw material — each names the paths it owns):`,
  sliceSummary,
  ``,
  `Verified findings (truncated):`,
  "```json",
  findingsJson,
  "```",
].join("\n");

const docTargets = [
  {
    id: "scan-architecture", label: "scan:architecture",
    prompt: `Write \`.gsd-t/scan/architecture.md\` — the architecture dimension analysis. Include stack, structure, patterns, a Components/Domains list (one per feature-domain slice), and data flow. ` +
      `CRITICAL for the HTML renderer: give the file+LOC GRAND TOTAL as a markdown TABLE ROW in EXACTLY this form (the renderer reads this exact shape and stops, so it is NOT double-counted):\n` +
      `\`| Grand Total | <N> files | <LOC> |\`  — e.g. \`| Grand Total | 1809 files | 250000 |\`, from the probe totals.\n` +
      `Do NOT also write a bare \`<N> files (~<LOC> LOC)\` GRAND-TOTAL line and do NOT write "Files analyzed: N". ` +
      `Per-directory \`<n> files (~<loc> LOC)\` lines inside a Structure section are fine (they describe individual dirs), but the authoritative TOTAL must be the single table row above.`,
  },
  {
    id: "scan-security", label: "scan:security",
    prompt: `Write \`.gsd-t/scan/security.md\` — the security findings. The renderer parses sections headed \`### SEC-H<n>: <title>\` (HIGH) / \`### SEC-M<n>: <title>\` (MEDIUM), each with \`- **Details**: …\` and \`- **Fix**: …\` bullets. Use that exact form for every security-area finding.`,
  },
  {
    id: "scan-quality", label: "scan:quality",
    prompt: `Write \`.gsd-t/scan/quality.md\` — quality / dead-code / duplication / test-gap findings. The renderer parses sections headed \`### DC-<n>: <title>\` (dead code), \`### TCG-<n>: <title>\` (test gap), or \`### TD-<n>: <title>\`, each with a \`\\\`file:line\\\`\` location line and \`- **Impact**: …\` / \`- **Suggestion**: …\` bullets. Use that exact form.`,
  },
  {
    id: "scan-business-rules", label: "scan:business-rules",
    prompt: `Write \`.gsd-t/scan/business-rules.md\` — embedded business logic discovered across the slices: validation rules, authorization rules, workflow/state-machine rules, calculation rules (pricing/scoring/quotas), integration rules (retry/fallback/timeout). For each: where implemented (file:line) and an assessment. Add an "Undocumented Rules" section for logic with no comments/docs.`,
  },
  {
    id: "scan-contract-drift", label: "scan:contract-drift",
    prompt: `Write \`.gsd-t/scan/contract-drift.md\` — compare \`.gsd-t/contracts/\` (if it exists) to the actual implementation: API endpoints vs api-contract, schema vs schema-contract, undocumented endpoints/tables/components, drift. If no contracts dir exists, write a short note saying so and list the de-facto interfaces worth documenting.`,
  },
  {
    id: "docs-architecture", label: "docs/architecture.md", merge: true,
    prompt: `Update or create \`docs/architecture.md\`: system overview (stack, structure, patterns); component descriptions with locations + dependencies (one section per feature-domain slice); data flow (request → handler → service → data layer → response); data models from schema/ORM; API structure from routes; external integrations; design decisions found in code/configs. Go deep — this should be a real architecture reference, not a stub.`,
  },
  {
    id: "docs-workflows", label: "docs/workflows.md", merge: true,
    prompt: `Update or create \`docs/workflows.md\`: trace USER JOURNEYS per feature-domain slice (each major business area gets its own end-to-end journey from entry point through handlers to data); technical workflows from cron jobs / queue workers / scheduled tasks; API workflows for multi-step operations; integration workflows for external syncing; state machines and approval flows discovered in code. One journey per feature-domain slice minimum.`,
  },
  {
    id: "docs-infrastructure", label: "docs/infrastructure.md", merge: true,
    prompt: `Update or create \`docs/infrastructure.md\` (the most commonly-lost knowledge): Quick Reference commands (package.json scripts, Makefile, CI/CD); local dev setup (README, docker-compose, .env.example); database commands (migrations, seeds, ORM, backups); cloud provisioning (Terraform/CFN/Pulumi/deploy scripts); credentials/secrets (NAMES ONLY from .env.example, never values); deployment (CI/CD, Dockerfiles, platform configs); logging/monitoring.`,
  },
  {
    id: "docs-requirements", label: "docs/requirements.md", merge: true,
    prompt: `Update or create \`docs/requirements.md\`: functional requirements discovered from routes/handlers/UI components; technical requirements from configs/package.json/runtime; non-functional requirements from performance configs, rate limits, caching. Derive from what the code actually does.`,
  },
  {
    id: "readme", label: "README.md", merge: true,
    prompt: `Update or create \`README.md\`: project name + description; tech stack + versions discovered; getting-started/setup (from infrastructure findings); brief architecture overview; link to \`docs/\` for detail. If it exists, MERGE — update tech-stack + setup sections but preserve the user's existing structure and custom content.`,
  },
  {
    id: "techdebt-plain-english", label: ".gsd-t/techdebt_in_plain_english.md",
    needsRegister: true, // red-team HIGH-1: must receive the synthesized register (TD-NNN ids live there, not in findings)
    prompt: `Write \`.gsd-t/techdebt_in_plain_english.md\` — a NON-TECHNICAL companion to the tech-debt register, written for a smart reader who is NOT an engineer (e.g. a founder, PM, or stakeholder). Cover EVERY item in the register (one entry per TD-NNN, in the same severity order), using the EXACT TD-NNN ids from the register provided below. For each item:\n` +
      `- **Heading**: \`### TD-NNN — <the plain-English name of the problem>\` (keep the TD-NNN id so it cross-references the technical register, but rename the title into everyday language — no jargon).\n` +
      `- **What it is** (1-2 sentences): explain the problem with ZERO technical terms. If a technical word is unavoidable, define it in parentheses the way you'd explain it to a friend.\n` +
      `- **Why it matters** (1-2 sentences): the business/user consequence — what could go wrong, who is affected, what it costs.\n` +
      `- **Real-world analogy**: a concrete everyday comparison that makes the risk intuitive (e.g. "This is like leaving the spare house key under the doormat — convenient, but anyone who thinks to look can get in." for a hardcoded secret). The analogy must genuinely map to THIS specific item, not be generic.\n` +
      `- **Severity in plain terms**: translate CRITICAL/HIGH/MEDIUM/LOW into urgency a non-engineer feels ("fix before launch" / "schedule soon" / "clean up eventually").\n` +
      `Open with a 2-3 sentence plain-English summary of the overall health of the codebase and the headline counts. Derive everything from the verified findings — do not invent items or analogies that don't fit. This file is the layman's lens on the same findings as \`.gsd-t/techdebt.md\`.`,
  },
];

const docResults = await parallel(
  docTargets.map((d) => async () => {
    const isLiving = !!d.merge;
    // red-team HIGH-1: targets that mirror the register (plain-english) get the
    // synthesized register text — the authoritative source of TD-NNN ids/order —
    // not just the raw findings.
    const registerBlock = d.needsRegister
      ? ["", "Synthesized register (.gsd-t/techdebt.md) — use these EXACT TD-NNN ids/order:", "```markdown", registerText.slice(0, 60000), "```"].join("\n")
      : "";
    const prompt = [
      `You are the documentation agent for ONE document in a GSD-T deep scan.`,
      ``,
      baseCtx,
      registerBlock,
      ``,
      d.prompt,
      ``,
      isLiving ? mergeNote : `Write the file fresh from the scan data in the format described.`,
      ``,
      `Read the actual code under the relevant slice paths to get specifics right —`,
      `do not summarize only from the findings. Use the Write/Edit tools to write the`,
      `file, then return JSON per the schema (status: "written" new, "merged" if you`,
      `merged into existing content, "skipped" if genuinely nothing to write, "failed"`,
      `on error). Do NOT commit — the workflow handles git.`,
    ].join("\n");
    try {
      return await agent(prompt, {
        label: d.label,
        phase: "Document",
        schema: DOC_RESULT_SCHEMA,
        model: "sonnet",
      });
    } catch (e) {
      return { doc: d.id, status: "failed", path: "", notes: `agent error: ${e && e.message}` };
    }
  })
);

const docsOk = docResults.filter(Boolean).filter((r) => r.status === "written" || r.status === "merged");
const docsFailed = docResults.filter(Boolean).filter((r) => r.status === "failed");
log(`document phase: ${docsOk.length}/${docTargets.length} docs written/merged${docsFailed.length ? `, ${docsFailed.length} failed (non-fatal — register is authoritative): ${docsFailed.map((d) => d.doc).join(", ")}` : ""}`);

// Deterministic check the renderer's required dimension file actually landed with the
// parseable file-count line (the render hollow-guard depends on it).
const archDimPath = path.join(projectDir, ".gsd-t", "scan", "architecture.md");
if (!fs.existsSync(archDimPath)) {
  log(`⚠ .gsd-t/scan/architecture.md was not written — the HTML report will render hollow. The techdebt.md register and docs/ are unaffected.`);
}

// ─── Render — deterministic schema extraction + diagrams + HTML report ───
// These bin/scan-*.js renderers are KEPT verbatim (M66 does not touch them).
// Red-team fix (HIGH-1): guard ALL FOUR required bin files (the eval requires four,
// not just scan-report.js), and detect a hollow report instead of claiming success.
phase("Render");
const requiredBins = [
  "bin/scan-data-collector.js",
  "bin/scan-schema.js",
  "bin/scan-diagrams.js",
  "bin/scan-report.js",
];
const missingBin = requiredBins.find((b) => !fs.existsSync(path.join(projectDir, b)));
let render;
if (missingBin) {
  render = { ok: false, exitCode: 127, stderr: `missing renderer ${missingBin}` };
  log(`render skipped — ${missingBin} not found (register is the primary artifact; report is optional)`);
} else {
  const renderExpr = `
const {collectScanData}=require('./bin/scan-data-collector.js');
const {extractSchema}=require('./bin/scan-schema.js');
const {generateDiagrams}=require('./bin/scan-diagrams.js');
const {generateReport}=require('./bin/scan-report.js');
const root=process.argv[1];
const analysisData=collectScanData(root);
const schemaData=extractSchema(root);
const diagrams=generateDiagrams(analysisData, schemaData, {projectRoot:root});
const r=generateReport(analysisData, schemaData, diagrams, {projectRoot:root});
if (r.outputPath) console.log(JSON.stringify({outputPath:r.outputPath, diagramsRendered:r.diagramsRendered, filesScanned:analysisData.filesScanned||0, findings:(analysisData.findings||[]).length}));
else console.error('report-failed:', r.error);
`;
  render = _runNode("bin/scan-report.js", renderExpr, [projectDir]);
}
let reportInfo = null;
let reportHollow = null;
if (render.ok) {
  try { reportInfo = JSON.parse((render.stdout || "").trim()); } catch (_) {}
  // A real scan ALWAYS has files. filesScanned===0 alone is a hollow signal —
  // do NOT require findings===0 too (that &&-guard was defeated by any non-empty
  // scan, where the security/quality findings parse but the file count does not).
  reportHollow = !!(reportInfo && reportInfo.filesScanned === 0);
  if (reportHollow) {
    log(`⚠ HTML report rendered but reads HOLLOW (filesScanned=0) — the architecture.md file/LOC line is missing or in an unparsed format. Report at ${reportInfo && reportInfo.outputPath}; the techdebt.md register is the authoritative artifact.`);
  } else {
    log(`HTML report: ${render.stdout && render.stdout.trim()}`);
  }
} else {
  // Non-fatal — the register is the primary artifact; the report is a nicety.
  log(`render stage non-fatal failure (exitCode=${render.exitCode}): ${render.stderr || render.stdout}`);
}

// Commit the docs + dimension files + HTML report deterministically (doc agents were
// told NOT to commit, to avoid interleaved concurrent git operations). Best-effort:
// a commit failure is non-fatal (artifacts are on disk).
// Red-team fix (LOW): drop `-f` — none of these targets are gitignored, and `-f` would
// force-add gitignored junk under the pathspecs (e.g. docs/.DS_Store). The .doc-backup
// dir lives under .gsd-t/scan/ which IS committed; exclude it explicitly so backups
// aren't versioned.
const commit = spawnSync(
  "git",
  ["add", "-A", ".gsd-t/scan", ".gsd-t/techdebt_in_plain_english.md", "docs", "README.md", ":!.gsd-t/scan/.doc-backup"],
  { cwd: projectDir, stdio: "pipe" }
);
if (commit.status === 0) {
  const ci = spawnSync(
    "git",
    ["commit", "-q", "-m", `scan: deep document cross-population (${docsOk.length} docs) + HTML report`],
    { cwd: projectDir, stdio: "pipe" }
  );
  if (ci.status === 0) log("docs + report committed");
  else log(`docs staged but commit skipped (likely nothing to commit or hook): ${ci.stderr && ci.stderr.toString().slice(0, 200)}`);
} else {
  log(`doc git add non-fatal failure: ${commit.stderr && commit.stderr.toString().slice(0, 200)}`);
}

return {
  status: "complete",
  slices: slices.length,
  findings: allFindings.length,
  counts: synthesis.counts,
  registerPath,
  archivePath: priorArchivePath,
  docs: docResults,
  docsWritten: docsOk.length,
  docsFailed: docsFailed.map((d) => d.doc),
  htmlReport: reportInfo ? reportInfo.outputPath : null,
  reportHollow,
  probeTotals: probe.totals,
};
