// templates/workflows/gsd-t-quick.workflow.js
//
// Runtime: Anthropic native Workflow tool only.
// Quick — small one-shot task with contract awareness.
// preflight + brief + agent(task) + research (M89 Stated-Claims) + verify-gate (light)
//
// M89: Stated-Claims→classify→research wiring (auto-research-contract v1.2.0 §6.5/§1/§2/§3/§4/§7).
// The task agent embeds the Stated-Claims snippet (§6.5) and tags load-bearing claims KNOWN|GUESSED.
// After the Execute phase, the Research phase iterates GUESSED entries through
// bin/gsd-t-research-gate.cjs: external → write §7 marker (status=uncited) → research agent
// (model:"fable") → cite → flip marker (status=cited). Internal → grep/Read; grep-empty →
// escalate to external (§5.1). Idempotent per §4.1 (exact normalized claim-key match only).
//
// args: { task, projectDir?, model? }

export const meta = {
  name: "gsd-t-quick",
  description: "Fast single-task execution with brief, preflight, Stated-Claims research, and verify-gate",
  phases: [
    { title: "Preflight", detail: "preflight + brief" },
    { title: "Execute",   detail: "single-agent task" },
    { title: "Research",  detail: "classify GUESSED claims + cite external (M89 §6.5/§1/§2/§7)" },
    { title: "Verify",    detail: "verify-gate" },
  ],
};

// M81: runtime-native helpers. The Anthropic Workflow sandbox provides ONLY the
// globals agent/parallel/pipeline/log/phase/budget/args — NO require/fs/path/
// child_process/process. The old `require("./_lib.js")` threw ReferenceError on first
// eval, so EVERY workflow except scan silently crashed and never ran (TD-113, confirmed
// by the NiceNote session 2026-06-05). These inline helpers delegate the CLI calls to an
// agent() that runs them via Bash (preferring project-local bin/<tool>.cjs, falling back
// to the global `gsd-t` PATH binary), parsing the JSON envelope — same brains, sandbox-safe
// invocation. The args global also arrives as a JSON STRING in this runtime, so parse it.
const _args = (typeof args === "string") ? (() => { try { return JSON.parse(args); } catch { return {}; } })() : (args || {});

const _CLI_ENVELOPE_SCHEMA = {
  type: "object", required: ["ok", "exitCode"], additionalProperties: true,
  properties: {
    ok: { type: "boolean" }, exitCode: { type: "integer" },
    envelope: {}, stdout: { type: "string" }, stderr: { type: "string" }, via: { type: "string" },
  },
};
// Run a `gsd-t <subcmd>` CLI (or project-local bin/<localBin>) via an agent's Bash and
// return { ok, exitCode, envelope, stderr, via }. parseJson=true parses stdout as the envelope.
async function runCli(projectDir, subcmd, argv, localBin, label, parseJson = true, phaseName) {
  const argStr = (argv || []).map((a) => `'${String(a).replace(/'/g, "'\\''")}'`).join(" ");
  const prompt = [
    `Run a GSD-T CLI command for the project at \`${projectDir}\` and report the result. Steps:`,
    `1. If \`${projectDir}/bin/${localBin}\` exists, run: \`node ${projectDir}/bin/${localBin} ${argStr}\` (set via="local").`,
    `   Otherwise run: \`gsd-t ${subcmd} ${argStr}\` (set via="global").`,
    `   Run it with cwd \`${projectDir}\` (use \`cd ${projectDir} && …\` or \`-C\`/\`--cwd\` as appropriate).`,
    `2. Capture the exit code (ok = exitCode 0) and stdout/stderr.`,
    parseJson
      ? `3. Parse stdout as JSON into \`envelope\` (null if not JSON). Return JSON per the schema.`
      : `3. Put stdout (trimmed, ≤4000 chars) in \`stdout\`. Return JSON per the schema.`,
    `Do NOT do any other work. ONLY run this one command and report.`,
  ].join("\n");
  const opts = { label, schema: _CLI_ENVELOPE_SCHEMA, model: "haiku" };
  if (phaseName) opts.phase = phaseName; // opts.phase MUST be a string, never the phase() fn
  const r = await agent(prompt, opts)
    .catch((e) => ({ ok: false, exitCode: -1, envelope: null, stderr: String(e && e.message), via: "error" }));
  return r || { ok: false, exitCode: -1, envelope: null, via: "error" };
}
async function runPreflight(projectDir, label = "preflight", phaseName) {
  return runCli(projectDir, "preflight", ["--json"], "cli-preflight.cjs", label, true, phaseName);
}
async function runVerifyGate(projectDir, label = "verify-gate", phaseName) {
  return runCli(projectDir, "verify-gate", ["--json"], "gsd-t-verify-gate.cjs", label, true, phaseName);
}
// Brief generation: writes .gsd-t/briefs/<id>.json and returns its path. The id must be
// caller-supplied (no Date.now/Math.random in the sandbox) — pass a stable id per spawn.
async function generateBrief(projectDir, { kind = "execute", milestone, domain, id, label = "brief", phaseName } = {}) {
  const argv = ["--kind", kind, "--spawn-id", id, "--out", `${projectDir}/.gsd-t/briefs/${id}.json`];
  if (milestone) argv.push("--milestone", milestone);
  if (domain) argv.push("--domain", domain);
  const r = await runCli(projectDir, "brief", argv, "gsd-t-context-brief.cjs", label, false, phaseName);
  return { ok: r.ok, briefPath: `${projectDir}/.gsd-t/briefs/${id}.json`, via: r.via };
}

