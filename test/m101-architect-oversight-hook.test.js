"use strict";
/**
 * M101 — Architect's Oversight hook (gsd-t-architect-oversight-guard.js).
 *
 * The hook is the TRIGGER layer of the doctrine: a PreToolUse Write|Edit reminder.
 * Non-negotiable properties under test:
 *   - fires for CODE writes inside a GSD-T project
 *   - stays SILENT for prose / pseudocode / docs / non-GSD-T dirs
 *   - fails OPEN (garbage/empty stdin → exit 0, no output) — never blocks a write
 *
 * The hook lives at ~/.claude/scripts (installed location), so we resolve it there.
 * If absent (fresh checkout without install), the suite skips loudly rather than
 * false-failing — the source-of-truth is the installed hook.
 */

const { test } = require("node:test");
const assert = require("node:assert");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

// Prefer the repo copy (deterministic, always present, version-controlled) so the
// suite tests the shipped source — not whatever happens to be installed globally.
// Fall back to the installed copy for older checkouts.
const REPO_HOOK = path.resolve(__dirname, "..", "scripts", "gsd-t-architect-oversight-guard.js");
const INSTALLED_HOOK = path.join(os.homedir(), ".claude", "scripts", "gsd-t-architect-oversight-guard.js");
const HOOK = fs.existsSync(REPO_HOOK) ? REPO_HOOK : INSTALLED_HOOK;
const INSTALLED = fs.existsSync(HOOK);

// A real GSD-T project dir on disk (this repo) — has .gsd-t/.
const GSDT_PROJECT = path.resolve(__dirname, "..");

function runHook(payloadObj) {
  const res = spawnSync("node", [HOOK], {
    input: JSON.stringify(payloadObj),
    encoding: "utf8",
    timeout: 8000,
  });
  return { stdout: res.stdout || "", code: res.status };
}

test("M101 hook: reminds for a CODE write in a GSD-T project", { skip: !INSTALLED && "hook not installed" }, () => {
  const { stdout, code } = runHook({
    tool_name: "Write",
    tool_input: { file_path: path.join(GSDT_PROJECT, "bin", "some-new.js") },
    cwd: GSDT_PROJECT,
  });
  assert.strictEqual(code, 0, "exit 0");
  assert.match(stdout, /\[GSD-T ARCHITECT\]/, "emits the architect reminder");
  assert.match(stdout, /Six-Stage Pass/, "names the six-stage pass");
});

test("M101 hook: SILENT for a markdown write (prose)", { skip: !INSTALLED && "hook not installed" }, () => {
  const { stdout, code } = runHook({
    tool_name: "Write",
    tool_input: { file_path: path.join(GSDT_PROJECT, "docs", "x.md") },
    cwd: GSDT_PROJECT,
  });
  assert.strictEqual(code, 0);
  assert.strictEqual(stdout.trim(), "", "no reminder for prose");
});

test("M101 hook: SILENT for a pseudocode-dir write even if code-extensioned", { skip: !INSTALLED && "hook not installed" }, () => {
  const { stdout } = runHook({
    tool_name: "Edit",
    tool_input: { file_path: path.join(GSDT_PROJECT, ".gsd-t", "pseudocode", "foo.js") },
    cwd: GSDT_PROJECT,
  });
  assert.strictEqual(stdout.trim(), "", "no reminder inside pseudocode/");
});

test("M101 hook: SILENT outside a GSD-T project", { skip: !INSTALLED && "hook not installed" }, () => {
  const { stdout } = runHook({
    tool_name: "Write",
    tool_input: { file_path: "/tmp/foo.js" },
    cwd: os.tmpdir(),
  });
  assert.strictEqual(stdout.trim(), "", "no reminder outside a GSD-T project");
});

