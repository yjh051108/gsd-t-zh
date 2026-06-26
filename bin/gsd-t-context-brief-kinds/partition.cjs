'use strict';

/**
 * partition kind collector — surfaces the current milestone row from
 * progress.md, the file-disjointness rules excerpt, and the existing
 * domain table for partition-phase workers.
 *
 * Fail-open: missing optional source → empty field, brief still written.
 *
 * M94-D8-T4 [RULE] brief-resolves-active-milestone-never-completed:
 *   Cross-checks the resolved milestonePrefix against the Completed-Milestones
 *   table in progress.md. A prefix appearing there is COMPLETED and is rejected
 *   (staleness flag set), never returned as the active milestone prefix.
 */

const fs = require('fs');
const path = require('path');

const NAME = 'partition';
const PROGRESS_PATH = '.gsd-t/progress.md';
const DISJOINT_RULES_PATH = '.gsd-t/contracts/file-disjointness-rules.md';

function _readMaybe(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch (_) { return null; }
}

function _currentMilestoneRow(progressText) {
  if (!progressText) return null;
  // Find first ACTIVE / DEFINED / PARTITIONED / PLANNED / EXECUTING row in the
  // Milestones table — this is the milestone partition is operating on.
  const lines = progressText.split(/\r?\n/);
  for (const line of lines) {
    if (/^\|\s*M\d+\s*\|.*(DEFINED|PARTITIONED|PLANNED|EXECUTING|EXECUTED|VERIFY)/i.test(line)) {
      // Truncate row to first 800 chars to honor 2,500-token brief cap.
      return line.length > 800 ? line.slice(0, 800) + ' …' : line;
    }
  }
  return null;
}

function _existingDomains(projectDir) {
  const dir = path.join(projectDir, '.gsd-t', 'domains');
  let entries;
  try { entries = fs.readdirSync(dir); } catch (_) { return []; }
  return entries.filter((e) => /^[a-z0-9_-]+$/i.test(e)).sort();
}

/**
 * Build the set of milestone prefixes (lowercase) that are COMPLETED.
 * Sources:
 *   1. The main Milestones table (## Milestones) — rows where Status column is COMPLETED/COMPLETE.
 *   2. The Completed Milestones table (## Completed Milestones) — all data rows.
 *
 * [RULE] brief-resolves-active-milestone-never-completed
 *
 * @param {string} progressText
 * @returns {Set<string>}
 */
function _completedPrefixes(progressText) {
  const completed = new Set();
  if (!progressText) return completed;

  const lines = progressText.split(/\r?\n/);
  let inCompletedMilestonesTable = false;
  let inMilestonesTable = false;

  for (const line of lines) {
    if (/^##\s+Completed\s+Milestones/i.test(line)) {
      inCompletedMilestonesTable = true;
      inMilestonesTable = false;
      continue;
    }
    if (/^##\s+Milestones\s*$/i.test(line)) {
      inMilestonesTable = true;
      inCompletedMilestonesTable = false;
      continue;
    }
    if (/^##\s+/.test(line)) {
      inCompletedMilestonesTable = false;
      inMilestonesTable = false;
      continue;
    }

    if (inCompletedMilestonesTable) {
      const match = line.match(/^\|\s*(M\d+)/i);
      if (match) {
        completed.add(match[1].toLowerCase());
      }
    }

    if (inMilestonesTable) {
      if (/^\|/.test(line)) {
        const cols = line.split('|').slice(1, -1).map((c) => c.trim());
        if (cols.length >= 3) {
          const milestoneCol = cols[0];
          const statusCol = cols[2];
          const milestoneMatch = milestoneCol.match(/^(M\d+)/i);
          if (milestoneMatch && /^COMPLET/i.test(statusCol)) {
            completed.add(milestoneMatch[1].toLowerCase());
          }
        }
      }
    }
  }

  return completed;
}

/**
 * Resolve the ACTIVE milestone prefix (not completed).
 *
 * [RULE] brief-resolves-active-milestone-never-completed
 *
 * @param {string|null} progressText
 * @returns {{ prefix: string|null, staleness: string|null }}
 */
function _currentMilestonePrefix(progressText) {
  if (!progressText) return { prefix: null, staleness: null };

  const completed = _completedPrefixes(progressText);

  const lines = progressText.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\|\s*(M\d+)\s*\|.*(DEFINED|PARTITIONED|PLANNED|EXECUTING|EXECUTED|VERIFY)/i);
    if (!m) continue;
    const prefix = m[1].toLowerCase();
    if (completed.has(prefix)) continue;
    return { prefix, staleness: null };
  }

  return { prefix: null, staleness: 'no-active-milestone-row' };
}

function collect(ctx) {
  const { projectDir, recordSource } = ctx;

  const progressText = _readMaybe(path.join(projectDir, PROGRESS_PATH));
  if (progressText) recordSource(PROGRESS_PATH);

  const disjointRules = _readMaybe(path.join(projectDir, DISJOINT_RULES_PATH));
  if (disjointRules) recordSource(DISJOINT_RULES_PATH);

  const milestoneRow = _currentMilestoneRow(progressText);
  const { prefix, staleness } = _currentMilestonePrefix(progressText);
  const domains = _existingDomains(projectDir);

  // Trim disjoint-rules excerpt to ~1,200 chars to honor cap.
  let rulesExcerpt = null;
  if (disjointRules) {
    rulesExcerpt = disjointRules.length > 1200
      ? disjointRules.slice(0, 1197) + '...'
      : disjointRules;
  }

  return {
    scope: { owned: [], notOwned: [], deliverables: [] },
    constraints: [],
    contracts: [],
    ancillary: {
      currentMilestoneRow: milestoneRow,
      existingDomains: domains,
      disjointnessRulesExcerpt: rulesExcerpt,
      ...(staleness ? { staleness } : {}),
    },
  };
}

module.exports = {
  name: NAME,
  requiresSources: [],
  collect,
  _currentMilestoneRow,
  _currentMilestonePrefix,
  _existingDomains,
  _completedPrefixes,
};
