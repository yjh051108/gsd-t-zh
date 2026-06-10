/**
 * gsd-t-model-tier-policy.cjs
 *
 * SINGLE source of truth for GSD-T model-tier policy.
 * Zero external runtime deps — installer-package invariant.
 * No top-level side effects.
 *
 * Contract: .gsd-t/contracts/model-tier-policy-contract.md v1.0.0 STABLE
 */

'use strict';

// ---------------------------------------------------------------------------
// Published Model-ID Constants (M85 — authoritative, contract v1.0.0)
// ---------------------------------------------------------------------------

/**
 * Frozen map: tier alias → concrete model id.
 * Consumers MUST import from here — never re-hardcode these strings.
 *
 * @type {Readonly<{opus: string, fable: string, sonnet: string, haiku: string}>}
 */
const MODEL_IDS = Object.freeze({
  opus:   'claude-opus-4-8',
  fable:  'claude-fable-5',
  sonnet: 'claude-sonnet-4-6',
  haiku:  'claude-haiku-4-5-20251001',
});

// ---------------------------------------------------------------------------
// Stage Policy (M85 Fable assignments — contract v1.0.0 § "Stage Policy")
// ---------------------------------------------------------------------------

/**
 * Frozen map: stage key → tier alias.
 * 6 stages → fable; competition-producers held at opus (M82 blindness invariant).
 *
 * @type {Readonly<Record<string, string>>}
 */
const STAGE_TIERS = Object.freeze({
  'solution-space-probe':  'fable',
  'partition-probe':       'fable',
  'competition-judge':     'fable',
  'competition-producers': 'opus',  // HELD — M82 judge-blindness invariant; do NOT move to fable
  'pre-mortem':            'fable',
  'red-team':              'fable',
  'debug-cycle-2':         'fable',
});

// ---------------------------------------------------------------------------
// requiresThinkingOmitted predicate (encoding the Fable HTTP-400 breaking change)
// ---------------------------------------------------------------------------

/**
 * Returns true IFF the model requires the explicit thinking-disabled parameter
 * to be OMITTED from the API call.
 *
 * Rationale (canonical, single home): `claude-fable-5` returns HTTP 400 when
 * the explicit thinking-disabled parameter is sent. The parameter must therefore
 * be OMITTED for Fable. No other file may re-implement or re-state this predicate.
 *
 * @param {string} model — concrete model id or tier alias or any string
 * @returns {boolean}
 */
function requiresThinkingOmitted(model) {
  if (typeof model !== 'string') return false;
  // Source the id from MODEL_IDS (single-source — no second literal), and accept
  // the runtime's bracket-suffixed display form (e.g. "claude-fable-5[1m]").
  return model === MODEL_IDS.fable || model.startsWith(MODEL_IDS.fable + '[');
}

// ---------------------------------------------------------------------------
// resolve(stageKey) → concreteModelId
// ---------------------------------------------------------------------------

/**
 * Returns the concrete model id for the given stage key, or null for unknown keys.
 * Never throws.
 *
 * @param {string} stageKey
 * @returns {string|null}
 */
function resolve(stageKey) {
  try {
    const tier = STAGE_TIERS[stageKey];
    if (!tier) return null;
    const modelId = MODEL_IDS[tier];
    return modelId !== undefined ? modelId : null;
  } catch (_) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  MODEL_IDS,
  STAGE_TIERS,
  requiresThinkingOmitted,
  resolve,
};

// ---------------------------------------------------------------------------
// CLI dispatch (M69 invoke-time injection surface)
// run: node bin/gsd-t-model-tier-policy.cjs resolve <stageKey> [--json]
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);
  const jsonFlag = args.includes('--json');
  const positional = args.filter(a => !a.startsWith('-'));

  const command = positional[0];

  if (command === 'resolve') {
    const stageKey = positional[1];

    if (!stageKey) {
      const msg = 'Usage: gsd-t-model-tier-policy.cjs resolve <stageKey> [--json]';
      if (jsonFlag) {
        process.stdout.write(JSON.stringify({ ok: false, error: msg }) + '\n');
      } else {
        process.stderr.write(msg + '\n');
      }
      process.exit(1);
    }

    const tier = STAGE_TIERS[stageKey];
    const modelId = resolve(stageKey);

    if (modelId === null) {
      const envelope = { ok: false, stageKey, error: `Unknown stage key: "${stageKey}"` };
      if (jsonFlag) {
        process.stdout.write(JSON.stringify(envelope) + '\n');
      } else {
        process.stderr.write(`Unknown stage key: "${stageKey}"\n`);
      }
      process.exit(1);
    }

    const envelope = {
      ok: true,
      stageKey,
      tier,
      model: modelId,
      requiresThinkingOmitted: requiresThinkingOmitted(modelId),
    };

    if (jsonFlag) {
      process.stdout.write(JSON.stringify(envelope) + '\n');
    } else {
      process.stdout.write(`stageKey: ${stageKey}\ntier: ${tier}\nmodel: ${modelId}\nrequiresThinkingOmitted: ${envelope.requiresThinkingOmitted}\n`);
    }

    process.exit(0);
  }

  // Unknown command
  const usage = `Usage: gsd-t-model-tier-policy.cjs resolve <stageKey> [--json]`;
  if (jsonFlag) {
    process.stdout.write(JSON.stringify({ ok: false, error: usage }) + '\n');
  } else {
    process.stderr.write(usage + '\n');
  }
  process.exit(1);
}
