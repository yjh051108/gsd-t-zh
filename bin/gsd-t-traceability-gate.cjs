"use strict";

/**
 * gsd-t-traceability-gate — M83 D1
 *
 * The plan-phase acceptance-traceability gate. The deterministic half of
 * Left-Shifted Plan Hardening (the adversarial pre-mortem agent is the
 * generative half). Contract: .gsd-t/contracts/plan-hardening-contract.md.
 *
 * ORIGIN (NiceNote M5 incident, 2026-06-05): M5's headline capability (AC-6,
 * 100MB+ chunked read) shipped as DEAD CODE — the chunk reader was built but
 * openPath still materialized whole files, and NO test asserted the headline
 * capability, so the suite stayed green. The triad burned 4 verify cycles
 * re-litigating the milestone's reason to exist. Root cause: the plan never
 * bound each acceptance criterion to (a) a real code path and (b) a test that
 * FAILS if that path is absent. This gate enforces that binding BEFORE execute.
 *
 * What it checks, per `.gsd-t/domains/* /tasks.md` task block:
 *   - Every task that declares **Acceptance criteria** MUST declare **Files**
 *     (an implementing code path) — an AC with no path is an unbacked promise.
 *   - Every such task MUST declare a TEST reference (a Test/Tests field, a
 *     test-runner mention, or a Files entry matching a test path pattern) — an
 *     AC with no killing test is the dead-code class (passes vacuously / never
 *     exercised). The milestone's HEADLINE capability without a test is exactly
 *     the M5 failure.
 *   - A task tagged as the milestone HEADLINE (**Headline:** true, or an AC
 *     referencing the milestone's named capability) gets a STRICTER check: it
 *     MUST have a non-test Files entry (real implementation, not just a test)
 *     AND a test entry. A headline with only a test, or only an impl, fails.
 *
 * It does NOT judge whether the code is correct (that's verify) — only whether
 * the PLAN is complete enough that execute can't produce a dead deliverable.
 *
 * Input: --milestone Mxx --project-dir PATH  (reads .gsd-t/domains/* /tasks.md).
 *        OR --tasks <file> to check a single tasks.md (used by tests).
 * Output: JSON envelope { ok, exitCode, milestone, tasks:[...], violations:[...] }.
 * Exit: 0 all tasks traceable · 4 ≥1 violation (blocks execute) · 64 bad input.
 *
 * Hard rules: zero deps, never throws, pure/read-only.
 */

const fs = require("node:fs");
const path = require("node:path");

// ─── tasks.md parsing ────────────────────────────────────────────────────

// Red Team CRITICAL/HIGH-3/MEDIUM-1 (M83 verify): markdown field labels appear in
// BOTH `**Label**: v` (colon outside bold) and `**Label:** v` (colon inside) forms.
// Matching against the raw line missed the colon-inside form — defeating the entire
// gate on the canonical M5 dead-code plan. Fix: STRIP emphasis markers first, then
// match the colon-agnostic bare text. All field detection runs on the bared line.
function _bare(line) {
  return String(line == null ? "" : line).replace(/[*_`]/g, "");
}

// Path-safe bare: strips only emphasis that wraps labels (* and backtick), but
// PRESERVES underscores — pytest's test_*.py / *_test.py conventions depend on
// them, and TEST_PATH_RE has `_test\.` / `test_` alternatives (Red Team M83
// recheck HIGH: stripping `_` before the test-path scan false-failed Python plans).
function _barePath(s) {
  return String(s == null ? "" : s).replace(/[*`]/g, "");
}

// A test reference is: an explicit Test/Tests field, a known runner mention, or a
// Files path that looks like a test file. Kept broad on purpose — the gate asserts
// a test is NAMED, not that it exists yet (plan precedes execute).
const TEST_PATH_RE = /(\.test\.|\.spec\.|(^|\/)tests?\/|(^|\/)e2e\/|_test\.|test_|cargo test|vitest|playwright|pytest|jest)/i;
// Field regexes run on the BARED line, so the colon can be anywhere the label ends.
const TEST_FIELD_RE = /^\s*[-*]?\s*(tests?|test\s*ref|test\s*coverage|verified\s*by)\s*:/i;
const FILES_FIELD_RE = /^\s*[-*]?\s*files?\s*:/i;
const AC_FIELD_RE = /^\s*[-*]?\s*(acceptance(\s*criteria)?|accept|ac)\s*:/i;
const HEADLINE_FIELD_RE = /^\s*[-*]?\s*headline\s*:\s*(true|yes)/i;
const HEADING_RE = /^(#{2,4})\s+(.*\S.*)$/;

// Headings that are structural, never tasks — so we don't mis-parse a Summary/
// Overview block as a behavioral task. Everything else that bears an AC field IS
// assessed (Red Team HIGH-2: do NOT gate task detection on heading wording —
// anchor on the AC, so a descriptive heading like "Implement the reader" is caught).
const NON_TASK_HEADING_RE = /^(summary|overview|notes?|context|goal|background|wave\s*history|index|integration\s*points?|dependencies|references?|appendix|tasks)\s*$/i;

/**
 * Parse a tasks.md into candidate blocks: every `##`–`####` heading starts a
 * block (except the structural-heading skip list). A block becomes a TASK for
 * assessment iff it contains an acceptance-criteria field (decided later in
 * assessTask) — but we keep ALL non-structural blocks so no AC-bearing block is
 * ever dropped on heading wording.
 * @returns {Array<{title, raw, lines}>}
 */
function parseTasks(md) {
  const lines = (md || "").split(/\r?\n/);
  const blocks = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(HEADING_RE);
    if (m) {
      const title = m[2].trim();
      // Close any open block at every heading.
      if (cur) { blocks.push(cur); cur = null; }
      // Structural headings start no block; everything else does.
      if (!NON_TASK_HEADING_RE.test(_bare(title).trim())) {
        cur = { title, lines: [] };
      }
      continue;
    }
    if (cur) cur.lines.push(line);
  }
  if (cur) blocks.push(cur);
  return blocks.map((t) => ({ title: t.title, raw: t.lines.join("\n"), lines: t.lines }));
}

