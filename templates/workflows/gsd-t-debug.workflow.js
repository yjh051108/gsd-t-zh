// templates/workflows/gsd-t-debug.workflow.js
//
// Runtime: Anthropic native Workflow tool only.
// Debug phase — up to 2 fix cycles per CLAUDE.md Prime Rule. If still failing
// after 2 cycles, exit with `needs-human` so the human operator can step in.
//
// M89: Stated-Claims→classify→research wiring (auto-research-contract v1.2.0 §6.5/§1/§2/§3/§4/§7).
// Each debug cycle embeds the Stated-Claims snippet (§6.5) so the debug agent tags failure-root
// claims KNOWN|GUESSED. After each cycle, GUESSED claims are classified: external failure-root
// → write §7 marker (status=uncited) → research agent (model:"fable") → cite → flip marker
// (status=cited) — instead of a patch-guess (pairs with #33 circuit-breaker). Internal →
// grep/Read; grep-empty → escalate to external (§5.1). The existing debug-cycle ternary
// (model: cycle===1?"opus":(overrides["debug-cycle-2"]??"fable")) is PRESERVED; the research
// stage is a SEPARATE agent() with its own bare "fable" literal. Idempotent per §4.1.
//
// M94-D11 WRITER pattern (graph-consumer-wiring-contract.md §WRITER Pattern):
// READER half: before the fix agent, query blast-radius + who-calls to localize the
// bug's call chain (where does this symptom reach / what calls the failing function) —
// replaces grep-reconstructed call-chain discovery. The graph slice is injected into
// the debug cycle agent's context so it doesn't need to grep.
// WRITER half: after the fix lands (filesEdited), trigger a re-index of the touched
// set — the freshness_check_on_query (graph-freshness-contract.md D4) re-indexes any
// content-hash-dirty file before answering the next structural query, so downstream
// consumers see fresh edges after the debug fix.
// FAIL-LOUD invariant: on graph-unavailable the graph-query step surfaces the message
// "graph unavailable — fix it (gsd-t graph status)" and halts — it does NOT fall back
// to grep for the structural question. The existing 2-cycle debug logic is NOT disrupted.
// [RULE] debug-reader-and-writer-both
//
// M90 §3 D4-T3: Loop-ledger halt wired via inline runCli helper (option b).
// After each cycle, append-cycle is called with the symptom as the assertion, the primary
// edited file as the surface, and "unit" as the fileClass. After cycle 2 (end of loop),
// read-exit-state is called; if haltedButNoReExamination=true (the same computed signature
// appeared across both cycles — the ledger proves non-convergence), the workflow exits at
// the cycle-2 boundary with the ledger's PREMISE_RE_EXAMINATION directive rather than the
// generic `needs-human`. This is option (b): re-anchor the halt to the cycle-2 boundary,
// keeping the existing 2-cycle cap unchanged and only changing the EXIT REASON when the
// ledger fact proves non-convergence. Contract: unproven-assumption-doctrine-contract.md §3.2.
//
// args: { symptom, projectDir? }

export const meta = {
  name: "gsd-t-debug",
  description: "Diagnose and fix a failing test or runtime error (up to 2 attempts)",
  phases: [
    { title: "Preflight",  detail: "preflight + brief" },
    { title: "Cycle 1",    detail: "diagnose + propose + apply + verify" },
    { title: "Cycle 2",    detail: "if cycle 1 didn't resolve" },
  ],
};

