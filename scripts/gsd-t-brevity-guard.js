#!/usr/bin/env node
/**
 * GSD-T Stop hook — blocks exhausting ANSWER-mode replies before the user reads them.
 *
 * The deterministic enforcement the prose "be concise" rule never had: when the
 * assistant answers a question with stacked process-narration (intent-without-content)
 * preamble, or drops a bare unglossed high-signal jargon token, this hook BLOCKS the
 * stop and forces a rewrite (answer-first, glossed). Tuned CONSERVATIVE: catch only the
 * egregious cases (≥2 stacked narration sentences, or a bare high-signal token) — never
 * police word count, tone, or every acronym.
 *
 * ─── Stdin (Claude Code Stop hook payload) ───────────────────────────────────
 *   { "transcript_path": "...", "stop_hook_active": true|false,
 *     "session_id": "...", "hook_event_name": "Stop", "cwd": "..." }
 *
 * ─── Block contract (confirmed via Claude Code hooks docs) ────────────────────
 *   https://code.claude.com/docs/en/hooks.md
 *   A Stop hook blocks by writing `{"decision":"block","reason":"<why>"}` to stdout
 *   and exiting 0. `reason` is fed back to Claude as the instruction for what to fix
 *   (here: rewrite answer-first / gloss the term). We use THIS structured form (not
 *   exit-2-stderr) so the reason is delivered cleanly. Exit 0 with no JSON = allow.
 *
 * ─── Loop-guard ──────────────────────────────────────────────────────────────
 *   If `stop_hook_active === true` (this Stop is already a re-entry from a prior
 *   block), EXIT 0 immediately — never block twice on the same turn (no infinite
 *   rewrite loop).
 *
 * ─── Mode discriminator ──────────────────────────────────────────────────────
 *   ACTION-mode (about to change code: latest assistant turn carried a mutating
 *   tool_use — Write/Edit/NotebookEdit, or a Bash mutation — OR is a tool_use-only
 *   turn with empty text) → intent-first is WANTED → ALLOW.
 *   ANSWER-mode (a pure-text reply to a question) → enforce answer-first.
 *
 * ─── FAIL-OPEN (non-negotiable) ──────────────────────────────────────────────
 *   ANY internal error / unreadable transcript / malformed payload / no assistant
 *   message → EXIT 0 (allow). A broken guard must NEVER gag a legitimate reply.
 *
 * ─── CLI (unit-testable without a transcript) ────────────────────────────────
 *   node gsd-t-brevity-guard.js --text "<reply>" --mode answer|action
 *     → prints `{"decision":"block","reason":...}` + exit 1 on BLOCK,
 *       exit 0 (no output) on ALLOW. (CLI exit 1 ≠ hook exit; hook always exits 0.)
 *
 * ─── INTEGRATE-SEAM (do NOT wire here) ───────────────────────────────────────
 *   Add to ~/.claude/settings.json (and the installer settings template):
 *     "hooks": { "Stop": [ { "hooks": [ {
 *       "type": "command",
 *       "command": "node ~/.claude/scripts/hooks/gsd-t-brevity-guard.js"
 *     } ] } ] }
 *
 * Zero deps. Pure text analysis. Zero LLM. Never throws.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");

// ── Jargon allowlist (exempt acronyms — extend conservatively) ──────────────
const ALLOWLIST = new Set([
  "GSD-T", "QA", "CLI", "API", "URL", "DB", "JSON", "HTML", "CSS", "HTTP",
  "NDJSON", "DTO", "PDT", "EST", "UTC", "AND", "OR", "NOT",
]);

// High-signal code-token patterns (bare, unglossed → block on first use).
const JARGON_PATTERNS = [
  /\bS2-M\d+\b/,            // S2-M7
  /\bHC-\d+\b/,            // HC-003
  /\bM\d+(?:-D\d+(?:-T\d+)?)?\b/, // M92, M92-D1, M92-D1-T3
];

// Narration openers: first-person "about to" framing — intent without content.
const NARRATION_OPENER =
  /^(let me|before i\b|i'?ll\b|i'?m going to|i am going to|first,?\s+let me|i want to|i need to|let's|let us|going to)\b/i;

// ── Transcript tail-scan (REUSED from gsd-t-conversation-capture.js) ─────────
// Pull the most recent assistant turn from a Claude Code transcript JSONL by
// scanning from the tail. Returns { text, hasMutatingTool, toolOnly } or null.
// Distinguishes text blocks (the answer) from tool_use blocks (the action signal).
function _safeTranscriptPath(p) {
  if (typeof p !== "string" || p.length === 0) return null;
  if (!path.isAbsolute(p)) return null;
  const home = process.env.HOME || os.homedir();
  if (!home) return null;
  const allowedRoot = path.resolve(home, ".claude", "projects") + path.sep;
  const resolved = path.resolve(p);
  if (!resolved.startsWith(allowedRoot)) return null;
  return resolved;
}

function _readFileTail(filePath, bytes) {
  let fd = -1;
  try {
    const st = fs.statSync(filePath);
    if (!st.isFile()) return "";
    const size = st.size;
    if (size === 0) return "";
    const want = Math.min(bytes, size);
    const start = size - want;
    fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(want);
    fs.readSync(fd, buf, 0, want, start);
    let str = buf.toString("utf8");
    if (start > 0) {
      const nl = str.indexOf("\n");
      if (nl >= 0) str = str.slice(nl + 1);
    }
    return str;
  } catch (_) {
    return "";
  } finally {
    if (fd >= 0) { try { fs.closeSync(fd); } catch (_) { /* noop */ } }
  }
}

