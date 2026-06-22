"use strict";

/**
 * gsd-t-architectural-trigger.cjs — M90 D1 (v1.0.0)
 *
 * Deterministic architectural-assumption trigger module.
 *
 * TWO fire paths:
 *
 *   R-ARCH-1 — DIVERGENCE SAMPLING (experimental + measured)
 *     Given N≥2 fresh-context answers to the SAME approach question, computes a
 *     deterministic divergence measure (normalized type-token ratio variance across
 *     answer n-gram fingerprints). When divergence exceeds DIVERGENCE_THRESHOLD, fires
 *     with reason "divergence-sampling:high-variance". Sourced from ClarifyGPT
 *     consistency-sampling (https://arxiv.org/pdf/2310.10996): divergence across
 *     fresh-context samples ⇒ a load-bearing unproven assumption exists.
 *     NOTE: This path is EXPERIMENTAL+MEASURED (competition-arm only). Self-MoA
 *     (one model, temperature-varied) may not diverge like the fresh-context saga
 *     cases the threshold was tuned on. That mismatch is RECORDED by the
 *     instrumentation sink; the path never claims it works.
 *
 *   R-ARCH-2 — PROTOCOL CLASS (unconditional on extend-existing-code signal)
 *     Extending existing code is itself an approach decision — the trigger fires
 *     unconditionally on an extend signal (no confidence/threshold gate). Signal
 *     format: { type: "extend-existing-code", context, basis }.
 *     Signal is COMPUTED at runtime from task/scope inputs that already exist
 *     (a task whose **Touches** lists an EXISTING file ⇒ extend-class). The
 *     D-CONTRACT domain (D4-T4) computes this from brief/task inputs.
 *     Reason literal: "protocol-class:extend-existing" (distinguishable from R-ARCH-1).
 *
 * RESPONSE INTERFACE (R-ARCH-3..6) — INTERFACE ONLY; agent() wiring is D-CONTRACT.
 *
 *   mode "spike" — PREFERRED response; attempt an executable spike to prove feasibility.
 *   mode "adversary-only" — fallback when spike is infeasible or fails.
 *   R-ARCH-4: spike-fail → STOP directive in envelope; agent cannot proceed.
 *   R-ARCH-5: spike-infeasible → logged skip + adversary MANDATORY.
 *   R-ARCH-6: proven-by-adversary-only → flag surfaced for verify gate.
 *
 * INSTRUMENTATION (no-claim invariant):
 *   Every fire emits a JSONL record to the measurement sink. The module NEVER asserts
 *   it works — it emits data only (fire-rate, catch-quality fields). No self-efficacy
 *   claim in any envelope field.
 *
 * HOUSE STYLE:
 *   { ok: true, ... }    on success
 *   { ok: false, error } on bad input
 *   Deterministic: identical input → byte-identical envelope.
 *   Bad input → { ok:false, error } + non-zero CLI exit.
 *   Node built-ins only; zero new runtime deps; sync APIs.
 *
 * CONTRACT: .gsd-t/contracts/m90-doctrine-mechanisms-contract.md §2 v1.0.0
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

// ---------------------------------------------------------------------------
// Constants (DECLARED — not back-fit per fixture)
// ---------------------------------------------------------------------------

/**
 * Divergence threshold for the shared-core-term fraction metric.
 * DECLARED CONSTANT — the divergence measure is a fixed formula and this threshold
 * is a declared constant, not back-fit to any fixture.
 *
 * Formula: score = 1 - (sharedCoreTerms / allUniqueTerms)
 *   - sharedCoreTerms = non-stopword tokens (≥4 chars) appearing in ≥50% of N answers
 *   - allUniqueTerms = total unique non-stopword tokens across all answers
 *
 * Basis: ClarifyGPT (arXiv:2310.10996) consistency-sampling — across N independent
 * fresh-context samples, low shared-core-term fraction (high unique-term proportion)
 * indicates each answer introduced different technical mechanisms, the proxy for
 * "an unproven architectural premise exists." A HIGH shared-core fraction means
 * all answers converged on the same technical strategy.
 *
 * Threshold 0.80 was chosen as the midpoint of the confirmed gap in the TUNED corpus:
 *   divergent rows all score ≥0.89; convergent rows all score ≤0.70.
 * Gap = 0.19; midpoint ≈ 0.79. Set to 0.80 (conservative toward precision over recall).
 * NOT tuned to held-out rows.
 */
