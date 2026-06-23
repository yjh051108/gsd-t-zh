"use strict";

/**
 * gsd-t-guard-map-derive — M88 G2 (map-derivation-seam)
 *
 * The mechanical build→rule-map DERIVATION seam. Where M87 D1
 * (`bin/gsd-t-guard-map.cjs`) GATES a build→rule map, this module DERIVES that
 * map from two inputs — instead of hand-authoring it:
 *
 *   1. a PseudoCode doc  → the doc's derived RULE-ID set (via D1's parser,
 *      IMPORTED, never re-implemented — single source of truth for the grammar).
 *   2. a build-evidence manifest → which test assertions / files back (or
 *      contradict) which RULE-ID(s).
 *
 * Output: `{ rules: { <id>: { backedBy:[<refs>], contradicted:bool } } }`
 * keyed EXACTLY to the doc's derived RULE-ID set — EVERY doc rule present.
 * A rule with no evidence → `backedBy:[]` (PRESENT, unbacked) — NOT an omitted
 * key. Omitting it would re-open the map-side vacuous pass D1's gate closed
 * (the gate iterates the DOC's id set; an absent key is treated as unbacked, but
 * a faithful derivation must still emit every doc rule so the map is a complete,
 * gate-ready artifact).
 *
 * Evidence manifest shape (the convention this seam defines):
 *   {
 *     "evidence": [
 *       { "ref": "test/foo.test.js:42", "backs": ["R-PAYPAL-03", "R-PAYPAL-05"] },
 *       { "ref": "test/bar.test.js:7",  "contradicts": ["R-PAYPAL-07"] }
 *     ]
 *   }
 * - `ref` (string, required): a stable evidence reference (file:line, file::name, …).
 * - `backs` (string[], optional): RULE-IDs this evidence BACKS.
 * - `contradicts` (string[], optional): RULE-IDs this evidence CONTRADICTS
 *   (build/test asserts the negation of the invariant). Any contradiction on a
 *   rule sets its `contradicted:true` in the derived map.
 * An evidence entry that references a RULE-ID NOT in the doc's derived set is
 * IGNORED (the doc is the source of truth; phantom refs never invent map keys).
 *
 * Hard engineering bar (mirror D1 + M83): zero deps (Node built-ins only), never
 * throws (bad input → exitCode 64, never an uncaught throw), pure/read-only
 * (writes nothing). Deterministic — same doc bytes + same manifest → same map.
 *
 * Input:  --doc <PseudoCode-[Title].md> --evidence <manifest.json> [--json]
 * Output: the derived map JSON ({ rules: {...} }) on stdout.
 * Exit:   0 derivation succeeded · 64 bad input (unreadable doc, bad manifest,
 *         doc parse failure).
 */

const fs = require("node:fs");

// IMPORT D1's parser + RULE-ID derivation — the single source of truth for the
// `[RULE]` grammar. We consume `parseRules(md, docPath)`; we do NOT re-implement
// the grammar (a re-impl would drift from the gate that reads our output).
const { parseRules } = require("./gsd-t-guard-map.cjs");

// ─── derivation (pure) ─────────────────────────────────────────────────────

/**
 * Derive the build→rule map from a doc's derived RULE-ID set + an evidence
 * manifest. Doc-keyed: EVERY doc rule is emitted; an unbacked rule is
 * `backedBy:[]` present. Phantom evidence refs (RULE-IDs not in the doc) are
 * ignored. Pure — no I/O, never throws.
 *
 * @param {Array<{id:string}>} rules - parseRules().rules (doc-derived id set)
 * @param {{evidence?: Array<{ref?:string, backs?:string[], contradicts?:string[]}>}} manifest
 * @returns {{ rules: Object<string, {backedBy:string[], contradicted:boolean}> }}
 */
function deriveMap(rules, manifest) {
  // Seed every doc-derived id with an empty, unbacked, not-contradicted entry.
  // Iterating the DOC's id set (not the manifest) is what preserves doc-keyed
  // non-vacuity: a rule with zero evidence is PRESENT as backedBy:[].
  const out = { rules: {} };
  const docIds = new Set();
  for (const r of Array.isArray(rules) ? rules : []) {
    if (r && typeof r.id === "string") {
      docIds.add(r.id);
      if (!out.rules[r.id]) out.rules[r.id] = { backedBy: [], contradicted: false };
    }
  }

  const evidence = (manifest && Array.isArray(manifest.evidence)) ? manifest.evidence : [];
  for (const item of evidence) {
    if (!item || typeof item !== "object") continue;
    const ref = typeof item.ref === "string" ? item.ref : null;
    const backs = Array.isArray(item.backs) ? item.backs : [];
    const contradicts = Array.isArray(item.contradicts) ? item.contradicts : [];

    for (const id of backs) {
      // Only attach to a DOC-derived id (doc is the source of truth; phantom
      // ids never invent a key). A backing without a `ref` is meaningless — skip.
      if (typeof id === "string" && docIds.has(id) && ref) {
        const entry = out.rules[id];
        if (!entry.backedBy.includes(ref)) entry.backedBy.push(ref);
      }
    }
    for (const id of contradicts) {
      if (typeof id === "string" && docIds.has(id)) {
        out.rules[id].contradicted = true;
      }
    }
  }

  return out;
}

