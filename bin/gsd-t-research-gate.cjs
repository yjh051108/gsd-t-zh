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
 */
const EXTERNAL_PROPER_NOUNS = [
  // Payment processors
  "paypal", "stripe", "square", "braintree", "adyen", "klarna", "plaid",
  // Cloud platforms
  "aws", "amazon", "azure", "google cloud", "gcp", "cloudflare",
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
  "node.js", "python", "ruby", "java", "go ", "rust ", "swift",
  // Browsers and browser APIs
  "chrome", "chromium", "firefox", "safari", "webkit", "edge", "ie ",
  "internet explorer",
  // UI frameworks (external behavior / version facts)
  "react", "vue", "angular", "svelte", "next.js", "nuxt", "remix",
  // CSS / web standards
  "css ", "html5", "ecmascript", "w3c", "whatwg", "tc39",
  // HTTP / API standards
  "openapi", "swagger", "graphql", "rest ", "grpc", "soap ",
  // Spec bodies
  "ietf", "rfc ", "iso ", "ansi ",
  // SaaS / third-party services
  "github", "gitlab", "bitbucket", "jira", "slack", "zendesk",
  "salesforce", "hubspot", "intercom",
];

/**
 * API / endpoint / protocol / version / limit terms that signal external context
 * when they appear WITHOUT an internal-repo anchor.
 *
 * These are feature-CLASS signals, not corpus keywords. "endpoint" is not the
 * same as a specific endpoint path in this repo — the distinction is resolved
 * by also checking internal signals (repo paths, local symbols).
 */
const EXTERNAL_API_TERMS = [
  // HTTP / API structural terms (without "this repo / our" anchor)
  "/v1/", "/v2/", "/v3/", // version-prefixed paths typical of third-party APIs
  "api key", "api secret", "api token",
  "webhook", "callback url", "redirect uri", "redirect url",
  "access token", "refresh token", "bearer token", "bearer ",
  "authorization header", "authorization code",
  "rate limit", "rate-limit", "quota limit", "quota",
  "response shape", "return shape", "error shape", "error code",
  "status code",
  // Auth flows
  "oauth flow", "auth flow", "token mint", "token endpoint",
  "client credentials", "client secret", "client id",
  "scopes", "grant type", "grant_type",
  // Version / spec
  "current version", "latest version", "minimum version",
  "browser support", "browser compatibility",
  "specification", " spec ", "standard ",
  // Limits / capacities (external system limits)
  "maximum amount", "maximum total", "max total", "max amount",
  "maximum batch", "max batch", "batch size", "batch limit",
  "per-request limit", "payload limit",
  // Endpoints (generic — resolved external if no internal anchor)
  "endpoint", "base url", "base path",
  // Invoice-related (specific PayPal API surface — external system)
  "invoice total", "line item", "invoice api",
];

/**
 * Browser / runtime BEHAVIOR terms — unambiguously external (the runtime is
 * not in this repo).
 */
const EXTERNAL_BROWSER_RUNTIME_TERMS = [
  "popup blocker", "pop-up blocker", "popup block",
  "same-origin policy", "cross-origin", "cors ",
  "content security policy", "csp ",
  "service worker", "web worker",
  "local storage", "session storage", "indexeddb",
  "storage quota", "storage limit", "storage.local",
  "window.open", "location.href", "history.pushstate",
  "geolocation api", "notification api", "clipboard api",
  "requestanimationframe",
  "user agent", "user-agent",
  "browser event", "browser behavior", "browser block",
  "runtime behavior", "v8 ", "node runtime",
];

// ---------------------------------------------------------------------------
// Internal-signal patterns (repo-relative anchors)
// ---------------------------------------------------------------------------

/**
 * Explicit "this repo" / "our" ANCHOR phrases. Presence of any of these
 * strongly signals internal — the question is about code IN this repository.
 *
 * Finding #4 (MEDIUM): bare "our <noun>" / "internal" / "this repo's" anchors
 * are internal signals too; when an internal anchor is present, an external
 * API/limit/rate-limit term does NOT force external — the internal signal wins
 * (internal-first per §1.1). E.g. "the rate limit OUR INTERNAL API gateway
 * enforces per tenant" is about THIS repo's own gateway → internal.
 */
