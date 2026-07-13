"use strict";

/**
 * gsd-t-file-disjointness — M44 D5 (T2: core implementation)
 *
 * Pre-spawn file-disjointness prover. Consumes the task-graph DAG from D1 and
 * partitions a candidate parallel set into:
 *   - parallel   — groups confirmed pairwise-disjoint (safe to spawn together)
 *   - sequential — groups sharing ≥1 write target (must serialize)
 *   - unprovable — tasks with no touch-list source (routed sequential; safe-default)
 *
 * Contract: .gsd-t/contracts/file-disjointness-contract.md (v1.0.0)
 *
 * Hard rules (from constraints.md):
 *   - Unprovable is ALWAYS safe — never assume disjointness
 *   - Zero external runtime deps (Node built-ins + git subprocess only)
 *   - Never throws (returns result object)
 *   - Read-only on all domain files; only writes to .gsd-t/events/YYYY-MM-DD.jsonl
 *   - D5 checks WRITE targets only; reads never conflict
 *   - Mode-agnostic
 *   - Git-history heuristic bounded to 100 commits
 *
 * M94-D11 additions (graph-aware disjointness — SAFETY-CRITICAL):
 *   The graph-aware layer consults `bin/gsd-t-graph-query-cli.cjs` (blast-radius /
 *   who-imports) to detect TRANSITIVE dependency overlap between two domain
 *   touch-lists. Two domains whose touched files share a transitive dependency (one
 *   imports a module the other also imports) are NOT disjoint even if their declared
 *   Touches lists have no literal overlap.
 *
 *   FAIL-LOUD invariant: on `graph-unavailable`, the graph-aware check either HALTS
 *   (returns {ok:false, reason:"GRAPH_UNAVAILABLE"}) or falls back to the literal-
 *   Touches-overlap check ONLY when `opts.disjointnessFallback === "touches-only"` is
 *   explicitly set by the operator (the bootstrap escape hatch). A grep-reconstructed
 *   disjointness guess is NEVER taken. [RULE] execute-disjointness-fail-loud-halts-never-grep-guess
 *
 *   Bootstrap escape hatch: a fresh repo with no graph yet, or a parser regression,
 *   must NOT permanently brick parallel execution. The operator may pass
 *   `opts.disjointnessFallback = "touches-only"` to degrade to the Touches-only check
 *   with a loud ANNOUNCED WARNING. This escape applies ONLY to `graph-unavailable` —
 *   it NEVER applies to `graph-says-non-disjoint` (a real non-disjoint verdict stays
 *   absolute and un-escapable). [RULE] disjointness-bootstrap-escape-not-a-no-recourse-brick
 *
 *   The existing Touches-overlap check is PRESERVED (additive — Destructive Action Guard).
 *   [RULE] execute-disjointness-output-flips-on-graph-edge
 */

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");
// Broken-Graph-Halts: the ONE shared availability classifier (absent→auto-build,
// broken→HALT). Never re-implement the string check here. [RULE] one-availability-classifier
const { classifyGraphFailure, isTransient } = require("./gsd-t-graph-availability.cjs");

// ─── Event writer (append-only JSONL) ────────────────────────────────────

/**
 * Append a disjointness_fallback event for a task moved to sequential
 * (including unprovable tasks).
 *
 * Event shape (per T2 spec):
 *   { type: 'disjointness_fallback', task_id, reason, ts }
 *
 * Best-effort: filesystem errors are swallowed so the prover never throws.
 */
function appendFallbackEvent(projectDir, taskId, reason) {
  try {
    const eventsDir = path.join(projectDir, ".gsd-t", "events");
    fs.mkdirSync(eventsDir, { recursive: true });
    const now = new Date();
    const day = now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    const file = path.join(eventsDir, `${day}.jsonl`);
    const entry = {
      type: "disjointness_fallback",
      task_id: taskId,
      reason,
      ts: now.toISOString(),
    };
    fs.appendFileSync(file, JSON.stringify(entry) + "\n");
  } catch {
    // Swallow — observability only; never block the caller.
  }
}

// ─── Git-history fallback (bounded) ──────────────────────────────────────

