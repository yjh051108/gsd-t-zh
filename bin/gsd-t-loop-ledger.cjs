/**
 * gsd-t-loop-ledger.cjs
 *
 * M90 §3 — Loop Ledger + Hard-Halt (non-convergence hook)
 *
 * Detects non-converging debug loops by computing a DETERMINISTIC symptom-signature
 * from the failing assertion / surface / file-class — NOT from the agent's prose label.
 * Persists the ledger cross-process via an atomic-write JSONL state file so the real
 * runCli workflow (a fresh process per cycle) accumulates cycles correctly.
 *
 * Invariants:
 *   R-LOOP-1  A fix that closes signature A but opens signature B still increments
 *             (variant-spawning IS the pathology).
 *   R-LOOP-2  3rd cycle on the SAME computed signature HARD-HALTS the patch path
 *             (halt is a returned ledger fact — never narration).
 *   R-LOOP-3  On halt, emit a premise-re-examination directive routing to §2 (D-ARCH).
 *   R-FAIL-3  Expose a `halted-but-no-re-examination` state for the §4 fail-closed gate.
 *
 * Contract: .gsd-t/contracts/m90-doctrine-mechanisms-contract.md §3  v1.0.0
 * House style §0: { ok:true, ... } | { ok:false, error }; zero external deps; sync APIs.
 *
 * CLI usage (via agent()-Bash runCli helper in workflows):
 *   node bin/gsd-t-loop-ledger.cjs append-cycle \
 *       --assertion "<failing-test-or-check>" \
 *       --surface "<file-or-module>" \
 *       --fileClass "<unit|e2e|lint|type|build>" \
 *       [--projectDir <path>]
 *
 *   node bin/gsd-t-loop-ledger.cjs read-exit-state [--projectDir <path>]
 *
 *   node bin/gsd-t-loop-ledger.cjs record-re-examination [--projectDir <path>]
 *
 * module.exports: { computeSignature, appendCycle, readExitState, recordReExamination }
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** After this many same-signature cycles the patch path is HARD-HALTED. */
const HALT_THRESHOLD = 3;

/**
 * Default state-file location relative to the project root.
 * Stored under .gsd-t/ (gitignored state dir).
 */
const STATE_SUBPATH = path.join('.gsd-t', 'loop-ledger-state.json');

// ---------------------------------------------------------------------------
// T1 — Computed symptom-signature
// ---------------------------------------------------------------------------

/**
 * Compute a deterministic, prose-independent signature key.
 *
 * Inputs:
 *   assertion  {string} — the failing test assertion / check description
 *   surface    {string} — the file or module where the failure occurs
 *   fileClass  {string} — broad class: "unit"|"e2e"|"lint"|"type"|"build"|etc.
 *
 * The key is a SHA-256 hex over the stable, normalised concat of the three
 * structural inputs (lower-cased, trimmed). Prose-label fields are explicitly
 * NOT inputs, so the agent's free-text description cannot influence the key.
 *
 * Returns { ok:true, signature } | { ok:false, error }
 */
function computeSignature({ assertion, surface, fileClass }) {
  const bad = validateSignatureInputs({ assertion, surface, fileClass });
  if (bad) return { ok: false, error: bad };

  const canonical = [
    assertion.trim().toLowerCase(),
    surface.trim().toLowerCase(),
    fileClass.trim().toLowerCase(),
  ].join('\x00');

  const signature = crypto.createHash('sha256').update(canonical).digest('hex');
  return { ok: true, signature };
}

function validateSignatureInputs({ assertion, surface, fileClass }) {
  if (!assertion || typeof assertion !== 'string' || !assertion.trim()) {
    return 'assertion must be a non-empty string';
  }
  if (!surface || typeof surface !== 'string' || !surface.trim()) {
    return 'surface must be a non-empty string';
  }
  if (!fileClass || typeof fileClass !== 'string' || !fileClass.trim()) {
    return 'fileClass must be a non-empty string';
  }
  return null;
}

