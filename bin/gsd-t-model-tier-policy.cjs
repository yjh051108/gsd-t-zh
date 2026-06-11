/**
 * gsd-t-model-tier-policy.cjs
 *
 * SINGLE source of truth for GSD-T model-tier policy.
 * Zero external runtime deps — installer-package invariant.
 * No top-level side effects.
 *
 * Contract: .gsd-t/contracts/model-tier-policy-contract.md v1.1.0 STABLE
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
// Profile Dimension (M86 — additive over the frozen M85 STAGE_TIERS)
// ---------------------------------------------------------------------------

/**
 * Frozen profile → stage-key → tier map.
 *
 * Three named profiles:
 *   standard  — ZERO fable (pre-M85 tiers: probes→opus, judge→sonnet,
 *                pre-mortem→opus, red-team→opus, debug both cycles→opus).
 *   pro       — red-team + pre-mortem + debug-cycle-2 → fable; everything
 *                else reverts to standard.
 *   premium   — all 6 M85 fable stages (the full M85 posture).
 *
 * competition-producers is HELD at opus in ALL profiles (M82 blindness
 * invariant — never fable). It is NOT included here because it is never
 * overridable; the resolver enforces this separately.
 *
 * @type {Readonly<Record<string, Readonly<Record<string, string>>>>}
 */
const PROFILE_STAGE_TIERS = Object.freeze({
  standard: Object.freeze({
    'solution-space-probe': 'opus',
    'partition-probe':      'opus',
    'competition-judge':    'sonnet',
    'pre-mortem':           'opus',
    'red-team':             'opus',
    'debug-cycle-2':        'opus',
  }),
  pro: Object.freeze({
    'solution-space-probe': 'opus',
    'partition-probe':      'opus',
    'competition-judge':    'sonnet',
    'pre-mortem':           'fable',
    'red-team':             'fable',
    'debug-cycle-2':        'fable',
  }),
  premium: Object.freeze({
    'solution-space-probe': 'fable',
    'partition-probe':      'fable',
    'competition-judge':    'fable',
    'pre-mortem':           'fable',
    'red-team':             'fable',
    'debug-cycle-2':        'fable',
  }),
});

/** The 6 injectable designated stages (competition-producers excluded). */
const INJECTABLE_STAGES = Object.freeze([
  'solution-space-probe',
  'partition-probe',
  'competition-judge',
  'pre-mortem',
  'red-team',
  'debug-cycle-2',
]);

/** The HELD producers model id — used by blindness clamps. */
const PRODUCERS_MODEL_ID = MODEL_IDS.opus; // claude-opus-4-8

/**
 * Resolves the concrete model id for a given stage key under a profile,
 * honoring precedence: stageOverrides[stage] ?? profile-tier ?? global-default.
 *
 * Blindness clamps (M82 / pre-mortem c2 #4 — enforced at RESOLVE, not only at
 * write time because the config file is hand-editable):
 *   - competition-producers key in stageOverrides: silently dropped (never in overrides map).
 *   - competition-judge resolved to the producers' model id: BLOCKED — drops the override
 *     and uses the profile tier for competition-judge instead.
 *
 * @param {string} stageKey
 * @param {{ profile?: string, stageOverrides?: Record<string,string> }} opts
 * @returns {{ model: string, tier: string, requiresThinkingOmitted: boolean,
 *             configError?: string }}
 */
// Own-property lookup guard. Validation-by-truthiness (`!MODEL_IDS[x]`) is a
// validation BYPASS for Object.prototype keys ("constructor", "toString", …):
// the inherited value is truthy, the resolved "model" is a function, and
// JSON.stringify silently DROPS the key from the envelope — the workflow's
// `?? "fable"` fallback then bills premium on a cost-control profile
// (Red Team M86 HIGH). Every tier/profile/stage map lookup goes through this.
function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function resolveProfile(stageKey, opts) {
  opts = opts || {};
  const profile = (typeof opts.profile === 'string' && hasOwn(PROFILE_STAGE_TIERS, opts.profile))
    ? opts.profile
    : 'premium'; // named global default

  const stageOverrides = (opts.stageOverrides && typeof opts.stageOverrides === 'object' && !Array.isArray(opts.stageOverrides))
    ? opts.stageOverrides
    : {};

  // competition-producers is held at opus — not resolvable via profile dimension.
  if (stageKey === 'competition-producers') {
    return {
      model: PRODUCERS_MODEL_ID,
      tier: 'opus',
      requiresThinkingOmitted: requiresThinkingOmitted(PRODUCERS_MODEL_ID),
    };
  }

  // Resolve tier from precedence chain:
  // 1. stageOverrides[stage] if it's a valid tier and not a blindness violation
  // 2. profile-tier
  // global-default (premium) is the fallback when profile is unknown (handled above)

  const profileTierMap = PROFILE_STAGE_TIERS[profile];
  let configError;
  let resolvedTier;

  const rawOverrideTier = hasOwn(stageOverrides, stageKey) ? stageOverrides[stageKey] : undefined;
  if (rawOverrideTier !== undefined) {
    if (typeof rawOverrideTier !== 'string' || !hasOwn(MODEL_IDS, rawOverrideTier)) {
      // Invalid tier in override — fall back to profile tier, record configError
      configError = `stageOverrides["${stageKey}"] has invalid tier "${rawOverrideTier}"; falling back to profile tier`;
      resolvedTier = (profileTierMap && hasOwn(profileTierMap, stageKey)) ? profileTierMap[stageKey] : 'fable';
    } else if (stageKey === 'competition-judge' && MODEL_IDS[rawOverrideTier] === PRODUCERS_MODEL_ID) {
      // Blindness clamp: competition-judge must not equal producers' model
      configError = `stageOverrides["competition-judge"] resolves to "${MODEL_IDS[rawOverrideTier]}" (=producers' model); blindness clamp rejected — falling back to profile tier`;
      resolvedTier = (profileTierMap && hasOwn(profileTierMap, stageKey)) ? profileTierMap[stageKey] : 'fable';
    } else {
      resolvedTier = rawOverrideTier;
    }
  } else if (profileTierMap && hasOwn(profileTierMap, stageKey)) {
    resolvedTier = profileTierMap[stageKey];
  } else {
    // Unknown stage key — defensive sonnet, but NEVER silently (Red Team M86 MEDIUM:
    // a typo'd stage returning ok:true sonnet regressed the M85 explicit unknown-stage error)
    configError = configError || `unknown stage "${stageKey}" — not a designated stage; defensive sonnet fallback`;
    resolvedTier = 'sonnet';
  }

  const modelId = hasOwn(MODEL_IDS, resolvedTier) ? MODEL_IDS[resolvedTier] : MODEL_IDS.sonnet;
  const result = {
    model: modelId,
    tier: resolvedTier,
    requiresThinkingOmitted: requiresThinkingOmitted(modelId),
  };
  if (configError) result.configError = configError;
  return result;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  MODEL_IDS,
  STAGE_TIERS,
  PROFILE_STAGE_TIERS,
  INJECTABLE_STAGES,
  requiresThinkingOmitted,
  resolve,
  resolveProfile,
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
