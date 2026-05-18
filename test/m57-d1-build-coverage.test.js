'use strict';
/**
 * M57 D1 — Build Coverage Check tests
 *
 * Tests `bin/gsd-t-build-coverage.cjs` including SC1: the TimeTracking
 * v1.10.12 failure class (new `hooks/` dir committed but absent from
 * Dockerfile COPY → ok:false, missing:["hooks"], CLI exit 4).
 *
 * Uses Node built-in test runner (`node --test`). Zero new deps.
 * All tests use the `_newPaths` seam to bypass live git calls, making them
 * deterministic without needing a git repo with a specific commit range.
 *
 * Contract: .gsd-t/contracts/cli-build-coverage-contract.md v1.0.0 STABLE.
 */

const test   = require('node:test');
const assert = require('node:assert');
const path   = require('node:path');
const { spawnSync } = require('node:child_process');

const { checkBuildCoverage } = require('../bin/gsd-t-build-coverage.cjs');

// Absolute path to test fixtures
const FIXTURES = path.join(__dirname, 'fixtures', 'm57-build-coverage');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Run the CLI as a subprocess with given argv; returns { status, stdout, stderr } */
function runCLI(argv) {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, '..', 'bin', 'gsd-t-build-coverage.cjs'), ...argv],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

// ---------------------------------------------------------------------------
// SC1 — TimeTracking failure class (docker-cloudbuild fixture)
// ---------------------------------------------------------------------------

test('SC1: new hooks/ dir not COPY\'d → ok:false, missing includes "hooks", API', () => {
  const projectDir = path.join(FIXTURES, 'docker-cloudbuild');
  const result = checkBuildCoverage({
    projectDir,
    _newPaths: ['hooks/post-deploy.sh', 'src/index.js'],
  });
  assert.strictEqual(result.ok, false, 'ok should be false');
  assert.ok(result.missing.includes('hooks'), `missing should include "hooks", got: ${JSON.stringify(result.missing)}`);
  assert.ok(Array.isArray(result.newPaths), 'newPaths should be an array');
  assert.ok(result.newPaths.includes('hooks'), 'newPaths should include hooks');
  assert.ok(result.newPaths.includes('src'), 'newPaths should include src');
  assert.ok(Array.isArray(result.checkedAgainst), 'checkedAgainst should be array');
  assert.ok(result.checkedAgainst.includes('Dockerfile'), 'checkedAgainst should include Dockerfile');
});

test('SC1: CLI subprocess exits 4 for docker-cloudbuild fixture with hooks/ uncovered', () => {
  // We can't inject _newPaths via CLI, so we need a test approach:
  // Run against a temp dir that has the fixture Dockerfile but we override
  // the diff by using a real git diff. Instead, we test the exit-4 path
  // by pointing the CLI at a real project where HEAD~1..HEAD would produce
  // the right diff — but that's environment-dependent.
  //
  // Better: test the API path (above) proves ok:false + missing:["hooks"].
  // For the CLI exit-4 test, we use the --base/--head pointing to a range
  // that produces a known diff. Since we can't guarantee git history here,
  // we instead verify exit 4 via a small synthetic git repo in a temp dir.
  const os = require('os');
  const fs = require('fs');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm57-sc1-'));

  // Copy Dockerfile fixture
  fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'hooks'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, 'Dockerfile'),
    fs.readFileSync(path.join(FIXTURES, 'docker-cloudbuild', 'Dockerfile'), 'utf8')
  );
  fs.writeFileSync(path.join(tmpDir, 'src', 'index.js'), '// src');
  fs.writeFileSync(path.join(tmpDir, 'hooks', 'post-deploy.sh'), '#!/bin/sh');

  // Init git repo with two commits: base (src only), head (add hooks)
  const gitOpts = { cwd: tmpDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };
  spawnSync('git', ['init', '-b', 'main'], gitOpts);
  spawnSync('git', ['config', 'user.email', 'test@test.com'], gitOpts);
  spawnSync('git', ['config', 'user.name', 'Test'], gitOpts);
  // First commit: Dockerfile + src
  spawnSync('git', ['add', 'Dockerfile', 'src/'], gitOpts);
  spawnSync('git', ['commit', '-m', 'base'], gitOpts);
  // Second commit: add hooks/
  spawnSync('git', ['add', 'hooks/'], gitOpts);
  spawnSync('git', ['commit', '-m', 'add hooks'], gitOpts);

  const { status, stdout, stderr } = runCLI([
    '--json',
    '--project-dir', tmpDir,
    '--base', 'HEAD~1',
    '--head', 'HEAD',
  ]);

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });

  assert.strictEqual(status, 4, `expected exit 4, got ${status}. stdout=${stdout} stderr=${stderr}`);
  const envelope = JSON.parse(stdout);
  assert.strictEqual(envelope.ok, false);
  assert.ok(envelope.missing.includes('hooks'), `expected missing to include "hooks": ${JSON.stringify(envelope.missing)}`);
});