// ---------------------------------------------------------------------------
// State-file helpers (cross-process persistence + atomic write)
// ---------------------------------------------------------------------------

function statePath(projectDir) {
  return path.join(projectDir || process.cwd(), STATE_SUBPATH);
}

/**
 * Read state from disk.
 * Returns { cycles: { [signature]: number }, halted: { [signature]: boolean },
 *           reExaminationPending: boolean } on success.
 * Returns null + logs error on corrupt/bad file.
 */
function readState(projectDir) {
  const fp = statePath(projectDir);
  if (!fs.existsSync(fp)) {
    return { cycles: {}, halted: {}, reExaminationPending: {} };
  }
  let raw;
  try {
    raw = fs.readFileSync(fp, 'utf8');
  } catch (e) {
    return null; // unreadable
  }
  try {
    const parsed = JSON.parse(raw);
    // Basic structural validation
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      typeof parsed.cycles !== 'object' ||
      typeof parsed.halted !== 'object'
    ) {
      return null; // corrupt
    }
    // reExaminationPending is a PER-SIGNATURE map { [signature]: true }, NOT a global boolean.
    // A global boolean let one recordReExamination() clear the gate for ALL halted signatures —
    // a second unresolved non-converging loop would then silently pass R-FAIL-3 (Red Team HIGH,
    // M90 verify). Migrate legacy shapes: a legacy `true` boolean → mark every currently-halted
    // signature pending (fail-closed); a legacy `false`/absent → empty map.
    if (typeof parsed.reExaminationPending === 'boolean') {
      const migrated = {};
      if (parsed.reExaminationPending === true) {
        for (const sig of Object.keys(parsed.halted)) {
          if (parsed.halted[sig]) migrated[sig] = true;
        }
      }
      parsed.reExaminationPending = migrated;
    } else if (
      parsed.reExaminationPending === null ||
      typeof parsed.reExaminationPending !== 'object'
    ) {
      parsed.reExaminationPending = {};
    }
    return parsed;
  } catch {
    return null; // JSON parse failure = corrupt
  }
}

/**
 * Atomically write state to disk (write to .tmp then rename).
 * Throws on write failure so callers can surface the error.
 */
function writeState(projectDir, state) {
  const fp = statePath(projectDir);
  const dir = path.dirname(fp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const tmp = fp + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmp, fp); // atomic on POSIX (same filesystem)
}

// ---------------------------------------------------------------------------
// T2 + T3 — Append-cycle + Hard-halt (R-LOOP-1 / R-LOOP-2)
// T4 — Premise-re-examination directive + fail-closed state (R-LOOP-3 / R-FAIL-3)
// ---------------------------------------------------------------------------

/**
 * Append a cycle for the given computed signature.
 *
 * Calling this once per debug-patch cycle — including variant-spawning fixes that
 * close one signature but open another (R-LOOP-1) — is the caller's responsibility.
 *
 * On the 3rd same-signature cycle:
 *   halted: true is set in the returned envelope AND persisted to the state file.
 *   directive: a premise-re-examination directive routing to §2 (D-ARCH) is emitted.
 *   reExaminationPending: true is set (the R-FAIL-3 / §4 fail-closed surface).
 *
 * Returns:
 *   { ok:true, signature, cycles, halted, haltCode, directive, reExaminationPending }
 *   | { ok:false, error }
 *
 * @param {object}  opts
 * @param {string}  opts.assertion   — failing test / check description
 * @param {string}  opts.surface     — file or module where failure occurs
 * @param {string}  opts.fileClass   — broad class (unit|e2e|lint|type|build|…)
 * @param {string}  [opts.projectDir] — project root (defaults to cwd)
 */
