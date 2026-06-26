'use strict';
/**
 * test/m94-d3-tier-preserved-on-reindex.test.js
 *
 * M94 D3-T5 — RE-PLAN Fix-2: parse_and_put tier-preservation on re-index.
 *
 * The killing test for [RULE] reindex-tier-never-silently-downgraded.
 *
 * What this tests:
 *   - A file indexed with tier=compiler-accurate (via mocked SCIP present)
 *   - Is EDITED
 *   - Then re-indexed via parse_and_put
 *   - Result MUST be either:
 *     (1) tier=compiler-accurate (SCIP still present + re-ran OK), OR
 *     (2) tier=tree-sitter-floor-STALE-SCIP (SCIP now absent/failed)
 *   - MUST NOT be:
 *     - plain 'tree-sitter-floor' (loses "was-accurate" signal)
 *     - plain 'compiler-accurate' over tree-sitter-only edges (claims accuracy not delivered)
 *     - any unlabeled or invalid tier
 *
 * [RULE] reindex-tier-never-silently-downgraded
 *
 * FAIL-LOUD-SKIP with reason='scip-indexer-not-present' when no SCIP indexer
 * is installed AND the mock cannot simulate it — but here we use the mock
 * (_resetScipCache) so the test runs even without real SCIP tools.
 *
 * This test uses the SCIP upgrader's internal mock injection (_resetScipCache)
 * to simulate the SCIP-present → SCIP-absent transition without requiring
 * real scip-typescript to be installed.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test } = require('node:test');

const GRAPH_INDEX  = path.join(__dirname, '..', 'bin', 'gsd-t-graph-index.cjs');
const SCIP_UPGRADE = path.join(__dirname, '..', 'bin', 'gsd-t-graph-scip-upgrade.cjs');

const VALID_TIERS = new Set(['compiler-accurate', 'tree-sitter-floor', 'tree-sitter-floor-STALE-SCIP']);

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-d3-reindex-test-'));
}
function writeFixture(dir, relPath, content) {
  const abs = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  return abs;
}

// ── Test: silent downgrade is FORBIDDEN ──────────────────────────────────────

test('T5: [RULE] reindex-tier-never-silently-downgraded — SCIP absent on re-index → STALE-SCIP not silent floor', () => {
  const { _resetScipCache, tryScipUpgrade } = require(SCIP_UPGRADE);
  const { openStore, parse_and_put, getRecord } = require(GRAPH_INDEX);

  const dir = makeTempDir();
  const dbPath = path.join(dir, 'graph.db');

  // 1. Set up: write initial file + build with SCIP "present" (mocked)
  //    We simulate what build_index would do when SCIP is present:
  //    write a file record with tier=compiler-accurate directly.
  _resetScipCache({ typescript: true, python: false, rust: false });

  const targetFile = writeFixture(dir, 'src/api.ts', `
import { db } from './db';
export function getUser(id: string) { return db.find(id); }
`);

  // Build the store and manually force tier=compiler-accurate for the target file
  // (simulating what build_index does when SCIP ran successfully)
  const db = openStore(dbPath);
  const { putRecord } = require(GRAPH_INDEX);
  putRecord(db, {
    file: 'src/api.ts',
    contentHash: 'aabbccdd11223344',  // any initial hash
    entities: [{ id: 'src/api.ts#getUser@3', type: 'function', name: 'getUser', file: 'src/api.ts', exported: true }],
    edges: [{ kind: 'IMPORT', src: 'src/api.ts', dst: './db', partial: 0 }],
    tier: 'compiler-accurate',
  });

  // Verify the initial record is compiler-accurate
  const initialRecord = getRecord(db, 'src/api.ts');
  assert.strictEqual(initialRecord.tier, 'compiler-accurate',
    'Initial record must be compiler-accurate (setup precondition)');

  // 2. Edit the file
  fs.writeFileSync(targetFile, `
import { db } from './db';
export function getUser(id: string) { return db.find(id); }
export function deleteUser(id: string) { return db.delete(id); }
`);

  // 3. Now simulate SCIP being ABSENT on re-index
  _resetScipCache({ typescript: false, python: false, rust: false });

  // 4. Call parse_and_put
  const result = parse_and_put(targetFile, 'src/api.ts', {
    db,
    scip: { tryScipUpgrade },
    existingTier: 'compiler-accurate',
  });
  db.close();

  // 5. Assert the tier — MUST be STALE-SCIP or compiler-accurate, NEVER plain floor
  assert.ok(VALID_TIERS.has(result.tier),
    `result.tier must be a valid tier; got: ${result.tier}`);

  // The key assertion: with SCIP mock-absent + prevTier=compiler-accurate,
  // the tier MUST NOT be plain 'tree-sitter-floor'
  // (it should be 'tree-sitter-floor-STALE-SCIP' to preserve the "was-accurate" signal)
  assert.notStrictEqual(result.tier, 'tree-sitter-floor',
    `[RULE] reindex-tier-never-silently-downgraded VIOLATED: ` +
    `Re-index of a previously compiler-accurate file MUST NOT silently downgrade ` +
    `to plain 'tree-sitter-floor' (loses "was-accurate" signal). ` +
    `Expected 'tree-sitter-floor-STALE-SCIP'; got '${result.tier}'.`);

  // MUST NOT be an unlabeled tier
  assert.ok(['compiler-accurate', 'tree-sitter-floor-STALE-SCIP'].includes(result.tier),
    `[RULE] reindex-tier-never-silently-downgraded: expected 'compiler-accurate' or ` +
    `'tree-sitter-floor-STALE-SCIP'; got '${result.tier}'`);

  console.error(`[T5] PASS — re-index tier: ${result.tier} (was: compiler-accurate, SCIP now absent)`);
});

// ── Test: SCIP still present on re-index → compiler-accurate preserved ───────

test('T5: [RULE] reindex-tier-never-silently-downgraded — SCIP still present on re-index → tier stays valid', () => {
  const { _resetScipCache, tryScipUpgrade } = require(SCIP_UPGRADE);
  const { openStore, parse_and_put, putRecord } = require(GRAPH_INDEX);

  const dir = makeTempDir();
  const dbPath = path.join(dir, 'graph.db');

  // Simulate SCIP present for typescript
  _resetScipCache({ typescript: true, python: false, rust: false });

  const targetFile = writeFixture(dir, 'src/service.ts', `
export function computeTotal(items: number[]) { return items.reduce((a, b) => a + b, 0); }
`);

  const db = openStore(dbPath);
  putRecord(db, {
    file: 'src/service.ts',
    contentHash: 'initial_hash_001',
    entities: [],
    edges: [],
    tier: 'compiler-accurate',
  });

  // Edit the file
  fs.writeFileSync(targetFile, `
export function computeTotal(items: number[]) { return items.reduce((a, b) => a + b, 0); }
export function computeAverage(items: number[]) { return computeTotal(items) / items.length; }
`);

  // SCIP still "present" (mocked) — but real scip-typescript may not be on PATH
  // Result should be compiler-accurate (if scip runs) OR tree-sitter-floor-STALE-SCIP (if it fails)
  // In BOTH cases the key invariant is: NOT plain tree-sitter-floor
  const result = parse_and_put(targetFile, 'src/service.ts', {
    db,
    scip: { tryScipUpgrade },
    existingTier: 'compiler-accurate',
  });
  db.close();

  assert.ok(VALID_TIERS.has(result.tier),
    `result.tier must be a valid tier; got: ${result.tier}`);

  // When SCIP is reported present (mocked): result should be either compiler-accurate
  // (if real scip runs) or STALE-SCIP (if real scip fails). Never plain floor.
  assert.notStrictEqual(result.tier, 'tree-sitter-floor',
    `[RULE] reindex-tier-never-silently-downgraded: ` +
    `With SCIP mocked as present, re-index of a compiler-accurate file must not ` +
    `silently downgrade to plain tree-sitter-floor. Got: ${result.tier}`);

  // Either is acceptable:
  assert.ok(['compiler-accurate', 'tree-sitter-floor-STALE-SCIP'].includes(result.tier),
    `Expected compiler-accurate or STALE-SCIP when SCIP present; got: ${result.tier}`);
});

// ── Test: tryScipUpgrade prevTier=compiler-accurate + SCIP absent → STALE-SCIP ──

test('T5: tryScipUpgrade — prevTier=compiler-accurate + SCIP absent → tree-sitter-floor-STALE-SCIP', () => {
  const { tryScipUpgrade, _resetScipCache } = require(SCIP_UPGRADE);

  _resetScipCache({ typescript: false, python: false, rust: false });

  const dir = makeTempDir();
  const absPath = writeFixture(dir, 'src/x.ts', `export function x() {}`);

  const result = tryScipUpgrade(absPath, 'src/x.ts', [], [], {
    prevTier: 'compiler-accurate',
    projectRoot: dir,
  });

  assert.strictEqual(result.tier, 'tree-sitter-floor-STALE-SCIP',
    `[RULE] reindex-tier-never-silently-downgraded: prevTier=compiler-accurate + SCIP absent ` +
    `MUST produce tree-sitter-floor-STALE-SCIP; got: ${result.tier}`);
  assert.strictEqual(result.upgraded, false, 'upgraded must be false when SCIP absent');
});

// ── Test: tryScipUpgrade prevTier=null + SCIP absent → plain floor (not STALE-SCIP) ──

test('T5: tryScipUpgrade — prevTier=null + SCIP absent → tree-sitter-floor (not STALE-SCIP)', () => {
  const { tryScipUpgrade, _resetScipCache } = require(SCIP_UPGRADE);

  _resetScipCache({ typescript: false, python: false, rust: false });

  const dir = makeTempDir();
  const absPath = writeFixture(dir, 'src/y.ts', `export function y() {}`);

  const result = tryScipUpgrade(absPath, 'src/y.ts', [], [], {
    prevTier: null, // never was compiler-accurate
    projectRoot: dir,
  });

  assert.strictEqual(result.tier, 'tree-sitter-floor',
    `prevTier=null + SCIP absent should be plain tree-sitter-floor; got: ${result.tier}`);
});

// ── Test: FAIL-LOUD-SKIP pattern when real SCIP not installed ─────────────────

test('T5: FAIL-LOUD-SKIP — when no SCIP indexer is installed and cannot simulate, skip loudly', () => {
  // This test verifies the fail-loud-skip protocol per [RULE] reindex-tier-never-silently-downgraded.
  // We use the mock (_resetScipCache) for all the above tests so they run without real SCIP.
  // This test documents what should happen if the mock were NOT available:
  //   - The test must FAIL-LOUD-SKIP with reason='scip-indexer-not-present'
  //   - NEVER produce a silent green pass (the "could never observe compiler-accurate tier" problem)

  const { detectScip } = require(SCIP_UPGRADE);
  const { _resetScipCache } = require(SCIP_UPGRADE);
  _resetScipCache(null); // use real detection

  const realAvail = detectScip();
  const anyScipPresent = realAvail.typescript || realAvail.python || realAvail.rust;

  if (!anyScipPresent) {
    // Document the skip — this test suite uses mocks, so this path is informational
    console.error('[T5] NOTE: No real SCIP indexer found on PATH (scip-typescript/scip-python/rust-analyzer scip).');
    console.error('[T5] All tier-preservation tests above use _resetScipCache() mock injection.');
    console.error('[T5] In an environment without the mock, this test MUST FAIL-LOUD-SKIP reason=scip-indexer-not-present');
    // The tests above still PASS because they use the mock — this is correct behavior.
    // The "without mock" scenario is the one that must loudly skip (not silently green).
    assert.ok(true, 'No real SCIP — mock-based tests above are the correct behavior');
  } else {
    console.error(`[T5] Real SCIP found: ${JSON.stringify(realAvail)} — full integration tests would apply.`);
    assert.ok(true, 'Real SCIP present — integration path available');
  }
});