/**
 * Heuristic touch-list source: scan up to the last 100 commits that touched
 * the domain's directory and collect file paths from commits whose subject
 * mentions the task id. Bounded to prevent runaway I/O on large repos.
 *
 * Returns: string[] — file paths (may be empty). Never throws.
 */
function gitHistoryTouches(projectDir, domain, taskId) {
  if (!domain || !taskId) return [];
  const domainDir = path.join(".gsd-t", "domains", domain);
  let raw;
  try {
    raw = execSync(
      `git log --name-only --pretty=format:"COMMIT:%H %s" -n 100 -- "${domainDir}"`,
      { cwd: projectDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
  } catch {
    return [];
  }
  if (!raw) return [];

  const files = new Set();
  let capturing = false;
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith("COMMIT:")) {
      // Subject is everything after the sha
      const sp = line.indexOf(" ");
      const subject = sp >= 0 ? line.slice(sp + 1) : "";
      capturing = subject.includes(taskId);
      continue;
    }
    if (!capturing) continue;
    const trimmed = line.trim();
    if (trimmed) files.add(trimmed);
  }
  return Array.from(files);
}

// ─── Touch-list resolution ───────────────────────────────────────────────

/**
 * Resolve the effective touch list for a task by applying the fallback chain:
 *   1. Explicit `touches` populated by D1 (from **Touches** field or scope.md Files Owned)
 *   2. Git-history heuristic — only when touches is [] (D1 couldn't find anything)
 *
 * Returns: { touches: string[], source: 'declared' | 'git' | 'none' }
 */
function resolveTouches(task, projectDir) {
  const declared = Array.isArray(task.touches) ? task.touches : [];
  if (declared.length > 0) {
    return { touches: declared.slice(), source: "declared" };
  }
  // D1 emitted an empty list → scope.md was also empty. Try git history.
  const fromGit = gitHistoryTouches(projectDir, task.domain, task.id);
  if (fromGit.length > 0) {
    return { touches: fromGit, source: "git" };
  }
  return { touches: [], source: "none" };
}

// ─── Overlap grouping (union-find over the overlap relation) ─────────────

function haveOverlap(a, b) {
  if (!a.length || !b.length) return false;
  const set = new Set(a);
  for (const f of b) {
    if (set.has(f)) return true;
  }
  return false;
}

/**
 * Group provable tasks (those with a non-empty touch list from any source)
 * into connected components over the overlap relation. A singleton component
 * with no overlapping partner is safe to parallelize; a component of size ≥ 2
 * must be serialized.
 */
function groupByOverlap(items) {
  // items: [{ task, touches }]
  const n = items.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (i, j) => {
    const a = find(i), b = find(j);
    if (a !== b) parent[a] = b;
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (haveOverlap(items[i].touches, items[j].touches)) union(i, j);
    }
  }
  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(items[i].task);
  }
  return Array.from(groups.values());
}

// ─── Graph-aware disjointness (M94-D11 — SAFETY-CRITICAL) ───────────────────

/**
 * Query the graph CLI for the blast-radius of a file (transitive downstream set).
 *
 * Returns { blastRadius: string[], graphAvailable: boolean, cliPresent: boolean }.
 *
 * `cliPresent: false` means no local `bin/gsd-t-graph-query-cli.cjs` was found —
 * the project has no graph infrastructure at all. Callers should skip the graph
 * check entirely in that case (not FAIL LOUD — this is "no graph", not "broken graph").
 *
 * `cliPresent: true, graphAvailable: false` means the CLI exists but the graph index
 * is missing or broken → FAIL LOUD (callers should halt fan-out).
 *
 * Only the LOCAL `bin/gsd-t-graph-query-cli.cjs` is used — no global `gsd-t` fallback.
 * The global `gsd-t` binary serves other purposes; only the local CLI is the graph
 * query interface. This ensures projects without graph infrastructure do not accidentally
 * query a global binary (which would have no graph data for this project anyway).
 *
 * Never throws.
 *
 * @param {string} projectDir
 * @param {string} filePath — repo-relative path to query
 */
