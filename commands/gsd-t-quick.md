# GSD-T: Quick — Fast Task Execution with Contract Awareness

You are executing a small, focused task that doesn't need full phase planning. This is for bug fixes, config changes, small features, and ad-hoc work.

## Default altitude: smallest change that hits the crux (M92)

**The default recommendation is the SMALLEST change that hits the crux — do it directly.** Before choosing scope: state the crux in one line, grep/read what already exists, then make the smallest one-file change that hits it — editing inward at the source, not outward at the N consumers.

Ceremony — the full execute workflow, partition, plan→execute, competition — is the **opt-in escalation**, reached for ONLY when the crux genuinely needs cross-domain coordination or real uncertainty (see Step 2's boundary check). It is never the implied-default "Recommended." If you cannot name why the crux needs ceremony, the smallest change IS the answer.

## Argument Parsing

Parse `$ARGUMENTS`. The first positional arg is the quick task description (`$TASK`). M43 D4 removed the `--watch` opt-out; `--in-session`/`--headless` were never shipped. Under `.gsd-t/contracts/headless-default-contract.md` **v2.0.0** the inner subagent spawn (Step 0.1 fresh-dispatch) and all validation spawns (Design Verification Step 5.25, Red Team Step 5.5, doc-ripple Step 6) go headless unconditionally. A legacy `--watch` token is accepted but ignored (stderr deprecation line).

## Spawn Primitive — Always Headless (M43 D4, v2.0.0)

Per `.gsd-t/contracts/headless-default-contract.md` v2.0.0. Spawn classifications used below (both always headless):

- `spawnType: 'primary'` — Step 0.1 fresh-dispatch subagent running the quick task
- `spawnType: 'validation'` — Design Verification (Step 5.25), Red Team (Step 5.5), doc-ripple (Step 6)

Spawn path is `autoSpawnHeadless({command, spawnType, projectDir, sessionContext})`. The outer `gsd-t-quick` command body is itself the interactive spawn target for the parent `/gsd` router — nested spawns from this body always go headless.

## Model Assignment

Per `.gsd-t/contracts/model-selection-contract.md` v1.0.0.

- **Default**: `sonnet` (`selectModel({phase: "quick"})`) — routine one-off task.
- **Mechanical subroutines** (demote to `haiku`): test runners (`selectModel({phase: "quick", task_type: "test_runner"})`).
- **Red Team (Step 5.5)**: `opus` — adversarial reasoning always runs at top tier.
- **Escalation**: `/advisor` convention-based fallback from `bin/advisor-integration.js` at declared high-stakes sub-decisions (see `.gsd-t/M35-advisor-findings.md`). Never silently downgrade the model or skip Red Team / doc-ripple under context pressure — M35 removed that behavior.

## Step 0.1: Launch via Subagent

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-quick --step 0 --step-label ".1: Launch via Subagent" 2>/dev/null || true
```

To give this task a fresh context window and prevent compaction during consecutive quick runs, always execute via a Task subagent.

**If you are the orchestrating agent** (you received the slash command directly):

**Context observation (before spawning subagent):**

Run via Bash to capture `pct` for the NEXT spawn's token-log Ctx% column:
`node -e "const tb = require('./bin/token-budget.cjs'); const s = tb.getSessionStatus('.'); process.stdout.write(String(s.pct));" 2>/dev/null`

No gating — under headless-default-contract v2.0.0 every spawn goes through `autoSpawnHeadless()` regardless of band. The capture is observational only.

**Stack Rules Detection (before spawning subagent):**

Run via Bash to detect project stack and collect matching rules. Local overrides in `.gsd-t/stacks/` take precedence over global templates.

```bash
GSD_T_DIR=$(npm root -g 2>/dev/null)/@tekyzinc/gsd-t
STACKS_DIR="$GSD_T_DIR/templates/stacks"
LOCAL_STACKS=".gsd-t/stacks"
STACK_RULES=""
_sf() { local n=$(basename "$1"); [ -f "$LOCAL_STACKS/$n" ] && cat "$LOCAL_STACKS/$n" || cat "$1"; }
_add() { [ -f "$STACKS_DIR/$1" ] && STACK_RULES="${STACK_RULES}$(_sf "$STACKS_DIR/$1")"$'\n\n'; }
if [ -d "$STACKS_DIR" ]; then
  for f in "$STACKS_DIR"/_*.md; do [ -f "$f" ] && STACK_RULES="${STACK_RULES}$(_sf "$f")"$'\n\n'; done
  if [ -f "package.json" ]; then
    grep -q '"react-native"' package.json 2>/dev/null && _add react-native.md
    grep -q '"react"' package.json 2>/dev/null && ! grep -q '"react-native"' package.json 2>/dev/null && _add react.md
    grep -q '"next"' package.json 2>/dev/null && _add nextjs.md
    grep -q '"vue"' package.json 2>/dev/null && _add vue.md
    (grep -q '"typescript"' package.json 2>/dev/null || [ -f "tsconfig.json" ]) && _add typescript.md
    grep -qE '"(express|fastify|hono|koa)"' package.json 2>/dev/null && _add node-api.md && _add rest-api.md
    grep -q '"tailwindcss"' package.json 2>/dev/null && _add tailwind.md
    grep -q '"vite"' package.json 2>/dev/null && _add vite.md
    grep -q '"@supabase/supabase-js"' package.json 2>/dev/null && _add supabase.md
    grep -q '"firebase"' package.json 2>/dev/null && _add firebase.md
    grep -qE '"(graphql|@apollo/client|urql)"' package.json 2>/dev/null && _add graphql.md
    grep -q '"zustand"' package.json 2>/dev/null && _add zustand.md
    grep -q '"@reduxjs/toolkit"' package.json 2>/dev/null && _add redux.md
    grep -q '"neo4j-driver"' package.json 2>/dev/null && _add neo4j.md
    grep -qE '"(pg|prisma|drizzle-orm|knex)"' package.json 2>/dev/null && _add postgresql.md
    grep -qE '"(prisma|@prisma/client)"' package.json 2>/dev/null && _add prisma.md
    grep -qE '"(bullmq|bull|amqplib|@aws-sdk/client-sqs|bee-queue|agenda)"' package.json 2>/dev/null && _add queues.md
    grep -qE '"(openai|anthropic|@anthropic-ai/sdk|langchain|llama-index|@google/generative-ai)"' package.json 2>/dev/null && _add llm.md
  fi
  ([ -f "requirements.txt" ] || [ -f "pyproject.toml" ] || [ -f "Pipfile" ]) && _add python.md
  ([ -f "requirements.txt" ] && grep -q "psycopg" requirements.txt 2>/dev/null || [ -f "pyproject.toml" ] && grep -q "psycopg" pyproject.toml 2>/dev/null) && _add postgresql.md
  ([ -f "requirements.txt" ] && grep -q "neo4j" requirements.txt 2>/dev/null) && _add neo4j.md
  ([ -f "requirements.txt" ] && grep -q "fastapi" requirements.txt 2>/dev/null || [ -f "pyproject.toml" ] && grep -q "fastapi" pyproject.toml 2>/dev/null) && _add fastapi.md
  ([ -f "requirements.txt" ] && grep -qE "(celery|dramatiq|rq|arq)" requirements.txt 2>/dev/null || [ -f "pyproject.toml" ] && grep -qE "(celery|dramatiq|rq|arq)" pyproject.toml 2>/dev/null) && _add queues.md
  ([ -f "requirements.txt" ] && grep -qE "(openai|anthropic|langchain|llama.index)" requirements.txt 2>/dev/null || [ -f "pyproject.toml" ] && grep -qE "(openai|anthropic|langchain|llama.index)" pyproject.toml 2>/dev/null) && _add llm.md
  [ -f "pubspec.yaml" ] && _add flutter.md
  [ -f "Dockerfile" ] && _add docker.md
  [ -d ".github/workflows" ] && _add github-actions.md
  ([ -f "playwright.config.ts" ] || [ -f "playwright.config.js" ]) && _add playwright.md
  [ -f "go.mod" ] && _add go.md
  [ -f "Cargo.toml" ] && _add rust.md
  # Design-to-code detection (design contract, design tokens, Figma config, or Figma MCP configured)
  ([ -f ".gsd-t/contracts/design-contract.md" ] || [ -f "design-tokens.json" ] || [ -d "design-tokens" ] || [ -f ".figmarc" ] || [ -f "figma.config.json" ] || grep -q '"figma"' ~/.claude/settings.json 2>/dev/null) && _add design-to-code.md
fi
```

If STACK_RULES is non-empty, append to the subagent prompt:
```
## Stack Rules (MANDATORY — violations fail this task)

{STACK_RULES}

These standards have the same enforcement weight as contract compliance.
Violations are task failures, not warnings.
```

If STACK_RULES is empty (no templates/stacks/ dir or no matches), skip silently.

Spawn a fresh subagent via `captureSpawn` — `spawnType: 'primary'` (always headless per headless-default-contract v2.0.0):

**OBSERVABILITY LOGGING (MANDATORY) — wrap the primary subagent spawn with `captureSpawn`:**

```
node -e "
const { captureSpawn } = require('./bin/gsd-t-token-capture.cjs');
(async () => {
  await captureSpawn({
    command: 'gsd-t-quick',
    step: 'Step 0',
    model: 'sonnet',
    description: 'quick: {task summary}',
    projectDir: '.',
    notes: 'quick: {task summary}',
    spawnFn: async () => { /* Task subagent (general-purpose, spawnType: primary, model: sonnet):
      'You are running gsd-t-quick for this request: {\$ARGUMENTS}
      Working directory: {current project root}
      Read CLAUDE.md and .gsd-t/progress.md for project context, then execute gsd-t-quick starting at Step 1.
      {STACK_RULES block — if non-empty, append the ## Stack Rules section defined above; omit if empty}' */ },
  });
})();
"
```

`captureSpawn` parses `result.usage` and writes the row to `.gsd-t/token-log.md` under the canonical header. Tokens column renders as `in=N out=N cr=N cc=N $X.XX` or `—`, never `N/A`.

Relay the subagent's summary to the user. **Do not execute Steps 1–5 yourself.**

**If you are the spawned subagent** (your prompt says "starting at Step 1"):
Continue to Step 1 below.

## Step 1: Load Context (Fast)

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-quick --step 1 --step-label "Load Context (Fast)" 2>/dev/null || true
```

Read:
1. `CLAUDE.md`
2. `.gsd-t/progress.md` (if exists)
3. `.gsd-t/contracts/` (if exists) — scan for relevant contracts

<!-- M56-D4: preflight + brief + verify-gate wire-in -->
**M56 Preflight + Context-Brief (mandatory before any quick-task work):**

```bash
gsd-t preflight --json > /tmp/gsd-t-preflight.json || exit 4

SPAWN_ID="quick-${ARG_OR_DEFAULT:-task}-$(date -u +%Y%m%dT%H%M%SZ)"
gsd-t brief --kind quick --out ".gsd-t/briefs/${SPAWN_ID}.json" || true
export BRIEF_PATH=".gsd-t/briefs/${SPAWN_ID}.json"
```

If preflight exits 4, surface the failed `severity:"error"` checks (wrong branch, occupied required port) to the user and STOP — do NOT proceed with the quick task. The brief replaces the 30–60k context re-read with a ≤2,500-token JSON snapshot.

**Verify-gate at end** (only if quick task produced code changes):

```bash
if git status --porcelain | grep -q .; then
  gsd-t verify-gate --json > /tmp/gsd-t-verify-gate.json || exit 4
fi
```
<!-- /M56-D4: preflight + brief + verify-gate wire-in -->

## Graph-Enhanced Structural Impact — WRITER Pattern (M94-D11)

Quick applies the **WRITER pattern** from `graph-consumer-wiring-contract.md`:

**READER half:** Before the task agent edits code, the quick workflow queries `blast-radius` / `who-imports` to assess the structural impact of the change — which files depend on the target, what is in the blast radius. This structural slice replaces grep/raw-read for the dependency question. The slice is injected into the task agent's context.

**WRITER half:** After edits land, the workflow triggers a re-index of the touched files (`freshness_check_on_query` from `graph-freshness-contract.md` D4 surface) so downstream graph queries see fresh edges. `[RULE] quick-writer-pattern`.

**FAIL-LOUD on graph-unavailable:** On `{ok:false, reason:"graph-unavailable"}`, the structural-impact query surfaces `"graph unavailable — fix it (gsd-t graph status)"` and the agent proceeds without the structural slice — it does NOT fall back to grep for the structural question. `[RULE] consumer-structural-grep-removed`.

## Step 1.5: Graph-Enhanced Scope Check

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-quick --step 1 --step-label ".5: Graph-Enhanced Scope Check" 2>/dev/null || true
```

If `.gsd-t/graph/meta.json` exists (graph index is available):
1. Query `getDomainOwner` for the target function/file to verify it belongs to the expected domain
2. Query `getDomainBoundaryViolations` to check if the quick change would cross domain boundaries
3. If violations found, warn the user before proceeding — the change may need the full execute workflow

If graph is not available, skip this step.

## Step 2: Scope Check

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-quick --step 2 --step-label "Scope Check" 2>/dev/null || true
```

Based on $ARGUMENTS, determine:
- Which domain does this touch? (check `.gsd-t/domains/*/scope.md` if available)
- Does it cross a domain boundary?
- Does it affect any existing contract?

### Default — within a single domain or pre-partition:
The smallest change that hits the crux is the recommendation. Proceed directly.

### Escalate to ceremony ONLY when the crux needs it:
If — and only if — the change genuinely crosses domain boundaries or affects a contract (real cross-domain coordination / real uncertainty), warn the user:
"This change touches {domain-1} and {domain-2} and may affect {contract}.
The smallest direct change does not contain the crux — escalate to the full execute workflow?"
This is the opt-in escalation, justified by the crux — not a default.

## Step 3: Execute

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-quick --step 3 --step-label "Execute" 2>/dev/null || true
```

### Parallel Dispatch (MANDATORY — single instrument)

Delegate to `gsd-t parallel --command` — do NOT re-implement probe-and-branch logic here (M44 D9 Step 3: "create 1 instrument that accomplishes this instead of implementing it in all the commands").

```bash
node bin/gsd-t.js parallel --command gsd-t-quick && exit 0 || true
# Exit 0  → fan-out happened; detached children handle the work.
# Exit 2+ → sequential (N<2 or quick is single-task — the common case).
#           Fall through to the single-subagent path in Step 0.1.
```

`runDispatch` inside `bin/gsd-t-parallel.cjs` owns the probe + D4/D5/D6 gate math + disjoint task-id partitioning + `autoSpawnHeadless()` fan-out. Mode auto-detects from `GSD_T_UNATTENDED=1`. No user prompt. Parallel-when-safe + headless-when-possible are both the default (per headless-default-contract v2.0.0).

Contract: `.gsd-t/contracts/wave-join-contract.md` v1.1.0; `.gsd-t/contracts/headless-default-contract.md` v2.0.0.

### Deviation Rules

When you encounter unexpected situations:
1. **Bug blocking progress** → Fix it, up to 3 attempts. If still blocked, add to `.gsd-t/deferred-items.md` and skip.
2. **Missing dependency clearly needed** → Add minimum required code to unblock. Note in commit.
3. **Blocker (missing file, wrong API)** → Fix blocker and continue. Log if non-trivial.
4. **Architectural change required** → STOP. Apply Destructive Action Guard. Never self-approve.

**3-attempt limit**: Stop looping after 3 failed fix attempts. Log and move on.

1. Identify exactly which files need to change
2. **Destructive Action Guard**: Check if this task involves destructive or structural changes (DROP TABLE, removing columns, deleting data, replacing architecture patterns, removing working modules, changing schema in ways that conflict with existing data). If YES → STOP and present the change to the user with what exists today, what will change, what will break, and a safe migration path. Wait for explicit approval.
3. If a contract exists for the relevant interface, implement to match it
4. **Design Hierarchy Build Rule** (if touching design components):
   - If building/modifying an ELEMENT: implement ONLY from the element contract. Every value must trace to the contract or design tokens.
   - If building/modifying a WIDGET: IMPORT existing element components — do NOT rebuild element functionality inline. If `chart-donut` exists in `src/components/elements/`, import it.
   - If building/modifying a PAGE: IMPORT existing widget components — do NOT rebuild widget functionality inline.
   - **Contract is authoritative**: Follow the contract spec, not the Figma screenshot, when they appear to disagree.
5. Make the change — **adapt new code to existing structures**, not the other way around
6. **Render-Measure-Compare** (if design component — MANDATORY):
   After implementing, verify via Playwright DOM measurement (not screenshots):
   - Render the component in browser
   - `page.evaluate()` to extract: display, flexDirection, gap, gridTemplateColumns,
     offsetWidth, offsetHeight, child count and layout
   - Compare each value to the contract's layout spec (body_layout, container_height, etc.)
   - Mismatches → fix code → re-measure (max 2 cycles)
   - This catches: wrong grid structure, legend below vs beside, wrong flex-direction
7. Verify it works
8. Commit: `[quick] {description}`

## Step 3.5: Emit Task Metrics

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-quick --step 3 --step-label ".5: Emit Task Metrics" 2>/dev/null || true
```

After committing, emit a task-metrics record for this quick task — run via Bash:
`node bin/metrics-collector.js --milestone {current-milestone-or-none} --domain {domain-or-quick} --task quick-{timestamp} --command quick --duration_s {elapsed} --tokens_used {estimated} --context_pct ${CTX_PCT:-0} --pass {true|false} --fix_cycles {0|N} --signal_type {pass-through|fix-cycle} --notes "[quick] {description}" 2>/dev/null || true`

Signal type: `pass-through` if task completed on first attempt; `fix-cycle` if rework was needed.

Emit task_complete event — run via Bash:
`node ~/.claude/scripts/gsd-t-event-writer.js --type task_complete --command gsd-t-quick --reasoning "signal_type={signal_type}, domain={domain}" --outcome {success|failure} || true`

## Step 4: Document Ripple (if GSD-T is active)

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-quick --step 4 --step-label "Document Ripple (if GSD-T is active)" 2>/dev/null || true
```

If `.gsd-t/progress.md` exists, assess what documentation was affected and update ALL relevant files:

### Always update:
1. **`.gsd-t/progress.md`** — Log the quick task in the Decision Log with date and description

### Check if affected:
2. **`.gsd-t/contracts/`** — Did you change an API endpoint, schema, or component interface? Update the contract
3. **Domain `scope.md`** — Did you add new files? Update the owning domain's scope
4. **Domain `constraints.md`** — Did you establish a new pattern or discover a "must not"? Add it
5. **`docs/requirements.md`** — Did this task add, change, or clarify a requirement? Update it
6. **`docs/architecture.md`** — Did this task change how components connect or data flows? Update it
7. **`docs/schema.md`** — Did this task modify the database? Update it
8. **`.gsd-t/techdebt.md`** — Did this task resolve a debt item? Mark it done. Did it reveal new debt? Add it
9. **`CLAUDE.md`** — Did this task establish a convention future work should follow? Add it

### Scan Doc Micro-Update (if `.gsd-t/scan/` exists):
Patch structural metadata in scan docs so they stay fresh between full scans. Near-zero cost — no LLM re-analysis.

For each scan doc that exists, apply only the relevant patches:
- **`.gsd-t/scan/architecture.md`** — Update file/directory counts, add new files/modules created
- **`.gsd-t/scan/quality.md`** — Mark resolved TODOs/FIXMEs, update test counts, append new files to Consumer Surfaces if applicable
- **`.gsd-t/scan/security.md`** — If a security finding was fixed, mark it `[RESOLVED]`
- **`.gsd-t/scan/business-rules.md`** — Append any new validation/auth/workflow rules added
- **`.gsd-t/scan/contract-drift.md`** — If contracts were updated, mark resolved drift items

Skip scan docs not affected by this task. Skip analytical sections — those require a full scan.

### Skip what's not affected — most quick tasks will only touch 1-2 of these.

## Step 5: Test & Verify (MANDATORY)

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-quick --step 5 --step-label "Test & Verify (MANDATORY)" 2>/dev/null || true
```

Quick does not mean skip testing. Before committing:

1. **Write/update tests for every new or changed code path**:
   - Unit tests: happy path + common edge cases + error cases
   - Playwright E2E specs (if UI/routes/flows/modes changed): create new specs for new functionality, update existing specs for changed behavior
   - Cover all modes/flags affected by this change
   - "No feature code without test code" applies to quick tasks too
   - **Functional tests only** — every E2E assertion must verify an action produced the correct outcome (state changed, data loaded, content updated). Tests that only check element existence (`isVisible`, `toBeEnabled`) are shallow/layout tests and are not acceptable. If a test would pass on an empty HTML page with the right IDs, rewrite it.
2. **Run ALL configured test suites** — not just affected tests, not just one suite:
   a. Detect all runners: check for vitest/jest config, playwright.config.*, cypress.config.*
   b. Run EVERY detected suite. Unit tests alone are NEVER sufficient when E2E exists.
   c. If `playwright.config.*` exists → `npx playwright test` (full suite)
   d. Report ALL results: "Unit: X/Y pass | E2E: X/Y pass"
   - Fix any failures before proceeding (up to 2 attempts)
3. **Verify against requirements**:
   - Does the change satisfy its intended requirement?
   - Did the change break any existing functionality? (the full test run catches this)
   - If a contract exists for the interface touched, does the code still match?
4. **No test framework?**: Set one up, or at minimum manually verify and document how in the commit message

### Exploratory Testing (if Playwright MCP available)

After all scripted tests pass:
1. Check if Playwright MCP is registered in Claude Code settings (look for "playwright" in mcpServers)
2. If available: spend 3 minutes on interactive exploration using Playwright MCP
   - Try variations of happy paths with unexpected inputs
   - Probe for race conditions, double-submits, empty states
   - Test accessibility (keyboard navigation, screen reader flow)
3. Tag all findings [EXPLORATORY] in reports and append to .gsd-t/qa-issues.md
4. If Playwright MCP is not available: skip this section silently
Note: Exploratory findings do NOT count against the scripted test pass/fail ratio.

## Step 5.25: Design Verification Agent (MANDATORY when design contract exists)

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-quick --step 5 --step-label ".25: Design Verification Agent (MANDATORY when design contract exists)" 2>/dev/null || true
```

After tests pass, check if `.gsd-t/contracts/design-contract.md` exists. If it does NOT, skip to Step 5.5.

If it DOES exist and this task involved UI changes — spawn the Design Verification Agent. This agent's ONLY job is to open a browser, compare the built frontend against the original design, and produce a structured comparison table. It writes NO feature code.

⚙ [opus] Design Verification → visual comparison of built frontend vs design

**OBSERVABILITY LOGGING (MANDATORY) — wrap the Design Verification subagent spawn with `captureSpawn`:**

```
node -e "
const { captureSpawn } = require('./bin/gsd-t-token-capture.cjs');
(async () => {
  await captureSpawn({
    command: 'gsd-t-quick',
    step: 'Design Verify',
    model: 'opus',
    description: 'visual comparison of built frontend vs design',
    projectDir: '.',
    notes: 'design-verify',
    spawnFn: async () => { /* Task subagent (spawnType: validation, general-purpose, model: opus) — body below */ },
  });
})();
"
```

`captureSpawn` parses `result.usage` and writes the row to `.gsd-t/token-log.md` under the canonical header. Tokens column renders as `in=N out=N cr=N cc=N $X.XX` or `—`, never `N/A`.

**Design Verification subagent prompt body (passed to `spawnFn`):**

```
Task subagent (spawnType: validation, general-purpose, model: opus):
"You are the Design Verification Agent. Your ONLY job is to visually compare
the built frontend against the original design and produce a structured
comparison table. You write ZERO feature code.

FAIL-BY-DEFAULT: Every visual element starts as UNVERIFIED. Prove each matches.

STEP 0 (MANDATORY FIRST): Element count reconciliation.
Read INDEX.md or design-contract.md for Figma element counts (widgets per page,
total elements per page). Count the built page's widgets and elements via Playwright.
If counts don't match → CRITICAL DEVIATION: identify which are MISSING or EXTRA.

STEP 0.5: Data-labels cross-check.
For each element contract (or design-contract.md section), read the Test Fixture.
Verify EVERY label, value, percentage from the fixture appears verbatim in the
rendered UI. If any is missing → CRITICAL DEVIATION (wrong data). Wrong data
cannot be redeemed by visual polish.

1. Read .gsd-t/contracts/design-contract.md (flat) OR .gsd-t/contracts/design/ (hierarchical) for design source reference + Test Fixtures
2. Get Figma structured data via `get_metadata` (enumerate nodes) then `get_design_context`
   per widget node. ⚠ Do NOT use `get_screenshot` for Figma extraction — it returns pixels,
   not properties. `get_design_context` returns structured code and tokens.
   If no Figma MCP → use design images from contract as fallback.
3. Start dev server, open the built frontend in browser (Claude Preview/Chrome MCP/Playwright)
4. Compare built page values against `get_design_context` structured data
5. Build element inventory (30+ elements for a full page): every chart, label,
   icon, heading, card, button, spacing, color — each a separate row
6. Produce structured comparison table:
   | # | Section | Element | Design (specific) | Implementation (specific) | Verdict |
   Only valid verdicts: ✅ MATCH or ❌ DEVIATION (never 'appears to match')
7. SVG Structural Overlay Comparison:
   a. Export Figma frame as SVG (or ask user for SVG path if export unavailable)
   b. Parse SVG DOM: extract positions, dimensions, fills, text for every element
   c. Screenshot built page at same viewport width via Playwright
   d. Map SVG elements → built DOM elements by text content + position proximity
   e. Compare: position (≤2px=MATCH, 3-5px=REVIEW, >5px=DEVIATION),
      dimensions, colors (exact hex), text (exact match)
   f. Produce SVG structural diff table:
      | # | SVG Element | SVG Position | Built Position | Δ px | Verdict |
   g. Flag unmapped SVG elements as MISSING, unmapped DOM elements as EXTRA
   This catches aggregate visual drift that property-level checks miss.
8. DOM Box Model Inspection (for fixed-height containers):
   a. For each card body child, evaluate: offsetHeight, scrollHeight, flex-grow
   b. Flag elements where offsetHeight > scrollHeight * 1.5 as INFLATED
      (element using flex:1 when it shouldn't — box larger than content)
   c. Verify layout arithmetic: sum of child heights + gaps = body height
   d. Produce box model table:
      | Element | offsetHeight | scrollHeight | flex-grow | Verdict |
9. Write results (property table + SVG diff + box model) to .gsd-t/contracts/design-contract.md
   under '## Verification Status'
9. Any ❌ → append to .gsd-t/qa-issues.md with [VISUAL] tag
10. Report: DESIGN VERIFIED | DESIGN DEVIATIONS FOUND ({count})"
```

**Artifact Gate:** Read `.gsd-t/contracts/design-contract.md` — if no `## Verification Status` section with a comparison table exists, re-spawn (1 retry).

**If deviations found:** Fix them (max 2 cycles), re-verify. If persistent, log to `.gsd-t/deferred-items.md`.

## Step 5.5: Red Team — Adversarial QA (MANDATORY)

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-quick --step 5 --step-label ".5: Red Team — Adversarial QA (MANDATORY)" 2>/dev/null || true
```

After tests pass, spawn an adversarial Red Team agent. Its success is measured by bugs found, not tests passed.

⚙ [opus] Red Team → adversarial validation of quick task

Resolve the templated prompt path via Bash (same pattern as execute.md):
```
RT_PROMPT="$(npm root -g 2>/dev/null)/@tekyzinc/gsd-t/templates/prompts/red-team-subagent.md"
[ -f "$RT_PROMPT" ] || RT_PROMPT="templates/prompts/red-team-subagent.md"
```

**OBSERVABILITY LOGGING (MANDATORY) — wrap the Red Team subagent spawn with `captureSpawn`:**

```
node -e "
const { captureSpawn } = require('./bin/gsd-t-token-capture.cjs');
(async () => {
  await captureSpawn({
    command: 'gsd-t-quick',
    step: 'Red Team',
    model: 'opus',
    description: 'adversarial validation of quick task',
    projectDir: '.',
    notes: '{VERDICT} — {N} bugs found',
    spawnFn: async () => { /* Task subagent (spawnType: validation, general-purpose, model: opus) — always headless per headless-default-contract v2.0.0:
      'Read \$RT_PROMPT and follow it. Context for this run: quick task — adversarial validation of the code just changed. Write findings to .gsd-t/red-team-report.md.' */ },
  });
})();
"
```

`captureSpawn` parses `result.usage` and writes the row to `.gsd-t/token-log.md` under the canonical header. Tokens column renders as `in=N out=N cr=N cc=N $X.XX` or `—`, never `N/A`.

**If Red Team VERDICT is FAIL:**
1. Fix all CRITICAL and HIGH bugs (up to 2 fix cycles)
2. Re-run Red Team after fixes
3. If bugs persist, log to `.gsd-t/deferred-items.md` and present to user

**If GRUDGING-PASS:** Proceed to doc-ripple.

## Step 6: Doc-Ripple (Automated)

```bash
node scripts/gsd-t-watch-state.js advance --agent-id "$GSD_T_AGENT_ID" --parent-id "${GSD_T_PARENT_AGENT_ID:-null}" --command gsd-t-quick --step 6 --step-label "Doc-Ripple (Automated)" 2>/dev/null || true
```

After all work is committed but before reporting completion:

1. Run threshold check — read `git diff --name-only HEAD~1` and evaluate against doc-ripple-contract.md trigger conditions
2. If SKIP: log "Doc-ripple: SKIP — {reason}" and proceed to completion
3. If FIRE: spawn doc-ripple agent — `spawnType: 'validation'` (always headless per headless-default-contract v2.0.0):

⚙ [{model}] gsd-t-doc-ripple → blast radius analysis + parallel updates

Task subagent (spawnType: validation, general-purpose, model: sonnet):
"Execute the doc-ripple workflow per commands/gsd-t-doc-ripple.md.
Git diff context: {files changed list}
Command that triggered: quick
Produce manifest at .gsd-t/doc-ripple-manifest.md.
Update all affected documents.
Report: 'Doc-ripple: {N} checked, {N} updated, {N} skipped'"

4. After doc-ripple returns, verify manifest exists and report summary inline

$ARGUMENTS

## Auto-Clear

All work is committed to project files. Execute `/clear` to free the context window for the next command.
