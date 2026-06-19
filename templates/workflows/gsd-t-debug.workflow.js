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

const projectDir = _args.projectDir || ".";
const symptom = _args.symptom || null;

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

// M89 §7 — normalize claim-key (§4.1 exact-match key)
function normalizeClaimKey(claim) {
  return claim.toLowerCase().replace(/\s+/g, " ").trim().replace(/^[^\w]+|[^\w]+$/g, "");
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
    `Search project at \`${projectDir}\` for claim: "${escaped}"`,
    `Run: \`grep -r --include="*.js" --include="*.ts" --include="*.md" --include="*.cjs" -l "${escaped.slice(0, 60)}" "${projectDir}" 2>/dev/null | head -5\``,
    `Return JSON: { "found": <boolean>, "matches": ["<file>", ...] }.`,
    `Do ONLY this grep.`,
  ].join("\n");
  const schema = { type: "object", required: ["found"], additionalProperties: true, properties: { found: { type: "boolean" }, matches: { type: "array", items: { type: "string" } } } };
  const r = await agent(prompt, { label: "grep-internal-claim", model: "haiku", schema, phase: phaseName }).catch(() => ({ found: false, matches: [] }));
  return r || { found: false, matches: [] };
}

// M89 §2 — research result schema
const RESEARCH_RESULT_SCHEMA = {
  type: "object", required: ["ok", "gapKey"], additionalProperties: true,
  properties: { ok: { type: "boolean" }, gapKey: { type: "string" }, citedBlock: { type: "string" }, sourceUrls: { type: "array", items: { type: "string" } }, fetchDates: { type: "array", items: { type: "string" } }, reason: { type: "string" } },
};

// M89 Research sub-routine: classify+cite one GUESSED claim (§1/§2/§3/§4/§5.1/§7)
async function runResearchForClaim(projectDir, claimText, artifactPath, phaseName) {
  const claimKey = normalizeClaimKey(claimText);

  // §4.1 idempotency check
  if (artifactPath) {
    const atxt = await agent(`Read \`${artifactPath}\` and return JSON: { "text": "<content>" }. If missing: { "text": "" }.`,
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
    await agent(
      `Append \`${m}\` to \`${ap}\` if not already present. Bash: \`grep -qF '${m.replace(/'/g, "'\\''")}' '${ap}' || echo '${m.replace(/'/g, "'\\''")}' >> '${ap}'\`. Return JSON: { "done": true }.`,
      { label: "write-uncited-marker", model: "haiku", schema: { type: "object", required: ["done"], properties: { done: { type: "boolean" } }, additionalProperties: true }, phase: phaseName }
    ).catch(() => {});
  }

  async function flipAndCite(ap, key, citedBlock) {
    if (!ap || !citedBlock) return;
    const um = uncitedMarker(key);
    const cm = citedMarker(key);
    await agent(
      `Edit \`${ap}\`: replace \`${um}\` with \`${cm}\`, then append:\n${citedBlock}\nReturn JSON: { "done": true }.`,
      { label: "flip-marker-cite", model: "haiku", schema: { type: "object", required: ["done"], properties: { done: { type: "boolean" }, action: { type: "string" } }, additionalProperties: true }, phase: phaseName }
    ).catch(() => {});
  }

  if (envelope.class === "external") {
    log(`Research: external failure-root → research(fable) instead of patch-guess for "${claimKey.slice(0, 50)}"`);
    await appendUncitedMarker(artifactPath, claimKey);
    const rr = await agent(
      [
        `Read \`${projectDir}/templates/prompts/research-subagent.md\` for the research protocol.`,
        `Debug failure-root claim (external): "${claimText}"`,
        `Gap-key: "${claimKey}"`,
        `Emit ## Verified Facts (auto-research) block with source URL + fetch date. Return StructuredOutput JSON.`,
      ].join("\n"),
      { label: "research", model: "fable", schema: RESEARCH_RESULT_SCHEMA, phase: phaseName }
    ).catch((e) => ({ ok: false, gapKey: claimKey, reason: String(e && e.message) }));

    if (rr && rr.ok && rr.citedBlock) {
      await flipAndCite(artifactPath, claimKey, rr.citedBlock);
      log(`Research: cited debug claim "${claimKey.slice(0, 50)}"`);
    } else {
      log(`Research: research failed for "${claimKey.slice(0, 50)}" — uncited marker remains`);
    }

  } else {
    // internal → grep (A3 routing decision)
    log(`Research: internal debug claim → grep for "${claimText.slice(0, 50)}"`);
    const gr = await grepForClaim(projectDir, claimText, phaseName);
    if (gr.found) {
      log(`Research: internal claim resolved by grep — no research needed`);
    } else {
      // §5.1 escalation
      log(`Research: grep empty — escalating to external (§5.1): "${claimText.slice(0, 50)}"`);
      await appendUncitedMarker(artifactPath, claimKey);
      const er = await agent(
        [
          `Read \`${projectDir}/templates/prompts/research-subagent.md\`.`,
          `Debug escalation (§5.1 — grep returned nothing): "${claimText}"`,
          `Gap-key: "${claimKey}"`,
          `Emit ## Verified Facts (auto-research) block. Return StructuredOutput JSON.`,
        ].join("\n"),
        { label: "research", model: "fable", schema: RESEARCH_RESULT_SCHEMA, phase: phaseName }
      ).catch((e) => ({ ok: false, gapKey: claimKey, reason: String(e && e.message) }));

      if (er && er.ok && er.citedBlock) {
        await flipAndCite(artifactPath, claimKey, er.citedBlock);
        log(`Research: escalated debug claim cited "${claimKey.slice(0, 50)}"`);
      } else {
        log(`Research: escalation research failed for "${claimKey.slice(0, 50)}"`);
      }
    }
  }
}

if (!symptom) {
  log("debug: args.symptom required (description of failing test or error)");
  return { status: "failed", reason: "no-symptom" };
}

phase("Preflight");
const pre = await runPreflight(projectDir);
if (!pre.ok) return { status: "failed", reason: "preflight-failed", preflight: pre.envelope };
const brief = await generateBrief(projectDir, { kind: "execute", id: "debug-brief" });

let lastResult = null;
for (let cycle = 1; cycle <= 2; cycle++) {
  phase(`Cycle ${cycle}`);
  const prompt = [
    `Debug cycle ${cycle} of 2. Symptom: ${symptom}`,
    `**Brief:** ${brief.briefPath || "(no brief)"}`,
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
}

return {
  status: "needs-human",
  cyclesUsed: 2,
  finalResult: lastResult,
  nextSteps: lastResult.nextStepsIfNotResolved || "Two fix cycles exhausted; human review required.",
};
