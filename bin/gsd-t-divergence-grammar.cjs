"use strict";

/**
 * gsd-t-divergence-grammar — M88 G4 (M91 Wave 3)
 *
 * The deterministic round-trip over the `⚠ Divergence` flag grammar.
 *
 * Contract: .gsd-t/contracts/pseudocode-source-of-truth-contract.md §4 — the
 * SINGLE source of truth for the grammar. This module IMPLEMENTS that spec; it
 * does NOT redefine it. The canonical §4 form is, EXACTLY:
 *
 *   ⚠ Divergence: <RULE-ID or section> — supersedes shipped <what>. Reason: <user intention>.
 *
 * ORIGIN: M87's D3 (`keep-or-supersede-subagent.md`) ships the keep-or-supersede
 * ASK and the prose WRITING of a `⚠ Divergence` flag on every supersede. That
 * makes the flag a string IN the doc — but not yet a code-checkable artifact.
 * This module closes that gap: a `⚠ Divergence` line round-trips
 * format→parse→format BYTE-STABLE, a malformed flag FAILS (named, no throw), and
 * the divergence COUNT over a doc is emitted as a checkable JSON integer that can
 * feed D1's guard-map rule set.
 *
 * Hard rules (contract §4 + domain constraints):
 *   - Zero external runtime deps.
 *   - Never throws. A parse failure is a RETURNED, NAMED error, not an exception
 *     (fail-closed).
 *   - Pure. parseDivergence / formatDivergence / countDivergences have no I/O and
 *     no side effects (the CLI wrapper at the bottom is the only I/O).
 *   - Round-trip is byte-stable: formatDivergence(parseDivergence(line).value)
 *     === line for every valid flag.
 *   - Structural marker parse, never a prose substring scan
 *     (feedback_coverage_check_structural_not_substring): countDivergences only
 *     counts lines that PARSE as a well-formed §4 flag, not lines that merely
 *     CONTAIN the substring "⚠ Divergence".
 *
 * CLI:
 *   --parse "<line>" --json     → { ok, value|error }
 *   --count <docPath> --json    → { ok, count }   (count is the checkable artifact)
 *
 * Exit: 0 ok · 4 parse failure / count error · 64 bad input.
 */

// --- §4 grammar literals (the EXACT canonical form — single source is the contract) ---
const PREFIX = "⚠ Divergence: ";          // "⚠ Divergence: "
const SEP_SUPERSEDES = " — supersedes shipped "; // " — supersedes shipped " (em-dash U+2014)
const SEP_REASON = ". Reason: ";
const SUFFIX = ".";

/**
 * Parse a single line as a §4 `⚠ Divergence` flag.
 *
 * Structural, anchored parse — NOT a substring scan. The line MUST be EXACTLY
 * `⚠ Divergence: <ref> — supersedes shipped <what>. Reason: <reason>.` with no
 * leading/trailing slop. Each field MUST be non-empty.
 *
 * @param {string} line
 * @returns {{ok: true, value: {ref: string, supersedes: string, reason: string}}
 *          | {ok: false, error: string}}  never throws.
 */
function parseDivergence(line) {
  if (typeof line !== "string") {
    return { ok: false, error: "not-a-string" };
  }
  // Anchored: must START with the prefix (no leading slop — structural, not substring).
  if (!line.startsWith(PREFIX)) {
    return { ok: false, error: "missing-prefix" };
  }
  // Must END with the trailing period.
  if (!line.endsWith(SUFFIX)) {
    return { ok: false, error: "missing-trailing-period" };
  }

  // ref ... " — supersedes shipped " ... <what>
  const afterPrefix = line.slice(PREFIX.length);
  const supIdx = afterPrefix.indexOf(SEP_SUPERSEDES);
  if (supIdx === -1) {
    return { ok: false, error: "missing-supersedes-clause" };
  }
  const ref = afterPrefix.slice(0, supIdx);
  const afterSup = afterPrefix.slice(supIdx + SEP_SUPERSEDES.length);

  // <what> ". Reason: " <reason> "."
  // Use the LAST ". Reason: " as the boundary so a <what> that itself contains
  // ". Reason: " can never steal the reason field (round-trip stays exact).
  const reasonIdx = afterSup.lastIndexOf(SEP_REASON);
  if (reasonIdx === -1) {
    return { ok: false, error: "missing-reason-clause" };
  }
  const supersedes = afterSup.slice(0, reasonIdx);
  // reason is everything between ". Reason: " and the final ".", which we have
  // already confirmed via endsWith(SUFFIX).
  const reasonWithDot = afterSup.slice(reasonIdx + SEP_REASON.length);
  const reason = reasonWithDot.slice(0, reasonWithDot.length - SUFFIX.length);

  // Every field MUST be non-empty (an empty field is a malformed flag).
  if (ref.length === 0) return { ok: false, error: "empty-ref" };
  if (supersedes.length === 0) return { ok: false, error: "empty-supersedes" };
  if (reason.length === 0) return { ok: false, error: "empty-reason" };

  return { ok: true, value: { ref, supersedes, reason } };
}

