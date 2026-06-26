// templates/workflows/gsd-t-phase.workflow.js
//
// Runtime: Anthropic native Workflow tool only.
// Generic upper-stage phase runner — covers partition, plan, discuss, impact,
// milestone, prd, design-decompose, doc-ripple.
//
// Each upper-stage phase is essentially: load brief -> primary agent (with phase-
// specific protocol) -> optional validation -> commit artifacts. Wrapping each
// in its own Workflow script is overengineering; this generic runner takes the
// phase name as an arg and threads the right brief kind + acceptance schema.
//
// args: {
//   phase: "partition" | "plan" | "discuss" | "impact" | "milestone"
//          | "prd" | "design-decompose" | "doc-ripple",
//   milestone?: "M61",
//   projectDir?: ".",
//   userInput?: string,   // arbitrary input to the phase (e.g. "$ARGUMENTS")
//   competition?: number, // M82: N>1 enables Competition Mode (generate-and-judge)
//                         // on eligible upstream phases. N parallel Self-MoA
//                         // producers -> judge stage -> winner. Default 1 (off).
// }
//
// M82 Competition Mode (generate-and-judge — the GENERATIVE dual of the
// orthogonal validation triad). Contract: competition-mode-contract.md v1.0.0.
//
// M90 §2 D4-T4 (competition arm): Divergence-path (R-ARCH-1) wired into the competition arm.
// After Judge selects the winner, the N producers' proposals are fed to the divergence-sampling
// path (R-ARCH-1) via the inline runCli helper. HONESTY CLAUSE: Self-MoA samples of ONE model
// (temperature/seed-varied) may NOT diverge like fresh-context saga cases the threshold was
// tuned on. That mismatch is RECORDED by the instrumentation sink; the result is logged as
// EXPERIMENTAL+MEASURED (never claimed as proof). If the real competition feed cannot
// meaningfully exercise the divergence formula, the result documents that fact.
// Contract: unproven-assumption-doctrine-contract.md §2 (R-ARCH-1, divergence path, competition-arm-only).
//   - Eligible phases: partition, milestone, discuss, design-decompose (pre-contract,
//     wide-solution-space). INELIGIBLE: plan/impact/prd/doc-ripple (narrow / one
//     right answer) — competition there is wasted, so a competition arg is ignored.
//   - Producers: N samples of ONE strong model (Self-MoA beats a model zoo), varied
//     by an explicit per-candidate "angle" so they explore different regions.
//   - Judge: partition uses the OBJECTIVE oracle (gsd-t competition-judge --kind
//     partition, scoring via the disjointness prover — a calculator, not a critic,
//     immune to LLM-judge bias). Other phases use a blind+shuffled+rubric judge whose
//     numeric selection is finalized deterministically by competition-judge --kind
//     generic.
//
// M89 Stated-Claims → classify (3-result) → judge/research + §7 ENFORCE marker:
//   Every eligible upper phase (plan, pre-mortem, partition, discuss, milestone, impact)
//   embeds the Stated-Claims snippet so the agent emits a ## Stated Claims list tagging
//   load-bearing claims KNOWN | GUESSED(type). The wiring (runStatedClaimsPipeline)
//   iterates each [GUESSED:*] entry through the D1 classifier, which is a MECHANICAL
//   STRING-FACT FILTER returning internal | external | AMBIGUOUS (v1.3.0). On
//   class:external write a §7 status=uncited marker, run the research agent (bare
//   model:"fable"), write a ## Verified Facts (auto-research) block, flip the marker to
//   status=cited. On class:internal: grep first; if grep empty, escalate to external
//   (§5.1). On class:AMBIGUOUS (the regex has no string fact — semantic placement is the
//   LLM's call, NOT regex's): run a small LLM JUDGE (model:"fable") that decides
//   internal/external/uncertain in natural language. internal→grep; external→research;
//   UNCERTAIN→treat as external→research (uncertain = verify, NEVER guess-internal — a
//   silent miss is the one unacceptable outcome). Idempotent: an already-cited marker
//   (same claim-key) skips re-research. The classifier never guesses a default — when it
//   isn't a string fact, the LLM decides, and when the LLM isn't sure, we research.
//   Contract: auto-research-contract.md v1.2.0 §1/§2/§3/§4/§6.5/§7.

export const meta = {
  name: "gsd-t-phase",
  description: "Generic upper-stage phase runner (partition/plan/discuss/etc.)",
  phases: [
    { title: "Preflight",      detail: "preflight + brief" },
    { title: "Probe",          detail: "M84 auto-competition solution-space probe (opus; eligible phases only)" },
    { title: "Compete",        detail: "M82/M84 N parallel producers (when competition fires)" },
    { title: "Judge",          detail: "select/synthesize the winning candidate" },
    { title: "Phase",          detail: "primary agent (or finalizer) with phase-specific protocol" },
    { title: "Finalize",       detail: "commit the winning approach (competition path)" },
    { title: "Plan Hardening", detail: "M83 traceability gate + adversarial pre-mortem (plan phase only)" },
  ],
};

// M81: runtime-native helpers (sandbox bans require/fs/child_process/process — the old
// require("./_lib.js") crashed this workflow on first eval, TD-113). Delegate CLI calls
// to an agent's Bash; args arrives as a JSON STRING in this runtime. See gsd-t-scan.workflow.js.
const _args = (typeof args === "string") ? (() => { try { return JSON.parse(args); } catch { return {}; } })() : (args || {});
// M86: resolved overrides map injected by the invoker (invoke-time injection, M69).
// Default to {} so the premium fallback literals apply when no invoker injects overrides
// (preserves byte-identical M85 behavior for callers that have not been updated yet).
// overrides values are CONCRETE model ids (resolver envelope); the bare literals below
// are tier ALIASES. The sandbox runtime accepts BOTH forms in model: — proven live for
// the concrete-id fable path by probe wf_c9faf817-373 (no HTTP 400).
const overrides = (_args.overrides && typeof _args.overrides === "object") ? _args.overrides : {};
const _CLI_ENVELOPE_SCHEMA = {
  type: "object", required: ["ok", "exitCode"], additionalProperties: true,
  properties: { ok: { type: "boolean" }, exitCode: { type: "integer" }, envelope: {}, stdout: { type: "string" }, stderr: { type: "string" }, via: { type: "string" } },
};
// Single-quote a value for safe shell interpolation (Red Team MED-5).
function _shq(s) { return `'${String(s).replace(/'/g, "'\\''")}'`; }
async function runCli(projectDir, subcmd, argv, localBin, label, parseJson = true, phaseNameOpt) {
  const argStr = (argv || []).map((a) => `'${String(a).replace(/'/g, "'\\''")}'`).join(" ");
  const prompt = [
    `Run a GSD-T CLI command for the project at \`${projectDir}\` and report the result. Steps:`,
    `1. If \`${projectDir}/bin/${localBin}\` exists, run: \`node ${projectDir}/bin/${localBin} ${argStr}\` (set via="local"). Otherwise run: \`gsd-t ${subcmd} ${argStr}\` (set via="global"). Use cwd \`${projectDir}\`.`,
    `2. Capture exit code (ok = exitCode 0) and stdout/stderr.`,
    parseJson ? `3. Parse stdout as JSON into \`envelope\` (null if not JSON). Return JSON per the schema.` : `3. Put stdout (trimmed, ≤4000 chars) in \`stdout\`. Return JSON per the schema.`,
    `Do NOT do any other work. ONLY run this one command and report.`,
  ].join("\n");
  const opts = { label, schema: _CLI_ENVELOPE_SCHEMA, model: "haiku" };
  if (phaseNameOpt) opts.phase = phaseNameOpt;
  // The CLI is run by a haiku helper agent, not a subprocess, so a return can transiently
  // come back missing its parsed result. Retry ONCE on a missing/unparsed result before
  // giving up — a genuine CLI failure fails both attempts (real error survives the retry),
  // while a transient helper miss is recovered. Only retry when JSON was expected (parseJson)
  // and the parsed result is absent; never retry on a clean exit that simply returned no JSON.
  const runOnce = () => agent(prompt, opts).catch((e) => ({ ok: false, exitCode: -1, envelope: null, stderr: String(e && e.message), via: "error" }));
  let r = await runOnce();
  // Retry once when JSON was expected but no parsed result came back — covers both the
  // throw path (via="error") and a malformed return the loose schema let through (ok=false
  // with the result absent). A real CLI failure that returned valid JSON (envelope present,
  // ok=false) is NOT retried — that is a true result, not a transient miss.
  const missingResult = (x) => !x || (parseJson && (x.envelope === undefined || x.envelope === null) && x.ok !== true);
  if (missingResult(r)) {
    r = await runOnce();
  }
  return r || { ok: false, exitCode: -1, envelope: null, via: "error" };
}
async function runPreflight(projectDir, label = "preflight", phaseNameOpt) { return runCli(projectDir, "preflight", ["--json"], "cli-preflight.cjs", label, true, phaseNameOpt); }
// M83: the deterministic plan-hardening gate. Returns the parsed envelope
// ({ ok, exitCode, violations, ... }); ok:false means ≥1 untraceable AC.
async function runTraceabilityGate(projectDir, milestone, label = "traceability-gate", phaseNameOpt) {
  const argv = ["--json"];
  if (milestone) argv.push("--milestone", milestone);
  const r = await runCli(projectDir, "traceability-gate", argv, "gsd-t-traceability-gate.cjs", label, true, phaseNameOpt);
  return r.envelope || { ok: r.ok, exitCode: r.exitCode, violations: [], reason: "gate-unparsed" };
}
async function generateBrief(projectDir, { kind = "execute", milestone, domain, id, label = "brief", phaseNameOpt } = {}) {
  const argv = ["--kind", kind, "--spawn-id", id, "--out", `${projectDir}/.gsd-t/briefs/${id}.json`];
  if (milestone) argv.push("--milestone", milestone);
  if (domain) argv.push("--domain", domain);
  const r = await runCli(projectDir, "brief", argv, "gsd-t-context-brief.cjs", label, false, phaseNameOpt);
  return { ok: r.ok, briefPath: `${projectDir}/.gsd-t/briefs/${id}.json`, via: r.via };
}

