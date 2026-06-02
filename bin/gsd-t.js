#!/usr/bin/env node

/**
 * GSD-T CLI Installer
 *
 * Usage:
 *   npx @tekyzinc/gsd-t install     — Install commands + global CLAUDE.md
 *   npx @tekyzinc/gsd-t update      — Update commands + global CLAUDE.md (preserves customizations)
 *   npx @tekyzinc/gsd-t update-all  — Update globally + all registered project CLAUDE.md files
 *   npx @tekyzinc/gsd-t init [name] — Initialize a new project with GSD-T structure (auto-registers)
 *   npx @tekyzinc/gsd-t register    — Register current directory as a GSD-T project
 *   npx @tekyzinc/gsd-t status      — Show what's installed and check for updates
 *   npx @tekyzinc/gsd-t uninstall   — Remove GSD-T commands (leaves project files alone)
 *   npx @tekyzinc/gsd-t doctor      — Diagnose common issues
 *   npx @tekyzinc/gsd-t changelog   — Open changelog in the browser
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const readline = require("readline");
const { execFileSync, spawn: cpSpawn } = require("child_process");
let debugLedger;
try {
  debugLedger = require(path.join(__dirname, "debug-ledger.js"));
} catch (_) {
  debugLedger = {
    readLedger: () => [],
    appendEntry: () => {},
    getLedgerStats: () => ({ entryCount: 0, sizeBytes: 0, needsCompaction: false, failedHypotheses: [], passCount: 0, failCount: 0 }),
    clearLedger: () => {},
    compactLedger: () => {},
    generateAntiRepetitionPreamble: () => "",
  };
}

// ─── Configuration ───────────────────────────────────────────────────────────

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const COMMANDS_DIR = path.join(CLAUDE_DIR, "commands");
const SCRIPTS_DIR = path.join(CLAUDE_DIR, "scripts");
const GLOBAL_BIN_DIR = path.join(CLAUDE_DIR, "bin");
const CLAUDE_TEMPLATES_DIR = path.join(CLAUDE_DIR, "templates");
const GLOBAL_CLAUDE_MD = path.join(CLAUDE_DIR, "CLAUDE.md");
const SETTINGS_JSON = path.join(CLAUDE_DIR, "settings.json");
const VERSION_FILE = path.join(CLAUDE_DIR, ".gsd-t-version");
const PROJECTS_FILE = path.join(CLAUDE_DIR, ".gsd-t-projects");
const UPDATE_CHECK_FILE = path.join(CLAUDE_DIR, ".gsd-t-update-check");

// Where our package files live (relative to this script)
const PKG_ROOT = path.resolve(__dirname, "..");
const PKG_COMMANDS = path.join(PKG_ROOT, "commands");
const PKG_SCRIPTS = path.join(PKG_ROOT, "scripts");
const PKG_TEMPLATES = path.join(PKG_ROOT, "templates");

// Read our version from package.json
const PKG_VERSION = require(path.join(PKG_ROOT, "package.json")).version;
const CHANGELOG_URL = "https://github.com/Tekyz-Inc/get-stuff-done-teams/blob/main/CHANGELOG.md";

// Destructive Action Guard — injected into project CLAUDE.md files by doUpdateAll
const GUARD_SECTION = [
  "",
  "",
  "# Destructive Action Guard (MANDATORY)",
  "",
  "**NEVER perform destructive or structural changes without explicit user approval.** This applies at ALL autonomy levels.",
  "",
  "Before any of these actions, STOP and ask the user:",
  "- DROP TABLE, DROP COLUMN, DROP INDEX, TRUNCATE, DELETE without WHERE",
  "- Renaming or removing database tables or columns",
  "- Schema migrations that lose data or break existing queries",
  "- Replacing an existing architecture pattern (e.g., normalized → denormalized)",
  "- Removing or replacing existing files/modules that contain working functionality",
  "- Changing ORM models in ways that conflict with the existing database schema",
  "- Removing API endpoints or changing response shapes that existing clients depend on",
  "- Any change that would require other parts of the system to be rewritten",
  "",
  '**Rule: "Adapt new code to existing structures, not the other way around."**',
  "",
].join("\n");

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function log(msg) {
  console.log(msg);
}
function success(msg) {
  console.log(`${GREEN}  ✓${RESET} ${msg}`);
}
function warn(msg) {
  console.log(`${YELLOW}  ⚠${RESET} ${msg}`);
}
function error(msg) {
  console.log(`${RED}  ✗${RESET} ${msg}`);
}
function info(msg) {
  console.log(`${CYAN}  ℹ${RESET} ${msg}`);
}
function heading(msg) {
  console.log(`\n${BOLD}${msg}${RESET}`);
}
function link(text, url) {
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}
function versionLink(ver) {
  return link(`v${ver || PKG_VERSION}`, CHANGELOG_URL);
}

function ensureDir(dir) {
  if (hasSymlinkInPath(dir)) {
    warn(`Refusing to use path with symlinked component: ${dir}`);
    return false;
  }
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return true;
  }
  if (isSymlink(dir)) {
    warn(`Refusing to use symlinked directory: ${dir}`);
    return false;
  }
  return false;
}

function isSymlink(filePath) {
  try {
    return fs.lstatSync(filePath).isSymbolicLink();
  } catch {
    return false; // File doesn't exist yet — safe to write
  }
}

function hasSymlinkInPath(targetPath) {
  const resolved = path.resolve(targetPath);
  let current = path.dirname(resolved);
  const root = path.parse(resolved).root;
  while (current !== root) {
    if (isSymlink(current)) return true;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return false;
}

function validateProjectName(name) {
  return /^[a-zA-Z0-9][a-zA-Z0-9._\- ]{0,100}$/.test(name);
}

function applyTokens(content, projectName, date) {
  return content.replace(/\{Project Name\}/g, projectName).replace(/\{Date\}/g, date);
}

function normalizeEol(str) {
  return str.replace(/\r\n/g, "\n");
}

function validateVersion(ver) {
  return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(ver);
}

function validateProjectPath(p) {
  try {
    if (!path.isAbsolute(p) || !fs.existsSync(p)) return false;
    const stat = fs.statSync(p);
    if (!stat.isDirectory()) return false;
    // On Unix, verify directory is owned by current user (defense-in-depth)
    if (typeof process.getuid === "function" && stat.uid !== process.getuid()) return false;
    return true;
  } catch {
    return false;
  }
}

function copyFile(src, dest, label) {
  if (isSymlink(dest)) {
    warn(`Skipping symlink target: ${dest}`);
    return;
  }
  try {
    fs.copyFileSync(src, dest);
    success(label || path.basename(dest));
  } catch (e) {
    error(`Failed to copy ${label || path.basename(dest)}: ${e.message}`);
  }
}

// M50 D1: hasPlaywright migrated to bin/playwright-bootstrap.cjs.
// Re-exported here for back-compat with any caller still requiring it via
// bin/gsd-t.js. See .gsd-t/contracts/playwright-bootstrap-contract.md §3.
const {
  hasPlaywright,
  installPlaywright,
  detectPackageManager: _detectPlaywrightPackageManager,
} = require("./playwright-bootstrap.cjs");
const { hasUI } = require("./ui-detection.cjs");

function readProjectDeps(projectDir) {
  const pkgPath = path.join(projectDir, "package.json");
  if (!fs.existsSync(pkgPath)) return [];
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    return Object.keys(pkg.dependencies || {}).concat(Object.keys(pkg.devDependencies || {}));
  } catch { return []; }
}

function readPyContent(projectDir, filename) {
  const fp = path.join(projectDir, filename);
  if (!fs.existsSync(fp)) return "";
  try { return fs.readFileSync(fp, "utf8"); } catch { return ""; }
}

function hasSwagger(projectDir) {
  const specFiles = ["swagger.json", "swagger.yaml", "swagger.yml", "openapi.json", "openapi.yaml", "openapi.yml"];
  if (specFiles.some((f) => fs.existsSync(path.join(projectDir, f)))) return true;

  const swaggerPkgs = ["swagger-jsdoc", "swagger-ui-express", "@fastify/swagger", "@nestjs/swagger", "swagger-ui", "express-openapi-validator"];
  if (swaggerPkgs.some((p) => readProjectDeps(projectDir).includes(p))) return true;

  for (const f of ["requirements.txt", "pyproject.toml"]) {
    if (readPyContent(projectDir, f).includes("fastapi")) return true;
  }
  return false;
}

function hasApi(projectDir) {
  const apiFrameworks = ["express", "fastify", "hono", "koa", "hapi", "@nestjs/core", "next"];
  if (apiFrameworks.some((p) => readProjectDeps(projectDir).includes(p))) return true;

  for (const f of ["requirements.txt", "pyproject.toml"]) {
    const content = readPyContent(projectDir, f);
    if (content.includes("fastapi") || content.includes("flask") || content.includes("django")) return true;
  }
  return false;
}

function getInstalledVersion() {
  try {
    return fs.readFileSync(VERSION_FILE, "utf8").trim();
  } catch {
    return null;
  }
}

function saveInstalledVersion() {
  if (isSymlink(VERSION_FILE)) {
    warn("Skipping version write — target is a symlink");
    return;
  }
  try {
    fs.writeFileSync(VERSION_FILE, PKG_VERSION);
  } catch (e) {
    error(`Failed to save version file: ${e.message}`);
  }
}

function getRegisteredProjects() {
  try {
    const content = fs.readFileSync(PROJECTS_FILE, "utf8").trim();
    if (!content) return [];
    const lines = content.split("\n").map((l) => l.trim().split("|")[0].trim()).filter((l) => l && !l.startsWith("#"));
    return lines.filter((p) => {
      if (!validateProjectPath(p)) {
        warn(`Skipping invalid project path: ${p}`);
        return false;
      }
      return true;
    });
  } catch {
    return [];
  }
}

function registerProject(projectDir) {
  const resolved = path.resolve(projectDir);
  const projects = getRegisteredProjects();
  if (projects.includes(resolved)) return false;
  if (isSymlink(PROJECTS_FILE)) {
    warn("Skipping project registration — target is a symlink");
    return false;
  }
  try {
    projects.push(resolved);
    fs.writeFileSync(PROJECTS_FILE, projects.join("\n") + "\n");
    return true;
  } catch (e) {
    error(`Failed to register project: ${e.message}`);
    return false;
  }
}

function getCommandFiles() {
  // All .md files in our commands/ directory (gsd-t-* plus utilities like branch, checkin, Claude-md)
  return fs
    .readdirSync(PKG_COMMANDS)
    .filter((f) => f.endsWith(".md"));
}

function getGsdtCommands() {
  return getCommandFiles().filter((f) => f.startsWith("gsd-t-"));
}

function getUtilityCommands() {
  return getCommandFiles().filter((f) => !f.startsWith("gsd-t-"));
}

function getInstalledCommands() {
  try {
    const ourCommands = getCommandFiles();
    return fs
      .readdirSync(COMMANDS_DIR)
      .filter((f) => ourCommands.includes(f));
  } catch {
    return [];
  }
}

// ─── Heartbeat ──────────────────────────────────────────────────────────────

const HEARTBEAT_SCRIPT = "gsd-t-heartbeat.js";
const HEARTBEAT_HOOKS = [
  "SessionStart", "PostToolUse", "SubagentStart", "SubagentStop",
  "TaskCompleted", "TeammateIdle", "Notification", "Stop", "SessionEnd"
];

function installHeartbeat() {
  ensureDir(SCRIPTS_DIR);

  // Copy heartbeat script
  const src = path.join(PKG_SCRIPTS, HEARTBEAT_SCRIPT);
  const dest = path.join(SCRIPTS_DIR, HEARTBEAT_SCRIPT);

  if (!fs.existsSync(src)) {
    warn("Heartbeat script not found in package — skipping");
    return;
  }

  const srcContent = fs.readFileSync(src, "utf8");
  const destContent = fs.existsSync(dest) ? fs.readFileSync(dest, "utf8") : "";

  if (normalizeEol(srcContent) !== normalizeEol(destContent)) {
    copyFile(src, dest, HEARTBEAT_SCRIPT);
  } else {
    info("Heartbeat script unchanged");
  }

  // Configure hooks in settings.json
  const hooksAdded = configureHeartbeatHooks(dest);
  if (hooksAdded > 0) {
    success(`${hooksAdded} heartbeat hooks configured in settings.json`);
  } else {
    info("Heartbeat hooks already configured");
  }
}

function configureHeartbeatHooks(scriptPath) {
  const parsed = readSettingsJson();
  if (parsed === null && fs.existsSync(SETTINGS_JSON)) {
    warn("settings.json has invalid JSON — cannot configure hooks");
    return 0;
  }
  const settings = parsed || {};

  if (!settings.hooks) settings.hooks = {};
  const cmd = `node "${scriptPath.replace(/\\/g, "\\\\")}"`;
  let added = 0;

  for (const event of HEARTBEAT_HOOKS) {
    if (addHeartbeatHook(settings.hooks, event, cmd)) added++;
  }

  if (added > 0 && !isSymlink(SETTINGS_JSON)) {
    fs.writeFileSync(SETTINGS_JSON, JSON.stringify(settings, null, 2));
  } else if (added > 0) {
    warn("Skipping settings.json write — target is a symlink");
  }
  return added;
}

function addHeartbeatHook(hooks, event, cmd) {
  if (!hooks[event]) hooks[event] = [];
  const hasHeartbeat = hooks[event].some((entry) =>
    entry.hooks && entry.hooks.some((h) => h.command && h.command.includes(HEARTBEAT_SCRIPT))
  );
  if (hasHeartbeat) return false;
  hooks[event].push({ matcher: "", hooks: [{ type: "command", command: cmd, async: true }] });
  return true;
}

// ─── Context Meter ──────────────────────────────────────────────────────────

const CONTEXT_METER_SCRIPT = "gsd-t-context-meter.js";
const CONTEXT_METER_DEPS_DIR = "context-meter";
const CONTEXT_METER_CONFIG_TEMPLATE = "context-meter-config.json";
const CONTEXT_METER_CONFIG_DEST = path.join(".gsd-t", "context-meter-config.json");
const CONTEXT_METER_GITIGNORE_ENTRIES = [
  ".gsd-t/.context-meter-state.json",
  ".gsd-t/context-meter.log",
];
const CONTEXT_METER_HOOK_MARKER = "gsd-t-context-meter";
// Canonical global hook — runs the script from the globally-installed npm package.
// Guarded so it silently exits 0 if the package is not present (non-GSD-T projects).
const CONTEXT_METER_HOOK_COMMAND =
  'bash -c \'[ -f "$(npm root -g)/@tekyzinc/gsd-t/scripts/gsd-t-context-meter.js" ] && node "$(npm root -g)/@tekyzinc/gsd-t/scripts/gsd-t-context-meter.js" || true\'';
// Legacy command patterns that must be migrated on install/update/init.
const CONTEXT_METER_STALE_PATTERNS = [
  /node\s+"?\$CLAUDE_PROJECT_DIR\/scripts\/gsd-t-context-meter\.js"?/,
];

// Append entries to {projectDir}/.gitignore. Each entry added only if absent.
// Idempotent. Returns true if any entries were added, false otherwise.
function ensureGitignoreEntries(projectDir, entries) {
  const gitignorePath = path.join(projectDir, ".gitignore");
  if (isSymlink(gitignorePath)) {
    warn("Skipping .gitignore — target is a symlink");
    return false;
  }
  let content = "";
  try {
    if (fs.existsSync(gitignorePath)) {
      content = fs.readFileSync(gitignorePath, "utf8");
    }
  } catch (e) {
    warn(`Failed to read .gitignore: ${e.message}`);
    return false;
  }
  const existingLines = new Set(
    content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  );
  const toAdd = entries.filter((e) => !existingLines.has(e));
  if (toAdd.length === 0) return false;
  try {
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, toAdd.join("\n") + "\n");
    } else {
      const prefix = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
      const block =
        "\n# GSD-T context meter (session state — do not commit)\n" +
        toAdd.join("\n") +
        "\n";
      fs.appendFileSync(gitignorePath, prefix + block);
    }
    return true;
  } catch (e) {
    warn(`Failed to append to .gitignore: ${e.message}`);
    return false;
  }
}

// Install the Context Meter into a project directory.
// Copies scripts/gsd-t-context-meter.js, scripts/context-meter/*.js (runtime
// only — skips .test.js), and the config template (if missing). Also appends
// entries to .gitignore.
function installContextMeter(projectDir) {
  try {
    // 1. Copy gsd-t-context-meter.js → {projectDir}/scripts/
    const projectScriptsDir = path.join(projectDir, "scripts");
    if (!fs.existsSync(projectScriptsDir)) {
      try {
        fs.mkdirSync(projectScriptsDir, { recursive: true });
      } catch (e) {
        warn(`Failed to create scripts/: ${e.message}`);
        return false;
      }
    }
    const scriptSrc = path.join(PKG_SCRIPTS, CONTEXT_METER_SCRIPT);
    const scriptDest = path.join(projectScriptsDir, CONTEXT_METER_SCRIPT);
    if (!fs.existsSync(scriptSrc)) {
      warn(`${CONTEXT_METER_SCRIPT} not found in package — skipping context meter`);
      return false;
    }
    if (!isSymlink(scriptDest)) {
      const srcContent = fs.readFileSync(scriptSrc, "utf8");
      const destContent = fs.existsSync(scriptDest)
        ? fs.readFileSync(scriptDest, "utf8")
        : "";
      if (normalizeEol(srcContent) !== normalizeEol(destContent)) {
        fs.copyFileSync(scriptSrc, scriptDest);
        try {
          fs.chmodSync(scriptDest, 0o755);
        } catch {}
      }
    }

    // 2. Copy scripts/context-meter/*.js (runtime files only)
    const depsSrcDir = path.join(PKG_SCRIPTS, CONTEXT_METER_DEPS_DIR);
    const depsDestDir = path.join(projectScriptsDir, CONTEXT_METER_DEPS_DIR);
    if (fs.existsSync(depsSrcDir)) {
      if (!fs.existsSync(depsDestDir)) {
        try {
          fs.mkdirSync(depsDestDir, { recursive: true });
        } catch (e) {
          warn(`Failed to create scripts/${CONTEXT_METER_DEPS_DIR}/: ${e.message}`);
          return false;
        }
      }
      let depFiles = [];
      try {
        depFiles = fs.readdirSync(depsSrcDir);
      } catch (e) {
        warn(`Failed to read ${CONTEXT_METER_DEPS_DIR}/: ${e.message}`);
        return false;
      }
      for (const fname of depFiles) {
        if (fname.includes(".test.")) continue;
        const fsrc = path.join(depsSrcDir, fname);
        const fdest = path.join(depsDestDir, fname);
        try {
          const stat = fs.statSync(fsrc);
          if (!stat.isFile()) continue;
        } catch {
          continue;
        }
        if (isSymlink(fdest)) continue;
        try {
          const srcContent = fs.readFileSync(fsrc, "utf8");
          const destContent = fs.existsSync(fdest)
            ? fs.readFileSync(fdest, "utf8")
            : "";
          if (normalizeEol(srcContent) !== normalizeEol(destContent)) {
            fs.copyFileSync(fsrc, fdest);
          }
        } catch (e) {
          warn(`Failed to copy ${CONTEXT_METER_DEPS_DIR}/${fname}: ${e.message}`);
        }
      }
    }

    // 3. Copy config template → {projectDir}/.gsd-t/context-meter-config.json
    //    ONLY if the destination does not already exist (never overwrite user config).
    const configSrc = path.join(PKG_TEMPLATES, CONTEXT_METER_CONFIG_TEMPLATE);
    const configDest = path.join(projectDir, CONTEXT_METER_CONFIG_DEST);
    const gsdtDir = path.dirname(configDest);
    if (!fs.existsSync(gsdtDir)) {
      try {
        fs.mkdirSync(gsdtDir, { recursive: true });
      } catch (e) {
        warn(`Failed to create .gsd-t/: ${e.message}`);
      }
    }
    if (fs.existsSync(configSrc) && !fs.existsSync(configDest)) {
      if (!isSymlink(configDest)) {
        try {
          fs.copyFileSync(configSrc, configDest);
        } catch (e) {
          warn(`Failed to copy context-meter-config.json: ${e.message}`);
        }
      }
    }

    // 4. Append .gitignore entries
    ensureGitignoreEntries(projectDir, CONTEXT_METER_GITIGNORE_ENTRIES);

    return true;
  } catch (e) {
    warn(`installContextMeter failed: ${e.message}`);
    return false;
  }
}

// Register the Context Meter PostToolUse hook in ~/.claude/settings.json.
// Opt-in pre-commit hook installer (M41 D5). Appends the capture-lint block
// to .git/hooks/pre-commit; if the file doesn't exist, copies our stock
// script. Never overwrites an existing hook.
const CAPTURE_LINT_HOOK_MARKER = "# GSD-T capture lint";
// M50 D2 — Playwright pre-commit gate marker. Installed via
// `gsd-t doctor --install-hooks`. Idempotent: appends a delimited block to
// `.git/hooks/pre-commit` if the marker isn't already present.
const PLAYWRIGHT_GATE_HOOK_MARKER = "# GSD-T playwright gate";

function installPlaywrightGateHook(projectDir) {
  const gitDir = path.join(projectDir, ".git");
  if (!fs.existsSync(gitDir)) {
    warn("No .git directory — not a git repo; skipping playwright-gate install");
    return false;
  }
  const hooksDir = path.join(gitDir, "hooks");
  try { fs.mkdirSync(hooksDir, { recursive: true }); } catch (_) {}
  const hookPath = path.join(hooksDir, "pre-commit");
  const stockSrc = path.join(PKG_ROOT, "scripts", "hooks", "pre-commit-playwright-gate");
  let stock = "";
  try { stock = fs.readFileSync(stockSrc, "utf8"); } catch (_) {
    warn("Could not read pre-commit-playwright-gate script from package");
    return false;
  }
  if (!fs.existsSync(hookPath)) {
    fs.writeFileSync(hookPath, stock);
    try { fs.chmodSync(hookPath, 0o755); } catch (_) {}
    success(`Playwright gate installed at ${path.relative(projectDir, hookPath)}`);
    info("The hook reads .gsd-t/.last-playwright-pass to gate viewer-source commits");
    return true;
  }
  const existing = fs.readFileSync(hookPath, "utf8");
  if (existing.includes(PLAYWRIGHT_GATE_HOOK_MARKER)) {
    info("Playwright-gate block already present in pre-commit hook — no change");
    return true;
  }
  const appended = existing.trimEnd() +
    "\n\n" + PLAYWRIGHT_GATE_HOOK_MARKER + "\n" +
    stock.replace(/^#!.*\n/, "") + "\n";
  fs.writeFileSync(hookPath, appended);
  try { fs.chmodSync(hookPath, 0o755); } catch (_) {}
  success(`Playwright-gate block appended to ${path.relative(projectDir, hookPath)}`);
  return true;
}

function installCaptureLintHook(projectDir) {
  const gitDir = path.join(projectDir, ".git");
  if (!fs.existsSync(gitDir)) {
    warn("No .git directory — not a git repo; skipping hook install");
    return false;
  }
  const hooksDir = path.join(gitDir, "hooks");
  try { fs.mkdirSync(hooksDir, { recursive: true }); } catch (_) {}
  const hookPath = path.join(hooksDir, "pre-commit");
  const stockSrc = path.join(PKG_ROOT, "scripts", "hooks", "pre-commit-capture-lint");
  let stock = "";
  try { stock = fs.readFileSync(stockSrc, "utf8"); } catch (_) {
    warn("Could not read pre-commit-capture-lint script from package");
    return false;
  }

  if (!fs.existsSync(hookPath)) {
    fs.writeFileSync(hookPath, stock);
    try { fs.chmodSync(hookPath, 0o755); } catch (_) {}
    success(`Hook installed at ${path.relative(projectDir, hookPath)}`);
    info("Test with: gsd-t capture-lint --staged");
    return true;
  }

  const existing = fs.readFileSync(hookPath, "utf8");
  if (existing.includes(CAPTURE_LINT_HOOK_MARKER)) {
    info("Capture-lint block already present in pre-commit hook — no change");
    return true;
  }

  const appended = existing.trimEnd() +
    "\n\n" + CAPTURE_LINT_HOOK_MARKER + "\n" +
    stock.replace(/^#!.*\n/, "") + "\n";
  fs.writeFileSync(hookPath, appended);
  try { fs.chmodSync(hookPath, 0o755); } catch (_) {}
  success(`Capture-lint block appended to ${path.relative(projectDir, hookPath)}`);
  info("Test with: gsd-t capture-lint --staged");
  return true;
}

// M52 D1 — journey-coverage gate hook installer. Block-delimited so uninstall
// is a clean string excise. Stock script lives at scripts/hooks/pre-commit-journey-coverage.
const JOURNEY_COVERAGE_HOOK_BEGIN = "# >>> GSD-T journey-coverage gate >>>";
const JOURNEY_COVERAGE_HOOK_END = "# <<< GSD-T journey-coverage gate <<<";

function installJourneyCoverageHook(projectDir) {
  const gitDir = path.join(projectDir, ".git");
  if (!fs.existsSync(gitDir)) { warn("No .git directory — skipping journey-coverage hook install"); return false; }
  const hooksDir = path.join(gitDir, "hooks");
  try { fs.mkdirSync(hooksDir, { recursive: true }); } catch (_) {}
  const hookPath = path.join(hooksDir, "pre-commit");
  const stockSrc = path.join(PKG_ROOT, "scripts", "hooks", "pre-commit-journey-coverage");
  let stock;
  try { stock = fs.readFileSync(stockSrc, "utf8"); } catch (_) { warn("Could not read pre-commit-journey-coverage script"); return false; }
  const block = JOURNEY_COVERAGE_HOOK_BEGIN + "\n" + stock.replace(/^#!.*\n/, "") + "\n" + JOURNEY_COVERAGE_HOOK_END + "\n";
  if (!fs.existsSync(hookPath)) {
    fs.writeFileSync(hookPath, "#!/usr/bin/env bash\nset -e\n\n" + block);
    try { fs.chmodSync(hookPath, 0o755); } catch (_) {}
    success(`Journey-coverage gate installed at ${path.relative(projectDir, hookPath)}`);
    return true;
  }
  const existing = fs.readFileSync(hookPath, "utf8");
  if (existing.includes(JOURNEY_COVERAGE_HOOK_BEGIN)) { info("Journey-coverage block already present — no change"); return true; }
  fs.writeFileSync(hookPath, existing.trimEnd() + "\n\n" + block);
  try { fs.chmodSync(hookPath, 0o755); } catch (_) {}
  success(`Journey-coverage block appended to ${path.relative(projectDir, hookPath)}`);
  return true;
}

// Idempotent — if an existing hook references CONTEXT_METER_HOOK_MARKER the
// command string is refreshed/migrated in-place to the canonical form.
// Stale entries matching CONTEXT_METER_STALE_PATTERNS are migrated on the spot.
// All other settings/hooks are preserved.
// Returns { installed: bool, action: "added"|"updated"|"noop" }.
function configureContextMeterHooks(settingsPath) {
  const targetPath = settingsPath || SETTINGS_JSON;
  let settings = {};
  const fileExists = fs.existsSync(targetPath);
  if (fileExists) {
    try {
      settings = JSON.parse(fs.readFileSync(targetPath, "utf8"));
      if (!settings || typeof settings !== "object") settings = {};
    } catch {
      warn("settings.json has invalid JSON — cannot configure context meter hook");
      return { installed: false, action: "noop" };
    }
  }

  if (!settings.hooks) settings.hooks = {};
  if (!Array.isArray(settings.hooks.PostToolUse)) settings.hooks.PostToolUse = [];

  const cmd = CONTEXT_METER_HOOK_COMMAND;
  let action = "noop";
  let found = false;

  for (const entry of settings.hooks.PostToolUse) {
    if (!entry || !Array.isArray(entry.hooks)) continue;
    for (const h of entry.hooks) {
      if (!h || typeof h.command !== "string") continue;
      const isCurrentCanonical = h.command === cmd;
      const isMarkerMatch = h.command.includes(CONTEXT_METER_HOOK_MARKER);
      const isStaleMatch = !isCurrentCanonical &&
        CONTEXT_METER_STALE_PATTERNS.some((re) => re.test(h.command));

      if (isCurrentCanonical || isMarkerMatch || isStaleMatch) {
        found = true;
        if (!isCurrentCanonical) {
          h.command = cmd;
          action = "updated";
        }
      }
    }
  }

  if (!found) {
    settings.hooks.PostToolUse.push({
      matcher: "*",
      hooks: [{ type: "command", command: cmd }],
    });
    action = "added";
  }

  if (action === "noop") {
    return { installed: true, action: "noop" };
  }

  if (isSymlink(targetPath)) {
    warn("Skipping settings.json write — target is a symlink");
    return { installed: false, action: "noop" };
  }
  try {
    fs.writeFileSync(targetPath, JSON.stringify(settings, null, 2));
  } catch (e) {
    warn(`Failed to write settings.json: ${e.message}`);
    return { installed: false, action: "noop" };
  }
  return { installed: true, action };
}

// Remove any context meter PostToolUse hooks from settings.json.
// Used during uninstall. Leaves all other hooks intact.
function removeContextMeterHook(settingsPath) {
  const targetPath = settingsPath || SETTINGS_JSON;
  if (!fs.existsSync(targetPath)) return false;
  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(targetPath, "utf8"));
    if (!settings || typeof settings !== "object") return false;
  } catch {
    warn("settings.json has invalid JSON — cannot remove context meter hook");
    return false;
  }

  if (!settings.hooks || !Array.isArray(settings.hooks.PostToolUse)) return false;

  const before = settings.hooks.PostToolUse.length;
  settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter((entry) => {
    if (!entry || !Array.isArray(entry.hooks)) return true;
    // Keep the entry only if NONE of its hooks reference the context meter
    return !entry.hooks.some(
      (h) => h && typeof h.command === "string" && h.command.includes(CONTEXT_METER_HOOK_MARKER)
    );
  });
  const removed = before - settings.hooks.PostToolUse.length;
  if (removed === 0) return false;

  if (isSymlink(targetPath)) {
    warn("Skipping settings.json write — target is a symlink");
    return false;
  }
  try {
    fs.writeFileSync(targetPath, JSON.stringify(settings, null, 2));
    return true;
  } catch (e) {
    warn(`Failed to write settings.json: ${e.message}`);
    return false;
  }
}

// Interactive prompt for the Anthropic API key env var.
// Skips if not a TTY or if the env var is already set.
// Never writes the key anywhere — just prints the export command for the user
// to paste into their shell profile themselves. Always non-blocking.
async function promptForApiKeyIfMissing(envVarName) {
  const varName = envVarName || "ANTHROPIC_API_KEY";
  if (!process.stdout.isTTY || !process.stdin.isTTY) return "";
  if (process.env[varName]) return process.env[varName];

  heading("Context Meter — Anthropic API Key");
  log("");
  log(`  ${YELLOW}⚠${RESET}  Context Meter: ${varName} is not set.`);
  log(`     The hook uses Anthropic's count_tokens API (free, not billed) to measure`);
  log(`     real context window usage. Without it, the meter falls back to heuristics.`);
  log(`     Get a key: https://console.anthropic.com/settings/keys`);
  log("");

  let rl;
  try {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  } catch (e) {
    warn(`Could not open API key prompt: ${e.message}`);
    return "";
  }

  return new Promise((resolve) => {
    try {
      rl.question("  Paste key now, or press Enter to skip: ", (answer) => {
        try {
          const key = (answer || "").trim();
          if (key.length === 0) {
            log("");
            info(`Skipped. Set ${varName} later or run 'gsd-t doctor' to re-check.`);
            log("");
          } else {
            log("");
            success("Got it. Add this line to your shell profile (~/.zshrc or ~/.bashrc):");
            log("");
            log(`    ${DIM}export ${varName}="${key}"${RESET}`);
            log("");
            log("  Re-open your shell or run the export command to activate.");
            log("");
          }
          resolve(key);
        } finally {
          try { rl.close(); } catch {}
        }
      });
    } catch (e) {
      warn(`API key prompt failed: ${e.message}`);
      try { rl.close(); } catch {}
      resolve("");
    }
  });
}

// Resolve the apiKeyEnvVar from the project's context-meter-config.json
// Falls back to "ANTHROPIC_API_KEY" if loader unavailable or config absent.
function resolveApiKeyEnvVar(projectDir) {
  try {
    const loader = require(path.join(PKG_ROOT, "bin", "context-meter-config.cjs"));
    if (loader && typeof loader.loadConfig === "function") {
      const cfg = loader.loadConfig(projectDir || process.cwd());
      if (cfg && typeof cfg.apiKeyEnvVar === "string" && cfg.apiKeyEnvVar.length > 0) {
        return cfg.apiKeyEnvVar;
      }
    }
  } catch {
    // Fall through to default
  }
  return "ANTHROPIC_API_KEY";
}

// ─── Update Check Hook ──────────────────────────────────────────────────────

const UPDATE_CHECK_SCRIPT = "gsd-t-update-check.js";

function installUpdateCheck() {
  ensureDir(SCRIPTS_DIR);

  // Copy update check script
  const src = path.join(PKG_SCRIPTS, UPDATE_CHECK_SCRIPT);
  const dest = path.join(SCRIPTS_DIR, UPDATE_CHECK_SCRIPT);

  if (!fs.existsSync(src)) {
    warn("Update check script not found in package — skipping");
    return;
  }

  const srcContent = fs.readFileSync(src, "utf8");
  const destContent = fs.existsSync(dest) ? fs.readFileSync(dest, "utf8") : "";

  if (normalizeEol(srcContent) !== normalizeEol(destContent)) {
    copyFile(src, dest, UPDATE_CHECK_SCRIPT);
  } else {
    info("Update check script unchanged");
  }

  // Configure SessionStart hook in settings.json
  configureUpdateCheckHook(dest);
}

function configureUpdateCheckHook(scriptPath) {
  let settings = {};
  if (fs.existsSync(SETTINGS_JSON)) {
    try {
      settings = JSON.parse(fs.readFileSync(SETTINGS_JSON, "utf8"));
    } catch {
      warn("settings.json has invalid JSON — cannot configure update check hook");
      return;
    }
  }

  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.SessionStart) settings.hooks.SessionStart = [];

  const cmd = `node "${scriptPath.replace(/\\/g, "\\\\")}"`;

  // Check if update check hook already exists
  const hasUpdateCheck = settings.hooks.SessionStart.some((entry) =>
    entry.hooks && entry.hooks.some((h) => h.command && h.command.includes(UPDATE_CHECK_SCRIPT))
  );

  if (hasUpdateCheck) {
    // Fix matcher if it's not empty string (bug fix — "startup" doesn't match all sessions)
    let fixed = false;
    for (const entry of settings.hooks.SessionStart) {
      if (entry.hooks && entry.hooks.some((h) => h.command && h.command.includes(UPDATE_CHECK_SCRIPT))) {
        if (entry.matcher !== "") {
          entry.matcher = "";
          fixed = true;
        }
      }
    }
    if (fixed) {
      if (!isSymlink(SETTINGS_JSON)) {
        fs.writeFileSync(SETTINGS_JSON, JSON.stringify(settings, null, 2));
      }
      success("Fixed update check hook matcher");
    } else {
      info("Update check hook already configured");
    }
  } else {
    // Add new hook — synchronous (not async) so output is available before Claude responds
    settings.hooks.SessionStart.unshift({
      matcher: "",
      hooks: [{ type: "command", command: cmd }],
    });
    if (!isSymlink(SETTINGS_JSON)) {
      fs.writeFileSync(SETTINGS_JSON, JSON.stringify(settings, null, 2));
    }
    success("Update check hook configured");
  }
}

// ─── Auto-Route Hook ─────────────────────────────────────────────────────────

const AUTO_ROUTE_SCRIPT = "gsd-t-auto-route.js";

function installAutoRoute() {
  ensureDir(SCRIPTS_DIR);

  const src = path.join(PKG_SCRIPTS, AUTO_ROUTE_SCRIPT);
  const dest = path.join(SCRIPTS_DIR, AUTO_ROUTE_SCRIPT);

  if (!fs.existsSync(src)) {
    warn("Auto-route script not found in package — skipping");
    return;
  }

  const srcContent = fs.readFileSync(src, "utf8");
  const destContent = fs.existsSync(dest) ? fs.readFileSync(dest, "utf8") : "";

  if (normalizeEol(srcContent) !== normalizeEol(destContent)) {
    copyFile(src, dest, AUTO_ROUTE_SCRIPT);
  } else {
    info("Auto-route script unchanged");
  }

  configureAutoRouteHook(dest);
}

function configureAutoRouteHook(scriptPath) {
  const parsed = readSettingsJson();
  if (parsed === null && fs.existsSync(SETTINGS_JSON)) {
    warn("settings.json has invalid JSON — cannot configure auto-route hook");
    return;
  }
  const settings = parsed || {};
  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.UserPromptSubmit) settings.hooks.UserPromptSubmit = [];

  const cmd = `node "${scriptPath.replace(/\\/g, "\\\\")}"`;
  const hasAutoRoute = settings.hooks.UserPromptSubmit.some((entry) =>
    entry.hooks && entry.hooks.some((h) => h.command && h.command.includes(AUTO_ROUTE_SCRIPT))
  );

  if (hasAutoRoute) {
    info("Auto-route hook already configured");
    return;
  }

  settings.hooks.UserPromptSubmit.push({
    matcher: "",
    hooks: [{ type: "command", command: cmd }],
  });

  if (!isSymlink(SETTINGS_JSON)) {
    fs.writeFileSync(SETTINGS_JSON, JSON.stringify(settings, null, 2));
    success("Auto-route hook configured in settings.json");
  } else {
    warn("Skipping settings.json write — target is a symlink");
  }
}

// ─── In-Session Hooks (M43 D1 token usage + M45 D2 conversation capture) ────

const HOOKS_DIR = path.join(SCRIPTS_DIR, "hooks");
const PKG_HOOKS = path.join(PKG_SCRIPTS, "hooks");

// Each entry: { script, events, async } — `events` is the array of hook event
// names this script must be wired into. The `gsd-t-conversation-capture.js`
// hook runs on SessionStart, UserPromptSubmit, and Stop (per the global
// CLAUDE.md M45 D2 install block — PostToolUse stays opt-in via the
// GSD_T_CAPTURE_TOOL_USES env flag, so we don't auto-register it).
// `gsd-t-in-session-usage-hook.js` runs on Stop (per M43 D1 contract).
const IN_SESSION_HOOKS = [
  {
    script: "gsd-t-conversation-capture.js",
    events: ["SessionStart", "UserPromptSubmit", "Stop"],
    async: true,
  },
  {
    script: "gsd-t-in-session-usage-hook.js",
    events: ["Stop"],
    async: true,
  },
];

function installInSessionHooks() {
  ensureDir(SCRIPTS_DIR);
  ensureDir(HOOKS_DIR);

  if (!fs.existsSync(PKG_HOOKS)) {
    info("No scripts/hooks/ in package — skipping in-session hooks");
    return;
  }

  // Copy each script into ~/.claude/scripts/hooks/
  for (const hook of IN_SESSION_HOOKS) {
    const src = path.join(PKG_HOOKS, hook.script);
    const dest = path.join(HOOKS_DIR, hook.script);
    if (!fs.existsSync(src)) {
      warn(`In-session hook source missing: ${hook.script} — skipping`);
      continue;
    }
    const srcContent = fs.readFileSync(src, "utf8");
    const destContent = fs.existsSync(dest) ? fs.readFileSync(dest, "utf8") : "";
    if (normalizeEol(srcContent) !== normalizeEol(destContent)) {
      copyFile(src, dest, `hooks/${hook.script}`);
      try { fs.chmodSync(dest, 0o755); } catch {}
    } else {
      info(`In-session hook unchanged: ${hook.script}`);
    }
  }

  configureInSessionHooks();
}

function configureInSessionHooks() {
  const parsed = readSettingsJson();
  if (parsed === null && fs.existsSync(SETTINGS_JSON)) {
    warn("settings.json has invalid JSON — cannot configure in-session hooks");
    return;
  }
  const settings = parsed || {};
  if (!settings.hooks) settings.hooks = {};

  let added = 0;
  for (const hook of IN_SESSION_HOOKS) {
    const scriptPath = path.join(HOOKS_DIR, hook.script);
    const cmd = `node "${scriptPath.replace(/\\/g, "\\\\")}"`;

    for (const event of hook.events) {
      if (!settings.hooks[event]) settings.hooks[event] = [];
      const already = settings.hooks[event].some((entry) =>
        entry.hooks && entry.hooks.some((h) => h.command && h.command.includes(hook.script))
      );
      if (already) continue;
      const hookEntry = { type: "command", command: cmd };
      if (hook.async) hookEntry.async = true;
      settings.hooks[event].push({
        matcher: "",
        hooks: [hookEntry],
      });
      added++;
    }
  }

  if (added === 0) {
    info("In-session hooks already configured");
    return;
  }
  if (isSymlink(SETTINGS_JSON)) {
    warn("Skipping settings.json write — target is a symlink");
    return;
  }
  try {
    fs.writeFileSync(SETTINGS_JSON, JSON.stringify(settings, null, 2));
    success(`${added} in-session hook entr${added === 1 ? "y" : "ies"} configured in settings.json`);
  } catch (e) {
    warn(`Failed to write settings.json: ${e.message}`);
  }
}

// ─── Figma MCP ──────────────────────────────────────────────────────────────

const FIGMA_MCP_URL = "https://mcp.figma.com/mcp";
const CLAUDE_JSON = path.join(os.homedir(), ".claude.json");

function configureFigmaMcp() {
  // Check ~/.claude.json (where `claude mcp add` stores servers)
  try {
    if (fs.existsSync(CLAUDE_JSON)) {
      const cj = JSON.parse(fs.readFileSync(CLAUDE_JSON, "utf8"));
      if (cj.mcpServers && cj.mcpServers.figma) {
        info("Figma MCP already configured");
        return;
      }
    }
  } catch { /* ignore parse errors */ }

  // Also check settings.json (legacy location)
  const settings = readSettingsJson() || {};
  if (settings.mcpServers && settings.mcpServers.figma) {
    info("Figma MCP already configured (settings.json)");
    return;
  }

  // Add via `claude mcp add` for proper OAuth registration
  try {
    execFileSync("claude", ["mcp", "add", "--transport", "http", "-s", "user", "figma", FIGMA_MCP_URL], {
      encoding: "utf8",
      timeout: 10000,
    });
    success("Figma MCP configured (remote: " + FIGMA_MCP_URL + ")");
    info("Authenticate with Figma on next session start (browser OAuth)");
  } catch {
    warn("Could not auto-configure Figma MCP — add manually:");
    log(`  ${DIM}$${RESET} claude mcp add --transport http -s user figma ${FIGMA_MCP_URL}`);
  }
}

