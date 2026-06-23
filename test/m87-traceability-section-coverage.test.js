"use strict";

// M87 D2 (A2) — section-citation coverage over the binvoice PseudoCode exemplars.
//
// Contract: .gsd-t/contracts/pseudocode-source-of-truth-contract.md §3.
// The gate (bin/gsd-t-traceability-gate.cjs, M83) is EXTENDED so a plan task must
// CITE the pseudocode section it implements (`**PseudoCode-Section**: <Title>#<anchor>`);
// a `##` section with zero citing tasks is an uncovered structural gap, and a
// citation that resolves to no heading slug is an unresolvable-citation FAILURE.
// All slug-as-slug / path-as-path, NEVER substring.
//
// This harness has THREE pillars (mirrors D1's §2 floor):
//   1. Fixture-fidelity FLOOR — the gate enumerates a HARD count of `##` sections
//      from the UNMODIFIED exemplars (PayPal=10, Extension=10 per §3.1/§3.3), not
//      ≥0. Zero sections is itself a FAILURE.
//   2. Citation-resolution — EVERY `**PseudoCode-Section**` anchor cited across all
//      FOUR M87 tasks.md files resolves to a real `##`-heading slug; an
//      unresolvable citation FAILS.
//   3. Planted-gap + substring-trap — a tasks.md omitting a task for one exemplar
//      section is reported as that exact uncovered section (path-as-path); a
//      faithful corpus → no gap; a prose mention of the section NAME that does not
//      structurally CITE it is STILL a gap.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  runGate,
  enumerateSections,
  slugifyHeading,
  parseSectionCitation,
  loadPseudocodeDocs,
} = require("../bin/gsd-t-traceability-gate.cjs");

const REPO = path.resolve(__dirname, "..");
const FIXTURES = path.join(REPO, "test", "fixtures", "m87");
const PAYPAL = path.join(FIXTURES, "PseudoCode-PayPal.md");
const EXTENSION = path.join(FIXTURES, "PseudoCode-Extension.md");

// The four SUBJECT-named M87 domains (no mNN prefix — see tasks.md cycle-4 note).
const M87_DOMAINS = [
  "guard-bridge-spike",
  "traceability-section-coverage",
  "milestone-two-altitude-flow",
  "template-docripple-contract",
];

// Resolve a domain's tasks.md from the LIVE domain dir OR the milestone archive.
// At complete-milestone the M87 domains are swept from `.gsd-t/domains/` into
// `.gsd-t/milestones/m91-*/domains/` — so this test (which verifies the M87
// citations resolve) must survive the archive, not couple to the transient
// live location. Live first; else the newest archive carrying the domain.
function resolveM87TasksPath(domain) {
  const live = path.join(REPO, ".gsd-t", "domains", domain, "tasks.md");
  if (fs.existsSync(live)) return live;
  const milestonesDir = path.join(REPO, ".gsd-t", "milestones");
  let archives = [];
  try { archives = fs.readdirSync(milestonesDir).filter((n) => /pseudocode|m91/i.test(n)).sort().reverse(); }
  catch { /* none */ }
  for (const a of archives) {
    const p = path.join(milestonesDir, a, "domains", domain, "tasks.md");
    if (fs.existsSync(p)) return p;
  }
  return live; // fall through → readFileSync throws a clear ENOENT naming the path
}

// Hard fixture floor (§3.1/§3.3) — re-verified LIVE at plan time against the
// byte-verbatim fixtures (grep -cE '^## ' → 10 each). The count tracks the
// fixture; if a fixture gains/loses a `##` section, THIS number updates with it.
const PAYPAL_SECTIONS = 10;
const EXTENSION_SECTIONS = 10;

// ─── Pillar 1: fixture-fidelity floor (non-vacuous guard) ─────────────────

test("FLOOR: gate enumerates the HARD `##` section count from the unmodified PayPal exemplar (not ≥0)", () => {
  const md = fs.readFileSync(PAYPAL, "utf8");
  const sections = enumerateSections(md);
  assert.equal(sections.length, PAYPAL_SECTIONS,
    `PayPal exemplar must enumerate exactly ${PAYPAL_SECTIONS} \`##\` sections (§3.1); got ${sections.length}`);
  assert.ok(sections.length > 0, "zero sections is itself a FAILURE (vacuous-pass guard)");
});

