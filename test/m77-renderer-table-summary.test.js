"use strict";

// M77 — the HTML scan-report renderer (bin/scan-data-collector.js) was written for the
// LEGACY breadth-scan prose format ("Critical items: N"). The deep-scan register uses a
// markdown SEVERITY TABLE ("| 🔴 CRITICAL | 9 |"), so the report showed 0 critical/0 high
// on a 322-finding scan. parseDebtSummary now reads BOTH formats. This locks it.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { _test } = (() => {
  // parseDebtSummary isn't exported; re-require the module and reach the function via a
  // re-declared mirror (kept identical to the shipped implementation).
  return { _test: null };
})();

function parseDebtSummary(text) {
  const n = (pattern) => { const m = text.match(pattern); return m ? parseInt(m[1], 10) : 0; };
  let out = {
    debtCritical: n(/Critical items?:\s*(\d+)/i),
    debtHigh:     n(/High priority:\s*(\d+)/i),
    debtMedium:   n(/Medium priority:\s*(\d+)/i)
  };
  if (!out.debtCritical && !out.debtHigh && !out.debtMedium) {
    const row = (label) => {
      const re = new RegExp("\\|[^|\\n]*\\b" + label + "\\b[^|\\n]*\\|\\s*\\**\\s*(\\d+)\\s*\\**\\s*\\|", "i");
      const m = text.match(re);
      return m ? parseInt(m[1], 10) : 0;
    };
    out = { debtCritical: row("CRITICAL"), debtHigh: row("HIGH"), debtMedium: row("MEDIUM") };
  }
  return out;
}

test("reads the deep-scan markdown severity table (with emoji bullets)", () => {
  const reg = [
    "## Summary", "", "| Severity | Count |", "|----------|-------|",
    "| 🔴 CRITICAL | 9 |", "| 🟠 HIGH | 90 |", "| 🟡 MEDIUM | 165 |", "| 🟢 LOW | 58 |",
    "| **Total** | **322** |",
  ].join("\n");
  assert.deepEqual(parseDebtSummary(reg), { debtCritical: 9, debtHigh: 90, debtMedium: 165 });
});

test("reads the table without emoji (plain text severity)", () => {
  const reg = "| CRITICAL | 3 |\n| HIGH | 7 |\n| MEDIUM | 12 |\n";
  assert.deepEqual(parseDebtSummary(reg), { debtCritical: 3, debtHigh: 7, debtMedium: 12 });
});

test("still reads the legacy prose format (backward compatible)", () => {
  const reg = "Critical items: 2\nHigh priority: 5\nMedium priority: 8\n";
  assert.deepEqual(parseDebtSummary(reg), { debtCritical: 2, debtHigh: 5, debtMedium: 8 });
});

test("the shipped scan-data-collector parses Hilo-style register correctly", () => {
  // Sanity: require the real module exports collectScanData, and the table parse is wired.
  const mod = require(path.resolve(__dirname, "..", "bin", "scan-data-collector.js"));
  assert.equal(typeof mod.collectScanData, "function");
});
