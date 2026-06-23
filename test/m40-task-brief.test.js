'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { buildTaskBrief, extractTask, extractSection } = require('../bin/gsd-t-task-brief.js');

function mkFixtureProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm40-brief-'));
  const domainDir = path.join(dir, '.gsd-t', 'domains', 'd-fixture');
  const contractsDir = path.join(dir, '.gsd-t', 'contracts');
  fs.mkdirSync(domainDir, { recursive: true });
  fs.mkdirSync(contractsDir, { recursive: true });

  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    name: 'fixture-pkg',
    version: '1.0.0'
  }));

  fs.writeFileSync(path.join(domainDir, 'scope.md'), [
    '# Domain: d-fixture',
    '',
    '## Owned Files/Directories',
    '- `bin/fixture.js` — entry point',
    '',
    '## NOT Owned (do not modify)',
    '- anything outside bin/',
    ''
  ].join('\n'));

  fs.writeFileSync(path.join(domainDir, 'constraints.md'), [
    '# Constraints: d-fixture',
    '',
    '## Must Follow',
    '- Zero deps.',
    '- Pure functions.',
    '',
    '## Must Not',
    '- Use sync network calls.',
    ''
  ].join('\n'));

  fs.writeFileSync(path.join(domainDir, 'tasks.md'), [
    '# Tasks: d-fixture',
    '',
    '### Task 1: Do the thing',
    '- **Files**: `bin/fixture.js` (NEW)',
    '- **Contract refs**: `.gsd-t/contracts/completion-signal-contract.md`',
    '- **Dependencies**: NONE',
    '- **Wave**: 0',
    '- **Acceptance criteria**:',
    '  - Exports doThing()',
    ''
  ].join('\n'));

  fs.writeFileSync(path.join(contractsDir, 'completion-signal-contract.md'), [
    '# Completion Signal Contract — v1.0.0',
    '',
    '## Done Signal (all must hold)',
    '',
    '| # | Condition | How checked |',
    '|---|-----------|-------------|',
    '| 1 | Worker exit code == 0 | `child_process` exit |',
    '| 2 | ≥1 new commit on expectedBranch | git log |',
    '| 3 | progress.md Decision Log has a new entry | text scan |',
    '| 4 | npm test passes (unless skip-test) | execSync |',
    '| 5 | No uncommitted changes in owned patterns | git status |',
    ''
  ].join('\n'));

  return dir;
}

test('extractTask: finds task by id and captures contract refs', () => {
  const md = [
    '### Task 3: Worker lifecycle',
    '- **Contract refs**: `.gsd-t/contracts/a.md`, `.gsd-t/contracts/b.md`',
    '- **Wave**: 0'
  ].join('\n');
  const t = extractTask(md, 'd1-t3');
  assert.ok(t);
  assert.ok(t.body.includes('Worker lifecycle'));
  assert.deepEqual(t.contractRefs, ['.gsd-t/contracts/a.md', '.gsd-t/contracts/b.md']);
});

