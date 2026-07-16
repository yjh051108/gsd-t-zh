'use strict';

const fs = require('fs');
const path = require('path');
const {
  renderPreamble,
  renderCwdInvariant,
  renderTemplate
} = require('./gsd-t-task-brief-template.cjs');
const {
  compactToTarget,
  TaskBriefTooLarge
} = require('./gsd-t-task-brief-compactor.cjs');

const DEFAULT_MAX_BYTES = 5000;

function readFileIfExists(fp) {
  try { return fs.readFileSync(fp, 'utf8'); } catch (_) { return ''; }
}

function escapeForPrompt(s) {
  return String(s).replace(/\r\n/g, '\n');
}

function extractTask(tasksMd, taskId) {
  if (!tasksMd) return null;
  const lines = tasksMd.split('\n');
  const idMatch = /^d\d+-t(\d+)$/.exec(taskId) || /^([A-Za-z0-9_-]+)-?t?(\d+)$/i.exec(taskId);
  const num = idMatch ? parseInt(idMatch[idMatch.length - 1], 10) : null;
  if (num == null) return null;

  const headerRe = new RegExp('^###\\s+Task\\s+' + num + '\\b');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headerRe.test(lines[i])) { start = i; break; }
  }
  if (start < 0) return null;

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^###\s+/.test(lines[i]) || /^##\s+/.test(lines[i])) { end = i; break; }
  }
  const body = lines.slice(start, end).join('\n').trim();
  const contractRefs = [];
  const refsMatch = /\*\*Contract refs\*\*:\s*(.+)/.exec(body);
  if (refsMatch) {
    for (const ref of refsMatch[1].split(',')) {
      const trimmed = ref.trim().replace(/^`|`$/g, '');
      if (trimmed && trimmed !== 'N/A') contractRefs.push(trimmed);
    }
  }
  return { body, contractRefs };
}

function extractSection(md, headerRegex) {
  if (!md) return '';
  const lines = md.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headerRegex.test(lines[i])) { start = i + 1; break; }
  }
  if (start < 0) return '';
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join('\n').trim();
}