const DIVERGENCE_THRESHOLD = 0.80;

/**
 * Minimum N for divergence sampling. N<2 cannot produce a meaningful comparison.
 */
const MIN_ANSWERS = 2;

/**
 * Stopwords excluded from token analysis.
 * Common English function words plus broad technical/generic terms that appear in
 * BOTH divergent and convergent contexts equally (non-discriminative).
 */
const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "must", "shall", "to", "of", "in", "on",
  "at", "by", "for", "with", "from", "as", "or", "and", "but", "not",
  "it", "its", "this", "that", "these", "those", "we", "our", "you",
  "your", "they", "them", "i", "me", "my", "he", "she", "him", "her",
  "which", "what", "how", "when", "where", "if", "so", "also", "just",
  "then", "than", "there", "here", "same", "all", "any", "each", "can",
  "into", "via", "no", "only", "need", "using", "use", "call", "make",
  "ensure", "before", "after", "pass", "get", "set", "both", "up",
  "out", "above", "below", "end", "result", "object", "string",
  "function", "value", "input", "output", "code", "signal",
]);

/**
 * Measurement sink file location. Relative to the project root (cwd at runtime).
 * Kept in .gsd-t/metrics/ alongside other measurement sinks.
 */
const SINK_RELATIVE_PATH = path.join(".gsd-t", "metrics", "arch-trigger-events.jsonl");

// ---------------------------------------------------------------------------
// Divergence measure (R-ARCH-1)
// ---------------------------------------------------------------------------

/**
 * Tokenize an answer string into a SET of unique lowercase key terms.
 * Filters out stopwords and short tokens (< 4 chars) to focus on
 * substantive technical vocabulary.
 *
 * Deterministic: same string → same token set.
 *
 * @param {string} text
 * @returns {Set<string>}
 */
function tokenize(text) {
  const tokens = (text.match(/[a-z][a-z0-9_.-]*/gi) || [])
    .map((t) => t.toLowerCase())
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
  return new Set(tokens);
}

/**
 * Given N fresh-context answers to the same approach question, compute a
 * deterministic divergence score using the shared-core-term fraction metric.
 *
 * THE FIXED, DOCUMENTED FORMULA:
 *   1. Tokenize each answer into a set of unique non-stopword terms (≥4 chars).
 *   2. For each unique term across all answers, count how many answers contain it.
 *   3. sharedCoreTerms = count of terms appearing in ≥ ceil(N * 0.5) answers.
 *      (i.e., appearing in at least half of all N answers)
 *   4. allUniqueTerms = total count of distinct terms across all N answers.
 *   5. score = 1 - (sharedCoreTerms / allUniqueTerms)
 *
 * Interpretation:
 *   - score ≈ 0: most terms are shared → answers agree on same strategy → CONVERGENT
 *   - score ≈ 1: few terms are shared → each answer introduced different mechanisms → DIVERGENT
 *
 * Basis: divergent answers each name a different technical mechanism (different
 * key tokens). Convergent answers share the same core technical vocabulary because
 * they all describe the same strategy. The shared-term fraction measures how much
 * vocabulary each answer contributes that was NOT in the others.
 *
 * Threshold DIVERGENCE_THRESHOLD = 0.80. Gap between corpus classes:
 *   divergent ≥ 0.89, convergent ≤ 0.70, gap = 0.19.
 *
 * Deterministic: identical inputs (same strings in same order) → byte-identical score.
 * allUniqueTerms = 0 → returns 0 (degenerate all-empty input; no fire).
 *
 * @param {string[]} answers - N≥2 fresh-context answers to the same question.
 * @returns {number} Divergence score in [0, 1].
 */
