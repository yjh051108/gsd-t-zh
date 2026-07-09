#!/usr/bin/env node
'use strict';

/**
 * GSD-T Brownfield Logging Migration (M100-D5-T2).
 *
 * Scaffolds the two framework-default logging streams (trace + audit) into
 * an EXISTING project, ADDITIVELY — every pre-existing project file is left
 * byte-for-byte unchanged; only NEW logging files are added.
 *
 * Dispatch seam: invoked via `bin/gsd-t.js` `case "migrate-logging"`, wired
 * by d1 (the sole editor of that file) on d5's behalf. See
 * .gsd-t/contracts/logging-scaffold-seam-contract.md §Ownership boundary.
 *
 * Consumes:
 *   - bin/gsd-t-logging-scaffolder.cjs  (d1) — scaffoldLogging() storage seam
 *   - templates/logging/trace-module.template.ts   (d2)
 *   - templates/logging/audit-module.template.ts   (d4)
 *   - bin/gsd-t-trace-distill.cjs   (d2) — distillTraceCategories()
 *   - bin/gsd-t-audit-distill.cjs   (d4) — distillAuditActions()
 * Publishes: .gsd-t/contracts/logging-schema-distillation-contract.md
 *
 * Hard rule (Destructive Action Guard / M100 pre-mortem): this module MUST
 * NEVER overwrite, modify, or delete a file that already exists in the
 * target project. It only creates files that are ABSENT. Every write is
 * guarded by an existence check first.
 *
 * Exports:
 *   migrateLogging(projectDir, opts) -> {
 *     ok: boolean,
 *     created: string[],       // relative paths of NEW files written
 *     skipped: string[],       // relative paths that already existed (untouched)
 *     dispatchedVia: "bin/gsd-t.js case \"migrate-logging\"" (informational),
 *     scaffold: <seam envelope | PAUSED envelope>,
 *   }
 *   run(argv) -> Promise<void>   // CLI entry, used by the bin/gsd-t.js dispatch case
 */

const fs = require('fs');
const path = require('path');

const { scaffoldLogging } = require('./gsd-t-logging-scaffolder.cjs');
const { distillTraceCategories } = require('./gsd-t-trace-distill.cjs');
const { distillAuditActions } = require('./gsd-t-audit-distill.cjs');

const TRACE_TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'logging', 'trace-module.template.ts');
const AUDIT_TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'logging', 'audit-module.template.ts');

const TRACE_DEST_REL = path.join('src', 'logging', 'trace.ts');
const AUDIT_DEST_REL = path.join('src', 'logging', 'audit.ts');
const SCHEMA_DEST_REL = path.join('.gsd-t', 'logging-schema.json');

/**
 * Copies `srcPath` to `<projectDir>/<destRel>` ONLY IF the destination does
 * NOT already exist. Never overwrites. Returns 'created' | 'skipped'.
 */
function copyIfAbsent(projectDir, destRel, srcPath) {
  const destAbs = path.join(projectDir, destRel);
  if (fs.existsSync(destAbs)) {
    return 'skipped';
  }
  const destDir = path.dirname(destAbs);
  fs.mkdirSync(destDir, { recursive: true });
  const content = fs.readFileSync(srcPath, 'utf8');
  fs.writeFileSync(destAbs, content, 'utf8');
  return 'created';
}

/**
 * Writes the distilled per-project schema (trace categories + audit actions)
 * to `.gsd-t/logging-schema.json`, ONLY IF that file does not already exist.
 * Distills from `planPath` when provided and present; an absent/omitted plan
 * yields empty category/action lists (never confabulated) rather than an error.
 */
function writeDistilledSchemaIfAbsent(projectDir, planPath) {
  const destAbs = path.join(projectDir, SCHEMA_DEST_REL);
  if (fs.existsSync(destAbs)) {
    return { status: 'skipped', categories: [], actions: [] };
  }

  let categories = [];
  let actions = [];
  if (planPath && fs.existsSync(planPath)) {
    categories = distillTraceCategories(planPath).categories;
    actions = distillAuditActions(planPath).actions;
  }

  const dir = path.dirname(destAbs);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    destAbs,
    JSON.stringify({ categories, actions, distilledFrom: planPath || null }, null, 2) + '\n',
    'utf8'
  );
  return { status: 'created', categories, actions };
}

