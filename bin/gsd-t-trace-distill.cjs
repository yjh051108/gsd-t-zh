#!/usr/bin/env node
'use strict';

/**
 * GSD-T Trace-Half Category Distiller (M100 D2).
 *
 * Distills the concrete trace CATEGORY set from a project's own PLAN —
 * NEVER confabulates a category absent from the plan (feedback_no_confabulated_examples).
 * Emits categories as DATA, never baked into the envelope gate (d3 stays
 * value-blind — the gate checks presence+type of `category`, never a value).
 *
 * Contract: .gsd-t/contracts/logging-schema-distillation-contract.md v1.0.0
 * Consumed contract: .gsd-t/contracts/trace-logging-contract.md
 *
 * Shares NO file with the audit-half distiller (bin/gsd-t-audit-distill.cjs,
 * owned by d4) — mechanizes no-collapse by construction.
 *
 * Exports:
 *   distillTraceCategories(planPath) -> { categories: [{ category, source }] }
 */

const fs = require('fs');

// ── Integration-point signatures ────────────────────────────────────────────
//
// A trace-worthy operation is a concrete REST/JSON/external-call integration
// point named in the project's plan (per logging-schema-distillation-contract
// §UMI pilot grounding: Grain / Airtable / Anthropic / Apify for UMI).
//
// This is a STRUCTURAL extraction, not a closed list: a hardcoded allowlist
// would silently yield ZERO categories for a plan naming services outside the
// list (e.g. Plaid/Shopify/QuickBooks), violating the project doctrine against
// hardcoding a finite list for an open category. So the primary path greps
// the plan text for integration-point CUES — REST/API/webhook/fetch/axios/
// HTTP-client mentions, `*.com`-shaped service hostnames, and
// `process.env.*_API_KEY`-shaped env vars — and grounds the emitted category
// in the nearest proper-noun token on the matched line (mirroring the audit
// distiller's grounded-extraction approach: never invent, always cite a
// source line). KNOWN_INTEGRATION_SIGNATURES is kept only as a recognizer
// HINT (checked first, since a known name is unambiguous) — never as the
// sole gate for what counts as trace-worthy.

const KNOWN_INTEGRATION_SIGNATURES = [
  'Grain',
  'Airtable',
  'Anthropic',
  'Apify',
  'Slack',
  'Stripe',
  'Twilio',
  'SendGrid',
  'Softr',
];

// Structural cues marking a plan line as naming a concrete external
// integration point — never a business-domain word list, purely syntactic.
// Each cue is captured so the service token can be extracted RELATIVE to the
// cue's own position, not just "first capitalized word on the line" (which
// over-matches sentence-leading words like "We"/"Our"/"The").
const INTEGRATION_CUE_RE =
  /\b(?:REST|API|webhook|fetch|axios|HTTP client|Messages API|Files API)\b|[A-Za-z0-9-]+\.com\b|process\.env\.[A-Z0-9_]*_API_KEY\b/;

const STOPWORDS = new Set([
  'API', 'REST', 'HTTP', 'HTTPS', 'JSON', 'URL', 'ID', 'MCP', 'CLI', 'SOP',
  'We', 'Our', 'The', 'This', 'That', 'A', 'An', 'It', 'They',
]);

/**
 * Best-effort proper-noun token identifying the service named on a line that
 * already matched INTEGRATION_CUE_RE — purely structural: looks at the
 * capitalized word immediately BEFORE the cue match first (e.g. "Plaid API",
 * "Shopify webhook"), falling back to immediately after (e.g. "REST client
 * syncs QuickBooks"), then to the nearest non-stopword capitalized token
 * anywhere on the line. Never a sentence-leading word like "We"/"The".
 */
function _extractServiceToken(line, cueMatch) {
  const before = line.slice(0, cueMatch.index);
  const after = line.slice(cueMatch.index + cueMatch[0].length);

  const beforeTokens = before.match(/\b[A-Z][a-zA-Z0-9]*\b/g) || [];
  for (let i = beforeTokens.length - 1; i >= 0; i--) {
    if (!STOPWORDS.has(beforeTokens[i])) return beforeTokens[i];
  }

  const afterTokens = after.match(/\b[A-Z][a-zA-Z0-9]*\b/g) || [];
  for (const t of afterTokens) {
    if (!STOPWORDS.has(t)) return t;
  }

  const allTokens = line.match(/\b[A-Z][a-zA-Z0-9]*\b/g) || [];
  for (const t of allTokens) {
    if (!STOPWORDS.has(t)) return t;
  }
  return null;
}

/**
 * Finds the first line in `lines` containing `needle` as a whole-word match,
 * returning { lineNumber, text } or null if absent. Whole-word match avoids
 * a substring false-positive (e.g. "Grainger" would not match "Grain").
 */
function findFirstMatchingLine(lines, needle) {
  const re = new RegExp('\\b' + needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) {
      return { lineNumber: i + 1, text: lines[i].trim() };
    }
  }
  return null;
}

/**
 * Distills the concrete trace CATEGORY set from a project plan file.
 *
 * @param {string} planPath - absolute or relative path to the project's plan
 *   (e.g. docs/plan.md).
 * @returns {{ categories: Array<{ category: string, source: string }> }}
 *   `categories` is empty (never an error, never a confabulated placeholder)
 *   when the plan has no trace-worthy operations. Each entry's `source` is
 *   the grep-traceable plan line the category was distilled from.
 */
function distillTraceCategories(planPath) {
  if (!planPath || typeof planPath !== 'string') {
    throw new Error('distillTraceCategories: planPath is required');
  }
  if (!fs.existsSync(planPath)) {
    throw new Error(`distillTraceCategories: plan not found at ${planPath}`);
  }

  const text = fs.readFileSync(planPath, 'utf8');
  const lines = text.split(/\r?\n/);

  const categories = [];
  const seen = new Set();

  // Pass 1 — known-service recognizer hint (unambiguous, checked first).
  for (const signature of KNOWN_INTEGRATION_SIGNATURES) {
    const match = findFirstMatchingLine(lines, signature);
    if (match) {
      categories.push({
        category: signature,
        source: `${planPath}:${match.lineNumber}: ${match.text}`,
      });
      seen.add(signature);
    }
  }

  // Pass 2 — structural extraction over lines carrying an integration cue,
  // for any named service NOT already covered by the known-list hint.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cueMatch = INTEGRATION_CUE_RE.exec(line);
    if (!cueMatch) continue;
    const token = _extractServiceToken(line, cueMatch);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    categories.push({
      category: token,
      source: `${planPath}:${i + 1}: ${line.trim()}`,
    });
  }

  return { categories };
}

module.exports = {
  distillTraceCategories,
  KNOWN_INTEGRATION_SIGNATURES,
};

// ── CLI ──────────────────────────────────────────────────────────────────

function _parseArgv(argv) {
  const out = { planPath: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--plan') out.planPath = argv[++i] || null;
  }
  return out;
}

if (require.main === module) {
  const args = _parseArgv(process.argv.slice(2));
  if (!args.planPath) {
    process.stderr.write('usage: gsd-t-trace-distill.cjs --plan <path-to-plan.md>\n');
    process.exit(2);
  }
  try {
    const result = distillTraceCategories(args.planPath);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(0);
  } catch (err) {
    process.stderr.write(JSON.stringify({ error: String((err && err.message) || err) }, null, 2) + '\n');
    process.exit(1);
  }
}
