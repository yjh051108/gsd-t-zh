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

function collectScanData(projectRoot) {
  const scanDir = path.join(projectRoot, '.gsd-t', 'scan');
  const rs = (f) => read(path.join(scanDir, f));
  const rr = (f) => read(path.join(projectRoot, f));

  const archText  = rs('architecture.md');
  const testText  = rs('test-baseline.md');
  const secText   = rs('security.md');
  const qualText  = rs('quality.md');
  const debtText  = rr('.gsd-t/techdebt.md');

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

  return { projectName, filesScanned, totalLoc, debtCritical, debtHigh, debtMedium,
           testCoverage, domains, techDebt, findings };
}

module.exports = { collectScanData };