/**
 * Format a {ref, supersedes, reason} triple back into the canonical §4 line.
 *
 * @param {{ref: string, supersedes: string, reason: string}} obj
 * @returns {{ok: true, value: string} | {ok: false, error: string}}  never throws.
 */
function formatDivergence(obj) {
  if (obj === null || typeof obj !== "object") {
    return { ok: false, error: "not-an-object" };
  }
  const { ref, supersedes, reason } = obj;
  if (typeof ref !== "string" || ref.length === 0) {
    return { ok: false, error: "empty-ref" };
  }
  if (typeof supersedes !== "string" || supersedes.length === 0) {
    return { ok: false, error: "empty-supersedes" };
  }
  if (typeof reason !== "string" || reason.length === 0) {
    return { ok: false, error: "empty-reason" };
  }
  const value = PREFIX + ref + SEP_SUPERSEDES + supersedes + SEP_REASON + reason + SUFFIX;
  return { ok: true, value };
}

/**
 * Count the VALID `⚠ Divergence` flags in a document.
 *
 * Structural: a line is counted ONLY if it PARSES as a well-formed §4 flag — a
 * line that merely contains the substring "⚠ Divergence" but is malformed is NOT
 * counted (feedback_coverage_check_structural_not_substring). The returned count
 * is a deterministic integer (the checkable artifact that can feed D1's rule map).
 *
 * @param {string} docText
 * @returns {number} count of valid flags (0 on non-string input — never throws).
 */
function countDivergences(docText) {
  if (typeof docText !== "string") return 0;
  // Split on any newline style; trailing/leading whitespace on a line is slop,
  // so a flag line with surrounding whitespace will fail the anchored parse and
  // not be counted (matches the byte-stable round-trip invariant).
  const lines = docText.split(/\r\n|\r|\n/);
  let count = 0;
  for (const line of lines) {
    if (parseDivergence(line).ok) count++;
  }
  return count;
}

// --------------------------------------------------------------------------
// CLI wrapper (the only I/O; the three functions above are pure).
// --------------------------------------------------------------------------

const HELP = [
  "gsd-t-divergence-grammar — §4 ⚠ Divergence flag round-trip + count",
  "",
  "Usage:",
  '  gsd-t-divergence-grammar --parse "<line>" --json',
  "  gsd-t-divergence-grammar --count <docPath> --json",
  "",
  "Exit: 0 ok · 4 parse failure / count error · 64 bad input.",
].join("\n");

function parseArgs(argv) {
  const o = { json: false, help: false, parse: null, count: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") o.help = true;
    else if (a === "--json") o.json = true;
    else if (a === "--parse") o.parse = argv[++i];
    else if (a === "--count") o.count = argv[++i];
  }
  return o;
}

function main() {
  // Lazy require of fs ONLY inside the CLI path — the module export surface
  // stays pure/dep-free.
  const o = parseArgs(process.argv.slice(2));
  if (o.help) {
    process.stdout.write(HELP + "\n");
    process.exit(0);
  }

  if (o.parse != null) {
    const res = parseDivergence(o.parse);
    process.stdout.write(JSON.stringify(res, null, 2) + "\n");
    process.exit(res.ok ? 0 : 4);
  }

  if (o.count != null) {
    let text;
    try {
      text = require("fs").readFileSync(o.count, "utf8");
    } catch (e) {
      process.stdout.write(
        JSON.stringify({ ok: false, error: "read-failed", path: o.count }, null, 2) + "\n"
      );
      process.exit(4);
    }
    const count = countDivergences(text);
    // The count is a CHECKABLE JSON integer artifact, not prose.
    process.stdout.write(JSON.stringify({ ok: true, count }, null, 2) + "\n");
    process.exit(0);
  }

  process.stdout.write(JSON.stringify({ ok: false, error: "no-mode" }, null, 2) + "\n");
  process.exit(64);
}

if (require.main === module) main();

module.exports = { parseDivergence, formatDivergence, countDivergences };
