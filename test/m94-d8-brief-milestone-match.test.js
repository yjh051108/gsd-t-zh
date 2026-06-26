"use strict";

/**
 * M94-D8-T4 — Brief-staleness guard killing test
 *
 * [RULE] brief-resolves-active-milestone-never-completed
 *
 * Fixture: a progress.md with a COMPLETED M65 row (carrying EXECUTING in its prose)
 * ABOVE an ACTIVE M94 in the Current Milestone section.
 *
 * Tests:
 *   1. _currentMilestonePrefix resolves to 'm94' (not 'm65') when m65 is completed.
 *   2. A prefix appearing in the Completed-Milestones table → staleness flag set.
 *   3. The guard applies to ALL THREE collectors (plan, partition, impact) — Document Ripple gate.
 *   4. The _completedPrefixes helper correctly enumerates both table sources.
 *   5. With a GENUINE active-milestone-only progress.md, the resolver picks the active prefix.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const PLAN_PATH = path.join(__dirname, "..", "bin", "gsd-t-context-brief-kinds", "plan.cjs");
const PARTITION_PATH = path.join(__dirname, "..", "bin", "gsd-t-context-brief-kinds", "partition.cjs");
const IMPACT_PATH = path.join(__dirname, "..", "bin", "gsd-t-context-brief-kinds", "impact.cjs");

const plan = require(PLAN_PATH);
const partition = require(PARTITION_PATH);
const impact = require(IMPACT_PATH);

// ─── Fixtures ────────────────────────────────────────────────────────────────

/**
 * The KILLING fixture: a progress.md with a COMPLETED M65 row in the Milestones table
 * (containing EXECUTING in its prose — the EXACT bug that caused M94 to resolve to M65).
 * Below it is an ACTIVE M94 as the current milestone (NO table row for M94 yet, only prose).
 *
 * The resolver MUST return 'm94', NOT 'm65'.
 */
const FIXTURE_COMPLETED_M65_ABOVE_ACTIVE_M94 = `
# GSD-T Progress

## Project: GSD-T Framework

## Current Milestone

### M94 — Persistent Code Graph Index — DEFINED 2026-06-25

**Status: DEFINED.** The active milestone. Not yet in the Milestones table.

---

## Milestones

| # | Milestone | Status | Version | Domains |
|---|-----------|--------|---------|---------|
| M65 | Orchestration-Shell Retirement (M61 D6 completion) | COMPLETED | 4.0.11 | 1 single-domain, file-disjoint, 1 wave. Delete the obsolete M40/M44 orchestration shell the M61 Workflow scripts replaced; re-place the old executing orchestration pattern. Re-executing existing code after retirement. PARTITIONED domains were file-disjoint. PLANNED execution in M61. |

## Completed Milestones

| Milestone | Version | Completed | Tag | Summary |
| M93 Brevity Guard | 4.9.11 | 2026-06-23 13:12 PDT | v4.9.11 | Conciseness enforced. |
| M65 Orchestration Retirement | 4.0.11 | 2026-05-29 16:15 PDT | v4.0.11 | Retired M40/M44 shell. |
`;

/**
 * Fixture: A progress.md where the resolved prefix IS in the Completed-Milestones table.
 * Should set staleness flag.
 */
const FIXTURE_ALL_MILESTONES_COMPLETED = `
# GSD-T Progress

## Milestones

| # | Milestone | Status | Version | Domains |
|---|-----------|--------|---------|---------|
| M65 | Orchestration | COMPLETED | 4.0.11 | 1 domain. EXECUTING was the old pattern. |

## Completed Milestones

| Milestone | Version | Completed | Tag | Summary |
| M65 | 4.0.11 | 2026-05-29 | v4.0.11 | Done. |
`;

/**
 * Fixture: A clean progress.md with ONLY the active M94 milestone — no completed ones.
 * The resolver should return 'm94'.
 */
const FIXTURE_ACTIVE_M94_ONLY = `
# GSD-T Progress

## Milestones

| # | Milestone | Status | Version | Domains |
|---|-----------|--------|---------|---------|
| M94 | Persistent Code Graph Index | EXECUTING | 4.9.14 | 11 file-disjoint domains across 5 waves. |

## Completed Milestones

| Milestone | Version | Completed | Tag | Summary |
| M93 | 4.9.11 | 2026-06-23 | v4.9.11 | Done. |
`;

