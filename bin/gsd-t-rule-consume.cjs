"use strict";

/**
 * gsd-t-rule-consume — M88 G3 (triad-consumption seam)
 *
 * The DETERMINISTIC half of the A5 reframe. A5 once read "the `[RULE]` set is
 * consumed by verify's QA + Red Team frames" — a non-deterministic LIVE-triad
 * observation. This module reframes the CONSUMER side as a pure, deterministic
 * seam: given the guard-map JSON (`{rules:{<id>:...}}` from gsd-t-guard-map.cjs),
 * it surfaces the RULE-ID set that each verify frame must ingest.
 *
 * The seam invariant (A5): EVERY rule id in the map surfaces in BOTH frames —
 *   - `qa`      → the QA contract-compliance frame (each rule = a compliance assertion)
 *   - `redTeam` → the Red Team attack-surface frame (each rule = an invariant to attack)
 * A rule that reaches the map but is DROPPED from either frame breaks the seam
 * (the rule set failed to reach the whole triad). The killing test asserts this.
 *
 * Hard engineering bar (mirror gsd-t-guard-map.cjs): zero deps (Node built-ins
 * only), NEVER throws, pure/read-only (writes nothing). Fail-closed: an
 * empty/malformed map yields EMPTY frame sets (`{qa:[], redTeam:[]}`), never a
 * throw and never a phantom id.
 *
 * Input:  --map <path> [--json]
 * Output: JSON envelope { ok, exitCode, qa, redTeam, ... }.
 * Exit:   0 ok (sets surfaced, possibly empty) · 64 bad input (cannot read map).
 */

const fs = require("node:fs");

/**
 * Extract the ordered, de-duplicated RULE-ID set from a guard-map object.
 * Pure. Never throws. A non-object, a missing/non-object `rules`, or a
 * malformed shape → empty array (fail-closed — no phantom ids).
 * @param {*} map - parsed guard-map object ({ rules: { <id>: {...} } })
 * @returns {string[]} the rule ids in stable insertion order, de-duplicated
 */
function ruleIds(map) {
  if (!map || typeof map !== "object") return [];
  const rules = map.rules;
  if (!rules || typeof rules !== "object") return [];
  const seen = new Set();
  const ids = [];
  for (const key of Object.keys(rules)) {
    const id = String(key);
    if (id.length === 0 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/**
 * Surface the rule-id set into BOTH verify frames. Pure. The seam: every id
 * appears in `qa` AND `redTeam` — same set, two frame views. A dropped id in
 * either frame is the failure the seam-check catches.
 * @param {*} map - parsed guard-map object
 * @returns {{ qa: string[], redTeam: string[] }}
 */
function consume(map) {
  const ids = ruleIds(map);
  // Independent copies so a mutation of one frame can never silently alias the other.
  return { qa: ids.slice(), redTeam: ids.slice() };
}

// ─── driver ────────────────────────────────────────────────────────────────

/**
 * Run the consumer over a map path. Never throws — bad input → exitCode 64
 * with EMPTY frame sets (fail-closed).
 * @param {{ map: string|null }} o
 * @returns {{ ok, exitCode, qa, redTeam, ... }}
 */
function runConsume(o) {
  const { map } = (o && typeof o === "object") ? o : {};
  if (!map || typeof map !== "string") {
    return { ok: false, exitCode: 64, reason: "missing --map", qa: [], redTeam: [], map: map || null };
  }

  let mapObj;
  try {
    mapObj = JSON.parse(fs.readFileSync(map, "utf8"));
  } catch (e) {
    // Fail-closed: unreadable / unparseable map → empty sets, no throw.
    return { ok: false, exitCode: 64, reason: `cannot read/parse map JSON: ${e && e.message}`, qa: [], redTeam: [], map };
  }

  const frames = consume(mapObj);
  return {
    ok: true,
    exitCode: 0,
    map,
    ruleCount: frames.qa.length,
    qa: frames.qa,
    redTeam: frames.redTeam,
  };
}

// ─── CLI ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const o = { map: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") o.help = true;
    else if (a === "--map") o.map = argv[++i];
    else if (a === "--json") {/* default output is JSON */}
  }
  return o;
}

const HELP = `Usage: gsd-t rule-consume --map <guard-map.json> [--json]

The M88 G3 triad-consumption seam (A5). Reads the guard-map JSON and surfaces
the RULE-ID set into both verify frames — every id appears in BOTH the QA
contract-compliance frame and the Red Team attack-surface frame. A dropped id
breaks the seam (caught by test/m88-triad-consumption-seam.test.js).
Deterministic, zero LLM judgment, fail-closed (empty/malformed map → empty sets).

  --map PATH   the guard-map JSON ({ "rules": { "<id>": {...} } }).

Output: { "ok", "exitCode", "qa": [...ids], "redTeam": [...ids] }.
Exit: 0 ok (sets surfaced) · 64 bad input (map unreadable → empty sets).`;

function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) { process.stdout.write(HELP + "\n"); process.exit(0); }
  let res;
  try {
    res = runConsume(o);
  } catch (e) {
    // Defense in depth — runConsume never throws, but the contract mandates the
    // module never throws, so any escape maps to 64 with empty sets.
    res = { ok: false, exitCode: 64, reason: `consume-error: ${e && e.message}`, qa: [], redTeam: [] };
  }
  process.stdout.write(JSON.stringify(res, null, 2) + "\n");
  process.exit(res.exitCode);
}

if (require.main === module) main();

module.exports = { runConsume, consume, ruleIds };