// ─── Utility Scripts ─────────────────────────────────────────────────────────

const UTILITY_SCRIPTS = ["gsd-t-tools.js", "gsd-t-statusline.js", "gsd-t-event-writer.js"];

function installUtilityScripts() {
  ensureDir(SCRIPTS_DIR);
  for (const script of UTILITY_SCRIPTS) {
    const src = path.join(PKG_SCRIPTS, script);
    const dest = path.join(SCRIPTS_DIR, script);
    if (!fs.existsSync(src)) continue;
    const srcContent = fs.readFileSync(src, "utf8");
    const destContent = fs.existsSync(dest) ? fs.readFileSync(dest, "utf8") : "";
    if (normalizeEol(srcContent) !== normalizeEol(destContent)) {
      copyFile(src, dest, script);
    } else {
      info(`${script} unchanged`);
    }
  }
}

// ─── Global Bin Tools (~/.claude/bin/) ───────────────────────────────────────
// Modules resolved by globally-installed scripts via
// `path.join(__dirname, "..", "bin", <tool>)` (e.g. gsd-t-dashboard-server.js
// → parallelism-report.cjs). Distinct from PROJECT_BIN_TOOLS, which copy into
// each registered project's bin/.
const GLOBAL_BIN_TOOLS = [
  "parallelism-report.cjs",
  "live-activity-report.cjs",
  // M55 D5 — preflight + brief + verify-gate dispatch targets propagated to ~/.claude/bin/.
  "cli-preflight.cjs",
  "gsd-t-context-brief.cjs",
  "gsd-t-verify-gate.cjs",
  "gsd-t-verify-gate-judge.cjs",
  // M55 D2 substrate — parallel-cli engine (added v3.25.11 patch — missed in initial M55 D5 wire-in).
  "parallel-cli.cjs",
  // M57 — CI-parity verify-gate checks (structural build-coverage + containment-safe ci-parity).
  "gsd-t-build-coverage.cjs",
  "gsd-t-ci-parity.cjs",
];