// M82: run the deterministic selection oracle over a candidate-set spec. The spec
// is written to a file via the agent's Bash (no fs in this sandbox), then judged by
// `gsd-t competition-judge --in <file>`. The agent MUST copy the judge's rich output
// (winner/ranked) up to the TOP LEVEL of its reply — a permissive free-form
// `envelope:{}` schema let a haiku agent silently drop winner/ranked (caught in the
// M82 real-sandbox proof: via=local ok=true but winner=undefined). Explicit required
// fields fix that. Returns { ok, winner, ranked }.
const _JUDGE_ENVELOPE_SCHEMA = {
  type: "object", required: ["ok", "winner"], additionalProperties: true,
  properties: {
    ok: { type: "boolean" },
    exitCode: { type: "integer" },
    winner: { type: ["string", "null"] },
    ranked: { type: "array", items: { type: "object", additionalProperties: true } },
    via: { type: "string" },
  },
};
async function runCompetitionJudge(projectDir, spec, label = "judge", phaseNameOpt) {
  // De-fang backticks so a producer-supplied domain name / path containing ``` can't
  // break out of the markdown fence in the prompt (Red Team MED-5). The judge only
  // reads structural fields (id, domains.name, touches[]); a sanitized name is fine.
  const specJson = JSON.stringify(spec).replace(/`/g, "'");
  const qDir = _shq(projectDir);
  const specPath = `${projectDir}/.gsd-t/briefs/_competition-spec.json`;
  const qSpec = _shq(specPath);
  const prompt = [
    `Run the GSD-T Competition Mode judge for the project at \`${projectDir}\` and report its FULL output. Steps:`,
    `1. Write this EXACT JSON (one line) to \`${specPath}\` (overwrite; create .gsd-t/briefs/ if needed):`,
    "~~~json",
    specJson,
    "~~~",
    `2. If \`${projectDir}/bin/gsd-t-competition-judge.cjs\` exists, run: \`node ${qDir}/bin/gsd-t-competition-judge.cjs --in ${qSpec} --project-dir ${qDir}\` (set via="local"). Otherwise run: \`gsd-t competition-judge --in ${qSpec} --project-dir ${qDir}\` (set via="global"). cwd \`${projectDir}\`.`,
    `3. The command prints a JSON object to stdout with fields: ok, exitCode, winner, ranked, n.`,
    `4. COPY those fields (ok, exitCode, winner, ranked) up to the TOP LEVEL of your reply, plus via. Do NOT nest them under "envelope". If the command failed, set winner=null.`,
    `Do NOT do any other work.`,
  ].join("\n");
  const opts = { label, schema: _JUDGE_ENVELOPE_SCHEMA, model: "haiku" };
  if (phaseNameOpt) opts.phase = phaseNameOpt;
  const r = await agent(prompt, opts).catch((e) => ({ ok: false, winner: null, ranked: [], via: "error", err: String(e && e.message) }));
  // Prefer top-level fields; fall back to a nested envelope if the agent nested anyway.
  const env = (r && r.winner !== undefined) ? r : (r && r.envelope) || {};
  return { ok: !!env.ok, winner: env.winner != null ? env.winner : null, ranked: env.ranked || [] };
}

// ── M89 Stated-Claims pipeline ──────────────────────────────────────────────
// Research-eligible upper stages: these are the phases whose prompt embeds the
// Stated-Claims snippet (§6.5) and whose artifacts are scanned post-agent.
// prd/design-decompose/doc-ripple are excluded (no load-bearing external claims).
const RESEARCH_ELIGIBLE_PHASES = new Set(["plan", "partition", "discuss", "milestone", "impact"]);

// §7 ENFORCE marker format — machine-readable HTML comment written at classify time.
// claim-key = deterministic normalization: lowercase, then COLLAPSE EVERY non-word run
// to a single space (cycle-2 finding #1 — CRITICAL). This makes the key marker-syntax
// SAFE: it can never contain "=", "<", ">", "-", so a claim that literally embeds
// "status=cited"/"class="/"key="/"<!--"/"-->" cannot poison the marker grammar or
// collide with a distinct claim's key. (Subsumes the old whitespace-collapse + edge-strip.)
function normalizeClaimKey(claim) {
  return claim.toLowerCase().replace(/[^\w]+/g, " ").trim();
}

// The Stated-Claims snippet Read instruction (D2 deliverable, §6.5 DETECT seam).
// Each eligible stage prompt embeds this instruction so the agent emits ## Stated Claims.
const STATED_CLAIMS_INSTRUCTION = `MANDATORY (auto-research-contract §6.5): After your main work, emit a \`## Stated Claims\` section listing EVERY load-bearing claim you relied on, tagged as:
- [KNOWN] <claim you have verified or is repo-internal-evident>
- [GUESSED:unknown] <claim you lack the fact for>
- [GUESSED:assumed] <claim asserting an unverified external shape/value/behavior>
- [GUESSED:stale] <external/time-varying fact that may have aged>
This list is machine-parsed by the wiring (D3). Tags are case-sensitive. An untagged claim is an acknowledged miss — the more you tag, the more the system verifies. Also FIRST read your Stated-Claims protocol: templates/prompts/stated-claims-snippet.md`;

// Structured output schema for the Stated-Claims processor agent
const STATED_CLAIMS_EXTRACT_SCHEMA = {
  type: "object",
  required: ["guessedClaims"],
  additionalProperties: true,
  properties: {
    guessedClaims: {
      type: "array",
      items: { type: "string" },
      description: "List of raw claim texts from [GUESSED:*] lines in the ## Stated Claims section",
    },
    knownClaims: { type: "array", items: { type: "string" } },
    artifactPaths: { type: "array", items: { type: "string" } },
    statedClaimsSectionFound: { type: "boolean" },
  },
};

const GREP_RESULT_SCHEMA = {
  type: "object",
  required: ["found"],
  additionalProperties: true,
  properties: {
    found: { type: "boolean" },
    excerpt: { type: "string" },
  },
};

const RESEARCH_RESULT_SCHEMA = {
  type: "object",
  required: ["ok"],
  additionalProperties: true,
  properties: {
    ok: { type: "boolean" },
    gapKey: { type: "string" },
    citedBlock: { type: "string" },
    sourceUrls: { type: "array", items: { type: "string" } },
    fetchDates: { type: "array", items: { type: "string" } },
    reason: { type: "string" },
  },
};

const MARKER_WRITE_SCHEMA = {
  type: "object",
  required: ["ok"],
  additionalProperties: true,
  properties: {
    ok: { type: "boolean" },
    artifactPath: { type: "string" },
    marker: { type: "string" },
  },
};

// M89 §1.1 — the AMBIGUOUS → LLM JUDGE schema. When the mechanical classifier finds no
// decisive STRING FACT (class:ambiguous), this judge applies the known/internal/external
// test in natural language and returns one of three verdicts. CRITICAL: "uncertain" is a
// first-class verdict — the wiring treats it as EXTERNAL (research), never guess-internal.
const CLASSIFY_JUDGE_SCHEMA = {
  type: "object",
  required: ["verdict"],
  additionalProperties: true,
  properties: {
    verdict: { type: "string", enum: ["internal", "external", "uncertain"] },
    reason: { type: "string" },
  },
};

/**
 * M89 §7 Stated-Claims pipeline: classify → marker-write → research/grep → cite → flip.
 * Called after the phase agent runs on any research-eligible phase.
 *
 * @param {string} projectDir
 * @param {string} phaseName  - the current phase (e.g. "plan", "partition")
 * @param {object} phaseResult - the agent's result (contains artifacts[] + summary)
 * @param {string} statedClaimsContext - the agent's stdout/return text (may contain ## Stated Claims)
 * @returns {object} - { ok, processed, errors }
 */
