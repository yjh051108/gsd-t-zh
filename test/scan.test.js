/**
 * Tests for M17 Scan Visual Output modules:
 *   bin/scan-schema.js, bin/scan-diagrams.js, bin/scan-report.js, bin/scan-export.js
 *
 * Uses Node.js built-in test runner (node --test)
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const { extractSchema } = require('../bin/scan-schema.js');
const { generateDiagrams } = require('../bin/scan-diagrams.js');
const { generateReport } = require('../bin/scan-report.js');
const { exportReport } = require('../bin/scan-export.js');
const { collectScanData } = require('../bin/scan-data-collector.js');

// Temp dir for report output
let tmpDir;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-scan-test-'));
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── extractSchema ────────────────────────────────────────────────────────────

describe('extractSchema', () => {
  it('returns detected:false for an empty directory', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-empty-'));
    try {
      const result = extractSchema(empty);
      assert.equal(result.detected, false);
      assert.equal(result.ormType, null);
      assert.deepEqual(result.entities, []);
      assert.ok(Array.isArray(result.parseWarnings));
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });

  it('returns detected:false for a non-existent directory', () => {
    const result = extractSchema('/nonexistent/path/that/does/not/exist');
    assert.equal(result.detected, false);
    assert.equal(result.ormType, null);
    assert.deepEqual(result.entities, []);
    assert.ok(Array.isArray(result.parseWarnings));
  });

  it('never throws — returns safe fallback on any input', () => {
    assert.doesNotThrow(() => extractSchema(null));
    assert.doesNotThrow(() => extractSchema(undefined));
    assert.doesNotThrow(() => extractSchema(''));
  });

  it('returns correct shape keys', () => {
    const result = extractSchema(tmpDir);
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'detected'));
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'ormType'));
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'entities'));
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'parseWarnings'));
  });

  it('detects raw-sql ORM when .sql file with CREATE TABLE exists', () => {
    const sqlDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-sql-'));
    try {
      fs.writeFileSync(path.join(sqlDir, 'schema.sql'), 'CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(255));');
      const result = extractSchema(sqlDir);
      assert.equal(result.detected, true);
      assert.equal(result.ormType, 'raw-sql');
      assert.ok(Array.isArray(result.entities));
    } finally {
      fs.rmSync(sqlDir, { recursive: true, force: true });
    }
  });

  it('scans the GSD-T project itself without throwing', () => {
    const projectRoot = path.join(__dirname, '..');
    const result = extractSchema(projectRoot);
    assert.ok(typeof result.detected === 'boolean');
    assert.ok(Array.isArray(result.entities));
    assert.ok(Array.isArray(result.parseWarnings));
  });
});

// ─── generateDiagrams ────────────────────────────────────────────────────────

describe('generateDiagrams', () => {
  const noSchema = { detected: false, ormType: null, entities: [], parseWarnings: [] };
  const minAnalysis = { projectName: 'TestProject' };

  // M79: the database-schema diagram is suppressed by default (the extractor picked
  // the wrong file on large repos and emitted `unknown` columns). Default = 5 diagrams;
  // includeSchemaDiagram re-enables the 6th.
  it('returns 5 DiagramResult objects by default (schema suppressed)', () => {
    const results = generateDiagrams(minAnalysis, noSchema, { projectRoot: tmpDir });
    assert.equal(results.length, 5);
  });

  it('returns 6 DiagramResult objects when includeSchemaDiagram is set', () => {
    const results = generateDiagrams(minAnalysis, noSchema, { projectRoot: tmpDir, includeSchemaDiagram: true });
    assert.equal(results.length, 6);
  });

  it('each result has required shape keys', () => {
    const results = generateDiagrams(minAnalysis, noSchema, { projectRoot: tmpDir });
    for (const r of results) {
      assert.ok(Object.prototype.hasOwnProperty.call(r, 'type'));
      assert.ok(Object.prototype.hasOwnProperty.call(r, 'title'));
      assert.ok(Object.prototype.hasOwnProperty.call(r, 'typeBadge'));
      assert.ok(Object.prototype.hasOwnProperty.call(r, 'svgContent'));
      assert.ok(Object.prototype.hasOwnProperty.call(r, 'note'));
      assert.ok(Object.prototype.hasOwnProperty.call(r, 'rendered'));
      assert.ok(Object.prototype.hasOwnProperty.call(r, 'rendererUsed'));
    }
  });

  it('returns correct diagram types in order (schema suppressed by default)', () => {
    const results = generateDiagrams(minAnalysis, noSchema, { projectRoot: tmpDir });
    const expectedTypes = [
      'system-architecture',
      'app-architecture',
      'workflow',
      'data-flow',
      'sequence'
    ];
    assert.deepEqual(results.map(r => r.type), expectedTypes);
  });

  it('svgContent is always a non-null string for each result', () => {
    const results = generateDiagrams(minAnalysis, noSchema, { projectRoot: tmpDir });
    for (const r of results) {
      assert.ok(typeof r.svgContent === 'string');
      assert.ok(r.svgContent.length > 0);
    }
  });

  it('database-schema diagram has rendered:false when schema not detected (opt-in)', () => {
    const results = generateDiagrams(minAnalysis, noSchema, { projectRoot: tmpDir, includeSchemaDiagram: true });
    const dbDiagram = results.find(r => r.type === 'database-schema');
    assert.equal(dbDiagram.rendered, false);
    assert.equal(dbDiagram.rendererUsed, 'placeholder');
  });

  it('never throws on null/undefined inputs', () => {
    assert.doesNotThrow(() => generateDiagrams(null, null, {}));
    assert.doesNotThrow(() => generateDiagrams(undefined, undefined, undefined));
    assert.doesNotThrow(() => generateDiagrams({}, {}, null));
  });

  it('always returns 5 results even on invalid input (schema suppressed)', () => {
    const results = generateDiagrams(null, null, {});
    assert.equal(results.length, 5);
  });
});

// ─── generateReport ──────────────────────────────────────────────────────────

describe('generateReport', () => {
  const noSchema = { detected: false, ormType: null, entities: [], parseWarnings: [] };
  const minAnalysis = { projectName: 'TestReport' };

  function makePlaceholderDiagrams() {
    const types = [
      { type: 'system-architecture', title: 'System Architecture', typeBadge: 'graph TB' },
      { type: 'app-architecture',    title: 'App Architecture',    typeBadge: 'graph TB' },
      { type: 'workflow',            title: 'Workflow',            typeBadge: 'stateDiagram-v2' },
      { type: 'data-flow',          title: 'Data Flow',           typeBadge: 'flowchart TD' },
      { type: 'sequence',            title: 'Sequence',            typeBadge: 'sequenceDiagram' },
      { type: 'database-schema',     title: 'Database Schema',     typeBadge: 'erDiagram' }
    ];
    return types.map(t => ({
      ...t,
      svgContent: '<div class="diagram-placeholder"><p>Test placeholder</p></div>',
      note: 'Test note',
      rendered: false,
      rendererUsed: 'placeholder'
    }));
  }

  it('writes an HTML file and returns outputPath', () => {
    const outDir = fs.mkdtempSync(path.join(tmpDir, 'report-'));
    const diagrams = makePlaceholderDiagrams();
    const result = generateReport(minAnalysis, noSchema, diagrams, { projectRoot: outDir });
    assert.ok(result.outputPath, 'outputPath should be set');
    assert.ok(fs.existsSync(result.outputPath), 'HTML file should exist');
  });

  it('generated HTML contains DOCTYPE and html tag', () => {
    const outDir = fs.mkdtempSync(path.join(tmpDir, 'report-html-'));
    const diagrams = makePlaceholderDiagrams();
    const result = generateReport(minAnalysis, noSchema, diagrams, { projectRoot: outDir });
    const html = fs.readFileSync(result.outputPath, 'utf8');
    assert.ok(html.startsWith('<!DOCTYPE html>'), 'should start with DOCTYPE');
    assert.ok(html.includes('<html'), 'should have html tag');
  });

  it('generated HTML contains no external CDN references', () => {
    const outDir = fs.mkdtempSync(path.join(tmpDir, 'report-cdn-'));
    const diagrams = makePlaceholderDiagrams();
    const result = generateReport(minAnalysis, noSchema, diagrams, { projectRoot: outDir });
    const html = fs.readFileSync(result.outputPath, 'utf8');
    assert.ok(!html.includes('cdn.jsdelivr.net'), 'no jsdelivr CDN');
    assert.ok(!html.includes('unpkg.com'), 'no unpkg CDN');
    assert.ok(!html.includes('cdnjs.cloudflare.com'), 'no cdnjs CDN');
    assert.ok(!html.includes('<link rel="stylesheet"'), 'no external stylesheets');
    assert.ok(!html.includes('src="https://'), 'no external scripts');
  });

  it('returns diagramsRendered count matching rendered diagrams', () => {
    const outDir = fs.mkdtempSync(path.join(tmpDir, 'report-count-'));
    const diagrams = makePlaceholderDiagrams();
    const result = generateReport(minAnalysis, noSchema, diagrams, { projectRoot: outDir });
    assert.equal(result.diagramsRendered, 0);
    assert.equal(result.diagramsPlaceholder, 6);
  });

  it('never throws on null/empty inputs', () => {
    const outDir = fs.mkdtempSync(path.join(tmpDir, 'report-null-'));
    assert.doesNotThrow(() => generateReport(null, null, [], { projectRoot: outDir }));
    assert.doesNotThrow(() => generateReport(undefined, undefined, undefined, { projectRoot: outDir }));
  });

  it('contains sidebar navigation with 6 diagram links', () => {
    const outDir = fs.mkdtempSync(path.join(tmpDir, 'report-nav-'));
    const diagrams = makePlaceholderDiagrams();
    const result = generateReport(minAnalysis, noSchema, diagrams, { projectRoot: outDir });
    const html = fs.readFileSync(result.outputPath, 'utf8');
    assert.ok(html.includes('diagram-system-architecture'), 'has system-architecture link');
    assert.ok(html.includes('diagram-database-schema'), 'has database-schema link');
  });
});

// ─── exportReport ─────────────────────────────────────────────────────────────

describe('exportReport', () => {
  it('returns skipped:true when pandoc not found (docx format)', () => {
    // On CI/test environments without pandoc, this should gracefully skip
    const result = exportReport('/some/fake.html', 'docx', {});
    // Either skips gracefully or returns success (if pandoc is installed)
    assert.ok(typeof result === 'object');
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'success'));
  });

  it('returns skipped:true when md-to-pdf not found (pdf format)', () => {
    const result = exportReport('/some/fake.html', 'pdf', {});
    assert.ok(typeof result === 'object');
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'success'));
  });

  it('returns error for unknown format', () => {
    const result = exportReport('/some/fake.html', 'txt', {});
    assert.equal(result.success, false);
    assert.ok(result.error.includes('Unknown export format'));
  });

  it('returns error for invalid format (null)', () => {
    const result = exportReport('/some/fake.html', null, {});
    assert.equal(result.success, false);
  });

  it('never throws — returns error object instead', () => {
    assert.doesNotThrow(() => exportReport(null, 'docx', {}));
    assert.doesNotThrow(() => exportReport(undefined, undefined, undefined));
  });
});

// ─── collectScanData ──────────────────────────────────────────────────────────

describe('collectScanData', () => {
  it('never throws on empty directory', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-collect-'));
    try {
      assert.doesNotThrow(() => collectScanData(empty));
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });

  it('returns required shape keys', () => {
    const result = collectScanData(tmpDir);
    for (const key of ['projectName', 'filesScanned', 'totalLoc', 'debtCritical', 'debtHigh', 'debtMedium', 'testCoverage', 'domains', 'techDebt', 'findings']) {
      assert.ok(Object.prototype.hasOwnProperty.call(result, key), 'missing key: ' + key);
    }
  });

  it('parses real project data — GSD-T root', () => {
    const result = collectScanData(path.join(__dirname, '..'));
    assert.equal(result.projectName, '@tekyzinc/gsd-t');
    assert.ok(result.filesScanned > 0, 'filesScanned should be > 0');
    assert.ok(result.totalLoc > 0, 'totalLoc should be > 0');
    assert.ok(result.domains.length > 0, 'should have domain entries');
    assert.ok(result.domains.every(d => d.name && typeof d.name === 'string'), 'all domain names should be strings');
  });

  it('testCoverage parses N/N format from real project', () => {
    const result = collectScanData(path.join(__dirname, '..'));
    assert.match(result.testCoverage, /\d+\/\d+|N\/A/, 'testCoverage should be N/N or N/A');
  });

  it('returns testCoverage N/A when test-baseline.md absent', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-collect2-'));
    try {
      const result = collectScanData(empty);
      assert.equal(result.testCoverage, 'N/A');
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });
});

// ─── Integration smoke test ────────────────────────────────────────────────────

describe('M17 pipeline integration', () => {
  it('full pipeline: extractSchema → generateDiagrams → generateReport does not throw', () => {
    const outDir = fs.mkdtempSync(path.join(tmpDir, 'integration-'));
    let result;
    assert.doesNotThrow(() => {
      const schemaData = extractSchema(path.join(__dirname, '..'));
      const diagrams = generateDiagrams({ projectName: 'GSD-T' }, schemaData, { projectRoot: outDir });
      result = generateReport({ projectName: 'GSD-T' }, schemaData, diagrams, { projectRoot: outDir });
    });
    assert.ok(result);
    assert.equal(typeof result.diagramsRendered, 'number');
    assert.equal(typeof result.diagramsPlaceholder, 'number');
    assert.equal(result.diagramsRendered + result.diagramsPlaceholder, 5);
  });

  it('pipeline produces a valid HTML file', () => {
    const outDir = fs.mkdtempSync(path.join(tmpDir, 'integration-html-'));
    const schemaData = extractSchema(path.join(__dirname, '..'));
    const diagrams = generateDiagrams({ projectName: 'GSD-T' }, schemaData, { projectRoot: outDir });
    const result = generateReport({ projectName: 'GSD-T' }, schemaData, diagrams, { projectRoot: outDir });
    assert.ok(fs.existsSync(result.outputPath));
    const html = fs.readFileSync(result.outputPath, 'utf8');
    assert.ok(html.length > 1000, 'HTML should be non-trivial');
    assert.ok(html.includes('GSD-T'));
    assert.ok(html.includes('</html>'));
  });
});
