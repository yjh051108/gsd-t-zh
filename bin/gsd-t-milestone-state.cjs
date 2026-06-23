"use strict";

/**
 * gsd-t-milestone-state — M88 G1 (m88-signoff-state)
 *
 * A machine-checkable milestone sign-off STATE + the `isDefined(milestone)`
 * predicate. Today "DEFINED" is prose an LLM writes into `.gsd-t/progress.md` —
 * NOT a code-readable marker. This module reads a CONCRETE, structured sign-off
 * marker at the head of the detailed `PseudoCode-[Title].md` and decides, with
 * ZERO LLM judgment, whether a milestone's pseudocode set is signed off.
 *
 * The marker is a STRUCTURED front-matter HTML comment at the doc head:
 *
 *     <!-- signed-off: <ISO-date> by <author> -->
 *
 * It is PARSED by its structural form (regex on the marker shape), never by a
 * prose substring scan (`feedback_coverage_check_structural_not_substring`).
 * An absent OR malformed marker is FAIL-CLOSED → `signed:false` (never a crash,
 * never a vacuous pass). A skip is NEVER a silent default-off — `recordSkip`
 * emits an ASSERTABLE, greppable logged decision (`feedback_no_silent_degradation`).
 *
 * Contract: .gsd-t/contracts/pseudocode-source-of-truth-contract.md §1
 * (doc anatomy — the two altitudes; High-Level signed off FIRST, then Detailed).
 *
 * ── INTEGRATION NOTE (for a later doc-ripple pass — NOT done here) ──────────
 * This domain ships the predicate ONLY. It does NOT edit `commands/gsd-t-milestone.md`
 * (D3-owned). When that doc-ripple pass runs, the milestone command's "DEFINED"
 * emission should call `isDefined(<the milestone's detailed PseudoCode doc paths>)`
 * and refuse to flip a milestone to DEFINED until the predicate returns true —
 * replacing the prose "DEFINED" an LLM writes into progress.md with this
 * code-readable gate. A deliberate skip MUST route through `recordSkip` so the
 * decision is logged + greppable, never a silent default-off.
 *
 * Hard engineering bar (mirror M87 D1 guard-map): zero deps (Node built-ins
 * only), never throws (bad input → exitCode 64, never an uncaught throw),
 * pure/read-only (writes nothing). Deterministic — ZERO LLM judgment.
 *
 * CLI:
 *   --doc <path> [--json]                  → readSignoff over one detailed doc
 *   --docs <comma-list> [--json]           → isDefined over a doc set
 *   --skip <milestone> --reason <text>     → recordSkip (assertable decision)
 *
 * Exit: 0 signed / defined / skip-recorded · 4 unsigned / NOT-defined · 64 bad input.
 */

const fs = require("node:fs");

// ─── sign-off marker grammar (structural, NOT prose substring) ─────────────
//
// `<!-- signed-off: <ISO-date> by <author> -->`
//   <ISO-date> : YYYY-MM-DD, optionally with a time/zone tail (ISO 8601-ish).
//   <author>   : a non-empty author token/phrase (everything up to the `-->`).
//
// Anchored to the marker FORM, not to a "signed-off" substring anywhere in
// prose: the keyword must sit inside an `<!-- ... -->` HTML comment AND be
// followed by a structurally-valid date + ` by ` + non-empty author. A bare
// `<!-- signed-off: -->` (no date) does NOT match → fail-closed (unsigned).
const SIGNOFF_RE =
  /<!--\s*signed-off:\s*(\d{4}-\d{2}-\d{2}(?:[T ][0-9:.+\-Z]*)?)\s+by\s+(\S.*?)\s*-->/i;

/**
 * Parse the sign-off marker from a detailed doc's text. Structural-only.
 * @param {string} md - the doc text (may be null/undefined → unsigned).
 * @returns {{signed: boolean, date: (string|null), author: (string|null)}}
 */
function parseSignoff(md) {
  const text = md == null ? "" : String(md);
  const m = text.match(SIGNOFF_RE);
  if (!m) return { signed: false, date: null, author: null };
  const date = (m[1] || "").trim();
  const author = (m[2] || "").trim();
  // Defense in depth: both date AND a non-empty author are required. An empty
  // author (regex can't capture one) means malformed → fail-closed.
  if (!date || !author) return { signed: false, date: null, author: null };
  return { signed: true, date, author };
}

/**
 * Read the sign-off marker from a detailed PseudoCode doc on disk.
 * Never throws — an unreadable/missing path is fail-closed (unsigned).
 * @param {string} docPath
 * @returns {{signed: boolean, date: (string|null), author: (string|null), doc: (string|null), error?: string}}
 */
function readSignoff(docPath) {
  if (!docPath || typeof docPath !== "string") {
    return { signed: false, date: null, author: null, doc: null, error: "no doc path" };
  }
  let md;
  try {
    md = fs.readFileSync(docPath, "utf8");
  } catch (e) {
    // Missing / unreadable doc = NOT signed (fail-closed), never a throw.
    return { signed: false, date: null, author: null, doc: docPath, error: `cannot read doc: ${e && e.message}` };
  }
  const parsed = parseSignoff(md);
  return { ...parsed, doc: docPath };
}

