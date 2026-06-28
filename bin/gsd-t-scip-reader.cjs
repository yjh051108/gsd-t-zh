/**
 * gsd-t-scip-reader.cjs
 *
 * M95 — Read a SCIP index (`index.scip`, a protobuf emitted by scip-typescript /
 * scip-python) and turn it into the data the graph needs to RESOLVE call edges:
 *
 *   1. symbolToDef : Map<scipSymbol, funcId>      — where each symbol is DEFINED
 *   2. fileRefs    : Map<relPath, Array<{symbol, funcId, line}>>  — every
 *      reference occurrence in that file, already resolved to the def funcId
 *
 * A funcId is the graph's canonical `relPath#funcName` (line-suffix dropped here;
 * the indexer keys call edges on `relPath#name`-style ids — see resolveCallEdges).
 *
 * Why this exists: before M95 the SCIP "upgrade" only RAN scip-typescript and
 * relabelled the tree-sitter edges 'compiler-accurate' without reading the output.
 * This module reads the output so call targets actually resolve across files.
 *
 * The SCIP protobuf decoder is the one bundled inside scip-typescript
 * (`dist/src/scip.js`). scip-typescript is a GSD-T install requirement (M95), so
 * depending on its bundled decoder is legitimate. We locate it across install
 * layouts and FAIL LOUD if absent (never silently degrade).
 *
 * [RULE] scip-resolution-reads-real-output  — edges are derived from the .scip
 *        protobuf, never relabelled-in-place.
 * [RULE] scip-symbol-to-funcid-deterministic — same .scip → same funcId map.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

// ── Locate scip-typescript's bundled SCIP protobuf decoder ───────────────────
let _scipProto = null;

/**
 * Load the bundled `scip.js` protobuf namespace from scip-typescript.
 * Searches: local node_modules → global npm root → NODE_PATH.
 * @returns {object|null} the `scip` namespace (Index, Document, …) or null.
 */
function loadScipProto() {
  if (_scipProto) return _scipProto;

  const candidates = [];
  // 1. local node_modules (if scip-typescript is a project dep)
  try {
    candidates.push(require.resolve('@sourcegraph/scip-typescript/dist/src/scip.js'));
  } catch { /* not local */ }
  // 2. global npm root
  try {
    const groot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    candidates.push(path.join(groot, '@sourcegraph/scip-typescript/dist/src/scip.js'));
  } catch { /* npm not reachable */ }

  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        const mod = require(c);
        _scipProto = mod.scip || mod;
        if (_scipProto && _scipProto.Index) return _scipProto;
      }
    } catch { /* try next */ }
  }
  return null;
}

// ── SCIP symbol → function name ──────────────────────────────────────────────
// A SCIP symbol looks like:
//   "scip-typescript npm <pkg> <ver> src/`calc.ts`/computeTotal()."
// The trailing descriptor after the last '/' identifies the entity:
//   "computeTotal()."  → a method/function descriptor (ends with "().")
//   "computeTotal()(x)" → a parameter (we ignore params for call resolution)
// We extract the bare name from a function/method descriptor.

/**
 * Extract the function name from a SCIP symbol, or null if the symbol is not a
 * callable (parameter, type, module, etc.).
 * @param {string} symbol
 * @returns {string|null}
 */
function funcNameFromSymbol(symbol) {
  if (!symbol || typeof symbol !== 'string') return null;
  // Only function/method occurrences (end with "()."). Parameters are "name().(p)"
  // — they don't end with "()." so they're excluded.
  if (!/\(\)\.$/.test(symbol)) return null;
  // The callable name is the last descriptor segment. Top-level functions are
  // ".../`file.ts`/name()."; methods are ".../`file.ts`/Class#method()." — so the
  // name follows the LAST '/' OR '#', whichever is later (methods key on '#').
  const cut = Math.max(symbol.lastIndexOf('/'), symbol.lastIndexOf('#'));
  const descriptor = cut === -1 ? symbol : symbol.slice(cut + 1);
  const m = descriptor.match(/^([A-Za-z_$][\w$]*)\(\)\.$/);
  return m ? m[1] : null;
}

// ── Read a SCIP index into resolution maps ───────────────────────────────────

const SYMBOL_ROLE_DEFINITION = 0x1; // SymbolRole.Definition bit

// scip-typescript indexes whatever its tsconfig includes — which on real projects
// often covers build output (dist-local/, dist-test/, build/). Those generated
// bundles must NOT enter the graph (duplicate, minified symbols pollute who-calls).
// Mirror the indexer's SKIP_DIRS prefix logic at the SCIP-doc level.
function isBuildOutputPath(relPath) {
  const seg = String(relPath).split('/');
  for (const s of seg) {
    if (s === 'node_modules' || s === '.git' || s === 'coverage') return true;
    for (const pre of ['dist', 'build', 'out']) {
      if (s === pre || (s.length > pre.length && s.startsWith(pre) &&
          (s[pre.length] === '-' || s[pre.length] === '.' || s[pre.length] === '_'))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Decode a `.scip` file and build resolution maps.
 *
 * @param {string} scipPath  absolute path to an index.scip
 * @returns {{ ok: true, symbolToDef: Map<string,string>,
 *             fileRefs: Map<string, Array<{symbol:string, funcId:string, line:number}>> }
 *         | { ok: false, reason: string }}
 */
function readScipIndex(scipPath) {
  const proto = loadScipProto();
  if (!proto) {
    return { ok: false, reason: 'scip-decoder-unavailable' };
  }
  if (!fs.existsSync(scipPath)) {
    return { ok: false, reason: 'scip-file-missing' };
  }

  let obj;
  try {
    const buf = fs.readFileSync(scipPath);
    obj = proto.Index.deserialize(buf).toObject();
  } catch (e) {
    return { ok: false, reason: `scip-decode-failed: ${e.message}` };
  }

  const symbolToDef = new Map();          // scipSymbol → funcId (relPath#name)
  const fileRefs = new Map();             // relPath → [{symbol, line}]

  const docs = obj.documents || [];

  // First pass: collect every DEFINITION occurrence → symbol → funcId.
  for (const doc of docs) {
    const relPath = doc.relative_path;
    if (!relPath || isBuildOutputPath(relPath)) continue;
    for (const occ of doc.occurrences || []) {
      const isDef = (occ.symbol_roles & SYMBOL_ROLE_DEFINITION) !== 0;
      if (!isDef) continue;
      const name = funcNameFromSymbol(occ.symbol);
      if (!name) continue;
      // funcId = the graph's file#name key
      symbolToDef.set(occ.symbol, `${relPath}#${name}`);
    }
  }

  // Second pass: collect every REFERENCE occurrence per file, resolved to the def.
  for (const doc of docs) {
    const relPath = doc.relative_path;
    if (!relPath || isBuildOutputPath(relPath)) continue;
    const refs = [];
    for (const occ of doc.occurrences || []) {
      const isDef = (occ.symbol_roles & SYMBOL_ROLE_DEFINITION) !== 0;
      if (isDef) continue;                       // refs only
      const name = funcNameFromSymbol(occ.symbol);
      if (!name) continue;                        // only callable references
      const funcId = symbolToDef.get(occ.symbol); // resolve to the def
      if (!funcId) continue;                      // external/unresolvable → skip (stays floor)
      const line = Array.isArray(occ.range) ? occ.range[0] : null;
      refs.push({ symbol: occ.symbol, funcId, line });
    }
    if (refs.length) fileRefs.set(relPath, refs);
  }

  return { ok: true, symbolToDef, fileRefs };
}

module.exports = {
  loadScipProto,
  funcNameFromSymbol,
  readScipIndex,
};
