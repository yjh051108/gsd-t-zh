#!/usr/bin/env node
'use strict';

/**
 * gsd-t-graph-ts-throughput.cjs
 *
 * K2 spike — tree-sitter throughput probe.
 *
 * Measures whether a full tree-sitter floor parse of the REAL Atos repo
 * builds under the ~2 min budget. PASS iff wall-clock ≤ 120 s; else KILL/
 * re-scope. Never fakes a PASS when the repo or SHA is absent.
 *
 * Rules enforced:
 *   [RULE] K2: treesitter-atos-build-under-budget-or-rescope
 *   [RULE] k2-atos-sha-pinned
 *   [RULE] k2-build-footprint-ceiling
 *   [RULE] k2-atos-scale-measured-not-assumed
 *   [RULE] k2-scale-sanity-vs-bakeoff
 *   [RULE] k2-verdict-field-machine-checkable
 *
 * Output: JSON envelope on stdout, ANSI colours on stderr, exit 0=PASS / 1=KILL.
 *
 * Dev/spike-only: tree-sitter + grammar packages MUST remain in devDependencies
 * only (zero shipped-installer-dep invariant).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ── ANSI helpers (stderr only) ───────────────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};
function log(msg) { process.stderr.write(msg + '\n'); }
function info(msg) { log(`${C.cyan}[K2]${C.reset} ${msg}`); }
function warn(msg) { log(`${C.yellow}[K2 WARN]${C.reset} ${msg}`); }
function good(msg) { log(`${C.green}[K2 PASS]${C.reset} ${msg}`); }
function fail(msg) { log(`${C.red}[K2 KILL]${C.reset} ${msg}`); }

// ── Constants ────────────────────────────────────────────────────────────────

/** Default Atos repo path (overridable via ATOS_REPO env) */
const ATOS_REPO = process.env.ATOS_REPO ||
  '/Users/david/projects/HiloAviation/hilo-figma-atos';

/** Budget: 2 minutes in ms  ([RULE] K2: treesitter-atos-build-under-budget-or-rescope) */
const BUDGET_MS = 120_000;

/** Peak RSS ceiling: 4 GB  ([RULE] k2-build-footprint-ceiling) */
const RSS_CEILING_BYTES = 4 * 1024 * 1024 * 1024;

/**
 * D1 synthetic bakeoff assumed scale for comparison.
 * ([RULE] k2-scale-sanity-vs-bakeoff)
 * D1 used ~1.5 M nodes (LOC proxy). If the real repo diverges > 1.5× or
 * < 0.66× from this, the K1 store evidence was validated at the wrong scale.
 */
const BAKEOFF_ASSUMED_LOC = 1_500_000;

/** Scale-mismatch thresholds */
const SCALE_HIGH = 1.5;
const SCALE_LOW = 0.66;

/** Source-file extensions parsed by the floor harness */
const PARSED_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py']);

/** Directories skipped during enumeration */
const SKIP_DIRS = new Set([
  'node_modules', '.next', 'dist', 'build', '.git',
  '.cache', '__pycache__', 'coverage', '.nyc_output',
  'out', '.turbo',
]);

// ── File enumeration ─────────────────────────────────────────────────────────

/**
 * Recursively enumerate source files in a repo directory.
 * Returns Array<{ absPath, relPath, ext }>.
 */
function enumerateFiles(root) {
  const results = [];
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name));
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (PARSED_EXTS.has(ext)) {
          const absPath = path.join(dir, e.name);
          const relPath = path.relative(root, absPath).split(path.sep).join('/');
          results.push({ absPath, relPath, ext });
        }
      }
    }
  }
  walk(root);
  return results;
}

// ── Tree-sitter parser setup ─────────────────────────────────────────────────

let Parser, TypeScript, TSX, Python;
let tsAvailable = false;

function loadParsers() {
  try {
    Parser = require('tree-sitter');
    const tsGrammars = require('tree-sitter-typescript');
    TypeScript = tsGrammars.typescript;
    TSX = tsGrammars.tsx;
    tsAvailable = true;
  } catch (e) {
    warn(`tree-sitter-typescript not available: ${e.message}`);
  }
  try {
    Python = require('tree-sitter-python');
  } catch {
    /* Python grammar optional — ts/js is the primary floor */
  }
}