/**
 * migrateLogging(projectDir, opts) -> result
 *
 * opts:
 *   planPath  - optional path to the project's own plan, used to distill the
 *               per-project trace category / audit action schema. Absent ⇒
 *               empty schema (a question, never a confabulated guess).
 *   approve   - forwarded to scaffoldLogging(); when omitted the storage
 *               seam PAUSES for human approval (never silently picks) unless
 *               a valid choice is already recorded for this project.
 *
 * ADDITIVE / NON-DESTRUCTIVE: every write is preceded by an existence check;
 * a file that already exists in the target project is left byte-for-byte
 * untouched (recorded in `skipped`, never in `created`).
 */
function migrateLogging(projectDir, opts) {
  opts = opts || {};
  if (!projectDir || typeof projectDir !== 'string') {
    throw new Error('migrateLogging: projectDir is required');
  }
  if (!fs.existsSync(projectDir)) {
    throw new Error(`migrateLogging: projectDir does not exist: ${projectDir}`);
  }

  const created = [];
  const skipped = [];

  const traceResult = copyIfAbsent(projectDir, TRACE_DEST_REL, TRACE_TEMPLATE_PATH);
  (traceResult === 'created' ? created : skipped).push(TRACE_DEST_REL);

  const auditResult = copyIfAbsent(projectDir, AUDIT_DEST_REL, AUDIT_TEMPLATE_PATH);
  (auditResult === 'created' ? created : skipped).push(AUDIT_DEST_REL);

  const schemaResult = writeDistilledSchemaIfAbsent(projectDir, opts.planPath);
  (schemaResult.status === 'created' ? created : skipped).push(SCHEMA_DEST_REL);

  // Storage seam — d1's scaffolder. Deterministic-resume + human-pause
  // semantics are entirely owned by scaffoldLogging(); this module never
  // second-guesses or silently forces a backend.
  const scaffold = scaffoldLogging({ projectDir, approve: opts.approve });

  return {
    ok: true,
    created,
    skipped,
    dispatchedVia: 'bin/gsd-t.js case "migrate-logging" (wired by d1 — see logging-scaffold-seam-contract.md)',
    scaffold,
  };
}

module.exports = {
  migrateLogging,
  run,
  // Test surface:
  copyIfAbsent,
  writeDistilledSchemaIfAbsent,
  TRACE_DEST_REL,
  AUDIT_DEST_REL,
  SCHEMA_DEST_REL,
};

// ── CLI ──────────────────────────────────────────────────────────────────
//
// Usage: gsd-t migrate-logging <projectDir> [--plan <path>] [--approve <backend>]
//
// Invoked by bin/gsd-t.js's `case "migrate-logging"` dispatch as
// `run(args.slice(1))` — argv here EXCLUDES the leading "migrate-logging"
// subcommand token.

function _parseArgv(argv) {
  const out = { projectDir: null, planPath: null, approve: undefined };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--plan') out.planPath = argv[++i] || null;
    else if (a === '--approve') out.approve = argv[++i];
    else positional.push(a);
  }
  out.projectDir = positional[0] || null;
  return out;
}

async function run(argv) {
  const args = _parseArgv(argv || []);
  if (!args.projectDir) {
    process.stderr.write(
      'usage: gsd-t migrate-logging <projectDir> [--plan <path-to-plan.md>] [--approve <db-table|local-sqlite|local-jsonl>]\n'
    );
    process.exitCode = 64;
    return;
  }

  const result = migrateLogging(args.projectDir, { planPath: args.planPath, approve: args.approve });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (result.scaffold && result.scaffold.status === 'PAUSED') {
    // Storage choice not yet approved — informational exit, not a failure.
    process.exitCode = 0;
  }
}

if (require.main === module) {
  run(process.argv.slice(2)).catch((e) => {
    process.stderr.write(String((e && e.message) || e) + '\n');
    process.exit(1);
  });
}
