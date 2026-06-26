'use strict';

/**
 * plan kind collector — surfaces the current milestone row plus a list of
 * partitioned domain names with their scope.md "Files Owned" first-N entries.
 *
 * Fail-open: missing optional source → empty field, brief still written.
 *
 * M94-D8-T4 [RULE] brief-resolves-active-milestone-never-completed:
 *   The resolved milestonePrefix MUST belong to an ACTIVE (not COMPLETED) milestone.
 *   Cross-check against the Completed-Milestones table in progress.md before returning.
 *   If the resolved prefix appears in the Completed-Milestones table (or the main Milestones
 *   table with a COMPLETED status), it is rejected and ancillary.staleness is set.
 */

const fs = require('fs');
const path = require('path');

const NAME = 'plan';
const PROGRESS_PATH = '.gsd-t/progress.md';

function _readMaybe(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch (_) { return null; }
}

function _currentMilestoneRow(progressText) {
  if (!progressText) return null;
  const lines = progressText.split(/\r?\n/);
  for (const line of lines) {
    if (/^\|\s*M\d+\s*\|.*(DEFINED|PARTITIONED|PLANNED|EXECUTING|EXECUTED|VERIFY)/i.test(line)) {
      return line.length > 800 ? line.slice(0, 800) + ' …' : line;
    }
  }
  return null;
}

/**
 * Build the set of milestone prefixes (lowercase) that are COMPLETED.
 * Sources:
 *   1. The main Milestones table (## Milestones) — rows where the Status column is COMPLETED/COMPLETE.
 *   2. The Completed Milestones table (## Completed Milestones) — all data rows.
 *
 * Returns a Set<string> of lowercase prefix strings like 'm65', 'm93', etc.
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
    // Detect the "## Completed Milestones" section header.
    if (/^##\s+Completed\s+Milestones/i.test(line)) {
      inCompletedMilestonesTable = true;
      inMilestonesTable = false;
      continue;
    }
    // Detect the "## Milestones" section header (not "## Completed Milestones").
    if (/^##\s+Milestones\s*$/i.test(line)) {
      inMilestonesTable = true;
      inCompletedMilestonesTable = false;
      continue;
    }
    // Stop tracking on any other heading.
    if (/^##\s+/.test(line)) {
      inCompletedMilestonesTable = false;
      inMilestonesTable = false;
      continue;
    }

    if (inCompletedMilestonesTable) {
      // All data rows in the Completed Milestones table are completed milestones.
      // Row format: | M93 Brevity Guard | 4.9.11 | ...
      // or: | M93 | ... | COMPLETED | ...
      const match = line.match(/^\|\s*(M\d+)/i);
      if (match) {
        completed.add(match[1].toLowerCase());
      }
    }

    if (inMilestonesTable) {
      // Rows in the main Milestones table with COMPLETED or COMPLETE status.
      // Row format: | M65 | Orchestration-Shell Retirement | COMPLETED | ...
      // The status is the 3rd pipe-column.
      if (/^\|/.test(line)) {
        const cols = line.split('|').slice(1, -1).map((c) => c.trim());
        if (cols.length >= 3) {
          const milestoneCol = cols[0]; // e.g. "M65"
          const statusCol = cols[2];    // e.g. "COMPLETED"
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

function _domainSummaries(projectDir, currentMilestonePrefix, recordSource) {
  const dir = path.join(projectDir, '.gsd-t', 'domains');
  let entries;
  try { entries = fs.readdirSync(dir); } catch (_) { return []; }
  const out = [];
  for (const name of entries.sort()) {
    if (currentMilestonePrefix && !name.startsWith(currentMilestonePrefix)) continue;
    const scopePath = '.gsd-t/domains/' + name + '/scope.md';
    const scopeText = _readMaybe(path.join(projectDir, scopePath));
    if (!scopeText) continue;
    if (recordSource) recordSource(scopePath);
    // First "## Responsibility" paragraph + first 3 "Files Owned" bullets.
    let resp = '';
    const respMatch = scopeText.match(/^##\s+Responsibility\s*\n([^\n]+)/mi);
    if (respMatch) resp = respMatch[1].trim().slice(0, 200);
    const files = [];
    const filesBody = scopeText.match(/^##\s+Files Owned\s*\n([\s\S]*?)(?=^##\s+|\s*$)/mi);
    if (filesBody) {
      const bullets = filesBody[1].split(/\r?\n/).filter((l) => /^[-*]\s+/.test(l)).slice(0, 3);
      for (const b of bullets) {
        const m = b.match(/^[-*]\s+`([^`]+)`/);
        if (m) files.push(m[1]);
      }
    }
    out.push({ domain: name, responsibility: resp, filesOwnedFirst3: files });
  }
  return out;
}

/**
 * Resolve the ACTIVE milestone prefix from the progress text.
 * Returns the prefix string (e.g. 'm94') if found and NOT completed, or null.
 * Also returns a staleness flag if a resolved prefix is completed.
 *
 * [RULE] brief-resolves-active-milestone-never-completed
 *
 * @param {string|null} progressText
 * @returns {{ prefix: string|null, staleness: string|null }}
 */
function _currentMilestonePrefix(progressText) {
  if (!progressText) return { prefix: null, staleness: null };

  // Build the completed set FIRST for cross-checking.
  const completed = _completedPrefixes(progressText);

  // Walk all matching rows and return the first one that is NOT completed.
  const lines = progressText.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\|\s*(M\d+)\s*\|.*(DEFINED|PARTITIONED|PLANNED|EXECUTING|EXECUTED|VERIFY)/i);
    if (!m) continue;
    const prefix = m[1].toLowerCase();
    if (completed.has(prefix)) {
      // This row's milestone is COMPLETED — skip it, continue scanning.
      continue;
    }
    // Found an active (non-completed) milestone row.
    return { prefix, staleness: null };
  }

  // No active milestone row found (or all candidates are completed).
  return { prefix: null, staleness: 'no-active-milestone-row' };
}

function collect(ctx) {
  const { projectDir, recordSource } = ctx;

  const progressText = _readMaybe(path.join(projectDir, PROGRESS_PATH));
  if (progressText) recordSource(PROGRESS_PATH);

  const milestoneRow = _currentMilestoneRow(progressText);
  const { prefix, staleness } = _currentMilestonePrefix(progressText);
  const domains = _domainSummaries(projectDir, prefix, recordSource);

  return {
    scope: { owned: [], notOwned: [], deliverables: [] },
    constraints: [],
    contracts: [],
    ancillary: {
      currentMilestoneRow: milestoneRow,
      milestonePrefix: prefix,
      partitionedDomains: domains,
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
  _domainSummaries,
  _completedPrefixes,
};
