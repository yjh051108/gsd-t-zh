"use strict";

// M87 D2-T5 — gate-scoping killing test (cycle-4 MEDIUM).
//
// The M83 `listTasksFiles` filtered domains by `name.startsWith(mPrefix)` and
// FELL BACK to ALL domains when zero matched. The M87 domains are SUBJECT-named
// (no `m87` prefix), so `--milestone M87` matched zero and mis-scoped to EVERY
// historical domain. The fix (M87-D2-T4) adds an explicit `--domains` list and
// REPLACES the fall-back-to-all with a structured `milestone-scope-unresolved`
// error. This test is the kill-criterion for that fix:
//   - `--milestone M87 --domains <the four>` → EXACTLY the four M87 domains.
//   - `--milestone M87` with no `--domains` and no m87-prefixed dir → exit 64
//     `milestone-scope-unresolved`, NEVER a run over all historical domains.
//   - a named domain that does not exist → error, not a silent drop.
//   - REGRESSION: a genuinely prefix-named milestone still scopes by prefix.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { runGate, listTasksFiles } = require("../bin/gsd-t-traceability-gate.cjs");

const REPO = path.resolve(__dirname, "..");

const M87_DOMAINS = [
  "guard-bridge-spike",
  "traceability-section-coverage",
  "milestone-two-altitude-flow",
  "template-docripple-contract",
];

// Build a throwaway project tree with the given domain names, each carrying a
// trivial tasks.md so existence/has-tasks-md checks pass.
function tmpProject(domainNames) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "m87-scope-"));
  const domainsDir = path.join(root, ".gsd-t", "domains");
  fs.mkdirSync(domainsDir, { recursive: true });
  for (const name of domainNames) {
    const d = path.join(domainsDir, name);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, "tasks.md"), `# Tasks ${name}\n### ${name}-T1 — scaffold\n`);
  }
  return root;
}

// ─── Explicit --domains scopes to EXACTLY those (zero historical) ─────────

test("`--milestone M87 --domains <the four>` scopes to EXACTLY the four M87 domains, zero historical", () => {
  // listTasksFiles is the scoping brain — assert its resolved set directly. Use a
  // self-contained tmp project (NOT the live repo): at complete-milestone the M87
  // domains are archived out of `.gsd-t/domains/`, so coupling to the live repo
  // would make this test pass only mid-milestone. The scoping logic is identical
  // against temp dirs + extra historical decoys.
  const root = tmpProject([...M87_DOMAINS, "m99-historical", "m12-other"]);
  const resolved = listTasksFiles(root, "M87", M87_DOMAINS);
  assert.ok(!resolved.error, `must not error: ${JSON.stringify(resolved.error)}`);
  const got = resolved.files.map((f) => f.domain).sort();
  assert.deepEqual(got, [...M87_DOMAINS].sort(),
    "the resolved domain set must equal EXACTLY the four named M87 domains, never the historical decoys");
});

test("runGate with --domains <the four> touches only those four domains (zero historical)", () => {
  const root = tmpProject([...M87_DOMAINS, "m99-historical"]);
  const r = runGate({ projectDir: root, milestone: "M87", domains: M87_DOMAINS });
  // Gate may pass or fail on content, but the domain set in the result must be
  // EXACTLY the four — never the historical decoy.
  const domainsSeen = new Set(r.tasks.map((t) => t.domain).filter(Boolean));
  assert.deepEqual([...domainsSeen].sort(), [...M87_DOMAINS].sort(),
    "every assessed task must belong to one of the four M87 domains, zero historical");
});

// ─── Missing --domains + zero prefix-match → exit 64 milestone-scope-unresolved ─

test("`--milestone M87` with NO --domains and no m87-prefixed dir → exit 64 milestone-scope-unresolved", () => {
  // Throwaway project with only subject-named M87 domains (no `m87` prefix).
  const root = tmpProject(M87_DOMAINS);
  const resolved = listTasksFiles(root, "M87", null);
  assert.ok(resolved.error, "must return a structured error, not fall back to all");
  assert.equal(resolved.error.reason, "milestone-scope-unresolved");
  assert.equal(resolved.error.milestone, "M87");

  const r = runGate({ projectDir: root, milestone: "M87" });
  assert.equal(r.ok, false);
  assert.equal(r.exitCode, 64);
  assert.equal(r.reason, "milestone-scope-unresolved");
  assert.equal(r.milestone, "M87");
  // Critically: it did NOT scope to the (subject-named) domains present.
  assert.deepEqual(r.tasks, [], "must not silently run over all historical domains");
});

// ─── A named domain that does not exist → error, not a silent drop ────────

test("a named --domains entry that does not exist → domain-not-found error (not a silent drop)", () => {
  const root = tmpProject(["alpha", "beta"]);
  const resolved = listTasksFiles(root, null, ["alpha", "ghost"]);
  assert.ok(resolved.error, "a missing named domain must error");
  assert.equal(resolved.error.reason, "domain-not-found");
  assert.deepEqual(resolved.error.missingDomains, ["ghost"]);

  const r = runGate({ projectDir: root, domains: ["alpha", "ghost"] });
  assert.equal(r.ok, false);
  assert.equal(r.exitCode, 64);
  assert.equal(r.reason, "domain-not-found");
  assert.deepEqual(r.missingDomains, ["ghost"]);
});

