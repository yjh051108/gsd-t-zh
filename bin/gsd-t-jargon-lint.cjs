"use strict";

/**
 * gsd-t-jargon-lint — M93 D3 (the file-surface gate)
 *
 * A deterministic lint for WRITTEN docs — the surface the D1 Stop hook can't reach.
 * Documents (briefs, progress entries, contracts) fill with unglossed high-signal
 * jargon — `S2-M7`, `HC-003`, bare ALL-CAPS acronyms — and the real decision gets
 * buried. This lint FLAGS an unglossed first-occurrence jargon token (with its line)
 * so the author glosses it before commit. It NEVER auto-fixes (auto-glossing is LLM
 * judgment, out of scope) and it NEVER nags: only the FIRST occurrence of each
 * distinct token is checked, so a glossed-then-reused-bare token PASSES.
 *
 * Detection (high-signal tokens):
 *   - /\bS2-M\d+\b/          milestone-family code (e.g. S2-M7)
 *   - /\bHC-\d+\b/           contract / hard-constraint id (e.g. HC-003)
 *   - /\bM\d+(-D\d+(-T\d+)?)?\b/   GSD-T milestone/domain/task code (M93, M93-D3, M93-D3-T1)
 *   - /\b[A-Z]{3,}\b/        ALL-CAPS acronym (≥3) NOT in the allowlist
 *
 * A "gloss" for a token's first occurrence is any of:
 *   - an adjacent parenthetical `(...)` right after the token
 *   - an em-dash clause `— ...` after the token (same sentence)
 *   - any parenthetical / em-dash clause elsewhere in the SAME sentence
 *   - the acronym's expansion (the N capitalized words whose initials spell it)
 *
 * Conservative by design ([[feedback_coverage_check_structural_not_substring]]):
 *   - Skips fenced code blocks (```), and inline-code spans (`...`) — a token in
 *     code is a reference, not prose jargon.
 *   - Allowlist of common acronyms + an exempt-PATH list (mirrors the date-guard's
 *     ALLOWLIST_PATTERNS) so machine-written / archived files are never flagged.
 *
 * Hard engineering bar (mirror gsd-t-shrink-metric.cjs / gsd-t-guard-map.cjs):
 *   zero external deps (Node built-ins only), never throws (bad input → exitCode 64,
 *   never an uncaught throw), pure detection — ZERO LLM judgment.
 *
 * Exit: 0 clean · 4 unglossed token(s) found (named with line in --json) · 64 bad input.
 */

const fs = require("node:fs");

// ─── allowlist: exempt acronyms (never flagged) ────────────────────────────
// Conservative — common protocol/format/timezone/English caps so legitimate prose
// is never false-flagged. Extend only with truly universal acronyms.
const ACRONYM_ALLOWLIST = new Set([
  "GSD-T", "QA", "CLI", "API", "URL", "DB", "JSON", "JSONL", "NDJSON", "HTML",
  "CSS", "HTTP", "HTTPS", "DTO", "SQL", "PDT", "EST", "UTC", "PST", "AND", "OR",
  "NOT", "TODO", "FIXME", "README", "ID", "OK", "NPM", "CPUA",
  // M93 Red Team MEDIUM: common cloud / hardware / infra acronyms are ordinary
  // prose, not GSD-T jargon — exempt so the lint doesn't false-flag legit docs.
  "AWS", "GCP", "CPU", "GPU", "RAM", "ETL", "SDK", "IDE", "OS", "UI", "UX",
  "CI", "CD", "DNS", "TLS", "SSL", "SSH", "VM", "S3", "EC2", "RDS", "IAM",
  "REST", "RPC", "GRPC", "MCP", "LLM", "PR", "MR", "TTL", "EOL", "EOF", "ASCII",
  "UTF", "YAML", "TOML", "XML", "CSV", "PNG", "JPG", "SVG", "PDF", "DOM", "ENV",
]);

// ─── exempt PATHS (skip entirely — mirror gsd-t-date-guard ALLOWLIST_PATTERNS) ──
// Machine-written / archived / historically-frozen surfaces are not user-facing
// decision docs, so they are never linted.
const EXEMPT_PATH_PATTERNS = [
  /\.gsd-t\/milestones\//,
  /\.gsd-t\/events\//,
  /\.gsd-t\/transcripts\//,
  /node_modules\//,
  /\.git\//,
  /CHANGELOG\.md$/,
  /\.gsd-t\/token-log\.md$/,
];

function isExemptPath(p) {
  if (typeof p !== "string" || p === "") return false;
  return EXEMPT_PATH_PATTERNS.some((re) => re.test(p));
}