test("FLOOR: gate enumerates the HARD `##` section count from the unmodified Extension exemplar (not ≥0)", () => {
  const md = fs.readFileSync(EXTENSION, "utf8");
  const sections = enumerateSections(md);
  assert.equal(sections.length, EXTENSION_SECTIONS,
    `Extension exemplar must enumerate exactly ${EXTENSION_SECTIONS} \`##\` sections (§3.1); got ${sections.length}`);
  assert.ok(sections.length > 0, "zero sections is itself a FAILURE (vacuous-pass guard)");
});

test("FLOOR: the Appendix `# N.` banner lines INSIDE code fences are EXCLUDED (§3.1)", () => {
  // The Appendix raw-pseudocode fences carry `# 0.`, `# 1.` … single-# banners —
  // those are pseudocode comments, NOT document sections. Only the `## Appendix`
  // heading itself counts; none of the in-fence banners leak in.
  const sections = enumerateSections(fs.readFileSync(PAYPAL, "utf8"));
  const slugs = sections.map((s) => s.slug);
  assert.ok(slugs.includes("appendix-raw-pseudocode-no-intention-comments"),
    "the `## Appendix` heading itself IS a section");
  // No section slug should be a bare numeric banner like "0" / "1" (those would
  // mean an in-fence `# N.` leaked through the fence skip).
  for (const s of sections) {
    assert.ok(!/^\d+$/.test(s.slug), `in-fence banner leaked as a section: "${s.title}"`);
  }
});

// ─── Pillar 2: citation-resolution across all FOUR M87 tasks.md files ─────

test("RESOLUTION: every `**PseudoCode-Section**` anchor in all four M87 tasks.md files resolves to a real `##` slug", () => {
  const docs = loadPseudocodeDocs(FIXTURES); // Map<Title, {sections}>
  const slugSets = new Map();
  for (const [title, d] of docs) slugSets.set(title, new Set(d.sections.map((s) => s.slug)));

  const unresolved = [];
  let citationCount = 0;
  for (const domain of M87_DOMAINS) {
    const tasksPath = resolveM87TasksPath(domain);
    const md = fs.readFileSync(tasksPath, "utf8");
    // Split into task blocks the SAME way the gate does (every `##`–`####` heading),
    // but here we just scan every PseudoCode-Section line in the file.
    for (const line of md.split(/\r?\n/)) {
      const c = parseSectionCitation([line]);
      if (!c || !c.title || !c.anchor) continue;
      citationCount++;
      const set = slugSets.get(c.title);
      if (!set || !set.has(c.anchor)) {
        unresolved.push(`${domain}: ${c.title}#${c.anchor}`);
      }
    }
  }
  assert.ok(citationCount > 0, "the four M87 tasks.md files must carry ≥1 PseudoCode-Section citation");
  assert.deepEqual(unresolved, [],
    "every M87 PseudoCode-Section citation must resolve to a real ## slug; unresolved: " + unresolved.join(", "));
});

// ─── Slug function — §3.2 examples verbatim ───────────────────────────────

test("§3.2 slug function matches the contract's verified examples (slug-as-slug, GitHub-style)", () => {
  assert.equal(
    slugifyHeading("6. Money-safety map — every guard against a double-create"),
    "6-money-safety-map-every-guard-against-a-double-create");
  assert.equal(slugifyHeading("The two AIs, in one breath"), "the-two-ais-in-one-breath");
  assert.equal(
    slugifyHeading("2. Server — `POST /invoices/create`  (★ THE MONEY CALL — the record is born here)"),
    "2-server-post-invoicescreate-the-money-call-the-record-is-born-here");
});

// ─── Pillar 3: planted-gap + faithful + substring-trap ────────────────────

// Build a faithful tasks.md citing EVERY `##` section of PayPal, one task each.
function faithfulPayPalTasks(omitSlug = null) {
  const sections = enumerateSections(fs.readFileSync(PAYPAL, "utf8"));
  const blocks = ["# Tasks (synthetic)\n"];
  let i = 0;
  for (const s of sections) {
    if (omitSlug && s.slug === omitSlug) continue; // PLANT the gap
    i++;
    blocks.push(
      `### T${i} — cover ${s.title}\n` +
      `**PseudoCode-Section**: PayPal#${s.slug}\n` +
      `**Files**: \`src/impl_${i}.js\`\n` +
      `**Test**: \`test/t${i}.test.js\`\n` +
      `**Acceptance criteria**: implements ${s.title}\n`);
  }
  return blocks.join("\n");
}

function tmpTasks(md) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m87-d2-"));
  const f = path.join(dir, "tasks.md");
  fs.writeFileSync(f, md);
  return f;
}

