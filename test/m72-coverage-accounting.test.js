"use strict";

// M72 — a deep-finder slice that returns no schema-valid output (runtime nudged it
// twice then dropped it) must NOT be silently counted as a clean slice. On the Hilo
// run, 7 of 19 slices dropped this way and the register presented PARTIAL coverage as
// complete. The workflow now: retries a finder once, flags a still-failed slice
// `failed:true`, excludes it from findings, names it, and downgrades status to
// "complete-partial-coverage". This locks that accounting logic (re-declared here;
// the workflow is a runtime-native script, not requireable).

const { test } = require("node:test");
const assert = require("node:assert/strict");

// Mirrors the coverage-accounting block in gsd-t-scan.workflow.js.
function accountCoverage(slices, sliceResults) {
  const failedSlices = [];
  slices.forEach((s, i) => {
    const r = sliceResults[i];
    if (!r || r.failed) failedSlices.push(s.key);
  });
  const succeededCount = slices.length - failedSlices.length;
  const coverageComplete = failedSlices.length === 0;
  const allFindings = sliceResults
    .filter(Boolean)
    .filter((r) => !r.failed)
    .flatMap((r) => (r.findings || []).map((f) => ({ ...f, slice: r.slice })));
  return {
    coverageComplete,
    failedSlices,
    slicesTotal: slices.length,
    slicesSucceeded: succeededCount,
    findings: allFindings.length,
    status: coverageComplete ? "complete" : "complete-partial-coverage",
  };
}

test("a dropped slice (failed:true) is excluded from findings + flags partial coverage", () => {
  const slices = [{ key: "a" }, { key: "b" }, { key: "c" }, { key: "d" }];
  const results = [
    { slice: "a", findings: [{ t: 1 }, { t: 2 }], failed: false },
    { slice: "b", findings: [], failed: true },   // dropped
    { slice: "c", findings: [{ t: 3 }], failed: false },
    { slice: "d", findings: [], failed: true },   // dropped
  ];
  const r = accountCoverage(slices, results);
  assert.equal(r.coverageComplete, false);
  assert.deepEqual(r.failedSlices, ["b", "d"]);
  assert.equal(r.slicesSucceeded, 2);
  assert.equal(r.findings, 3, "only findings from succeeded slices count");
  assert.equal(r.status, "complete-partial-coverage", "partial coverage is NOT 'complete'");
});

test("a genuinely-clean slice (failed:false, empty findings) is NOT a coverage gap", () => {
  const slices = [{ key: "a" }, { key: "b" }];
  const results = [
    { slice: "a", findings: [{ t: 1 }], failed: false },
    { slice: "b", findings: [], failed: false }, // clean, not dropped
  ];
  const r = accountCoverage(slices, results);
  assert.equal(r.coverageComplete, true, "an empty-but-succeeded slice is full coverage");
  assert.deepEqual(r.failedSlices, []);
  assert.equal(r.status, "complete");
});

test("a null pipeline result (whole chain dropped) counts as a failed slice", () => {
  const slices = [{ key: "a" }, { key: "b" }];
  const results = [{ slice: "a", findings: [{ t: 1 }], failed: false }, null];
  const r = accountCoverage(slices, results);
  assert.equal(r.coverageComplete, false);
  assert.deepEqual(r.failedSlices, ["b"]);
});

test("all slices succeed → full coverage, status complete", () => {
  const slices = [{ key: "a" }, { key: "b" }];
  const results = [
    { slice: "a", findings: [{ t: 1 }], failed: false },
    { slice: "b", findings: [{ t: 2 }], failed: false },
  ];
  const r = accountCoverage(slices, results);
  assert.equal(r.coverageComplete, true);
  assert.equal(r.findings, 2);
  assert.equal(r.status, "complete");
});