function queryBlastRadius(projectDir, filePath) {
  const queryCliPath = path.join(projectDir, "bin", "gsd-t-graph-query-cli.cjs");
  const cliPresent = fs.existsSync(queryCliPath);

  // No local CLI → no graph infrastructure. Skip the graph check; do NOT FAIL LOUD.
  if (!cliPresent) {
    return { blastRadius: [], graphAvailable: false, cliPresent: false };
  }

  let raw;
  let execErr = null;
  try {
    raw = execSync(`node "${queryCliPath}" blast-radius "${filePath}"`, {
      cwd: projectDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 10000,
    });
  } catch (e) {
    // The CLI's fail() exits 1 while STILL emitting a granular envelope on stdout —
    // execSync throws on the non-zero exit, but e.stdout carries the envelope. A true
    // crash (missing require) leaves stdout empty and stderr populated → BROKEN.
    execErr = e;
    raw = (e && e.stdout) ? e.stdout : "";
  }
  const trimmed = (raw || "").trim();
  // Parse the envelope FIRST (trust the producer's granular reason) — even on a
  // non-zero exit, a valid envelope means the producer classified it (absent/broken).
  if (trimmed) {
    try {
      const envelope = JSON.parse(trimmed);
      if (!envelope.ok) {
        // Route the producer's reason through the ONE classifier.
        // [RULE] one-availability-classifier [RULE] crash-classified-not-fabricated
        const c = classifyGraphFailure(envelope.reason);
        return {
          blastRadius: [], graphAvailable: false, cliPresent: true,
          state: c.state, reason: envelope.reason,
          transient: isTransient(envelope.detail),
        };
      }
      if (Array.isArray(envelope.results)) {
        const files = envelope.results.map((r) =>
          typeof r === "string" ? r : (r && (r.file || r.path || ""))
        ).filter(Boolean);
        return { blastRadius: files, graphAvailable: true, cliPresent: true, state: "OK" };
      }
      // ok:true but no results array — unexpected shape → BROKEN (fail-closed).
      return { blastRadius: [], graphAvailable: false, cliPresent: true, state: "BROKEN", reason: "graph-broken" };
    } catch {
      // stdout present but not JSON → CLI printed garbage → BROKEN.
      return { blastRadius: [], graphAvailable: false, cliPresent: true, state: "BROKEN", reason: "graph-broken" };
    }
  }
  // No envelope on stdout at all. A crash (empty stdout + throw) → BROKEN, unless the
  // failure looks transient (lock/timeout), in which case the caller retries once.
  const detail = execErr && (execErr.stderr || execErr.message);
  return {
    blastRadius: [], graphAvailable: false, cliPresent: true,
    state: "BROKEN", reason: "graph-broken", transient: isTransient(detail),
  };
}

/**
 * M94-D11: Graph-aware disjointness check between two touch-lists.
 *
 * Returns one of:
 *   { verdict: "disjoint" }
 *   { verdict: "non-disjoint", reason: "graph-overlap"|"literal-touches-overlap", overlap: [...] }
 *   { verdict: "graph-unavailable", reason: "GRAPH_UNAVAILABLE" }
 *     — CLI present, graph index broken/missing → FAIL LOUD
 *   { verdict: "no-cli" }
 *     — no local graph CLI binary → skip graph check, Touches-only path
 *
 * The literal-Touches-overlap check runs FIRST (fast path). The graph check runs ONLY
 * when the literal check returns disjoint — to discover transitive overlaps.
 *
 * [RULE] execute-disjointness-graph-aware-dependency-overlap
 * [RULE] execute-disjointness-output-flips-on-graph-edge
 */
// [RULE] absent-graph-auto-builds-once — build the index ONCE via the existing
// `gsd-t graph index` path when the graph is ABSENT (never indexed). Returns true on
// a successful build. Never throws.
function autoBuildGraphIndex(projectDir) {
  try {
    execSync(`node "${path.join(projectDir, "bin", "gsd-t-graph-index.cjs")}" build --repo "${projectDir}"`, {
      cwd: projectDir,
      encoding: "utf8",
      stdio: ["ignore", "ignore", "pipe"],
      timeout: 300000,
    });
    return true;
  } catch {
    return false;
  }
}

