"use strict";

/**
 * gsd-t-parallel — M44 D2
 *
 * `gsd-t parallel` subcommand. Wraps the M40 orchestrator with task-level
 * (not just domain-level) parallelism and mode-aware gating math.
 *
 * Consumes:
 *   - D1 task graph           (bin/gsd-t-task-graph.cjs)
 *   - D4 depgraph validation  (bin/gsd-t-depgraph-validate.cjs)
 *   - D5 file-disjointness    (bin/gsd-t-file-disjointness.cjs)
 *   - mode-aware gating math  (inlined below — formerly bin/gsd-t-orchestrator-config.cjs)
 *
 * M61/M65 note: the economics estimator (gsd-t-economics.cjs), token-budget,
 * and the M40 orchestrator (bin/gsd-t-orchestrator.js) were retired — the
 * orchestration core moved to native Workflow scripts (templates/workflows/).
 * This module survives as the file-disjointness/ready-task planner consumed by
 * `_lib.proveFileDisjointness()`; its mode-aware gating helpers, which used to
 * live in gsd-t-orchestrator-config.cjs, are inlined below (M65) so this file
 * no longer depends on the retired orchestrator config.
 *
 * Contract: `.gsd-t/contracts/wave-join-contract.md` v1.1.0 (§Mode-Aware Gating Math).
 *
 * Hard rules (from constraints.md):
 *   - Zero external runtime deps (Node built-ins only)
 *   - Never throws pause/resume prompts under any condition
 *   - All three invariants (disjointness, auto-merge, economics) apply to both modes
 *   - `--dry-run` MUST be supported; prints plan without spawning
 *   - `--mode` auto-detect fallback: `GSD_T_UNATTENDED=1` → `unattended`, else `in-session`
 */

const fs = require("node:fs");
const path = require("node:path");

const { buildTaskGraph, getReadyTasks } = require(path.join(__dirname, "gsd-t-task-graph.cjs"));
const { validateDepGraph } = require(path.join(__dirname, "gsd-t-depgraph-validate.cjs"));
const { proveDisjointness } = require(path.join(__dirname, "gsd-t-file-disjointness.cjs"));
// M85: single source of truth for model ids — sourced from policy module, never re-hardcoded here
const { MODEL_IDS } = require(path.join(__dirname, "gsd-t-model-tier-policy.cjs"));
// M61 D3: gsd-t-economics retired. estimateTaskFootprint produced a per-task
// token+cost estimate the planner could consult for in-session-headroom
// math. Native budget primitives (Workflow `budget` + /usage) replace it.
// Stub to a zero-footprint estimate so the planner proceeds with default
// assumptions instead of crashing.
const estimateTaskFootprint = () => ({
  inputTokens: 0, outputTokens: 0, costUSD: 0, source: "m61-stub",
});

// ─── Mode-aware gating math (inlined from gsd-t-orchestrator-config.cjs, M65) ──
// Contract: `.gsd-t/contracts/wave-join-contract.md` v1.1.0 §Mode-Aware Gating Math.
const IN_SESSION_CW_CEILING_PCT = 85;
const UNATTENDED_PER_WORKER_CW_PCT = 60;
const DEFAULT_SUMMARY_SIZE_PCT = 4;

/**
 * [in-session] headroom gate. Returns `{ok, reducedCount}`.
 *   ok=true iff `ctxPct + workerCount * summarySize ≤ IN_SESSION_CW_CEILING_PCT`.
 *   Otherwise reduces N repeatedly; final floor is N=1. NEVER refuses.
 */
function computeInSessionHeadroom(opts) {
  const o = opts || {};
  const ctxPct = Number.isFinite(o.ctxPct) ? o.ctxPct : 0;
  const requested = Number.isFinite(o.workerCount) ? Math.max(0, Math.floor(o.workerCount)) : 0;
  const summarySize = Number.isFinite(o.summarySize) ? o.summarySize : DEFAULT_SUMMARY_SIZE_PCT;
  const ceiling = IN_SESSION_CW_CEILING_PCT;

  if (ctxPct + requested * summarySize <= ceiling) {
    return { ok: true, reducedCount: requested };
  }
  let n = requested - 1;
  while (n > 1) {
    if (ctxPct + n * summarySize <= ceiling) {
      return { ok: true, reducedCount: n };
    }
    n -= 1;
  }
  return { ok: true, reducedCount: 1 };
}