function appendCycle({ assertion, surface, fileClass, projectDir } = {}) {
  // 1. Compute signature
  const sigResult = computeSignature({ assertion, surface, fileClass });
  if (!sigResult.ok) return sigResult;
  const { signature } = sigResult;

  // 2. Read state (fail-closed on corrupt)
  const state = readState(projectDir);
  if (state === null) {
    return { ok: false, error: 'Loop-ledger state file is corrupt or unreadable. Cannot safely count cycles (silent reset would mask a loop). Fix or remove .gsd-t/loop-ledger-state.json and retry.' };
  }

  // 3. Increment cycle count for this signature (R-LOOP-1: every variant counts)
  state.cycles[signature] = (state.cycles[signature] || 0) + 1;
  const cycles = state.cycles[signature];

  // 4. Evaluate halt (R-LOOP-2: 3rd cycle → HARD-HALT)
  const halted = cycles >= HALT_THRESHOLD;
  if (halted) {
    state.halted[signature] = true;
    state.reExaminationPending[signature] = true; // R-FAIL-3: PER-SIGNATURE fail-closed surface
  }

  // 5. Atomic write
  try {
    writeState(projectDir, state);
  } catch (e) {
    return { ok: false, error: `Failed to write loop-ledger state: ${e.message}` };
  }

  // 6. Build envelope
  const envelope = {
    ok: true,
    signature,
    cycles,
    halted,
    haltCode: halted ? 'LOOP_HALT_CYCLE_THRESHOLD' : null,
    reExaminationPending: !!state.reExaminationPending[signature], // this signature's pending flag
    directive: halted
      ? {
          action: 'PREMISE_RE_EXAMINATION',
          route: 'architectural-hook',
          module: 'bin/gsd-t-architectural-trigger.cjs',
          contract: '.gsd-t/contracts/m90-doctrine-mechanisms-contract.md §2',
          reason: `Same-symptom-signature loop detected after ${cycles} cycles. The fix strategy has not converged — the premise must be re-examined at the architectural level, not patched further.`,
        }
      : null,
  };

  return envelope;
}

// ---------------------------------------------------------------------------
// T4 — read-exit-state (R-FAIL-3 surface for §4 fail-closed gate)
// ---------------------------------------------------------------------------

/**
 * Return the current exit-state of the loop ledger.
 *
 * D-CONTRACT (§4 fail-closed gate) reads this to determine whether
 * `halted-but-no-re-examination` should FAIL the verify workflow.
 *
 * Returns:
 *   { ok:true, haltedSignatures:string[], reExaminationPending:boolean,
 *     haltedButNoReExamination:boolean }
 *   | { ok:false, error }
 *
 * @param {string} [projectDir]
 */
function readExitState(projectDir) {
  const state = readState(projectDir);
  if (state === null) {
    return { ok: false, error: 'Loop-ledger state file is corrupt or unreadable.' };
  }

  const haltedSignatures = Object.keys(state.halted).filter((k) => state.halted[k]);
  // PER-SIGNATURE: a halted signature is unresolved iff its own pending flag is still set.
  // (A global boolean let one recordReExamination clear ALL — Red Team HIGH; now each halted
  // signature must be cleared individually, so a second unresolved loop still FAILs R-FAIL-3.)
  const pendingSignatures = haltedSignatures.filter((sig) => state.reExaminationPending[sig] === true);

  return {
    ok: true,
    haltedSignatures,
    pendingSignatures,
    // Back-compat field: true iff ANY halted signature is still pending re-examination.
    reExaminationPending: pendingSignatures.length > 0,
    // The §4 fail-closed predicate: at least one halted signature has no recorded re-examination.
    haltedButNoReExamination: pendingSignatures.length > 0,
  };
}

// ---------------------------------------------------------------------------
// T4 — record-re-examination (clears the fail-closed surface — never silently)
// ---------------------------------------------------------------------------