const projectDir = _args.projectDir || ".";
const task = _args.task || null;
const model = _args.model || "sonnet";

const QUICK_SCHEMA = {
  type: "object",
  required: ["status", "filesEdited"],
  properties: {
    status:      { type: "string", enum: ["complete", "partial", "blocked", "failed"] },
    filesEdited: { type: "array", items: { type: "string" } },
    summary:     { type: "string" },
    // M89 §6.5 — Stated Claims: raw [GUESSED:*] lines emitted by the task agent
    statedClaims: { type: "array", items: { type: "string" } },
    // Primary artifact path for §7 marker writes (optional)
    artifactPath: { type: "string" },
  },
};

// M89 §7 — normalize claim-key (§4.1 exact-match key)
function normalizeClaimKey(claim) {
  return claim.toLowerCase().replace(/\s+/g, " ").trim().replace(/^[^\w]+|[^\w]+$/g, "");
}
function uncitedMarker(key) { return `<!-- auto-research-claim: class=external key=${key} status=uncited -->`; }
function citedMarker(key)   { return `<!-- auto-research-claim: class=external key=${key} status=cited -->`; }

// M89 §1 — classify via D1 classifier (bin/gsd-t-research-gate.cjs)
async function classifyClaim(projectDir, claimText, phaseName) {
  return runCli(projectDir, "research-gate", ["classify", claimText, "--json"], "gsd-t-research-gate.cjs", "classify-claim", true, phaseName);
}

// M89 §4.1 — exact key match idempotency check
function isAlreadyCited(artifactText, claimKey) {
  return artifactText.includes(`auto-research-claim: class=external key=${claimKey} status=cited`);
}

