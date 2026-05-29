/**
 * Tests for filesystem-dependent helpers and CLI subcommands in bin/gsd-t.js
 * Uses Node.js built-in test runner (node --test)
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { execFileSync } = require("node:child_process");

const {
  validateProjectPath,
  isSymlink,
  hasSymlinkInPath,
  ensureDir,
  copyFile,
  hasPlaywright,
  hasSwagger,
  hasApi,
  getCommandFiles,
  getGsdtCommands,
  getUtilityCommands,
  PKG_ROOT,
  PKG_COMMANDS,
} = require("../bin/gsd-t.js");

const CLI = path.join(PKG_ROOT, "bin", "gsd-t.js");

// Temp dir for filesystem tests
let tmpDir;

before(() => {
  tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "gsd-t-test-")));
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── isSymlink ──────────────────────────────────────────────────────────────

describe("isSymlink", () => {
  it("returns false for non-existent path", () => {
    assert.equal(isSymlink(path.join(tmpDir, "nonexistent")), false);
  });

  it("returns false for a regular file", () => {
    const f = path.join(tmpDir, "regular.txt");
    fs.writeFileSync(f, "hello");
    assert.equal(isSymlink(f), false);
  });

  it("returns false for a regular directory", () => {
    assert.equal(isSymlink(tmpDir), false);
  });
});

// ─── hasSymlinkInPath ────────────────────────────────────────────────────────

describe("hasSymlinkInPath", () => {
  it("returns false for a path with no symlinks", () => {
    const d = path.join(tmpDir, "normal", "nested");
    fs.mkdirSync(d, { recursive: true });
    assert.equal(hasSymlinkInPath(d), false);
  });

  it("returns false for non-existent path with real parents", () => {
    const d = path.join(tmpDir, "real-parent", "nonexistent");
    fs.mkdirSync(path.join(tmpDir, "real-parent"), { recursive: true });
    assert.equal(hasSymlinkInPath(d), false);
  });

  it("returns false for the temp dir itself", () => {
    assert.equal(hasSymlinkInPath(tmpDir), false);
  });
});

// ─── ensureDir ──────────────────────────────────────────────────────────────

describe("ensureDir", () => {
  it("creates a new directory and returns true", () => {
    const d = path.join(tmpDir, "new-dir");
    const result = ensureDir(d);
    assert.equal(result, true);
    assert.ok(fs.existsSync(d));
  });

  it("returns false for an existing directory", () => {
    const d = path.join(tmpDir, "existing-dir");
    fs.mkdirSync(d);
    const result = ensureDir(d);
    assert.equal(result, false);
  });

  it("creates nested directories recursively", () => {
    const d = path.join(tmpDir, "a", "b", "c");
    ensureDir(d);
    assert.ok(fs.existsSync(d));
  });
});

// ─── validateProjectPath ────────────────────────────────────────────────────

describe("validateProjectPath", () => {
  it("accepts an existing absolute directory", () => {
    assert.equal(validateProjectPath(tmpDir), true);
  });

  it("rejects a relative path", () => {
    assert.equal(validateProjectPath("relative/path"), false);
  });

  it("rejects a non-existent path", () => {
    assert.equal(validateProjectPath(path.join(tmpDir, "nope")), false);
  });

  it("rejects a file path (not directory)", () => {
    const f = path.join(tmpDir, "file-not-dir.txt");
    fs.writeFileSync(f, "x");
    assert.equal(validateProjectPath(f), false);
  });
});

// ─── copyFile ───────────────────────────────────────────────────────────────

describe("copyFile", () => {
  it("copies a file to destination", () => {
    const src = path.join(tmpDir, "copy-src.txt");
    const dest = path.join(tmpDir, "copy-dest.txt");
    fs.writeFileSync(src, "copy me");
    copyFile(src, dest, "test copy");
    assert.equal(fs.readFileSync(dest, "utf8"), "copy me");
  });
});

// ─── hasPlaywright ──────────────────────────────────────────────────────────

describe("hasPlaywright", () => {
  it("returns false for empty directory", () => {
    const d = path.join(tmpDir, "no-pw");
    fs.mkdirSync(d);
    assert.equal(hasPlaywright(d), false);
  });

  it("detects playwright.config.ts", () => {
    const d = path.join(tmpDir, "pw-ts");
    fs.mkdirSync(d);
    fs.writeFileSync(path.join(d, "playwright.config.ts"), "export default {}");
    assert.equal(hasPlaywright(d), true);
  });

  it("detects playwright.config.js", () => {
    const d = path.join(tmpDir, "pw-js");
    fs.mkdirSync(d);
    fs.writeFileSync(path.join(d, "playwright.config.js"), "module.exports = {}");
    assert.equal(hasPlaywright(d), true);
  });
});

// ─── hasSwagger ─────────────────────────────────────────────────────────────

describe("hasSwagger", () => {
  it("returns false for empty directory", () => {
    const d = path.join(tmpDir, "no-swagger");
    fs.mkdirSync(d);
    assert.equal(hasSwagger(d), false);
  });

  it("detects swagger.json file", () => {
    const d = path.join(tmpDir, "swagger-json");
    fs.mkdirSync(d);
    fs.writeFileSync(path.join(d, "swagger.json"), "{}");
    assert.equal(hasSwagger(d), true);
  });

  it("detects openapi.yaml file", () => {
    const d = path.join(tmpDir, "openapi-yaml");
    fs.mkdirSync(d);
    fs.writeFileSync(path.join(d, "openapi.yaml"), "openapi: 3.0.0");
    assert.equal(hasSwagger(d), true);
  });

  it("detects swagger dependency in package.json", () => {
    const d = path.join(tmpDir, "swagger-dep");
    fs.mkdirSync(d);
    fs.writeFileSync(path.join(d, "package.json"), JSON.stringify({
      dependencies: { "swagger-jsdoc": "^6.0.0" },
    }));
    assert.equal(hasSwagger(d), true);
  });

  it("detects FastAPI in requirements.txt", () => {
    const d = path.join(tmpDir, "fastapi-proj");
    fs.mkdirSync(d);
    fs.writeFileSync(path.join(d, "requirements.txt"), "fastapi==0.100.0\nuvicorn");
    assert.equal(hasSwagger(d), true);
  });
});

// ─── hasApi ─────────────────────────────────────────────────────────────────

describe("hasApi", () => {
  it("returns false for empty directory", () => {
    const d = path.join(tmpDir, "no-api");
    fs.mkdirSync(d);
    assert.equal(hasApi(d), false);
  });

  it("detects express in package.json", () => {
    const d = path.join(tmpDir, "express-proj");
    fs.mkdirSync(d);
    fs.writeFileSync(path.join(d, "package.json"), JSON.stringify({
      dependencies: { express: "^4.18.0" },
    }));
    assert.equal(hasApi(d), true);
  });

  it("detects flask in requirements.txt", () => {
    const d = path.join(tmpDir, "flask-proj");
    fs.mkdirSync(d);
    fs.writeFileSync(path.join(d, "requirements.txt"), "flask==2.3.0\ngunicorn");
    assert.equal(hasApi(d), true);
  });

  it("returns false for frontend-only package.json", () => {
    const d = path.join(tmpDir, "frontend-only");
    fs.mkdirSync(d);
    fs.writeFileSync(path.join(d, "package.json"), JSON.stringify({
      dependencies: { react: "^18.0.0", "react-dom": "^18.0.0" },
    }));
    assert.equal(hasApi(d), false);
  });
});

// ─── getCommandFiles / getGsdtCommands / getUtilityCommands ─────────────────

describe("command listing functions", () => {
  it("getCommandFiles returns all .md files from commands/", () => {
    const files = getCommandFiles();
    assert.ok(files.length > 0);
    assert.ok(files.every((f) => f.endsWith(".md")));
  });

  it("getCommandFiles includes both gsd-t and utility commands", () => {
    const files = getCommandFiles();
    assert.ok(files.some((f) => f.startsWith("gsd-t-")));
    assert.ok(files.some((f) => f === "branch.md"));
  });

  it("getGsdtCommands returns only gsd-t-* commands", () => {
    const gsdt = getGsdtCommands();
    assert.ok(gsdt.length > 0);
    assert.ok(gsdt.every((f) => f.startsWith("gsd-t-")));
  });

  it("getUtilityCommands returns only non-gsd-t commands", () => {
    const utils = getUtilityCommands();
    assert.ok(utils.length > 0);
    assert.ok(utils.every((f) => !f.startsWith("gsd-t-")));
  });

  it("gsd-t + utility counts match total", () => {
    const total = getCommandFiles().length;
    const gsdt = getGsdtCommands().length;
    const utils = getUtilityCommands().length;
    assert.equal(gsdt + utils, total);
  });

  // M38 deleted 7 commands: gsd-t-prompt, gsd-t-brainstorm, gsd-t-discuss (RC);
  // gsd-t-optimization-apply, gsd-t-optimization-reject, gsd-t-reflect, gsd-t-audit (CD).
  // v3.20.11 added cpua (utility command).
  // M61 D2 (v4.0.10) retired gsd-t-unattended, -unattended-watch,
  // -unattended-stop, and gsd-t-visualize (4 commands): total 55→51,
  // gsd-t 49→45. Utility count unchanged at 6.
  it("total command count is 51", () => {
    assert.equal(getCommandFiles().length, 51);
  });

  it("gsd-t command count is 45", () => {
    assert.equal(getGsdtCommands().length, 45);
  });

  it("utility command count is 6", () => {
    assert.equal(getUtilityCommands().length, 6);
  });
});

// ─── CLI subcommand tests ───────────────────────────────────────────────────

describe("CLI subcommands", () => {
  it("--version prints version number", () => {
    const result = execFileSync(process.execPath, [CLI, "--version"], {
      encoding: "utf8",
      timeout: 10000,
    }).trim();
    assert.match(result, /^\d+\.\d+\.\d+$/);
  });

  it("-v prints version number", () => {
    const result = execFileSync(process.execPath, [CLI, "-v"], {
      encoding: "utf8",
      timeout: 10000,
    }).trim();
    assert.match(result, /^\d+\.\d+\.\d+$/);
  });

  it("help subcommand exits with 0", () => {
    const result = execFileSync(process.execPath, [CLI, "help"], {
      encoding: "utf8",
      timeout: 10000,
    });
    assert.ok(result.includes("GSD-T"));
  });

  it("unknown subcommand exits with 1", () => {
    assert.throws(
      () => {
        execFileSync(process.execPath, [CLI, "nonexistent-cmd"], {
          encoding: "utf8",
          timeout: 10000,
        });
      },
      (err) => err.status === 1
    );
  });

  it("status subcommand runs without error", () => {
    const result = execFileSync(process.execPath, [CLI, "status"], {
      encoding: "utf8",
      timeout: 15000,
    });
    assert.ok(typeof result === "string");
  });

  it("doctor subcommand runs without error", () => {
    // doctor exits 1 when any check fails (e.g. missing API key, missing
    // Playwright). The test environment does NOT guarantee a clean project,
    // so we accept both exit 0 (all green) and exit 1 (reported issues).
    // What we're asserting is that doctor RAN — it produced the expected
    // heading and did not crash with a thrown exception / exit >= 2.
    const { spawnSync } = require("child_process");
    const result = spawnSync(process.execPath, [CLI, "doctor"], {
      encoding: "utf8",
      timeout: 15000,
    });
    assert.strictEqual(result.signal, null, "doctor should not be killed");
    assert.ok(
      result.status === 0 || result.status === 1,
      `doctor exit code must be 0 or 1, got ${result.status}`
    );
    assert.ok(
      (result.stdout || "").includes("GSD-T Doctor"),
      "doctor output must contain heading"
    );
  });
});