function installGlobalBinTools() {
  ensureDir(GLOBAL_BIN_DIR);
  for (const tool of GLOBAL_BIN_TOOLS) {
    const src = path.join(PKG_ROOT, "bin", tool);
    const dest = path.join(GLOBAL_BIN_DIR, tool);
    if (!fs.existsSync(src)) {
      warn(`Global bin tool source missing: ${tool} — skipping`);
      continue;
    }
    const srcContent = fs.readFileSync(src, "utf8");
    const destContent = fs.existsSync(dest) ? fs.readFileSync(dest, "utf8") : "";
    if (normalizeEol(srcContent) !== normalizeEol(destContent)) {
      copyFile(src, dest, `bin/${tool}`);
      try { fs.chmodSync(dest, 0o755); } catch {}
    } else {
      info(`bin/${tool} unchanged`);
    }
  }
}

// ─── CGC (CodeGraphContext) ──────────────────────────────────────────────────

function installCgc() {
  // Check Python availability
  let pythonCmd = null;
  for (const cmd of ["python3", "python"]) {
    try {
      const ver = execFileSync(cmd, ["--version"], {
        encoding: "utf8", timeout: 3000,
        stdio: ["pipe", "pipe", "pipe"]
      }).trim();
      const major = parseInt((ver.match(/(\d+)\.\d+/) || [])[1]);
      if (major >= 3) { pythonCmd = cmd; break; }
    } catch { /* try next */ }
  }

  if (!pythonCmd) {
    warn("Python 3 not found — CGC graph engine skipped");
    info("Install Python 3.10+ to enable deep code graph analysis");
    return;
  }

  // Check if CGC is already installed
  let cgcInstalled = false;
  try {
    execFileSync("cgc", ["--version"], {
      encoding: "utf8", timeout: 3000,
      stdio: ["pipe", "pipe", "pipe"]
    });
    cgcInstalled = true;
  } catch { /* not installed */ }

  if (!cgcInstalled) {
    info("Installing CodeGraphContext...");
    try {
      execFileSync(pythonCmd, ["-m", "pip", "install", "codegraphcontext"], {
        encoding: "utf8", timeout: 120000,
        stdio: ["pipe", "pipe", "pipe"]
      });
      success("CodeGraphContext installed");
    } catch (e) {
      warn("CGC install failed — graph engine will use native-only mode");
      info("To install manually: pip install codegraphcontext");
      return;
    }
  } else {
    // Check for update
    try {
      const pipOut = execFileSync(pythonCmd, [
        "-m", "pip", "install", "--upgrade", "--dry-run", "codegraphcontext"
      ], {
        encoding: "utf8", timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"]
      });
      if (pipOut.includes("Would install")) {
        info("Updating CodeGraphContext...");
        execFileSync(pythonCmd, [
          "-m", "pip", "install", "--upgrade", "codegraphcontext"
        ], {
          encoding: "utf8", timeout: 120000,
          stdio: ["pipe", "pipe", "pipe"]
        });
        success("CodeGraphContext updated");
      } else {
        info("CodeGraphContext up to date");
      }
    } catch {
      info("CodeGraphContext already installed (update check skipped)");
    }
  }

  // Check Neo4j availability via Docker
  let neo4jReady = false;
  try {
    const dInfo = execFileSync("docker", ["inspect", "gsd-t-neo4j"], {
      encoding: "utf8", timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"]
    });
    const container = JSON.parse(dInfo);
    if (container[0] && container[0].State &&
        container[0].State.Running) {
      neo4jReady = true;
      info("Neo4j container running");
    } else {
      // Container exists but stopped — start it
      execFileSync("docker", ["start", "gsd-t-neo4j"], {
        encoding: "utf8", timeout: 10000,
        stdio: ["pipe", "pipe", "pipe"]
      });
      neo4jReady = true;
      success("Neo4j container started");
    }
  } catch {
    // No container — check if Docker is available
    try {
      execFileSync("docker", ["info"], {
        encoding: "utf8", timeout: 5000,
        stdio: ["pipe", "pipe", "pipe"]
      });
      // Docker available — create Neo4j container
      info("Creating Neo4j container for graph engine...");
      try {
        execFileSync("docker", [
          "run", "-d", "--name", "gsd-t-neo4j",
          "-p", "7474:7474", "-p", "7687:7687",
          "-e", "NEO4J_AUTH=neo4j/gsdt-graph-2026",
          "--restart", "unless-stopped",
          "neo4j:5-community"
        ], {
          encoding: "utf8", timeout: 120000,
          stdio: ["pipe", "pipe", "pipe"]
        });
        neo4jReady = true;
        success("Neo4j container created (port 7474/7687)");
      } catch (e) {
        warn("Failed to create Neo4j container");
        info("Run manually: docker run -d --name gsd-t-neo4j -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/gsdt-graph-2026 neo4j:5-community");
      }
    } catch {
      warn("Docker not available — CGC will use native-only graph mode");
      info("Install Docker Desktop to enable CGC deep analysis");
    }
  }

  // Configure CGC to use Neo4j
  if (neo4jReady) {
    const cgcConfigDir = path.join(os.homedir(), ".codegraphcontext");
    const cgcConfigFile = path.join(cgcConfigDir, ".env");
    ensureDir(cgcConfigDir);
    if (!fs.existsSync(cgcConfigFile) ||
        !fs.readFileSync(cgcConfigFile, "utf8").includes("NEO4J_URI")) {
      // Create or append Neo4j config
      try {
        execFileSync("cgc", ["config", "set", "DEFAULT_DATABASE", "neo4j"], {
          encoding: "utf8", timeout: 5000,
          stdio: ["pipe", "pipe", "pipe"],
          env: { ...process.env, PYTHONIOENCODING: "utf-8" }
        });
        execFileSync("cgc", ["config", "set", "NEO4J_URI", "bolt://localhost:7687"], {
          encoding: "utf8", timeout: 5000,
          stdio: ["pipe", "pipe", "pipe"],
          env: { ...process.env, PYTHONIOENCODING: "utf-8" }
        });
        execFileSync("cgc", ["config", "set", "NEO4J_PASSWORD", "gsdt-graph-2026"], {
          encoding: "utf8", timeout: 5000,
          stdio: ["pipe", "pipe", "pipe"],
          env: { ...process.env, PYTHONIOENCODING: "utf-8" }
        });
        // Add NEO4J_USERNAME manually (not a CGC config key)
        const envContent = fs.readFileSync(cgcConfigFile, "utf8");
        if (!envContent.includes("NEO4J_USERNAME")) {
          fs.appendFileSync(cgcConfigFile,
            "\n# Neo4j connection settings\nNEO4J_USERNAME=neo4j\n");
        }
        success("CGC configured for Neo4j");
      } catch {
        warn("CGC config write failed — configure manually");
      }
    } else {
      info("CGC Neo4j config exists");
    }
  }

  // Summary
  if (neo4jReady) {
    success("Graph engine: CGC + Neo4j (full analysis)");
  } else {
    info("Graph engine: native-only (install Docker for CGC)");
  }
}

// ─── Commands ────────────────────────────────────────────────────────────────

// Shared templates that slash-command prompts reference by predictable path.
// Terminal-2 workers should find these at ~/.claude/templates/ without hunting
// through npx caches. Keep this list tight — only templates that commands cite
// via absolute path belong here.
const SHARED_TEMPLATES = [
  "design-chart-taxonomy.md",
  "element-contract.md",
  "widget-contract.md",
  "page-contract.md",
  "design-contract.md",
  "shared-services-contract.md",
];

function installSharedTemplates() {
  ensureDir(CLAUDE_TEMPLATES_DIR);
  let installed = 0, skipped = 0;
  for (const file of SHARED_TEMPLATES) {
    const src = path.join(PKG_TEMPLATES, file);
    const dest = path.join(CLAUDE_TEMPLATES_DIR, file);
    if (!fs.existsSync(src)) continue;
    if (fs.existsSync(dest) &&
        normalizeEol(fs.readFileSync(src, "utf8")) === normalizeEol(fs.readFileSync(dest, "utf8"))) {
      skipped++;
      continue;
    }
    fs.copyFileSync(src, dest);
    installed++;
  }
  if (skipped > 0) info(`${skipped} templates unchanged`);
  success(`${installed + skipped} shared templates → ~/.claude/templates/`);
}

function installCommands(isUpdate) {
  heading("Slash Commands");
  const commandFiles = getCommandFiles();
  const gsdtCommands = getGsdtCommands();
  const utilityCommands = getUtilityCommands();
  let installed = 0, skipped = 0;

  for (const file of commandFiles) {
    const src = path.join(PKG_COMMANDS, file);
    const dest = path.join(COMMANDS_DIR, file);
    if (isUpdate && fs.existsSync(dest)) {
      if (normalizeEol(fs.readFileSync(src, "utf8")) === normalizeEol(fs.readFileSync(dest, "utf8"))) {
        skipped++;
        continue;
      }
    }
    copyFile(src, dest, file);
    installed++;
  }

  if (skipped > 0) info(`${skipped} commands unchanged`);
  success(`${gsdtCommands.length} GSD-T commands + ${utilityCommands.length} utilities ${isUpdate ? "updated" : "installed"} → ~/.claude/commands/`);
  return { gsdtCommands, utilityCommands };
}

const GSDT_START = "<!-- GSD-T:START";
const GSDT_END = "<!-- GSD-T:END";

function installGlobalClaudeMd(isUpdate) {
  heading("Global CLAUDE.md");
  const globalSrc = path.join(PKG_TEMPLATES, "CLAUDE-global.md");

  if (!fs.existsSync(GLOBAL_CLAUDE_MD)) {
    copyFile(globalSrc, GLOBAL_CLAUDE_MD, "CLAUDE.md installed");
    return;
  }

  if (isSymlink(GLOBAL_CLAUDE_MD)) {
    warn("Skipping CLAUDE.md — target is a symlink");
    return;
  }

  const existing = fs.readFileSync(GLOBAL_CLAUDE_MD, "utf8");
  const template = fs.readFileSync(globalSrc, "utf8");

  if (existing.includes(GSDT_START)) {
    mergeGsdtSection(existing, template, isUpdate);
  } else if (existing.includes("GSD-T: Contract-Driven Development")) {
    migrateToMarkers(existing, template);
  } else {
    appendGsdtToClaudeMd(template);
  }
}

function mergeGsdtSection(existing, template, isUpdate) {
  if (!isUpdate) {
    info("CLAUDE.md already contains GSD-T config");
    return;
  }
  const startIdx = existing.indexOf(GSDT_START);
  const endMarkerIdx = existing.indexOf(GSDT_END);
  if (startIdx === -1 || endMarkerIdx === -1) {
    warn("GSD-T markers incomplete — appending fresh copy");
    appendGsdtToClaudeMd(template);
    return;
  }
  const endLineEnd = existing.indexOf("\n", endMarkerIdx);
  const endIdx = endLineEnd === -1 ? existing.length : endLineEnd + 1;
  const before = existing.substring(0, startIdx);
  const after = existing.substring(endIdx);
  const merged = before + template.trimEnd() + "\n" + after;
  if (normalizeEol(merged) === normalizeEol(existing)) {
    info("CLAUDE.md GSD-T section already up to date");
    return;
  }
  const backupPath = GLOBAL_CLAUDE_MD + ".backup-" + Date.now();
  fs.copyFileSync(GLOBAL_CLAUDE_MD, backupPath);
  fs.writeFileSync(GLOBAL_CLAUDE_MD, merged);
  success("CLAUDE.md GSD-T section updated (custom content preserved)");
}

function migrateToMarkers(existing, template) {
  const backupPath = GLOBAL_CLAUDE_MD + ".backup-" + Date.now();
  fs.copyFileSync(GLOBAL_CLAUDE_MD, backupPath);
  const sepIdx = existing.indexOf("# ─── GSD-T Section");
  if (sepIdx !== -1) {
    const before = existing.substring(0, sepIdx);
    const merged = before + template.trimEnd() + "\n";
    fs.writeFileSync(GLOBAL_CLAUDE_MD, merged);
  } else {
    fs.writeFileSync(GLOBAL_CLAUDE_MD, template);
  }
  success("CLAUDE.md migrated to marker-based format");
  info("Backup saved: " + path.basename(backupPath));
}

function appendGsdtToClaudeMd(template) {
  const separator = "\n\n";
  fs.appendFileSync(GLOBAL_CLAUDE_MD, separator + template.trimEnd() + "\n");
  success("GSD-T config appended to existing CLAUDE.md");
  info("Your existing content was preserved.");
}

async function doInstall(opts = {}) {
  const isUpdate = opts.update || false;
  heading(`${isUpdate ? "Updating" : "Installing"} GSD-T ${versionLink()}`);
  log("");

  if (ensureDir(COMMANDS_DIR)) success("Created ~/.claude/commands/");

  const { gsdtCommands, utilityCommands } = installCommands(isUpdate);
  installGlobalClaudeMd(isUpdate);

  heading("Heartbeat (Real-time Events)");
  installHeartbeat();

  heading("Update Check (Session Start)");
  installUpdateCheck();

  heading("Auto-Route (UserPromptSubmit)");
  installAutoRoute();

  heading("In-Session Hooks (Conversation Capture + Token Usage)");
  installInSessionHooks();

  heading("Figma MCP (Design-to-Code)");
  configureFigmaMcp();

  heading("Shared Templates");
  installSharedTemplates();

  heading("Utility Scripts");
  installUtilityScripts();

  heading("Global Bin Tools (~/.claude/bin/)");
  installGlobalBinTools();

  heading("Context Meter (PostToolUse)");
  const cmHook = configureContextMeterHooks(SETTINGS_JSON);
  if (cmHook.installed) {
    if (cmHook.action === "added") success("Context meter PostToolUse hook added");
    else if (cmHook.action === "updated") success("Context meter hook command refreshed");
    else info("Context meter hook already configured");
  }

  heading("Graph Engine (CGC)");
  installCgc();

  saveInstalledVersion();

  showInstallSummary(gsdtCommands.length, utilityCommands.length);
}

function showInstallSummary(gsdtCount, utilCount) {
  heading("Installation Complete!");
  log("");
  log(`  Commands: ${gsdtCount} GSD-T + ${utilCount} utility commands in ~/.claude/commands/`);
  log(`  Config:   ~/.claude/CLAUDE.md`);
  log(`  Version:  ${versionLink()}`);
  log("");
  log(`${BOLD}Quick Start:${RESET}`);
  log(`  ${DIM}$${RESET} cd your-project`);
  log(`  ${DIM}$${RESET} claude`);
  log(`  ${DIM}>${RESET} /gsd-t-init my-project`);
  log(`  ${DIM}>${RESET} /gsd-t-milestone "First Feature"`);
  log(`  ${DIM}>${RESET} /gsd-t-wave`);
  log("");
  log(`${BOLD}Other commands:${RESET}`);
  log(`  ${DIM}$${RESET} npx @tekyzinc/gsd-t status      ${DIM}— check installation${RESET}`);
  log(`  ${DIM}$${RESET} npx @tekyzinc/gsd-t update      ${DIM}— update to latest${RESET}`);
  log(`  ${DIM}$${RESET} npx @tekyzinc/gsd-t init myapp   ${DIM}— scaffold a new project${RESET}`);
  log(`  ${DIM}$${RESET} npx @tekyzinc/gsd-t doctor       ${DIM}— diagnose issues${RESET}`);
  log("");
}

async function doUpdate() {
  const installedVersion = getInstalledVersion();

  if (installedVersion === PKG_VERSION) {
    heading(`GSD-T ${versionLink()}`);
    info("Already up to date!");
    log("");
    log("  To force a reinstall, run:");
    log(`  ${DIM}$${RESET} npx @tekyzinc/gsd-t install`);
    log("");
    return;
  }

  if (installedVersion) {
    heading(`Updating GSD-T: ${versionLink(installedVersion)} → ${versionLink()}`);
  }

  await doInstall({ update: true });
}

function initClaudeMd(projectDir, projectName, today) {
  const claudeMdPath = path.join(projectDir, "CLAUDE.md");
  if (isSymlink(claudeMdPath)) {
    warn("Skipping CLAUDE.md — target is a symlink");
    return;
  }
  try {
    const template = fs.readFileSync(path.join(PKG_TEMPLATES, "CLAUDE-project.md"), "utf8");
    const content = applyTokens(template, projectName, today);
    fs.writeFileSync(claudeMdPath, content, { flag: "wx" });
    success("CLAUDE.md created");
  } catch (e) {
    if (e.code === "EEXIST") {
      const content = fs.readFileSync(claudeMdPath, "utf8");
      if (content.includes("GSD-T Workflow")) {
        info("CLAUDE.md already contains GSD-T section — skipping");
      } else {
        warn("CLAUDE.md exists but doesn't reference GSD-T");
        info("Run /gsd-t-init inside Claude Code to add GSD-T section");
      }
    } else { throw e; }
  }
}

function initDocs(projectDir, projectName, today) {
  const docsDir = path.join(projectDir, "docs");
  ensureDir(docsDir);

  const docTemplates = ["requirements.md", "architecture.md", "workflows.md", "infrastructure.md"];
  for (const file of docTemplates) {
    const destPath = path.join(docsDir, file);
    if (isSymlink(destPath)) {
      warn(`Skipping docs/${file} — target is a symlink`);
      continue;
    }
    try {
      const template = fs.readFileSync(path.join(PKG_TEMPLATES, file), "utf8");
      const content = applyTokens(template, projectName, today);
      fs.writeFileSync(destPath, content, { flag: "wx" });
      success(`docs/${file}`);
    } catch (e) {
      if (e.code === "EEXIST") { info(`docs/${file} already exists — skipping`); }
      else { throw e; }
    }
  }
}

function initGsdtDir(projectDir, projectName, today) {
  const gsdtDir = path.join(projectDir, ".gsd-t");
  const contractsDir = path.join(gsdtDir, "contracts");
  const domainsDir = path.join(gsdtDir, "domains");

  ensureDir(contractsDir);
  ensureDir(domainsDir);

  for (const dir of [contractsDir, domainsDir]) {
    const gitkeep = path.join(dir, ".gitkeep");
    if (isSymlink(gitkeep)) continue;
    try { fs.writeFileSync(gitkeep, "", { flag: "wx" }); }
    catch (e) { if (e.code !== "EEXIST") throw e; }
  }

  writeTemplateFile("progress.md", path.join(gsdtDir, "progress.md"), ".gsd-t/progress.md", projectName, today);
  writeTemplateFile("backlog.md", path.join(gsdtDir, "backlog.md"), ".gsd-t/backlog.md", projectName, today);
  writeTemplateFile("backlog-settings.md", path.join(gsdtDir, "backlog-settings.md"), ".gsd-t/backlog-settings.md", projectName, today);

  // Seed universal rules from npm package (if shipped)
  seedUniversalRules(projectDir);
}

function seedUniversalRules(projectDir) {
  try {
    const shippedRules = path.join(PKG_ROOT, "examples", "rules", "universal-rules.jsonl");
    if (!fs.existsSync(shippedRules)) return;
    const content = fs.readFileSync(shippedRules, "utf8").trim();
    if (!content) return;
    const rules = content.split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    if (rules.length === 0) return;
    const localRulesFile = path.join(projectDir, ".gsd-t", "metrics", "rules.jsonl");
    const localDir = path.dirname(localRulesFile);
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
    // Read existing local rules to avoid duplicates
    let existingTriggers = new Set();
    if (fs.existsSync(localRulesFile)) {
      const existing = fs.readFileSync(localRulesFile, "utf8").trim();
      if (existing) {
        existing.split("\n").forEach((l) => {
          try { const r = JSON.parse(l); existingTriggers.add(JSON.stringify(r.trigger || {})); } catch {}
        });
      }
    }
    let seeded = 0;
    for (const rule of rules) {
      const trigger = (rule.original_rule && rule.original_rule.trigger) || {};
      const fp = JSON.stringify(trigger);
      if (existingTriggers.has(fp)) continue;
      const candidate = {
        id: `universal-${rule.global_id || "unknown"}`,
        created_at: new Date().toISOString(),
        name: (rule.original_rule && rule.original_rule.name) || rule.global_id || "universal",
        description: (rule.original_rule && rule.original_rule.description) || "Shipped as universal rule",
        trigger,
        severity: (rule.original_rule && rule.original_rule.severity) || "MEDIUM",
        action: (rule.original_rule && rule.original_rule.action) || "warn",
        patch_template_id: null,
        activation_count: 0, last_activated: null,
        milestone_created: "universal", status: "active",
        source_global_id: rule.global_id || null,
      };
      fs.appendFileSync(localRulesFile, JSON.stringify(candidate) + "\n");
      existingTriggers.add(fp);
      seeded++;
    }
    if (seeded > 0) success(`Seeded ${seeded} universal rules from npm package`);
  } catch { /* silently skip if anything fails */ }
}

function writeTemplateFile(templateName, destPath, label, projectName, today) {
  if (isSymlink(destPath)) { warn(`Skipping ${label} — target is a symlink`); return; }
  try {
    const template = fs.readFileSync(path.join(PKG_TEMPLATES, templateName), "utf8");
    const content = projectName ? applyTokens(template, projectName, today) : template;
    fs.writeFileSync(destPath, content, { flag: "wx" });
    success(label);
  } catch (e) {
    if (e.code === "EEXIST") { info(`${label} already exists — skipping`); }
    else { throw e; }
  }
}

