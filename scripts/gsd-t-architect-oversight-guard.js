#!/usr/bin/env node
/**
 * GSD-T PreToolUse hook (Write|Edit) — Architect's Oversight trigger (M101).
 *
 * The Architect's Oversight Doctrine lives in ~/.claude/CLAUDE.md, but a doctrine
 * carried in context can be MISSED under load. This hook fires the TRIGGER at the
 * exact moment it matters — right before code is written/edited — and injects a
 * ONE-LINE pointer back to the doctrine. It carries NO nuance (that stays in
 * CLAUDE.md); it only guarantees the Six-Stage Pass is CONSIDERED before a build.
 *
 * Design (mirrors the doctrine's §Enforcement three-layer split):
 *   - CLAUDE.md  = the definition (what the doctrine IS)
 *   - THIS hook  = the trigger    (don't forget it right now, no context bloat)
 *   - workflow   = the execution  (actually run the stages, with evidence)
 *
 * Receives JSON on stdin: { tool_name, tool_input: { file_path, ... }, cwd, ... }
 * Emits (stdout, PreToolUse additionalContext): a single reminder line, or nothing.
 *
 * NON-NEGOTIABLE: fail-open. Never block the tool, never throw, never exit non-zero.
 * A malformed payload, missing field, or any error → silent pass-through (exit 0,
 * no output). This hook can only ADD a reminder; it can never stop a write.
 *
 * Scope gates (emit ONLY when all hold), to avoid noise:
 *   1. GSD-T project — cwd contains .gsd-t/ (matches the auto-route/profile gate).
 *   2. The target is CODE, not prose — skip .md / .txt / pseudocode / docs, since
 *      the doctrine's own artifacts (CLAUDE.md, pseudocode, contracts) are writes
 *      too, and reminding while writing the reminder is noise. Code = the moment
 *      the Binvoice waste would have been caught.
 *
 * Zero-dep by design: runs from ~/.claude/scripts where the package may be absent.
 */

const fs = require("fs");
const path = require("path");

// One line. A pointer, not the doctrine. Keeps context cost ~nil.
const REMINDER =
  "[GSD-T ARCHITECT] About to write/edit code — run the Architect's Oversight " +
  "Six-Stage Pass FIRST (Objective → Conflict → Reuse[query the graph] → " +
  "Simplicity → Reuse-forecast → Risk), each answered with evidence not conviction. " +
  "Is this the simplest design, and does something reusable already exist? " +
  "See ~/.claude/CLAUDE.md § Architect's Oversight Doctrine.";

// File extensions that are PROSE/config, not code — skip the reminder for these.
// (The doctrine's own artifacts are markdown; reminding while authoring them is noise.)
const PROSE_EXT = new Set([
  ".md", ".markdown", ".txt", ".rst", ".adoc",
  ".json", ".yaml", ".yml", ".toml", ".lock",
  ".csv", ".tsv", ".svg", ".png", ".jpg", ".jpeg", ".gif", ".pdf",
]);

/**
 * Decide whether to emit the reminder for a given cwd + target file.
 * Pure + total: never throws, returns a boolean.
 * @param {string} cwd
 * @param {string} filePath — the Write/Edit target
 * @returns {boolean}
 */
function shouldRemind(cwd, filePath) {
  try {
    if (!cwd || typeof cwd !== "string") return false;
    // Gate 1 — GSD-T project only.
    if (!fs.existsSync(path.join(cwd, ".gsd-t"))) return false;
    // No target path → can't classify → stay quiet (fail-open toward silence).
    if (!filePath || typeof filePath !== "string") return false;

    const lower = filePath.toLowerCase();
    const ext = path.extname(lower);

    // Gate 2 — skip prose/config/asset writes (incl. the doctrine's own artifacts).
    if (PROSE_EXT.has(ext)) return false;
    // Skip anything under a docs/ or pseudocode/ tree even if code-extensioned.
    if (/[\\/](docs|pseudocode)[\\/]/.test(lower)) return false;

    return true;
  } catch (_) {
    return false; // fail-open: any error → no reminder, never block
  }
}

if (require.main === module) {
  let input = "";
  let done = false;
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => { input += c; });

  const finish = () => {
    if (done) return; // run once — whichever of end/error/watchdog fires first
    done = true;
    try {
      let data = null;
      try { data = JSON.parse(input); } catch (_) { process.exit(0); }
      if (!data || typeof data !== "object") process.exit(0);

      const cwd = (typeof data.cwd === "string" && data.cwd) ? data.cwd : process.cwd();
      const ti = data.tool_input && typeof data.tool_input === "object" ? data.tool_input : {};
      const filePath = typeof ti.file_path === "string" ? ti.file_path : "";

      if (shouldRemind(cwd, filePath)) {
        process.stdout.write(REMINDER + "\n");
      }
    } catch (_) {
      // Belt-and-suspenders: never block a write.
    }
    process.exit(0);
  };

  process.stdin.on("end", finish);
  process.stdin.on("error", finish); // stdin read error → fail-open, never hang
  // Watchdog: if stdin never delivers EOF (spawn-under-load edge, closed pipe),
  // proceed anyway with whatever we have. A hook must NEVER hang and block a write.
  const wd = setTimeout(finish, 1500);
  if (wd.unref) wd.unref(); // don't keep the event loop alive solely for the watchdog
}

module.exports = { shouldRemind, REMINDER };
