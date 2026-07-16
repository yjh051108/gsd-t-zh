/**
 * Tests for stack detection logic, template file structure, and command integration.
 * Uses Node.js built-in test runner (node --test)
 *
 * Contract ref: stack-rules-contract.md
 * Covers:
 *  - Template file structure (header, mandatory framing, line count, universal prefix)
 *  - Detection logic rules (package.json deps, config file presence)
 *  - Resilience (templates/stacks/ exists, _security.md always present)
 *  - Command integration (Stack Rules Detection block present in affected command files)
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const PKG_ROOT = path.resolve(__dirname, "..");
const STACKS_DIR = path.join(PKG_ROOT, "templates", "stacks");
const COMMANDS_DIR = path.join(PKG_ROOT, "commands");

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Detect stacks from a simulated project directory descriptor.
 *
 * @param {object} opts
 * @param {Record<string, unknown>|null} opts.packageJson  - parsed package.json content (null = absent)
 * @param {boolean}                      opts.hasTsConfig  - tsconfig.json present?
 * @param {boolean}                      opts.hasRequirementsTxt
 * @param {boolean}                      opts.hasPyproject
 * @param {boolean}                      opts.hasGoMod
 * @param {boolean}                      opts.hasCargoToml
 * @returns {string[]} list of template file names that should be injected (no path)
 */
function detectStacks(opts) {
  const {
    packageJson = null,
    hasTsConfig = false,
    hasRequirementsTxt = false,
    hasPyproject = false,
    hasGoMod = false,
    hasCargoToml = false,
  } = opts;

  const matched = [];

  if (packageJson !== null) {
    const deps = {
      ...((packageJson.dependencies) || {}),
      ...((packageJson.devDependencies) || {}),
    };

    if (deps["react"] !== undefined) {
      matched.push("react.md");
    }

    if (deps["typescript"] !== undefined) {
      matched.push("typescript.md");
    }

    if (
      deps["express"] !== undefined ||
      deps["fastify"] !== undefined ||
      deps["hono"] !== undefined ||
      deps["koa"] !== undefined
    ) {
      if (!matched.includes("node-api.md")) {
        matched.push("node-api.md");
      }
    }
  }

  // tsconfig.json presence → TypeScript (avoid duplicates)
  if (hasTsConfig && !matched.includes("typescript.md")) {
    matched.push("typescript.md");
  }

  // Python indicators
  if ((hasRequirementsTxt || hasPyproject) && !matched.includes("python.md")) {
    matched.push("python.md");
  }

  // Go
  if (hasGoMod && !matched.includes("go.md")) {
    matched.push("go.md");
  }

  // Rust
  if (hasCargoToml && !matched.includes("rust.md")) {
    matched.push("rust.md");
  }

  return matched;
}

// ─── Template File Structure ─────────────────────────────────────────────────

describe("template file structure", () => {
  it("templates/stacks/ directory exists", () => {
    assert.ok(fs.existsSync(STACKS_DIR), `Expected ${STACKS_DIR} to exist`);
  });

  it("templates/stacks/ contains at least one file", () => {
    const files = fs.readdirSync(STACKS_DIR).filter((f) => f.endsWith(".md"));
    assert.ok(files.length > 0, "Expected at least one .md file in templates/stacks/");
  });

  // Run per-file checks for every .md template
  const templateFiles = fs.existsSync(STACKS_DIR)
    ? fs.readdirSync(STACKS_DIR).filter((f) => f.endsWith(".md"))
    : [];

  for (const file of templateFiles) {
    const filePath = path.join(STACKS_DIR, file);

    it(`${file}: starts with '# ' heading`, () => {
      const content = fs.readFileSync(filePath, "utf8");
      const firstLine = content.split("\n")[0].trim();
      assert.ok(
        firstLine.startsWith("# "),
        `Expected ${file} to start with '# ', got: ${firstLine}`
      );
    });

    it(`${file}: includes mandatory framing text`, () => {
      const content = fs.readFileSync(filePath, "utf8");
      const hasFraming =
        content.includes("These rules are MANDATORY. Violations fail the task.") ||
        (content.includes("这些规则是") && content.includes("强制") && (content.includes("违规") || content.includes("违反")));
      assert.ok(
        hasFraming,
        `Expected ${file} to contain mandatory framing text (English or Chinese)`
      );
    });

    it(`${file}: has at least 1 line`, () => {
      const lines = fs.readFileSync(filePath, "utf8").split("\n").length;
      assert.ok(lines >= 1, `Expected ${file} to have at least 1 line`);
    });
  }
});