const MUTATING_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
// Bash command is a mutation if it invokes a write-ish verb (heuristic, conservative).
const BASH_MUTATION =
  /\b(rm|mv|cp|mkdir|touch|tee|chmod|chown|git\s+(commit|add|push|rm|mv|checkout|reset|merge|rebase)|npm\s+(install|i|publish|run)|node\s|>>?|sed\s+-i)\b/;

function _isMutatingToolBlock(b) {
  if (!b || b.type !== "tool_use") return false;
  if (MUTATING_TOOLS.has(b.name)) return true;
  if (b.name === "Bash") {
    const cmd = b.input && typeof b.input.command === "string" ? b.input.command : "";
    return BASH_MUTATION.test(cmd);
  }
  return false;
}

function _readAssistantFromTranscript(transcriptPath) {
  const safe = _safeTranscriptPath(transcriptPath);
  if (!safe) return null;
  const tail = _readFileTail(safe, 64 * 1024);
  if (!tail) return null;
  const lines = tail.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line) continue;
    let row;
    try { row = JSON.parse(line); } catch (_) { continue; }
    if (!row || row.type !== "assistant") continue;
    if (row.isSidechain === true) continue;
    const msg = row.message;
    if (!msg) continue;
    const blocks = msg.content;
    if (typeof blocks === "string") {
      return { text: blocks, hasMutatingTool: false, toolOnly: false };
    }
    if (!Array.isArray(blocks)) continue;
    const texts = [];
    let hasMutatingTool = false;
    let hasToolUse = false;
    for (const b of blocks) {
      if (b && b.type === "text" && typeof b.text === "string") texts.push(b.text);
      if (b && b.type === "tool_use") {
        hasToolUse = true;
        if (_isMutatingToolBlock(b)) hasMutatingTool = true;
      }
    }
    const text = texts.join("");
    if (text.length === 0 && !hasToolUse) continue; // empty, keep scanning
    return { text, hasMutatingTool, toolOnly: text.trim().length === 0 && hasToolUse };
  }
  return null;
}

// ── Detection (pure) ─────────────────────────────────────────────────────────

// Strip the dated status banner (first line, "Day: Mon DD, YYYY ... — GSD-T ...").
function _stripBanner(text) {
  const nl = text.indexOf("\n");
  const first = nl >= 0 ? text.slice(0, nl) : text;
  if (/^[A-Z][a-z]{2,8}:\s+\w{3}\s+\d{1,2},\s+\d{4}/.test(first.trim())) {
    return nl >= 0 ? text.slice(nl + 1) : "";
  }
  return text;
}

