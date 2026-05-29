'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  parseTasksFile,
  parseDependencies,
  parseFilesField,
  readAllTasks,
  groupByWave,
  validateNoForwardDeps
} = require('../bin/gsd-t-orchestrator-queue.cjs');

function mkProj(domains) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm40-queue-'));
  fs.mkdirSync(path.join(dir, '.gsd-t', 'domains'), { recursive: true });
  for (const [name, content] of Object.entries(domains)) {
    const ddir = path.join(dir, '.gsd-t', 'domains', name);
    fs.mkdirSync(ddir, { recursive: true });
    fs.writeFileSync(path.join(ddir, 'tasks.md'), content);
  }
  return dir;
}

const TASKS_SINGLE_WAVE = `# Tasks: d-alpha

## Tasks

### Task 1: First
- **Wave**: 0
- **Dependencies**: NONE

### Task 2: Second
- **Wave**: 0
- **Dependencies**: Requires Task 1
`;

const TASKS_MULTI_WAVE = `# Tasks: d-beta

## Tasks

### Task 1: Base
- **Wave**: 0
- **Dependencies**: NONE

### Task 2: Mid
- **Wave**: 1
- **Dependencies**: Requires Task 1

### Task 3: Late
- **Wave**: 2
- **Dependencies**: Requires Task 2
`;

const TASKS_NO_WAVE = `# Tasks: d-gamma

## Tasks

### Task 1: Unlabeled
- **Dependencies**: NONE
`;

test('parseTasksFile: single wave', () => {
  const tasks = parseTasksFile(TASKS_SINGLE_WAVE, 'd-alpha');
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].id, 'd-alpha:T1');
  assert.equal(tasks[0].wave, 0);
  assert.deepEqual(tasks[0].dependencies, []);
  assert.equal(tasks[1].id, 'd-alpha:T2');
  assert.deepEqual(tasks[1].dependencies, ['d-alpha:T1']);
});

test('parseTasksFile: multi wave', () => {
  const tasks = parseTasksFile(TASKS_MULTI_WAVE, 'd-beta');
  assert.equal(tasks.length, 3);
  assert.equal(tasks[0].wave, 0);
  assert.equal(tasks[1].wave, 1);
  assert.equal(tasks[2].wave, 2);
});

test('parseTasksFile: tasks without wave default to 0', () => {
  const tasks = parseTasksFile(TASKS_NO_WAVE, 'd-gamma');
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].wave, 0);
});

test('parseDependencies: NONE → []', () => {
  assert.deepEqual(parseDependencies('NONE', 'd-x'), []);
  assert.deepEqual(parseDependencies('N/A', 'd-x'), []);
  assert.deepEqual(parseDependencies('', 'd-x'), []);
});

test('parseDependencies: cross-domain', () => {
  const deps = parseDependencies('Requires Task 1, BLOCKED BY d3-completion-protocol Task 2', 'd1-orchestrator-core');
  assert.ok(deps.includes('d1-orchestrator-core:T1'));
  assert.ok(deps.includes('d3-completion-protocol:T2'));
});

test('parseDependencies: same-domain only', () => {
  const deps = parseDependencies('Requires Task 1', 'd-alpha');
  assert.deepEqual(deps, ['d-alpha:T1']);
});

test('readAllTasks: iterates every domains/*/tasks.md', () => {
  const dir = mkProj({
    'd-alpha': TASKS_SINGLE_WAVE,
    'd-beta': TASKS_MULTI_WAVE
  });
  const tasks = readAllTasks(dir);
  assert.equal(tasks.length, 5);
  const ids = tasks.map((t) => t.id).sort();
  assert.deepEqual(ids, ['d-alpha:T1', 'd-alpha:T2', 'd-beta:T1', 'd-beta:T2', 'd-beta:T3']);
});

test('readAllTasks: missing domains dir → []', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm40-queue-'));
  assert.deepEqual(readAllTasks(dir), []);
});

test('groupByWave: returns Map sorted ascending', () => {
  const dir = mkProj({ 'd-beta': TASKS_MULTI_WAVE });
  const tasks = readAllTasks(dir);
  const groups = groupByWave(tasks);
  assert.ok(groups instanceof Map);
  assert.deepEqual([...groups.keys()], [0, 1, 2]);
  assert.equal(groups.get(0).length, 1);
  assert.equal(groups.get(1).length, 1);
  assert.equal(groups.get(2).length, 1);
});

test('groupByWave: empty tasks → empty Map', () => {
  const groups = groupByWave([]);
  assert.equal(groups.size, 0);
});

test('validateNoForwardDeps: passes for backward deps', () => {
  const dir = mkProj({ 'd-beta': TASKS_MULTI_WAVE });
  const tasks = readAllTasks(dir);
  assert.equal(validateNoForwardDeps(tasks), true);
});

test('validateNoForwardDeps: rejects forward cross-wave deps', () => {
  const bad = `# Tasks: d-x

## Tasks

### Task 1: Early
- **Wave**: 0
- **Dependencies**: Requires Task 2

### Task 2: Late
- **Wave**: 1
- **Dependencies**: NONE
`;
  const dir = mkProj({ 'd-x': bad });
  const tasks = readAllTasks(dir);
  assert.throws(
    () => validateNoForwardDeps(tasks),
    /forward cross-wave dependency/
  );
});

test('validateNoForwardDeps: cross-domain forward dep rejected', () => {
  const dA = `### Task 1: A1
- **Wave**: 0
- **Dependencies**: BLOCKED BY d-b Task 1
`;
  const dB = `### Task 1: B1
- **Wave**: 1
- **Dependencies**: NONE
`;
  const dir = mkProj({ 'd-a': dA, 'd-b': dB });
  const tasks = readAllTasks(dir);
  assert.throws(
    () => validateNoForwardDeps(tasks),
    /forward cross-wave dependency/
  );
});


test('parseFilesField: extracts backtick-quoted paths, strips (NEW)/(UPDATED) suffixes', () => {
  const p = parseFilesField('`out/a.txt` (NEW), `test/bench/a.test.js` (NEW)');
  assert.deepEqual(p, ['out/a.txt', 'test/bench/a.test.js']);
});

test('parseFilesField: trailing slash becomes glob', () => {
  const p = parseFilesField('`test/fixtures/m40-benchmark-workload/` (NEW)');
  assert.deepEqual(p, ['test/fixtures/m40-benchmark-workload/**']);
});

test('parseFilesField: falls back to comma-split when no backticks', () => {
  const p = parseFilesField('out/a.txt (NEW), test/bench/a.test.js (NEW)');
  assert.deepEqual(p, ['out/a.txt', 'test/bench/a.test.js']);
});

test('parseFilesField: NONE / N/A => []', () => {
  assert.deepEqual(parseFilesField('NONE'), []);
  assert.deepEqual(parseFilesField('N/A'), []);
});

test('parseTasksFile: task.ownedPatterns populated from Files: line', () => {
  const md = `# Tasks

### Task 1: Make a thing
- **Files**: \`out/a.txt\` (NEW), \`test/bench/a.test.js\` (NEW)
- **Wave**: 0
- **Dependencies**: NONE
`;
  const [t] = parseTasksFile(md, 'd-bench');
  assert.deepEqual(t.ownedPatterns, ['out/a.txt', 'test/bench/a.test.js']);
});

test('parseTasksFile: task without Files line has ownedPatterns=[]', () => {
  const md = `### Task 1: Whatever
- **Wave**: 0
- **Dependencies**: NONE
`;
  const [t] = parseTasksFile(md, 'd-none');
  assert.deepEqual(t.ownedPatterns, []);
});
