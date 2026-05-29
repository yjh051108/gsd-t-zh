'use strict';
/**
 * M56 D5 T2 — Gap-closure assertion tests
 *
 * Asserts that the three known stream-json gap sites carry either
 * (a) the `--output-format stream-json --verbose` flag pair, or
 * (b) the `GSD-T-LINT: skip stream-json` skip marker with a reason.
 *
 * Charter — `bin/gsd-t.js:3879 spawnClaudeSession`,
 *           `bin/gsd-t-parallel.cjs:378 _runCacheWarmProbe`,
 *           `bin/gsd-t-ratelimit-probe-worker.cjs:89 runOneProbe`.
 *
 * The lint itself catches NEW violations; this test ensures the existing
 * sites are accounted for.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const lint = require('../bin/gsd-t-capture-lint.cjs');

const projectDir = path.resolve(__dirname, '..');

function checkSiteHasMarker(relPath, fnName) {
  const abs = path.join(projectDir, relPath);
  const src = fs.readFileSync(abs, 'utf8');
  const lines = src.split('\n');

  // Find the function definition or invocation block.
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(fnName)) {
      startIdx = i;
      break;
    }
  }
  assert.ok(startIdx >= 0, `expected to find '${fnName}' in ${relPath}`);

  // Look for a skip marker within ±20 lines (matches lint radius).
  const lo = Math.max(0, startIdx - 20);
  const hi = Math.min(lines.length - 1, startIdx + 30);
  let hasMarker = false;
  for (let j = lo; j <= hi; j++) {
    if (lines[j].includes('GSD-T-LINT: skip stream-json')) {
      hasMarker = true;
      break;
    }
  }

  return { hasMarker, startIdx, lines };
}

test("gap-closure: bin/gsd-t.js spawnClaudeSession carries skip marker or stream-json flags", () => {
  const r = checkSiteHasMarker('bin/gsd-t.js', 'spawnClaudeSession');
  assert.ok(r.hasMarker, 'spawnClaudeSession should carry GSD-T-LINT: skip stream-json marker');
});

test("gap-closure: bin/gsd-t-parallel.cjs cache-warm probe carries skip marker or stream-json flags", () => {
  // Anchor on the function body (line ~346), not the doc-comment first-mention (~line 333)
  const r = checkSiteHasMarker('bin/gsd-t-parallel.cjs', 'function _runCacheWarmProbe');
  assert.ok(r.hasMarker, '_runCacheWarmProbe should carry GSD-T-LINT: skip stream-json marker');
});

test("gap-closure: lint passes against the live tree (all 3 sites + every other production spawn)", () => {
  // Run the stream-json lint in 'all' mode against the live project — should
  // exit 0 because the 3 known sites carry skip markers and every other
  // claude -p spawn site already wires --output-format stream-json --verbose
  // (verified during 19:21 audit on 2026-05-09).
  const r = lint.mainStreamJson({ projectDir, mode: 'all' });
  if (r.exitCode !== 0) {
    console.error('Stream-json lint violations:', JSON.stringify(r.violations, null, 2));
  }
  assert.strictEqual(r.exitCode, 0, 'live tree should be clean (all gaps closed via marker or flags)');
});