// ─── per-task traceability assessment ────────────────────────────────────

// All field matching runs on the BARED line (emphasis stripped) so colon
// position inside/outside bold is irrelevant (Red Team CRITICAL fix).
function fieldValue(lines, re) {
  for (const ln of lines) {
    const bare = _bare(ln);
    if (re.test(bare)) {
      const idx = bare.indexOf(":");
      return idx >= 0 ? bare.slice(idx + 1).trim() : "";
    }
  }
  return null;
}

// Like fieldValue but PRESERVES underscores in the returned value (label is still
// matched emphasis-agnostically) — used for value-level test-path scans so
// test_*.py / *_test.py survive (Red Team recheck HIGH).
function fieldValueRaw(lines, re) {
  for (const ln of lines) {
    if (re.test(_bare(ln))) {
      const raw = _barePath(ln);
      const idx = raw.indexOf(":");
      return idx >= 0 ? raw.slice(idx + 1).trim() : "";
    }
  }
  return null;
}

function hasMultiField(lines, re) {
  return lines.some((ln) => re.test(_bare(ln)));
}

// Collect the indented/bulleted sub-lines that follow an Acceptance-criteria
// label up to the next top-level field — these ARE the acceptance criteria, and
// an AC may name its own verifying test there ("…; verified by cargo test").
function _acBulletText(lines) {
  const out = [];
  let inAc = false;
  for (const ln of lines) {
    const bare = _bare(ln);
    if (AC_FIELD_RE.test(bare)) { inAc = true; continue; }
    if (!inAc) continue;
    // A new NON-INDENTED "Label:" line closes the AC block.
    if (/^\s*[-*]?\s*[a-z][a-z\s]{1,24}:/i.test(bare) && !/^\s{2,}/.test(ln)) {
      inAc = false; continue;
    }
    out.push(_barePath(ln)); // preserve underscores for test-path detection
  }
  return out.join("\n");
}

/**
 * A task is "behavioral" (subject to the gate) if it declares acceptance
 * criteria — i.e. it promises an observable behavior. Pure-scaffolding tasks
 * with no ACs are out of scope (nothing to trace).
 */