async function runStatedClaimsPipeline(projectDir, phaseName, phaseResult, statedClaimsContext) {
  const processed = [];
  const errors = [];

  // Step 1: Extract [GUESSED:*] claims from the phase artifact / stated-claims section.
  // The phase agent is instructed to emit ## Stated Claims in its output; we extract it.
  const extractResult = await agent(
    [
      `You are a Stated-Claims extractor for the "${phaseName}" phase. Your ONLY job is to parse the [GUESSED:*] entries from a ## Stated Claims section and return them as a JSON list.`,
      ``,
      `Context (the phase agent's output / summary):`,
      "~~~",
      statedClaimsContext || "(phase agent returned no text — check phaseResult.summary)",
      "~~~",
      ``,
      `Phase artifacts written (read these if needed to find ## Stated Claims):`,
      (phaseResult && phaseResult.artifacts || []).map((a) => `- ${a}`).join("\n") || "(none reported)",
      ``,
      `Task:`,
      `1. Look for a section starting with \`## Stated Claims\` in the context above OR in any artifact file.`,
      `2. Extract EVERY line starting with \`- [GUESSED:\` and return its claim text (the text AFTER the tag, stripped of the tag prefix).`,
      `3. Also note \`statedClaimsSectionFound\` (true if you found the heading).`,
      `4. Return JSON per the schema. "guessedClaims" is the list of claim texts (NOT the tags themselves).`,
      `If no ## Stated Claims section was found, return { "guessedClaims": [], "statedClaimsSectionFound": false }.`,
    ].join("\n"),
    { label: "stated-claims-extract", phase: "Phase", schema: STATED_CLAIMS_EXTRACT_SCHEMA, model: "haiku" }
  ).catch(() => ({ guessedClaims: [], statedClaimsSectionFound: false }));

  const guessedClaims = Array.isArray(extractResult && extractResult.guessedClaims)
    ? extractResult.guessedClaims.filter((c) => typeof c === "string" && c.trim().length > 0)
    : [];

  if (!extractResult || !extractResult.statedClaimsSectionFound) {
    log(`m89: ${phaseName}: no ## Stated Claims section found — acknowledged miss (§6.5 best-effort DETECT)`);
  } else {
    log(`m89: ${phaseName}: ${guessedClaims.length} [GUESSED:*] claim(s) found in ## Stated Claims`);
  }

  if (guessedClaims.length === 0) {
    return { ok: true, processed, errors };
  }

  // Determine the primary artifact path to write markers/facts into.
  // We use the first artifact reported (or a temp path if none).
  const artifactPaths = Array.isArray(extractResult.artifactPaths) && extractResult.artifactPaths.length > 0
    ? extractResult.artifactPaths
    : (phaseResult && phaseResult.artifacts ? phaseResult.artifacts : []);
  const primaryArtifact = artifactPaths[0] || null;

  // Step 2: For each GUESSED claim, classify → route → process.
  // Sequential (not parallel) to avoid concurrent artifact writes racing each other.
  for (const claimText of guessedClaims) {
    const claimKey = normalizeClaimKey(claimText);
    log(`m89: classifying claim: "${claimText.slice(0, 80)}"`);

    // FAIL-CLOSED (Red Team HIGH): the §7 marker for an EXTERNAL guess MUST always be written
    // SOMEWHERE so the §7 ENFORCE gate has something to fail on. artifactPath is agent-self-
    // reported + optional; a worker that reports none must NOT silently skip the marker (that
    // would ship an external guess uncited+unresearched — the exact invariant M89 enforces).
    // So the external/escalation path writes to a DETERMINISTIC FALLBACK ARTIFACT when no
    // artifact was reported. Internal/grep can still no-op safely (no marker on the internal path).
    const claimSlug = claimKey.replace(/\s+/g, "-").slice(0, 80) || "claim";
    const externalArtifact = primaryArtifact || `${projectDir}/.gsd-t/research/phase-${phaseName}-${claimSlug}.md`;

    // § 4.1 Idempotency check: if the artifact already has a status=cited marker for this exact
    // claim-key, skip (no re-research). Check the path actually WRITTEN (externalArtifact = real
    // primaryArtifact OR the deterministic fallback) so a re-run does not re-research a claim
    // already cited in the fallback artifact (Red Team MEDIUM).
    {
      const idempotencyCheck = await agent(
        [
          `Check if the file at "${externalArtifact}" already contains an auto-research-claim marker with status=cited for the claim-key "${claimKey}".`,
          ``,
          `Search for an HTML comment matching:`,
          `  <!-- auto-research-claim: class=external key=${claimKey} status=cited -->`,
          ``,
          `Return JSON: { "alreadyCited": true } if found, { "alreadyCited": false } if not found or file does not exist.`,
          `Do NOT modify any files. Read-only check.`,
        ].join("\n"),
        { label: "idempotency-check", phase: "Phase", schema: { type: "object", required: ["alreadyCited"], properties: { alreadyCited: { type: "boolean" } } }, model: "haiku" }
      ).catch(() => ({ alreadyCited: false }));

      if (idempotencyCheck && idempotencyCheck.alreadyCited) {
        log(`m89: claim "${claimKey}" already cited (§4.1 idempotency skip — exact claim-key match)`);
        processed.push({ claimKey, action: "skipped-already-cited" });
        continue;
      }
    }

    // Classify the claim via the D1 classifier (--json for parity with the worker workflows).
    const classifyResult = await runCli(
      projectDir, "research-gate", ["classify", claimText, "--json"], "gsd-t-research-gate.cjs",
      "classify-claim", true, "Phase"
    );
    const envelope = classifyResult.envelope || {};
    const claimClass = envelope.class;
    const claimRoute = envelope.route;

    if (!classifyResult.ok || !claimClass) {
      log(`m89: classify failed for claim "${claimKey}": ${envelope.error || classifyResult.stderr || "no envelope"}`);
      errors.push({ claimKey, error: `classify failed: ${envelope.error || "no envelope"}` });
      continue;
    }

    log(`m89: claim "${claimKey}" → class:${claimClass} route:${claimRoute} — ${envelope.reason || ""}`);

    // External-claim handler (§7 marker → research(fable) → cite → flip). Closure so the
    // ambiguous→judge path can reuse it for an "external"/"uncertain" verdict.
    const doExternal = async () => {
      // §7: Write status=uncited marker into the (real OR fallback) artifact — ALWAYS written
      // so the §7 gate can fail on it (fail-CLOSED, Red Team HIGH).
      const marker = `<!-- auto-research-claim: class=external key=${claimKey} status=uncited -->`;
      await agent(
        [
          `Create the parent directory if needed, then append the following HTML comment marker on a NEW LINE at the END of the file at "${externalArtifact}" (create the file if it does not exist):`,
          ``,
          marker,
          ``,
          `Do NOT modify any other content. Return JSON: { "ok": true, "artifactPath": "${externalArtifact}", "marker": "<the marker you appended>" }`,
        ].join("\n"),
        { label: "marker-write-uncited", phase: "Phase", schema: MARKER_WRITE_SCHEMA, model: "haiku" }
      ).catch((e) => ({ ok: false, error: String(e && e.message) }));
      log(`m89: wrote status=uncited marker for claim "${claimKey}" into ${externalArtifact}${primaryArtifact ? "" : " (FALLBACK artifact — worker reported no path)"}`);

      // §2: Run the research agent (bare model: "fable" — not the ?? override form).
      // The research agent reads its own protocol from research-subagent.md.
      log(`m89: running research agent for external claim "${claimKey}"`);
      const researchResult = await agent(
        [
          `You are the auto-research agent (auto-research-contract §2). Your SOLE job is to verify ONE external guessed claim via live web sources.`,
          ``,
          `FIRST read your protocol via the Read tool: templates/prompts/research-subagent.md (in the installed @tekyzinc/gsd-t package, or this project's copy). Follow it exactly.`,
          ``,
          `Claim to verify: "${claimText}"`,
          `Normalized claim-key: "${claimKey}"`,
          ``,
          `Use WebSearch + WebFetch to find authoritative sources. Emit a ## Verified Facts (auto-research) block per §3 format. On every fact line append the trailer \`key: ${claimKey}\` so the §7 gate matches by claim-key (Red Team MEDIUM #2).`,
          `Return JSON per the schema with ok:true and citedBlock (the full markdown block) on success, or ok:false and reason on STAGE-FAILURE.`,
        ].join("\n"),
        { label: "research-stage", phase: "Phase", schema: RESEARCH_RESULT_SCHEMA, model: "fable" }
      ).catch((e) => ({ ok: false, gapKey: claimKey, reason: `research agent error: ${e && e.message}` }));

      if (researchResult && researchResult.ok && researchResult.citedBlock) {
        // §3: Write the cited Verified-Facts block into the (real OR fallback) artifact before the gate re-runs.
        await agent(
          [
            `Append the following cited Verified-Facts block on a NEW LINE at the END of the file at "${externalArtifact}":`,
            ``,
            researchResult.citedBlock,
            ``,
            `Then FIND and REPLACE the marker:`,
            `  <!-- auto-research-claim: class=external key=${claimKey} status=uncited -->`,
            `with:`,
            `  <!-- auto-research-claim: class=external key=${claimKey} status=cited -->`,
            ``,
            `(This flips the §7 marker from uncited → cited — same claim-key, exact string replace.)`,
            `Return JSON: { "ok": true }`,
          ].join("\n"),
          { label: "cite-write-and-flip", phase: "Phase", schema: { type: "object", required: ["ok"], properties: { ok: { type: "boolean" } } }, model: "haiku" }
        ).catch(() => null);
        log(`m89: cited block written + marker flipped to status=cited for claim "${claimKey}"`);
        processed.push({ claimKey, action: "cited", class: "external" });
      } else {
        const reason = (researchResult && researchResult.reason) || "research stage returned no cited block";
        log(`m89: research STAGE-FAILURE for claim "${claimKey}": ${reason} — marker stays status=uncited`);
        errors.push({ claimKey, error: `research stage failure: ${reason}`, action: "research-failed" });
        processed.push({ claimKey, action: "research-failed", class: "external", reason });
      }
    };

    // Internal-claim handler — grep first; escalate to external if grep empty (§5.1).
    // Closure so the ambiguous→judge path can reuse it for an "internal" verdict.
    const doInternal = async () => {
      log(`m89: internal claim "${claimKey}" — running grep/Read`);
      const grepResult = await agent(
        [
          `You are an internal-claim resolver for the project at "${projectDir}".`,
          ``,
          `Internal claim: "${claimText}"`,
          ``,
          `Task: Use grep and/or Read to decide whether this repo's OWN code / contracts / tests`,
          `CONFIRM THE SPECIFIC CLAIM — not merely share vocabulary with it (Red Team MEDIUM).`,
          `1. grep/Read the project for content relevant to the claim.`,
          `2. Set found=true ONLY IF the repo content you read actually CONFIRMS the specific claim`,
          `   (the value/shape/behavior the claim asserts is borne out by this repo's code/contract/test).`,
          `   Coincidental keyword overlap — a file that merely MENTIONS the same words but does not`,
          `   establish the claim — is found=false.`,
          `3. If the claim is about an EXTERNAL system's behavior/limit/return-shape (a third-party API,`,
          `   library, browser, or protocol), grep CANNOT confirm it — set found=false so it escalates`,
          `   to web research. A repo file that calls that external system is NOT confirmation of the`,
          `   external system's behavior.`,
          `4. Otherwise set found=false.`,
          ``,
          `Return JSON: { "found": true|false, "excerpt": "<up to 200 chars of the CONFIRMING repo content, or empty>" }`,
          `Do NOT run any web searches. Do NOT write any files. Grep and Read only.`,
        ].join("\n"),
        { label: "internal-grep", phase: "Phase", schema: GREP_RESULT_SCHEMA, model: "haiku" }
      ).catch(() => ({ found: false, excerpt: "" }));

      if (grepResult && grepResult.found) {
        log(`m89: internal claim "${claimKey}" resolved via grep (no web, no marker)`);
        processed.push({ claimKey, action: "resolved-grep", class: "internal", excerpt: grepResult.excerpt });
      } else {
        // §5.1 Escalate to external: grep returned nothing. Reuse doExternal() (same
        // marker→research→cite→flip path, incl. the key: trailer + fallback artifact)
        // instead of duplicating it (matches execute/quick/debug).
        log(`m89: internal claim "${claimKey}" grep EMPTY → escalating to external (§5.1)`);
        await doExternal();
      }
    };

    // ── Dispatch by the 3-result classifier verdict ──────────────────────────
    if (claimClass === "external") {
      await doExternal();
    } else if (claimClass === "internal") {
      await doInternal();
    } else {
      // class:AMBIGUOUS — the mechanical filter found NO string fact. Semantic placement
      // is the LLM's call, NOT regex's. Run the LLM JUDGE (fable). internal→grep;
      // external→research; UNCERTAIN→research (uncertain = verify, NEVER guess-internal —
      // a silent miss is the one unacceptable outcome). The classifier never guessed a
      // default — it deferred, and now the LLM decides (and on doubt we research).
      log(`m89: ambiguous claim "${claimKey}" — routing to LLM judge (no string fact; doctrine: when unsure, research)`);
      const judge = await agent(
        [
          `You are the M89 ambiguous-claim JUDGE (auto-research-contract §1.1). The mechanical`,
          `string-fact classifier could not decide this GUESSED claim, so you decide it in natural`,
          `language. Apply the known/internal/external test:`,
          ``,
          `Claim: "${claimText}"`,
          ``,
          `- "internal"  = the claim is about THIS repo's OWN code / contracts / schema / file`,
          `                ownership / tests — something grep/Read of this repo can confirm.`,
          `- "external"  = the claim asserts the behavior / shape / limit / value of a system`,
          `                OUTSIDE this repo (a third-party API, library, browser, protocol, spec)`,
          `                and is unverified — it needs web research to confirm.`,
          `- "uncertain" = you cannot CONFIDENTLY place it as internal. Use this freely — it is NOT`,
          `                a failure. Per the milestone's own doctrine, an unverified claim must be`,
          `                RESEARCHED, never guessed.`,
          ``,
          `Return JSON: { "verdict": "internal" | "external" | "uncertain", "reason": "<one line>" }.`,
          `Do NOT modify files. Do NOT run web searches in THIS step — only decide the verdict.`,
        ].join("\n"),
        { label: "classify-judge", phase: "Phase", schema: CLASSIFY_JUDGE_SCHEMA, model: "fable" }
      ).catch((e) => ({ verdict: "uncertain", reason: `judge error: ${e && e.message} — failing toward research` }));

      const verdict = (judge && judge.verdict) || "uncertain";
      log(`m89: ambiguous claim "${claimKey}" → judge verdict: ${verdict} — ${(judge && judge.reason) || ""}`);
      if (verdict === "internal") {
        await doInternal();
      } else {
        // external OR uncertain → research (uncertain = verify, never guess-internal)
        if (verdict === "uncertain") log(`m89: judge UNCERTAIN for "${claimKey}" → treating as external → research (no silent guess)`);
        await doExternal();
      }
    }
  }

  return { ok: errors.length === 0, processed, errors };
}