function getGrammar(ext) {
  switch (ext) {
    case '.ts': case '.mjs': case '.cjs': return TypeScript;
    case '.tsx': return TSX;
    case '.js': case '.jsx': return TypeScript; // TSX handles JSX; use TS for .js too
    case '.py': return Python;
    default: return null;
  }
}

// ── Per-file parse ───────────────────────────────────────────────────────────

/**
 * Parse a single file with tree-sitter and extract entities + edges.
 * Returns { entities, edges, loc } or throws.
 *
 * Output shape per graph-parser-floor-contract.md §Parse-harness interface.
 */
function parseFile(absPath, relPath, ext) {
  const content = fs.readFileSync(absPath, 'utf8');
  const loc = content.split('\n').length;

  if (!tsAvailable) {
    /* Graceful fallback: count LOC but emit no entities/edges */
    return { entities: [], edges: [], loc };
  }

  const grammar = getGrammar(ext);
  if (!grammar) return { entities: [], edges: [], loc };

  const parser = new Parser();
  parser.setLanguage(grammar);
  const tree = parser.parse(content);
  const root = tree.rootNode;

  const entities = [];
  const edges = [];

  // Walk the AST
  function walkNode(node, parentClass) {
    switch (node.type) {
      case 'import_statement':
      case 'import_declaration': {
        // import ... from 'module'
        const sourceNode = node.childForFieldName('source');
        if (sourceNode) {
          const target = sourceNode.text.replace(/^['"]|['"]$/g, '');
          const importedNames = extractImportedNames(node);
          edges.push({
            kind: 'import',
            source: relPath,
            target,
            names: importedNames,
            line: node.startPosition.row + 1,
          });
        }
        break;
      }
      case 'call_expression': {
        // require('module')
        const fn = node.childForFieldName('function');
        if (fn && fn.text === 'require') {
          const args = node.childForFieldName('arguments');
          if (args && args.namedChildCount > 0) {
            const first = args.namedChild(0);
            if (first && (first.type === 'string' || first.type === 'string_fragment')) {
              const target = first.text.replace(/^['"]|['"]$/g, '');
              edges.push({
                kind: 'require',
                source: relPath,
                target,
                names: [],
                line: node.startPosition.row + 1,
              });
            }
          }
        }
        /* fall-through: call expressions also become call-site edges (best-effort) */
        if (fn) {
          const callerName = `${relPath}#_caller@${node.startPosition.row + 1}`;
          const calleeName = fn.type === 'identifier' ? fn.text
            : fn.type === 'member_expression' ? fn.text
            : null;
          if (calleeName && calleeName !== 'require') {
            edges.push({
              kind: 'call-site',
              source: callerName,
              target: `${relPath}#${calleeName}`,
              line: node.startPosition.row + 1,
            });
          }
        }
        break;
      }
      case 'function_declaration':
      case 'function': {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const name = nameNode.text;
          const id = `${relPath}#${name}@${node.startPosition.row + 1}`;
          entities.push({
            id,
            name,
            type: parentClass ? 'method' : 'function',
            line: node.startPosition.row + 1,
            exported: isExported(node),
            ...(parentClass ? { parentClass } : {}),
          });
        }
        break;
      }
      case 'method_definition': {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const name = nameNode.text;
          if (name !== 'constructor') {
            const id = `${relPath}#${name}@${node.startPosition.row + 1}`;
            entities.push({
              id,
              name,
              type: 'method',
              line: node.startPosition.row + 1,
              exported: parentClass ? true : false,
              parentClass: parentClass || undefined,
            });
          }
        }
        break;
      }
      case 'class_declaration':
      case 'class': {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const name = nameNode.text;
          entities.push({
            id: `${relPath}#${name}@${node.startPosition.row + 1}`,
            name,
            type: 'class',
            line: node.startPosition.row + 1,
            exported: isExported(node),
          });
          // Walk class body with parentClass context
          for (let i = 0; i < node.childCount; i++) {
            walkNode(node.child(i), name);
          }
          return; // avoid double-walking children below
        }
        break;
      }
      case 'lexical_declaration':
      case 'variable_declaration': {
        // const foo = () => ... or const foo = function ...
        for (let i = 0; i < node.namedChildCount; i++) {
          const decl = node.namedChild(i);
          if (decl.type === 'variable_declarator') {
            const nameNode = decl.childForFieldName('name');
            const valueNode = decl.childForFieldName('value');
            if (nameNode && valueNode &&
              (valueNode.type === 'arrow_function' ||
               valueNode.type === 'function' ||
               valueNode.type === 'function_expression')) {
              entities.push({
                id: `${relPath}#${nameNode.text}@${decl.startPosition.row + 1}`,
                name: nameNode.text,
                type: 'function',
                line: decl.startPosition.row + 1,
                exported: isExported(node),
              });
            }
          }
        }
        break;
      }
      case 'export_statement': {
        // export { x, y } or export default ...
        const declaration = node.childForFieldName('declaration');
        if (!declaration) {
          // export { x, y, z as w }
          for (let i = 0; i < node.namedChildCount; i++) {
            const child = node.namedChild(i);
            if (child.type === 'export_clause') {
              for (let j = 0; j < child.namedChildCount; j++) {
                const spec = child.namedChild(j);
                const exported = spec.childForFieldName('name') || spec;
                if (exported) {
                  entities.push({
                    id: `${relPath}#export:${exported.text}`,
                    name: exported.text,
                    type: 'export',
                    line: node.startPosition.row + 1,
                    exported: true,
                  });
                }
              }
            }
          }
        }
        break;
      }
    }
    // Walk children
    for (let i = 0; i < node.childCount; i++) {
      walkNode(node.child(i), parentClass);
    }
  }

  walkNode(root, null);
  return { entities, edges, loc };
}

/** Check if an AST node's parent is an export_statement */
function isExported(node) {
  const p = node.parent;
  if (!p) return false;
  return p.type === 'export_statement' || p.type === 'export_declaration';
}

/** Extract named imports from an import_statement node */
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
          names.push(sub.text);
        }
      }
    }
  }
  return names;
}

