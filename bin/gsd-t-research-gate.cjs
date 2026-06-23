"use strict";

/**
 * gsd-t-research-gate.cjs — M90 D3 (v1.4.0 — time-anchored override + premise-corrected vendor list)
 *
 * Deterministic internal-vs-external-vs-AMBIGUOUS gap classifier. Given a GUESSED
 * CLAIM (a claim the agent tagged GUESSED in its Stated-Claims list per §6.5),
 * returns the house-style JSON envelope:
 *
 *   { ok:true, gap, class:"internal"|"external"|"ambiguous", route:"grep"|"web"|"judge", reason }
 *
 * On bad input:
 *   { ok:false, error:"<reason>" }
 *
 * --- THE DOCTRINE APPLIED TO THE CLASSIFIER (v1.3.0 premise correction, M90 additions) ---
 *
 * M89's own rule is: never act on belief; if a claim is not grounded in definitive
 * knowledge or research evidence, RESEARCH it. The previous classifier (~745 LOC of
 * hand-fit regexes) violated that rule against itself: it tried to SEMANTICALLY decide
 * "is this an external claim?" via pattern-guessing. So this classifier is a MECHANICAL
 * STRING-FACT FILTER, NOT a semantic oracle.
 *
 * M90 premise correction (D3-T0 baseline, 2026-06-22):
 * The partition asserted the vendor list caused "silent-miss" routing (an absent vendor →
 * silently-internal). Verified FALSE on disk: an absent vendor with no internal signal falls
 * through to `ambiguous→judge` ("never guess-internal"). The vendor list ONLY UPGRADES a
 * vendor+API match to high-confidence `external→web`; its absence never routes internal.
 * M89 already removed ALL "wins-outright→internal" overrides (auto-research-contract v1.3.3).
 * Therefore: the vendor list is KEPT (deleting it would DOWNGRADE Stripe/Chrome/Plaid/Twilio
 * et al. from `external→web` to `ambiguous→judge` — a pure regression). Changed or tightened
 * ONLY if a concrete misroute defect is proven by the T0 baseline; never deleted on the
 * falsified silent-miss premise. (Empirical: 10/10 unseen never-seen vendors → `ambiguous→judge`;
 * 0/10 silently-internal — see D3-T0 known-answer section in the corpus test.)
 *
 * --- M90 D3 ADDITION: R-FACT-3 TIME-ANCHORED PROTOCOL OVERRIDE ---
 *
 * A confidence gate cannot catch a stale-but-confident fact (intrinsic self-knowledge signals
 * collapse to chance on the temporal axis — CoVe, arXiv:2309.11495; Self-RAG, arXiv:2310.11511;
 * temporal-collapse survey, arXiv:2510.19172v1). Therefore:
 *
 *   A claim that is FAST-MOVING (a versioned library, API, protocol spec, or "current/latest
 *   best practice") → route to research REGARDLESS of any confidence signal.
 *
 * This is a deterministic string-fact check: a small set of temporal-signal phrases (e.g.
 * "current best practice", "latest version", "current version", "stable release" — CLOSED
 * PHRASES, not an open semantic category) fires BEFORE the vendor/internal signal tests and
 * short-circuits to `class:"external", route:"web"`. The rationale: these phrases are string
 * facts that the claim is fast-moving; the correct behavior under M89's own doctrine is to
 * always verify, never trust a cached belief about what's "latest" or "current".
 *
 * --- THE THREE RESULT CLASSES ---
 *
 *   - TIME-ANCHORED (checked FIRST, deterministic): a fast-moving-signal phrase → external/web
 *                 always. Bypasses the vendor/internal test (temporal collapse makes confidence
 *                 unreliable).
 *   - `internal`  ONLY on a STRING-FACT internal signal (a concrete repo path/file
 *                 shape, a real gsd-t-* tool name, or an explicit this-repo anchor
 *                 phrase). These are string facts about THIS repo, not beliefs.
 *   - `external`  ONLY on an UNAMBIGUOUS string-fact external signal: a recognized
 *                 vendor/product proper noun (long, multi-char, non-homograph) that
 *                 CO-OCCURS with an API/HTTP/protocol term. Kept SHORT and unambiguous;
 *                 when in doubt a token is left OUT (→ ambiguous, which is safe).
 *   - `ambiguous` EVERYTHING ELSE. If placing a claim requires JUDGMENT rather than a
 *                 string fact, it is NOT regex's call — it goes to the LLM judge, and if
 *                 the LLM is not confident it is RESEARCHED (uncertain→verify). The
 *                 ambiguous→LLM→uncertain→research routing lives in the WIRING (the 4
 *                 workflows), not here — D1 stays a pure calculator.
 *
 * Hard rules:
 *   - Deterministic: identical claim text → byte-identical envelope
 *   - Zero new runtime deps (Node built-ins only), sync APIs
 *   - Never throws on string input (returns {ok:false,error} instead)
 *   - route is derived from class: internal→grep, external→web, ambiguous→judge
 *   - Bad input (empty/whitespace/non-string) → {ok:false,error} + non-zero CLI exit
 *
 * Contract: .gsd-t/contracts/auto-research-contract.md §1/§1.1 v1.3.3 STABLE
 *           .gsd-t/contracts/m90-doctrine-mechanisms-contract.md §1 v1.0.0
 */