// Phases where competition pays off (wide solution space, pre-contract, high blast
// radius). Competition is AUTOMATIC on these (M84) — the workflow probes the
// solution space and self-decides; on any other phase it never runs.
const COMPETITION_ELIGIBLE = new Set(["partition", "milestone", "discuss", "design-decompose"]);

// M84: the solution-space probe. Decides AUTOMATICALLY whether a phase is
// competition-worthy (≥2 genuinely different viable approaches). This is a
// high-level reasoning step — NOT a mechanical check — so it runs on OPUS, not
// haiku (a weak probe forfeits the whole point: it gates a 3× competition whose
// upstream cost buys down far larger downstream cost). It is BIASED TOWARD
// COMPETING: when uncertain, compete — because a better artifact upstream makes
// every downstream phase (pre-mortem, execute, verify) cheaper and more likely to
// pass first time, so the expected savings usually exceed the 3× probe-and-produce
// cost. Returns { compete: bool, reason, approaches? }.
//
// Partition has its OWN probe (runPartitionProbe, also opus): the disjointness
// oracle can't decide before candidates exist, so an opus probe makes the
// compete/skip call and the oracle JUDGES the candidates afterward. This
// (runSolutionSpaceProbe) is for the other subjective phases.
const _PROBE_SCHEMA = {
  type: "object", required: ["compete"], additionalProperties: true,
  properties: {
    compete: { type: "boolean" },
    reason: { type: "string" },
    approaches: { type: "array", items: { type: "string" } },
  },
};
async function runSolutionSpaceProbe(projectDir, phaseName, { milestone, briefPath, userInput, phaseNameOpt, altitude } = {}) {
  // M87 altitude shift: when behavior is SPEC'D (the milestone is authored at the
  // intention-first high-level-approach altitude), the milestone solution-space
  // probe shifts UP — it competes over high-level APPROACHES (what/why/when, actors,
  // one-breath thesis), NOT lower-altitude implementation detail. This changes WHAT
  // the producers compete on, never WHO competes (producers stay opus, judge differs —
  // M82 blindness invariant preserved) nor the probe's model (stays fable).
  const atApproachAltitude = altitude === "high-level-approach";
  const prompt = [
    `You are the Solution-Space Probe for the ${phaseName} phase${milestone ? ` of ${milestone}` : ""}. Decide ONE thing: should this phase generate MULTIPLE competing candidates (then a judge picks the best), or is a single draft sufficient?`,
    atApproachAltitude
      ? `ALTITUDE: HIGH-LEVEL APPROACH (M87 — behavior is spec'd intention-first). Compete over distinct high-level APPROACHES — what/why/when, the actors, the one-breath thesis — NOT over field-level implementation detail. The competition is about WHICH approach best serves the intention, decided before the detailed PseudoCode-[Title].md is authored.`
      : "",
    `**Brief:** ${briefPath || "(none — read the relevant .gsd-t docs/contracts/requirements directly)"}`,
    userInput ? `\nUser input:\n${userInput}\n` : "",
    `Compete WHEN there are ≥2 genuinely DIFFERENT, viable approaches whose trade-offs matter — different architectures, decomposition strategies, data models, sequencing, or design directions that a reasonable expert could disagree about. List them in "approaches".`,
    `Do NOT compete only when there is ONE obvious correct approach and any variation would be cosmetic.`,
    `BIAS TOWARD COMPETING: if you are uncertain, or can name even two plausibly-different approaches, choose compete=true. A wasted competition costs ~3× this one phase; a missed-better-approach costs far more downstream (more pre-mortem blocks, more bugs, more verify cycles). Err on the side of generating options.`,
    `Return JSON per the schema: { "compete": true|false, "reason": "<one sentence>", "approaches": ["<a>","<b>",...] }.`,
  ].filter(Boolean).join("\n");
  const opts = { label: "solution-space-probe", schema: _PROBE_SCHEMA, model: overrides["solution-space-probe"] ?? "fable" };
  if (phaseNameOpt) opts.phase = phaseNameOpt;
  const r = await agent(prompt, opts).catch(() => null);
  // Probe failure → bias toward competing (fail-toward-options, per the cost logic).
  if (!r || typeof r.compete !== "boolean") {
    return { compete: true, reason: "probe unavailable — defaulting to compete (bias toward options)", approaches: [] };
  }
  return { compete: r.compete, reason: r.reason || "", approaches: r.approaches || [] };
}