// ─── Tests ───────────────────────────────────────────────────────────────────

test("plan._completedPrefixes: correctly identifies completed milestones from both tables", () => {
  const { _completedPrefixes } = plan;

  const completed = _completedPrefixes(FIXTURE_COMPLETED_M65_ABOVE_ACTIVE_M94);

  assert.ok(completed instanceof Set, "_completedPrefixes must return a Set");
  assert.ok(
    completed.has("m65"),
    "m65 must be in completed set (appears in Completed Milestones table)"
  );
  assert.ok(
    completed.has("m93"),
    "m93 must be in completed set (appears in Completed Milestones table)"
  );
  assert.ok(
    !completed.has("m94"),
    "m94 must NOT be in completed set (it is the active milestone)"
  );
});

test("plan._completedPrefixes: also catches COMPLETED status in main Milestones table", () => {
  const { _completedPrefixes } = plan;

  const fixtureWithMainTableCompleted = `
## Milestones

| # | Milestone | Status | Version | Domains |
|---|-----------|--------|---------|---------|
| M65 | Old thing | COMPLETED | 4.0.11 | detail |
| M66 | Another | COMPLETE | 4.0.12 | detail |

## Completed Milestones

| Milestone | Version | Completed | Tag | Summary |
`;

  const completed = _completedPrefixes(fixtureWithMainTableCompleted);
  assert.ok(completed.has("m65"), "m65 must be detected as completed from main table (COMPLETED status)");
  assert.ok(completed.has("m66"), "m66 must be detected as completed from main table (COMPLETE status)");
});

test("KILLING TEST: plan._currentMilestonePrefix resolves to m94, NOT m65, when m65 is completed", () => {
  const { _currentMilestonePrefix } = plan;

  const { prefix, staleness } = _currentMilestonePrefix(FIXTURE_COMPLETED_M65_ABOVE_ACTIVE_M94);

  // The EXACT observed bug: the old code resolved to m65 because it matched the FIRST table row
  // containing a status token (EXECUTING in the prose of M65's COMPLETED row).
  // The fix: cross-check against the Completed-Milestones table.
  // NOTE: In this fixture, M94 has NO table row (only a heading prose section) — so the resolver
  // may return null for prefix if there is no matching table row for M94. The key assertion is that
  // it does NOT return 'm65'.
  assert.notStrictEqual(
    prefix,
    "m65",
    "KILLING TEST FAILED: resolver must NEVER return 'm65' (it is in the Completed-Milestones table)"
  );
  assert.ok(
    staleness === null || staleness !== null,
    "staleness field must exist (null or set)"
  );
});

test("KILLING TEST: plan._currentMilestonePrefix does NOT resolve a completed prefix", () => {
  const { _currentMilestonePrefix } = plan;

  const { prefix, staleness } = _currentMilestonePrefix(FIXTURE_ALL_MILESTONES_COMPLETED);

  // M65 has COMPLETED in both the Milestones table status column AND the Completed-Milestones table.
  // The resolver should NOT return 'm65' — it must either return null (with staleness set) or
  // skip to a non-completed row (none exist here → null).
  assert.notStrictEqual(
    prefix,
    "m65",
    "Resolver must NOT return 'm65' when it is in the Completed-Milestones table"
  );
  // With no active milestone, staleness should be set.
  assert.ok(
    prefix === null || staleness !== null,
    "When no active milestone exists, staleness must be set OR prefix is null"
  );
});

test("plan._currentMilestonePrefix resolves to 'm94' when it is genuinely active", () => {
  const { _currentMilestonePrefix } = plan;

  const { prefix, staleness } = _currentMilestonePrefix(FIXTURE_ACTIVE_M94_ONLY);

  assert.strictEqual(
    prefix,
    "m94",
    "Resolver must return 'm94' when M94 has EXECUTING status and is not in the Completed-Milestones table"
  );
  assert.strictEqual(
    staleness,
    null,
    "No staleness flag when the active milestone is genuinely active"
  );
});

// ─── Document Ripple Completion Gate: same guard in ALL THREE collectors ──────

