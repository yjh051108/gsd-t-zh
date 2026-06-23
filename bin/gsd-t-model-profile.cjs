/**
 * gsd-t-model-profile.cjs
 *
 * Brain for the `gsd-t model-profile` CLI subcommand.
 * Reads/writes `.gsd-t/model-profile.json` and exposes a profile-aware
 * resolver that injects concrete model ids into workflow args.
 *
 * Zero external runtime deps — installer-package invariant.
 * No top-level side effects (require-safe).
 *
 * Contract: .gsd-t/contracts/model-profile-config-contract.md v1.0.0 STABLE
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const policy = require('./gsd-t-model-tier-policy.cjs');

// Version-skew guard (Red Team M86 r2): if the sibling policy module is an older
// copy lacking the M86 profile surface (seen live when a pre-M86 propagation pass
// overwrote it), fail with a STRUCTURED error instead of a raw TypeError at the
// Object.keys() lines below — the contracted envelope shape even on skew.
const _missingPolicyExports = ['MODEL_IDS', 'PROFILE_STAGE_TIERS', 'INJECTABLE_STAGES', 'resolveProfile', 'requiresThinkingOmitted']
  .filter((k) => policy[k] === undefined);
if (_missingPolicyExports.length) {
  const msg = `gsd-t-model-tier-policy.cjs is missing the M86 profile surface (${_missingPolicyExports.join(', ')}) — ` +
    'version skew: an older policy module is installed alongside this CLI. Reinstall/update @tekyzinc/gsd-t.';
  if (require.main === module) {
    // The guard runs before flag parsing; honor the output convention manually.
    if (process.argv.includes('--json')) {
      process.stdout.write(JSON.stringify({ ok: false, error: msg }) + '\n');
    } else {
      process.stderr.write(msg + '\n');
    }
    process.exit(1);
  }
  throw new Error(msg);
}

const { MODEL_IDS, PROFILE_STAGE_TIERS, INJECTABLE_STAGES, resolveProfile, requiresThinkingOmitted } = policy;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The global default profile (SC(f) — named, never blank). */
const GLOBAL_DEFAULT_PROFILE = 'premium';

/** Valid profile names. */
const VALID_PROFILES = Object.keys(PROFILE_STAGE_TIERS); // ['standard','pro','premium']

/** Valid tier names. */
const VALID_TIERS = Object.keys(MODEL_IDS); // ['opus','fable','sonnet','haiku']

/**
 * Stages that CANNOT be overridden (M82 blindness invariant).
 * competition-producers is always opus — not injectable.
 */
const NON_INJECTABLE_STAGES = ['competition-producers'];

// ---------------------------------------------------------------------------
// Config read/write helpers
// ---------------------------------------------------------------------------

/**
 * Read and parse `.gsd-t/model-profile.json` from the given project root.
 * Returns { ok, profile, stageOverrides, configError? } — never throws.
 * Absent file → named global default (SC(f)).
 *
 * @param {string} projectDir
 * @returns {{ ok: boolean, profile: string, stageOverrides: Record<string,string>, configError?: string }}
 */
function readConfig(projectDir) {
  const configPath = path.join(projectDir, '.gsd-t', 'model-profile.json');

  if (!fs.existsSync(configPath)) {
    return { ok: true, profile: GLOBAL_DEFAULT_PROFILE, stageOverrides: {} };
  }

  let raw;
  try {
    raw = fs.readFileSync(configPath, 'utf8');
  } catch (err) {
    return {
      ok: false,
      profile: GLOBAL_DEFAULT_PROFILE,
      stageOverrides: {},
      configError: `Failed to read config file: ${err.message}`,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      ok: false,
      profile: GLOBAL_DEFAULT_PROFILE,
      stageOverrides: {},
      configError: `model-profile.json is not valid JSON: ${err.message}`,
    };
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      profile: GLOBAL_DEFAULT_PROFILE,
      stageOverrides: {},
      configError: 'model-profile.json must be a JSON object',
    };
  }

  // Validate profile field
  let profile = GLOBAL_DEFAULT_PROFILE;
  let configError;
  if ('profile' in parsed) {
    if (typeof parsed.profile !== 'string') {
      configError = `model-profile.json "profile" field must be a string, got ${typeof parsed.profile}`;
    } else if (!VALID_PROFILES.includes(parsed.profile)) {
      configError = `model-profile.json "profile" is unknown: "${parsed.profile}"; defaulting to "${GLOBAL_DEFAULT_PROFILE}"`;
    } else {
      profile = parsed.profile;
    }
  }

  // Validate stageOverrides field. Per-entry validation is OWN-PROPERTY and
  // membership-based — a string that merely indexes something truthy (e.g.
  // "constructor") is NOT a valid tier (Red Team M86 HIGH: prototype-key tier
  // values produced a clean envelope with the stage silently dropped → the
  // workflow fallback billed premium on a cost-control profile).
  let stageOverrides = {};
  if ('stageOverrides' in parsed) {
    if (parsed.stageOverrides === null || typeof parsed.stageOverrides !== 'object' || Array.isArray(parsed.stageOverrides)) {
      configError = configError || `model-profile.json "stageOverrides" must be an object`;
    } else {
      for (const [k, v] of Object.entries(parsed.stageOverrides)) {
        if (NON_INJECTABLE_STAGES.includes(k)) {
          configError = configError || `model-profile.json stageOverrides["${k}"]: competition-producers is not overridable (M82); entry ignored`;
        } else if (!INJECTABLE_STAGES.includes(k)) {
          configError = configError || `model-profile.json stageOverrides has unknown stage "${k}"; entry ignored`;
        } else if (typeof v !== 'string' || !VALID_TIERS.includes(v)) {
          configError = configError || `model-profile.json stageOverrides["${k}"] has invalid tier ${JSON.stringify(v)}; entry ignored`;
        } else {
          stageOverrides[k] = v;
        }
      }
    }
  }

  if (configError) {
    return { ok: false, profile, stageOverrides, configError };
  }

  return { ok: true, profile, stageOverrides };
}

