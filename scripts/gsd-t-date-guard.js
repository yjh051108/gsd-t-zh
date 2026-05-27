#!/usr/bin/env node
/**
 * GSD-T PreToolUse hook — blocks Write/Edit calls that contain stale or invented timestamps.
 *
 * Receives JSON on stdin from Claude Code:
 *   {
 *     "tool_name": "Write" | "Edit",
 *     "tool_input": { "file_path": "...", "content"|"new_string"|"old_string": "..." },
 *     "cwd": "...",
 *     "session_id": "..."
 *   }
 *
 * Behavior:
 *   - Pulls system clock at hook execution time (independent of Claude's context).
 *   - Scans the content being written for date-like patterns (decision-log entries,
 *     filename timestamps, ISO date strings, "Day: Mon DD, YYYY" banners).
 *   - For Edit: only validates timestamps in `new_string` that are NOT also in `old_string`
 *     (so unchanged surrounding context never trips the guard).
 *   - For Write: validates timestamps that match high-signal "freshly stamped" patterns;
 *     ignores generic ISO matches in prose.
 *   - If any flagged timestamp is outside ±DRIFT_MINUTES of system clock, exit 2 with a
 *     structured error that surfaces back to Claude as a tool error.
 *
 * Exit codes:
 *   0 — content passes (no suspicious timestamps, or all within window)
 *   2 — block: stale/invented timestamp detected
 *
 * Allowlisted paths bypass entirely (machine-written files, transcripts, git internals).
 */

"use strict";

const fs = require("fs");
const path = require("path");

const DRIFT_MINUTES = 5;
const DRIFT_MS = DRIFT_MINUTES * 60 * 1000;

// Paths where dates are machine-written or historically frozen — never validate.
const ALLOWLIST_PATTERNS = [
  /\/\.git\//,
  /\/node_modules\//,
  /\.gsd-t\/events\/[\d-]+\.jsonl$/,
  /\.gsd-t\/transcripts\//,
  /\.gsd-t\/metrics\//,
  /\.gsd-t\/\.unattended\//,
  /\.gsd-t\/headless-\d+\.log$/,
  /\.gsd-t\/dashboard\.log$/,
  /\.gsd-t\/progress-archive\//,
  /\.gsd-t\/milestones\//,
  /\.gsd-t\/scan\//,
  /CHANGELOG\.md$/,
  /\.gsd-t\/token-log\.md$/,
  /\.gsd-t\/qa-issues\.md$/,
  /\.gsd-t\/continue-here-[\d-]+T[\d]+\.md$/, // Existing files; new ones validated by filename rule
];

// High-signal patterns — these are timestamps Claude is producing right now,
// not historical references inside prose.
const FRESH_STAMP_PATTERNS = [
  // Decision log entries: "- 2026-05-03 12:35: did the thing"
  {
    name: "decision-log",
    regex: /^- (\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):/gm,
    extract: (m) => new Date(
      Number(m[1]), Number(m[2]) - 1, Number(m[3]),
      Number(m[4]), Number(m[5]), 0
    ),
  },
  // continue-here filenames: "continue-here-2026-05-03T123500.md"
  {
    name: "continue-here-filename",
    regex: /continue-here-(\d{4})-(\d{2})-(\d{2})T(\d{2})(\d{2})(\d{2})/g,
    extract: (m) => new Date(
      Number(m[1]), Number(m[2]) - 1, Number(m[3]),
      Number(m[4]), Number(m[5]), Number(m[6])
    ),
  },
  // Session-banner format: "Sun: May 3, 2026 12:35 PDT"
  {
    name: "banner",
    regex: /(Sun|Mon|Tue|Wed|Thu|Fri|Sat): (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{4}) (\d{2}):(\d{2})/g,
    extract: (m) => {
      const monIdx = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(m[2]);
      return new Date(Number(m[4]), monIdx, Number(m[3]), Number(m[5]), Number(m[6]), 0);
    },
  },
];

// Generic ISO date — only validated when surrounded by strong "freshly stamping now"
// context (e.g., right after labels like the canonical frontmatter / metadata
// keys captured below).
// Two arms: (a) date+time (validated against full +/-DRIFT_MINUTES window),
//          (b) date-only (validated as same-calendar-day-as-now, time-of-day ignored).
//
// M59 (v3.29.10): time portion may carry an optional trailing TZ token —
// either a short abbreviation (PDT/PST/UTC/...), a numeric offset
// (+/-HH:MM or +/-HHMM), or Z. The TZ is matched but not used for drift
// math — drift is computed against the local clock, which already has the
// live offset.
const STAMPED_ISO_PATTERN = {
  name: "stamped-iso",
  regex: /\b(?:Date|Today|Stamped|Updated|Created|Generated|Now|Timestamp|At)\s*[:=]\s*(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2})?(?:\s+[A-Z]{2,5}|[+\-]\d{2}:?\d{2}|Z)?)?/gi,
  extract: (m) => {
    const hasTime = m[4] !== undefined;
    return {
      stamped: new Date(
        Number(m[1]), Number(m[2]) - 1, Number(m[3]),
        hasTime ? Number(m[4]) : 12, // Date-only -> noon, neutralizes timezone-edge false positives
        hasTime ? Number(m[5]) : 0,
        0
      ),
      dateOnly: !hasTime,
    };
  },
};

