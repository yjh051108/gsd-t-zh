#!/usr/bin/env node
/**
 * GSD-T Design Review Server — Zero-dep proxy + review coordination
 *
 * Proxies the project dev server (same-origin for iframe DOM access),
 * injects the inspect overlay script, and provides coordination APIs
 * for the builder terminal ↔ human review loop.
 *
 * Usage:
 *   node gsd-t-design-review-server.js [--port 3456] [--target http://localhost:5173] [--project /path/to/project]
 */
const http = require("http");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { localIsoWithOffset } = require(path.join(__dirname, "..", "bin", "gsd-t-time-format.cjs"));
const url = require("url");

// ── CLI args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const PORT = parseInt(getArg("port", "3456"), 10);
const TARGET = getArg("target", "http://localhost:5173");
const PROJECT_DIR = getArg("project", process.cwd());
const REVIEW_DIR = path.join(PROJECT_DIR, ".gsd-t", "design-review");

// ── Framework detection ──────────────────────────────────────────────
function detectFramework() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_DIR, "package.json"), "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.vue || deps["vue-router"]) return "vue";
    if (deps.react || deps["react-dom"]) return "react";
    if (deps.svelte) return "svelte";
    if (deps["@angular/core"]) return "angular";
  } catch { /* no package.json */ }
  return "vue"; // default
}

function findGlobalStyles() {
  const candidates = [
    "src/assets/main.css", "src/assets/index.css", "src/assets/global.css",
    "src/styles/main.css", "src/styles/index.css", "src/styles/global.css",
    "src/index.css", "src/main.css", "src/app.css",
  ];
  return candidates.filter(f => fs.existsSync(path.join(PROJECT_DIR, f)));
}

const FRAMEWORK = detectFramework();
const GLOBAL_STYLES = findGlobalStyles();

function extractFixtureFromContract(componentPath) {
  // Map source path → contract path: src/components/elements/ChartDonut.vue → .gsd-t/contracts/design/elements/chart-donut.contract.md
  const match = componentPath.match(/src\/components\/(\w+)\/(\w+)\.vue$/);
  if (!match) return null;
  const [, tier, name] = match;
  // PascalCase → kebab-case
  const kebab = name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  const contractPath = path.join(PROJECT_DIR, ".gsd-t", "contracts", "design", tier, `${kebab}.contract.md`);
  try {
    const content = fs.readFileSync(contractPath, "utf8");
    const fixtureMatch = content.match(/## Test Fixture[\s\S]*?```json\s*([\s\S]*?)```/);
    if (!fixtureMatch) return null;
    const fixture = JSON.parse(fixtureMatch[1]);
    // Remove metadata keys (__ prefixed)
    const props = {};
    for (const [k, v] of Object.entries(fixture)) {
      if (!k.startsWith("__")) props[k] = v;
    }
    // Check if component expects different props than fixture provides.
    // If fixture has a single array-of-objects key (e.g., "cards": [{value, label}]),
    // and the component file's defineProps doesn't reference that key,
    // unwrap the first item as individual props.
    const propKeys = Object.keys(props);
    if (propKeys.length === 1) {
      const val = props[propKeys[0]];
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
        try {
          const compSource = fs.readFileSync(path.join(PROJECT_DIR, componentPath), "utf8");
          // If the component doesn't reference this array key in defineProps, unwrap first item
          if (!compSource.includes(propKeys[0])) {
            return val[0];
          }
        } catch { /* can't read component, use fixture as-is */ }
      }
    }
    return props;
  } catch { return null; }
}

function readContractForComponent(componentPath) {
  const match = componentPath.match(/src\/components\/(\w+)\/(\w+)\.\w+$/);
  if (!match) return null;
  const [, tier, name] = match;
  const kebab = name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  const contractPath = path.join(PROJECT_DIR, ".gsd-t", "contracts", "design", tier, `${kebab}.contract.md`);
  try { return fs.readFileSync(contractPath, "utf8"); } catch { return null; }
}

