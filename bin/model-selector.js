#!/usr/bin/env node

/**
 * GSD-T Model Selector — surgical per-phase model tier assignment
 *
 * Replaces the v2.x "silent downgrade under context pressure" behavior with
 * declarative per-phase tier assignments. Callers ask `selectModel({phase, ...})`
 * and get back `{model, reason, escalation_hook}` — the tier decision is
 * deterministic, driven by the rules table below, and does NOT depend on
 * session context percentage.
 *
 * Contract: .gsd-t/contracts/model-selection-contract.md v1.0.0 (M35 T4)
 * Findings: .gsd-t/M35-advisor-findings.md (convention-based /advisor fallback)
 *
 * Zero external dependencies.
 */

// ── Tiers ───────────────────────────────────────────────────────────────────
// M85: FABLE tier added alongside HAIKU/SONNET/OPUS.
// Contract: .gsd-t/contracts/model-tier-policy-contract.md v1.0.0 § "Stage Policy"

const TIERS = Object.freeze({
  HAIKU: "haiku",
  SONNET: "sonnet",
  OPUS: "opus",
  FABLE: "fable",
});

const DEFAULT_TIER = TIERS.SONNET;

// ── Escalation hook block (convention-based /advisor fallback) ──────────────
//
// Per `.gsd-t/M35-advisor-findings.md`, Claude Code's native /advisor has no
// programmable API at subagent scope. This block is injected into the subagent
// prompt at declared escalation points on sonnet-tier phases where the
// orchestrator has flagged a high-stakes sub-decision.
//
// Kept as a constant so all consumers (command files, advisor-integration.js,
// M35-advisor-findings.md) reference the same canonical text.

const ESCALATION_HOOK = [
  "## Escalation Hook — /advisor convention-based fallback",
  "",
  "Before finalizing your answer for this phase, stop and consider:",
  "1. Is this decision high-stakes? (architecture, contract design, security boundary,",
  "   data-loss risk, cross-module refactor, adversarial QA verdict)",
  "2. Would a more capable model produce a materially better answer?",
  "3. Are you confident in the assumptions you're making?",
  "",
  "If YES to any of the above, do ONE of the following:",
  "- Escalate internally: spend an extra reasoning pass re-examining the decision",
  "  from first principles. Document the re-examination in your output.",
  "- Spawn a nested opus subagent: use the Task tool with",
  "  `subagent_type: \"general-purpose\"` and include `model: opus` in the spawn.",
  "",
  "Record in your output whether you escalated: set `ESCALATED_VIA_ADVISOR=true` or",
  "`ESCALATED_VIA_ADVISOR=false` on a line by itself near the end of your report.",
].join("\n");

// ── Declarative phase rules table ───────────────────────────────────────────
//
// Each rule maps (phase, task_type) → tier. The first matching rule wins.
// `task_type` is optional — when absent, the rule matches any task within
// that phase. Order the rules from most-specific to least-specific.
//
// Tier assignments mirror `.gsd-t/M35-definition.md` Part B and the Model
// Assignments section of the GSD-T global CLAUDE template:
//   - haiku:  strictly mechanical — test runners, branch guards, file checks,
//             JSON validation, no judgment
//   - sonnet: routine code work — execute step 2, test-sync, doc-ripple wiring,
//             quick fixes, integration wiring, debug fix-apply
//   - opus:   high-stakes reasoning — partition, discuss, Red Team, verify
//             judgment, debug root-cause, contract/architecture design