// ---------------------------------------------------------------------------
// R-FACT-3 — Time-anchored protocol override (M90 D3 addition)
// ---------------------------------------------------------------------------
//
// A CLOSED set of temporal-signal phrases that indicate a claim is fast-moving
// (a versioned library, API spec, protocol, or "current/latest best practice").
// When matched, the claim bypasses ALL confidence gates and routes to research
// IMMEDIATELY (`class:"external", route:"web"`). These are STRING FACTS that
// the claim is temporal, not semantic judgments. The set is intentionally short
// and conservative — false positives (non-temporal claims matching) are safe
// (they get researched rather than cached); false negatives reach the ambiguous
// path and are judged. Phrases are checked BEFORE vendor/internal signals.
//
// Source: CoVe (arXiv:2309.11495) — intrinsic self-knowledge collapses on the
// temporal axis; a confidence gate cannot catch a stale-but-confident fact.
// Self-RAG (arXiv:2310.11511) — temporal freshness is a distinct retrieval axis.
// Temporal-collapse survey (arXiv:2510.19172v1).
//
// SC-NO-FINITE-LIST compliance: the INTERNAL decision still enumerates no OPEN
// category (internal requires a positive own-repo signal, never the mere absence
// of a temporal phrase). The temporal phrases are a closed set for the EXTERNAL
// decision (routing to web/research), not for the internal decision.

/** Closed set of temporal-signal phrases → always route to research (R-FACT-3).
 *
 * Design constraint: phrases must be SPECIFIC enough to avoid false-positives on
 * internal-convention questions (e.g. bare "best practice" alone would fire on
 * "what is our best practice for naming domains?" — an internal doc question).
 * Each phrase here is qualified by a temporal/freshness adjective ("current",
 * "latest", "recommended", "stable", "deprecated") that makes the fast-moving
 * nature explicit. Bare "best practice" or "version" alone are NOT in this list.
 */
const TEMPORAL_SIGNAL_PHRASES = [
  // "current/latest" best-practice or standard (qualified with temporal adjective)
  "current best practice", "current best-practice",
  "latest best practice", "latest best-practice",
  // "current" / "latest" version signals
  "current version", "latest version", "latest stable",
  "current release", "latest release", "stable release",
  "newest version", "most recent version",
  // upgrade / deprecation / migration signals (fast-moving)
  "upgrade to", "migrate to", "migration guide",
  "deprecated in", "is deprecated", "was deprecated",
  // "recommended" signals (recommendations change — qualified to avoid false positives)
  "recommended approach", "recommended way", "recommended practice",
  "recommended version", "currently recommended",
];

