/**
 * gsd-t-grep-classifier.cjs
 *
 * M97 — Classify a Grep tool call as STRUCTURAL (the code graph can answer it
 * better) or TEXT (let grep run). The grep-intercept hook uses this to decide
 * whether to replace grep output with a graph answer.
 *
 * CONSERVATIVE BY DESIGN: when unsure → TEXT (pass grep through). A false
 * "structural" hijacks a legitimate text search (bad); a false "text" just means
 * we miss a graph opportunity (harmless — grep still works). So the bar for
 * STRUCTURAL is high and the patterns are narrow.
 *
 * STRUCTURAL = the pattern is asking "where is this symbol used / who calls it /
 * who imports it" — answerable from the import/call graph:
 *   - a bare identifier (a function/class/variable name), no regex metachars
 *   - an explicit import line for a symbol  (import ... X / from ... import X)
 *   - a function/method call shape          (foo(  /  X.method()  )
 *
 * TEXT = everything else: string literals, error messages, TODOs, regexes,
 * multi-word phrases, paths, comments, anything with regex metacharacters that
 * isn't a plain call shape.
 *
 * [RULE] grep-classifier-conservative-text-default
 */

'use strict';

// A plain identifier: starts with a letter/_/$ then word chars. No spaces, no
// regex metacharacters, no dots (a bare name, not a member access or path).
const BARE_IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

// A member-call shape: Obj.method or this.method (optionally with a trailing "(").
const MEMBER_CALL = /^[A-Za-z_$][A-Za-z0-9_$]*\.[A-Za-z_$][A-Za-z0-9_$]*\(?$/;

// A call shape: foo(  — a bare name immediately followed by "(".
const CALL_SHAPE = /^[A-Za-z_$][A-Za-z0-9_$]*\($/;

// Import-of-a-symbol shapes (JS/TS + Python). Capture the symbol.
const IMPORT_SHAPES = [
  /^import\s+\{?\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\}?/, // import X / import { X }
  /^from\s+\S+\s+import\s+([A-Za-z_$][A-Za-z0-9_$]*)/, // from m import X (python)
];

// Regex metacharacters that signal a TEXT/regex search (not a bare symbol).
// (We allow a single trailing "(" for the call shape, handled before this.)
const REGEX_METACHARS = /[\\^$.*+?\[\]{}|()<>:;,"'`@#%&!~ \t]/;

/**
 * Classify a grep pattern.
 * @param {string} pattern  the Grep tool's `pattern` input
 * @param {object} [opts]   reserved (e.g. path hints)
 * @returns {{ structural: boolean, kind: string, symbol: string|null, verb: string|null }}
 *   kind: 'bare-symbol' | 'member-call' | 'call-shape' | 'import' | 'text'
 *   verb: the graph verb to run ('who-calls' | 'who-imports') or null for text
 */
function classifyGrep(pattern, opts = {}) {
  const TEXT = { structural: false, kind: 'text', symbol: null, verb: null };

  if (typeof pattern !== 'string') return TEXT;
  const p = pattern.trim();
  if (!p) return TEXT;

  // Too long to be a symbol → text. (Symbols are short; long patterns are prose.)
  if (p.length > 80) return TEXT;

  // 1. Import-of-a-symbol → who-imports on that symbol.
  for (const re of IMPORT_SHAPES) {
    const m = p.match(re);
    if (m && m[1]) {
      return { structural: true, kind: 'import', symbol: m[1], verb: 'who-imports' };
    }
  }

  // 2. Bare identifier → who-calls + who-imports (the hook unions them).
  if (BARE_IDENT.test(p)) {
    return { structural: true, kind: 'bare-symbol', symbol: p, verb: 'who-calls' };
  }

  // 3. Call shape: foo(  → who-calls on foo.
  if (CALL_SHAPE.test(p)) {
    return { structural: true, kind: 'call-shape', symbol: p.slice(0, -1), verb: 'who-calls' };
  }

  // 4. Member call: Obj.method / this.method → who-calls on the method name.
  if (MEMBER_CALL.test(p)) {
    const method = p.replace(/\(?$/, '').split('.').pop();
    return { structural: true, kind: 'member-call', symbol: method, verb: 'who-calls' };
  }

  // 5. Anything with regex metachars / spaces / quotes → TEXT (conservative).
  if (REGEX_METACHARS.test(p)) return TEXT;

  // 6. Fallthrough → TEXT.
  return TEXT;
}

module.exports = { classifyGrep, BARE_IDENT, MEMBER_CALL, CALL_SHAPE };