// [RULE] false-broken-guarded — retry ONCE on a transient failure (DB lock / timeout)
// so a slow/locked query does not wrongly HALT fan-out.
function queryBlastRadiusRetrying(projectDir, filePath) {
  let r = queryBlastRadius(projectDir, filePath);
  if (!r.graphAvailable && r.cliPresent && r.transient) {
    r = queryBlastRadius(projectDir, filePath);
  }
  return r;
}

function graphAwareDisjointCheck(projectDir, touchesA, touchesB) {
  // Fast path: literal Touches overlap — already know they're non-disjoint.
  if (haveOverlap(touchesA, touchesB)) {
    return { verdict: "non-disjoint", reason: "literal-touches-overlap", overlap: [] };
  }

  // Slow path: query the graph for transitive dependency overlap.
  let graphAvailableConfirmed = false;

  for (const fileA of touchesA.slice(0, 5)) {
    const { blastRadius, graphAvailable, cliPresent, state } = queryBlastRadiusRetrying(projectDir, fileA);
    if (!cliPresent) {
      // No local graph CLI in this project — skip graph check entirely.
      return { verdict: "no-cli" };
    }
    if (!graphAvailable) {
      // CLI present but graph absent (never indexed) or broken (corrupt/crash).
      // Carry the classified state up so the caller can auto-build ABSENT vs HALT BROKEN.
      // [RULE] one-availability-classifier
      return { verdict: "graph-unavailable", reason: "GRAPH_UNAVAILABLE", state: state || "BROKEN" };
    }
    graphAvailableConfirmed = true;
    const setBtouch = new Set(touchesB);
    const overlap = blastRadius.filter((f) => setBtouch.has(f));
    if (overlap.length > 0) {
      return {
        verdict: "non-disjoint",
        reason: "graph-overlap",
        overlap,
        detail: `"${fileA}" has transitive dependents in domain B: ${overlap.slice(0, 3).join(", ")}`,
      };
    }
  }

  for (const fileB of touchesB.slice(0, 5)) {
    const { blastRadius, graphAvailable, cliPresent, state } = queryBlastRadiusRetrying(projectDir, fileB);
    if (!cliPresent) {
      if (!graphAvailableConfirmed) {
        return { verdict: "no-cli" };
      }
      continue; // Transient: A's queries confirmed the CLI; skip B
    }
    if (!graphAvailable) {
      if (!graphAvailableConfirmed) {
        // CLI present but graph absent/broken → carry classified state up.
        return { verdict: "graph-unavailable", reason: "GRAPH_UNAVAILABLE", state: state || "BROKEN" };
      }
      continue; // Transient error on B after A confirmed available — skip
    }
    graphAvailableConfirmed = true;
    const setAtouch = new Set(touchesA);
    const overlap = blastRadius.filter((f) => setAtouch.has(f));
    if (overlap.length > 0) {
      return {
        verdict: "non-disjoint",
        reason: "graph-overlap",
        overlap,
        detail: `"${fileB}" has transitive dependents in domain A: ${overlap.slice(0, 3).join(", ")}`,
      };
    }
  }

  return { verdict: "disjoint" };
}

/**
 * M94-D11: Graph-aware group partitioner.
 *
 * On graph-unavailable:
 *   - fallbackToTouchesOnly=true → ANNOUNCED WARNING + literal-Touches fallback
 *     (bootstrap escape hatch for fresh repo / parser regression).
 *   - fallbackToTouchesOnly=false → returns { graphUnavailable:true } immediately
 *     so the caller can FAIL LOUD and HALT.
 *
 * The escape hatch NEVER applies to a graph-says-non-disjoint verdict — real blocks
 * stay absolute.
 *
 * [RULE] execute-disjointness-fail-loud-halts-never-grep-guess
 * [RULE] disjointness-bootstrap-escape-not-a-no-recourse-brick
 */
