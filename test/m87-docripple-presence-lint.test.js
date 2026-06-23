"use strict";

// M87 D4 (A4) — ripple-presence drift lint (M71-family negative lint).
//
// The PseudoCode behavior map `PseudoCode-[Title].md` is a Living Document. It
// MUST appear in all FOUR ripple reference points defined by the source-of-truth
// contract §5:
//   1. templates/CLAUDE-global.md — Living Documents TABLE region   (integrate seam)
//   2. templates/CLAUDE-global.md — Pre-Commit Gate region          (integrate seam)
//   3. commands/gsd-t-doc-ripple.md — the doc-ripple ripple set     (D4 owns)
//   4. project CLAUDE.md — Living Documents reference               (integrate seam)
//
// CRITICAL (per feedback_coverage_check_structural_not_substring): the check is
// REGION-SCOPED, never a file-wide substring. Points 1 and 2 live in the SAME
// file (templates/CLAUDE-global.md) — a file-wide `includes()` would let one
// region satisfy the other (a token in the Pre-Commit Gate would falsely satisfy
// the Living Documents table assertion). So each region is extracted by its OWN
// structural boundaries and the token is asserted INSIDE that region only.
//
// The mandatory negative test (M71-family) proves the lint DISCRIMINATES: for
// EACH of the four regions independently — including the two same-file regions
// checked separately — deleting the token from JUST that region makes the
// assertion FAIL while the others still pass.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CLAUDE_GLOBAL = path.join(ROOT, "templates", "CLAUDE-global.md");
const DOC_RIPPLE = path.join(ROOT, "commands", "gsd-t-doc-ripple.md");
const PROJECT_CLAUDE = path.join(ROOT, "CLAUDE.md");

// The ripple token. `[Title]` is the literal placeholder used wherever the
// behavior-map family is referenced as a Living Document (it is a doc FAMILY,
// `PseudoCode-PayPal.md`, `PseudoCode-Extension.md`, …, not one instance).
const TOKEN = "PseudoCode-[Title].md";

// ── Region extractors (structural, path-as-path — never file-wide substring) ──

/**
 * Slice the lines from the line whose text matches `startRe` up to (but not
 * including) the next line matching `endRe`. Returns "" if `startRe` never hits
 * (a missing region — which must FAIL the presence assertion, NOT silently pass).
 */
