'use strict';

const fs = require('fs');
const path = require('path');

// M61 D4 retired the specific viewer HTML + dashboard server. The detector's
// HTML-listener scanning stays general-purpose: any `scripts/*.html` is a
// viewer-source surface (so a future viewer is covered automatically), plus
// the live journey specs. The retired files simply no longer exist to scan —
// `gsd-t check-coverage` returns 0 listeners until a new HTML surface appears.
const VIEWER_FILE_PATTERNS = [
  /^scripts\/.*\.html$/,
  /^e2e\/journeys\/.*\.spec\.ts$/,
];

const IGNORE_FILE_PATTERNS = [
  /^e2e\/viewer\/.*\.spec\.ts$/,
];

const KNOWN_KINDS = new Set([
  'addEventListener',
  'inline-handler',
  'function-call',
  'mutation-observer',
  'hashchange',
  'delegated',
]);

const TRACKED_FUNCTIONS = new Set(['connectMain', 'connect', 'fetchMainSession']);

function isViewerSource(rel) {
  if (IGNORE_FILE_PATTERNS.some((p) => p.test(rel))) return false;
  return VIEWER_FILE_PATTERNS.some((p) => p.test(rel));
}

function readSource(absPath) {
  return fs.readFileSync(absPath, 'utf8');
}

function lineOf(src, idx) {
  let line = 1;
  for (let i = 0; i < idx && i < src.length; i++) {
    if (src.charCodeAt(i) === 10) line++;
  }
  return line;
}

function lineStartIndex(src, idx) {
  let i = idx;
  while (i > 0 && src[i - 1] !== '\n') i--;
  return i;
}

function lineEndIndex(src, idx) {
  let i = idx;
  while (i < src.length && src[i] !== '\n') i++;
  return i;
}

function lineText(src, idx) {
  return src.slice(lineStartIndex(src, idx), lineEndIndex(src, idx));
}

function buildStringMask(src) {
  const len = src.length;
  const mask = new Uint8Array(len);
  let i = 0;
  while (i < len) {
    const ch = src[i];
    if (ch === '/' && src[i + 1] === '/') {
      while (i < len && src[i] !== '\n') { mask[i] = 1; i++; }
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      mask[i] = 1; mask[i + 1] = 1; i += 2;
      while (i < len && !(src[i] === '*' && src[i + 1] === '/')) { mask[i] = 1; i++; }
      if (i < len) { mask[i] = 1; mask[i + 1] = 1; i += 2; }
      continue;
    }
    if (ch === '<' && src[i + 1] === '!' && src[i + 2] === '-' && src[i + 3] === '-') {
      while (i < len && !(src[i] === '-' && src[i + 1] === '-' && src[i + 2] === '>')) { mask[i] = 1; i++; }
      if (i < len) { mask[i] = 1; mask[i + 1] = 1; mask[i + 2] = 1; i += 3; }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      mask[i] = 1; i++;
      while (i < len) {
        if (src[i] === '\\') {
          mask[i] = 1;
          if (i + 1 < len) mask[i + 1] = 1;
          i += 2;
          continue;
        }
        if (src[i] === quote) { mask[i] = 1; i++; break; }
        if (quote !== '`' && src[i] === '\n') break;
        mask[i] = 1; i++;
      }
      continue;
    }
    i++;
  }
  return mask;
}

function masked(mask, idx) {
  return mask[idx] === 1;
}

function isFeatureDetectGuard(src, matchIdx) {
  const line = lineText(src, matchIdx);
  return /if\s*\(\s*!\s*\w+(\.\w+)?\.addEventListener\s*\)/.test(line);
}

function isEslintExempt(src, matchIdx) {
  const lineStart = lineStartIndex(src, matchIdx);
  if (lineStart === 0) return false;
  const prevLineEnd = lineStart - 1;
  const prevLineStart = lineStartIndex(src, prevLineEnd - 1);
  const prevLine = src.slice(prevLineStart, prevLineEnd);
  if (!/eslint-disable/.test(prevLine)) return false;
  return /journey-coverage/.test(prevLine);
}

