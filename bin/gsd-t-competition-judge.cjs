"use strict";

/**
 * gsd-t-competition-judge — M82 D1
 *
 * The selection oracle for Competition Mode (generate-and-judge on upstream,
 * pre-contract phases). Given N candidate artifacts produced by parallel
 * producers, score them and emit a winner — the GENERATIVE dual of the
 * orthogonal validation triad (which is adversarial: many critics, one
 * candidate). Contract: .gsd-t/contracts/competition-mode-contract.md v1.0.0.
 *
 * Two judge modes, chosen by `--kind`:
 *
 *   --kind partition  → OBJECTIVE judge (the v1 beachhead). Each candidate is a
 *       proposed domain decomposition: a list of domains, each with a write-
 *       touch list. We score it with the SAME disjointness oracle the real
 *       parallel dispatcher uses (bin/gsd-t-file-disjointness.cjs), so the judge
 *       is a CALCULATOR, not a critic — it sidesteps every LLM-judge bias
 *       (position / verbosity / self-preference). Metrics, higher-is-better
 *       unless noted:
 *         - valid             : zero write-target overlaps across domains (HARD gate)
 *         - parallelGroups    : count of disjoint domains that can fan out at once
 *         - waveDepth         : serial gates (sequential groups + 1 if any) — LOWER better
 *         - unprovableCount   : domains with no touch list — LOWER better (safe-default seq)
 *       Ranking: invalid candidates are disqualified; among valid ones, rank by
 *       (parallelGroups desc, waveDepth asc, unprovableCount asc, domainCount asc).
 *
 *   --kind generic   → records a SUBJECTIVE judge's verdict. The numeric scoring
 *       lives in the rubric the Workflow's judge agent fills in (blind+shuffled,
 *       different-model, rubric-scored — see the contract). This CLI only
 *       validates/normalizes the rubric scores the agent supplies and picks the
 *       winner deterministically (highest weighted score; ties → lowest index of
 *       the ORIGINAL, pre-shuffle order to keep selection reproducible). It does
 *       NOT call an LLM — keeping inference out of the deterministic substrate
 *       (per feedback_deterministic_orchestration + anthropic-key-measurement-only).
 *
 * Input: a JSON spec on stdin OR via --in <path>. Shapes:
 *
 *   partition: {
 *     "kind": "partition",
 *     "candidates": [
 *       { "id": "A", "domains": [ { "name": "d1", "touches": ["a.js","b.js"] }, ... ] },
 *       ...
 *     ]
 *   }
 *
 *   generic: {
 *     "kind": "generic",
 *     "axes": [ { "key": "coherence", "weight": 1 }, { "key": "completeness", "weight": 1 }, ... ],
 *     "candidates": [
 *       { "id": "A", "scores": { "coherence": 4, "completeness": 3, ... } },
 *       ...
 *     ]
 *   }
 *
 * Output (JSON envelope, the shape runCli parses):
 *   {
 *     ok: boolean,            // true unless input was unusable
 *     exitCode: 0 | 4 | 64,
 *     kind, n,
 *     winner: <candidateId|null>,
 *     ranked: [ { id, valid?, parallelGroups?, waveDepth?, unprovableCount?, score?, rank } ],
 *     reason?: string
 *   }
 *
 * Exit codes: 0 ok+winner · 4 ok but NO valid candidate (all disqualified) · 64 bad input.
 *
 * Hard rules (mirrors the disjointness prover's discipline):
 *   - Zero external runtime deps (Node built-ins only).
 *   - Never throws — always emits an envelope.
 *   - Pure / read-only — no project mutation. Deterministic given the same input.
 */

const fs = require("node:fs");

// The objective partition judge reuses the production disjointness oracle so the
// judge's notion of "parallelizable" is byte-identical to the dispatcher's.
let proveDisjointness;
try {
  ({ proveDisjointness } = require("./gsd-t-file-disjointness.cjs"));
} catch {
  proveDisjointness = null;
}

// ─── Partition scoring (objective) ───────────────────────────────────────

/**
 * Score one candidate partition by running its domains through the disjointness
 * oracle. Each domain becomes a pseudo-task {id, domain, touches}; we never hit
 * git history (every domain carries an explicit touch list or is counted
 * unprovable), so scoring is pure and deterministic.
 *
 * @returns {{valid, domainCount, parallelGroups, sequentialGroups, unprovableCount, waveDepth}}
 */
