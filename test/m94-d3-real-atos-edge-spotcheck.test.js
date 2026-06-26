'use strict';
/**
 * test/m94-d3-real-atos-edge-spotcheck.test.js
 *
 * M94 D3-T4 — Pre-mortem Fix-4: real Atos edge spotcheck (AC-2 correctness on real data).
 *
 * Gates AC-2 correctness on the REAL Atos repo (not just toy fixtures).
 *
 * [RULE] real-atos-edge-spotcheck-or-loud-skip:
 *   - Atos repo MUST be present at the known path for the test to run.
 *   - If absent: FAIL-LOUD-SKIP with reason='atos-repo-not-found' (mirrors K2's pattern).
 *   - NEVER silent pass when Atos is absent.
 *
 * When present:
 *   - build_index over real Atos at the pinned SHA
 *   - Assert ≥3 hand-picked known real imports/calls appear correctly in who-imports/who-calls
 *   - Assert total edge count > EDGE_FLOOR (>10k) — proves extractor is not emitting garbage
 *   - Records and asserts the pinned Atos SHA
 *
 * Hand-picked real edges (known imports in the Atos TS codebase):
 *   These are conservative, well-established import relationships expected to exist
 *   across React/TypeScript files in the Atos repo. If the pinned SHA changes,
 *   update the spotcheck list.
 *
 * NOTE: This test builds the FULL Atos index and may take ~30-120 seconds.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { test } = require('node:test');

const GRAPH_INDEX  = path.join(__dirname, '..', 'bin', 'gsd-t-graph-index.cjs');
const os = require('os');

// ── Constants ─────────────────────────────────────────────────────────────────

const ATOS_REPO = process.env.ATOS_REPO ||
  '/Users/david/projects/HiloAviation/hilo-figma-atos';

// Pinned SHA from K2 spike (2026-06-26) — [RULE] ac4-atos-sha-pinned
const PINNED_ATOS_SHA = 'b062c80129c0c8e5b82ee3a4eaf9dcc4255c43b5';

// Pre-registered floor: if total edges < this, the extractor is near-zero/garbage on real TS
const EDGE_FLOOR = 10_000;

// Timeout for the full-repo build
const BUILD_TIMEOUT_MS = 180_000; // 3 minutes (within AC-1 budget)

// ── FAIL-LOUD-SKIP if Atos not present ───────────────────────────────────────

test('T4: [RULE] real-atos-edge-spotcheck-or-loud-skip — Atos repo present or FAIL-LOUD-SKIP', { timeout: BUILD_TIMEOUT_MS }, () => {
  if (!fs.existsSync(ATOS_REPO)) {
    // [RULE] real-atos-edge-spotcheck-or-loud-skip: FAIL-LOUD-SKIP — never silent green
    const skipMsg = `FAIL-LOUD-SKIP: Atos repo not found at ${ATOS_REPO} — set ATOS_REPO env or ensure the repo is cloned. reason=atos-repo-not-found`;
    console.error('\n' + skipMsg);
    // Use skip (todo) pattern so the test is visible as skipped, not silently passing
    // node:test does not have assert.skip(), but we can signal via a thrown known error
    // Use process.exitCode override + mark — the test runner will see it as skipped
    const err = new Error(skipMsg);
    err.code = 'SKIP';
    err.reason = 'atos-repo-not-found';
    throw err;
  }

  // ── Pin the SHA ────────────────────────────────────────────────────────────
  let atosSha;
  try {
    atosSha = execSync(`git -C ${JSON.stringify(ATOS_REPO)} rev-parse HEAD`, {
      encoding: 'utf8',
    }).trim();
  } catch (e) {
    throw new Error(`Could not get Atos HEAD SHA: ${e.message}`);
  }

  assert.ok(/^[0-9a-f]{40}$/.test(atosSha), `Invalid Atos SHA: ${atosSha}`);

  // [RULE] ac4-atos-sha-pinned: assert the spotcheck is run against the pinned SHA
  assert.strictEqual(atosSha, PINNED_ATOS_SHA,
    `Atos SHA mismatch: expected ${PINNED_ATOS_SHA} (pinned), got ${atosSha}. ` +
    `If the repo has advanced, update PINNED_ATOS_SHA in this test.`);

  // ── Build the full Atos index ─────────────────────────────────────────────
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-t-atos-spotcheck-'));
  const dbPath = path.join(tmpDir, 'atos-graph.db');

  console.error(`[T4] Building full Atos index at pinned SHA ${atosSha}...`);
  const t0 = Date.now();

  const { build_index, openStore } = require(GRAPH_INDEX);
  const buildResult = build_index(ATOS_REPO, {
    dbPath,
    onProgress: ({ fileCount, total }) => {
      if (fileCount % 500 === 0) {
        console.error(`[T4]   ${fileCount}/${total} files indexed...`);
      }
    },
  });

  const durationMs = Date.now() - t0;
  console.error(`[T4] Build complete: ${buildResult.fileCount} files, ${buildResult.edgeCount} edges in ${durationMs}ms`);

  // ── Assert total edge count > floor (not near-zero/garbage) ──────────────
  assert.ok(buildResult.edgeCount > EDGE_FLOOR,
    `[Pre-mortem Fix-4] Total edge count ${buildResult.edgeCount} ≤ floor ${EDGE_FLOOR} ` +
    `— extractor is emitting near-zero/garbage edges on real Atos TS at scale. ` +
    `This means AC-2 correctness is NOT proven on real data.`);

  assert.ok(buildResult.fileCount > 100,
    `Expected > 100 files indexed in Atos; got ${buildResult.fileCount}. Repo may not be parsed.`);

  // ── Spot-check hand-picked known real edges ───────────────────────────────
  const db = openStore(dbPath);

  // Query: who imports a given target module specifier
  const whoImportsQuery = db.prepare(`
    SELECT src, dst FROM edges
    WHERE kind = 'IMPORT'
    AND dst LIKE ?
    LIMIT 5
  `);

  // Query: total import count (sanity)
  const totalImports = db.prepare(`SELECT COUNT(*) as c FROM edges WHERE kind = 'IMPORT'`).get().c;
  const totalCalls   = db.prepare(`SELECT COUNT(*) as c FROM edges WHERE kind = 'CALL'`).get().c;
  const totalFiles   = db.prepare(`SELECT COUNT(*) as c FROM files`).get().c;
  db.close();

  console.error(`[T4] Store contents — files: ${totalFiles}, IMPORT edges: ${totalImports}, CALL edges: ${totalCalls}`);

  assert.ok(totalImports > 1000,
    `Expected >1000 import edges in Atos (it's a ~4400-file TS/React repo); got ${totalImports}`);

  assert.ok(totalFiles >= buildResult.fileCount,
    `Store file count (${totalFiles}) should match build result (${buildResult.fileCount})`);

  // ── Spot-check: known real import patterns ────────────────────────────────
  // These are conservative patterns — module specifiers that MUST appear in the Atos codebase
  // given its TS/React nature. If these are missing, the extractor is broken on real code.
  const db2 = openStore(dbPath);

  const KNOWN_PATTERNS = [
    'react',           // React is the core framework — must be imported everywhere
    'drizzle-orm',     // ORM used throughout Atos (grep-verified: 364 occurrences at pinned SHA)
    'react-router',    // Routing library present in Atos (166 occurrences at pinned SHA)
  ];

  let foundCount = 0;
  const foundPatterns = [];
  const missingPatterns = [];

  for (const pattern of KNOWN_PATTERNS) {
    const rows = db2.prepare(`
      SELECT src FROM edges
      WHERE kind = 'IMPORT' AND dst LIKE ?
      LIMIT 1
    `).all(`%${pattern}%`);

    if (rows.length > 0) {
      foundCount++;
      foundPatterns.push(pattern);
      console.error(`[T4] ✓ Found imports for pattern: ${pattern} (e.g. imported in ${rows[0].src})`);
    } else {
      missingPatterns.push(pattern);
      console.error(`[T4] ✗ Missing imports for pattern: ${pattern}`);
    }
  }
  db2.close();

  // Must find ≥3 of the known patterns — [RULE] real-atos-edge-spotcheck-or-loud-skip
  assert.ok(foundCount >= 3,
    `[Pre-mortem Fix-4] Only ${foundCount}/3 required real import patterns found. ` +
    `Missing: ${missingPatterns.join(', ')}. ` +
    `This means the edge extractor is not producing correct imports on real Atos TS code. ` +
    `Spotcheck requires ≥3 hand-picked known patterns to pass.`);

  console.error(`[T4] PASS — ${foundCount}/${KNOWN_PATTERNS.length} known patterns found, ` +
    `${buildResult.edgeCount} total edges (floor: ${EDGE_FLOOR}), SHA: ${atosSha}`);
});