/**
 * [unattended] per-worker CW gate. Returns `{ok, split}`.
 *   ok=true, split=false if `estimatedCwPct ≤ threshold` (default 60).
 *   ok=false, split=true otherwise — caller MUST slice the task into multiple
 *   iters (this function only signals the split requirement).
 */
function computeUnattendedGate(opts) {
  const o = opts || {};
  const estimatedCwPct = Number.isFinite(o.estimatedCwPct) ? o.estimatedCwPct : 0;
  const threshold = Number.isFinite(o.threshold) ? o.threshold : UNATTENDED_PER_WORKER_CW_PCT;
  if (estimatedCwPct > threshold) {
    return { ok: false, split: true };
  }
  return { ok: true, split: false };
}

// token-budget is optional at require-time so unit tests can stub via dependency injection.
let _tokenBudget = null;
function loadTokenBudget() {
  if (_tokenBudget) return _tokenBudget;
  try {
    _tokenBudget = require(path.join(__dirname, "token-budget.cjs"));
  } catch {
    _tokenBudget = { getSessionStatus: () => ({ pct: 0 }) };
  }
  return _tokenBudget;
}

// ─── event stream writer ──────────────────────────────────────────────────

function appendEvent(projectDir, event) {
  try {
    const eventsDir = path.join(projectDir, ".gsd-t", "events");
    fs.mkdirSync(eventsDir, { recursive: true });
    const day = (event.ts || new Date().toISOString()).slice(0, 10);
    const file = path.join(eventsDir, `${day}.jsonl`);
    fs.appendFileSync(file, JSON.stringify(event) + "\n");
  } catch {
    // Best-effort; event-log failures must not break control flow.
  }
}

// ─── mode detection ───────────────────────────────────────────────────────

function detectMode(opts, env) {
  if (opts && typeof opts.mode === "string" && opts.mode) return opts.mode;
  const e = env || process.env;
  if (e.GSD_T_UNATTENDED === "1") return "unattended";
  return "in-session";
}

// ─── CLI arg parsing ──────────────────────────────────────────────────────

function parseArgv(argv) {
  const out = { help: false, dryRun: false, mode: null, milestone: null, domain: null, command: null, maxWorkers: null, stagger: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--mode") out.mode = argv[++i] || null;
    else if (a.startsWith("--mode=")) out.mode = a.slice("--mode=".length);
    else if (a === "--milestone") out.milestone = argv[++i] || null;
    else if (a.startsWith("--milestone=")) out.milestone = a.slice("--milestone=".length);
    else if (a === "--domain") out.domain = argv[++i] || null;
    else if (a.startsWith("--domain=")) out.domain = a.slice("--domain=".length);
    else if (a === "--command") out.command = argv[++i] || null;
    else if (a.startsWith("--command=")) out.command = a.slice("--command=".length);
    else if (a === "--max-workers") out.maxWorkers = parseInt(argv[++i], 10);
    else if (a.startsWith("--max-workers=")) out.maxWorkers = parseInt(a.slice("--max-workers=".length), 10);
    else if (a === "--stagger") out.stagger = parseInt(argv[++i], 10);
    else if (a.startsWith("--stagger=")) out.stagger = parseInt(a.slice("--stagger=".length), 10);
  }
  return out;
}

const HELP_TEXT = `Usage: gsd-t parallel [options]

Dispatch M44 task-level parallelism through the M40 orchestrator with
mode-aware gating math. Extends — does not replace — the orchestrator.

Options:
  --mode <in-session|unattended>   Explicit mode. Auto-detects from
                                   GSD_T_UNATTENDED=1 env when omitted;
                                   defaults to in-session otherwise.
  --milestone <Mxx>                Limit planning to a single milestone.
  --domain <name>                  Limit planning to a single domain.
  --dry-run                        Print the proposed worker plan table
                                   and exit without spawning any workers.
  --command <slug>                 When fan-out is safe (N≥2), spawn N
                                   detached headless children running the
                                   named GSD-T command, each with disjoint
                                   GSD_T_WORKER_TASK_IDS. When N<2, exits 0
                                   with a "sequential" banner so the caller
                                   falls through to the in-command flow.
                                   Omit to get plan-only output.
  --help, -h                       Show this message and exit 0.

Gates applied before any fan-out (in order):
  1. D4 depgraph validation — any task with unmet deps is vetoed.
  2. D5 file-disjointness prover — overlap → sequential fallback.
  3. D6 economics estimator — per-task CW% footprint.

Modes:
  in-session   Never throws pause/resume prompts. Before fan-out,
               computes ctxPct + N × summarySize ≤ 85. If not, reduces
               N until it fits; final floor is N=1 (sequential).
  unattended   Per-worker CW headroom is the binding gate. Tasks whose
               estimated CW% > 60 emit a task_split signal.

Contract: .gsd-t/contracts/wave-join-contract.md v1.1.0
`;

