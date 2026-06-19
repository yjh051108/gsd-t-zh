"use strict";

/**
 * gsd-t-research-gate.cjs — M89 D1
 *
 * Deterministic internal-vs-external gap classifier. Given a GUESSED CLAIM
 * (a claim the agent tagged GUESSED in its Stated-Claims list per §6.5),
 * returns the house-style JSON envelope:
 *
 *   { ok:true, gap, class:"internal"|"external", route:"grep"|"web", reason }
 *
 * On bad input:
 *   { ok:false, error:"<reason>" }
 *
 * Classification is by FEATURE CLASS — detecting external-vs-internal signals
 * in the claim text — NOT by hard-matching keywords scraped from the labeled
 * corpus. A keyword-memorized router would pass the seen 13/13 yet generalize
 * to nothing (the shallow-test trap). The discriminator:
 *
 *   External signal (any present → lean external):
 *     - A recognized third-party / library / platform / spec PROPER NOUN
 *       (vendor name, SDK, browser name, spec body, etc.)
 *     - An API / endpoint / HTTP / OAuth / webhook / spec / version / limit /
 *       rate-limit / error-shape / auth-flow TERM
 *     - A browser / runtime BEHAVIOR reference
 *     - A claim that ASSERTS an external system's behavior / return-shape /
 *       limit / value WITHOUT a cited source, even with NO proper noun
 *       (the proper-noun-less external guard: "the payments endpoint accepts a
 *       max batch size of 100" routes external, NOT default-internal for lacking
 *       a vendor name — this is the cycle-2 finding #3 fix)
 *
 *   Internal signal (any present, no overriding external signal → lean internal):
 *     - A repo-relative PATH or file name
 *     - A known local SYMBOL / function / module name (even bare, no path/anchor)
 *     - An explicit "this repo / our / the existing" ANCHOR
 *     - This repo's own code / contracts / schema / file-ownership / sandbox
 *       rules / test architecture
 *
 *   Ambiguous → internal-first (default class:internal, route:grep). The
 *   escalation to external on empty grep is the WIRING domains' job (D3/D4).
 *
 * Hard rules:
 *   - Deterministic: identical claim text → byte-identical envelope
 *   - Zero new runtime deps (Node built-ins only), sync APIs
 *   - Never throws on string input (returns {ok:false,error} instead)
 *   - `internal` + `web` is structurally impossible (route derived from class)
 *   - Bad input (empty/whitespace/non-string) → {ok:false,error} + non-zero CLI exit
 *
 * Contract: .gsd-t/contracts/auto-research-contract.md §1 v1.2.0 STABLE
 */

// ---------------------------------------------------------------------------
// Boundary-match helper (cycle-2 fix — kills the substring-match anti-pattern)
// ---------------------------------------------------------------------------
//
// `text.includes(token)` matches INSIDE words: "our" hits "four"/"your", "internal"
// hits "internal server error" of an EXTERNAL system, "go"/"rest"/"css" hit
// "cargo"/"the rest of"/"cookie". The earlier space-padding hack ("our ", "rest ")
// was a half-fix that still misses sentence-initial / punctuation-adjacent cases and
// is itself fragile. The correct test is a WORD-BOUNDARY match.
//
// A token here can contain spaces, dots, slashes and hyphens (e.g. "google cloud",
// "node.js", "rate-limit", "/v1/"). We anchor on \b only where the token edge is a
// word char; tokens whose edges are non-word (like "/v1/", ".workflow.js") fall back
// to a plain substring test (a \b before "/" is meaningless). This keeps multi-word
// vendor names and path-shaped tokens working while killing the in-word false hits.

/** Escape a string for use as a literal inside a RegExp. */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Word-boundary-aware token match against an already-lowercased haystack.
 * Adds \b only at edges that are word characters, so multi-word / path / dotted
 * tokens still match correctly while bare-word tokens cannot match inside a word.
 *
 * @param {string} lowerText - the lowercased claim text
 * @param {string} token - a lowercased token (may contain spaces/dots/slashes/hyphens)
 * @returns {boolean}
 */
function boundaryMatch(lowerText, token) {
  const t = token.trim();
  if (t.length === 0) return false;
  const leftWord = /\w/.test(t[0]);
  const rightWord = /\w/.test(t[t.length - 1]);
  const left = leftWord ? "\\b" : "";
  const right = rightWord ? "\\b" : "";
  return new RegExp(left + escapeRegExp(t) + right).test(lowerText);
}

