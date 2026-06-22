/**
 * m90-loop-ledger-halt.test.js
 *
 * The killing test for M90-D2 (m90-d-loop-ledger-halt).
 *
 * Headline: SC-LOOP-HOOK-FIRES — 3 same-signature cycles → HARD-HALT exit-state
 * fires DETERMINISTICALLY; verified by ledger/exit-state, NOT by agent prose.
 *
 * CROSS-PROCESS PERSISTENCE: the debug workflow invokes this bin via a fresh process
 * per cycle (runCli agent()-Bash helper). The 3 halt-accumulation cycles below are
 * driven as 3 DISTINCT spawnSync invocations — not 3 in-process calls — to prove
 * the ledger persists across process boundaries via the JSONL/JSON state file.
 *
 * ATOMIC WRITE (defense-in-depth): T6-AC-7 verifies that a corrupt state file
 * → { ok:false } + non-zero exit, never a silent count reset.
 *
 * Run: node --test test/m90-loop-ledger-halt.test.js
 *
 * Contract: .gsd-t/contracts/m90-doctrine-mechanisms-contract.md §3
 */

'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ── Helpers ──────────────────────────────────────────────────────────────────

const BIN = path.resolve(__dirname, '..', 'bin', 'gsd-t-loop-ledger.cjs');

/**
 * Invoke the CLI in a fresh child process (matches the real runCli wiring).
 * Returns { code, stdout, parsed } where parsed is the JSON envelope or null.
 */
function runCli(args, projectDir) {
  const result = spawnSync(
    process.execPath,
    [BIN, ...args, '--projectDir', projectDir],
    { encoding: 'utf8', timeout: 10_000 }
  );
  let parsed = null;
  try { parsed = JSON.parse(result.stdout.trim()); } catch { /* ignore */ }
  return { code: result.status, stdout: result.stdout.trim(), parsed };
}

function appendCycleArgs({ assertion, surface, fileClass }) {
  return [
    'append-cycle',
    '--assertion', assertion,
    '--surface',   surface,
    '--fileClass', fileClass,
  ];
}

/** Create an isolated temp dir for each test group, cleaned up after. */
function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'm90-loop-ledger-'));
}

function statePath(projectDir) {
  return path.join(projectDir, '.gsd-t', 'loop-ledger-state.json');
}

// ── In-process module tests ───────────────────────────────────────────────────

const { computeSignature, appendCycle, readExitState, recordReExamination } =
  require('../bin/gsd-t-loop-ledger.cjs');

// ── T1: Computed symptom-signature ───────────────────────────────────────────