// ─── runParallel — the exported entrypoint ────────────────────────────────

/**
 * runParallel({projectDir, mode, milestone, domain, dryRun}) → plan object
 *
 * Applies D4 dep-graph + D5 disjointness + D6 economics gates, then the
 * mode-aware headroom/split gate, and returns the resolved worker plan.
 *
 * Does not spawn. The caller (M40 orchestrator) owns actual worker launch.
 */
function runParallel(opts) {
  const projectDir = (opts && opts.projectDir) || process.cwd();
  const mode = detectMode(opts, opts && opts.env);
  const milestone = (opts && opts.milestone) || null;
  const domain = (opts && opts.domain) || null;
  const dryRun = !!(opts && opts.dryRun);
  const summarySize = Number.isFinite(opts && opts.summarySize)
    ? opts.summarySize
    : DEFAULT_SUMMARY_SIZE_PCT;

  const graph = buildTaskGraph({ projectDir });
  let candidates = getReadyTasks(graph);

  // Optional filtering by milestone / domain.
  if (domain) candidates = candidates.filter((t) => t.domain === domain);
  if (milestone) {
    // Milestone id prefixes task ids in this codebase (M44-D2-T1 → M44).
    const prefix = String(milestone).toUpperCase();
    candidates = candidates.filter((t) => String(t.id).toUpperCase().startsWith(prefix + "-"));
  }

  // ── D4 depgraph gate ──
  const depResult = validateDepGraph({ graph: { ...graph, ready: candidates.map((t) => t.id) }, projectDir });
  const depReady = depResult.ready;
  const depVetoed = depResult.vetoed || [];
  for (const v of depVetoed) {
    appendEvent(projectDir, {
      type: "gate_veto",
      task_id: v.task && v.task.id,
      gate: "depgraph",
      reason: `unmet_deps:${(v.unmet_deps || []).join(",")}`,
      ts: new Date().toISOString(),
    });
  }

  // ── D5 disjointness gate ──
  const disj = proveDisjointness({ tasks: depReady, projectDir });
  const disjointTaskIds = new Set();
  for (const group of disj.parallel || []) {
    for (const t of group) disjointTaskIds.add(t.id);
  }
  // Sequential groups + unprovable are NOT candidates for parallel fan-out
  // but still allowed as single-worker (sequential) — surfaced as gate_veto
  // events so "why wasn't this parallelized?" is observable.
  const sequentialFallback = new Set();
  for (const group of disj.sequential || []) {
    for (const t of group) {
      sequentialFallback.add(t.id);
      appendEvent(projectDir, {
        type: "gate_veto",
        task_id: t.id,
        gate: "disjointness",
        reason: "write-target-overlap-or-unprovable",
        ts: new Date().toISOString(),
      });
    }
  }

  // ── D6 economics gate (per-task estimate) ──
  const perTask = new Map();
  for (const t of depReady) {
    let est;
    try {
      est = estimateTaskFootprint({ taskNode: t, mode, projectDir });
    } catch {
      est = { estimatedCwPct: 0, parallelOk: true, split: false, workerCount: 1, confidence: "low" };
    }
    perTask.set(t.id, est);
  }

  // ── Mode-aware gating math ──
  let finalParallelTasks = [];
  let reducedCount = null;
  let ctxPctObserved = null;
  if (mode === "unattended") {
    // Each parallel-candidate task gets an unattended gate check.
    for (const t of depReady) {
      const est = perTask.get(t.id);
      if (!disjointTaskIds.has(t.id)) continue; // already sequential
      const gate = computeUnattendedGate({ estimatedCwPct: est.estimatedCwPct, threshold: 60 });
      if (gate.split) {
        appendEvent(projectDir, {
          type: "task_split",
          task_id: t.id,
          estimatedCwPct: est.estimatedCwPct,
          ts: new Date().toISOString(),
        });
        // Actual slicing is the caller's responsibility — the task stays in
        // the parallel set; the orchestrator (or caller) treats it as
        // "needs split". Per D2-T2 acceptance: emitting the event and
        // returning the plan is sufficient.
      }
      finalParallelTasks.push(t);
    }
  } else {
    // in-session path
    const tb = loadTokenBudget();
    let status;
    try { status = tb.getSessionStatus(projectDir); } catch { status = { pct: 0 }; }
    const ctxPct = Number.isFinite(status && status.pct) ? status.pct : 0;
    ctxPctObserved = ctxPct;
    const parallelCandidates = depReady.filter((t) => disjointTaskIds.has(t.id));
    const requested = parallelCandidates.length;
    const headroom = computeInSessionHeadroom({ ctxPct, workerCount: requested, summarySize });
    reducedCount = headroom.reducedCount;
    if (reducedCount < requested) {
      appendEvent(projectDir, {
        type: "parallelism_reduced",
        original_count: requested,
        reduced_count: reducedCount,
        reason: "in_session_headroom",
        ts: new Date().toISOString(),
      });
    }
    finalParallelTasks = parallelCandidates.slice(0, reducedCount);
  }

  // Build the plan table rows (all ready tasks, labeled by decision).
  const plan = depReady.map((t) => {
    const est = perTask.get(t.id) || {};
    const disjointOk = disjointTaskIds.has(t.id);
    const isFinalParallel = finalParallelTasks.some((x) => x.id === t.id);
    let decision;
    if (isFinalParallel) {
      decision = mode === "unattended" && est.split ? "parallel-split" : "parallel";
    } else if (sequentialFallback.has(t.id)) {
      decision = "sequential";
    } else {
      decision = "sequential";
    }
    return {
      task_id: t.id,
      domain: t.domain,
      estimatedCwPct: Number.isFinite(est.estimatedCwPct) ? est.estimatedCwPct : null,
      disjoint: disjointOk,
      depsOk: true,
      decision,
    };
  });
  // Also show dep-vetoed tasks so the dry-run table is complete.
  for (const v of depVetoed) {
    if (!v.task) continue;
    plan.push({
      task_id: v.task.id,
      domain: v.task.domain,
      estimatedCwPct: null,
      disjoint: null,
      depsOk: false,
      decision: "veto-deps",
    });
  }

  return {
    mode,
    milestone,
    domain,
    dryRun,
    projectDir,
    plan,
    workerCount: finalParallelTasks.length || (plan.length ? 1 : 0),
    parallelTasks: finalParallelTasks.map((t) => t.id),
    reducedCount,
    ctxPct: ctxPctObserved,
    warnings: graph.warnings || [],
  };
}