// ─── token detection ────────────────────────────────────────────────────────
// Order matters for classification only (we report the raw matched token regardless).
const TOKEN_PATTERNS = [
  { kind: "S2-M", regex: /\bS2-M\d+\b/g },
  { kind: "HC", regex: /\bHC-\d+\b/g },
  // M93 Red Team MEDIUM: require a GSD-T milestone shape, not a bare `M1`/`M4`
  // (motorway, chip, screw size — ordinary prose). A real milestone code is either
  // 2+ digits (M82+) OR carries a -D/-T domain/task suffix. Bare single-digit M\d
  // is NOT flagged.
  { kind: "M-code", regex: /\bM(?:\d{2,}|\d+-D\d+(?:-T\d+)?)\b/g },
  // Acronym ≥3 caps, optionally with hyphenated all-caps/digit segments so a
  // hyphenated form (GSD-T) matches WHOLE and is allowlist-checked as a unit — a
  // bare `\b[A-Z]{3,}\b` would catch only "GSD" inside "GSD-T" and false-flag it.
  { kind: "acronym", regex: /\b[A-Z]{3,}(?:-[A-Z0-9]+)*\b/g },
];

/**
 * Strip inline-code spans (`...`) from a single line so tokens inside them are
 * invisible to detection. Replaces the span (incl. backticks) with spaces of the
 * SAME length to preserve column/line geometry. Pure.
 * @param {string} line
 * @returns {string}
 */
