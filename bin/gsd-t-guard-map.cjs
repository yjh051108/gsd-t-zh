"use strict";

/**
 * gsd-t-guard-map — M87 D1 (guard-bridge-spike)
 *
 * The A1 kill-criterion gate. Turns a prose `[RULE]` guard map in a
 * `PseudoCode-[Title].md` doc into a machine-checkable verify gate where a
 * divergence (an UNBACKED or CONTRADICTED rule) is a DETERMINISTIC,
 * non-vacuous FAILURE — zero LLM judgment in the pass/fail decision.
 *
 * Contract: .gsd-t/contracts/pseudocode-source-of-truth-contract.md §2 (the
 * `[RULE]` guard-map grammar + RULE-ID derivation) + §7 (discovery convention).
 *
 * Grammar (§2, reconciled to the real binvoice corpus):
 *   A rule = any line CONTAINING the `[RULE …]` marker (matched ANYWHERE on the
 *   line, NOT `^`-anchored — the corpus places guard prose LEFT of the marker).
 *   Three accepted marker forms:
 *     ... [RULE] <RULE-ID>: <invariant>    # explicit id, invariant RIGHT
 *     GATE: ... → 409  [RULE] <invariant>  # loose, invariant RIGHT (PayPal style)
 *     <invariant prose> ... [RULE — <tag>] # tagged, invariant LEFT (Extension style)
 *   Invariant capture is SIDE-AGNOSTIC (§2 v1.1.3): RIGHT-of-`]` if non-empty,
 *   ELSE the LEFT-of-marker prose. An EMPTY resolved invariant = parse FAILURE.
 *   Rule id: explicit `<RULE-ID>:` if present, else DERIVE `R-<DOC-SLUG>-<NN>`
 *   by 1-based appearance order (pure — same doc bytes → same ids).
 *
 * Gate (DOC-keyed, §2 "Non-vacuity on the MAP side"): iterate the DOC's derived
 * RULE-ID set as the source of truth. For each doc rule:
 *   - map entry present + backedBy non-empty + !contradicted → backed (passes)
 *   - map entry unbacked (backedBy []) OR contradicted          → FAIL (exit 4)
 *   - map key ABSENT entirely                                   → UNBACKED → FAIL (exit 4)
 * An incomplete map that simply omits a doc rule can NEVER pass vacuously.
 *
 * Hard engineering bar (mirror M83 traceability-gate): zero deps (Node built-ins
 * only), never throws (bad input → exitCode 64, never an uncaught throw),
 * pure/read-only (writes nothing). Deterministic pass/fail — ZERO LLM judgment.
 *
 * Input:  --doc <path> --map <path> [--json]
 * Output: JSON envelope { ok, exitCode, ... }.
 * Exit:   0 every rule backed, none contradicted · 4 ≥1 unbacked/contradicted
 *         (names the RULE-ID) · 64 bad input.
 */

const fs = require("node:fs");
const path = require("node:path");

// ─── RULE marker grammar (§2) ─────────────────────────────────────────────

// The marker is `[RULE]` or `[RULE — <tag>]`. Matched ANYWHERE on the line
// (not `^`-anchored). Path-as-marker, never a bare "RULE" substring.
const MARKER_RE = /\[RULE(\s*—\s*[^\]]*)?\]/;

// An explicit id form: directly after `]`, `<RULE-ID>: <invariant>` where the
// id is an R-prefixed token (e.g. `R-PAYPAL-01`). Captured for id resolution.
const EXPLICIT_ID_RE = /^\s*(R-[A-Z0-9][A-Z0-9-]*)\s*:\s*(.*)$/i;

/**
 * Derive the DOC-SLUG from a doc filename: `PseudoCode-[Title].md` → uppercased
 * `[Title]` with non-alphanumerics collapsed (PAYPAL, EXTENSION). Pure.
 * @param {string} docPath
 * @returns {string}
 */
