"use strict";

/**
 * M99 (v4.13.12) — verify-gate tsc-trigger regression
 *
 * scip-typescript auto-creates an empty `{}` tsconfig.json at the root of any
 * project it indexes — INCLUDING zero-dep plain-JS repos like GSD-T itself.
 * The old trigger `has('node_modules/.bin/tsc') || has('tsconfig.json')` then
 * queued `npx --no-install tsc` with no tsc installed → "TypeScript not installed"
 * → a FALSE verify-gate FAIL (exitCode 4) that blocked M99 verify before the triad.
 *
 * Fix: require tsc to be ACTUALLY INSTALLED (binary present) AND a tsconfig.
 * A genuine TS project ships tsc in node_modules/.bin/, so this can't disable
 * typecheck where it truly applies.
 *
 * [RULE] tsc-runs-only-when-installed
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { _detectDefaultTrack2 } = require(path.join(__dirname, "..", "bin", "gsd-t-verify-gate.cjs"));

function tscPlanned(dir) {
  const plan = _detectDefaultTrack2(dir, []) || [];
  return plan.some((c) => c && c.id === "tsc");
}

test("empty stub tsconfig.json WITHOUT tsc installed does NOT trigger tsc (the scip false-block)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m99-tsc-stub-"));
  // The exact artifact scip-typescript leaves on a zero-dep JS repo.
  fs.writeFileSync(path.join(dir, "tsconfig.json"), "{}");
  // No node_modules/.bin/tsc.
  assert.equal(tscPlanned(dir), false,
    "a bare tsconfig with no installed tsc must NOT queue tsc — it false-fails on a non-TS project");
});

test("tsconfig.json AND an installed tsc binary DOES trigger tsc (real TS project)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m99-tsc-real-"));
  fs.writeFileSync(path.join(dir, "tsconfig.json"), '{"compilerOptions":{}}');
  // Simulate an installed tsc binary.
  fs.mkdirSync(path.join(dir, "node_modules", ".bin"), { recursive: true });
  fs.writeFileSync(path.join(dir, "node_modules", ".bin", "tsc"), "#!/bin/sh\n");
  assert.equal(tscPlanned(dir), true,
    "a real TS project (tsconfig + installed tsc) MUST still run typecheck");
});

test("installed tsc but NO tsconfig does NOT trigger tsc (nothing to typecheck against)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m99-tsc-notsconfig-"));
  fs.mkdirSync(path.join(dir, "node_modules", ".bin"), { recursive: true });
  fs.writeFileSync(path.join(dir, "node_modules", ".bin", "tsc"), "#!/bin/sh\n");
  assert.equal(tscPlanned(dir), false,
    "tsc without a tsconfig has no config to read — do not queue it");
});