function sliceRegion(body, startRe, endRe) {
  const lines = body.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (startRe.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) return ""; // region absent → presence check fails (correct)
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (endRe.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

// Region 1 — CLAUDE-global Living Documents TABLE: from the `# Living Documents`
// banner to the next `## ` heading. Bounded so it CANNOT bleed into the
// Pre-Commit Gate region (which is far below, after many `## ` sections).
function livingDocsTableRegion(body) {
  return sliceRegion(body, /^# Living Documents\s*$/, /^## /);
}

// Region 2 — CLAUDE-global Pre-Commit Gate: from the `## Pre-Commit Gate`
// heading to the next `## ` heading. A SEPARATE region in the SAME file.
function preCommitGateRegion(body) {
  return sliceRegion(body, /^## Pre-Commit Gate\b/, /^## /);
}

// Region 3 — doc-ripple ripple set: from `## What this command does` to the next
// `## ` heading (the paragraph that enumerates the blast-radius Living Documents).
function docRippleSetRegion(body) {
  return sliceRegion(body, /^## What this command does\s*$/, /^## /);
}

// Region 4 — project CLAUDE.md Living Documents reference: from a `Living
// Documents` marker line to the next `## `/`# ` heading. The integrate step
// writes this reference; until then the region is absent and the check FAILS
// (the expected pre-integrate state — the lint is detecting the missing write).
function projectClaudeLivingDocsRegion(body) {
  return sliceRegion(body, /Living Documents/, /^#{1,2} /);
}

// One row per ripple reference point. `read()` re-reads on each call so the
// negative cases (which mutate an in-memory copy) are independent of disk.
const REGIONS = [
  {
    id: 1,
    name: "templates/CLAUDE-global.md — Living Documents table",
    file: CLAUDE_GLOBAL,
    extract: livingDocsTableRegion,
  },
  {
    id: 2,
    name: "templates/CLAUDE-global.md — Pre-Commit Gate",
    file: CLAUDE_GLOBAL,
    extract: preCommitGateRegion,
  },
  {
    id: 3,
    name: "commands/gsd-t-doc-ripple.md — doc-ripple ripple set",
    file: DOC_RIPPLE,
    extract: docRippleSetRegion,
  },
  {
    id: 4,
    name: "CLAUDE.md — project Living Documents reference",
    file: PROJECT_CLAUDE,
    extract: projectClaudeLivingDocsRegion,
  },
];

function readBody(file) {
  return fs.readFileSync(file, "utf8");
}

// ── Positive: the token is present in EACH region (region-scoped) ─────────────
//
// NOTE (D4 status): points 1, 2, 4 are written SERIALLY AT INTEGRATE by the
// parent (shared files this domain does NOT own). Until then these three
// assertions FAIL — that is the lint correctly DETECTING the missing ripple
// writes. Point 3 (doc-ripple, D4-owned) passes now. Post-integrate all four go
// green. Do NOT relax these to make D4 self-green — the FAILURE is the signal.

for (const region of REGIONS) {
  test(`ripple point ${region.id}: "${TOKEN}" present in ${region.name}`, () => {
    const slice = region.extract(readBody(region.file));
    assert.ok(
      slice.includes(TOKEN),
      `"${TOKEN}" missing from ripple reference point ${region.id} (${region.name}). ` +
        `The region was extracted structurally; a file-wide token elsewhere does NOT satisfy it.`
    );
  });
}

// ── Negative (mandatory M71-family): the lint DISCRIMINATES per region ────────
//
// For EACH region independently — including the two same-file CLAUDE-global
// regions (1 and 2) — removing the token from JUST that region must make ONLY
// that region's presence check fail, while every OTHER region (whose own copy of
// the token is untouched) still passes. This proves the check is region-scoped,
// not a file-wide substring that any one region could satisfy for the others.

for (const target of REGIONS) {
  test(`negative: removing "${TOKEN}" from region ${target.id} (${target.name}) fails ONLY that region`, () => {
    // Build an in-memory corpus with the token present everywhere, then strip it
    // from ONLY the target region — synthesised so the test is self-contained and
    // not dependent on the (pre-integrate) on-disk presence of points 1/2/4.
    const corpus = new Map();
    for (const r of REGIONS) {
      if (!corpus.has(r.file)) corpus.set(r.file, readBody(r.file));
    }

    // Ensure the token is present in every region's slice first (inject if the
    // on-disk region is still empty pre-integrate, so the negative test exercises
    // the region-scoping logic regardless of integrate state).
    for (const r of REGIONS) {
      let body = corpus.get(r.file);
      let slice = r.extract(body);
      if (slice === "" || !slice.includes(TOKEN)) {
        // Inject a token line at the top of the region (or, if the region is
        // absent, this no-op leaves it absent — handled below by the target-only
        // expectation). We only inject when the region EXISTS but lacks the token.
        if (slice !== "") {
          const injected = slice.replace(/\n/, `\n- ${TOKEN}\n`);
          body = body.replace(slice, injected);
          corpus.set(r.file, body);
        }
      }
    }

    // Now strip the token from ONLY the target region.
    let targetBody = corpus.get(target.file);
    const targetSlice = target.extract(targetBody);
    const stripped = targetSlice.split(TOKEN).join("__REMOVED__");
    targetBody = targetBody.replace(targetSlice, stripped);
    corpus.set(target.file, targetBody);

    // Assert: target region now MISSING the token; every other region still HAS it.
    for (const r of REGIONS) {
      const slice = r.extract(corpus.get(r.file));
      if (r.id === target.id) {
        assert.ok(
          !slice.includes(TOKEN),
          `Stripping region ${target.id} should remove the token from it — region-scoping broken.`
        );
      } else {
        // Other regions whose token we injected/kept must be UNAFFECTED. (If a
        // region is genuinely absent pre-integrate AND in a different file, it has
        // no token to keep — that is points 1/2/4's pre-integrate state and is not
        // a discrimination failure; we only assert non-bleed for SAME-FILE peers.)
        if (r.file === target.file) {
          assert.ok(
            slice.includes(TOKEN),
            `Same-file peer region ${r.id} lost its token when only region ${target.id} ` +
              `was edited — proves a file-wide check would let one region satisfy the other. ` +
              `The two CLAUDE-global regions (1,2) MUST be scoped separately.`
          );
        }
      }
    }
  });
}

// ── Guard: the region list + token are non-empty (don't silently disable) ─────
test("ripple region set is the four contract §5 reference points", () => {
  assert.equal(REGIONS.length, 4, "exactly four ripple reference points (contract §5)");
  assert.ok(TOKEN.length > 0, "ripple token must be non-empty");
  // The two same-file regions must be distinct slices (region-scoping precondition).
  const body = readBody(CLAUDE_GLOBAL);
  const r1 = livingDocsTableRegion(body);
  const r2 = preCommitGateRegion(body);
  assert.ok(r1 !== "" && r2 !== "", "both CLAUDE-global regions must resolve structurally");
  assert.ok(r1 !== r2, "the two CLAUDE-global regions must be DISTINCT slices (not the same text)");
});
