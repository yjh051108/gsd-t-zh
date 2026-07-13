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
// M90 §2 D4-T4: Architectural-trigger wiring (protocol-class path, R-ARCH-2 "everywhere" feed).
// After the Research phase, compute the extend-existing-code signal from result.filesEdited:
// any file that already existed on disk → extend-class → fire the arch trigger (R-ARCH-2).
// NAMED PRODUCER: signal comes from result.filesEdited + on-disk existence check, never seeded.
// Contract: unproven-assumption-doctrine-contract.md §2 (R-ARCH-2, protocol-class path).
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
// Broken-Graph-Halts: route a failing graph envelope's reason through the ONE shared
// classifier (sandbox bans require → call it via Bash). Returns "ABSENT" | "BROKEN".
// [RULE] one-availability-classifier [RULE] unknown-reason-fails-closed-to-broken
async function classifyGraphFailure(projectDir, reason, detail, phaseName) {
  const r = await runCli(
    projectDir, "graph-availability",
    ["classify", String(reason || ""), String(detail || "")],
    "gsd-t-graph-availability.cjs", "graph-classify", true, phaseName
  ).catch(() => null);
  const env = r && r.envelope;
  if (env && (env.state === "ABSENT" || env.state === "BROKEN")) return env.state;
  return "BROKEN"; // fail-closed if the classifier itself is unreachable
}
// [RULE] absent-graph-auto-builds-once — build the index once via the existing
// `gsd-t graph index` path (local bin: gsd-t-graph-index.cjs build --repo <dir>).
async function buildGraphIndex(projectDir, phaseName) {
  const r = await runCli(
    projectDir, "graph index", ["build", "--repo", projectDir],
    "gsd-t-graph-index.cjs", "graph-index", false, phaseName
  ).catch(() => null);
  return !!(r && r.ok);
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

// M99 D2: persist a kind:'wiring' ledger line. M81 sandbox: all I/O through agent() Bash.
// Uses the `gsd-t graph wiring-log --auto` CLI shim (avoids embedding require() in strings).
// [RULE] wiring-mode-three-states / [RULE] consumer-label-from-context-not-setenv
async function persistWiringMode(phaseName) {
  const consumer = "quick";
  await agent(
    [
      `Persist one graph-wiring-mode ledger line for the quick workflow.`,
      `Run: \`gsd-t graph wiring-log --consumer ${consumer} --auto --project '${projectDir}'\``,
      `(--auto detects WIRED if the graph store exists, else fallback-announced)`,
      `If the command is not found, exit 0 (ledger write is optional).`,
      `Return ONLY: {"ok": true} or {"ok": false, "reason": "<short reason>"}.`,
    ].join("\n"),
    { label: "quick:wiring-ledger", phase: phaseName, model: "haiku", schema: { type: "object", required: ["ok"], properties: { ok: { type: "boolean" }, reason: { type: "string" } } } }
  ).catch(() => null);
}

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

// M89 §7 — normalize claim-key (§4.1 exact-match key). Cycle-2 finding #1: collapse
// EVERY non-word run to a space so the key is marker-syntax-safe; byte-identical across
// all 4 workflows (m89-normalize-claim-key-parity).
function normalizeClaimKey(claim) {
  return claim.toLowerCase().replace(/[^\w]+/g, " ").trim();
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
  const r = await agent(prompt, { label: "grep-internal-claim", model: "haiku", schema, phase: phaseName })
    .catch(() => ({ found: false, matches: [] }));
  return r || { found: false, matches: [] };
}

// M89 §1.1 — AMBIGUOUS → LLM JUDGE (bare model:"fable"). internal/external/uncertain;
// uncertain → research (never guess-internal). On error → "uncertain" (fail toward research).
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

// M94-D11 §READER: Query blast-radius / who-imports for structural impact before editing.
// Returns { line, halt, haltMessage }:
//   BROKEN graph → { halt:true, haltMessage } (HALT the workflow — never grep-fallback)
//   ABSENT graph → auto-build once, re-query; still absent → BROKEN → halt
// [RULE] quick-writer-pattern [RULE] broken-graph-halts-never-greps
async function queryGraphForQuick(projectDir, task, phaseName, _rebuilt) {
  // Extract a plausible target hint from the task description (first word-token that
  // looks like a file or function name). Heuristic — the agent uses the full slice.
  const words = (task || "").split(/\s+/).filter(Boolean);
  const targetHint = words.find((w) => w.includes("/") || w.includes(".") || w.includes("#")) || words[0] || "";
  if (!targetHint || targetHint.length < 2) return { line: null, halt: false };

  const r = await runCli(
    projectDir,
    "graph",
    ["blast-radius", targetHint],
    "gsd-t-graph-query-cli.cjs",
    "graph-blast-radius",
    true,
    phaseName
  ).catch(() => ({ ok: false, exitCode: -1, envelope: null }));

  const env = r && r.envelope;
  if (!env) return { line: null, halt: false };
  if (!env.ok) {
    const state = await classifyGraphFailure(projectDir, env.reason, env.detail, phaseName);
    if (state === "ABSENT" && !_rebuilt) {
      log(`M94-D11 READER: graph ABSENT — building index once, then re-querying.`);
      await buildGraphIndex(projectDir, phaseName);
      return queryGraphForQuick(projectDir, task, phaseName, true);
    }
    // BROKEN (or still-absent after one build) → HALT. NO grep fallback.
    const haltMessage = `graph BROKEN (reason=${env.reason || "?"}) — quick HALTED. Fix it: run gsd-t graph status. No grep fallback.`;
    log(`M94-D11 READER: ${haltMessage}`);
    return { line: null, halt: true, haltMessage };
  }
  if (Array.isArray(env.results)) {
    return { line: `## Graph structural slice (blast-radius for "${targetHint}"):\n${JSON.stringify(env.results.slice(0, 20), null, 2)}`, halt: false };
  }
  return { line: null, halt: false };
}

// M94-D11 §WRITER: Trigger a freshness pass over the touched set after edits.
// who-imports triggers freshness_check_on_query inline (D4 surface) — re-indexes any
// content-hash-dirty file before answering. Best-effort (non-blocking).
// [RULE] quick-writer-pattern
async function reindexTouchedFilesQuick(projectDir, filesEdited, phaseName) {
  if (!Array.isArray(filesEdited) || filesEdited.length === 0) return;
  for (const f of filesEdited.slice(0, 10)) {
    await runCli(
      projectDir,
      "graph",
      ["who-imports", f],
      "gsd-t-graph-query-cli.cjs",
      `graph-reindex-touched:${f.slice(-30)}`,
      true,
      phaseName
    ).catch(() => {});
  }
  log(`M94-D11 WRITER: re-indexed ${Math.min(filesEdited.length, 10)} touched file(s) after quick task`);
}

if (!task) {
  log("quick: args.task required");
  return { status: "failed", reason: "no-task" };
}

phase("Preflight");
const pre = await runPreflight(projectDir);
if (!pre.ok) return { status: "failed", reason: "preflight-failed", preflight: pre.envelope };
const brief = await generateBrief(projectDir, { kind: "execute", id: "quick-brief" });
// M99 D2: persist graphWiringMode for the quick consumer. [RULE] wiring-mode-three-states
await persistWiringMode("Preflight");

// M94-D11 §READER: query graph for structural impact before the Execute agent reasons
// [RULE] quick-writer-pattern [RULE] broken-graph-halts-never-greps
const _graphRead = await queryGraphForQuick(projectDir, task, "Preflight");
if (_graphRead && _graphRead.halt) {
  return { status: "blocked-needs-human", reason: "graph-broken", detail: _graphRead.haltMessage };
}
const _graphSliceLine = (_graphRead && _graphRead.line) || "";

phase("Execute");
const result = await agent(
  [
    `Quick task: ${task}`,
    `**Brief:** ${brief.briefPath || "(no brief)"}`,
    _graphSliceLine ? `\n**Graph structural slice (M94-D11 READER — blast-radius impact):**\n${_graphSliceLine}\nUse this slice for structural impact assessment — do NOT grep for import/dependency relationships.` : "",
    ``,
    `**CRUX-FIRST — START HERE (smallest change is the default, ceremony is opt-in):**`,
    `1. CRUX: state the crux of this ask in ONE line — the single thing that must become true.`,
    `2. WHAT EXISTS: grep/read what ALREADY exists for this before choosing any scope.`,
    `   Do not build outward until you know what is already here to edit.`,
    `3. SMALLEST CHANGE: propose the SMALLEST change that hits the crux — edit INWARD at the`,
    `   source (the one place the behavior is defined), not OUTWARD at the N consumers.`,
    `   The recommendation is "do it directly / one-file change," not a partition or plan.`,
    `4. ESCALATE ONLY IF NEEDED: reach for ceremony (plan→execute, partition, competition) ONLY`,
    `   when the crux genuinely needs cross-domain coordination or real uncertainty — and say WHY.`,
    ``,
    `Constraints from CLAUDE.md:`,
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

// M94-D11 §WRITER: re-index touched files after edits land (freshness trigger).
// [RULE] quick-writer-pattern
if (Array.isArray(result.filesEdited) && result.filesEdited.length > 0) {
  await reindexTouchedFilesQuick(projectDir, result.filesEdited, "Execute");
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

    // FAIL-CLOSED (Red Team HIGH): artifactPath is self-reported + optional. An EXTERNAL (or
    // ambiguous→escalated-external) guess MUST get its §7 uncited marker written SOMEWHERE so the
    // §7 ENFORCE gate has something to fail on. Use a DETERMINISTIC FALLBACK ARTIFACT when none.
    const claimSlug = claimKey.replace(/\s+/g, "-").slice(0, 80) || "claim";
    const externalArtifact = artifactPath || `${projectDir}/.gsd-t/research/quick-${claimSlug}.md`;

    // §4.1 idempotency — read the path actually WRITTEN (externalArtifact = real OR fallback)
    // so a re-run does not re-research a claim already cited in the fallback (Red Team MEDIUM).
    const at = await readArtifact(externalArtifact);
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

    // External-claim handler closure (reused by the ambiguous→judge path).
    const doExternal = async () => {
      log(`Research: external → marker + research(fable) for "${claimKey.slice(0, 50)}"${artifactPath ? "" : " (FALLBACK artifact — no reported path)"}`);
      // §7 write uncited marker to the real OR fallback artifact — ALWAYS (fail-CLOSED)
      {
        const m = uncitedMarker(claimKey);
        const sp = externalArtifact.replace(/'/g, "'\\''");
        await agent(
          `Ensure the parent dir exists, then append line \`${m}\` to \`${externalArtifact}\` if not already present. Use Bash: \`mkdir -p "$(dirname '${sp}')" && { grep -qF '${m.replace(/'/g, "'\\''")}' '${sp}' 2>/dev/null || echo '${m.replace(/'/g, "'\\''")}' >> '${sp}'; }\`. Return JSON: { "done": true }.`,
          { label: "write-uncited-marker", model: "haiku", schema: { type: "object", required: ["done"], properties: { done: { type: "boolean" } }, additionalProperties: true }, phase: "Research" }
        ).catch(() => {});
        delete artifactCache[externalArtifact];
      }
      // §2 research agent — bare literal model: "fable"
      const rr = await agent(
        [
          `Read \`${projectDir}/templates/prompts/research-subagent.md\` for the research protocol.`,
          `Verify this external guessed claim: "${claimText}"`,
          `Gap-key: "${claimKey}"`,
          `Emit ## Verified Facts (auto-research) block with source URL + fetch date. Append the trailer \`key: ${claimKey}\` on every fact line so the §7 gate matches by claim-key (Red Team MEDIUM #2). Return StructuredOutput JSON.`,
        ].join("\n"),
        { label: "research", model: "fable", schema: RESEARCH_RESULT_SCHEMA, phase: "Research" }
      ).catch((e) => ({ ok: false, gapKey: claimKey, reason: String(e && e.message) }));

      if (rr && rr.ok && rr.citedBlock) {
        // §7 flip to cited + write cited block (real OR fallback artifact)
        const um = uncitedMarker(claimKey);
        const cm = citedMarker(claimKey);
        await agent(
          `Ensure the parent dir of \`${externalArtifact}\` exists (Bash: \`mkdir -p "$(dirname '${externalArtifact.replace(/'/g, "'\\''")}')"\`). Then Edit \`${externalArtifact}\`: replace the line \`${um}\` with \`${cm}\`, then append the following block if not already present:\n\`\`\`\n${rr.citedBlock}\n\`\`\`\nUse Read then Edit/Write tools. Return JSON: { "done": true, "action": "cited" }.`,
          { label: "flip-marker-cite", model: "haiku", schema: { type: "object", required: ["done"], properties: { done: { type: "boolean" }, action: { type: "string" } }, additionalProperties: true }, phase: "Research" }
        ).catch(() => {});
        log(`Research: cited "${claimKey.slice(0, 50)}"`);
      } else {
        log(`Research: research failed for "${claimKey.slice(0, 50)}" — marker stays uncited`);
      }
    };

    // Internal-claim handler closure (grep A3; grep-empty → escalate §5.1).
    const doInternal = async () => {
      log(`Research: internal → grep for "${claimText.slice(0, 50)}"`);
      const gr = await grepForClaim(projectDir, claimText, "Research");
      if (gr.found) {
        log(`Research: internal resolved by grep — no research needed`);
      } else {
        // §5.1 escalation: grep-empty → escalate to external. Reuse doExternal() (same
        // marker→research→cite→flip path, incl. the key: trailer) instead of duplicating it.
        log(`Research: grep empty — escalating to external (§5.1): "${claimText.slice(0, 50)}"${artifactPath ? "" : " (FALLBACK artifact)"}`);
        await doExternal();
      }
    };

    // ── Dispatch by the 3-result classifier verdict (v1.3.0) ──────────────────
    if (envelope.class === "external") {
      await doExternal();
    } else if (envelope.class === "internal") {
      await doInternal();
    } else {
      // class:AMBIGUOUS — no string fact; LLM judge decides. internal→grep; external→research;
      // UNCERTAIN→research (uncertain = verify, never guess-internal).
      log(`Research: ambiguous → LLM judge for "${claimText.slice(0, 50)}" (when unsure, research)`);
      const verdict = await judgeAmbiguous(claimText, "Research");
      log(`Research: ambiguous "${claimKey.slice(0, 50)}" → judge: ${verdict}`);
      if (verdict === "internal") {
        await doInternal();
      } else {
        if (verdict === "uncertain") log(`Research: judge UNCERTAIN → "${claimKey.slice(0, 50)}" treated external → research (no silent guess)`);
        await doExternal();
      }
    }
  }
}

// ── M90 §2 D4-T4 — Arch-Trigger (protocol-class, extend-existing-code signal) ──
// Compute the extend-existing-code signal from result.filesEdited: files that already
// existed on disk before this quick run → extend-class → fire the arch trigger (R-ARCH-2).
// PRODUCER: signal is computed from real runtime inputs (filesEdited vs. on-disk check).
// Non-blocking: best-effort; don't halt quick on trigger failure.
let quickArchTriggerResult = null;
if (Array.isArray(result.filesEdited) && result.filesEdited.length > 0) {
  const filesToCheck = result.filesEdited.slice(0, 10);
  const checkResult = await agent(
    [
      `For the project at \`${projectDir}\`, check which of these files existed on disk BEFORE the current quick run.`,
      `Files to check: ${JSON.stringify(filesToCheck)}`,
      `For each file, run: \`test -f '${projectDir}/<file>' && echo EXISTS || echo ABSENT\` (substitute the actual path).`,
      `Return JSON: { "existingFiles": ["<file>", ...] } — list ONLY files that exist (exit 0).`,
      `Do NOT modify any files. Read-only existence check.`,
    ].join("\n"),
    {
      label: "arch-trigger-exist-check:quick",
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
  if (existingFiles.length > 0) {
    const triggerInput = JSON.stringify({
      type: "extend-existing-code",
      context: `quick-task edited existing files: ${existingFiles.slice(0, 3).join(", ")}`,
      basis: `Quick task edited existing file(s): ${existingFiles.slice(0, 3).join(", ")}`,
    });
    const triggerResult = await runCli(
      projectDir,
      "architectural-trigger",
      ["trigger", triggerInput],
      "gsd-t-architectural-trigger.cjs",
      "arch-trigger:quick",
      true,
      "Research"
    );
    const triggerEnv = triggerResult.envelope || {};
    const m92Directive = triggerEnv.lookDirective || triggerEnv.smallestDirective || triggerEnv.deferDirective || null;
    log(`M90 arch-trigger quick: fired=${triggerEnv.fired} reason=${triggerEnv.reason || "?"} provenByAdversaryOnly=${triggerEnv.provenByAdversaryOnly || false}` +
      (triggerEnv.mode ? ` — M92 response: ${triggerEnv.mode}${triggerEnv.mode === "look" ? " (grep/read existing before scoping)" : ""}` : ""));
    quickArchTriggerResult = {
      existingFiles,
      fired: triggerEnv.fired || false,
      reason: triggerEnv.reason || null,
      provenByAdversaryOnly: triggerEnv.provenByAdversaryOnly || false,
      stopDirective: triggerEnv.stopDirective || false,
      // M92 — cheaper-first response rung + its directive surfaced to the quick worker.
      mode: triggerEnv.mode || null,
      responseDirective: m92Directive,
    };
  }
}

phase("Verify");
const vg = await runVerifyGate(projectDir);
return {
  status: vg.ok ? "complete" : "verify-failed",
  result,
  verifyGate: vg.envelope,
  // M90 §2: arch-trigger result (surfaced for verify gate R-FAIL-2 check)
  archTriggerResult: quickArchTriggerResult,
};