function findReceiverBeforeDot(src, dotIdx) {
  let i = dotIdx - 1;
  while (i >= 0 && /\s/.test(src[i])) i--;
  let depth = 0;
  const end = i + 1;
  while (i >= 0) {
    const ch = src[i];
    if (ch === ')' || ch === ']') { depth++; i--; continue; }
    if (ch === '(' || ch === '[') {
      if (depth === 0) break;
      depth--; i--; continue;
    }
    if (depth > 0) { i--; continue; }
    if (/[A-Za-z0-9_$.\?]/.test(ch)) { i--; continue; }
    break;
  }
  return src.slice(i + 1, end).trim();
}

function looksLikeDelegatedHandler(src, matchIdx, matchLen) {
  const tail = src.slice(matchIdx + matchLen, matchIdx + matchLen + 600);
  if (!/=>\s*\{|function\s*\(/.test(tail)) return false;
  return /e\.target\.matches\s*\(|event\.target\.matches\s*\(/.test(tail);
}

function extractDelegatedSelector(src, matchIdx) {
  const tail = src.slice(matchIdx, matchIdx + 600);
  const m = /\.target\.matches\s*\(\s*(['"])([^'"]+)\1/.exec(tail);
  return m ? m[2] : '';
}

function detectAddEventListener(file, src, mask, listeners) {
  const re = /\.addEventListener\s*\(\s*(['"])([A-Za-z_][\w-]*)\1/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const matchIdx = m.index;
    if (masked(mask, matchIdx)) continue;
    if (isFeatureDetectGuard(src, matchIdx)) continue;
    const event = m[2];
    const receiver = findReceiverBeforeDot(src, matchIdx);
    if (!receiver) continue;
    if (isEslintExempt(src, matchIdx)) continue;
    let kind = 'addEventListener';
    let selector;
    if (receiver === 'window') {
      if (event === 'hashchange') {
        kind = 'hashchange';
        selector = 'window:hashchange';
      } else {
        selector = 'window:' + event;
      }
    } else if (looksLikeDelegatedHandler(src, matchIdx, m[0].length)) {
      kind = 'delegated';
      const matchesSel = extractDelegatedSelector(src, matchIdx);
      selector = receiver + ':' + event + (matchesSel ? '|' + matchesSel : '');
    } else {
      selector = receiver + ':' + event;
    }
    const line = lineOf(src, matchIdx);
    const raw = lineText(src, matchIdx).trim();
    listeners.push({ file, line, selector, kind, raw });
  }
}

function detectInlineHandler(file, src, mask, listeners) {
  const re = /<(\w+)([^>]*?)\s+on(\w+)\s*=\s*(['"])([^'"]*)\4/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const matchIdx = m.index;
    if (masked(mask, matchIdx)) continue;
    const tag = m[1];
    const attrs = m[2];
    const event = m[3].toLowerCase();
    const idMatch = /\sid\s*=\s*(['"])([^'"]+)\1/.exec(attrs);
    const id = idMatch ? idMatch[2] : null;
    const selector = id ? id + ':' + event : tag + ':' + event;
    if (isEslintExempt(src, matchIdx)) continue;
    const line = lineOf(src, matchIdx);
    const raw = lineText(src, matchIdx).trim();
    listeners.push({ file, line, selector, kind: 'inline-handler', raw });
  }
}

function detectMutationObserver(file, src, mask, listeners) {
  const re = /new\s+MutationObserver\s*\(/g;
  let m;
  let counter = 0;
  while ((m = re.exec(src)) !== null) {
    const matchIdx = m.index;
    if (masked(mask, matchIdx)) continue;
    counter++;
    const selector = 'mutation-observer:' + path.basename(file) + ':' + counter;
    if (isEslintExempt(src, matchIdx)) continue;
    const line = lineOf(src, matchIdx);
    const raw = lineText(src, matchIdx).trim();
    listeners.push({ file, line, selector, kind: 'mutation-observer', raw });
  }
}

function detectFunctionCall(file, src, mask, listeners) {
  const defRe = /(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  const defs = new Map();
  let m;
  while ((m = defRe.exec(src)) !== null) {
    const matchIdx = m.index;
    if (masked(mask, matchIdx)) continue;
    if (!defs.has(m[1])) defs.set(m[1], matchIdx);
  }
  if (!defs.size) return;
  for (const [fnName, defIdx] of defs) {
    if (!TRACKED_FUNCTIONS.has(fnName)) continue;
    const callRe = new RegExp('(?<![\\w.])' + fnName + '\\s*\\(', 'g');
    let cm;
    let foundCall = false;
    while ((cm = callRe.exec(src)) !== null) {
      const before = src.slice(Math.max(0, cm.index - 12), cm.index);
      if (/\bfunction\s+$/.test(before)) continue;
      if (masked(mask, cm.index)) continue;
      foundCall = true; break;
    }
    if (!foundCall) continue;
    if (isEslintExempt(src, defIdx)) continue;
    const line = lineOf(src, defIdx);
    const raw = lineText(src, defIdx).trim();
    listeners.push({ file, line, selector: fnName, kind: 'function-call', raw });
  }
}

function detectListeners(filepaths, opts = {}) {
  const projectDir = opts.projectDir || process.cwd();
  const listeners = [];
  for (const fp of filepaths) {
    const rel = path.isAbsolute(fp) ? path.relative(projectDir, fp) : fp;
    if (!isViewerSource(rel)) continue;
    const abs = path.isAbsolute(fp) ? fp : path.join(projectDir, fp);
    let src;
    try { src = readSource(abs); } catch { continue; }
    const mask = buildStringMask(src);
    detectAddEventListener(rel, src, mask, listeners);
    detectInlineHandler(rel, src, mask, listeners);
    detectMutationObserver(rel, src, mask, listeners);
    detectFunctionCall(rel, src, mask, listeners);
  }
  return listeners;
}

function loadManifest(projectDir) {
  const p = path.join(projectDir, '.gsd-t', 'journey-manifest.json');
  if (!fs.existsSync(p)) {
    const err = new Error('manifest-missing');
    err.code = 'MANIFEST_MISSING';
    err.path = p;
    throw err;
  }
  let raw;
  try { raw = fs.readFileSync(p, 'utf8'); }
  catch (e) {
    const err = new Error('manifest-unreadable: ' + e.message);
    err.code = 'MANIFEST_UNREADABLE';
    throw err;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) {
    const err = new Error('manifest-invalid-json: ' + e.message);
    err.code = 'MANIFEST_INVALID';
    throw err;
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.specs)) {
    const err = new Error('manifest-shape-invalid');
    err.code = 'MANIFEST_INVALID';
    throw err;
  }
  return parsed;
}

const KEY_SEP = '||';

function findGaps(listeners, manifest) {
  const covered = new Set();
  const declared = [];
  for (const spec of manifest.specs || []) {
    for (const c of spec.covers || []) {
      covered.add(c.file + KEY_SEP + c.selector);
      declared.push({ name: spec.name, file: c.file, selector: c.selector, kind: c.kind });
    }
  }
  const detectedKey = new Set();
  for (const l of listeners) detectedKey.add(l.file + KEY_SEP + l.selector);
  const gaps = [];
  for (const l of listeners) {
    const key = l.file + KEY_SEP + l.selector;
    if (!covered.has(key)) {
      gaps.push({ type: 'gap', file: l.file, line: l.line, selector: l.selector, kind: l.kind });
    }
  }
  for (const d of declared) {
    const key = d.file + KEY_SEP + d.selector;
    if (!detectedKey.has(key)) {
      gaps.push({ type: 'stale', name: d.name, file: d.file, selector: d.selector });
    }
  }
  return gaps;
}

function formatReport(gaps) {
  if (!gaps.length) return '';
  const lines = [];
  for (const g of gaps) {
    if (g.type === 'gap') {
      lines.push('GAP: ' + g.file + ':' + g.line + '  ' + g.selector + '  (' + g.kind + ')  no spec covers this');
    } else {
      lines.push('STALE: spec=' + g.name + '  covers ' + g.file + ' selector=' + g.selector + '  no such listener');
    }
  }
  return lines.join('\n');
}

module.exports = {
  detectListeners,
  loadManifest,
  findGaps,
  formatReport,
  isViewerSource,
  KNOWN_KINDS,
};