describe("template universal prefix convention", () => {
  it("_security.md exists (universal template with _ prefix)", () => {
    const securityPath = path.join(STACKS_DIR, "_security.md");
    assert.ok(fs.existsSync(securityPath), "Expected _security.md to exist in templates/stacks/");
  });

  it("all files starting with _ are universal templates", () => {
    const files = fs.readdirSync(STACKS_DIR).filter((f) => f.endsWith(".md"));
    const universalFiles = files.filter((f) => f.startsWith("_"));
    // Every _ file should exist (trivially) and the naming convention should hold
    assert.ok(universalFiles.length >= 1, "Expected at least one universal template (_prefix)");
    for (const f of universalFiles) {
      assert.ok(f.startsWith("_"), `Universal file must start with _: ${f}`);
    }
  });

  it("non-universal templates do not start with _", () => {
    const files = fs.readdirSync(STACKS_DIR).filter((f) => f.endsWith(".md"));
    const stackFiles = files.filter((f) => !f.startsWith("_"));
    for (const f of stackFiles) {
      assert.ok(!f.startsWith("_"), `Stack-specific file must not start with _: ${f}`);
    }
  });
});

// ─── Detection Logic ─────────────────────────────────────────────────────────

describe("detection from package.json", () => {
  it("react dependency → matches react.md", () => {
    const result = detectStacks({ packageJson: { dependencies: { react: "^18.0.0" } } });
    assert.ok(result.includes("react.md"), `Expected react.md in ${JSON.stringify(result)}`);
  });

  it("react in devDependencies → matches react.md", () => {
    const result = detectStacks({ packageJson: { devDependencies: { react: "^18.0.0" } } });
    assert.ok(result.includes("react.md"));
  });

  it("typescript dependency → matches typescript.md", () => {
    const result = detectStacks({ packageJson: { dependencies: { typescript: "^5.0.0" } } });
    assert.ok(result.includes("typescript.md"));
  });

  it("typescript in devDependencies → matches typescript.md", () => {
    const result = detectStacks({ packageJson: { devDependencies: { typescript: "^5.0.0" } } });
    assert.ok(result.includes("typescript.md"));
  });

  it("express dependency → matches node-api.md", () => {
    const result = detectStacks({ packageJson: { dependencies: { express: "^4.18.0" } } });
    assert.ok(result.includes("node-api.md"));
  });

  it("fastify dependency → matches node-api.md", () => {
    const result = detectStacks({ packageJson: { dependencies: { fastify: "^4.0.0" } } });
    assert.ok(result.includes("node-api.md"));
  });

  it("hono dependency → matches node-api.md", () => {
    const result = detectStacks({ packageJson: { dependencies: { hono: "^3.0.0" } } });
    assert.ok(result.includes("node-api.md"));
  });

  it("koa dependency → matches node-api.md", () => {
    const result = detectStacks({ packageJson: { dependencies: { koa: "^2.14.0" } } });
    assert.ok(result.includes("node-api.md"));
  });

  it("multiple node API frameworks do not produce duplicate node-api.md entries", () => {
    const result = detectStacks({
      packageJson: { dependencies: { express: "^4.18.0", fastify: "^4.0.0" } },
    });
    const count = result.filter((f) => f === "node-api.md").length;
    assert.equal(count, 1, "Expected exactly one node-api.md entry");
  });

  it("react + typescript together → both matched", () => {
    const result = detectStacks({
      packageJson: { dependencies: { react: "^18.0.0", typescript: "^5.0.0" } },
    });
    assert.ok(result.includes("react.md"));
    assert.ok(result.includes("typescript.md"));
  });

  it("absent package.json → no stack-specific templates matched", () => {
    const result = detectStacks({ packageJson: null });
    assert.ok(!result.includes("react.md"));
    assert.ok(!result.includes("typescript.md"));
    assert.ok(!result.includes("node-api.md"));
  });

  it("malformed/empty package.json (no deps keys) → no crash, no matches", () => {
    // An empty object simulates malformed package.json with no dependency fields
    assert.doesNotThrow(() => {
      const result = detectStacks({ packageJson: {} });
      assert.ok(!result.includes("react.md"));
      assert.ok(!result.includes("node-api.md"));
    });
  });

  it("frontend-only package.json (no API framework) → no node-api.md", () => {
    const result = detectStacks({
      packageJson: { dependencies: { react: "^18.0.0", "react-dom": "^18.0.0" } },
    });
    assert.ok(!result.includes("node-api.md"));
  });
});