async function doInit(projectName) {
  if (!projectName) projectName = path.basename(process.cwd());

  if (!validateProjectName(projectName)) {
    error(`Invalid project name: "${projectName}"`);
    info("Project names must start with a letter or number and contain only letters, numbers, dots, hyphens, underscores, or spaces (max 101 chars)");
    return;
  }

  heading(`Initializing GSD-T project: ${projectName}`);
  log("");

  const projectDir = process.cwd();
  const today = new Date().toISOString().split("T")[0];

  initClaudeMd(projectDir, projectName, today);
  initDocs(projectDir, projectName, today);
  initGsdtDir(projectDir, projectName, today);
  copyBinToolsToProject(projectDir, projectName);

  // M61 D1: Context Meter retired (token-budget.cjs + scripts/gsd-t-context-meter.js
  // deleted). Native /context replaces it. No longer provisioned at install —
  // installContextMeter / configureContextMeterHooks would register a PostToolUse
  // hook pointing at a deleted script. Both functions remain defined but unused
  // (cleaned in M65 follow-up).

  if (registerProject(projectDir)) success("Registered in ~/.claude/.gsd-t-projects");

  // M50 D1: Universal Playwright bootstrap. If the project has UI signal but
  // no playwright.config.*, install @playwright/test + chromium and scaffold
  // playwright.config.ts + e2e/. See playwright-bootstrap-contract.md §5.
  if (hasUI(projectDir) && !hasPlaywright(projectDir)) {
    info("Installing Playwright (chromium)…");
    try {
      const r = await installPlaywright(projectDir);
      if (r.ok) {
        success("Playwright installed (playwright.config.ts + e2e/ scaffold)");
      } else {
        warn(`Playwright install failed: ${r.err}`);
        if (r.hint) info(r.hint);
      }
    } catch (e) {
      warn(`Playwright install errored: ${e.message || e}`);
      info("Re-run with: gsd-t doctor --install-playwright");
    }
  }

  // M52 D1: auto-install the journey-coverage gate. Idempotent — no-op if marker present.
  if (hasUI(projectDir)) installJourneyCoverageHook(projectDir);

  showInitTree(projectDir);
}

function showInitTree(projectDir) {
  heading("Project Initialized!");
  log("");
  log(`  ${projectDir}/`);
  log("  ├── CLAUDE.md");
  log("  ├── docs/");
  log("  │   ├── requirements.md");
  log("  │   ├── architecture.md");
  log("  │   ├── workflows.md");
  log("  │   └── infrastructure.md");
  log("  └── .gsd-t/");
  log("      ├── progress.md");
  log("      ├── backlog.md");
  log("      ├── backlog-settings.md");
  log("      ├── contracts/");
  log("      └── domains/");
  log("");
  log(`${BOLD}Next steps:${RESET}`);
  log(`  1. Edit CLAUDE.md — add project overview and tech stack`);
  log(`  2. Start Claude Code: ${DIM}claude${RESET}`);
  log(`  3. Run: ${DIM}/gsd-t-populate${RESET}  ${DIM}(if existing codebase)${RESET}`);
  log(`     Or:  ${DIM}/gsd-t-project${RESET}   ${DIM}(if new project)${RESET}`);
  log("");
}

function doStatus() {
  heading("GSD-T Status");
  log("");
  if (!showStatusVersion()) return;
  showStatusCommands();
  showStatusConfig();
  showStatusTeams();
  showStatusContextMeter();
  showStatusProject();
  showStatusTokenBlock();
  log("");
}

function showStatusTokenBlock() {
  const cwd = process.cwd();
  if (!fs.existsSync(path.join(cwd, ".gsd-t"))) return;
  let milestone = null;
  try {
    const progressPath = path.join(cwd, ".gsd-t", "progress.md");
    if (fs.existsSync(progressPath)) {
      const src = fs.readFileSync(progressPath, "utf8");
      const m = src.match(/## Current Milestone:\s*(\S+)/) || src.match(/Milestone:\s*(M\d+)/);
      if (m) milestone = m[1];
    }
  } catch (_) {}
  try {
    const dashboard = require(path.join(__dirname, "gsd-t-token-dashboard.cjs"));
    const agg = dashboard.aggregateSync({ projectDir: cwd, milestone });
    log(dashboard.renderStatusBlock(agg));
  } catch (_) {}
}

function formatRelativeTime(timestampIso) {
  const then = Date.parse(timestampIso);
  if (!Number.isFinite(then)) return "unknown";
  const deltaSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (deltaSec < 60) return `${deltaSec}s ago`;
  if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)}m ago`;
  if (deltaSec < 86400) return `${Math.floor(deltaSec / 3600)}h ago`;
  return `${Math.floor(deltaSec / 86400)} days ago`;
}

function showStatusContextMeter() {
  heading("Context Meter");
  const cwd = process.cwd();
  const statePath = path.join(cwd, ".gsd-t", ".context-meter-state.json");

  let state = null;
  try {
    if (fs.existsSync(statePath)) {
      state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    }
  } catch {
    state = null;
  }

  if (!state || typeof state !== "object") {
    log(`  ${DIM}Context: N/A (meter hook not run this session)${RESET}`);
    return;
  }

  // Error case: lastError set. Promoted from DIM to ERROR in v3.10.12.
  // Before: a silent dim line nobody read. After: a red alarm so users see
  // that the context-window guardrail is DEAD (M36 regression fix).
  if (state.lastError) {
    const code = (state.lastError && state.lastError.code) || "unknown";
    const rel = state.timestamp ? formatRelativeTime(state.timestamp) : "never measured";
    log(`  ${RED}${BOLD}✗ CONTEXT METER DEAD${RESET} ${RED}— error: ${code}, last check: ${rel}${RESET}`);
    log(`    ${RED}The context-window guardrail is NOT working. Long sessions will hit /compact.${RESET}`);
    log(`    ${YELLOW}Fix: run 'gsd-t doctor' for diagnostics${RESET}`);
    return;
  }

  // Require minimum viable fields for a fresh reading
  if (
    typeof state.pct !== "number" ||
    typeof state.modelWindowSize !== "number" ||
    typeof state.threshold !== "string" ||
    typeof state.timestamp !== "string"
  ) {
    log(`  ${DIM}Context: N/A (meter hook not run this session)${RESET}`);
    return;
  }

  const pctStr = state.pct.toFixed(1);
  const rel = formatRelativeTime(state.timestamp);
  const ageMs = Date.now() - Date.parse(state.timestamp);
  const stale = !Number.isFinite(ageMs) || ageMs > 5 * 60 * 1000;
  const staleSuffix = stale ? " (stale)" : "";

  // v3.0.0 three-band: normal (green) / warn (yellow) / stop (bold red).
  let color = DIM;
  switch (state.threshold) {
    case "normal":
      color = GREEN;
      break;
    case "warn":
      color = YELLOW;
      break;
    case "stop":
      color = BOLD + RED;
      break;
  }

  const line = `Context: ${pctStr}% of ${state.modelWindowSize} tokens (${state.threshold} band) — last check ${rel}${staleSuffix}`;
  log(`  ${color}${line}${RESET}`);
}

function showStatusVersion() {
  const installedVersion = getInstalledVersion();
  if (installedVersion) {
    success(`Installed version: ${versionLink(installedVersion)}`);
    if (installedVersion !== PKG_VERSION) {
      warn(`Latest version: ${versionLink()}`);
      info(`Run 'npx @tekyzinc/gsd-t update' to update`);
    } else {
      success(`Up to date (latest: ${versionLink()})`);
    }
    return true;
  }
  error("GSD-T not installed");
  info("Run 'npx @tekyzinc/gsd-t install' to install");
  return false;
}

function showStatusCommands() {
  heading("Slash Commands");
  const expected = getCommandFiles();
  const installed = getInstalledCommands();
  const missing = expected.filter((f) => !installed.includes(f));
  const extra = installed.filter((f) => !expected.includes(f));
  const present = expected.filter((f) => installed.includes(f));
  log(`  ${present.length}/${expected.length} commands installed (${getGsdtCommands().length} GSD-T + ${getUtilityCommands().length} utilities)`);
  if (missing.length > 0) warn(`Missing: ${missing.join(", ")}`);
  if (extra.length > 0) info(`Custom commands found: ${extra.join(", ")}`);
}

function showStatusConfig() {
  heading("Global Config");
  if (fs.existsSync(GLOBAL_CLAUDE_MD)) {
    const content = fs.readFileSync(GLOBAL_CLAUDE_MD, "utf8");
    if (content.includes("GSD-T: Contract-Driven Development")) {
      success("~/.claude/CLAUDE.md contains GSD-T config");
    } else {
      warn("~/.claude/CLAUDE.md exists but doesn't contain GSD-T section");
    }
  } else {
    error("~/.claude/CLAUDE.md not found");
  }
}

function showStatusTeams() {
  heading("Agent Teams");
  if (!fs.existsSync(SETTINGS_JSON)) {
    info("No settings.json found (Claude Code will use defaults)");
    return;
  }
  const settings = readSettingsJson();
  if (settings === null) {
    warn("settings.json exists but couldn't be parsed");
    return;
  }
  const teamsEnabled = settings?.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS === "1";
  if (teamsEnabled) {
    success("Agent Teams enabled in settings.json");
  } else {
    info("Agent Teams not enabled (optional — solo mode works fine)");
    info('Add "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" to env in settings.json');
  }
}

function showStatusProject() {
  heading("Current Project");
  const cwd = process.cwd();
  const hasGsdT = fs.existsSync(path.join(cwd, ".gsd-t"));
  const hasClaudeMd = fs.existsSync(path.join(cwd, "CLAUDE.md"));

  if (hasGsdT) {
    success(`.gsd-t/ found in ${cwd}`);
    const progressPath = path.join(cwd, ".gsd-t", "progress.md");
    if (fs.existsSync(progressPath)) {
      const progress = fs.readFileSync(progressPath, "utf8");
      const statusMatch = progress.match(/## Status:\s*(.+)/);
      const milestoneMatch = progress.match(/## Project:\s*(.+)/);
      if (milestoneMatch) info(`Project: ${milestoneMatch[1]}`);
      if (statusMatch) info(`Status: ${statusMatch[1]}`);
    }
  } else if (hasClaudeMd) {
    info("CLAUDE.md found but no .gsd-t/ directory");
    info("Run /gsd-t-init inside Claude Code to set up");
  } else {
    info("Not in a GSD-T project directory");
    info(`Run 'npx @tekyzinc/gsd-t init' to set up this directory`);
  }
}

function doUninstall() {
  heading("Uninstalling GSD-T");
  log("");

  removeInstalledCommands();
  removeVersionFile();

  // Remove context meter PostToolUse hook from settings.json
  if (removeContextMeterHook(SETTINGS_JSON)) {
    success("Context meter PostToolUse hook removed from settings.json");
  }

  warn("~/.claude/CLAUDE.md was NOT removed (may contain your customizations)");
  info("Remove manually if desired: delete the GSD-T section from ~/.claude/CLAUDE.md");
  info("Project files (.gsd-t/, docs/, CLAUDE.md) were NOT removed");

  heading("Uninstall Complete");
  log("");
}

function removeInstalledCommands() {
  const commands = getInstalledCommands();
  let removed = 0;
  for (const file of commands) {
    const fp = path.join(COMMANDS_DIR, file);
    if (isSymlink(fp)) { warn(`Skipping symlink: ${file}`); continue; }
    try { fs.unlinkSync(fp); removed++; }
    catch (e) { error(`Failed to remove ${file}: ${e.message}`); }
  }
  if (removed > 0) success(`Removed ${removed} slash commands from ~/.claude/commands/`);
}

function removeVersionFile() {
  try {
    if (fs.existsSync(VERSION_FILE) && !isSymlink(VERSION_FILE)) fs.unlinkSync(VERSION_FILE);
  } catch (e) {
    error(`Failed to remove version file: ${e.message}`);
  }
}

function updateProjectClaudeMd(claudeMd, projectName) {
  const content = fs.readFileSync(claudeMd, "utf8");
  if (content.includes("Destructive Action Guard")) return false;

  const newContent = insertGuardSection(content);
  if (isSymlink(claudeMd)) { warn(`${projectName} — skipping CLAUDE.md write (symlink)`); return false; }
  try {
    fs.writeFileSync(claudeMd, newContent);
    success(`${projectName} — added Destructive Action Guard`);
    return true;
  } catch (e) {
    error(`${projectName} — failed to update CLAUDE.md: ${e.message}`);
    return false;
  }
}

function insertGuardSection(content) {
  const preCommitMatch = content.match(/\n(#{1,3} Pre-Commit Gate)/);
  if (preCommitMatch) return content.replace("\n" + preCommitMatch[1], GUARD_SECTION + "\n" + preCommitMatch[1]);
  const dontDoMatch = content.match(/\n(#{1,3} Don't Do These Things)/);
  if (dontDoMatch) return content.replace("\n" + dontDoMatch[1], GUARD_SECTION + "\n" + dontDoMatch[1]);
  return content + GUARD_SECTION;
}

function createProjectChangelog(projectDir, projectName) {
  const changelogPath = path.join(projectDir, "CHANGELOG.md");
  if (isSymlink(changelogPath)) return false;
  try {
    const today = new Date().toISOString().split("T")[0];
    const changelogContent = [
      "# Changelog",
      "",
      "All notable changes to this project are documented here.",
      "",
      `## [0.1.0] - ${today}`,
      "",
      "### Added",
      "- Initial changelog created by GSD-T",
      "",
    ].join("\n");
    fs.writeFileSync(changelogPath, changelogContent, { flag: "wx" });
    success(`${projectName} — created CHANGELOG.md`);
    return true;
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
    return false;
  }
}

async function checkProjectHealth(projects) {
  heading("Project Health");
  const playwrightMissing = [];
  const swaggerMissing = [];
  const playwrightAutoInstalled = [];
  const playwrightInstallFailed = [];

  for (const projectDir of projects) {
    if (!fs.existsSync(projectDir)) continue;
    const name = path.basename(projectDir);
    if (!hasPlaywright(projectDir)) playwrightMissing.push(name);
    if (hasApi(projectDir) && !hasSwagger(projectDir)) swaggerMissing.push(name);
  }

  // M50 D1: auto-install Playwright for any UI project that's missing it.
  // Non-UI projects stay missing — they don't need Playwright.
  for (const projectDir of projects) {
    if (!fs.existsSync(projectDir)) continue;
    if (hasPlaywright(projectDir)) continue;
    if (!hasUI(projectDir)) continue;
    const name = path.basename(projectDir);
    try {
      const r = await installPlaywright(projectDir);
      if (r.ok) playwrightAutoInstalled.push(name);
      else playwrightInstallFailed.push({ name, err: r.err, hint: r.hint });
    } catch (e) {
      playwrightInstallFailed.push({ name, err: e.message || String(e) });
    }
  }

  if (playwrightMissing.length === 0 && swaggerMissing.length === 0) {
    success("All projects have Playwright and Swagger configured");
  } else {
    if (playwrightMissing.length > 0) {
      warn(`Playwright missing: ${playwrightMissing.join(", ")}`);
      if (playwrightAutoInstalled.length > 0) {
        success(`Auto-installed Playwright in: ${playwrightAutoInstalled.join(", ")}`);
      }
      if (playwrightInstallFailed.length > 0) {
        for (const f of playwrightInstallFailed) {
          warn(`  ${f.name} — install failed: ${f.err}`);
          if (f.hint) info(`  ${f.hint}`);
        }
      }
      const stillMissing = playwrightMissing.filter(
        (n) => !playwrightAutoInstalled.includes(n),
      );
      if (stillMissing.length > 0) {
        info(
          `Remaining (no UI signal — skipped): ${stillMissing.join(", ")}`,
        );
      }
    }
    if (swaggerMissing.length > 0) {
      warn(`Swagger/OpenAPI missing (API detected): ${swaggerMissing.join(", ")}`);
      info("Swagger will be auto-configured when an API endpoint is created or modified");
    }
  }
  return {
    playwrightMissing,
    swaggerMissing,
    playwrightAutoInstalled,
    playwrightInstallFailed,
  };
}

// ── Global Rule Sync (M27) ──────────────────────────────────────────────────