/**
 * The `isDefined` predicate. A milestone's pseudocode is DEFINED IFF EVERY
 * detailed doc in the set carries a valid sign-off marker. ANY unsigned (or
 * absent/malformed) doc → NOT-DEFINED (false). An EMPTY set is NOT defined
 * (there is nothing signed off to define it — fail-closed, never vacuous-true).
 * @param {string[]} milestoneDocs - detailed PseudoCode doc paths.
 * @returns {{defined: boolean, total: number, signed: number, docs: Array, unsigned: string[]}}
 */
function isDefined(milestoneDocs) {
  const docs = Array.isArray(milestoneDocs) ? milestoneDocs : [];
  const results = docs.map((d) => readSignoff(d));
  const unsigned = results.filter((r) => !r.signed).map((r) => r.doc);
  const signedCount = results.length - unsigned.length;
  // Empty set → NOT defined (no signed docs ⇒ nothing defines the milestone).
  const defined = results.length > 0 && unsigned.length === 0;
  return {
    defined,
    total: results.length,
    signed: signedCount,
    docs: results.map((r) => ({ doc: r.doc, signed: r.signed, date: r.date, author: r.author })),
    unsigned,
  };
}

/**
 * Record a deliberate skip of the sign-off gate as an ASSERTABLE, greppable
 * logged decision — NEVER a silent default-off. Returns a structured object
 * whose `decision` line is a single greppable string containing the milestone
 * AND the reason (so a test / grep can prove the skip is observable).
 * @param {string} milestone - the milestone id being skipped.
 * @param {string} reason - the human-supplied justification (required).
 * @returns {{ok: boolean, kind: "milestone-signoff-skip", milestone: (string|null), reason: (string|null), decision: string}}
 */
function recordSkip(milestone, reason) {
  const ms = milestone == null ? "" : String(milestone).trim();
  const rs = reason == null ? "" : String(reason).trim();
  // A skip with no reason is itself fail-closed: still emitted + assertable, but
  // flagged ok:false so the gate cannot treat a reasonless skip as a clean pass.
  const ok = ms.length > 0 && rs.length > 0;
  const decision = `[GSD-T SIGNOFF-SKIP] milestone=${ms || "<none>"} reason=${rs || "<none>"}`;
  return { ok, kind: "milestone-signoff-skip", milestone: ms || null, reason: rs || null, decision };
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const o = { doc: null, docs: null, skip: null, reason: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") o.help = true;
    else if (a === "--doc") o.doc = argv[++i];
    else if (a === "--docs") o.docs = argv[++i];
    else if (a === "--skip") o.skip = argv[++i];
    else if (a === "--reason") o.reason = argv[++i];
    else if (a === "--json") {/* default output is JSON */}
  }
  return o;
}

const HELP = `Usage:
  gsd-t milestone-state --doc <PseudoCode-[Title].md> [--json]   read one doc's sign-off
  gsd-t milestone-state --docs <p1,p2,...> [--json]             isDefined over a set
  gsd-t milestone-state --skip <milestone> --reason <text>      record an assertable skip

The M88 milestone sign-off state. A milestone is NOT DEFINED until every detailed
PseudoCode-[Title].md carries a structured sign-off marker:

  <!-- signed-off: <ISO-date> by <author> -->

Parsing is structural (marker form), not a prose substring scan. An absent or
malformed marker is fail-closed (unsigned). A skip is a LOGGED, greppable
decision, never a silent default-off.

Exit: 0 signed/defined/skip-recorded · 4 unsigned/NOT-defined · 64 bad input.`;

/**
 * Run the CLI for one parsed arg set. Never throws — bad input → exitCode 64.
 * @param {object} o - parsed args.
 * @returns {{ok: boolean, exitCode: number, ...}}
 */
function runCli(o) {
  const opts = o && typeof o === "object" ? o : {};

  // recordSkip mode
  if (opts.skip != null) {
    const res = recordSkip(opts.skip, opts.reason);
    // A reasonless skip is bad input (64) — the decision is still emitted so it
    // stays assertable, but the gate must not treat it as a clean exit.
    return { ...res, exitCode: res.ok ? 0 : 64 };
  }

  // isDefined mode (a set of docs)
  if (opts.docs != null) {
    const list = String(opts.docs)
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (list.length === 0) {
      return { ok: false, exitCode: 64, reason: "--docs given but resolved to an empty list" };
    }
    const res = isDefined(list);
    return { ok: res.defined, exitCode: res.defined ? 0 : 4, ...res };
  }

  // readSignoff mode (one doc)
  if (opts.doc != null) {
    const res = readSignoff(opts.doc);
    return { ok: res.signed, exitCode: res.signed ? 0 : 4, ...res };
  }

  return { ok: false, exitCode: 64, reason: "no mode: pass --doc, --docs, or --skip" };
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) { process.stdout.write(HELP + "\n"); process.exit(0); }
  let res;
  try {
    res = runCli(o);
  } catch (e) {
    // Defense in depth — runCli is written never to throw; the contract mandates
    // the module never throws, so any unexpected error maps to 64.
    res = { ok: false, exitCode: 64, reason: `state-error: ${e && e.message}` };
  }
  process.stdout.write(JSON.stringify(res, null, 2) + "\n");
  process.exit(res.exitCode);
}

if (require.main === module) main();

module.exports = {
  readSignoff,
  parseSignoff,
  isDefined,
  recordSkip,
  runCli,
  _internal: { SIGNOFF_RE },
};
