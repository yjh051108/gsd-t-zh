#!/usr/bin/env node
/**
 * GSD-T UserPromptSubmit hook — emits live timestamp + auto-routes plain text prompts.
 *
 * Receives JSON on stdin: { "prompt": "...", "cwd": "...", "session_id": "..." }
 * Outputs to stdout: injected as system context before Claude processes the prompt.
 *
 * Always emits (every turn, every project):
 *   - [GSD-T NOW] {Day: Mon DD, YYYY HH:MM:SS TZ} — live system clock for the
 *     dated banner at the top of Claude's response. Fresh per turn so multi-day
 *     sessions and date-rollovers are reflected accurately.
 *
 * Conditionally emits (GSD-T projects only — dirs with .gsd-t/):
 *   - [GSD-T PROFILE] {profile} — active model profile (M86). Gated like the
 *     statusline segment: a model profile is a GSD-T concept; announcing
 *     "premium (default)" in unrelated directories is noise (Red Team M86 LOW).
 *   - [GSD-T AUTO-ROUTE] signal so Claude routes via /gsd (plain text prompts
 *     in projects with .gsd-t/progress.md only)
 *
 * NOTE: resolveActiveProfile duplicates the read/validate logic of
 * readConfig() in bin/gsd-t-model-profile.cjs (the canonical copy) — kept
 * inline because this hook must be zero-dep and runs from ~/.claude/scripts
 * where the package module may be absent. Keep the two in sync.
 */

const fs = require("fs");
const path = require("path");

// Reader Contract — emitted every turn so the standard is in front of the model
// each response (not a selective after-the-fact gate). Concise + jargon-free by
// its own rule. Generic before/after examples teach the shape.
const READER_CONTRACT = [
  "[GSD-T READER CONTRACT] Before sending ANY reply, assume your first draft is too wordy and rewrite it tight. Rules:",
  "• Answer FIRST. No preamble, no restating the question, no narrating what you're about to do (\"let me check…\"). Do the work silently, then give the result.",
  "• Exception — when you're about to CHANGE code/files: state intent in one line first, so the user can stop a wrong direction.",
  "• Gloss every code/jargon term in plain words on first use. No bare IDs or acronyms the reader must decode.",
  "• Bullets/tables over paragraphs. Cut hedging and meta-commentary. Expand only if asked.",
  "EXAMPLES (before → after):",
  "• \"That's a great question, and it touches on something subtle. Let me look into how the cache works before I answer…\" → \"The cache lives in memory, cleared on restart.\"",
  "• \"There are a few moving parts here. First, I want to make sure I understand the goal, because X has a gotcha…\" → \"Set X in .env. Gotcha: also add the localhost redirect URI or it rejects.\"",
  "• \"Good catch — I conflated two things. Here's the honest correction: the files actually stack rather than overwrite…\" → \"You're right — files stack, they don't overwrite.\"",
].join("\n");

/**
 * Resolve the active model profile from .gsd-t/model-profile.json.
 *
 * Resilience contract (pre-mortem r1 #7 MEDIUM — hook resilience):
 *   - Resolver module/binary absent → named global default with (default) marker.
 *   - Resolver error / malformed config → named global default or "unknown" marker.
 *   - NEVER throws, NEVER suppresses the [GSD-T NOW] line, NEVER kills auto-routing.
 *
 * @param {string} cwd — project root (may be any dir; absent .gsd-t is fine)
 * @returns {{ profile: string, isDefault: boolean, configError?: string }}
 */
function resolveActiveProfile(cwd) {
  const GLOBAL_DEFAULT = 'premium';
  const VALID_PROFILES = ['standard', 'pro', 'premium'];

  try {
    const configPath = path.join(cwd, '.gsd-t', 'model-profile.json');
    if (!fs.existsSync(configPath)) {
      return { profile: GLOBAL_DEFAULT, isDefault: true };
    }

    let raw;
    try {
      raw = fs.readFileSync(configPath, 'utf8');
    } catch (_) {
      return { profile: GLOBAL_DEFAULT, isDefault: true, configError: 'unreadable' };
    }

    let config;
    try {
      config = JSON.parse(raw);
    } catch (_) {
      return { profile: GLOBAL_DEFAULT, isDefault: true, configError: 'invalid-json' };
    }

    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return { profile: GLOBAL_DEFAULT, isDefault: true, configError: 'wrong-type' };
    }

    const p = config.profile;
    if (typeof p !== 'string' || !VALID_PROFILES.includes(p)) {
      return { profile: GLOBAL_DEFAULT, isDefault: true, configError: 'unknown-profile' };
    }

    return { profile: p, isDefault: false };
  } catch (_) {
    // Catch-all: never crash the hook
    return { profile: GLOBAL_DEFAULT, isDefault: true };
  }
}

