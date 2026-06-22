// templates/workflows/gsd-t-execute.workflow.js
//
// IMPORTANT: this file is NOT executable via `node` directly. It is a script
// body for the Anthropic native Workflow tool, which wraps the body in an
// async runtime and exposes globals: agent(), parallel(), pipeline(), log(),
// phase(), budget, args. Top-level await + return are runtime-legal in that
// context. To run: invoke the Workflow tool with {script: this file contents,
// args: {milestone, domains, projectDir?}}.
//
// Canonical native-Workflow implementation of the GSD-T execute phase.
// Replaces the orchestrator/worker/parallel/spawn-plan scaffolding with a
// single deterministic Workflow script. KEEPS the brains: preflight,
// context-brief, file-disjointness, verify-gate — all invoked from inside
// stages via templates/workflows/_lib.js helpers.
//
// M89: Stated-Claims→classify→research wiring (auto-research-contract v1.2.0 §6.5/§1/§2/§3/§4/§7).
// Domain workers embed the Stated-Claims snippet (§6.5) so agents tag load-bearing claims
// KNOWN|GUESSED. After domain workers, the Research phase iterates GUESSED entries through
// bin/gsd-t-research-gate.cjs: external → write §7 marker (status=uncited) → research agent
// (model:"fable") → cite → flip marker (status=cited). Internal → grep/Read; grep-empty →
// escalate to external research + cite + marker (§5.1 ambiguous escalation). Idempotent per §4.1
// (exact normalized claim-key match only). Wave is a pure composer and does NOT embed this wiring
// (M85 zero-model: invariant; research reaches wave via its execute sub-workflow).
//
// M90 §2 D4-T4: Architectural-trigger wiring (protocol-class path, R-ARCH-2 "everywhere" feed).
// After domain workers, compute the extend-existing-code signal from each domain's filesTouched:
// any file that already existed on disk before this execute run is extend-class (the task EXTENDED
// existing code rather than creating net-new). For each such domain, fire the arch trigger (R-ARCH-2)
// via the inline runCli helper. This is the NAMED PRODUCER: the signal is computed from real
// runtime inputs (filesTouched vs. on-disk existence), never from a seeded injection.
// Result is logged + stored in domainArchTriggerResults for verify gate (R-FAIL-2: if the trigger
// fires with provenByAdversaryOnly=true and the flag is unresolved, verify FAILS).
// Contract: unproven-assumption-doctrine-contract.md §2 (R-ARCH-2, protocol-class path).
//
// Invocation contract:
//   The Workflow tool reads this file's `meta` block and runs the script
//   body. `args` is the JSON object passed in via Workflow({args}). Expected
//   shape:
//     {
//       milestone: "M61",
//       domains:   ["m61-d6-migrate-orchestration-to-workflow", ...],
//       projectDir: ".",    // optional
//     }

export const meta = {
  name: "gsd-t-execute",
  description:
    "Run a GSD-T execute phase: preflight → brief → parallel domain workers → research (Stated-Claims) → integrate barrier → verify-gate",
  phases: [
    { title: "Preflight",    detail: "gsd-t preflight + brief generation" },
    { title: "Disjointness", detail: "prove tasks are file-disjoint" },
    { title: "Domains",      detail: "parallel domain workers" },
    { title: "Research",     detail: "classify GUESSED claims + cite external via web research (§6.5/§1/§2/§7)" },
    { title: "Integrate",    detail: "cross-domain wire-up" },
    { title: "Verify-Gate",  detail: "two-track verify-gate" },
  ],
};

// ───── Shared schemas (re-used across stages) ───────────────────────────────