function docSlug(docPath) {
  const base = path.basename(String(docPath || ""), ".md");
  // Strip a leading "PseudoCode-" (case-insensitive) if present, else use whole base.
  let title = base.replace(/^pseudocode-/i, "");
  // Strip a trailing harness-variant suffix (e.g. `-doctored`) so a doctored COPY of a
  // subject derives the SAME DOC-SLUG as the faithful subject — the derived RULE-IDs must
  // stay STABLE between faithful and doctored runs (§2; the divergence lives only in the
  // map, never the doc text or its ids). `-doctored` is a test-harness variant of the same
  // subject (PayPal), not a distinct subject Title.
  title = title.replace(/-doctored$/i, "");
  return title.replace(/[^a-z0-9]+/gi, "").toUpperCase() || "DOC";
}

/**
 * Parse every `[RULE]` from a doc's text per §2.
 * Side-agnostic invariant capture, deterministic id resolution.
 * @param {string} md - the doc text
 * @param {string} docPath - used to derive the DOC-SLUG
 * @returns {{ rules: Array<{id, invariant, tag, explicit, line}>, parseErrors: Array<{line, raw}> }}
 */
function parseRules(md, docPath) {
  const slug = docSlug(docPath);
  const lines = String(md == null ? "" : md).split(/\r?\n/);
  const rules = [];
  const parseErrors = [];
  let n = 0; // 1-based appearance order, only incremented for real markers

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(MARKER_RE);
    if (!m) continue;

    n += 1;
    const markerStart = m.index;
    const markerEnd = m.index + m[0].length;
    const tag = m[1] ? m[1].replace(/^\s*—\s*/, "").trim() : null;

    const leftText = line.slice(0, markerStart).trim();
    const rightRaw = line.slice(markerEnd).trim();

    // Explicit id form: the RIGHT side begins `<RULE-ID>: <invariant>`.
    let id = `R-${slug}-${String(n).padStart(2, "0")}`;
    let explicit = false;
    let rightInvariant = rightRaw;
    const idm = rightRaw.match(EXPLICIT_ID_RE);
    if (idm) {
      id = idm[1].toUpperCase();
      explicit = true;
      rightInvariant = idm[2].trim();
    }

    // Side-agnostic capture: RIGHT-of-`]` if non-empty, else LEFT-of-marker prose.
    const invariant = (rightInvariant && rightInvariant.length > 0) ? rightInvariant : leftText;

    if (!invariant || invariant.length === 0) {
      // A rule whose resolved invariant is empty is a PARSE FAILURE (§2).
      parseErrors.push({ line: i + 1, raw: line.trim() });
      continue;
    }

    rules.push({ id, invariant, tag, explicit, line: i + 1 });
  }

  return { rules, parseErrors };
}

// ─── gate (DOC-keyed; §2 non-vacuity on the map side) ──────────────────────

/**
 * Gate a parsed doc against a build→rule map. Iterates the DOC's derived
 * RULE-ID set (NOT the map's keyset). A doc-derived id absent from the map is
 * treated as UNBACKED.
 * @param {Array} rules - parseRules().rules
 * @param {object} map - { rules: { <id>: { backedBy:[...], contradicted:bool } } }
 * @returns {{ violations: Array<{id, kind, detail}>, checked: number }}
 */
function gateRules(rules, map) {
  const mapRules = (map && map.rules && typeof map.rules === "object") ? map.rules : {};
  const violations = [];
  for (const r of rules) {
    const entry = mapRules[r.id];
    if (entry === undefined || entry === null) {
      // Key absent entirely → UNBACKED (doc-keyed iteration; no map-side vacuous pass).
      violations.push({
        id: r.id,
        kind: "unbacked",
        detail: `RULE ${r.id} ("${r.invariant}") has NO entry in the build→rule map — UNBACKED (a doc-derived rule absent from the map is unbacked, never a vacuous pass).`,
      });
      continue;
    }
    const backedBy = Array.isArray(entry.backedBy) ? entry.backedBy : [];
    const contradicted = entry.contradicted === true;
    if (contradicted) {
      violations.push({
        id: r.id,
        kind: "contradicted",
        detail: `RULE ${r.id} ("${r.invariant}") is CONTRADICTED — build/test evidence asserts the negation of the invariant (contract-breach divergence).`,
      });
    } else if (backedBy.length === 0) {
      violations.push({
        id: r.id,
        kind: "unbacked",
        detail: `RULE ${r.id} ("${r.invariant}") is UNBACKED — no test assertion references it (backedBy is empty).`,
      });
    }
  }
  return { violations, checked: rules.length };
}