function generatePreviewHtml(componentPath) {
  const linkTags = GLOBAL_STYLES.map(s => `  <link rel="stylesheet" href="/${s}">`).join("\n");
  const fixture = extractFixtureFromContract(componentPath);
  const propsJson = fixture ? JSON.stringify(fixture) : "{}";

  let mountScript;
  if (FRAMEWORK === "vue") {
    mountScript = `
  <script type="module">
    import { createApp } from 'vue'
    import Component from '/${componentPath}'
    const props = ${propsJson}
    const app = createApp(Component, props)
    app.mount('#app')
  </script>`;
  } else if (FRAMEWORK === "react") {
    mountScript = `
  <script type="module">
    import React from 'react'
    import { createRoot } from 'react-dom/client'
    import Component from '/${componentPath}'
    const props = ${propsJson}
    createRoot(document.getElementById('app')).render(React.createElement(Component, props))
  </script>`;
  } else {
    mountScript = `<script type="module">import '/${componentPath}'</script>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview: ${path.basename(componentPath)}</title>
${linkTags}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #ffffff; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 32px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
    #app { width: 100%; max-width: 800px; }
    .preview-error { color: #ef4444; font-size: 14px; padding: 16px; border: 1px solid #ef4444; border-radius: 8px; }
  </style>
</head>
<body>
  <div id="app"></div>
  ${mountScript}
  <script src="/review/inject.js"></script>
</body>
</html>`;
}

function generateGalleryHtml(queueItems, cols) {
  const linkTags = GLOBAL_STYLES.map(s => `  <link rel="stylesheet" href="/${s}">`).join("\n");
  // Only include items with source paths (actual components)
  const components = queueItems.filter(item => item.sourcePath);

  const imports = components.map((item, i) => {
    return `    import Comp${i} from '/${item.sourcePath}'`;
  }).join("\n");

  const propsData = components.map((item) => {
    const fixture = extractFixtureFromContract(item.sourcePath);
    return fixture ? JSON.stringify(fixture) : "{}";
  });

  let mountScript;
  if (FRAMEWORK === "vue") {
    mountScript = `
  <script type="module">
    import { createApp, h, defineComponent, onErrorCaptured, ref } from 'vue'
${imports}

    const components = [${components.map((_, i) => `Comp${i}`).join(", ")}];
    const names = ${JSON.stringify(components.map(c => c.name || c.id))};
    const allProps = [${propsData.join(", ")}];

    // Error boundary wrapper — catches render errors per-component
    const SafeCell = defineComponent({
      props: { comp: Object, compProps: Object, label: String },
      setup(props) {
        const error = ref(null)
        onErrorCaptured((err) => { error.value = err.message; return false })
        return () => h('div', { class: 'gallery-cell' }, [
          h('div', { class: 'gallery-label' }, props.label),
          h('div', { class: 'gallery-component' }, [
            error.value
              ? h('div', { style: 'color:#ef4444;font-size:12px;padding:8px' }, '⚠ ' + error.value)
              : h(props.comp, props.compProps)
          ])
        ])
      }
    })

    const Gallery = defineComponent({
      render() {
        return h('div', { class: 'gallery-grid' },
          components.map((Comp, i) =>
            h(SafeCell, { comp: Comp, compProps: allProps[i], label: names[i], key: i })
          )
        )
      }
    })
    createApp(Gallery).mount('#app')
  </script>`;
  } else if (FRAMEWORK === "react") {
    mountScript = `
  <script type="module">
    import React from 'react'
    import { createRoot } from 'react-dom/client'
${imports}

    const components = [${components.map((_, i) => `Comp${i}`).join(", ")}];
    const names = ${JSON.stringify(components.map(c => c.name || c.id))};
    const allProps = [${propsData.join(", ")}];

    function Gallery() {
      return React.createElement('div', { className: 'gallery-grid' },
        components.map((Comp, i) =>
          React.createElement('div', { className: 'gallery-cell', key: i },
            React.createElement('div', { className: 'gallery-label' }, names[i]),
            React.createElement('div', { className: 'gallery-component' },
              React.createElement(Comp, allProps[i])
            )
          )
        )
      )
    }
    createRoot(document.getElementById('app')).render(React.createElement(Gallery))
  </script>`;
  } else {
    mountScript = `<script type="module">/* unsupported framework */</script>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GSD-T Design Gallery</title>
${linkTags}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #f1f5f9; min-height: 100vh; padding: 24px; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif; }
    #app { width: 100%; }
    .gallery-grid { display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 20px; }
    .gallery-cell { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; overflow: hidden; }
    .gallery-label { font-size: 12px; font-weight: 600; color: #64748b; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; font-family: monospace; }
    .gallery-component { min-height: 60px; }
  </style>
</head>
<body>
  <div id="app"></div>
  ${mountScript}
</body>
</html>`;
}

// ── Ensure coordination directory ─────────────────────────────────────
function ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* exists */ }
}
ensureDir(REVIEW_DIR);
ensureDir(path.join(REVIEW_DIR, "queue"));
ensureDir(path.join(REVIEW_DIR, "feedback"));

