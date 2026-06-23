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
 *        OR --domains a,b,c to scope to EXACTLY those domain dirs (M87 D2-T4).
 * Output: JSON envelope { ok, exitCode, milestone, tasks:[...], violations:[...] }.
 * Exit: 0 all tasks traceable · 4 ≥1 violation (blocks execute) · 64 bad input.
 *
 * Hard rules: zero deps, never throws, pure/read-only.
 *
 * ── M87 D2 EXTENSION (section-citation coverage; pseudocode-source-of-truth §3) ──
 * In ADDITION to the M83 AC→(path+test) binding, when a PseudoCode-[Title].md doc
 * is in scope (present in the pseudocode dir AND cited by ≥1 task), every one of
 * its `##` sections (§3.1: level-2 headings OUTSIDE Appendix code fences) must be
 * cited by ≥1 task via a `**PseudoCode-Section**: <Title>#<anchor>` field. A
 * section with zero citing tasks is an uncovered structural gap; a cited anchor
 * that resolves to NO `##`-heading slug (§3.2 GitHub-style, slug-as-slug never
 * substring) is an unresolvable-citation FAILURE. The M83 behavior + exit codes
 * are preserved untouched.
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

// ─── M87 D2: section-citation grammar (pseudocode-source-of-truth §3) ─────

// `**PseudoCode-Section**: <Title>#<anchor>` — matched emphasis-agnostically on
// the BARED line, then split path-as-path into Title + anchor segments. The
// raw line is bared via _bare (emphasis stripped) so the colon-inside/outside
// bold forms both match, exactly like the M83 field scan.
const PSEUDOCODE_SECTION_FIELD_RE = /^\s*[-*]?\s*pseudocode-section\s*:/i;

/**
 * Parse the `**PseudoCode-Section**: <Title>#<anchor>` citation from a task's
 * lines. Returns { title, anchor } structured segments, or null if absent.
 * Path-as-path: the value is split on the FIRST `#`; everything left of it is
 * the doc Title, everything right is the anchor slug. Never substring-matched
 * against doc text.
 *
 * Title normalization: the corpus cites with the full filename stem
 * (`PseudoCode-PayPal#…`) while the doc loader keys by the bare subject
 * (`PayPal`, the stem minus the `PseudoCode-` prefix). A leading `PseudoCode-`
 * in the title segment is therefore stripped so both forms resolve to one key.
 */
function _normalizeDocTitle(t) {
  const s = String(t == null ? "" : t).trim();
  const m = s.match(/^PseudoCode-(.+)$/);
  return m ? m[1] : s;
}

function parseSectionCitation(lines) {
  for (const ln of lines) {
    const bare = _bare(ln);
    if (!PSEUDOCODE_SECTION_FIELD_RE.test(bare)) continue;
    const idx = bare.indexOf(":");
    if (idx < 0) continue;
    const val = bare.slice(idx + 1).trim();
    const hash = val.indexOf("#");
    if (hash < 0) return { title: _normalizeDocTitle(val), anchor: "", raw: val };
    return { title: _normalizeDocTitle(val.slice(0, hash)), anchor: val.slice(hash + 1).trim(), raw: val };
  }
  return null;
}

/**
 * GitHub-style heading→slug (contract §3.2, deterministic/pure):
 *   lowercase → drop every char that is NOT ascii-alnum / space / hyphen →
 *   spaces to hyphens → collapse hyphen runs. slug-as-slug, never substring.
 */
function slugifyHeading(text) {
  return String(text == null ? "" : text)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/ /g, "-")
    .replace(/-+/g, "-");
}

/**
 * Enumerate the citable `##` sections of a PseudoCode doc (contract §3.1):
 * every level-2 heading OUTSIDE fenced code blocks (so the `# 0.` banner lines
 * inside the Appendix raw-pseudocode fences are EXCLUDED). Returns an ordered
 * list of { title, slug }. Pure/read-only over the doc text.
 */
