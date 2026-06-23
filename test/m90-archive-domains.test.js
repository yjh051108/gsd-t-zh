'use strict';

// Backlog #40 — deterministic archive+sweep of a completed milestone's domain dirs.
// Run: node --test test/m90-archive-domains.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { archiveDomains } = require('../bin/gsd-t-archive-domains.cjs');

function makeProject(domains) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'archdom-'));
  for (const d of domains) {
    const dd = path.join(dir, '.gsd-t', 'domains', d);
    fs.mkdirSync(dd, { recursive: true });
    fs.writeFileSync(path.join(dd, 'scope.md'), `# Domain: ${d}\n`);
    fs.writeFileSync(path.join(dd, 'tasks.md'), `# Tasks: ${d}\n`);
  }
  return dir;
}
const liveDomains = (dir) => {
  const p = path.join(dir, '.gsd-t', 'domains');
  return fs.existsSync(p) ? fs.readdirSync(p).sort() : [];
};

describe('archiveDomains — completed set archived+removed, live set untouched', () => {
  test('sweeps exactly the named (completed) domains, leaves still-active ones', () => {
    const dir = makeProject(['mNN-d1', 'mNN-d2', 'live-A', 'live-B']);
    const archive = path.join(dir, '.gsd-t', 'milestones', 'mNN-name-2026-06-22');
    try {
      const r = archiveDomains({ domains: ['mNN-d1', 'mNN-d2'], archiveDir: archive, projectDir: dir });
      assert.ok(r.ok, JSON.stringify(r));
      assert.deepEqual(r.archived.sort(), ['mNN-d1', 'mNN-d2']);
      assert.deepEqual(r.removed.sort(), ['mNN-d1', 'mNN-d2']);
      // Live domains untouched; completed ones gone from live.
      assert.deepEqual(liveDomains(dir), ['live-A', 'live-B']);
      // Completed domains archived with their content.
      assert.ok(fs.existsSync(path.join(archive, 'domains', 'mNN-d1', 'scope.md')));
      assert.ok(fs.existsSync(path.join(archive, 'domains', 'mNN-d2', 'tasks.md')));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('IDEMPOTENT — re-running is a no-op (already archived + already removed)', () => {
    const dir = makeProject(['mNN-d1', 'live-A']);
    const archive = path.join(dir, '.gsd-t', 'milestones', 'mNN-2026-06-22');
    try {
      const r1 = archiveDomains({ domains: ['mNN-d1'], archiveDir: archive, projectDir: dir });
      assert.ok(r1.ok);
      assert.deepEqual(r1.removed, ['mNN-d1']);
      // Second run: nothing live, already archived → skipped, no error, live unchanged.
      const r2 = archiveDomains({ domains: ['mNN-d1'], archiveDir: archive, projectDir: dir });
      assert.ok(r2.ok, JSON.stringify(r2));
      assert.deepEqual(r2.archived, []);
      assert.deepEqual(r2.removed, []);
      assert.deepEqual(r2.skipped, ['mNN-d1']);
      assert.deepEqual(liveDomains(dir), ['live-A']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('dry-run computes the plan but writes nothing', () => {
    const dir = makeProject(['mNN-d1', 'live-A']);
    const archive = path.join(dir, '.gsd-t', 'milestones', 'mNN-2026-06-22');
    try {
      const r = archiveDomains({ domains: ['mNN-d1'], archiveDir: archive, projectDir: dir, dryRun: true });
      assert.ok(r.ok && r.dryRun);
      assert.deepEqual(r.removed, ['mNN-d1']);
      // Nothing actually changed.
      assert.deepEqual(liveDomains(dir), ['live-A', 'mNN-d1']);
      assert.ok(!fs.existsSync(path.join(archive, 'domains', 'mNN-d1')));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('CONTAINMENT GUARD — refuses a name with path separators / dot-segments (no partial sweep)', () => {
    const dir = makeProject(['mNN-d1', 'live-A']);
    const archive = path.join(dir, '.gsd-t', 'milestones', 'mNN-2026-06-22');
    try {
      for (const evil of ['../escape', 'a/b', '..', '.', 'x/../../etc']) {
        const r = archiveDomains({ domains: ['mNN-d1', evil], archiveDir: archive, projectDir: dir });
        assert.equal(r.ok, false, `must refuse ${JSON.stringify(evil)}`);
        assert.match(r.error, /invalid domain name|containment/i);
      }
      // Fail-closed: a refused batch swept NOTHING (mNN-d1 still live).
      assert.deepEqual(liveDomains(dir), ['live-A', 'mNN-d1']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('bad input — empty domains list / missing archive → { ok:false }', () => {
    const dir = makeProject(['mNN-d1']);
    try {
      assert.equal(archiveDomains({ domains: [], archiveDir: 'x', projectDir: dir }).ok, false);
      assert.equal(archiveDomains({ domains: ['mNN-d1'], projectDir: dir }).ok, false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
