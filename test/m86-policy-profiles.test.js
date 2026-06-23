/**
 * test/m86-policy-profiles.test.js
 *
 * Killing tests for M86-D1 deliverables:
 *   - T1: PROFILE_STAGE_TIERS + resolveProfile (headline census)
 *   - T2: model-profile config read/write + CLI envelope
 *   - T3: dual bin-propagation in gsd-t.js
 *   - T4: contract v1.1.0 doc-assertion
 *
 * Run: node --test test/m86-policy-profiles.test.js
 * Contract: .gsd-t/contracts/model-profile-config-contract.md v1.0.0 STABLE
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs   = require('node:fs');
const os   = require('node:os');

const POLICY_PATH  = path.resolve(__dirname, '../bin/gsd-t-model-tier-policy.cjs');
const PROFILE_PATH = path.resolve(__dirname, '../bin/gsd-t-model-profile.cjs');
const GSD_T_PATH   = path.resolve(__dirname, '../bin/gsd-t.js');
const TIER_CONTRACT_PATH = path.resolve(__dirname, '../.gsd-t/contracts/model-tier-policy-contract.md');
const SEAM_CONTRACT_PATH = path.resolve(__dirname, '../.gsd-t/contracts/model-profile-config-contract.md');

const policy  = require(POLICY_PATH);
const profile = require(PROFILE_PATH);

const { MODEL_IDS, PROFILE_STAGE_TIERS, INJECTABLE_STAGES, resolveProfile } = policy;

// ---------------------------------------------------------------------------
// T1 Headline — PROFILE_STAGE_TIERS existence and shape
// ---------------------------------------------------------------------------

describe('PROFILE_STAGE_TIERS: structure', () => {
  it('exports PROFILE_STAGE_TIERS with exactly 3 profiles', () => {
    assert.ok(PROFILE_STAGE_TIERS, 'PROFILE_STAGE_TIERS must be exported');
    const keys = Object.keys(PROFILE_STAGE_TIERS);
    assert.deepEqual(keys.sort(), ['premium', 'pro', 'standard']);
  });

  it('each profile is frozen', () => {
    for (const p of ['standard', 'pro', 'premium']) {
      assert.ok(Object.isFrozen(PROFILE_STAGE_TIERS[p]), `PROFILE_STAGE_TIERS["${p}"] must be frozen`);
    }
    assert.ok(Object.isFrozen(PROFILE_STAGE_TIERS), 'PROFILE_STAGE_TIERS itself must be frozen');
  });

  it('INJECTABLE_STAGES contains exactly the 6 overridable stage keys', () => {
    assert.ok(INJECTABLE_STAGES, 'INJECTABLE_STAGES must be exported');
    const expected = ['solution-space-probe', 'partition-probe', 'competition-judge', 'pre-mortem', 'red-team', 'debug-cycle-2'];
    assert.deepEqual([...INJECTABLE_STAGES].sort(), expected.sort());
    assert.ok(!INJECTABLE_STAGES.includes('competition-producers'), 'competition-producers must NOT be in INJECTABLE_STAGES');
  });
});

// ---------------------------------------------------------------------------
// T1 Headline census — resolveProfile per-stage census for all 3 profiles
// ---------------------------------------------------------------------------

describe('resolveProfile: headline census', () => {
  // standard: ZERO fable
  it('standard profile — zero fable: all 6 injectable stages use pre-M85 tiers', () => {
    const expected = {
      'solution-space-probe': MODEL_IDS.opus,
      'partition-probe':      MODEL_IDS.opus,
      'competition-judge':    MODEL_IDS.sonnet,
      'pre-mortem':           MODEL_IDS.opus,
      'red-team':             MODEL_IDS.opus,
      'debug-cycle-2':        MODEL_IDS.opus,
    };
    for (const [stage, expectedModel] of Object.entries(expected)) {
      const r = resolveProfile(stage, { profile: 'standard' });
      assert.equal(r.model, expectedModel,
        `standard profile: resolveProfile("${stage}") → expected "${expectedModel}", got "${r.model}"`);
    }
  });

  it('standard profile — competition-producers always opus (not a designated fable stage)', () => {
    const r = resolveProfile('competition-producers', { profile: 'standard' });
    assert.equal(r.model, MODEL_IDS.opus);
    assert.equal(r.requiresThinkingOmitted, false);
  });

  // pro: red-team + pre-mortem + debug-cycle-2 → fable
  it('pro profile — red-team + pre-mortem + debug-cycle-2 on fable; rest standard', () => {
    const fableStages = ['pre-mortem', 'red-team', 'debug-cycle-2'];
    const standardStages = {
      'solution-space-probe': MODEL_IDS.opus,
      'partition-probe':      MODEL_IDS.opus,
      'competition-judge':    MODEL_IDS.sonnet,
    };
    for (const stage of fableStages) {
      const r = resolveProfile(stage, { profile: 'pro' });
      assert.equal(r.model, MODEL_IDS.fable,
        `pro profile: resolveProfile("${stage}") → expected fable "${MODEL_IDS.fable}", got "${r.model}"`);
      assert.equal(r.requiresThinkingOmitted, true, `pro profile: ${stage} must set requiresThinkingOmitted=true`);
    }
    for (const [stage, expectedModel] of Object.entries(standardStages)) {
      const r = resolveProfile(stage, { profile: 'pro' });
      assert.equal(r.model, expectedModel,
        `pro profile: resolveProfile("${stage}") → expected "${expectedModel}", got "${r.model}"`);
    }
  });

  it('pro profile — competition-producers held at opus (M82 blindness invariant)', () => {
    const r = resolveProfile('competition-producers', { profile: 'pro' });
    assert.equal(r.model, MODEL_IDS.opus);
  });

  // premium: all 6 fable
  it('premium profile — all 6 injectable stages on fable', () => {
    const fableStages = ['solution-space-probe', 'partition-probe', 'competition-judge', 'pre-mortem', 'red-team', 'debug-cycle-2'];
    for (const stage of fableStages) {
      const r = resolveProfile(stage, { profile: 'premium' });
      assert.equal(r.model, MODEL_IDS.fable,
        `premium profile: resolveProfile("${stage}") → expected fable "${MODEL_IDS.fable}", got "${r.model}"`);
    }
  });

  it('premium profile — competition-producers held at opus (M82 blindness invariant)', () => {
    const r = resolveProfile('competition-producers', { profile: 'premium' });
    assert.equal(r.model, MODEL_IDS.opus);
  });
});

// ---------------------------------------------------------------------------
// T1 — Override beats profile (precedence proof for SC(b))
// ---------------------------------------------------------------------------

describe('resolveProfile: override beats profile', () => {
  it('stageOverrides[stage] overrides profile tier (precedence proof)', () => {
    // competition-judge is sonnet in standard, but override → fable
    const r = resolveProfile('competition-judge', { profile: 'standard', stageOverrides: { 'competition-judge': 'fable' } });
    assert.equal(r.model, MODEL_IDS.fable, 'override must win over profile tier');
    assert.equal(r.requiresThinkingOmitted, true);
  });

  it('stageOverrides[stage] overrides pro profile (override proof for SC(b))', () => {
    const r = resolveProfile('competition-judge', { profile: 'pro', stageOverrides: { 'competition-judge': 'fable' } });
    assert.equal(r.model, MODEL_IDS.fable);
  });

  it('override to lower tier works (downgrade scenario)', () => {
    const r = resolveProfile('red-team', { profile: 'premium', stageOverrides: { 'red-team': 'sonnet' } });
    assert.equal(r.model, MODEL_IDS.sonnet, 'premium can be overridden down to sonnet');
  });
});

// ---------------------------------------------------------------------------
// T1/T2 — requiresThinkingOmitted propagated for fable stages
// ---------------------------------------------------------------------------

describe('resolveProfile: requiresThinkingOmitted propagated', () => {
  it('fable stages in premium profile have requiresThinkingOmitted=true', () => {
    for (const stage of INJECTABLE_STAGES) {
      const r = resolveProfile(stage, { profile: 'premium' });
      if (r.model === MODEL_IDS.fable) {
        assert.equal(r.requiresThinkingOmitted, true, `${stage} in premium should have requiresThinkingOmitted=true`);
      }
    }
  });

  it('non-fable stages have requiresThinkingOmitted=false', () => {
    const r = resolveProfile('competition-producers', { profile: 'premium' });
    assert.equal(r.requiresThinkingOmitted, false);
    const r2 = resolveProfile('competition-judge', { profile: 'standard' }); // sonnet
    assert.equal(r2.requiresThinkingOmitted, false);
  });
});

// ---------------------------------------------------------------------------
// T1 — Unknown profile/stage falls back gracefully (never throws)
// ---------------------------------------------------------------------------

describe('resolveProfile: unknown profile/stage', () => {
  it('unknown profile falls back to premium (named global default)', () => {
    const r = resolveProfile('red-team', { profile: 'turbo' });
    // Should fall back to premium → fable
    assert.equal(r.model, MODEL_IDS.fable, 'unknown profile should fall back to premium (fable for red-team)');
  });

  it('resolveProfile never throws for unknown stage', () => {
    assert.doesNotThrow(() => resolveProfile('bogus-stage', { profile: 'pro' }));
  });

  it('resolveProfile never throws for null/undefined opts', () => {
    assert.doesNotThrow(() => resolveProfile('red-team', null));
    assert.doesNotThrow(() => resolveProfile('red-team', undefined));
    assert.doesNotThrow(() => resolveProfile('red-team', {}));
  });
});

// ---------------------------------------------------------------------------
// T2 — Blindness clamps: validateSetStage
// ---------------------------------------------------------------------------

describe('validateSetStage: blindness clamps', () => {
  it('set-stage competition-producers <any> → REJECTED (not an overridable stage)', () => {
    for (const tier of ['opus', 'fable', 'sonnet', 'haiku']) {
      const r = profile.validateSetStage('competition-producers', tier);
      assert.equal(r.ok, false, `set-stage competition-producers ${tier} must be rejected`);
      assert.ok(r.error, 'must include error message');
    }
  });

  it('set-stage competition-judge opus → REJECTED (judge must differ from producers)', () => {
    const r = profile.validateSetStage('competition-judge', 'opus');
    assert.equal(r.ok, false, 'competition-judge=opus must be rejected (judge === producers model)');
    assert.ok(r.error);
  });

  it('set-stage competition-judge fable → ALLOWED', () => {
    const r = profile.validateSetStage('competition-judge', 'fable');
    assert.equal(r.ok, true, 'competition-judge=fable must be allowed');
  });

  it('set-stage competition-judge sonnet → ALLOWED', () => {
    const r = profile.validateSetStage('competition-judge', 'sonnet');
    assert.equal(r.ok, true, 'competition-judge=sonnet must be allowed');
  });

  it('set-stage unknown-tier → REJECTED', () => {
    const r = profile.validateSetStage('red-team', 'turbo');
    assert.equal(r.ok, false);
    assert.ok(r.error);
  });

  it('set-stage valid stage + valid tier → ALLOWED', () => {
    for (const stage of INJECTABLE_STAGES) {
      for (const tier of ['fable', 'sonnet', 'haiku']) {
        // Skip competition-judge=opus (blocked)
        if (stage === 'competition-judge' && tier === 'opus') continue;
        const r = profile.validateSetStage(stage, tier);
        assert.equal(r.ok, true, `set-stage ${stage} ${tier} should be allowed`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// T2 — Blindness clamp at RESOLVE level (hand-edited forbidden values)
// ---------------------------------------------------------------------------

describe('resolveProfile: blindness clamps at resolve level (hand-edited configs)', () => {
  it('competition-producers in stageOverrides → excluded from output (not in overrides map)', () => {
    // competition-producers always returns producers model regardless
    const r = resolveProfile('competition-producers', { profile: 'pro', stageOverrides: { 'competition-producers': 'fable' } });
    assert.equal(r.model, MODEL_IDS.opus, 'competition-producers must always resolve to opus regardless of stageOverrides');
  });

  it('stageOverrides competition-judge=opus → clamp: falls back to profile tier, not opus', () => {
    // A hand-edited config with {"competition-judge":"opus"} must be rejected at resolve
    const r = resolveProfile('competition-judge', { profile: 'pro', stageOverrides: { 'competition-judge': 'opus' } });
    // competition-judge in pro is sonnet (not fable, not opus due to clamp)
    assert.notEqual(r.model, MODEL_IDS.opus, 'competition-judge must never resolve to producers model (claude-opus-4-8)');
    assert.ok(r.configError, 'must have configError when blindness clamp fires');
  });

  it('buildResolveEnvelope: hand-edited forbidden combo never emits judge === producers model', () => {
    const envelope = profile.buildResolveEnvelope('pro', { 'competition-judge': 'opus', 'competition-producers': 'fable' }, undefined, undefined);
    assert.equal(envelope.ok, true);
    assert.notEqual(envelope.overrides['competition-judge'], MODEL_IDS.opus,
      'competition-judge in overrides must never equal producers model');
    assert.ok(!('competition-producers' in envelope.overrides),
      'competition-producers must NOT appear in the overrides map');
    assert.ok(envelope.configError, 'must have configError marker when forbidden values are present');
  });
});

// ---------------------------------------------------------------------------
// T2 — Absent config → named global default (SC(f))
// ---------------------------------------------------------------------------

describe('readConfig: absent config returns named global default', () => {
  it('absent .gsd-t/model-profile.json → profile=premium (named global default), never blank', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-test-'));
    try {
      const cfg = profile.readConfig(tmpDir);
      assert.equal(cfg.ok, true);
      assert.equal(cfg.profile, profile.GLOBAL_DEFAULT_PROFILE, `expected global default "${profile.GLOBAL_DEFAULT_PROFILE}", got "${cfg.profile}"`);
      assert.ok(cfg.profile, 'profile must not be blank (SC(f))');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// T2 — Malformed config fixtures (pre-mortem r1 #5)
// ---------------------------------------------------------------------------

describe('readConfig: malformed config produces DEFINED envelope, never silent premium', () => {
  let tmpDir;
  before(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-test-')); });
  after(() => { if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true }); });

  function writeRaw(dir, content) {
    const gsdtDir = path.join(dir, '.gsd-t');
    fs.mkdirSync(gsdtDir, { recursive: true });
    fs.writeFileSync(path.join(gsdtDir, 'model-profile.json'), content, 'utf8');
  }

  it('corrupt JSON → ok:false + configError (never silent clean envelope)', () => {
    writeRaw(tmpDir, '{ "profile": "pro", CORRUPT');
    const cfg = profile.readConfig(tmpDir);
    assert.equal(cfg.ok, false, 'corrupt JSON must return ok:false');
    assert.ok(cfg.configError, 'corrupt JSON must set configError');
  });

  it('wrong-typed profile (integer) → ok:false + configError', () => {
    writeRaw(tmpDir, JSON.stringify({ profile: 42, stageOverrides: {} }));
    const cfg = profile.readConfig(tmpDir);
    assert.equal(cfg.ok, false);
    assert.ok(cfg.configError);
  });

  it('wrong-typed profile (null in object) → ok:false + configError', () => {
    writeRaw(tmpDir, JSON.stringify({ profile: null }));
    const cfg = profile.readConfig(tmpDir);
    assert.equal(cfg.ok, false);
    assert.ok(cfg.configError);
  });

  it('stageOverrides wrong-typed (array) → ok:false + configError', () => {
    writeRaw(tmpDir, JSON.stringify({ profile: 'pro', stageOverrides: ['red-team', 'fable'] }));
    const cfg = profile.readConfig(tmpDir);
    assert.equal(cfg.ok, false);
    assert.ok(cfg.configError);
  });

  it('stageOverrides non-string value → ok:false + configError', () => {
    writeRaw(tmpDir, JSON.stringify({ profile: 'pro', stageOverrides: { 'red-team': 42 } }));
    const cfg = profile.readConfig(tmpDir);
    assert.equal(cfg.ok, false);
    assert.ok(cfg.configError);
  });

  it('top-level null → ok:false + configError', () => {
    writeRaw(tmpDir, 'null');
    const cfg = profile.readConfig(tmpDir);
    assert.equal(cfg.ok, false);
    assert.ok(cfg.configError);
  });
});

// ---------------------------------------------------------------------------
// T2 — Hand-edited forbidden-values fixture (pre-mortem c2 #4)
// ---------------------------------------------------------------------------

describe('buildResolveEnvelope: hand-edited forbidden values produce safe output', () => {
  it('{"competition-judge":"opus","competition-producers":"fable"} → judge≠opus, producers absent, configError', () => {
    const forbiddenOverrides = { 'competition-judge': 'opus', 'competition-producers': 'fable' };
    const envelope = profile.buildResolveEnvelope('pro', forbiddenOverrides, undefined, undefined);
    assert.equal(envelope.ok, true);
    // judge must not be opus (producers' model)
    assert.notEqual(envelope.overrides['competition-judge'], MODEL_IDS.opus,
      'competition-judge must not resolve to producers model in output overrides');
    // producers must not appear in overrides
    assert.ok(!('competition-producers' in envelope.overrides),
      'competition-producers must not appear in output overrides map');
    // configError must be present
    assert.ok(envelope.configError, 'configError must be present when forbidden values are silently dropped');
  });
});

// ---------------------------------------------------------------------------
// T2 — resolve CLI envelope shape
// ---------------------------------------------------------------------------

describe('CLI: gsd-t-model-profile.cjs resolve', () => {
  it('resolve --profile pro --json emits well-formed envelope with overrides map', () => {
    const r = spawnSync(process.execPath, [PROFILE_PATH, 'resolve', '--profile', 'pro', '--json'], { encoding: 'utf8' });
    assert.equal(r.status, 0, `expected exit 0; stderr=${r.stderr}`);
    let parsed;
    assert.doesNotThrow(() => { parsed = JSON.parse(r.stdout); }, `not valid JSON: ${r.stdout}`);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.profile, 'pro');
    assert.ok(parsed.overrides, 'envelope must have overrides');
    assert.ok(parsed.requiresThinkingOmitted, 'envelope must have requiresThinkingOmitted map');
    // pro: red-team, pre-mortem, debug-cycle-2 → fable
    assert.equal(parsed.overrides['red-team'], MODEL_IDS.fable);
    assert.equal(parsed.overrides['pre-mortem'], MODEL_IDS.fable);
    assert.equal(parsed.overrides['debug-cycle-2'], MODEL_IDS.fable);
    // pro: probes → opus, judge → sonnet
    assert.equal(parsed.overrides['solution-space-probe'], MODEL_IDS.opus);
    assert.equal(parsed.overrides['competition-judge'], MODEL_IDS.sonnet);
  });

  it('resolve --profile premium --json: all 6 injectable stages map to fable', () => {
    const r = spawnSync(process.execPath, [PROFILE_PATH, 'resolve', '--profile', 'premium', '--json'], { encoding: 'utf8' });
    assert.equal(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.ok, true);
    for (const stage of INJECTABLE_STAGES) {
      assert.equal(parsed.overrides[stage], MODEL_IDS.fable, `premium: ${stage} must be fable`);
      assert.equal(parsed.requiresThinkingOmitted[stage], true, `premium: ${stage} must have requiresThinkingOmitted=true`);
    }
  });

  it('resolve --profile standard --json: zero fable', () => {
    const r = spawnSync(process.execPath, [PROFILE_PATH, 'resolve', '--profile', 'standard', '--json'], { encoding: 'utf8' });
    assert.equal(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.ok, true);
    // No fable in standard
    for (const [stage, model] of Object.entries(parsed.overrides)) {
      assert.notEqual(model, MODEL_IDS.fable, `standard profile: ${stage} must not be fable`);
    }
  });

  it('resolve --profile unknown → non-zero + {ok:false, error}', () => {
    const r = spawnSync(process.execPath, [PROFILE_PATH, 'resolve', '--profile', 'turbo', '--json'], { encoding: 'utf8' });
    assert.notEqual(r.status, 0, 'unknown profile must exit non-zero');
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.ok, false);
    assert.ok(parsed.error);
  });

  it('resolve --profile pro requiresThinkingOmitted propagated for fable stages', () => {
    const r = spawnSync(process.execPath, [PROFILE_PATH, 'resolve', '--profile', 'pro', '--json'], { encoding: 'utf8' });
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.requiresThinkingOmitted['red-team'], true);
    assert.equal(parsed.requiresThinkingOmitted['pre-mortem'], true);
    assert.equal(parsed.requiresThinkingOmitted['debug-cycle-2'], true);
    assert.equal(parsed.requiresThinkingOmitted['solution-space-probe'], false);
  });
});

// ---------------------------------------------------------------------------
// T2 — CLI blindness clamp enforcement (set-stage)
// ---------------------------------------------------------------------------

describe('CLI: gsd-t-model-profile.cjs set-stage blindness clamps', () => {
  let tmpDir;
  before(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-test-')); });
  after(() => { if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('set-stage competition-producers opus → REJECTED (non-zero + ok:false)', () => {
    const r = spawnSync(process.execPath, [PROFILE_PATH, 'set-stage', 'competition-producers', 'opus', '--json'], {
      encoding: 'utf8', cwd: tmpDir,
    });
    assert.notEqual(r.status, 0, 'must exit non-zero');
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.ok, false);
  });

  it('set-stage competition-producers fable → REJECTED', () => {
    const r = spawnSync(process.execPath, [PROFILE_PATH, 'set-stage', 'competition-producers', 'fable', '--json'], {
      encoding: 'utf8', cwd: tmpDir,
    });
    assert.notEqual(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.ok, false);
  });

  it('set-stage competition-judge opus → REJECTED', () => {
    const r = spawnSync(process.execPath, [PROFILE_PATH, 'set-stage', 'competition-judge', 'opus', '--json'], {
      encoding: 'utf8', cwd: tmpDir,
    });
    assert.notEqual(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.ok, false);
  });

  it('set-stage competition-judge fable → ALLOWED (exits 0)', () => {
    const r = spawnSync(process.execPath, [PROFILE_PATH, 'set-stage', 'competition-judge', 'fable', '--json'], {
      encoding: 'utf8', cwd: tmpDir,
    });
    assert.equal(r.status, 0, `expected exit 0; stderr=${r.stderr}; stdout=${r.stdout}`);
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.ok, true);
  });
});

// ---------------------------------------------------------------------------
// T3 — Dual bin-propagation: gsd-t-model-profile.cjs in BOTH tool arrays
// ---------------------------------------------------------------------------

describe('gsd-t.js dual bin-propagation', () => {
  it('gsd-t-model-profile.cjs is registered in BOTH GLOBAL_BIN_TOOLS and PROJECT_BIN_TOOLS', () => {
    const src = fs.readFileSync(GSD_T_PATH, 'utf8');
    const count = (src.match(/"gsd-t-model-profile\.cjs"/g) || []).length;
    assert.ok(count >= 2,
      `gsd-t-model-profile.cjs must appear in both GLOBAL_BIN_TOOLS and PROJECT_BIN_TOOLS (found ${count} occurrences; expected >= 2)`);
  });

  it('gsd-t model-profile dispatches to the new module (smoke test)', () => {
    const r = spawnSync(process.execPath, [GSD_T_PATH, 'model-profile', 'resolve', '--profile', 'premium', '--json'], {
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, `gsd-t model-profile dispatch failed; stderr=${r.stderr}`);
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.profile, 'premium');
  });
});

// ---------------------------------------------------------------------------
// T4 — Contract doc-assertion: model-tier-policy-contract.md v1.1.0
// ---------------------------------------------------------------------------

describe('Contract doc-assertion: model-tier-policy-contract.md', () => {
  let contractSrc;
  before(() => { contractSrc = fs.readFileSync(TIER_CONTRACT_PATH, 'utf8'); });

  it('declares Version 1.1.0', () => {
    assert.ok(contractSrc.includes('## Version: 1.1.0'), 'contract must declare Version: 1.1.0');
  });

  it('contains the 3-profile dimension table', () => {
    assert.ok(contractSrc.includes('standard') && contractSrc.includes('pro') && contractSrc.includes('premium'),
      'contract must contain all 3 profile names');
    assert.ok(contractSrc.includes('PROFILE_STAGE_TIERS') || contractSrc.includes('Profile Dimension'),
      'contract must reference the profile dimension');
  });

  it('contains the ??-form lint obligation string', () => {
    assert.ok(contractSrc.includes('??'), 'contract must include the ??-form lint obligation');
  });

  it('references blindness clamp rules', () => {
    assert.ok(contractSrc.includes('competition-producers') && contractSrc.includes('blindness'),
      'contract must document blindness clamp rules');
  });
});

// ---------------------------------------------------------------------------
// T4 — Contract doc-assertion: model-profile-config-contract.md STABLE + hardened
// ---------------------------------------------------------------------------

describe('Contract doc-assertion: model-profile-config-contract.md', () => {
  let seamSrc;
  before(() => { seamSrc = fs.readFileSync(SEAM_CONTRACT_PATH, 'utf8'); });

  it('Status is STABLE (not DRAFT)', () => {
    assert.ok(seamSrc.includes('## Status: STABLE'), 'seam contract must be STABLE');
    assert.ok(!seamSrc.includes('Status: DRAFT'), 'seam contract must not still say DRAFT');
  });

  it('§Invoke-Time Injection enumerates all 10 invoking command files', () => {
    const commands10 = [
      'gsd-t-partition.md',
      'gsd-t-discuss.md',
      'gsd-t-plan.md',
      'gsd-t-impact.md',
      'gsd-t-milestone.md',
      'gsd-t-prd.md',
      'gsd-t-design-decompose.md',
      'gsd-t-verify.md',
      'gsd-t-debug.md',
      'gsd-t-wave.md',
    ];
    for (const cmd of commands10) {
      assert.ok(seamSrc.includes(cmd),
        `seam contract §Invoke-Time Injection must enumerate "${cmd}" (missing)`);
    }
  });

  it('§Invoke-Time Injection includes wave forwarding obligation', () => {
    assert.ok(seamSrc.toLowerCase().includes('wave') && seamSrc.includes('forward'),
      'seam contract must describe wave overrides-forwarding obligation');
  });

  it('§Invoke-Time Injection includes resolver-failure semantics (never silent premium)', () => {
    assert.ok(seamSrc.includes('resolver-failure') || seamSrc.includes('silent premium') || seamSrc.includes('MUST NEVER'),
      'seam contract must document resolver-failure semantics (never silent premium)');
  });

  it('§Drift-Lint Obligation carries bracket-key validation', () => {
    assert.ok(seamSrc.includes('bracket') || seamSrc.includes('bracket-key'),
      'seam contract must reference bracket-key validation');
  });

  it('§Drift-Lint Obligation carries wrapped-producers negative', () => {
    assert.ok(seamSrc.toLowerCase().includes('wrapped-producers') || seamSrc.includes('producers') && seamSrc.includes('BARE'),
      'seam contract must document wrapped-producers negative');
  });

  it('§Drift-Lint Obligation carries combined-form positive and negative', () => {
    assert.ok(seamSrc.includes('combined-form') || seamSrc.includes('Combined-form'),
      'seam contract must document combined-form lint obligations');
  });
});

// ---------------------------------------------------------------------------
// Verify fix-cycle 1 (Red Team M86) — killing tests for the validation bypass
// and the silent-acceptance regressions. Each of these FAILED before the fix.
// ---------------------------------------------------------------------------

describe('Red Team fix: prototype-key validation bypass (HIGH)', () => {
  const PROTO_KEYS = ['constructor', 'toString', '__proto__', 'hasOwnProperty'];

  for (const key of PROTO_KEYS) {
    it(`resolveProfile: tier "${key}" in stageOverrides → configError + profile-tier fallback, model stays a STRING`, () => {
      const r = resolveProfile('red-team', { profile: 'standard', stageOverrides: { 'red-team': key } });
      assert.equal(typeof r.model, 'string', `model must be a string, got ${typeof r.model}`);
      assert.equal(r.model, MODEL_IDS.opus, 'standard profile red-team must fall back to opus, NOT premium fable');
      assert.ok(r.configError, 'prototype-key tier must surface a configError (never silent)');
    });
  }

  it('resolveProfile: profile "constructor" → premium named default, model a string', () => {
    const r = resolveProfile('red-team', { profile: 'constructor', stageOverrides: {} });
    assert.equal(typeof r.model, 'string');
    assert.equal(r.model, MODEL_IDS.fable, 'unknown profile falls back to the named premium default');
  });

  it('envelope: prototype-key tier never yields a clean envelope with the stage MISSING (the JSON.stringify drop)', () => {
    const env = profile.buildResolveEnvelope('standard', { 'red-team': 'constructor' });
    assert.equal(env.ok, true);
    assert.ok(Object.prototype.hasOwnProperty.call(env.overrides, 'red-team'),
      'red-team key must be PRESENT in overrides (missing key = workflow ?? falls back to premium fable)');
    assert.equal(env.overrides['red-team'], MODEL_IDS.opus, 'standard red-team resolves opus');
    assert.ok(env.configError, 'envelope must carry configError — never a silent clean envelope');
    const json = JSON.parse(JSON.stringify(env));
    assert.equal(json.overrides['red-team'], MODEL_IDS.opus, 'key survives JSON round-trip');
  });

  it('readConfig: prototype-key tier value in config file → entry ignored + configError (CLI repro)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm86-proto-'));
    fs.mkdirSync(path.join(dir, '.gsd-t'));
    fs.writeFileSync(path.join(dir, '.gsd-t', 'model-profile.json'),
      '{"profile":"standard","stageOverrides":{"red-team":"constructor"}}');
    const cfg = profile.readConfig(dir);
    assert.equal(cfg.ok, false, 'config with invalid tier must be ok:false');
    assert.ok(cfg.configError, 'must carry configError');
    assert.ok(!('red-team' in cfg.stageOverrides), 'invalid entry must not persist into stageOverrides');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('Red Team fix: unknown stage keys rejected (MEDIUM x2)', () => {
  it('validateSetStage: unknown stage "red-tem" → rejected with the injectable list', () => {
    const v = profile.validateSetStage('red-tem', 'fable');
    assert.equal(v.ok, false, 'unknown stage must be rejected, not persisted');
    assert.ok(/Unknown stage/.test(v.error));
  });

  it('buildResolveEnvelope: single-stage resolve of unknown stage → ok:false (M85 explicit-error behavior restored)', () => {
    const env = profile.buildResolveEnvelope('pro', {}, 'red-tem');
    assert.equal(env.ok, false, 'unknown single-stage resolve must be an explicit error, not silent sonnet');
    assert.ok(/Unknown stage/.test(env.error));
  });

  it('readConfig: unknown stage key in config → flagged + ignored', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm86-unkstage-'));
    fs.mkdirSync(path.join(dir, '.gsd-t'));
    fs.writeFileSync(path.join(dir, '.gsd-t', 'model-profile.json'),
      '{"profile":"pro","stageOverrides":{"red-tem":"fable"}}');
    const cfg = profile.readConfig(dir);
    assert.equal(cfg.ok, false);
    assert.ok(/unknown stage/.test(cfg.configError));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('readConfig: competition-producers key in config → explicit M82 marker + ignored (c2 #4 letter)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm86-prodkey-'));
    fs.mkdirSync(path.join(dir, '.gsd-t'));
    fs.writeFileSync(path.join(dir, '.gsd-t', 'model-profile.json'),
      '{"profile":"pro","stageOverrides":{"competition-producers":"fable"}}');
    const cfg = profile.readConfig(dir);
    assert.equal(cfg.ok, false);
    assert.ok(/not overridable/.test(cfg.configError), 'producers entry must carry the M82 marker');
    assert.ok(!('competition-producers' in cfg.stageOverrides));
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// Verify fix-cycle 2 (Red Team M86 r2) — killing tests.
// ---------------------------------------------------------------------------

describe('Red Team r2 fix: self-propagation clobber guard (HIGH)', () => {
  const gsdt = require(GSD_T_PATH);

  it('copyBinToolsToProject SKIPS a project whose package.json name is @tekyzinc/gsd-t (the source repo)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm86-srcrepo-'));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: '@tekyzinc/gsd-t', version: '0.0.0' }));
    fs.mkdirSync(path.join(dir, 'bin'));
    const sentinel = path.join(dir, 'bin', 'gsd-t-model-tier-policy.cjs');
    fs.writeFileSync(sentinel, '// in-flight development copy — must NOT be overwritten\n');
    const ret = gsdt.copyBinToolsToProject(dir, 'source-repo-fixture');
    assert.equal(ret, false, 'must report nothing copied for the source repo');
    assert.equal(fs.readFileSync(sentinel, 'utf8'), '// in-flight development copy — must NOT be overwritten\n',
      'in-flight file must be byte-identical after the call (the M86 live clobber class)');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('copyBinToolsToProject still copies into an ordinary registered project (no over-skip)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm86-ordinary-'));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'some-consumer', version: '1.0.0' }));
    const ret = gsdt.copyBinToolsToProject(dir, 'ordinary-fixture');
    assert.equal(ret, true, 'ordinary project must receive bin tools');
    assert.ok(fs.existsSync(path.join(dir, 'bin', 'gsd-t-model-tier-policy.cjs')),
      'policy module must be propagated to ordinary projects');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('Red Team r2 fix: version-skew guard in model-profile (HIGH secondary)', () => {
  it('require()ing model-profile against a policy module missing the M86 surface throws a STRUCTURED error, not a TypeError', () => {
    const policyResolved = require.resolve(POLICY_PATH);
    const profileResolved = require.resolve(PROFILE_PATH);
    const savedPolicy = require.cache[policyResolved];
    const savedProfile = require.cache[profileResolved];
    delete require.cache[profileResolved];
    require.cache[policyResolved] = {
      id: policyResolved, filename: policyResolved, loaded: true,
      exports: { MODEL_IDS: { opus: 'claude-opus-4-8' } }, // pre-M86 shape: no PROFILE_STAGE_TIERS etc.
    };
    try {
      assert.throws(
        () => require(PROFILE_PATH),
        /version skew.*older policy module|missing the M86 profile surface/s,
        'skew must throw the structured message, not "Cannot convert undefined or null to object"'
      );
    } finally {
      require.cache[policyResolved] = savedPolicy;
      if (savedProfile) require.cache[profileResolved] = savedProfile;
      else delete require.cache[profileResolved];
    }
  });
});

describe('Red Team r2 fix: set/set-stage over an erroring config (MEDIUM + LOW)', () => {
  function mkProj(configJson) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm86-rw-'));
    fs.mkdirSync(path.join(dir, '.gsd-t'));
    fs.writeFileSync(path.join(dir, '.gsd-t', 'model-profile.json'), configJson);
    return dir;
  }
  function cli(dir, args) {
    return spawnSync(process.execPath, [PROFILE_PATH, ...args, '--json'], { cwd: dir, encoding: 'utf8' });
  }

  it('set-stage REFUSES to rewrite a config with configError (would persist defaulted premium over a typo\'d standard intent)', () => {
    const dir = mkProj('{"profile":"standad","stageOverrides":{"red-team":"haiku"}}');
    const r = cli(dir, ['set-stage', 'pre-mortem', 'haiku']);
    const out = JSON.parse(r.stdout);
    assert.equal(out.ok, false, 'must refuse, not silently rewrite');
    assert.match(out.error, /refusing to rewrite/);
    const onDisk = fs.readFileSync(path.join(dir, '.gsd-t', 'model-profile.json'), 'utf8');
    assert.ok(onDisk.includes('"standad"'), 'the user\'s original (typo\'d) profile must remain on disk untouched');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('set over an erroring config proceeds (explicit intent) but NAMES the normalization in a warning', () => {
    const dir = mkProj('{"profile":"pro","stageOverrides":{"red-team":"constructor","pre-mortem":"haiku"}}');
    const r = cli(dir, ['set', 'standard']);
    const out = JSON.parse(r.stdout);
    assert.equal(out.ok, true);
    assert.ok(out.warning && /normalized/.test(out.warning), 'rewrite over an erroring config must carry a warning');
    const onDisk = JSON.parse(fs.readFileSync(path.join(dir, '.gsd-t', 'model-profile.json'), 'utf8'));
    assert.equal(onDisk.profile, 'standard');
    assert.ok(!('red-team' in onDisk.stageOverrides), 'invalid entry dropped — but named in the warning, not silent');
    assert.equal(onDisk.stageOverrides['pre-mortem'], 'haiku', 'valid entries preserved');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('set-stage on a CLEAN config never mutates the profile field', () => {
    const dir = mkProj('{"profile":"standard","stageOverrides":{}}');
    const r = cli(dir, ['set-stage', 'red-team', 'fable']);
    assert.equal(JSON.parse(r.stdout).ok, true);
    const onDisk = JSON.parse(fs.readFileSync(path.join(dir, '.gsd-t', 'model-profile.json'), 'utf8'));
    assert.equal(onDisk.profile, 'standard', 'profile must be untouched by a stage tweak');
    assert.equal(onDisk.stageOverrides['red-team'], 'fable');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('Red Team r2 fix: resolveProfile library-level markers (LOW)', () => {
  it('invalid profile via library call → premium default WITH configError marker (not silent)', () => {
    const r = resolveProfile('red-team', { profile: 'constructor', stageOverrides: {} });
    assert.equal(r.model, MODEL_IDS.fable);
    assert.ok(r.configError && /unknown profile/.test(r.configError), 'silent premium default is the spend-escalation class');
  });

  it('unknown stage + invalid override → defensive sonnet (never fable) + both markers', () => {
    const r = resolveProfile('bogus', { profile: 'standard', stageOverrides: { bogus: 'constructor' } });
    assert.equal(r.tier, 'sonnet', 'unknown-stage fallback must be the cheap defensive tier, not fable');
    assert.ok(/unknown stage/.test(r.configError) && /invalid tier/.test(r.configError));
  });

  it('unknown stage + VALID override tier → still marked unknown-stage', () => {
    const r = resolveProfile('bogus', { profile: 'standard', stageOverrides: { bogus: 'haiku' } });
    assert.ok(/unknown stage/.test(r.configError), 'valid tier must not silence the unknown-stage marker');
  });
});

// ---------------------------------------------------------------------------
// Red Team r3 HIGH — the invoker form must honor persisted set-stage overrides.
// ---------------------------------------------------------------------------

describe('Red Team r3 fix: bare resolve (the invoker form) honors persisted stageOverrides', () => {
  it('config {premium, red-team:haiku} → bare `resolve --json` emits haiku for red-team (override WINS)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm86-bare-'));
    fs.mkdirSync(path.join(dir, '.gsd-t'));
    fs.writeFileSync(path.join(dir, '.gsd-t', 'model-profile.json'),
      '{"profile":"premium","stageOverrides":{"red-team":"haiku"}}');
    const r = spawnSync(process.execPath, [PROFILE_PATH, 'resolve', '--json'], { cwd: dir, encoding: 'utf8' });
    const out = JSON.parse(r.stdout);
    assert.equal(out.ok, true);
    assert.equal(out.overrides['red-team'], MODEL_IDS.haiku,
      'the persisted set-stage override must WIN on the invoker form — the r3 HIGH was --profile zeroing it (show said haiku, workflow billed fable)');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('the --profile diagnostic form still zeroes stageOverrides BY DESIGN (census/divergence semantics, documented)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm86-diag-'));
    fs.mkdirSync(path.join(dir, '.gsd-t'));
    fs.writeFileSync(path.join(dir, '.gsd-t', 'model-profile.json'),
      '{"profile":"premium","stageOverrides":{"red-team":"haiku"}}');
    const r = spawnSync(process.execPath, [PROFILE_PATH, 'resolve', '--profile', 'premium', '--json'], { cwd: dir, encoding: 'utf8' });
    const out = JSON.parse(r.stdout);
    assert.equal(out.overrides['red-team'], MODEL_IDS.fable, 'pure profile envelope — config-blind by design');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('no invoker command file uses the config-blind form (mirror of the T10 lint pin)', () => {
    const cmds = ['partition','plan','milestone','impact','prd','design-decompose','doc-ripple','verify','debug','wave'];
    for (const c of cmds) {
      const body = fs.readFileSync(path.resolve(__dirname, `../commands/gsd-t-${c}.md`), 'utf8');
      assert.ok(!/model-profile\s+resolve\s+--profile/.test(body),
        `commands/gsd-t-${c}.md must use the bare resolve form`);
      assert.ok(/model-profile\s+resolve\s+--json/.test(body),
        `commands/gsd-t-${c}.md must carry the bare \`resolve --json\` call`);
    }
  });
});
