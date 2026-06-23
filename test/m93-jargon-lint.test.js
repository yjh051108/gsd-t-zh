"use strict";

// M93 D3-T2 — killing test for the jargon-gloss lint (bin/gsd-t-jargon-lint.cjs)
// (test/m93-jargon-lint.test.js)
//
// The jargon-lint is D3 of M93 (Brevity Guard): the file-surface gate that flags an
// unglossed FIRST-occurrence high-signal jargon token (S2-M<n>, HC-<n>, M<n> codes,
// bare ALL-CAPS acronyms) so the author glosses it before commit. This test pins its
// behaviour against BYTE-KNOWN, inline-markdown fixtures fed over stdin through the
// REAL CLI. Deterministic, zero LLM, never throws.
//
// Fixtures (each asserts the EXACT exit + named token/line):
//   1. bare HC-003                 → exit 4, names HC-003 + line
//   2. HC-003 (glossed)            → exit 0
//   3. bare S2-M7                  → exit 4
//   4. S2-M7 (glossed)             → exit 0
//   5. allowlisted CLI/API/GSD-T   → exit 0 (never flagged)
//   6. HC-003 in inline-code/fence → exit 0 (not flagged)
//   7. glossed-then-reused-bare    → exit 0 (only FIRST occurrence judged)
//   8. malformed/empty input       → exit 64 (no source) / exit 0 (empty text), no throw

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const CLI = path.resolve(__dirname, "..", "bin", "gsd-t-jargon-lint.cjs");
const { runLint, lintText } = require("../bin/gsd-t-jargon-lint.cjs");

// Run the REAL CLI, feeding doc text over stdin (`--stdin`). Returns { exitCode, envelope }.
function runCliStdin(text) {
  try {
    const out = execFileSync("node", [CLI, "--stdin", "--json"], { input: text, encoding: "utf8" });
    return { exitCode: 0, envelope: JSON.parse(out) };
  } catch (e) {
    let envelope = null;
    try { envelope = JSON.parse(e.stdout || "null"); } catch {/* ignore */}
    return { exitCode: e.status, envelope };
  }
}

// Run the CLI with arbitrary argv (for the bad-input / no-source cases).
function runCliArgs(args, input) {
  try {
    const out = execFileSync("node", [CLI, ...args], { input: input || "", encoding: "utf8" });
    return { exitCode: 0, envelope: safeJson(out) };
  } catch (e) {
    return { exitCode: e.status, envelope: safeJson(e.stdout) };
  }
}
function safeJson(s) { try { return JSON.parse(s || "null"); } catch { return null; } }

// ─── 1. bare HC-003 → exit 4, named with line ──────────────────────────────

describe("bare HC-003 in prose → exit 4 naming the token + line", () => {
  const DOC = "Intro line.\nThe HC-003 rule blocks the action.\n";

  test("(pure) lintText flags HC-003 on line 2", () => {
    const r = lintText(DOC);
    assert.equal(r.unglossed.length, 1);
    assert.equal(r.unglossed[0].token, "HC-003");
    assert.equal(r.unglossed[0].line, 2, "HC-003 is on the second line");
  });

  test("(CLI) exit 4, envelope names HC-003 + line 2", () => {
    const r = runCliStdin(DOC);
    assert.equal(r.exitCode, 4);
    assert.equal(r.envelope.ok, false);
    assert.equal(r.envelope.count, 1);
    assert.equal(r.envelope.unglossed[0].token, "HC-003");
    assert.equal(r.envelope.unglossed[0].line, 2);
  });
});

// ─── 2. glossed HC-003 → exit 0 ────────────────────────────────────────────

describe('HC-003 with an adjacent parenthetical gloss → exit 0', () => {
  const DOC = 'The HC-003 (your "never contact the buyer" rule) blocks it.\n';

  test("(CLI) exit 0, nothing flagged", () => {
    const r = runCliStdin(DOC);
    assert.equal(r.exitCode, 0);
    assert.equal(r.envelope.ok, true);
    assert.equal(r.envelope.count, 0);
  });
});

// ─── 3 + 4. S2-M7 bare → 4, glossed → 0 ────────────────────────────────────

describe("S2-M7: bare → exit 4, glossed → exit 0", () => {
  test("bare S2-M7 → exit 4 naming it", () => {
    const r = runCliStdin("We hit S2-M7 yesterday.\n");
    assert.equal(r.exitCode, 4);
    assert.equal(r.envelope.unglossed[0].token, "S2-M7");
    assert.equal(r.envelope.unglossed[0].line, 1);
  });

  test("S2-M7 (the trace-logging milestone) → exit 0", () => {
    const r = runCliStdin("We hit S2-M7 (the trace-logging milestone) yesterday.\n");
    assert.equal(r.exitCode, 0);
    assert.equal(r.envelope.count, 0);
  });
});

// ─── 5. allowlisted acronyms → never flagged ───────────────────────────────

