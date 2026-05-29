/**
 * Shared helper: map a `claude -p` process exit code + output to the
 * GSD-T headless exit-code contract.
 *
 * Lives in its own file so non-entry modules (e.g. gsd-t-unattended.cjs)
 * can require it without pulling in the full CLI at bin/gsd-t.js. That
 * decoupling lets PROJECT_BIN_TOOLS ship the supervisor without also
 * vendoring the CLI itself — projects resolve `gsd-t` from the global
 * install, not from a project-local copy.
 *
 * Exit codes (contract):
 *   0 — success
 *   1 — verification/test failure
 *   2 — context budget exceeded
 *   3 — non-zero process exit (other)
 *   4 — blocked / needs human
 *   5 — unknown slash command (claude -p exited 0 but rejected the prompt)
 */

"use strict";

// Match terminal markers, not narration. A bare "tests failed" substring will
// appear in healthy output ("0 tests failed", "no tests failed", quoted as an
// example in prose). Require either a non-zero count prefix or a structured
// terminal marker (start of line, uppercase-FAIL prefix, Jest-style summary).
// Bug history: M45 worker output contained "tests failed" 6× in narration,
// causing the supervisor to map exit 0 → exit 1 and halt a successful run.

const NONZERO_FAILURE_COUNT_RE =
  /(?:^|\b)([1-9]\d*)\s+(?:tests?|specs?|assertions?|examples?|suites?)\s+failed\b/i;
const STRUCTURED_FAIL_RE = /^FAIL[:\s]/m;
const JEST_SUMMARY_FAIL_RE = /^Tests:\s+\d+\s+failed/im;

// Verification-phrase matchers: require the phrase at a line boundary or
// preceded by a sentence-start punctuation — not mid-prose. Each phrase is
// distinctive enough that start-of-line / post-punctuation is a reliable
// terminal-marker signal.
const VERIFICATION_FAILED_RE =
  /(?:^|[.!?]\s+)(?:verification|verify|quality gate)\s+failed\b/im;

// Context-budget phrases — same polarity discipline. Tolerant of surrounding
// punctuation (— / :) but requires the phrase at a line boundary.
const CONTEXT_BUDGET_RE =
  /(?:^|[.!?]\s+)(?:context budget exceeded|context window exceeded|budget exceeded|token limit)\b/im;

// Blocker compound: "blocked" within 80 chars of a human-gate phrase, both
// anchored to recognizable boundaries. The 80-char proximity keeps unrelated
// mentions from compounding.
const BLOCKED_HUMAN_RE =
  /\bblocked\b[\s\S]{0,80}?\b(?:needs? human|human input|human approval)\b/i;

function mapHeadlessExitCode(processExitCode, output) {
  if (processExitCode !== 0 && processExitCode !== null) return 3;
  const raw = output || "";
  if (/^unknown command:/im.test(raw)) return 5;
  if (CONTEXT_BUDGET_RE.test(raw)) return 2;
  if (BLOCKED_HUMAN_RE.test(raw)) return 4;
  if (
    VERIFICATION_FAILED_RE.test(raw) ||
    NONZERO_FAILURE_COUNT_RE.test(raw) ||
    STRUCTURED_FAIL_RE.test(raw) ||
    JEST_SUMMARY_FAIL_RE.test(raw)
  ) return 1;
  return 0;
}

module.exports = { mapHeadlessExitCode };
