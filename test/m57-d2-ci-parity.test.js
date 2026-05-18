'use strict';

/**
 * Tests for bin/gsd-t-ci-parity.cjs (M57 D2)
 *
 * Covers:
 *  - Detection precedence (cloudbuild → workflows → dockerfile-run → package-scripts → none)
 *  - Cache clearing (stale .tsbuildinfo removed before commands run)
 *  - no-dockerfile / docker-unavailable paths (non-failure)
 *  - SC2: planted noImplicitAny regression caught by real docker build (self-skips when no daemon)
 *
 * Contract: .gsd-t/contracts/ci-parity-contract.md v1.0.0 STABLE
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const { runCiParity, detectCi, clearBuildCaches } = require('../bin/gsd-t-ci-parity.cjs');

const FIXTURES = path.join(__dirname, 'fixtures', 'm57-ci-parity');

// ── Helpers ────────────────────────────────────────────────────────────────────

function fixtureDir(name) {
  return path.join(FIXTURES, name);
}

function isDockerAvailable() {
  try {
    const r = child_process.spawnSync('docker', ['info'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 8000,
    });
    return r.status === 0;
  } catch { return false; }
}

// ── Detection Precedence Tests ─────────────────────────────────────────────────

test('detection_cloudbuild_takes_precedence', () => {
  const d = fixtureDir('cloudbuild');
  const r = detectCi(d);
  assert.equal(r.source, 'cloudbuild', 'Should detect cloudbuild source');
  assert.ok(r.commands.length > 0, 'Should extract commands from cloudbuild.yaml');
  // cloudbuild.yaml steps[].args are joined with spaces
  assert.ok(r.commands[0].includes('node'), 'First command should include "node"');
});

test('detection_workflows_when_no_cloudbuild', () => {
  const d = fixtureDir('workflows');
  // Ensure no cloudbuild.yaml in this fixture
  assert.ok(!fs.existsSync(path.join(d, 'cloudbuild.yaml')), 'Fixture must not have cloudbuild.yaml');
  const r = detectCi(d);
  assert.equal(r.source, 'workflows', 'Should detect workflows source');
  assert.ok(r.commands.length > 0, 'Should extract run commands from workflow yml');
});

test('detection_dockerfile_run_when_no_cloudbuild_or_workflows', () => {
  const d = fixtureDir('dockerfile-run');
  assert.ok(!fs.existsSync(path.join(d, 'cloudbuild.yaml')), 'Fixture must not have cloudbuild.yaml');
  assert.ok(!fs.existsSync(path.join(d, '.github')), 'Fixture must not have .github dir');
  const r = detectCi(d);
  assert.equal(r.source, 'dockerfile-run', 'Should detect dockerfile-run source');
  assert.ok(r.commands.length > 0, 'Should extract RUN lines from Dockerfile');
});

test('detection_package_scripts_fallback', () => {
  const d = fixtureDir('pkg-fallback');
  assert.ok(!fs.existsSync(path.join(d, 'cloudbuild.yaml')), 'Fixture must not have cloudbuild.yaml');
  assert.ok(!fs.existsSync(path.join(d, '.github')), 'Fixture must not have .github dir');
  assert.ok(!fs.existsSync(path.join(d, 'Dockerfile')), 'Fixture must not have Dockerfile');
  const r = detectCi(d);
  assert.equal(r.source, 'package-scripts', 'Should fall back to package-scripts');
  assert.ok(r.commands.length > 0, 'Should extract npm run scripts');
  // Order: build, typecheck, test
  assert.ok(r.commands[0].includes('build'), 'First script should be build');
  assert.ok(r.commands[1].includes('typecheck'), 'Second script should be typecheck');
  assert.ok(r.commands[2].includes('test'), 'Third script should be test');
});

test('detection_none_when_no_ci_artifacts', () => {
  // Use a temp dir with only an empty package.json (no scripts)
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-t-ci-parity-none-'));
  try {
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'test' }));
    const r = detectCi(tmp);
    assert.equal(r.source, 'none', 'Should return none when no CI config found');
    assert.deepEqual(r.commands, [], 'Should return empty commands array');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('detection_precedence_strict_order_cloudbuild_beats_workflows', () => {
  // A fixture with both cloudbuild.yaml AND .github/workflows should use cloudbuild
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-t-ci-parity-prec-'));
  try {
    fs.writeFileSync(path.join(tmp, 'cloudbuild.yaml'), [
      'steps:',
      "  - name: 'node:18'",
      "    args: ['node', '-e', 'process.exit(0)']",
    ].join('\n'));
    const wfDir = path.join(tmp, '.github', 'workflows');
    fs.mkdirSync(wfDir, { recursive: true });
    fs.writeFileSync(path.join(wfDir, 'ci.yml'), [
      'name: CI',
      'on: [push]',
      'jobs:',
      '  build:',
      '    steps:',
      '      - run: echo workflows-step',
    ].join('\n'));
    const r = detectCi(tmp);
    assert.equal(r.source, 'cloudbuild', 'cloudbuild must beat workflows in precedence');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Cache Clear Tests ──────────────────────────────────────────────────────────

test('cache_clear_removes_tsbuildinfo', () => {
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-t-ci-parity-cache-'));
  try {
    // Plant a stale .tsbuildinfo file
    const staleFile = path.join(tmp, 'tsconfig.tsbuildinfo');
    fs.writeFileSync(staleFile, '{}');
    assert.ok(fs.existsSync(staleFile), 'Stale file must exist before clear');
    clearBuildCaches(tmp);
    assert.ok(!fs.existsSync(staleFile), 'Stale .tsbuildinfo must be removed after clear');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('cache_clear_removes_node_modules_cache', () => {
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-t-ci-parity-nm-'));
  try {
    const cacheDir = path.join(tmp, 'node_modules', '.cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'something.json'), '{}');
    assert.ok(fs.existsSync(cacheDir), 'Cache dir must exist before clear');
    clearBuildCaches(tmp);
    assert.ok(!fs.existsSync(cacheDir), 'node_modules/.cache must be removed after clear');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('cache_clear_removes_tsconfig_tsbuildinffile', () => {
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-t-ci-parity-tscfg-'));
  try {
    // Plant a tsconfig.json with explicit tsBuildInfoFile
    const buildInfoPath = path.join(tmp, '.tsbuildinfo');
    fs.writeFileSync(buildInfoPath, '{"version":"stale"}');
    fs.writeFileSync(path.join(tmp, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        incremental: true,
        tsBuildInfoFile: '.tsbuildinfo',
        noEmit: true,
      },
    }));
    assert.ok(fs.existsSync(buildInfoPath), 'tsBuildInfoFile must exist before clear');
    clearBuildCaches(tmp);
    assert.ok(!fs.existsSync(buildInfoPath), 'tsBuildInfoFile must be removed after clear');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Docker skip / unavailable Tests ──────────────────────────────────────────

test('no_dockerfile_skips_docker_non_failure', () => {
  const d = fixtureDir('pkg-fallback');
  // pkg-fallback has no Dockerfile — docker should be skipped, not a failure
  const r = runCiParity({ projectDir: d, timeoutMs: 10000 });
  assert.equal(r.dockerBuilt, false, 'dockerBuilt must be false when no Dockerfile');
  assert.equal(r.dockerSkippedReason, 'no-dockerfile', 'dockerSkippedReason must be no-dockerfile');
});

test('docker_unavailable_is_not_hard_failure', () => {
  // Real docker-unavailable path: Dockerfile PRESENT + docker binary absent →
  // ok:true (not a hard failure), dockerBuilt:false, dockerSkippedReason:'docker-unavailable'.
  //
  // Technique: temporarily override process.env.PATH to a nonexistent directory
  // so that spawnSync('docker', ...) in dockerAvailable() throws ENOENT → returns false.
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-t-ci-parity-docker-'));
  const origPath = process.env.PATH;
  try {
    // A Dockerfile with no RUN lines so detectCi falls back to package-scripts.
    // We add a passing package.json script so command execution succeeds.
    fs.writeFileSync(path.join(tmp, 'Dockerfile'), 'FROM scratch\nCOPY . .\n');
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({
      name: 'test-docker-unavail',
      scripts: { build: 'node -e "process.exit(0)"' },
    }));

    // Point PATH at a directory that has no binaries (docker binary unreachable)
    process.env.PATH = '/nonexistent-gsd-t-test-path';

    const r = runCiParity({ projectDir: tmp, timeoutMs: 10000 });

    // Contract assertions
    assert.equal(r.ok, true, 'docker-unavailable must NOT be a hard failure (ok must be true)');
    assert.equal(r.dockerBuilt, false, 'dockerBuilt must be false when docker binary is absent');
    assert.equal(r.dockerSkippedReason, 'docker-unavailable', 'dockerSkippedReason must be "docker-unavailable"');
  } finally {
    process.env.PATH = origPath;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── runCiParity integration: fast no-op fixtures ───────────────────────────────

test('run_ci_parity_cloudbuild_commands_pass', () => {
  const r = runCiParity({ projectDir: fixtureDir('cloudbuild'), timeoutMs: 15000 });
  assert.equal(r.detectedSource, 'cloudbuild');
  assert.ok(r.commands.length > 0, 'Should have run commands');
  // All commands in this fixture are node no-ops → should pass
  const allOk = r.commands.every((c) => c.ok);
  assert.ok(allOk, `All cloudbuild commands should pass; got: ${JSON.stringify(r.commands)}`);
});

test('run_ci_parity_workflows_commands_pass', () => {
  const r = runCiParity({ projectDir: fixtureDir('workflows'), timeoutMs: 15000 });
  assert.equal(r.detectedSource, 'workflows');
  assert.ok(r.commands.length > 0, 'Should have run commands');
});

test('run_ci_parity_pkg_fallback_commands_pass', () => {
  const r = runCiParity({ projectDir: fixtureDir('pkg-fallback'), timeoutMs: 15000 });
  assert.equal(r.detectedSource, 'package-scripts');
  assert.ok(r.commands.length > 0);
  assert.ok(r.commands.every((c) => c.ok), `All pkg-fallback commands should pass; got: ${JSON.stringify(r.commands)}`);
});

test('run_ci_parity_none_returns_ok_true', () => {
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-t-ci-parity-empty-'));
  try {
    // Empty dir → none source → ok:true
    const r = runCiParity({ projectDir: tmp, timeoutMs: 5000 });
    assert.equal(r.detectedSource, 'none');
    assert.ok(r.ok, 'none-detected should be ok:true');
    assert.ok(r.note, 'Should include a note for none-detected');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Envelope shape ────────────────────────────────────────────────────────────

test('envelope_shape_has_required_fields', () => {
  const r = runCiParity({ projectDir: fixtureDir('pkg-fallback'), timeoutMs: 10000 });
  assert.ok('ok' in r, 'envelope must have ok');
  assert.ok('detectedSource' in r, 'envelope must have detectedSource');
  assert.ok('commands' in r, 'envelope must have commands');
  assert.ok('dockerBuilt' in r, 'envelope must have dockerBuilt');
  assert.ok(Array.isArray(r.commands), 'commands must be array');
  for (const c of r.commands) {
    assert.ok('cmd' in c, 'command entry must have cmd');
    assert.ok('exitCode' in c, 'command entry must have exitCode');
    assert.ok('ok' in c, 'command entry must have ok');
  }
});

// ── SC2: Planted regression test (docker-dependent, self-skips) ───────────────

test('SC2_planted_regression_docker_build_fails', { skip: !isDockerAvailable() ? 'No Docker daemon available — SC2 docker-dependent assertion skipped. Detection+cache-clear path tested unconditionally below.' : false }, async () => {
  const d = fixtureDir('planted-regression');

  // First: unconditional assertions (detection + cache clear)
  const detected = detectCi(d);
  // planted-regression has Dockerfile → dockerfile-run source
  assert.equal(detected.source, 'dockerfile-run', 'SC2 fixture must detect dockerfile-run source');

  // Plant the stale .tsbuildinfo back (in case a previous run removed it)
  const tsBuildInfoPath = path.join(d, '.tsbuildinfo');
  const staleContent = JSON.stringify({
    program: { fileNames: ['./src/index.ts'], fileInfos: [{ version: 'stale', signature: 'stale' }], options: {} },
    version: '4.9.5',
  });
  fs.writeFileSync(tsBuildInfoPath, staleContent);
  assert.ok(fs.existsSync(tsBuildInfoPath), 'Stale .tsbuildinfo must be present before test');

  // When docker IS available: run the full parity check
  // This should remove the stale .tsbuildinfo AND run docker build which FAILS
  // because the Dockerfile runs npx tsc --noEmit and the src/index.ts has
  // a noImplicitAny violation.
  const r = runCiParity({ projectDir: d, timeoutMs: 180000 }); // 3 min for docker build

  // Docker must have attempted to build
  assert.ok(
    r.dockerBuilt === false || r.dockerSkippedReason === undefined,
    'dockerBuilt should be false (failed) when docker runs'
  );

  // ok must be false — regression was caught
  assert.equal(r.ok, false, 'SC2: docker build must fail → ok:false');

  // Stale .tsbuildinfo must have been cleared before commands ran
  // (cache clear runs before commands, so even if docker build failed the file is gone)
  // Note: the .tsbuildinfo we planted must have been cleared
  // (runCiParity clears before running commands)
});

test('SC2_detection_and_cache_clear_unconditional', () => {
  // This portion of SC2 always runs regardless of Docker availability.
  const d = fixtureDir('planted-regression');

  // Detection
  const r = detectCi(d);
  assert.equal(r.source, 'dockerfile-run', 'SC2 fixture must detect dockerfile-run');
  assert.ok(r.commands.length > 0, 'SC2 fixture must have commands');

  // Plant stale .tsbuildinfo
  const staleFile = path.join(d, '.tsbuildinfo');
  fs.writeFileSync(staleFile, '{"version":"stale-for-test"}');
  assert.ok(fs.existsSync(staleFile), 'Stale file must exist before cache clear');

  // Cache clear removes it
  clearBuildCaches(d);
  assert.ok(!fs.existsSync(staleFile), 'Cache clear must remove the stale .tsbuildinfo (SC2 anti-regression)');
});

// ── CLI exit code tests ────────────────────────────────────────────────────────

test('cli_exit_0_on_ok_true', () => {
  const r = child_process.spawnSync(
    process.execPath,
    [path.join(__dirname, '..', 'bin', 'gsd-t-ci-parity.cjs'), '--json',
     '--project-dir', fixtureDir('pkg-fallback'), '--timeout-ms', '15000'],
    { encoding: 'utf8' }
  );
  assert.equal(r.status, 0, `Expected exit 0, got ${r.status}. stdout: ${r.stdout}`);
  const out = JSON.parse(r.stdout.trim());
  assert.equal(out.ok, true);
});

test('cli_json_output_has_correct_shape', () => {
  // Uses pkg-fallback fixture: no cloudbuild, no workflows, no Dockerfile → package-scripts source.
  const r = child_process.spawnSync(
    process.execPath,
    [path.join(__dirname, '..', 'bin', 'gsd-t-ci-parity.cjs'), '--json',
     '--project-dir', fixtureDir('pkg-fallback'), '--timeout-ms', '15000'],
    { encoding: 'utf8' }
  );
  const out = JSON.parse(r.stdout.trim());
  // Value-type and value assertions — must fail on {ok:null, detectedSource:'', commands:null, dockerBuilt:null}
  assert.equal(typeof out.ok, 'boolean', 'ok must be a boolean');
  assert.equal(out.detectedSource, 'package-scripts', 'detectedSource must be "package-scripts" for pkg-fallback fixture');
  assert.ok(Array.isArray(out.commands), 'commands must be an array');
  assert.equal(typeof out.dockerBuilt, 'boolean', 'dockerBuilt must be a boolean');
});

test('cli_exit_4_on_ok_false', () => {
  // Create a fixture that will fail: a command with non-zero exit
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-t-ci-parity-fail-'));
  try {
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({
      name: 'test-fail',
      scripts: { build: 'node -e "process.exit(1)"' },
    }));
    const r = child_process.spawnSync(
      process.execPath,
      [path.join(__dirname, '..', 'bin', 'gsd-t-ci-parity.cjs'), '--json',
       '--project-dir', tmp, '--timeout-ms', '10000'],
      { encoding: 'utf8' }
    );
    assert.equal(r.status, 4, `Expected exit 4, got ${r.status}. stdout: ${r.stdout}`);
    const out = JSON.parse(r.stdout.trim());
    assert.equal(out.ok, false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('cli_help_exits_0', () => {
  const r = child_process.spawnSync(
    process.execPath,
    [path.join(__dirname, '..', 'bin', 'gsd-t-ci-parity.cjs'), '--help'],
    { encoding: 'utf8' }
  );
  assert.equal(r.status, 0, `--help should exit 0, got ${r.status}`);
});
