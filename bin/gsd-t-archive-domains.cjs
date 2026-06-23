/**
 * gsd-t-archive-domains.cjs
 *
 * Backlog #40 — Deterministic archive+sweep of a completed milestone's domain dirs.
 *
 * complete-milestone Step 7 was prose-only ("archive domains → clear .gsd-t/domains/") with no
 * enforcement, so a Level-3 agent skipped/partial-did the clear for ~30 milestones and 77 stale
 * domain dirs accumulated, polluting the file-disjointness oracle. This helper makes the sweep a
 * deterministic, idempotent, containment-guarded operation.
 *
 * Behavior — for an EXPLICIT set of the completing milestone's domains (NOT a blanket wipe; a
 * later still-active milestone may legitimately have live domains, e.g. M90 completing while
 * M87/M88 are queued):
 *   1. Copy each domain dir → <archiveDir>/domains/<name>/  (skip if already archived — idempotent)
 *   2. Remove it from .gsd-t/domains/                        (skip if already gone — idempotent)
 * Domains NOT in the set are left untouched.
 *
 * Containment guard ([[feedback_destructive_path_ops_containment]]): every removed path MUST resolve
 * INSIDE .gsd-t/domains/ AND NOT equal it. Predicate: resolved.startsWith(domainsRoot + sep) &&
 * resolved !== domainsRoot. Any violation aborts the whole run (fail-closed, no partial sweep).
 *
 * House style: { ok:true, ... } | { ok:false, error }; bad input → non-zero CLI exit; Node
 * built-ins only; sync APIs; zero deps.
 *
 * Usage:
 *   gsd-t archive-domains --domains d-a,d-b,d-c --archive .gsd-t/milestones/mNN-name-DATE [--projectDir .] [--dry-run] [--json]
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DOMAINS_SUBPATH = path.join('.gsd-t', 'domains');

/**
 * Archive + sweep the named domains.
 *
 * @param {object} opts
 * @param {string[]} opts.domains   — explicit domain dir names (the completing milestone's set)
 * @param {string}   opts.archiveDir — milestone archive dir (domains land under <archiveDir>/domains/)
 * @param {string}   [opts.projectDir] — project root (default cwd)
 * @param {boolean}  [opts.dryRun]   — compute the plan, write nothing
 * @returns {{ok:true, archived:string[], removed:string[], skipped:string[], dryRun:boolean}
 *          | {ok:false, error:string}}
 */
function archiveDomains({ domains, archiveDir, projectDir, dryRun = false } = {}) {
  if (!Array.isArray(domains) || domains.length === 0) {
    return { ok: false, error: 'archive-domains requires a non-empty --domains list (the completing milestone\'s domain set)' };
  }
  if (!archiveDir || typeof archiveDir !== 'string' || !archiveDir.trim()) {
    return { ok: false, error: 'archive-domains requires --archive <milestone archive dir>' };
  }

  const root = path.resolve(projectDir || process.cwd());
  const domainsRoot = path.resolve(root, DOMAINS_SUBPATH);
  const archiveRootAbs = path.isAbsolute(archiveDir) ? archiveDir : path.resolve(root, archiveDir);
  const archiveDomainsDir = path.join(archiveRootAbs, 'domains');

  // Validate every target up front (fail-closed: no partial sweep on a bad name).
  const plan = [];
  for (const name of domains) {
    if (!name || typeof name !== 'string' || name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
      return { ok: false, error: `invalid domain name (no path separators / dot-segments allowed): ${JSON.stringify(name)}` };
    }
    const srcAbs = path.resolve(domainsRoot, name);
    // CONTAINMENT GUARD: must resolve strictly INSIDE .gsd-t/domains/ (not outside, not equal).
    if (!(srcAbs.startsWith(domainsRoot + path.sep) && srcAbs !== domainsRoot)) {
      return { ok: false, error: `containment violation: ${name} resolves to ${srcAbs}, outside or equal to ${domainsRoot} — refusing` };
    }
    plan.push({ name, srcAbs, destAbs: path.join(archiveDomainsDir, name) });
  }

  const archived = [];
  const removed = [];
  const skipped = [];

  for (const { name, srcAbs, destAbs } of plan) {
    const srcExists = fs.existsSync(srcAbs);
    const destExists = fs.existsSync(destAbs);

    // IDEMPOTENT: nothing live and already archived → skip silently.
    if (!srcExists && destExists) { skipped.push(name); continue; }
    // Nothing live and not archived → the domain doesn't exist at all → skip (not an error;
    // re-running after a manual prune is valid).
    if (!srcExists && !destExists) { skipped.push(name); continue; }

    if (dryRun) {
      if (!destExists) archived.push(name);
      removed.push(name);
      continue;
    }

    // 1. Archive (copy) unless already archived.
    if (!destExists) {
      fs.mkdirSync(archiveDomainsDir, { recursive: true });
      fs.cpSync(srcAbs, destAbs, { recursive: true });
      archived.push(name);
    }
    // 2. Remove from live domains (containment re-checked at delete time).
    if (!(srcAbs.startsWith(domainsRoot + path.sep) && srcAbs !== domainsRoot)) {
      return { ok: false, error: `containment re-check failed at delete: ${srcAbs}` };
    }
    fs.rmSync(srcAbs, { recursive: true, force: true });
    removed.push(name);
  }

  return { ok: true, archived, removed, skipped, dryRun };
}

module.exports = { archiveDomains };

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
if (require.main === module) {
  const argv = process.argv.slice(2);
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') flags.dryRun = true;
    else if (a === '--json') flags.json = true;
    else if (a.startsWith('--') && i + 1 < argv.length) flags[a.slice(2)] = argv[++i];
  }

  const domains = (flags.domains || '').split(',').map((s) => s.trim()).filter(Boolean);
  const result = archiveDomains({
    domains,
    archiveDir: flags.archive,
    projectDir: flags.projectDir || process.cwd(),
    dryRun: !!flags.dryRun,
  });

  process.stdout.write(JSON.stringify(result) + '\n');
  process.exit(result.ok ? 0 : 1);
}
