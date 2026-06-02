# GSD-T: Smart Router — Tell GSD-T What You Need

You are the GSD-T smart router. The user describes what they want in plain language and you route to the correct GSD-T command automatically.

## Step 1: Load Context

Read:
1. `CLAUDE.md` — project context
2. `.gsd-t/progress.md` — current state, active milestone/phase

## Step 2a: Continuation Check

Before semantic evaluation, determine if this is a **continuation** of an already-running command.

**Continuation indicators (any = continuation):**
- Message is a follow-up, answer, acknowledgment, or status report — not a new task request
- Message contains tool output, code, file content, or work artifacts from ongoing work
- Message reads as mid-task input (e.g., "both files parse cleanly", "yes continue", "looks good", "done")
- Progress.md shows an active/in-progress phase AND the message doesn't clearly start a new task

**If continuation detected** → skip Step 2 and Step 2.5, go to Step 3 using the **continuation format**.

**If NOT a continuation** → proceed to Step 2.5 (intent classification).

---

## Step 2.5: Intent Classification

> **Inverted default (M43 D4, v2.0.0)** — the only in-session surface in GSD-T is this router itself, and only for dialog-only (exploratory) turns. Every **workflow** turn spawns a detached command unconditionally. There is no `--in-session` flag, no `--headless` flag, no context-meter threshold that reroutes. See `.gsd-t/contracts/headless-default-contract.md` v2.0.0 §Invariants.

For non-continuation messages, decide whether the request is **conversational** (user is thinking, exploring, or articulating — no command spawn; stays in the dialog channel) or **workflow** (user wants work done — route to a GSD-T command via Step 2; **always spawns detached**).

This step replaces the retired `/gsd-t-prompt`, `/gsd-t-brainstorm`, and `/gsd-t-discuss` commands, whose use cases the router now handles inline.

### Conversational triggers (respond inline, NO command spawn):

- **Idea articulation / structuring**: "help me think through this", "I have an idea but…", "what questions should I ask myself", "help me structure this before I commit"
- **Brainstorming / exploration**: "let me brainstorm", "what are some alternatives", "I'm stuck — what other angles", "what if we rethink", "what assumptions are we making", "what would the best version look like"
- **Design / trade-off discussion**: "let's explore trade-offs before we commit", "what are the options for X", "should we use A or B" (asked as exploration, not as a request to decide and build)
- **Open-ended questions about direction**: "what do you think about…", "how should we approach…"

**Action for conversational triggers**: print the output format (see Step 3) and respond directly in the conversation using the same reasoning pattern the deleted commands used — ask clarifying questions, lay out options, reframe assumptions, summarize insights. Do NOT spawn a GSD-T command. End the turn when the user seems ready to act; they will come back with a workflow request.

### Workflow triggers (proceed to Step 2 semantic evaluation):

- Direct task requests / action verbs: "fix", "add", "implement", "refactor", "ship", "build", "run", "execute", "deploy", "delete", "rename"
- Named artifacts: "run the tests", "scan the codebase", "verify the milestone", "status"
- Design-to-code requests (see Step 2 design-to-code routing)
- Anything where the user expects files to change or a command to run

**Action for workflow triggers**: proceed to Step 2 — which then spawns detached unconditionally (v2.0.0 invariant).

### Default

When classification is ambiguous, default to **conversational**. Users who want work done are almost always explicit; users who are thinking deserve thinking partnership, not premature spawning.

---

## Step 2: Semantic Evaluation

Read the **Command Summaries** section of `commands/gsd-t-help.md` (or the in-memory skill list). For each command, evaluate whether the user's request matches that command's **Summary** and **Use when** criteria.

### Evaluation process:

1. **Read the request**: Understand what the user is actually asking for — not just keywords, but intent, scope, and context
2. **Evaluate each command**: For every GSD-T command, ask: "Would this command raise its hand for this request?" Consider:
   - Does the request match the command's stated purpose?
   - Does the scope align? (small task vs. large feature vs. full project)
   - Does the current project state matter? (e.g., if mid-milestone, does this fit the active phase?)
3. **Collect candidates**: Commands that match get shortlisted
4. **Select the best fit**: From the candidates, pick the one whose purpose most closely matches the request

### Resolution rules:

- **0 matches** → Ask one clarifying question to narrow down
- **1 match** → Route immediately
- **2+ matches** → Pick the best fit based on scope and context. Show the runner-up:
  ```
  → Routing to /gsd-t-{command}: {reason}
    (also considered: gsd-t-{runner-up} — Esc to switch)
  ```

