/**
 * test/m86-surfacing.test.js
 *
 * Killing tests for M86-D4: banner surfacing + statusline surfacing.
 * Contract: .gsd-t/contracts/model-profile-config-contract.md v1.0.0
 *
 * Run: node --test test/m86-surfacing.test.js
 *
 * Coverage:
 *   T1 — Banner (gsd-t-auto-route.js): present/absent fixture, NOW-format, resilience
 *   T2 — Statusline (gsd-t-statusline.js): present/absent fixture, resilience
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Paths
const PROJECT_ROOT = path.resolve(__dirname, '..');
const AUTO_ROUTE   = path.join(PROJECT_ROOT, 'scripts', 'gsd-t-auto-route.js');
const STATUSLINE   = path.join(PROJECT_ROOT, 'scripts', 'gsd-t-statusline.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Spawn the auto-route hook with a fake JSON payload, returning stdout as string.
 * @param {{ cwd?: string, prompt?: string }} opts
 */
function spawnAutoRoute(opts = {}) {
  const payload = JSON.stringify({ cwd: opts.cwd || PROJECT_ROOT, prompt: opts.prompt || '' });
  const result = spawnSync(process.execPath, [AUTO_ROUTE], {
    input: payload,
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.equal(result.status, 0, `auto-route hook exited non-zero: ${result.stderr}`);
  return result.stdout || '';
}

/**
 * Spawn the statusline with an overridden cwd (via env), returning stdout.
 * @param {string} dir — project root dir for the statusline run
 */
function spawnStatusline(dir) {
  // The statusline uses process.cwd() implicitly through findProjectRoot() walking up.
  // We spawn it with cwd set to the fixture dir so it resolves the root correctly.
  const result = spawnSync(process.execPath, [STATUSLINE], {
    cwd: dir,
    encoding: 'utf8',
    timeout: 5000,
  });
  // Statusline should exit 0; resilience means even errors → 0.
  // We don't assert exit code; we assert on stdout content.
  return result.stdout || '';
}

// ---------------------------------------------------------------------------
// Fixture management
// ---------------------------------------------------------------------------

let tmpRoot; // base temp dir

function makeTmpProject(subdir) {
  const dir = path.join(tmpRoot, subdir);
  fs.mkdirSync(path.join(dir, '.gsd-t'), { recursive: true });
  // Write a minimal progress.md so the statusline can find the root
  fs.writeFileSync(path.join(dir, '.gsd-t', 'progress.md'), '## Milestone: M86-Test\n## Status: EXECUTING\n## Version: 4.4.10\n', 'utf8');
  return dir;
}

function writeProfileConfig(dir, profileName) {
  fs.writeFileSync(
    path.join(dir, '.gsd-t', 'model-profile.json'),
    JSON.stringify({ profile: profileName }),
    'utf8'
  );
}

before(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-m86-surfacing-'));
});

after(() => {
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {}
});

// ---------------------------------------------------------------------------
// T1 — Banner surfacing (scripts/gsd-t-auto-route.js)
// ---------------------------------------------------------------------------

describe('T1 — Banner surfacing (gsd-t-auto-route.js)', () => {

  it('[GSD-T NOW] format is byte-unchanged (date-guard invariant)', () => {
    const out = spawnAutoRoute({ cwd: PROJECT_ROOT });
    // Must start with "[GSD-T NOW] " followed by the timestamp format:
    // Day: Mon DD, YYYY HH:MM:SS TZ
    assert.match(
      out,
      /\[GSD-T NOW\] (Sun|Mon|Tue|Wed|Thu|Fri|Sat): (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4} \d{2}:\d{2}:\d{2}/,
      '[GSD-T NOW] line must match the expected timestamp format'
    );
    // The NOW line must be the first line
    const firstLine = out.split('\n')[0];
    assert.match(firstLine, /^\[GSD-T NOW\]/, '[GSD-T NOW] must be the first line');
  });

  it('[GSD-T READER CONTRACT] emits every turn, every project (M93 — concise enforcement)', () => {
    // In a GSD-T project AND in a bare dir — the contract is universal, not gated.
    for (const cwd of [PROJECT_ROOT, os.tmpdir()]) {
      const out = spawnAutoRoute({ cwd });
      assert.match(out, /\[GSD-T READER CONTRACT\]/, `Reader Contract must emit (cwd=${cwd})`);
      // It must carry the load-bearing rules + at least one before→after example.
      assert.match(out, /[Aa]nswer FIRST/, 'must state answer-first');
      assert.match(out, /→/, 'must include a before→after example');
    }
  });

  it('[GSD-T PROFILE] present config → names that profile (SC(f))', () => {
    const dir = makeTmpProject('banner-present');
    writeProfileConfig(dir, 'pro');
    const out = spawnAutoRoute({ cwd: dir });
    // Must contain the profile line
    assert.ok(out.includes('[GSD-T PROFILE]'), 'must contain [GSD-T PROFILE] line');
    assert.ok(
      out.includes('[GSD-T PROFILE] profile: pro'),
      `must name "pro" profile; got: ${JSON.stringify(out)}`
    );
    // Must NOT say "(default)" — config is present
    const profileLine = out.split('\n').find(l => l.includes('[GSD-T PROFILE]')) || '';
    assert.ok(!profileLine.includes('(default)'), 'present config must not render "(default)"');
  });

  it('[GSD-T PROFILE] absent config → names global default with (default) marker (SC(f))', () => {
    const dir = makeTmpProject('banner-absent');
    // No model-profile.json written
    const out = spawnAutoRoute({ cwd: dir });
    assert.ok(out.includes('[GSD-T PROFILE]'), 'must contain [GSD-T PROFILE] line');
    const profileLine = out.split('\n').find(l => l.includes('[GSD-T PROFILE]')) || '';
    // Must name the global default (premium) and include (default) marker
    assert.ok(
      profileLine.includes('profile: premium (default)'),
      `absent config must render "profile: premium (default)"; got: ${JSON.stringify(profileLine)}`
    );
  });

  it('[GSD-T PROFILE] standard profile is correctly surfaced', () => {
    const dir = makeTmpProject('banner-standard');
    writeProfileConfig(dir, 'standard');
    const out = spawnAutoRoute({ cwd: dir });
    assert.ok(out.includes('[GSD-T PROFILE] profile: standard'), `got: ${out}`);
  });

  it('[GSD-T PROFILE] premium profile is correctly surfaced', () => {
    const dir = makeTmpProject('banner-premium');
    writeProfileConfig(dir, 'premium');
    const out = spawnAutoRoute({ cwd: dir });
    assert.ok(out.includes('[GSD-T PROFILE] profile: premium'), `got: ${out}`);
    // When explicitly set, should not have (default)
    const profileLine = out.split('\n').find(l => l.includes('[GSD-T PROFILE]')) || '';
    assert.ok(!profileLine.includes('(default)'), 'explicit premium must not render "(default)"');
  });

  // Resilience: malformed config
  it('[GSD-T PROFILE] malformed JSON config → named default, exit 0, NOW line intact', () => {
    const dir = makeTmpProject('banner-malformed');
    fs.writeFileSync(path.join(dir, '.gsd-t', 'model-profile.json'), '{ not json {{', 'utf8');
    const payload = JSON.stringify({ cwd: dir, prompt: '' });
    const result = spawnSync(process.execPath, [AUTO_ROUTE], { input: payload, encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 0, `hook must exit 0 on malformed config; stderr: ${result.stderr}`);
    const out = result.stdout || '';
    // [GSD-T NOW] still emitted
    assert.match(out, /\[GSD-T NOW\]/, 'NOW line must be present even on malformed config');
    // Profile line still emitted with fallback
    assert.ok(out.includes('[GSD-T PROFILE]'), 'PROFILE line must be present even on malformed config');
    const profileLine = out.split('\n').find(l => l.includes('[GSD-T PROFILE]')) || '';
    assert.ok(
      profileLine.includes('profile: premium'),
      `malformed config must fall back to global default; got: ${JSON.stringify(profileLine)}`
    );
  });

  // Resilience: wrong-typed profile field
  it('[GSD-T PROFILE] wrong-typed profile field → named default, exit 0', () => {
    const dir = makeTmpProject('banner-wrong-type');
    fs.writeFileSync(path.join(dir, '.gsd-t', 'model-profile.json'), JSON.stringify({ profile: 42 }), 'utf8');
    const payload = JSON.stringify({ cwd: dir, prompt: '' });
    const result = spawnSync(process.execPath, [AUTO_ROUTE], { input: payload, encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 0, 'hook must exit 0 on wrong-typed profile');
    const out = result.stdout || '';
    assert.ok(out.includes('[GSD-T PROFILE]'), 'PROFILE line must be present');
    const profileLine = out.split('\n').find(l => l.includes('[GSD-T PROFILE]')) || '';
    assert.ok(profileLine.includes('premium'), `wrong-type must fall back to global default; got: ${JSON.stringify(profileLine)}`);
  });

  it('[GSD-T NOW] is still first line when profile config is present', () => {
    const dir = makeTmpProject('banner-order');
    writeProfileConfig(dir, 'pro');
    const out = spawnAutoRoute({ cwd: dir });
    const lines = out.split('\n').filter(Boolean);
    assert.ok(lines[0].startsWith('[GSD-T NOW]'), `First line must be [GSD-T NOW]; got: ${lines[0]}`);
  });
});

// ---------------------------------------------------------------------------
// T2 — Statusline surfacing (scripts/gsd-t-statusline.js)
// ---------------------------------------------------------------------------

describe('T2 — Statusline surfacing (gsd-t-statusline.js)', () => {

  it('present config → profile named in statusline output', () => {
    const dir = makeTmpProject('statusline-present');
    writeProfileConfig(dir, 'pro');
    const out = spawnStatusline(dir);
    assert.ok(out.includes('pro'), `statusline must include "pro"; got: ${JSON.stringify(out)}`);
  });

  it('absent config → global default named with (default) marker', () => {
    const dir = makeTmpProject('statusline-absent');
    // No model-profile.json written
    const out = spawnStatusline(dir);
    assert.ok(
      out.includes('premium') && out.includes('(default)'),
      `absent config must render "premium (default)" in statusline; got: ${JSON.stringify(out)}`
    );
  });

  it('standard profile → named in statusline', () => {
    const dir = makeTmpProject('statusline-standard');
    writeProfileConfig(dir, 'standard');
    const out = spawnStatusline(dir);
    assert.ok(out.includes('standard'), `statusline must include "standard"; got: ${JSON.stringify(out)}`);
  });

  it('malformed config → statusline exits 0, renders (falls back)', () => {
    const dir = makeTmpProject('statusline-malformed');
    fs.writeFileSync(path.join(dir, '.gsd-t', 'model-profile.json'), '{ bad json', 'utf8');
    const result = spawnSync(process.execPath, [STATUSLINE], {
      cwd: dir, encoding: 'utf8', timeout: 5000,
    });
    // Must not crash (any non-zero exit from a resilience failure is a bug)
    assert.equal(result.status, 0, `statusline must exit 0 on malformed config; stderr: ${result.stderr}`);
    const out = result.stdout || '';
    // Output must include the profile segment (with fallback)
    assert.ok(out.includes('premium'), `malformed config must fall back to "premium"; got: ${JSON.stringify(out)}`);
  });

  it('wrong-typed profile field → statusline exits 0, renders fallback', () => {
    const dir = makeTmpProject('statusline-wrong-type');
    fs.writeFileSync(path.join(dir, '.gsd-t', 'model-profile.json'), JSON.stringify({ profile: null }), 'utf8');
    const result = spawnSync(process.execPath, [STATUSLINE], {
      cwd: dir, encoding: 'utf8', timeout: 5000,
    });
    assert.equal(result.status, 0, 'statusline must exit 0 on wrong-typed profile');
    const out = result.stdout || '';
    assert.ok(out.includes('premium'), `wrong-type must fall back to "premium"; got: ${JSON.stringify(out)}`);
  });
});

// ---------------------------------------------------------------------------
// Unit tests for the exported functions (resolveActiveProfile / profileToken)
// ---------------------------------------------------------------------------

describe('resolveActiveProfile / profileToken unit tests', () => {
  const { resolveActiveProfile, profileToken } = require('../scripts/gsd-t-auto-route.js');

  it('absent config dir → named global default', () => {
    const result = resolveActiveProfile('/nonexistent/dir/that/cannot/exist');
    assert.equal(result.profile, 'premium');
    assert.equal(result.isDefault, true);
    assert.ok(!result.configError);
  });

  it('valid "pro" config → { profile: "pro", isDefault: false }', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-unit-'));
    try {
      fs.mkdirSync(path.join(dir, '.gsd-t'), { recursive: true });
      writeProfileConfig(dir, 'pro');
      const result = resolveActiveProfile(dir);
      assert.equal(result.profile, 'pro');
      assert.equal(result.isDefault, false);
      assert.ok(!result.configError);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('valid "standard" config → { profile: "standard", isDefault: false }', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-unit-'));
    try {
      fs.mkdirSync(path.join(dir, '.gsd-t'), { recursive: true });
      writeProfileConfig(dir, 'standard');
      const result = resolveActiveProfile(dir);
      assert.equal(result.profile, 'standard');
      assert.equal(result.isDefault, false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('corrupt JSON config → isDefault true + configError set', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-unit-'));
    try {
      fs.mkdirSync(path.join(dir, '.gsd-t'), { recursive: true });
      fs.writeFileSync(path.join(dir, '.gsd-t', 'model-profile.json'), 'NOTJSON', 'utf8');
      const result = resolveActiveProfile(dir);
      assert.equal(result.profile, 'premium');
      assert.equal(result.isDefault, true);
      assert.ok(result.configError, 'configError must be set on corrupt JSON');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('unknown profile value → isDefault true + configError set', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-unit-'));
    try {
      fs.mkdirSync(path.join(dir, '.gsd-t'), { recursive: true });
      fs.writeFileSync(path.join(dir, '.gsd-t', 'model-profile.json'), JSON.stringify({ profile: 'ultra' }), 'utf8');
      const result = resolveActiveProfile(dir);
      assert.equal(result.profile, 'premium');
      assert.equal(result.isDefault, true);
      assert.ok(result.configError);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('profileToken: absent config → "profile: premium (default)"', () => {
    const tok = profileToken({ profile: 'premium', isDefault: true });
    assert.equal(tok, 'profile: premium (default)');
  });

  it('profileToken: explicit pro → "profile: pro" (no default marker)', () => {
    const tok = profileToken({ profile: 'pro', isDefault: false });
    assert.equal(tok, 'profile: pro');
  });

  it('profileToken: configError → includes config-error in token', () => {
    const tok = profileToken({ profile: 'premium', isDefault: true, configError: 'invalid-json' });
    assert.ok(tok.includes('config-error'), `token must include config-error; got: ${tok}`);
  });

  it('profileToken: null input → "profile: unknown"', () => {
    const tok = profileToken(null);
    assert.equal(tok, 'profile: unknown');
  });
});

// ---------------------------------------------------------------------------
// Verify fix-cycle 1 (Red Team M86 LOW): [GSD-T PROFILE] is GSD-T-project-gated
// — a model profile is a GSD-T concept; announcing "premium (default)" in
// unrelated directories is noise. Mirrors the statusline gate.
// ---------------------------------------------------------------------------

describe('[GSD-T PROFILE] gating: GSD-T projects only', () => {
  it('non-GSD-T directory (no .gsd-t/) → NO [GSD-T PROFILE] line, [GSD-T NOW] still present', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm86-nongsdt-'));
    const out = spawnAutoRoute({ cwd: dir, prompt: 'hello' });
    assert.ok(out.includes('[GSD-T NOW]'), 'NOW line must always emit');
    assert.ok(!out.includes('[GSD-T PROFILE]'),
      'profile token must NOT emit outside GSD-T projects (Red Team M86 LOW)');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('GSD-T directory (.gsd-t/ present, no config) → [GSD-T PROFILE] named default emits', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm86-gsdt-'));
    fs.mkdirSync(path.join(dir, '.gsd-t'));
    const out = spawnAutoRoute({ cwd: dir, prompt: 'hello' });
    assert.ok(out.includes('[GSD-T PROFILE] profile: premium (default)'),
      `gated emission must still fire inside GSD-T projects, got: ${out}`);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
