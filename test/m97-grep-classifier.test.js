'use strict';

/**
 * M97 — grep classifier precision tests.
 *
 * The classifier is conservative: STRUCTURAL only for clear symbol/call/import
 * shapes; everything else is TEXT (grep passes through). A false-structural
 * hijacks a real text search — so these tests hammer the TEXT side hard.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyGrep } = require('../bin/gsd-t-grep-classifier.cjs');

test('STRUCTURAL: a bare function/symbol name → who-calls', () => {
  for (const p of ['computeTotal', 'handleSubmit', 'UserService', '_privateFn', '$store']) {
    const r = classifyGrep(p);
    assert.equal(r.structural, true, `${p} should be structural`);
    assert.equal(r.symbol, p);
    assert.equal(r.verb, 'who-calls');
  }
});

test('STRUCTURAL: a call shape foo( → who-calls on foo', () => {
  const r = classifyGrep('computeTotal(');
  assert.equal(r.structural, true);
  assert.equal(r.symbol, 'computeTotal');
  assert.equal(r.verb, 'who-calls');
});

test('STRUCTURAL: a member call Obj.method → who-calls on method', () => {
  for (const [p, sym] of [['this.relay', 'relay'], ['router.register(', 'register']]) {
    const r = classifyGrep(p);
    assert.equal(r.structural, true, `${p} should be structural`);
    assert.equal(r.symbol, sym);
    assert.equal(r.verb, 'who-calls');
  }
});

test('STRUCTURAL: import of a symbol → who-imports', () => {
  for (const [p, sym] of [
    ['import { computeTotal }', 'computeTotal'],
    ['import React', 'React'],
    ['from app.utils import compute_total', 'compute_total'],
  ]) {
    const r = classifyGrep(p);
    assert.equal(r.structural, true, `${p} should be structural`);
    assert.equal(r.symbol, sym);
    assert.equal(r.verb, 'who-imports');
  }
});

test('TEXT: string literals / error messages / TODOs pass through', () => {
  for (const p of [
    'Payment failed for invoice',
    'TODO: refactor this',
    'Error: cannot connect to database',
    'user@example.com',
    'https://api.example.com/v1',
    'the quick brown fox',
  ]) {
    const r = classifyGrep(p);
    assert.equal(r.structural, false, `"${p}" must be TEXT (no false structural)`);
    assert.equal(r.verb, null);
  }
});

test('TEXT: regexes and patterns with metacharacters pass through', () => {
  for (const p of [
    '^import.*from',
    'function\\s+\\w+',
    'foo|bar',
    '\\d{3}-\\d{4}',
    'class\\s+[A-Z]',
    'a.*b',
    'value =',
  ]) {
    const r = classifyGrep(p);
    assert.equal(r.structural, false, `regex "${p}" must be TEXT`);
  }
});

test('TEXT: file paths and multi-segment dotted names pass through (not bare symbols)', () => {
  for (const p of ['src/utils/helper.ts', 'a.b.c.d', 'config.database.host']) {
    const r = classifyGrep(p);
    assert.equal(r.structural, false, `"${p}" must be TEXT`);
  }
});

test('TEXT: empty / whitespace / overly long patterns pass through', () => {
  assert.equal(classifyGrep('').structural, false);
  assert.equal(classifyGrep('   ').structural, false);
  assert.equal(classifyGrep(null).structural, false);
  assert.equal(classifyGrep(undefined).structural, false);
  assert.equal(classifyGrep('x'.repeat(120)).structural, false, 'a 120-char pattern is prose, not a symbol');
});

test('TEXT: a sentence that happens to start with a word is not a bare symbol', () => {
  // BARE_IDENT requires the WHOLE pattern to be one identifier — a phrase has spaces.
  assert.equal(classifyGrep('compute the total').structural, false);
  assert.equal(classifyGrep('handle submit event').structural, false);
});