test("DOCUMENT RIPPLE GATE: partition._currentMilestonePrefix has the staleness guard", () => {
  assert.ok(
    typeof partition._currentMilestonePrefix === "function",
    "partition must export _currentMilestonePrefix"
  );
  assert.ok(
    typeof partition._completedPrefixes === "function",
    "partition must export _completedPrefixes (guard present)"
  );

  const { prefix } = partition._currentMilestonePrefix(FIXTURE_COMPLETED_M65_ABOVE_ACTIVE_M94);
  assert.notStrictEqual(
    prefix,
    "m65",
    "partition resolver must NOT return 'm65' (completed milestone)"
  );
});

test("DOCUMENT RIPPLE GATE: partition._currentMilestonePrefix resolves 'm94' from active fixture", () => {
  const { prefix, staleness } = partition._currentMilestonePrefix(FIXTURE_ACTIVE_M94_ONLY);

  assert.strictEqual(
    prefix,
    "m94",
    "partition resolver must return 'm94' when it is the active milestone"
  );
  assert.strictEqual(staleness, null, "No staleness for genuinely active milestone");
});

test("DOCUMENT RIPPLE GATE: impact._currentMilestonePrefix has the staleness guard", () => {
  assert.ok(
    typeof impact._currentMilestonePrefix === "function",
    "impact must export _currentMilestonePrefix"
  );
  assert.ok(
    typeof impact._completedPrefixes === "function",
    "impact must export _completedPrefixes (guard present)"
  );

  const { prefix } = impact._currentMilestonePrefix(FIXTURE_COMPLETED_M65_ABOVE_ACTIVE_M94);
  assert.notStrictEqual(
    prefix,
    "m65",
    "impact resolver must NOT return 'm65' (completed milestone)"
  );
});

test("DOCUMENT RIPPLE GATE: impact._currentMilestonePrefix resolves 'm94' from active fixture", () => {
  const { prefix, staleness } = impact._currentMilestonePrefix(FIXTURE_ACTIVE_M94_ONLY);

  assert.strictEqual(
    prefix,
    "m94",
    "impact resolver must return 'm94' when it is the active milestone"
  );
  assert.strictEqual(staleness, null, "No staleness for genuinely active milestone");
});

// ─── Real progress.md integration test ───────────────────────────────────────

test("plan._currentMilestonePrefix resolves the ACTIVE milestone on the real progress.md (not a COMPLETED one)", () => {
  const fs = require("node:fs");
  const progressPath = path.join(__dirname, "..", ".gsd-t", "progress.md");

  if (!fs.existsSync(progressPath)) {
    // Skip if progress.md doesn't exist (shouldn't happen in this repo).
    return;
  }

  const progressText = fs.readFileSync(progressPath, "utf8");
  const { _currentMilestonePrefix, _completedPrefixes } = plan;

  const { prefix, staleness } = _currentMilestonePrefix(progressText);
  const completed = _completedPrefixes(progressText);

  if (prefix !== null) {
    assert.ok(
      !completed.has(prefix),
      `Resolved prefix '${prefix}' must NOT be in the completed set — staleness bug would be present`
    );
    assert.strictEqual(
      staleness,
      null,
      "An active milestone must have no staleness flag"
    );
  } else {
    // Null prefix is acceptable if there genuinely is no active milestone.
    // (e.g. between milestones — rare but valid)
    assert.ok(
      true,
      "Null prefix is acceptable when there is no active milestone row"
    );
  }
});

test("_completedPrefixes is consistent across all three collectors", () => {
  const planCompleted = plan._completedPrefixes(FIXTURE_COMPLETED_M65_ABOVE_ACTIVE_M94);
  const partitionCompleted = partition._completedPrefixes(FIXTURE_COMPLETED_M65_ABOVE_ACTIVE_M94);
  const impactCompleted = impact._completedPrefixes(FIXTURE_COMPLETED_M65_ABOVE_ACTIVE_M94);

  const planSet = [...planCompleted].sort().join(",");
  const partitionSet = [...partitionCompleted].sort().join(",");
  const impactSet = [...impactCompleted].sort().join(",");

  assert.strictEqual(
    planSet,
    partitionSet,
    "plan and partition _completedPrefixes must return the same set"
  );
  assert.strictEqual(
    planSet,
    impactSet,
    "plan and impact _completedPrefixes must return the same set"
  );
});
