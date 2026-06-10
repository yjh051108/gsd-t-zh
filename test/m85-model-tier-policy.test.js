/**
 * test/m85-model-tier-policy.test.js
 *
 * Unit tests for bin/gsd-t-model-tier-policy.cjs
 * Contract: .gsd-t/contracts/model-tier-policy-contract.md v1.0.0 STABLE
 *
 * Run: node --test test/m85-model-tier-policy.test.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const MODULE_PATH = path.resolve(__dirname, '../bin/gsd-t-model-tier-policy.cjs');
const policy = require(MODULE_PATH);

// ---------------------------------------------------------------------------
// T1 — MODULE_IDS: value-for-value contract match + frozen
// ---------------------------------------------------------------------------

describe('MODEL_IDS', () => {
  it('contains exactly 4 entries matching the contract table', () => {
    assert.equal(Object.keys(policy.MODEL_IDS).length, 4);
    assert.equal(policy.MODEL_IDS.opus,   'claude-opus-4-8');
    assert.equal(policy.MODEL_IDS.fable,  'claude-fable-5');
    assert.equal(policy.MODEL_IDS.sonnet, 'claude-sonnet-4-6');
    assert.equal(policy.MODEL_IDS.haiku,  'claude-haiku-4-5-20251001');
  });

  it('is frozen (no mutation)', () => {
    assert.ok(Object.isFrozen(policy.MODEL_IDS), 'MODEL_IDS must be frozen');
    assert.throws(() => { policy.MODEL_IDS.opus = 'something-else'; }, TypeError);
  });
});

// ---------------------------------------------------------------------------
// T1 — STAGE_TIERS: all 7 contract keys + frozen
// ---------------------------------------------------------------------------

describe('STAGE_TIERS', () => {
  const expected = {
    'solution-space-probe':  'fable',
    'partition-probe':       'fable',
    'competition-judge':     'fable',
    'competition-producers': 'opus',
    'pre-mortem':            'fable',
    'red-team':              'fable',
    'debug-cycle-2':         'fable',
  };

  it('contains exactly 7 entries matching the contract Stage Policy table', () => {
    assert.equal(Object.keys(policy.STAGE_TIERS).length, 7);
    for (const [key, tier] of Object.entries(expected)) {
      assert.equal(
        policy.STAGE_TIERS[key],
        tier,
        `STAGE_TIERS["${key}"] should be "${tier}", got "${policy.STAGE_TIERS[key]}"`
      );
    }
  });

  it('competition-producers tier is held at opus (M82 blindness invariant)', () => {
    assert.equal(policy.STAGE_TIERS['competition-producers'], 'opus');
  });

  it('all 5 fable stages resolve to fable tier', () => {
    const fableStages = [
      'solution-space-probe',
      'partition-probe',
      'competition-judge',
      'pre-mortem',
      'red-team',
      'debug-cycle-2',
    ];
    for (const stage of fableStages) {
      assert.equal(
        policy.STAGE_TIERS[stage],
        'fable',
        `STAGE_TIERS["${stage}"] should be "fable"`
      );
    }
  });

  it('is frozen (no mutation)', () => {
    assert.ok(Object.isFrozen(policy.STAGE_TIERS), 'STAGE_TIERS must be frozen');
    assert.throws(() => { policy.STAGE_TIERS['red-team'] = 'opus'; }, TypeError);
  });
});

// ---------------------------------------------------------------------------
// T1 — resolve(): all 7 stage keys return the correct concrete model id
// ---------------------------------------------------------------------------

describe('resolve(stageKey)', () => {
  it('all 7 stage keys return the correct concrete model id per contract', () => {
    const expected = {
      'solution-space-probe':  'claude-fable-5',
      'partition-probe':       'claude-fable-5',
      'competition-judge':     'claude-fable-5',
      'competition-producers': 'claude-opus-4-8',
      'pre-mortem':            'claude-fable-5',
      'red-team':              'claude-fable-5',
      'debug-cycle-2':         'claude-fable-5',
    };
    for (const [stage, id] of Object.entries(expected)) {
      assert.equal(
        policy.resolve(stage),
        id,
        `resolve("${stage}") should be "${id}", got "${policy.resolve(stage)}"`
      );
    }
  });

  it('resolve("competition-producers") === "claude-opus-4-8" (held-opus invariant)', () => {
    assert.equal(policy.resolve('competition-producers'), 'claude-opus-4-8');
  });

  it('resolve(<unknown>) returns null and never throws', () => {
    assert.equal(policy.resolve('bogus-stage'), null);
    assert.equal(policy.resolve(''), null);
    assert.equal(policy.resolve('OPUS'), null);
    assert.doesNotThrow(() => policy.resolve(null));
    assert.doesNotThrow(() => policy.resolve(undefined));
    assert.doesNotThrow(() => policy.resolve(42));
  });

  it('resolve returns concrete id, not tier alias', () => {
    // Ensure no function returns a tier alias string
    const tierAliases = new Set(['opus', 'fable', 'sonnet', 'haiku']);
    for (const stage of Object.keys(policy.STAGE_TIERS)) {
      const result = policy.resolve(stage);
      assert.ok(
        !tierAliases.has(result),
        `resolve("${stage}") returned tier alias "${result}" instead of a concrete model id`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// T1 — requiresThinkingOmitted(): truth table
// ---------------------------------------------------------------------------

describe('requiresThinkingOmitted(model)', () => {
  it('returns true ONLY for "claude-fable-5"', () => {
    assert.equal(policy.requiresThinkingOmitted('claude-fable-5'), true);
  });

  it('returns false for all other concrete ids', () => {
    assert.equal(policy.requiresThinkingOmitted('claude-opus-4-8'), false);
    assert.equal(policy.requiresThinkingOmitted('claude-sonnet-4-6'), false);
    assert.equal(policy.requiresThinkingOmitted('claude-haiku-4-5-20251001'), false);
  });

  it('returns false for tier aliases', () => {
    assert.equal(policy.requiresThinkingOmitted('opus'), false);
    assert.equal(policy.requiresThinkingOmitted('fable'), false);
    assert.equal(policy.requiresThinkingOmitted('sonnet'), false);
    assert.equal(policy.requiresThinkingOmitted('haiku'), false);
  });

  it('returns false for unknown/empty strings', () => {
    assert.equal(policy.requiresThinkingOmitted('unknown'), false);
    assert.equal(policy.requiresThinkingOmitted(''), false);
    assert.equal(policy.requiresThinkingOmitted(null), false);
    assert.equal(policy.requiresThinkingOmitted(undefined), false);
  });
});

// ---------------------------------------------------------------------------
// T1 — Zero-dep invariant: no external require beyond Node built-ins
// ---------------------------------------------------------------------------

describe('zero-dep invariant', () => {
  it('module source has no external require calls beyond node built-ins', () => {
    const fs = require('node:fs');
    const source = fs.readFileSync(MODULE_PATH, 'utf8');
    // Find all require calls in the module source (not test file)
    const requireMatches = source.match(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g) || [];
    for (const match of requireMatches) {
      const depMatch = match.match(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/);
      if (depMatch) {
        const dep = depMatch[1];
        // Allow node built-ins (they start with 'node:' or are known built-in names)
        const isBuiltin = dep.startsWith('node:') || [
          'assert', 'buffer', 'child_process', 'cluster', 'crypto', 'dgram',
          'dns', 'domain', 'events', 'fs', 'http', 'http2', 'https', 'module',
          'net', 'os', 'path', 'perf_hooks', 'punycode', 'querystring',
          'readline', 'repl', 'stream', 'string_decoder', 'timers', 'tls',
          'trace_events', 'tty', 'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib'
        ].includes(dep);
        assert.ok(isBuiltin, `External dependency found in module: require("${dep}"). Module must be zero-dep.`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// T2 — CLI: resolver JSON envelope tests
// ---------------------------------------------------------------------------

describe('CLI: resolve command', () => {
  it('resolve <knownKey> --json exits 0 and emits valid JSON envelope with required fields', () => {
    const result = spawnSync(process.execPath, [MODULE_PATH, 'resolve', 'red-team', '--json'], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, `Expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
    let parsed;
    assert.doesNotThrow(() => { parsed = JSON.parse(result.stdout); }, `Output was not valid JSON: ${result.stdout}`);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.stageKey, 'red-team');
    assert.equal(parsed.tier, 'fable');
    assert.equal(parsed.model, 'claude-fable-5');
    assert.ok('requiresThinkingOmitted' in parsed, 'envelope must contain requiresThinkingOmitted field');
    assert.equal(parsed.requiresThinkingOmitted, true);
  });

  it('resolve competition-producers --json returns claude-opus-4-8 (held-opus invariant)', () => {
    const result = spawnSync(process.execPath, [MODULE_PATH, 'resolve', 'competition-producers', '--json'], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.model, 'claude-opus-4-8');
    assert.equal(parsed.requiresThinkingOmitted, false);
  });

  it('resolve <unknown> --json exits non-zero with {ok:false, stageKey, error}', () => {
    const result = spawnSync(process.execPath, [MODULE_PATH, 'resolve', 'bogus', '--json'], {
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0, 'Unknown stage key must exit non-zero');
    let parsed;
    assert.doesNotThrow(() => { parsed = JSON.parse(result.stdout); }, `Output was not valid JSON: ${result.stdout}`);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.stageKey, 'bogus');
    assert.ok(parsed.error, 'envelope must contain error field');
  });

  it('resolve without stageKey --json exits non-zero', () => {
    const result = spawnSync(process.execPath, [MODULE_PATH, 'resolve', '--json'], {
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0, 'Missing stageKey must exit non-zero');
  });

  it('resolve all 7 known stage keys without error', () => {
    const stageKeys = [
      'solution-space-probe',
      'partition-probe',
      'competition-judge',
      'competition-producers',
      'pre-mortem',
      'red-team',
      'debug-cycle-2',
    ];
    for (const key of stageKeys) {
      const result = spawnSync(process.execPath, [MODULE_PATH, 'resolve', key, '--json'], {
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, `resolve "${key}" should exit 0, got ${result.status}`);
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.ok, true, `resolve "${key}" should return ok:true`);
      assert.ok(parsed.model, `resolve "${key}" must include model field`);
    }
  });
});

// M85 verify fix-cycle 1 — killing tests for the Red Team HIGH (unwired
// dispatcher) and the suffixed-id predicate LOW.
describe('gsd-t.js dispatcher: model-tier-policy (Red Team HIGH regression)', () => {
  const { spawnSync } = require('node:child_process');
  const path = require('node:path');
  const GSD_T = path.join(__dirname, '..', 'bin', 'gsd-t.js');

  it('`gsd-t model-tier-policy resolve red-team --json` dispatches and emits the envelope', () => {
    const r = spawnSync(process.execPath, [GSD_T, 'model-tier-policy', 'resolve', 'red-team', '--json'], { encoding: 'utf8' });
    assert.equal(r.status, 0, `expected exit 0, got ${r.status}; stderr=${r.stderr}`);
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.model, 'claude-fable-5');
    assert.equal(parsed.requiresThinkingOmitted, true);
  });

  it('module is registered in both bin-propagation lists (no installer-path silent breakage)', () => {
    const fs = require('node:fs');
    const src = fs.readFileSync(GSD_T, 'utf8');
    const count = (src.match(/"gsd-t-model-tier-policy\.cjs"/g) || []).length;
    assert.ok(count >= 2, `expected gsd-t-model-tier-policy.cjs in GLOBAL_BIN_TOOLS and PROJECT_BIN_TOOLS, found ${count} reference(s)`);
  });
});

describe('requiresThinkingOmitted: suffixed live ids + single-source (Red Team LOW regression)', () => {
  it('accepts the runtime bracket-suffixed display form', () => {
    assert.equal(policy.requiresThinkingOmitted('claude-fable-5[1m]'), true);
  });
  it('rejects non-string input and non-fable suffixed ids', () => {
    assert.equal(policy.requiresThinkingOmitted(null), false);
    assert.equal(policy.requiresThinkingOmitted(undefined), false);
    assert.equal(policy.requiresThinkingOmitted('claude-opus-4-8[1m]'), false);
  });
  it('predicate sources the id from MODEL_IDS (no second literal in the function body)', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'bin', 'gsd-t-model-tier-policy.cjs'), 'utf8');
    const fnBody = src.slice(src.indexOf('function requiresThinkingOmitted'), src.indexOf('}', src.indexOf('function requiresThinkingOmitted')));
    assert.ok(!fnBody.includes("'claude-fable-5'"), 'predicate body must reference MODEL_IDS.fable, not a bare literal');
  });
});