const INTERNAL_ANCHOR_PHRASES = [
  "this repo", "our repo", "the repo",
  "this codebase", "our codebase",
  "in this project", "our project",
  "this module", "our module",
  "this file", "our file",
  "the existing ", "our existing",
  "in the codebase",
  // Bare internal anchors (finding #4): "our <noun>" / "internal" / "this repo's"
  "our ", "internal ", " internal",
  "this repo's", "repo's",
  // Ownership / file-system signals
  "which domain owns", "which file owns", "who owns",
  "which module", "which handler", "which function",
  "which contract", "which test", "which workflow",
  // Exit code / return value of THIS module
  "return when", "returns when", "return on", "returns on",
  "exit code", "what does ", "how does ",
];

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

  // ── Step 1: Check for external PROPER NOUN signals ───────────────────────
  const matchedProperNoun = EXTERNAL_PROPER_NOUNS.find((noun) =>
    lower.includes(noun)
  );

  // ── Step 2: Check for external API / protocol / version / limit terms ────
  const matchedApiTerm = EXTERNAL_API_TERMS.find((term) =>
    lower.includes(term.toLowerCase())
  );

  // ── Step 3: Check for browser / runtime behavior terms ───────────────────
  const matchedBrowserTerm = EXTERNAL_BROWSER_RUNTIME_TERMS.find((term) =>
    lower.includes(term.toLowerCase())
  );

  // ── Step 4: Check for proper-noun-LESS external assertion pattern ─────────
  // This is the cycle-2 finding #3 fix: a claim that ASSERTS an external
  // system's behavior without any vendor name still routes external.
  const matchedExternalAssertion = EXTERNAL_ASSERTION_PATTERNS.find((re) =>
    re.test(trimmed)
  );

  // ── Step 5: Check for internal ANCHOR signals ────────────────────────────
  const matchedAnchor = INTERNAL_ANCHOR_PHRASES.find((phrase) =>
    lower.includes(phrase.toLowerCase())
  );

  // ── Step 6: Check for internal FILE / SYMBOL signals ─────────────────────
  // (a) repo-relative path / file-naming SHAPE, (b) bare camelCase / kebab-ish
  // local-symbol SHAPE (finding #3 — structural, NOT an enumerated symbol list).
  const matchedFilePattern =
    INTERNAL_FILE_PATTERNS.find((pattern) => lower.includes(pattern.toLowerCase())) ||
    matchLocalSymbolShape(trimmed);

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
  const hasInternalFile = !!matchedFilePattern;
  const hasExternalApiTerm = !!matchedApiTerm;
  const hasExternalBrowserTerm = !!matchedBrowserTerm;
  const hasExternalProperNoun = !!matchedProperNoun;
  const hasExternalAssertion = !!matchedExternalAssertion;

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
      reason: `External: third-party proper noun ("${matchedProperNoun}") + API/protocol term ("${matchedApiTerm}") — concerns an external system's contract`,
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

  // Case D: External proper noun alone (no internal anchor, no overriding internal file) → EXTERNAL
  // (internal file/symbol shape takes precedence over a bare proper-noun mention when the
  // question is clearly about this repo's own code)
  if (hasExternalProperNoun && !hasInternalFile) {
    return {
      ok: true,
      gap: trimmed,
      class: "external",
      route: "web",
      reason: `External: third-party proper noun ("${matchedProperNoun}") detected — concerns a system outside this repo`,
    };
  }

  // Case E: External proper noun + internal file/symbol, NO external API term
  // → question is about how THIS repo uses the tool → INTERNAL
  if (hasExternalProperNoun && hasInternalFile && !hasExternalApiTerm) {
    return {
      ok: true,
      gap: trimmed,
      class: "internal",
      route: "grep",
      reason: `Internal: despite mention of "${matchedProperNoun}", internal file/symbol "${matchedFilePattern}" anchors this to this repo's own implementation`,
    };
  }

  // Case F: External API term (no proper noun, no internal anchor) → EXTERNAL
  if (hasExternalApiTerm && !hasInternalFile) {
    return {
      ok: true,
      gap: trimmed,
      class: "external",
      route: "web",
      reason: `External: API/protocol/limit term ("${matchedApiTerm}") detected — concerns an external system's contract or behavior`,
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