// ---------------------------------------------------------------------------
// External-signal patterns (feature-class based, NOT corpus-keyword lists)
// ---------------------------------------------------------------------------

/**
 * Well-known third-party proper nouns (vendor / product / library / platform /
 * spec body names). This list enables PROPER-NOUN DETECTION as one external
 * signal — but is NOT the only path to `external` (see EXTERNAL_ASSERTION_PATTERNS
 * below for the proper-noun-less external guard).
 *
 * Kept as a list of lowercase patterns to avoid hard-coding corpus keywords.
 * New vendors can be added without changing the classification logic.
 *
 * Cycle-2 finding #3 (code-review): ALL tokens are matched on WORD BOUNDARIES
 * (boundaryMatch), so the short ambiguous tokens "css"/"soap"/"rest" can NO LONGER hit
 * inside "cargo"/"the rest of"/"cookie". The old space-padding hack is removed.
 *
 * Cycle-3 finding #3 (code-review): single-word English HOMOGRAPHS that are also vendor /
 * language names ("square"/"go"/"rust"/"swift"/"java"/"edge"/"ie"/"amazon") were MOVED to
 * WEAK_EXTERNAL_PROPER_NOUNS — even with \b they misroute benign internal claims ("we
 * square the input", "bails at the edge case"). They now count external only when a strong
 * external signal co-occurs (or in possessive form). This list keeps ONLY the unambiguous
 * multi-char proper nouns.
 */
const EXTERNAL_PROPER_NOUNS = [
  // Payment processors
  "paypal", "stripe", "braintree", "adyen", "klarna", "plaid",
  // Cloud platforms
  "aws", "azure", "google cloud", "gcp", "cloudflare",
  // Auth providers / standards
  "oauth", "openid", "auth0", "okta", "cognito", "saml", "jwt", "jwks",
  // Databases / data
  "mongodb", "postgres", "postgresql", "mysql", "redis", "elasticsearch",
  "dynamodb", "firestore", "bigquery", "snowflake",
  // Messaging / queues
  "kafka", "rabbitmq", "sqs", "pubsub", "twilio", "sendgrid",
  // CDN / infra
  "cloudfront", "fastly", "akamai", "nginx", "vercel", "netlify",
  // Languages / runtimes (version-sensitive external behavior)
  "node.js", "python", "ruby",
  // Browsers and browser APIs
  "chrome", "chromium", "firefox", "safari", "webkit",
  "internet explorer",
  // UI frameworks (external behavior / version facts)
  "react", "vue", "angular", "svelte", "next.js", "nuxt", "remix",
  // CSS / web standards
  "css", "html5", "ecmascript", "w3c", "whatwg", "tc39",
  // HTTP / API standards. Cycle-2 finding #3: "rest" and "soap" are ambiguous English
  // words ("the rest of the pipeline", "soap"); use the unambiguous protocol forms so
  // \b cannot fire on the common-English sense.
  "openapi", "swagger", "graphql", "restful", "rest api", "grpc", "soap api",
  // Spec bodies
  "ietf", "rfc", "iso", "ansi",
  // SaaS / third-party services
  "github", "gitlab", "bitbucket", "jira", "slack", "zendesk",
  "salesforce", "hubspot", "intercom",
];

/**
 * WEAK external proper nouns (cycle-3 finding #3, code-review important + nit).
 *
 * Single-word English HOMOGRAPHS that are also vendor / product / language names:
 * "square" (the verb / the shape vs the payments co), "go"/"rust"/"swift"/"java"
 * (verbs / a material / an adjective / an island vs the languages), "edge"/"ie"
 * (the noun / "i.e." vs the browsers), "amazon" (the river vs the cloud). On their
 * own these misroute benign INTERNAL claims external ("we square the input value",
 * "bails at the edge case"). Gated behind a CO-OCCURRENCE requirement (like
 * WEAK_EXTERNAL_API_TERMS): they count as an external signal ONLY when ANOTHER
 * external signal co-occurs (a strong proper noun, a strong API term, a browser
 * term, or the external-assertion pattern). So:
 *   "we square the input value before hashing"     → internal (no other signal)
 *   "the function bails at the edge case"           → internal
 *   "Square's payments API"                         → external ("payments api"... )
 *   "deploy to the edge with Cloudflare Workers"    → external (cloudflare co-occurs)
 */
const WEAK_EXTERNAL_PROPER_NOUNS = [
  "square", "go", "rust", "swift", "java", "edge", "ie", "amazon",
];

