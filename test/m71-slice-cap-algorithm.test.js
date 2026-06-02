"use strict";

// M71 — the slice cap is a VOLUME-DERIVED RUNAWAY BACKSTOP (not the target count;
// the probe decides the count by cohesive sub-domain WITHIN it). EVIDENCE the cap is
// required: with no cap the probe sliced a 5-file repo into ~20 slices / 44 agents
// (run wf_9c993376-097) and the GSD-T repo into 191. This test locks the calibration.
//
// computeSliceCap lives inline in the runtime-native workflow (no module.exports).
// Re-declare the SAME formula here; if the workflow's changes, update both.

const { test } = require("node:test");
const assert = require("node:assert/strict");

function computeSliceCap(t) {
  const files      = Number(t && (t.files || t.total_files || t.source_files)) || 0;
  const loc        = Number(t && (t.loc || t.lines_of_code || t.totalLoc)) || 0;
  const routes     = Number(t && (t.routes || t.route_modules)) || 0;
  const tables     = Number(t && (t.tables || t.orm_tables)) || 0;
  const components = Number(t && t.components) || 0;
  const domains    = Number(t && (t.featureDomains || t.feature_domains)) || 0;
  const fileSignal   = Math.sqrt(files) * 0.42;
  const structSignal = domains + Math.round(routes / 70) + Math.round(tables / 200) + Math.round(components / 250);
  const locSignal    = Math.sqrt(loc) / 800;
  const raw = fileSignal * 0.7 + structSignal * 0.8 + locSignal;
  return Math.max(3, Math.min(50, Math.round(raw)));
}

test("tiny 5-file repo → floor cap of 3 (binds the runaway: uncapped it sliced to ~20)", () => {
  assert.equal(computeSliceCap({ files: 5, loc: 7, featureDomains: 1 }), 3);
});

test("mid app → ~10", () => {
  const cap = computeSliceCap({ files: 300, loc: 45000, routes: 25, tables: 30, components: 40, featureDomains: 6 });
  assert.ok(cap >= 8 && cap <= 13, `expected ~10, got ${cap}`);
});

test("Hilo-scale → ~24-30 (proven-good was ~16-25 slices; cap gives headroom)", () => {
  const cap = computeSliceCap({ files: 1809, loc: 1000000, routes: 150, tables: 361, components: 510, featureDomains: 10 });
  assert.ok(cap >= 24 && cap <= 31, `expected ~27, got ${cap}`);
});

test("huge repo → clamped at the 50 ceiling (diminishing returns, no runaway)", () => {
  const cap = computeSliceCap({ files: 10000, loc: 3000000, routes: 600, tables: 900, components: 2000, featureDomains: 25 });
  assert.equal(cap, 50);
});

test("a bigger codebase never gets a smaller cap (monotonic-ish)", () => {
  const small = computeSliceCap({ files: 100, loc: 10000, featureDomains: 2 });
  const big   = computeSliceCap({ files: 2000, loc: 500000, routes: 100, tables: 200, featureDomains: 8 });
  assert.ok(big > small, `big(${big}) should exceed small(${small})`);
});

test("empty/garbage totals → floor of 3, never throws", () => {
  assert.equal(computeSliceCap({}), 3);
  assert.equal(computeSliceCap(null), 3);
  assert.equal(computeSliceCap({ files: "nonsense" }), 3);
});
