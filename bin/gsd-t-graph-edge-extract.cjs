#!/usr/bin/env node
'use strict';

/**
 * gsd-t-graph-edge-extract.cjs
 *
 * M94 D3-T1 — Fresh edge extraction on the tree-sitter floor.
 *
 * Extracts entities + edges from a single source file using tree-sitter
 * (NOT lifted from bin/graph-parsers.js — built FRESH on tree-sitter).
 *
 * Taxonomy per graph-parser-floor-contract.md §Edge/entity taxonomy:
 *   - import  : file → file ES-module import edge
 *   - require : file → file CommonJS require edge
 *   - export  : exported symbol entity
 *   - function: function entity (def site; includes arrow functions assigned to const)
 *   - class   : class entity (def site)
 *   - method  : method entity (sub-kind of function, parentClass field)
 *   - call-site: function → function call edge (best-effort; keyed by funcId at BOTH ends)
 *
 * Output shape per graph-parser-floor-contract.md §Per-file parse output shape.
 *
 * [RULE] who-calls-function-identity-disambiguated: call-graph edges are keyed
 * by funcId = "file#function" at BOTH endpoints; same-named functions across
 * files are DISTINCT. Per graph-store-schema-contract.md §Function-identity key.
 *
 * Exported API (for D3's indexer and D4's freshness re-index):
 *   extractEdges(absPath, relPath)  → { file, entities, edges, loc }
 *
 * CLI usage (for testing):
 *   node bin/gsd-t-graph-edge-extract.cjs <file> [--repo-root <root>]
 *   Emits JSON envelope on stdout, ANSI on stderr, exit 0=ok / 1=error.
 */

const fs = require('fs');
const path = require('path');

// ── ANSI helpers ─────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};
function log(msg) { process.stderr.write(msg + '\n'); }
function info(msg) { log(`${C.cyan}[D3]${C.reset} ${msg}`); }
function warn(msg) { log(`${C.yellow}[D3 WARN]${C.reset} ${msg}`); }
function errLog(msg) { log(`${C.red}[D3 ERR]${C.reset} ${msg}`); }

// ── Source-file extensions parsed by the floor ───────────────────────────────

const PARSED_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py']);

// ── Tree-sitter parser lazy loader ───────────────────────────────────────────

let _parsersLoaded = false;
let Parser, TSGrammars, TSX, Python;
let tsAvailable = false;
let pythonAvailable = false;

function ensureParsers() {
  if (_parsersLoaded) return;
  _parsersLoaded = true;
  // M96: resolve the tree-sitter native modules via the multi-location resolver so
  // a COPIED extractor (in a project's bin/) finds them in the GSD-T global package,
  // not the project's own (absent) node_modules. The TS grammar is the MANDATORY
  // floor parser — if it cannot load, FAIL LOUD. A silent fall-through to
  // tsAvailable=false produced an empty graph (0 nodes/edges) that looked like a
  // successful build — the exact silent-degrade this milestone exists to kill.
  const { requireGraphDep } = require('./gsd-t-require-store.cjs');
  try {
    Parser = requireGraphDep('tree-sitter');
    TSGrammars = requireGraphDep('tree-sitter-typescript');
    TSX = TSGrammars.tsx;
    tsAvailable = true;
  } catch (e) {
    throw new Error(
      `code-graph floor parser unavailable: ${e.message} — the graph cannot be built ` +
      `without tree-sitter. Reinstall GSD-T (npx @tekyzinc/gsd-t install).`
    );
  }
  try {
    Python = requireGraphDep('tree-sitter-python');
    pythonAvailable = true;
  } catch {
    /* Python optional — TS/JS still index */
  }
}

function getGrammar(ext) {
  switch (ext) {
    case '.ts':
    case '.mjs':
    case '.cjs':
      return tsAvailable ? TSGrammars.typescript : null;
    case '.tsx':
    case '.jsx':
      return tsAvailable ? TSX : null;
    case '.js':
      return tsAvailable ? TSGrammars.typescript : null;
    case '.py':
      return pythonAvailable ? Python : null;
    default:
      return null;
  }
}

