'use strict';

/**
 * gsd-t-graph-anti-grep-lint.cjs
 *
 * M94-D8-T2 — Anti-grep lint engine (deterministic, structural, manifest-driven)
 *
 * [RULE] anti-grep-lint-structural-not-substring
 * [RULE] anti-grep-lint-reads-manifest
 * [RULE] consumer-structural-grep-removed
 *
 * Reads the wired-file set from the §Consumer Manifest table in
 * .gsd-t/contracts/graph-consumer-wiring-contract.md (NOT a hardcoded list),
 * scans each listed command-file + workflow-file for a
 * `try graph-query → catch/else → grep (structural)` fallback,
 * returns a JSON envelope {ok, violations:[{file, line, evidence}]},
 * exits non-zero on any violation.
 *
 * Node built-ins only (zero-dep invariant).
 */

const fs = require('fs');
const path = require('path');

const CONTRACT_PATH = '.gsd-t/contracts/graph-consumer-wiring-contract.md';

// Structural verb set — the graph query CLI verbs that answer STRUCTURAL questions.
// A grep that answers one of these is a structural-grep fallback.
const STRUCTURAL_VERBS = [
  'who-imports',
  'who-calls',
  'blast-radius',
  'dependents',
  'dead-code',
  'orphan',
  'cycles',
  'cluster',
  'test-impl',
];

// Files exempted from the lint (the announced-fallback carve-outs).
// Relative to projectDir, POSIX-normalised.
const SCAN_EXEMPT_FILES = new Set([
  'commands/gsd-t-scan.md',
  'templates/workflows/gsd-t-scan.workflow.js',
]);

const VERIFY_INTEGRATE_EXEMPT_FILES = new Set([
  'commands/gsd-t-verify.md',
  'templates/workflows/gsd-t-verify.workflow.js',
  'commands/gsd-t-integrate.md',
  'templates/workflows/gsd-t-integrate.workflow.js',
]);

// ─── Manifest parser ────────────────────────────────────────────────────────

/**
 * Parse the §Consumer Manifest table from the wiring contract.
 * Returns an array of { commandFile, workflowFile } objects for files to lint.
 * The manifest table starts with:
 *   | Command File | Workflow File | Role | Structural Verbs Used | Replaces Structural Grep For |
 * Data rows follow (non-header, non-separator, non-placeholder).
 *
 * @param {string} contractText  — full text of the contract file
 * @returns {{ commandFile: string, workflowFile: string }[]}
 */
function parseManifest(contractText) {
  const rows = [];
  const lines = contractText.split(/\r?\n/);

  // Find the manifest table section — look for the header row.
  let inTable = false;
  let headerSeen = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect the manifest table header (case-insensitive column name check).
    if (
      /^\|\s*Command\s+File\s*\|.*Workflow\s+File\s*\|.*Role\s*\|/i.test(trimmed)
    ) {
      inTable = true;
      headerSeen = true;
      continue;
    }

    // We're in the table once we've seen the header.
    if (!inTable || !headerSeen) continue;

    // Stop at a non-table line (empty line or heading).
    if (!trimmed.startsWith('|')) {
      // Stop if it's a blank line or a heading, continue through empty rows.
      if (trimmed === '' || trimmed.startsWith('#')) {
        inTable = false;
      }
      continue;
    }

    // Skip separator rows (--- rows).
    if (/^\|[-| ]+\|$/.test(trimmed)) continue;

    // Parse data row: | command-file | workflow-file | role | verbs | description |
    const cols = trimmed
      .split('|')
      .slice(1, -1)  // strip leading/trailing pipes
      .map((c) => c.trim());

    if (cols.length < 2) continue;

    const commandFile = cols[0];
    const workflowFile = cols[1];

    // Skip placeholder rows.
    if (!commandFile || commandFile.startsWith('_(') || commandFile === '') continue;
    if (!workflowFile || workflowFile.startsWith('_(') || workflowFile === '') {
      // Command file alone is still worth linting if workflow is absent/placeholder.
      if (commandFile && !commandFile.startsWith('_(')) {
        rows.push({ commandFile, workflowFile: null });
      }
      continue;
    }

    rows.push({ commandFile, workflowFile });
  }

  return rows;
}

// ─── Structural grep detector ───────────────────────────────────────────────

/**
 * Strip JS/MD line comments and block comments from source.
 * Returns text with comments replaced by whitespace (to preserve line numbers).
 *
 * @param {string} source
 * @returns {string}
 */
function stripComments(source) {
  // Replace block comments /* … */ with spaces (preserving newlines for line counts).
  let out = source.replace(/\/\*[\s\S]*?\*\//g, (m) =>
    m.replace(/[^\n]/g, ' ')
  );
  // Replace // line comments.
  out = out.replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
  // Replace markdown code-fence block content (triple-backtick fences).
  // We blank these so a code example in docs doesn't trip the lint.
  out = out.replace(/^```[\s\S]*?^```/gm, (m) => m.replace(/[^\n]/g, ' '));
  return out;
}