// M59 (v3.29.10): table cells in progress.md's "Completed Milestones" and
// "Session Log" tables now carry `YYYY-MM-DD HH:MM TZ`. We validate them
// against +/-DRIFT_MINUTES (treat as a fresh stamp). Date-only cells in
// pre-3.29.10 rows remain valid and are NOT flagged - those are historical
// (forward-only rule), so this regex requires the HH:MM portion to fire.
const PROGRESS_TABLE_CELL_PATTERN = {
  name: "progress-table-cell",
  regex: /\|\s*(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?:\s+[A-Z]{2,5})?\s*\|/g,
  extract: (m) => new Date(
    Number(m[1]), Number(m[2]) - 1, Number(m[3]),
    Number(m[4]), Number(m[5]), 0
  ),
};

function isAllowlisted(filePath) {
  if (!filePath) return false;
  return ALLOWLIST_PATTERNS.some((re) => re.test(filePath));
}

function findStaleTimestamps(content, now, oldContent) {
  if (!content || typeof content !== "string") return [];
  const findings = [];
  const oldText = typeof oldContent === "string" ? oldContent : "";

  const allPatterns = [...FRESH_STAMP_PATTERNS, STAMPED_ISO_PATTERN, PROGRESS_TABLE_CELL_PATTERN];

  for (const pattern of allPatterns) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match;
    while ((match = regex.exec(content)) !== null) {
      const fullMatch = match[0];
      // For Edit: skip matches that also appear in old_string (pre-existing).
      if (oldText && oldText.includes(fullMatch)) continue;

      let extracted;
      try { extracted = pattern.extract(match); } catch { continue; }
      if (!extracted) continue;

      // Normalize: extract may return a Date directly, or {stamped, dateOnly}.
      const stamped = extracted instanceof Date ? extracted : extracted.stamped;
      const dateOnly = !!(extracted && extracted.dateOnly);
      if (!stamped || isNaN(stamped.getTime())) continue;

      // Date-only stamps: validate same-calendar-day-as-now (drift in days, not minutes).
      if (dateOnly) {
        const sameDay = stamped.getFullYear() === now.getFullYear() &&
                        stamped.getMonth() === now.getMonth() &&
                        stamped.getDate() === now.getDate();
        if (!sameDay) {
          const dayDiff = Math.round((stamped.getTime() - now.getTime()) / 86400000);
          findings.push({
            pattern: pattern.name,
            matched: fullMatch,
            stamped: `${stamped.getFullYear()}-${String(stamped.getMonth()+1).padStart(2,'0')}-${String(stamped.getDate()).padStart(2,'0')}`,
            driftMinutes: Math.abs(dayDiff) * 1440,
            direction: dayDiff > 0 ? "future" : "past",
            note: `date-only stamp; ${Math.abs(dayDiff)} day(s) ${dayDiff > 0 ? "ahead of" : "behind"} today`,
          });
        }
        continue;
      }

      const driftMs = Math.abs(stamped.getTime() - now.getTime());
      if (driftMs > DRIFT_MS) {
        const driftMin = Math.round(driftMs / 60000);
        findings.push({
          pattern: pattern.name,
          matched: fullMatch,
          stamped: stamped.toISOString(),
          driftMinutes: driftMin,
          direction: stamped.getTime() > now.getTime() ? "future" : "past",
        });
      }
    }
  }
  return findings;
}

function nowBanner(now) {
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][now.getDay()];
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][now.getMonth()];
  const pad = (n) => String(n).padStart(2, "0");
  return `${day}: ${mon} ${now.getDate()}, ${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function formatBlock(findings, now) {
  const lines = [
    "[GSD-T DATE GUARD] Blocked — content contains timestamps that don't match the live system clock.",
    `Live system clock: ${now.toISOString()}  (${nowBanner(now)})`,
    `Tolerance: ±${DRIFT_MINUTES} minutes.`,
    "",
    "Stale or invented timestamps detected:",
  ];
  for (const f of findings) {
    lines.push(`  - [${f.pattern}] "${f.matched}" — stamped ${f.stamped} (${f.driftMinutes} min ${f.direction} of now)`);
  }
  lines.push("");
  lines.push("Fix: re-emit the write using the live system clock from `[GSD-T NOW]` in your context,");
  lines.push("or `node -e \"console.log(new Date().toISOString())\"` if the signal is unavailable.");
  lines.push("Never source timestamps from `currentDate` (frozen at session start) or memory.");
  return lines.join("\n");
}

function processInput(rawJson) {
  let payload;
  try { payload = JSON.parse(rawJson); } catch { return { ok: true }; }

  const tool = payload.tool_name;
  if (tool !== "Write" && tool !== "Edit") return { ok: true };

  const input = payload.tool_input || {};
  const filePath = input.file_path || "";

  // Allowlist check — bypass entirely for machine-written / historical-frozen paths.
  if (isAllowlisted(filePath)) return { ok: true };

  // Pull live system clock — independent of any signal in Claude's context.
  const now = new Date();

  let content, oldContent;
  if (tool === "Write") {
    content = input.content || "";
    oldContent = ""; // Write replaces — no diff context.
  } else { // Edit
    content = input.new_string || "";
    oldContent = input.old_string || "";
  }

  const findings = findStaleTimestamps(content, now, oldContent);
  if (findings.length === 0) return { ok: true };

  return { ok: false, message: formatBlock(findings, now) };
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  try {
    const result = processInput(input);
    if (result.ok) process.exit(0);
    process.stderr.write(result.message + "\n");
    process.exit(2);
  } catch (e) {
    // Never block on guard error — fail open. Drift is bad; broken tool calls are worse.
    process.stderr.write(`[GSD-T DATE GUARD] internal error (failing open): ${e.message}\n`);
    process.exit(0);
  }
});

module.exports = { findStaleTimestamps, isAllowlisted, processInput, DRIFT_MINUTES };