// ── AST helpers ───────────────────────────────────────────────────────────────

/**
 * Walk an AST node's ancestor chain; return true if any ancestor matches type.
 */
function hasAncestorOfType(node, ...types) {
  let p = node.parent;
  while (p) {
    if (types.includes(p.type)) return true;
    p = p.parent;
  }
  return false;
}

/**
 * Return true if the node is a direct child of an export_statement /
 * export_declaration, or if it's a variable_declarator under an exported
 * lexical/variable_declaration.
 */
function isExportedNode(node) {
  const p = node.parent;
  if (!p) return false;
  if (p.type === 'export_statement' || p.type === 'export_declaration') return true;
  // const/let/var: parent is variable_declaration, grandparent is export_statement
  if ((p.type === 'lexical_declaration' || p.type === 'variable_declaration') &&
      p.parent && (p.parent.type === 'export_statement' || p.parent.type === 'export_declaration')) {
    return true;
  }
  return false;
}

// ── Extract import names from an import_statement node ───────────────────────

function extractImportedNames(importNode) {
  const names = [];
  for (let i = 0; i < importNode.namedChildCount; i++) {
    const child = importNode.namedChild(i);
    if (child.type === 'import_clause') {
      for (let j = 0; j < child.namedChildCount; j++) {
        const sub = child.namedChild(j);
        if (sub.type === 'named_imports') {
          for (let k = 0; k < sub.namedChildCount; k++) {
            const spec = sub.namedChild(k);
            const nameNode = spec.childForFieldName('name') || spec;
            if (nameNode) names.push(nameNode.text);
          }
        } else if (sub.type === 'identifier') {
          names.push(sub.text); // default import
        }
      }
    }
  }
  return names;
}

// ── Deduce callee funcId from a call_expression ──────────────────────────────

/**
 * For a call_expression, return the best-effort callee target funcId.
 *
 * Strategy: the call expression's callee is an identifier or member_expression.
 * We cannot statically resolve the callee's file — that requires SCIP.
 * So the target funcId is "UNRESOLVED#<calleeName>" as a floor-tier placeholder.
 * SCIP upgrade will replace these with fully-resolved funcIds.
 *
 * [RULE] who-calls-function-identity-disambiguated: src is the funcId of the
 * enclosing function (or a synthetic _anon@line if top-level); dst is the
 * callee's best-effort funcId.
 */
function resolveCalleeName(fnNode) {
  if (!fnNode) return null;
  const t = fnNode.type;
  if (t === 'identifier') return fnNode.text;
  if (t === 'member_expression') return fnNode.text; // e.g. obj.method
  if (t === 'subscript_expression') return null;      // computed — unresolvable
  return null;
}

// ── Python-specific extraction ────────────────────────────────────────────────

