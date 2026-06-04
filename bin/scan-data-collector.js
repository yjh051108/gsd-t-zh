'use strict';
const fs = require('fs');
const path = require('path');

function read(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return ''; }
}

function parseDebtSummary(text) {
  const n = (pattern) => { const m = text.match(pattern); return m ? parseInt(m[1], 10) : 0; };
  // Legacy prose format ("Critical items: N").
  let out = {
    debtCritical: n(/Critical items?:\s*(\d+)/i),
    debtHigh:     n(/High priority:\s*(\d+)/i),
    debtMedium:   n(/Medium priority:\s*(\d+)/i)
  };
  // M77: deep-scan register uses a markdown SEVERITY TABLE instead, e.g.
  //   | 🔴 CRITICAL | 9 |   /   | HIGH | 90 |   (emoji optional, case-insensitive).
  // If the prose format yielded nothing, parse the table rows.
  if (!out.debtCritical && !out.debtHigh && !out.debtMedium) {
    const row = (label) => {
      // a table row whose first cell contains the label and whose next cell is a number
      const re = new RegExp("\\|[^|\\n]*\\b" + label + "\\b[^|\\n]*\\|\\s*\\**\\s*(\\d+)\\s*\\**\\s*\\|", "i");
      const m = text.match(re);
      return m ? parseInt(m[1], 10) : 0;
    };
    out = { debtCritical: row("CRITICAL"), debtHigh: row("HIGH"), debtMedium: row("MEDIUM") };
  }
  return out;
}

function parseTestCoverage(text) {
  const total   = text.match(/Total tests\s*\|\s*(\d+)/i);
  const passing = text.match(/Passing\s*\|\s*(\d+)/i);
  if (total && passing) return parseInt(passing[1], 10) + '/' + parseInt(total[1], 10);
  return 'N/A';
}

function parseFilesAndLoc(text) {
  const m = text.match(/\|\s*\*?\*?(?:Grand\s+)?Total[^|]*\*?\*?\s*\|\s*\*?\*?(\d+)\s+files?\*?\*?\s*\|\s*\*?\*?([\d,]+)[^|]*\*?\*?\s*\|/i);
  if (m) return { filesScanned: parseInt(m[1], 10), totalLoc: parseInt(m[2].replace(/,/g, ''), 10) };
  let files = 0;
  let loc = 0;
  const lineRe = /(\d+)\s+files?\s*\(\s*~?\s*([\d,]+)\s+LOC\s*\)/gi;
  let match;
  while ((match = lineRe.exec(text)) !== null) {
    files += parseInt(match[1], 10);
    loc += parseInt(match[2].replace(/,/g, ''), 10);
  }
  if (files > 0) return { filesScanned: files, totalLoc: loc };
  return { filesScanned: 0, totalLoc: 0 };
}

