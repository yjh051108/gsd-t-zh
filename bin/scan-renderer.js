'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const https = require('https');

const PLACEHOLDER_HTML = '<div class="diagram-placeholder">\n  <p>Diagram unavailable — rendering tools not found</p>\n  <p>Install: <code>npm install -g @mermaid-js/mermaid-cli</code></p>\n</div>';

function stripSvgDimensions(svgStr) {
  return svgStr
    .replace(/<svg([^>]*)\s+width="[^"]*"/, '<svg$1')
    .replace(/<svg([^>]*)\s+height="[^"]*"/, '<svg$1');
}

function makePlaceholder() {
  return PLACEHOLDER_HTML;
}

// M79: shared Mermaid config — coherent dark palette that sits well on the report's
// dark page, ROUNDED node corners, and generous PADDING/spacing so labels (e.g.
// "assign", "resolve") aren't shrink-wrapped against the box edges. Applied to every
// diagram via mmdc's -c flag so all diagrams share one consistent look.
const MERMAID_CONFIG = {
  theme: 'base',
  themeVariables: {
    background: '#0a0f1e',
    primaryColor: '#172554',          // node fill (deep blue, reads on dark)
    primaryBorderColor: '#3b82f6',
    primaryTextColor: '#e2e8f0',
    lineColor: '#64748b',
    secondaryColor: '#1e1b4b',
    tertiaryColor: '#0a2318',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
    fontSize: '15px',
    clusterBkg: '#0b1220',
    clusterBorder: '#1e3a5f',
    nodeBorder: '#3b82f6',
    edgeLabelBackground: '#0b1220',
  },
  flowchart: { curve: 'basis', padding: 18, nodeSpacing: 55, rankSpacing: 70, htmlLabels: true, useMaxWidth: true },
  state: { padding: 16, nodeSpacing: 55, rankSpacing: 70 },
  sequence: { useMaxWidth: true, boxMargin: 12 },
};

function tryMmdc(mmdContent) {
  const ts = Date.now();
  const tmpIn = path.join(os.tmpdir(), 'gsd-scan-' + ts + '.mmd');
  const tmpOut = path.join(os.tmpdir(), 'gsd-scan-' + ts + '.svg');
  const tmpCfg = path.join(os.tmpdir(), 'gsd-scan-' + ts + '.config.json');
  try {
    fs.writeFileSync(tmpIn, mmdContent, 'utf8');
    fs.writeFileSync(tmpCfg, JSON.stringify(MERMAID_CONFIG), 'utf8');
    // -b transparent so the diagram blends into the report's dark panel instead of a
    // white box; -c applies the shared theme/padding/rounded config.
    execFileSync('mmdc', ['-i', tmpIn, '-o', tmpOut, '-c', tmpCfg, '-b', 'transparent', '--quiet'], { timeout: 30000, stdio: 'pipe' });
    const svg = fs.readFileSync(tmpOut, 'utf8');
    return { svgContent: stripSvgDimensions(svg), rendered: true, rendererUsed: 'mermaid-cli' };
  } catch { return null; }
  finally {
    try { fs.unlinkSync(tmpIn); } catch {}
    try { fs.unlinkSync(tmpOut); } catch {}
    try { fs.unlinkSync(tmpCfg); } catch {}
  }
}

function tryD2(mmdContent, type) {
  if (type !== 'system-architecture' && type !== 'data-flow') return null;
  const ts = Date.now();
  const tmpIn = path.join(os.tmpdir(), 'gsd-scan-' + ts + '.d2');
  const tmpOut = path.join(os.tmpdir(), 'gsd-scan-' + ts + '.svg');
  try {
    fs.writeFileSync(tmpIn, 'app -> db: query', 'utf8');
    execFileSync('d2', [tmpIn, tmpOut, '--layout=dagre'], { timeout: 30000, stdio: 'pipe' });
    const svg = fs.readFileSync(tmpOut, 'utf8');
    return { svgContent: stripSvgDimensions(svg), rendered: true, rendererUsed: 'd2' };
  } catch { return null; }
  finally {
    try { fs.unlinkSync(tmpIn); } catch {}
    try { fs.unlinkSync(tmpOut); } catch {}
  }
}

function tryKroki(mmdContent) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ diagram_source: mmdContent });
    const host = process.env.KROKI_HOST || 'kroki.io';
    const options = {
      hostname: host, port: 443,
      path: '/mermaid/svg', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 15000
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        if (data.trimStart().startsWith('<svg')) {
          resolve({ svgContent: stripSvgDimensions(data), rendered: true, rendererUsed: 'kroki' });
        } else { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

function renderDiagram(mmdContent, type, options) {
  try {
    const mmdc = tryMmdc(mmdContent);
    if (mmdc) return mmdc;
    const d2 = tryD2(mmdContent, type);
    if (d2) return d2;
    // tryKroki is async; skip in sync rendering path — Kroki available via async wrapper if needed
    return { svgContent: makePlaceholder(), rendered: false, rendererUsed: 'placeholder' };
  } catch {
    return { svgContent: makePlaceholder(), rendered: false, rendererUsed: 'placeholder' };
  }
}

module.exports = { renderDiagram };
