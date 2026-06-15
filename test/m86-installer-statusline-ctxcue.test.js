/**
 * M86 — Installer wiring for the status line + low-context cue hook.
 *
 * Regression guard against the global-bin-propagation-gap: a script that lives
 * in the package but has no installer copy/wire path is dead source — it never
 * reaches projects on `gsd-t install` / `update-all`. Both `statusline-command.sh`
 * and `scripts/hooks/gsd-t-ctx-cue.sh` are canonical sources; this test runs the
 * real installer against a sandbox HOME and asserts:
 *   1. settings.statusLine points at the copied statusline-command.sh (via bash)
 *   2. a Stop hook invokes gsd-t-ctx-cue.sh via `bash`
 *   3. that ctx-cue Stop hook is SYNCHRONOUS (no async:true) — its banner stdout
 *      must reach the terminal (see the script header).
 *   4. both script files are physically copied into ~/.claude/.
 *
 * Black-box by necessity — bin/gsd-t.js is a CLI entry, not a module, so we
 * exercise it through `node bin/gsd-t.js install` with HOME redirected.
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { execFileSync } = require("node:child_process");

const CLI = path.join(__dirname, "..", "bin", "gsd-t.js");

let sandbox;
let settings;

before(() => {
  // realpath the tmp root — the installer refuses paths with a symlinked
  // component (macOS /var -> /private/var), which mkdtemp under os.tmpdir hits.
  const root = fs.realpathSync(os.tmpdir());
  sandbox = fs.mkdtempSync(path.join(root, "gsd-t-install-test-"));
  execFileSync("node", [CLI, "install"], {
    env: { ...process.env, HOME: sandbox },
    stdio: "pipe",
  });
  const settingsPath = path.join(sandbox, ".claude", "settings.json");
  settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
});

after(() => {
  if (sandbox) fs.rmSync(sandbox, { recursive: true, force: true });
});

describe("M86 installer: status line", () => {
  it("sets settings.statusLine to bash + the copied statusline-command.sh", () => {
    assert.ok(settings.statusLine, "statusLine must be configured");
    assert.equal(settings.statusLine.type, "command");
    assert.match(settings.statusLine.command, /^bash /);
    assert.match(settings.statusLine.command, /statusline-command\.sh$/);
  });

  it("copies statusline-command.sh into ~/.claude/", () => {
    const dest = path.join(sandbox, ".claude", "statusline-command.sh");
    assert.ok(fs.existsSync(dest), "statusline-command.sh must be copied");
  });
});

describe("M86 installer: low-context cue hook", () => {
  function ctxCueStopEntries() {
    const stop = (settings.hooks && settings.hooks.Stop) || [];
    const hits = [];
    for (const entry of stop) {
      for (const h of entry.hooks || []) {
        if (typeof h.command === "string" && h.command.includes("gsd-t-ctx-cue.sh")) {
          hits.push(h);
        }
      }
    }
    return hits;
  }

  it("wires gsd-t-ctx-cue.sh as a Stop hook via bash", () => {
    const hits = ctxCueStopEntries();
    assert.equal(hits.length, 1, "exactly one ctx-cue Stop hook expected");
    assert.match(hits[0].command, /^bash /);
  });

  it("registers the ctx-cue hook SYNCHRONOUSLY (no async)", () => {
    // The banner's stdout must reach the terminal — an async hook would swallow
    // it. Guard the property the script header depends on.
    const hits = ctxCueStopEntries();
    assert.notEqual(hits[0].async, true, "ctx-cue Stop hook must NOT be async");
  });

  it("copies gsd-t-ctx-cue.sh into ~/.claude/scripts/hooks/", () => {
    const dest = path.join(sandbox, ".claude", "scripts", "hooks", "gsd-t-ctx-cue.sh");
    assert.ok(fs.existsSync(dest), "gsd-t-ctx-cue.sh must be copied");
  });
});
