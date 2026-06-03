"use strict";

// M76 — register output must be ASCII-clean. The Hilo register rendered as mojibake
// boxes (βPADCCH/πAPCCCH) in a non-UTF-8 terminal because fmtChunks emitted emoji
// (🔴🟠🟡🟢) + em-dashes. The ascii() sanitizer (mirrored here) strips emoji/symbols,
// normalizes dashes/quotes/ellipsis, so the register renders everywhere. Applied to
// every user-supplied field (finder text can also contain these).

const { test } = require("node:test");
const assert = require("node:assert/strict");

function ascii(s) {
  return String(s == null ? "" : s)
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}️]/gu, "")
    .replace(/[—–]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[ \t]+\n/g, "\n");
}

test("ascii() strips emoji", () => {
  assert.equal(ascii("🔴 Critical").trim(), "Critical");
  assert.equal(ascii("status ✅ done").trim(), "status  done".trim());
});

test("ascii() normalizes em/en dashes to hyphen", () => {
  assert.equal(ascii("Foo — bar"), "Foo - bar");
  assert.equal(ascii("range 1–10"), "range 1-10");
});

test("ascii() normalizes smart quotes + ellipsis", () => {
  assert.equal(ascii("it’s “quoted”"), "it's \"quoted\"");
  assert.equal(ascii("wait…"), "wait...");
});

test("ascii() output contains no non-ASCII bytes for typical finding text", () => {
  const sample = ascii("🟠 The `PUT /x` endpoint — uses “requireAuth” … fix it");
  assert.ok(/^[\x00-\x7F]*$/.test(sample), `expected pure ASCII, got: ${JSON.stringify(sample)}`);
});

// Structural guard: the shipped workflow's fmtChunks output (header + item template)
// must not contain emoji or em/en dashes in its literal strings.
const fs = require("node:fs");
const path = require("node:path");
test("gsd-t-scan.workflow.js fmtChunks emits no emoji/em-dash in its output literals", () => {
  const body = fs.readFileSync(path.resolve(__dirname, "..", "templates", "workflows", "gsd-t-scan.workflow.js"), "utf8");
  const m = body.match(/function fmtChunks\([\s\S]*?\n\}/);
  assert.ok(m, "fmtChunks found");
  const fn = m[0];
  assert.doesNotMatch(fn, /[\u{1F300}-\u{1FAFF}]/u, "no emoji in fmtChunks output");
  assert.doesNotMatch(fn, /[—–]/u, "no em/en dash in fmtChunks output");
});