function assessTask(task) {
  const lines = task.lines;
  const hasAc = hasMultiField(lines, AC_FIELD_RE);
  if (!hasAc) {
    return { title: task.title, behavioral: false, violations: [] };
  }

  // Underscore-preserving values for path/runner scans (Red Team recheck HIGH).
  const filesVal = fieldValueRaw(lines, FILES_FIELD_RE) || "";
  const hasFiles = hasMultiField(lines, FILES_FIELD_RE) && filesVal.replace(/[—–-]/g, "").trim().length > 0;

  // Test reference (MEDIUM-1 fix): satisfied ONLY by a runner/test-path tied to a
  // RELEVANT field — the Test field, the Files field, or the Acceptance-criteria
  // value (where an AC may name its own verifying test, e.g. "…; verified by cargo
  // test"). An incidental runner mention in an UNRELATED field (Dependencies,
  // Notes, Scope) must NOT vacuously clear the killing-test requirement.
  const hasTestField = hasMultiField(lines, TEST_FIELD_RE);
  const testFieldVal = fieldValueRaw(lines, TEST_FIELD_RE) || "";
  const acVal = fieldValueRaw(lines, AC_FIELD_RE) || "";
  // AC criteria often span bullet sub-lines after the label; gather those too
  // (underscore-preserving, so a test_*.py named in a bullet still matches).
  const acBullets = _acBulletText(lines);
  const filesHasTestPath = TEST_PATH_RE.test(filesVal);
  const testFieldHasRunner = TEST_PATH_RE.test(testFieldVal);
  const acHasRunner = TEST_PATH_RE.test(acVal) || TEST_PATH_RE.test(acBullets);
  const hasTest = hasTestField || filesHasTestPath || testFieldHasRunner || acHasRunner;

  // A non-test implementing path: a Files entry that is NOT only test files.
  const fileTokens = filesVal.split(/[,\s]+/).map((s) => s.replace(/[`*()]/g, "").trim()).filter(Boolean);
  const implTokens = fileTokens.filter((f) => /[./]/.test(f) && !TEST_PATH_RE.test(f));
  const hasImplPath = implTokens.length > 0;

  const isHeadline = lines.some((ln) => HEADLINE_FIELD_RE.test(_bare(ln)));

  const violations = [];
  if (!hasFiles) {
    violations.push({ kind: "ac-without-path", detail: "task declares acceptance criteria but no **Files** implementing path — an unbacked promise." });
  }
  if (!hasTest) {
    violations.push({ kind: "ac-without-test", detail: "task declares acceptance criteria but names no test (Test field, test path, or runner) — the dead-code class: it can pass vacuously / never be exercised." });
  }
  if (isHeadline && !hasImplPath) {
    violations.push({ kind: "headline-without-impl", detail: "HEADLINE task has no non-test implementing path — the milestone's reason to exist is not bound to real code (the M5 AC-6 dead-code failure)." });
  }
  if (isHeadline && !hasTest) {
    violations.push({ kind: "headline-without-test", detail: "HEADLINE task has no test proving the milestone's core capability is delivered (the missing >100MB-fixture failure)." });
  }

  return {
    title: task.title,
    behavioral: true,
    isHeadline,
    hasFiles, hasTest, hasImplPath,
    violations,
  };
}

// ─── driver ──────────────────────────────────────────────────────────────

function listTasksFiles(projectDir, milestone) {
  const domainsDir = path.join(projectDir, ".gsd-t", "domains");
  let entries = [];
  try {
    entries = fs.readdirSync(domainsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  const mPrefix = milestone ? milestone.toLowerCase() : null;
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    // When a milestone is given, prefer domains whose name carries that mNN
    // prefix; if none match, fall back to all domains (single-milestone repos).
    const tasksPath = path.join(domainsDir, e.name, "tasks.md");
    if (fs.existsSync(tasksPath)) out.push({ domain: e.name, tasksPath });
  }
  if (mPrefix) {
    const matched = out.filter((d) => d.domain.toLowerCase().startsWith(mPrefix));
    if (matched.length) return matched;
  }
  return out;
}

function runGate({ projectDir = process.cwd(), milestone = null, tasksFile = null } = {}) {
  let files;
  if (tasksFile) {
    files = [{ domain: path.basename(path.dirname(tasksFile)), tasksPath: tasksFile }];
  } else {
    files = listTasksFiles(projectDir, milestone);
  }
  if (!files.length) {
    return { ok: false, exitCode: 64, milestone, reason: "no-tasks-files", tasks: [], violations: [] };
  }

  const taskResults = [];
  const violations = [];
  let behavioralCount = 0;
  for (const f of files) {
    let md;
    try { md = fs.readFileSync(f.tasksPath, "utf8"); } catch { continue; }
    for (const t of parseTasks(md)) {
      const r = assessTask(t);
      r.domain = f.domain;
      taskResults.push(r);
      if (r.behavioral) behavioralCount++;
      for (const v of r.violations) {
        violations.push({ domain: f.domain, task: r.title, ...v });
      }
    }
  }

  const ok = violations.length === 0;
  return {
    ok,
    exitCode: ok ? 0 : 4,
    milestone,
    summary: {
      tasksTotal: taskResults.length,
      behavioral: behavioralCount,
      violations: violations.length,
    },
    tasks: taskResults,
    violations,
    ...(ok ? {} : { reason: "untraceable-acceptance-criteria" }),
  };
}

// ─── CLI ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const o = { projectDir: process.cwd(), milestone: null, tasksFile: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") o.help = true;
    else if (a === "--project-dir") o.projectDir = argv[++i];
    else if (a === "--milestone") o.milestone = argv[++i];
    else if (a === "--tasks") o.tasksFile = argv[++i];
    else if (a === "--json") {/* default */}
  }
  return o;
}

const HELP = `Usage: gsd-t traceability-gate [--milestone Mxx] [--project-dir PATH] [--tasks FILE]

Plan-phase acceptance-traceability gate (M83). Asserts every behavioral task in
the milestone's .gsd-t/domains/* /tasks.md binds its acceptance criteria to an
implementing **Files** path AND a named test. Headline tasks must have BOTH a
real implementation path and a test. Blocks execute on any violation.

  --milestone Mxx    Limit to domains whose name carries the mNN prefix.
  --project-dir P    Project root (default: cwd).
  --tasks FILE       Check a single tasks.md (overrides domain discovery).

Exit: 0 all traceable · 4 ≥1 violation · 64 no tasks files / bad input.`;

function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) { process.stdout.write(HELP + "\n"); process.exit(0); }
  let res;
  try {
    res = runGate(o);
  } catch (e) {
    res = { ok: false, exitCode: 64, milestone: o.milestone, reason: `gate-error: ${e && e.message}`, tasks: [], violations: [] };
  }
  process.stdout.write(JSON.stringify(res, null, 2) + "\n");
  process.exit(res.exitCode);
}

if (require.main === module) main();

module.exports = { runGate, parseTasks, assessTask, _internal: { fieldValue, TEST_PATH_RE } };