// Remove fenced code blocks and table rows (content, never preamble).
function _stripStructured(text) {
  const out = [];
  let inFence = false;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (/^```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    if (/^\|.*\|/.test(line)) continue; // table row
    out.push(raw);
  }
  return out.join("\n");
}

// Split prose into sentences (coarse — period/!/? or newline boundary).
function _sentences(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Count narration sentences in the LEADING region (before substantive content).
// A reply may open with ONE short acknowledgement/framing sentence (e.g. "Important
// question." / "Fair challenge.") — that's wanted, not preamble. But narration that
// STACKS after such an ack ("Let me find the record. Before I answer, I should check…")
// is the egregious case the user flagged. So: tolerate a single short non-narration
// lead sentence, then count narration; stop at the first substantive (non-narration,
// non-short-ack) sentence. Block fires at >=2 narration in that leading region.
function _leadingNarrationCount(prose) {
  const sentences = _sentences(prose);
  let count = 0;
  let ackUsed = false;
  for (const s of sentences) {
    if (NARRATION_OPENER.test(s)) { count++; continue; }
    // A short non-narration sentence (<= ~12 words) is treated as an allowed
    // acknowledgement/framing line ONCE; a second one, or any longer sentence,
    // is real content → the leading region ends.
    const words = s.trim().split(/\s+/).length;
    if (!ackUsed && words <= 12) { ackUsed = true; continue; }
    break;
  }
  return count;
}

// Find a bare unglossed high-signal jargon token (first occurrence, no gloss).
// A gloss = parenthetical or quote in the SAME sentence containing the token.
function _findBareJargon(prose) {
  const sentences = _sentences(prose);
  const seen = new Set();
  for (const s of sentences) {
    for (const re of JARGON_PATTERNS) {
      const m = s.match(re);
      if (!m) continue;
      const token = m[0];
      if (seen.has(token)) continue;
      // skip allowlisted ALL-CAPS lookalikes (none of these patterns are, but defensive)
      if (ALLOWLIST.has(token)) continue;
      seen.add(token);
      // Glossed if a parenthetical or quoted phrase appears in the same sentence.
      const hasGloss = /\([^)]*\)/.test(s) || /["“'][^"”']{4,}["”']/.test(s);
      if (!hasGloss) return token;
    }
  }
  return null;
}

// NOTE: bare ALL-CAPS acronyms (TTL, TLS, CDN, …) are intentionally NOT policed.
// The spec lists them but caps it "extend conservatively / do NOT police every
// acronym" — generic ALL-CAPS is a false-positive engine on common tech terms.
// Only the high-signal code-token patterns above (S2-M\d, HC-\d, M\d[-D\d][-T\d])
// are unambiguous jargon worth a forced gloss. The ALLOWLIST is retained for any
// future, deliberate extension of JARGON_PATTERNS into acronym territory.

// Core detector. mode: "answer" | "action". Returns { block, reason }.
function detect(text, mode) {
  if (mode === "action") return { block: false };
  if (typeof text !== "string" || text.trim().length === 0) return { block: false };

  const prose = _stripStructured(_stripBanner(text));

  const narration = _leadingNarrationCount(prose);
  if (narration >= 2) {
    return {
      block: true,
      reason: "Answer-first: lead with the answer, not " + narration +
        " stacked 'about-to' narration sentences. Cut the preamble; state the answer, then detail.",
    };
  }

  const jargon = _findBareJargon(prose);
  if (jargon) {
    return {
      block: true,
      reason: "Gloss '" + jargon + "' on first use (one plain-language clause in parens). Bare code-token, no gloss.",
    };
  }

  return { block: false };
}

// ── Mode classification from a transcript turn ───────────────────────────────
function classifyMode(turn) {
  if (turn && (turn.hasMutatingTool || turn.toolOnly)) return "action";
  return "answer";
}

// ── Entry: process a Stop-hook payload → { block, reason } ───────────────────
function processPayload(payload) {
  if (!payload || typeof payload !== "object") return { block: false }; // fail-open
  if (payload.stop_hook_active) return { block: false };                // loop-guard (truthy — never re-block a re-entry, even if the flag arrives non-boolean)
  const turn = _readAssistantFromTranscript(payload.transcript_path);
  if (!turn) return { block: false }; // no message → fail-open
  return detect(turn.text, classifyMode(turn));
}

// ── CLI / hook driver ────────────────────────────────────────────────────────
function _emitBlock(reason) {
  process.stdout.write(JSON.stringify({ decision: "block", reason }) + "\n");
}

function runCli(argv) {
  // --text "<reply>" --mode answer|action
  let text = null, mode = "answer";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--text") { text = argv[i + 1]; i++; }
    else if (argv[i] === "--mode") { mode = argv[i + 1]; i++; }
  }
  const res = detect(typeof text === "string" ? text : "", mode === "action" ? "action" : "answer");
  if (res.block) { _emitBlock(res.reason); process.exit(1); }
  process.exit(0);
}

function main() {
  try {
    const argv = process.argv.slice(2);
    if (argv.includes("--text")) { runCli(argv); return; }

    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => { input += c; });
    process.stdin.on("end", () => {
      try {
        let payload;
        try { payload = JSON.parse(input); } catch { process.exit(0); } // fail-open
        const res = processPayload(payload);
        if (res.block) { _emitBlock(res.reason); process.exit(0); } // block via JSON, exit 0
        process.exit(0); // allow
      } catch { process.exit(0); } // fail-open
    });
    process.stdin.on("error", () => process.exit(0)); // fail-open
  } catch { process.exit(0); } // fail-open
}

if (require.main === module) main();

module.exports = {
  detect, classifyMode, processPayload, _findBareJargon,
  _leadingNarrationCount, _readAssistantFromTranscript, ALLOWLIST,
};
