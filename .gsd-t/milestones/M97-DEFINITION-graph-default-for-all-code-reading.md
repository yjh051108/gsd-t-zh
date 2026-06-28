# M97 — Make the Graph the Default for ALL Code-Reading (intercept Claude's grep/Read)

**Status: DEFINED 2026-06-27 — researched, awaiting partition/build decision.**

## The one-breath call
Today the code graph only powers explicit GSD-T *commands* (`/impact`, `/debug`, file-disjointness…). When Claude reads code in *everyday* conversation — outside those commands — it greps raw text, ignoring the graph (the "grep you saw in binvoice"). M97 closes that gap per the Central Tenet: a **PostToolUse hook intercepts Claude's `Grep` calls**, detects when the grep is a STRUCTURAL question (who-calls / who-imports / a bare symbol name), answers it from the precomputed graph, and **replaces the grep output** the model sees with the graph's pre-organized structural answer — so Claude "reaches smart" by default, not just inside GSD-T commands. Text searches (find a string / TODO / error message) pass through to grep untouched.

## Origin
- **The Central Tenet** (user directive 2026-06-25, `.gsd-t/progress.md` §CENTRAL TENET): the graph is the MANDATORY structural-knowledge layer for EVERY code-reading step — "dumb reach vs. smart reach." M94 wired the *commands*; M97 extends it to Claude's *ambient* code-reading.
- **User trigger (2026-06-27):** "Shouldn't it be that any time Claude needs to read code, it should always use the graph?" — correct, and not yet built.
- **The grep David saw in binvoice** was Claude's own built-in Grep tool reading code (normal Claude Code behavior), NOT a GSD-T consumer falling back. M97 is what would make that grep consult the graph first.

## Research findings (VERIFIED this session — cite, don't re-derive)
Claude Code hook capabilities (official docs, code.claude.com/docs/en/hooks.md, verified 2026-06-27):
- **PreToolUse** can: BLOCK a tool (`permissionDecision: deny`), MODIFY its input (`updatedInput`), inject `additionalContext`. It CANNOT replace output (tool hasn't run yet).
- **PostToolUse** can: **REPLACE the tool result the model sees** via `updatedToolOutput` (full replacement — original grep output does NOT reach the model), OR ADD a note via `additionalContext` (model sees both). This is the load-bearing capability and it is CONFIRMED real.
- **Conditional firing:** the `if` field filters on tool input (best-effort; runs anyway if unparseable) — so the hook can target structural-looking greps.
- **Synchronous local CLI:** hooks run shell commands (`node gsd-t-graph-query-cli.cjs …`) synchronously; 600s timeout (ample); output cap 10,000 chars (graph answers must be concise).
- **Infinite-loop risk:** if the hook itself calls Grep/Read it re-triggers the same hook — NO documented guard. The hook MUST query the graph CLI directly, never grep.

**Chosen mechanism (from the research):** a **PostToolUse hook on `Grep`** — let grep run, then in the hook decide: structural query → call the graph CLI → `updatedToolOutput` = graph answer (replace); text query → return `{}` (pass grep through). PostToolUse beats PreToolUse here because PreToolUse-deny shows the user a permission prompt (bad UX); PostToolUse replaces silently.

## Scope
1. **Structural-vs-text classifier** (`bin/gsd-t-grep-classifier.cjs`) — given a Grep's `tool_input` (pattern + path), decide: is this a STRUCTURAL question the graph can answer better (a bare function/class/symbol name; "who calls X"; import of Y), or a TEXT search (a string literal, TODO, error message, regex)? Conservative: when unsure → TEXT (pass through to grep). False-pass-through is safe; false-replace is not.
2. **The intercept hook** (`scripts/gsd-t-graph-intercept.js`) — PostToolUse on Grep. Reads stdin (tool_input + tool_output), runs the classifier; if structural AND a graph exists for this project AND the graph CLI resolves it → emit `updatedToolOutput` with the graph's answer (labeled "structural answer from code-graph index — compiler-accurate/tree-sitter-floor tier") + the original grep hits appended as a fallback section; else emit `{}` (grep passes through). NEVER calls Grep/Read itself (loop guard). FAIL-OPEN: any error → pass grep through unchanged (never break Claude's search).
3. **Graph-availability gate** — if the project has no `.gsd-t/graph.db` (graph unavailable), the hook is a no-op pass-through (grep as today). No graph = no interception = no regression.
4. **Wire into install** — register the PostToolUse hook in `~/.claude/settings.json` during `gsd-t install` (like the existing brevity-guard / auto-route hooks), scoped so it only fires in GSD-T projects (presence of `.gsd-t/`).
5. **Mapping grep→verb** — translate a structural grep into the right graph verb: bare symbol → who-calls + who-imports; "import ... X" → who-imports; a function-definition-looking pattern → blast-radius. Keep the mapping small and high-precision.
6. **Visibility** — the replaced output is clearly labeled so the user/model knows the answer came from the graph (tier included), and the original grep hits are retained beneath it (so nothing is hidden — addresses the "no silent substitution" concern).

## Falsifiable acceptance
- AC-1: a structural grep (bare symbol that is a known function) in a graph-indexed project → the model receives the GRAPH answer (callers/importers), labeled with tier, NOT raw grep lines. (Hook integration test with a fixture project.)
- AC-2: a text grep (a string literal / TODO / error message) → passes through to grep UNCHANGED (classifier conservatism; no false replacement).
- AC-3: a project with NO graph → hook is a pure no-op; grep behaves exactly as today (no regression).
- AC-4: the hook NEVER calls Grep/Read (static check) — no infinite-loop path.
- AC-5: FAIL-OPEN — a classifier throw / CLI error / malformed stdin → grep passes through; Claude's search is never broken. (Fault-injection test.)
- AC-6: latency — the hook adds < ~300ms to a structural grep (graph query is fast; freshness on the queried files only). Measured.
- AC-7: end-to-end on binvoice — a who-calls-style question routes to the graph and returns real callers, demonstrated live.

## Risks / open questions (settle at partition)
- **Classifier precision is the whole ballgame.** Too aggressive → it hijacks legitimate text searches (bad). Too timid → no benefit. Start CONSERVATIVE (only the clearest structural patterns), measure, widen. This is the partition's first decision: what exact patterns count as "structural"?
- **The `status`/freshness hang (found this session)** — a graph query currently runs a full freshness walk; on a 260K-edge project that can hang. M97 MUST depend on a CHEAP query path (freshness scoped to the queried files only, not a whole-tree walk), or it inherits the hang. Likely a prerequisite fix (could be folded into M97 or done first).
- **Output cap (10K chars)** — large caller lists must be summarized/truncated with a "+N more" note, never silently cut.
- **Scope creep guard (M20-M21 lesson):** M97 intercepts ONLY `Grep` first (the proof). `Read` interception (serving a graph slice instead of a full file) is a richer, riskier follow-on — explicitly DEFERRED until Grep-intercept is proven.

## Out of scope (follow-ons)
- Intercepting `Read` to serve graph slices (deferred — Grep first).
- The `gsd-t graph status` cheap-query fix (prerequisite — may be done first as a small standalone fix).
- Building graphs in every project (M96 follow-on, already mostly done — 26/26 indexed).
