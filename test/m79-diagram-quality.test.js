"use strict";

// M79 — diagram quality fixes. Before: 4/6 diagrams were generic "Tasks/Projects"
// templates (analysisData.services/layers/endpoints never populated), the DB schema
// showed 4 wrong tables with `unknown` columns, the sequence diagram failed to render
// (`&amp;` broke the parser), and diagrams clashed with the dark page (white bg, sharp
// corners, shrink-wrapped labels). Fixes: source diagram inputs from docs/, suppress
// the schema diagram, fix the sequence source, inject a shared dark/rounded/padded
// Mermaid config.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const ROOT = path.resolve(__dirname, "..");

test("collectScanData extracts real services/endpoints from docs/architecture.md", () => {
  const { collectScanData } = require(path.join(ROOT, "bin", "scan-data-collector.js"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "m79-"));
  fs.mkdirSync(path.join(tmp, "docs"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "docs", "architecture.md"), [
    "# Arch", "## 1. System Overview", "## 2. Technology Stack",
    "## 5. Multi-Tenant School Model", "## 8. Stripe and Billing", "## 12. Scheduling and Dispatch",
    "### Key Endpoints", "GET /flight-schools/:id", "POST /api/auth/sign-in",
  ].join("\n"));
  const a = collectScanData(tmp);
  assert.ok(a.services.includes("Multi-Tenant School Model"), "real feature domains extracted as services");
  assert.ok(a.services.includes("Stripe and Billing"));
  assert.ok(!a.services.includes("System Overview"), "meta sections excluded");
  assert.ok(a.endpoints.some((e) => /flight-schools/.test(e)), "real endpoints extracted");
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("parseStates rejects doc-prose noise, keeps only real transition chains", () => {
  const { collectScanData } = require(path.join(ROOT, "bin", "scan-data-collector.js"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "m79s-"));
  fs.mkdirSync(path.join(tmp, "docs"), { recursive: true });
  // prose that the OLD loose regex wrongly turned into states (Domains/Source/...)
  fs.writeFileSync(path.join(tmp, "docs", "workflows.md"), "Domains and Source map to Schedule. Billing flows.");
  const a = collectScanData(tmp);
  assert.deepEqual(a.states, [], "no genuine transitions -> empty so generator keeps its good default");
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("system-architecture diagram uses real services when present (not the Tasks/Projects template)", () => {
  const { genSystemArchitecture } = require(path.join(ROOT, "bin", "scan-diagrams-generators.js"));
  const mmd = genSystemArchitecture({ services: ["Stripe and Billing", "Scheduling and Dispatch", "Maintenance Hub"] });
  assert.match(mmd, /Stripe and Billing/);
  assert.match(mmd, /Scheduling and Dispatch/);
  assert.doesNotMatch(mmd, /TasksController|ProjectsController/, "no generic template names");
});

test("generateDiagrams suppresses the DB-schema diagram by default", () => {
  const { generateDiagrams } = require(path.join(ROOT, "bin", "scan-diagrams.js"));
  const out = generateDiagrams({}, { detected: true, entities: [{ name: "x", fields: [] }] }, { projectRoot: "." });
  assert.ok(!out.some((d) => d.type === "database-schema"), "schema diagram omitted by default");
  const withSchema = generateDiagrams({}, { detected: true, entities: [{ name: "x", fields: [] }] }, { projectRoot: ".", includeSchemaDiagram: true });
  assert.ok(withSchema.some((d) => d.type === "database-schema"), "opt-in flag re-enables it");
});

test("sequence diagram source has no &amp; (which breaks the sequence parser)", () => {
  const { genSequence } = require(path.join(ROOT, "bin", "scan-diagrams-generators.js"));
  const mmd = genSequence({});
  assert.doesNotMatch(mmd, /&amp;/, "no HTML entity that breaks the Mermaid sequence parser");
});

test("renderer injects a shared dark/rounded/padded Mermaid config", () => {
  const src = fs.readFileSync(path.join(ROOT, "bin", "scan-renderer.js"), "utf8");
  assert.match(src, /MERMAID_CONFIG/, "shared config defined");
  assert.match(src, /padding:/, "node padding configured");
  assert.match(src, /transparent/, "transparent background (blends into dark page)");
  assert.match(src, /-c['"]?\s*,\s*tmpCfg|'-c'/, "config passed to mmdc via -c");
});