const DOMAIN_RESULT_SCHEMA = {
  type: "object",
  required: ["domain", "status", "filesTouched"],
  additionalProperties: false,
  properties: {
    domain:       { type: "string" },
    status:       { type: "string", enum: ["complete", "partial", "blocked", "failed"] },
    filesTouched: { type: "array", items: { type: "string" } },
    tasksDone:    { type: "array", items: { type: "string" } },
    tasksBlocked: { type: "array", items: { type: "string" } },
    notes:        { type: "string" },
    // M89 §6.5 — Stated Claims: raw [GUESSED:*] lines emitted by the worker (§6.5 DETECT seam).
    // Each entry is the full bullet text e.g. "[GUESSED:assumed] the create call returns a `url`".
    // The Research phase iterates these through bin/gsd-t-research-gate.cjs.
    statedClaims: { type: "array", items: { type: "string" } },
    // Primary artifact path written by this worker (used by Research phase to write/flip §7 markers).
    artifactPath: { type: "string" },
  },
};

// M89 §7 — ENFORCE marker format helpers (normalize claim-key per §4.1)
// Normalize: lowercase, then collapse EVERY non-word run to a single space (cycle-2
// finding #1) so the key is marker-syntax-safe (no "="/"<"/">"/"-"); byte-identical
// across all 4 workflows (enforced by m89-normalize-claim-key-parity).
function normalizeClaimKey(claim) {
  return claim.toLowerCase().replace(/[^\w]+/g, " ").trim();
}

// M89 §7 — marker templates
function uncitedMarker(key) {
  return `<!-- auto-research-claim: class=external key=${key} status=uncited -->`;
}
function citedMarker(key) {
  return `<!-- auto-research-claim: class=external key=${key} status=cited -->`;
}

// M89 §2 — research stage schema (StructuredOutput from research-subagent)
const RESEARCH_RESULT_SCHEMA = {
  type: "object",
  required: ["ok", "gapKey"],
  additionalProperties: true,
  properties: {
    ok:         { type: "boolean" },
    gapKey:     { type: "string" },
    citedBlock: { type: "string" },
    sourceUrls: { type: "array", items: { type: "string" } },
    fetchDates: { type: "array", items: { type: "string" } },
    reason:     { type: "string" },
  },
};

// M89 §1 — classify a guessed claim via bin/gsd-t-research-gate.cjs (D1 envelope)
async function classifyClaim(projectDir, claimText, phaseName) {
  return runCli(projectDir, "research-gate", ["classify", claimText, "--json"], "gsd-t-research-gate.cjs", "classify-claim", true, phaseName);
}

// M89 §4.1 — check if a cited marker already exists in artifact text (exact key match)
function isAlreadyCited(artifactText, claimKey) {
  const needle = `auto-research-claim: class=external key=${claimKey} status=cited`;
  return artifactText.includes(needle);
}