/**
 * Detect whether a line/region of source contains a structural-grep fallback.
 *
 * A structural-grep fallback is:
 *   a grep call (exec/execSync/spawn/spawnSync with 'grep' as the command,
 *   or a shell command string starting with 'grep …')
 *   appearing in a catch/else/fallback position AFTER a `gsd-t graph <structural-verb>` call.
 *
 * This is STRUCTURAL, not a substring scan:
 *   - A comment mentioning grep → NOT flagged (comments stripped first).
 *   - A legitimate text-search grep (TODO, config value) → NOT flagged (no structural verb in context).
 *   - An actual exec('grep …') after a graph query verb in a catch/else → FLAGGED.
 *
 * Detection approach (conservative — better to report a false positive than miss a real violation):
 *   1. Strip comments from source.
 *   2. Identify "structural query regions" — spans containing a `gsd-t graph <verb>` call.
 *   3. Within or after those regions, detect catch/else blocks that invoke grep.
 *   4. A grep in a catch/else that is contextually NEAR (within 50 lines after) a structural verb call
 *      AND the grep pattern looks structural (not a text search) is a violation.
 *
 * @param {string} source      — source text of the file
 * @param {string} filePath    — for reporting (relative)
 * @returns {{ found: boolean, violations: { file: string, line: number, evidence: string }[] }}
 */