function syncGlobalRulesToProject(projectDir) {
  try {
    const gsm = require("./global-sync-manager.js");
    const globalRules = gsm.readGlobalRules();
    if (globalRules.length === 0) return 0;

    // Filter: universal OR promotion_count >= 2
    const qualifying = globalRules.filter((r) =>
      r.is_universal === true || (r.promotion_count || 0) >= 2);
    if (qualifying.length === 0) return 0;

    // Load local rules to check for duplicates
    let localRules = [];
    try {
      const re = require("./rule-engine.js");
      localRules = re.getActiveRules(projectDir);
    } catch { /* rule-engine may not exist in target project */ }

    const rulesFile = path.join(projectDir, ".gsd-t", "metrics", "rules.jsonl");
    let injected = 0;

    for (const globalRule of qualifying) {
      const triggerFp = JSON.stringify(
        globalRule.original_rule && globalRule.original_rule.trigger
          ? globalRule.original_rule.trigger : {});
      const alreadyExists = localRules.some((lr) =>
        JSON.stringify(lr.trigger || {}) === triggerFp);
      if (alreadyExists) continue;

      // Inject as candidate rule
      const candidate = {
        id: `global-${globalRule.global_id}`,
        created_at: new Date().toISOString(),
        name: (globalRule.original_rule && globalRule.original_rule.name) || globalRule.global_id,
        description: (globalRule.original_rule && globalRule.original_rule.description) || "Synced from global rules",
        trigger: (globalRule.original_rule && globalRule.original_rule.trigger) || {},
        severity: (globalRule.original_rule && globalRule.original_rule.severity) || "MEDIUM",
        action: (globalRule.original_rule && globalRule.original_rule.action) || "warn",
        patch_template_id: null,
        activation_count: 0,
        last_activated: null,
        milestone_created: "global",
        status: "active",
        source_global_id: globalRule.global_id,
      };

      // Append to local rules.jsonl
      const dir = path.dirname(rulesFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(rulesFile, JSON.stringify(candidate) + "\n");
      localRules.push(candidate); // track to avoid re-injecting within same sync
      injected++;
    }
    return injected;
  } catch {
    return 0;
  }
}

function syncGlobalRules(projects) {
  let totalSynced = 0;
  try {
    const gsm = require("./global-sync-manager.js");
    const globalRules = gsm.readGlobalRules();
    if (globalRules.length === 0) {
      log(`${DIM}  ℹ No global rules to sync${RESET}`);
      return 0;
    }

    heading("Global Rule Sync");
    for (const projectDir of projects) {
      if (!fs.existsSync(projectDir)) continue;
      const count = syncGlobalRulesToProject(projectDir);
      if (count > 0) {
        success(`Synced ${count} global rules to ${path.basename(projectDir)}`);
        totalSynced += count;
      }
    }
    if (totalSynced === 0) {
      info("All projects already have qualifying global rules");
    }
  } catch {
    // global-sync-manager may not exist yet
  }
  return totalSynced;
}

function exportUniversalRulesForNpm() {
  try {
    const gsm = require("./global-sync-manager.js");
    const globalRules = gsm.readGlobalRules();
    const npmCandidates = globalRules.filter((r) => r.is_npm_candidate === true);
    if (npmCandidates.length === 0) return 0;

    const rulesDir = path.join(PKG_ROOT, "examples", "rules");
    if (!fs.existsSync(rulesDir)) fs.mkdirSync(rulesDir, { recursive: true });

    const version = PKG_VERSION;
    const exported = npmCandidates.map((r) => ({
      ...r,
      shipped_in_version: r.shipped_in_version || version,
    }));

    const filePath = path.join(rulesDir, "universal-rules.jsonl");
    fs.writeFileSync(filePath, exported.map((r) => JSON.stringify(r)).join("\n") + "\n");

    // Update shipped_in_version on global rules
    for (const r of npmCandidates) {
      if (!r.shipped_in_version) {
        r.shipped_in_version = version;
      }
    }
    // Write updated rules back to global
    const allRules = gsm.readGlobalRules();
    for (const r of allRules) {
      const match = npmCandidates.find((c) => c.global_id === r.global_id);
      if (match) r.shipped_in_version = match.shipped_in_version;
    }
    // Re-read and write to ensure consistency
    const rulesFile = path.join(os.homedir(), ".claude", "metrics", "global-rules.jsonl");
    if (fs.existsSync(rulesFile)) {
      const tmp = rulesFile + ".tmp." + process.pid;
      fs.writeFileSync(tmp, allRules.map((r) => JSON.stringify(r)).join("\n") + "\n");
      fs.renameSync(tmp, rulesFile);
    }

    return exported.length;
  } catch {
    return 0;
  }
}

async function doUpdateAll() {
  // Step 1: Upgrade the globally-installed npm package FIRST. Without this,
  // `update-all` would only propagate command files — but the global `gsd-t`
  // binary itself could stay pinned to an older version (e.g., user stuck
  // on v3.11.11 while npm registry has v3.12.12). See CHANGELOG v3.12.13.
  // Guard with an env flag to prevent re-exec loops.
  if (!process.env.GSDT_POST_UPGRADE) {
    const upgraded = await upgradeGlobalBinary();
    if (upgraded.reexec) {
      reexecUpdateAll();
      return;
    }
  }

  await updateGlobalCommands();
  heading("Updating registered projects...");
  log("");

  const projects = getRegisteredProjects();
  if (projects.length === 0) { showNoProjectsHint(); return; }

  const counts = { updated: 0, skipped: 0, missing: 0, errors: 0 };
  for (const projectDir of projects) {
    try {
      updateSingleProject(projectDir, counts);
    } catch (e) {
      warn(`${path.basename(projectDir)} — error: ${e.message || e}`);
      counts.errors++;
    }
  }

  // Global rule sync — propagate proven rules across projects
  const syncCount = syncGlobalRules(projects);

  const {
    playwrightMissing,
    swaggerMissing,
    playwrightAutoInstalled,
  } = await checkProjectHealth(projects);
  showUpdateAllSummary(
    projects.length,
    counts,
    playwrightMissing,
    swaggerMissing,
    syncCount,
    playwrightAutoInstalled,
  );
}

// Upgrade the globally-installed @tekyzinc/gsd-t to @latest. Returns
// { upgraded: bool, reexec: bool, error?: string }.
// - reexec=true when the on-disk version after `npm install -g` is newer than
//   the currently-running PKG_VERSION, meaning we need to hand off to the
//   freshly-installed binary so the new code drives propagation.
// - reexec=false when already at latest, or when the install failed (we
//   continue with the current binary and still propagate command files).
async function upgradeGlobalBinary() {
  heading("Upgrading global @tekyzinc/gsd-t to latest...");
  try {
    execFileSync("npm", ["install", "-g", "@tekyzinc/gsd-t@latest"], {
      stdio: "inherit",
      env: process.env,
    });
  } catch (e) {
    warn(`Global npm install failed: ${e.message || e}`);
    info("Continuing with current binary — command files will still be propagated.");
    return { upgraded: false, reexec: false, error: String(e.message || e) };
  }

  // Read the freshly-installed global package's version. If it's newer than
  // the currently-running process, signal a re-exec.
  let newVersion = null;
  try {
    const prefix = execFileSync("npm", ["prefix", "-g"], { encoding: "utf8" }).trim();
    const globalPkgJson = path.join(prefix, "lib", "node_modules", "@tekyzinc", "gsd-t", "package.json");
    if (fs.existsSync(globalPkgJson)) {
      newVersion = JSON.parse(fs.readFileSync(globalPkgJson, "utf8")).version;
    }
  } catch {
    // Best-effort; fall through.
  }

  if (newVersion && newVersion !== PKG_VERSION) {
    success(`Global binary upgraded: v${PKG_VERSION} → v${newVersion}`);
    info("Handing off to the newly-installed binary for propagation...");
    return { upgraded: true, reexec: true };
  }
  success(`Global binary already at latest (v${PKG_VERSION})`);
  return { upgraded: true, reexec: false };
}

// Hand execution to the newly-installed global `gsd-t update-all`. Sets the
// GSDT_POST_UPGRADE env flag so the child does not recurse into another
// upgrade attempt.
function reexecUpdateAll() {
  const env = Object.assign({}, process.env, { GSDT_POST_UPGRADE: "1" });
  try {
    execFileSync("gsd-t", ["update-all"], { stdio: "inherit", env });
  } catch (e) {
    // Surface the child's exit code; execFileSync throws with .status on
    // non-zero exit. Fall through to re-throw so the caller exits cleanly.
    if (e && typeof e.status === "number") {
      process.exit(e.status);
    }
    throw e;
  }
}

async function updateGlobalCommands() {
  if (getInstalledVersion() !== PKG_VERSION) {
    await doInstall({ update: true });
  } else {
    heading(`GSD-T ${versionLink()}`);
    success("Global commands already up to date");
  }
}

function showNoProjectsHint() {
  info("No projects registered");
  log("");
  log("  Projects are registered automatically when you run:");
  log(`  ${DIM}$${RESET} npx @tekyzinc/gsd-t init`);
  log("");
  log("  Or register an existing project manually:");
  log(`  ${DIM}$${RESET} npx @tekyzinc/gsd-t register`);
  log("");
}

function updateSingleProject(projectDir, counts) {
  const projectName = path.basename(projectDir);
  const claudeMd = path.join(projectDir, "CLAUDE.md");

  if (!fs.existsSync(projectDir)) {
    warn(`${projectName} — directory not found (${projectDir})`);
    counts.missing++;
    return;
  }
  if (!fs.existsSync(claudeMd)) {
    warn(`${projectName} — no CLAUDE.md found`);
    counts.skipped++;
    return;
  }
  const guardAdded = updateProjectClaudeMd(claudeMd, projectName);
  const changelogCreated = createProjectChangelog(projectDir, projectName);
  const binToolsCopied = copyBinToolsToProject(projectDir, projectName);
  const archiveRan = runProgressArchiveMigration(projectDir, projectName);
  const taskCounterRetired = runTaskCounterRetirementMigration(projectDir, projectName);
  const unattendedConfigCreated = ensureUnattendedConfig(projectDir, projectName);
  const gitignoreUpdated = ensureUnattendedGitignore(projectDir, projectName);
  if (guardAdded || changelogCreated || binToolsCopied || archiveRan || taskCounterRetired || unattendedConfigCreated || gitignoreUpdated) {
    counts.updated++;
  } else {
    // The "no mutator ran" branch — distinct from "running latest GSD-T version".
    // Be explicit: this only means the 7 migration ops were no-ops. The slash
    // commands and global CLI come from the npm-global install, not from any
    // per-project artifact, so this status doesn't claim or imply a version.
    info(`${projectName} — no migrations needed (CLAUDE.md guard, CHANGELOG, bin tools, unattended config all current)`);
    counts.skipped++;
  }
}

// Bin tools that should ship with every registered project. Listed here so adding
// a new tool only requires appending to this array. Use .cjs extension so they
// always run as CommonJS regardless of the project's package.json "type" field.
const PROJECT_BIN_TOOLS = [
  "archive-progress.cjs",
  // M55 — preflight + parallel-cli + brief + verify-gate libraries copied to project bin/
  // so per-project workflows can `require('./bin/cli-preflight.cjs')` etc. without
  // depending on the globally-installed gsd-t CLI being on PATH.
  "cli-preflight.cjs", "parallel-cli.cjs", "parallel-cli-tee.cjs",
  "gsd-t-context-brief.cjs",
  "gsd-t-verify-gate.cjs", "gsd-t-verify-gate-judge.cjs",
];

// Files that older versions of this installer copied into project bin/ but
// are no longer part of PROJECT_BIN_TOOLS. On each update-all pass, sweep the
// project's bin/ and remove any stray that carries GSD-T provenance — that
// proves it's an old installer artifact, not a user's own file sharing the
// name. User-owned files (no GSD-T provenance marker) are left alone.
//
// M68: the M61/M65 retirement removed the token-telemetry + unattended +
// headless-spawn + context-meter clusters from the package and from
// PROJECT_BIN_TOOLS, but never added them here — so update-all kept the current
// 7 tools fresh while leaving 11-17 dead .cjs lingering in every project's bin/.
// Adding them closes that gap so future retirements prune cleanly.
// Each retired tool maps to one or more VERBATIM header sentinels it actually
// shipped with (recovered from git history at the commit before each was deleted).
// A stray is swept only when its content contains the exact product header — proof
// it was SHIPPED by this installer, not merely that it mentions "gsd-t". This is the
// M68 red-team fix: the prior loose substring (`/gsd-t/` over 1200 chars) would have
// deleted a user's own same-named helper that happened to reference a `.gsd-t/` path.
// A user file can match only by reproducing a verbatim product header — implausible.
const DEPRECATED_BIN_STRAY_SIGNATURES = {
  "gsd-t.js": ["GSD-T CLI Installer"], // bespoke installer header
  // M61 D3 — token telemetry / context-runway cluster
  "gsd-t-token-capture.cjs": ["GSD-T Token Capture", "gsd-t-token-capture"],
  "token-telemetry.cjs": ["GSD-T Token Telemetry"],
  "token-budget.cjs": ["GSD-T Token Budget"],
  "token-optimizer.cjs": ["GSD-T Token Optimizer"],
  "runway-estimator.cjs": ["GSD-T Runway", "runway-estimator"],
  // Verbatim shipped comment header (no bare "GSD-T" — red-team HIGH-1: a bare token
  // would delete a user's same-named file that merely mentions GSD-T).
  "context-budget-audit.cjs": ["Context Budget Audit — measures the static context cost"],
  "context-meter-config.cjs": ["Context Meter config loader (M34)"],
  "context-meter-config.test.cjs": ["context-meter-config"],
  // M61 D2 — unattended relay + headless spawn cluster
  "gsd-t-unattended.cjs": ["GSD-T Unattended", "gsd-t-unattended"],
  "gsd-t-unattended-platform.cjs": ["GSD-T Unattended", "gsd-t-unattended"],
  "gsd-t-unattended-safety.cjs": ["GSD-T Unattended", "gsd-t-unattended"],
  "headless-auto-spawn.cjs": ["GSD-T Headless Auto-Spawn"],
  "headless-exit-codes.cjs": ["GSD-T headless exit-code contract"],
  "handoff-lock.cjs": ["GSD-T Handoff Lock — Fail-safe sentinel"],
  "unattended-watch-format.cjs": ["bin/unattended-watch-format.cjs", "unattended watch-tick activity block"],
  // M61 D1/D4 — misc retired
  "log-tail.cjs": ["Log Tail — print the last N lines"], // verbatim shipped comment
  "event-stream.cjs": ["bin/event-stream.cjs", "unattended supervisor watch-tick"],
};
const DEPRECATED_BIN_STRAYS = Object.keys(DEPRECATED_BIN_STRAY_SIGNATURES);

// A stray is swept only if its first 1200 chars contain one of the VERBATIM header
// sentinels the tool actually shipped with. "Mentions gsd-t" is NOT enough — that
// would risk deleting a user's same-named file (red-team HIGH-1). Returns the matched
// sentinel (for logging) or null.
function _matchedStraySignature(name, content) {
  const sigs = DEPRECATED_BIN_STRAY_SIGNATURES[name];
  if (!sigs) return null;
  const head = content.slice(0, 1200);
  for (const s of sigs) if (head.includes(s)) return s;
  return null;
}

function copyBinToolsToProject(projectDir, projectName) {
  const projectBinDir = path.join(projectDir, "bin");
  if (!fs.existsSync(projectBinDir)) {
    try {
      fs.mkdirSync(projectBinDir, { recursive: true });
    } catch {
      return false;
    }
  }
  let copied = 0;
  for (const tool of PROJECT_BIN_TOOLS) {
    const src = path.join(PKG_ROOT, "bin", tool);
    const dest = path.join(projectBinDir, tool);
    if (!fs.existsSync(src)) continue;
    let needsCopy = true;
    if (fs.existsSync(dest)) {
      try {
        const srcContent = fs.readFileSync(src, "utf8");
        const destContent = fs.readFileSync(dest, "utf8");
        if (srcContent === destContent) needsCopy = false;
      } catch {
        // fall through, will copy
      }
    }
    if (needsCopy) {
      try {
        fs.copyFileSync(src, dest);
        try { fs.chmodSync(dest, 0o755); } catch {}
        copied++;
      } catch (e) {
        warn(`${projectName} — failed to copy ${tool}: ${e.message}`);
      }
    }
  }
  // Self-protection: NEVER sweep GSD-T's own source repo. Without this guard,
  // running `gsd-t update-all` with the GSD-T source repo itself registered
  // as a project (legitimate during development) would signature-match
  // bin/gsd-t.js — which IS the installer — and delete the source file.
  // Identity is by package.json name, NOT by path — when update-all runs from
  // the globally-installed package, PKG_ROOT points to the global install and
  // realpath comparison against the local source always fails.
  const isSourcePackage = (() => {
    try {
      const pkgPath = path.join(projectDir, "package.json");
      if (!fs.existsSync(pkgPath)) return false;
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      return pkg && pkg.name === "@tekyzinc/gsd-t";
    } catch {
      return false;
    }
  })();
  let cleaned = 0;
  if (!isSourcePackage) {
    for (const stray of DEPRECATED_BIN_STRAYS) {
      const strayPath = path.join(projectBinDir, stray);
      if (!fs.existsSync(strayPath)) continue;
      try {
        const strayContent = fs.readFileSync(strayPath, "utf8");
        const matched = _matchedStraySignature(stray, strayContent);
        if (matched) {
          fs.unlinkSync(strayPath);
          cleaned++;
          // Red-team fix (HIGH-2): name every deleted file so a destructive sweep
          // across many projects is reconstructable from scrollback, not a bare count.
          info(`${projectName} — removed retired bin/${stray} (matched shipped header "${matched.slice(0, 40)}")`);
        }
        // No signature match → leave it alone (user's own same-named file).
      } catch {
        // leave the file alone on any read error
      }
    }
  }
  if (cleaned > 0) {
    info(`${projectName} — cleaned up ${cleaned} stray bin file(s)`);
  }
  if (copied > 0) {
    info(`${projectName} — copied ${copied} bin tool(s)`);
    return true;
  }
  return cleaned > 0;
}

// One-shot migration: roll the project's progress.md Decision Log into archive
// files using bin/archive-progress.js. A marker file ensures we only do this once
// per project — subsequent runs are no-ops.
function runProgressArchiveMigration(projectDir, projectName) {
  const progressMd = path.join(projectDir, ".gsd-t", "progress.md");
  if (!fs.existsSync(progressMd)) return false;

  const markerPath = path.join(projectDir, ".gsd-t", ".archive-migration-v1");
  if (fs.existsSync(markerPath)) return false;

  const archiveScript = path.join(projectDir, "bin", "archive-progress.cjs");
  if (!fs.existsSync(archiveScript)) return false;

  try {
    const output = execFileSync("node", [archiveScript, "--quiet"], {
      cwd: projectDir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    fs.writeFileSync(
      markerPath,
      `# archive-migration-v1\nApplied: ${new Date().toISOString()}\nTool: bin/archive-progress.js\n`
    );
    info(`${projectName} — progress.md Decision Log archived (one-time migration)`);
    return true;
  } catch (e) {
    warn(`${projectName} — archive migration failed: ${e.message}`);
    return false;
  }
}

// One-shot migration: retire the v2.74.12 task-counter proxy. Removes the stale
// bin/task-counter.cjs and any leftover .task-counter* state/config files from
// downstream projects, then writes a marker so subsequent runs are no-ops. The
// context meter hook (M34) is the authoritative context-burn signal now.
function runTaskCounterRetirementMigration(projectDir, projectName) {
  const gsdtDir = path.join(projectDir, ".gsd-t");
  if (!fs.existsSync(gsdtDir)) return false;

  const markerPath = path.join(gsdtDir, ".task-counter-retired-v1");
  if (fs.existsSync(markerPath)) return false;

  const targets = [
    path.join(projectDir, "bin", "task-counter.cjs"),
    path.join(gsdtDir, "task-counter-config.json"),
    path.join(gsdtDir, ".task-counter-state.json"),
    path.join(gsdtDir, ".task-counter"),
  ];

  let removed = 0;
  for (const target of targets) {
    try {
      if (fs.existsSync(target)) {
        try { if (fs.lstatSync(target).isSymbolicLink()) continue; } catch {}
        fs.unlinkSync(target);
        removed++;
      }
    } catch (e) {
      warn(`${projectName} — failed to remove ${path.basename(target)}: ${e.message}`);
    }
  }

  try {
    fs.writeFileSync(
      markerPath,
      `# task-counter-retired-v1\nApplied: ${new Date().toISOString()}\nReplaced-by: scripts/gsd-t-context-meter.js (M34)\n`
    );
  } catch (e) {
    warn(`${projectName} — failed to write retirement marker: ${e.message}`);
    return false;
  }

  if (removed > 0) {
    info(`${projectName} — retired task-counter (removed ${removed} file(s))`);
  } else {
    info(`${projectName} — retired task-counter (no legacy files found)`);
  }
  return true;
}

function ensureUnattendedConfig(projectDir, projectName) {
  const configDir = path.join(projectDir, ".gsd-t", ".unattended");
  const configPath = path.join(configDir, "config.json");
  if (fs.existsSync(configPath)) return false;
  if (!fs.existsSync(path.join(projectDir, ".gsd-t"))) return false;

  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    const defaultConfig = {
      protectedBranches: ["main", "master", "develop", "trunk", "release/*", "hotfix/*"],
      dirtyTreeWhitelist: [
        ".gsd-t/heartbeat-*.jsonl",
        ".gsd-t/.context-meter-state.json",
        ".gsd-t/events/*.jsonl",
        ".gsd-t/token-metrics.jsonl",
        ".gsd-t/token-log.md",
        ".gsd-t/.unattended/*",
        ".gsd-t/.handoff/*",
        ".claude/settings.local.json",
        ".claude/settings.local.json.bak*",
      ],
      maxIterations: 200,
      hours: 24,
    };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2) + "\n");
    info(`${projectName} — created .gsd-t/.unattended/config.json (edit to customize)`);
    return true;
  } catch (e) {
    warn(`${projectName} — failed to create unattended config: ${e.message}`);
    return false;
  }
}

const UNATTENDED_GITIGNORE_ENTRIES = [
  "bin/context-meter-state.cjs",
  ".gsd-t/.archive-migration-v1",
  ".gsd-t/.task-counter-retired-v1",
];

function ensureUnattendedGitignore(projectDir, projectName) {
  const added = ensureGitignoreEntries(projectDir, UNATTENDED_GITIGNORE_ENTRIES);
  if (added) {
    info(`${projectName} — added GSD-T entries to .gitignore`);
  }
  return added;
}

function showUpdateAllSummary(
  total,
  counts,
  playwrightMissing,
  swaggerMissing,
  syncCount,
  playwrightAutoInstalled,
) {
  log("");
  heading("Update All Complete");
  log(`  Projects registered: ${total}`);
  log(`  Updated:             ${counts.updated}`);
  log(`  Already current:     ${counts.skipped}`);
  if (counts.missing > 0) log(`  Not found:           ${counts.missing}`);
  if (counts.errors > 0) log(`  Errors:              ${counts.errors}`);
  if (playwrightMissing.length > 0) log(`  Missing Playwright:  ${playwrightMissing.length}`);
  if (Array.isArray(playwrightAutoInstalled) && playwrightAutoInstalled.length > 0) {
    log(`  Auto-installed Playwright in: ${playwrightAutoInstalled.length} project(s)`);
  }
  if (swaggerMissing.length > 0) log(`  Missing Swagger:     ${swaggerMissing.length}`);
  if (syncCount > 0) log(`  Global rules synced: ${syncCount}`);
  log("");
}