// M84: PARTITION's pre-produce decision. The objective disjointness oracle needs
// candidates to score, so it can't DECIDE before any exist — it runs later as the
// JUDGE. For the pre-produce compete/skip decision we use an OPUS heuristic probe
// (biased toward compete): partition is competition-worthy unless the milestone is
// trivially single-domain. So: opus probe DECIDES whether to compete; the objective
// file-disjointness oracle JUDGES the produced candidates. (Decision = heuristic +
// bias; selection = objective.)
async function runPartitionProbe(projectDir, { milestone, briefPath, userInput, phaseNameOpt } = {}) {
  const prompt = [
    `You are the Partition Solution-Space Probe${milestone ? ` for ${milestone}` : ""}. Decide: are there ≥2 genuinely different ways to CARVE this milestone into file-disjoint domains (different boundaries / groupings / parallelism), or is there one obvious single decomposition?`,
    `**Brief:** ${briefPath || "(none — read .gsd-t docs/contracts/requirements directly)"}`,
    userInput ? `\nUser input:\n${userInput}\n` : "",
    `Compete=true when the work spans multiple files/areas that could be grouped more than one sensible way. Compete=false ONLY for a trivial single-file / single-domain milestone.`,
    `BIAS TOWARD COMPETING: if ≥3 files/areas are in play or you're unsure, choose compete=true — the file-disjointness oracle will objectively pick the most-parallelizable valid carving among the candidates, so competing is low-risk and high-reward.`,
    `Return JSON per the schema.`,
  ].filter(Boolean).join("\n");
  const opts = { label: "partition-probe", schema: _PROBE_SCHEMA, model: overrides["partition-probe"] ?? "fable" };
  if (phaseNameOpt) opts.phase = phaseNameOpt;
  const r = await agent(prompt, opts).catch(() => null);
  if (!r || typeof r.compete !== "boolean") {
    return { compete: true, reason: "probe unavailable — defaulting to compete", approaches: [] };
  }
  return { compete: r.compete, reason: r.reason || "", approaches: r.approaches || [] };
}

// Rubric axes for the SUBJECTIVE judge (non-partition eligible phases). Partition
// uses the objective oracle instead and ignores these.
const RUBRIC_AXES_BY_PHASE = {
  milestone: [
    { key: "coherence", weight: 2 }, { key: "completeness", weight: 1 },
    { key: "riskCoverage", weight: 1 }, { key: "simplicity", weight: 1 },
  ],
  discuss: [
    { key: "soundness", weight: 2 }, { key: "completeness", weight: 1 },
    { key: "tradeoffClarity", weight: 1 }, { key: "simplicity", weight: 1 },
  ],
  "design-decompose": [
    { key: "fidelity", weight: 2 }, { key: "completeness", weight: 1 },
    { key: "reuse", weight: 1 }, { key: "simplicity", weight: 1 },
  ],
};

const VALID_PHASES = [
  "partition", "plan", "discuss", "impact",
  "milestone", "prd", "design-decompose", "doc-ripple",
];

const PHASE_RESULT_SCHEMA = {
  type: "object",
  required: ["status", "artifacts"],
  additionalProperties: false,
  properties: {
    status:    { type: "string", enum: ["complete", "partial", "blocked", "failed"] },
    artifacts: { type: "array", items: { type: "string" } },
    summary:   { type: "string" },
    decisions: { type: "array", items: { type: "string" } },
  },
};

const projectDir = _args.projectDir || ".";
const milestone  = _args.milestone || null;
const userInput  = _args.userInput || "";
const phaseName  = _args.phase;

// M84: competition is AUTOMATIC. By default the workflow PROBES the solution space
// (after brief) and self-decides whether to run a 3-producer + judge competition —
// no flag needed. Optional manual OVERRIDES: `competition: N` (2-5) forces N
// producers; `competition: 0` or `noCompetition: true` forces it off. Default
// (`competition` unset) = let the workflow decide.
// Evidence (Self-MoA, Large Language Monkeys): gains plateau fast; N=3 is the elbow,
// >5 wasteful. The auto path fires 3.
const AUTO_COMPETITION_N = 3;
const _hasCompetitionArg = _args.competition !== undefined && _args.competition !== null;
const _forceOff = _args.noCompetition === true || (_hasCompetitionArg && Number(_args.competition) <= 1);
const _forcedN = _hasCompetitionArg && Number(_args.competition) >= 2
  ? Math.max(2, Math.min(5, Math.floor(Number(_args.competition))))
  : null;
// competitionN/competitionOn are resolved LATER (after preflight+brief) by the
// auto-probe, unless an override pins them now. Declared with `let` so the
// post-brief decision block can set them.
let competitionN = 1;
let competitionOn = false;
const _competitionEligible = COMPETITION_ELIGIBLE.has(phaseName);
if (_forcedN && !_competitionEligible) {
  log(`competition: forced N=${_forcedN} ignored — phase "${phaseName}" is not competition-eligible. Eligible: ${[...COMPETITION_ELIGIBLE].join(", ")}.`);
}

if (!phaseName || !VALID_PHASES.includes(phaseName)) {
  log(`phase: args.phase must be one of: ${VALID_PHASES.join(", ")}`);
  return { status: "failed", reason: "invalid-phase" };
}

phase("Preflight");
const pre = await runPreflight(projectDir);
if (!pre.ok) return { status: "failed", reason: "preflight-failed", preflight: pre.envelope };
const brief = await generateBrief(projectDir, { kind: phaseName, milestone, id: `${phaseName}-${(milestone || "m").toLowerCase()}` });

// ── M84: resolve competition AUTOMATICALLY (after brief, before producing) ──
// Default: probe the solution space and self-decide. Overrides pin it.
if (_competitionEligible) {
  if (_forceOff) {
    competitionOn = false;
    log(`competition: OFF (overridden via competition≤1 / noCompetition).`);
  } else if (_forcedN) {
    competitionN = _forcedN; competitionOn = true;
    log(`competition: ON, N=${_forcedN} (overridden).`);
  } else {
    // M84 Red Team LOW: warn on an unparseable override so a typo (competition:"off")
    // isn't silently swallowed into the auto path.
    if (_hasCompetitionArg && Number.isNaN(Number(_args.competition))) {
      log(`competition: override value ${JSON.stringify(_args.competition)} is not a number — ignoring it, using AUTO. (Use 0/noCompetition to force off, 2-5 to force N.)`);
    }
    // Automatic decision — the workflow probes and decides. Opus probe (or the
    // partition-specific probe); biased toward competing.
    phase("Probe");
    // M87: the milestone phase is authored intention-first — behavior is spec'd at the
    // high-level-approach altitude, so its solution-space probe shifts UP to compete over
    // high-level approaches (not implementation detail). Other phases keep their altitude.
    const _probeAltitude = phaseName === "milestone" ? "high-level-approach" : undefined;
    const probe = phaseName === "partition"
      ? await runPartitionProbe(projectDir, { milestone, briefPath: brief.briefPath, userInput, phaseNameOpt: "Probe" })
      : await runSolutionSpaceProbe(projectDir, phaseName, { milestone, briefPath: brief.briefPath, userInput, phaseNameOpt: "Probe", altitude: _probeAltitude });
    competitionOn = !!probe.compete;
    competitionN = competitionOn ? AUTO_COMPETITION_N : 1;
    log(`competition: AUTO → ${competitionOn ? `COMPETE (${AUTO_COMPETITION_N} producers)` : "single draft"} — ${probe.reason}${probe.approaches && probe.approaches.length ? ` [approaches: ${probe.approaches.join("; ")}]` : ""}`);
  }
}