// Init status if missing
const STATUS_FILE = path.join(REVIEW_DIR, "status.json");
if (!fs.existsSync(STATUS_FILE)) {
  fs.writeFileSync(STATUS_FILE, JSON.stringify({
    phase: "elements",
    state: "waiting",
    startedAt: new Date().toISOString(),
  }, null, 2));
}

// ── SSE clients ───────────────────────────────────────────────────────
const sseClients = new Set();

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(msg); } catch { sseClients.delete(res); }
  }
}

// Watch queue directory for changes — auto-reject items with CRITICAL measurement failures
let queueWatcher;
try {
  queueWatcher = fs.watch(path.join(REVIEW_DIR, "queue"), () => {
    autoRejectFailures();
    broadcast("queue-update", readQueue());
  });
} catch { /* dir may not exist yet */ }

function autoRejectFailures() {
  const queueDir = path.join(REVIEW_DIR, "queue");
  const fbDir = path.join(REVIEW_DIR, "feedback");
  ensureDir(fbDir);
  try {
    const files = fs.readdirSync(queueDir).filter(f => f.endsWith(".json"));
    for (const f of files) {
      try {
        const item = JSON.parse(fs.readFileSync(path.join(queueDir, f), "utf8"));
        if (!item.measurements || !Array.isArray(item.measurements)) continue;
        // Check for CRITICAL failures (auto-reject threshold)
        const failures = item.measurements.filter(m => !m.pass);
        const criticalFailures = failures.filter(m =>
          m.severity === "critical" ||
          m.property === "chart type" ||
          m.property === "display" ||
          m.property === "flexDirection" ||
          m.property === "grid-template-columns" ||
          m.property === "gridTemplateColumns" ||
          m.property === "columns-per-row" ||
          m.property === "children-per-row"
        );
        if (criticalFailures.length > 0) {
          // Auto-reject: write feedback and remove from queue
          const feedback = {
            id: item.id,
            verdict: "rejected",
            source: "auto-review",
            comment: `Auto-rejected: ${criticalFailures.length} critical measurement failures: ${criticalFailures.map(m => `${m.property} (expected: ${m.expected}, got: ${m.actual})`).join("; ")}`,
            changes: [],
            rejectedAt: new Date().toISOString(),
          };
          fs.writeFileSync(path.join(fbDir, `${item.id}.json`), JSON.stringify(feedback, null, 2));
          // Move item to rejected (don't delete, move to a rejected subfolder)
          ensureDir(path.join(REVIEW_DIR, "rejected"));
          fs.renameSync(path.join(queueDir, f), path.join(REVIEW_DIR, "rejected", f));
          broadcast("auto-reject", { id: item.id, failures: criticalFailures });
          console.log(`  ✗ Auto-rejected: ${item.name} — ${criticalFailures.length} critical failures`);
        }
      } catch { /* skip malformed */ }
    }
  } catch { /* no queue dir yet */ }
}

// ── Coordination API ──────────────────────────────────────────────────

