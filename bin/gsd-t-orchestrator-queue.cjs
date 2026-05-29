'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_WAVE = 0;

function listDomainTaskFiles(projectDir) {
  const domainsDir = path.join(projectDir, '.gsd-t', 'domains');
  if (!fs.existsSync(domainsDir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(domainsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const p = path.join(domainsDir, entry.name, 'tasks.md');
    if (fs.existsSync(p)) out.push({ domain: entry.name, file: p });
  }
  return out.sort((a, b) => a.domain.localeCompare(b.domain));
}

function parseFilesField(text) {
  const patterns = [];
  const seen = new Set();
  const re = /`([^`]+)`/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    const pattern = raw.replace(/\/$/, '/**');
    if (!seen.has(pattern)) { seen.add(pattern); patterns.push(pattern); }
  }
  if (patterns.length === 0) {
    for (const part of text.split(/[,;]/)) {
      const raw = part.replace(/\([^)]*\)/g, '').trim();
      if (raw && !/^(none|n\/a)$/i.test(raw) && !seen.has(raw)) {
        seen.add(raw); patterns.push(raw);
      }
    }
  }
  return patterns;
}

function parseTasksFile(markdown, domain) {
  const tasks = [];
  const lines = markdown.split(/\r?\n/);

  let current = null;

  const commitCurrent = () => {
    if (current) {
      if (current.wave == null) current.wave = DEFAULT_WAVE;
      if (!current.dependencies) current.dependencies = [];
      if (!current.ownedPatterns) current.ownedPatterns = [];
      tasks.push(current);
    }
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const taskHeader = line.match(/^###\s+Task\s+(\d+)\s*:\s*(.+?)\s*$/i);
    if (taskHeader) {
      commitCurrent();
      current = {
        domain,
        id: `${domain}:T${taskHeader[1]}`,
        taskNum: parseInt(taskHeader[1], 10),
        title: taskHeader[2].trim(),
        wave: null,
        dependencies: [],
        ownedPatterns: []
      };
      continue;
    }
    if (!current) continue;

    const waveMatch = line.match(/^\s*-\s*\*\*Wave\*\*\s*:\s*(\d+)\s*$/i);
    if (waveMatch) {
      current.wave = parseInt(waveMatch[1], 10);
      continue;
    }

    const depMatch = line.match(/^\s*-\s*\*\*Dependencies\*\*\s*:\s*(.+?)\s*$/i);
    if (depMatch) {
      current.dependencies = parseDependencies(depMatch[1], domain);
      continue;
    }

    const filesMatch = line.match(/^\s*-\s*\*\*Files\*\*\s*:\s*(.+?)\s*$/i);
    if (filesMatch) {
      current.ownedPatterns = parseFilesField(filesMatch[1]);
      continue;
    }
  }
  commitCurrent();
  return tasks;
}

function parseDependencies(text, domain) {
  const trimmed = text.trim();
  if (!trimmed || /^none$/i.test(trimmed) || /^n\/a$/i.test(trimmed)) return [];

  const deps = [];
  const seen = new Set();

  const push = (id) => {
    if (!seen.has(id)) { seen.add(id); deps.push(id); }
  };

  const sameDomainTaskRe = /\bTask\s+(\d+)\b/gi;
  const crossDomainRe = /\b([a-z][a-z0-9-]+)\s+Task\s+(\d+)\b/gi;

  let m;
  while ((m = crossDomainRe.exec(trimmed)) !== null) {
    const prefix = m[1].toLowerCase();
    if (prefix === 'requires' || prefix === 'blocked') continue;
    push(`${prefix}:T${m[2]}`);
  }

  const crossIds = new Set(deps);
  sameDomainTaskRe.lastIndex = 0;
  while ((m = sameDomainTaskRe.exec(trimmed)) !== null) {
    const id = `${domain}:T${m[1]}`;
    const crossMatch = [...crossIds].some((d) => d.endsWith(`:T${m[1]}`) && d !== id);
    if (!crossMatch) push(id);
  }

  return deps;
}

function readAllTasks(projectDir) {
  const all = [];
  for (const { domain, file } of listDomainTaskFiles(projectDir)) {
    const md = fs.readFileSync(file, 'utf8');
    all.push(...parseTasksFile(md, domain));
  }
  return all;
}

function groupByWave(tasks) {
  const groups = new Map();
  for (const t of tasks) {
    const w = t.wave == null ? DEFAULT_WAVE : t.wave;
    if (!groups.has(w)) groups.set(w, []);
    groups.get(w).push(t);
  }
  return new Map([...groups.entries()].sort((a, b) => a[0] - b[0]));
}

function validateNoForwardDeps(tasks) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const errors = [];
  for (const t of tasks) {
    for (const depId of t.dependencies) {
      const dep = byId.get(depId);
      if (!dep) continue;
      if (dep.wave > t.wave) {
        errors.push(
          `Task ${t.id} (wave ${t.wave}) depends on ${depId} (wave ${dep.wave}) — forward cross-wave dependency not allowed`
        );
      }
    }
  }
  if (errors.length) {
    const err = new Error(`Wave dependency validation failed:\n  ${errors.join('\n  ')}`);
    err.errors = errors;
    throw err;
  }
  return true;
}

module.exports = {
  DEFAULT_WAVE,
  listDomainTaskFiles,
  parseTasksFile,
  parseDependencies,
  parseFilesField,
  readAllTasks,
  groupByWave,
  validateNoForwardDeps
};