// Normalize a touch path to a stable file identity so two spellings of the SAME
// file (./bin/x.js vs bin/x.js, trailing slash, backslashes, redundant ./ or //)
// are detected as a conflict. Without this, an overlapping partition could be
// scored `valid` and WIN — then the real dispatcher would hit a write conflict.
// Note: case is preserved (most CI runs on case-sensitive Linux); collapsing case
// here would create false conflicts on case-sensitive repos. Path identity only.
function _normPath(p) {
  if (typeof p !== "string") return "";
  let s = p.trim().replace(/\\/g, "/");        // backslashes -> forward
  s = s.replace(/\/+/g, "/");                    // collapse repeated slashes
  s = s.replace(/^\.\//, "");                    // drop leading ./
  while (s.includes("/./")) s = s.replace("/./", "/"); // drop interior /./
  s = s.replace(/\/+$/, "");                      // drop trailing slash
  return s;
}

function scorePartition(candidate, projectDir) {
  const domains = Array.isArray(candidate.domains) ? candidate.domains : [];
  const tasks = domains.map((d, i) => ({
    id: `${candidate.id}:${d.name || `d${i}`}`,
    domain: d.name || `d${i}`,
    // Only honor an explicit touch list — never let the oracle fall through to
    // git history during scoring (would make the judge non-deterministic).
    // Normalize + de-dupe so path-spelling variants are caught as real conflicts.
    touches: Array.isArray(d.touches)
      ? Array.from(new Set(d.touches.map(_normPath).filter(Boolean)))
      : [],
  }));

  // Run the real oracle when available; otherwise fall back to a self-contained
  // overlap check so the judge still works if the lib isn't co-located.
  // fallbackToTouchesOnly: the judge SCORES partition shapes — it is not gating a
  // live parallel fan-out — so when the graph index is absent (M94: the query CLI
  // exists but no index is built, e.g. on a tiny synthetic candidate), it must
  // degrade to the literal-Touches disjointness count, NOT return empty groups
  // (which would zero parallelGroups and break scoring). The FAIL-LOUD-HALT path
  // is reserved for execute's real fan-out gate, which requires the graph.
  const res = proveDisjointness
    ? proveDisjointness({ tasks, projectDir, disjointnessFallback: "touches-only" })
    : _localDisjoint(tasks);

  const parallelGroups = (res.parallel || []).length;
  const sequentialGroups = (res.sequential || []).filter(
    (g) => !(g.length === 1 && (res.unprovable || []).includes(g[0])),
  ).length;
  const unprovableCount = (res.unprovable || []).length;

  // VALID = no two domains with declared touch lists write the same file. An
  // overlap shows up as a sequential group of size ≥2 among provable tasks.
  const overlapGroup = (res.sequential || []).some((g) => g.length >= 2);
  const valid = !overlapGroup;

  // waveDepth: 1 wave for the disjoint fan-out, +1 per serial bottleneck
  // (overlapping/unprovable domains that must run after). Fewer = better.
  const serialBottlenecks = sequentialGroups + unprovableCount;
  const waveDepth = (parallelGroups > 0 ? 1 : 0) + (serialBottlenecks > 0 ? 1 : 0) || 1;

  return {
    valid,
    domainCount: domains.length,
    parallelGroups,
    sequentialGroups,
    unprovableCount,
    waveDepth,
  };
}

// Self-contained overlap fallback (only used if the oracle lib is absent).
function _localDisjoint(tasks) {
  const parallel = [];
  const sequential = [];
  const unprovable = [];
  const provable = [];
  for (const t of tasks) {
    if (!t.touches || t.touches.length === 0) {
      unprovable.push(t);
      sequential.push([t]);
    } else {
      provable.push(t);
    }
  }
  // union-find over file overlap
  const parent = provable.map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  };
  for (let i = 0; i < provable.length; i++) {
    for (let j = i + 1; j < provable.length; j++) {
      const a = new Set(provable[i].touches);
      if (provable[j].touches.some((f) => a.has(f))) {
        const ra = find(i), rb = find(j);
        if (ra !== rb) parent[ra] = rb;
      }
    }
  }
  const groups = new Map();
  for (let i = 0; i < provable.length; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(provable[i]);
  }
  for (const g of groups.values()) (g.length === 1 ? parallel : sequential).push(g);
  return { parallel, sequential, unprovable };
}

// Drop candidates that are not usable objects with a string id (Red Team MED-4:
// the 'never throws' guarantee is on the function, not just the CLI shell — an
// in-process caller passing [null] or {id:{}} must not crash, and a non-string id
// could never match `c.id === winnerId` in the workflow anyway).
function _safeCandidates(candidates) {
  return (Array.isArray(candidates) ? candidates : []).filter(
    (c) => c && typeof c === "object" && typeof c.id === "string" && c.id.length > 0,
  );
}