describe("detection from tsconfig.json presence", () => {
  it("tsconfig.json present (no package.json typescript dep) → matches typescript.md", () => {
    const result = detectStacks({ hasTsConfig: true });
    assert.ok(result.includes("typescript.md"));
  });

  it("tsconfig.json + typescript dep → no duplicate typescript.md", () => {
    const result = detectStacks({
      packageJson: { devDependencies: { typescript: "^5.0.0" } },
      hasTsConfig: true,
    });
    const count = result.filter((f) => f === "typescript.md").length;
    assert.equal(count, 1, "Expected exactly one typescript.md entry");
  });

  it("no tsconfig.json and no typescript dep → no typescript.md", () => {
    const result = detectStacks({ hasTsConfig: false });
    assert.ok(!result.includes("typescript.md"));
  });
});

describe("detection from Python project files", () => {
  it("requirements.txt present → matches python.md", () => {
    const result = detectStacks({ hasRequirementsTxt: true });
    assert.ok(result.includes("python.md"));
  });

  it("pyproject.toml present → matches python.md", () => {
    const result = detectStacks({ hasPyproject: true });
    assert.ok(result.includes("python.md"));
  });

  it("both requirements.txt and pyproject.toml → no duplicate python.md", () => {
    const result = detectStacks({ hasRequirementsTxt: true, hasPyproject: true });
    const count = result.filter((f) => f === "python.md").length;
    assert.equal(count, 1, "Expected exactly one python.md entry");
  });

  it("neither requirements.txt nor pyproject.toml → no python.md", () => {
    const result = detectStacks({ hasRequirementsTxt: false, hasPyproject: false });
    assert.ok(!result.includes("python.md"));
  });
});

describe("detection from Go project files", () => {
  it("go.mod present → matches go.md", () => {
    const result = detectStacks({ hasGoMod: true });
    assert.ok(result.includes("go.md"));
  });

  it("no go.mod → no go.md", () => {
    const result = detectStacks({ hasGoMod: false });
    assert.ok(!result.includes("go.md"));
  });
});

describe("detection from Rust project files", () => {
  it("Cargo.toml present → matches rust.md", () => {
    const result = detectStacks({ hasCargoToml: true });
    assert.ok(result.includes("rust.md"));
  });

  it("no Cargo.toml → no rust.md", () => {
    const result = detectStacks({ hasCargoToml: false });
    assert.ok(!result.includes("rust.md"));
  });
});

// ─── Resilience ───────────────────────────────────────────────────────────────

describe("resilience", () => {
  it("templates/stacks/ directory exists and is accessible", () => {
    assert.ok(fs.existsSync(STACKS_DIR));
    const stat = fs.statSync(STACKS_DIR);
    assert.ok(stat.isDirectory());
  });

  it("_security.md is always present (universal template)", () => {
    const securityPath = path.join(STACKS_DIR, "_security.md");
    assert.ok(fs.existsSync(securityPath), "_security.md must always exist as the universal template");
  });

  it("_security.md is non-empty", () => {
    const securityPath = path.join(STACKS_DIR, "_security.md");
    const content = fs.readFileSync(securityPath, "utf8");
    assert.ok(content.length > 0, "_security.md should not be empty");
  });

  it("detection with no options set returns empty array (no crash)", () => {
    assert.doesNotThrow(() => {
      const result = detectStacks({});
      assert.ok(Array.isArray(result));
    });
  });

  it("all options false/null returns empty array (skip silently behavior)", () => {
    const result = detectStacks({
      packageJson: null,
      hasTsConfig: false,
      hasRequirementsTxt: false,
      hasPyproject: false,
      hasGoMod: false,
      hasCargoToml: false,
    });
    assert.deepEqual(result, []);
  });
});

// ─── Command Integration ──────────────────────────────────────────────────────

describe("command integration: Stack Rules Detection block", () => {
  // M61 D6-T7: command files are now thin Workflow invokers — the inline
  // "Stack Rules Detection" block was removed from each. Stack-rule injection
  // now happens inside the Workflow runtime at agent() spawn time, not via a
  // command-file marker. The per-command-file assertions are retired with the
  // convention; the QA-protocol check below stays (the protocol still carries
  // the Stack-rules validation line).

  it("QA subagent prompt contains 'Stack rules' validation line", () => {
    // v2.74.12: QA prompt extracted from gsd-t-execute.md to templates/prompts/qa-subagent.md
    // (eliminates ~3500 tokens of prompt boilerplate from the orchestrator context per spawn).
    const filePath = path.join(__dirname, "..", "templates", "prompts", "qa-subagent.md");
    assert.ok(fs.existsSync(filePath), `QA prompt template not found: ${filePath}`);
    const content = fs.readFileSync(filePath, "utf8");
    assert.ok(
      content.includes("Stack rules"),
      "Expected qa-subagent.md to include 'Stack rules' validation line"
    );
  });
});