function parseComponents(text) {
  const sec = text.match(/## Component Inventory([\s\S]*?)(?=\n## |\n---|\n#[^#]|$)/);
  if (sec) {
    const tableRows = sec[1].split('\n')
      .filter(l => /^\|/.test(l) && !/---/.test(l) && !/Component.*File/i.test(l))
      .map(row => {
        const cols = row.split('|').map(c => c.trim().replace(/\*\*/g, '').replace(/`/g, '')).filter(Boolean);
        if (cols.length < 3) return null;
        const name = cols[0];
        if (!name || /^total/i.test(name)) return null;
        return { name, filePath: cols[1] || '', size: cols[2] || '', purpose: cols[3] || '', files: 1, healthScore: 80 };
      })
      .filter(Boolean);
    if (tableRows.length > 0) return tableRows;
  }
  const structSec = text.match(/## Structure([\s\S]*?)(?=\n## |\n---|\n#[^#]|$)/);
  if (!structSec) return [];
  const entryRe = /^([a-zA-Z0-9_.\-]+\/)\s+(?:~?\s*)?(?:(\d+)\s+files?\s*)?\(?\s*~?\s*([\d,]+)\s+LOC\s*\)?\s*(.*)$/gm;
  const out = [];
  let m;
  while ((m = entryRe.exec(structSec[1])) !== null) {
    const name = m[1].replace(/\/$/, '');
    out.push({
      name,
      filePath: m[1],
      size: (m[2] ? m[2] + ' files, ' : '') + m[3] + ' LOC',
      purpose: (m[4] || '').trim(),
      files: m[2] ? parseInt(m[2], 10) : 1,
      healthScore: 80,
    });
  }
  return out;
}

function parseSeverityMap(text) {
  const map = {};
  const high = text.match(/High priority:[^\n]*\(([^)]+)\)/i);
  if (high) {
    high[1].split(',').forEach(part => { const m = part.trim().match(/TD-\d+/); if (m) map[m[0]] = 'high'; });
  }
  const med = text.match(/Medium priority:[^\n]*\(([^)]+)\)/i);
  if (med) {
    med[1].split(',').forEach(part => {
      const r = part.trim().match(/TD-(\d+)[–\-](\d+)/);
      if (r) {
        for (let i = parseInt(r[1]); i <= parseInt(r[2]); i++) {
          map['TD-' + String(i).padStart(3, '0')] = 'medium';
        }
      } else { const m = part.trim().match(/TD-\d+/); if (m) map[m[0]] = 'medium'; }
    });
  }
  return map;
}

function parseTechDebtItems(qualText, debtText) {
  if (!qualText) return [];
  const severityMap = parseSeverityMap(debtText || '');
  const tableMatch = qualText.match(/\| ID \| Title \| Status \|([\s\S]*?)(?=\n---|\n## |$)/i);
  if (!tableMatch) return [];
  return tableMatch[1].split('\n')
    .filter(l => /^\|/.test(l) && !/---/.test(l) && !/\| ID \|/i.test(l))
    .map(row => {
      const cols = row.split('|').map(c => c.trim()).filter(Boolean);
      if (cols.length < 3) return null;
      const id = cols[0]; const title = cols[1];
      if (!cols[2].toUpperCase().includes('OPEN')) return null;
      return { severity: severityMap[id] || 'low', domain: id, issue: title, location: '', effort: '' };
    })
    .filter(Boolean).slice(0, 20);
}

function parseSecurityFindings(text) {
  if (!text) return [];
  const findings = [];
  for (const sec of text.split(/\n### /).slice(1)) {
    const titleLine = sec.split('\n')[0];
    if (!/SEC-[HM]\d+/.test(titleLine)) continue;
    const idM   = titleLine.match(/(SEC-[HM]\d+)/);
    const nameM = titleLine.match(/SEC-[HM]\d+:\s*(.+?)(?:\s+[-–][-–]|\s*$)/);
    const detM  = sec.match(/- \*\*Details\*\*:\s*(.+?)(?=\n-|\n\n|$)/s);
    const fixM  = sec.match(/- \*\*Fix\*\*:\s*(.+?)(?=\n-|\n\n|$)/s);
    findings.push({
      category: /SEC-H/.test(titleLine) ? 'Security' : 'Security',
      severity: /SEC-H/.test(titleLine) ? 'high' : 'medium',
      title:    (idM ? idM[1] : '') + (nameM ? ': ' + nameM[1].trim() : ''),
      description:    detM ? detM[1].trim().replace(/\n/g, ' ') : '',
      recommendation: fixM ? fixM[1].trim().replace(/\n/g, ' ') : ''
    });
  }
  return findings;
}

function parseQualityFindings(text) {
  if (!text) return [];
  const findings = [];
  for (const sec of text.split(/\n### /).slice(1)) {
    const titleLine = sec.split('\n')[0];
    const idM = titleLine.match(/((?:DC|TCG|TD)-[A-Z\-\d]+)/);
    const nameM = titleLine.match(/(?:DC|TCG|TD)-[A-Z\-\d]+:\s*(.+?)(?:\s*$)/);
    const locM = sec.match(/^`([^`]+)`/m);
    const detM = sec.match(/\n(.+?)\n- \*\*Impact\*\*/s);
    const sugM = sec.match(/- \*\*Suggestion\*\*:\s*(.+?)(?=\n-|\n\n|$)/s);
    if (!idM) continue;
    findings.push({
      category: 'Quality',
      severity: 'medium',
      title:    (idM ? idM[1] : '') + (nameM ? ': ' + nameM[1].trim() : ''),
      description:    locM ? locM[1] : (detM ? detM[1].trim() : ''),
      recommendation: sugM ? sugM[1].trim().replace(/\n/g, ' ') : 'Review and schedule remediation'
    });
  }
  return findings.slice(0, 3);
}

// M79: derive the diagram inputs (services/layers/endpoints/states) from the DEEP
// living docs (docs/architecture.md, docs/workflows.md) so the architecture/data-flow
// diagrams reflect the project's REAL feature domains instead of falling back to the
// generic "Tasks/Projects" templates. Falls back to scan/architecture.md, then [].
function parseServices(docArch) {
  if (!docArch) return [];
  // Top-level numbered domain sections: "## 5. Multi-Tenant School and Location Model"
  const svc = [];
  for (const m of docArch.matchAll(/^##\s+\d+\.\s+(.+?)\s*$/gm)) {
    const name = m[1].trim();
    // skip meta sections that aren't feature domains
    if (/^(system overview|technology stack|application structure|table of contents)/i.test(name)) continue;
    svc.push(name);
  }
  return svc;
}
function parseLayers(docArch) {
  if (!docArch) return [];
  // "### Controller Layer", "## 4. Authentication and Session Layer", etc.
  const layers = [];
  for (const m of docArch.matchAll(/^#{2,3}\s+(?:\d+\.\s+)?(.+?\bLayer)\s*$/gmi)) {
    const n = m[1].trim(); if (!layers.includes(n)) layers.push(n);
  }
  return layers;
}
function parseEndpoints(docArch) {
  if (!docArch) return [];
  // real route lines like `GET /feature-flags/resolve/:flagKey` or `POST /api/...`
  const eps = [];
  for (const m of docArch.matchAll(/\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[A-Za-z0-9_\-\/:{}.]+)/g)) {
    const e = m[1] + ' ' + m[2]; if (!eps.includes(e)) eps.push(e);
  }
  return eps;
}
function parseStates(docWorkflows) {
  if (!docWorkflows) return [];
  // Only accept REAL state transitions written as "Draft -> Open" / "Draft → Open"
  // where BOTH sides look like status enum values (short, capitalized, no spaces).
  // If we can't find a genuine transition chain, return [] so the generator keeps
  // its (good) default state machine rather than rendering doc-prose noise. (M79:
  // a loose match previously pulled "Domains/Source/Schedule" from prose headers.)
  const isState = (w) => /^[A-Z][A-Za-z]{1,14}$/.test(w) && /(Draft|Open|Progress|Review|Done|Block|Cancel|Pending|Active|Closed|Approved|Rejected|Queued|Failed|Complete)/i.test(w);
  const states = [];
  for (const m of docWorkflows.matchAll(/\b([A-Z][A-Za-z]+)\s*(?:->|→)\s*([A-Z][A-Za-z]+)\b/g)) {
    if (isState(m[1]) && isState(m[2])) for (const s of [m[1], m[2]]) if (!states.includes(s)) states.push(s);
  }
  return states.length >= 3 ? states : [];
}

function collectScanData(projectRoot) {
  const scanDir = path.join(projectRoot, '.gsd-t', 'scan');
  const rs = (f) => read(path.join(scanDir, f));
  const rr = (f) => read(path.join(projectRoot, f));

  const archText  = rs('architecture.md');
  const testText  = rs('test-baseline.md');
  const secText   = rs('security.md');
  const qualText  = rs('quality.md');
  const debtText  = rr('.gsd-t/techdebt.md');
  // Deep living docs — the real architecture knowledge (M79).
  const docArch   = rr('docs/architecture.md');
  const docFlow   = rr('docs/workflows.md');

  let projectName = path.basename(projectRoot);
  try { projectName = JSON.parse(rr('package.json')).name || projectName; } catch {}

  const { filesScanned, totalLoc } = parseFilesAndLoc(archText);
  const { debtCritical, debtHigh, debtMedium } = parseDebtSummary(debtText);
  const testCoverage = parseTestCoverage(testText);
  const domains   = parseComponents(archText);
  const techDebt  = parseTechDebtItems(qualText, debtText);
  const secFinds  = parseSecurityFindings(secText);
  const qualFinds = parseQualityFindings(qualText);
  const findings  = secFinds.concat(qualFinds).slice(0, 10);

  // Diagram inputs from the deep docs (M79).
  const services  = parseServices(docArch);
  const layers    = parseLayers(docArch);
  const endpoints = parseEndpoints(docArch);
  const states    = parseStates(docFlow);

  return { projectName, filesScanned, totalLoc, debtCritical, debtHigh, debtMedium,
           testCoverage, domains, techDebt, findings,
           services, layers, endpoints, states };
}

module.exports = { collectScanData };
