'use strict';

/**
 * GSD-T Spawn Plan — token formatting + cumulative totals (M44 D8 T7)
 *
 * Pure helper module used by the transcript right-side spawn-plan panel.
 * Extracted from the inline script in `scripts/gsd-t-transcript.html` so the
 * same functions can be unit-tested under Node without loading a DOM.
 *
 * Contract: .gsd-t/contracts/spawn-plan-contract.md v1.0.0
 *   - Token cell format: `in=12.5k out=1.7k $0.42` (k-suffix above 1000,
 *     2-decimal USD). Returns `—` when tokens are null/missing.
 *   - Cumulative totals: sum `{in,out,cr,cc,cost_usd}` across done tasks.
 *     Returns `null` when no done-task has tokens (panel renders `—`).
 *
 * Zero external deps. `.cjs` so it loads in both ESM-default and CJS projects.
 */

/**
 * k-suffix number formatter. `1500` → `1.5k`, `999` → `999`, `null` → `0`.
 * Used by `fmtTokens` to compact large counts.
 *
 * @param {number|string|null|undefined} n
 * @returns {string}
 */
function fmtK(n) {
  if (n == null || Number.isNaN(Number(n))) return '0';
  const num = Number(n);
  if (Math.abs(num) >= 1000) return (num / 1000).toFixed(1) + 'k';
  return String(num);
}

/**
 * Render a token-cell string from a `{in, out, cr, cc, cost_usd}` object.
 * When `tokens` is null/undefined/non-object, returns the em-dash marker
 * per the "zero is a measurement, dash is acknowledged gap" rule.
 *
 * @param {object|null|undefined} tokens
 * @returns {string}
 */
function fmtTokens(tokens) {
  if (!tokens || typeof tokens !== 'object') return '—';
  const ins = fmtK(tokens.in);
  const out = fmtK(tokens.out);
  const cost = (typeof tokens.cost_usd === 'number')
    ? '$' + tokens.cost_usd.toFixed(2)
    : '';
  return ['in=' + ins, 'out=' + out, cost].filter(Boolean).join(' ');
}

/**
 * Sum the `tokens` field across every task whose `status === 'done'` and
 * whose `tokens` is a populated object. Returns null when no done-task has
 * a tokens object attached — the panel renders that state as `—`.
 *
 * @param {Array<{status?:string, tokens?:object}>|null|undefined} tasks
 * @returns {{in:number,out:number,cr:number,cc:number,cost_usd:number}|null}
 */
function sumTokens(tasks) {
  const acc = { in: 0, out: 0, cr: 0, cc: 0, cost_usd: 0 };
  let hit = false;
  for (const t of (tasks || [])) {
    if (!t || t.status !== 'done' || !t.tokens) continue;
    acc.in += Number(t.tokens.in || 0);
    acc.out += Number(t.tokens.out || 0);
    acc.cr += Number(t.tokens.cr || 0);
    acc.cc += Number(t.tokens.cc || 0);
    acc.cost_usd += Number(t.tokens.cost_usd || 0);
    hit = true;
  }
  if (!hit) return null;
  acc.cost_usd = Math.round(acc.cost_usd * 100) / 100;
  return acc;
}

module.exports = {
  fmtK,
  fmtTokens,
  sumTokens,
};