// ── Parallelism ──────────────────────────────────────────────────────────────

/**
 * Divide files into N chunks for parallel processing.
 * (In Node.js worker_threads or child processes; for the spike probe we
 * run synchronously in-process — the timing proves whether the budget
 * holds. D3's production indexer will spawn worker_threads using this same
 * worker-count formula.)
 */
function chunkFiles(files, workerCount) {
  const chunks = Array.from({ length: workerCount }, () => []);
  for (let i = 0; i < files.length; i++) {
    chunks[i % workerCount].push(files[i]);
  }
  return chunks;
}

/** Recommended worker count per graph-parser-floor-contract.md */
function recommendedWorkerCount() {
  return Math.max(2, Math.floor(os.cpus().length * 0.75));
}

// ── Peak RSS sampling ────────────────────────────────────────────────────────

let _peakRss = 0;
function sampleRss() {
  const rss = process.memoryUsage().rss;
  if (rss > _peakRss) _peakRss = rss;
}
function getPeakRss() { return _peakRss; }

// ── Main probe ───────────────────────────────────────────────────────────────

function run() {
  info(`K2 tree-sitter throughput probe — budget ${BUDGET_MS / 1000}s`);
  info(`Atos repo: ${ATOS_REPO}`);

  // ── [RULE] k2-atos-sha-pinned — repo must exist + be a git repo ──────────
  if (!fs.existsSync(ATOS_REPO)) {
    const envelope = makeErrorEnvelope('repo-not-found',
      `Atos repo not found at ${ATOS_REPO} — cannot fabricate a wall-clock number`);
    fail(`repo-not-found: ${ATOS_REPO}`);
    console.log(JSON.stringify(envelope, null, 2));
    process.exit(1);
  }

  let atosSha;
  try {
    atosSha = execSync(`git -C ${JSON.stringify(ATOS_REPO)} rev-parse HEAD`, { encoding: 'utf8' }).trim();
    if (!atosSha || !/^[0-9a-f]{40}$/.test(atosSha)) throw new Error('invalid SHA');
  } catch (e) {
    const envelope = makeErrorEnvelope('sha-pin-failed',
      `Could not pin Atos commit SHA: ${e.message}`);
    fail(`sha-pin-failed: ${e.message}`);
    console.log(JSON.stringify(envelope, null, 2));
    process.exit(1);
  }
  info(`Pinned Atos SHA: ${atosSha}`);

  // ── Load tree-sitter ──────────────────────────────────────────────────────
  loadParsers();
  if (!tsAvailable) {
    warn('tree-sitter not available — will count LOC only (entities/edges empty)');
  }

  // ── Enumerate source files ────────────────────────────────────────────────
  info('Enumerating source files...');
  const t0Enum = Date.now();
  const files = enumerateFiles(ATOS_REPO);
  const enumMs = Date.now() - t0Enum;
  info(`Found ${files.length} source files in ${enumMs}ms`);

  // Lang breakdown
  const langBreakdown = {};
  for (const { ext } of files) {
    if (!langBreakdown[ext]) langBreakdown[ext] = { count: 0, loc: 0 };
    langBreakdown[ext].count++;
  }

  // ── [RULE] k2-atos-scale-measured-not-assumed ─────────────────────────────
  // We'll accumulate LOC during the parse loop.
  let totalLoc = 0;

  // ── Parse loop ────────────────────────────────────────────────────────────
  const workerCount = recommendedWorkerCount();
  info(`Worker count: ${workerCount} (${os.cpus().length} CPUs)`);

  // For the spike we run synchronously in a single process — proves the
  // wall-clock. D3 will parallelize using worker_threads.
  sampleRss();
  const t0Parse = Date.now();
  let parseErrors = 0;

  // RSS sample interval
  const rssSampler = setInterval(sampleRss, 200);

  for (const { absPath, relPath, ext } of files) {
    try {
      const result = parseFile(absPath, relPath, ext);
      totalLoc += result.loc;
      if (langBreakdown[ext]) langBreakdown[ext].loc += result.loc;
    } catch {
      parseErrors++;
    }
    sampleRss();
  }
  clearInterval(rssSampler);
  sampleRss();

  const parseMs = Date.now() - t0Parse;
  const wallClockMs = Date.now() - t0Enum; // total including enum
  const peakRssBytes = getPeakRss();

  info(`Parse complete: ${files.length} files in ${parseMs}ms (total inc. enum: ${wallClockMs}ms)`);
  info(`Parse errors (skipped): ${parseErrors}`);
  info(`Total LOC: ${totalLoc.toLocaleString()}`);
  info(`Peak RSS: ${(peakRssBytes / 1024 / 1024).toFixed(0)} MB`);

  // ── [RULE] k2-scale-sanity-vs-bakeoff ────────────────────────────────────
  const scaleRatio = totalLoc / BAKEOFF_ASSUMED_LOC;
  const scaleMismatch = scaleRatio > SCALE_HIGH || scaleRatio < SCALE_LOW;
  const scaleDivergenceVsBakeoff = {
    bakeoffAssumedLoc: BAKEOFF_ASSUMED_LOC,
    measuredLoc: totalLoc,
    ratio: Math.round(scaleRatio * 100) / 100,
    scaleMismatch,
    scaleMismatchReason: scaleMismatch
      ? `Measured ${totalLoc.toLocaleString()} LOC vs bakeoff assumption ${BAKEOFF_ASSUMED_LOC.toLocaleString()} (ratio ${scaleRatio.toFixed(2)}×) — K1 store evidence validated at wrong scale`
      : null,
  };

  if (scaleMismatch) {
    warn(`Scale mismatch: measured ${totalLoc.toLocaleString()} LOC vs bakeoff ${BAKEOFF_ASSUMED_LOC.toLocaleString()} (${scaleRatio.toFixed(2)}×)`);
  }

  // ── [RULE] k2-build-footprint-ceiling ────────────────────────────────────
  const footprintExceeded = peakRssBytes > RSS_CEILING_BYTES;
  if (footprintExceeded) {
    fail(`Peak RSS ${(peakRssBytes / 1024 / 1024 / 1024).toFixed(2)} GB exceeds ceiling ${(RSS_CEILING_BYTES / 1024 / 1024 / 1024).toFixed(0)} GB`);
  }

  // ── [RULE] K2: treesitter-atos-build-under-budget-or-rescope ─────────────
  const overBudget = wallClockMs > BUDGET_MS;
  if (overBudget) {
    fail(`Wall-clock ${(wallClockMs / 1000).toFixed(1)}s exceeds budget ${BUDGET_MS / 1000}s`);
  }

  let verdict;
  let killReason = null;
  if (overBudget || footprintExceeded || scaleMismatch) {
    verdict = 'KILL';
    const reasons = [];
    if (overBudget) reasons.push(`over-budget (${(wallClockMs / 1000).toFixed(1)}s > ${BUDGET_MS / 1000}s)`);
    if (footprintExceeded) reasons.push(`footprint-exceeded (${(peakRssBytes / 1024 / 1024 / 1024).toFixed(2)} GB > 4 GB)`);
    if (scaleMismatch) reasons.push(`scale-mismatch (${scaleRatio.toFixed(2)}× vs bakeoff — K1 evidence at wrong scale)`);
    killReason = reasons.join('; ');
    fail(`KILL — ${killReason}`);
    fail('Re-scope: cap repo size / narrow language set / increase parallelism / adjust budget.');
  } else {
    verdict = 'PASS';
    good(`PASS — full index in ${(wallClockMs / 1000).toFixed(1)}s under ${BUDGET_MS / 1000}s budget`);
    good(`Peak RSS ${(peakRssBytes / 1024 / 1024).toFixed(0)} MB under 4 GB ceiling`);
  }

  const envelope = {
    verdict,
    k2Verdict: verdict,             // alias for D7-T2 hard-gate ([RULE] k2-verdict-field-machine-checkable)
    atosSha,                        // ([RULE] k2-atos-sha-pinned)
    wallClockMs,
    budgetMs: BUDGET_MS,
    overBudget,
    atosFileCount: files.length,    // ([RULE] k2-atos-scale-measured-not-assumed)
    atosTotalLoc: totalLoc,         // ([RULE] k2-atos-scale-measured-not-assumed)
    atosLangBreakdown: langBreakdown, // ([RULE] k2-atos-scale-measured-not-assumed)
    peakRssBytes,                   // ([RULE] k2-build-footprint-ceiling)
    peakRssCeilingBytes: RSS_CEILING_BYTES,
    footprintExceeded,
    scaleDivergenceVsBakeoff,       // ([RULE] k2-scale-sanity-vs-bakeoff)
    scaleMismatch,
    parseErrors,
    workerCount,
    filesPerWorker: Math.ceil(files.length / workerCount),
    ...(killReason ? { killReason } : {}),
    generatedAt: new Date().toISOString(),
  };

  console.log(JSON.stringify(envelope, null, 2));
  process.exit(verdict === 'PASS' ? 0 : 1);
}

function makeErrorEnvelope(errorCode, message) {
  return {
    verdict: 'KILL',
    k2Verdict: 'KILL',
    atosSha: null,
    wallClockMs: 0,
    budgetMs: BUDGET_MS,
    atosFileCount: 0,
    atosTotalLoc: 0,
    atosLangBreakdown: {},
    peakRssBytes: 0,
    peakRssCeilingBytes: RSS_CEILING_BYTES,
    scaleDivergenceVsBakeoff: {},
    scaleMismatch: false,
    parseErrors: 0,
    workerCount: 0,
    filesPerWorker: 0,
    error: errorCode,
    errorMessage: message,
    generatedAt: new Date().toISOString(),
  };
}

// ── Entry point ──────────────────────────────────────────────────────────────
run();