// M84 Red Team LOW: announce "Phase" only on the single-draft path (the
// competition path announces Compete/Judge/Finalize instead) so no empty stage shows.
// M89: Stated-Claims instruction appended to each research-eligible phase's prompt.
// prd/design-decompose/doc-ripple are excluded (no load-bearing external claims expected).
const promptByPhase = {
  partition: `Decompose the milestone into 2-5 independent domains. Write .gsd-t/domains/{domain}/{scope,constraints,tasks}.md. Cross-domain contracts in .gsd-t/contracts/.

${STATED_CLAIMS_INSTRUCTION}`,
  plan: `For each domain, write atomic tasks.md entries with files, contract refs, dependencies, acceptance criteria. Update .gsd-t/contracts/integration-points.md with wave groupings.

M83 PLAN HARDENING (mandatory — the plan is BLOCKED from execute otherwise): every task that declares acceptance criteria MUST also declare (1) **Files** = the concrete code path that implements it, and (2) a TEST that fails if that path is dead — name it in a **Test** field, a test-file path (\`*.test.*\` / \`*.spec.*\` / \`e2e/\`), or a runner (vitest/cargo test/playwright). The ONE task that delivers the milestone's HEADLINE capability MUST be tagged **Headline:** true and carry BOTH a real implementation path AND a test that exercises that capability end-to-end (e.g. for a "100MB+ file" milestone, a test that actually opens a >100MB fixture). NEVER defer a milestone's own headline capability or a core AC to a later milestone. This exists because NiceNote M5 shipped its headline (100MB+ chunked read) as DEAD CODE with no test and burned 4 verify cycles.

${STATED_CLAIMS_INSTRUCTION}`,
  discuss: `Multi-perspective exploration of design questions. Settle locked decisions into .gsd-t/CONTEXT.md. Do NOT implement.

${STATED_CLAIMS_INSTRUCTION}`,
  impact: `Analyze downstream effects of proposed changes. Identify breaking changes, affected consumers, migration paths.

${STATED_CLAIMS_INSTRUCTION}`,
  milestone: `Define a new milestone — origin, goal, success criteria, falsifiable acceptance. Append to .gsd-t/progress.md. Defer partition/plan.

TWO-ALTITUDE INTENTION-FIRST FLOW (M87, default-ON — contract pseudocode-source-of-truth-contract.md §1). Author the milestone at two altitudes, IN ORDER:
  ALTITUDE 1 — HIGH-LEVEL APPROACH (signed off FIRST): emit the high-level approach pseudocode — what/why/when (the user's intention, never agent reasoning), the actors, and a one-breath summary ("one call in one breath"). PRESENT this approach to the user for SIGN-OFF. The detailed doc is authored ONLY AFTER the approach is approved — the sign-off is the checkpoint between the two altitudes. (This is a PROSE flow: describe the checkpoint; do NOT assert a machine-checkable DEFINED-state predicate — that is M88.)
  ALTITUDE 2 — DETAILED doc: only after the approach is signed off, author .gsd-t/pseudocode/PseudoCode-[Title].md at exemplar granularity (the §1 section set: Intention, Mechanism, one-breath table, Guard map, Divergence flags, Appendix). [Title] = the SUBJECT (e.g. PseudoCode-PayPal.md), never a milestone id; a milestone may produce several.
DEFAULT-ON; skip is a LOGGED decision in progress.md naming WHY — NEVER a silent default-off (feedback_no_silent_degradation).
KEEP-OR-SUPERSEDE: before encoding any model inherited from shipped code, run the keep-or-supersede protocol (templates/prompts/keep-or-supersede-subagent.md) — per inherited model ASK keep or supersede; each supersede WRITES a ⚠ Divergence flag (§4 grammar) into the doc. Keep = no flag.

${STATED_CLAIMS_INSTRUCTION}`,
  prd: `Generate a product requirements doc at docs/prd.md. Functional + non-functional requirements traceable to acceptance criteria.`,
  "design-decompose": `Decompose a design reference (Figma URL / images) into hierarchical contracts: elements -> widgets -> pages, each at .gsd-t/contracts/design/.`,
  "doc-ripple": `Identify and update all docs affected by recent code changes per the Document Ripple Completion Gate. No code edits.`,
};

const baseObjective = promptByPhase[phaseName];
const briefLine = `**Brief (REQUIRED):** ${brief.briefPath || "(no brief — re-walk repo)"}`;

