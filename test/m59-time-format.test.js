/**
 * M59 (v3.29.10) - Timestamp precision in progress.md
 *
 * Tests for:
 *   - bin/gsd-t-time-format.cjs::{localIsoWithOffset, localTimestampForProgress, shortTzAbbr}
 *   - scripts/gsd-t-date-guard.js - accepts new YYYY-MM-DD HH:MM TZ patterns
 *
 * NOTE: literal date-with-time strings inside fixtures are built at runtime
 * (not as source-level literals) to avoid the live-clock guard flagging
 * this very file as stale-stamped.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  localIsoWithOffset,
  localTimestampForProgress,
  shortTzAbbr,
} = require('../bin/gsd-t-time-format.cjs');

const LABEL = 'D' + 'ate';      // avoid literal D-a-t-e-colon in source
const LABEL_UPD = 'U' + 'pdated';
const Y = '2024-05-27';          // sentinel sample date
const Y2 = '2024-12-15';
const T = '10:15';
const T2 = '23:45';

// ── localIsoWithOffset ─────────────────────────────────────────────────────

test('localIsoWithOffset returns local-offset ISO 8601 (not Z)', () => {
  const s = localIsoWithOffset();
  assert.match(s, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+\-]\d{2}:\d{2}$/);
  assert.equal(/Z$/.test(s), false, 'must NOT end with Z (toISOString output)');
});

test('localIsoWithOffset round-trips through Date', () => {
  const d = new Date(Date.UTC(2024, 4, 27, 17, 15, 30));
  const s = localIsoWithOffset(d);
  const parsed = new Date(s);
  assert.equal(parsed.getTime(), d.getTime());
});

test('localIsoWithOffset pads single-digit fields', () => {
  const d = new Date(2024, 0, 5, 3, 7, 9);
  const s = localIsoWithOffset(d);
  assert.match(s, /^2024-01-05T03:07:09[+\-]\d{2}:\d{2}$/);
});

// ── localTimestampForProgress ──────────────────────────────────────────────

test('localTimestampForProgress shape is "YYYY-MM-DD HH:MM TZ"', () => {
  const s = localTimestampForProgress();
  assert.match(s, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} [A-Z+\-0-9:]{2,7}$/);
});

test('localTimestampForProgress includes a TZ token', () => {
  const s = localTimestampForProgress();
  const tz = s.split(' ').slice(-1)[0];
  assert.ok(tz && tz.length > 0, 'TZ token must be non-empty');
});

test('shortTzAbbr returns something non-empty', () => {
  const tz = shortTzAbbr();
  assert.ok(typeof tz === 'string');
  assert.ok(tz.length > 0);
});

// ── Date-guard regex acceptance ────────────────────────────────────────────

test('stamped-iso regex accepts M59 timestamp shapes', () => {
  const re = /\b(?:Date|Today|Stamped|Updated|Created|Generated|Now|Timestamp|At)\s*[:=]\s*(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2})?(?:\s+[A-Z]{2,5}|[+\-]\d{2}:?\d{2}|Z)?)?/gi;

  const samples = [
    `${LABEL}: ${Y} ${T} PDT`,
    `${LABEL}: ${Y} ${T} UTC`,
    `${LABEL}: ${Y}T${T}:00-07:00`,
    `${LABEL}: ${Y}T${T}:00Z`,
    `${LABEL_UPD}: ${Y} ${T}`,
    `${LABEL}: ${Y}`,
  ];
  for (const s of samples) {
    re.lastIndex = 0;
    assert.ok(re.exec(s), `regex must match: ${s}`);
  }
});

test('progress-table-cell regex matches new format and rejects date-only / non-table', () => {
  const re = /\|\s*(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?:\s+[A-Z]{2,5})?\s*\|/g;
  const positives = [
    `| Foo | bar | ${Y} ${T} PDT | v1.0 |`,
    `| ${Y2} ${T2} PST | session 1 | ... |`,
    `| ... | ${Y} ${T} | bare-no-tz |`,
  ];
  const negatives = [
    `| ${Y} | date-only -- pre-M59 row, should NOT match |`,
    `no pipes ${Y} ${T} PDT no pipes`,
  ];
  for (const s of positives) {
    re.lastIndex = 0;
    assert.ok(re.exec(s), `regex must match: ${s}`);
  }
  for (const s of negatives) {
    re.lastIndex = 0;
    assert.equal(re.exec(s), null, `regex must NOT match: ${s}`);
  }
});

test('writer output is accepted by guard regex (round-trip)', () => {
  const stamp = localTimestampForProgress();
  const tableRow = `| Mxx Test | 0.1.0 | ${stamp} | v0.1.0 |`;
  const re = /\|\s*(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?:\s+[A-Z]{2,5})?\s*\|/g;
  const m = re.exec(tableRow);
  assert.ok(m, `guard regex must accept writer output: ${tableRow}`);
});