function stripInlineCode(line) {
  // Match the shortest backtick-delimited span. Double-backtick spans (`` ` ``) too.
  return line.replace(/(`+)(?:.*?)\1/g, (m) => " ".repeat(m.length));
}

/**
 * Find all high-signal token matches on a (code-stripped) line.
 * @param {string} line
 * @returns {Array<{ token:string, index:number, kind:string }>}
 */
function findTokens(line) {
  const found = [];
  for (const { kind, regex } of TOKEN_PATTERNS) {
    regex.lastIndex = 0;
    let m;
    while ((m = regex.exec(line)) !== null) {
      const token = m[0];
      if (kind === "acronym" && ACRONYM_ALLOWLIST.has(token)) continue;
      // An acronym match that is part of an allowlisted hyphenated form (GSD-T) is
      // handled by the allowlist holding the full form; a bare "GSD" (≥3) would be
      // flagged, which is intended (bare GSD is unglossed jargon).
      found.push({ token, index: m.index, kind });
    }
  }
  return found;
}

// ─── gloss proximity ──────────────────────────────────────────────────────

/**
 * Extract the sentence containing a given character index from a line. We treat a
 * line as the gloss scope's outer bound and split on sentence terminators. Pure.
 * @param {string} line
 * @param {number} index
 * @returns {{ sentence:string, relIndex:number }}
 */
function sentenceAround(line, index) {
  // Split points: . ! ? followed by whitespace/end. Keep it simple + deterministic.
  let start = 0;
  let end = line.length;
  const term = /[.!?](?=\s|$)/g;
  let m;
  while ((m = term.exec(line)) !== null) {
    const pos = m.index + 1; // char after the terminator
    if (pos <= index) start = pos;
    else { end = pos; break; }
  }
  const sentence = line.slice(start, end);
  return { sentence, relIndex: index - start };
}

/**
 * Does the acronym's expansion appear adjacent to the token? An expansion is N
 * Capitalized words whose initials spell the acronym, appearing immediately before
 * the token inside a parenthetical OR immediately before/after the bare token.
 * Heuristic but conservative. Pure.
 * @param {string} sentence
 * @param {string} token  the acronym (already known to be ALL-CAPS)
 * @returns {boolean}
 */
function hasExpansion(sentence, token) {
  if (!/^[A-Z]+$/.test(token)) return false; // expansion check only for plain acronyms
  const letters = token.split("");
  // Build a regex of N Capitalized words: \bWord\s+Word\s+...\b matching the initials.
  // We scan all runs of >=N capitalized words and check any window spells the acronym.
  const wordRe = /\b([A-Z][a-z]+)\b/g;
  const words = [];
  let m;
  while ((m = wordRe.exec(sentence)) !== null) words.push(m[1]);
  if (words.length < letters.length) return false;
  for (let i = 0; i + letters.length <= words.length; i++) {
    let ok = true;
    for (let j = 0; j < letters.length; j++) {
      if (words[i + j][0] !== letters[j]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

/**
 * Is the token's first occurrence glossed? A gloss is:
 *   - a parenthetical `(...)` adjacent (immediately following, allowing whitespace/quote)
 *   - an em-dash clause after the token in the same sentence
 *   - any parenthetical anywhere in the same sentence
 *   - the acronym's expansion present in the sentence
 * Pure.
 * @param {string} line   the code-stripped line containing the token
 * @param {number} index  char index of the token on the line
 * @param {string} token
 * @param {string} kind
 * @returns {boolean}
 */
function isGlossed(line, index, token, kind) {
  const { sentence, relIndex } = sentenceAround(line, index);
  const after = sentence.slice(relIndex + token.length);

  // 1. Adjacent parenthetical immediately after the token (optionally past quotes/space).
  if (/^\s*["'“”]?\s*\([^)]*\)/.test(after)) return true;

  // 2. Em-dash clause after the token (—, --, or - surrounded by spaces).
  if (/^\s*(—|--|\s-\s)/.test(after)) return true;

  // 3. Any parenthetical anywhere in the same sentence (glosses the term in context).
  if (/\([^)]*\)/.test(sentence)) return true;

  // 4. Acronym expansion present in the sentence.
  if (kind === "acronym" && hasExpansion(sentence, token)) return true;

  return false;
}

// ─── line scanning with fence awareness ────────────────────────────────────

/**
 * Lint a document's text. Returns the list of unglossed first-occurrence tokens.
 * Pure; never throws.
 * @param {string} text
 * @returns {{ unglossed: Array<{ token:string, line:number, kind:string }>, tokensSeen:number }}
 */
function lintText(text) {
  const src = String(text == null ? "" : text);
  const lines = src.split(/\r?\n/);

  const seen = new Set();       // distinct tokens whose first occurrence we've judged
  const unglossed = [];
  let inFence = false;
  let tokensSeen = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].replace(/\r$/, "");

    // Fenced code block toggle: a line whose first non-space chars are ``` or ~~~.
    if (/^\s*(```|~~~)/.test(raw)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const codeStripped = stripInlineCode(raw);
    const tokens = findTokens(codeStripped);

    for (const t of tokens) {
      tokensSeen++;
      if (seen.has(t.token)) continue; // only the FIRST occurrence is judged — no nag
      seen.add(t.token);
      if (!isGlossed(codeStripped, t.index, t.token, t.kind)) {
        unglossed.push({ token: t.token, line: i + 1, kind: t.kind });
      }
    }
  }

  return { unglossed, tokensSeen };
}

// ─── driver ─────────────────────────────────────────────────────────────────

/**
 * Run the lint over options. Never throws — bad input → exitCode 64.
 * @param {{ file?:string, stdin?:boolean }} o
 * @returns {{ ok, exitCode, ... }}
 */
function runLint(o) {
  const opt = (o && typeof o === "object") ? o : {};
  const hasFile = typeof opt.file === "string" && opt.file.length > 0;
  const hasStdin = opt.stdin === true;

  if (!hasFile && !hasStdin) {
    return { ok: false, exitCode: 64, reason: "need --file <path> OR --stdin" };
  }
  if (hasFile && hasStdin) {
    return { ok: false, exitCode: 64, reason: "give EITHER --file OR --stdin, not both" };
  }

  // Exempt path → skip entirely (clean).
  if (hasFile && isExemptPath(opt.file)) {
    return { ok: true, exitCode: 0, skipped: true, reason: `exempt path: ${opt.file}`, source: `file:${opt.file}`, unglossed: [], count: 0 };
  }

  let text;
  let source;
  if (hasFile) {
    source = `file:${opt.file}`;
    try {
      text = fs.readFileSync(opt.file, "utf8");
    } catch (e) {
      return { ok: false, exitCode: 64, reason: `cannot read --file input: ${(e && e.message) || "unknown"}`, source };
    }
  } else {
    source = "stdin";
    try {
      text = fs.readFileSync(0, "utf8");
    } catch (e) {
      return { ok: false, exitCode: 64, reason: `cannot read stdin: ${(e && e.message) || "unknown"}`, source };
    }
  }

  const { unglossed, tokensSeen } = lintText(text);
  return {
    ok: unglossed.length === 0,
    exitCode: unglossed.length === 0 ? 0 : 4,
    source,
    unglossed,
    count: unglossed.length,
    tokensSeen,
  };
}

// ─── CLI ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const o = { file: null, stdin: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") o.help = true;
    else if (a === "--file") o.file = argv[++i];
    else if (a === "--stdin") o.stdin = true;
    else if (a === "--json") {/* default output is JSON */}
  }
  return o;
}

const HELP = `Usage:
  gsd-t jargon-lint --file <path>   [--json]
  gsd-t jargon-lint --stdin         [--json]

The M93 jargon-gloss lint (D3). Flags an unglossed FIRST-occurrence high-signal
jargon token in a written doc so it gets glossed before commit. Detects S2-M<n>,
HC-<n>, M<n>(-D<n>(-T<n>)) codes, and ALL-CAPS acronyms (>=3) not in the allowlist.
A token is "glossed" if its first occurrence has an adjacent parenthetical, an
em-dash clause, a same-sentence parenthetical, or the acronym's spelled-out
expansion. Skips code fences/inline-code spans. FLAGS, never auto-fixes. Conservative
allowlist + exempt-path list (mirrors the date-guard). Zero LLM judgment.

  --file PATH   lint a markdown/text file.
  --stdin       lint text on stdin.
  --json        emit the JSON envelope (default output is always JSON).

Exit: 0 clean · 4 unglossed token(s) (named with line in JSON) · 64 bad input.`;

function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) { process.stdout.write(HELP + "\n"); process.exit(0); }
  let res;
  try {
    res = runLint(o);
  } catch (e) {
    // Defense in depth — runLint is written never to throw; any escape maps to 64.
    res = { ok: false, exitCode: 64, reason: `lint-error: ${e && e.message}` };
  }
  process.stdout.write(JSON.stringify(res, null, 2) + "\n");
  process.exit(res.exitCode);
}

if (require.main === module) main();

module.exports = {
  runLint,
  lintText,
  findTokens,
  isGlossed,
  stripInlineCode,
  hasExpansion,
  isExemptPath,
  ACRONYM_ALLOWLIST,
  EXEMPT_PATH_PATTERNS,
};