// M89 §5.1 — grep the repo for an internal claim via an agent Bash call
async function grepForClaim(projectDir, claimText, phaseName) {
  const escaped = claimText.replace(/'/g, "'\\''").slice(0, 200);
  const prompt = [
    `Decide whether THIS repo's own code/contracts/tests CONFIRM the SPECIFIC claim — not merely`,
    `share vocabulary with it (Red Team MEDIUM). Project: \`${projectDir}\`. Claim: "${escaped}"`,
    `Run: \`grep -r --include="*.js" --include="*.ts" --include="*.md" --include="*.cjs" -l "${escaped.slice(0, 60)}" "${projectDir}" 2>/dev/null | head -5\``,
    `Also try: \`grep -r -l "${escaped.slice(0, 40)}" "${projectDir}" 2>/dev/null | head -5\``,
    `Then Read the candidates and judge: set found=true ONLY IF the repo content actually CONFIRMS`,
    `the value/shape/behavior the claim asserts. Coincidental keyword overlap = found=false.`,
    `If the claim is about an EXTERNAL system's behavior (3rd-party API, library, browser, protocol),`,
    `grep CANNOT confirm it → found=false so it escalates to web research.`,
    `Return JSON: { "found": <boolean>, "matches": ["<file>", ...] }. Do ONLY this. No other work.`,
  ].join("\n");
  const schema = { type: "object", required: ["found"], additionalProperties: true, properties: { found: { type: "boolean" }, matches: { type: "array", items: { type: "string" } } } };
  const r = await agent(prompt, { label: "grep-internal-claim", model: "haiku", schema, phase: phaseName })
    .catch(() => ({ found: false, matches: [] }));
  return r || { found: false, matches: [] };
}

// M89 §1.1 — the AMBIGUOUS → LLM JUDGE. When the mechanical classifier finds no string
// fact (class:ambiguous), the LLM decides internal/external/uncertain in natural language.
// Bare model:"fable" (the research tier — NOT the ?? override form; "judge" is not a
// designated stage). Returns the verdict string; on any error → "uncertain" (fail toward
// research — never guess-internal). The caller treats external/uncertain as research.
const CLASSIFY_JUDGE_SCHEMA = {
  type: "object", required: ["verdict"], additionalProperties: true,
  properties: { verdict: { type: "string", enum: ["internal", "external", "uncertain"] }, reason: { type: "string" } },
};
async function judgeAmbiguous(claimText, phaseName) {
  const prompt = [
    `You are the M89 ambiguous-claim JUDGE (auto-research-contract §1.1). The mechanical`,
    `string-fact classifier could not decide this GUESSED claim, so decide it in natural language.`,
    ``,
    `Claim: "${claimText}"`,
    ``,
    `- "internal"  = about THIS repo's OWN code / contracts / schema / tests — grep/Read can confirm.`,
    `- "external"  = asserts an OUTSIDE system's behavior/shape/limit (3rd-party API, library, browser,`,
    `                protocol, spec) and is unverified — needs web research.`,
    `- "uncertain" = you cannot CONFIDENTLY place it as internal. Use freely — per M89 doctrine an`,
    `                unverified claim is RESEARCHED, never guessed.`,
    ``,
    `Return JSON: { "verdict": "internal"|"external"|"uncertain", "reason": "<one line>" }.`,
    `Do NOT modify files. Do NOT run web searches in THIS step — only decide the verdict.`,
  ].join("\n");
  const r = await agent(prompt, { label: "classify-judge", model: "fable", schema: CLASSIFY_JUDGE_SCHEMA, phase: phaseName })
    .catch((e) => ({ verdict: "uncertain", reason: `judge error: ${e && e.message}` }));
  return (r && r.verdict) || "uncertain";
}

const INTEGRATE_RESULT_SCHEMA = {
  type: "object",
  required: ["status", "crossDomainEdits"],
  additionalProperties: false,
  properties: {
    status:           { type: "string", enum: ["green", "warnings", "failed"] },
    crossDomainEdits: { type: "array", items: { type: "string" } },
    notes:            { type: "string" },
  },
};

// ───── Script body ──────────────────────────────────────────────────────────

// M81: runtime-native helpers (sandbox bans require/fs/path/child_process/process — the
// old require("./_lib.js")+require("path") crashed this on first eval, TD-113). CLI calls
// delegate to an agent's Bash; file reads (scope.md/tasks.md) move INTO the worker agent
// (it has Read). args arrives as a JSON STRING in this runtime. See gsd-t-scan.workflow.js.
const _args = (typeof args === "string") ? (() => { try { return JSON.parse(args); } catch { return {}; } })() : (args || {});
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
async function proveFileDisjointness(projectDir, domains, label = "disjointness", phaseName) {
  const argv = ["--dry-run"];
  for (const d of (domains || [])) { argv.push("--domain", d); }
  return runCli(projectDir, "parallel", argv, "gsd-t-parallel.cjs", label, false, phaseName);
}
async function generateBrief(projectDir, { kind = "execute", milestone, domain, id, label = "brief", phaseName } = {}) {
  const argv = ["--kind", kind, "--spawn-id", id, "--out", `${projectDir}/.gsd-t/briefs/${id}.json`];
  if (milestone) argv.push("--milestone", milestone);
  if (domain) argv.push("--domain", domain);
  const r = await runCli(projectDir, "brief", argv, "gsd-t-context-brief.cjs", label, false, phaseName);
  return { ok: r.ok, briefPath: `${projectDir}/.gsd-t/briefs/${id}.json`, via: r.via };
}

const projectDir = _args.projectDir || ".";
const milestone  = _args.milestone || null;
const domains    = (Array.isArray(_args.domains) && _args.domains) || [];

if (!milestone) {
  log("execute: no milestone provided — args.milestone is required");
  return { status: "failed", reason: "missing-milestone" };
}
if (!domains.length) {
  log("execute: no domains — args.domains is required (non-empty list)");
  return { status: "failed", reason: "no-domains" };
}

phase("Preflight");
log(`execute: milestone=${milestone}, domains=${domains.length}`);
const pre = await runPreflight(projectDir);
if (!pre.ok) {
  log(`preflight FAIL — exitCode=${pre.exitCode}: ${pre.stderr || "(no stderr)"}`);
  return { status: "failed", reason: "preflight-failed", preflight: pre.envelope };
}
log(`preflight OK`);

phase("Disjointness");
// 4.8-audit fix: scope disjointness to the requested domain set, not the whole project.
// Without this, an unrelated DRAFT domain elsewhere in the project could flip the result.
const disj = await proveFileDisjointness(projectDir, domains);
if (!disj.ok) {
  log(`disjointness FAIL — exitCode=${disj.exitCode}: ${disj.stderr || disj.stdout}`);
  return { status: "failed", reason: "non-disjoint" };
}
log(`disjointness OK`);

phase("Domains");
const domainResults = await parallel(
  domains.map((domain) => async () => {
    // 4.8-audit fix: per-domain brief (M55-D2 brief-per-spawn semantic) — each worker
    // gets a brief scoped to its own domain so grep-the-brief is most effective.
    // M81: generated via an awaited agent (sandbox-safe); the worker reads its own
    // scope.md/tasks.md (it has Read) instead of the orchestrator pre-reading via fs.
    const domBrief = await generateBrief(projectDir, { kind: "execute", milestone, domain, id: `execute-${(milestone || "m").toLowerCase()}-${domain}`, phaseName: "Domains", label: `brief:${domain}` });
    const briefRef = domBrief.ok ? domBrief.briefPath : "(brief generation failed — re-walk repo)";
    const scopePath = `${projectDir}/.gsd-t/domains/${domain}/scope.md`;
    const tasksPath = `${projectDir}/.gsd-t/domains/${domain}/tasks.md`;
    const prompt = [
      `You are the worker agent for the GSD-T domain \`${domain}\` in milestone \`${milestone}\`.`,
      ``,
      `FIRST, read these two files in full (do NOT skip or truncate them):`,
      `- Scope (your owned files): \`${scopePath}\``,
      `- Tasks: \`${tasksPath}\``,
      ``,
      `Your job: execute every task listed under "## Tasks" in tasks.md, respecting the file ownership in scope.md.`,
      ``,
      `**Brief (REQUIRED READ):** ${briefRef} — if present, grep this JSON first instead of re-reading CLAUDE.md and contracts.`,
      ``,
      `Constraints:`,
      `- Touch only files in your scope's "Owned Files" list.`,
      `- Make commits via bash/git tools FIRST as you complete each task or task group, THEN emit the final StructuredOutput JSON describing what you did. Do not skip commits to satisfy the schema faster.`,
      `- Update affected docs (progress.md Decision Log, architecture.md, contracts/, requirements.md, README.md) per the Document Ripple Completion Gate in CLAUDE.md — in the SAME commits as the code changes.`,
      `- If a task is blocked (dependency not met), record it in tasksBlocked and continue with the next.`,
      `- Return a JSON object matching the StructuredOutput schema. The "status" field is the OVERALL domain status: "complete" if all tasks done, "partial" if some done and some blocked, "blocked" if you couldn't start, "failed" on error.`,
      ``,
      `**M89 STATED CLAIMS — REQUIRED (auto-research-contract §6.5):**`,
      `Read \`${projectDir}/templates/prompts/stated-claims-snippet.md\` for the full DETECT protocol.`,
      `Before returning your StructuredOutput, emit a \`## Stated Claims\` section listing every`,
      `load-bearing claim you relied on, tagged [KNOWN] or [GUESSED:assumed|unknown|stale].`,
      `In your StructuredOutput JSON, include a "statedClaims" array: one entry per [GUESSED:*] line`,
      `(the full bullet text). Also include "artifactPath" if you wrote a primary output artifact`,
      `(the markdown or file path the Research phase should write §7 markers into).`,
    ].join("\n");

    try {
      return await agent(prompt, {
        label: `worker:${domain}`,
        phase: "Domains",
        model: "sonnet",  // 4.8-audit fix: explicit per Model Display contract
        schema: DOMAIN_RESULT_SCHEMA,
      });
    } catch (e) {
      return {
        domain,
        status: "failed",
        filesTouched: [],
        notes: `agent error: ${e && e.message}`,
      };
    }
  })
);

const blocking = domainResults.filter(Boolean).filter((r) => r.status === "failed");
if (blocking.length) {
  log(`${blocking.length} domain(s) failed — halting before integrate`);
  return { status: "failed", reason: "domain-failed", domainResults };
}

// ── M89 Research Phase — Stated-Claims→classify→cite (§6.5/§1/§2/§3/§4/§7) ──
phase("Research");

// Collect all GUESSED claims from all domain workers (§6.5 DETECT seam)
const allGuessedClaims = [];
for (const dr of domainResults.filter(Boolean)) {
  if (Array.isArray(dr.statedClaims) && dr.statedClaims.length > 0) {
    for (const claimLine of dr.statedClaims) {
      // Parse "[GUESSED:type] claim text" → extract the claim text
      const m = claimLine.match(/^\[GUESSED:[^\]]+\]\s*(.+)$/);
      if (m) {
        allGuessedClaims.push({ claimText: m[1].trim(), domain: dr.domain, artifactPath: dr.artifactPath || null, rawLine: claimLine });
      }
    }
  }
}