test("FAITHFUL: a corpus citing every `##` section → no uncovered-section gap", () => {
  const f = tmpTasks(faithfulPayPalTasks());
  const r = runGate({ tasksFile: f, pseudocodeDir: FIXTURES });
  const gaps = r.violations.filter((v) => v.kind === "uncovered-section");
  assert.deepEqual(gaps, [], `faithful corpus must have zero uncovered sections; got: ${JSON.stringify(gaps)}`);
  const unresolved = r.violations.filter((v) => v.kind === "unresolvable-section-citation");
  assert.deepEqual(unresolved, [], "faithful corpus must have zero unresolvable citations");
});

test("PLANTED GAP: omitting the task for one `##` section → that EXACT section reported uncovered (path-as-path)", () => {
  const OMIT = "6-money-safety-map-every-guard-against-a-double-create";
  const f = tmpTasks(faithfulPayPalTasks(OMIT));
  const r = runGate({ tasksFile: f, pseudocodeDir: FIXTURES });
  assert.equal(r.ok, false);
  assert.equal(r.exitCode, 4);
  const gaps = r.violations.filter((v) => v.kind === "uncovered-section");
  assert.equal(gaps.length, 1, `exactly the one omitted section is a gap; got ${gaps.length}`);
  assert.equal(gaps[0].anchor, OMIT, "the gap names the EXACT omitted section slug (path-as-path)");
  assert.equal(gaps[0].doc, "PayPal");
});

test("SUBSTRING TRAP: a task mentioning the section NAME in prose but NOT citing it structurally is STILL a gap", () => {
  // Cover every section EXCEPT §6, but add a task whose prose talks ABOUT the
  // money-safety map without a `**PseudoCode-Section**` citation. Substring
  // matching would falsely clear §6; structural matching must NOT.
  const OMIT = "6-money-safety-map-every-guard-against-a-double-create";
  const md = faithfulPayPalTasks(OMIT) +
    "\n### T99 — discuss the Money-safety map — every guard against a double-create\n" +
    "This task talks about the Money-safety map and double-create guards in prose,\n" +
    "and even names the slug 6-money-safety-map-every-guard-against-a-double-create,\n" +
    "but it does NOT carry a PseudoCode-Section field.\n" +
    "**Files**: `src/discuss.js`\n**Test**: `test/discuss.test.js`\n" +
    "**Acceptance criteria**: prose only, no structural citation\n";
  const f = tmpTasks(md);
  const r = runGate({ tasksFile: f, pseudocodeDir: FIXTURES });
  const gaps = r.violations.filter((v) => v.kind === "uncovered-section");
  assert.ok(gaps.some((g) => g.anchor === OMIT),
    "the section is STILL uncovered — a prose mention does not satisfy structural coverage");
});

test("UNRESOLVABLE CITATION: an anchor matching no `##` slug is a FAILURE (phantom-anchor class)", () => {
  const f = tmpTasks(
    "# Tasks\n### T1 — phantom\n" +
    "**PseudoCode-Section**: PayPal#guard-map\n" + // conceptual anchor, never a real heading
    "**Files**: `src/x.js`\n**Test**: `test/x.test.js`\n" +
    "**Acceptance criteria**: cites a non-existent section\n");
  const r = runGate({ tasksFile: f, pseudocodeDir: FIXTURES });
  assert.equal(r.ok, false);
  assert.equal(r.exitCode, 4);
  const bad = r.violations.filter((v) => v.kind === "unresolvable-section-citation");
  assert.ok(bad.some((v) => v.anchor === "guard-map" && v.doc === "PayPal"),
    "a citation resolving to no heading slug must be flagged unresolvable");
});

test("OUT OF SCOPE: a doc that is NOT present in the pseudocode dir is not section-gated", () => {
  // Cite a doc title with no file → section coverage simply does not fire for it
  // (M83 path/test checks still apply). Never throws, never a false gap.
  const f = tmpTasks(
    "# Tasks\n### T1 — cite a missing doc\n" +
    "**PseudoCode-Section**: NoSuchDoc#whatever\n" +
    "**Files**: `src/x.js`\n**Test**: `test/x.test.js`\n" +
    "**Acceptance criteria**: doc absent from the dir\n");
  const r = runGate({ tasksFile: f, pseudocodeDir: FIXTURES });
  const sectionViolations = r.violations.filter(
    (v) => v.kind === "uncovered-section" || v.kind === "unresolvable-section-citation");
  assert.deepEqual(sectionViolations, [], "a cited-but-absent doc is out of section-coverage scope");
});