test('extractSection: returns everything between header and next ##', () => {
  const md = '## A\nline1\nline2\n## B\nother\n';
  assert.equal(extractSection(md, /^##\s+A/), 'line1\nline2');
});

test('buildTaskBrief: happy path — includes all required sections', () => {
  const dir = mkFixtureProject();
  const brief = buildTaskBrief({
    milestone: 'M-test',
    domain: 'd-fixture',
    taskId: 'd-fixture-t1',
    projectDir: dir,
    expectedBranch: 'main'
  });

  assert.ok(brief.includes('You are a GSD-T orchestrator worker'));
  assert.ok(brief.includes('Project: fixture-pkg'));
  assert.ok(brief.includes('Milestone: M-test'));
  assert.ok(brief.includes('Domain: d-fixture'));
  assert.ok(brief.includes('Task: d-fixture-t1'));
  assert.ok(brief.includes('Expected branch: main'));

  assert.ok(brief.includes('## Task'));
  assert.ok(brief.includes('Do the thing'));
  assert.ok(brief.includes('## Scope'));
  assert.ok(brief.includes('bin/fixture.js'));
  assert.ok(brief.includes('## Constraints'));
  assert.ok(brief.includes('Zero deps'));
  assert.ok(brief.includes('## Done Signal'));
  assert.ok(brief.includes('## CWD Invariant'));
  assert.ok(brief.includes('pwd'));
});

test('buildTaskBrief: deterministic — same inputs → byte-identical output', () => {
  const dir = mkFixtureProject();
  const opts = {
    milestone: 'M-test',
    domain: 'd-fixture',
    taskId: 'd-fixture-t1',
    projectDir: dir
  };
  const a = buildTaskBrief(opts);
  const b = buildTaskBrief(opts);
  assert.equal(a, b);
});

test('buildTaskBrief: includes Done Signal checklist verbatim from contract', () => {
  const dir = mkFixtureProject();
  const brief = buildTaskBrief({
    milestone: 'M-test',
    domain: 'd-fixture',
    taskId: 'd-fixture-t1',
    projectDir: dir
  });
  assert.ok(brief.includes('Worker exit code == 0'));
  assert.ok(brief.includes('≥1 new commit on expectedBranch'));
  assert.ok(brief.includes('No uncommitted changes in owned patterns'));
});

test('buildTaskBrief: CWD Invariant block includes projectDir', () => {
  const dir = mkFixtureProject();
  const brief = buildTaskBrief({
    milestone: 'M-test',
    domain: 'd-fixture',
    taskId: 'd-fixture-t1',
    projectDir: dir
  });
  assert.ok(brief.includes(dir), 'CWD invariant should embed project dir');
  assert.ok(brief.includes('STOP and fail fast'));
});

test('buildTaskBrief: throws if domain dir missing', () => {
  const dir = mkFixtureProject();
  assert.throws(() => buildTaskBrief({
    milestone: 'M-test',
    domain: 'd-nonexistent',
    taskId: 'd-nonexistent-t1',
    projectDir: dir
  }), /domain dir not found/);
});

test('buildTaskBrief: throws if task not found', () => {
  const dir = mkFixtureProject();
  assert.throws(() => buildTaskBrief({
    milestone: 'M-test',
    domain: 'd-fixture',
    taskId: 'd-fixture-t99',
    projectDir: dir
  }), /task not found/);
});

test('buildTaskBrief: throws if completion-signal-contract missing', () => {
  const dir = mkFixtureProject();
  fs.unlinkSync(path.join(dir, '.gsd-t', 'contracts', 'completion-signal-contract.md'));
  assert.throws(() => buildTaskBrief({
    milestone: 'M-test',
    domain: 'd-fixture',
    taskId: 'd-fixture-t1',
    projectDir: dir
  }), /completion-signal-contract/);
});

test('buildTaskBrief: respects maxBytes — under budget keeps all sections', () => {
  const dir = mkFixtureProject();
  const brief = buildTaskBrief({
    milestone: 'M-test',
    domain: 'd-fixture',
    taskId: 'd-fixture-t1',
    projectDir: dir,
    maxBytes: 5000
  });
  assert.ok(Buffer.byteLength(brief, 'utf8') <= 5500, 'brief under hard max');
  assert.ok(brief.includes('## Scope'));
  assert.ok(brief.includes('## Constraints'));
});

test('buildTaskBrief: over-budget drops optional sections first, keeps task + done signal', () => {
  // Fixture project with a package.json that flags many stacks, pushing stack rules high.
  const dir = mkFixtureProject();
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
    name: 'fixture-pkg',
    version: '1.0.0',
    dependencies: {
      react: '^18.0.0',
      next: '^14.0.0',
      tailwindcss: '^3.0.0',
      express: '^4.0.0'
    },
    devDependencies: {
      typescript: '^5.0.0',
      '@playwright/test': '^1.0.0'
    }
  }));

  // Non-droppable core for the fixture is tiny (~1.7KB). Budget below full-with-stack-rules
  // but above non-droppable forces the compactor to drop stack rules (and maybe contract excerpts).
  const fullBrief = buildTaskBrief({
    milestone: 'M-test',
    domain: 'd-fixture',
    taskId: 'd-fixture-t1',
    projectDir: dir,
    maxBytes: 100000
  });
  const fullSize = Buffer.byteLength(fullBrief, 'utf8');
  assert.ok(fullSize > 3000, 'full brief should pick up stack rules and be >3KB');

  const trimmed = buildTaskBrief({
    milestone: 'M-test',
    domain: 'd-fixture',
    taskId: 'd-fixture-t1',
    projectDir: dir,
    maxBytes: 2500
  });
  assert.ok(Buffer.byteLength(trimmed, 'utf8') <= 2500, 'trimmed respects tight maxBytes');
  assert.ok(trimmed.includes('## Task'));
  assert.ok(trimmed.includes('## Done Signal'));
  assert.ok(trimmed.includes('## CWD Invariant'));
  assert.ok(!trimmed.includes('## Stack Rules'), 'stack rules should be dropped under tight budget');
});

test('buildTaskBrief: end-to-end on a real fixture project produces non-empty brief under 10KB', () => {
  // Was a "self-test against the live GSD-T repo" hardcoding M41's domain
  // `d1-token-capture-wrapper` — which broke when that milestone was archived and its
  // domain dir swept (2026-06-22 prune, backlog #40). It could not be repointed at a
  // live domain either: `buildTaskBrief`/`extractTask` only parse the OLD `### Task N`
  // heading format, NOT the current Shape-D `### Mxx-Dx-Tx — title` headings (format
  // diverged at the M61 Shape-D migration; buildTaskBrief is dead against real domains —
  // see backlog #41). So this test now exercises buildTaskBrief end-to-end against a
  // self-built fixture (same `### Task N` format the tool supports), decoupled from any
  // milestone's live domains — never breaks on archival again.
  const dir = mkFixtureProject();
  try {
    const brief = buildTaskBrief({
      milestone: 'fixture',
      domain: 'd-fixture',
      taskId: 'd1-t1',
      projectDir: dir,
      maxBytes: 10000
    });
    assert.ok(brief.length > 500, 'brief should be non-trivial');
    assert.ok(Buffer.byteLength(brief, 'utf8') <= 10000, 'brief respects maxBytes');
    assert.ok(brief.includes('## Task'));
    assert.ok(brief.includes('## Done Signal'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