function walkPython(rootNode, relPath, entities, edges) {
  function walk(node, enclosingFuncId) {
    const t = node.type;

    if (t === 'import_statement') {
      // import foo, bar
      for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (child.type === 'dotted_name') {
          edges.push({
            kind: 'require',
            source: relPath,
            target: child.text.replace(/\./g, '/'),
            names: [],
            line: node.startPosition.row + 1,
          });
        }
      }
    } else if (t === 'import_from_statement') {
      // from foo import bar, baz   /   from .utils import x   /   from ..pkg.mod import y
      const moduleNode = node.childForFieldName('module_name');
      // Python relative imports use LEADING dots for package level: a single
      // leading '.' = the current package (the file's own directory), '..' = the
      // parent package, etc. A non-leading '.' is a submodule separator. The old
      // code did a blind dot→slash replace, so `from .utils` became `/utils` (a
      // bogus absolute id) instead of a './utils' relative specifier the query
      // layer can resolve to a real file id. Translate leading dots to '../' levels.
      let target = '?';
      if (moduleNode) {
        const raw = moduleNode.text; // e.g. '.utils', '..pkg.mod', 'django.db'
        const lead = raw.match(/^\.+/);
        if (lead) {
          const dots = lead[0].length;            // 1 = current pkg, 2 = parent, ...
          const rest = raw.slice(dots).replace(/\./g, '/'); // submodule dots → slashes
          // 1 dot → './rest'  ;  2 dots → '../rest'  ;  3 dots → '../../rest'
          const up = '../'.repeat(dots - 1);
          target = './' + up + rest;              // a relative specifier the query layer resolves
        } else {
          target = raw.replace(/\./g, '/');       // absolute/package import (e.g. django/db)
        }
      }
      const names = [];
      for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (child.type === 'dotted_name' && child !== moduleNode) names.push(child.text);
        if (child.type === 'import_list') {
          for (let j = 0; j < child.namedChildCount; j++) {
            names.push(child.namedChild(j).text);
          }
        }
      }
      edges.push({
        kind: 'import',
        source: relPath,
        target,
        names,
        line: node.startPosition.row + 1,
      });
    } else if (t === 'function_definition') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        const funcId = `${relPath}#${name}@${node.startPosition.row + 1}`;
        entities.push({
          id: funcId,
          name,
          type: 'function',
          line: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          exported: false,
        });
        // walk body with this funcId as enclosing
        const body = node.childForFieldName('body');
        if (body) {
          for (let i = 0; i < body.childCount; i++) {
            walk(body.child(i), funcId);
          }
        }
        return;
      }
    } else if (t === 'class_definition') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        entities.push({
          id: `${relPath}#${name}@${node.startPosition.row + 1}`,
          name,
          type: 'class',
          line: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          exported: false,
        });
        const body = node.childForFieldName('body');
        if (body) {
          for (let i = 0; i < body.childCount; i++) {
            walk(body.child(i), enclosingFuncId);
          }
        }
        return;
      }
    } else if (t === 'call') {
      // Python call node
      const fn = node.childForFieldName('function');
      if (fn && enclosingFuncId) {
        const calleeName = resolveCalleeName(fn) || fn.text;
        if (calleeName) {
          edges.push({
            kind: 'call-site',
            source: enclosingFuncId,
            target: `UNRESOLVED#${calleeName}`,
            line: node.startPosition.row + 1,
          });
        }
      }
    }

    for (let i = 0; i < node.childCount; i++) {
      walk(node.child(i), enclosingFuncId);
    }
  }
  walk(rootNode, null);
}

// ── TypeScript / JavaScript extraction ───────────────────────────────────────

/**
 * Walk a TS/JS AST and extract entities + edges.
 *
 * Tracks the "enclosing function funcId" stack so call-site edges carry
 * a file-qualified source funcId per [RULE] who-calls-function-identity-disambiguated.
 */