// ─── runDispatch — the single instrument (M44 D9 Step 3) ──────────────────

/**
 * Round-robin partition of task ids into `workerCount` non-empty subsets.
 * Kept tiny + pure so unit tests can exercise it without spinning up spawns.
 */
function _partitionTaskIds(taskIds, workerCount) {
  const ids = Array.isArray(taskIds) ? taskIds.filter((x) => typeof x === "string" && x.length) : [];
  const n = Math.max(0, Math.min(Number(workerCount) || 0, ids.length));
  if (n === 0) return [];
  const buckets = Array.from({ length: n }, () => []);
  for (let i = 0; i < ids.length; i++) buckets[i % n].push(ids[i]);
  return buckets.filter((b) => b.length > 0);
}

/**
 * _runCacheWarmProbe — fire a single short `claude -p` before fan-out so the
 * Anthropic prompt cache (5-min TTL) is pre-populated with the files every
 * worker will read. When workers spawn within the warm window, their initial
 * Read(CLAUDE.md), Read(progress.md), Read(contracts/*.md) return cache-read
 * tokens (free for ITPM budget, lower rate-limit pressure).
 *
 * Returns `{ok, filesRead, error}`. Best-effort; failures do not block fan-out.
 *
 * The probe reads the existing files (skips missing ones silently) and asks
 * the child to print the literal string "warm" — cheap, deterministic, fast.
 * Cache key matches exactly when `model` equals the workers' model and the
 * workers use the same tool-call shape (Read on the same paths) within TTL.
 */