// M81: runtime-native helpers (sandbox bans require/fs/child_process/process — the old
// require("./_lib.js") crashed this workflow on first eval, TD-113). Delegate CLI calls
// to an agent's Bash; args arrives as a JSON STRING in this runtime. See gsd-t-scan.workflow.js.
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
async function generateBrief(projectDir, { kind = "execute", milestone, domain, id, label = "brief", phaseName } = {}) {
  const argv = ["--kind", kind, "--spawn-id", id, "--out", `${projectDir}/.gsd-t/briefs/${id}.json`];
  if (milestone) argv.push("--milestone", milestone);
  if (domain) argv.push("--domain", domain);
  const r = await runCli(projectDir, "brief", argv, "gsd-t-context-brief.cjs", label, false, phaseName);
  return { ok: r.ok, briefPath: `${projectDir}/.gsd-t/briefs/${id}.json`, via: r.via };
}
// Broken-Graph-Halts: route a failing graph envelope's reason through the ONE shared
// classifier via Bash (sandbox bans require). Returns "ABSENT" | "BROKEN" (fail-closed).
// [RULE] one-availability-classifier [RULE] unknown-reason-fails-closed-to-broken
async function classifyGraphFailure(projectDir, reason, detail, phaseName) {
  const r = await runCli(
    projectDir, "graph-availability",
    ["classify", String(reason || ""), String(detail || "")],
    "gsd-t-graph-availability.cjs", "graph-classify", true, phaseName
  ).catch(() => null);
  const env = r && r.envelope;
  if (env && (env.state === "ABSENT" || env.state === "BROKEN")) return env.state;
  return "BROKEN";
}
// [RULE] absent-graph-auto-builds-once — build the index once via the existing path.
async function buildGraphIndex(projectDir, phaseName) {
  const r = await runCli(
    projectDir, "graph index", ["build", "--repo", projectDir],
    "gsd-t-graph-index.cjs", "graph-index", false, phaseName
  ).catch(() => null);
  return !!(r && r.ok);
}

const projectDir = _args.projectDir || ".";
const symptom = _args.symptom || null;
const milestone = _args.milestone || null; // tags loop-ledger halts so they scope to this milestone

// M99 D2: persist a kind:'wiring' ledger line. M81 sandbox: all I/O through agent() Bash.
// Uses the `gsd-t graph wiring-log --auto` CLI shim (avoids embedding require() in strings).
// [RULE] wiring-mode-three-states / [RULE] consumer-label-from-context-not-setenv
async function persistWiringMode(phaseName) {
  const consumer = "debug";
  await agent(
    [
      `Persist one graph-wiring-mode ledger line for the debug workflow.`,
      `Run: \`gsd-t graph wiring-log --consumer ${consumer} --auto --project '${projectDir}'\``,
      `(--auto detects WIRED if the graph store exists, else fallback-announced)`,
      `If the command is not found, exit 0 (ledger write is optional).`,
      `Return ONLY: {"ok": true} or {"ok": false, "reason": "<short reason>"}.`,
    ].join("\n"),
    { label: "debug:wiring-ledger", phase: phaseName, model: "haiku", schema: { type: "object", required: ["ok"], properties: { ok: { type: "boolean" }, reason: { type: "string" } } } }
  ).catch(() => null);
}

const DEBUG_CYCLE_SCHEMA = {
  type: "object",
  required: ["resolved", "rootCause", "filesEdited"],
  properties: {
    resolved:     { type: "boolean" },
    rootCause:    { type: "string" },
    filesEdited:  { type: "array", items: { type: "string" } },
    testRunResult: {
      type: "object",
      properties: { pass: { type: "integer" }, fail: { type: "integer" } },
    },
    nextStepsIfNotResolved: { type: "string" },
    // M89 §6.5 — Stated Claims: raw [GUESSED:*] lines from the debug cycle agent
    statedClaims: { type: "array", items: { type: "string" } },
    // Primary artifact path for §7 marker writes (e.g. the file being debugged / a debug report)
    artifactPath: { type: "string" },
  },
};

// M89 §7 — normalize claim-key (§4.1 exact-match key). Cycle-2 finding #1: collapse
// EVERY non-word run to a space so the key is marker-syntax-safe; byte-identical across
// all 4 workflows (m89-normalize-claim-key-parity).
function normalizeClaimKey(claim) {
  return claim.toLowerCase().replace(/[^\w]+/g, " ").trim();
}
function uncitedMarker(key) { return `<!-- auto-research-claim: class=external key=${key} status=uncited -->`; }
function citedMarker(key)   { return `<!-- auto-research-claim: class=external key=${key} status=cited -->`; }