let result;
// M90 §2 D4-T4: holds the divergence-path result from the competition arm (R-ARCH-1).
// Set inside the competition arm (before Finalize), attached to result after.
let _pendingArchTriggerDivergence = null;
if (!competitionOn) {
  // ── Single-producer path (default, unchanged behavior) ──
  phase("Phase");
  result = await agent(
    [
      `You are the ${phaseName} phase agent.`,
      milestone ? `Milestone: ${milestone}` : "",
      briefLine,
      userInput ? `\nUser input:\n${userInput}` : "",
      ``,
      `Objective: ${baseObjective}`,
      ``,
      `Follow the CLAUDE.md Pre-Commit Gate. Commit artifacts with prefix "${(milestone || "m").toLowerCase()}(${phaseName})".`,
      `Return JSON per the schema.`,
    ].filter(Boolean).join("\n"),
    { label: phaseName, phase: "Phase", schema: PHASE_RESULT_SCHEMA, model: "opus" }
  ).catch((e) => ({ status: "failed", artifacts: [], summary: `agent error: ${e && e.message}` }));
} else {
  // ── M82/M84 Competition Mode: generate -> judge -> finalize ──
  // Distinct "angles" so the N Self-MoA producers explore different regions of the
  // solution space (diversity by prompt, not by model — Self-MoA > Mixed-MoA).
  // M84 Red Team MEDIUM: angles must be PHASE-AWARE — the old partition-only set
  // gave a discuss/milestone producer a contradictory "carve file-disjoint domains"
  // directive, degrading 3 of 4 now-automatic phases. Each eligible phase gets its
  // own angle set (analogous to RUBRIC_AXES_BY_PHASE).
  const ANGLES_BY_PHASE = {
    partition: [
      "Optimize for MAXIMUM parallelism: carve the most file-disjoint domains that can run concurrently.",
      "Optimize for SIMPLICITY: the fewest domains with the cleanest, most obvious boundaries.",
      "Optimize for RISK ISOLATION: isolate the riskiest/most-coupled work into its own domain so the rest stays safe.",
      "Optimize for DEPENDENCY DEPTH: minimize serial gates (waves) between domains.",
      "Optimize for BALANCE: roughly equal-sized domains with minimal cross-talk.",
    ],
    milestone: [
      "Optimize for FASTEST TIME-TO-VALUE: the leanest milestone sequence that ships something usable soonest.",
      "Optimize for RISK-FIRST: front-load the riskiest/most-uncertain work so failure is cheap and early.",
      "Optimize for DEPENDENCY ORDER: sequence strictly by what unblocks the most downstream work.",
      "Optimize for USER-VALUE-FIRST: order milestones by the value each delivers to the end user.",
      "Optimize for SIMPLICITY: the fewest, most self-contained milestones with minimal cross-cutting.",
    ],
    discuss: [
      "Argue the SIMPLEST viable architecture, even if it sacrifices some flexibility.",
      "Argue the most ROBUST/CORRECT architecture, accepting more upfront complexity.",
      "Argue the most EXTENSIBLE architecture, optimizing for future change.",
      "Argue a PRAGMATIC middle path, naming the explicit trade-offs it accepts.",
      "Argue a CONTRARIAN approach that questions an assumption the others take for granted.",
    ],
    "design-decompose": [
      "Decompose ATOMIC-FIRST: smallest reusable elements up, composed into widgets then pages.",
      "Decompose PAGE-FIRST: whole pages down into sections, widgets, then elements.",
      "Decompose TOKEN-DRIVEN: design tokens + primitives first, structure follows the system.",
      "Decompose by REUSE: maximize shared components; minimize one-off bespoke pieces.",
      "Decompose by FEATURE: group elements/widgets by the user-facing feature they serve.",
    ],
  };
  const ANGLES = ANGLES_BY_PHASE[phaseName] || [
    "Explore a materially different approach, optimizing for simplicity.",
    "Explore a materially different approach, optimizing for robustness/correctness.",
    "Explore a materially different approach, optimizing for extensibility.",
    "Explore a pragmatic middle path, naming its trade-offs.",
    "Explore a contrarian approach that questions a shared assumption.",
  ];

  const PRODUCER_SCHEMA = phaseName === "partition"
    ? {
        type: "object", required: ["id", "domains"], additionalProperties: true,
        properties: {
          id: { type: "string" },
          rationale: { type: "string" },
          domains: {
            type: "array", items: {
              type: "object", required: ["name", "touches"], additionalProperties: true,
              properties: {
                name: { type: "string" },
                touches: { type: "array", items: { type: "string" } },
                summary: { type: "string" },
              },
            },
          },
        },
      }
    : {
        type: "object", required: ["id", "proposal"], additionalProperties: true,
        properties: { id: { type: "string" }, proposal: { type: "string" }, rationale: { type: "string" } },
      };

  phase("Compete");
  log(`competition: ${competitionN} producers (Self-MoA, model=opus) for ${phaseName}`);
  const ids = ["A", "B", "C", "D", "E"];
  const candidates = (await parallel(
    Array.from({ length: competitionN }, (_, i) => () =>
      agent(
        [
          `You are candidate ${ids[i]} — one of ${competitionN} INDEPENDENT ${phaseName} proposals competing on quality.`,
          milestone ? `Milestone: ${milestone}` : "",
          briefLine,
          userInput ? `\nUser input:\n${userInput}` : "",
          ``,
          `Objective: ${baseObjective}`,
          `Your distinct angle: ${ANGLES[i % ANGLES.length]}`,
          ``,
          `DO NOT write or commit any files. PROPOSE ONLY — return your proposal as JSON per the schema.`,
          phaseName === "partition"
            ? `For "touches", list the concrete repo file paths each domain will WRITE (its owned files). Be specific and realistic — the judge scores file-disjointness from these.`
            : `Put the full proposal text in "proposal".`,
          `Set "id" to "${ids[i]}".`,
        ].filter(Boolean).join("\n"),
        { label: `candidate:${ids[i]}`, phase: "Compete", schema: PRODUCER_SCHEMA, model: "opus" }
      ).then((c) => ({ ...c, id: c.id || ids[i] })).catch(() => null)
    )
  )).filter(Boolean);

  if (candidates.length === 0) {
    return { status: "failed", artifacts: [], summary: "competition: all producers failed" };
  }

  phase("Judge");
  let winnerId = null;
  let ranked = [];
  if (phaseName === "partition") {
    // OBJECTIVE oracle judge — calculator, not critic.
    const env = await runCompetitionJudge(projectDir, { kind: "partition", candidates }, "judge:oracle", "Judge");
    winnerId = env.winner; ranked = env.ranked || [];
  } else {
    // SUBJECTIVE judge: a different-model (sonnet) rubric scorer. Candidates are
    // blind (author identity stripped) AND shuffled (deterministic permutation) so
    // judge position no longer correlates with producer index/angle — Red Team
    // HIGH-3: the shuffle was claimed in a comment but never implemented.
    const axes = RUBRIC_AXES_BY_PHASE[phaseName] || [{ key: "quality", weight: 1 }];
    // Deterministic permutation (Math.random is sandbox-banned): rotate by a seed
    // derived from the milestone+phase string so order is stable per run but
    // decoupled from producer index. The CLI tiebreak keys off the candidate's own
    // id (carried through), so final selection stays reproducible regardless.
    const seedStr = `${milestone || "m"}:${phaseName}`;
    let seed = 0;
    for (let k = 0; k < seedStr.length; k++) seed = (seed * 31 + seedStr.charCodeAt(k)) >>> 0;
    const rot = candidates.length ? (seed % candidates.length) : 0;
    const shuffled = candidates.map((_, i) => candidates[(i + rot) % candidates.length]);
    const labeled = shuffled.map((c, i) => ({ id: c.id, label: ids[i], text: c.proposal || c.rationale || "" }));
    const rubric = await agent(
      [
        `You are a BLIND, IMPARTIAL judge scoring ${labeled.length} competing ${phaseName} proposals.`,
        `Score each on a 1-5 scale per axis: ${axes.map((a) => a.key).join(", ")}. Higher = better.`,
        `Judge ONLY the content. The labels are arbitrary and the order is randomized — do NOT prefer earlier ones. Be calibrated and critical.`,
        ``,
        ...labeled.map((c) => `### Candidate ${c.label}\n${c.text}`),
        ``,
        `Return JSON: { "scores": [ { "id": "<candidate label A/B/C...>", "<axis>": <1-5>, ... }, ... ] }`,
        `IMPORTANT: use the CANDIDATE LABEL (A, B, C…) shown above as the "id" in your scores.`,
      ].join("\n"),
      {
        label: "judge:rubric", phase: "Judge", model: overrides["competition-judge"] ?? "fable",
        schema: {
          type: "object", required: ["scores"], additionalProperties: true,
          properties: { scores: { type: "array", items: { type: "object", additionalProperties: true } } },
        },
      }
    ).catch(() => ({ scores: [] }));
    // Map the judge's label-keyed scores back to the REAL candidate ids before
    // deterministic selection (so the winner id matches an actual candidate).
    const labelToId = new Map(labeled.map((c) => [c.label, c.id]));
    const judgeCandidates = (rubric.scores || []).map((s) => {
      const { id, ...rest } = s; return { id: labelToId.get(id) || id, scores: rest };
    });
    const env = await runCompetitionJudge(projectDir, { kind: "generic", axes, candidates: judgeCandidates }, "judge:select", "Judge");
    winnerId = env.winner; ranked = env.ranked || [];
  }

  // Red Team HIGH-1: NEVER fall back to an arbitrary candidate. For partition the
  // judge returns winner=null only when EVERY candidate is file-overlapping
  // (invalid) — committing candidates[0] would ship an invalid partition the
  // dispatcher then mis-fans-out (contract Invariant 2). Hard-fail instead.
  let winner = candidates.find((c) => c.id === winnerId);
  if (!winner) {
    if (phaseName === "partition") {
      log(`competition: no VALID partition among ${candidates.length} candidates — failing the phase (Invariant 2: invalid never selected).`);
      return {
        status: "failed", artifacts: [],
        summary: `competition: no valid (file-disjoint) partition among ${candidates.length} candidates`,
        competition: { n: candidates.length, winner: null, ranked },
      };
    }
    // Subjective phases: fall back to the judge's rank-1, else the first candidate.
    const rank1 = (ranked[0] && candidates.find((c) => c.id === ranked[0].id)) || candidates[0];
    winner = rank1;
    log(`competition: judge returned no winner; falling back to rank-1 (${winner.id}).`);
  }
  log(`competition: winner = ${winner.id} (of ${candidates.map((c) => c.id).join(", ")})`);

  // M90 §2 D4-T4 — R-ARCH-1 divergence-sampling (competition arm only, EXPERIMENTAL+MEASURED).
  // Feed the N producers' proposals to the divergence-sampling path. HONESTY CLAUSE (the doctrine
  // on itself): Self-MoA (one model, temperature-varied) may not diverge like fresh-context saga
  // cases the threshold was tuned on. The result is EXPERIMENTAL: the instrumentation sink records
  // the fire-rate; we NEVER claim it works. If the divergence score is low (convergent), that is
  // still a measurement — the path is not broken, the formula is just not exercised by Self-MoA.
  {
    const candidateTexts = candidates.map((c) => {
      // Extract a representative text from each candidate for divergence analysis.
      if (phaseName === "partition") {
        return JSON.stringify(c.domains || []);
      }
      return String(c.proposal || c.rationale || "");
    }).filter((t) => t.length > 0);

    if (candidateTexts.length >= 2) {
      const triggerInput = JSON.stringify({
        type: "divergence-sampling",
        answers: candidateTexts,
        basis: `${phaseName} phase competition: ${candidates.length} Self-MoA producers — checking if proposal divergence signals an unproven architectural assumption`,
      });
      const divResult = await runCli(
        projectDir,
        "architectural-trigger",
        ["trigger", triggerInput],
        "gsd-t-architectural-trigger.cjs",
        `arch-trigger-divergence:${phaseName}`,
        true,
        "Judge"
      );
      const divEnv = divResult.envelope || {};
      // Log the result — ALWAYS note the experimental nature (no efficacy claim).
      // The divergenceScore and fired flag are the measurement; the sink has the record.
      log(
        `M90 arch-trigger R-ARCH-1 (competition-arm, EXPERIMENTAL): ` +
        `${phaseName} | fired=${divEnv.fired} | divergenceScore=${divEnv.divergenceScore != null ? divEnv.divergenceScore.toFixed(3) : "?"} | ` +
        `reason=${divEnv.reason || "?"} | experimental=true (Self-MoA may not diverge like fresh-context saga cases)`
      );
      // Store the result for attachment to `result` after Finalize assigns it.
      _pendingArchTriggerDivergence = {
        fired: divEnv.fired || false,
        divergenceScore: divEnv.divergenceScore != null ? divEnv.divergenceScore : null,
        reason: divEnv.reason || null,
        experimental: true,
        n: candidateTexts.length,
      };
    } else {
      log(`M90 arch-trigger R-ARCH-1: skipped — only ${candidateTexts.length} producer text(s) available (need ≥2)`);
    }
  }

  // FINALIZE: one agent commits the WINNING approach (pick-one at the thesis level),
  // then enriches it with non-overlapping good line-items from the losers (safe union
  // at the separable layer — "winner + salvage orphaned good ideas"; never grafts a
  // coupled thesis). Per the two-gate rule in competition-mode-contract.md.
  phase("Finalize");
  const winnerBlob = phaseName === "partition" ? JSON.stringify(winner.domains) : (winner.proposal || winner.rationale || "");
  const losersBlob = candidates.filter((c) => c.id !== winner.id)
    .map((c) => phaseName === "partition" ? JSON.stringify(c.domains) : (c.proposal || c.rationale || ""))
    .join("\n---\n");
  // For partition, the finalizer must report the EXACT domains+touches it committed
  // so we can RE-VALIDATE the graft (Red Team HIGH-2 / contract Invariant 4: a
  // salvaged "missed file" could silently reintroduce a write-target overlap).
  const FINALIZE_SCHEMA = phaseName === "partition"
    ? {
        // finalizedDomains REQUIRED for partition (Red Team recheck LOW-1): if it's
        // optional, a finalizer that omits it silently bypasses re-validation.
        type: "object", required: ["status", "artifacts", "finalizedDomains"], additionalProperties: false,
        properties: {
          status: { type: "string", enum: ["complete", "partial", "blocked", "failed"] },
          artifacts: { type: "array", items: { type: "string" } },
          summary: { type: "string" },
          decisions: { type: "array", items: { type: "string" } },
          finalizedDomains: {
            type: "array", items: {
              type: "object", required: ["name", "touches"], additionalProperties: true,
              properties: { name: { type: "string" }, touches: { type: "array", items: { type: "string" } } },
            },
          },
        },
      }
    : PHASE_RESULT_SCHEMA;

  result = await agent(
    [
      `You are the ${phaseName} finalizer. A competition selected a WINNING proposal; implement it for real.`,
      milestone ? `Milestone: ${milestone}` : "",
      briefLine,
      ``,
      `Objective: ${baseObjective}`,
      ``,
      `WINNING proposal (implement this whole — it is a coherent thesis, do NOT Frankenstein it):`,
      winnerBlob,
      ``,
      `Other proposals (for SALVAGE ONLY — fold in any non-overlapping, clearly-good line-items, e.g. an extra risk, a missed file, a better domain name — that do NOT conflict with the winning structure. NEVER assign a file to a domain that another domain already owns. If in doubt, leave them out):`,
      losersBlob || "(none)",
      ``,
      `Now WRITE the real artifacts and follow the CLAUDE.md Pre-Commit Gate. Commit with prefix "${(milestone || "m").toLowerCase()}(${phaseName})".`,
      phaseName === "partition"
        ? `Return JSON per the schema, INCLUDING "finalizedDomains" — the exact {name, touches[]} of every domain you committed (touches = the repo files each domain OWNS/WRITES). This is re-validated for file-disjointness.`
        : `Return JSON per the schema.`,
      `Include the competition outcome in "decisions" (e.g. "competition: winner ${winner.id} of ${candidates.length}").`,
    ].filter(Boolean).join("\n"),
    { label: `${phaseName}:finalize`, phase: "Finalize", schema: FINALIZE_SCHEMA, model: "opus" }
  ).catch((e) => ({ status: "failed", artifacts: [], summary: `finalizer error: ${e && e.message}` }));

  // Re-validate the FINALIZED partition (Invariant 4). If salvage reintroduced an
  // overlap, the finalized graft is invalid → block completion with a clear reason.
  if (phaseName === "partition" && result && result.status !== "failed") {
    const finalized = Array.isArray(result.finalizedDomains) ? result.finalizedDomains : null;
    if (!finalized || !finalized.length) {
      // No finalizedDomains to re-check → can't prove disjointness → block rather
      // than silently accept (Red Team recheck LOW-1: never fail-open on the gate).
      log(`competition: finalizer returned no finalizedDomains — cannot re-validate disjointness, blocking.`);
      result.status = "blocked";
      result.summary = `finalizer did not report finalizedDomains; partition disjointness unverifiable. ${result.summary || ""}`.trim();
    } else {
      const reval = await runCompetitionJudge(
        projectDir,
        { kind: "partition", candidates: [{ id: "finalized", domains: finalized }] },
        "judge:revalidate", "Finalize"
      );
      if (reval.winner !== "finalized") {
        log(`competition: FINALIZED partition failed re-validation (salvage reintroduced a file overlap) — blocking (Invariant 4).`);
        result.status = "blocked";
        result.summary = `finalized partition is NOT file-disjoint (salvage overlap); re-run finalize dropping the conflicting file. ${result.summary || ""}`.trim();
      }
    }
  }

  // Thread the competition telemetry up so the caller can report measured SC#1.
  result.competition = { n: candidates.length, winner: winner.id, ranked };
  // M90 §2 D4-T4: attach divergence-path result if computed (EXPERIMENTAL+MEASURED).
  if (_pendingArchTriggerDivergence && result) {
    result.archTriggerDivergence = _pendingArchTriggerDivergence;
  }
}