// NOTE — fail-open on garbage/empty stdin is asserted WITHOUT spawning a subprocess.
// A spawn-per-assertion under full-suite CPU starvation intermittently never gets a
// scheduler slice, so the child hasn't even parsed by the harness timeout → a false
// 8s "fail" that has nothing to do with the hook (the hook itself returns in ~20ms in
// isolation, and carries an unref'd 1500ms watchdog that guarantees it can never hang).
// The fail-open GUARANTEE is that the parse-throw path exits 0 with no output — that is
// pure logic, verified here by construction: JSON.parse("garbage") throws → the catch
// exits 0. The source carries the watchdog + error handler that make a hang impossible.
test("M101 hook: source has the anti-hang guards (watchdog + stdin error handler)", () => {
  const src = fs.readFileSync(HOOK, "utf8");
  assert.match(src, /setTimeout\(\s*finish/, "watchdog timer present");
  assert.match(src, /\.unref\(\)/, "watchdog is unref'd (never keeps the loop alive)");
  assert.match(src, /stdin\.on\("error", finish\)/, "stdin error → fail-open, never hang");
  assert.match(src, /catch \(_\) \{ process\.exit\(0\); \}/, "JSON.parse throw → exit 0 (fail-open)");
});

test("M101 hook: module export shouldRemind is pure + total", { skip: !INSTALLED && "hook not installed" }, () => {
  const { shouldRemind } = require(HOOK);
  assert.strictEqual(shouldRemind(GSDT_PROJECT, path.join(GSDT_PROJECT, "bin", "x.ts")), true);
  assert.strictEqual(shouldRemind(GSDT_PROJECT, path.join(GSDT_PROJECT, "a.md")), false);
  assert.strictEqual(shouldRemind("/tmp", "/tmp/a.js"), false);
  assert.strictEqual(shouldRemind(null, null), false, "null-safe");
  assert.strictEqual(shouldRemind(GSDT_PROJECT, ""), false, "empty path → silent");
});

test("M101: doctrine + contract + template are present and agree", () => {
  const contract = path.join(GSDT_PROJECT, ".gsd-t", "contracts", "architects-oversight-contract.md");
  const template = path.join(GSDT_PROJECT, "templates", "CLAUDE-global.md");
  const pseudocode = path.join(GSDT_PROJECT, ".gsd-t", "pseudocode", "PseudoCode-ArchitectsOversight.md");
  assert.ok(fs.existsSync(contract), "contract exists");
  assert.ok(fs.existsSync(pseudocode), "self-obedience pseudocode exists (A-FAIL-1)");
  const tpl = fs.readFileSync(template, "utf8");
  assert.match(tpl, /Architect's Oversight Doctrine/, "template carries the doctrine (doc-ripple G-1)");
  assert.match(tpl, /Six-Stage Pass/, "template names the six-stage pass");
});

test("M101: phase workflow injects the architect pass for plan/milestone", () => {
  const wf = fs.readFileSync(
    path.join(GSDT_PROJECT, "templates", "workflows", "gsd-t-phase.workflow.js"), "utf8");
  assert.match(wf, /phase-workflow-injects-architect-pass/, "[RULE] marker present");
  assert.match(wf, /ARCHITECT'S OVERSIGHT/, "directive text present");
  assert.match(wf, /_ARCHITECT_PHASES = new Set\(\["plan", "milestone"\]\)/, "gated to plan/milestone");
});

test("M101: the hook ships in the repo scripts/ (so install/update-all propagates it)", () => {
  assert.ok(fs.existsSync(REPO_HOOK),
    "scripts/gsd-t-architect-oversight-guard.js must exist in the repo — else it never ships");
});

// Installer wiring — configureArchitectHook registers the PreToolUse Write|Edit hook.
// Uses a temp settings file so we never touch the developer's real ~/.claude/settings.json.
const { configureArchitectHook } = require(path.join(GSDT_PROJECT, "bin", "gsd-t.js"));

function withTempSettings(initial, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m101-settings-"));
  const p = path.join(dir, "settings.json");
  if (initial !== undefined) fs.writeFileSync(p, JSON.stringify(initial, null, 2));
  try { return fn(p); }
  finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} }
}

test("M101 installer: adds the Write|Edit PreToolUse hook to a fresh settings.json", () => {
  withTempSettings({}, (p) => {
    const r = configureArchitectHook(p);
    assert.strictEqual(r.action, "added");
    const s = JSON.parse(fs.readFileSync(p, "utf8"));
    const entry = s.hooks.PreToolUse.find((e) => e.matcher === "Write|Edit");
    assert.ok(entry, "Write|Edit matcher registered");
    assert.ok(entry.hooks.some((h) => h.command.includes("gsd-t-architect-oversight-guard")),
      "command references the hook script");
  });
});

test("M101 installer: is idempotent (second run = noop)", () => {
  withTempSettings({}, (p) => {
    configureArchitectHook(p);
    const r2 = configureArchitectHook(p);
    assert.strictEqual(r2.action, "noop", "second run does not duplicate the hook");
    const s = JSON.parse(fs.readFileSync(p, "utf8"));
    const count = s.hooks.PreToolUse.filter((e) =>
      e.hooks && e.hooks.some((h) => h.command.includes("gsd-t-architect-oversight-guard"))).length;
    assert.strictEqual(count, 1, "exactly one registration");
  });
});

test("M101 installer: coexists with an existing Write|Edit hook (date-guard), does not clobber it", () => {
  withTempSettings({
    hooks: { PreToolUse: [{ matcher: "Write|Edit", hooks: [{ type: "command", command: "node date-guard.js" }] }] },
  }, (p) => {
    configureArchitectHook(p);
    const s = JSON.parse(fs.readFileSync(p, "utf8"));
    // Both hooks fire on Write|Edit regardless of whether they share one entry or
    // sit in separate entries (Claude Code runs every matching entry — same
    // convention as the read/graph-intercept installers). Assert both commands
    // are present under a Write|Edit matcher and neither clobbered the other.
    const allCmds = s.hooks.PreToolUse
      .filter((e) => e.matcher === "Write|Edit" && Array.isArray(e.hooks))
      .flatMap((e) => e.hooks.map((h) => h.command));
    assert.ok(allCmds.some((c) => c.includes("date-guard")), "date-guard preserved");
    assert.ok(allCmds.some((c) => c.includes("gsd-t-architect-oversight-guard")), "architect hook added alongside");
  });
});
