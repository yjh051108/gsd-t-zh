'use strict';
const fs = require('fs');
const path = require('path');

const PASS = 'PASS';
const FAIL = 'FAIL';

let allPass = true;
function gate(label, passed, detail) {
  const status = passed ? PASS : FAIL;
  if (!passed) allPass = false;
  console.log('  ' + status + ' — ' + label + (detail ? ': ' + detail : ''));
}

// Gate 1: Contract compliance
console.log('\nGATE 1: Contract compliance (exported function shapes)');
const { extractSchema } = require('../bin/scan-schema.js');
const { generateDiagrams } = require('../bin/scan-diagrams.js');
const { generateReport } = require('../bin/scan-report.js');
const { exportReport } = require('../bin/scan-export.js');
const { renderDiagram } = require('../bin/scan-renderer.js');
gate('extractSchema is a function', typeof extractSchema === 'function');
gate('generateDiagrams is a function', typeof generateDiagrams === 'function');
gate('generateReport is a function', typeof generateReport === 'function');
gate('exportReport is a function', typeof exportReport === 'function');
gate('renderDiagram is a function', typeof renderDiagram === 'function');

// extractSchema output shape
const schemaResult = extractSchema('/nonexistent');
gate('extractSchema.detected is boolean', typeof schemaResult.detected === 'boolean');
gate('extractSchema.ormType is null or string', schemaResult.ormType === null || typeof schemaResult.ormType === 'string');
gate('extractSchema.entities is array', Array.isArray(schemaResult.entities));
gate('extractSchema.parseWarnings is array', Array.isArray(schemaResult.parseWarnings));

// generateDiagrams output shape (6 items, ordered)
// M79: database-schema is suppressed by default; includeSchemaDiagram re-enables it.
// This gate exercises the full 6-diagram shape via the opt-in flag.
const noSchema = { detected: false, ormType: null, entities: [], parseWarnings: [] };
const diagrams = generateDiagrams({ projectName: 'test' }, noSchema, { includeSchemaDiagram: true });
const EXPECTED_TYPES = ['system-architecture','app-architecture','workflow','data-flow','sequence','database-schema'];
gate('generateDiagrams returns 6 items', diagrams.length === 6, 'got ' + diagrams.length);
gate('generateDiagrams types in order', JSON.stringify(diagrams.map(d => d.type)) === JSON.stringify(EXPECTED_TYPES));
gate('all svgContent are strings', diagrams.every(d => typeof d.svgContent === 'string'));
gate('all svgContent non-empty', diagrams.every(d => d.svgContent.length > 0));
gate('database-schema placeholder when not detected', !diagrams[5].rendered && diagrams[5].rendererUsed === 'placeholder');
for (const r of diagrams) {
  gate('DiagramResult has typeBadge', typeof r.typeBadge === 'string');
  gate('DiagramResult.rendered is boolean', typeof r.rendered === 'boolean');
  break; // just check first item
}

// Gate 2: Zero external deps
console.log('\nGATE 2: Zero external dependencies');
const scanFiles = [
  'bin/scan-schema.js','bin/scan-schema-parsers.js','bin/scan-renderer.js',
  'bin/scan-diagrams.js','bin/scan-diagrams-generators.js',
  'bin/scan-report.js','bin/scan-report-sections.js','bin/scan-export.js'
];
const BUILTINS = new Set(['fs','path','os','child_process','https','http','node:fs','node:path','node:os','node:child_process']);
for (const f of scanFiles) {
  const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  const RE = /require\(["']([^"']+)["']\)/g;
  let m;
  const externals = [];
  while ((m = RE.exec(src)) !== null) {
    const mod = m[1];
    if (mod[0] === '.') continue; // relative
    if (BUILTINS.has(mod)) continue;
    externals.push(mod);
  }
  gate(f, externals.length === 0, externals.length > 0 ? 'external deps: ' + externals.join(', ') : '');
}

// Gate 3: File size compliance (<= 200 lines)
console.log('\nGATE 3: File size compliance (<= 200 lines)');
for (const f of scanFiles) {
  const lines = fs.readFileSync(path.join(__dirname, '..', f), 'utf8').split('\n').length;
  gate(f + ' (' + lines + ' lines)', lines <= 200, lines > 200 ? 'EXCEEDS 200 lines' : '');
}

// Gate 4: No-throw guarantee
console.log('\nGATE 4: No-throw guarantee on invalid inputs');
const os = require('os');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-v-'));
try { extractSchema(null); gate('extractSchema(null)', true); } catch(e) { gate('extractSchema(null)', false, e.message); }
try { extractSchema(''); gate('extractSchema("")', true); } catch(e) { gate('extractSchema("")', false, e.message); }
try { generateDiagrams(null, null, null); gate('generateDiagrams(null,null,null)', true); } catch(e) { gate('generateDiagrams(null,null,null)', false, e.message); }
try { generateReport(null, null, null, { projectRoot: tmpDir }); gate('generateReport(null inputs)', true); } catch(e) { gate('generateReport(null inputs)', false, e.message); }
try { exportReport(null, 'docx', {}); gate('exportReport(null html, docx)', true); } catch(e) { gate('exportReport(null html)', false, e.message); }
try { exportReport('/fake.html', 'txt', {}); gate('exportReport(unknown format)', true); } catch(e) { gate('exportReport(unknown format)', false, e.message); }
try { renderDiagram(null, null, {}); gate('renderDiagram(null)', true); } catch(e) { gate('renderDiagram(null)', false, e.message); }

// Gate 5: Self-contained HTML (no CDN refs)
console.log('\nGATE 5: Self-contained HTML (no CDN references)');
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-v2-'));
const result = generateReport({ projectName: 'VerifyTest' }, noSchema, diagrams, { projectRoot: outDir });
const html = fs.readFileSync(result.outputPath, 'utf8');
gate('no cdn.jsdelivr.net', !html.includes('cdn.jsdelivr.net'));
gate('no unpkg.com', !html.includes('unpkg.com'));
gate('no cdnjs.cloudflare.com', !html.includes('cdnjs.cloudflare.com'));
gate('no external link stylesheet', !html.includes('<link rel="stylesheet"'));
gate('no src="https://', !html.includes('src="https://'));
gate('has DOCTYPE', html.startsWith('<!DOCTYPE html>'));
gate('has 6 diagram sections', (html.match(/diagram-section/g) || []).length >= 6);

// Gate 6: exportReport unknown format returns error (not throw)
console.log('\nGATE 6: exportReport format validation');
const badFormat = exportReport('/fake.html', 'xyz', {});
gate('unknown format returns success:false', badFormat.success === false);
gate('unknown format includes error message', typeof badFormat.error === 'string' && badFormat.error.includes('Unknown'));

// Cleanup
try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
try { fs.rmSync(outDir, { recursive: true, force: true }); } catch {}

console.log('\n' + (allPass ? '✓ ALL GATES PASS' : '✗ SOME GATES FAILED'));
process.exit(allPass ? 0 : 1);