// ── M89 Stated-Claims pipeline (research-eligible phases) ──────────────────
// Runs AFTER the phase agent writes its artifacts and BEFORE the Plan Hardening
// gate so that any external guessed claims get cited before the gate runs.
// The pre-mortem (inside Plan Hardening below) also embeds the Stated-Claims
// instruction — its claims are processed inside the pre-mortem agent call itself
// (it cites in its prompt context); the gate here covers the main plan/partition/
// discuss/milestone/impact output.
if (result && result.status !== "failed" && RESEARCH_ELIGIBLE_PHASES.has(phaseName)) {
  const statedClaimsCtx = (result.summary || "") + "\n" + (result.decisions || []).join("\n");
  const scPipeline = await runStatedClaimsPipeline(projectDir, phaseName, result, statedClaimsCtx);
  result.statedClaimsPipeline = scPipeline;
  if (scPipeline.errors && scPipeline.errors.length > 0) {
    log(`m89: ${phaseName}: stated-claims pipeline completed with ${scPipeline.errors.length} error(s) — uncited markers may remain (verify gate will enforce)`);
  }
}

// ── M83 Left-Shifted Plan Hardening (plan phase only) ──
// Two blocking gates run AFTER the plan agent writes tasks.md and BEFORE the plan
// is declared complete — so execute can never start on a plan that would produce a
// dead deliverable or an unguarded edge case. Contract: plan-hardening-contract.md.
//   (1) Deterministic acceptance-traceability gate — every behavioral task's ACs
//       must bind to a code path + a killing test; the headline must be impl+test.
//   (2) Adversarial pre-mortem agent (opus, fresh-context, assume-the-plan-is-flawed)
//       — predicts edge-case / dead-deliverable / NFR failures; each blocking
//       finding must become a required test before execute.
if (phaseName === "plan" && result && result.status !== "failed") {
  phase("Plan Hardening");

  // (1) Deterministic gate. FAIL-CLOSED (Red Team MEDIUM-2): a deterministic gate
  // that can't be evaluated (CLI error / unparsed envelope) is NOT a pass — block.
  const trace = await runTraceabilityGate(projectDir, milestone, "traceability-gate", "Plan Hardening");
  const traceUnparsed = trace && trace.reason === "gate-unparsed";
  if (trace && (trace.ok === false || traceUnparsed)) {
    const vcount = (trace.violations || []).length;
    const why = traceUnparsed
      ? `traceability gate could not be evaluated (CLI error / unparsed output) — failing closed; re-run plan.`
      : `${vcount} acceptance criteria not bound to a code path + killing test (M83 traceability gate). Fix tasks.md, then re-run plan.`;
    log(`plan-hardening: traceability gate BLOCKED — ${traceUnparsed ? "unevaluable (fail-closed)" : vcount + " untraceable AC"}.`);
    result.status = "blocked";
    result.summary = `plan blocked: ${why} ${result.summary || ""}`.trim();
    result.traceability = trace;
    return result;
  }
  result.traceability = trace;

  // (2) Adversarial pre-mortem. The agent reads its own protocol at spawn time
  // (the orchestrator has no fs); blocking findings convert to required tests.
  const PRE_MORTEM_SCHEMA = {
    type: "object", required: ["verdict", "findings"], additionalProperties: true,
    properties: {
      verdict: { type: "string", enum: ["BLOCK", "CLEARED"] },
      findings: {
        type: "array", items: {
          type: "object", required: ["severity", "condition", "requiredTest"], additionalProperties: true,
          properties: {
            severity: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"] },
            category: { type: "string" }, condition: { type: "string" },
            whyItFails: { type: "string" }, requiredTest: { type: "string" }, affectedAC: { type: "string" },
          },
        },
      },
      headlineAssessment: { type: "object", additionalProperties: true },
      notes: { type: "string" },
    },
  };
  const preMortem = await agent(
    [
      `You are the adversarial Pre-Mortem reviewer for milestone ${milestone || "(current)"}.`,
      `FIRST read your protocol via the Read tool: templates/prompts/pre-mortem-subagent.md (in the installed @tekyzinc/gsd-t package, or this project's copy). Follow it exactly.`,
      `**Brief (REQUIRED):** ${brief.briefPath || "(no brief — read plan artifacts directly)"}`,
      `Attack the PLAN at .gsd-t/domains/*/{scope,constraints,tasks}.md + .gsd-t/contracts/ + docs/requirements.md.`,
      `Predict, before any code is executed, how this milestone will FAIL: edge cases, dead deliverables, unguarded NFRs, shallow-test traps. Scrutinize the HEADLINE capability hardest — is it bound to a real path, reachable, and covered by a killing test?`,
      `Every blocking finding MUST convert to a concrete requiredTest the plan must adopt. Advisory notes are forbidden.`,
      `Verdict BLOCK if any concrete, falsifiable failure condition lacks a named required test; else CLEARED. Return JSON per the schema.`,
      ``,
      `M89 ${STATED_CLAIMS_INSTRUCTION}`,
    ].join("\n"),
    { label: "pre-mortem", phase: "Plan Hardening", schema: PRE_MORTEM_SCHEMA, model: overrides["pre-mortem"] ?? "fable" }
  ).catch((e) => ({ verdict: "BLOCK", findings: [{ severity: "HIGH", condition: `pre-mortem agent error: ${e && e.message}`, requiredTest: "re-run pre-mortem" }], notes: "agent-error" }));

  result.preMortem = preMortem;
  if (preMortem && preMortem.verdict === "BLOCK") {
    const n = (preMortem.findings || []).length;
    log(`plan-hardening: pre-mortem BLOCKED — ${n} predicted failure condition(s) need required tests in the plan.`);
    result.status = "blocked";
    result.summary = `plan blocked: pre-mortem found ${n} falsifiable failure condition(s) not covered by a planned test (M83). Add the required tests to tasks.md, then re-run plan. ${result.summary || ""}`.trim();
  }
}

return result;
