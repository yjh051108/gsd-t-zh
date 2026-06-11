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
 *   - [GSD-T PROFILE] {profile} — active model profile (M86).
 *
 * Conditionally emits (GSD-T projects only, plain text prompts only):
 *   - [GSD-T AUTO-ROUTE] signal so Claude routes via /gsd
 */

const fs = require("fs");
const path = require("path");

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

  // Resolve cwd from parsed input (with fallback), then emit the profile token.
  // Both [GSD-T NOW] and [GSD-T PROFILE] are emitted on every turn — resilient.
  let cwd = process.cwd();
  try {
    const data = JSON.parse(input);
    if (typeof data.cwd === "string" && data.cwd) cwd = data.cwd;
  } catch (_) { /* parse error below will handle the rest */ }

  // Always emit active model profile — SC(f): named, never blank, never a crash.
  try {
    const profileResult = resolveActiveProfile(cwd);
    process.stdout.write(`[GSD-T PROFILE] ${profileToken(profileResult)}\n`);
  } catch (_) {
    // Belt-and-suspenders: if profileToken itself throws, emit the unknown marker.
    process.stdout.write(`[GSD-T PROFILE] profile: unknown\n`);
  }

  try {
    const data = JSON.parse(input);
    // Auto-route is GSD-T-project-only.
    const cwdFinal = typeof data.cwd === "string" ? data.cwd : process.cwd();
    if (!fs.existsSync(path.join(cwdFinal, ".gsd-t", "progress.md"))) process.exit(0);
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