function checkDoctorEnvironment() {
  let issues = 0;
  const nodeVersion = parseInt(process.version.slice(1));
  if (nodeVersion >= 16) {
    success(`Node.js ${process.version}`);
  } else {
    error(`Node.js ${process.version} — requires >= 16`);
    issues++;
  }
  try {
    const claudeVersion = execFileSync("claude", ["--version"], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    success(`Claude Code: ${claudeVersion}`);
  } catch {
    warn("Claude Code CLI not found in PATH");
    info("Install with: npm install -g @anthropic-ai/claude-code");
    issues++;
  }
  if (fs.existsSync(CLAUDE_DIR)) {
    success("~/.claude/ directory exists");
  } else {
    error("~/.claude/ directory not found");
    info("Run 'npx @tekyzinc/gsd-t install' to create it");
    issues++;
  }
  return issues;
}

function checkDoctorInstallation() {
  let issues = 0;
  const installed = getInstalledCommands();
  const expected = getCommandFiles();
  if (installed.length === expected.length) {
    success(`All ${expected.length} commands installed`);
  } else if (installed.length > 0) {
    warn(`${installed.length}/${expected.length} commands installed`);
    info(`Missing: ${expected.filter((f) => !installed.includes(f)).join(", ")}`);
    issues++;
  } else {
    error("No GSD-T commands installed");
    issues++;
  }
  issues += checkDoctorClaudeMd();
  issues += checkDoctorSettings();
  issues += checkDoctorEncoding(installed);
  issues += checkDoctorGlobalBin();
  return issues;
}

function checkDoctorGlobalBin() {
  let issues = 0;
  const missing = GLOBAL_BIN_TOOLS.filter((tool) => !fs.existsSync(path.join(GLOBAL_BIN_DIR, tool)));
  if (missing.length === 0) {
    success(`All ${GLOBAL_BIN_TOOLS.length} global bin tool${GLOBAL_BIN_TOOLS.length === 1 ? "" : "s"} installed (~/.claude/bin/)`);
  } else {
    warn(`Missing global bin tool${missing.length === 1 ? "" : "s"} in ~/.claude/bin/: ${missing.join(", ")}`);
    info("Fix: re-run `npx @tekyzinc/gsd-t install` (or `update`)");
    issues++;
  }
  return issues;
}

function checkDoctorClaudeMd() {
  if (!fs.existsSync(GLOBAL_CLAUDE_MD)) { error("No global CLAUDE.md"); return 1; }
  const content = fs.readFileSync(GLOBAL_CLAUDE_MD, "utf8");
  if (content.includes("GSD-T")) { success("CLAUDE.md contains GSD-T config"); return 0; }
  warn("CLAUDE.md exists but missing GSD-T section");
  return 1;
}

function checkDoctorSettings() {
  if (!fs.existsSync(SETTINGS_JSON)) { info("No settings.json (not required)"); return 0; }
  if (readSettingsJson() !== null) {
    success("settings.json is valid JSON");
    return 0;
  }
  error("settings.json has invalid JSON");
  return 1;
}

function checkDoctorEncoding(installed) {
  let bad = 0;
  for (const file of installed) {
    const content = fs.readFileSync(path.join(COMMANDS_DIR, file), "utf8");
    if (content.includes("\u00e2\u20ac") || content.includes("\u00c3")) bad++;
  }
  if (bad > 0) {
    error(`${bad} command files have encoding issues (corrupted characters)`);
    info("Run 'npx @tekyzinc/gsd-t update' to replace with clean versions");
    return 1;
  }
  if (installed.length > 0) success("No encoding issues in command files");
  return 0;
}

async function checkDoctorProject(opts) {
  let issues = 0;
  const cwd = process.cwd();
  const installFlag = !!(opts && opts.installPlaywright);
  if (hasPlaywright(cwd)) {
    success("Playwright configured");
  } else if (installFlag && hasUI(cwd)) {
    info("Installing Playwright (chromium)…");
    try {
      const r = await installPlaywright(cwd);
      if (r.ok) {
        success("Playwright installed (playwright.config.ts + e2e/ scaffold)");
      } else {
        error(`Playwright install failed: ${r.err}`);
        if (r.hint) info(r.hint);
        issues++;
      }
    } catch (e) {
      error(`Playwright install errored: ${e.message || e}`);
      issues++;
    }
  } else if (installFlag && !hasUI(cwd)) {
    info("Playwright skipped — no UI signal in this project");
  } else {
    warn("Playwright not configured in this project");
    info("Re-run with --install-playwright, or run any GSD-T testing command (auto-install)");
    issues++;
  }
  if (hasApi(cwd)) {
    if (hasSwagger(cwd)) {
      success("Swagger/OpenAPI configured");
    } else {
      warn("API framework detected but no Swagger/OpenAPI spec found");
      info("Will be auto-configured when an API endpoint is created or modified");
      issues++;
    }
  } else {
    info("No API framework detected (Swagger check skipped)");
  }
  return issues;
}

function checkDoctorCgc() {
  let issues = 0;
  heading("Graph Engine (CGC)");

  // Check CGC binary
  try {
    const ver = execFileSync("cgc", ["--version"], {
      encoding: "utf8", timeout: 3000,
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    success(`CodeGraphContext ${ver}`);
  } catch {
    warn("CGC not installed (deep code analysis unavailable)");
    info("Run 'pip install codegraphcontext' or reinstall GSD-T");
    issues++;
    return issues;
  }

  // Check Neo4j
  try {
    execFileSync("docker", ["inspect", "gsd-t-neo4j", "--format", "{{.State.Running}}"], {
      encoding: "utf8", timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"]
    }).trim() === "true"
      ? success("Neo4j container running")
      : (warn("Neo4j container stopped"), info("Run: docker start gsd-t-neo4j"), issues++);
  } catch {
    warn("Neo4j container not found");
    info("Run: docker run -d --name gsd-t-neo4j -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/gsdt-graph-2026 neo4j:5-community");
    issues++;
  }

  return issues;
}

// Verify context meter wiring: hook registration, hook script presence,
// config validity, and a local estimation dry-run.
// Returns number of issues (RED results). Mirrors checkDoctorCgc shape.
async function checkDoctorContextMeter(projectDir) {
  let issues = 0;
  heading("Context Meter");

  const cwd = projectDir || process.cwd();

  // Load config (used by checks 3 and 4). Missing file → defaults; invalid
  // JSON or schema-mismatch → throws (handled in Check 3).
  let cfg = null;
  let cfgLoadErr = null;
  try {
    const { loadConfig } = require("./context-meter-config.cjs");
    cfg = loadConfig(cwd);
  } catch (e) {
    cfgLoadErr = e;
  }

  // Check 1: Hook registered in ~/.claude/settings.json
  let hookRegistered = false;
  try {
    if (fs.existsSync(SETTINGS_JSON)) {
      const raw = fs.readFileSync(SETTINGS_JSON, "utf8");
      const settings = JSON.parse(raw);
      const postHooks = (settings && settings.hooks && settings.hooks.PostToolUse) || [];
      for (const entry of postHooks) {
        if (!entry || !Array.isArray(entry.hooks)) continue;
        for (const h of entry.hooks) {
          if (h && typeof h.command === "string" && h.command.includes(CONTEXT_METER_HOOK_MARKER)) {
            hookRegistered = true;
            break;
          }
        }
        if (hookRegistered) break;
      }
    }
  } catch {
    // Fall through — treat as not registered
  }
  if (hookRegistered) {
    success("Context meter hook registered in settings.json");
  } else {
    error("Context meter hook not installed — run gsd-t install");
    issues++;
  }

  // Check 2: Hook script file exists in project
  const scriptPath = path.join(cwd, "scripts", CONTEXT_METER_SCRIPT);
  if (fs.existsSync(scriptPath)) {
    success("Hook script present");
  } else {
    error(`Hook script missing at scripts/${CONTEXT_METER_SCRIPT} — run gsd-t update`);
    issues++;
  }

  // Check 3: Config file parses via loader
  const configPath = path.join(cwd, CONTEXT_METER_CONFIG_DEST);
  if (cfgLoadErr) {
    error(`Config file invalid: ${cfgLoadErr.message} — fix ${CONTEXT_METER_CONFIG_DEST}`);
    issues++;
  } else if (fs.existsSync(configPath)) {
    success(`Config valid (threshold ${cfg.thresholdPct}%, check every ${cfg.checkFrequency} calls)`);
  } else {
    warn("Using default config — run gsd-t install to copy template");
  }

  // Check 4: Dry-run local token estimation
  const estimatorPath = path.join(cwd, "scripts", "context-meter", "estimate-tokens.js");
  if (!fs.existsSync(estimatorPath)) {
    error("Token estimator missing at scripts/context-meter/estimate-tokens.js — run gsd-t update");
    issues++;
  } else {
    try {
      const { estimateTokens } = require(estimatorPath);
      const result = estimateTokens({
        system: "",
        messages: [{ role: "user", content: [{ type: "text", text: "ping" }] }],
      });
      if (result && typeof result.inputTokens === "number") {
        success(`Token estimator dry-run OK (${result.inputTokens} tokens)`);
      } else {
        error("Token estimator returned null");
        issues++;
      }
    } catch (e) {
      error(`Token estimator dry-run threw: ${e.message}`);
      issues++;
    }
  }

  return issues;
}

// M49 — Detect dashboard server processes whose pidfile is missing or
// mismatched ("orphans"). The lazy-dashboard + idle-TTL changes prevent new
// orphans from accumulating, but recovery is still needed for any that piled
// up under earlier versions. With `--prune`, kills the orphan PIDs.
//
// "Orphan" = a `gsd-t-dashboard-server.js` process whose pidfile (at
// `{projectDir}/.gsd-t/.dashboard.pid` resolved from the process's cwd / the
// `GSD_T_PROJECT_DIR` env / the registered-projects list) doesn't list the pid.
//
// Detection is best-effort across platforms — `ps` shape varies. We use:
//   - macOS / Linux:  `ps -eo pid,command` (no `=`-stripped header)
//   - Windows:        unsupported here (logged as N/A)
//
// Returns an issue count (0 if clean, 1 if orphans found and not pruned).
function checkDoctorDashboardOrphans(opts) {
  const prune = !!(opts && opts.prune);
  let issues = 0;
  heading("Dashboard Orphans");

  if (process.platform === "win32") {
    info("Skipping (Windows process inventory not yet supported)");
    return 0;
  }

  let psOut;
  try {
    psOut = execFileSync("ps", ["-eo", "pid,command"], {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    warn("Could not run `ps -eo pid,command` — orphan detection skipped");
    return 0;
  }

  const dashPids = [];
  for (const line of psOut.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    if (!t.includes("gsd-t-dashboard-server.js")) continue;
    if (t.includes("ps -eo")) continue; // never list ourselves
    if (t.includes("grep")) continue;
    const m = t.match(/^(\d+)\s+(.+)$/);
    if (!m) continue;
    const pid = parseInt(m[1], 10);
    if (!Number.isFinite(pid) || pid <= 0) continue;
    // Red Team — only treat as a dashboard process if the first argv token is
    // a `node`-flavored binary AND the second token ends with the script
    // filename. Filters out e.g. `cat gsd-t-dashboard-server.js`,
    // `vim gsd-t-dashboard-server.js`, etc. that happen to mention the path.
    const argv = m[2].trim().split(/\s+/);
    if (argv.length < 2) continue;
    const exe = argv[0];
    const script = argv[1] || "";
    const exeIsNode = /(^|\/)node([0-9.]+)?$/.test(exe);
    const scriptMatches = script.endsWith("gsd-t-dashboard-server.js");
    if (!exeIsNode || !scriptMatches) continue;
    dashPids.push({ pid, cmd: m[2] });
  }

  if (dashPids.length === 0) {
    success("No dashboard processes running");
    return 0;
  }

  // Collect candidate pidfiles. We probe (a) cwd + GSD_T_PROJECT_DIR for the
  // current shell, (b) each registered project. Each contributes one
  // {projectDir → pidfile pid} mapping. An orphan is a live dashboard pid
  // that doesn't match any pidfile we found.
  const projects = new Set();
  projects.add(process.cwd());
  if (process.env.GSD_T_PROJECT_DIR) projects.add(process.env.GSD_T_PROJECT_DIR);
  try {
    for (const p of getRegisteredProjects()) projects.add(p);
  } catch { /* registry may not exist */ }

  const knownPids = new Set();
  for (const proj of projects) {
    const pidFile = path.join(proj, ".gsd-t", ".dashboard.pid");
    try {
      const raw = fs.readFileSync(pidFile, "utf8").trim();
      const pid = parseInt(raw, 10);
      if (Number.isFinite(pid) && pid > 0) knownPids.add(pid);
    } catch { /* missing or unreadable */ }
    // Also accept the older M38 pidfile (no leading dot).
    const legacyPidFile = path.join(proj, ".gsd-t", "dashboard.pid");
    try {
      const raw = fs.readFileSync(legacyPidFile, "utf8").trim();
      const pid = parseInt(raw, 10);
      if (Number.isFinite(pid) && pid > 0) knownPids.add(pid);
    } catch { /* missing */ }
  }

  const orphans = dashPids.filter((d) => !knownPids.has(d.pid));

  log(`  Detected ${dashPids.length} dashboard process${dashPids.length === 1 ? "" : "es"} ` +
      `(${knownPids.size} tracked via pidfile, ${orphans.length} orphan${orphans.length === 1 ? "" : "s"})`);

  if (orphans.length === 0) {
    success("No orphans");
    return 0;
  }

  for (const o of orphans) {
    log(`  ${YELLOW}orphan${RESET} pid=${o.pid}`);
  }

  if (prune) {
    let killed = 0;
    let failed = 0;
    for (const o of orphans) {
      try {
        process.kill(o.pid, "SIGTERM");
        killed++;
      } catch (err) {
        if (err && err.code === "ESRCH") {
          // Already gone — count as success.
          killed++;
        } else {
          failed++;
        }
      }
    }
    if (failed === 0) {
      success(`Pruned ${killed} orphan${killed === 1 ? "" : "s"}`);
    } else {
      warn(`Pruned ${killed}, failed ${failed}`);
      issues++;
    }
  } else {
    info("Run `gsd-t doctor --prune` to kill orphans");
    issues++;
  }

  return issues;
}

async function doDoctor(opts) {
  heading("GSD-T Doctor");
  log("");
  let issues = 0;
  issues += checkDoctorEnvironment();
  issues += checkDoctorInstallation();
  issues += await checkDoctorProject(opts);
  issues += checkDoctorCgc();
  // M61 D1: Context Meter retired (token-budget.cjs + context-meter hook deleted).
  // checkDoctorContextMeter would emit phantom errors for the deleted subsystem
  // and tell the user to reinstall it. Native /context replaces the meter.
  // M61 D4: dashboard orphan check left for the deleted dashboard-server is also
  // dead, but harmless (ps string-match, no require) — deferred.
  issues += checkDoctorDashboardOrphans(opts);
  // M50 D2: opt-in install of the playwright-gate pre-commit hook.
  if (opts && opts.installHooks) {
    log("");
    heading("Installing pre-commit hooks");
    installPlaywrightGateHook(process.cwd());
  }
  // M52 D1: opt-in install of the journey-coverage pre-commit hook.
  if (opts && opts.installJourneyHook) {
    log("");
    heading("Installing journey-coverage pre-commit hook");
    installJourneyCoverageHook(process.cwd());
  }
  log("");
  if (issues === 0) {
    log(`${GREEN}${BOLD}  All checks passed!${RESET}`);
  } else {
    log(`${YELLOW}${BOLD}  ${issues} issue${issues > 1 ? "s" : ""} found${RESET}`);
  }
  log("");
  if (issues > 0) process.exit(1);
}

function doRegister() {
  const projectDir = process.cwd();
  const gsdtDir = path.join(projectDir, ".gsd-t");

  if (!fs.existsSync(gsdtDir)) {
    error("Not a GSD-T project (no .gsd-t/ directory found)");
    info("Run 'npx @tekyzinc/gsd-t init' to initialize this project first");
    return;
  }

  if (registerProject(projectDir)) {
    success(`Registered: ${projectDir}`);
  } else {
    info("Already registered");
  }

  // Show all registered projects
  const projects = getRegisteredProjects();
  log("");
  heading("Registered Projects");
  for (const p of projects) {
    const exists = fs.existsSync(p);
    if (exists) {
      log(`  ${GREEN}✓${RESET} ${p}`);
    } else {
      log(`  ${RED}✗${RESET} ${p} ${DIM}(not found)${RESET}`);
    }
  }
  log("");
}

function isNewerVersion(latest, current) {
  const l = latest.split(".").map(Number);
  const c = current.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((l[i] || 0) > (c[i] || 0)) return true;
    if ((l[i] || 0) < (c[i] || 0)) return false;
  }
  return false;
}

function checkForUpdates(command) {
  const skipCommands = ["install", "update", "update-all", "--version", "-v"];
  if (skipCommands.includes(command)) return;

  const cached = readUpdateCache();

  if (cached && cached.latest && validateVersion(cached.latest) && isNewerVersion(cached.latest, PKG_VERSION)) {
    showUpdateNotice(cached.latest);
  }

  if (!cached) {
    fetchVersionSync();
  } else if ((Date.now() - cached.timestamp) > 3600000) {
    refreshVersionAsync();
  }
}

function readSettingsJson() {
  if (!fs.existsSync(SETTINGS_JSON)) return null;
  try { return JSON.parse(fs.readFileSync(SETTINGS_JSON, "utf8")); }
  catch { return null; }
}

function readUpdateCache() {
  try {
    if (fs.existsSync(UPDATE_CHECK_FILE)) {
      return JSON.parse(fs.readFileSync(UPDATE_CHECK_FILE, "utf8"));
    }
  } catch { /* ignore corrupt cache */ }
  return null;
}

function fetchVersionSync() {
  try {
    const fetchScriptPath = path.join(__dirname, "..", "scripts", "gsd-t-fetch-version.js");
    const result = execFileSync(
      process.execPath, [fetchScriptPath],
      { timeout: 8000, encoding: "utf8" }
    ).trim();
    if (result && validateVersion(result) && !isSymlink(UPDATE_CHECK_FILE)) {
      fs.writeFileSync(UPDATE_CHECK_FILE, JSON.stringify({ latest: result, timestamp: Date.now() }));
      if (isNewerVersion(result, PKG_VERSION)) showUpdateNotice(result);
    }
  } catch { /* timeout or network error — skip */ }
}

function refreshVersionAsync() {
  const updateScript = path.join(__dirname, "..", "scripts", "npm-update-check.js");
  const child = cpSpawn(process.execPath, [updateScript, UPDATE_CHECK_FILE], {
    detached: true, stdio: "ignore",
  });
  child.unref();
}

function showUpdateNotice(latest) {
  log("");
  log(`  ${YELLOW}╭──────────────────────────────────────────────╮${RESET}`);
  log(`  ${YELLOW}│${RESET}  Update available: ${DIM}${PKG_VERSION}${RESET} → ${GREEN}${latest}${RESET}            ${YELLOW}│${RESET}`);
  log(`  ${YELLOW}│${RESET}  Run: ${CYAN}npm update -g @tekyzinc/gsd-t${RESET}         ${YELLOW}│${RESET}`);
  log(`  ${YELLOW}│${RESET}  Then: ${CYAN}gsd-t update-all${RESET}                     ${YELLOW}│${RESET}`);
  log(`  ${YELLOW}│${RESET}  Changelog: ${CYAN}gsd-t changelog${RESET}                  ${YELLOW}│${RESET}`);
  log(`  ${YELLOW}╰──────────────────────────────────────────────╯${RESET}`);
}

function doChangelog() {
  try {
    if (process.platform === "win32") {
      // SAFETY: CHANGELOG_URL is a hardcoded constant (line 43). If it ever becomes
      // dynamic/user-provided, this cmd.exe call would need URL validation to prevent injection.
      execFileSync("cmd", ["/c", "start", "", CHANGELOG_URL], { stdio: "ignore" });
    } else {
      const openCmd = process.platform === "darwin" ? "open" : "xdg-open";
      execFileSync(openCmd, [CHANGELOG_URL], { stdio: "ignore" });
    }
    success(`Opened changelog in browser`);
  } catch {
    // Fallback: print the URL
    log(`\n  ${CHANGELOG_URL}\n`);
  }
}

// ─── Graph ──────────────────────────────────────────────────────────────────

function doGraphIndex() {
  heading("GSD-T Graph — Index");
  const root = process.cwd();
  const gq = require("./graph-indexer");
  const result = gq.indexProject(root, { force: true });
  if (result.success) {
    success(`Indexed ${result.entityCount} entities, ${result.relationshipCount} relationships`);
    info(`Files processed: ${result.filesProcessed}, skipped: ${result.filesSkipped}`);
    info(`Duration: ${result.duration}ms`);
    if (result.errors.length > 0) {
      warn(`Parse errors: ${result.errors.length}`);
      result.errors.forEach(e => log(`  ${DIM}${e}${RESET}`));
    }
  } else {
    error("Indexing failed");
  }
}

function doGraphStatus() {
  heading("GSD-T Graph — Status");
  const root = process.cwd();
  const store = require("./graph-store");
  const meta = store.readMeta(root);
  if (!meta) {
    warn("No graph index found. Run: gsd-t graph index");
    return;
  }
  success(`Provider: ${meta.provider}`);
  info(`Entities: ${meta.entityCount}`);
  info(`Relationships: ${meta.relationshipCount}`);
  info(`Last indexed: ${meta.lastIndexed}`);
  info(`Duration: ${meta.duration}ms`);
  const fileCount = Object.keys(meta.fileHashes || {}).length;
  info(`Files tracked: ${fileCount}`);
}

function doGraphQuery(args) {
  const root = process.cwd();
  const gq = require("./graph-query");
  const type = args[0];
  if (!type) {
    error("Usage: gsd-t graph query <type> [params...]");
    info("Types: getEntity, getEntities, getCallers, getCallees,");
    info("       findDeadCode, findDuplicates, findCircularDeps,");
    info("       getDomainBoundaryViolations, getIndexStatus");
    return;
  }
  const params = {};
  for (let i = 1; i < args.length; i++) {
    const [k, v] = args[i].split("=");
    if (k && v) params[k] = v;
  }
  const result = gq.query(type, params, root);
  log(JSON.stringify(result, null, 2));
}

function doGraph(args) {
  // M44 D1-T4: `gsd-t graph --output json|table` prints the task-graph DAG
  // (parsed from .gsd-t/domains/*/tasks.md) for debugging. The pre-existing
  // `index|status|query` subcommands are the codebase entity graph (graph-
  // indexer) and remain unchanged.
  const outIdx = args.indexOf("--output");
  if (outIdx !== -1) {
    const fmt = args[outIdx + 1] || "json";
    return doGraphTaskOutput(fmt);
  }
  const sub = args[0] || "status";
  switch (sub) {
    case "index":  doGraphIndex(); break;
    case "status": doGraphStatus(); break;
    case "query":  doGraphQuery(args.slice(1)); break;
    case "tasks":  doGraphTaskOutput(args[1] || "table"); break;
    default:
      error(`Unknown graph subcommand: ${sub}`);
      info("Usage: gsd-t graph [index|status|query|tasks]");
      info("       gsd-t graph --output json|table   (task DAG)");
  }
}

// M44 D1-T4: print the task DAG built by bin/gsd-t-task-graph.cjs.
function doGraphTaskOutput(format) {
  const tg = require("./gsd-t-task-graph.cjs");
  let graph;
  try {
    graph = tg.buildTaskGraph({ projectDir: process.cwd() });
  } catch (e) {
    if (e && e.name === "TaskGraphCycleError") {
      error(`Task graph cycle: ${(e.cycle || []).join(" → ")}`);
      process.exit(2);
    }
    error(e && e.message ? e.message : String(e));
    process.exit(2);
  }
  const fmt = String(format || "table").toLowerCase();
  if (fmt === "json") {
    process.stdout.write(JSON.stringify(graph, null, 2) + "\n");
    return;
  }
  if (fmt === "table") {
    if (!graph.nodes.length) {
      info("No tasks found in .gsd-t/domains/*/tasks.md");
      if (graph.warnings.length) graph.warnings.forEach((w) => warn(w));
      return;
    }
    // header
    const rows = graph.nodes.map((n) => ({
      id: n.id,
      domain: n.domain,
      wave: String(n.wave),
      status: n.status,
      ready: graph.ready.indexOf(n.id) !== -1 ? "yes" : "no",
      deps: n.deps.join(", ") || "-",
    }));
    const cols = ["id", "domain", "wave", "status", "ready", "deps"];
    const widths = {};
    for (const c of cols) {
      widths[c] = c.length;
      for (const r of rows) widths[c] = Math.max(widths[c], String(r[c]).length);
    }
    const fmtRow = (r) =>
      cols.map((c) => String(r[c]).padEnd(widths[c])).join("  ");
    log(fmtRow(Object.fromEntries(cols.map((c) => [c, c.toUpperCase()]))));
    log(cols.map((c) => "-".repeat(widths[c])).join("  "));
    for (const r of rows) log(fmtRow(r));
    log("");
    info(`${graph.nodes.length} tasks · ${graph.edges.length} edges · ${graph.ready.length} ready`);
    if (graph.warnings.length) {
      log("");
      warn(`${graph.warnings.length} warning(s):`);
      graph.warnings.forEach((w) => log(`  ${w}`));
    }
    return;
  }
  error(`Unknown --output format: ${format} (expected: json|table)`);
  process.exit(2);
}

// ─── Token-Log Writer (Fix 1, v3.12.12) ─────────────────────────────────────

const _TL_HEADER =
  "| Datetime-start | Datetime-end | Command | Step | Model | Duration(s) | Notes | Domain | Task | Ctx% |\n" +
  "|---|---|---|---|---|---|---|---|---|---|\n";

/**
 * Append one row to {projectDir}/.gsd-t/token-log.md for a headless exec
 * invocation. Best-effort — never throws.
 */
function appendHeadlessTokenLog(projectDir, entry) {
  try {
    const logPath = path.join(projectDir, ".gsd-t", "token-log.md");
    const note = entry.exitCode === 0 ? "headless exec: ok" : `headless exec: exit ${entry.exitCode}`;
    // v3.12.14: prefer env-var model over hardcoded "unknown".
    const model = process.env.GSD_T_MODEL || "unknown";
    const row =
      `| ${entry.dtStart} | ${entry.dtEnd} | ${entry.command} | headless | ${model} | ${entry.durationS}s | ${note} | - | - | unknown |\n`;
    const gsdtDir = path.join(projectDir, ".gsd-t");
    if (!fs.existsSync(gsdtDir)) fs.mkdirSync(gsdtDir, { recursive: true });
    if (!fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, `# GSD-T Token Log\n\n${_TL_HEADER}${row}`);
    } else {
      const existing = fs.readFileSync(logPath, "utf8");
      if (!existing.includes("| Datetime-start |")) {
        fs.writeFileSync(logPath, `# GSD-T Token Log\n\n${_TL_HEADER}${existing}${row}`);
      } else {
        fs.appendFileSync(logPath, row);
      }
    }
  } catch (_) {
    /* best-effort */
  }
}

// ─── Headless Mode ────────────────────────────────────────────────────────────

/**
 * Parse headless flags from args array.
 * Extracts --json, --timeout=N, --log from args, returns remainder as positional args.
 */
function parseHeadlessFlags(args) {
  const flags = { json: false, timeout: 300, log: false };
  const positional = [];
  for (const arg of args) {
    if (arg === "--json") {
      flags.json = true;
    } else if (arg.startsWith("--timeout=")) {
      const n = parseInt(arg.slice("--timeout=".length), 10);
      if (!isNaN(n) && n > 0) flags.timeout = n;
    } else if (arg === "--log") {
      flags.log = true;
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

/**
 * Build the claude -p invocation string for a GSD-T command.
 *
 * Non-interactive `claude -p` mode requires the bare `/gsd-t-X` form — the
 * `/gsd-t-X` namespace prefix is rejected as "Unknown command" even
 * though interactive mode accepts both. Verified by M36 Phase 0 Spike A
 * (2026-04-15). See .gsd-t/M36-spike-findings.md.
 */
function buildHeadlessCmd(command, cmdArgs) {
  const argStr = cmdArgs.length > 0 ? " " + cmdArgs.join(" ") : "";
  return `/gsd-t-${command}${argStr}`;
}

/**
 * Map claude output + process exit code to a GSD-T headless exit code.
 * Exit codes: 0=success, 1=verify-fail, 2=context-budget-exceeded, 3=error,
 *             4=blocked-needs-human, 5=command-dispatch-failed
 *
 * Inlined from the former bin/headless-exit-codes.cjs (M65) — that file existed
 * to decouple the exit-code map from the CLI so the unattended supervisor could
 * require it without pulling in gsd-t.js. The supervisor was retired in M61 D2,
 * so the only remaining requirer is this file; the helper now lives inline.
 *
 * Match terminal markers, not narration. A bare "tests failed" substring
 * appears in healthy output ("0 tests failed", "no tests failed", quoted in
 * prose). Require a non-zero count prefix or a structured terminal marker.
 * Bug history: M45 worker output contained "tests failed" 6× in narration,
 * mapping exit 0 → 1 and halting a successful run — keep these regexes anchored.
 */
const HEADLESS_NONZERO_FAILURE_COUNT_RE =
  /(?:^|\b)([1-9]\d*)\s+(?:tests?|specs?|assertions?|examples?|suites?)\s+failed\b/i;
const HEADLESS_STRUCTURED_FAIL_RE = /^FAIL[:\s]/m;
const HEADLESS_JEST_SUMMARY_FAIL_RE = /^Tests:\s+\d+\s+failed/im;
const HEADLESS_VERIFICATION_FAILED_RE =
  /(?:^|[.!?]\s+)(?:verification|verify|quality gate)\s+failed\b/im;
const HEADLESS_CONTEXT_BUDGET_RE =
  /(?:^|[.!?]\s+)(?:context budget exceeded|context window exceeded|budget exceeded|token limit)\b/im;
const HEADLESS_BLOCKED_HUMAN_RE =
  /\bblocked\b[\s\S]{0,80}?\b(?:needs? human|human input|human approval)\b/i;

function mapHeadlessExitCode(processExitCode, output) {
  if (processExitCode !== 0 && processExitCode !== null) return 3;
  const raw = output || "";
  if (/^unknown command:/im.test(raw)) return 5;
  if (HEADLESS_CONTEXT_BUDGET_RE.test(raw)) return 2;
  if (HEADLESS_BLOCKED_HUMAN_RE.test(raw)) return 4;
  if (
    HEADLESS_VERIFICATION_FAILED_RE.test(raw) ||
    HEADLESS_NONZERO_FAILURE_COUNT_RE.test(raw) ||
    HEADLESS_STRUCTURED_FAIL_RE.test(raw) ||
    HEADLESS_JEST_SUMMARY_FAIL_RE.test(raw)
  ) return 1;
  return 0;
}

/**
 * Generate a headless log file path.
 */
function headlessLogPath(projectDir, timestamp) {
  const ts = timestamp || Date.now();
  return path.join(projectDir, ".gsd-t", `headless-${ts}.log`);
}

/**
 * Execute a GSD-T command via claude -p (non-interactive).
 */
function doHeadlessExec(command, cmdArgs, flags) {
  const opts = flags || {};
  const jsonMode = opts.json || false;
  const timeoutMs = (opts.timeout || 300) * 1000;
  const logMode = opts.log || false;
  const startTime = Date.now();
  const timestamp = new Date(startTime).toISOString();

  // Verify claude CLI is available
  try {
    execFileSync("claude", ["--version"], {
      encoding: "utf8", timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"]
    });
  } catch {
    const msg = "claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code";
    if (jsonMode) {
      process.stdout.write(JSON.stringify({
        success: false, exitCode: 3, gsdtExitCode: 3,
        command, args: cmdArgs, output: msg,
        timestamp, duration: Date.now() - startTime, logFile: null
      }) + "\n");
    } else {
      error(msg);
    }
    process.exit(3);
  }

  const prompt = buildHeadlessCmd(command, cmdArgs);
  let logFile = null;

  if (!jsonMode) {
    heading(`GSD-T Headless — ${command}`);
    info(`Prompt: ${prompt}`);
    info(`Timeout: ${opts.timeout || 300}s`);
    if (logMode) {
      logFile = headlessLogPath(process.cwd(), startTime);
      info(`Log: ${logFile}`);
    }
    log("");
  } else if (logMode) {
    logFile = headlessLogPath(process.cwd(), startTime);
  }

  let output = "";
  let processExitCode = 0;

  // Inject command/phase/trace/model/project-dir env vars so worker
  // event-stream entries (writer CLI + heartbeat hook) are tagged in the
  // child's context (Fix 2, v3.12.12; trace/model/project-dir added v3.12.14
  // for the null-telemetry regression fix).
  const workerEnv = Object.assign({}, process.env, {
    GSD_T_COMMAND: `gsd-t-${command}`,
    GSD_T_PHASE: process.env.GSD_T_PHASE || "execute",
    GSD_T_PROJECT_DIR: process.env.GSD_T_PROJECT_DIR || process.cwd(),
  });
  if (process.env.GSD_T_TRACE_ID) workerEnv.GSD_T_TRACE_ID = process.env.GSD_T_TRACE_ID;
  if (process.env.GSD_T_MODEL) workerEnv.GSD_T_MODEL = process.env.GSD_T_MODEL;

  try {
    // GSD-T-LINT: skip stream-json (reason: gsd-t headless one-shot entrypoint — output is buffered into one string by callers, not user-watchable progress)
    const result = execFileSync("claude", ["-p", "--dangerously-skip-permissions", prompt], {
      encoding: "utf8",
      timeout: timeoutMs,
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
      env: workerEnv,
    });
    output = result;
  } catch (e) {
    // execFileSync throws on non-zero exit or timeout
    output = (e.stdout || "") + (e.stderr || "");
    processExitCode = e.status || 1;
    if (e.signal === "SIGTERM" || e.code === "ETIMEDOUT") {
      processExitCode = 3;
      output += "\n[headless: process timed out]";
    }
  }

  const gsdtExitCode = mapHeadlessExitCode(processExitCode, output);
  const duration = Date.now() - startTime;

  // Append to token-log.md (Fix 1, v3.12.12) — headless exec writes a row so
  // `gsd-t headless <command>` spawns are visible in the log.
  appendHeadlessTokenLog(process.cwd(), {
    dtStart: new Date(startTime).toISOString().slice(0, 16).replace("T", " "),
    dtEnd: new Date(startTime + duration).toISOString().slice(0, 16).replace("T", " "),
    command: `gsd-t-${command}`,
    durationS: Math.round(duration / 1000),
    exitCode: gsdtExitCode,
  });

  // Write log file if requested
  if (logMode && logFile) {
    try {
      const gsdtDir = path.join(process.cwd(), ".gsd-t");
      ensureDir(gsdtDir);
      const logContent = [
        `GSD-T Headless Log`,
        `Command: ${command}`,
        `Args: ${cmdArgs.join(" ")}`,
        `Timestamp: ${timestamp}`,
        `Duration: ${duration}ms`,
        `Exit Code: ${gsdtExitCode}`,
        `---`,
        output
      ].join("\n");
      fs.writeFileSync(logFile, logContent);
    } catch (e) {
      if (!jsonMode) warn(`Failed to write log: ${e.message}`);
    }
  }

  if (jsonMode) {
    process.stdout.write(JSON.stringify({
      success: gsdtExitCode === 0,
      exitCode: processExitCode,
      gsdtExitCode,
      command,
      args: cmdArgs,
      output,
      timestamp,
      duration,
      logFile
    }) + "\n");
  } else {
    process.stdout.write(output);
    if (!output.endsWith("\n")) process.stdout.write("\n");
    if (gsdtExitCode !== 0) {
      log("");
      warn(`Exit code: ${gsdtExitCode}`);
    }
  }

  process.exit(gsdtExitCode);
}

// ─── Headless Query ──────────────────────────────────────────────────────────

const VALID_QUERY_TYPES = ["status", "domains", "contracts", "debt", "context", "backlog", "graph"];

function queryResult(type, data) {
  return { type, timestamp: new Date().toISOString(), data };
}

function queryStatus(projectDir) {
  const progressPath = path.join(projectDir, ".gsd-t", "progress.md");
  if (!fs.existsSync(progressPath)) {
    return queryResult("status", { error: "progress.md not found" });
  }
  const content = fs.readFileSync(progressPath, "utf8");
  const versionMatch = content.match(/##\s*Version:\s*(.+)/);
  const projectMatch = content.match(/##\s*Project:\s*(.+)/);
  const statusMatch = content.match(/##\s*Status:\s*(.+)/);
  const milestoneMatch = content.match(/##\s*Active Milestone\s*[\r\n]+\s*(.+)/);
  const phaseMatch = content.match(/Phase:\s*(\w+)/);
  return queryResult("status", {
    version: versionMatch ? versionMatch[1].trim() : null,
    project: projectMatch ? projectMatch[1].trim() : null,
    status: statusMatch ? statusMatch[1].trim() : null,
    activeMilestone: milestoneMatch ? milestoneMatch[1].trim() : null,
    phase: phaseMatch ? phaseMatch[1].trim() : null
  });
}

function queryDomains(projectDir) {
  const domainsDir = path.join(projectDir, ".gsd-t", "domains");
  if (!fs.existsSync(domainsDir)) {
    return queryResult("domains", { domains: [] });
  }
  const entries = fs.readdirSync(domainsDir).filter((f) => {
    const fp = path.join(domainsDir, f);
    return fs.statSync(fp).isDirectory();
  });
  const domains = entries.map((name) => {
    const domainDir = path.join(domainsDir, name);
    return {
      name,
      hasScope: fs.existsSync(path.join(domainDir, "scope.md")),
      hasTasks: fs.existsSync(path.join(domainDir, "tasks.md")),
      hasConstraints: fs.existsSync(path.join(domainDir, "constraints.md"))
    };
  });
  return queryResult("domains", { domains });
}

function queryContracts(projectDir) {
  const contractsDir = path.join(projectDir, ".gsd-t", "contracts");
  if (!fs.existsSync(contractsDir)) {
    return queryResult("contracts", { contracts: [] });
  }
  const contracts = fs.readdirSync(contractsDir)
    .filter((f) => f.endsWith(".md") && f !== ".gitkeep");
  return queryResult("contracts", { contracts });
}

function queryDebt(projectDir) {
  const debtPath = path.join(projectDir, ".gsd-t", "techdebt.md");
  if (!fs.existsSync(debtPath)) {
    return queryResult("debt", { items: [], count: 0 });
  }
  const content = fs.readFileSync(debtPath, "utf8");
  // Parse table rows: | ID | Severity | Description | ...
  const rows = content.split("\n").filter((line) => {
    return line.startsWith("| ") && !line.startsWith("| ID") && !line.startsWith("| ---") && !line.startsWith("| #");
  });
  const items = rows.map((row) => {
    const cells = row.split("|").slice(1, -1).map((c) => c.trim());
    return cells.length >= 2 ? { id: cells[0], severity: cells[1], description: cells[2] || "" } : null;
  }).filter(Boolean);
  return queryResult("debt", { items, count: items.length });
}

function queryContext(projectDir) {
  const tokenLogPath = path.join(projectDir, ".gsd-t", "token-log.md");
  if (!fs.existsSync(tokenLogPath)) {
    return queryResult("context", { entries: [], totalTokens: 0, entryCount: 0 });
  }
  const content = fs.readFileSync(tokenLogPath, "utf8");
  const rows = content.split("\n").filter((line) => {
    return line.startsWith("| ") && !line.startsWith("| Datetime") && !line.startsWith("| ---");
  });
  const entries = rows.map((row) => {
    const cells = row.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 8) return null;
    return {
      datetimeStart: cells[0],
      datetimeEnd: cells[1],
      command: cells[2],
      step: cells[3],
      model: cells[4],
      duration: cells[5],
      notes: cells[6],
      tokens: parseInt(cells[7]) || 0
    };
  }).filter(Boolean);
  const totalTokens = entries.reduce((sum, e) => sum + (e.tokens || 0), 0);
  return queryResult("context", { entries, totalTokens, entryCount: entries.length });
}

function queryBacklog(projectDir) {
  const backlogPath = path.join(projectDir, ".gsd-t", "backlog.md");
  if (!fs.existsSync(backlogPath)) {
    return queryResult("backlog", { items: [], count: 0 });
  }
  const content = fs.readFileSync(backlogPath, "utf8");
  const rows = content.split("\n").filter((line) => {
    return line.startsWith("| ") && !line.startsWith("| #") && !line.startsWith("| ID") && !line.startsWith("| ---");
  });
  const items = rows.map((row) => {
    const cells = row.split("|").slice(1, -1).map((c) => c.trim());
    return cells.length >= 2 ? { id: cells[0], title: cells[1], status: cells[2] || "" } : null;
  }).filter(Boolean);
  return queryResult("backlog", { items, count: items.length });
}

function queryGraph(projectDir) {
  const metaPath = path.join(projectDir, ".gsd-t", "graph-index", "meta.json");
  if (!fs.existsSync(metaPath)) {
    return queryResult("graph", { available: false });
  }
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    return queryResult("graph", {
      available: true,
      provider: meta.provider || "native",
      entityCount: meta.entityCount || 0,
      relationshipCount: meta.relationshipCount || 0,
      lastIndexed: meta.lastIndexed || null
    });
  } catch {
    return queryResult("graph", { available: false, error: "meta.json parse error" });
  }
}

function doHeadlessQuery(type) {
  const projectDir = process.cwd();

  if (!type || !VALID_QUERY_TYPES.includes(type)) {
    const result = { error: "unknown query type", validTypes: VALID_QUERY_TYPES };
    process.stdout.write(JSON.stringify(result) + "\n");
    process.exit(3);
    return;
  }

  let result;
  switch (type) {
    case "status":    result = queryStatus(projectDir); break;
    case "domains":   result = queryDomains(projectDir); break;
    case "contracts": result = queryContracts(projectDir); break;
    case "debt":      result = queryDebt(projectDir); break;
    case "context":   result = queryContext(projectDir); break;
    case "backlog":   result = queryBacklog(projectDir); break;
    case "graph":     result = queryGraph(projectDir); break;
    default:
      result = { error: "unknown query type", validTypes: VALID_QUERY_TYPES };
  }

  process.stdout.write(JSON.stringify(result) + "\n");
}

/**
 * Parse debug-loop flags from args array.
 * Extracts --max-iterations, --test-cmd, --fix-scope, --json, --log from args.
 */
function parseDebugLoopFlags(args) {
  const flags = { maxIterations: 20, testCmd: null, fixScope: null, json: false, log: false };
  const positional = [];
  for (const arg of args) {
    if (arg.startsWith("--max-iterations=")) {
      const n = parseInt(arg.slice("--max-iterations=".length), 10);
      if (!isNaN(n) && n > 0) flags.maxIterations = n;
    } else if (arg.startsWith("--test-cmd=")) {
      flags.testCmd = arg.slice("--test-cmd=".length);
    } else if (arg.startsWith("--fix-scope=")) {
      flags.fixScope = arg.slice("--fix-scope=".length);
    } else if (arg === "--json") {
      flags.json = true;
    } else if (arg === "--log") {
      flags.log = true;
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

/**
 * Return the escalation model for a given iteration number.
 * Tiers: 1-5 → sonnet, 6-15 → opus, 16+ → null (stop)
 */
function getEscalationModel(iteration) {
  if (iteration >= 1 && iteration <= 5) return "sonnet";
  if (iteration >= 6 && iteration <= 15) return "opus";
  return null;
}

/**
 * Spawn a single `claude -p` session and return stdout as a string.
 * Returns null if the process fails.
 */
function spawnClaudeSession(prompt, model) {
  try {
    // v3.12.14: propagate GSD_T_* env vars so the worker's heartbeat hook +
    // event-writer entries are tagged with the parent command/phase/trace and
    // this session's model. Without these, tool_call events from the debug
    // worker appear as command=null/phase=null.
    const env = Object.assign({}, process.env, {
      GSD_T_COMMAND: process.env.GSD_T_COMMAND || "gsd-t-debug",
      GSD_T_PHASE: process.env.GSD_T_PHASE || "debug",
      GSD_T_MODEL: model || process.env.GSD_T_MODEL || null,
      GSD_T_PROJECT_DIR: process.env.GSD_T_PROJECT_DIR || process.cwd(),
    });
    if (env.GSD_T_MODEL === null) delete env.GSD_T_MODEL;
    if (process.env.GSD_T_TRACE_ID) env.GSD_T_TRACE_ID = process.env.GSD_T_TRACE_ID;
    // GSD-T-LINT: skip stream-json (reason: internal debug-loop summarizer; output is consumed as one buffered string by parseTestResult — no progress to stream)
    return execFileSync("claude", ["-p", prompt, "--model", model], {
      encoding: "utf8", timeout: 300000,
      stdio: ["pipe", "pipe", "pipe"],
      env,
    });
  } catch (e) {
    return (e.stdout || "") + (e.stderr || "") || null;
  }
}

/**
 * Parse test pass/fail from claude output.
 * Returns { passed: bool, summary: string }.
 */
function parseTestResult(output) {
  const out = (output || "").toLowerCase();
  const passed =
    /\ball tests? pass(ed|ing)?\b/.test(out) ||
    /\ball \d+ tests? pass/.test(out) ||
    /\bno (test )?failures?\b/.test(out) ||
    /\btests? (all )?pass(ed)?\b/.test(out);
  const failed =
    /\bfail(ed|ing|ure)?\b/.test(out) ||
    /\berror\b/.test(out) ||
    /\bnot ok\b/.test(out);
  const summary = (output || "").slice(0, 500).replace(/\n/g, " ").trim();
  return { passed: passed && !failed, summary };
}

/**
 * Run ledger compaction: spawn haiku to summarize, then compact.
 */
function runLedgerCompaction(projectDir, jsonMode) {
  const entries = debugLedger.readLedger(projectDir);
  const compactPrompt =
    "Read this debug ledger. Produce a condensed summary of what has been tried, " +
    "what failed, and what the evidence suggests. Be concise.\n\n" +
    JSON.stringify(entries, null, 2);
  let summary = "Compacted — see previous entries.";
  try {
    // v3.12.14: propagate GSD_T_* env for telemetry tagging.
    const env = Object.assign({}, process.env, {
      GSD_T_COMMAND: process.env.GSD_T_COMMAND || "gsd-t-debug",
      GSD_T_PHASE: process.env.GSD_T_PHASE || "debug",
      GSD_T_MODEL: "haiku",
      GSD_T_PROJECT_DIR: process.env.GSD_T_PROJECT_DIR || projectDir,
    });
    if (process.env.GSD_T_TRACE_ID) env.GSD_T_TRACE_ID = process.env.GSD_T_TRACE_ID;
    // GSD-T-LINT: skip stream-json (reason: debug-loop ledger compaction — single-shot summarizer, output consumed as one trimmed string)
    const out = execFileSync("claude", ["-p", compactPrompt, "--model", "haiku"], {
      encoding: "utf8", timeout: 120000, stdio: ["pipe", "pipe", "pipe"],
      env,
    });
    summary = (out || "").trim() || summary;
  } catch (e) {
    if (!jsonMode) warn("Compaction haiku session failed — using default summary");
  }
  debugLedger.compactLedger(projectDir, summary);
}

/**
 * Write a per-iteration log file under .gsd-t/.
 */
function writeIterationLog(projectDir, ts, iteration, entry, rawOutput) {
  const logDir = path.join(projectDir, ".gsd-t");
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const fname = `headless-debug-${ts}-iter-${iteration}.log`;
  const content = [
    `Iteration: ${iteration}`,
    `Timestamp: ${entry.timestamp}`,
    `Model: ${entry.model}`,
    `Result: ${entry.result}`,
    `Fix: ${entry.fix}`,
    `Learning: ${entry.learning}`,
    `---`,
    rawOutput || "",
  ].join("\n");
  fs.writeFileSync(path.join(logDir, fname), content);
}

/**
 * Full debug-loop: validate flags, check claude CLI, run iteration cycle.
 */
function doHeadlessDebugLoop(flags) {
  const opts = flags || {};
  const jsonMode = opts.json || false;
  const projectDir = process.cwd();

  if (opts.maxIterations < 1) {
    const msg = "--max-iterations must be >= 1";
    if (jsonMode) process.stdout.write(JSON.stringify({ success: false, exitCode: 3, error: msg }) + "\n");
    else error(msg);
    process.exit(3);
  }

  try {
    execFileSync("claude", ["--version"], { encoding: "utf8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
  } catch {
    const msg = "claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code";
    if (jsonMode) process.stdout.write(JSON.stringify({ success: false, exitCode: 3, error: msg }) + "\n");
    else error(msg);
    process.exit(3);
  }

  if (!jsonMode) {
    heading("GSD-T Headless — Debug Loop");
    info(`Max iterations: ${opts.maxIterations}`);
    if (opts.testCmd) info(`Test command: ${opts.testCmd}`);
    if (opts.fixScope) info(`Fix scope: ${opts.fixScope}`);
    if (opts.log) info(`Logging: enabled`);
    log("");
  }

  const ts = Date.now();

  for (let iteration = 1; iteration <= opts.maxIterations; iteration++) {
    const model = getEscalationModel(iteration);

    // STOP tier: escalation stop
    if (model === null) {
      const entries = debugLedger.readLedger(projectDir);
      const stats = debugLedger.getLedgerStats(projectDir);
      const diagMsg = `ESCALATION STOP at iteration ${iteration}. ` +
        `Entries: ${stats.entryCount}, Failures: ${stats.failCount}. ` +
        `Failed hypotheses:\n${stats.failedHypotheses.map((h, i) => `  ${i + 1}. ${h}`).join("\n")}`;
      if (jsonMode) {
        process.stdout.write(JSON.stringify({ success: false, exitCode: 4, iteration, diagnostic: diagMsg, entries }) + "\n");
      } else {
        log("");
        warn(diagMsg);
      }
      process.exit(4);
    }

    // Check compaction
    const stats = debugLedger.getLedgerStats(projectDir);
    if (stats.needsCompaction) {
      if (!jsonMode) info("Ledger compaction triggered...");
      try { runLedgerCompaction(projectDir, jsonMode); }
      catch { process.exit(2); }
    }

    // Generate preamble and build prompt
    const preamble = debugLedger.generateAntiRepetitionPreamble(projectDir);
    const scopeHint = opts.fixScope ? `\nFix scope: ${opts.fixScope}` : "";
    const testHint = opts.testCmd ? `\nRun tests with: ${opts.testCmd}` : "";
    const prompt = [preamble, `Fix the failing test(s). Write your fix, then run the test suite. Report results.${scopeHint}${testHint}`]
      .filter(Boolean).join("\n\n");

    if (!jsonMode) info(`Iteration ${iteration}/${opts.maxIterations} [${model}]...`);

    const iterStart = Date.now();
    let rawOutput = null;
    try { rawOutput = spawnClaudeSession(prompt, model); }
    catch (e) {
      if (jsonMode) process.stdout.write(JSON.stringify({ success: false, exitCode: 3, iteration, error: String(e) }) + "\n");
      else error(`Process error at iteration ${iteration}: ${e.message}`);
      process.exit(3);
    }
    const duration = Math.round((Date.now() - iterStart) / 1000);

    const { passed, summary } = parseTestResult(rawOutput);
    const result = passed ? "PASS" : "STILL_FAILS";

    // Extract fix description from output (first 200 chars of output)
    const fixDesc = (rawOutput || "").split("\n").find((l) => l.trim().length > 20) || "see output";
    const entry = {
      iteration, timestamp: new Date().toISOString(),
      test: opts.testCmd || "unspecified", error: passed ? "" : summary,
      hypothesis: `iteration-${iteration}`, fix: fixDesc.trim().slice(0, 200),
      fixFiles: [], result, learning: summary.slice(0, 300),
      model, duration,
    };

    try { debugLedger.appendEntry(projectDir, entry); }
    catch (e) {
      if (!jsonMode) warn(`Failed to append ledger entry: ${e.message}`);
    }

    if (opts.log) writeIterationLog(projectDir, ts, iteration, entry, rawOutput);

    if (jsonMode) {
      process.stdout.write(JSON.stringify({ success: passed, exitCode: passed ? 0 : 1, iteration, result, model, duration, summary }) + "\n");
    } else {
      info(`  Result: ${result}`);
    }

    if (passed) {
      debugLedger.clearLedger(projectDir);
      if (!jsonMode) log(`\n${GREEN}All tests pass — debug loop complete.${RESET}`);
      process.exit(0);
    }
  }

  // Max iterations reached
  if (!jsonMode) warn(`Max iterations (${opts.maxIterations}) reached without all tests passing.`);
  process.exit(1);
}

function doHeadless(args) {
  const sub = args[0];
  if (!sub || sub === "--help" || sub === "-h") {
    showHeadlessHelp();
    return;
  }

  if (sub === "--debug-loop") {
    const { flags } = parseDebugLoopFlags(args.slice(1));
    doHeadlessDebugLoop(flags);
    return;
  }

  if (sub === "query") {
    const type = args[1];
    doHeadlessQuery(type);
    return;
  }

  // headless exec: gsd-t headless <command> [cmdArgs...] [flags]
  const { flags, positional } = parseHeadlessFlags(args.slice(1));
  doHeadlessExec(sub, positional, flags);
}

function showHeadlessHelp() {
  log(`\n${BOLD}GSD-T Headless Mode${RESET}\n`);
  log(`${BOLD}Usage:${RESET}`);
  log(`  ${CYAN}gsd-t headless${RESET} <command> [args] [--json] [--timeout=N] [--log]`);
  log(`  ${CYAN}gsd-t headless query${RESET} <type>`);
  log(`  ${CYAN}gsd-t headless --debug-loop${RESET} [--max-iterations=N] [--test-cmd=CMD] [--fix-scope=SCOPE] [--json] [--log]\n`);
  log(`${BOLD}Debug-loop flags:${RESET}`);
  log(`  ${CYAN}--max-iterations=N${RESET}  Hard ceiling on iterations (default: 20)`);
  log(`  ${CYAN}--test-cmd=CMD${RESET}      Override test command`);
  log(`  ${CYAN}--fix-scope=SCOPE${RESET}   Limit fix scope to specific files or test patterns`);
  log(`  ${CYAN}--json${RESET}              Structured JSON output per iteration`);
  log(`  ${CYAN}--log${RESET}               Write per-iteration logs to .gsd-t/\n`);
  log(`${BOLD}Debug-loop escalation tiers:${RESET}`);
  log(`  Iterations 1-5:   sonnet  (standard debug)`);
  log(`  Iterations 6-15:  opus    (deeper reasoning)`);
  log(`  Iterations 16-20: STOP    (exit code 4 — needs human)\n`);
  log(`${BOLD}Debug-loop exit codes:${RESET}`);
  log(`  0  all tests pass`);
  log(`  1  max iterations reached`);
  log(`  2  ledger compaction error`);
  log(`  3  process error`);
  log(`  4  escalation stop — needs human\n`);
  log(`${BOLD}Exec flags:${RESET}`);
  log(`  ${CYAN}--json${RESET}        Structured JSON output`);
  log(`  ${CYAN}--timeout=N${RESET}   Kill after N seconds (default: 300)`);
  log(`  ${CYAN}--log${RESET}         Write output to .gsd-t/headless-{timestamp}.log\n`);
  log(`${BOLD}Exit codes:${RESET}`);
  log(`  0  success`);
  log(`  1  verify-fail`);
  log(`  2  context-budget-exceeded`);
  log(`  3  error`);
  log(`  4  blocked-needs-human\n`);
  log(`${BOLD}Query types:${RESET}`);
  log(`  ${VALID_QUERY_TYPES.join(", ")}\n`);
  log(`${BOLD}Examples:${RESET}`);
  log(`  ${DIM}$${RESET} gsd-t headless verify --json`);
  log(`  ${DIM}$${RESET} gsd-t headless execute --timeout=600 --log`);
  log(`  ${DIM}$${RESET} gsd-t headless query status`);
  log(`  ${DIM}$${RESET} gsd-t headless query domains\n`);
}

// ─── Metrics (removed in v3.12 — M38 meter reduction) ─────────────────────────

function doMetrics(_args) {
  log(`${DIM}metrics removed in v3.12 — context meter is no longer telemetry-instrumented${RESET}`);
}


function showHelp() {
  log(`\n${BOLD}GSD-T${RESET} — Contract-Driven Development for Claude Code\n`);
  log(`${BOLD}Usage:${RESET}  npx @tekyzinc/gsd-t ${CYAN}<command>${RESET} [options]\n`);
  log(`${BOLD}Commands:${RESET}`);
  log(`  ${CYAN}install${RESET}        Install slash commands + global CLAUDE.md`);
  log(`  ${CYAN}update${RESET}         Update global commands + CLAUDE.md`);
  log(`  ${CYAN}update-all${RESET}     Update globally + all registered project CLAUDE.md files`);
  log(`  ${CYAN}init${RESET} [name]    Scaffold GSD-T project (auto-registers)`);
  log(`  ${CYAN}register${RESET}       Register current directory as a GSD-T project`);
  log(`  ${CYAN}status${RESET}         Show installation status + check for updates`);
  log(`  ${CYAN}uninstall${RESET}      Remove GSD-T commands (keeps project files)`);
  log(`  ${CYAN}doctor${RESET}         Diagnose common issues (use --prune to kill dashboard orphans)`);
  log(`  ${CYAN}changelog${RESET}      Open changelog in the browser`);
  log(`  ${CYAN}graph${RESET}          Code graph operations (index, status, query)`);
  log(`  ${CYAN}headless${RESET}       Non-interactive execution via claude -p + fast state queries`);
  log(`  ${CYAN}design-build${RESET}   Deterministic design→code pipeline (elements → widgets → pages)`);
  log(`  ${CYAN}help${RESET}           Show this help\n`);
  log(`${BOLD}Examples:${RESET}`);
  log(`  ${DIM}$${RESET} npx @tekyzinc/gsd-t install`);
  log(`  ${DIM}$${RESET} npx @tekyzinc/gsd-t init my-saas-app`);
  log(`  ${DIM}$${RESET} npx @tekyzinc/gsd-t update\n`);
  log(`${BOLD}After installing, use in Claude Code:${RESET}`);
  log(`  ${DIM}>${RESET} /gsd-t-project "Build a task management app"`);
  log(`  ${DIM}>${RESET} /gsd-t-wave\n`);
  log(`${DIM}Docs: https://github.com/Tekyz-Inc/get-stuff-done-teams${RESET}\n`);
}

// ─── Exports (for testing) ───────────────────────────────────────────────────

module.exports = {
  validateProjectName,
  applyTokens,
  normalizeEol,
  validateVersion,
  validateProjectPath,
  isSymlink,
  hasSymlinkInPath,
  isNewerVersion,
  ensureDir,
  copyFile,
  copyBinToolsToProject,
  hasPlaywright,
  hasSwagger,
  hasApi,
  readProjectDeps,
  readPyContent,
  getCommandFiles,
  getGsdtCommands,
  getUtilityCommands,
  getInstalledCommands,
  getInstalledVersion,
  getRegisteredProjects,
  updateSingleProject,
  updateGlobalCommands,
  showNoProjectsHint,
  showUpdateAllSummary,
  showStatusVersion,
  showStatusCommands,
  showStatusConfig,
  showStatusTeams,
  showStatusProject,
  showInstallSummary,
  showInitTree,
  writeTemplateFile,
  insertGuardSection,
  addHeartbeatHook,
  removeInstalledCommands,
  removeVersionFile,
  checkDoctorClaudeMd,
  checkDoctorSettings,
  checkDoctorEncoding,
  checkDoctorDashboardOrphans,
  doDoctor,
  mergeGsdtSection,
  migrateToMarkers,
  appendGsdtToClaudeMd,
  readSettingsJson,
  readUpdateCache,
  fetchVersionSync,
  refreshVersionAsync,
  doGraph,
  doGraphIndex,
  doGraphStatus,
  doGraphQuery,
  // Headless mode
  parseHeadlessFlags,
  buildHeadlessCmd,
  mapHeadlessExitCode,
  headlessLogPath,
  doHeadlessExec,
  doHeadlessQuery,
  doHeadless,
  // Headless debug-loop
  parseDebugLoopFlags,
  getEscalationModel,
  doHeadlessDebugLoop,
  queryStatus,
  queryDomains,
  queryContracts,
  queryDebt,
  queryContext,
  queryBacklog,
  queryGraph,
  VALID_QUERY_TYPES,
  PKG_VERSION,
  PKG_ROOT,
  PKG_COMMANDS,
  // M27: Cross-project sync
  syncGlobalRulesToProject,
  syncGlobalRules,
  exportUniversalRulesForNpm,
  // M34: Context Meter installer integration
  ensureGitignoreEntries,
  installContextMeter,
  configureContextMeterHooks,
  removeContextMeterHook,
  promptForApiKeyIfMissing,
  resolveApiKeyEnvVar,
  runTaskCounterRetirementMigration,
};

// ─── Main ────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || "help";

  switch (command) {
    case "install":
      doInstall().catch((e) => { error(e.message || String(e)); process.exit(1); });
      break;
    case "update":
      doUpdate().catch((e) => { error(e.message || String(e)); process.exit(1); });
      break;
    case "update-all":
      doUpdateAll().catch((e) => { error(e.message || String(e)); process.exit(1); });
      break;
    case "init": {
      let initProject = null;
      let installHooks = false;
      for (let i = 1; i < args.length; i++) {
        const a = args[i];
        if (a === '--install-hooks') installHooks = true;
        else if (!a.startsWith('-')) initProject = a;
      }
      doInit(initProject)
        .then(() => {
          if (installHooks) installCaptureLintHook(process.cwd());
        })
        .catch((e) => { error(e.message || String(e)); process.exit(1); });
      break;
    }
    case "register":
      doRegister();
      break;
    case "status":
      doStatus();
      break;
    case "uninstall":
      doUninstall();
      break;
    case "doctor": {
      const doctorOpts = { prune: false, installPlaywright: false, installHooks: false, installJourneyHook: false };
      for (let i = 1; i < args.length; i++) {
        if (args[i] === "--prune") doctorOpts.prune = true;
        if (args[i] === "--install-playwright") doctorOpts.installPlaywright = true;
        if (args[i] === "--install-hooks") doctorOpts.installHooks = true;
        if (args[i] === "--install-journey-hook") doctorOpts.installJourneyHook = true;
      }
      doDoctor(doctorOpts).catch((e) => { error(e.message || String(e)); process.exit(1); });
      break;
    }
    case "check-coverage": {
      const cli = path.join(__dirname, "journey-coverage-cli.cjs");
      const { spawnSync } = require("child_process");
      const res = spawnSync(process.execPath, [cli, ...args.slice(1)], { stdio: "inherit" });
      process.exit(res.status == null ? 1 : res.status);
    }
    case "setup-playwright": {
      // Single-project explicit installer. Thin wrapper around installPlaywright().
      const targetDir = args[1] && !args[1].startsWith("-") ? path.resolve(args[1]) : process.cwd();
      heading(`Setup Playwright: ${targetDir}`);
      log("");
      if (!fs.existsSync(targetDir)) {
        error(`Path not found: ${targetDir}`);
        process.exit(1);
      }
      if (hasPlaywright(targetDir)) {
        info("Playwright already configured (playwright.config.* present)");
        process.exit(0);
      }
      if (!hasUI(targetDir)) {
        warn("No UI signal detected. Installing anyway? Re-run with --force to install regardless.");
        const force = args.includes("--force");
        if (!force) {
          info("Skipping. Use --force to install Playwright in a non-UI project.");
          process.exit(0);
        }
      }
      info("Installing Playwright (chromium)…");
      installPlaywright(targetDir)
        .then((r) => {
          if (r.ok) {
            success("Playwright installed (playwright.config.ts + e2e/ scaffold)");
            process.exit(0);
          } else {
            error(`Playwright install failed: ${r.err}`);
            if (r.hint) info(r.hint);
            process.exit(1);
          }
        })
        .catch((e) => { error(e.message || String(e)); process.exit(1); });
      break;
    }
    case "changelog":
      doChangelog();
      break;
    case "graph":
      doGraph(args.slice(1));
      break;
    case "headless":
      doHeadless(args.slice(1));
      break;
    case "parallel": {
      // M44 D2 — `gsd-t parallel` wraps M40 orchestrator with task-level
      // parallelism + mode-aware gating math. Extends, does not replace.
      const { runCli: runParallelCli } = require(path.join(__dirname, "gsd-t-parallel.cjs"));
      const code = runParallelCli(args.slice(1), process.env);
      process.exit(code);
    }
    case "workflow-path": {
      // M69 — print the ABSOLUTE path to a GSD-T workflow script, resolved from
      // this CLI's own install root. Command files shell out to this instead of
      // hard-coding a relative `templates/workflows/...` scriptPath, which only
      // resolves when CWD is the GSD-T source repo — from any consumer project
      // the relative path is unresolvable and `Workflow({scriptPath})` silently
      // fails, forcing a hand-driven fallback (the HiloAviation scan incident).
      //
      // Usage: gsd-t workflow-path <name>   (name with or without the
      //        `gsd-t-` prefix / `.workflow.js` suffix). Exit 0 + path on stdout;
      //        exit 4 + error on stderr if the workflow is unknown.
      const raw = (args[1] || "").trim();
      if (!raw) {
        process.stderr.write("usage: gsd-t workflow-path <name>\n");
        process.exit(64);
      }
      const wfDir = path.join(PKG_ROOT, "templates", "workflows");
      // Normalize: strip a leading "gsd-t-" and a trailing ".workflow.js"/".js",
      // then rebuild the canonical filename.
      const stem = raw
        .replace(/\.workflow\.js$/, "")
        .replace(/\.js$/, "")
        .replace(/^gsd-t-/, "");
      const file = path.join(wfDir, `gsd-t-${stem}.workflow.js`);
      if (!fs.existsSync(file)) {
        const avail = fs.existsSync(wfDir)
          ? fs.readdirSync(wfDir)
              .filter((f) => f.endsWith(".workflow.js"))
              .map((f) => f.replace(/^gsd-t-/, "").replace(/\.workflow\.js$/, ""))
              .join(", ")
          : "(workflows dir missing)";
        process.stderr.write(`gsd-t workflow-path: unknown workflow "${raw}". Available: ${avail}\n`);
        process.exit(4);
      }
      process.stdout.write(file + "\n");
      process.exit(0);
    }
    case "preflight": {
      // M55 D5 — `gsd-t preflight` thin dispatcher to bin/cli-preflight.cjs.
      const { spawnSync } = require("child_process");
      const js = path.join(__dirname, "cli-preflight.cjs");
      const res = spawnSync(process.execPath, [js, ...args.slice(1)], {
        stdio: "inherit",
      });
      process.exit(res.status == null ? 1 : res.status);
    }
    case "brief": {
      // M55 D5 — `gsd-t brief` thin dispatcher to bin/gsd-t-context-brief.cjs.
      const { spawnSync } = require("child_process");
      const js = path.join(__dirname, "gsd-t-context-brief.cjs");
      const res = spawnSync(process.execPath, [js, ...args.slice(1)], {
        stdio: "inherit",
      });
      process.exit(res.status == null ? 1 : res.status);
    }
    case "verify-gate": {
      // M55 D5 — `gsd-t verify-gate` thin dispatcher to bin/gsd-t-verify-gate.cjs.
      const { spawnSync } = require("child_process");
      const js = path.join(__dirname, "gsd-t-verify-gate.cjs");
      const res = spawnSync(process.execPath, [js, ...args.slice(1)], {
        stdio: "inherit",
      });
      process.exit(res.status == null ? 1 : res.status);
    }
    case "verify-gate-judge": {
      // M55 D5 — `gsd-t verify-gate-judge` thin dispatcher to bin/gsd-t-verify-gate-judge.cjs.
      const { spawnSync } = require("child_process");
      const js = path.join(__dirname, "gsd-t-verify-gate-judge.cjs");
      const res = spawnSync(process.execPath, [js, ...args.slice(1)], {
        stdio: "inherit",
      });
      process.exit(res.status == null ? 1 : res.status);
    }
    case "build-coverage": {
      // M57 D1 — `gsd-t build-coverage` thin dispatcher to bin/gsd-t-build-coverage.cjs.
      const { spawnSync } = require("child_process");
      const js = path.join(__dirname, "gsd-t-build-coverage.cjs");
      const res = spawnSync(process.execPath, [js, ...args.slice(1)], {
        stdio: "inherit",
      });
      process.exit(res.status == null ? 1 : res.status);
    }
    case "ci-parity": {
      // M57 D2 — `gsd-t ci-parity` thin dispatcher to bin/gsd-t-ci-parity.cjs.
      const { spawnSync } = require("child_process");
      const js = path.join(__dirname, "gsd-t-ci-parity.cjs");
      const res = spawnSync(process.execPath, [js, ...args.slice(1)], {
        stdio: "inherit",
      });
      process.exit(res.status == null ? 1 : res.status);
    }
    case "test-data": {
      // M58 D1 — `gsd-t test-data --list|--purge` thin dispatcher.
      const { spawnSync } = require("child_process");
      const js = path.join(__dirname, "gsd-t-test-data-ledger.cjs");
      const res = spawnSync(process.execPath, [js, ...args.slice(1)], {
        stdio: "inherit",
      });
      process.exit(res.status == null ? 1 : res.status);
    }
    case "metrics":
      doMetrics(args.slice(1));
      break;
    case "scan": {
      const exportFlag = args.find(a => a.startsWith('--export='));
      const exportFormat = exportFlag ? exportFlag.split('=')[1] : null;
      if (exportFormat) {
        log(`${CYAN}  ℹ${RESET} Export flag noted: will export to ${exportFormat} after scan completes`);
      }
      break;
    }
    case "help":
    case "--help":
    case "-h":
      showHelp();
      break;
    case "--version":
    case "-v":
      log(PKG_VERSION);
      break;
    default:
      error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }

  checkForUpdates(command);
}