/**
 * API / endpoint / protocol / version / limit terms that signal external context
 * when they appear WITHOUT an internal-repo anchor.
 *
 * These are feature-CLASS signals, not corpus keywords. "endpoint" is not the
 * same as a specific endpoint path in this repo — the distinction is resolved
 * by also checking internal signals (repo paths, local symbols).
 */
// Cycle-2: all tokens are WORD-BOUNDARY matched (boundaryMatch) — space-padding hacks
// removed ("bearer ", " spec ", "standard " → bare). Finding #4 (LOW): the weakest
// generic single-word offenders that fired with NO other external signal ("endpoint",
// "quota", "scopes", "standard", "specification") are demoted to WEAK_API_TERMS — they
// only count as external when CO-OCCURRING with another external signal (a vendor proper
// noun, a strong API/HTTP/version token, a browser term, or the external-assertion
// pattern). Fail-toward-verify is preserved for genuinely-external claims; bare benign
// uses of those words no longer waste a Fable web call.
const EXTERNAL_API_TERMS = [
  // HTTP / API structural terms (without "this repo / our" anchor)
  "/v1/", "/v2/", "/v3/", // version-prefixed paths typical of third-party APIs
  "api key", "api secret", "api token",
  "webhook", "callback url", "redirect uri", "redirect url",
  "access token", "refresh token", "bearer token",
  "authorization header", "authorization code",
  "rate limit", "rate-limit", "quota limit",
  "response shape", "return shape", "error shape", "error code",
  "status code",
  // Auth flows
  "oauth flow", "auth flow", "token mint", "token endpoint",
  "client credentials", "client secret", "client id",
  "grant type", "grant_type",
  // Version / spec
  "current version", "latest version", "minimum version",
  "browser support", "browser compatibility",
  // Limits / capacities (external system limits)
  "maximum amount", "maximum total", "max total", "max amount",
  "maximum batch", "max batch", "batch size", "batch limit",
  "per-request limit", "payload limit",
  // Endpoints (specific shapes — resolved external if no internal anchor)
  "base url", "base path",
  // Invoice-related (specific PayPal API surface — external system)
  "invoice total", "line item", "invoice api",
];

/**
 * WEAK external API terms (finding #4 LOW): generic single words that over-generalize
 * to web on their own. They count as an external signal ONLY when ANOTHER external
 * signal co-occurs (proper noun / strong API term / browser term / assertion pattern).
 */
const WEAK_EXTERNAL_API_TERMS = [
  "endpoint", "quota", "scopes", "standard", "specification",
];

/**
 * Browser / runtime BEHAVIOR terms — unambiguously external (the runtime is
 * not in this repo).
 */
const EXTERNAL_BROWSER_RUNTIME_TERMS = [
  "popup blocker", "pop-up blocker", "popup block",
  "same-origin policy", "cross-origin", "cors",
  "content security policy", "csp",
  "service worker", "web worker",
  "local storage", "session storage", "indexeddb",
  "storage quota", "storage limit", "storage.local",
  "window.open", "location.href", "history.pushstate",
  "geolocation api", "notification api", "clipboard api",
  "requestanimationframe",
  "user agent", "user-agent",
  "browser event", "browser behavior", "browser block",
  "runtime behavior", "v8", "node runtime",
];

// ---------------------------------------------------------------------------
// Internal-signal patterns (repo-relative anchors)
// ---------------------------------------------------------------------------

/**
 * Explicit "this repo" / "our" ANCHOR phrases. Presence of any of these
 * strongly signals internal — the question is about code IN this repository.
 *
 * Finding #4 (cycle-1 MEDIUM): bare "our <noun>" / "internal" / "this repo's" anchors
 * are internal signals too; when an internal anchor is present, an external
 * API/limit/rate-limit term does NOT force external — the internal signal wins
 * (internal-first per §1.1). E.g. "the rate limit OUR INTERNAL API gateway
 * enforces per tenant" is about THIS repo's own gateway → internal.
 *
 * Cycle-2 finding #2 (HIGH): these are WORD-BOUNDARY matched (boundaryMatch), so the
 * bare anchors "our"/"internal" can NO LONGER hit inside "four"/"your" or describe an
 * EXTERNAL system's "internal server error". The space-padding hacks ("our ", " internal",
 * "the existing ") are removed — bare tokens + \b is the correct fix. "our internal API
 * gateway" still anchors internal; "Stripe ... four hundred per second" / "your account
 * quota on AWS" / "PayPal sends an internal server error" no longer do.
 */