### Scope disambiguation:

When the same request could fit multiple commands at different scales:
- **Touches 1-3 files, straightforward** → `quick`
- **New capability spanning multiple files/components** → `feature`
- **Requires its own milestone with domains** → `milestone` or `project`
- **Needs investigation before fixing** → `debug` (not `quick`)
- **Spec/requirements to verify against code** → `gap-analysis` (not `scan`)

### Design-to-code routing:

When the request involves UI implementation from a design (Figma URL, screenshots, mockups, "pixel-perfect", "match the design", "rebuild the frontend", "build from this Figma"):

**This is a PIPELINE, not a single command.** The router must evaluate where the user is in the pipeline and execute from that point forward, auto-advancing through subsequent steps.

**Pipeline order:**
1. **Clean** (if requested) — remove existing UI assets via inline cleanup (not a separate `quick` command)
2. **Decompose** — `design-decompose` to extract element → widget → page contracts from the Figma design
3. **Build** — `design-build` to implement from contracts with review gates

**Pipeline entry logic — evaluate these in order, enter at the first that applies:**

| Condition | Entry point | Steps executed |
|-----------|-------------|----------------|
| User says "start over", "from scratch", "rebuild", "remove existing", "clean slate" | **Clean → Decompose → Build** | Remove existing UI assets in `src/components/`, `src/views/`, and related style files. Then run `design-decompose` with the Figma URL. Then run `design-build`. |
| No design contracts exist (`.gsd-t/contracts/design/` missing or empty) | **Decompose → Build** | Run `design-decompose` with the Figma URL. Then run `design-build`. |
| Design contracts exist but UI not yet built (contracts present, source files missing) | **Build** | Run `design-build` directly. |
| Design contracts AND source files exist | **Build** | Run `design-build` (will measure existing components against contracts). |

**How to execute the pipeline:**

Route to the entry point command. At the end of that command, **auto-advance to the next pipeline step** — do not stop and ask the user. Display:
```
→ Design pipeline: {step 1} ✓ → {step 2} (starting) → {step 3} (pending)
```

**Clean step** (inline, not a separate command):
When cleanup is needed, do it at the start of `design-decompose` before reading the Figma:
- Remove UI component files (`src/components/`, `src/views/`, or equivalent)
- Remove associated style files and test files for those components
- Keep non-UI files (API services, stores, types, utilities, router config)
- Keep the project scaffold (App.vue/tsx, main.ts, index.html)
- `git add -A && git commit -m "chore: clean UI assets for design rebuild"`

**NEVER route design-to-code requests to `quick`** — design-to-code requires the full pipeline with contracts, measurement, and review gates.

**Fallback for non-pipeline design routing** (when the request is about an existing milestone/wave, not a fresh design build):
- **If no active milestone exists** → route to `wave` (creates milestone → partition with design contract → plan → execute with visual verification)
- **If a milestone exists but no domains** → route to `partition` (creates design contract in Step 3.6)
- **If domains exist but no tasks** → route to `plan`
- **If tasks exist** → route to `execute` (design-to-code stack rule will inject)

## Step 3: Confirm and Execute

**MANDATORY — output one of these lines as the VERY FIRST thing in your response, before any tool calls or other output.**

### New request (from Step 2):
```
→ Routing to /gsd-t-{command}: {brief reason}
```

### Conversational (from Step 2.5):
```
→ Conversational mode (no command spawn)
```
Follow this header with your direct in-line response — ask clarifying questions, surface options, reframe assumptions, offer a synthesis. Do NOT invoke any GSD-T command. End the turn when the conversation reaches a natural stopping point; the user will return with a workflow request if they want work done.

### Design pipeline (from design-to-code routing):
```
→ Design pipeline: clean → decompose → build
  Starting: /gsd-t-design-decompose
```
Use this format when the router detects a design-to-code pipeline. Show the full pipeline with the current step highlighted. Auto-advance between steps without returning to the router.

### Continuation (from Step 2a):
```
→ /gsd ──▶ continue /gsd-t-{last-command}
```

Where `{last-command}` is:
1. The command most recently active in this conversation, OR
2. Inferred from progress.md current phase:

| Phase in progress.md | Command slug |
|----------------------|--------------|
| EXECUTE | `execute` |
| PLAN | `plan` |
| PARTITION | `partition` |
| VERIFY | `verify` |
| INTEGRATE | `integrate` |
| TEST-SYNC | `test-sync` |
| COMPLETE | `complete-milestone` |
| SCAN | `scan` |
| WAVE | `wave` |
| QUICK | `quick` |
| DEBUG | `debug` |