function groupByOverlapGraphAware(items, projectDir, fallbackToTouchesOnly) {
  const n = items.length;
  if (n === 0) return { parallel: [], sequential: [], graphUnavailable: false };

  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  };
  const union = (i, j) => { const a = find(i), b = find(j); if (a !== b) parent[a] = b; };

  let graphUnavailable = false;
  let graphBuilt = false; // [RULE] absent-graph-auto-builds-once — build at most once

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let result = graphAwareDisjointCheck(projectDir, items[i].touches, items[j].touches);
      // ABSENT (never indexed) → auto-build ONCE, then re-check this pair. A second
      // consecutive absent (build failed or still absent) = BROKEN infra.
      // [RULE] absent-graph-auto-builds-once
      if (result.verdict === "graph-unavailable" && result.state === "ABSENT" && !graphBuilt) {
        graphBuilt = true;
        process.stderr.write(`[gsd-t disjointness] graph ABSENT — building index once (gsd-t graph index)...\n`);
        const ok = autoBuildGraphIndex(projectDir);
        if (ok) {
          result = graphAwareDisjointCheck(projectDir, items[i].touches, items[j].touches);
        }
        // If still absent after the build, treat as BROKEN (build infra failing).
        if (result.verdict === "graph-unavailable" && result.state === "ABSENT") {
          result = { verdict: "graph-unavailable", reason: "GRAPH_UNAVAILABLE", state: "BROKEN" };
        }
      }
      if (result.verdict === "no-cli") {
        // No local graph CLI in this project → skip graph check for all pairs.
        // Fall through to Touches-only for this pair (NOT FAIL LOUD — this is "no graph").
        if (haveOverlap(items[i].touches, items[j].touches)) {
          union(i, j);
        }
      } else if (result.verdict === "graph-unavailable") {
        graphUnavailable = true;
        // BROKEN graph → HALT (never grep-guess). The bootstrap escape hatch is the
        // ONLY sanctioned continue, and it is loudly announced.
        // [RULE] broken-graph-halts-never-greps
        if (fallbackToTouchesOnly) {
          // Bootstrap escape hatch: ANNOUNCED WARNING, degrade to literal-Touches.
          // NEVER silent. NEVER applied to graph-says-non-disjoint verdicts.
          process.stderr.write(
            `[gsd-t disjointness] WARNING: graph BROKEN — falling back to ` +
            `literal-Touches-only check (--disjointness-fallback=touches-only). ` +
            `Transitive dependency overlaps will NOT be detected. ` +
            `Fix the graph (gsd-t graph status) before the next parallel execute.\n`
          );
          if (haveOverlap(items[i].touches, items[j].touches)) {
            union(i, j);
          }
        } else {
          // No escape hatch: FAIL LOUD — return the unavailable signal.
          // The caller (proveDisjointness) surfaces this and HALTS fan-out.
          return { parallel: [], sequential: [], graphUnavailable: true };
        }
      } else if (result.verdict === "non-disjoint") {
        // Real non-disjoint (literal OR graph-says-non-disjoint) — ABSOLUTE, not escapable.
        union(i, j);
      }
      // verdict === "disjoint" → no union (safe to parallel)
    }
  }

  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(items[i].task);
  }

  const parallel = [];
  const sequential = [];
  for (const group of groups.values()) {
    if (group.length === 1) parallel.push(group);
    else sequential.push(group);
  }

  return { parallel, sequential, graphUnavailable: false };
}

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Prove pairwise file-disjointness across a candidate parallel set.
 *
 * M94-D11: Graph-aware when `bin/gsd-t-graph-query-cli.cjs` is present in projectDir.
 *   - No local CLI → auto-detects via `no-cli` verdict → Touches-only (backward-compat).
 *   - Local CLI present but graph index missing/broken → FAIL LOUD (graphUnavailable=true).
 *   - Local CLI present and graph available → transitive-overlap check via blast-radius.
 *
 * @param {{
 *   tasks: object[],
 *   projectDir: string,
 *   disjointnessFallback?: "touches-only",  // bootstrap escape hatch: graph-unavailable → Touches-only
 *   skipGraphCheck?: boolean,               // test-only: isolate Touches-only verdict (consumption-proof delta)
 * }} opts
 *
 * @returns {{
 *   parallel: object[][],
 *   sequential: object[][],
 *   unprovable: object[],
 *   graphUnavailable?: boolean,  // true when CLI present but graph broken + no escape hatch
 *   haltReason?: string,         // "GRAPH_UNAVAILABLE"
 *   haltMessage?: string,        // human-readable remediation message
 * }}
 *
 * FAIL-LOUD invariant: when graphUnavailable=true, the CALLER must surface:
 *   "graph unavailable — fix it (gsd-t graph status)" and HALT fan-out.
 *   It MUST NOT proceed on a grep-reconstructed guess.
 * [RULE] execute-disjointness-fail-loud-halts-never-grep-guess
 *
 * Bootstrap escape hatch (opts.disjointnessFallback === "touches-only"):
 *   On CLI-present-but-graph-unavailable, falls back to literal-Touches with ANNOUNCED WARNING.
 *   Applies ONLY to graph-unavailable — graph-says-non-disjoint is absolute and un-escapable.
 * [RULE] disjointness-bootstrap-escape-not-a-no-recourse-brick
 *
 * Never throws.
 */