function computeDivergenceScore(answers) {
  const tokenSets = answers.map((a) => tokenize(a));
  const termCounts = new Map();

  for (const set of tokenSets) {
    for (const term of set) {
      termCounts.set(term, (termCounts.get(term) || 0) + 1);
    }
  }

  if (termCounts.size === 0) return 0;

  const N = answers.length;
  const sharedThreshold = Math.max(2, Math.ceil(N * 0.5));

  let sharedCount = 0;
  for (const count of termCounts.values()) {
    if (count >= sharedThreshold) sharedCount++;
  }

  return 1 - sharedCount / termCounts.size;
}

// ---------------------------------------------------------------------------
// Instrumentation sink (no-claim invariant)
// ---------------------------------------------------------------------------

/**
 * Emit a structured instrumentation record to the measurement sink.
 *
 * NEVER adds a self-efficacy claim. Records facts ONLY:
 *   - fired (boolean)
 *   - basis (string | null)
 *   - mode (string — the response mode selected)
 *   - divergenceScore (number | null — for R-ARCH-1 path)
 *   - firePath ("divergence-sampling" | "protocol-class" | null)
 *
 * Wall-clock timestamp is NOT in the asserted envelope shape (the trigger envelope
 * is deterministic). The sink record carries an ISO timestamp for observability but
 * it is NOT in the trigger envelope returned to callers.
 *
 * Emission is best-effort — if the sink directory does not exist or the write fails,
 * the error is SWALLOWED (the trigger result is never blocked by instrumentation).
 *
 * @param {object} record
 */
function emitInstrumentationRecord(record) {
  try {
    const sinkPath = path.resolve(process.cwd(), SINK_RELATIVE_PATH);
    const dir = path.dirname(sinkPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // ISO timestamp for observability (not in the asserted envelope)
    const entry = Object.assign({}, record, { _emittedAt: new Date().toISOString() });
    fs.appendFileSync(sinkPath, JSON.stringify(entry) + os.EOL, "utf8");
  } catch (_) {
    // Instrumentation failure NEVER blocks the trigger result.
  }
}

// ---------------------------------------------------------------------------
// Response mode resolver (R-ARCH-3..6)
// ---------------------------------------------------------------------------

/**
 * Resolve the response mode flags given the spike feasibility / spike result inputs.
 *
 * @param {object} opts
 * @param {boolean} [opts.spikeFeasible=true]  - Can an executable spike be run?
 * @param {boolean} [opts.spikePassed]         - Did the spike pass? (ignored if spikeFeasible=false)
 * @returns {object} Response mode envelope fragment.
 */
function resolveResponseMode({ spikeFeasible = true, spikePassed } = {}) {
  if (!spikeFeasible) {
    // R-ARCH-5: spike infeasible → adversary-only + adversaryMandatory + logged skip
    return {
      mode: "adversary-only",
      adversaryMandatory: true,
      spikeSkipReason: "spike-infeasible: executable spike cannot be constructed for this premise",
      provenByAdversaryOnly: true,
      stopDirective: false,
    };
  }

  if (spikePassed === false) {
    // R-ARCH-4: spike ran and FAILED → STOP; agent cannot proceed
    return {
      mode: "adversary-only",
      adversaryMandatory: true,
      provenByAdversaryOnly: false,
      stopDirective: true,
      stopReason: "spike-fail: the executable spike failed — the premise is unproven; STOP and re-examine",
    };
  }

  if (spikePassed === true) {
    // Spike passed → prefer spike, adversary still RECOMMENDED but not mandatory
    return {
      mode: "spike",
      adversaryMandatory: false,
      provenByAdversaryOnly: false,
      stopDirective: false,
    };
  }

  // Default: spike PREFERRED (no spike result provided yet)
  return {
    mode: "spike",
    adversaryMandatory: false,
    provenByAdversaryOnly: false,
    stopDirective: false,
  };
}

// ---------------------------------------------------------------------------
// Main trigger function
// ---------------------------------------------------------------------------

/**
 * Validate shared bad-input conditions.
 * Returns { ok:false, error } if invalid, else null.
 *
 * @param {*} input
 * @returns {{ ok:false, error:string }|null}
 */
function validateInput(input) {
  if (input === null || input === undefined) {
    return { ok: false, error: "input must be a non-null object" };
  }
  if (typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "input must be a plain object" };
  }
  return null;
}