test("a named --domains dir that exists but has no tasks.md → domain-not-found (no silent drop)", () => {
  const root = tmpProject(["alpha"]);
  // Create a dir with NO tasks.md.
  fs.mkdirSync(path.join(root, ".gsd-t", "domains", "empty"), { recursive: true });
  const resolved = listTasksFiles(root, null, ["alpha", "empty"]);
  assert.ok(resolved.error);
  assert.equal(resolved.error.reason, "domain-not-found");
  assert.deepEqual(resolved.error.missingDomains, ["empty"]);
});

// ─── REGRESSION: a genuinely prefix-named milestone still scopes by prefix ─

test("REGRESSION: a prefix-named milestone (m99-*) still scopes by prefix (M83 behavior preserved)", () => {
  const root = tmpProject(["m99-alpha", "m99-beta", "m12-other", "unrelated"]);
  const resolved = listTasksFiles(root, "M99", null);
  assert.ok(!resolved.error, "prefix-named milestone must resolve, not error");
  const got = resolved.files.map((f) => f.domain).sort();
  assert.deepEqual(got, ["m99-alpha", "m99-beta"],
    "scopes to exactly the m99-prefixed domains, excluding m12/unrelated");
});

test("REGRESSION: no milestone + no domains → all domains (single-milestone-repo default)", () => {
  const root = tmpProject(["alpha", "beta", "gamma"]);
  const resolved = listTasksFiles(root, null, null);
  assert.ok(!resolved.error);
  const got = resolved.files.map((f) => f.domain).sort();
  assert.deepEqual(got, ["alpha", "beta", "gamma"]);
});

test("REGRESSION: --tasks single-file path is unchanged by the scoping fix", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m87-single-"));
  const f = path.join(dir, "tasks.md");
  fs.writeFileSync(f, "# Tasks\n### T1 — feature\n**Files**: `src/x.js`\n**Test**: `test/x.test.js`\n**Acceptance criteria**: does the thing\n");
  const r = runGate({ tasksFile: f });
  assert.ok(r.exitCode === 0 || r.exitCode === 4, "single-file path runs the M83 gate as before");
  assert.equal(r.tasks.length, 1);
});

// ─── CONTAINMENT: a --domains entry escaping the domains dir is REFUSED ────
// (Red Team verify finding MEDIUM-1, feedback_destructive_path_ops_containment.)
// A `../`-escape / absolute path must NEVER resolve to an out-of-tree tasks.md
// and be silently gated as "traceable". Predicate: resolve INSIDE root only.

test("a --domains entry that escapes the domains dir (`../`) → domain-path-escape, never an out-of-tree read", () => {
  const root = tmpProject(["alpha"]);
  // Plant a tasks.md OUTSIDE the project tree that the escape would otherwise reach.
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "m87-outside-"));
  fs.writeFileSync(path.join(outside, "tasks.md"), "# Tasks outside\n### X-T1 — leak\n");
  const rel = path.relative(path.join(root, ".gsd-t", "domains"), outside);
  const resolved = listTasksFiles(root, null, [rel]);
  assert.ok(resolved.error, "an escaping domain name must error, not gate an out-of-tree file");
  assert.equal(resolved.error.reason, "domain-path-escape");
  assert.deepEqual(resolved.error.escapedDomains, [rel]);

  const r = runGate({ projectDir: root, domains: [rel] });
  assert.equal(r.ok, false);
  assert.equal(r.exitCode, 64);
  assert.equal(r.reason, "domain-path-escape");
});

test("an absolute-path --domains entry → domain-path-escape (not gated against an absolute target)", () => {
  const root = tmpProject(["alpha"]);
  const abs = fs.mkdtempSync(path.join(os.tmpdir(), "m87-abs-"));
  fs.writeFileSync(path.join(abs, "tasks.md"), "# Tasks\n### Z-T1 — leak\n");
  const resolved = listTasksFiles(root, null, [abs]);
  assert.ok(resolved.error);
  assert.equal(resolved.error.reason, "domain-path-escape");
});

test("an out-of-tree --pseudocode-dir is refused (empty doc set, fail-closed) — gate still runs in-tree", () => {
  const root = tmpProject(["alpha"]);
  const evil = fs.mkdtempSync(path.join(os.tmpdir(), "m87-evildocs-"));
  fs.writeFileSync(path.join(evil, "PseudoCode-Leak.md"), "## Leak\n");
  const rel = path.relative(root, evil); // out-of-tree relative path
  // Must NOT throw and must NOT load the out-of-tree doc; gate runs over alpha.
  const r = runGate({ projectDir: root, domains: ["alpha"], pseudocodeDir: rel });
  assert.ok(r.exitCode === 0 || r.exitCode === 4, "gate runs in-tree, no throw");
  // No section-coverage violation can reference the out-of-tree doc (it was never loaded).
  const leaked = (r.violations || []).some((v) => JSON.stringify(v).includes("Leak"));
  assert.equal(leaked, false, "an out-of-tree pseudocode dir must never be read");
});
