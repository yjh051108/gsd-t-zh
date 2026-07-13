#!/usr/bin/env node
"use strict";
/**
 * gsd-t-graph-availability.cjs — the ONE shared graph-availability classifier.
 *
 * Splits a graph-query failure into ABSENT (never indexed → auto-build then continue)
 * vs BROKEN (missing dep / corrupt store / crash → HALT, demand a fix). Every consumer
 * (the 8 workflows + file-disjointness) routes its `ok:false` envelope's `reason` through
 * this ONE helper instead of re-implementing the string check.
 *
 * Reason codes (produced at the two seams — gsd-t-graph-query-cli.cjs + gsd-t.js
 * _graphQueryCli):
 *   "graph-absent"  → no store on disk yet (never indexed)          → ABSENT
 *   "graph-broken"  → store present-but-unreadable / CLI crash / corrupt → BROKEN
 *
 * [RULE] one-availability-classifier — the absent-vs-broken decision lives HERE, once.
 * [RULE] unknown-reason-fails-closed-to-broken — any unrecognised reason (incl. the
 *   legacy "graph-unavailable") classifies as BROKEN/HALT, never ABSENT/continue.
 * [RULE] false-broken-guarded — a transient failure (SQLITE_BUSY / timeout) is
 *   retry-eligible; callers retry ONCE before classifying BROKEN.
 */

const ABSENT = { state: "ABSENT", action: "auto-build-then-continue" };
const BROKEN = { state: "BROKEN", action: "HALT-demand-fix" };

/**
 * classifyGraphFailure(reason) → { state, action }.
 * Fail-closed: anything that is not exactly "graph-absent" is BROKEN.
 *
 * @param {string} reason  the `reason` field of an `ok:false` graph envelope
 * @returns {{ state: "ABSENT"|"BROKEN", action: string }}
 */
function classifyGraphFailure(reason) {
  if (reason === "graph-absent") return { ...ABSENT };
  if (reason === "graph-broken") return { ...BROKEN };
  // [RULE] unknown-reason-fails-closed-to-broken — legacy "graph-unavailable" and
  // any unknown reason HALT rather than silently continue.
  return { ...BROKEN };
}

/**
 * isTransient(detail) → boolean.
 * A transient failure (DB lock / timeout) may resolve on a retry, so a slow or
 * locked query must not wrongly HALT all work. Callers retry ONCE, then classify.
 * [RULE] false-broken-guarded
 *
 * @param {string} detail  the `detail` field of the failing envelope (or stderr)
 * @returns {boolean}
 */
function isTransient(detail) {
  if (!detail || typeof detail !== "string") return false;
  return /SQLITE_BUSY|database is locked|ETIMEDOUT|timed?\s*out|timeout/i.test(detail);
}

module.exports = { classifyGraphFailure, isTransient };

// ─── CLI arm (Bash-invokable — the sandboxed workflows call this, not require) ───
// Usage: node bin/gsd-t-graph-availability.cjs classify <reason> [detail]
// Prints a JSON envelope: { ok:true, state, action, transient }
if (require.main === module) {
  const [, , sub, reason, detail] = process.argv;
  if (sub === "classify") {
    const c = classifyGraphFailure(reason);
    const out = { ok: true, reason: reason || null, state: c.state, action: c.action, transient: isTransient(detail) };
    process.stdout.write(JSON.stringify(out) + "\n");
    process.exit(0);
  }
  process.stdout.write(JSON.stringify({ ok: false, reason: "unknown-subcommand", usage: "classify <reason> [detail]" }) + "\n");
  process.exit(1);
}