// M89 §1 — classify via bin/gsd-t-research-gate.cjs (D1 envelope)
async function classifyClaim(projectDir, claimText, phaseName) {
  return runCli(projectDir, "research-gate", ["classify", claimText, "--json"], "gsd-t-research-gate.cjs", "classify-claim", true, phaseName);
}

// M89 §4.1 — exact key match idempotency
function isAlreadyCited(artifactText, claimKey) {
  return artifactText.includes(`auto-research-claim: class=external key=${claimKey} status=cited`);
}

// M89 §5.1 — grep repo for internal claim resolution
async function grepForClaim(projectDir, claimText, phaseName) {
  const escaped = claimText.replace(/'/g, "'\\''").slice(0, 200);
  const prompt = [
    `Decide whether THIS repo's own code/contracts/tests CONFIRM the SPECIFIC claim — not merely`,
    `share vocabulary with it (Red Team MEDIUM). Project: \`${projectDir}\`. Claim: "${escaped}"`,
    `Run: \`grep -r --include="*.js" --include="*.ts" --include="*.md" --include="*.cjs" -l "${escaped.slice(0, 60)}" "${projectDir}" 2>/dev/null | head -5\``,
    `Then Read the candidates and judge: set found=true ONLY IF the repo content actually CONFIRMS`,
    `the value/shape/behavior the claim asserts. Coincidental keyword overlap = found=false.`,
    `If the claim is about an EXTERNAL system's behavior (3rd-party API, library, browser, protocol),`,
    `grep CANNOT confirm it → found=false so it escalates to web research.`,
    `Return JSON: { "found": <boolean>, "matches": ["<file>", ...] }. No other work.`,
  ].join("\n");
  const schema = { type: "object", required: ["found"], additionalProperties: true, properties: { found: { type: "boolean" }, matches: { type: "array", items: { type: "string" } } } };
  const r = await agent(prompt, { label: "grep-internal-claim", model: "haiku", schema, phase: phaseName }).catch(() => ({ found: false, matches: [] }));
  return r || { found: false, matches: [] };
}

// M89 §1.1 — AMBIGUOUS → LLM JUDGE (bare model:"fable" — NOT the ?? form; "judge" is not
// a designated stage, so the bare literal passes the M85 tier-set check and stays DISTINCT
// from the debug-cycle ternary). internal/external/uncertain; uncertain → research (never
// guess-internal). On error → "uncertain" (fail toward research).
const CLASSIFY_JUDGE_SCHEMA = {
  type: "object", required: ["verdict"], additionalProperties: true,
  properties: { verdict: { type: "string", enum: ["internal", "external", "uncertain"] }, reason: { type: "string" } },
};
async function judgeAmbiguous(claimText, phaseName) {
  const prompt = [
    `You are the M89 ambiguous-claim JUDGE (auto-research-contract §1.1). The mechanical string-fact`,
    `classifier could not decide this GUESSED claim. Decide in natural language. Claim: "${claimText}"`,
    `- "internal"  = about THIS repo's OWN code/contracts/tests — grep/Read can confirm.`,
    `- "external"  = asserts an OUTSIDE system's behavior/shape/limit — needs web research.`,
    `- "uncertain" = you cannot CONFIDENTLY place it internal — per M89 doctrine it is RESEARCHED, never guessed.`,
    `Return JSON: { "verdict": "internal"|"external"|"uncertain", "reason": "<one line>" }. No file/web work in THIS step.`,
  ].join("\n");
  const r = await agent(prompt, { label: "classify-judge", model: "fable", schema: CLASSIFY_JUDGE_SCHEMA, phase: phaseName })
    .catch((e) => ({ verdict: "uncertain", reason: `judge error: ${e && e.message}` }));
  return (r && r.verdict) || "uncertain";
}

// M89 §2 — research result schema
const RESEARCH_RESULT_SCHEMA = {
  type: "object", required: ["ok", "gapKey"], additionalProperties: true,
  properties: { ok: { type: "boolean" }, gapKey: { type: "string" }, citedBlock: { type: "string" }, sourceUrls: { type: "array", items: { type: "string" } }, fetchDates: { type: "array", items: { type: "string" } }, reason: { type: "string" } },
};

// M89 Research sub-routine: classify+cite one GUESSED claim (§1/§2/§3/§4/§5.1/§7)
async function runResearchForClaim(projectDir, claimText, artifactPath, phaseName) {
  const claimKey = normalizeClaimKey(claimText);

  // FAIL-CLOSED (Red Team HIGH): artifactPath is self-reported + optional. An EXTERNAL (or
  // ambiguous→escalated-external) guess MUST get its §7 uncited marker written SOMEWHERE so the
  // §7 ENFORCE gate has something to fail on. Use a DETERMINISTIC FALLBACK ARTIFACT when none.
  const claimSlug = claimKey.replace(/\s+/g, "-").slice(0, 80) || "claim";
  const externalArtifact = artifactPath || `${projectDir}/.gsd-t/research/debug-${claimSlug}.md`;

  // §4.1 idempotency check — read the path actually WRITTEN (externalArtifact = real OR
  // fallback) so a re-run does not re-research a claim already cited in the fallback (MEDIUM).
  {
    const atxt = await agent(`Read \`${externalArtifact}\` and return JSON: { "text": "<content>" }. If missing: { "text": "" }.`,
      { label: "read-artifact", model: "haiku", schema: { type: "object", required: ["text"], properties: { text: { type: "string" } }, additionalProperties: false }, phase: phaseName })
      .catch(() => ({ text: "" }));
    if (isAlreadyCited((atxt && atxt.text) || "", claimKey)) {
      log(`Research: skip "${claimKey.slice(0, 50)}" — already cited (§4.1)`);
      return;
    }
  }

  const cls = await classifyClaim(projectDir, claimText, phaseName);
  const envelope = cls.envelope;
  if (!envelope || !envelope.ok) {
    log(`Research: classify error — ${cls.stderr || JSON.stringify(envelope)}`);
    return;
  }

  async function appendUncitedMarker(ap, key) {
    if (!ap) return;
    const m = uncitedMarker(key);
    const sp = ap.replace(/'/g, "'\\''");
    await agent(
      `Ensure the parent dir exists, then append \`${m}\` to \`${ap}\` if not already present. Bash: \`mkdir -p "$(dirname '${sp}')" && { grep -qF '${m.replace(/'/g, "'\\''")}' '${sp}' 2>/dev/null || echo '${m.replace(/'/g, "'\\''")}' >> '${sp}'; }\`. Return JSON: { "done": true }.`,
      { label: "write-uncited-marker", model: "haiku", schema: { type: "object", required: ["done"], properties: { done: { type: "boolean" } }, additionalProperties: true }, phase: phaseName }
    ).catch(() => {});
  }

  async function flipAndCite(ap, key, citedBlock) {
    if (!ap || !citedBlock) return;
    const um = uncitedMarker(key);
    const cm = citedMarker(key);
    await agent(
      `Ensure the parent dir of \`${ap}\` exists (Bash: \`mkdir -p "$(dirname '${ap.replace(/'/g, "'\\''")}')"\`). Then Edit \`${ap}\` (create if missing): replace \`${um}\` with \`${cm}\`, then append:\n${citedBlock}\nReturn JSON: { "done": true }.`,
      { label: "flip-marker-cite", model: "haiku", schema: { type: "object", required: ["done"], properties: { done: { type: "boolean" }, action: { type: "string" } }, additionalProperties: true }, phase: phaseName }
    ).catch(() => {});
  }

  // External-claim handler closure (reused by the ambiguous→judge path).
  const doExternal = async () => {
    log(`Research: external failure-root → research(fable) instead of patch-guess for "${claimKey.slice(0, 50)}"`);
    await appendUncitedMarker(externalArtifact, claimKey);
    const rr = await agent(
      [
        `Read \`${projectDir}/templates/prompts/research-subagent.md\` for the research protocol.`,
        `Debug failure-root claim (external): "${claimText}"`,
        `Gap-key: "${claimKey}"`,
        `Emit ## Verified Facts (auto-research) block with source URL + fetch date. Append the trailer \`key: ${claimKey}\` on every fact line so the §7 gate matches by claim-key (Red Team MEDIUM #2). Return StructuredOutput JSON.`,
      ].join("\n"),
      { label: "research", model: "fable", schema: RESEARCH_RESULT_SCHEMA, phase: phaseName }
    ).catch((e) => ({ ok: false, gapKey: claimKey, reason: String(e && e.message) }));

    if (rr && rr.ok && rr.citedBlock) {
      await flipAndCite(externalArtifact, claimKey, rr.citedBlock);
      log(`Research: cited debug claim "${claimKey.slice(0, 50)}"`);
    } else {
      log(`Research: research failed for "${claimKey.slice(0, 50)}" — uncited marker remains`);
    }
  };

  // Internal-claim handler closure (grep A3; grep-empty → escalate §5.1).
  const doInternal = async () => {
    log(`Research: internal debug claim → grep for "${claimText.slice(0, 50)}"`);
    const gr = await grepForClaim(projectDir, claimText, phaseName);
    if (gr.found) {
      log(`Research: internal claim resolved by grep — no research needed`);
    } else {
      // §5.1 escalation
      log(`Research: grep empty — escalating to external (§5.1): "${claimText.slice(0, 50)}"`);
      await appendUncitedMarker(externalArtifact, claimKey);
      const er = await agent(
        [
          `Read \`${projectDir}/templates/prompts/research-subagent.md\`.`,
          `Debug escalation (§5.1 — grep returned nothing): "${claimText}"`,
          `Gap-key: "${claimKey}"`,
          `Emit ## Verified Facts (auto-research) block. Append the trailer \`key: ${claimKey}\` on every fact line so the §7 gate matches by claim-key (Red Team MEDIUM #2). Return StructuredOutput JSON.`,
        ].join("\n"),
        { label: "research", model: "fable", schema: RESEARCH_RESULT_SCHEMA, phase: phaseName }
      ).catch((e) => ({ ok: false, gapKey: claimKey, reason: String(e && e.message) }));

      if (er && er.ok && er.citedBlock) {
        await flipAndCite(externalArtifact, claimKey, er.citedBlock);
        log(`Research: escalated debug claim cited "${claimKey.slice(0, 50)}"`);
      } else {
        log(`Research: escalation research failed for "${claimKey.slice(0, 50)}"`);
      }
    }
  };

  // ── Dispatch by the 3-result classifier verdict (v1.3.0) ────────────────────
  if (envelope.class === "external") {
    await doExternal();
  } else if (envelope.class === "internal") {
    await doInternal();
  } else {
    // class:AMBIGUOUS — no string fact; the LLM judge decides (NOT regex). internal→grep;
    // external→research; UNCERTAIN→research (uncertain = verify, NEVER guess-internal).
    log(`Research: ambiguous debug claim → LLM judge for "${claimText.slice(0, 50)}" (when unsure, research)`);
    const verdict = await judgeAmbiguous(claimText, phaseName);
    log(`Research: ambiguous "${claimKey.slice(0, 50)}" → judge: ${verdict}`);
    if (verdict === "internal") {
      await doInternal();
    } else {
      if (verdict === "uncertain") log(`Research: judge UNCERTAIN → "${claimKey.slice(0, 50)}" treated external → research (no silent guess)`);
      await doExternal();
    }
  }
}

// M94-D11 §READER: Query blast-radius + who-calls to localize the bug's call chain.
// Returns a short text snippet injected into the debug cycle agent context.
// On graph-unavailable: surfaces the message and returns null (agent proceeds without
// the structural slice — the fail-loud requirement is met by the logged message;
// the agent is NOT given a grep fallback to find the call chain).
// [RULE] debug-reader-and-writer-both
async function queryGraphForDebug(projectDir, symptom, phaseName, _rebuilt) {
  // Derive a plausible target hint from the symptom text (the file or function name)
  // to pass to blast-radius. This is heuristic — the agent reads the full slice.
  const targetHint = (symptom || "").slice(0, 80).replace(/['"]/g, "").trim();
  if (!targetHint) return { line: null, halt: false };

  const blastResult = await runCli(
    projectDir,
    "graph",
    ["blast-radius", targetHint],
    "gsd-t-graph-query-cli.cjs",
    "graph-blast-radius",
    true,
    phaseName
  );
  const env = blastResult.envelope;
  if (!env) return { line: null, halt: false };
  if (!env.ok) {
    const state = await classifyGraphFailure(projectDir, env.reason, env.detail, phaseName);
    if (state === "ABSENT" && !_rebuilt) {
      log(`M94-D11 READER: graph ABSENT — building index once, then re-querying.`);
      await buildGraphIndex(projectDir, phaseName);
      return queryGraphForDebug(projectDir, symptom, phaseName, true);
    }
    const haltMessage = `graph BROKEN (reason=${env.reason || "?"}) — debug HALTED. Fix it: run gsd-t graph status. No grep fallback.`;
    log(`M94-D11 READER: ${haltMessage}`);
    return { line: null, halt: true, haltMessage };
  }
  if (Array.isArray(env.results)) {
    return { line: `## Graph structural slice (blast-radius for "${targetHint}"):\n${JSON.stringify(env.results.slice(0, 20), null, 2)}`, halt: false };
  }
  return { line: null, halt: false };
}

// M94-D11 §WRITER: Trigger a freshness pass over the touched set after the fix lands.
// Calls gsd-t graph freshness (or who-imports) over each touched file so the next
// structural query sees fresh edges (graph-freshness-contract.md D4 surface).
// Best-effort (non-blocking) — failure is logged, not fatal.
// [RULE] debug-reader-and-writer-both
async function reindexTouchedFiles(projectDir, filesEdited, phaseName) {
  if (!Array.isArray(filesEdited) || filesEdited.length === 0) return;
  for (const f of filesEdited.slice(0, 10)) {
    // who-imports triggers freshness_check_on_query on the file before answering —
    // the side-effect is the re-index of f if it is content-hash-dirty.
    await runCli(
      projectDir,
      "graph",
      ["who-imports", f],
      "gsd-t-graph-query-cli.cjs",
      `graph-reindex-touched:${f.slice(-30)}`,
      true,
      phaseName
    ).catch(() => {}); // best-effort; don't halt debug on re-index failure
  }
  log(`M94-D11 WRITER: re-indexed ${Math.min(filesEdited.length, 10)} touched file(s) after fix`);
}

if (!symptom) {
  log("debug: args.symptom required (description of failing test or error)");
  return { status: "failed", reason: "no-symptom" };
}

phase("Preflight");
const pre = await runPreflight(projectDir);
if (!pre.ok) return { status: "failed", reason: "preflight-failed", preflight: pre.envelope };
const brief = await generateBrief(projectDir, { kind: "execute", id: "debug-brief" });
// M99 D2: persist graphWiringMode for the debug consumer. [RULE] wiring-mode-three-states
await persistWiringMode("Preflight");

// M94-D11 §READER: query graph ONCE before cycles (the structural slice is the same
// for all cycles — same symptom). Injected into each cycle's prompt.
// [RULE] broken-graph-halts-never-greps — a BROKEN graph HALTS debug (no grep fallback).
const _graphRead = await queryGraphForDebug(projectDir, symptom, "Preflight");
if (_graphRead && _graphRead.halt) {
  return { status: "blocked-needs-human", reason: "graph-broken", detail: _graphRead.haltMessage };
}
const _graphSliceLine = (_graphRead && _graphRead.line) || "";

let lastResult = null;
// M90 §3 (fix-cycle: gate lifecycle) — track THIS run's per-signature cycle counts so the
// non-convergence halt is RUN-SCOPED + REACHABLE within the 2-cycle debug cap (not dependent on
// the global HALT_THRESHOLD=3 or stale cross-run ledger state). A signature seen in BOTH cycles
// of THIS run = non-convergence at the cycle-2 boundary (option b).
const thisRunSigCycles = {}; // { [signature]: maxCyclesSeenThisRun }
for (let cycle = 1; cycle <= 2; cycle++) {
  phase(`Cycle ${cycle}`);
  const prompt = [
    `Debug cycle ${cycle} of 2. Symptom: ${symptom}`,
    `**Brief:** ${brief.briefPath || "(no brief)"}`,
    _graphSliceLine ? `\n**Graph structural slice (M94-D11 READER — blast-radius/who-calls localization):**\n${_graphSliceLine}\nUse this slice to localize the call chain — do NOT grep for structural relationships.` : "",
    cycle > 1 && lastResult
      ? `\nPREVIOUS CYCLE'S ROOT CAUSE HYPOTHESIS (did not resolve the issue):\n${lastResult.rootCause}\nFiles edited: ${lastResult.filesEdited.join(", ")}\nIf the hypothesis was right, the fix was incomplete. If wrong, formulate a different hypothesis.`
      : "",
    ``,
    `Steps: (1) read the relevant code, (2) form a hypothesis, (3) apply a fix, (4) run the affected test(s), (5) report.`,
    `Commit the fix with prefix "m61(debug-cycle${cycle})".`,
    ``,
    `**M89 STATED CLAIMS — REQUIRED (auto-research-contract §6.5):**`,
    `Read \`${projectDir}/templates/prompts/stated-claims-snippet.md\` for the DETECT protocol.`,
    `Before returning, emit a \`## Stated Claims\` section tagging every load-bearing claim`,
    `[KNOWN] or [GUESSED:assumed|unknown|stale]. Key: when the failure root involves an external`,
    `API/library behavior you ASSUMED (a guess), tag it GUESSED — the Research stage will`,
    `verify it via web instead of letting you patch-guess. Include "statedClaims" array in`,
    `StructuredOutput JSON: one per [GUESSED:*] line. Include "artifactPath" if relevant.`,
    `Return JSON per the schema.`,
  ].filter(Boolean).join("\n");

  lastResult = await agent(prompt, {
    label: `debug-cycle-${cycle}`,
    phase: `Cycle ${cycle}`,
    schema: DEBUG_CYCLE_SCHEMA,
    model: cycle === 1 ? "opus" : (overrides["debug-cycle-2"] ?? "fable"),
  }).catch((e) => ({
    resolved: false,
    rootCause: `agent error: ${e && e.message}`,
    filesEdited: [],
    nextStepsIfNotResolved: "agent threw — investigate directly",
  }));

  // M94-D11 §WRITER: re-index touched files after fix lands (freshness trigger).
  // If the fix edited files, trigger a freshness pass so the next graph query sees fresh edges.
  if (Array.isArray(lastResult.filesEdited) && lastResult.filesEdited.length > 0) {
    await reindexTouchedFiles(projectDir, lastResult.filesEdited, `Cycle ${cycle}`);
  }

  // M89 Research — classify GUESSED claims from this debug cycle (§6.5 trigger, separate from debug-cycle ternary)
  if (Array.isArray(lastResult.statedClaims) && lastResult.statedClaims.length > 0) {
    for (const claimLine of lastResult.statedClaims) {
      const m = claimLine.match(/^\[GUESSED:[^\]]+\]\s*(.+)$/);
      if (m) {
        await runResearchForClaim(projectDir, m[1].trim(), lastResult.artifactPath || null, `Cycle ${cycle}`);
      }
    }
  }

  if (lastResult.resolved) {
    return { status: "complete", cyclesUsed: cycle, finalResult: lastResult };
  }

  // M90 §3 D4-T3 — append-cycle to the loop-ledger (option b: re-anchor halt to cycle-2 boundary).
  // The symptom IS the assertion (the failing test/check); the primary edited file is the surface.
  // The ledger tracks computed signatures cross-process — next cycle's append-cycle accumulates correctly.
  // Uses the same runCli helper (inline agent()-Bash, no require/fs — M81 runtime-native invariant).
  {
    const primarySurface = (Array.isArray(lastResult.filesEdited) && lastResult.filesEdited.length > 0)
      ? lastResult.filesEdited[0]
      : "unknown";
    const assertionArg = (symptom || "unknown-symptom").slice(0, 500);
    const surfaceArg = String(primarySurface).slice(0, 200);
    const ledgerAppend = await runCli(
      projectDir,
      "loop-ledger",
      ["append-cycle",
       "--assertion", assertionArg,
       "--surface", surfaceArg,
       "--fileClass", "unit",
       ...(milestone ? ["--milestone", milestone] : []),
       "--projectDir", projectDir],
      "gsd-t-loop-ledger.cjs",
      `loop-ledger-append-cycle-${cycle}`,
      true,
      `Cycle ${cycle}`
    );
    if (ledgerAppend.envelope) {
      const env = ledgerAppend.envelope;
      log(`M90 loop-ledger cycle ${cycle}: sig=${String(env.signature || "?").slice(0, 16)} cycles=${env.cycles} halted=${env.halted}`);
      // RUN-SCOPED count: increment a LOCAL per-signature counter for each append IN THIS RUN —
      // do NOT read env.cycles (that is the GLOBAL cumulative count across all prior runs; a stale
      // count of 1 from a previous run would make cycle-1 here read 2 and falsely halt). The local
      // count only reaches 2 when the SAME signature is appended in BOTH cycles of THIS run.
      if (env.signature) {
        thisRunSigCycles[env.signature] = (thisRunSigCycles[env.signature] || 0) + 1;
      }
    }
  }
}

// M90 §3 (option b, fix-cycle: REACHABLE + RUN-SCOPED + AUTO-RESET) — after cycle 2, detect
// non-convergence from THIS RUN's signatures, not the global HALT_THRESHOLD=3 (which the 2-cycle
// debug loop can never reach) and not stale cross-run ledger state (which would brick verify).
// A signature that appeared in BOTH cycles of this run (cycles>=2) IS the cycle-2-boundary halt.
const nonConvergentSigs = Object.keys(thisRunSigCycles).filter((s) => thisRunSigCycles[s] >= 2);
if (nonConvergentSigs.length > 0) {
  log("M90 loop-ledger: non-convergence detected — same symptom-signature across both cycles of THIS run.");
  log("PREMISE_RE_EXAMINATION: the fix strategy has not converged. Re-examine the premise, not patch further.");
  // PERSIST the unresolved halt (detection != resolution — user decision, M90 verify fix-cycle 6).
  // Debug DETECTING the loop is NOT the same as the premise being RE-EXAMINED. We MARK the
  // signature as requiring re-examination (halted+pending) and LEAVE IT SET — so the verify
  // R-FAIL-3 gate actually sees the unresolved loop and FAILS, blocking the build until a genuine
  // re-examination runs `record-re-examination`. Auto-clearing here (the prior bug) made the gate
  // vacuous: it could never fire. The brick-risk that motivated auto-clear is handled instead by
  // run-LOCAL counting + the gitignored transient state file (a stale cross-run/cross-project halt
  // can't reach an unrelated verify).
  for (const sig of nonConvergentSigs) {
    await runCli(
      projectDir,
      "loop-ledger",
      ["mark-re-examination-required", "--signature", sig, ...(milestone ? ["--milestone", milestone] : []), "--projectDir", projectDir],
      "gsd-t-loop-ledger.cjs",
      "loop-ledger-mark-re-examination-required",
      true,
      "Cycle 2"
    );
  }
  return {
    status: "premise-re-examination",
    reason: "M90 §3 R-LOOP-2: same computed symptom-signature across both debug cycles of this run. " +
      "The fix strategy is non-converging. Per the Unproven-Assumption Doctrine (option b), " +
      "this workflow exits with a PREMISE_RE_EXAMINATION directive instead of dispatching a 3rd patch. " +
      "Action required: stop patching, research how others solved this class of problem, re-examine the premise.",
    directive: "PREMISE_RE_EXAMINATION",
    routeTo: "architectural-hook",
    module: "bin/gsd-t-architectural-trigger.cjs",
    contract: ".gsd-t/contracts/unproven-assumption-doctrine-contract.md §3.2",
    cyclesUsed: 2,
    finalResult: lastResult,
    haltedSignatures: nonConvergentSigs,
  };
}

return {
  status: "needs-human",
  cyclesUsed: 2,
  finalResult: lastResult,
  nextSteps: lastResult.nextStepsIfNotResolved || "Two fix cycles exhausted; human review required.",
};