function readQueue() {
  const queueDir = path.join(REVIEW_DIR, "queue");
  try {
    const items = fs.readdirSync(queueDir)
      .filter(f => f.endsWith(".json") && !f.includes(".ai-review"))
      .map(f => {
        try { return JSON.parse(fs.readFileSync(path.join(queueDir, f), "utf8")); }
        catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    // Attach AI review annotations if they exist
    for (const item of items) {
      const aiFile = path.join(queueDir, `${item.id}.ai-review.json`);
      try {
        if (fs.existsSync(aiFile)) {
          item.aiReview = JSON.parse(fs.readFileSync(aiFile, "utf8"));
        }
      } catch { /* skip malformed */ }
    }
    return items;
  } catch { return []; }
}

function readStatus() {
  try { return JSON.parse(fs.readFileSync(STATUS_FILE, "utf8")); }
  catch { return { phase: "elements", state: "waiting" }; }
}

function readFeedback() {
  const fbDir = path.join(REVIEW_DIR, "feedback");
  try {
    return fs.readdirSync(fbDir)
      .filter(f => f.endsWith(".json"))
      .map(f => {
        try { return JSON.parse(fs.readFileSync(path.join(fbDir, f), "utf8")); }
        catch { return null; }
      })
      .filter(Boolean);
  } catch { return []; }
}

function persistAttachments(item) {
  if (!Array.isArray(item.attachments) || item.attachments.length === 0) return item;
  const attDir = path.join(REVIEW_DIR, "feedback", "attachments");
  ensureDir(attDir);
  const persisted = [];
  item.attachments.forEach((att, idx) => {
    if (!att || typeof att.dataUrl !== "string") return;
    const m = att.dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!m) return;
    const mime = m[1];
    const ext = mime.split("/")[1].replace("+xml", "").replace("jpeg", "jpg");
    const ts = Date.now();
    const safeId = String(item.id).replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${safeId}-${ts}-${idx}.${ext}`;
    const absPath = path.join(attDir, filename);
    try {
      fs.writeFileSync(absPath, Buffer.from(m[2], "base64"));
      persisted.push({
        name: att.name || filename,
        path: path.relative(REVIEW_DIR, absPath),
        mime,
        size: Buffer.byteLength(m[2], "base64"),
      });
    } catch {}
  });
  return { ...item, attachments: persisted };
}

function writeFeedback(items) {
  const fbDir = path.join(REVIEW_DIR, "feedback");
  ensureDir(fbDir);
  for (const rawItem of items) {
    const item = persistAttachments(rawItem);
    const fname = `${item.id}.json`;
    fs.writeFileSync(path.join(fbDir, fname), JSON.stringify(item, null, 2));
  }
  // Write a summary signal file so the builder knows review is done
  fs.writeFileSync(
    path.join(REVIEW_DIR, "review-complete.json"),
    JSON.stringify({
      // M59 (v3.29.10): local-offset ISO (`YYYY-MM-DDTHH:MM:SS±HH:MM`) rather than UTC `Z`.
      completedAt: localIsoWithOffset(),
      phase: readStatus().phase,
      items: items.map(i => ({ id: i.id, verdict: i.verdict })),
    }, null, 2)
  );
}

// ── Proxy helper ──────────────────────────────────────────────────────
const targetUrl = new URL(TARGET);

function proxyRequest(req, res) {
  const opts = {
    hostname: targetUrl.hostname,
    port: targetUrl.port,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `${targetUrl.hostname}:${targetUrl.port}` },
  };

  const proxyReq = http.request(opts, (proxyRes) => {
    const contentType = proxyRes.headers["content-type"] || "";
    const isHtml = contentType.includes("text/html");

    if (isHtml) {
      // Buffer HTML to inject our overlay script
      const chunks = [];
      proxyRes.on("data", (chunk) => chunks.push(chunk));
      proxyRes.on("end", () => {
        let html = Buffer.concat(chunks).toString("utf8");
        // Inject the review overlay script before </body>
        const injectScript = `<script src="/review/inject.js"></script>`;
        if (html.includes("</body>")) {
          html = html.replace("</body>", `${injectScript}\n</body>`);
        } else {
          html += injectScript;
        }
        // Update content-length
        const buf = Buffer.from(html, "utf8");
        const headers = { ...proxyRes.headers };
        headers["content-length"] = buf.length;
        delete headers["content-encoding"]; // remove gzip if present
        res.writeHead(proxyRes.statusCode, headers);
        res.end(buf);
      });
    } else {
      // Pass through non-HTML responses
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  });

  proxyReq.on("error", (err) => {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Dev server unreachable", details: err.message }));
  });

  req.pipe(proxyReq);
}

// ── Static files ──────────────────────────────────────────────────────
const SCRIPT_DIR = __dirname;

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function serveFile(filePath, res) {
  try {
    const ext = path.extname(filePath);
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-cache" });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

// ── HTTP Server ───────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // ── Review UI routes ────────────────────────────────────────────
  if (pathname === "/review" || pathname === "/review/") {
    serveFile(path.join(SCRIPT_DIR, "gsd-t-design-review.html"), res);
    return;
  }

  if (pathname === "/review/inject.js") {
    serveFile(path.join(SCRIPT_DIR, "gsd-t-design-review-inject.js"), res);
    return;
  }

  // Gallery — all queued components in a grid, proxied through Vite
  if (pathname === "/review/gallery") {
    const queueItems = readQueue();
    const cols = parseInt(parsed.query.cols || "3", 10);
    if (queueItems.length === 0) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><body><h2>No components queued yet</h2></body></html>");
      return;
    }
    const html = generateGalleryHtml(queueItems, cols);
    const previewFile = path.join(PROJECT_DIR, "__gsd-preview.html");
    try { fs.writeFileSync(previewFile, html); } catch { /* ignore */ }
    const proxyOpts = {
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      path: "/__gsd-preview.html",
      method: "GET",
      headers: { ...req.headers, host: `${targetUrl.hostname}:${targetUrl.port}` },
    };
    const proxyReq = http.request(proxyOpts, (proxyRes) => {
      const chunks = [];
      proxyRes.on("data", (chunk) => chunks.push(chunk));
      proxyRes.on("end", () => {
        const transformed = Buffer.concat(chunks).toString("utf8");
        const buf = Buffer.from(transformed, "utf8");
        res.writeHead(proxyRes.statusCode, {
          ...proxyRes.headers,
          "content-length": buf.length,
          "cache-control": "no-cache",
        });
        res.end(buf);
        try { fs.unlinkSync(previewFile); } catch { /* ignore */ }
      });
    });
    proxyReq.on("error", () => {
      res.writeHead(502, { "Content-Type": "text/html" });
      res.end("<h1>Dev server unreachable</h1>");
      try { fs.unlinkSync(previewFile); } catch { /* ignore */ }
    });
    proxyReq.end();
    return;
  }

  // Component preview — writes temp HTML to project, proxies through Vite for module resolution
  if (pathname === "/review/preview") {
    const component = parsed.query.component;
    if (!component) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Missing ?component= parameter");
      return;
    }
    // Write preview HTML to project dir so Vite transforms bare module specifiers (e.g., 'vue' → /node_modules/.vite/deps/vue.js)
    const previewFile = path.join(PROJECT_DIR, "__gsd-preview.html");
    const html = generatePreviewHtml(component);
    try { fs.writeFileSync(previewFile, html); } catch { /* ignore */ }
    // Proxy through Vite so it transforms the HTML
    const proxyOpts = {
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      path: "/__gsd-preview.html",
      method: "GET",
      headers: { ...req.headers, host: `${targetUrl.hostname}:${targetUrl.port}` },
    };
    const proxyReq = http.request(proxyOpts, (proxyRes) => {
      const chunks = [];
      proxyRes.on("data", (chunk) => chunks.push(chunk));
      proxyRes.on("end", () => {
        let transformed = Buffer.concat(chunks).toString("utf8");
        // Inject review overlay if not already present
        if (!transformed.includes("review/inject.js")) {
          transformed = transformed.replace("</body>", '<script src="/review/inject.js"></script>\n</body>');
        }
        const buf = Buffer.from(transformed, "utf8");
        res.writeHead(proxyRes.statusCode, {
          ...proxyRes.headers,
          "content-length": buf.length,
          "cache-control": "no-cache",
        });
        res.end(buf);
        // Clean up temp file
        try { fs.unlinkSync(previewFile); } catch { /* ignore */ }
      });
    });
    proxyReq.on("error", () => {
      res.writeHead(502, { "Content-Type": "text/html" });
      res.end("<h1>Dev server unreachable</h1>");
      try { fs.unlinkSync(previewFile); } catch { /* ignore */ }
    });
    proxyReq.end();
    return;
  }

  // ── Review API ──────────────────────────────────────────────────
  if (pathname === "/review/api/status") {
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(readStatus()));
    return;
  }

  if (pathname === "/review/api/queue") {
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(readQueue()));
    return;
  }

  if (pathname === "/review/api/fixture") {
    const component = parsed.query.component;
    const fixture = component ? extractFixtureFromContract(component) : null;
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(fixture || {}));
    return;
  }

  if (pathname === "/review/api/contract") {
    const component = parsed.query.component;
    const content = component ? readContractForComponent(component) : null;
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ content: content || "" }));
    return;
  }

  if (pathname === "/review/api/ai-assist" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const { messages, componentContext } = JSON.parse(body);

        // Build a single prompt from system context + conversation history
        const systemLines = [
          "You are a design review assistant. A human is reviewing UI components against design contracts in the GSD-T Design Review panel.",
          "Help them:",
          "1. Answer questions about the component (properties, styles, measurements, data)",
          "2. Translate vague corrections into precise, actionable contract language",
          "3. Suggest specific property changes in the format: property: current → target",
          "",
          "Be concise. When suggesting corrections, format them so they can be pasted directly as a review comment.",
          "",
          "=== Component Context ===",
          componentContext || "(no component selected)",
          "=== End Context ===",
        ];

        // Include conversation history for multi-turn
        if (messages && messages.length > 1) {
          systemLines.push("", "=== Conversation History ===");
          for (const msg of messages.slice(0, -1)) {
            systemLines.push(`${msg.role === "user" ? "Human" : "Assistant"}: ${msg.content}`);
          }
          systemLines.push("=== End History ===");
        }

        const lastMessage = messages && messages.length > 0 ? messages[messages.length - 1].content : "";
        const fullPrompt = systemLines.join("\n") + "\n\nHuman: " + lastMessage;
        const model = process.env.GSD_AI_ASSIST_MODEL || "opus";

        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*",
        });

        // v3.12.14: propagate GSD_T_* env for telemetry tagging in the worker.
        const childEnv = {
          ...process.env,
          NO_COLOR: "1",
          GSD_T_COMMAND: process.env.GSD_T_COMMAND || "gsd-t-design-review",
          GSD_T_PHASE: process.env.GSD_T_PHASE || "design-review",
          GSD_T_MODEL: model || process.env.GSD_T_MODEL || "unknown",
        };
        if (process.env.GSD_T_TRACE_ID) childEnv.GSD_T_TRACE_ID = process.env.GSD_T_TRACE_ID;
        if (process.env.GSD_T_PROJECT_DIR) childEnv.GSD_T_PROJECT_DIR = process.env.GSD_T_PROJECT_DIR;
        // Pre-M41 code: design-review server streams stream-json and parses
        // usage envelopes itself. Out of scope for D5 wrapper conversion.
        const claude = spawn("claude", [ // GSD-T-CAPTURE-LINT: skip
          "-p", fullPrompt,
          "--model", model,
          "--output-format", "stream-json",
          "--verbose",
        ], { env: childEnv });

        let buf = "";
        let textSent = 0;

        claude.stdout.on("data", (chunk) => {
          buf += chunk.toString();
          const lines = buf.split("\n");
          buf = lines.pop();
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const evt = JSON.parse(line);
              if (evt.type === "assistant" && evt.message?.content) {
                for (const block of evt.message.content) {
                  if (block.type === "text" && block.text) {
                    const newText = block.text.slice(textSent);
                    if (newText) {
                      res.write(`data: ${JSON.stringify({ text: newText })}\n\n`);
                      textSent = block.text.length;
                    }
                  }
                }
              }
            } catch { /* skip non-JSON lines */ }
          }
        });

        claude.stderr.on("data", () => { /* suppress stderr */ });

        claude.on("close", (code) => {
          if (!res.writableEnded) {
            if (code !== 0 && textSent === 0) {
              res.write(`event: error\ndata: ${JSON.stringify({ error: "Claude CLI exited with code " + code + ". Is claude installed and authenticated?" })}\n\n`);
            }
            res.write("event: done\ndata: {}\n\n");
            res.end();
          }
        });

        claude.on("error", (err) => {
          if (!res.writableEnded) {
            res.write(`event: error\ndata: ${JSON.stringify({ error: "Failed to spawn claude: " + err.message + ". Install Claude Code CLI to enable AI assist." })}\n\n`);
            res.write("event: done\ndata: {}\n\n");
            res.end();
          }
        });
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === "/review/api/feedback" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(readFeedback()));
    return;
  }

  if (pathname === "/review/api/feedback" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const items = JSON.parse(body);
        writeFeedback(Array.isArray(items) ? items : [items]);
        broadcast("feedback-submitted", { count: Array.isArray(items) ? items.length : 1 });
        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === "/review/api/exclude" && req.method === "POST") {
    // Remove excluded elements: delete contract files and remove from queue
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const { excludedIds } = JSON.parse(body);
        const removed = [];
        for (const id of excludedIds) {
          const item = reviewQueue.find(q => q.id === id);
          if (!item || !item.sourcePath) continue;
          const match = item.sourcePath.match(/src\/components\/(\w+)\/(\w+)\.vue$/);
          if (!match) continue;
          const [, tier, name] = match;
          const kebab = name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
          const contractPath = path.join(PROJECT_DIR, ".gsd-t", "contracts", "design", tier, `${kebab}.contract.md`);
          if (fs.existsSync(contractPath)) {
            fs.unlinkSync(contractPath);
            removed.push({ id, contract: contractPath });
          }
          // Remove source file too
          const srcPath = path.join(PROJECT_DIR, item.sourcePath);
          if (fs.existsSync(srcPath)) {
            fs.unlinkSync(srcPath);
            removed.push({ id, source: srcPath });
          }
        }
        // Remove from queue (memory + disk)
        for (let i = reviewQueue.length - 1; i >= 0; i--) {
          if (excludedIds.includes(reviewQueue[i].id)) {
            // Delete queue JSON file from disk
            const queueFile = path.join(REVIEW_DIR, "queue", `${reviewQueue[i].id}.json`);
            try { if (fs.existsSync(queueFile)) fs.unlinkSync(queueFile); } catch {}
            reviewQueue.splice(i, 1);
          }
        }
        broadcast("queue-update", reviewQueue);
        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ ok: true, removed }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === "/review/api/write-source" && req.method === "POST") {
    // Apply CSS property changes back to source files
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const { changes } = JSON.parse(body);
        // Changes are stored for the builder to process
        // (Claude will interpret CSS changes → Tailwind class changes)
        const changesFile = path.join(REVIEW_DIR, "pending-changes.json");
        fs.writeFileSync(changesFile, JSON.stringify(changes, null, 2));
        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ ok: true, count: changes.length }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // ── SSE stream ──────────────────────────────────────────────────
  if (pathname === "/review/api/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    // Send initial state
    res.write(`event: init\ndata: ${JSON.stringify({ status: readStatus(), queue: readQueue() })}\n\n`);
    return;
  }

  // ── Proxy everything else to dev server ─────────────────────────
  proxyRequest(req, res);
});

// ── WebSocket upgrade for Vite HMR ───────────────────────────────────
server.on("upgrade", (req, socket, head) => {
  const opts = {
    hostname: targetUrl.hostname,
    port: targetUrl.port,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };

  const proxyReq = http.request(opts);
  proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\n` +
      Object.entries(proxyRes.headers).map(([k, v]) => `${k}: ${v}`).join("\r\n") +
      "\r\n\r\n"
    );
    if (proxyHead.length) socket.write(proxyHead);
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxyReq.on("error", () => socket.end());
  proxyReq.end();
});

server.listen(PORT, () => {
  const BOLD = "\x1b[1m";
  const GREEN = "\x1b[32m";
  const CYAN = "\x1b[36m";
  const DIM = "\x1b[2m";
  const RESET = "\x1b[0m";

  console.log(`\n${BOLD}GSD-T Design Review Server${RESET}`);
  console.log(`${GREEN}  ✓${RESET} Review UI:  ${CYAN}http://localhost:${PORT}/review${RESET}`);
  console.log(`${GREEN}  ✓${RESET} Proxying:   ${DIM}${TARGET} → http://localhost:${PORT}/${RESET}`);
  console.log(`${GREEN}  ✓${RESET} Project:    ${DIM}${PROJECT_DIR}${RESET}`);
  console.log(`${GREEN}  ✓${RESET} Framework:  ${DIM}${FRAMEWORK}${RESET}`);
  if (GLOBAL_STYLES.length > 0) {
    console.log(`${GREEN}  ✓${RESET} Styles:     ${DIM}${GLOBAL_STYLES.join(", ")}${RESET}`);
  }
  console.log(`${DIM}  Coordination: ${REVIEW_DIR}${RESET}\n`);
});