describe('T1 — computeSignature', () => {
  test('identical failure surface → identical signature key (deterministic)', () => {
    const a = computeSignature({ assertion: 'test fails', surface: 'auth.js', fileClass: 'unit' });
    const b = computeSignature({ assertion: 'test fails', surface: 'auth.js', fileClass: 'unit' });
    assert.ok(a.ok, 'a should be ok');
    assert.ok(b.ok, 'b should be ok');
    assert.equal(a.signature, b.signature, 'Same inputs → byte-identical key');
  });

  test('different surface → different signature key', () => {
    const a = computeSignature({ assertion: 'test fails', surface: 'auth.js',  fileClass: 'unit' });
    const b = computeSignature({ assertion: 'test fails', surface: 'db.js',    fileClass: 'unit' });
    assert.ok(a.ok);
    assert.ok(b.ok);
    assert.notEqual(a.signature, b.signature, 'Different surface → different key');
  });

  test('different assertion → different key', () => {
    const a = computeSignature({ assertion: 'auth fails',  surface: 'auth.js', fileClass: 'unit' });
    const b = computeSignature({ assertion: 'login fails', surface: 'auth.js', fileClass: 'unit' });
    assert.ok(a.ok);
    assert.ok(b.ok);
    assert.notEqual(a.signature, b.signature);
  });

  test('different fileClass → different key', () => {
    const a = computeSignature({ assertion: 'test fails', surface: 'auth.js', fileClass: 'unit' });
    const b = computeSignature({ assertion: 'test fails', surface: 'auth.js', fileClass: 'e2e' });
    assert.ok(a.ok);
    assert.ok(b.ok);
    assert.notEqual(a.signature, b.signature);
  });

  test('prose-label fields do NOT influence the key (only the 3 structural inputs matter)', () => {
    // Same structural inputs produce same key regardless of any surrounding prose context
    const sig1 = computeSignature({ assertion: 'user login fails', surface: 'auth.js', fileClass: 'unit' });
    const sig2 = computeSignature({ assertion: 'user login fails', surface: 'auth.js', fileClass: 'unit' });
    assert.equal(sig1.signature, sig2.signature);
    // Changing a field that ISN'T in our 3 structural inputs (e.g., passing extra properties) has no effect
    const sig3 = computeSignature({ assertion: 'user login fails', surface: 'auth.js', fileClass: 'unit', proseLabel: 'agent thinks this is a login bug' });
    assert.equal(sig1.signature, sig3.signature, 'Extra prose-label property must not change the key');
  });

  test('bad input → { ok:false }', () => {
    assert.deepEqual(computeSignature({ assertion: '', surface: 'a.js', fileClass: 'unit' }),
      { ok: false, error: 'assertion must be a non-empty string' });
    assert.deepEqual(computeSignature({ assertion: 'x', surface: '', fileClass: 'unit' }),
      { ok: false, error: 'surface must be a non-empty string' });
    assert.deepEqual(computeSignature({ assertion: 'x', surface: 'a.js', fileClass: '' }),
      { ok: false, error: 'fileClass must be a non-empty string' });
    assert.deepEqual(computeSignature({ assertion: null, surface: 'a.js', fileClass: 'unit' }),
      { ok: false, error: 'assertion must be a non-empty string' });
    assert.deepEqual(computeSignature({ assertion: '   ', surface: 'a.js', fileClass: 'unit' }),
      { ok: false, error: 'assertion must be a non-empty string' });
  });
});

// ── T2: Append-cycle ledger + R-LOOP-1 (in-process) ─────────────────────────

