# Constraints: d8-wiring-contract-and-lint

## The grep DISTINCTION (user-emphasized — do not get this wrong)
- **STRUCTURAL questions** (who-imports / who-calls / blast-radius / dependents / dead-code / cycles / cluster / orphan / test→impl): the graph is the ONLY allowed source. No grep fallback. Graph-unavailable → FAIL LOUD.
- **TEXT search** (find a string literal / TODO / a config value / a magic string / a regex over file contents): grep stays LEGITIMATE — the graph holds no text content. The lint MUST NOT flag text-search grep.
- The lint flags ONLY the `try graph → catch → grep (structural)` fallback shape: a grep that answers a STRUCTURAL question. Distinguish by proximity to a structural query verb call + the structural intent of the grep pattern, NOT by the mere presence of the word grep.

## FAIL-LOUD invariant (the M20–M21 lesson)
- A wired command on a STRUCTURAL question, when the graph CLI returns `{ok:false, reason:"graph-unavailable"}`, MUST surface that loudly ("graph unavailable — fix it") and MUST NOT silently substitute grep. The contract declares this; the lint proves no code path violates it.
- DISTINCT from `/scan`'s ANNOUNCED grep-mode fallback (d6): scan's deep-finders read every file for in-file LOGIC anyway, so on graph-unavailable scan announces and continues in its intact grep-read mode. That announced, non-silent, logic-read fallback is NOT a structural-grep fallback — the contract carves it out explicitly so the lint does not false-flag d6.

## Lint determinism (the coverage-check lesson — feedback_coverage_check_structural_not_substring)
- The lint is STRUCTURAL, never a naive substring scan: it parses each wired file for a query-CLI call followed by a catch/else that invokes grep for a structural pattern. A comment mentioning grep, or a legitimate text-search grep, must NOT trip it.
- The lint reads the wired-file set from a declared manifest (the contract's consumer table), NOT a hardcoded list baked into the test body — so adding a consumer in d10/d11 auto-extends coverage and a new file cannot silently escape the gate. NEVER hardcode a finite consumer list in the test.
- Self-test (mandatory negative): the lint test includes a fixture with a real `try graph → catch → structural grep` pattern and asserts the lint CATCHES it (a green that can't go red is worthless), plus a fixture with a legitimate text-search grep and asserts the lint does NOT flag it.

## No new runtime deps (repo zero-dep installer invariant)
- The lint engine uses Node built-ins only (fs/path + regex/structural scan). No external parser dep.