function walkTSJS(rootNode, relPath, entities, edges) {
  /**
   * @param {object} node  - tree-sitter ASTNode
   * @param {string|null} enclosingFuncId  - funcId of innermost function containing this node
   * @param {string|null} enclosingClass   - name of innermost class (for method parentClass)
   */
  function walk(node, enclosingFuncId, enclosingClass) {
    const t = node.type;

    // ── import_statement / import_declaration ─────────────────────────────
    if (t === 'import_statement' || t === 'import_declaration') {
      const sourceNode = node.childForFieldName('source');
      if (sourceNode) {
        const target = sourceNode.text.replace(/^['"`]|['"`]$/g, '');
        const names = extractImportedNames(node);
        edges.push({
          kind: 'import',
          source: relPath,
          target,
          names,
          line: node.startPosition.row + 1,
        });
      }
      return; // no children to recurse into for imports
    }

    // ── call_expression ───────────────────────────────────────────────────
    if (t === 'call_expression') {
      const fn = node.childForFieldName('function');
      const args = node.childForFieldName('arguments');

      // require('module')
      if (fn && fn.text === 'require') {
        if (args && args.namedChildCount > 0) {
          const first = args.namedChild(0);
          if (first && (first.type === 'string' || first.type === 'string_fragment')) {
            const target = first.text.replace(/^['"`]|['"`]$/g, '');
            edges.push({
              kind: 'require',
              source: relPath,
              target,
              names: [],
              line: node.startPosition.row + 1,
            });
          }
        }
      } else if (fn) {
        // General call-site edge — [RULE] who-calls-function-identity-disambiguated
        const calleeName = resolveCalleeName(fn);
        if (calleeName && calleeName !== 'require') {
          const srcId = enclosingFuncId || `${relPath}#_toplevel`;
          edges.push({
            kind: 'call-site',
            source: srcId,
            target: `UNRESOLVED#${calleeName}`,
            line: node.startPosition.row + 1,
          });
        }
      }

      // Fall through to walk children (the call_expression can contain more nodes)
    }

    // ── function_declaration ──────────────────────────────────────────────
    if (t === 'function_declaration' || t === 'function') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        const funcId = `${relPath}#${name}@${node.startPosition.row + 1}`;
        entities.push({
          id: funcId,
          name,
          type: enclosingClass ? 'method' : 'function',
          line: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          exported: isExportedNode(node),
          ...(enclosingClass ? { parentClass: enclosingClass } : {}),
        });
        // Walk body with this funcId
        for (let i = 0; i < node.childCount; i++) {
          walk(node.child(i), funcId, enclosingClass);
        }
        return;
      }
    }

    // ── method_definition ─────────────────────────────────────────────────
    if (t === 'method_definition') {
      const nameNode = node.childForFieldName('name');
      if (nameNode && nameNode.text !== 'constructor') {
        const name = nameNode.text;
        const funcId = `${relPath}#${name}@${node.startPosition.row + 1}`;
        entities.push({
          id: funcId,
          name,
          type: 'method',
          line: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          exported: true, // methods are implicitly exported via their class
          parentClass: enclosingClass || undefined,
        });
        for (let i = 0; i < node.childCount; i++) {
          walk(node.child(i), funcId, enclosingClass);
        }
        return;
      }
    }

    // ── class_declaration / class ─────────────────────────────────────────
    if (t === 'class_declaration' || t === 'class') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        entities.push({
          id: `${relPath}#${name}@${node.startPosition.row + 1}`,
          name,
          type: 'class',
          line: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          exported: isExportedNode(node),
        });
        // Walk children with class context
        for (let i = 0; i < node.childCount; i++) {
          walk(node.child(i), enclosingFuncId, name);
        }
        return;
      }
    }

    // ── lexical_declaration / variable_declaration ────────────────────────
    // const foo = () => ... or const foo = function...
    if (t === 'lexical_declaration' || t === 'variable_declaration') {
      const isExp = isExportedNode(node);
      for (let i = 0; i < node.namedChildCount; i++) {
        const decl = node.namedChild(i);
        if (decl.type === 'variable_declarator') {
          const nameNode = decl.childForFieldName('name');
          const valueNode = decl.childForFieldName('value');
          if (nameNode && valueNode &&
              (valueNode.type === 'arrow_function' ||
               valueNode.type === 'function' ||
               valueNode.type === 'function_expression')) {
            const name = nameNode.text;
            const funcId = `${relPath}#${name}@${decl.startPosition.row + 1}`;
            entities.push({
              id: funcId,
              name,
              type: 'function',
              line: decl.startPosition.row + 1,
              endLine: valueNode.endPosition.row + 1,
              exported: isExp,
            });
            // Walk arrow/function body with this funcId
            for (let j = 0; j < valueNode.childCount; j++) {
              walk(valueNode.child(j), funcId, enclosingClass);
            }
          }
        }
      }
      // Continue walking children for the declaration itself
    }

    // ── export_statement (bare re-exports: export { x, y }) ──────────────
    if (t === 'export_statement') {
      const declaration = node.childForFieldName('declaration');
      if (!declaration) {
        // export { x, y as z }
        for (let i = 0; i < node.namedChildCount; i++) {
          const child = node.namedChild(i);
          if (child.type === 'export_clause') {
            for (let j = 0; j < child.namedChildCount; j++) {
              const spec = child.namedChild(j);
              // export_specifier has field "name" (local name) and optional "alias"
              const nameNode = spec.childForFieldName('name') || spec;
              if (nameNode) {
                entities.push({
                  id: `${relPath}#export:${nameNode.text}`,
                  name: nameNode.text,
                  type: 'export',
                  line: node.startPosition.row + 1,
                  exported: true,
                });
              }
            }
          }
        }
      }
      // Re-export from another file: export { x } from './foo'
      const sourceNode = node.childForFieldName('source');
      if (sourceNode) {
        const target = sourceNode.text.replace(/^['"`]|['"`]$/g, '');
        edges.push({
          kind: 'import',
          source: relPath,
          target,
          names: [],
          line: node.startPosition.row + 1,
        });
      }
    }

    // ── Walk children ─────────────────────────────────────────────────────
    for (let i = 0; i < node.childCount; i++) {
      walk(node.child(i), enclosingFuncId, enclosingClass);
    }
  }

  walk(rootNode, null, null);
}

// ── Per-file extraction (exported API) ───────────────────────────────────────

/**
 * Extract entities + edges from a single source file.
 *
 * @param {string} absPath  - absolute path to the file
 * @param {string} relPath  - repo-relative POSIX path (the file's identity in the store)
 * @returns {{ file: string, entities: Array, edges: Array, loc: number }}
 *
 * Per graph-parser-floor-contract.md §Per-file parse output shape.
 */
function extractEdges(absPath, relPath) {
  ensureParsers();

  const ext = path.extname(absPath).toLowerCase();
  const content = fs.readFileSync(absPath, 'utf8');
  const loc = content.split('\n').length;

  const grammar = getGrammar(ext);
  if (!grammar) {
    // Unsupported extension or parsers not available — return empty (no crash)
    return { file: relPath, entities: [], edges: [], loc };
  }

  const entities = [];
  const edges = [];

  const parser = new Parser();
  parser.setLanguage(grammar);
  // tree-sitter 0.21's Node binding defaults to a 32 KB parse buffer and throws
  // "Invalid argument" on larger source — silently dropping every file over
  // ~32 KB (common in real repos: Atos has many). Pass an explicit bufferSize
  // sized to the content (+ headroom) so large files index correctly.
  const tree = parser.parse(content, null, {
    bufferSize: Math.max(32 * 1024, content.length * 2 + 1024),
  });

  if (ext === '.py') {
    walkPython(tree.rootNode, relPath, entities, edges);
  } else {
    walkTSJS(tree.rootNode, relPath, entities, edges);
  }

  return { file: relPath, entities, edges, loc };
}

// ── CLI entry point ──────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const fileArg = args.find(a => !a.startsWith('--'));
  const rootIdx = args.indexOf('--repo-root');
  const repoRoot = rootIdx !== -1 ? args[rootIdx + 1] : process.cwd();

  if (!fileArg) {
    errLog('Usage: gsd-t-graph-edge-extract.cjs <file> [--repo-root <root>]');
    process.exit(1);
  }

  const absPath = path.resolve(fileArg);
  if (!fs.existsSync(absPath)) {
    const envelope = { ok: false, error: 'file-not-found', file: fileArg };
    console.log(JSON.stringify(envelope, null, 2));
    process.exit(1);
  }

  const ext = path.extname(absPath).toLowerCase();
  if (!PARSED_EXTS.has(ext)) {
    const envelope = {
      ok: false,
      error: 'unsupported-extension',
      file: fileArg,
      ext,
      supported: [...PARSED_EXTS],
    };
    console.log(JSON.stringify(envelope, null, 2));
    process.exit(1);
  }

  const relPath = path.relative(repoRoot, absPath).split(path.sep).join('/');
  info(`Extracting edges from: ${relPath}`);

  const result = extractEdges(absPath, relPath);

  const envelope = {
    ok: true,
    file: result.file,
    loc: result.loc,
    entityCount: result.entities.length,
    edgeCount: result.edges.length,
    entities: result.entities,
    edges: result.edges,
  };
  console.log(JSON.stringify(envelope, null, 2));
  process.exit(0);
}

module.exports = { extractEdges, PARSED_EXTS };
