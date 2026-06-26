'use strict';

/**
 * impact kind collector — surfaces current state from progress.md, the
 * integration-points contract for the active milestone, and a git diff
 * summary so an impact-analysis worker can understand the blast radius.
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
const { execSync } = require('child_process');

const NAME = 'impact';
const PROGRESS_PATH = '.gsd-t/progress.md';

function _readMaybe(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch (_) { return null; }
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

function _integrationPointsExcerpt(projectDir, prefix, recordSource) {
  if (!prefix) return null;
  const candidates = [
    '.gsd-t/contracts/' + prefix + '-integration-points.md',
    '.gsd-t/contracts/integration-points.md',
  ];
  for (const rel of candidates) {
    const text = _readMaybe(path.join(projectDir, rel));
    if (text) {
      if (recordSource) recordSource(rel);
      return text.length > 1500 ? text.slice(0, 1497) + '...' : text;
    }
  }
  return null;
}

function _gitDiffSummary(projectDir) {
  try {
    const stdout = execSync('git diff --shortstat HEAD', {
      cwd: projectDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    });
    return String(stdout || '').trim() || null;
  } catch (_) {
    return null;
  }
}

function _gitDiffNames(projectDir) {
  try {
    const stdout = execSync('git diff --name-only HEAD', {
      cwd: projectDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    });
    return String(stdout || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 30);
  } catch (_) {
    return [];
  }
}

function collect(ctx) {
  const { projectDir, recordSource } = ctx;

  const progressText = _readMaybe(path.join(projectDir, PROGRESS_PATH));
  if (progressText) recordSource(PROGRESS_PATH);

  const { prefix, staleness } = _currentMilestonePrefix(progressText);
  const integration = _integrationPointsExcerpt(projectDir, prefix, recordSource);

  return {
    scope: { owned: [], notOwned: [], deliverables: [] },
    constraints: [],
    contracts: [],
    ancillary: {
      milestonePrefix: prefix,
      integrationPointsExcerpt: integration,
      gitDiffSummary: _gitDiffSummary(projectDir),
      changedFiles: _gitDiffNames(projectDir),
      ...(staleness ? { staleness } : {}),
    },
  };
}

module.exports = {
  name: NAME,
  requiresSources: [],
  collect,
  _currentMilestonePrefix,
  _integrationPointsExcerpt,
  _completedPrefixes,
};