// ---------------------------------------------------------------------------
// copy-dot fixture — COPY . . covers everything
// ---------------------------------------------------------------------------

test('copy-dot: Dockerfile with COPY . . → ok:true', () => {
  const projectDir = path.join(FIXTURES, 'copy-dot');
  const result = checkBuildCoverage({
    projectDir,
    _newPaths: ['hooks/post-deploy.sh', 'workers/task.js', 'src/new-module.js'],
  });
  assert.strictEqual(result.ok, true, `expected ok:true, got ok:false missing=${JSON.stringify(result.missing)}`);
  assert.deepStrictEqual(result.missing, []);
  assert.ok(result.checkedAgainst.includes('Dockerfile'));
});

// ---------------------------------------------------------------------------
// no-ci fixture — no CI artifacts → ok:true with note
// ---------------------------------------------------------------------------

test('no-ci: no Dockerfile/cloudbuild/workflows → ok:true with note', () => {
  const projectDir = path.join(FIXTURES, 'no-ci');
  const result = checkBuildCoverage({
    projectDir,
    _newPaths: ['hooks/post-deploy.sh'],
  });
  assert.strictEqual(result.ok, true, 'expected ok:true when no CI artifacts');
  assert.ok(typeof result.note === 'string' && result.note.length > 0, 'expected note to be set');
  assert.ok(result.note.includes('no CI artifacts'), `note should mention no CI artifacts, got: ${result.note}`);
  assert.deepStrictEqual(result.checkedAgainst, []);
});

test('no-ci fixture: CLI exits 0', () => {
  // Use this project's own dir as a "no-CI" stand-in by pointing at no-ci fixture.
  // We can't run git diff, so test the API route proves exit 0 via code path.
  // Direct CLI test: run against no-ci fixture with a synthetic git repo.
  const os = require('os');
  const fs = require('fs');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm57-noci-'));
  fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'src', 'index.js'), '// src');

  const gitOpts = { cwd: tmpDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };
  spawnSync('git', ['init', '-b', 'main'], gitOpts);
  spawnSync('git', ['config', 'user.email', 'test@test.com'], gitOpts);
  spawnSync('git', ['config', 'user.name', 'Test'], gitOpts);
  spawnSync('git', ['add', '.'], gitOpts);
  spawnSync('git', ['commit', '-m', 'base'], gitOpts);
  fs.mkdirSync(path.join(tmpDir, 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'hooks', 'run.sh'), '#!/bin/sh');
  spawnSync('git', ['add', 'hooks/'], gitOpts);
  spawnSync('git', ['commit', '-m', 'add hooks'], gitOpts);

  const { status, stdout } = runCLI(['--json', '--project-dir', tmpDir, '--base', 'HEAD~1', '--head', 'HEAD']);
  fs.rmSync(tmpDir, { recursive: true, force: true });

  assert.strictEqual(status, 0, `expected exit 0 for no-ci, got ${status}`);
  const envelope = JSON.parse(stdout);
  assert.strictEqual(envelope.ok, true);
  assert.ok(typeof envelope.note === 'string');
});

// ---------------------------------------------------------------------------
// empty-diff path
// ---------------------------------------------------------------------------

test('empty diff → ok:true, newPaths:[]', () => {
  const projectDir = path.join(FIXTURES, 'docker-cloudbuild');
  const result = checkBuildCoverage({
    projectDir,
    _newPaths: [],
  });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.newPaths, []);
  assert.deepStrictEqual(result.missing, []);
});

// ---------------------------------------------------------------------------
// usage error / bad ref → exit 2
// ---------------------------------------------------------------------------