const INTERNAL_ANCHOR_PHRASES = [
  "this repo", "our repo", "the repo",
  "this codebase", "our codebase",
  "in this project", "our project",
  "this module", "our module",
  "this file", "our file",
  "the existing", "our existing",
  "in the codebase",
  // Bare internal anchors (cycle-1 finding #4): "our <noun>" / "this repo's".
  // Cycle-2 finding #2: bare "internal" is NOT a standalone anchor — "PayPal sends an
  // internal server error" describes an EXTERNAL system's internal. The possessive
  // "our" (or "our internal", "this repo's") is the real this-repo anchor; "our internal
  // API gateway" still triggers on "our".
  "our", "our internal",
  "this repo's", "repo's",
  // Ownership / file-system signals — these PHRASES ("which X owns") are genuinely
  // about this repo's file/module structure, so they stay.
  "which domain owns", "which file owns", "who owns",
  // Exit code / return value of THIS module
  "return when", "returns when", "return on", "returns on",
  "exit code",
];

// NOTE (cycle-3 finding #1, Red Team HIGH): interrogative phrasings — "how does",
// "what does", "what is", "which", "when", "where", "which module/handler/function/
// contract/test/workflow" — were REMOVED from INTERNAL_ANCHOR_PHRASES. Question words
// are NEUTRAL: they are the most natural way to phrase an EXTERNAL research question
// ("How does Stripe construct the webhook signature?"), so they must NOT pull internal.
// A question is classified by its CONTENT signals (proper noun / API term / local
// symbol / path), never by its interrogative shape. Genuine repo anchors ("our",
// "this repo", "exit code", "which X owns") remain; "which module/handler/function"
// are dropped because a bare "which" + a generic noun carries no this-repo signal.

/**
 * Internal file / path SHAPE patterns. These are STRUCTURAL shapes (file
 * extensions, repo-relative path separators, GSD-T's file-naming convention) —
 * NOT an enumerated list of specific repo symbols.
 *
 * Finding #3 (HIGH — anti-self-fulfilling-oracle): the held-out corpus uses NOVEL
 * local symbols precisely to prove the classifier GENERALIZES by SHAPE rather than
 * memorizing a list. So NONE of those specific held-out symbols may appear here —
 * they are detected structurally instead (a file-path shape below, or a bare
 * camelCase/kebab local-symbol shape via matchLocalSymbolShape). A guard test
 * (m89-classifier-no-hardcoded-heldout-symbols) asserts none re-appear as a literal.
 */
const INTERNAL_FILE_PATTERNS = [
  // GSD-T module naming convention (shape, not a specific filename)
  "gsd-t-", // bin/gsd-t-*.cjs files
  ".workflow.js", // workflow scripts
  ".test.js", // test files
  "gsd-t.js", // main CLI
  // Contract / domain / scope file shapes
  "-contract.md", // contract files
  "scope.md", "tasks.md", "constraints.md",
  "progress.md", "architecture.md", "workflows.md",
  // Path separators that imply repo-relative paths
  "bin/", "test/", "templates/", "commands/", ".gsd-t/",
];

/**
 * Bare local-symbol SHAPE detector (finding #3 — the generalizing internal signal).
 *
 * A bare camelCase (e.g. getUserToken, parseConfigFile) or kebab/snake module-ish
 * identifier (e.g. some-cli-tool) referenced WITHOUT any external proper noun /
 * API term is a local-symbol shape → this repo's own grep-able code. Detected by
 * STRUCTURE, not by an enumerated symbol list, so a NOVEL held-out symbol classifies
 * correctly by shape.
 *
 *   - camelCase: a token with an internal lower→Upper transition (getUserToken)
 *   - kebab-ish module name: lowercase words joined by hyphens that is NOT a known
 *     English hyphenation (e.g. some-cli-tool) — heuristically, a hyphenated
 *     token whose segments look like code identifiers
 *
 * @param {string} text - the ORIGINAL-case claim text (camelCase needs case)
 * @returns {string|null} the matched symbol shape, or null
 */