// M89 §5.1 — grep repo for internal claim resolution
async function grepForClaim(projectDir, claimText, phaseName) {
  const escaped = claimText.replace(/'/g, "'\\''").slice(0, 200);
  const prompt = [
    `Search the project at \`${projectDir}\` for this claim: "${escaped}"`,
    `Run: \`grep -r --include="*.js" --include="*.ts" --include="*.md" --include="*.cjs" -l "${escaped.slice(0, 60)}" "${projectDir}" 2>/dev/null | head -5\``,
    `Return JSON: { "found": <boolean>, "matches": ["<file>", ...] } — found=true if grep returned any lines.`,
    `Do ONLY this grep. No other work.`,
  ].join("\n");
  const schema = { type: "object", required: ["found"], additionalProperties: true, properties: { found: { type: "boolean" }, matches: { type: "array", items: { type: "string" } } } };
  const r = await agent(prompt, { label: "grep-internal-claim", model: "haiku", schema, phase: phaseName })
    .catch(() => ({ found: false, matches: [] }));
  return r || { found: false, matches: [] };
}

// M89 §2 — research result schema
const RESEARCH_RESULT_SCHEMA = {
  type: "object", required: ["ok", "gapKey"], additionalProperties: true,
  properties: { ok: { type: "boolean" }, gapKey: { type: "string" }, citedBlock: { type: "string" }, sourceUrls: { type: "array", items: { type: "string" } }, fetchDates: { type: "array", items: { type: "string" } }, reason: { type: "string" } },
};

if (!task) {
  log("quick: args.task required");
  return { status: "failed", reason: "no-task" };
}

phase("Preflight");
const pre = await runPreflight(projectDir);
if (!pre.ok) return { status: "failed", reason: "preflight-failed", preflight: pre.envelope };
const brief = await generateBrief(projectDir, { kind: "execute", id: "quick-brief" });

phase("Execute");
const result = await agent(
  [
    `Quick task: ${task}`,
    `**Brief:** ${brief.briefPath || "(no brief)"}`,
    ``,
    `Constraints from CLAUDE.md:`,
    `- SIMPLICITY ABOVE ALL — minimal change`,
    `- Check downstream effects before changing existing code`,
    `- Run affected tests before reporting done`,
    `- Update relevant docs in the same commit`,
    ``,
    `Commit with prefix "m61(quick)". Return JSON per the schema.`,
    ``,
    `**M89 STATED CLAIMS — REQUIRED (auto-research-contract §6.5):**`,
    `Read \`${projectDir}/templates/prompts/stated-claims-snippet.md\` for the DETECT protocol.`,
    `Before returning, emit a \`## Stated Claims\` section tagging every load-bearing claim`,
    `[KNOWN] or [GUESSED:assumed|unknown|stale]. In your StructuredOutput JSON, include a`,
    `"statedClaims" array: one entry per [GUESSED:*] line (full bullet text). Include`,
    `"artifactPath" if you wrote a primary output file (for §7 marker writes).`,
  ].join("\n"),
  { label: "quick", phase: "Execute", schema: QUICK_SCHEMA, model }
).catch((e) => ({ status: "failed", filesEdited: [], summary: `agent error: ${e && e.message}` }));

if (result.status === "failed" || result.status === "blocked") {
  return { status: result.status, result };
}

// ── M89 Research Phase — Stated-Claims→classify→cite (§6.5/§1/§2/§3/§4/§7) ──
phase("Research");
const guessedClaims = [];
if (Array.isArray(result.statedClaims)) {
  for (const claimLine of result.statedClaims) {
    const m = claimLine.match(/^\[GUESSED:[^\]]+\]\s*(.+)$/);
    if (m) guessedClaims.push({ claimText: m[1].trim(), artifactPath: result.artifactPath || null });
  }
}