describe("allowlisted acronyms (CLI / API / GSD-T) → never flagged (exit 0)", () => {
  test("CLI, API, GSD-T all pass", () => {
    const r = runCliStdin("The CLI and API are fine. GSD-T too. Also JSON over HTTP.\n");
    assert.equal(r.exitCode, 0);
    assert.equal(r.envelope.count, 0);
  });

  test("a hyphenated allowlist form (GSD-T) is matched WHOLE — bare GSD inside it is not split-flagged", () => {
    const r = runCliStdin("GSD-T ships today.\n");
    assert.equal(r.exitCode, 0, "GSD-T must match as a unit and be allowlisted, not flag bare GSD");
  });

  test("a NON-allowlisted bare acronym IS flagged (the rule still bites)", () => {
    const r = runCliStdin("We use FOOBAR everywhere.\n");
    assert.equal(r.exitCode, 4);
    assert.equal(r.envelope.unglossed[0].token, "FOOBAR");
  });
});

// ─── 6. token in inline-code / fence → not flagged ─────────────────────────

describe("a token inside inline-code or a fenced block → not flagged", () => {
  test("inline-code `HC-003` → exit 0", () => {
    const r = runCliStdin("Use the `HC-003` field here.\n");
    assert.equal(r.exitCode, 0);
    assert.equal(r.envelope.count, 0);
  });

  test("fenced ``` block containing HC-003 → exit 0", () => {
    const DOC = "Intro.\n```\nif (HC-003) { doThing(); }\n```\nDone.\n";
    const r = runCliStdin(DOC);
    assert.equal(r.exitCode, 0);
    assert.equal(r.envelope.count, 0);
  });

  test("a token in code does NOT suppress a SEPARATE bare prose occurrence on another line", () => {
    // `HC-003` in code (line 1) then bare HC-003 in prose (line 2). Code lines are
    // stripped before token detection, so the prose occurrence is the FIRST one seen.
    const DOC = "Use `HC-003` here.\nThe HC-003 rule blocks it.\n";
    const r = runCliStdin(DOC);
    assert.equal(r.exitCode, 4);
    assert.equal(r.envelope.unglossed[0].token, "HC-003");
    assert.equal(r.envelope.unglossed[0].line, 2);
  });
});

// ─── 7. glossed-on-first-use, reused-bare → exit 0 (first-occurrence-only) ──

describe("glossed on first use then reused bare → exit 0 (only first occurrence judged)", () => {
  const DOC = "M93 (the brevity-guard milestone) ships today.\nLater we revisit M93 bare with no gloss.\n";

  test("(CLI) the bare reuse does NOT re-flag → exit 0", () => {
    const r = runCliStdin(DOC);
    assert.equal(r.exitCode, 0, "first occurrence was glossed; the lint must not nag on reuse");
    assert.equal(r.envelope.count, 0);
  });

  test("(inverse) bare FIRST then glossed-later → STILL flags (first occ is bare)", () => {
    const DOC2 = "We touch M93 bare first.\nM93 (the brevity-guard milestone) is named later.\n";
    const r = runCliStdin(DOC2);
    assert.equal(r.exitCode, 4);
    assert.equal(r.envelope.unglossed[0].token, "M93");
    assert.equal(r.envelope.unglossed[0].line, 1);
  });
});

// ─── 8. malformed / empty input → fail-closed, no throw ────────────────────

describe("bad / empty input → handled, never throws", () => {
  test("no source flag (neither --file nor --stdin) → exit 64", () => {
    const r = runCliArgs(["--json"]);
    assert.equal(r.exitCode, 64);
    assert.equal(r.envelope.ok, false);
  });

  test("both --file and --stdin → exit 64", () => {
    const r = runCliArgs(["--file", "x.md", "--stdin", "--json"], "");
    assert.equal(r.exitCode, 64);
  });

  test("unreadable --file → exit 64, no throw", () => {
    const r = runCliArgs(["--file", "/tmp/m93-does-not-exist-xyz.md", "--json"]);
    assert.equal(r.exitCode, 64);
    assert.equal(r.envelope.ok, false);
  });

  test("EMPTY stdin text → exit 0 (no tokens, clean), no throw", () => {
    const r = runCliStdin("");
    assert.equal(r.exitCode, 0);
    assert.equal(r.envelope.count, 0);
  });

  test("(pure) runLint never throws on garbage options", () => {
    assert.doesNotThrow(() => runLint(null));
    assert.doesNotThrow(() => runLint({}));
    assert.doesNotThrow(() => runLint({ file: 123 }));
    assert.equal(runLint(null).exitCode, 64);
    assert.equal(runLint({}).exitCode, 64);
  });

  test("(pure) lintText never throws on null/non-string", () => {
    assert.doesNotThrow(() => lintText(null));
    assert.doesNotThrow(() => lintText(undefined));
    assert.doesNotThrow(() => lintText(42));
    assert.equal(lintText(null).unglossed.length, 0);
  });
});

// ─── 9. exempt path → skipped ──────────────────────────────────────────────

describe("an exempt path → skipped entirely (exit 0)", () => {
  test("a .gsd-t/milestones/ path is skipped without reading", () => {
    const r = runLint({ file: ".gsd-t/milestones/archived-doc.md" });
    assert.equal(r.exitCode, 0);
    assert.equal(r.skipped, true);
  });

  test("CHANGELOG.md is exempt", () => {
    const r = runLint({ file: "CHANGELOG.md" });
    assert.equal(r.exitCode, 0);
    assert.equal(r.skipped, true);
  });
});