// ---------------------------------------------------------------------------
// Word-boundary token match (kills the substring-match anti-pattern)
// ---------------------------------------------------------------------------
//
// `text.includes(token)` matches INSIDE words ("our" hits "four", "rest" hits "the
// rest of"). The correct test is a WORD-BOUNDARY match. A token may contain spaces,
// dots, slashes and hyphens (e.g. "rest api", "node.js", "/v1/"); we anchor on \b only
// where the token edge is a word char and fall back to a plain substring test for edges
// that are non-word (a \b before "/" is meaningless).

/** Escape a string for use as a literal inside a RegExp. */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Word-boundary-aware token match against an already-lowercased haystack.
 * @param {string} lowerText - the lowercased claim text
 * @param {string} token - a lowercased token (may contain spaces/dots/slashes/hyphens)
 * @returns {boolean}
 */
function boundaryMatch(lowerText, token) {
  const t = token.trim();
  if (t.length === 0) return false;
  const left = /\w/.test(t[0]) ? "\\b" : "";
  const right = /\w/.test(t[t.length - 1]) ? "\\b" : "";
  return new RegExp(left + escapeRegExp(t) + right).test(lowerText);
}

// ---------------------------------------------------------------------------
// INTERNAL string-facts (this-repo anchors + repo path/file/tool shapes)
// ---------------------------------------------------------------------------
//
// These are STRING FACTS about this repo, not semantic guesses. An explicit repo
// anchor phrase, or a concrete repo-relative path / file-naming shape / real gsd-t-*
// tool name, is a verifiable string-level signal that the claim is about THIS repo's
// own code. Anything subtler (a bare camelCase symbol that COULD be external, a
// question phrasing) is NOT a string fact → it falls through to ambiguous.

/**
 * This-repo anchor phrases. An anchor signals internal ONLY when NO strong external signal
 * (a real vendor proper-noun + API term) co-occurs (see the final decision rule in
 * `classify()`). An anchor NEVER overrides a strong external signal — a generic English
 * phrase like "exit code" / "who owns" / "this file" can appear in a sentence whose real
 * subject is an external vendor ("what exit code does the Stripe API return?"), so it is not
 * a string fact that the claim is internal. (There is no "decisive" vs "broad" split: since
 * NO anchor overrides a strong external signal, the distinction is behaviorally dead — one
 * flat list. Interrogative words are deliberately ABSENT — neutral, the natural way to phrase
 * an external research question.)
 */
const INTERNAL_ANCHORS = [
  "this repo", "this repo's", "repo's",
  "our repo", "the repo",
  "this codebase", "our codebase",
  "in this project", "our project",
  "this module", "our module",
  "this file", "our file",
  "the existing", "our existing",
  "in the codebase",
  "our", "our internal",
  // ownership / file-system phrasings about this repo's structure
  "which domain owns", "which file owns", "who owns",
  // exit code / return value of a module
  "exit code",
];

/**
 * Internal file / path / tool-name SHAPE patterns. STRUCTURAL string facts (file
 * extensions, repo-relative path separators, GSD-T's naming convention) — NOT an
 * enumerated list of specific held-out symbols (a guard test forbids re-hardcoding
 * those). A claim referencing one of these references this repo's own files.
 */
const INTERNAL_FILE_PATTERNS = [
  // GSD-T module / file naming conventions (shape, not a specific filename)
  "gsd-t-", ".workflow.js", ".test.js", "gsd-t.js",
  // contract / domain / scope file shapes
  "-contract.md", "scope.md", "tasks.md", "constraints.md",
  "progress.md", "architecture.md", "workflows.md",
  // repo-relative path separators
  "bin/", "test/", "templates/", "commands/", ".gsd-t/",
];

