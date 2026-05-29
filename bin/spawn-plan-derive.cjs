'use strict';

/**
 * GSD-T Spawn Plan Derive (M44 D8 T4)
 *
 * Deterministic projection of `.gsd-t/partition.md` + `.gsd-t/domains/*\/tasks.md`
 * into the current "incomplete tasks" slice. No LLM calls, no prompts, no
 * heuristics — just parsing + slicing.
 *
 * Contract: .gsd-t/contracts/spawn-plan-contract.md v1.0.0
 *
 * Consumed by: `bin/spawn-plan-writer.cjs` (when caller does NOT pass an
 * explicit `tasks: [...]` array).
 */

const fs = require('fs');
const path = require('path');

/**
 * Derive a `{milestone, wave, domains, tasks}` slice from on-disk partition
 * + tasks. The "current incomplete slice" is the next contiguous run of
 * tasks whose checkboxes are still unchecked (`[ ]`) across all domains in
 * the current wave.
 *
 * Gracefully returns an empty slice when partition.md is absent or no
 * incomplete tasks remain. Never throws for missing files.
 *
 * @param {object} [opts]
 * @param {string} [opts.projectDir='.']
 * @param {string} [opts.milestone]       filter hint (e.g. 'M44'); defaults to parsed from partition
 * @param {string|number} [opts.currentIter]   unused today; reserved for future iter-slicing
 * @returns {{ milestone: string|null, wave: string|null, domains: string[], tasks: Array<{id:string,title:string,status:string}> }}
 */
function derivePlanFromPartition(opts) {
  const projectDir = (opts && opts.projectDir) || '.';
  const result = { milestone: null, wave: null, domains: [], tasks: [] };

  const partitionPath = path.join(projectDir, '.gsd-t', 'partition.md');
  if (!fs.existsSync(partitionPath)) {
    return result;
  }

  let partitionText;
  try {
    partitionText = fs.readFileSync(partitionPath, 'utf8');
  } catch (_) {
    return result;
  }

  // Parse the milestone id (first `M\d+` in heading) and the wave we care
  // about. For now we pick the first wave with any incomplete tasks.
  const milestoneMatch = partitionText.match(/\b(M\d+)\b/);
  if (milestoneMatch) result.milestone = milestoneMatch[1];
  if (opts && opts.milestone) result.milestone = String(opts.milestone);

  // Enumerate domain dirs under .gsd-t/domains/
  const domainsRoot = path.join(projectDir, '.gsd-t', 'domains');
  const domains = _listDomains(domainsRoot, result.milestone);
  if (!domains.length) return result;

  // Collect incomplete tasks from each domain's tasks.md, grouped by wave.
  // If no explicit wave header is present, "unknown" groups them.
  const byWave = new Map();
  for (const d of domains) {
    const tasks = _parseTasks(path.join(domainsRoot, d, 'tasks.md'));
    for (const t of tasks) {
      if (!byWave.has(t.wave)) byWave.set(t.wave, []);
      byWave.get(t.wave).push({ ...t, domain: d });
    }
  }

  // Pick the wave with the most incomplete tasks; ties: first seen.
  let pickWave = null;
  let pickCount = -1;
  for (const [w, arr] of byWave) {
    const incomplete = arr.filter((t) => t.status !== 'done').length;
    if (incomplete > pickCount) {
      pickCount = incomplete;
      pickWave = w;
    }
  }
  if (pickWave == null) return result;

  const waveTasks = byWave.get(pickWave) || [];
  result.wave = pickWave;
  const seenDomains = new Set();
  for (const t of waveTasks) {
    if (t.domain) seenDomains.add(t.domain);
    result.tasks.push({
      id: t.id,
      title: t.title,
      status: t.status,
    });
  }
  result.domains = [...seenDomains];
  return result;
}

// ── internal parsers ──────────────────────────────────────────────────────

function _listDomains(dir, milestone) {
  if (!fs.existsSync(dir)) return [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return []; }
  const names = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (milestone) {
      // Normalize to lowercase m-prefix so we match `m44-d8-…`
      const prefix = String(milestone).toLowerCase() + '-';
      if (!e.name.toLowerCase().startsWith(prefix)) continue;
    }
    names.push(e.name);
  }
  return names.sort();
}

/**
 * Parse a domain tasks.md into a list of `{id, title, status, wave}`.
 * Recognizes:
 *   `- [ ] **M44-D8-T1** — title…`
 *   `- [x] **M44-D8-T1** — title…`
 *   `- [x] done (2026-04-23 · commit abc123) **M44-D8-T1** — title…`
 * Task-id pattern is `M\d+-D\d+-T\d+`. Wave comes from the nearest
 * preceding `## Wave N` header.
 */
function _parseTasks(tasksPath) {
  if (!fs.existsSync(tasksPath)) return [];
  let text;
  try { text = fs.readFileSync(tasksPath, 'utf8'); } catch (_) { return []; }

  const out = [];
  let currentWave = 'unknown';
  const lines = text.split('\n');
  for (const line of lines) {
    const waveMatch = line.match(/^##\s+Wave\s+(\d+)\b/i);
    if (waveMatch) {
      currentWave = 'wave-' + waveMatch[1];
      continue;
    }
    const m = line.match(/^-\s*\[([ xX])\][^\*]*\*\*(M\d+-D\d+-T\d+)\*\*\s*[—-]\s*(.+)$/);
    if (!m) continue;
    const checked = m[1].toLowerCase() === 'x';
    const id = m[2];
    let title = m[3].trim();
    // Strip trailing " — sub-note" if present; keep only the primary title.
    // The task title may contain em-dashes; safer to just use the first line.
    title = title.split(/\s{2,}/)[0].trim();
    out.push({
      id,
      title,
      status: checked ? 'done' : 'pending',
      wave: currentWave,
    });
  }
  return out;
}

module.exports = {
  derivePlanFromPartition,
  _parseTasks,
  _listDomains,
};
