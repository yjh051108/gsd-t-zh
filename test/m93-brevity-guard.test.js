"use strict";

// M93-D1-T2 — Killing test for the brevity guard (scripts/gsd-t-brevity-guard.js).
// Drives the detector via the in-process `detect()`/`processPayload()` API and the
// `--text/--mode` CLI path (no transcript needed). Asserts the EXACT ALLOW/BLOCK
// decisions the user cited, the action-vs-answer discriminator, fail-open, loop-guard.

const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const HOOK = path.join(__dirname, "..", "scripts", "gsd-t-brevity-guard.js");
const { detect, classifyMode, processPayload } = require(HOOK);

// Run the CLI; returns { code, stdout }. CLI exits 1 + JSON on BLOCK, 0 on ALLOW.
function cli(text, mode) {
  try {
    const stdout = execFileSync(
      process.execPath,
      [HOOK, "--text", text, "--mode", mode],
      { encoding: "utf8" }
    );
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status, stdout: e.stdout || "" };
  }
}

// ── BLOCK: the EXACT user-cited failure — 3 stacked narration sentences ──────
test("BLOCK answer-mode reply opening with 3 narration sentences", () => {
  const text =
    "Let me find the record. Before I say anything, I should check the log. " +
    "I'm going to look at the schema first. The answer is 42.";
  const res = detect(text, "answer");
  assert.equal(res.block, true);
  assert.ok(res.reason && res.reason.length > 0, "reason non-empty");
  assert.ok(res.reason.length < 240, "reason itself concise (dog-foods the rule)");

  const c = cli(text, "answer");
  assert.equal(c.code, 1);
  assert.equal(JSON.parse(c.stdout.trim()).decision, "block");
});

// ── ALLOW: SAME intent-first opener, but ACTION-mode → the discriminator ─────
test("ALLOW same intent-first opener in action-mode (discriminator)", () => {
  const text =
    "Let me find the record. Before I say anything, I should check the log. " +
    "I'm going to look at the schema first. The answer is 42.";
  const res = detect(text, "action");
  assert.equal(res.block, false);

  const c = cli(text, "action");
  assert.equal(c.code, 0);
  assert.equal(c.stdout.trim(), "");
});

// ── ALLOW: the user-approved answer-first format ─────────────────────────────
test("ALLOW the answer-first format (answer, then bullets)", () => {
  const text =
    "All three are correct. The cache TTL is 5 minutes; the worker is headless; " +
    "the port frees on cleanup.\n- Point one\n- Point two";
  assert.equal(detect(text, "answer").block, false);
  assert.equal(cli(text, "answer").code, 0);
});

// ── BLOCK: bare unglossed jargon (HC-003) ────────────────────────────────────
test("BLOCK bare HC-003 with no gloss", () => {
  const text = "It violates HC-003 and must be reverted.";
  const res = detect(text, "answer");
  assert.equal(res.block, true);
  assert.ok(/HC-003/.test(res.reason));
  assert.equal(cli(text, "answer").code, 1);
});

// ── BLOCK: bare unglossed jargon (S2-M7) ─────────────────────────────────────
test("BLOCK bare S2-M7 with no gloss", () => {
  const text = "This belongs to S2-M7 and ships next.";
  assert.equal(detect(text, "answer").block, true);
});

// ── ALLOW: bare M-code in a LIVE reply (live-tuning 2026-06-23) ──────────────
// Bare `M92` / `M92-D1` is established conversational shorthand once context
// exists; forcing a gloss every turn over-strict-blocks clean answers. The hook
// only forces glosses on the opaque IDs (HC-#, S2-M#); the stricter M-code rule
// lives in the DOC lint (bin/gsd-t-jargon-lint.cjs), where there's no conversation.
test("ALLOW bare M-code in a live reply (not hook-scope jargon)", () => {
  assert.equal(detect("Handled under M92-D1 already.", "answer").block, false);
  assert.equal(detect("Three changes shipped in M92.", "answer").block, false);
});