function buildScopeSection(scopeMd) {
  const owned = extractSection(scopeMd, /^##\s+Owned\s+Files/i);
  const notOwned = extractSection(scopeMd, /^##\s+NOT\s+Owned/i);
  const parts = [];
  if (owned) parts.push('### Owned Files/Directories\n' + owned);
  if (notOwned) parts.push('### NOT Owned (do not modify)\n' + notOwned);
  return parts.join('\n\n');
}

function buildConstraintsSection(constraintsMd) {
  const must = extractSection(constraintsMd, /^##\s+Must\s+Follow/i);
  const mustNot = extractSection(constraintsMd, /^##\s+Must\s+Not/i);
  const parts = [];
  if (must) parts.push('### Must Follow\n' + must);
  if (mustNot) parts.push('### Must Not\n' + mustNot);
  return parts.join('\n\n');
}

function buildContractExcerpts(projectDir, contractRefs) {
  if (!contractRefs || !contractRefs.length) return '';
  const chunks = [];
  for (const ref of contractRefs) {
    const rel = ref.startsWith('.') ? ref : path.join('.gsd-t', 'contracts', path.basename(ref));
    const abs = path.isAbsolute(rel) ? rel : path.join(projectDir, rel);
    const content = readFileIfExists(abs);
    if (!content) continue;
    const firstLine = content.split('\n', 1)[0];
    const title = firstLine.replace(/^#\s*/, '').trim() || path.basename(abs);
    chunks.push('### ' + title + ' (' + path.basename(abs) + ')\n' + content.trim());
  }
  return chunks.join('\n\n');
}

function detectStack(projectDir) {
  const stacks = [];
  const pkgPath = path.join(projectDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
      if (deps.react) stacks.push('react');
      if (deps.typescript || deps['@types/node']) stacks.push('typescript');
      if (deps.next) stacks.push('nextjs');
      if (deps.vue) stacks.push('vue');
      if (deps['@playwright/test'] || deps.playwright) stacks.push('playwright');
      if (deps.express || deps.fastify || deps.hono) stacks.push('node-api');
      if (deps.tailwindcss) stacks.push('tailwind');
      if (deps.prisma || deps['@prisma/client']) stacks.push('prisma');
    } catch (_) { /* ignore */ }
  }
  if (fs.existsSync(path.join(projectDir, 'requirements.txt')) ||
      fs.existsSync(path.join(projectDir, 'pyproject.toml'))) {
    stacks.push('python');
  }
  return stacks;
}

function loadStackRules(projectDir, stacks) {
  const packageRoot = path.resolve(__dirname, '..');
  const stacksDir = path.join(packageRoot, 'templates', 'stacks');
  if (!fs.existsSync(stacksDir)) return '';
  const universal = [];
  for (const fname of fs.readdirSync(stacksDir).sort()) {
    // Load base .md only; .zh-CN.md are locale-specific install variants
    if (fname.startsWith('_') && fname.endsWith('.md') && !fname.endsWith('.zh-CN.md')) {
      universal.push(readFileIfExists(path.join(stacksDir, fname)).trim());
    }
  }
  const specific = [];
  for (const stack of stacks) {
    const fp = path.join(stacksDir, stack + '.md');
    if (fs.existsSync(fp)) specific.push(readFileIfExists(fp).trim());
  }
  return [...universal, ...specific].filter(Boolean).join('\n\n');
}

function buildCompletionSpec(projectDir) {
  const contractFp = path.join(projectDir, '.gsd-t', 'contracts', 'completion-signal-contract.md');
  const content = readFileIfExists(contractFp);
  if (!content) {
    throw new Error('buildTaskBrief requires .gsd-t/contracts/completion-signal-contract.md');
  }
  const doneSignal = extractSection(content, /^##\s+Done\s+Signal/i);
  if (!doneSignal) {
    throw new Error('completion-signal-contract.md missing ## Done Signal section');
  }
  return '### Done Signal (all must hold)\n' + doneSignal;
}

function readProjectName(projectDir) {
  const pkgPath = path.join(projectDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.name) return pkg.name;
    } catch (_) { /* ignore */ }
  }
  return path.basename(projectDir);
}

function buildTaskBrief(opts) {
  const {
    milestone,
    domain,
    taskId,
    projectDir,
    expectedBranch = 'main',
    maxBytes = DEFAULT_MAX_BYTES
  } = opts || {};

  if (!milestone) throw new Error('buildTaskBrief requires milestone');
  if (!domain) throw new Error('buildTaskBrief requires domain');
  if (!taskId) throw new Error('buildTaskBrief requires taskId');
  if (!projectDir) throw new Error('buildTaskBrief requires projectDir');

  const domainDir = path.join(projectDir, '.gsd-t', 'domains', domain);
  if (!fs.existsSync(domainDir)) {
    throw new Error('buildTaskBrief: domain dir not found: ' + domainDir);
  }

  const tasksMd = readFileIfExists(path.join(domainDir, 'tasks.md'));
  const scopeMd = readFileIfExists(path.join(domainDir, 'scope.md'));
  const constraintsMd = readFileIfExists(path.join(domainDir, 'constraints.md'));

  const taskEntry = extractTask(tasksMd, taskId);
  if (!taskEntry) {
    throw new Error('buildTaskBrief: task not found in ' + domain + '/tasks.md: ' + taskId);
  }

  const projectName = readProjectName(projectDir);
  const preamble = renderPreamble({
    projectName: escapeForPrompt(projectName),
    milestone: escapeForPrompt(milestone),
    domain: escapeForPrompt(domain),
    taskId: escapeForPrompt(taskId),
    expectedBranch: escapeForPrompt(expectedBranch),
    projectDir: escapeForPrompt(projectDir)
  });

  const cwdInvariant = renderCwdInvariant(projectDir);
  const taskStatement = escapeForPrompt(taskEntry.body);
  const scope = buildScopeSection(scopeMd) || '(no scope.md sections found)';
  const constraints = buildConstraintsSection(constraintsMd) || '(no constraints.md sections found)';
  const contractExcerpts = buildContractExcerpts(projectDir, taskEntry.contractRefs);
  const stacks = detectStack(projectDir);
  const stackRules = loadStackRules(projectDir, stacks);
  const completionSpec = buildCompletionSpec(projectDir);

  const sections = {
    preamble,
    taskStatement,
    scope,
    constraintsMustFollow: constraints,
    contractExcerpts,
    stackRules,
    completionSpec,
    cwdInvariant
  };

  const compacted = compactToTarget(sections, maxBytes);

  return renderTemplate({
    preamble: compacted.preamble,
    taskStatement: compacted.taskStatement,
    scope: compacted.scope,
    constraints: compacted.constraintsMustFollow,
    contractExcerpts: compacted.contractExcerpts,
    stackRules: compacted.stackRules,
    completionSpec: compacted.completionSpec,
    cwdInvariant: compacted.cwdInvariant
  });
}

module.exports = {
  buildTaskBrief,
  DEFAULT_MAX_BYTES,
  TaskBriefTooLarge,
  detectStack,
  extractTask,
  extractSection
};