/**
 * Record that premise re-examination has been performed for a SPECIFIC halted signature.
 * Clears only THAT signature's pending flag so the §4 fail-closed gate can pass for it —
 * other halted-but-unresolved signatures stay pending (Red Team HIGH: a global clear let one
 * call resolve every loop at once, silently passing a second unresolved non-converging loop).
 *
 * Never clears silently — only this explicit call clears it. Clearing a signature that is not
 * halted/pending is a no-op (idempotent), not an error.
 *
 * @param {string|object} arg        — the signature string, OR an opts object { signature, projectDir }
 * @param {string} [maybeProjectDir] — projectDir when the first arg is a bare signature string
 * Returns { ok:true, cleared:string[] } | { ok:false, error }
 */
function recordReExamination(arg, maybeProjectDir) {
  // Accept both recordReExamination(signature, projectDir) and recordReExamination({ signature, projectDir }).
  let signature;
  let projectDir;
  if (arg && typeof arg === 'object') {
    signature = arg.signature;
    projectDir = arg.projectDir;
  } else {
    signature = arg;
    projectDir = maybeProjectDir;
  }

  const state = readState(projectDir);
  if (state === null) {
    return { ok: false, error: 'Loop-ledger state file is corrupt or unreadable.' };
  }

  const cleared = [];
  if (signature && typeof signature === 'string') {
    if (state.reExaminationPending[signature]) {
      delete state.reExaminationPending[signature];
      cleared.push(signature);
    }
  } else {
    // No signature given: refuse a blanket clear (that was the bug). Surface the choices.
    const pending = Object.keys(state.reExaminationPending).filter((s) => state.reExaminationPending[s]);
    return {
      ok: false,
      error: `recordReExamination requires a signature — refusing a blanket clear (would silently pass other unresolved loops). Pending signatures: ${pending.join(', ') || '(none)'}`,
    };
  }

  try {
    writeState(projectDir, state);
  } catch (e) {
    return { ok: false, error: `Failed to write loop-ledger state: ${e.message}` };
  }
  return { ok: true, cleared };
}

// ---------------------------------------------------------------------------
// T5 — module.exports (stable interface for D-CONTRACT; FREEZE after Wave 1)
// ---------------------------------------------------------------------------

module.exports = {
  computeSignature,
  appendCycle,
  readExitState,
  recordReExamination,
};

// ---------------------------------------------------------------------------
// CLI entry point (T5 — used by runCli agent()-Bash helpers in workflows)
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);
  const subcommand = args[0];

  function parseFlags(argv) {
    const flags = {};
    for (let i = 1; i < argv.length; i++) {
      const a = argv[i];
      if (a.startsWith('--') && i + 1 < argv.length) {
        flags[a.slice(2)] = argv[++i];
      }
    }
    return flags;
  }

  function exitOk(result) {
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exit(0);
  }

  function exitErr(result) {
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exit(1);
  }

  const flags = parseFlags(args);
  const projectDir = flags.projectDir || process.cwd();

  if (subcommand === 'append-cycle') {
    const { assertion, surface, fileClass } = flags;
    if (!assertion || !surface || !fileClass) {
      exitErr({ ok: false, error: 'append-cycle requires --assertion, --surface, and --fileClass' });
    }
    const result = appendCycle({ assertion, surface, fileClass, projectDir });
    if (!result.ok) exitErr(result);
    else exitOk(result);

  } else if (subcommand === 'read-exit-state') {
    const result = readExitState(projectDir);
    if (!result.ok) exitErr(result);
    else exitOk(result);

  } else if (subcommand === 'record-re-examination') {
    // Requires --signature (per-signature clear; a blanket clear is refused by the function).
    const result = recordReExamination({ signature: flags.signature, projectDir });
    if (!result.ok) exitErr(result);
    else exitOk(result);

  } else {
    exitErr({
      ok: false,
      error: subcommand
        ? `Unknown subcommand: ${subcommand}. Valid: append-cycle, read-exit-state, record-re-examination`
        : 'Subcommand required: append-cycle | read-exit-state | record-re-examination',
    });
  }
}