if (allGuessedClaims.length === 0) {
  log("Research: no GUESSED claims found — skipping classify+research loop");
} else {
  log(`Research: ${allGuessedClaims.length} GUESSED claim(s) to classify`);

  // Read artifact text for idempotency check (§4.1 — exact key match)
  // Artifacts are read once per unique path via an agent Bash call
  const artifactCache = {};
  async function readArtifact(artifactPath) {
    if (!artifactPath) return "";
    if (artifactCache[artifactPath] !== undefined) return artifactCache[artifactPath];
    const r = await agent(
      `Read the file at \`${artifactPath}\` and return its full text content in a JSON object: { "text": "<file content>" }. If the file does not exist, return { "text": "" }.`,
      { label: "read-artifact", model: "haiku", schema: { type: "object", required: ["text"], properties: { text: { type: "string" } }, additionalProperties: false }, phase: "Research" }
    ).catch(() => ({ text: "" }));
    const t = (r && r.text) || "";
    artifactCache[artifactPath] = t;
    return t;
  }

  // Write §7 marker and cited block to artifact via agent Bash (§7 marker lifecycle)
  async function writeMarkerAndCite(artifactPath, claimKey, citedBlock) {
    if (!artifactPath) return;
    const marker = uncitedMarker(claimKey);
    const flipped = citedMarker(claimKey);
    const prompt = [
      `You are performing a precise file edit. Path: \`${artifactPath}\`.`,
      `Do the following in order:`,
      `0. Ensure the parent directory exists (Bash: \`mkdir -p "$(dirname '${artifactPath.replace(/'/g, "'\\''")}')"\`) — the path may be a deterministic fallback artifact that does not exist yet.`,
      `1. Read the file (use the Read tool). If it does not exist, treat its content as empty.`,
      `2. If the file does not contain the line \`${marker}\`, APPEND this block to the end of the file:`,
      `   \`\`\``,
      `   ${marker}`,
      `   ${citedBlock}`,
      `   \`\`\``,
      `3. If the file already contains \`${marker}\`, replace it with \`${flipped}\` and also append the cited block if not already present.`,
      `4. If the file already contains \`${flipped}\`, do nothing (already cited — idempotent per §4.1).`,
      `Use the Edit or Write tool to apply the change. Return JSON: { "done": true, "action": "appended|replaced|noop" }.`,
    ].join("\n");
    await agent(prompt, { label: "write-marker-cite", model: "haiku", schema: { type: "object", required: ["done"], properties: { done: { type: "boolean" }, action: { type: "string" } }, additionalProperties: true }, phase: "Research" })
      .catch((e) => log(`write-marker-cite error: ${e && e.message}`));
    // Invalidate cache so subsequent reads see the updated file
    delete artifactCache[artifactPath];
  }

  async function writeUncitedMarker(artifactPath, claimKey) {
    if (!artifactPath) return;
    const marker = uncitedMarker(claimKey);
    const safePath = artifactPath.replace(/'/g, "'\\''");
    const prompt = [
      `Ensure the parent directory exists, then append this line to the file \`${artifactPath}\` (only if not already present — exact string match):`,
      `\`${marker}\``,
      `Use Bash: \`mkdir -p "$(dirname '${safePath}')" && { grep -qF '${marker.replace(/'/g, "'\\''")}' '${safePath}' 2>/dev/null || echo '${marker.replace(/'/g, "'\\''")}' >> '${safePath}'; }\``,
      `Return JSON: { "done": true }.`,
    ].join("\n");
    await agent(prompt, { label: "write-uncited-marker", model: "haiku", schema: { type: "object", required: ["done"], properties: { done: { type: "boolean" } }, additionalProperties: true }, phase: "Research" })
      .catch((e) => log(`write-uncited-marker error: ${e && e.message}`));
    delete artifactCache[artifactPath];
  }

  // Process each GUESSED claim sequentially (classify → route)
  for (const { claimText, domain, artifactPath, rawLine } of allGuessedClaims) {
    const claimKey = normalizeClaimKey(claimText);
    log(`Research: classifying claim "${claimText.slice(0, 60)}" [domain=${domain}]`);

    // FAIL-CLOSED (Red Team HIGH): artifactPath is worker-self-reported + optional. An EXTERNAL
    // (or ambiguous→escalated-external) guess MUST still get its §7 uncited marker written
    // SOMEWHERE, or the §7 ENFORCE gate finds nothing and the guess ships uncited+unresearched.
    // So the external/escalation path writes to a DETERMINISTIC FALLBACK ARTIFACT when the worker
    // reported no path. Internal/grep can still no-op safely.
    const claimSlug = claimKey.replace(/\s+/g, "-").slice(0, 80) || "claim";
    const externalArtifact = artifactPath || `${projectDir}/.gsd-t/research/${(domain || "domain")}-${claimSlug}.md`;

    // §4.1 idempotency — skip if already cited (exact key match). Read the path actually
    // WRITTEN (externalArtifact = real path OR the deterministic fallback) so a re-run does
    // NOT re-research a claim already cited in the fallback artifact (Red Team MEDIUM).
    const artifactText = await readArtifact(externalArtifact);
    if (isAlreadyCited(artifactText, claimKey)) {
      log(`Research: skip "${claimKey.slice(0, 50)}" — already cited (§4.1 idempotent)`);
      continue;
    }

    // Classify the claim (D1 envelope)
    const cls = await classifyClaim(projectDir, claimText, "Research");
    const envelope = cls.envelope;
    if (!envelope || !envelope.ok) {
      log(`Research: classify error for "${claimText.slice(0, 50)}" — ${cls.stderr || JSON.stringify(envelope)}`);
      continue;
    }

    // External-claim handler (§7 marker → research(fable) → cite → flip). Closure so the
    // ambiguous→judge path reuses it for an "external"/"uncertain" verdict.
    const doExternal = async () => {
      log(`Research: external claim → write §7 marker + fable research for "${claimKey.slice(0, 50)}"${artifactPath ? "" : " (FALLBACK artifact — worker reported no path)"}`);
      // §7: write uncited marker at classify time (to the real OR fallback artifact — fail-CLOSED)
      await writeUncitedMarker(externalArtifact, claimKey);

      // §2: research agent — bare "fable" tier literal (NOT the ??-override form; contract §2)
      const researchPrompt = [
        `Read \`${projectDir}/templates/prompts/research-subagent.md\` for the full research protocol.`,
        `Your task: verify this external guessed claim via live web sources.`,
        `Claim: "${claimText}"`,
        `Gap-key (normalized): "${claimKey}"`,
        `Emit a ## Verified Facts (auto-research) block with source URL + fetch date per the protocol. Append the trailer \`key: ${claimKey}\` on every fact line so the §7 gate matches by claim-key (Red Team MEDIUM #2).`,
        `Return StructuredOutput JSON per the schema.`,
      ].join("\n");
      const researchResult = await agent(researchPrompt, {
        label: "research",
        model: "fable",
        schema: RESEARCH_RESULT_SCHEMA,
        phase: "Research",
      }).catch((e) => ({ ok: false, gapKey: claimKey, reason: `research agent error: ${e && e.message}` }));

      if (researchResult && researchResult.ok && researchResult.citedBlock) {
        // §7: flip marker to cited + write cited block (real OR fallback artifact)
        await writeMarkerAndCite(externalArtifact, claimKey, researchResult.citedBlock);
        log(`Research: cited "${claimKey.slice(0, 50)}" — marker flipped to status=cited`);
      } else {
        log(`Research: research FAILED for "${claimKey.slice(0, 50)}" — marker stays uncited. Reason: ${(researchResult && researchResult.reason) || "unknown"}`);
      }
    };

    // Internal-claim handler — grep/Read (A3); grep-empty → escalate to external (§5.1).
    const doInternal = async () => {
      log(`Research: internal claim → grep/Read for "${claimText.slice(0, 50)}"`);
      const grepResult = await grepForClaim(projectDir, claimText, "Research");
      if (grepResult.found) {
        log(`Research: internal claim resolved by grep (${(grepResult.matches || []).join(", ").slice(0, 80)}) — no research needed`);
        // No marker, no research stage (A3 — internal class never enters research)
      } else {
        // §5.1 escalation: grep-empty → escalate to external. Reuse doExternal() (same
        // marker→research→cite→flip path, incl. the key: trailer) instead of duplicating it.
        log(`Research: grep returned nothing — escalating ambiguous claim to external (§5.1): "${claimText.slice(0, 50)}"`);
        await doExternal();
      }
    };

    // ── Dispatch by the 3-result classifier verdict (v1.3.0) ──────────────────
    if (envelope.class === "external") {
      await doExternal();
    } else if (envelope.class === "internal") {
      await doInternal();
    } else {
      // class:AMBIGUOUS — no string fact; the LLM judge decides (NOT regex). internal→grep;
      // external→research; UNCERTAIN→research (uncertain = verify, NEVER guess-internal).
      log(`Research: ambiguous claim → LLM judge for "${claimText.slice(0, 50)}" (no string fact; when unsure, research)`);
      const verdict = await judgeAmbiguous(claimText, "Research");
      log(`Research: ambiguous claim "${claimKey.slice(0, 50)}" → judge verdict: ${verdict}`);
      if (verdict === "internal") {
        await doInternal();
      } else {
        if (verdict === "uncertain") log(`Research: judge UNCERTAIN → treating "${claimKey.slice(0, 50)}" as external → research (no silent guess)`);
        await doExternal();
      }
    }
  }
}

// ── M90 §2 D4-T4 — Arch-Trigger (protocol-class, extend-existing-code signal) ──
// For each domain, compute the extend-existing-code signal: any file in filesTouched that
// already existed on disk before this execute run → extend-class → fire the arch trigger.
// PRODUCER: signal is computed from real runtime inputs (filesTouched vs. on-disk check).
// The trigger is best-effort (non-blocking): log results for verify gate; don't halt execute.
const domainArchTriggerResults = [];
for (const dr of domainResults.filter(Boolean)) {
  if (!Array.isArray(dr.filesTouched) || dr.filesTouched.length === 0) continue;
  // Check which files existed on disk before this run (extend-class signal).
  // agent()-Bash: check existence via `test -f <file>` for each touched file.
  const touchedFiles = dr.filesTouched.slice(0, 10); // cap at 10 per domain
  const checkResult = await agent(
    [
      `For the project at \`${projectDir}\`, check which of these files existed on disk BEFORE the current execute run.`,
      `Files to check: ${JSON.stringify(touchedFiles)}`,
      `For each file, run: \`test -f '${projectDir}/<file>' && echo EXISTS || echo ABSENT\` (substitute <file> with the actual path).`,
      `Return JSON: { "existingFiles": ["<file>", ...] } — list ONLY files that exist (exit 0 from test -f).`,
      `Do NOT modify any files. Read-only existence check.`,
    ].join("\n"),
    {
      label: `arch-trigger-exist-check:${dr.domain}`,
      phase: "Research",
      model: "haiku",
      schema: {
        type: "object", required: ["existingFiles"],
        properties: { existingFiles: { type: "array", items: { type: "string" } } },
        additionalProperties: true,
      },
    }
  ).catch(() => ({ existingFiles: [] }));

  const existingFiles = Array.isArray(checkResult && checkResult.existingFiles) ? checkResult.existingFiles : [];
  if (existingFiles.length === 0) continue; // no extend-class signal for this domain

  // Signal confirmed: domain extended existing code → fire arch trigger (R-ARCH-2)
  const triggerInput = JSON.stringify({
    type: "extend-existing-code",
    context: `domain:${dr.domain} extended existing files: ${existingFiles.slice(0, 3).join(", ")}`,
    basis: `Execute domain ${dr.domain} edited existing file(s): ${existingFiles.slice(0, 3).join(", ")}`,
  });
  const triggerResult = await runCli(
    projectDir,
    "architectural-trigger",
    ["trigger", triggerInput],
    "gsd-t-architectural-trigger.cjs",
    `arch-trigger:${dr.domain}`,
    true,
    "Research"
  );
  const triggerEnv = triggerResult.envelope || {};
  log(`M90 arch-trigger ${dr.domain}: fired=${triggerEnv.fired} reason=${triggerEnv.reason || "?"} provenByAdversaryOnly=${triggerEnv.provenByAdversaryOnly || false}`);
  domainArchTriggerResults.push({
    domain: dr.domain,
    existingFiles,
    fired: triggerEnv.fired || false,
    reason: triggerEnv.reason || null,
    provenByAdversaryOnly: triggerEnv.provenByAdversaryOnly || false,
    stopDirective: triggerEnv.stopDirective || false,
  });
}
log(`M90 arch-trigger: ${domainArchTriggerResults.length} domain(s) fired extend-existing-code signal`);

phase("Integrate");
const integratePrompt = [
  `You are the integration agent. ${domainResults.length} domain workers have completed.`,
  ``,
  `Domain results:`,
  "```json",
  JSON.stringify(domainResults, null, 2),
  "```",
  ``,
  `Your job: perform any cross-domain wire-up needed (e.g. resolving shared-file edits sequenced at integrate, updating cross-domain contracts, running interleaved-touch resolution). DO NOT re-do work the domain workers already did. Make commits for the cross-domain edits only.`,
  ``,
  `Return a JSON object per the StructuredOutput schema. status="green" if all wiring landed cleanly, "warnings" if there are non-blocking issues, "failed" if cross-domain integration cannot complete.`,
].join("\n");

const integrate = await agent(integratePrompt, {
  label: "integrate",
  phase: "Integrate",
  schema: INTEGRATE_RESULT_SCHEMA,
}).catch((e) => ({
  status: "failed",
  crossDomainEdits: [],
  notes: `integrate agent error: ${e && e.message}`,
}));

if (integrate.status === "failed") {
  log("integrate FAILED — halting before verify-gate");
  return { status: "failed", reason: "integrate-failed", domainResults, integrate };
}

phase("Verify-Gate");
const vg = await runVerifyGate(projectDir);
log(`verify-gate exitCode=${vg.exitCode} ok=${vg.ok}`);

return {
  status: vg.ok ? "complete" : "verify-failed",
  milestone,
  domainResults,
  integrate,
  verifyGate: vg.envelope,
  // M90 §2: arch-trigger results (surfaced for verify gate R-FAIL-2 check)
  archTriggerResults: domainArchTriggerResults,
};