function rankPartitions(rawCandidates, projectDir) {
  const candidates = _safeCandidates(rawCandidates);
  const scored = candidates.map((c) => ({ id: c.id, ...scorePartition(c, projectDir) }));
  // Disqualify invalid (file-overlap) candidates from winning, but keep them in
  // the ranking so the caller can see why they lost.
  const valid = scored.filter((s) => s.valid);
  const cmp = (a, b) =>
    b.parallelGroups - a.parallelGroups ||      // more concurrency wins
    a.waveDepth - b.waveDepth ||                 // fewer serial gates wins
    a.unprovableCount - b.unprovableCount ||     // fewer unknowns wins
    a.domainCount - b.domainCount;               // simpler (fewer domains) wins
  valid.sort(cmp);
  const invalid = scored.filter((s) => !s.valid);
  const ordered = [...valid, ...invalid];
  ordered.forEach((s, i) => { s.rank = i + 1; });
  return { ranked: ordered, winner: valid.length ? valid[0].id : null };
}

// ─── Generic scoring (subjective rubric, deterministic selection) ────────

function rankGeneric(spec) {
  const axes = Array.isArray(spec.axes) && spec.axes.length
    ? spec.axes
    : [{ key: "quality", weight: 1 }];
  const candidates = _safeCandidates(spec.candidates);
  const scored = candidates.map((c, idx) => {
    const scores = c.scores || {};
    let total = 0;
    let weightSum = 0;
    for (const ax of axes) {
      const w = Number(ax.weight) || 0;
      const v = Number(scores[ax.key]) || 0;
      total += w * v;
      weightSum += w;
    }
    const score = weightSum > 0 ? total / weightSum : 0;
    return { id: c.id, score: Number(score.toFixed(4)), _idx: idx };
  });
  // Highest weighted score wins; ties broken by ORIGINAL index (reproducible,
  // immune to candidate-order shuffling done for bias control upstream).
  scored.sort((a, b) => b.score - a.score || a._idx - b._idx);
  scored.forEach((s, i) => { s.rank = i + 1; delete s._idx; });
  return { ranked: scored, winner: scored.length ? scored[0].id : null };
}

// ─── Driver ──────────────────────────────────────────────────────────────

function judge(spec, projectDir) {
  const candidates = Array.isArray(spec && spec.candidates) ? spec.candidates : [];
  if (!candidates.length) {
    return { ok: false, exitCode: 64, kind: spec && spec.kind, n: 0, winner: null, ranked: [], reason: "no-candidates" };
  }
  const kind = spec.kind === "generic" ? "generic" : "partition";
  const { ranked, winner } = kind === "partition"
    ? rankPartitions(candidates, projectDir)
    : rankGeneric(spec);
  const ok = winner != null;
  return {
    ok,
    exitCode: ok ? 0 : 4,
    kind,
    n: candidates.length,
    winner,
    ranked,
    ...(ok ? {} : { reason: kind === "partition" ? "no-valid-candidate" : "no-candidates" }),
  };
}

function readInput(opts) {
  if (opts.in) return fs.readFileSync(opts.in, "utf8");
  // stdin
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function parseArgs(argv) {
  const opts = { json: true, in: null, projectDir: process.cwd(), help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") opts.help = true;
    else if (a === "--in") opts.in = argv[++i];
    else if (a === "--project-dir") opts.projectDir = argv[++i];
    else if (a === "--json") opts.json = true;
  }
  return opts;
}

const HELP = `Usage: gsd-t competition-judge [--in PATH] [--project-dir PATH]

Reads a candidate-set JSON spec (stdin or --in) and emits a ranked winner.

  --in PATH          Read spec from file instead of stdin.
  --project-dir PATH Project root (default: cwd).
  --json             Emit JSON envelope (default; always on).

Spec.kind:
  "partition"  Objective oracle judge — scores domain decompositions via the
               file-disjointness prover (parallelGroups / waveDepth / validity).
  "generic"    Deterministic rubric selector — picks the highest weighted score
               from rubric values an upstream judge agent supplied.

Exit codes: 0 winner · 4 no valid candidate · 64 bad input.`;

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(HELP + "\n");
    process.exit(0);
  }
  let spec;
  try {
    const raw = readInput(opts);
    spec = JSON.parse(raw);
  } catch (e) {
    const env = { ok: false, exitCode: 64, kind: null, n: 0, winner: null, ranked: [], reason: `bad-input: ${e && e.message}` };
    process.stdout.write(JSON.stringify(env, null, 2) + "\n");
    process.exit(64);
  }
  let result;
  try {
    result = judge(spec, opts.projectDir);
  } catch (e) {
    result = { ok: false, exitCode: 64, kind: spec && spec.kind, n: 0, winner: null, ranked: [], reason: `judge-error: ${e && e.message}` };
  }
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.exitCode);
}

if (require.main === module) main();

module.exports = {
  judge,
  scorePartition,
  rankPartitions,
  rankGeneric,
  _internal: { _localDisjoint, _normPath },
};