test('usage error (bad git ref) → exit 2', () => {
  const os = require('os');
  const fs = require('fs');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm57-bad-'));
  // Init a real git repo with one commit so the repo check passes
  const gitOpts = { cwd: tmpDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };
  fs.writeFileSync(path.join(tmpDir, 'README.md'), '# test');
  spawnSync('git', ['init', '-b', 'main'], gitOpts);
  spawnSync('git', ['config', 'user.email', 'test@test.com'], gitOpts);
  spawnSync('git', ['config', 'user.name', 'Test'], gitOpts);
  spawnSync('git', ['add', '.'], gitOpts);
  spawnSync('git', ['commit', '-m', 'init'], gitOpts);

  const { status } = runCLI([
    '--project-dir', tmpDir,
    '--base', 'nonexistent-ref-abc123',
    '--head', 'HEAD',
  ]);
  fs.rmSync(tmpDir, { recursive: true, force: true });

  assert.strictEqual(status, 2, `expected exit 2 for bad ref, got ${status}`);
});

test('usage error (not a git repo) → exit 2', () => {
  const os = require('os');
  const fs = require('fs');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm57-nogit-'));
  // No git init — not a repo

  const { status } = runCLI(['--project-dir', tmpDir]);
  fs.rmSync(tmpDir, { recursive: true, force: true });

  assert.strictEqual(status, 2, `expected exit 2 for non-git dir, got ${status}`);
});

// ---------------------------------------------------------------------------
// gha-only fixture — uncovered path flagged
// ---------------------------------------------------------------------------

test('gha-only: workflow references src/ but not hooks/ → hooks in missing', () => {
  const projectDir = path.join(FIXTURES, 'gha-only');
  const result = checkBuildCoverage({
    projectDir,
    _newPaths: ['hooks/post-deploy.sh', 'src/index.js'],
  });
  // The workflow references "src" in rsync/cp lines but not "hooks"
  assert.ok(Array.isArray(result.missing), 'missing should be array');
  assert.ok(result.missing.includes('hooks'), `expected hooks in missing, got ${JSON.stringify(result.missing)}`);
  assert.strictEqual(result.ok, false, 'ok should be false when hooks not covered');
  assert.ok(result.checkedAgainst.some(a => a.includes('workflows')), 'checkedAgainst should include workflows');
});

// ---------------------------------------------------------------------------
// Additional unit-level tests for parser behavior
// ---------------------------------------------------------------------------

test('checkBuildCoverage: src/ present in Dockerfile COPY → src not in missing', () => {
  const projectDir = path.join(FIXTURES, 'docker-cloudbuild');
  // Only src in diff — it IS in Dockerfile COPY src/
  const result = checkBuildCoverage({
    projectDir,
    _newPaths: ['src/new-file.js'],
  });
  assert.strictEqual(result.ok, true, `expected ok:true for src (covered), got missing=${JSON.stringify(result.missing)}`);
  assert.deepStrictEqual(result.missing, []);
});

test('checkBuildCoverage: multiple uncovered paths all appear in missing[]', () => {
  const projectDir = path.join(FIXTURES, 'docker-cloudbuild');
  const result = checkBuildCoverage({
    projectDir,
    _newPaths: ['hooks/run.sh', 'workers/task.js', 'src/x.js'],
  });
  assert.strictEqual(result.ok, false);
  assert.ok(result.missing.includes('hooks'), 'hooks should be missing');
  assert.ok(result.missing.includes('workers'), 'workers should be missing');
  assert.ok(!result.missing.includes('src'), 'src should NOT be missing (it is COPY\'d)');
});

test('checkBuildCoverage: identical baseRef/headRef → throws UsageError (caught by CLI as exit 2)', () => {
  // The API throws UsageError for identical refs; CLI catches and exits 2.
  // Test the UsageError throw directly by calling resolveRefs indirectly via checkBuildCoverage.
  // We pass a real repo dir (this project) but identical refs — but _newPaths is not provided so
  // it will call git. Instead, test via a temp repo.
  const os = require('os');
  const fs = require('fs');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm57-same-'));
  const gitOpts = { cwd: tmpDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };
  fs.writeFileSync(path.join(tmpDir, 'README.md'), '# x');
  spawnSync('git', ['init', '-b', 'main'], gitOpts);
  spawnSync('git', ['config', 'user.email', 'test@test.com'], gitOpts);
  spawnSync('git', ['config', 'user.name', 'Test'], gitOpts);
  spawnSync('git', ['add', '.'], gitOpts);
  spawnSync('git', ['commit', '-m', 'init'], gitOpts);

  // CLI should exit 2
  const { status } = runCLI(['--project-dir', tmpDir, '--base', 'HEAD', '--head', 'HEAD']);
  fs.rmSync(tmpDir, { recursive: true, force: true });

  assert.strictEqual(status, 2, `expected exit 2 for identical refs, got ${status}`);
});

