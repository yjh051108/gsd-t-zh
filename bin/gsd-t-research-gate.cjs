"use strict";

/**
 * gsd-t-research-gate.cjs — M89 D1 (v1.3.0 — 3-result mechanical filter)
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
 * --- THE DOCTRINE APPLIED TO THE CLASSIFIER (the v1.3.0 premise correction) ---
 *
 * M89's own rule is: never act on belief; if a claim is not grounded in definitive
 * knowledge or research evidence, RESEARCH it. The previous classifier (~745 LOC of
 * hand-fit regexes) violated that rule against itself: it tried to SEMANTICALLY decide
 * "is this an external claim?" via pattern-guessing (external-assertion patterns,
 * homograph lists, camelCase-shape overrides, …). A regex that says "I BELIEVE this
 * pattern means external" is itself a GUESS — the exact sin M89 exists to prevent. The
 * Red Team broke it across 4 verify cycles because paraphrases of the same semantic
 * class keep slipping past hand-fit patterns.
 *
 * So this classifier is now a MECHANICAL STRING-FACT FILTER, NOT a semantic oracle:
 *
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
 * Contract: .gsd-t/contracts/auto-research-contract.md §1/§1.1 v1.3.0 STABLE
 */

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
// Classification — a mechanical string-fact filter (no semantic judgment)
// ---------------------------------------------------------------------------

/**
 * Classify a guessed claim as internal / external / ambiguous by STRING FACTS only.
 *
 * @param {string} gap - The claim text (a GUESSED claim per §6.5).
 * @returns {{ ok:true, gap:string, class:"internal"|"external"|"ambiguous",
 *             route:"grep"|"web"|"judge", reason:string }
 *          |{ ok:false, error:string }}
 */
function classify(gap) {
  // Bad-input guard (SC1): empty/whitespace/non-string → error envelope, never silent.
  if (typeof gap !== "string") {
    return { ok: false, error: "gap must be a string" };
  }
  const trimmed = gap.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "gap must not be empty or whitespace-only" };
  }

  const lower = trimmed.toLowerCase();

  // ── String-fact signals ────────────────────────────────────────────────────
  const matchedPath = INTERNAL_FILE_PATTERNS.find((p) => boundaryMatch(lower, p));
  const matchedAnchor = INTERNAL_ANCHORS.find((p) => boundaryMatch(lower, p));

  // STRONG external string fact: an unambiguous vendor proper-noun AND an API/protocol term.
  // BOTH are required — a bare homograph or a bare URL-looking token cannot make a claim
  // strong-external (the vendor list is multi-char proper nouns only, no homographs).
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