function enumerateSections(md) {
  const lines = (md || "").split(/\r?\n/);
  const out = [];
  let inFence = false;
  for (const line of lines) {
    // Fence delimiters: ``` or ~~~ (3+), optionally indented, with an info string.
    if (/^\s*(```+|~~~+)/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = line.match(/^##\s+(.*\S.*)$/);
    if (m) out.push({ title: m[1].trim(), slug: slugifyHeading(m[1].trim()) });
  }
  return out;
}

/**
 * Derive the doc <Title> from a PseudoCode-[Title].md filename (basename minus
 * the `PseudoCode-` prefix and `.md` suffix). Path-as-path.
 */
function docTitleFromFilename(filename) {
  const base = path.basename(String(filename || ""));
  const m = base.match(/^PseudoCode-(.+)\.md$/);
  return m ? m[1] : null;
}

/**
 * A task is "behavioral" (subject to the gate) if it declares acceptance
 * criteria — i.e. it promises an observable behavior. Pure-scaffolding tasks
 * with no ACs are out of scope (nothing to trace).
 */
function assessTask(task) {
  const lines = task.lines;
  // M87 D2: every task may carry a section citation, AC-bearing or not — capture
  // it regardless so non-behavioral coverage tasks still count toward citations.
  const sectionCitation = parseSectionCitation(lines);
  const hasAc = hasMultiField(lines, AC_FIELD_RE);
  if (!hasAc) {
    return { title: task.title, behavioral: false, violations: [], sectionCitation };
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
    sectionCitation,
    violations,
  };
}

// ─── driver ──────────────────────────────────────────────────────────────

/**
 * Resolve the set of tasks.md files to gate.
 *
 * Returns { files: [...] } on success, or { error: { reason, ... } } when an
 * explicit scope cannot be honored (M87 D2-T4 — never silently fall back to all
 * historical domains).
 *
 * Scoping precedence:
 *   1. `domains` (explicit list) → EXACTLY those dirs; each must exist + carry a
 *      tasks.md, else a structured error (a named-but-missing domain is never a
 *      silent drop).
 *   2. `milestone` prefix-match → domains whose name starts with the mNN prefix
 *      (M83 path, preserved for prefix-named milestones).
 *   3. `milestone` set but prefix-match yields zero AND no `domains` →
 *      structured `milestone-scope-unresolved` error (exit 64) instructing
 *      `--domains`, REPLACING the M83 fall-back-to-all.
 *   4. No milestone, no domains → all domains (single-milestone-repo default).
 */
/**
 * Containment guard (per feedback_destructive_path_ops_containment): a child path
 * is valid only if it resolves strictly INSIDE root (root + separator prefix) —
 * never outside, never equal to root. Refuses `../`-escapes, absolute paths, and
 * any name resolving to a sibling/ancestor. Returns the resolved path or null.
 */
function containedChild(root, name) {
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, name);
  if (candidate === resolvedRoot) return null; // equal-to-root is not a child
  if (!candidate.startsWith(resolvedRoot + path.sep)) return null; // outside-root
  return candidate;
}

function listTasksFiles(projectDir, milestone, domains = null) {
  const domainsDir = path.join(projectDir, ".gsd-t", "domains");

  // (1) Explicit domain list — scope to EXACTLY those, error on any miss.
  if (domains && domains.length) {
    const files = [];
    const missing = [];
    const escaped = [];
    for (const name of domains) {
      // Containment: a domain name must resolve strictly inside the domains dir.
      // A `../`-escape / absolute path / sibling reference is REFUSED, never
      // silently gated against an out-of-tree file (read-only today, but the
      // gate becomes attacker-reachable the moment --domains is doc-derived).
      const domainDir = containedChild(domainsDir, name);
      if (!domainDir) { escaped.push(name); continue; }
      const tasksPath = path.join(domainDir, "tasks.md");
      let stat = null;
      try { stat = fs.statSync(domainDir); } catch {/* missing */}
      if (!stat || !stat.isDirectory() || !fs.existsSync(tasksPath)) {
        missing.push(name);
        continue;
      }
      files.push({ domain: name, tasksPath });
    }
    if (escaped.length) {
      return { error: { reason: "domain-path-escape", escapedDomains: escaped, requestedDomains: domains } };
    }
    if (missing.length) {
      return { error: { reason: "domain-not-found", missingDomains: missing, requestedDomains: domains } };
    }
    return { files };
  }

  let entries = [];
  try {
    entries = fs.readdirSync(domainsDir, { withFileTypes: true });
  } catch {
    return { files: [] };
  }
  const all = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const tasksPath = path.join(domainsDir, e.name, "tasks.md");
    if (fs.existsSync(tasksPath)) all.push({ domain: e.name, tasksPath });
  }

  const mPrefix = milestone ? milestone.toLowerCase() : null;
  if (mPrefix) {
    const matched = all.filter((d) => d.domain.toLowerCase().startsWith(mPrefix));
    if (matched.length) return { files: matched };
    // Zero prefix-match + no explicit --domains → DO NOT fall back to all.
    return { error: { reason: "milestone-scope-unresolved", milestone } };
  }
  return { files: all };
}

// ─── M87 D2: section-coverage over the in-scope PseudoCode docs ───────────

/**
 * Enumerate the PseudoCode-*.md docs available for coverage. Default location is
 * `.gsd-t/pseudocode/` (contract §7), overridable via pseudocodeDir (the D2 test
 * points it at D1's byte-verbatim fixtures). Returns a Map<Title, {path, md,
 * sections}>; a missing dir yields an empty Map (logged skip, never a throw).
 */
function loadPseudocodeDocs(pseudocodeDir) {
  const docs = new Map();
  let entries = [];
  try { entries = fs.readdirSync(pseudocodeDir, { withFileTypes: true }); }
  catch { return docs; }
  for (const e of entries) {
    if (!e.isFile()) continue;
    const title = docTitleFromFilename(e.name);
    if (!title) continue;
    const full = path.join(pseudocodeDir, e.name);
    let md;
    try { md = fs.readFileSync(full, "utf8"); } catch { continue; }
    docs.set(title, { path: full, md, sections: enumerateSections(md) });
  }
  return docs;
}

/**
 * Run section-citation coverage over the in-scope PseudoCode docs.
 *
 * A doc is "in scope" when it exists in the pseudocode dir AND is cited by ≥1
 * task. For each in-scope doc: (a) every cited anchor MUST resolve to a real
 * `##`-heading slug (else unresolvable-citation FAILURE); (b) every `##` section
 * MUST be cited by ≥1 task (else uncovered-section gap). All slug-as-slug, never
 * substring.
 *
 * @returns {{ violations, docs }}
 */
function assessSectionCoverage(taskResults, pseudocodeDocs) {
  const violations = [];
  const docReports = [];

  // citationsByTitle: Map<Title, Array<{ anchor, domain, task }>>
  const citationsByTitle = new Map();
  for (const r of taskResults) {
    const c = r.sectionCitation;
    if (!c || !c.title) continue;
    if (!citationsByTitle.has(c.title)) citationsByTitle.set(c.title, []);
    citationsByTitle.get(c.title).push({ anchor: c.anchor, domain: r.domain, task: r.title });
  }

  // A doc is in scope when present in the dir AND cited by ≥1 task.
  for (const [title, citations] of citationsByTitle) {
    const doc = pseudocodeDocs.get(title);
    if (!doc) continue; // cited but no doc available → out of section-coverage scope
    const slugSet = new Set(doc.sections.map((s) => s.slug));
    const citedSlugs = new Set();

    // (a) Unresolvable-citation FAILURE: a cited anchor matching no `##` slug.
    for (const cit of citations) {
      if (cit.anchor && slugSet.has(cit.anchor)) {
        citedSlugs.add(cit.anchor);
      } else {
        violations.push({
          domain: cit.domain, task: cit.task,
          kind: "unresolvable-section-citation",
          detail: `PseudoCode-Section cites "${title}#${cit.anchor}" but no \`##\` heading in PseudoCode-${title}.md slugifies to that anchor (§3.2 slug-as-slug).`,
          doc: title, anchor: cit.anchor,
        });
      }
    }

    // (b) Uncovered-section gap: a `##` section with zero citing tasks.
    for (const s of doc.sections) {
      if (!citedSlugs.has(s.slug)) {
        violations.push({
          domain: null, task: null,
          kind: "uncovered-section",
          detail: `PseudoCode-${title}.md section "${s.title}" (#${s.slug}) has zero citing tasks — structural coverage gap (§3.1).`,
          doc: title, anchor: s.slug, section: s.title,
        });
      }
    }

    docReports.push({
      doc: title,
      sectionsTotal: doc.sections.length,
      sectionsCovered: citedSlugs.size,
    });
  }

  return { violations, docs: docReports };
}

function runGate({ projectDir = process.cwd(), milestone = null, tasksFile = null, domains = null, pseudocodeDir = null } = {}) {
  let files;
  if (tasksFile) {
    files = [{ domain: path.basename(path.dirname(tasksFile)), tasksPath: tasksFile }];
  } else {
    const resolved = listTasksFiles(projectDir, milestone, domains);
    if (resolved.error) {
      return { ok: false, exitCode: 64, milestone, ...resolved.error, tasks: [], violations: [] };
    }
    files = resolved.files;
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

  // M87 D2: section-citation coverage over the in-scope PseudoCode docs.
  // Containment: an explicit --pseudocode-dir must resolve INSIDE the project
  // tree (the D2 test legitimately points it at test/fixtures/, also inside the
  // project; an out-of-tree `../../evildocs` is refused). The default
  // `.gsd-t/pseudocode/` is always in-tree. A refused dir → empty doc set
  // (logged skip, never an out-of-tree read), same fail-closed shape as a missing dir.
  let resolvedPcDir = pseudocodeDir || path.join(projectDir, ".gsd-t", "pseudocode");
  if (pseudocodeDir) {
    const resolvedProject = path.resolve(projectDir);
    const candidate = path.resolve(resolvedProject, pseudocodeDir);
    if (candidate !== resolvedProject && !candidate.startsWith(resolvedProject + path.sep)) {
      resolvedPcDir = null; // out-of-tree → no docs loaded (fail-closed)
    } else {
      resolvedPcDir = candidate;
    }
  }
  const pseudocodeDocs = resolvedPcDir ? loadPseudocodeDocs(resolvedPcDir) : new Map();
  const coverage = assessSectionCoverage(taskResults, pseudocodeDocs);
  for (const v of coverage.violations) violations.push(v);

  const ok = violations.length === 0;
  return {
    ok,
    exitCode: ok ? 0 : 4,
    milestone,
    summary: {
      tasksTotal: taskResults.length,
      behavioral: behavioralCount,
      violations: violations.length,
      sectionCoverageDocs: coverage.docs,
    },
    tasks: taskResults,
    violations,
    ...(ok ? {} : { reason: "untraceable-acceptance-criteria" }),
  };
}

// ─── CLI ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const o = { projectDir: process.cwd(), milestone: null, tasksFile: null, domains: null, pseudocodeDir: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") o.help = true;
    else if (a === "--project-dir") o.projectDir = argv[++i];
    else if (a === "--milestone") o.milestone = argv[++i];
    else if (a === "--tasks") o.tasksFile = argv[++i];
    else if (a === "--domains") {
      o.domains = String(argv[++i] || "").split(",").map((s) => s.trim()).filter(Boolean);
    }
    else if (a === "--pseudocode-dir") o.pseudocodeDir = argv[++i];
    else if (a === "--json") {/* default */}
  }
  return o;
}

const HELP = `Usage: gsd-t traceability-gate [--milestone Mxx] [--project-dir PATH] [--tasks FILE] [--domains a,b,c] [--pseudocode-dir PATH]

Plan-phase acceptance-traceability gate (M83) + section-citation coverage (M87 D2).
Asserts every behavioral task in the milestone's .gsd-t/domains/* /tasks.md binds
its acceptance criteria to an implementing **Files** path AND a named test.
Headline tasks must have BOTH a real implementation path and a test. Additionally,
when a PseudoCode-[Title].md doc is in scope, every \`##\` section must be cited by
≥1 task (\`**PseudoCode-Section**: <Title>#<anchor>\`) and every citation must
resolve to a real heading slug. Blocks execute on any violation.

  --milestone Mxx     Scope by mNN-prefix domains (M83). Zero match + no --domains
                      → exit 64 milestone-scope-unresolved (never fall-back-to-all).
  --domains a,b,c     Scope to EXACTLY these domain dirs (each must exist + carry a
                      tasks.md; a missing named domain is an error, not a drop).
  --project-dir P     Project root (default: cwd).
  --tasks FILE        Check a single tasks.md (overrides domain discovery).
  --pseudocode-dir P  PseudoCode-*.md dir for section coverage (default
                      .gsd-t/pseudocode).

Exit: 0 all traceable · 4 ≥1 violation · 64 bad input / unresolved scope.`;

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

module.exports = {
  runGate, parseTasks, assessTask, listTasksFiles,
  parseSectionCitation, slugifyHeading, enumerateSections, docTitleFromFilename,
  loadPseudocodeDocs, assessSectionCoverage,
  _internal: { fieldValue, TEST_PATH_RE },
};