/**
 * R-ARCH-1 divergence-sampling trigger.
 *
 * @param {object} input
 * @param {string[]} input.answers - N≥2 fresh-context answers to the same question.
 * @param {string}   input.basis   - The approach/premise being evaluated.
 * @param {object}   [input.responseOpts] - Optional response mode options (see resolveResponseMode).
 * @returns {object} House-style envelope.
 */
function triggerDivergenceSampling(input) {
  const badInput = validateInput(input);
  if (badInput) return badInput;

  const { answers, basis, responseOpts = {} } = input;

  if (!Array.isArray(answers)) {
    return { ok: false, error: "input.answers must be an array of strings" };
  }
  if (answers.length < MIN_ANSWERS) {
    return {
      ok: false,
      error: `input.answers must contain at least ${MIN_ANSWERS} elements; got ${answers.length}`,
    };
  }
  for (let i = 0; i < answers.length; i++) {
    if (typeof answers[i] !== "string") {
      return { ok: false, error: `input.answers[${i}] must be a string` };
    }
  }
  if (!basis || typeof basis !== "string" || !basis.trim()) {
    return { ok: false, error: "input.basis must be a non-empty string" };
  }

  const trimmedBasis = basis.trim();
  const score = computeDivergenceScore(answers);
  const fired = score >= DIVERGENCE_THRESHOLD;

  const responseMode = resolveResponseMode(responseOpts);

  const envelope = {
    ok: true,
    firePath: "divergence-sampling",
    fired,
    basis: trimmedBasis,
    reason: fired
      ? "divergence-sampling:high-variance"
      : "divergence-sampling:low-variance",
    divergenceScore: score,
    divergenceThreshold: DIVERGENCE_THRESHOLD,
    experimental: true, // NEVER omit: this path is experimental+measured, never proven
    ...(fired ? responseMode : {}),
  };

  // Emit instrumentation (no-claim invariant: emitting a record, not asserting reliability).
  // provenByAdversaryOnly + mode are PERSISTED so the verify R-FAIL-2 gate (§4) — which scans this
  // sink for provenByAdversaryOnly===true — has the field it checks; without it the gate is vacuous
  // (count always 0, can never fire), the exact hollow-gate failure M90 exists to prevent.
  emitInstrumentationRecord({
    firePath: "divergence-sampling",
    fired,
    basis: trimmedBasis,
    mode: fired ? responseMode.mode : null,
    provenByAdversaryOnly: fired ? !!responseMode.provenByAdversaryOnly : false,
    divergenceScore: score,
  });

  return envelope;
}

/**
 * R-ARCH-2 protocol-class trigger on extend-existing-code signal.
 *
 * @param {object} input
 * @param {string} input.context - Description of the existing code being extended.
 * @param {string} input.basis   - The approach/premise being evaluated.
 * @param {object} [input.responseOpts] - Optional response mode options.
 * @returns {object} House-style envelope.
 */