function matchLocalSymbolShape(text) {
  // camelCase identifier: a word boundary, 1+ lowercase, then an Upper, then word chars.
  // Excludes ALLCAPS and single-cap (PascalCase sentence-start handled by requiring a
  // leading lowercase run before the first uppercase).
  const camel = text.match(/\b[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*\b/);
  if (camel) return camel[0];
  // kebab-ish code module: two+ lowercase segments joined by hyphens, each ≥2 chars,
  // not a single common word. Excludes ordinary hyphenated English by requiring the
  // whole token NOT to be in a small stop-list of common hyphenations.
  const kebab = text.match(/\b[a-z][a-z0-9]+(?:-[a-z0-9]+)+\b/);
  if (kebab) {
    const COMMON_HYPHENATED = new Set([
      "rate-limit", "cross-origin", "same-origin", "user-agent", "pop-up",
      "third-party", "real-time", "well-known", "fail-toward", "best-practice",
      "up-to-date", "built-in", "set-up", "per-request", "per-tenant", "per-origin",
    ]);
    if (!COMMON_HYPHENATED.has(kebab[0])) return kebab[0];
  }
  return null;
}

// ---------------------------------------------------------------------------
// PROPER-NOUN-LESS EXTERNAL ASSERTION detection (the cycle-2 finding #3 fix)
//
// A claim that ASSERTS an external system's behavior / return-shape / limit /
// value WITHOUT a cited source routes EXTERNAL even with NO proper noun.
// E.g. "the payments endpoint accepts a max batch size of 100" — no vendor
// name, yet it asserts a remote system's limit unverified → external.
//
// We detect this via structural patterns: a claim ABOUT "the [noun] endpoint"
// or "the [noun] API" that asserts a limit/value/behavior.
// ---------------------------------------------------------------------------

/**
 * Patterns that indicate a bare external-system assertion (no proper noun needed).
 * These match the STRUCTURE of an unverified external claim:
 *   "the <external-system> accepts/returns/has <limit/value/behavior>"
 */
const EXTERNAL_ASSERTION_PATTERNS = [
  // "the X endpoint accepts/returns/has/allows ..."
  /the\s+\w+\s+endpoint\s+(accepts?|returns?|has|allows?|rejects?|responds?)/i,
  // "the X api accepts/returns/has ..."
  /the\s+\w+\s+api\s+(accepts?|returns?|has|allows?|rejects?|responds?)/i,
  // "the create/send/update/delete call returns ..."
  /the\s+\w+\s+call\s+(returns?|responds?|provides?|sends?)/i,
  // "the <noun> accepts a max(imum) batch/payload ..."
  /accepts?\s+a\s+max(imum)?\s+/i,
  // "maximum/max batch size / payload size / total amount / total limit"
  /max(imum)?\s+(batch|payload|request|total|amount)\s+(size|limit|of|allowed)/i,
  // "batch size of N" — claims a specific limit
  /batch\s+size\s+of\s+\d+/i,
  // "a maximum of N items/requests"
  /a\s+max(imum)?\s+of\s+\d+/i,
];

// ---------------------------------------------------------------------------
// Classification logic
// ---------------------------------------------------------------------------

/**
 * Classify a guessed claim as internal or external.
 *
 * @param {string} gap - The claim text (a GUESSED claim per §6.5).
 * @returns {{ ok:true, gap:string, class:"internal"|"external", route:"grep"|"web", reason:string }
 *          |{ ok:false, error:string }}
 */
function classify(gap) {
  // Bad-input guard (finding #6 — SC1): empty/whitespace/non-string → error envelope
  if (typeof gap !== "string") {
    return { ok: false, error: "gap must be a string" };
  }
  const trimmed = gap.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "gap must not be empty or whitespace-only" };
  }

  const lower = trimmed.toLowerCase();

  // ── Step 1: Check for external PROPER NOUN signals (WORD-BOUNDARY) ────────
  // STRONG proper nouns only; WEAK homographs ("square"/"go"/"edge"/…) are gated
  // behind co-occurrence in Step 1b (cycle-3 finding #3).
  const matchedStrongProperNoun = EXTERNAL_PROPER_NOUNS.find((noun) =>
    boundaryMatch(lower, noun)
  );
  const matchedWeakProperNoun = WEAK_EXTERNAL_PROPER_NOUNS.find((noun) =>
    boundaryMatch(lower, noun)
  );
  // A POSSESSIVE homograph ("square's", "amazon's") is the company, not the verb/noun —
  // you do not write "we square's the input". So the possessive form is a STRONG signal
  // on its own (cycle-3 finding #3: "Square's payments API" → external; "we square the
  // input value" → internal). Matched on the lowercased text.
  const matchedPossessiveHomograph = WEAK_EXTERNAL_PROPER_NOUNS.find((noun) =>
    boundaryMatch(lower, noun + "'s")
  );

  // ── Step 2: Check for external API / protocol / version / limit terms ────
  // (WORD-BOUNDARY) — strong terms only; weak generic words handled in Step 2b.
  const matchedApiTerm = EXTERNAL_API_TERMS.find((term) =>
    boundaryMatch(lower, term)
  );

  // ── Step 3: Check for browser / runtime behavior terms (WORD-BOUNDARY) ────
  const matchedBrowserTerm = EXTERNAL_BROWSER_RUNTIME_TERMS.find((term) =>
    boundaryMatch(lower, term)
  );

  // ── Step 4: Check for proper-noun-LESS external assertion pattern ─────────
  // This is the cycle-1 finding #3 fix: a claim that ASSERTS an external
  // system's behavior without any vendor name still routes external.
  const matchedExternalAssertion = EXTERNAL_ASSERTION_PATTERNS.find((re) =>
    re.test(trimmed)
  );

  // ── Step 5: Check for internal ANCHOR signals (WORD-BOUNDARY) ─────────────
  const matchedAnchor = INTERNAL_ANCHOR_PHRASES.find((phrase) =>
    boundaryMatch(lower, phrase)
  );

  // ── Step 6: Check for internal FILE / SYMBOL signals ─────────────────────
  // Cycle-3 finding #2 (code-review): these are TWO signal STRENGTHS, not one.
  //   (a) PATH-shaped signal — a repo-relative path / file-naming SHAPE
  //       (INTERNAL_FILE_PATTERNS: `bin/`, `*.workflow.js`, `gsd-t-*`, `*-contract.md`).
  //       This is a STRONG internal signal: it can OVERRIDE a co-occurring external
  //       proper noun ("how does gsd-t-verify.workflow.js call Stripe?" → internal).
  //   (b) bare camelCase / kebab-ish LOCAL-SYMBOL shape (matchLocalSymbolShape).
  //       This is a WEAK internal signal: a bare camelCase token is shape-identical
  //       to an EXTERNAL symbol ("createCharge" Stripe vs "parseConfig" this-repo),
  //       so it pulls internal ONLY when NO external proper-noun / browser term
  //       co-occurs. It must NEVER override a co-occurring external proper noun
  //       (the conflict-resolution rule below).
  const matchedPathPattern = INTERNAL_FILE_PATTERNS.find((pattern) =>
    boundaryMatch(lower, pattern)
  );
  const matchedSymbolShape = matchLocalSymbolShape(trimmed);
  const matchedFilePattern = matchedPathPattern || matchedSymbolShape;

  // ── Step 2b: WEAK external API term (finding #4 LOW) — counts ONLY if another
  // external signal co-occurs (proper noun / strong API term / browser term /
  // assertion pattern). A bare generic word alone is NOT enough to force web.
  const matchedWeakApiTerm = WEAK_EXTERNAL_API_TERMS.find((term) =>
    boundaryMatch(lower, term)
  );

  // STRONG external signals: a strong proper noun, a strong API term, a browser/runtime
  // term, or the proper-noun-less assertion pattern. These are the ONLY signals that can
  // promote a WEAK signal (weak API term OR weak homograph proper noun). Two weak signals
  // together do NOT promote each other (cycle-3 finding #3: "square endpoint" stays
  // internal — both are weak homographs/generics).
  const hasStrongExternalSignal =
    !!matchedStrongProperNoun ||
    !!matchedPossessiveHomograph ||
    !!matchedApiTerm ||
    !!matchedBrowserTerm ||
    !!matchedExternalAssertion;

  // A weak homograph proper noun ("square"/"go"/"edge"/…) is promoted to a real proper
  // noun when: a strong external signal co-occurs, OR it appears in POSSESSIVE form
  // ("Square's …") which is unambiguously the company (cycle-3 finding #3).
  const effectiveProperNoun =
    matchedStrongProperNoun ||
    matchedPossessiveHomograph ||
    (matchedWeakProperNoun && hasStrongExternalSignal ? matchedWeakProperNoun : undefined);

  // A weak generic API word ("endpoint"/"quota"/…) counts ONLY when a strong external
  // signal OR an effective (possibly-promoted) proper noun co-occurs.
  const effectiveApiTerm =
    matchedApiTerm ||
    (matchedWeakApiTerm && (hasStrongExternalSignal || !!effectiveProperNoun)
      ? matchedWeakApiTerm
      : undefined);

  // The effective proper noun the rest of the decision logic uses.
  const matchedProperNoun = effectiveProperNoun;

  // ── Decision logic ────────────────────────────────────────────────────────
  //
  // Priority (from the contract §1.1 heuristic):
  //   1. Internal anchor + NO external API/limit/browser term → internal
  //      (Even if there's a proper noun in an internal-anchored question,
  //       "Which domain in this repo owns gsd-t-verify.workflow.js?" is internal)
  //   2. External proper noun present (without internal anchor) → external
  //   3. External API/limit/browser term present (without internal anchor) → external
  //   4. Proper-noun-less external assertion pattern matches → external
  //   5. Internal file/symbol signal (no external signals) → internal
  //   6. Ambiguous → internal-first (default)
  //
  // The internal-anchor + external-proper-noun collision:
  //   "What is the Stripe webhook header format used in this repo's integration?"
  //   → the internal anchor "this repo" pulls it internal IF the question is
  //     about this-repo's OWN implementation detail.
  //   But: internal anchors ONLY override proper-noun signals when the question
  //   is CLEARLY about the repo's own schema/structure, not about the external
  //   API's behavior. If the external API term (OAuth flow, token endpoint, etc.)
  //   is the CORE of the question, external wins.
  //
  // Resolution: if BOTH internal anchor AND external API/browser/proper-noun
  // signals are present, the STRONGER signal wins:
  //   - If the question contains an external API TERM (not just a name mention)
  //     → external (the question is about the external system's behavior)
  //   - If the question only mentions a name but is anchored to "this repo"
  //     → internal (the question is about how this repo implements it)

  const hasInternalAnchor = !!matchedAnchor;
  // Cycle-3 finding #2 — two internal-signal STRENGTHS (see Step 6):
  //   hasInternalPath  = STRONG: a repo-relative path / file-naming shape. MAY override
  //                      a co-occurring external proper noun.
  //   hasInternalSymbol= WEAK: a bare camelCase / kebab local-symbol shape. May NOT
  //                      override a co-occurring external proper noun (shape-identical to
  //                      an external symbol). Pulls internal only when NO external signal.
  const hasInternalPath = !!matchedPathPattern;
  const hasInternalSymbol = !!matchedSymbolShape;
  const hasInternalFile = hasInternalPath || hasInternalSymbol;
  const hasExternalApiTerm = !!effectiveApiTerm;
  const hasExternalBrowserTerm = !!matchedBrowserTerm;
  const hasExternalProperNoun = !!matchedProperNoun;
  const hasExternalAssertion = !!matchedExternalAssertion;

  // ── CONFLICT-RESOLUTION RULE (cycle-3, the durable fix) ────────────────────
  // A text classifier CANNOT tell external `createCharge` (Stripe) from internal
  // `parseConfig` (this repo) by SHAPE alone — both are identical camelCase. So
  // when signals CONFLICT, the SAFE default is FAIL-TOWARD-EXTERNAL (research), NOT
  // internal: a silent miss defeats the milestone; over-research is bounded cost.
  //
  // An external proper noun (or browser/runtime term) may be OVERRIDDEN to internal
  // ONLY by a PATH-SHAPED internal signal (hasInternalPath) OR an explicit internal
  // anchor (hasInternalAnchor — handled in Case A above). A BARE camelCase/kebab
  // symbol shape (hasInternalSymbol) must NEVER override a co-occurring external
  // proper noun. So:
  //   "react useState returns a stateful value"            → external (proper noun beats bare symbol)
  //   "the stripe createCharge call returns a chargeId"    → external
  //   "how does gsd-t-verify.workflow.js call the api?"     → internal (PATH overrides)
  //   "does parseConfig clamp the model in this repo?"     → internal (anchor — Case A)
  //   bare "parseConfig clamps the model" (no external)     → internal (Case I, by shape)
  const internalOverridesProperNoun = hasInternalPath; // anchor handled in Case A

  // Case A: Internal ANCHOR present → INTERNAL (internal signal WINS — finding #4).
  // An explicit "this repo / our / internal / exit code / which-owns" anchor means the
  // question is about THIS repo's own code, even if it also mentions an external
  // proper noun or an API/limit/rate-limit term. E.g. "the rate limit OUR INTERNAL API
  // gateway enforces per tenant" is about this repo's gateway → internal, NOT external.
  // (HO-E4 — the proper-noun-LESS external assertion — has NO internal anchor, so it
  // still routes external below; that distinction is preserved.)
  if (hasInternalAnchor) {
    return {
      ok: true,
      gap: trimmed,
      class: "internal",
      route: "grep",
      reason: `Internal anchor "${matchedAnchor}" — this question concerns this repo's own code/structure (internal signal wins over any external term)`,
    };
  }

  // Case B: External proper noun + external API term → EXTERNAL
  // (the strongest external signal combination)
  if (hasExternalProperNoun && hasExternalApiTerm) {
    return {
      ok: true,
      gap: trimmed,
      class: "external",
      route: "web",
      reason: `External: third-party proper noun ("${matchedProperNoun}") + API/protocol term ("${effectiveApiTerm}") — concerns an external system's contract`,
    };
  }

  // Case C: External proper noun + browser/runtime behavior → EXTERNAL
  if (hasExternalProperNoun && hasExternalBrowserTerm) {
    return {
      ok: true,
      gap: trimmed,
      class: "external",
      route: "web",
      reason: `External: third-party proper noun ("${matchedProperNoun}") + browser/runtime behavior term ("${matchedBrowserTerm}")`,
    };
  }

  // Case D: External proper noun NOT overridden by a PATH-shaped internal signal → EXTERNAL.
  // Cycle-3 finding #2: a bare camelCase/kebab SYMBOL shape does NOT override a co-occurring
  // proper noun (shape-identical to an external symbol — "createCharge" vs "parseConfig").
  // Only a PATH-shaped signal (internalOverridesProperNoun) sends a proper-noun claim internal.
  // So "react useState ..." / "the stripe createCharge ... returns chargeId" → external here.
  if (hasExternalProperNoun && !internalOverridesProperNoun) {
    return {
      ok: true,
      gap: trimmed,
      class: "external",
      route: "web",
      reason: `External: third-party proper noun ("${matchedProperNoun}") detected — concerns a system outside this repo (no path-shaped internal signal overrides it; a bare symbol shape does not)`,
    };
  }

  // Case E: External proper noun + PATH-shaped internal signal, NO external API term
  // → question is about how THIS repo uses the tool → INTERNAL.
  // (Reached only when internalOverridesProperNoun is true, i.e. a real repo path /
  // *.workflow.js / bin/* / gsd-t-* shape co-occurs — e.g. "how does
  // gsd-t-verify.workflow.js call Stripe?")
  if (hasExternalProperNoun && internalOverridesProperNoun && !hasExternalApiTerm) {
    return {
      ok: true,
      gap: trimmed,
      class: "internal",
      route: "grep",
      reason: `Internal: despite mention of "${matchedProperNoun}", path-shaped internal signal "${matchedPathPattern}" anchors this to this repo's own implementation`,
    };
  }

  // Case F: External API term (no proper noun, no internal anchor) → EXTERNAL
  if (hasExternalApiTerm && !hasInternalFile) {
    return {
      ok: true,
      gap: trimmed,
      class: "external",
      route: "web",
      reason: `External: API/protocol/limit term ("${effectiveApiTerm}") detected — concerns an external system's contract or behavior`,
    };
  }

  // Case G: Browser/runtime behavior term → EXTERNAL (runtime is external)
  if (hasExternalBrowserTerm) {
    return {
      ok: true,
      gap: trimmed,
      class: "external",
      route: "web",
      reason: `External: browser/runtime behavior term ("${matchedBrowserTerm}") — runtime behavior is an external signal`,
    };
  }

  // Case H: Proper-noun-LESS external assertion pattern → EXTERNAL
  // This is the critical cycle-2 finding #3 fix: an unverified external claim
  // routes external even without a vendor proper noun.
  if (hasExternalAssertion && !hasInternalFile) {
    return {
      ok: true,
      gap: trimmed,
      class: "external",
      route: "web",
      reason: `External: proper-noun-less external assertion detected — the claim asserts an external system's behavior/limit without a cited source`,
    };
  }

  // Case I: Internal file/symbol signal (no external signals) → INTERNAL
  if (hasInternalFile) {
    return {
      ok: true,
      gap: trimmed,
      class: "internal",
      route: "grep",
      reason: `Internal: local file/symbol shape ("${matchedFilePattern}") — concerns this repo's own code`,
    };
  }

  // Case K: Ambiguous → INTERNAL-FIRST (default per §1.1)
  // Escalation to external on empty grep is D3/D4's job, not ours.
  return {
    ok: true,
    gap: trimmed,
    class: "internal",
    route: "grep",
    reason: "Ambiguous — no decisive external or internal signal detected; defaulting internal (escalate to external only if grep returns nothing)",
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (require.main === module) {
  // Usage: gsd-t-research-gate classify "<gap>" [--json]
  const args = process.argv.slice(2);
  const jsonFlag = args.includes("--json");
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

  if (!result.ok) {
    process.exit(1);
  }
  // Success → exit 0
}

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

module.exports = { classify };