const PHASE_RULES = Object.freeze([
  // Phase: execute
  { phase: "execute", task_type: "test_runner",    model: TIERS.HAIKU,  reason: "Mechanical test-suite runner — zero judgment" },
  { phase: "execute", task_type: "branch_guard",   model: TIERS.HAIKU,  reason: "Mechanical branch-name check — zero judgment" },
  { phase: "execute", task_type: "file_check",     model: TIERS.HAIKU,  reason: "Mechanical file-existence check — zero judgment" },
  { phase: "execute", task_type: "qa",             model: TIERS.SONNET, reason: "QA evaluation needs judgment per M31 tier refinement" },
  { phase: "execute", task_type: "red_team",       model: TIERS.OPUS,   reason: "Adversarial QA benefits most from top tier" },
  { phase: "execute",                              model: TIERS.SONNET, reason: "Routine task execution — sonnet is the M35 default for routine work", hasEscalation: true },

  // Phase: wave (the wave orchestrator itself)
  { phase: "wave",                                 model: TIERS.SONNET, reason: "Wave orchestration dispatches per-phase subagents; the orchestrator itself is routine coordination", hasEscalation: true },

  // Phase: quick
  { phase: "quick", task_type: "test_runner",      model: TIERS.HAIKU,  reason: "Mechanical test-suite runner — zero judgment" },
  { phase: "quick",                                model: TIERS.SONNET, reason: "Routine one-off task — sonnet default" },

  // Phase: integrate
  { phase: "integrate", task_type: "test_runner",  model: TIERS.HAIKU,  reason: "Mechanical integration test runner — zero judgment" },
  { phase: "integrate",                            model: TIERS.SONNET, reason: "Integration wiring is routine coordination work" },

  // Phase: debug
  { phase: "debug", task_type: "fix_apply",           model: TIERS.SONNET, reason: "Applying a known fix is routine code work" },
  { phase: "debug", task_type: "root_cause",          model: TIERS.OPUS,   reason: "Root-cause analysis is high-stakes reasoning" },
  // M85: cycle-2 escalation — when debug cycle-1 (opus) has not resolved the issue,
  // cycle-2 escalates to Fable. The debug DEFAULT (cycle-1/general) remains opus —
  // no existing rule is altered (AC f, no silent degradation). This is a DOCUMENTED
  // MIRROR for Task-based/bin/ callers; the live enforcement is in the debug workflow
  // ternary (D3-T3); the D4 lint guards that ternary.
  // API shape: selectModel({ phase: "debug", task_type: "cycle_2_escalation" }) → fable
  { phase: "debug", task_type: "cycle_2_escalation",  model: TIERS.FABLE,  reason: "Cycle-2 debug escalation — Fable after opus cycle-1 has not resolved; no existing rule altered (AC f)" },
  { phase: "debug",                                   model: TIERS.OPUS,   reason: "Debug default is high-stakes — prefer opus unless the task_type says otherwise" },

  // Phase: partition — high-stakes architectural decomposition
  { phase: "partition",                            model: TIERS.OPUS,   reason: "Domain partitioning is architectural reasoning — high stakes" },

  // Phase: discuss — multi-perspective design exploration
  { phase: "discuss",                              model: TIERS.OPUS,   reason: "Design exploration benefits from top-tier reasoning" },

  // Phase: plan — task-list authoring
  { phase: "plan",                                 model: TIERS.SONNET, reason: "Task decomposition is structured work — sonnet with escalation hook", hasEscalation: true },

  // Phase: verify — final quality judgment before milestone complete
  { phase: "verify",                               model: TIERS.OPUS,   reason: "Milestone verification is the final quality gate — high stakes" },

  // Phase: test-sync — keeping tests aligned with code
  { phase: "test-sync",                            model: TIERS.SONNET, reason: "Test alignment is routine refactoring work" },

  // Phase: doc-ripple — downstream document updates
  { phase: "doc-ripple",                           model: TIERS.SONNET, reason: "Documentation updates are routine prose editing" },

  // Phase: red_team — explicit adversarial QA phase (separate from execute task_type)
  { phase: "red_team",                             model: TIERS.OPUS,   reason: "Adversarial QA — always opus, the incentive is to find bugs" },

  // Phase: qa — explicit standalone QA phase
  { phase: "qa",                                   model: TIERS.SONNET, reason: "QA per M31 refinement — sonnet produces fewer false negatives than haiku" },
]);

// Complexity-signal overrides. If the caller provides `complexity_signals`,
// these can bump a sonnet decision to opus regardless of phase rule.
const COMPLEXITY_OVERRIDES = Object.freeze({
  cross_module_refactor: TIERS.OPUS,
  security_boundary:     TIERS.OPUS,
  data_loss_risk:        TIERS.OPUS,
  contract_design:       TIERS.OPUS,
});

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Select the model tier for a subagent spawn.
 *
 * @param {object} args
 * @param {string} args.phase           — required; one of the phase names above
 * @param {string} [args.task_type]     — optional task_type for finer-grained rules
 * @param {string} [args.domain_type]   — optional, currently unused (reserved for future per-domain rules)
 * @param {object} [args.complexity_signals] — optional object, keys matching COMPLEXITY_OVERRIDES escalate sonnet→opus
 * @returns {{model: string, reason: string, escalation_hook: string|null}}
 */
function selectModel(args) {
  if (!args || typeof args !== "object") {
    return {
      model: DEFAULT_TIER,
      reason: "No args provided — default to routine tier (sonnet)",
      escalation_hook: null,
    };
  }

  const { phase, task_type, complexity_signals } = args;

  if (!phase || typeof phase !== "string") {
    return {
      model: DEFAULT_TIER,
      reason: "No phase provided — default to routine tier (sonnet)",
      escalation_hook: null,
    };
  }

  // First pass: find the most-specific matching rule.
  let matched = null;
  for (const rule of PHASE_RULES) {
    if (rule.phase !== phase) continue;
    if (rule.task_type && rule.task_type !== task_type) continue;
    matched = rule;
    break;
  }

  if (!matched) {
    return {
      model: DEFAULT_TIER,
      reason: `Unknown phase "${phase}" — fallback to routine tier (sonnet)`,
      escalation_hook: null,
    };
  }

  let model = matched.model;
  let reason = matched.reason;

  // Complexity-signal overrides: bump sonnet → opus if any flagged signal is truthy.
  if (model === TIERS.SONNET && complexity_signals && typeof complexity_signals === "object") {
    for (const key of Object.keys(complexity_signals)) {
      if (!complexity_signals[key]) continue;
      const override = COMPLEXITY_OVERRIDES[key];
      if (override && override !== model) {
        model = override;
        reason = `${reason} (escalated to ${override} by complexity signal: ${key})`;
        break;
      }
    }
  }

  // Escalation hook is only injected on sonnet phases flagged as high-stakes-adjacent.
  // Haiku phases have no hook (mechanical, no judgment). Opus phases have no hook
  // (already at top tier — nowhere to escalate).
  let escalation_hook = null;
  if (model === TIERS.SONNET && matched.hasEscalation) {
    escalation_hook = ESCALATION_HOOK;
  }

  return { model, reason, escalation_hook };
}

/**
 * Return the canonical list of phase names the selector knows about.
 * Used by tests and documentation tooling to assert coverage.
 */
function listPhases() {
  const seen = new Set();
  for (const rule of PHASE_RULES) seen.add(rule.phase);
  return [...seen].sort();
}

module.exports = {
  selectModel,
  listPhases,
  TIERS,
  DEFAULT_TIER,
  ESCALATION_HOOK,
  PHASE_RULES,
  COMPLEXITY_OVERRIDES,
};