function triggerExtendExistingCode(input) {
  const badInput = validateInput(input);
  if (badInput) return badInput;

  const { context, basis, responseOpts = {} } = input;

  if (!context || typeof context !== "string" || !context.trim()) {
    return { ok: false, error: "input.context must be a non-empty string" };
  }
  if (!basis || typeof basis !== "string" || !basis.trim()) {
    return { ok: false, error: "input.basis must be a non-empty string" };
  }

  const trimmedBasis = basis.trim();
  const responseMode = resolveResponseMode(responseOpts);

  const envelope = {
    ok: true,
    firePath: "protocol-class",
    fired: true, // ALWAYS fires — unconditional on this path (R-ARCH-2)
    basis: trimmedBasis,
    reason: "protocol-class:extend-existing", // DISTINCT from divergence path reason
    context: context.trim(),
    ...responseMode,
  };

  // Emit instrumentation. provenByAdversaryOnly + mode PERSISTED for the verify R-FAIL-2 gate (§4).
  emitInstrumentationRecord({
    firePath: "protocol-class",
    fired: true,
    basis: trimmedBasis,
    mode: responseMode.mode,
    provenByAdversaryOnly: !!responseMode.provenByAdversaryOnly,
    divergenceScore: null,
  });

  return envelope;
}

/**
 * Top-level resolver: dispatch to the appropriate fire path.
 *
 * The `type` field in input selects the path:
 *   "divergence-sampling"   → R-ARCH-1 (input.answers[] required)
 *   "extend-existing-code"  → R-ARCH-2 (input.context required)
 *
 * Bad input (missing type, unknown type, empty/whitespace/non-string fields) →
 * { ok:false, error } + non-zero CLI exit.
 *
 * @param {object} input
 * @returns {object} House-style envelope.
 */
function resolve(input) {
  const badInput = validateInput(input);
  if (badInput) return badInput;

  const { type } = input;

  if (!type || typeof type !== "string" || !type.trim()) {
    return { ok: false, error: 'input.type must be "divergence-sampling" or "extend-existing-code"' };
  }

  switch (type.trim()) {
    case "divergence-sampling":
      return triggerDivergenceSampling(input);
    case "extend-existing-code":
      return triggerExtendExistingCode(input);
    default:
      return {
        ok: false,
        error: `Unknown type "${type}". Expected "divergence-sampling" or "extend-existing-code"`,
      };
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
//
// Usage:
//   gsd-t-architectural-trigger trigger '{"type":"divergence-sampling","answers":[...],"basis":"..."}'
//   gsd-t-architectural-trigger trigger '{"type":"extend-existing-code","context":"...","basis":"..."}'
//
// Bad input → { ok:false, error } + non-zero exit.

if (require.main === module) {
  const args = process.argv.slice(2);

  function emit(obj) {
    process.stdout.write(JSON.stringify(obj) + "\n");
  }
  function emitError(msg, exitCode) {
    emit({ ok: false, error: msg });
    process.exit(exitCode);
  }

  const subcommand = args[0];
  if (!subcommand || subcommand.trim() === "") {
    emitError(
      'Missing subcommand. Usage: gsd-t-architectural-trigger trigger \'<JSON input>\'',
      64
    );
  }

  if (subcommand !== "trigger") {
    emitError(
      `Unknown subcommand "${subcommand}". Usage: gsd-t-architectural-trigger trigger '<JSON input>'`,
      64
    );
  }

  const rawInput = args[1];
  if (rawInput === undefined || rawInput === null || rawInput.trim() === "") {
    emitError(
      "Missing JSON input. Usage: gsd-t-architectural-trigger trigger '<JSON input>'",
      64
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(rawInput);
  } catch (e) {
    emitError(`Malformed JSON input: ${e.message}`, 64);
  }

  const result = resolve(parsed);
  emit(result);
  if (!result.ok) process.exit(1);
  // Success → exit 0
}

// ---------------------------------------------------------------------------
// Module exports (frozen §2 signature — DO NOT CHANGE after Wave 1 closes)
// ---------------------------------------------------------------------------

module.exports = {
  resolve,
  triggerDivergenceSampling,
  triggerExtendExistingCode,
  resolveResponseMode,
  computeDivergenceScore,
  DIVERGENCE_THRESHOLD,
};