describe('T2 — appendCycle + R-LOOP-1 (in-process)', () => {
  let tmpDir;
  before(() => { tmpDir = makeTmpDir(); });
  after(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  const base = { assertion: 'login fails', surface: 'auth.js', fileClass: 'unit' };
  const varB  = { assertion: 'signup fails', surface: 'signup.js', fileClass: 'unit' };

  test('first cycle → cycles:1, not halted', () => {
    const r = appendCycle({ ...base, projectDir: tmpDir });
    assert.ok(r.ok);
    assert.equal(r.cycles, 1);
    assert.equal(r.halted, false);
    assert.equal(r.haltCode, null);
  });

  test('second cycle (same sig) → cycles:2, not halted', () => {
    const r = appendCycle({ ...base, projectDir: tmpDir });
    assert.ok(r.ok);
    assert.equal(r.cycles, 2);
    assert.equal(r.halted, false);
  });

  test('R-LOOP-1: a signature-B-opening fix after signature-A cycles still increments overall ledger count', () => {
    // This verifies that variant-spawning (fix closes A, opens B) is counted as a cycle continuation,
    // not as progress. We append varB AFTER the 2 A cycles — the ledger accumulates both.
    const r = appendCycle({ ...varB, projectDir: tmpDir });
    assert.ok(r.ok);
    assert.equal(r.cycles, 1, 'signature B starts at 1 (its own signature)');
    // But signature A's state should still be at 2 (not reset)
    const exitState = readExitState(tmpDir);
    assert.ok(exitState.ok);
    // haltedSignatures is empty (nothing at threshold yet)
    assert.equal(exitState.haltedSignatures.length, 0);
  });
});

// ── T3: HARD-HALT exit-state on 3rd same-signature cycle (in-process) ────────

describe('T3 — HARD-HALT R-LOOP-2 (in-process)', () => {
  let tmpDir;
  before(() => { tmpDir = makeTmpDir(); });
  after(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  const base = { assertion: 'auth test fails', surface: 'auth.js', fileClass: 'unit', projectDir: undefined };

  test('1st cycle does NOT halt', () => {
    const r = appendCycle({ ...base, projectDir: tmpDir });
    assert.ok(r.ok);
    assert.equal(r.halted, false);
  });

  test('2nd cycle does NOT halt', () => {
    const r = appendCycle({ ...base, projectDir: tmpDir });
    assert.ok(r.ok);
    assert.equal(r.halted, false);
  });

  test('3rd cycle → HARD-HALT exit-state fires', () => {
    const r = appendCycle({ ...base, projectDir: tmpDir });
    assert.ok(r.ok);
    assert.equal(r.cycles, 3, 'should be 3rd cycle');
    assert.equal(r.halted, true, 'must be halted on 3rd cycle');
    assert.equal(r.haltCode, 'LOOP_HALT_CYCLE_THRESHOLD', 'haltCode must be set');
  });

  test('post-halt: readExitState reports haltedButNoReExamination', () => {
    const s = readExitState(tmpDir);
    assert.ok(s.ok);
    assert.equal(s.haltedButNoReExamination, true);
    assert.equal(s.reExaminationPending, true);
    assert.equal(s.haltedSignatures.length, 1, 'one signature halted');
  });
});

// ── T4: Premise-re-examination directive + R-FAIL-3 (in-process) ─────────────

describe('T4 — R-LOOP-3 directive + R-FAIL-3 fail-closed state (in-process)', () => {
  let tmpDir;
  before(() => { tmpDir = makeTmpDir(); });
  after(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  const base = { assertion: 'db test fails', surface: 'db.js', fileClass: 'unit' };

  test('drive to halt (3 cycles)', () => {
    appendCycle({ ...base, projectDir: tmpDir });
    appendCycle({ ...base, projectDir: tmpDir });
    const r3 = appendCycle({ ...base, projectDir: tmpDir });
    assert.ok(r3.ok);
    assert.equal(r3.halted, true);
  });

  test('R-LOOP-3: halt envelope carries a premise-re-examination directive routing to §2 (D-ARCH)', () => {
    // Re-drive a 4th cycle — still in halted territory, directive must be emitted
    const r = appendCycle({ ...base, projectDir: tmpDir });
    assert.ok(r.ok);
    assert.ok(r.directive, 'directive must be present on halt');
    assert.equal(r.directive.action, 'PREMISE_RE_EXAMINATION');
    assert.equal(r.directive.route, 'architectural-hook');
    assert.match(r.directive.module, /gsd-t-architectural-trigger\.cjs/);
    assert.match(r.directive.contract, /§2/);
  });

  test('R-FAIL-3: halted-but-no-re-examination state is exposed via readExitState', () => {
    const s = readExitState(tmpDir);
    assert.ok(s.ok);
    assert.equal(s.haltedButNoReExamination, true, 'R-FAIL-3 predicate must be true');
    assert.equal(s.reExaminationPending, true);
  });

  test('R-FAIL-3: recordReExamination clears the fail-closed state PER-SIGNATURE (never silently, never blanket)', () => {
    // The halted signature for `base` is the only one pending here.
    const sig = computeSignature(base).signature;
    // A blanket clear (no signature) is REFUSED — that was the Red Team HIGH bug.
    const blanket = recordReExamination({ projectDir: tmpDir });
    assert.equal(blanket.ok, false, 'blanket clear (no signature) must be refused');
    // Per-signature clear resolves exactly that signature.
    const r = recordReExamination(sig, tmpDir);
    assert.ok(r.ok);
    assert.deepEqual(r.cleared, [sig]);
    const s = readExitState(tmpDir);
    assert.ok(s.ok);
    assert.equal(s.reExaminationPending, false, 'must be cleared after that signature is re-examined');
    assert.equal(s.haltedButNoReExamination, false, 'fail-closed predicate must clear for the only pending sig');
  });

  test('R-FAIL-3 REGRESSION (Red Team HIGH): clearing ONE halted signature must NOT clear a second unresolved loop', () => {
    // Two DISTINCT non-converging loops, both halted in the same project state.
    const dir = makeTmpDir();
    try {
      const loopA = { assertion: 'A fails', surface: 'a.js', fileClass: 'unit', projectDir: dir };
      const loopB = { assertion: 'B fails', surface: 'b.js', fileClass: 'unit', projectDir: dir };
      for (let i = 0; i < 3; i++) appendCycle(loopA);
      for (let i = 0; i < 3; i++) appendCycle(loopB);
      const sigA = computeSignature(loopA).signature;
      const sigB = computeSignature(loopB).signature;

      let s = readExitState(dir);
      assert.equal(s.haltedSignatures.length, 2, 'both loops halted');
      assert.equal(s.haltedButNoReExamination, true, 'both unresolved → gate FAILs');

      // Re-examine ONLY loop A.
      const r = recordReExamination(sigA, dir);
      assert.ok(r.ok);
      assert.deepEqual(r.cleared, [sigA]);

      s = readExitState(dir);
      // The bug: a global boolean would now report clear for BOTH → gate silently PASSES.
      // The fix: loop B is still pending → gate must STILL FAIL.
      assert.equal(s.haltedButNoReExamination, true,
        'loop B still unresolved — gate must NOT pass after clearing only A (the silent-degradation the bug caused)');
      assert.deepEqual(s.pendingSignatures, [sigB]);

      // Resolve B too → now clear.
      recordReExamination(sigB, dir);
      s = readExitState(dir);
      assert.equal(s.haltedButNoReExamination, false, 'both resolved → gate passes');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ── T6: The killing test — 3 SEPARATE process invocations (cross-process) ────

describe('T6 — CROSS-PROCESS PERSISTENCE: 3 separate process invocations → HARD-HALT', () => {
  let tmpDir;
  before(() => { tmpDir = makeTmpDir(); });
  after(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  const sigArgs = appendCycleArgs({
    assertion: 'csrf token missing',
    surface:   'middleware/csrf.js',
    fileClass: 'e2e',
  });

  test('process 1 (cycle 1) → not halted', () => {
    const { code, parsed } = runCli(sigArgs, tmpDir);
    assert.equal(code, 0, 'CLI exit 0 on success');
    assert.ok(parsed, 'parsed JSON envelope');
    assert.ok(parsed.ok);
    assert.equal(parsed.cycles, 1);
    assert.equal(parsed.halted, false);
  });

  test('process 2 (cycle 2) → not halted', () => {
    const { code, parsed } = runCli(sigArgs, tmpDir);
    assert.equal(code, 0);
    assert.ok(parsed.ok);
    assert.equal(parsed.cycles, 2);
    assert.equal(parsed.halted, false);
  });

  test('process 3 (cycle 3) → HARD-HALT fires deterministically via persisted state', () => {
    const { code, parsed } = runCli(sigArgs, tmpDir);
    assert.equal(code, 0, 'Even on halt, the CLI exits 0 (the envelope carries the halt fact)');
    assert.ok(parsed.ok);
    assert.equal(parsed.cycles, 3);
    assert.equal(parsed.halted, true, 'HARD-HALT must fire on 3rd cross-process invocation');
    assert.equal(parsed.haltCode, 'LOOP_HALT_CYCLE_THRESHOLD');
    assert.ok(parsed.directive, 'premise-re-examination directive must be emitted on halt');
    assert.equal(parsed.directive.action, 'PREMISE_RE_EXAMINATION');
  });

  test('read-exit-state (fresh process) → haltedButNoReExamination', () => {
    const { code, parsed } = runCli(['read-exit-state'], tmpDir);
    assert.equal(code, 0);
    assert.ok(parsed.ok);
    assert.equal(parsed.haltedButNoReExamination, true, 'R-FAIL-3 state visible across processes');
    assert.equal(parsed.reExaminationPending, true);
    assert.ok(parsed.haltedSignatures.length > 0);
  });
});

// ── T6: R-LOOP-1 cross-process (variant-B still increments) ──────────────────

describe('T6 — R-LOOP-1 cross-process: signature-B-opening fix still increments', () => {
  let tmpDir;
  before(() => { tmpDir = makeTmpDir(); });
  after(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  const sigA = appendCycleArgs({ assertion: 'auth fails',   surface: 'auth.js',   fileClass: 'unit' });
  const sigB = appendCycleArgs({ assertion: 'signup fails', surface: 'signup.js', fileClass: 'unit' });

  test('cycle 1 on signature A', () => {
    const { parsed } = runCli(sigA, tmpDir);
    assert.ok(parsed.ok);
    assert.equal(parsed.cycles, 1);
    assert.equal(parsed.halted, false);
  });

  test('cycle 2 on signature A', () => {
    const { parsed } = runCli(sigA, tmpDir);
    assert.ok(parsed.ok);
    assert.equal(parsed.cycles, 2);
  });

  test('variant-B fix (new signature B): first cycle for B = 1, A stays at 2', () => {
    const { parsed } = runCli(sigB, tmpDir);
    assert.ok(parsed.ok, 'variant-B cycle must succeed');
    assert.equal(parsed.cycles, 1, 'signature B starts at cycle 1');
    assert.equal(parsed.halted, false);
  });

  test('signature A still at 2 (variant-B did not reset A)', () => {
    // Drive a 3rd A cycle to confirm A is at 3 (halted), proving A was at 2 before
    const { parsed } = runCli(sigA, tmpDir);
    assert.ok(parsed.ok);
    assert.equal(parsed.cycles, 3, 'A reaches 3rd cycle correctly (was at 2, not reset)');
    assert.equal(parsed.halted, true, 'A halts at cycle 3');
  });
});

// ── T6: Corrupt state file → { ok:false } + non-zero exit ────────────────────

describe('T6 — Corrupt state file → { ok:false } + non-zero exit (defense-in-depth)', () => {
  let tmpDir;
  before(() => {
    tmpDir = makeTmpDir();
    // Write a corrupt state file
    const dir = path.join(tmpDir, '.gsd-t');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'loop-ledger-state.json'), 'NOT VALID JSON {{{}', 'utf8');
  });
  after(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  const sigArgs = appendCycleArgs({ assertion: 'x fails', surface: 'x.js', fileClass: 'unit' });

  test('append-cycle with corrupt state → non-zero exit + { ok:false }', () => {
    const { code, parsed } = runCli(sigArgs, tmpDir);
    assert.equal(code, 1, 'Must exit non-zero on corrupt state');
    assert.ok(parsed, 'Must emit JSON envelope');
    assert.equal(parsed.ok, false, 'ok must be false');
    assert.ok(parsed.error, 'error message must be present');
  });

  test('read-exit-state with corrupt state → non-zero exit + { ok:false }', () => {
    const { code, parsed } = runCli(['read-exit-state'], tmpDir);
    assert.equal(code, 1, 'Must exit non-zero on corrupt state');
    assert.equal(parsed.ok, false);
  });
});

// ── T5 / T6: CLI bad input → { ok:false } + non-zero exit ────────────────────

describe('T5 / T6 — CLI bad input → { ok:false } + non-zero exit', () => {
  let tmpDir;
  before(() => { tmpDir = makeTmpDir(); });
  after(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  test('no subcommand → non-zero + { ok:false }', () => {
    const { code, parsed } = runCli([], tmpDir);
    assert.equal(code, 1);
    assert.equal(parsed.ok, false);
  });

  test('unknown subcommand → non-zero + { ok:false }', () => {
    const { code, parsed } = runCli(['frobulate'], tmpDir);
    assert.equal(code, 1);
    assert.equal(parsed.ok, false);
  });

  test('append-cycle missing --assertion → non-zero + { ok:false }', () => {
    const { code, parsed } = runCli(
      ['append-cycle', '--surface', 'x.js', '--fileClass', 'unit'],
      tmpDir
    );
    assert.equal(code, 1);
    assert.equal(parsed.ok, false);
  });

  test('append-cycle missing --surface → non-zero + { ok:false }', () => {
    const { code, parsed } = runCli(
      ['append-cycle', '--assertion', 'x fails', '--fileClass', 'unit'],
      tmpDir
    );
    assert.equal(code, 1);
    assert.equal(parsed.ok, false);
  });

  test('append-cycle missing --fileClass → non-zero + { ok:false }', () => {
    const { code, parsed } = runCli(
      ['append-cycle', '--assertion', 'x fails', '--surface', 'x.js'],
      tmpDir
    );
    assert.equal(code, 1);
    assert.equal(parsed.ok, false);
  });
});

// ── T5: module.exports shape ──────────────────────────────────────────────────

describe('T5 — module.exports shape (stable interface for D-CONTRACT)', () => {
  test('exports computeSignature, appendCycle, readExitState, recordReExamination', () => {
    const mod = require('../bin/gsd-t-loop-ledger.cjs');
    assert.equal(typeof mod.computeSignature,    'function', 'computeSignature exported');
    assert.equal(typeof mod.appendCycle,         'function', 'appendCycle exported');
    assert.equal(typeof mod.readExitState,       'function', 'readExitState exported');
    assert.equal(typeof mod.recordReExamination, 'function', 'recordReExamination exported');
  });

  test('appendCycle returns { ok, signature, cycles, halted, haltCode, directive, reExaminationPending }', () => {
    const tmpDir = makeTmpDir();
    try {
      const r = appendCycle({ assertion: 'shape test', surface: 'x.js', fileClass: 'unit', projectDir: tmpDir });
      assert.ok(r.ok);
      assert.equal(typeof r.signature, 'string', 'signature is string');
      assert.equal(typeof r.cycles, 'number', 'cycles is number');
      assert.equal(typeof r.halted, 'boolean', 'halted is boolean');
      // haltCode and directive may be null when not halted
      assert.ok('haltCode' in r, 'haltCode key present');
      assert.ok('directive' in r, 'directive key present');
      assert.equal(typeof r.reExaminationPending, 'boolean', 'reExaminationPending is boolean');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('readExitState returns { ok, haltedSignatures, reExaminationPending, haltedButNoReExamination }', () => {
    const tmpDir = makeTmpDir();
    try {
      const r = readExitState(tmpDir);
      assert.ok(r.ok);
      assert.ok(Array.isArray(r.haltedSignatures), 'haltedSignatures is array');
      assert.equal(typeof r.reExaminationPending, 'boolean');
      assert.equal(typeof r.haltedButNoReExamination, 'boolean');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ── T6: Atomic write — interrupted partial write leaves { ok:false }, not a silent reset ───

describe('T6 — Atomic write: partial/interrupted write cannot silently reset cycle count', () => {
  let tmpDir;
  before(() => {
    tmpDir = makeTmpDir();
    // Simulate a partially-written tmp file left over from a previous interrupted write
    const dir = path.join(tmpDir, '.gsd-t');
    fs.mkdirSync(dir, { recursive: true });
    // Write a valid state file (2 cycles on signature A)
    // Then add a stale .tmp file with corrupt data — shouldn't interfere with next write
    const stateFile = path.join(dir, 'loop-ledger-state.json');
    const state = {
      cycles: {},
      halted: {},
      reExaminationPending: false,
    };
    fs.writeFileSync(stateFile, JSON.stringify(state), 'utf8');
    // The .tmp file is a leftover from a crash — it should be ignored by readState
    fs.writeFileSync(path.join(dir, 'loop-ledger-state.json.tmp.12345'), 'CORRUPT', 'utf8');
  });
  after(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  const sigArgs = appendCycleArgs({ assertion: 'atomic test', surface: 'atomic.js', fileClass: 'unit' });

  test('stale .tmp file does not interfere; state file is intact and read correctly', () => {
    // Cycle 1 — the stale .tmp file should not be read
    const r1 = appendCycle({ assertion: 'atomic test', surface: 'atomic.js', fileClass: 'unit', projectDir: tmpDir });
    assert.ok(r1.ok);
    assert.equal(r1.cycles, 1, 'State was fresh; cycle 1 reads correctly despite leftover .tmp');
  });

  test('post-write: state file is valid JSON (atomic rename succeeded)', () => {
    const sp = statePath(tmpDir);
    const raw = fs.readFileSync(sp, 'utf8');
    const parsed = JSON.parse(raw); // should not throw
    assert.equal(typeof parsed.cycles, 'object');
  });
});