**CRITICAL: `{command}` and `{last-command}` MUST be a real GSD-T command slug — never a free-form description.**

Valid command slugs: `quick`, `debug`, `feature`, `execute`, `milestone`, `project`, `scan`, `gap-analysis`, `plan`, `partition`, `impact`, `integrate`, `verify`, `test-sync`, `complete-milestone`, `wave`, `status`, `populate`, `setup`, `init`, `health`, `log`, `pause`, `resume`, `prd`, `backlog-add`, `backlog-list`, `backlog-promote`, `promote-debt`, `triage-and-merge`, `version-update`, `version-update-all`, `design-decompose`, `design-build`, `design-audit`, `design-review`

**WRONG ❌** — do not do this:
```
→ Routing to research + PRD update: reading web app auth code
→ Routing to implementation: adding the login feature
→ /gsd ──▶ continue: mid-task work
```

**RIGHT ✅** — always use the exact command slug:
```
→ Routing to /gsd-t-execute: implement auth feature across backend
→ Routing to /gsd-t-debug: investigate login bug before fixing
→ /gsd ──▶ continue /gsd-t-execute
→ /gsd ──▶ continue /gsd-t-quick
```

This MUST be the very first line of your response. Then immediately **read and follow that command file's instructions** (`~/.claude/commands/gsd-t-{slug}.md`), passing `$ARGUMENTS` through. "Execute the command's full workflow" means **do what the command file says** — for workflow-backed commands (scan, execute, verify, wave, integrate, debug, and the phase-runner commands) that means **invoke the `Workflow` tool as the command instructs**. It does NOT mean improvise the work yourself, hand-drive a fan-out, or reconstruct the workflow's stages in your own reasoning. If the command file says "invoke the Workflow tool," you invoke the Workflow tool — full stop.

**Do NOT ask "is this the right command?" — just route and go.** The user can interrupt with Esc if it's wrong.

## Step 4: No Arguments

If called with no arguments, show:

```
Usage: /gsd {describe what you want}

Examples:
  /gsd Fix the login timeout bug
  /gsd Add dark mode support
  /gsd Scan the codebase for tech debt
  /gsd What's the current progress?
  /gsd Compare this spec against our code
  /gsd Help me think through this integration before I start
  /gsd I'm stuck — what are other angles?

I'll route to the right GSD-T command — or just think out loud with you
if you're still figuring things out (no command spawn).
```

## Step 5: Dialog-Channel Growth Warning (M43 D5)

After you've finished your response text (routing header + any conversational body + any command invocation), check whether dialog growth is trending toward `/compact` and, if so, append a one-line warning footer. This is a pure read/warn signal — it never refuses, never reroutes, never blocks.

### When to check

- Always — every router turn ends with this check. Cost is a single JSONL read of `.gsd-t/metrics/token-usage.jsonl`.

### How to check

Run the following (substitute the current session id; `$CLAUDE_SESSION_ID` works in most shells, otherwise fall back to the most recent `sessionType: "in-session"` session in the sink):

```
node -e "
const { estimateDialogGrowth } = require('./bin/runway-estimator.cjs');
const r = estimateDialogGrowth({
  projectDir: '.',
  sessionId: process.env.CLAUDE_SESSION_ID || '',
});
if (r.shouldWarn) {
  const n = r.predicted_turns_to_compact;
  const k = r.k;
  const d = Math.round(r.median_delta);
  console.log('> ⚠  Dialog pressure: ~' + n + ' turns to /compact (last K=' + k + ' turns, growth ~' + d + '/turn).');
  console.log('> Consider spawning the next action detached (\`/gsd ... --detach\`) or running \`/compact\` now.');
}
"
```

### What to emit

If the node call prints nothing (growth flat, insufficient history, no session, etc.), emit nothing. Otherwise append the printed block verbatim as the last lines of your response. It MUST render as a blockquote — two lines, starting with `> ⚠`. Never reformat it, never prepend explanation, never turn it into a modal or a `/clear` command.

### What NOT to do

- Do NOT refuse or defer the user's request based on this signal.
- Do NOT silently route to a different command because of growth.
- Do NOT emit the warning more than once per turn.
- Do NOT write to any file from this step — it is pure read + footer print.

$ARGUMENTS