// ─── driver ────────────────────────────────────────────────────────────────

function readJson(p) {
  const txt = fs.readFileSync(p, "utf8");
  return JSON.parse(txt);
}

/**
 * Run the gate over a doc + map. Never throws — bad input returns exitCode 64.
 * @param {{ doc, map }} o
 * @returns {{ ok, exitCode, ... }}
 */
function runGate(o) {
  const { doc, map } = (o && typeof o === "object") ? o : {};
  if (!doc || !map || typeof doc !== "string" || typeof map !== "string") {
    return { ok: false, exitCode: 64, reason: "missing --doc and/or --map", doc: doc || null, map: map || null };
  }

  let md;
  try {
    md = fs.readFileSync(doc, "utf8");
  } catch (e) {
    return { ok: false, exitCode: 64, reason: `cannot read doc: ${e && e.message}`, doc };
  }

  let mapObj;
  try {
    mapObj = readJson(map);
  } catch (e) {
    return { ok: false, exitCode: 64, reason: `cannot read/parse map JSON: ${e && e.message}`, map };
  }
  if (!mapObj || typeof mapObj !== "object" || mapObj.rules === undefined || typeof mapObj.rules !== "object" || mapObj.rules === null) {
    return { ok: false, exitCode: 64, reason: "map JSON has no `rules` object", map };
  }

  const { rules, parseErrors } = parseRules(md, doc);

  // A parse failure (empty-invariant rule) is bad input (the doc violates the grammar).
  if (parseErrors.length > 0) {
    return {
      ok: false,
      exitCode: 64,
      reason: `parse failure: ${parseErrors.length} rule line(s) yielded an empty invariant`,
      parseErrors,
      doc,
    };
  }

  const derivedIds = rules.map((r) => r.id);
  const { violations, checked } = gateRules(rules, mapObj);

  const ok = violations.length === 0;
  return {
    ok,
    exitCode: ok ? 0 : 4,
    doc,
    map,
    ruleCount: checked,
    derivedIds,
    rules: rules.map((r) => ({ id: r.id, invariant: r.invariant, tag: r.tag, explicit: r.explicit, line: r.line })),
    violations,
    ...(ok ? {} : { reason: `${violations.length} unbacked/contradicted rule(s): ${violations.map((v) => v.id).join(", ")}` }),
  };
}

// ─── CLI ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const o = { doc: null, map: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") o.help = true;
    else if (a === "--doc") o.doc = argv[++i];
    else if (a === "--map") o.map = argv[++i];
    else if (a === "--json") {/* default output is JSON */}
  }
  return o;
}

const HELP = `Usage: gsd-t guard-map --doc <PseudoCode-[Title].md> --map <build-map.json> [--json]

The M87 guard-map gate (A1). Enumerates every [RULE] from a PseudoCode doc per
the source-of-truth contract §2, then gates a build→rule map: exit non-zero when
a doc-derived RULE-ID is UNBACKED (backedBy empty, or key absent from the map) or
CONTRADICTED, naming the violated RULE-ID. Deterministic, zero LLM judgment.

  --doc PATH   the PseudoCode-[Title].md guard-map doc.
  --map PATH   the build→rule map JSON ({ "rules": { "<id>": { backedBy, contradicted } } }).

Exit: 0 all backed/none contradicted · 4 ≥1 unbacked/contradicted · 64 bad input.`;

function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) { process.stdout.write(HELP + "\n"); process.exit(0); }
  let res;
  try {
    res = runGate(o);
  } catch (e) {
    // Defense in depth — runGate is written never to throw, but the contract
    // mandates the module never throws, so bad input maps to 64 even here.
    res = { ok: false, exitCode: 64, reason: `gate-error: ${e && e.message}` };
  }
  process.stdout.write(JSON.stringify(res, null, 2) + "\n");
  process.exit(res.exitCode);
}

if (require.main === module) main();

module.exports = { runGate, parseRules, gateRules, docSlug, _internal: { MARKER_RE, EXPLICIT_ID_RE } };