// ---------------------------------------------------------------------------
// EXTERNAL string-facts (unambiguous vendor proper-noun + API/protocol term)
// ---------------------------------------------------------------------------
//
// SHORT and unambiguous by design (the directive). Only LONG, multi-char, NON-homograph
// vendor/product proper nouns — never single-word English homographs ("go"/"square"/
// "edge"/"rest"/"swift"/"amazon"…), which are left OUT so a benign internal sentence is
// never misrouted external. `external` fires ONLY when such a proper noun CO-OCCURS with
// an API/HTTP/protocol term: that conjunction is an unambiguous string fact that the
// claim is about an external system's contract. A proper noun ALONE, or a term alone, is
// NOT enough — it falls through to ambiguous (the LLM's call), which is safe.

/** Unambiguous third-party vendor / product proper nouns (string facts, no homographs). */
const EXTERNAL_VENDOR_NOUNS = [
  // payment processors
  "paypal", "stripe", "braintree", "adyen", "klarna", "plaid",
  // cloud platforms / CDN / infra
  "azure", "google cloud", "gcp", "cloudflare", "cloudfront",
  "fastly", "akamai", "vercel", "netlify",
  // auth providers
  "auth0", "okta", "cognito",
  // databases / data
  "mongodb", "postgresql", "elasticsearch", "dynamodb",
  "firestore", "bigquery", "snowflake",
  // messaging / 3rd-party services
  "rabbitmq", "twilio", "sendgrid", "salesforce", "hubspot", "intercom",
  // browsers (multi-char, non-homograph)
  "chrome", "chromium", "firefox", "safari", "webkit",
  // UI frameworks (multi-char names)
  "react", "angular", "svelte",
];

/** API / HTTP / protocol / auth-flow terms (the co-signal that makes a vendor external). */
const EXTERNAL_API_TERMS = [
  "api", "endpoint", "webhook", "oauth", "openid", "saml", "jwt",
  "rest api", "graphql", "grpc", "openapi", "swagger",
  "rate limit", "rate-limit",
  "access token", "refresh token", "bearer token",
  "authorization header", "redirect uri", "redirect url", "callback url",
  "/v1/", "/v2/", "/v3/",
  "http", "https", "header", "request body", "response body",
];

// ---------------------------------------------------------------------------
// §7 fail-closed cite gate marker format (R-FACT-4, preserved from M89)
// ---------------------------------------------------------------------------
//
// When an external claim is classified, the wiring writes a machine-readable marker
// into the artifact at classify time:
//   <!-- auto-research-claim: class=external key=<claim-key> status=uncited -->
// The verify gate (gsd-t-verify.workflow.js §7) FAILs if this marker is still
// status=uncited after the research stage. The marker is flipped to status=cited
// when the Verified-Facts block lands. This module's role: produce the `class`,
// `route`, and `reason` fields that trigger marker creation in the wiring. The
// marker write is the WIRING's responsibility; this classifier is a pure calculator.
// R-FACT-4: this marker mechanism is PRESERVED unchanged from the M89 baseline.

// ---------------------------------------------------------------------------
// Classification — a mechanical string-fact filter (no semantic judgment)
// ---------------------------------------------------------------------------

/**
 * Classify a guessed claim as internal / external / ambiguous by STRING FACTS only.
 *
 * Decision order (deterministic, checked in sequence):
 *   1. Bad-input guard (SC1): empty/whitespace/non-string → {ok:false}, never silent.
 *   2. TIME-ANCHORED OVERRIDE (R-FACT-3): a fast-moving signal phrase (current/latest
 *      best practice, version signals, deprecation, upgrade) → external/web ALWAYS,
 *      bypassing all other tests. Temporal-collapse makes confidence unreliable on this
 *      class of claim; the safe rule is always-research.
 *   3. STRONG EXTERNAL: an unambiguous vendor proper-noun AND an API/protocol term.
 *      + any path/anchor → ambiguous; else → external/web.
 *   4. INTERNAL: concrete repo path/file shape or this-repo anchor, with ZERO strong
 *      external signal → internal/grep.
 *   5. AMBIGUOUS: everything else → judge.
 *
 * @param {string} gap - The claim text (a GUESSED claim per §6.5).
 * @returns {{ ok:true, gap:string, class:"internal"|"external"|"ambiguous",
 *             route:"grep"|"web"|"judge", reason:string }
 *          |{ ok:false, error:string }}
 */