if (guessedClaims.length === 0) {
  log("Research: no GUESSED claims — skipping");
} else {
  log(`Research: ${guessedClaims.length} GUESSED claim(s) to classify`);
  const artifactCache = {};
  async function readArtifact(p) {
    if (!p) return "";
    if (artifactCache[p] !== undefined) return artifactCache[p];
    const r = await agent(`Read \`${p}\` and return JSON: { "text": "<file content>" }. If missing: { "text": "" }.`,
      { label: "read-artifact", model: "haiku", schema: { type: "object", required: ["text"], properties: { text: { type: "string" } }, additionalProperties: false }, phase: "Research" })
      .catch(() => ({ text: "" }));
    const t = (r && r.text) || "";
    artifactCache[p] = t;
    return t;
  }

  for (const { claimText, artifactPath } of guessedClaims) {
    const claimKey = normalizeClaimKey(claimText);

    // §4.1 idempotency
    const at = await readArtifact(artifactPath);
    if (isAlreadyCited(at, claimKey)) {
      log(`Research: skip "${claimKey.slice(0, 50)}" — already cited`);
      continue;
    }

    const cls = await classifyClaim(projectDir, claimText, "Research");
    const envelope = cls.envelope;
    if (!envelope || !envelope.ok) {
      log(`Research: classify error — ${cls.stderr || JSON.stringify(envelope)}`);
      continue;
    }

    if (envelope.class === "external") {
      log(`Research: external → marker + research(fable) for "${claimKey.slice(0, 50)}"`);
      // §7 write uncited marker
      if (artifactPath) {
        const m = uncitedMarker(claimKey);
        await agent(
          `Append line \`${m}\` to \`${artifactPath}\` if not already present. Use Bash: \`grep -qF '${m.replace(/'/g, "'\\''")}' '${artifactPath}' || echo '${m.replace(/'/g, "'\\''")}' >> '${artifactPath}'\`. Return JSON: { "done": true }.`,
          { label: "write-uncited-marker", model: "haiku", schema: { type: "object", required: ["done"], properties: { done: { type: "boolean" } }, additionalProperties: true }, phase: "Research" }
        ).catch(() => {});
        delete artifactCache[artifactPath];
      }
      // §2 research agent — bare literal model: "fable"
      const rr = await agent(
        [
          `Read \`${projectDir}/templates/prompts/research-subagent.md\` for the research protocol.`,
          `Verify this external guessed claim: "${claimText}"`,
          `Gap-key: "${claimKey}"`,
          `Emit ## Verified Facts (auto-research) block with source URL + fetch date. Return StructuredOutput JSON.`,
        ].join("\n"),
        { label: "research", model: "fable", schema: RESEARCH_RESULT_SCHEMA, phase: "Research" }
      ).catch((e) => ({ ok: false, gapKey: claimKey, reason: String(e && e.message) }));

      if (rr && rr.ok && rr.citedBlock && artifactPath) {
        // §7 flip to cited + write cited block
        const um = uncitedMarker(claimKey);
        const cm = citedMarker(claimKey);
        await agent(
          `Edit \`${artifactPath}\`: replace the line \`${um}\` with \`${cm}\`, then append the following block if not already present:\n\`\`\`\n${rr.citedBlock}\n\`\`\`\nUse Read then Edit/Write tools. Return JSON: { "done": true, "action": "cited" }.`,
          { label: "flip-marker-cite", model: "haiku", schema: { type: "object", required: ["done"], properties: { done: { type: "boolean" }, action: { type: "string" } }, additionalProperties: true }, phase: "Research" }
        ).catch(() => {});
        log(`Research: cited "${claimKey.slice(0, 50)}"`);
      } else {
        log(`Research: research failed for "${claimKey.slice(0, 50)}" — marker stays uncited`);
      }

    } else {
      // internal → grep (A3 routing decision)
      log(`Research: internal → grep for "${claimText.slice(0, 50)}"`);
      const gr = await grepForClaim(projectDir, claimText, "Research");
      if (gr.found) {
        log(`Research: internal resolved by grep — no research needed`);
      } else {
        // §5.1 escalation: grep-empty → escalate to external
        log(`Research: grep empty — escalating to external (§5.1): "${claimText.slice(0, 50)}"`);
        if (artifactPath) {
          const m = uncitedMarker(claimKey);
          await agent(
            `Append line \`${m}\` to \`${artifactPath}\` if not already present. Use Bash: \`grep -qF '${m.replace(/'/g, "'\\''")}' '${artifactPath}' || echo '${m.replace(/'/g, "'\\''")}' >> '${artifactPath}'\`. Return JSON: { "done": true }.`,
            { label: "write-uncited-marker", model: "haiku", schema: { type: "object", required: ["done"], properties: { done: { type: "boolean" } }, additionalProperties: true }, phase: "Research" }
          ).catch(() => {});
          delete artifactCache[artifactPath];
        }
        const er = await agent(
          [
            `Read \`${projectDir}/templates/prompts/research-subagent.md\`.`,
            `Escalated (§5.1 ambiguous claim, grep found nothing): "${claimText}"`,
            `Gap-key: "${claimKey}"`,
            `Emit ## Verified Facts (auto-research) block. Return StructuredOutput JSON.`,
          ].join("\n"),
          { label: "research", model: "fable", schema: RESEARCH_RESULT_SCHEMA, phase: "Research" }
        ).catch((e) => ({ ok: false, gapKey: claimKey, reason: String(e && e.message) }));

        if (er && er.ok && er.citedBlock && artifactPath) {
          const um = uncitedMarker(claimKey);
          const cm = citedMarker(claimKey);
          await agent(
            `Edit \`${artifactPath}\`: replace \`${um}\` with \`${cm}\`, append: \n${er.citedBlock}\nReturn JSON: { "done": true }.`,
            { label: "flip-marker-cite", model: "haiku", schema: { type: "object", required: ["done"], properties: { done: { type: "boolean" }, action: { type: "string" } }, additionalProperties: true }, phase: "Research" }
          ).catch(() => {});
          log(`Research: escalated claim cited "${claimKey.slice(0, 50)}"`);
        } else {
          log(`Research: escalation failed for "${claimKey.slice(0, 50)}"`);
        }
      }
    }
  }
}

phase("Verify");
const vg = await runVerifyGate(projectDir);
return {
  status: vg.ok ? "complete" : "verify-failed",
  result,
  verifyGate: vg.envelope,
};