/**
 * Write `.gsd-t/model-profile.json`.
 *
 * @param {string} projectDir
 * @param {{ profile?: string, stageOverrides?: Record<string,string> }} data
 * @returns {{ ok: boolean, error?: string }}
 */
function writeConfig(projectDir, data) {
  const dir = path.join(projectDir, '.gsd-t');
  const configPath = path.join(dir, 'model-profile.json');

  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Blindness clamp validation (enforced at WRITE and at RESOLVE)
// ---------------------------------------------------------------------------

/**
 * Validate that a set-stage operation is permitted.
 * Returns { ok, error? } — does NOT throw.
 *
 * Clamps:
 *   - competition-producers: not overridable (M82 blindness invariant)
 *   - competition-judge = opus (producers' model): judge ≠ producers (M82)
 *
 * @param {string} stageKey
 * @param {string} tier
 * @returns {{ ok: boolean, error?: string }}
 */
function validateSetStage(stageKey, tier) {
  if (NON_INJECTABLE_STAGES.includes(stageKey)) {
    return {
      ok: false,
      error: `Stage "${stageKey}" is not overridable (M82 blindness invariant — competition-producers is always held at opus)`,
    };
  }

  // Unknown stage keys are rejected, not persisted (Red Team M86 MEDIUM: a typo'd
  // stage got a success message + a persisted override that never takes effect,
  // and `show` silently hid it).
  if (!INJECTABLE_STAGES.includes(stageKey)) {
    return {
      ok: false,
      error: `Unknown stage "${stageKey}". Injectable stages: ${INJECTABLE_STAGES.join(', ')}`,
    };
  }

  if (!VALID_TIERS.includes(tier)) {
    return {
      ok: false,
      error: `Unknown tier "${tier}". Valid tiers: ${VALID_TIERS.join(', ')}`,
    };
  }

  if (stageKey === 'competition-judge' && MODEL_IDS[tier] === MODEL_IDS.opus) {
    return {
      ok: false,
      error: `competition-judge cannot be set to "${tier}" (resolves to "${MODEL_IDS[tier]}") — judge model must differ from producers' model (M82 blindness invariant)`,
    };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Resolve envelope builder (the seam D2/D4 consume)
// ---------------------------------------------------------------------------

/**
 * Build the full resolve envelope for a profile + stageOverrides combo.
 * Enforces blindness clamps at resolve time (hand-edited configs are safe).
 *
 * @param {string} profile
 * @param {Record<string,string>} stageOverrides
 * @param {string} [specificStage] — if given, return single-stage result
 * @param {string} [configError] — propagate from config read
 * @returns {object}
 */
function buildResolveEnvelope(profile, stageOverrides, specificStage, configError) {
  // Validate profile
  if (!VALID_PROFILES.includes(profile)) {
    return { ok: false, error: `Unknown profile "${profile}". Valid profiles: ${VALID_PROFILES.join(', ')}` };
  }

  // If a specific stage is requested
  if (specificStage !== undefined) {
    // Unknown stage → explicit error (Red Team M86 MEDIUM: silently returning
    // ok:true sonnet for a typo'd stage regressed the M85 explicit unknown-stage error).
    if (specificStage !== 'competition-producers' && !INJECTABLE_STAGES.includes(specificStage)) {
      return {
        ok: false,
        error: `Unknown stage "${specificStage}". Valid stages: ${INJECTABLE_STAGES.join(', ')}, competition-producers`,
      };
    }
    if (specificStage === 'competition-producers') {
      const modelId = MODEL_IDS.opus;
      const result = { ok: true, profile, stage: specificStage, model: modelId, requiresThinkingOmitted: requiresThinkingOmitted(modelId) };
      if (configError) result.configError = configError;
      return result;
    }
    const r = resolveProfile(specificStage, { profile, stageOverrides });
    const result = { ok: true, profile, stage: specificStage, model: r.model, requiresThinkingOmitted: r.requiresThinkingOmitted };
    if (r.configError) result.configError = r.configError;
    else if (configError) result.configError = configError;
    return result;
  }

  // Build overrides map for all injectable stages
  const overrides = {};
  const thinkingMap = {};
  let envelopeConfigError = configError;

  for (const stage of INJECTABLE_STAGES) {
    const r = resolveProfile(stage, { profile, stageOverrides });
    overrides[stage] = r.model;
    thinkingMap[stage] = r.requiresThinkingOmitted;
    if (r.configError && !envelopeConfigError) envelopeConfigError = r.configError;
  }

  // Verify competition-judge !== producers' model (final assertion)
  if (overrides['competition-judge'] === MODEL_IDS.opus) {
    // This should never reach here (resolveProfile clamps it), but defense in depth
    envelopeConfigError = envelopeConfigError || 'blindness clamp: competition-judge resolved to producers model — using profile fallback';
    const fallbackR = resolveProfile('competition-judge', { profile, stageOverrides: {} });
    overrides['competition-judge'] = fallbackR.model;
    thinkingMap['competition-judge'] = fallbackR.requiresThinkingOmitted;
  }

  const result = {
    ok: true,
    profile,
    overrides,
    requiresThinkingOmitted: thinkingMap,
  };
  if (envelopeConfigError) result.configError = envelopeConfigError;
  return result;
}

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------

if (require.main === module) {
  const rawArgs = process.argv.slice(2);
  const jsonFlag = rawArgs.includes('--json');
  const positional = rawArgs.filter(a => !a.startsWith('-'));
  const subcommand = positional[0];

  // Detect project dir: look for .gsd-t relative to cwd
  const projectDir = process.cwd();

  function emit(obj, exitCode) {
    if (jsonFlag) {
      process.stdout.write(JSON.stringify(obj) + '\n');
    } else {
      if (!obj.ok) {
        process.stderr.write((obj.error || obj.configError || 'Unknown error') + '\n');
      } else {
        // Human-readable output
        if (obj.message) process.stdout.write(obj.message + '\n');
        if (obj.warning) process.stderr.write(`warning: ${obj.warning}\n`);
        if (obj.profile !== undefined && obj.overrides !== undefined) {
          process.stdout.write(`profile: ${obj.profile}\n`);
          for (const [k, v] of Object.entries(obj.overrides)) {
            process.stdout.write(`  ${k}: ${v}${obj.requiresThinkingOmitted[k] ? ' (requiresThinkingOmitted)' : ''}\n`);
          }
          if (obj.configError) process.stderr.write(`warning: ${obj.configError}\n`);
        } else if (obj.model !== undefined) {
          process.stdout.write(`model: ${obj.model}\n`);
          if (obj.requiresThinkingOmitted) process.stdout.write(`requiresThinkingOmitted: true\n`);
          if (obj.configError) process.stderr.write(`warning: ${obj.configError}\n`);
        } else {
          process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
        }
      }
    }
    process.exit(exitCode !== undefined ? exitCode : (obj.ok ? 0 : 1));
  }

  if (subcommand === 'show') {
    const cfg = readConfig(projectDir);
    if (!cfg.ok && cfg.configError) {
      emit({ ok: false, error: cfg.configError, profile: cfg.profile, stageOverrides: cfg.stageOverrides }, 1);
    } else {
      const envelope = buildResolveEnvelope(cfg.profile, cfg.stageOverrides, undefined, cfg.configError);
      emit(envelope);
    }
  } else if (subcommand === 'set') {
    const newProfile = positional[1];
    if (!newProfile) {
      emit({ ok: false, error: 'Usage: gsd-t model-profile set <profile>' }, 1);
      return;
    }
    if (!VALID_PROFILES.includes(newProfile)) {
      emit({ ok: false, error: `Unknown profile "${newProfile}". Valid profiles: ${VALID_PROFILES.join(', ')}` }, 1);
      return;
    }
    const cfg = readConfig(projectDir);
    // Setting the profile is the user's explicit intent — proceed even over a
    // config with errors, but NAME what the rewrite normalizes away (Red Team
    // M86 r2 LOW: a silent rewrite dropped invalid entries with no mention).
    const newData = { profile: newProfile, stageOverrides: cfg.stageOverrides || {} };
    const result = writeConfig(projectDir, newData);
    if (!result.ok) {
      emit({ ok: false, error: result.error }, 1);
    } else {
      const out = { ok: true, profile: newProfile, message: `Profile set to "${newProfile}"` };
      if (cfg.configError) out.warning = `previous config had an error and was normalized: ${cfg.configError}`;
      emit(out);
    }
  } else if (subcommand === 'set-stage') {
    const stage = positional[1];
    const tier  = positional[2];
    if (!stage || !tier) {
      emit({ ok: false, error: 'Usage: gsd-t model-profile set-stage <stage> <tier>' }, 1);
      return;
    }
    const valid = validateSetStage(stage, tier);
    if (!valid.ok) {
      emit({ ok: false, error: valid.error }, 1);
      return;
    }
    const cfg = readConfig(projectDir);
    // REFUSE to rewrite over an erroring config (Red Team M86 r2 MEDIUM: the
    // rewrite persisted readConfig's defaulted "premium" over a typo'd
    // standard-intent profile — a stage tweak silently ESCALATING the spend
    // posture — and silently dropped invalid entries). set-stage must never
    // change the profile as a side effect; fix the config (or run `set`) first.
    if (cfg.configError) {
      emit({
        ok: false,
        error: `config has an error — refusing to rewrite (a rewrite would persist normalized values the user never set): ${cfg.configError}. ` +
          `Fix .gsd-t/model-profile.json or run \`gsd-t model-profile set <profile>\` first.`,
      }, 1);
      return;
    }
    const newOverrides = Object.assign({}, cfg.stageOverrides || {}, { [stage]: tier });
    const newData = { profile: cfg.profile, stageOverrides: newOverrides };
    const result = writeConfig(projectDir, newData);
    if (!result.ok) {
      emit({ ok: false, error: result.error }, 1);
    } else {
      emit({ ok: true, stage, tier, model: MODEL_IDS[tier], message: `Stage "${stage}" override set to tier "${tier}" (${MODEL_IDS[tier]})` });
    }
  } else if (subcommand === 'resolve') {
    // Flags: --profile <p> [stage]
    const profileFlagIdx = rawArgs.indexOf('--profile');
    let profileArg;
    if (profileFlagIdx !== -1 && rawArgs[profileFlagIdx + 1] && !rawArgs[profileFlagIdx + 1].startsWith('-')) {
      profileArg = rawArgs[profileFlagIdx + 1];
    }

    // Determine profile: from --profile flag, or from config file
    let profile, stageOverrides, configError;
    if (profileArg) {
      if (!VALID_PROFILES.includes(profileArg)) {
        emit({ ok: false, error: `Unknown profile "${profileArg}". Valid profiles: ${VALID_PROFILES.join(', ')}` }, 1);
        return;
      }
      profile = profileArg;
      stageOverrides = {};
    } else {
      const cfg = readConfig(projectDir);
      profile = cfg.profile;
      stageOverrides = cfg.stageOverrides;
      configError = cfg.configError;
      if (!cfg.ok) {
        emit({ ok: false, error: configError || 'Failed to read config' }, 1);
        return;
      }
    }

    // Optional specific stage as a positional arg AFTER 'resolve', excluding
    // the value of --profile <p> from the positional array.
    // rawArgs example: ['resolve', '--profile', 'pro', 'red-team', '--json']
    // We want 'red-team' but not 'pro' (consumed by --profile flag).
    const profileFlagValuesToExclude = new Set();
    if (profileFlagIdx !== -1 && rawArgs[profileFlagIdx + 1] && !rawArgs[profileFlagIdx + 1].startsWith('-')) {
      profileFlagValuesToExclude.add(rawArgs[profileFlagIdx + 1]);
    }
    const resolvePositional = rawArgs.filter((a, i) => {
      if (a.startsWith('-')) return false;
      // exclude the value immediately following --profile
      if (profileFlagIdx !== -1 && i === profileFlagIdx + 1) return false;
      return true;
    });
    // resolvePositional[0] = 'resolve', [1] = optional stage
    const specificStage = resolvePositional[1];

    const envelope = buildResolveEnvelope(profile, stageOverrides, specificStage, configError);
    emit(envelope);
  } else {
    const usage = 'Usage: gsd-t model-profile <show|set <profile>|set-stage <stage> <tier>|resolve [--profile <p>] [stage]> [--json]';
    if (jsonFlag) {
      process.stdout.write(JSON.stringify({ ok: false, error: usage }) + '\n');
    } else {
      process.stderr.write(usage + '\n');
    }
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Exports (for require() consumers and tests)
// ---------------------------------------------------------------------------

module.exports = {
  GLOBAL_DEFAULT_PROFILE,
  VALID_PROFILES,
  VALID_TIERS,
  NON_INJECTABLE_STAGES,
  readConfig,
  writeConfig,
  validateSetStage,
  buildResolveEnvelope,
};