function _runCacheWarmProbe(opts) {
  const projectDir = (opts && opts.projectDir) || process.cwd();
  const model = opts && opts.model;
  const timeoutMs = Number.isFinite(opts && opts.timeoutMs) ? opts.timeoutMs : 60000;

  const candidates = [
    "CLAUDE.md",
    ".gsd-t/progress.md",
    ".gsd-t/contracts/headless-default-contract.md",
    ".gsd-t/contracts/wave-join-contract.md",
  ];
  const filesRead = candidates.filter((rel) => {
    try {
      return fs.statSync(path.join(projectDir, rel)).isFile();
    } catch {
      return false;
    }
  });
  if (filesRead.length === 0) return { ok: false, filesRead: [], error: "no_warm_files" };

  const { spawnSync } = require("node:child_process");
  const prompt =
    "Read the following files so they enter the prompt cache for subsequent workers, " +
    "then reply with the single word `warm` and nothing else:\n" +
    filesRead.map((f) => `- ${f}`).join("\n");

  // M85: pass model via --model flag ONLY (env var ANTHROPIC_MODEL is silently
  // ignored by the current claude CLI — measured probe 2026-06-09 r3: env form
  // ran opus-4-8 regardless of the env value). No env mutation here.
  const env = process.env;
  const cliArgs = ["-p", prompt, "--dangerously-skip-permissions"];
  if (model) cliArgs.push("--model", model);

  try {
    // GSD-T-LINT: skip stream-json (reason: cache-warm probe — single-word "warm" reply, no progress to stream)
    const r = spawnSync(
      "claude",
      cliArgs,
      {
        cwd: projectDir,
        env,
        encoding: "utf8",
        timeout: timeoutMs,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    if (r.error) return { ok: false, filesRead, error: r.error.message };
    if (r.status !== 0) return { ok: false, filesRead, error: `exit_${r.status}` };
    return { ok: true, filesRead };
  } catch (e) {
    return { ok: false, filesRead, error: (e && e.message) || "spawn_error" };
  }
}

/**
 * runDispatch — the single instrument every command delegates to.
 *
 * Probes the planner; if N≥2 with green gates, spawns N detached headless
 * children via `autoSpawnHeadless()` (one per task subset) and returns
 * `{decision:'fan_out', fanOutCount, workerResults, plan}`. If N<2, returns
 * `{decision:'sequential', …}` so the caller falls through to its legacy
 * single-worker path. If planning fails, returns `{decision:'sequential'}`
 * with a warning — purely additive, never throws.
 *
 * Design intent (per user directive 2026-04-23):
 *   "create 1 instrument that accomplishes this instead of implementing it
 *    in all the commands."
 *
 * Command files invoke this via one bash line; they do not re-implement the
 * probe-and-branch pattern. The unattended supervisor (v1.5.0 §15a) uses the
 * same planner + dep-injected spawn but owns its own heartbeat/watchdog — it
 * does not consume this function.
 *
 * Contract: wave-join-contract.md v1.1.0; headless-default-contract v2.0.0.
 */
function runDispatch(opts) {
  const projectDir = (opts && opts.projectDir) || process.cwd();
  const command = (opts && opts.command) || null;
  if (!command) {
    return {
      decision: "invalid",
      error: "missing_command",
      fanOutCount: 0,
      workerResults: [],
      plan: [],
      mode: detectMode(opts, opts && opts.env),
    };
  }

  let result;
  try {
    result = runParallel({
      projectDir,
      mode: (opts && opts.mode) || undefined,
      milestone: (opts && opts.milestone) || undefined,
      domain: (opts && opts.domain) || undefined,
      dryRun: true,
      env: opts && opts.env,
    });
  } catch (e) {
    appendEvent(projectDir, {
      type: "parallelism_reduced",
      source: "dispatch",
      original_count: null,
      reduced_count: 1,
      reason: `planner_error:${(e && e.message) || "unknown"}`,
      ts: new Date().toISOString(),
    });
    return {
      decision: "sequential",
      fanOutCount: 1,
      workerResults: [],
      plan: [],
      mode: detectMode(opts, opts && opts.env),
      error: `planner_error:${(e && e.message) || "unknown"}`,
    };
  }

  const plannerWorkerCount = Number(result.workerCount) || 0;
  const parallelTasks = Array.isArray(result.parallelTasks) ? result.parallelTasks : [];

  // Concurrency cap (v3.18.19) — caller may clamp the planner-selected worker
  // count via `opts.maxWorkers`. Motivated by 2026-04-23 incident: the Max
  // subscription concurrent-session throttle rate-limits `claude -p` bursts
  // regardless of model choice (since all spawns inherit the parent's Max
  // OAuth, not an API key — see feedback_anthropic_key_measurement_only). The
  // planner has no knowledge of this throttle; callers who know they're near
  // the ceiling need a direct cap.
  const cap = Number.isFinite(opts && opts.maxWorkers) && opts.maxWorkers > 0
    ? Math.floor(opts.maxWorkers)
    : 2;
  const workerCount = Math.min(plannerWorkerCount, cap);
  if (workerCount < plannerWorkerCount) {
    appendEvent(projectDir, {
      type: "parallelism_reduced",
      source: "dispatch_max_workers_cap",
      original_count: plannerWorkerCount,
      reduced_count: workerCount,
      reason: `max_workers_cap:${cap}`,
      ts: new Date().toISOString(),
    });
  }
  const subsets = workerCount >= 2 ? _partitionTaskIds(parallelTasks, workerCount) : [];

  if (subsets.length < 2) {
    return {
      decision: "sequential",
      fanOutCount: 1,
      workerResults: [],
      plan: result.plan || [],
      mode: result.mode,
      parallelTasks,
    };
  }

  // Resolve the spawner — tests inject a stub; production uses the real
  // `autoSpawnHeadless`. Required: `({command, args, projectDir, env}) => {id, pid, …}`.
  let spawnImpl = opts && opts.spawnHeadlessImpl;
  if (!spawnImpl) {
    try {
      spawnImpl = require(path.join(__dirname, "headless-auto-spawn.cjs")).autoSpawnHeadless;
    } catch (e) {
      return {
        decision: "sequential",
        fanOutCount: 1,
        workerResults: [],
        plan: result.plan || [],
        mode: result.mode,
        error: `spawn_load:${(e && e.message) || "unknown"}`,
        parallelTasks,
      };
    }
  }

  appendEvent(projectDir, {
    type: "fan_out",
    source: "dispatch",
    command,
    fan_out_count: subsets.length,
    task_ids: parallelTasks,
    mode: result.mode,
    ts: new Date().toISOString(),
  });

  // Worker model selection (v3.18.18) — mechanical fan-out defaults to Sonnet
  // so the orchestrator's Opus bucket isn't the bottleneck. Caller may
  // override via `opts.workerModel` ("opus" | "sonnet" | "haiku" | full ID).
  // A task can opt back to Opus by declaring "[opus]" in its tasks.md line;
  // the planner surfaces this via per-task metadata (future; today the per-
  // subset opt-in is an all-or-nothing knob passed by the caller).
  const DEFAULT_WORKER_MODEL = MODEL_IDS.sonnet;
  // M85: alias map sources from policy module — MODEL_IDS is the single authority.
  // No bare model-id literals here; changing a model id in the policy module alone
  // is sufficient (single-source thesis, AC b).
  const modelAlias = {
    opus:   MODEL_IDS.opus,
    fable:  MODEL_IDS.fable,
    sonnet: MODEL_IDS.sonnet,
    haiku:  MODEL_IDS.haiku,
  };
  const callerModel = opts && opts.workerModel;
  const workerModel = callerModel === false
    ? null // explicit opt-out: inherit parent's ANTHROPIC_MODEL
    : (modelAlias[callerModel] || callerModel || DEFAULT_WORKER_MODEL);

  // Stagger between spawns — 10s default empirically-validated against the
  // Max-subscription concurrent-session throttle (2026-04-23 M46 probe: two
  // 10s-staggered 2-parallel rounds of real work, both exit 0, no 429; prior
  // 3s default burst at >2 workers hit rate limits). Caller may override via
  // `opts.spawnStaggerMs` (0 = no delay, previous burst behavior).
  const staggerMs = Number.isFinite(opts && opts.spawnStaggerMs)
    ? Math.max(0, opts.spawnStaggerMs)
    : 10000;
  const busyWait = (ms) => {
    if (!ms) return;
    // Synchronous sleep that releases the CPU (Atomics.wait on a dummy
    // SharedArrayBuffer — pattern used in Node REPL/sync-sleep helpers).
    // Keeps runDispatch's sync return contract without pegging a core.
    // Total wall-clock added to startup: (subsets-1) * staggerMs.
    try {
      const sab = new SharedArrayBuffer(4);
      const view = new Int32Array(sab);
      Atomics.wait(view, 0, 0, ms);
    } catch (_) {
      // Atomics unavailable — fall back to a coarse spin.
      const until = Date.now() + ms;
      while (Date.now() < until) { /* spin */ }
    }
  };

  // Cache-warming probe (v3.18.19) — opt-in via GSD_T_CACHE_WARM=1 or
  // opts.cacheWarm. Anthropic's prompt cache has a 5-minute TTL keyed on the
  // exact system-prompt + tool-call prefix. One leader probe that reads the
  // same foundational files every worker will read (CLAUDE.md, progress.md,
  // top-level contracts) populates the cache so the first N seconds of every
  // subsequent worker hit cache-read tokens (free for ITPM budget, lower
  // rate-limit pressure). Probe runs synchronously so workers land inside
  // the warm window rather than racing it. Gated behind opt-in until
  // backlog #23 (mitmproxy instrumentation) measures the actual delta.
  const warmEnv = (opts && opts.env) || process.env;
  const cacheWarmEnabled =
    (opts && opts.cacheWarm === true) ||
    (!(opts && opts.cacheWarm === false) && warmEnv.GSD_T_CACHE_WARM === "1");
  if (cacheWarmEnabled) {
    const warmStart = Date.now();
    let warmResult = { ok: false, error: "not_run" };
    try {
      const probeImpl = (opts && opts.cacheWarmProbeImpl) || _runCacheWarmProbe;
      warmResult = probeImpl({
        projectDir,
        model: workerModel, // same model as workers so cache key matches
        timeoutMs: (opts && Number.isFinite(opts.cacheWarmTimeoutMs))
          ? opts.cacheWarmTimeoutMs
          : 60000,
      });
    } catch (e) {
      warmResult = { ok: false, error: (e && e.message) || "unknown" };
    }
    appendEvent(projectDir, {
      type: "cache_warm_probe",
      source: "dispatch",
      ok: !!warmResult.ok,
      duration_ms: Date.now() - warmStart,
      error: warmResult.error,
      files_read: warmResult.filesRead,
      ts: new Date().toISOString(),
    });
  }

  const workerResults = [];
  for (let i = 0; i < subsets.length; i++) {
    if (i > 0) busyWait(staggerMs);
    const subset = subsets[i];
    const workerEnv = {
      GSD_T_WORKER_TASK_IDS: subset.join(","),
      GSD_T_WORKER_INDEX: String(i),
      GSD_T_WORKER_TOTAL: String(subsets.length),
    };
    let spawnResult = null;
    let spawnError = null;
    try {
      spawnResult = spawnImpl({
        command,
        args: [],
        projectDir,
        env: workerEnv,
        spawnType: "primary",
        workerModel,
      });
    } catch (e) {
      spawnError = (e && e.message) || "unknown";
    }
    appendEvent(projectDir, {
      type: "task_start",
      source: "dispatch",
      worker_index: i,
      worker_total: subsets.length,
      task_ids: subset,
      command,
      spawn_id: spawnResult && spawnResult.id,
      pid: spawnResult && spawnResult.pid,
      error: spawnError,
      ts: new Date().toISOString(),
    });
    workerResults.push({
      idx: i,
      taskIds: subset,
      spawnId: spawnResult && spawnResult.id,
      pid: spawnResult && spawnResult.pid,
      logPath: spawnResult && spawnResult.logPath,
      error: spawnError,
    });
  }

  return {
    decision: "fan_out",
    fanOutCount: subsets.length,
    workerResults,
    plan: result.plan || [],
    mode: result.mode,
    parallelTasks,
  };
}

// ─── CLI entry ────────────────────────────────────────────────────────────

// ─── dry-run table formatter ──────────────────────────────────────────────

const PLAN_HEADER = ["task_id", "domain", "estimated CW%", "disjoint?", "deps ok?", "decision"];

function formatPlanTable(plan) {
  const rows = [PLAN_HEADER.slice()];
  for (const r of plan) {
    rows.push([
      String(r.task_id),
      String(r.domain || "-"),
      r.estimatedCwPct == null ? "-" : String(Math.round(r.estimatedCwPct)),
      r.disjoint == null ? "-" : (r.disjoint ? "yes" : "no"),
      r.depsOk ? "yes" : "no",
      String(r.decision),
    ]);
  }
  const widths = PLAN_HEADER.map((_, col) =>
    rows.reduce((w, row) => Math.max(w, String(row[col]).length), 0),
  );
  const sep = widths.map((w) => "-".repeat(w)).join("  ");
  const lines = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i].map((cell, col) => String(cell).padEnd(widths[col])).join("  ");
    lines.push(row);
    if (i === 0) lines.push(sep);
  }
  return lines.join("\n") + "\n";
}