// ── BLOCK: interleaved preamble — ack, narrate, content, narrate (real shape) ─
// The user-cited miss: narration scattered through the opening, not stacked at
// the very front, so the leading-only scan saw it as 1-narration-then-content.
test("BLOCK interleaved narration/meta-commentary in the opening", () => {
  const text =
    "Good catch — and I need to be careful here. Let me untangle it precisely. " +
    "What I said earlier was X. So does a project override the global? Let me verify rather than assert.";
  assert.equal(detect(text, "answer").block, true);
  assert.equal(cli(text, "answer").code, 1);
  // same content in action-mode (about to edit) → allowed
  assert.equal(detect(text, "action").block, false);
});

// ── ALLOW: an ack + a short explanation (must NOT false-block) ───────────────
test("ALLOW an ack plus a brief one-clause explanation (no false-block)", () => {
  for (const t of [
    "Good question. The graph died because it needed Neo4j and constant upkeep for little value.",
    "Correct on both counts. The hook reads settings fresh each turn, and the lint is already installed.",
    "No, not yet. Main is pushed but npm still shows the old version — want me to publish?",
  ]) {
    assert.equal(detect(t, "answer").block, false, `must allow: ${t}`);
  }
});

// ── ALLOW: the SAME jargon, glossed in the same sentence ─────────────────────
test("ALLOW glossed HC-003", () => {
  const text = 'It breaks HC-003 (your "never contact the buyer" rule), so revert.';
  assert.equal(detect(text, "answer").block, false);
  assert.equal(cli(text, "answer").code, 0);
});

// ── ALLOW: ONE direction-acknowledgement sentence before the answer ──────────
test("ALLOW a single ack sentence before the answer", () => {
  const text = "Let me check that. The value is stored in IndexedDB, refreshed every 5 min.";
  assert.equal(detect(text, "answer").block, false);
  assert.equal(cli(text, "answer").code, 0);
});

// ── BLOCK: a short ack THEN stacked narration (the leading-region gap) ────────
// Integrate-time fix: a non-narration ack lead ("Important question.") must NOT
// reset the narration count to 0 — narration stacked AFTER it is still preamble.
// This is the precise shape of the user's cited failure (ack + "Let me find… /
// Before I say anything…"). The original fixtures missed it.
test("BLOCK an ack sentence followed by 2+ stacked narration sentences", () => {
  const text =
    "Important question. Let me find the record first. Before I say anything, I should check the docs. The answer is X.";
  assert.equal(detect(text, "answer").block, true);
  assert.equal(cli(text, "answer").code, 1);
  // Same opener in action-mode is fine (intent-first is wanted there).
  assert.equal(detect(text, "action").block, false);
});

// ── FAIL-OPEN: malformed / empty / non-object payload ────────────────────────
test("FAIL-OPEN on malformed and empty payloads", () => {
  assert.equal(processPayload(null).block, false);
  assert.equal(processPayload(undefined).block, false);
  assert.equal(processPayload("not an object").block, false);
  assert.equal(processPayload({}).block, false); // no transcript_path → fail-open
  assert.equal(detect("", "answer").block, false);
  assert.equal(detect(null, "answer").block, false);
});

// ── LOOP-GUARD: stop_hook_active:true → never block (no double-block) ─────────
test("LOOP-GUARD stop_hook_active:true → allow", () => {
  // Even with a transcript that would block, the loop-guard short-circuits.
  const res = processPayload({ stop_hook_active: true, transcript_path: "/whatever" });
  assert.equal(res.block, false);
});

// ── Mode classifier: mutating tool turn → action; pure text → answer ─────────
test("classifyMode: mutating tool → action, pure text → answer", () => {
  assert.equal(classifyMode({ text: "x", hasMutatingTool: true }), "action");
  assert.equal(classifyMode({ text: "", toolOnly: true }), "action");
  assert.equal(classifyMode({ text: "hello", hasMutatingTool: false, toolOnly: false }), "answer");
});

// ── Dated banner is always allowed (not counted as preamble) ─────────────────
test("ALLOW: dated banner first line is skipped", () => {
  const text =
    "Tue: Jun 23, 2026 12:54 PDT — GSD-T v4.7.11 — CURRENT\n" +
    "All correct. The hook fails open on any error.";
  assert.equal(detect(text, "answer").block, false);
});