// ─── driver ────────────────────────────────────────────────────────────────

/**
 * Run the derivation over a doc + evidence manifest. Never throws — bad input
 * returns an envelope with exitCode 64. On success, `map` is the derived
 * build→rule map (gate-ready, consumable by gsd-t-guard-map.cjs unchanged).
 *
 * @param {{doc?:string, evidence?:string}} o
 * @returns {{ ok:boolean, exitCode:number, map?:object, derivedIds?:string[], ... }}
 */
function runDerive(o) {
  const { doc, evidence } = (o && typeof o === "object") ? o : {};
  if (!doc || !evidence || typeof doc !== "string" || typeof evidence !== "string") {
    return { ok: false, exitCode: 64, reason: "missing --doc and/or --evidence", doc: doc || null, evidence: evidence || null };
  }

  let md;
  try {
    md = fs.readFileSync(doc, "utf8");
  } catch (e) {
    return { ok: false, exitCode: 64, reason: `cannot read doc: ${e && e.message}`, doc };
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(evidence, "utf8"));
  } catch (e) {
    return { ok: false, exitCode: 64, reason: `cannot read/parse evidence JSON: ${e && e.message}`, evidence };
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return { ok: false, exitCode: 64, reason: "evidence JSON must be an object with an `evidence` array", evidence };
  }

  const { rules, parseErrors } = parseRules(md, doc);

  // A doc parse failure (empty-invariant rule) is bad input — the same severity
  // D1's gate assigns it. We cannot derive a faithful map from a malformed doc.
  if (parseErrors.length > 0) {
    return {
      ok: false,
      exitCode: 64,
      reason: `doc parse failure: ${parseErrors.length} rule line(s) yielded an empty invariant`,
      parseErrors,
      doc,
    };
  }

  const map = deriveMap(rules, manifest);
  const derivedIds = rules.map((r) => r.id);

  return { ok: true, exitCode: 0, doc, evidence, derivedIds, ruleCount: derivedIds.length, map };
}

// ─── CLI ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const o = { doc: null, evidence: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") o.help = true;
    else if (a === "--doc") o.doc = argv[++i];
    else if (a === "--evidence") o.evidence = argv[++i];
    else if (a === "--json") {/* default output is JSON */}
  }
  return o;
}

const HELP = `Usage: gsd-t guard-map-derive --doc <PseudoCode-[Title].md> --evidence <manifest.json> [--json]

The M88 build→rule-map DERIVATION seam. Parses every [RULE] from a PseudoCode
doc (via the M87 guard-map parser — single source of truth), then DERIVES the
build→rule map gsd-t-guard-map.cjs gates, attaching each evidence ref to the
RULE-ID(s) it backs/contradicts. The map is keyed EXACTLY to the doc's derived
id set — every doc rule present; an unbacked rule is backedBy:[] (never omitted).
The derived map prints to stdout and is valid --map input to the gate unchanged.

  --doc      PATH  the PseudoCode-[Title].md guard-map doc.
  --evidence PATH  the build-evidence manifest:
                   { "evidence": [ { "ref": "test/x.test.js:42",
                                     "backs": ["R-FOO-01"],
                                     "contradicts": ["R-FOO-02"] } ] }

Exit: 0 derivation succeeded (map on stdout) · 64 bad input (unreadable doc,
bad manifest, or doc parse failure).`;

function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) { process.stdout.write(HELP + "\n"); process.exit(0); }
  let res;
  try {
    res = runDerive(o);
  } catch (e) {
    // Defense in depth — runDerive is written never to throw, but the contract
    // mandates the module never throws, so bad input maps to 64 even here.
    res = { ok: false, exitCode: 64, reason: `derive-error: ${e && e.message}` };
  }
  // On success print the derived MAP (the artifact); on failure print the
  // diagnostic envelope. Either way, valid JSON to stdout.
  const payload = res.ok ? res.map : res;
  process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
  process.exit(res.exitCode);
}

if (require.main === module) main();

module.exports = { runDerive, deriveMap };