function runCli(argv, env) {
  const args = parseArgv(argv || []);
  if (args.help) {
    process.stdout.write(HELP_TEXT);
    return 0;
  }
  const mode = args.mode || detectMode({}, env);

  // --dry-run: plan-only output, same as M44 D2 baseline.
  if (args.dryRun) {
    const result = runParallel({
      projectDir: process.cwd(),
      mode,
      milestone: args.milestone,
      domain: args.domain,
      dryRun: true,
      env,
    });
    process.stdout.write(formatPlanTable(result.plan));
    process.stdout.write(
      `\nTotal workers: ${result.workerCount}   Mode: ${result.mode}` +
        (result.reducedCount != null && result.reducedCount !== result.parallelTasks.length + (result.parallelTasks.length === 0 ? 0 : 0)
          ? `   reducedCount: ${result.reducedCount}`
          : "") +
        "\n",
    );
    return 0;
  }

  // --command: live dispatch. The single instrument that command files
  // delegate to instead of re-implementing probe-and-branch logic.
  if (args.command) {
    const dispatchOpts = {
      projectDir: process.cwd(),
      mode,
      milestone: args.milestone,
      domain: args.domain,
      command: args.command,
      env,
    };
    if (Number.isFinite(args.maxWorkers) && args.maxWorkers > 0) {
      dispatchOpts.maxWorkers = args.maxWorkers;
    }
    if (Number.isFinite(args.stagger) && args.stagger >= 0) {
      dispatchOpts.spawnStaggerMs = args.stagger * 1000;
    }
    const dispatch = runDispatch(dispatchOpts);
    if (dispatch.decision === "fan_out") {
      process.stdout.write(
        `gsd-t parallel — fan_out command=${args.command} mode=${dispatch.mode} workers=${dispatch.fanOutCount}\n`,
      );
      for (const w of dispatch.workerResults) {
        process.stdout.write(
          `  worker[${w.idx}] tasks=${w.taskIds.join(",")} spawn=${w.spawnId || "-"} pid=${w.pid || "-"}${w.error ? " error=" + w.error : ""}\n`,
        );
      }
      return 0;
    }
    if (dispatch.decision === "sequential") {
      process.stdout.write(
        `gsd-t parallel — sequential command=${args.command} mode=${dispatch.mode} (N<2, caller falls through)${dispatch.error ? " error=" + dispatch.error : ""}\n`,
      );
      return 2; // non-zero so shell `&&` short-circuits; caller branches on $?
    }
    process.stdout.write(
      `gsd-t parallel — ${dispatch.decision} command=${args.command} mode=${dispatch.mode}\n`,
    );
    return 3;
  }

  // Legacy path: no --dry-run, no --command. Print plan summary only.
  const result = runParallel({
    projectDir: process.cwd(),
    mode,
    milestone: args.milestone,
    domain: args.domain,
    dryRun: false,
    env,
  });
  process.stdout.write(
    `gsd-t parallel — mode=${result.mode} workers=${result.workerCount}\n`,
  );
  return 0;
}

module.exports = {
  runParallel,
  runDispatch,
  runCli,
  formatPlanTable,
  PLAN_HEADER,
  // Exposed for tests:
  _parseArgv: parseArgv,
  _detectMode: detectMode,
  _appendEvent: appendEvent,
  _partitionTaskIds,
  _runCacheWarmProbe,
  _HELP_TEXT: HELP_TEXT,
};

if (require.main === module) {
  const code = runCli(process.argv.slice(2), process.env);
  process.exit(code);
}
