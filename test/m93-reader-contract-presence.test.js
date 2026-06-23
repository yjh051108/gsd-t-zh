"use strict";

// M93 D2 (the instruction layer) — Reader Contract presence lint.
//
// The Reader Contract is the sharpened conciseness rule baked into the framework
// instruction layer (D2). It MUST appear in:
//   1. templates/CLAUDE-global.md — a `## Reader Contract` block that states the
//      question-vs-action SPLIT (NOT a generic "be concise"): both "answer first"
//      (question shape) AND "intent first" (action shape) appear in the block.
//   2. Each of the FOUR user-facing subagent prompts — a `<!-- reader-contract -->`
//      ... `<!-- /reader-contract -->` marker block.
//
// Region-scoped, not file-wide substring (per
// feedback_coverage_check_structural_not_substring): CLAUDE-global has many
// sections, so the split assertion is scoped to the Reader Contract block only.
//
// Mandatory negative (M71-family): deleting the marker from any one prompt makes
// ONLY that prompt's assertion FAIL; stripping a split phrase from the Reader
// Contract block makes the split assertion FAIL.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CLAUDE_GLOBAL = path.join(ROOT, "templates", "CLAUDE-global.md");
const PROMPTS_DIR = path.join(ROOT, "templates", "prompts");

const PROMPTS = [
  "qa-subagent.md",
  "red-team-subagent.md",
  "pre-mortem-subagent.md",
  "blind-adversary-subagent.md",
];

const MARKER_OPEN = "<!-- reader-contract -->";
const MARKER_CLOSE = "<!-- /reader-contract -->";

// The two SPLIT phrases that prove this is the question-vs-action split, not a
// generic "be concise". Both must appear inside the Reader Contract block.
const SPLIT_PHRASES = ["answer first", "intent first"];

function readBody(file) {
  return fs.readFileSync(file, "utf8");
}

/**
 * Slice the Reader Contract block: from the `## Reader Contract` heading to the
 * next `## ` or `# ` heading. Returns "" if the heading is absent (→ presence
 * check fails, which is correct).
 */
function readerContractRegion(body) {
  const lines = body.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^## Reader Contract\b/.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) return "";
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,2} /.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

/**
 * Slice the marker-delimited reader-contract directive from a prompt body.
 * Returns "" if either marker is absent.
 */
function markerBlock(body) {
  const open = body.indexOf(MARKER_OPEN);
  const close = body.indexOf(MARKER_CLOSE);
  if (open === -1 || close === -1 || close < open) return "";
  return body.slice(open, close + MARKER_CLOSE.length);
}

// ── Positive: CLAUDE-global Reader Contract block exists + states the SPLIT ────

test("CLAUDE-global carries a `## Reader Contract` block", () => {
  const region = readerContractRegion(readBody(CLAUDE_GLOBAL));
  assert.ok(
    region !== "",
    "`## Reader Contract` heading missing from templates/CLAUDE-global.md"
  );
});

for (const phrase of SPLIT_PHRASES) {
  test(`Reader Contract block states the split: "${phrase}" present`, () => {
    const region = readerContractRegion(readBody(CLAUDE_GLOBAL));
    assert.ok(
      region.toLowerCase().includes(phrase),
      `"${phrase}" missing from the Reader Contract block — the block must state the ` +
        `question-vs-action SPLIT (both "answer first" and "intent first"), not a generic "be concise".`
    );
  });
}

// ── Positive: each prompt carries the marker block ────────────────────────────

for (const prompt of PROMPTS) {
  test(`prompt "${prompt}" carries the reader-contract marker block`, () => {
    const block = markerBlock(readBody(path.join(PROMPTS_DIR, prompt)));
    assert.ok(
      block !== "",
      `Marker block ${MARKER_OPEN} ... ${MARKER_CLOSE} missing from templates/prompts/${prompt}`
    );
    assert.ok(
      block.includes(MARKER_OPEN) && block.includes(MARKER_CLOSE),
      `Both markers must be present in templates/prompts/${prompt}`
    );
  });
}

// ── Negative (mandatory M71-family): the lint DISCRIMINATES ───────────────────

for (const target of PROMPTS) {
  test(`negative: removing the marker from "${target}" fails ONLY that prompt`, () => {
    const corpus = new Map();
    for (const p of PROMPTS) {
      corpus.set(p, readBody(path.join(PROMPTS_DIR, p)));
    }
    // Strip the open marker from ONLY the target prompt.
    corpus.set(target, corpus.get(target).split(MARKER_OPEN).join("__REMOVED__"));

    for (const p of PROMPTS) {
      const block = markerBlock(corpus.get(p));
      if (p === target) {
        assert.ok(
          block === "",
          `Stripping the marker from ${p} should make its block check fail — discrimination broken.`
        );
      } else {
        assert.ok(
          block !== "",
          `Editing ${target} must not affect ${p} — proves the check is per-file, not global.`
        );
      }
    }
  });
}

test("negative: stripping a split phrase from the Reader Contract block fails the split assertion", () => {
  const body = readBody(CLAUDE_GLOBAL);
  const region = readerContractRegion(body);
  // Strip "intent first" from the block only.
  const stripped = region.replace(/intent first/gi, "__REMOVED__");
  const mutated = body.replace(region, stripped);
  const newRegion = readerContractRegion(mutated);
  assert.ok(
    !newRegion.toLowerCase().includes("intent first"),
    "Stripping 'intent first' should remove it from the block — the split assertion would now fail (correct)."
  );
});

// ── Guard: don't silently disable ─────────────────────────────────────────────

test("prompt set is the four user-facing subagent prompts", () => {
  assert.equal(PROMPTS.length, 4, "exactly four user-facing subagent prompts carry the contract");
  assert.ok(SPLIT_PHRASES.length === 2, "the split has exactly two directions (question + action)");
});