function classify(gap) {
  // ── 1. Bad-input guard (SC1) ───────────────────────────────────────────────
  // empty/whitespace/non-string → error envelope, never silent.
  if (typeof gap !== "string") {
    return { ok: false, error: "gap must be a string" };
  }
  const trimmed = gap.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "gap must not be empty or whitespace-only" };
  }

  const lower = trimmed.toLowerCase();

  // ── 2. TIME-ANCHORED OVERRIDE (R-FACT-3) ─────────────────────────────────
  //
  // A fast-moving claim (best-practice, version, deprecation, recommended approach)
  // ALWAYS routes to research regardless of any confidence signal. Temporal-collapse
  // (CoVe/Self-RAG) makes a cached "latest" or "best practice" belief unreliable —
  // the correct behavior is always-verify. This is checked BEFORE vendor/internal
  // signals so that e.g. "the current best practice for React hooks api" routes to
  // web even though it also has a vendor (react) + an api term.
  //
  // SC-NO-FINITE-LIST: this is a CLOSED set for the external/temporal decision. The
  // INTERNAL decision still requires a positive own-repo signal (a path or anchor) —
  // the mere ABSENCE of a temporal phrase never routes internal. A claim with a
  // temporal phrase and also an internal path (e.g. "upgrade our gsd-t-phase.workflow.js
  // to the current best practice") still routes temporal→web (the time-anchored check
  // fires first and the recommendation itself is external regardless of which file
  // will be changed).
  const matchedTemporal = TEMPORAL_SIGNAL_PHRASES.find((p) => boundaryMatch(lower, p));
  if (matchedTemporal) {
    return {
      ok: true, gap: trimmed, class: "external", route: "web",
      reason: `Time-anchored override (R-FACT-3): temporal-signal phrase "${matchedTemporal}" indicates a fast-moving claim (best practice / version / deprecation). Temporal-collapse makes confidence unreliable on this class — always route to research regardless of any other signal (CoVe: arXiv:2309.11495).`,
    };
  }

  // ── 3. String-fact signals ────────────────────────────────────────────────
  const matchedPath = INTERNAL_FILE_PATTERNS.find((p) => boundaryMatch(lower, p));
  const matchedAnchor = INTERNAL_ANCHORS.find((p) => boundaryMatch(lower, p));

  // STRONG external string fact: an unambiguous vendor proper-noun AND an API/protocol term.
  // BOTH are required — a bare homograph or a bare URL-looking token cannot make a claim
  // strong-external (the vendor list is multi-char proper nouns only, no homographs).
  //
  // PREMISE-CORRECTED ROLE OF THE VENDOR LIST (M90-D3-T0 baseline):
  // The partition asserted the list caused silent-miss routing. Verified FALSE: an absent
  // vendor with no internal signal falls through to ambiguous→judge (never internal). The
  // list's ACTUAL role: UPGRADE a vendor+API match to high-confidence `external→web`,
  // SKIPPING the judge for known vendors. Deleting it would downgrade Stripe/Chrome/Plaid/
  // Twilio et al. to `ambiguous→judge` — a regression, not a fix. KEPT unchanged.
  const matchedVendor = EXTERNAL_VENDOR_NOUNS.find((v) => boundaryMatch(lower, v));
  const matchedApiTerm = EXTERNAL_API_TERMS.find((t) => boundaryMatch(lower, t));
  const hasStrongExternal = !!matchedVendor && !!matchedApiTerm;

  // ── FINAL DECISION RULE (the structural resolution of the 7-cycle silent-miss class) ──
  //
  // `internal` is returned ONLY when there is ZERO strong-external signal. The mechanical
  // classifier NEVER overrides an external signal with anything — not a path, not "this
  // repo", not anything. There is no string-fact that is exclusively internal (a single
  // claim can carry BOTH a real repo path AND a real external-API subject at once — e.g.
  // "wire the Stripe OAuth refresh into gsd-t-execute.workflow.js"), so every "wins
  // outright → internal" override re-opens the silent miss. Removing ALL override rules
  // closes the class by construction. The cost is more ambiguous→judge calls — the safe
  // direction (the judge researches when unsure; it never silently guesses internal).
  //
  //   hasStrongExternal + (any path/anchor) → ambiguous
  //   hasStrongExternal + nothing else      → external
  //   NO strong external + (path OR anchor) → internal
  //   else                                  → ambiguous

  if (hasStrongExternal) {
    if (matchedPath || matchedAnchor) {
      const co = matchedPath ? `repo path "${matchedPath}"` : `anchor "${matchedAnchor}"`;
      return {
        ok: true, gap: trimmed, class: "ambiguous", route: "judge",
        reason: `Ambiguous: a strong external signal (vendor "${matchedVendor}" + API term "${matchedApiTerm}") co-occurs with an internal ${co} — the mechanical classifier NEVER overrides an external signal (a claim can be about BOTH at once); the LLM judge decides (uncertain → research)`,
      };
    }
    return {
      ok: true, gap: trimmed, class: "external", route: "web",
      reason: `External string-fact: vendor proper noun "${matchedVendor}" + API/protocol term "${matchedApiTerm}" (no internal path/anchor) — concerns an external system's contract`,
    };
  }

  // No strong external signal at all → a concrete repo path or this-repo anchor is decisive
  // internal (there is nothing external to override).
  if (matchedPath) {
    return {
      ok: true, gap: trimmed, class: "internal", route: "grep",
      reason: `Internal string-fact: repo path/file/tool shape "${matchedPath}" and NO strong external signal — concerns this repo's own files`,
    };
  }
  if (matchedAnchor) {
    return {
      ok: true, gap: trimmed, class: "internal", route: "grep",
      reason: `Internal string-fact: this-repo anchor "${matchedAnchor}" and NO strong external signal — concerns this repo's own code/structure`,
    };
  }

  // EVERYTHING ELSE is AMBIGUOUS — no string fact at all (semantic placement is the LLM's
  // call, not regex's). The wiring routes ambiguous → LLM judge; if the LLM is not
  // confident, the claim is RESEARCHED (uncertain → verify, never guess).
  return {
    ok: true, gap: trimmed, class: "ambiguous", route: "judge",
    reason: "Ambiguous — no strong external signal, no concrete repo path, no this-repo anchor. Semantic placement requires judgment, so the LLM judge decides; if not confident, the claim is researched (uncertain → verify, never guess-internal)",
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (require.main === module) {
  // Usage: gsd-t-research-gate classify "<gap>" [--json]
  const args = process.argv.slice(2);
  const filteredArgs = args.filter((a) => a !== "--json");

  function emit(obj) {
    process.stdout.write(JSON.stringify(obj) + "\n");
  }
  function emitError(msg, exitCode) {
    emit({ ok: false, error: msg });
    process.exit(exitCode);
  }

  if (filteredArgs[0] !== "classify") {
    emitError(
      `Unknown subcommand "${filteredArgs[0] || ""}". Usage: gsd-t-research-gate classify "<gap>" [--json]`,
      64
    );
  }

  const gap = filteredArgs[1];
  if (gap === undefined || gap === null) {
    emitError("Missing <gap> argument. Usage: gsd-t-research-gate classify \"<gap>\" [--json]", 64);
  }

  const result = classify(gap);
  emit(result);
  if (!result.ok) process.exit(1);
  // Success → exit 0
}

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

module.exports = { classify };