test('checkBuildCoverage return shape has all required fields', () => {
  // Use empty-diff to verify the field set exists
  const projectDir = path.join(FIXTURES, 'docker-cloudbuild');
  const emptyResult = checkBuildCoverage({ projectDir, _newPaths: [] });
  assert.ok('ok' in emptyResult, 'missing ok field');
  assert.ok('missing' in emptyResult, 'missing missing field');
  assert.ok('checkedAgainst' in emptyResult, 'missing checkedAgainst field');
  assert.ok('newPaths' in emptyResult, 'missing newPaths field');
  assert.ok(typeof emptyResult.ok === 'boolean', 'ok should be boolean');
  assert.ok(Array.isArray(emptyResult.missing), 'missing should be array');
  assert.ok(Array.isArray(emptyResult.checkedAgainst), 'checkedAgainst should be array');
  assert.ok(Array.isArray(emptyResult.newPaths), 'newPaths should be array');
});

test('checkBuildCoverage return shape: checkedAgainst non-empty when CI artifacts detected', () => {
  // Use docker-cloudbuild fixture with a non-empty diff so the full detection
  // path runs — checkedAgainst must contain the detected Dockerfile artifact.
  // A stub that only handles the empty-diff early-return path would produce
  // checkedAgainst:[] and fail this test.
  const projectDir = path.join(FIXTURES, 'docker-cloudbuild');
  const result = checkBuildCoverage({
    projectDir,
    _newPaths: ['hooks/post-deploy.sh'],
  });
  assert.ok('ok' in result, 'missing ok field');
  assert.ok('missing' in result, 'missing missing field');
  assert.ok('checkedAgainst' in result, 'missing checkedAgainst field');
  assert.ok('newPaths' in result, 'missing newPaths field');
  assert.ok(typeof result.ok === 'boolean', 'ok should be boolean');
  assert.ok(Array.isArray(result.missing), 'missing should be array');
  assert.ok(Array.isArray(result.checkedAgainst), 'checkedAgainst should be array');
  assert.ok(Array.isArray(result.newPaths), 'newPaths should be array');
  // Critical: checkedAgainst must be non-empty — CI artifact was detected
  assert.ok(result.checkedAgainst.length > 0, `checkedAgainst must be non-empty when Dockerfile exists, got: ${JSON.stringify(result.checkedAgainst)}`);
  assert.ok(result.checkedAgainst.includes('Dockerfile'), `checkedAgainst must include "Dockerfile", got: ${JSON.stringify(result.checkedAgainst)}`);
});

// ---------------------------------------------------------------------------
// COPY --from= exclusion — multi-stage image layers must NOT count as coverage
// ---------------------------------------------------------------------------

test('COPY --from= exclusion: dist covered by --from= layer does NOT prevent missing[]', () => {
  // The docker-cloudbuild fixture Dockerfile contains:
  //   COPY --from=builder /app/dist ./dist
  // This is a multi-stage copy from an image layer, not from the workspace.
  // Per contract, COPY --from= lines are excluded from coverage parsing.
  // Therefore dist must appear in missing[] when it is a new top-level path.
  // hooks/ is also injected to ensure ok:false is triggered by at least one path.
  const projectDir = path.join(FIXTURES, 'docker-cloudbuild');
  const result = checkBuildCoverage({
    projectDir,
    _newPaths: ['dist/bundle.js', 'hooks/x.js'],
  });
  // hooks is genuinely uncovered — ok must be false
  assert.strictEqual(result.ok, false, 'ok should be false (hooks not covered)');
  // dist appears only via COPY --from= which is excluded — must be in missing
  assert.ok(result.missing.includes('dist'), `dist should be in missing[] because COPY --from= is excluded; got missing=${JSON.stringify(result.missing)}`);
  // hooks must also be missing
  assert.ok(result.missing.includes('hooks'), `hooks should be in missing[]; got missing=${JSON.stringify(result.missing)}`);
  // src is not in diff — should not appear in newPaths or missing
  assert.ok(!result.missing.includes('src'), 'src should not be in missing (not in diff)');
});