function proveDisjointness(opts) {
  const tasks = (opts && Array.isArray(opts.tasks)) ? opts.tasks : [];
  const projectDir = (opts && opts.projectDir) || process.cwd();
  const fallbackToTouchesOnly = (opts && opts.disjointnessFallback) === "touches-only";
  // skipGraphCheck=true forces Touches-only even if a local CLI is present.
  // Used by the consumption-proof test to isolate the Touches-only verdict for comparison.
  const skipGraphCheck = !!(opts && opts.skipGraphCheck);

  const parallel = [];
  const sequential = [];
  const unprovable = [];

  if (tasks.length === 0) {
    return { parallel, sequential, unprovable };
  }

  // Resolve each task's effective touch list.
  const provable = []; // [{ task, touches }]
  for (const t of tasks) {
    const { touches, source } = resolveTouches(t, projectDir);
    if (source === "none") {
      unprovable.push(t);
      sequential.push([t]);
      appendFallbackEvent(projectDir, t.id, "unprovable");
    } else {
      provable.push({ task: t, touches });
    }
  }

  if (provable.length === 0) {
    return { parallel, sequential, unprovable };
  }

  // M94-D11: Graph-aware path — auto-activated when the local graph CLI is present.
  // When no local CLI is found, graphAwareDisjointCheck returns verdict="no-cli" and
  // groupByOverlapGraphAware degrades to literal-Touches seamlessly (no FAIL LOUD).
  if (!skipGraphCheck) {
    const graphResult = groupByOverlapGraphAware(provable, projectDir, fallbackToTouchesOnly);
    if (graphResult.graphUnavailable) {
      // FAIL LOUD: local CLI is present but graph index is broken/missing.
      // Caller must surface this and HALT fan-out.
      return {
        parallel: [],
        sequential: [],
        unprovable,
        graphUnavailable: true,
        haltReason: "GRAPH_UNAVAILABLE",
        haltMessage: "graph unavailable — fix it (gsd-t graph status). " +
          "Parallel execution requires the graph index for dependency-overlap detection. " +
          "To bypass temporarily (fresh-repo bootstrap only), pass --disjointness-fallback=touches-only " +
          "(ANNOUNCED WARNING — transitive overlaps will NOT be detected).",
      };
    }
    // Graph check succeeded (or no-cli → Touches-only used silently).
    for (const group of graphResult.parallel) { parallel.push(group); }
    for (const group of graphResult.sequential) {
      sequential.push(group);
      for (const t of group) { appendFallbackEvent(projectDir, t.id, "write-target-overlap"); }
    }
    return { parallel, sequential, unprovable };
  }

  // skipGraphCheck=true: Touches-only path (for consumption-proof delta test).
  const groups = groupByOverlap(provable);
  for (const group of groups) {
    if (group.length === 1) {
      parallel.push(group);
    } else {
      sequential.push(group);
      for (const t of group) {
        appendFallbackEvent(projectDir, t.id, "write-target-overlap");
      }
    }
  }

  return { parallel, sequential, unprovable };
}

module.exports = {
  proveDisjointness,
  // Internals exposed for unit tests:
  _haveOverlap: haveOverlap,
  _groupByOverlap: groupByOverlap,
  _groupByOverlapGraphAware: groupByOverlapGraphAware,
  _graphAwareDisjointCheck: graphAwareDisjointCheck,
  _queryBlastRadius: queryBlastRadius,
  _resolveTouches: resolveTouches,
  _gitHistoryTouches: gitHistoryTouches,
};