function detectStructuralGrepFallback(source, filePath) {
  const violations = [];

  const clean = stripComments(source);
  const lines = clean.split('\n');
  const rawLines = source.split('\n');

  // Step 1: Find all lines containing a structural graph verb call.
  // Pattern: gsd-t graph <verb>  OR  graph <verb>  OR  graphQuery(<verb>)  OR  queryGraph(<verb>)
  // Also: strings like 'who-imports', 'blast-radius' etc. passed to exec/spawn as graph CLI args.
  const structuralVerbPattern = new RegExp(
    '(?:gsd-t\\s+graph|graph(?:Query|Cli)?|queryGraph)\\s+(?:' +
      STRUCTURAL_VERBS.map((v) => v.replace('-', '[-_]')).join('|') +
      ')|[\'"`](?:' +
      STRUCTURAL_VERBS.map((v) => v.replace('-', '[-_]')).join('|') +
      ')[\'"`]',
    'i'
  );

  // Collect line numbers of structural verb calls.
  const verbLineNums = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (structuralVerbPattern.test(lines[i])) {
      verbLineNums.add(i);
    }
  }

  // If no structural verb found in this file, no structural-grep fallback possible.
  if (verbLineNums.size === 0) return { found: false, violations: [] };

  // Step 2: Find catch/else blocks that contain a grep subprocess call.
  // Pattern: catch (...) { ... grep ... } or else { ... grep ... }
  // We look for:
  //   - exec*('grep …') / spawnSync('grep', …) / exec("grep …")
  //   - shell strings like 'grep -r …' passed to exec
  //   in lines that are within a catch/else context.
  const grepCallPattern =
    /\bexec(?:Sync|File(?:Sync)?|File)?\s*\(\s*['"`]grep\b|spawn(?:Sync)?\s*\(\s*['"`]grep\b/;

  // Shell command strings: exec(`grep …`), or shell.exec('grep …'), or spawnSync('sh', ['-c', 'grep …'])
  const shellGrepPattern = /['"`]grep\s+/;

  // Track if we're inside a catch or else block.
  // Simple brace-counting heuristic (not a full AST — good enough for our conservative approach).
  let catchElseDepth = 0;
  let inCatchElse = false;
  let lastVerbLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const rawLine = rawLines[i];

    // Update last seen structural verb line.
    if (verbLineNums.has(i)) {
      lastVerbLine = i;
    }

    // Detect entering a catch or else block.
    if (/\b(catch|else)\s*[\({]/.test(line) || /\belse\s*$/.test(line.trim())) {
      // Only flag if we're within 50 lines of a structural verb call.
      if (lastVerbLine >= 0 && i - lastVerbLine <= 50) {
        inCatchElse = true;
        catchElseDepth = 1;
      }
    }

    // Track brace depth to know when we leave the catch/else.
    if (inCatchElse) {
      const opens = (line.match(/\{/g) || []).length;
      const closes = (line.match(/\}/g) || []).length;
      // First line of catch/else already counted one brace above.
      if (i > lastVerbLine) {
        catchElseDepth += opens - closes;
        if (catchElseDepth <= 0) {
          inCatchElse = false;
          catchElseDepth = 0;
        }
      }

      // Check for grep in this line (within the catch/else).
      if (
        i > lastVerbLine &&
        (grepCallPattern.test(line) || shellGrepPattern.test(line))
      ) {
        // Classify: is this a structural grep (structural pattern) or text grep?
        // If the grep pattern is about structural questions (imports, calls, deps),
        // it's a violation. If it looks like a text search (TODO, config key), it's NOT.
        const isStructuralGrep = isStructuralGrepPattern(rawLine);
        if (isStructuralGrep) {
          violations.push({
            file: filePath,
            line: i + 1,
            evidence: rawLine.trim().slice(0, 200),
          });
        }
      }
    }
  }

  // Step 3: Also check for simple inline grep-fallback patterns not in explicit catch/else:
  // Pattern: const result = graphQuery(verb) || execSync('grep …')
  // Pattern: try { ... } catch { grep … } on the same line or consecutive lines.
  // We already handle multi-line catch above; add single-line alternatives.
  const inlineFallbackPattern =
    /(?:gsd-t\s+graph|graphQuery|queryGraph)\s*\(.*\)\s*\|\|\s*.*(?:exec|spawn).*grep/i;
  for (let i = 0; i < lines.length; i++) {
    if (inlineFallbackPattern.test(lines[i])) {
      violations.push({
        file: filePath,
        line: i + 1,
        evidence: rawLines[i].trim().slice(0, 200),
      });
    }
  }

  return { found: violations.length > 0, violations };
}

/**
 * Determine if a grep call in source code is answering a STRUCTURAL question.
 *
 * Structural grep patterns include:
 *   - grep for import/require patterns (who-imports structural question)
 *   - grep for function call patterns (who-calls structural question)
 *   - grep for dependency/export patterns
 *
 * Non-structural (text-search) grep patterns:
 *   - grep for TODO, FIXME, NOTE
 *   - grep for config keys / magic strings / string literals
 *   - grep for environment variables
 *
 * This is a heuristic — it should have LOW false-positive rate.
 *
 * @param {string} line
 * @returns {boolean}
 */
function isStructuralGrepPattern(line) {
  // Import/require pattern grepping → structural.
  if (/grep.*(?:import|require|from\s+['"`])/.test(line)) return true;
  // Function-call pattern grepping → structural.
  if (/grep.*\w+\s*\(/.test(line) && !/grep.*(?:TODO|FIXME|NOTE|todo|fixme)/.test(line)) {
    // Only flag if it looks like function-call pattern search, not a general text search.
    // e.g. grep for "foo(" across the codebase is structural.
    if (/grep.*\w+\s*\\\(/.test(line) || /grep.*-[rRE].*\w+\s*\(/.test(line)) return true;
  }
  // Dead-code / orphan / cycle grepping — structural. Hard to pattern-match generically,
  // so we rely on the catch/else positioning in the caller rather than pattern-matching here.
  // Return true if this grep is clearly inside a structural-fallback block (the caller already
  // established we're in a catch/else after a structural verb call).
  // For conservative detection: a grep in a catch/else after a structural verb call IS a violation
  // unless it's clearly a text search.
  if (isTextSearchGrep(line)) return false;
  // Default for a grep in a catch/else after a structural verb: flag it.
  return true;
}

/**
 * Returns true if the grep is clearly a text-search (not structural).
 * Text-search greps look for literal string content, not code structure.
 *
 * Conservative: only returns true when there is STRONG POSITIVE evidence
 * that the grep is searching for text content (TODO, a named constant, a
 * quoted literal string known to be non-structural). When in doubt (e.g. the
 * search pattern is a variable or ambiguous), returns false — the caller
 * already established structural context (catch/else after a structural verb),
 * so the default is to flag, not to pass.
 *
 * @param {string} line
 * @returns {boolean}
 */
function isTextSearchGrep(line) {
  // TODO / FIXME / NOTE / HACK / BUG → unambiguously text search.
  if (/grep.*(?:TODO|FIXME|NOTE|HACK|XXX|BUG)/i.test(line)) return true;
  // All-caps constants (MAX_RETRIES, MY_CONFIG_KEY, etc.) with no structural keywords → text search.
  if (/grep.*\b[A-Z][A-Z0-9_]{3,}\b/.test(line) && !/grep.*(?:import|require|export)/.test(line)) return true;
  // Quoted LITERAL strings that are clearly non-structural content:
  // A grep for a quoted string that is NOT a structural pattern (import/require/export/call).
  // The quoted string must be a LITERAL (no string concatenation with + variable) and
  // must not look like a code-structure pattern.
  const quotedLiteralMatch = line.match(/grep.*(['"`])([^'"`+$]+)\1/);
  if (quotedLiteralMatch) {
    const pattern = quotedLiteralMatch[2];
    // Skip if the pattern contains structural keywords.
    if (/import|require|from\s|export|function\s/.test(pattern)) return false;
    // Skip if the pattern looks like a file path or structural identifier.
    if (/\.(ts|js|cjs|mjs|tsx|jsx)\b/.test(pattern)) return false;
    // A clearly non-structural literal (contains spaces without structural keywords,
    // or is a plain word that's not a code identifier) → text search.
    if (/\s/.test(pattern) || /^[A-Z][A-Z0-9_]+$/.test(pattern)) return true;
  }
  return false;
}

// ─── Main lint runner ────────────────────────────────────────────────────────

/**
 * Read the consumer manifest from the wiring contract and return the set of
 * wired files to lint. Returns { files: string[], error: string|null }.
 *
 * @param {string} projectDir
 * @returns {{ files: string[], manifestRows: number, error: string|null }}
 */
function readManifest(projectDir) {
  const contractPath = path.join(projectDir, CONTRACT_PATH);
  let contractText;
  try {
    contractText = fs.readFileSync(contractPath, 'utf8');
  } catch (err) {
    return {
      files: [],
      manifestRows: 0,
      error: `Cannot read wiring contract at ${CONTRACT_PATH}: ${err.message}`,
    };
  }

  const rows = parseManifest(contractText);
  const files = new Set();
  for (const row of rows) {
    if (row.commandFile) files.add(row.commandFile);
    if (row.workflowFile) files.add(row.workflowFile);
  }

  return { files: [...files], manifestRows: rows.length, error: null };
}

/**
 * Run the anti-grep lint over the wired-file set.
 *
 * @param {object} opts
 * @param {string}   opts.projectDir    — absolute path to the project root
 * @param {string[]} [opts.files]       — override the file list (for testing)
 * @returns {{ ok: boolean, violations: { file: string, line: number, evidence: string }[], manifestRows: number, scannedFiles: string[], skippedFiles: string[], error: string|null }}
 */
function runLint(opts = {}) {
  const projectDir = opts.projectDir || process.cwd();

  let filesToScan;
  let manifestRows = 0;

  if (opts.files) {
    // Override mode (for tests passing fixture files).
    filesToScan = opts.files;
    manifestRows = opts.files.length;
  } else {
    const manifest = readManifest(projectDir);
    if (manifest.error) {
      return {
        ok: false,
        violations: [],
        manifestRows: 0,
        scannedFiles: [],
        skippedFiles: [],
        error: manifest.error,
      };
    }
    filesToScan = manifest.files;
    manifestRows = manifest.manifestRows;
  }

  const allViolations = [];
  const scannedFiles = [];
  const skippedFiles = [];

  for (const relPath of filesToScan) {
    const normalised = relPath.replace(/\\/g, '/');

    // Check exemptions.
    if (SCAN_EXEMPT_FILES.has(normalised) || VERIFY_INTEGRATE_EXEMPT_FILES.has(normalised)) {
      skippedFiles.push(relPath);
      continue;
    }

    const absPath = path.isAbsolute(relPath) ? relPath : path.join(projectDir, relPath);
    let source;
    try {
      source = fs.readFileSync(absPath, 'utf8');
    } catch (err) {
      // File not found — not a violation (file may not exist yet during d10/d11 wiring).
      skippedFiles.push(relPath);
      continue;
    }

    scannedFiles.push(relPath);
    const { violations } = detectStructuralGrepFallback(source, relPath);
    allViolations.push(...violations);
  }

  return {
    ok: allViolations.length === 0,
    violations: allViolations,
    manifestRows,
    scannedFiles,
    skippedFiles,
    error: null,
  };
}

// ─── CLI entry point ─────────────────────────────────────────────────────────

if (require.main === module) {
  const projectDir = process.argv[2] || process.cwd();
  const result = runLint({ projectDir });

  if (result.error) {
    // Contract not found or unreadable — fail loudly (manifest-required).
    process.stderr.write(`[anti-grep-lint] ERROR: ${result.error}\n`);
    process.stdout.write(JSON.stringify({ ok: false, violations: [], error: result.error }, null, 2) + '\n');
    process.exit(1);
  }

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');

  if (!result.ok) {
    process.stderr.write(
      `[anti-grep-lint] FAIL: ${result.violations.length} structural-grep-fallback violation(s) found.\n`
    );
    for (const v of result.violations) {
      process.stderr.write(`  ${v.file}:${v.line} — ${v.evidence}\n`);
    }
    process.exit(1);
  } else {
    process.stderr.write(
      `[anti-grep-lint] PASS: ${result.scannedFiles.length} wired files scanned, 0 violations.\n`
    );
    process.exit(0);
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  runLint,
  parseManifest,
  detectStructuralGrepFallback,
  isStructuralGrepPattern,
  isTextSearchGrep,
  stripComments,
  STRUCTURAL_VERBS,
  SCAN_EXEMPT_FILES,
  VERIFY_INTEGRATE_EXEMPT_FILES,
};