/**
 * Format the profile token for the banner.
 * SC(f): always named — never blank, never an unsurfaced fallback.
 */
function profileToken(profileResult) {
  if (!profileResult || typeof profileResult.profile !== 'string') {
    return 'profile: unknown';
  }
  if (profileResult.configError) {
    return `profile: ${profileResult.profile} (default, config-error: ${profileResult.configError})`;
  }
  if (profileResult.isDefault) {
    return `profile: ${profileResult.profile} (default)`;
  }
  return `profile: ${profileResult.profile}`;
}

function liveTimestamp(now = new Date()) {
  const day  = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][now.getDay()];
  const mon  = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][now.getMonth()];
  const pad  = (n) => String(n).padStart(2, "0");
  const date = `${day}: ${mon} ${now.getDate()}, ${now.getFullYear()}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  // Pull the local timezone abbreviation (e.g. "PDT", "EST") from toString().
  const tzMatch = now.toString().match(/\(([^)]+)\)$/);
  const tzShort = tzMatch
    ? tzMatch[1].split(" ").map((w) => w[0]).join("") // "Pacific Daylight Time" → "PDT"
    : "";
  return `${date} ${time}${tzShort ? " " + tzShort : ""}`;
}

// Hook runtime — guarded so require()-ing this module for unit tests
// (test/m86-surfacing.test.js) does NOT attach stdin listeners. An unguarded
// stdin listener holds the requiring test process's event loop open forever
// (npm test runner children get a never-EOF stdin pipe → suite hang), and the
// "end" handler's process.exit(0) would kill the test process on stdin EOF.
if (require.main === module) {
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  // Always emit live timestamp first — every turn, every project.
  // [GSD-T NOW] format is date-guard-invariant: NEVER alter it.
  process.stdout.write(`[GSD-T NOW] ${liveTimestamp()}\n`);

  // Reader Contract — injected EVERY turn, EVERY project (M93). The deterministic
  // brevity gate was retired (it could only ever be selective); this puts the
  // standard in front of the model each turn instead. Assume the first draft is
  // wordy; rewrite it tight before sending.
  process.stdout.write(READER_CONTRACT + "\n");

  // Parse stdin ONCE; both the profile token and auto-route reuse it.
  let data = null;
  try { data = JSON.parse(input); } catch (_) { /* tolerated — gates below skip */ }
  const cwd = (data && typeof data.cwd === "string" && data.cwd) ? data.cwd : process.cwd();

  // Emit the active model profile — GSD-T projects only (dirs with .gsd-t/),
  // matching the statusline gate. SC(f): named, never blank, never a crash.
  try {
    if (fs.existsSync(path.join(cwd, ".gsd-t"))) {
      const profileResult = resolveActiveProfile(cwd);
      process.stdout.write(`[GSD-T PROFILE] ${profileToken(profileResult)}\n`);
    }
  } catch (_) {
    // Belt-and-suspenders: if the gate or profileToken throws, emit the unknown marker.
    process.stdout.write(`[GSD-T PROFILE] profile: unknown\n`);
  }

  try {
    // Auto-route is GSD-T-project-only.
    if (!data) process.exit(0);
    if (!fs.existsSync(path.join(cwd, ".gsd-t", "progress.md"))) process.exit(0);
    const prompt = (typeof data.prompt === "string" ? data.prompt : "").trimStart();
    if (prompt.startsWith("/")) process.exit(0); // slash command — pass through
    if (!prompt) process.exit(0);                // empty prompt — pass through
    // Plain text prompt in a GSD-T project — inject routing signal
    process.stdout.write(
      "[GSD-T AUTO-ROUTE] The user typed a plain text message (no leading /). " +
      "Route it automatically through the /gsd smart router — execute the /gsd " +
      "command with the user's full message as the argument."
    );
  } catch {
    // JSON parse error or any other failure — never block the prompt
  }
  process.exit(0);
});
}

module.exports = { liveTimestamp, resolveActiveProfile, profileToken };
