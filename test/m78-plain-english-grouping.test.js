"use strict";

// M78 — the plain-english companion is generated in BOUNDED BATCHES then assembled
// DETERMINISTICALLY with severity section headers (## 🔴 Critical / 🟠 High / 🟡 Medium /
// 🟢 Low), then chunk-written. Before this, it was a single agent producing a flat,
// ungrouped list that also stalled on large registers (the M75 bug). This locks the
// assembly: every item lands under its correct severity section, all items present,
// chunks never split an item.

const { test } = require("node:test");
const assert = require("node:assert/strict");

// Mirrors the M78 assembly block in gsd-t-scan.workflow.js.
function assemble(peItems, peByTd) {
  const sevs = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  const peGroups = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [] };
  for (const it of peItems) { const md = peByTd[it.td]; if (md && peGroups[it.severity]) peGroups[it.severity].push(md.trim()); }
  const head = { CRITICAL: "## 🔴 Critical", HIGH: "## 🟠 High", MEDIUM: "## 🟡 Medium", LOW: "## 🟢 Low" };
  const chunks = ["# Tech Debt - Plain English\n"];
  for (const sev of sevs) {
    const items = peGroups[sev];
    if (!items.length) continue;
    let buf = `\n${head[sev]} (${items.length})\n\n`;
    for (const md of items) { const piece = md + "\n\n"; if (buf.length + piece.length > 30000) { chunks.push(buf); buf = ""; } buf += piece; }
    if (buf.trim()) chunks.push(buf);
  }
  return { chunks, full: chunks.join(""), groups: peGroups };
}

function mkItems() {
  const counts = { CRITICAL: 9, HIGH: 90, MEDIUM: 165, LOW: 58 };
  const items = []; let td = 134;
  for (const s of ["CRITICAL", "HIGH", "MEDIUM", "LOW"]) for (let i = 0; i < counts[s]; i++) items.push({ td: td++, severity: s });
  const byTd = {};
  for (const it of items) byTd[it.td] = `### TD-${it.td} - finding\n**What it is.** ${"x".repeat(400)}\n**Severity.** y`;
  return { items, byTd };
}

test("all items land grouped under correct severity headers, in order, none lost", () => {
  const { items, byTd } = mkItems();
  const { full, groups } = assemble(items, byTd);
  const tds = [...full.matchAll(/^### TD-(\d+)/gm)].map((m) => +m[1]);
  assert.equal(tds.length, 322, "all 322 entries present");
  assert.equal(new Set(tds).size, 322, "no duplicates");
  assert.deepEqual({ C: groups.CRITICAL.length, H: groups.HIGH.length, M: groups.MEDIUM.length, L: groups.LOW.length },
    { C: 9, H: 90, M: 165, L: 58 }, "grouping counts correct");
  const heads = [...full.matchAll(/^## (?:🔴|🟠|🟡|🟢) (\w+) \((\d+)\)/gm)].map((m) => `${m[1]}:${m[2]}`);
  assert.deepEqual(heads, ["Critical:9", "High:90", "Medium:165", "Low:58"], "section headers present, correct counts, in severity order");
});

test("chunks never split an item (header+body of each entry stay together)", () => {
  const { items, byTd } = mkItems();
  const { chunks } = assemble(items, byTd);
  for (const c of chunks.slice(1)) {
    const heads = (c.match(/^### TD-\d+/gm) || []).length;
    const sevs = (c.match(/^\*\*Severity\.\*\*/gm) || []).length;
    assert.equal(heads, sevs, "each entry's heading and Severity line are in the same chunk");
  }
});

test("an empty severity produces no section header", () => {
  const items = [{ td: 1, severity: "CRITICAL" }, { td: 2, severity: "LOW" }];
  const byTd = { 1: "### TD-1 - a\n**Severity.** x", 2: "### TD-2 - b\n**Severity.** y" };
  const { full } = assemble(items, byTd);
  assert.match(full, /## 🔴 Critical \(1\)/);
  assert.match(full, /## 🟢 Low \(1\)/);
  assert.doesNotMatch(full, /## 🟠 High/, "no High section when there are no High items");
});
